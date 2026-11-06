// =============================================================================
// «Resaltar palabras clave automáticamente» y los presets de la marca (Video Editor)
// =============================================================================
// Pedido de Leila (llamada del 30/10/2026): el interruptor estaba en «Próximamente», y quiere
// presets guardados por marca o por cliente. Lo que falla SIN error, y por eso se prueba acá:
//
//   1. QUÉ SE ELIGE: la palabra que pesa (número, monto, palabra de venta, nombre propio, la de
//      la marca), y NINGUNA en un subtítulo de relleno: resaltar por resaltar apaga a la que importa.
//   2. LA REPETIDA pierde: la misma de color tres veces seguidas deja de decir algo.
//   3. EL DIBUJO: las claves no necesitan tiempos (un .srt también), la palabra que se dice
//      (karaoke) le gana a la clave, y sin karaoke ni claves el dibujo va por el camino de siempre.
//   4. LAS CLAVES SON DE SU TEXTO: no viajan con «Aplicar en todos los subtítulos».
//   5. UN PRESET es relativo al lienzo (ida y vuelta exacta en 9:16 y 16:9) y se sanea entero:
//      nada de lo que manda el navegador o la API se guarda sin pasar.
//   6. EL CHAT Y LA API: «palabras_clave» y «usar_preset_subtitulos» se revisan contra lo que hay.
//
// Correr: node --import tsx --test tests/video-editor-subtitulos-claves.test.ts
// Probado rompiéndolo: el resultado de cada rotura está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  codificarClaves, clavesNombradas, elegirClaves, indicesDeClaves, leerClaves, normalizarClave, PARAM_CLAVES,
  PENALIZACION_REPETIDA, PUNTAJE_MINIMO,
} from '../lib/editor-video/claves';
import { colorDePalabra, resaltadoDe } from '../app/video-editor/_opencut/text/resaltado';
import { DEFAULTS_CLAVES, PARAM_CLAVES_COLOR, PARAM_RESALTAR, PARAM_RESALTAR_COLOR } from '../app/video-editor/_opencut/params/extra/subtitulos';
import { codificarPalabras, PARAM_PALABRAS } from '../app/video-editor/_opencut/subtitles/palabras';
import { paramsDePlantilla, plantillaDeParams, PLANTILLAS_SUBTITULO } from '../app/video-editor/_opencut/subtitles/estilos';
import {
  buscarPreset, COLOR_CLAVES_POR_DEFECTO, conPreset, escribirPresets, leerPresets, presetDesdeApi, resumenPreset, sanearPreset,
  TOPES_PRESETS, type PresetSubtitulos,
} from '../lib/editor-video/presets-subtitulos';
import { validarOperacion, catalogoParaPrompt } from '../lib/editor-video/chat-catalogo';
import { operacionApiPorId, operacionDesdeInput } from '../lib/editor-video/chat-api';
import { vistaDeLinea, revisarOperaciones, type OperacionResuelta } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';
import { DEFS as DEFS_VIDEO } from '../lib/api-mako/areas/video.def';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1 y 2: qué se elige ──────────────────────────────────────────────────────

test('1: la palabra que pesa: número, monto, venta, nombre propio; y ninguna en un subtítulo de relleno', () => {
  const [a, b, c, d, e, f] = elegirClaves([
    'Hoy te regalo 3 plantillas gratis',
    'y entonces lo vi',
    'Esto lo aprendí con Valentina',
    'Cuesta $1.200 al mes',
    '¡Hoy es gratis!',
    'Listo. Pongo todo',
  ]);
  assert.deepEqual(a, ['3'], 'el número le gana a «gratis», «hoy» y «plantillas»');
  assert.deepEqual(b, [], 'relleno: ninguna');
  assert.deepEqual(c, ['valentina'], 'el nombre propio (mayúscula que no abre la frase)');
  assert.deepEqual(d, ['1.200'], 'el monto, sin el signo');
  assert.deepEqual(e, ['gratis']);
  assert.deepEqual(f, [], '«Pongo» abre la frase después del punto: no es un nombre propio');
});

