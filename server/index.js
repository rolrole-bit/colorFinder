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
import { cleanupSessions } from './db.js';
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;font-family:'Inter',sans-serif;color:#fff}
.card{text-align:center;padding:3rem 2rem;max-width:400px;width:90%;background:linear-gradient(135deg,rgba(102,126,234,0.15),rgba(118,75,162,0.15));border:1px solid rgba(255,255,255,0.1);border-radius:24px;backdrop-filter:blur(10px)}
.label{font-size:.9rem;color:#aaa;letter-spacing:2px;margin-bottom:.5rem}
.name{font-size:1.3rem;font-weight:700;margin-bottom:.3rem}
.score{font-size:5rem;font-weight:900;line-height:1;background:linear-gradient(135deg,#667eea,#764ba2,#f093fb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:.5rem 0}
.comment{font-size:.95rem;color:#bbb;font-style:italic;margin:1rem 0 2rem;line-height:1.5}
.btn{display:inline-block;padding:1rem 3rem;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;border-radius:50px;font-size:1.1rem;font-weight:700;letter-spacing:1px;transition:transform .2s,box-shadow .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(102,126,234,0.4)}
.sub{font-size:.75rem;color:#555;margin-top:1.5rem}
</style>
</head>
<body>
<div class="card">
  <div class="label">DYE MASTER</div>
  <div class="name">${name}님의 점수</div>
  <div class="score">${score.toLocaleString()}</div>
  <div class="comment">${desc}</div>
  <a href="${gameUrl}" class="btn">🎨 나도 도전하기</a>
  <div class="sub">색감 테스트 게임</div>
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
