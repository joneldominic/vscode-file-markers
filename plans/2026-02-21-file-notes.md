# File Notes Feature Implementation Plan

## Overview

Add the ability to attach text notes to files in the workspace. Notes are standalone (don't require a marker) and are stored in a **separate file** `.vscode/file-marker-notes.json` to avoid bloating the markers config. Users view and edit notes through a dedicated **File Notes activity bar panel** containing a webview note editor and a TreeView listing all annotated files. Notes are capped at 500 characters.

## Current State Analysis

- Marker storage lives in `.vscode/file-markers.json` using `MarkerStorageDataV2` format (`src/types.ts:76-82`)
- `MarkerStorage` (`src/storage.ts`) manages persistence with debounced writes (100ms), file watcher for external changes, and echo suppression
- `FileDecorationProvider` (`src/decorationProvider.ts`) renders badges/tooltips in Explorer
- No `viewContainers` or `views` exist in `package.json` — these are entirely new
- No webview infrastructure exists — `extensionUri` is not currently passed to providers
- All providers follow the pattern: receive `MarkerStorage` in constructor, subscribe to storage events, implement `vscode.Disposable`

### Key Discoveries

- `MarkerStorage` at `src/storage.ts` has reusable patterns: debounced writes, file watcher, echo suppression, relative path resolution via `getRelativePath()` (line 680)
- `decorationProvider.ts:53-123` already constructs tooltips — can append note text
- `extension.ts:13-64` wires everything in `activate()` — new providers follow the same pattern
- `commands.ts:5` takes `(context, storage)` — can be extended for note commands
- The existing `package.json` has no `views` or `viewContainers` — we'll register a new activity bar view container with both a webview view and a tree view

## Desired End State

- Notes stored in **`.vscode/file-marker-notes.json`** (separate from markers) with format:
  ```json
  { "notes": { "src/file.ts": "This file needs refactoring before v2" } }
  ```
- A **dedicated activity bar icon** (e.g., `$(note)` or `$(bookmark)`) that opens the "File Notes" sidebar
- The sidebar contains two views:
  - **"Noted Files" TreeView** at the top — lists all files that have notes, click to open, note preview inline
  - **"File Note" webview editor** below — textarea for editing the active file's note (500 char limit, save/clear)
- Explorer **tooltip** shows note text when hovering over an annotated file
- Explorer **badge** shows `N` for files that have only a note (no marker)
- **Context menu** entries: "Add/Edit Note..." and "Remove Note" in Explorer and tab context menus
- Notes auto-sync when the JSON file changes externally

### Verification

- Open the webview panel → select a file → type a note → note persists in `.vscode/file-marker-notes.json` (NOT in `file-markers.json`)
- The Noted Files TreeView lists the annotated file with a preview
- Click a tree item → opens the file in editor and shows its note in the webview
- Hover over annotated file in Explorer → tooltip shows the note
- Edit `.vscode/file-marker-notes.json` externally → both panels reflect changes
- Notes work independently of markers (file can have a note without a marker)

## What We're NOT Doing

- Rich text / Markdown editing (plain text only)
- Per-line notes (only file-level)
- Note history or versioning
- Note templates or categories
- Full-text search across notes
- Collaborative editing / conflict resolution

## Implementation Approach

We'll work bottom-up: separate note storage first, then the webview editor panel, then the TreeView browser, then Explorer integration (tooltips, badges, commands, menus).

---

## Phase 1: Note Storage — Separate NoteStorage Class

### Overview

Create a dedicated `NoteStorage` class that manages `.vscode/file-marker-notes.json`. It follows the same patterns as `MarkerStorage` (debounced writes, file watcher, echo suppression) but is much simpler since it only stores notes.

### Changes Required

#### 1. Types — Note Storage Data

**File**: `src/types.ts`
**Changes**: Add `NoteStorageData` interface

```typescript
/** Storage format for file notes (separate file) */
export interface NoteStorageData {
  notes: Record<string, string>; // relativePath -> note text
}
```

#### 2. NoteStorage — New File

**File**: `src/noteStorage.ts` (new file)
**Changes**: Full implementation of note persistence

```typescript
import * as vscode from 'vscode';
import * as path from 'path';

const NOTES_FILENAME = 'file-marker-notes.json';
const MAX_NOTE_LENGTH = 500;

export class NoteStorage implements vscode.Disposable {
  private notes: Map<string, string> = new Map();
  private storageUri: vscode.Uri | undefined;
  private disposables: vscode.Disposable[] = [];
  private writeDebounceTimer: NodeJS.Timeout | undefined;
  private configWatcher: vscode.FileSystemWatcher | undefined;
  private reloadDebounceTimer: NodeJS.Timeout | undefined;
  private lastSavedContent: string | undefined;

  private readonly _onDidChangeNotes = new vscode.EventEmitter<{ uri: vscode.Uri }>();
  readonly onDidChangeNotes = this._onDidChangeNotes.event;

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.initialize())
    );
  }

  async initialize(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.notes.clear();
      this.storageUri = undefined;
      return;
    }

    this.storageUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      '.vscode',
      NOTES_FILENAME
    );

    // Set up file watcher
    if (this.configWatcher) {
      this.configWatcher.dispose();
    }
    const pattern = new vscode.RelativePattern(
      workspaceFolder,
      `.vscode/${NOTES_FILENAME}`
    );
    this.configWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.disposables.push(this.configWatcher);

    this.configWatcher.onDidChange(() => this.scheduleReload());
    this.configWatcher.onDidCreate(() => this.scheduleReload());
    this.configWatcher.onDidDelete(() => this.scheduleReload());

    // Also watch for in-editor saves
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(doc => {
        if (this.storageUri && doc.uri.toString() === this.storageUri.toString()) {
          this.scheduleReload();
        }
      })
    );

    await this.load();
  }

  private async load(): Promise<boolean> {
    if (!this.storageUri) return false;

    try {
      const content = await vscode.workspace.fs.readFile(this.storageUri);
      const contentStr = Buffer.from(content).toString('utf8');

      if (this.lastSavedContent && contentStr === this.lastSavedContent) {
        return false;
      }

      const data = JSON.parse(contentStr);
      this.notes = new Map(Object.entries(data.notes || {}));
      this.lastSavedContent = undefined;
      return true;
    } catch {
      const hadData = this.notes.size > 0;
      this.notes.clear();
      this.lastSavedContent = undefined;
      return hadData;
    }
  }

  private async save(): Promise<void> {
    if (!this.storageUri) return;

    const data = { notes: Object.fromEntries(this.notes) };
    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8');

    // Ensure .vscode directory exists
    const vscodeDir = vscode.Uri.joinPath(this.storageUri, '..');
    try {
      await vscode.workspace.fs.createDirectory(vscodeDir);
    } catch {
      // Directory may already exist
    }

    this.lastSavedContent = content.toString();
    await vscode.workspace.fs.writeFile(this.storageUri, content);
  }

  private scheduleSave(): void {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
    }
    this.writeDebounceTimer = setTimeout(() => {
      this.save().catch(err => console.error('Failed to save notes:', err));
    }, 100);
  }

  private scheduleReload(): void {
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }
    this.reloadDebounceTimer = setTimeout(() => {
      this.load().then(changed => {
        if (changed) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            this._onDidChangeNotes.fire({ uri: workspaceFolder.uri });
          }
        }
      }).catch(err => console.error('Failed to reload notes:', err));
    }, 100);
  }

  // --- Public API ---

  getNote(uri: vscode.Uri): string | undefined {
    const rel = this.getRelativePath(uri);
    return rel ? this.notes.get(rel) : undefined;
  }

  setNote(uri: vscode.Uri, text: string): void {
    const rel = this.getRelativePath(uri);
    if (!rel) return;

    const trimmed = text.trim();
    if (!trimmed) {
      this.removeNote(uri);
      return;
    }

    this.notes.set(rel, trimmed.substring(0, MAX_NOTE_LENGTH));
    this._onDidChangeNotes.fire({ uri });
    this.scheduleSave();
  }

  removeNote(uri: vscode.Uri): void {
    const rel = this.getRelativePath(uri);
    if (!rel) return;
    if (this.notes.delete(rel)) {
      this._onDidChangeNotes.fire({ uri });
      this.scheduleSave();
    }
  }

  hasNote(uri: vscode.Uri): boolean {
    const rel = this.getRelativePath(uri);
    return rel ? this.notes.has(rel) : false;
  }

  getNoteCount(): number {
    return this.notes.size;
  }

  getAllNotedFiles(): { uri: vscode.Uri; relativePath: string; note: string }[] {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return [];
    return Array.from(this.notes.entries()).map(([relativePath, note]) => ({
      uri: vscode.Uri.joinPath(workspaceFolder.uri, relativePath),
      relativePath,
      note,
    }));
  }

  getStorageUri(): vscode.Uri | undefined {
    return this.storageUri;
  }

  private getRelativePath(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;
    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    if (relativePath.startsWith('..')) return undefined;
    return relativePath.split(path.sep).join('/');
  }

  dispose(): void {
    if (this.writeDebounceTimer) clearTimeout(this.writeDebounceTimer);
    if (this.reloadDebounceTimer) clearTimeout(this.reloadDebounceTimer);
    this._onDidChangeNotes.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
```

#### 3. Extension Entry Point — Initialize NoteStorage

**File**: `src/extension.ts`
**Changes**: Create and wire `NoteStorage` alongside `MarkerStorage`

Add import:
```typescript
import { NoteStorage } from './noteStorage';
```

Add module-level variable:
```typescript
let noteStorage: NoteStorage | undefined;
```

In `activate()`, after `storage.initialize()` (after line 20):
```typescript
noteStorage = new NoteStorage();
await noteStorage.initialize();
context.subscriptions.push(noteStorage);
```

In `deactivate()`:
```typescript
noteStorage = undefined;
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles cleanly: `pnpm run compile`
- [x] Linter passes: `pnpm run lint`
- [x] Existing tests still pass: `pnpm test`

#### Manual Verification
- [ ] Set a note via debug console → verify `.vscode/file-marker-notes.json` is created (NOT in `file-markers.json`)
- [ ] File format is `{ "notes": { "path": "text" } }`
- [ ] Empty notes are not stored (key is deleted)
- [ ] Notes > 500 chars are truncated
- [ ] Editing `.vscode/file-marker-notes.json` externally fires change events

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Activity Bar + Webview Sidebar Panel — Note Editor

### Overview

Register a new **"File Notes" activity bar icon** with its own view container. Create a `WebviewViewProvider` for the note editor that renders inside this container, showing the note for the active file with a textarea for editing.

### Changes Required

#### 1. Package.json — Activity Bar View Container and Views

**File**: `package.json`
**Changes**: Register a new view container on the activity bar, and place both views inside it

```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "fileNotes",
      "title": "File Notes",
      "icon": "$(bookmark)"
    }
  ]
},
"views": {
  "fileNotes": [
    {
      "id": "fileMarkers.notedFiles",
      "name": "Noted Files",
      "when": "config.fileMarkers.enabled"
    },
    {
      "type": "webview",
      "id": "fileMarkers.noteEditor",
      "name": "Note Editor",
      "when": "config.fileMarkers.enabled"
    }
  ]
}
```

This creates a dedicated activity bar icon. The "Noted Files" TreeView sits on top for browsing, and the "Note Editor" webview sits below for editing. Both are collapsible. The `$(bookmark)` is a built-in codicon; we can also use a custom SVG icon in `assets/` if desired.

**Note on icon**: `$(bookmark)` is a codicon reference. For activity bar icons, VSCode requires an SVG or PNG file path, not a codicon. We'll create a simple SVG icon at `assets/notes-icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
  <line x1="16" y1="13" x2="8" y2="13"/>
  <line x1="16" y1="17" x2="8" y2="17"/>
  <line x1="10" y1="9" x2="8" y2="9"/>
