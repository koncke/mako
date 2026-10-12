// =============================================================================
// LOS FLUJOS DE PROD REHECHOS CON LAS PIEZAS DE HOY (undécima tanda, ola 4; docs/diseno-undecima-tanda.md §3)
// =============================================================================
// Martín (11/10/2026): «Jamás se debe cambiar una tarjeta, no se más como decirlo... Elimina todas los flujos y
// vuelvelos a hacer con las herramientas que ya existen» y «"Recordatorio de reunión" NO debería ser un flujo aparte
// ... Y que el único flujo pase a llamarse "Un Lead Agendó Llamada"». Lo que se EJECUTA acá: las propuestas de
// lib/undecima-flujos-plan.ts (lo único que escribe es scripts/undecima-flujos.mts, en simulacro por defecto), con las
// funciones del motor y de Publicar:
//   · validarGrafo vacío, ningún CRON «(de antes)», problemasDeTokens vacío y ningún {{mensaje_mako}},
//     problemasDeForma vacío (ni CONDITION → CONDITION ni CONDITION → DELAY → CONDITION), un AI Step por medio;
//   · el camino 3 de #213 da 1440 / 60 / 15 por `minutosAntesDeReunion` y null en o1, ne9jyr0 y el aviso;
//   · las raíces de #213 son nvlvg08, u11aviso y u11e1440; los ids viejos siguen en su índice y los nuevos al final;
//   · los textos de entrada salen VERBATIM (los escenarios de #213, el audio, el WhatsApp de MaKo);
//   · idempotencia: sobre la fila rehecha, ninguna propuesta escribe nada.
// Las fixtures son SINTÉTICAS: la MISMA estructura de prod (ids, clases, flechas, CRON, títulos de los casos) con
// textos de prueba. Ningún dato de un cliente.
//
// PROBADO ROMPIÉNDOLO (11/10/2026, arnés del scratchpad `wf-undecima/w4-flujos-prod/roturas.cjs`: guarda el original
// en memoria, aplica la rotura en lib/undecima-flujos-plan.ts, corre este archivo y lo restaura byte a byte). Base:
// 13 pass / 0 fail. «pass / fail» con cada rotura:
//   R1 #198 conserva el DELAY nv8c28e y la segunda CONDITION (CONDITION → DELAY → CONDITION)   → 10 / 3
//      (lo frenan la forma —«CONDITION, DELAY y otra CONDITION»—, el test de los datos y el de #198)
//   R2 el aviso «Nuevo agendado» con {{mensaje_mako}}                                          → 11 / 2
//   R3 los nodos nuevos de #213 al PRINCIPIO del array (corre el índice de los viejos)        →  5 / 8
//      (el propio plan se niega —«se correrían de índice»— y todo lo de #213 cae)
//   R4 el plan le cambia el texto a un escenario de #213                                      → 11 / 2
//      (el de los escenarios VERBATIM y la idempotencia)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PasoGrafo, CasoRespuesta } from '../lib/flujo-grafo';
import {
  nodoPorId, idDe, esPasoIA, raicesSalida, validarGrafo, antiguedadDeEntrada, normalizar,
} from '../lib/flujo-grafo';
import { libertadDeCaso } from '../lib/ai-step-libertad';
import { minutosAntesDeReunion } from '../lib/nutricion-grafo-motor';
import { esEventoDeAntes, disparadoresDe, TRIGGER_AVISO_MAKO } from '../lib/disparadores';
import { problemasDeTokens } from '../lib/tokens-del-flujo';
import { problemasDeForma } from '../lib/flujo-forma';
import { partesDeMako } from '../lib/mako-tarjeta';
import {
  planBienvenidaWs1, planAgendoWs1, planArchivar, planFelicitacion, planAgendoNueva, planBienvenidaWs4, planAgendoWs4,
  reescribirEventoMako, chequearPropuesta, filaDespues, usaMensajeMako, textosDeRecordatorio,
  IDS_AGENDO, ORDEN_NUEVOS_AGENDO, TOQUES_AGENDO, IDS_198, IDS_213, ESCENARIOS_AGENDO, OBJETIVO_AGENDO, OBJETIVO_ENTRO,
  NOMBRE_AGENDO, NOMBRE_ENTRO, TEXTO_NO_CONFIRMO, TEXTO_NO_CONFIRMO_ANTES, TEXTO_NUEVO_AGENDADO,
  type FilaFlujo, type Propuesta, type Plan,
} from '../lib/undecima-flujos-plan';

