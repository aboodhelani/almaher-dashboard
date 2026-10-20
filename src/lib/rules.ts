import { ar, QuestionType } from "./api";

/** The competition rules (see the server's src/rules/rules.types.ts). */
export interface MatchRules {
  questionsPerRound: number;
  /** Most questions a referee may give one round, and a whole match. */
  maxPerRound: number;
  maxQuestions: number;
  rounds: {
    what_do_you_know: { enabled: boolean; points: number; cleanPoints: number; strikes: number };
    ayah_number: { enabled: boolean; points: number; seconds: number };
    auction: { enabled: boolean; points: number; bidSeconds: number; reciteSeconds: number };
    similar: {
      enabled: boolean;
      strikes: number;
      fastSeconds: number;
      fastPoints: number;
      slowSeconds: number;
      slowPoints: number;
    };
    sard: { enabled: boolean; points: number; seconds: number; strikes: number };
    right_left: { enabled: boolean; points: number; itemSeconds: number };
    buzzer: { enabled: boolean; points: number; seconds: number };
  };
}

/** "٤٥ ثانية" / "دقيقة" / "دقيقتان" / "٩٠ ثانية". */
export function duration(s: number) {
  if (s === 60) return "دقيقة";
  if (s === 120) return "دقيقتين";
  return `${ar(s)} ثانية`;
}

/** "نقطة" / "نقطتان" / "٣ نقاط". */
export function points(n: number) {
  if (n === 1) return "نقطة";
  if (n === 2) return "نقطتان";
  return `${ar(n)} ${n <= 10 ? "نقاط" : "نقطة"}`;
}

/** How a round is played, with the numbers from [rules]. */
export function roundRules(type: QuestionType, rules: MatchRules): string[] {
  const r = rules.rounds;
  switch (type) {
    case "what_do_you_know":
      return [
        "سؤال له إجابات كثيرة، ويذكر المتسابقان الإجابات بالتناوب.",
        "لا يوجد وقت محدد، والحكم ينتقل إلى السؤال التالي متى شاء.",
        "لكل متسابق تجاوز واحد في السؤال: إن لم تكن لديه إجابة ينتقل الدور لمنافسه دون خطأ.",
        `لكل متسابق ${ar(r.what_do_you_know.strikes)} أخطاء في السؤال، وبآخرها يفوز منافسه: ${points(r.what_do_you_know.cleanPoints)} إن لم يخطئ أبدًا، وإلا ${points(r.what_do_you_know.points)}.`,
      ];
    case "ayah_number":
      return [
        `تُعرض أول آية في صفحة، ويكتب كل متسابق سرًا عدد آيات الصفحة خلال ${duration(r.ayah_number.seconds)}.`,
        `من أصاب العدد أخذ ${points(r.ayah_number.points)}، وإلا فالأقرب.`,
        "إن أصاب الاثنان أخذها الأسرع إجابةً، وإن كتبا العدد الخاطئ نفسه فلا نقطة لأحد.",
      ];
    case "auction":
      return [
        "فئة لها عدد معروف من الآيات يظهر للمتسابقَين، والمزايدة علنية وبالتناوب: يبدأ أحدهما (عشوائيًا في أول سؤال، ثم بالتبادل) ثم يرد الآخر.",
        `كل مزايدة يجب أن تزيد على الأخيرة وتعيد العدّاد ${duration(r.auction.bidSeconds)}، ومن زايد على العدد الكلي انتهت المزايدة له.`,
        "يمكن للمتسابق أن يقول «تفضّل» فيسرد صاحب أعلى مزايدة، وكذلك عند انتهاء الوقت.",
        `يذكر ما زايد عليه خلال ${duration(r.auction.reciteSeconds)}: إن أكمل أخذ نقطة لما دون ٢٠، ونقطتين من ٢٠، و٣ من ٣٠، وهكذا؛ وإلا أخذ منافسه ${points(r.auction.points)}.`,
      ];
    case "similar":
      return [
        "تُعرض بداية مشتركة بين عدة مواضع، ولا يوجد جرس: أي متسابق يجيب مباشرة بصوته.",
        `الإجابة الصحيحة خلال ${duration(r.similar.fastSeconds)} = ${points(r.similar.fastPoints)}، وحتى ${duration(r.similar.slowSeconds)} = ${points(r.similar.slowPoints)}، وبعدها لا يأخذ أحد شيئًا.`,
        `لكل متسابق ${ar(r.similar.strikes)} أخطاء، وبعدها لا يحق له الإجابة.`,
      ];
    case "sard":
      return [
        "تُعرض أول كلمة من آية، وإن شاركتها آيات أخرى في بدايتها تُعرض كلمتان أو أكثر حتى تتميز.",
        `يقول المتسابق آخر كلمة في الآية مباشرة بصوته، ومن أصاب أخذ ${points(r.sard.points)}.`,
        `لكل متسابق ${ar(r.sard.strikes)} محاولات، وإن انتهت ${duration(r.sard.seconds)} فلا نقطة لأحد.`,
      ];
    case "right_left":
      return [
        "لكل متسابق دوره: ٦ بدايات آيات تظهر واحدة تلو الأخرى، وكل بداية لا تشاركها آية أخرى.",
        `يحدد المتسابق خلال ${duration(r.right_left.itemSeconds)} هل الآية في الصفحة اليمنى أم اليسرى، وإن انتهى الوقت لا تُحتسب.`,
        "لا يعرف المتسابق نتيجته حتى تنتهي بداياته الست، ثم يأتي دور منافسه.",
        `صاحب الإجابات الصحيحة الأكثر يأخذ ${points(r.right_left.points)}، وعند التساوي لا نقطة لأحد.`,
      ];
    case "buzzer":
      return [
        "السؤال مخفي عن المتسابقين والجمهور، والحكم يقرؤه بصوته.",
        `أول من يضغط الجرس خلال ${duration(r.buzzer.seconds)} يجيب، والإجابة الصحيحة ${points(r.buzzer.points)}.`,
        "إن أخطأ يظهر السؤال كاملًا للجميع ويجيب منافسه، وإن أخطأ هو أيضًا فلا نقطة.",
      ];
  }
}
