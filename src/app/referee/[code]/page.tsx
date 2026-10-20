"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import MatchSetup from "@/components/MatchSetup";
import RemoteMedia, { MediaGrant } from "@/components/RemoteMedia";
import RoundStatus from "@/components/RoundStatus";
import { Avatar, Chip, Icon } from "@/components/ui";
import { ar, getAdminKey, LiveMatch, SERVER_URL, totalQuestions } from "@/lib/api";

type Ack = { ok: boolean; error?: string; questions?: never[]; url?: string; token?: string };
type State = LiveMatch & { you: string; winner: string | null };
type P = "player1" | "player2";

const ERRORS: Record<string, string> = {
  role_taken: "للمباراة حكم متصل بالفعل",
  match_not_found: "لا توجد مباراة بهذا الرمز",
  players_missing: "لم ينضم المتسابقان بعد",
  not_answering: "انتهى هذا السؤال",
  not_revealed: "أنهِ السؤال أولًا",
  nobody_buzzed: "لم يضغط أحد الجرس بعد",
  bidding_open: "أغلق المزايدة أولًا",
  no_questions: "لا يوجد سؤال بديل الآن",
  not_published: "انشر المباراة أولًا",
  too_many_questions: "اكتملت أسئلة هذه الفقرة",
  already_started: "بدأت المباراة",
  prompt_required: "اكتب نص السؤال",
  already_finished: "انتهت المباراة بالفعل",
};

/**
 * The dashboard takes the referee seat of a match: it joins over the same
 * socket protocol as the app's referee and gets the same controls.
 */
