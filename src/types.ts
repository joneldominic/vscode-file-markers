import * as vscode from 'vscode';

/**
 * Marker type definition as stored in config file
 */
export interface MarkerTypeConfig {
  id: string;
  badge: string;
  color: string; // Theme color ID (e.g., "gitDecoration.addedResourceForeground")
  label: string;
}

/**
 * Runtime marker type with resolved color
 */
export interface MarkerType {
  id: string;
  badge: string;
  color: vscode.ThemeColor;
  label: string;
}

/**
 * Storage format - includes marker type definitions
 */
export interface MarkerStorageData {
  markerTypes: MarkerTypeConfig[];
  markers: Record<string, string>; // relativePath -> markerId
}

/**
 * Event fired when markers change
 */
export interface MarkerChangeEvent {
  uri: vscode.Uri;
  markerId: string | undefined;
}

/**
 * Line highlight configuration (stored in config)
 */
export interface LineHighlightTypeConfig {
  id: string;
  color: string; // CSS color or theme color reference
  label: string;
}

/**
 * Runtime line highlight type with resolved color
 */
export interface LineHighlightType {
  id: string;
  color: string;
  label: string;
}

/**
 * A single line highlight range
 */
export interface LineHighlight {
  startLine: number; // 1-indexed (user-facing)
  endLine: number; // 1-indexed, inclusive
  typeId: string;
}

/**
 * Line highlights for a single file
 */
export interface FileLineHighlights {
  highlights: LineHighlight[];
}

/**
 * Extended storage format (backward compatible)
 */
export interface MarkerStorageDataV2 {
  markerTypes: MarkerTypeConfig[];
  markers: Record<string, string>;
  // New fields for line highlights
  lineHighlightTypes?: LineHighlightTypeConfig[];
  lineHighlights?: Record<string, LineHighlight[]>; // relativePath -> highlights
}

/** Storage format for file notes (separate file) */
export interface NoteStorageData {
  notes: Record<string, string>; // relativePath -> note text
}
