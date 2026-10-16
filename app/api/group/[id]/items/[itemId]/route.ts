import { AppError, errorResponse } from "@/lib/errors";
import { removeItem } from "@/lib/group";

/** 음료 빼기 { memberKey } — 본인 항목 또는 방장 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id, itemId } = await params;
    const itemNo = Number(itemId);
    if (!Number.isInteger(itemNo)) throw new AppError(404, "NOT_FOUND", "항목을 찾을 수 없습니다.");
    const body = await request.json().catch(() => ({}));
    await removeItem(id, itemNo, body?.memberKey);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
