# Product Requirements Document: VSCode File Markers Extension

## Overview

**Product Name:** File Markers (working title)

**Version:** 1.0.0

**Author:** Jonel

**Date:** January 31, 2025

---

## Problem Statement

Developers working on large codebases, migrations, or refactoring projects need a way to visually track the status of individual files and folders directly in VSCode's Explorer panel. Current solutions either require manual configuration in settings files or display markers in a separate sidebar rather than inline with the file tree.

### Current Pain Points

1. **Manual configuration is tedious** — Extensions like Folder Path Color require editing `settings.json` for every file/folder
2. **Separate sidebars add friction** — Favorites-style extensions show marked items in a different view, not inline with the Explorer
3. **No quick toggle** — No existing solution allows right-click → add/remove marker workflow
4. **Context switching** — Developers lose focus when they need to track migration/refactoring progress outside the natural file browsing flow

---

## Target Users

- Developers performing codebase migrations (e.g., strangler pattern, framework upgrades)
- Teams tracking refactoring progress across multiple files
- Individual developers who want to flag files for review, TODO, or any custom workflow
- Anyone who needs visual organization in large monorepos or complex project structures

---

## Goals

1. **Inline visibility** — Markers appear directly in the Explorer tree next to file/folder names
2. **Instant interaction** — Right-click context menu to add, change, or remove markers
3. **Zero configuration to start** — Works out of the box with sensible defaults
4. **Customizable** — Users can define their own marker types (icons, colors, labels)
5. **Workspace-scoped** — Markers are saved per workspace, optionally committable to version control

---

## Non-Goals (v1.0)

- Syncing markers across machines (beyond version control)
- Integration with issue trackers or project management tools
- Marker statistics or reporting dashboards
- Collaborative real-time marker sharing

---

## Feature Requirements

### F1: Add Marker via Context Menu

**Priority:** P0 (Must Have)

**Description:** Users can right-click any file or folder in the Explorer and select "Add Marker" to apply a visual marker.

**Acceptance Criteria:**
- Right-click on file → shows "Add Marker" submenu
- Right-click on folder → shows "Add Marker" submenu
- Submenu displays available marker types (e.g., ✅ Done, 🔄 In Progress, ❌ Pending, ⭐ Important)
- Selecting a marker type immediately applies it
- Marker appears inline next to the file/folder name in Explorer

---

### F2: Remove Marker via Context Menu

**Priority:** P0 (Must Have)

**Description:** Users can right-click a marked file/folder and remove the marker.

**Acceptance Criteria:**
- Right-click on marked item → shows "Remove Marker" option
- Selecting "Remove Marker" immediately removes the marker
- File/folder returns to default appearance

---

### F3: Change Marker via Context Menu

**Priority:** P1 (Should Have)

**Description:** Users can change an existing marker without removing it first.

**Acceptance Criteria:**
- Right-click on marked item → shows "Change Marker" submenu
- Submenu displays all available marker types
- Current marker type is indicated (checkmark or highlight)
- Selecting a different type immediately updates the marker

---

### F4: Visual Markers in Explorer

**Priority:** P0 (Must Have)

**Description:** Markers are displayed inline in the Explorer panel using VSCode's FileDecorationProvider API.

**Acceptance Criteria:**
- Marker badge (1-2 characters or emoji) appears next to file/folder name
- Marker color tints the file/folder name (configurable)
- Tooltip on hover shows marker label (e.g., "Status: Done")
- Markers persist across VSCode restarts
- Markers visible in search results and open editors tabs (where supported by API)

---

### F5: Default Marker Types

**Priority:** P0 (Must Have)

**Description:** Extension ships with a useful set of default markers.

**Default Markers:**

| ID | Badge | Color | Label | Use Case |
|----|-------|-------|-------|----------|
| `done` | ✅ | Green | Done | Completed items |
| `in-progress` | 🔄 | Yellow | In Progress | Currently working on |
| `pending` | ❌ | Red | Pending | Not started |
| `important` | ⭐ | Orange | Important | Flagged for attention |
| `review` | 👀 | Blue | Needs Review | Awaiting review |
| `question` | ❓ | Purple | Question | Has open questions |

