"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { customerInfo } from "@/lib/customer-info";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import type { OrderSummary } from "@/lib/orders";
import { formatWon } from "@/lib/price";
import { formatKstTime, kstDateLabel } from "@/lib/time";
import { MonthlyChargeSummary } from "../_components/monthly-charge";

type OrderSummaryJson = Omit<OrderSummary, "createdAt" | "status"> & {
  createdAt: string;
  status: OrderStatus;
};

/** "바닐라 라떼 외 1잔" (디자인 1f) */
function orderTitle(items: OrderSummaryJson["items"]) {
  const [first] = items;
  if (!first) return "";
  const rest = items.reduce((sum, i) => sum + i.quantity, 0) - first.quantity;
  if (rest > 0) return `${first.nameSnapshot} 외 ${rest}잔`;
  return first.quantity > 1 ? `${first.nameSnapshot} ${first.quantity}잔` : first.nameSnapshot;
}

export function MyOrders() {
  const saved = customerInfo.useValue();
  const employeeNo = saved?.employeeNo;
  const [orders, setOrders] = useState<{ employeeNo: string; list: OrderSummaryJson[] } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!employeeNo) return;
    let active = true;
    fetch(`/api/orders?employeeNo=${encodeURIComponent(employeeNo)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((list: OrderSummaryJson[]) => {
        if (active) setOrders({ employeeNo, list });
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [employeeNo]);

  if (!saved) {
    return <p className="px-5 py-16 text-center text-ink/50">아직 이 기기에서 주문한 내역이 없습니다.</p>;
  }

  const list = orders && orders.employeeNo === employeeNo ? orders.list : null;

  return (
    <>
      <MonthlyChargeSummary employeeNo={saved.employeeNo} />
      <div className="flex flex-col gap-2 px-5 pb-4">
        {error && <p className="text-sm text-red-600">주문 내역을 불러오지 못했습니다.</p>}
        {!list && !error && <p className="text-ink/50">불러오는 중…</p>}
        {list?.length === 0 && <p className="py-10 text-center text-ink/50">주문 내역이 없습니다.</p>}
        {list?.map((o, i) => {
          const day = kstDateLabel(o.createdAt);
          const canceled = o.status === "CANCELED";
          return (
            <Fragment key={o.id}>
              {(i === 0 || kstDateLabel(list[i - 1].createdAt) !== day) && (
                <h2 className={`pl-0.5 text-[12.5px] font-semibold text-ink/45 ${i === 0 ? "" : "pt-1.5"}`}>{day}</h2>
              )}
              <Link
                href={`/orders/${o.id}`}
                className={`flex items-start justify-between rounded-2xl border border-ink/[.08] bg-white px-[15px] py-3.5 ${
                  canceled ? "opacity-60" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{orderTitle(o.items)}</p>
                  <p className="mt-1 text-[11.5px] text-ink/50">
                    {formatKstTime(o.createdAt)} · {STATUS_LABEL[o.status]} · {o.orderNumber}번
                  </p>
                </div>
                <span className={`text-[13.5px] font-semibold ${canceled ? "text-ink/45 line-through" : ""}`}>
                  {formatWon(o.totalPrice)}
                </span>
              </Link>
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
