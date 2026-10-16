"use client";

import { useCallback, useEffect, useState } from "react";
import { ACTIVE_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import type { StaffOrder } from "@/lib/staff-orders";
import { formatKstDateTime } from "@/lib/time";
import { useStaffApi, type StaffApi } from "./staff-fetch";

const POLL_MS = 3000;

type OrderJson = Omit<StaffOrder, "createdAt" | "status"> & {
  createdAt: string;
  status: OrderStatus;
};

/** 칸반 카드의 버튼: 다음 단계로 보내는 주 버튼 + (접수 단계만) 취소 */
const NEXT_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  RECEIVED: { to: "PREPARING", label: "제조 시작" },
  PREPARING: { to: "READY", label: "제조 완료" },
  READY: { to: "PICKED_UP", label: "픽업 완료" },
};

async function fetchOrders({ staffFetch }: StaffApi): Promise<OrderJson[] | null> {
  try {
    const res = await staffFetch("/api/staff/orders");
    return res.ok ? await res.json() : null;
  } catch {
    return null; // 일시적인 네트워크 오류는 다음 폴링에서 다시 시도
  }
}

export function OrderBoard() {
  const api = useStaffApi();
  const [orders, setOrders] = useState<OrderJson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const apply = useCallback((result: OrderJson[] | null) => {
    if (result) setOrders(result);
  }, []);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchOrders(api).then((result) => {
        if (active) apply(result);
      });
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [api, apply]);

  async function changeStatus(order: OrderJson, to: OrderStatus) {
    if (to === "CANCELED" && !confirm(`${order.orderNumber}번 주문을 취소할까요?`)) return;
    setBusyId(order.id);
    setError(null);
    try {
      const res = await api.patchJson(`/api/staff/orders/${order.id}`, { status: to });
      if (!res.ok) setError((await res.json()).error?.message ?? "상태를 바꾸지 못했습니다.");
      apply(await fetchOrders(api));
    } catch {
      setError("네트워크 오류로 상태를 바꾸지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (!orders) return <p className="py-10 text-gray-500">불러오는 중…</p>;

  return (
    <>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {ACTIVE_STATUSES.map((status) => {
          const column = orders.filter((o) => o.status === status);
          return (
            <section key={status} aria-label={STATUS_LABEL[status]} className="rounded-xl bg-gray-500/10 p-3">
              <h2 className="mb-3 font-semibold">
                {STATUS_LABEL[status]} <span className="text-gray-500">{column.length}</span>
              </h2>
              <ul className="space-y-3">
                {column.map((order) => {
                  const next = NEXT_ACTION[order.status];
                  const busy = busyId === order.id;
                  return (
                    <li key={order.id} className="rounded-lg border border-gray-500/30 bg-background p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold">{order.orderNumber}</span>
                        <span className="text-sm text-gray-500">
                          {order.customerNameSnapshot} · {formatKstDateTime(order.createdAt)}
                        </span>
                      </div>
                      <ul className="mt-2 text-sm">
                        {order.items.map((item) => (
                          <li key={item.id}>
                            <span className="font-medium">
                              {item.nameSnapshot} × {item.quantity}
                            </span>
                            {item.options.length > 0 && (
                              <span className="text-gray-500">
                                {" "}
                                ({item.options.map((o) => o.nameSnapshot.split(": ")[1]).join(", ")})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex gap-2">
                        {next && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeStatus(order, next.to)}
                            className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white disabled:opacity-40"
                          >
                            {next.label}
                          </button>
                        )}
                        {order.status === "RECEIVED" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeStatus(order, "CANCELED")}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40"
                          >
                            취소
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
