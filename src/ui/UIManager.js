/**
 * UIManager - 뷰 라우터 (오케스트레이터)
 * 
 * 각 화면 모듈을 연결하고, 공유 상태(서버 세션)를 관리
 * 기존 833줄 → ~60줄로 축소
 */

import { renderEntryView } from './EntryView.js';
import { renderGameView } from './GameView.js';
import { renderInterimResultView } from './ResultView.js';
import { renderScoreBoardView } from './ScoreboardView.js';

// ═══ 서버 세션 공유 상태 ═══
let serverSessionId = null;
let serverNextTargetColor = null;

/**
 * 네비게이션 객체 팩토리
 * 모든 뷰가 동일한 nav 인터페이스를 통해 화면 전환 + 상태 접근
 */
function createNav(container) {
  return {
    // 화면 전환
    toEntryView: () => renderEntryView(container, createNav(container)),
    toGameView: () => renderGameView(container, createNav(container)),
    toResultView: () => renderInterimResultView(container, createNav(container)),
    toScoreboardView: (multiplier) => renderScoreBoardView(container, multiplier, createNav(container)),

    // 서버 세션 상태 접근
    getServerSessionId: () => serverSessionId,
    getServerNextTargetColor: () => serverNextTargetColor,
    setServerSession: (id, color) => {
      serverSessionId = id;
      serverNextTargetColor = color;
    },
    setServerNextTargetColor: (color) => {
      serverNextTargetColor = color;
    }
  };
}

/**
 * UI 초기화 — 엔트리 화면으로 시작
 */
export function initUI() {
  const app = document.getElementById('app');
  const nav = createNav(app);
  renderEntryView(app, nav);
}
