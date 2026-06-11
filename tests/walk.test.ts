import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { ancestorDirs, collectAncestorFiles, findInstructionFile } from "../src/cascade"

describe("ancestorDirs", () => {
  it("returns the chain outermost-first, boundary and start inclusive", () => {
    expect(ancestorDirs("/a/b/c", "/")).toEqual(["/", "/a", "/a/b", "/a/b/c"])
  })

  it("stops at a non-root boundary", () => {
    expect(ancestorDirs("/a/b/c/d", "/a/b")).toEqual(["/a/b", "/a/b/c", "/a/b/c/d"])
  })

  it("handles start equal to the boundary", () => {
    expect(ancestorDirs("/a/b", "/a/b")).toEqual(["/a/b"])
    expect(ancestorDirs("/", "/")).toEqual(["/"])
  })

  it("falls back to the filesystem root when start is outside the boundary", () => {
    expect(ancestorDirs("/x/y", "/a")).toEqual(["/", "/x", "/x/y"])
  })

  it("normalizes trailing slashes and dot segments", () => {
    expect(ancestorDirs("/a/b/./c/", "/")).toEqual(["/", "/a", "/a/b", "/a/b/c"])
  })
})

describe("findInstructionFile (fake fs)", () => {
  const fakeExists = (present: string[]) => (p: string) => present.includes(p)

  it("prefers AGENTS.md over CLAUDE.md", () => {
    const exists = fakeExists(["/d/AGENTS.md", "/d/CLAUDE.md"])
    expect(findInstructionFile("/d", exists)).toBe("/d/AGENTS.md")
  })

  it("falls back to CLAUDE.md", () => {
    expect(findInstructionFile("/d", fakeExists(["/d/CLAUDE.md"]))).toBe("/d/CLAUDE.md")
  })

  it("returns undefined when neither exists", () => {
    expect(findInstructionFile("/d", fakeExists([]))).toBeUndefined()
  })
})

describe("collectAncestorFiles (fake fs)", () => {
  it("collects at most one file per directory above the worktree, outermost-first", () => {
    const present = [
      "/Users/AGENTS.md",
      "/Users/me/AGENTS.md",
      "/Users/me/CLAUDE.md",
      "/Users/me/projects/CLAUDE.md",
      "/Users/me/projects/repo/AGENTS.md", // inside the worktree: must not be collected
    ]
    const exists = (p: string) => present.includes(p)
    expect(collectAncestorFiles("/Users/me/projects/repo", exists)).toEqual([
      "/Users/AGENTS.md",
      "/Users/me/AGENTS.md",
      "/Users/me/projects/CLAUDE.md",
    ])
  })

  it("returns empty for a root worktree (non-git sentinel)", () => {
    expect(collectAncestorFiles("/", () => true)).toEqual([])
  })

  it("returns empty when no ancestor has instruction files", () => {
    expect(collectAncestorFiles("/a/b/c", () => false)).toEqual([])
  })
})

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
