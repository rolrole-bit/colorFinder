/**
 * Ranking
 * LocalStorage를 활용하여 점수 데이터를 기록하고 순위 리스트를 반환하는 모듈
 * 점수는 정수 기반 (0~4500점 범위)
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
 * @param {string} playerName - 플레이어 이름
 * @param {string} originGame - 출신 게임
 * @param {number} score - 최종 점수 (정수)
 * @param {string} difficulty - 난이도
 */
export function saveRecord(playerName, originGame, score, difficulty) {
  const records = getRecords();
  records.push({
    playerName,
    originGame,
    score,
    difficulty,
    date: new Date().toISOString()
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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
