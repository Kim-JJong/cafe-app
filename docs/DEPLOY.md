# 배포 가이드 (Rocky Linux 9.5)

> 대상 서버: 1 vCPU / 2GB RAM / 20GB 디스크 VM · 설계 배경은 [DESIGN.md §11](DESIGN.md#11-운영-rocky-linux-95)

> ⚠️ **이 문서는 SQLite 버전(git 태그 `sqlite-vm`) 기준입니다.** 지금 `main`은 PostgreSQL을 씁니다. 이 문서대로 지금 코드를 VM에 올리려면 PostgreSQL 설치(또는 Neon 같은 외부 DB), `DATABASE_URL`/`DIRECT_URL` 설정, 백업을 `pg_dump`로 바꾸는 작업이 필요합니다. 무료 포트폴리오 배포는 [DEPLOY-RENDER.md](DEPLOY-RENDER.md)를 보세요.

이 문서는 아직 실제 서버에서 검증하지 않은 절차입니다. 처음 배포할 때 각 단계의 **확인** 항목을 실행해 보고, 다른 점이 있으면 이 문서를 고쳐 주세요.

## 0. 구성 요약

```
[사내 브라우저] ─HTTPS─► Caddy(:443) ─► Next.js(127.0.0.1:3000, systemd) ─► SQLite(/var/lib/cafe/cafe.db)
                                                                                     │
                                                                  매일 03:00 cron ───┴─► VM 외부 백업
```

| 경로 | 용도 | 소유자 |
|---|---|---|
| `/opt/cafe` | 앱 소스와 빌드 결과 | `cafe` |
| `/var/lib/cafe/cafe.db` | 데이터베이스 | `cafe` |
| `/etc/cafe/cafe.env` | 환경변수(비밀값) | `root:cafe`, 640 |
| `/var/backups/cafe` | 로컬 백업 (외부로 복사하기 전 임시 보관) | `cafe` |

**빌드 방식:** 이 가이드는 가장 단순한 방법인 **서버에서 직접 빌드**(`npm ci` → `next build` → `next start`)를 씁니다. RAM 2GB에서는 빌드 중 메모리가 부족할 수 있으니 1단계에서 스왑을 잡습니다.

**사전 조건:** 빌드할 때 서버가 npm 레지스트리에 접속할 수 있어야 합니다(`npm ci`). 사내망에서 외부 접속이 막혀 있으면 npm 프록시나 사내 미러 설정이 필요합니다. 글꼴(Pretendard)은 프로젝트에 포함돼 있어 외부 글꼴 서버에는 접속하지 않습니다.

---

## 1. 서버 준비 (최초 1회, root)

```bash
dnf -y update
dnf -y install git sqlite tar gcc-c++ make python3
```

`gcc-c++ make python3`는 `better-sqlite3`의 미리 빌드된 바이너리를 받지 못할 때 소스를 컴파일하기 위한 대비입니다.

### 스왑 2GB

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap defaults 0 0' >> /etc/fstab
```

**확인:** `free -h`에서 Swap이 2.0Gi로 보이면 됩니다.

### 전용 사용자와 디렉터리

```bash
useradd --system --home-dir /var/lib/cafe --shell /sbin/nologin cafe
mkdir -p /opt/cafe /var/lib/cafe /var/backups/cafe /etc/cafe
chown cafe:cafe /opt/cafe /var/lib/cafe /var/backups/cafe
```

## 2. Node.js 24 LTS 설치

개발 PC와 같은 메이저 버전(v24)을 씁니다. 먼저 OS 저장소에 있는지 확인합니다.

```bash
dnf module list nodejs
```

- 목록에 `24`가 있으면: `dnf -y module install nodejs:24`
- 없으면 nodejs.org의 공식 Linux x64 바이너리를 `/usr/local`에 풉니다. `<버전>`은 nodejs.org에서 최신 v24.x를 확인해 넣습니다.

```bash
curl -fsSLO https://nodejs.org/dist/v<버전>/node-v<버전>-linux-x64.tar.xz
tar -xJf node-v<버전>-linux-x64.tar.xz -C /usr/local --strip-components=1
```

**확인:** `node -v`가 v24.x, `npm -v`가 11.x 이상. 이후 단계에서는 `which node`로 나온 경로(`/usr/bin/node` 또는 `/usr/local/bin/node`)를 씁니다.

## 3. 환경변수 파일

```bash
cat > /etc/cafe/cafe.env <<'EOF'
NODE_ENV=production
DATABASE_URL=file:/var/lib/cafe/cafe.db
STAFF_PIN=여기에_직원_PIN
SESSION_SECRET=여기에_비밀키
EOF
chown root:cafe /etc/cafe/cafe.env
chmod 640 /etc/cafe/cafe.env
```

- `SESSION_SECRET` 생성: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
- `STAFF_PIN`은 개발용 `.env` 값을 재사용하지 말고 새로 정합니다.
- 값을 바꾸면 `systemctl restart cafe`가 필요합니다. `SESSION_SECRET`을 바꾸면 모든 직원이 다시 로그인해야 합니다.

## 4. 소스 올리기

원격 저장소가 아직 없으므로, 개발 PC에서 커밋된 내용만 묶어 보냅니다. 이렇게 하면 `.env`, DB, `node_modules`는 빠집니다.

```bash
git archive -o cafe.tar.gz HEAD
scp cafe.tar.gz <서버>:/tmp/
```

서버에서:

```bash
sudo -u cafe tar -xzf /tmp/cafe.tar.gz -C /opt/cafe
```

원격 저장소를 만든 뒤에는 `sudo -u cafe git clone <저장소> /opt/cafe`로 바꾸고, 업데이트는 `git pull`로 합니다.

## 5. 설치 · 빌드 · DB 준비 (cafe 사용자)

이후 명령은 환경변수를 불러온 셸에서 `cafe` 사용자로 실행합니다.

```bash
sudo -u cafe bash -c 'cd /opt/cafe && set -a && . /etc/cafe/cafe.env && set +a && exec bash'
```

그 셸 안에서:

```bash
npm ci                     # package.json의 allowScripts에 등록된 설치 스크립트만 실행됨
npx prisma generate        # Prisma 7은 설치 시 클라이언트를 자동 생성하지 않음
npx prisma migrate deploy  # /var/lib/cafe/cafe.db 생성 및 스키마 적용
npx prisma db seed         # 최초 1회: 메뉴 등록 + WAL 모드 켜기 (메뉴가 있으면 건너뜀)
npm run build
exit
```

**확인:**
- `npm ci` 끝에 `install-scripts ... not yet covered` 경고가 없어야 합니다. 있으면 그 패키지가 설치되지 않은 것입니다.
- `sqlite3 /var/lib/cafe/cafe.db "PRAGMA journal_mode;"` → `wal`
- `sqlite3 /var/lib/cafe/cafe.db "select count(*) from MenuItem;"` → 9

## 6. systemd 서비스

`/etc/systemd/system/cafe.service` (`ExecStart`의 node 경로는 2단계에서 확인한 경로로):

```ini
[Unit]
Description=Cafe order app (Next.js)
After=network.target

[Service]
Type=simple
User=cafe
Group=cafe
WorkingDirectory=/opt/cafe
EnvironmentFile=/etc/cafe/cafe.env
ExecStart=/usr/bin/node /opt/cafe/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/var/lib/cafe

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now cafe
```

**확인:** `curl -s http://127.0.0.1:3000/api/menu | head -c 200`에 메뉴 JSON이 나오면 됩니다. 로그는 `journalctl -u cafe -f`로 봅니다.

`-H 127.0.0.1`로 띄우므로 앱은 서버 밖에서 직접 접속할 수 없고, 반드시 Caddy를 거칩니다.

## 7. Caddy (HTTPS 리버스 프록시)

```bash
dnf -y install 'dnf-command(copr)'
dnf -y copr enable @caddy/caddy
dnf -y install caddy
```

`/etc/caddy/Caddyfile` — 사내 도메인 이름과 인증서 방식은 환경에 맞게 하나를 고릅니다.

```caddyfile
cafe.사내도메인 {
    # (A) 회사 인증서가 있으면
    tls /etc/caddy/certs/cafe.crt /etc/caddy/certs/cafe.key
    # (B) 없으면 Caddy 내부 CA 사용. 직원 PC/폰이 Caddy 루트 인증서를 신뢰해야 경고가 사라짐
    # tls internal

    # 단체 주문 실시간 알림(SSE)은 압축하면 모였다가 늦게 전달될 수 있어 압축에서 뺀다
    @not_sse not path /api/group/*/events
    encode @not_sse gzip
    reverse_proxy 127.0.0.1:3000
}
```

```bash
systemctl enable --now caddy
```

> **단체 주문 실시간 알림 확인:** 두 기기에서 같은 단체 주문 방에 들어가, 한쪽에서 음료를 담으면 다른 쪽에 바로 "○○님이 … 담았어요"가 뜨는지 봅니다. 늦게 뜨거나 한꺼번에 뜨면 프록시가 응답을 모으고 있는 것입니다. 이 알림은 서버 메모리로 전달되므로 앱은 **한 프로세스**로만 실행합니다(이 가이드의 systemd 구성 그대로).

> **HTTPS는 필수입니다.** 운영 모드에서는 직원 로그인 쿠키에 `Secure` 속성이 붙어서, `http://`로 접속하면 브라우저가 쿠키를 저장하지 않습니다. 그러면 PIN이 맞아도 직원 화면에 들어갈 수 없습니다.

### SELinux

SELinux는 Enforcing으로 유지합니다. 사이트에서 502 오류가 나면 프록시가 3000 포트 연결을 거부당했는지 확인합니다.

```bash
ausearch -m avc -ts recent | grep -i caddy
```

거부 기록이 있으면 웹 서버의 내부 네트워크 연결을 허용합니다.

```bash
setsebool -P httpd_can_network_connect 1
```

### 방화벽

```bash
firewall-cmd --permanent --add-service=http --add-service=https
firewall-cmd --reload
```

3000 포트는 열지 않습니다.

**확인:** 사내 PC에서 `https://cafe.사내도메인` 메뉴 화면, `https://cafe.사내도메인/staff` PIN 로그인 후 칸반 화면이 열리면 됩니다.

## 8. 백업

### 매일 백업 스크립트

`/usr/local/bin/cafe-backup.sh`:

```bash
#!/bin/bash
set -euo pipefail
DIR=/var/backups/cafe
DAY=$(date +%F)

# 실행 중에도 일관된 복사본을 만드는 SQLite 내장 백업
sqlite3 /var/lib/cafe/cafe.db ".backup '$DIR/cafe-$DAY.db'"

# 매월 1일 백업은 월별 보관용으로 따로 복사
if [ "$(date +%d)" = "01" ]; then cp "$DIR/cafe-$DAY.db" "$DIR/monthly-$(date +%Y-%m).db"; fi

# 보관 기간: 일별 30일, 월별 12개월
find "$DIR" -name 'cafe-*.db' -mtime +30 -delete
find "$DIR" -name 'monthly-*.db' -mtime +366 -delete

# VM 밖으로 복사 — 대상 서버와 경로는 환경에 맞게 수정 (SSH 키 등록 필요)
rsync -a "$DIR"/ backup-user@백업서버:/backups/cafe/
```

cron이 `cafe` 사용자로 실행하므로, `rsync`용 SSH 키는 `cafe` 사용자의 것(`/var/lib/cafe/.ssh/`)을 백업 서버에 등록합니다.

```bash
chmod 755 /usr/local/bin/cafe-backup.sh
echo '0 3 * * * cafe /usr/local/bin/cafe-backup.sh' > /etc/cron.d/cafe-backup
```

**같은 VM 안의 백업만으로는 부족합니다.** VM이 망가지면 함께 사라지므로 `rsync` 대상은 반드시 다른 서버나 스토리지로 정합니다.

**확인:** 한 번 직접 실행(`sudo -u cafe /usr/local/bin/cafe-backup.sh`)해서 로컬과 원격 양쪽에 파일이 생기는지 봅니다.

### 복원 절차 (분기마다 연습 권장)

```bash
systemctl stop cafe
cp /var/lib/cafe/cafe.db /var/lib/cafe/cafe.db.before-restore   # 혹시 모를 되돌리기용
rm -f /var/lib/cafe/cafe.db-wal /var/lib/cafe/cafe.db-shm
cp /var/backups/cafe/cafe-YYYY-MM-DD.db /var/lib/cafe/cafe.db
chown cafe:cafe /var/lib/cafe/cafe.db
systemctl start cafe
```

### 월 정산 CSV

매월 초 직원 화면의 **월 정산 → CSV 다운로드**로 전월 파일을 받아 별도로 보관합니다. DB 백업과 별개인 두 번째 기록이 됩니다.

## 9. 로그 크기 제한

`/etc/systemd/journald.conf`에서:

```ini
SystemMaxUse=500M
```

```bash
systemctl restart systemd-journald
```

## 10. 업데이트 배포

```bash
# 1) 백업 먼저
sudo -u cafe /usr/local/bin/cafe-backup.sh

# 2) 새 소스 반영 (4단계와 같은 방법, 또는 git pull)

# 3) 서비스 중지 — 실행 중인 앱이 DB를 열고 있으면 마이그레이션이 "database is locked"로 실패한다
systemctl stop cafe

# 4) 설치 · 마이그레이션 · 빌드 (5단계의 cafe 셸 안에서)
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

# 5) 시작
systemctl start cafe
```

중지부터 시작까지(빌드 포함 수 분) 주문을 받을 수 없으므로 카페 영업이 끝난 뒤에 합니다. 이때 진행 중인 단체 주문 방의 실시간 연결도 끊기며, 서비스가 다시 뜨면 브라우저가 자동으로 다시 연결합니다.

## 11. 최종 점검 체크리스트

- [ ] 사내 PC/폰에서 HTTPS로 메뉴 화면 접속
- [ ] 주문 → 직원 칸반에 표시 → 상태 변경이 주문자 화면에 반영
- [ ] `http://`가 아닌 `https://`에서 직원 PIN 로그인 유지
- [ ] `reboot` 후 `systemctl status cafe caddy`가 모두 active
- [ ] 백업 파일이 로컬과 VM 외부에 생성됨
- [ ] 백업 파일로 복원 연습 1회 완료
- [ ] 3000 포트가 외부에서 열려 있지 않음 (`firewall-cmd --list-all`)
