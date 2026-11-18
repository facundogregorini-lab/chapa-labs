const test = require('node:test');
const assert = require('node:assert');
const Pool = require('../prospecting/pool-view.js');

// Datos sintéticos, con la forma de GET /api/prospeccion?vista=prospectos de habita.
const catalog = {
  groups: [{ key: 'cartera', label: 'Cartera' }, { key: 'visual', label: 'Necesidad visual' }],
  fields: [
    { key: 'listings_total', label: 'Avisos activos', group: 'cartera', type: 'number', min: 0, max: 20000, key_data: true },
    { key: 'uses_staging', label: 'Ya ambienta sus fotos', group: 'visual', type: 'enum', options: [{ value: 'no', label: 'No' }, { value: 'renders', label: 'Renders' }] },
    { key: 'meta_ads', label: 'Hace publicidad en Meta', group: 'visual', type: 'bool' },
    { key: 'demo_listing_url', label: 'Aviso para la demo', group: 'visual', type: 'url' },
  ],
  statuses: [['descubierto', 'Descubierto'], ['enriquecido', 'Enriquecido'], ['calificado', 'Calificado'], ['en_cola', 'En cola'], ['descartado', 'Descartado']].map(([key, label]) => ({ key, label, help: '' })),
  scoringVersion: 'prospectos_v1', weights: { contact: 0.35, fit: 0.45, demo: 0.2 }, minFit: 40, exploreShare: 0.15,
};
const row = (id, o = {}) => ({
  id, name: `Inmobiliaria Ficticia ${id}`, zone: 'Zona Test', address: null, website: null, whatsapp: '+5492230000000', whatsappState: 'verificado', decisor: null,
  status: 'descubierto', legacy: false, explore: false, discardReason: null, sheetScore: null, complete: 20, missing: ['Falta elegir el aviso para su demo.'],
  score: { total: 40, contact: 60, fit: 43, demo: 20, parts: { necesidad: 15 }, caps: [] }, profile: {}, inferred: {}, notes: null, ...o,
});
const data = (rows) => ({
  available: true, rows, counts: { total: rows.length, ...rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}) }, catalog,
  learning: { total: { n: 40, valid: 36, replied: 18, interested: 9, engaged: 4, customers: 1 }, small: 30, message: null, messages: ['Saludo V1', 'Saludo V2'],
    dimensions: [{ key: 'web', label: 'Web propia', known: 40, rows: [{ value: 'Con web', n: 32, valid: 31, replied: 16, interested: 8, engaged: 4, customers: 1, small: false }, { value: 'Sin web', n: 8, valid: 5, replied: 2, interested: 1, engaged: 0, customers: 0, small: true }] }] },
});

test('filtra por estado y por texto sin distinguir tildes', () => {
  const rows = [row('a', { name: 'Peñalba Propiedades' }), row('b', { status: 'calificado', zone: 'Miramar' })];
  assert.deepStrictEqual(Pool.filterRows(rows, Pool.defaults({ status: 'calificado' })).map((r) => r.id), ['b']);
  assert.deepStrictEqual(Pool.filterRows(rows, Pool.defaults({ q: 'penalba' })).map((r) => r.id), ['a']);
  assert.deepStrictEqual(Pool.filterRows(rows, Pool.defaults({ q: 'miramar' })).map((r) => r.id), ['b']);
});

test('del formulario manda solo lo que cambió; vacío borra el dato y lo de la planilla no se guarda solo', () => {
  const r = row('a', { profile: { listings_total: 80, uses_staging: 'no', meta_ads: true }, inferred: { demo_listing_url: 'https://x.test/a' } });
  assert.deepStrictEqual(Pool.changes(r, catalog, { listings_total: '80', uses_staging: 'no', meta_ads: 'si', demo_listing_url: '' }), {});
  assert.deepStrictEqual(Pool.changes(r, catalog, { listings_total: '120', uses_staging: '', meta_ads: 'no', demo_listing_url: 'https://y.test/b' }),
    { listings_total: 120, uses_staging: null, meta_ads: false, demo_listing_url: 'https://y.test/b' });
});

test('la lista muestra ranking, estado, lo que falta y solo deja pasar a la cola a las calificadas', () => {
  const html = Pool.render(data([row('a'), row('b', { status: 'calificado', missing: [], score: { total: 71, contact: 90, fit: 60, demo: 80, parts: {}, caps: [] } })]), Pool.defaults({}), { name: 'HABITA.' });
  assert.match(html, /2 antes del primer contacto/);
  assert.match(html, /Falta elegir el aviso para su demo\./);
  assert.strictEqual((html.match(/data-pool="queue"/g) || []).length, 1);
  assert.match(html, /data-pool="queue" data-id="b"/);
  assert.match(html, /<strong>1<\/strong> calificada para entrar a la cola/);
  assert.match(html, /prospectos_v1/);
});

