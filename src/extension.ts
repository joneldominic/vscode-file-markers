import * as vscode from 'vscode';
import { MarkerStorage } from './storage';
import { MarkerDecorationProvider } from './decorationProvider';
import { LineHighlightProvider } from './lineHighlightProvider';
import { StatusBarManager } from './statusBar';
import { registerCommands } from './commands';

let storage: MarkerStorage | undefined;
let decorationProvider: MarkerDecorationProvider | undefined;
let lineHighlightProvider: LineHighlightProvider | undefined;
let statusBarManager: StatusBarManager | undefined;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  console.log('File Markers extension is now active');

  // Initialize storage (includes marker type definitions)
  storage = new MarkerStorage();
  await storage.initialize();
  context.subscriptions.push(storage);

  // Initialize decoration provider
  decorationProvider = new MarkerDecorationProvider(storage);
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

  // Register other commands
  registerCommands(context, storage);

  // Refresh decorations after initialization
  decorationProvider.refresh();
}

export function deactivate(): void {
  storage = undefined;
  decorationProvider = undefined;
  lineHighlightProvider = undefined;
  statusBarManager = undefined;
}
