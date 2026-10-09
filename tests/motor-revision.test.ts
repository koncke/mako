// =============================================================================
// El MOTOR después de la revisión adversarial del rediseño de /chatbot (08/10/2026, parte M)
// =============================================================================
// Lo que fija cada test, con el id del hallazgo de la revisión (cada arreglo lleva su porqué en el
// comentario del código que fija):
//   (1)  motor-10 / lienzo-1 — dónde está una inscripción: un nodo BORRADO no cae al índice (otra
//        rama), y una fila de antes se busca por `o<k>` antes que por el índice;
//   (2)  motor-6  — un recordatorio sube por las condiciones hasta la espera «antes de la reunión»;
//   (3)  costuras-1 — un ARCHIVO no sortea variantes: su caption es el cuerpo;
//   (4)  motor-2  — «Ir a otra automatización» no reinicia lo terminado, y no a sí misma;
//   (5)  (a)      — en un flujo de tarjetas, «agendó»/«pagó» no cierran (lo hacen las condiciones);
//   (6)  etiquetas-1 / datos-1 — sin horario, el barrido no inscribe por etiqueta;
//   (7)  etiquetas-6 / datos-5 — una etiqueta archivada no cuenta ni dispara;
//   (8)  motor-1 / (c) — el aviso de «Otra cosa» lleva el texto del lead, se deduplica por
//        respuesta, y sólo cuenta si salió;
//   (9)  motor-3  — «Otra cosa» sin respuesta de MaKo pasa la charla a una persona;
//   (10) motor-5  — un mensaje fijo de «Si responde» sale una vez cada 20 h por tarjeta;
//   (11) motor-9  — sin la 0223, la respuesta del lead no se come: no se toca la inscripción;
//   (12) motor-11 — elegir un disparador sin producto no borra el producto;
//   (13) costuras-2 — un borrador con audio o archivo no tiene camino oficial.
//
// Los de lib/nutricion.ts (con `server-only`) leen el FUENTE sin comentarios y en LF (CRLF en el
// clon de Windows). Los puros se EJECUTAN.
//
// PROBADO ROMPIÉNDOLO (08/10/2026), una rotura por vez con un arnés en el scratchpad que restaura
// DE MEMORIA (nunca `git checkout`). Como está: 13 pasan / 0 fallan. 22 roturas, 22 cazadas
// (12 pasan / 1 falla en cada una, la del número):
//   (1)  sin el `o<k>`                                    → 1 falla (1)
//   (1)  un nodo borrado cae a `paso_actual` otra vez      → 1 falla (1)
//   (2)  minutosAntesDeReunion mirando sólo el padre       → 1 falla (2)
//   (3)  textoDelPaso sorteando también el archivo         → 1 falla (3)
//   (4)  un flujo reiniciando lo terminado                 → 1 falla (4)
//   (4)  el motor sin cortar el «Ir a» a sí misma          → 1 falla (4)
//   (4)  setSecuenciaPasos aceptando el «Ir a» a sí misma  → 1 falla (4)
//   (5)  el logro cerrando también un flujo de tarjetas    → 1 falla (5)
//   (6)  barridoInscribe siempre true                      → 1 falla (6)
//   (6)  comprometerInscripciones sin la puerta            → 1 falla (6)
//   (7)  etiquetasQueCuentan ignorando las archivadas      → 1 falla (7)
//   (7)  la cohorte sin mirar si la etiqueta está archivada → 1 falla (7)
//   (8)  avisoSalio sin mirar la deduplicación             → 1 falla (8)
//   (8)  el motor marcando el aviso ANTES de correrlo      → 1 falla (8)
//   (9)  charlaPasaAUnaPersona ignorando «contestó»        → 1 falla (9)
//   (9)  el motivo mirando la más tocada, no el último cierre → 1 falla (9)
//   (9)  el script devolviendo la 199 a 'completada'       → 1 falla (9)
//   (10) el texto fijo sin su reclamo                      → 1 falla (10)
//   (11) esColumnaInexistente siempre false                → 1 falla (11)
//   (11) las secuencias sin leer antes de marcar           → 1 falla (11)
//   (12) la ruta volviendo a mandar `funnel_id: null`      → 1 falla (12)
//   (13) el camino sin mirar el audio del borrador         → 1 falla (13)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  indiceActual, minutosAntesDeReunion, RELLENO_CONTROL, irAEstaMisma, logroCierraLaInscripcion, barridoInscribe,
  etiquetasQueCuentan, avisoSalio, AVISO_REPETIDO, esColumnaInexistente,
} from '../lib/nutricion-grafo-motor';
import { textoDelPaso } from '../lib/nutricion-canal';
import { decidirInscripcionManual, motivoNoInscribe } from '../lib/nutricion-inscripcion-manual';
import { conversacionAbierta, atiendeAlResponder, cerradaPorUnaPersona, charlaPasaAUnaPersona, type InscCharla } from '../lib/setter-conversacion';
import { TRIGGER_ETIQUETA } from '../lib/nutricion-etapa';
import { DEFS } from '../lib/api-mako/areas/chatbot.def';
import { OP_AVISAR } from '../lib/flujo-legado';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** La función de primer nivel `firma`, hasta la próxima declaración de primer nivel. */
const fn = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  const resto = src.slice(i + firma.length);
  const j = resto.search(/\n(?:export )?(?:async )?function |\nexport |\ntype |\nconst /);
  return src.slice(i, i + firma.length + (j >= 0 ? j : resto.length));
};
const NUTRI = sinComentarios(leer('../lib/nutricion.ts'));

