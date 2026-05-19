/**
 * 보안 리포트 탭 전환 로직
 * CSP 호환을 위해 외부 JS 파일로 분리
 */
document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var tab = this.getAttribute('data-tab');
    document.querySelectorAll('.tab-content').forEach(function(el) {
      el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(function(el) {
      el.classList.remove('active');
    });
    document.getElementById('tab-' + tab).classList.add('active');
    this.classList.add('active');
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
});

if (location.hash === '#install') {
  var btn = document.querySelector('[data-tab="install"]');
  if (btn) btn.click();
}
