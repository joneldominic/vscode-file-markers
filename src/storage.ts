import * as vscode from 'vscode';
import * as path from 'path';
import {
  MarkerStorageData,
  MarkerChangeEvent,
  MarkerTypeConfig,
  MarkerType,
  LineHighlightTypeConfig,
  LineHighlightType,
  LineHighlight,
  MarkerStorageDataV2,
} from './types';
import { DEFAULT_MARKER_TYPES, DEFAULT_LINE_HIGHLIGHT_TYPES } from './defaults';

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
  private lineHighlightTypes: Map<string, LineHighlightType> = new Map();
  private lineHighlights: Map<string, LineHighlight[]> = new Map(); // relativePath -> highlights
  private storageUri: vscode.Uri | undefined;
  private disposables: vscode.Disposable[] = [];
  private writeDebounceTimer: NodeJS.Timeout | undefined;
  private configWatcher: vscode.FileSystemWatcher | undefined;
  private reloadDebounceTimer: NodeJS.Timeout | undefined;
  private lastSavedContent: string | undefined;

  private readonly _onDidChangeMarkers = new vscode.EventEmitter<MarkerChangeEvent>();
  readonly onDidChangeMarkers = this._onDidChangeMarkers.event;

  private readonly _onDidChangeLineHighlights = new vscode.EventEmitter<{
    uri: vscode.Uri;
  }>();
  readonly onDidChangeLineHighlights = this._onDidChangeLineHighlights.event;

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

    // Dispose old watcher if exists
    this.configWatcher?.dispose();

    // Create file system watcher for config file
    this.configWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolder, '.vscode/file-markers.json')
    );

    this.disposables.push(this.configWatcher);

    // Reload when file is changed externally
    this.configWatcher.onDidChange(() => this.scheduleReload());
    this.configWatcher.onDidCreate(() => this.scheduleReload());
    this.configWatcher.onDidDelete(() => this.scheduleReload());

    // Also listen for when the config file is saved within VSCode (more reliable than file watcher)
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.storageUri && doc.uri.fsPath === this.storageUri.fsPath) {
          this.scheduleReload();
        }
      })
    );

    await this.load();
  }

  /**
   * Load markers from storage. Returns true if data changed, false otherwise.
   */
  private async load(): Promise<boolean> {
    if (!this.storageUri) {
      return false;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this.storageUri);
      const contentStr = Buffer.from(content).toString('utf8');

      // Skip reload if this is the content we just saved
      if (this.lastSavedContent && contentStr === this.lastSavedContent) {
        return false;
      }
      const data = JSON.parse(contentStr);
      this.loadMarkerTypes(data.markerTypes || DEFAULT_MARKER_TYPES);
      this.markers = new Map(Object.entries(data.markers || {}));
      // Load line highlight types and highlights
      this.loadLineHighlightTypes(
        data.lineHighlightTypes || DEFAULT_LINE_HIGHLIGHT_TYPES
      );
      this.lineHighlights = new Map(
        Object.entries(data.lineHighlights || {}).map(([path, highlights]) => [
          path,
          highlights as LineHighlight[],
        ])
      );
      // Clear saved content since we've now loaded external changes
      this.lastSavedContent = undefined;
      return true;
    } catch {
      // File doesn't exist or is invalid - use defaults
      const hadData =
        this.markers.size > 0 ||
        this.markerTypes.size > 0 ||
        this.lineHighlights.size > 0;
      this.loadMarkerTypes(DEFAULT_MARKER_TYPES);
      this.loadLineHighlightTypes(DEFAULT_LINE_HIGHLIGHT_TYPES);
      this.markers.clear();
      this.lineHighlights.clear();
      this.lastSavedContent = undefined;
      return hadData;
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

  private loadLineHighlightTypes(configs: LineHighlightTypeConfig[]): void {
    this.lineHighlightTypes.clear();
    for (const config of configs) {
      if (this.isValidLineHighlightTypeConfig(config)) {
        this.lineHighlightTypes.set(config.id, {
          id: config.id,
          color: config.color,
          label: config.label,
        });
      }
    }
  }

  private isValidLineHighlightTypeConfig(
    config: unknown
  ): config is LineHighlightTypeConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }
    const c = config as Record<string, unknown>;
    return (
      typeof c.id === 'string' &&
      c.id.length > 0 &&
      typeof c.color === 'string' &&
      c.color.length > 0 &&
      typeof c.label === 'string' &&
      c.label.length > 0
    );
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
    const markerTypes: MarkerTypeConfig[] = Array.from(
      this.markerTypes.values()
    ).map(m => ({
      id: m.id,
      badge: m.badge,
      color: (m.color as { id: string }).id, // ThemeColor.id contains the color ID string
      label: m.label,
    }));

    // Convert line highlight types back to config format
    const lineHighlightTypes: LineHighlightTypeConfig[] = Array.from(
      this.lineHighlightTypes.values()
    );

    const data: MarkerStorageDataV2 = {
      markerTypes,
      markers: Object.fromEntries(this.markers),
      lineHighlightTypes,
      lineHighlights: Object.fromEntries(this.lineHighlights),
    };

    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8');

    // Ensure .vscode directory exists
    const vscodeDir = vscode.Uri.joinPath(this.storageUri, '..');
    try {
      await vscode.workspace.fs.createDirectory(vscodeDir);
    } catch {
      // Directory may already exist
    }

    // Record what we're saving so we can skip reloads that match our own writes
    this.lastSavedContent = content.toString();
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
   * Schedule a reload of the config file (debounced to avoid conflicts with our own writes)
   */
  private scheduleReload(): void {
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }
    this.reloadDebounceTimer = setTimeout(() => {
      this.load().then((changed) => {
        if (changed) {
          // Notify that markers may have changed (types may have changed too)
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            this._onDidChangeMarkers.fire({ uri: workspaceFolder.uri, markerId: undefined });
          }
        }
      }).catch(err => {
        console.error('Failed to reload markers:', err);
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

    // Clear markers
    this.markers.clear();
    this.scheduleSave();

    // Fire a single event to trigger refresh (uri is workspace root to signal "all changed")
    this._onDidChangeMarkers.fire({ uri: workspaceFolder.uri, markerId: undefined });

    return count;
  }

  /**
   * Get total number of markers
   */
  getMarkerCount(): number {
    return this.markers.size;
  }

  /**
   * Get the effective marker for a URI, checking parent folders if no direct marker
   * Returns both the marker ID and whether it's inherited
   */
  getEffectiveMarker(uri: vscode.Uri): { markerId: string; inherited: boolean } | undefined {
    // First check for direct marker
    const directMarker = this.getMarker(uri);
    if (directMarker) {
      return { markerId: directMarker, inherited: false };
    }

    // Check if inheritance is enabled
    const config = vscode.workspace.getConfiguration('fileMarkers');
    if (!config.get<boolean>('inheritFolderMarkers', false)) {
      return undefined;
    }

    // Walk up parent paths to find a folder marker
    const relativePath = this.getRelativePath(uri);
    if (!relativePath) {
      return undefined;
    }

    const parts = relativePath.split('/');
    // Start from immediate parent, walk up to root
    for (let i = parts.length - 1; i >= 1; i--) {
      const parentPath = parts.slice(0, i).join('/');
      const parentMarker = this.markers.get(parentPath);
      if (parentMarker) {
        return { markerId: parentMarker, inherited: true };
      }
    }

    return undefined;
  }

  /**
   * Get marker counts grouped by marker type ID
   */
  getMarkerCountsByType(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const markerId of this.markers.values()) {
      counts.set(markerId, (counts.get(markerId) ?? 0) + 1);
    }
    return counts;
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

  // ============================================
  // Line Highlight Type Methods
  // ============================================

  /**
   * Get all configured line highlight types
   */
  getAllLineHighlightTypes(): LineHighlightType[] {
    return Array.from(this.lineHighlightTypes.values());
  }

  /**
   * Get a line highlight type by ID
   */
  getLineHighlightType(id: string): LineHighlightType | undefined {
    return this.lineHighlightTypes.get(id);
  }

  // ============================================
  // Line Highlight Methods
  // ============================================

  /**
   * Get line highlights for a file
   */
  getLineHighlights(uri: vscode.Uri): LineHighlight[] {
    const relativePath = this.getRelativePath(uri);
    if (!relativePath) {
      return [];
    }
    return this.lineHighlights.get(relativePath) ?? [];
  }

  /**
   * Set a line highlight for a range. Removes any overlapping highlights.
   */
  setLineHighlight(
    uri: vscode.Uri,
    startLine: number,
    endLine: number,
    typeId: string
  ): void {
    const relativePath = this.getRelativePath(uri);
    if (!relativePath) {
      return;
    }

    const highlights = this.lineHighlights.get(relativePath) ?? [];

    // Remove any overlapping highlights and add new one
    const filtered = highlights.filter(
      h => h.endLine < startLine || h.startLine > endLine
    );
    filtered.push({ startLine, endLine, typeId });

    // Sort by start line
    filtered.sort((a, b) => a.startLine - b.startLine);

    this.lineHighlights.set(relativePath, filtered);
    this.scheduleSave();
    this._onDidChangeLineHighlights.fire({ uri });
  }

  /**
   * Remove a specific line highlight
   */
  removeLineHighlight(
    uri: vscode.Uri,
    startLine: number,
    endLine: number
  ): void {
    const relativePath = this.getRelativePath(uri);
    if (!relativePath) {
      return;
    }

    const highlights = this.lineHighlights.get(relativePath);
    if (!highlights) {
      return;
    }

    const filtered = highlights.filter(
      h => !(h.startLine === startLine && h.endLine === endLine)
    );

    if (filtered.length === 0) {
      this.lineHighlights.delete(relativePath);
    } else {
      this.lineHighlights.set(relativePath, filtered);
    }

    this.scheduleSave();
    this._onDidChangeLineHighlights.fire({ uri });
  }

  /**
   * Remove all line highlights in a file
   */
  removeAllLineHighlightsInFile(uri: vscode.Uri): void {
    const relativePath = this.getRelativePath(uri);
    if (!relativePath) {
      return;
    }

    if (this.lineHighlights.delete(relativePath)) {
      this.scheduleSave();
      this._onDidChangeLineHighlights.fire({ uri });
    }
  }

  /**
   * Check if a file has any line highlights
   */
  hasLineHighlights(uri: vscode.Uri): boolean {
    const relativePath = this.getRelativePath(uri);
    if (!relativePath) {
      return false;
    }
    const highlights = this.lineHighlights.get(relativePath);
    return highlights !== undefined && highlights.length > 0;
  }

  /**
   * Get all files with line highlights
   */
  getAllFilesWithLineHighlights(): vscode.Uri[] {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    return Array.from(this.lineHighlights.keys())
      .filter(path => (this.lineHighlights.get(path)?.length ?? 0) > 0)
      .map(path => vscode.Uri.joinPath(workspaceFolder.uri, path));
  }

  /**
   * Get total number of line highlights across all files
   */
  getLineHighlightCount(): number {
    let count = 0;
    for (const highlights of this.lineHighlights.values()) {
      count += highlights.length;
    }
    return count;
  }

  /**
   * Remove all line highlights from all files in the workspace
   */
  removeAllLineHighlights(): number {
    const count = this.getLineHighlightCount();
    if (count === 0) {
      return 0;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return 0;
    }

    // Clear all line highlights
    this.lineHighlights.clear();
    this.scheduleSave();

    // Fire a single event to trigger refresh
    this._onDidChangeLineHighlights.fire({ uri: workspaceFolder.uri });

    return count;
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
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }
    this.configWatcher?.dispose();
    this._onDidChangeMarkers.dispose();
    this._onDidChangeLineHighlights.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
