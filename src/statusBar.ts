import * as vscode from 'vscode';
import { MarkerStorage } from './storage';

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly storage: MarkerStorage) {
    // Create status bar item with configured alignment
    this.statusBarItem = this.createStatusBarItem();

    // Update on marker changes
    this.disposables.push(
      storage.onDidChangeMarkers(() => {
        this.update();
      })
    );

    // Listen for configuration changes to recreate status bar if alignment changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('fileMarkers.statusBarAlignment')) {
          this.recreateStatusBarItem();
        }
      })
    );

    // Initial update
    this.update();
    this.statusBarItem.show();
  }

  private createStatusBarItem(): vscode.StatusBarItem {
    const config = vscode.workspace.getConfiguration('fileMarkers');
    const alignment = config.get<string>('statusBarAlignment', 'left');
    const vscodeAlignment = alignment === 'left'
      ? vscode.StatusBarAlignment.Left
      : vscode.StatusBarAlignment.Right;

    const item = vscode.window.createStatusBarItem(vscodeAlignment, 100);
    item.command = 'file-markers.showMarkerStats';
    item.tooltip = 'Click to view marker statistics';
    return item;
  }

  private recreateStatusBarItem(): void {
    this.statusBarItem.dispose();
    this.statusBarItem = this.createStatusBarItem();
    this.update();
    this.statusBarItem.show();
  }

  update(): void {
    const counts = this.storage.getMarkerCountsByType();
    const total = this.storage.getMarkerCount();

    if (total === 0) {
      this.statusBarItem.text = '$(bookmark) No markers';
      return;
    }

    // Build display text with badges for known marker types
    const parts: string[] = [];
    const markerTypes = this.storage.getAllMarkerTypes();

    for (const markerType of markerTypes) {
      const count = counts.get(markerType.id);
      if (count && count > 0) {
        parts.push(`${markerType.badge} ${count}`);
      }
    }

    // Handle any markers with unknown types
    let unknownCount = 0;
    for (const [markerId, count] of counts) {
      if (!markerTypes.some(m => m.id === markerId)) {
        unknownCount += count;
      }
    }
    if (unknownCount > 0) {
      parts.push(`? ${unknownCount}`);
    }

    this.statusBarItem.text = parts.length > 0 ? parts.join(' | ') : '$(bookmark) No markers';
  }

  async showStats(): Promise<void> {
    const counts = this.storage.getMarkerCountsByType();
    const total = this.storage.getMarkerCount();

    if (total === 0) {
      vscode.window.showInformationMessage('No markers in this workspace.');
      return;
    }

    const markerTypes = this.storage.getAllMarkerTypes();
    const items: vscode.QuickPickItem[] = [];

    // Add header
    items.push({
      label: `Total: ${total} marker${total === 1 ? '' : 's'}`,
      kind: vscode.QuickPickItemKind.Separator,
    });

    // Add each marker type with count
    for (const markerType of markerTypes) {
      const count = counts.get(markerType.id) ?? 0;
      items.push({
        label: `${markerType.badge} ${markerType.label}`,
        description: `${count} file${count === 1 ? '' : 's'}`,
      });
    }

    // Handle any markers with unknown types
    let unknownCount = 0;
    const unknownTypes: string[] = [];
    for (const [markerId, count] of counts) {
      if (!markerTypes.some(m => m.id === markerId)) {
        unknownCount += count;
        unknownTypes.push(markerId);
      }
    }
    if (unknownCount > 0) {
      items.push({
        label: `Unknown markers`,
        description: `${unknownCount} file${unknownCount === 1 ? '' : 's'} (${unknownTypes.join(', ')})`,
      });
    }

    await vscode.window.showQuickPick(items, {
      title: 'File Marker Statistics',
      placeHolder: 'Marker breakdown for this workspace',
    });
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
