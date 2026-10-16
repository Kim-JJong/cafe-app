"use client";

import Link from "next/link";
import { removeFromCart, setQuantity, useCart } from "@/lib/cart";
import { formatWon } from "@/lib/price";
import { STORE_LOCATION, STORE_NAME } from "@/lib/store-info";
import { BottomBar } from "../_components/screen";
import { Stepper } from "../_components/stepper";

export function CartView() {
  const lines = useCart();
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  if (lines.length === 0) {
    return (
      <div className="px-5 py-16 text-center text-ink/50">
        <p>장바구니가 비어 있습니다.</p>
        <Link href="/" className="mt-4 inline-block font-medium text-brand">
          메뉴 보러 가기
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2.5 px-5 pb-4">
        {lines.map((line) => (
          <article key={line.key} className="rounded-[18px] border border-ink/[.08] bg-white p-[15px]">
            <div className="flex justify-between">
              <h2 className="text-[15px] font-semibold">{line.name}</h2>
              <span className="text-sm font-semibold">{formatWon(line.unitPrice * line.quantity)}</span>
            </div>
            {line.optionLabels.length > 0 && (
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/50">{line.optionLabels.join(" · ")}</p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <Stepper small value={line.quantity} onChange={(q) => setQuantity(line.key, q)} label={line.name} />
              <button
                type="button"
                onClick={() => removeFromCart(line.key)}
                className="text-[12.5px] font-medium text-ink/40"
              >
                삭제
              </button>
            </div>
          </article>
        ))}

        <Link
          href="/"
          className="rounded-2xl border border-dashed border-ink/20 px-[15px] py-[13px] text-center text-[13px] font-medium text-ink/50"
        >
          ＋ 메뉴 더 담기
        </Link>

        <div className="mt-0.5 flex flex-col gap-2 rounded-[18px] bg-surface p-[15px]">
          <div className="flex justify-between text-[13px] text-ink/60">
            <span>음료 {count}잔</span>
            <span>{formatWon(total)}</span>
          </div>
          <div className="h-px bg-ink/10" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">결제 예정</span>
            <span className="text-lg font-bold">{formatWon(total)}</span>
          </div>
        </div>

        <p className="px-0.5 text-xs leading-relaxed text-ink/45">
          픽업 장소는 {STORE_LOCATION} {STORE_NAME}입니다. 주문 후 취소는 제조 시작 전까지 가능합니다.
        </p>
      </div>

      <BottomBar>
        <div className="px-5 pt-3.5 pb-2.5">
          <Link
            href="/checkout"
            className="block rounded-[14px] bg-brand py-[15px] text-center text-[15px] font-semibold text-white"
          >
            주문서 확인
          </Link>
        </div>
      </BottomBar>
    </>
  );
}
