/**
 * DYE MASTER 서버 진입점 v2.1 (Security Hardened)
 * Express + JSON DB 기반 서버사이드 랭킹 시스템
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cleanupSessions } from './db.js';
import {
  rateLimit,
  securityHeaders,
  blockServerDirectory
} from './utils/security.js';

import sessionRoutes from './routes/session.js';
import roundRoutes from './routes/round.js';
import rankingRoutes from './routes/ranking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ═══════════════════════════════════════════
// [SECURITY] 보안 미들웨어 (순서 중요)
// ═══════════════════════════════════════════

// 1. 보안 헤더 (모든 응답에 적용)
app.use(securityHeaders);

// 2. JSON 바디 크기 제한 (100KB) — DoS 방어
app.use(express.json({ limit: '100kb' }));

// 3. 잘못된 JSON 파싱 에러 핸들링
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

// 4. server/, data/, node_modules/ 접근 차단
app.use(blockServerDirectory);

// 5. CORS (같은 호스트만 허용)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // 로컬 개발 환경만 허용
  const allowedOrigins = [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`
  ];
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 6. 요청 로깅 (IP 포함)
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} [${ip}]`);
  }
  next();
});

// ═══════════════════════════════════════════
// 정적 파일 (기존 index.html, src/, css/ 등)
// ═══════════════════════════════════════════

const projectRoot = join(__dirname, '..');
app.use(express.static(projectRoot, {
  // dotfiles 접근 차단 (.env, .git 등)
  dotfiles: 'deny',
  // 디렉토리 목록 비활성화
  index: 'index.html'
}));

// ═══════════════════════════════════════════
// [SECURITY] Rate Limited API 라우트
// ═══════════════════════════════════════════

// 세션 시작: 분당 5회 (봇 세션 폭탄 방어)
app.use('/api/session', rateLimit(5, 60 * 1000, 'session'), sessionRoutes);

// 라운드 제출: 분당 20회
app.use('/api/round', rateLimit(20, 60 * 1000, 'round'), roundRoutes);

// 랭킹 조회: 분당 30회
app.use('/api/rankings', rateLimit(30, 60 * 1000, 'ranking'), rankingRoutes);

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════
// 404 핸들러 (API 전용)
// ═══════════════════════════════════════════

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ═══════════════════════════════════════════
// 글로벌 에러 핸들러
// ═══════════════════════════════════════════

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ═══════════════════════════════════════════
// 세션 정리 스케줄 (1시간마다)
// ═══════════════════════════════════════════

setInterval(() => {
  try {
    cleanupSessions();
  } catch (e) {
    console.error('[cleanup]', e);
  }
}, 60 * 60 * 1000);

// ═══════════════════════════════════════════
// 서버 시작
// ═══════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🎨 DYE MASTER Server v2.1 (Secured)   ║
  ║   http://localhost:${PORT}                 ║
  ║   Security: Rate-Limit + Headers + Guard ║
  ╚══════════════════════════════════════════╝
  `);
});
