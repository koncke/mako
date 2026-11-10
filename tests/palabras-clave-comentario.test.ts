// =============================================================================
// Las PALABRAS CLAVE del CRON «comenta tu publicación o Reel», como ManyChat (ticket #17 de Leandro, 28/10/2026)
// =============================================================================
// Leandro (Fiesta Music, ws10), por audio: «cuando alguien comente la palabra fiesta o la palabra guía… que se responda el
// comentario», y por texto: «Tal cual como lo hace manychat». El CRON de comentario arrancaba con CUALQUIER comentario.
// La regla (el Cerebro): una lista de palabras, «contiene» o «exacta», sin mayúsculas ni acentos; VACÍA = cualquier
// comentario, como hoy; el texto es el del comentario de CADA evento, no el de cuando nació el lead.
// Fija:
//   · lo puro (lib/palabras-clave.ts): cómo se compara, la lista saneada y lo que dice la tarjeta;
//   · el CRON (lib/disparadores.ts): las palabras sólo en uno de comentario, sobreviven al primer CRON (que se rearma de
//     las columnas), cuentan en la firma, y `disparaPorEvento` / `escuchaElEvento` miran el texto del evento;
//   · el cableado (leyendo el fuente): el webhook pasa lo que comentó hasta el motor, y la pantalla guarda al salir de la caja.
// Correr: node --import tsx --test tests/palabras-clave-comentario.test.ts
// ROTURAS (28/10/2026, una por vez y restaurada; base 6 / 0): los acentos cuentan → 4 / 2; «contiene» como pedazo de
// palabra → 5 / 1; sin texto dispara → 4 / 2; `higiene` no las guarda → 4 / 2; el primer CRON las pierde → 5 / 1; la firma
// no las cuenta → 5 / 1; el evento no las mira → 5 / 1; el webhook no pasa el texto → 5 / 1; `hayQuienEscuche` sin el
// texto → 5 / 1; la pantalla guarda en cada tecla → 5 / 1. (28/10, la revisión del Cerebro) con la versión de antes → 4 / 2;
// el emoji tirado con los signos → 4 / 2; una lista que no se puede leer dispara con cualquiera → 5 / 1. Lo que NO SE LEE
// («?», base 7 / 0): la ruta no lo mira → 6 / 1; la pantalla guarda igual → 6 / 1; la API no dice las palabras → 6 / 1;
// «?» se lee → 6 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comentarioDispara, normalizarComentario, sanearPalabras, textoDePalabras, palabrasDeTexto, problemaDePalabras, palabrasQueNoSeLeen, TOPE_PALABRAS } from '../lib/palabras-clave';
import {
  sanearDisparador, disparadoresDe, firmaDisparador, disparaPorEvento, escuchaElEvento, textoDeDisparador, conPalabras,
  type Disparador, type SecuenciaConDisparo,
} from '../lib/disparadores';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

test('cómo se compara: sin mayúsculas, sin acentos ni signos, el emoji como palabra; «contiene» es la palabra entera', () => {
  assert.equal(normalizarComentario('¡GUÍA, por favor! 🎉'), 'guia por favor 🎉', 'el emoji queda, como palabra propia');
  assert.equal(normalizarComentario('Fiesta🎉🎉'), 'fiesta 🎉 🎉');
  assert.equal(normalizarComentario('❤️ 👍🏽'), '❤ 👍', 'la variante y el tono de piel no cambian cuál es');
  assert.equal(normalizarComentario('Año'), 'año', 'la ñ no es un acento');
  const PALABRAS = ['fiesta', 'Guía'];
  assert.equal(comentarioDispara('Quiero la GUIA!!', PALABRAS), true);
  assert.equal(comentarioDispara('fiesta 🎉', PALABRAS), true);
  assert.equal(comentarioDispara('me encanta guiar', PALABRAS), false, '«guía» no está en «guiar»');
  assert.equal(comentarioDispara('qué lindo', PALABRAS), false);
  // «exacta»: el comentario entero es la palabra.
  assert.equal(comentarioDispara('  Fiesta! ', PALABRAS, 'exacta'), true);
  assert.equal(comentarioDispara('quiero fiesta', PALABRAS, 'exacta'), false);
  // Vacía = cualquier comentario (lo de siempre); con palabras y sin texto, no: un comentario ilegible no cae en «todos».
  assert.equal(comentarioDispara('lo que sea', []), true);
  assert.equal(comentarioDispara(null, null), true);
  assert.equal(comentarioDispara(null, PALABRAS), false);
  assert.equal(comentarioDispara('🎉🎉', PALABRAS), false);
  // ⚠️ EL EMOJI ES UNA PALABRA CLAVE (la revisión del Cerebro, 28/10): «🔥» se tiraba y el CRON arrancaba con CUALQUIERA.
  assert.equal(comentarioDispara('me encanta!! 🔥🔥', ['🔥']), true);
  assert.equal(comentarioDispara('qué lindo', ['🔥']), false, 'una palabra «🔥» no arranca con cualquier comentario');
  assert.equal(comentarioDispara('❤', ['❤️']), true, 'con o sin la variante');
  assert.equal(comentarioDispara('🔥', ['🔥'], 'exacta'), true);
  assert.equal(comentarioDispara('Fiesta 🎉', ['fiesta'], 'exacta'), true, 'con una palabra sin emoji, los emojis del comentario no cuentan');
  assert.equal(comentarioDispara('fiesta', ['fiesta 🎉'], 'exacta'), false, 'con una palabra CON emoji, sí');
  // Y una lista con palabras que no se pueden leer no dispara NUNCA (antes caía en «sin palabras»: cualquiera).
  assert.equal(comentarioDispara('lo que sea', ['!!', '¿?']), false);
});

