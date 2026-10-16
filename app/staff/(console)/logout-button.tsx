"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/staff/logout", { method: "POST" });
    router.replace("/staff/login");
  }

  return (
    <button type="button" onClick={logout} className="text-sm text-gray-500">
      로그아웃
    </button>
  );
}
