import { AppError, errorResponse } from "@/lib/errors";
import { setMenuItemAvailability } from "@/lib/menu";
import { requireStaff } from "@/lib/staff-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff();
    const id = Number((await params).id);
    const body = await request.json().catch(() => ({}));
    if (typeof body?.isAvailable !== "boolean") {
      throw new AppError(400, "VALIDATION", "isAvailable 값이 필요합니다.");
    }
    if (!Number.isInteger(id) || !(await setMenuItemAvailability(id, body.isAvailable))) {
      throw new AppError(404, "NOT_FOUND", "메뉴를 찾을 수 없습니다.");
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
