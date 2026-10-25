// =============================================================================
// El cartel del doer de WhatsApp a un negocio SIN su IA (24/10/2026, el incidente del ws21; 25/10/2026, sin Gemini)
// =============================================================================
// Florencia (ws21, sin ninguna clave de IA) le escribió al grupo de MaKo el 22/10 09:35 UTC «Estas analizando mis
// fathom?» y le salió `cartel:sin_red_por_datos` (0 keys, 0 probadas). Ese día era cierto: la red de la plataforma
// existía y se la salteó por los datos de sus clientes. Doce horas después entró IA16 («cada negocio paga su IA»): la red
// no corre para ningún negocio, pero el doer seguía dejando la marca «red gratis salteada» con sólo mirar el turno, y el
// cartel quedó con un porqué falso («no los mando a la IA gratis de MaKo»); el de `sin_keys` mandaba a cargar «Google y
// Groq, gratis» (Groq sólo escucha). Y lo que el cartel pide —conectar su Claude— contaba CERO claves en `contarKeysIA`.
//
// 25/10/2026, Martín, por el audio de Florencia: «le sigue diciendo que debe conectar su IA de Gemini, cuando dijimos que
// todo eso se hace con la app de escritorio de MaKo y conectado a su claude o GPT». El cartel le pedía «una API key», le
// abría Gemini y no le decía que también le faltaba Fathom, que era lo que preguntaba. Y a un negocio con MaKo Desktop y
// sin clave le decía «tu negocio todavía no tiene su IA conectada», que es falso (el doer tiraba `conPc`).
//
// Lo que fija este test:
//   1. el cartel es la causa, salvo sin keys y con la marca; y el doer deja la marca SÓLO si había una red que saltear;
//   2. `sin_keys` pide su GPT por clave para WhatsApp y MaKo Desktop para la app, cada uno con SU link; sin Gemini, sin
//      Groq, sin «gratis», en tú;
//   3. el de una nota de voz pide lo que escucha (su GPT; su Claude no escucha) y su link abre GPT, con el `?ws=` del grupo
//      (ese aviso sale directo, sin el `linksConWs` de la respuesta de texto);
//   4. las claves de UNA sola (su Claude, su GPT) cuentan;
//   5. el doer cuenta su IA entera, pasa `conPc` a los DOS caminos y la fila del vigía dice el cartel que salió y su texto;
//   6. el caso del ws21, de punta a punta con lo puro: «te falta tu IA» Y «te falta Fathom», cada una con su link;
//   7. con la computadora conectada y sin clave, el cartel no dice que no tiene su IA (ni en texto ni en audio);
//   8. ningún cartel, en ninguna causa, ofrece Gemini ni «gratis», ni manda a /integraciones sin abrir un modal;
//   9. la fila del vigía lleva el texto que le llegó a la persona.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  causaDelFallo, cartelDelFallo, textoFalloIA, textoSinRedPorDatos, linkKeysIA, rutaKeysIA, conexionesDelPedido, enlaceA,
  motivoDelCartel, MOTIVO_CARTEL_MAX, type CausaFalloIA, type QueIntentaba,
} from '../lib/fallo-ia-texto';
import { conWs } from '../lib/ws-tab';
import { contarClavesCargadas } from '../lib/ia-keys';
import { marcasDeVoseo } from '../lib/puestas-data';
import { areasDelMensaje } from '../lib/mako-intencion';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const BASE = 'https://hola-mako.com';
/** La marca que deja el doer cuando saltea la red (texto real de lib/mako-doer-in.ts). */
const MARCA = 'red gratis salteada: el turno lleva datos de clientes (listar_reuniones_fathom) y el plan gratis entrena con lo que recibe';
const GPT = `${BASE}/integraciones?abrir=openai`;

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

