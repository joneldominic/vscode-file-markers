# Automated Versioning and Changelog Implementation Plan

## Overview

Set up automated version bumping and changelog generation using Conventional Commits, commitlint, lefthook, and release-please. Implement a Git Flow branching strategy with `develop` as staging and `main` as production.

## Current State Analysis

- Version manually maintained in `package.json` (currently `1.2.0`)
- CHANGELOG.md manually written following Keep a Changelog format
- Publish workflow is manually triggered via `workflow_dispatch`
- Single `main` branch with no staging branch
- No commit message enforcement

## Desired End State

### Branching Strategy
```
feature/* ──PR──→ develop (staging) ──PR──→ main
                       │                     │
                 (optional)            release-please
                 pre-release                 │
                 workflow              Release PR
                       │                     │
                       ↓               human review & edit
                 1.3.0-beta.1                │
                                       merge → tag → publish
                                             │
hotfix/*  ───────────────────────────PR──→ main
```

### Workflow
1. Developers create feature branches from `develop`
2. Commits enforced via commitlint (locally via lefthook + CI)
3. Feature PRs merged to `develop` (squash merge)
4. When ready to release, PR from `develop` → `main`
5. Merging to `main` triggers release-please
6. Release-please creates a Release PR with version bump + changelog
7. Merging Release PR creates git tag and triggers publish

### Verification

- Commit without conventional format → blocked locally by lefthook
- Push non-conventional commit → CI fails
- Merge to main → Release PR created automatically
- Edit Release PR changelog → polished, user-friendly entries
- Merge Release PR → extension published to both marketplaces
- Hotfix PR to main → works same as develop PR
- Manual pre-release from develop → beta version published to marketplaces

## What We're NOT Doing

- Monorepo support (single package)
- Fully automated changelog (human edits Release PR before merging)
- Automatic pre-release on every develop push (pre-release is manual/optional)

## Implementation Approach

Install and configure tooling in phases, starting with local commit enforcement, then CI, then release automation. Finally set up branch protection rules.

---

## Phase 1: Set Up Commitlint + Lefthook

### Overview

Install commitlint and lefthook to enforce Conventional Commits locally before push.

### Changes Required:

#### 1. Install Dependencies

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional lefthook
```

#### 2. Create Commitlint Config

**File**: `commitlint.config.js`

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting, no code change
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding tests
        'chore',    // Maintenance tasks
        'ci',       // CI/CD changes
        'build',    // Build system changes
        'revert',   // Revert previous commit
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
  },
};
```

#### 3. Create Lefthook Config

**File**: `lefthook.yml`

```yaml
# Lefthook configuration for git hooks
# https://github.com/evilmartians/lefthook

commit-msg:
  commands:
    commitlint:
      run: pnpm exec commitlint --edit {1}

pre-commit:
  parallel: true
  commands:
    check-types:
      run: pnpm run check-types
    lint:
      run: pnpm run lint
```

#### 4. Initialize Lefthook

```bash
pnpm exec lefthook install
```

#### 5. Update Package.json Scripts

**File**: `package.json`

Add to `scripts` section:

```json
{
  "scripts": {
    "prepare": "lefthook install"
  }
}
```

### Success Criteria:

#### Automated Verification:

- [x] Dependencies installed: `pnpm list @commitlint/cli lefthook`
- [x] Lefthook config exists: `ls -la lefthook.yml`
- [x] Lefthook hooks installed: `ls -la .git/hooks/commit-msg`
- [x] Invalid commit blocked: `echo "bad commit" | pnpm exec commitlint` (should fail)
- [x] Valid commit passes: `echo "feat: test commit" | pnpm exec commitlint` (should pass)

#### Manual Verification:

- [x] Try `git commit -m "bad message"` → blocked with error
- [x] Try `git commit -m "feat: valid message"` → succeeds

---

## Phase 2: ~~Add Commitlint to CI~~ (Skipped)

### Overview

~~Add commitlint check to CI workflow to catch non-conventional commits in PRs.~~

**Decision**: Skipped - Lefthook enforces commit messages locally, and the changelog can be manually edited in the Release PR before merging. CI commitlint adds friction without significant benefit.

### Changes Required:

#### 1. Update CI Workflow

**File**: `.github/workflows/ci.yml`

