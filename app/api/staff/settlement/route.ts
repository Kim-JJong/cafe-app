import { connection, type NextRequest } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { getSettlement, getSettlementOrders } from "@/lib/settlement";
import { requireStaff } from "@/lib/staff-auth";
import { parseMonth } from "@/lib/time";

/** ?month=YYYY-MM → 사번별 집계, &employeeNo= 를 붙이면 그 사람의 주문 상세 */
export async function GET(request: NextRequest) {
  await connection(); // 아래 catch가 프리렌더 중단 신호를 삼키지 않도록 먼저 동적 라우트로 지정
  try {
    await requireStaff();
    const params = request.nextUrl.searchParams;
    const month = parseMonth(params.get("month"));
    if (!month) throw new AppError(400, "VALIDATION", "month는 YYYY-MM 형식이어야 합니다.");

    const employeeNo = params.get("employeeNo")?.trim();
    if (employeeNo) {
      return Response.json(await getSettlementOrders(month.year, month.month, employeeNo));
    }
    return Response.json(await getSettlement(month.year, month.month));
  } catch (e) {
    return errorResponse(e);
  }
}
