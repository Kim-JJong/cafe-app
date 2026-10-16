"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { customerInfo } from "@/lib/customer-info";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import type { OrderSummary } from "@/lib/orders";
import { formatWon } from "@/lib/price";
import { formatKstDateTime } from "@/lib/time";

type OrderSummaryJson = Omit<OrderSummary, "createdAt" | "status"> & {
  createdAt: string;
  status: OrderStatus;
};

export function MyOrders() {
  const saved = customerInfo.useValue();
  const employeeNo = saved?.employeeNo;
  const [orders, setOrders] = useState<OrderSummaryJson[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!employeeNo) return;
    fetch(`/api/orders?employeeNo=${encodeURIComponent(employeeNo)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setOrders)
      .catch(() => setError(true));
  }, [employeeNo]);

  if (!saved) {
    return <p className="py-16 text-center text-gray-500">아직 이 기기에서 주문한 내역이 없습니다.</p>;
  }
  if (error) return <p className="text-red-500">주문 내역을 불러오지 못했습니다.</p>;
  if (!orders) return <p className="text-gray-500">불러오는 중…</p>;
  if (orders.length === 0) return <p className="py-16 text-center text-gray-500">주문 내역이 없습니다.</p>;

  return (
    <>
      <p className="mb-2 text-sm text-gray-500">
        {saved.name} ({saved.employeeNo}) · 최근 20건
      </p>
      <ul className="divide-y divide-gray-500/30">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">주문번호 {o.orderNumber}</p>
                <p className="text-sm text-gray-500">{formatKstDateTime(o.createdAt)}</p>
              </div>
              <div className="text-right">
                <p>{formatWon(o.totalPrice)}</p>
                <p className="text-sm text-gray-500">{STATUS_LABEL[o.status]}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
