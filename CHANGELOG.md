# Changelog

All notable changes to the File Markers extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0](https://github.com/joneldominic/vscode-file-markers/compare/file-markers-v1.4.4...file-markers-v1.5.0) (2026-02-10)


### Added

* add line highlighting feature with keyboard toggle support ([#29](https://github.com/joneldominic/vscode-file-markers/issues/29)) ([#30](https://github.com/joneldominic/vscode-file-markers/issues/30)) ([172deb0](https://github.com/joneldominic/vscode-file-markers/commit/172deb092ffefd2c5e23d5bb6084ddfabd772ba0))

## [1.4.4](https://github.com/joneldominic/vscode-file-markers/compare/file-markers-v1.4.3...file-markers-v1.4.4) (2026-02-01)


### Fixed

* add comprehensive test coverage for core modules (fix type for force release) ([#27](https://github.com/joneldominic/vscode-file-markers/issues/27)) ([db82da4](https://github.com/joneldominic/vscode-file-markers/commit/db82da4c6971996ad3338d1f5c75ccd566f132ba))

## [1.4.3](https://github.com/joneldominic/vscode-file-markers/compare/file-markers-v1.4.2...file-markers-v1.4.3) (2026-02-01)


### Fixed

* **ci:** use pat for release-please to trigger publish workflow ([864d17d](https://github.com/joneldominic/vscode-file-markers/commit/864d17d70bebc55b600fc5dc29558a0b3da49037))

## [1.4.2](https://github.com/joneldominic/vscode-file-markers/compare/file-markers-v1.4.1...file-markers-v1.4.2) (2026-02-01)


### Fixed

* separate publish workflow from release-please ([#20](https://github.com/joneldominic/vscode-file-markers/issues/20)) ([6040be6](https://github.com/joneldominic/vscode-file-markers/commit/6040be62d6ad43fd7b4222926a71806658544808))

## [1.4.1](https://github.com/joneldominic/vscode-file-markers/compare/file-markers-v1.4.0...file-markers-v1.4.1) (2026-02-01)


### Fixed

* fix release-please target branch ([#18](https://github.com/joneldominic/vscode-file-markers/issues/18)) ([408e93d](https://github.com/joneldominic/vscode-file-markers/commit/408e93dd3ac8ea745c7d380ebacec6f0f13d7ea6))

## [1.4.0](https://github.com/joneldominic/vscode-file-markers/compare/file-markers-v1.3.0...file-markers-v1.4.0) (2026-02-01)

> **Note**: Starting with v1.4.0, this changelog is managed by [release-please](https://github.com/googleapis/release-please).
> Entries are auto-generated from conventional commits and there may be duplicate entries from previous release versions.

### Added

* add automated versioning with release-please and conventional commits ([#9](https://github.com/joneldominic/vscode-file-markers/issues/9)) ([8a7962c](https://github.com/joneldominic/vscode-file-markers/commit/8a7962cd28499a5c521560cb035926069669e929))
* add fileMarkers.enabled setting to toggle extension ([dfadd16](https://github.com/joneldominic/vscode-file-markers/commit/dfadd16d16a5d9f2c76a0a425bb8cc32634fe667))
* implement MVP v0.1.0 with file markers functionality ([6ce904f](https://github.com/joneldominic/vscode-file-markers/commit/6ce904f9987d5bb75e7cf313ccc73ef1ab26fd84))
* implement v0.2.0 with configurable marker types ([f7daeeb](https://github.com/joneldominic/vscode-file-markers/commit/f7daeeb20906789e5bff9e9fae8bb4e56c8cbc4c))
* implement v0.3.0 with bulk operations and keyboard toggle ([f8da76d](https://github.com/joneldominic/vscode-file-markers/commit/f8da76da8492b29cffe04a03d8cee8217b88a306))
* implement v1.0.0 with marker inheritance and status bar ([bfedcb3](https://github.com/joneldominic/vscode-file-markers/commit/bfedcb304df4ab7b4ef3e19412ff68a3eacd40c2))
* init project ([331119e](https://github.com/joneldominic/vscode-file-markers/commit/331119ed0d9c40501a1de63409c060d1ff71efe0))


### Fixed

* clarify changelog and improve ci/cd workflow ([#14](https://github.com/joneldominic/vscode-file-markers/issues/14)) ([8aa8bb0](https://github.com/joneldominic/vscode-file-markers/commit/8aa8bb0588b04239e588df9b8793829a84ace52e))
* configure release-please to target main branch ([e904216](https://github.com/joneldominic/vscode-file-markers/commit/e904216e42899553002f1610d0fad1607dba983c))
* prevent config file from being overwritten with default values ([78b162d](https://github.com/joneldominic/vscode-file-markers/commit/78b162d5f76f013506b782accbde2084d053504f))


### Documentation

* add custom marker types documentation and badge limit note ([b2ffb13](https://github.com/joneldominic/vscode-file-markers/commit/b2ffb137e42540a5f6f19e201f9f7a198ec00635))
* add demo GIF to README ([2b451ae](https://github.com/joneldominic/vscode-file-markers/commit/2b451ae280f0971468d418e2cd6eba90e0641802))
* add Open VSX badges and update plan progress ([18343d7](https://github.com/joneldominic/vscode-file-markers/commit/18343d761c96e05d237e4610e0c68c40629d4d49))
* add publishing guides for VS Code Marketplace and Open VSX ([8d35804](https://github.com/joneldominic/vscode-file-markers/commit/8d358048f5b5186ea41a7c318e3f012fac50734c))
* prepare extension for marketplace publishing ([41cb960](https://github.com/joneldominic/vscode-file-markers/commit/41cb9600752d9778c15b2b32c735e9a6f8e6aab8))

## [1.3.0](https://github.com/joneldominic/vscode-file-markers/compare/file-markers-v1.2.0...file-markers-v1.3.0) (2026-02-01)

### Added

- **Automated Versioning**: Implemented release-please for automated changelog generation and version bumping
  - Conventional commits enforced via commitlint and lefthook
  - See [CONTRIBUTING.md](CONTRIBUTING.md) for the new release workflow

## [1.2.0] - 2026-02-01

### Added

- **Enable/Disable Toggle**: Quickly disable the extension without uninstalling
  - New setting: `fileMarkers.enabled` (default: true)
  - New command: "File Markers: Toggle Enable/Disable"
  - When disabled: markers hidden, context menus hidden, keyboard shortcut shows warning
  - Status bar shows "File Markers: Disabled" when off
  - Enhanced status bar menu with Enable/Disable and Open Configuration options

## [1.1.0] - 2026-02-01

### Added

- **Unit Tests**: Comprehensive test suite for core functionality
  - Tests for marker storage operations
  - Tests for default marker types
  - Extension activation tests
- **CI/CD Pipeline**: GitHub Actions workflows
  - Automated build, lint, and test on every push/PR
  - Manual publish workflow for VS Code Marketplace and OpenVSX

### Changed

- Improved test configuration with proper timeout settings

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
