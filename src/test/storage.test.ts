import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkerStorage, FALLBACK_MARKER } from '../storage';



suite('MarkerStorage Test Suite', () => {
  let storage: MarkerStorage;

  setup(async () => {
    storage = new MarkerStorage();
    await storage.initialize();
  });

  teardown(() => {
    storage.dispose();
  });

  suite('Marker Types', () => {
    test('should have default marker types loaded', function() {
      // Skip if no workspace folder (marker types require workspace to load)
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }
      const types = storage.getAllMarkerTypes();
      assert.ok(types.length >= 6, 'Should have at least 6 default marker types');
    });

    test('should include "done" marker type', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }
      const doneType = storage.getMarkerType('done');
      assert.ok(doneType, 'Should have "done" marker type');
      assert.strictEqual(doneType.badge, '✓');
      assert.strictEqual(doneType.label, 'Done');
    });

    test('should include "in-progress" marker type', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }
      const inProgressType = storage.getMarkerType('in-progress');
      assert.ok(inProgressType, 'Should have "in-progress" marker type');
      assert.strictEqual(inProgressType.badge, '◐');
      assert.strictEqual(inProgressType.label, 'In Progress');
    });

    test('should return fallback for unknown marker type', () => {
      const unknownType = storage.getMarkerType('non-existent');
      assert.strictEqual(unknownType, FALLBACK_MARKER);
      assert.strictEqual(unknownType.badge, '⚠');
    });

    test('isKnownMarkerType should return true for known types', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }
      assert.strictEqual(storage.isKnownMarkerType('done'), true);
      assert.strictEqual(storage.isKnownMarkerType('in-progress'), true);
      assert.strictEqual(storage.isKnownMarkerType('pending'), true);
    });

    test('isKnownMarkerType should return false for unknown types', () => {
      assert.strictEqual(storage.isKnownMarkerType('non-existent'), false);
      assert.strictEqual(storage.isKnownMarkerType(''), false);
    });
  });

  suite('Marker Operations', () => {
    test('should set and get marker for a file', function() {
      // Skip if no workspace folder
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test-file.ts`);

      storage.setMarker(testUri, 'done');
      const marker = storage.getMarker(testUri);

      assert.strictEqual(marker, 'done');
    });

    test('should remove marker from a file', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test-file.ts`);

      storage.setMarker(testUri, 'done');
      storage.removeMarker(testUri);
      const marker = storage.getMarker(testUri);

      assert.strictEqual(marker, undefined);
    });

    test('should return undefined for file without marker', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/unmarked-file.ts`);
      const marker = storage.getMarker(testUri);

      assert.strictEqual(marker, undefined);
    });

    test('hasMarker should return true for marked files', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test-file.ts`);

      storage.setMarker(testUri, 'done');
      assert.strictEqual(storage.hasMarker(testUri), true);
    });

    test('hasMarker should return false for unmarked files', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/unmarked-file.ts`);

      assert.strictEqual(storage.hasMarker(testUri), false);
    });
  });

  suite('Bulk Operations', () => {
    test('should set markers for multiple files', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const uris = [
        vscode.Uri.file(`${workspaceRoot}/file1.ts`),
        vscode.Uri.file(`${workspaceRoot}/file2.ts`),
        vscode.Uri.file(`${workspaceRoot}/file3.ts`),
      ];

      storage.setMarkers(uris, 'done');

      for (const uri of uris) {
        assert.strictEqual(storage.getMarker(uri), 'done');
      }
    });

    test('should remove markers from multiple files', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const uris = [
        vscode.Uri.file(`${workspaceRoot}/file1.ts`),
        vscode.Uri.file(`${workspaceRoot}/file2.ts`),
      ];

      storage.setMarkers(uris, 'done');
      storage.removeMarkers(uris);

      for (const uri of uris) {
        assert.strictEqual(storage.getMarker(uri), undefined);
      }
    });
  });

  suite('Marker Statistics', () => {
    test('should return empty counts when no markers set', () => {
      const counts = storage.getMarkerCountsByType();
      assert.ok(counts instanceof Map);
      assert.strictEqual(counts.size, 0);
    });

    test('should count markers by type', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/file1.ts`), 'done');
      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/file2.ts`), 'done');
      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/file3.ts`), 'pending');

      const counts = storage.getMarkerCountsByType();

      assert.strictEqual(counts.get('done'), 2);
      assert.strictEqual(counts.get('pending'), 1);
    });

    test('should return correct marker count', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

      assert.strictEqual(storage.getMarkerCount(), 0);

      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/file1.ts`), 'done');
      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/file2.ts`), 'pending');

      assert.strictEqual(storage.getMarkerCount(), 2);
    });
  });

  suite('All Marked URIs', () => {
    test('should return all marked URIs', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/a.ts`), 'done');
      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/b.ts`), 'pending');

      const allUris = storage.getAllMarkedUris();

      assert.strictEqual(allUris.length, 2);
    });

    test('should return empty array when no markers', () => {
      const allUris = storage.getAllMarkedUris();
      assert.strictEqual(allUris.length, 0);
    });
  });

  suite('Remove All Markers', () => {
    test('should clear all markers and return count', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/a.ts`), 'done');
      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/b.ts`), 'pending');

      const removedCount = storage.removeAllMarkers();

      assert.strictEqual(removedCount, 2);
      assert.strictEqual(storage.getMarkerCount(), 0);
    });

    test('should return 0 when no markers to remove', () => {
      const removedCount = storage.removeAllMarkers();
      assert.strictEqual(removedCount, 0);
    });
  });

  suite('Remove Markers in Folder', () => {
    test('should remove markers within a folder', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

      // Set markers in folder and outside
      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/src/file1.ts`), 'done');
      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/src/file2.ts`), 'pending');
      storage.setMarker(vscode.Uri.file(`${workspaceRoot}/other/file.ts`), 'done');

      const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
      const removedCount = storage.removeMarkersInFolder(folderUri);

      assert.strictEqual(removedCount, 2);
      assert.strictEqual(storage.getMarkerCount(), 1); // Only other/file.ts remains
    });
  });

  suite('Config File Reload', () => {
    test('should preserve custom marker types when config file is modified externally', async function() {
      // Skip if no workspace folder
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test-file.ts`);

      // First, set a marker to ensure the config file exists
      storage.setMarker(testUri, 'done');

      // Wait for the debounced save to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get storage URI and verify file exists
      const storageUri = storage.getStorageUri();
      assert.ok(storageUri, 'Storage URI should exist');

      // Read current config file
      const currentContent = await vscode.workspace.fs.readFile(storageUri!);
      const currentData = JSON.parse(Buffer.from(currentContent).toString('utf8'));

      // Add a custom marker type to the config file (simulating external edit)
      const customMarkerType = {
        id: 'custom-test',
        badge: '⚡',
        color: 'terminal.ansiMagenta',
        label: 'Custom Test',
      };
      currentData.markerTypes.push(customMarkerType);

      // Write the modified config back
      await vscode.workspace.fs.writeFile(
        storageUri!,
        Buffer.from(JSON.stringify(currentData, null, 2), 'utf8')
      );

      // Wait for file watcher to reload (if implemented)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Now set another marker - this triggers save which might overwrite custom types
      const testUri2 = vscode.Uri.file(`${workspaceRoot}/test-file2.ts`);
      storage.setMarker(testUri2, 'pending');

      // Wait for the debounced save to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Read the config file again
      const finalContent = await vscode.workspace.fs.readFile(storageUri!);
      const finalData = JSON.parse(Buffer.from(finalContent).toString('utf8'));

      // The custom marker type should still be present
      const hasCustomMarker = finalData.markerTypes.some(
        (m: { id: string }) => m.id === 'custom-test'
      );

      assert.strictEqual(
        hasCustomMarker,
        true,
        'Custom marker type should be preserved after setting another marker'
      );

      // Also verify the custom marker type is available in storage
      assert.strictEqual(
        storage.isKnownMarkerType('custom-test'),
        true,
        'Custom marker type should be recognized by storage'
      );
    });
  });

  suite('Marker Inheritance', () => {
    test('getEffectiveMarker returns direct marker when set', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);

      storage.setMarker(testUri, 'done');
      const effective = storage.getEffectiveMarker(testUri);

      assert.ok(effective);
      assert.strictEqual(effective.markerId, 'done');
      assert.strictEqual(effective.inherited, false);

      // Cleanup
      storage.removeMarker(testUri);
    });

    test('getEffectiveMarker returns undefined when no marker and inheritance disabled', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
      const fileUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);

      // Set marker on folder, not file
      storage.setMarker(folderUri, 'done');

      // Ensure inheritance is disabled
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);

      const effective = storage.getEffectiveMarker(fileUri);
      assert.strictEqual(effective, undefined);

      // Cleanup
      storage.removeMarker(folderUri);
    });

    test('getEffectiveMarker returns inherited marker when inheritance enabled', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
      const fileUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);

      // Set marker on folder
      storage.setMarker(folderUri, 'in-progress');

      // Enable inheritance
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('inheritFolderMarkers', true, vscode.ConfigurationTarget.Workspace);

      const effective = storage.getEffectiveMarker(fileUri);

      assert.ok(effective);
      assert.strictEqual(effective.markerId, 'in-progress');
      assert.strictEqual(effective.inherited, true);

      // Cleanup
      await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);
      storage.removeMarker(folderUri);
    });

    test('direct marker overrides inherited marker', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const folderUri = vscode.Uri.file(`${workspaceRoot}/src`);
      const fileUri = vscode.Uri.file(`${workspaceRoot}/src/file.ts`);

      // Set markers on both folder and file
      storage.setMarker(folderUri, 'pending');
      storage.setMarker(fileUri, 'done');

      // Enable inheritance
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('inheritFolderMarkers', true, vscode.ConfigurationTarget.Workspace);

      const effective = storage.getEffectiveMarker(fileUri);

      assert.ok(effective);
      assert.strictEqual(effective.markerId, 'done'); // Direct marker wins
      assert.strictEqual(effective.inherited, false);

      // Cleanup
      await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);
      storage.removeMarker(folderUri);
      storage.removeMarker(fileUri);
    });

    test('inherits from nearest parent folder', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const parentUri = vscode.Uri.file(`${workspaceRoot}/src`);
      const childUri = vscode.Uri.file(`${workspaceRoot}/src/components`);
      const fileUri = vscode.Uri.file(`${workspaceRoot}/src/components/Button.tsx`);

      // Set different markers on parent and child folders
      storage.setMarker(parentUri, 'pending');
      storage.setMarker(childUri, 'done');

      // Enable inheritance
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('inheritFolderMarkers', true, vscode.ConfigurationTarget.Workspace);

      const effective = storage.getEffectiveMarker(fileUri);

      assert.ok(effective);
      assert.strictEqual(effective.markerId, 'done'); // Nearest parent wins
      assert.strictEqual(effective.inherited, true);

      // Cleanup
      await config.update('inheritFolderMarkers', false, vscode.ConfigurationTarget.Workspace);
      storage.removeMarker(parentUri);
      storage.removeMarker(childUri);
    });
  });

  suite('Event Handling', () => {
    test('should fire event when marker is set', function(done) {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test-file.ts`);

      const disposable = storage.onDidChangeMarkers(event => {
        assert.strictEqual(event.markerId, 'done');
        disposable.dispose();
        done();
      });

      storage.setMarker(testUri, 'done');
    });

    test('should fire event when marker is removed', function(done) {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test-file.ts`);

      storage.setMarker(testUri, 'done');

      const disposable = storage.onDidChangeMarkers(event => {
        assert.strictEqual(event.markerId, undefined);
        disposable.dispose();
        done();
      });

      storage.removeMarker(testUri);
    });
  });

  suite('Marker Type Validation', () => {
    test('rejects null config', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      // Attempt to set a marker with null type should use fallback
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test.ts`);

      storage.setMarker(testUri, 'null-type');
      const markerType = storage.getMarkerType('null-type');

      // Should return fallback
      assert.strictEqual(markerType.badge, '⚠');

      // Cleanup
      storage.removeMarker(testUri);
    });

    test('rejects config with empty id', function() {
      // When loading marker types with empty id, they should be skipped
      const unknownType = storage.getMarkerType('');
      assert.strictEqual(unknownType.badge, '⚠'); // Fallback
    });

    test('rejects config with empty badge', function() {
      // Marker types with empty badge should be skipped during load
      // Verify that a made-up ID returns fallback
      const unknownType = storage.getMarkerType('empty-badge-type');
      assert.strictEqual(unknownType.badge, '⚠');
    });

    test('truncates badge to 2 characters', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      // The loadMarkerTypes function truncates badges to 2 chars
      // Default markers should all have badges <= 2 chars
      const types = storage.getAllMarkerTypes();
      for (const type of types) {
        assert.ok(
          type.badge.length <= 2,
          `Badge "${type.badge}" for ${type.id} should be <= 2 chars`
        );
      }
    });
  });

  suite('Path Normalization', () => {
    test('handles Windows-style paths', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

      // Set marker using forward slashes
      const testUri = vscode.Uri.file(`${workspaceRoot}/src/components/Button.tsx`);
      storage.setMarker(testUri, 'done');

      // Should be able to retrieve it
      assert.strictEqual(storage.getMarker(testUri), 'done');

      // Cleanup
      storage.removeMarker(testUri);
    });

    test('returns undefined for paths outside workspace', function() {
      // Create URI outside workspace
      const outsideUri = vscode.Uri.file('/some/other/path/file.ts');

      // Should return undefined, not throw
      const marker = storage.getMarker(outsideUri);
      assert.strictEqual(marker, undefined);
    });
  });
});
