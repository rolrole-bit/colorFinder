import { calculateAccuracy, hslToRgb } from '../utils/ColorUtils.js';
import { saveRecord, getGameRankings, getPlayerRankings } from '../core/Ranking.js';
import { setPlayerInfo, setTargetColor, setUserColor, setScore, getState, setDifficulty } from '../core/GameState.js';

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
  console.log("--- ColorFinder 단위 테스트 시작 ---");
  
  // 1. ColorUtils 테스트
  const color1 = { r: 255, g: 0, b: 0 };
  const color2 = { r: 255, g: 0, b: 0 };
  assertEqual(calculateAccuracy(color1, color2), 100, "동일한 색상 정확도 100%");
  
  const color3 = { r: 0, g: 255, b: 255 }; // 반대 색상
  // 최대 거리는 441.67, 완전히 반대면 거리가 441.67이므로 정확도 0%
  assertEqual(calculateAccuracy(color1, color3), 0, "완전 반대 색상 정확도 0%");

  // HSL <-> RGB 변환 테스트
  assertDeepEqual(hslToRgb(0, 100, 50), {r: 255, g: 0, b: 0}, "HSL(0, 100%, 50%) -> RGB(255, 0, 0)");
  assertDeepEqual(hslToRgb(120, 100, 50), {r: 0, g: 255, b: 0}, "HSL(120, 100%, 50%) -> RGB(0, 255, 0)");
  assertDeepEqual(hslToRgb(240, 100, 50), {r: 0, g: 0, b: 255}, "HSL(240, 100%, 50%) -> RGB(0, 0, 255)");

  // 2. GameState 테스트
  setPlayerInfo("TestUser", "마비노기");
  setTargetColor({ r: 10, g: 20, b: 30 });
  setUserColor(10, 20, 30);
  setScore(100);
  const state = getState();
  assertEqual(state.playerName, "TestUser", "상태 관리: 플레이어 이름 설정");
  assertEqual(state.score, 100, "상태 관리: 점수 설정");

  // 3. Ranking 테스트 (모의 데이터 삽입 전 LocalStorage 클리어 - 테스트 환경용)
  localStorage.removeItem('colorFinder_rankings');
  saveRecord("UserA", "WOW", 95.5);
  saveRecord("UserB", "WOW", 80.0);
  saveRecord("UserC", "던파", 99.9);
  
  const gameRanks = getGameRankings();
  assertEqual(gameRanks[0].game, "던파", "게임 랭킹 정렬: 던파 1위");
  assertEqual(gameRanks[0].score, 99.9, "게임 랭킹 정렬: 던파 점수");
  assertEqual(gameRanks[1].game, "WOW", "게임 랭킹 정렬: WOW 2위");
  assertEqual(gameRanks[1].score, 95.5, "게임 랭킹 정렬: WOW 점수 (최고점 기준)");

  const playerRanks = getPlayerRankings();
  assertEqual(playerRanks[0].playerName, "UserC", "플레이어 랭킹 1위 이름");
  assertEqual(playerRanks[0].score, 99.9, "플레이어 랭킹 1위 점수");
  
  console.log("--- ColorFinder 단위 테스트 종료 ---");
}
