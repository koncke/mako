// =============================================================================
// «Habilitado sin cobro»: el interruptor de super admin por negocio (19/11/2026)
// =============================================================================
// Un ajuste por negocio (`cuenta.sin_cobro`), sin migración; lo escribe sólo el super admin al tocar el interruptor; el chip «Sin cobro» en la
// lista; el cartel de una línea antes de apagar. HOY sólo registra la decisión (ver lib/cuenta-sin-cobro-reglas.ts).
// Probado rompiendo: al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CLAVE_SIN_COBRO, TEXTO_CONFIRMAR_APAGAR, habilitadoSinCobro, sinCobroDeSetting } from '../lib/cuenta-sin-cobro-reglas';
import { detalleDeNegocio } from '../app/admin/_polar/datos/busqueda-tipos';
import { filtrarClientes, listaDeClientes } from '../app/admin/_polar/datos/clientes';
import { CustomerSinCobro } from '../app/admin/_polar/web/Customer/CustomerPage/CustomerSinCobro';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

test('el ajuste: tres estados (prendido, apagado, nunca tocado) y lo roto no cuenta como prendido', () => {
  assert.equal(CLAVE_SIN_COBRO, 'cuenta.sin_cobro');
  assert.equal(sinCobroDeSetting(null), null, 'nunca se tocó');
  assert.equal(sinCobroDeSetting('no es json'), null);
  assert.equal(sinCobroDeSetting('{"por":"x"}'), null, 'sin `activo` no se entiende');
  const on = sinCobroDeSetting('{"activo":true,"por":"martin@ejemplo.com","at":"2026-11-19T10:00:00.000Z"}');
  assert.deepEqual(on, { activo: true, por: 'martin@ejemplo.com', at: '2026-11-19T10:00:00.000Z' });
  assert.equal(habilitadoSinCobro(on), true);
  assert.equal(habilitadoSinCobro(sinCobroDeSetting('{"activo":false}')), false, 'apagado: circuito normal');
  assert.equal(habilitadoSinCobro(null), false, 'nunca tocado: sin chip');
  assert.equal(habilitadoSinCobro(sinCobroDeSetting('{"activo":"si"}')), false, 'un valor que no es booleano no prende nada');
});

test('el cartel antes de apagar dice lo que pasa, en una línea', () => {
  assert.equal(TEXTO_CONFIRMAR_APAGAR, 'Este negocio pasa al circuito normal: 7 días de prueba y después el cobro de su plan.');
  const html = renderToStaticMarkup(createElement(CustomerSinCobro, { ws: 5, inicial: null, poner: async () => ({ ok: false as const, error: 'x' }) }));
  assert.match(html, /Habilitado sin cobro/);
  assert.match(html, /Sin tocar: como hasta hoy\./);
  const on = renderToStaticMarkup(createElement(CustomerSinCobro, { ws: 5, inicial: { activo: true, por: 'm', at: '2026-11-19T10:00:00.000Z' }, poner: async () => ({ ok: false as const, error: 'x' }) }));
  assert.match(on, /cargado a mano, sin prueba ni cobro/);
  const f = fuente('app/admin/_polar/web/Customer/CustomerPage/CustomerSinCobro.tsx');
  assert.match(f, /onCheckedChange=\{\(v\) => \{ if \(v\) void guardar\(true\); else setConfirmando\(true\) \}\}/, 'apagar pasa por el cartel; prender no hace falta');
  assert.match(f, /description=\{TEXTO_CONFIRMAR_APAGAR\}/);
});

test('el chip «Sin cobro» sale en la lista y en la segunda línea del renglón; sin el interruptor no sale', () => {
  const fila = (ws: number, nombre: string) => ({ ws, nombre, creado: '2026-10-01T10:00:00Z', estado: 'activo', capa: 'completo', segmentos: ['cliente'] as const });
  const lista = listaDeClientes([fila(1, 'P2P Consulting'), fila(2, 'Estudio Norte')], [], new Set([1]));
  assert.deepEqual(lista.map((c) => [c.ws, c.sinCobro]), [[1, true], [2, false]]);
  assert.equal(filtrarClientes(lista, { query: null, sorting: 'name', filter: 'all' }).length, 2, 'no se esconde: el chip sólo marca');
  assert.match(detalleDeNegocio({ plan: 'MaKo Essential', pausado: false, sinCobro: true }), /Sin cobro/);
  assert.doesNotMatch(detalleDeNegocio({ plan: 'MaKo Essential', pausado: false }), /Sin cobro/);
});

test('lo escribe SÓLO el super admin al tocar el interruptor, y ningún código lo cambia solo', () => {
  const a = fuente('app/admin/_polar/datos/sin-cobro-actions.ts');
  assert.match(a, /^'use server'/, 'una server action');
  const f = a.slice(a.indexOf('export async function ponerSinCobroAction'));
  assert.match(f.slice(0, 260), /const admin = await getSesionAdmin\(\);\n  if \(!admin\) return/, 'getSesionAdmin en la primera línea');
  assert.doesNotMatch(fuente('app/admin/cobros/actions.ts'), /ponerSinCobro/, 'no en las acciones de cobros: ahí el ws no viaja desde la pantalla (tests/admin-cobros.test.ts)');
  assert.match(fuente('lib/api-mako/cobertura.ts'), /sin-cobro-actions.ts#ponerSinCobroAction': 'decide si un negocio se cobra/, 'no va en la API: por el chat sería un vector');
  // Nadie más importa `ponerSinCobro`: ni un cron ni un flujo de cobro.
  for (const ruta of ['lib/plan-acceso.ts', 'lib/cobros.ts', 'lib/compra-plan.ts', 'lib/agencia-mes.ts']) assert.doesNotMatch(fuente(ruta), /ponerSinCobro/, ruta);
  const s = fuente('lib/cuenta-sin-cobro.ts');
  assert.match(s, /\.eq\('workspace_id', ws\)\.eq\('key', CLAVE_SIN_COBRO\)/);
  assert.match(s, /No pude leer el interruptor/, '«no pude leer» tira: no es «apagado»');
  assert.match(fuente('app/admin/(polar)/customers/[id]/page.tsx'), /ponerSinCobro=\{ponerSinCobroAction\}/);
});

// Roturas (19/11/2026), cada una restaurada: ver docs/hallazgos-agencias.md.