// ── Fixtures sintéticas con la forma de prod ────────────────────────────────────────────────────

const R = { canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null } as const;
const cond = (id: string, ramas: PasoGrafo['ramas'], si_no: string | null): PasoGrafo => ({ ...R, id, nodo: 'condicion', ramas, si_no });
const espera = (id: string, minutos: number, siguiente: string | null, modo: 'tiempo' | 'antes_reunion' = 'tiempo'): PasoGrafo =>
  ({ ...R, id, nodo: 'esperar', espera: { modo, minutos }, siguiente });
const audio = (id: string, audio_id: number, cuerpo: string, siguiente: string | null, revisar = false): PasoGrafo =>
  ({ ...R, id, tipo: 'audio', audio_id, cuerpo, revisar, proveedor: 'no_oficial', siguiente });
const caso = (id: string, titulo: string, o: Partial<CasoRespuesta> = {}): CasoRespuesta =>
  ({ id, titulo, cuando: `Cuándo de prueba: ${titulo}`, responder: `Respuesta de prueba: ${titulo}`, siguiente: null, ...o });
const ia = (id: string, casos: CasoRespuesta[]): PasoGrafo => ({ ...R, id, nodo: 'respuesta', paso_ia: true, casos, si_no: null });
const fila = (o: Partial<FilaFlujo> & Pick<FilaFlujo, 'id' | 'pasos' | 'trigger_tipo'>): FilaFlujo => ({
  workspace_id: 91, nombre: 'Prueba', clave: null, etapa: 'manual', etapas: null, funnel_id: null, producto_id: null, etiqueta_id: null,
  cron: null, cron_proxima_at: null, activa: true, archivada_at: null, updated_at: '2026-10-11T00:00:00.000Z', pasos_borrador: null,
  posiciones: null, disparadores: null, disparadores_rev: 0, emoji: null, ...o,
});

/** #198: CONDITION «< 72 h» → DELAY 1 h → CONDITION «Agendó» (si no → o0) + el AI Step con «Cualquier respuesta». */
const f198 = (): FilaFlujo => fila({
  id: 198, trigger_tipo: 'instant_form_sin_agenda', etapa: 'nutri', pasos_borrador: [{ id: 'x' }],
  pasos: [
    cond('n2199q6', [{ id: 'rA', modo: 'todas', filas: [{ campo: 'antiguedad', valor: 72 }], siguiente: 'nv8c28e' }], null),
    espera('nv8c28e', 60, 'nz7zsf8'),
    cond('nz7zsf8', [{ id: 'rB', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: null }], 'o0'),
    audio('o0', 101, 'Audio de prueba: https://ejemplo.test', null),
    ia('n1b5m7i', [caso('c0', 'Cualquier respuesta', { cuando: '', responder: undefined, cualquiera: true, no_contesta: true, avisar: true })]),
  ],
});

