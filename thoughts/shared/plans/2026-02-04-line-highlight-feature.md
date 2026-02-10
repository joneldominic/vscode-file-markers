# Line Highlighting Feature Implementation Plan

## Overview

Add support for highlighting specific line ranges within files, independent of the existing file-level markers. This feature uses VSCode's TextEditor Decorations API to render background highlighting on selected lines when files are opened in the editor.

## Current State Analysis

### Existing Architecture
- **FileDecorationProvider** (`decorationProvider.ts`): Renders badges/colors on files in Explorer - file-level only
- **MarkerStorage** (`storage.ts`): Stores file markers in `.vscode/file-markers.json`
- **Storage format**: `{ markerTypes: [...], markers: { "path": "markerId" } }`

### Key Discovery
VSCode has two separate decoration systems:
1. `FileDecorationProvider` - Explorer panel only, file-level granularity
2. `TextEditorDecorationType` + `TextEditor.setDecorations()` - Editor content, line/character granularity

Line highlighting requires the second system, which is completely separate from the current implementation.

## Desired End State

After implementation:
1. Users can select text in an editor, right-click, and choose "Set Line Highlight"
2. Users can press `Cmd+Shift+H` (Mac) / `Ctrl+Shift+H` (Windows/Linux) to toggle/cycle through highlight colors
3. Selected line ranges get background highlighting with a chosen highlight type
4. Line highlights persist in `.vscode/file-markers.json` (backward compatible, separate key)
5. Files with line highlights show an indicator badge in the Explorer
6. Line highlights are independent of file markers (a file can have both)
7. Highlights appear automatically when files are opened

### Verification
- Open a file, select lines 10-20, right-click → "Set Line Highlight" → choose type
- Lines 10-20 show background highlighting
- Select lines, press `Cmd+Shift+H` → cycles Yellow → Green → Blue → Red → Purple → Remove
- Close and reopen file → highlighting persists
- File shows indicator in Explorer tree
- Existing file markers continue to work unchanged

## What We're NOT Doing

