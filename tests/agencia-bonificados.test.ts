// =============================================================================
// Los clientes BONIFICADOS de una agencia (MK-08, 27/10/2026): preparado y APAGADO hasta que Martín decida
// =============================================================================
// Joan (Código Inmobiliario) en el grupo Makito: de sus 5 clientes pagan 2. lib/agencia-cobro-reglas.ts cobraba US$47 por
// CADA cliente y lo renovaba solo. Lo que fija:
//   1. el interruptor está APAGADO: con él, nadie es bonificado y marcar uno se rechaza (prenderlo es cambiar este test);
//   2. la lista, saneada; marcar y desmarcar; por un bonificado no se le pide nada a la agencia ni a su cliente;
//   3. los tres lugares que cobran la respetan (el link del primer mes, el cron de la renovación, lo que ve la agencia), y
//      «no pude leer la lista» NO es «no hay bonificados»: no se cobra a ciegas;
//   4. la API: sólo la plataforma y el super admin global, confirmada en pantalla, nunca desde un flujo.
//
// Probado rompiéndolo (con todo puesto: 0 fallos). Cada rotura, sola:
//   · `BONIFICADOS_PRENDIDO = true`                                                        → 1 fallo (1)
//   · `sanearBonificados` sin el Set (repite)                                               → 1 fallo (2)
//   · la lista se lee con `getSetting` (un error de lectura se vuelve «nadie»)               → 2 fallos (1 y 3)
//   · el link del primer mes no mira la lista                                               → 1 fallo (3)
//   · el cron sin `bonificados?.has(clienteWs)`                                              → 1 fallo (3)
//   · el cron recorre los primeros meses aunque no pudo leer la lista                        → 1 fallo (3)
//   · lo que ve la agencia sin `sinLosBonificados`                                          → 1 fallo (3)
//   · `ejecutar` sin preguntar por el super admin global                                    → 1 fallo (4)
//   · la operación sale de NO_EN_FLUJOS                                                     → 1 fallo (4)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS } from '../lib/api-mako/areas/cobros.def';
import {
  BONIFICADOS_PRENDIDO, KEY_BONIFICADOS, conBonificado, sanearBonificados, sinLosBonificados,
} from '../lib/agencia-cobro-reglas';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
/** El cuerpo de una función exportada, hasta la siguiente al mismo nivel. */
const cuerpo = (src: string, nombre: string) => {
  const i = src.indexOf(`export async function ${nombre}(`);
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const fin = src.indexOf('\nexport ', i + 10);
  return src.slice(i, fin < 0 ? undefined : fin);
};

