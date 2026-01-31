import * as vscode from 'vscode';
import { MarkerStorage } from './storage';
import { DEFAULT_MARKER_TYPES } from './defaults';

export function registerCommands(
  context: vscode.ExtensionContext,
  storage: MarkerStorage
): void {
  // Add Marker command with QuickPick
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.addMarker',
      async (uri: vscode.Uri) => {
        if (!uri) {
          return;
        }

        const markerTypes = storage.getAllMarkerTypes();
        if (markerTypes.length === 0) {
          vscode.window.showWarningMessage(
            'No marker types configured. Open configuration to add marker types.'
          );
          return;
        }

        const currentMarkerId = storage.getMarker(uri);

        const items = markerTypes.map(m => ({
          label: `${m.badge} ${m.label}`,
          description: m.id === currentMarkerId ? '(current)' : undefined,
          markerId: m.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a marker to apply',
        });

        if (selected) {
          storage.setMarker(uri, selected.markerId);
        }
      }
    )
  );

  // Remove Marker command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.removeMarker',
      (uri: vscode.Uri) => {
        if (!uri) {
          return;
        }

        if (!storage.hasMarker(uri)) {
          // Silently do nothing if no marker
          return;
        }

        storage.removeMarker(uri);
      }
    )
  );

  // Open Configuration command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.openConfig',
      async () => {
        const storageUri = storage.getStorageUri();
        if (!storageUri) {
          vscode.window.showWarningMessage(
            'No workspace folder open. Open a folder first.'
          );
          return;
        }

        // Ensure file exists before opening
        try {
          await vscode.workspace.fs.stat(storageUri);
        } catch {
          // File doesn't exist, create it with defaults
          const initialData = {
            markerTypes: DEFAULT_MARKER_TYPES,
            markers: {},
          };
          const content = Buffer.from(JSON.stringify(initialData, null, 2), 'utf8');

          // Ensure .vscode directory exists
          const vscodeDir = vscode.Uri.joinPath(storageUri, '..');
          try {
            await vscode.workspace.fs.createDirectory(vscodeDir);
          } catch {
            // Directory may already exist
          }

          await vscode.workspace.fs.writeFile(storageUri, content);
        }

        const doc = await vscode.workspace.openTextDocument(storageUri);
        await vscode.window.showTextDocument(doc);
      }
    )
  );
}
