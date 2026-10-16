"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

export type StaffApi = ReturnType<typeof useStaffApi>;

/** 직원 API 호출 함수. 세션이 만료(401)되면 로그인 화면으로 보낸다. */
export function useStaffApi() {
  const router = useRouter();

  return useMemo(() => {
    async function staffFetch(url: string, init?: RequestInit) {
      const res = await fetch(url, { cache: "no-store", ...init });
      if (res.status === 401) {
        router.replace(`/staff/login?next=${encodeURIComponent(window.location.pathname)}`);
      }
      return res;
    }

    function patchJson(url: string, body: unknown) {
      return staffFetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    return { staffFetch, patchJson };
  }, [router]);
}
