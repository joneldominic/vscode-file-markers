# Config Reset Confirmation Implementation Plan

## Overview

Add user confirmation before resetting invalid/corrupted configuration instead of silently falling back to defaults. When the `file-markers.json` config file has invalid JSON, prompt the user with options to either reset to defaults (with warning about data loss) or open the config for manual fixing.

## Current State Analysis

The `load()` method in `src/storage.ts:82-109` currently handles invalid JSON silently:

```typescript
} catch {
  // File doesn't exist or is invalid - use defaults
  const hadData = this.markers.size > 0 || this.markerTypes.size > 0;
  this.loadMarkerTypes(DEFAULT_MARKER_TYPES);
  this.markers.clear();
  this.lastSavedContent = undefined;
  return hadData;
}
```

This silently resets to defaults and clears all markers without user consent.

## Desired End State

When the config file contains invalid JSON:
1. A warning dialog appears with message explaining the config is invalid and markers will be lost if reset
2. User has two options: "Reset to Defaults" or "Open Config"
3. If user clicks "Reset to Defaults": reset config and clear markers
4. If user clicks "Open Config": open the config file for manual editing
5. Dialog persists (re-appears on reload attempts) until config is valid or user explicitly resets

### Verification:
- Corrupt the `.vscode/file-markers.json` with invalid JSON
- Reload window or trigger config reload
- Confirm dialog appears with warning message and both options
- Test both button actions work correctly

## What We're NOT Doing

- Differentiating between error types (all invalid JSON treated the same)
- Handling markers that reference unknown marker types (FALLBACK_MARKER is fine)
- Validating individual marker type configs (silent skip is acceptable)
- Handling file-not-found (this is a valid state, use defaults silently)

## Implementation Approach

Modify the error handling in `load()` to distinguish between "file not found" (acceptable) and "invalid JSON" (needs confirmation). Track invalid config state to persist the prompt until resolved.

## Phase 1: Add User Confirmation for Invalid Config

### Overview

Modify the `load()` method to detect invalid JSON specifically and prompt the user for confirmation before resetting.

### Changes Required:

#### 1. Add state tracking and prompt method to MarkerStorage

**File**: `src/storage.ts`
**Changes**: Add property to track invalid config state and method to show confirmation dialog

After line 26 (`private lastSavedContent: string | undefined;`), add:
```typescript
private configInvalid: boolean = false;
```

Add new method after `isValidMarkerTypeConfig()` (after line 136):
```typescript
/**
 * Show confirmation dialog for invalid config
 * Returns true if user chose to reset, false if they want to fix manually
 */
private async promptInvalidConfig(): Promise<boolean> {
  const markerCount = this.markers.size;
  const warningMessage = markerCount > 0
    ? `File Markers configuration is invalid. Resetting will lose ${markerCount} marker${markerCount === 1 ? '' : 's'}.`
    : 'File Markers configuration is invalid.';

  const result = await vscode.window.showWarningMessage(
    warningMessage,
    { modal: false },
    'Reset to Defaults',
    'Open Config'
  );

  if (result === 'Reset to Defaults') {
    return true;
  }

  if (result === 'Open Config' && this.storageUri) {
    await vscode.commands.executeCommand('vscode.open', this.storageUri);
  }

  return false;
}
```

#### 2. Modify load() to handle invalid JSON with confirmation

**File**: `src/storage.ts`
**Changes**: Update the `load()` method to distinguish file-not-found from invalid JSON and prompt user