- Gutter icons (user specified highlighting only)
- Column-level precision (line-level only, as requested)
- Linking line highlights to file markers (they're independent)
- Overview ruler markers (keep it simple for v1)
- Tree view panel for line highlights (just Explorer indicator)

## Implementation Approach

Create a new `LineHighlightProvider` that manages TextEditor decorations separately from the existing FileDecorationProvider. Extend storage format to include line highlights while maintaining backward compatibility.

---

## Phase 1: Storage & Types Extension

### Overview
Extend the storage system to support line highlights alongside existing file markers.

### Changes Required:

#### 1. Types Extension

**File**: `src/types.ts`
**Changes**: Add new interfaces for line highlights

```typescript
/**
 * Line highlight configuration (stored in config)
 */
export interface LineHighlightTypeConfig {
  id: string;
  color: string; // CSS color or theme color reference
  label: string;
}

/**
 * Runtime line highlight type with resolved color
 */
export interface LineHighlightType {
  id: string;
  color: string;
  label: string;
}

/**
 * A single line highlight range
 */
export interface LineHighlight {
  startLine: number; // 1-indexed (user-facing)
  endLine: number;   // 1-indexed, inclusive
  typeId: string;
}

/**
 * Line highlights for a single file
 */
export interface FileLineHighlights {
  highlights: LineHighlight[];
}

/**
 * Extended storage format (backward compatible)
 */
export interface MarkerStorageDataV2 {
  markerTypes: MarkerTypeConfig[];
  markers: Record<string, string>;
  // New fields for line highlights
  lineHighlightTypes?: LineHighlightTypeConfig[];
  lineHighlights?: Record<string, LineHighlight[]>; // relativePath -> highlights
}
```

#### 2. Default Line Highlight Types

**File**: `src/defaults.ts`
**Changes**: Add default line highlight types

```typescript
export const DEFAULT_LINE_HIGHLIGHT_TYPES: LineHighlightTypeConfig[] = [
  {
    id: 'highlight-yellow',
    color: 'rgba(255, 235, 59, 0.3)',
    label: 'Yellow Highlight',
  },
  {
    id: 'highlight-green',
    color: 'rgba(76, 175, 80, 0.3)',
    label: 'Green Highlight',
  },
  {
    id: 'highlight-blue',
    color: 'rgba(33, 150, 243, 0.3)',
    label: 'Blue Highlight',
  },
  {
    id: 'highlight-red',
    color: 'rgba(244, 67, 54, 0.3)',
    label: 'Red Highlight',
  },
  {
    id: 'highlight-purple',
    color: 'rgba(156, 39, 176, 0.3)',
    label: 'Purple Highlight',
  },
];
```

#### 3. Storage Extension

**File**: `src/storage.ts`
**Changes**: Add line highlight storage methods

Add new private fields:
```typescript
private lineHighlightTypes: Map<string, LineHighlightType> = new Map();
private lineHighlights: Map<string, LineHighlight[]> = new Map(); // relativePath -> highlights

private readonly _onDidChangeLineHighlights = new vscode.EventEmitter<{ uri: vscode.Uri }>();
readonly onDidChangeLineHighlights = this._onDidChangeLineHighlights.event;
```

Update `load()` method to load line highlights:
```typescript
// After loading markers
this.loadLineHighlightTypes(data.lineHighlightTypes || DEFAULT_LINE_HIGHLIGHT_TYPES);
this.lineHighlights = new Map(
  Object.entries(data.lineHighlights || {}).map(([path, highlights]) => [
    path,
    highlights as LineHighlight[]
  ])
);
```

Update `save()` method to save line highlights:
```typescript
const data: MarkerStorageDataV2 = {
  markerTypes,
  markers: Object.fromEntries(this.markers),
  lineHighlightTypes: Array.from(this.lineHighlightTypes.values()),
  lineHighlights: Object.fromEntries(this.lineHighlights),
};
```

Add new methods:
```typescript
// Line highlight type methods
getAllLineHighlightTypes(): LineHighlightType[] {
  return Array.from(this.lineHighlightTypes.values());
}

getLineHighlightType(id: string): LineHighlightType | undefined {
  return this.lineHighlightTypes.get(id);
}

// Line highlight methods
getLineHighlights(uri: vscode.Uri): LineHighlight[] {
  const relativePath = this.getRelativePath(uri);
  if (!relativePath) return [];
  return this.lineHighlights.get(relativePath) ?? [];
}

setLineHighlight(uri: vscode.Uri, startLine: number, endLine: number, typeId: string): void {
  const relativePath = this.getRelativePath(uri);
  if (!relativePath) return;

  const highlights = this.lineHighlights.get(relativePath) ?? [];

  // Remove any overlapping highlights and add new one
  const filtered = highlights.filter(h =>
    h.endLine < startLine || h.startLine > endLine
  );
  filtered.push({ startLine, endLine, typeId });

  // Sort by start line
  filtered.sort((a, b) => a.startLine - b.startLine);

  this.lineHighlights.set(relativePath, filtered);
  this.scheduleSave();
  this._onDidChangeLineHighlights.fire({ uri });
}

removeLineHighlight(uri: vscode.Uri, startLine: number, endLine: number): void {
  const relativePath = this.getRelativePath(uri);
  if (!relativePath) return;

  const highlights = this.lineHighlights.get(relativePath);
  if (!highlights) return;

  const filtered = highlights.filter(h =>
    !(h.startLine === startLine && h.endLine === endLine)
  );

  if (filtered.length === 0) {
    this.lineHighlights.delete(relativePath);
  } else {
    this.lineHighlights.set(relativePath, filtered);
  }

  this.scheduleSave();
  this._onDidChangeLineHighlights.fire({ uri });
}

removeAllLineHighlightsInFile(uri: vscode.Uri): void {
  const relativePath = this.getRelativePath(uri);
  if (!relativePath) return;

  if (this.lineHighlights.delete(relativePath)) {
    this.scheduleSave();
    this._onDidChangeLineHighlights.fire({ uri });
  }
}

hasLineHighlights(uri: vscode.Uri): boolean {
  const relativePath = this.getRelativePath(uri);
  if (!relativePath) return false;
  const highlights = this.lineHighlights.get(relativePath);
  return highlights !== undefined && highlights.length > 0;
}

getAllFilesWithLineHighlights(): vscode.Uri[] {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return [];

  return Array.from(this.lineHighlights.keys())
    .filter(path => (this.lineHighlights.get(path)?.length ?? 0) > 0)
    .map(path => vscode.Uri.joinPath(workspaceFolder.uri, path));
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] Existing tests pass: `pnpm test`
- [x] Storage loads/saves with new format correctly
- [x] Backward compatible: old format files still load without lineHighlights fields

#### Manual Verification:
- [ ] Create test file-markers.json with lineHighlights, verify it loads
- [ ] Verify existing markers still work after changes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Line Highlight Provider

### Overview
Create the TextEditor decoration provider that renders line highlights in open editors.

### Changes Required:

#### 1. Create Line Highlight Provider

**File**: `src/lineHighlightProvider.ts` (new file)
**Changes**: Create new provider class

```typescript
import * as vscode from 'vscode';
import { MarkerStorage } from './storage';
import { LineHighlightType } from './types';

export class LineHighlightProvider implements vscode.Disposable {
  private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
  private disposables: vscode.Disposable[] = [];

  constructor(private storage: MarkerStorage) {
    // Create decoration types for each line highlight type
    this.createDecorationTypes();

    // Listen for storage changes
    this.disposables.push(
      storage.onDidChangeLineHighlights(({ uri }) => {
        this.updateDecorationsForUri(uri);
      })
    );

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.updateDecorations(editor);
        }
      })
    );

    // Listen for visible editors changes
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) {
          this.updateDecorations(editor);
        }
      })
    );

    // Listen for document changes (line additions/deletions could affect highlights)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.visibleTextEditors.find(
          e => e.document === event.document
        );
        if (editor) {
          this.updateDecorations(editor);
        }
      })
    );

    // Listen for configuration changes to refresh decoration types
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('fileMarkers.enabled')) {
          this.refreshAllEditors();
        }
      })
    );

    // Initial decoration for visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDecorations(editor);
    }
  }

  private createDecorationTypes(): void {
    // Dispose old decoration types
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();

    // Create decoration type for each line highlight type
    const highlightTypes = this.storage.getAllLineHighlightTypes();
    for (const type of highlightTypes) {
      const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: type.color,
        isWholeLine: true,
      });
      this.decorationTypes.set(type.id, decorationType);
    }
  }

  private updateDecorationsForUri(uri: vscode.Uri): void {
    const editor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.fsPath === uri.fsPath
    );
    if (editor) {
      this.updateDecorations(editor);
    }
  }

  private updateDecorations(editor: vscode.TextEditor): void {
    // Check if extension is enabled
    const config = vscode.workspace.getConfiguration('fileMarkers');
    if (!config.get<boolean>('enabled', true)) {
      // Clear all decorations when disabled
      for (const decorationType of this.decorationTypes.values()) {
        editor.setDecorations(decorationType, []);
      }
      return;
    }

    const uri = editor.document.uri;
    const highlights = this.storage.getLineHighlights(uri);

    // Group highlights by type
    const highlightsByType = new Map<string, vscode.Range[]>();

    for (const highlight of highlights) {
      // Convert 1-indexed to 0-indexed
      const startLine = Math.max(0, highlight.startLine - 1);
      const endLine = Math.min(
        editor.document.lineCount - 1,
        highlight.endLine - 1
      );

      // Skip if lines are out of bounds
      if (startLine > editor.document.lineCount - 1) continue;

      const range = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, editor.document.lineAt(endLine).text.length)
      );

      const ranges = highlightsByType.get(highlight.typeId) ?? [];
      ranges.push(range);
      highlightsByType.set(highlight.typeId, ranges);
    }

    // Apply decorations for each type
    for (const [typeId, decorationType] of this.decorationTypes) {
      const ranges = highlightsByType.get(typeId) ?? [];
      editor.setDecorations(decorationType, ranges);
    }
  }

  refreshAllEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDecorations(editor);
    }
  }

  refreshDecorationTypes(): void {
    this.createDecorationTypes();
    this.refreshAllEditors();
  }

  dispose(): void {
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
    this.disposables.forEach(d => d.dispose());
  }
}
```

#### 2. Register Provider in Extension

**File**: `src/extension.ts`
**Changes**: Initialize LineHighlightProvider

Add import:
```typescript
import { LineHighlightProvider } from './lineHighlightProvider';
```

Add variable:
```typescript
let lineHighlightProvider: LineHighlightProvider | undefined;
```

In `activate()`, after storage initialization:
```typescript
// Initialize line highlight provider
lineHighlightProvider = new LineHighlightProvider(storage);
context.subscriptions.push(lineHighlightProvider);
```

In `deactivate()`:
```typescript
lineHighlightProvider = undefined;
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] All tests pass: `pnpm test`

