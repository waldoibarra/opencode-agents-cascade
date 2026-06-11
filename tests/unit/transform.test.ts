import { describe, expect, it } from "bun:test"
import {
  INSTRUCTION_HEADER,
  extractTrailingText,
  parseSystem,
  transformSystem,
} from "../../src/cascade"

const BASE = "You are opencode.\nBase prompt second line."
const block = (path: string, content: string) => `${INSTRUCTION_HEADER}${path}\n${content}`

/** Fake filesystem: map of absolute path → content. */
function fakeFs(files: Record<string, string>) {
  return {
    exists: (p: string) => p in files,
    read: (p: string) => files[p],
  }
}

function headerPaths(system0: string | undefined): string[] {
  return parseSystem(system0 ?? "").blocks.map((b) => b.path)
}

describe("transformSystem — PRD example end-to-end", () => {
  const directory = "/Users/me/projects/my-repo/sub-project"
  const worktree = "/Users/me/projects"
  const fs = fakeFs({
    "/Users/AGENTS.md": "users level",
    "/Users/me/AGENTS.md": "home level",
  })

  // Native OpenCode order: global first, then cwd → worktree root (inverted).
  const nativeSystem = [
    BASE,
    block("/Users/me/.config/opencode/AGENTS.md", "global"),
    block("/Users/me/projects/my-repo/sub-project/AGENTS.md", "sub"),
    block("/Users/me/projects/my-repo/AGENTS.md", "repo"),
    block("/Users/me/projects/AGENTS.md", "projects"),
  ].join("\n")

  it("injects ancestors and reorders everything outermost-first", () => {
    const system = [nativeSystem]
    transformSystem({ system, directory, worktree, sessionID: "ses_1", ...fs })
    expect(headerPaths(system[0])).toEqual([
      "/Users/me/.config/opencode/AGENTS.md",
      "/Users/AGENTS.md",
      "/Users/me/AGENTS.md",
      "/Users/me/projects/AGENTS.md",
      "/Users/me/projects/my-repo/AGENTS.md",
      "/Users/me/projects/my-repo/sub-project/AGENTS.md",
    ])
  })

  it("preserves the base prompt and every block's content", () => {
    const system = [nativeSystem]
    transformSystem({ system, directory, worktree, sessionID: "ses_1", ...fs })
    const parsed = parseSystem(system[0] ?? "")
    expect(parsed.base).toBe(BASE)
    expect(parsed.blocks.map((b) => b.content)).toEqual([
      "global",
      "users level",
      "home level",
      "projects",
      "repo",
      "sub",
    ])
  })

  it("is idempotent: running twice yields the same result", () => {
    const system = [nativeSystem]
    transformSystem({ system, directory, worktree, sessionID: "ses_1", ...fs })
    const once = system[0]
    transformSystem({ system, directory, worktree, sessionID: "ses_1", ...fs })
    expect(system[0]).toBe(once)
  })

  it("produces the same final order regardless of which nested repo is the worktree", () => {
    // Same tree, but git resolved the innermost repo as the worktree:
    // natively only the cwd file is loaded, everything else is injected.
    const innerSystem = [
      BASE,
      block("/Users/me/.config/opencode/AGENTS.md", "global"),
      block("/Users/me/projects/my-repo/sub-project/AGENTS.md", "sub"),
    ].join("\n")
    const innerFs = fakeFs({
      "/Users/AGENTS.md": "users level",
      "/Users/me/AGENTS.md": "home level",
      "/Users/me/projects/AGENTS.md": "projects",
      "/Users/me/projects/my-repo/AGENTS.md": "repo",
    })
    const system = [innerSystem]
    transformSystem({ system, directory, worktree: directory, sessionID: "ses_1", ...innerFs })
    expect(headerPaths(system[0])).toEqual([
      "/Users/me/.config/opencode/AGENTS.md",
      "/Users/AGENTS.md",
      "/Users/me/AGENTS.md",
      "/Users/me/projects/AGENTS.md",
      "/Users/me/projects/my-repo/AGENTS.md",
      "/Users/me/projects/my-repo/sub-project/AGENTS.md",
    ])
  })
})

