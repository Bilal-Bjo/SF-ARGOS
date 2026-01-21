# SF Argos

A Chrome extension to manage multiple Salesforce orgs with quick login functionality.

## Features

- **Quick Org Switching** - Manage multiple Salesforce orgs in one place
- **Auto-Login** - One-click login to any saved org
- **Environment Labels** - Color-coded badges for DEV, INT, UAT, PROD environments
- **Family Grouping** - Organize orgs by project/client
- **Keyboard Shortcuts** - Fast navigation with `Alt+Shift+A` to open from any page
- **Search** - Quickly filter orgs by name, username, or family

## Security

**Your credentials are encrypted and secure:**

- Passwords are encrypted using **AES-256-GCM** encryption before being stored
- Encryption keys are generated per-installation and stored locally
- **We do not store plain text passwords**
- **We do not send any data to external servers**
- All data stays in your browser's local storage
- Credentials are only decrypted momentarily during auto-login and immediately cleared

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the `sf-argos` folder
5. The extension icon will appear in your toolbar

## Usage

### Opening SF Argos

- Click the extension icon in your toolbar, OR
- Press `Alt+Shift+A` from any webpage

### Adding an Org

1. Click the green `+` button
2. Fill in the details:
   - **Family/Project** - Group name (e.g., "Acme Corp")
   - **Org Name** - Display name (e.g., "Acme Dev")
   - **Environment** - DEV, INT, UAT, or PROD
   - **Username** - Your Salesforce username
   - **Password** - Your Salesforce password (encrypted before storage)
   - **Login URL** - Your org's login URL (e.g., `https://test.salesforce.com` or custom domain)
3. Click Save

### Logging In

- Click the green arrow `→` button on any org, OR
- Use arrow keys to select and press `Enter`
- Double-click an org

The extension will open the login page and automatically fill in your credentials.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Alt+Shift+A` | Open SF Argos overlay |
| `↑` / `↓` | Navigate orgs |
| `Enter` | Login to selected org |
| `Esc` | Close overlay / Clear search |

## File Structure

```
sf-argos/
├── manifest.json      # Extension configuration
├── background.js      # Service worker for keyboard shortcuts
├── content.js         # Auto-login script for Salesforce pages
├── content.css        # Styles (unused, styles are inline)
├── overlay.js         # Main UI overlay
├── popup.html         # Extension popup
├── popup.js           # Popup functionality
└── icons/             # Extension icons
```

## How It Works

1. **Overlay** (`overlay.js`) - Injected into any page when triggered, provides the main UI for managing orgs
2. **Background** (`background.js`) - Listens for keyboard shortcuts and injects the overlay
3. **Content Script** (`content.js`) - Runs on Salesforce login pages, reads encrypted credentials from storage, decrypts them, and auto-fills the login form

## Privacy

- All data is stored locally in Chrome's `chrome.storage.local`
- No analytics or tracking
- No external API calls
- Open source - audit the code yourself

## License

MIT
