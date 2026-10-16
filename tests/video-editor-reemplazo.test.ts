// =============================================================================
// «Reemplazar el clip» / «Sustituir»: lo que conserva y lo que cambia (la parte pura)
// =============================================================================
// Tanda 2 del plan de plantillas (docs/editor-video/plan-plantillas-anuncio.md §2 y §6):
//   1–3  id, inicio y duración; foto ↔ video; la fuente que pide el clip (con velocidad).
//   4–5  lo que se le hizo al clip pasa (transición, animaciones, efectos, máscaras,
//        fotogramas); lo del ARCHIVO no (normalizar, revertir).
//   6–8  un hueco cubre el mismo rectángulo (y entra silenciado si lo pide); un clip
//        común conserva su transform y su recorte.
//   9    una muestra llena todas las de su hueco, o ninguna.
//   10   leyendo el fuente: el menú, el botón y el soltar llegan a la misma entrada.
//   11   la grilla del diálogo (sin ocultos ni audio, lo que acepta el clip).
// Las líneas salen del armado de verdad (_opencut/plantillas/armar.ts) con el motor de
// mentira (`base`, `medir`): el WASM no carga en node. Lo que se ve en pantalla (el
// diálogo, el botón, el clip nuevo en el reproductor) se mira en el navegador.
//
// Probado rompiéndolo (15/10/2026): el resultado de cada rotura está al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plantillaPorId, type Plantilla } from '../lib/editor-video/plantillas';
import { ANIM } from '../app/video-editor/_opencut/params/extra/animaciones';
import { armarLinea, type Medir } from '../app/video-editor/_opencut/plantillas/armar';
import { leerMarcas, MARCA, quedanMuestras } from '../app/video-editor/_opencut/plantillas/huecos';
import {
  aceptaDe, aceptaMedio, alcanza, conElementos, elementoReemplazado, esMuestraEn, fuenteNecesaria, lineaReemplazada,
  mediosParaReemplazo, objetivosDelReemplazo, rectoMostrado, requisitosDelReemplazo,
  type ClipReemplazable, type MedioReemplazo,
} from '../app/video-editor/_opencut/reemplazo/puro';
import type { ElementRef, SceneTracks, VideoElement } from '../app/video-editor/_opencut/timeline';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const cerca = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ── El motor de mentira ─────────────────────────────────────────────────────

/** Ticks por segundo de mentira: milisegundos, para leer los números. */
const TPS = 1000;
const LIENZO = { width: 1080, height: 1920 };
/** Los params DECLARADOS de cada tipo, como el motor (los que importan acá). */
const base = (tipo: string): Record<string, string | number | boolean> => ({
  'transform.scaleX': 1, 'transform.scaleY': 1, 'transform.positionX': 0, 'transform.positionY': 0, 'transform.rotate': 0, opacity: 1,
  [ANIM.entrada.id]: 'ninguno', [ANIM.entrada.duracion]: 0.5, [ANIM.salida.id]: 'ninguno', [ANIM.salida.duracion]: 0.5,
  [ANIM.combo.id]: 'ninguno', [ANIM.combo.duracion]: 0.5,
  'recorte.izquierda': 0, 'recorte.arriba': 0, 'recorte.derecha': 0, 'recorte.abajo': 0, 'recorte.proporcion': 'libre',
  'transicion.id': '', 'transicion.duracion': 0.5,
  ...(tipo === 'video' ? { volume: 0, muted: false, 'audio.normalizarObjetivo': '-23', 'audio.fundidoEntrada': 0 } : {}),
  ...(tipo === 'text' ? { content: '', fontSize: 15 } : {}),
});
const medir: Medir = ({ params }) => ({ content: params.content, 'transform.positionX': 0, 'transform.positionY': 0 });
const MUESTRA = { width: 1080, height: 1920 };
const MUESTRAS = { 'Tu clip': { mediaId: 'm-clip', ...MUESTRA }, Antes: { mediaId: 'm-antes', ...MUESTRA }, 'Después': { mediaId: 'm-despues', ...MUESTRA }, 'Tu producto': { mediaId: 'm-producto', ...MUESTRA }, '': { mediaId: 'm-final', ...MUESTRA } };

