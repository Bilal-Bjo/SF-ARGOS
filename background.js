// SF Argos - Background Service Worker

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-argos') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Try to send message to existing content script first
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'toggle-argos' });
    } catch {
      // Content script not loaded, inject it
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['overlay.js']
        });
      } catch (e) {
        // Can't inject (chrome:// pages, etc.) - open popup instead
        console.log('Cannot inject into this page');
      }
    }
  }
});
