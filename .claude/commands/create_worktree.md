---
description: Create worktree and launch Claude session for a new feature/task
---

# Create Worktree for Feature Development

This command creates a git worktree and launches a Claude session. Use this BEFORE research/planning - you'll create plans IN the worktree.

## Step 1: Ask for Branch Name

Ask the user directly:

```
What branch name should I use for the worktree?

(Examples: `feat/add-auth`, `fix/login-bug`, or just describe and I'll generate one)
```

If user provides a description instead of a branch name, generate an appropriate branch name like `feat/{kebab-case-description}` or `fix/{kebab-case-description}`.

## Step 2: Execute Commands

Once you have the branch name, immediately execute:

```bash
# Fetch latest from origin
git fetch origin

# Create worktree with new branch based on origin/main
git worktree add "../$(basename $(pwd)).worktree/{BRANCH_NAME}" -b {BRANCH_NAME} origin/main
```

## Step 3: Show Results and Next Steps

After worktree is created successfully, show:

```
Worktree created at: ../{REPO_NAME}.worktree/{BRANCH_NAME}

**To start working, run in a new terminal:**

cd "../{REPO_NAME}.worktree/{BRANCH_NAME}" && claude --model opus

**Workflow in the worktree:**
1. `/research_codebase` - Understand relevant code
2. `/create_plan` - Create implementation plan
3. `/implement_plan thoughts/shared/plans/your-plan.md` - Build it
4. `/commit` - Commit changes
5. Create PR

**Cleanup after merge:**
git worktree remove "../{REPO_NAME}.worktree/{BRANCH_NAME}"
```

## Notes

- Uncommitted changes in current repo are NOT affected
- The `thoughts/` directory is synced between repos
- To abandon work, just remove the worktree
