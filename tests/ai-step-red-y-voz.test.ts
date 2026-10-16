// =============================================================================
// EL AI STEP CON LA RED DE PLATAFORMA Y ESCUCHANDO LAS NOTAS DE VOZ (16/10/2026)
// =============================================================================
// docs/mapa-ia-24h.md, con la decisión A de Martín («lo que responde en vivo, con API»), dos huecos del AI Step que
// dejaban a un lead REAL sin respuesta:
//   1. NO TENÍA LA RED DE PLATAFORMA: sólo las keys del negocio. Un negocio sin key propia no clasificaba (el lead caía
//      en «Otra cosa») ni redactaba («No pude dejarte un borrador»). Ahora el MOTOR pide la red para clasificar,
//      redactar y calificar (`EnVivo`), con un plazo: las keys del negocio primero, después las gratis de la agencia
//      (otro proveedor primero), con el motivo «⚠ red de plataforma». El Probar también (AGENTS.md); las lecturas de la
//      API no: un agente en bucle gastaría la cuota de la agencia. Los errores de la red no eligen el texto del cliente.
//   2. NO ESCUCHABA LAS NOTAS DE VOZ: le llegaba texto vacío. Ahora el webhook le pasa el audio al motor, y el motor lo
//      escucha (`transcribirAudio`, que ya trae la red) ANTES de clasificar, sólo si un AI Step va a contestar. Lo que
//      dijo queda guardado en su mensaje: la charla lo ve como «🎤 …» (también en el turno siguiente), la bandeja como
//      «Dice: …», y el aviso del negocio («{{lead_escribio}}») lo cita con 🎤. Si no se pudo escuchar, dice por qué.
//
// ⛔ Y CON LA REGLA DE PII del mismo día (AGENTS.md): lo que escribió o dijo un lead real nunca va a las keys gratis de
// la agencia (el plan gratis de Gemini entrena). La red del motor va sólo por el crédito de Claude, y la nota de voz
// no va a la red gratis de `transcribirAudio`. El Probar no lleva la marca: ahí el «lead» es el dueño.
//
// REVISIÓN ADVERSARIAL del mismo día (11 hallazgos): la guarda de «entró uno más nuevo» mientras se escuchaba (la hora
// del PROPIO mensaje), lo escuchado sin guardar, el aviso del negocio sin el 🎤, el porqué escrito a mano, la red fija
// en funciones compartidas, el plazo, el audio que el webhook no trae, el corte por insistencia por voz y el prefijo
// `data:`. Cada uno con su rotura abajo.
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-ai-step.mjs, una rotura por vez y restaurada con sha1 igual).
// Base 9 pass / 0 fail; los números medidos de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  escucharNotaDeVoz, escritoParaElAviso, conTurnoActual, historialDeMensajes, AUDIO_DEL_LEAD, PREFIJO_NOTA_DE_VOZ,
} from '../lib/setter-conversacion';
import { insistenciaRebatida } from '../lib/conversacion-repeticion';
import { causaDelFallo, fraseDelFallo } from '../lib/fallo-ia-texto';
import { contenidoDeMensaje } from '../app/whatsapp/_shared/ChatHilo';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bloque = (src: string, abre: string) => {
  const i = src.indexOf(abre);
  assert.ok(i >= 0, `no encontré «${abre}»`);
  return src.slice(i, src.indexOf('\n}\n', i));
};
const AUDIO = { base64: 'T2dnUw==', mime: 'audio/ogg' };
const SIN = { deVoz: false, sinEscucha: null };