const msg = (id: string, extra: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ id, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: `hola ${id}`, template_wa: null, ...extra } as PasoGrafo);
const ctl = (id: string, extra: Partial<PasoGrafo>): PasoGrafo => ({ id, ...RELLENO_CONTROL, ...extra } as PasoGrafo);

// ── (1) Dónde está una inscripción ─────────────────────────────────────────────

test('(1) un nodo BORRADO no cae al índice; una fila de antes se busca por su id de antes', () => {
  // La forma de #212 convertida (el conversor CONSERVA `o<i>` y pone las esperas delante):
  //   0 e1 ⏳ 1 h → o0 · 1 o0 audio → e2 · 2 e2 ⏳ 24 h → o1 · 3 o1 MaKo
  const convertida = [
    ctl('e1', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'o0' }),
    msg('o0', { tipo: 'audio', siguiente: 'e2' }),
    ctl('e2', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'o1' }),
    msg('o1', { tipo: 'ia', siguiente: null }),
  ];
  // Una inscripción de ANTES del deploy, parada en el paso 1 (la IA de las 24 h): `pasos[1]` es el
  // audio que ya le llegó. Por su id de antes, la IA.
  assert.equal(indiceActual(convertida, { nodo_actual: null, paso_actual: 1 }), 3, 'el audio le sale otra vez');
  // Una lista de antes sin ids sigue leyendo el índice (`o<k>` ES el índice).
  const lista = [{ canal: 'whatsapp', cuerpo: 'a' }, { canal: 'whatsapp', cuerpo: 'b' }] as PasoGrafo[];
  assert.equal(indiceActual(lista, { nodo_actual: null, paso_actual: 1 }), 1);
  // Sin `o<k>`, el índice de siempre; fuera de rango, ninguno.
  assert.equal(indiceActual(convertida, { nodo_actual: null, paso_actual: 2 }), 2);
  assert.equal(indiceActual(convertida, { nodo_actual: null, paso_actual: 9 }), -1);
  // La tarjeta en la que estaba se borró: NINGUNO. En el índice puede haber quedado otra rama.
  //   0 c ◇ cualificado → A1 · si no → B1 · 1 A1 · 2 B1   (A1 se borra → B1 queda en el 1)
  const ramas = [
    ctl('c', { nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'etiqueta', valor: 5 }], siguiente: null }], si_no: 'B1' }),
    msg('B1', { cuerpo: 'para los NO cualificados', siguiente: null }),
  ];
  assert.equal(indiceActual(ramas, { nodo_actual: 'A1', paso_actual: 1 }), -1, 'al cualificado le llega el mensaje de la otra rama');
  // Y el motor, con la tarjeta borrada, lo dice al cerrar.
  assert.match(fn(NUTRI, 'export async function procesarEnvios('), /if \(sec && insc\.nodo_actual != null\) \{\n\s+res\.omitidos \+= 1;/);
});

