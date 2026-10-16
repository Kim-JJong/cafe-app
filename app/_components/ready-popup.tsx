"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { customerInfo, readyNotified } from "@/lib/customer-info";
import { findOrderToNotify, rememberNotified } from "@/lib/ready-notice";
import { STORE_LOCATION, STORE_NAME } from "@/lib/store-info";

const POLL_MS = 5000;

type ReadyOrder = { id: number; orderNumber: number; status: string; createdAt: string };

/**
 * 음료 완료 팝업. 주문 하나를 한 번만 알린다 (확인한 주문 ID는 이 기기에 기억).
 * orders에서 아직 알리지 않은 READY 주문을 골라 보여 준다.
 */
export function ReadyPopup({ orders, showOrderLink = false }: { orders: ReadyOrder[]; showOrderLink?: boolean }) {
  const notified = readyNotified.useValue();
  const order = findOrderToNotify(orders, notified);
  const orderId = order?.id;

  // 폴링마다 order 객체가 새로 만들어지므로 ID 기준으로 한 번만 진동
  useEffect(() => {
    if (orderId === undefined) return;
    try {
      navigator.vibrate?.(200);
    } catch {} // 진동을 지원하지 않거나 막힌 브라우저는 무시
  }, [orderId]);

  if (!order) return null;

  const close = () => readyNotified.write(rememberNotified(readyNotified.read(), order.id));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-5 sm:items-center">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ready-title"
        aria-describedby="ready-desc"
        className="w-full max-w-sm rounded-[24px] bg-white p-6 text-center text-ink shadow-xl"
      >
        <p className="text-[13px] font-medium text-brand">음료가 준비되었습니다</p>
        <p id="ready-title" className="mt-1 text-[64px] leading-none font-bold tracking-[-2px] text-brand">
          {order.orderNumber}
        </p>
        <p id="ready-desc" className="mt-3 text-sm leading-relaxed text-ink/60">
          {STORE_LOCATION} {STORE_NAME} 픽업대에서
          <br />
          대기번호를 확인하고 받아 가세요.
        </p>
        <div className="mt-6 flex gap-2">
          {showOrderLink && (
            <Link
              href={`/orders/${order.id}`}
              onClick={close}
              className="flex-1 rounded-[14px] border border-ink/12 py-3.5 text-sm font-semibold"
            >
              주문 보기
            </Link>
          )}
          <button
            type="button"
            autoFocus
            onClick={close}
            className="flex-1 rounded-[14px] bg-brand py-3.5 text-sm font-semibold text-white"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

/** 주문 홈처럼 주문을 따로 불러오지 않는 화면용: 내 주문을 폴링해 완료되면 팝업 */
export function ReadyWatcher() {
  const employeeNo = customerInfo.useValue()?.employeeNo;
  const [orders, setOrders] = useState<ReadyOrder[]>([]);

  useEffect(() => {
    if (!employeeNo) return;
    let active = true;
    const load = () =>
      fetch(`/api/orders?employeeNo=${encodeURIComponent(employeeNo)}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((list: ReadyOrder[] | null) => {
          if (active && list) setOrders(list);
        })
        .catch(() => {}); // 일시적인 네트워크 오류는 다음 폴링에서 다시 시도
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [employeeNo]);

  return <ReadyPopup orders={employeeNo ? orders : []} showOrderLink />;
}
