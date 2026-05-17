/**
 * Ranking
 * LocalStorage를 활용하여 점수 데이터를 기록하고 순위 리스트를 반환하는 모듈
 */

const STORAGE_KEY = "colorFinder_rankings";

/**
 * 스토리지에서 기록을 가져옵니다.
 * @returns {Array} 기록 배열
 */
function getRecords() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

/**
 * 새로운 게임 결과를 스토리지에 저장합니다.
 * @param {string} playerName 
 * @param {string} originGame 
 * @param {number} score 
 */
export function saveRecord(playerName, originGame, score) {
  const records = getRecords();
  records.push({
    playerName,
    originGame,
    score,
    date: new Date().toISOString()
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * 게임별 정확도 순위를 계산하여 반환합니다. (상위 5개)
 * 각 게임별로 최고 점수(또는 평균)를 기준으로 할 수 있으나, 여기서는 해당 게임의 '최고 점수'를 기준으로 합니다.
 * @returns {Array} [{ game: '마비노기', score: 98.5 }, ...]
 */
export function getGameRankings() {
  const records = getRecords();
  const gameMap = {};

  records.forEach(r => {
    if (!gameMap[r.originGame] || gameMap[r.originGame] < r.score) {
      gameMap[r.originGame] = r.score;
    }
  });

  const sortedGames = Object.keys(gameMap).map(game => ({
    game,
    score: gameMap[game]
  })).sort((a, b) => b.score - a.score);

  return sortedGames.slice(0, 5);
}

/**
 * 전체 플레이어 순위를 반환합니다. (상위 5개)
 * @returns {Array} [{ playerName: '유저1', originGame: 'WOW', score: 99.1 }, ...]
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

/**
 * 모든 게임의 순위를 반환합니다.
 * @returns {Array} [{ game: '마비노기', score: 98.5 }, ...]
 */
export function getAllGameRankings() {
  const records = getRecords();
  const gameMap = {};

  records.forEach(r => {
    if (!gameMap[r.originGame] || gameMap[r.originGame] < r.score) {
      gameMap[r.originGame] = r.score;
    }
  });

  const sortedGames = Object.keys(gameMap).map(game => ({
    game,
    score: gameMap[game]
  })).sort((a, b) => b.score - a.score);

  return sortedGames;
}
