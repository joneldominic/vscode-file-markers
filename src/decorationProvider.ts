import * as vscode from 'vscode';
import { MarkerStorage, FALLBACK_MARKER } from './storage';

/**
 * Color for inherited markers (grayed out)
 */
const INHERITED_MARKER_COLOR = new vscode.ThemeColor('disabledForeground');

export class MarkerDecorationProvider
  implements vscode.FileDecorationProvider, vscode.Disposable
{
  private disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeFileDecorations =
    new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(private readonly storage: MarkerStorage) {
    this.disposables.push(
      storage.onDidChangeMarkers(() => {
        // When inheritance is enabled, any marker change could affect children
        // so we refresh all decorations. When disabled, we could optimize
        // but refreshing all is simpler and still fast enough.
        this.refresh();
      })
    );

    // Listen for configuration changes to refresh all decorations
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('fileMarkers.inheritFolderMarkers')) {
          this.refresh();
        }
      })
    );
  }

  provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const effective = this.storage.getEffectiveMarker(uri);
    if (!effective) {
      return undefined;
    }

    const { markerId, inherited } = effective;
    const marker = this.storage.getMarkerType(markerId);
    const isUnknown = marker.id === FALLBACK_MARKER.id;

    // Use grayed color for inherited markers, normal color for direct markers
    let color: vscode.ThemeColor | undefined;
    if (isUnknown) {
      color = undefined;
    } else if (inherited) {
      color = INHERITED_MARKER_COLOR;
    } else {
      color = marker.color;
    }

    // Build tooltip
    let tooltip: string;
    if (isUnknown) {
      tooltip = `Unknown marker type: "${markerId}"`;
    } else if (inherited) {
      tooltip = `File Marker: ${marker.label} (inherited from folder)`;
    } else {
      tooltip = `File Marker: ${marker.label}`;
    }

    return {
      badge: marker.badge,
      color,
      tooltip,
      propagate: false,
    };
  }

  refresh(): void {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
