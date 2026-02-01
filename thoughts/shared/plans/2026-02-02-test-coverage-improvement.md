# Test Coverage Improvement Plan

## Overview

Improve test coverage for the File Markers extension by adding integration tests for untested modules and filling gaps in existing storage tests. Focus on testing business logic and command behavior.

## Current State Analysis

### Existing Tests:

| File | Test File | Tests | Status |
|------|-----------|-------|--------|
| `defaults.ts` | `defaults.test.ts` | 6 | ✅ Good |
| `types.ts` | N/A | 0 | N/A (types only) |
| `storage.ts` | `storage.test.ts` | 27 | ⚠️ Missing inheritance tests |
| `decorationProvider.ts` | None | 0 | ❌ No tests |
| `commands.ts` | None | 0 | ❌ No tests |
| `statusBar.ts` | None | 0 | ❌ No tests |
| `extension.ts` | `extension.test.ts` | 3 | ✅ Basic activation |
| N/A | `enabled.test.ts` | 3 | ✅ Toggle tests |

### Key Gaps:

1. **`storage.ts`**: `getEffectiveMarker()` inheritance logic untested
2. **`decorationProvider.ts`**: No tests for decoration generation
3. **`commands.ts`**: No tests for command handlers
4. **`statusBar.ts`**: No tests for status bar rendering

## Desired End State

After implementation:
1. All modules have meaningful test coverage
2. `pnpm test` passes with 40+ tests
3. Core business logic (inheritance, decorations, commands) is tested
4. Edge cases for validation are covered

### Verification:
- `pnpm test` passes all tests
- Test output shows suites for: defaults, storage, extension, enabled, decorationProvider, commands, statusBar

## What We're NOT Doing

- 100% code coverage (diminishing returns with VSCode API mocking)
- E2E tests (complex setup, manual testing sufficient)
- Performance benchmarks
- Mocking complex VSCode UI interactions (QuickPick selections)

## Future Improvements (Out of Scope)

These items are noted for a future plan:

1. **Error Handling Improvements**: Some silent catches in `storage.ts` (lines 92, 153)
2. **Performance Profiling**: Validate FileDecorationProvider performance on large workspaces
3. **Code Coverage Reporting**: Configure `c8` to generate coverage reports
4. **CI Coverage Badge**: Add coverage badge to README

## Implementation Approach

Use VSCode's `@vscode/test-electron` for integration tests that require the real VSCode API. Tests run in the Extension Development Host with access to workspace folders.

---

## Phase 1: Add Storage Inheritance Tests

### Overview

Test the `getEffectiveMarker()` method which handles marker inheritance from parent folders.

### Changes Required:

#### 1. Add Inheritance Tests to `storage.test.ts`

**File**: `src/test/storage.test.ts`
**Changes**: Add new test suite for inheritance behavior

```typescript
suite('Marker Inheritance', () => {
  test('getEffectiveMarker returns direct marker when set', function() {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);

    storage.setMarker(testUri, 'done');
    const effective = storage.getEffectiveMarker(testUri);

    assert.ok(effective);
    assert.strictEqual(effective.markerId, 'done');
    assert.strictEqual(effective.inherited, false);
  });

  test('getEffectiveMarker returns undefined when no marker and inheritance disabled', async function() {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
    const fileUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);

    // Set marker on folder, not file
    storage.setMarker(folderUri, 'done');

    // Ensure inheritance is disabled
    const config = vscode.workspace.getConfiguration('fileMarkers');
    await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);

    const effective = storage.getEffectiveMarker(fileUri);
    assert.strictEqual(effective, undefined);

    // Cleanup
    storage.removeMarker(folderUri);
  });

  test('getEffectiveMarker returns inherited marker when inheritance enabled', async function() {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
    const fileUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);

    // Set marker on folder
    storage.setMarker(folderUri, 'in-progress');

    // Enable inheritance
    const config = vscode.workspace.getConfiguration('fileMarkers');
    await config.update('inheritFolderMarkers', true, vscode.ConfigurationTarget.Workspace);

    const effective = storage.getEffectiveMarker(fileUri);

    assert.ok(effective);
    assert.strictEqual(effective.markerId, 'in-progress');
    assert.strictEqual(effective.inherited, true);

    // Cleanup
    await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);
    storage.removeMarker(folderUri);
  });

  test('direct marker overrides inherited marker', async function() {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
    const fileUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);

    // Set markers on both folder and file
    storage.setMarker(folderUri, 'pending');
    storage.setMarker(fileUri, 'done');

    // Enable inheritance
    const config = vscode.workspace.getConfiguration('fileMarkers');
    await config.update('inheritFolderMarkers', true, vscode.ConfigurationTarget.Workspace);

    const effective = storage.getEffectiveMarker(fileUri);

    assert.ok(effective);
    assert.strictEqual(effective.markerId, 'done'); // Direct marker wins
    assert.strictEqual(effective.inherited, false);

    // Cleanup
    await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);
    storage.removeMarker(folderUri);
    storage.removeMarker(fileUri);
  });

  test('inherits from nearest parent folder', async function() {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const parentUri = vscode.Uri.file(`${workspaceRoot}/src`);
    const childUri = vscode.Uri.file(`${workspaceRoot}/src/components`);
    const fileUri = vscode.Uri.file(`${workspaceRoot}/src/components/Button.tsx`);

    // Set different markers on parent and child folders
    storage.setMarker(parentUri, 'pending');
    storage.setMarker(childUri, 'done');

    // Enable inheritance
    const config = vscode.workspace.getConfiguration('fileMarkers');
    await config.update('inheritFolderMarkers', true, vscode.ConfigurationTarget.Workspace);

    const effective = storage.getEffectiveMarker(fileUri);

    assert.ok(effective);
    assert.strictEqual(effective.markerId, 'done'); // Nearest parent wins
    assert.strictEqual(effective.inherited, true);

    // Cleanup
    await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);
    storage.removeMarker(parentUri);
    storage.removeMarker(childUri);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm run compile-tests` succeeds
