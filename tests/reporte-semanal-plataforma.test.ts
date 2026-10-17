// =============================================================================
// EL REPORTE SEMANAL COMO AUTOMATIZACIÓN DE LA PLATAFORMA, Y «MaKo por email» (16/10/2026)
// =============================================================================
// El cuarto Mensaje de MaKo mudado a SuperAdmin (el 2 de las doce de Martín: «un Mensaje de MaKo ES una
// automatización»). El reporte de los lunes no sale por WhatsApp (`REPORTE_POR_WHATSAPP = false`): sale por EMAIL al
// equipo de cada negocio. Por eso la tarjeta MaKo suma «Por dónde»: el grupo, o un correo al equipo. El diseño, en
// docs/diseno-avisos-plataforma.md §6.
//
// Lo que fija este archivo:
//   · la tarjeta guarda por dónde y el asunto, y editar el texto no los borra; por email va UN texto con su asunto, y
//     Publicar lo frena (los flujos de leads y los eventos);
//   · el aviso de una tarjeta por email: sólo correo, con su asunto, sin push al teléfono; «le escribí» sólo si salió;
//   · la plantilla «Reporte Semanal de un Negocio»: el asunto y el cuerpo de siempre, letra por letra;
//   · lo emite el cron de cada negocio; lo corre la fila de la plataforma; ⚠️ desde la tarde del 16/10/2026 SIN CAMINO
//     VIEJO: sin fila prendida no sale (hasta ese día salía como siempre, `despacharReporte`), y sin poder leer las filas,
//     tampoco;
//   · el runner de los eventos y el envío respetan el email, y el editor ofrece «Por dónde».
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-reporte.mjs, una rotura por vez y restaurada con sha1 igual).
// Base 6 pass / 0 fail; los números medidos de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emitirPorEvento, pasosDelEvento, MOTIVO_EVENTO, type DepsEvento, type FilaEvento } from '../lib/aviso-evento';
import { eventosOfrecidos, TRIGGER_AVISO_MAKO } from '../lib/disparadores';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import {
  paramsConPartes, paramsDeMako, partesDeMako, problemaDeEmailMako, asuntoDeMako, armarAvisoDeTarjeta, resultadoDelAviso,
} from '../lib/mako-tarjeta';
import { faltaEscribir, tituloDeTarjeta } from '../lib/flujo-conversacion';
import { datosDelReporte } from '../lib/reporte-destino';
import type { CtxFlujo } from '../lib/flujos';
import type { EmitirAvisoInput } from '../lib/avisos';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PLATAFORMA = 9;
const NEGOCIO = 13;
const CAT = { id: 'reporte-semanal', titulo: 'Reporte semanal (lunes)', categoria: 'reporte' as const, semaforo: 'na' as const };
const pasosReporte = () => pasosDePlantilla(plantillaPorId('mako-reporte-semanal')!) as unknown as PasoGrafo[];
const paramsDe = (p: PasoGrafo) => (p.accion as { params?: Record<string, unknown> }).params;
// Lo que arma `buildReporteSemanal` (lib/reportes.ts): el título del asunto y el cuerpo con sus marcas.
const REP = {
  titulo: 'Reporte semanal · 05/10/2026–11/10/2026',
  texto: '🗓️ *Reporte semanal* — 05/10/2026 a 11/10/2026\n\n💰 *Meta*: $1,240 invertidos · 38 leads\n🏆 2 ventas',
};

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