// rotura 1 (sin pedirle el audio a la instancia cuando el webhook no lo trae): 8 pass / 1 fail, cae éste.
// rotura 2 (sin sacar el prefijo `data:` del audio): 8 pass / 1 fail, cae éste.
test('escucharNotaDeVoz: lo que dijo pasa a ser el texto; con texto o sin audio no se escucha nada', async () => {
  const oidos: string[] = [];
  const oye = (dicho: string) => ({ transcribir: async (b64: string) => { oidos.push(b64); return dicho; } });
  // Escribió: no se paga escuchar nada.
  assert.deepEqual(await escucharNotaDeVoz('Hola', AUDIO, oye('x')), { texto: 'Hola', ...SIN });
  assert.deepEqual(await escucharNotaDeVoz(undefined, null, oye('x')), { texto: undefined, ...SIN });
  assert.equal(oidos.length, 0);
  assert.deepEqual(await escucharNotaDeVoz(undefined, AUDIO, oye('  ¿Cuánto cuesta el programa?  ')), { texto: '¿Cuánto cuesta el programa?', deVoz: true, sinEscucha: null });
  // Sin el audio en el webhook, se le pide a la instancia; y sin el prefijo de un data URL (el mismo saneo que al guardarlo).
  const traido = await escucharNotaDeVoz(undefined, { base64: null, mime: 'audio/ogg' }, { ...oye('Sí, el martes'), traer: async () => 'data:audio/ogg;base64,QUJD' });
  assert.equal(traido.texto, 'Sí, el martes');
  assert.equal(oidos.at(-1), 'QUJD');
});

// rotura 3 (el porqué sale de cualquier error, no de `porQue`): 8 pass / 1 fail, cae éste.
test('si no se pudo escuchar, dice por qué con la regla de la casa (las keys del negocio, nunca las de la red)', async () => {
  assert.match((await escucharNotaDeVoz(undefined, { base64: null, mime: 'audio/ogg' }, { transcribir: async () => 'x' })).sinEscucha ?? '', /no llegó el audio/);
  assert.match((await escucharNotaDeVoz(undefined, AUDIO, { transcribir: async () => '   ' })).sinEscucha ?? '', /no se entendía nada/);
  const r = await escucharNotaDeVoz(undefined, AUDIO, {
    transcribir: async () => { throw new Error('gemini#1: 429 quota | groq(red)#1: 500'); },
    porQue: () => fraseDelFallo(causaDelFallo(['gemini#1: 429 quota'], 1)),
  });
  assert.equal(r.texto, undefined, 'sin escuchar, el texto sigue vacío');
  assert.equal(r.sinEscucha, 'no pude escuchar su nota de voz: las keys de IA del negocio no tienen cuota ahora');
  assert.doesNotMatch(r.sinEscucha ?? '', /groq|red|429/, 'ni el error crudo ni los de la agencia');
  // En el motor, `porQue` es `causaDelFallo` + `fraseDelFallo` con `SttSinEscucha.errores` (las keys del negocio).
  const oye = bloque(leer('lib/nutricion.ts'), 'async function escucharDelLead(');
  assert.match(oye, /return fraseDelFallo\(causaDelFallo\(e\.errores, keys\)\);/);
});

// rotura 4 (el turno de la nota de voz se suma al final en vez de reemplazar su «(mandó un audio)»): 8 pass / 1 fail.
// rotura 5 (la charla no lee lo que dijo una nota guardada): 8 pass / 1 fail, cae éste.
test('en la charla, lo que dijo reemplaza su «(mandó un audio)», y una nota ya escuchada se ve en el turno siguiente', () => {
  const charla = historialDeMensajes([
    { from_me: true, texto: 'Hola Ana, ¿pudiste ver el video?', tipo: 'text' },
    { from_me: false, texto: null, tipo: 'audio' },
  ]);
  assert.equal(charla[1].texto, AUDIO_DEL_LEAD);
  assert.deepEqual(conTurnoActual(charla, 'Sí, lo vi y tengo una duda', { deVoz: true }), [
    { de: 'negocio', texto: 'Hola Ana, ¿pudiste ver el video?' },
    { de: 'lead', texto: `${PREFIJO_NOTA_DE_VOZ}Sí, lo vi y tengo una duda` },
  ]);
  // Ya GUARDADA (`wa_mensajes.texto`): la charla la lee como lo que dijo, y el turno actual corta ahí (no se duplica).
  const guardada = historialDeMensajes([{ from_me: false, texto: 'Sí, lo vi', tipo: 'audio' }, { from_me: true, texto: '¡Genial!', tipo: 'text' }, { from_me: false, texto: null, tipo: 'audio' }]);
  assert.deepEqual(guardada[0], { de: 'lead', texto: `${PREFIJO_NOTA_DE_VOZ}Sí, lo vi` }, 'el turno siguiente ve lo que dijo antes');
  const yaEscrita = historialDeMensajes([{ from_me: false, texto: 'Una duda', tipo: 'audio' }]);
  assert.deepEqual(conTurnoActual(yaEscrita, 'Una duda', { deVoz: true }), [{ de: 'lead', texto: `${PREFIJO_NOTA_DE_VOZ}Una duda` }]);
  // Un audio NUESTRO sigue siendo «(le mandamos un audio)»: su texto, si lo tuviera, no es lo que dijo el lead.
  assert.equal(historialDeMensajes([{ from_me: true, texto: null, tipo: 'audio' }])[0].texto, '(le mandamos un audio)');
  // Sin nota de voz, como siempre.
  assert.deepEqual(conTurnoActual(charla, 'Una duda').at(-1), { de: 'lead', texto: 'Una duda' });
});