</svg>
```

The view container config becomes:
```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "fileNotes",
      "title": "File Notes",
      "icon": "assets/notes-icon.svg"
    }
  ]
}
```

#### 2. NotesViewProvider — New File

**File**: `src/notesViewProvider.ts` (new file)
**Changes**: Implement `WebviewViewProvider`

The provider will:
- Implement `vscode.WebviewViewProvider`
- Track the currently active file via `vscode.window.onDidChangeActiveTextEditor`
- Send the current note to the webview when the active file changes
- Receive note edits from the webview via message passing
- Listen to `noteStorage.onDidChangeNotes` for external changes
- Use a minimal HTML/CSS textarea UI (no framework dependencies)
- Accept `NoteStorage` and `MarkerStorage` — the latter to show the file's marker info

```typescript
import * as vscode from 'vscode';
import { NoteStorage } from './noteStorage';
import { MarkerStorage } from './storage';

export class NotesViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'fileMarkers.noteEditor';

  private view?: vscode.WebviewView;
  private currentUri?: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly noteStorage: NoteStorage,
    private readonly markerStorage: MarkerStorage
  ) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        this.updateForEditor(editor);
      })
    );

    this.disposables.push(
      noteStorage.onDidChangeNotes(({ uri }) => {
        // Refresh if workspace-level change or matching file
        if (this.currentUri) {
          this.sendNoteToWebview();
        }
      })
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'save':
          if (this.currentUri) {
            this.noteStorage.setNote(this.currentUri, message.text);
          }
          break;
        case 'clear':
          if (this.currentUri) {
            const fileName = vscode.workspace.asRelativePath(this.currentUri);
            const confirm = await vscode.window.showWarningMessage(
              `Remove note from "${fileName}"?`,
              { modal: true },
              'Remove'
            );
            if (confirm === 'Remove') {
              this.noteStorage.removeNote(this.currentUri);
              // Tell webview to clear the textarea
              this.sendNoteToWebview();
            }
          }
          break;
      }
    }, undefined, this.disposables);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.updateForEditor(vscode.window.activeTextEditor);
      }
    }, undefined, this.disposables);

    this.updateForEditor(vscode.window.activeTextEditor);
  }

  /** Allow external callers (e.g., tree view click) to set the target file */
  showNoteForUri(uri: vscode.Uri): void {
    this.currentUri = uri;
    this.sendNoteToWebview();
  }

  private updateForEditor(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.uri.scheme !== 'file') {
      this.currentUri = undefined;
      this.view?.webview.postMessage({
        type: 'update',
        filePath: null,
        note: '',
        hasMarker: false,
        markerLabel: '',
        markerBadge: '',
      });
      return;
    }
    this.currentUri = editor.document.uri;
    this.sendNoteToWebview();
  }

  private sendNoteToWebview(): void {
    if (!this.view || !this.currentUri) return;

    const note = this.noteStorage.getNote(this.currentUri) || '';
    const markerId = this.markerStorage.getMarker(this.currentUri);
    const markerType = markerId ? this.markerStorage.getMarkerType(markerId) : undefined;
    const filePath = vscode.workspace.asRelativePath(this.currentUri);

    this.view.webview.postMessage({
      type: 'update',
      filePath,
      note,
      hasMarker: !!markerId,
      markerLabel: markerType?.label || '',
      markerBadge: markerType?.badge || '',
    });
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      padding: 8px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    .file-path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
      word-break: break-all;
    }
    .marker-badge {
      display: inline-block;
      margin-right: 4px;
      font-size: 11px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .no-file {
      color: var(--vscode-disabledForeground);
      font-style: italic;
      text-align: center;
      margin-top: 20px;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      resize: vertical;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      padding: 6px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      box-sizing: border-box;
    }
    textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }
    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
    }
    .char-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .char-count.over-limit {
      color: var(--vscode-errorForeground);
    }
    .buttons { display: flex; gap: 4px; }
    button {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 10px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button.primary:hover { background: var(--vscode-button-hoverBackground); }
    .content { display: block; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div id="no-file" class="no-file">No file selected</div>
  <div id="content" class="hidden">
    <div class="file-path">
      <span id="marker-info"></span>
      <span id="file-path"></span>
    </div>
    <textarea id="note-input" maxlength="500"
      placeholder="Add a note for this file..."></textarea>
    <div class="controls">
      <span id="char-count" class="char-count">0 / 500</span>
      <div class="buttons">
        <button id="clear-btn">Clear</button>
        <button id="save-btn" class="primary">Save</button>
      </div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const noteInput = document.getElementById('note-input');
    const charCount = document.getElementById('char-count');
    const saveBtn = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');
    const filePathEl = document.getElementById('file-path');
    const markerInfo = document.getElementById('marker-info');
    const contentEl = document.getElementById('content');
    const noFileEl = document.getElementById('no-file');
    let lastSavedNote = '';

    noteInput.addEventListener('input', () => {
      const len = noteInput.value.length;
      charCount.textContent = len + ' / 500';
      charCount.className = len >= 500 ? 'char-count over-limit' : 'char-count';
    });

    saveBtn.addEventListener('click', () => {
      lastSavedNote = noteInput.value;
      vscode.postMessage({ type: 'save', text: noteInput.value });
    });

    clearBtn.addEventListener('click', () => {
      // Don't clear textarea here — wait for confirmation from extension host.
      // If confirmed, extension sends an 'update' message with empty note.
      vscode.postMessage({ type: 'clear' });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'update') {
        if (!msg.filePath) {
          contentEl.className = 'hidden';
          noFileEl.className = 'no-file';
          return;
        }
        contentEl.className = 'content';
        noFileEl.className = 'hidden';
        filePathEl.textContent = msg.filePath;
        markerInfo.innerHTML = msg.hasMarker
          ? '<span class="marker-badge">' + escapeHtml(msg.markerBadge) +
            ' ' + escapeHtml(msg.markerLabel) + '</span>'
          : '';
        if (noteInput.value === lastSavedNote || noteInput.value === '') {
          noteInput.value = msg.note;
          lastSavedNote = msg.note;
        }
        const len = noteInput.value.length;
        charCount.textContent = len + ' / 500';
        charCount.className = len >= 500 ? 'char-count over-limit' : 'char-count';
      }
    });

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
  </script>
</body>
</html>`;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
```

#### 3. Extension Entry Point — Register NotesViewProvider

**File**: `src/extension.ts`
**Changes**: Import, instantiate, and register

```typescript
import { NotesViewProvider } from './notesViewProvider';
```

Module-level variable:
```typescript
let notesViewProvider: NotesViewProvider | undefined;
```

In `activate()` (after noteStorage init):
```typescript
notesViewProvider = new NotesViewProvider(context.extensionUri, noteStorage, storage);
context.subscriptions.push(notesViewProvider);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    NotesViewProvider.viewType,
    notesViewProvider
  )
);
```

In `deactivate()`:
```typescript
notesViewProvider = undefined;
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles cleanly: `pnpm run compile`
- [x] Linter passes: `pnpm run lint`
- [x] Existing tests still pass: `pnpm test`

#### Manual Verification
- [ ] A "File Notes" icon appears in the activity bar (bookmark/document icon)
- [ ] Clicking the icon opens the File Notes sidebar with "Noted Files" and "Note Editor" sections
- [ ] Selecting a file in the editor updates the "Note Editor" panel with the file path
- [ ] Typing a note and clicking "Save" persists it to `.vscode/file-marker-notes.json`
- [ ] `.vscode/file-markers.json` is NOT modified
- [ ] Switching files shows the correct note for each file
- [ ] "Clear" button removes the note
- [ ] Character count updates in real-time, shows red at 500
- [ ] Panel shows "No file selected" when no editor is active
- [ ] Marker badge/label shows in the panel when the file has a marker
- [ ] External edits to `.vscode/file-marker-notes.json` update the panel

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Noted Files TreeView — Browse and Navigate

### Overview

Create a `TreeDataProvider` for the "Noted Files" view (already registered in Phase 2's `package.json` under the `fileNotes` activity bar container). Users can browse all annotated files, see note previews, and click to open the file + show its note in the editor panel.

### Changes Required

#### 1. NotedFilesTreeProvider — New File

**File**: `src/notedFilesTreeProvider.ts` (new file)
**Changes**: Implement `TreeDataProvider`

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { NoteStorage } from './noteStorage';
import { MarkerStorage } from './storage';

export class NotedFilesTreeProvider
  implements vscode.TreeDataProvider<NoteTreeItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<NoteTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly noteStorage: NoteStorage,
    private readonly markerStorage: MarkerStorage
  ) {
    this.disposables.push(
      noteStorage.onDidChangeNotes(() => this._onDidChangeTreeData.fire())
    );
    this.disposables.push(
      markerStorage.onDidChangeMarkers(() => this._onDidChangeTreeData.fire())
    );
  }

  getTreeItem(element: NoteTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): NoteTreeItem[] {
    const files = this.noteStorage.getAllNotedFiles();
    if (files.length === 0) return [];

    return files.map(({ uri, relativePath, note }) => {
      const fileName = path.basename(relativePath);
      const dirPath = path.dirname(relativePath);
      const markerId = this.markerStorage.getMarker(uri);
      const markerType = markerId
        ? this.markerStorage.getMarkerType(markerId)
        : undefined;

      const item = new NoteTreeItem(
        fileName,
        uri,
        vscode.TreeItemCollapsibleState.None
      );

      // Show note preview as description (truncated)
      const preview = note.length > 60 ? note.substring(0, 57) + '...' : note;
      item.description = preview;

      // Full note + marker info in tooltip (supports MarkdownString)
      const tooltipParts: string[] = [];
      if (markerType) {
        tooltipParts.push(`**${markerType.badge} ${markerType.label}**`);
      }
      tooltipParts.push(note);
      tooltipParts.push(`\n\n*${relativePath}*`);
      item.tooltip = new vscode.MarkdownString(tooltipParts.join('\n\n'));

      // Show folder path as detail if not in root
      if (dirPath && dirPath !== '.') {
        item.description = `${dirPath} — ${preview}`;
      }

      // File icon
      item.resourceUri = uri;
      item.iconPath = vscode.ThemeIcon.File;

      // Click to open file
      item.command = {
        command: 'file-markers.openNotedFile',
        title: 'Open File',
        arguments: [uri],
      };

      item.contextValue = 'notedFile';

      return item;
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

class NoteTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly fileUri: vscode.Uri,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}
```

#### 2. Extension Entry Point — Register TreeView

**File**: `src/extension.ts`
**Changes**: Import, instantiate, register

```typescript
import { NotedFilesTreeProvider } from './notedFilesTreeProvider';
```

Module-level variable:
```typescript
let notedFilesTreeProvider: NotedFilesTreeProvider | undefined;
```

In `activate()` (after notesViewProvider):
```typescript
notedFilesTreeProvider = new NotedFilesTreeProvider(noteStorage, storage);
context.subscriptions.push(notedFilesTreeProvider);
context.subscriptions.push(
  vscode.window.createTreeView('fileMarkers.notedFiles', {
    treeDataProvider: notedFilesTreeProvider,
  })
);
```

In `deactivate()`:
```typescript
notedFilesTreeProvider = undefined;
```

#### 3. Commands — Open Noted File

**File**: `src/commands.ts`
**Changes**: Register `openNotedFile` command that opens the file and focuses the note editor

The command handler needs access to `notesViewProvider` to call `showNoteForUri()`. Two options:
- Pass `notesViewProvider` to `registerCommands()`, OR
- Register this command inline in `extension.ts`

Register inline in `extension.ts` (simpler, matches `showMarkerStats` pattern):
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.openNotedFile',
    async (uri: vscode.Uri) => {
      // Open the file in editor
      await vscode.window.showTextDocument(uri, { preview: false });
      // The notesViewProvider will auto-update via onDidChangeActiveTextEditor
    }
  )
);
```

#### 4. Package.json — Commands and Menus for Tree View

**File**: `package.json`
**Changes**: Register commands used by tree view context menu

Commands:
```json
{
  "command": "file-markers.openNotedFile",
  "title": "Open File"
},
{
  "command": "file-markers.revealNotedFile",
  "title": "Reveal in Explorer",
  "icon": "$(go-to-file)"
},
{
  "command": "file-markers.removeNoteFromTree",
  "title": "Remove Note",
  "icon": "$(trash)"
}
```

Menus — add `view/item/context` for tree items. Inline buttons show as icons on hover; the right-click context menu provides the text labels:
```json
"view/item/context": [
  {
    "command": "file-markers.revealNotedFile",
    "when": "view == fileMarkers.notedFiles && viewItem == notedFile",
    "group": "inline@1"
  },
  {
    "command": "file-markers.removeNoteFromTree",
    "when": "view == fileMarkers.notedFiles && viewItem == notedFile",
    "group": "inline@2"
  },
  {
    "command": "file-markers.revealNotedFile",
    "when": "view == fileMarkers.notedFiles && viewItem == notedFile",
    "group": "navigation"
  },
  {
    "command": "file-markers.removeNoteFromTree",
    "when": "view == fileMarkers.notedFiles && viewItem == notedFile",
    "group": "7_modification"
  }
]
```

This gives each tree item:
- **Inline icons** (visible on hover): `$(go-to-file)` to reveal in Explorer, `$(trash)` to remove note
- **Right-click context menu**: "Reveal in Explorer" in navigation group, "Remove Note" in modification group

Command palette — hide tree-specific commands:
```json
{
  "command": "file-markers.openNotedFile",
  "when": "false"
},
{
  "command": "file-markers.revealNotedFile",
  "when": "false"
},
{
  "command": "file-markers.removeNoteFromTree",
  "when": "false"
}
```

Register commands inline in `extension.ts`:
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.revealNotedFile',
    (item: { fileUri: vscode.Uri }) => {
      if (item?.fileUri) {
        vscode.commands.executeCommand('revealInExplorer', item.fileUri);
      }
    }
  )
);

context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.removeNoteFromTree',
    async (item: { fileUri: vscode.Uri }) => {
      if (!item?.fileUri) return;
      const fileName = vscode.workspace.asRelativePath(item.fileUri);
      const confirm = await vscode.window.showWarningMessage(
        `Remove note from "${fileName}"?`,
        { modal: true },
        'Remove'
      );
      if (confirm === 'Remove') {
        noteStorage.removeNote(item.fileUri);
      }
    }
  )
);
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles cleanly: `pnpm run compile`
- [x] Linter passes: `pnpm run lint`
- [x] Existing tests still pass: `pnpm test`

#### Manual Verification
- [ ] "Noted Files" tree view appears in the File Notes activity bar panel
- [ ] Files with notes are listed with filename and note preview
- [ ] Clicking a tree item opens the file in the editor
- [ ] The "Note Editor" webview panel below updates to show the clicked file's note
- [ ] Hovering over a tree item shows inline `$(go-to-file)` and `$(trash)` icons
- [ ] Clicking `$(go-to-file)` icon switches to Explorer and reveals/highlights the file
- [ ] Right-clicking a tree item shows "Reveal in Explorer" and "Remove Note" in context menu
- [ ] "Reveal in Explorer" from context menu also switches to Explorer and highlights the file
- [ ] Tooltip shows full note text and marker info (if any)
- [ ] Trash icon on tree items removes the note
- [ ] Tree auto-refreshes when notes are added/removed/edited
- [ ] Tree shows empty state when no files have notes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Explorer Integration — Tooltips, Badges, and Context Menu

### Overview

Show note indicators in the Explorer (badge + tooltip) and add context menu entries for quick note management.

### Changes Required

#### 1. DecorationProvider — Show Notes in Tooltips and Badges

**File**: `src/decorationProvider.ts`
**Changes**: Accept `NoteStorage`, subscribe to `onDidChangeNotes`, append note text to tooltip, show note badge

Update constructor to accept both storages:
```typescript
constructor(
  private readonly storage: MarkerStorage,
  private readonly noteStorage: NoteStorage
)
```

Add constant at top of file:
```typescript
const NOTE_BADGE = 'N';
```

Subscribe to notes changes in constructor:
```typescript
this.disposables.push(
  noteStorage.onDidChangeNotes(() => this.refresh())
);
```

In `provideFileDecoration()`, also check for notes:

```typescript
const effectiveMarker = this.storage.getEffectiveMarker(uri);
const hasLineHighlights = this.storage.hasLineHighlights(uri);
const note = this.noteStorage.getNote(uri);