function armar(id: string): SceneTracks {
  let n = 0;
  return armarLinea({
    plantilla: plantillaPorId(id) as Plantilla, lienzo: LIENZO, fps: 30, tps: TPS,
    principal: { id: 'principal', name: 'Principal', type: 'video', elements: [], muted: false, hidden: false },
    muestras: MUESTRAS, base, medir, nuevoId: () => `e${++n}`,
  }).tracks;
}

/** El tamaño de cada medio de la biblioteca de mentira. */
const TAMANOS: Record<string, { width: number; height: number }> = {
  'm-clip': MUESTRA, 'm-antes': MUESTRA, 'm-despues': MUESTRA, 'm-final': MUESTRA, viejo: { width: 1920, height: 1080 },
};
const tamanoDe = (id: string) => TAMANOS[id] ?? null;

const video = (duracion: number, extra: Partial<MedioReemplazo> = {}): MedioReemplazo =>
  ({ mediaId: 'v1', type: 'video', nombre: 'mi video.mp4', width: 1920, height: 1080, duracion, ...extra });
const foto: MedioReemplazo = { mediaId: 'f1', type: 'image', nombre: 'foto.jpg', width: 1080, height: 1080 };

function reemplazar(tracks: SceneTracks, ref: ElementRef, medio: MedioReemplazo) {
  return lineaReemplazada({ tracks, ref, medio, tps: TPS, lienzo: LIENZO, tamanoDe, base });
}
function ok(r: ReturnType<typeof reemplazar>): SceneTracks {
  assert.ok(r.ok, `no reemplazó: ${r.ok ? '' : r.motivo}`);
  return r.tracks;
}

/** Un clip de video común (sin plantilla) en una línea con sólo la principal. */
function clipComun(params: Record<string, string | number | boolean> = {}, extra: Partial<VideoElement> = {}): { tracks: SceneTracks; ref: ElementRef } {
  const el: VideoElement = {
    id: 'c1', type: 'video', mediaId: 'viejo', name: 'viejo.mp4', startTime: 2000 as never, duration: 6000 as never,
    trimStart: 1000 as never, trimEnd: 3000 as never, sourceDuration: 10000 as never, isSourceAudioEnabled: false,
    hidden: false, params: { ...base('video'), ...params }, ...extra,
  };
  const tracks: SceneTracks = { overlay: [], main: { id: 'principal', name: 'Principal', type: 'video', elements: [el], muted: false, hidden: false }, audio: [] };
  return { tracks, ref: { trackId: 'principal', elementId: 'c1' } };
}
const principal = (t: SceneTracks) => t.main.elements as ClipReemplazable[];

// ── 1–3: id, tiempos, tipo y fuente ──────────────────────────────────────────

test('1: conserva id, inicio y duración; una foto pasa a video y un video a foto', () => {
  const t = armar('antes-despues');
  const antes = principal(t)[0];
  assert.equal(antes.type, 'image');
  const r = principal(ok(reemplazar(t, { trackId: 'principal', elementId: antes.id }, video(8))))[0];
  assert.equal(r.type, 'video');
  assert.deepEqual(
    [r.id, r.startTime, r.duration, r.mediaId, r.name, r.trimStart, r.trimEnd, r.type === 'video' && r.sourceDuration, r.type === 'video' && r.isSourceAudioEnabled],
    [antes.id, 0, 3000, 'v1', 'mi video.mp4', 0, 5000, 8000, true],
  );
  // Sigue siendo el hueco «antes» de la plantilla, pero ya no es la muestra.
  assert.deepEqual(leerMarcas(r.params), { plantilla: 'antes-despues', hueco: 'antes', muestra: false, opcional: false, silenciar: false, ancla: null });
  assert.equal(r.params[MARCA.muestra], undefined);

  // Video → foto: sin recortes de fuente, sin velocidad y sin lo que es sólo del video.
  const { tracks, ref } = clipComun({ volume: -6 }, { retime: { rate: 2 } });
  const f = principal(ok(reemplazar(tracks, ref, foto)))[0];
  assert.equal(f.type, 'image');
  assert.deepEqual([f.id, f.startTime, f.duration, f.trimStart, f.trimEnd, f.mediaId], ['c1', 2000, 6000, 0, 0, 'f1']);
  assert.equal('retime' in f, false);
  assert.equal('sourceDuration' in f, false);
  assert.equal(f.params.volume, undefined, 'el volumen no es de una foto');
});

