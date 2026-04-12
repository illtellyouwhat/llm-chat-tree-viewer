// Runs in MAIN world — can access React internals
// Listens for custom events from the isolated content script
document.addEventListener('cttv-click-branch', (e) => {
  const { selector, label } = e.detail;
  const section = document.querySelector(`section[data-turn-id="${selector}"]`);
  if (!section) return;
  const btn = section.querySelector(`button[aria-label="${label}"]`);
  if (!btn || btn.disabled) return;
  const pk = Object.keys(btn).find(k => k.startsWith('__reactProps'));
  if (pk) btn[pk].onClick({ preventDefault() {}, stopPropagation() {} });
});