export default function RefereePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const socket = useRef<Socket | null>(null);
  const [name, setName] = useState("الحكم");
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [receivedAt, setReceivedAt] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(t);
      socket.current?.disconnect();
    };
  }, []);

  function send(event: string, body: object = {}) {
    setError(null);
    socket.current?.emit(event, body, (ack: Ack) => {
      if (!ack.ok) setError(ERRORS[ack.error ?? ""] ?? ack.error ?? "خطأ");
    });
  }

  /** Like [send], resolving with the acknowledgement (setup lists). */
  const emitAck = useCallback((event: string, body: object = {}) => {
    setError(null);
    return new Promise<Ack>((resolve) =>
      socket.current?.emit(event, body, (ack: Ack) => {
        if (!ack.ok) setError(ERRORS[ack.error ?? ""] ?? ack.error ?? "خطأ");
        resolve(ack);
      }),
    );
  }, []);

  /** Remote matches: this seat's LiveKit grant (camera and mic). */
  const mediaToken = useCallback(
    () =>
      new Promise<MediaGrant>((resolve) => {
        const s = socket.current;
        if (!s) return resolve(null);
        s.emit("media:token", {}, (ack: Ack) =>
          resolve(ack.ok && ack.url && ack.token ? { url: ack.url, token: ack.token } : null),
        );
      }),
    [],
  );

  function accept(e: React.FormEvent) {
    e.preventDefault();
    // The dashboard referees with the admin key instead of a player account.
    const s = io(SERVER_URL, {
      transports: ["websocket"],
      forceNew: true,
      auth: { adminKey: getAdminKey() ?? "" },
    });
    socket.current = s;
    s.on("match:state", (st: State) => {
      setState(st);
      setReceivedAt(Date.now());
    });
    s.on("connect", () =>
      s.emit("match:join", { code, role: "referee", name }, (ack: Ack) => {
        if (ack.ok) setJoined(true);
        else {
          setError(ERRORS[ack.error ?? ""] ?? ack.error ?? "خطأ");
          s.disconnect();
        }
      }),
    );
    s.on("connect_error", () => setError(`تعذر الاتصال بالخادم (${SERVER_URL})`));
  }

  if (!joined) {
    return (
      <div className="narrow-page">
        <form className="card join-card form" onSubmit={accept}>
          <span className="hero">
            <Icon name="gavel" />
          </span>
          <h1>
            تحكيم المباراة <span className="mono" dir="ltr">#{code}</span>
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            ستنضم بصفتك الحكم: تبدأ المباراة، وتحكم الإجابات، وتبدّل السؤال عند الحاجة، وتنتقل للسؤال التالي. في المباريات عن بُعد تشارك بالكاميرا والميكروفون.
          </p>
          <label>
            اسم الحكم
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions center">
            <button type="submit" className="big">
              <Icon name="gavel" />
              قبول التحكيم
            </button>
            <Link className="button ghost" href="/">
              رجوع
            </Link>
          </div>
        </form>
      </div>
    );
  }

  if (!state) return <p className="muted">جارٍ الاتصال…</p>;

  const r = state.round;
  const p = state.participants;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            أنت الحكم · <span className="mono" dir="ltr">#{state.code}</span>
          </h1>
          <p>{state.mode === "remote" ? "عن بُعد" : "في نفس المكان"}</p>
        </div>
        <Link className="button ghost" href="/" onClick={() => socket.current?.disconnect()}>
          <Icon name="logout" />
          مغادرة التحكيم
        </Link>
      </div>

      {error && (
        <div className="notice" style={{ ["--ok" as string]: "var(--bad)" }}>
          ⚠︎ {error}
        </div>
      )}

      {/* Remote matches: cameras and voices, as in the app. */}
      {state.mode === "remote" && state.status !== "finished" && (
        <RemoteMedia match={state} requestToken={mediaToken} />
      )}

      <div className="console">
        <div className="main">
          {state.status === "lobby" && state.published === false && <MatchSetup state={state} emit={emitAck} />}

          {state.status === "lobby" && state.published !== false && (
            <div className="card center-text">
              <div className="empty-icon" style={{ fontSize: 40 }}>⏳</div>
              <h2>{p.player1 && p.player2 ? "المتسابقان جاهزان" : "بانتظار انضمام المتسابقَين بالرمز"}</h2>
              <div className="actions center">
                <button className="big" disabled={!p.player1 || !p.player2} onClick={() => send("match:start")}>
                  <Icon name="play" />
                  ابدأ المباراة ({ar(totalQuestions(state))} سؤالًا)
                </button>
              </div>
            </div>
          )}

          {state.status === "playing" && r && (
            <>
              <RoundStatus match={state} round={r} now={now} receivedAt={receivedAt} large />
              <RefereeControls state={state} send={send} />
            </>
          )}

          {state.status === "finished" && (
            <div className="card center-text">
              <div className="trophy">
                <Icon name="trophy" />
              </div>
              <h1>
                {state.winner === "draw" || !state.winner
                  ? "تعادل"
                  : `الفائز: ${p[state.winner as P]?.name ?? ""}`}
              </h1>
              <p className="result" style={{ fontSize: 28 }}>
                {state.scores.player1} - {state.scores.player2}
              </p>
              <div className="actions center">
                <Link className="button" href="/history">
                  سجل المباريات
                </Link>
              </div>
            </div>
          )}
        </div>

        <aside className="side">
          <div className="card">
            <div className="small subtle" style={{ marginBottom: 12 }}>
              النتيجة · تعديل يدوي
            </div>
            {(["player1", "player2"] as const).map((role) => (
              <div key={role} className="adjust" style={{ marginBottom: 12 }}>
                <Avatar role={role} name={p[role]?.name} online={p[role]?.connected} size={38} />
                <span className="grow">{p[role]?.name ?? "بانتظار الانضمام"}</span>
                <button className="icon" onClick={() => send("referee:adjust", { player: role, delta: -1 })}>
                  −
                </button>
                <span className="num">{state.scores[role]}</span>
                <button className="icon" onClick={() => send("referee:adjust", { player: role, delta: 1 })}>
                  +
                </button>
              </div>
            ))}
          </div>

          {state.status === "playing" && r && r.phase === "answering" && (
            <div className="card">
              <div className="small subtle" style={{ marginBottom: 10 }}>
                إنهاء السؤال يدويًا
              </div>
              <div className="actions" style={{ margin: 0 }}>
                {(["player1", "player2"] as const).map((role) => (
                  <button key={role} className="ghost" onClick={() => send("round:award", { player: role })}>
                    نقطة لـ {p[role]?.name}
                  </button>
                ))}
                <button className="ghost" onClick={() => send("round:award", { player: null })}>
                  بلا نقطة
                </button>
              </div>
            </div>
          )}

          {state.status === "playing" && (
            <div className="card">
              <div className="small subtle" style={{ marginBottom: 10 }}>
                إنهاء المباراة الآن
              </div>
              <button
                className="danger"
                style={{ width: "100%" }}
                onClick={() =>
                  confirm("إنهاء المباراة الآن؟ تُحتسب النتيجة الحالية ويُعلن الفائز.") && send("referee:end")
                }
              >
                <Icon name="close" />
                إنهاء المباراة
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/** Round-specific judging, swapping the question, and the next question. */
function RefereeControls({ state, send }: { state: State; send: (e: string, b?: object) => void }) {
  const r = state.round!;
  const name = (p: P | null) => (p ? state.participants[p]?.name ?? "" : "");
  const seat = (p: P) => ({ "--c": `var(--${p === "player1" ? "p1" : "p2"})` }) as React.CSSProperties;
  const last = r.index + 1 >= r.total;
  const verdicts = (ok: string, bad: string) => (
    <div className="verdicts">
      <button className="ok big" onClick={() => send("round:judge", { verdict: "correct" })}>
        <Icon name="check" />
        {ok}
      </button>
      <button className="bad big" onClick={() => send("round:judge", { verdict: "wrong" })}>
        <Icon name="close" />
        {bad}
      </button>
    </div>
  );
  // The referee can always swap the question or move on, in any round and
  // phase (an undecided question ends with no point).
  const nextButton = (
    <button className="big" onClick={() => send("round:next")}>
      {last ? "إنهاء المباراة" : "السؤال التالي"}
      <Icon name="next" />
    </button>
  );

  const swapButton = (
    <button
      className="ghost big"
      onClick={() => confirm("تبديل هذا السؤال بسؤال بديل من نفس الفقرة؟ إن احتُسبت له نقاط فستُلغى.") && send("round:replace")}
    >
      ↻ سؤال بديل
    </button>
  );

  let judging: React.ReactNode = null;
  if (r.phase === "revealed") {
    judging = null;
  } else if (r.type === "ayah_number") {
    judging = (
      <button className="big" onClick={() => send("round:reveal")}>
        <Icon name="eye" />
        اكشف الإجابات
      </button>
    );
  } else if (r.type === "auction") {
    judging = r.reciter ? (
      verdicts("نجح في السرد", "لم ينجح")
    ) : (
      <button className="big" onClick={() => send("round:reveal")}>
        <Icon name="gavel" />
        أغلق المزايدة
      </button>
    );
  } else if (r.type === "what_do_you_know") {
    const refs = r.question.refs ?? [];
    judging = (
      <>
        {verdicts(`إجابة صحيحة لـ ${name(r.turn)}`, "خطأ")}
        {!r.passed?.includes(r.turn) && (
          <div className="actions center" style={{ margin: 0 }}>
            <button className="ghost" onClick={() => send("round:pass")}>
              ⤼ تجاوز لـ {name(r.turn)} (مرة واحدة في السؤال)
            </button>
          </div>
        )}
        <div className="card">
          <div className="small muted" style={{ marginBottom: 8 }}>
            مفتاح الإجابة · اضغط الآية التي ذكرها المتسابق ({ar(r.saidCount)} من {ar(refs.length)})
          </div>
          <div className="progress" style={{ marginBottom: 10 }}>
            <i style={{ width: `${refs.length ? (r.saidCount / refs.length) * 100 : 0}%` }} />
          </div>
          <div className="answer-key">
            {refs.map((ref) => (
              <button
                key={`${ref.surah}:${ref.ayah}`}
                className={`ref-btn ${ref.said ? "said" : ""}`}
                disabled={ref.said}
                onClick={() => send("round:judge", { verdict: "correct", ref: `${ref.surah}:${ref.ayah}` })}
              >
                <span className="tick">{ref.said ? "✓" : ""}</span>
                <span className="ayah-inline small-ayah" style={{ flex: 1 }}>
                  {ref.text}
                </span>
                <span className="small subtle">
                  {ref.surahName} {ar(ref.ayah)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  } else if (r.type === "right_left" && r.rightLeft) {
    const rl = r.rightLeft;
    judging =
      rl.stage === "ready" ? (
        <button className="big" onClick={() => send("round:start_run")}>
          <Icon name="play" />
          ابدأ دور {name(rl.player)} ({ar(rl.perRun)} بدايات)
        </button>
      ) : (
        <div className="card center-text">
          <div className="small muted">
            دور {name(rl.player)} · البداية {ar(rl.index + 1)} من {ar(rl.perRun)}
          </div>
          <h2 style={{ margin: "6px 0" }}>
            الإجابة: {rl.side === "right" ? "يمين ➡" : "⬅ يسار"}
          </h2>
          <div className="small subtle">
            صفحة {ar(rl.page ?? 0)} · {rl.surahName} {ar(rl.ayah ?? 0)}
          </div>
        </div>
      );
  } else if (r.type === "similar" || r.type === "sard") {
    // No buzzer: judge whichever player answered aloud (3 tries each).
    judging = (
      <div className="verdicts-by-player">
        {(["player1", "player2"] as const)
          .filter((p) => !r.lockedOut.includes(p))
          .map((p) => (
            <div key={p} className="player-verdicts" style={seat(p)}>
              <b>{name(p)}</b>
              <button className="ok" onClick={() => send("round:judge", { verdict: "correct", player: p })}>
                <Icon name="check" />
                صحيح
              </button>
              <button className="bad" onClick={() => send("round:judge", { verdict: "wrong", player: p })}>
                <Icon name="close" />
                خطأ
              </button>
            </div>
          ))}
      </div>
    );
  } else if (r.activeBuzzer) {
    judging = verdicts("صحيح", "خطأ");
  }

  return (
    <>
      {judging}
      <div className="actions center">
        {swapButton}
        {nextButton}
      </div>
      {r.tiebreak && (
        <div className="center-text">
          <Chip color="var(--gold)" solid>
            🔥 سؤال الحسم: النقاط متساوية
          </Chip>
        </div>
      )}
      {r.replaced && (
        <div className="center-text">
          <Chip color="var(--gold)">يظهر للمتسابقين أن هذا سؤال بديل</Chip>
        </div>
      )}
    </>
  );
}
