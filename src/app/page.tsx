"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import CreateMatchForm from "@/components/CreateMatchForm";
import RoundStatus from "@/components/RoundStatus";
import { Avatar, Chip, Icon, roundInfo } from "@/components/ui";
import { apiGet, apiSend, ar, LiveMatch } from "@/lib/api";

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;
const ROLE_LABEL = { player1: "المتسابق الأول", player2: "المتسابق الثاني", referee: "الحكم" };

/** Live matches, refreshed every two seconds. */
export default function LiveMatchesPage() {
  const [matches, setMatches] = useState<LiveMatch[] | null>(null);
  const [error, setError] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loadedAt, setLoadedAt] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiGet<LiveMatch[]>("/admin/matches/live")
        .then((m) => {
          if (!alive) return;
          setMatches(m);
          setLoadedAt(Date.now());
          setError(false);
        })
        .catch(() => alive && setError(true));
    load();
    const t = setInterval(load, 2000);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(tick);
    };
  }, []);

  const list = matches ?? [];
  const playing = list.filter((m) => m.status === "playing").length;
  const online = list.reduce(
    (n, m) => n + Object.values(m.participants).filter((p) => p?.connected).length,
    0,
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>المباريات المباشرة</h1>
          <p>{error ? "⚠︎ الخادم لا يستجيب" : "تحديث تلقائي كل ثانيتين"}</p>
        </div>
      </div>

      <div className="stats">
        <Stat label="مباريات جارية الآن" value={list.length} color="var(--r-wdyk)" />
        <Stat label="قيد اللعب" value={playing} color="var(--r-similar)" />
        <Stat label="بانتظار البدء" value={list.length - playing} color="var(--r-auction)" />
        <Stat label="متصلون" value={online} color="var(--p1)" />
      </div>

      <CreateMatchForm onCreated={setCreated} />
      {created && (
        <div className="notice">
          <Icon name="check" />
          <span>
            أُنشئت المباراة <b className="mono">{created}</b>. يدخلها المتسابقان من التطبيق بكتابة هذا الرقم،
            ويمكنك أن تكون حكمها من بطاقتها.
          </span>
        </div>
      )}

      {matches === null ? (
        <p className="muted">جارٍ التحميل…</p>
      ) : matches.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎮</div>
          <p className="bold">لا توجد مباريات جارية الآن</p>
          <p className="muted">أنشئ مباراة من هنا أو من التطبيق، وستظهر بطاقتها فورًا.</p>
        </div>
      ) : (
        <div className="grid">
          {matches.map((m) => (
            <MatchCard key={m.code} match={m} now={now} receivedAt={loadedAt} />
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card stat" style={{ "--c": color } as Vars}>
      <i className="glow" />
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function MatchCard({ match: m, now, receivedAt }: { match: LiveMatch; now: number; receivedAt: number }) {
  const r = m.round;
  const [ending, setEnding] = useState(false);
  const referee = m.participants.referee;
  const refereeFree = !referee?.connected;

  async function end() {
    if (!confirm(`إنهاء المباراة ${m.code} الآن بالنتيجة الحالية؟`)) return;
    setEnding(true);
    try {
      await apiSend("POST", `/admin/matches/${m.code}/end`);
    } catch (e) {
      alert(`تعذر إنهاء المباراة: ${(e as Error).message}`);
      setEnding(false);
    }
  }

  const answering =
    r && r.phase === "answering"
      ? r.type === "what_do_you_know"
        ? r.turn
        : r.type === "auction"
          ? r.reciter
          : r.type === "similar" || r.type === "buzzer"
            ? r.activeBuzzer
            : null
      : null;
  const status =
    m.status === "lobby" && m.published === false
      ? { label: "غير منشورة: قيد الإعداد", color: "var(--gold)" }
      : m.status === "lobby"
      ? { label: "بانتظار البدء", color: "var(--r-auction)" }
      : r?.phase === "revealed"
        ? { label: "بانتظار السؤال التالي", color: "#fff" }
        : { label: "جارية", color: "var(--ok)" };

  return (
    <article className="card match-card" style={{ "--c": r ? roundInfo(r.type).color : "var(--r-auction)" } as Vars}>
      <div className="match-top">
        <span className="code">
          <small>#</small>
          {m.code}
        </span>
        <Chip>{m.mode === "remote" ? "عن بُعد" : "في نفس المكان"}</Chip>
        <Chip color={status.color} solid>
          {status.label}
        </Chip>
      </div>

      <div className="vs">
        {(["player1", "player2"] as const).map((p, i) => {
          const person = m.participants[p];
          const won = r?.phase === "revealed" && r.awarded.includes(p);
          return (
            <Fragment key={p}>
              {i === 1 && <span className="vs-badge">ضد</span>}
              <div
                className={`player ${won ? "won" : ""} ${answering === p ? "active" : ""}`}
                style={{ "--a": `var(--${p === "player1" ? "p1" : "p2"})`, "--b": `var(--${p === "player1" ? "p1" : "p2"}-end)` } as Vars}
              >
                <Avatar role={p} name={person?.name} online={person?.connected} />
                <span className="name">{person?.name ?? "بانتظار الانضمام"}</span>
                <span className="role">{answering === p ? "يجيب الآن" : ROLE_LABEL[p]}</span>
                <span className="score">{m.scores[p]}</span>
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="referee-row">
        <Avatar role="referee" name={referee?.name} online={referee?.connected} size={36} />
        <div className="grow">
          <div className="bold">{referee?.name ?? "بلا حكم بعد"}</div>
          <div className="small subtle">
            الحكم{referee && !referee.connected && " · غير متصل"}
          </div>
        </div>
        {refereeFree && (
          <Link className="button" href={`/referee/${m.code}`}>
            <Icon name="gavel" />
            كن الحكم
          </Link>
        )}
      </div>
      {offlineNote(m)}

      {r && <RoundStatus match={m} round={r} now={now} receivedAt={receivedAt} />}

      <footer className="card-actions">
        <span className="small subtle">
          {r ? `السؤال ${ar(r.index + 1)} من ${ar(r.total)}` : "لم تبدأ بعد"}
        </span>
        <a className="button ghost" href={`/display/${m.code}`} target="_blank" rel="noreferrer">
          📺 شاشة العرض
        </a>
        <button className="danger" onClick={end} disabled={ending}>
          {ending ? "…" : "إنهاء المباراة"}
        </button>
      </footer>
    </article>
  );
}

/** "Closes in 3:12 if X does not return" for anyone offline in a match. */
function offlineNote(m: LiveMatch) {
  const away = Object.values(m.participants).filter(
    (p): p is NonNullable<typeof p> & { offlineSince: number } => !!p && !p.connected && !!p.offlineSince,
  );
  if (away.length === 0) return null;
  const since = Math.min(...away.map((p) => p.offlineSince));
  const left = Math.max(0, 5 * 60 - Math.floor((Date.now() - since) / 1000));
  return (
    <div className="warn">
      ⚠︎ غير متصل: {away.map((p) => p.name).join("، ")} · تُغلق المباراة تلقائيًا بعد{" "}
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} إن لم يعد
    </div>
  );
}
