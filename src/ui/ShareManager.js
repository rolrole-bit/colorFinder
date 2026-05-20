/**
 * ShareManager - 공유 기능 전담 모듈
 * 
 * 담당: 클립보드 복사, 공유 URL 생성, 공유 카드 미리보기 모달 이벤트
 * SNS 버튼 제거 → 카드 미리보기 + URL 복사 방식으로 전환
 */

import { escapeHTML } from '../utils/AntiCheat.js';

/**
 * 클립보드 복사 (HTTPS 없이도 동작하는 폴백 포함)
 * @param {string} text - 복사할 텍스트
 * @returns {Promise<void>}
 */
export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // HTTP 환경 폴백
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}

/**
 * 공유 URL 생성 (라운드별 색상 데이터 포함)
 * @param {object} state - 게임 상태
 * @param {string} comment - 한줄평 텍스트
 * @returns {string} 공유 페이지 URL
 */
export function buildShareUrl(state, comment) {
  const rounds = state.roundResults || [];
  const tcColors = rounds.map(r => `${r.targetColor.r},${r.targetColor.g},${r.targetColor.b}`).join('|');
  const ucColors = rounds.map(r => `${r.userColor.r},${r.userColor.g},${r.userColor.b}`).join('|');
  const colorParam = tcColors ? `&tc=${tcColors}&uc=${ucColors}` : '';
  return `${window.location.origin}/share?score=${state.score}&name=${encodeURIComponent(state.playerName)}&comment=${encodeURIComponent(comment)}${colorParam}`;
}

/**
 * 공유 카드 미리보기 모달 이벤트 바인딩
 * 공유하기 버튼 → 배경 블러 + 카드 미리보기 + URL 복사
 * @param {object} state - 게임 상태
 * @param {function} getComment - 한줄평 생성 함수
 */
export function bindShareEvents(state, getComment) {
  // 공유하기 버튼 → 카드 미리보기 모달 열기
  document.getElementById('share-btn').addEventListener('click', () => {
    const comment = getComment(state.score);
    const sharePageUrl = buildShareUrl(state, comment);

    // 카드 미리보기 데이터 채우기
    const nameEl = document.getElementById('share-card-name');
    const scoreEl = document.getElementById('share-card-score');
    const commentEl = document.getElementById('share-card-comment');
    
    if (nameEl) nameEl.textContent = `${state.playerName}님의 점수`;
    if (scoreEl) scoreEl.textContent = state.score.toLocaleString();
    if (commentEl) commentEl.textContent = comment;

    // URL 세팅
    document.getElementById('share-url-input').value = sharePageUrl;

    // 모달 표시
    document.getElementById('share-modal').style.display = 'flex';
  });

  // URL 복사 버튼
  document.getElementById('copy-url-btn').addEventListener('click', () => {
    const urlInput = document.getElementById('share-url-input');
    copyToClipboard(urlInput.value).then(() => {
      const btn = document.getElementById('copy-url-btn');
      const originalText = btn.textContent;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> 복사됨!';
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      setTimeout(() => {
        btn.textContent = 'URL 복사';
        btn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
      }, 2000);
    });
  });

  // 모달 닫기
  document.getElementById('share-close-btn').addEventListener('click', () => {
    document.getElementById('share-modal').style.display = 'none';
  });
  document.getElementById('share-modal').addEventListener('click', (e) => {
    if (e.target.id === 'share-modal') {
      document.getElementById('share-modal').style.display = 'none';
    }
  });
}
