// =============================================================================
// EL CARRIL DEL RECORDATORIO del motor (undécima tanda, M3 y M4)
// =============================================================================
// Pedido de Martín (11/10/2026, punto 8): «"Recordatorio de reunión" NO debería ser un flujo aparte, para eso ya
// tenemos el flujo de "Agendó reunión", los recordatorios se pueden configurar allí mismo con DELAY... Y que el único
// flujo pase a llamarse "Un Lead Agendó Llamada"». El recordatorio era un EMISOR aparte (lib/reunion-recordatorio.ts,
// #228) con reglas que el motor no tenía. Una tarjeta que cuelga de un DELAY «N antes de la reunión» es del CARRIL
// y tiene las del emisor (docs/diseno-undecima-tanda.md §4, M3 a-h y M4); acá se fijan, sobre el flujo de §3:
//
//   entrada (CRON «Agenda R1») → nvlvg08 ⏳1 h → o0 ✉ → nh92v3h ⏳24 h → o1 ✉ → ne9jyr0 «MaKo»     (la preparación)
//                              ⇉ u11aviso «MaKo en WhatsApp» «Nuevo agendado»                        (el aviso)
//                              ⇉ u11e1440 ⏳1 día antes → u11t1440 ✉ → u11e60 ⏳1 h antes → u11t60 ✉
//                                → u11e15 ⏳15 min antes → u11t15 ✉                                   (el carril)
//
// Lo puro vive en lib/nutricion-grafo-motor.ts; el cableado (lib/nutricion.ts, con `server-only`) se lee del FUENTE
// sin comentarios.
//
// Probado rompiéndolo (11/10/2026), una rotura por vez y restaurada con el script del scratchpad
// (wf-undecima/w2-motor-reuniones/roturas.mjs, nunca `git checkout`). Como está: 8 pasan / 0 fallan. Cada rotura,
// 7 pasan / 1 falla (la que la cuida):
//   (1)  quitar la tolerancia (el toque sale tarde)                           → (b)
//   (2)  `pasaPorAntiBan` ignorando el carril                                 → (d)
//   (3)  el motor pasándole `carril: false` al anti-ban                       → (d)
//   (4)  [14/10/2026] `seMueveEnLaCorrida` cortando lo de una 'respondio'      → M4
//   (5)  [14/10/2026] `pausarPorRespuesta` sacándole el próximo envío          → M4
//   (6)  la marca tomada sin frenar (sale dos veces con #228)                 → (c)
//   (7)  una clave del carril distinta de `claveToque`                        → (c)
//   (8)  el ancla laxa (una reunión cancelada o sin hora cuenta)              → (h)
//   (9)  `resolverControl` cerrando la inscripción entera sin hora             → (h)
//   (10) fuera de horario corre todo                                          → (f)
//   (11) `estadoAlEscribir` sin mantener 'respondio'                          → M4
//   (12) `aplazaParaNoTapar` sin aplazar (el hilo frenado tapa al carril)     → «no tapa»
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decidirToqueDelCarril, esHiloDelCarril, tieneCarril, esTarjetaMako, seMueveEnLaCorrida, pasaPorAntiBan, cuentaParaElCupo,
  estadoAlEscribir, desenlaceEsperaAlCarril, resolverControl, frenadoPorAntiBan, RELLENO_CONTROL,
  aplazaParaNoTapar, APLAZO_SIN_TAPAR_MS,
} from '../lib/nutricion-grafo-motor';
import { claveToque, claveDelCarril, toquesVencidos, juntasDe, TOLERANCIA_MIN, estadoDeLaMarca } from '../lib/recordatorio-lead';
import { proximaReunion } from '../lib/nutricion-reinscripcion';
import { normalizar, validarGrafo, indicePorId, type PasoGrafo } from '../lib/flujo-grafo';
import { OP_AVISAR } from '../lib/flujo-legado';

const MIN = 60_000;
const msg = (id: string, extra: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ id, canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: `hola ${id}`, template_wa: null, revisar: false, ...extra } as PasoGrafo);
const ctl = (id: string, extra: Partial<PasoGrafo>): PasoGrafo => ({ id, ...RELLENO_CONTROL, ...extra } as PasoGrafo);
const mako = (id: string, extra: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ id, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, accion: { operacion: OP_AVISAR, params: { leadId: 'evento', mensaje: 'Nuevo agendado: {{nombre_completo}}' } }, ...extra } as PasoGrafo);
const antes = (id: string, minutos: number, siguiente: string): PasoGrafo => ctl(id, { nodo: 'esperar', espera: { modo: 'antes_reunion', minutos }, siguiente });