test('1b: las de la marca entran siempre (aunque haya un número) y un subtítulo largo lleva dos', () => {
  const [a] = elegirClaves(['Con MaKo vendes 3 veces más'], { siempre: ['MaKo'] });
  assert.deepEqual(a, ['mako'], 'la de la marca, primero; el tope de 1 no la saca');
  const [largo] = elegirClaves(['Te cuento el método exacto que usamos para facturar 50 mil este mes']);
  assert.equal(largo.length, 2, 'con 8 palabras o más, dos');
  assert.ok(largo.includes('50'), largo.join(','));
});

test('2: la que ya se resaltó en los dos de antes pierde (un número sigue pasando)', () => {
  const r = elegirClaves(['Tus ventas suben hoy', 'Tus ventas siguen', 'Tus ventas crecen', 'Tus ventas mejoran']);
  assert.deepEqual(r, [['ventas'], ['siguen'], ['crecen'], ['ventas']], 'a la cuarta, ya no está entre las dos de antes');
  assert.ok(7 - PENALIZACION_REPETIDA < PUNTAJE_MINIMO, 'una palabra de venta repetida queda debajo del mínimo');
  assert.ok(10 - PENALIZACION_REPETIDA >= PUNTAJE_MINIMO, 'un número repetido sigue pasando');
  assert.deepEqual(elegirClaves(['Son 3 pasos', 'Los 3 pasos']), [['3'], ['3']]);
});

test('2b: lo que se guarda y lo que se lee: normalizado, sin repetir, y las nombradas sólo donde se dicen', () => {
  assert.equal(normalizarClave('¡GRATIS!'), 'gratis');
  assert.equal(normalizarClave('Método,'), 'metodo');
  assert.equal(codificarClaves(['Gratis', 'gratis', '¡HOY!']), 'gratis|hoy');
  assert.deepEqual(leerClaves('gratis|hoy'), ['gratis', 'hoy']);
  assert.deepEqual(leerClaves(42), []);
  assert.deepEqual(indicesDeClaves('Es GRATIS, gratis y hoy', 'gratis'), [1, 2], 'cada vez que se dice');
  assert.deepEqual(indicesDeClaves('otro texto', 'gratis'), [], 'reescrito: ninguna');
  assert.deepEqual(clavesNombradas(['compra hoy', 'mañana no', 'Hoy y gratis'], ['hoy', 'GRATIS']), [['hoy'], [], ['hoy', 'gratis']]);
});

// ── 3: el dibujo ─────────────────────────────────────────────────────────────

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

test('3: las claves sin tiempos (un .srt) se dibujan; sin karaoke ni claves, null (el camino de siempre)', () => {
  const soloClaves = resaltadoDe({ params: { content: 'compra hoy gratis', [PARAM_CLAVES]: 'gratis' }, tiempo: 0.2, recorteInicio: 0 })!;
  assert.equal(soloClaves.modo, 'ninguno');
  assert.deepEqual(soloClaves.claves, [2]);
  assert.equal(soloClaves.noDichas, 1, 'nada se atenúa');
  assert.equal(soloClaves.claveColor, DEFAULTS_CLAVES.color);
  assert.equal(colorDePalabra(soloClaves, 2, '#ffffff'), DEFAULTS_CLAVES.color);
  assert.equal(colorDePalabra(soloClaves, 0, '#ffffff'), '#ffffff');
  assert.equal(resaltadoDe({ params: { content: 'compra hoy gratis' }, tiempo: 0.2, recorteInicio: 0 }), null);
  assert.equal(resaltadoDe({ params: { content: 'compra hoy gratis', [PARAM_CLAVES]: 'mañana' }, tiempo: 0.2, recorteInicio: 0 }), null, 'una clave que el texto no dice no cuenta');
});

