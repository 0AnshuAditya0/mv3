/**
 * Recall Voice Browser Memory - Side Panel Controller
 * Handles local on-device searching, voice input, tab automation commands, and keyboard navigation.
 */

(() => {
  // --- DOM Elements ---
  const commandInput = document.getElementById("command-input");
  const clearBtn = document.getElementById("clear-btn");
  const micBtn = document.getElementById("mic-btn");
  const storageCountBadge = document.getElementById("storage-count-badge");
  const resultsList = document.getElementById("results-list");
  const resultsMeta = document.getElementById("results-meta");
  const resultsCount = document.getElementById("results-count");
  const statusBanner = document.getElementById("status-banner");
  const bannerText = document.getElementById("banner-text");
  const initialState = document.getElementById("initial-state");
  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");
  const chipButtons = document.querySelectorAll(".chip");

  // --- State Variables ---
  let pagesMemory = [];
  let currentSearchResults = [];
  let selectedResultIndex = -1;
  let recognition = null;
  let isListening = false;
  let bannerTimeout = null;

  // ==========================================================================
  // Initialization & Memory Sync
  // ==========================================================================

  async function init() {
    setupSpeechRecognition();
    setupEventListeners();
    await loadPagesFromStorage();

    // Auto-focus the command input immediately on open
    setTimeout(() => {
      commandInput.focus();
    }, 50);

    // Watch for realtime storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.pages) {
        pagesMemory = changes.pages.newValue || [];
        updateStorageCountBadge();
        if (commandInput.value.trim().length > 0) {
          executeSearch(commandInput.value.trim());
        }
      }
    });
  }

  /**
   * Load stored pages from chrome.storage.local into in-memory array
   */
  async function loadPagesFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ pages: [] }, (data) => {
        pagesMemory = Array.isArray(data.pages) ? data.pages : [];
        updateStorageCountBadge();
        resolve(pagesMemory);
      });
    });
  }

  function updateStorageCountBadge() {
    const count = pagesMemory.length;
    storageCountBadge.textContent = `${count} page${count === 1 ? "" : "s"}`;
  }

  // ==========================================================================
  // Tab Control Automation Commands
  // ==========================================================================

  /**
   * Evaluates if text matches a Tab Control command.
   * If yes, executes it and returns true. Otherwise returns false.
   */
  async function handleTabCommands(rawText) {
    const text = rawText.toLowerCase().trim().replace(/[?!.]+$/, "");

    // 1. Close duplicates
    if (
      text === "close duplicates" ||
      text === "close duplicate tabs" ||
      text === "remove duplicate tabs" ||
      text === "remove duplicates" ||
      text === "dedupe tabs"
    ) {
      await executeCloseDuplicates();
      return true;
    }

    // 2. Close other tabs / close all except this one
    if (
      text === "close other tabs" ||
      text === "close others" ||
      text === "close all except this one" ||
      text === "close all except this" ||
      text === "close every tab except this one"
    ) {
      await executeCloseOtherTabs();
      return true;
    }

    // 3. Tab count: "how many tabs"
    if (
      text === "how many tabs" ||
      text === "how many tabs do i have" ||
      text === "count tabs" ||
      text === "tab count" ||
      text === "number of tabs"
    ) {
      await executeCountTabs();
      return true;
    }

    // 4. Group tabs by domain
    if (
      text === "group tabs by domain" ||
      text === "group tabs" ||
      text === "group by domain" ||
      text === "auto group tabs"
    ) {
      await executeGroupTabsByDomain();
      return true;
    }

    // 5. Close tabs matching domain/keyword:
    // e.g. "close all youtube tabs", "close tabs matching reddit", "close tabs from github.com"
    const closeDomainMatch = text.match(
      /^(?:close all|close tabs matching|close tabs from|close)\s+([a-z0-9.-]+)\s*(?:tabs)?$/i
    );
    if (closeDomainMatch && closeDomainMatch[1]) {
      const targetQuery = closeDomainMatch[1].trim();
      // Guard against false positives like "close other" or "close duplicate"
      if (!["other", "duplicate", "all"].includes(targetQuery)) {
        await executeCloseDomainTabs(targetQuery);
        return true;
      }
    }

    // 6. Find and focus tab:
    // e.g. "find tab pricing", "find tab github", "find pricing tab", "switch to tab slack"
    const findTabMatch = text.match(
      /^(?:find tab|focus tab|switch to tab|go to tab|find)\s+(.+?)(?:\s+tab)?$/i
    );
    if (findTabMatch && findTabMatch[1]) {
      const keyword = findTabMatch[1].trim();
      // Only treat as find-tab command if user explicitly began with find/focus/switch
      if (/^(?:find tab|focus tab|switch to tab|go to tab)/i.test(text)) {
        await executeFindTab(keyword);
        return true;
      }
    }

    return false;
  }

  /**
   * Closes duplicate tabs, keeping only one tab per unique URL
   */
  async function executeCloseDuplicates() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const seenUrls = new Set();
      const duplicateTabIds = [];

      tabs.forEach((tab) => {
        // Normalize URL without trailing slash or hash
        const cleanUrl = (tab.url || "").split("#")[0].replace(/\/$/, "");
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
      showStatusBanner(`Error closing duplicates: ${err.message}`, "error");
    }
  }

  /**
   * Closes all other tabs except the currently active tab
   */
  async function executeCloseOtherTabs() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        showStatusBanner("Could not identify active tab.", "error");
        return;
      }

      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const tabsToClose = allTabs.filter((t) => t.id !== activeTab.id).map((t) => t.id);

      if (tabsToClose.length === 0) {
        showStatusBanner("No other tabs to close.", "info");
      } else {
        await chrome.tabs.remove(tabsToClose);
        showStatusBanner(`Closed ${tabsToClose.length} other tab${tabsToClose.length === 1 ? "" : "s"}. Kept current tab open.`, "success");
      }
    } catch (err) {
      showStatusBanner(`Error closing other tabs: ${err.message}`, "error");
    }
  }

  /**
   * Displays tab count across windows
   */
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
      showStatusBanner(`Error counting tabs: ${err.message}`, "error");
    }
  }

  /**
   * Groups tabs by domain name
   */
  async function executeGroupTabsByDomain() {
    try {
      if (!chrome.tabs.group) {
        showStatusBanner("Tab grouping is not supported in this browser version.", "error");
        return;
      }

      const tabs = await chrome.tabs.query({ currentWindow: true });
      const domainMap = new Map();

      tabs.forEach((tab) => {
        if (!tab.url || tab.url.startsWith("chrome://")) return;
        try {
          const urlObj = new URL(tab.url);
          const domain = urlObj.hostname.replace(/^www\./i, "");
          if (!domainMap.has(domain)) {
            domainMap.set(domain, []);
          }
          domainMap.get(domain).push(tab.id);
        } catch (e) {
          // Skip invalid URLs
        }
      });

      let groupsCreated = 0;
      const groupColors = ["blue", "purple", "cyan", "green", "yellow", "orange", "pink", "grey"];
      let colorIdx = 0;

      for (const [domain, tabIds] of domainMap.entries()) {
        if (tabIds.length > 1) {
          const groupId = await chrome.tabs.group({ tabIds: tabIds });
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
        showStatusBanner("No domain with multiple tabs to group.", "info");
      } else {
        showStatusBanner(`Grouped tabs into ${groupsCreated} domain group${groupsCreated === 1 ? "" : "s"}.`, "success");
      }
    } catch (err) {
      showStatusBanner(`Error grouping tabs: ${err.message}`, "error");
    }
  }

  /**
   * Closes tabs matching domain or keyword
   */
  async function executeCloseDomainTabs(keyword) {
    try {
      const lowerKeyword = keyword.toLowerCase();
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const toClose = [];

      tabs.forEach((tab) => {
        const titleMatch = (tab.title || "").toLowerCase().includes(lowerKeyword);
        const urlMatch = (tab.url || "").toLowerCase().includes(lowerKeyword);
        if (titleMatch || urlMatch) {
          toClose.push(tab.id);
        }
      });

      if (toClose.length === 0) {
        showStatusBanner(`No open tabs found matching "${keyword}".`, "info");
      } else {
        await chrome.tabs.remove(toClose);
        showStatusBanner(`Closed ${toClose.length} tab${toClose.length === 1 ? "" : "s"} matching "${keyword}".`, "success");
      }
    } catch (err) {
      showStatusBanner(`Error closing tabs: ${err.message}`, "error");
    }
  }

  /**
   * Finds and activates a tab matching title or URL keyword
   */
  async function executeFindTab(keyword) {
    try {
      const lowerKeyword = keyword.toLowerCase();
      const allTabs = await chrome.tabs.query({});
      let bestMatch = null;

      for (const tab of allTabs) {
        const titleLower = (tab.title || "").toLowerCase();
        const urlLower = (tab.url || "").toLowerCase();

        if (titleLower.includes(lowerKeyword)) {
          bestMatch = tab;
          break;
        } else if (urlLower.includes(lowerKeyword) && !bestMatch) {
          bestMatch = tab;
        }
      }

      if (bestMatch) {
        await chrome.tabs.update(bestMatch.id, { active: true });
        if (bestMatch.windowId) {
          await chrome.windows.update(bestMatch.windowId, { focused: true });
        }
        showStatusBanner(`Switched to: "${bestMatch.title || bestMatch.url}"`, "success");
      } else {
        showStatusBanner(`No open tab found matching "${keyword}".`, "info");
      }
    } catch (err) {
      showStatusBanner(`Error switching tab: ${err.message}`, "error");
    }
  }

  // ==========================================================================
  // Search Engine & Ranking Algorithm
  // ==========================================================================

  /**
   * Fast in-memory keyword search over stored pages with multi-factor scoring
   * - Title match weight (15x)
   * - Exact phrase match weight (25x)
   * - Word token match frequency & density
   * - Recency boost (logarithmic boost favoring recent days)
   */
  function executeSearch(query) {
    selectedResultIndex = -1;
    const trimmed = query.trim();

    if (!trimmed) {
      renderInitialView();
      return;
    }

    const lowerQuery = trimmed.toLowerCase();
    const queryTokens = lowerQuery.split(/\s+/).filter((t) => t.length > 0);
    const now = Date.now();

    const scoredResults = [];

    for (let i = 0; i < pagesMemory.length; i++) {
      const page = pagesMemory[i];
      const titleLower = (page.title || "").toLowerCase();
      const textLower = (page.text || "").toLowerCase();
      const domainLower = (page.domain || "").toLowerCase();

      let score = 0;
      let matchedTokensCount = 0;

      // 1. Exact phrase match bonus
      if (titleLower.includes(lowerQuery)) {
        score += 50;
      }
      if (textLower.includes(lowerQuery)) {
        score += 25;
      }

      // 2. Token matches across Title, Domain, and Body
      queryTokens.forEach((token) => {
        let tokenFound = false;

        // Title token match (High weight)
        if (titleLower.includes(token)) {
          score += 15;
          tokenFound = true;
        }

        // Domain match
        if (domainLower.includes(token)) {
          score += 10;
          tokenFound = true;
        }

        // Text body token occurrences
        if (textLower.includes(token)) {
          score += 4;
          tokenFound = true;
          // Count occurrences up to a reasonable cap
          const occurrences = (textLower.match(new RegExp(escapeRegExp(token), "g")) || []).length;
          score += Math.min(occurrences, 6);
        }

        if (tokenFound) {
          matchedTokensCount++;
        }
      });

      // Require at least one token match
      if (matchedTokensCount === 0 && score === 0) {
        continue;
      }

      // Proportional bonus for matching all query words
      if (matchedTokensCount === queryTokens.length) {
        score += 20;
      }

      // 3. Recency boost (Newer pages rank slightly higher)
      // Pages viewed within last 24h get up to +10, last 7 days get up to +5
      const ageHours = (now - (page.timestamp || now)) / (1000 * 60 * 60);
      if (ageHours < 24) {
        score += 10 - (ageHours / 24) * 5;
      } else if (ageHours < 168) {
        score += 5 - (ageHours / 168) * 3;
      }

      scoredResults.push({
        page,
        score,
        matchedTokens: queryTokens
      });
    }

    // Sort descending by score
    scoredResults.sort((a, b) => b.score - a.score);

    currentSearchResults = scoredResults.map((item) => item.page);
    renderResults(scoredResults, queryTokens);
  }

  /**
   * Helper to escape special characters in regex
   */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Highlights matched tokens in a string
   */
  function highlightText(text, tokens) {
    if (!text || !tokens || tokens.length === 0) return escapeHTML(text || "");
    const escaped = escapeHTML(text);
    const regexPattern = `(${tokens.map(escapeRegExp).join("|")})`;
    const regex = new RegExp(regexPattern, "gi");
    return escaped.replace(regex, '<mark class="hl">$1</mark>');
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Extracts a short snippet around the first matched search token
   */
  function extractBestSnippet(fullText, tokens) {
    if (!fullText) return "";
    const lower = fullText.toLowerCase();
    let bestIndex = -1;

    for (const token of tokens) {
      const idx = lower.indexOf(token);
      if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
        bestIndex = idx;
      }
    }

    if (bestIndex === -1) {
      return fullText.slice(0, 180).trim() + "...";
    }

    const start = Math.max(0, bestIndex - 40);
    const end = Math.min(fullText.length, bestIndex + 140);
    let snippet = fullText.slice(start, end).trim();

    if (start > 0) snippet = "..." + snippet;
    if (end < fullText.length) snippet = snippet + "...";

    return snippet;
  }

  /**
   * Human relative time (e.g. "Just now", "4m ago", "2h ago", "Yesterday", "3d ago")
   */
  function formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    const elapsedSeconds = Math.floor((Date.now() - timestamp) / 1000);

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

  // ==========================================================================
  // Render & UI State Management
  // ==========================================================================

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

  function renderResults(results, queryTokens) {
    initialState.classList.add("hidden");
    loadingState.classList.add("hidden");

    if (results.length === 0) {
      resultsList.innerHTML = "";
      resultsList.classList.add("hidden");
      resultsMeta.classList.add("hidden");
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    resultsList.classList.remove("hidden");
    resultsMeta.classList.remove("hidden");
    resultsCount.textContent = `${results.length} matching page${results.length === 1 ? "" : "s"}`;

    const fragment = document.createDocumentFragment();

    results.forEach((item, index) => {
      const page = item.page;
      const li = document.createElement("li");
      li.className = "result-item";
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "0");
      li.dataset.index = index;
      li.dataset.url = page.url;

      const snippet = extractBestSnippet(page.text, queryTokens);
      const highlightedTitle = highlightText(page.title || page.url, queryTokens);
      const highlightedSnippet = highlightText(snippet, queryTokens);
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
            ${escapeHTML(page.domain || "page")}
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

  /**
   * Opens page in existing tab if already open, or creates a new tab
   */
  async function openPageResult(targetUrl) {
    if (!targetUrl) return;
    try {
      const tabs = await chrome.tabs.query({});
      const existingTab = tabs.find((t) => t.url === targetUrl);

      if (existingTab) {
        await chrome.tabs.update(existingTab.id, { active: true });
        if (existingTab.windowId) {
          await chrome.windows.update(existingTab.windowId, { focused: true });
        }
      } else {
        await chrome.tabs.create({ url: targetUrl, active: true });
      }
    } catch (err) {
      console.warn("[Recall] Error opening result:", err);
      window.open(targetUrl, "_blank");
    }
  }

  /**
   * Displays temporary feedback notification banner
   */
  function showStatusBanner(message, type = "success") {
    if (bannerTimeout) clearTimeout(bannerTimeout);

    bannerText.textContent = message;
    statusBanner.className = `status-banner banner-${type}`;
    statusBanner.classList.remove("hidden");

    bannerTimeout = setTimeout(() => {
      statusBanner.classList.add("hidden");
    }, 4000);
  }

  // ==========================================================================
  // Web Speech API - Voice Dictation
  // ==========================================================================

  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.style.display = "none";
      console.log("[Recall] Web Speech API not supported in this environment.");
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add("listening");
      commandInput.placeholder = "Listening... Speak your command or search";
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      commandInput.value = transcript;
      clearBtn.classList.remove("hidden");

      // Check if user spoke a tab control command
      const isCommand = await handleTabCommands(transcript);
      if (!isCommand) {
        executeSearch(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.warn("[Recall] Speech recognition error:", event.error);
      stopListening();
      showStatusBanner("Voice error: " + (event.error || "mic unavailable"), "error");
    };

    recognition.onend = () => {
      stopListening();
    };
  }

  function toggleListening() {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      stopListening();
    } else {
      try {
        recognition.start();
      } catch (e) {
        console.warn("[Recall] Speech start failed:", e);
      }
    }
  }

  function stopListening() {
    isListening = false;
    micBtn.classList.remove("listening");
    commandInput.placeholder = "What did you read? Or type a tab command...";
  }

  // ==========================================================================
  // Keyboard Navigation & Events
  // ==========================================================================

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

  function setupEventListeners() {
    // Input typing & dynamic search
    commandInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (val.length > 0) {
        clearBtn.classList.remove("hidden");
        executeSearch(val);
      } else {
        clearBtn.classList.add("hidden");
        renderInitialView();
      }
    });

    // Enter & Arrow keys
    commandInput.addEventListener("keydown", async (e) => {
      const items = resultsList.querySelectorAll(".result-item");

      if (e.key === "Enter") {
        e.preventDefault();
        const query = commandInput.value.trim();
        if (!query) return;

        // First test if it's a tab automation command
        const wasCommand = await handleTabCommands(query);
        if (wasCommand) {
          return;
        }

        // Otherwise open the selected search result or the top result
        if (selectedResultIndex >= 0 && currentSearchResults[selectedResultIndex]) {
          openPageResult(currentSearchResults[selectedResultIndex].url);
        } else if (currentSearchResults.length > 0) {
          openPageResult(currentSearchResults[0].url);
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
        commandInput.value = "";
        clearBtn.classList.add("hidden");
        renderInitialView();
      }
    });

    // Clear button
    clearBtn.addEventListener("click", () => {
      commandInput.value = "";
      clearBtn.classList.add("hidden");
      renderInitialView();
      commandInput.focus();
    });

    // Voice button
    micBtn.addEventListener("click", () => {
      toggleListening();
    });

    // Quick Command Chips
    chipButtons.forEach((chip) => {
      chip.addEventListener("click", async () => {
        const cmd = chip.dataset.command;
        if (cmd) {
          commandInput.value = cmd;
          clearBtn.classList.remove("hidden");
          await handleTabCommands(cmd);
        }
      });
    });

    // Global keyboard shortcut: Escape to clear
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.activeElement !== commandInput) {
        commandInput.value = "";
        clearBtn.classList.add("hidden");
        renderInitialView();
        commandInput.focus();
      }
    });
  }

  // Run initialization
  document.addEventListener("DOMContentLoaded", init);
})();