Replace the `load()` method (lines 82-109) with:
```typescript
/**
 * Load markers from storage. Returns true if data changed, false otherwise.
 */
private async load(): Promise<boolean> {
  if (!this.storageUri) {
    return false;
  }

  let content: Uint8Array;
  try {
    content = await vscode.workspace.fs.readFile(this.storageUri);
  } catch {
    // File doesn't exist - use defaults silently (this is fine)
    this.configInvalid = false;
    const hadData = this.markers.size > 0 || this.markerTypes.size > 0;
    this.loadMarkerTypes(DEFAULT_MARKER_TYPES);
    this.markers.clear();
    this.lastSavedContent = undefined;
    return hadData;
  }

  const contentStr = Buffer.from(content).toString('utf8');

  // Skip reload if this is the content we just saved
  if (this.lastSavedContent && contentStr === this.lastSavedContent) {
    return false;
  }

  let data: unknown;
  try {
    data = JSON.parse(contentStr);
  } catch {
    // Invalid JSON - need user confirmation before resetting
    this.configInvalid = true;
    const shouldReset = await this.promptInvalidConfig();
    if (shouldReset) {
      this.configInvalid = false;
      const hadData = this.markers.size > 0 || this.markerTypes.size > 0;
      this.loadMarkerTypes(DEFAULT_MARKER_TYPES);
      this.markers.clear();
      this.lastSavedContent = undefined;
      this.scheduleSave(); // Save the valid defaults to fix the file
      return hadData;
    }
    // User chose to fix manually - keep existing state, don't change anything
    return false;
  }

  // Valid JSON - reset invalid flag and load data
  this.configInvalid = false;
  const parsed = data as { markerTypes?: MarkerTypeConfig[]; markers?: Record<string, string> };
  this.loadMarkerTypes(parsed.markerTypes || DEFAULT_MARKER_TYPES);
  this.markers = new Map(Object.entries(parsed.markers || {}));
  this.lastSavedContent = undefined;
  return true;
}
```

#### 3. Clear configInvalid flag in initialize()

**File**: `src/storage.ts`
**Changes**: Reset the `configInvalid` flag when initializing for a new workspace

In `initialize()` method, add after line 41 (`this.markers.clear();`):
```typescript
this.configInvalid = false;
```

### Success Criteria:

#### Automated Verification:

- [ ] TypeScript compiles without errors: `pnpm run compile`
- [ ] Linting passes: `pnpm run lint`
- [ ] Existing tests pass: `pnpm test`

#### Manual Verification:

- [ ] Create a marker on a file, then corrupt `.vscode/file-markers.json` with invalid JSON
- [ ] Reload the window - warning dialog appears with marker count in message
- [ ] Click "Open Config" - config file opens in editor
- [ ] Reload again - dialog reappears (persists until fixed)
- [ ] Fix the JSON manually - reload works normally, no dialog
- [ ] Corrupt the JSON again and click "Reset to Defaults" - config is reset, markers cleared, dialog goes away
- [ ] With no markers set, corrupt JSON - dialog shows simpler message without count

---

## Phase 2: Add Unit Tests

### Overview

Add tests to verify the confirmation dialog behavior for invalid config.

### Changes Required:

#### 1. Add tests for invalid config handling

**File**: `src/test/storage.test.ts`
**Changes**: Add test suite for invalid config confirmation

