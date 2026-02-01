# Enable/Disable Toggle Setting Implementation Plan

## Overview

Add a `fileMarkers.enabled` setting that allows users to quickly disable the extension without uninstalling it. Include a toggle command and enhanced status bar menu with enable/disable and configuration options.

## Current State Analysis

- Extension has no way to disable without uninstalling
- Status bar shows marker counts via `showStats()` QuickPick
- Context menus always visible in Explorer
- Configuration changes already trigger decoration refresh via `onDidChangeConfiguration`

## Desired End State

1. `fileMarkers.enabled` setting (boolean, default: `true`) in VSCode Settings UI
2. `file-markers.toggleEnabled` command to flip the setting
3. When disabled:
   - No badges/colors shown in Explorer
   - Status bar shows "File Markers: Disabled" (still clickable)
   - Context menu items hidden
   - Keyboard shortcut shows warning toast
4. Status bar click menu includes:
   - Marker statistics (existing)
   - "Enable/Disable File Markers" option
   - "Open Configuration" option

### Verification

- Toggle setting in Settings UI → decorations appear/disappear
- Run toggle command → setting flips, UI updates
- When disabled: right-click Explorer → no File Markers menu items
- When disabled: press `Ctrl+Shift+M` → warning toast appears
- Click status bar → menu shows toggle and config options

## What We're NOT Doing

- Storing enabled state in `.vscode/file-markers.json` (using VSCode settings instead)
- Adding a separate enable/disable button to the status bar
- Disabling the extension at the VSCode extension level

## Implementation Approach

Add the setting and command registration first, then update each component to respect the enabled state. Use VSCode's built-in `when` clause for context menu visibility.

---

## Phase 1: Add Setting and Command

### Overview

Define the `fileMarkers.enabled` setting in package.json and register the toggle command.

### Changes Required:

#### 1. Package.json - Add Setting

**File**: `package.json`
**Section**: `contributes.configuration.properties`

Add after `fileMarkers.statusBarAlignment`:

```json
"fileMarkers.enabled": {
  "type": "boolean",
  "default": true,
  "description": "Enable or disable File Markers. When disabled, markers are hidden but preserved."
}
```

#### 2. Package.json - Add Command

**File**: `package.json`
**Section**: `contributes.commands`

Add new command:

```json
{
  "command": "file-markers.toggleEnabled",
  "title": "File Markers: Toggle Enable/Disable"
}
```

#### 3. Package.json - Add to Command Palette

**File**: `package.json`
**Section**: `contributes.menus.commandPalette`

Add entry (no `when` clause so it's always visible):

```json
{
  "command": "file-markers.toggleEnabled"
}
```

#### 4. Package.json - Hide Context Menus When Disabled

**File**: `package.json`
**Section**: `contributes.menus.explorer/context`

Update each entry to add `when` clause:

```json
{
  "command": "file-markers.setMarker",
  "group": "2_workspace@1",
  "when": "config.fileMarkers.enabled"
},
{
  "command": "file-markers.removeMarker",
  "group": "2_workspace@2",
  "when": "config.fileMarkers.enabled"
},
{
  "command": "file-markers.removeMarkersInFolder",
  "group": "2_workspace@3",
  "when": "explorerResourceIsFolder && config.fileMarkers.enabled"
}
```

#### 5. Extension.ts - Register Toggle Command

**File**: `src/extension.ts`

Add toggle command registration after status bar command (around line 39):

```typescript
// Register toggle enabled command
context.subscriptions.push(
  vscode.commands.registerCommand('file-markers.toggleEnabled', async () => {
    const config = vscode.workspace.getConfiguration('fileMarkers');
    const currentValue = config.get<boolean>('enabled', true);
    await config.update('enabled', !currentValue, vscode.ConfigurationTarget.Workspace);

    const newState = !currentValue ? 'enabled' : 'disabled';
    vscode.window.showInformationMessage(`File Markers ${newState}.`);
  })
);
```

### Success Criteria:

#### Automated Verification:

- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] Extension compiles: `pnpm run compile`

#### Manual Verification:

- [x] Setting appears in Settings UI under "File Markers"
- [x] Toggle command appears in Command Palette
- [x] Running toggle command flips the setting value
- [x] Context menu items hidden when `fileMarkers.enabled` is false

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Update Decoration Provider

### Overview

Make the decoration provider return `undefined` when disabled, hiding all badges and colors.

### Changes Required:

#### 1. DecoratorProvider.ts - Check Enabled State

**File**: `src/decorationProvider.ts`

Update `provideFileDecoration` method to check enabled state first (add at line 42, before getting effective marker):