// rotura 6 (el prefijo vuelve a ser «(nota de voz) »): 8 pass / 1 fail, cae éste.
test('el corte por insistencia también ve a quien repite la objeción por voz', () => {
  const t = (de: 'lead' | 'negocio', texto: string) => ({ de, texto });
  const porTexto = [t('lead', 'está caro'), t('negocio', 'r1'), t('lead', 'muy caro'), t('negocio', 'r2'), t('lead', 'sigue caro')];
  assert.equal(insistenciaRebatida(porTexto), true);
  const porVoz = [...porTexto.slice(0, 4), t('lead', `${PREFIJO_NOTA_DE_VOZ}sigue caro`)];
  assert.equal(insistenciaRebatida(porVoz), true, 'la marca de la voz no diluye el parecido');
  // Y un dicho que termina en «)» no queda como relleno.
  assert.equal(insistenciaRebatida([...porTexto.slice(0, 4), t('lead', `${PREFIJO_NOTA_DE_VOZ}sigue caro (la verdad)`)]), true);
});

// rotura 7 (el aviso del negocio cita lo escrito sin el 🎤 ni el porqué): 8 pass / 1 fail, cae éste.
// rotura 8 (la bandeja dibuja lo que dijo como un mensaje escrito): 8 pass / 1 fail, cae éste.
test('lo que dijo, en el aviso del negocio y en la bandeja', () => {
  assert.equal(escritoParaElAviso('Hola', SIN), 'Hola');
  assert.equal(escritoParaElAviso('Sí, el martes', { deVoz: true, sinEscucha: null }), `${PREFIJO_NOTA_DE_VOZ}Sí, el martes`);
  assert.equal(escritoParaElAviso('', { deVoz: false, sinEscucha: 'no pude escuchar su nota de voz: no llegó el audio' }), `${PREFIJO_NOTA_DE_VOZ}(no pude escuchar su nota de voz: no llegó el audio)`);
  assert.equal(escritoParaElAviso(undefined, SIN), '');
  // Los TRES lugares del AI Step que citan al lead pasan por ahí: los dos avisos («{{lead_escribio}}»), el hand-off y la
  // acción de una rama.
  const nut = leer('lib/nutricion.ts');
  assert.equal(nut.split('valoresDeLoEscrito(escritoParaElAviso(texto, c.voz))').length, 3);
  assert.match(nut, /mensaje: escritoParaElAviso\(texto, c\.voz\) \|\| '\(el lead respondió sin texto\)',/);
  assert.match(nut, /const respuesta = escritoParaElAviso\(texto, c\.voz\)\.slice\(0, 1000\);/);
  // La bandeja: «Dice: …» debajo del audio del lead, no un mensaje escrito. Un audio nuestro no cambia.
  const delLead = contenidoDeMensaje({ id: 1, fromMe: false, tipo: 'audio', texto: 'Sí, el martes', mediaUrl: 'https://x/a.ogg' });
  assert.equal(delLead.audio?.transcript, 'Sí, el martes');
  assert.equal(delLead.texto, undefined);
  assert.equal(contenidoDeMensaje({ id: 2, fromMe: true, tipo: 'audio', texto: null, mediaUrl: 'https://x/b.ogg' }).audio?.transcript, null);
});

