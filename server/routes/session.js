/**
 * 세션 라우트 v2.1 (Security Hardened)
 * POST /api/session/start - 게임 세션 시작, 타겟 색상 발급
 */

import { Router } from 'express';
import { createSession } from '../db.js';
import { getRandomColor, getDifficultyMultiplier, getDifficultyTime } from '../utils/scoreCalc.js';
import { sanitizePlayerName, sanitizeGameName } from '../utils/security.js';

const router = Router();

const VALID_DIFFICULTIES = ["Easy", "Normal", "Hard", "Hell"];

/**
 * 게임 세션 시작
 * 서버가 3라운드 분의 타겟 색상을 미리 생성하여 보관
 * 클라이언트에는 1라운드 색상만 전달
 */
router.post('/start', (req, res) => {
  try {
    const { playerName, originGame, difficulty } = req.body;

    // 입력 타입 검증
    if (!playerName || typeof playerName !== 'string') {
      return res.status(400).json({ error: 'playerName is required' });
    }
    if (!originGame || typeof originGame !== 'string') {
      return res.status(400).json({ error: 'originGame is required' });
    }
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty' });
    }

    // [SECURITY] 강화된 입력 새니타이징
    const cleanName = sanitizePlayerName(playerName);
    const cleanGame = sanitizeGameName(originGame);

    if (!cleanName || cleanName.length === 0) {
      return res.status(400).json({ error: 'Invalid playerName' });
    }
    if (!cleanGame || cleanGame.length === 0) {
      return res.status(400).json({ error: 'Invalid originGame' });
    }

    // 3라운드 분의 타겟 색상 서버에서 미리 생성
    const targetColors = [getRandomColor(), getRandomColor(), getRandomColor()];
    const multiplier = getDifficultyMultiplier(difficulty);
    const memorizeTime = getDifficultyTime(difficulty);

    const sessionId = createSession(cleanName, cleanGame, difficulty, targetColors, multiplier);

    // [SECURITY] 세션 생성 실패 처리 (상한 초과)
    if (!sessionId) {
      return res.status(503).json({ error: 'Server is busy. Please try again later.' });
    }

    res.json({
      sessionId,
      targetColor: targetColors[0],
      round: 1,
      maxRounds: 3,
      memorizeTime,
      difficulty
    });
  } catch (err) {
    console.error('[session/start]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// [SECURITY] 디버그 라우트 제거 — 프로덕션에서 세션 조회 불가

export default router;
