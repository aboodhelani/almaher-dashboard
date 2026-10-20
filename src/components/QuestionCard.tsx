"use client";

import { useState } from "react";
import { ar, Question } from "@/lib/api";
import { Chip, roundInfo } from "./ui";

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

const LIST_TYPES = new Set(["what_do_you_know", "auction", "similar"]);

/** One question with its answer key; long answer lists fold. */
export default function QuestionCard({
  question: q,
  action,
}: {
  question: Question;
  action?: { label: string; onClick: () => void | Promise<void>; danger?: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAyah = q.type === "ayah_number";
  const shownRefs = open ? q.refs : q.refs.slice(0, 3);

  return (
    <article className="card question-card" style={{ "--c": roundInfo(q.type).color } as Vars}>
      <div className="q-head">
        <Chip color={roundInfo(q.type).color}>{q.source === "manual" ? "مضاف يدويًا" : "مولّد"}</Chip>
        {action && (
          <button
            className={action.danger ? "danger" : ""}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await action.onClick();
              } finally {
                setBusy(false);
              }
            }}
          >
            {action.label}
          </button>
        )}
      </div>

      {isAyah ? <p className="ayah">{q.prompt}</p> : <p className="prompt">{q.prompt}</p>}

      <div className="answer key">
        الإجابة:{" "}
        <b className={q.type === "similar" || q.type === "sard" ? "ayah-inline" : ""}>
          {isAyah
            ? `صفحة ${ar(Number(q.meta.page))} (${String(q.meta.surahName ?? "")}) · ${ar(Number(q.answer))} آية`
            : q.answer}
        </b>
        {q.type === "sard" && (
          <span className="small muted">
            {" "}
            · {String(q.meta.surahName ?? "")} {ar(Number(q.meta.ayah))}
          </span>
        )}
      </div>

      {q.type === "right_left" && Array.isArray(q.meta.items) && (
        <div className="refs">
          {(q.meta.items as { text: string; side: string; page: number }[]).map((it, i) => (
            <div key={i} className="ref">
              <span className="small muted">
                {i < (q.meta.items as unknown[]).length / 2 ? "الأول" : "الثاني"} · ص {ar(it.page)} ·{" "}
                {it.side === "right" ? "يمين" : "يسار"}
              </span>
              <span className="ayah-inline small-ayah">{it.text}</span>
            </div>
          ))}
        </div>
      )}

      {LIST_TYPES.has(q.type) && q.refs.length > 0 && (
        <div className="refs">
          {shownRefs.map((r) => (
            <div key={`${r.surah}:${r.ayah}`} className="ref">
              <span className="small muted">
                {r.surahName} {ar(r.ayah)}
              </span>
              <span className="ayah-inline small-ayah">{r.text}</span>
            </div>
          ))}
          {q.refs.length > 3 && (
            <button className="link" onClick={() => setOpen((o) => !o)}>
              {open ? "إخفاء" : `عرض الكل (${ar(q.refs.length)})`}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
