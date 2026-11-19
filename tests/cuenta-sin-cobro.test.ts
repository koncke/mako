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
import {
  CLAVE_SIN_COBRO, DIAS_DE_PRUEBA_SIN_COBRO, TEXTO_CONFIRMAR_APAGAR, finDeLaPruebaSinCobro, habilitadoSinCobro, pasoSinCobro, sinCobroDeSetting, textoDelApagado, type SinCobro,
} from '../lib/cuenta-sin-cobro-reglas';
import { PRUEBA_DIAS } from '../lib/planes-mako';
import { leOfrecePagar, leerCorte, textoDelCorte } from '../lib/plan-acceso-reglas';
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
  assert.equal(TEXTO_CONFIRMAR_APAGAR, 'Este negocio pasa al circuito normal: 7 días de prueba y después el cobro de su plan. Si en esos 7 días no carga su tarjeta, su cuenta se pausa hasta que pague.');
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
  const fila = (ws: number, nombre: string): Parameters<typeof listaDeClientes>[0][number] => ({ ws, nombre, creado: '2026-10-01T10:00:00Z', estado: 'activo', capa: 'completo', segmentos: ['cliente'] });
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

// ── Apagado = la prueba de siempre, CONECTADA (19/11/2026) ──────────────────────────────────────────────────────

const APAGADO: SinCobro = { activo: false, por: 'martin@ejemplo.com', at: '2026-11-19T12:00:00.000Z' };
const FIN = Date.parse('2026-11-26T12:00:00.000Z');
const D = 86_400_000;

test('apagar abre 7 días de prueba, los mismos de cualquier alta; prendido o sin tocar no hay prueba', () => {
  assert.equal(DIAS_DE_PRUEBA_SIN_COBRO, PRUEBA_DIAS, 'los días de la prueba son los de /planes');
  assert.equal(finDeLaPruebaSinCobro(APAGADO), '2026-11-26T12:00:00.000Z');
  assert.equal(finDeLaPruebaSinCobro({ ...APAGADO, activo: true }), null);
  assert.equal(finDeLaPruebaSinCobro(null), null);
  assert.equal(finDeLaPruebaSinCobro({ ...APAGADO, at: null }), null, 'sin saber desde cuándo, no se pausa a nadie');
});

test('la pausa: sólo apagado, sin plan, terminada la prueba y activo; «no pude leer el plan» nunca pausa', () => {
  const base = { sinCobro: APAGADO, plan: false as boolean | undefined, estado: 'activo' as string | null, corteNuestro: false, ahora: FIN };
  assert.deepEqual(pasoSinCobro(base), { tipo: 'pausar', hasta: '2026-11-26T12:00:00.000Z' });
  assert.deepEqual(pasoSinCobro({ ...base, ahora: FIN - 1 }), { tipo: 'nada' }, 'en la prueba, todavía no');
  assert.deepEqual(pasoSinCobro({ ...base, plan: true }), { tipo: 'nada' }, 'con su plan (o la tarjeta cargada esperando el primer cobro), nunca');
  assert.deepEqual(pasoSinCobro({ ...base, plan: undefined }), { tipo: 'nada' }, 'no se pudo leer: no se pausa');
  assert.deepEqual(pasoSinCobro({ ...base, estado: 'pausado' }), { tipo: 'nada' }, 'pausado por otra cosa: no se toca');
  assert.deepEqual(pasoSinCobro({ ...base, sinCobro: null }), { tipo: 'nada' }, 'nunca tocado: como hasta hoy');
  assert.deepEqual(pasoSinCobro({ ...base, sinCobro: { ...APAGADO, activo: true } }), { tipo: 'nada' }, 'prendido: sin cobro');
});

test('se reabre lo que pausó ESTE corte: con su plan, o si Martín lo vuelve a prender; una pausa a mano no se reabre', () => {
  const pausado = { sinCobro: APAGADO, plan: true as boolean | undefined, estado: 'pausado' as string | null, corteNuestro: true, ahora: FIN + D };
  assert.deepEqual(pasoSinCobro(pausado), { tipo: 'reabrir' });
  assert.deepEqual(pasoSinCobro({ ...pausado, plan: false, sinCobro: { ...APAGADO, activo: true } }), { tipo: 'reabrir' }, 'lo volvió a prender');
  assert.deepEqual(pasoSinCobro({ ...pausado, corteNuestro: false }), { tipo: 'nada' }, 'la pausa no es nuestra');
  assert.deepEqual(pasoSinCobro({ ...pausado, plan: false }), { tipo: 'nada' }, 'sigue sin plan: sigue en pausa');
});

