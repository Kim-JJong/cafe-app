import { errorResponse } from "@/lib/errors";
import { placeGroupOrder } from "@/lib/group";

/** 방장 주문 { hostKey } → { orderId, orderNumber } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(await placeGroupOrder((await params).id, body?.hostKey), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
