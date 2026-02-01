import * as assert from 'assert';
import { DEFAULT_MARKER_TYPES } from '../defaults';

suite('Defaults Test Suite', () => {
  test('should have 6 default marker types', () => {
    assert.strictEqual(DEFAULT_MARKER_TYPES.length, 6);
  });

  test('each marker type should have required properties', () => {
    for (const marker of DEFAULT_MARKER_TYPES) {
      assert.ok(marker.id, `Marker should have id`);
      assert.ok(marker.badge, `Marker ${marker.id} should have badge`);
      assert.ok(marker.color, `Marker ${marker.id} should have color`);
      assert.ok(marker.label, `Marker ${marker.id} should have label`);
    }
  });

  test('should include expected marker IDs', () => {
    const ids = DEFAULT_MARKER_TYPES.map(m => m.id);

    assert.ok(ids.includes('done'), 'Should have "done" marker');
    assert.ok(ids.includes('in-progress'), 'Should have "in-progress" marker');
    assert.ok(ids.includes('pending'), 'Should have "pending" marker');
    assert.ok(ids.includes('important'), 'Should have "important" marker');
    assert.ok(ids.includes('review'), 'Should have "review" marker');
    assert.ok(ids.includes('question'), 'Should have "question" marker');
  });

  test('badge should be 1-2 characters', () => {
    for (const marker of DEFAULT_MARKER_TYPES) {
      assert.ok(
        marker.badge.length >= 1 && marker.badge.length <= 2,
        `Marker ${marker.id} badge should be 1-2 chars, got ${marker.badge.length}`
      );
    }
  });

  test('each marker should have a valid theme color', () => {
    for (const marker of DEFAULT_MARKER_TYPES) {
      assert.ok(
        typeof marker.color === 'string' && marker.color.length > 0,
        `Marker ${marker.id} should have a color string`
      );
    }
  });

  test('marker IDs should be unique', () => {
    const ids = DEFAULT_MARKER_TYPES.map(m => m.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'All marker IDs should be unique');
  });
});