test('lo que se lee: la ficha dice hasta cuándo, /cuenta-pausada dice que terminó la prueba y ofrece activar el plan', () => {
  assert.match(textoDelApagado(APAGADO, FIN - D), /en su prueba hasta el 26\/11/);
  assert.match(textoDelApagado(APAGADO, FIN + 1), /terminó el 26\/11/);
  const corte = leerCorte(JSON.stringify({ cobroId: 0, hasta: '2026-11-26T12:00:00.000Z', motivo: 'prueba-terminada', desde: '2026-11-26T12:30:00.000Z', vigente: true }));
  assert.ok(corte);
  assert.deepEqual(textoDelCorte(corte), { titulo: 'Tu prueba gratis terminó', detalle: 'Terminó el 26/11/2026. Tus datos están guardados: activa tu plan y vuelves a entrar en el acto.' });
  assert.equal(leOfrecePagar({ esAgencia: false, corte, quienPaga: null }), true);
  assert.match(fuente('app/cuenta-pausada/page.tsx'), /corte\?\.motivo === 'prueba-terminada' \? 'Activar mi plan'/);
});

test('la pausa vale con el corte general APAGADO, y la revisión sólo LEE el interruptor (pausa y reabre el negocio, nunca lo cambia)', () => {
  assert.match(fuente('lib/workspace.ts'), /if \(corte\?\.motivo === 'prueba-terminada' && corte\.vigente\) return true;/);
  const s = fuente('lib/cuenta-sin-cobro.ts');
  const revision = s.slice(s.indexOf('export async function revisarSinCobro'));
  assert.doesNotMatch(revision, /ponerSinCobro|upsert|\.update\(|\.insert\(/, 'escribe sólo a través de cortar/reabrir (lib/plan-acceso.ts)');
  assert.match(revision, /cortar\(ws, \{ cobroId: 0, hasta: paso\.hasta, motivo: MOTIVO_PRUEBA_TERMINADA/);
  // La corre el cron de cobros, el pago que entra y el interruptor.
  assert.match(fuente('app/api/cron/cobros-reconciliar/route.ts'), /await revisarSinCobro\(\)/);
  assert.match(fuente('lib/cobros.ts'), /revisarSinCobro\(\{ soloWs: actual\.alta_ws \}\)/);
  assert.match(fuente('app/admin/_polar/datos/sin-cobro-actions.ts'), /revisarSinCobro\(\{ soloWs: Number\(ws\) \}\)/);
});

test('«Elegir mi plan» durante la prueba: la tarjeta ahora y el primer cobro el día que termina, sólo donde la pasarela lo deja', () => {
  const r = fuente('app/api/plan/pagar/route.ts');
  assert.match(r, /body\.accion === 'prueba'/);
  assert.match(r, /reactivarPlan\(a\.ws, \{[^}]*\}, \{ inicioAt: prueba\.hasta \}\)/);
  const c = fuente('lib/compra-plan.ts');
  assert.match(c, /CAPACIDADES_PASARELA\[via\.pasarela\]\?\.difiereElPrimerCobro \? inicioAt : null/);
  assert.match(c, /creadoPor: `reactivar:\$\{ws\}`, inicioAt: diferido/);
  assert.match(fuente('app/_components/AvisoMoraPlan.tsx'), /if \(!mora && prueba\) return <AvisoPrueba prueba=\{prueba\} \/>;/);
});

test('P2P sin tocar y sin pagar por ninguna vía se ve PRENDIDO (apagarlo es lo que lo pasa a la prueba); quien paga, no', () => {
  const sin = async () => ({ ok: false as const, error: 'x' });
  const deHecho = renderToStaticMarkup(createElement(CustomerSinCobro, { ws: 14, inicial: null, paga: false, poner: sin }));
  assert.match(deHecho, /Entra sin cobro \(cargado a mano\)\. Apágalo para que pase a la prueba de 7 días/);
  assert.match(fuente('app/admin/_polar/web/Customer/CustomerPage/CustomerSinCobro.tsx'), /const deHecho = estado == null && paga === false\n  const prendido = habilitadoSinCobro\(estado\) \|\| deHecho/);
  const paga = renderToStaticMarkup(createElement(CustomerSinCobro, { ws: 13, inicial: null, paga: true, poner: sin }));
  assert.match(paga, /Paga su lugar \(su plan, su mensualidad o su agencia\)/);
  // La pausa y la prueba miran si PAGA SU LUGAR por cualquier vía (su plan, su mensualidad, su agencia), no sólo su plan de la pasarela:
  // apagar el interruptor de un cliente de agencia o de Leila no los pausa.
  const s = fuente('lib/cuenta-sin-cobro.ts');
  assert.match(s, /const plan = apagado \? await pagaSuLugar\(ws\) : undefined;/);
  assert.match(s, /return \(await pagaSuLugar\(ws\)\) === false \? \{ hasta: fin \} : null;/);
  assert.match(s, /if \(propio === true \|\| \(mensualidad !== undefined && mensualidad !== null\) \|\| deAgencia === true\) return true;/);
  assert.match(fuente('app/admin/(polar)/customers/[id]/page.tsx'), /pagaSuLugar=\{paga \?\? null\}/);
});

// Roturas (19/11/2026), cada una restaurada: ver docs/hallazgos-agencias.md.
