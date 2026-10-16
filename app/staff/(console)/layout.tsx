import Link from "next/link";
import { LogoutButton } from "./logout-button";

export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10">
      <header className="flex items-center justify-between border-b border-gray-500/30 py-4">
        <nav className="flex items-center gap-6">
          <span className="font-bold">사내 카페 · 직원</span>
          <Link href="/staff">주문 현황</Link>
          <Link href="/staff/menu">품절 관리</Link>
          <Link href="/staff/settlement">월 정산</Link>
        </nav>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
