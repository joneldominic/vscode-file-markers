import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Enabled Setting Tests', () => {
  const getConfig = () => vscode.workspace.getConfiguration('fileMarkers');
  const hasWorkspace = () => vscode.workspace.workspaceFolders !== undefined && vscode.workspace.workspaceFolders.length > 0;

  test('enabled setting defaults to true', () => {
    const config = getConfig();
    const enabled = config.get<boolean>('enabled');
    assert.strictEqual(enabled, true);
  });

  test('toggle command flips enabled state', async function() {
    // Skip if no workspace is open (toggle command writes to workspace settings)
    if (!hasWorkspace()) {
      this.skip();
      return;
    }

    const config = getConfig();
    const initialValue = config.get<boolean>('enabled', true);

    await vscode.commands.executeCommand('file-markers.toggleEnabled');

    // Need to re-fetch config after change
    const updatedConfig = getConfig();
    assert.strictEqual(updatedConfig.get<boolean>('enabled'), !initialValue);

    // Reset to original value
    await updatedConfig.update('enabled', initialValue, vscode.ConfigurationTarget.Workspace);
  });

  test('toggle command flips back to enabled', async function() {
    // Skip if no workspace is open (toggle command writes to workspace settings)
    if (!hasWorkspace()) {
      this.skip();
      return;
    }

    const config = getConfig();
    await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

    await vscode.commands.executeCommand('file-markers.toggleEnabled');

    const updatedConfig = getConfig();
    assert.strictEqual(updatedConfig.get<boolean>('enabled'), true);
  });
});
