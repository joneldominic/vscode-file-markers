---
date: 2026-02-01T00:00:00+00:00
researcher: Claude
git_commit: b2ffb137e42540a5f6f19e201f9f7a198ec00635
branch: main
repository: file-marker-vsx
topic: "PRD vs Implementation Comparison"
tags: [research, codebase, prd, implementation-status, feature-comparison]
status: complete
last_updated: 2026-02-01
last_updated_by: Claude
---

# Research: PRD vs Implementation Comparison

**Date**: 2026-02-01
**Researcher**: Claude
**Git Commit**: b2ffb137e42540a5f6f19e201f9f7a198ec00635
**Branch**: main
**Repository**: file-marker-vsx

## Research Question

What is the current state of the codebase compared to the PRD.md feature requirements?

## Summary

The File Markers extension has implemented all P0 (Must Have) features and most P1/P2 features from the PRD. The implementation exceeds the PRD's v1.0.0 scope by including Status Bar Summary (originally P3). Notable differences exist in default marker badges (uses ASCII-safe characters instead of emoji) and custom marker configuration (via storage file instead of `settings.json`). The `fileMarkers.storageLocation` setting is not implemented - storage is file-based only.

## Feature Implementation Status

### P0 (Must Have) - All Implemented

| Feature | PRD Section | Status | Implementation Notes |
|---------|-------------|--------|---------------------|
| F1: Set Marker via Context Menu | Lines 58-69 | **Implemented** | `file-markers.setMarker` command with QuickPick |
| F2: Remove Marker via Context Menu | Lines 75-82 | **Implemented** | `file-markers.removeMarker` command |
| F4: Visual Markers in Explorer | Lines 100-111 | **Implemented** | `MarkerDecorationProvider` with badges, colors, tooltips |
| F5: Default Marker Types | Lines 115-130 | **Implemented** | 6 types with different badges than PRD |
| F7: Workspace Storage | Lines 167-189 | **Partially** | File-based only, no workspaceState option |

### P1 (Should Have) - All Implemented

| Feature | PRD Section | Status | Implementation Notes |
|---------|-------------|--------|---------------------|
| F3: Change Marker via Context Menu | Lines 86-97 | **Implemented** | Uses same `setMarker` command (no separate submenu) |
| F6: Custom Marker Types | Lines 133-163 | **Implemented** | Via `.vscode/file-markers.json`, not `settings.json` |

### P2 (Nice to Have) - All Implemented

| Feature | PRD Section | Status | Implementation Notes |
|---------|-------------|--------|---------------------|
| F8: Bulk Operations | Lines 193-203 | **Implemented** | Multi-select support, `removeMarkersInFolder`, `removeAllMarkers` |
| F9: Marker Inheritance | Lines 209-216 | **Implemented** | `inheritFolderMarkers` setting with dimmed color |
| F10: Quick Toggle via Keyboard | Lines 219-229 | **Implemented** | `Ctrl+Shift+M` / `Cmd+Shift+M` |

### P3 (Future Consideration) - Implemented

| Feature | PRD Section | Status | Implementation Notes |
|---------|-------------|--------|---------------------|
| F11: Status Bar Summary | Lines 232-240 | **Implemented** | Shows counts by type, click to show stats |

## Detailed Findings

### F1: Set Marker via Context Menu

**PRD Requirement (Lines 58-69):**
- Right-click on file/folder shows "Set Marker" submenu
- Submenu displays available marker types
- Selecting a type immediately applies it

**Implementation:**
- Command: `file-markers.setMarker` (`src/commands.ts:10-54`)
- Context menu entry in `package.json:77-80` under group `2_workspace@1`
- Uses VSCode QuickPick instead of submenu (shows badge + label for each type)
- Supports multi-select via `uris` parameter

**Difference:** Uses QuickPick modal instead of submenu, but achieves same UX goal.

### F2: Remove Marker via Context Menu

**PRD Requirement (Lines 75-82):**
- Right-click on marked item shows "Remove Marker" option
- Immediately removes the marker

**Implementation:**
- Command: `file-markers.removeMarker` (`src/commands.ts:56-70`)
- Context menu entry in `package.json:81-84` under group `2_workspace@2`
- Supports multi-select removal

**Status:** Fully implemented as specified.

### F3: Change Marker via Context Menu

