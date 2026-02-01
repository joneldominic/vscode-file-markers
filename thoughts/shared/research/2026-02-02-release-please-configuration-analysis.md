---
date: 2026-02-02T08:00:00+08:00
researcher: Claude
git_commit: 41b426e3484443754dcf1631dd96b03689776100
branch: release-please--branches--develop--components--file-markers
repository: joneldominic/vscode-file-markers
topic: "Release-Please Configuration Analysis - Duplicate PRs and Skipped Publish"
tags: [research, release-please, ci-cd, github-actions]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Release-Please Configuration Analysis

**Date**: 2026-02-02T08:00:00+08:00
**Researcher**: Claude
**Git Commit**: 41b426e3484443754dcf1631dd96b03689776100
**Branch**: release-please--branches--develop--components--file-markers
**Repository**: joneldominic/vscode-file-markers

## Research Question

Why does release-please create another PR immediately after merging a release PR, and why is the publish job being skipped?

## Summary

The repository has a **branch mismatch** between the GitHub default branch setting and the release-please workflow configuration:

1. **GitHub default branch**: `develop`
2. **Workflow triggers on**: `main`
3. **Release-please auto-detects target**: `develop` (from GitHub default)

This creates a circular situation where:
- Merging a PR to `main` triggers the workflow
- Release-please reads from `develop` (default branch) and creates PRs targeting `develop`
- This causes duplicate PRs and prevents releases from being created

The publish job is skipped because `release_created` is only `true` when an actual GitHub release is created, not when a release PR is opened/updated.

## Detailed Findings

### Issue 1: Duplicate PRs After Merge

**Observed Behavior:**
- PR #16 (`chore(develop): release file-markers 1.4.0`) was merged to `main`
- Immediately after, PR #17 with the same title was created targeting `develop`

**Root Cause:**
The `googleapis/release-please-action@v4` auto-detects the target branch when not explicitly specified. From the workflow logs:

```
Fetching release-please-config.json from branch develop
targetBranch: develop
```

The action uses the repository's default branch (`develop`) rather than the branch that triggered the workflow (`main`).

**Relevant Code:**
- `.github/workflows/release-please.yml:21`: Uses `googleapis/release-please-action@v4` without `target-branch` input
- `release-please-config.json:4`: Has `"target-branch": "main"` but this is a CLI option, not respected by the action

**Evidence from Workflow Run #21568605632:**
```
Successfully opened pull request: 17.
Successfully added labels autorelease: pending to issue: 17
```

### Issue 2: Publish Job Skipped

**Observed Behavior:**
The publish job shows as "skipped" with a grey circle icon, meaning the conditional was not met.

**Root Cause:**
The publish job has this condition:
```yaml
if: ${{ needs.release-please.outputs.release_created == 'true' }}
```

`release_created` is only `true` when release-please **creates a GitHub release**, which happens only when:
1. A release PR is **merged** (not just created)
2. The merge happens to the **target branch** that release-please is tracking
3. Release-please recognizes the merge as a release commit

Since release-please is tracking `develop` but PRs are being merged to `main`, no release is ever created.

**Job Status from Run #21568605632:**
```json
{"name": "release-please", "conclusion": "success"}
{"name": "publish", "conclusion": "skipped"}
```

### Configuration Files

**`.github/workflows/release-please.yml`:**
```yaml
on:
  push:
    branches:
      - main  # Workflow triggers on main

jobs:
  release-please:
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          # NO target-branch specified - auto-detects to default branch
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

  publish:
    if: ${{ needs.release-please.outputs.release_created == 'true' }}
    # Never runs because release_created is never true
```

**`release-please-config.json`:**
```json
{
  "target-branch": "main",  // This is a CLI option, not used by the action
  "packages": {
    ".": {
      "release-type": "node",
      "package-name": "file-markers"
    }
  }
}
```

**Repository Settings:**
```json
{"defaultBranchRef": {"name": "develop"}}
```

### How Release-Please Should Work

According to the official documentation:

1. **Workflow triggers** on push to the target branch
2. **Release-please action** runs and either:
   - Creates/updates a release PR if there are new conventional commits
   - Creates a GitHub release + tag if the release PR was just merged
3. **`release_created` output** is `true` only when a GitHub release is created
4. **Publish job** runs conditionally when `release_created == 'true'`

The correct flow:
```
Push to main → Release-please creates PR → PR merged to main → Push triggers workflow again → release_created=true → Publish runs
```

Current broken flow:
```
Push to main → Release-please creates PR to develop → PR merged to main (wrong branch) → Push triggers workflow → Creates another PR to develop → release_created=false → Publish skipped
```

## Code References

- `.github/workflows/release-please.yml:5-6` - Workflow triggers on push to `main`
- `.github/workflows/release-please.yml:21-25` - Release-please action configuration without `target-branch`
- `.github/workflows/release-please.yml:29` - Publish job condition checking `release_created`
- `release-please-config.json:4` - Config has `target-branch: main` (not used by action)
- `.release-please-manifest.json:2` - Current version tracked as `1.4.0`

## Architecture Documentation

### Current Release-Please Setup

```
Repository Default Branch: develop
Workflow Trigger Branch: main
Release-Please Target (auto-detected): develop

Flow:
┌─────────────────────────────────────────────────────────────┐
│ Push to main                                                │
│      ↓                                                      │
│ Workflow triggers                                           │
│      ↓                                                      │
│ Release-please auto-detects 'develop' as target            │
│      ↓                                                      │
│ Creates/updates PR targeting 'develop'                     │
│      ↓                                                      │
│ No GitHub release created → release_created=false          │
│      ↓                                                      │
│ Publish job skipped                                        │
└─────────────────────────────────────────────────────────────┘
```

### Branch Naming Convention

Release-please creates branches with the pattern:
```
release-please--branches--{TARGET_BRANCH}--components--{PACKAGE_NAME}
```

Current branch: `release-please--branches--develop--components--file-markers`

This confirms release-please is treating `develop` as the target branch.

## Historical Context

From git history:
- Commit `e904216`: "fix: configure release-please to target main branch" - An attempt was made to fix this by setting `target-branch: main` in the config
- However, this config option is a CLI parameter and is not read by the GitHub Action

From PR history:
- PR #11, #13: Release PRs targeting `develop`
- PR #16: Release PR merged to `main`
- PR #17: New release PR created targeting `develop` immediately after

## Related Research

No prior research documents found in `thoughts/shared/research/`.

## Open Questions

1. Should the repository's default branch be changed from `develop` to `main`?
2. Alternatively, should the workflow be modified to explicitly set `target-branch` in the action?
3. What is the intended branching strategy - main-based releases or develop-based releases?
4. Should there be a separate workflow for the `develop` branch?

## References

- [release-please-action README](https://github.com/googleapis/release-please-action)
- [release-please manifest documentation](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
- Workflow run logs: Run #21568605632
