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
        if (event.affectsConfiguration('fileMarkers.enabled')) {
          this.update();
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
    const config = vscode.workspace.getConfiguration('fileMarkers');
    const isEnabled = config.get<boolean>('enabled', true);

    if (!isEnabled) {
      this.statusBarItem.text = '$(circle-slash) File Markers: Disabled';
      this.statusBarItem.tooltip = 'Click to enable or configure File Markers';
      return;
    }

    const counts = this.storage.getMarkerCountsByType();
    const total = this.storage.getMarkerCount();

    if (total === 0) {
      this.statusBarItem.text = '$(bookmark) No markers';
      this.statusBarItem.tooltip = 'Click to view marker statistics';
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
    const config = vscode.workspace.getConfiguration('fileMarkers');
    const isEnabled = config.get<boolean>('enabled', true);

    const items: vscode.QuickPickItem[] = [];

    // Add action items at the top
    items.push({
      label: isEnabled ? '$(circle-slash) Disable File Markers' : '$(check) Enable File Markers',
      description: isEnabled ? 'Hide all markers' : 'Show markers again',
      alwaysShow: true,
    });

    items.push({
      label: '$(gear) Open Configuration',
      description: 'Edit marker types and settings',
      alwaysShow: true,
    });

    // Add separator before stats (only if enabled and has markers)
    if (isEnabled) {
      const counts = this.storage.getMarkerCountsByType();
      const total = this.storage.getMarkerCount();

      if (total > 0) {
        items.push({
          label: '',
          kind: vscode.QuickPickItemKind.Separator,
        });

        items.push({
          label: `Total: ${total} marker${total === 1 ? '' : 's'}`,
          kind: vscode.QuickPickItemKind.Separator,
        });

        // Add each marker type with count
        const markerTypes = this.storage.getAllMarkerTypes();
        for (const markerType of markerTypes) {
          const count = counts.get(markerType.id) ?? 0;
          if (count > 0) {
            items.push({
              label: `${markerType.badge} ${markerType.label}`,
              description: `${count} file${count === 1 ? '' : 's'}`,
            });
          }
        }

        // Handle unknown markers
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
            label: '$(warning) Unknown markers',
            description: `${unknownCount} file${unknownCount === 1 ? '' : 's'} (${unknownTypes.join(', ')})`,
          });
        }
      }
    }

    const selected = await vscode.window.showQuickPick(items, {
      title: 'File Markers',
      placeHolder: isEnabled ? 'Marker statistics and options' : 'File Markers is disabled',
    });

    // Handle selection
    if (selected) {
      if (selected.label.includes('Disable File Markers') || selected.label.includes('Enable File Markers')) {
        await vscode.commands.executeCommand('file-markers.toggleEnabled');
      } else if (selected.label.includes('Open Configuration')) {
        await vscode.commands.executeCommand('file-markers.openConfig');
      }
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
