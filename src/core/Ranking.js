/**
 * Ranking
 * LocalStorage를 활용하여 점수 데이터를 기록하고 순위 리스트를 반환하는 모듈
 * 점수는 정수 기반 (0~4500점 범위)
 * 
 * [SECURITY] 데이터 서명/검증, 점수 상한 검증 적용
 */

import { 
  isValidFinalScore, 
  generateSignature, 
  verifySignature,
  sanitizePlayerName,
  sanitizeGameName,
  escapeHTML 
} from '../utils/AntiCheat.js';

const STORAGE_KEY = "DyeMaster_rankings";
const SIGNATURE_KEY = "DyeMaster_sig";

/**
 * [SECURITY] 스토리지에서 기록을 가져오고 서명을 검증합니다.
 * 서명이 불일치하면 데이터를 신뢰하지 않고 빈 배열을 반환합니다.
 * @returns {Array} 검증된 기록 배열
 */
function getRecords() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const records = JSON.parse(data);
    if (!Array.isArray(records)) return [];
    
    // 서명 검증
    const storedSig = localStorage.getItem(SIGNATURE_KEY);
    if (storedSig && !verifySignature(records, storedSig)) {
      // 서명 불일치 → 데이터 변조 감지
      console.warn('[AntiCheat] 랭킹 데이터 무결성 검증 실패. 데이터를 초기화합니다.');
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SIGNATURE_KEY);
      return [];
    }
    
    // 각 레코드의 점수 유효성 개별 검증
    return records.filter(r => {
      if (!r || typeof r.score !== 'number') return false;
      return isValidFinalScore(r.score, r.difficulty || 'Easy');
    });
  } catch (e) {
    // JSON 파싱 오류 등
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SIGNATURE_KEY);
    return [];
  }
}

/**
 * [SECURITY] 레코드를 서명과 함께 저장
 * @param {Array} records - 저장할 레코드 배열
 */
function saveRecords(records) {
  const signature = generateSignature(records);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  localStorage.setItem(SIGNATURE_KEY, signature);
}

/**
 * 새로운 게임 결과를 스토리지에 저장합니다.
 * [SECURITY] 점수 상한 검증, 입력 새니타이징 적용
 * @param {string} playerName - 플레이어 이름
 * @param {string} originGame - 출신 게임
 * @param {number} score - 최종 점수 (정수)
 * @param {string} difficulty - 난이도
 */
export function saveRecord(playerName, originGame, score, difficulty) {
  // [SECURITY] 점수 유효성 검증
  if (!isValidFinalScore(score, difficulty)) {
    console.warn('[AntiCheat] 비정상 점수 감지. 기록을 저장하지 않습니다.');
    return;
  }
  
  // [SECURITY] 입력 새니타이징
  const cleanName = sanitizePlayerName(playerName);
  const cleanGame = sanitizeGameName(originGame);
  
  if (!cleanName || !cleanGame) return;
  
  const records = getRecords();
  records.push({
    playerName: cleanName,
    originGame: cleanGame,
    score: Math.floor(score),
    difficulty: difficulty || 'Normal',
    date: new Date().toISOString()
  });
  
  // [SECURITY] 서명 포함 저장
  saveRecords(records);
}

export function getGameRankings() {
  const records = getRecords();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevGameMap = {};
  const currGameMap = {};

  records.forEach(r => {
    const recordDate = new Date(r.date);
    
    if (!currGameMap[r.originGame] || currGameMap[r.originGame] < r.score) {
      currGameMap[r.originGame] = r.score;
    }
    
    if (recordDate < today) {
      if (!prevGameMap[r.originGame] || prevGameMap[r.originGame] < r.score) {
        prevGameMap[r.originGame] = r.score;
      }
    }
  });

  const getSortedRanks = (map) => {
    return Object.keys(map)
      .map(game => ({ game, score: map[game] }))
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  };

  const prevRanks = getSortedRanks(prevGameMap);
  const currRanks = getSortedRanks(currGameMap);

  return currRanks.slice(0, 10).map(curr => {
    const prevItem = prevRanks.find(p => p.game === curr.game);
    let trend = 0;
    let isNew = false;
    if (prevItem) {
      trend = prevItem.rank - curr.rank; // Positive means rank went up
    } else {
      isNew = true;
    }
    return { ...curr, trend, isNew };
  });
}

/**
 * 전체 플레이어 순위를 반환합니다. (상위 5개)
 * @returns {Array} [{ playerName: '유저1', originGame: 'WOW', score: 3200, difficulty: 'Normal' }, ...]
 */
export function getPlayerRankings() {
  const records = getRecords();
  
  // 플레이어 이름 + 출신 게임의 조합으로 중복된 경우 최고점만 반영 (선택 사항)
  const playerMap = {};
  records.forEach(r => {
    const key = `${r.originGame}_${r.playerName}`;
    if (!playerMap[key] || playerMap[key].score < r.score) {
      playerMap[key] = r;
    }
  });

  const sortedPlayers = Object.values(playerMap).sort((a, b) => b.score - a.score);
  return sortedPlayers.slice(0, 5);
}
