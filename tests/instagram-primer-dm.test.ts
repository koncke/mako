// =============================================================================
// Instagram y Messenger: el AI Step contesta el mensaje que ARRANCÓ la automatización (28/10/2026, la (a) del Cerebro)
// =============================================================================
// Teo (la llamada del 28/10, C:/dev/revisiones/2810-promesas-teo.md): «la primera DM no la contesta el AI Step». Un DM que
// dispara una automatización cuya PRIMERA tarjeta es el AI Step la inscribía y la dejaba esperando el SEGUNDO mensaje (la
// automatización no tiene salida: `pausarPorRespuesta` toma recién el próximo). Decisión del Cerebro: la (a), como
// ManyChat: ese mismo DM lo contesta el AI Step. Con una tarjeta de salida adelante (una bienvenida), lo de siempre.
// Fija:
//   · la decisión pura (`contestaElDisparo`, lib/flujo-grafo.ts): sin salida y escuchando por ESE medio;
//   · el cableado (leyendo el fuente: son módulos `server-only`): el webhook lo pide DESPUÉS de inscribir y sólo si
//     inscribió; sólo los eventos en que la persona escribió un mensaje privado (no un comentario); el motor toma sólo
//     las inscripciones de ESE evento que todavía no mandaron nada, las anota 'respondio' con compare-and-set y las pasa
//     por la MISMA puerta que una respuesta (`asistirRespuesta`).
// Correr: node --import tsx --test tests/instagram-primer-dm.test.ts
// ROTURAS (28/10/2026, una por vez y restaurada; base 4 / 0): contesta con una bienvenida adelante → 3 / 1; contesta por
// cualquier medio → 3 / 1; el webhook contesta aunque no inscribió → 3 / 1; también los comentarios → 3 / 1; también las
// inscripciones que ya conversan → 3 / 1; sin el compare-and-set → 3 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contestaElDisparo, type PasoGrafo, type CasoRespuesta } from '../lib/flujo-grafo';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));
const funcion = (src: string, firma: string) => { const i = src.indexOf(firma); assert.ok(i >= 0, `no encontré ${firma}`); return src.slice(i, src.indexOf('\n}\n', i)); };

const caso = (id: string): CasoRespuesta => ({ id, titulo: 'Precio', cuando: 'pregunta el precio', siguiente: null, responder: 'Lo vemos en la llamada' } as CasoRespuesta);
const aiStep = (medio: 'instagram' | 'messenger' | 'whatsapp', o: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ id: `ia_${medio}`, canal: medio === 'whatsapp' ? 'whatsapp' : medio, cuerpo: '', nodo: 'respuesta', paso_ia: true, casos: [caso('c1')], si_no: null, medio, ...o } as PasoGrafo);
const inicio = (siguiente: string | null): PasoGrafo => ({ id: 'entrada', nodo: 'inicio', canal: 'instagram', cuerpo: '', siguiente } as PasoGrafo);
const bienvenida: PasoGrafo = { id: 'm1', canal: 'instagram', cuerpo: '¡Hola! Ya te leo.', siguiente: null } as PasoGrafo;

test('la decisión: contesta el DM que la arrancó sólo si la PRIMERA tarjeta es el AI Step de ese medio', () => {
  // El CRON lleva directo al AI Step (con o sin la tarjeta de inicio guardada): sin salida.
  assert.equal(contestaElDisparo([aiStep('instagram')], 'instagram'), true);
  assert.equal(contestaElDisparo([inicio(null), aiStep('instagram')], 'instagram'), true);
  assert.equal(contestaElDisparo([inicio(null), aiStep('messenger')], 'messenger'), true);
  // Un AI Step de OTRO medio no contesta este (AI Step v2: cada medio el suyo).
  assert.equal(contestaElDisparo([inicio(null), aiStep('instagram')], 'messenger'), false);
  assert.equal(contestaElDisparo([inicio(null), aiStep('whatsapp')], 'instagram'), false);
  // Con una bienvenida adelante, sale la bienvenida y el AI Step contesta lo que venga después (lo de siempre).
  assert.equal(contestaElDisparo([inicio('m1'), bienvenida, aiStep('instagram')], 'instagram'), false);
  // Un AI Step SUELTO (le borraron la flecha del CRON) no escucha: no contesta nada.
  assert.equal(contestaElDisparo([inicio(null), aiStep('instagram', { suelta: true })], 'instagram'), false);
  // Sin AI Step, nada.
  assert.equal(contestaElDisparo([inicio('m1'), bienvenida], 'instagram'), false);
});

