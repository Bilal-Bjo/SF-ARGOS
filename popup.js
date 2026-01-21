// SF Argos - Org Manager

const STORAGE_KEY = 'sf_argos_orgs';
const ENV_ORDER = ['prod', 'uat', 'int', 'dev'];
const ENV_LABELS = {
  prod: 'Production',
  uat: 'UAT',
  int: 'Integration',
  dev: 'Development'
};

let orgs = [];
let filteredOrgs = [];
let editingOrgId = null;
let selectedIndex = 0;

// DOM Elements
const orgGroups = document.getElementById('orgGroups');
const emptyState = document.getElementById('emptyState');
const noResults = document.getElementById('noResults');
const orgModal = document.getElementById('orgModal');
const modalTitle = document.getElementById('modalTitle');
const searchInput = document.getElementById('searchInput');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadOrgs();
  renderOrgs();
  setupEventListeners();
  searchInput.focus();
});

// Load orgs from storage
async function loadOrgs() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  orgs = result[STORAGE_KEY] || [];
  filteredOrgs = [...orgs];
}

// Save orgs to storage
async function saveOrgs() {
  await chrome.storage.local.set({ [STORAGE_KEY]: orgs });
  // Notify content scripts
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (isSalesforceUrl(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { action: 'orgs-updated', orgs }).catch(() => {});
      }
    });
  });
}

// Check if URL is Salesforce
function isSalesforceUrl(url) {
  if (!url) return false;
  return /salesforce|force\.com|visualforce|cloudforce/.test(url);
}

// Render orgs grouped by environment
function renderOrgs(query = '') {
  const q = query.toLowerCase().trim();

  if (q) {
    filteredOrgs = orgs.filter(org =>
      org.name.toLowerCase().includes(q) ||
      org.username.toLowerCase().includes(q) ||
      org.env.toLowerCase().includes(q)
    );
  } else {
    filteredOrgs = [...orgs];
  }

  if (orgs.length === 0) {
    orgGroups.innerHTML = '';
    emptyState.style.display = 'block';
    noResults.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';

  if (filteredOrgs.length === 0) {
    orgGroups.innerHTML = '';
    noResults.style.display = 'block';
    return;
  }

  noResults.style.display = 'none';

  // Group by environment
  const grouped = {};
  ENV_ORDER.forEach(env => grouped[env] = []);

  filteredOrgs.forEach(org => {
    const env = org.env || 'dev';
    if (!grouped[env]) grouped[env] = [];
    grouped[env].push(org);
  });

  let html = '';
  let itemIndex = 0;

  ENV_ORDER.forEach(env => {
    if (grouped[env].length === 0) return;

    html += `<div class="env-group">
      <div class="env-header ${env}">${ENV_LABELS[env]}</div>`;

    grouped[env].forEach(org => {
      html += `
        <div class="org-item ${itemIndex === selectedIndex ? 'selected' : ''}" data-id="${org.id}" data-index="${itemIndex}">
          <div class="org-color" style="background: ${org.color}"></div>
          <div class="org-info">
            <div class="org-name">${escapeHtml(org.name)}</div>
            <div class="org-username">${escapeHtml(org.username)}</div>
          </div>
          <div class="org-actions">
            <button class="org-action-btn login" data-action="login" title="Login">→</button>
            <button class="org-action-btn" data-action="edit" title="Edit">✎</button>
            <button class="org-action-btn" data-action="delete" title="Delete">×</button>
          </div>
        </div>`;
      itemIndex++;
    });

    html += '</div>';
  });

  orgGroups.innerHTML = html;

  // Attach event listeners to org items
  orgGroups.querySelectorAll('.org-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const btn = e.target.closest('.org-action-btn');
      if (btn) {
        const action = btn.dataset.action;
        const orgId = item.dataset.id;
        if (action === 'login') loginToOrg(orgId);
        else if (action === 'edit') editOrg(orgId);
        else if (action === 'delete') deleteOrg(orgId);
      }
    });

    item.addEventListener('dblclick', () => {
      loginToOrg(item.dataset.id);
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Add org buttons
  document.getElementById('addOrgBtn').addEventListener('click', () => openModal());
  document.getElementById('addFirstOrgBtn')?.addEventListener('click', () => openModal());

  // Modal
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
  document.getElementById('saveOrgBtn').addEventListener('click', saveOrg);

  // Color options
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    selectedIndex = 0;
    renderOrgs(e.target.value);
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredOrgs.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOrgs[selectedIndex]) {
        loginToOrg(filteredOrgs[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      if (searchInput.value) {
        searchInput.value = '';
        selectedIndex = 0;
        renderOrgs();
      }
    }
  });

  // Close modal on backdrop click
  orgModal.addEventListener('click', (e) => {
    if (e.target === orgModal) closeModal();
  });

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && orgModal.classList.contains('visible')) {
      closeModal();
    }
  });
}

