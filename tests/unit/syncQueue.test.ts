import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSyncQueue } from "@/composables/useSyncQueue";

// vi.hoisted runs before vi.mock factories are evaluated, so these mocks are
// available to the hoisted factory below.
const idbMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("idb-keyval", () => ({
  get: idbMocks.get,
  set: idbMocks.set,
}));

const idbGet = idbMocks.get;
const idbSet = idbMocks.set;

describe("useSyncQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads queued items from IndexedDB on init", async () => {
    const stored = [
      {
        id: "a",
        type: "createCustomFood",
        payload: { name: "X" },
        timestamp: 1,
      },
    ];
    idbGet.mockResolvedValue(stored);

    const { queue, load } = useSyncQueue();
    await load();

    expect(queue.value).toEqual(stored);
    expect(idbGet).toHaveBeenCalledWith("apex-reps-sync-queue");
  });

  it("degrades gracefully when IndexedDB is unavailable", async () => {
    idbGet.mockRejectedValue(new Error("no IndexedDB"));

    const { queue, load } = useSyncQueue();
    await load();

    expect(queue.value).toEqual([]);
  });

  it("enqueues an item, persists it, and returns its id", async () => {
    idbGet.mockResolvedValue([]);
    idbSet.mockResolvedValue(undefined);

    const { enqueue, queue } = useSyncQueue();
    await enqueue({ type: "createCustomFood", payload: { name: "Whey" } });

    expect(queue.value).toHaveLength(1);
    expect(queue.value[0].type).toBe("createCustomFood");
    expect(typeof queue.value[0].id).toBe("string");
    expect(idbSet).toHaveBeenCalledWith("apex-reps-sync-queue", queue.value);
  });

  it("flush removes succeeded items and keeps failures", async () => {
    idbGet.mockResolvedValue([]);
    idbSet.mockResolvedValue(undefined);

    const { enqueue, flush, queue } = useSyncQueue();

    const replay = vi.fn(async (item) => {
      if (item.payload.fail) throw new Error("replay failed");
    });

    await enqueue({ type: "createCustomFood", payload: { name: "OK" } });
    await enqueue({
      type: "createCustomFood",
      payload: { name: "FAIL", fail: true },
    });

    await flush(replay);

    expect(replay).toHaveBeenCalledTimes(2);
    expect(queue.value).toHaveLength(1);
    expect(queue.value[0].payload.fail).toBe(true);
    // Persisted the remaining (failed) item.
    expect(idbSet).toHaveBeenCalledWith("apex-reps-sync-queue", [
      queue.value[0],
    ]);
  });

  it("remove deletes an item and persists", async () => {
    idbGet.mockResolvedValue([]);
    idbSet.mockResolvedValue(undefined);

    const { enqueue, remove, queue } = useSyncQueue();
    const id = await enqueue({
      type: "createCustomFood",
      payload: { name: "X" },
    });

    await remove(id);

    expect(queue.value).toHaveLength(0);
    expect(idbSet).toHaveBeenCalledWith("apex-reps-sync-queue", []);
  });
});
