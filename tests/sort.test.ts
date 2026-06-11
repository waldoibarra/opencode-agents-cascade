import { describe, expect, it } from "bun:test"
import { isChainBlock, sortBlocks } from "../src/cascade"

const b = (path: string) => ({ path, content: `content of ${path}` })

describe("sortBlocks", () => {
  it("returns empty input untouched", () => {
    expect(sortBlocks([])).toEqual([])
  })

  it("sorts outermost-first by path depth", () => {
    const blocks = [
      b("/Users/me/projects/repo/sub/AGENTS.md"),
      b("/Users/AGENTS.md"),
      b("/Users/me/projects/AGENTS.md"),
      b("/Users/me/AGENTS.md"),
      b("/Users/me/projects/repo/AGENTS.md"),
    ]
    expect(sortBlocks(blocks).map((x) => x.path)).toEqual([
      "/Users/AGENTS.md",
      "/Users/me/AGENTS.md",
      "/Users/me/projects/AGENTS.md",
      "/Users/me/projects/repo/AGENTS.md",
      "/Users/me/projects/repo/sub/AGENTS.md",
    ])
  })

  it("places the deepest path (cwd) last so it gets the highest weight", () => {
    const sorted = sortBlocks([b("/a/b/c/AGENTS.md"), b("/a/AGENTS.md")])
    expect(sorted.at(-1)?.path).toBe("/a/b/c/AGENTS.md")
  })

  it("breaks depth ties lexicographically and deterministically", () => {
    const tied = [b("/a/zeta/AGENTS.md"), b("/a/alpha/AGENTS.md"), b("/a/mid/CLAUDE.md")]
    const once = sortBlocks(tied).map((x) => x.path)
    expect(once).toEqual(["/a/alpha/AGENTS.md", "/a/mid/CLAUDE.md", "/a/zeta/AGENTS.md"])
    expect(sortBlocks([...tied].reverse()).map((x) => x.path)).toEqual(once)
  })

  it("does not mutate its input", () => {
    const blocks = [b("/a/b/AGENTS.md"), b("/a/AGENTS.md")]
    sortBlocks(blocks)
    expect(blocks.map((x) => x.path)).toEqual(["/a/b/AGENTS.md", "/a/AGENTS.md"])
  })
})

describe("isChainBlock", () => {
  const cwd = "/Users/me/projects/repo/sub"

  it("accepts instruction files in ancestors of the cwd", () => {
    expect(isChainBlock(b("/Users/AGENTS.md"), cwd)).toBe(true)
    expect(isChainBlock(b("/Users/me/CLAUDE.md"), cwd)).toBe(true)
    expect(isChainBlock(b("/Users/me/projects/repo/CONTEXT.md"), cwd)).toBe(true)
    expect(isChainBlock(b("/AGENTS.md"), cwd)).toBe(true)
  })

  it("accepts the cwd's own instruction file", () => {
    expect(isChainBlock(b("/Users/me/projects/repo/sub/AGENTS.md"), cwd)).toBe(true)
  })

  it("rejects global config files outside the ancestor chain", () => {
    expect(isChainBlock(b("/Users/me/.config/opencode/AGENTS.md"), cwd)).toBe(false)
    expect(isChainBlock(b("/Users/me/.claude/CLAUDE.md"), cwd)).toBe(false)
  })

  it("rejects sibling directories that merely share a prefix", () => {
    expect(isChainBlock(b("/Users/me/projects/repo-other/AGENTS.md"), cwd)).toBe(false)
    expect(isChainBlock(b("/Users/me/projects/repo/subway/AGENTS.md"), cwd)).toBe(false)
  })

  it("rejects URLs and non-instruction filenames", () => {
    expect(isChainBlock(b("https://example.com/AGENTS.md"), cwd)).toBe(false)
    expect(isChainBlock(b("/Users/me/notes.md"), cwd)).toBe(false)
  })
})
