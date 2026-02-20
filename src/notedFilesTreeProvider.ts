import * as vscode from 'vscode';
import * as path from 'path';
import { NoteStorage } from './noteStorage';
import { MarkerStorage } from './storage';

export class NotedFilesTreeProvider
  implements vscode.TreeDataProvider<NoteTreeItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<NoteTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private disposables: vscode.Disposable[] = [];
  private treeView?: vscode.TreeView<NoteTreeItem>;

  constructor(
    private readonly noteStorage: NoteStorage,
    private readonly markerStorage: MarkerStorage
  ) {
    this.disposables.push(
      noteStorage.onDidChangeNotes(() => this._onDidChangeTreeData.fire())
    );
    this.disposables.push(
      markerStorage.onDidChangeMarkers(() => this._onDidChangeTreeData.fire())
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        this.revealActiveFile(editor);
      })
    );
  }

  setTreeView(treeView: vscode.TreeView<NoteTreeItem>): void {
    this.treeView = treeView;
  }

  getTreeItem(element: NoteTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): NoteTreeItem[] {
    const files = this.noteStorage.getAllNotedFiles();
    if (files.length === 0) {
      return [];
    }

    return files.map(({ uri, relativePath, note }) => {
      const fileName = path.basename(relativePath);
      const dirPath = path.dirname(relativePath);
      const markerId = this.markerStorage.getMarker(uri);
      const markerType = markerId
        ? this.markerStorage.getMarkerType(markerId)
        : undefined;

      const item = new NoteTreeItem(
        fileName,
        uri,
        vscode.TreeItemCollapsibleState.None
      );

      // Show note preview as description (truncated)
      const preview = note.length > 60 ? note.substring(0, 57) + '...' : note;
      item.description = preview;

      // Full note + marker info in tooltip (supports MarkdownString)
      const tooltipParts: string[] = [];
      if (markerType) {
        tooltipParts.push(`**${markerType.badge} ${markerType.label}**`);
      }
      tooltipParts.push(note);
      tooltipParts.push(`\n\n*${relativePath}*`);
      item.tooltip = new vscode.MarkdownString(tooltipParts.join('\n\n'));

      // Show folder path as detail if not in root
      if (dirPath && dirPath !== '.') {
        item.description = `${dirPath} — ${preview}`;
      }

      // File icon
      item.resourceUri = uri;
      item.iconPath = vscode.ThemeIcon.File;

      // Click to open file
      item.command = {
        command: 'file-markers.openNotedFile',
        title: 'Open File',
        arguments: [uri],
      };

      item.contextValue = 'notedFile';

      return item;
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private revealActiveFile(editor: vscode.TextEditor | undefined): void {
    if (!this.treeView || !this.treeView.visible) {
      return;
    }
    if (!editor || editor.document.uri.scheme !== 'file') {
      return;
    }

    const uri = editor.document.uri;
    if (!this.noteStorage.hasNote(uri)) {
      return;
    }

    // Find the matching tree item by rebuilding children and matching URI
    const children = this.getChildren();
    const match = children.find(
      item => item.fileUri.toString() === uri.toString()
    );
    if (match) {
      this.treeView.reveal(match, { select: true, focus: false });
    }
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

class NoteTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly fileUri: vscode.Uri,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}
