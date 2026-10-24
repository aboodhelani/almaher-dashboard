"use client";

import { ar, LiveMatch, LiveRound, secs } from "@/lib/api";
import { Chip, Icon, RoundBadge, roundInfo, Ring, seatVars, Track } from "./ui";

type P = "player1" | "player2";
type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

/** The current question of a match: round, prompt, answer key and live state. */
export default function RoundStatus({ match, round: r, now = Date.now(), receivedAt = now, large }: {
  match: LiveMatch;
  round: LiveRound;
  now?: number;
  receivedAt?: number;
  large?: boolean;
}) {
  const info = roundInfo(r.type);
  const name = (p: P | null | undefined) => (p ? match.participants[p]?.name ?? "" : "");
  const left = Math.max(0, r.secondsLeft - Math.floor((now - receivedAt) / 1000));
  const isAyah = r.type === "ayah_number";
  const meta = r.question.meta ?? {};
  const per = r.roundSize ?? r.total / r.roundTotal;

  return (
    <div className="round" style={{ "--c": info.color } as Vars}>
      <div className="round-head">
        <RoundBadge type={r.type} />
        <div className="grow">
          <b>{info.name}</b>
          <span className="small muted">
            الفقرة {ar(r.roundIndex + 1)} من {ar(r.roundTotal)} · السؤال {ar(r.indexInRound + 1)} من {ar(per)}
          </span>
        </div>
        {r.type === "similar" && r.worth != null && r.phase === "answering" && (
          <Chip color="var(--gold)" solid>
            ★ {ar(r.worth)} نقاط
          </Chip>
        )}
        {r.replaced && <Chip color="var(--gold)">↻ سؤال بديل</Chip>}
        {r.forfeited && (
          <Chip color="var(--bad)">
            🏳 انسحب {name(r.forfeited)} من السؤال
          </Chip>
        )}
        {r.phase === "revealed" ? (
          <Chip>✓ انتهى</Chip>
        ) : r.timeLimitSeconds > 0 ? (
          <Ring left={left} total={r.timeLimitSeconds} color={info.color} />
        ) : (
          <Chip>بلا وقت</Chip>
        )}
      </div>

      <Track round={r} />

      {r.question.prompt == null ? (
        <p className="prompt muted">🎧 يُقرأ السؤال على المتسابقين</p>
      ) : isAyah ? (
        <p className={`ayah ${large ? "big" : ""}`}>{r.question.prompt}</p>
      ) : (
        <p className="prompt">{r.question.prompt}</p>
      )}
      {r.question.total != null && (
        <div className="center-text">
          <Chip color={info.color}>العدد الكلي: {ar(r.question.total)}</Chip>
        </div>
      )}
      {r.question.answer != null && (
        <div className="key">
          <Icon name="key" />
          <span>
            الإجابة:{" "}
            {isAyah
              ? `صفحة ${ar(Number(meta.page))} (${String(meta.surahName ?? "")}) · ${ayahCount(Number(r.question.answer))}`
              : r.question.answer}
          </span>
        </div>
      )}

      {(r.type === "ayah_number" || r.type === "auction") && (
        <div className="minis">
          {(["player1", "player2"] as const).map((p) => {
            const a = r.answers[p];
            const won = r.awarded.includes(p) && r.phase === "revealed";
            return (
              <div key={p} className={`mini ${won ? "won" : ""}`} style={seatVars(p)}>
                <div className="small muted">{name(p)}</div>
                <div className="val">{a.value != null ? a.value : a.submitted ? "🔒" : "…"}</div>
                <div className="speed">
                  {r.firstAnswered === p && (
                    <Chip color="var(--gold)" solid>
                      ⚡ الأسرع
                    </Chip>
                  )}
                  {a.secondsTaken != null && <span className="small">{secs(a.secondsTaken)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {r.type === "auction" && !r.reciter && r.phase === "answering" && (
        <div
          className={`status-line ${r.highBidder ? "strong" : ""}`}
          style={{ "--c": r.highBidder ? `var(--${r.highBidder === "player1" ? "p1" : "p2"})` : info.color } as Vars}
        >
          🔨{" "}
          {r.highBidder
            ? `أعلى مزايدة: ${ar(r.answers[r.highBidder].value ?? 0)} لـ ${name(r.highBidder)}`
            : `لا مزايدات بعد · يبدأ ${name(r.turn)}`}
          {r.highBidder && ` · الدور لـ ${name(r.turn)}`}
        </div>
      )}

      {r.type === "auction" && r.reciter && r.phase === "answering" && (
        <div className="status-line strong" style={{ "--c": `var(--${r.reciter === "player1" ? "p1" : "p2"})` } as Vars}>
          🎙 {name(r.reciter)} يسرد الآن: {ar(r.answers[r.reciter].value ?? 0)}
        </div>
      )}

      {(r.type === "what_do_you_know" || r.type === "similar" || r.type === "sard") && (
        <div className="strikes">
          {(["player1", "player2"] as const).map((p) => (
            <div
              key={p}
              className={`strike-box ${r.type === "what_do_you_know" && r.turn === p && r.phase === "answering" ? "turn" : ""}`}
              style={seatVars(p)}
            >
              <div className="small">
                {name(p)} {r.type === "what_do_you_know" && r.turn === p && r.phase === "answering" && "· دوره"}
                {(r.type === "similar" || r.type === "sard") && r.lockedOut.includes(p) && "· خرج"}
                {r.type === "what_do_you_know" && r.passed?.includes(p) && "· تجاوز"}
              </div>
              <div className="dots">
                {Array.from({ length: r.maxStrikes }, (_, i) => (
                  <i key={i} className={i < r.strikes[p] ? "x" : ""}>
                    {i < r.strikes[p] ? "✕" : ""}
                  </i>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {r.type === "ayah_by_ayah" && r.chain && (
        <>
          {r.phase === "answering" && (
            <div className="status-line strong" style={{ "--c": `var(--${r.turn === "player1" ? "p1" : "p2"})` } as Vars}>
              🎙 دور {name(r.turn)}: بداية الآية التالية
            </div>
          )}
          {r.phase === "answering" && r.chain.next && (
            <div className="answer key">
              المطلوبة: <b className="ayah-inline">{r.chain.next.opening}…</b>
              <span className="small muted">
                {" "}
                · {r.chain.next.surahName} {ar(r.chain.next.ayah)}
              </span>
            </div>
          )}
          {r.chain.said.length > 0 && (
            <div className="refs">
              {r.chain.said.map((opening, i) => (
                <div key={i} className="ref">
                  <span className="small muted">{ar(i + 1)}</span>
                  <span className="ayah-inline small-ayah">{opening}…</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {r.type === "what_do_you_know" && (
        <div className="small muted center-text">
          ذُكر {ar(r.saidCount)} من {ar(r.question.refs?.length ?? 0)}
        </div>
      )}

      {r.type === "right_left" && r.rightLeft && (
        <div className="strikes">
          {(["player1", "player2"] as const).map((p) => {
            const res = r.rightLeft!.results[p];
            const running = r.rightLeft!.player === p && r.rightLeft!.stage === "running" && r.phase === "answering";
            return (
              <div key={p} className={`strike-box ${running ? "turn" : ""}`} style={seatVars(p)}>
                <div className="small">
                  {name(p)} {running && `· ${ar(r.rightLeft!.index + 1)}/${ar(r.rightLeft!.perRun)}`}
                </div>
                <div className="dots">
                  {Array.from({ length: r.rightLeft!.perRun }, (_, i) => {
                    const c = res?.correct[i];
                    return (
                      <i key={i} className={c === false ? "x" : c ? "ok" : ""}>
                        {c === false ? "✕" : c ? "✓" : ""}
                      </i>
                    );
                  })}
                </div>
                {res?.finished && <div className="small">{ar(res.right)} صحيحة</div>}
              </div>
            );
          })}
        </div>
      )}

      {r.type === "buzzer" && r.phase === "answering" && (
        <div
          className={`status-line ${r.activeBuzzer ? "strong" : ""}`}
          style={{ "--c": r.activeBuzzer ? `var(--${r.activeBuzzer === "player1" ? "p1" : "p2"})` : info.color } as Vars}
        >
          🔔{" "}
          {r.activeBuzzer
            ? r.lockedOut.length
              ? `أخطأ ${name(r.lockedOut[0])}، يجيب الآن ${name(r.activeBuzzer)}`
              : `${name(r.activeBuzzer)} ضغط الجرس`
            : "بانتظار من يضغط الجرس"}
        </div>
      )}

      {r.phase === "revealed" && (
        <div className="status-line" style={{ "--c": r.awarded.length ? "var(--ok)" : "#fff" } as Vars}>
          {r.awarded.length === 0
            ? "بلا نقطة"
            : `${r.points > 1 ? `+${ar(r.points)} نقاط` : "+١ نقطة"} لـ ${r.awarded.map((p) => name(p)).join(" و ")}`}
        </div>
      )}
    </div>
  );
}

/** "٧ آيات" / "١٥ آية": the counted noun is plural only for 3–10. */
function ayahCount(n: number) {
  const m = n % 100;
  return `${ar(n)} ${m >= 3 && m <= 10 ? "آيات" : "آية"}`;
}
