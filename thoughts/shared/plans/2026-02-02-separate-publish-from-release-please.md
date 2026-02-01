# Separate Publish from Release-Please Implementation Plan

## Overview

Separate the publish workflow from release-please to prevent accidental publishing on regular merges to main. Currently, the `release_created` condition in release-please.yml is unreliable and triggers publish even on non-release merges.

## Current State Analysis

### Problem
- `release-please.yml` contains both release-please and publish jobs
- The `release_created` output condition is not working reliably
- Publishing triggers on regular merges to main, failing with "version already exists"

### Current Workflow Structure
```
.github/workflows/
├── release-please.yml  # Contains both release-please + publish jobs
├── manual-publish.yml  # Manual trigger for publishing
├── pre-release.yml     # Pre-release publishing from develop
└── ci.yml              # Build/test on PR and push
```

### Key Discoveries
- `release-please.yml:30` - The condition `release_created == 'true'` is evaluating incorrectly
- `release-please.yml:74-77` - VSIX uploaded as workflow artifact, NOT GitHub Release asset
- `manual-publish.yml` - Duplicates publish logic, can be consolidated

## Desired End State

### Workflow Structure
```
.github/workflows/
├── release-please.yml  # ONLY creates release PRs and GitHub Releases
├── publish.yml         # Triggers on GitHub Release OR manual dispatch
├── pre-release.yml     # Pre-release publishing from develop (unchanged)
└── ci.yml              # Build/test on PR and push (unchanged)
```

### Flow
1. Push to main → release-please creates/updates release PR
2. Merge release PR → release-please creates GitHub Release with tag
3. GitHub Release published → publish.yml triggers → publishes to marketplaces + attaches VSIX to release

### Verification
- Merging a regular PR to main should NOT trigger publishing
- Only merging a release-please PR (which creates a GitHub Release) should trigger publishing
- Manual dispatch should allow re-publishing if needed

## What We're NOT Doing

- Not changing the pre-release workflow
- Not changing the CI workflow
- Not modifying release-please configuration (config.json, manifest.json)
- Not changing how versions are bumped

## Implementation Approach

Remove the publish job from release-please.yml and create a dedicated publish.yml that triggers on GitHub Release events.

## Phase 1: Create New Publish Workflow

### Overview
Create a new `publish.yml` workflow that triggers on GitHub Release publication and manual dispatch.

### Changes Required

#### 1. Create `.github/workflows/publish.yml`

**File**: `.github/workflows/publish.yml`
**Action**: Create new file

```yaml
name: Publish

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag to publish (e.g., v1.4.0). Leave empty to use latest release.'
        required: false
        type: string
      target:
        description: 'Publish target'
        required: true
        default: 'both'
        type: choice
        options:
          - vscode
          - openvsx
          - both

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
      - name: Determine tag
        id: get-tag
        run: |
          if [ "${{ github.event_name }}" = "release" ]; then
            echo "tag=${{ github.event.release.tag_name }}" >> $GITHUB_OUTPUT
          elif [ -n "${{ github.event.inputs.tag }}" ]; then
            echo "tag=${{ github.event.inputs.tag }}" >> $GITHUB_OUTPUT
          else
            # Get latest release tag
            LATEST_TAG=$(gh release view --json tagName -q '.tagName')
            echo "tag=$LATEST_TAG" >> $GITHUB_OUTPUT
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ steps.get-tag.outputs.tag }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Install vsce
        run: pnpm add -g @vscode/vsce

      - name: Install ovsx
        run: pnpm add -g ovsx

      - name: Build extension
        run: pnpm run package

      - name: Package extension
        run: vsce package --no-dependencies

      - name: Determine publish targets
        id: targets
        run: |
          if [ "${{ github.event_name }}" = "release" ]; then
            echo "vscode=true" >> $GITHUB_OUTPUT
            echo "openvsx=true" >> $GITHUB_OUTPUT
          else
            TARGET="${{ github.event.inputs.target }}"
            if [ "$TARGET" = "vscode" ] || [ "$TARGET" = "both" ]; then
              echo "vscode=true" >> $GITHUB_OUTPUT
            else
              echo "vscode=false" >> $GITHUB_OUTPUT
            fi
            if [ "$TARGET" = "openvsx" ] || [ "$TARGET" = "both" ]; then
              echo "openvsx=true" >> $GITHUB_OUTPUT
            else
              echo "openvsx=false" >> $GITHUB_OUTPUT
            fi
          fi

      - name: Publish to VS Code Marketplace
        if: steps.targets.outputs.vscode == 'true'
        run: vsce publish --no-dependencies
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}

      - name: Publish to OpenVSX
        if: steps.targets.outputs.openvsx == 'true'
        run: |
          VSIX_FILE=$(ls *.vsix | head -1)
          ovsx publish "$VSIX_FILE"
        env:
          OVSX_PAT: ${{ secrets.OVSX_PAT }}

      - name: Upload VSIX to GitHub Release
        run: |
          VSIX_FILE=$(ls *.vsix | head -1)
          gh release upload "${{ steps.get-tag.outputs.tag }}" "$VSIX_FILE" --clobber
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload VSIX as workflow artifact
        uses: actions/upload-artifact@v4
        with:
          name: extension-vsix
          path: '*.vsix'
```

