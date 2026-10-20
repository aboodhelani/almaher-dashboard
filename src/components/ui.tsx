"use client";

import type { CSSProperties, ReactNode } from "react";
import { LiveRound, QUESTION_TYPES, QuestionType, Role } from "@/lib/api";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** CSS variables for a seat's colours (--a start, --b end). */
export function seatVars(role: Role): Vars {
  return {
    player1: { "--a": "var(--p1)", "--b": "var(--p1-end)" },
    player2: { "--a": "var(--p2)", "--b": "var(--p2-end)" },
    referee: { "--a": "var(--ref)", "--b": "var(--ref-end)" },
  }[role] as Vars;
}

export const roundInfo = (type: QuestionType) => QUESTION_TYPES.find((t) => t.type === type)!;

/** A round's single-colour icon, painted in [color]. */
export function RoundIcon({ type, size = 24, color }: { type: QuestionType; size?: number; color?: string }) {
  const info = roundInfo(type);
  return (
    <i
      className="ricon"
      style={{ "--src": `url(${info.icon})`, "--s": `${size}px`, "--c": color ?? info.color } as Vars}
    />
  );
}

/** The round icon on a filled square in its colour. */
export function RoundBadge({ type }: { type: QuestionType }) {
  return (
    <span className="ricon-box" style={{ "--c": roundInfo(type).color } as Vars}>
      <RoundIcon type={type} color="#fff" />
    </span>
  );
}

/** A seat's initial in its gradient circle, with an online dot. */
export function Avatar({
  role,
  name,
  online,
  size = 44,
}: {
  role: Role;
  name?: string | null;
  online?: boolean;
  size?: number;
}) {
  const initial = name?.trim() ? [...name.trim()][0] : "؟";
  return (
    <span
      className={`avatar ${name ? "" : "empty-seat"}`}
      style={{ ...seatVars(role), "--size": `${size}px` } as Vars}
    >
      {initial}
      {name && online !== undefined && <i className={`online ${online ? "" : "off"}`} />}
    </span>
  );
}

export function Chip({
  children,
  color,
  solid,
}: {
  children: ReactNode;
  color?: string;
  solid?: boolean;
}) {
  return (
    <span className={`chip ${solid ? "solid" : ""}`} style={{ "--c": color ?? "#fff" } as Vars}>
      {children}
    </span>
  );
}

/** Seconds left as a ring that empties over [total]; red for the last five. */
export function Ring({ left, total, color }: { left: number; total: number; color: string }) {
  const urgent = left <= 5;
  return (
    <span
      className={`ring ${urgent ? "urgent" : ""}`}
      style={{ "--p": total ? left / total : 0, ...(urgent ? {} : { "--c": color }) } as Vars}
    >
      <span>{left}</span>
    </span>
  );
}

/**
 * Every question of the match as a tick, grouped by round in its colour;
 * each round's width follows its number of questions.
 */
export function Track({ round }: { round: LiveRound }) {
  const segments = round.segments?.length
    ? round.segments
    : [{ type: round.type, count: round.total }];
  let start = 0;
  return (
    <div className="track">
      {segments.map((s, r) => {
        const first = start;
        start += s.count;
        return (
          <div key={r} className="group" style={{ "--tc": roundInfo(s.type).color, flex: s.count } as Vars}>
            {Array.from({ length: s.count }, (_, i) => {
              const q = first + i;
              return <i key={i} className={q < round.index ? "done" : q === round.index ? "now" : ""} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Small line icons (24px grid, current colour). */
export function Icon({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

const ICONS = {
  rules: (
    <>
      <path d="M4 6h10M4 12h16M4 18h7" />
      <circle cx="17" cy="6" r="2" />
      <circle cx="14" cy="18" r="2" />
    </>
  ),
  live: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  bank: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5M8 7h6M8 11h6" />
    </>
  ),
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />,
  gavel: (
    <>
      <path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10" />
      <path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  check: <path d="m5 12 5 5L20 7" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  next: <path d="M15 18l-6-6 6-6" />,
  play: <path d="M7 4v16l13-8z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
    </>
  ),
  sparkles: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
};
