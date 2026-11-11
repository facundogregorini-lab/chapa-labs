'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('../prospecting/followup.js');
const app = fs.readFileSync(path.join(__dirname, '../prospecting/app.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../api/prospecting.js'), 'utf8');

test('A timeout never replaces a previously verified Habita catalog with empty rules', () => {
  const valid = {
    habita: {
      summary: { ready: 5 }, queue: [{ agencyId: 'a1', stage: 'no-responde', action: 'principal' }],
      rules: [{ key: 'r1', stage: 'no-responde', action: 'principal' }], stages: [],
    },
  };
  const next = F.mergeUnits(valid, { habita: { error: 'habita. no respondió a tiempo.' } });
  assert.equal(next.habita.rules.length, 1);
  assert.equal(next.habita.__freshness.stale, true);
  assert.match(F.normalize(next).errors.habita, /datos anteriores/i);
  assert.equal(F.normalize(next).queue.length, 1);
});

test('A first failed read is explicitly an error and never a fabricated empty business', () => {
  const next = F.mergeUnits({}, { habita: { error: 'Timeout' } });
  const n = F.normalize(next);
  assert.equal(n.units.habita, undefined);
  assert.equal(n.errors.habita, 'Timeout');
});

test('A successful update replaces stale data and clears the warning', () => {
  const old = { habita: { rules: [{ key: 'old' }], __warning: 'offline' } };
  const current = { habita: { rules: [{ key: 'new' }], queue: [], stages: [] } };
  const n = F.normalize(F.mergeUnits(old, current));
  assert.equal(n.errors.habita, undefined);
  assert.equal(n.units.habita.rules[0].key, 'new');
});

test('The browser requests only the open business and lazily loads legacy data', () => {
  assert.doesNotThrow(() => new vm.Script(app));
  assert.match(app, /unit: scope, periodo: period\.preset/);
  assert.match(app, /if \(state\.demo \|\| !state\.session \|\| !state\.session\.user \|\| isFu\(\) \|\| state\.view===\x27script\x27\) return/);
  assert.match(app, /followup-unavailable/);
  assert.match(app, /REINTENTAR CONEXIÓN/);
  assert.match(app, /F\.mergeUnits\(prior, response\.units\)/);
  assert.match(server, /followupCache\.get\(cacheKey/);
  assert.match(server, /followupCache\.invalidate\(unit\.id \+ '\|'/);
  assert.match(server, /Server-Timing/);
});
