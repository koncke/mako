// =============================================================================
// Los subtítulos estilo Submagic (Video Editor, 10/11/2026)
// =============================================================================
// Pedido de Martín (9/11/2026): «duplicar Submagic para el tema de los subtítulos». Lo que se copió y de dónde
// (el sitio, el blog y la documentación de Submagic) está en docs/editor-video/relevo-submagic.md. Lo que falla SIN
// error, y por eso se prueba acá ejecutando el código:
//
//   1. LA PALABRA QUE SE DICE salta («pop», de abajo hacia arriba) o crece, con o sin el color del karaoke, y su
//      forma va por una TABLA: el dibujo del texto se vuelve a hacer sólo al cambiar de renglón de la tabla.
//   2. LAS CLAVES se agrandan («más grandes», como las de Hormozi) y se marcan o desmarcan A MANO una por una.
//   3. LAS PLANTILLAS «Hormozi» y «Hormozi clásico» llevan su animación, y cambiar a otra la saca.
//   4. LOS PRESETS guardan la animación y el tamaño de las claves, saneados, y la API los cambia por nombre.
//   5. LOS EMOJIS AUTOMÁTICOS: uno por subtítulo que dice algo que se puede dibujar, no dos iguales seguidos, en su
//      pista, y apagarlos saca SÓLO los suyos (un sticker que puso la persona no se toca).
//   6. EL CHAT Y LA API: «animar_palabras», las claves a mano y «emojis_subtitulos» se revisan contra lo que hay.
//
// Correr: node --import tsx --test tests/video-editor-subtitulos-submagic.test.ts
// Probado rompiéndolo: el resultado de cada rotura está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alternarClave, leerClaves, PARAM_CLAVES, quitarClaves, sumarClaves } from '../lib/editor-video/claves';
import { CURVA_POP, ESCALA_CRECER, formaDeAnim, formaDePalabra, resaltadoDe } from '../app/video-editor/_opencut/text/resaltado';
import {
  DEFAULTS_CLAVES, PARAM_ANIM_PALABRA, PARAM_CLAVES_TAMANO, PARAM_RESALTAR, TOPES_CLAVES_TAMANO,
} from '../app/video-editor/_opencut/params/extra/subtitulos';
import { codificarPalabras, PARAM_PALABRAS } from '../app/video-editor/_opencut/subtitles/palabras';
import { paramsDePlantilla, plantillaDeParams, PLANTILLAS_SUBTITULO } from '../app/video-editor/_opencut/subtitles/estilos';
import { presetDesdeApi, resumenPreset, sanearPreset, type PresetSubtitulos } from '../lib/editor-video/presets-subtitulos';
import {
  elegirEmojis, emojiDePalabra, emojiDeSubtitulo, NOMBRE_PISTA_EMOJIS, PARAM_EMOJI_DE, posicionDelEmoji, SEPARACION_S, TAMANO_EMOJI,
} from '../app/video-editor/_opencut/subtitles/emojis';
import { armarEmojis, conEmojis, cuantosEmojis, sinEmojis } from '../app/video-editor/_opencut/subtitles/emojis-pista';
import { validarOperacion, catalogoParaPrompt, NO_SE_PUEDE_CHAT } from '../lib/editor-video/chat-catalogo';
import { operacionApiPorId, operacionDesdeInput } from '../lib/editor-video/chat-api';
import { vistaDeLinea, revisarOperaciones } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import type { SceneTracks, StickerElement, TextElement } from '../app/video-editor/_opencut/timeline/types';
import { DEFS as DEFS_VIDEO } from '../lib/api-mako/areas/video.def';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Perezosa (AGENTS.md: lo que puede tirar no va en una constante del módulo). */
const palabras = () => codificarPalabras({
  palabras: [
    { texto: 'compra', inicio: 0.1, fin: 0.4 },
    { texto: 'hoy', inicio: 0.5, fin: 0.7 },
    { texto: 'gratis', inicio: 0.8, fin: 1.2 },
  ],
  origen: 0,
  precision: 'palabra',
});

