// =============================================================================
// B-roll: «Cambiar por otra» y los videos de Pexels (pendientes-video-editor.md §4.1, 10/11/2026)
// =============================================================================
// Lo que fija este archivo, corriendo el código:
//   O1. LOS ARCHIVOS DE UN VIDEO (lib/editor-video/broll-pexels.ts): sólo mp4 de sus orígenes (con los parecidos de la
//       regla de origen), nada de 2K ni 4K, el más chico que se ve bien primero, y uno que pesó de más no deja probar
//       otro igual o más grande.
//   O2. UN VIDEO de su API: el crédito, la miniatura y la duración; y al proponer, uno más corto que su hueco no va.
//   O3. QUÉ ES UN B-ROLL de MaKo y qué no se repite: lo que muestra, lo que ya se vio en ese lugar y lo de su medio que
//       ya está en otro lugar.
//   O4. EL CAMBIO (app/video-editor/_opencut/broll/pistas.ts → `lineaConOtroBroll`): mismo id, lugar y tiempo; las
//       marcas de MaKo; el archivo nuevo cubre el MISMO rectángulo; un video entra con su fuente y con el sonido como lo
//       dejó la persona; lo demás de la línea no se toca.
//   O5. EL CHAT: la forma, la vista dice qué elemento es un B-roll, y la revisión rechaza lo que no lo es.
//   O6. EL CABLEADO (del fuente: el comando necesita el editor y el WASM): el botón «Otra», el chat y la API corren el
//       MISMO `cambiarBroll`; la ruta pide el video por su id, con la clave del negocio, y lo baja con la baranda.
//
// Correr: node --import tsx --test tests/video-editor-broll-otra.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_BYTES_VIDEO_BROLL,
  TOPES_VIDEO_BROLL,
  archivosDeVideoPexels,
  esMp4,
  fotosElegidas,
  siguienteArchivo,
  videoDePexels,
} from '../lib/editor-video/broll-pexels';
import {
  brollDe,
  brollsDejados,
  idsEnUso,
  lineaConOtroBroll,
  noRepetirEn,
  siguienteBroll,
  vistasDe,
  PARAM_AUTOR,
  PARAM_BUSQUEDA,
  PARAM_FOTO,
  PARAM_MOTIVO,
  PARAM_PROPUESTA,
  PARAM_VISTAS,
} from '../app/video-editor/_opencut/broll/pistas';
import { rectoMostrado, type MedioReemplazo } from '../app/video-editor/_opencut/reemplazo/puro';
import { textoDeCambioBroll, resumenDeCambioBroll } from '../app/video-editor/_opencut/broll/resultado';
import { validarOperacion } from '../lib/editor-video/chat-catalogo';
import { OPERACIONES_API, operacionDesdeInput } from '../lib/editor-video/chat-api';
import { despuesDe, elementosDeVista } from '../lib/editor-video/propuesta-bloque';
import { refsDeOperacion } from '../lib/editor-video/propuestas';
import { vistaDeLinea, revisarOperaciones, type OperacionResuelta } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import type { SceneTracks, TimelineElement } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const cerca = (a: unknown, b: number, tol = 0.6) => typeof a === 'number' && Math.abs(a - b) <= tol;

// ── O1. Los archivos de un video ─────────────────────────────────────────────

const archivo = (w: number, h: number, extra: Record<string, unknown> = {}) => ({
  file_type: 'video/mp4', width: w, height: h, link: `https://videos.pexels.com/video-files/1/1-${w}x${h}.mp4`, ...extra,
});

