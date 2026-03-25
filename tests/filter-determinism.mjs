import assert from 'node:assert/strict';
import { filterImages, selectForSlots } from '../src/utils/filter.js';

const manifest = [
  { id: 'a', tally: 'Subtle Dreamlike, Studio Photography, Glossy Perfect' },
  { id: 'b', tally: 'Obvious Fantasy, Studio Photography, Glossy Perfect' },
  { id: 'c', tally: 'Neon Vibrant, Enhanced Beauty, Heavy Noise Texture' },
  { id: 'd', tally: 'High-Contrast, Artistic Interpretation, Matte Smooth' },
];

function ids(arr) {
  return arr.map(item => item.id);
}

// main-level filtering should be deterministic and narrow to descendants
const byMain = filterImages(manifest, 0, {
  main: 'Dreamlike & Surreal',
  sub: null,
  subsub: null,
});
assert.deepEqual(ids(byMain), ['a', 'b']);

// sub-level filtering should not widen to full manifest on unknown sub
const byUnknownSub = filterImages(manifest, 0, {
  main: 'Dreamlike & Surreal',
  sub: 'Unknown Sub',
  subsub: null,
});
assert.equal(byUnknownSub.length, 0);

// completely unresolved state should fail closed
const unresolved = filterImages(manifest, 0, {
  main: null,
  sub: null,
  subsub: null,
});
assert.equal(unresolved.length, 0);

// seeded selection must be repeatable
const selectionSource = filterImages(manifest, 0, {
  main: 'Dreamlike & Surreal',
  sub: null,
  subsub: null,
});
const seed = '0:Dreamlike & Surreal:null:null';
const s1 = ids(selectForSlots(selectionSource, 2, seed));
const s2 = ids(selectForSlots(selectionSource, 2, seed));
assert.deepEqual(s1, s2);

console.log('filter-determinism: ok');
