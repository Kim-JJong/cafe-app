"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import type { RoomSnapshot } from "@/lib/group";
import { groupMemberships, saveMembership, type Membership } from "@/lib/group-membership";
import { customerInfo } from "@/lib/customer-info";
import { formatWon } from "@/lib/price";
import { BackHeader, BottomBar } from "../../_components/screen";

type Room = Omit<RoomSnapshot, "deadlineAt"> & { deadlineAt: string };
type Activity = { id: number; text: string };

const ACTIVITY_MS = 4000;

/** 남은 시간 "07:32". 지났으면 null */
function remaining(deadlineAt: string, now: number) {
  const ms = new Date(deadlineAt).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** SSE로 방 상태를 받아 온다. 연결이 끊기면 브라우저가 알아서 다시 연결한다 */
function useRoom(roomId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const source = new EventSource(`/api/group/${roomId}/events`);
    const timers: ReturnType<typeof setTimeout>[] = [];

    source.onmessage = (e) => {
      const data: { room: Room; activity?: string } = JSON.parse(e.data);
      setRoom(data.room);
      if (data.activity) {
        const activity = { id: nextId.current++, text: data.activity };
        setActivities((list) => [...list.slice(-2), activity]);
        timers.push(setTimeout(() => setActivities((list) => list.filter((a) => a.id !== activity.id)), ACTIVITY_MS));
      }
    };
    source.onerror = () => {
      // 처음 연결부터 실패하면 방이 없는지 확인 (EventSource는 상태 코드를 알려 주지 않음)
      fetch(`/api/group/${roomId}`)
        .then((res) => {
          if (res.status === 404) {
            source.close();
            setNotFound(true);
          }
        })
        .catch(() => {});
    };
    return () => {
      source.close();
      timers.forEach(clearTimeout);
    };
  }, [roomId]);

  return { room, notFound, activities };
}

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
}

export function GroupRoomView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { room, notFound, activities } = useRoom(id);
  const membership = groupMemberships.useValue()[id];
  const now = useNow(room?.status === "OPEN");

  if (notFound) {
    return (
      <>
        <BackHeader href="/" title="단체 주문" />
        <p className="px-5 py-16 text-center text-ink/50">단체 주문 방을 찾을 수 없습니다.</p>
      </>
    );
  }
  if (!room) return <BackHeader href="/" title="단체 주문" />;

  return (
    <>
      <BackHeader href="/" title="단체 주문" />
      <ActivityToasts activities={activities} />
      {membership ? (
        <RoomBody room={room} roomId={id} membership={membership} now={now} />
      ) : (
        <JoinForm room={room} roomId={id} />
      )}
    </>
  );
}

function ActivityToasts({ activities }: { activities: Activity[] }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-14 z-40 mx-auto flex max-w-md flex-col gap-1.5 px-5">
      {activities.map((a) => (
        <p key={a.id} className="rounded-xl bg-ink/90 px-3.5 py-2.5 text-[13px] font-medium text-white shadow-lg">
          {a.text}
        </p>
      ))}
    </div>
  );
}