if (!effectiveMarker && !hasLineHighlights && !note) {
  return undefined;
}
```

Tooltip appending (when a marker exists):
```typescript
if (note) {
  const notePreview = note.length > 100 ? note.substring(0, 97) + '...' : note;
  tooltip = `${tooltip}\n---\nNote: ${notePreview}`;
}
```

Note-only files (no marker, no highlights):
```typescript
if (!effectiveMarker && !hasLineHighlights && note) {
  const notePreview = note.length > 100 ? note.substring(0, 97) + '...' : note;
  return {
    badge: NOTE_BADGE,
    color: new vscode.ThemeColor('descriptionForeground'),
    tooltip: `Note: ${notePreview}`,
    propagate: false,
  };
}
```

#### 2. Extension Entry Point — Pass NoteStorage to DecorationProvider

**File**: `src/extension.ts`
**Changes**: Update `MarkerDecorationProvider` instantiation

```typescript
decorationProvider = new MarkerDecorationProvider(storage, noteStorage);
```

#### 3. Package.json — Note Commands and Context Menu

**File**: `package.json`
**Changes**: Register note commands and context menu entries

New commands:
```json
{
  "command": "file-markers.setNote",
  "title": "File Markers: Add/Edit Note..."
},
{
  "command": "file-markers.removeNote",
  "title": "File Markers: Remove Note"
}
```

In `explorer/context` (after removeMarkersInFolder):
```json
{
  "command": "file-markers.setNote",
  "when": "config.fileMarkers.enabled",
  "group": "2_workspace@4"
},
{
  "command": "file-markers.removeNote",
  "when": "config.fileMarkers.enabled",
  "group": "2_workspace@5"
}
```

In `editor/title/context` (after removeMarker):
```json
{
  "command": "file-markers.setNote",
  "group": "3_fileMarkers@3"
},
{
  "command": "file-markers.removeNote",
  "group": "3_fileMarkers@4"
}
```

In `commandPalette` (hidden — they require file URI context):
```json
{
  "command": "file-markers.setNote",
  "when": "false"
},
{
  "command": "file-markers.removeNote",
  "when": "false"
}
```

#### 4. Commands — Register Note Commands

**File**: `src/commands.ts`
**Changes**: Update `registerCommands` signature and add note commands

Update signature:
```typescript
export function registerCommands(
  context: vscode.ExtensionContext,
  storage: MarkerStorage,
  noteStorage: NoteStorage
): void {
```

Add import:
```typescript
import { NoteStorage } from './noteStorage';
```

Register `setNote` — opens the File Notes activity bar panel and focuses the note editor:
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.setNote',
    async (uri: vscode.Uri) => {
      if (!uri) return;
      // Open the File Notes activity bar panel and focus the note editor
      await vscode.commands.executeCommand('fileMarkers.noteEditor.focus');
    }
  )
);
```

Register `removeNote` (with confirmation dialog):
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand(
    'file-markers.removeNote',
    async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
      const targets = uris && uris.length > 0 ? uris : uri ? [uri] : [];
      if (targets.length === 0) return;

      const label = targets.length === 1
        ? `Remove note from "${vscode.workspace.asRelativePath(targets[0])}"?`
        : `Remove notes from ${targets.length} files?`;
      const confirm = await vscode.window.showWarningMessage(
        label,
        { modal: true },
        'Remove'
      );
      if (confirm === 'Remove') {
        for (const target of targets) {
          noteStorage.removeNote(target);
        }
      }
    }
  )
);
```

Update call site in `extension.ts`:
```typescript
registerCommands(context, storage, noteStorage);
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles cleanly: `pnpm run compile`
- [x] Linter passes: `pnpm run lint`
- [x] Existing tests still pass: `pnpm test`

