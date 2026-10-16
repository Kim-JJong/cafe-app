import { execSync } from "node:child_process";
import { config } from "dotenv";

config();

/**
 * 테스트 전용 DB에 아직 적용되지 않은 마이그레이션만 적용한다 (DB를 통째로 지우지 않음).
 * 데이터는 각 테스트 파일이 beforeEach에서 필요한 테이블만 비운다.
 */
export default function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(".env에 TEST_DATABASE_URL(테스트 전용 PostgreSQL 주소)을 설정해 주세요.");
  }
  // 개발·운영 DB를 지우는 사고를 막는다
  if (testUrl === process.env.DATABASE_URL || testUrl === process.env.DIRECT_URL) {
    throw new Error("TEST_DATABASE_URL이 DATABASE_URL/DIRECT_URL과 같습니다. 테스트 전용 DB를 따로 만들어 주세요.");
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DIRECT_URL: testUrl, DATABASE_URL: testUrl },
    stdio: "ignore",
  });
}
