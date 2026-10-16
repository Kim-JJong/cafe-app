"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { clearCart, removeFromCart, setQuantity, useCart } from "@/lib/cart";
import { customerInfo } from "@/lib/customer-info";
import { MAX_QUANTITY } from "@/lib/limits";
import { formatWon } from "@/lib/price";

const inputClass = "w-full rounded-lg border border-gray-300 bg-background px-3 py-2";

export function CartView() {
  const lines = useCart();
  const saved = customerInfo.useValue();
  const router = useRouter();

  // 입력 전에는 저장된 사번/이름을 보여 준다
  const [employeeNo, setEmployeeNo] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeNoValue = employeeNo ?? saved?.employeeNo ?? "";
  const nameValue = name ?? saved?.name ?? "";
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeNo: employeeNoValue,
          name: nameValue,
          items: lines.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            optionIds: l.optionIds,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "주문에 실패했습니다.");
        return;
      }
      customerInfo.write({ employeeNo: employeeNoValue.trim(), name: nameValue.trim() });
      clearCart();
      router.replace(`/orders/${data.id}`);
    } catch {
      setError("네트워크 오류로 주문하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500">
        <p>장바구니가 비어 있습니다.</p>
        <Link href="/" className="mt-4 inline-block underline">
          메뉴 보러 가기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <ul className="divide-y divide-gray-500/30">
        {lines.map((line) => (
          <li key={line.key} className="py-4">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{line.name}</p>
                {line.optionLabels.length > 0 && (
                  <p className="text-sm text-gray-500">{line.optionLabels.join(" / ")}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeFromCart(line.key)}
                className="text-sm text-gray-500"
              >
                삭제
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={`${line.name} 수량 줄이기`}
                  disabled={line.quantity <= 1}
                  onClick={() => setQuantity(line.key, line.quantity - 1)}
                  className="h-8 w-8 rounded-full border border-gray-300 disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-6 text-center">{line.quantity}</span>
                <button
                  type="button"
                  aria-label={`${line.name} 수량 늘리기`}
                  disabled={line.quantity >= MAX_QUANTITY}
                  onClick={() => setQuantity(line.key, line.quantity + 1)}
                  className="h-8 w-8 rounded-full border border-gray-300 disabled:opacity-30"
                >
                  +
                </button>
              </div>
              <span>{formatWon(line.unitPrice * line.quantity)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex justify-between border-t border-gray-500/30 pt-4 text-lg font-semibold">
        <span>합계</span>
        <span>{formatWon(total)}</span>
      </div>

      <fieldset className="mt-8 space-y-3">
        <legend className="mb-2 font-semibold">주문자 정보</legend>
        <label className="block">
          <span className="text-sm text-gray-500">사번</span>
          <input
            required
            inputMode="numeric"
            maxLength={20}
            value={employeeNoValue}
            onChange={(e) => setEmployeeNo(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-500">이름</span>
          <input
            required
            maxLength={30}
            value={nameValue}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-500">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-lg bg-foreground py-3 font-semibold text-background disabled:opacity-40"
      >
        {submitting ? "주문 중…" : `${formatWon(total)} 주문하기`}
      </button>
    </form>
  );
}
