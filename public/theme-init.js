// Applies the saved theme before first paint so dark-mode users don't see a
// white flash while the bundle loads. Mirrors src/lib/theme.js.
(function () {
  try {
    var p = localStorage.getItem('prospect-theme');
    var dark =
      p === 'dark' ||
      (p !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {
    // Storage blocked: fall back to the light theme.
  }
})();