// rotura 1 (`paramsConPartes` no guarda por dónde): 2 pass / 4 fail, caen éste y los tres que arman una tarjeta por email.
// rotura 12 (`paramsDeMako` ignora «Por dónde» y el asunto): 5 pass / 1 fail, cae éste.
test('«MaKo por email»: la tarjeta guarda por dónde y el asunto, y editar el texto no los borra', () => {
  const base = paramsConPartes({ leadId: 0 }, [{ tipo: 'texto', cuerpo: 'Hola' }]);
  assert.equal('canal' in base, false, 'sin elegir, el grupo: una tarjeta de antes queda como estaba');
  const email = paramsDeMako(base, { canal: 'email', asunto: 'El reporte' });
  assert.equal(email.canal, 'email');
  assert.equal(email.asunto, 'El reporte');
  const editado = paramsDeMako(email, { cuerpo: 'Hola de nuevo' });
  assert.equal(editado.canal, 'email', 'tipear el texto no la devuelve al grupo');
  assert.equal(editado.asunto, 'El reporte');
  const grupo = paramsDeMako(editado, { canal: 'grupo' });
  assert.equal('canal' in grupo, false);
  assert.equal('asunto' in grupo, false, 'de vuelta al grupo, sin un asunto que nadie ve');
});

// rotura 2 (`problemaDeEmailMako` sin el asunto): 5 pass / 1 fail, cae éste.
// rotura 3 (`faltaEscribir` sin «MaKo por email»): 5 pass / 1 fail, cae éste.
test('por email va un texto con su asunto, y Publicar lo frena en los flujos de leads y en los eventos', () => {
  const sinAsunto = paramsConPartes({ canal: 'email', asunto: '  ' }, [{ tipo: 'texto', cuerpo: 'x' }]);
  assert.equal(problemaDeEmailMako(sinAsunto), 'Por email falta el asunto.');
  const dos = paramsConPartes({ canal: 'email', asunto: 'A' }, [{ tipo: 'texto', cuerpo: 'x' }, { tipo: 'texto', cuerpo: 'y' }]);
  assert.match(problemaDeEmailMako(dos) ?? '', /un solo texto/);
  assert.equal(problemaDeEmailMako(paramsConPartes({ canal: 'email', asunto: 'A' }, [{ tipo: 'texto', cuerpo: 'x' }])), null);
  assert.equal(problemaDeEmailMako(paramsConPartes({}, [{ tipo: 'texto', cuerpo: 'x' }, { tipo: 'texto', cuerpo: 'y' }])), null, 'al grupo, varios mensajes');
  // Publicar, en un flujo de leads (`faltaEscribir`) y en uno de evento (`pasosDelEvento`).
  const [p] = pasosReporte();
  const malo = { ...p, accion: { ...(p.accion as object), params: sinAsunto } } as unknown as PasoGrafo;
  assert.match(faltaEscribir([malo])?.error ?? '', /falta el asunto/);
  assert.equal(pasosDelEvento([malo], 'reporte_semanal').problema, MOTIVO_EVENTO.makoEmail);
});

// rotura 4 (`armarAvisoDeTarjeta` sin la rama del email): 5 pass / 1 fail, cae éste.
// rotura 5 (`avisoPorEmail` sin el `push: false`): 5 pass / 1 fail, cae éste.
test('el aviso de una tarjeta por email: sólo correo, con su asunto y sin push; «le escribí» sólo si salió', () => {
  const textos = { titulo: 'Una automatización te avisa', mensaje: 'Hola', asunto: REP.titulo };
  const o = { desdeUnFlujo: true, respuesta: '', lead: null, linkLead: null, textos, partes: [{ tipo: 'texto' as const, texto: 'Hola' }] };
  const a = armarAvisoDeTarjeta(paramsConPartes({ canal: 'email', asunto: '{{reporte_titulo}}' }, [{ tipo: 'texto', cuerpo: 'Hola' }]), o);
  assert.deepEqual(a.estado, { activo: true, wa: false, email: true, frecuenciaMin: 0 }, 'sólo el correo, y el interruptor es la automatización');
  assert.equal(a.asuntoEmail, REP.titulo);
  assert.equal(a.titulo, REP.titulo, 'la banda del correo dice lo mismo que la bandeja');
  assert.equal(a.push, false, 'la tarjeta dice email: no suena el teléfono');
  assert.equal(a.partes, undefined);
  assert.equal(a.rotulo, false);
  assert.equal(a.texto, 'Hola');
  // Al grupo, como siempre.
  const g = armarAvisoDeTarjeta(paramsConPartes({}, [{ tipo: 'texto', cuerpo: 'Hola' }]), o);
  assert.equal(g.estado?.wa, true);
  assert.equal(g.push, undefined);
  assert.equal(resultadoDelAviso({ ok: true, wa: false, deduped: false, email: false }, null, true).ok, false, 'sin correo que salga, es un fallo');
  assert.equal(resultadoDelAviso({ ok: true, wa: false, deduped: false, email: true }, null, true).ok, true);
});

