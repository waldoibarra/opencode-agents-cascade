import path from "node:path"

/**
 * Core logic for the ancestor-instructions cascade, kept free of filesystem
 * access so every function is unit-testable. The plugin entry (index.ts)
 * wires in the real `node:fs` calls.
 */

/** Header OpenCode prefixes to every instruction file merged into system[0]. */
export const INSTRUCTION_HEADER = "Instructions from: "

/** Filenames probed per ancestor directory, in priority order. */
export const WALK_FILENAMES = ["AGENTS.md", "CLAUDE.md"] as const

/**
 * Basenames eligible for outermost-first reordering. CONTEXT.md is not
 * injected by the walker but OpenCode still loads it natively (deprecated),
 * so native CONTEXT.md blocks must sort with the rest of the chain.
 */
export const SORTABLE_FILENAMES = ["AGENTS.md", "CLAUDE.md", "CONTEXT.md"] as const

export interface Block {
  path: string
  content: string
}

export interface ParsedSystem {
  base: string
  blocks: Block[]
}

/** A header line must point at an absolute path or URL — anything else is
 * treated as ordinary file content to limit false positives. */
function isHeaderLine(line: string): boolean {
  if (!line.startsWith(INSTRUCTION_HEADER)) return false
  const target = line.slice(INSTRUCTION_HEADER.length)
  return target.startsWith("/") || target.startsWith("http://") || target.startsWith("https://")
}

/**
 * Split system[0] into the base prompt (everything before the first
 * instruction header) and one block per loaded instruction file.
 *
 * Known limitation: blocks are delimited only by header lines, so any text
 * OpenCode appends after the last block (e.g. a user-level system prompt)
 * is carried inside the last block's content.
 */
export function parseSystem(text: string): ParsedSystem {
  const lines = text.split("\n")
  const headerIndexes: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isHeaderLine(lines[i])) headerIndexes.push(i)
  }
  if (headerIndexes.length === 0) return { base: text, blocks: [] }

  const base = lines.slice(0, headerIndexes[0]).join("\n")
  const blocks = headerIndexes.map((start, i) => {
    const end = i + 1 < headerIndexes.length ? headerIndexes[i + 1] : lines.length
    return {
      path: lines[start].slice(INSTRUCTION_HEADER.length),
      content: lines.slice(start + 1, end).join("\n"),
    }
  })
  return { base, blocks }
}

/** Rebuild system[0] from a base prompt and an ordered list of blocks. */
export function buildSystem(base: string, blocks: Block[]): string {
  const parts = blocks.map((b) => `${INSTRUCTION_HEADER}${b.path}\n${b.content}`)
  if (base !== "") parts.unshift(base)
  return parts.join("\n")
}

function pathDepth(p: string): number {
  return p.split("/").filter(Boolean).length
}

/**
 * Sort blocks outermost-first: fewest path segments first, so the cwd file
 * (deepest) lands last and gets the highest LLM weight. Ties break
 * lexicographically for determinism; an ancestor chain never produces ties
 * because each directory contributes at most one file.
 */
export function sortBlocks(blocks: Block[]): Block[] {
  return [...blocks].sort(
    (a, b) => pathDepth(a.path) - pathDepth(b.path) || a.path.localeCompare(b.path),
  )
}

/**
 * Directories from `start` up to `stop` (both inclusive), outermost-first.
 * If `start` is not under `stop`, the walk ends at the filesystem root.
 */
export function ancestorDirs(start: string, stop: string = "/"): string[] {
  const boundary = path.resolve(stop)
  const dirs: string[] = []
  let current = path.resolve(start)
  for (;;) {
    dirs.push(current)
    if (current === boundary) break
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return dirs.reverse()
}

/** First instruction file present in `dir`, honoring WALK_FILENAMES priority. */
export function findInstructionFile(
  dir: string,
  exists: (p: string) => boolean,
): string | undefined {
  for (const name of WALK_FILENAMES) {
    const candidate = path.join(dir, name)
    if (exists(candidate)) return candidate
  }
  return undefined
}

/**
 * Instruction files in every directory strictly above the worktree root,
 * outermost-first. At most one file per directory.
 */
export function collectAncestorFiles(
  worktree: string,
  exists: (p: string) => boolean,
): string[] {
  const root = path.resolve(worktree)
  if (root === "/") return []
  const found: string[] = []
  for (const dir of ancestorDirs(path.dirname(root))) {
    const file = findInstructionFile(dir, exists)
    if (file !== undefined) found.push(file)
  }
  return found
}

/** True when the block is part of the cwd's ancestor chain and should be
 * reordered. Global files (~/.config/opencode, ~/.claude) and URL blocks
 * never qualify because their directory is not an ancestor of the cwd. */
export function isChainBlock(block: Block, directory: string): boolean {
  if (!block.path.startsWith("/")) return false
  if (!(SORTABLE_FILENAMES as readonly string[]).includes(path.basename(block.path))) return false
  const dir = path.dirname(path.resolve(block.path))
  const cwd = path.resolve(directory)
  return cwd === dir || cwd.startsWith(dir === "/" ? "/" : dir + "/")
}

export interface TransformInput {
  /** The hook's output.system array; system[0] is rewritten in place. */
  system: string[]
  /** Project directory (the cwd OpenCode was started in). */
  directory: string
  /** Git worktree root; "/" when the project is not inside a git repo. */
  worktree: string
  /** Present for chat requests, absent for internal agent generation. */
  sessionID?: string
  exists: (p: string) => boolean
  /** Returns file content, or undefined when unreadable. */
  read: (p: string) => string | undefined
}

/**
 * Inject ancestor instruction files and reorder the full set
 * outermost-first. Mutates input.system[0]; never throws by design of its
 * callers (the entry point wraps it defensively anyway).
 */
export function transformSystem(input: TransformInput): void {
  const { system, directory, worktree, sessionID, exists, read } = input

  // Non-git project: OpenCode already walks to "/" natively.
  if (!worktree || path.resolve(worktree) === "/") return
  if (system.length === 0 || typeof system[0] !== "string") return

  const parsed = parseSystem(system[0])
  const nativePaths = new Set(parsed.blocks.map((b) => path.resolve(b.path)))

  const injected: Block[] = []
  for (const file of collectAncestorFiles(worktree, exists)) {
    if (nativePaths.has(path.resolve(file))) continue
    const content = read(file)
    if (content === undefined || content === "") continue
    injected.push({ path: file, content })
  }

  if (parsed.blocks.length === 0) {
    // Nothing parseable: either no instruction files were loaded, or the
    // header format changed. Degrade gracefully — append, never reorder.
    // Without a sessionID this is an internal prompt (e.g. agent
    // generation), which must not receive project instructions.
    if (injected.length === 0 || sessionID === undefined) return
    system[0] = buildSystem(system[0], injected)
    return
  }

  if (injected.length === 0 && parsed.blocks.length === 1) return

  const chain: Block[] = []
  const others: Block[] = []
  for (const block of parsed.blocks) {
    ;(isChainBlock(block, directory) ? chain : others).push(block)
  }

  system[0] = buildSystem(parsed.base, [...others, ...sortBlocks([...chain, ...injected])])
}
