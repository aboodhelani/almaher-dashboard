"use client";

import { useEffect, useState } from "react";
import { Avatar, Chip } from "@/components/ui";
import { apiGet, MatchResult } from "@/lib/api";

export default function HistoryPage() {
  const [rows, setRows] = useState<MatchResult[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiGet<MatchResult[]>("/admin/matches/history?limit=100")
      .then(setRows)
      .catch(() => setError(true));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>سجل المباريات</h1>
          <p>آخر ١٠٠ مباراة منتهية</p>
        </div>
      </div>
      {error ? (
        <p className="error">تعذر تحميل السجل</p>
      ) : rows === null ? (
        <p className="muted">جارٍ التحميل…</p>
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏆</div>
          <p className="bold">لا توجد مباريات منتهية بعد</p>
          <p className="muted">تظهر هنا نتيجة كل مباراة عند انتهائها.</p>
        </div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>المباراة</th>
                <th>المتسابق الأول</th>
                <th>النتيجة</th>
                <th>المتسابق الثاني</th>
                <th>الحكم</th>
                <th>الطريقة</th>
                <th>الوقت</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.code}-${r.finishedAt}`}>
                  <td className="mono bold" dir="ltr" style={{ textAlign: "end" }}>
                    #{r.code}
                  </td>
                  <td>
                    <span className={`person ${r.winner === "player2" ? "lost" : ""}`}>
                      <Avatar role="player1" name={r.player1Name} />
                      <span>
                        {r.player1Name}
                        {r.winner === "player1" && <> 🏆</>}
                      </span>
                    </span>
                  </td>
                  <td>
                    {r.winner === "draw" ? (
                      <Chip color="var(--gold)">
                        <span className="result">
                          {r.player1Score} - {r.player2Score}
                        </span>
                      </Chip>
                    ) : (
                      <span className="result">
                        {r.player1Score} - {r.player2Score}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`person ${r.winner === "player1" ? "lost" : ""}`}>
                      <Avatar role="player2" name={r.player2Name} />
                      <span>
                        {r.player2Name}
                        {r.winner === "player2" && <> 🏆</>}
                      </span>
                    </span>
                  </td>
                  <td className="muted">{r.refereeName ?? "—"}</td>
                  <td>
                    <Chip>{r.mode === "remote" ? "عن بُعد" : "في نفس المكان"}</Chip>
                  </td>
                  <td className="small subtle">{new Date(r.finishedAt).toLocaleString("ar")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