test('la lista: sin vacías ni repetidas (por cómo se comparan), con tope; y lo que dice la tarjeta', () => {
  assert.deepEqual(sanearPalabras(['  fiesta ', 'FIESTA', 'Guía', 'guia', '', '!!', 3, 'dos   palabras']), ['fiesta', 'Guía', 'dos palabras']);
  assert.deepEqual(sanearPalabras(['🔥', '🔥', '❤️', '❤']), ['🔥', '❤️'], 'un emoji se guarda (sin repetirse)');
  assert.deepEqual(palabrasDeTexto('🔥, guía'), ['🔥', 'guía']);
  assert.equal(sanearPalabras(Array.from({ length: 40 }, (_, i) => `p${i}`)).length, TOPE_PALABRAS);
  assert.deepEqual(palabrasDeTexto('fiesta, guía,  , FIESTA'), ['fiesta', 'guía']);
  assert.equal(textoDePalabras(['fiesta', 'guía'], 'contiene'), 'con «fiesta» o «guía»');
  assert.equal(textoDePalabras(['a', 'b', 'c'], undefined), 'con «a», «b» o «c»');
  assert.equal(textoDePalabras(['pruebafm'], 'exacta'), 'que sea «pruebafm»');
  assert.equal(textoDePalabras([], 'exacta'), '');
});

