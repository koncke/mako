// =============================================================================
// TikTok fase 0 (14/10/2026): el AI Step CONTESTA por Instagram y Messenger
// =============================================================================
// Plan: docs/diseno-tiktok-linkedin.md §4, fase 0; decisión de producto: docs/diseno-ai-step-v2.md §6 («Sola»
// manda el DM por Zernio, «Para aprobar» manda el texto en el aviso al grupo, «Sólo te avisa» igual que en
// WhatsApp, sin audio). Hasta ese día una respuesta por DM sólo se anotaba: todo lo que contesta corría por
// WhatsApp, al teléfono del lead.
//
// Lo puro (la charla de ese canal) se fija EJECUTÁNDOLO; lo que vive en el motor `server-only`, sobre el FUENTE
// recortado a su función (normalizado y sin comentarios: AGENTS.md).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filasDeCharlaSocial, TOPE_CHARLA_SOCIAL } from '../lib/canal-social';
import { historialDeMensajes, ultimoEntranteMs } from '../lib/setter-conversacion';
import { escuchaPor, escenariosDeRespuesta, ID_INICIO, type PasoGrafo } from '../lib/flujo-grafo';
import { iniciar, entrarEnRespuesta, pausarPorRespuesta as pausarSim } from '../lib/simulador-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, ini: string, fin: string): string => {
  const i = src.indexOf(ini);
  assert.ok(i >= 0, `no encontré «${ini}»`);
  const j = src.indexOf(fin, i + ini.length);
  assert.ok(j > i, `no encontré el cierre «${fin}» después de «${ini}»`);
  return src.slice(i, j);
};
const NUTRI = sinComentarios(leer('lib/nutricion.ts'));

// ── La charla de ese canal (pura) ───────────────────────────────────────────────

test('la charla junta lo que escribió y lo que le salió, de la más vieja a la más nueva', () => {
  const filas = filasDeCharlaSocial(
    [
      { texto: '¿Cuánto sale?', created_at: '2026-10-14T10:05:00Z' },
      { texto: 'Hola', created_at: '2026-10-14T10:00:00Z' },
    ],
    [{ texto_enviado: '¡Hola! ¿En qué te ayudo?', created_at: '2026-10-14T10:01:00Z' }],
  );
  assert.deepEqual(filas.map((f) => [f.from_me, f.texto]), [
    [false, 'Hola'], [true, '¡Hola! ¿En qué te ayudo?'], [false, '¿Cuánto sale?'],
  ]);
  // La forma es la del WhatsApp: el historial del setter la lee tal cual.
  assert.deepEqual(historialDeMensajes(filas).map((t) => t.de), ['lead', 'negocio', 'lead']);
  assert.equal(ultimoEntranteMs(filas), Date.parse('2026-10-14T10:05:00Z'), 'lo nuevo que se compara es lo que ESCRIBIÓ, no lo que le salió');
});

test('un mensaje sin texto entra con lo que mandó; lo saliente vacío no entra', () => {
  const filas = filasDeCharlaSocial(
    [{ texto: null, adjuntos: [{ type: 'image' }], created_at: '2026-10-14T10:00:00Z' }, { texto: '  ', created_at: '2026-10-14T10:02:00Z' }],
    [{ texto_enviado: '', created_at: '2026-10-14T10:01:00Z' }, { texto_enviado: null, created_at: '2026-10-14T10:01:30Z' }],
  );
  assert.equal(filas.length, 2);
  assert.deepEqual(historialDeMensajes(filas).map((t) => t.texto), ['(mandó una imagen)', '(mandó un mensaje sin texto)']);
});

test('la charla se queda con los ÚLTIMOS, no con los primeros', () => {
  const entr = Array.from({ length: 40 }, (_, k) => ({ texto: `m${k}`, created_at: new Date(Date.UTC(2026, 9, 14, 10, k)).toISOString() }));
  const filas = filasDeCharlaSocial(entr, []);
  assert.equal(filas.length, TOPE_CHARLA_SOCIAL);
  assert.equal(filas.at(-1)?.texto, 'm39');
});

// ── El motor ────────────────────────────────────────────────────────────────────

test('el contexto de una respuesta social lee la charla de ESE canal, sin línea ni borrador del WhatsApp', () => {
  const ctx = bloque(NUTRI, 'async function contextoDeRespuesta(', '\n}\n');
  const social = bloque(ctx, 'if (social) {', '\n  }\n');
  assert.match(social, /charlaSocialDelLead\(leadId, social\.canal\)/);
  assert.match(social, /linea: null/);
  assert.match(social, /descartarViejo: async \(\) => 0/);
  assert.ok(ctx.indexOf('if (social) {') < ctx.indexOf('mensajesRecientesDelLead('), 'la charla del WhatsApp se lee antes: el redactor contesta un DM con los mensajes de otro canal');
  const nuevo = bloque(NUTRI, 'async function hayMensajeMasNuevo(', '\n}\n');
  assert.match(nuevo, /c\.social\s*\? await charlaSocialDelLead\(c\.leadId, c\.social\.canal, 3\)/);
});

