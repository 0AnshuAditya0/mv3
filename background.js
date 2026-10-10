/**
 * Recall Voice Browser Memory - Background Service Worker
 * Manages 100% on-device page storage, command shortcuts, and sidepanel initialization.
 */

const MAX_STORED_PAGES = 800;

// Setup side panel behavior on installation and browser startup
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Recall] Extension installed. Setting up side panel behavior...");
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn("[Recall] Unable to set panel behavior:", err);
    });
  }
});

/**
 * Validates whether a URL should be stored in Recall's local memory.
 * Never stores browser internal pages, extension pages, or invalid schemes.
 */
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

/**
 * Handle incoming messages from content scripts and side panel
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INDEX_PAGE") {
    handleIndexPage(message.data)
      .then((res) => sendResponse({ status: "stored", count: res.total }))
      .catch((err) => {
        console.error("[Recall] Failed to save page:", err);
        sendResponse({ status: "error", error: err.message });
      });
    return true; // Keep message channel open for async response
  }

  if (message.type === "GET_STATS") {
    chrome.storage.local.get({ pages: [] }, (data) => {
      sendResponse({ count: data.pages ? data.pages.length : 0 });
    });
    return true;
  }

  if (message.type === "CLEAR_ALL_DATA") {
    chrome.storage.local.set({ pages: [] }, () => {
      console.log("[Recall] Local page memory cleared.");
      sendResponse({ status: "cleared" });
    });
    return true;
  }
});

/**
 * Store page in local storage, deduplicating existing URLs and capping at 800 items.
 */
async function handleIndexPage(pageData) {
  if (!pageData || !isValidMemoryUrl(pageData.url)) {
    return { skipped: true };
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ pages: [] }, (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }

      let pages = Array.isArray(result.pages) ? result.pages : [];

      // Remove existing entry with exact same URL to avoid duplicate clutter
      pages = pages.filter((item) => item.url !== pageData.url);

      // Prepend newest entry to the top
      pages.unshift({
        id: pageData.id || `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        url: pageData.url,
        title: pageData.title || "Untitled Page",
        text: pageData.text || "",
        domain: pageData.domain || "",
        timestamp: pageData.timestamp || Date.now()
      });

      // Keep only the most recent MAX_STORED_PAGES (800)
      if (pages.length > MAX_STORED_PAGES) {
        pages = pages.slice(0, MAX_STORED_PAGES);
      }

      chrome.storage.local.set({ pages }, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        console.log(`[Recall] Storage updated. Total indexed pages: ${pages.length}`);
        resolve({ total: pages.length });
      });
    });
  });
}

/**
 * Keyboard shortcuts handler via chrome.commands API.
 * Opens the side panel when Control+Shift+Space (or Command+Shift+Space) is pressed.
 */
chrome.commands.onCommand.addListener(async (command) => {
  console.log(`[Recall] Command received: ${command}`);

  if (command === "open_recall" || command === "_execute_action") {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (activeTab && activeTab.windowId) {
        await chrome.sidePanel.open({ windowId: activeTab.windowId });
        console.log(`[Recall] Side panel opened in window ${activeTab.windowId}`);
      } else {
        const win = await chrome.windows.getLastFocused();
        if (win && win.id) {
          await chrome.sidePanel.open({ windowId: win.id });
        }
      }
    } catch (err) {
      console.warn("[Recall] Could not open side panel via command:", err);
    }
  }
});
