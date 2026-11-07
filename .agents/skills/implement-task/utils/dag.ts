/**
 * DAG Analyzer for Task Dependency Graph
 * Assigns gate_level based on dependency topology
 */

export interface Task {
  id: number;
  title: string;
  gate_level?: "strict" | "standard" | "light";
  depends_on: number[];
  done: boolean;
}

export interface DagResult {
  levels: Map<number, "strict" | "standard" | "light">;
  order: number[]; // topological order
  roots: number[]; // tasks with no dependencies
  leaves: number[]; // tasks with no dependents
}

/**
 * Build adjacency list and reverse adjacency list
 */
function buildGraph(tasks: Task[]): {
  adj: Map<number, number[]>;
  radj: Map<number, number[]>;
} {
  const adj = new Map<number, number[]>();
  const radj = new Map<number, number[]>();

  tasks.forEach((t) => {
    adj.set(t.id, [...t.depends_on]);
    radj.set(t.id, []);
  });

  tasks.forEach((t) => {
    t.depends_on.forEach((dep) => {
      const deps = radj.get(dep) || [];
      deps.push(t.id);
      radj.set(dep, deps);
    });
  });

  return { adj, radj };
}

/**
 * Topological sort using Kahn's algorithm
 */
function topologicalSort(tasks: Task[], adj: Map<number, number[]>): number[] {
  const inDegree = new Map<number, number>();
  const queue: number[] = [];
  const order: number[] = [];

  tasks.forEach((t) => inDegree.set(t.id, t.depends_on.length));

  tasks.forEach((t) => {
    if (t.depends_on.length === 0) queue.push(t.id);
  });

  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);

    const deps = adj.get(id) || [];
    deps.forEach((depId) => {
      const deg = (inDegree.get(depId) || 1) - 1;
      inDegree.set(depId, deg);
      if (deg === 0) queue.push(depId);
    });
  }

  if (order.length !== tasks.length) {
    throw new Error("Circular dependency detected in tasks");
  }

  return order;
}

/**
 * Assign gate levels based on dependency topology:
 * - Root (no dependents) → "strict" (all gates)
 * - Intermediate → "standard" (typecheck + unit)
 * - Leaf (no dependents) → "light" (typecheck only)
 *
 * Actually:
 * - Root = no dependencies (nothing depends on it? no - root has no dependencies)
 * Wait: In a DAG, "root" typically means no incoming edges (no dependencies)
 * "Leaf" means no outgoing edges (nothing depends on it)
 *
 * For gates:
 * - Tasks that NOTHING depends on (leaf) → light (they're the final deliverable)
 * - Tasks that EVERYTHING depends on (root) → strict (foundation)
 * - Intermediate → standard
 */
export function assignGateLevels(tasks: Task[]): DagResult {
  const { adj, radj } = buildGraph(tasks);
  const order = topologicalSort(tasks, adj);

  const leaves: number[] = [];
  const roots: number[] = [];

  tasks.forEach((t) => {
    const dependents = radj.get(t.id) || [];
    const dependencies = adj.get(t.id) || [];

    if (dependents.length === 0) leaves.push(t.id);
    if (dependencies.length === 0) roots.push(t.id);
  });

  const levels = new Map<number, "strict" | "standard" | "light">();

  tasks.forEach((t) => {
    const dependents = radj.get(t.id) || [];
    const dependencies = adj.get(t.id) || [];

    if (dependents.length === 0 && dependencies.length === 0) {
      // Isolated task
      levels.set(t.id, "standard");
    } else if (dependents.length === 0) {
      // Leaf - nothing depends on this, it's a deliverable
      levels.set(t.id, "light");
    } else if (dependencies.length === 0) {
      // Root - foundation, everything depends on this
      levels.set(t.id, "strict");
    } else {
      // Intermediate
      levels.set(t.id, "standard");
    }
  });

  return { levels, order, roots, leaves };
}

/**
 * Get gate commands for a given level
 */
export function getGateCommands(
  level: "strict" | "standard" | "light",
): string[] {
  const base = ["pnpm typecheck", "pnpm lint"];

  switch (level) {
    case "strict":
      return [
        ...base,
        "pnpm test:unit --run",
        "pnpm test:integration --run",
        "pnpm build",
      ];
    case "standard":
      return [...base, "pnpm test:unit --run"];
    case "light":
      return base;
  }
}
