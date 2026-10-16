// 사용자에게 그대로 보여 줄 수 있는 예상된 오류. 응답 형식은 DESIGN.md §9.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL", message: "서버 오류가 발생했습니다." } },
    { status: 500 },
  );
}
