import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkerStorage, FALLBACK_MARKER } from '../storage';
import { MarkerDecorationProvider } from '../decorationProvider';

suite('MarkerDecorationProvider Test Suite', () => {
  let storage: MarkerStorage;
  let provider: MarkerDecorationProvider;

  setup(async () => {
    storage = new MarkerStorage();
    await storage.initialize();
    provider = new MarkerDecorationProvider(storage);
  });

  teardown(async () => {
    // Reset enabled setting (only if workspace is open)
    if (vscode.workspace.workspaceFolders?.[0]) {
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
    }

    provider.dispose();
    storage.dispose();
  });

  suite('provideFileDecoration', () => {
    test('returns undefined for unmarked file', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/unmarked.ts`);
      const token = new vscode.CancellationTokenSource().token;

      const decoration = provider.provideFileDecoration(testUri, token);

      assert.strictEqual(decoration, undefined);
    });

    test('returns decoration for marked file', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/marked.ts`);
      const token = new vscode.CancellationTokenSource().token;

      storage.setMarker(testUri, 'done');
      const decoration = provider.provideFileDecoration(testUri, token) as vscode.FileDecoration | undefined;

      assert.ok(decoration);
      assert.strictEqual(decoration.badge, '✓');
      assert.ok(decoration.tooltip?.includes('Done'));
      assert.strictEqual(decoration.propagate, false);

      // Cleanup
      storage.removeMarker(testUri);
    });

    test('returns undefined when extension is disabled', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/marked.ts`);
      const token = new vscode.CancellationTokenSource().token;

      storage.setMarker(testUri, 'done');

      // Disable extension
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

      const decoration = provider.provideFileDecoration(testUri, token);

      assert.strictEqual(decoration, undefined);

      // Cleanup
      storage.removeMarker(testUri);
    });

    test('returns fallback badge for unknown marker type', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/unknown-marker.ts`);
      const token = new vscode.CancellationTokenSource().token;

      // Directly set an unknown marker ID (simulating orphaned marker)
      storage.setMarker(testUri, 'non-existent-type');
      const decoration = provider.provideFileDecoration(testUri, token) as vscode.FileDecoration | undefined;

      assert.ok(decoration);
      assert.strictEqual(decoration.badge, FALLBACK_MARKER.badge); // '⚠'
      assert.ok(decoration.tooltip?.includes('Unknown marker type'));

      // Cleanup
      storage.removeMarker(testUri);
    });

    test('inherited marker has different tooltip', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
      const fileUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);
      const token = new vscode.CancellationTokenSource().token;

      storage.setMarker(folderUri, 'done');

      // Enable inheritance
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('inheritFolderMarkers', true, vscode.ConfigurationTarget.Workspace);

      const decoration = provider.provideFileDecoration(fileUri, token) as vscode.FileDecoration | undefined;

      assert.ok(decoration);
      assert.strictEqual(decoration.badge, '✓');
      assert.ok(decoration.tooltip?.includes('inherited'));

      // Cleanup
      await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);
      storage.removeMarker(folderUri);
    });
  });

  suite('refresh', () => {
    test('fires onDidChangeFileDecorations event', function(done) {
      const disposable = provider.onDidChangeFileDecorations(() => {
        disposable.dispose();
        done();
      });

      provider.refresh();
    });
  });
});
