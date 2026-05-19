/**
 * ShareManager - 공유 기능 전담 모듈
 * 
 * 담당: 클립보드 복사, SNS 공유 URL 생성, 공유 모달 이벤트 바인딩
 * ScoreboardView에서 분리됨
 */

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
 * SNS 공유 링크 생성
 * @param {string} shareUrl - 공유 페이지 URL
 * @param {string} shareText - 공유 텍스트
 * @returns {{ twitter: string, facebook: string }}
 */
export function buildSnsLinks(shareUrl, shareText) {
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  };
}

/**
 * 공유 모달 이벤트 바인딩
 * @param {object} state - 게임 상태
 * @param {function} getComment - 한줄평 생성 함수
 */
export function bindShareEvents(state, getComment) {
  // 공유하기 버튼 → 모달 열기
  document.getElementById('share-btn').addEventListener('click', () => {
    const comment = getComment(state.score);
    const sharePageUrl = buildShareUrl(state, comment);
    const shareText = `DYE MASTER에서 ${state.score.toLocaleString()}점! 🎨 나의 색감을 증명하세요!`;
    const snsLinks = buildSnsLinks(sharePageUrl, shareText);

    // URL 세팅
    document.getElementById('share-url-input').value = sharePageUrl;
    document.getElementById('share-twitter').href = snsLinks.twitter;
    document.getElementById('share-facebook').href = snsLinks.facebook;

    // Instagram은 공유 API 없음 → URL 복사 후 안내
    const instaBtn = document.getElementById('share-instagram');
    instaBtn.href = '#';
    instaBtn.onclick = (e) => {
      e.preventDefault();
      copyToClipboard(sharePageUrl).then(() => {
        alert('URL이 복사되었습니다!\nInstagram 스토리나 게시물에 붙여넣기 하세요.');
      });
    };

    // 모달 표시
    document.getElementById('share-modal').style.display = 'flex';
  });

  // URL 복사 버튼
  document.getElementById('copy-url-btn').addEventListener('click', () => {
    const urlInput = document.getElementById('share-url-input');
    copyToClipboard(urlInput.value).then(() => {
      const btn = document.getElementById('copy-url-btn');
      btn.textContent = '✅ 복사됨';
      setTimeout(() => { btn.textContent = 'URL 복사'; }, 1500);
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
