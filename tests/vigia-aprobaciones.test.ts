// =============================================================================
// El vigía de las aprobaciones: CUÁNDO avisa y qué guarda (lib/vigia-aprobaciones.ts)
// =============================================================================
// Pedido de Martín (4/11/2026): «crea un script que me vaya avisando de todas las notficaciones de aprobaciones pendientes…».
// Y ese mismo día: que no le manden nada de rutina. Estos tests fijan las cinco reglas de la cabecera del módulo con estados
// reales: aprobado, rechazado, «piden algo», sin leer, sin cambios, un panel y lo que falta para leerlo solo.
//
// Probado rompiéndolo el 4/11/2026 (base, este archivo y el de los lectores juntos: 26 pases, 0 fallos):
//   · avisar también al pasar a revisión (`en_revision` en PIDE_ACCION)          → 3 rojos (reglas 1, 3 y 4).
//   · «no pude leer» escribiendo el estado (sin `...loLeido(p)`)                  → 2 rojos (regla 2 y la lista).
//   · el aviso de «no pude leer» sin el `!avisoSinLeer`                          → 1 rojo (se repetía cada hora).
//   · el aviso «a mano» sin el `!p.aManoAvisado`                                  → 9 rojos.
//   · la bajada creída a la primera (`vistas < 1`)                                → 1 rojo.
//   · la primera lectura avisando también un aprobado viejo                       → 3 rojos.
// La rotura se corrió con scripts de un solo uso que restauran el archivo de memoria, nunca con git.
//
// La lista de la pestaña Approvals (5/11/2026; base 16 pases, 0 fallos):
//   · sin ordenar por prioridad (sólo el orden del inventario)                    → 2 rojos.
//   · `viejo` siempre falso                                                      → 1 rojo.
//   · lo que falta sin juntar (las tres claves de Apple, tres veces)              → 1 rojo.
//   · «qué hacer» en toda fila, no sólo en lo que pide algo                       → 1 rojo.
//
// Los paneles y lo que falta (5/11/2026, con tests/vigia-aprobaciones-fuentes.test.ts; base 34 pases, 0 fallos). Cada una, 1 rojo:
//   · una lectura de panel sin vencer nunca (regla 6) · lo que falta avisado una sola vez aunque cambie (regla 3)
//   · la marca vieja `aManoAvisado` ignorada (avisaba todo de nuevo) · la hora de la vuelta en lugar de la del panel
//   · el texto del panel comparado con tildes · «no pude» contado desde la vuelta y no desde la última lectura
//   · la base caída leída como «falta leer el panel» (lib/vigia-aprobaciones-fuentes.ts).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEMS, leerGuardado, listaDeAprobaciones, mensajeDeAvisos, textoDeLaLista, vuelta, SIN_LEER_AVISA_MS, VIEJO_MS, itemPorId,
  faltaEnPalabras, FALTA_EN_PALABRAS, FALTA_LECTURA_PANEL, lecturaDePanel, anotarPanel, leerPaneles, estadoDeTextoDePanel,
  MAX_NOTA_PANEL, type Guardado, type Lectura,
} from '../lib/vigia-aprobaciones';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
import { DEFS as INTEGRACIONES } from '../lib/integraciones-catalogo';
import { LECTORES } from '../lib/vigia-aprobaciones-fuentes';
import { marcasDeVoseo } from '../lib/voseo';

const T0 = Date.parse('2026-11-04T12:00:00Z');
const HORA = 3600_000;

/** Todas las lecturas de una vuelta: lo que se pasa pisa a una base donde todo se leyó (los paneles, sin leer todavía). */
function lecturas(o: Record<string, Lectura>): Record<string, Lectura> {
  const base: Record<string, Lectura> = {};
  for (const it of ITEMS) base[it.id] = it.panel ? { tipo: 'sin_credencial', faltan: [FALTA_LECTURA_PANEL] } : { tipo: 'leido', fuente: 'x', estado: 'en_revision' };
  return { ...base, ...o };
}

/** Lo guardado después de una primera vuelta «tranquila» (todo leído, lo que le falta a cada panel ya avisado). */
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