// ── 1: la palabra que se dice ────────────────────────────────────────────────

test('1: «pop» va por la tabla (entra chica y abajo, se pasa y se asienta); «crecer» queda grande; «ninguna», igual', () => {
  assert.deepEqual(formaDeAnim('pop', 0), { escala: CURVA_POP[0].escala, subida: CURVA_POP[0].subida });
  assert.ok(CURVA_POP[0].escala < 1 && CURVA_POP[0].subida > 0, 'entra más chica y más abajo');
  assert.deepEqual(formaDeAnim('pop', 85), { escala: CURVA_POP[2].escala, subida: 0 }, 'se pasa');
  assert.deepEqual(formaDeAnim('pop', 2000), { escala: CURVA_POP.at(-1)!.escala, subida: 0 }, 'se asienta apenas más grande');
  assert.ok(CURVA_POP.at(-1)!.escala > 1);
  assert.deepEqual(formaDeAnim('crecer', 0), { escala: ESCALA_CRECER, subida: 0 });
  assert.deepEqual(formaDeAnim('ninguna', 50), { escala: 1, subida: 0 });
  // CUANTIZADO: entre 0 y 3 s sólo salen los renglones de la tabla, nunca un valor intermedio.
  const vistas = new Set<string>();
  for (let ms = 0; ms <= 3000; ms += 3) { const f = formaDeAnim('pop', ms); vistas.add(`${f.escala}/${f.subida}`); }
  assert.equal(vistas.size, CURVA_POP.length, `formas distintas: ${[...vistas].join(' · ')}`);
});

test('1b: sin karaoke, la animación igual sabe cuál se dice, y nada se atenúa ni cambia de color', () => {
  const r = resaltadoDe({ params: { content: 'compra hoy gratis', [PARAM_PALABRAS]: palabras(), [PARAM_ANIM_PALABRA]: 'pop' }, tiempo: 0.55, recorteInicio: 0 })!;
  assert.ok(r, 'sin karaoke ni claves, con animación, NO es null');
  assert.equal(r.modo, 'ninguno', 'sin color de karaoke');
  assert.equal(r.actual, 1, '«hoy» se está diciendo');
  assert.equal(r.dichas, 3, 'todo cuenta como dicho: nada se atenúa');
  assert.equal(r.noDichas, 1);
  assert.equal(r.anim, 'pop');
  assert.deepEqual(formaDePalabra(r, 1), { escala: r.escalaActual, subida: r.subidaActual }, 'la que se dice, con su forma');
  assert.deepEqual(formaDePalabra(r, 0), { escala: 1, subida: 0 }, 'la de antes, igual');
  // Con karaoke y animación: la forma es la misma; el karaoke sigue atenuando lo que falta.
  const k = resaltadoDe({ params: { content: 'compra hoy gratis', [PARAM_PALABRAS]: palabras(), [PARAM_ANIM_PALABRA]: 'crecer', [PARAM_RESALTAR]: 'palabra' }, tiempo: 0.9, recorteInicio: 0 })!;
  assert.equal(k.modo, 'palabra');
  assert.equal(k.actual, 2);
  assert.equal(k.escalaActual, ESCALA_CRECER);
  // Sin tiempos por palabra (un .srt), la animación no tiene qué animar y no inventa: el camino de siempre.
  assert.equal(resaltadoDe({ params: { content: 'compra hoy gratis', [PARAM_ANIM_PALABRA]: 'pop' }, tiempo: 0.5, recorteInicio: 0 }), null);
  // Un valor que no existe no anima.
  assert.equal(resaltadoDe({ params: { content: 'compra hoy gratis', [PARAM_PALABRAS]: palabras(), [PARAM_ANIM_PALABRA]: 'girar' }, tiempo: 0.5, recorteInicio: 0 }), null);
});

// ── 2: las claves ────────────────────────────────────────────────────────────

