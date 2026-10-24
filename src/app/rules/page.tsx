"use client";

import { useEffect, useState } from "react";
import { RoundIcon } from "@/components/ui";
import { apiGet, apiSend, QUESTION_TYPES, QuestionType } from "@/lib/api";
import { MatchRules, roundRules } from "@/lib/rules";

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

/** Labels of each round's numeric rules, in display order. */
const FIELDS: Record<QuestionType, { key: string; label: string; unit: string }[]> = {
  what_do_you_know: [
    { key: "strikes", label: "عدد الأخطاء المسموحة", unit: "خطأ" },
    { key: "cleanPoints", label: "نقاط الفوز دون أي خطأ", unit: "نقطة" },
    { key: "points", label: "نقاط الفوز مع أخطاء", unit: "نقطة" },
  ],
  ayah_number: [
    { key: "seconds", label: "وقت الكتابة", unit: "ثانية" },
    { key: "points", label: "نقاط السؤال", unit: "نقطة" },
  ],
  auction: [
    { key: "bidSeconds", label: "وقت المزايدة (يتجدد مع كل مزايدة)", unit: "ثانية" },
    { key: "reciteSeconds", label: "وقت السرد", unit: "ثانية" },
    { key: "points", label: "نقاط المنافس إذا أخفق السارد", unit: "نقطة" },
  ],
  similar: [
    { key: "fastSeconds", label: "الإجابة السريعة خلال", unit: "ثانية" },
    { key: "fastPoints", label: "نقاط الإجابة السريعة", unit: "نقطة" },
    { key: "slowSeconds", label: "آخر وقت للإجابة", unit: "ثانية" },
    { key: "slowPoints", label: "نقاط الإجابة المتأخرة", unit: "نقطة" },
    { key: "strikes", label: "عدد الأخطاء المسموحة", unit: "خطأ" },
  ],
  sard: [
    { key: "seconds", label: "وقت السؤال", unit: "ثانية" },
    { key: "strikes", label: "محاولات كل متسابق", unit: "محاولة" },
    { key: "points", label: "نقاط السؤال", unit: "نقطة" },
  ],
  ayah_by_ayah: [
    { key: "seconds", label: "وقت كل دور", unit: "ثانية" },
    { key: "points", label: "نقاط المنافس إذا أخطأ صاحب الدور", unit: "نقطة" },
  ],
  right_left: [
    { key: "itemSeconds", label: "وقت كل بداية", unit: "ثانية" },
    { key: "points", label: "نقاط السؤال", unit: "نقطة" },
  ],
  buzzer: [
    { key: "seconds", label: "وقت الضغط على الجرس", unit: "ثانية" },
    { key: "points", label: "نقاط السؤال", unit: "نقطة" },
  ],
};

const ERRORS: Record<string, string> = {
  no_rounds: "يجب أن تبقى فقرة واحدة مفعّلة على الأقل",
  similar_tiers: "في المتشابهات يجب أن يكون وقت الإجابة السريعة أقل من آخر وقت",
  per_round_over_limit: "عدد الأسئلة في كل فقرة أكبر من الحد الأقصى للفقرة",
  match_over_limit: "المباراة الافتراضية (كل الفقرات المفعّلة) أكبر من الحد الأقصى لأسئلة المباراة",
  invalid_questionsPerRound: "عدد الأسئلة في كل فقرة يجب أن يكون بين ١ و١٠٠",
  invalid_maxPerRound: "الحد الأقصى للفقرة يجب أن يكون بين ١ و١٠٠",
  invalid_maxQuestions: "الحد الأقصى للمباراة يجب أن يكون بين ١ و٣٠٠",
};

/**
 * The competition rules: which rounds are played, their timers, points and
 * strikes, questions per round and the limits on what a referee may choose
 * for a match. New matches use
 * them; matches already running keep the rules they started with.
 */
