import { connection, type NextRequest } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { isOrderStatus } from "@/lib/order-status";
import { requireStaff } from "@/lib/staff-auth";
import { listOrdersByStatus } from "@/lib/staff-orders";

export async function GET(request: NextRequest) {
  await connection(); // 아래 catch가 프리렌더 중단 신호를 삼키지 않도록 먼저 동적 라우트로 지정
  try {
    await requireStaff();
    const status = request.nextUrl.searchParams.get("status");
    if (status !== null && !isOrderStatus(status)) {
      throw new AppError(400, "VALIDATION", "알 수 없는 상태입니다.");
    }
    return Response.json(await listOrdersByStatus(status ? [status] : undefined));
  } catch (e) {
    return errorResponse(e);
  }
}
