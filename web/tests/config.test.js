import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOOR_HEIGHT, FLOORS, VISUAL_HEIGHT } from '../src/config.js';

test('defines stacked Ground Floor and First Floor assets', () => {
  assert.equal(FLOOR_HEIGHT, 3.2);
  assert.equal(VISUAL_HEIGHT, 0.5);
  assert.deepEqual(FLOORS, [
    { id: 'GF', label: 'Ground Floor', elevation: 0, asset: 'T1-GF-Area.svg' },
    { id: 'FF', label: 'First Floor', elevation: 3.2, asset: 'T1-FF-Area.svg' },
  ]);
});