#### Manual Verification:
- [ ] Manually add lineHighlights to file-markers.json for a test file
- [ ] Open the file in editor and verify highlighting appears
- [ ] Close and reopen the file, verify highlights persist
- [ ] Disable extension via settings, verify highlights disappear
- [ ] Re-enable extension, verify highlights reappear

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Commands & Context Menu

### Overview
Add commands for setting/removing line highlights via editor context menu.

### Changes Required:

#### 1. Add Commands to package.json

**File**: `package.json`
**Changes**: Add new commands and menus

In `contributes.commands` array:
```json
{
  "command": "file-markers.setLineHighlight",
  "title": "File Markers: Set Line Highlight..."
},
{
  "command": "file-markers.removeLineHighlight",
  "title": "File Markers: Remove Line Highlight"
},
{
  "command": "file-markers.removeAllLineHighlightsInFile",
  "title": "File Markers: Remove All Line Highlights in File"
},
{
  "command": "file-markers.toggleLineHighlight",
  "title": "File Markers: Toggle Line Highlight on Selection"
}
```

In `contributes.keybindings` array, add:
```json
{
  "command": "file-markers.toggleLineHighlight",
  "key": "ctrl+shift+h",
  "mac": "cmd+shift+h",
  "when": "editorTextFocus && editorHasSelection"
}
```

