import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { collectAncestorFiles, findInstructionFile } from "../../src/cascade"

describe("walker against a real temp directory tree", () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "cascade-walk-"))
    mkdirSync(path.join(root, "home", "projects", "repo"), { recursive: true })
    writeFileSync(path.join(root, "AGENTS.md"), "root agents")
    writeFileSync(path.join(root, "home", "CLAUDE.md"), "home claude")
    writeFileSync(path.join(root, "home", "projects", "AGENTS.md"), "projects agents")
    writeFileSync(path.join(root, "home", "projects", "CLAUDE.md"), "projects claude")
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("finds real files honoring per-directory priority", () => {
    expect(findInstructionFile(path.join(root, "home"), existsSync)).toBe(
      path.join(root, "home", "CLAUDE.md"),
    )
    expect(findInstructionFile(path.join(root, "home", "projects"), existsSync)).toBe(
      path.join(root, "home", "projects", "AGENTS.md"),
    )
    expect(findInstructionFile(path.join(root, "home", "projects", "repo"), existsSync)).toBe(
      undefined,
    )
  })

  it("collects ancestors of a worktree from the real filesystem", () => {
    const worktree = path.join(root, "home", "projects", "repo")
    const files = collectAncestorFiles(worktree, existsSync)
    // The walk continues above the temp root; ignore anything found there.
    const inside = files.filter((f) => f.startsWith(root))
    expect(inside).toEqual([
      path.join(root, "AGENTS.md"),
      path.join(root, "home", "CLAUDE.md"),
      path.join(root, "home", "projects", "AGENTS.md"),
    ])
  })
})