export default function RulesPage() {
  const [saved, setSaved] = useState<MatchRules | null>(null);
  const [draft, setDraft] = useState<MatchRules | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiGet<MatchRules>("/admin/rules").then(
      (r) => {
        setSaved(r);
        setDraft(r);
      },
      () => setMessage({ ok: false, text: "تعذر تحميل القواعد" }),
    );
  }, []);

  if (!draft || !saved) return <p className="muted">جارٍ التحميل…</p>;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const setRound = (type: QuestionType, key: string, value: number | boolean) =>
    setDraft({ ...draft, rounds: { ...draft.rounds, [type]: { ...draft.rounds[type], [key]: value } } });

  async function save(next: MatchRules | null, path = "/admin/rules", method: "PUT" | "POST" = "PUT") {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiSend<MatchRules>(method, path, next ?? undefined);
      setSaved(r);
      setDraft(r);
      setMessage({ ok: true, text: "حُفظت القواعد، وتُطبَّق على المباريات الجديدة" });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setMessage({ ok: false, text: ERRORS[code] ?? `قيمة غير صالحة (${code})` });
    } finally {
      setBusy(false);
    }
  }

  const enabledCount = QUESTION_TYPES.filter((t) => draft.rounds[t.type].enabled).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>قواعد المسابقة</h1>
          <p>فعّل الفقرات أو أوقفها، وعدّل الأوقات والنقاط والأخطاء. تُطبَّق على المباريات الجديدة فقط.</p>
        </div>
        <div className="actions" style={{ margin: 0 }}>
          <button
            className="ghost"
            disabled={busy}
            onClick={() => confirm("إرجاع كل القواعد إلى الافتراضي؟") && save(null, "/admin/rules/reset", "POST")}
          >
            ↺ الافتراضي
          </button>
          <button className="ghost" disabled={!dirty || busy} onClick={() => setDraft(saved)}>
            تراجع
          </button>
          <button disabled={!dirty || busy} onClick={() => save(draft)}>
            {busy ? "…" : "حفظ القواعد"}
          </button>
        </div>
      </div>

      {message && (
        <div className="notice" style={{ ["--ok" as string]: message.ok ? "var(--ok)" : "var(--bad)" }}>
          {message.text}
        </div>
      )}

      <div className="card rules-general">
        <label className="rule-field">
          <span>عدد الأسئلة في كل فقرة (افتراضيًا)</span>
          <input
            type="number"
            min={1}
            max={draft.maxPerRound}
            value={draft.questionsPerRound}
            onChange={(e) => setDraft({ ...draft, questionsPerRound: Number(e.target.value) })}
          />
        </label>
        <label className="rule-field">
          <span>أقصى عدد أسئلة يختاره الحكم للفقرة الواحدة</span>
          <span className="with-unit">
            <input
              type="number"
              min={1}
              max={100}
              value={draft.maxPerRound}
              onChange={(e) => setDraft({ ...draft, maxPerRound: Number(e.target.value) })}
            />
            <small>سؤال</small>
          </span>
        </label>
        <label className="rule-field">
          <span>أقصى عدد أسئلة في المباراة كلها</span>
          <span className="with-unit">
            <input
              type="number"
              min={1}
              max={300}
              value={draft.maxQuestions}
              onChange={(e) => setDraft({ ...draft, maxQuestions: Number(e.target.value) })}
            />
            <small>سؤال</small>
          </span>
        </label>
        <p className="muted small" style={{ margin: 0 }}>
          المباراة افتراضيًا: {enabledCount} فقرات × {draft.questionsPerRound} = {enabledCount * draft.questionsPerRound} سؤالًا، ويستطيع
          الحكم عند إعداد المباراة اختيار الفقرات وعدد أسئلة كل منها ضمن الحدّين · عند تساوي النقاط في النهاية يُطرح سؤال حسم من
          الفقرة الأخيرة حتى يتقدم أحدهما
        </p>
      </div>

      <div className="rules-grid">
        {QUESTION_TYPES.map((t) => {
          const round = draft.rounds[t.type] as unknown as Record<string, number | boolean>;
          const on = round.enabled as boolean;
          return (
            <section
              key={t.type}
              className={`card rule-card ${on ? "" : "off"}`}
              style={{ "--c": t.color } as Vars}
            >
              <div className="rule-head">
                <RoundIcon type={t.type} size={26} />
                <h2>{t.name}</h2>
                <label className="switch" title={on ? "إيقاف الفقرة" : "تفعيل الفقرة"}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setRound(t.type, "enabled", e.target.checked)}
                  />
                  <i />
                </label>
              </div>
              {!on && <p className="muted small">الفقرة موقوفة: لن تظهر في المباريات الجديدة.</p>}
              {FIELDS[t.type].map((f) => (
                <label key={f.key} className="rule-field">
                  <span>{f.label}</span>
                  <span className="with-unit">
                    <input
                      type="number"
                      min={1}
                      value={round[f.key] as number}
                      disabled={!on}
                      onChange={(e) => setRound(t.type, f.key, Number(e.target.value))}
                    />
                    <small>{f.unit}</small>
                  </span>
                </label>
              ))}
              {on && (
                <ul className="rules">
                  {roundRules(t.type, draft).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
