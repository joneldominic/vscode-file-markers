import * as vscode from 'vscode';
import { MarkerStorage } from './storage';

export class LineHighlightProvider implements vscode.Disposable {
  private decorationTypes: Map<string, vscode.TextEditorDecorationType> =
    new Map();
  private disposables: vscode.Disposable[] = [];

  constructor(private storage: MarkerStorage) {
    // Create decoration types for each line highlight type
    this.createDecorationTypes();

    // Listen for storage changes
    this.disposables.push(
      storage.onDidChangeLineHighlights(({ uri }) => {
        this.updateDecorationsForUri(uri);
      })
    );

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.updateDecorations(editor);
        }
      })
    );

    // Listen for visible editors changes
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) {
          this.updateDecorations(editor);
        }
      })
    );

    // Listen for document changes (line additions/deletions could affect highlights)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.visibleTextEditors.find(
          e => e.document === event.document
        );
        if (editor) {
          this.updateDecorations(editor);
        }
      })
    );

    // Listen for configuration changes to refresh decoration types
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('fileMarkers.enabled')) {
          this.refreshAllEditors();
        }
      })
    );

    // Initial decoration for visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDecorations(editor);
    }
  }

  private createDecorationTypes(): void {
    // Dispose old decoration types
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();

    // Create decoration type for each line highlight type
    const highlightTypes = this.storage.getAllLineHighlightTypes();
    for (const type of highlightTypes) {
      const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: type.color,
        isWholeLine: true,
      });
      this.decorationTypes.set(type.id, decorationType);
    }
  }

  private updateDecorationsForUri(uri: vscode.Uri): void {
    // Check if this is a workspace folder (bulk operation like removeAllLineHighlights)
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder && uri.fsPath === workspaceFolder.uri.fsPath) {
      // Refresh all visible editors
      this.refreshAllEditors();
      return;
    }

    // Otherwise, find and update the specific editor
    const editor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.fsPath === uri.fsPath
    );
    if (editor) {
      this.updateDecorations(editor);
    }
  }

  private updateDecorations(editor: vscode.TextEditor): void {
    // Check if extension is enabled
    const config = vscode.workspace.getConfiguration('fileMarkers');
    if (!config.get<boolean>('enabled', true)) {
      // Clear all decorations when disabled
      for (const decorationType of this.decorationTypes.values()) {
        editor.setDecorations(decorationType, []);
      }
      return;
    }

    const uri = editor.document.uri;
    const highlights = this.storage.getLineHighlights(uri);

    // Group highlights by type
    const highlightsByType = new Map<string, vscode.Range[]>();

    for (const highlight of highlights) {
      // Convert 1-indexed to 0-indexed
      const startLine = Math.max(0, highlight.startLine - 1);
      const endLine = Math.min(
        editor.document.lineCount - 1,
        highlight.endLine - 1
      );

      // Skip if lines are out of bounds
      if (startLine > editor.document.lineCount - 1) {
        continue;
      }

      const range = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, editor.document.lineAt(endLine).text.length)
      );

      const ranges = highlightsByType.get(highlight.typeId) ?? [];
      ranges.push(range);
      highlightsByType.set(highlight.typeId, ranges);
    }

    // Apply decorations for each type
    for (const [typeId, decorationType] of this.decorationTypes) {
      const ranges = highlightsByType.get(typeId) ?? [];
      editor.setDecorations(decorationType, ranges);
    }
  }

  refreshAllEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDecorations(editor);
    }
  }

  refreshDecorationTypes(): void {
    this.createDecorationTypes();
    this.refreshAllEditors();
  }

  dispose(): void {
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
    this.disposables.forEach(d => d.dispose());
  }
}
