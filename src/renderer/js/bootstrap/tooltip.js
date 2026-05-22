import Tooltip from 'bootstrap/js/src/tooltip.js';

export function initTooltips (root = document) {
  root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
    const tip = new Tooltip(el)
    el.addEventListener('click', () => tip.hide())
  })
}

export function destroyTooltip (target) {
  Tooltip.getInstance(target)?.dispose();
}
