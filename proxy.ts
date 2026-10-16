import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, verifySessionToken } from "@/lib/staff-auth";

// 직원 화면 접근 전 로그인 여부를 확인해 로그인 페이지로 보낸다.
// 화면 이동용 확인일 뿐이며, 실제 권한 검사는 각 /api/staff 라우트의 requireStaff()가 한다.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/staff/login") return NextResponse.next();

  if (!verifySessionToken(request.cookies.get(STAFF_COOKIE)?.value)) {
    const url = new URL("/staff/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/staff/:path*"],
};
