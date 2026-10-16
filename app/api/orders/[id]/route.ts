import { AppError, errorResponse } from "@/lib/errors";
import { getOrder } from "@/lib/orders";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const order = Number.isInteger(id) ? await getOrder(id) : null;
  if (!order) {
    return errorResponse(new AppError(404, "NOT_FOUND", "주문을 찾을 수 없습니다."));
  }
  return Response.json(order);
}
