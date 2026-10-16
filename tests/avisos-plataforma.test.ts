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
//   · ⚠️ SIN CAMINO VIEJO (desde la tarde del 16/10/2026, docs/inventario-nada-por-detras.md): sin ninguna fila de la
//     plataforma, el aviso NO sale (el feed lo anota apagado). Hasta ese día salía «como antes» (`sinFila`), con el texto
//     del código: otro camino por detrás;
//   · lo que se avisó se dice (`wa`), porque el vigilante marca «avisado» con eso y sin la marca el «volvió» no sale;
//   · el texto ES el de la fila (16/10/2026): literal por caso —«se cortó» y «se desconectó» son dos eventos—, sin
//     variables que sean frases del código;
//   · sólo se ofrecen en la plataforma, y no aceptan una CONDITION (no hay lead).
//
// ⚠️ PROBADO ROMPIENDO (15/10/2026, scratchpad romper-plataforma.mjs, una rotura por vez y restaurada con sha1 igual).
// Base 7 pass / 0 fail; los números medidos de cada rotura, al lado de su test. El 16/10/2026 (tarde), las del texto literal
// y el camino viejo con scratchpad romper-lote1b.mjs, junto con los otros tres tests del lote: cinco roturas, todas atajadas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emitirPorEvento, pasosDelEvento, MOTIVO_EVENTO, type DepsEvento, type FilaEvento } from '../lib/aviso-evento';
import { eventosOfrecidos, TRIGGER_AVISO_MAKO } from '../lib/disparadores';
import { datosCaida, datosVolvio, avisoDeCaida } from '../lib/linea-vigilancia';
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
const OPTS = { datos: datosCaida(HECHOS), dedupKey: 'mako_ws13', dedupTtlMin: 60 };

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

// rotura 3 (vuelve el camino viejo en lib/avisos.ts): 6 pass / 1 fail, cae éste.
test('sin camino viejo: sin fila en la plataforma no sale nada (el feed lo anota apagado); con una pausada, tampoco', async () => {
  for (const filas of [[], [fila(301, { activa: false })]]) {
    const { d, anotado } = deps(filas);
    const r = await emitirPorEvento(CAT, NEGOCIO, OPTS, d);
    assert.equal(r.wa, false);
    assert.equal(r.filas, 0);
    assert.equal(anotado.corridas.length, 0, 'ninguna corrida');
    assert.equal(anotado.emitidos.length, 1, 'el feed lo anota');
    assert.equal(anotado.emitidos[0].estado?.wa, false, 'apagado: no sale por WhatsApp');
  }
  const avisos = leer('lib/avisos.ts');
  assert.match(avisos, /if \(AVISOS_POR_EVENTO\.has\(id\)\) \{\n(\s*\/\/[^\n]*\n)*\s*return emitirPorEvento\(cat, ws, opts, await depsDelEvento\(\)\);\n\s*\}/);
  assert.doesNotMatch(avisos + leer('lib/aviso-evento.ts') + leer('app/api/cron/reporte-semanal/route.ts'), /sinFila/, 'quedó el camino viejo');
});

