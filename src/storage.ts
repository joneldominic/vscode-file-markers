import * as vscode from 'vscode';
import * as path from 'path';
import { MarkerStorageData, MarkerChangeEvent } from './types';

const STORAGE_VERSION = 1;
const STORAGE_FILENAME = 'file-markers.json';

export class MarkerStorage implements vscode.Disposable {
  private markers: Map<string, string> = new Map();
  private storageUri: vscode.Uri | undefined;
  private disposables: vscode.Disposable[] = [];
  private writeDebounceTimer: NodeJS.Timeout | undefined;

  private readonly _onDidChangeMarkers = new vscode.EventEmitter<MarkerChangeEvent>();
  readonly onDidChangeMarkers = this._onDidChangeMarkers.event;

  constructor() {
    // Watch for workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.initialize())
    );
  }

  async initialize(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.markers.clear();
      this.storageUri = undefined;
      return;
    }

    this.storageUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      '.vscode',
      STORAGE_FILENAME
    );

    await this.load();
  }

  private async load(): Promise<void> {
    if (!this.storageUri) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this.storageUri);
      const data: MarkerStorageData = JSON.parse(
        Buffer.from(content).toString('utf8')
      );

      if (data.version === STORAGE_VERSION && data.markers) {
        this.markers = new Map(Object.entries(data.markers));
      }
    } catch {
      // File doesn't exist or is invalid - start fresh
      this.markers.clear();
    }
  }

  private async save(): Promise<void> {
    if (!this.storageUri) {
      return;
    }

    const data: MarkerStorageData = {
      version: STORAGE_VERSION,
      markers: Object.fromEntries(this.markers),
    };

    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8');

    // Ensure .vscode directory exists
    const vscodeDir = vscode.Uri.joinPath(this.storageUri, '..');
    try {
      await vscode.workspace.fs.createDirectory(vscodeDir);
    } catch {
      // Directory may already exist
    }

    await vscode.workspace.fs.writeFile(this.storageUri, content);
  }

  private scheduleSave(): void {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
    }
    this.writeDebounceTimer = setTimeout(() => {
      this.save().catch(err => {
        console.error('Failed to save markers:', err);
      });
    }, 100);
  }

  /**
   * Get the marker ID for a given URI
   */
  getMarker(uri: vscode.Uri): string | undefined {
    const relativePath = this.getRelativePath(uri);
    if (!relativePath) {
      return undefined;
    }
    return this.markers.get(relativePath);
  }

  /**
   * Set or update a marker for a given URI
   */
  setMarker(uri: vscode.Uri, markerId: string): void {
    const relativePath = this.getRelativePath(uri);
    if (!relativePath) {
      return;
    }

    this.markers.set(relativePath, markerId);
    this.scheduleSave();
    this._onDidChangeMarkers.fire({ uri, markerId });
  }

  /**
   * Remove a marker from a given URI
   */
  removeMarker(uri: vscode.Uri): void {
    const relativePath = this.getRelativePath(uri);
    if (!relativePath) {
      return;
    }

    if (this.markers.delete(relativePath)) {
      this.scheduleSave();
      this._onDidChangeMarkers.fire({ uri, markerId: undefined });
    }
  }

  /**
   * Check if a URI has a marker
   */
  hasMarker(uri: vscode.Uri): boolean {
    return this.getMarker(uri) !== undefined;
  }

  /**
   * Get all marked URIs (for refreshing decorations)
   */
  getAllMarkedUris(): vscode.Uri[] {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    return Array.from(this.markers.keys()).map(relativePath =>
      vscode.Uri.joinPath(workspaceFolder.uri, relativePath)
    );
  }

  private getRelativePath(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    const workspacePath = workspaceFolder.uri.fsPath;
    const filePath = uri.fsPath;

    if (!filePath.startsWith(workspacePath)) {
      return undefined;
    }

    // Get relative path and normalize separators
    return path.relative(workspacePath, filePath).split(path.sep).join('/');
  }

  dispose(): void {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
    }
    this._onDidChangeMarkers.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