const COMENTA = (extra: Partial<Disparador> = {}): Disparador => ({ id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario', palabras: ['fiesta', 'guía'], ...extra });

test('el CRON: las palabras en uno de comentario, de En vivo, de mensaje o de historia, y cuentan en la firma', () => {
  assert.deepEqual(sanearDisparador(COMENTA({ coincidencia: 'exacta' })), { id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario', palabras: ['fiesta', 'guía'], coincidencia: 'exacta' });
  // «contiene» es lo de siempre: no se guarda.
  assert.ok(!('coincidencia' in sanearDisparador(COMENTA({ coincidencia: 'contiene' }))!));
  // En un DM y en la respuesta a una historia SÍ (10/11/2026, «DM keyword» de ManyChat); en un anuncio o un ref, no: se va.
  assert.deepEqual(sanearDisparador(COMENTA({ subtipo: 'dm' }))!.palabras, ['fiesta', 'guía']);
  assert.deepEqual(sanearDisparador(COMENTA({ subtipo: 'historia' }))!.palabras, ['fiesta', 'guía']);
  assert.ok(!('palabras' in sanearDisparador(COMENTA({ subtipo: 'anuncio' }))!));
  assert.ok(!('palabras' in sanearDisparador(COMENTA({ subtipo: 'mencion' }))!), 'una mención no trae texto que comparar');
  assert.ok(!('palabras' in sanearDisparador({ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'nuevo', palabras: ['x'] } as Disparador)!));
  assert.equal(conPalabras('messenger', 'comentario'), true);
  assert.equal(conPalabras('instagram', 'en_vivo'), true);
  assert.notEqual(firmaDisparador(COMENTA()), firmaDisparador(COMENTA({ palabras: [] })), '«fiesta» no es lo mismo que cualquier comentario');
  assert.equal(firmaDisparador(COMENTA()), firmaDisparador(COMENTA({ palabras: ['Guía', 'FIESTA'] })), 'el orden y las mayúsculas no cambian el CRON');
});

test('⚠️ el PRIMER CRON se rearma de las columnas: sin llevarse las palabras de la lista, las perdía en cada lectura', () => {
  const fila = { trigger_tipo: 'instagram', etapa: '', etapas: null, funnel_id: null, producto_id: null, etiqueta_id: null, cron: null, cron_proxima_at: null, disparadores: [COMENTA({ coincidencia: 'exacta' })] };
  const [primero] = disparadoresDe(fila as Parameters<typeof disparadoresDe>[0]);
  assert.deepEqual([primero.palabras, primero.coincidencia], [['fiesta', 'guía'], 'exacta']);
});

test('el evento: arranca sólo si el comentario de ESTE evento tiene la palabra; sin palabras, como siempre', () => {
  const d = COMENTA();
  assert.equal(disparaPorEvento(d, 'instagram', { subtipo: 'comentario', texto: 'Quiero la guía 🙌' }), true);
  assert.equal(disparaPorEvento(d, 'instagram', { subtipo: 'comentario', texto: 'qué lindo' }), false);
  assert.equal(disparaPorEvento(d, 'instagram', { subtipo: 'comentario' }), false, 'sin el texto del comentario, no arranca');
  assert.equal(disparaPorEvento(COMENTA({ palabras: undefined }), 'instagram', { subtipo: 'comentario', texto: 'lo que sea' }), true, 'sin palabras, cualquier comentario');
  assert.equal(disparaPorEvento(COMENTA({ palabras: undefined }), 'instagram', { subtipo: 'comentario' }), true, 'lo de hoy no se rompe');
  // Un DM con palabras (10/11/2026): arranca sólo si ESTE mensaje las tiene; sin palabras, con cualquiera, como siempre.
  assert.equal(disparaPorEvento({ ...d, subtipo: 'dm' }, 'instagram', { subtipo: 'dm', texto: 'hola' }), false);
  assert.equal(disparaPorEvento({ ...d, subtipo: 'dm' }, 'instagram', { subtipo: 'dm', texto: 'Hola, quiero la GUIA' }), true);
  assert.equal(disparaPorEvento({ ...d, subtipo: 'dm', palabras: undefined }, 'instagram', { subtipo: 'dm', texto: 'hola' }), true);
  assert.equal(disparaPorEvento({ ...d, subtipo: 'dm' }, 'messenger', { subtipo: 'dm', texto: 'fiesta' }), false, 'un CRON de Instagram no escucha Messenger');
  assert.equal(disparaPorEvento({ ...d, trigger_tipo: 'messenger', subtipo: 'dm' }, 'messenger', { subtipo: 'dm', texto: 'fiesta' }), true);
  // «¿Hay quien escuche?» (antes de crear el lead) hace la MISMA pregunta.
  const sec: SecuenciaConDisparo = { id: 680, trigger_tipo: 'instagram', etapa: '', etapas: [], funnel_id: null, producto_id: null, etiqueta_id: null, cron: null, cron_proxima_at: null, disparadores: [d] };
  assert.equal(escuchaElEvento([sec], 'instagram', { subtipo: 'comentario', texto: 'FIESTA!' }), true);
  assert.equal(escuchaElEvento([sec], 'instagram', { subtipo: 'comentario', texto: 'hola' }), false, 'no crea el lead de quien comentó otra cosa');
  // La tarjeta CRON lo dice.
  assert.match(textoDeDisparador(d, { deSiempre: () => '', tz: 'America/Argentina/Buenos_Aires' } as Parameters<typeof textoDeDisparador>[1]), /comenta tu publicación o Reel con «fiesta» o «guía»$/);
});

test('el cableado: lo que COMENTÓ llega del webhook al motor, y la pantalla guarda al salir de la caja', () => {
  const ze = leer('lib/zernio-entrante.ts');
  // (Y la publicación del comentario, ticket #25: tests/comentario-publicacion.test.ts.)
  assert.match(ze, /escuchaElEvento\(await getSecuenciasActivas\(\), canal, \{ subtipo: sub, texto: texto \?\? null, publicacion: publicacion \?\? null \}\)/);
  assert.match(ze, /enrolarPorEvento\(leadId, canal, \{ subtipo: sub, texto: texto \?\? null, publicacion: publicacion \?\? null \}\)/);
  assert.match(ze, /hayQuienEscuche\(e\.canal, e\.subtipo, e\.texto, e\.postId\)/);
  assert.match(leer('app/api/webhooks/zernio/route.ts'), /dispararEventoSocial\(leadId, canal, subtipo, ev\.evento\.texto, ev\.evento\.postId\)/);
  assert.match(leer('lib/nutricion.ts'), /disparaPorEvento\(s\.disparador, evento, ctx\)/, 'el motor le pasa el ctx entero (con el texto)');
  const ed = leer('app/automations/EditorDisparadores.tsx');
  assert.match(ed, /\{conPalabras\(d\.trigger_tipo, d\.subtipo\) && \(\s*<PalabrasClave/);
  assert.match(ed, /onChange=\{\(e\) => setTexto\(e\.target\.value\)\}\s*onBlur=\{\(\) => guardar\(texto, coincidencia\)\}/, 'escribir no guarda; salir de la caja, sí');
  const def = porId('cambiar_crons_secuencia')!;
  const campos = (def.parametros.find((p) => p.nombre === 'crons') as { campos?: Array<{ nombre: string }> }).campos ?? [];
  assert.ok(campos.some((c) => c.nombre === 'palabras') && campos.some((c) => c.nombre === 'coincidencia'), 'la API (y MaKo por WhatsApp) las puede poner');
});

test('⚠️ una palabra que NO SE LEE («?», «...») no se tira callada: la pantalla y la ruta la rechazan, y la API dice las palabras', () => {
  // La revisión del Cerebro (28/10/2026): «?» se descartaba al sanear y, si era la única, el CRON quedaba para CUALQUIER
  // comentario: respondía en público y por DM a todos. El emoji sí se lee (es una palabra clave, como en ManyChat).
  assert.equal(problemaDePalabras(['🔥']), null);
  assert.equal(problemaDePalabras(['🔥', 'fiesta']), null);
  assert.equal(problemaDePalabras(['👍🏽']), null, 'con tono de piel también');
  assert.equal(problemaDePalabras([]), null, 'vacía = cualquier comentario, a propósito');
  assert.equal(problemaDePalabras(['fiesta', ' ']), null, 'una coma de más no es una palabra');
  assert.deepEqual(palabrasQueNoSeLeen(['?', 'fiesta', '...']), ['?', '...']);
  assert.match(problemaDePalabras(['?']) ?? '', /^«\?» no es una palabra clave: usa letras, números o un emoji$/);
  assert.match(problemaDePalabras(['?', '!!']) ?? '', /no son palabras clave/);
  // La ruta (y la API, que prepara con la misma) lo mira en lo que LLEGÓ, antes de sanear: después ya no está.
  const g = leer('lib/disparadores-guardar.ts');
  const lv = g.slice(g.indexOf('function listaValida('), g.indexOf('function listaValida(') + 900);
  assert.ok(lv.indexOf('problemaDePalabras(') > 0 && lv.indexOf('problemaDePalabras(') < lv.indexOf('sanearDisparadores(entrada)'), 'listaValida rechaza antes de sanear');
  assert.match(lv, /if \(p\) throw new TriggerInvalidoError/);
  // La pantalla: lo dice y NO guarda (guardar la lista vacía era «cualquier comentario»).
  const ed = leer('app/automations/EditorDisparadores.tsx');
  assert.match(ed, /const problema = problemaDePalabras\(t\.split\(','\)\);\s*setNoSeLee\(problema\);\s*if \(problema\) return;/);
  assert.match(ed, /\{noSeLee && <div role="status"/);
  // El resumen que se confirma por WhatsApp nombra las palabras («fiesta» y ninguna ya no se leen igual).
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  const tc = run.slice(run.indexOf('function textoDeUnCron('), run.indexOf('function textoDeUnCron(') + 1200);
  // (Con la publicación en el medio, ticket #25: «… o Reel «La guía» con «fiesta»».)
  assert.match(tc, /const palabras = conPalabras\(d\.trigger_tipo, d\.subtipo\) \? textoDePalabras\(d\.palabras, d\.coincidencia\) : '';[\s\S]*?return \[evento, publicacion, palabras\]\.filter\(Boolean\)\.join\(' '\);/);
});
