import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('joneldominic-dev.file-markers');
    assert.ok(extension, 'Extension should be installed');
  });

  test('Extension should activate', async function() {
    this.timeout(10000);

    const extension = vscode.extensions.getExtension('joneldominic-dev.file-markers');
    if (!extension) {
      this.skip();
      return;
    }

    await extension.activate();
    assert.strictEqual(extension.isActive, true);
  });

  test('Commands should be registered', async function() {
    this.timeout(10000);

    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes('file-markers.setMarker'), 'setMarker command should exist');
    assert.ok(commands.includes('file-markers.removeMarker'), 'removeMarker command should exist');
    assert.ok(commands.includes('file-markers.removeMarkersInFolder'), 'removeMarkersInFolder command should exist');
    assert.ok(commands.includes('file-markers.removeAllMarkers'), 'removeAllMarkers command should exist');
    assert.ok(commands.includes('file-markers.toggleMarker'), 'toggleMarker command should exist');
    assert.ok(commands.includes('file-markers.openConfig'), 'openConfig command should exist');
    assert.ok(commands.includes('file-markers.showMarkerStats'), 'showMarkerStats command should exist');
    assert.ok(commands.includes('file-markers.toggleEnabled'), 'toggleEnabled command should exist');
  });
});
