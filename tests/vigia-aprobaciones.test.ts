// =============================================================================
// El vigía de las aprobaciones: CUÁNDO avisa y qué guarda (lib/vigia-aprobaciones.ts)
// =============================================================================
// Pedido de Martín (4/11/2026): «crea un script que me vaya avisando de todas las notficaciones de aprobaciones pendientes…».
// Y ese mismo día: que no le manden nada de rutina. Estos tests fijan las cinco reglas de la cabecera del módulo con estados
// reales: aprobado, rechazado, «piden algo», sin leer, sin cambios, a mano y sin credencial.
//
// Probado rompiéndolo el 4/11/2026 (base, este archivo y el de los lectores juntos: 26 pases, 0 fallos):
//   · avisar también al pasar a revisión (`en_revision` en PIDE_ACCION)          → 3 rojos (reglas 1, 3 y 4).
//   · «no pude leer» escribiendo el estado (sin `...loLeido(p)`)                  → 2 rojos (regla 2 y la lista).
//   · el aviso de «no pude leer» sin el `!avisoSinLeer`                          → 1 rojo (se repetía cada hora).
//   · el aviso «a mano» sin el `!p.aManoAvisado`                                  → 9 rojos.
//   · la bajada creída a la primera (`vistas < 1`)                                → 1 rojo.
//   · la primera lectura avisando también un aprobado viejo                       → 3 rojos.
// La rotura se corrió con scripts de un solo uso que restauran el archivo de memoria, nunca con git.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEMS, leerGuardado, listaDeAprobaciones, mensajeDeAvisos, textoDeLaLista, vuelta, SIN_LEER_AVISA_MS,
  type Guardado, type Lectura,
} from '../lib/vigia-aprobaciones';
import { LECTORES } from '../lib/vigia-aprobaciones-fuentes';
import { marcasDeVoseo } from '../lib/voseo';

const T0 = Date.parse('2026-11-04T12:00:00Z');
const HORA = 3600_000;

/** Todas las lecturas de una vuelta: lo que se pasa pisa a una base donde todo «no pude leer» no aplica (a mano / leído). */
function lecturas(o: Record<string, Lectura>): Record<string, Lectura> {
  const base: Record<string, Lectura> = {};
  for (const it of ITEMS) base[it.id] = it.aMano ? { tipo: 'a_mano' } : { tipo: 'leido', fuente: 'x', estado: 'en_revision' };
  return { ...base, ...o };
}

/** Lo guardado después de una primera vuelta «tranquila» (todo leído, los a mano ya avisados). */
function arrancado(o: Record<string, Lectura> = {}): Guardado {
  return vuelta(null, lecturas(o), T0).nuevo;
}

test('regla 1: avisa al pasar a aprobado, y no al pasar a revisión ni al seguir igual', () => {
  const g0 = arrancado({ 'app-store': { tipo: 'leido', fuente: 'asc-api', estado: 'sin_enviar', version: '1.0' } });
  const r1 = vuelta(g0, lecturas({ 'app-store': { tipo: 'leido', fuente: 'asc-api', estado: 'en_revision', version: '1.0' } }), T0 + HORA);
  assert.deepEqual(r1.avisos, [], 'pasar a revisión no avisa');
  const r2 = vuelta(r1.nuevo, lecturas({ 'app-store': { tipo: 'leido', fuente: 'asc-api', estado: 'aprobado', version: '1.0' } }), T0 + 2 * HORA);
  assert.deepEqual(r2.avisos.map((a) => [a.item, a.tipo]), [['app-store', 'aprobado']]);
  const r3 = vuelta(r2.nuevo, lecturas({ 'app-store': { tipo: 'leido', fuente: 'asc-api', estado: 'aprobado', version: '1.0' } }), T0 + 3 * HORA);
  assert.deepEqual(r3.avisos, [], 'sin cambios no avisa nada');
  assert.equal(mensajeDeAvisos(r3.avisos), null, 'nunca un «sin novedades»');
});

