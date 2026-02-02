import { POPUP_WIDTH, POPUP_HEIGHT } from "../shared/constants";
import { ext, callApi } from "../shared/browser-api";
import {
  popupWindowId,
  openerWindowId,
  setPopupWindowId,
  setOpenerWindowId,
} from "./history-cache";

export async function openSearchWindow(): Promise<void> {
  if (!ext) return;
  if (popupWindowId) {
    try {
      await callApi(ext.windows, "remove", popupWindowId);
    } catch {
      // Ignore if already closed.
    }
    setPopupWindowId(null);
  }

  let openerWindow: chrome.windows.Window | null;
  try {
    openerWindow = await callApi<chrome.windows.Window>(ext.windows, "getLastFocused");
  } catch {
    try {
      openerWindow = await callApi<chrome.windows.Window>(ext.windows, "getCurrent");
    } catch {
      openerWindow = null;
    }
  }

  setOpenerWindowId(openerWindow?.id ?? null);
  const baseLeft = openerWindow?.left ?? 0;
  const baseTop = openerWindow?.top ?? 0;
  const baseWidth = openerWindow?.width ?? POPUP_WIDTH;
  const baseHeight = openerWindow?.height ?? POPUP_HEIGHT;
  const left = Math.round(baseLeft + (baseWidth - POPUP_WIDTH) / 2);
  const top = Math.round(baseTop + (baseHeight - POPUP_HEIGHT) / 2);
  const url =
    ext.runtime.getURL("ui/index.html") +
    (openerWindowId ? `?opener=${openerWindowId}` : "");

  try {
    const popup = await callApi<chrome.windows.Window>(ext.windows, "create", {
      url,
      type: "popup",
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      left,
      top,
      focused: true,
    });
    setPopupWindowId(popup?.id ?? null);
  } catch {
    setPopupWindowId(null);
  }
}

export async function openSearchOverlay(): Promise<boolean> {
  if (!ext?.tabs) return false;
  try {
    const tabs = await callApi<chrome.tabs.Tab[]>(ext.tabs, "query", {
      active: true,
      currentWindow: true,
    });
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return false;
    const tabUrl = tab.url || "";
    if (
      tabUrl.startsWith("about:") ||
      tabUrl.startsWith("moz-extension:") ||
      tabUrl.startsWith("chrome://") ||
      tabUrl.startsWith("chrome-extension:") ||
      tabUrl.startsWith("edge://") ||
      tabUrl.startsWith("view-source:")
    ) {
      return false;
    }

    if (ext.scripting) {
      await callApi(ext.scripting, "executeScript", {
        target: { tabId: tab.id },
        files: ["ui/overlay.js"],
      });
    } else {
      await callApi(ext.tabs, "executeScript", tab.id, {
        file: "ui/overlay.js",
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function openResult(
  url: string,
  disposition: string,
  sourceWindowId: number | null,
): Promise<void> {
  if (!ext || !url) return;
  let targetWindowId = Number.isFinite(sourceWindowId) ? sourceWindowId : openerWindowId;

  if (!Number.isFinite(targetWindowId)) {
    try {
      const fallbackWindow = await callApi<chrome.windows.Window>(
        ext.windows,
        "getLastFocused",
      );
      targetWindowId = fallbackWindow?.id ?? null;
    } catch {
      targetWindowId = null;
    }
  }

  const windowQuery = Number.isFinite(targetWindowId)
    ? { windowId: targetWindowId as number }
    : { currentWindow: true as const };
  const createProps = Number.isFinite(targetWindowId)
    ? { windowId: targetWindowId as number }
    : {};

  try {
    if (disposition === "currentTab") {
      const tabs = await callApi<chrome.tabs.Tab[]>(ext.tabs, "query", {
        active: true,
        ...windowQuery,
      });
      const activeTab = tabs && tabs[0];
      if (activeTab && activeTab.id != null) {
        await callApi(ext.tabs, "update", activeTab.id, { url });
      } else {
        await callApi(ext.tabs, "create", { ...createProps, url });
      }
    } else if (disposition === "newBackgroundTab") {
      await callApi(ext.tabs, "create", { ...createProps, url, active: false });
    } else {
      await callApi(ext.tabs, "create", { ...createProps, url, active: true });
    }
  } finally {
    if (popupWindowId) {
      try {
        await callApi(ext.windows, "remove", popupWindowId);
      } catch {
        // Ignore if already closed.
      }
      setPopupWindowId(null);
    }
  }
}
