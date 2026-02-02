declare const browser: typeof chrome | undefined;

export const isBrowserApi = typeof browser !== "undefined";

export const ext: typeof chrome | null = isBrowserApi
  ? browser!
  : typeof chrome !== "undefined"
    ? chrome
    : null;

export function callApi<T>(
  namespace: Record<string, unknown> | null | undefined,
  method: string,
  ...args: unknown[]
): Promise<T> {
  const ns = namespace as Record<string, (...a: unknown[]) => unknown> | null | undefined;
  if (!ns || typeof ns[method] !== "function") {
    return Promise.reject(new Error(`Missing API: ${method}`));
  }
  if (isBrowserApi) {
    return ns[method](...args) as Promise<T>;
  }
  return new Promise((resolve, reject) => {
    ns[method](...args, (result: T) => {
      const err = (ext?.runtime as unknown as { lastError?: { message?: string } })?.lastError;
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}
