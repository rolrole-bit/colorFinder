/**
 * 세션 라우트
 * POST /api/session/start - 게임 세션 시작, 타겟 색상 발급
 */

import { Router } from 'express';
import { createSession, getSession } from '../db.js';
import { getRandomColor, getDifficultyMultiplier, getDifficultyTime } from '../utils/scoreCalc.js';

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

    // 입력 검증
    if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
      return res.status(400).json({ error: 'playerName is required' });
    }
    if (!originGame || typeof originGame !== 'string' || originGame.trim().length === 0) {
      return res.status(400).json({ error: 'originGame is required' });
    }
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty' });
    }

    // 입력 새니타이징
    const cleanName = playerName.replace(/<[^>]*>/g, '').trim().substring(0, 30);
    const cleanGame = originGame.replace(/<[^>]*>/g, '').trim().substring(0, 50);

    // 3라운드 분의 타겟 색상 서버에서 미리 생성
    const targetColors = [getRandomColor(), getRandomColor(), getRandomColor()];
    const multiplier = getDifficultyMultiplier(difficulty);
    const memorizeTime = getDifficultyTime(difficulty);

    const sessionId = createSession(cleanName, cleanGame, difficulty, targetColors, multiplier);

    res.json({
      sessionId,
      targetColor: targetColors[0],  // 1라운드 색상만 전달
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

/**
 * 세션 정보 조회 (디버그용, 프로덕션에서는 비활성화 권장)
 */
router.get('/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // 타겟 색상은 반환하지 않음 (보안)
  const { target_colors, ...safe } = session;
  res.json(safe);
});

export default router;