test('2: las claves se agrandan (con tope); si la que se dice es clave, gana la más grande', () => {
  const p = (tamano: unknown) => ({ content: 'compra hoy gratis', [PARAM_CLAVES]: 'gratis', [PARAM_CLAVES_TAMANO]: tamano });
  const r = resaltadoDe({ params: p(130), tiempo: 0, recorteInicio: 0 })!;
  assert.equal(r.clavesEscala, 1.3);
  assert.deepEqual(formaDePalabra(r, 2), { escala: 1.3, subida: 0 }, 'la clave, más grande');
  assert.deepEqual(formaDePalabra(r, 0), { escala: 1, subida: 0 });
  assert.equal(resaltadoDe({ params: p(900), tiempo: 0, recorteInicio: 0 })!.clavesEscala, TOPES_CLAVES_TAMANO.max / 100, 'topado arriba');
  assert.equal(resaltadoDe({ params: p(20), tiempo: 0, recorteInicio: 0 })!.clavesEscala, 1, 'nunca más chica que el resto');
  assert.equal(resaltadoDe({ params: p('x'), tiempo: 0, recorteInicio: 0 })!.clavesEscala, DEFAULTS_CLAVES.tamano / 100);
  const ambas = resaltadoDe({ params: { ...p(150), [PARAM_PALABRAS]: palabras(), [PARAM_ANIM_PALABRA]: 'crecer' }, tiempo: 1, recorteInicio: 0 })!;
  assert.equal(ambas.actual, 2);
  assert.equal(formaDePalabra(ambas, 2).escala, 1.5, 'clave y dicha: gana la más grande');
});

test('2b: marcar y desmarcar UNA palabra a mano; sumar y quitar no tocan las demás', () => {
  assert.equal(alternarClave('hoy', '¡GRATIS!'), 'hoy|gratis', 'se marca normalizada');
  assert.equal(alternarClave('hoy|gratis', 'Gratis'), 'hoy', 'la misma, otra vez: se desmarca');
  assert.equal(alternarClave('hoy', '¡!'), 'hoy', 'nada que marcar: queda igual');
  assert.deepEqual(sumarClaves('hoy', 'compra hoy gratis', ['GRATIS', 'mañana']), ['hoy', 'gratis'], 'sólo las que se dicen');
  assert.deepEqual(quitarClaves('hoy|gratis', ['HOY']), ['gratis']);
  assert.deepEqual(leerClaves(alternarClave(undefined, 'Compra')), ['compra']);
});

// ── 3: las plantillas ────────────────────────────────────────────────────────

const LIENZO = { width: 1080, height: 1920 };

test('3: «Hormozi» salta y agranda las claves; «Hormozi clásico» crece con karaoke; cambiar a otra las saca', () => {
  const hormozi = PLANTILLAS_SUBTITULO.find((p) => p.id === 'hormozi')!;
  const clasico = PLANTILLAS_SUBTITULO.find((p) => p.id === 'hormozi-clasico')!;
  assert.ok(hormozi && clasico, 'las dos plantillas');
  const ph = paramsDePlantilla(hormozi, LIENZO);
  assert.equal(ph[PARAM_ANIM_PALABRA], 'pop');
  assert.equal(ph[PARAM_CLAVES_TAMANO], 120);
  const pc = paramsDePlantilla(clasico, LIENZO);
  assert.equal(pc[PARAM_ANIM_PALABRA], 'crecer');
  assert.equal(pc[PARAM_RESALTAR], 'palabra');
  // Las otras escriben «ninguna» y el tamaño de siempre: «Clásico» después de «Hormozi» no deja la palabra saltando.
  const otra = paramsDePlantilla(PLANTILLAS_SUBTITULO[0], LIENZO);
  assert.equal(otra[PARAM_ANIM_PALABRA], 'ninguna');
  assert.equal(otra[PARAM_CLAVES_TAMANO], DEFAULTS_CLAVES.tamano);
  // Ida y vuelta: el subtítulo leído como plantilla trae la animación y el tamaño.
  const vuelta = plantillaDeParams(ph, LIENZO);
  assert.equal(vuelta.animPalabra, 'pop');
  assert.equal(vuelta.clavesTamano, 120);
  assert.equal(plantillaDeParams(otra, LIENZO).animPalabra, undefined);
});

