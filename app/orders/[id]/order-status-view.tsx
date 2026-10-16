"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { FINAL_STATUSES, type OrderStatus } from "@/lib/order-status";
import type { OrderDetail } from "@/lib/orders";
import { formatWon } from "@/lib/price";
import { kstDateLabel } from "@/lib/time";
import { ReadyPopup } from "../../_components/ready-popup";

const POLL_MS = 5000;

// 디자인 1e의 3단계 진행 바
const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "RECEIVED", label: "주문 확정" },
  { status: "PREPARING", label: "제조 중" },
  { status: "READY", label: "픽업 대기" },
];

const MESSAGE: Record<OrderStatus, string> = {
  RECEIVED: "주문이 확정되었습니다",
  PREPARING: "제조 중입니다",
  READY: "픽업대에서 음료를 받아 가세요",
  PICKED_UP: "픽업이 완료되었습니다",
  CANCELED: "취소된 주문입니다", // 취소 기능이 있던 때의 기존 주문
};

type OrderJson = Omit<OrderDetail, "createdAt" | "status"> & {
  createdAt: string;
  status: OrderStatus;
  aheadCount: number;
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

function waitingText(order: OrderJson) {
  if (order.status !== "RECEIVED" && order.status !== "PREPARING") return null;
  return order.aheadCount > 0 ? `앞에 ${order.aheadCount}팀이 기다리고 있습니다` : "다음 순서입니다";
}

export function OrderStatusView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderJson | null>(null);
  const [notFound, setNotFound] = useState(false);

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

  const header = (
    <header className="flex items-center justify-between px-5 pt-4 text-[13px] font-medium text-white/50">
      <Link href="/" aria-label="메뉴로" className="text-lg text-white/70">
        ‹
      </Link>
      {order && <span>{kstDateLabel(order.createdAt)} 주문</span>}
    </header>
  );

  if (notFound) {
    return (
      <>
        {header}
        <p className="py-16 text-center text-white/50">주문을 찾을 수 없습니다.</p>
      </>
    );
  }
  if (!order) return header;

  const canceled = order.status === "CANCELED";
  const stepIndex = order.status === "PICKED_UP" ? STEPS.length : STEPS.findIndex((s) => s.status === order.status);
  const brewing = order.status === "RECEIVED" || order.status === "PREPARING";
  const waiting = waitingText(order);

  return (
    <>
      {header}
      <ReadyPopup orders={[order]} />
      <section className="flex flex-1 flex-col items-center justify-center gap-1.5 py-10">
        <p className="text-[13.5px] font-medium text-white/60">나의 대기번호</p>
        <p
          className={`text-8xl leading-[1.05] font-bold tracking-[-3px] ${canceled ? "text-white/30 line-through" : "text-brand-light"}`}
        >
          {order.orderNumber}
        </p>
        <p
          role="status"
          className={`mt-1.5 rounded-full bg-brand-light/15 px-4 py-2 text-[13px] font-semibold text-brand-light ${
            brewing ? "animate-brew" : ""
          }`}
        >
          {MESSAGE[order.status]}
        </p>
        {waiting && <p className="mt-3.5 text-[12.5px] text-white/45">{waiting}</p>}
      </section>

      <section className="flex flex-col gap-3.5 px-6 pb-[18px]">
        {!canceled && (
          <>
            <div className="flex items-center gap-2.5">
              {STEPS.map((s, i) => (
                <div key={s.status} className={`h-1 flex-1 rounded ${i <= stepIndex ? "bg-brand-light" : "bg-white/20"}`} />
              ))}
            </div>
            <ol className="flex justify-between text-[11.5px] font-medium text-white/55">
              {STEPS.map((s, i) => (
                <li key={s.status} className={i <= stepIndex ? "text-brand-light" : ""}>
                  {s.label}
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="mt-1 flex flex-col gap-2 rounded-[18px] bg-white/[.07] p-[15px]">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-[13px] text-white/60">
              <span>{[item.nameSnapshot, ...item.options.map((o) => o.nameSnapshot.split(": ")[1])].join(" · ")}</span>
              <span>{item.quantity}</span>
            </div>
          ))}
          <div className="h-px bg-white/12" />
          <div className="flex justify-between text-[12.5px] font-medium text-white/75">
            <span>급여 공제</span>
            <span>{formatWon(order.totalPrice)}</span>
          </div>
        </div>

        {FINAL_STATUSES.includes(order.status) && (
          <Link href="/" className="rounded-[14px] bg-white/10 py-[13px] text-center text-sm font-semibold text-white/80">
            메뉴로 돌아가기
          </Link>
        )}
      </section>
    </>
  );
}
