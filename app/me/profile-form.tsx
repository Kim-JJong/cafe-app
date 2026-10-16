"use client";

import { useState, type FormEvent } from "react";
import { customerInfo } from "@/lib/customer-info";

const inputClass = "w-full rounded-xl border border-ink/12 bg-white px-3 py-2.5 text-sm";

/** 이 기기에 기억된 사번/이름 확인·변경 (DESIGN.md §6: 로그인 도입 전까지 직접 입력) */
export function ProfileForm() {
  const saved = customerInfo.useValue();
  const [employeeNo, setEmployeeNo] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const employeeNoValue = employeeNo ?? saved?.employeeNo ?? "";
  const nameValue = name ?? saved?.name ?? "";

  function save(e: FormEvent) {
    e.preventDefault();
    customerInfo.write({ employeeNo: employeeNoValue.trim(), name: nameValue.trim() });
    setEmployeeNo(null);
    setName(null);
    setMessage("저장했습니다.");
  }

  function forget() {
    customerInfo.write(null);
    setEmployeeNo(null);
    setName(null);
    setMessage("이 기기에서 지웠습니다.");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 px-5">
      <section className="flex flex-col gap-2.5 rounded-[18px] border border-ink/[.08] p-4">
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
      </section>

      <p className="px-0.5 text-xs leading-relaxed text-ink/45">
        이 기기에만 저장됩니다. 처음 주문할 때 쓴 사번과 이름이 다르면 주문이 거절되며, 이름 변경은 카페 직원에게
        요청해 주세요.
      </p>

      {message && (
        <p role="status" className="px-0.5 text-sm text-brand">
          {message}
        </p>
      )}

      <button type="submit" className="rounded-[14px] bg-brand py-3.5 text-[15px] font-semibold text-white">
        저장
      </button>
      {saved && (
        <button type="button" onClick={forget} className="py-2 text-sm text-ink/45">
          이 기기에서 지우기
        </button>
      )}
    </form>
  );
}