---

### F6: Custom Marker Types

**Priority:** P1 (Should Have)

**Description:** Users can define custom marker types via settings.

**Acceptance Criteria:**
- Users can add custom markers in `settings.json`
- Custom markers appear in context menu alongside defaults
- Custom markers support: badge (string, max 2 chars), color (theme color or hex), label (string)

**Example Configuration:**
```json
{
  "fileMarkers.customMarkers": [
    {
      "id": "migrated",
      "badge": "M",
      "color": "#00FF00",
      "label": "Migrated"
    },
    {
      "id": "legacy",
      "badge": "L",
      "color": "#FF0000", 
      "label": "Legacy Code"
    }
  ]
}
```

---

### F7: Workspace Storage

**Priority:** P0 (Must Have)

**Description:** Markers are persisted per workspace.

**Acceptance Criteria:**
- Markers saved to `.vscode/file-markers.json` by default
- File can be committed to version control for team sharing
- Alternative: store in VSCode workspace state (not visible in file system)
- Setting to choose storage location: `fileMarkers.storageLocation`: `"file"` | `"workspaceState"`

**Storage Format:**
```json
{
  "version": 1,
  "markers": {
    "src/modules/iam/account.mapper.ts": "done",
    "src/modules/iam/policy": "in-progress",
    "src/legacy": "pending"
  }
}
```

---

### F8: Bulk Operations

**Priority:** P2 (Nice to Have)

**Description:** Apply or remove markers from multiple files at once.

**Acceptance Criteria:**
- Multi-select files in Explorer → right-click → "Add Marker" applies to all selected
- "Remove All Markers" command available in Command Palette
- "Remove Markers in Folder" option when right-clicking a folder

---

### F9: Marker Inheritance (Folders)

**Priority:** P2 (Nice to Have)

**Description:** Option to have folder markers visually apply to all children.

**Acceptance Criteria:**
- Setting: `fileMarkers.inheritFolderMarkers`: `true` | `false` (default: `false`)
- When enabled, unmarked files inside a marked folder display a dimmed version of the parent's marker
- Explicit file markers override inherited folder markers

---

### F10: Quick Toggle via Keyboard

**Priority:** P2 (Nice to Have)

**Description:** Keyboard shortcut to cycle through markers on the active file.

**Acceptance Criteria:**
- Configurable keybinding (default: `Ctrl+Shift+M` / `Cmd+Shift+M`)
- Cycles through: no marker → done → in-progress → pending → no marker
- Works on the currently active editor file

---

### F11: Status Bar Summary

**Priority:** P3 (Future Consideration)

**Description:** Show marker statistics in the status bar.

**Acceptance Criteria:**
- Status bar item shows: "✅ 12 | 🔄 5 | ❌ 8"
- Clicking opens a quick pick with options to filter Explorer by marker type

---

## Technical Requirements

### VSCode API Usage

| Feature | API |
|---------|-----|
| Explorer markers | `FileDecorationProvider` |
| Context menu | `menus` contribution point (`explorer/context`) |
| Commands | `commands` contribution point |
| Storage | `ExtensionContext.workspaceState` or file system |
| Settings | `configuration` contribution point |

### Minimum VSCode Version

- `1.78.0` (for stable FileDecorationProvider features)

### Dependencies

- None required (pure VSCode extension API)

### Performance Considerations

- FileDecorationProvider should return decorations efficiently for large workspaces
- Use caching for marker lookups
- Debounce file system writes when markers change rapidly
- Lazy load marker data on workspace open

---

## User Experience

### First-Time Experience

1. User installs extension
2. Extension activates silently (no intrusive welcome message)
3. Right-clicking any file shows new "File Markers" submenu
4. User selects a marker → immediately sees badge appear
5. Optional: show brief notification on first marker: "Markers saved to .vscode/file-markers.json"

### Context Menu Structure

