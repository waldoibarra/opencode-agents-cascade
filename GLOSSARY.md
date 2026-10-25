# Ancestor instruction terminology

Terms for the plugin's instruction-file ordering and injection behavior.

## Language

**Instruction file**:
An `AGENTS.md` or `CLAUDE.md` file containing directory-specific guidance.

**Ancestor directory**:
A directory on the path from a project toward the filesystem root.

**Worktree root**:
The git worktree boundary used to distinguish native instruction loading from files above it.

**Instruction block**:
A section of the merged system prompt introduced by an `Instructions from:` header.

**Ancestor chain**:
Instruction blocks belonging to directories on the path from the filesystem root to the current directory.

**Non-chain block**:
An instruction block outside that path, such as a global configuration or remote instruction.
