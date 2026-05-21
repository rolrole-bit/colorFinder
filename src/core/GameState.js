/**
 * GameState
 * 게임의 현재 상태를 저장하고 관리하는 모듈
 * 
 * 난이도별 기억 시간과 점수 배율을 관리합니다.
 * [SECURITY] 방어적 getter, setter 범위 검증 적용
 */

import { isValidRoundScore, clampScore } from '../utils/AntiCheat.js';

const state = {
  playerName: "",
  originGame: "",
  difficulty: "Normal",
  phase: "ENTRY",
  targetColor: null,
  userColor: { r: 128, g: 128, b: 128 },
  score: 0,
  currentRound: 1,
  maxRounds: 3,
  roundResults: [] // array of { score, targetColor, userColor }
};

/**
 * 난이도별 기억(메모라이즈) 시간 (밀리초)
 */
export const DIFFICULTY_TIME = {
  "Easy": 5000,
  "Normal": 2000,
  "Hard": 500
};

/**
 * 난이도별 점수 배율
 */
export const DIFFICULTY_MULTIPLIER = {
  "Easy": 1.0,
  "Normal": 1.1,
  "Hard": 1.2
};

/** [SECURITY] 유효한 난이도 목록 */
const VALID_DIFFICULTIES = ["Easy", "Normal", "Hard", "Hell"];

/** [SECURITY] 유효한 게임 페이즈 목록 */
const VALID_PHASES = ["ENTRY", "MEMORIZE", "GUESS", "INTERIM", "SCOREBOARD"];

export function getDifficultyTime(diff) {
  if (diff === "Hell") {
    // 0.1초 ~ 0.2초 (100 ~ 200ms)
    return Math.floor(Math.random() * 100) + 100;
  }
  return DIFFICULTY_TIME[diff] || 2000;
}

export function getDifficultyMultiplier(diff) {
  if (diff === "Hell") {
    // 1.25 ~ 1.30 (소수점 둘째자리까지)
    return parseFloat((Math.random() * 0.05 + 1.25).toFixed(2));
  }
  return DIFFICULTY_MULTIPLIER[diff] || 1.0;
}

export function getDifficultyName(diff) {
  switch(diff) {
    case "Easy": return "일반";
    case "Normal": return "어려움";
    case "Hard": return "매우어려움";
    case "Hell": return "지옥";
    default: return diff;
  }
}

/**
 * [SECURITY] 플레이어 정보 설정 (입력 길이 제한)
 */
export function setPlayerInfo(name, game) {
  state.playerName = typeof name === 'string' ? name.substring(0, 30) : "";
  state.originGame = typeof game === 'string' ? game.substring(0, 50) : "";
}

/**
 * [SECURITY] 난이도 설정 (화이트리스트 검증)
 */
export function setDifficulty(difficulty) {
  if (VALID_DIFFICULTIES.includes(difficulty)) {
    state.difficulty = difficulty;
  }
}

/**
 * [SECURITY] 페이즈 설정 (화이트리스트 검증)
 */
export function setPhase(phase) {
  if (VALID_PHASES.includes(phase)) {
    state.phase = phase;
  }
}

export function setTargetColor(color) {
  if (color && typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number') {
    state.targetColor = {
      r: Math.max(0, Math.min(255, Math.floor(color.r))),
      g: Math.max(0, Math.min(255, Math.floor(color.g))),
      b: Math.max(0, Math.min(255, Math.floor(color.b)))
    };
  }
}

/**
 * [SECURITY] 유저 색상 설정 (RGB 범위 검증)
 */
export function setUserColor(r, g, b) {
  state.userColor = {
    r: Math.max(0, Math.min(255, Math.floor(Number(r) || 0))),
    g: Math.max(0, Math.min(255, Math.floor(Number(g) || 0))),
    b: Math.max(0, Math.min(255, Math.floor(Number(b) || 0)))
  };
}

/**
 * [SECURITY] 점수 설정 (범위 검증 및 클램핑)
 */
export function setScore(score) {
  state.score = clampScore(score, state.difficulty);
}

/**
 * [SECURITY] 라운드 결과 기록 (점수 범위 검증)
 * @param {number} score - 해당 라운드 점수 (배율 적용 전)
 * @param {Object} targetColor - 목표 색상
 * @param {Object} userColor - 유저 선택 색상
 */
export function addRoundResult(score, targetColor, userColor) {
  // 라운드 점수 범위 검증
  const validatedScore = isValidRoundScore(score) ? Math.floor(score) : 0;
  
  // 라운드 결과 수 제한 (최대 maxRounds)
  if (state.roundResults.length >= state.maxRounds) return;
  
  state.roundResults.push({
    score: validatedScore,
    targetColor: targetColor ? { ...targetColor } : null,
    userColor: userColor ? { ...userColor } : null
  });
}

export function nextRound() {
  if (state.currentRound < state.maxRounds) {
    state.currentRound++;
  }
}

/**
 * [SECURITY] 상태 반환 (Deep Copy)
 * 외부에서 반환된 객체를 변형해도 내부 state에 영향 없음
 */
export function getState() {
  return JSON.parse(JSON.stringify(state));
}

export function resetGame() {
  state.targetColor = null;
  state.userColor = { r: 128, g: 128, b: 128 };
  state.score = 0;
  state.currentRound = 1;
  state.roundResults = [];
  state.phase = "ENTRY";
}
