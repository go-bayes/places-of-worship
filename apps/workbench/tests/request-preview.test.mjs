import assert from 'node:assert/strict';
import test from 'node:test';
import { savePreview } from '../src/concepts/requestPreview.ts';

const input = { kind: 'assistance', label: 'Example Chapel', question: 'Find the first service.', context: 'demo:place-1:version-3' };
const requests = Array.from({ length: 100 }, (_, i) => ({ ...input, id: `receipt-${i}`, question: `Question ${i}`, createdAt: '2026-09-18T00:00:00Z' }));

test('an identical retry at capacity returns the original receipt and history', () => {
  const original = requests[42];
  const result = savePreview(requests, original, () => { throw new Error('must not create a new id'); });
  assert.equal(result.request, original);
  assert.equal(result.requests, requests);
});

test('a new request at capacity is refused before allocating an id', () => {
  assert.throws(() => savePreview(requests, input, () => { throw new Error('must not allocate'); }), /request limit/);
  assert.equal(requests.length, 100);
});

test('a changed evidence version creates a distinct request while keeping history', () => {
  const first = savePreview([], input, () => 'first');
  const second = savePreview(first.requests, { ...input, context: 'demo:place-1:version-4' }, () => 'second');
  assert.equal(second.requests.length, 2);
  assert.equal(second.requests[1], first.request);
  assert.equal(second.request.context, 'demo:place-1:version-4');
  assert.equal(first.requests.length, 1);
});
