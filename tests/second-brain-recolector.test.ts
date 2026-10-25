// =============================================================================
// El recolector del Second Brain (25/10/2026): lo que el negocio vivió en WhatsApp, a su conocimiento
// =============================================================================
// Martín (24/10): «Quiero que implementes en el Second Brain un "recolector de información" de TODOS lados... De los
// mensajes de WhatsApp... Esto para todos los ws». El diseño, docs/diseno-second-brain-recolector.md. Lo que se fija acá,
// regla por regla del diseño:
//   · resume y extrae, no copia; y si no hay nada, no inventa (§5);
//   · cada dato con su procedencia, en el texto que lee el chat (§4);
//   · sólo conversaciones con PERSONAS que son leads (ni grupos, ni el WhatsApp personal del dueño);
//   · sin su IA, un cliente no corre; nunca escribe hacia afuera; la marca avanza sólo con lo aprendido guardado (§5, §6);
//   · lo recolectado no sale de su negocio (no se presta en el RAG) y su libro es una tabla por negocio;
//   · el cron es del servidor y está agendado; la pantalla dice de qué aprende, cuándo y cuánto (§6, §7).
//
// Probado rompiéndolo (25/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAVE_RECOLECTOR, FUENTE_WHATSAPP, MAX_CONVERSACIONES_POR_VUELTA, conversacionesPendientes, cuerpoDeLaEntrada, esChatDePersona,
  hechosDeLaEntrada, leerEstadoRecolector, leerRespuesta, textoDeLaVuelta, transcripcion, type MensajeWa,
} from '../lib/recolector-reglas';
import { sePresta } from '../lib/rag-prestamo';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const TZ = 'America/Argentina/Buenos_Aires';

const m = (chat: string, ts: string, x: Partial<MensajeWa> = {}): MensajeWa =>
  ({ chat_jid: chat, wa_timestamp: ts, from_me: false, tipo: 'text', texto: 'hola', lead_id: 1, ...x });

test('qué conversaciones tocan: personas con un lead, con algo nuevo del cliente, lo más reciente primero', () => {
  assert.equal(esChatDePersona('5491112345678@s.whatsapp.net'), true);
  assert.equal(esChatDePersona('120363000000000000@g.us'), false, 'un grupo no');
  assert.equal(esChatDePersona('status@broadcast'), false);
  const A = 'a@s.whatsapp.net', B = 'b@s.whatsapp.net', G = 'g@g.us', P = 'p@s.whatsapp.net', N = 'n@s.whatsapp.net', V = 'v@s.whatsapp.net';
  const mensajes: MensajeWa[] = [
    ...['10', '11', '12'].map((h) => m(A, `2026-10-24T${h}:00:00Z`)),
    ...['10', '11', '12', '13'].map((h) => m(B, `2026-10-24T${h}:30:00Z`, { from_me: h !== '13' })),
    ...['10', '11', '12'].map((h) => m(G, `2026-10-24T${h}:00:00Z`)),
    ...['10', '11', '12'].map((h) => m(P, `2026-10-24T${h}:00:00Z`, { lead_id: null })),
    ...['10', '11'].map((h) => m(N, `2026-10-24T${h}:00:00Z`)),
    ...['10', '11', '12'].map((h) => m(V, `2026-10-24T${h}:00:00Z`, { from_me: true })),
    m(A, '2026-10-24T12:30:00Z', { tipo: 'evento', texto: 'cambió el número' }),
  ];
  const p = conversacionesPendientes(mensajes, new Map());
  assert.deepEqual(p.map((x) => x.jid), [B, A], 'sin el grupo, sin el chat sin lead, sin la de 2 mensajes y sin la que sólo escribió el negocio');
  assert.equal(p.find((x) => x.jid === A)!.nuevos, 3, 'un evento no cuenta');
  // Lo ya leído no vuelve: con la marca de A en las 11, le queda 1 mensaje nuevo y no alcanza.
  assert.deepEqual(conversacionesPendientes(mensajes, new Map([[A, '2026-10-24T11:00:00Z']])).map((x) => x.jid), [B]);
  const muchas = Array.from({ length: 10 }, (_, i) => ['10', '11', '12'].map((h) => m(`c${i}@s.whatsapp.net`, `2026-10-2${i % 9}T${h}:00:00Z`))).flat();
  assert.equal(conversacionesPendientes(muchas, new Map()).length, MAX_CONVERSACIONES_POR_VUELTA, 'con tope por vuelta');
});

