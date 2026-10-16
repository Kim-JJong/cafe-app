"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatWon } from "@/lib/price";

/** 메뉴 홈 하단의 "장바구니 N잔 · 금액 ›" (디자인 1a). 비어 있으면 숨김 */
export function CartBar() {
  const lines = useCart();
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  if (count === 0) return null;
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  return (
    <Link
      href="/cart"
      className="mx-5 mt-3.5 mb-2.5 flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white"
    >
      <span className="text-[13px] font-medium">장바구니 {count}잔</span>
      <span className="text-sm font-semibold">{formatWon(total)} ›</span>
    </Link>
  );
}
