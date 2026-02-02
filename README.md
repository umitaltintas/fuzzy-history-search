# Fuzzy History Search

A browser extension that brings VS Code-style fuzzy search to your browsing history. Activate it by typing `h ` in the address bar or using a keyboard shortcut.

**[Website](https://umitaltintas.github.io/fuzzy-history-search/)** · **[Chrome Web Store](https://chromewebstore.google.com/detail/fuzzy-history-search/mmpijcdkoeomkbnfednbokgmhaaemhcg)** · **[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/fuzzy-history-search/)**

![Popup Window](website/public/screenshots/popup.png)

## Features

- **Omnibox integration** — Type `h ` in the address bar, then enter your query
- **Overlay mode** — A search panel that appears on top of any page (Cmd+E / Ctrl+Shift+E)
- **Popup window** — Automatically opens a separate window when the overlay can't be injected
- **Fuzzy matching** — fzf-style DP-based optimal character alignment
- **Smart ranking** — Scoring based on visit count, recency, host match, and boundary detection
- **Active tab support** — Currently open tabs are included in the results

## Installation

### Chrome / Edge / Chromium

Install from the **[Chrome Web Store](https://chromewebstore.google.com/detail/fuzzy-history-search/mmpijcdkoeomkbnfednbokgmhaaemhcg)**.

Or load manually:

1. Clone the repo or download and extract the ZIP:
   ```
   git clone https://github.com/umitaltintas/fuzzy-history-search.git
   ```
2. Go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the `fuzzy-history-search` folder

#### Setting a keyboard shortcut (Chrome)

Chrome may not automatically assign the `suggested_key` if it conflicts with another extension. To set it manually:

1. Go to `chrome://extensions/shortcuts`
2. Find "Open fuzzy history search window" under **Fuzzy History Search**
3. Click the pencil icon and enter your preferred shortcut (recommended: `Cmd+E` / `Ctrl+Shift+E`)

### Firefox

Install from **[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/fuzzy-history-search/)**.

Or install manually:

#### Signed `.xpi` (recommended)

1. Download the `.xpi` file from [Releases](https://github.com/umitaltintas/fuzzy-history-search/releases/latest)
2. Firefox will automatically open the extension install dialog
3. Click **Add**

#### Temporary installation (developers)

1. Clone the repo or download and extract the ZIP
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `manifest.json` inside the `fuzzy-history-search` folder

> **Note:** Temporary extensions are removed when the browser is closed.

#### Setting a keyboard shortcut (Firefox)

1. Go to `about:addons`
2. Click the gear icon in the top right
3. Select **Manage Extension Shortcuts**
4. Set the shortcut under **Fuzzy History Search**

## Usage

### Omnibox

Type `h ` (h followed by a space) in the address bar, then enter your query. Results appear in the omnibox dropdown.

### Overlay / Popup

Press the keyboard shortcut (default `Cmd+E` / `Ctrl+Shift+E`) to open the search panel.

| Shortcut | Action |
|---|---|
| Type | Search history |
| `↑` `↓` | Navigate results |
| `Enter` | Open in current tab |
| `Cmd+Enter` / `Ctrl+Enter` | Open in new tab |
| `Shift+Enter` | Open in background tab |
| `Esc` | Close panel |

## File Structure

```
fuzzy-history-search/
├── manifest.json       # Extension configuration (MV3)
├── background.js       # Service worker: history cache, fuzzy scoring, omnibox
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-96.png
└── ui/
    ├── index.html      # Popup window HTML
    ├── ui.css           # Popup window styles
    ├── ui.js            # Popup window logic
    └── overlay.js       # In-page overlay injected via content script
```

## Permissions

| Permission | Reason |
|---|---|
| `history` | Read browser history to provide search results |
| `tabs` | Query active tab info and open/update tabs |
| `activeTab` | Inject the overlay into the active tab when the shortcut is triggered |
| `scripting` | Inject the content script (overlay.js) programmatically (MV3) |

## Privacy

This extension does **not** collect, transmit, or share any data. All processing happens locally on your device. See the full [Privacy Policy](https://umitaltintas.github.io/fuzzy-history-search/privacy/).

## License

[MIT](LICENSE)
