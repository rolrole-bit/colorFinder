/**
 * 라운드 라우트 v2.1 (Security Hardened)
 * POST /api/round/submit - 유저 색상 제출, 서버가 점수 계산
 */

import { Router } from 'express';
import { getSession, addRoundScore, saveRanking } from '../db.js';
import { calculateScore, getDifficultyTime } from '../utils/scoreCalc.js';

const router = Router();

// [SECURITY] 라운드별 최소 제출 간격 (ms) — 즉시 제출 봇 차단
const MIN_ROUND_INTERVAL_MS = 1000;

// [SECURITY] 동일 세션 동시 제출 방지 (처리 중 잠금)
const processingLock = new Set();

router.post('/submit', (req, res) => {
  try {
    const { sessionId, userColor } = req.body;

    // 입력 검증
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!userColor || typeof userColor.r !== 'number' || typeof userColor.g !== 'number' || typeof userColor.b !== 'number') {
      return res.status(400).json({ error: 'Invalid userColor format' });
    }

    // [SECURITY] NaN/Infinity 검증
    if (!Number.isFinite(userColor.r) || !Number.isFinite(userColor.g) || !Number.isFinite(userColor.b)) {
      return res.status(400).json({ error: 'Invalid color values' });
    }

    // RGB 범위 클램핑
    const r = Math.max(0, Math.min(255, Math.floor(userColor.r)));
    const g = Math.max(0, Math.min(255, Math.floor(userColor.g)));
    const b = Math.max(0, Math.min(255, Math.floor(userColor.b)));

    // [SECURITY] 동시 제출 방지
    if (processingLock.has(sessionId)) {
      return res.status(409).json({ error: 'Request already processing' });
    }
    processingLock.add(sessionId);

    try {
      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session.completed_at) {
        return res.status(400).json({ error: 'Session already completed' });
      }

      const currentRound = session.current_round;
      if (currentRound > session.max_rounds) {
        return res.status(400).json({ error: 'All rounds completed' });
      }

      // [SECURITY] 타이밍 검증 — 너무 빠른 제출 차단
      const now = Date.now();
      const lastAction = session._lastSubmitTime || new Date(session.created_at).getTime();
      if (now - lastAction < MIN_ROUND_INTERVAL_MS) {
        return res.status(429).json({ 
          error: 'Submission too fast',
          retryAfterMs: MIN_ROUND_INTERVAL_MS - (now - lastAction)
        });
      }
      session._lastSubmitTime = now;

      // 서버에 저장된 타겟 색상으로 점수 계산
      const targetColor = session.target_colors[currentRound - 1];
      const score = calculateScore(targetColor, { r, g, b });

      // [SECURITY] 점수 범위 클램핑 (0~1500)
      const clampedScore = Math.max(0, Math.min(1500, Math.floor(score)));

      // 라운드 점수 저장 & 진행
      const updated = addRoundScore(sessionId, clampedScore);
      const isLastRound = currentRound >= session.max_rounds;

      const response = {
        score: clampedScore,
        round: currentRound,
        targetColor,
        userColor: { r, g, b },
        isLastRound
      };

      if (isLastRound) {
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
        response.nextTargetColor = session.target_colors[currentRound];
        response.nextRound = currentRound + 1;
        response.memorizeTime = getDifficultyTime(session.difficulty);
      }

      res.json(response);
    } finally {
      processingLock.delete(sessionId);
    }
  } catch (err) {
    console.error('[round/submit]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
