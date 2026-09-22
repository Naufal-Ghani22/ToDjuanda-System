import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyNode, parseEscalatorId, visualHeightForLayer } from '../src/svg-to-scene.js';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('ships both floor SVG assets for the Vite application', () => {
  assert.equal(existsSync(resolve(webRoot, 'assets/T1-GF-Area.svg')), true);
  assert.equal(existsSync(resolve(webRoot, 'assets/T1-FF-Area.svg')), true);
});

test('keeps unique escalator IDs and rejects Figma duplicate suffixes', () => {
  assert.deepEqual(parseEscalatorId('Eskalator14'), { id: 'Eskalator14', ambiguous: false });
  assert.deepEqual(parseEscalatorId('Eskalator14_2'), { id: 'Eskalator14', ambiguous: true });
  assert.equal(parseEscalatorId('Rectangle 14'), null);
});

test('classifies SVG routing node colours', () => {
  assert.equal(classifyNode('#F58231'), 'door');
  assert.equal(classifyNode('#FF3B30'), 'junction');
  assert.equal(classifyNode('#FFFFFF'), null);
});

test('keeps ordinary building masses at 0.5 and elevates walls to 0.9', () => {
  assert.equal(visualHeightForLayer('tenant'), 0.5);
  assert.equal(visualHeightForLayer('tembok_pilar'), 0.9);
  assert.equal(visualHeightForLayer('tembok_kaca'), 0.9);
});