// ── (2) El recordatorio ────────────────────────────────────────────────────────

test('(2) un mensaje detrás de una CONDICIÓN sigue siendo un recordatorio de la reunión', () => {
  // espera(1 día antes de la reunión) → condición («Termina si paga») → [sí: acción · no: mensaje]
  const R = [
    ctl('e', { nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 1440 }, siguiente: 'c' }),
    ctl('c', { nodo: 'condicion', ramas: [{ id: 'p', modo: 'todas', filas: [{ campo: 'pago' }], siguiente: 'acc' }], si_no: 'm' }),
    ctl('acc', { accion: { operacion: 'proponer_cambio_etapa', params: {} }, siguiente: null }),
    msg('m', { cuerpo: 'Mañana es tu reunión', siguiente: null }),
  ];
  assert.equal(minutosAntesDeReunion(R, 3), 1440, 'sale «Mañana es tu reunión» con la reunión movida o cancelada');
  // La acción del logro NO se re-ancla: «ya pagó → movelo» corre ya.
  assert.equal(minutosAntesDeReunion(R, 2), null);
  // Una espera de TIEMPO arriba de la condición no ancla nada.
  const T = [ctl('e', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'c' }), R[1], R[2], R[3]];
  assert.equal(minutosAntesDeReunion(T, 3), null);
  // El de siempre: colgado directo de la espera.
  assert.equal(minutosAntesDeReunion([R[0], { ...msg('m2'), id: 'c' } as PasoGrafo], 1), 1440);
});

// ── (3) El archivo ─────────────────────────────────────────────────────────────

test('(3) un paso de ARCHIVO no sortea variantes: su caption es el cuerpo, aunque esté vacío', () => {
  const p = { tipo: 'media', media_id: 7, cuerpo: 'Te dejo la info 👇', variantes: ['texto viejo 1', 'texto viejo 2', 'texto viejo 3'] };
  for (let k = 0; k < 60; k++) assert.equal(textoDelPaso(p), 'Te dejo la info 👇', 'al lead le llega el PDF con el texto viejo de pie');
  for (let k = 0; k < 30; k++) assert.equal(textoDelPaso({ ...p, cuerpo: '' }), '', 'con el caption vacío sale una variante vieja');
  // Un texto sí sortea (lo de siempre).
  const vistos = new Set<string>();
  for (let k = 0; k < 200; k++) vistos.add(textoDelPaso({ cuerpo: 'a', variantes: ['b'] }));
  assert.deepEqual([...vistos].sort(), ['a', 'b']);
});

// ── (4) «Ir a otra automatización» ─────────────────────────────────────────────

