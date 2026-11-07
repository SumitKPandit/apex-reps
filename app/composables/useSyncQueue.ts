/**
 * IndexedDB-persisted sync queue for mutations made while offline.
 *
 * Items are persisted to IndexedDB via `idb-keyval` so they survive reloads.
 * When IndexedDB is unavailable (e.g. private browsing) the queue degrades to
 * memory-only and is lost on reload — acceptable for a best-effort sync queue.
 *
 * Callers own the replay logic: `flush(replay)` replays each queued item and
 * drops the ones that succeed, keeping failures for a later retry.
 */
import { ref } from "vue";
import { get as idbGet, set as idbSet } from "idb-keyval";

const QUEUE_KEY = "apex-reps-sync-queue";

export interface QueueItem {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

export function useSyncQueue() {
  const queue = ref<QueueItem[]>([]);
  const isFlushing = ref(false);

  async function load(): Promise<void> {
    try {
      const stored = (await idbGet<QueueItem[]>(QUEUE_KEY)) ?? [];
      queue.value = stored;
    } catch {
      // IndexedDB unavailable — queue is memory-only for this session.
      queue.value = [];
    }
  }

  async function persist(): Promise<void> {
    try {
      await idbSet(QUEUE_KEY, queue.value);
    } catch {
      // Ignore — IndexedDB unavailable.
    }
  }

  /**
   * Add an item to the queue and persist it.
   * Returns the generated item id.
   */
  async function enqueue(
    item: Omit<QueueItem, "id" | "timestamp">,
  ): Promise<string> {
    const entry: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      ...item,
    };
    queue.value = [...queue.value, entry];
    await persist();
    return entry.id;
  }

  async function remove(id: string): Promise<void> {
    queue.value = queue.value.filter((i) => i.id !== id);
    await persist();
  }

  /**
   * Replay every queued item through `replay`. Items that succeed are removed;
   * items that throw are kept for a later retry.
   */
  async function flush(
    replay: (item: QueueItem) => Promise<void>,
  ): Promise<void> {
    if (isFlushing.value) return;
    isFlushing.value = true;
    const remaining: QueueItem[] = [];
    for (const item of queue.value) {
      try {
        await replay(item);
      } catch {
        remaining.push(item);
      }
    }
    queue.value = remaining;
    await persist();
    isFlushing.value = false;
  }

  return { queue, isFlushing, enqueue, remove, flush, load };
}