/** #213: 12 tarjetas, cuatro AI Step de un caso (índices 6, 9, 10, 11), dos CRON «(de antes)». */
const f213 = (): FilaFlujo => fila({
  id: 213, trigger_tipo: 'agendado_primer_contacto', etapa: 'postagenda', disparadores_rev: 1, posiciones: { o1: { x: 1, y: 2 } },
  disparadores: [{ id: 'd1', trigger_tipo: 'agendado_primer_contacto', etapa: 'postagenda' }, { id: 'd2', trigger_tipo: 'agendado_ya_contactado' }],
  pasos: [
    espera('nvlvg08', 60, 'n2jl2v4'),
    audio('o0', 107, 'Audio de prueba siete', 'nh92v3h'),
    espera('nh92v3h', 1440, 'o1'),
    { ...R, id: 'o1', tipo: 'ia', cuerpo: 'Hola {{nombre}}, mensaje de prueba', variantes: ['Hola {{nombre}}, variante A', '{{nombre}}, variante B'], revisar: false, proveedor: 'no_oficial', siguiente: 'n4z5uil' } as PasoGrafo,
    espera('n4z5uil', 720, 'ne9jyr0'),
    { ...R, id: 'ne9jyr0', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', titulo: 'título de antes', mensaje: TEXTO_NO_CONFIRMO_ANTES } } },
    ia('nb7dt1y', [caso('k1', 'Confirma o ya vio el video', { sola: true })]),
    cond('n2jl2v4', [{ id: 'rY', modo: 'todas', filas: [{ campo: 'ya_contactado' }], siguiente: 'n136j5s' }], 'o0'),
    audio('n136j5s', 105, 'Audio de prueba cinco', 'nh92v3h'),
    ia('nyiufgy', [caso('k2', 'Pregunta el precio')]),
    ia('nofi37o', [caso('k3', 'Pregunta por la reunión')]),
    ia('njodb7o', [caso('k4', 'Quiere cambiar el día', { sola: true })]),
  ],
});

/** #228: el recordatorio del emisor, con los datos DEL EMISOR ({{cuando}}, {{hora}}, {{faltan}}, {{link}}). */
const f228 = (): FilaFlujo => fila({
  id: 228, trigger_tipo: 'reunion_recordatorio', pasos: [
    espera('espera-1440', 1440, 'toque-1440', 'antes_reunion'),
    { ...R, id: 'toque-1440', tipo: 'texto', cuerpo: 'Prueba {{nombre}}: {{cuando}} a las {{hora}}.\nLink: {{link}}', proveedor: 'no_oficial', siguiente: 'espera-60' },
    espera('espera-60', 60, 'toque-60', 'antes_reunion'),
    { ...R, id: 'toque-60', tipo: 'texto', cuerpo: 'Prueba {{nombre}}: {{faltan}}, {{hora}}. {{link}}', proveedor: 'no_oficial', siguiente: 'espera-15' },
    espera('espera-15', 15, 'toque-15', 'antes_reunion'),
    { ...R, id: 'toque-15', tipo: 'texto', cuerpo: 'Prueba {{nombre}}: {{faltan}}. {{link}}', proveedor: 'no_oficial', siguiente: null },
  ],
});

const f209 = (): FilaFlujo => fila({
  id: 209, workspace_id: 94, activa: false, trigger_tipo: 'instant_form_sin_agenda', etapa: 'nutri',
  pasos: [espera('nyoyu9g', 60, 'o0'), audio('o0', 127, 'Audio de prueba 27', null, true)],
});
const f210 = (): FilaFlujo => fila({
  id: 210, workspace_id: 94, activa: false, trigger_tipo: 'agendado_sin_confirmar', etapa: 'postagenda',
  pasos: [
    cond('n15t6s5', [{ id: 'rZ', modo: 'todas', filas: [{ campo: 'ya_contactado' }], siguiente: 'n48anmb' }], 'n9cyxap'),
    espera('n48anmb', 60, 'o0'), audio('o0', 126, '', null, true), espera('n9cyxap', 60, 'o1'), audio('o1', 125, '', null, true),
  ],
});

const CRON_ENTRO = { funnelId: 7, etapa: 'lead' };
const CRON_AGENDO = { funnelId: 7, etapa: 'agenda' };

const propuesta = (p: Plan): Propuesta => {
  assert.ok(p.ok, p.ok ? '' : p.error);
  return (p as { ok: true; propuesta: Propuesta }).propuesta;
};
const p198 = () => propuesta(planBienvenidaWs1(f198(), CRON_ENTRO));
const p213 = () => propuesta(planAgendoWs1(f213(), f228(), CRON_AGENDO));
const todas = (): Array<[string, Propuesta]> => [
  ['#198', p198()], ['#213', p213()], ['#238', propuesta(planFelicitacion(fila({
    id: 238, activa: false, trigger_tipo: 'entrega_actual', etapa: 'onboarding', producto_id: 13, disparadores_rev: 1,
    disparadores: [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'lead', funnel_id: 1 }],
    pasos: [{ ...R, id: 'm1', canal: 'email', asunto: 'Asunto de prueba', cuerpo: 'Hola {{nombre}}', siguiente: null, proveedor: 'no_oficial' }],
  })))],
  ['ws13', propuesta(planAgendoNueva(93, { funnelId: 8, etapa: 'agenda' }, null))],
  ['#209', propuesta(planBienvenidaWs4(f209(), CRON_ENTRO))], ['#210', propuesta(planAgendoWs4(f210(), CRON_AGENDO))],
];

