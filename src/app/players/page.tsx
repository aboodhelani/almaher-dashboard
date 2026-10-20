"use client";

import { useEffect, useState } from "react";
import { Avatar, Chip } from "@/components/ui";
import { apiGet, LeaderboardRow } from "@/lib/api";

/** Player accounts ranked by wins (from finished matches). */
export default function PlayersPage() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiGet<LeaderboardRow[]>("/leaderboard")
      .then(setRows)
      .catch(() => setError(true));
  }, []);

  const medal = (rank: number) =>
    rank === 1 ? "var(--gold)" : rank === 2 ? "var(--navy-200)" : rank === 3 ? "var(--gold-700)" : undefined;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>اللاعبون</h1>
          <p>لوحة المتصدرين حسب الفوز ثم النقاط</p>
        </div>
      </div>
      {error ? (
        <p className="error">تعذر تحميل اللاعبين</p>
      ) : rows === null ? (
        <p className="muted">جارٍ التحميل…</p>
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏅</div>
          <p className="bold">لا توجد نتائج لاعبين بعد</p>
          <p className="muted">تظهر هنا حسابات اللاعبين بعد أول مباراة منتهية.</p>
        </div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اللاعب</th>
                <th>مباريات</th>
                <th>فوز</th>
                <th>خسارة</th>
                <th>نقاط</th>
                <th>نسبة الفوز</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td>
                    {medal(r.rank) ? (
                      <Chip color={medal(r.rank)} solid>
                        {r.rank}
                      </Chip>
                    ) : (
                      <span className="subtle">{r.rank}</span>
                    )}
                  </td>
                  <td>
                    <span className="person">
                      <Avatar role="player1" name={r.name} />
                      <span className="bold">{r.name}</span>
                    </span>
                  </td>
                  <td className="mono">{r.matches}</td>
                  <td className="mono" style={{ color: "var(--ok)" }}>{r.wins}</td>
                  <td className="mono" style={{ color: "var(--bad-text)" }}>{r.losses}</td>
                  <td className="mono bold">{r.points}</td>
                  <td>
                    <div className="progress" style={{ width: 90 }}>
                      <i style={{ width: `${r.matches ? (r.wins / r.matches) * 100 : 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