test('3b: con karaoke, la palabra que se dice le gana a la clave; la clave tiene su color el resto del tiempo', () => {
  const params = {
    content: 'compra hoy gratis', [PARAM_PALABRAS]: palabras(), [PARAM_RESALTAR]: 'palabra', [PARAM_RESALTAR_COLOR]: '#ffe14d',
    [PARAM_CLAVES]: 'gratis', [PARAM_CLAVES_COLOR]: '#00ff00',
  };
  const diciendoGratis = resaltadoDe({ params, tiempo: 0.9, recorteInicio: 0 })!;
  assert.equal(colorDePalabra(diciendoGratis, 2, '#fff'), '#ffe14d', 'la que se dice');
  const diciendoHoy = resaltadoDe({ params, tiempo: 0.6, recorteInicio: 0 })!;
  assert.equal(colorDePalabra(diciendoHoy, 1, '#fff'), '#ffe14d');
  assert.equal(colorDePalabra(diciendoHoy, 2, '#fff'), '#00ff00', 'la clave, mientras se dice otra');
  assert.equal(colorDePalabra(diciendoHoy, 0, '#fff'), '#fff');
  // Cuantizado: entre dos cuadros de la misma palabra, lo medido no cambia.
  assert.equal(JSON.stringify(resaltadoDe({ params, tiempo: 0.55, recorteInicio: 0 })), JSON.stringify(resaltadoDe({ params, tiempo: 0.65, recorteInicio: 0 })));
});

test('3c: el dibujo pinta cada palabra con `colorDePalabra` (no sólo con el karaoke)', () => {
  const src = sinComentarios(leer('app/video-editor/_opencut/text/dibujar.ts'));
  assert.match(src, /const colorDe = \(palabra: number\) => colorDePalabra\(res, palabra, textColor\)/);
  assert.doesNotMatch(src, /vaResaltada\(res, palabra\) \? res\.color : textColor/, 'el color de antes ignoraba las claves');
});

// ── 4: son de su texto ───────────────────────────────────────────────────────

test('4: las claves no viajan con «Aplicar en todos» y el interruptor ya no está en «Próximamente»', () => {
  const insert = sinComentarios(leer('app/video-editor/_opencut/subtitles/insert.ts'));
  assert.match(insert, /const NO_ESTILO = new Set\(\[[^\]]*PARAM_CLAVES[^\]]*\]\)/);
  const vista = sinComentarios(leer('app/video-editor/_opencut/subtitles/components/assets-view.tsx'));
  const fila = vista.slice(vista.indexOf('rotulo="Resaltar palabras clave automáticamente"'));
  assert.ok(fila.length > 0 && vista.includes('rotulo="Resaltar palabras clave automáticamente"'));
  const corte = fila.slice(0, fila.indexOf('/>'));
  assert.doesNotMatch(corte, /desactivado/, 'el interruptor anda');
  assert.match(corte, /onCambio=\{\(v\) => prefs\.fijar\(\{ claves: v \}\)\}/);
  // Y al generar, las claves salen si el interruptor está (o si el preset de la marca las pide).
  const generar = sinComentarios(leer('app/video-editor/_opencut/subtitles/generar.ts'));
  assert.match(generar, /claves: conClavesSolas/);
  assert.match(generar, /prefs\.claves\s*\?\s*\{ tipo: "auto"/);
});

// ── 5: los presets ───────────────────────────────────────────────────────────

test('5: un subtítulo como preset y de vuelta da lo mismo, en vertical y en horizontal', () => {
  for (const lienzo of [{ width: 1080, height: 1920 }, { width: 1920, height: 1080 }]) {
    for (const p of PLANTILLAS_SUBTITULO) {
      const params = paramsDePlantilla(p, lienzo);
      const vuelta = paramsDePlantilla({ id: 'x', nombre: 'x', ...plantillaDeParams(params, lienzo) }, lienzo);
      for (const k of ['fontFamily', 'fontWeight', 'color', 'fontSize', 'background.enabled', 'trazo.activo', 'texto.mayusculas', PARAM_RESALTAR]) {
        assert.equal(String(vuelta[k]).toLowerCase(), String(params[k]).toLowerCase(), `${p.id} ${lienzo.width}×${lienzo.height}: ${k}`);
      }
      if (params['background.enabled']) {
        assert.ok(Math.abs(Number(vuelta['background.paddingX']) - Number(params['background.paddingX'])) <= 1, `${p.id}: relleno`);
      }
    }
  }
  // Relativo: el mismo preset da más letra en un lienzo más alto, en proporción (no un número fijo).
  const vertical = plantillaDeParams(paramsDePlantilla(PLANTILLAS_SUBTITULO[0], { width: 1080, height: 1920 }), { width: 1080, height: 1920 });
  assert.equal(vertical.escala, 1);
});

