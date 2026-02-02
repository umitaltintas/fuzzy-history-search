import { isBrowserApi, ext } from "./browser-api";

export function sendMessage(message: Record<string, unknown>): Promise<unknown> {
  if (!ext || !ext.runtime || !ext.runtime.sendMessage) {
    return Promise.reject(new Error("Messaging unavailable"));
  }

  if (isBrowserApi) {
    try {
      return ext.runtime.sendMessage(message);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return new Promise((resolve) => {
    (ext!.runtime.sendMessage as (message: unknown, callback: (response: unknown) => void) => void)(
      message,
      resolve,
    );
  });
}

export function getFaviconUrl(url: string): string {
  if (!url) return "";
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
}

export function formatHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url;
  }
}

export function formatTimeAgo(timestamp: number): string {
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
