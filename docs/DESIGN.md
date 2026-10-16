# 사내 카페 주문 앱 설계

> 작성일: 2026-10-16 · 상태: MVP 설계 확정

## 1. 개요

임직원이 휴대폰 브라우저로 사내 카페 음료를 주문하고, 카페 직원이 주문을 접수·제조·픽업 처리한다. 결제는 하지 않으며 **매월 사번별로 정산**한다.

### MVP 범위
- 메뉴 조회 · 옵션 선택 (HOT/ICE, 연하게, 얼음 많이/적게 — §8)
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
RECEIVED(주문 확정) ─► PREPARING(제조중) ─► READY(픽업대기) ─► PICKED_UP(픽업완료)
```

주문은 들어오는 즉시 확정되며 **주문자·직원 모두 취소할 수 없다.**
`CANCELED`는 취소 기능이 있던 때의 기존 주문을 표시하기 위해서만 남아 있다 (새로 만들 수 없음).

| 현재 | 허용되는 다음 상태 | 주체 |
|---|---|---|
| RECEIVED | PREPARING | 직원 |
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
| `/` | 주문자 | 인사, 카테고리 칩 필터, 메뉴 카드(품절 표시), 장바구니 바 |
| `/menu/[id]` | 주문자 | 옵션 선택, 수량, 장바구니 담기 |
| `/cart` | 주문자 | 장바구니, 수량 변경/삭제, 결제 예정액 → 주문서 확인 |
| `/checkout` | 주문자 | 픽업 정보, 사번/이름 입력, 급여 공제 안내·동의, 주문하기 |
| `/orders/[id]` | 주문자 | 대기번호(=일별 주문번호), 앞의 대기 팀 수, 3단계 진행 바(5초 폴링) |
| `/orders` | 주문자 | 날짜별 주문 내역 (localStorage의 사번 기준) |
| `/status` | 주문자 | 진행 중인 가장 최근 주문의 대기번호 화면으로 이동 |
| `/me` | 주문자 | 이번 달 급여 공제 예정액(이 화면에서만 표시), 이 기기에 저장된 사번/이름 확인·변경·삭제 |
| `/staff/login` | 직원 | PIN 입력 |
| `/staff` | 직원 | 상태별 칸반(접수/제조중/픽업대기), 다음 단계 버튼, 3초 폴링 |
| `/staff/menu` | 직원 | 품절 토글 |
| `/staff/settlement` | 직원 | 월 정산, CSV 다운로드 |

주문자 화면은 모바일 우선, 직원 화면은 태블릿/PC 기준.

### 디자인
- 원본: claude.ai/design 프로젝트 "사내 카페 음료 주문앱" (https://claude.ai/design/p/b5b66311-3f48-45b1-b4be-6235f1ae689a) 의 손님용 6화면.
- 라이트 테마 고정. 대기번호 화면만 어두운 배경. 글꼴 Pretendard(`app/fonts`, 400/500/600/700), 브랜드색 `#B4552D`. 색 이름은 `app/globals.css`의 `@theme`.
- 하단 탭바(주문/현황/내역/내정보)는 `/`, `/status`, `/orders`, `/me`에만 둔다.
- 음료 완료 팝업: 주문이 READY가 되면 주문 홈(`/`, 내 주문을 5초 폴링)과 대기번호 화면(`/orders/[id]`, 현황 탭이 여기로 이동)에 팝업과 진동(지원 기기만). 확인한 주문 ID는 이 기기에 기억해 한 번만 띄운다 (`lib/ready-notice.ts`).
- 장바구니 수량이 1일 때 −를 누르면 그 항목을 삭제한다.
- 매장 이름·위치 문구는 `lib/store-info.ts` 한 곳에서 관리 (A-라운지 / 본사 4층).
- 디자인에 있지만 넣지 않은 것: 월 한도, 개인컵 할인, 바리스타 메모, 오늘의 추천·판매량, 예상 대기 시간. 음료 사진은 `imageUrl`이 있으면 표시하고 없으면 줄무늬 자리 표시.

### 메뉴 옵션
- **필수는 온도(HOT/ICE) 하나**, 나머지는 모두 선택. 화면에 "필수" / "선택" 표시.

| 옵션 | 선택지 | 추가 금액 | 메뉴 |
|---|---|---|---|
| 온도 (필수) | HOT / ICE | 없음 | 에이드 외 전체 |
| 농도 | 연하게 | 없음 | 에이드 외 전체 |
| 얼음 | 얼음 많이 / 얼음 적게 | 없음 | 전체 (ICE일 때만) |
| 우유 변경 | 락토프리 우유 / 저지방 우유 | 락토프리 +500원 | 카페라떼, 바닐라라떼, 카페모카, 초코라떼, 녹차라떼 |
| 크림 | 크림 많이 / 크림 적게 | 없음 | 카페모카, 초코라떼, 바닐라라떼 |

- 메뉴와 옵션은 `prisma/seed.ts`에서 정의한다. seed는 메뉴가 이미 있으면 건너뛰므로, 옵션을 바꾼 뒤 기존 DB에 반영하려면 메뉴 테이블(Category, MenuItem, OptionGroup, Option)을 비우고 다시 seed한다. 주문·단체 주문 기록은 이름·가격 스냅샷이라 영향이 없지만, 아직 주문하지 않은 단체 주문 방의 담긴 음료는 메뉴 ID가 바뀌어 주문할 때 실패한다.
- 얼음 옵션은 ICE를 골랐을 때만 고를 수 있다. HOT/ICE 선택지가 없는 ICE 전용 메뉴(에이드)는 항상 가능. 규칙은 `lib/option-rules.ts` 하나를 화면과 서버 검증이 함께 쓴다.
- 화면 표현: 선택지가 둘 이상인 그룹은 버튼 묶음, 하나뿐인 그룹은 "추가 옵션" 스위치.

