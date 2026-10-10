# Recall — Voice Browser Memory

A modern, dark-mode Manifest V3 Chrome extension that automatically indexes the pages you browse and gives you complete tab control via natural language search and voice commands — running **100% locally on your device**.

---

## ⚡ Features

### 1. Natural Language On-Device Search
- **Automatic Page Memory**: Extracts the title and visible readable body text (up to 12,000 characters) when web pages load or URLs shift in SPAs.
- **Smart Stop-Word Filtering**: Strips common filler words (`the`, `and`, `to`, `of`, `in`, `for`, `with`, `is`, etc.) from long sentences and natural language queries.
- **Multi-Factor Ranked Scoring**:
  - **Keyword Matches**: Ranks pages by how many distinct query keywords appear.
  - **Title Matches**: Heavy weighting for title hits and prefix matches.
  - **Content & Density**: Frequency bonuses for repeated occurrences in the page body.
  - **Recency Boost**: Decayed boost favoring pages read today or this week.
  - **Partial Matches**: Surfaces results even if only 2–3 keywords match long natural language queries.
- **Keyword-Highlighted Snippets**: Extracts contextual text around matching keywords with highlighted marks.
- **Smart Tab Navigation**: Clicking a result focuses the existing tab across any open browser window if already open, or creates a new active tab.

### 2. Tab Automation & Control
Type commands into the bar or speak them via the microphone:
| Command | Action |
| --- | --- |
| `close duplicates` | Closes duplicate tabs in the current window sharing identical URLs |
| `close other tabs` / `close all except this` | Closes all tabs in the window except your active tab |
| `close all youtube tabs` (or any domain) | Closes all open tabs matching the specified domain or keyword |
| `group tabs by domain` | Automatically organizes tabs into colored, domain-named Chrome Tab Groups |
| `how many tabs` | Reports total tabs in the current window and across all open windows |
| `find tab [keyword]` | Searches open tabs by title/URL and switches focus directly to the match |

### 3. Voice Input & Speech Dictation
- Click the microphone icon to dictate searches or tab commands using the Web Speech API.
- Requested strictly on user gesture with instant permission error guidance if blocked.
- Completely optional: typing search and tab automation work independently without requiring microphone access.

### 4. 100% On-Device Privacy & Security
- **Zero Cloud & Zero External APIs**: All indexing, storage, searching, and speech parsing execute directly on your local machine.
- **Auto-Pruned Storage**: Stored in `chrome.storage.local` capped at the 500 most recent pages.
- **Sanitized Extraction**: Top-frame only execution that skips non-http(s) schemes (`chrome://`, `chrome-extension://`, `about:`, `file:`, etc.).
- **Clear All Memory**: Footer button allows one-click wiping of all stored pages with confirmation.

---

## 🚀 Installation Guide

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in the address bar.
3. Enable the **Developer mode** toggle in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the repository root folder containing `manifest.json`.
6. The **Recall Voice Browser Memory** extension is now ready to use.

---

## ⌨️ Shortcuts & Navigation

| Shortcut / Action | Function |
| --- | --- |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd> (Mac: <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd>) | Toggle / open the Recall side panel |
| <kbd>Enter</kbd> | Execute keyword search or trigger a tab automation command |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Navigate through search results list |
| <kbd>Escape</kbd> | Clear command bar and return to home view |
| Click Result Card | Focus open tab or open page in a new tab |
| Click Mic Icon | Start voice dictation |

---

## 📁 Project Structure

```
├── manifest.json       # Chrome Manifest V3 configuration & permissions
├── background.js       # Background service worker (storage, shortcuts & events)
├── content.js          # Top-frame readable text extractor & SPA change observer
├── sidepanel.html      # Side panel layout, command bar & quick action chips
├── sidepanel.css       # Dark-mode glassmorphic design system
├── sidepanel.js        # Ranked search, NLP keyword parser, voice & tab automation
├── generate_icons.js   # Icon generator utility
└── icons/              # Extension icons (16x16, 48x48, 128x128)
```

---

## 🔒 Permissions Used

- `storage`: Persists indexed pages and settings locally in `chrome.storage.local`.
- `tabs`: Queries, updates, activates, and closes browser tabs based on user commands.
- `tabGroups`: Groups browser tabs by domain with color labels.
- `sidePanel`: Powers the dedicated browser side panel UI.
- `activeTab`: Interacts with the currently active tab for tab operations.
- `audioCapture`: Prompts for microphone access when the user clicks the voice button.
- `<all_urls>`: Allows the content script to extract readable page text on visited websites.
