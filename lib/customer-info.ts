"use client";

import { createLocalStore } from "@/lib/local-store";

/** 한 번 입력한 사번/이름을 기억해 다음 주문 때 다시 묻지 않는다 (DESIGN.md §6) */
export const customerInfo = createLocalStore<{ employeeNo: string; name: string } | null>(
  "cafe.customer",
  null,
);
