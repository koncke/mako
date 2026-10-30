// =============================================================================
// El botón de un DM VIEJO, con varias copias de la misma automatización (ticket #33 de Leandro, 30/10/2026)
// =============================================================================
// Leandro: cinco copias de la 680 (los MISMOS ids de tarjeta y el mismo «Obtener recurso»); la misma cuenta comenta las cinco
// palabras y recibe cinco DMs. «Si toca el botón del último DM, recibe el recurso. Si toca el de un DM anterior, no pasa nada»,
// y las inscripciones del lead (también las completadas) pasaron a «respondió». Medido en la base (lead 5437, 30/10 03:51):
// el toque viejo no movió nada y 50 ms después las ocho quedaron en 'respondio'. El toque llegó con un payload que NO era el
// de MaKo: `tocarBoton` dijo 'no_es' y el webhook lo trató como un mensaje escrito (la pausa, y el #788 pasa las completadas a
// «respondió»). Ahora un toque NUNCA es una respuesta, y un payload que no se lee se resuelve por el título.
//
// Por la ENTRADA REAL (el webhook de Zernio y el motor de verdad, tests/_boton-vuelve-hijo.ts 'duplicadas*'): toca el DM de
// LISTA (el más viejo) con su payload, sin payload, y con un payload ajeno; antes, la del DM más nuevo ya está completada.
//
// Correr: node --import tsx --test tests/boton-dm-viejo.test.ts
// ROTURAS: al final.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { metadataParaGuardar, TOPE_METADATA_ZERNIO } from '../lib/canal-social';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

type Paso = { llego: string[]; estados?: string[]; metadataZernio?: Array<Record<string, unknown> | null> };
const correr = (esc: string): Record<string, Paso> => {
  const out = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx',
    join(RAIZ, 'tests/_boton-vuelve-hijo.ts'), esc], { cwd: RAIZ, encoding: 'utf8', timeout: 150_000, maxBuffer: 32 * 1024 * 1024 });
  const i = out.lastIndexOf('@@R@@');
  assert.ok(i >= 0, `el hijo no terminó: ${out.slice(-1500)}`);
  return (JSON.parse(out.slice(i + 5).trim()) as { pasos: Record<string, Paso> }).pasos;
};

// LISTA (707) recibe su «Seguinos» (no sigue la cuenta); MARCA, LANZAMIENTO y GUIA siguen esperando su toque; CLAUDE, completada,
// queda completada. Nadie en «respondió».
const ESPERADO = ['707:activa:m3', '708:activa:m1', '709:activa:m1', '710:activa:m1', '711:completada:null'];
const SEGUINOS = 'Todavía no te veo entre nuestr';

for (const [esc, como] of [
  ['duplicadas', 'con su payload'],
  ['duplicadas_texto', 'sin payload (sólo el título)'],
  ['duplicadas_ajeno', 'con un payload que no es el de MaKo (lo que llegó en producción)'],
] as const) {
  test(`el toque del DM viejo ${como}: mueve SU automatización, y no pausa a nadie ni toca la completada`, () => {
    const p = correr(esc);
    assert.equal(p['0_cinco_dms'].llego.length, 5, 'cinco DMs con «Obtener recurso»');
    assert.deepEqual(p['1_toca_el_viejo'].estados, ESPERADO);
    assert.ok(!p['1_toca_el_viejo'].estados!.some((e) => e.includes(':respondio:')), 'un toque no es «respondió»');
    assert.deepEqual(p['1_toca_el_viejo'].llego.slice(5), [SEGUINOS], 'le llega el «Seguinos» de LISTA, uno');
    // LO QUE MANDÓ INSTAGRAM QUEDA GUARDADO: la falla de producción no se pudo reconstruir porque esto no estaba.
    const guardado = p['1_toca_el_viejo'].metadataZernio!.at(-1) as { metadata?: { postbackPayload?: string; postbackTitle?: string } } | null;
    if (esc === 'duplicadas_texto') assert.equal(guardado, null, 'sin metadata no se guarda nada');
    else {
      assert.equal(guardado?.metadata?.postbackTitle, 'Obtener recurso');
      if (esc === 'duplicadas_ajeno') assert.equal(guardado?.metadata?.postbackPayload, 'OBTENER_RECURSO');
      else assert.match(String(guardado?.metadata?.postbackPayload), /^mako:b:/);
    }
  });
}