test('regla 3: lo que falta para leer algo solo se dice UNA vez, en palabras; y otra vez sólo si cambia', () => {
  const r1 = vuelta(null, lecturas({ 'play-prueba-cerrada': { tipo: 'sin_credencial', faltan: ['TIENDAS_GOOGLE_CUENTA_SERVICIO'] } }), T0);
  const faltas = r1.avisos.filter((a) => a.tipo === 'falta').map((a) => a.item).sort();
  assert.deepEqual(faltas, [...ITEMS.filter((i) => i.panel).map((i) => i.id), 'play-prueba-cerrada'].sort());
  const m = mensajeDeAvisos(r1.avisos)!;
  assert.equal(m.titulo, 'Aprobaciones: falta algo para leerlas solas');
  assert.match(m.texto, /Para leer esto solo falta:/);
  assert.match(m.texto, /prueba cerrada \(Google Play\): la cuenta de servicio de Google\./);
  assert.match(m.texto, /App de Google \(inicio de sesión y agenda\): que la tarea del Cerebro lea su panel/);
  assert.doesNotMatch(m.texto, /TIENDAS_GOOGLE|LECTURA_DEL_PANEL/, 'el mensaje no nombra variables');
  assert.equal(r1.nuevo.items['google-oauth'].estado, undefined, 'lo que falta no inventa un estado');
  const r2 = vuelta(r1.nuevo, lecturas({ 'play-prueba-cerrada': { tipo: 'sin_credencial', faltan: ['TIENDAS_GOOGLE_CUENTA_SERVICIO'] } }), T0 + HORA);
  assert.deepEqual(r2.avisos, [], 'la segunda vez no se repite');
  const r3 = vuelta(r2.nuevo, lecturas({ 'play-prueba-cerrada': { tipo: 'sin_credencial', faltan: ['TIENDAS_GOOGLE_CUENTA_SERVICIO', 'CWS_PUBLISHER_ID'] } }), T0 + 2 * HORA);
  assert.deepEqual(r3.avisos.map((a) => [a.item, a.tipo]), [['play-prueba-cerrada', 'falta']], 'lo que falta cambió: se dice otra vez');
});

test('regla 3: una fila de antes del 5/11 («míralo…», `aManoAvisado`) no avisa de nuevo por el cambio de nombre', () => {
  const viejo: Guardado = { v: 1, items: Object.fromEntries(ITEMS.filter((i) => i.panel).map((i) => [i.id, { aManoAvisado: true }])) };
  const r = vuelta(viejo, lecturas({}), T0);
  assert.deepEqual(r.avisos, []);
  assert.ok(Object.values(r.nuevo.items).every((x) => !('aManoAvisado' in x)), 'la marca vieja se reemplaza por la nueva');
});

