/**
 * ResultView - 중간 결과 화면 (라운드별 점수)
 * 
 * 담당: 라운드 점수 표시 + 다음 라운드/최종 결과 분기
 */

import { getState, setScore, nextRound, getDifficultyMultiplier } from '../core/GameState.js';
import { toRGBString, rgbToHex, rgbToHsl } from '../utils/ColorUtils.js';
import { saveRecord } from '../core/Ranking.js';
import { isSessionValid, clampScore } from '../utils/AntiCheat.js';
import { getContrastYIQ, animateValue } from './AnimationUtils.js';

/**
 * 중간 결과 화면 렌더링
 * @param {HTMLElement} container - 렌더링 대상
 * @param {object} nav - 네비게이션 콜백
 * @param {function} nav.toGameView - 게임 화면으로 전환
 * @param {function} nav.toScoreboardView - 스코어보드로 전환
 */
export function renderInterimResultView(container, nav) {
  const state = getState();
  const targetRGB = toRGBString(state.targetColor);
  const userRGB = toRGBString(state.userColor);
  const targetHex = rgbToHex(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const userHex = rgbToHex(state.userColor.r, state.userColor.g, state.userColor.b);
  
  const leftContrast = getContrastYIQ(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const rightContrast = getContrastYIQ(state.userColor.r, state.userColor.g, state.userColor.b);

  const targetHsl = rgbToHsl(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const userHsl = rgbToHsl(state.userColor.r, state.userColor.g, state.userColor.b);
  
  let hDiff = userHsl.h - targetHsl.h;
  if (hDiff > 180) hDiff -= 360;
  if (hDiff < -180) hDiff += 360;
  const sDiff = userHsl.s - targetHsl.s;
  const lDiff = userHsl.l - targetHsl.l;

  const perfects = [];
  const flaws = [];
  
  if (Math.abs(hDiff) <= 4) perfects.push("색조"); else flaws.push("색조");
  if (Math.abs(sDiff) <= 4) perfects.push("채도"); else flaws.push("채도");
  if (Math.abs(lDiff) <= 4) perfects.push("명도"); else flaws.push("명도");

  let feedbackText = "";
  if (perfects.length === 3) {
    feedbackText = "완벽하게 색상을 맞추셨습니다!";
  } else if (perfects.length === 0) {
    feedbackText = "색조, 채도, 명도 모두 많은 조절과 노력이 필요합니다.";
  } else {
    const pStr = perfects.join("와 ");
    const fStr = flaws.join("와 ");
    feedbackText = `${pStr}는 완벽하나, ${fStr}가 다소 아쉽습니다.`;
  }

  const feedbackHTML = `
    <div style="margin-top: 1.5rem; font-family: 'Paperlogy', sans-serif; font-size: 0.95rem; color: #fff; letter-spacing: 1px; line-height: 1.6; text-align: center; word-break: keep-all; font-weight: 300; background: rgba(0,0,0,0.2); padding: 0.8rem 1.2rem; border-radius: 12px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));">
      ${feedbackText}
    </div>
  `;

  container.innerHTML = `
    <div class="split-screen-result" id="interim-panel">
      <!-- 50:50 분할 배경 -->
      <div class="split-screen-half" style="background-color: ${targetRGB};"></div>
      <div class="split-screen-half" style="background-color: ${userRGB};"></div>
      
      <!-- 매거진 오버레이 -->
      <div class="magazine-overlay">
        
        <!-- 상단 라운드 표시 -->
        <div style="display: flex; justify-content: flex-start; width: 100%; flex-shrink: 0; margin-bottom: auto; padding-left: 2vw;">
          <div style="font-family: 'Paperlogy', sans-serif; font-size: 0.85rem; color: ${leftContrast}; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: 800; letter-spacing: 1px;">
            ROUND ${state.currentRound} / ${state.maxRounds}
          </div>
        </div>
        
        <!-- 중앙 영역: 헥스코드 + 스코어 -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="display: flex; gap: 4rem; margin-bottom: 1rem;">
            <div style="font-size: clamp(1rem, 3vw, 1.5rem); color: ${targetRGB}; background-color: ${leftContrast}; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 3px;">
              ${targetHex}
            </div>
            <div style="font-size: clamp(1rem, 3vw, 1.5rem); color: ${userRGB}; background-color: ${rightContrast}; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 3px;">
              ${userHex}
            </div>
          </div>
          
          <div class="magazine-score">
            <div class="animated-gradient-text" style="line-height: 1;">
              <span class="animated-score" data-target="${state.score}">0</span>
            </div>
          </div>
          ${feedbackHTML}
        </div>
        
        <div style="margin-top: auto; text-align: center; width: 100%; max-width: 400px; z-index: 100; pointer-events: auto;">
          <button class="magazine-start-btn" id="next-round-btn" style="width: 100%;">${state.currentRound < state.maxRounds ? '다음 라운드' : '최종 결과'}</button>
        </div>
      </div>
    </div>
  `;

  const animatedScore = container.querySelector('.animated-score');
  if (animatedScore) {
    const target = parseInt(animatedScore.getAttribute('data-target'));
    animateValue(animatedScore, 0, target, 1200, true);
  }

  document.getElementById('next-round-btn').addEventListener('click', () => {
    const panel = document.getElementById('interim-panel');
    panel.style.opacity = '0';
    panel.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (state.currentRound < state.maxRounds) {
        nextRound();
        nav.toGameView();
      } else {
        // [Phase 2] 서버가 계산한 최종 점수 사용
        let finalScore;
        let multiplier;
        
        if (state._serverFinalScore != null) {
          finalScore = state._serverFinalScore;
          multiplier = state._serverMultiplier || 1.0;
        } else {
          let baseTotalScore = 0;
          state.roundResults.forEach(r => {
            baseTotalScore += r.score;
          });
          multiplier = getDifficultyMultiplier(state.difficulty);
          finalScore = Math.floor(baseTotalScore * multiplier);
          finalScore = clampScore(finalScore, state.difficulty);
        }
        
        if (!isSessionValid()) {
          finalScore = 0;
        }
        
        setScore(finalScore);
        
        if (finalScore >= 2500) {
          localStorage.setItem('hell_unlocked', 'true');
        }
        
        // 캐시 무효화만 (서버 저장은 round/submit에서 완료됨)
        saveRecord(state.playerName, state.originGame, finalScore, state.difficulty);
        nav.toScoreboardView(multiplier);
      }
    }, 300);
  });
}
