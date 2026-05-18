import { calculateScore, hslToRgb } from '../utils/ColorUtils.js';
import { saveRecord, getGameRankings, getPlayerRankings } from '../core/Ranking.js';
import { setPlayerInfo, setTargetColor, setUserColor, setScore, getState, setDifficulty } from '../core/GameState.js';
import { DIFFICULTY_MULTIPLIER } from '../core/GameState.js';

/**
 * 간단한 Assertion 함수
 */
function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName} - Expected ${expected}, but got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, testName) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName} - Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
  }
}

export function runTests() {
  console.log("--- DyeMaster 단위 테스트 시작 ---");
  
  // 1. calculateScore 테스트
  const color1 = { r: 255, g: 0, b: 0 };
  const color2 = { r: 255, g: 0, b: 0 };
  assertEqual(calculateScore(color1, color2), 1000, "동일한 색상 → 1000점 (만점)");
  
  const color3 = { r: 0, g: 255, b: 255 }; // 반대 색상
  assertEqual(calculateScore(color1, color3), 0, "완전 반대 색상 → 0점");

  // 중간 정확도 테스트: 각 채널 약간 차이
  const colorA = { r: 100, g: 100, b: 100 };
  const colorB = { r: 120, g: 110, b: 95 }; // deltaE = 20+10+5 = 35
  const expectedAccuracy = (765 - 35) / 765; // ~0.954
  const expectedScore = Math.floor(Math.pow(expectedAccuracy, 2) * 1000); // ~911
  assertEqual(calculateScore(colorA, colorB), expectedScore, `중간 정확도 → ${expectedScore}점`);

  // 2. 난이도 배율 테스트
  assertEqual(DIFFICULTY_MULTIPLIER["Easy"], 1.0, "Easy 배율 ×1.0");
  assertEqual(DIFFICULTY_MULTIPLIER["Normal"], 1.2, "Normal 배율 ×1.2");
  assertEqual(DIFFICULTY_MULTIPLIER["Hard"], 1.5, "Hard 배율 ×1.5");

  // 배율 적용 테스트
  const base = calculateScore(color1, color2); // 1000
  assertEqual(Math.floor(base * DIFFICULTY_MULTIPLIER["Hard"]), 1500, "Hard 만점 = 1500점");

  // HSL <-> RGB 변환 테스트
  assertDeepEqual(hslToRgb(0, 100, 50), {r: 255, g: 0, b: 0}, "HSL(0, 100%, 50%) -> RGB(255, 0, 0)");
  assertDeepEqual(hslToRgb(120, 100, 50), {r: 0, g: 255, b: 0}, "HSL(120, 100%, 50%) -> RGB(0, 255, 0)");
  assertDeepEqual(hslToRgb(240, 100, 50), {r: 0, g: 0, b: 255}, "HSL(240, 100%, 50%) -> RGB(0, 0, 255)");

  // 3. GameState 테스트
  setPlayerInfo("TestUser", "마비노기");
  setTargetColor({ r: 10, g: 20, b: 30 });
  setUserColor(10, 20, 30);
  setScore(2800);
  const state = getState();
  assertEqual(state.playerName, "TestUser", "상태 관리: 플레이어 이름 설정");
  assertEqual(state.score, 2800, "상태 관리: 점수 설정 (정수)");

  // 4. Ranking 테스트
  localStorage.removeItem('DyeMaster_rankings');
  saveRecord("UserA", "WOW", 2800, "Normal");
  saveRecord("UserB", "WOW", 2100, "Easy");
  saveRecord("UserC", "던파", 3600, "Hard");
  
  const gameRanks = getGameRankings();
  assertEqual(gameRanks[0].game, "던파", "게임 랭킹 정렬: 던파 1위");
  assertEqual(gameRanks[0].score, 3600, "게임 랭킹 정렬: 던파 점수");
  assertEqual(gameRanks[1].game, "WOW", "게임 랭킹 정렬: WOW 2위");
  assertEqual(gameRanks[1].score, 2800, "게임 랭킹 정렬: WOW 점수 (최고점 기준)");

  const playerRanks = getPlayerRankings();
  assertEqual(playerRanks[0].playerName, "UserC", "플레이어 랭킹 1위 이름");
  assertEqual(playerRanks[0].score, 3600, "플레이어 랭킹 1위 점수");
  
  console.log("--- DyeMaster 단위 테스트 종료 ---");
}