**PRD Requirement (Lines 86-97):**
- "Change Marker" submenu with all marker types
- Current marker type indicated (checkmark or highlight)
- Selecting different type updates marker

**Implementation:**
- Same `setMarker` command is used for both setting and changing
- QuickPick shows current marker with "(current)" suffix (`src/commands.ts:37-46`)
- No separate "Change Marker" menu item

**Difference:** Combined into single "Set Marker" flow rather than separate menu paths.

### F4: Visual Markers in Explorer

**PRD Requirement (Lines 100-111):**
- Badge (1-2 chars or emoji) appears next to file/folder name
- Color tints the file/folder name
- Tooltip on hover shows marker label
- Markers persist across restarts
- Markers visible in search results and editor tabs

**Implementation:**
- `MarkerDecorationProvider` (`src/decorationProvider.ts:9-87`)
- Returns `vscode.FileDecoration` with badge, color, tooltip
- Badge truncated to 2 characters (`src/storage.ts:108`)
- Tooltip format: "File Marker: {label}" or with "(inherited from folder)" suffix
- Persistence via `.vscode/file-markers.json`
- `propagate: false` prevents automatic child decoration

**Status:** Fully implemented. VSCode API handles search/tab visibility automatically.

### F5: Default Marker Types

**PRD Requirement (Lines 115-130):**

| ID | PRD Badge | PRD Color |
|----|-----------|-----------|
| done | ✅ | Green |
| in-progress | 🔄 | Yellow |
| pending | ❌ | Red |
| important | ⭐ | Orange |
| review | 👀 | Blue |
| question | ❓ | Purple |

**Implementation (`src/defaults.ts:6-43`):**

| ID | Actual Badge | Actual Color (ThemeColor) |
|----|--------------|---------------------------|
| done | ✓ | `gitDecoration.addedResourceForeground` |
| in-progress | ◐ | `gitDecoration.modifiedResourceForeground` |
| pending | ○ | `gitDecoration.deletedResourceForeground` |
| important | ★ | `editorWarning.foreground` |
| review | ◉ | `editorInfo.foreground` |
| question | ? | `editorHint.foreground` |

**Differences:**
- Badges use Unicode symbols instead of emoji (more compact, consistent cross-platform)
- Colors use ThemeColor IDs instead of named colors (adapts to theme)

### F6: Custom Marker Types

**PRD Requirement (Lines 133-163):**
- Custom markers defined in `settings.json` via `fileMarkers.customMarkers`
- Custom markers appear in context menu alongside defaults

**Implementation:**
- Custom markers defined in `.vscode/file-markers.json` under `markerTypes` array
- The `markerTypes` array in the storage file completely replaces defaults
- No `fileMarkers.customMarkers` setting exists in `package.json`
- "Open Configuration" command (`file-markers.openConfig`) creates/opens the config file

**Difference:** Configuration location differs significantly from PRD. Storage file serves dual purpose (marker data + type definitions).

### F7: Workspace Storage

**PRD Requirement (Lines 167-189):**
- Default: `.vscode/file-markers.json`
- Alternative: VSCode workspace state
- Setting: `fileMarkers.storageLocation`: `"file"` | `"workspaceState"`

**Implementation:**
- Storage file: `.vscode/file-markers.json` (hardcoded at `src/storage.ts:6`)
- No workspaceState option implemented
- No `fileMarkers.storageLocation` setting in `package.json`
- File watching for external changes (`src/storage.ts:56-65`)
- Debounced save (100ms) to prevent rapid writes (`src/storage.ts:162-171`)

**Missing:** `fileMarkers.storageLocation` setting and workspaceState storage mode.

### F8: Bulk Operations

**PRD Requirement (Lines 193-203):**
- Multi-select in Explorer applies marker to all selected
- "Remove All Markers" command in Command Palette
- "Remove Markers in Folder" option for folders

**Implementation:**
- Multi-select support: Commands accept `uris` array (`src/commands.ts:11-16`)
- `file-markers.removeAllMarkers`: Shows confirmation dialog (`src/commands.ts:134-159`)
- `file-markers.removeMarkersInFolder`: Available for folders only (`src/commands.ts:113-132`)

**Status:** Fully implemented as specified.

### F9: Marker Inheritance

