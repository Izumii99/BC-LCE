// Copy to LCE/src/core/responsive-compat.js via scripts/link-lce.mjs.
// No persistent LCE setting is changed by this adapter.
const listeners = new Set();
let ownership = { mouth: false, expressions: false };
let bound;
let observing = false;
let ownershipGeneration = 0;
export const responsiveOwns = capability => ownership[capability] === true;
export const getResponsiveGeneration = () => ownershipGeneration;
export function observeResponsive(listener) {
  listeners.add(listener);
  function bind() {
    const api = globalThis.Liko?.Responsive_Liko;
    if (!api || api === bound || api.apiVersion !== 1 || typeof api.registerConsumer !== 'function') return;
    bound = api;
    api.registerConsumer('LCE', desired => {
      const previous = ownership;
      ownership = { mouth: desired.mouth === true, expressions: desired.expressions === true };
      if (previous.mouth !== ownership.mouth || previous.expressions !== ownership.expressions) {
        ownershipGeneration++;
        for (const callback of [...listeners]) {
          try { callback(ownership, previous, ownershipGeneration); }
          catch (error) { console.warn('[LCE] Responsive ownership listener failed:', error); }
        }
      }
      return true;
    });
  }
  if (!observing && typeof globalThis.addEventListener === 'function') {
    observing = true;
    globalThis.addEventListener('Responsive_Liko:state', bind);
  }
  bind();
  listener(ownership, { mouth: false, expressions: false });
  return () => listeners.delete(listener);
}
