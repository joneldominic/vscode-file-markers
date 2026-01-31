# File Markers

[![Version](https://img.shields.io/visual-studio-marketplace/v/joneldominic-dev.file-markers)](https://marketplace.visualstudio.com/items?itemName=joneldominic-dev.file-markers)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/joneldominic-dev.file-markers)](https://marketplace.visualstudio.com/items?itemName=joneldominic-dev.file-markers)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/joneldominic-dev.file-markers)](https://marketplace.visualstudio.com/items?itemName=joneldominic-dev.file-markers)
[![License](https://img.shields.io/github/license/joneldominic/vscode-file-markers)](https://github.com/joneldominic/vscode-file-markers/blob/main/LICENSE)

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

```json
{
  "version": 1,
  "markers": {
    "src/old-api.ts": "done",
    "src/utils": "in-progress"
  }
}
```

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

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

### 1.0.0

- Marker inheritance from folders to children
- Status bar summary with click-to-view statistics
- Full feature release

### 0.3.0

- Bulk operations (multi-select support)
- Keyboard toggle shortcut

### 0.2.0

- Custom marker types via settings
- Configurable storage location

### 0.1.0

- Initial release with core marking functionality

---

## License

[MIT](LICENSE)
