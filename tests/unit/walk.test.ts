import { describe, expect, it } from "bun:test"
import { ancestorDirs, collectAncestorFiles, findInstructionFile } from "../../src/cascade"

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