const AHORA = '2026-11-06T12:00:00.000Z';
const preset = (extra: Record<string, unknown> = {}) => ({
  nombre: 'Hormozi', marca: 'Clínica', estilo: { fuente: 'Anton', negrita: true, color: '#FFFFFF', mayusculas: true, trazo: { color: '#000000', grosor: 30 } },
  claves: { auto: true, color: '#22c55e', siempre: ['MaKo', 'mako', 'gratis'] }, ...extra,
});

test('5b: se sanea entero: lo inválido se rechaza con su motivo, nada se recorta', () => {
  const ok = sanearPreset(preset(), { id: 'pabc12', ahora: AHORA });
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.valor.estilo.color, '#ffffff', 'el color, en minúscula');
  assert.deepEqual(ok.ok && ok.valor.claves.siempre, ['MaKo', 'gratis'], 'sin repetir (sin mirar mayúsculas)');
  const malo = (extra: Record<string, unknown>) => sanearPreset(preset(extra), { id: 'pabc12', ahora: AHORA });
  assert.equal(malo({ nombre: '' }).ok, false);
  assert.equal(malo({ nombre: 'x'.repeat(TOPES_PRESETS.nombre + 1) }).ok, false, 'largo: se rechaza, no se corta');
  assert.equal(malo({ estilo: { fuente: 'Anton', negrita: true, color: 'rojo' } }).ok, false);
  assert.equal(malo({ estilo: { fuente: 'Anton', negrita: true, color: '#fff', escala: 9 } }).ok, false);
  assert.equal(malo({ claves: { auto: true, color: '#00ff00', siempre: ['dos palabras'] } }).ok, false);
  assert.equal(malo({ claves: { auto: true, color: '#00ff00', siempre: Array.from({ length: 31 }, (_, i) => `p${i}`) } }).ok, false);
  assert.equal(COLOR_CLAVES_POR_DEFECTO, DEFAULTS_CLAVES.color, 'el verde es UNO (el editor y el server)');
});

