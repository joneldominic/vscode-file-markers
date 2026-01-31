import * as vscode from 'vscode';
import { MarkerStorage, FALLBACK_MARKER } from './storage';

export class MarkerDecorationProvider
  implements vscode.FileDecorationProvider, vscode.Disposable
{
  private disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeFileDecorations =
    new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(private readonly storage: MarkerStorage) {
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

    const marker = this.storage.getMarkerType(markerId);
    const isUnknown = marker.id === FALLBACK_MARKER.id;

    return {
      badge: marker.badge,
      color: isUnknown ? undefined : marker.color,
      tooltip: isUnknown
        ? `Unknown marker type: "${markerId}"`
        : `File Marker: ${marker.label}`,
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
