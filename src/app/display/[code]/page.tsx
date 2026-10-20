"use client";

import { use, useEffect, useRef, useState } from "react";
import { Avatar, RoundIcon, roundInfo, Track } from "@/components/ui";
import { apiGet, LiveMatch } from "@/lib/api";

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;
type State = LiveMatch & { winner: "player1" | "player2" | "draw" | null };
type P = "player1" | "player2";

/**
 * The big screen for a same-room match (a TV or projector): scores, the
 * round and question as the audience should see them, the timer, and the
 * winner. No controls. Refreshes every second.
 */
export default function DisplayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [state, setState] = useState<State | null>(null);
  const [missing, setMissing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [receivedAt, setReceivedAt] = useState(Date.now());
  // Browsers only allow sound after a click, so it starts muted.
  const [soundOn, setSoundOn] = useState(false);
  const last = useRef<State | null>(null);
  const ticked = useRef<number | null>(null);

  const play = (name: string) => {
    if (!soundOn) return;
    const a = new Audio(`/sounds/${name}.wav`);
    void a.play().catch(() => {});
  };

  // Same cues as the app: new question, buzzer, verdicts, winner.
  useEffect(() => {
    const prev = last.current;
    last.current = state;
    if (!prev || !state) return;
    if (state.status === "finished" && prev.status !== "finished") return play("win");
    const a = prev.round;
    const b = state.round;
    if (!b) return;
    if (!a || a.index !== b.index || (b.replaced && !a.replaced)) return play("question");
    if (a.phase === "answering" && b.phase === "revealed") return play(b.awarded.length ? "correct" : "wrong");
    const sum = (x: Record<string, number>) => Object.values(x).reduce((m, n) => m + n, 0);
    if (sum(b.strikes) > sum(a.strikes) || b.lockedOut.length > a.lockedOut.length) return play("wrong");
    if (b.saidCount > a.saidCount) return play("correct");
    if (!a.activeBuzzer && b.activeBuzzer) return play("buzz");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiGet<State>(`/admin/matches/${encodeURIComponent(code)}/display`)
        .then((s) => {
          if (!alive) return;
          setState(s);
          setReceivedAt(Date.now());
          setMissing(false);
        })
        .catch(() => alive && setMissing(true));
    load();
    const poll = setInterval(load, 1000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [code]);

  if (!state) {
    return (
      <div className="display center-screen">
        <img src="/logo.svg" alt="" className="display-logo" />
        <p className="display-sub">{missing ? "لا توجد مباراة بهذا الرقم" : "جارٍ التحميل…"}</p>
      </div>
    );
  }

  const r = state.round;
  const p = state.participants;
  const name = (x: P) => p[x]?.name ?? "بانتظار الانضمام";
  const color = r ? roundInfo(r.type).color : "var(--r-wdyk)";
  const left = r ? Math.max(0, r.secondsLeft - Math.floor((now - receivedAt) / 1000)) : 0;
  const answering =
    r && r.phase === "answering"
      ? r.type === "what_do_you_know"
        ? r.turn
        : r.type === "auction"
          ? r.reciter ?? r.highBidder
          : r.activeBuzzer
      : null;

  if (r && r.phase === "answering" && r.timeLimitSeconds > 0 && left >= 1 && left <= 5 && ticked.current !== left) {
    ticked.current = left;
    play("tick");
  }

  return (
    <div className="display" style={{ "--c": color } as Vars}>
      {!soundOn && (
        <button className="display-sound" onClick={() => setSoundOn(true)}>
          🔊 تشغيل الصوت
        </button>
      )}
      <header className="display-top">
        <div className="display-brand">
          <img src="/logo.svg" alt="" />
          <span>الماهر</span>
        </div>
        <div className="display-code">
          <small>رقم المباراة</small>
          <b dir="ltr">#{state.code}</b>
        </div>
      </header>

      <section className="display-vs">
        {(["player1", "player2"] as const).map((x, i) => {
          const won =
            (state.status === "finished" && state.winner === x) ||
            (r?.phase === "revealed" && r.awarded.includes(x));
          return (
            <div
              key={x}
              className={`display-player ${answering === x ? "active" : ""} ${won ? "won" : ""}`}
              style={{ order: i * 2, "--a": `var(--${x === "player1" ? "p1" : "p2"})`, "--b": `var(--${x === "player1" ? "p1" : "p2"}-end)` } as Vars}
            >
              <Avatar role={x} name={p[x]?.name} online={p[x]?.connected} size={110} />
              <div className="display-name">{name(x)}</div>
              <div className="display-score">{state.scores[x]}</div>
              {answering === x && <div className="display-tag">🎙 يجيب الآن</div>}
            </div>
          );
        })}
        <div className="display-vs-badge" style={{ order: 1 }}>
          ضد
        </div>
      </section>

      {state.status === "lobby" && (
        <section className="display-card center">
          <p className="display-big">ادخلوا المباراة من التطبيق برقم</p>
          <p className="display-huge" dir="ltr">
            #{state.code}
          </p>
        </section>
      )}

      {state.status === "finished" && (
        <section className="display-card center">
          <div className="display-trophy">🏆</div>
          <p className="display-huge">
            {state.winner === "draw" || !state.winner ? "تعادل" : `الفائز: ${name(state.winner)}`}
          </p>
        </section>
      )}

      {state.status === "playing" && r && (
        <section className="display-card">
          <div className="display-round">
            <span className="display-round-icon">
              <RoundIcon type={r.type} size={56} color="#fff" />
            </span>
            <div className="display-round-text">
              <b>{roundInfo(r.type).name}</b>
              <span>
                الفقرة {r.roundIndex + 1} من {r.roundTotal} · السؤال {r.indexInRound + 1} من{" "}
                {r.roundSize ?? r.total / r.roundTotal}
                {r.replaced && " · سؤال بديل"}
              </span>
            </div>
            {r.phase === "answering" && r.timeLimitSeconds > 0 && (
              <span
                className={`display-ring ${left <= 5 ? "urgent" : ""}`}
                style={{ "--p": left / r.timeLimitSeconds } as Vars}
              >
                <span>{left}</span>
              </span>
            )}
            {r.type === "similar" && r.worth != null && r.phase === "answering" && (
              <span className="display-worth">★ {r.worth} نقاط</span>
            )}
          </div>
          <Track round={r} />

          {r.question.prompt == null ? (
            <p className="display-prompt muted">🎧 استمعوا إلى السؤال</p>
          ) : r.type === "ayah_number" ? (
            <p className="display-ayah">{r.question.prompt}</p>
          ) : (
            <p className="display-prompt">{r.question.prompt}</p>
          )}

          {(r.type === "ayah_number" || r.type === "auction") && (
            <div className="display-answers">
              {(["player1", "player2"] as const).map((x) => (
                <div
                  key={x}
                  className={`display-answer ${r.awarded.includes(x) && r.phase === "revealed" ? "won" : ""}`}
                  style={{ "--a": `var(--${x === "player1" ? "p1" : "p2"})` } as Vars}
                >
                  <span>{name(x)}</span>
                  <b>
                    {r.answers[x].value != null ? r.answers[x].value : r.answers[x].submitted ? "🔒" : "…"}
                  </b>
                </div>
              ))}
            </div>
          )}

          {r.phase === "revealed" && r.question.answer != null && (
            <p className="display-key">
              الإجابة: <b>{r.question.answer}</b>
              {r.awarded.length > 0 &&
                ` · ${r.points > 1 ? `+${r.points}` : "+1"} لـ ${r.awarded.map((x) => name(x)).join(" و ")}`}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