```
Right-click on unmarked file:
├── ... (existing items)
├── File Markers
│   ├── ✅ Done
│   ├── 🔄 In Progress
│   ├── ❌ Pending
│   ├── ⭐ Important
│   ├── 👀 Needs Review
│   └── ❓ Question
└── ... (existing items)

Right-click on marked file:
├── ... (existing items)
├── File Markers
│   ├── Change Marker ►
│   │   ├── ✅ Done (current)
│   │   ├── 🔄 In Progress
│   │   └── ...
│   └── Remove Marker
└── ... (existing items)
```

---

## Data Model

### Marker Definition

```typescript
interface MarkerType {
  id: string;           // Unique identifier
  badge: string;        // 1-2 character badge (emoji or text)
  color: string;        // Theme color ID or hex code
  label: string;        // Human-readable label
  sortOrder?: number;   // Order in context menu
}
```

### Stored Marker

```typescript
interface MarkerStorage {
  version: number;
  markers: Record<string, string>; // path -> marker ID
}
```

### File Decoration

```typescript
interface FileDecoration {
  badge?: string;
  tooltip?: string;
  color?: ThemeColor;
  propagate?: boolean;
}
```

---

## Settings Schema

```json
{
  "fileMarkers.enabled": {
    "type": "boolean",
    "default": true,
    "description": "Enable or disable file markers"
  },
  "fileMarkers.storageLocation": {
    "type": "string",
    "enum": ["file", "workspaceState"],
    "default": "file",
    "description": "Where to store markers. 'file' saves to .vscode/file-markers.json"
  },
  "fileMarkers.showInTabs": {
    "type": "boolean",
    "default": true,
    "description": "Show marker badges in editor tabs"
  },
  "fileMarkers.defaultMarkers": {
    "type": "array",
    "description": "Override or disable default marker types"
  },
  "fileMarkers.customMarkers": {
    "type": "array",
    "description": "Define additional custom marker types"
  },
  "fileMarkers.inheritFolderMarkers": {
    "type": "boolean",
    "default": false,
    "description": "Show folder markers on unmarked child files"
  }
}
```

---

## Success Metrics

1. **Adoption:** Number of installs and active users
2. **Retention:** Users who continue using after 1 week
3. **Engagement:** Average markers per workspace
4. **Satisfaction:** Marketplace rating ≥ 4.5 stars

---

## Release Plan

### v0.1.0 (MVP)
- F1: Add Marker via Context Menu
- F2: Remove Marker via Context Menu
- F4: Visual Markers in Explorer
- F5: Default Marker Types
- F7: Workspace Storage (file-based only)

### v0.2.0
- F3: Change Marker via Context Menu
- F6: Custom Marker Types
- F7: WorkspaceState storage option

### v0.3.0
- F8: Bulk Operations
- F10: Quick Toggle via Keyboard

### v1.0.0
- F9: Marker Inheritance
- F11: Status Bar Summary
- Polish, documentation, marketplace listing

---

## Open Questions

1. **Naming:** "File Markers", "Explorer Markers", "Status Badges", or something else?
2. **Git integration:** Should markers auto-clear when a file is deleted? Follow renames?
3. **Multi-root workspaces:** One markers file per workspace folder, or one global?
4. **Icon set:** Emoji (cross-platform but limited styling) or Codicons (consistent but less expressive)?

---

## Appendix: Competitive Analysis

| Extension | Inline Markers | Right-Click | Custom Types | Storage |
|-----------|---------------|-------------|--------------|---------|
| Folder Path Color | ✅ | ❌ | ✅ | settings.json |
| Favorites (kdcro101) | ❌ (sidebar) | ✅ | ❌ | settings.json |
| Bookmarks | ❌ (sidebar) | ✅ | ❌ | .vscode file |
| Todo Tree | ✅ | ❌ | ✅ | Code comments |
| **File Markers (ours)** | ✅ | ✅ | ✅ | .vscode file |

---

## References

- [VSCode FileDecorationProvider API](https://code.visualstudio.com/api/references/vscode-api#FileDecorationProvider)
- [VSCode Extension Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [Folder Path Color Extension](https://github.com/jacob-j/vscode-folder-path-color)