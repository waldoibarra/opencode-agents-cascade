import { describe, expect, it } from "bun:test"
import { buildSystem, parseSystem } from "../../src/cascade"

describe("buildSystem", () => {
  it("returns just the base when there are no blocks", () => {
    expect(buildSystem("base prompt", [])).toBe("base prompt")
  })

  it("joins base and blocks with single newlines, matching the native format", () => {
    const out = buildSystem("base", [
      { path: "/a/AGENTS.md", content: "alpha" },
      { path: "/a/b/AGENTS.md", content: "beta" },
    ])
    expect(out).toBe(
      "base\nInstructions from: /a/AGENTS.md\nalpha\nInstructions from: /a/b/AGENTS.md\nbeta",
    )
  })

  it("omits an empty base without emitting a leading newline", () => {
    const out = buildSystem("", [{ path: "/a/AGENTS.md", content: "alpha" }])
    expect(out).toBe("Instructions from: /a/AGENTS.md\nalpha")
  })

  it("round-trips: parse(build(x)) preserves base and blocks", () => {
    const cases = [
      { base: "base\nmultiline", blocks: [{ path: "/a/AGENTS.md", content: "alpha" }] },
      { base: "", blocks: [{ path: "/a/AGENTS.md", content: "a\n\nb" }] },
      {
        base: "b",
        blocks: [
          { path: "/x/CLAUDE.md", content: "" },
          { path: "/x/y/AGENTS.md", content: "deep" },
          { path: "https://example.com/r.md", content: "remote" },
        ],
      },
      { base: "only base, no blocks", blocks: [] },
    ]
    for (const { base, blocks } of cases) {
      const parsed = parseSystem(buildSystem(base, blocks))
      expect(parsed.base).toBe(base)
      expect(parsed.blocks).toEqual(blocks)
    }
  })
})
