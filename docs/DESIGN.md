# 사내 카페 주문 앱 설계

> 작성일: 2026-10-16 · 상태: MVP 설계 확정

## 1. 개요

임직원이 휴대폰 브라우저로 사내 카페 음료를 주문하고, 카페 직원이 주문을 접수·제조·픽업 처리한다. 결제는 하지 않으며 **매월 사번별로 정산**한다.

### MVP 범위
- 메뉴 조회 · 옵션 선택 (사이즈, HOT/ICE, 샷 추가 등)
- 장바구니 · 주문 생성 · 일별 주문번호 발급
- 주문 상태 관리 (직원 화면) 및 주문자 화면 반영
- 주문자 식별: 사번 + 이름 직접 입력
- 월 정산 조회 · CSV 다운로드
- 품절 토글

### MVP 제외 (추후)
- 사내 계정 로그인(SSO) — 확장 지점만 설계에 반영 (§6)
- 메뉴 관리 화면 — MVP는 seed 스크립트로 등록
- 정산 마감(마감월 수정 잠금), 알림(푸시/메신저), 통계

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router) + TypeScript | 화면과 API를 한 프로젝트에서 |
| DB | SQLite (WAL 모드) | 파일 하나, 별도 DB 서버 없음 |
| ORM | Prisma | 추후 PostgreSQL 전환 시 설정 위주 변경 |
| 장바구니 | 브라우저 localStorage | 서버 저장 없음 |
| 실시간 갱신 | 폴링 (주문자 5초, 직원 3초) | SSE/WebSocket은 필요 시 추후 |
| 서버 | Rocky Linux 9.5 VM (1 vCPU / 2GB RAM / 20GB) | §11 |

## 3. 아키텍처

```
[임직원 휴대폰]  ──┐
                   ├─ HTTPS ─► Caddy ─► Next.js (systemd) ─► Prisma ─► SQLite
[카페 직원 PC]  ──┘                                                    │
                                                         (매일 cron) ──► VM 외부 백업
```

- 단일 매장, 단일 서버, 단일 프로세스.
- 시간대: DB에는 UTC로 저장하고, 영업일·월 경계 계산은 항상 `Asia/Seoul` 기준으로 코드에서 명시적으로 처리한다 (서버 TZ 설정에 의존하지 않음).
- 금액은 모두 원 단위 정수(`Int`).

## 4. 데이터 모델

```prisma
model Category {
  id        Int        @id @default(autoincrement())
  name      String
  sortOrder Int        @default(0)
  items     MenuItem[]
}

model MenuItem {
  id           Int           @id @default(autoincrement())
  categoryId   Int
  category     Category      @relation(fields: [categoryId], references: [id])
  name         String
  description  String?
  basePrice    Int
  imageUrl     String?
  isAvailable  Boolean       @default(true)   // 품절 토글
  sortOrder    Int           @default(0)
  optionGroups OptionGroup[]
}

model OptionGroup {
  id         Int      @id @default(autoincrement())
  menuItemId Int
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id])
  name       String   // "사이즈", "온도", "샷 추가"
  required   Boolean  @default(false)
  maxSelect  Int      @default(1)
  sortOrder  Int      @default(0)
  options    Option[]
}

model Option {
  id            Int         @id @default(autoincrement())
  optionGroupId Int
  optionGroup   OptionGroup @relation(fields: [optionGroupId], references: [id])
  name          String      // "Large", "ICE"
  extraPrice    Int         @default(0)
  sortOrder     Int         @default(0)
}

model Customer {
  id         Int      @id @default(autoincrement())
  employeeNo String   @unique   // 사번 — 정산 기준 키
  name       String
  // 추후 로그인 도입 시 추가: email, authProviderId
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  orders     Order[]
}

model Order {
  id                   Int         @id @default(autoincrement())
  businessDate         String      // KST 영업일 "2026-10-16"
  orderNumber          Int         // 영업일마다 1부터
  status               String      // OrderStatus (§5), 앱 코드에서 검증
  totalPrice           Int
  customerId           Int
  customer             Customer    @relation(fields: [customerId], references: [id])
  customerNameSnapshot String
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  pickedUpAt           DateTime?
  items                OrderItem[]

  @@unique([businessDate, orderNumber])
  @@index([status])
  @@index([customerId, createdAt])
  @@index([createdAt])
}

model OrderItem {
  id           Int               @id @default(autoincrement())
  orderId      Int
  order        Order             @relation(fields: [orderId], references: [id])
  menuItemId   Int
  nameSnapshot String
  unitPrice    Int               // basePrice + 옵션 합계 (주문 시점)
  quantity     Int
  options      OrderItemOption[]
}

model OrderItemOption {
  id           Int       @id @default(autoincrement())
  orderItemId  Int
  orderItem    OrderItem @relation(fields: [orderItemId], references: [id])
  nameSnapshot String    // "사이즈: Large"
  extraPrice   Int
}
```