/** «Un Lead Agendó Llamada» del ws1, como lo deja §3 (los AI Step y la condición, fuera: no cambian nada acá). */
const F: PasoGrafo[] = [
  ctl('nvlvg08', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'o0' }),
  msg('o0', { siguiente: 'nh92v3h' }),
  ctl('nh92v3h', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'o1' }),
  msg('o1', { siguiente: 'ne9jyr0' }),
  mako('ne9jyr0', { siguiente: null }),
  mako('u11aviso', { siguiente: null }),
  antes('u11e1440', 1440, 'u11t1440'),
  msg('u11t1440', { siguiente: 'u11e60' }),
  antes('u11e60', 60, 'u11t60'),
  msg('u11t60', { siguiente: 'u11e15' }),
  antes('u11e15', 15, 'u11t15'),
  msg('u11t15', { siguiente: null }),
  // (Hasta el 14/10/2026 a la tarde, el inicio decía qué camino se cortaba si el lead contestaba. Ya no: lo dice la
  // condición «No contestó desde que entró», tests/automations-condicion-contesto.test.ts.)
  ctl('entrada', { nodo: 'inicio', siguiente: 'nvlvg08', paralelos: ['u11aviso', 'u11e1440'] }),
];
const I = (id: string): number => indicePorId(F, id);

// El lead 2593 (inscripción 201): R1 el 13/10 a las 17:00 UTC (10:00 de Tijuana), con link.
const LEAD = 2593;
const INICIO = '2026-10-13T17:00:00.000Z';
const T = Date.parse(INICIO);
const juntas = (o: Record<string, unknown> = {}) => ({
  fecha_junta_1: '2026-10-13', junta_1_at: '2026-10-13T17:00:00+00:00', asistio_j1: null,
  fecha_junta_2: null, junta_2_at: null, asistio_j2: null, junta_1_url: 'https://meet.google.com/abc-defg-hij', junta_2_url: null, ...o,
});
const decidir = (id: string, ahoraMs: number, extra: Record<string, unknown> = {}) =>
  decidirToqueDelCarril({ leadId: LEAD, pasos: F, idx: I(id), juntas: juntas(), ahoraMs, tz: 'America/Tijuana', ...extra });

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NUTRI = sinComentarios(leer('../lib/nutricion.ts'));
const DESENLACE = sinComentarios(leer('../lib/nutricion-desenlace.ts'));
/** El cuerpo de una función de primer nivel, hasta la siguiente declaración de primer nivel. */
const cuerpo = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  const resto = src.slice(i + firma.length);
  const j = resto.search(/\n(?:export )?(?:async )?function |\nexport |\ntype /);
  return src.slice(i, i + firma.length + (j >= 0 ? j : resto.length));
};
const PROC = cuerpo(NUTRI, 'export async function procesarEnvios(');

test('el fixture es «Un Lead Agendó Llamada» guardable, con su carril', () => {
  assert.deepEqual(validarGrafo(normalizar(F)), []);
  assert.equal(tieneCarril(F), true);
  // Del carril: las tres esperas «antes» y sus tres WhatsApp. No: la preparación ni el aviso.
  for (const id of ['u11e1440', 'u11t1440', 'u11e60', 'u11t60', 'u11e15', 'u11t15']) assert.equal(esHiloDelCarril(F, I(id)), true, id);
  for (const id of ['nvlvg08', 'o0', 'nh92v3h', 'o1', 'ne9jyr0', 'u11aviso', 'entrada']) assert.equal(esHiloDelCarril(F, I(id)), false, id);
  assert.equal(esTarjetaMako(F[I('u11aviso')]), true);
  assert.equal(esTarjetaMako(F[I('o1')]), false);
});

