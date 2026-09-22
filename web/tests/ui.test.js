import test from 'node:test';
import assert from 'node:assert/strict';
import { formatContinuation } from '../src/ui.js';

test('formats the next-floor action with connector identity', () => {
  assert.equal(
    formatContinuation({ floor: 'GF', connectorId: 'Eskalator01', nextFloor: 'FF' }),
    'Lanjut ke First Floor via Eskalator01 →',
  );
});
