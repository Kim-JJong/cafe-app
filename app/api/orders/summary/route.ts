import type { NextRequest } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { getMonthlyCharge } from "@/lib/settlement";

/** ?employeeNo= → 이번 달(KST) 급여 공제 예정액 */
export async function GET(request: NextRequest) {
  const employeeNo = request.nextUrl.searchParams.get("employeeNo")?.trim();
  if (!employeeNo) {
    return errorResponse(new AppError(400, "VALIDATION", "사번이 필요합니다."));
  }
  return Response.json(await getMonthlyCharge(employeeNo));
}
