import { connection, type NextRequest } from "next/server";
import { settlementCsv } from "@/lib/csv";
import { AppError, errorResponse } from "@/lib/errors";
import { getSettlement } from "@/lib/settlement";
import { requireStaff } from "@/lib/staff-auth";
import { parseMonth } from "@/lib/time";

export async function GET(request: NextRequest) {
  await connection(); // 아래 catch가 프리렌더 중단 신호를 삼키지 않도록 먼저 동적 라우트로 지정
  try {
    await requireStaff();
    const value = request.nextUrl.searchParams.get("month");
    const month = parseMonth(value);
    if (!month) throw new AppError(400, "VALIDATION", "month는 YYYY-MM 형식이어야 합니다.");

    const { rows } = await getSettlement(month.year, month.month);
    return new Response(settlementCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="settlement-${value}.csv"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