#### Manual Verification
- [ ] Files with notes show `N` badge in Explorer (when they have no marker)
- [ ] Files with marker + note show marker badge, tooltip includes note
- [ ] Hovering over annotated file shows note text in tooltip
- [ ] Right-click file in Explorer → "File Markers: Add/Edit Note..." opens the File Notes activity bar panel
- [ ] Right-click file → "File Markers: Remove Note" removes the note
- [ ] Tab context menu also shows note commands
- [ ] Note badge disappears when note is removed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 5: Tests

### Overview

Add unit tests for the new note storage and decoration behavior.

### Changes Required

#### 1. NoteStorage Tests

**File**: `src/test/noteStorage.test.ts` (new file)
**Changes**: Test CRUD operations

Test cases:
- `setNote` stores note and fires event
- `setNote` with empty/whitespace text removes the note
- `setNote` truncates text > 500 chars
- `removeNote` removes note and fires event
- `removeNote` on non-existent note is a no-op
- `getNote` returns undefined for files without notes
- `hasNote` returns correct boolean
- `getNoteCount` returns correct count
- `getAllNotedFiles` returns correct entries
- Notes survive save/load cycle (serialization roundtrip)
- Storage file format is `{ "notes": { ... } }`
- Notes file is separate from markers file

#### 2. DecorationProvider Tests

