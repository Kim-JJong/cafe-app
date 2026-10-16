import { AppError, errorResponse } from "@/lib/errors";
import { cancelOrderByCustomer } from "@/lib/orders";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id)) throw new AppError(404, "NOT_FOUND", "주문을 찾을 수 없습니다.");

    const body = await request.json().catch(() => ({}));
    const employeeNo = typeof body?.employeeNo === "string" ? body.employeeNo.trim() : "";
    if (!employeeNo) throw new AppError(400, "VALIDATION", "사번이 필요합니다.");

    await cancelOrderByCustomer(id, employeeNo);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
