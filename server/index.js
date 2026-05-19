/**
 * DYE MASTER 서버 진입점 v3.0 (Production-Ready)
 * Express + Helmet + dotenv + JSON DB
 * 
 * 보안 체크리스트:
 * ✅ Helmet.js (검증된 보안 헤더 라이브러리)
 * ✅ dotenv (환경변수 분리)
 * ✅ CORS 화이트리스트 (.env 기반)
 * ✅ Rate Limiting (IP 기반)
 * ✅ 디렉토리/파일 접근 차단
 * ✅ JSON 페이로드 크기 제한
 * ✅ Trust Proxy 설정 (리버스 프록시 대응)
 */

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cleanupSessions, getPlayerRankings } from './db.js';
import { rateLimit, blockServerDirectory } from './utils/security.js';

import sessionRoutes from './routes/session.js';
import roundRoutes from './routes/round.js';
import rankingRoutes from './routes/ranking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ═══════════════════════════════════════════
// [SECURITY] 1. Trust Proxy (리버스 프록시 뒤에서 운용 시)
// ═══════════════════════════════════════════

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ═══════════════════════════════════════════
// [SECURITY] 2. Helmet.js — 검증된 보안 헤더 (15종+)
// ═══════════════════════════════════════════

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fastly.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fastly.jsdelivr.net"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      // HTTPS 전환은 리버스 프록시(Nginx/Synology)가 담당
      upgradeInsecureRequests: null
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: process.env.TRUST_PROXY === 'true' ? { maxAge: 31536000, includeSubDomains: true } : false,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// ═══════════════════════════════════════════
// [SECURITY] 3. JSON 바디 크기 제한 (100KB)
// ═══════════════════════════════════════════

app.use(express.json({ limit: '100kb' }));

// ═══════════════════════════════════════════
// [SECURITY] 4. 디렉토리/파일 접근 차단
// ═══════════════════════════════════════════

app.use(blockServerDirectory);

// ═══════════════════════════════════════════
// [SECURITY] 5. CORS (.env 기반 화이트리스트)
// ═══════════════════════════════════════════

const allowedOrigins = (process.env.CORS_ORIGINS || `http://localhost:${PORT}`)
  .split(',')
  .map(s => s.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ═══════════════════════════════════════════
// [SECURITY] 6. 요청 로깅
// ═══════════════════════════════════════════

app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} [${ip}]`);
  }
  next();
});

// ═══════════════════════════════════════════
// OG 공유 페이지 (SNS 미리보기 카드)
// ═══════════════════════════════════════════

app.get('/share', (req, res) => {
  const score = parseInt(req.query.score) || 0;
  const name = (req.query.name || '플레이어').substring(0, 20).replace(/[<>"'&]/g, '');
  const comment = (req.query.comment || '').substring(0, 100).replace(/[<>"'&]/g, '');
  const gameUrl = `${req.protocol}://${req.get('host')}/`;

  // 본인 등수 계산
  const playerRanks = getPlayerRankings();
  const totalPlayers = playerRanks.length;
  let myRank = totalPlayers + 1;
  for (let i = 0; i < playerRanks.length; i++) {
    if (score >= playerRanks[i].score) { myRank = i + 1; break; }
  }
  const rankText = `전체 ${totalPlayers}명 중 ${myRank}위`;

  // 다중 라운드 색상 파싱 (tc=r,g,b|r,g,b|r,g,b  uc=r,g,b|r,g,b|r,g,b)
  const parseColors = (str) => {
    if (!str) return [];
    return str.split('|').map(s => {
      const p = s.split(',').map(Number);
      return (p.length === 3 && p.every(n => !isNaN(n))) ? `rgb(${p[0]},${p[1]},${p[2]})` : null;
    }).filter(Boolean);
  };
  const tcArr = parseColors(req.query.tc);
  const ucArr = parseColors(req.query.uc);
  
  // 좌측(타겟) 그라데이션, 우측(유저) 그라데이션
  const leftBg = tcArr.length > 1
    ? `linear-gradient(to bottom, ${tcArr.join(', ')})`
    : (tcArr[0] || 'rgb(102,126,234)');
  const rightBg = ucArr.length > 1
    ? `linear-gradient(to bottom, ${ucArr.join(', ')})`
    : (ucArr[0] || 'rgb(118,75,162)');

  const title = `🎨 ${name}님의 DYE MASTER 점수: ${score.toLocaleString()}점`;
  const desc = comment || `색감 테스트에서 ${score.toLocaleString()}점을 획득했습니다! 나의 색감을 증명해 보세요.`;

  res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${gameUrl}">
