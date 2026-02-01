# File Markers

[![License](https://img.shields.io/github/license/joneldominic/vscode-file-markers)](https://github.com/joneldominic/vscode-file-markers/blob/main/LICENSE)
[![CI](https://github.com/joneldominic/vscode-file-markers/actions/workflows/ci.yml/badge.svg)](https://github.com/joneldominic/vscode-file-markers/actions/workflows/ci.yml)

**VS Code Marketplace:**
[![VS Code Version](https://img.shields.io/visual-studio-marketplace/v/joneldominic-dev.file-markers?label=version)](https://marketplace.visualstudio.com/items?itemName=joneldominic-dev.file-markers)
[![VS Code Installs](https://img.shields.io/visual-studio-marketplace/i/joneldominic-dev.file-markers?label=installs)](https://marketplace.visualstudio.com/items?itemName=joneldominic-dev.file-markers)
[![VS Code Rating](https://img.shields.io/visual-studio-marketplace/r/joneldominic-dev.file-markers?label=rating)](https://marketplace.visualstudio.com/items?itemName=joneldominic-dev.file-markers)

**Open VSX:**
[![Open VSX Version](https://img.shields.io/open-vsx/v/joneldominic-dev/file-markers?label=version)](https://open-vsx.org/extension/joneldominic-dev/file-markers)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/joneldominic-dev/file-markers?label=downloads)](https://open-vsx.org/extension/joneldominic-dev/file-markers)
[![Open VSX Rating](https://img.shields.io/open-vsx/rating/joneldominic-dev/file-markers?label=rating)](https://open-vsx.org/extension/joneldominic-dev/file-markers)

Track file and folder status directly in VSCode's Explorer. Right-click to add visual markers like Done, In Progress, or Pending—no config files to edit, no separate sidebar to manage.

**Perfect for migrations, refactoring projects, and code reviews.**

![File Markers Demo](images/demo.gif)

## Features

### Right-Click to Mark

Add markers to any file or folder directly from the Explorer context menu.

<!-- ![Context Menu](images/context-menu.png) -->

### Visual Badges

See file status at a glance with colored badges in the Explorer panel.

| Marker | Badge | Color | Use Case |
|--------|-------|-------|----------|
| Done | ✓ | Green | Completed files |
| In Progress | ◐ | Yellow | Currently working on |
| Pending | ○ | Red | Not started yet |
| Important | ★ | Orange | High priority files |
| Needs Review | ◉ | Blue | Ready for code review |
| Question | ? | Purple | Need clarification |

> **Note:** Badges are limited to **2 characters** maximum ([VSCode FileDecoration API limitation](https://code.visualstudio.com/api/references/vscode-api#FileDecoration)).

### Folder Markers with Inheritance

Mark entire folders! With inheritance enabled, unmarked files inside a marked folder automatically display a dimmed version of the parent's marker.

<!-- ![Folder Inheritance](images/inheritance.png) -->

### Keyboard Shortcut

Quickly toggle markers on the active file:
- **Windows/Linux**: `Ctrl+Shift+M`
- **macOS**: `Cmd+Shift+M`

### Status Bar Summary

See marker counts at a glance in the status bar. Click to view detailed statistics.

<!-- ![Status Bar](images/statusbar.png) -->

### Bulk Operations

- Multi-select files and apply markers to all at once
- Remove all markers in a folder
- Remove all markers in workspace via Command Palette

### Persistent & Shareable

Markers are stored in `.vscode/file-markers.json`. Commit this file to share markers with your team, or add it to `.gitignore` for personal use.

### Custom Marker Types

You can define custom marker types by editing `.vscode/file-markers.json` directly. The file supports both marker assignments and custom marker type definitions:

```json
{
  "markerTypes": [
    {
      "id": "done",
      "badge": "✓",
      "color": "gitDecoration.addedResourceForeground",
      "label": "Done"
    },
    {
      "id": "blocked",
      "badge": "🚫",
      "color": "errorForeground",
      "label": "Blocked"
    }
  ],
  "markers": {
    "src/old-api.ts": "done",
    "src/utils": "blocked"
  }
}
```

**Marker Type Properties:**

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Unique identifier used in the `markers` object |
| `badge` | Yes | 1-2 character badge displayed in Explorer (emoji or text) |
| `color` | Yes | VSCode theme color ID (e.g., `errorForeground`, `gitDecoration.addedResourceForeground`) |
| `label` | Yes | Display name shown in QuickPick and tooltips |

> **Tip:** Use `File Markers: Open Configuration` command to quickly open the config file. Changes are detected automatically—no need to reload VSCode.

## Installation

1. Open VSCode
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"File Markers"**
4. Click **Install**

Or install via command line:
```bash
code --install-extension joneldominic-dev.file-markers
```

## Usage

### Setting a Marker

1. Right-click any file or folder in the Explorer
2. Select **File Markers: Set Marker...**
3. Choose a marker type from the QuickPick menu

### Removing a Marker

- Right-click a marked item → **File Markers: Remove Marker**
- Or use the Command Palette → **File Markers: Remove All Markers**

### Keyboard Toggle

Press `Ctrl+Shift+M` (Windows/Linux) or `Cmd+Shift+M` (macOS) to cycle through markers on the active file.

### Viewing Statistics

Click the marker summary in the status bar to see a breakdown of all markers in your workspace.

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `fileMarkers.inheritFolderMarkers` | `false` | When enabled, unmarked files inside a marked folder display a dimmed version of the folder's marker |
| `fileMarkers.statusBarAlignment` | `"left"` | Position of marker statistics in the status bar (`"left"` or `"right"`) |

## Use Cases

- **Migrations** — Track which files have been migrated to a new framework
- **Refactoring** — Mark files as you work through a large refactor
- **Code Reviews** — Flag files that need attention
- **Onboarding** — Mark files you've reviewed while learning a codebase
- **Tech Debt** — Highlight files that need improvement
- **Task Tracking** — Visual progress on file-by-file tasks

## Commands

| Command | Description |
|---------|-------------|
| `File Markers: Set Marker...` | Add or change a marker on selected files |
| `File Markers: Remove Marker` | Remove marker from selected files |
| `File Markers: Remove Markers in Folder` | Remove all markers from files in a folder |
| `File Markers: Remove All Markers` | Remove all markers in the workspace |
| `File Markers: Toggle Marker` | Cycle through markers on the active file |
| `File Markers: Show Marker Statistics` | View marker counts by type |
| `File Markers: Open Configuration` | Open extension settings |

## Requirements

- VSCode 1.74.0 or higher

## Known Issues

None yet! [Report an issue](https://github.com/joneldominic/vscode-file-markers/issues)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/joneldominic/vscode-file-markers).

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release history.

---

## License

[MIT](LICENSE)