test('el interruptor está APAGADO hasta que Martín decida qué se le cobra a Joan (MK-08)', () => {
  assert.equal(BONIFICADOS_PRENDIDO, false, 'se prende con el sí de Martín: cambiar este test en el mismo commit');
  const srv = leer('lib/agencia-cobro.ts');
  const lista = cuerpo(srv, 'clientesBonificados');
  assert.ok(lista.indexOf('if (!BONIFICADOS_PRENDIDO) return new Set();') < lista.indexOf('getSettingEstricto'), 'apagado, ni siquiera se lee la lista');
  assert.match(cuerpo(srv, 'marcarBonificado'), /if \(!BONIFICADOS_PRENDIDO\) return \{ ok: false/);
  assert.equal(KEY_BONIFICADOS, 'agencia.bonificados');
});

test('la lista: saneada, marcar y desmarcar, y por un bonificado no se pide nada', () => {
  assert.deepEqual(sanearBonificados('[15, "16", 15, -2, 0, "x", 1.5, null]'), [15, 16]);
  assert.deepEqual(sanearBonificados('no es json'), []);
  assert.deepEqual(sanearBonificados({ 15: true }), [], 'sólo una lista');
  assert.deepEqual(conBonificado([16], 15, true), [15, 16]);
  assert.deepEqual(conBonificado([15, 16], 15, false), [16]);
  assert.deepEqual(conBonificado([15], 15, true), [15], 'marcar dos veces no repite');
  const porCliente = { 15: { pagar: 'link-15' }, 16: { pagar: 'link-16' } };
  assert.deepEqual(sinLosBonificados(porCliente, new Set([15])), { 16: { pagar: 'link-16' } });
  assert.deepEqual(sinLosBonificados(porCliente, new Set()), porCliente);
});

test('los tres lugares que cobran respetan la lista, y sin poder leerla no se cobra a ciegas', () => {
  const srv = leer('lib/agencia-cobro.ts');
  assert.match(cuerpo(srv, 'clientesBonificados'), /getSettingEstricto\(KEY_BONIFICADOS\)/, 'un error de lectura tiene que tirar, no volverse «nadie»');
  const link = cuerpo(srv, 'linkPrimerMes');
  const mira = link.indexOf('(await clientesBonificados()).has(p.clienteWs)');
  assert.ok(mira > 0 && mira < link.indexOf('crearCobro('), 'el link del primer mes, antes de crear el cobro');
  const cron = cuerpo(srv, 'renovacionesDeAgencia');
  assert.match(cron, /if \(conRenovacion\.has\(clienteWs\) \|\| !f\.lead_id \|\| bonificados\?\.has\(clienteWs\)\) continue;/);
  assert.match(cron, /for \(const f of \(bonificados \? primeros\.data \?\? \[\] : \[\]\) as FilaPrimerMes\[\]\)/, 'sin la lista, esta vuelta no crea renovaciones');
  assert.match(cuerpo(srv, 'cobrosDeClientesDeAgencia'), /return sinLosBonificados\(porCliente, await clientesBonificados\(\)\);/);
  // El cartel de pago del cliente y la API de la agencia leen lo mismo: no hace falta tocarlos.
  assert.match(leer('lib/agency.ts'), /cobrosDeClientesDeAgencia\(agencia\.ws\)/);
});

test('la API: sólo la plataforma y el super admin global, confirmada en pantalla, nunca desde un flujo', () => {
  const d = DEFS.find((x) => x.id === 'bonificar_cliente_de_agencia');
  assert.ok(d && d.tipo === 'accion', 'falta la acción');
  assert.equal(d.confirmacion, 'pantalla');
  assert.equal(d.gating?.soloPlataforma, true);
  assert.equal(d.gating?.rolMinimo, 'admin');
  assert.ok(!d.canales.includes('http' as never), 'lo que decide cuánto se cobra no sale por HTTP');
  // lib/api-mako/flujo.ts es server-only: se lee como texto.
  assert.match(leer('lib/api-mako/flujo.ts'), /export const NO_EN_FLUJOS: ReadonlySet<string> = new Set\(\[[^\]]*'bonificar_cliente_de_agencia'/, 'un paso de un flujo se confirma solo');
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  const i = run.indexOf('  bonificar_cliente_de_agencia: {');
  assert.ok(i > 0 && i < run.indexOf('  vender_plan_mako: {'), 'antes de vender_plan_mako (su test recorta hasta el cierre del objeto)');
  const r = run.slice(i, run.indexOf('  vender_plan_mako: {'));
  assert.match(r, /preparar: async \(input, ctx\) => \{\s*if \(!BONIFICADOS_PRENDIDO\) return \{ error:/, 'apagado, ni siquiera propone');
  assert.match(r, /faltaParaConfirmar: async \(\) => \(\(await esSuperAdmin\(\)\) \?/);
  assert.match(r, /ejecutar: \(payload, ctx\) => seguro\('bonificar el cliente', async \(\) => \{\s*if \(!\(await esSuperAdmin\(\)\)\) return/);
  assert.match(r, /if \(ctx\.ws !== \(await wsSuperAdmin\(\)\)\) return \{ ok: false/);
});
