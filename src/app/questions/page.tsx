"use client";

import { useCallback, useEffect, useState } from "react";
import QuestionCard from "@/components/QuestionCard";
import AddQuestionForm from "@/components/AddQuestionForm";
import { apiGet, apiSend, ar, Question, QUESTION_TYPES, QuestionType } from "@/lib/api";
import { Icon, RoundBadge, RoundIcon } from "@/components/ui";
import { MatchRules, roundRules } from "@/lib/rules";

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

/** The question bank: per round, generate questions, add your own, manage saved ones. */
export default function QuestionsPage() {
  const [type, setType] = useState<QuestionType>("what_do_you_know");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Question[] | null>(null);
  const [generated, setGenerated] = useState<Question[]>([]);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<MatchRules | null>(null);
  const info = QUESTION_TYPES.find((t) => t.type === type)!;

  const refresh = useCallback(async () => {
    try {
      const [list, c] = await Promise.all([
        apiGet<Question[]>(`/admin/questions?type=${type}`),
        apiGet<Record<string, number>>("/admin/questions/counts"),
      ]);
      setSaved(list);
      setCounts(c);
    } catch {
      setError("تعذر تحميل الأسئلة");
    }
  }, [type]);

  useEffect(() => {
    apiGet<MatchRules>("/admin/rules").then(setRules, () => {});
  }, []);

  useEffect(() => {
    setSaved(null);
    setGenerated([]);
    setAdding(false);
    setError(null);
    void refresh();
  }, [refresh]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      setGenerated(await apiSend<Question[]>("POST", "/admin/questions/generate", { type, count: 5 }));
    } catch {
      setError("تعذر توليد الأسئلة");
    } finally {
      setGenerating(false);
    }
  }

  async function save(q: Question) {
    await apiSend("POST", "/admin/questions", q);
    setGenerated((g) => g.filter((x) => x !== q));
    await refresh();
  }

  async function saveAll() {
    for (const q of generated) await apiSend("POST", "/admin/questions", q);
    setGenerated([]);
    await refresh();
  }

  async function remove(q: Question) {
    if (!q.id || !confirm("حذف هذا السؤال؟")) return;
    await apiSend("DELETE", `/admin/questions/${q.id}`);
    await refresh();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>بنك الأسئلة</h1>
          <p>ولّد أسئلة لكل فقرة، أو أضف أسئلتك. المباريات تستخدم المحفوظ أولًا.</p>
        </div>
      </div>

      <div className="tabs">
        {QUESTION_TYPES.map((t) => (
          <button
            key={t.type}
            className={`tab ${t.type === type ? "active" : ""}`}
            style={{ "--c": t.color } as Vars}
            onClick={() => setType(t.type)}
          >
            <RoundIcon type={t.type} size={20} />
            {t.name}
            <span className="count">{ar(counts[t.type] ?? 0)}</span>
          </button>
        ))}
      </div>

      <div className="card bank-intro" style={{ "--c": info.color } as Vars}>
        <RoundBadge type={type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{info.name}</b>
          <ul className="rules">
            {(rules ? roundRules(type, rules) : []).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="small muted">
            <b>دور الحكم:</b> {info.referee}
          </div>
        </div>
        <button onClick={generate} disabled={generating}>
          <Icon name="sparkles" />
          {generating ? "جارٍ التوليد…" : "توليد ٥ أسئلة"}
        </button>
        <button className="ghost" onClick={() => setAdding((a) => !a)}>
          <Icon name={adding ? "close" : "plus"} />
          {adding ? "إلغاء" : "إضافة سؤال"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {adding && (
        <AddQuestionForm
          type={type}
          onSaved={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      )}

      {generated.length > 0 && (
        <section>
          <div className="section-head">
            <h2>أسئلة مولّدة (غير محفوظة)</h2>
            <button onClick={saveAll}>حفظ الكل</button>
          </div>
          <div className="grid">
            {generated.map((q, i) => (
              <QuestionCard key={i} question={q} action={{ label: "حفظ", onClick: () => save(q) }} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>الأسئلة المحفوظة — {info.name}</h2>
        </div>
        {saved === null ? (
          <p className="muted">جارٍ التحميل…</p>
        ) : saved.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📚</div>
            <p className="bold">لا توجد أسئلة محفوظة لهذه الفقرة بعد.</p>
            <p className="muted">ولّد أسئلة واحفظ ما يناسبك، أو أضف سؤالًا بنفسك.</p>
          </div>
        ) : (
          <div className="grid">
            {saved.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                action={{ label: "حذف", onClick: () => remove(q), danger: true }}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
