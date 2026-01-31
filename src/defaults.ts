import { MarkerTypeConfig } from './types';

/**
 * Default marker types used when creating new storage file
 */
export const DEFAULT_MARKER_TYPES: MarkerTypeConfig[] = [
  {
    id: 'done',
    badge: '✓',
    color: 'gitDecoration.addedResourceForeground',
    label: 'Done',
  },
  {
    id: 'in-progress',
    badge: '◐',
    color: 'gitDecoration.modifiedResourceForeground',
    label: 'In Progress',
  },
  {
    id: 'pending',
    badge: '○',
    color: 'gitDecoration.deletedResourceForeground',
    label: 'Pending',
  },
  {
    id: 'important',
    badge: '★',
    color: 'editorWarning.foreground',
    label: 'Important',
  },
  {
    id: 'review',
    badge: '◉',
    color: 'editorInfo.foreground',
    label: 'Needs Review',
  },
  {
    id: 'question',
    badge: '?',
    color: 'editorHint.foreground',
    label: 'Question',
  },
];