test('2: un hueco de 12 s no acepta un video de 10 s; con 12 s justos sí', () => {
  const t = armar('gancho');
  const clip = principal(t)[0];
  assert.equal(clip.duration, 12000);
  const ref = { trackId: 'principal', elementId: clip.id };
  assert.deepEqual(reemplazar(t, ref, video(10)), { ok: false, motivo: 'corto' });
  assert.deepEqual(reemplazar(t, ref, video(11.999)), { ok: false, motivo: 'corto' });
  const justo = principal(ok(reemplazar(t, ref, video(12))))[0];
  assert.deepEqual([justo.trimEnd, justo.type === 'video' && justo.sourceDuration], [0, 12000]);
  // Una foto sirve siempre; lo que pide el diálogo para apagar «Muy corto».
  assert.equal(reemplazar(t, ref, foto).ok, true);
  assert.equal(alcanza({ type: 'image' }, 12000, TPS), true);
  assert.equal(alcanza({ type: 'video', duracion: 11.9 }, 12000, TPS), false);
  assert.deepEqual(requisitosDelReemplazo(t, ref), { acepta: 'ambos', necesita: 12000, esVideo: false });
});

test('3: a 2× un clip de 6 s pide 12 s de fuente, y la velocidad se conserva', () => {
  const { tracks, ref } = clipComun({}, { retime: { rate: 2 } });
  assert.equal(fuenteNecesaria(principal(tracks)[0]), 12000);
  assert.deepEqual(reemplazar(tracks, ref, video(11)), { ok: false, motivo: 'corto' });
  const r = principal(ok(reemplazar(tracks, ref, video(20))))[0] as VideoElement;
  assert.deepEqual([r.duration, r.trimStart, r.trimEnd, r.sourceDuration], [6000, 0, 8000, 20000]);
  assert.deepEqual(r.retime, { rate: 2 });
  // Con «Curva» manda la velocidad MEDIA de la curva (3×), no el `rate` guardado.
  const curva = clipComun({}, { retime: { rate: 2, mode: 'curve', curva: { preset: 'personalizado', puntos: [{ x: 0, y: 3 }, { x: 1, y: 3 }] } } });
  assert.equal(fuenteNecesaria(principal(curva.tracks)[0]), 18000);
  assert.deepEqual(reemplazar(curva.tracks, curva.ref, video(17)), { ok: false, motivo: 'corto' });
});

// ── 4–5: lo del clip pasa; lo del archivo, no ────────────────────────────────

