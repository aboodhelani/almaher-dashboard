"use client";

import { useCallback, useEffect, useState } from "react";
import AddQuestionForm from "@/components/AddQuestionForm";
import QuestionCard from "@/components/QuestionCard";
import { Icon, RoundIcon } from "@/components/ui";
import { ar, countFor, LiveMatch, Question, QUESTION_TYPES, QuestionType } from "@/lib/api";

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;
type Ack = { ok: boolean; error?: string; questions?: Question[] };

/** The parts of a question the server needs to play it. */
const body = (q: Question) => ({ prompt: q.prompt, answer: q.answer, refs: q.refs, meta: q.meta });

const ERRORS: Record<string, string> = {
  no_rounds: "اختر فقرة واحدة على الأقل",
  invalid_count: "عدد أسئلة الفقرة خارج الحد المسموح",
  too_many_questions: "مجموع الأسئلة أكبر من الحد المسموح",
  round_off: "هذه الفقرة موقوفة في القواعد",
};

/**
 * The referee prepares a draft match: which rounds it plays and how many
 * questions each, the questions per round from the bank, generated, or newly
 * added, then publishes it. Rounds left short are filled at random when the
 * match starts.
 */
export default function MatchSetup({
  state,
  emit,
}: {
  state: LiveMatch;
  emit: (event: string, body?: object) => Promise<Ack>;
}) {
  const types = QUESTION_TYPES.filter((t) => countFor(state, t.type) > 0);
  const [picked, setType] = useState<QuestionType>(types[0].type);
  // The open tab's round may have just been turned off.
  const type = types.some((t) => t.type === picked) ? picked : types[0].type;
  const [source, setSource] = useState<"bank" | "generated">("bank");
  const [options, setOptions] = useState<Question[] | null>(null);
  const [adding, setAdding] = useState(false);
  const info = QUESTION_TYPES.find((t) => t.type === type)!;
  const chosen = state.setup?.[type] ?? [];
  const perRound = countFor(state, type);
  const full = chosen.length >= perRound;

  const load = useCallback(async () => {
    setOptions(null);
    const ack = await emit(source === "bank" ? "setup:bank" : "setup:suggest", { type });
    setOptions(ack.questions ?? []);
  }, [emit, source, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (list: Question[]) => {
    await emit("setup:set", { type, questions: list.map(body) });
  };

  return (
    <div className="setup">
      <div className="card setup-head">
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>إعداد المباراة</h2>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            المباراة غير منشورة: لن يدخلها المتسابقون حتى تنشرها. اختر أسئلة كل فقرة، أو اتركها لتُختار عشوائيًا.
          </p>
        </div>
        <button className="big" onClick={() => emit("setup:publish")}>
          <Icon name="play" />
          نشر المباراة
        </button>
      </div>

      <RoundsPicker state={state} emit={emit} />

      <div className="tabs">
        {types.map((t) => (
          <button
            key={t.type}
            className={`tab ${t.type === type ? "active" : ""}`}
            style={{ "--c": t.color } as Vars}
            onClick={() => {
              setType(t.type);
              setAdding(false);
            }}
          >
            <RoundIcon type={t.type} size={20} />
            {t.name}
            <span className="count">
              {ar(state.setup?.[t.type]?.length ?? 0)}/{ar(countFor(state, t.type))}
            </span>
          </button>
        ))}
      </div>

      <section>
        <div className="section-head">
          <h2>
            أسئلة {info.name} المختارة ({ar(chosen.length)} من {ar(perRound)})
          </h2>
        </div>
        {chosen.length === 0 ? (
          <p className="muted">لم تختر أسئلة بعد، وستُختار عشوائيًا.</p>
        ) : (
          <div className="grid">
            {chosen.map((q, i) => (
              <QuestionCard
                key={`${i}-${q.prompt}`}
                question={q}
                action={{ label: "إزالة", danger: true, onClick: () => save(chosen.filter((_, j) => j !== i)) }}
              />
            ))}
          </div>
        )}
        {!full && chosen.length > 0 && <p className="muted small">الباقي يُختار عشوائيًا.</p>}
      </section>

      <section>
        <div className="section-head">
          <h2>اختر من</h2>
          <div className="actions" style={{ margin: 0 }}>
            <button className={source === "bank" ? "" : "ghost"} onClick={() => setSource("bank")}>
              البنك
            </button>
            <button className={source === "generated" ? "" : "ghost"} onClick={() => setSource("generated")}>
              <Icon name="sparkles" />
              توليد
            </button>
            {source === "generated" && (
              <button className="ghost" onClick={() => void load()}>
                ↻ غيرها
              </button>
            )}
            <button className="ghost" onClick={() => setAdding((a) => !a)}>
              <Icon name={adding ? "close" : "plus"} />
              {adding ? "إلغاء" : "سؤال جديد للبنك"}
            </button>
          </div>
        </div>
        {adding && (
          <AddQuestionForm
            type={type}
            onSaved={async () => {
              setAdding(false);
              setSource("bank");
              await load();
            }}
          />
        )}
        {full && <p className="muted">اكتملت أسئلة هذه الفقرة.</p>}
        {options === null ? (
          <p className="muted">جارٍ التحميل…</p>
        ) : options.length === 0 ? (
          <p className="muted">لا أسئلة محفوظة لهذه الفقرة. جرّب «توليد».</p>
        ) : (
          <div className="grid">
            {options.map((q, i) => (
              <QuestionCard
                key={`${i}-${q.prompt}`}
                question={q}
                action={full ? undefined : { label: "إضافة", onClick: () => save([...chosen, q]) }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Which rounds the match plays and how many questions each: by default every
 * round the rules leave on, at the rules' questions per round. At least one
 * round stays on, within the rules' limits.
 */
function RoundsPicker({
  state,
  emit,
}: {
  state: LiveMatch;
  emit: (event: string, body?: object) => Promise<Ack>;
}) {
  const [error, setError] = useState<string | null>(null);
  const available = QUESTION_TYPES.filter(
    (t) => !state.availableRounds || state.availableRounds.includes(t.type),
  );
  const counts: Partial<Record<QuestionType, number>> = {};
  for (const t of available) {
    const n = countFor(state, t.type);
    if (n > 0) counts[t.type] = n;
  }
  const total = Object.values(counts).reduce((a, n) => a + (n ?? 0), 0);
  const on = Object.keys(counts).length;
  const maxPerRound = state.maxPerRound ?? 30;
  const maxQuestions = state.maxQuestions ?? 60;
  const maxFor = (type: QuestionType) =>
    Math.min(maxPerRound, maxQuestions - total + (counts[type] ?? 0));

  const set = async (type: QuestionType, n: number) => {
    const next = { ...counts };
    if (n > 0) next[type] = n;
    else delete next[type];
    const ack = await emit("setup:rounds", { counts: next });
    setError(ack.ok ? null : (ERRORS[ack.error ?? ""] ?? "تعذر الحفظ"));
    return ack.ok;
  };

  return (
    <div className="card rounds-picker">
      <div className="section-head" style={{ margin: 0 }}>
        <h2 style={{ margin: 0 }}>الفقرات وعدد الأسئلة</h2>
        <span className="count">
          المجموع {ar(total)} من {ar(maxQuestions)}
        </span>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        اختر فقرة واحدة على الأقل وعدد أسئلة كل فقرة (حتى {ar(maxPerRound)} للفقرة).
      </p>
      {error && <p className="small" style={{ margin: 0, color: "var(--bad)" }}>{error}</p>}
      <div className="rounds-picker-grid">
        {available.map((t) => {
          const n = counts[t.type] ?? 0;
          const max = maxFor(t.type);
          return (
            <div key={t.type} className={`round-count ${n > 0 ? "" : "off"}`} style={{ "--c": t.color } as Vars}>
              <label className="switch" title={n > 0 ? "إزالة الفقرة" : "إضافة الفقرة"}>
                <input
                  type="checkbox"
                  checked={n > 0}
                  disabled={n > 0 && on === 1}
                  onChange={(e) =>
                    set(t.type, e.target.checked ? Math.max(1, Math.min(state.perRound ?? 4, max)) : 0)
                  }
                />
                <i />
              </label>
              <RoundIcon type={t.type} size={20} />
              <b className="grow">{t.name}</b>
              {n > 0 && (
                <span className="stepper">
                  <button className="ghost" disabled={n <= 1} onClick={() => set(t.type, n - 1)}>
                    −
                  </button>
                  <input
                    key={n}
                    type="number"
                    min={1}
                    max={max}
                    defaultValue={n}
                    onBlur={(e) => {
                      const input = e.currentTarget;
                      const v = Number(input.value);
                      // A refused count goes back to the match's.
                      const reset = () => (input.value = String(n));
                      if (Number.isInteger(v) && v !== n) void set(t.type, v).then((ok) => ok || reset());
                      else reset();
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                  <button className="ghost" disabled={n >= max} onClick={() => set(t.type, n + 1)}>
                    +
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