test('lo que vino con el mensaje: lo que no se lee en otro lado, aunque el payload venga con otro nombre; con tope', () => {
  const cuerpo = (metadata: unknown, message: Record<string, unknown> = {}) => ({ event: 'message.received', metadata, message: { id: 'm1', text: 'Hola', platform: 'instagram', sender: { id: '1' }, attachments: [], ...message } });
  assert.equal(metadataParaGuardar(cuerpo(null)), null, 'un mensaje escrito sin nada más no guarda nada');
  assert.equal(metadataParaGuardar(cuerpo({ standby: false, storyReply: { url: 'https://firmada' } })), null, 'lo ya leído y la URL que vence, no');
  assert.deepEqual(metadataParaGuardar(cuerpo({ payload: 'OTRO_NOMBRE' })), { metadata: { payload: 'OTRO_NOMBRE' } }, 'la duda es si vino con otro nombre');
  assert.deepEqual(metadataParaGuardar(cuerpo(null, { quickReply: { payload: 'X' } })), { mensaje: { quickReply: { payload: 'X' } } });
  assert.equal(metadataParaGuardar({ event: 'comment.received', metadata: { x: 1 } }), null);
  const largo = metadataParaGuardar(cuerpo({ postbackPayload: 'P', postbackTitle: 'T', relleno: 'x'.repeat(TOPE_METADATA_ZERNIO * 2) }))!;
  assert.equal(largo.recortado, true);
  assert.equal(largo.payload, 'P', 'recortado, el payload y el título no se pierden');
  assert.equal(largo.titulo, 'T');
  assert.ok(JSON.stringify(largo).length < TOPE_METADATA_ZERNIO + 200);
});

test('guardarlo nunca rompe el webhook: escritura aparte, y un error sólo se loguea', () => {
  const e = leer('lib/zernio-entrante.ts');
  assert.match(e, /texto: e\.texto, adjuntos: adjuntosDe\(body\), zernio_message_id: e\.mensajeId,\n/, 'el upsert del mensaje no lleva la columna: sin ella, se perdería');
  assert.match(e, /const \{ error: eMeta \} = await db\.from\('ig_mensajes'\)\.update\(\{ metadata_zernio: metadata \}\)\.eq\('zernio_message_id', e\.mensajeId\);\n\s+if \(eMeta\) console\.error/);
  assert.match(leer('supabase/migrations/0353_ig_mensajes_metadata_zernio.sql'), /alter table ig_mensajes add column if not exists metadata_zernio jsonb;/);
});

test('el cableado: un postback nunca va a la pausa, y con el payload va el título', () => {
  const ruta = leer('app/api/webhooks/zernio/route.ts');
  assert.match(ruta, /tocarBotonSocial\(leadId, postback \? \{ payload: postback, texto \} : \{ texto \}\)/);
  assert.match(ruta, /if \(toque !== 'no_es' \|\| postback\) \{ console\.log\(.*\); return; \}/);
  const n = leer('lib/nutricion.ts');
  assert.match(n, /if \(t\.payload != null && !pl && !t\.texto\?\.trim\(\)\) return 'no_es';/);
  // Varias esperan el mismo título: la más vieja, siempre la misma (sin orden, la base elegía).
  assert.match(n, /\.not\('nodo_actual', 'is', null\)\.order\('id', \{ ascending: true \}\);/);
});

// ROTURAS (30/10/2026, una por vez, restaurando byte a byte; base 4 / 0):
//   el payload ajeno vuelve a ser 'no_es' (lo de producción) → 2 / 2 · el webhook no manda el título con el payload → 2 / 2 ·
//   el postback no resuelto vuelve a la pausa → 3 / 1 · varias con el mismo título, la más nueva primero → 1 / 3.