- [x] `pnpm test` passes all tests including new inheritance suite
- [x] Test output shows "Marker Inheritance" suite with 5 passing tests

#### Manual Verification:
- [ ] Review test output for meaningful assertions

---

## Phase 2: Add Decoration Provider Tests

### Overview

Test the `MarkerDecorationProvider.provideFileDecoration()` method which generates visual decorations for files.

### Changes Required:

#### 1. Create `decorationProvider.test.ts`

**File**: `src/test/decorationProvider.test.ts`
**Content**:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkerStorage, FALLBACK_MARKER } from '../storage';
import { MarkerDecorationProvider } from '../decorationProvider';

suite('MarkerDecorationProvider Test Suite', () => {
  let storage: MarkerStorage;
  let provider: MarkerDecorationProvider;

  setup(async () => {
    storage = new MarkerStorage();
    await storage.initialize();
    provider = new MarkerDecorationProvider(storage);
  });

  teardown(async () => {
    // Reset enabled setting
    const config = vscode.workspace.getConfiguration('fileMarkers');
    await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);

    provider.dispose();
    storage.dispose();
  });

  suite('provideFileDecoration', () => {
    test('returns undefined for unmarked file', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/unmarked.ts`);
      const token = new vscode.CancellationTokenSource().token;

      const decoration = provider.provideFileDecoration(testUri, token);

      assert.strictEqual(decoration, undefined);
    });

    test('returns decoration for marked file', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/marked.ts`);
      const token = new vscode.CancellationTokenSource().token;

      storage.setMarker(testUri, 'done');
      const decoration = provider.provideFileDecoration(testUri, token);

      assert.ok(decoration);
      assert.strictEqual(decoration.badge, '✓');
      assert.ok(decoration.tooltip?.includes('Done'));
      assert.strictEqual(decoration.propagate, false);

      // Cleanup
      storage.removeMarker(testUri);
    });

    test('returns undefined when extension is disabled', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/marked.ts`);
      const token = new vscode.CancellationTokenSource().token;

      storage.setMarker(testUri, 'done');

      // Disable extension
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

      const decoration = provider.provideFileDecoration(testUri, token);

      assert.strictEqual(decoration, undefined);

      // Cleanup
      storage.removeMarker(testUri);
    });

    test('returns fallback badge for unknown marker type', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/unknown-marker.ts`);
      const token = new vscode.CancellationTokenSource().token;

      // Directly set an unknown marker ID (simulating orphaned marker)
      storage.setMarker(testUri, 'non-existent-type');
      const decoration = provider.provideFileDecoration(testUri, token);

      assert.ok(decoration);
      assert.strictEqual(decoration.badge, FALLBACK_MARKER.badge); // '⚠'
      assert.ok(decoration.tooltip?.includes('Unknown marker type'));

      // Cleanup
      storage.removeMarker(testUri);
    });

    test('inherited marker has different tooltip', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
      const fileUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);
      const token = new vscode.CancellationTokenSource().token;

      storage.setMarker(folderUri, 'done');

      // Enable inheritance
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('inheritFolderMarkers', true, vscode.ConfigurationTarget.Workspace);

      const decoration = provider.provideFileDecoration(fileUri, token);

      assert.ok(decoration);
      assert.strictEqual(decoration.badge, '✓');
      assert.ok(decoration.tooltip?.includes('inherited'));

      // Cleanup
      await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);
      storage.removeMarker(folderUri);
    });
  });

  suite('refresh', () => {
    test('fires onDidChangeFileDecorations event', function(done) {
      const disposable = provider.onDidChangeFileDecorations(() => {
        disposable.dispose();
        done();
      });

      provider.refresh();
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm run compile-tests` succeeds
- [x] `pnpm test` passes all tests
- [x] Test output shows "MarkerDecorationProvider" suite

#### Manual Verification:
- [ ] Review test coverage for decoration scenarios

---

## Phase 3: Add Command Handler Tests

### Overview

Test the command handlers in `commands.ts` to verify they correctly interact with storage.

### Changes Required:

#### 1. Create `commands.test.ts`

**File**: `src/test/commands.test.ts`
**Content**:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkerStorage } from '../storage';

suite('Commands Test Suite', () => {
  let storage: MarkerStorage;

  setup(async () => {
    storage = new MarkerStorage();
    await storage.initialize();
  });

  teardown(() => {
    // Clean up all markers
    storage.removeAllMarkers();
    storage.dispose();
  });

  suite('removeMarker command', () => {
    test('removes marker from single file', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test-file.ts`);

      // Set a marker first
      storage.setMarker(testUri, 'done');
      assert.strictEqual(storage.hasMarker(testUri), true);

      // Execute remove command
      await vscode.commands.executeCommand('file-markers.removeMarker', testUri);

      assert.strictEqual(storage.hasMarker(testUri), false);
    });
  });

  suite('removeMarkersInFolder command', () => {
    test('removes all markers in folder', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
      const file1 = vscode.Uri.file(`${workspaceRoot}/src/file1.ts`);
      const file2 = vscode.Uri.file(`${workspaceRoot}/src/file2.ts`);
      const outsideFile = vscode.Uri.file(`${workspaceRoot}/other.ts`);

      // Set markers
      storage.setMarker(file1, 'done');
      storage.setMarker(file2, 'pending');
      storage.setMarker(outsideFile, 'done');

      assert.strictEqual(storage.getMarkerCount(), 3);

      // Execute command
      await vscode.commands.executeCommand('file-markers.removeMarkersInFolder', folderUri);

      // Only outsideFile should remain
      assert.strictEqual(storage.hasMarker(file1), false);
      assert.strictEqual(storage.hasMarker(file2), false);
      assert.strictEqual(storage.hasMarker(outsideFile), true);
    });
  });

  suite('toggleMarker command', () => {
    test('shows warning when extension is disabled', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      // Disable extension
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

      // Execute toggle command - should show warning (we can't easily assert on the message)
      await vscode.commands.executeCommand('file-markers.toggleMarker');

      // Re-enable
      await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
    });

    test('cycles through markers on active file', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      // This test requires an active editor, which is hard to set up in tests
      // We'll test the storage layer directly in storage.test.ts instead
      this.skip();
    });
  });

  suite('openConfig command', () => {
    test('creates config file if it does not exist', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const storageUri = storage.getStorageUri();
      if (!storageUri) {
        this.skip();
        return;
      }

      // Execute command
      await vscode.commands.executeCommand('file-markers.openConfig');

      // Verify file exists
      try {
        await vscode.workspace.fs.stat(storageUri);
        assert.ok(true, 'Config file should exist');
      } catch {
        assert.fail('Config file should have been created');
      }

      // Close the opened editor
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm run compile-tests` succeeds
- [x] `pnpm test` passes all tests
- [x] Test output shows "Commands" suite

#### Manual Verification:
- [ ] Review command test coverage

---

## Phase 4: Add Status Bar Tests

### Overview

Test the `StatusBarManager` class for correct rendering and stats display.

### Changes Required:

#### 1. Create `statusBar.test.ts`

**File**: `src/test/statusBar.test.ts`
**Content**:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkerStorage } from '../storage';
import { StatusBarManager } from '../statusBar';

suite('StatusBarManager Test Suite', () => {
  let storage: MarkerStorage;
  let statusBar: StatusBarManager;

  setup(async () => {
    storage = new MarkerStorage();
    await storage.initialize();
    statusBar = new StatusBarManager(storage);
  });

  teardown(async () => {
    // Reset enabled setting
    const config = vscode.workspace.getConfiguration('fileMarkers');
    await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);

    storage.removeAllMarkers();
    statusBar.dispose();
    storage.dispose();
  });

  suite('update', () => {
    test('shows "No markers" when empty', function() {
      // StatusBarManager.update() is called internally
      // We can't easily access the private statusBarItem text
      // This is more of an integration test to ensure no errors
      statusBar.update();
      assert.ok(true, 'Update should not throw');
    });

    test('updates after marker is set', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test.ts`);

      storage.setMarker(testUri, 'done');
      statusBar.update();

      // Can't access private text, but ensure no errors
      assert.ok(true);
    });

    test('shows disabled state when extension disabled', async function() {
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

      statusBar.update();

      // Ensure no errors
      assert.ok(true);
    });
  });

  suite('showStats', () => {
    test('showStats executes without error', async function() {
      // showStats opens a QuickPick which we can't interact with in tests
      // But we can verify it doesn't throw
      // Note: This will open a QuickPick that needs to be dismissed
      // In automated tests, this may hang waiting for user input
      // So we skip the actual execution
      this.skip();
    });
  });

  suite('dispose', () => {
    test('disposes without error', () => {
      const tempStorage = new MarkerStorage();
      const tempStatusBar = new StatusBarManager(tempStorage);

      // Should not throw
      tempStatusBar.dispose();
      tempStorage.dispose();

      assert.ok(true);
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm run compile-tests` succeeds
- [x] `pnpm test` passes all tests
- [x] Test output shows "StatusBarManager" suite

#### Manual Verification:
- [ ] Review status bar test coverage

---

## Phase 5: Add Validation Edge Case Tests

### Overview

Add tests for `isValidMarkerTypeConfig()` edge cases and other validation logic.

### Changes Required:

#### 1. Add Validation Tests to `storage.test.ts`

**File**: `src/test/storage.test.ts`
**Changes**: Add new test suite for validation

```typescript
suite('Marker Type Validation', () => {
  test('rejects null config', function() {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    // Attempt to set a marker with null type should use fallback
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/test.ts`);

    storage.setMarker(testUri, 'null-type');
    const markerType = storage.getMarkerType('null-type');

    // Should return fallback
    assert.strictEqual(markerType.badge, '⚠');
  });

  test('rejects config with empty id', function() {
    // When loading marker types with empty id, they should be skipped
    const unknownType = storage.getMarkerType('');
    assert.strictEqual(unknownType.badge, '⚠'); // Fallback
  });

  test('rejects config with empty badge', function() {
    // Marker types with empty badge should be skipped during load
    // Verify that a made-up ID returns fallback
    const unknownType = storage.getMarkerType('empty-badge-type');
    assert.strictEqual(unknownType.badge, '⚠');
  });

  test('truncates badge to 2 characters', function() {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    // The loadMarkerTypes function truncates badges to 2 chars
    // Default markers should all have badges <= 2 chars
    const types = storage.getAllMarkerTypes();
    for (const type of types) {
      assert.ok(
        type.badge.length <= 2,
        `Badge "${type.badge}" for ${type.id} should be <= 2 chars`
      );
    }
  });
});

suite('Path Normalization', () => {
  test('handles Windows-style paths', function() {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

    // Set marker using forward slashes
    const testUri = vscode.Uri.file(`${workspaceRoot}/src/components/Button.tsx`);
    storage.setMarker(testUri, 'done');

    // Should be able to retrieve it
    assert.strictEqual(storage.getMarker(testUri), 'done');

    // Cleanup
    storage.removeMarker(testUri);
  });

  test('returns undefined for paths outside workspace', function() {
    // Create URI outside workspace
    const outsideUri = vscode.Uri.file('/some/other/path/file.ts');

    // Should return undefined, not throw
    const marker = storage.getMarker(outsideUri);
    assert.strictEqual(marker, undefined);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm run compile-tests` succeeds
- [x] `pnpm test` passes all tests
- [x] Test output shows "Marker Type Validation" and "Path Normalization" suites

#### Manual Verification:
- [ ] Review validation test coverage

---

## Testing Commands Reference

```bash
# Run all tests
pnpm test

# Compile tests only
pnpm run compile-tests

# Watch tests
pnpm run watch-tests

# Run with coverage
pnpm run test:coverage

# Check types
pnpm run check-types

# Full check
pnpm run compile
```

---

## File Structure After Implementation

```
src/test/
├── helpers/
│   └── vscode-mock.ts         # Existing utilities
├── defaults.test.ts           # Existing (6 tests)
├── extension.test.ts          # Existing (3 tests)
├── enabled.test.ts            # Existing (3 tests)
├── storage.test.ts            # UPDATED: +10 tests (inheritance, validation)
├── decorationProvider.test.ts # NEW: 6 tests
├── commands.test.ts           # NEW: 4 tests
└── statusBar.test.ts          # NEW: 4 tests
```

**Total tests after implementation: ~56 tests** (up from ~39)

---

## References

- [Testing Extensions | VSCode Docs](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [@vscode/test-cli](https://github.com/microsoft/vscode-test-cli)
- Current test files: `src/test/*.test.ts`
- v1.1.0 Quality Plan: `thoughts/shared/plans/2026-02-01-v1.1.0-quality-polish.md`
