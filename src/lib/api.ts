// Talks to almaher-server's /admin endpoints with the admin key.

export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

const KEY_STORAGE = "almaher-admin-key";

export function getAdminKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setAdminKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Private mode: the key lasts for this page only.
  }
}

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

export async function apiGet<T>(path: string, key = getAdminKey()): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    headers: { "x-admin-key": key ?? "" },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  method: "POST" | "DELETE" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method,
    headers: { "x-admin-key": getAdminKey() ?? "", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      message = (await res.json()).message ?? message;
    } catch {}
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// Shapes returned by the server.

export type Role = "player1" | "player2" | "referee";

export interface LiveMatch {
  code: string;
  mode: "same_room" | "remote";
  status: "lobby" | "playing" | "finished";
  createdAt: string;
  participants: Partial<Record<Role, { name: string; connected: boolean; offlineSince?: number }>>;
  scores: { player1: number; player2: number };
  round: null | LiveRound;
  /** False while the referee prepares the match (players can't join). */
  published?: boolean;
  perRound?: number;
  /** The rounds this match plays, and how many questions each. */
  rounds?: QuestionType[];
  roundCounts?: Partial<Record<QuestionType, number>>;
  /** The rounds the referee may choose from (the rules may turn some off). */
  availableRounds?: QuestionType[];
  /** The rules' limits on a round's questions and the match's. */
  maxPerRound?: number;
  maxQuestions?: number;
  /** The referee's chosen questions per round, while preparing. */
  setup?: Partial<Record<QuestionType, Question[]>>;
  /** The player who quit the match (the other one won it). */
  forfeitedBy?: "player1" | "player2" | null;
}

/** Questions [type] has in [match] (0 when it is not played). */
export function countFor(match: LiveMatch, type: QuestionType): number {
  const n = match.roundCounts?.[type];
  if (n !== undefined) return n;
  return !match.rounds || match.rounds.includes(type) ? (match.perRound ?? 4) : 0;
}

/** Questions in the whole match (tie-breakers aside). */
export function totalQuestions(match: LiveMatch): number {
  const types = match.rounds ?? QUESTION_TYPES.map((t) => t.type);
  return types.reduce((sum, t) => sum + countFor(match, t), 0);
}

type P = "player1" | "player2";

export interface LiveRound {
  type: QuestionType;
  index: number;
  total: number;
  roundIndex: number;
  roundTotal: number;
  indexInRound: number;
  /** Questions in the current round. */
  roundSize?: number;
  /** The match's rounds as played, in order, with their question counts. */
  segments?: { type: QuestionType; count: number }[];
  phase: "answering" | "revealed";
  secondsLeft: number;
  timeLimitSeconds: number;
  /** The referee swapped this question for an alternative. */
  replaced?: boolean;
  /** The player who gave this question up (the other one got its points). */
  forfeited?: P | null;
  /** آية بآية: the next ayahs said so far, and (referee) the one due next. */
  chain?: {
    step: number;
    length: number;
    said: string[];
    next?: { surah: number; ayah: number; surahName: string; text: string; opening: string };
  };
  question: {
    /** Hidden (null) from players during الجرس until it is decided. */
    prompt: string | null;
    promptHidden?: boolean;
    total?: number;
    answer?: string;
    refs?: (QuestionRef & { said?: boolean })[];
    meta?: Record<string, unknown>;
  };
  answers: Record<P, { submitted: boolean; value: number | null; secondsTaken?: number }>;
  awarded: P[];
  /** Who answered (or buzzed) first (referee view). */
  firstAnswered?: P | null;
  turn: P;
  /** ماذا تعرف: wrong answers per player; the last one loses the question. */
  strikes: Record<P, number>;
  /** ماذا تعرف: players who used their one pass on this question. */
  passed?: P[];
  maxStrikes: number;
  saidCount: number;
  /** المزاد: who holds the highest bid; who recites once bidding closes. */
  highBidder: P | null;
  reciter: P | null;
  buzzes: P[];
  activeBuzzer: P | null;
  /** الجرس: players who answered wrong. المتشابهات: players out of tries. */
  lockedOut: P[];
  /** المتشابهات: what a correct answer is worth right now. */
  worth?: number;
  /** Points each awarded player got. */
  points: number;
  /** An extra question because the scores were level at the end. */
  tiebreak?: boolean;
  /** يمين يسار: the runs (see the server's rightLeftSnapshot). */
  rightLeft?: {
    player: P;
    stage: "ready" | "running";
    index: number;
    perRun: number;
    done: P[];
    results: Record<P, null | { correct: boolean[]; right: number; finished: boolean }>;
    /** The opening on screen now (referee). */
    side?: "right" | "left";
    page?: number;
    surahName?: string;
    ayah?: number;
  };
}

