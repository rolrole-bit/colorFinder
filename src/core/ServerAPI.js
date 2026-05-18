/**
 * ServerAPI - 서버사이드 API 통신 모듈
 * 
 * 클라이언트의 모든 서버 통신을 이 모듈에 집중시켜
 * UI 코드와 네트워크 로직을 분리
 */

const API_BASE = '';  // 같은 호스트 (Express가 정적 파일도 서빙)

/**
 * 게임 세션 시작 - 서버에서 타겟 색상을 받아옴
 * @param {string} playerName
 * @param {string} originGame
 * @param {string} difficulty
 * @returns {Promise<{sessionId, targetColor, round, maxRounds, memorizeTime, difficulty}>}
 */
export async function startSession(playerName, originGame, difficulty) {
  const res = await fetch(`${API_BASE}/api/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, originGame, difficulty })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  
  return res.json();
}

/**
 * 라운드 제출 - 유저 색상을 서버에 보내고 서버가 계산한 점수를 받아옴
 * @param {string} sessionId
 * @param {{r: number, g: number, b: number}} userColor
 * @returns {Promise<{score, round, targetColor, userColor, isLastRound, finalScore?, nextTargetColor?, nextRound?}>}
 */
export async function submitRound(sessionId, userColor) {
  const res = await fetch(`${API_BASE}/api/round/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, userColor })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  
  return res.json();
}

/**
 * 랭킹 조회 - 서버 DB에서 랭킹 가져옴
 * @returns {Promise<{gameRankings: Array, playerRankings: Array}>}
 */
export async function fetchRankings() {
  const res = await fetch(`${API_BASE}/api/rankings`);
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  
  return res.json();
}
