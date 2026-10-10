# Recall — Voice Browser Memory

A powerful, dark-mode-first Manifest V3 Chrome extension that remembers everything you browse and gives you complete tab control via natural language search and voice commands — running **100% locally on your device**.

---

## ⚡ Features

1. **Instant On-Device Search**
   - Extracts readable article/body text as you browse (up to 15,000 characters per page).
   - Fast multi-factor keyword search over stored pages:
     - **Title matches** get high weight.
     - **Exact phrase matches** get prioritized.
     - **Word token frequency & density** ranking.
     - **Recency boost**: Pages browsed today or this week rank higher.
   - Snippet generation with highlighted matching keywords.
   - Click to focus existing tab or open in new tab.

2. **Tab Automation & Control**
   Execute instant browser actions directly from the command bar (or by voice):
   - `close duplicates` / `remove duplicate tabs`: Closes duplicate tabs sharing identical URLs.
   - `close other tabs` / `close all except this one`: Closes all tabs in the window except the active tab.
   - `close all youtube tabs` / `close tabs matching <domain>`: Closes tabs matching a domain or keyword.
   - `group tabs by domain`: Automatically groups tabs into organized, colorized Chrome Tab Groups.
   - `how many tabs`: Displays tab count across windows.
   - `find tab <keyword>` (e.g. `find tab pricing`): Searches open tabs and instantly switches to and focuses it.

3. **Voice Command Dictation**
   - Click the microphone icon to dictate searches or tab commands via the built-in Web Speech API.

4. **100% Private & Local**
   - No external APIs, no remote servers, no cloud telemetry.
   - Stored in `chrome.storage.local` with a strict limit of the most recent 800 pages (oldest pruned automatically).
   - Never saves password fields, credentials, forms, or browser internal URLs (`chrome://`, `chrome-extension://`).

---

## 🚀 Installation Guide

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in the address bar.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select this project folder (`d:\HHGOA`).
6. The **Recall Voice Browser Memory** extension is now installed!

---

## ⌨️ Shortcuts & Usage

- **Open Command Bar**: Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd> (Mac: <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd>) or click the extension icon.
- **Navigate Results**: Use <kbd>↑</kbd> and <kbd>↓</kbd> arrow keys to navigate matching pages; press <kbd>Enter</kbd> to open.
- **Clear Input**: Press <kbd>Escape</kbd> or click the clear button.
- **Voice Input**: Click the mic icon and speak your query or tab command.

---

## 📁 Project Structure

```
d:/HHGOA/
├── manifest.json       # Manifest V3 configuration & permissions
├── background.js       # Service worker (local storage & shortcuts)
├── content.js          # Readable content extractor & privacy filter
├── sidepanel.html      # Command bar & side panel UI
├── sidepanel.css       # Premium dark-mode glassmorphism design
├── sidepanel.js        # Search scoring, voice recognition & tab controller
├── generate_icons.js   # Script for generating PNG icon assets
├── icons/              # Extension icons (16x16, 48x48, 128x128)
└── readme.md           # Documentation & quick start guide
```
