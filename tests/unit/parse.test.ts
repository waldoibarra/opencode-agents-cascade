import { describe, expect, it } from "bun:test"
import { INSTRUCTION_HEADER, buildSystem, parseSystem } from "../../src/cascade"

const BASE = "You are opencode, an AI coding agent.\nLine two of the base prompt."

function block(path: string, content: string): string {
  return `${INSTRUCTION_HEADER}${path}\n${content}`
}

describe("parseSystem", () => {
  it("returns the whole text as base when there are no blocks", () => {
    const parsed = parseSystem(BASE)
    expect(parsed.base).toBe(BASE)
    expect(parsed.blocks).toEqual([])
  })

  it("parses a single block", () => {
    const text = [BASE, block("/repo/AGENTS.md", "use tabs\nalways")].join("\n")
    const parsed = parseSystem(text)
    expect(parsed.base).toBe(BASE)
    expect(parsed.blocks).toEqual([{ path: "/repo/AGENTS.md", content: "use tabs\nalways" }])
  })

  it("parses many blocks in document order", () => {
    const text = [
      BASE,
      block("/a/AGENTS.md", "alpha"),
      block("/a/b/CLAUDE.md", "beta\nwith two lines"),
      block("/a/b/c/AGENTS.md", "gamma"),
    ].join("\n")
    const parsed = parseSystem(text)
    expect(parsed.blocks.map((b) => b.path)).toEqual([
      "/a/AGENTS.md",
      "/a/b/CLAUDE.md",
      "/a/b/c/AGENTS.md",
    ])
    expect(parsed.blocks[1]?.content).toBe("beta\nwith two lines")
  })

  it("parses a block with empty content", () => {
    const text = [BASE, block("/a/AGENTS.md", "")].join("\n")
    const parsed = parseSystem(text)
    expect(parsed.blocks).toEqual([{ path: "/a/AGENTS.md", content: "" }])
  })

  it("parses URL blocks (remote instructions)", () => {
    const text = [BASE, block("https://example.com/rules.md", "remote")].join("\n")
    expect(parseSystem(text).blocks).toEqual([
      { path: "https://example.com/rules.md", content: "remote" },
    ])
  })

  it("handles a missing base (block at the very start)", () => {
    const text = block("/a/AGENTS.md", "alpha")
    const parsed = parseSystem(text)
    expect(parsed.base).toBe("")
    expect(parsed.blocks).toEqual([{ path: "/a/AGENTS.md", content: "alpha" }])
  })

  it("ignores header-like lines that do not point at a path or URL", () => {
    const content = "first\nInstructions from: your manager\nlast"
    const text = [BASE, block("/a/AGENTS.md", content)].join("\n")
    const parsed = parseSystem(text)
    expect(parsed.blocks).toHaveLength(1)
    expect(parsed.blocks[0]?.content).toBe(content)
  })

  it("known limitation: a content line with an absolute path header splits the block", () => {
    const text = [BASE, block("/a/AGENTS.md", "Instructions from: /b/AGENTS.md\nrest")].join("\n")
    const parsed = parseSystem(text)
    expect(parsed.blocks.map((b) => b.path)).toEqual(["/a/AGENTS.md", "/b/AGENTS.md"])
  })

  it("keeps trailing text after the last block inside that block", () => {
    const text = [BASE, block("/a/AGENTS.md", "alpha"), "user supplied system prompt"].join("\n")
    const parsed = parseSystem(text)
    expect(parsed.blocks[0]?.content).toBe("alpha\nuser supplied system prompt")
  })

  it("round-trips through buildSystem", () => {
    const text = [
      BASE,
      block("/a/AGENTS.md", "alpha"),
      block("/a/b/CLAUDE.md", "beta\n\nwith blank line"),
    ].join("\n")
    const parsed = parseSystem(text)
    expect(buildSystem(parsed.base, parsed.blocks)).toBe(text)
  })
})