**File**: `src/test/decorationProvider.test.ts` (existing file, extend)
**Changes**: Add note-related decoration test cases

Test cases:
- File with note only → returns `N` badge and note tooltip
- File with marker + note → returns marker badge, tooltip includes note
- File without note or marker → returns undefined

### Success Criteria

#### Automated Verification
- [x] All tests pass: `pnpm test`
- [x] TypeScript compiles: `pnpm run compile`
- [x] Linter passes: `pnpm run lint`

---

## Testing Strategy

### Unit Tests
- NoteStorage CRUD operations
- Serialization/deserialization roundtrip
- DecorationProvider behavior with notes
- Character limit enforcement
- Empty note cleanup

### Manual Testing Steps
1. Launch Extension Development Host (F5)
2. Verify a "File Notes" icon appears in the activity bar (bookmark/document icon)
3. Click the activity bar icon → sidebar opens with "Noted Files" tree and "Note Editor" panel
4. Click on a file in the editor → "Note Editor" shows file path and empty textarea
5. Type a note → click Save → verify `.vscode/file-marker-notes.json` (separate from markers)
6. Verify the file appears in "Noted Files" tree with preview text
7. Click the tree item → file opens in editor, note editor shows the note
8. Switch files → verify note loads for each file
9. Set a marker on a file with a note → verify both show in Explorer tooltip
10. Type 500 characters → verify counter turns red, can't type more
11. Click Clear → verify note removed, file disappears from tree
12. Hover over tree item → verify inline go-to-file and trash icons appear
13. Click go-to-file icon → verify Explorer opens and highlights the file
14. Right-click tree item → verify "Reveal in Explorer" and "Remove Note" in context menu
15. Click trash icon on tree item → note removed
16. Edit `.vscode/file-marker-notes.json` manually → verify both panels update
17. Right-click file in Explorer → "Add/Edit Note..." opens the File Notes sidebar
18. Hover over annotated file in Explorer → verify tooltip shows note
19. Switch to a different activity bar panel and back → notes sidebar preserves state

## Performance Considerations

- NoteStorage is lightweight — separate from marker storage, own debounced writes
- The TreeView re-renders lazily (only when `onDidChangeTreeData` fires)
- The webview panel only renders when visible; no overhead when collapsed
- `postMessage` is lightweight — only sends data for the active file
- Separate file means marker save/load is unaffected by note operations

## Storage Impact Analysis

Notes are in a **separate file** so they have zero impact on `file-markers.json`.

`.vscode/file-marker-notes.json` size:

| Scenario | Files with Notes | Avg Note Length | File Size |
|----------|-----------------|-----------------|-----------|
| Light use | 10 | 100 chars | ~1.5 KB |
| Moderate | 50 | 250 chars | ~18 KB |
| Heavy | 200 | 500 chars | ~140 KB |

The file only exists when notes are used. Empty notes map → file can be deleted entirely.

## Migration Notes

- No migration needed — this is a new feature with a new file
- Existing `file-markers.json` is untouched
- The `.vscode/file-marker-notes.json` file is created on first note save
- Users can add `file-marker-notes.json` to `.gitignore` if they don't want to share notes, or commit it for team visibility
