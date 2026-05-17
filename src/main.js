import { initUI } from './ui/UIManager.js?v=2';

/**
 * 앱 진입점
 * DOMContentLoaded 이벤트 발생 시 UIManager를 초기화합니다.
 */
try {
  initUI();
} catch (e) {
  document.body.innerHTML = `<div style="color: red; padding: 20px;">Error: ${e.message}<br><pre>${e.stack}</pre></div>`;
  console.error(e);
}
