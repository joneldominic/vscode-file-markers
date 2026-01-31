import * as vscode from 'vscode';
import * as path from 'path';
import { MarkerStorageData, MarkerChangeEvent, MarkerTypeConfig, MarkerType } from './types';
import { DEFAULT_MARKER_TYPES } from './defaults';

const STORAGE_FILENAME = 'file-markers.json';

/**
 * Fallback marker for unknown/orphaned marker IDs
 */
export const FALLBACK_MARKER: MarkerType = {
  id: '__unknown__',
  badge: '⚠',
  color: new vscode.ThemeColor('editorWarning.foreground'),
  label: 'Unknown Marker',
};

export class MarkerStorage implements vscode.Disposable {
  private markerTypes: Map<string, MarkerType> = new Map();
  private markers: Map<string, string> = new Map();
  private storageUri: vscode.Uri | undefined;
  private disposables: vscode.Disposable[] = [];
  private writeDebounceTimer: NodeJS.Timeout | undefined;

  private readonly _onDidChangeMarkers = new vscode.EventEmitter<MarkerChangeEvent>();
  readonly onDidChangeMarkers = this._onDidChangeMarkers.event;

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.initialize())
    );
  }

  async initialize(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.markerTypes.clear();
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
      const data = JSON.parse(Buffer.from(content).toString('utf8'));

      this.loadMarkerTypes(data.markerTypes || DEFAULT_MARKER_TYPES);
      this.markers = new Map(Object.entries(data.markers || {}));
    } catch {
      // File doesn't exist or is invalid - use defaults
      this.loadMarkerTypes(DEFAULT_MARKER_TYPES);
      this.markers.clear();
    }
  }

  private loadMarkerTypes(configs: MarkerTypeConfig[]): void {
    this.markerTypes.clear();
    for (const config of configs) {
      if (this.isValidMarkerTypeConfig(config)) {
        this.markerTypes.set(config.id, {
          id: config.id,
          badge: config.badge.substring(0, 2),
          color: new vscode.ThemeColor(config.color),
          label: config.label,
        });
      }
    }
  }

  private isValidMarkerTypeConfig(config: unknown): config is MarkerTypeConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }
    const c = config as Record<string, unknown>;
    return (
      typeof c.id === 'string' && c.id.length > 0 &&
      typeof c.badge === 'string' && c.badge.length > 0 &&
      typeof c.color === 'string' && c.color.length > 0 &&
      typeof c.label === 'string' && c.label.length > 0
    );
  }

  private async save(): Promise<void> {
    if (!this.storageUri) {
      return;
    }

    // Convert marker types back to config format
    const markerTypes: MarkerTypeConfig[] = Array.from(this.markerTypes.values()).map(m => ({
      id: m.id,
      badge: m.badge,
      color: (m.color as { id: string }).id, // ThemeColor.id contains the color ID string
      label: m.label,
    }));

    const data: MarkerStorageData = {
      markerTypes,
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
   * Get the storage file URI (for "Open Configuration" command)
   */
  getStorageUri(): vscode.Uri | undefined {
    return this.storageUri;
  }

  /**
   * Get all configured marker types
   */
  getAllMarkerTypes(): MarkerType[] {
    return Array.from(this.markerTypes.values());
  }

  /**
   * Get a marker type by ID, returns fallback for unknown IDs
   */
  getMarkerType(id: string): MarkerType {
    return this.markerTypes.get(id) ?? FALLBACK_MARKER;
  }

  /**
   * Check if a marker type ID is known
   */
  isKnownMarkerType(id: string): boolean {
    return this.markerTypes.has(id);
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
   * Set markers for multiple URIs at once
   */
  setMarkers(uris: vscode.Uri[], markerId: string): void {
    for (const uri of uris) {
      const relativePath = this.getRelativePath(uri);
      if (relativePath) {
        this.markers.set(relativePath, markerId);
        this._onDidChangeMarkers.fire({ uri, markerId });
      }
    }
    this.scheduleSave();
  }

  /**
   * Remove markers from multiple URIs at once
   */
  removeMarkers(uris: vscode.Uri[]): void {
    let changed = false;
    for (const uri of uris) {
      const relativePath = this.getRelativePath(uri);
      if (relativePath && this.markers.delete(relativePath)) {
        changed = true;
        this._onDidChangeMarkers.fire({ uri, markerId: undefined });
      }
    }
    if (changed) {
      this.scheduleSave();
    }
  }

  /**
   * Remove all markers within a folder (and subfolders)
   */
  removeMarkersInFolder(folderUri: vscode.Uri): number {
    const folderPath = this.getRelativePath(folderUri);
    if (!folderPath) {
      return 0;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return 0;
    }

    const prefix = folderPath + '/';
    const toRemove: string[] = [];

    for (const relativePath of this.markers.keys()) {
      // Match exact folder or any path starting with folder/
      if (relativePath === folderPath || relativePath.startsWith(prefix)) {
        toRemove.push(relativePath);
      }
    }

    for (const relativePath of toRemove) {
      this.markers.delete(relativePath);
      const uri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
      this._onDidChangeMarkers.fire({ uri, markerId: undefined });
    }

    if (toRemove.length > 0) {
      this.scheduleSave();
    }

    return toRemove.length;
  }

  /**
   * Remove all markers in the workspace
   */
  removeAllMarkers(): number {
    const count = this.markers.size;
    if (count === 0) {
      return 0;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return 0;
    }

    // Fire events for all removed markers
    for (const relativePath of this.markers.keys()) {
      const uri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
      this._onDidChangeMarkers.fire({ uri, markerId: undefined });
    }

    this.markers.clear();
    this.scheduleSave();

    return count;
  }

  /**
   * Get total number of markers
   */
  getMarkerCount(): number {
    return this.markers.size;
  }

  /**
   * Get all marked URIs
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
