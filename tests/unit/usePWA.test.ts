import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePWA } from "@/composables/usePWA";

function mockServiceWorker(registerImpl: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: registerImpl },
  });
}

let registerMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  registerMock = vi.fn();
  mockServiceWorker(registerMock);
});

describe("usePWA", () => {
  it("registers the service worker at /sw.js on the client", async () => {
    registerMock.mockResolvedValue({} as ServiceWorkerRegistration);
    usePWA();

    // Let the async registration settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(registerMock).toHaveBeenCalledWith("/sw.js");
  });

  it("installApp returns false when there is no deferred prompt", async () => {
    registerMock.mockResolvedValue({} as ServiceWorkerRegistration);
    const { installApp } = usePWA();

    expect(await installApp()).toBe(false);
  });

  it("installs the app when the user accepts the deferred prompt", async () => {
    registerMock.mockResolvedValue({} as ServiceWorkerRegistration);
    const { installApp, isInstalled } = usePWA();

    const prompt = vi.fn().mockResolvedValue(undefined);
    const userChoice = vi.fn().mockResolvedValue({ outcome: "accepted" });
    const event = Object.assign(new Event("beforeinstallprompt"), {
      preventDefault: vi.fn(),
      prompt,
      userChoice,
    }) as unknown as Event;

    window.dispatchEvent(event);

    expect(await installApp()).toBe(true);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(isInstalled.value).toBe(true);
  });

  it("records dismissal when the user declines the prompt", async () => {
    registerMock.mockResolvedValue({} as ServiceWorkerRegistration);
    const { installApp, isInstalled } = usePWA();

    const prompt = vi.fn().mockResolvedValue(undefined);
    const userChoice = vi.fn().mockResolvedValue({ outcome: "dismissed" });
    const event = Object.assign(new Event("beforeinstallprompt"), {
      preventDefault: vi.fn(),
      prompt,
      userChoice,
    }) as unknown as Event;

    window.dispatchEvent(event);

    expect(await installApp()).toBe(false);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(isInstalled.value).toBe(false);
  });
});
