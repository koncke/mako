// El GOTEO de una automatización: sus WhatsApp de a uno y con tope, adentro del de la línea (22/10/2026)
// =============================================================================
// La llamada con Mauricio (02:11-02:15): «al pasar 50 leads a "Prospección activa", que no salgan juntos: envía uno,
// tal vez espera 4 minutos o 5, envía el otro»; configurable por automatización (minutos entre envíos, tope por día,
// días de la semana — los de su horario). Decisión del Cerebro: es un SUB-tope adentro del de la línea.
// Se fija la regla (lib/goteo.ts), lo que se guarda (lib/config-automatizacion.ts) y el cableado en el motor
// (lib/nutricion.ts: del fuente sólo se lee eso). ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { frenoDeGoteo, turnoDeGoteo, conEnvio, textoDeGoteo, SIN_USO } from '../lib/goteo';
import { sanearConfigAutomatizacion, configParaGuardar, tieneConfigPropia } from '../lib/config-automatizacion';

const MIN = 60_000;
const AHORA = Date.parse('2026-10-24T16:00:00Z');

test('uno cada 5 minutos: el segundo espera, a los 5 sale', () => {
  const g = { minutos: 5 };
  assert.deepEqual(frenoDeGoteo(g, SIN_USO, AHORA), { frena: false }, 'sin nada enviado, sale');
  const uso = conEnvio(SIN_USO, AHORA);
  const f = frenoDeGoteo(g, uso, AHORA + 1 * MIN);
  assert.ok(f.frena && f.motivo === 'minutos' && f.desdeMs === AHORA + 5 * MIN);
  assert.deepEqual(frenoDeGoteo(g, uso, AHORA + 5 * MIN), { frena: false });
});

test('hasta 50 por día: el 51 espera a que el más viejo salga de las 24 h', () => {
  const g = { minutos: 5, dia: 50 };
  const uso = { enviados: 50, ultimoMs: AHORA - 10 * MIN, primeroMs: AHORA - 6 * 60 * MIN };
  const f = frenoDeGoteo(g, uso, AHORA);
  assert.ok(f.frena && f.motivo === 'dia');
  assert.equal(f.desdeMs, uso.primeroMs + 24 * 60 * MIN);
  assert.deepEqual(frenoDeGoteo(g, { ...uso, enviados: 49 }, AHORA), { frena: false });
});

test('las frenadas pasan a su turno escalonadas: la k-ésima, k × minutos después', () => {
  const g = { minutos: 4 };
  assert.equal(turnoDeGoteo(AHORA, 0, g), AHORA);
  assert.equal(turnoDeGoteo(AHORA, 3, g), AHORA + 12 * MIN);
  assert.equal(turnoDeGoteo(AHORA, 3, { dia: 50 }), AHORA, 'sin minutos, todas al lugar que se libera');
});

test('sin goteo no frena nada, y se dice', () => {
  assert.deepEqual(frenoDeGoteo(undefined, { enviados: 999, ultimoMs: AHORA, primeroMs: AHORA }, AHORA), { frena: false });
  assert.match(textoDeGoteo(undefined), /^sin goteo/);
  assert.equal(textoDeGoteo({ minutos: 5, dia: 50 }), 'uno cada 5 min, hasta 50 por día, dentro del tope de la línea');
});

test('lo que se guarda: rangos, null saca, y vacío borra la clave', () => {
  assert.deepEqual(sanearConfigAutomatizacion({ goteo: { minutos: 5, dia: 50 } }).goteo, { minutos: 5, dia: 50 });
  assert.equal(sanearConfigAutomatizacion({ goteo: { minutos: 0, dia: 999 } }).goteo, undefined, 'fuera de rango no cuenta');
  const r = configParaGuardar({}, { goteo: { minutos: 5, dia: 50 } });
  assert.ok(r.ok && r.config.goteo?.minutos === 5 && r.config.goteo?.dia === 50 && !r.vacia);
  assert.ok(tieneConfigPropia({ goteo: { minutos: 5 } }));
  const mal = configParaGuardar({}, { goteo: { minutos: 500 } });
  assert.ok(!mal.ok && /minutos entre envíos van de 1 a 240/.test(mal.error));
  const sacar = configParaGuardar({ goteo: { minutos: 5 } }, { goteo: null });
  assert.ok(sacar.ok && sacar.config.goteo === undefined && sacar.vacia);
});

// ── El cableado en el motor ─────────────────────────────────────────────────────────────────────────────────────
const motor = readFileSync(join(__dirname, '..', 'lib/nutricion.ts'), 'utf8').replace(/\r\n/g, '\n');
const ini = motor.indexOf('export async function procesarEnvios(');
const proc = motor.slice(ini, motor.indexOf('\n}\n', ini));

test('procesarEnvios: el goteo frena además de la línea, y lo frenado pasa a su turno', () => {
  assert.match(proc, /const sinLugar = \(insc: \{ lead_id: number; secuencia_id: number \}\): boolean => sinLugarEnLaLinea\(insc\.lead_id\) \|\| frenoGoteo\(insc\.secuencia_id\)\.frena;/);
  assert.equal((proc.match(/if \(sinLugar\(insc\) && !/g) ?? []).length, 2, 'los dos puntos donde un mensaje espera lugar');
  assert.equal((proc.match(/await quedaFrenada\(insc, sec\); continue;/g) ?? []).length, 2);
  const q = proc.slice(proc.indexOf('const quedaFrenada = async'), proc.indexOf('const soltarToque'));
  assert.match(q, /if \(g && f\.frena && !sinLugarEnLaLinea\(insc\.lead_id\)\)/, 'sólo si lo frena el goteo, no la línea');
  assert.match(q, /proximo_envio_at: new Date\(turnoDeGoteo\(f\.desdeMs, k, g\)\)\.toISOString\(\)/);
  assert.match(proc, /if \(estado === 'enviado' && goteos\.has\(insc\.secuencia_id\)\) usoGoteo\.set\(insc\.secuencia_id, conEnvio\(/, 'lo que sale en la corrida cuenta');
  assert.match(proc, /const usoGoteo = goteos\.size \? await usoDelGoteo\(supabase, \[\.\.\.goteos\.keys\(\)\]\)/);
});

test('el uso del goteo cuenta los WhatsApp ENVIADOS de esas automatizaciones en 24 h', () => {
  const i = motor.indexOf('async function usoDelGoteo(');
  const cuerpo = motor.slice(i, motor.indexOf('\n}\n', i));
  assert.match(cuerpo, /\.in\('secuencia_id', \[\.\.\.ids\]\)\.eq\('canal', 'whatsapp'\)\.eq\('estado', 'enviado'\)\.gte\('created_at', haceHorasISO\(24\)\)/);
});

// ── Las roturas (7 tests; sin romper nada: 7 pases, 0 fallos) ──────────────────────────────────────────────────────
// 1. `frenoDeGoteo` sin el tope del día: 1 fallo / 6 pases.
// 2. `frenoDeGoteo` sin los minutos: 1 fallo / 6 pases.
// 3. `turnoDeGoteo` sin escalonar (todas al mismo instante): 1 fallo / 6 pases.
// 4. El motor sin el goteo en `sinLugar` (sólo la línea): 1 fallo / 6 pases.
// 5. `quedaFrenada` sin correr al turno (lo de antes: la fila quedaba vencida y el tick no la veía): 1 fallo / 6 pases.
// 6. El envío de la corrida sin sumarse al uso: 1 fallo / 6 pases.
