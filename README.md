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

## Installation

- **Chrome / Edge:** Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/fuzzy-history-search/mmpijcdkoeomkbnfednbokgmhaaemhcg)
- **Firefox:** Install from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/fuzzy-history-search/)

## Usage

Type `h ` in the address bar, or press `Cmd+E` (Mac) / `Ctrl+Shift+E` (Windows/Linux) to open the search panel.

| Shortcut | Action |
|---|---|
| `↑` `↓` | Navigate results |
| `Enter` | Open in current tab |
| `Cmd+Enter` / `Ctrl+Enter` | Open in new tab |
| `Shift+Enter` | Open in background tab |
| `Esc` | Close panel |

## Privacy

This extension does **not** collect, transmit, or share any data. All processing happens locally on your device. See the full [Privacy Policy](https://umitaltintas.github.io/fuzzy-history-search/privacy/).

## License

[MIT](LICENSE)
