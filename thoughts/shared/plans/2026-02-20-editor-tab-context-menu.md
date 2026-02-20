# Editor Tab Context Menu Support Implementation Plan

## Overview

Add "Set Marker..." and "Remove Marker" commands to the editor tab right-click context menu (`editor/title/context`), so users can mark files directly from open tabs without navigating to the Explorer panel.

## Current State Analysis

- The extension registers `setMarker` and `removeMarker` in `explorer/context` menu (`package.json:100-115`)
- Both command handlers already accept `(uri: vscode.Uri, uris?: vscode.Uri[])` (`commands.ts:13`, `commands.ts:60`)
- VSCode passes `resourceUri` as the first argument for `editor/title/context` commands — same pattern as `explorer/context`
- No `editor/title/context` menu contribution exists currently

### Key Discovery

The existing command handlers are fully compatible with `editor/title/context` invocation. No TypeScript changes are needed — this is a `package.json`-only change.

## What We're NOT Doing

- Not adding `removeMarkersInFolder` to tabs (tabs are files, not folders)
- Not adding line highlight commands to the tab menu (those are editor-content operations)
- Not modifying any TypeScript source files

## Implementation Approach

Add an `editor/title/context` section to the `menus` contribution in `package.json` with the same two commands and `when` clause used in the explorer context menu.

## Phase 1: Add editor/title/context Menu Entries

### Overview

Register `setMarker` and `removeMarker` in the `editor/title/context` menu group in `package.json`.

### Changes Required

**File**: `package.json`
**Location**: `contributes.menus` section (after `explorer/context` block, line 116)

Add new `editor/title/context` entry:

```json
"editor/title/context": [
  {
    "command": "file-markers.setMarker",
    "group": "2_workspace@1",
    "when": "config.fileMarkers.enabled"
  },
  {
    "command": "file-markers.removeMarker",
    "group": "2_workspace@2",
    "when": "config.fileMarkers.enabled"
  }
]
```

No other files need changes.

### Success Criteria

#### Automated Verification

- [x] TypeScript compiles: `pnpm run compile`
- [x] Linting passes: `pnpm run lint`
- [x] Tests pass: `pnpm test`

#### Manual Verification

- [ ] Right-click an editor tab → "File Markers: Set Marker..." appears in context menu
- [ ] Selecting "Set Marker..." shows the QuickPick with marker type options
- [ ] Choosing a marker type applies the marker (badge/color visible in Explorer)
- [ ] Right-click an editor tab → "File Markers: Remove Marker" appears in context menu
- [ ] Selecting "Remove Marker" removes the marker from the file
- [ ] Both menu items are hidden when `fileMarkers.enabled` is `false`
- [ ] Multi-tab selection: right-click with multiple tabs selected applies/removes markers on all selected tabs

## References

- VSCode `editor/title/context` menu docs: contributes.menus API
- Existing explorer context menu: `package.json:100-115`
- Command handlers: `src/commands.ts:11-69`
