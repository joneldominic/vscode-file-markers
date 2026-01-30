# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

File Markers is a VSCode extension that allows developers to add visual markers (badges, colors) to files and folders directly in the Explorer panel via right-click context menu. Markers persist per workspace and can be stored in `.vscode/file-markers.json` for version control sharing.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Package extension for distribution
npx vsce package

# Run linter
npm run lint

# Run tests
npm test
```

To debug the extension: Press F5 in VSCode to launch Extension Development Host.

## Architecture

### Core Components

1. **FileDecorationProvider** - Implements `vscode.FileDecorationProvider` to render badges and colors on files/folders in Explorer. Must handle large workspaces efficiently with caching.

2. **MarkerStorage** - Manages persistence of markers. Supports two modes:
   - File-based: `.vscode/file-markers.json`
   - WorkspaceState: VSCode's internal storage

3. **Context Menu Commands** - Registered in `package.json` under `contributes.menus` for `explorer/context`. Commands include add/remove/change marker operations.

### Data Flow

- User right-clicks → Command executes → MarkerStorage updates → FileDecorationProvider notifies VSCode → Explorer refreshes

### Key VSCode APIs

- `FileDecorationProvider` for Explorer badges/colors
- `ExtensionContext.workspaceState` for internal storage
- `menus` contribution point for context menus
- `configuration` contribution point for settings

### Storage Format

```json
{
  "version": 1,
  "markers": {
    "src/file.ts": "done",
    "src/folder": "in-progress"
  }
}
```

### Default Marker Types

| ID | Badge | Color | Label |
|----|-------|-------|-------|
| done | ✅ | Green | Done |
| in-progress | 🔄 | Yellow | In Progress |
| pending | ❌ | Red | Pending |
| important | ⭐ | Orange | Important |
| review | 👀 | Blue | Needs Review |
| question | ❓ | Purple | Question |

## Extension Configuration

Settings are defined in `package.json` under `contributes.configuration`:
- `fileMarkers.enabled` - Enable/disable extension
- `fileMarkers.storageLocation` - "file" or "workspaceState"
- `fileMarkers.customMarkers` - User-defined marker types
- `fileMarkers.inheritFolderMarkers` - Apply folder markers to children

## Performance Considerations

- Cache marker lookups in FileDecorationProvider
- Debounce file system writes when markers change rapidly
- Lazy load marker data on workspace activation
- FileDecorationProvider should return quickly for large workspaces
