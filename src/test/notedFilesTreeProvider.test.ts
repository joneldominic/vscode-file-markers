import * as assert from 'assert';
import * as vscode from 'vscode';
import { NoteStorage } from '../noteStorage';
import { MarkerStorage } from '../storage';
import { NotedFilesTreeProvider } from '../notedFilesTreeProvider';

suite('NotedFilesTreeProvider Test Suite', () => {
  let noteStorage: NoteStorage;
  let markerStorage: MarkerStorage;
  let provider: NotedFilesTreeProvider;

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
    provider = new NotedFilesTreeProvider(noteStorage, markerStorage);
  });

  teardown(async () => {
    provider.dispose();
    noteStorage.dispose();
    markerStorage.dispose();
    await cleanupNotesFile();
  });

  test('returns empty array when no notes', function () {
    const children = provider.getChildren();
    assert.strictEqual(children.length, 0);
  });

  test('returns items when notes exist', function () {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/noted-file.ts`);

    noteStorage.setNote(testUri, 'A test note');

    const children = provider.getChildren();
    assert.strictEqual(children.length, 1);
  });

  test('tree items have correct properties', function () {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/src/myfile.ts`);

    noteStorage.setNote(testUri, 'Needs refactoring');

    const children = provider.getChildren();
    assert.strictEqual(children.length, 1);

    const item = children[0];
    assert.strictEqual(item.label, 'myfile.ts');
    assert.strictEqual(item.contextValue, 'notedFile');
    assert.ok(item.command, 'Tree item should have a click command');
    assert.strictEqual(item.command!.command, 'file-markers.openNotedFile');
    assert.strictEqual(item.iconPath, vscode.ThemeIcon.File);
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);

    // Cleanup
    noteStorage.removeNote(testUri);
  });

  test('description includes note preview', function () {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/preview.ts`);

    noteStorage.setNote(testUri, 'Short note');

    const children = provider.getChildren();
    const item = children[0];
    assert.ok(
      typeof item.description === 'string' && item.description.includes('Short note'),
      'Description should include note preview'
    );

    // Cleanup
    noteStorage.removeNote(testUri);
  });

  test('description includes folder path for nested files', function () {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/src/utils/helper.ts`);

    noteStorage.setNote(testUri, 'Helper note');

    const children = provider.getChildren();
    const item = children[0];
    assert.ok(
      typeof item.description === 'string' && item.description.includes('src/utils'),
      `Description should include folder path, got: ${item.description}`
    );

    // Cleanup
    noteStorage.removeNote(testUri);
  });

  test('long note preview is truncated', function () {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/long-preview.ts`);

    const longNote = 'a'.repeat(100);
    noteStorage.setNote(testUri, longNote);

    const children = provider.getChildren();
    const item = children[0];
    assert.ok(
      typeof item.description === 'string' && item.description.endsWith('...'),
      'Long note preview should be truncated with ellipsis'
    );

    // Cleanup
    noteStorage.removeNote(testUri);
  });

  test('tooltip includes note text', function () {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/tooltip-test.ts`);

    noteStorage.setNote(testUri, 'Tooltip content');

    const children = provider.getChildren();
    const item = children[0];
    assert.ok(item.tooltip instanceof vscode.MarkdownString, 'Tooltip should be MarkdownString');
    assert.ok(
      (item.tooltip as vscode.MarkdownString).value.includes('Tooltip content'),
      'Tooltip should include note text'
    );

    // Cleanup
    noteStorage.removeNote(testUri);
  });

  test('tooltip includes marker info when file has marker', function () {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/marker-tooltip.ts`);

    noteStorage.setNote(testUri, 'Note with marker');
    markerStorage.setMarker(testUri, 'done');

    const children = provider.getChildren();
    const item = children[0];
    assert.ok(item.tooltip instanceof vscode.MarkdownString, 'Tooltip should be MarkdownString');
    const tooltipValue = (item.tooltip as vscode.MarkdownString).value;
    assert.ok(tooltipValue.includes('Done'), 'Tooltip should include marker label');
    assert.ok(tooltipValue.includes('Note with marker'), 'Tooltip should include note text');

    // Cleanup
    noteStorage.removeNote(testUri);
    markerStorage.removeMarker(testUri);
  });

  test('refresh fires onDidChangeTreeData event', function (done) {
    const disposable = provider.onDidChangeTreeData(() => {
      disposable.dispose();
      done();
    });

    provider.refresh();
  });

  test('tree auto-refreshes when notes change', function (done) {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/auto-refresh.ts`);

    const disposable = provider.onDidChangeTreeData(() => {
      disposable.dispose();
      noteStorage.removeNote(testUri);
      done();
    });

    noteStorage.setNote(testUri, 'Trigger refresh');
  });

  test('multiple noted files are returned', function () {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const uri1 = vscode.Uri.file(`${workspaceRoot}/file1.ts`);
    const uri2 = vscode.Uri.file(`${workspaceRoot}/file2.ts`);
    const uri3 = vscode.Uri.file(`${workspaceRoot}/file3.ts`);

    noteStorage.setNote(uri1, 'Note 1');
    noteStorage.setNote(uri2, 'Note 2');
    noteStorage.setNote(uri3, 'Note 3');

    const children = provider.getChildren();
    assert.strictEqual(children.length, 3);

    // Cleanup
    noteStorage.removeNote(uri1);
    noteStorage.removeNote(uri2);
    noteStorage.removeNote(uri3);
  });

  test('fileUri is set on tree items', function () {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      this.skip();
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testUri = vscode.Uri.file(`${workspaceRoot}/uri-test.ts`);

    noteStorage.setNote(testUri, 'URI test');

    const children = provider.getChildren();
    assert.strictEqual(children.length, 1);

    // fileUri is a public property on NoteTreeItem
    const item = children[0] as { fileUri: vscode.Uri };
    assert.ok(item.fileUri, 'Tree item should have fileUri');
    assert.strictEqual(item.fileUri.fsPath, testUri.fsPath);

    // Cleanup
    noteStorage.removeNote(testUri);
  });
});
