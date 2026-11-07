/**
 * Smart Context Summarizer
 * Preserves: types, decisions, errors, acceptance criteria
 * Drops: verbose comments, redundant examples, boilerplate
 */

export interface SummaryConfig {
  maxTokens: number;
  preserve: ("types" | "decisions" | "errors" | "criteria" | "signatures")[];
}

const DEFAULT_CONFIG: SummaryConfig = {
  maxTokens: 8000,
  preserve: ["types", "decisions", "errors", "criteria", "signatures"],
};

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if text contains TypeScript type definitions
 */
function hasTypeDefinitions(text: string): boolean {
  const patterns = [
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
    /type\s+\w+\s+extends/,
    /export\s+type/,
    /:\s*\w+\[\]/,
    /:\s*Record</,
    /:\s*Promise</,
    /:\s*\w+\s*\|\s*\w+/,
    /<\w+>/,
  ];
  return patterns.some((p) => p.test(text));
}

/**
 * Check if text contains decision records
 */
function hasDecisions(text: string): boolean {
  return (
    /(?:decision|choice|rationale|decided)[:\s]/i.test(text) ||
    /DECISIONS?/i.test(text)
  );
}

/**
 * Check if text contains error messages
 */
function hasErrors(text: string): boolean {
  return (
    /(?:error|Error|exception|Exception|failed|Failed)[:\s]/i.test(text) ||
    /throw new Error/i.test(text)
  );
}

/**
 * Check if text contains acceptance criteria
 */
function hasCriteria(text: string): boolean {
  return (
    /(?:acceptance|criteria|AC)[:\s]/i.test(text) ||
    /\[ \]/i.test(text) ||
    /- \[[x ]\]/i.test(text)
  );
}

/**
 * Check if text contains function signatures
 */
function hasSignatures(text: string): boolean {
  return (
    /(?:function|const|async function)\s+\w+\s*\(/i.test(text) ||
    /=>\s*\{/i.test(text) ||
    /:\s*\w+\s*=>/i.test(text)
  );
}

/**
 * Split text into semantic blocks
 */
function splitIntoBlocks(
  text: string,
): { content: string; type: string; priority: number }[] {
  const lines = text.split("\n");
  const blocks: { content: string; type: string; priority: number }[] = [];
  let currentBlock: string[] = [];
  let currentType = "other";

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect block type changes
    if (
      trimmed.startsWith("interface ") ||
      trimmed.startsWith("type ") ||
      trimmed.startsWith("export type")
    ) {
      if (currentBlock.length) {
        blocks.push({
          content: currentBlock.join("\n"),
          type: currentType,
          priority: getPriority(currentType),
        });
        currentBlock = [];
      }
      currentType = "types";
    } else if (
      trimmed.startsWith("function ") ||
      trimmed.startsWith("const ") ||
      trimmed.startsWith("async function")
    ) {
      if (currentBlock.length && currentType !== "signatures") {
        blocks.push({
          content: currentBlock.join("\n"),
          type: currentType,
          priority: getPriority(currentType),
        });
        currentBlock = [];
      }
      currentType = "signatures";
    } else if (
      trimmed.match(/^(?:DECISION|Decision|Decision:|choice:|rationale:)/i)
    ) {
      if (currentBlock.length) {
        blocks.push({
          content: currentBlock.join("\n"),
          type: currentType,
          priority: getPriority(currentType),
        });
        currentBlock = [];
      }
      currentType = "decisions";
    } else if (
      trimmed.match(
        /^(?:ERROR|Error|error|Exception|exception|throw new Error)/i,
      )
    ) {
      if (currentBlock.length && currentType !== "errors") {
        blocks.push({
          content: currentBlock.join("\n"),
          type: currentType,
          priority: getPriority(currentType),
        });
        currentBlock = [];
      }
      currentType = "errors";
    } else if (
      trimmed.match(/^\s*[-*]\s*\[[x ]\]/i) ||
      trimmed.match(/acceptance|criteria/i)
    ) {
      if (currentBlock.length && currentType !== "criteria") {
        blocks.push({
          content: currentBlock.join("\n"),
          type: currentType,
          priority: getPriority(currentType),
        });
        currentBlock = [];
      }
      currentType = "criteria";
    } else if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*")
    ) {
      if (currentBlock.length && currentType !== "comments") {
        blocks.push({
          content: currentBlock.join("\n"),
          type: currentType,
          priority: getPriority(currentType),
        });
        currentBlock = [];
      }
      currentType = "comments";
    } else if (trimmed === "") {
      // Empty line - continue current block
    } else {
      // Regular code
    }

    currentBlock.push(line);
  }

  if (currentBlock.length) {
    blocks.push({
      content: currentBlock.join("\n"),
      type: currentType,
      priority: getPriority(currentType),
    });
  }

  return blocks;
}

