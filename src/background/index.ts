import { ext } from "../shared/browser-api";
import {
  historyCache,
  recentTop,
  historyMap,
  loadHistory,
  handleVisited,
  popupWindowId,
  setPopupWindowId,
} from "./history-cache";
import { setupOmnibox } from "./omnibox";
import { setupMessageHandler } from "./message-handler";
import { openSearchOverlay, openSearchWindow } from "./window-manager";

// Load history on startup
loadHistory().catch(() => {
  historyCache.length = 0;
  recentTop.length = 0;
  historyMap.clear();
});

// Listen for history changes
ext!.history.onVisited.addListener(handleVisited);

// Keyboard shortcut handler
if (ext?.commands) {
  ext.commands.onCommand.addListener((command: string) => {
    if (command === "open-fuzzy-search") {
      openSearchOverlay().then((opened) => {
        if (!opened) {
          openSearchWindow();
        }
      });
    }
  });
}

// Track popup window closure
if (ext?.windows) {
  ext.windows.onRemoved.addListener((windowId: number) => {
    if (windowId === popupWindowId) {
      setPopupWindowId(null);
    }
  });
}

// Setup omnibox and message handlers
setupOmnibox();
setupMessageHandler();
