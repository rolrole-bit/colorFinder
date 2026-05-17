/**
 * GameState
 * 게임의 현재 상태를 저장하고 관리하는 모듈
 */

const state = {
  playerName: "",
  originGame: "",
  difficulty: "Normal",
  phase: "ENTRY",
  targetColor: null,
  userColor: { r: 128, g: 128, b: 128 },
  score: 0,
  timeTaken: 0,
  currentRound: 1,
  maxRounds: 3,
  roundResults: [] // array of { score, timeTaken }
};

export const DIFFICULTY_TIME = {
  "Easy": 5000,
  "Normal": 3000,
  "Hard": 1000
};

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

export function setTimeTaken(time) {
  state.timeTaken = time;
}

export function addRoundResult(score, timeTaken, targetColor, userColor) {
  state.roundResults.push({ score, timeTaken, targetColor, userColor });
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
  state.timeTaken = 0;
  state.currentRound = 1;
  state.roundResults = [];
  state.phase = "ENTRY";
}
