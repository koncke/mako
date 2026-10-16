// =============================================================================
// LOS MENSAJES DE MaKo A SUS CLIENTES, COMO AUTOMATIZACIONES DE LA PLATAFORMA (15/10/2026)
// =============================================================================
// El 2 de las doce de Martín: «en Automations de SuperAdmin no veo las automatizaciones que armamos para los clientes de
// MaKo y en general allí deberían haber varias automatizaciones más». Decidido con sus reglas escritas («un Mensaje de
// MaKo ES una automatización», «MaKo nada por detrás»); el diseño, en docs/diseno-avisos-plataforma.md. Los primeros dos
// mudados: la línea de WhatsApp de un negocio que se cae (`wa-desconectado`) y la que vuelve (`wa-reconectado`).
//
// Lo que fija este archivo:
//   · el evento lo emite el NEGOCIO, pero lo corren las filas de la PLATAFORMA, y la tarjeta le llega al negocio
//     (`negocioWs`);
//   · la mudanza NO DEJA HUECO: sin ninguna fila de la plataforma, el aviso sale como antes (`sinFila`); con una (aunque
//     esté pausada), decide la automatización;
//   · lo que se avisó se dice (`wa`), porque el vigilante marca «avisado» con eso y sin la marca el «volvió» no sale;
//   · el texto: la plantilla con los datos dice lo mismo que el código de siempre;
//   · sólo se ofrecen en la plataforma, y no aceptan una CONDITION (no hay lead).
//
// ⚠️ PROBADO ROMPIENDO (15/10/2026, scratchpad romper-plataforma.mjs, una rotura por vez y restaurada con sha1 igual).
// Base 7 pass / 0 fail; los números medidos de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emitirPorEvento, pasosDelEvento, MOTIVO_EVENTO, type DepsEvento, type FilaEvento } from '../lib/aviso-evento';
import { eventosOfrecidos, TRIGGER_AVISO_MAKO } from '../lib/disparadores';
import { datosCaida, datosVolvio, textoCaida, textoVolvio } from '../lib/linea-vigilancia';
import { datosPostLlamada } from '../lib/reunion-grabada';
import { plantillaPorId, plantillasPara, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import { partesDeMako } from '../lib/mako-tarjeta';
import type { CtxFlujo } from '../lib/flujos';
import type { EmitirAvisoInput } from '../lib/avisos';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PLATAFORMA = 9;
const NEGOCIO = 13;
const CAT = { id: 'wa-desconectado', titulo: 'WhatsApp de empresa desconectado', categoria: 'aviso' as const, semaforo: 'rojo' as const };
const pasosCaido = () => pasosDePlantilla(plantillaPorId('mako-whatsapp-caido')!) as unknown as PasoGrafo[];
const fila = (id: number, o: Partial<FilaEvento> = {}): FilaEvento => ({
  id, nombre: 'Se Cayó el WhatsApp de un Negocio', activa: true, pasos: pasosCaido(), trigger_tipo: TRIGGER_AVISO_MAKO,
  disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'whatsapp_caido' }], ...o,
});

function deps(filas: FilaEvento[]) {
  const anotado = { leidos: [] as number[], emitidos: [] as EmitirAvisoInput[], corridas: [] as Array<{ ws: number; ctx: CtxFlujo }> };
  const d: DepsEvento = {
    leerFilas: async (ws) => { anotado.leidos.push(ws); return filas; },
    emitirAviso: async (a) => { anotado.emitidos.push(a); return { ok: true, feedId: 1, wa: false, deduped: false, apagado: true }; },
    reclamar: async () => true,
    correr: async (_id, _pasos, ws, ctx) => { anotado.corridas.push({ ws, ctx }); },
    wsPlataforma: async () => PLATAFORMA,
    log: () => {},
  };
  return { d, anotado };
}
const HECHOS = { motivo: { desvinculado: true, cuando: '2026-10-03T15:00:00Z' }, desde: null, linea: '+5215512345678', link: 'https://hola-mako.com/whatsapp', tz: 'America/Mexico_City' };
const OPTS = { texto: textoCaida(HECHOS), datos: datosCaida(HECHOS), dedupKey: 'mako_ws13', dedupTtlMin: 60 };

// rotura 1 (las filas se leen en el negocio, no en la plataforma): 6 pass / 1 fail, cae éste.
test('lo emite el negocio, lo corren las filas de la PLATAFORMA, y la tarjeta le llega al negocio', async () => {
  const { d, anotado } = deps([fila(301)]);
  const r = await emitirPorEvento(CAT, NEGOCIO, OPTS, d);
  assert.deepEqual(anotado.leidos, [PLATAFORMA], 'las filas son de la plataforma');
  assert.equal(anotado.corridas.length, 1);
  assert.equal(anotado.corridas[0].ws, PLATAFORMA, 'la corrida es de la plataforma');
  assert.equal(anotado.corridas[0].ctx.negocioWs, NEGOCIO, 'la tarjeta va al negocio que lo emitió');
  assert.deepEqual(anotado.corridas[0].ctx.datos, OPTS.datos);
  // rotura 2 (`wa` siempre false): 6 pass / 1 fail, cae éste. Sin esto el vigilante no marca «avisado» y el «volvió» no sale.
  assert.equal(r.wa, true, 'lo que corrió se dice: el vigilante marca «avisado» con esto');
});