test('(4) desde un flujo, lo terminado NO se reinicia y no se entra con el objetivo hecho; tampoco a sí misma', () => {
  const sec = { activa: true, archivada: false, pasos: 3 };
  const motor = { aTiempo: true, sinReunion: false, fueraDelResiduo: false, enLaOtraMitad: false };
  for (const estado of ['completada', 'no_responde']) {
    const previa = { estado, desenlace: estado === 'completada' ? 'logrado' : 'fallo' };
    assert.deepEqual(decidirInscripcionManual({ secuencia: sec, previa, motor, desdeFlujo: true }), { inscribe: false, porque: 'ya_estuvo' }, `${estado}: le reenvía la secuencia entera`);
    // Una PERSONA sí la puede volver a arrancar (regla 3, intacta).
    assert.deepEqual(decidirInscripcionManual({ secuencia: sec, previa, motor }), { inscribe: true, como: 'reinicio' });
  }
  assert.deepEqual(decidirInscripcionManual({ secuencia: sec, previa: null, motor, desdeFlujo: true, objetivoHecho: true }), { inscribe: false, porque: 'objetivo_hecho' });
  assert.deepEqual(decidirInscripcionManual({ secuencia: sec, previa: null, motor, desdeFlujo: true }), { inscribe: true, como: 'nueva' });
  assert.deepEqual(decidirInscripcionManual({ secuencia: sec, previa: null, motor, objetivoHecho: true }), { inscribe: true, como: 'nueva' }, 'el hito sólo cuenta desde un flujo');
  assert.match(motivoNoInscribe('ya_estuvo', { secuenciaId: 212, secuencia: 'Post-agenda', leadId: 1, lead: 'Ana' }), /Ana ya pasó por «Post-agenda»/);
  // «Ir a» a sí misma: lo encuentra la pura, lo rechaza el guardado y lo corta el motor.
  const P = [msg('m', { siguiente: 'j' }), ctl('j', { nodo: 'ir_a', destino: { secuencia_id: 198 } }), ctl('k', { nodo: 'ir_a', destino: { secuencia_id: 212 } })];
  assert.deepEqual(irAEstaMisma(P, 198), [1]);
  assert.deepEqual(irAEstaMisma(P, 5), []);
  const guardar = fn(NUTRI, 'export async function setSecuenciaPasos(');
  const iSi = guardar.indexOf('const aSiMisma = irAEstaMisma(pasos.filter(esPaso).map((p) => camposDelFlujo(p)), id);');
  assert.ok(iSi > 0 && iSi < guardar.indexOf('.update({ pasos: grafo,'), 'se guarda un «Ir a» a la misma automatización');
  assert.match(guardar, /if \(aSiMisma\.length\) throw new PasosInvalidosError\(/);
  const proc = fn(NUTRI, 'export async function procesarEnvios(');
  assert.match(proc, /if \(r\.secuenciaId === sec\.id\) \{ await cerrar\(/, 'el motor sigue un «Ir a» a sí misma: bucle');
  assert.match(proc, /inscribirEnSecuencia\(insc\.lead_id, r\.secuenciaId, \{ sinEnvioInmediato: true, desdeFlujo: true \}\)/);
  assert.match(fn(NUTRI, 'async function responderConGrafo('), /inscribirEnSecuencia\(leadId, Number\(d\.secuencia_id\), \{ sinEnvioInmediato: true, desdeFlujo: true \}\)/);
  assert.match(fn(NUTRI, 'export async function inscribirEnSecuencia('), /objetivoHecho: opts\?\.desdeFlujo === true && objetivo != null && hitoYaHecho\(objetivo, lead\) === true,/);
});

// ── (5) El logro en un flujo de tarjetas ───────────────────────────────────────

test('(5) en un flujo de TARJETAS «agendó» y «pagó» no cierran: lo hacen las condiciones; «respondió» sí', () => {
  assert.equal(logroCierraLaInscripcion('agendo', true), false, 'dos reglas para lo mismo');
  assert.equal(logroCierraLaInscripcion('pago', true), false);
  assert.equal(logroCierraLaInscripcion('respondio', true), true, 'la «respondio» queda para siempre y no se reusa al reagendar');
  assert.equal(logroCierraLaInscripcion('agendo', false), true, 'una lista de antes sigue cerrando como siempre');
  assert.equal(logroCierraLaInscripcion('ninguno', false), false);
  const des = sinComentarios(leer('../lib/nutricion-desenlace.ts'));
  assert.match(des, /\.select\('id, nombre, estrategia, pasos'\)/);
  assert.match(des, /const flujo = esFlujoExplicito\(/);
  assert.match(des, /if \(logroCierraLaInscripcion\(d\.logrado, flujo\) && seLogro\(d, lead, insc\.estado\)\) \{/);
});

// ── (6) El barrido por etiqueta ────────────────────────────────────────────────

test('(6) «Se le puso una etiqueta» sin horario es SÓLO el evento: el barrido no inscribe', () => {
  assert.equal(barridoInscribe({ trigger_tipo: TRIGGER_ETIQUETA, cron: null }), false, 'el lote y el espejo de etapa terminan disparando en la corrida siguiente');
  assert.equal(barridoInscribe({ trigger_tipo: TRIGGER_ETIQUETA, cron: { unidad: 'dia', cada: 1, hora: 9, minuto: 0 } }), true, 'con horario barre: lo eligió el dueño');
  assert.equal(barridoInscribe({ trigger_tipo: 'etapa_actual', cron: null }), true);
  // La puerta va ANTES de la cohorte, en el commit y en el dry-run.
  for (const f of ['export async function comprometerInscripciones(', 'export async function planificarInscripciones(']) {
    const b = fn(NUTRI, f);
    const i = b.indexOf('if (!barridoInscribe(sec)) continue;');
    assert.ok(i > 0 && i < b.indexOf('leadsDeCohorte('), `${f} barre por etiqueta sin horario`);
  }
});

// ── (7) La etiqueta archivada ──────────────────────────────────────────────────

test('(7) una etiqueta ARCHIVADA no cuenta para «Tiene X» ni dispara; el lead conserva la fila', () => {
  assert.deepEqual([...etiquetasQueCuentan([3, 5, 9], new Set([5]))].sort(), [3, 9], '«Tiene X» sigue saliendo por sí');
  assert.deepEqual([...etiquetasQueCuentan([], new Set([5]))], []);
  const hechos = fn(NUTRI, 'async function hechosDeLeads(');
  assert.match(hechos, /leerTodo<\{ id: number \| string \}>\(db, 'crm_etiquetas', 'id', \{\n\s+orden: 'id', filtros: \(q\) => q\.not\('archivada_at', 'is', null\),/);
  assert.match(hechos, /etiquetas: etiquetasQueCuentan\(etiquetas\.get\(f\.id\) \?\? \[\], archivadas\),/);
  const cohorte = fn(NUTRI, 'async function leadsConEtiqueta(');
  assert.match(cohorte, /if \(!etiqueta \|\| etiqueta\.archivada_at\) return \[\];/, 'el barrido inscribe por una etiqueta archivada');
});

// ── (8) El aviso de «Otra cosa» ────────────────────────────────────────────────

test('(8) el aviso de «Otra cosa» lleva el texto del lead, se deduplica por respuesta y sólo cuenta si salió', () => {
  assert.equal(avisoSalio({ ok: true, resumen: 'Le avisé al equipo.' }), true);
  assert.equal(avisoSalio({ ok: true, resumen: `${AVISO_REPETIDO} de Ana hace poco.` }), false, 'un aviso deduplicado apaga el de respaldo: nadie se entera');
  assert.equal(avisoSalio({ ok: false, resumen: 'No pude avisarle al equipo.' }), false);
  const op = DEFS.find((d) => d.id === OP_AVISAR)!;
  const p = op.parametros.find((x) => x.nombre === 'respuesta');
  assert.ok(p && p.obligatorio !== true, 'avisar_al_equipo sin el parámetro opcional `respuesta`');
  const run = sinComentarios(leer('../lib/api-mako/areas/chatbot.run.ts'));
  const i = run.indexOf('\n  avisar_al_equipo: {');
  const b = run.slice(i, run.indexOf('\n  },\n', i));
  assert.match(b, /\.\.\.\(respuesta \? \['', `_"\$\{respuesta\.slice\(0, 400\)\}"_`\] : \[\]\),/, 'el aviso no dice qué escribió el lead');
  assert.match(b, /if \(r\.deduped\) return \{ ok: true, resumen: `\$\{AVISO_REPETIDO\}/);
  // El motor: le pasa el texto, y marca el aviso con lo que DEVOLVIÓ, no antes de correrlo.
  const accion = fn(NUTRI, 'async function correrAccionDeRespuesta(');
  // Segunda tanda: el campo sale de LLENA_EL_FLUJO (la lista que el editor esconde), no de un
  // `esAviso` cableado. Verificado sacando el spread de delFlujo: 1 fallo.
  assert.match(accion, /const delFlujo = Object\.entries\(LLENA_EL_FLUJO\[operacion\] \?\? \{\}\)\.filter\(\(\[, fuente\]\) => fuente === 'respuesta_del_lead'\);/);
  assert.match(accion, /\.\.\.Object\.fromEntries\(delFlujo\.map\(\(\[campo\]\) => \[campo, respuesta\]\)\)/);
  assert.match(accion, /avisoSalio: esAviso && avisoSalio\(r\)/);
  const grafo = fn(NUTRI, 'async function responderConGrafo(');
  assert.doesNotMatch(grafo, /operacion === OP_AVISAR\) avisoDelFlujo = true/, 'el aviso se da por hecho antes de correr');
  assert.match(grafo, /if \(r\.avisoSalio\) avisoDelFlujo = true;/);
});

// ── (9) El hand-off ────────────────────────────────────────────────────────────

const AHORA = Date.parse('2026-10-08T18:00:00Z');
const hace = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();
const insc = (o: Partial<InscCharla> = {}): InscCharla => ({
  id: 1, secuencia_id: 212, estado: 'respondio', desenlace: null, updated_at: hace(1),
  conversacion_ultima_at: hace(1), conversacion_cerrada_at: null, conversacion_cierre: null,
  tieneEnviado: true, asistida: true, pausada: false, reunionFutura: true, ...o,
});

test('(9) «Otra cosa» sin respuesta de MaKo pasa la charla a una PERSONA, y MaKo no le contesta más', () => {
  assert.equal(charlaPasaAUnaPersona({ contesto: false, siguio: false, noPudoDecidir: false }), true, 'sólo avisar: la charla sigue abierta y MaKo contesta solo');
  assert.equal(charlaPasaAUnaPersona({ contesto: true, siguio: false, noPudoDecidir: false }), false, 'con un «MaKo contesta» la charla sigue');
  assert.equal(charlaPasaAUnaPersona({ contesto: false, siguio: true, noPudoDecidir: false }), false);
  assert.equal(charlaPasaAUnaPersona({ contesto: false, siguio: false, noPudoDecidir: true }), false, 'un error de lectura no cierra la charla');
  // Cerrada por el hand-off (fecha SIN motivo): «la sigue una persona», no se atiende ni se sigue.
  const h = insc({ conversacion_cerrada_at: hace(0.5), conversacion_cierre: null });
  assert.equal(cerradaPorUnaPersona(h), true);
  const v = conversacionAbierta([h], AHORA);
  assert.equal(v.abierta, false);
  if (!v.abierta) assert.match(v.motivo ?? '', /una persona/);
  assert.equal(atiendeAlResponder(h), false);
  // El hand-off cerró la 212, y la 213 del mismo lead se tocó después (otro motivo de `updated_at`):
  // manda el ÚLTIMO cierre, que es el de la persona.
  const dos = conversacionAbierta([h, insc({ id: 2, secuencia_id: 213, updated_at: hace(0.1), conversacion_ultima_at: hace(48) })], AHORA);
  assert.equal(dos.abierta, false);
  if (!dos.abierta) assert.match(dos.motivo ?? '', /una persona/, 'el dueño lee «ya se había cerrado» sobre una charla que tiene que seguir él');
  // Un cierre del setter trae su motivo: no es el hand-off. `undefined` = no se leyó: tampoco.
  assert.equal(cerradaPorUnaPersona(insc({ conversacion_cerrada_at: hace(1), conversacion_cierre: 'fin_bien' })), false);
  assert.equal(cerradaPorUnaPersona({ conversacion_cerrada_at: hace(1) } as InscCharla), false);
  // El motor: recorre la rama, decide y CIERRA la charla (sin tocar el estado).
  const grafo = fn(NUTRI, 'async function responderConGrafo(');
  const iDecide = grafo.indexOf('if (charlaPasaAUnaPersona({ contesto, siguio, noPudoDecidir })) {');
  assert.ok(iDecide > grafo.indexOf('for (let vuelta'), 'la charla se decide antes de recorrer la rama');
  assert.match(grafo.slice(iDecide, iDecide + 400), /\.update\(\{ conversacion_cerrada_at: ahoraISO\(\), conversacion_cierre: null \}\)/);
  assert.doesNotMatch(grafo, /estado: 'handoff'/, 'congelar en handoff la deja sin salida');
  assert.match(fn(NUTRI, 'async function charlaDelLead('), /conversacion_cerrada_at, conversacion_cierre'\)/);
  // El script: el hand-off vivo (la 199) queda con la charla cerrada, NO 'completada' a secas.
  const script = sinComentarios(leer('../scripts/migrar-secuencias-a-grafo.mts'));
  assert.match(script, /\.update\(\{ estado: 'respondio', proximo_envio_at: null, conversacion_cerrada_at: ahora, conversacion_cierre: null, updated_at: ahora \}\)\n\s+\.eq\('workspace_id', ws\)\.eq\('secuencia_id', s\.id\)\.eq\('estado', 'handoff'\)/);
  assert.doesNotMatch(script, /update\(\{ estado: 'completada'/, 'el script le devuelve a MaKo el hand-off');
});

// ── (10) El mensaje fijo de «Si responde» ──────────────────────────────────────

test('(10) un mensaje fijo de «Si responde» se RECLAMA por tarjeta antes de salir (20 h)', () => {
  const m = fn(NUTRI, 'async function mandarMensajeDeRespuesta(');
  assert.match(m, /reclamarEspaciado\(ws, `respuesta-mensaje:\$\{secuencia\.id\}`, RECLAMO_MENSAJE_RESPUESTA_MIN, `\$\{inscId \?\? `lead\$\{leadId\}`\}:\$\{idDe\(p, i\)\}`\)/);
  assert.match(NUTRI, /const RECLAMO_MENSAJE_RESPUESTA_MIN = 20 \* 60;/);
  // Cada una de las tres salidas (audio, archivo, texto) reclama ANTES de su borrador.
  const reclamos = [...m.matchAll(/if \(!\(await reclamar\(\)\)\) return yaSalio;/g)].map((x) => x.index!);
  const borradores = [...m.matchAll(/await crearBorrador\(/g)].map((x) => x.index!);
  assert.equal(reclamos.length, 3, 'una salida de la rama sin su reclamo: sale igual con cada mensaje');
  assert.equal(borradores.length, 3);
  reclamos.forEach((r, k) => assert.ok(r < borradores[k], `el reclamo ${k + 1} va después de su envío`));
});

// ── (11) Sin la 0223 ───────────────────────────────────────────────────────────

test('(11) sin la columna nueva, la respuesta del lead no se come: se lee ANTES de marcar respondio', () => {
  assert.equal(esColumnaInexistente({ message: 'getSecuenciasActivas: column nutricion_secuencias.etiqueta_id does not exist' }), true);
  assert.equal(esColumnaInexistente({ code: '42703' }), true);
  assert.equal(esColumnaInexistente({ message: "Could not find the table 'public.crm_etiquetas' in the schema cache" }), false, 'una TABLA que falta no es una columna');
  assert.equal(esColumnaInexistente({ message: 'fetch failed' }), false);
  const p = fn(NUTRI, 'export async function pausarPorRespuesta(');
  const lee = p.indexOf('secsActivas = await getSecuenciasActivas();');
  assert.ok(lee > 0 && lee < p.indexOf(".update({ estado: 'respondio', proximo_envio_at: null"), 'se marca respondio antes de saber si se puede atender');
  assert.match(p, /if \(esColumnaInexistente\(\{ message: msg \}\)\) throw new Error\(/);
  const mig = leer('../supabase/migrations/0223_flujo_grafo.sql');
  assert.match(mig, /SE PIERDEN LAS RESPUESTAS DE LOS LEADS/, 'la cabecera de la 0223 no dice que se pierde la primera respuesta');
});

// ── (12) El disparador sin producto ────────────────────────────────────────────

test('(12) elegir un disparador sin producto NO borra el producto de la secuencia', () => {
  const ruta = sinComentarios(leer('../app/api/chat-agent/secuencias/route.ts'));
  assert.match(ruta, /\.\.\.\('funnel_id' in body \? \{ funnel_id: num\(body\.funnel_id\) \} : \{\}\),/, '«no vino» se escribe como «todos los embudos»');
  assert.doesNotMatch(ruta, /funnel_id: num\(body\.funnel_id\), etiqueta_id/);
  const set = fn(sinComentarios(leer('../lib/setting-secuencias.ts')), 'export async function setTriggerSecuencia(');
  assert.match(set, /const tocaEmbudo = c\.funnel_id !== undefined;/);
  assert.match(set, /\.\.\.\(tocaEmbudo \? \{ funnel_id: funnelId \} : \{\}\)/);
});

// ── (13) El borrador con audio o archivo ───────────────────────────────────────
// «Un borrador con nota de voz o archivo no tiene camino OFICIAL» se fue el 09/10/2026 con
// Chatwoot: el camino oficial ya no existe, y el audio y el archivo salen por el número de
// empresa (lib/borrador-camino.ts, tests/borrador-camino.test.ts).
