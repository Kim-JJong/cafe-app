"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { clearCart, useCart } from "@/lib/cart";
import { customerInfo, payrollAgreement } from "@/lib/customer-info";
import { formatWon } from "@/lib/price";
import { STORE_LOCATION, STORE_NAME } from "@/lib/store-info";
import { BottomBar } from "../_components/screen";

const inputClass = "w-full rounded-xl border border-ink/12 bg-white px-3 py-2.5 text-sm";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-[18px] border border-ink/[.08] bg-white p-4">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between text-[13px] text-ink/60">
      <span>{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

export function CheckoutView() {
  const lines = useCart();
  const saved = customerInfo.useValue();
  const agreedBefore = payrollAgreement.useValue();
  const router = useRouter();

  // 입력 전에는 저장된 값을 보여 준다
  const [employeeNo, setEmployeeNo] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [agreed, setAgreed] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeNoValue = employeeNo ?? saved?.employeeNo ?? "";
  const nameValue = name ?? saved?.name ?? "";
  const agreedValue = agreed ?? agreedBefore;
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!agreedValue) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeNo: employeeNoValue,
          name: nameValue,
          items: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, optionIds: l.optionIds })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "주문에 실패했습니다.");
        return;
      }
      customerInfo.write({ employeeNo: employeeNoValue.trim(), name: nameValue.trim() });
      payrollAgreement.write(true);
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
      <div className="px-5 py-16 text-center text-ink/50">
        <p>주문할 메뉴가 없습니다.</p>
        <Link href="/" className="mt-4 inline-block font-medium text-brand">
          메뉴 보러 가기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-3 px-5 pb-4">
        <Card title="픽업 정보">
          <Row label="장소" value={`${STORE_LOCATION} ${STORE_NAME}`} />
          <Row label="주문 취소" value="불가 (주문 즉시 확정)" />
        </Card>

        <Card title="주문자 정보">
          <label className="block">
            <span className="text-xs text-ink/55">사번</span>
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
            <span className="text-xs text-ink/55">이름</span>
            <input
              required
              maxLength={30}
              value={nameValue}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
        </Card>

        <Card title="결제 수단">
          <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-brand bg-brand-soft px-3.5 py-3">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-brand text-[11px] font-semibold text-white">
              공제
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold">급여 공제</p>
              <p className="mt-0.5 text-[11.5px] text-ink/55">월 정산 후 급여에서 일괄 공제됩니다</p>
            </div>
            <span aria-hidden className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-brand text-[11px] text-white">
              ✓
            </span>
          </div>
        </Card>

        <Card title="주문 내역">
          {lines.map((l) => (
            <Row
              key={l.key}
              label={`${l.name} · ${l.quantity}`}
              value={<span className="font-normal text-ink/60">{formatWon(l.unitPrice * l.quantity)}</span>}
            />
          ))}
          <div className="h-px bg-ink/[.08]" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">합계</span>
            <span className="text-lg font-bold">{formatWon(total)}</span>
          </div>
        </Card>

        <label className="flex cursor-pointer items-start gap-2.5 px-0.5">
          <input
            type="checkbox"
            checked={agreedValue}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-[17px] w-[17px] shrink-0 accent-brand"
          />
          <span className="text-[11.5px] leading-normal text-ink/50">
            급여 공제 방식의 사내 카페 이용에 동의합니다. 공제 내역은 월 정산 후 확인할 수 있습니다.
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <BottomBar>
        <div className="px-5 pt-3.5 pb-2.5">
          <button
            type="submit"
            disabled={submitting || !agreedValue}
            className="w-full rounded-[14px] bg-ink py-[15px] text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {submitting ? "주문 중…" : `${formatWon(total)} 주문하기`}
          </button>
        </div>
      </BottomBar>
    </form>
  );
}
