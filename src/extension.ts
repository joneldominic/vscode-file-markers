import * as vscode from 'vscode';
import { MarkerStorage } from './storage';
import { MarkerDecorationProvider } from './decorationProvider';
import { StatusBarManager } from './statusBar';
import { registerCommands } from './commands';

let storage: MarkerStorage | undefined;
let decorationProvider: MarkerDecorationProvider | undefined;
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

  // Initialize status bar
  statusBarManager = new StatusBarManager(storage);
  context.subscriptions.push(statusBarManager);

  // Register status bar command
  context.subscriptions.push(
    vscode.commands.registerCommand('file-markers.showMarkerStats', () => {
      statusBarManager?.showStats();
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
  statusBarManager = undefined;
}