test('la ficha arma un campo por dato del catálogo, muestra lo que dice la planilla y las acciones de su estado', () => {
  const r = row('a', { profile: { listings_total: 80 }, inferred: { uses_staging: 'renders' }, missing: ['Encaje 25: el mínimo para entrar por ranking es 40.'], score: { total: 30, contact: 60, fit: 25, demo: 80, parts: { necesidad: 5 }, caps: ['Ya tiene un proveedor de IA.'] } });
  const html = Pool.render(data([r]), Pool.defaults({ open: 'a' }), {});
  assert.match(html, /name="listings_total"[^>]*value="80"/);
  assert.match(html, /En la planilla: Renders/);
  assert.match(html, /Ya tiene un proveedor de IA\./);
  assert.match(html, /data-pool="explore"/); // solo le falta encaje: puede entrar por exploración
  assert.doesNotMatch(html, /PASAR A LA COLA/);
  const queued = Pool.render(data([row('a', { status: 'en_cola', missing: [] })]), Pool.defaults({ open: 'a' }), {});
  assert.match(queued, /data-pool="unqueue"/);
  const discarded = Pool.render(data([row('a', { status: 'descartado', discardReason: 'Solo campos', missing: [] })]), Pool.defaults({ open: 'a' }), {});
  assert.match(discarded, /Descartada: Solo campos/);
  assert.match(discarded, /data-pool="reopen"/);
  assert.doesNotMatch(discarded, /data-pool-form="discard"/);
});

test('escapa lo que viene de los datos', () => {
  const html = Pool.render(data([row('a', { name: '<img src=x onerror=1>', notes: '<script>x</script>' })]), Pool.defaults({ open: 'a' }), {});
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>x/);
});

test('aprendizajes: tasas sobre las de número válido, muestra chica y filtro por primer mensaje', () => {
  const html = Pool.render(data([row('a')]), Pool.defaults({ tab: 'aprendizajes' }), {});
  assert.match(html, /Qué prospectos convierten/);
  assert.match(html, /<strong>90%<\/strong><span>Número válido/); // 36 de 40
  assert.match(html, /<strong>50%<\/strong><span>Respondieron/); // 18 de 36
  assert.match(html, /Sin web<\/strong> <span class="os-tag">MUESTRA CHICA/);
  assert.match(html, /<option value="Saludo V2"/);
});

test('sin la migración avisa y no deja guardar; sin datos muestra el error con reintento', () => {
  const html = Pool.render({ ...data([row('a', { status: 'calificado', missing: [] })]), available: false }, Pool.defaults({ open: 'a' }), {});
  assert.match(html, /202612140001_prospect_pool\.sql/);
  assert.match(html, /name="listings_total"[^>]*disabled/);
  assert.match(Pool.render(null, {}, { error: 'habita. no respondió a tiempo.' }), /data-pool="reload"/);
  assert.match(Pool.render(null, {}, {}), /skeleton/);
});

test('el llenado automático muestra si está activo, la meta y la última corrida', () => {
  const at = new Date().toISOString();
  const af = { available: true, enabled: true, target: null, effectiveTarget: 48, cap: 48, last: { at, by: 'Llenado automático', target: 48, waiting: 4, asked: 44, added: 12, explore: 2, short: 32 } };
  const html = Pool.render({ ...data([row('a')]), autofill: af }, Pool.defaults({}), {});
  assert.match(html, /data-pool-form="autofill"/);
  assert.match(html, /name="activo" value="1" checked/);
  assert.match(html, /el cupo diario, 48/);
  assert.match(html, /entraron 12 de 44 \(2 por exploración\)\. Faltaron 32: no había más calificadas\./);
  assert.match(html, /data-pool="autofill-run"/);
  const off = Pool.render({ ...data([row('a')]), autofill: { ...af, enabled: false, target: 20, last: null } }, Pool.defaults({}), {});
  assert.doesNotMatch(off, /name="activo" value="1" checked/);
  assert.match(off, /value="20"/);
  assert.match(off, /Todavía no corrió\./);
  const missing = Pool.render({ ...data([row('a')]), autofill: { available: false } }, Pool.defaults({}), {});
  assert.match(missing, /202612270001_prospect_autofill\.sql/);
  assert.doesNotMatch(missing, /data-pool-form="autofill"/);
  assert.doesNotMatch(Pool.render(data([row('a')]), Pool.defaults({}), {}), /pool-autofill/);
});

