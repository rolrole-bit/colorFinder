/**
 * 라운드 라우트
 * POST /api/round/submit - 유저 색상 제출, 서버가 점수 계산
 */

import { Router } from 'express';
import { getSession, addRoundScore, saveRanking } from '../db.js';
import { calculateScore, getDifficultyTime } from '../utils/scoreCalc.js';

const router = Router();

/**
 * 라운드 제출
 * 1. 세션에서 현재 라운드의 타겟 색상 조회
 * 2. 서버가 직접 점수 계산 (클라이언트 변조 불가)
 * 3. 마지막 라운드면 최종 점수 확정 & 랭킹 저장
 */
router.post('/submit', (req, res) => {
  try {
    const { sessionId, userColor } = req.body;

    // 입력 검증
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    if (!userColor || typeof userColor.r !== 'number' || typeof userColor.g !== 'number' || typeof userColor.b !== 'number') {
      return res.status(400).json({ error: 'Invalid userColor format' });
    }

    // RGB 범위 검증
    const r = Math.max(0, Math.min(255, Math.floor(userColor.r)));
    const g = Math.max(0, Math.min(255, Math.floor(userColor.g)));
    const b = Math.max(0, Math.min(255, Math.floor(userColor.b)));

    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.completed_at) return res.status(400).json({ error: 'Session already completed' });

    const currentRound = session.current_round;
    if (currentRound > session.max_rounds) {
      return res.status(400).json({ error: 'All rounds completed' });
    }

    // 서버에 저장된 타겟 색상으로 점수 계산
    const targetColor = session.target_colors[currentRound - 1];
    const score = calculateScore(targetColor, { r, g, b });

    // 라운드 점수 저장 & 진행
    const updated = addRoundScore(sessionId, score);
    const isLastRound = currentRound >= session.max_rounds;

    const response = {
      score,
      round: currentRound,
      targetColor,  // 결과 화면에서 비교용으로 공개
      userColor: { r, g, b },
      isLastRound
    };

    if (isLastRound) {
      // 최종 점수 확정 & 랭킹 저장
      response.finalScore = updated.final_score;
      response.multiplier = session.multiplier;

      saveRanking(
        session.player_name,
        session.origin_game,
        updated.final_score,
        session.difficulty,
        sessionId
      );
    } else {
      // 다음 라운드 타겟 색상 전달
      response.nextTargetColor = session.target_colors[currentRound];
      response.nextRound = currentRound + 1;
      response.memorizeTime = getDifficultyTime(session.difficulty);
    }

    res.json(response);
  } catch (err) {
    console.error('[round/submit]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