describe("transformSystem — no-op guards", () => {
  const fs = fakeFs({ "/Users/AGENTS.md": "users level" })

  it("does nothing for non-git projects (worktree sentinel '/')", () => {
    const system = [`${BASE}\n${block("/Users/me/AGENTS.md", "x")}`]
    const before = system[0]
    transformSystem({ system, directory: "/Users/me", worktree: "/", sessionID: "s", ...fs })
    expect(system[0]).toBe(before)
  })

  it("does nothing for an empty worktree", () => {
    const system = [BASE]
    transformSystem({ system, directory: "/Users/me", worktree: "", sessionID: "s", ...fs })
    expect(system[0]).toBe(BASE)
  })

  it("does nothing for an empty system array", () => {
    const system: string[] = []
    transformSystem({ system, directory: "/Users/me/p", worktree: "/Users/me/p", ...fs })
    expect(system).toEqual([])
  })

  it("does nothing when nothing is injectable and only one block exists", () => {
    const system = [`${BASE}\n${block("/a/b/AGENTS.md", "x")}`]
    const before = system[0]
    transformSystem({
      system,
      directory: "/a/b",
      worktree: "/a/b",
      sessionID: "s",
      ...fakeFs({}),
    })
    expect(system[0]).toBe(before)
  })

  it("ignores internal prompts without blocks or sessionID (agent generation)", () => {
    const system = ["Generate an agent definition."]
    transformSystem({ system, directory: "/Users/me/p", worktree: "/Users/me/p", ...fs })
    expect(system[0]).toBe("Generate an agent definition.")
  })
})

describe("transformSystem — fallback append (no parseable blocks)", () => {
  const fs = fakeFs({ "/Users/AGENTS.md": "users level" })

  it("appends without reordering when the session has no native blocks", () => {
    const system = [BASE]
    transformSystem({
      system,
      directory: "/Users/me/p",
      worktree: "/Users/me/p",
      sessionID: "ses_1",
      exists: (p) => p === "/Users/AGENTS.md" || p === "/Users/me/AGENTS.md",
      read: (p) => (p === "/Users/AGENTS.md" ? "users level" : "home level"),
    })
    expect(system[0]).toBe(
      [BASE, block("/Users/AGENTS.md", "users level"), block("/Users/me/AGENTS.md", "home level")]
        .join("\n"),
    )
  })

  it("leaves the prompt alone when there is nothing to inject either", () => {
    const system = [BASE]
    transformSystem({
      system,
      directory: "/a/b",
      worktree: "/a/b",
      sessionID: "ses_1",
      ...fakeFs({}),
    })
    expect(system[0]).toBe(BASE)
  })
})

describe("extractTrailingText", () => {
  const read = (files: Record<string, string>) => (p: string) => files[p]

  it("splits appended text off the last block when the file matches", () => {
    const blocks = [
      { path: "/a/AGENTS.md", content: "alpha" },
      { path: "/a/b/AGENTS.md", content: "beta\ncustom system prompt\nsecond line" },
    ]
    const result = extractTrailingText(blocks, read({ "/a/b/AGENTS.md": "beta" }))
    expect(result.trailing).toBe("custom system prompt\nsecond line")
    expect(result.blocks).toEqual([
      { path: "/a/AGENTS.md", content: "alpha" },
      { path: "/a/b/AGENTS.md", content: "beta" },
    ])
  })

  it("returns no trailing text when the block equals the file exactly", () => {
    const blocks = [{ path: "/a/AGENTS.md", content: "alpha" }]
    const result = extractTrailingText(blocks, read({ "/a/AGENTS.md": "alpha" }))
    expect(result.trailing).toBe("")
    expect(result.blocks).toEqual(blocks)
  })

  it("does not split when the file changed since OpenCode read it", () => {
    const blocks = [{ path: "/a/AGENTS.md", content: "alpha\ntrailing" }]
    const result = extractTrailingText(blocks, read({ "/a/AGENTS.md": "different now" }))
    expect(result.trailing).toBe("")
    expect(result.blocks).toEqual(blocks)
  })

  it("does not split mid-line when content merely starts with the file text", () => {
    const blocks = [{ path: "/a/AGENTS.md", content: "alphabet soup" }]
    const result = extractTrailingText(blocks, read({ "/a/AGENTS.md": "alpha" }))
    expect(result.trailing).toBe("")
    expect(result.blocks).toEqual(blocks)
  })

  it("never attempts to split URL blocks or unreadable files", () => {
    const urlBlocks = [{ path: "https://example.com/r.md", content: "remote\ntrailing" }]
    expect(extractTrailingText(urlBlocks, read({})).trailing).toBe("")
    const fileBlocks = [{ path: "/a/AGENTS.md", content: "alpha\ntrailing" }]
    expect(extractTrailingText(fileBlocks, read({})).trailing).toBe("")
  })

  it("handles empty input", () => {
    expect(extractTrailingText([], read({}))).toEqual({ blocks: [], trailing: "" })
  })
})

