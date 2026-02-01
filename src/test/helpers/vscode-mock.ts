import * as vscode from 'vscode';

/**
 * Creates a mock Uri for testing
 */
export function createMockUri(path: string): vscode.Uri {
  return vscode.Uri.file(path);
}

/**
 * Creates a mock workspace folder
 */
export function createMockWorkspaceFolder(path: string, name: string = 'test-workspace'): vscode.WorkspaceFolder {
  return {
    uri: vscode.Uri.file(path),
    name,
    index: 0
  };
}