test('4: conserva la transición, las animaciones, los efectos, las máscaras y los fotogramas', () => {
  const t = armar('antes-despues');
  const [antes, , antesArriba] = principal(t);
  const efectos = [{ id: 'ef1', type: 'filtro-calido', params: { intensidad: 60 }, enabled: true }];
  const mascaras = [{ id: 'mk1', type: 'rectangle', params: { feather: 4 } }] as never;
  const fotogramas = { opacity: { valueKind: 'number', keyframes: [{ id: 'k1', time: 0, value: 0.5 }] } } as never;
  const conTodo = { ...antes, effects: efectos, masks: mascaras, animations: fotogramas } as ClipReemplazable;
  const t2 = conElementos(t, new Map([[antes.id, conTodo]]));
  const [r, , rArriba] = principal(ok(reemplazar(t2, { trackId: 'principal', elementId: antes.id }, video(8))));
  assert.equal(r.params['transicion.id'], 'barrido-derecha');
  assert.equal(r.params['transicion.duracion'], 0.5);
  assert.deepEqual(r.effects, efectos);
  assert.deepEqual(r.masks, mascaras);
  assert.deepEqual(r.animations, fotogramas);
  // La hermana de arriba conserva SUS animaciones (no las del clip pedido).
  assert.equal(antesArriba.params[ANIM.entrada.id], 'deslizar-derecha');
  assert.deepEqual([rArriba.params[ANIM.entrada.id], rArriba.params[ANIM.entrada.duracion], rArriba.params[ANIM.salida.id]], ['deslizar-derecha', 0.5, 'desaparecer-gradualmente']);
  assert.equal(rArriba.effects, undefined);
});

test('5: lo del ARCHIVO viejo no pasa (normalizar, sonoridad, ritmos, revertir); lo del clip sí', () => {
  const { tracks, ref } = clipComun({
    volume: -3, 'audio.normalizarObjetivo': '-14', 'audio.fundidoEntrada': 0.5, 'clip.silenciadoAntes': true,
    'audio.normalizar': true, 'audio.intensidad': -20.5, 'audio.ritmos': '1.5,2', 'revertir.origen': '{"mediaId":"original"}',
  });
  const r = principal(ok(reemplazar(tracks, ref, video(10))))[0];
  for (const clave of ['audio.normalizar', 'audio.intensidad', 'audio.ritmos', 'revertir.origen']) assert.equal(r.params[clave], undefined, clave);
  assert.deepEqual(
    [r.params.volume, r.params['audio.normalizarObjetivo'], r.params['audio.fundidoEntrada'], r.params['clip.silenciadoAntes']],
    [-3, '-14', 0.5, true],
  );
  // El audio del archivo nuevo está en el clip (el extraído era del viejo).
  assert.equal(r.type === 'video' && r.isSourceAudioEnabled, true);
});

// ── 6–8: dónde se ve ─────────────────────────────────────────────────────────

test('6: el hueco que pide silencio entra silenciado; el otro, con su audio', () => {
  const t = armar('antes-despues');
  const [antes, , antesArriba] = principal(t);
  assert.equal(leerMarcas(antesArriba.params)?.silenciar, true);
  const [r, , rArriba] = principal(ok(reemplazar(t, { trackId: 'principal', elementId: antes.id }, video(8))));
  assert.equal(rArriba.params.muted, true);
  assert.equal(r.params.muted, false);
  assert.equal(leerMarcas(rArriba.params)?.silenciar, true, 'la marca queda: un segundo reemplazo también silencia');
});

