# Fix Config File Being Overwritten with Default Values

## Overview

When users manually edit `.vscode/file-markers.json` to customize marker types, their changes get overwritten with the in-memory values (often defaults) when any marker operation occurs. This happens because the extension doesn't watch for external file changes and always saves its in-memory state, which may be stale.

## Current State Analysis

### The Problem Flow

1. Extension loads `.vscode/file-markers.json` at initialization
2. Marker types are cached in memory (`markerTypes` Map in `storage.ts:19`)
3. User manually edits the config file (e.g., adds custom marker, changes badge)
4. User performs a marker action (set/remove marker on a file)
5. `save()` writes the **stale in-memory** `markerTypes` back to the file
6. User's customizations are lost

### Root Cause

`storage.ts:97-126` - The `save()` method serializes the in-memory `markerTypes` Map to the file on every marker operation, with no mechanism to:
1. Detect external file changes
2. Reload marker types when file is modified
3. Preserve user edits made outside the extension

### Key Discoveries

- **No file watcher**: There's no `FileSystemWatcher` for the config file
- **Write always includes types**: `save()` always writes both `markerTypes` and `markers` to the file
- **Stale memory state**: In-memory `markerTypes` can become stale when user edits file externally

## Desired End State

When a user manually edits `.vscode/file-markers.json`:
1. The extension detects the change and reloads the file
2. Custom marker types persist across marker operations
3. Users can add, modify, or remove marker types and see changes immediately
4. The extension never overwrites user customizations

### Verification

1. Add a custom marker type to `.vscode/file-markers.json`
2. Set a marker on a file using the context menu
3. Verify the custom marker type is still present in the config file
4. Verify the custom marker type appears in the marker selection QuickPick

## What We're NOT Doing