test('O1: los archivos de un video: mp4 de sus orígenes, de 360 a 1080 de lado corto, el de 540 primero', () => {
  const crudo = {
    video_files: [
      archivo(3840, 2160),                      // 4K: no
      archivo(2560, 1440),                      // 2K: no
      archivo(1920, 1080),
      archivo(1280, 720),
      archivo(960, 540),
      archivo(640, 360),
      archivo(426, 240),                        // menos de 360: no
      archivo(960, 540, { file_type: 'video/webm', link: 'https://videos.pexels.com/x.webm' }),
      archivo(960, 540),                        // repetido: una vez
      archivo(720, 1280, { link: 'https://player.vimeo.com/external/1.hd.mp4?s=abc' }),
    ],
  };
  const lista = archivosDeVideoPexels(crudo);
  assert.deepEqual(lista.map((a) => a.lado), [540, 720, 720, 1080, 360], 'de 540 en adelante del más chico, y después los más chicos');
  assert.ok(lista.every((a) => a.lado >= TOPES_VIDEO_BROLL.ladoMin && a.lado <= TOPES_VIDEO_BROLL.ladoMax));
  assert.equal(new Set(lista.map((a) => a.url)).size, lista.length, 'sin repetidos');
  assert.ok(lista.some((a) => a.url.startsWith('https://player.vimeo.com/')), 'los links viejos de su API (Vimeo) sirven');
  for (const mala of [
    'https://videos.pexels.com.evil.tld/a.mp4',
    'https://videos.pexels.com@evil.tld/a.mp4',
    'https://videos.pexels.comevil.tld/a.mp4',
    'https://videos.pexels.com:8443/a.mp4',
    'http://videos.pexels.com/a.mp4',
    'https://images.pexels.com/a.mp4',
  ]) {
    assert.deepEqual(archivosDeVideoPexels({ video_files: [archivo(960, 540, { link: mala })] }), [], mala);
  }
  assert.deepEqual(archivosDeVideoPexels({}), []);
  assert.deepEqual(archivosDeVideoPexels(null), []);
});

test('O1b: uno que pesó de más no deja probar otro igual o más grande; sí uno más chico', () => {
  const lista = archivosDeVideoPexels({ video_files: [archivo(1280, 720), archivo(960, 540), archivo(640, 360)] });
  const probados = new Set<string>();
  const primero = siguienteArchivo(lista, probados, Infinity)!;
  assert.equal(primero.lado, 540);
  probados.add(primero.url);
  // El de 540 pesó de más: el de 720 no se prueba (más píxeles, más peso); el de 360, sí.
  assert.equal(siguienteArchivo(lista, probados, 540)?.lado, 360);
  // Si el de 540 falló por la red (sin techo), el siguiente es el de 720.
  assert.equal(siguienteArchivo(lista, probados, Infinity)?.lado, 720);
  probados.add(lista.find((a) => a.lado === 360)!.url);
  assert.equal(siguienteArchivo(lista, probados, 540), null);
  assert.equal(MAX_BYTES_VIDEO_BROLL, 4 * 1024 * 1024, 'por debajo del tope de ~4,5 MB de una respuesta de Vercel');
});

test('O1c: un MP4 se reconoce por su caja «ftyp», no por lo que dice el tercero', () => {
  const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0]);
  assert.equal(esMp4(mp4), true);
  assert.equal(esMp4(new TextEncoder().encode('<html><body>no</body></html>')), false);
  assert.equal(esMp4(mp4.slice(0, 8)), false, 'cortado');
});

// ── O2. Un video de su API ───────────────────────────────────────────────────

const VIDEO = {
  id: 857251, width: 1920, height: 1080, duration: 12, url: 'https://www.pexels.com/video/cafe-857251/',
  image: 'https://images.pexels.com/videos/857251/free-video-857251.jpg', user: { name: 'Ana Pérez' }, video_files: [],
};

test('O2: un video de Pexels: crédito, miniatura de images.pexels.com y duración; sin eso, no sirve', () => {
  assert.deepEqual(videoDePexels(VIDEO), {
    id: 857251, ancho: 1920, alto: 1080, duracion: 12, autor: 'Ana Pérez', pagina: 'https://www.pexels.com/video/cafe-857251/',
    mini: 'https://images.pexels.com/videos/857251/free-video-857251.jpg',
  });
  assert.equal(videoDePexels({ ...VIDEO, image: undefined, video_pictures: [{ picture: 'https://images.pexels.com/p.jpg' }] })?.mini, 'https://images.pexels.com/p.jpg');
  assert.equal(videoDePexels({ ...VIDEO, image: 'https://evil.tld/p.jpg' }), null, 'una miniatura de otro lado');
  assert.equal(videoDePexels({ ...VIDEO, duration: 0 }), null);
  assert.equal(videoDePexels({ ...VIDEO, id: 'x' }), null);
});