test('rechazado y «piden algo» avisan, con qué hacer y el link', () => {
  const g0 = arrancado({ 'play-produccion': { tipo: 'leido', fuente: 'play-api', estado: 'en_revision', version: '1 (1.0)' } });
  const r = vuelta(g0, lecturas({
    'play-produccion': { tipo: 'leido', fuente: 'play-api', estado: 'rechazado', version: '1 (1.0)' },
    'resend-dominios': { tipo: 'leido', fuente: 'x', estado: 'piden_algo', detalle: 'hola-mako.com: le falta un registro DNS' },
  }), T0 + HORA);
  assert.deepEqual(r.avisos.map((a) => a.tipo).sort(), ['piden_algo', 'rechazado']);
  const m = mensajeDeAvisos(r.avisos)!;
  assert.ok(m.texto.startsWith('⛔'), 'lo rechazado va primero');
  assert.match(m.texto, /rechazado \(1 \(1\.0\)\)\. Lee el motivo en Play Console/);
  assert.match(m.texto, /https:\/\/play\.google\.com\/console/);
  assert.match(m.texto, /piden algo\. hola-mako\.com: le falta un registro DNS\. Revisa los registros DNS/);
  assert.equal(m.titulo, 'Aprobaciones: 2 novedades');
});

test('una versión nueva aprobada avisa; la misma no', () => {
  const g0 = arrancado({ 'chrome-web-store': { tipo: 'leido', fuente: 'cws-ficha', estado: 'aprobado', version: '0.74.3' } });
  const r = vuelta(g0, lecturas({ 'chrome-web-store': { tipo: 'leido', fuente: 'cws-ficha', estado: 'aprobado', version: '0.75.0' } }), T0 + HORA);
  assert.deepEqual(r.avisos.map((a) => [a.tipo, a.version]), [['aprobado', '0.75.0']]);
  assert.match(mensajeDeAvisos(r.avisos)!.texto, /Extensión de Chrome \(Chrome Web Store\)\*: aprobado \(0\.75\.0\)/);
});

test('regla 2: «no pude leer» no toca lo guardado, y avisa UNA vez si pasa un día', () => {
  const g0 = arrancado({ 'app-store': { tipo: 'leido', fuente: 'asc-api', estado: 'en_revision', version: '1.0' } });
  let g = g0;
  const sinLeer = lecturas({ 'app-store': { tipo: 'no_pude', motivo: 'App Store Connect contestó HTTP 503' } });
  for (let h = 1; h <= 23; h++) {
    const r = vuelta(g, sinLeer, T0 + h * HORA);
    assert.deepEqual(r.avisos, [], `hora ${h}: todavía no avisa`);
    g = r.nuevo;
  }
  assert.equal(g.items['app-store'].estado, 'en_revision', 'la falta de dato no es una aprobación ni un rechazo');
  assert.equal(g.items['app-store'].version, '1.0');
  const r24 = vuelta(g, sinLeer, T0 + HORA + SIN_LEER_AVISA_MS);
  assert.deepEqual(r24.avisos.map((a) => a.tipo), ['sin_leer']);
  assert.match(mensajeDeAvisos(r24.avisos)!.texto, /hace un día que no puedo leerlo \(App Store Connect contestó HTTP 503\)/);
  const r25 = vuelta(r24.nuevo, sinLeer, T0 + 2 * HORA + SIN_LEER_AVISA_MS);
  assert.deepEqual(r25.avisos, [], 'no se repite cada hora');
  // Vuelve a leer: se limpia, y una caída nueva vuelve a contar desde cero.
  const ok = vuelta(r25.nuevo, lecturas({ 'app-store': { tipo: 'leido', fuente: 'asc-api', estado: 'en_revision', version: '1.0' } }), T0 + 30 * HORA);
  assert.deepEqual(ok.avisos, []);
  assert.equal(ok.nuevo.items['app-store'].sinLeerDesde, undefined);
  assert.equal(ok.nuevo.items['app-store'].avisoSinLeer, undefined);
});