test('7: un hueco cubre el MISMO rectángulo, recortando la fuente nueva a su proporción', () => {
  const t = armar('antes-despues');
  const [antes, , antesArriba] = principal(t);
  // La muestra de arriba se ve en la mitad de arriba: 1080x960 desde (0, 0).
  assert.deepEqual(rectoMostrado({ params: antesArriba.params, fuente: MUESTRA, lienzo: LIENZO }), { x: 0, y: 0, ancho: 1080, alto: 960 });
  const [r, , rArriba] = principal(ok(reemplazar(t, { trackId: 'principal', elementId: antes.id }, video(8))));
  // 1920x1080 en una celda de 1080x960 (1,125): pierde 18,36 % de cada costado, escala 1, centro en y −480.
  assert.deepEqual(
    ['recorte.izquierda', 'recorte.derecha', 'recorte.arriba', 'recorte.abajo', 'transform.scaleX', 'transform.scaleY', 'transform.positionX', 'transform.positionY'].map((k) => rArriba.params[k]),
    [0.1836, 0.1836, 0, 0, 1, 1, 0, -480],
  );
  const despues = rectoMostrado({ params: rArriba.params, fuente: { width: 1920, height: 1080 }, lienzo: LIENZO });
  for (const k of ['x', 'y', 'ancho', 'alto'] as const) assert.ok(cerca(despues[k], { x: 0, y: 0, ancho: 1080, alto: 960 }[k], 0.5), `${k}: ${despues[k]}`);
  // El de pantalla completa: 9:16 de una fuente 16:9 (como el armado, 0,3418).
  assert.equal(r.params['recorte.izquierda'], 0.3418);
  assert.equal(r.params['transform.scaleX'], 1);

  // Si la persona movió y achicó la muestra, se cubre donde la dejó.
  const movida = { ...antesArriba, params: { ...antesArriba.params, 'transform.scaleX': 0.5, 'transform.scaleY': 0.5, 'transform.positionX': 100 } };
  const enLienzo = rectoMostrado({ params: movida.params, fuente: MUESTRA, lienzo: LIENZO });
  assert.deepEqual(enLienzo, { x: 370, y: 240, ancho: 540, alto: 480 });
  const m = elementoReemplazado({ elemento: movida, medio: video(8), tps: TPS, lienzo: LIENZO, fuenteActual: MUESTRA, base });
  assert.ok(m.ok);
  assert.deepEqual([m.elemento.params['transform.scaleX'], m.elemento.params['transform.positionX'], m.elemento.params['transform.positionY']], [0.5, 100, -480]);
  const nuevo = rectoMostrado({ params: m.elemento.params, fuente: { width: 1920, height: 1080 }, lienzo: LIENZO });
  for (const k of ['x', 'y', 'ancho', 'alto'] as const) assert.ok(cerca(nuevo[k], enLienzo[k], 0.5), `${k}: ${nuevo[k]} vs ${enLienzo[k]}`);
});

test('8: un clip que no es hueco conserva su transform y su recorte', () => {
  const propios = { 'transform.scaleX': 0.7, 'transform.scaleY': 0.6, 'transform.positionX': 120, 'transform.positionY': -40, 'transform.rotate': 15, 'recorte.izquierda': 0.1, 'recorte.proporcion': '1:1', opacity: 0.8 };
  const { tracks, ref } = clipComun(propios);
  const r = principal(ok(reemplazar(tracks, ref, { ...foto, width: 500, height: 2000 })))[0];
  for (const [k, v] of Object.entries(propios)) assert.equal(r.params[k], v, k);
  assert.equal(leerMarcas(r.params), null);
  assert.equal(aceptaDe(r.params), 'ambos');
  assert.equal(aceptaMedio('video', 'image'), false);
  assert.equal(aceptaMedio('imagen', 'image'), true);
  assert.equal(aceptaMedio('ambos', 'video'), true);
});

// ── 9: los hermanos ──────────────────────────────────────────────────────────