test('O2b: al proponer, un video más corto que su hueco no va, y lo que la persona ya dejó no se repite', () => {
  const v = (id: number, duracion: number) => ({ id, duracion });
  const elegidos = [{ hueco: 0, busqueda: 'cafe', motivo: '' }, { hueco: 1, busqueda: 'cafe', motivo: '' }];
  const largo: Record<number, number> = { 0: 3, 1: 4 };
  const pares = fotosElegidas(elegidos, [{ consulta: 'cafe', fotos: [v(1, 10), v(2, 2), v(3, 3.5), v(4, 6)] }], {
    yaUsadas: new Set([1]),
    sirve: (item, e) => item.duracion >= largo[e.hueco],
  });
  assert.deepEqual(pares.map((p) => [p.elegido.hueco, p.foto.id]), [[0, 3], [1, 4]]);
});

// ── O3 y O4. Un B-roll de MaKo y su cambio ───────────────────────────────────

const TPS = 1000;
const LIENZO = { width: 1080, height: 1920 };
const base = (tipo: string): Record<string, string | number | boolean> => ({
  'transform.scaleX': 1, 'transform.scaleY': 1, 'transform.positionX': 0, 'transform.positionY': 0, 'transform.rotate': 0, opacity: 1,
  'recorte.izquierda': 0, 'recorte.arriba': 0, 'recorte.derecha': 0, 'recorte.abajo': 0, 'recorte.proporcion': 'libre',
  'transicion.id': '', 'transicion.duracion': 0.5,
  ...(tipo === 'video' ? { volume: 0, muted: false } : {}),
});
const TAMANOS: Record<string, { width: number; height: number }> = { mf: { width: 1080, height: 1920 }, mv: { width: 1080, height: 1920 } };
const tamanoDe = (id: string) => TAMANOS[id] ?? null;
const marcas = (foto: string, extra: Record<string, unknown> = {}) => ({
  [PARAM_PROPUESTA]: 'broll', [PARAM_BUSQUEDA]: 'cafe', [PARAM_FOTO]: foto, [PARAM_AUTOR]: 'Luis', [PARAM_MOTIVO]: 'se habla del café', ...extra,
});
const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
  ({ id, type, name: `B-roll: cafe`, startTime: ini * TPS, duration: dur * TPS, trimStart: 0, trimEnd: 0, params: {}, ...extra });

function escena(): SceneTracks {
  return {
    overlay: [
      {
        id: 'pbr', type: 'video', name: 'B-roll', muted: false, hidden: false, elements: [
          // Una foto propuesta, achicada y corrida por la persona (la mitad, 100 a la derecha, 200 arriba).
          el('br1', 'image', 2, 3, { mediaId: 'mf', params: { ...base('image'), 'transform.scaleX': 0.5, 'transform.scaleY': 0.5, 'transform.positionX': 100, 'transform.positionY': -200, ...marcas('11', { [PARAM_VISTAS]: '7,8' }) } }),
          // Un video que la persona ya DEJÓ (sin marca de propuesta).
          el('br2', 'video', 8, 3, { mediaId: 'mv', trimEnd: 5 * TPS, sourceDuration: 8 * TPS, params: { ...base('video'), muted: true, ...marcas('22', { [PARAM_PROPUESTA]: '' }) } }),
          // Una foto de la persona: no es un B-roll.
          el('img9', 'image', 12, 2, { mediaId: 'mp', params: { ...base('image') } }),
        ],
      },
    ],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [el('vid1', 'video', 0, 20, { mediaId: 'm1', name: 'clase.mp4' })] },
    audio: [],
  } as unknown as SceneTracks;
}
const elDe = (t: SceneTracks, id: string) => t.overlay.flatMap((p) => p.elements as TimelineElement[]).find((e) => e.id === id)!;
const otro = (ref: string, medio: MedioReemplazo, foto = { id: 99, autor: 'Marta' }, tracks = escena()) =>
  lineaConOtroBroll({ tracks, ref: { trackId: 'pbr', elementId: ref }, medio, foto, tps: TPS, lienzo: LIENZO, tamanoDe, base });

