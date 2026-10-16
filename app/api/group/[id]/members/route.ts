import { errorResponse } from "@/lib/errors";
import { joinRoom } from "@/lib/group";

/** 참여 { name, memberKey? } → { memberId, memberKey } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(await joinRoom((await params).id, body ?? {}));
  } catch (e) {
    return errorResponse(e);
  }
}