export interface MatchResult {
  code: string;
  mode: string;
  player1Name: string;
  player2Name: string;
  refereeName: string | null;
  player1Score: number;
  player2Score: number;
  winner: "player1" | "player2" | "draw";
  finishedAt: string;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

export type QuestionType =
  | "what_do_you_know"
  | "ayah_number"
  | "auction"
  | "similar"
  | "sard"
  | "ayah_by_ayah"
  | "right_left"
  | "buzzer";

export interface QuestionRef {
  surah: number;
  ayah: number;
  surahName?: string;
  text?: string;
}

export interface Question {
  id?: string;
  type: QuestionType;
  source: "generated" | "manual";
  prompt: string;
  answer: string;
  refs: QuestionRef[];
  timeLimitSeconds: number;
  meta: Record<string, unknown>;
  createdAt?: string;
}

export const QUESTION_TYPES: {
  type: QuestionType;
  name: string;
  icon: string;
  hint: string;
  color: string;
  /** What the referee does in this round. */
  referee: string;
}[] = [
  {
    type: "what_do_you_know",
    name: "ماذا تعرف",
    icon: "/round_what_do_you_know.svg",
    hint: "سؤال قائمة: المتسابقان يذكران الإجابات بالتناوب",
    color: "var(--r-wdyk)",
    referee: "اضغط ✓ لكل إجابة صحيحة أو ✗ للخطأ، ويتبدل الدور تلقائيًا.",
  },
  {
    type: "ayah_number",
    name: "رقم الآيات",
    icon: "/round_ayah_number.svg",
    hint: "تُقرأ أول آية في صفحة، ويكتب المتسابقان سرًا عدد آيات الصفحة",
    color: "var(--r-ayah)",
    referee: "اقرأ الآية، وبعد أن يكتب المتسابقان العدد اضغط «اكشف الإجابات».",
  },
  {
    type: "auction",
    name: "المزاد",
    icon: "/round_auction.svg",
    hint: "فئة لها عدد معروف، والمتسابق يزايد على ما يستطيع ذكره",
    color: "var(--r-auction)",
    referee: "تابع المزايدة (ويمكنك إغلاقها بـ «أغلق المزايدة»)، ثم ✓ إن أكمل المتسابق ما زايد عليه أو ✗ إن أخطأ.",
  },
  {
    type: "similar",
    name: "المتشابهات",
    icon: "/round_similar.svg",
    hint: "بداية مشتركة بين سور، ويجيب أي متسابق مباشرة",
    color: "var(--r-similar)",
    referee: "عندما يجيب أحدهما اضغط ✓ أو ✗ بجانب اسمه.",
  },
  {
    type: "sard",
    name: "السرد",
    icon: "/round_sard.svg",
    hint: "أول كلمة (أو كلمات) من آية، ويقول المتسابق آخر كلمة فيها",
    color: "var(--r-sard)",
    referee: "عندما يجيب أحدهما اضغط ✓ أو ✗ بجانب اسمه.",
  },
  {
    type: "ayah_by_ayah",
    name: "آية بآية",
    icon: "/round_ayah_by_ayah.svg",
    hint: "بداية آية، ثم يقول المتسابقان بداية الآية التالية بالتناوب",
    color: "var(--r-aba)",
    referee: "ترى الآية المطلوبة: اضغط ✓ إن قال صاحب الدور بدايتها فينتقل الدور، أو ✗ فتذهب النقطة لمنافسه.",
  },
  {
    type: "right_left",
    name: "يمين يسار",
    icon: "/round_right_left.svg",
    hint: "بدايات آيات تظهر تباعًا، ويحدد المتسابق هل صفحتها يمين أم يسار",
    color: "var(--r-rl)",
    referee: "اضغط «ابدأ دور» لكل متسابق؛ الإجابات تُحتسب تلقائيًا من هاتفه.",
  },
  {
    type: "buzzer",
    name: "الجرس",
    icon: "/round_buzzer.svg",
    hint: "سؤال سريع، أول من يضغط الجرس يجيب",
    color: "var(--r-buzzer)",
    referee: "اقرأ السؤال بصوت واضح (يظهر لك وحدك)، ثم احكم بـ ✓ أو ✗ على من ضغط أولًا.",
  },
];

const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
export const ar = (n: number) =>
  String(n).replace(/\d/g, (d) => arabicDigits[Number(d)]);

/** 2.3 → "٢٫٣ ث" */
export const secs = (v: number) => `${ar(Number(v.toFixed(1))).replace(".", "٫")} ث`;