Add new test suite after existing tests:
```typescript
suite('Invalid Config Handling', () => {
  let mockShowWarningMessage: sinon.SinonStub;
  let mockExecuteCommand: sinon.SinonStub;

  setup(() => {
    mockShowWarningMessage = sinon.stub(vscode.window, 'showWarningMessage');
    mockExecuteCommand = sinon.stub(vscode.commands, 'executeCommand');
  });

  teardown(() => {
    mockShowWarningMessage.restore();
    mockExecuteCommand.restore();
  });

  test('shows confirmation when config has invalid JSON', async () => {
    // Write invalid JSON to config file
    const invalidJson = '{ invalid json }';
    await vscode.workspace.fs.writeFile(storageUri!, Buffer.from(invalidJson, 'utf8'));

    mockShowWarningMessage.resolves('Reset to Defaults');

    const storage = new MarkerStorage();
    await storage.initialize();

    assert.ok(mockShowWarningMessage.calledOnce, 'Warning message should be shown');
    const callArgs = mockShowWarningMessage.firstCall.args;
    assert.ok(callArgs[0].includes('invalid'), 'Message should mention invalid config');

    storage.dispose();
  });

  test('resets to defaults when user confirms', async () => {
    // Write invalid JSON
    await vscode.workspace.fs.writeFile(storageUri!, Buffer.from('invalid', 'utf8'));
    mockShowWarningMessage.resolves('Reset to Defaults');

    const storage = new MarkerStorage();
    await storage.initialize();

    // Should have default marker types after reset
    const types = storage.getAllMarkerTypes();
    assert.ok(types.length > 0, 'Should have marker types after reset');
    assert.ok(types.some(t => t.id === 'done'), 'Should have default "done" marker');

    storage.dispose();
  });

  test('opens config when user chooses Open Config', async () => {
    await vscode.workspace.fs.writeFile(storageUri!, Buffer.from('invalid', 'utf8'));
    mockShowWarningMessage.resolves('Open Config');

    const storage = new MarkerStorage();
    await storage.initialize();

    assert.ok(mockExecuteCommand.calledWith('vscode.open'), 'Should open config file');

    storage.dispose();
  });

  test('includes marker count in warning message', async () => {
    // First create valid config with markers
    const validConfig = {
      markerTypes: [{ id: 'test', badge: 'T', color: 'foreground', label: 'Test' }],
      markers: { 'file1.ts': 'test', 'file2.ts': 'test', 'file3.ts': 'test' }
    };
    await vscode.workspace.fs.writeFile(storageUri!, Buffer.from(JSON.stringify(validConfig), 'utf8'));

    const storage = new MarkerStorage();
    await storage.initialize();

    // Now corrupt the config
    await vscode.workspace.fs.writeFile(storageUri!, Buffer.from('corrupted', 'utf8'));
    mockShowWarningMessage.resolves(undefined); // User dismisses

    // Trigger reload by re-initializing
    await storage.initialize();

    const message = mockShowWarningMessage.lastCall?.args[0] || '';
    assert.ok(message.includes('3'), 'Message should include marker count');
    assert.ok(message.includes('markers'), 'Message should mention markers');

    storage.dispose();
  });

  test('does not show dialog for missing config file', async () => {
    // Ensure config file does not exist
    try {
      await vscode.workspace.fs.delete(storageUri!);
    } catch {
      // File may not exist
    }

    const storage = new MarkerStorage();
    await storage.initialize();

    assert.ok(!mockShowWarningMessage.called, 'Should not show warning for missing file');

    storage.dispose();
  });
});
```

### Success Criteria:

#### Automated Verification:

- [ ] All tests pass: `pnpm test`
- [ ] New tests cover the confirmation dialog scenarios

#### Manual Verification:

- [ ] Review test output to confirm new tests are running

---

## Testing Strategy

### Unit Tests:

- Confirm dialog shown for invalid JSON
- Reset to defaults works when confirmed
- Open Config action opens the file
- Marker count included in warning message
- No dialog for missing file (file-not-found is OK)
- State preserved when user dismisses/declines

### Manual Testing Steps:

1. Add markers to a few files
2. Open `.vscode/file-markers.json` and corrupt it (e.g., add invalid syntax)
3. Reload the window
4. Verify dialog appears with correct marker count
5. Click "Open Config" and verify file opens
6. Reload again - verify dialog reappears
7. Fix the JSON and reload - verify no dialog
8. Corrupt again and click "Reset to Defaults"
9. Verify markers are cleared and defaults restored
10. Reload - verify no dialog (config is now valid)

## Performance Considerations

- The confirmation dialog is async and non-blocking
- The `modal: false` option ensures VS Code remains usable while dialog is shown
- No performance impact during normal operation (dialog only shown on error)

## References

- Original request: Add user confirmation before resetting invalid configuration
- Key file: `src/storage.ts:82-109` - current silent error handling
