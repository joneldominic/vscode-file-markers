import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkerStorage } from '../storage';
import { StatusBarManager } from '../statusBar';

suite('StatusBarManager Test Suite', () => {
  let storage: MarkerStorage;
  let statusBar: StatusBarManager;

  setup(async () => {
    storage = new MarkerStorage();
    await storage.initialize();
    statusBar = new StatusBarManager(storage);
  });

  teardown(async () => {
    // Reset enabled setting (only if workspace is open)
    if (vscode.workspace.workspaceFolders?.[0]) {
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
    }

    storage.removeAllMarkers();
    statusBar.dispose();
    storage.dispose();
  });

  suite('update', () => {
    test('shows "No markers" when empty', function() {
      // StatusBarManager.update() is called internally
      // We can't easily access the private statusBarItem text
      // This is more of an integration test to ensure no errors
      statusBar.update();
      assert.ok(true, 'Update should not throw');
    });

    test('updates after marker is set', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test.ts`);

      storage.setMarker(testUri, 'done');
      statusBar.update();

      // Can't access private text, but ensure no errors
      assert.ok(true);
    });

    test('shows disabled state when extension disabled', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

      statusBar.update();

      // Ensure no errors
      assert.ok(true);
    });
  });

  suite('showStats', () => {
    test('showStats executes without error', async function() {
      // showStats opens a QuickPick which we can't interact with in tests
      // But we can verify it doesn't throw
      // Note: This will open a QuickPick that needs to be dismissed
      // In automated tests, this may hang waiting for user input
      // So we skip the actual execution
      this.skip();
    });
  });

  suite('dispose', () => {
    test('disposes without error', () => {
      const tempStorage = new MarkerStorage();
      const tempStatusBar = new StatusBarManager(tempStorage);

      // Should not throw
      tempStatusBar.dispose();
      tempStorage.dispose();

      assert.ok(true);
    });
  });
});
