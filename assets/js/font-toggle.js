(function () {
  var root = document.documentElement;
  var font = 'sans';
  try {
    if (localStorage.getItem('site-font') === 'serif') font = 'serif';
  } catch (_) {}
  root.dataset.font = font;

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.querySelector('.font-toggle');
    if (!button) return;

    function updateButton() {
      var serif = root.dataset.font === 'serif';
      var label = serif ? '切换为黑体' : '切换为宋体';
      button.textContent = serif ? '黑' : '宋';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(serif));
    }

    button.addEventListener('click', function () {
      root.dataset.font = root.dataset.font === 'serif' ? 'sans' : 'serif';
      try {
        localStorage.setItem('site-font', root.dataset.font);
      } catch (_) {}
      updateButton();
    });
    updateButton();
  });
})();