test('regla 3: lo que se mira a mano se dice UNA sola vez, con su link y lo que falta', () => {
  const r1 = vuelta(null, lecturas({ 'play-prueba-cerrada': { tipo: 'sin_credencial', faltan: ['TIENDAS_GOOGLE_CUENTA_SERVICIO'] } }), T0);
  const aMano = r1.avisos.filter((a) => a.tipo === 'a_mano').map((a) => a.item).sort();
  assert.deepEqual(aMano, [...ITEMS.filter((i) => i.aMano).map((i) => i.id), 'play-prueba-cerrada'].sort());
  const m = mensajeDeAvisos(r1.avisos)!;
  assert.equal(m.titulo, 'Aprobaciones para mirar a mano');
  assert.match(m.texto, /Esto no lo puedo leer solo/);
  assert.match(m.texto, /prueba cerrada \(Google Play\): https:\/\/play\.google\.com\/console \(para leerlo solo, carga TIENDAS_GOOGLE_CUENTA_SERVICIO en Integraciones\)/);
  assert.equal(r1.nuevo.items['google-oauth'].estado, undefined, 'a mano no inventa un estado');
  const r2 = vuelta(r1.nuevo, lecturas({ 'play-prueba-cerrada': { tipo: 'sin_credencial', faltan: ['TIENDAS_GOOGLE_CUENTA_SERVICIO'] } }), T0 + HORA);
  assert.deepEqual(r2.avisos, [], 'la segunda vez no se repite');
});

test('regla 4: la primera lectura no avisa una aprobación vieja, pero sí lo que pide algo', () => {
  const r = vuelta(null, lecturas({
    'chrome-web-store': { tipo: 'leido', fuente: 'cws-ficha', estado: 'aprobado', version: '0.74.3' },
    'app-store': { tipo: 'leido', fuente: 'asc-api', estado: 'rechazado', version: '1.0' },
  }), T0);
  const deEstado = r.avisos.filter((a) => a.tipo !== 'a_mano');
  assert.deepEqual(deEstado.map((a) => [a.item, a.tipo]), [['app-store', 'rechazado']]);
  // Cambiar de fuente (se cargó la clave) es otra primera lectura: un «aprobado» no se anuncia por eso.
  const g = arrancado({ 'chrome-web-store': { tipo: 'leido', fuente: 'cws-ficha', estado: 'aprobado', version: '0.74.3' } });
  const r2 = vuelta(g, lecturas({ 'chrome-web-store': { tipo: 'leido', fuente: 'cws-api', estado: 'aprobado', version: '0.74.5' } }), T0 + HORA);
  assert.deepEqual(r2.avisos, []);
});

test('regla 5: lo publicado que deja de aparecer se cree a la SEGUNDA lectura', () => {
  const g = arrancado({ 'play-produccion': { tipo: 'leido', fuente: 'play-ficha', estado: 'aprobado' } });
  const r1 = vuelta(g, lecturas({ 'play-produccion': { tipo: 'leido', fuente: 'play-ficha', estado: 'sin_publicar' } }), T0 + HORA);
  assert.deepEqual(r1.avisos, [], 'un 404 suelto no es una app bajada');
  assert.equal(r1.nuevo.items['play-produccion'].estado, 'aprobado');
  const r2 = vuelta(r1.nuevo, lecturas({ 'play-produccion': { tipo: 'leido', fuente: 'play-ficha', estado: 'sin_publicar' } }), T0 + 2 * HORA);
  assert.deepEqual(r2.avisos.map((a) => a.tipo), ['bajada']);
  assert.match(mensajeDeAvisos(r2.avisos)!.texto, /ya no figura como aprobado/);
  // Y si vuelve a aparecer después de un solo 404, no pasó nada.
  const r1b = vuelta(g, lecturas({ 'play-produccion': { tipo: 'leido', fuente: 'play-ficha', estado: 'sin_publicar' } }), T0 + HORA);
  const r2b = vuelta(r1b.nuevo, lecturas({ 'play-produccion': { tipo: 'leido', fuente: 'play-ficha', estado: 'aprobado' } }), T0 + 2 * HORA);
  assert.deepEqual(r2b.avisos, []);
  assert.equal(r2b.nuevo.items['play-produccion'].bajadaVista, undefined);
});

