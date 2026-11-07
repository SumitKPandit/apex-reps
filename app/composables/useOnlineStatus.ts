/**
 * Reactive online/offline status.
 *
 * Wraps `navigator.onLine` and the `online`/`offline` window events so the
 * app can react to connectivity changes. SSR-safe: when `window`/`navigator`
 * are unavailable (server render), `isOnline` defaults to `true` and no
 * listeners are attached.
 */
import { ref } from "vue";

/**
 * Expose a reactive `isOnline` flag and a cleanup function.
 *
 * @returns `{ isOnline, stop }` — `isOnline` is true when the browser reports
 * online; `stop` removes the `online`/`offline` listeners to avoid leaks.
 */
export function useOnlineStatus() {
  const isOnline = ref(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  if (typeof window !== "undefined") {
    const handleOnline = () => {
      isOnline.value = true;
    };
    const handleOffline = () => {
      isOnline.value = false;
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    function stop() {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    }

    return { isOnline, stop };
  }

  return { isOnline, stop: () => {} };
}