// rotura 3 (sin el `sinFila`): 6 pass / 1 fail, cae éste.
test('la mudanza no deja hueco: sin fila en la plataforma, `sinFila` (sale como antes); con una pausada, decide ella', async () => {
  const sin = deps([]);
  const r = await emitirPorEvento(CAT, NEGOCIO, OPTS, sin.d);
  assert.equal(r.sinFila, true);
  assert.equal(sin.anotado.corridas.length + sin.anotado.emitidos.length, 0, 'sin fila, el emisor no hace nada: lo manda el de siempre');
  const pausada = deps([fila(301, { activa: false })]);
  const r2 = await emitirPorEvento(CAT, NEGOCIO, OPTS, pausada.d);
  assert.equal(r2.sinFila, undefined, 'pausada es una decisión: no vuelve al de siempre');
  assert.equal(pausada.anotado.corridas.length, 0);
  // El de siempre, en lib/avisos.ts: sólo con `sinFila` sigue al store.
  assert.match(leer('lib/avisos.ts'), /const r = await emitirPorEvento\(cat, ws, opts, await depsDelEvento\(\)\);\n(\s*\/\/[^\n]*\n)*\s*if \(!r\.sinFila\) return r;/);
});

// rotura 4 (`datosCaida` con otro texto: el de los clientes cambiaría): 6 pass / 1 fail, cae éste.
test('el texto: la plantilla con los datos dice lo mismo que el código de siempre', () => {
  const tarjeta = (id: string) => {
    const p = pasosDePlantilla(plantillaPorId(id)!)[0] as unknown as PasoGrafo;
    const parte = partesDeMako((p.accion as { params?: Record<string, unknown> }).params)[0];
    return parte && 'cuerpo' in parte ? String(parte.cuerpo) : '';
  };
  // Lo que reciben HOY los negocios, letra por letra (lib/linea-vigilancia.ts antes del 15/10): la mudanza no lo cambia.
  assert.equal(textoCaida(HECHOS), '🔴 *Se desconectó tu WhatsApp* (+5215512345678). WhatsApp cerró la sesión del dispositivo vinculado el 3 de octubre: tu teléfono está bien, pero por ese número no entran ni salen mensajes. Vuelve a escanear el QR: https://hola-mako.com/whatsapp — MaKo');
  assert.equal(textoCaida({ ...HECHOS, motivo: null, desde: '2026-10-03T15:00:00Z' }), '🔴 *Se cortó tu WhatsApp* (+5215512345678). Por ese número no entran ni salen mensajes desde el 3 de octubre. Puede volver solo; si sigue así, reconéctalo: https://hola-mako.com/whatsapp — MaKo');
  assert.equal(textoVolvio({ linea: null }), '🟢 *Volvió tu WhatsApp*. Por ese número ya entran y salen mensajes otra vez. — MaKo');
  const plano = (t: string) => t.replace(/\s*—\s*MaKo$/, '').replace(/\s*\n\s*/g, ' ').replace(/\s*📱\s*/g, ' ');
  for (const motivo of [HECHOS.motivo, null]) {
    const h = { ...HECHOS, motivo };
    const conPlantilla = textoConDatos(tarjeta('mako-whatsapp-caido'), datosCaida(h));
    // Lo mismo, salvo el formato: un dato por renglón (la tarjeta), contra la línea entre paréntesis (el código).
    assert.equal(plano(conPlantilla), plano(textoCaida(h)).replace(/ \((\+\d+)\)\./, ' $1'));
  }
  assert.equal(plano(textoConDatos(tarjeta('mako-whatsapp-volvio'), datosVolvio({ linea: '+5215512345678' }))), plano(textoVolvio({ linea: '+5215512345678' })).replace(/ \((\+\d+)\)\./, ' $1'));
  // Sin número ni etiqueta, el renglón se va entero: nada de «()» ni de «📱» solo.
  assert.doesNotMatch(textoConDatos(tarjeta('mako-whatsapp-caido'), datosCaida({ ...HECHOS, linea: null })), /📱/);
});

