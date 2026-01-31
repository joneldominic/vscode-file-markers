# Changelog

All notable changes to the File Markers extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-01-31

### Added

- Demo GIF in README

## [1.0.0] - 2026-01-31

### Added

- **Marker Inheritance**: Folder markers can now propagate to child files
  - New setting: `fileMarkers.inheritFolderMarkers` (default: false)
  - Inherited markers display with a dimmed color to distinguish from direct markers
  - Tooltip indicates when a marker is inherited from a parent folder
- **Status Bar Summary**: Real-time marker statistics in the status bar
  - Shows marker counts by type (e.g., "✓ 5 | ◐ 3 | ○ 2")
  - Click to view detailed breakdown in QuickPick
  - New setting: `fileMarkers.statusBarAlignment` (left or right)
- **Show Marker Statistics command**: View workspace marker summary anytime

## [0.3.0] - 2026-01-31

### Added

- **Bulk Operations**: Apply or remove markers from multiple files at once
  - Multi-select files in Explorer, then right-click to set/remove markers
  - New command: "Remove Markers in Folder" for folders
  - New command: "Remove All Markers" to clear entire workspace
- **Keyboard Toggle**: Cycle through markers with a keyboard shortcut
  - Default: `Ctrl+Shift+M` (Windows/Linux) or `Cmd+Shift+M` (macOS)
  - Cycles: none → Done → In Progress → Pending → none

## [0.2.0] - 2026-01-31

### Added

- **Custom Marker Types**: Define your own markers via settings
  - Configure badge, color, and label for custom markers
  - Custom markers appear alongside default markers in QuickPick
- **QuickPick UI**: Modern marker selection with search and descriptions
  - Current marker highlighted with description
  - Shows marker badge and label for easy identification
- **Open Configuration command**: Quick access to extension settings

### Changed

- Marker selection now uses QuickPick instead of submenu
- Context menu simplified with conditional options

## [0.1.0] - 2026-01-31

### Added

- **Core Marking Functionality**
  - Right-click any file or folder to set a marker
  - Right-click marked items to remove markers
  - Visual badges appear in Explorer panel
- **Default Marker Types**
  - Done (✓ green)
  - In Progress (◐ yellow)
  - Pending (○ red)
  - Important (★ orange)
  - Needs Review (◉ blue)
  - Question (? purple)
- **Workspace Storage**
  - Markers saved to `.vscode/file-markers.json`
  - File can be committed for team sharing
- **Persistent Markers**: Markers survive VSCode restarts
