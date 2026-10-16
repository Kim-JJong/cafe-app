"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);

const TABS = [
  { href: "/", label: "주문", icon: icon(<><path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" /><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" /><path d="M9 3v2M13 3v2" /></>) },
  { href: "/status", label: "현황", icon: icon(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>) },
  { href: "/orders", label: "내역", icon: icon(<><path d="M7 4h10v16H7z" /><path d="M10 9h4M10 13h4" /></>) },
  { href: "/me", label: "내정보", icon: icon(<><circle cx="12" cy="9" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>) },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="flex justify-around border-t border-ink/[.07] pt-2 pb-1">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-14 flex-col items-center gap-[3px] text-[10.5px] ${
              active ? "font-semibold text-brand" : "font-medium text-ink/40"
            }`}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
