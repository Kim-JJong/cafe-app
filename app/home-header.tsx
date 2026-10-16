"use client";

import { customerInfo } from "@/lib/customer-info";
import { STORE_LOCATION, STORE_NAME } from "@/lib/store-info";

export function HomeHeader() {
  const saved = customerInfo.useValue();

  return (
    <header className="px-5 pt-3.5 pb-3">
      <p className="text-xs text-ink/50">
        {STORE_LOCATION} · {STORE_NAME}
      </p>
      <h1 className="mt-0.5 text-xl leading-snug font-semibold">
        {saved ? `안녕하세요, ${saved.name}님` : "어떤 음료를 드릴까요?"}
      </h1>
    </header>
  );
}
