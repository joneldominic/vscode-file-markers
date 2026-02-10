---
date: 2026-02-03T15:19:28+0000
researcher: Claude
git_commit: d50691bf8dc863d04549a912fd86c3c750ea6281
branch: fix/file-toggle-marker
repository: file-marker-vsx
topic: 'Fix Toggle Marker Configuration Bug'
tags: [bugfix, toggle-marker, configuration]
status: in-progress
last_updated: 2026-02-03
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: Fix Toggle Marker Not Using Configuration

## Task(s)

**Bug Fix**: The `toggleMarker` command was using hardcoded marker IDs (`['done', 'in-progress', 'pending']`) instead of cycling through all configured marker types from `.vscode/file-markers.json`.

**Status**:
- ✅ Core fix implemented - toggle now uses `storage.getAllMarkerTypes()`
- ✅ Config reload fix - added `onDidSaveTextDocument` listener for reliable config detection
- ✅ Tests added for new behavior
- ⚠️ Tests are flaky due to timing issues (sometimes pass, sometimes fail)

**Plan Document**: `thoughts/shared/plans/2026-02-03-fix-toggle-marker-config.md`

## Critical References

- `thoughts/shared/plans/2026-02-03-fix-toggle-marker-config.md` - Implementation plan
- `CLAUDE.md` - Project architecture and conventions

## Recent changes

1. `src/commands.ts:161-212` - Replaced hardcoded cycle with `storage.getAllMarkerTypes().map(m => m.id)`
2. `src/storage.ts:68-77` - Added `onDidSaveTextDocument` listener to detect config file saves within VSCode
3. `src/test/commands.test.ts` - Added tests for cycling through all markers and unknown marker removal
4. `src/test/storage.test.ts` - Added tests for marker type ordering
5. `.vscode-test.mjs` - Added `workspaceFolder: './test-workspace'` for test isolation

## Learnings

1. **Test isolation is critical**: Tests share the same config file in the workspace. Added `cleanupConfigFile()` helper in setup/teardown to delete `.vscode/file-markers.json` between tests.

2. **Extension storage vs test storage**: Command tests were failing because they used a separate `MarkerStorage` instance from the extension's storage. Fixed by checking the config file directly instead of the test's storage instance.

3. **Config reload requires editor save**: The extension's storage only reloads when:
   - `onDidSaveTextDocument` fires (document saved in VSCode editor)
   - File system watcher fires (external changes)

   Writing with `vscode.workspace.fs.writeFile()` does NOT trigger reload. Must open file in editor and save to trigger.

4. **Tests are timing-sensitive**: Async operations (debounced saves, config reload) need adequate wait times. Current waits of 200-300ms are sometimes not enough.

## Artifacts

- `thoughts/shared/plans/2026-02-03-fix-toggle-marker-config.md` - Implementation plan (all automated criteria checked)
- `src/commands.ts:161-212` - Fixed toggle command
- `src/storage.ts:68-77` - Config reload listener
- `src/test/commands.test.ts:164-244` - Toggle cycle test
- `src/test/commands.test.ts:246-310` - Unknown marker test
- `src/test/storage.test.ts:90-150` - Marker type ordering tests
- `test-workspace/` - Test workspace directory for test isolation

## Action Items & Next Steps

1. **Stabilize flaky tests**: Increase wait times or add retry logic. Tests sometimes fail with timing issues:
   - `cycles through all configured marker types` - sometimes markers don't persist in time
   - `removes marker from single file` - sometimes remove doesn't complete before assertion
   - `removes unknown marker type on toggle` - similar timing issue

2. **Run tests multiple times** to verify stability: `for i in 1 2 3; do pnpm test; done`

3. **Once tests are stable**, commit the changes with message like:
   ```
   fix: toggle marker now cycles through all configured marker types

   - Replace hardcoded ['done', 'in-progress', 'pending'] with storage.getAllMarkerTypes()
   - Add onDidSaveTextDocument listener for reliable config reload
   - Add comprehensive tests for toggle cycle behavior
   ```

4. **Update plan checkboxes** if manual verification is complete

## Other Notes

- The only intentionally skipped test is `showStats executes without error` in `statusBar.test.ts:76` because it opens a QuickPick that requires user interaction

- Key behavior changes:
  - Toggle now cycles through ALL 6 default markers: done → in-progress → pending → important → review → question → remove
  - Users can customize cycle order by reordering `markerTypes` array in config
  - Unknown markers (removed from config) are removed on toggle

- The save conflict issue (VSCode showing "content is newer" dialog) was discussed but user decided it's an edge case that users can handle by clicking "Overwrite"
