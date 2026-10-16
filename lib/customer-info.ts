"use client";

import { createLocalStore } from "@/lib/local-store";

/** 한 번 입력한 사번/이름을 기억해 다음 주문 때 다시 묻지 않는다 (DESIGN.md §6) */
export const customerInfo = createLocalStore<{ employeeNo: string; name: string } | null>(
  "cafe.customer",
  null,
);

/** 음료 완료 팝업을 이미 보여 준 주문 ID (화면을 옮겨도 다시 뜨지 않도록) */
export const readyNotified = createLocalStore<number[]>("cafe.ready-notified", []);

/** 주문 확인 화면의 급여 공제 동의. 한 번 동의하면 이 기기에서는 체크된 채로 시작 */
export const payrollAgreement = createLocalStore<boolean>("cafe.payroll-agreed", false);
