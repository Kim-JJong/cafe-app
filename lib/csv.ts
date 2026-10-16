import type { SettlementRow } from "@/lib/settlement";

const BOM = "﻿"; // Excel이 UTF-8 한글을 깨뜨리지 않도록

function cell(value: string | number) {
  let text = String(value);
  // =, +, -, @ 로 시작하는 문자열은 Excel이 수식으로 실행할 수 있으므로 문자로 고정
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 정산 CSV: 사번, 이름, 주문 수, 합계 (DESIGN.md §7) */
export function settlementCsv(rows: SettlementRow[]) {
  const lines = [
    ["사번", "이름", "주문 수", "합계"],
    ...rows.map((r) => [r.employeeNo, r.name, r.orderCount, r.total]),
  ].map((cols) => cols.map(cell).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}