**PRD Requirement (Lines 209-216):**
- Setting: `fileMarkers.inheritFolderMarkers` (default: false)
- Unmarked files in marked folder display dimmed version of parent marker
- Explicit file markers override inherited

**Implementation:**
- Setting defined in `package.json:129-133`
- `getEffectiveMarker()` walks parent paths (`src/storage.ts:373-403`)
- Inherited markers use `disabledForeground` color (`src/decorationProvider.ts:7`)
- Tooltip includes "(inherited from folder)" suffix

**Status:** Fully implemented as specified.

### F10: Quick Toggle via Keyboard

**PRD Requirement (Lines 219-229):**
- Default: `Ctrl+Shift+M` / `Cmd+Shift+M`
- Cycles through: no marker → done → in-progress → pending → no marker
- Works on currently active editor file

**Implementation:**
- Keybinding in `package.json:118-125`
- Condition: `editorTextFocus`
- Cycle order: `['done', 'in-progress', 'pending']` (`src/commands.ts:177`)
- Gets active editor URI (`src/commands.ts:167`)

**Status:** Fully implemented as specified.

### F11: Status Bar Summary

**PRD Requirement (Lines 232-240):**
- Status bar shows: "✅ 12 | 🔄 5 | ❌ 8"
- Click opens quick pick to filter Explorer by marker type

**Implementation:**
- `StatusBarManager` class (`src/statusBar.ts:4-140`)
- Shows badge + count for each type (e.g., "✓ 2 | ◐ 1")
- Setting: `fileMarkers.statusBarAlignment` (left/right)
- Click shows `showMarkerStats` QuickPick with all counts
- No Explorer filtering on selection (just displays stats)

**Difference:** No Explorer filtering feature, just displays statistics.

## Settings Comparison

**PRD Settings (Lines 346-379):**

| Setting | PRD | Implementation |
|---------|-----|----------------|
| `fileMarkers.enabled` | boolean, default true | **Not implemented** |
| `fileMarkers.storageLocation` | "file" \| "workspaceState" | **Not implemented** |
| `fileMarkers.showInTabs` | boolean, default true | **Not implemented** |
| `fileMarkers.defaultMarkers` | array | **Not implemented** |
| `fileMarkers.customMarkers` | array | **Not implemented** (uses config file) |
| `fileMarkers.inheritFolderMarkers` | boolean, default false | **Implemented** |
| `fileMarkers.statusBarAlignment` | - | **Added** (not in PRD) |

## Code References

- Entry point: `src/extension.ts:11` - `activate()` function
- Decoration provider: `src/decorationProvider.ts:9-87`
- Storage: `src/storage.ts:18-457`
- Commands: `src/commands.ts:10-197`
- Status bar: `src/statusBar.ts:4-140`
- Default marker types: `src/defaults.ts:6-43`
- Type definitions: `src/types.ts:6-37`
- Package contributions: `package.json:44-145`

## Architecture Documentation

The implementation follows the architecture outlined in the CLAUDE.md file:

1. **FileDecorationProvider** - Implements `vscode.FileDecorationProvider` with caching via in-memory Maps
2. **MarkerStorage** - File-based only, manages `.vscode/file-markers.json`
3. **Context Menu Commands** - Registered in `package.json` under `explorer/context` group `2_workspace`
4. **Data Flow** - User action → Command → MarkerStorage → Event → Decoration refresh

**Event-Driven Architecture:**
- `MarkerStorage._onDidChangeMarkers` fires on any marker change
- `MarkerDecorationProvider` and `StatusBarManager` subscribe to this event
- Decoration provider fires `onDidChangeFileDecorations` to trigger VSCode refresh

## Implementation Beyond PRD

Features implemented that were not in PRD v1.0:
1. `fileMarkers.statusBarAlignment` setting
2. File system watcher for external config changes
3. Debounced reload for external file modifications
4. "Open Configuration" command for easy config access
5. Fallback marker for unknown/orphaned marker IDs

## Open Questions

1. Should `fileMarkers.storageLocation` setting be added for workspaceState support?
2. Should `fileMarkers.enabled` setting be implemented for quick disable?
3. Should custom markers via `settings.json` (`fileMarkers.customMarkers`) be supported in addition to config file?
4. Should Explorer filtering by marker type be added to status bar click action?
