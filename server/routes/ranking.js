/**
 * 랭킹 라우트
 * GET /api/rankings - 게임별/플레이어별 랭킹 조회
 */

import { Router } from 'express';
import { loadRankings, computeGameRankings, computeAllPlayerRankings } from '../db.js';

const router = Router();

/**
 * 전체 랭킹 조회
 * 게임별 랭킹 + 플레이어별 랭킹을 한번에 반환
 * [PERFORMANCE] rankings.json 1회만 읽어서 3가지 뷰를 계산
 */
router.get('/', (req, res) => {
  try {
    const rawRankings = loadRankings();  // 파일 I/O 1회만
    const gameRankings = computeGameRankings(rawRankings);
    const allPlayers = computeAllPlayerRankings(rawRankings);
    const playerRankings = allPlayers.slice(0, 5);
    const totalPlayers = allPlayers.length;

    res.json({ gameRankings, playerRankings, totalPlayers });
  } catch (err) {
    console.error('[rankings]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
