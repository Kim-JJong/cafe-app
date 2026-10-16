"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setError((await res.json()).error?.message ?? "로그인에 실패했습니다.");
        setPin("");
        return;
      }
      // 외부 주소로 보내지 않도록 직원 화면 경로만 허용
      router.replace(next?.startsWith("/staff") ? next : "/staff");
    } catch {
      setError("네트워크 오류로 로그인하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm text-gray-500">PIN</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-background px-3 py-2 text-center text-xl tracking-widest"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-foreground py-3 font-semibold text-background disabled:opacity-40"
      >
        {submitting ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
