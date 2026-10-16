import { errorResponse } from "@/lib/errors";
import { createRoom } from "@/lib/group";

/** 단체 주문 방 만들기 { employeeNo, name, minutes } → { roomId, hostKey, memberId } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(await createRoom(body ?? {}), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
