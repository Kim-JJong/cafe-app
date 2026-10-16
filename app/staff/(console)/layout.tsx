import Link from "next/link";
import { STORE_NAME } from "@/lib/store-info";
import { LogoutButton } from "./logout-button";

export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className="w-full flex-1 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10">
        <header className="flex items-center justify-between border-b border-gray-500/30 py-4">
          <nav className="flex items-center gap-6">
            <span className="font-bold">{STORE_NAME} · 직원</span>
            <Link href="/staff" className="hover:text-brand">
              주문 현황
            </Link>
            <Link href="/staff/menu" className="hover:text-brand">
              품절 관리
            </Link>
            <Link href="/staff/settlement" className="hover:text-brand">
              월 정산
            </Link>
          </nav>
          <LogoutButton />
        </header>
        {children}
      </div>
    </div>
  );
}
