/**
 * JSON 파일 기반 데이터베이스 모듈
 * better-sqlite3 네이티브 빌드 이슈 회피를 위한 경량 대안
 * 
 * 데이터 구조:
 * - sessions: Map<sessionId, SessionObject>  (메모리)
 * - rankings: Array<RankingRecord>  (파일 영속)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const RANKINGS_FILE = join(DATA_DIR, 'rankings.json');

// data 디렉토리 자동 생성
mkdirSync(DATA_DIR, { recursive: true });

// ═══════════════════════════════════════════
// 파일 I/O 헬퍼
// ═══════════════════════════════════════════

function loadRankings() {
  try {
    if (existsSync(RANKINGS_FILE)) {
      return JSON.parse(readFileSync(RANKINGS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[DB] rankings.json 파싱 실패, 초기화합니다.', e.message);
  }
  return [];
}

function persistRankings(rankings) {
  writeFileSync(RANKINGS_FILE, JSON.stringify(rankings, null, 2), 'utf-8');
}

// ═══════════════════════════════════════════
// 세션 관리 (메모리 — 서버 재시작 시 초기화)
// ═══════════════════════════════════════════

const sessions = new Map();

/**
 * 새 게임 세션 생성
 * @param {string} playerName
 * @param {string} originGame
 * @param {string} difficulty
 * @param {Array} targetColors - 3라운드 분의 타겟 색상
 * @param {number} multiplier
 * @returns {string} sessionId
 */
export function createSession(playerName, originGame, difficulty, targetColors, multiplier) {
  const sessionId = crypto.randomUUID();
  
  sessions.set(sessionId, {
    id: sessionId,
    player_name: playerName,
    origin_game: originGame,
    difficulty,
    current_round: 1,
    max_rounds: 3,
    target_colors: targetColors,
    round_scores: [],
    multiplier,
    created_at: new Date().toISOString(),
    completed_at: null,
    final_score: null
  });
  
  return sessionId;
}

/**
 * 세션 조회
 */
export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * 라운드 점수 추가 & 진행
 */
export function addRoundScore(sessionId, score) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  
  session.round_scores.push(score);
  session.current_round += 1;
  
  const isLast = session.current_round > session.max_rounds;
  
  if (isLast) {
    const totalBase = session.round_scores.reduce((a, b) => a + b, 0);
    session.final_score = Math.floor(totalBase * session.multiplier);
    session.completed_at = new Date().toISOString();
  }
  
  return session;
}

// ═══════════════════════════════════════════
// 랭킹 관리 (파일 영속)
// ═══════════════════════════════════════════

/**
 * 랭킹 기록 저장
 */
export function saveRanking(playerName, originGame, score, difficulty, sessionId) {
  const rankings = loadRankings();
  rankings.push({
    player_name: playerName,
    origin_game: originGame,
    score,
    difficulty,
    session_id: sessionId,
    created_at: new Date().toISOString()
  });
  persistRankings(rankings);
}

/**
 * 게임별 랭킹 조회
 */
export function getGameRankings() {
  const rankings = loadRankings();
  
  // 게임별 최고점 집계
  const gameMap = {};
  rankings.forEach(r => {
    const game = r.origin_game;
    if (!gameMap[game]) {
      gameMap[game] = { topScore: 0, playCount: 0, todayTop: 0 };
    }
    gameMap[game].playCount++;
    if (r.score > gameMap[game].topScore) gameMap[game].topScore = r.score;
    
    // 오늘 기록
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(r.created_at) >= today && r.score > gameMap[game].todayTop) {
      gameMap[game].todayTop = r.score;
    }
  });
  
  return Object.entries(gameMap)
    .map(([game, data], i) => ({
      game,
      topScore: data.topScore,
      playCount: data.playCount,
      todayTopScore: data.todayTop,
      rank: i + 1,
      trend: 0,
      isNew: data.playCount <= 3
    }))
    .sort((a, b) => b.topScore - a.topScore)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

/**
 * 플레이어별 랭킹 조회 (상위 5명)
 */
export function getPlayerRankings() {
  const rankings = loadRankings();
  
  // 플레이어별 최고점
  const playerMap = {};
  rankings.forEach(r => {
    const key = `${r.player_name}|${r.origin_game}`;
    if (!playerMap[key] || r.score > playerMap[key].score) {
      playerMap[key] = {
        playerName: r.player_name,
        originGame: r.origin_game,
        score: r.score,
        difficulty: r.difficulty
      };
    }
  });
  
  return Object.values(playerMap)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ═══════════════════════════════════════════
// 세션 정리 (1시간 이상 된 미완료 세션)
// ═══════════════════════════════════════════

export function cleanupSessions() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (!session.completed_at && new Date(session.created_at).getTime() < oneHourAgo) {
      sessions.delete(id);
    }
  }
}