// ── 4: los presets ───────────────────────────────────────────────────────────

const AHORA = '2026-11-10T12:00:00.000Z';
const preset = (estilo: Record<string, unknown> = {}) => ({
  nombre: 'Salta', marca: null, estilo: { fuente: 'Anton', negrita: false, color: '#ffffff', ...estilo },
  claves: { auto: false, color: '#22c55e', siempre: [] },
});

test('4: un preset guarda la animación y el tamaño de las claves, saneados; la API los cambia por nombre', () => {
  const ok = sanearPreset(preset({ animPalabra: 'pop', clavesTamano: 130 }), { id: 'pabc12', ahora: AHORA });
  assert.ok(ok.ok, !ok.ok ? ok.motivo : '');
  if (!ok.ok) return;
  assert.equal(ok.valor.estilo.animPalabra, 'pop');
  assert.equal(ok.valor.estilo.clavesTamano, 130);
  assert.match(resumenPreset(ok.valor), /la palabra que se dice salta · palabras clave al 130 %/);
  const malo = (e: Record<string, unknown>) => sanearPreset(preset(e), { id: 'pabc12', ahora: AHORA });
  assert.equal(malo({ animPalabra: 'girar' }).ok, false, 'una animación que no existe se rechaza');
  assert.equal(malo({ clavesTamano: 300 }).ok, false, 'fuera de 100 a 160 se rechaza, no se recorta');
  const s = (x: ReturnType<typeof sanearPreset>) => (x.ok ? x.valor : null) as PresetSubtitulos | null;
  assert.equal(s(malo({ animPalabra: 'ninguna' }))!.estilo.animPalabra, undefined, '«ninguna» no se guarda');
  assert.equal(s(malo({ clavesTamano: 100 }))!.estilo.clavesTamano, undefined, '100 es el de siempre: no se guarda');
  // La API: «animacion_palabra» y «tamano_claves»; «ninguna» y 100 los sacan; lo demás queda.
  const cambiado = s(sanearPreset(presetDesdeApi({ animacion_palabra: 'crecer', tamano_claves: 150 }, ok.valor), { id: 'pabc12', ahora: AHORA }))!;
  assert.equal(cambiado.estilo.animPalabra, 'crecer');
  assert.equal(cambiado.estilo.clavesTamano, 150);
  assert.equal(cambiado.estilo.fuente, 'Anton');
  const sacado = s(sanearPreset(presetDesdeApi({ animacion_palabra: 'ninguna', tamano_claves: 100 }, ok.valor), { id: 'pabc12', ahora: AHORA }))!;
  assert.equal(sacado.estilo.animPalabra, undefined);
  assert.equal(sacado.estilo.clavesTamano, undefined);
  assert.equal(sanearPreset(presetDesdeApi({ animacion_palabra: 'girar' }, ok.valor), { id: 'pabc12', ahora: AHORA }).ok, false, 'por la API tampoco');
});

// ── 5: los emojis automáticos ────────────────────────────────────────────────

test('5: un emoji sólo para lo que se puede dibujar, por la raíz y sin agarrar de más', () => {
  assert.equal(emojiDePalabra('Dinero'), '💰');
  assert.equal(emojiDePalabra('¡GRATIS!'), '🎁');
  assert.equal(emojiDePalabra('ideas'), '💡');
  assert.equal(emojiDePalabra('automatizar'), null, '«auto$» es la palabra entera: no agarra «automatizar»');
  assert.equal(emojiDePalabra('auto'), '🚗');
  assert.equal(emojiDePalabra('anotar'), null, '«año$» sin tilde es «ano»: no agarra «anotar»');
  assert.equal(emojiDePalabra('año'), '📅');
  assert.equal(emojiDePalabra('mesa'), null, '«mesa» no es un mes');
  assert.equal(emojiDePalabra('planta'), null, '«planta» no es un plan');
  assert.equal(emojiDePalabra('ganas'), null, '«ganas» no es ganar');
  assert.equal(emojiDePalabra('ya'), null, 'menos de 3 letras, nada');
  assert.equal(emojiDeSubtitulo('y entonces lo vi'), null, 'relleno: ninguno');
  assert.equal(emojiDeSubtitulo('Tu tiempo vale dinero'), '⏰', 'sin clave, la primera que tiene');
  assert.equal(emojiDeSubtitulo('Tu tiempo vale dinero', ['dinero']), '💰', 'la clave gana');
});