test('lo que lee la IA: en orden, quién habla, y si es largo, lo último', () => {
  const t = transcripcion([m('a', '2026-10-24T15:05:00Z', { texto: 'Dale, te paso el link', from_me: true }), m('a', '2026-10-24T15:00:00Z', { texto: '¿Cuánto sale el plan?' })], TZ);
  assert.equal(t, '[24/10 12:00] Cliente: ¿Cuánto sale el plan?\n[24/10 12:05] Negocio: Dale, te paso el link');
  const larga = transcripcion(Array.from({ length: 50 }, (_, i) => m('a', new Date(Date.UTC(2026, 9, 24, 10, i)).toISOString(), { texto: `mensaje número ${i} ${'x'.repeat(40)}` })), TZ, 600);
  assert.match(larga, /^\(…mensajes anteriores sin incluir\)/);
  assert.match(larga, /mensaje número 49/, 'se queda lo último');
  assert.doesNotMatch(larga, /mensaje número 0 /);
});

test('lo que contesta la IA: hechos en viñetas, sin repetir; «NADA» o una respuesta sin viñetas no guardan nada', () => {
  assert.deepEqual(leerRespuesta('NADA'), { nada: true });
  assert.deepEqual(leerRespuesta('  nada.  '), { nada: true });
  assert.deepEqual(leerRespuesta('Hola, no hay mucho para decir.'), { nada: true }, 'sin viñetas no se inventa una entrada');
  const r = leerRespuesta('- Quiere el plan de 97\n* Pidió que lo llamen el lunes\n- quiere el plan de 97\n1. Tiene una inmobiliaria');
  assert.deepEqual(r, { nada: false, hechos: ['Quiere el plan de 97', 'Pidió que lo llamen el lunes', 'Tiene una inmobiliaria'] });
});

test('cada entrada dice de dónde salió (el chat sólo lee título y cuerpo), y se vuelve a leer sin perder hechos', () => {
  const c = cuerpoDeLaEntrada({ etiqueta: 'Ana Gómez', hechos: ['Quiere el plan de 97', 'Tiene una inmobiliaria'], desde: '2026-10-20T15:00:00Z', hasta: '2026-10-24T15:00:00Z', ahora: '2026-10-25T03:30:00Z', tz: TZ });
  assert.match(c, /^Lo que se sabe de Ana Gómez, por su conversación de WhatsApp con el negocio:\n- Quiere el plan de 97\n- Tiene una inmobiliaria\n/);
  assert.match(c, /Fuente: la conversación de WhatsApp con Ana Gómez, mensajes del 20\/10\/2026 al 24\/10\/2026\. Lo recolectó MaKo el 25\/10\/2026\./);
  assert.deepEqual(hechosDeLaEntrada(c), ['Quiere el plan de 97', 'Tiene una inmobiliaria'], 'la vuelta siguiente parte de lo que ya sabía');
  const act = cuerpoDeLaEntrada({ etiqueta: 'Ana', hechos: ['x'], desde: null, hasta: '2026-10-24T15:00:00Z', ahora: '2026-10-25T03:30:00Z', tz: TZ });
  assert.match(act, /mensajes hasta el 24\/10\/2026/, 'una entrada actualizada junta vueltas: dice hasta cuándo');
});

test('el estado del negocio: prendido salvo que lo apague, y lo que se le dice de cada vuelta', () => {
  assert.deepEqual(leerEstadoRecolector(null), { prendido: true, ultima: null });
  assert.deepEqual(leerEstadoRecolector('{roto'), { prendido: true, ultima: null });
  assert.equal(leerEstadoRecolector('{"prendido":false}').prendido, false);
  const e = leerEstadoRecolector(JSON.stringify({ ultima: { at: '2026-10-25T03:00:00Z', resultado: 'sin-ia', nuevas: 0, actualizadas: 0, leidas: 0 } }));
  assert.match(textoDeLaVuelta(e), /conecta tu propia IA/);
  assert.match(textoDeLaVuelta({ prendido: true, ultima: { at: 'x', resultado: 'ok', nuevas: 2, actualizadas: 1, leidas: 40 } }), /aprendió de 3 conversaciones/);
  assert.match(textoDeLaVuelta({ prendido: false, ultima: null }), /Apagado/);
  assert.equal(CLAVE_RECOLECTOR, 'second-brain.recolector');
});

test('lo recolectado no sale de su negocio: no se presta en el RAG y su libro es una tabla por negocio', () => {
  assert.equal(sePresta(FUENTE_WHATSAPP), false, 'el RAG de otro negocio nunca lo ve');
  const mig = readFileSync(join(RAIZ, 'supabase/migrations/0332_second_brain_recolectado.sql'), 'utf8');
  assert.match(mig, /workspace_id\s+bigint not null references workspaces\(id\) on delete cascade/);
  assert.match(mig, /unique \(workspace_id, fuente, ref\)/, 'una fila por conversación: la llave contra el duplicado');
  assert.match(mig, /revoke all on second_brain_recolectado from anon, authenticated/);
  assert.match(fuente('lib/workspace.ts'), /'second_brain_recolectado'/, 'en TENANT_TABLES: getTenantDb la filtra por negocio');
  assert.match(fuente('lib/tablas-de-inquilino.ts'), /'second_brain_recolectado'/, 'se va con el negocio');
});

