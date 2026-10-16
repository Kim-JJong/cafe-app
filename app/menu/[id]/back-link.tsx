"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** 단체 주문 방에서 들어왔으면 방의 메뉴 목록으로, 아니면 메뉴 홈으로 */
export function BackLink() {
  const groupId = useSearchParams().get("group");
  return (
    <Link
      href={groupId ? `/group/${encodeURIComponent(groupId)}/menu` : "/"}
      aria-label="메뉴로 돌아가기"
      className="absolute top-3.5 left-4 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/90 text-base"
    >
      ‹
    </Link>
  );
}
