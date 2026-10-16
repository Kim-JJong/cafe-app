"use client";

import { createLocalStore } from "@/lib/local-store";

/** 이 브라우저가 참여한 단체 주문 방. memberKey는 본인 확인용 비밀값 (방장은 hostKey) */
export type Membership = { memberId: number; memberKey: string; isHost: boolean };

export const groupMemberships = createLocalStore<Record<string, Membership>>("cafe.groups", {});

export function saveMembership(roomId: string, membership: Membership) {
  groupMemberships.write({ ...groupMemberships.read(), [roomId]: membership });
}