test('2. «sin_keys» pide su GPT para WhatsApp y MaKo Desktop para la app, cada uno con SU link, sin Gemini', () => {
  const link = linkKeysIA(BASE);
  for (const que of ['contestar', 'armar el borrador'] as const) {
    const t = textoFalloIA('sin_keys', link, que, 0);
    assert.match(t, new RegExp(`No puedo ${que}: tu negocio todavía no conectó su IA`));
    assert.match(t, /conecta tu GPT \(una clave de OpenAI\) 👇\nhttps:\/\/hola-mako\.com\/integraciones\?abrir=openai(\n|$)/, `su GPT sin su link:\n${t}`);
    assert.match(t, /instala MaKo en tu computadora y conecta tu Claude 👇\nhttps:\/\/hola-mako\.com\/perfil\/instalar(\n|$)/, `MaKo Desktop sin su link:\n${t}`);
    assert.doesNotMatch(t, /gemini/i, `volvió a ofrecer Gemini (Martín, 25/10):\n${t}`);
    assert.doesNotMatch(t, /groq/i, 'volvió a mandar a cargar Groq, que desde IA16 sólo escucha');
    assert.doesNotMatch(t, /gratis/i, 'volvió a vender una IA gratis');
    assert.deepEqual(marcasDeVoseo(t), [], 'voseo en el cartel');
    assert.doesNotMatch(t, /cargá|conectá|tenés|podés|escribime/i, 'voseo en el cartel');
  }
});