test('5b: elegir: separados SEPARACION_S y nunca el mismo dos seguidos', () => {
  const sub = (texto: string, inicio: number) => ({ texto, inicio, fin: inicio + 1.5 });
  const r = elegirEmojis([
    sub('Gana dinero', 0),
    sub('una idea', 1),            // otro emoji, pero 1 s después: muy cerca
    sub('y entonces lo vi', 3),     // relleno
    sub('dinero otra vez', 4),      // lejos, pero el anterior con emoji fue el mismo… no seguido (hay uno en medio)
    sub('dinero de nuevo', 7),      // el de justo antes tiene el mismo emoji: fuera
    sub('una idea clave', 10),
  ]);
  assert.deepEqual(r.map((x) => [x.indice, x.emoji]), [[0, '💰'], [3, '💰'], [5, '💡']]);
  assert.ok(SEPARACION_S > 1 && SEPARACION_S < 5);
  // Encima del subtítulo: más arriba que su centro, del tamaño de TAMANO_EMOJI.
  const pos = posicionDelEmoji({ x: 10, y: 500, renglones: 2, pxLetra: 60, lienzo: { width: 1080, height: 1920 } });
  assert.equal(pos.x, 10);
  assert.ok(pos.y < 500 - 60, `arriba del primer renglón: ${pos.y}`);
  assert.equal(pos.escala, TAMANO_EMOJI);
});

const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);
const subtitulo = (id: string, ini: number, dur: number, content: string, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'text', name: id, startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: { content, subtitulo: true, fontSize: 15, 'transform.positionX': 0, 'transform.positionY': 600, ...extra } }) as unknown as TextElement;
const BASE_STICKER = { 'transform.positionX': 0, 'transform.positionY': 0, 'transform.scaleX': 1, 'transform.scaleY': 1, 'transform.rotate': 0, opacity: 1 };
let n = 0;
const nuevoId = () => `id${++n}`;

function escena(conEmojisDeAntes = false): SceneTracks {
  const subs = [
    subtitulo('s1', 0, 2, 'Gana dinero hoy'),
    subtitulo('s2', 2, 2, 'y entonces lo vi'),
    subtitulo('s3', 4, 2, 'una idea brutal', { [PARAM_CLAVES]: 'brutal' }),
  ];
  const deLaPersona = { id: 'mio', type: 'sticker', name: 'Mi sticker', stickerId: 'emojis:1f600', intrinsicWidth: 512, intrinsicHeight: 512, startTime: 0, duration: t(1), trimStart: 0, trimEnd: 0, params: { ...BASE_STICKER } };
  const viejo = { ...deLaPersona, id: 'viejo', name: 'Emoji 💰', params: { ...BASE_STICKER, [PARAM_EMOJI_DE]: 's1' } };
  return {
    overlay: [
      ...(conEmojisDeAntes ? [{ id: 'pe', type: 'graphic', name: NOMBRE_PISTA_EMOJIS, hidden: false, elements: [viejo] }] : []),
      { id: 'pg', type: 'graphic', name: 'Gráficos', hidden: false, elements: [deLaPersona] },
      { id: 'ps', type: 'text', name: 'Subs', hidden: false, elements: subs },
    ],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [] },
    audio: [],
  } as unknown as SceneTracks;
}
const subsDe = (s: SceneTracks) => (s.overlay.find((x) => x.id === 'ps')!.elements as TextElement[]);