// rotura 5 (se ofrecen en un negocio): 5 pass / 2 fail, caen éste y el de Fathom.
test('sólo en la plataforma: el evento en el CRON y la plantilla en la galería', () => {
  const sub = (o: { plataforma?: boolean }) => eventosOfrecidos('mako', null, o).map((e) => e.subtipo);
  assert.ok(!sub({}).includes('whatsapp_caido') && !sub({}).includes('whatsapp_volvio'), 'un negocio no los ve');
  assert.ok(sub({ plataforma: true }).includes('whatsapp_caido') && sub({ plataforma: true }).includes('whatsapp_volvio'));
  const ids = (o: { plataforma: boolean }) => plantillasPara(o).map((p) => p.id);
  assert.ok(!ids({ plataforma: false }).includes('mako-whatsapp-caido'));
  assert.ok(ids({ plataforma: true }).includes('mako-whatsapp-caido') && ids({ plataforma: true }).includes('mako-whatsapp-volvio'));
});

// rotura 6 (una CONDITION pasa en un evento de la plataforma): 6 pass / 1 fail, cae éste.
test('un evento de la plataforma no trae lead: una CONDITION no corre, y la plantilla sí', () => {
  assert.equal(pasosDelEvento(pasosCaido(), 'whatsapp_caido').problema, null, 'la plantilla corre');
  const conCondicion = [
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'c_si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'wc_mk' }], si_no: null },
    ...pasosCaido(),
  ] as unknown as PasoGrafo[];
  assert.equal(pasosDelEvento(conCondicion, 'whatsapp_caido').problema, MOTIVO_EVENTO.condicionPersona);
});

// LA GRABACIÓN DE FATHOM (el tercero mudado): trae al LEAD del negocio, y la tarjeta lo cita con los datos de siempre.
// rotura 7 (`datosPostLlamada` con la duración vacía en vez de faltar): 6 pass / 1 fail, cae éste.
test('Fathom: el lead y la reunión que terminó; sin duración, su renglón se va solo', async () => {
  const p = pasosDePlantilla(plantillaPorId('mako-reunion-grabada')!)[0] as unknown as PasoGrafo;
  const parte = partesDeMako((p.accion as { params?: Record<string, unknown> }).params)[0];
  const tarjeta = parte && 'cuerpo' in parte ? String(parte.cuerpo) : '';
  const lead = { nombre_completo: 'Laura Gil', link_lead: 'https://hola-mako.com/crm/482/resumen' };
  const con = textoConDatos(tarjeta, { ...lead, ...datosPostLlamada({ reunion: 'R1', duracionMin: 42 }) });
  assert.equal(con, '✅ Terminó la *R1 con Laura Gil*.\n⏱️ 42 min\n\n👉 Mira el resumen de la llamada:\nhttps://hola-mako.com/crm/482/resumen');
  const sin = textoConDatos(tarjeta, { ...lead, ...datosPostLlamada({ reunion: 'R2', duracionMin: null }) });
  assert.doesNotMatch(sin, /⏱️/, 'sin duración, el renglón no queda con el reloj solo');
  assert.match(sin, /^✅ Terminó la \*R2 con Laura Gil\*\./, 'y la frase principal sigue');
  // Lo emite el negocio con su lead: la corrida lo lleva, y la tarjeta le llega al negocio.
  const { d, anotado } = deps([{ ...fila(302), disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'reunion_grabada' }], pasos: pasosDePlantilla(plantillaPorId('mako-reunion-grabada')!) }]);
  await emitirPorEvento({ id: 'reunion-ocurrio-fathom', titulo: 'Reunión ocurrió', categoria: 'aviso', semaforo: 'na' }, NEGOCIO, { lead: { id: 482, nombre: 'Laura Gil' }, datos: datosPostLlamada({ reunion: 'R1', duracionMin: 42 }) }, d);
  assert.equal(anotado.corridas[0].ctx.leadId, 482);
  assert.equal(anotado.corridas[0].ctx.negocioWs, NEGOCIO);
  assert.ok(!eventosOfrecidos('mako', null, {}).some((e) => e.subtipo === 'reunion_grabada'), 'un negocio no lo ve');
  assert.match(leer('app/api/webhooks/fathom/route.ts'), /emitirDelCatalogo\('reunion-ocurrio-fathom', \{ texto, lead: \{ id: lead\.id, nombre \}, datos: datosPostLlamada\(\{ reunion, duracionMin: dur \}\) \}\)/);
});

test('el runner manda la tarjeta al negocio del evento, con sus datos y sus links', () => {
  const flujos = leer('lib/flujos.ts');
  const tarjeta = flujos.slice(flujos.indexOf('async function emitirTarjetaDelEvento('), flujos.indexOf('\n}\n', flujos.indexOf('async function emitirTarjetaDelEvento(')));
  assert.match(tarjeta, /const wsDestino = ctx\.negocioWs \?\? ws;/);
  assert.match(tarjeta, /ws: wsDestino, leadId: ctx\.leadId/);
  assert.match(tarjeta, /semaforo: cat\?\.semaforo, ws: wsDestino,/);
});
