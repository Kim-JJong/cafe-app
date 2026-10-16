import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config(); // .env의 TEST_DATABASE_URL을 읽는다

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    env: {
      // 테스트는 전용 DB를 쓴다. 실행할 때마다 비우므로 개발·운영 DB와 반드시 달라야 한다 (test/global-setup.ts)
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      STAFF_PIN: "test-pin",
      SESSION_SECRET: "test-secret-test-secret-test-sec",
    },
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false, // 테스트 파일들이 같은 DB를 공유
    testTimeout: 30_000, // 원격 DB(Neon) 왕복 지연을 고려
    hookTimeout: 30_000,
  },
});
