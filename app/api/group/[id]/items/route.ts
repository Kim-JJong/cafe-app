import { errorResponse } from "@/lib/errors";
import { addItem } from "@/lib/group";

/** 음료 담기 { memberKey, menuItemId, quantity, optionIds } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(await addItem((await params).id, body ?? {}), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