test('O3: qué es un B-roll de MaKo (propuesto o dejado), y qué no se le vuelve a traer', () => {
  const t = escena();
  assert.deepEqual(brollDe(elDe(t, 'br1')), { busqueda: 'cafe', medio: 'fotos', foto: 11 });
  assert.deepEqual(brollDe(elDe(t, 'br2')), { busqueda: 'cafe', medio: 'videos', foto: 22 }, 'uno ya dejado también');
  assert.equal(brollDe(elDe(t, 'img9')), null, 'una foto de la persona no');
  assert.equal(brollDe({ ...elDe(t, 'br1'), type: 'text' } as TimelineElement), null);
  assert.equal(brollDe({ ...elDe(t, 'br1'), params: marcas('https://evil.tld/x') } as TimelineElement), null, 'el id es un número');
  assert.deepEqual(vistasDe(elDe(t, 'br1')), [7, 8]);
  assert.deepEqual([...idsEnUso(t, 'fotos')], [11]);
  assert.deepEqual([...idsEnUso(t, 'videos')], [22]);
  // Lo que muestra, lo que ya se vio ahí y lo de SU medio en otro lugar; el video 22 es de otro medio.
  assert.deepEqual([...noRepetirEn(t, elDe(t, 'br1'))].sort((a, b) => a - b), [7, 8, 11]);
  assert.equal(siguienteBroll([{ id: 7 }, { id: 11 }, { id: 22 }, { id: 30 }], noRepetirEn(t, elDe(t, 'br1')))?.id, 22);
  assert.equal(siguienteBroll([{ id: 7 }, { id: 11 }], noRepetirEn(t, elDe(t, 'br1'))), null, 'no hay otra');
  assert.deepEqual(brollsDejados(t).map((p) => p.element.id), ['br2'], 'la sección lista los dejados aparte');
});

test('O4: otra foto: mismo id, lugar y tiempo, las marcas de MaKo, y el archivo nuevo cubre el MISMO rectángulo', () => {
  const t = escena();
  const cuadrada: MedioReemplazo = { mediaId: 'mf2', type: 'image', nombre: 'pexels-99.jpg', width: 1080, height: 1080 };
  const r = otro('br1', cuadrada, { id: 99, autor: 'Marta' }, t);
  assert.ok(r.ok);
  const nuevo = elDe(r.tracks, 'br1');
  const viejo = elDe(t, 'br1');
  assert.deepEqual([nuevo.type, nuevo.startTime, nuevo.duration, nuevo.name, (nuevo as { mediaId: string }).mediaId], ['image', 2000, 3000, 'B-roll: cafe', 'mf2']);
  assert.equal(nuevo.params[PARAM_PROPUESTA], 'broll', 'sigue propuesto: se deja o se saca igual');
  assert.equal(nuevo.params[PARAM_BUSQUEDA], 'cafe');
  assert.equal(nuevo.params[PARAM_MOTIVO], 'se habla del café');
  assert.equal(nuevo.params[PARAM_FOTO], '99');
  assert.equal(nuevo.params[PARAM_AUTOR], 'Marta', 'el crédito es el de la foto nueva');
  assert.equal(nuevo.params[PARAM_VISTAS], '7,8,11', 'la de antes queda vista');
  // La cuadrada se recorta a los costados para cubrir el mismo rectángulo donde se veía la vertical.
  assert.ok(cerca(nuevo.params['recorte.izquierda'], 0.2188, 0.001) && cerca(nuevo.params['recorte.derecha'], 0.2188, 0.001));
  assert.equal(nuevo.params['recorte.arriba'], 0);
  const antes = rectoMostrado({ params: viejo.params, fuente: TAMANOS.mf, lienzo: LIENZO });
  const despues = rectoMostrado({ params: nuevo.params, fuente: { width: 1080, height: 1080 }, lienzo: LIENZO });
  for (const k of ['x', 'y', 'ancho', 'alto'] as const) assert.ok(cerca(despues[k], antes[k], 1), `${k}: ${despues[k]} contra ${antes[k]}`);
  // Lo demás de la línea no se toca (las mismas referencias).
  assert.equal(elDe(r.tracks, 'br2'), elDe(t, 'br2'));
  assert.equal(r.tracks.main, t.main);
  // Sin estar en las vistas ni en la línea, la elegida no se repite: la de antes no vuelve.
  assert.ok(noRepetirEn(r.tracks, nuevo).has(11) && noRepetirEn(r.tracks, nuevo).has(99));
});

