import * as vscode from 'vscode';

/**
 * Defines a marker type that can be applied to files/folders
 */
export interface MarkerType {
  id: string;
  badge: string;
  color: vscode.ThemeColor;
  label: string;
  sortOrder: number;
}

/**
 * Storage format for persisted markers
 */
export interface MarkerStorageData {
  version: number;
  markers: Record<string, string>; // relativePath -> markerId
}

/**
 * Event fired when markers change
 */
export interface MarkerChangeEvent {
  uri: vscode.Uri;
  markerId: string | undefined;
}