### 설계 원칙
- **스냅샷**: 주문 시점의 메뉴명·옵션명·가격·주문자명을 주문 테이블에 복사한다. 메뉴 가격이 바뀌어도 과거 주문과 정산 금액은 변하지 않는다.
- **서버 가격 계산**: 클라이언트는 `menuItemId`, `optionIds`, `quantity`만 보낸다. 금액은 서버가 DB 기준으로 계산한다.
- **주문 생성 검증**: 품절 메뉴 거부, 필수 옵션 누락 거부, `maxSelect` 초과 거부, 다른 메뉴의 옵션 ID 거부, 수량 1~20.
- **주문번호**: 트랜잭션 안에서 해당 영업일의 `max(orderNumber) + 1`. `@@unique` 위반 시 재시도.

## 5. 주문 상태

```
RECEIVED(접수) ─► PREPARING(제조중) ─► READY(픽업대기) ─► PICKED_UP(픽업완료)
    │
    └─► CANCELED(취소)
```

| 현재 | 허용되는 다음 상태 | 주체 |
|---|---|---|
| RECEIVED | PREPARING, CANCELED | 직원 (취소는 주문자도 가능) |
| PREPARING | READY | 직원 |
| READY | PICKED_UP | 직원 |
| PICKED_UP / CANCELED | 없음 (종료) | — |

허용표 밖의 전이는 서버에서 `409`로 거부한다. `PICKED_UP` 전이 시 `pickedUpAt` 기록.

## 6. 주문자 식별과 인증 확장

### MVP: 직접 입력
- 첫 주문 시 사번 + 이름 입력, 브라우저 localStorage에 기억해 다음부터 자동 입력.
- 서버 처리 (`resolveCustomer`):
  - 사번이 없으면 Customer 생성.
  - 사번이 있고 이름이 일치하면 그 Customer 사용.
  - 사번이 있는데 이름이 다르면 **거부** ("사번과 이름이 일치하지 않습니다"). 오타·도용으로 남의 정산에 주문이 잡히는 것을 줄인다. 이름 변경은 직원이 처리.
- 알려진 한계: 남의 사번과 이름을 둘 다 알면 대신 주문할 수 있다. 픽업 시 직원이 이름을 확인하는 것으로 보완하며, 근본 해결은 로그인 도입.

### 추후: 로그인
- 현재 주문자를 알아내는 로직을 `resolveCustomer()` 한 곳에 모은다. 주문·정산 코드는 `customerId`만 사용한다.
- 로그인 도입 시 `resolveCustomer()`가 입력값 대신 세션(Auth.js 등)에서 사번을 꺼내도록 바꾸고, Customer에 `email`/`authProviderId`를 추가한다. 다른 코드는 변경하지 않는다.

## 7. 월 정산

- **대상**: 해당 월(KST 1일 00:00 ~ 말일 24:00)에 `createdAt`이 속하고 상태가 `PICKED_UP`인 주문. 취소·진행 중 주문은 제외.
  - 월 경계 기준은 픽업 시각이 아닌 **주문 시각**. (10/31 23:58 주문 → 11/1 픽업이어도 10월분)
- **금액**: `Order.totalPrice` 합계 (스냅샷이므로 가격 변경 영향 없음).
- **화면**: `/staff/settlement?month=2026-10` — 사번별 주문 수·합계 표, 사번 클릭 시 주문 상세.
- **CSV**: 사번, 이름, 주문 수, 합계. Excel에서 한글이 깨지지 않도록 UTF-8 BOM 포함.
- 진행 중 주문이 남은 월을 조회하면 경고를 표시한다 (월말 직후 정산 시 누락 방지).

## 8. 화면

| 경로 | 사용자 | 내용 |
|---|---|---|
| `/` | 주문자 | 카테고리 탭 + 메뉴 목록 (품절 표시) |
| `/menu/[id]` | 주문자 | 옵션 선택, 수량, 장바구니 담기 |
| `/cart` | 주문자 | 장바구니, 사번/이름 입력, 주문하기 |
| `/orders/[id]` | 주문자 | 주문번호, 진행 상태(5초 폴링), RECEIVED일 때 취소 |
| `/orders` | 주문자 | 내 최근 주문 (localStorage의 사번 기준) |
| `/staff/login` | 직원 | PIN 입력 |
| `/staff` | 직원 | 상태별 칸반(접수/제조중/픽업대기), 다음 단계 버튼, 3초 폴링 |
| `/staff/menu` | 직원 | 품절 토글 |
| `/staff/settlement` | 직원 | 월 정산, CSV 다운로드 |

주문자 화면은 모바일 우선, 직원 화면은 태블릿/PC 기준.

## 9. API

