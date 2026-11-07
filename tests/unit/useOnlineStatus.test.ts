import { describe, it, expect } from "vitest";
import { useOnlineStatus } from "@/composables/useOnlineStatus";

describe("useOnlineStatus", () => {
  it("isOnline initially matches navigator.onLine", () => {
    const { isOnline } = useOnlineStatus();
    expect(isOnline.value).toBe(window.navigator.onLine);
  });

  it("isOnline becomes false when offline event fires", () => {
    const { isOnline } = useOnlineStatus();
    expect(isOnline.value).toBe(true);

    window.dispatchEvent(new Event("offline"));
    expect(isOnline.value).toBe(false);
  });

  it("isOnline becomes true when online event fires", () => {
    const { isOnline } = useOnlineStatus();
    window.dispatchEvent(new Event("offline"));
    expect(isOnline.value).toBe(false);

    window.dispatchEvent(new Event("online"));
    expect(isOnline.value).toBe(true);
  });
});