test('O4b: otro video: con su fuente entera y el sonido como estaba; uno más corto que el lugar, una foto, o algo que no es un B-roll, no', () => {
  const video = (duracion: number): MedioReemplazo => ({ mediaId: 'mv2', type: 'video', nombre: 'pexels-5.mp4', width: 1080, height: 1920, duracion });
  const r = otro('br2', video(10), { id: 5, autor: 'Sol' });
  assert.ok(r.ok);
  const n = elDe(r.tracks, 'br2') as TimelineElement & { trimEnd: number; sourceDuration: number };
  assert.deepEqual([n.type, n.startTime, n.duration, n.trimStart, n.trimEnd, n.sourceDuration], ['video', 8000, 3000, 0, 7000, 10000]);
  assert.equal(n.params.muted, true, 'propuesto silenciado: el B-roll no tapa la voz de quien habla');
  // Si la persona le prendió el sonido, el de reemplazo lo conserva (es su decisión, no la de MaKo).
  const conSonido = escena();
  const br2 = elDe(conSonido, 'br2');
  br2.params = { ...br2.params, muted: false };
  const r2 = otro('br2', video(10), { id: 5, autor: 'Sol' }, conSonido);
  assert.ok(r2.ok);
  assert.equal(elDe(r2.tracks, 'br2').params.muted, false);
  assert.equal(n.params[PARAM_PROPUESTA], '', 'un B-roll dejado sigue dejado');
  assert.deepEqual(otro('br2', video(2)), { ok: false, motivo: 'corto' });
  assert.deepEqual(otro('br2', { mediaId: 'f', type: 'image', nombre: 'x.jpg', width: 10, height: 10 }), { ok: false, motivo: 'tipo' }, 'un video se cambia por otro video');
  assert.deepEqual(otro('img9', { mediaId: 'f', type: 'image', nombre: 'x.jpg' }), { ok: false, motivo: 'sin-broll' });
  assert.deepEqual(otro('no-existe', { mediaId: 'f', type: 'image', nombre: 'x.jpg' }), { ok: false, motivo: 'sin-broll' });
});

test('O4c: lo que se le dice a la persona: el motivo, o el crédito de lo nuevo', () => {
  assert.match(textoDeCambioBroll({ ok: false, motivo: 'sin-otra' }), /No hay otra imagen de esa búsqueda/);
  assert.match(textoDeCambioBroll({ ok: false, motivo: 'sin-broll' }), /no es un B-roll de MaKo/);
  assert.equal(textoDeCambioBroll({ ok: false, motivo: 'pexels', detalle: 'Pexels no aceptó tu clave.' }), 'Pexels no aceptó tu clave.');
  assert.equal(resumenDeCambioBroll({ ok: true, medio: 'videos', autor: 'Sol' }), 'Otro video en su lugar (de Sol, en Pexels).');
  assert.equal(resumenDeCambioBroll({ ok: true, medio: 'fotos', autor: '' }), 'Otra imagen en su lugar.');
});

// ── O5. El chat y la API ─────────────────────────────────────────────────────

const VISTA = () => vistaDeLinea({
  tracks: escena(), tps: TPS, cabezal: 0, elegidos: [], disponibles: disponiblesDelMotor(), lienzo: { ancho: 1080, alto: 1920 },
  medios: [{ id: 'm1', name: 'clase.mp4', type: 'video' as const, duration: 30, hasAudio: true, width: 1920, height: 1080 }],
  fondo: null,
});
const refDe = (vis: ReturnType<typeof VISTA>, id: string) => [...vis.refs.values()].find((r) => r.elementId === id)!.ref;
const revisar = (ops: unknown[], vis = VISTA()) =>
  revisarOperaciones({ operaciones: ops.map((o) => { const r = validarOperacion(o); assert.ok(r.ok, r.ok ? '' : r.motivo); return r.op; }), vista: vis, alcance: 'video' });

