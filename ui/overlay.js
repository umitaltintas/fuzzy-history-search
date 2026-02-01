(() => {
  const OVERLAY_ID = "fhs-overlay";
  const STYLE_ID = "fhs-overlay-style";

  if (document.getElementById(OVERLAY_ID)) {
    const existingInput = document.getElementById("fhs-query");
    if (existingInput) {
      existingInput.focus();
      existingInput.select();
    }
    return;
  }

  const isBrowserApi = typeof browser !== "undefined";
  const ext = isBrowserApi
    ? browser
    : typeof chrome !== "undefined"
      ? chrome
      : null;

  if (!ext || !ext.runtime || !ext.runtime.sendMessage) {
    return;
  }

  const styleText = `
@keyframes fhs-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fhs-scale-in {
  from { opacity: 0; transform: scale(0.97) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes fhs-float-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  font-family: "Iowan Old Style", "Palatino", "Book Antiqua", "Times New Roman", serif;
  color: #1a1a1a;
}
#${OVERLAY_ID} .fhs-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(24, 18, 12, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: fhs-fade-in 200ms ease-out;
}
#${OVERLAY_ID} .fhs-panel {
  position: relative;
  width: min(820px, 92vw);
  max-height: min(680px, 86vh);
  background: #fbf7f0;
  border-radius: 20px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 8px 20px rgba(0, 0, 0, 0.08),
    0 30px 60px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px 18px;
  overflow: hidden;
  animation: fhs-scale-in 250ms cubic-bezier(0.16, 1, 0.3, 1);
}
#${OVERLAY_ID} .fhs-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
#${OVERLAY_ID} .fhs-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
#${OVERLAY_ID} .fhs-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8a7e72;
}
#${OVERLAY_ID} .fhs-hint kbd {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 6px;
  background: #ede7dc;
  border: 1px solid #d8d0c4;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  color: #5a5048;
  box-shadow: 0 1px 0 #cec5b8;
  line-height: 1.4;
}
#${OVERLAY_ID} .fhs-search {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border-radius: 14px;
  padding: 10px 14px;
  border: 1.5px solid rgba(26, 26, 26, 0.1);
  box-shadow: 0 4px 12px rgba(20, 12, 7, 0.06);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
#${OVERLAY_ID} .fhs-search:focus-within {
  border-color: rgba(241, 90, 66, 0.45);
  box-shadow: 0 4px 12px rgba(20, 12, 7, 0.06), 0 0 0 3px rgba(241, 90, 66, 0.08);
}
#${OVERLAY_ID} .fhs-search-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: #a89e92;
}
#${OVERLAY_ID} .fhs-search input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 16px;
  color: #1a1a1a;
  outline: none;
  font-family: inherit;
}
#${OVERLAY_ID} .fhs-search input::placeholder {
  color: #b0a698;
}
#${OVERLAY_ID} .fhs-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  padding-right: 4px;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
}
#${OVERLAY_ID} .fhs-results::-webkit-scrollbar {
  width: 6px;
}
#${OVERLAY_ID} .fhs-results::-webkit-scrollbar-track {
  background: transparent;
}
#${OVERLAY_ID} .fhs-results::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 3px;
}
#${OVERLAY_ID} .fhs-results::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.22);
}
#${OVERLAY_ID} .fhs-result {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.65);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
  appearance: none;
  transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
  animation: fhs-float-in 180ms ease-out both;
  animation-delay: var(--fhs-delay, 0ms);
}
#${OVERLAY_ID} .fhs-result:hover {
  transform: translateY(-1px);
  border-color: rgba(241, 90, 66, 0.25);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6px 16px rgba(241, 90, 66, 0.1);
}
#${OVERLAY_ID} .fhs-result.fhs-selected {
  border-color: rgba(241, 90, 66, 0.55);
  background: #fff;
  box-shadow: 0 8px 20px rgba(241, 90, 66, 0.18);
}
#${OVERLAY_ID} .fhs-result:focus {
  outline: none;
}
#${OVERLAY_ID} .fhs-favicon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  object-fit: contain;
}
#${OVERLAY_ID} .fhs-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
#${OVERLAY_ID} .fhs-title-text {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#${OVERLAY_ID} .fhs-url {
  font-size: 12px;
  color: #8a7e72;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#${OVERLAY_ID} .fhs-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-end;
  font-size: 11px;
  color: #8a7e72;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  white-space: nowrap;
}
#${OVERLAY_ID} .fhs-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(241, 90, 66, 0.1);
  color: #c43d2a;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
#${OVERLAY_ID} .fhs-empty {
  display: none;
  font-size: 14px;
  color: #8a7e72;
  text-align: center;
  padding: 32px 0;
}
#${OVERLAY_ID} .fhs-empty.fhs-visible {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
#${OVERLAY_ID} .fhs-footer {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #8a7e72;
}
#${OVERLAY_ID} .fhs-footer kbd {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 5px;
  background: #ede7dc;
  border: 1px solid #d8d0c4;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  color: #5a5048;
  box-shadow: 0 1px 0 #cec5b8;
  line-height: 1.4;
}
#${OVERLAY_ID} .fhs-footer-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
@media (max-width: 680px) {
  #${OVERLAY_ID} .fhs-panel {
    width: min(92vw, 520px);
    padding: 16px;
  }
  #${OVERLAY_ID} .fhs-result {
    grid-template-columns: auto 1fr;
  }
  #${OVERLAY_ID} .fhs-meta {
    display: none;
  }
  #${OVERLAY_ID} .fhs-footer {
    gap: 8px;
  }
}
`;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = styleText;
    document.head.appendChild(style);
  }

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const backdrop = document.createElement("div");
  backdrop.className = "fhs-backdrop";

  const panel = document.createElement("div");
  panel.className = "fhs-panel";

  const top = document.createElement("div");
  top.className = "fhs-top";

  const title = document.createElement("div");
  title.className = "fhs-title";
  title.textContent = "Fuzzy History Search";

  const hint = document.createElement("div");
  hint.className = "fhs-hint";
  hint.innerHTML = "<kbd>Esc</kbd> to close";

  top.appendChild(title);
  top.appendChild(hint);

  const search = document.createElement("div");
  search.className = "fhs-search";

  const searchIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  searchIcon.setAttribute("class", "fhs-search-icon");
  searchIcon.setAttribute("viewBox", "0 0 20 20");
  searchIcon.setAttribute("fill", "none");
  searchIcon.setAttribute("stroke", "currentColor");
  searchIcon.setAttribute("stroke-width", "2");
  searchIcon.setAttribute("stroke-linecap", "round");
  searchIcon.innerHTML =
    '<circle cx="8.5" cy="8.5" r="5.5"/><line x1="13" y1="13" x2="17" y2="17"/>';

  const input = document.createElement("input");
  input.id = "fhs-query";
  input.type = "text";
  input.placeholder = "Search history...";
  input.autocomplete = "off";
  input.spellcheck = false;

  search.appendChild(searchIcon);
  search.appendChild(input);

  const results = document.createElement("div");
  results.id = "fhs-results";
  results.className = "fhs-results";
  results.setAttribute("role", "listbox");

  const empty = document.createElement("div");
  empty.className = "fhs-empty";
  empty.innerHTML = '<div style="font-size:28px;opacity:0.35">&#x1F50D;</div>No results found';

  const footer = document.createElement("div");
  footer.className = "fhs-footer";
  footer.innerHTML =
    '<span class="fhs-footer-item"><kbd>Enter</kbd> open</span>' +
    '<span class="fhs-footer-item"><kbd>Cmd+Enter</kbd> new tab</span>' +
    '<span class="fhs-footer-item"><kbd>Shift+Enter</kbd> background</span>' +
    '<span class="fhs-footer-item"><kbd>Esc</kbd> close</span>';

  panel.appendChild(top);
  panel.appendChild(search);
  panel.appendChild(results);
  panel.appendChild(empty);
  panel.appendChild(footer);

  overlay.appendChild(backdrop);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const previousActive = document.activeElement;
  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  const UI_LIMIT = 40;
  let items = [];
  let elements = [];
  let selectedIndex = -1;
  let debounceTimer = null;
  let closed = false;

  function sendMessage(message) {
    if (isBrowserApi) {
      return ext.runtime.sendMessage(message);
    }
    return new Promise((resolve) => {
      ext.runtime.sendMessage(message, resolve);
    });
  }

  function getFaviconUrl(url) {
    if (!url) return "";
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
      url,
    )}`;
  }

  function formatHost(url) {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return "unknown";
    const diff = Date.now() - timestamp;
    const minute = 60000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    if (diff < minute) return "just now";
    if (diff < hour) return `${Math.round(diff / minute)}m`;
    if (diff < day) return `${Math.round(diff / hour)}h`;
    if (diff < week) return `${Math.round(diff / day)}d`;
    return `${Math.round(diff / week)}w`;
  }

  function updateSelection(index) {
    if (!elements.length) {
      selectedIndex = -1;
      return;
    }
    const clamped = Math.min(Math.max(index, 0), elements.length - 1);
    selectedIndex = clamped;
    elements.forEach((el, idx) => {
      if (idx === selectedIndex) {
        el.classList.add("fhs-selected");
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.classList.remove("fhs-selected");
      }
    });
  }

  function renderResults() {
    results.textContent = "";
    elements = [];

    if (!items.length) {
      empty.classList.add("fhs-visible");
      selectedIndex = -1;
      return;
    }

    empty.classList.remove("fhs-visible");

    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fhs-result";
      button.style.setProperty("--fhs-delay", `${index * 25}ms`);
      button.dataset.index = String(index);

      const favicon = document.createElement("img");
      favicon.className = "fhs-favicon";
      favicon.alt = "";
      favicon.loading = "lazy";
      favicon.referrerPolicy = "no-referrer";
      favicon.src = getFaviconUrl(item.url);
      favicon.onerror = () => {
        favicon.src =
          "data:image/svg+xml;utf8," +
          "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'>" +
          "<rect width='28' height='28' rx='6' fill='%23f3efe6'/>" +
          "<text x='14' y='18' font-size='12' text-anchor='middle' fill='%236e6258' font-family='sans-serif'>" +
          "?</text></svg>";
      };

      const main = document.createElement("div");
      main.className = "fhs-main";

      const titleText = document.createElement("div");
      titleText.className = "fhs-title-text";
      titleText.textContent = item.title || item.url;

      const url = document.createElement("div");
      url.className = "fhs-url";
      url.textContent = formatHost(item.url);

      main.appendChild(titleText);
      main.appendChild(url);

      const meta = document.createElement("div");
      meta.className = "fhs-meta";

      if (item.isActive) {
        const badge = document.createElement("span");
        badge.className = "fhs-badge";
        badge.textContent = "active";
        meta.appendChild(badge);
      }

      const visits = document.createElement("div");
      visits.textContent = `${item.visitCount || 0} visits`;

      const time = document.createElement("div");
      time.textContent = formatTimeAgo(item.lastVisitTime);

      meta.appendChild(visits);
      meta.appendChild(time);

      button.appendChild(favicon);
      button.appendChild(main);
      button.appendChild(meta);

      button.addEventListener("click", () => {
        openEntry(item, "currentTab");
      });

      results.appendChild(button);
      elements.push(button);
    });

    updateSelection(0);
  }

  function openEntry(item, disposition) {
    if (!item || !item.url) return;
    sendMessage({ type: "open", url: item.url, disposition })
      .catch(() => {})
      .finally(() => {
        closeOverlay();
      });
  }

  function requestResults(query) {
    return sendMessage({ type: "search", query, limit: UI_LIMIT })
      .then((response) => response?.results || [])
      .catch(() => []);
  }

  function scheduleSearch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      requestResults(input.value || "").then((resultsData) => {
        items = resultsData;
        renderResults();
      });
    }, 50);
  }

  function handleKeydown(event) {
    if (closed) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      updateSelection(selectedIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      updateSelection(selectedIndex - 1);
      return;
    }
    if (event.key === "Enter") {
      if (selectedIndex < 0 || !items[selectedIndex]) return;
      event.preventDefault();
      event.stopPropagation();
      let disposition = "currentTab";
      if (event.shiftKey) {
        disposition = "newBackgroundTab";
      } else if (event.metaKey || event.ctrlKey) {
        disposition = "newForegroundTab";
      }
      openEntry(items[selectedIndex], disposition);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeOverlay();
    }
  }

  function handleClick(event) {
    if (event.target === backdrop) {
      closeOverlay();
    }
  }

  function closeOverlay() {
    if (closed) return;
    closed = true;
    overlay.remove();
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    document.documentElement.style.overflow = previousOverflow;
    window.removeEventListener("keydown", handleKeydown, true);
    overlay.removeEventListener("click", handleClick);
    if (previousActive && typeof previousActive.focus === "function") {
      previousActive.focus();
    }
  }

  overlay.addEventListener("click", handleClick);
  window.addEventListener("keydown", handleKeydown, true);
  input.addEventListener("input", scheduleSearch);

  requestResults("").then((resultsData) => {
    items = resultsData;
    renderResults();
    input.focus();
    input.select();
  });
})();
