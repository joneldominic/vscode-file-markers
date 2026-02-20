import * as assert from 'assert';
import * as vscode from 'vscode';
import { NoteStorage } from '../noteStorage';
import { MarkerStorage } from '../storage';
import { NotesViewProvider } from '../notesViewProvider';
import { NotedFilesTreeProvider } from '../notedFilesTreeProvider';
import { MarkerDecorationProvider } from '../decorationProvider';

suite('Notes Integration Test Suite', () => {
  let noteStorage: NoteStorage;
  let markerStorage: MarkerStorage;
  let treeProvider: NotedFilesTreeProvider;
  let decorationProvider: MarkerDecorationProvider;
  const token = new vscode.CancellationTokenSource().token;

  async function cleanupNotesFile(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const notesFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-marker-notes.json');
      try {
        await vscode.workspace.fs.delete(notesFile);
      } catch {
        // File may not exist
      }
    }
  }

  setup(async () => {
    await cleanupNotesFile();
    noteStorage = new NoteStorage();
    await noteStorage.initialize();
    markerStorage = new MarkerStorage();
    await markerStorage.initialize();
    treeProvider = new NotedFilesTreeProvider(noteStorage, markerStorage);
    decorationProvider = new MarkerDecorationProvider(markerStorage, noteStorage);
  });

  teardown(async () => {
    decorationProvider.dispose();
    treeProvider.dispose();
    noteStorage.dispose();
    markerStorage.dispose();
    await cleanupNotesFile();
  });

  suite('NotesViewProvider', () => {
    test('viewType matches package.json registration', () => {
      assert.strictEqual(NotesViewProvider.viewType, 'fileMarkers.noteEditor');
    });

    test('constructs without error', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const extensionUri = vscode.Uri.file('/tmp/test-extension');
      const provider = new NotesViewProvider(extensionUri, noteStorage, markerStorage);
      assert.ok(provider);
      provider.dispose();
    });

    test('showNoteForUri does not throw when view is not resolved', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const extensionUri = vscode.Uri.file('/tmp/test-extension');
      const provider = new NotesViewProvider(extensionUri, noteStorage, markerStorage);
      const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test.ts`);

      // Should not throw even though the webview isn't resolved yet
      assert.doesNotThrow(() => provider.showNoteForUri(testUri));
      provider.dispose();
    });

    test('dispose cleans up without error', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const extensionUri = vscode.Uri.file('/tmp/test-extension');
      const provider = new NotesViewProvider(extensionUri, noteStorage, markerStorage);
      assert.doesNotThrow(() => provider.dispose());
    });
  });

  suite('Full note lifecycle', () => {
    test('set note → tree shows item → decoration shows badge → remove → both clear', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/lifecycle-test.ts`);

      // 1. Initially: no tree items, no decoration
      assert.strictEqual(treeProvider.getChildren().length, 0);
      assert.strictEqual(decorationProvider.provideFileDecoration(testUri, token), undefined);

      // 2. Set a note
      noteStorage.setNote(testUri, 'Lifecycle test note');

      // 3. Tree should show the file
      const children = treeProvider.getChildren();
      assert.strictEqual(children.length, 1);
      assert.strictEqual(children[0].label, 'lifecycle-test.ts');

      // 4. Decoration should show N badge
      const decoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.ok(decoration);
      assert.strictEqual(decoration.badge, 'N');
      assert.ok(decoration.tooltip?.includes('Note:'));

      // 5. Remove the note
      noteStorage.removeNote(testUri);

      // 6. Tree should be empty again
      assert.strictEqual(treeProvider.getChildren().length, 0);

      // 7. Decoration should be undefined again
      assert.strictEqual(decorationProvider.provideFileDecoration(testUri, token), undefined);
    });

    test('editing a note updates tree description', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/edit-note.ts`);

      noteStorage.setNote(testUri, 'Original note');
      let children = treeProvider.getChildren();
      assert.ok(
        typeof children[0].description === 'string' &&
          children[0].description.includes('Original note')
      );

      // Update the note
      noteStorage.setNote(testUri, 'Updated note');
      children = treeProvider.getChildren();
      assert.ok(
        typeof children[0].description === 'string' &&
          children[0].description.includes('Updated note')
      );

      // Cleanup
      noteStorage.removeNote(testUri);
    });

    test('editing a note updates decoration tooltip', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/tooltip-update.ts`);

      noteStorage.setNote(testUri, 'First version');
      let decoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.ok(decoration.tooltip?.includes('First version'));

      noteStorage.setNote(testUri, 'Second version');
      decoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.ok(decoration.tooltip?.includes('Second version'));

      // Cleanup
      noteStorage.removeNote(testUri);
    });
  });

  suite('Notes with markers', () => {
    test('file with marker and note shows marker badge in decoration', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/marker-note.ts`);

      markerStorage.setMarker(testUri, 'done');
      noteStorage.setNote(testUri, 'Done and documented');

      // Decoration should show marker badge (not N), with note in tooltip
      const decoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.ok(decoration);
      assert.strictEqual(decoration.badge, '✓'); // marker badge takes precedence
      assert.ok(decoration.tooltip?.includes('Done'), 'Should include marker label');
      assert.ok(decoration.tooltip?.includes('Note:'), 'Should include note prefix');
      assert.ok(decoration.tooltip?.includes('documented'), 'Should include note text');

      // Cleanup
      markerStorage.removeMarker(testUri);
      noteStorage.removeNote(testUri);
    });

    test('tree tooltip includes marker info when file has both', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/both-tooltip.ts`);

      markerStorage.setMarker(testUri, 'in-progress');
      noteStorage.setNote(testUri, 'Work in progress');

      const children = treeProvider.getChildren();
      assert.strictEqual(children.length, 1);

      const tooltip = children[0].tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('In Progress'), 'Tooltip should have marker label');
      assert.ok(tooltip.value.includes('Work in progress'), 'Tooltip should have note text');

      // Cleanup
      markerStorage.removeMarker(testUri);
      noteStorage.removeNote(testUri);
    });

    test('removing marker keeps note in tree and decoration', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/remove-marker-keep-note.ts`);

      markerStorage.setMarker(testUri, 'done');
      noteStorage.setNote(testUri, 'Still has a note');

      // Remove marker but keep note
      markerStorage.removeMarker(testUri);

      // Tree should still show the file
      const children = treeProvider.getChildren();
      assert.strictEqual(children.length, 1);

      // Decoration should now show N badge (note only)
      const decoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.strictEqual(decoration.badge, 'N');

      // Cleanup
      noteStorage.removeNote(testUri);
    });

    test('removing note keeps marker in decoration', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/remove-note-keep-marker.ts`);

      markerStorage.setMarker(testUri, 'important');
      noteStorage.setNote(testUri, 'Temporary note');

      // Remove note but keep marker
      noteStorage.removeNote(testUri);

      // Tree should be empty (only shows noted files)
      assert.strictEqual(treeProvider.getChildren().length, 0);

      // Decoration should still show marker badge
      const decoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.ok(decoration);
      assert.strictEqual(decoration.badge, '★');

      // Cleanup
      markerStorage.removeMarker(testUri);
    });
  });

  suite('Notes with line highlights', () => {
    test('file with line highlights and note shows highlight badge with note in tooltip', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/highlights-note.ts`);

      markerStorage.setLineHighlight(testUri, 1, 10, 'highlight-yellow');
      noteStorage.setNote(testUri, 'Has highlights and note');

      const decoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.ok(decoration);
      assert.strictEqual(decoration.badge, '≡'); // line highlight badge
      assert.ok(decoration.tooltip?.includes('Note:'), 'Tooltip should include note');
      assert.ok(decoration.tooltip?.includes('Has highlights and note'));

      // Cleanup
      markerStorage.removeAllLineHighlightsInFile(testUri);
      noteStorage.removeNote(testUri);
    });
  });

  suite('Multiple files', () => {
    test('multiple noted files appear in tree and decorations', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const uri1 = vscode.Uri.file(`${workspaceRoot}/multi-a.ts`);
      const uri2 = vscode.Uri.file(`${workspaceRoot}/multi-b.ts`);
      const uri3 = vscode.Uri.file(`${workspaceRoot}/multi-c.ts`);

      noteStorage.setNote(uri1, 'Note A');
      noteStorage.setNote(uri2, 'Note B');
      noteStorage.setNote(uri3, 'Note C');

      // Tree shows all three
      const children = treeProvider.getChildren();
      assert.strictEqual(children.length, 3);

      // Each has a decoration
      for (const uri of [uri1, uri2, uri3]) {
        const decoration = decorationProvider.provideFileDecoration(uri, token) as vscode.FileDecoration;
        assert.ok(decoration, `${uri.fsPath} should have decoration`);
        assert.strictEqual(decoration.badge, 'N');
      }

      // Remove one
      noteStorage.removeNote(uri2);
      assert.strictEqual(treeProvider.getChildren().length, 2);
      assert.strictEqual(decorationProvider.provideFileDecoration(uri2, token), undefined);

      // Cleanup
      noteStorage.removeNote(uri1);
      noteStorage.removeNote(uri3);
    });

    test('notes on files in different directories show correct paths', function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const rootFile = vscode.Uri.file(`${workspaceRoot}/root-file.ts`);
      const nestedFile = vscode.Uri.file(`${workspaceRoot}/src/utils/nested.ts`);

      noteStorage.setNote(rootFile, 'Root note');
      noteStorage.setNote(nestedFile, 'Nested note');

      const children = treeProvider.getChildren();
      assert.strictEqual(children.length, 2);

      // Find the nested file item
      const nestedItem = children.find(c => c.label === 'nested.ts');
      assert.ok(nestedItem, 'Should find nested file in tree');
      assert.ok(
        typeof nestedItem!.description === 'string' &&
          nestedItem!.description.includes('src/utils'),
        'Nested file should show directory path'
      );

      // Root file should NOT have directory prefix
      const rootItem = children.find(c => c.label === 'root-file.ts');
      assert.ok(rootItem, 'Should find root file in tree');
      assert.ok(
        typeof rootItem!.description === 'string' &&
          !rootItem!.description.includes('/'),
        'Root file should not have directory path in description'
      );

      // Cleanup
      noteStorage.removeNote(rootFile);
      noteStorage.removeNote(nestedFile);
    });
  });

  suite('Note persistence', () => {
    test('notes persist to file and survive reload', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/persist-reload.ts`);

      noteStorage.setNote(testUri, 'Survives reload');

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 300));

      // Create a new NoteStorage to simulate reload
      const freshStorage = new NoteStorage();
      await freshStorage.initialize();

      assert.ok(freshStorage.hasNote(testUri), 'Note should survive reload');
      assert.strictEqual(freshStorage.getNote(testUri), 'Survives reload');

      // Fresh tree should also show the note
      const freshTree = new NotedFilesTreeProvider(freshStorage, markerStorage);
      assert.strictEqual(freshTree.getChildren().length, 1);

      // Cleanup
      freshTree.dispose();
      freshStorage.dispose();
      noteStorage.removeNote(testUri);
    });
  });

  suite('Extension disabled state', () => {
    test('decorations return undefined when extension is disabled', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/disabled-test.ts`);

      noteStorage.setNote(testUri, 'Should not decorate');

      // Disable extension
      const config = vscode.workspace.getConfiguration('fileMarkers');
      await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

      const decoration = decorationProvider.provideFileDecoration(testUri, token);
      assert.strictEqual(decoration, undefined, 'Should not decorate when disabled');

      // Re-enable
      await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);

      // Now it should decorate
      const enabledDecoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.ok(enabledDecoration);
      assert.strictEqual(enabledDecoration.badge, 'N');

      // Cleanup
      noteStorage.removeNote(testUri);
    });
  });

  suite('openNotedFile command integration', () => {
    test('opening a noted file from tree makes it the active editor', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders[0];
      const testFile = vscode.Uri.joinPath(workspaceFolder.uri, 'open-from-tree.txt');

      // Create the file
      await vscode.workspace.fs.writeFile(testFile, Buffer.from('tree click content'));

      try {
        noteStorage.setNote(testFile, 'Open from tree test');

        // Verify tree has the item
        const children = treeProvider.getChildren();
        assert.strictEqual(children.length, 1);
        assert.ok(children[0].command, 'Item should have click command');
        assert.strictEqual(children[0].command!.command, 'file-markers.openNotedFile');

        // Execute the command (simulates clicking the tree item)
        await vscode.commands.executeCommand(
          children[0].command!.command,
          ...children[0].command!.arguments!
        );

        // Verify the file is now active
        const activeEditor = vscode.window.activeTextEditor;
        assert.ok(activeEditor, 'Should have an active editor');
        assert.strictEqual(activeEditor!.document.uri.fsPath, testFile.fsPath);
      } finally {
        noteStorage.removeNote(testFile);
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        try {
          await vscode.workspace.fs.delete(testFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  suite('Write, save, edit, and remove notes on disk', () => {
    // Helper to read notes JSON from disk
    async function readNotesFromDisk(): Promise<Record<string, string>> {
      const workspaceFolder = vscode.workspace.workspaceFolders![0];
      const notesFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-marker-notes.json');
      try {
        const content = await vscode.workspace.fs.readFile(notesFile);
        const data = JSON.parse(Buffer.from(content).toString('utf8'));
        return data.notes || {};
      } catch {
        return {};
      }
    }

    // Helper to wait for debounced save to complete
    async function waitForSave(): Promise<void> {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    test('writing a new note persists to disk', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/write-test.ts`);

      // Write a note
      noteStorage.setNote(testUri, 'Brand new note');
      await waitForSave();

      // Verify on disk
      const notes = await readNotesFromDisk();
      assert.strictEqual(notes['write-test.ts'], 'Brand new note');

      // Cleanup
      noteStorage.removeNote(testUri);
    });

    test('editing an existing note updates the file on disk', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/edit-disk-test.ts`);

      // Write initial note
      noteStorage.setNote(testUri, 'Version 1');
      await waitForSave();

      let notes = await readNotesFromDisk();
      assert.strictEqual(notes['edit-disk-test.ts'], 'Version 1');

      // Edit the note
      noteStorage.setNote(testUri, 'Version 2 - edited');
      await waitForSave();

      notes = await readNotesFromDisk();
      assert.strictEqual(notes['edit-disk-test.ts'], 'Version 2 - edited');

      // Edit again
      noteStorage.setNote(testUri, 'Version 3 - final');
      await waitForSave();

      notes = await readNotesFromDisk();
      assert.strictEqual(notes['edit-disk-test.ts'], 'Version 3 - final');

      // Cleanup
      noteStorage.removeNote(testUri);
    });

    test('removing a note deletes it from disk', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/remove-disk-test.ts`);

      // Write then remove
      noteStorage.setNote(testUri, 'Will be removed');
      await waitForSave();

      let notes = await readNotesFromDisk();
      assert.strictEqual(notes['remove-disk-test.ts'], 'Will be removed');

      noteStorage.removeNote(testUri);
      await waitForSave();

      notes = await readNotesFromDisk();
      assert.strictEqual(notes['remove-disk-test.ts'], undefined, 'Note should be gone from disk');
    });

    test('setting empty text removes note from disk', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/empty-disk-test.ts`);

      noteStorage.setNote(testUri, 'Exists');
      await waitForSave();

      let notes = await readNotesFromDisk();
      assert.ok(notes['empty-disk-test.ts']);

      // Set to empty string (simulates clearing textarea and saving)
      noteStorage.setNote(testUri, '');
      await waitForSave();

      notes = await readNotesFromDisk();
      assert.strictEqual(notes['empty-disk-test.ts'], undefined, 'Empty note should be removed from disk');
    });

    test('writing multiple notes then removing one leaves others intact on disk', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const uriA = vscode.Uri.file(`${workspaceRoot}/multi-a.ts`);
      const uriB = vscode.Uri.file(`${workspaceRoot}/multi-b.ts`);
      const uriC = vscode.Uri.file(`${workspaceRoot}/multi-c.ts`);

      noteStorage.setNote(uriA, 'Note A');
      noteStorage.setNote(uriB, 'Note B');
      noteStorage.setNote(uriC, 'Note C');
      await waitForSave();

      let notes = await readNotesFromDisk();
      assert.strictEqual(Object.keys(notes).length, 3);

      // Remove middle note
      noteStorage.removeNote(uriB);
      await waitForSave();

      notes = await readNotesFromDisk();
      assert.strictEqual(notes['multi-a.ts'], 'Note A', 'Note A should remain');
      assert.strictEqual(notes['multi-b.ts'], undefined, 'Note B should be gone');
      assert.strictEqual(notes['multi-c.ts'], 'Note C', 'Note C should remain');

      // Cleanup
      noteStorage.removeNote(uriA);
      noteStorage.removeNote(uriC);
    });

    test('note truncation at 500 chars persists correctly to disk', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/truncate-disk-test.ts`);

      const longText = 'x'.repeat(600);
      noteStorage.setNote(testUri, longText);
      await waitForSave();

      const notes = await readNotesFromDisk();
      assert.strictEqual(
        notes['truncate-disk-test.ts']?.length,
        500,
        'Disk should have truncated note'
      );

      // Cleanup
      noteStorage.removeNote(testUri);
    });

    test('whitespace-only note is not saved to disk', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/whitespace-disk-test.ts`);

      noteStorage.setNote(testUri, '   \n\t  ');
      await waitForSave();

      const notes = await readNotesFromDisk();
      assert.strictEqual(
        notes['whitespace-disk-test.ts'],
        undefined,
        'Whitespace-only note should not be on disk'
      );
    });

    test('note text is trimmed before saving to disk', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/trim-disk-test.ts`);

      noteStorage.setNote(testUri, '  padded note  ');
      await waitForSave();

      const notes = await readNotesFromDisk();
      assert.strictEqual(notes['trim-disk-test.ts'], 'padded note', 'Note should be trimmed on disk');

      // Cleanup
      noteStorage.removeNote(testUri);
    });

    test('notes file is valid JSON with correct structure', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/structure-test.ts`);

      noteStorage.setNote(testUri, 'Structure test');
      await waitForSave();

      // Read raw file content
      const workspaceFolder = vscode.workspace.workspaceFolders![0];
      const notesFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-marker-notes.json');
      const raw = await vscode.workspace.fs.readFile(notesFile);
      const content = Buffer.from(raw).toString('utf8');

      // Should be valid JSON
      let data: Record<string, unknown>;
      assert.doesNotThrow(() => {
        data = JSON.parse(content);
      }, 'File should be valid JSON');
      data = JSON.parse(content);

      // Should have exactly one top-level key: "notes"
      const keys = Object.keys(data);
      assert.strictEqual(keys.length, 1, 'Should have exactly one top-level key');
      assert.strictEqual(keys[0], 'notes', 'Top-level key should be "notes"');

      // Notes should be an object of string -> string
      const notes = data['notes'] as Record<string, unknown>;
      assert.strictEqual(typeof notes, 'object');
      for (const [key, value] of Object.entries(notes)) {
        assert.strictEqual(typeof key, 'string', 'Key should be string');
        assert.strictEqual(typeof value, 'string', `Value for "${key}" should be string`);
      }

      // Cleanup
      noteStorage.removeNote(testUri);
    });

    test('full write-edit-remove cycle with tree and decoration verification', async function () {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/full-cycle.ts`);

      // 1. Write — verify in memory, on disk, in tree, and in decoration
      noteStorage.setNote(testUri, 'Initial note');
      await waitForSave();

      let notes = await readNotesFromDisk();
      assert.strictEqual(notes['full-cycle.ts'], 'Initial note');
      assert.strictEqual(treeProvider.getChildren().length, 1);
      let decoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.strictEqual(decoration.badge, 'N');
      assert.ok(decoration.tooltip?.includes('Initial note'));

      // 2. Edit — verify updated everywhere
      noteStorage.setNote(testUri, 'Edited note');
      await waitForSave();

      notes = await readNotesFromDisk();
      assert.strictEqual(notes['full-cycle.ts'], 'Edited note');
      assert.strictEqual(treeProvider.getChildren().length, 1);
      const treeItem = treeProvider.getChildren()[0];
      assert.ok(
        typeof treeItem.description === 'string' &&
          treeItem.description.includes('Edited note')
      );
      decoration = decorationProvider.provideFileDecoration(testUri, token) as vscode.FileDecoration;
      assert.ok(decoration.tooltip?.includes('Edited note'));

      // 3. Remove — verify gone everywhere
      noteStorage.removeNote(testUri);
      await waitForSave();

      notes = await readNotesFromDisk();
      assert.strictEqual(notes['full-cycle.ts'], undefined);
      assert.strictEqual(treeProvider.getChildren().length, 0);
      assert.strictEqual(decorationProvider.provideFileDecoration(testUri, token), undefined);
    });
  });
});
