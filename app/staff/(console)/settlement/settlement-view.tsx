"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { formatWon } from "@/lib/price";
import type { SettlementOrder, SettlementRow } from "@/lib/settlement";
import { currentKstMonth, formatKstDateTime, parseMonth } from "@/lib/time";
import { useStaffApi } from "../staff-fetch";

type Summary = { rows: SettlementRow[]; pendingCount: number; grandTotal: number };
type OrderJson = Omit<SettlementOrder, "createdAt"> & { createdAt: string };

export function SettlementView() {
  const router = useRouter();
  const queryMonth = useSearchParams().get("month");
  const month = parseMonth(queryMonth) ? queryMonth! : currentKstMonth();
  const { staffFetch } = useStaffApi();

  const [summary, setSummary] = useState<{ month: string; data: Summary } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openNo, setOpenNo] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, OrderJson[]>>({});

  useEffect(() => {
    let active = true;
    staffFetch(`/api/staff/settlement?month=${month}`)
      .then(async (res) => {
        if (!active) return;
        if (res.ok) setSummary({ month, data: await res.json() });
        else setError((await res.json()).error?.message ?? "정산을 불러오지 못했습니다.");
      })
      .catch(() => active && setError("네트워크 오류로 정산을 불러오지 못했습니다."));
    return () => {
      active = false;
    };
  }, [month, staffFetch]);

  function changeMonth(value: string) {
    if (!parseMonth(value)) return;
    setOpenNo(null);
    setDetails({});
    setError(null);
    router.replace(`/staff/settlement?month=${value}`);
  }

  async function toggleDetail(employeeNo: string) {
    if (openNo === employeeNo) {
      setOpenNo(null);
      return;
    }
    setOpenNo(employeeNo);
    if (details[employeeNo]) return;
    const res = await staffFetch(
      `/api/staff/settlement?month=${month}&employeeNo=${encodeURIComponent(employeeNo)}`,
    );
    if (res.ok) {
      const orders: OrderJson[] = await res.json();
      setDetails((d) => ({ ...d, [employeeNo]: orders }));
    }
  }

  // 다른 달을 불러오는 중에는 이전 달 표를 보여 주지 않는다
  const data = summary?.month === month ? summary.data : null;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <span className="font-semibold">정산 월</span>
          <input
            type="month"
            value={month}
            onChange={(e) => changeMonth(e.target.value)}
            className="rounded-lg border border-gray-300 bg-background px-3 py-1.5"
          />
        </label>
        <a
          href={`/api/staff/settlement.csv?month=${month}`}
          download
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          CSV 다운로드
        </a>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </p>
      )}

      {!data && !error && <p className="py-10 text-gray-500">불러오는 중…</p>}

      {data && (
        <>
          {data.pendingCount > 0 && (
            <p role="status" className="mt-4 rounded-lg bg-yellow-500/15 p-3 text-sm">
              이 달에 아직 픽업이 끝나지 않은 주문이 {data.pendingCount}건 있습니다. 픽업 완료된 주문만 정산에 포함됩니다.
            </p>
          )}

          {data.rows.length === 0 ? (
            <p className="py-10 text-center text-gray-500">정산할 주문이 없습니다.</p>
          ) : (
            <table className="mt-4 w-full text-left">
              <thead className="border-b border-gray-500/30 text-sm text-gray-500">
                <tr>
                  <th className="py-2 font-normal">사번</th>
                  <th className="py-2 font-normal">이름</th>
                  <th className="py-2 text-right font-normal">주문 수</th>
                  <th className="py-2 text-right font-normal">합계</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <Fragment key={row.employeeNo}>
                    <tr className="border-b border-gray-500/30">
                      <td className="py-2">
                        <button
                          type="button"
                          aria-expanded={openNo === row.employeeNo}
                          onClick={() => toggleDetail(row.employeeNo)}
                          className="underline"
                        >
                          {row.employeeNo}
                        </button>
                      </td>
                      <td className="py-2">{row.name}</td>
                      <td className="py-2 text-right">{row.orderCount}</td>
                      <td className="py-2 text-right">{formatWon(row.total)}</td>
                    </tr>
                    {openNo === row.employeeNo && (
                      <tr className="border-b border-gray-500/30 bg-gray-500/10 text-sm">
                        <td colSpan={4} className="px-3 py-2">
                          {details[row.employeeNo] ? (
                            <ul className="space-y-1">
                              {details[row.employeeNo].map((o) => (
                                <li key={o.id} className="flex justify-between gap-4">
                                  <span>
                                    {formatKstDateTime(o.createdAt)} · {o.orderNumber}번 ·{" "}
                                    {o.items.map((i) => `${i.nameSnapshot}×${i.quantity}`).join(", ")}
                                  </span>
                                  <span>{formatWon(o.totalPrice)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">불러오는 중…</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-3" colSpan={2}>
                    합계 ({data.rows.length}명)
                  </td>
                  <td className="py-3 text-right">
                    {data.rows.reduce((sum, r) => sum + r.orderCount, 0)}
                  </td>
                  <td className="py-3 text-right">{formatWon(data.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </>
      )}
    </div>
  );
}
