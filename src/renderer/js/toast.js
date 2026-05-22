export function showToast(message, type = 'info', duration = 3500) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast');
  const el = document.createElement('div');

  el.className = `alert alert-${type} d-flex align-items-center`;
  el.innerHTML = `<i class="bi bi-${icons[type]}"></i><div>${message}</div>`;
  container.appendChild(el);

  setTimeout(() => el.remove(), duration);
}
