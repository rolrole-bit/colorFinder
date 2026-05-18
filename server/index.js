/**
 * DYE MASTER 서버 진입점
 * Express + SQLite 기반 서버사이드 랭킹 시스템
 * 
 * 기존 http-server(8080)를 대체하여 정적 파일 서빙 + API를 통합
 * 포트 8080에서 실행
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cleanupSessions } from './db.js';

import sessionRoutes from './routes/session.js';
import roundRoutes from './routes/round.js';
import rankingRoutes from './routes/ranking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ═══════════════════════════════════════════
// 미들웨어
// ═══════════════════════════════════════════

app.use(express.json());

// CORS (개발 환경)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 요청 로깅
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// ═══════════════════════════════════════════
// 정적 파일 (기존 index.html, src/, css/ 등)
// ═══════════════════════════════════════════

const projectRoot = join(__dirname, '..');
app.use(express.static(projectRoot));

// ═══════════════════════════════════════════
// API 라우트
// ═══════════════════════════════════════════

app.use('/api/session', sessionRoutes);
app.use('/api/round', roundRoutes);
app.use('/api/rankings', rankingRoutes);

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
  ║   🎨 DYE MASTER Server v2.0             ║
  ║   http://localhost:${PORT}                 ║
  ║   Server-side ranking enabled            ║
  ╚══════════════════════════════════════════╝
  `);
});
