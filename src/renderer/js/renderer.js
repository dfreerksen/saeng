/* global electronAPI */

// ── i18n ───────────────────────────────────────────────────────────

let strings = {};

function t(key, vars) {
  let str = strings[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

// ── Toast ──────────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Navigation ─────────────────────────────────────────────────────

let currentView = 'mappings';

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`view-${view}`).classList.add('active');
    currentView = view;
  });
});

// ── Proxy status ───────────────────────────────────────────────────

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const proxyToggleBtn = document.getElementById('proxyToggleBtn');

let proxyRunning = false;

function setProxyStatus(running) {
  proxyRunning = running;
  statusDot.className = `status-dot ${running ? 'running' : 'stopped'}`;
  statusText.textContent = running ? t('proxy.status.running') : t('proxy.status.stopped');
  proxyToggleBtn.textContent = running ? t('proxy.stop') : t('proxy.start');
  proxyToggleBtn.className = `proxy-toggle-btn${running ? ' running' : ''}`;
}

proxyToggleBtn.addEventListener('click', async () => {
  proxyToggleBtn.disabled = true;
  if (proxyRunning) {
    const result = await electronAPI.proxy.stop();
    if (result.success) {
      setProxyStatus(false);
      showToast(t('toast.proxyStopped'), 'info');
    } else {
      showToast(t('toast.proxyStopFailed', { error: result.error }), 'error');
    }
  } else {
    const result = await electronAPI.proxy.start();
    if (result.success) {
      setProxyStatus(true);
      showToast(t('toast.proxyStarted'), 'success');
    } else {
      showToast(t('toast.proxyStartFailed', { error: result.error }), 'error');
    }
  }
  proxyToggleBtn.disabled = false;
});

electronAPI.proxy.onStatusChanged((data) => {
  setProxyStatus(data.running);
});

// ── Mappings ───────────────────────────────────────────────────────

let mappings = [];

function buildDomainFromMapping(m) {
  return m.domain;
}

function renderMappings() {
  const tbody = document.getElementById('mappingsTbody');
  const emptyState = document.getElementById('emptyState');

  tbody.innerHTML = '';

  if (mappings.length === 0) {
    emptyState.classList.remove('hidden');
    document.getElementById('mappingsTable').style.display = 'none';
    return;
  }

  emptyState.classList.add('hidden');
  document.getElementById('mappingsTable').style.display = '';

  mappings.forEach((m) => {
    const tr = document.createElement('tr');

    const protoBadge = m.https
      ? '<span class="badge badge-https">HTTPS</span>'
      : '<span class="badge badge-http">HTTP</span>';

    tr.innerHTML = `
      <td class="domain-cell">${escapeHtml(m.domain)}</td>
      <td class="port-cell">:${m.port}</td>
      <td>${protoBadge}</td>
      <td class="label-cell">${escapeHtml(m.label || '')}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" class="toggle-enabled" data-id="${m.id}" ${m.enabled ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </td>
      <td>
        <div class="actions-cell">
          <button class="icon-btn edit" data-id="${m.id}" title="${escapeHtml(t('table.editTitle'))}">✎</button>
          <button class="icon-btn delete" data-id="${m.id}" title="${escapeHtml(t('table.deleteTitle'))}">✕</button>
        </div>
      </td>
    `;

    tr.querySelector('.toggle-enabled').addEventListener('change', async (e) => {
      mappings = await electronAPI.mappings.toggle(e.target.dataset.id);
      // Don't re-render: just update the visual state based on returned data
    });

    tr.querySelector('.icon-btn.edit').addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const mapping = mappings.find((x) => x.id === id);
      if (!mapping) return;
      openEditModal(mapping);
    });

    tr.querySelector('.icon-btn.delete').addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const mapping = mappings.find((x) => x.id === id);
      if (!mapping) return;
      if (!confirm(t('confirm.removeMapping', { domain: mapping.domain }))) return;
      mappings = await electronAPI.mappings.remove(id);
      renderMappings();
    });

    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Add / Edit mapping modal ───────────────────────────────────────

const addModal = document.getElementById('addModal');
const addForm = document.getElementById('addForm');

let editingId = null;

function splitDomain(fullDomain) {
  const withoutLocal = fullDomain.replace(/\.local$/, '');
  const dot = withoutLocal.indexOf('.');
  if (dot === -1) return { subdomain: '', domain: withoutLocal };
  return { subdomain: withoutLocal.slice(0, dot), domain: withoutLocal.slice(dot + 1) };
}

function openAddModal() {
  editingId = null;
  addForm.reset();
  clearFormErrors();
  document.getElementById('modalTitle').textContent = t('modal.addTitle');
  document.getElementById('formSubmitBtn').textContent = t('modal.addSubmit');
  addModal.classList.add('open');
  document.getElementById('domainInput').focus();
}

