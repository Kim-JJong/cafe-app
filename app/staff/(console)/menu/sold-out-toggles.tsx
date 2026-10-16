"use client";

import { useCallback, useEffect, useState } from "react";
import { useStaffApi } from "../staff-fetch";

type MenuJson = { id: number; name: string; items: { id: number; name: string; isAvailable: boolean }[] }[];

async function fetchMenu(): Promise<MenuJson | null> {
  try {
    const res = await fetch("/api/menu", { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function SoldOutToggles() {
  const { patchJson } = useStaffApi();
  const [menu, setMenu] = useState<MenuJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const apply = useCallback((result: MenuJson | null) => {
    if (result) setMenu(result);
    else setError("메뉴를 불러오지 못했습니다.");
  }, []);

  useEffect(() => {
    let active = true;
    fetchMenu().then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  async function toggle(id: number, isAvailable: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await patchJson(`/api/staff/menu/${id}`, { isAvailable });
      if (!res.ok) setError((await res.json()).error?.message ?? "변경하지 못했습니다.");
      apply(await fetchMenu());
    } catch {
      setError("네트워크 오류로 변경하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (!menu) return <p className="py-10 text-gray-500">{error ?? "불러오는 중…"}</p>;

  return (
    <div className="mx-auto max-w-xl">
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </p>
      )}
      {menu.map((category) => (
        <section key={category.id} className="mt-6">
          <h2 className="mb-2 font-semibold">{category.name}</h2>
          <ul className="divide-y divide-gray-500/30">
            {category.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-3">
                <span className={item.isAvailable ? "" : "text-gray-500 line-through"}>{item.name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.isAvailable}
                  aria-label={`${item.name} 판매`}
                  disabled={busyId === item.id}
                  onClick={() => toggle(item.id, !item.isAvailable)}
                  className={`w-20 rounded-full py-1.5 text-sm font-semibold disabled:opacity-40 ${
                    item.isAvailable ? "bg-foreground text-background" : "border border-gray-300 text-gray-500"
                  }`}
                >
                  {item.isAvailable ? "판매중" : "품절"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