test('9: una muestra llena todas las de su hueco (o ninguna); un hueco ya lleno, sólo él', () => {
  const t = armar('antes-despues');
  const [antes, despues, antesArriba] = principal(t);
  const despuesAbajo = t.overlay.find((x) => x.type === 'video')?.elements[0] as ClipReemplazable;
  const ref = { trackId: 'principal', elementId: antes.id };
  assert.deepEqual(objetivosDelReemplazo(t, ref).map((o) => o.elementId), [antes.id, antesArriba.id]);
  assert.equal(esMuestraEn(t, ref), true);
  // El «antes» de arriba dura 5 s: un video de 4 s alcanza para el de 3 s, pero no se llena ninguno.
  assert.deepEqual(requisitosDelReemplazo(t, ref)?.necesita, 5000);
  assert.deepEqual(reemplazar(t, ref, video(4)), { ok: false, motivo: 'corto' });
  const t2 = ok(reemplazar(t, ref, video(8)));
  const [a, d, aArriba, f] = principal(t2);
  assert.deepEqual([a.mediaId, aArriba.mediaId, d.mediaId, f.mediaId], ['v1', 'v1', 'm-despues', 'm-final']);
  assert.equal(quedanMuestras(t2), true, 'faltan los dos «después»');
  // Lo que no se tocó es el MISMO objeto (las pistas de texto, el clip de abajo).
  assert.equal(t2.overlay[0], t.overlay[0]);
  assert.equal(t2.overlay.find((x) => x.type === 'video')?.elements[0], despuesAbajo);
  // Ya no es muestra: reemplazarlo otra vez no toca a su hermana.
  assert.equal(esMuestraEn(t2, ref), false);
  assert.deepEqual(objetivosDelReemplazo(t2, ref).map((o) => o.elementId), [antes.id]);
  const t3 = ok(reemplazar(t2, ref, video(8, { mediaId: 'v2' })));
  assert.deepEqual(principal(t3).map((e) => e.mediaId), ['v2', 'm-despues', 'v1', 'm-final']);
  // Una hermana en una pista bloqueada no se toca.
  const bloqueada: SceneTracks = { ...t, overlay: t.overlay.map((x) => (x.type === 'video' ? { ...x, locked: true } : x)) };
  assert.deepEqual(objetivosDelReemplazo(bloqueada, { trackId: 'principal', elementId: despues.id }).map((o) => o.elementId), [despues.id]);
  assert.equal(objetivosDelReemplazo(t, { trackId: 'principal', elementId: 'no-existe' }).length, 0);
});

// ── 10–11: las entradas y la grilla del diálogo ──────────────────────────────

test('11: la grilla del diálogo: sin los medios ocultos ni el audio, y sólo lo que acepta el clip', () => {
  const medios = [
    { id: 'm-antes', type: 'image', ephemeral: true },
    { id: 'congelado', type: 'image', ephemeral: true },
    { id: 'musica', type: 'audio' },
    { id: 'v1', type: 'video' },
    { id: 'f1', type: 'image', ephemeral: false },
  ] as const;
  assert.deepEqual(mediosParaReemplazo(medios, 'ambos').map((m) => m.id), ['v1', 'f1']);
  assert.deepEqual(mediosParaReemplazo(medios, 'video').map((m) => m.id), ['v1']);
  assert.deepEqual(mediosParaReemplazo(medios, 'imagen').map((m) => m.id), ['f1']);
});