- Adding a UI for editing marker types (that's a separate feature)
- Validating marker type uniqueness or conflicts
- Supporting hot-reload of markers already applied to files
- Adding schema validation for the config file

## Implementation Approach

Add a file system watcher to reload marker types when `.vscode/file-markers.json` is modified externally. This is the simplest, most robust solution that aligns with how VSCode extensions typically handle configuration files.

## Phase 1: Add File System Watcher for Config File

### Overview

Add a `FileSystemWatcher` to detect when `.vscode/file-markers.json` is modified, and reload the file contents when changes are detected.

### Changes Required

#### 1. Add file watcher to MarkerStorage

**File**: `src/storage.ts`

**Changes**:
- Add a `FileSystemWatcher` instance
- Create watcher in `initialize()` when workspace is available
- Reload file when changes detected
- Add debouncing to avoid conflicts with our own writes
- Dispose watcher properly

```typescript
// Add after line 23 (writeDebounceTimer declaration)
private configWatcher: vscode.FileSystemWatcher | undefined;
private reloadDebounceTimer: NodeJS.Timeout | undefined;
private ignoreNextFileChange = false;
```

**In `initialize()` method (after line 49, before `await this.load()`)**:
```typescript
// Dispose old watcher if exists
this.configWatcher?.dispose();

// Create file system watcher for config file
this.configWatcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(workspaceFolder, '.vscode/file-markers.json')
);

this.disposables.push(this.configWatcher);

// Reload when file is changed externally
this.configWatcher.onDidChange(() => this.scheduleReload());
this.configWatcher.onDidCreate(() => this.scheduleReload());
this.configWatcher.onDidDelete(() => this.scheduleReload());
```

**Add new `scheduleReload()` method (after `scheduleSave()` around line 137)**:
```typescript
/**
 * Schedule a reload of the config file (debounced to avoid conflicts with our own writes)
 */
private scheduleReload(): void {
  // If we just wrote the file, ignore this change
  if (this.ignoreNextFileChange) {
    this.ignoreNextFileChange = false;
    return;
  }

  if (this.reloadDebounceTimer) {
    clearTimeout(this.reloadDebounceTimer);
  }
  this.reloadDebounceTimer = setTimeout(() => {
    this.load().then(() => {
      // Notify that markers may have changed (types may have changed too)
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        this._onDidChangeMarkers.fire({ uri: workspaceFolder.uri, markerId: undefined });
      }
    }).catch(err => {
      console.error('Failed to reload markers:', err);
    });
  }, 100);
}
```

**Modify `save()` method to set ignore flag (at line 125, before writeFile)**:
```typescript
// Set flag to ignore the file change event triggered by our own write
this.ignoreNextFileChange = true;
await vscode.workspace.fs.writeFile(this.storageUri, content);
```

**Update `dispose()` method (around line 390)**:
```typescript
dispose(): void {
  if (this.writeDebounceTimer) {
    clearTimeout(this.writeDebounceTimer);
  }
  if (this.reloadDebounceTimer) {
    clearTimeout(this.reloadDebounceTimer);
  }
  this.configWatcher?.dispose();
  this._onDidChangeMarkers.dispose();
  this.disposables.forEach(d => d.dispose());
}
```

### Success Criteria

#### Automated Verification

- [x] TypeScript compilation passes: `pnpm run compile`
- [x] Linting passes: `pnpm run lint`
- [x] Existing tests pass: `pnpm test`

#### Manual Verification

- [x] Add a custom marker type to `.vscode/file-markers.json`, save, then set a marker on a file - custom marker type should still be in the file
- [ ] Modify an existing marker type's badge in the config file - the change should appear in the QuickPick immediately
- [ ] Delete a marker type from the config file - it should no longer appear in the QuickPick
- [x] The extension doesn't spam reloads when setting markers rapidly

---

## Phase 2: Add Event for Marker Type Changes (Optional Enhancement)

**SKIPPED** - Phase 1 implementation is sufficient. The current approach already handles marker type changes via the existing `onDidChangeMarkers` event.

### Overview

Add a separate event emitter for marker type changes so the decoration provider and status bar can respond appropriately to marker type modifications (e.g., update badge colors).

**Note**: This phase is optional. The basic fix in Phase 1 will work because we fire a general change event when reloading. This phase adds cleaner separation of concerns.

### Changes Required

#### 1. Add marker type change event

**File**: `src/storage.ts`

**Add new event emitter after line 26**:
```typescript
private readonly _onDidChangeMarkerTypes = new vscode.EventEmitter<void>();
readonly onDidChangeMarkerTypes = this._onDidChangeMarkerTypes.event;
```

**Fire event in `loadMarkerTypes()` at the end of the method (after line 81)**:
```typescript
this._onDidChangeMarkerTypes.fire();
```

**Dispose in `dispose()` method**:
```typescript
this._onDidChangeMarkerTypes.dispose();
```

#### 2. Listen for type changes in DecorationProvider

**File**: `src/decorationProvider.ts`

**Add listener in constructor (around line 24)**:
```typescript
this.disposables.push(
  storage.onDidChangeMarkerTypes(() => {
    this.refresh();
  })
);
```

### Success Criteria

#### Automated Verification

- [ ] TypeScript compilation passes: `pnpm run compile`
- [ ] Linting passes: `pnpm run lint`
- [ ] Existing tests pass: `pnpm test`

#### Manual Verification

- [ ] Change a marker type's color in the config file - decorations update immediately with new color
- [ ] Adding new marker type shows up in QuickPick without needing to set a marker first

---

## Testing Strategy

### Unit Tests

Add tests in `src/test/storage.test.ts`:
- Test that `scheduleReload` is called when file changes (mock FileSystemWatcher)
- Test that `ignoreNextFileChange` flag prevents reload after internal save

### Integration Tests

- Modify config file externally and verify marker types are reloaded
- Rapid marker operations don't cause reload loops

### Manual Testing Steps

1. Start extension in development mode (F5)
2. Create a workspace with some files
3. Set a marker on a file (creates initial config)
4. Open `.vscode/file-markers.json`
5. Add a new marker type:
   ```json
   {
     "id": "custom",
     "badge": "⚡",
     "color": "terminal.ansiMagenta",
     "label": "Custom"
   }
   ```
6. Save the file
7. Right-click another file → "Set Marker" → Verify "Custom" appears in list
8. Select "Custom" marker
9. Open the config file again → Verify custom marker type is still there
10. Repeat steps 7-9 to ensure no regression

## Performance Considerations

- File watcher is lightweight (uses OS-level file events)
- Debounce reload at 100ms to match write debounce
- `ignoreNextFileChange` flag prevents redundant reloads after our own writes
- Only one watcher per workspace (not per file)

## References

- VSCode FileSystemWatcher API: https://code.visualstudio.com/api/references/vscode-api#FileSystemWatcher
- Similar pattern: VSCode's own settings.json watching
