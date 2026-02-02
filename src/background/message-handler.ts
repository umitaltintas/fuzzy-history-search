import { UI_MAX_RESULTS } from "../shared/constants";
import { ext, callApi } from "../shared/browser-api";
import { popupWindowId, setPopupWindowId } from "./history-cache";
import { getSearchResults } from "./search";
import { openResult } from "./window-manager";

export function setupMessageHandler(): void {
  if (!ext?.runtime) return;

  ext.runtime.onMessage.addListener(
    (
      message: Record<string, unknown>,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const sourceWindowId = Number.isFinite(message.openerWindowId)
        ? (message.openerWindowId as number)
        : sender?.tab?.windowId ?? null;

      if (message.type === "search") {
        const limit = Number.isFinite(message.limit)
          ? (message.limit as number)
          : UI_MAX_RESULTS;
        getSearchResults(message.query as string, limit, sourceWindowId)
          .then((results) => {
            sendResponse({ results });
          })
          .catch(() => {
            sendResponse({ results: [] });
          });
        return true;
      }

      if (message.type === "open") {
        openResult(
          message.url as string,
          message.disposition as string,
          sourceWindowId,
        )
          .then(() => {
            sendResponse({ ok: true });
          })
          .catch(() => {
            sendResponse({ ok: false });
          });
        return true;
      }

      if (message.type === "close") {
        if (popupWindowId) {
          callApi(ext!.windows, "remove", popupWindowId).catch(() => {});
          setPopupWindowId(null);
        }
        sendResponse({ ok: true });
        return true;
      }

      return false;
    },
  );
}