test('O5: la forma: «cambiar_broll» lleva sólo su ref, y «broll» puede traer videos', () => {
  assert.deepEqual(validarOperacion({ op: 'cambiar_broll', ref: 'v2' }), { ok: true, op: { op: 'cambiar_broll', ref: 'v2' } });
  assert.equal(validarOperacion({ op: 'cambiar_broll' }).ok, false);
  assert.equal(validarOperacion({ op: 'cambiar_broll', ref: 'v2', foto: 3 }).ok, false, 'el chat no elige cuál');
  assert.deepEqual(validarOperacion({ op: 'broll', videos: true }), { ok: true, op: { op: 'broll', videos: true } });
  assert.deepEqual(validarOperacion({ op: 'broll', videos: false }), { ok: true, op: { op: 'broll' } }, 'sin videos, fotos (lo de siempre)');
  assert.equal(validarOperacion({ op: 'broll', videos: 'si' }).ok, false);
  const api = OPERACIONES_API.find((o) => o.op === 'cambiar_broll')!;
  assert.equal(api.id, 'otra_imagen_broll');
  assert.equal(OPERACIONES_API.at(-1)?.op, 'cambiar_broll', 'una operación nueva va al final del área');
  assert.doesNotMatch(`${api.id} ${api.titulo}`, /video/i, 'sin la palabra de todas las del área');
  assert.deepEqual(operacionDesdeInput(api, { proyecto: 'p', ref: 'v2' }), { ok: true, op: { op: 'cambiar_broll', ref: 'v2' } });
  const deBroll = OPERACIONES_API.find((o) => o.op === 'broll')!;
  assert.deepEqual(operacionDesdeInput(deBroll, { proyecto: 'p', videos: true }), { ok: true, op: { op: 'broll', videos: true } });
  assert.ok(deBroll.parametros.some((p) => p.nombre === 'videos'), 'la API también puede pedir videos');
  // La tarjeta dice si trae otro video u otra imagen (la vista dice el tipo); sin saberlo, no afirma ninguno.
  const vistaGuardada = { pistas: [{ elementos: [{ ref: 'v2', tipo: 'video', nombre: 'B-roll' }, { ref: 'i1', tipo: 'imagen', nombre: 'B-roll' }] }] };
  const deLaVista = (ref: string) => despuesDe({ op: 'cambiar_broll', ref }, elementosDeVista(vistaGuardada));
  assert.equal(deLaVista('v2'), 'Otro video de la misma búsqueda, en el mismo lugar');
  assert.equal(deLaVista('i1'), 'Otra imagen de la misma búsqueda, en el mismo lugar');
  assert.equal(despuesDe({ op: 'cambiar_broll', ref: 'v2' }), 'Otro archivo de la misma búsqueda, en el mismo lugar');
  assert.match(despuesDe({ op: 'broll', videos: true }), /B-roll en video/);
  assert.deepEqual(refsDeOperacion({ op: 'cambiar_broll', ref: 'v2' }), { usa: ['v2'], medios: [], define: [] });
});

