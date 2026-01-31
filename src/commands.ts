import * as vscode from 'vscode';
import { MarkerStorage } from './storage';
import { DEFAULT_MARKER_TYPES } from './defaults';

export function registerCommands(
  context: vscode.ExtensionContext,
  storage: MarkerStorage
): void {
  // Set Marker command with QuickPick (supports multi-select)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.setMarker',
      async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
        // When multi-selecting in Explorer, VSCode passes clicked item as uri
        // and all selected items as uris array
        const targets = uris && uris.length > 0 ? uris : uri ? [uri] : [];

        if (targets.length === 0) {
          return;
        }

        const markerTypes = storage.getAllMarkerTypes();
        if (markerTypes.length === 0) {
          vscode.window.showWarningMessage(
            'No marker types configured. Open configuration to add marker types.'
          );
          return;
        }

        // For single file, show current marker
        const currentMarkerId = targets.length === 1
          ? storage.getMarker(targets[0])
          : undefined;

        const items = markerTypes.map(m => ({
          label: `${m.badge} ${m.label}`,
          description: m.id === currentMarkerId ? '(current)' : undefined,
          markerId: m.id,
        }));

        const placeHolder = targets.length === 1
          ? 'Select a marker to apply'
          : `Select a marker to apply to ${targets.length} items`;

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder,
        });

        if (selected) {
          storage.setMarkers(targets, selected.markerId);
        }
      }
    )
  );

  // Remove Marker command (supports multi-select)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.removeMarker',
      (uri: vscode.Uri, uris?: vscode.Uri[]) => {
        const targets = uris && uris.length > 0 ? uris : uri ? [uri] : [];

        if (targets.length === 0) {
          return;
        }

        storage.removeMarkers(targets);
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

  // Remove Markers in Folder command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.removeMarkersInFolder',
      async (uri: vscode.Uri) => {
        if (!uri) {
          return;
        }

        const count = storage.removeMarkersInFolder(uri);
        if (count > 0) {
          vscode.window.showInformationMessage(
            `Removed ${count} marker${count === 1 ? '' : 's'} from folder.`
          );
        } else {
          vscode.window.showInformationMessage('No markers found in folder.');
        }
      }
    )
  );

  // Remove All Markers command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.removeAllMarkers',
      async () => {
        const markerCount = storage.getMarkerCount();
        if (markerCount === 0) {
          vscode.window.showInformationMessage('No markers to remove.');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Remove all ${markerCount} marker${markerCount === 1 ? '' : 's'} from this workspace?`,
          { modal: true },
          'Remove All'
        );

        if (confirm === 'Remove All') {
          const removed = storage.removeAllMarkers();
          vscode.window.showInformationMessage(
            `Removed ${removed} marker${removed === 1 ? '' : 's'}.`
          );
        }
      }
    )
  );

  // Toggle Marker command (keyboard shortcut)
  // Cycles: no marker → done → in-progress → pending → no marker
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.toggleMarker',
      () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active file to toggle marker.');
          return;
        }

        const uri = editor.document.uri;
        const currentMarkerId = storage.getMarker(uri);

        // Define cycle order (uses first 3 default marker IDs)
        const cycleOrder = ['done', 'in-progress', 'pending'];

        if (!currentMarkerId) {
          // No marker → apply first in cycle
          storage.setMarker(uri, cycleOrder[0]);
        } else {
          const currentIndex = cycleOrder.indexOf(currentMarkerId);
          if (currentIndex === -1) {
            // Current marker not in cycle → remove it
            storage.removeMarker(uri);
          } else if (currentIndex === cycleOrder.length - 1) {
            // Last in cycle → remove marker
            storage.removeMarker(uri);
          } else {
            // Move to next in cycle
            storage.setMarker(uri, cycleOrder[currentIndex + 1]);
          }
        }
      }
    )
  );
}
