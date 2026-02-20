import * as vscode from 'vscode';
import { MarkerStorage } from './storage';
import { MarkerDecorationProvider } from './decorationProvider';
import { LineHighlightProvider } from './lineHighlightProvider';
import { StatusBarManager } from './statusBar';
import { registerCommands } from './commands';
import { NoteStorage } from './noteStorage';
import { NotesViewProvider } from './notesViewProvider';
import { NotedFilesTreeProvider } from './notedFilesTreeProvider';

let storage: MarkerStorage | undefined;
let decorationProvider: MarkerDecorationProvider | undefined;
let lineHighlightProvider: LineHighlightProvider | undefined;
let statusBarManager: StatusBarManager | undefined;
let noteStorage: NoteStorage | undefined;
let notesViewProvider: NotesViewProvider | undefined;
let notedFilesTreeProvider: NotedFilesTreeProvider | undefined;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  console.log('File Markers extension is now active');

  // Initialize storage (includes marker type definitions)
  storage = new MarkerStorage();
  await storage.initialize();
  context.subscriptions.push(storage);

  // Initialize note storage (separate file)
  noteStorage = new NoteStorage();
  await noteStorage.initialize();
  context.subscriptions.push(noteStorage);

  // Initialize decoration provider
  decorationProvider = new MarkerDecorationProvider(storage, noteStorage);
  context.subscriptions.push(decorationProvider);

  // Register decoration provider with VSCode
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider)
  );

  // Initialize line highlight provider
  lineHighlightProvider = new LineHighlightProvider(storage);
  context.subscriptions.push(lineHighlightProvider);

  // Initialize status bar
  statusBarManager = new StatusBarManager(storage);
  context.subscriptions.push(statusBarManager);

  // Initialize notes webview provider
  notesViewProvider = new NotesViewProvider(context.extensionUri, noteStorage, storage);
  context.subscriptions.push(notesViewProvider);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      NotesViewProvider.viewType,
      notesViewProvider
    )
  );

  // Initialize noted files tree provider
  notedFilesTreeProvider = new NotedFilesTreeProvider(noteStorage, storage);
  context.subscriptions.push(notedFilesTreeProvider);
  const notedFilesTreeView = vscode.window.createTreeView('fileMarkers.notedFiles', {
    treeDataProvider: notedFilesTreeProvider,
  });
  notedFilesTreeProvider.setTreeView(notedFilesTreeView);
  context.subscriptions.push(notedFilesTreeView);

  // Register status bar command
  context.subscriptions.push(
    vscode.commands.registerCommand('file-markers.showMarkerStats', () => {
      statusBarManager?.showStats();
    })
  );

  // Register toggle enabled command
  context.subscriptions.push(
    vscode.commands.registerCommand('file-markers.toggleEnabled', async () => {
      const config = vscode.workspace.getConfiguration('fileMarkers');
      const currentValue = config.get<boolean>('enabled', true);
      await config.update('enabled', !currentValue, vscode.ConfigurationTarget.Workspace);

      const newState = !currentValue ? 'enabled' : 'disabled';
      vscode.window.showInformationMessage(`File Markers ${newState}.`);
    })
  );

  // Register noted file commands (tree view)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.openNotedFile',
      async (uri: vscode.Uri) => {
        await vscode.window.showTextDocument(uri, { preview: false });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.revealNotedFile',
      (item: { fileUri: vscode.Uri }) => {
        if (item?.fileUri) {
          vscode.commands.executeCommand('revealInExplorer', item.fileUri);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.removeNoteFromTree',
      async (item: { fileUri: vscode.Uri }) => {
        if (!item?.fileUri || !noteStorage) {
          return;
        }
        const fileName = vscode.workspace.asRelativePath(item.fileUri);
        const confirm = await vscode.window.showWarningMessage(
          `Remove note from "${fileName}"?`,
          { modal: true },
          'Remove'
        );
        if (confirm === 'Remove') {
          noteStorage.removeNote(item.fileUri);
        }
      }
    )
  );

  // Register Add/Edit Note command (needs notesViewProvider)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'file-markers.setNote',
      async (uri: vscode.Uri) => {
        if (!uri || !notesViewProvider) {
          return;
        }
        notesViewProvider.showNoteForUri(uri);
        await vscode.commands.executeCommand('fileMarkers.noteEditor.focus');
      }
    )
  );

  // Register other commands
  registerCommands(context, storage, noteStorage);

  // Refresh decorations after initialization
  decorationProvider.refresh();
}

export function deactivate(): void {
  storage = undefined;
  decorationProvider = undefined;
  lineHighlightProvider = undefined;
  statusBarManager = undefined;
  noteStorage = undefined;
  notesViewProvider = undefined;
  notedFilesTreeProvider = undefined;
}