// ── Las reglas de hoy, en TODAS las propuestas ──────────────────────────────────────────────────

test('toda propuesta pasa lo que frena Publicar: validarGrafo, datos, CRON, forma, un AI Step con objetivo, ida y vuelta', () => {
  for (const [n, p] of todas()) {
    assert.deepEqual(chequearPropuesta(p), [], n);
    assert.deepEqual(validarGrafo(p.pasos), [], n);
  }
});

test('ningún CRON «(de antes)»: cada flujo arranca en una ETAPA (el editor del CRON, con su revisión subida)', () => {
  for (const [n, p] of todas()) {
    for (const d of p.disparadores) assert.equal(esEventoDeAntes(d), false, `${n}: ${d.trigger_tipo}`);
  }
  const p = p213();
  assert.deepEqual(p.disparadores, [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agenda', etapas: null, funnel_id: 7 }]);
  // La MISMA forma que `guardarDisparadores`: el primero en las columnas, la lista entera y la revisión + 1.
  assert.equal(p.columnas.trigger_tipo, 'etapa_actual');
  assert.equal(p.columnas.etapa, 'agenda');
  assert.equal(p.columnas.funnel_id, 7);
  assert.equal(p.columnas.cron_proxima_at, null);
  assert.deepEqual(p.columnas.disparadores, p.disparadores);
  assert.equal(p.columnas.disparadores_rev, 2);
  assert.ok(Array.isArray(p.columnas.pasos) && Array.isArray(p.columnas.disparadores), 'jsonb como objeto, nunca como string');
});

test('los datos se pueden citar todos y NINGUNO es {{mensaje_mako}}; la forma no trae CONDITION pegadas ni con un DELAY en el medio', () => {
  for (const [n, p] of todas()) {
    assert.deepEqual(problemasDeTokens(p.pasos, p.disparadores[0].trigger_tipo), [], n);
    assert.equal(usaMensajeMako(p.pasos), false, n);
    assert.deepEqual(problemasDeForma(p.pasos, p.disparadores), [], n);
    for (const m of ['whatsapp', 'instagram', 'messenger']) assert.ok(p.pasos.filter((x) => esPasoIA(x) && (x.medio ?? 'whatsapp') === m).length <= 1, `${n}: un AI Step por medio`);
  }
});

// ── #198 «Un Lead Entró» ────────────────────────────────────────────────────────────────────────

test('#198: CRON «Lead entrante» → UNA CONDITION «Llegó hace menos de 72 h» y «No agendó» → el audio; el AI Step con objetivo y sin escenarios', () => {
  const p = p198();
  assert.equal(p.nombre, NOMBRE_ENTRO);
  assert.deepEqual(p.pasos.map((x, i) => idDe(x, i)), ['n2199q6', 'o0', 'n1b5m7i'], 'se van el DELAY y la segunda CONDITION');
  const c = nodoPorId(p.pasos, 'n2199q6')!;
  assert.deepEqual(c.ramas, [{ id: 'rA', modo: 'todas', filas: [{ campo: 'antiguedad', valor: 72 }, { campo: 'agendo', no: true, union: 'y' }], siguiente: 'o0' }]);
  assert.equal(c.si_no, null);
  assert.equal(antiguedadDeEntrada(p.pasos), 72, 'el tope al inscribir se conserva');
  // El audio, VERBATIM.
  assert.deepEqual({ ...nodoPorId(p.pasos, 'o0')!, orden: 0 }, { ...nodoPorId(f198().pasos as PasoGrafo[], 'o0')!, orden: 0 });
  const ai = nodoPorId(p.pasos, 'n1b5m7i')!;
  assert.equal(ai.objetivo, OBJETIVO_ENTRO);
  assert.deepEqual(ai.casos, [], '«Lo demás: Sólo te avisa» es el default: sin el caso');
  assert.equal(p.columnas.pasos_borrador, null, 'el borrador de antes se va');
  assert.equal(p.activa, true);
});

// ── #213 «Un Lead Agendó Llamada» ───────────────────────────────────────────────────────────────

test('#213: los ids viejos en su índice y los nuevos AL FINAL; las raíces son nvlvg08, u11aviso y u11e1440', () => {
  const antes = normalizar(f213().pasos as PasoGrafo[]);
  const p = p213();
  assert.equal(p.nombre, NOMBRE_AGENDO);
  const ids = p.pasos.map((x, i) => idDe(x, i));
  antes.forEach((x, i) => { if (!IDS_213.plegados.includes(x.id!)) assert.equal(ids[i], x.id, `${x.id} cambió de índice`); });
  assert.deepEqual(ids.slice(9), ORDEN_NUEVOS_AGENDO, 'los nuevos, al final y en su orden');
  for (const id of IDS_213.plegados) assert.equal(nodoPorId(p.pasos, id), null, `${id} se pliega en nb7dt1y`);
  assert.deepEqual(raicesSalida(p.pasos), [IDS_213.espera, IDS_AGENDO.aviso, IDS_AGENDO.e1440]);
});

test('#213: el camino 3 da 1440 / 60 / 15 por `minutosAntesDeReunion`; la preparación y el aviso no son del carril', () => {
  const p = p213();
  const idx = (id: string) => p.pasos.findIndex((x) => x.id === id);
  assert.deepEqual(TOQUES_AGENDO.map((t) => minutosAntesDeReunion(p.pasos, idx(t.toque))), [1440, 60, 15]);
  for (const id of [IDS_213.mensaje, IDS_213.noConfirmo, IDS_AGENDO.aviso]) assert.equal(minutosAntesDeReunion(p.pasos, idx(id)), null, id);
  // Los textos de #228, traducidos al catálogo del motor (`{{hora}}` del emisor es la hora de la REUNIÓN).
  assert.equal(nodoPorId(p.pasos, IDS_AGENDO.t1440)!.cuerpo, 'Prueba {{nombre}}: {{reunion_cuando}} a las {{reunion_hora}}.\nLink: {{reunion_link}}');
  assert.equal(nodoPorId(p.pasos, IDS_AGENDO.t60)!.cuerpo, 'Prueba {{nombre}}: {{reunion_faltan}}, {{reunion_hora}}. {{reunion_link}}');
  for (const t of TOQUES_AGENDO) assert.equal(nodoPorId(p.pasos, t.toque)!.revisar, false, 'los recordatorios salen solos');
  // Un dato del emisor que no está en el mapa no se adivina.
  const raro = f228();
  (raro.pasos as PasoGrafo[])[1].cuerpo = 'Hola {{nombre}} {{inventado}}';
  assert.match(String((textosDeRecordatorio(raro) as { error?: string }).error), /\{\{inventado\}\}/);
});

test('#213: UN AI Step con su objetivo y los escenarios VERBATIM, en orden y con su libertad; «Lo demás: Sólo te avisa»', () => {
  const antes = f213().pasos as PasoGrafo[];
  const p = p213();
  const ias = p.pasos.filter((x) => esPasoIA(x));
  assert.equal(ias.length, 1);
  const ai = ias[0];
  assert.equal(ai.id, IDS_213.ia);
  assert.equal(ai.objetivo, OBJETIVO_AGENDO);
  assert.deepEqual(ai.casos!.map((c) => [c.titulo, libertadDeCaso(c)]), ESCENARIOS_AGENDO.map(([t, l]) => [t, l]));
  const originales = antes.filter((x) => esPasoIA(x)).flatMap((x) => x.casos ?? []);
  for (const c of ai.casos!) {
    const o = originales.find((x) => x.id === c.id)!;
    assert.deepEqual([c.titulo, c.cuando, c.responder], [o.titulo, o.cuando, o.responder], `«${c.titulo}» cambió de texto`);
  }
  assert.equal(ai.casos!.some((c) => c.cualquiera), false);
});

test('#213: el «no confirmó» y el «Nuevo agendado» son «MaKo en WhatsApp» con partes y los datos a la vista', () => {
  const p = p213();
  assert.deepEqual(partesDeMako((nodoPorId(p.pasos, IDS_213.noConfirmo)!.accion as { params: Record<string, unknown> }).params), [{ tipo: 'texto', cuerpo: TEXTO_NO_CONFIRMO }]);
  assert.deepEqual(partesDeMako((nodoPorId(p.pasos, IDS_AGENDO.aviso)!.accion as { params: Record<string, unknown> }).params), [{ tipo: 'texto', cuerpo: TEXTO_NUEVO_AGENDADO }]);
  // Lo demás del camino 1, VERBATIM (salvo el `orden`, que es su índice + 1).
  const antes = f213().pasos as PasoGrafo[];
  for (const id of [IDS_213.audio, IDS_213.mensaje, IDS_213.audioConocido]) assert.deepEqual({ ...nodoPorId(p.pasos, id)!, orden: 0 }, { ...nodoPorId(antes, id)!, orden: 0 }, id);
  // Un «no confirmó» que alguien cambió no se pisa.
  const otra = f213();
  ((otra.pasos as PasoGrafo[])[5].accion as { params: { mensaje: string } }).params.mensaje = 'Otro texto';
  assert.equal(planAgendoWs1(otra, f228(), CRON_AGENDO).ok, false);
});

// ── Lo demás ────────────────────────────────────────────────────────────────────────────────────

test('archivar es cerrar (pausada + archivada_at), nunca borrar; #238 sólo deja su lista coherente con las columnas', () => {
  const a = propuesta(planArchivar(f228(), '2026-10-12T00:00:00.000Z'));
  assert.deepEqual(a.columnas, { activa: false, archivada_at: '2026-10-12T00:00:00.000Z' });
  assert.deepEqual(propuesta(planArchivar({ ...f228(), archivada_at: '2026-10-12T00:00:00.000Z' }, 'x')).columnas, {});
  const f = fila({ id: 238, activa: false, trigger_tipo: 'entrega_actual', etapa: 'onboarding', producto_id: 13, disparadores_rev: 1, disparadores: [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'lead', funnel_id: 1 }], pasos: [] });
  // Lo que ya corre es la COLUMNA (`disparadoresDe` arma el primero de las columnas): se escribe eso en la lista.
  assert.deepEqual(disparadoresDe(f).map((d) => d.trigger_tipo), ['entrega_actual']);
  const p = propuesta(planFelicitacion(f));
  assert.deepEqual(Object.keys(p.columnas).sort(), ['disparadores', 'disparadores_rev']);
  assert.deepEqual((p.columnas.disparadores as Array<{ trigger_tipo: string }>).map((d) => d.trigger_tipo), ['entrega_actual']);
  assert.equal(p.activa, false);
});

test('ws4: #209 CONDITION «< 720 h» y «No agendó» → audio para aprobar; #210 DELAY → «Ya le escribiste» → audio / si no audio; pausadas', () => {
  const a = propuesta(planBienvenidaWs4(f209(), CRON_ENTRO));
  assert.equal(antiguedadDeEntrada(a.pasos), 720);
  assert.equal(nodoPorId(a.pasos, 'o0')!.revisar, true);
  assert.equal(a.activa, false);
  const b = propuesta(planAgendoWs4(f210(), CRON_AGENDO));
  assert.deepEqual(b.pasos.map((x, i) => idDe(x, i)), ['n48anmb', 'n15t6s5', 'o0', 'o1']);
  assert.equal(nodoPorId(b.pasos, 'n15t6s5')!.si_no, 'o1');
  assert.equal(b.activa, false);
});

test('ws13: la fila NUEVA nace con el CRON de su etapa de reunión y el aviso; un Evento de MaKo con {{mensaje_mako}} se rehace con la plantilla de su evento', () => {
  const n = propuesta(planAgendoNueva(93, { funnelId: 8, etapa: 'agenda' }, null));
  assert.equal(n.tipo, 'crear');
  assert.equal(n.columnas.clave, 'undecima-lead-agendo-ws93');
  assert.deepEqual(n.pasos.map((x) => x.id), [IDS_AGENDO.aviso]);
  const pago = fila({ id: 400, trigger_tipo: TRIGGER_AVISO_MAKO, disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'pago_recibido' }],
    pasos: [{ ...R, id: 'ma_aviso', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: '{{mensaje_mako}}' } } }] });
  const p = propuesta(reescribirEventoMako(pago));
  assert.equal(usaMensajeMako(p.pasos), false);
  assert.deepEqual(chequearPropuesta(p), []);
  // Un evento retirado (sin plantilla nueva) no se adivina.
  assert.equal(reescribirEventoMako({ ...pago, disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'lead_agendo' }] }).ok, false);
});