Add commitlint job:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

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

      - name: Validate PR commits
        if: github.event_name == 'pull_request'
        run: pnpm exec commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose

  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

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

      - name: Check types
        run: pnpm run check-types

      - name: Lint
        run: pnpm run lint

      - name: Compile
        run: pnpm run compile

      - name: Compile tests
        run: pnpm run compile-tests

      - name: Run tests
        run: xvfb-run -a pnpm test
        env:
          DISPLAY: ':99.0'
```

### Success Criteria:

N/A - Phase skipped. CI workflow updated to include `develop` branch but without commitlint job.

---

## Phase 3: Set Up Release-Please

### Overview

Configure release-please to automatically create Release PRs when changes are pushed to main.

### Changes Required:

#### 1. Create Release-Please Config

**File**: `release-please-config.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "package-name": "file-markers",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true,
      "bump-patch-for-minor-pre-major": true,
      "draft": false,
      "prerelease": false,
      "changelog-sections": [
        { "type": "feat", "section": "Added", "hidden": false },
        { "type": "fix", "section": "Fixed", "hidden": false },
        { "type": "perf", "section": "Changed", "hidden": false },
        { "type": "refactor", "section": "Changed", "hidden": false },
        { "type": "docs", "section": "Documentation", "hidden": false },
        { "type": "chore", "section": "Maintenance", "hidden": true },
        { "type": "ci", "section": "Maintenance", "hidden": true },
        { "type": "build", "section": "Maintenance", "hidden": true },
        { "type": "test", "section": "Maintenance", "hidden": true }
      ]
    }
  }
}
```

This maps Conventional Commits to Keep a Changelog sections (Added, Fixed, Changed, etc.).

#### 2. Create Release-Please Manifest

**File**: `.release-please-manifest.json`

```json
{
  ".": "1.2.0"
}
```

#### 3. Create Release-Please Workflow

**File**: `.github/workflows/release-please.yml`

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
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
    steps:
      - name: Release Please
        id: release
        uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

### Success Criteria:

#### Automated Verification:

- [x] Config files are valid JSON
- [x] Workflow syntax is valid

#### Manual Verification:

- [ ] Push to main → Release Please workflow runs
- [ ] Release PR is created with version bump and changelog

### Important: Editing the Release PR

Before merging the Release PR, **always review and polish the changelog**:

1. Open the Release PR created by release-please
2. Edit the CHANGELOG.md changes to:
   - Add bold feature names (e.g., `**Enable/Disable Toggle**:`)
   - Group related changes under descriptive headers
   - Add sub-bullets with details
   - Remove overly technical commit messages
   - Ensure user-friendly language
3. Commit the changelog edits to the Release PR branch
4. Then merge the Release PR

**Example transformation:**

Before (auto-generated):
```markdown
### Added
* add fileMarkers.enabled setting to toggle extension ([dfadd16](...))
```

After (human-edited):
```markdown
### Added
- **Enable/Disable Toggle**: Quickly disable the extension without uninstalling
  - New setting: `fileMarkers.enabled` (default: true)
  - New command: "File Markers: Toggle Enable/Disable"
  - Status bar shows "File Markers: Disabled" when off
```

---

## Phase 4: Update Publish Workflow

### Overview

Modify the publish workflow to trigger automatically when release-please creates a release.

### Changes Required:

#### 1. Update Publish Workflow

**File**: `.github/workflows/publish.yml`

```yaml
name: Publish Extension

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
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
      - name: Checkout
        uses: actions/checkout@v4

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

      - name: Publish to VS Code Marketplace
        if: ${{ github.event_name == 'release' || github.event.inputs.target == 'vscode' || github.event.inputs.target == 'both' }}
        run: vsce publish --no-dependencies
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}

      - name: Publish to OpenVSX
        if: ${{ github.event_name == 'release' || github.event.inputs.target == 'openvsx' || github.event.inputs.target == 'both' }}
        run: |
          VSIX_FILE=$(ls *.vsix | head -1)
          ovsx publish "$VSIX_FILE"
        env:
          OVSX_PAT: ${{ secrets.OVSX_PAT }}

      - name: Upload VSIX artifact
        uses: actions/upload-artifact@v4
        with:
          name: extension-vsix
          path: '*.vsix'
