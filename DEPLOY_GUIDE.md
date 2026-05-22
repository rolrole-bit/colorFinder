# 🌐 DYE MASTER 온라인 배포 가이드

## 배포 옵션 비교

| 항목 | **A. Render.com (권장)** | **B. Linux VPS** |
|------|------------------------|-------------------|
| 난이도 | ⭐ 매우 쉬움 | ⭐⭐⭐ 중간 |
| 비용 | 무료 ~ $7/월 | $5~10/월 |
| HTTPS | ✅ 자동 | 🔧 스크립트 자동 설정 |
| 도메인 | 기본 `*.onrender.com` 무료 | 별도 구매 필요 |

---

## 옵션 A: Render.com 배포 (5분)

### 1단계: Render 가입
1. https://render.com 접속 → 회원가입 (GitHub 계정 연동 권장)

### 2단계: GitHub 저장소 연결
1. 이 프로젝트를 GitHub에 push
2. Render 대시보드 → **New** → **Web Service**
3. GitHub 저장소 선택

### 3단계: 설정
```
Name:          dye-master
Runtime:       Node
Build Command: npm install --omit=dev
Start Command: node server/index.js
Plan:          Free (또는 Starter $7/월)
```

### 4단계: 환경변수 설정
Render 대시보드 → Environment 탭에서 추가:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `CORS_ORIGINS` | `*` |
| `TRUST_PROXY` | `true` |

### 5단계: 배포
**Deploy** 클릭 → 2~3분 후 자동 배포 완료

접속 URL: `https://dye-master.onrender.com` (자동 생성)

### 커스텀 도메인 (선택)
1. Render 대시보드 → Settings → Custom Domain
2. 도메인 추가 (예: `game.example.com`)
3. DNS에서 CNAME 레코드 추가: `game → dye-master.onrender.com`
4. HTTPS 자동 발급됨

### 자동 배포
- `render.yaml` 파일이 포함되어 있으므로 **Blueprint** 기능으로도 배포 가능
- GitHub에 push할 때마다 자동 재배포

> ⚠️ **무료 플랜 주의사항**
> - 15분 비활성 시 서버 슬립 → 첫 접속 시 ~30초 대기
> - 재배포 시 `data/rankings.json` 초기화됨
> - Starter 플랜($7/월)으로 업그레이드 시 해결

---

## 옵션 B: Linux VPS 배포

### 사전 준비
- Ubuntu 20.04+ VPS (Vultr $5/월, DigitalOcean $6/월, AWS Lightsail $5/월)
- 도메인 (선택, 무료 도메인: freenom.com)
- SSH 접속 가능

### 1단계: 원클릭 설치

SSH로 VPS 접속 후:

```bash
# 프로젝트 파일 업로드 (ZIP 또는 Git)
git clone https://github.com/YOUR_REPO/colorFinder.git /opt/dye-master
cd /opt/dye-master

# 원클릭 설치 (도메인 있을 때)
sudo bash deploy/setup.sh game.example.com

# 원클릭 설치 (도메인 없을 때 — IP로 접속)
sudo bash deploy/setup.sh
```

이 스크립트가 자동으로:
1. Node.js 22 LTS 설치
2. PM2 프로세스 매니저 설치
3. npm 의존성 설치
4. Nginx 리버스 프록시 설정
5. Let's Encrypt HTTPS 인증서 발급
6. 방화벽 포트 개방 (80, 443)
7. 부팅 시 자동 시작 등록

### 2단계: DNS 설정 (도메인 사용 시)

도메인 관리 패널에서:
```
타입: A
이름: game (또는 @)
값:  VPS의 IP 주소
TTL: 300
```

### 서버 관리 명령어

```bash
# 상태 확인
pm2 status

# 로그 보기
pm2 logs dye-master

# 재시작
pm2 restart dye-master

# 중지
pm2 stop dye-master

# 서버 업데이트 후
cd /opt/dye-master
git pull
npm install --omit=dev
pm2 restart dye-master
```

### 랭킹 데이터 백업

```bash
# 수동 백업
cp /opt/dye-master/data/rankings.json /opt/dye-master/data/rankings_backup_$(date +%Y%m%d).json

# 자동 백업 (매일 자정)
echo "0 0 * * * cp /opt/dye-master/data/rankings.json /opt/dye-master/data/rankings_backup_\$(date +\%Y\%m\%d).json" | crontab -
```

---

## 옵션 C: Docker 배포

Dockerfile이 포함되어 있으므로 Docker 환경에서도 배포 가능합니다.

```bash
# 이미지 빌드
docker build -t dye-master .

# 실행
docker run -d \
  --name dye-master \
  -p 8080:8080 \
  -v dye-master-data:/app/data \
  -e CORS_ORIGINS="*" \
  -e TRUST_PROXY=true \
  --restart unless-stopped \
  dye-master
```

---

## .env 온라인 배포 설정

```env
PORT=8080
NODE_ENV=production

# 온라인 배포 시 CORS 설정
# 방법 1: 전체 허용 (간편, 보안 낮음)
CORS_ORIGINS=*

# 방법 2: 도메인 지정 (보안 권장)
# CORS_ORIGINS=https://game.example.com

# 리버스 프록시(Nginx) 뒤에서 운용 시 필수
TRUST_PROXY=true

# Rate Limiting
RATE_LIMIT_SESSION=5
RATE_LIMIT_ROUND=20
RATE_LIMIT_RANKING=30

# 리소스 상한
MAX_SESSIONS=1000
MAX_RANKINGS=1000
```

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 502 Bad Gateway | Node.js 앱 미실행 | `pm2 status` 확인, `pm2 restart dye-master` |
| HTTPS 인증서 오류 | DNS 미설정 | A 레코드가 VPS IP를 가리키는지 확인 |
| CORS 에러 | CORS_ORIGINS 미설정 | `.env`에 도메인 추가 또는 `*` 설정 |
| Render 슬립 | 무료 플랜 15분 비활성 | Starter 플랜 업그레이드 또는 cron ping |
| 랭킹 초기화 | Render 무료 재배포 | Starter 플랜 또는 외부 DB 사용 |

---

## 기술 지원

- 버전: DYE MASTER v3.0.0
- 엔진: Node.js + Express
- 보안: Helmet.js, Rate Limiting, Anti-Cheat
- 데이터: JSON 파일 기반 (별도 DB 불필요)
