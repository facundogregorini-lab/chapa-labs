const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));

test('el diálogo del 5483 observa una caída sin reconectar, desvincular ni ofrecer QR', {
  skip: !chrome && 'Chrome no está instalado; la protección del servidor se prueba en Turnia',
  timeout: 40000,
}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'chapa-voice-connection-'));
  try {
    const source = readFileSync(join(__dirname, '../prospecting/voice.js'), 'utf8');
    const html = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="connect-src 'none'">
      <button data-voice-open>Abrir audios</button><pre id="result">pending</pre><script>
      const calls = [], errors = [], statuses = ['FAILED', 'STARTING', 'SCAN_QR_CODE', 'STOPPED', 'WORKING', 'FAILED'];
      let reads = 0;
      window.addEventListener('error', (e) => errors.push(e.message));
      window.open = () => window;
      window.fetch = async (input, init = {}) => {
        const url = new URL(input);
        calls.push({ method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
        const status = statuses[Math.min(reads++, statuses.length - 1)];
        const data = url.searchParams.get('view') === 'connection'
          ? { status, ready: status === 'WORKING', hasAccount: true, qr: null }
          : { ready: false, channelStatus: 'FAILED', sender: null, senderOptions: ['5483', '0022'],
              remaining: 20, used: 0, notes: [], people: [],
              rules: { dailyLimit: 20, batchSize: 5, pauseMinMinutes: 3, pauseMaxMinutes: 6 },
              stage: { textOnly: false, needsSender: true, defaultText: '', panelTemplates: [], link: 'optional' } };
        return { ok: true, status: 200, json: async () => data };
      };
      </script><script>${source}</script><script>
      document.querySelector('[data-voice-open]').click();
      document.querySelector('[data-authorize]').click();
      window.dispatchEvent(new MessageEvent('message', { origin: 'https://turniasalud.app', source: window,
        data: { type: 'turnia-prospecting-voice', token: 'test-only-no-real-access' } }));
      setTimeout(() => {
        const result = { calls, errors, reads,
          reconnectButton: !!document.querySelector('[data-reconnect]'),
          qr: !!document.querySelector('[data-connection-qr]'),
          sendDisabled: document.querySelector('[data-send]').disabled };
        document.getElementById('result').textContent = JSON.stringify(result);
        document.querySelector('dialog').close();
      }, 105000);
      </script>`;
    const fixture = join(dir, 'connection.html');
    writeFileSync(fixture, html);
    const run = spawnSync(chrome, ['--headless=new', '--no-sandbox', '--no-first-run',
      '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions',
      '--host-resolver-rules=MAP * ~NOTFOUND', `--user-data-dir=${join(dir, 'profile')}`,
      '--dump-dom', '--virtual-time-budget=110000', pathToFileURL(fixture).href],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
    assert.equal(run.status, 0, run.error?.message || run.stderr.slice(-1000));
    const output = run.stdout.match(/<pre id="result">(.*?)<\/pre>/s)?.[1];
    assert.ok(output && output !== 'pending', 'el recorrido de autorización y consulta debe terminar');
    const result = JSON.parse(output.replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    assert.deepEqual(result.errors, []);
    assert.ok(result.reads >= 6, 'se observan varios estados y ciclos, sin quedarse solo en la carga inicial');
    assert.deepEqual(result.calls.filter((c) => c.method !== 'GET'), [], 'ninguna consulta debe mutar una sesión');
    assert.equal(result.reconnectButton, false);
    assert.equal(result.qr, false);
    assert.equal(result.sendDisabled, true);
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
