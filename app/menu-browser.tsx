"use client";

import Link from "next/link";
import { useState } from "react";
import type { getMenu } from "@/lib/menu";
import { formatWon } from "@/lib/price";
import { MenuPhoto } from "./_components/menu-photo";

type Category = Awaited<ReturnType<typeof getMenu>>[number];

const ALL = 0;

export function MenuBrowser({ categories }: { categories: Category[] }) {
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

      <section className="flex flex-col gap-2.5 px-5 pb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/menu/${item.id}`}
            className={`flex items-center gap-3 rounded-[18px] border border-ink/[.08] bg-white p-3.5 ${
              item.isAvailable ? "" : "opacity-50"
            }`}
          >
            <MenuPhoto url={item.imageUrl} className="h-[68px] w-[68px] rounded-[14px]" />
            <div className="flex-1">
              <p className="text-[15px] font-semibold">{item.name}</p>
              {(item.description || !item.isAvailable) && (
                <p className="mt-[3px] text-xs text-ink/50">
                  {item.isAvailable ? item.description : "오늘 준비된 수량이 모두 소진되었습니다"}
                </p>
              )}
              <p className={`mt-1.5 text-sm font-semibold ${item.isAvailable ? "text-brand" : "text-ink/45"}`}>
                {item.isAvailable ? formatWon(item.basePrice) : "품절"}
              </p>
            </div>
            {item.isAvailable && (
              <span
                aria-hidden
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-brand pb-0.5 text-xl text-white"
              >
                +
              </span>
            )}
          </Link>
        ))}
      </section>
    </>
  );
}
