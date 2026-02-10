# Fix Toggle Marker Not Using Configuration

## Overview

The `toggleMarker` command uses hardcoded marker IDs (`['done', 'in-progress', 'pending']`) instead of cycling through all configured marker types. This plan fixes the command to cycle through all markers defined in `.vscode/file-markers.json`.

## Current State Analysis

**Bug Location**: `src/commands.ts:186`
```typescript
const cycleOrder = ['done', 'in-progress', 'pending']; // HARDCODED!
```

**Expected Behavior**: Toggle should cycle through ALL configured marker types in order.

### Key Discoveries:

- `src/commands.ts:186` - Hardcoded cycle order ignores all configuration
- `src/commands.ts:22` - `setMarker` command correctly uses `storage.getAllMarkerTypes()`
- `src/storage.ts:205-207` - `getAllMarkerTypes()` returns configured markers in order

## Desired End State

1. Toggle cycles through all marker types from config: done → in-progress → pending → important → review → question → remove → done
2. Users can customize the cycle by editing `markerTypes` array order in config
3. No new settings or configuration needed

### Verification:

- Toggle cycles through all 6 default markers then removes
- Reordering `markerTypes` in config changes the toggle order
- Adding/removing marker types updates the toggle cycle

## What We're NOT Doing

- Adding new configuration options
- Changing storage format
- Modifying default markers

## Implementation Approach

Single phase: Update `toggleMarker` command to use `storage.getAllMarkerTypes()` instead of hardcoded array.

---

## Phase 1: Update Toggle Command Logic

### Overview

Modify the `toggleMarker` command to cycle through all configured marker types.

### Changes Required:

#### 1. Update toggleMarker command

**File**: `src/commands.ts`
**Changes**: Replace hardcoded cycle with `storage.getAllMarkerTypes()`

Replace lines 185-202 (the cycle logic) with:

```typescript
      // Get all configured marker types for cycling
      const allMarkerTypes = storage.getAllMarkerTypes();
      const cycleOrder = allMarkerTypes.map(m => m.id);

      if (cycleOrder.length === 0) {
        vscode.window.showWarningMessage(
          'No marker types configured. Open configuration to add marker types.'
        );
        return;
      }

      if (!currentMarkerId) {
        // No marker → apply first in cycle
        storage.setMarker(uri, cycleOrder[0]);
      } else {
        const currentIndex = cycleOrder.indexOf(currentMarkerId);
        if (currentIndex === -1) {
          // Current marker not in cycle (unknown/removed type) → remove it
          storage.removeMarker(uri);
        } else if (currentIndex === cycleOrder.length - 1) {
          // Last in cycle → remove marker
          storage.removeMarker(uri);
        } else {
          // Move to next in cycle
          storage.setMarker(uri, cycleOrder[currentIndex + 1]);
        }
      }
```

**Full command block** (lines 161-206) becomes:

```typescript
  // Toggle Marker command (keyboard shortcut)
  // Cycles through all configured markers, then removes
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
        if (!editor) {
          vscode.window.showWarningMessage('No active file to toggle marker.');
          return;
        }

        const uri = editor.document.uri;
        const currentMarkerId = storage.getMarker(uri);

        // Get all configured marker types for cycling
        const allMarkerTypes = storage.getAllMarkerTypes();
        const cycleOrder = allMarkerTypes.map(m => m.id);

        if (cycleOrder.length === 0) {
          vscode.window.showWarningMessage(
            'No marker types configured. Open configuration to add marker types.'
          );
          return;
        }

        if (!currentMarkerId) {
          // No marker → apply first in cycle
          storage.setMarker(uri, cycleOrder[0]);
        } else {
          const currentIndex = cycleOrder.indexOf(currentMarkerId);
          if (currentIndex === -1) {
            // Current marker not in cycle (unknown/removed type) → remove it
            storage.removeMarker(uri);
          } else if (currentIndex === cycleOrder.length - 1) {
            // Last in cycle → remove marker
            storage.removeMarker(uri);
          } else {
            // Move to next in cycle
            storage.setMarker(uri, cycleOrder[currentIndex + 1]);
          }
        }
      }
    )
  );
```

### Success Criteria:

#### Automated Verification:

- [x] Extension compiles: `pnpm run compile`
- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] All tests pass: `pnpm test`

#### Manual Verification:

- [x] Toggle cycles through all 6 default markers: done → in-progress → pending → important → review → question → remove
- [x] Reordering `markerTypes` in config changes toggle order
- [x] Removing a marker type from config removes it from toggle cycle
- [x] File with unknown marker type (removed from config) gets marker removed on toggle
- [x] **Live config changes**: Edit config while extension is running, verify toggle immediately uses updated marker types (no restart needed)

---

## Testing Strategy

### Existing Tests:

The existing `toggleMarker command` tests in `src/test/commands.test.ts` should continue to pass since the default markers include `done`, `in-progress`, and `pending` in that order.

### Manual Testing Steps:

1. **Default cycle**: Toggle through all 6 markers → done → in-progress → pending → important → review → question → remove → done
2. **Custom order**: Edit `.vscode/file-markers.json`, reorder `markerTypes` array, verify toggle follows new order
3. **Reduced set**: Remove some marker types from config, verify toggle only cycles through remaining ones
4. **Unknown marker**: Mark file, then remove that marker type from config, toggle should remove the marker
5. **Live reload**: While extension is running, edit config to add/remove/reorder markers, verify toggle immediately reflects changes (no restart needed)

## References

- Bug location: `src/commands.ts:186`
- Marker types getter: `src/storage.ts:205-207` (`getAllMarkerTypes()`)
