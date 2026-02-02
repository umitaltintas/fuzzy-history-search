import { sendMessage, getFaviconUrl, formatHost, formatTimeAgo } from "../../shared/messaging";
import type { SearchResult } from "../../shared/types";

const queryInput = document.getElementById("query") as HTMLInputElement;
const resultsEl = document.getElementById("results")!;
const emptyEl = document.getElementById("empty")!;

const params = new URLSearchParams(window.location.search);
const openerWindowId = Number(params.get("opener"));

const UI_LIMIT = 40;
let items: SearchResult[] = [];
let itemElements: HTMLButtonElement[] = [];
let selectedIndex = -1;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function updateSelection(index: number): void {
  if (!itemElements.length) {
    selectedIndex = -1;
    return;
  }

  const clamped = Math.min(Math.max(index, 0), itemElements.length - 1);
  selectedIndex = clamped;

  itemElements.forEach((el, idx) => {
    if (idx === selectedIndex) {
      el.classList.add("selected");
      el.setAttribute("aria-selected", "true");
      el.scrollIntoView({ block: "nearest" });
    } else {
      el.classList.remove("selected");
      el.setAttribute("aria-selected", "false");
    }
  });
}

function renderResults(): void {
  resultsEl.textContent = "";
  itemElements = [];

  if (!items.length) {
    emptyEl.classList.add("visible");
    selectedIndex = -1;
    return;
  }

  emptyEl.classList.remove("visible");

  items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result";
    button.style.setProperty("--delay", `${index * 20}ms`);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", "false");
    button.dataset.index = String(index);

    const favicon = document.createElement("img");
    favicon.className = "favicon";
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
    main.className = "result-main";

    const title = document.createElement("div");
    title.className = "result-title";
    title.textContent = item.title || item.url;

    const url = document.createElement("div");
    url.className = "result-url";
    url.textContent = formatHost(item.url);

    main.appendChild(title);
    main.appendChild(url);

    const meta = document.createElement("div");
    meta.className = "result-meta";

    if (item.isActive) {
      const badge = document.createElement("span");
      badge.className = "badge";
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

    resultsEl.appendChild(button);
    itemElements.push(button);
  });

  updateSelection(0);
}

function openEntry(item: SearchResult, disposition: string): void {
  if (!item || !item.url) return;
  sendMessage({
    type: "open",
    url: item.url,
    disposition,
    openerWindowId: Number.isFinite(openerWindowId) ? openerWindowId : null,
  })
    .catch(() => {})
    .finally(() => {
      window.close();
    });
}

function closeWindow(): void {
  sendMessage({ type: "close" })
    .catch(() => {})
    .finally(() => {
      window.close();
    });
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    updateSelection(selectedIndex + 1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    updateSelection(selectedIndex - 1);
    return;
  }
  if (event.key === "Enter") {
    if (selectedIndex < 0 || !items[selectedIndex]) return;
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
    closeWindow();
  }
}

function requestResults(query: string): Promise<SearchResult[]> {
  return sendMessage({
    type: "search",
    query,
    limit: UI_LIMIT,
    openerWindowId: Number.isFinite(openerWindowId) ? openerWindowId : null,
  })
    .then((response) => (response as { results: SearchResult[] })?.results || [])
    .catch(() => []);
}

function scheduleSearch(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    const query = queryInput.value || "";
    requestResults(query).then((results) => {
      items = results;
      renderResults();
    });
  }, 50);
}

queryInput.addEventListener("input", scheduleSearch);
window.addEventListener("keydown", handleKeydown);

requestResults("").then((results) => {
  items = results;
  renderResults();
  queryInput.focus();
});
