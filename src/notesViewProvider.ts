import * as vscode from 'vscode';
import { NoteStorage } from './noteStorage';
import { MarkerStorage } from './storage';

export class NotesViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'fileMarkers.noteEditor';

  private view?: vscode.WebviewView;
  private currentUri?: vscode.Uri;
  private pendingUri?: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly noteStorage: NoteStorage,
    private readonly markerStorage: MarkerStorage
  ) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        this.updateForEditor(editor);
      })
    );

    this.disposables.push(
      noteStorage.onDidChangeNotes(() => {
        if (this.currentUri) {
          this.sendNoteToWebview();
        }
      })
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'save':
          if (this.currentUri) {
            const name = vscode.workspace.asRelativePath(this.currentUri);
            this.noteStorage.setNote(this.currentUri, message.text);
            vscode.window.showInformationMessage(`Note saved for "${name}".`);
          }
          break;
        case 'clear':
          if (this.currentUri) {
            const fileName = vscode.workspace.asRelativePath(this.currentUri);
            const confirm = await vscode.window.showWarningMessage(
              `Remove note from "${fileName}"?`,
              { modal: true },
              'Remove'
            );
            if (confirm === 'Remove') {
              this.noteStorage.removeNote(this.currentUri);
              this.sendNoteToWebview();
            }
          }
          break;
      }
    }, undefined, this.disposables);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        if (this.pendingUri) {
          this.currentUri = this.pendingUri;
          this.pendingUri = undefined;
          this.sendNoteToWebview();
        } else {
          this.updateForEditor(vscode.window.activeTextEditor);
        }
      }
    }, undefined, this.disposables);

    // Use pending URI if set (from showNoteForUri called before view was ready)
    if (this.pendingUri) {
      this.currentUri = this.pendingUri;
      this.pendingUri = undefined;
      this.sendNoteToWebview();
    } else {
      this.updateForEditor(vscode.window.activeTextEditor);
    }
  }

  /** Allow external callers (e.g., tree view click, context menu) to set the target file */
  showNoteForUri(uri: vscode.Uri): void {
    this.currentUri = uri;
    if (this.view) {
      this.sendNoteToWebview();
    } else {
      // View not resolved yet — store for when it becomes available
      this.pendingUri = uri;
    }
  }

  private updateForEditor(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.uri.scheme !== 'file') {
      this.currentUri = undefined;
      this.view?.webview.postMessage({
        type: 'update',
        filePath: null,
        note: '',
        hasMarker: false,
        markerLabel: '',
        markerBadge: '',
      });
      return;
    }
    this.currentUri = editor.document.uri;
    this.sendNoteToWebview();
  }

  private sendNoteToWebview(): void {
    if (!this.view || !this.currentUri) {
      return;
    }

    const note = this.noteStorage.getNote(this.currentUri) || '';
    const markerId = this.markerStorage.getMarker(this.currentUri);
    const markerType = markerId ? this.markerStorage.getMarkerType(markerId) : undefined;
    const filePath = vscode.workspace.asRelativePath(this.currentUri);

    this.view.webview.postMessage({
      type: 'update',
      filePath,
      note,
      hasMarker: !!markerId,
      markerLabel: markerType?.label || '',
      markerBadge: markerType?.badge || '',
    });
  }

  private getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    body {
      padding: 8px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    .file-path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
      word-break: break-all;
    }
    .marker-badge {
      display: inline-block;
      margin-right: 4px;
      font-size: 11px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .no-file {
      color: var(--vscode-disabledForeground);
      font-style: italic;
      text-align: center;
      margin-top: 20px;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      resize: vertical;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      padding: 6px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      box-sizing: border-box;
    }
    textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }
    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
    }
    .char-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .char-count.over-limit {
      color: var(--vscode-errorForeground);
    }
    .buttons { display: flex; gap: 4px; }
    button {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 10px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button.primary:hover { background: var(--vscode-button-hoverBackground); }
    .content { display: block; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div id="no-file" class="no-file">No file selected</div>
  <div id="content" class="hidden">
    <div class="file-path">
      <span id="marker-info"></span>
      <span id="file-path"></span>
    </div>
    <textarea id="note-input" maxlength="500"
      placeholder="Add a note for this file..."></textarea>
    <div class="controls">
      <span id="char-count" class="char-count">0 / 500</span>
      <div class="buttons">
        <button id="clear-btn">Clear</button>
        <button id="save-btn" class="primary">Save</button>
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const noteInput = document.getElementById('note-input');
    const charCount = document.getElementById('char-count');
    const saveBtn = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');
    const filePathEl = document.getElementById('file-path');
    const markerInfo = document.getElementById('marker-info');
    const contentEl = document.getElementById('content');
    const noFileEl = document.getElementById('no-file');
    let currentFilePath = null;

    noteInput.addEventListener('input', () => {
      const len = noteInput.value.length;
      charCount.textContent = len + ' / 500';
      charCount.className = len >= 500 ? 'char-count over-limit' : 'char-count';
    });

    saveBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'save', text: noteInput.value });
    });

    clearBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'clear' });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'update') {
        if (!msg.filePath) {
          contentEl.className = 'hidden';
          noFileEl.className = 'no-file';
          currentFilePath = null;
          return;
        }
        contentEl.className = 'content';
        noFileEl.className = 'hidden';
        filePathEl.textContent = msg.filePath;
        markerInfo.innerHTML = msg.hasMarker
          ? '<span class="marker-badge">' + escapeHtml(msg.markerBadge) +
            ' ' + escapeHtml(msg.markerLabel) + '</span>'
          : '';
        // Always reset textarea when switching files or on external update
        noteInput.value = msg.note;
        currentFilePath = msg.filePath;
        const len = noteInput.value.length;
        charCount.textContent = len + ' / 500';
        charCount.className = len >= 500 ? 'char-count over-limit' : 'char-count';
      }
    });

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
  </script>
</body>
</html>`;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
