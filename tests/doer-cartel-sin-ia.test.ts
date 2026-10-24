// =============================================================================
// El cartel del doer de WhatsApp a un negocio SIN su IA (24/10/2026, el incidente del ws21)
// =============================================================================
// Florencia (ws21, sin ninguna clave de IA) le escribió al grupo de MaKo el 22/10 09:35 UTC «Estas analizando mis
// fathom?» y le salió `cartel:sin_red_por_datos` (0 keys, 0 probadas). Ese día era cierto: la red de la plataforma
// existía y se la salteó por los datos de sus clientes. Doce horas después entró IA16 («cada negocio paga su IA»): la red
// no corre para ningún negocio, pero el doer seguía dejando la marca «red gratis salteada» con sólo mirar el turno, y el
// cartel quedó con un porqué falso («no los mando a la IA gratis de MaKo»); el de `sin_keys` mandaba a cargar «Google y
// Groq, gratis» (Groq sólo escucha). Y lo que el cartel pide —conectar su Claude— contaba CERO claves en `contarKeysIA`.
// Lo que fija este test:
//   1. el cartel es la causa, salvo sin keys y con la marca; y el doer deja la marca SÓLO si había una red que saltear;
//   2. `sin_keys` pide SU IA (`CONECTA_TU_IA`), sin Groq ni «gratis», en tú, con el link;
//   3. el de una nota de voz pide lo que escucha (su Gemini o su GPT, su Claude no escucha) y su link abre Gemini, con el
//      `?ws=` del grupo (ese aviso sale directo, sin el `linksConWs` de la respuesta de texto);
//   4. las claves de UNA sola (su Claude, su GPT) cuentan;
//   5. el doer cuenta su IA entera y la fila del vigía dice el cartel que salió;
//   6. el caso del ws21, de punta a punta con lo puro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { causaDelFallo, cartelDelFallo, textoFalloIA, textoSinRedPorDatos, linkKeysIA, rutaKeysIA } from '../lib/fallo-ia-texto';
import { conWs } from '../lib/ws-tab';
import { CONECTA_TU_IA } from '../lib/ia-mensajes';
import { contarClavesCargadas } from '../lib/ia-keys';
import { marcasDeVoseo } from '../lib/puestas-data';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const BASE = 'https://hola-mako.com';
/** La marca que deja el doer cuando saltea la red (texto real de lib/mako-doer-in.ts). */
const MARCA = 'red gratis salteada: el turno lleva datos de clientes (listar_reuniones_fathom) y el plan gratis entrena con lo que recibe';

