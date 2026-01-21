// SF Argos - Overlay

(function() {
  if (window.sfArgosOpen) { window.sfArgosToggle?.(); return; }

  const STORAGE_KEY = 'sf_argos_orgs';
  const ENV_ORDER = ['prod', 'uat', 'int', 'dev'];
  const ENV_LABELS = { prod: 'PROD', uat: 'UAT', int: 'INT', dev: 'DEV' };
  const ENV_COLORS = { prod: '#ef4444', uat: '#f59e0b', int: '#3b82f6', dev: '#22c55e' };

  let overlay, orgs = [], filtered = [], selIdx = 0, editId = null;

  // Encryption helpers (AES-GCM)
  async function getKey() {
    const stored = await chrome.storage.local.get('sf_argos_key');
    if (stored.sf_argos_key) {
      return crypto.subtle.importKey(
        'raw',
        Uint8Array.from(atob(stored.sf_argos_key), c => c.charCodeAt(0)),
        'AES-GCM',
        true,
        ['encrypt', 'decrypt']
      );
    }
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const exported = await crypto.subtle.exportKey('raw', key);
    await chrome.storage.local.set({
      sf_argos_key: btoa(String.fromCharCode(...new Uint8Array(exported)))
    });
    return key;
  }

  async function encrypt(text) {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return {
      data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    };
  }

  async function load() {
    orgs = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || [];
    filtered = [...orgs];
  }

  async function save() {
    await chrome.storage.local.set({ [STORAGE_KEY]: orgs });
  }

  window.sfArgosToggle = () => overlay ? close() : open();

  async function open() {
    window.sfArgosOpen = true;
    await load();

    overlay = document.createElement('div');
    overlay.id = 'sa';
    overlay.innerHTML = `
      <div id="sa-bg"></div>
      <div id="sa-box">
        <input type="text" id="sa-q" placeholder="Search orgs..." autocomplete="off" spellcheck="false">
        <div id="sa-list"></div>
        <div id="sa-foot"><span>↑↓</span><span>enter to login</span><span>esc to close</span></div>
        <button id="sa-add">+</button>
      </div>
      <div id="sa-form-wrap">
        <div id="sa-form">
          <div id="sa-form-head"><span>Add Org</span></div>
          <div id="sa-form-body">
            <label>Family / Project
              <div id="sa-family-wrap">
                <select id="sa-family-select"><option value="">Select or create new...</option></select>
                <input type="text" id="sa-family-input" placeholder="e.g. Acme Corp" style="display:none">
              </div>
            </label>
            <div class="sa-row">
              <label class="sa-grow">Org Name<input type="text" id="sa-name" placeholder="e.g. Acme Dev"></label>
              <label>Env<select id="sa-env"><option value="dev">Dev</option><option value="int">Int</option><option value="uat">UAT</option><option value="prod">Prod</option></select></label>
            </div>
            <label>Username<input type="text" id="sa-user" placeholder="user@example.com"></label>
            <label>Password<input type="password" id="sa-pass" placeholder="••••••••"></label>
            <label>Login URL<input type="text" id="sa-domain"></label>
          </div>
          <div id="sa-form-foot"><button id="sa-cancel">Cancel</button><button id="sa-save">Save</button></div>
        </div>
      </div>
    `;

    const css = document.createElement('style');
    css.id = 'sa-css';
    css.textContent = `
      #sa,#sa *{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
      #sa-bg{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:99998}
      #sa-box{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:520px;max-height:540px;background:#131313;border-radius:16px;z-index:99999;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}
      #sa-q{background:#0a0a0a;border:none;padding:20px 24px;font-size:16px;color:#fff;outline:none}
      #sa-q::placeholder{color:#3a3a3a}
      #sa-list{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px}
      #sa-list::-webkit-scrollbar{width:0}
      .sa-org{display:flex;align-items:center;padding:16px 18px;border-radius:12px;cursor:pointer;gap:16px;background:#1a1a1a;transition:all .15s}
      .sa-org:hover,.sa-org.sel{background:#242424;transform:translateX(2px)}
      .sa-env{font-size:10px;font-weight:700;padding:8px 12px;border-radius:8px;min-width:48px;text-align:center;letter-spacing:.5px}
      .sa-info{flex:1;min-width:0}
      .sa-name{font-size:15px;color:#fff;font-weight:600;margin-bottom:4px}
      .sa-meta{font-size:12px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .sa-btns{display:flex;gap:8px;opacity:0;transition:opacity .15s}
      .sa-org:hover .sa-btns,.sa-org.sel .sa-btns{opacity:1}
      .sa-btn{width:34px;height:34px;border:none;border-radius:8px;background:#2a2a2a;color:#555;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
      .sa-btn:hover{background:#3a3a3a;color:#fff;transform:scale(1.08)}
      .sa-btn.go{background:#22c55e;color:#000;font-weight:600}
      .sa-btn.go:hover{background:#16a34a;transform:scale(1.08)}
      .sa-empty{text-align:center;padding:50px 20px;color:#444;font-size:14px}
      #sa-foot{display:flex;justify-content:center;gap:24px;padding:16px;border-top:1px solid #1e1e1e;background:#0f0f0f}
      #sa-foot span{font-size:11px;color:#444}
      #sa-add{position:absolute;top:16px;right:16px;width:36px;height:36px;border:none;border-radius:10px;background:#22c55e;color:#000;font-size:22px;font-weight:300;cursor:pointer;transition:all .15s}
      #sa-add:hover{background:#16a34a;transform:scale(1.05)}
      #sa-form-wrap{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:100000;align-items:center;justify-content:center}
      #sa-form-wrap.open{display:flex}
      #sa-form{width:440px;background:#161616;border-radius:12px;overflow:hidden}
      #sa-family-wrap{display:flex;gap:8px}
      #sa-family-wrap select,#sa-family-wrap input{flex:1}
      #sa-form-head{padding:20px;border-bottom:1px solid #222}
      #sa-form-head span{font-size:15px;font-weight:600;color:#fff}
      #sa-form-body{padding:20px;display:flex;flex-direction:column;gap:16px}
      #sa-form-body label{display:flex;flex-direction:column;gap:6px;font-size:11px;color:#555;font-weight:500;text-transform:uppercase;letter-spacing:.5px}
      #sa-form-body input,#sa-form-body select{width:100%;background:#0f0f0f;border:none;border-radius:8px;padding:12px;font-size:13px;color:#fff;outline:none;font-family:inherit;pointer-events:auto;-webkit-user-select:text;user-select:text}
      #sa-form-body input::placeholder{color:#333}
      #sa-form-body select{cursor:pointer}
      .sa-row{display:flex;gap:12px}
      .sa-grow{flex:1}
      #sa-form-foot{display:flex;justify-content:flex-end;gap:8px;padding:16px 20px;border-top:1px solid #222}
      #sa-cancel{background:#222;color:#888;border:none;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer}
      #sa-cancel:hover{background:#2a2a2a;color:#fff}
      #sa-save{background:#22c55e;color:#000;border:none;padding:10px 20px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
      #sa-save:hover{background:#16a34a}
    `;

    document.head.appendChild(css);
    document.body.appendChild(overlay);
    events();
    render();
    setTimeout(() => document.getElementById('sa-q')?.focus(), 50);
  }

  function close() {
    window.sfArgosOpen = false;
    document.getElementById('sa')?.remove();
    document.getElementById('sa-css')?.remove();
    overlay = null;
    selIdx = 0;
    editId = null;
  }

  function events() {
    document.getElementById('sa-bg').onclick = close;
    document.getElementById('sa-add').onclick = () => openForm();
    document.getElementById('sa-cancel').onclick = closeForm;
    document.getElementById('sa-save').onclick = saveForm;
    document.getElementById('sa-form-wrap').onclick = e => e.target.id === 'sa-form-wrap' && closeForm();

    const q = document.getElementById('sa-q');
    q.oninput = () => { selIdx = 0; filter(q.value); };
    q.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); selIdx = Math.min(selIdx + 1, filtered.length - 1); updateSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(selIdx - 1, 0); updateSel(); }
      else if (e.key === 'Enter' && filtered[selIdx]) { e.preventDefault(); login(filtered[selIdx].id); }
      else if (e.key === 'Escape') { q.value ? (q.value = '', filter('')) : close(); }
    };

    document.getElementById('sa-family-select').onchange = e => {
      const inp = document.getElementById('sa-family-input');
      if (e.target.value === '__new__') {
        inp.style.display = 'block';
        inp.focus();
      } else {
        inp.style.display = 'none';
        inp.value = '';
      }
    };

    // Stop page from capturing keyboard events in our form
    document.getElementById('sa-form').onkeydown = e => e.stopPropagation();
    document.getElementById('sa-form').onkeyup = e => e.stopPropagation();
    document.getElementById('sa-form').onkeypress = e => e.stopPropagation();
    document.getElementById('sa-box').onkeydown = e => e.stopPropagation();
    document.getElementById('sa-box').onkeyup = e => e.stopPropagation();
    document.getElementById('sa-box').onkeypress = e => e.stopPropagation();

    document.onkeydown = e => e.key === 'Escape' && overlay && close();
  }

  function filter(q) {
    q = q.toLowerCase().trim();
    filtered = q ? orgs.filter(o =>
      o.name.toLowerCase().includes(q) ||
      o.username.toLowerCase().includes(q) ||
      (o.family || '').toLowerCase().includes(q)
    ) : [...orgs];
    render();
  }

  function render() {
    const list = document.getElementById('sa-list');
    if (!orgs.length) { list.innerHTML = '<div class="sa-empty">No orgs yet. Click + to add one.</div>'; return; }
    if (!filtered.length) { list.innerHTML = '<div class="sa-empty">No results</div>'; return; }

    // Sort by family then by env
    filtered.sort((a, b) => {
      const famA = (a.family || '').toLowerCase();
      const famB = (b.family || '').toLowerCase();
      if (famA !== famB) return famA.localeCompare(famB);
      return ENV_ORDER.indexOf(a.env) - ENV_ORDER.indexOf(b.env);
    });

    let html = '', idx = 0;
    filtered.forEach(o => {
      html += `<div class="sa-org${idx === selIdx ? ' sel' : ''}" data-id="${o.id}" data-i="${idx}">
        <div class="sa-env" style="background:${ENV_COLORS[o.env]}20;color:${ENV_COLORS[o.env]}">${ENV_LABELS[o.env]}</div>
        <div class="sa-info">
          <div class="sa-name">${esc(o.name)}</div>
          <div class="sa-meta">${o.family ? esc(o.family) + ' · ' : ''}${esc(o.username)}</div>
        </div>
        <div class="sa-btns">
          <button class="sa-btn go" data-a="go">→</button>
          <button class="sa-btn" data-a="edit">✎</button>
          <button class="sa-btn" data-a="del">×</button>
        </div>
      </div>`;
      idx++;
    });

    list.innerHTML = html;
    list.querySelectorAll('.sa-org').forEach(el => {
      el.ondblclick = () => login(el.dataset.id);
      el.onclick = e => {
        const btn = e.target.closest('.sa-btn');
        if (btn) {
          const a = btn.dataset.a, id = el.dataset.id;
          a === 'go' ? login(id) : a === 'edit' ? edit(id) : del(id);
        }
      };
    });
  }

  function updateSel() {
    document.querySelectorAll('.sa-org').forEach(el => {
      const s = +el.dataset.i === selIdx;
      el.classList.toggle('sel', s);
      s && el.scrollIntoView({ block: 'nearest' });
    });
  }

  function openForm(org = null) {
    editId = org?.id || null;
    document.querySelector('#sa-form-head span').textContent = org ? 'Edit Org' : 'Add Org';

    // Populate family dropdown with existing families
    const sel = document.getElementById('sa-family-select');
    const inp = document.getElementById('sa-family-input');
    const existingFamilies = [...new Set(orgs.map(o => o.family).filter(Boolean))].sort();

    sel.innerHTML = '<option value="">Select family...</option>';
    existingFamilies.forEach(f => {
      sel.innerHTML += `<option value="${esc(f)}">${esc(f)}</option>`;
    });
    sel.innerHTML += '<option value="__new__">+ Create new...</option>';

    // Set current value
    if (org?.family && existingFamilies.includes(org.family)) {
      sel.value = org.family;
      inp.style.display = 'none';
      inp.value = '';
    } else if (org?.family) {
      sel.value = '__new__';
      inp.style.display = 'block';
      inp.value = org.family;
    } else {
      sel.value = '';
      inp.style.display = 'none';
      inp.value = '';
    }

    document.getElementById('sa-name').value = org?.name || '';
    document.getElementById('sa-env').value = org?.env || 'dev';
    document.getElementById('sa-user').value = org?.username || '';
    document.getElementById('sa-pass').value = '';
    document.getElementById('sa-domain').value = org?.loginUrl || '';
    document.getElementById('sa-form-wrap').classList.add('open');
    document.getElementById('sa-name').focus();
  }

  function closeForm() {
    document.getElementById('sa-form-wrap').classList.remove('open');
    editId = null;
    document.getElementById('sa-q').focus();
  }

  async function saveForm() {
    const sel = document.getElementById('sa-family-select');
    const inp = document.getElementById('sa-family-input');
    const family = (sel.value === '__new__' ? inp.value : sel.value).trim();
    const name = document.getElementById('sa-name').value.trim();
    const env = document.getElementById('sa-env').value;
    const username = document.getElementById('sa-user').value.trim();
    const passwordRaw = document.getElementById('sa-pass').value;
    const loginUrl = document.getElementById('sa-domain').value.trim();

    if (!name || !username) return alert('Name and username required');

    // Encrypt password if provided
    let encPassword = null, encIv = null;
    if (passwordRaw) {
      const enc = await encrypt(passwordRaw);
      encPassword = enc.data;
      encIv = enc.iv;
    }

    if (editId) {
      const i = orgs.findIndex(o => o.id === editId);
      if (i !== -1) {
        const updates = { family, name, env, username, loginUrl };
        if (encPassword) {
          updates.password = encPassword;
          updates.iv = encIv;
        }
        orgs[i] = { ...orgs[i], ...updates };
      }
    } else {
      orgs.push({ id: Date.now().toString(), family, name, env, username, password: encPassword, iv: encIv, loginUrl });
    }

    await save();
    filtered = [...orgs];
    render();
    closeForm();
  }

  function edit(id) { const o = orgs.find(x => x.id === id); o && openForm(o); }

  async function del(id) {
    if (!confirm('Delete?')) return;
    orgs = orgs.filter(o => o.id !== id);
    await save();
    filtered = [...orgs];
    selIdx = Math.min(selIdx, filtered.length - 1);
    render();
  }

  function login(id) {
    const o = orgs.find(x => x.id === id);
    if (!o) return;

    if (!o.password || !o.iv) {
      // No credentials stored, just open the login page
      window.open(`${o.loginUrl || 'https://login.salesforce.com'}`, '_blank');
      close();
      return;
    }

    // Store encrypted credentials for the content script to use
    chrome.storage.local.set({
      sf_argos_autologin: {
        username: o.username,
        password: o.password,
        iv: o.iv,
        timestamp: Date.now()
      }
    });

    // Open login page
    window.open(`${o.loginUrl || 'https://login.salesforce.com'}`, '_blank');
    close();
  }

  function esc(s) { return s ? s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; }

  open();
})();