test('asistirRespuesta: por las redes contesta SÓLO el AI Step de ese medio (el modo asistido es del WhatsApp)', () => {
  const a = bloque(NUTRI, 'async function asistirRespuesta(', '\n}\n');
  assert.match(a, /escuchaPor\(s\.pasos, medio\) \|\| \(!social && parseEstrategia\(s\.estrategia\)\?\.modo === 'asistido'\)/);
  // (16/10/2026: y la nota de voz escuchada, la hora del mensaje y el plazo: tests/ai-step-red-y-voz.test.ts.)
  assert.match(a, /contextoDeRespuesta\(leadId, secuencia, texto, lineaEntrante, social \? \{ canal: social, cuenta: op\.cuenta\?\.trim\(\) \|\| null \} : null, \{ voz, recibidoAt: op\.recibidoAt \?\? null, hastaMs \}\)/);
  const charla = bloque(NUTRI, 'async function charlaDelLead(', '\n}\n');
  assert.match(charla, /\(medio === 'whatsapp' && parse\(sec\.estrategia\)\?\.modo === 'asistido'\) \|\| escuchaPor\(sec\.pasos, medio\)/);
});

test('«Para aprobar» por las redes NO deja un borrador del WhatsApp: el texto va entero en el aviso', () => {
  const r = bloque(NUTRI, 'async function redactarRespuesta(', '\n}\n');
  const iSocial = r.indexOf('if (social) {');
  const iBorrador = r.indexOf('guardarBorradorSetter(');
  assert.ok(iSocial > 0 && iSocial < iBorrador, 'sin la rama, una respuesta por Instagram deja un borrador que sale por WhatsApp');
  assert.match(r, /if \(sugerida && !social && lead\?\.telefono && clas\.escenario\.audio\)/, 'por las redes no hay audio');
  assert.match(r, /: social && sugerida\s*\? `\\n\\nTe dejé esta respuesta para mandarla tú\$\{por\}/);
  assert.match(r, /sugerida\.slice\(0, TOPE_TEXTO_SOCIAL\)/, 'el texto entero: la persona lo copia y lo manda');
  // «Sola» por las redes va por su propia puerta, y la del WhatsApp no corre.
  assert.match(r, /if \(social && sugerida && clas\.escenario\.contestaSolo === true && !alertaDescalifica\) \{\s*const r = await contestarSolaPorRedes\(/);
  assert.match(r, /if \(!social && !sinAudio && borradorOk/);
});

test('«Sola» por las redes: las MISMAS puertas, el envío por Zernio y su rastro como autor IA', () => {
  const s = bloque(NUTRI, 'async function contestarSolaPorRedes(', '\n}\n');
  assert.match(s, /if \(texto\.length > TOPE_TEXTO_SOCIAL\) return/);
  assert.match(s, /puedeContestarSolo\(\{/);
  assert.match(s, /\.eq\('canal', canal\)\.eq\('texto_autor', 'ia'\)\.eq\('estado', 'enviado'\)\.gte\('created_at', desde\)/, 'el tope de «Sola» se cuenta en las respuestas que SALIERON por ese canal');
  assert.match(s, /enviarPasoSocial\(\{/);
  assert.match(s, /idempotencia: `ai-step:\$\{secuencia\.id\}:\$\{leadId\}:\$\{c\.respondeA \?\? Date\.now\(\)\}`/, 'sin la clave del mensaje, una reentrega del webhook manda dos DMs');
  assert.match(s, /texto_autor: 'ia'/);
  assert.match(s, /if \(limites === 'ilegible' \|\| horario === 'ilegible'\) return \{ ok: false/, '«no pude leer tus límites» no sale solo');
});

test('un mensaje fijo de la rama sale por ESE canal, y uno de otro canal no sale', () => {
  const m = bloque(NUTRI, 'async function mandarMensajeDeRespuesta(', '\n}\n');
  const soc = bloque(m, 'if (c.social) {', '\n  }\n');
  assert.ok(m.indexOf('if (c.social) {') < m.indexOf("if (p.canal === 'email' || esCanalSocial(p.canal)"), 'la guarda del WhatsApp corre antes y frena todo mensaje de Instagram');
  assert.match(soc, /if \(p\.canal !== canal\) return no\(/);
  assert.match(soc, /if \(!\(await reclamar\(\)\)\) return yaSalio;/, 'sin el reclamo, un texto fijo sale con cada mensaje del lead');
  assert.match(soc, /enviarPasoSocial\(\{/);
  assert.match(soc, /cuenta: cuentaDelPaso\(p\) \?\? c\.social\.cuenta/);
  assert.doesNotMatch(soc, /crearBorrador\(|enviarYEspejar\(|enviarAudioYEspejar\(/, 'algo de la rama social sale por WhatsApp');
});

test('el webhook pasa lo que escribió y la cuenta que lo recibió', () => {
  const ent = sinComentarios(leer('lib/zernio-entrante.ts'));
  assert.match(ent, /export async function pausarRespuestaSocial\(leadId: number, canal: CanalSocial, extra: \{ texto\?: string \| null; cuenta\?: string \| null \} = \{\}\)/);
  const ruta = sinComentarios(leer('app/api/webhooks/zernio/route.ts'));
  assert.match(ruta, /pausarRespuestaSocial\(leadId, canal, \{ texto: ev\.evento\.texto, cuenta: ev\.evento\.cuentaId \}\)/);
  assert.match(ruta, /export const maxDuration = 300;/, 'redactar con IA no entra en 120 s junto con el disparo');
});

// ── «Probar» (puro) ───────────────────────────────────────────────────────────

const conAIStep = (medio?: 'instagram' | 'messenger'): PasoGrafo[] => [
  { id: 'm1', canal: medio ?? 'whatsapp', cuerpo: 'Hola', siguiente: null },
  {
    id: 'a1', nodo: 'respuesta', paso_ia: true, objetivo: 'Que agende', ...(medio ? { medio } : {}),
    casos: [{ id: 'c1', titulo: 'Quiere agendar', cuando: 'Pide un horario', siguiente: null, responder: 'Pásale el link' }],
    si_no: null,
  } as PasoGrafo,
  { id: ID_INICIO, nodo: 'inicio', siguiente: 'm1' },
];

test('«Probar» por Instagram contesta con el AI Step de Instagram, y por WhatsApp no', () => {
  const pasos = conAIStep('instagram');
  assert.equal(escuchaPor(pasos, 'instagram'), true);
  assert.equal(escuchaPor(pasos, 'whatsapp'), false);
  const porIG = entrarEnRespuesta(pasos, pausarSim(iniciar(pasos, { medio: 'instagram' })).estado, 'c1');
  assert.equal(porIG.sinRespuesta, false, 'por Instagram, «Probar» dice que MaKo no contesta');
  assert.equal(porIG.caso?.titulo, 'Quiere agendar');
  const porWA = entrarEnRespuesta(pasos, pausarSim(iniciar(pasos)).estado, 'c1');
  assert.equal(porWA.sinRespuesta, true, 'un AI Step de Instagram contesta un WhatsApp en «Probar»');
  // El clasificador de «Probar» recibe los casos del MISMO medio.
  assert.deepEqual(escenariosDeRespuesta(pasos, { medio: 'instagram' }).map((c) => c.titulo), ['Quiere agendar']);
  assert.deepEqual(escenariosDeRespuesta(pasos), []);
});

test('«Probar» pasa el medio en las cuatro puntas: el arranque, los escenarios, «¿contesta?» y el clasificador', () => {
  const pp = sinComentarios(leer('app/automations/PanelProbar.tsx'));
  assert.match(pp, /const medioIA: MedioAIStep \| undefined = esCanalSocial\(canal\) \? canal : undefined;/);
  assert.equal(pp.match(/iniciar\(flujoVivo, \{ medio: medioIA \}\)/g)?.length, 2, 'un arranque sin el medio prueba el AI Step de WhatsApp');
  assert.match(pp, /canalDelPaso\(p\) === canal, medio: medioIA \}\)/);
  assert.match(pp, /if \(!escuchaPor\(flujoRef\.current, medioIA\)\) \{/);
  assert.match(pp, /action: 'clasificar', pasos: flujoRef\.current, \.\.\.\(medioIA \? \{ medio: medioIA \} : \{\}\)/);
  const ruta = sinComentarios(leer('app/api/chat-agent/simulador/route.ts'));
  assert.match(ruta, /const casos = escenariosDeRespuesta\(pasos, \{ medio \}\);/);
});

test('el AI Step OFRECE Instagram y Messenger, y no deja elegir un medio que ya tiene el suyo', () => {
  const ed = sinComentarios(leer('app/automations/EditorPasoIA.tsx'));
  assert.match(ed, /const MEDIOS_OFRECIDOS: readonly MedioAIStep\[\] = \['whatsapp', 'instagram', 'messenger'\];/);
  assert.match(ed, /disabled=\{busy \|\| \(medio !== m && !puedeSumarAIStep\(pasos\.filter\(\(x\) => x\.id !== id\), m\)\)\}/);
});

// ── ROTURAS (14/10/2026) ────────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo junto con tests/motor-segunda-pasada.test.ts,
// restaura DE MEMORIA; nunca git). Base: 20 / 0. Cada una dio 19 / 1:
//   · la respuesta social con el corte de antes (`if (social) return …`) · el contexto social leyendo la charla
//     del WhatsApp · el modo asistido contestando un DM · «Para aprobar» guardando un borrador del WhatsApp ·
//     el tope de «Sola» contando cualquier envío · «Sola» sin la clave del mensaje · el mensaje fijo social sin
//     su reclamo · el editor sin Instagram ni Messenger · la charla sin ordenar · la charla con los PRIMEROS.
//   · el webhook sin lo que escribió ni la cuenta → 18 / 2 (lo fijan los dos archivos).
// Restaurado: 20 / 0.
// Y «Probar» (este archivo solo, base 12 / 0, cada una 11 / 1): el simulador expandiendo sin el medio · un arranque
// de «Probar» sin el medio · el clasificador sin el medio · «¿contesta?» mirando cualquier AI Step. Restaurado: 12 / 0.