<meta property="og:site_name" content="DYE MASTER">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<style>
@font-face{font-family:'Paperlogy';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-3Light.woff2') format('woff2');font-weight:300;font-display:swap}
@font-face{font-family:'Paperlogy';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-4Regular.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'Paperlogy';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-7Bold.woff2') format('woff2');font-weight:700;font-display:swap}
@font-face{font-family:'Paperlogy';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-8ExtraBold.woff2') format('woff2');font-weight:800;font-display:swap}
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Paperlogy',sans-serif;color:#fff;overflow:hidden;position:relative}
.bg{position:fixed;inset:0;z-index:0;display:flex}
.bg-half{flex:1}
.bg-left{background:${leftBg}}
.bg-right{background:${rightBg}}
.bg-blur{position:fixed;inset:0;z-index:1;backdrop-filter:blur(50px);-webkit-backdrop-filter:blur(50px);background:rgba(0,0,0,0.25)}
.card{position:relative;z-index:2;text-align:center;padding:2.5rem 2rem 2rem;max-width:380px;width:90%;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:24px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.label{font-size:.8rem;color:rgba(255,255,255,0.5);letter-spacing:3px;margin-bottom:.4rem;text-transform:uppercase}
.name{font-size:1.15rem;font-weight:600;margin-bottom:.2rem;color:rgba(255,255,255,0.85)}
.score{font-size:4.5rem;font-weight:900;line-height:1;color:#fff;text-shadow:0 4px 20px rgba(0,0,0,0.3);margin:.3rem 0 .8rem}
.comment{font-size:.85rem;color:rgba(255,255,255,0.65);font-style:italic;margin-bottom:2rem;line-height:1.6}
.btn{display:inline-block;padding:.9rem 2.5rem;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);color:#fff;text-decoration:none;border-radius:50px;font-size:1rem;font-weight:700;letter-spacing:1px;transition:all .2s;backdrop-filter:blur(10px)}
.btn:hover{background:rgba(255,255,255,0.25);transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,0.3)}
.my-rank{margin-top:1.5rem;font-size:.85rem;color:rgba(255,255,255,0.5);letter-spacing:1px}
</style>
</head>
<body>
<div class="bg"><div class="bg-half bg-left"></div><div class="bg-half bg-right"></div></div>
<div class="bg-blur"></div>
<div class="card">
  <div class="label">DYE MASTER</div>
  <div class="name">${name}님의 점수</div>
  <div class="score">${score.toLocaleString()}</div>
  <div class="comment">${desc}</div>
  <a href="${gameUrl}" class="btn">나도 도전하기</a>
  <div class="my-rank">🏆 ${rankText}</div>
</div>
</body>
</html>`);
});

// ═══════════════════════════════════════════
// 정적 파일
// ═══════════════════════════════════════════

const projectRoot = join(__dirname, '..');
app.use(express.static(projectRoot, {
  dotfiles: 'deny',
  index: 'index.html'
}));

// ═══════════════════════════════════════════
// [SECURITY] Rate Limited API 라우트
// ═══════════════════════════════════════════

const rlSession = parseInt(process.env.RATE_LIMIT_SESSION) || 5;
const rlRound = parseInt(process.env.RATE_LIMIT_ROUND) || 20;
const rlRanking = parseInt(process.env.RATE_LIMIT_RANKING) || 30;

app.use('/api/session', rateLimit(rlSession, 60 * 1000, 'session'), sessionRoutes);
app.use('/api/round', rateLimit(rlRound, 60 * 1000, 'round'), roundRoutes);
app.use('/api/rankings', rateLimit(rlRanking, 60 * 1000, 'ranking'), rankingRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '3.0',
    env: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════
// 404 + 글로벌 에러 핸들러
// ═══════════════════════════════════════════

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  // JSON 파싱 에러 처리
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error('[ERROR]', err.message);
  // [SECURITY] 프로덕션에서는 스택 트레이스 숨김
  const detail = NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(500).json({ error: detail });
});

// ═══════════════════════════════════════════
// 세션 정리 (1시간마다)
// ═══════════════════════════════════════════

setInterval(() => {
  try { cleanupSessions(); } catch (e) { console.error('[cleanup]', e); }
}, 60 * 60 * 1000);

// ═══════════════════════════════════════════
// 서버 시작
// ═══════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   🎨 DYE MASTER Server v3.0 (Production)    ║
  ║   http://localhost:${PORT}                     ║
  ║   http://10.28.42.23:${PORT}  (내부망)         ║
  ║   Helmet: ✅  dotenv: ✅  RateLimit: ✅       ║
  ╚══════════════════════════════════════════════╝
  `);
});