// rotura 9 (la guarda usa «el último al leer» y no la hora del propio mensaje): 8 pass / 1 fail, cae éste.
// rotura 10 (no se guarda lo que dijo): 8 pass / 1 fail, cae éste.
// rotura 11 (el motor no escucha): 8 pass / 1 fail, cae éste.
test('el camino: el webhook pasa el audio y su hora, el motor escucha antes de clasificar, guarda y respeta el plazo', () => {
  const evo = leer('lib/evolution-mensajes.ts');
  assert.match(evo, /const audio = tipo === 'audio' \? \{ base64: mediaBase64 \?\? null, mime: mediaMime \?\? 'audio\/ogg', waMessageId: key\.id, chatJid, instancia: instance \} : null;/);
  assert.match(evo, /const recibidoAt = Number\(data\.messageTimestamp\) > 0 \? tsToISO\(data\.messageTimestamp\) : null;/);
  assert.match(evo, /pausarPorRespuesta\(leadId, \{ texto: texto \?\? undefined, linea: instance, origen: 'no_oficial', audio, recibidoAt \}\)/);
  const nut = leer('lib/nutricion.ts');
  // Los dos caminos del motor llevan el audio y la hora: la primera respuesta y la charla abierta.
  assert.match(nut, /atendida = await asistirRespuesta\([^\n]*audio: opts\?\.audio \?\? null, recibidoAt: opts\?\.recibidoAt \?\? null \}\);/);
  assert.match(nut, /await seguirCharla\([^\n]*, opts\?\.audio \?\? null, opts\?\.recibidoAt \?\? null\);/);
  assert.match(nut, /\{ medio: social \?\? 'whatsapp', cuenta, audio, recibidoAt \}\);/);
  // Se escucha DESPUÉS de saber que hay quien conteste, ANTES de la charla y del clasificador, con el plazo.
  const asistir = bloque(nut, 'async function asistirRespuesta(');
  const iSec = asistir.indexOf('if (!secuencia) return false;');
  const iOye = asistir.indexOf('await escucharDelLead(textoEntrante, op.audio ?? null, hastaMs);');
  const iCtx = asistir.indexOf('const c = await contextoDeRespuesta(');
  const iClas = asistir.indexOf('clasificarEscenario(texto');
  assert.ok(iSec > 0 && iOye > iSec && iCtx > iOye && iClas > iCtx, 'escuchar va entre «hay quien conteste» y la charla');
  assert.match(asistir, /const hastaMs = Date\.now\(\) \+ PLAZO_AI_STEP_MS;/);
  assert.match(asistir, /\{ voz, recibidoAt: op\.recibidoAt \?\? null, hastaMs \}\);/);
  assert.match(asistir, /motivo: c\.voz\.sinEscucha \?\? clas\.motivo,/);
  // Escuchar: con plazo, pidiéndole el audio a la instancia, y GUARDANDO lo que dijo (compare-and-set sobre el vacío).
  const oye = bloque(nut, 'async function escucharDelLead(');
  assert.match(oye, /if \(!audio \|\| textoEntrante\?\.trim\(\)\) return/);
  assert.match(oye, /conPlazo\(\n\s*transcribirAudio\(b64, mime, \{ language: 'es', feature: 'AI Step · nota de voz'/);
  assert.match(oye, /fetchMediaBase64EnInstancia\(instancia, chatJid, waMessageId, false\)/);
  assert.match(oye, /if \(r\.deVoz && r\.texto && waMessageId\) \{\n\s*const supabase = await getTenantDb\(\);\n\s*const \{ error \} = await supabase\.from\('wa_mensajes'\)\.update\(\{ texto: r\.texto\.slice\(0, 4000\) \}\)\.eq\('wa_message_id', waMessageId\)\.is\('texto', null\);/);
  // La guarda de «entró uno más nuevo» compara con la hora del PROPIO mensaje.
  const ctx = bloque(nut, 'async function contextoDeRespuesta(');
  assert.match(ctx, /const propio = extra\.recibidoAt \? Date\.parse\(extra\.recibidoAt\) : NaN;\n\s*const respondeA = Number\.isFinite\(propio\) \? propio : ultimoEntranteMs\(filas\);/);
  // La charla del redactor, con la nota de voz en su lugar (WhatsApp y redes), y el aviso con 🎤 o el porqué.
  assert.equal(nut.split('conTurnoActual(historialDeMensajes(filas ?? []), texto, { deVoz: voz.deVoz })').length, 3);
  assert.equal(nut.split('${citaDelLead(c)}').length, 3);
});

// rotura 12 (el redactor del motor sin la red): 8 pass / 1 fail, cae éste.
// rotura 13 (la red fija en la función compartida: el Probar y la API la gastan): 8 pass / 1 fail, cae éste.
// rotura 14 (los errores de la red mezclados con los del cliente): 8 pass / 1 fail, cae éste.
// rotura 15 (el Probar sin la red: AGENTS.md, «todo camino de IA que use un cliente»): 8 pass / 1 fail, cae éste.
test('la red de plataforma: la pide el motor, con plazo y con PII, para clasificar, redactar y calificar', () => {
  const nut = leer('lib/nutricion.ts');
  assert.match(nut, /tema: 'redactar la respuesta a tu lead', redDePlataforma: true, hastaMs: c\.hastaMs, pii: true,/);
  assert.match(nut, /evaluarCalificacion\(secuencia\.id, historial, \{ leadId, redDePlataforma: true, hastaMs: c\.hastaMs, pii: true \}\)/);
  assert.equal(nut.split(', { redDePlataforma: true, hastaMs: c.hastaMs, pii: true });').length, 3, 'los dos clasificadores del motor');
  // En las funciones compartidas, la red es OPCIÓN del que llama (`enVivo`), nunca fija.
  const sim = leer('lib/setting-simulador.ts');
  const responder = bloque(sim, 'export async function responderSimulador(');
  assert.match(responder, /provs: CASCADA_GRATIS, erroresOut: errores, erroresPlataformaOut: erroresRed, \.\.\.enVivo\(opts\),/);
  assert.match(bloque(sim, 'export async function evaluarCalificacion('), /feature: 'setting-calificar', maxTokens: 300, \.\.\.enVivo\(opts\),/);
  assert.equal(sim.split('redDePlataforma: true').length, 2, 'la red quedó fija en una función que también usan el Probar y la API');
  assert.match(sim, /\.\.\.\(o\?\.redDePlataforma \? \{ redDePlataforma: true \} : \{\}\),/, 'la única, la de `enVivo`');
  const clas = bloque(leer('lib/chat-agent-handoff.ts'), 'export async function clasificarEscenario(');
  assert.match(clas, /\.\.\.\(opts\.redDePlataforma \? \{ redDePlataforma: true \} : \{\}\),/);
  // El Probar la pide (AGENTS.md: «todo camino de IA que use un cliente necesita su red»), sin plazo del webhook; las
  // lecturas de la API, no (un agente externo en bucle gastaría la cuota de la agencia).
  const sim2 = leer('app/api/chat-agent/simulador/route.ts');
  assert.match(sim2, /clasificarEscenario\(mensaje, escenarios, \{ redDePlataforma: true \}\)/);
  assert.match(sim2, /responderSimulador\(id, historial, \{ escenario, redDePlataforma: true \}\)/);
  assert.match(sim2, /responderSimulador\(id, historial, \{ redDePlataforma: true \}\)/);
  const ensayo = leer('app/api/automations/ai-step/ensayo/route.ts');
  assert.match(ensayo, /clasificarEscenario\(historial\[historial\.length - 1\]\.texto, escenarios, \{ redDePlataforma: true \}\)/);
  assert.match(ensayo, /escenario: elegido\.escenario, redDePlataforma: true \}\)/);
  assert.doesNotMatch(leer('lib/api-mako/areas/chatbot.run.ts'), /(responderSimulador|evaluarCalificacion)\([^\n]*redDePlataforma/, 'la API pidió la red');
  // El texto del fallo se elige con los errores DEL NEGOCIO (`errores`), no con los de la red.
  assert.match(responder, /return \{ ok: false, error: await errorDeCascada\(errores, tema\) \};/);
  // La red ya hace lo pedido (lib/ai-cheap.ts): otro proveedor primero y el motivo «⚠ red de plataforma».
  const ai = leer('lib/ai-cheap.ts');
  assert.match(ai, /const otroPrimero = \[\.\.\.red\.filter\(\(r\) => !probados\.has\(r\.provider\)\), \.\.\.red\.filter\(\(r\) => probados\.has\(r\.provider\)\)\];/);
  assert.match(ai, /motivo: `⚠ red de plataforma \(\$\{r\.provider\}\) — las keys del negocio no pudieron/);
});

// ⛔ LOS DATOS DE LOS CLIENTES DE UN CLIENTE NUNCA VAN A UN PROVEEDOR QUE ENTRENA (regla del 16/10/2026, AGENTS.md):
// lo que escribió o dijo un lead real es eso. La red del AI Step va sólo por el crédito de Claude (el corte de PII de
// `chatCheapCascade`), y la nota de voz no va a la red gratis de `transcribirAudio`, que tiene la SUYA (no pasa por el
// corte). Si nada contesta, el aviso de siempre.
// rotura 16 (el redactor del motor sin la marca de PII): 7 pass / 2 fail, caen éste y el de la red.
// rotura 17 (`enVivo` no pasa la marca de PII a la cascada): 8 pass / 1 fail, cae éste.
// rotura 18 (la nota de voz del lead va a la red gratis de `transcribirAudio`): 8 pass / 1 fail, cae éste.
test('con PII: la red sólo por el crédito de Claude, y la nota de voz del lead nunca a la red gratis', () => {
  const nut = leer('lib/nutricion.ts');
  for (const llamada of ['clasificarEscenario(texto ?? \'\', estrategia?.escenarios ?? [], {', 'clasificarEscenario(texto ?? \'\', lista, {', 'tema: \'redactar la respuesta a tu lead\',', 'evaluarCalificacion(secuencia.id, historial, {']) {
    const i = nut.indexOf(llamada);
    assert.ok(i > 0, `no encontré ${llamada}`);
    assert.match(nut.slice(i, nut.indexOf('\n', i)), /pii: true/, `${llamada} sin la marca de PII`);
  }
  const sim = leer('lib/setting-simulador.ts');
  assert.match(sim, /\.\.\.\(o\?\.pii \? \{ pii: true \} : \{\}\),/, '`enVivo` no pasa la marca');
  assert.match(bloque(leer('lib/chat-agent-handoff.ts'), 'export async function clasificarEscenario('), /\.\.\.\(opts\.pii \? \{ pii: true \} : \{\}\),/);
  // La cascada corta la red gratis con PII DESPUÉS del crédito de Claude (lo puso Onboarding, lib/ai-cheap.ts).
  const ai = leer('lib/ai-cheap.ts');
  const iCredito = ai.indexOf('const { conCreditoDeLaPlataforma } = await import(\'./anthropic\');');
  const iCorte = ai.indexOf('const conPII = opts.pii ?? CATALOGO_MODELOS.some(');
  const iGratis = ai.indexOf('const otroPrimero = [');
  assert.ok(iCredito > 0 && iCorte > iCredito && iGratis > iCorte, 'el orden: crédito de Claude, corte de PII, keys gratis');
  // La nota de voz: `pii` en la llamada, y `transcribirAudio` no entra a su red con él.
  assert.match(bloque(nut, 'async function escucharDelLead('), /motivo: 'Escuchar la nota de voz del lead', pii: true \}\)/);
  const stt = bloque(ai, 'export async function transcribirAudio(');
  const iPii = stt.indexOf('if (o.pii) {');
  const iRed = stt.indexOf('const red = await provsGratisDePlataforma()');
  assert.ok(iPii > 0 && iRed > iPii, 'la red gratis del audio se corta con PII antes de armarse');
  assert.match(stt, /if \(o\.pii\) \{\n\s*erroresPlataforma\.push\([^\n]*\);\n(\s*\/\/[^\n]*\n)*\s*\} else if \(wsSA != null && wsActual !== wsSA\) \{/);
});

test('fraseDelFallo: una frase por causa, para el renglón del aviso', () => {
  assert.equal(fraseDelFallo('sin_keys'), 'no hay ninguna API key de IA cargada');
  assert.equal(fraseDelFallo(causaDelFallo(['gemini#1: 500 internal error'], 1)), 'la única key de IA del negocio no contestó');
  // Saturado del lado del proveedor no es del cliente (`esSaturacion`): otra key del mismo proveedor no lo cubre.
  assert.equal(fraseDelFallo(causaDelFallo(['gemini#1: 503 overloaded'], 1)), 'los proveedores de IA no contestaron');
});
