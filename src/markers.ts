import * as vscode from 'vscode';
import { MarkerType } from './types';

/**
 * Default marker types shipped with the extension
 * Colors use VSCode theme colors for consistency
 */
export const DEFAULT_MARKERS: readonly MarkerType[] = [
  {
    id: 'done',
    badge: '✓',
    color: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
    label: 'Done',
    sortOrder: 1,
  },
  {
    id: 'in-progress',
    badge: '◐',
    color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
    label: 'In Progress',
    sortOrder: 2,
  },
  {
    id: 'pending',
    badge: '○',
    color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
    label: 'Pending',
    sortOrder: 3,
  },
  {
    id: 'important',
    badge: '★',
    color: new vscode.ThemeColor('editorWarning.foreground'),
    label: 'Important',
    sortOrder: 4,
  },
  {
    id: 'review',
    badge: '◉',
    color: new vscode.ThemeColor('editorInfo.foreground'),
    label: 'Needs Review',
    sortOrder: 5,
  },
  {
    id: 'question',
    badge: '?',
    color: new vscode.ThemeColor('editorHint.foreground'),
    label: 'Question',
    sortOrder: 6,
  },
] as const;

/**
 * Get a marker type by ID
 */
export function getMarkerById(id: string): MarkerType | undefined {
  return DEFAULT_MARKERS.find(m => m.id === id);
}