test('la vuelta: sin su IA no corre, sólo lee WhatsApp, guarda con procedencia y la marca avanza AL FINAL', () => {
  const r = fuente('lib/recolector.ts');
  const f = r.slice(r.indexOf('export async function recolectarWhatsApp'), r.indexOf('export async function resumenDelRecolector'));
  assert.match(f, /if \(!estado\.prendido\) return \{ \.\.\.v, resultado: 'apagado' \};/);
  assert.match(f, /if \(!esPlataforma && \(await claveDeIAPropia\(ws\)\) !== true\)/, 'un cliente sin su IA no corre con la nuestra');
  assert.match(f, /feature: FEATURE_RECOLECTOR, maxTokens: 900, temperature: 0\.2, pii: true/);
  assert.match(f, /createKnowledge\(\{ titulo, categoria: 'WhatsApp', cuerpo, area: 'general', fuente: FUENTE_WHATSAPP, autor: 'MaKo' \}\)/);
  // La marca (el upsert del libro) va DESPUÉS de guardar lo aprendido, y un error de cada lectura corta la vuelta.
  assert.ok(f.indexOf('createKnowledge(') < f.indexOf('db.from(TABLA).upsert('), 'la marca, después de lo aprendido');
  assert.match(f, /if \(recientes\.error\) throw/);
  assert.match(f, /if \(leidos\.error\) throw/);
  assert.match(f, /if \(error\) throw new Error\(`no pude anotar hasta dónde leyó/);
  assert.match(f, /v\.resultado = errores\.length \? 'error' : 'sin-ia';\s*[\s\S]{0,140}break;/, 'si la IA no contesta, para y no avanza');
  // Nunca hacia afuera: de WhatsApp sólo lee.
  assert.doesNotMatch(r, /from\('wa_mensajes'\)\.(insert|update|upsert|delete)/);
  assert.doesNotMatch(r, /enviar|sendMessage|sendText|evolution\.ts/i, 'no manda nada');
  assert.match(fuente('lib/model-catalogo.ts'), /feature: 'second-brain-recolector'[^\n]*pii: true/);
});

test('el cron es del servidor, recorre cada negocio con su IA, y está agendado', () => {
  const c = fuente('app/api/cron/second-brain-recolector/route.ts');
  assert.match(c, /const auth = checkCronAuth\(req\);\s*if \(auth\) return auth;/);
  assert.match(c, /runWithWorkspace\(w\.id, \(\) => conSuIADelNegocio\(w\.id, \(\) => recolectarWhatsApp\(w\.id, \{ deadline, seco: modo === 'seco' \}\)\)\)/);
  assert.match(c, /w\.estado === 'activo'/);
  const crons = (JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }> }).crons;
  assert.ok(crons.some((x) => x.path === '/api/cron/second-brain-recolector' && x.schedule === '35 * * * *'), 'cada hora');
});

test('la pantalla: de qué aprende, cuándo y cuánto; y el super admin ve cuánto, no qué', () => {
  const p = fuente('app/second-brain/pagina.tsx');
  assert.match(p, /aprendeSolo=\{<AprendeSolo resumen=\{recolector\} soloCuentas=\{mirando\} \/>\}/);
  assert.match(p, /estaImpersonando\(\)\.catch\(\(\) => true\)/, 'si no se sabe, como super admin: sólo cuentas');
  const a = fuente('app/second-brain/AprendeSolo.tsx');
  assert.match(a, /\{soloCuentas\s*\?\s*<p className="as-nota">Como super admin ves cuánto aprendió este negocio, no qué dice\.<\/p>/);
  assert.match(a, /textoDeLaVuelta\(estado!\)/);
  assert.match(a, /cambiarRecolectorAction\(!prendido\)/);
  assert.match(fuente('app/second-brain/recolector-actions.ts'), /if \(\(await adminDeWorkspaceActual\(\)\) == null\) return \{ ok: false/, 'sólo el admin cambia el interruptor');
});

// Roturas (25/10/2026; base 14 / 0 con second-brain-recolector-simulado), cada una restaurada (pasan / fallan):
//   · sin el filtro del lead (lee el chat personal del dueño)                                  -> 10 / 4
//   · un cliente sin su IA corre igual                                                         -> 12 / 2
//   · cada vuelta crea otra entrada en vez de actualizar                                       -> 12 / 2
//   · con la IA caída, la marca avanza igual y sigue                                           -> 12 / 2
//   · una respuesta sin viñetas se guarda como hecho                                           -> 13 / 1
//   · la entrada sin «Fuente:»                                                                 -> 11 / 3
//   · lo de WhatsApp se presta en el RAG de otros negocios                                     -> 13 / 1
//   · el cron sin «sólo su IA»                                                                 -> 13 / 1
//   · el super admin ve la lista y los hechos                                                  -> 13 / 1
//   · cada vuelta relee la conversación entera (sin la marca)                                  -> 13 / 1
