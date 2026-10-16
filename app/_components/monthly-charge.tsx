"use client";

import { useEffect, useState } from "react";
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

/** 이번 달 급여 공제 예정 카드 (디자인 1a의 갈색 카드). 내정보 화면에서만 보여 준다 */
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
