import path from "node:path"

/**
 * Core logic for the ancestor-instructions cascade, kept free of filesystem
 * access so every function is unit-testable. The plugin entry (index.ts)
 * wires in the real `node:fs` calls.
 */

/** Header expected for instruction blocks in the observed OpenCode prompt format. */
export const INSTRUCTION_HEADER = "Instructions from: "

/** Filenames probed per ancestor directory, in priority order. */
export const WALK_FILENAMES = ["AGENTS.md", "CLAUDE.md"] as const

/**
 * Basenames eligible for outermost-first reordering. The walker does not
 * inject CONTEXT.md; a native block with that basename can join the chain.
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

/** A header line must point at an absolute path or URL.
 * Other lines remain ordinary content to limit false positives. */
function isHeaderLine(line: string): boolean {
  if (!line.startsWith(INSTRUCTION_HEADER)) return false
  const target = line.slice(INSTRUCTION_HEADER.length)
  return target.startsWith("/") || target.startsWith("http://") || target.startsWith("https://")
}

/**
 * Parse expected instruction headers in system[0] into a base prompt and blocks.
 * The base precedes the first header; each following header starts another block.
 *
 * Known limitation: only header lines delimit blocks.
 * In the observed host format, text appended after the final block stays in that block's content.
 */
export function parseSystem(text: string): ParsedSystem {
  const lines = text.split("\n")
  const headers: { index: number; path: string }[] = []
  lines.forEach((line, index) => {
    if (isHeaderLine(line)) headers.push({ index, path: line.slice(INSTRUCTION_HEADER.length) })
  })
  const first = headers[0]
  if (first === undefined) return { base: text, blocks: [] }

  const base = lines.slice(0, first.index).join("\n")
  const blocks = headers.map((header, i) => ({
    path: header.path,
    content: lines.slice(header.index + 1, headers[i + 1]?.index ?? lines.length).join("\n"),
  }))
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
 * (deepest) lands last. This establishes position, not model priority.
 * Ties break lexicographically; a collected ancestor chain has one file per directory.
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
 * lie outside the cwd's ancestor chain, so they never qualify. */
export function isChainBlock(block: Block, directory: string): boolean {
  if (!block.path.startsWith("/")) return false
  if (!(SORTABLE_FILENAMES as readonly string[]).includes(path.basename(block.path))) return false
  const dir = path.dirname(path.resolve(block.path))
  const cwd = path.resolve(directory)
  return cwd === dir || cwd.startsWith(dir === "/" ? "/" : dir + "/")
}

/**
 * In the observed host format, per-prompt custom system text (PromptInput.system)
 * can follow the last instruction block. The joined string has no delimiter there.
 * Re-reading that block's file can separate text following its verbatim content.
 * The transform places separated text after the reordered blocks.
 * Without a matching local file, text remains attached to the last block.
 * This includes unreadable or changed files and remote URL blocks.
 */
export function extractTrailingText(
  blocks: Block[],
  read: (p: string) => string | undefined,
): { blocks: Block[]; trailing: string } {
  const last = blocks[blocks.length - 1]
  if (last === undefined || !last.path.startsWith("/")) return { blocks, trailing: "" }
  const file = read(last.path)
  if (file === undefined || file === "" || last.content === file) return { blocks, trailing: "" }
  if (!last.content.startsWith(file) || last.content[file.length] !== "\n") {
    return { blocks, trailing: "" }
  }
  return {
    blocks: [...blocks.slice(0, -1), { path: last.path, content: file }],
    trailing: last.content.slice(file.length + 1),
  }
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
 * Inject ancestor files and sort recognized directory-chain blocks outermost-first.
 * Mutates input.system[0]; the entry hook catches errors without rolling back mutations.
 */
export function transformSystem(input: TransformInput): void {
  const { system, directory, worktree, sessionID, exists, read } = input

  // The non-git worktree sentinel "/" yields no injection candidates.
  // Parsed native chain blocks can still be reordered.
  if (!worktree) return
  if (system.length === 0 || typeof system[0] !== "string") return

  const parsed = parseSystem(system[0])
  const { blocks: nativeBlocks, trailing } = extractTrailingText(parsed.blocks, read)
  const nativePaths = new Set(nativeBlocks.map((b) => path.resolve(b.path)))

  const injected: Block[] = []
  for (const file of collectAncestorFiles(worktree, exists)) {
    if (nativePaths.has(path.resolve(file))) continue
    const content = read(file)
    if (content === undefined || content === "") continue
    injected.push({ path: file, content })
  }

  if (nativeBlocks.length === 0) {
    // With no parseable blocks, append candidates only for a session request.
    // No sessionID may indicate an internal prompt; leave it unchanged.
    if (injected.length === 0 || sessionID === undefined) return
    system[0] = buildSystem(system[0], injected)
    return
  }

  if (injected.length === 0 && nativeBlocks.length === 1) return

  const chain: Block[] = []
  const others: Block[] = []
  for (const block of nativeBlocks) {
    ;(isChainBlock(block, directory) ? chain : others).push(block)
  }

  const rebuilt = buildSystem(parsed.base, [...others, ...sortBlocks([...chain, ...injected])])
  system[0] = trailing === "" ? rebuilt : `${rebuilt}\n${trailing}`
}
