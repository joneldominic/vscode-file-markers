---
description: Fetch all comments from a PR for review and resolution planning
---

# Get PR Comments

You are tasked with fetching all comments from a pull request and presenting them in a structured format for review and resolution planning.

## Process:

1. **Identify the PR:**
   - Get the current branch: `git branch --show-current`
   - Check if on main/master branch - if so, ask the user which PR to fetch comments from
   - Check for an associated PR: `gh pr view --json number,url,title,state 2>/dev/null`
   - If no PR exists for the current branch, list open PRs: `gh pr list --limit 10 --json number,title,headRefName,author`
   - Ask the user which PR to get comments from

2. **Get repository information:**
   - Get the repo owner and name: `gh repo view --json owner,name --jq '.owner.login + "/" + .name'`

3. **Fetch all comment types:**

   **a) PR-level conversation comments:**
   ```bash
   gh pr view {number} --json comments --jq '.comments[] | "### PR Comment by \(.author.login) (\(.createdAt))\n\n\(.body)\n"'
   ```

   **b) Review body comments (the main review message):**
   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/reviews --jq '.[] | select(.body != "") | "### Review by \(.user.login) [\(.state)] (\(.submitted_at))\n\n\(.body)\n"'
   ```

   **c) Inline code review comments:**
   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[] | "### Code Comment by \(.user.login) (\(.created_at))\n**File:** \(.path):\(.line // .original_line)\n\n```\n\(.diff_hunk)\n```\n\n**Comment:**\n\(.body)\n\n---\n"'
   ```

4. **Present the comments in a structured format:**

   ```
   # PR #{number}: {title}

   ## Summary
   - Total PR comments: X
   - Total reviews: Y
   - Total inline comments: Z

   ## PR Conversation Comments
   [List all PR-level comments]

   ## Reviews
   [List all review body comments with their state: APPROVED, CHANGES_REQUESTED, COMMENTED]

   ## Inline Code Comments (Action Items)
   [List all inline comments grouped by file, with file path, line number, and the comment]
   ```

5. **Highlight actionable items:**
   - Flag any "CHANGES_REQUESTED" reviews prominently
   - Group inline comments by file for easier resolution
   - Note which comments might be resolved vs still pending

## Important notes:

- Focus on CHANGES_REQUESTED reviews and inline comments as primary action items
- Inline comments are the most important for code fixes - always include file paths and line numbers
- If `gh api` commands fail, check if the user needs to run `gh auth login` or `gh repo set-default`
- Some comments may reference outdated code if the PR has been updated since the review

## Output format suggestion:

After presenting the comments, suggest:
```
To resolve these comments, you can:
1. Run `/create_plan` with the comments above to plan fixes
2. Or address them directly if they're straightforward
```