### Success Criteria

#### Automated Verification
- [x] Workflow file is valid YAML: `cat .github/workflows/publish.yml | python3 -c "import yaml, sys; yaml.safe_load(sys.stdin)"`
- [x] No syntax errors in workflow

#### Manual Verification
- [ ] Workflow appears in GitHub Actions tab
- [ ] Manual dispatch shows correct input options (tag, target)

---

## Phase 2: Update Release-Please Workflow

### Overview
Remove the publish job from release-please.yml, keeping only the release-please job.

### Changes Required

#### 1. Update `.github/workflows/release-please.yml`

**File**: `.github/workflows/release-please.yml`
**Action**: Remove publish job, keep only release-please job

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
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

### Success Criteria

#### Automated Verification
- [x] Workflow file is valid YAML
- [x] No publish job exists in release-please.yml

#### Manual Verification
- [ ] Pushing to main only triggers release-please job (no publish)
- [ ] Release-please still creates/updates release PRs correctly

---

## Phase 3: Remove Manual Publish Workflow

### Overview
Delete the manual-publish.yml workflow since publish.yml now handles manual dispatch.

### Changes Required

#### 1. Delete `.github/workflows/manual-publish.yml`

**File**: `.github/workflows/manual-publish.yml`
**Action**: Delete file

### Success Criteria

#### Automated Verification
- [x] File does not exist: `! test -f .github/workflows/manual-publish.yml`

#### Manual Verification
- [ ] Only one publish workflow exists in GitHub Actions

---

## Phase 4: End-to-End Testing

### Overview
Verify the complete workflow functions correctly.

### Success Criteria

#### Manual Verification
- [ ] Push a commit to main → only release-please runs, no publish
- [ ] Merge a release-please PR → GitHub Release is created → publish workflow triggers automatically
- [ ] VSIX file is attached to the GitHub Release
- [ ] Extension is published to VS Code Marketplace
- [ ] Extension is published to OpenVSX
- [ ] Manual dispatch works with tag selection
- [ ] Manual dispatch works with target selection (vscode/openvsx/both)

---

## Testing Strategy

### Integration Tests
1. **Regular merge to main**: Verify publish does NOT trigger
2. **Release-please PR merge**: Verify GitHub Release is created and publish triggers
3. **Manual dispatch**: Verify can publish specific tag to specific target

### Manual Testing Steps
1. Create a test branch with a small change
2. Merge to main via PR
3. Verify only release-please job runs (no publish)
4. If release-please creates a release PR, merge it
5. Verify GitHub Release is created
6. Verify publish workflow triggers automatically
7. Verify VSIX is attached to the release
8. Test manual dispatch with different options

## Rollback Plan

If issues occur:
1. Revert publish.yml to include the release trigger
2. Re-add publish job to release-please.yml with the original condition
3. Restore manual-publish.yml from git history

## References

- Current release-please.yml: `.github/workflows/release-please.yml`
- Current manual-publish.yml: `.github/workflows/manual-publish.yml`
- Release-please action docs: https://github.com/googleapis/release-please-action
