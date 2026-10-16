"use client";

import { use, useCallback, useEffect, useState } from "react";
import { customerInfo } from "@/lib/customer-info";
import { FINAL_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import type { OrderDetail } from "@/lib/orders";
import { formatWon } from "@/lib/price";
import { formatKstDateTime } from "@/lib/time";

const POLL_MS = 5000;
const STEPS: OrderStatus[] = ["RECEIVED", "PREPARING", "READY", "PICKED_UP"];

const MESSAGE: Record<OrderStatus, string> = {
  RECEIVED: "주문이 접수되었습니다.",
  PREPARING: "음료를 만들고 있어요.",
  READY: "픽업대에서 음료를 받아 가세요!",
  PICKED_UP: "픽업이 완료되었습니다.",
  CANCELED: "취소된 주문입니다.",
};

type OrderJson = Omit<OrderDetail, "createdAt" | "status"> & {
  createdAt: string;
  status: OrderStatus;
};

type FetchResult = OrderJson | "not-found" | null;

async function fetchOrder(id: string): Promise<FetchResult> {
  try {
    const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
    if (res.status === 404) return "not-found";
    return res.ok ? await res.json() : null;
  } catch {
    return null; // 일시적인 네트워크 오류는 다음 폴링에서 다시 시도
  }
}

export function OrderStatusView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const saved = customerInfo.useValue();
  const [order, setOrder] = useState<OrderJson | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const apply = useCallback((result: FetchResult) => {
    if (result === "not-found") setNotFound(true);
    else if (result) setOrder(result);
  }, []);

  const isFinal = order ? FINAL_STATUSES.includes(order.status) : false;

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchOrder(id).then((result) => {
        if (active) apply(result);
      });
    load();
    const timer = isFinal ? undefined : setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, isFinal, apply]);

  async function cancel() {
    if (!saved || !confirm("주문을 취소할까요?")) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${id}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeNo: saved.employeeNo }),
      });
      if (!res.ok) setError((await res.json()).error?.message ?? "취소하지 못했습니다.");
      apply(await fetchOrder(id));
    } catch {
      setError("네트워크 오류로 취소하지 못했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  if (notFound) return <p className="py-16 text-center text-gray-500">주문을 찾을 수 없습니다.</p>;
  if (!order) return <p className="text-gray-500">불러오는 중…</p>;

  const stepIndex = STEPS.indexOf(order.status);

  return (
    <div>
      <section className="rounded-2xl bg-gray-500/10 p-6 text-center">
        <p className="text-sm text-gray-500">주문번호</p>
        <p className="text-5xl font-bold">{order.orderNumber}</p>
        <p className="mt-4 text-lg font-semibold" role="status">
          {MESSAGE[order.status]}
        </p>
      </section>

      {order.status !== "CANCELED" && (
        <ol className="mt-6 flex justify-between text-sm">
          {STEPS.map((s, i) => (
            <li key={s} className={i <= stepIndex ? "font-semibold" : "text-gray-500 opacity-60"}>
              {STATUS_LABEL[s]}
            </li>
          ))}
        </ol>
      )}

      <section className="mt-8">
        <h2 className="mb-2 font-semibold">주문 내역</h2>
        <ul className="divide-y divide-gray-500/30">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between py-3">
              <div>
                <p>
                  {item.nameSnapshot} × {item.quantity}
                </p>
                {item.options.length > 0 && (
                  <p className="text-sm text-gray-500">
                    {item.options.map((o) => o.nameSnapshot).join(" / ")}
                  </p>
                )}
              </div>
              <span>{formatWon(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-gray-500/30 pt-3 font-semibold">
          <span>합계</span>
          <span>{formatWon(order.totalPrice)}</span>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {order.customerNameSnapshot} · {formatKstDateTime(order.createdAt)}
        </p>
      </section>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-500">
          {error}
        </p>
      )}

      {order.status === "RECEIVED" && saved && (
        <button
          type="button"
          onClick={cancel}
          disabled={cancelling}
          className="mt-8 w-full rounded-lg border border-gray-300 py-3 disabled:opacity-40"
        >
          {cancelling ? "취소 중…" : "주문 취소"}
        </button>
      )}
    </div>
  );
}