test('10: el menú abre el diálogo, el botón «Sustituir» existe y soltar sobre una muestra llama a reemplazarClip', () => {
  // `assert.ok(re.test(…))` y no `assert.match`: al fallar, match vuelca el archivo entero.
  const tiene = (fuente: string, re: RegExp, que: string) => assert.ok(re.test(fuente), que);
  const clip = leer('app/video-editor/_opencut/timeline/components/timeline-element.tsx');
  tiene(clip, /Reemplazar el clip/, 'el ítem del menú');
  assert.ok(!/<ContextMenuItem disabled>\s*Reemplazar el clip/.test(clip), 'el ítem sigue apagado');
  // Se abre fuera del onSelect del menú (la trampa de radix del pointer-events en <body>).
  tiene(clip, /setTimeout\(\(\) => abrirReemplazo\(/, 'el menú abre el diálogo con setTimeout');
  tiene(clip, /esMuestra && [^\n]*\n\s*<BotonSustituir/, 'el botón «Sustituir» va sólo en una muestra');
  tiene(clip, /leerMarcas\(element\.params\)\?\.muestra === true/, 'la muestra sale de la marca');

  const soltar = leer('app/video-editor/_opencut/timeline/controllers/drag-drop-controller.ts');
  const media = soltar.slice(soltar.indexOf('private executeMediaDrop('), soltar.indexOf('private executeEffectDrop('));
  const sobreClip = media.slice(media.indexOf('if (target.targetElement) {'), media.indexOf('return;', media.indexOf('if (target.targetElement) {')));
  tiene(sobreClip, /if \(esMuestraEn\(.*\)\) \{\s*reemplazarClip\(/, 'soltar sobre una muestra no reemplaza');
  assert.ok(!/not yet implemented/.test(media), 'queda el stub de OpenCut');

  // Una sola entrada: nadie de la pantalla arma el comando por su cuenta.
  const dialogo = leer('app/video-editor/_opencut/reemplazo/dialogo-reemplazar.tsx');
  tiene(dialogo, /reemplazarClip\(editor, objetivo, /, 'el diálogo pasa por reemplazarClip');
  tiene(dialogo, /mediosParaReemplazo\(medios, acepta\)/, 'la grilla del diálogo no es la del test 11');
  for (const [nombre, fuente] of [['timeline-element', clip], ['drag-drop', soltar], ['diálogo', dialogo]] as const) {
    assert.ok(!/new ReemplazarClipCommand/.test(fuente), `${nombre} arma el comando por su cuenta`);
  }
  tiene(leer('app/video-editor/_opencut/editor-page.tsx'), /<MigrationDialog \/>\s*(\{\/\*[^]*?\*\/\}\s*)?<DialogoReemplazar \/>/, 'el diálogo no está montado');
  // Congelar no se lleva las marcas de la plantilla (el cuadro congelado no es el hueco).
  tiene(leer('app/video-editor/_opencut/commands/timeline/element/congelar.ts'), /PREFIJOS_QUE_NO_PASAN = \[[^\]]*PREFIJO_PLANTILLA/, 'congelar');
});

// Roturas (15/10/2026), base 10 de 10 en verde (antes del 11); cada una restaurada (10/0 al final).
// Formato: pasan/fallan (los que caen).
// · puro, la fuente: trimEnd sin la velocidad → 9/1 (3). · fuenteNecesaria sin la velocidad → 9/1 (3).
//   · la velocidad = `rate` y no la media de la curva → 9/1 (3). · alcanza con > en vez de ≥ → 9/1 (2).
//   · sin conservar `retime` → 9/1 (3).
// · puro, los params: copiar TODOS los viejos → 7/3 (1, 5, 9). · copiar lo sin declarar (salvo la muestra)
//   → 8/2 (1, 5). · base vacía (no pasa nada del clip) → 7/3 (4, 5, 8). · sin las marcas de la plantilla
//   → 8/2 (1, 6). · deja la marca de muestra → 8/2 (1, 9). · sin los efectos → 9/1 (4).
//   · isSourceAudioEnabled copiado del viejo → 9/1 (5). · sin silenciar → 9/1 (6).
// · puro, dónde se ve: un hueco no se recubre → 8/2 (6, 7). · cubre el lienzo entero y no donde se ve
//   → 9/1 (7). · rectoMostrado sin el recorte → 9/1 (7). · rectoMostrado sin el encaje → 9/1 (7).
// · puro, las hermanas: sólo el clip pedido → 7/3 (6, 7, 9). · una hermana en pista bloqueada entra → 9/1 (9).
//   · hermanas de otro hueco de la plantilla → 9/1 (9). · una hermana corta no frena → 7/3 (2, 3, 9).
//   · rehace todas las pistas (pierde la identidad) → 9/1 (9).
// · el fuente: el ítem del menú apagado → 9/1 (10). · el menú abre sin setTimeout → 9/1 (10). · «Sustituir»
//   en todo clip → 9/1 (10). · el soltar no llama a reemplazarClip → 9/1 (10). · el diálogo arma el comando
//   → 9/1 (10). · el diálogo sin montar → 9/1 (10). · Congelar sin PREFIJO_PLANTILLA → 9/1 (10).
// Con el 11 (base 11 de 11): la grilla con los ocultos → 10/1 (11). · la grilla sin mirar lo que acepta
//   → 10/1 (11). · el diálogo filtra por su cuenta → 10/1 (10). Restaurado: 11/0.
// Lo que NO ve: que el diálogo y el botón se dibujen bien, que el clip nuevo se vea en el reproductor y que
// Ctrl+Z vuelva a la muestra (hace falta el navegador).