Add new menu section for editor context:
```json
"editor/context": [
  {
    "command": "file-markers.setLineHighlight",
    "group": "9_fileMarkers@1",
    "when": "config.fileMarkers.enabled && editorHasSelection"
  },
  {
    "command": "file-markers.removeLineHighlight",
    "group": "9_fileMarkers@2",
    "when": "config.fileMarkers.enabled && editorHasSelection"
  },
  {
    "command": "file-markers.removeAllLineHighlightsInFile",
    "group": "9_fileMarkers@3",
    "when": "config.fileMarkers.enabled"
  }
]
```

In `commandPalette`:
```json
{
  "command": "file-markers.setLineHighlight",
  "when": "editorHasSelection"
},
{
  "command": "file-markers.removeLineHighlight",
  "when": "editorHasSelection"
},
{
  "command": "file-markers.removeAllLineHighlightsInFile",
  "when": "editorIsOpen"
},
{
  "command": "file-markers.toggleLineHighlight",
  "when": "editorHasSelection"
}
```

#### 2. Register Commands

**File**: `src/commands.ts`
**Changes**: Add line highlight commands

Add command registrations at the end of `registerCommands()`:

```typescript
// Set Line Highlight command
context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.setLineHighlight',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor.');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('Select some text first.');
        return;
      }

      const highlightTypes = storage.getAllLineHighlightTypes();
      if (highlightTypes.length === 0) {
        vscode.window.showWarningMessage('No line highlight types configured.');
        return;
      }

      // Show quick pick for highlight type selection
      const items = highlightTypes.map(type => ({
        label: type.label,
        description: type.id,
        typeId: type.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a highlight type',
      });

      if (selected) {
        // Use 1-indexed lines for storage
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;

        storage.setLineHighlight(
          editor.document.uri,
          startLine,
          endLine,
          selected.typeId
        );
      }
    }
  )
);

// Remove Line Highlight command
context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.removeLineHighlight',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor.');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('Select the highlighted lines to remove.');
        return;
      }

      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;

      // Find and remove highlight that matches this range
      const highlights = storage.getLineHighlights(editor.document.uri);
      const matching = highlights.find(h =>
        h.startLine === startLine && h.endLine === endLine
      );

      if (matching) {
        storage.removeLineHighlight(editor.document.uri, startLine, endLine);
      } else {
        // Try to find any overlapping highlight
        const overlapping = highlights.find(h =>
          !(h.endLine < startLine || h.startLine > endLine)
        );
        if (overlapping) {
          storage.removeLineHighlight(
            editor.document.uri,
            overlapping.startLine,
            overlapping.endLine
          );
        } else {
          vscode.window.showInformationMessage('No highlight found in selected range.');
        }
      }
    }
  )
);

// Remove All Line Highlights in File command
context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.removeAllLineHighlightsInFile',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor.');
        return;
      }

      const highlights = storage.getLineHighlights(editor.document.uri);
      if (highlights.length === 0) {
        vscode.window.showInformationMessage('No line highlights in this file.');
        return;
      }

      storage.removeAllLineHighlightsInFile(editor.document.uri);
      vscode.window.showInformationMessage(
        `Removed ${highlights.length} line highlight${highlights.length === 1 ? '' : 's'}.`
      );
    }
  )
);

// Toggle Line Highlight command (keyboard shortcut - cycles through colors)
context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.toggleLineHighlight',
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
        vscode.window.showWarningMessage('No active editor.');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('Select some text first.');
        return;
      }

      // Use 1-indexed lines for storage
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;

      const uri = editor.document.uri;
      const highlights = storage.getLineHighlights(uri);

      // Get all configured highlight types for cycling
      const allHighlightTypes = storage.getAllLineHighlightTypes();
      const cycleOrder = allHighlightTypes.map(t => t.id);

      if (cycleOrder.length === 0) {
        vscode.window.showWarningMessage('No line highlight types configured.');
        return;
      }

      // Find existing highlight that overlaps with selection
      const existingHighlight = highlights.find(h =>
        !(h.endLine < startLine || h.startLine > endLine)
      );

      if (!existingHighlight) {
        // No highlight → apply first in cycle
        storage.setLineHighlight(uri, startLine, endLine, cycleOrder[0]);
      } else {
        const currentIndex = cycleOrder.indexOf(existingHighlight.typeId);
        if (currentIndex === -1) {
          // Current highlight type not in cycle (unknown/removed type) → remove it
          storage.removeLineHighlight(uri, existingHighlight.startLine, existingHighlight.endLine);
        } else if (currentIndex === cycleOrder.length - 1) {
          // Last in cycle → remove highlight
          storage.removeLineHighlight(uri, existingHighlight.startLine, existingHighlight.endLine);
        } else {
          // Move to next in cycle (update existing highlight range with new type)
          storage.removeLineHighlight(uri, existingHighlight.startLine, existingHighlight.endLine);
          storage.setLineHighlight(uri, startLine, endLine, cycleOrder[currentIndex + 1]);
        }
      }
    }
  )
);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] All tests pass: `pnpm test`

#### Manual Verification:
- [ ] Open a file, select lines 5-10, right-click → "Set Line Highlight" appears
- [ ] Click command, select highlight type, lines get highlighted
- [ ] Select same lines, right-click → "Remove Line Highlight" removes it
- [ ] Add multiple highlights, use "Remove All Line Highlights in File"
- [ ] Commands appear in command palette with correct "when" conditions
- [ ] Select text, press `Cmd+Shift+H` → first highlight color applied (Yellow)
- [ ] Press `Cmd+Shift+H` again → cycles to next color (Green)
- [ ] Continue pressing → cycles through Blue, Red, Purple, then removes highlight
- [ ] Press again → starts cycle over with Yellow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Explorer Indicator

### Overview
Show an indicator badge on files in the Explorer that have line highlights.

### Changes Required:

#### 1. Update FileDecorationProvider

**File**: `src/decorationProvider.ts`
**Changes**: Add line highlight indicator to file decorations

The current `provideFileDecoration` method needs to check for line highlights and show an indicator when a file has them.

Add a constant for the indicator badge:
```typescript
const LINE_HIGHLIGHT_BADGE = '≡'; // Or use '━' or '▤' or similar
```

Update constructor to listen for line highlight changes:
```typescript
this.disposables.push(
  storage.onDidChangeLineHighlights(() => {
    this.refresh();
  })
);
```

Update `provideFileDecoration` to show indicator:
```typescript
provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
  const config = vscode.workspace.getConfiguration('fileMarkers');
  if (!config.get<boolean>('enabled', true)) {
    return undefined;
  }

  // Check for file marker
  const effective = this.storage.getEffectiveMarker(uri);
  const hasLineHighlights = this.storage.hasLineHighlights(uri);

  // If no marker and no line highlights, return nothing
  if (!effective && !hasLineHighlights) {
    return undefined;
  }

  // Build decoration based on what we have
  if (effective) {
    // Existing marker logic
    const marker = this.storage.getMarkerType(effective.markerId);
    const isUnknown = !this.storage.isKnownMarkerType(effective.markerId);

    let badge = marker.badge;
    // If file also has line highlights, append indicator
    if (hasLineHighlights) {
      badge = marker.badge; // Keep original badge, line highlights shown separately
    }

    const color = isUnknown
      ? undefined
      : effective.inherited
        ? INHERITED_MARKER_COLOR
        : marker.color;

    const tooltip = isUnknown
      ? `Unknown marker type: "${effective.markerId}"`
      : effective.inherited
        ? `File Marker: ${marker.label} (inherited from folder)`
        : `File Marker: ${marker.label}`;

    return {
      badge,
      color,
      tooltip: hasLineHighlights
        ? `${tooltip} | Has line highlights`
        : tooltip,
      propagate: false,
    };
  } else {
    // Only line highlights, no file marker
    return {
      badge: LINE_HIGHLIGHT_BADGE,
      color: new vscode.ThemeColor('editorInfo.foreground'),
      tooltip: 'Has line highlights',
      propagate: false,
    };
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`
- [x] All tests pass: `pnpm test`

#### Manual Verification:
- [ ] Add line highlights to a file without file marker → shows indicator badge
- [ ] Add line highlights to a file with file marker → shows file marker badge, tooltip mentions highlights
- [ ] Remove all line highlights → indicator disappears
- [ ] Verify existing file markers still display correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Unit Tests

### Overview
Add comprehensive unit tests for the new line highlight functionality.

### Changes Required:

#### 1. Storage Tests

**File**: `src/test/storage.test.ts`
**Changes**: Add tests for line highlight storage methods

```typescript
describe('Line Highlights', () => {
  it('should set and get line highlights', async () => {
    const testUri = vscode.Uri.file(path.join(workspaceRoot, 'test-file.ts'));

    storage.setLineHighlight(testUri, 10, 20, 'highlight-yellow');

    const highlights = storage.getLineHighlights(testUri);
    assert.strictEqual(highlights.length, 1);
    assert.strictEqual(highlights[0].startLine, 10);
    assert.strictEqual(highlights[0].endLine, 20);
    assert.strictEqual(highlights[0].typeId, 'highlight-yellow');
  });

  it('should remove overlapping highlights when setting new one', async () => {
    const testUri = vscode.Uri.file(path.join(workspaceRoot, 'test-file.ts'));

    storage.setLineHighlight(testUri, 10, 20, 'highlight-yellow');
    storage.setLineHighlight(testUri, 15, 25, 'highlight-blue');

    const highlights = storage.getLineHighlights(testUri);
    assert.strictEqual(highlights.length, 1);
    assert.strictEqual(highlights[0].typeId, 'highlight-blue');
  });

  it('should remove specific line highlight', async () => {
    const testUri = vscode.Uri.file(path.join(workspaceRoot, 'test-file.ts'));

    storage.setLineHighlight(testUri, 10, 20, 'highlight-yellow');
    storage.setLineHighlight(testUri, 30, 40, 'highlight-blue');

    storage.removeLineHighlight(testUri, 10, 20);

    const highlights = storage.getLineHighlights(testUri);
    assert.strictEqual(highlights.length, 1);
    assert.strictEqual(highlights[0].startLine, 30);
  });

  it('should remove all line highlights in file', async () => {
    const testUri = vscode.Uri.file(path.join(workspaceRoot, 'test-file.ts'));

    storage.setLineHighlight(testUri, 10, 20, 'highlight-yellow');
    storage.setLineHighlight(testUri, 30, 40, 'highlight-blue');

    storage.removeAllLineHighlightsInFile(testUri);

    const highlights = storage.getLineHighlights(testUri);
    assert.strictEqual(highlights.length, 0);
  });

  it('should report hasLineHighlights correctly', async () => {
    const testUri = vscode.Uri.file(path.join(workspaceRoot, 'test-file.ts'));

    assert.strictEqual(storage.hasLineHighlights(testUri), false);

    storage.setLineHighlight(testUri, 10, 20, 'highlight-yellow');
    assert.strictEqual(storage.hasLineHighlights(testUri), true);

    storage.removeAllLineHighlightsInFile(testUri);
    assert.strictEqual(storage.hasLineHighlights(testUri), false);
  });

  it('should persist line highlights to file', async () => {
    const testUri = vscode.Uri.file(path.join(workspaceRoot, 'test-file.ts'));

    storage.setLineHighlight(testUri, 10, 20, 'highlight-yellow');

    // Wait for debounced save
    await new Promise(resolve => setTimeout(resolve, 200));

    // Read the file and verify
    const content = await vscode.workspace.fs.readFile(storage.getStorageUri()!);
    const data = JSON.parse(Buffer.from(content).toString('utf8'));

    assert.ok(data.lineHighlights);
    assert.ok(data.lineHighlights['test-file.ts']);
    assert.strictEqual(data.lineHighlights['test-file.ts'].length, 1);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All new tests pass: `pnpm test`
- [x] No regression in existing tests
- [x] Type checking passes: `pnpm run check-types`
- [x] Linting passes: `pnpm run lint`

#### Manual Verification:
- [ ] Test coverage report shows new code is tested

**Implementation Note**: After completing this phase, run full test suite and verify all tests pass.

---

## Testing Strategy

### Unit Tests:
- Storage methods for line highlights (CRUD operations)
- Line highlight type loading from config
- Backward compatibility (loading old format without lineHighlights)
- Overlap detection and removal logic

### Integration Tests:
- Full flow: set highlight → persists → reload → highlight appears
- Commands work with editor selections
- File decoration shows correct indicators

### Manual Testing Steps:
1. Open extension in development host
2. Create a test file with 50+ lines
3. Select lines 10-15, right-click → "Set Line Highlight" → Yellow
4. Verify yellow background appears on lines 10-15
5. Check Explorer shows indicator badge on file
6. Select lines 30-35, add blue highlight
7. Verify both highlights visible
8. Close file, reopen → both highlights persist
9. Test "Remove Line Highlight" on first selection
10. Test "Remove All Line Highlights in File"
11. Add file marker to same file, verify both work together
12. Disable extension, verify highlights hidden
13. Re-enable, verify highlights reappear
14. **Test keyboard shortcut cycle:**
    - Select new lines, press `Cmd+Shift+H` → Yellow appears
    - Press `Cmd+Shift+H` again → changes to Green
    - Continue pressing → Blue → Red → Purple → Removed
    - Press again → Yellow (cycle restarts)

## Performance Considerations

1. **Decoration type caching**: Create `TextEditorDecorationType` once per highlight type, not per decoration
2. **Debounced updates**: Use existing 100ms debounce for storage writes
3. **Lazy loading**: Only apply decorations to visible editors
4. **Document change handling**: Throttle decoration updates on rapid edits

## Migration Notes

- No migration needed - new fields are additive
- Old `file-markers.json` files without `lineHighlights` field load normally
- New files will include empty `lineHighlights: {}` and `lineHighlightTypes: [...]`

## References

- VSCode TextEditor Decorations API: https://code.visualstudio.com/api/references/vscode-api#TextEditorDecorationType
- Decorator Sample: https://github.com/microsoft/vscode-extension-samples/tree/main/decorator-sample
- Current storage implementation: `src/storage.ts`
- Current decoration provider: `src/decorationProvider.ts`
