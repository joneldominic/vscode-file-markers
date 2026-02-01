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
2. Go to GitHub Actions > "Pre-release" workflow
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
