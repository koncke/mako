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
import { CURVA_POP, ESCALA_CRECER, escalaMaximaDePalabra, formaDeAnim, formaDePalabra, resaltadoDe, reservasDeRenglones, ubicarPalabras } from '../app/video-editor/_opencut/text/resaltado';
import {
  DEFAULTS_CLAVES, PARAM_ANIM_PALABRA, PARAM_CLAVES_TAMANO, PARAM_RESALTAR, TOPES_CLAVES_TAMANO,
} from '../app/video-editor/_opencut/params/extra/subtitulos';
import { codificarPalabras, PARAM_PALABRAS } from '../app/video-editor/_opencut/subtitles/palabras';
import { paramsDePlantilla, plantillaDeParams, PLANTILLAS_SUBTITULO } from '../app/video-editor/_opencut/subtitles/estilos';
import { presetDesdeApi, resumenPreset, sanearPreset, type PresetSubtitulos } from '../lib/editor-video/presets-subtitulos';
import {
  DURACION_MINIMA_S, elegirEmojis, emojiDePalabra, emojiDeSubtitulo, NOMBRE_PISTA_EMOJIS, PARAM_EMOJI_DE, posicionDelEmoji, SEPARACION_S, TAMANO_EMOJI,
} from '../app/video-editor/_opencut/subtitles/emojis';
import { armarEmojis, conEmojis, cuantosEmojis, sincronizarEmojis, sinEmojis } from '../app/video-editor/_opencut/subtitles/emojis-pista';
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

// ── 7: lo que encontró la revisión (10/11/2026) ──────────────────────────────

test('7: el renglón le RESERVA su lugar a la palabra que crece: ninguna pisa a la de al lado', () => {
  const tiempos = codificarPalabras({ palabras: [{ texto: 'hoy', inicio: 0.1, fin: 0.4 }, { texto: 'dinero', inicio: 0.5, fin: 0.9 }, { texto: 'ya', inicio: 1, fin: 1.2 }], origen: 0, precision: 'palabra' });
  const r = resaltadoDe({ params: { content: 'hoy dinero ya', [PARAM_PALABRAS]: tiempos, [PARAM_ANIM_PALABRA]: 'pop', [PARAM_CLAVES]: 'dinero', [PARAM_CLAVES_TAMANO]: 140 }, tiempo: 0.6, recorteInicio: 0 })!;
  assert.equal(r.anim, 'pop', 'con los tiempos de ESTA frase');
  const ancho = (t: string) => Array.from(t).length * 10;
  // Cada palabra reserva (escala máxima − 1) × su ancho: la clave, la mayor entre su tamaño y el pico de «pop».
  assert.equal(escalaMaximaDePalabra(r, 1), 1.4);
  assert.equal(escalaMaximaDePalabra(r, 0), Math.max(...CURVA_POP.map((p) => p.escala)));
  const [reserva] = reservasDeRenglones(r, ['hoy dinero ya'], ancho);
  assert.ok(Math.abs(reserva - ((1.16 - 1) * 30 + (1.4 - 1) * 60 + (1.16 - 1) * 20)) < 1e-9, `reserva ${reserva}`);
  // Las piezas: cada palabra, a su escala máxima, entra en su lugar sin tocar a la siguiente.
  const total = ancho('hoy dinero ya') + reserva;
  const piezas = ubicarPalabras({ renglon: 'hoy dinero ya', primera: 0, x0: -total / 2, anchoDe: ancho, escalaMax: (p) => escalaMaximaDePalabra(r, p) });
  assert.equal(piezas.length, 3);
  const extremos = piezas.map((p) => { const m = escalaMaximaDePalabra(r, p.palabra); const c = p.x + p.ancho / 2; return [c - (p.ancho * m) / 2, c + (p.ancho * m) / 2]; });
  for (let i = 1; i < extremos.length; i++) assert.ok(extremos[i][0] >= extremos[i - 1][1] - 1e-9, `la palabra ${i} pisa a la ${i - 1}: ${JSON.stringify(extremos)}`);
  // Sin reserva (la forma de antes) sí se pisaban: es lo que encontró la revisión.
  const sin = ubicarPalabras({ renglon: 'hoy dinero ya', primera: 0, x0: -ancho('hoy dinero ya') / 2, anchoDe: ancho });
  const pisan = sin.map((p) => { const m = escalaMaximaDePalabra(r, p.palabra); const c = p.x + p.ancho / 2; return [c - (p.ancho * m) / 2, c + (p.ancho * m) / 2]; });
  assert.ok(pisan[1][0] < pisan[0][1], 'sin reserva, la clave pisa a la de antes');
  // Centrado: el renglón (con la reserva) queda centrado en el 0.
  assert.ok(Math.abs(extremos[0][0] + extremos.at(-1)![1]) < 15, `centrado: ${extremos[0][0]} … ${extremos.at(-1)![1]}`);
  // Sin forma (ni animación ni claves más grandes), sin reserva: el karaoke solo no corre nada.
  const k = resaltadoDe({ params: { content: 'hoy dinero ya', [PARAM_PALABRAS]: tiempos, [PARAM_RESALTAR]: 'palabra' }, tiempo: 0.6, recorteInicio: 0 })!;
  assert.deepEqual(reservasDeRenglones(k, ['hoy dinero ya'], ancho), [0]);
});