test('O5b: la vista dice qué elemento es un B-roll; la revisión lo cambia una vez y rechaza lo que no lo es', () => {
  const vis = VISTA();
  const j = JSON.parse(vis.json);
  const elementos = j.pistas.flatMap((p: { elementos: unknown[] }) => p.elementos) as Array<Record<string, unknown>>;
  assert.equal(elementos.find((e) => e.ref === refDe(vis, 'br1'))!.broll, 'cafe');
  assert.equal(elementos.find((e) => e.ref === refDe(vis, 'br2'))!.broll, 'cafe');
  assert.equal(elementos.find((e) => e.ref === refDe(vis, 'img9'))!.broll, undefined);

  const r = revisar([{ op: 'cambiar_broll', ref: refDe(vis, 'br2') }], vis);
  assert.deepEqual(r.descartes, []);
  const c = r.resueltas[0] as Extract<OperacionResuelta, { op: 'cambiar_broll' }>;
  assert.deepEqual([c.op, c.el.elementId, c.busqueda], ['cambiar_broll', 'br2', 'cafe']);
  assert.match(r.cambios[0].despues, /el siguiente video de «cafe» en Pexels, en el mismo lugar/);
  assert.equal(r.cambios[0].antes, 'el video de ahora');

  assert.match(revisar([{ op: 'cambiar_broll', ref: refDe(vis, 'img9') }], vis).descartes.join(), /no es un B-roll de MaKo/);
  assert.match(revisar([{ op: 'cambiar_broll', ref: refDe(vis, 'vid1') }], vis).descartes.join(), /no es un B-roll de MaKo/);
  const dos = revisar([{ op: 'cambiar_broll', ref: refDe(vis, 'br1') }, { op: 'cambiar_broll', ref: refDe(vis, 'br1') }], vis);
  assert.equal(dos.resueltas.length, 1);
  assert.match(dos.descartes.join(), /ya se cambia por otra en este mismo pedido/);
  const borrado = revisar([{ op: 'borrar', refs: [refDe(vis, 'br1')] }, { op: 'cambiar_broll', ref: refDe(vis, 'br1') }], vis);
  assert.match(borrado.descartes.join(), /ya se borra en este mismo cambio/);
  const videos = revisar([{ op: 'broll', videos: true }], vis);
  assert.deepEqual(videos.resueltas[0], { op: 'broll', ritmo: 'normal', planos: true, videos: true });
  assert.match(videos.cambios[0].despues, /^videos cortos de Pexels/);
});

// ── O6. El cableado ──────────────────────────────────────────────────────────