test('(b) la TOLERANCIA del emisor: a los 11 min sale, a los 13 «omitido» y el hilo sigue; antes, espera', () => {
  const momento = T - 60 * MIN;  // el «1 h antes»
  const a11 = decidir('u11t60', momento + 11 * MIN);
  assert.equal(a11?.tipo, 'enviar', 'a los 11 minutos todavía es un recordatorio');
  const a13 = decidir('u11t60', momento + 13 * MIN);
  assert.equal(a13?.tipo, 'omitido', 'a los 13 minutos ya no: «empieza en una hora» miente');
  assert.equal(TOLERANCIA_MIN, 12);
  // En el borde, como el emisor (`ahora - momento < tolerancia`): a los 12 justos ya no sale.
  assert.equal(decidir('u11t60', momento + 12 * MIN)?.tipo, 'omitido');
  assert.equal(decidir('u11t60', momento)?.tipo, 'enviar');
  // Antes de su momento no sale: se re-ancla (el lead reagendó para más tarde).
  assert.deepEqual(decidir('u11t60', momento - 30 * MIN), { tipo: 'esperar', proximoMs: momento });
  // ⚠️ EL BUG DE ANTES: con la reunión en 2 h, el «1 día antes» SALÍA en el acto (la espera ya vencida
  // se seguía de largo). Ahora se omite y sigue al «1 h antes».
  assert.equal(decidir('u11t1440', T - 2 * 60 * MIN)?.tipo, 'omitido');
  // Mismo veredicto que el emisor para cada minuto alrededor del momento.
  for (let d = -2; d <= 15; d++) {
    const ahora = momento + d * MIN;
    const emisor = toquesVencidos({ leadId: LEAD, juntas: juntasDe(juntas() as never), ahora, toques: [60], tz: 'America/Tijuana' }).length > 0;
    assert.equal(decidir('u11t60', ahora)?.tipo === 'enviar', emisor, `a los ${d} min el carril y el emisor no dicen lo mismo`);
  }
});

test('(c) la MARCA es la del emisor: claveToque del mismo lead, reunión y minuto (no sale dos veces con #228)', () => {
  const ahora = T - 15 * MIN + 2 * MIN;
  const d = decidir('u11t15', ahora);
  assert.equal(d?.tipo, 'enviar');
  const clave = d?.tipo === 'enviar' ? d.clave : null;
  assert.equal(clave, claveToque(LEAD, 'R1', INICIO, 15));
  // La MISMA que arma el emisor para ese toque en ese instante.
  const delEmisor = toquesVencidos({ leadId: LEAD, juntas: juntasDe(juntas() as never), ahora, toques: [15], tz: 'America/Tijuana' });
  assert.equal(delEmisor.length, 1);
  assert.equal(clave, delEmisor[0].clave);
  // Ya tomada (enviado:, incierto:, reclamado:) → no sale, el hilo sigue; un fallo: se reintenta.
  assert.deepEqual(decidir('u11t15', ahora, { estadoMarca: estadoDeLaMarca('enviado:2026-10-13T16:45:30Z') }), { tipo: 'omitido', motivo: 'el recordatorio ya salió', clave });
  assert.equal(decidir('u11t15', ahora, { estadoMarca: estadoDeLaMarca('fallo:2026-10-13T16:45:30Z') })?.tipo, 'enviar');
  // Otro canal lleva el suyo (un email «24 h antes» no le quita el lugar al WhatsApp); una acción, ninguna.
  assert.equal(claveDelCarril(LEAD, 'R1', INICIO, 1440, 'email'), `${claveToque(LEAD, 'R1', INICIO, 1440)}.email`);
  const conMako = [...F.slice(0, -1), mako('u11m30', { siguiente: null }), antes('u11e30', 30, 'u11m30'), F[F.length - 1]];
  const dm = decidirToqueDelCarril({ leadId: LEAD, pasos: conMako, idx: indicePorId(conMako, 'u11m30'), juntas: juntas(), ahoraMs: T - 30 * MIN, tz: null });
  assert.deepEqual(dm, { tipo: 'enviar', clave: null, cual: 'R1', inicio: INICIO, min: 30 });
  // Y el motor la lee, la reclama y la marca con lo MISMO que el emisor (lib/settings, el workspace de la corrida).
  assert.match(PROC, /marca = await getSettingEstricto\(d\.clave\);/);
  assert.match(PROC, /const gano = await cambiarSettingSi\(d\.clave, marca, reclamo\)\.catch\(\(\) => false\);/);
  assert.match(NUTRI, /if \(estado === 'enviado'\) await setSetting\(c\.clave, `enviado:\$\{ahora\}`\);/);
  // (`getSetting` salió del import en el cierre de la ola 3: ya nadie lo usaba en el motor.)
  assert.match(NUTRI, /import \{ getSettingEstricto, cambiarSettingSi, setSetting \} from '@\/lib\/settings';/);
});

