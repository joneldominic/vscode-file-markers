import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkerStorage } from '../storage';

suite('Commands Test Suite', () => {
  let storage: MarkerStorage;

  // Helper to clean up config file for test isolation
  async function cleanupConfigFile(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const configFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-markers.json');
      try {
        await vscode.workspace.fs.delete(configFile);
      } catch {
        // File may not exist, ignore
      }
    }
  }

  setup(async () => {
    // Clean up any leftover config from previous tests
    await cleanupConfigFile();
    storage = new MarkerStorage();
    await storage.initialize();
  });

  teardown(async () => {
    // Clean up all markers
    storage.removeAllMarkers();
    storage.dispose();
    // Clean up config file
    await cleanupConfigFile();
  });

  // Helper to read markers from config file
  async function getMarkersFromConfig(): Promise<Record<string, string>> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return {};
    }
    const configFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-markers.json');
    try {
      const content = await vscode.workspace.fs.readFile(configFile);
      const data = JSON.parse(Buffer.from(content).toString('utf8'));
      return data.markers || {};
    } catch {
      return {};
    }
  }

  // Helper to save config file through editor (triggers extension reload)
  async function saveConfigFileThroughEditor(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }
    const configFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-markers.json');
    try {
      const doc = await vscode.workspace.openTextDocument(configFile);
      await doc.save();
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      // Wait for extension to reload
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch {
      // Ignore errors
    }
  }

  suite('removeMarker command', () => {
    test('removes marker from single file', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders[0];
      const testUri = vscode.Uri.joinPath(workspaceFolder.uri, 'test-file.ts');

      // Set a marker first using the test storage (writes to config file)
      storage.setMarker(testUri, 'done');
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for save

      // Trigger extension to reload config by saving through editor
      await saveConfigFileThroughEditor();

      // Verify marker was set in config file
      let markers = await getMarkersFromConfig();
      assert.strictEqual(markers['test-file.ts'], 'done', 'Marker should be set');

      // Execute remove command (operates on extension's storage)
      await vscode.commands.executeCommand('file-markers.removeMarker', testUri);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for save

      // Verify marker was removed from config file
      markers = await getMarkersFromConfig();
      assert.strictEqual(markers['test-file.ts'], undefined, 'Marker should be removed');
    });
  });

  suite('removeMarkersInFolder command', () => {
    test('removes all markers in folder', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders[0];
      const folderUri = vscode.Uri.joinPath(workspaceFolder.uri, 'src');
      const file1 = vscode.Uri.joinPath(workspaceFolder.uri, 'src/file1.ts');
      const file2 = vscode.Uri.joinPath(workspaceFolder.uri, 'src/file2.ts');
      const outsideFile = vscode.Uri.joinPath(workspaceFolder.uri, 'other.ts');

      // Set markers using test storage
      storage.setMarker(file1, 'done');
      storage.setMarker(file2, 'pending');
      storage.setMarker(outsideFile, 'done');
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for save

      // Trigger extension to reload config by saving through editor
      await saveConfigFileThroughEditor();

      // Verify markers were set
      let markers = await getMarkersFromConfig();
      assert.strictEqual(Object.keys(markers).length, 3, 'Should have 3 markers');

      // Execute command (operates on extension's storage)
      await vscode.commands.executeCommand('file-markers.removeMarkersInFolder', folderUri);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for save

      // Verify only outsideFile marker remains
      markers = await getMarkersFromConfig();
      assert.strictEqual(markers['src/file1.ts'], undefined, 'file1 marker should be removed');
      assert.strictEqual(markers['src/file2.ts'], undefined, 'file2 marker should be removed');
      assert.strictEqual(markers['other.ts'], 'done', 'outside file marker should remain');
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


    test('cycles through all configured marker types', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders[0];
      const testFile = vscode.Uri.joinPath(workspaceFolder.uri, 'toggle-all-markers-test.txt');
      const configFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-markers.json');

      // Helper to read marker from config file
      const getMarkerFromConfig = async (filePath: string): Promise<string | undefined> => {
        try {
          const content = await vscode.workspace.fs.readFile(configFile);
          const data = JSON.parse(Buffer.from(content).toString('utf8'));
          return data.markers?.[filePath];
        } catch {
          return undefined;
        }
      };

      // Helper to get marker types from config file
      const getMarkerTypesFromConfig = async (): Promise<string[]> => {
        try {
          const content = await vscode.workspace.fs.readFile(configFile);
          const data = JSON.parse(Buffer.from(content).toString('utf8'));
          return (data.markerTypes || []).map((m: { id: string }) => m.id);
        } catch {
          return [];
        }
      };

      // Create test file
      await vscode.workspace.fs.writeFile(testFile, Buffer.from('test content'));

      try {
        // Ensure config file exists with default marker types
        await vscode.commands.executeCommand('file-markers.openConfig');
        // Save the config file to trigger extension reload
        await vscode.commands.executeCommand('workbench.action.files.save');
        await new Promise(resolve => setTimeout(resolve, 500));
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        // Open the test file to make it the active editor
        const doc = await vscode.workspace.openTextDocument(testFile);
        await vscode.window.showTextDocument(doc);

        // First toggle to set first marker
        await vscode.commands.executeCommand('file-markers.toggleMarker');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get actual marker types from config (may have been modified by previous tests)
        const markerTypes = await getMarkerTypesFromConfig();
        assert.ok(markerTypes.length >= 6, `Should have at least 6 marker types, got ${markerTypes.length}`);

        // Verify first marker was set
        const firstMarker = await getMarkerFromConfig('toggle-all-markers-test.txt');
        assert.strictEqual(firstMarker, markerTypes[0], `First marker should be "${markerTypes[0]}"`);

        // Toggle through remaining markers
        for (let i = 1; i < markerTypes.length; i++) {
          await vscode.commands.executeCommand('file-markers.toggleMarker');
          await new Promise(resolve => setTimeout(resolve, 500));

          const currentMarker = await getMarkerFromConfig('toggle-all-markers-test.txt');
          assert.strictEqual(
            currentMarker,
            markerTypes[i],
            `After ${i + 1} toggles, marker should be "${markerTypes[i]}"`
          );
        }

        // One more toggle should remove the marker
        await vscode.commands.executeCommand('file-markers.toggleMarker');
        await new Promise(resolve => setTimeout(resolve, 500));

        const finalMarker = await getMarkerFromConfig('toggle-all-markers-test.txt');
        assert.strictEqual(finalMarker, undefined, 'After cycling through all markers, should have no marker');

      } finally {
        // Cleanup
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        try {
          await vscode.workspace.fs.delete(testFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    test('removes unknown marker type on toggle', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders[0];
      const testFile = vscode.Uri.joinPath(workspaceFolder.uri, 'unknown-marker-test.txt');
      const configFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-markers.json');

      // Create test file
      await vscode.workspace.fs.writeFile(testFile, Buffer.from('test content'));

      try {
        // Create config with an unknown marker type on the test file
        const configData = {
          markerTypes: [
            { id: 'done', badge: '✓', color: 'gitDecoration.addedResourceForeground', label: 'Done' },
            { id: 'in-progress', badge: '◐', color: 'gitDecoration.modifiedResourceForeground', label: 'In Progress' },
          ],
          markers: {
            'unknown-marker-test.txt': 'non-existent-marker-type'
          }
        };

        // Ensure .vscode directory exists
        const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
        try {
          await vscode.workspace.fs.createDirectory(vscodeDir);
        } catch {
          // May already exist
        }

        // Write config file
        await vscode.workspace.fs.writeFile(
          configFile,
          Buffer.from(JSON.stringify(configData, null, 2), 'utf8')
        );

        // Open and save config file through editor to trigger extension reload
        const configDoc = await vscode.workspace.openTextDocument(configFile);
        await vscode.window.showTextDocument(configDoc);
        await vscode.commands.executeCommand('workbench.action.files.save');
        await new Promise(resolve => setTimeout(resolve, 500));
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        // Verify marker was set in config file
        let content = await vscode.workspace.fs.readFile(configFile);
        let data = JSON.parse(Buffer.from(content).toString('utf8'));
        assert.strictEqual(data.markers['unknown-marker-test.txt'], 'non-existent-marker-type', 'Unknown marker should be set');

        // Open the test file
        const doc = await vscode.workspace.openTextDocument(testFile);
        await vscode.window.showTextDocument(doc);

        // Toggle should remove the unknown marker (since it's not in markerTypes)
        await vscode.commands.executeCommand('file-markers.toggleMarker');
        // Wait longer for debounced save to complete
        await new Promise(resolve => setTimeout(resolve, 800));

        // Verify marker was removed from config file
        content = await vscode.workspace.fs.readFile(configFile);
        data = JSON.parse(Buffer.from(content).toString('utf8'));
        assert.strictEqual(
          data.markers['unknown-marker-test.txt'],
          undefined,
          'Unknown marker type should be removed on toggle'
        );

      } finally {
        // Cleanup
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        try {
          await vscode.workspace.fs.delete(testFile);
        } catch {
          // Ignore cleanup errors
        }
      }
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
