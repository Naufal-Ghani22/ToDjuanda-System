import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLod } from '../src/lod.js';

test('selects visual detail from orthographic camera zoom', () => {
  assert.equal(resolveLod(0.3), 'block');
  assert.equal(resolveLod(0.7), 'mass');
  assert.equal(resolveLod(1.2), 'detail');
});