```

#### 2. Update Release-Please to Trigger Release

**File**: `.github/workflows/release-please.yml`

Update to create a GitHub release when Release PR is merged:

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
        id: release
        uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

Note: release-please automatically creates a GitHub release when the Release PR is merged, which triggers the `on: release` event in the publish workflow.

### Success Criteria:

#### Automated Verification:

- [x] Workflow syntax is valid

#### Manual Verification:

- [ ] Merge Release PR → GitHub release created
- [ ] GitHub release created → Publish workflow triggered
- [ ] Extension published to both marketplaces

---

## Phase 5: Add Optional Pre-release Workflow

### Overview

Add a manual workflow to publish pre-release versions from the develop branch for early testing.

### Changes Required:

#### 1. Create Pre-release Workflow

**File**: `.github/workflows/pre-release.yml`

```yaml
name: Pre-release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Pre-release version (e.g., 1.3.0-beta.1)'
        required: true
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
  pre-release:
    runs-on: ubuntu-latest
    # Only allow pre-release from develop branch
    if: github.ref == 'refs/heads/develop'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

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

      - name: Update version for pre-release
        run: |
          npm version ${{ github.event.inputs.version }} --no-git-tag-version
          echo "Updated version to ${{ github.event.inputs.version }}"

      - name: Install vsce
        run: pnpm add -g @vscode/vsce

      - name: Install ovsx
        run: pnpm add -g ovsx

      - name: Build extension
        run: pnpm run package

      - name: Package extension (pre-release)
        run: vsce package --no-dependencies --pre-release

      - name: Publish to VS Code Marketplace (pre-release)
        if: ${{ github.event.inputs.target == 'vscode' || github.event.inputs.target == 'both' }}
        run: vsce publish --no-dependencies --pre-release
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}

      - name: Publish to OpenVSX (pre-release)
        if: ${{ github.event.inputs.target == 'openvsx' || github.event.inputs.target == 'both' }}
        run: |
          VSIX_FILE=$(ls *.vsix | head -1)
          ovsx publish "$VSIX_FILE" --pre-release
        env:
          OVSX_PAT: ${{ secrets.OVSX_PAT }}

      - name: Upload VSIX artifact
        uses: actions/upload-artifact@v4
        with:
          name: extension-vsix-prerelease
          path: '*.vsix'

      - name: Create pre-release tag
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag -a "v${{ github.event.inputs.version }}" -m "Pre-release v${{ github.event.inputs.version }}"
          git push origin "v${{ github.event.inputs.version }}"
```

### Success Criteria:

#### Automated Verification:

- [x] Workflow syntax is valid

#### Manual Verification:

- [ ] Can trigger workflow from develop branch
- [ ] Cannot trigger from other branches (job skipped)
- [ ] Pre-release version published to marketplaces
- [ ] Users see "Install Pre-Release" option in marketplace

### When to Use Pre-releases

| Scenario | Use Pre-release? |
|----------|------------------|
| Small bug fix | No |
| New feature, low risk | No |
| Major feature needing real-world testing | Yes |
| Breaking changes | Yes |
| Testing marketplace publishing | Yes |

---

## Phase 6: Create Develop Branch and Branch Protection

### Overview

Create the develop branch and set up branch protection rules for both main and develop.

### Changes Required:

#### 1. Create Develop Branch

```bash
git checkout main
git pull origin main
git checkout -b develop
git push -u origin develop
```

#### 2. Configure Branch Protection (via GitHub UI or CLI)

**Main Branch Protection:**
- Require pull request before merging
- Require status checks to pass (build, commitlint)
- Require conversation resolution before merging
- Do not allow bypassing the above settings
- Allow force pushes: No
- Allow deletions: No

**Develop Branch Protection:**
- Require pull request before merging
- Require status checks to pass (build, commitlint)
- Require conversation resolution before merging
- Allow force pushes: No
- Allow deletions: No

#### 3. Set Default Branch

Set `develop` as the default branch in GitHub repository settings so new PRs target develop by default.

### Success Criteria:

#### Automated Verification:

- [ ] Develop branch exists: `git branch -r | grep develop`

#### Manual Verification:

- [ ] Cannot push directly to main
- [ ] Cannot push directly to develop
- [ ] PRs require status checks to pass
- [ ] New PRs default to develop branch

---

## Phase 7: Document the Workflow

### Overview

Add documentation for the new release workflow.

### Changes Required:

#### 1. Update README or Create CONTRIBUTING.md

**File**: `CONTRIBUTING.md`

```markdown
# Contributing to File Markers

## Branching Strategy

