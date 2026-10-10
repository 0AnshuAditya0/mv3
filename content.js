(() => {
  if (window !== window.top) return;

  const MAX_TOTAL_CHARS = 12000;
  let lastIndexedUrl = "";
  let debounceTimeout = null;

  function isValidHttpUrl(url) {
    if (!url || typeof url !== "string") return false;
    const lower = url.toLowerCase();
    return lower.startsWith("http://") || lower.startsWith("https://");
  }

  function getReadablePageText() {
    const mainEl = document.querySelector("article, main, [role='main']");
    let rawText = "";

    if (mainEl && typeof mainEl.innerText === "string" && mainEl.innerText.trim().length > 100) {
      rawText = mainEl.innerText;
    } else if (document.body && typeof document.body.innerText === "string") {
      rawText = document.body.innerText;
    } else if (document.body && typeof document.body.textContent === "string") {
      rawText = document.body.textContent;
    }

    return (rawText || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  }

  function extractAndSendPage() {
    const currentUrl = window.location.href;
    if (!isValidHttpUrl(currentUrl)) return;

    const title = (document.title || window.location.hostname || "Untitled Page").trim();
    const fullBody = getReadablePageText();

    const maxAllowedBody = Math.max(0, MAX_TOTAL_CHARS - title.length - 1);
    const bodyText = fullBody.slice(0, maxAllowedBody).trim();
    const totalChars = title.length + (bodyText ? bodyText.length + 1 : 0);

    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: currentUrl,
      title: title,
      text: bodyText,
      domain: window.location.hostname.replace(/^www\./i, ""),
      timestamp: Date.now()
    };

    chrome.runtime.sendMessage(
      {
        type: "INDEX_PAGE",
        data: payload
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Recall Content] Background error:", chrome.runtime.lastError.message);
        } else if (response && response.status === "stored") {
          lastIndexedUrl = currentUrl;
          console.log(`Page saved: ${title} – ${totalChars} characters`);
        }
      }
    );
  }

  function scheduleExtraction(delay = 400) {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      extractAndSendPage();
    }, delay);
  }

  scheduleExtraction(300);

  if (document.readyState !== "complete") {
    window.addEventListener("load", () => scheduleExtraction(400), { once: true });
    document.addEventListener("DOMContentLoaded", () => scheduleExtraction(400), { once: true });
  }

  window.addEventListener("popstate", () => scheduleExtraction(400));
  window.addEventListener("hashchange", () => scheduleExtraction(400));

  let currentUrlTracker = window.location.href;
  setInterval(() => {
    if (window.location.href !== currentUrlTracker) {
      currentUrlTracker = window.location.href;
      if (currentUrlTracker !== lastIndexedUrl) {
        scheduleExtraction(500);
      }
    }
  }, 1000);
})();