test('la última corrida dice cuándo no hizo falta sumar y cuándo falló', () => {
  const at = new Date().toISOString();
  assert.match(Pool.autofillRun({ at, target: 48, waiting: 50, asked: 0, added: 0, explore: 0, short: 0 }), /ya tenía 50 primeros saludos para una meta de 48/);
  assert.match(Pool.autofillRun({ at, target: 48, waiting: 0, asked: 48, added: 0, explore: 0, short: 48, error: 'Sin base' }), /no se pudo completar\. Sin base/);
  assert.match(Pool.autofillRun({ at, target: 48, waiting: 0, asked: 48, added: 48, explore: 7, short: 0 }), /^Última corrida \(hoy \d\d:\d\d\): entraron 48 de 48 \(7 por exploración\)\.$/);
});

// «Ya trabajadas»: lo que ya salió de la prospección, con la forma de `history` de habita.
const situations = [['cliente', 'Cliente'], ['respondio', 'Respondió'], ['contactada', 'Contactada, sin respuesta'], ['en_cola', 'En cola, sin contactar'], ['descartada', 'Descartada']].map(([key, label]) => ({ key, label }));
const worked = (id, situation, o = {}) => ({
  id, agencyId: `g-${id}`, name: `Inmobiliaria Ficticia ${id}`, zone: 'Zona Test', website: `https://ficticia-${id}.test`, whatsapp: '+5492230000001', sdr: 'SDR Test',
  situation, situationLabel: situations.find((s) => s.key === situation).label, detail: null, firstContactAt: null, lastContactAt: null, queuedAt: null, at: '2026-11-10T12:00:00Z', demoListing: null, ...o,
});
const withHistory = (history) => {
  const d = data([row('a', { name: 'Peñalba Propiedades' })]);
  d.catalog = { ...catalog, situations };
  d.history = history;
  d.historyCounts = { total: history.length, ...history.reduce((c, h) => ({ ...c, [h.situation]: (c[h.situation] || 0) + 1 }), {}) };
  return d;
};

test('«Ya trabajadas» filtra por situación y por texto, y muestra en qué quedó cada una', () => {
  const history = [
    worked('b', 'cliente', { firstContactAt: '2026-11-02T15:00:00Z', lastContactAt: '2026-11-05T15:00:00Z' }),
    worked('c', 'descartada', { name: 'Peñaloza Bienes Raíces', detail: 'Cerró la oficina' }),
    worked('d', 'en_cola', { queuedAt: '2026-11-17T09:00:00Z' }),
  ];
  assert.deepStrictEqual(Pool.filterHistory(history, Pool.defaults({ situation: 'cliente' })).map((h) => h.id), ['b']);
  assert.deepStrictEqual(Pool.filterHistory(history, Pool.defaults({ q: 'penaloza' })).map((h) => h.id), ['c']);
  assert.deepStrictEqual(Pool.filterHistory(history, Pool.defaults({ q: 'ficticia-d' })).map((h) => h.id), ['d']);
  const html = Pool.render(withHistory(history), Pool.defaults({ tab: 'trabajadas' }), {});
  assert.match(html, /data-testid="pool-history"/);
  assert.match(html, /YA TRABAJADAS 3/);
  assert.match(html, /data-pool="situation" data-value="cliente" aria-pressed="false">Cliente 1/);
  // Solo hay chips para las situaciones que tienen inmobiliarias.
  assert.doesNotMatch(html, /data-value="respondio"/);
  assert.match(html, /Cerró la oficina/);
  assert.match(html, /En cola desde el 17\/11\/26/);
  assert.match(html, /02\/11\/26/);
  assert.equal((html.match(/data-testid="pool-history-row"/g) || []).length, 3);
});

test('al buscar en la lista avisa si ya se trabajó, para no sumarla de nuevo', () => {
  const d = withHistory([worked('c', 'descartada', { name: 'Peñaloza Bienes Raíces' })]);
  const html = Pool.render(d, Pool.defaults({ q: 'penaloza' }), {});
  assert.match(html, /data-testid="pool-also-worked"/);
  assert.match(html, /Ya trabajada: <b>Peñaloza Bienes Raíces<\/b> \(Descartada\)/);
  assert.doesNotMatch(Pool.render(d, Pool.defaults({ q: 'otra' }), {}), /pool-also-worked/);
  assert.doesNotMatch(Pool.render(d, Pool.defaults({}), {}), /pool-also-worked/);
});

test('«Falta inmueble» cuenta las que están en cola con un aviso de portal', () => {
  const rows = [
    row('a', { status: 'en_cola', profile: { demo_listing_url: 'https://www.argenprop.com/casa--1', demo_listing_reference: 'la casa de prueba' } }),
    row('b', { status: 'en_cola', profile: { demo_listing_url: 'https://ficticia.test/aviso/1', demo_listing_reference: 'el PH de prueba' } }),
  ];
  assert.deepStrictEqual(Pool.filterRows(rows, Pool.defaults({ status: 'falta_inmueble' })).map((r) => r.id), ['a']);
});
