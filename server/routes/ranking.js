/**
 * 랭킹 라우트
 * GET /api/rankings - 게임별/플레이어별 랭킹 조회
 */

import { Router } from 'express';
import { getGameRankings, getPlayerRankings } from '../db.js';

const router = Router();

/**
 * 전체 랭킹 조회
 * 게임별 랭킹 + 플레이어별 랭킹을 한번에 반환
 */
router.get('/', (req, res) => {
  try {
    const gameRankings = getGameRankings();
    const playerRankings = getPlayerRankings();

    res.json({ gameRankings, playerRankings });
  } catch (err) {
    console.error('[rankings]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
