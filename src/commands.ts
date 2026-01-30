import * as vscode from 'vscode';
import { MarkerStorage } from './storage';
import { DEFAULT_MARKERS, getMarkerById } from './markers';

export function registerCommands(
  context: vscode.ExtensionContext,
  storage: MarkerStorage
): void {
  // Register individual "add marker" commands for each marker type
  for (const marker of DEFAULT_MARKERS) {
    const disposable = vscode.commands.registerCommand(
      `file-markers.addMarker.${marker.id}`,
      (uri: vscode.Uri) => {
        if (uri) {
          storage.setMarker(uri, marker.id);
        }
      }
    );
    context.subscriptions.push(disposable);
  }

  // Register "remove marker" command
  const removeDisposable = vscode.commands.registerCommand(
    'file-markers.removeMarker',
    (uri: vscode.Uri) => {
      if (uri) {
        storage.removeMarker(uri);
      }
    }
  );
  context.subscriptions.push(removeDisposable);

  // Register command to show current marker info (for testing/debugging)
  const infoDisposable = vscode.commands.registerCommand(
    'file-markers.showMarkerInfo',
    (uri: vscode.Uri) => {
      if (!uri) {
        return;
      }

      const markerId = storage.getMarker(uri);
      if (!markerId) {
        vscode.window.showInformationMessage('No marker on this file.');
        return;
      }

      const marker = getMarkerById(markerId);
      if (marker) {
        vscode.window.showInformationMessage(
          `Marker: ${marker.badge} ${marker.label}`
        );
      }
    }
  );
  context.subscriptions.push(infoDisposable);
}
