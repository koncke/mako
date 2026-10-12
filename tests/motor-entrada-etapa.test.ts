// =============================================================================
// «Un Lead Agendó Llamada» ENTRA y PREPARA como el flujo de antes (undécima tanda, M1, M1-b, M2 y M6)
// =============================================================================
// El flujo único cuelga de la ETAPA «Agenda R1» (docs/diseno-undecima-tanda.md §3 y §4). Lo que eso le sacaba y
// esto le devuelve:
//   M1   una reserva de Calendly o Cal.com cambia la etapa DERIVADA sin escribir `pipeline_stage`, y el evento de la
//        reserva sólo miraba los triggers de antes: el flujo entraba por el barrido de la hora. Ahora la reserva
//        inscribe en las automatizaciones de la etapa EFECTIVA del lead y de su embudo (`deLaEtapaYLasDemas`).
//   M1-b una reunión cargada a mano también, y sólo hacia una etapa de reunión (`entraAEtapaDeReunion`).
//   M2   «prepara una reunión» (reunion_at, el reuso al reagendar, «la reunión ya pasó», el corte de la charla)
//        era la familia `agendado_*`: ahora es la FORMA del flujo (`preparaReunion`).
//   M6   reservar limpia la etapa de «no agendó» puesta a mano (`limpiaEtapaAlReservar`).
// Lo puro, en lib/nutricion-familias.ts y lib/nutricion-etapa.ts; el cableado (lib/nutricion.ts, lib/leads.ts,
// con `server-only`) se lee del FUENTE sin comentarios.
//
// Probado rompiéndolo (11/10/2026), una rotura por vez y restaurada con el script del scratchpad
// (wf-undecima/w2-motor-reuniones/roturas.mjs, nunca `git checkout`). Como está: 5 pasan / 0 fallan. Cada rotura,
// 4 pasan / 1 falla (la que la cuida):
//   (1) `preparaReunion` ignorando el TIPO de la etapa                       → M2 (prepara)
//   (2) `preparaReunion` ignorando el DELAY «antes de la reunión»            → M2 (prepara)
//   (3) M1 inscribiendo en TODAS las de etapa (otra etapa, otro embudo)      → M1
//   (4) M1 sin sumar `etapa_actual` a la reserva (sólo los triggers de antes) → M1
//   (5) M1-b con cualquier etapa derivada (las intermedias)                  → M1-b
//   (6) una 'respondio' con el carril vivo que no se reusa al reagendar      → M2 (reuso)
//   (7) M6 limpiando también «Ganado»                                        → M6
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  preparaReunion, preparaUnaReunion, entraAEtapaDeReunion, TRIGGER_AGENDA_NUEVO, TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_SIN_CONFIRMAR,
} from '../lib/nutricion-familias';
import { deLaEtapaYLasDemas, limpiaEtapaAlReservar, ETAPAS_SIN_REUNION, TRIGGER_ETAPA } from '../lib/nutricion-etapa';
import { ambitoDeSecuencia } from '../lib/nutricion-ambito';
import { vistasPorDisparador, type Disparador } from '../lib/disparadores';
import { pipelineStageOf, deriveStageKey, PIPELINE_KIND, type StageDerivable } from '../lib/pipeline';
import { inscripcionReusable, SIN_MARCAS } from '../lib/nutricion-reinscripcion';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NUTRI = sinComentarios(leer('../lib/nutricion.ts'));
const LEADS = sinComentarios(leer('../lib/leads.ts'));
const DESENLACE = sinComentarios(leer('../lib/nutricion-desenlace.ts'));
const cuerpo = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  const resto = src.slice(i + firma.length);
  const j = resto.search(/\n(?:export )?(?:async )?function |\nexport |\ntype /);
  return src.slice(i, i + firma.length + (j >= 0 ? j : resto.length));
};

type Sec = {
  id: number; clave: string; etapa: string; etapas: string[]; trigger_tipo: string; funnel_id: number | null; producto_id: null; etiqueta_id: null;
  cron: null; cron_proxima_at: null; disparadores?: Disparador[]; pasos: Array<Record<string, unknown>>;
};
const sec = (o: Partial<Sec> & Pick<Sec, 'id' | 'trigger_tipo'>): Sec => ({
  clave: `s${o.id}`, etapa: '', etapas: [], funnel_id: null, producto_id: null, etiqueta_id: null, cron: null, cron_proxima_at: null, pasos: [{ cuerpo: 'hola' }], ...o,
});
const AUDIO = { id: 'o0', canal: 'whatsapp', cuerpo: 'Te dejo el video', tipo: 'audio', audio_id: 7 };
const DELAY_ANTES = { id: 'u11e60', nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 60 }, siguiente: 'u11t60' };

