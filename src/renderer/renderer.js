/* global electronAPI */

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
  statusText.textContent = running ? 'Proxy running' : 'Proxy stopped';
  proxyToggleBtn.textContent = running ? 'Stop Proxy' : 'Start Proxy';
  proxyToggleBtn.className = `proxy-toggle-btn${running ? ' running' : ''}`;
}

proxyToggleBtn.addEventListener('click', async () => {
  proxyToggleBtn.disabled = true;
  if (proxyRunning) {
    const result = await electronAPI.proxy.stop();
    if (result.success) {
      setProxyStatus(false);
      showToast('Proxy stopped.', 'info');
    } else {
      showToast(`Failed to stop: ${result.error}`, 'error');
    }
  } else {
    const result = await electronAPI.proxy.start();
    if (result.success) {
      setProxyStatus(true);
      showToast('Proxy started. System proxy configured.', 'success');
    } else {
      showToast(`Failed to start: ${result.error}`, 'error');
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
          <button class="icon-btn edit" data-id="${m.id}" title="Edit">✎</button>
          <button class="icon-btn delete" data-id="${m.id}" title="Remove">✕</button>
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
      if (!confirm(`Remove ${mapping.domain}?`)) return;
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
  document.getElementById('modalTitle').textContent = 'Add Domain Mapping';
  document.getElementById('formSubmitBtn').textContent = 'Add Mapping';
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
  document.getElementById('modalTitle').textContent = 'Edit Mapping';
  document.getElementById('formSubmitBtn').textContent = 'Save Changes';
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
    document.getElementById('domainError').textContent = 'Enter a valid domain name (letters, numbers, hyphens).';
    document.getElementById('domainError').classList.add('visible');
    valid = false;
  }

  if (subdomain && !validateDomainPart(subdomain)) {
    document.getElementById('domainError').textContent = 'Subdomain must contain only letters, numbers, and hyphens.';
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
    document.getElementById('domainError').textContent = `${fullDomain} is already mapped.`;
    document.getElementById('domainError').classList.add('visible');
    return;
  }

  if (editingId) {
    mappings = await electronAPI.mappings.update(editingId, { domain: fullDomain, port, https, label });
    renderMappings();
    addModal.classList.remove('open');
    showToast(`Updated ${fullDomain} → :${port}`, 'success');
  } else {
    mappings = await electronAPI.mappings.add({ domain: fullDomain, port, https, label });
    renderMappings();
    addModal.classList.remove('open');
    showToast(`Added ${fullDomain} → :${port}`, 'success');
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
    e.target.checked
      ? 'HTTPS enabled. Restart the proxy for changes to take effect.'
      : 'HTTPS disabled.',
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
  document.getElementById('trustCaBtn').textContent = 'Installing…';

  const result = await electronAPI.ssl.trustCA();

  document.getElementById('trustCaBtn').disabled = false;
  document.getElementById('trustCaBtn').textContent = 'Install & Trust CA Certificate';

  if (result.success) {
    showToast('CA certificate trusted successfully.', 'success', 5000);
  } else {
    showToast(result.message, 'error', 6000);
  }
});

// ── Init ───────────────────────────────────────────────────────────

async function init() {
  // Load proxy status
  const status = await electronAPI.proxy.status();
  setProxyStatus(status.running);

  // Load mappings
  mappings = await electronAPI.mappings.list();
  renderMappings();

  // Load settings
  await loadSettings();

  // Load CA path
  const caPath = await electronAPI.ssl.getCAPath();
  document.getElementById('caPathBox').textContent = caPath;
}

init();
