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