test('5c: armar: un sticker de Emojis por subtítulo elegido, con SU tiempo, su marca y la entrada «Rebote»', () => {
  const s = escena();
  const emojis = armarEmojis({ subtitulos: subsDe(s), tps: TPS, lienzo: { width: 1080, height: 1920 }, paramsBase: BASE_STICKER, nuevoId });
  assert.deepEqual(emojis.map((e) => e.params[PARAM_EMOJI_DE]), ['s1', 's3'], 'el de relleno, sin emoji');
  const [a, b] = emojis;
  assert.equal(a.type, 'sticker');
  assert.equal(a.stickerId, 'emojis:1f4b0', '💰 por Stickers › Emojis');
  assert.equal(b.stickerId, 'emojis:1f525', '🔥: la clave «brutal» gana a «idea»');
  assert.equal(a.startTime, subsDe(s)[0].startTime);
  assert.equal(a.duration, subsDe(s)[0].duration);
  assert.ok(Number(a.params['transform.positionY']) < 600, 'encima del subtítulo');
  assert.equal(a.params['transform.scaleX'], TAMANO_EMOJI);
  const conAnim = Object.entries(a.params).filter(([k, v]) => /anim/i.test(k) && v === 'rebote');
  assert.ok(conAnim.length >= 1, `con la entrada «Rebote»: ${JSON.stringify(a.params)}`);
});

test('5d: ponerlos en su pista arriba de todo, reemplazar los de antes, y sacar SÓLO los suyos', () => {
  const s = escena(true);
  assert.equal(cuantosEmojis(s), 1, 'el viejo (el de la persona no cuenta)');
  const emojis = armarEmojis({ subtitulos: subsDe(s), tps: TPS, lienzo: { width: 1080, height: 1920 }, paramsBase: BASE_STICKER, nuevoId });
  const con = conEmojis({ tracks: s, emojis, nuevoId });
  assert.equal(con.overlay[0].name, NOMBRE_PISTA_EMOJIS, 'la pista de los emojis, arriba');
  assert.equal(con.overlay[0].type, 'graphic');
  assert.equal(cuantosEmojis(con), 2, 'prender dos veces no duplica: el viejo se reemplazó');
  assert.ok(!(con.overlay[0].elements as StickerElement[]).some((e) => e.id === 'viejo'));
  assert.ok((con.overlay.find((x) => x.id === 'pg')!.elements as StickerElement[]).some((e) => e.id === 'mio'), 'el de la persona, intacto');
  const sin = sinEmojis(con);
  assert.equal(cuantosEmojis(sin), 0);
  assert.ok(!sin.overlay.some((x) => x.name === NOMBRE_PISTA_EMOJIS), 'la pista vacía se va');
  assert.ok((sin.overlay.find((x) => x.id === 'pg')!.elements as StickerElement[]).some((e) => e.id === 'mio'), 'el de la persona sigue');
  const limpia = escena();
  assert.equal(sinEmojis(limpia), limpia, 'sin nada que sacar: el mismo objeto (no deja un paso de deshacer vacío)');
});

test('5e: la pestaña Subtítulos y el interruptor de «Subtítulos automáticos» ponen los emojis por la MISMA función', () => {
  const vista = sinComentarios(leer('app/video-editor/_opencut/subtitles/components/assets-view.tsx'));
  assert.match(vista, /rotulo="Emojis automáticos" activo=\{prefs\.emojis\}/, 'el interruptor anda (ya no «Próximamente»)');
  assert.doesNotMatch(vista, /Emojis de IA/);
  const generar = sinComentarios(leer('app/video-editor/_opencut/subtitles/generar.ts'));
  assert.match(generar, /if \(prefs\.emojis\) ponerEmojisEnSubtitulos\(\{ editor, activar: true \}\)/);
  const pestana = sinComentarios(leer('app/video-editor/_opencut/subtitles/components/pestana-subtitulos.tsx'));
  assert.match(pestana, /<EmojisSubtitulos \/>/, 'la sección «Emojis» se dibuja');
  assert.match(pestana, /ponerEmojisEnSubtitulos\(\{ editor, activar: v \}\)/);
  const aplicar = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  assert.match(aplicar, /ponerEmojisEnSubtitulos\(\{ editor, activar: r\.activar \}\)/, 'el chat, la misma');
});

