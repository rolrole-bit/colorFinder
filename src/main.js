import { initUI } from './ui/UIManager.js';

/**
 * 앱 진입점
 * DOMContentLoaded 이벤트 발생 시 UIManager를 초기화합니다.
 */
try {
  initUI();
} catch (e) {
  document.getElementById('app').innerHTML = `<div style="color: red; padding: 20px; background:#000; font-family:monospace;">
    <h2>initUI Error</h2>
    <pre>${e.message}</pre>
    <pre>${e.stack}</pre>
  </div>`;
  console.error('[DYE MASTER]', e);
}
