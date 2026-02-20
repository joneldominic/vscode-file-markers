import * as vscode from 'vscode';
import { MarkerStorage } from './storage';
import { NoteStorage } from './noteStorage';
import { DEFAULT_MARKER_TYPES } from './defaults';

export function registerCommands(
  context: vscode.ExtensionContext,
  storage: MarkerStorage,
  noteStorage: NoteStorage
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
  // Cycles through all configured markers, then removes
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.toggleMarker',
      () => {
        // Check if extension is enabled
        const config = vscode.workspace.getConfiguration('fileMarkers');
        if (!config.get<boolean>('enabled', true)) {
          vscode.window.showWarningMessage(
            'File Markers is disabled. Enable it in settings or run "File Markers: Toggle Enable/Disable".'
          );
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active file to toggle marker.');
          return;
        }

        const uri = editor.document.uri;
        const currentMarkerId = storage.getMarker(uri);

        // Get all configured marker types for cycling
        const allMarkerTypes = storage.getAllMarkerTypes();
        const cycleOrder = allMarkerTypes.map(m => m.id);

        if (cycleOrder.length === 0) {
          vscode.window.showWarningMessage(
            'No marker types configured. Open configuration to add marker types.'
          );
          return;
        }

        if (!currentMarkerId) {
          // No marker → apply first in cycle
          storage.setMarker(uri, cycleOrder[0]);
        } else {
          const currentIndex = cycleOrder.indexOf(currentMarkerId);
          if (currentIndex === -1) {
            // Current marker not in cycle (unknown/removed type) → remove it
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

  // ============================================
  // Line Highlight Commands
  // ============================================

  // Set Line Highlight command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.setLineHighlight',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor.');
          return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
          vscode.window.showWarningMessage('Select some text first.');
          return;
        }

        const highlightTypes = storage.getAllLineHighlightTypes();
        if (highlightTypes.length === 0) {
          vscode.window.showWarningMessage(
            'No line highlight types configured.'
          );
          return;
        }

        // Show quick pick for highlight type selection
        const items = highlightTypes.map(type => ({
          label: type.label,
          description: type.id,
          typeId: type.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a highlight type',
        });

        if (selected) {
          // Use 1-indexed lines for storage
          const startLine = selection.start.line + 1;
          const endLine = selection.end.line + 1;

          storage.setLineHighlight(
            editor.document.uri,
            startLine,
            endLine,
            selected.typeId
          );
        }
      }
    )
  );

  // Remove Line Highlight command
  context.subscriptions.push(
    vscode.commands.registerCommand('file-markers.removeLineHighlight', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor.');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage(
          'Select the highlighted lines to remove.'
        );
        return;
      }

      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;

      // Find and remove highlight that matches this range
      const highlights = storage.getLineHighlights(editor.document.uri);
      const matching = highlights.find(
        h => h.startLine === startLine && h.endLine === endLine
      );

      if (matching) {
        storage.removeLineHighlight(editor.document.uri, startLine, endLine);
      } else {
        // Try to find any overlapping highlight
        const overlapping = highlights.find(
          h => !(h.endLine < startLine || h.startLine > endLine)
        );
        if (overlapping) {
          storage.removeLineHighlight(
            editor.document.uri,
            overlapping.startLine,
            overlapping.endLine
          );
        } else {
          vscode.window.showInformationMessage(
            'No highlight found in selected range.'
          );
        }
      }
    })
  );

  // Remove All Line Highlights in File command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.removeAllLineHighlightsInFile',
      () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor.');
          return;
        }

        const highlights = storage.getLineHighlights(editor.document.uri);
        if (highlights.length === 0) {
          vscode.window.showInformationMessage(
            'No line highlights in this file.'
          );
          return;
        }

        storage.removeAllLineHighlightsInFile(editor.document.uri);
        vscode.window.showInformationMessage(
          `Removed ${highlights.length} line highlight${highlights.length === 1 ? '' : 's'}.`
        );
      }
    )
  );

  // Remove All Line Highlights command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.removeAllLineHighlights',
      async () => {
        const highlightCount = storage.getLineHighlightCount();
        if (highlightCount === 0) {
          vscode.window.showInformationMessage('No line highlights to remove.');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Remove all ${highlightCount} line highlight${highlightCount === 1 ? '' : 's'} from this workspace?`,
          { modal: true },
          'Remove All'
        );

        if (confirm === 'Remove All') {
          const removed = storage.removeAllLineHighlights();
          vscode.window.showInformationMessage(
            `Removed ${removed} line highlight${removed === 1 ? '' : 's'}.`
          );
        }
      }
    )
  );

  // Toggle Line Highlight command (keyboard shortcut - cycles through colors)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.toggleLineHighlight',
      () => {
        // Check if extension is enabled
        const config = vscode.workspace.getConfiguration('fileMarkers');
        if (!config.get<boolean>('enabled', true)) {
          vscode.window.showWarningMessage(
            'File Markers is disabled. Enable it in settings or run "File Markers: Toggle Enable/Disable".'
          );
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor.');
          return;
        }

        const selection = editor.selection;

        // Use 1-indexed lines for storage
        // If no selection, use the current cursor line
        const startLine = selection.start.line + 1;
        const endLine = selection.isEmpty
          ? startLine
          : selection.end.line + 1;

        const uri = editor.document.uri;
        const highlights = storage.getLineHighlights(uri);

        // Get all configured highlight types for cycling
        const allHighlightTypes = storage.getAllLineHighlightTypes();
        const cycleOrder = allHighlightTypes.map(t => t.id);

        if (cycleOrder.length === 0) {
          vscode.window.showWarningMessage(
            'No line highlight types configured.'
          );
          return;
        }

        // Find existing highlight that overlaps with selection
        const existingHighlight = highlights.find(
          h => !(h.endLine < startLine || h.startLine > endLine)
        );

        if (!existingHighlight) {
          // No highlight → apply first in cycle
          storage.setLineHighlight(uri, startLine, endLine, cycleOrder[0]);
        } else {
          const currentIndex = cycleOrder.indexOf(existingHighlight.typeId);
          if (currentIndex === -1) {
            // Current highlight type not in cycle (unknown/removed type) → remove it
            storage.removeLineHighlight(
              uri,
              existingHighlight.startLine,
              existingHighlight.endLine
            );
          } else if (currentIndex === cycleOrder.length - 1) {
            // Last in cycle → remove highlight
            storage.removeLineHighlight(
              uri,
              existingHighlight.startLine,
              existingHighlight.endLine
            );
          } else {
            // Move to next in cycle (update existing highlight range with new type)
            storage.removeLineHighlight(
              uri,
              existingHighlight.startLine,
              existingHighlight.endLine
            );
            storage.setLineHighlight(
              uri,
              startLine,
              endLine,
              cycleOrder[currentIndex + 1]
            );
          }
        }
      }
    )
  );

  // ============================================
  // Note Commands
  // ============================================

  // Note: setNote is registered inline in extension.ts because it needs notesViewProvider

  // Remove Note (single file only, with confirmation dialog)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.removeNote',
      async (uri: vscode.Uri) => {
        if (!uri) {
          return;
        }

        const fileName = vscode.workspace.asRelativePath(uri);
        const confirm = await vscode.window.showWarningMessage(
          `Remove note from "${fileName}"?`,
          { modal: true },
          'Remove'
        );
        if (confirm === 'Remove') {
          noteStorage.removeNote(uri);
        }
      }
    )
  );
}