// ── 6: el chat y la API ──────────────────────────────────────────────────────

const DISP = { ...disponiblesDelMotor(), presets: [], palabrasDeMarca: [] };
const vistaChat = (s = escena()) => vistaDeLinea({ tracks: s, tps: TPS, cabezal: 0, elegidos: [], disponibles: DISP, lienzo: { ancho: 1080, alto: 1920 } });
const revisar = (operaciones: unknown[], s?: SceneTracks) => revisarOperaciones({ operaciones: operaciones as never, vista: vistaChat(s), alcance: 'video' });

test('6: la forma de las operaciones nuevas', () => {
  const v = validarOperacion;
  assert.deepEqual(v({ op: 'emojis_subtitulos', activar: true }), { ok: true, op: { op: 'emojis_subtitulos', activar: true } });
  assert.equal(v({ op: 'emojis_subtitulos' }).ok, false, 'sin «activar»');
  assert.equal(v({ op: 'emojis_subtitulos', activar: 'si' }).ok, false);
  assert.equal(v({ op: 'emojis_subtitulos', activar: true, emoji: '💰' }).ok, false, 'el emoji no lo elige la IA');
  assert.deepEqual(v({ op: 'animar_palabras', animacion: 'pop' }), { ok: true, op: { op: 'animar_palabras', animacion: 'pop' } });
  assert.equal(v({ op: 'animar_palabras', animacion: 'girar' }).ok, false);
  assert.equal(v({ op: 'palabras_clave', modo: 'sumar', palabras: ['gratis'] }).ok, true);
  assert.equal(v({ op: 'palabras_clave', modo: 'quitar', palabras: ['gratis'] }).ok, true);
  assert.equal(v({ op: 'palabras_clave', modo: 'sumar' }).ok, false, '«sumar» sin palabras');
  assert.equal(v({ op: 'palabras_clave', modo: 'auto', tamano: 130 }).ok, true);
  assert.equal(v({ op: 'palabras_clave', modo: 'auto', tamano: 200 }).ok, false);
  const cat = catalogoParaPrompt();
  assert.ok(cat.includes('"op":"emojis_subtitulos"') && cat.includes('"op":"animar_palabras"'));
  assert.match(NO_SE_PUEDE_CHAT, /emojis encima de los subtítulos, sí: emojis_subtitulos/);
});

test('6b: los emojis se resuelven al FINAL (después de generar y de los silencios) y se revisan contra lo que hay', () => {
  const r = revisar([{ op: 'emojis_subtitulos', activar: true }]);
  assert.deepEqual(r.resueltas.map((x) => x.op), ['emojis_subtitulos']);
  // comandos.ts carga el motor (wasm): se lee su lista. Larga = va después del lote, como el B-roll.
  const largas = sinComentarios(leer('app/video-editor/_opencut/chat/comandos.ts')).match(/const LARGAS = new Set<[^>]+>\(\[([^\]]+)\]\)/)?.[1] ?? '';
  assert.ok(largas.length > 20, 'se encontró LARGAS');
  assert.match(largas, /"emojis_subtitulos"/, 'va después del lote, como el B-roll');
  // Sin subtítulos: se dice; pero con «generar_subtitulos» en el mismo pedido, sí (y va después).
  const vacia = escena();
  vacia.overlay = vacia.overlay.filter((x) => x.id !== 'ps');
  vacia.main = { ...vacia.main, elements: [{ id: 'v1', type: 'video', name: 'clip', mediaId: 'm1', startTime: 0, duration: t(6), trimStart: 0, trimEnd: 0, params: {} }] } as unknown as SceneTracks['main'];
  const sinSubs = revisar([{ op: 'emojis_subtitulos', activar: true }], vacia);
  assert.equal(sinSubs.resueltas.length, 0);
  assert.match(sinSubs.descartes.join(' · '), /no hay subtítulos para ponerles emojis/);
  const juntos = revisar([{ op: 'emojis_subtitulos', activar: true }, { op: 'generar_subtitulos' }], vacia);
  assert.deepEqual(juntos.resueltas.map((x) => x.op), ['generar_subtitulos', 'emojis_subtitulos'], 'los emojis, después de generar');
  // Sacar sin emojis: se dice; con emojis, se sacan, y la IA los ve marcados.
  assert.match(revisar([{ op: 'emojis_subtitulos', activar: false }]).descartes.join(' · '), /no hay emojis automáticos para sacar/);
  const con = escena(true);
  assert.match(vistaChat(con).json, /"emoji_de_subtitulo":true/);
  assert.deepEqual(revisar([{ op: 'emojis_subtitulos', activar: false }], con).resueltas, [{ op: 'emojis_subtitulos', activar: false }]);
});

