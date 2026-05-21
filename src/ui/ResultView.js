/**
 * ResultView - 중간 결과 화면 (라운드별 점수)
 * 
 * 담당: 라운드 점수 표시 + 다음 라운드/최종 결과 분기
 */

import { getState, setScore, nextRound, getDifficultyMultiplier } from '../core/GameState.js';
import { toRGBString, rgbToHex, rgbToHsl, getAverageColor, getButtonContrastStyle } from '../utils/ColorUtils.js';

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

  // 버튼 배경 대비색 (좌우 평균)
  const avgBg = getAverageColor(state.targetColor, state.userColor);
  const btnStyle = getButtonContrastStyle(avgBg);

  const targetHsl = rgbToHsl(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const userHsl = rgbToHsl(state.userColor.r, state.userColor.g, state.userColor.b);
  
  let hDiff = userHsl.h - targetHsl.h;
  if (hDiff > 180) hDiff -= 360;
  if (hDiff < -180) hDiff += 360;
  const sDiff = userHsl.s - targetHsl.s;
  const lDiff = userHsl.l - targetHsl.l;

  container.innerHTML = `
    <div class="split-screen-result" id="interim-panel">
      <!-- 50:50 분할 배경 -->
      <div class="split-screen-half" style="background-color: ${targetRGB};"></div>
      <div class="split-screen-half" style="background-color: ${userRGB};"></div>
      
      <!-- 통합 블러 덮개 (경계선 문제 해결용) -->
      <div style="position: absolute; inset: -10%; backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); pointer-events: none; z-index: 1;"></div>
      
      <!-- 매거진 오버레이 (blend mode 제거, JS 기반 대비색 사용) -->
      <div class="magazine-overlay" style="z-index: 2;">
        
        <!-- 상단 라운드 표시 -->
        <div style="display: flex; justify-content: flex-start; width: 100%; flex-shrink: 0; margin-bottom: auto; padding-left: 2vw;">
          <div style="font-family: 'Paperlogy', sans-serif; font-size: 0.85rem; color: ${leftContrast}; padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: 800; letter-spacing: 1px;">
            ROUND ${state.currentRound} / ${state.maxRounds}
          </div>
        </div>
        
        <!-- 중앙 영역: 헥스코드 + 스코어 -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: auto;">
          <div style="display: flex; gap: 4rem; margin-bottom: 1rem;">
            <div style="font-size: clamp(1rem, 3vw, 1.5rem); color: ${leftContrast}; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 3px;">
              ${targetHex}
            </div>
            <div style="font-size: clamp(1rem, 3vw, 1.5rem); color: ${rightContrast}; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 3px;">
              ${userHex}
            </div>
          </div>
          
          <div class="magazine-score">
            <div style="line-height: 1; color: var(--btn-color, #fff);">
              <span class="animated-score" data-target="${state.score}">0</span>
            </div>
          </div>
        </div>
        
      </div>
      
      <div style="position: fixed; bottom: 3rem; left: 0; right: 0; margin: 0 auto; text-align: center; width: calc(100% - 3rem); max-width: 400px; z-index: 3000; pointer-events: auto;">
        <button class="magazine-start-btn" id="next-round-btn" style="width: 100%; --btn-color: ${btnStyle.textColor}; --btn-border: ${btnStyle.borderColor}; --btn-bg: ${btnStyle.glassBg}; --btn-hover-bg: ${btnStyle.hoverBg};">${state.currentRound < state.maxRounds ? 'NEXT ROUND' : 'FINAL RESULT'}</button>
      </div>
    </div>
  `;

  const animatedScore = container.querySelector('.animated-score');
  if (animatedScore) {
    const target = parseInt(animatedScore.getAttribute('data-target'));
    const duration = 1200;
    
    animateValue(animatedScore, 0, target, duration, true);
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
        
        if (nav._serverFinalScore != null) {
          finalScore = nav._serverFinalScore;
          multiplier = nav._serverMultiplier || 1.0;
          nav._serverFinalScore = null;
          nav._serverMultiplier = null;
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