test('3. el de una nota de voz pide lo que escucha (su GPT) y su link abre GPT, en su negocio', () => {
  assert.equal(rutaKeysIA(), '/integraciones?abrir=openai');
  assert.equal(linkKeysIA(BASE), GPT, 'el link del grupo dejó de abrir su GPT');
  // Lo que arma `linkApp` en el doer (el aviso del audio sale directo, sin `linksConWs`): con el `?ws=` del grupo.
  assert.equal(conWs(rutaKeysIA(), 21), '/integraciones?abrir=openai&ws=21');
  const link = `${BASE}${conWs(rutaKeysIA(), 21)}`;
  const t = textoFalloIA('sin_keys', link, 'escuchar tu audio', 0);
  assert.match(t, /No puedo escuchar tu audio: tu negocio todavía no conectó una IA que escuche/);
  assert.match(t, /GPT/);
  assert.doesNotMatch(t, /Claude/, 'manda a conectar su Claude, que no escucha audio');
  assert.doesNotMatch(t, /gemini|groq|gratis/i);
  assert.ok(t.trimEnd().endsWith(`${GPT}&ws=21`), `perdió el link de su GPT con su ws:\n${t}`);
  assert.deepEqual(marcasDeVoseo(t), []);
  // Con su Claude por clave y nada que escuche: lo que pasa es que Claude no escucha, no que no tiene IA.
  const conClaude = textoFalloIA('sin_keys', link, 'escuchar tu audio', 0, [], { suClaude: true });
  assert.match(conClaude, /tu Claude no escucha notas de voz/);
  assert.doesNotMatch(conClaude, /no conectó/);
  assert.ok(conClaude.includes(`${GPT}&ws=21`));
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

test('5. el doer cuenta su IA entera, pasa `conPc` a los dos caminos y anota el cartel con su texto', () => {
  const doer = sinComentarios(leer('../lib/mako-doer-in.ts'));
  assert.match(doer, /cuantasClavesDeIA\(uso === 'audio' \? CASCADA_STT : \['anthropic', \.\.\.PROVS_SU_IA\]\)/, 'contarKeysIA dejó de contar su IA entera');
  assert.doesNotMatch(doer, /clavesCargadas\(/, 'volvió `clavesCargadas`, que no cuenta su Claude ni su GPT');
  // El audio: su ws, la computadora y su Claude, y su fila.
  assert.match(doer, /const nKeysAudio = await contarKeysIA\('audio'\)/);
  assert.match(doer, /linkApp\(rutaKeysIA\(\), wsData\),\s*'escuchar tu audio'/, 'el aviso del audio salió sin su `?ws=`');
  assert.match(doer, /const conPcAudio = causaAudio === 'sin_keys' && \(await negocioConSuIA\(wsData\)\)\.conPc;/, 'el audio no mira la computadora');
  assert.match(doer, /\{ conPc: conPcAudio, suClaude: suClaudeAudio \}/, 'el audio no le pasa la computadora ni su Claude al cartel');
  assert.match(doer, /recordUsage\('cartel-ia', `cartel:\$\{causaAudio\}`, \{\}, motivoDelCartel\(\[`ws\$\{wsData\}`, 'audio'/, 'el cartel del audio no deja su fila');
  // El texto.
  assert.match(doer, /const nKeys = await contarKeysIA\('texto'\)/);
  assert.match(doer, /const cartel = cartelDelFallo\(causa, errsPlat\);/);
  assert.match(doer, /respuesta = cartel === 'sin_red_por_datos'\s*\?\s*textoSinRedPorDatos\(/);
  assert.match(doer, /:\s*textoFalloIA\(cartel, linkKeysIA\(APP_URL\), eraDePlan \? 'armar el borrador' : 'contestar', nKeys, errsIA, \{ conPc: iaDelNegocio\.conPc, faltan \}\)/,
    'el cartel de texto no mira la computadora ni lo que falta');
  assert.match(doer, /for \(const c of conexionesDelPedido\(areasDelMensaje\(texto\)\)\) \{\s*if \(!\(await integracionConectada\(c, wsData\)\.catch\(\(\) => true\)\)\) faltan\.push\(c\);/,
    'lo que falta se afirma sin poder leerlo, o no se busca');
  // La fila que lee el vigía dice el cartel que SALIÓ, y su texto.
  assert.match(doer, /recordUsage\('cartel-ia', `cartel:\$\{cartel\}`, \{\}, motivoDelCartel\(\[`ws\$\{wsData\}`, intencion\.intencion,[^\n]*\], respuesta, errsIA\)/);
  // El texto entra entero: `recordUsage` no lo corta a 200 para el cartel.
  assert.match(sinComentarios(leer('../lib/anthropic-usage.ts')), /const largo = feature === 'cartel-ia' \? MOTIVO_CARTEL_MAX : 200;[\s\S]*?motivo\.trim\(\)\.slice\(0, largo\)/);
});

test('6. el caso del ws21: «Estas analizando mis fathom?», sin ninguna clave → su IA Y Fathom, cada uno con su link', () => {
  // Medido en producción (24/10/2026): 0 filas en `credenciales`, 0 probadas, y el ws21 no es la plataforma: sin red, el
  // doer no deja la marca, y los errores de la red llegan vacíos. Sin Fathom (sólo lo tienen MaKo, Mauricio y Leila).
  const causa = causaDelFallo([], 0, { probadas: 0, contestaron: 0 });
  assert.equal(causa, 'sin_keys');
  const cartel = cartelDelFallo(causa, []);
  assert.equal(cartel, 'sin_keys');
  const faltan = conexionesDelPedido(areasDelMensaje('Estas analizando mis fathom?'));
  assert.deepEqual(faltan, ['fathom'], 'su pregunta ya no dice que le falta Fathom');
  const t = textoFalloIA(cartel as 'sin_keys', linkKeysIA(BASE), 'contestar', 0, [], { faltan });
  assert.equal(t, [
    '⚠️ No puedo contestar: tu negocio todavía no conectó su IA.',
    '',
    'Para que te conteste aquí, conecta tu GPT (una clave de OpenAI) 👇',
    `${BASE}/integraciones?abrir=openai`,
    '',
    'Y para escribirme en la app, instala MaKo en tu computadora y conecta tu Claude 👇',
    `${BASE}/perfil/instalar`,
    '',
    'Y para leer tus llamadas, conecta tu Fathom 👇',
    `${BASE}/integraciones?abrir=fathom`,
  ].join('\n'));
  assert.doesNotMatch(t, /IA gratis de MaKo/, 'el porqué de la red que ya no existe');
  // El link de cada conexión conserva el `?ws=` del que recibió el cartel.
  assert.equal(enlaceA(`${BASE}/integraciones?abrir=openai&ws=21`, 'fathom'), `${BASE}/integraciones?abrir=fathom&ws=21`);
  assert.equal(enlaceA(`${BASE}/integraciones?abrir=openai&ws=21`, 'pc'), `${BASE}/perfil/instalar?ws=21`);
  // Un pedido que no es de llamadas no suma Fathom.
  assert.deepEqual(conexionesDelPedido(areasDelMensaje('qué tengo en el plan hoy')), []);
  // El 22/10 (antes de IA16) la red existía y la marca quedó: ése sí era el cartel cierto, y sigue existiendo para el ws9.
  assert.equal(cartelDelFallo(causa, [MARCA]), 'sin_red_por_datos');
  assert.match(textoSinRedPorDatos(`${BASE}/integraciones?abrir=openai&ws=9`), /IA gratis de MaKo/);
});

test('7. con la computadora conectada y sin clave, el cartel no dice que no tiene su IA', () => {
  const link = linkKeysIA(BASE);
  const t = textoFalloIA('sin_keys', link, 'contestar', 0, [], { conPc: true });
  assert.doesNotMatch(t, /no (tiene|conectó) su IA/, `le dice que no tiene su IA a quien la tiene en su computadora:\n${t}`);
  assert.match(t, /tu Claude está en tu computadora, y desde ahí te contesto en la app, no en WhatsApp/);
  assert.ok(t.includes(`${BASE}/second-brain`), `no le da el link del chat de la app:\n${t}`);
  assert.ok(t.includes(GPT), `no le da el link de su GPT para el grupo:\n${t}`);
  assert.doesNotMatch(t, /\/perfil\/instalar/, 'le pide instalar lo que ya tiene');
  assert.doesNotMatch(t, /gemini|gratis/i);
  // El audio, con la computadora sola: Claude no escucha ni contesta aquí.
  const a = textoFalloIA('sin_keys', link, 'escuchar tu audio', 0, [], { conPc: true });
  assert.doesNotMatch(a, /no conectó una IA/, `al de la computadora le dice que no tiene IA:\n${a}`);
  assert.match(a, /tu Claude está en tu computadora/);
  assert.ok(a.includes(GPT) && a.includes(`${BASE}/second-brain`));
  assert.deepEqual(marcasDeVoseo(`${t}\n${a}`), []);
});

test('8. ningún cartel, en ninguna causa, ofrece Gemini ni «gratis», ni manda a /integraciones sin abrir un modal', () => {
  const causas: CausaFalloIA[] = ['sin_keys', 'sin_cuota', 'sin_respaldo', 'proveedor_caido', 'ia_lenta', 'mensaje_muy_largo', 'fallo_nuestro'];
  const ques: QueIntentaba[] = ['contestar', 'escuchar tu audio', 'armar el borrador'];
  // Los errores de cada proveedor: con su Gemini como única IA es justo cuando se le ofrecía «otro Gemini».
  const errores = [[], ['chatCheapTools(gemini): The operation was aborted due to timeout'], ['chatCheapTools(openai): HTTP 500'],
    ['gemini: HTTP 429 RESOURCE_EXHAUSTED'], ['anthropic/claude: HTTP 500']];
  const ctxs = [{}, { conPc: true }, { suClaude: true }, { faltan: ['fathom' as const] }];
  let vistos = 0;
  for (const causa of causas) for (const que of ques) for (const keys of [0, 1, 3]) for (const errs of errores) for (const ctx of ctxs) {
    const t = textoFalloIA(causa, linkKeysIA(BASE), que, keys, errs, ctx);
    const donde = `${causa} · ${que} · ${keys} keys · ${errs.join(' ')} · ${JSON.stringify(ctx)}`;
    // Sin el nombre de SU Gemini que ya falló («Gemini, tu IA, tardó…»), que no es ofrecérselo.
    const ofrece = t.replace(/Gemini, tu IA,/g, '');
    assert.doesNotMatch(ofrece, /gemini/i, `ofrece Gemini (${donde}):\n${t}`);
    assert.doesNotMatch(t, /gratis/i, `vende algo gratis (${donde}):\n${t}`);
    assert.doesNotMatch(t, /\/integraciones(?!\?abrir=)/, `manda a /integraciones sin abrir el modal (${donde}):\n${t}`);
    assert.deepEqual(marcasDeVoseo(t), [], `voseo (${donde})`);
    // Con su GPT como la IA que falló, no hay otra que ofrecerle: ni su Gemini ni «también tu GPT».
    if (errs.length && errs.every((e) => /openai/.test(e))) assert.doesNotMatch(t, /también tu GPT/, `le ofrece su GPT a quien ya lo tiene (${donde}):\n${t}`);
    vistos++;
  }
  assert.equal(vistos, 7 * 3 * 3 * 5 * 4);
});

test('9. la fila del vigía lleva el texto, en una línea, con el ws primero y sin pasarse', () => {
  const texto = textoFalloIA('sin_keys', linkKeysIA(BASE), 'contestar', 0, [], { faltan: ['fathom'] });
  const m = motivoDelCartel(['ws21', 'consultar', '0 keys', '0 probadas', '0 contestaron', ''], texto, ['x'.repeat(2000)]);
  assert.match(m, /^ws21 · consultar · 0 keys · 0 probadas · 0 contestaron · texto: «⚠️ No puedo contestar: tu negocio todavía no conectó su IA\. \/ Para que te conteste aquí/);
  assert.ok(m.includes('abrir=fathom'), 'se perdió del motivo el link de Fathom');
  assert.ok(!m.includes('\n'), 'el motivo quedó en varias líneas');
  assert.ok(!m.includes(' ·  · '), 'un dato vacío dejó un hueco');
  assert.ok(m.length <= MOTIVO_CARTEL_MAX);
  // El vigía saca el negocio de ahí (lib/vigia-mako-grupos.ts).
  assert.equal(/^ws(\d+)\b/.exec(m)?.[1], '21');
});

// ── ROTURAS ───────────────────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo de memoria con un script node con `finally`).
// 24/10/2026: base 6 pasan / 0 fallan; después de las doce, 6 / 0 otra vez y el diff igual (R1-R12, el detalle en git).
// 25/10/2026 (scratchpad romper.mjs): base 9 / 0; después de las once, 9 / 0 otra vez y el diff igual:
//   R13. `CUBREN_EL_TURNO` vuelve a ['openai', 'gemini']                                              → 1 falla  (8)
//   R14. `sin_keys` vuelve a «Conecta tu Claude, tu GPT o tu Gemini y lo hago»                       → 4 fallan (2, 6, 8, 9)
//   R15. `rutaKeysIA()` vuelve a `abrir=anthropic`                                                    → 1 falla  (3)
//   R16. el texto ignora `ctx.conPc` (siempre «no conectó su IA»)                                     → 1 falla  (7)
//   R17a. el audio no mira la computadora (`const conPcAudio = false`)                               → 1 falla  (5)
//   R17b. el texto no le pasa `conPc` al cartel                                                       → 1 falla  (5)
//   R18. `conexionesDelPedido` devuelve siempre []                                                    → 1 falla  (6)
//   R19. el doer da Fathom por faltante si no se pudo leer (`.catch(() => false)`)                    → 1 falla  (5)
//   R20. `motivoDelCartel` deja los saltos de línea                                                   → 1 falla  (9)
//   R21. `recordUsage` vuelve a cortar todo motivo a 200                                              → 1 falla  (5)
//   R22. el audio con su Claude por clave dice «no conectó una IA que escuche»                        → 1 falla  (3)