// Update selection highlight
function updateSelection() {
  document.querySelectorAll('.org-item').forEach((item, i) => {
    const orgIndex = parseInt(item.dataset.index);
    item.classList.toggle('selected', orgIndex === selectedIndex);
    if (orgIndex === selectedIndex) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

// Open modal for add/edit
function openModal(org = null) {
  editingOrgId = org?.id || null;
  modalTitle.textContent = org ? 'Edit Org' : 'Add Org';

  document.getElementById('orgId').value = org?.id || '';
  document.getElementById('orgNameInput').value = org?.name || '';
  document.getElementById('orgEnvInput').value = org?.env || 'dev';
  document.getElementById('orgUsernameInput').value = org?.username || '';
  document.getElementById('orgLoginUrlInput').value = org?.loginUrl || 'https://test.salesforce.com';

  // Set color based on env if new org
  let color = org?.color;
  if (!color && !org) {
    const env = document.getElementById('orgEnvInput').value;
    color = getEnvDefaultColor(env);
  }
  color = color || '#10b981';

  document.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.color === color);
  });

  // Update color when env changes
  if (!org) {
    document.getElementById('orgEnvInput').addEventListener('change', (e) => {
      const envColor = getEnvDefaultColor(e.target.value);
      document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === envColor);
      });
      // Also update login URL based on env
      document.getElementById('orgLoginUrlInput').value =
        e.target.value === 'prod' ? 'https://login.salesforce.com' : 'https://test.salesforce.com';
    });
  }

  orgModal.classList.add('visible');
  document.getElementById('orgNameInput').focus();
}

// Get default color for environment
function getEnvDefaultColor(env) {
  const colors = {
    prod: '#ef4444',
    uat: '#f59e0b',
    int: '#3b82f6',
    dev: '#10b981'
  };
  return colors[env] || '#10b981';
}

// Close modal
function closeModal() {
  orgModal.classList.remove('visible');
  editingOrgId = null;
  searchInput.focus();
}

// Save org
async function saveOrg() {
  const name = document.getElementById('orgNameInput').value.trim();
  const env = document.getElementById('orgEnvInput').value;
  const username = document.getElementById('orgUsernameInput').value.trim();
  const loginUrl = document.getElementById('orgLoginUrlInput').value;
  const color = document.querySelector('.color-option.selected')?.dataset.color || getEnvDefaultColor(env);

  if (!name || !username) {
    alert('Please enter org name and username');
    return;
  }

  if (editingOrgId) {
    // Update existing
    const index = orgs.findIndex(o => o.id === editingOrgId);
    if (index !== -1) {
      orgs[index] = { ...orgs[index], name, env, username, loginUrl, color };
    }
  } else {
    // Add new
    const newOrg = {
      id: Date.now().toString(),
      name,
      env,
      username,
      loginUrl,
      color
    };
    orgs.push(newOrg);
  }

  await saveOrgs();
  renderOrgs(searchInput.value);
  closeModal();
}

// Edit org
function editOrg(orgId) {
  const org = orgs.find(o => o.id === orgId);
  if (org) openModal(org);
}

// Delete org
async function deleteOrg(orgId) {
  if (!confirm('Delete this org?')) return;
  orgs = orgs.filter(o => o.id !== orgId);
  await saveOrgs();
  selectedIndex = Math.min(selectedIndex, orgs.length - 1);
  renderOrgs(searchInput.value);
}

// Login to org
function loginToOrg(orgId) {
  const org = orgs.find(o => o.id === orgId);
  if (!org) return;

  const loginUrl = org.loginUrl || 'https://login.salesforce.com';
  const url = `${loginUrl}/?un=${encodeURIComponent(org.username)}`;
  chrome.tabs.create({ url });
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
