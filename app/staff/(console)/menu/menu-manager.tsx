"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatWon } from "@/lib/price";
import { useStaffApi, type StaffApi } from "../staff-fetch";
import { Switch } from "../switch";

type MenuJson = {
  id: number;
  name: string;
  items: { id: number; name: string; basePrice: number; isAvailable: boolean; isHidden: boolean }[];
}[];

async function fetchMenu({ staffFetch }: StaffApi): Promise<MenuJson | null> {
  try {
    const res = await staffFetch("/api/staff/menu");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** 메뉴 관리: 판매(품절) 스위치, 수정, 신메뉴 등록 */
export function MenuManager() {
  const api = useStaffApi();
  const [menu, setMenu] = useState<MenuJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const apply = useCallback((result: MenuJson | null) => {
    if (result) setMenu(result);
    else setError("메뉴를 불러오지 못했습니다.");
  }, []);

  useEffect(() => {
    let active = true;
    fetchMenu(api).then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [api, apply]);

  async function setAvailable(id: number, isAvailable: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await api.patchJson(`/api/staff/menu/${id}`, { isAvailable });
      if (!res.ok) setError((await res.json()).error?.message ?? "변경하지 못했습니다.");
      apply(await fetchMenu(api));
    } catch {
      setError("네트워크 오류로 변경하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">메뉴 관리</h1>
          <p className="mt-0.5 text-sm text-ink/50">판매를 끄면 손님 화면에 &lsquo;품절&rsquo;로 보입니다.</p>
        </div>
        <Link href="/staff/menu/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
          ＋ 새 메뉴
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {!menu && !error && <p className="py-10 text-ink/50">불러오는 중…</p>}

      {menu?.map((category) => (
        <section key={category.id} className="mt-6">
          <h2 className="mb-2 font-semibold">{category.name}</h2>
          {category.items.length === 0 ? (
            <p className="text-sm text-ink/40">메뉴 없음</p>
          ) : (
            <ul className="divide-y divide-ink/[.08] rounded-xl border border-ink/[.08]">
              {category.items.map((item) => (
                <li key={item.id} className={`flex items-center gap-3 px-4 py-3 ${item.isHidden ? "bg-surface" : ""}`}>
                  <div className={`flex-1 ${item.isHidden ? "opacity-50" : ""}`}>
                    <p className="font-medium">
                      {item.name}
                      {item.isHidden && (
                        <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium">숨김</span>
                      )}
                    </p>
                    <p className="text-sm text-ink/50">{formatWon(item.basePrice)}</p>
                  </div>
                  <span className={`w-12 text-right text-sm ${item.isAvailable ? "text-brand" : "text-ink/40"}`}>
                    {item.isAvailable ? "판매중" : "품절"}
                  </span>
                  <Switch
                    checked={item.isAvailable}
                    onChange={(on) => setAvailable(item.id, on)}
                    label={`${item.name} 판매`}
                    disabled={busyId === item.id}
                  />
                  <Link
                    href={`/staff/menu/${item.id}`}
                    className="rounded-lg border border-ink/12 px-3 py-1.5 text-sm"
                  >
                    수정
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
