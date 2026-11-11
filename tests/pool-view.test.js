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
