// El recordatorio de la reunión como una automatización más (decisión de Martín, 10/10/2026: «Mudarlo al
// motor»): de su fila salen los toques que manda el emisor de siempre, y Publicar rechaza lo que no sabría
// mandar. Lo importante de la mudanza: la configuración de antes, pasada a pasos, da EXACTAMENTE los mismos
// toques (textos, números y minutos) — así no cambia qué sale ni cuándo.
//
// ROTURAS (10/10/2026), restaurando de memoria, base 6 / 0:
//   R1. acepta una espera por tiempo                          → 5 / 1
//   R2. acepta una tarjeta suelta                             → 5 / 1
//   R3. un texto vacío no cae al de fábrica                   → 5 / 1
//   R4. la línea del toque no viaja                           → 5 / 1
//   R5. acepta los toques en cualquier orden                  → 5 / 1
import test from 'node:test';
import assert from 'node:assert/strict';
import { toquesDeLaAutomatizacion, pasosDeLaConfig, TRIGGER_RECORDATORIO } from '../lib/recordatorio-automatizacion';
import { configDeRecordatorio, TEXTO_DEFAULT, TOQUES } from '../lib/recordatorio-lead';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;
const fabrica = configDeRecordatorio(null);

test('la configuración de antes, pasada a pasos, da los MISMOS toques (la mudanza no cambia qué sale)', () => {
  const cfg = configDeRecordatorio(JSON.stringify({ activo: true, toques: [{ min: 60, texto: 'Hola {{nombre}}, {{faltan}}.', linea: 'mako_ws1_b' }] }));
  const r = toquesDeLaAutomatizacion(pasosDeLaConfig(cfg));
  assert.equal(r.problema, null);
  assert.deepEqual(r.toques.map((t) => t.min), [...TOQUES]);
  assert.deepEqual(r.toques.map((t) => t.texto), TOQUES.map((m) => cfg.textos[m]));
  assert.deepEqual(r.toques.map((t) => t.linea), [null, 'mako_ws1_b', null]);
  assert.equal(TRIGGER_RECORDATORIO, 'reunion_recordatorio');
});

test('una tarjeta vacía sale con el texto de fábrica de ese toque', () => {
  const pasos = pasosDeLaConfig(fabrica).map((p: P) => (p.id === 'toque-15' ? { ...p, cuerpo: '' } : p));
  assert.equal(toquesDeLaAutomatizacion(pasos).toques.find((t) => t.min === 15)?.texto, TEXTO_DEFAULT[15]);
});

test('se puede sacar un toque (la fila sigue entera)', () => {
  const pasos = pasosDeLaConfig(fabrica).filter((p: P) => p.id !== 'espera-60' && p.id !== 'toque-60')
    .map((p: P) => (p.id === 'toque-1440' ? { ...p, siguiente: 'espera-15' } : p));
  const r = toquesDeLaAutomatizacion(pasos);
  assert.equal(r.problema, null);
  assert.deepEqual(r.toques.map((t) => t.min), [1440, 15]);
});

test('Publicar rechaza lo que el emisor no sabría mandar, y dice qué tarjeta', () => {
  const base = pasosDeLaConfig(fabrica);
  const conTiempo = base.map((p: P) => (p.id === 'espera-60' ? { ...p, espera: { modo: 'tiempo', minutos: 60 } } : p));
  assert.equal(toquesDeLaAutomatizacion(conTiempo).tarjeta, 'espera-60');
  const conEmail = base.map((p: P) => (p.id === 'toque-60' ? { ...p, canal: 'email' } : p));
  assert.equal(toquesDeLaAutomatizacion(conEmail).tarjeta, 'toque-60');
  const conSuelta = [...base, { id: 'x', canal: 'whatsapp', cuerpo: 'suelta', siguiente: null, delay_horas: 0 }];
  assert.equal(toquesDeLaAutomatizacion(conSuelta).tarjeta, 'x');
  const conDato = base.map((p: P) => (p.id === 'toque-15' ? { ...p, cuerpo: 'Hola {{empresa}}' } : p));
  assert.ok(toquesDeLaAutomatizacion(conDato).problema, 'un dato que el emisor no resuelve pasó');
});

test('los toques van del más temprano al más cercano, sin repetir', () => {
  const al_reves = pasosDeLaConfig(fabrica).map((p: P) => (p.id === 'espera-1440' ? { ...p, espera: { modo: 'antes_reunion', minutos: 15 } } : p));
  assert.ok(toquesDeLaAutomatizacion(al_reves).problema);
});

test('sin ningún toque no hay recordatorio', () => {
  assert.ok(toquesDeLaAutomatizacion([]).problema);
});

test('el emisor lee la AUTOMATIZACIÓN si existe; la configuración de antes, sólo si no hay ninguna', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../lib/reunion-recordatorio.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const ini = src.indexOf('export async function toquesDelNegocio(');
  const b = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.match(b, /\.eq\('workspace_id', ws\)\.eq\('trigger_tipo', TRIGGER_RECORDATORIO\)\.is\('archivada_at', null\)/, 'sin el workspace explícito lee las de otro negocio');
  assert.match(b, /if \(error\) throw new Error\(/, 'una lectura que falla cae a la configuración de antes');
  // La configuración de antes se lee DESPUÉS del «si hay filas, vuelve»: con fila, no se mira.
  assert.ok(b.indexOf('if (filas.length) {') < b.indexOf('leerConfigRecordatorio(ws)'), 'con la automatización, la configuración de antes se sigue mirando');
});
