// Runs in the document head, before hydration or the browser restores scroll.
export const pageEntryScript = `(() => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const navigation = performance.getEntriesByType('navigation')[0];
  const reload = navigation && navigation.type === 'reload';
  const hasSection = location.hash && location.hash !== '#inicio';
  if (hasSection && !reload) return;
  if (reload && location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  let interacted = false;
  const stop = () => { interacted = true; };
  const inputs = ['touchstart', 'pointerdown', 'wheel', 'keydown'];
  inputs.forEach(type => addEventListener(type, stop, { passive: true }));
  const top = () => { if (!interacted) scrollTo({ top: 0, left: 0, behavior: 'instant' }); };
  top();
  addEventListener('pageshow', () => {
    top();
    requestAnimationFrame(top);
  });
  addEventListener('pagehide', () => { interacted = false; });
})();`;
