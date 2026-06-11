import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { INSTRUCTION_HEADER, parseSystem } from "../src/cascade"
import { AgentsCascadePlugin } from "../src/index"

const block = (p: string, content: string) => `${INSTRUCTION_HEADER}${p}\n${content}`

describe("AgentsCascadePlugin (hook against a real filesystem)", () => {
  let root: string
  let worktree: string
  let directory: string

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "cascade-plugin-"))
    worktree = path.join(root, "mid", "work")
    directory = path.join(worktree, "sub")
    mkdirSync(directory, { recursive: true })
    writeFileSync(path.join(root, "AGENTS.md"), "root marker")
    writeFileSync(path.join(root, "mid", "CLAUDE.md"), "mid marker")
    writeFileSync(path.join(worktree, "AGENTS.md"), "work marker")
    writeFileSync(path.join(directory, "AGENTS.md"), "sub marker")
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("registers the experimental system transform hook", async () => {
    const hooks = await AgentsCascadePlugin({ directory, worktree })
    expect(typeof hooks["experimental.chat.system.transform"]).toBe("function")
  })

  it("injects real ancestor files and reorders the chain", async () => {
    const hooks = await AgentsCascadePlugin({ directory, worktree })
    const globalPath = path.join(root, "cfg", "AGENTS.md")
    const output = {
      system: [
        [
          "base prompt",
          block(globalPath, "global marker"),
          block(path.join(directory, "AGENTS.md"), "sub marker"),
          block(path.join(worktree, "AGENTS.md"), "work marker"),
        ].join("\n"),
      ],
    }

    await hooks["experimental.chat.system.transform"]({ sessionID: "ses_1", model: {} }, output)

    const paths = parseSystem(output.system[0] ?? "").blocks.map((b) => b.path)
    // The walk also covers real directories above the temp root; assert the
    // expected paths appear as an ordered subsequence to stay hermetic.
    const expected = [
      globalPath,
      path.join(root, "AGENTS.md"),
      path.join(root, "mid", "CLAUDE.md"),
      path.join(worktree, "AGENTS.md"),
      path.join(directory, "AGENTS.md"),
    ]
    const indexes = expected.map((p) => paths.indexOf(p))
    expect(indexes).not.toContain(-1)
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes)
    expect(parseSystem(output.system[0] ?? "").base).toBe("base prompt")
  })

  it("is a no-op for non-git projects", async () => {
    const hooks = await AgentsCascadePlugin({ directory: root, worktree: "/" })
    const before = ["base prompt", block(path.join(root, "AGENTS.md"), "root marker")].join("\n")
    const output = { system: [before] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "ses_1", model: {} }, output)
    expect(output.system[0]).toBe(before)
  })

  it("never throws, even on a malformed output object", async () => {
    const hooks = await AgentsCascadePlugin({ directory, worktree })
    const malformed = { system: [null as unknown as string] }
    await hooks["experimental.chat.system.transform"]({ model: {} }, malformed)
    expect(malformed.system[0]).toBeNull()
  })
})