## 9. API

```
GET   /api/menu                         카테고리 + 메뉴 + 옵션 전체
POST  /api/orders                       { employeeNo, name, items: [{ menuItemId, quantity, optionIds[] }] }
GET   /api/orders/:id                   주문 상태 + aheadCount(먼저 들어와 접수/제조중인 주문 수)
GET   /api/orders?employeeNo=           내 최근 주문 (항목 이름·수량 포함)
GET   /api/orders/summary?employeeNo=   이번 달(KST) 공제 예정액 — 정산과 같은 기준(픽업 완료)

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

## 12. 단체 주문 (팀원 커피 쏘기)

한 명(방장)이 방을 만들어 링크를 공유하면, 팀원이 이름만 넣고 들어와 각자 음료를 담는다. 누가 들어오고 무엇을 담았는지 모두의 화면에 실시간으로 뜬다. 방장이 주문하면 **방장 사번의 일반 주문 1건**(대기번호 하나, 방장 급여 공제)이 된다.

### 흐름
1. 방장: 홈의 "팀원 커피 쏘기" → `/group/new`에서 사번·이름, 담기 마감(5/10/15/30/60분) → 방 생성 → `/group/[id]` 링크 공유
2. 팀원: 링크 접속 → 이름 입력해 참여 → "음료 담기"(`/group/[id]/menu` → `/menu/[id]?group=방ID`) → 방에 담김
3. 방장: "N잔 주문하기" → 주문 생성, 대기번호 화면으로 이동. 팀원 화면에도 "주문 완료 · 대기번호" 표시
4. 마감 후에는 담기·빼기 불가. 방장은 마감 전후 언제든 주문 가능. 주문 후에는 방이 닫힌다

### 규칙
- 팀원은 이름만 입력 (사번 불필요, 결제자가 아니므로). 방장 사번·이름은 일반 주문과 같은 규칙으로 확인.
- 본인이 담은 음료는 본인이, 모든 음료는 방장이 뺄 수 있다.
- 담기는 일반 주문과 같은 검증(품절, 옵션 규칙)을 거치고, 주문할 때 한 번 더 검증한다 (그사이 품절되면 주문 실패 → 방이 다시 열림).
- 방 하나에 최대 50개 항목. 주문은 직원 칸반에 일반 주문과 똑같이 보인다 (누구 음료인지는 표시하지 않음).

### 식별과 권한
- 방 ID는 추측하기 어려운 무작위 값 (링크를 아는 사람만 참여).
- 참여할 때 받은 `memberKey`, 방장의 `hostKey`는 각자의 브라우저 localStorage(`cafe.groups`)에만 저장되고, 화면에 내려주는 방 상태에는 포함하지 않는다.

### 실시간 (SSE)
- `GET /api/group/[id]/events`: 연결 직후와 변경(참여, 담기, 빼기, 주문) 때마다 `{ room, activity? }`를 보낸다. `activity`는 "이대리님이 카페라떼을(를) 담았어요" 같은 알림 문구.
- 브라우저는 `EventSource`로 받으며, 끊기면 자동으로 다시 연결된다. 25초마다 ping으로 프록시가 연결을 끊지 않게 한다.
- 구독자 목록은 **서버 메모리**에 있으므로 서버가 **한 프로세스**로 돌 때만 동작한다 (현재 VM 구성). 여러 프로세스로 늘리면 Redis 등 공용 메시지 채널이 필요하다.

### API
```
POST   /api/group                         { employeeNo, name, minutes } → { roomId, hostKey, memberId }
GET    /api/group/:id                     방 상태
GET    /api/group/:id/events              SSE
POST   /api/group/:id/members             { name, memberKey? } → { memberId, memberKey }
POST   /api/group/:id/items               { memberKey, menuItemId, quantity, optionIds }
DELETE /api/group/:id/items/:itemId       { memberKey }  본인 항목 또는 방장
POST   /api/group/:id/order               { hostKey } → { orderId, orderNumber }
```

## 13. 구현 단계

| 단계 | 내용 | 완료 확인 |
|---|---|---|
| 1 | 프로젝트 생성, Prisma 스키마, 마이그레이션, seed | seed 후 메뉴·옵션이 DB에 존재 |
| 2 | 메뉴 API + 메뉴 목록/상세 화면 | 브라우저에서 메뉴·옵션 표시, 품절 표시 |
| 3 | 주문 생성 API (가격 계산, 검증, 주문번호, resolveCustomer) | 단위 테스트: 가격 계산, 옵션 검증, 사번/이름 불일치, 주문번호 증가 |
| 4 | 장바구니 + 주문 + 주문 상태 화면 | 실제 주문 → 주문번호 수신 → 상태 페이지 표시 |
| 5 | 직원 PIN 로그인 + 칸반 + 상태 전이 + 품절 토글 | 단위 테스트: 허용/불허 전이. 직원 변경이 주문자 화면에 반영 |
| 6 | 월 정산 화면 + CSV | 단위 테스트: KST 월 경계, 취소 제외. CSV가 Excel에서 정상 표시 |
| 7 | 배포 (Rocky 9.5: systemd, Caddy, firewalld, SELinux, 백업 cron) | 사내망에서 HTTPS 접속, 재부팅 후 자동 기동, 백업 파일 생성·복원 확인 |

## 14. 추후 검토

- 사내 SSO 로그인 (§6)
- 메뉴 관리 화면 (추가/수정/정렬/이미지)
- 정산 마감 및 마감 후 수정 잠금
- 픽업 알림 (사내 메신저 연동 등)
- 사용량 증가 시 PostgreSQL 전환