```typescript
provideFileDecoration(
  uri: vscode.Uri,
  _token: vscode.CancellationToken
): vscode.ProviderResult<vscode.FileDecoration> {
  // Check if extension is enabled
  const config = vscode.workspace.getConfiguration('fileMarkers');
  if (!config.get<boolean>('enabled', true)) {
    return undefined;
  }

  const effective = this.storage.getEffectiveMarker(uri);
  // ... rest of method unchanged
}
```

#### 2. DecoratorProvider.ts - Listen for Enabled Config Change

**File**: `src/decorationProvider.ts`

Update the configuration change listener (around line 30-34) to also refresh on `enabled` change:

```typescript
this.disposables.push(
  vscode.workspace.onDidChangeConfiguration(event => {
    if (
      event.affectsConfiguration('fileMarkers.enabled') ||
      event.affectsConfiguration('fileMarkers.inheritFolderMarkers')
    ) {
      this.refresh();
    }
  })
);
```

### Success Criteria:

#### Automated Verification:

- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] Extension compiles: `pnpm run compile`

#### Manual Verification:

- [x] When `fileMarkers.enabled` is true: badges and colors visible
- [x] When `fileMarkers.enabled` is false: no badges or colors shown
- [x] Toggling setting immediately updates Explorer (no reload needed)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Update Status Bar

### Overview

Show "File Markers: Disabled" when disabled, and enhance the `showStats()` menu with toggle and configuration options.

### Changes Required:

#### 1. StatusBar.ts - Update Method to Handle Disabled State

**File**: `src/statusBar.ts`

Update the `update()` method (starting at line 53) to check enabled state first:

```typescript
update(): void {
  const config = vscode.workspace.getConfiguration('fileMarkers');
  const isEnabled = config.get<boolean>('enabled', true);

  if (!isEnabled) {
    this.statusBarItem.text = '$(circle-slash) File Markers: Disabled';
    this.statusBarItem.tooltip = 'Click to enable or configure File Markers';
    return;
  }

  // ... existing code for showing marker counts
}
```

#### 2. StatusBar.ts - Listen for Enabled Config Change

**File**: `src/statusBar.ts`

Update the configuration change listener (around line 20-26) to also update on `enabled` change:

```typescript
this.disposables.push(
  vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('fileMarkers.statusBarAlignment')) {
      this.recreateStatusBarItem();
    }
    if (event.affectsConfiguration('fileMarkers.enabled')) {
      this.update();
    }
  })
);
```

#### 3. StatusBar.ts - Enhance showStats() Menu

**File**: `src/statusBar.ts`

Rewrite `showStats()` method (starting at line 87) to include toggle and config options:

```typescript
async showStats(): Promise<void> {
  const config = vscode.workspace.getConfiguration('fileMarkers');
  const isEnabled = config.get<boolean>('enabled', true);

  const items: vscode.QuickPickItem[] = [];

  // Add action items at the top
  items.push({
    label: isEnabled ? '$(circle-slash) Disable File Markers' : '$(check) Enable File Markers',
    description: isEnabled ? 'Hide all markers' : 'Show markers again',
    alwaysShow: true,
  });

  items.push({
    label: '$(gear) Open Configuration',
    description: 'Edit marker types and settings',
    alwaysShow: true,
  });

  // Add separator before stats (only if enabled and has markers)
  if (isEnabled) {
    const counts = this.storage.getMarkerCountsByType();
    const total = this.storage.getMarkerCount();

    if (total > 0) {
      items.push({
        label: '',
        kind: vscode.QuickPickItemKind.Separator,
      });

      items.push({
        label: `Total: ${total} marker${total === 1 ? '' : 's'}`,
        kind: vscode.QuickPickItemKind.Separator,
      });

      // Add each marker type with count
      const markerTypes = this.storage.getAllMarkerTypes();
      for (const markerType of markerTypes) {
        const count = counts.get(markerType.id) ?? 0;
        if (count > 0) {
          items.push({
            label: `${markerType.badge} ${markerType.label}`,
            description: `${count} file${count === 1 ? '' : 's'}`,
          });
        }
      }

      // Handle unknown markers
      let unknownCount = 0;
      const unknownTypes: string[] = [];
      for (const [markerId, count] of counts) {
        if (!markerTypes.some(m => m.id === markerId)) {
          unknownCount += count;
          unknownTypes.push(markerId);
        }
      }
      if (unknownCount > 0) {
        items.push({
          label: '$(warning) Unknown markers',
          description: `${unknownCount} file${unknownCount === 1 ? '' : 's'} (${unknownTypes.join(', ')})`,
        });
      }
    }
  }

  const selected = await vscode.window.showQuickPick(items, {
    title: 'File Markers',
    placeHolder: isEnabled ? 'Marker statistics and options' : 'File Markers is disabled',
  });

  // Handle selection
  if (selected) {
    if (selected.label.includes('Disable File Markers') || selected.label.includes('Enable File Markers')) {
      await vscode.commands.executeCommand('file-markers.toggleEnabled');
    } else if (selected.label.includes('Open Configuration')) {
      await vscode.commands.executeCommand('file-markers.openConfig');
    }
  }
}
```

