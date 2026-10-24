"use client";

import { useState } from "react";
import { apiSend, QuestionType } from "@/lib/api";

/** "2:255, 3:18 4:1" → refs. Returns null if any part is malformed. */
function parseRefs(text: string) {
  const parts = text.split(/[\s,،]+/).filter(Boolean);
  const refs = [];
  for (const p of parts) {
    const m = p.match(/^(\d{1,3})[:：](\d{1,3})$/);
    if (!m) return null;
    refs.push({ surah: Number(m[1]), ayah: Number(m[2]) });
  }
  return refs;
}

export type QuestionBody = {
  type: QuestionType;
  prompt: string;
  answer: string;
  refs: { surah: number; ayah: number }[];
  page?: number;
};

/**
 * Add a question by hand; fields depend on the round. Saved to the bank, or,
 * with [onSubmit], handed over instead (a match's own question).
 */
export default function AddQuestionForm({
  type,
  onSaved,
  onSubmit,
}: {
  type: QuestionType;
  onSaved: () => void | Promise<void>;
  onSubmit?: (body: QuestionBody) => Promise<boolean>;
}) {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [refsText, setRefsText] = useState("");
  const [page, setPage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // السرد and آية بآية are built from one ayah.
  const oneAyah = type === "sard" || type === "ayah_by_ayah";
  const needsPrompt = type !== "ayah_number" && !oneAyah && type !== "right_left";
  const needsAnswer = type === "similar" || type === "buzzer";
  const needsRefs =
    type === "what_do_you_know" || type === "auction" || type === "similar" || oneAyah || type === "right_left";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let refs: { surah: number; ayah: number }[] = [];
    if (needsRefs) {
      const parsed = parseRefs(refsText);
      if (!parsed) return setError("اكتب الآيات بصيغة سورة:آية، مثل 2:255, 3:18");
      if (oneAyah && parsed.length !== 1) return setError("اكتب آية واحدة، مثل 2:255");
      if (type === "right_left" && (parsed.length < 2 || parsed.length % 2 !== 0)) {
        return setError("اكتب عددًا زوجيًا من الآيات (١٢ عادةً): النصف الأول لمتسابق والثاني لمنافسه");
      }
      refs = parsed;
    }
    const body: QuestionBody = {
      type,
      prompt,
      answer,
      refs,
      page: type === "ayah_number" ? Number(page) : undefined,
    };
    setBusy(true);
    try {
      if (onSubmit) {
        if (!(await onSubmit(body))) return;
      } else {
        await apiSend("POST", "/admin/questions", body);
      }
      await onSaved();
    } catch (err) {
      setError(`تعذر الحفظ: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      {type === "ayah_number" && (
        <label className="narrow">
          رقم الصفحة (١–٦٠٤)
          <input type="number" min={1} max={604} value={page} onChange={(e) => setPage(e.target.value)} required />
        </label>
      )}
      {needsPrompt && (
        <label>
          نص السؤال
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={2}
            placeholder={
              type === "auction"
                ? "كم آية تستطيع أن تذكر تبدأ بـ «فإذا»؟"
                : type === "similar"
                  ? "متشابهة في أول ٤ كلمات بين سور: يوسف، النحل، الأنبياء. ما هي؟"
                  : type === "buzzer"
                    ? "ما السورة التي تنتهي بـ «إن الله بكل شيء عليم»؟"
                    : "اذكر آيات تبدأ بـ «والذين آمنوا»"
            }
          />
        </label>
      )}
      {needsAnswer && (
        <label>
          الإجابة
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} required />
        </label>
      )}
      {needsRefs && (
        <label>
          {type === "similar"
            ? "مواضع التشابه"
            : oneAyah
              ? "الآية"
              : type === "right_left"
                ? "الآيات (١٢: ست لكل متسابق)"
                : "الإجابات (الآيات)"}{" "}
          <span className="muted small">بصيغة سورة:آية مفصولة بفواصل</span>
          <textarea
            value={refsText}
            onChange={(e) => setRefsText(e.target.value)}
            required
            rows={2}
            dir="ltr"
            placeholder="12:109, 16:43, 21:7"
          />
        </label>
      )}
      {type === "auction" && <p className="muted small">العدد الكلي يُحسب تلقائيًا من عدد الآيات.</p>}
      {type === "sard" && (
        <p className="muted small">تُعرض أول كلمة (أو أكثر إن تشابهت بدايتها مع آيات أخرى)، والإجابة آخر كلمة في الآية، يُملآن تلقائيًا.</p>
      )}
      {type === "ayah_by_ayah" && (
        <p className="muted small">تُعرض أول كلمة (أو أكثر إن تشابهت بدايتها مع آيات أخرى)، والآيات التالية حتى آخر السورة تُملأ تلقائيًا.</p>
      )}
      {type === "ayah_number" && <p className="muted small">تُعرض أول آية في الصفحة، والإجابة عدد آياتها، يُملآن تلقائيًا.</p>}
      {error && <p className="error">{error}</p>}
      <div>
        <button type="submit" disabled={busy}>
          {busy ? "…" : onSubmit ? "إضافة" : "حفظ السؤال"}
        </button>
      </div>
    </form>
  );
}
