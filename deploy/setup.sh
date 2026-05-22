#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# DYE MASTER — Ubuntu VPS 원클릭 설치 스크립트
#
# 지원: Ubuntu 20.04 / 22.04 / 24.04
# 사용법: sudo bash setup.sh YOUR_DOMAIN.COM
# ═══════════════════════════════════════════════════════════════

set -e

DOMAIN=${1:-""}
APP_DIR="/opt/dye-master"
LOG_DIR="/var/log/dye-master"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   🎨 DYE MASTER Server — VPS Setup          ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── 루트 권한 확인 ──
if [ "$EUID" -ne 0 ]; then
  echo "❌ 루트 권한이 필요합니다. sudo bash setup.sh 으로 실행하세요."
  exit 1
fi

# ── 1. 시스템 업데이트 ──
echo "[1/7] 시스템 업데이트..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Node.js 22 LTS 설치 ──
echo "[2/7] Node.js 22 LTS 설치..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "  ✅ Node.js $(node -v)"

# ── 3. PM2 설치 ──
echo "[3/7] PM2 설치..."
npm install -g pm2 2>/dev/null
echo "  ✅ PM2 $(pm2 -v)"

# ── 4. 앱 디렉토리 설정 ──
echo "[4/7] 앱 디렉토리 설정..."
mkdir -p "$APP_DIR" "$LOG_DIR"

# 현재 스크립트 위치 기준으로 프로젝트 파일 복사
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_DIR/package.json" ]; then
  echo "  프로젝트 파일 복사 중..."
  rsync -a --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='*.zip' \
    "$PROJECT_DIR/" "$APP_DIR/"
else
  echo "  ⚠ 프로젝트 파일을 $APP_DIR 에 수동으로 복사하세요."
fi

# 의존성 설치
cd "$APP_DIR"
npm install --omit=dev
mkdir -p data
[ ! -f data/rankings.json ] && echo '[]' > data/rankings.json

# .env 생성
if [ ! -f .env ]; then
  cat > .env << EOF
PORT=8080
NODE_ENV=production
CORS_ORIGINS=*
TRUST_PROXY=true
RATE_LIMIT_SESSION=5
RATE_LIMIT_ROUND=20
RATE_LIMIT_RANKING=30
MAX_SESSIONS=1000
MAX_RANKINGS=1000
EOF
  echo "  ✅ .env 생성 완료"
fi

# ── 5. PM2로 앱 시작 ──
echo "[5/7] PM2로 앱 시작..."
if [ -f deploy/ecosystem.config.cjs ]; then
  pm2 start deploy/ecosystem.config.cjs
else
  pm2 start server/index.js --name dye-master
fi
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
echo "  ✅ PM2 시작 완료"

# ── 6. Nginx 설치 + 설정 ──
echo "[6/7] Nginx 설치..."
apt-get install -y nginx -qq

if [ -n "$DOMAIN" ]; then
  echo "  도메인: $DOMAIN"
  
  # Nginx 설정 복사 & 도메인 치환
  if [ -f deploy/nginx.conf ]; then
    sed "s/YOUR_DOMAIN.COM/$DOMAIN/g" deploy/nginx.conf > /etc/nginx/sites-available/dye-master
  else
    cat > /etc/nginx/sites-available/dye-master << NGINX
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
  fi
  
  ln -sf /etc/nginx/sites-available/dye-master /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  echo "  ✅ Nginx 설정 완료"

  # ── 7. HTTPS (Let's Encrypt) ──
  echo "[7/7] HTTPS 인증서 발급..."
  apt-get install -y certbot python3-certbot-nginx -qq
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" || {
    echo "  ⚠ 인증서 발급 실패. DNS가 이 서버를 가리키는지 확인하세요."
    echo "  수동 발급: sudo certbot --nginx -d $DOMAIN"
  }
else
  echo "  ⚠ 도메인이 지정되지 않았습니다."
  echo "  나중에 도메인 설정: sudo bash setup.sh YOUR_DOMAIN.COM"
  echo "[7/7] HTTPS 건너뜀 (도메인 필요)"
fi

# ── 방화벽 ──
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw allow 22/tcp 2>/dev/null || true

# ── 완료 ──
echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║          ✅ 설치 완료!                       ║"
echo "  ╠══════════════════════════════════════════════╣"
if [ -n "$DOMAIN" ]; then
echo "  ║  🌐 https://$DOMAIN"
fi
echo "  ║  📁 앱 위치: $APP_DIR"
echo "  ║  📋 로그: $LOG_DIR"
echo "  ╠══════════════════════════════════════════════╣"
echo "  ║  pm2 status         → 상태 확인             ║"
echo "  ║  pm2 logs dye-master → 로그 보기            ║"
echo "  ║  pm2 restart dye-master → 재시작            ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