test('5c: la lista guardada, el nombre repetido, el tope y la búsqueda por nombre', () => {
  const a = sanearPreset(preset(), { id: 'paaaa1', ahora: AHORA });
  const b = sanearPreset(preset({ marca: 'Gimnasio' }), { id: 'pbbbb2', ahora: AHORA });
  assert.ok(a.ok && b.ok);
  const lista = [a.valor, b.valor] as PresetSubtitulos[];
  // Una fila rota no tira la lista entera.
  const guardado = JSON.stringify({ presets: [...lista, { id: 'pcccc3', nombre: '' }, { id: 'NO-ES-ID', nombre: 'x' }] });
  assert.deepEqual(leerPresets(guardado).map((p) => p.id), ['paaaa1', 'pbbbb2']);
  assert.deepEqual(leerPresets(escribirPresets(lista)), lista);
  assert.deepEqual(leerPresets('no es json'), []);
  // Mismo nombre en dos marcas: se pide la marca, nunca se elige el primero.
  const ambiguo = buscarPreset(lista, 'hormozi');
  assert.equal(ambiguo.ok, false);
  assert.match(!ambiguo.ok ? ambiguo.motivo : '', /di de qué marca/);
  const conMarca = buscarPreset(lista, 'HORMOZI', 'gimnasio');
  assert.equal(conMarca.ok && conMarca.preset.id, 'pbbbb2');
  assert.equal(buscarPreset(lista, 'pbbbb2').ok, true, 'por id');
  assert.match(!buscarPreset(lista, 'Neón').ok ? (buscarPreset(lista, 'Neón') as { motivo: string }).motivo : '', /están: Hormozi \(Clínica\), Hormozi \(Gimnasio\)/);
  // El nombre repetido en la MISMA marca se rechaza; reemplazar el mismo id, no.
  assert.equal(conPreset(lista, { ...a.valor, id: 'pnuevo1' }).ok, false);
  assert.equal(conPreset(lista, { ...a.valor, nombre: 'Otro' }).ok, true);
  const llena = Array.from({ length: TOPES_PRESETS.presets }, (_, i) => ({ ...a.valor, id: `pz${String(i).padStart(4, '0')}`, nombre: `n${i}` }));
  assert.equal(conPreset(llena, { ...a.valor, id: 'pnuevo1', nombre: 'otro' }).ok, false, 'el tope');
  assert.match(resumenPreset(a.valor), /Anton negrita · letra #ffffff · en mayúsculas · contorno #000000 · palabras clave en #22c55e · siempre resalta: MaKo, gratis/);
});

test('5d: lo que manda la API cambia SÓLO lo que nombra; «no» saca', () => {
  const base = sanearPreset(preset(), { id: 'paaaa1', ahora: AHORA });
  assert.ok(base.ok);
  const cambio = presetDesdeApi({ color: '#ff0000', contorno: 'no', karaoke: 'palabra' }, base.valor);
  const s = sanearPreset(cambio, { id: 'paaaa1', ahora: AHORA });
  assert.ok(s.ok, !s.ok ? s.motivo : '');
  if (!s.ok) return;
  assert.equal(s.valor.estilo.color, '#ff0000');
  assert.equal(s.valor.estilo.trazo, undefined, '«no» sacó el contorno');
  assert.equal(s.valor.estilo.fuente, 'Anton', 'lo que no vino queda');
  assert.deepEqual(s.valor.estilo.resaltado, { modo: 'palabra', color: '#ffe14d' });
  assert.equal(s.valor.marca, 'Clínica');
  assert.equal(sanearPreset(presetDesdeApi({ marca: 'ninguna' }, base.valor), { id: 'p1111', ahora: AHORA }).ok && (sanearPreset(presetDesdeApi({ marca: 'ninguna' }, base.valor), { id: 'p1111', ahora: AHORA }) as { valor: PresetSubtitulos }).valor.marca, null);
  // Uno nuevo sin nombre no pasa.
  assert.equal(sanearPreset(presetDesdeApi({ fuente: 'Poppins' }, null), { id: 'p1111', ahora: AHORA }).ok, false);
  assert.equal(sanearPreset(presetDesdeApi({ nombre: 'Simple' }, null), { id: 'p1111', ahora: AHORA }).ok, true, 'con nombre, los valores de siempre');
});

test('5e: la ruta y la API: admin, sin IA, y el preset se busca ANTES de proponer', () => {
  const ruta = sinComentarios(leer('app/api/video-editor/presets/route.ts'));
  assert.match(ruta, /await veEditorVideo\(\)/);
  assert.match(ruta, /rol !== 'admin'/);
  assert.doesNotMatch(ruta, /ai-cheap|chatCheap|anthropic/, 'sin IA');
  for (const id of ['listar_presets_subtitulos', 'guardar_preset_subtitulos', 'borrar_preset_subtitulos']) {
    const d = DEFS_VIDEO.find((x) => x.id === id);
    assert.ok(d, id);
    assert.deepEqual(d!.gating, { tab: 'video-editor', rolMinimo: 'admin' }, `${id}: admin, como la ruta`);
    if (d!.tipo === 'accion') assert.equal(d!.confirmacion, 'chat', `${id}: con su «sí»`);
  }
  const run = sinComentarios(leer('lib/api-mako/areas/video.run.ts'));
  const desde = run.indexOf("if (o.op === 'usar_preset_subtitulos') {");
  assert.ok(desde >= 0, 'proponerEnElEditor busca el preset');
  const usar = run.slice(desde, run.indexOf('const v = operacionDesdeInput(o, input);', desde));
  assert.ok(usar.length > 0 && usar.length < 800, `el bloque de usar_preset (${usar.length})`);
  assert.match(usar, /buscarPreset\(lista/, 'se busca en el negocio');
  assert.match(usar, /input = \{ \.\.\.input, preset: b\.preset\.id \}/, 'la propuesta lleva el id, no el nombre');
});

// ── 6: el chat ───────────────────────────────────────────────────────────────

const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);
function escena(): SceneTracks {
  const el = (id: string, ini: number, dur: number, params: Record<string, unknown>) =>
    ({ id, type: 'text', name: id, startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params });
  return {
    overlay: [
      { id: 'pt', type: 'text', name: 'Texto', hidden: false, elements: [el('txt1', 0, 2, { content: 'Oferta 3 gratis' })] },
      { id: 'ps', type: 'text', name: 'Subs', hidden: false, elements: [
        el('sub1', 0, 2, { content: 'Hoy te regalo 3 plantillas', subtitulo: true }),
        el('sub2', 2, 2, { content: 'y entonces lo vi', subtitulo: true, [PARAM_CLAVES]: 'vi' }),
        el('sub3', 4, 2, { content: 'gratis con MaKo', subtitulo: true }),
      ] },
    ],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [] },
    audio: [],
  } as unknown as SceneTracks;
}
const PRESETS = [{ id: 'paaaa1', nombre: 'Hormozi', marca: 'Clínica', resumen: 'Anton' }, { id: 'pbbbb2', nombre: 'Limpio', marca: null, resumen: 'Inter' }];
const DISP = { ...disponiblesDelMotor(), presets: PRESETS, palabrasDeMarca: ['MaKo'] };
const vistaChat = () => vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: 0, elegidos: [], disponibles: DISP, lienzo: { ancho: 1080, alto: 1920 } });
const revisar = (operaciones: unknown[]) => revisarOperaciones({ operaciones: operaciones as never, vista: vistaChat(), alcance: 'video' });
type Params = Extract<OperacionResuelta, { op: 'params' }>;

