import * as vscode from 'vscode';
import { MarkerStorage } from './storage';
import { getMarkerById } from './markers';

export class MarkerDecorationProvider
  implements vscode.FileDecorationProvider, vscode.Disposable
{
  private disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeFileDecorations =
    new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(private readonly storage: MarkerStorage) {
    // Listen for marker changes and refresh decorations
    this.disposables.push(
      storage.onDidChangeMarkers(event => {
        this._onDidChangeFileDecorations.fire(event.uri);
      })
    );
  }

  provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const markerId = this.storage.getMarker(uri);
    if (!markerId) {
      return undefined;
    }

    const marker = getMarkerById(markerId);
    if (!marker) {
      return undefined;
    }

    return {
      badge: marker.badge,
      color: marker.color,
      tooltip: `File Marker: ${marker.label}`,
      propagate: false,
    };
  }

  /**
   * Refresh all decorations (e.g., after loading from storage)
   */
  refresh(): void {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
