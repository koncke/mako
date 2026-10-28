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
// texto → 5 / 1; la pantalla guarda en cada tecla → 5 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comentarioDispara, normalizarComentario, sanearPalabras, textoDePalabras, palabrasDeTexto, TOPE_PALABRAS } from '../lib/palabras-clave';
import {
  sanearDisparador, disparadoresDe, firmaDisparador, disparaPorEvento, escuchaElEvento, textoDeDisparador, conPalabras,
  type Disparador, type SecuenciaConDisparo,
} from '../lib/disparadores';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

test('cómo se compara: sin mayúsculas, sin acentos, sin signos ni emojis; «contiene» es la palabra entera', () => {
  assert.equal(normalizarComentario('¡GUÍA, por favor! 🎉'), 'guia por favor');
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
});

test('la lista: sin vacías ni repetidas (por cómo se comparan), con tope; y lo que dice la tarjeta', () => {
  assert.deepEqual(sanearPalabras(['  fiesta ', 'FIESTA', 'Guía', 'guia', '', '!!', 3, 'dos   palabras']), ['fiesta', 'Guía', 'dos palabras']);
  assert.equal(sanearPalabras(Array.from({ length: 40 }, (_, i) => `p${i}`)).length, TOPE_PALABRAS);
  assert.deepEqual(palabrasDeTexto('fiesta, guía,  , FIESTA'), ['fiesta', 'guía']);
  assert.equal(textoDePalabras(['fiesta', 'guía'], 'contiene'), 'con «fiesta» o «guía»');
  assert.equal(textoDePalabras(['a', 'b', 'c'], undefined), 'con «a», «b» o «c»');
  assert.equal(textoDePalabras(['pruebafm'], 'exacta'), 'que sea «pruebafm»');
  assert.equal(textoDePalabras([], 'exacta'), '');
});

const COMENTA = (extra: Partial<Disparador> = {}): Disparador => ({ id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario', palabras: ['fiesta', 'guía'], ...extra });

test('el CRON: las palabras sólo en uno de comentario, y cuentan en la firma', () => {
  assert.deepEqual(sanearDisparador(COMENTA({ coincidencia: 'exacta' })), { id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario', palabras: ['fiesta', 'guía'], coincidencia: 'exacta' });
  // «contiene» es lo de siempre: no se guarda.
  assert.ok(!('coincidencia' in sanearDisparador(COMENTA({ coincidencia: 'contiene' }))!));
  // En un DM, un filtro que nadie ve: se va.
  assert.ok(!('palabras' in sanearDisparador(COMENTA({ subtipo: 'dm' }))!));
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
  // Un DM no mira palabras (aunque una fila vieja las traiga).
  assert.equal(disparaPorEvento({ ...d, subtipo: 'dm' }, 'instagram', { subtipo: 'dm', texto: 'hola' }), true);
  // «¿Hay quien escuche?» (antes de crear el lead) hace la MISMA pregunta.
  const sec: SecuenciaConDisparo = { id: 680, trigger_tipo: 'instagram', etapa: '', etapas: [], funnel_id: null, producto_id: null, etiqueta_id: null, cron: null, cron_proxima_at: null, disparadores: [d] };
  assert.equal(escuchaElEvento([sec], 'instagram', { subtipo: 'comentario', texto: 'FIESTA!' }), true);
  assert.equal(escuchaElEvento([sec], 'instagram', { subtipo: 'comentario', texto: 'hola' }), false, 'no crea el lead de quien comentó otra cosa');
  // La tarjeta CRON lo dice.
  assert.match(textoDeDisparador(d, { deSiempre: () => '', tz: 'America/Argentina/Buenos_Aires' } as Parameters<typeof textoDeDisparador>[1]), /comenta tu publicación o Reel con «fiesta» o «guía»$/);
});

test('el cableado: lo que COMENTÓ llega del webhook al motor, y la pantalla guarda al salir de la caja', () => {
  const ze = leer('lib/zernio-entrante.ts');
  assert.match(ze, /escuchaElEvento\(await getSecuenciasActivas\(\), canal, \{ subtipo: sub, texto: texto \?\? null \}\)/);
  assert.match(ze, /enrolarPorEvento\(leadId, canal, \{ subtipo: sub, texto: texto \?\? null \}\)/);
  assert.match(ze, /hayQuienEscuche\(e\.canal, e\.subtipo, e\.texto\)/);
  assert.match(leer('app/api/webhooks/zernio/route.ts'), /dispararEventoSocial\(leadId, canal, subtipo, ev\.evento\.texto\)/);
  assert.match(leer('lib/nutricion.ts'), /disparaPorEvento\(s\.disparador, evento, ctx\)/, 'el motor le pasa el ctx entero (con el texto)');
  const ed = leer('app/automations/EditorDisparadores.tsx');
  assert.match(ed, /\{conPalabras\(d\.trigger_tipo, d\.subtipo\) && \(\s*<PalabrasClave/);
  assert.match(ed, /onChange=\{\(e\) => setTexto\(e\.target\.value\)\}\s*onBlur=\{\(\) => guardar\(texto, coincidencia\)\}/, 'escribir no guarda; salir de la caja, sí');
  const def = porId('cambiar_crons_secuencia')!;
  const campos = (def.parametros.find((p) => p.nombre === 'crons') as { campos?: Array<{ nombre: string }> }).campos ?? [];
  assert.ok(campos.some((c) => c.nombre === 'palabras') && campos.some((c) => c.nombre === 'coincidencia'), 'la API (y MaKo por WhatsApp) las puede poner');
});