// rotura 4 (el título vuelve a una variable): 6 pass / 1 fail, cae éste.
// ⚠️ DESDE EL 16/10/2026 (tarde): EL TEXTO ES LITERAL EN LA FILA, uno por caso. Hasta ese día la #253 citaba
// `{{linea_titulo}}` y `{{linea_motivo}}`, frases enteras del código, y el test comparaba con `textoCaida` (borrado).
test('el texto ES el de la fila: «se desconectó» y «se cortó» son dos eventos, cada uno con su texto', () => {
  const tarjeta = (id: string) => {
    const p = pasosDePlantilla(plantillaPorId(id)!)[0] as unknown as PasoGrafo;
    const parte = partesDeMako((p.accion as { params?: Record<string, unknown> }).params)[0];
    return parte && 'cuerpo' in parte ? String(parte.cuerpo) : '';
  };
  assert.equal(avisoDeCaida(HECHOS), 'wa-desvinculado');
  assert.equal(avisoDeCaida({ motivo: null }), 'wa-desconectado');
  assert.equal(avisoDeCaida({ motivo: { desvinculado: false, cuando: null } }), 'wa-desconectado');
  assert.equal(textoConDatos(tarjeta('mako-whatsapp-desvinculado'), datosCaida(HECHOS)),
    '🔴 *Se desconectó tu WhatsApp*\n📱 +5215512345678\n🕐 Desde el 3 de octubre\nWhatsApp cerró la sesión del dispositivo vinculado: tu teléfono está bien, pero por ese número no entran ni salen mensajes. Vuelve a escanear el QR:\nhttps://hola-mako.com/whatsapp\n\n— MaKo');
  assert.equal(textoConDatos(tarjeta('mako-whatsapp-caido'), datosCaida({ ...HECHOS, motivo: null, desde: '2026-10-03T15:00:00Z' })),
    '🔴 *Se cortó tu WhatsApp*\n📱 +5215512345678\n🕐 Desde el 3 de octubre\nPor ese número no entran ni salen mensajes. Puede volver solo; si sigue así, reconéctalo:\nhttps://hola-mako.com/whatsapp\n\n— MaKo');
  // La firma «— MaKo» cuenta (16/10/2026): una tarjeta TAL CUAL no le suma envoltorio, así que va en la plantilla.
  // rotura 8 (la plantilla de la caída sin firma): 6 pass / 1 fail, cae éste.
  assert.equal(textoConDatos(tarjeta('mako-whatsapp-volvio'), datosVolvio({ linea: '+5215512345678' })), '🟢 *Volvió tu WhatsApp*\n📱 +5215512345678\nPor ese número ya entran y salen mensajes otra vez. — MaKo');
  // Sin número ni fecha, sus renglones se van enteros, y la frase sigue.
  const sinNada = textoConDatos(tarjeta('mako-whatsapp-caido'), datosCaida({ ...HECHOS, motivo: null, desde: null, linea: null }));
  assert.doesNotMatch(sinNada, /📱|🕐/);
  assert.match(sinNada, /^🔴 \*Se cortó tu WhatsApp\*\nPor ese número no entran ni salen mensajes\./);
  // Ninguna plantilla de la plataforma cita una frase del código.
  for (const id of ['mako-whatsapp-caido', 'mako-whatsapp-desvinculado', 'mako-whatsapp-volvio']) assert.doesNotMatch(tarjeta(id), /linea_titulo|linea_motivo/, id);
});

// rotura 5 (se ofrecen en un negocio): 5 pass / 2 fail, caen éste y el de Fathom.
test('sólo en la plataforma: el evento en el CRON y la plantilla en la galería', () => {
  const sub = (o: { plataforma?: boolean }) => eventosOfrecidos('mako', null, o).map((e) => e.subtipo);
  for (const ev of ['whatsapp_caido', 'whatsapp_desvinculado', 'whatsapp_volvio']) {
    assert.ok(!sub({}).includes(ev), `un negocio no ve ${ev}`);
    assert.ok(sub({ plataforma: true }).includes(ev), ev);
  }
  const ids = (o: { plataforma: boolean }) => plantillasPara(o).map((p) => p.id);
  for (const id of ['mako-whatsapp-caido', 'mako-whatsapp-desvinculado', 'mako-whatsapp-volvio']) {
    assert.ok(!ids({ plataforma: false }).includes(id), id);
    assert.ok(ids({ plataforma: true }).includes(id), id);
  }
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
  // Con la firma de siempre (lib/lead-resumen.ts, `textoAvisoPostLlamada`). rotura 9 (sin firma): 6 pass / 1 fail.
  assert.equal(con, '✅ Terminó la *R1 con Laura Gil*.\n⏱️ 42 min\n\n👉 Mira el resumen de la llamada:\nhttps://hola-mako.com/crm/482/resumen\n\n— MaKo');
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
  // Y el horario de oficina que espera la tarjeta es el del NEGOCIO (16/10/2026), no el de la plataforma, donde corre la fila.
  // rotura 10 (`aperturaDelNegocio(ws)`): 6 pass / 1 fail, cae éste.
  assert.match(flujos, /apertura = await aperturaDelNegocio\(ctx\.negocioWs \?\? ws\);/);
});
