# Render + Neon 무료 배포 (포트폴리오용)

카드 등록 없이 무료로 올리는 구성이다. 실제 사내 운영용이 아니라 데모용이다.

```
브라우저 ─HTTPS─► Render 무료 웹 서비스 (Next.js, 싱가포르) ─► Neon 무료 PostgreSQL
```

## 무료 요금제의 한계 (README에 적어 두면 좋음)
- **잠들기:** 15분간 요청이 없으면 서버가 잠든다. 다음 접속 때 깨어나는 데 30초~1분 걸린다.
- **월 사용 시간:** Render 무료 인스턴스는 한 달 사용 시간에 한도가 있다(가입 시 요금 페이지에서 확인).
- **실시간 알림:** 단체 주문 알림(SSE)은 서버 메모리로 전달되므로 인스턴스가 하나일 때만 동작한다. 무료 플랜은 인스턴스 하나라 그대로 동작한다.
- **누구나 접속:** 공개 주소다. 실제 사번·이름을 쓰지 않는다.

## 1. Neon (PostgreSQL)
1. https://neon.tech 가입 → 프로젝트 생성. 리전은 Render와 가까운 **AWS Asia Pacific (Singapore)**.
2. 기본 브랜치(`main`)가 **배포용 DB**가 된다.
3. **개발용**으로 브랜치를 하나 더 만든다(예: `dev`). 그 브랜치의 Databases 메뉴에서 **테스트용 DB**(예: `cafe_test`)를 추가로 만든다. 테스트는 이 DB의 테이블 내용을 지우므로 개발·운영 DB와 따로 둔다.
4. 각 DB의 연결 주소(Connection string)를 복사한다. Neon은 두 종류를 준다.
   - **Pooled**(호스트에 `-pooler`가 붙은 주소): 앱이 쓴다 → `DATABASE_URL`
   - **Direct**(`-pooler` 없는 주소): 마이그레이션이 쓴다 → `DIRECT_URL`

## 2. 개발 PC의 `.env`
```
DATABASE_URL="dev 브랜치의 pooled 주소"
DIRECT_URL="dev 브랜치의 direct 주소"
TEST_DATABASE_URL="dev 브랜치 cafe_test DB의 direct 주소"   # 개발·운영 DB와 반드시 달라야 함 (테스트가 테이블 내용을 지움)
STAFF_PIN="..."
SESSION_SECRET="..."
```
처음 한 번:
```bash
npx prisma migrate deploy
```
```bash
npx prisma db seed
```
이후 `npm run dev`, `npm test`.

## 3. Render
1. https://render.com 가입(GitHub 계정으로). 카드 등록 없이 무료 플랜 사용.
2. **New → Blueprint** → GitHub 저장소 `cafe-app` 선택. 저장소의 `render.yaml`을 읽어 웹 서비스를 만든다.
3. 입력을 요구하는 환경변수를 채운다.
   - `DATABASE_URL`: Neon **main 브랜치**의 pooled 주소
   - `DIRECT_URL`: Neon **main 브랜치**의 direct 주소
   - `STAFF_PIN`: 데모용 직원 PIN (README에 공개해도 되는 값으로)
   - `SESSION_SECRET`: Render가 자동 생성
4. 배포가 시작된다. 빌드 명령이 `prisma migrate deploy`(DB 구조 적용)와 `prisma db seed`(메뉴가 비어 있을 때만 기본 메뉴 등록)를 함께 실행한다.
5. 완료되면 `https://cafe-xxxx.onrender.com` 같은 주소가 생긴다. 이후 `main`에 push하면 자동으로 다시 배포된다.

## 확인
- 메뉴 → 장바구니 → 주문 → `/staff`에서 PIN 로그인 → 상태 변경이 손님 화면에 반영되는지.
- 휴대폰과 PC로 같은 단체 주문 방에 들어가 실시간 알림이 오는지.
- 데이터가 엉망이 되면: Neon 콘솔에서 테이블을 비우고 Render에서 **Manual Deploy**를 하면 seed가 다시 들어간다.
