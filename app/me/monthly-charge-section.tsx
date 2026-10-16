"use client";

import { customerInfo } from "@/lib/customer-info";
import { MonthlyChargeCard } from "../_components/monthly-charge";

/** 저장된 사번이 있을 때만 이번 달 급여 공제 예정액을 보여 준다 */
export function MonthlyChargeSection() {
  const employeeNo = customerInfo.useValue()?.employeeNo;
  return employeeNo ? <MonthlyChargeCard employeeNo={employeeNo} /> : null;
}
