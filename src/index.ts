import { existsSync, readFileSync } from "node:fs"
import { transformSystem } from "./cascade"

/**
 * Minimal structural types for the OpenCode plugin contract, so the plugin
 * declares no runtime dependencies. The host contract is experimental;
 * extra input fields are ignored by this implementation.
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
        // Ignore transform errors so this hook does not reject the request.
        // Any mutation made before an error remains in output.system.
      }
    },
  }
}
