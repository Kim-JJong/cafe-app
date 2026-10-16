"use client";

import { MAX_QUANTITY } from "@/lib/limits";

/** − 숫자 + 수량 조절 (디자인 1b: 기본, 1c: small) */
export function Stepper({
  value,
  onChange,
  label,
  small = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  small?: boolean;
}) {
  const button = `${small ? "text-base" : "text-[17px]"} leading-none disabled:text-ink/35`;
  return (
    <div
      className={`flex items-center gap-3.5 border border-ink/12 bg-white ${
        small ? "rounded-xl px-3 py-1.5" : "rounded-[14px] px-3.5 py-2.5"
      }`}
    >
      <button
        type="button"
        aria-label={`${label} 수량 줄이기`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className={button}
      >
        −
      </button>
      <span className={`${small ? "text-[13px]" : "text-sm"} min-w-4 text-center font-semibold`}>{value}</span>
      <button
        type="button"
        aria-label={`${label} 수량 늘리기`}
        disabled={value >= MAX_QUANTITY}
        onClick={() => onChange(value + 1)}
        className={button}
      >
        +
      </button>
    </div>
  );
}
