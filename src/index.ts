import { existsSync, readFileSync } from "node:fs"
import { transformSystem } from "./cascade"

/**
 * Minimal structural types for the OpenCode plugin contract, so the plugin
 * ships with zero dependencies. Verified against @opencode-ai/plugin:
 * the host passes more fields than declared here; extras are ignored.
 */
interface PluginInput {
  directory: string
  worktree: string
}

interface SystemTransformInput {
  sessionID?: string
  model: unknown
}

interface SystemTransformOutput {
  system: string[]
}

type Hooks = {
  "experimental.chat.system.transform": (
    input: SystemTransformInput,
    output: SystemTransformOutput,
  ) => Promise<void>
}

function readOrUndefined(p: string): string | undefined {
  try {
    return readFileSync(p, "utf8")
  } catch {
    return undefined
  }
}

export const AgentsCascadePlugin = async ({ directory, worktree }: PluginInput): Promise<Hooks> => {
  return {
    "experimental.chat.system.transform": async (input, output) => {
      try {
        transformSystem({
          system: output.system,
          directory,
          worktree,
          sessionID: input?.sessionID,
          exists: existsSync,
          read: readOrUndefined,
        })
      } catch {
        // A broken system prompt is worse than a missing cascade — never
        // let an injection failure take down the chat request.
      }
    },
  }
}
