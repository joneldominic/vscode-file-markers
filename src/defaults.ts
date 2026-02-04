import { MarkerTypeConfig, LineHighlightTypeConfig } from './types';

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

/**
 * Default line highlight types used when creating new storage file
 */
export const DEFAULT_LINE_HIGHLIGHT_TYPES: LineHighlightTypeConfig[] = [
  {
    id: 'highlight-yellow',
    color: 'rgba(255, 235, 59, 0.3)',
    label: 'Yellow Highlight',
  },
  {
    id: 'highlight-green',
    color: 'rgba(76, 175, 80, 0.3)',
    label: 'Green Highlight',
  },
  {
    id: 'highlight-blue',
    color: 'rgba(33, 150, 243, 0.3)',
    label: 'Blue Highlight',
  },
  {
    id: 'highlight-red',
    color: 'rgba(244, 67, 54, 0.3)',
    label: 'Red Highlight',
  },
  {
    id: 'highlight-purple',
    color: 'rgba(156, 39, 176, 0.3)',
    label: 'Purple Highlight',
  },
];