// rotura 6 (la plantilla firma el cuerpo: el correo ya la lleva al pie): 5 pass / 1 fail, cae éste.
// rotura 7 (`pasosDelEvento` no lleva el email al paso): 5 pass / 1 fail, cae éste.
test('la plantilla «Reporte Semanal de un Negocio»: por email, con el asunto y el cuerpo de siempre', () => {
  const pl = plantillaPorId('mako-reporte-semanal')!;
  assert.equal(pl.soloPlataforma, true);
  assert.deepEqual(pl.cron, { fijo: TRIGGER_AVISO_MAKO, evento: 'reporte_semanal' });
  assert.ok(!eventosOfrecidos('mako', null, {}).some((e) => e.subtipo === 'reporte_semanal'), 'un negocio no lo ve');
  const pasos = pasosReporte();
  const params = paramsDe(pasos[0]);
  const datos = datosDelReporte(REP);
  // Lo que manda hoy `despacharReporte` (lib/notify.ts): asunto `rep.titulo`, cuerpo `rep.texto`.
  assert.equal(textoConDatos(asuntoDeMako(params), datos), REP.titulo);
  const cuerpo = partesDeMako(params)[0];
  assert.equal(cuerpo.tipo === 'texto' ? textoConDatos(cuerpo.cuerpo, datos) : '', REP.texto, 'el cuerpo de siempre, letra por letra');
  assert.equal(tituloDeTarjeta(pasos[0]), 'MAKO POR EMAIL', 'la tarjeta se nombra como sale');
  const tr = pasosDelEvento(pasos, 'reporte_semanal');
  assert.equal(tr.problema, null);
  assert.deepEqual((tr.pasos[0] as { email?: unknown }).email, { asunto: '{{reporte_titulo}}' });
});

