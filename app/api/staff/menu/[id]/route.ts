import { AppError, errorResponse } from "@/lib/errors";
import { getMenuItemForStaff, setMenuItemFlags } from "@/lib/menu";
import { parseMenuInput, updateMenuItem } from "@/lib/menu-admin";
import { requireStaff } from "@/lib/staff-auth";

type Context = { params: Promise<{ id: string }> };

async function menuId(params: Context["params"]) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) throw new AppError(404, "NOT_FOUND", "메뉴를 찾을 수 없습니다.");
  return id;
}

/** 수정 화면용 메뉴 상세 */
export async function GET(_request: Request, { params }: Context) {
  try {
    await requireStaff();
    const item = await getMenuItemForStaff(await menuId(params));
    if (!item) throw new AppError(404, "NOT_FOUND", "메뉴를 찾을 수 없습니다.");
    return Response.json(item);
  } catch (e) {
    return errorResponse(e);
  }
}

/** 품절·숨김 토글 { isAvailable?, isHidden? } */
export async function PATCH(request: Request, { params }: Context) {
  try {
    await requireStaff();
    const id = await menuId(params);
    const body = await request.json().catch(() => ({}));
    const flags: { isAvailable?: boolean; isHidden?: boolean } = {};
    if (typeof body?.isAvailable === "boolean") flags.isAvailable = body.isAvailable;
    if (typeof body?.isHidden === "boolean") flags.isHidden = body.isHidden;
    if (Object.keys(flags).length === 0) {
      throw new AppError(400, "VALIDATION", "isAvailable 또는 isHidden 값이 필요합니다.");
    }
    if (!(await setMenuItemFlags(id, flags))) throw new AppError(404, "NOT_FOUND", "메뉴를 찾을 수 없습니다.");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** 메뉴 수정 (이름, 설명, 가격, 분류, 옵션 전체) */
export async function PUT(request: Request, { params }: Context) {
  try {
    await requireStaff();
    const id = await menuId(params);
    const body = await request.json().catch(() => {
      throw new AppError(400, "VALIDATION", "요청 형식이 올바르지 않습니다.");
    });
    await updateMenuItem(id, parseMenuInput(body));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
