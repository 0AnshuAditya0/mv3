/**
 * Recall Voice Browser Memory - Content Script
 * Extracts readable page content on-device without external APIs or cloud sync.
 */

(() => {
  // Guard against re-execution
  if (window.__RECALL_CONTENT_SCRIPT_INITIALIZED__) return;
  window.__RECALL_CONTENT_SCRIPT_INITIALIZED__ = true;

  const MAX_TEXT_LENGTH = 15000;
  const DEBOUNCE_DELAY_MS = 1500;
  let extractionTimeout = null;

  /**
   * Check if current page is safe and valid to index.
   * Skips browser system URLs, password inputs, sensitive credentials pages.
   */
  function isSafeToIndex() {
    const url = window.location.href;

    // Disallow non-http/https protocols
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return false;
    }

    // Never index pages with active password fields to preserve privacy
    try {
      const passwordInput = document.querySelector('input[type="password"]');
      if (passwordInput) {
        console.log("[Recall] Skipping page containing password input for privacy protection.");
        return false;
      }
    } catch (e) {
      // Ignore query errors in restricted DOMs
    }

    return true;
  }

  /**
   * Find the most meaningful content container (article > [role=main] > main > body).
   */
  function findMainContentElement() {
    const candidates = [
      document.querySelector("article"),
      document.querySelector('[role="main"]'),
      document.querySelector("main"),
      document.querySelector(".main-content"),
      document.querySelector("#main-content"),
      document.querySelector(".post-content"),
      document.querySelector(".article-content"),
      document.body
    ];

    for (const el of candidates) {
      if (el && el.innerText && el.innerText.trim().length > 100) {
        return el;
      }
    }
    return document.body;
  }

  /**
   * Extract clean, human-readable text from an element while ignoring
   * scripts, styles, navigation, footers, headers, ads, and forms.
   */
  function extractReadableText() {
    if (!isSafeToIndex()) return null;

    const root = findMainContentElement();
    if (!root) return null;

    // Clone root node to safely prune non-content elements without mutating DOM
    const clone = root.cloneNode(true);

    // Elements to aggressively strip out
    const tagsToRemove = [
      "script",
      "style",
      "noscript",
      "nav",
      "footer",
      "header",
      "aside",
      "svg",
      "canvas",
      "iframe",
      "form",
      "input",
      "textarea",
      "select",
      "button",
      "dialog",
      "[aria-hidden='true']",
      ".ad",
      ".ads",
      ".advertisement",
      ".social-share",
      ".cookie-banner",
      ".modal"
    ];

    tagsToRemove.forEach((selector) => {
      try {
        const matches = clone.querySelectorAll(selector);
        matches.forEach((node) => node.remove());
      } catch (err) {
        // Selector might not be supported in some edge cases
      }
    });

    // Extract text and normalize excess whitespaces
    let rawText = clone.innerText || clone.textContent || "";
    let cleanedText = rawText
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Enforce 15,000 characters limit
    if (cleanedText.length > MAX_TEXT_LENGTH) {
      cleanedText = cleanedText.slice(0, MAX_TEXT_LENGTH);
    }

    // Discard empty or trivial pages
    if (cleanedText.length < 30) {
      return null;
    }

    return cleanedText;
  }

  /**
   * Index and send page data to the background service worker.
   */
  function indexCurrentPage() {
    try {
      const text = extractReadableText();
      if (!text) return;

      const pageData = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        url: window.location.href,
        title: (document.title || window.location.hostname || "Untitled Page").trim(),
        text: text,
        domain: window.location.hostname.replace(/^www\./i, ""),
        timestamp: Date.now()
      };

      chrome.runtime.sendMessage(
        {
          type: "INDEX_PAGE",
          data: pageData
        },
        (response) => {
          if (chrome.runtime.lastError) {
            // Extension context might be invalidated or service worker asleep
            console.debug("[Recall] Message dispatch:", chrome.runtime.lastError.message);
          } else if (response && response.status === "stored") {
            console.log(`[Recall] Successfully indexed: "${pageData.title}" (${pageData.text.length} chars)`);
          }
        }
      );
    } catch (error) {
      console.warn("[Recall] Indexing error:", error);
    }
  }

  /**
   * Debounced runner to avoid excessive calls on rapid DOM shifts or SPAs
   */
  function scheduleIndexing() {
    if (extractionTimeout) clearTimeout(extractionTimeout);
    extractionTimeout = setTimeout(indexCurrentPage, DEBOUNCE_DELAY_MS);
  }

  // Initial indexing upon document idle
  scheduleIndexing();

  // Handle Single Page Applications (SPA) navigation changes
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      scheduleIndexing();
    }
  });

  observer.observe(document, { subtree: true, childList: true });

  window.addEventListener("popstate", scheduleIndexing);
  window.addEventListener("hashchange", scheduleIndexing);
})();
