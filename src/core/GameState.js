/**
 * GameState
 * 게임의 현재 상태를 저장하고 관리하는 모듈
 * 
 * 난이도별 기억 시간과 점수 배율을 관리합니다.
 */

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

export function getDifficultyTime(diff) {
  if (diff === "Hell") {
    // 0.2초 ~ 0.3초 (200 ~ 300ms)
    return Math.floor(Math.random() * 100) + 200;
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

export function setPlayerInfo(name, game) {
  state.playerName = name;
  state.originGame = game;
}

export function setDifficulty(difficulty) {
  state.difficulty = difficulty;
}

export function setPhase(phase) {
  state.phase = phase;
}

export function setTargetColor(color) {
  state.targetColor = color;
}

export function setUserColor(r, g, b) {
  state.userColor = { r, g, b };
}

export function setScore(score) {
  state.score = score;
}

/**
 * 라운드 결과를 기록합니다.
 * @param {number} score - 해당 라운드 점수 (배율 적용 후)
 * @param {Object} targetColor - 목표 색상
 * @param {Object} userColor - 유저 선택 색상
 */
export function addRoundResult(score, targetColor, userColor) {
  state.roundResults.push({ score, targetColor, userColor });
}

export function nextRound() {
  state.currentRound++;
}

export function getState() {
  return state;
}

export function resetGame() {
  state.targetColor = null;
  state.userColor = { r: 128, g: 128, b: 128 };
  state.score = 0;
  state.currentRound = 1;
  state.roundResults = [];
  state.phase = "ENTRY";
}