test('6: la forma: modo, palabras sólo con «estas», color #RRGGBB, nada de más', () => {
  const v = validarOperacion;
  assert.deepEqual(v({ op: 'palabras_clave', modo: 'auto', color: '0F0' }), { ok: true, op: { op: 'palabras_clave', modo: 'auto', color: '#00ff00' } });
  assert.deepEqual(v({ op: 'palabras_clave', modo: 'estas', palabras: ['gratis', 'gratis', 'hoy'] }), { ok: true, op: { op: 'palabras_clave', modo: 'estas', palabras: ['gratis', 'hoy'] } });
  assert.equal(v({ op: 'palabras_clave', modo: 'estas', palabras: [] }).ok, false);
  assert.equal(v({ op: 'palabras_clave', modo: 'estas', palabras: ['dos palabras'] }).ok, false);
  assert.equal(v({ op: 'palabras_clave', modo: 'auto', palabras: ['x'] }).ok, false, 'palabras sin «estas»');
  assert.equal(v({ op: 'palabras_clave', modo: 'todas' }).ok, false);
  assert.equal(v({ op: 'palabras_clave', modo: 'auto', tamano: 3 }).ok, false);
  assert.deepEqual(v({ op: 'usar_preset_subtitulos', preset: ' paaaa1 ' }), { ok: true, op: { op: 'usar_preset_subtitulos', preset: 'paaaa1' } });
  assert.equal(v({ op: 'usar_preset_subtitulos' }).ok, false);
  // Ya no figuran entre lo que no se puede.
  assert.doesNotMatch(catalogoParaPrompt(), /resaltar palabras CLAVE/);
});

