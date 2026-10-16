// 서버 TZ 설정과 무관하게 한국 시간 기준으로 계산 (DESIGN.md §3)
const kstDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** KST 영업일 "YYYY-MM-DD" */
export function kstBusinessDate(date: Date) {
  return kstDate.format(date);
}

const kstDateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 화면 표시용 KST 일시 */
export function formatKstDateTime(date: Date | string) {
  return kstDateTime.format(new Date(date));
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국은 서머타임이 없어 항상 UTC+9

/** "YYYY-MM" 형식이 아니면 null */
export function parseMonth(value: string | null | undefined) {
  const m = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

/** KST 기준 해당 월의 [시작, 다음 달 시작) — UTC 시각으로 반환 (DESIGN.md §7) */
export function kstMonthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS),
  };
}

/** 현재 KST 월 "YYYY-MM" */
export function currentKstMonth(now = new Date()) {
  return kstBusinessDate(now).slice(0, 7);
}

const kstTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 화면 표시용 KST 시각 "14:20" */
export function formatKstTime(date: Date | string) {
  return kstTime.format(new Date(date));
}

/** 주문 내역 날짜 묶음 이름: 오늘이면 "오늘", 아니면 "10월 15일" */
export function kstDateLabel(date: Date | string, now = new Date()) {
  const day = kstBusinessDate(new Date(date));
  if (day === kstBusinessDate(now)) return "오늘";
  return `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
}

/** "2026-10" → "10월" */
export function monthLabel(month: string) {
  return `${Number(month.slice(5, 7))}월`;
}
