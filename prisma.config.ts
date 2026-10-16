import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // 마이그레이션 등 CLI는 커넥션 풀을 거치지 않는 직접 연결을 쓴다 (Neon의 direct 주소).
    // 앱은 lib/prisma.ts에서 DATABASE_URL(풀링 주소)을 쓴다.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
