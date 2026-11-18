// =============================================================================
// Los bloques de General toman el funnel del «Filtro» de la hoja (18/11/2026)
// =============================================================================
// Pendiente O10 (3) de docs/pendientes-verificados-17-11.md: «que los bloques de General acepten el período y los
// filtros». El filtro de funnel ya llegaba a «A quién cobrarle» (22/10/2026); «Tu funnel hoy» mostraba igual el principal
// con la hoja filtrada por otro funnel. El test EJECUTA las dos reglas (app/general/funnels-de-la-hoja.ts), que son las
// que usa `dibujarBloque` (app/general/ProveedorGeneral.tsx).
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026), una rotura por vez y vuelta atrás:
//   1. `funnelDeFunnelHoy` sin mirar la hoja (sólo el suyo) ............................. 1 fallo
//   2. `funnelDeFunnelHoy` sin dejar mandar al suyo (la hoja primero) ................. 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { funnelDeFunnelHoy, funnelsDeCobranza } from '../app/general/funnels-de-la-hoja';
import type { DatosGeneral } from '../app/general/datos-tipos';
import type { Elemento } from '../lib/graficos-catalogo';

const funnels = [
  { id: 1, nombre: 'VSL', principal: true, conteo: null },
  { id: 2, nombre: 'Renovación', principal: false, conteo: null },
  { id: 3, nombre: 'Mentoría', principal: false, conteo: null },
];
const d = { funnels: { ok: true, d: funnels } } as unknown as DatosGeneral;
const sinCrm = { funnels: { ok: false, error: 'No pude leer el CRM.' } } as unknown as DatosGeneral;
const bloque = (extra: Partial<NonNullable<Elemento['general']>> = {}) => ({ pieza: 'funnel', ...extra }) as NonNullable<Elemento['general']>;

test('«Tu funnel hoy» sin funnel propio mira el primero que filtra la hoja', () => {
  assert.equal(funnelDeFunnelHoy(bloque(), d, { funnels: ['Renovación'] }), 2, 'antes: el principal');
  assert.equal(funnelDeFunnelHoy(bloque(), d, { funnels: ['Un funnel que no está', 'Mentoría', 'Renovación'] }), 3, 'el primero que el negocio tiene');
  assert.equal(funnelDeFunnelHoy(bloque(), d, { funnels: null }), null, 'sin filtro: el principal (null)');
  assert.equal(funnelDeFunnelHoy(bloque(), d), null);
  assert.equal(funnelDeFunnelHoy(bloque(), sinCrm, { funnels: ['Renovación'] }), null, 'sin el CRM no se adivina');
});

test('el funnel elegido en el panel del bloque manda sobre el de la hoja', () => {
  assert.equal(funnelDeFunnelHoy(bloque({ funnel: 3 }), d, { funnels: ['Renovación'] }), 3);
});

test('«A quién cobrarle»: los suyos, o los de la hoja, o todos', () => {
  assert.deepEqual(funnelsDeCobranza(bloque({ pieza: 'cobranza' }), d, { funnels: ['Renovación', 'VSL'] }).sort(), [1, 2]);
  assert.deepEqual(funnelsDeCobranza(bloque({ pieza: 'cobranza' }), d, { funnels: null }), [], 'sin filtro: todos');
  assert.deepEqual(funnelsDeCobranza(bloque({ pieza: 'cobranza' }), sinCrm, { funnels: ['Renovación'] }), []);
});

test('el dibujo de los dos bloques usa estas reglas', () => {
  const prov = readFileSync(join(__dirname, '..', 'app', 'general', 'ProveedorGeneral.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const dibujar = prov.slice(prov.indexOf('export function dibujarBloque'), prov.indexOf('export function muestraDeBloque'));
  assert.ok(dibujar.length > 200 && dibujar.length < 4000, `el recorte mide ${dibujar.length}: está mirando otra cosa`);
  assert.match(dibujar, /const funnel = funnelDeFunnelHoy\(g, d, hoja\);/);
  assert.match(dibujar, /case 'funnel': return <BloqueFunnel d=\{d\.funnels\} funnel=\{funnel\}/);
  assert.match(dibujar, /elegidos=\{funnelsDeCobranza\(g, d, hoja\)\}/);
});