// Las automatizaciones vivas que puede ver una reserva del ws1 (funnel 1 = el del negocio; funnel 5 = otro).
const AGENDO = sec({ id: 213, trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda', funnel_id: 1, pasos: [AUDIO, DELAY_ANTES] });
const ENTRO = sec({ id: 198, trigger_tipo: TRIGGER_ETAPA, etapa: 'lead', funnel_id: 1 });
const OTRO_FUNNEL = sec({ id: 210, trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda', funnel_id: 5 });
const DE_ANTES = sec({ id: 99, trigger_tipo: TRIGGER_AGENDA_NUEVO });
const ambito = (s: { trigger_tipo: string; funnel_id: number | null }) => (s.trigger_tipo === TRIGGER_ETAPA ? ambitoDeSecuencia(s.funnel_id, s.funnel_id === 1) : { modo: 'todos' as const });
// Las vistas como las arma el motor (una por CRON, `vistasPorDisparador`), con su ámbito ya resuelto.
const vistas = [AGENDO, ENTRO, OTRO_FUNNEL, DE_ANTES].flatMap((s) => vistasPorDisparador(s)).map((v) => ({ ...v, ambito: ambito(v) }));

const lead = (o: Partial<StageDerivable> = {}): StageDerivable => ({
  estado_lead: 'abierto', pipeline_stage: null, fecha_agenda: '2026-10-11', fecha_junta_1: '2026-10-20', fecha_junta_2: null,
  asistio_j1: null, asistio_j2: null, ...o,
});

test('M1: la reserva inscribe en la automatización de la etapa EFECTIVA y del embudo del lead, y no en otra', () => {
  const etapa = pipelineStageOf(lead());
  assert.equal(etapa, 'agenda', 'una R1 reservada deja al lead en «Agenda R1» por derivación');
  const ids = deLaEtapaYLasDemas(vistas, etapa, 1).map((s) => s.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [99, 213], 'la de «Agenda R1» de SU embudo y la de antes; ni «Lead entrante» ni la del funnel 5');
  // Un lead del funnel 5 entra a la suya.
  assert.deepEqual(deLaEtapaYLasDemas(vistas, etapa, 5).map((s) => s.id).sort((a, b) => a - b), [99, 210]);
  // Sin etapa (no se pudo leer el lead) sólo las de antes: nunca «todas».
  assert.deepEqual(deLaEtapaYLasDemas(vistas, null, 1).map((s) => s.id), [99]);
  // Con la etapa puesta a mano en «nutri» (la regla T2) no entraría: por eso M6 la limpia (abajo).
  assert.equal(pipelineStageOf(lead({ pipeline_stage: 'nutri' })), 'nutri');
  assert.deepEqual(deLaEtapaYLasDemas(vistas, 'nutri', 1).map((s) => s.id), [99]);
  // El cableado: la reserva suma `etapa_actual`, lee la etapa del lead y pregunta lo MISMO que el movimiento.
  const ev = cuerpo(NUTRI, 'export async function enrolarPorEvento(');
  assert.match(ev, /const claves = evento === 'agenda_nueva' \? \[\.\.\.\(TRIGGERS_POR_EVENTO\[evento\] \?\? \[\]\), TRIGGER_ETAPA\] :/);
  assert.match(ev, /if \(evento === 'etapa' \|\| evento === 'agenda_nueva'\) \{/);
  assert.match(ev, /: await etapaDeLaReserva\(supabase, leadId\);/);
  assert.match(ev, /delEvento = deLaEtapaYLasDemas\(conAmbito, donde\?\.etapa, donde\?\.funnelId\);/);
  assert.match(cuerpo(NUTRI, 'async function etapaDeLaReserva('), /etapa: pipelineStageOf\(/);
  // Y lo de siempre sigue: una vez por automatización, el tope de antigüedad y la exclusión de la familia.
  assert.ok(ev.indexOf('deLaEtapaYLasDemas(') < ev.indexOf('delEvento = unaPorSecuencia([...delEvento, ...porLoNuevo]);'));
  assert.ok(ev.indexOf('unaPorSecuencia(') < ev.indexOf('aTiempo(supabase, s, [leadId])'));
  // Los dos webhooks llaman el evento de la reserva DESPUÉS de escribirla.
  for (const p of ['../app/api/webhooks/calendly/route.ts', '../app/api/webhooks/calcom/route.ts']) {
    const w = sinComentarios(leer(p));
    assert.ok(w.indexOf('await enrolarPorEvento(lead.id, \'agenda_nueva\');') > w.indexOf('await upsertLeadFromCalendly('), p);
  }
});

test('M1-b: una reunión cargada a mano inscribe al instante, sólo hacia una etapa de reunión', () => {
  assert.equal(entraAEtapaDeReunion('lead', 'agenda'), true);
  assert.equal(entraAEtapaDeReunion('agenda', 'agendaj2'), true);
  assert.equal(entraAEtapaDeReunion('agenda', 'agenda'), false, 'guardar la ficha con la misma etapa no dispara');
  // Las intermedias de un guardado de varios pasos (fecha → asistencia → etapa) no.
  assert.equal(entraAEtapaDeReunion('agenda', 'noshow_r1'), false);
  assert.equal(entraAEtapaDeReunion('agenda', 'facturando'), false);
  assert.equal(entraAEtapaDeReunion('nutri', 'lead'), false);
  // `updateLead` dispara salvo que cambie el ESTADO (un movimiento: `setPipelineStage` siempre lo manda) o que el
  // que llama escriba la etapa él después (`setMeetingManual`).
  const upd = cuerpo(LEADS, 'export async function updateLead(');
  assert.match(upd, /const cambioDeEstado = input\.estado_lead !== undefined && input\.estado_lead !== actual\.estado_lead;/);
  assert.match(upd, /if \(opts\?\.disparoDeEtapa !== false && !cambioDeEstado && entraAEtapaDeReunion\(antes, despues\)\) \{\s*await enrolarPorEtapaDerivada\(id, despues, actual\.funnel_id \?\? null\);/);
  assert.match(cuerpo(LEADS, 'export async function setPipelineStage('), /const sync: LeadUpdateInput = \{ estado_lead: estado \};/);
  const manual = cuerpo(LEADS, 'export async function setMeetingManual(');
  assert.match(manual, /await updateLead\(leadId, input, \{ disparoDeEtapa: false \}\);/);
  assert.ok(manual.indexOf('enrolarPorEtapaDerivada(') > manual.indexOf("update({ pipeline_stage: null })"), 'dispara DESPUÉS de limpiar el override');
  assert.match(cuerpo(LEADS, 'export async function saveLeadMeta('), /if \(entraAEtapaDeReunion\(pipelineStageOf\(antes\), despues\)\) await enrolarPorEtapaDerivada\(/);
  assert.match(cuerpo(LEADS, 'async function enrolarPorEtapaDerivada('), /await enrolarPorEvento\(leadId, 'etapa', \{ etapa, funnelId \}\);/);
});

test('M2: «prepara una reunión» por el TRIGGER de antes, por el TIPO de la etapa o por un DELAY «antes de la reunión»', () => {
  // Por el trigger de antes (lo de siempre).
  for (const t of [TRIGGER_AGENDA_NUEVO, TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_SIN_CONFIRMAR]) {
    assert.equal(preparaReunion({ trigger_tipo: t }), true, t);
    assert.equal(preparaUnaReunion(t), true, t);
  }
  // Por el tipo de la etapa: Agenda R1 y Agenda R2 son de tipo reunión (`PIPELINE_KIND`).
  assert.equal(PIPELINE_KIND.agenda, 'reunion');
  assert.equal(preparaReunion({ trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda' }), true);
  assert.equal(preparaReunion({ trigger_tipo: TRIGGER_ETAPA, etapa: 'agendaj2' }), true);
  // ⚠️ El del ws13 es SÓLO el aviso, sin DELAY: sin el tipo de la etapa perdía el reuso («un aviso por reserva»).
  const ws13 = { trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda', funnel_id: 6, pasos: [{ id: 'u11aviso', accion: { operacion: 'avisar_al_equipo' } }] };
  assert.equal(preparaReunion(ws13), true);
  // Una etapa que no es de reunión, sin DELAY: no.
  assert.equal(preparaReunion({ trigger_tipo: TRIGGER_ETAPA, etapa: 'lead', pasos: [AUDIO] }), false);
  assert.equal(preparaReunion({ trigger_tipo: 'instant_form_sin_agenda' }), false);
  // Por el DELAY: una etapa cualquiera con un recordatorio adentro, sí.
  assert.equal(preparaReunion({ trigger_tipo: TRIGGER_ETAPA, etapa: 'lead', pasos: [AUDIO, DELAY_ANTES] }), true);
  // Varias etapas (la primera no es de reunión) y varios CRON (el segundo sí): mira la automatización entera.
  assert.equal(preparaReunion({ trigger_tipo: TRIGGER_ETAPA, etapa: 'lead', etapas: ['lead', 'agenda'] }), true);
  assert.equal(preparaReunion({ trigger_tipo: TRIGGER_ETAPA, etapa: 'lead', disparadores: [{ trigger_tipo: TRIGGER_ETAPA, etapa: 'lead' }, { trigger_tipo: TRIGGER_ETAPA, etapa: 'agendaj2' }] }), true);
  // Un embudo propio con su etapa de reunión: el tipo lo dice quien lo sabe.
  assert.equal(preparaReunion({ trigger_tipo: TRIGGER_ETAPA, etapa: 'llamada' }), false);
  assert.equal(preparaReunion({ trigger_tipo: TRIGGER_ETAPA, etapa: 'llamada' }, (k) => (k === 'llamada' ? 'reunion' : null)), true);
  // Y desde una VISTA de un CRON (como la usa el motor): la de «Lead entrante» de un flujo que también cuelga de «Agenda R1».
  const dos = sec({ id: 7, trigger_tipo: TRIGGER_ETAPA, etapa: 'lead', disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_ETAPA, etapa: 'lead' }, { id: 'd2', trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda' }] });
  for (const v of vistasPorDisparador(dos as never)) assert.equal(preparaReunion(v as never), true);
});

test('M2: el REUSO al reagendar decide por la forma del flujo, y todos los usos pasan por `preparaReunion`', () => {
  // La regla del reuso no cambió: una inscripción terminada se reusa con OTRA reunión; la decisión de si aplica es
  // `preparaReunion` (antes `preparaUnaReunion(trigger)`, que con el CRON de etapa daba false y no reusaba nunca).
  const fila = { estado: 'completada', desenlace: null, reunion_at: '2026-10-13T17:00:00.000Z' };
  const nueva = Date.parse('2026-10-20T17:00:00.000Z');
  assert.deepEqual(inscripcionReusable({ fila, marcas: { enviados: 2, borradores: 0 }, reunionNuevaMs: nueva }), { reusable: true, porque: 'reunion_nueva' });
  assert.equal(preparaReunion(AGENDO), true, '«Un Lead Agendó Llamada» del ws1');
  assert.equal(inscripcionReusable({ fila, marcas: SIN_MARCAS, reunionNuevaMs: Date.parse('2026-10-13T20:00:00.000Z') }).reusable, false, 'la misma reunión, no');
  // M4: el lead CONTESTÓ y sólo le quedan los recordatorios ('respondio' con próximo envío): una reserva de OTRA
  // reunión vuelve a armar el flujo (el «Nuevo agendado» de cada reserva); la misma, no (el carril se re-ancla solo).
  const contesto = { estado: 'respondio', desenlace: null, reunion_at: '2026-10-13T17:00:00.000Z', proximo_envio_at: '2026-10-13T16:00:00.000Z' };
  assert.deepEqual(inscripcionReusable({ fila: contesto, marcas: { enviados: 3, borradores: 0 }, reunionNuevaMs: nueva }), { reusable: true, porque: 'reunion_nueva' });
  assert.equal(inscripcionReusable({ fila: contesto, marcas: { enviados: 3, borradores: 0 }, reunionNuevaMs: Date.parse('2026-10-13T20:00:00.000Z') }).porque, 'misma_reunion');
  // Sin el carril vivo, una 'respondio' sigue sin reusarse (la charla del setter; el desenlace la cierra en la hora).
  assert.equal(inscripcionReusable({ fila: { ...contesto, proximo_envio_at: null }, marcas: SIN_MARCAS, reunionNuevaMs: nueva }).porque, 'no_termino');
  assert.match(cuerpo(NUTRI, 'async function reusablesDe('), /\(ESTADOS_TERMINADOS\.includes\(f\.estado\) \|\| soloQuedaElCarril\(f\)\)/);
  assert.match(cuerpo(NUTRI, 'async function inscripcionesDe('), /\$\{conReunion \? ', reunion_at, proximo_envio_at' : ''\}/);
  // Ningún uso quedó con el trigger solo.
  assert.doesNotMatch(NUTRI, /preparaUnaReunion\(/);
  assert.doesNotMatch(DESENLACE, /preparaUnaReunion\(/);
  assert.match(NUTRI, /const reusaInscripciones = \(s: Pick<Secuencia, 'trigger_tipo' \| 'pasos' \| 'etapa' \| 'etapas' \| 'disparadores'>\): boolean =>\s*preparaReunion\(s\) && s\.pasos\.length > 0;/);
  assert.match(cuerpo(NUTRI, 'async function aInscribir('), /const prepara = preparaReunion\(sec\);/);
  assert.match(NUTRI, /const reunionDelPaso = preparaReunion\(sec\) \? reunionQuePreparaMs\(lead\) : null;/);
  assert.match(NUTRI, /if \(anclada \|\| preparaReunion\(sec\)\) \{\s*if \(reunionFuturaMs\(lead\) == null\)/);
  assert.match(NUTRI, /reunionFutura: sec && preparaReunion\(sec\) \? hayReunion : null,/);
  assert.match(cuerpo(NUTRI, 'export async function enrolarPorEvento('), /const reunion = preparaReunion\(s\) \? reunionQuePreparaMs\(juntas\) : null;/);
  assert.match(cuerpo(NUTRI, 'export async function inscribirEnSecuencia('), /const prepara = preparaReunion\(\{ \.\.\.s, pasos \}\);/);
  assert.match(DESENLACE, /const prepara = preparaReunion\(\{ \.\.\.sig, pasos \}\);/);
  // Las lecturas traen lo que `preparaReunion` mira (las etapas y los CRON de la fila).
  assert.match(cuerpo(NUTRI, 'export async function inscribirEnSecuencia('), /funnel_id, producto_id, etapa, etapas, disparadores'\)/);
  assert.match(DESENLACE, /trigger_tipo, etapa, etapas, disparadores'\)/);
});

test('M6: reservar una R1 limpia «nutri», «reactivación» y el no-show de R1 puestos a mano; no toca «Ganado»', () => {
  const despues = deriveStageKey(lead({ pipeline_stage: null }));
  assert.equal(despues, 'agenda');
  for (const k of ['nutri', 'reactivacion', 'noshow', 'noshow_r1', 'lead']) assert.equal(limpiaEtapaAlReservar(k, despues), true, k);
  assert.deepEqual([...ETAPAS_SIN_REUNION].sort(), ['lead', 'noshow', 'noshow_r1', 'nutri', 'reactivacion']);
  for (const k of ['ganado', 'facturando', 'perdido', 'agendaj2', 'manual']) assert.equal(limpiaEtapaAlReservar(k, despues), false, k);
  assert.equal(limpiaEtapaAlReservar(null, despues), false, 'sin override no hay nada que limpiar');
  // Si sin el override no queda en «Agenda R1» (un lead perdido, una R2 por delante), tampoco.
  assert.equal(limpiaEtapaAlReservar('reactivacion', deriveStageKey(lead({ estado_lead: 'perdido' }))), false);
  assert.equal(limpiaEtapaAlReservar('noshow', deriveStageKey(lead({ fecha_junta_2: '2026-10-25' }))), false);
  // El cableado: en la reserva EN VIVO (no en el backfill), auditado como 'Etapa' por MaKo; el evento lo da el webhook.
  const up = cuerpo(LEADS, 'export async function upsertLeadFromCalendly(');
  const vivo = up.slice(up.indexOf('} else {'), up.indexOf('const { data, error } = await supabase'));
  assert.match(vivo, /if \(limpiaEtapaAlReservar\(existing\.pipeline_stage \?\? null, derivadaDespues\)\) updatePayload\.pipeline_stage = null;/);
  assert.match(up, /if \('pipeline_stage' in updatePayload && antes !== despues\) await auditarEtapaDeLaReserva\(existing\.id, antes, data as Lead\);/);
  assert.match(cuerpo(LEADS, 'async function auditarEtapaDeLaReserva('), /campo: CAMPO_ETAPA, valor_anterior: cambio\.desde, valor_nuevo: cambio\.hacia, autor: AUTOR_SISTEMA/);
});