test('6c: la API declara «poner_emojis_subtitulos» y «animar_palabras_video», y vuelven a la forma del chat', () => {
  const e = operacionApiPorId('poner_emojis_subtitulos')!;
  assert.ok(e, 'poner_emojis_subtitulos');
  assert.deepEqual(operacionDesdeInput(e, { proyecto: 'x', activar: true }), { ok: true, op: { op: 'emojis_subtitulos', activar: true } });
  const a = operacionApiPorId('animar_palabras_video')!;
  assert.deepEqual(operacionDesdeInput(a, { proyecto: 'x', animacion: 'crecer' }), { ok: true, op: { op: 'animar_palabras', animacion: 'crecer' } });
  for (const id of ['poner_emojis_subtitulos', 'animar_palabras_video']) assert.ok(DEFS_VIDEO.some((d) => d.id === id), `${id} en el registro`);
  const run = sinComentarios(leer('lib/api-mako/areas/video.run.ts'));
  assert.match(run, /poner_emojis_subtitulos: \{ \.\.\.enElEditor\('poner_emojis_subtitulos'\) \}/);
  assert.match(leer('docs/api-mako.md'), /poner_emojis_subtitulos/, 'la referencia regenerada');
});

// ── Probado rompiéndolo (10/11/2026; 14 tests, cada rotura sola y restaurada) ──
// · «pop» con una curva continua en vez de la tabla ......................... rojo el 1 y 1b
// · sin karaoke, la animación no busca la palabra que se dice ............... rojo el 1b y 2
// · sin karaoke, lo no dicho se atenúa ...................................... rojo el 1b
// · clave que además se dice: no toma la más grande ......................... rojo el 2
// · el tamaño de las claves sin tope ........................................ rojo el 2
// · marcar a mano no desmarca / sumar agrega lo que no se dice .............. rojo el 2b (las dos)
// · otra plantilla no saca la animación de «Hormozi» ........................ rojo el 3
// · el preset acepta cualquier animación / recorta el tamaño ................ rojo el 4 (las dos)
// · «auto$» agarra «automatizar» / sin NO_SON / la clave no gana ............ rojo el 5 (+ 5b y 5c)
// · sin la separación entre emojis / repite el mismo seguido ................ rojo el 5b (las dos)
// · el emoji en el centro del subtítulo ..................................... rojo el 5b y 5c
// · sin la marca del subtítulo / sin la entrada «Rebote» .................... rojo el 5c (+ 5d)
// · no reemplaza los de antes / borra el sticker de la persona / la pista
//   vacía queda / sacar copia aunque no haya nada / la pista abajo ........... rojo el 5d (las cinco)
// · el interruptor otra vez apagado / generar no pone los emojis ............ rojo el 5e (las dos)
// · el chat deja que la IA elija el emoji ................................... rojo el 6
// · los emojis antes de generar / sin subtítulos igual propone / la IA no ve
//   los emojis / no es larga ................................................. rojo el 6b (las cuatro)
// · la API sin su operación ................................................. rojo el 6c
// · sacar «ninguna» a mano en presetDesdeApi: VERDE, y era código sin efecto (el saneo ya la saca): se borró.
