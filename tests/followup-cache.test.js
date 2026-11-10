'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFollowupCache } = require('../api/_followup-cache.js');

test('concurrent requests share one product API read; following reads use warm cache', async () => {
  let t = 1000, calls = 0;
  const cache = createFollowupCache({ now: () => t, freshMs: 25_000 });
  const load = async () => { calls++; return { queue: [1] }; };
  const [a, b] = await Promise.all([cache.get('habita|todo', load), cache.get('habita|todo', load)]);
  assert.equal(calls, 1);
  assert.deepEqual(a.data, b.data);
  assert.equal((await cache.get('habita|todo', load)).source, 'fresh');
  assert.equal(calls, 1);
});

test('a changed business invalidates cached queue and cannot be resurrected by an older read', async () => {
  let resolveOld;
  let t = 1000;
  const cache = createFollowupCache({ now: () => t });
  const old = cache.get('habita|todo', () => new Promise(resolve => { resolveOld = resolve; }));
  await Promise.resolve();
  cache.invalidate('habita|');
  const fresh = await cache.get('habita|todo', async () => ({ rules: ['new'] }));
  resolveOld({ rules: ['old'] });
  await old;
  assert.deepEqual((await cache.get('habita|todo', async () => { throw Error('should not fetch'); })).data, fresh.data);
});

test('temporary timeout falls back only to recently known real data, never an invented empty queue', async () => {
  let t = 1000;
  const cache = createFollowupCache({ now: () => t, freshMs: 1000, staleMs: 6000 });
  await cache.get('habita|todo', async () => ({ rules: ['real'] }));
  t += 2000;
  const fallback = await cache.get('habita|todo', async () => { throw Error('habita. no respondió a tiempo.'); });
  assert.equal(fallback.source, 'stale');
  assert.deepEqual(fallback.data.rules, ['real']);
  assert.match(fallback.warning, /tiempo/);
  t += 7000;
  await assert.rejects(cache.get('habita|todo', async () => { throw Error('offline'); }), /offline/);
});

test('first request failure does not cache an empty result', async () => {
  const cache = createFollowupCache();
  await assert.rejects(cache.get('habita|todo', async () => { throw Error('down'); }), /down/);
  const next = await cache.get('habita|todo', async () => ({ rules: [1] }));
  assert.deepEqual(next.data.rules, [1]);
});
