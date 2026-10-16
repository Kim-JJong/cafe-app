import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    env: {
      DATABASE_URL: "file:./test.db", // 개발 DB(dev.db)와 분리
      STAFF_PIN: "test-pin",
      SESSION_SECRET: "test-secret-test-secret-test-sec",
    },
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false, // 테스트 파일들이 같은 SQLite 파일을 공유
  },
});
