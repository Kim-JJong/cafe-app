import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// 매 실행마다 빈 test.db를 만들고 마이그레이션을 적용
export default function setup() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(`test.db${suffix}`, { force: true });
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "ignore",
  });
}
