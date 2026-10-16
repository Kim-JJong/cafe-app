"use client";

import Link from "next/link";
import { customerInfo } from "@/lib/customer-info";
import { STORE_LOCATION, STORE_NAME } from "@/lib/store-info";

export function HomeHeader() {
  const saved = customerInfo.useValue();

  return (
    <>
      <header className="px-5 pt-3.5 pb-3">
        <p className="text-xs text-ink/50">
          {STORE_LOCATION} · {STORE_NAME}
        </p>
        <h1 className="mt-0.5 text-xl leading-snug font-semibold">
          {saved ? `안녕하세요, ${saved.name}님` : "어떤 음료를 드릴까요?"}
        </h1>
      </header>
      <Link
        href="/group/new"
        className="mx-5 mb-4 flex items-center justify-between rounded-[18px] border border-brand/30 bg-brand-soft px-4 py-3.5"
      >
        <div>
          <p className="text-sm font-semibold text-brand">팀원 커피 쏘기</p>
          <p className="mt-0.5 text-xs text-ink/55">링크를 보내면 각자 음료를 담고, 한 번에 주문해요</p>
        </div>
        <span aria-hidden className="text-lg text-brand">
          ›
        </span>
      </Link>
    </>
  );
}
