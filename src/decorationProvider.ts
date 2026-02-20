import * as vscode from 'vscode';
import { MarkerStorage, FALLBACK_MARKER } from './storage';
import { NoteStorage } from './noteStorage';

/**
 * Color for inherited markers (grayed out)
 */
const INHERITED_MARKER_COLOR = new vscode.ThemeColor('disabledForeground');

/**
 * Badge for files with line highlights (when no file marker is present)
 */
const LINE_HIGHLIGHT_BADGE = '≡';

/**
 * Badge for files with notes only (no marker, no line highlights)
 */
const NOTE_BADGE = 'N';

export class MarkerDecorationProvider
  implements vscode.FileDecorationProvider, vscode.Disposable
{
  private disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeFileDecorations =
    new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(
    private readonly storage: MarkerStorage,
    private readonly noteStorage: NoteStorage
  ) {
    this.disposables.push(
      storage.onDidChangeMarkers(() => {
        // When inheritance is enabled, any marker change could affect children
        // so we refresh all decorations. When disabled, we could optimize
        // but refreshing all is simpler and still fast enough.
        this.refresh();
      })
    );

    // Listen for line highlight changes
    this.disposables.push(
      storage.onDidChangeLineHighlights(() => {
        this.refresh();
      })
    );

    // Listen for note changes — refresh only the affected file when possible
    this.disposables.push(
      noteStorage.onDidChangeNotes(({ uri }) => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder && uri.toString() === workspaceFolder.uri.toString()) {
          // External file reload — could affect many notes, refresh all
          this.refresh();
        } else {
          // Individual note change — refresh only that file
          this._onDidChangeFileDecorations.fire(uri);
        }
      })
    );

    // Listen for configuration changes to refresh all decorations
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (
          event.affectsConfiguration('fileMarkers.enabled') ||
          event.affectsConfiguration('fileMarkers.inheritFolderMarkers')
        ) {
          this.refresh();
        }
      })
    );
  }

  provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    // Check if extension is enabled
    const config = vscode.workspace.getConfiguration('fileMarkers');
    if (!config.get<boolean>('enabled', true)) {
      return undefined;
    }

    // Check for file marker
    const effective = this.storage.getEffectiveMarker(uri);
    const hasLineHighlights = this.storage.hasLineHighlights(uri);
    const note = this.noteStorage.getNote(uri);

    // If no marker, no line highlights, and no note, return nothing
    if (!effective && !hasLineHighlights && !note) {
      return undefined;
    }

    // Note-only files (no marker, no highlights)
    if (!effective && !hasLineHighlights && note) {
      const notePreview = note.length > 100 ? note.substring(0, 97) + '...' : note;
      return {
        badge: NOTE_BADGE,
        color: new vscode.ThemeColor('descriptionForeground'),
        tooltip: `Note: ${notePreview}`,
        propagate: false,
      };
    }

    // Build decoration based on what we have
    if (effective) {
      // Has file marker (may also have line highlights and/or notes)
      const { markerId, inherited } = effective;
      const marker = this.storage.getMarkerType(markerId);
      const isUnknown = marker.id === FALLBACK_MARKER.id;

      // Use grayed color for inherited markers, normal color for direct markers
      let color: vscode.ThemeColor | undefined;
      if (isUnknown) {
        color = undefined;
      } else if (inherited) {
        color = INHERITED_MARKER_COLOR;
      } else {
        color = marker.color;
      }

      // Build tooltip
      let tooltip: string;
      if (isUnknown) {
        tooltip = `Unknown marker type: "${markerId}"`;
      } else if (inherited) {
        tooltip = `File Marker: ${marker.label} (inherited from folder)`;
      } else {
        tooltip = `File Marker: ${marker.label}`;
      }

      // Build badge - append line highlight indicator if present and space allows
      let badge = marker.badge;
      if (hasLineHighlights) {
        tooltip = `${tooltip} | Has line highlights`;
        // VSCode badges are max 2 chars, append indicator if we have room
        if (badge.length < 2) {
          badge = badge + LINE_HIGHLIGHT_BADGE;
        }
      }

      // Append note to tooltip
      if (note) {
        const notePreview = note.length > 100 ? note.substring(0, 97) + '...' : note;
        tooltip = `${tooltip}\n---\nNote: ${notePreview}`;
      }

      return {
        badge,
        color,
        tooltip,
        propagate: false,
      };
    } else {
      // Only line highlights (possibly with note), no file marker
      let tooltip = 'Has line highlights';
      if (note) {
        const notePreview = note.length > 100 ? note.substring(0, 97) + '...' : note;
        tooltip = `${tooltip}\n---\nNote: ${notePreview}`;
      }

      return {
        badge: LINE_HIGHLIGHT_BADGE,
        color: new vscode.ThemeColor('editorInfo.foreground'),
        tooltip,
        propagate: false,
      };
    }
  }

  refresh(): void {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