### Success Criteria:

#### Automated Verification:

- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] Extension compiles: `pnpm run compile`

#### Manual Verification:

- [x] When disabled: status bar shows "File Markers: Disabled" with $(circle-slash) icon
- [x] When enabled: status bar shows marker counts as before
- [x] Click status bar → menu shows "Enable/Disable" option at top
- [x] Click status bar → menu shows "Open Configuration" option
- [x] Selecting "Disable" from menu disables extension
- [x] Selecting "Open Configuration" opens the config file

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Update Toggle Command for Warning Toast

### Overview

Update the keyboard shortcut handler to show a warning toast when the extension is disabled.

### Changes Required:

#### 1. Commands.ts - Add Enabled Check to Toggle Marker

**File**: `src/commands.ts`

Update the `toggleMarker` command handler (around line 166) to check enabled state:

```typescript
// Toggle Marker command (keyboard shortcut)
// Cycles: no marker → done → in-progress → pending → no marker
context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.toggleMarker',
    () => {
      // Check if extension is enabled
      const config = vscode.workspace.getConfiguration('fileMarkers');
      if (!config.get<boolean>('enabled', true)) {
        vscode.window.showWarningMessage(
          'File Markers is disabled. Enable it in settings or run "File Markers: Toggle Enable/Disable".'
        );
        return;
      }

      const editor = vscode.window.activeTextEditor;
      // ... rest of method unchanged
    }
  )
);
```

### Success Criteria:

#### Automated Verification:

- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] Extension compiles: `pnpm run compile`

#### Manual Verification:

- [x] When enabled: `Ctrl+Shift+M` cycles markers as before
- [x] When disabled: `Ctrl+Shift+M` shows warning toast
- [x] Warning message mentions how to re-enable

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Add Tests

### Overview

Add unit tests for the enabled/disabled behavior.

### Changes Required:

#### 1. Create New Test File

**File**: `src/test/enabled.test.ts`

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Enabled Setting Tests', () => {
  const getConfig = () => vscode.workspace.getConfiguration('fileMarkers');

  setup(async () => {
    // Reset to enabled state before each test
    await getConfig().update('enabled', true, vscode.ConfigurationTarget.Workspace);
  });

  teardown(async () => {
    // Reset to enabled state after each test
    await getConfig().update('enabled', true, vscode.ConfigurationTarget.Workspace);
  });

  test('enabled setting defaults to true', () => {
    const config = getConfig();
    const enabled = config.get<boolean>('enabled');
    assert.strictEqual(enabled, true);
  });

  test('toggle command flips enabled state', async () => {
    const config = getConfig();
    assert.strictEqual(config.get<boolean>('enabled'), true);

    await vscode.commands.executeCommand('file-markers.toggleEnabled');

    // Need to re-fetch config after change
    const updatedConfig = getConfig();
    assert.strictEqual(updatedConfig.get<boolean>('enabled'), false);
  });

  test('toggle command flips back to enabled', async () => {
    const config = getConfig();
    await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

    await vscode.commands.executeCommand('file-markers.toggleEnabled');

    const updatedConfig = getConfig();
    assert.strictEqual(updatedConfig.get<boolean>('enabled'), true);
  });
});
```

### Success Criteria:

#### Automated Verification:

- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] Extension compiles: `pnpm run compile`
- [x] Tests pass: `pnpm test`

#### Manual Verification:

- [x] All new tests pass in test runner

---

## Testing Strategy

### Unit Tests:

- Enabled setting default value
- Toggle command flips state correctly
- Toggle command flips back

### Integration Tests:

- Decoration provider returns undefined when disabled
- Status bar updates when enabled state changes

### Manual Testing Steps:

1. Open extension in debug mode
2. Verify markers are visible (default enabled)
3. Open Settings, search "fileMarkers.enabled", uncheck it
4. Verify markers disappear, status bar shows "Disabled"
5. Right-click in Explorer → verify no File Markers menu items
6. Press `Ctrl+Shift+M` → verify warning toast appears
7. Click status bar → verify menu has Enable/Disable and Open Config options
8. Select "Enable File Markers" from menu → verify markers reappear
9. Run "File Markers: Toggle Enable/Disable" from Command Palette → verify it toggles

## Performance Considerations

- Configuration reads are cached by VSCode, so `getConfiguration()` is fast
- No additional file I/O or API calls added
- Decoration provider early-return when disabled avoids unnecessary processing

## References

- PRD Feature F7 mentions `fileMarkers.enabled` setting
- Similar pattern used by many VSCode extensions (e.g., ESLint, Prettier)
- VSCode `when` clause documentation: https://code.visualstudio.com/api/references/when-clause-contexts