function getPriority(type: string): number {
  const priorities: Record<string, number> = {
    types: 10,
    decisions: 10,
    errors: 10,
    criteria: 10,
    signatures: 9,
    other: 5,
    comments: 1,
  };
  return priorities[type] || 5;
}

/**
 * Summarize a block based on its type
 */
function summarizeBlock(
  block: { content: string; type: string; priority: number },
  config: SummaryConfig,
): string {
  const lines = block.content.split("\n");

  switch (block.type) {
    case "comments":
      // Drop comments entirely unless they contain TODOs/FIXMEs
      const todos = lines.filter((l) => /TODO|FIXME|XXX|HACK/i.test(l));
      return todos.length > 0 ? todos.join("\n") : "";

    case "types":
    case "decisions":
    case "errors":
    case "criteria":
    case "signatures":
      // Keep verbatim
      return block.content;

    default:
      // For other code, keep but compress blank lines
      return lines.filter((l) => l.trim() !== "").join("\n");
  }
}

/**
 * Main summarization function
 */
export function summarizeContext(
  context: string,
  config: Partial<SummaryConfig> = {},
): {
  summary: string;
  originalTokens: number;
  summaryTokens: number;
  compressionRatio: number;
} {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const originalTokens = estimateTokens(context);

  if (originalTokens <= cfg.maxTokens) {
    return {
      summary: context,
      originalTokens,
      summaryTokens: originalTokens,
      compressionRatio: 1.0,
    };
  }

  const blocks = splitIntoBlocks(context);

  // Sort by priority (highest first)
  blocks.sort((a, b) => b.priority - a.priority);

  let summary = "";
  let tokens = 0;

  for (const block of blocks) {
    const summarized = summarizeBlock(block, cfg);
    if (!summarized.trim()) continue;

    const blockTokens = estimateTokens(summarized);
    if (tokens + blockTokens > cfg.maxTokens) {
      // Try to fit a truncated version
      const remaining = cfg.maxTokens - tokens;
      if (remaining > 100) {
        const truncated =
          summarized.slice(0, remaining * 4) + "\n... [truncated]";
        summary += truncated + "\n\n";
        tokens += estimateTokens(truncated);
      }
      break;
    }
    summary += summarized + "\n\n";
    tokens += blockTokens;
  }

  return {
    summary: summary.trim(),
    originalTokens,
    summaryTokens: tokens,
    compressionRatio: tokens / originalTokens,
  };
}

/**
 * Summarize multiple files/contexts
 */
export function summarizeMultiple(
  contexts: Record<string, string>,
  config: Partial<SummaryConfig> = {},
): Record<
  string,
  { summary: string; originalTokens: number; summaryTokens: number }
> {
  const results: Record<
    string,
    { summary: string; originalTokens: number; summaryTokens: number }
  > = {};

  for (const [key, context] of Object.entries(contexts)) {
    results[key] = summarizeContext(context, config);
  }

  return results;
}
