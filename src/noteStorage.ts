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
  private savePending = false;

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
    if (!this.storageUri) {
      return false;
    }

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
    if (!this.storageUri) {
      return;
    }

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
    this.savePending = true;
    this.writeDebounceTimer = setTimeout(() => {
      this.save()
        .then(() => { this.savePending = false; })
        .catch(err => {
          this.savePending = false;
          console.error('Failed to save notes:', err);
        });
    }, 100);
  }

  private scheduleReload(): void {
    // Skip reload when a save is pending — in-memory state is authoritative
    if (this.savePending) {
      return;
    }
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
    if (!rel) {
      return;
    }

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
    if (!rel) {
      return;
    }
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
    if (!workspaceFolder) {
      return [];
    }
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
    if (!workspaceFolder) {
      return undefined;
    }
    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    if (relativePath.startsWith('..')) {
      return undefined;
    }
    return relativePath.split(path.sep).join('/');
  }

  dispose(): void {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
    }
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }
    this._onDidChangeNotes.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