function openEditModal(mapping) {
  editingId = mapping.id;
  addForm.reset();
  clearFormErrors();
  const { subdomain, domain } = splitDomain(mapping.domain);
  document.getElementById('subdomainInput').value = subdomain;
  document.getElementById('domainInput').value = domain;
  document.getElementById('portInput').value = mapping.port;
  document.getElementById('httpsInput').checked = !!mapping.https;
  document.getElementById('labelInput').value = mapping.label || '';
  document.getElementById('modalTitle').textContent = t('modal.editTitle');
  document.getElementById('formSubmitBtn').textContent = t('modal.editSubmit');
  addModal.classList.add('open');
  document.getElementById('domainInput').focus();
}

document.getElementById('addMappingBtn').addEventListener('click', openAddModal);

document.getElementById('cancelAddBtn').addEventListener('click', () => {
  addModal.classList.remove('open');
});

addModal.addEventListener('click', (e) => {
  if (e.target === addModal) addModal.classList.remove('open');
});

function clearFormErrors() {
  document.querySelectorAll('.form-error').forEach((el) => el.classList.remove('visible'));
}

function validateDomainPart(value) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(value) || /^[a-zA-Z0-9]$/.test(value);
}

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFormErrors();

  const subdomain = document.getElementById('subdomainInput').value.trim();
  const domain = document.getElementById('domainInput').value.trim();
  const port = parseInt(document.getElementById('portInput').value.trim(), 10);
  const https = document.getElementById('httpsInput').checked;
  const label = document.getElementById('labelInput').value.trim();

  let valid = true;

  if (!domain || !validateDomainPart(domain)) {
    document.getElementById('domainError').textContent = t('form.domainErrorInvalid');
    document.getElementById('domainError').classList.add('visible');
    valid = false;
  }

  if (subdomain && !validateDomainPart(subdomain)) {
    document.getElementById('domainError').textContent = t('form.subdomainError');
    document.getElementById('domainError').classList.add('visible');
    valid = false;
  }

  if (!port || port < 1 || port > 65535 || isNaN(port)) {
    document.getElementById('portError').classList.add('visible');
    valid = false;
  }

  if (!valid) return;

  const fullDomain = subdomain ? `${subdomain}.${domain}.local` : `${domain}.local`;

  // Check for duplicates (exclude the mapping being edited)
  if (mappings.some((m) => m.domain === fullDomain && m.id !== editingId)) {
    document.getElementById('domainError').textContent = t('form.domainErrorDuplicate', { domain: fullDomain });
    document.getElementById('domainError').classList.add('visible');
    return;
  }

  if (editingId) {
    mappings = await electronAPI.mappings.update(editingId, { domain: fullDomain, port, https, label });
    renderMappings();
    addModal.classList.remove('open');
    showToast(t('toast.mappingUpdated', { domain: fullDomain, port }), 'success');
  } else {
    mappings = await electronAPI.mappings.add({ domain: fullDomain, port, https, label });
    renderMappings();
    addModal.classList.remove('open');
    showToast(t('toast.mappingAdded', { domain: fullDomain, port }), 'success');
  }
});

// ── Settings ───────────────────────────────────────────────────────

async function loadSettings() {
  const settings = await electronAPI.settings.get();

  document.getElementById('httpsEnabledToggle').checked = !!settings.httpsEnabled;
  document.getElementById('startOnLaunchToggle').checked = !!settings.startOnLaunch;
}

document.getElementById('httpsEnabledToggle').addEventListener('change', async (e) => {
  await electronAPI.settings.set({ httpsEnabled: e.target.checked });
  showToast(
    e.target.checked ? t('toast.httpsEnabled') : t('toast.httpsDisabled'),
    'info'
  );
});

document.getElementById('startOnLaunchToggle').addEventListener('change', async (e) => {
  await electronAPI.settings.set({ startOnLaunch: e.target.checked });
});

document.getElementById('revealCaBtn').addEventListener('click', async () => {
  await electronAPI.ssl.revealCA();
});

document.getElementById('trustCaBtn').addEventListener('click', async () => {
  document.getElementById('trustCaBtn').disabled = true;
  document.getElementById('trustCaBtn').textContent = t('settings.caInstalling');

  const result = await electronAPI.ssl.trustCA();

  document.getElementById('trustCaBtn').disabled = false;
  document.getElementById('trustCaBtn').textContent = t('settings.trustCa');

  if (result.success) {
    showToast(t('toast.caTrusted'), 'success', 5000);
  } else {
    showToast(result.message, 'error', 6000);
  }
});

// ── Init ───────────────────────────────────────────────────────────

async function init() {
  strings = await electronAPI.i18n.getStrings();
  applyTranslations();

  const status = await electronAPI.proxy.status();
  setProxyStatus(status.running);

  mappings = await electronAPI.mappings.list();
  renderMappings();

  await loadSettings();

  const caPath = await electronAPI.ssl.getCAPath();
  document.getElementById('caPathBox').textContent = caPath;
}

init();

(() => {
})();
