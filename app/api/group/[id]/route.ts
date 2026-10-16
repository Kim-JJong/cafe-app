import { AppError, errorResponse } from "@/lib/errors";
import { getRoomSnapshot } from "@/lib/group";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const room = await getRoomSnapshot((await params).id);
  if (!room) return errorResponse(new AppError(404, "NOT_FOUND", "단체 주문 방을 찾을 수 없습니다."));
  return Response.json(room);
}
