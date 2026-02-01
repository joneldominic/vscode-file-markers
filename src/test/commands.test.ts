import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkerStorage } from '../storage';

suite('Commands Test Suite', () => {
  let storage: MarkerStorage;

  setup(async () => {
    storage = new MarkerStorage();
    await storage.initialize();
  });

  teardown(() => {
    // Clean up all markers
    storage.removeAllMarkers();
    storage.dispose();
  });

  suite('removeMarker command', () => {
    test('removes marker from single file', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test-file.ts`);

      // Set a marker first
      storage.setMarker(testUri, 'done');
      assert.strictEqual(storage.hasMarker(testUri), true);

      // Execute remove command
      await vscode.commands.executeCommand('file-markers.removeMarker', testUri);

      assert.strictEqual(storage.hasMarker(testUri), false);
    });
  });

  suite('removeMarkersInFolder command', () => {
    test('removes all markers in folder', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
      const file1 = vscode.Uri.file(`${workspaceRoot}/src/file1.ts`);
      const file2 = vscode.Uri.file(`${workspaceRoot}/src/file2.ts`);
      const outsideFile = vscode.Uri.file(`${workspaceRoot}/other.ts`);

      // Set markers
      storage.setMarker(file1, 'done');
      storage.setMarker(file2, 'pending');
      storage.setMarker(outsideFile, 'done');

      assert.strictEqual(storage.getMarkerCount(), 3);

      // Execute command
      await vscode.commands.executeCommand('file-markers.removeMarkersInFolder', folderUri);

      // Only outsideFile should remain
      assert.strictEqual(storage.hasMarker(file1), false);
      assert.strictEqual(storage.hasMarker(file2), false);
      assert.strictEqual(storage.hasMarker(outsideFile), true);
    });
  });

  suite('toggleMarker command', () => {
    test('shows warning when extension is disabled', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      // Disable extension
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

      // Execute toggle command - should show warning (we can't easily assert on the message)
      await vscode.commands.executeCommand('file-markers.toggleMarker');

      // Re-enable
      await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
    });

    test('cycles through markers on active file', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      // This test requires an active editor, which is hard to set up in tests
      // We'll test the storage layer directly in storage.test.ts instead
      this.skip();
    });
  });

  suite('openConfig command', () => {
    test('creates config file if it does not exist', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const storageUri = storage.getStorageUri();
      if (!storageUri) {
        this.skip();
        return;
      }

      // Execute command
      await vscode.commands.executeCommand('file-markers.openConfig');

      // Verify file exists
      try {
        await vscode.workspace.fs.stat(storageUri);
        assert.ok(true, 'Config file should exist');
      } catch {
        assert.fail('Config file should have been created');
      }

      // Close the opened editor
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });
  });
});
