// SF Argos - Content Script
// Auto-login on Salesforce login pages

const AUTOLOGIN_KEY = 'sf_argos_autologin';

// Check for auto-login on Salesforce login pages
if (location.hostname.includes('salesforce.com') || location.hostname.includes('force.com')) {
  tryAutoLogin();
}

async function tryAutoLogin() {
  const data = await chrome.storage.local.get(AUTOLOGIN_KEY);
  const creds = data[AUTOLOGIN_KEY];

  if (!creds || Date.now() - creds.timestamp > 10000) {
    // No credentials or expired (10 sec window)
    return;
  }

  // Clear credentials immediately
  chrome.storage.local.remove(AUTOLOGIN_KEY);

  // Decrypt password
  const password = await decrypt(creds.password, creds.iv);
  if (!password) return;

  // Wait for form to be ready
  const maxWait = 5000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const userInput = document.getElementById('username');
    const passInput = document.getElementById('password');
    const loginBtn = document.getElementById('Login');

    if (userInput && passInput && loginBtn) {
      userInput.value = creds.username;
      passInput.value = password;

      // Trigger events for Salesforce's JS
      userInput.dispatchEvent(new Event('input', { bubbles: true }));
      userInput.dispatchEvent(new Event('change', { bubbles: true }));
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Small delay then submit
      setTimeout(() => loginBtn.click(), 200);
      return;
    }

    await new Promise(r => setTimeout(r, 100));
  }
}

// Decrypt password using AES-GCM
async function decrypt(encrypted, ivBase64) {
  try {
    const key = await getKey();
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

// Get or create encryption key
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

  // Generate new key
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