test('6b: «auto» elige en TODOS los subtítulos (con las de la marca) y sólo cambia los que cambian', () => {
  const r = revisar([{ op: 'palabras_clave', modo: 'auto' }]);
  const ps = r.resueltas as Params[];
  assert.deepEqual(ps.map((p) => [p.el.elementId, p.params[PARAM_CLAVES]]), [['sub1', '3'], ['sub2', ''], ['sub3', 'mako']], 'el texto «Oferta» no se toca; sub2 pierde su «vi»');
  assert.match(r.cambios[0].despues, /palabras clave en 2 \(«3», «mako»…\)/);
  assert.match(vistaChat().json, /"palabras_clave":\["vi"\]/, 'la IA ve las de ahora');
  assert.match(vistaChat().json, /"presets_subtitulos":\{"paaaa1":"Hormozi \(Clínica\): Anton"/);
});

test('6c: «estas» sólo donde se dicen; si no se dicen en ninguno, se dice; «ninguna» las saca', () => {
  const estas = revisar([{ op: 'palabras_clave', modo: 'estas', palabras: ['GRATIS'], color: '#123456' }]);
  const ps = estas.resueltas as Params[];
  assert.deepEqual(ps.map((p) => [p.el.elementId, p.params[PARAM_CLAVES], p.params[PARAM_CLAVES_COLOR]]), [['sub1', '', '#123456'], ['sub2', '', '#123456'], ['sub3', 'gratis', '#123456']]);
  assert.match(revisar([{ op: 'palabras_clave', modo: 'estas', palabras: ['mañana'] }]).descartes[0], /«mañana» no aparece en ningún subtítulo/);
  const ninguna = revisar([{ op: 'palabras_clave', modo: 'ninguna' }]).resueltas as Params[];
  assert.deepEqual(ninguna.map((p) => p.el.elementId), ['sub2'], 'sólo el que tenía');
});

test('6d: el preset por id o por nombre; el que no está se dice con la lista', () => {
  const porNombre = revisar([{ op: 'usar_preset_subtitulos', preset: 'limpio' }]);
  assert.deepEqual(porNombre.resueltas, [{ op: 'usar_preset_subtitulos', preset: 'pbbbb2' }]);
  assert.match(porNombre.cambios[0].despues, /el preset «Limpio»/);
  assert.match(revisar([{ op: 'usar_preset_subtitulos', preset: 'Neón' }]).descartes[0], /no hay un preset «Neón» \(están: Hormozi, Limpio\)/);
  const sinPresets = revisarOperaciones({
    operaciones: [{ op: 'usar_preset_subtitulos', preset: 'x' }] as never,
    vista: vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: 0, elegidos: [], disponibles: disponiblesDelMotor() }),
    alcance: 'video',
  });
  assert.match(sinPresets.descartes[0], /todavía no tiene presets/);
});

test('6e: la API declara las dos y vuelven a la forma del chat', () => {
  const claves = operacionApiPorId('resaltar_claves_subtitulos')!;
  const r = operacionDesdeInput(claves, { proyecto: 'p', modo: 'estas', palabras: ['hoy'], color: '#00ff00' });
  assert.deepEqual(r, { ok: true, op: { op: 'palabras_clave', modo: 'estas', palabras: ['hoy'], color: '#00ff00' } });
  const usar = operacionApiPorId('usar_preset_subtitulos')!;
  assert.deepEqual(operacionDesdeInput(usar, { proyecto: 'p', preset: 'Hormozi' }), { ok: true, op: { op: 'usar_preset_subtitulos', preset: 'Hormozi' } });
});

// ── Probado rompiéndolo (6/11/2026) ──────────────────────────────────────────
// Cada rotura, sola, contra este archivo (base 18/0), restaurando desde memoria:
//   · `if (siempre.has(norm)) return 20` → `return 0` ............... 16/2 (1b y 6b)
//   · PENALIZACION_REPETIDA = 0 ...................................... 17/1 (2)
//   · `abreFrase` sin mirar el punto de la palabra anterior .......... 17/1 (1, «Pongo»)
//   · resaltadoDe sin el camino de «sólo claves» ...................... 17/1 (3)
//   · colorDePalabra con la clave antes que el karaoke ................ 17/1 (3b)
//   · dibujar.ts con el color de antes (`vaResaltada ? …`) ............ 17/1 (3c)
//   · NO_ESTILO sin PARAM_CLAVES ....................................... 17/1 (4)
//   · el interruptor de nuevo `desactivado` ........................... 17/1 (4)
//   · plantillaDeParams sin pasar el relleno a «em» ................... 17/1 (5)
//   · sanearSiempre recortando en vez de rechazar ..................... 17/1 (5b)
//   · buscarPreset devolviendo el primero de dos con el mismo nombre .. 17/1 (5c)
//   · presetDesdeApi sin «no» para el contorno ........................ 17/1 (5d)
//   · el runner proponiendo con el nombre en vez del id ............... 17/1 (5e)
//   · revisar «auto» sin las palabras de la marca ..................... 17/1 (6b)
//   · revisar «ninguna» reescribiendo los que ya no tenían ............ 17/1 (6c)