test('el webhook: DESPUÉS de inscribir, y sólo si inscribió a alguien', () => {
  const ruta = leer('app/api/webhooks/zernio/route.ts');
  const iDisparo = ruta.indexOf('dispararEventoSocial(leadId, canal, subtipo, ev.evento.texto, ev.evento.postId)');
  const iContesta = ruta.indexOf('contestarDisparoSocial(leadId, canal, subtipo, { texto: ev.evento.texto, cuenta: ev.evento.cuentaId, fecha: ev.evento.fecha })');
  assert.ok(iDisparo > 0 && iContesta > iDisparo, 'contestar antes de inscribir no encuentra la inscripción');
  // ⚠️ Y sólo si nadie le CONTESTÓ ya ese mensaje (la revisión del Cerebro, 29/10/2026): con la pausa contestando y la
  // automatización nueva también, el mismo DM recibía DOS respuestas del AI Step.
  assert.match(ruta.slice(iDisparo, iContesta), /if \(n > 0 && !contestada\) \{/);
  const iPausa = ruta.indexOf('pausarRespuestaSocial(leadId, canal,');
  assert.ok(iPausa > 0 && iPausa < iDisparo, 'la pausa va antes del disparo');
  assert.match(ruta.slice(iPausa, iDisparo), /contestada = p\.contestada;/);
});

// ⚠️ «CONTESTADA» NO ES «PAUSADAS» (la reverificación de Integración sobre 0265924c6, 29/10/2026): el freno de arriba usaba la
// cantidad de inscripciones que `pausarPorRespuesta` pasó a 'respondio', y ahí cae CUALQUIER automatización activa del lead,
// también una sin AI Step (comentario → m1 → Esperar 1 día → m2). Ana comentaba, y su primer DM no lo contestaba nadie: ni la
// de comentario (no tiene AI Step) ni la «envía un mensaje» (la frenaba el número). El flujo de Leandro. Ahora cuenta sólo lo
// que un AI Step o la charla abierta contestaron (o dejaron para aprobar).
test('el freno mira si ESE mensaje ya tuvo respuesta, no cuántas automatizaciones se pausaron', () => {
  const ruta = leer('app/api/webhooks/zernio/route.ts');
  assert.doesNotMatch(ruta, /tomadas/, 'la cantidad de pausadas no decide si se contesta');
  const ze = leer('lib/zernio-entrante.ts');
  const pausar = funcion(ze, 'export async function pausarRespuestaSocial(');
  assert.match(pausar, /Promise<\{ pausadas: number; contestada: boolean \}>/);
  assert.match(pausar, /const atencion = \{ contestada: false \};\s*const pausadas = await pausarPorRespuesta\(leadId, \{ origen: canal, texto: extra\.texto \?\? undefined, cuenta: extra\.cuenta \?\? null, atencion \}\);\s*return \{ pausadas, contestada: atencion\.contestada \};/);
  const nutri = leer('lib/nutricion.ts');
  const ppr = funcion(nutri, 'export async function pausarPorRespuesta(');
  // `atendida`: lo que contestó el AI Step de la respuesta, o si no, la charla abierta. Y eso es lo que se devuelve.
  const iSigue = ppr.indexOf('if (!atendida) atendida = await seguirCharla(leadId, charla,');
  const iMarca = ppr.indexOf('if (opts?.atencion) opts.atencion.contestada = atendida;');
  assert.ok(iSigue > 0 && iMarca > iSigue, 'la marca va después de la charla');
  assert.ok(ppr.indexOf('atendida = await asistirRespuesta(') < iSigue);
  // La charla devuelve si contestó: lo que dice `asistirRespuesta`; el aviso «Contéstale tú» no es contestar.
  const charla = funcion(nutri, 'async function seguirCharla(');
  assert.match(charla, /\): Promise<boolean> \{/);
  assert.match(charla, /if \(v\.abierta\) \{\s*return asistirRespuesta\(leadId, \[v\.insc\.secuencia_id\], texto, linea,/);
  assert.doesNotMatch(charla, /return;/, 'ningún camino devuelve «no sé»');
  assert.match(charla.slice(charla.indexOf("emitirDelCatalogo('wa-mensaje-entrante'")), /\}\);\s*return false;\s*$/);
});

test('sólo un mensaje privado que la persona escribió: un comentario no (es público, su respuesta es la privada)', () => {
  const ze = leer('lib/zernio-entrante.ts');
  assert.match(ze, /const ES_MENSAJE_QUE_SE_CONTESTA: ReadonlySet<EventoSocial\['subtipo'\]> = new Set\(\['mensaje', 'historia', 'anuncio', 'referencia'\]\);/);
  const f = funcion(ze, 'export async function contestarDisparoSocial(');
  assert.match(f, /if \(!ES_MENSAJE_QUE_SE_CONTESTA\.has\(subtipo\) \|\| !extra\.texto\?\.trim\(\)\) return 0;/);
  assert.match(f, /const sub = subtipoDelEvento\(canal, subtipo\);/, 'el subtipo, en las palabras del CRON');
});

test('el motor: sólo las de ESE evento, recién inscriptas, como una respuesta y por la misma puerta', () => {
  const f = funcion(leer('lib/nutricion.ts'), 'export async function contestarElDisparo(');
  assert.match(f, /contestaElDisparo\(s\.pasos, canal\)\s*&& vistasPorDisparador\(s\)\.some\(\(v\) => disparaPorEvento\(v\.disparador, canal, \{ subtipo, texto \}\)\)/);
  assert.match(f, /if \(!\(await yaLeSalioAlgo\(supabase, i\.id\)\)\) frescas\.push\(i\.id\);/, 'una que ya conversa contesta por pausarPorRespuesta');
  assert.match(f, /\.update\(\{ estado: 'respondio', updated_at: ahoraISO\(\) \}\)\s*\.in\('id', frescas\)\.eq\('estado', 'activa'\)/, 'compare-and-set contra activa');
  assert.match(f, /await asistirRespuesta\(leadId, contestan\.map\(\(m\) => m\.secuencia_id\), texto, null, \{ medio: canal, cuenta: opts\.cuenta \?\? null, recibidoAt: opts\.recibidoAt \?\? null \}\);/);
  assert.match(f, /catch \(e\) \{[\s\S]*return 0;/, 'nunca tira: el lead ya quedó inscripto');
});
