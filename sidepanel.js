(() => {
  const commandInput = document.getElementById("command-input");
  const clearBtn = document.getElementById("clear-btn");
  const micBtn = document.getElementById("mic-btn");
  const searchIcon = document.getElementById("search-icon");
  const storageCountBadge = document.getElementById("storage-count-badge");
  const resultsList = document.getElementById("results-list");
  const resultsMeta = document.getElementById("results-meta");
  const resultsCount = document.getElementById("results-count");
  const statusBanner = document.getElementById("status-banner");
  const bannerIcon = document.getElementById("banner-icon");
  const bannerText = document.getElementById("banner-text");
  const initialState = document.getElementById("initial-state");
  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");
  const chipButtons = document.querySelectorAll(".chip");
  const clearMemoryBtn = document.getElementById("clear-memory-btn");

  const STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself",
    "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most",
    "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our",
    "ours", "ourselves", "out", "over", "own", "s", "same", "she", "should", "so", "some", "such",
    "t", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these",
    "they", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "we",
    "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "would",
    "you", "your", "yours", "yourself", "yourselves"
  ]);

  let pagesMemory = [];
  let currentSearchResults = [];
  let selectedResultIndex = -1;
  let recognition = null;
  let isListening = false;
  let bannerTimeout = null;

  async function init() {
    focusCommandInput();
    setupEventListeners();
    await loadPagesFromStorage(false);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.pages) {
        pagesMemory = sanitizePagesArray(changes.pages.newValue);
        updateStorageCountBadge(true);
      }
    });

    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "PAGE_COUNT_UPDATED") {
          if (typeof msg.count === "number") {
            setStorageBadgeCount(msg.count, true);
          }
          loadPagesFromStorage(true);
        }
      });
    }

    window.addEventListener("focus", () => {
      focusCommandInput();
      loadPagesFromStorage(true);
    });
  }

  function focusCommandInput() {
    if (!commandInput) return;
    requestAnimationFrame(() => {
      commandInput.focus();
    });
    setTimeout(() => {
      commandInput.focus();
    }, 60);
  }

  function sanitizePagesArray(raw) {
    if (Array.isArray(raw)) return raw;
    return [];
  }

  async function loadPagesFromStorage(animate = false) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ pages: [] }, (data) => {
        if (!data || !Array.isArray(data.pages)) {
          pagesMemory = [];
          chrome.storage.local.set({ pages: [] });
        } else {
          pagesMemory = data.pages;
        }
        updateStorageCountBadge(animate);
        resolve(pagesMemory);
      });
    });
  }

  function setStorageBadgeCount(count, animate = false) {
    if (!storageCountBadge) return;
    storageCountBadge.textContent = `${count} page${count === 1 ? "" : "s"}`;
    if (animate) {
      storageCountBadge.classList.remove("count-bump");
      void storageCountBadge.offsetWidth;
      storageCountBadge.classList.add("count-bump");
      setTimeout(() => {
        storageCountBadge.classList.remove("count-bump");
      }, 400);
    }
  }

  function updateStorageCountBadge(animate = false) {
    setStorageBadgeCount(pagesMemory.length, animate);
  }

  function showStatusBanner(message, type = "success") {
    if (bannerTimeout) clearTimeout(bannerTimeout);

    bannerText.textContent = message;

    if (bannerIcon) {
      if (type === "success") {
        bannerIcon.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
      } else if (type === "error") {
        bannerIcon.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        `;
      } else {
        bannerIcon.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        `;
      }
    }

    statusBanner.className = `status-banner banner-${type}`;
    statusBanner.classList.remove("hidden");

    bannerTimeout = setTimeout(() => {
      statusBanner.classList.add("hidden");
    }, 2500);
  }

  async function handleTabCommands(rawText) {
    const text = rawText.toLowerCase().trim().replace(/[?!.]+$/, "");

    if (
      text === "close duplicates" ||
      text === "close duplicate tabs" ||
      text === "remove duplicates" ||
      text === "remove duplicate tabs" ||
      text === "dedupe tabs" ||
      text === "delete duplicate tabs"
    ) {
      await executeCloseDuplicates();
      return true;
    }

    if (
      text === "close other tabs" ||
      text === "close others" ||
      text === "close other" ||
      text === "close all except this" ||
      text === "close all except this one" ||
      text === "close tabs except this" ||
      text === "close every tab except this" ||
      text === "close every tab except this one" ||
      text === "close all other tabs"
    ) {
      await executeCloseOtherTabs();
      return true;
    }

    if (
      text === "how many tabs" ||
      text === "how many tabs do i have" ||
      text === "count tabs" ||
      text === "tab count" ||
      text === "number of tabs" ||
      text === "tabs count"
    ) {
      await executeCountTabs();
      return true;
    }

    if (
      text === "group tabs by domain" ||
      text === "group tabs" ||
      text === "group by domain" ||
      text === "auto group tabs"
    ) {
      await executeGroupTabsByDomain();
      return true;
    }

    const closeDomainRegexes = [
      /^(?:close all|close tabs matching|close tabs from|close)\s+([a-z0-9.-]+)\s*(?:tabs)?$/i,
      /^close all tabs from\s+([a-z0-9.-]+)$/i,
      /^close tabs from\s+([a-z0-9.-]+)$/i
    ];

    for (const reg of closeDomainRegexes) {
      const match = text.match(reg);
      if (match && match[1]) {
        const candidate = match[1].trim().toLowerCase();
        if (!["other", "others", "duplicate", "duplicates", "all"].includes(candidate)) {
          await executeCloseDomainTabs(candidate);
          return true;
        }
      }
    }

    const findTabRegexes = [
      /^(?:find tab|focus tab|switch to tab|go to tab)\s+(.+)$/i,
      /^find\s+(.+)\s+tab$/i
    ];

    for (const reg of findTabRegexes) {
      const match = text.match(reg);
      if (match && match[1]) {
        const keyword = match[1].trim();
        await executeFindTab(keyword);
        return true;
      }
    }

    return false;
  }

  async function executeCloseDuplicates() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const seenUrls = new Set();
      const duplicateTabIds = [];

      tabs.forEach((tab) => {
        if (!tab.url) return;
        const cleanUrl = tab.url.split("#")[0].replace(/\/$/, "").toLowerCase();
        if (seenUrls.has(cleanUrl)) {
          duplicateTabIds.push(tab.id);
        } else {
          seenUrls.add(cleanUrl);
        }
      });

      if (duplicateTabIds.length === 0) {
        showStatusBanner("No duplicate tabs found in current window.", "info");
      } else {
        await chrome.tabs.remove(duplicateTabIds);
        showStatusBanner(`Closed ${duplicateTabIds.length} duplicate tab${duplicateTabIds.length === 1 ? "" : "s"}.`, "success");
      }
    } catch (err) {
      console.error("[Recall Sidepanel] Error closing duplicates:", err);
      showStatusBanner(`Error closing duplicates: ${err.message}`, "error");
    }
  }

  async function executeCloseOtherTabs() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        showStatusBanner("Could not determine the active tab.", "error");
        return;
      }

      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const tabsToClose = allTabs.filter((t) => t.id !== activeTab.id).map((t) => t.id);

      if (tabsToClose.length === 0) {
        showStatusBanner("No other tabs to close in this window.", "info");
      } else {
        await chrome.tabs.remove(tabsToClose);
        showStatusBanner(`Closed ${tabsToClose.length} other tab${tabsToClose.length === 1 ? "" : "s"}.`, "success");
      }
    } catch (err) {
      console.error("[Recall Sidepanel] Error closing other tabs:", err);
      showStatusBanner(`Error closing other tabs: ${err.message}`, "error");
    }
  }

  async function executeCountTabs() {
    try {
      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      const allTabs = await chrome.tabs.query({});
      const windows = await chrome.windows.getAll();

      showStatusBanner(
        `You have ${currentTabs.length} tab${currentTabs.length === 1 ? "" : "s"} in this window (${allTabs.length} total across ${windows.length} window${windows.length === 1 ? "" : "s"}).`,
        "info"
      );
    } catch (err) {
      console.error("[Recall Sidepanel] Error counting tabs:", err);
      showStatusBanner(`Error counting tabs: ${err.message}`, "error");
    }
  }

  async function executeGroupTabsByDomain() {
    try {
      if (!chrome.tabs.group) {
        showStatusBanner("Tab grouping is not supported in this browser version.", "error");
        return;
      }

      const tabs = await chrome.tabs.query({ currentWindow: true });
      if (tabs.length === 0) {
        showStatusBanner("No open tabs found to group.", "info");
        return;
      }

      const domainMap = new Map();
      tabs.forEach((tab) => {
        if (!tab.url) return;
        try {
          const urlObj = new URL(tab.url);
          const domain = urlObj.hostname.replace(/^www\./i, "");
          if (!domain) return;
          if (!domainMap.has(domain)) {
            domainMap.set(domain, []);
          }
          domainMap.get(domain).push(tab.id);
        } catch (e) {}
      });

      let groupsCreated = 0;
      const groupColors = ["blue", "purple", "cyan", "green", "yellow", "orange", "pink", "grey"];
      let colorIdx = 0;

      for (const [domain, tabIds] of domainMap.entries()) {
        if (tabIds.length > 0) {
          const groupId = await chrome.tabs.group({ tabIds });
          if (chrome.tabGroups && chrome.tabGroups.update) {
            await chrome.tabGroups.update(groupId, {
              title: domain,
              color: groupColors[colorIdx % groupColors.length]
            });
            colorIdx++;
          }
          groupsCreated++;
        }
      }

      if (groupsCreated === 0) {
        showStatusBanner("No valid web domains found to group.", "info");
      } else {
        showStatusBanner(`Grouped tabs into ${groupsCreated} domain group${groupsCreated === 1 ? "" : "s"}.`, "success");
      }
    } catch (err) {
      console.error("[Recall Sidepanel] Error grouping tabs:", err);
      showStatusBanner(`Error grouping tabs: ${err.message}`, "error");
    }
  }

  async function executeCloseDomainTabs(keyword) {
    try {
      const cleanKeyword = keyword.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
      const tabs = await chrome.tabs.query({ currentWindow: true });
      let toClose = [];

      tabs.forEach((tab) => {
        const titleMatch = (tab.title || "").toLowerCase().includes(cleanKeyword);
        const urlMatch = (tab.url || "").toLowerCase().includes(cleanKeyword);
        if (titleMatch || urlMatch) {
          toClose.push(tab.id);
        }
      });

      if (toClose.length === 0) {
        const allTabs = await chrome.tabs.query({});
        allTabs.forEach((tab) => {
          const titleMatch = (tab.title || "").toLowerCase().includes(cleanKeyword);
          const urlMatch = (tab.url || "").toLowerCase().includes(cleanKeyword);
          if (titleMatch || urlMatch) {
            toClose.push(tab.id);
          }
        });
      }

      if (toClose.length === 0) {
        showStatusBanner(`No open tabs found matching "${keyword}".`, "info");
      } else {
        await chrome.tabs.remove(toClose);
        showStatusBanner(`Closed ${toClose.length} tab${toClose.length === 1 ? "" : "s"} matching "${keyword}".`, "success");
      }
    } catch (err) {
      console.error("[Recall Sidepanel] Error closing domain tabs:", err);
      showStatusBanner(`Error closing domain tabs: ${err.message}`, "error");
    }
  }

  async function executeFindTab(keyword) {
    try {
      const cleanKeyword = keyword.toLowerCase().trim();
      const allTabs = await chrome.tabs.query({});
      let bestMatch = null;

      for (const tab of allTabs) {
        const title = (tab.title || "").toLowerCase();
        const url = (tab.url || "").toLowerCase();

        if (title.includes(cleanKeyword)) {
          bestMatch = tab;
          break;
        } else if (url.includes(cleanKeyword) && !bestMatch) {
          bestMatch = tab;
        }
      }

      if (bestMatch) {
        await chrome.tabs.update(bestMatch.id, { active: true });
        if (bestMatch.windowId) {
          await chrome.windows.update(bestMatch.windowId, { focused: true });
        }
        showStatusBanner(`Switched to tab: "${bestMatch.title || bestMatch.url}"`, "success");
      } else {
        showStatusBanner(`No open tab found matching "${keyword}".`, "error");
      }
    } catch (err) {
      console.error("[Recall Sidepanel] Error finding tab:", err);
      showStatusBanner(`Error switching tab: ${err.message}`, "error");
    }
  }

  function extractMeaningfulKeywords(query) {
    const cleanText = query.toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
    const rawTokens = cleanText.split(/\s+/).filter((t) => t.length > 0);
    let filtered = rawTokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token));
    if (filtered.length === 0) {
      filtered = rawTokens.filter((token) => token.length > 1);
    }
    if (filtered.length === 0) {
      filtered = rawTokens;
    }
    return Array.from(new Set(filtered));
  }

  function executeSearch(query) {
    selectedResultIndex = -1;
    const trimmed = query.trim();

    if (!trimmed) {
      renderInitialView();
      return;
    }

    showLoadingState();

    setTimeout(() => {
      performNaturalLanguageSearch(trimmed);
    }, 120);
  }

  function performNaturalLanguageSearch(rawQuery) {
    if (!pagesMemory || pagesMemory.length === 0) {
      renderResults([], [], rawQuery);
      return;
    }

    const keywords = extractMeaningfulKeywords(rawQuery);
    if (keywords.length === 0) {
      renderResults([], [], rawQuery);
      return;
    }

    const lowerQuery = rawQuery.toLowerCase().trim();
    const now = Date.now();
    const scoredList = [];

    for (let i = 0; i < pagesMemory.length; i++) {
      const page = pagesMemory[i];
      if (!page) continue;

      const titleLower = (page.title || "").toLowerCase();
      const textLower = (page.text || "").toLowerCase();
      const domainLower = (page.domain || "").toLowerCase();

      let matchedKeywords = [];
      let titleHits = 0;
      let contentHits = 0;
      let domainHits = 0;
      let totalFrequency = 0;

      keywords.forEach((kw) => {
        let isMatched = false;

        if (titleLower.includes(kw)) {
          titleHits++;
          isMatched = true;
        }

        if (domainLower.includes(kw)) {
          domainHits++;
          isMatched = true;
        }

        if (textLower.includes(kw)) {
          contentHits++;
          isMatched = true;
          const reg = new RegExp(escapeRegExp(kw), "g");
          const occurrences = (textLower.match(reg) || []).length;
          totalFrequency += Math.min(occurrences, 8);
        }

        if (isMatched) {
          matchedKeywords.push(kw);
        }
      });

      const matchCount = matchedKeywords.length;
      if (matchCount === 0) continue;

      let score = matchCount * 150;
      score += titleHits * 90;
      score += contentHits * 25;
      score += domainHits * 35;
      score += totalFrequency * 3;

      if (titleLower.includes(lowerQuery)) {
        score += 350;
      }
      if (textLower.includes(lowerQuery)) {
        score += 180;
      }

      const ageHours = Math.max(0, (now - (page.timestamp || now)) / 3600000);
      score += Math.max(0, 30 - Math.min(30, ageHours / 24));

      scoredList.push({
        page,
        score,
        matchCount,
        matchedKeywords,
        timestamp: page.timestamp || now
      });
    }

    let finalResults = scoredList;
    if (keywords.length >= 4) {
      const higherMatches = scoredList.filter((item) => item.matchCount >= 2);
      if (higherMatches.length > 0) {
        finalResults = higherMatches;
      }
    }

    finalResults.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    currentSearchResults = finalResults.map((item) => item.page);
    renderResults(finalResults, keywords, rawQuery);
  }

  function showLoadingState() {
    initialState.classList.add("hidden");
    emptyState.classList.add("hidden");
    resultsList.classList.add("hidden");
    resultsMeta.classList.add("hidden");
    loadingState.classList.remove("hidden");
  }

  function renderInitialView() {
    resultsList.innerHTML = "";
    resultsList.classList.add("hidden");
    resultsMeta.classList.add("hidden");
    emptyState.classList.add("hidden");
    loadingState.classList.add("hidden");
    initialState.classList.remove("hidden");
    currentSearchResults = [];
    selectedResultIndex = -1;
  }

  function renderResults(scoredResults, searchKeywords, originalQuery) {
    loadingState.classList.add("hidden");
    initialState.classList.add("hidden");

    if (scoredResults.length === 0) {
      resultsList.innerHTML = "";
      resultsList.classList.add("hidden");
      resultsMeta.classList.add("hidden");

      const emptyTitle = emptyState.querySelector("h3");
      const emptyDesc = emptyState.querySelector("p");
      if (emptyTitle) {
        emptyTitle.textContent = `No pages found for "${originalQuery}"`;
      }
      if (emptyDesc) {
        emptyDesc.textContent = "Try searching with different keywords or browse pages with the extension active.";
      }
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    resultsList.classList.remove("hidden");
    resultsMeta.classList.remove("hidden");
    resultsCount.textContent = `${scoredResults.length} matching page${scoredResults.length === 1 ? "" : "s"}`;

    const fragment = document.createDocumentFragment();

    scoredResults.forEach((item, index) => {
      const page = item.page;
      const highlightWords = item.matchedKeywords && item.matchedKeywords.length > 0 ? item.matchedKeywords : searchKeywords;
      const li = document.createElement("li");
      li.className = "result-item";
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "0");
      li.dataset.index = index;
      li.dataset.url = page.url;

      const snippet = extractSnippetAroundKeywords(page.text, highlightWords);
      const highlightedTitle = highlightMultipleTokens(page.title || page.url, highlightWords);
      const highlightedSnippet = highlightMultipleTokens(snippet, highlightWords);
      const relativeTime = formatRelativeTime(page.timestamp);

      li.innerHTML = `
        <div class="result-header">
          <span class="result-title">${highlightedTitle}</span>
        </div>
        <div class="result-meta-row">
          <span class="domain-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            ${escapeHTML(page.domain || "web")}
          </span>
          <span class="time-badge">${relativeTime}</span>
        </div>
        ${snippet ? `<div class="result-snippet">${highlightedSnippet}</div>` : ""}
      `;

      li.addEventListener("click", () => openPageResult(page.url));
      fragment.appendChild(li);
    });

    resultsList.innerHTML = "";
    resultsList.appendChild(fragment);
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function highlightMultipleTokens(text, tokens) {
    if (!text) return "";
    if (!tokens || tokens.length === 0) return escapeHTML(text);
    const escaped = escapeHTML(text);
    const validTokens = tokens.map((t) => t.trim()).filter((t) => t.length > 0);
    if (validTokens.length === 0) return escaped;

    const regexPattern = `\\b(${validTokens.map(escapeRegExp).join("|")})`;
    const regex = new RegExp(regexPattern, "gi");
    return escaped.replace(regex, '<mark class="hl">$1</mark>');
  }

  function extractSnippetAroundKeywords(fullText, keywords) {
    if (!fullText) return "";
    const lower = fullText.toLowerCase();
    let bestIndex = -1;

    for (const kw of keywords) {
      if (!kw) continue;
      const idx = lower.indexOf(kw);
      if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
        bestIndex = idx;
      }
    }

    if (bestIndex === -1) {
      return fullText.slice(0, 160).trim() + (fullText.length > 160 ? "..." : "");
    }

    const start = Math.max(0, bestIndex - 40);
    const end = Math.min(fullText.length, bestIndex + 140);
    let snippet = fullText.slice(start, end).trim();

    if (start > 0) snippet = "..." + snippet;
    if (end < fullText.length) snippet = snippet + "...";

    return snippet;
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

    if (elapsedSeconds < 60) return "Just now";
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  async function openPageResult(targetUrl) {
    if (!targetUrl) return;
    try {
      const allTabs = await chrome.tabs.query({});
      const targetNorm = targetUrl.split("#")[0].replace(/\/$/, "").toLowerCase();

      const existingTab = allTabs.find((t) => {
        if (!t.url) return false;
        const uNorm = t.url.split("#")[0].replace(/\/$/, "").toLowerCase();
        return uNorm === targetNorm || t.url === targetUrl;
      });

      if (existingTab) {
        await chrome.tabs.update(existingTab.id, { active: true });
        if (existingTab.windowId) {
          await chrome.windows.update(existingTab.windowId, { focused: true });
        }
        showStatusBanner(`Focused existing tab: "${existingTab.title || targetUrl}"`, "success");
      } else {
        await chrome.tabs.create({ url: targetUrl, active: true });
        showStatusBanner("Opened page in new tab.", "success");
      }
    } catch (err) {
      console.warn("[Recall Sidepanel] Error opening result:", err);
      window.open(targetUrl, "_blank");
    }
  }

  function updateSelectedResult(newIndex) {
    const items = resultsList.querySelectorAll(".result-item");
    if (items.length === 0) return;

    items.forEach((item) => item.classList.remove("selected"));

    if (newIndex >= 0 && newIndex < items.length) {
      selectedResultIndex = newIndex;
      const target = items[selectedResultIndex];
      target.classList.add("selected");
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      selectedResultIndex = -1;
    }
  }

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      isListening = true;
      if (micBtn) micBtn.classList.add("listening");
      if (commandInput) commandInput.placeholder = "Listening... Speak your command or search";
    };

    recognition.onresult = async (event) => {
      if (!event.results || !event.results[0] || !event.results[0][0]) return;
      const transcript = event.results[0][0].transcript;
      commandInput.value = transcript;
      clearBtn.classList.remove("hidden");

      const isCommand = await handleTabCommands(transcript);
      if (!isCommand) {
        executeSearch(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.warn("[Recall Sidepanel] Speech recognition error:", event.error);
      stopListening();
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        showStatusBanner("Microphone permission blocked. Click the mic icon and allow access.", "error");
      } else if (event.error !== "no-speech") {
        showStatusBanner("Voice error: " + (event.error || "mic unavailable"), "error");
      }
    };

    recognition.onend = () => {
      stopListening();
    };

    return recognition;
  }

  async function toggleListening() {
    if (isListening) {
      if (recognition) recognition.stop();
      stopListening();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showStatusBanner("Voice recognition is not supported in this browser.", "error");
      return;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (err) {
      console.warn("[Recall Voice] getUserMedia error:", err);
      showStatusBanner("Microphone permission blocked. Click the mic icon and allow access.", "error");
      stopListening();
      return;
    }

    try {
      if (!recognition) {
        initSpeechRecognition();
      }
      recognition.start();
    } catch (err) {
      console.warn("[Recall Voice] start error:", err);
      showStatusBanner("Microphone permission blocked. Click the mic icon and allow access.", "error");
      stopListening();
    }
  }

  function stopListening() {
    isListening = false;
    if (micBtn) micBtn.classList.remove("listening");
    if (commandInput) {
      commandInput.placeholder = "What did you read? Or type a tab command...";
    }
  }

  function clearCommandInput() {
    commandInput.value = "";
    clearBtn.classList.add("hidden");
    renderInitialView();
    focusCommandInput();
  }

  function setupEventListeners() {
    commandInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (val.length > 0) {
        clearBtn.classList.remove("hidden");
      } else {
        clearBtn.classList.add("hidden");
        renderInitialView();
      }
    });

    if (searchIcon) {
      searchIcon.style.cursor = "pointer";
      searchIcon.addEventListener("click", async () => {
        const val = commandInput.value.trim();
        if (!val) return;
        const wasCommand = await handleTabCommands(val);
        if (!wasCommand) {
          executeSearch(val);
        }
      });
    }

    commandInput.addEventListener("keydown", async (e) => {
      const items = resultsList.querySelectorAll(".result-item");

      if (e.key === "Enter") {
        e.preventDefault();
        const query = commandInput.value.trim();
        if (!query) return;

        const wasCommand = await handleTabCommands(query);
        if (wasCommand) {
          return;
        }

        if (selectedResultIndex >= 0 && currentSearchResults[selectedResultIndex]) {
          openPageResult(currentSearchResults[selectedResultIndex].url);
        } else {
          executeSearch(query);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (items.length > 0) {
          const nextIndex = selectedResultIndex < items.length - 1 ? selectedResultIndex + 1 : 0;
          updateSelectedResult(nextIndex);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (items.length > 0) {
          const prevIndex = selectedResultIndex > 0 ? selectedResultIndex - 1 : items.length - 1;
          updateSelectedResult(prevIndex);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearCommandInput();
      }
    });

    clearBtn.addEventListener("click", () => {
      clearCommandInput();
    });

    if (micBtn) {
      micBtn.addEventListener("click", () => {
        toggleListening();
      });
    }

    chipButtons.forEach((chip) => {
      chip.addEventListener("click", async () => {
        const cmd = chip.dataset.command;
        if (cmd) {
          commandInput.value = cmd;
          clearBtn.classList.remove("hidden");
          const handled = await handleTabCommands(cmd);
          if (!handled) {
            executeSearch(cmd);
          }
        }
      });
    });

    if (clearMemoryBtn) {
      clearMemoryBtn.addEventListener("click", async () => {
        const confirmed = window.confirm("Are you sure you want to clear all stored page memory? This action cannot be undone.");
        if (!confirmed) return;

        chrome.storage.local.set({ pages: [] }, () => {
          pagesMemory = [];
          updateStorageCountBadge(true);
          renderInitialView();
          showStatusBanner("All browser memory wiped.", "info");
        });
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        clearCommandInput();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
