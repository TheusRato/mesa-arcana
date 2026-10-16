(() => {
  const key = 'mesa-arcana-theme';
  const normalize = value => value === 'dark' ? 'dark' : 'light';
  const apply = value => {
    const theme = normalize(value);
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191b20' : '#202638');
    document.querySelectorAll('input[name="appearance"]').forEach(input => {
      input.checked = input.value === theme;
    });
  };
  let initial = 'light';
  try { initial = localStorage.getItem(key); } catch { /* Storage may be unavailable in private browsing. */ }
  apply(initial);
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme);
    document.querySelectorAll('input[name="appearance"]').forEach(input => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        apply(input.value);
        try { localStorage.setItem(key, input.value); } catch { /* Keep the selection for this session. */ }
      });
    });
  });
  window.addEventListener('storage', event => { if (event.key === key) apply(event.newValue); });
})();
