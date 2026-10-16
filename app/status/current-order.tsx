"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { customerInfo } from "@/lib/customer-info";
import { FINAL_STATUSES } from "@/lib/order-status";

/** 현황 탭: 진행 중인 가장 최근 주문의 대기번호 화면으로 보낸다 */
export function CurrentOrder() {
  const saved = customerInfo.useValue();
  const employeeNo = saved?.employeeNo;
  const router = useRouter();
  const [noneFor, setNoneFor] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeNo) return;
    let active = true;
    fetch(`/api/orders?employeeNo=${encodeURIComponent(employeeNo)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((orders: { id: number; status: string }[]) => {
        if (!active) return;
        const current = orders.find((o) => !FINAL_STATUSES.includes(o.status));
        if (current) router.replace(`/orders/${current.id}`);
        else setNoneFor(employeeNo);
      })
      .catch(() => {
        if (active) setNoneFor(employeeNo);
      });
    return () => {
      active = false;
    };
  }, [employeeNo, router]);

  if (saved && noneFor !== employeeNo) return <p className="px-5 text-ink/50">확인 중…</p>;

  return (
    <div className="px-5 py-16 text-center text-ink/50">
      <p>진행 중인 주문이 없습니다.</p>
      <Link href="/" className="mt-4 inline-block font-medium text-brand">
        메뉴 보러 가기
      </Link>
    </div>
  );
}
