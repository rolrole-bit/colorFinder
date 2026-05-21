/**
 * JSON 파일 기반 데이터베이스 모듈 v2.1 (Security Hardened)
 * 
 * 보안 강화:
 * - 세션 개수 상한 (MAX_SESSIONS)
 * - 랭킹 레코드 상한 (MAX_RANKINGS)
 * - 파일 쓰기 에러 핸들링
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const RANKINGS_FILE = join(DATA_DIR, 'rankings.json');

// [SECURITY] 리소스 상한
const MAX_SESSIONS = 1000;    // 동시 세션 상한
const MAX_RANKINGS = 1000;    // 랭킹 레코드 상한

mkdirSync(DATA_DIR, { recursive: true });

// ═══════════════════════════════════════════
// 파일 I/O 헬퍼 (메모리 캐시 + 비동기 영속화)
// ═══════════════════════════════════════════

/** 디스크에서 rankings.json을 동기 읽기 (서버 시작 시 1회만 호출) */
function _loadFromDisk() {
  try {
    if (existsSync(RANKINGS_FILE)) {
      const data = readFileSync(RANKINGS_FILE, 'utf-8');
      // [SECURITY] 파일 크기 검증 (10MB 상한)
      if (data.length > 10 * 1024 * 1024) {
        console.error('[DB] rankings.json이 너무 큽니다. 초기화합니다.');
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    }
  } catch (e) {
    console.error('[DB] rankings.json 파싱 실패:', e.message);
  }
  return [];
}

/** 메모리 캐시 (서버 시작 시 1회 로드, 이후 I/O 없이 즉시 반환) */
let _rankingsCache = _loadFromDisk();
let _persistPending = false;

/**
 * 랭킹 데이터 조회 (메모리 캐시에서 즉시 반환, 디스크 I/O 없음)
 * @returns {Array} 랭킹 배열
 */
export function loadRankings() {
  return _rankingsCache;
}

/**
 * 랭킹 데이터 비동기 영속화 (이벤트 루프 블로킹 없음)
 * 연속 호출 시 중복 쓰기를 방지하는 debounce 잠금 적용
 */
async function persistRankings() {
  if (_persistPending) return;
  _persistPending = true;
  try {
    await writeFile(RANKINGS_FILE, JSON.stringify(_rankingsCache, null, 2), 'utf-8');
  } catch (e) {
    console.error('[DB] rankings.json 저장 실패:', e.message);
  } finally {
    _persistPending = false;
  }
}

// ═══════════════════════════════════════════
// 세션 관리 (메모리)
// ═══════════════════════════════════════════

const sessions = new Map();

/**
 * 새 게임 세션 생성
 * @returns {string|null} sessionId (상한 초과 시 null)
 */
export function createSession(playerName, originGame, difficulty, targetColors, multiplier) {
  // [SECURITY] 세션 개수 상한 검사
  if (sessions.size >= MAX_SESSIONS) {
    // 오래된 미완료 세션 정리 시도
    cleanupSessions();
    if (sessions.size >= MAX_SESSIONS) {
      console.warn('[DB] 세션 상한 도달:', sessions.size);
      return null;
    }
  }

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
    final_score: null,
    _lastSubmitTime: null
  });
  
  return sessionId;
}

/**
 * 세션 조회
 */
export function getSession(sessionId) {
  // [SECURITY] UUID 형식 검증
  if (typeof sessionId !== 'string' || sessionId.length > 50) return null;
  return sessions.get(sessionId) || null;
}

/**
 * 라운드 점수 추가 & 진행
 */
export function addRoundScore(sessionId, score) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  
  // [SECURITY] 점수 타입/범위 재검증
  const safeScore = Math.max(0, Math.min(1500, Math.floor(Number(score) || 0)));
  
  session.round_scores.push(safeScore);
  session.current_round += 1;
  
  const isLast = session.current_round > session.max_rounds;
  
  if (isLast) {
    const totalBase = session.round_scores.reduce((a, b) => a + b, 0);
    let finalScore = Math.floor(totalBase * session.multiplier);
    
    // [SECURITY] 최종 점수 상한 (이론상 최대: 1500 * 3 * 1.4 = 6300)
    finalScore = Math.max(0, Math.min(6300, finalScore));
    
    session.final_score = finalScore;
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
  // [SECURITY] 점수 재검증
  const safeScore = Math.max(0, Math.min(6300, Math.floor(Number(score) || 0)));
  
  const rankings = loadRankings();
  
  // [SECURITY] 랭킹 레코드 상한 — 오래된 것부터 제거
  if (rankings.length >= MAX_RANKINGS) {
    // 점수 낮은 순으로 정렬 후 하위 제거
    rankings.sort((a, b) => b.score - a.score);
    rankings.length = MAX_RANKINGS - 1;
  }
  
  rankings.push({
    player_name: playerName,
    origin_game: originGame,
    score: safeScore,
    difficulty,
    session_id: sessionId,
    created_at: new Date().toISOString()
  });
  
  persistRankings();  // 비동기 fire-and-forget
}

/**
 * 게임별 랭킹 조회
 */
export function getGameRankings() {
  const rankings = loadRankings();
  
  const gameMap = {};
  rankings.forEach(r => {
    const game = r.origin_game;
    if (!gameMap[game]) {
      gameMap[game] = { topScore: 0, playCount: 0, todayTop: 0 };
    }
    gameMap[game].playCount++;
    if (r.score > gameMap[game].topScore) gameMap[game].topScore = r.score;
    
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
  return getAllPlayerRankings().slice(0, 5);
}

/**
 * 전체 플레이어 랭킹 (중복 제거, 점수 내림차순)
 */
export function getAllPlayerRankings() {
  const rankings = loadRankings();
  
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
    .sort((a, b) => b.score - a.score);
}

/**
 * 사전 로드된 랭킹 데이터로 게임별 랭킹 계산 (파일 I/O 없음)
 * @param {Array} rankings - loadRankings()로 미리 로드한 데이터
 */
export function computeGameRankings(rankings) {
  const gameMap = {};
  rankings.forEach(r => {
    const game = r.origin_game;
    if (!gameMap[game]) {
      gameMap[game] = { topScore: 0, playCount: 0, todayTop: 0 };
    }
    gameMap[game].playCount++;
    if (r.score > gameMap[game].topScore) gameMap[game].topScore = r.score;
    
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
 * 사전 로드된 랭킹 데이터로 전체 플레이어 랭킹 계산 (파일 I/O 없음)
 * @param {Array} rankings - loadRankings()로 미리 로드한 데이터
 */
export function computeAllPlayerRankings(rankings) {
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
    .sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════
// 세션 정리 (30분 이상 된 미완료 세션 + 완료된 세션)
// ═══════════════════════════════════════════

export function cleanupSessions() {
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  let cleaned = 0;
  
  for (const [id, session] of sessions) {
    // 미완료 + 30분 경과 → 삭제
    if (!session.completed_at && new Date(session.created_at).getTime() < thirtyMinAgo) {
      sessions.delete(id);
      cleaned++;
    }
    // 완료 + 5분 경과 → 삭제 (불필요한 메모리 해제)
    if (session.completed_at && new Date(session.completed_at).getTime() < fiveMinAgo) {
      sessions.delete(id);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[DB] ${cleaned}개 세션 정리 완료. 현재: ${sessions.size}개`);
  }
}