test('(h) una reunión CANCELADA no cuenta y (g) una sin HORA cierra ESE hilo, no la inscripción', () => {
  const ahora = T - 60 * MIN;
  // Cancelada: Calendly pone la fecha en null y deja la hora.
  const cancelada = decidirToqueDelCarril({ leadId: LEAD, pasos: F, idx: I('u11t60'), juntas: juntas({ fecha_junta_1: null }), ahoraMs: ahora });
  assert.deepEqual(cancelada, { tipo: 'cerrar-hilo', motivo: 'sin reunión con hora por delante' });
  assert.equal(toquesVencidos({ leadId: LEAD, juntas: juntasDe(juntas({ fecha_junta_1: null }) as never), ahora, toques: [60] }).length, 0, 'el emisor tampoco');
  // Sin hora (sólo la fecha): no se le inventan las 12:00 de México.
  const sinHora = decidirToqueDelCarril({ leadId: LEAD, pasos: F, idx: I('u11t60'), juntas: juntas({ junta_1_at: null }), ahoraMs: ahora });
  assert.deepEqual(sinHora, { tipo: 'cerrar-hilo', motivo: 'la reunión no tiene hora' });
  // La ESPERA del carril también: con la reunión sin hora, `sin_hora` (ese hilo), no `sin_reunion` (todo).
  const laxa = proximaReunion(juntas({ junta_1_at: null }), ahora, { estricta: false })?.inicioMs ?? null;
  assert.ok(laxa != null, 'la laxa sí la ve (mediodía de México)');
  assert.equal(resolverControl(F, I('u11e60'), { hechos: null, ahoraMs: ahora, reunionMs: laxa, reunionConHoraMs: null }).tipo, 'sin_hora');
  assert.equal(resolverControl(F, I('u11e60'), { hechos: null, ahoraMs: ahora, reunionMs: null, reunionConHoraMs: null }).tipo, 'sin_reunion');
  // Con hora, se ancla en ÉSA (y no en la laxa).
  const r = resolverControl(F, I('u11e60'), { hechos: null, ahoraMs: T - 3 * 60 * MIN, reunionMs: T + 99 * MIN, reunionConHoraMs: T });
  assert.equal(r.tipo === 'esperar' ? r.proximoMs : null, T - 60 * MIN);
  // Un lead cerrado o perdido sigue con la fecha cargada: no se le recuerda nada (como el emisor).
  assert.equal(decidirToqueDelCarril({ leadId: LEAD, pasos: F, idx: I('u11t60'), juntas: juntas(), ahoraMs: ahora, estadoLead: 'perdido' })?.tipo, 'cerrar-hilo');
  // El motor: `sin_hora` cierra el hilo (sin `'inscripcion'`) y `cerrar-hilo` también.
  assert.match(PROC, /if \(r\.tipo === 'sin_hora'\) \{ await cerrar\('la reunión no tiene hora', true\); continue; \}/);
  assert.match(PROC, /if \(d\.tipo === 'cerrar-hilo'\) \{\s*if \(await escribir\(insc, \{ estado: 'completada', proximo_envio_at: null \}, \{ modo: 'cas' \}\)\)/);
  // Y el ancla de la espera del carril es la reunión CON HORA.
  assert.match(PROC, /const reunionConHoraMs = tieneCarril\(sec\.pasos\) \? await reunionConHoraDe\(lead\) : undefined;/);
});

test('(d) sin ANTI-BAN y (e) sin TOPES: el «15 min antes» sale 45 minutos después del de «1 h»', () => {
  // Lo que pasaba: con la reunión a menos de 48 h el freno deja 3 h entre WhatsApps, y el de 15 min quedaba frenado.
  const recien = { whatsapp: new Set([LEAD]), email: new Set<number>() };
  assert.equal(frenadoPorAntiBan(LEAD, 'whatsapp', recien, new Map()), true, 'el freno, solo, lo frenaba');
  assert.equal(pasaPorAntiBan({ carril: true, social: false, canalApagado: false }), false, 'el carril no pasa por el freno');
  assert.equal(pasaPorAntiBan({ carril: false, social: false, canalApagado: false }), true, 'un mensaje normal sí');
  assert.equal(pasaPorAntiBan({ carril: false, social: true, canalApagado: false }), false);
  assert.equal(cuentaParaElCupo({ carril: true }), false);
  assert.equal(cuentaParaElCupo({ carril: false }), true);
  // El motor pregunta ANTES del freno, y el cupo de la corrida no suma lo del carril.
  assert.match(PROC, /&& frenadoPorAntiBan\(insc\.lead_id, paso\.canal, conEnvioReciente, enviadoEnCorrida\)\s*&& pasaPorAntiBan\(\{ carril: carril != null, social: esCanalSocial\(paso\.canal\), canalApagado \}\)\) \{\s*res\.detalle\.push\(\{ lead_id: insc\.lead_id, canal: paso\.canal, estado: 'saltado', nota: 'msg <20h' \}\);/);
  assert.match(PROC, /&& cuentaParaElCupo\(\{ carril: carril != null \}\)\) \{ if \(paso\.canal === 'email'\) emailsEnCorrida \+= 1; else waEnCorrida \+= 1; \}/);
  // Con el cupo lleno, el carril sigue (como las acciones).
  assert.match(PROC, /const sinTopeWa = \[\.\.\.new Set\(\[\.\.\.conAcciones, \.\.\.conCarril,/);
  assert.match(PROC, /\(sigueSinCupoWa\(pasos\[idx\]\) \|\| esHiloDelCarril\(pasos, idx\)\)/);
  // Un fallo vuelve a probar en 5 minutos (con el backoff de 4 h, el toque se perdía), dentro de la tolerancia.
  assert.match(PROC, /proximo_envio_at: carril \? new Date\(Date\.now\(\) \+ 5 \* 60_000\)\.toISOString\(\) : enHorasISO\(backoffHoras\)/);
});

test('(f) FUERA DEL HORARIO corre el carril y «MaKo en WhatsApp»; un mensaje normal, no', () => {
  const fuera = { fueraDeHorario: true };
  assert.equal(seMueveEnLaCorrida(F, I('u11t60'), fuera), true, 'el recordatorio');
  assert.equal(seMueveEnLaCorrida(F, I('u11e1440'), fuera), true, 'su espera');
  assert.equal(seMueveEnLaCorrida(F, I('u11aviso'), fuera), true, 'el aviso al equipo (decisión §9.7)');
  assert.equal(seMueveEnLaCorrida(F, I('o1'), fuera), false, 'el «¿alcanzaste a ver el video?» espera a que abra');
  assert.equal(seMueveEnLaCorrida(F, I('nvlvg08'), fuera), false);
  // Dentro del horario, todo.
  for (let i = 0; i < F.length; i++) assert.equal(seMueveEnLaCorrida(F, i, { fueraDeHorario: false }), true, F[i].id);
  // El motor ya no corta TODO fuera del horario: sólo si no hay nada que corra igual.
  assert.doesNotMatch(PROC, /if \(!\(await dentroDeVentana\(horario\)\)\) return \{ \.\.\.res, saltado: 'fuera-de-horario' \};/);
  assert.match(PROC, /else if \(!\(await dentroDeVentana\(horario\)\)\) fueraDeHorario = 'fuera-de-horario';/);
  assert.match(PROC, /if \(fueraDeHorario && !corrensFuera\.length\) return \{ \.\.\.res, saltado: fueraDeHorario \};/);
  assert.match(PROC, /seMueveEnLaCorrida\(sec\.pasos, i, \{ fueraDeHorario: fueraDeHorario != null \}\)/);
});

test('un hilo FRENADO no tapa al carril: se aplaza, y el tick ve el recordatorio que vence después', () => {
  // La preparación de las 21:30 (fuera del horario hasta las 9) dejaba `proximo_envio_at` clavado en las 21:30: el
  // tick sólo mira lo que acaba de vencer, y el «1 h antes» de las 8:30 se perdía (la corrida de las 9 llega tarde).
  const hilos = [
    { h: 'p', nodo: 'o1', proximo: '2026-10-12T04:30:00.000Z' },
    { h: 'u11e1440', nodo: 'u11t60', proximo: '2026-10-12T15:30:00.000Z' },
  ];
  assert.equal(aplazaParaNoTapar(F, hilos, 'p'), true, 'el de la preparación se aplaza');
  assert.equal(aplazaParaNoTapar(F, hilos, 'u11e1440'), false, 'el carril no');
  assert.equal(aplazaParaNoTapar(F, [hilos[0]], 'p'), false, 'sin carril pendiente, lo de siempre');
  assert.equal(aplazaParaNoTapar(F, null, 'p'), false, 'un solo cursor no tapa a nadie');
  assert.ok(APLAZO_SIN_TAPAR_MS > 10 * MIN, 'más que la ventana del tick: si no, el motor corre cada minuto por una fila frenada');
  // Los tres lugares que dejan un hilo sin mover: fuera del horario, el cupo (dos) y el anti-ban.
  assert.match(PROC, /if \(libres\.includes\(x\) \|\| !aplazaParaNoTapar\(sec\.pasos, sanearHilos\(insc\.hilos\), x\.h\)\) continue;/);
  assert.match(PROC, /if \(cupoLleno\(\) && !\(pasoLeido && sec && sigueSinCupo\(sec\.pasos, idxLeido\)\)\) \{ if \(sec\) await aplazarSiTapa\(insc, sec\); continue; \}/);
  assert.match(PROC, /if \(cupoLleno\(\) && !sigueSinCupo\(sec\.pasos, r\.idx\)\) \{ await aplazarSiTapa\(insc, sec\); continue; \}/);
  assert.match(PROC, /nota: 'msg <20h' \}\);\s*await aplazarSiTapa\(insc, sec\);\s*continue;/);
});

test('M4 (desde el 14/10/2026): una RESPUESTA no corta nada; se anota y el motor mueve la fila igual', () => {
  // Hasta el 14/10 quedaba vivo SÓLO el carril y lo demás se cortaba, sin que el lienzo lo dijera (así no salió la
  // bienvenida del bug 5). Martín: «"Si el lead contesta" NO debería ir en el CRON, debería ser una CONDITION». Lo que
  // corta ahora es «No contestó desde que entró» (tests/automations-condicion-contesto.test.ts).
  const resp = { fueraDeHorario: false };
  assert.equal(seMueveEnLaCorrida(F, I('u11t60'), resp), true);
  assert.equal(seMueveEnLaCorrida(F, I('o1'), resp), true, 'el «¿alcanzaste a ver el video?» ya no se corta solo');
  assert.equal(seMueveEnLaCorrida(F, I('ne9jyr0'), resp), true, 'el «no confirmó» al equipo tampoco');
  // La fila sigue en 'respondio' y el desenlace la espera.
  assert.equal(estadoAlEscribir('respondio', 'activa'), 'respondio');
  assert.equal(estadoAlEscribir('respondio', 'completada'), 'respondio', 'el desenlace («Respondió» = logrado) la tiene que ver');
  assert.equal(estadoAlEscribir('respondio', 'cancelada'), 'cancelada');
  assert.equal(estadoAlEscribir('activa', 'completada'), 'completada');
  // Una re-armada sólo con el carril (201: desenlace 'fallo' ya escrito) termina 'completada': el evaluador no la
  // vuelve a mirar, y en 'respondio' no se reusaría nunca más.
  assert.equal(estadoAlEscribir('respondio', 'completada', 'fallo'), 'completada');
  assert.equal(estadoAlEscribir('respondio', 'activa', 'fallo'), 'respondio');
  assert.match(PROC, /proximo_envio_at, hilos, hilos_rev, estado, desenlace'\)/);
  assert.equal(desenlaceEsperaAlCarril({ estado: 'respondio', proximo_envio_at: '2026-10-13T16:00:00Z' }), true);
  assert.equal(desenlaceEsperaAlCarril({ estado: 'respondio', proximo_envio_at: null }), false);
  // El cableado: `pausarPorRespuesta` sólo ANOTA ('respondio', con su posición y su próximo envío intactos); la cola y
  // la vista previa levantan las 'respondio' vencidas; el desenlace las espera; toda escritura de la posición compara.
  const pausar = cuerpo(NUTRI, 'export async function pausarPorRespuesta(');
  assert.match(pausar, /\.update\(\{ estado: 'respondio', updated_at: ahoraISO\(\) \}\)\s*\.eq\('lead_id', leadId\)\s*\.eq\('estado', 'activa'\)/);
  assert.doesNotMatch(pausar, /pausarConCarril|alResponder|algunCaminoSigue/);
  assert.doesNotMatch(NUTRI, /async function pausarConCarril\(/);
  assert.match(PROC, /\.in\('estado', \['activa', 'respondio'\]\)/);
  assert.match(cuerpo(NUTRI, 'async function inscripcionesVencidas('), /q\.in\('estado', \['activa', 'respondio'\]\)/);
  assert.match(DESENLACE, /if \(desenlaceEsperaAlCarril\(\{ estado: insc\.estado, proximo_envio_at: insc\.proximo_envio_at \?\? null \}\)\) continue;/);
  assert.match(NUTRI, /\.eq\('id', insc\.id\)\.eq\('estado', estadoLeido\(insc\)\)\.eq\('hilos_rev', rev\)/);
});
