'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'prospecting', 'app.js'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '..', 'api', 'prospecting.js'), 'utf8');

test('a tab opened with ?agente=1 is the extension: every Follow-up operation from it carries ejecutor=bot', () => {
  assert.match(app, /get\('agente'\)/);
  assert.match(app, /q === '1'\) sessionStorage\.setItem\(AGENT_KEY, '1'\)/);
  assert.match(app, /q === '0'\) sessionStorage\.removeItem\(AGENT_KEY\)/);
  assert.match(app, /followup: agentMode\(\) \? \{ \.\.\.followup, ejecutor: 'bot' \} : followup/);
  assert.match(app, /data-testid', 'agent-mode-banner'/);
  // Chapa passes the operation to habita or Turnia as it is, so the tag reaches the product.
  assert.match(api, /body: \{ by: user\.name, followup: f \}/);
});
