"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { customerInfo } from "@/lib/customer-info";
import { saveMembership } from "@/lib/group-membership";
import { DEADLINE_MINUTES } from "@/lib/limits";
import { BottomBar } from "../../_components/screen";

const inputClass = "w-full rounded-xl border border-ink/12 bg-white px-3 py-2.5 text-sm";

export function CreateRoomForm() {
  const saved = customerInfo.useValue();
  const router = useRouter();
  const [employeeNo, setEmployeeNo] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeNoValue = employeeNo ?? saved?.employeeNo ?? "";
  const nameValue = name ?? saved?.name ?? "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/group", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeNo: employeeNoValue, name: nameValue, minutes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "방을 만들지 못했습니다.");
        return;
      }
      customerInfo.write({ employeeNo: employeeNoValue.trim(), name: nameValue.trim() });
      saveMembership(data.roomId, { memberId: data.memberId, memberKey: data.hostKey, isHost: true });
      router.replace(`/group/${data.roomId}`);
    } catch {
      setError("네트워크 오류로 방을 만들지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-3 px-5 pb-4">
        <p className="px-0.5 text-[13px] leading-relaxed text-ink/60">
          팀원들에게 링크를 보내면 각자 마실 음료를 담습니다. 마감 후 내가 한 번에 주문하고, 금액은 내 급여에서
          공제됩니다.
        </p>

        <section className="flex flex-col gap-2.5 rounded-[18px] border border-ink/[.08] p-4">
          <h2 className="text-[13px] font-semibold">사는 사람 (결제자)</h2>
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

        <fieldset className="rounded-[18px] border border-ink/[.08] p-4">
          <legend className="sr-only">마감 시간</legend>
          <h2 className="text-[13px] font-semibold">담기 마감</h2>
          <div className="mt-2.5 flex gap-2">
            {DEADLINE_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
                className={`flex-1 rounded-xl py-2.5 text-[13px] ${
                  minutes === m ? "bg-ink font-semibold text-white" : "border border-ink/12 font-medium"
                }`}
              >
                {m}분
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[11.5px] text-ink/45">마감 후에는 팀원이 더 담을 수 없고, 주문은 내가 언제든 할 수 있어요.</p>
        </fieldset>

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
            disabled={submitting}
            className="w-full rounded-[14px] bg-brand py-[15px] text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {submitting ? "만드는 중…" : "방 만들고 링크 공유하기"}
          </button>
        </div>
      </BottomBar>
    </form>
  );
}