test('7b: el dibujo y la medición usan la reserva (fondo, inicio del renglón) y las palabras con forma van en su propia pasada', () => {
  const med = sinComentarios(leer('app/video-editor/_opencut/text/measure-element.ts'));
  assert.match(med, /maxWidth: Math\.max\(\.\.\.measuredLayout\.lineMetrics\.map\(\(m, i\) => m\.width \+ \(reservas\[i\] \?\? 0\)\)\)/, 'el bloque (el fondo, la selección) incluye la reserva');
  const dib = sinComentarios(leer('app/video-editor/_opencut/text/dibujar.ts'));
  assert.match(dib, /armarPiezas\(d, medido, lineas, \(palabra\) => escalaMaximaDePalabra\(res, palabra\)\)/);
  assert.match(dib, /const x0 = inicioDeLinea\(medido\.textAlign, l\.metrica\.width \+ \(medido\.reservas\?\.\[l\.indice\] \?\? 0\)\);\s*const ubicadas = ubicarPalabras\(/, 'el dibujo ubica con la función probada y arranca contando la reserva');
  assert.match(dib, /\{ \.\.\.resaltado, piezas: conForma, separado: true, subrayar: false \}/, 'la pasada aparte, después de las demás');
  assert.match(dib, /const f = p\.giro === null \? formaDe\?\.\(p\.palabra\) : undefined;/, 'curvado, sin forma');
});

const LIENZO_V = { width: 1080, height: 1920 };
const conEmojisPuestos = () => {
  const s = escena();
  const emojis = armarEmojis({ subtitulos: subsDe(s), tps: TPS, lienzo: LIENZO_V, paramsBase: BASE_STICKER, nuevoId });
  return conEmojis({ tracks: s, emojis, nuevoId });
};
const emojisDe = (s: SceneTracks) => s.overlay.flatMap((t) => t.elements as StickerElement[]).filter((e) => e.type === 'sticker' && e.id !== 'mio');
const conSub = (s: SceneTracks, id: string, cambio: (el: TextElement) => TextElement): SceneTracks => ({
  ...s,
  overlay: s.overlay.map((t) => ({ ...t, elements: (t.elements as TextElement[]).map((el) => (el.id === id ? cambio(el) : el)) })) as SceneTracks['overlay'],
});
const conEmoji = (s: SceneTracks, cambio: (el: StickerElement) => StickerElement | StickerElement[]): SceneTracks => ({
  ...s,
  overlay: s.overlay.map((t) => ({ ...t, elements: (t.elements as StickerElement[]).flatMap((el) => (el.params?.[PARAM_EMOJI_DE] === 's1' ? cambio(el) : [el])) })) as SceneTracks['overlay'],
});
const sinc = (antes: SceneTracks | null, despues: SceneTracks) => sincronizarEmojis({ antes, despues, tps: TPS, lienzo: LIENZO_V });

test('8: el emoji SIGUE a su subtítulo: otra plantilla, otro lugar o el imán lo recolocan; deshacer lo deja donde estaba', () => {
  const a = conEmojisPuestos();
  assert.equal(sinc(a, a), a, 'sin cambios: el mismo objeto');
  const yAntes = Number(emojisDe(a).find((e) => e.params[PARAM_EMOJI_DE] === 's1')!.params['transform.positionY']);
  // Otra plantilla: letra más grande y dos renglones.
  const b = conSub(a, 's1', (el) => ({ ...el, params: { ...el.params, fontSize: 22, content: 'Gana dinero\nhoy' } }));
  const bs = sinc(a, b);
  const e = emojisDe(bs).find((x) => x.params[PARAM_EMOJI_DE] === 's1')!;
  assert.ok(Number(e.params['transform.positionY']) < yAntes, `sube con el subtítulo más alto: ${yAntes} → ${e.params['transform.positionY']}`);
  // Se movió o el imán lo corrió: el emoji va con él, con su tiempo.
  const c = conSub(bs, 's1', (el) => ({ ...el, startTime: t(1) as TextElement['startTime'], params: { ...el.params, 'transform.positionY': 200 } }));
  const cs = sinc(bs, c);
  const ec = emojisDe(cs).find((x) => x.params[PARAM_EMOJI_DE] === 's1')!;
  assert.equal(ec.startTime, t(1));
  assert.ok(Number(ec.params['transform.positionY']) < 200);
  // Deshacer: vuelve todo al estado de antes, y el emoji sigue siendo automático y en su lugar de antes.
  const deshecho = sinc(cs, bs);
  const ed = emojisDe(deshecho).find((x) => x.params[PARAM_EMOJI_DE] === 's1')!;
  assert.equal(ed.params['transform.positionY'], e.params['transform.positionY']);
  assert.equal(ed.startTime, e.startTime);
});

test('8b: sin su subtítulo se va; tocado a mano o duplicado deja de ser automático; una pista bloqueada no se toca', () => {
  const a = conEmojisPuestos();
  // Borraron el subtítulo (Supr, o se regeneraron con otros ids): su emoji se va.
  const sinS1 = { ...a, overlay: a.overlay.map((t) => ({ ...t, elements: (t.elements as TextElement[]).filter((el) => el.id !== 's1') })) } as SceneTracks;
  assert.ok(!emojisDe(sinc(a, sinS1)).some((x) => x.params[PARAM_EMOJI_DE] === 's1'));
  // La persona lo movió: queda donde lo puso y ya no es automático (apagar no lo saca).
  const movido = conEmoji(a, (el) => ({ ...el, params: { ...el.params, 'transform.positionX': 300 } }));
  const ms = sinc(a, movido);
  const em = emojisDe(ms).find((x) => x.params['transform.positionX'] === 300)!;
  assert.ok(em, 'quedó donde lo puso');
  assert.equal(em.params[PARAM_EMOJI_DE], undefined, 'sin la marca');
  assert.ok(emojisDe(sinEmojis(ms)).some((x) => x.id === em.id), 'apagar no lo saca');
  // Deshacer el movimiento le devuelve la marca (lo de antes estaba marcado).
  assert.equal(emojisDe(sinc(ms, a)).find((x) => x.id === em.id)!.params[PARAM_EMOJI_DE], 's1');
  // Duplicado (Ctrl+D, copiar y pegar): la copia es de la persona; el original sigue automático.
  const dup = conEmoji(a, (el) => [el, { ...el, id: 'copia' }]);
  const ds = sinc(a, dup);
  assert.equal(emojisDe(ds).find((x) => x.id === 'copia')!.params[PARAM_EMOJI_DE], undefined);
  assert.equal(emojisDe(ds).filter((x) => x.params[PARAM_EMOJI_DE] === 's1').length, 1);
  // Pista bloqueada: ni se recoloca ni se borra.
  const bloq = { ...a, overlay: a.overlay.map((t) => (t.name === NOMBRE_PISTA_EMOJIS ? { ...t, locked: true } : t)) } as SceneTracks;
  const bloqSinS1 = { ...bloq, overlay: bloq.overlay.map((t) => ({ ...t, elements: (t.elements as TextElement[]).filter((el) => el.id !== 's1') })) } as SceneTracks;
  assert.equal(sinc(bloq, bloqSinS1), bloqSinS1);
  assert.equal(cuantosEmojis(sinEmojis(bloq)), cuantosEmojis(bloq), 'apagar no borra en una pista bloqueada');
  // La regla corre donde pasa todo cambio de pistas, después del imán.
  const tm = sinComentarios(leer('app/video-editor/_opencut/core/managers/timeline-manager.ts'));
  assert.match(tm, /const conIman = [\s\S]*?const tracks = sincronizarEmojis\(\{[\s\S]*?despues: conIman,[\s\S]*?updateSceneTracks\(\{ tracks \}\)/);
});

test('8c: los emojis nuevos no van a una pista oculta, bloqueada ni donde pisan algo de la persona; adentro del cuadro; no en subtítulos cortos', () => {
  const a = conEmojisPuestos();
  for (const cambio of [{ hidden: true }, { locked: true }]) {
    const s = { ...a, overlay: a.overlay.map((x) => (x.name === NOMBRE_PISTA_EMOJIS ? { ...x, ...cambio, elements: [] } : x)) } as SceneTracks;
    const emojis = armarEmojis({ subtitulos: subsDe(s), tps: TPS, lienzo: LIENZO_V, paramsBase: BASE_STICKER, nuevoId });
    const con = conEmojis({ tracks: s, emojis, nuevoId });
    assert.equal(con.overlay.filter((x) => x.name === NOMBRE_PISTA_EMOJIS).length, 2, `con ${JSON.stringify(cambio)}: una pista nueva`);
  }
  const deLaPersona = { id: 'p1', type: 'sticker', name: 'Mío', stickerId: 'emojis:1f600', intrinsicWidth: 512, intrinsicHeight: 512, startTime: 0, duration: t(10), trimStart: 0, trimEnd: 0, params: { ...BASE_STICKER } };
  const conMio = { ...a, overlay: a.overlay.map((x) => (x.name === NOMBRE_PISTA_EMOJIS ? { ...x, elements: [deLaPersona] } : x)) } as SceneTracks;
  const emojis = armarEmojis({ subtitulos: subsDe(conMio), tps: TPS, lienzo: LIENZO_V, paramsBase: BASE_STICKER, nuevoId });
  assert.equal(conEmojis({ tracks: conMio, emojis, nuevoId }).overlay.filter((x) => x.name === NOMBRE_PISTA_EMOJIS).length, 2, 'pisan lo de la persona: pista nueva');
  // Un subtítulo arriba de todo: el emoji va debajo y entero adentro.
  const arriba = posicionDelEmoji({ x: 0, y: -767, renglones: 2, pxLetra: 81, lienzo: LIENZO_V });
  const lado = TAMANO_EMOJI * 1080;
  assert.ok(arriba.y > -767, `debajo: ${arriba.y}`);
  assert.ok(arriba.y - lado / 2 >= -960 && arriba.y + lado / 2 <= 960);
  assert.ok(posicionDelEmoji({ x: 900, y: 0, renglones: 1, pxLetra: 60, lienzo: LIENZO_V }).x + lado / 2 <= 540, 'ni de costado');
  // Un subtítulo de menos de DURACION_MINIMA_S no lleva emoji (el «Rebote» no llegaría a asentarse).
  assert.deepEqual(elegirEmojis([{ texto: 'dinero', inicio: 0, fin: DURACION_MINIMA_S - 0.1 }]), []);
});

test('8d: el diccionario no agarra lo que empieza parecido', () => {
  for (const w of ['amortizar', 'casado', 'segundo', 'plantilla', 'escalera', 'escalofrío', 'personal', 'pensión']) assert.equal(emojiDePalabra(w), null, w);
  for (const [w, e] of [['amor', '❤️'], ['casa', '🏠'], ['segundos', '⏱️'], ['plan', '🗺️'], ['escalar', '📈'], ['escala', '📈'], ['persona', '👤'], ['pensar', '🤔']] as const) assert.equal(emojiDePalabra(w), e, w);
});

test('9: el chat ve los emojis compactos y dice cuando «sumar» o «quitar» no cambian nada', () => {
  const con = conEmojisPuestos(); // armados de verdad: con su «Rebote» y su posición
  const el = (JSON.parse(vistaChat(con).json).pistas as Array<{ elementos: Array<Record<string, unknown>> }>).flatMap((p) => p.elementos).find((x) => x.emoji_de_subtitulo);
  assert.ok(el, 'el emoji está');
  assert.deepEqual(Object.keys(el!).sort(), ['emoji_de_subtitulo', 'fin', 'inicio', 'nombre', 'ref', 'tipo'], 'sin estado (animaciones, posición)');
  assert.match(revisar([{ op: 'palabras_clave', modo: 'sumar', palabras: ['brutal'] }]).descartes.join(' · '), /«brutal» ya era palabra clave/);
  assert.match(revisar([{ op: 'palabras_clave', modo: 'quitar', palabras: ['dinero'] }]).descartes.join(' · '), /«dinero» no era palabra clave/);
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
//
// ── Y lo de la revisión (tests 7 a 9, 10/11/2026; 21 tests) ──────────────────
// · ubicar las palabras sin la reserva / reservar el instante y no el pico .. rojo el 7 (las dos)
// · el bloque (fondo, selección) sin la reserva / la palabra con forma en
//   la misma pasada que las demás ............................................ rojo el 7b (las dos)
// · la sincronía apagada en updateTracks / el huérfano queda / tocado a mano
//   o duplicado conserva la marca / toca una pista bloqueada (sincronía y
//   apagar) .................................................................. rojo el 8b (las seis)
// · no recoloca / deshacer un cambio de estilo le saca la marca ............. rojo el 8 (las dos)
// · usa la pista oculta / pisa lo de la persona / el emoji se sale del cuadro
//   arriba o de costado / un subtítulo corto con emoji ....................... rojo el 8c (las cinco)
// · «amor» agarra «amortizar» ............................................... rojo el 8d
// · la vista del chat con el emoji entero / «sumar» lo ya marcado, callado .. rojo el 9 (las dos)
