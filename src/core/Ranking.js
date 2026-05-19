/**
 * Ranking
 * 서버 API를 통해 랭킹 데이터를 관리하는 모듈
 * 
 * Phase 2: LocalStorage → Server DB 전환
 * 서버가 점수 계산과 랭킹 저장을 전담하므로
 * 클라이언트는 조회(GET)만 수행
 */

import { fetchRankings } from './ServerAPI.js';

// 랭킹 캐시 (불필요한 반복 요청 방지)
let cachedRankings = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5초

/**
 * 서버에서 랭킹 데이터를 가져옴 (캐시 적용)
 * @returns {Promise<{gameRankings: Array, playerRankings: Array}>}
 */
async function getRankingsFromServer() {
  const now = Date.now();
  if (cachedRankings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedRankings;
  }
  
  try {
    cachedRankings = await fetchRankings();
    cacheTimestamp = now;
    return cachedRankings;
  } catch (err) {
    console.error('[Ranking] 서버 랭킹 조회 실패:', err);
    // 서버 실패 시 빈 결과 반환
    return { gameRankings: [], playerRankings: [] };
  }
}

/**
 * 캐시를 무효화합니다 (점수 저장 후 호출)
 */
export function invalidateRankingCache() {
  cachedRankings = null;
  cacheTimestamp = 0;
}

/**
 * 새로운 게임 결과를 서버에 저장합니다.
 * Phase 2에서는 round/submit API가 마지막 라운드에서 자동 저장하므로
 * 이 함수는 캐시 무효화 역할만 수행
 * 
 * @param {string} playerName - 플레이어 이름
 * @param {string} originGame - 출신 게임
 * @param {number} score - 최종 점수 (정수)
 * @param {string} difficulty - 난이도
 */
export async function saveRecord(playerName, originGame, score, difficulty) {
  // 서버 round/submit에서 이미 저장됨 — 캐시만 무효화
  invalidateRankingCache();
}

/**
 * 게임별 랭킹 조회
 * @returns {Promise<Array>} [{ game, topScore, rank, trend, isNew }, ...]
 */
export async function getGameRankings() {
  const { gameRankings } = await getRankingsFromServer();
  return gameRankings;
}

/**
 * 플레이어별 랭킹 조회 (상위 5명)
 * @returns {Promise<Array>} [{ playerName, originGame, score, difficulty }, ...]
 */
export async function getPlayerRankings() {
  const { playerRankings } = await getRankingsFromServer();
  return playerRankings;
}

/**
 * 전체 플레이어 수 조회
 */
export async function getTotalPlayers() {
  const { totalPlayers } = await getRankingsFromServer();
  return totalPlayers || 0;
}
