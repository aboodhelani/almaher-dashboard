"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiGet, getAdminKey, setAdminKey, SERVER_URL } from "@/lib/api";
import { Icon } from "./ui";

const NAV = [
  { href: "/", label: "المباريات المباشرة", icon: "live" },
  { href: "/history", label: "سجل المباريات", icon: "history" },
  { href: "/questions", label: "بنك الأسئلة", icon: "bank" },
  { href: "/rules", label: "قواعد المسابقة", icon: "rules" },
  { href: "/players", label: "اللاعبون", icon: "users" },
] as const;

/** Asks for the admin key once, then shows the sidebar and the page. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setAuthed(!!getAdminKey());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    const check = () =>
      apiGet("/admin/ping")
        .then(() => setOnline(true))
        .catch(() => setOnline(false));
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, [authed]);

  if (!ready) return null;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  // The big screen is full screen: no sidebar.
  if (pathname.startsWith("/display")) return <>{children}</>;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <img src="/logo.svg" alt="" />
          </span>
          <div>
            <b>الماهر</b>
            <span>لوحة التحكم</span>
          </div>
        </div>
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={`nav-link ${active ? "active" : ""}`}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          );
        })}
        <div className="sidebar-foot">
          <div className="server-state" title={SERVER_URL}>
            <i className={`live-dot ${online ? "" : "off"}`} />
            <span>{online ? "الخادم متصل" : "الخادم لا يستجيب"}</span>
          </div>
          <button
            className="ghost"
            onClick={() => {
              setAdminKey(null);
              setAuthed(false);
            }}
          >
            <Icon name="logout" />
            <span>خروج</span>
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiGet("/admin/ping", key);
      setAdminKey(key);
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "مفتاح الإدارة غير صحيح"
          : `تعذر الاتصال بالخادم (${SERVER_URL})`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit} className="card">
        <span className="brand-mark">
          <img src="/logo.svg" alt="" />
        </span>
        <h1>لوحة تحكم الماهر</h1>
        <p className="muted" style={{ margin: 0 }}>
          تابع المباريات مباشرة، وأدر بنك الأسئلة، وكن حكمًا من هنا.
        </p>
        <label htmlFor="key">مفتاح الإدارة</label>
        <input
          id="key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="big" disabled={!key || busy}>
          {busy ? "…" : "دخول"}
        </button>
      </form>
    </div>
  );
}