test('idempotente: sobre la fila rehecha, ninguna propuesta escribe nada', () => {
  const vueltas: Array<[string, FilaFlujo, (f: FilaFlujo) => Plan]> = [
    ['#198', f198(), (f) => planBienvenidaWs1(f, CRON_ENTRO)],
    ['#213', f213(), (f) => planAgendoWs1(f, null, CRON_AGENDO)],
    ['#209', f209(), (f) => planBienvenidaWs4(f, CRON_ENTRO)],
    ['#210', f210(), (f) => planAgendoWs4(f, CRON_AGENDO)],
  ];
  for (const [n, f, plan] of vueltas) {
    const una = propuesta(n === '#213' ? planAgendoWs1(f, f228(), CRON_AGENDO) : plan(f));
    const dos = propuesta(plan(filaDespues(f, una)));
    assert.deepEqual(dos.columnas, {}, n);
  }
});

test('frena lo que el plan no conoce: una tarjeta de más, un escenario que no es el de §3', () => {
  const mas = f198();
  (mas.pasos as PasoGrafo[]).push({ ...R, id: 'extra', cuerpo: 'x', siguiente: null });
  assert.equal(planBienvenidaWs1(mas, CRON_ENTRO).ok, false);
  const otro = f213();
  ((otro.pasos as PasoGrafo[])[9].casos as CasoRespuesta[])[0].titulo = 'Otro escenario';
  assert.equal(planAgendoWs1(otro, f228(), CRON_AGENDO).ok, false);
  void IDS_198;
});