test('O6: el botón, el chat y la API corren el MISMO cambio; la ruta pide el video por su id y lo baja con la baranda', () => {
  const vista = sinComentarios(leer('app/video-editor/_opencut/broll/components/broll-view.tsx'));
  assert.match(vista, /onClick=\{\(\) => void cambiarBroll\(editor, \{ trackId: p\.trackId, elementId: p\.element\.id \}\)\}/, 'el botón «Otra»');
  assert.match(vista, /proponerBroll\(editor, \{ ritmo: prefs\.ritmo, planos: prefs\.planos, medio: prefs\.medio \}\)/, 'el selector de fotos o videos llega a proponer');
  const aplicar = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  assert.match(aplicar, /if \(r\.op === "cambiar_broll"\) \{[\s\S]*?cambiarBroll\(editor, \{ trackId: r\.el\.trackId, elementId: r\.el\.elementId \}\)[\s\S]*?textoDeCambioBroll\(hecho\)/);
  assert.match(aplicar, /proponerBroll\(editor, \{ ritmo: r\.ritmo, planos: r\.planos, medio: r\.videos \? "videos" : "fotos" \}\)/);
  assert.match(sinComentarios(leer('app/video-editor/_opencut/chat/comandos.ts')), /const LARGAS = new Set[^\n]*"cambiar_broll"/, 'baja de Pexels: después del lote');
  assert.match(sinComentarios(leer('lib/api-mako/areas/video.run.ts')), /otra_imagen_broll: \{ \.\.\.enElEditor\('otra_imagen_broll'\) \},/);
  const cambiar = sinComentarios(leer('app/video-editor/_opencut/broll/cambiar.ts'));
  assert.match(cambiar, /new TracksSnapshotCommand\(\{ before: ahora, after: r\.tracks \}\)/, 'un paso de deshacer, contra la línea de ahora');
  assert.match(cambiar, /lineaConOtroBroll\(/);
  const ruta = sinComentarios(leer('app/api/video-editor/broll/route.ts'));
  assert.match(ruta, /if \(!\/\^\\d\{1,12\}\$\/\.test\(idVideo\)\)/, 'el video se pide por id numérico');
  assert.match(ruta, /bajarVideoPexels\(clave\.clave, Number\(idVideo\)\)/);
  assert.doesNotMatch(ruta, /searchParams\.get\('url'\)|process\.env/);
  const pexels = sinComentarios(leer('lib/pexels.ts'));
  assert.match(pexels, /bajarWebSegura\(url, \{\s*validar: validarDestino,/, 'cada salto revalidado');
  assert.match(pexels, /maxBytes: MAX_BYTES_VIDEO_BROLL \+ 1, timeoutMs: ms/, 'un byte más que el techo, y el plazo del salto');
  // Qué archivo se devuelve (nunca un MP4 cortado, ni algo que no es un MP4) lo decide `primerVideoQueEntra`, que corre
  // tests/video-editor-revision-chat-broll.test.ts (R6).
  assert.match(pexels, /const hecho = await primerVideoQueEntra\(\{/);
  assert.doesNotMatch(pexels, /process\.env/);
  // lib/pexels.ts está en la lista de «fetch a hosts fijos» de tests/landing-analisis-ssrf.test.ts: el único `fetch`
  // pelado es el de la API, a un host escrito en el código.
  assert.equal([...pexels.matchAll(/(^|[^\w.])fetch\(/gm)].length, 1, 'un solo fetch pelado');
  assert.match(pexels, /const url = new URL\(ruta, ORIGEN_API_PEXELS\);[\s\S]{0,200}?await fetch\(url, \{ headers: \{ Authorization: clave \}/);
  const proponer = sinComentarios(leer('app/video-editor/_opencut/broll/proponer.ts'));
  assert.match(proponer, /\.\.\.\(conVideos \? \{ muted: true \} : \{\}\)/, 'un video propuesto entra sin sonido');
});

// PROBADO ROMPIÉNDOLO (10/11/2026, base 12/0; una rotura por vez, restaurada de memoria):
//   · los archivos de 2K pasan (ladoMax 1440)                                     -> 11/1 (O1)
//   · el origen del video por prefijo (`startsWith`)                              -> 11/1 (O1)
//   · los de menos de 540 primero                                                 -> 10/2 (O1, O1b)
//   · `siguienteArchivo` sin mirar el techo                                       -> 11/1 (O1b)
//   · esMp4 sin mirar el largo                                                    -> 11/1 (O1c)
//   · videoDePexels acepta una miniatura de cualquier lado                        -> 11/1 (O2)
//   · `fotosElegidas` sin `yaUsadas`                                              -> 11/1 (O2b)
//   · brollDe acepta un texto                                                     -> 11/1 (O3)
//   · noRepetirEn sin las vistas                                                  -> 10/2 (O3, O4)
//   · idsEnUso mezcla fotos y videos                                              -> 11/1 (O3)
//   · lineaConOtroBroll sin recalcular la cobertura                               -> 11/1 (O4)
//   · lineaConOtroBroll sin las marcas de MaKo                                    -> 10/2 (O4, O4b)
//   · lineaConOtroBroll sin guardar la de antes en las vistas                     -> 11/1 (O4)
//   · el cambio fuerza el sonido apagado (pisa lo que eligió la persona)          -> 11/1 (O4b)
//   · un video que no es del mismo medio pasa                                     -> 11/1 (O4b)
//   · la revisión acepta una foto de la persona                                   -> 11/1 (O5b)
//   · la revisión deja cambiar dos veces el mismo                                 -> 11/1 (O5b)
//   · la vista no dice "broll"                                                    -> 11/1 (O5b)
//   · un video propuesto entra con sonido                                         -> 11/1 (O6)
//   · el chat le pasa a cambiarBroll otro elemento                                -> 11/1 (O6)
//   · la bajada devuelve lo leído aunque pase del techo                           -> 11/1 (O6; desde el 10/11/2026 lo
//     ve R6 de tests/video-editor-revision-chat-broll.test.ts, que corre `primerVideoQueEntra`)
//   · un `fetch` pelado a un archivo de video en lib/pexels.ts                    -> 11/1 (O6)
//   · un cambio sin efecto (renombrar `CANDIDATAS` en cambiar.ts)                  -> 12/0
// Lo que NO ve este archivo: la búsqueda y la bajada contra el Pexels de verdad (la sandbox no llega a su API), y que el
// comando haga en pantalla lo que dice la fila: eso se mira en el navegador.