function JoinForm({ room, roomId }: { room: Room; roomId: string }) {
  const saved = customerInfo.useValue();
  const [name, setName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameValue = name ?? saved?.name ?? "";

  async function join(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/group/${roomId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nameValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "참여하지 못했습니다.");
        return;
      }
      saveMembership(roomId, { memberId: data.memberId, memberKey: data.memberKey, isHost: false });
    } catch {
      setError("네트워크 오류로 참여하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={join} className="flex flex-col gap-4 px-5">
      <section className="rounded-[18px] bg-brand px-[18px] py-5 text-white">
        <p className="text-[13px] opacity-85">단체 주문에 초대받았어요</p>
        <p className="mt-1 text-xl font-semibold">{room.hostName}님이 쏩니다 ☕</p>
      </section>
      {room.status === "ORDERED" ? (
        <p className="py-6 text-center text-ink/50">이미 주문이 끝난 방입니다.</p>
      ) : (
        <>
          <label className="block">
            <span className="text-xs text-ink/55">내 이름 (방장에게 보여요)</span>
            <input
              required
              autoFocus
              maxLength={30}
              value={nameValue}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-ink/12 bg-white px-3 py-2.5 text-sm"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-[14px] bg-brand py-[15px] text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {submitting ? "참여 중…" : "참여하기"}
          </button>
        </>
      )}
    </form>
  );
}

function RoomBody({ room, roomId, membership, now }: { room: Room; roomId: string; membership: Membership; now: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const open = room.status === "OPEN";
  const left = remaining(room.deadlineAt, now);
  const canAdd = open && left !== null;
  const cups = room.items.reduce((sum, i) => sum + i.quantity, 0);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/group/${roomId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("링크를 복사하지 못했습니다. 주소창의 주소를 공유해 주세요.");
    }
  }

  async function remove(itemId: number) {
    setError(null);
    const res = await fetch(`/api/group/${roomId}/items/${itemId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberKey: membership.memberKey }),
    }).catch(() => null);
    if (!res) setError("네트워크 오류로 빼지 못했습니다.");
    else if (!res.ok) setError((await res.json()).error?.message ?? "빼지 못했습니다.");
  }

  async function order() {
    if (!confirm(`${cups}잔, ${formatWon(room.total)}을 주문할까요? 주문 후에는 취소할 수 없어요.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/group/${roomId}/order`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hostKey: membership.memberKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "주문하지 못했습니다.");
        return;
      }
      router.push(`/orders/${data.orderId}`);
    } catch {
      setError("네트워크 오류로 주문하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-5 pb-4">
        <section className="flex flex-col gap-3 rounded-[18px] bg-brand px-[18px] py-4 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium opacity-85">
              {room.status === "ORDERED" ? "주문 완료" : left ? `마감까지 ${left}` : "담기 마감"}
            </span>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"
            >
              {copied ? "복사했어요" : "링크 복사"}
            </button>
          </div>
          <p className="text-xl font-semibold">{room.hostName}님이 쏩니다 ☕</p>
          <p className="text-[13px] opacity-85">
            {cups}잔 · {formatWon(room.total)}
          </p>
        </section>

        {room.status === "ORDERED" && room.orderId && (
          <Link
            href={`/orders/${room.orderId}`}
            className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3.5 text-white"
          >
            <span className="text-sm font-semibold">대기번호 {room.orderNumber}</span>
            <span className="text-[13px] opacity-80">주문 현황 보기 ›</span>
          </Link>
        )}

        {room.members.map((member) => {
          const items = room.items.filter((i) => i.memberId === member.id);
          const mine = member.id === membership.memberId;
          return (
            <section key={member.id} className="rounded-[18px] border border-ink/[.08] p-[15px]">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                {member.name}
                {member.isHost && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">방장</span>}
                {mine && <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] text-ink/60">나</span>}
              </h2>
              {items.length === 0 ? (
                <p className="mt-1.5 text-[12.5px] text-ink/40">아직 고르는 중…</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13.5px] font-medium">
                          {item.name} {item.quantity > 1 && <span className="text-ink/50">× {item.quantity}</span>}
                        </p>
                        {item.optionLabels && <p className="text-xs text-ink/50">{item.optionLabels}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-[13px]">{formatWon(item.unitPrice * item.quantity)}</span>
                        {open && (mine || membership.isHost) && (
                          <button
                            type="button"
                            onClick={() => remove(item.id)}
                            aria-label={`${member.name}의 ${item.name} 빼기`}
                            className="text-xs text-ink/40"
                          >
                            빼기
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      {open && (
        <BottomBar>
          <div className="flex gap-2 px-5 pt-3.5 pb-2.5">
            {canAdd && (
              <Link
                href={`/group/${roomId}/menu`}
                className={`rounded-[14px] py-[15px] text-center text-[15px] font-semibold ${
                  membership.isHost ? "flex-1 border border-ink/12" : "w-full bg-brand text-white"
                }`}
              >
                ＋ 음료 담기
              </Link>
            )}
            {membership.isHost && (
              <button
                type="button"
                onClick={order}
                disabled={busy || cups === 0}
                className="flex-[1.4] rounded-[14px] bg-ink py-[15px] text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {busy ? "주문 중…" : `${cups}잔 주문하기`}
              </button>
            )}
          </div>
          {!canAdd && !membership.isHost && (
            <p className="px-5 pb-4 text-center text-[13px] text-ink/50">마감되었어요. 방장의 주문을 기다려 주세요.</p>
          )}
        </BottomBar>
      )}
    </>
  );
}
