"use client";

import { useState } from "react";
import { apiSend } from "@/lib/api";
import { Icon } from "./ui";

/** Opens a match from the dashboard, under a chosen ID or a random code. */
export default function CreateMatchForm({ onCreated }: { onCreated: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"same_room" | "remote">("same_room");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiSend<{ code: string }>("POST", "/admin/matches", {
        mode,
        code: code.trim() || undefined,
      });
      setCode("");
      onCreated(res.code);
    } catch (err) {
      const m = (err as Error).message;
      setError(
        m === "code_taken"
          ? "هذا الرقم مستخدم لمباراة جارية"
          : m === "invalid_code"
            ? "رقم المباراة من ٣ إلى ٢٠ حرفًا أو رقمًا بلا مسافات"
            : `تعذر إنشاء المباراة: ${m}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card create" onSubmit={submit}>
      <span className="title">
        <Icon name="plus" />
        مباراة جديدة
      </span>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="رقم المباراة (اختياري)، مثل final-2026"
        maxLength={20}
        dir="ltr"
      />
      <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
        <option value="same_room">في نفس المكان</option>
        <option value="remote">عن بُعد</option>
      </select>
      <button type="submit" disabled={busy}>
        {busy ? "…" : "إنشاء"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
