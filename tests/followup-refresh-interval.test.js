'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../prospecting/app.js'), 'utf8');

// Cada lectura de la cola recalcula el tablero de habita. en Supabase: la cola se relee sola cada
// 5 minutos (antes, cada minuto: ~380 por día) y solo con la pestaña a la vista.
test('La cola se relee sola cada 5 minutos y solo con la pestaña visible', () => {
  assert.match(app, /const FU_REFRESH_MS = 5 \* 60_000;/);
  assert.match(app, /setInterval\(\(\) => \{\s*if \(document\.visibilityState === 'visible' && isFu\(\)[^\n]*fuStale\(\)\) loadFollowup\(\{ quiet: true \}\);/);
  assert.doesNotMatch(app, /\}, 60000\);/, 'ya no hay un intervalo de un minuto para la cola');
});

test('Volver a la pestaña no relee lo que tiene menos de 5 minutos', () => {
  assert.match(app, /if \(!state\.fu\.task && fuStale\(\)\) loadFollowup\(\{ quiet: true \}\);/);
  assert.match(app, /Date\.now\(\) - \(unitLoadedAt\[state\.unit\] \|\| 0\) >= FU_REFRESH_MS/);
});

test('El otro producto se mantiene fresco con el mismo intervalo', () => {
  assert.match(app, /Date\.now\(\) - \(state\.fu\.loadedAt\[other\] \|\| 0\) < FU_REFRESH_MS\) return;/);
});
