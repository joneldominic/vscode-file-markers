# Fix Publish Workflow Trigger - Implementation Plan

## Overview

The publish workflow (`publish.yml`) is not triggered after release-please creates a release because `GITHUB_TOKEN` cannot trigger other workflows (GitHub security feature). We'll fix this by using a Personal Access Token (PAT) instead.

## Current State Analysis

**Current flow (broken):**
1. PR merged to `main` → release-please runs
2. release-please creates a GitHub release using `GITHUB_TOKEN`
3. `publish.yml` should trigger on `release: [published]` but **doesn't** because `GITHUB_TOKEN` events don't trigger workflows

**Desired flow:**
1. PR merged to `main` → release-please runs
2. release-please creates a GitHub release using **PAT**
3. `publish.yml` triggers on `release: [published]` ✓

## What We're NOT Doing

- Not using GitHub App tokens (overkill for this project)
- Not using workflow_dispatch approach
- Not changing the publish workflow trigger mechanism

## Implementation Approach

Use a Fine-grained Personal Access Token (more secure than classic PAT) with minimal required permissions.

---

## Phase 1: Create and Configure PAT

### Overview

Create a fine-grained PAT and add it as a repository secret.

### Steps Required:

#### 1. Create Fine-grained PAT

Go to: https://github.com/settings/personal-access-tokens/new

**Settings:**
- **Token name**: `RELEASE_PLEASE_TOKEN` (or similar)
- **Expiration**: 90 days (or custom, you'll need to rotate)
- **Repository access**: Select "Only select repositories" → choose `vscode-file-markers`
- **Permissions** (Repository permissions):
  - `Contents`: Read and write (to create releases and tags)
  - `Pull requests`: Read and write (to create/update release PRs)
  - `Metadata`: Read-only (automatically selected)

Click "Generate token" and **copy the token immediately**.

#### 2. Add Secret to Repository

Go to: https://github.com/joneldominic/vscode-file-markers/settings/secrets/actions/new

- **Name**: `RELEASE_PAT`
- **Secret**: Paste the token you copied

### Success Criteria:

#### Manual Verification:
- [ ] PAT created at GitHub with correct permissions
- [ ] Secret `RELEASE_PAT` added to repository secrets

---

## Phase 2: Update release-please.yml

### Overview

Modify the release-please workflow to use the PAT instead of GITHUB_TOKEN.

### Changes Required:

#### 1. Update release-please.yml

**File**: `.github/workflows/release-please.yml`
**Changes**: Replace `GITHUB_TOKEN` with the PAT secret

```yaml
name: Release Please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - name: Release Please
        uses: googleapis/release-please-action@v4
        with:
          target-branch: main
          token: ${{ secrets.RELEASE_PAT }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

**Key change**: Line 19 changes from:
```yaml
token: ${{ secrets.GITHUB_TOKEN }}
```
to:
```yaml
token: ${{ secrets.RELEASE_PAT }}
```

### Success Criteria:

#### Automated Verification:
- [ ] `release-please.yml` syntax is valid (GitHub will validate on push)

#### Manual Verification:
- [ ] Commit and push the change to a branch
- [ ] Merge to main
- [ ] Verify release-please creates a release PR (if there are releasable commits)
- [ ] When release PR is merged, verify publish workflow triggers

---

## Phase 3: Verify End-to-End

### Overview

Test the complete flow to ensure publish workflow triggers correctly.

### Test Steps:

1. Merge PR #24 (fix: add comprehensive test coverage) to main
2. Wait for release-please to run and create a release PR
3. Merge the release PR
4. **Verify**: publish.yml workflow should trigger automatically
5. **Verify**: Extension should be published to VS Code Marketplace and OpenVSX

### Success Criteria:

#### Manual Verification:
- [ ] Release-please creates release PR after merge to main
- [ ] Merging release PR creates a GitHub release
- [ ] Publish workflow triggers on release creation
- [ ] Extension published to VS Code Marketplace
- [ ] Extension published to OpenVSX

---

## Security Notes

- Fine-grained PAT is scoped to only this repository
- PAT has minimal required permissions
- Token will expire (set reminder to rotate before expiration)
- Never commit the PAT value to the repository

## References

- [GitHub: Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)
- [release-please-action: Using a PAT](https://github.com/googleapis/release-please-action#github-credentials)
- [GitHub Community Discussion #25281](https://github.com/orgs/community/discussions/25281)