test('regla 4: la primera lectura no avisa una aprobación vieja, pero sí lo que pide algo', () => {
  const r = vuelta(null, lecturas({
    'chrome-web-store': { tipo: 'leido', fuente: 'cws-ficha', estado: 'aprobado', version: '0.74.3' },
    'app-store': { tipo: 'leido', fuente: 'asc-api', estado: 'rechazado', version: '1.0' },
  }), T0);
  const deEstado = r.avisos.filter((a) => a.tipo !== 'falta');
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

test('la lista: lo que espera primero, y lo que no se pudo leer nunca figura aprobado', () => {
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
  assert.match(filas.find((f) => f.id === 'google-oauth')!.situacion, /^Falta: que la tarea del Cerebro lea su panel/);
  assert.equal(filas.find((f) => f.id === 'google-oauth')!.estadoCorto, 'Sin leer');
  assert.match(filas.find((f) => f.id === 'app-store')!.situacion, /^En revisión \(lo último que leí; ahora no puedo/);
  assert.match(textoDeLaLista(filas, g.ultimaVuelta), /Esperando \(\d+\):/);
  assert.match(listaDeAprobaciones(null)[0].situacion, /Todavía no lo revisé/);
});

test('Approvals: lo que pide algo va primero, lo aprobado al final, y dentro de cada uno el orden del inventario', () => {
  const g = arrancado({
    'resend-dominios': { tipo: 'leido', fuente: 'x', estado: 'aprobado' },
    'chrome-web-store': { tipo: 'leido', fuente: 'x', estado: 'piden_algo', detalle: 'Google mandó una advertencia' },
    'play-produccion': { tipo: 'leido', fuente: 'x', estado: 'rechazado', version: '3' },
    'app-store': { tipo: 'leido', fuente: 'x', estado: 'sin_enviar' },
  });
  const filas = listaDeAprobaciones(g, T0);
  assert.deepEqual(filas.slice(0, 2).map((f) => f.id), ['play-produccion', 'chrome-web-store'], 'los dos que piden algo, en el orden del inventario');
  assert.deepEqual(filas.slice(0, 2).map((f) => [f.estadoCorto, f.tono]), [['Rechazado', 'bad'], ['Piden algo', 'warn']]);
  assert.equal(filas[0].queHacer, itemPorId('play-produccion')!.queHacer, 'lo que pide algo dice qué hacer');
  assert.equal(filas.find((f) => f.id === 'app-store')!.queHacer, null, 'lo demás no');
  assert.equal(filas[filas.length - 1].id, 'resend-dominios', 'lo aprobado va al final');
  const prioridades = filas.map((f) => f.prioridad);
  assert.deepEqual(prioridades, [...prioridades].sort((a, b) => a - b), 'ordenada por prioridad');
});

test('Approvals: una fila sin lectura buena hace más de un día se marca vieja; la de hoy no', () => {
  const g = arrancado({ 'app-store': { tipo: 'leido', fuente: 'asc-api', estado: 'en_revision' } });
  assert.equal(listaDeAprobaciones(g, T0 + 23 * HORA).find((f) => f.id === 'app-store')!.viejo, false);
  const tarde = listaDeAprobaciones(g, T0 + VIEJO_MS + HORA).find((f) => f.id === 'app-store')!;
  assert.equal(tarde.viejo, true);
  assert.equal(tarde.estadoCorto, 'En revisión', 'viejo no cambia el estado: lo dice al lado');
  assert.equal(listaDeAprobaciones(null, T0).every((f) => f.viejo === false), true, 'lo que nunca se leyó no está viejo: está sin leer');
});

test('Approvals: lo que falta se dice en palabras, sin repetir, con la tarjeta donde se carga', () => {
  assert.deepEqual(faltaEnPalabras(['ASC_ISSUER_ID', 'ASC_KEY_ID', 'ASC_P8']), [{ texto: 'La clave de App Store Connect', integracion: 'app-store-connect' }]);
  assert.deepEqual(faltaEnPalabras(['TIENDAS_GOOGLE_CUENTA_SERVICIO', 'CWS_PUBLISHER_ID']).map((f) => f.integracion), ['tiendas-google', 'tiendas-google']);
  assert.deepEqual(faltaEnPalabras(['la clave de Resend que administra dominios (variable de Vercel)']),
    [{ texto: 'La clave de Resend que administra dominios (variable de Vercel)', integracion: null }], 'lo que ya viene en palabras pasa tal cual');
  const g = vuelta(null, lecturas({ 'play-prueba-cerrada': { tipo: 'sin_credencial', faltan: ['TIENDAS_GOOGLE_CUENTA_SERVICIO'] } }), T0).nuevo;
  const fila = listaDeAprobaciones(g, T0).find((f) => f.id === 'play-prueba-cerrada')!;
  assert.deepEqual(fila.falta, [{ texto: 'La cuenta de servicio de Google', integracion: 'tiendas-google' }]);
  assert.equal(fila.prioridad, 1, 'lo que no se puede leer va antes que lo que está en revisión');
  // Cada tarjeta nombrada existe en el catálogo de Integraciones: un botón «Cargarla» que abre una tarjeta que no existe no hace nada.
  const tarjetas = new Set(INTEGRACIONES.map((i) => i.key));
  for (const f of Object.values(FALTA_EN_PALABRAS)) if (f.integracion) assert.ok(tarjetas.has(f.integracion), f.integracion);
});

test('el inventario y los lectores son los mismos: ninguno sin el otro', () => {
  assert.deepEqual(Object.keys(LECTORES).sort(), ITEMS.map((i) => i.id).sort());
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length, 'ids repetidos');
});

test('los ítems sin API leen lo guardado de su panel, sin red', async () => {
  const sinRed = { fetch: () => { throw new Error('no debe pedir nada'); }, ahoraMs: () => T0 };
  const paneles = { v: 1 as const, items: { 'creem-tienda': { estado: 'en_revision' as const, nota: 'Under review', leidoAt: new Date(T0 - HORA).toISOString() } } };
  for (const it of ITEMS.filter((i) => i.panel)) {
    const l = await LECTORES[it.id]({ ...sinRed, paneles } as never, async () => ({ token: 'x' }));
    if (it.id === 'creem-tienda') assert.deepEqual(l, { tipo: 'leido', fuente: 'panel', estado: 'en_revision', detalle: 'Under review', leidoAt: new Date(T0 - HORA).toISOString() });
    else assert.deepEqual(l, { tipo: 'sin_credencial', faltan: [FALTA_LECTURA_PANEL] }, it.id);
    const caida = await LECTORES[it.id]({ ...sinRed, paneles: null } as never, async () => ({ token: 'x' }));
    assert.equal(caida.tipo, 'no_pude', `${it.id}: la base caída es «no pude», no «falta leerlo»`);
  }
});

test('regla 6: una lectura de panel vale un día; después es «no pude» desde su hora, y avisa UNA vez', () => {
  const leida = new Date(T0).toISOString();
  const p = { v: 1 as const, items: { 'google-oauth': { estado: 'aprobado' as const, leidoAt: leida } } };
  const l1 = lecturaDePanel(p, 'google-oauth', T0 + HORA);
  assert.deepEqual(l1, { tipo: 'leido', fuente: 'panel', estado: 'aprobado', detalle: null, leidoAt: leida });
  const r1 = vuelta(null, lecturas({ 'google-oauth': l1 }), T0 + HORA);
  assert.equal(r1.nuevo.items['google-oauth'].leidoAt, leida, 'la hora es la de la lectura del panel, no la de la vuelta');
  const l2 = lecturaDePanel(p, 'google-oauth', T0 + VIEJO_MS + HORA);
  assert.equal(l2.tipo, 'no_pude');
  assert.match(l2.tipo === 'no_pude' ? l2.motivo : '', /nadie leyó el panel desde el 4\/11 a las 12:00 UTC/);
  const r2 = vuelta(r1.nuevo, lecturas({ 'google-oauth': l2 }), T0 + VIEJO_MS + HORA);
  assert.deepEqual(r2.avisos.map((a) => [a.item, a.tipo]), [['google-oauth', 'sin_leer']], 'un día sin leerse: avisa ya');
  assert.equal(r2.nuevo.items['google-oauth'].estado, 'aprobado', 'lo último leído no se borra');
  const r3 = vuelta(r2.nuevo, lecturas({ 'google-oauth': lecturaDePanel(p, 'google-oauth', T0 + VIEJO_MS + 2 * HORA) }), T0 + VIEJO_MS + 2 * HORA);
  assert.deepEqual(r3.avisos, [], 'y no se repite cada hora');
  const fila = listaDeAprobaciones(r3.nuevo, T0 + VIEJO_MS + 2 * HORA).find((f) => f.id === 'google-oauth')!;
  assert.equal(fila.viejo, true);
  assert.match(fila.motivo ?? '', /nadie leyó el panel/);
  // La tarea dijo que no pudo: eso es «no pude», con su motivo.
  const noPudo = lecturaDePanel({ v: 1, items: { 'google-oauth': { noPude: 'la sesión venció', leidoAt: leida } } }, 'google-oauth', T0 + HORA);
  assert.deepEqual(noPudo, { tipo: 'no_pude', motivo: 'el panel: la sesión venció', desde: leida });
});

test('anotar un panel: sólo un ítem sin API, un estado conocido o el motivo; la nota se corta sin partir un emoji', () => {
  assert.equal(anotarPanel(null, 'app-store', { estado: 'aprobado' }, T0).ok, false, 'App Store se lee por API');
  assert.equal(anotarPanel(null, 'no-existe', { estado: 'aprobado' }, T0).ok, false);
  assert.equal(anotarPanel(null, 'creem-tienda', { estado: 'aprobada' }, T0).ok, false, 'un estado que no existe no se guarda');
  assert.equal(anotarPanel(null, 'creem-tienda', { noPude: '   ' }, T0).ok, false, 'sin motivo no hay «no pude»');
  const r = anotarPanel({ v: 1, items: { 'google-oauth': { estado: 'aprobado', leidoAt: 'x' } } }, 'creem-tienda', { estado: 'piden_algo', nota: `${'a'.repeat(MAX_NOTA_PANEL - 1)}😀😀` }, T0);
  assert.ok(r.ok);
  assert.ok(r.ok && 'google-oauth' in r.nuevo.items, 'no pisa los otros paneles');
  const nota = r.ok && 'estado' in r.lectura ? r.lectura.nota ?? '' : '';
  assert.equal([...nota].length, MAX_NOTA_PANEL);
  assert.ok(nota.endsWith('…') && !/[\uD800-\uDBFF]$/.test(nota.slice(0, -1)), 'cortada sin medio emoji');
  // Ida y vuelta por lo guardado.
  assert.deepEqual(leerPaneles(JSON.stringify(r.ok ? r.nuevo : null)).items['creem-tienda'], r.ok ? r.lectura : null);
  assert.deepEqual(leerPaneles('{"items":{"app-store":{"estado":"aprobado","leidoAt":"2026-11-05T00:00:00Z"},"creem-tienda":{"estado":"raro","leidoAt":"x"}}}').items, {}, 'lo que no se entiende no es una lectura');
});

test('el texto de un panel se traduce con su tabla, y una negación no es una aprobación', () => {
  assert.equal(estadoDeTextoDePanel('creem-tienda', 'Your store is Under Review'), 'en_revision');
  assert.equal(estadoDeTextoDePanel('creem-tienda', 'Store approved'), 'aprobado');
  assert.equal(estadoDeTextoDePanel('creem-tienda', 'Not approved'), 'rechazado');
  assert.equal(estadoDeTextoDePanel('creem-tienda', 'Unverified'), 'piden_algo');
  assert.equal(estadoDeTextoDePanel('meta-verificaciones', 'Negocio no verificado'), 'sin_enviar');
  assert.equal(estadoDeTextoDePanel('meta-verificaciones', 'Verificación de acceso: VERIFICADO'), 'aprobado');
  assert.equal(estadoDeTextoDePanel('google-oauth', 'Not verified'), 'sin_enviar');
  assert.equal(estadoDeTextoDePanel('firma-windows', 'Order status: validating, please wait'), 'en_revision');
  assert.equal(estadoDeTextoDePanel('play-cuenta', 'Tu identidad está en revisión'), 'en_revision');
  assert.equal(estadoDeTextoDePanel('creem-tienda', 'algo que no está en la tabla'), null, 'lo desconocido no se adivina');
  assert.equal(estadoDeTextoDePanel('app-store', 'approved'), null, 'App Store no tiene panel');
  // Cada tabla: ninguna frase de «aprobado» aparece adentro de una de otro estado que vaya DESPUÉS (la negación quedaría tapada).
  for (const it of ITEMS.filter((i) => i.panel)) {
    const t = it.panel!.traduccion;
    t.forEach((x, i) => t.slice(i + 1).forEach((y) => {
      if (x.estado === 'aprobado' && y.estado !== 'aprobado') assert.ok(!y.dice.includes(x.dice), `${it.id}: «${y.dice}» queda tapada por «${x.dice}»`);
    }));
  }
});

test('nada dice «a mano»: ni los avisos, ni la lista, ni los paneles, ni la API, ni la pantalla', () => {
  const r = vuelta(null, lecturas({ 'app-store': { tipo: 'no_pude', motivo: 'x' } }), T0);
  const r2 = vuelta(r.nuevo, lecturas({ 'app-store': { tipo: 'no_pude', motivo: 'x' } }), T0 + SIN_LEER_AVISA_MS + HORA);
  const textos = [
    mensajeDeAvisos(r.avisos)!.texto, mensajeDeAvisos(r2.avisos)!.texto, textoDeLaLista(listaDeAprobaciones(r2.nuevo, T0), r2.nuevo.ultimaVuelta),
    ...listaDeAprobaciones(r2.nuevo, T0).flatMap((f) => [f.situacion, f.estadoCorto, ...f.falta.map((x) => x.texto)]),
    ...ITEMS.flatMap((i) => [i.nombre, i.queHacer, i.nota ?? '', i.panel?.mirar ?? '']),
    ...Object.values(FALTA_EN_PALABRAS).map((f) => f.texto),
  ];
  for (const t of textos) assert.doesNotMatch(t, /a mano/i, t);
  // Lo que leen la pantalla y MaKo, sin los comentarios (que citan el pedido de Martín).
  const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const f of ['app/admin/approvals/ListaApprovals.tsx', 'app/m/approvals/ApprovalsM.tsx', 'lib/api-mako/areas/operaciones.def.ts', 'lib/api-mako/areas/operaciones.run.ts']) {
    assert.doesNotMatch(sinComentarios(readFileSync(join(RAIZ, f), 'utf8')), /a mano/i, f);
  }
});

test('lo que lee Martín está en español neutro (sin voseo) y cada «qué hacer» arranca con un verbo', () => {
  const textos = ITEMS.flatMap((i) => [i.nombre, i.queHacer, i.nota ?? '', i.panel?.mirar ?? '']);
  const r = vuelta(null, lecturas({
    'app-store': { tipo: 'leido', fuente: 'x', estado: 'rechazado', detalle: 'Por la ficha' },
    'play-produccion': { tipo: 'leido', fuente: 'x', estado: 'piden_algo' },
  }), T0);
  textos.push(mensajeDeAvisos(r.avisos)!.texto, textoDeLaLista(listaDeAprobaciones(r.nuevo), r.nuevo.ultimaVuelta));
  for (const t of textos) assert.deepEqual(marcasDeVoseo(t), [], t);
  for (const it of ITEMS) assert.match(it.queHacer, /^(Lee|Revisa|Mira|Contesta)\b/, it.id);
});
