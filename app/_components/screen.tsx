import Link from "next/link";
import type { ReactNode } from "react";

/** 주문자 화면 틀: 모바일 폭 한 열, 흰 배경 (디자인의 안드로이드 화면 하나) */
export function Screen({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-md flex-col ${
        dark ? "bg-ink text-white" : "bg-white text-ink"
      }`}
    >
      {children}
    </main>
  );
}

/** "‹ 제목" 형태의 상단 바 */
export function BackHeader({ href, title }: { href: string; title: string }) {
  return (
    <header className="flex items-center gap-3 px-5 pt-3.5 pb-4">
      <Link href={href} aria-label="뒤로" className="-ml-1 px-1 text-lg">
        ‹
      </Link>
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}

/** 하단에 붙는 영역 (주 버튼, 탭바 등) */
export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 mt-auto bg-white">{children}</div>;
}
