const MAX_STORED_PAGES = 500;

function setupSidePanelBehavior() {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn("[Recall Background] Error setting panel behavior:", err);
    });
  }
}

setupSidePanelBehavior();

chrome.runtime.onInstalled.addListener(() => {
  setupSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  setupSidePanelBehavior();
});

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        const windowId = tab && tab.windowId ? tab.windowId : (await chrome.windows.getLastFocused()).id;
        await chrome.sidePanel.open({ windowId });
      }
    } catch (err) {
      console.warn("[Recall Background] Could not open side panel on action click:", err);
    }
  });
}

if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    try {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const windowId = activeTab && activeTab.windowId ? activeTab.windowId : (await chrome.windows.getLastFocused()).id;
        await chrome.sidePanel.open({ windowId });
      }
    } catch (err) {
      console.warn("[Recall Background] Error opening side panel via command:", err);
    }
  });
}

function isValidMemoryUrl(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase().trim();
  if (
    lower.startsWith("chrome://") ||
    lower.startsWith("chrome-extension://") ||
    lower.startsWith("edge://") ||
    lower.startsWith("about:") ||
    lower.startsWith("data:") ||
    lower.startsWith("file:") ||
    lower.startsWith("view-source:") ||
    lower.startsWith("devtools://")
  ) {
    return false;
  }
  return lower.startsWith("http://") || lower.startsWith("https://");
}

function sanitizeStoragePages(raw) {
  if (Array.isArray(raw)) return raw;
  return [];
}

async function handleIndexPage(pageData) {
  if (!pageData || !isValidMemoryUrl(pageData.url)) {
    return { skipped: true, total: 0 };
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ pages: [] }, (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }

      let pages = sanitizeStoragePages(result.pages);

      pages = pages.filter((item) => item && item.url !== pageData.url);

      const entry = {
        id: pageData.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url: pageData.url,
        title: (pageData.title || "Untitled Page").trim(),
        text: (pageData.text || "").trim(),
        domain: (pageData.domain || "").trim(),
        timestamp: pageData.timestamp || Date.now()
      };

      pages.unshift(entry);

      if (pages.length > MAX_STORED_PAGES) {
        pages = pages.slice(0, MAX_STORED_PAGES);
      }

      chrome.storage.local.set({ pages }, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        const totalChars = entry.title.length + (entry.text ? entry.text.length + 1 : 0);
        console.log(`Page saved: ${entry.title} – ${totalChars} characters`);
        chrome.runtime.sendMessage({ type: "PAGE_COUNT_UPDATED", count: pages.length }).catch(() => {});
        resolve({ status: "stored", total: pages.length });
      });
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "INDEX_PAGE") {
    handleIndexPage(message.data)
      .then((res) => sendResponse({ status: "stored", count: res.total }))
      .catch((err) => {
        console.error("[Recall Background] Storage error:", err);
        sendResponse({ status: "error", error: err.message });
      });
    return true;
  }

  if (message.type === "GET_STATS") {
    chrome.storage.local.get({ pages: [] }, (result) => {
      const pages = sanitizeStoragePages(result.pages);
      sendResponse({ count: pages.length });
    });
    return true;
  }

  if (message.type === "CLEAR_ALL_DATA") {
    chrome.storage.local.set({ pages: [] }, () => {
      console.log("[Recall Background] Cleared all stored pages from local storage.");
      chrome.runtime.sendMessage({ type: "PAGE_COUNT_UPDATED", count: 0 }).catch(() => {});
      sendResponse({ status: "cleared", count: 0 });
    });
    return true;
  }
});
