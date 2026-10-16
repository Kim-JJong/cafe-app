"use client";

import Link from "next/link";
import { customerInfo } from "@/lib/customer-info";
import { STORE_LOCATION, STORE_NAME } from "@/lib/store-info";
import { MonthlyChargeCard } from "./_components/monthly-charge";

/** 이름이 세 글자 이상이면 성을 뺀 부분 (김서연 → 서연) */
function initials(name: string) {
  return name.length >= 3 ? name.slice(-2) : name;
}

export function HomeHeader() {
  const saved = customerInfo.useValue();

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-3.5 pb-3">
        <div>
          <p className="text-xs text-ink/50">
            {STORE_LOCATION} · {STORE_NAME}
          </p>
          <h1 className="mt-0.5 text-xl leading-snug font-semibold">
            {saved ? `안녕하세요, ${saved.name}님` : "어떤 음료를 드릴까요?"}
          </h1>
        </div>
        {saved && (
          <Link
            href="/me"
            aria-label="내 정보"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-chip text-[13px] font-semibold text-brand"
          >
            {initials(saved.name)}
          </Link>
        )}
      </header>
      {saved && <MonthlyChargeCard employeeNo={saved.employeeNo} />}
    </>
  );
}
