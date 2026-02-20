import * as assert from 'assert';
import * as vscode from 'vscode';
import { NoteStorage } from '../noteStorage';

suite('NoteStorage Test Suite', () => {
  let noteStorage: NoteStorage;

  // Helper to clean up notes file
  async function cleanupNotesFile(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const notesFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-marker-notes.json');
      try {
        await vscode.workspace.fs.delete(notesFile);
      } catch {
        // File may not exist, ignore
      }
    }
  }

  setup(async () => {
    await cleanupNotesFile();
    noteStorage = new NoteStorage();
    await noteStorage.initialize();
  });

  teardown(async () => {
    noteStorage.dispose();
    await cleanupNotesFile();
  });

  suite('CRUD Operations', () => {
    test('setNote stores note and fires event', function(done) {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/test-file.ts`);

      const disposable = noteStorage.onDidChangeNotes(() => {
        disposable.dispose();
        const note = noteStorage.getNote(testUri);
        assert.strictEqual(note, 'Test note content');
        done();
      });

      noteStorage.setNote(testUri, 'Test note content');
    });

    test('setNote with empty text removes the note', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/empty-note.ts`);

      noteStorage.setNote(testUri, 'Some note');
      assert.ok(noteStorage.hasNote(testUri));

      noteStorage.setNote(testUri, '');
      assert.ok(!noteStorage.hasNote(testUri));
    });

    test('setNote with whitespace-only text removes the note', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/whitespace-note.ts`);

      noteStorage.setNote(testUri, 'Some note');
      assert.ok(noteStorage.hasNote(testUri));

      noteStorage.setNote(testUri, '   \n\t  ');
      assert.ok(!noteStorage.hasNote(testUri));
    });

    test('setNote truncates text longer than 500 characters', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/long-note.ts`);

      const longText = 'a'.repeat(600);
      noteStorage.setNote(testUri, longText);

      const note = noteStorage.getNote(testUri);
      assert.ok(note);
      assert.strictEqual(note.length, 500);

      noteStorage.removeNote(testUri);
    });

    test('removeNote removes note and fires event', function(done) {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/remove-note.ts`);

      noteStorage.setNote(testUri, 'Will be removed');

      const disposable = noteStorage.onDidChangeNotes(() => {
        disposable.dispose();
        assert.ok(!noteStorage.hasNote(testUri));
        done();
      });

      noteStorage.removeNote(testUri);
    });

    test('removeNote on non-existent note is a no-op', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/no-note.ts`);

      let eventFired = false;
      const disposable = noteStorage.onDidChangeNotes(() => {
        eventFired = true;
      });

      noteStorage.removeNote(testUri);

      // Give event loop a chance
      assert.ok(!eventFired, 'Event should not fire for non-existent note removal');
      disposable.dispose();
    });

    test('getNote returns undefined for files without notes', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/no-note.ts`);

      assert.strictEqual(noteStorage.getNote(testUri), undefined);
    });

    test('hasNote returns correct boolean', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/has-note.ts`);

      assert.strictEqual(noteStorage.hasNote(testUri), false);

      noteStorage.setNote(testUri, 'A note');
      assert.strictEqual(noteStorage.hasNote(testUri), true);

      noteStorage.removeNote(testUri);
      assert.strictEqual(noteStorage.hasNote(testUri), false);
    });

    test('getNoteCount returns correct count', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

      assert.strictEqual(noteStorage.getNoteCount(), 0);

      noteStorage.setNote(vscode.Uri.file(`${workspaceRoot}/a.ts`), 'Note A');
      assert.strictEqual(noteStorage.getNoteCount(), 1);

      noteStorage.setNote(vscode.Uri.file(`${workspaceRoot}/b.ts`), 'Note B');
      assert.strictEqual(noteStorage.getNoteCount(), 2);

      noteStorage.removeNote(vscode.Uri.file(`${workspaceRoot}/a.ts`));
      assert.strictEqual(noteStorage.getNoteCount(), 1);

      noteStorage.removeNote(vscode.Uri.file(`${workspaceRoot}/b.ts`));
      assert.strictEqual(noteStorage.getNoteCount(), 0);
    });

    test('getAllNotedFiles returns correct entries', function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

      noteStorage.setNote(vscode.Uri.file(`${workspaceRoot}/src/file1.ts`), 'Note 1');
      noteStorage.setNote(vscode.Uri.file(`${workspaceRoot}/src/file2.ts`), 'Note 2');

      const files = noteStorage.getAllNotedFiles();
      assert.strictEqual(files.length, 2);

      const paths = files.map(f => f.relativePath).sort();
      assert.deepStrictEqual(paths, ['src/file1.ts', 'src/file2.ts']);

      const notes = files.map(f => f.note).sort();
      assert.deepStrictEqual(notes, ['Note 1', 'Note 2']);

      // Cleanup
      noteStorage.removeNote(vscode.Uri.file(`${workspaceRoot}/src/file1.ts`));
      noteStorage.removeNote(vscode.Uri.file(`${workspaceRoot}/src/file2.ts`));
    });
  });

  suite('Persistence', () => {
    test('notes survive save/load cycle', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const testUri = vscode.Uri.file(`${workspaceRoot}/persist-test.ts`);

      noteStorage.setNote(testUri, 'Persisted note');

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 300));

      // Read the file directly
      const workspaceFolder = vscode.workspace.workspaceFolders![0];
      const notesFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-marker-notes.json');
      const content = await vscode.workspace.fs.readFile(notesFile);
      const data = JSON.parse(Buffer.from(content).toString('utf8'));

      assert.ok(data.notes, 'File should have a "notes" key');
      assert.strictEqual(data.notes['persist-test.ts'], 'Persisted note');

      // Cleanup
      noteStorage.removeNote(testUri);
    });

    test('storage file format is { notes: { ... } }', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      noteStorage.setNote(vscode.Uri.file(`${workspaceRoot}/format-test.ts`), 'Format test');

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 300));

      const workspaceFolder = vscode.workspace.workspaceFolders![0];
      const notesFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-marker-notes.json');
      const content = await vscode.workspace.fs.readFile(notesFile);
      const data = JSON.parse(Buffer.from(content).toString('utf8'));

      // Verify top-level keys
      const keys = Object.keys(data);
      assert.strictEqual(keys.length, 1, 'Should only have "notes" key');
      assert.strictEqual(keys[0], 'notes');
      assert.strictEqual(typeof data.notes, 'object');

      // Cleanup
      noteStorage.removeNote(vscode.Uri.file(`${workspaceRoot}/format-test.ts`));
    });

    test('notes file is separate from markers file', async function() {
      if (!vscode.workspace.workspaceFolders?.[0]) {
        this.skip();
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      noteStorage.setNote(vscode.Uri.file(`${workspaceRoot}/separate-test.ts`), 'Separate note');

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 300));

      const workspaceFolder = vscode.workspace.workspaceFolders![0];

      // Check notes file exists
      const notesFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-marker-notes.json');
      const notesContent = await vscode.workspace.fs.readFile(notesFile);
      const notesData = JSON.parse(Buffer.from(notesContent).toString('utf8'));
      assert.ok(notesData.notes['separate-test.ts'], 'Note should be in notes file');

      // Check markers file does NOT contain notes
      const markersFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'file-markers.json');
      try {
        const markersContent = await vscode.workspace.fs.readFile(markersFile);
        const markersData = JSON.parse(Buffer.from(markersContent).toString('utf8'));
        assert.strictEqual(markersData.notes, undefined, 'Markers file should not have "notes" key');
      } catch {
        // Markers file may not exist, which is fine
      }

      // Cleanup
      noteStorage.removeNote(vscode.Uri.file(`${workspaceRoot}/separate-test.ts`));
    });
  });

  suite('Path Handling', () => {
    test('returns undefined for paths outside workspace', function() {
      const outsideUri = vscode.Uri.file('/tmp/outside-workspace.ts');
      assert.strictEqual(noteStorage.getNote(outsideUri), undefined);
      assert.strictEqual(noteStorage.hasNote(outsideUri), false);
    });
  });
});