- `main` - Production branch. Releases are made from here.
- `develop` - Staging branch. Features are merged here first.
- `feature/*` - Feature branches. Create from develop.
- `hotfix/*` - Hotfix branches. Create from main for urgent fixes.

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). All commits must follow this format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat` | New feature | Minor |
| `fix` | Bug fix | Patch |
| `docs` | Documentation only | None |
| `style` | Formatting, no code change | None |
| `refactor` | Code change that neither fixes nor adds | None |
| `perf` | Performance improvement | Patch |
| `test` | Adding tests | None |
| `chore` | Maintenance | None |
| `ci` | CI/CD changes | None |
| `build` | Build system changes | None |

### Breaking Changes

For breaking changes, add `!` after the type or include `BREAKING CHANGE:` in the footer:

```
feat!: remove deprecated API

BREAKING CHANGE: The old API has been removed.
```

This triggers a **major** version bump.

## Development Workflow

1. Create a feature branch from `develop`:
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/my-feature
   ```

2. Make changes and commit using conventional commits:
   ```bash
   git commit -m "feat: add new feature"
   ```

3. Push and create a PR to `develop`:
   ```bash
   git push -u origin feature/my-feature
   # Create PR targeting develop branch
   ```

4. After PR is approved and merged to develop, changes are staged.

## Release Workflow

1. Create a PR from `develop` to `main`
2. Merge the PR to main
3. Release Please automatically creates a Release PR with:
   - Version bump in package.json
   - Updated CHANGELOG.md
4. Review the Release PR and merge when ready
5. Merging the Release PR automatically:
   - Creates a git tag
   - Creates a GitHub release
   - Publishes to VS Code Marketplace and OpenVSX

## Hotfix Workflow

For urgent fixes that can't wait for the normal release cycle:

1. Create a hotfix branch from `main`:
   ```bash
   git checkout main
   git pull
   git checkout -b hotfix/critical-fix
   ```

2. Make the fix and commit:
   ```bash
   git commit -m "fix: resolve critical issue"
   ```

3. Create a PR directly to `main`
4. After merge, Release Please will create a Release PR
5. Also merge the fix to `develop` to keep branches in sync

## Pre-release Workflow (Optional)

For major features or breaking changes that need real-world testing:

1. Ensure your changes are merged to `develop`
2. Go to GitHub Actions → "Pre-release" workflow
3. Click "Run workflow"
4. Select branch: `develop`
5. Enter version: `1.3.0-beta.1` (follow semver pre-release format)
6. Select target: `both`
7. Click "Run workflow"

The pre-release will be published with the "Pre-Release" flag. Users must explicitly opt-in to receive pre-release updates.

### Pre-release Version Format

- `X.Y.Z-alpha.N` - Early testing, may be unstable
- `X.Y.Z-beta.N` - Feature complete, needs testing
- `X.Y.Z-rc.N` - Release candidate, final testing
```

### Success Criteria:

#### Automated Verification:

- [x] CONTRIBUTING.md file exists

#### Manual Verification:

- [ ] Documentation is clear and complete
- [ ] Workflow examples are accurate

---

## Testing Strategy

### Local Testing:

1. Test commitlint locally:
   - `git commit -m "bad"` → should fail
   - `git commit -m "feat: good"` → should pass

2. Test lefthook hook:
   - Make a commit with bad message → hook blocks it

### CI Testing:

1. Create a PR with non-conventional commits → CI fails
2. Create a PR with conventional commits → CI passes

### Release Testing:

1. Merge a test PR to main
2. Verify Release PR is created
3. Verify changelog content is correct (uses Keep a Changelog sections)
4. Edit the changelog to polish formatting
5. Merge Release PR
6. Verify GitHub release is created
7. Verify publish workflow triggers

### Pre-release Testing:

1. Merge changes to develop branch
2. Trigger pre-release workflow manually
3. Enter version (e.g., `1.3.0-beta.1`)
4. Verify pre-release published to marketplaces
5. Verify users see "Install Pre-Release" option
6. Verify stable users are NOT auto-updated

## Migration Notes

### Existing CHANGELOG.md

The current CHANGELOG.md format (Keep a Changelog) will be preserved. Release-please is configured with `changelog-sections` to generate entries in the same style (Added, Fixed, Changed sections). Historical entries will remain unchanged.

### First Release After Setup

The first merge to main after setup will trigger release-please to:
1. Detect all conventional commits since the last release
2. Create a Release PR with the accumulated changes
3. Bump version according to commit types (feat → minor, fix → patch)

**Important**: Before merging the first Release PR, review and polish the auto-generated changelog to match the existing style with bold feature names and descriptive bullet points.

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [commitlint](https://commitlint.js.org/)
- [lefthook](https://github.com/evilmartians/lefthook)
- [release-please](https://github.com/googleapis/release-please)
- [release-please-action](https://github.com/googleapis/release-please-action)
