import { AppError, errorResponse } from "@/lib/errors";
import { getRoomSnapshot } from "@/lib/group";
import { subscribeGroup } from "@/lib/group-events";

const PING_MS = 25_000; // 프록시가 조용한 연결을 끊지 않도록

/**
 * 단체 주문 방 실시간 알림 (Server-Sent Events).
 * 연결 직후와 변경이 있을 때마다 { room, activity? }를 보낸다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initial = await getRoomSnapshot(id);
  if (!initial) return errorResponse(new AppError(404, "NOT_FOUND", "단체 주문 방을 찾을 수 없습니다."));

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const write = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup(); // 이미 닫힌 연결
        }
      };
      const send = (data: unknown) => write(`data: ${JSON.stringify(data)}\n\n`);

      send({ room: initial });
      const unsubscribe = subscribeGroup(id, async (event) => {
        const room = await getRoomSnapshot(id);
        if (room) send({ room, activity: event.activity });
      });
      const ping = setInterval(() => write(": ping\n\n"), PING_MS);

      cleanup = () => {
        unsubscribe();
        clearInterval(ping);
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      "content-encoding": "none", // 압축하면 이벤트가 모였다가 한꺼번에 전달될 수 있음
    },
  });
}
