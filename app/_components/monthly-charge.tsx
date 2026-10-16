"use client";

import { useEffect, useState } from "react";
import { formatWon } from "@/lib/price";
import { monthLabel } from "@/lib/time";

type Charge = { month: string; total: number; orderCount: number };

/** 이번 달 급여 공제 예정액 (픽업 완료 주문 합계). 사번이 없으면 null */
export function useMonthlyCharge(employeeNo: string | undefined) {
  const [charge, setCharge] = useState<{ employeeNo: string; data: Charge } | null>(null);

  useEffect(() => {
    if (!employeeNo) return;
    let active = true;
    fetch(`/api/orders/summary?employeeNo=${encodeURIComponent(employeeNo)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Charge | null) => {
        if (active && data) setCharge({ employeeNo, data });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [employeeNo]);

  return charge && charge.employeeNo === employeeNo ? charge.data : null;
}

/** 메뉴 홈의 갈색 카드 (디자인 1a) */
export function MonthlyChargeCard({ employeeNo }: { employeeNo: string }) {
  const charge = useMonthlyCharge(employeeNo);
  return (
    <section className="mx-5 mb-4 flex flex-col gap-3 rounded-[18px] bg-brand px-[18px] py-4 text-white">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium opacity-85">이번 달 급여 공제 예정</span>
        {charge && (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
            {monthLabel(charge.month)}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] font-bold tracking-[-.5px]">
          {charge ? charge.total.toLocaleString("ko-KR") : "–"}
        </span>
        <span className="text-[13px] font-medium opacity-80">
          원{charge && ` · 픽업 완료 ${charge.orderCount}건`}
        </span>
      </div>
    </section>
  );
}

/** 주문 내역 상단의 회색 카드 (디자인 1f) */
export function MonthlyChargeSummary({ employeeNo }: { employeeNo: string }) {
  const charge = useMonthlyCharge(employeeNo);
  return (
    <section className="mx-5 mb-4 flex items-center justify-between rounded-[18px] bg-surface px-[18px] py-4">
      <div>
        <p className="text-xs font-medium text-ink/55">
          {charge ? monthLabel(charge.month) : "이번 달"} 공제 예정액
        </p>
        <p className="mt-0.5 text-[22px] font-bold">{charge ? formatWon(charge.total) : "–"}</p>
      </div>
      <p className="text-right text-[11.5px] leading-relaxed text-ink/50">
        픽업 완료 {charge?.orderCount ?? 0}건
        <br />
        월 정산 후 급여 공제
      </p>
    </section>
  );
}