// rotura 8 (el cron manda por `despacharReporte` aunque haya fila): 5 pass / 1 fail, cae éste.
// rotura 9 (sin poder leer las filas, igual sale por el de siempre): 5 pass / 1 fail, cae éste.
test('lo emite el cron de cada negocio y lo corre la fila de la plataforma; sin fila, sale como siempre', async () => {
  const filaRep: FilaEvento = {
    id: 304, nombre: 'Reporte Semanal de un Negocio', activa: true, pasos: pasosReporte(), trigger_tipo: TRIGGER_AVISO_MAKO,
    disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'reporte_semanal' }],
  };
  const datos = datosDelReporte(REP);
  const con = deps([filaRep]);
  const r = await emitirPorEvento(CAT, NEGOCIO, { datos }, con.d);
  assert.deepEqual(con.anotado.leidos, [PLATAFORMA]);
  assert.equal(con.anotado.corridas[0].ws, PLATAFORMA);
  assert.equal(con.anotado.corridas[0].ctx.negocioWs, NEGOCIO, 'le escribe al equipo de ESE negocio');
  assert.deepEqual(con.anotado.corridas[0].ctx.datos, datos);
  assert.equal(r.filas, 1);
  const sin = deps([]);
  const rSin = await emitirPorEvento(CAT, NEGOCIO, { datos }, sin.d);
  assert.equal(rSin.filas, 0);
  assert.equal(sin.anotado.corridas.length, 0, 'sin fila no corre nada');
  // El cron: decide y arma como siempre, emite el evento, y sin fila NO sigue con `despacharReporte` (16/10/2026, tarde).
  const cron = leer('app/api/cron/reporte-semanal/route.ts');
  assert.match(cron, /const ev = await emitirEventoDePlataforma\('reporte-semanal', \{ ws, datos: datosDelReporte\(rep\) \}\);/);
  assert.match(cron, /if \(!ev\.ok\) return \{ ws, modo: 'error'/);
  assert.match(cron, /return ev\.filas > 0\n\s+\? \{ ws, modo: 'enviado', porAutomatizacion: \{ filas: ev\.filas \} \}\n\s+: \{ ws, modo: 'salteado', motivo: 'sin_automatizacion_en_superadmin' \};/);
  assert.doesNotMatch(cron, /despacharReporte\(/, 'el camino viejo volvió');
  // `emitirEventoDePlataforma` no sigue al motor de avisos.
  const av = leer('lib/avisos.ts');
  const fn = av.slice(av.indexOf('export async function emitirEventoDePlataforma('), av.indexOf('\n}\n', av.indexOf('export async function emitirEventoDePlataforma(')));
  assert.match(fn, /return emitirPorEvento\(cat, opts\.ws, opts, await depsDelEvento\(\)\);/);
  assert.doesNotMatch(fn, /emitirAviso\(/);
});

// rotura 10 (el runner de los eventos no le pasa el email a la tarjeta): 5 pass / 1 fail, cae éste.
// rotura 11 (`emitirAviso` ignora el `push: false`): 5 pass / 1 fail, cae éste.
test('el runner de los eventos y el envío respetan el email, y el editor ofrece «Por dónde»', () => {
  const flujos = leer('lib/flujos.ts');
  assert.match(flujos, /emitirTarjetaDelEvento\(flujoId, \{ texto: propio, partes: paso\.partes, email: paso\.email, sinGrupo: paso\.sinGrupo \}/);
  assert.match(flujos, /const porEmail = tarjeta\.email \? avisoPorEmail\(\(await resolver\(tarjeta\.email\.asunto\)\) \|\| aviso\.titulo\) : null;/);
  assert.match(flujos, /titulo: porEmail\?\.titulo \?\? aviso\.titulo, texto,/);
  assert.match(flujos, /estado: porEmail\?\.estado \?\? ESTADO_EVENTO,/);
  assert.match(flujos, /\.\.\.\(porEmail \? \{ asuntoEmail: porEmail\.asuntoEmail, push: porEmail\.push, rotulo: false as const \} : partes \? \{ partes, rotulo: false as const \} : \{\}\),/);
  const avisos = leer('lib/avisos.ts');
  assert.match(avisos, /const pushP = a\.push === false \? Promise\.resolve\(undefined\) : enviarPushAviso\(wsLector, a\);/);
  // El correo, a los destinatarios del negocio y desde MaKo: el camino de siempre de un aviso con email.
  assert.match(avisos, /const dest = await getDestinatariosDe\(wsCorreo\);/);
  assert.match(avisos, /from: REMITENTE_MAKO, replyTo: EMAIL_MAKO, subject: asunto/);
  // El registro (el runner de los leads): valida como Publicar, y «le escribí» lo dice el aviso armado.
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /const malEmail = problemaDeEmailMako\(input\);\n\s*if \(malEmail\) return \{ error: malEmail \};/);
  assert.match(run, /return resultadoDelAviso\(r, lead, aviso\.asuntoEmail !== undefined\);/);
  // El editor: «Por dónde», el asunto y, por email, un solo texto (sin la Voz de MaKo ni archivos).
  const lienzo = leer('app/automations/FlujoLienzo.tsx');
  assert.match(lienzo, /data-canal-mako/);
  assert.match(lienzo, /data-asunto-mako/);
  assert.match(lienzo, /vozMako=\{!porEmail\}/);
  assert.match(lienzo, /permiteAdjuntos=\{!porEmail\}/);
});
