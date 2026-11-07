/**
 * PWA integration: service worker registration + install prompt.
 *
 * Registers the service worker (`/sw.js`) so the app shell loads offline, and
 * exposes the `beforeinstallprompt` flow so users can install the app.
 * SSR-safe: all `window`/`navigator` access is guarded.
 */
import { ref } from "vue";

type InstallPromptEvent = Event & {
  prompt?: () => Promise<void>;
  userChoice?: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Expose PWA capabilities.
 *
 * @returns `{ isInstalled, swRegistration, registerServiceWorker, installApp }`
 */
export function usePWA() {
  const isInstalled = ref(false);
  const swRegistration = ref<ServiceWorkerRegistration | null>(null);
  let deferredPrompt: InstallPromptEvent | null = null;

  /**
   * Register the service worker at /sw.js.
   */
  async function registerServiceWorker() {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return null;
    }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      swRegistration.value = registration;
      return registration;
    } catch (err) {
      console.error("Failed to register service worker", err);
      return null;
    }
  }

  if (typeof window !== "undefined") {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as InstallPromptEvent;
      isInstalled.value = false;
    };
    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );
    // Register the shell-caching service worker so the app works offline.
    registerServiceWorker();
  }

  /**
   * Show the install prompt if one has been deferred.
   */
  async function installApp(): Promise<boolean> {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt?.();
    const { outcome } =
      (await deferredPrompt.userChoice?.()) ?? { outcome: "dismissed" };
    deferredPrompt = null;
    isInstalled.value = outcome === "accepted";
    return isInstalled.value;
  }

  return { isInstalled, swRegistration, registerServiceWorker, installApp };
}