describe("transformSystem — custom system text stays last", () => {
  const directory = "/Users/me/projects/repo"
  const worktree = "/Users/me/projects/repo"
  const userSystem = "Always answer in haiku.\nNo exceptions."

  it("keeps per-prompt system text at the end across reordering", () => {
    // Native order: global, cwd file, worktree-root file, then the
    // custom system text glued onto the last block by the \n join.
    const system = [
      [
        BASE,
        block("/Users/me/.config/opencode/AGENTS.md", "global"),
        block(`${directory}/sub/AGENTS.md`, "inner"),
        block(`${directory}/AGENTS.md`, `outer\n${userSystem}`),
      ].join("\n"),
    ]
    transformSystem({
      system,
      directory: `${directory}/sub`,
      worktree,
      sessionID: "s",
      ...fakeFs({
        "/Users/me/AGENTS.md": "home",
        [`${directory}/AGENTS.md`]: "outer",
        [`${directory}/sub/AGENTS.md`]: "inner",
      }),
    })
    expect(system[0]).toBe(
      [
        BASE,
        block("/Users/me/.config/opencode/AGENTS.md", "global"),
        block("/Users/me/AGENTS.md", "home"),
        block(`${directory}/AGENTS.md`, "outer"),
        block(`${directory}/sub/AGENTS.md`, "inner"),
        userSystem,
      ].join("\n"),
    )
  })

  it("is idempotent with trailing text present", () => {
    const system = [
      [BASE, block(`${directory}/AGENTS.md`, `outer\n${userSystem}`)].join("\n"),
    ]
    const fs = fakeFs({
      "/Users/me/AGENTS.md": "home",
      [`${directory}/AGENTS.md`]: "outer",
    })
    transformSystem({ system, directory, worktree, sessionID: "s", ...fs })
    const once = system[0]
    transformSystem({ system, directory, worktree, sessionID: "s", ...fs })
    expect(system[0]).toBe(once)
    expect(once?.endsWith(userSystem)).toBe(true)
  })
})

describe("transformSystem — robustness", () => {
  const directory = "/Users/me/projects/repo"
  const worktree = "/Users/me/projects/repo"

  it("deduplicates files already present in the native blocks", () => {
    const system = [
      [BASE, block("/Users/me/AGENTS.md", "already loaded somehow")].join("\n"),
    ]
    transformSystem({
      system,
      directory,
      worktree,
      sessionID: "s",
      ...fakeFs({ "/Users/me/AGENTS.md": "fresh read" }),
    })
    const parsed = parseSystem(system[0] ?? "")
    expect(parsed.blocks).toEqual([
      { path: "/Users/me/AGENTS.md", content: "already loaded somehow" },
    ])
  })

  it("skips empty and unreadable ancestor files", () => {
    const system = [[BASE, block(`${worktree}/AGENTS.md`, "repo")].join("\n")]
    transformSystem({
      system,
      directory,
      worktree,
      sessionID: "s",
      exists: (p) => p === "/Users/AGENTS.md" || p === "/Users/me/AGENTS.md",
      read: (p) => (p === "/Users/AGENTS.md" ? "" : undefined),
    })
    expect(headerPaths(system[0])).toEqual([`${worktree}/AGENTS.md`])
  })

  it("keeps URL and custom-instruction blocks ahead of the sorted chain", () => {
    const system = [
      [
        BASE,
        block("/Users/me/.config/opencode/AGENTS.md", "global"),
        block(`${directory}/AGENTS.md`, "repo"),
        block("https://example.com/rules.md", "remote"),
        block("/Users/me/custom/notes.md", "custom"),
      ].join("\n"),
    ]
    transformSystem({
      system,
      directory,
      worktree,
      sessionID: "s",
      ...fakeFs({ "/Users/me/AGENTS.md": "home" }),
    })
    expect(headerPaths(system[0])).toEqual([
      "/Users/me/.config/opencode/AGENTS.md",
      "https://example.com/rules.md",
      "/Users/me/custom/notes.md",
      "/Users/me/AGENTS.md",
      `${directory}/AGENTS.md`,
    ])
  })

  it("reorders inverted native blocks even when nothing is injected", () => {
    const system = [
      [
        BASE,
        block(`${directory}/sub/inner/AGENTS.md`, "inner"),
        block(`${directory}/sub/AGENTS.md`, "mid"),
        block(`${directory}/AGENTS.md`, "outer"),
      ].join("\n"),
    ]
    transformSystem({
      system,
      directory: `${directory}/sub/inner`,
      worktree,
      sessionID: "s",
      ...fakeFs({}),
    })
    expect(headerPaths(system[0])).toEqual([
      `${directory}/AGENTS.md`,
      `${directory}/sub/AGENTS.md`,
      `${directory}/sub/inner/AGENTS.md`,
    ])
  })

  it("mutates system[0] in place and never changes the array length", () => {
    const system = [[BASE, block(`${directory}/AGENTS.md`, "repo")].join("\n"), "extra entry"]
    transformSystem({
      system,
      directory,
      worktree,
      sessionID: "s",
      ...fakeFs({ "/Users/AGENTS.md": "users" }),
    })
    expect(system).toHaveLength(2)
    expect(system[1]).toBe("extra entry")
    expect(headerPaths(system[0])).toEqual(["/Users/AGENTS.md", `${directory}/AGENTS.md`])
  })
})
