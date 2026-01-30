---
description: Generate comprehensive PR descriptions following repository templates (no thoughts directory)
---

# Generate PR Description

You are tasked with generating a comprehensive pull request description following the repository's standard template.

## Steps to follow:

1. **Read the PR description template:**

    - Use the following PR description template: @.github/PULL_REQUEST_TEMPLATE.md
    - Read the template carefully to understand all sections and requirements

2. **Identify the PR to describe:**
   - Get the current branch name: `git branch --show-current`
   - Check if on main/master branch - if so, list open PRs: `gh pr list --limit 10 --json number,title,headRefName,author` and ask user which to describe
   - Check if the current branch has an associated PR: `gh pr view --json url,number,title,state 2>/dev/null`
   - If a PR exists, proceed to step 3 with that PR
   - **If no PR exists for the current branch:**
     - Check if there are unpushed commits: `git log origin/{branch}..HEAD --oneline 2>/dev/null`
     - Check the diff against the base branch: `git diff main...HEAD --stat` (or appropriate base)
     - Present the user with options:
       1. **Create a new PR** for the current branch (recommended if there are changes)
       2. **Describe an existing PR** from the list of open PRs
     - If user chooses to create a new PR:
       - Push the branch if not already pushed: `git push -u origin {branch}`
       - Generate the PR description following steps 4-7 first
       - Create the PR: `gh pr create --title "{title}" --body-file /tmp/{repo_name}/prs/{branch}_description.md`
       - Use a sensible title derived from the branch name or commit messages
       - After creation, continue to step 9 to confirm success

3. **Check for existing description:**
   - For existing PRs: Check if `/tmp/{repo_name}/prs/{number}_description.md` already exists
   - For new PRs being created: Check if `/tmp/{repo_name}/prs/{branch}_description.md` exists
   - If it exists, read it and inform the user you'll be updating it
   - Consider what has changed since the last description was written

4. **Gather comprehensive PR information:**
   - **For existing PRs:**
     - Get the full PR diff: `gh pr diff {number}`
     - If you get an error about no default remote repository, instruct the user to run `gh repo set-default` and select the appropriate repository
     - Get commit history: `gh pr view {number} --json commits`
     - Review the base branch: `gh pr view {number} --json baseRefName`
     - Get PR metadata: `gh pr view {number} --json url,title,number,state`
   - **For new PRs (branch without PR):**
     - Get the diff against main/base branch: `git diff main...HEAD` (adjust base as needed)
     - Get commit history: `git log main..HEAD --oneline`
     - Determine appropriate base branch (usually main)

5. **Analyze the changes thoroughly:** (ultrathink about the code changes, their architectural implications, and potential impacts)
   - Read through the entire diff carefully
   - For context, read any files that are referenced but not shown in the diff
   - Understand the purpose and impact of each change
   - Identify user-facing changes vs internal implementation details
   - Look for breaking changes or migration requirements

6. **Handle verification requirements:**
   - Look for any checklist items in the "How to verify it" section of the template
   - For each verification step:
     - If it's a command you can run (like `pnpm run check`, `pnpm run test`, etc.), run it
     - If it passes, mark the checkbox as checked: `- [x]`
     - If it fails, keep it unchecked and note what failed: `- [ ]` with explanation
     - If it requires manual testing (UI interactions, external services), leave unchecked and note for user
   - Document any verification steps you couldn't complete

7. **Generate the description:**
   - Fill out each section from the template thoroughly:
     - Answer each question/section based on your analysis
     - Be specific about problems solved and changes made
     - Focus on user impact where relevant
     - Include technical details in appropriate sections
     - Write a concise changelog entry
   - Ensure all checklist items are addressed (checked or explained)

8. **Save and sync the description:**
   - For existing PRs: Write to `/tmp/{repo_name}/prs/{number}_description.md`
   - For new PRs: Write to `/tmp/{repo_name}/prs/{branch}_description.md`
   - Show the user the generated description

9. **Create or update the PR:**
   - **For existing PRs:**
     - Update the PR description: `gh pr edit {number} --body-file /tmp/{repo_name}/prs/{number}_description.md`
     - Confirm the update was successful
   - **For new PRs:**
     - Ensure the branch is pushed: `git push -u origin {branch}` (if needed)
     - Derive a PR title from the branch name or first commit message
       - Convert branch names like `feat/add-user-auth` to `feat(user): add user auth`
       - Or use the first commit message if it follows conventional commit format
     - Create the PR: `gh pr create --title "{title}" --body-file /tmp/{repo_name}/prs/{branch}_description.md --base main`
     - After creation, rename the description file to use the PR number: `mv /tmp/{repo_name}/prs/{branch}_description.md /tmp/{repo_name}/prs/{number}_description.md`
     - Confirm the PR was created successfully and provide the URL
   - If any verification steps remain unchecked, remind the user to complete them before merging

## Important notes:
- This command works across different repositories - always read the local template
- Be thorough but concise - descriptions should be scannable
- Focus on the "why" as much as the "what"
- Include any breaking changes or migration notes prominently
- If the PR touches multiple components, organize the description accordingly
- Always attempt to run verification commands when possible
- Clearly communicate which verification steps need manual testing
- When creating new PRs, always give the user a chance to review and adjust the title before creation
- For branch names following conventional patterns (e.g., `feat/`, `fix/`, `chore/`), use those to derive the PR title