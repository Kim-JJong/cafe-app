"use client";

import { createLocalStore } from "@/lib/local-store";

/** 한 번 입력한 사번/이름을 기억해 다음 주문 때 다시 묻지 않는다 (DESIGN.md §6) */
export const customerInfo = createLocalStore<{ employeeNo: string; name: string } | null>(
  "cafe.customer",
  null,
);

/** 주문 확인 화면의 급여 공제 동의. 한 번 동의하면 이 기기에서는 체크된 채로 시작 */
export const payrollAgreement = createLocalStore<boolean>("cafe.payroll-agreed", false);