test('lo aprobado por partes avisa cada parte nueva (los permisos de Meta)', () => {
  const g = arrancado({ 'meta-permisos': { tipo: 'leido', fuente: 'meta-api', estado: 'sin_publicar', logros: [] } });
  const r = vuelta(g, lecturas({ 'meta-permisos': { tipo: 'leido', fuente: 'meta-api', estado: 'sin_publicar', logros: ['ads_read', 'pages_show_list'] } }), T0 + HORA);
  assert.deepEqual(r.avisos.map((a) => [a.tipo, a.nuevos]), [['aprobado', ['ads_read', 'pages_show_list']]]);
  assert.match(mensajeDeAvisos(r.avisos)!.texto, /permisos aprobados\*: aprobó ads_read, pages_show_list\./);
  const r2 = vuelta(r.nuevo, lecturas({ 'meta-permisos': { tipo: 'leido', fuente: 'meta-api', estado: 'sin_publicar', logros: ['pages_show_list', 'ads_read'] } }), T0 + 2 * HORA);
  assert.deepEqual(r2.avisos, [], 'los mismos, en otro orden, no avisan');
});

test('lo guardado roto es empezar de cero, nunca «todo aprobado»', () => {
  assert.deepEqual(leerGuardado('{no es json'), { v: 1, items: {} });
  assert.deepEqual(leerGuardado(null), { v: 1, items: {} });
  assert.deepEqual(leerGuardado('{"v":1}'), { v: 1, items: {} });
  const ida = arrancado();
  assert.deepEqual(leerGuardado(JSON.stringify(ida)), ida);
});

test('la lista: lo que espera primero, y lo que se mira a mano nunca figura aprobado', () => {
  let g = arrancado({ 'chrome-web-store': { tipo: 'leido', fuente: 'cws-ficha', estado: 'aprobado', version: '0.74.3', faltan: ['CWS_PUBLISHER_ID'] } });
  g = vuelta(g, lecturas({
    'chrome-web-store': { tipo: 'leido', fuente: 'cws-ficha', estado: 'aprobado', version: '0.74.3', faltan: ['CWS_PUBLISHER_ID'] },
    'app-store': { tipo: 'no_pude', motivo: 'App Store Connect no contestó a tiempo' },
  }), T0 + HORA).nuevo;
  const filas = listaDeAprobaciones(g);
  const primeraAprobada = filas.findIndex((f) => !f.esperando);
  assert.ok(primeraAprobada > 0 && filas.slice(primeraAprobada).every((f) => !f.esperando), 'lo que espera va arriba');
  const cws = filas.find((f) => f.id === 'chrome-web-store')!;
  assert.equal(cws.situacion, 'Aprobado');
  assert.deepEqual(cws.faltan, ['CWS_PUBLISHER_ID']);
  assert.equal(filas.find((f) => f.id === 'google-oauth')!.situacion, 'Hay que mirarlo a mano');
  assert.match(filas.find((f) => f.id === 'app-store')!.situacion, /^En revisión \(lo último que leí; ahora no puedo/);
  assert.match(textoDeLaLista(filas, g.ultimaVuelta), /Esperando \(\d+\):/);
  assert.match(listaDeAprobaciones(null)[0].situacion, /Todavía no lo revisé|Hay que mirarlo a mano/);
});

test('el inventario y los lectores son los mismos: ninguno sin el otro', () => {
  assert.deepEqual(Object.keys(LECTORES).sort(), ITEMS.map((i) => i.id).sort());
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length, 'ids repetidos');
});

test('los ítems a mano dicen «a mano», sin red', async () => {
  for (const it of ITEMS.filter((i) => i.aMano)) {
    const l = await LECTORES[it.id]({ fetch: () => { throw new Error('no debe pedir nada'); } } as never, async () => ({ token: 'x' }));
    assert.deepEqual(l, { tipo: 'a_mano' }, it.id);
  }
});

test('lo que lee Martín está en español neutro (sin voseo) y cada «qué hacer» arranca con un verbo', () => {
  const textos = ITEMS.flatMap((i) => [i.nombre, i.queHacer, i.nota ?? '']);
  const r = vuelta(null, lecturas({
    'app-store': { tipo: 'leido', fuente: 'x', estado: 'rechazado', detalle: 'Por la ficha' },
    'play-produccion': { tipo: 'leido', fuente: 'x', estado: 'piden_algo' },
  }), T0);
  textos.push(mensajeDeAvisos(r.avisos)!.texto, textoDeLaLista(listaDeAprobaciones(r.nuevo), r.nuevo.ultimaVuelta));
  for (const t of textos) assert.deepEqual(marcasDeVoseo(t), [], t);
  for (const it of ITEMS) assert.match(it.queHacer, /^(Lee|Revisa|Mira|Contesta)\b/, it.id);
});
