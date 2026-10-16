"use client";

import Link from "next/link";
import { useState } from "react";
import type { getMenu } from "@/lib/menu";
import { formatWon } from "@/lib/price";
import { MenuPhoto } from "./_components/menu-photo";

type Category = Awaited<ReturnType<typeof getMenu>>[number];

const ALL = 0;

/** groupId가 있으면 단체 주문 방에 담는 상세 화면으로 연결한다 */
export function MenuBrowser({ categories, groupId }: { categories: Category[]; groupId?: string }) {
  const [selected, setSelected] = useState(ALL);
  const visible = selected === ALL ? categories : categories.filter((c) => c.id === selected);
  const items = visible.flatMap((c) => c.items);
  const title = selected === ALL ? "전체 메뉴" : visible[0]?.name;

  return (
    <>
      <nav className="flex gap-2 overflow-x-auto px-5 pb-3.5" aria-label="카테고리">
        {[{ id: ALL, name: "전체" }, ...categories].map((c) => {
          const active = c.id === selected;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(c.id)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] whitespace-nowrap ${
                active ? "bg-ink font-semibold text-white" : "border border-ink/10 bg-white font-medium"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </nav>

      <section className="px-5 pb-4">
        <h2 className="mb-2.5 text-sm font-semibold">{title}</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={groupId ? `/menu/${item.id}?group=${encodeURIComponent(groupId)}` : `/menu/${item.id}`}
                className={`flex h-full flex-col overflow-hidden rounded-[18px] border border-ink/[.08] bg-white ${
                  item.isAvailable ? "" : "opacity-50"
                }`}
              >
                <MenuPhoto url={item.imageUrl} className="aspect-square w-full" />
                <div className="flex flex-1 flex-col p-3">
                  <p className="text-[15px] font-semibold">{item.name}</p>
                  {(item.description || !item.isAvailable) && (
                    <p className="mt-[3px] line-clamp-2 text-xs text-ink/50">
                      {item.isAvailable ? item.description : "오늘 준비된 수량이 모두 소진되었습니다"}
                    </p>
                  )}
                  <p
                    className={`mt-auto pt-1.5 text-sm font-semibold ${item.isAvailable ? "text-brand" : "text-ink/45"}`}
                  >
                    {item.isAvailable ? formatWon(item.basePrice) : "품절"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
