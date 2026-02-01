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
});