test('1. el cartel de los datos sale sólo con la marca, y la marca sólo donde había red', () => {
  assert.equal(cartelDelFallo('sin_keys', [MARCA]), 'sin_red_por_datos', 'con la red salteada se perdió el porqué de los datos');
  assert.equal(cartelDelFallo('sin_keys', []), 'sin_keys', 'sin marca no hay porqué de datos');
  assert.equal(cartelDelFallo('sin_keys', ['plataforma/gemini: HTTP 503']), 'sin_keys');
  // Con claves que fallaron, su causa sigue siendo la verdad.
  assert.equal(cartelDelFallo('sin_cuota', [MARCA]), 'sin_cuota');
  assert.equal(cartelDelFallo('proveedor_caido', [MARCA]), 'proveedor_caido');

  // El doer pregunta por la red ANTES de decidir qué saltear: sin red (todo negocio desde IA16) no se marca nada.
  const doer = sinComentarios(leer('../lib/mako-doer-in.ts'));
  assert.match(doer, /if \(!respuesta && !suIA\) red = await provsGratisDePlataforma\(\)\.catch\(\(\) => \[\]\);\s*const turnoRed = red\.length \? turnoParaLaRed\(\{/, 'la marca se deja sin preguntar si había red');
  assert.equal(doer.match(/provsGratisDePlataforma\(/g)?.length, 1, 'la red se pide dos veces (o ninguna) en el doer');
  const iMarca = doer.indexOf('erroresPlataforma.push(`red gratis salteada:');
  assert.ok(iMarca > doer.indexOf('const turnoRed = red.length'), 'la marca quedó antes de preguntar por la red');
});

test('2. «sin_keys» pide SU IA, sin Groq ni «gratis», en tú y con el link', () => {
  const link = linkKeysIA(BASE);
  for (const que of ['contestar', 'armar el borrador'] as const) {
    const t = textoFalloIA('sin_keys', link, que, 0);
    assert.ok(t.includes(CONECTA_TU_IA), `no pide «${CONECTA_TU_IA}»:\n${t}`);
    assert.match(t, new RegExp(`No puedo ${que}`));
    assert.doesNotMatch(t, /groq/i, 'volvió a mandar a cargar Groq, que desde IA16 sólo escucha');
    assert.doesNotMatch(t, /gratis/i, 'volvió a vender una IA gratis');
    assert.ok(t.trimEnd().endsWith(link), 'perdió el link adonde se resuelve');
    assert.deepEqual(marcasDeVoseo(t), [], 'voseo en el cartel');
    assert.doesNotMatch(t, /cargá|conectá|tenés|podés/i, 'voseo en el cartel');
  }
});

test('3. el de una nota de voz pide lo que escucha (su Gemini o su GPT) y su link abre Gemini, en su negocio', () => {
  const link = linkKeysIA(BASE, 'audio');
  assert.equal(link, `${BASE}/integraciones?abrir=gemini`);
  assert.equal(linkKeysIA(BASE), `${BASE}/integraciones?abrir=anthropic`, 'el de texto dejó de abrir su Claude (IA9)');
  // Lo que arma `linkApp` en el doer (el aviso del audio sale directo, sin `linksConWs`): con el `?ws=` del grupo.
  assert.equal(conWs(rutaKeysIA('audio'), 21), '/integraciones?abrir=gemini&ws=21');
  const t = textoFalloIA('sin_keys', link, 'escuchar tu audio', 0);
  assert.match(t, /Gemini/);
  assert.match(t, /GPT/);
  assert.doesNotMatch(t, /Claude/, 'manda a conectar su Claude, que no escucha audio');
  assert.doesNotMatch(t, /groq|gratis/i);
  assert.ok(t.trimEnd().endsWith(link));
  assert.deepEqual(marcasDeVoseo(t), []);
});

test('4. su Claude y su GPT cuentan como claves (los de UNA sola clave)', () => {
  const texto = ['anthropic', 'openai', 'gemini'];
  assert.equal(contarClavesCargadas(new Set(['ANTHROPIC_API_KEY']), texto), 1, 'su Claude contó cero');
  assert.equal(contarClavesCargadas(new Set(['OPENAI_API_KEY']), texto), 1, 'su GPT contó cero');
  assert.equal(contarClavesCargadas(new Set(['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'META_ACCESS_TOKEN']), texto), 2);
  assert.equal(contarClavesCargadas(new Set(), texto), 0, 'un negocio sin nada tiene que contar cero');
  // Groq cuenta para escuchar, no para contestar; y un proveedor repetido no suma dos veces.
  assert.equal(contarClavesCargadas(new Set(['GROQ_API_KEY']), texto), 0);
  assert.equal(contarClavesCargadas(new Set(['GROQ_API_KEY', 'ANTHROPIC_API_KEY']), ['gemini', 'groq', 'openai']), 1, 'su Claude contó para escuchar');
  assert.equal(contarClavesCargadas(new Set(['OPENAI_API_KEY']), ['openai', 'openai']), 1);
});

test('5. el doer cuenta su IA entera y anota el cartel que salió', () => {
  const doer = sinComentarios(leer('../lib/mako-doer-in.ts'));
  assert.match(doer, /cuantasClavesDeIA\(uso === 'audio' \? CASCADA_STT : \['anthropic', \.\.\.PROVS_SU_IA\]\)/, 'contarKeysIA dejó de contar su IA entera');
  assert.doesNotMatch(doer, /clavesCargadas\(/, 'volvió `clavesCargadas`, que no cuenta su Claude ni su GPT');
  assert.match(doer, /const nKeysAudio = await contarKeysIA\('audio'\)/);
  assert.match(doer, /linkApp\(rutaKeysIA\('audio'\), wsData\),\s*'escuchar tu audio'/, 'el audio volvió a abrir su Claude, o salió sin su `?ws=`');
  assert.match(doer, /const nKeys = await contarKeysIA\('texto'\)/);
  assert.match(doer, /const cartel = cartelDelFallo\(causa, errsPlat\);/);
  assert.match(doer, /respuesta = cartel === 'sin_red_por_datos'\s*\?\s*textoSinRedPorDatos\(/);
  assert.match(doer, /:\s*textoFalloIA\(cartel, linkKeysIA\(APP_URL\)/);
  // La fila que lee el vigía dice el cartel que SALIÓ.
  assert.match(doer, /recordUsage\('cartel-ia', `cartel:\$\{cartel\}`/);
});

test('6. el caso del ws21: sin ninguna clave y con un turno de sus reuniones, sale «conecta tu IA»', () => {
  // Medido en producción (24/10/2026): 0 filas en `credenciales`, 0 probadas, y el ws21 no es la plataforma: sin red, el
  // doer no deja la marca, y los errores de la red llegan vacíos.
  const causa = causaDelFallo([], 0, { probadas: 0, contestaron: 0 });
  assert.equal(causa, 'sin_keys');
  const cartel = cartelDelFallo(causa, []);
  assert.equal(cartel, 'sin_keys');
  const t = textoFalloIA(cartel as 'sin_keys', linkKeysIA(BASE), 'contestar', 0);
  assert.equal(t, [
    '⚠️ No puedo contestar: tu negocio todavía no tiene su IA conectada.',
    '',
    'Pienso con la IA de tu negocio. Conecta tu Claude, tu GPT o tu Gemini y lo hago 👇',
    `${BASE}/integraciones?abrir=anthropic`,
  ].join('\n'));
  assert.doesNotMatch(t, /IA gratis de MaKo/, 'el porqué de la red que ya no existe');
  // El 22/10 (antes de IA16) la red existía y la marca quedó: ése sí era el cartel cierto, y sigue existiendo para el ws9.
  assert.equal(cartelDelFallo(causa, [MARCA]), 'sin_red_por_datos');
  assert.match(textoSinRedPorDatos(`${BASE}/integraciones?abrir=anthropic&ws=9`), /IA gratis de MaKo/);
});

// ── ROTURAS (24/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo de memoria con un script node con `finally`).
// Base 6 pasan / 0 fallan; después de las doce, 6 / 0 otra vez y el diff igual:
//   R1. el doer vuelve a marcar sin preguntar por la red (`!respuesta && !suIA ? turnoParaLaRed…`)  → 1 falla  (1)
//   R2. `cartelDelFallo` devuelve siempre la causa                                                   → 2 fallan (1, 6)
//   R3. `sin_keys` vuelve a «todavía no cargaste… Las de Google y Groq son *gratis*»                 → 2 fallan (2, 6)
//   R4. el de una nota de voz cae al texto de `contestar` (el `if` del audio nunca entra)            → 1 falla  (3)
//   R5. `rutaKeysIA` ignora `uso` (siempre `abrir=anthropic`)                                        → 1 falla  (3)
//   R6. `contarClavesCargadas` cuenta con `clavesDe` en vez de `clavesAProbar`                       → 1 falla  (4)
//   R7. `contarKeysIA('texto')` vuelve a `['gemini']`                                                → 1 falla  (5)
//   R8. la fila del vigía vuelve a `cartel:${causa}`                                                 → 1 falla  (5)
//   R9. el doer elige el texto con la causa (`const cartel = causa`)                                 → 1 falla  (5)
//   R10. voseo en el cartel («Conectá tu Claude»)                                                    → 2 fallan (2, 6)
//   R11. el aviso del audio vuelve a `linkKeysIA(APP_URL, 'audio')` (sale sin su `?ws=`)             → 1 falla  (5)
//   R12. el doer da por hecho que hay red (`red = [{ provider: 'gemini', … }]`, sin preguntar)       → 1 falla  (1)