```
GET   /api/menu                         카테고리 + 메뉴 + 옵션 전체
POST  /api/orders                       { employeeNo, name, items: [{ menuItemId, quantity, optionIds[] }] }
GET   /api/orders/:id                   주문 상태
GET   /api/orders?employeeNo=           내 최근 주문
POST  /api/orders/:id/cancel            { employeeNo }  RECEIVED일 때만

POST  /api/staff/login                  { pin }  → 세션 쿠키
POST  /api/staff/logout
GET   /api/staff/orders?status=         직원용 주문 목록
PATCH /api/staff/orders/:id             { status }
PATCH /api/staff/menu/:id               { isAvailable }
GET   /api/staff/settlement?month=      정산 집계
GET   /api/staff/settlement.csv?month=  CSV
```

에러 응답 형식: `{ error: { code, message } }`. 검증 실패 400, 인증 실패 401, 상태 전이 불가 409.

## 10. 직원 인증 (PIN)

- `STAFF_PIN`, `SESSION_SECRET`은 환경변수로 관리 (코드·저장소에 넣지 않음).
- 로그인 성공 시 HMAC 서명된 `httpOnly`, `Secure`, `SameSite=Lax` 쿠키 발급 (유효기간 12시간).
- Next.js middleware에서 `/staff/**`, `/api/staff/**` 요청의 쿠키를 검증.
- PIN 오입력 반복 시 응답 지연(예: 실패마다 1초).

## 11. 운영 (Rocky Linux 9.5)

### 서버 구성
| 항목 | 내용 |
|---|---|
| Node.js | LTS 버전 |
| 프로세스 관리 | systemd 서비스 `cafe.service` (자동 재시작, 전용 사용자 `cafe`) |
| 리버스 프록시 | Caddy (HTTPS, 사내 인증서 또는 내부 CA) |
| 방화벽 | firewalld — 80/443만 개방, Next.js 포트(3000)는 localhost만 |
| SELinux | Enforcing 유지. 프록시→3000 포트 연결 허용 설정 필요 |
| 데이터 경로 | `/var/lib/cafe/cafe.db` |
| 앱 경로 | `/opt/cafe` |
| 환경변수 | `/etc/cafe/cafe.env` (권한 600) |

### 빌드와 배포
- 절차는 [DEPLOY.md](DEPLOY.md).
- 개발 PC(Windows)에는 Docker가 없어 서버와 같은 환경에서 빌드할 곳이 없으므로, **서버에 스왑 2GB를 잡고 서버에서 직접 빌드**한다 (`npm ci` → `next build` → `next start`). 네이티브 모듈(`better-sqlite3`)이 서버 환경에 맞게 설치된다.
  - 추후 CI가 생기면 `rockylinux:9` 컨테이너에서 `output: "standalone"`으로 빌드해 결과물만 올리는 방식으로 바꿀 수 있다.
- DB 스키마 변경은 `prisma migrate deploy`로 적용 (배포 전 백업 필수).

### 백업
- 매일 새벽 cron: `sqlite3 cafe.db ".backup ..."`로 일관된 복사본 생성 → **VM 외부**(다른 서버/스토리지)로 전송.
- 보관: 일별 30일 + 월별 12개월.
- 매월 정산 CSV도 별도 보관.
- 분기마다 복원 테스트.

### 로그
- 앱 로그는 journald로 수집, 크기 제한 설정.

## 12. 구현 단계

| 단계 | 내용 | 완료 확인 |
|---|---|---|
| 1 | 프로젝트 생성, Prisma 스키마, 마이그레이션, seed | seed 후 메뉴·옵션이 DB에 존재 |
| 2 | 메뉴 API + 메뉴 목록/상세 화면 | 브라우저에서 메뉴·옵션 표시, 품절 표시 |
| 3 | 주문 생성 API (가격 계산, 검증, 주문번호, resolveCustomer) | 단위 테스트: 가격 계산, 옵션 검증, 사번/이름 불일치, 주문번호 증가 |
| 4 | 장바구니 + 주문 + 주문 상태 화면 | 실제 주문 → 주문번호 수신 → 상태 페이지 표시 |
| 5 | 직원 PIN 로그인 + 칸반 + 상태 전이 + 품절 토글 | 단위 테스트: 허용/불허 전이. 직원 변경이 주문자 화면에 반영 |
| 6 | 월 정산 화면 + CSV | 단위 테스트: KST 월 경계, 취소 제외. CSV가 Excel에서 정상 표시 |
| 7 | 배포 (Rocky 9.5: systemd, Caddy, firewalld, SELinux, 백업 cron) | 사내망에서 HTTPS 접속, 재부팅 후 자동 기동, 백업 파일 생성·복원 확인 |

## 13. 추후 검토

- 사내 SSO 로그인 (§6)
- 메뉴 관리 화면 (추가/수정/정렬/이미지)
- 정산 마감 및 마감 후 수정 잠금
- 픽업 알림 (사내 메신저 연동 등)
- 사용량 증가 시 PostgreSQL 전환
