import Tooltip from 'bootstrap/js/src/tooltip.js';

export function initTooltips(root = document) {
  root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new Tooltip(el))
}
