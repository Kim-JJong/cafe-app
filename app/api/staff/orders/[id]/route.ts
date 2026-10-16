import { AppError, errorResponse } from "@/lib/errors";
import { isOrderStatus } from "@/lib/order-status";
import { requireStaff } from "@/lib/staff-auth";
import { updateOrderStatus } from "@/lib/staff-orders";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff();
    const id = Number((await params).id);
    if (!Number.isInteger(id)) throw new AppError(404, "NOT_FOUND", "주문을 찾을 수 없습니다.");

    const body = await request.json().catch(() => ({}));
    if (!isOrderStatus(body?.status)) throw new AppError(400, "VALIDATION", "알 수 없는 상태입니다.");

    await updateOrderStatus(id, body.status);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
