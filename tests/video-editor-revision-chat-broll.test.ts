// =============================================================================
// Lo que encontró la revisión adversarial del chat que duplica y del B-roll que cambia (10/11/2026)
// =============================================================================
// Sobre los commits del chat «duplicar, fondo, efectos…» y de «Otra» con videos de Pexels. Lo que fija este archivo,
// corriendo el código:
//   R1. LA COPIA DE UN DUPLICAR TODAVÍA NO EXISTE para lo que corre después del lote (cambiar_broll, revertir, congelar,
//       normalizar, borrar_silencios con ref): se rechaza con un motivo que dice qué hacer, y no con el falso que daba
//       al aplicar («no es un B-roll de MaKo», «no se pudo revertir»). Y lo repetido se mira por la ref, no por el id.
//   R2. LA COPIA NACE COMO ESTÁ EL ORIGINAL EN ESE MOMENTO del pedido (oculto, silenciado, volumen), no al empezar.
//   R3. DE LOS AJUSTES DEL PROYECTO EL CHAT MIRA SÓLO EL FONDO (chat/fondo-proyecto.ts): unos fps que suben solos no son un
//       paso ni le apagan «Restaurar»; y el B-roll de Pexels entra a Multimedia sin subirle los fps al proyecto.
//   R4. «OTRA» NO CAMBIA UN B-ROLL DE UNA PISTA BLOQUEADA, ni antes ni después de bajar el archivo, y si la persona lo saca
//       mientras se traía lo dice así; el botón sale apagado.
//   R5. LOS TEXTOS: «para los videos», «Otro video», y lo que no sale dice qué hacer.
//   R6. EL PLAZO TOTAL DE UN VIDEO (lib/editor-video/broll-pexels.ts → `primerVideoQueEntra`): cada salto con lo que queda,
//       todo dentro del `maxDuration` de la ruta; y el archivo que se devuelve nunca es uno cortado ni uno que no es MP4.
//
// Correr: node --import tsx --test tests/video-editor-revision-chat-broll.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarOperacion } from '../lib/editor-video/chat-catalogo';
import { vistaDeLinea, revisarOperaciones, type OperacionResuelta } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import { mismoFondo } from '../app/video-editor/_opencut/chat/fondo-proyecto';
import {
  PARAM_BUSQUEDA, PARAM_FOTO, PARAM_PROPUESTA, brollsDejados, lineaConOtroBroll, pendientesDe, puedeCambiarBroll,
} from '../app/video-editor/_opencut/broll/pistas';
import { avisoFaltaPexels, motivoSiNoSePuede, textoDeCambioBroll, TEXTO_MOTIVO_CAMBIO_BROLL } from '../app/video-editor/_opencut/broll/resultado';
import {
  FALLA_VIDEO_PEXELS, MAX_BYTES_VIDEO_BROLL, PLAZO_MINIMO_PEDIDO_MS, PLAZO_PEDIDO_VIDEO_MS, PLAZO_VIDEO_BROLL_MS,
  plazoDelPedido, primerVideoQueEntra, type ArchivoVideoPexels,
} from '../lib/editor-video/broll-pexels';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const TPS = 1000;
const base = (tipo: string): Record<string, string | number | boolean> => ({
  'transform.scaleX': 1, 'transform.scaleY': 1, 'transform.positionX': 0, 'transform.positionY': 0, 'transform.rotate': 0, opacity: 1,
  ...(tipo === 'video' ? { volume: 0, muted: false } : {}),
});
const marcas = (foto: string, extra: Record<string, unknown> = {}) => ({ [PARAM_PROPUESTA]: 'broll', [PARAM_BUSQUEDA]: 'cafe', [PARAM_FOTO]: foto, ...extra });
const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
  ({ id, type, name: 'B-roll: cafe', startTime: ini * TPS, duration: dur * TPS, trimStart: 0, trimEnd: 0, params: {}, ...extra });

/** Un B-roll foto (br1), un B-roll video dejado (br2), una foto de la persona (img9) y el video que habla. */
function escena({ bloqueada = false } = {}): SceneTracks {
  return {
    overlay: [
      {
        id: 'pbr', type: 'video', name: 'B-roll', muted: false, hidden: false, ...(bloqueada ? { locked: true } : {}), elements: [
          el('br1', 'image', 2, 3, { mediaId: 'mf', params: { ...base('image'), ...marcas('11') } }),
          el('br2', 'video', 8, 3, { mediaId: 'mv', trimEnd: 5 * TPS, sourceDuration: 8 * TPS, params: { ...base('video'), muted: true, ...marcas('22', { [PARAM_PROPUESTA]: '' }) } }),
          el('img9', 'image', 12, 2, { mediaId: 'mp', params: { ...base('image') } }),
        ],
      },
    ],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [el('vid1', 'video', 0, 20, { mediaId: 'm1', name: 'clase.mp4', params: base('video') })] },
    audio: [],
  } as unknown as SceneTracks;
}
const VISTA = (t = escena()) => vistaDeLinea({
  tracks: t, tps: TPS, cabezal: 0, elegidos: [], disponibles: disponiblesDelMotor(), lienzo: { ancho: 1080, alto: 1920 },
  medios: [{ id: 'm1', name: 'clase.mp4', type: 'video' as const, duration: 30, hasAudio: true, width: 1920, height: 1080 }],
  fondo: null,
});
const refDe = (vis: ReturnType<typeof VISTA>, id: string) => [...vis.refs.values()].find((r) => r.elementId === id)!.ref;
const revisar = (ops: unknown[], vis = VISTA()) =>
  revisarOperaciones({ operaciones: ops.map((o) => { const r = validarOperacion(o); assert.ok(r.ok, r.ok ? '' : r.motivo); return r.op; }), vista: vis, alcance: 'video' });

// ── R1. La copia todavía no existe ───────────────────────────────────────────

const NO_EXISTE = /todavía no existe \(se crea al aceptar este pedido\): pídelo en otro pedido/;

test('R1: lo que corre después del lote rechaza la copia de un duplicar, diciendo qué hacer (y no llega a aplicarse)', () => {
  const vis = VISTA();
  const br2 = refDe(vis, 'br2');
  const vid1 = refDe(vis, 'vid1');
  const casos: Array<[string, unknown[]]> = [
    ['cambiar_broll', [{ op: 'duplicar', ref: br2, copia: 'n1' }, { op: 'cambiar_broll', ref: 'n1' }]],
    ['revertir', [{ op: 'duplicar', ref: vid1, copia: 'n1' }, { op: 'revertir', ref: 'n1', revertido: true }]],
    ['congelar', [{ op: 'duplicar', ref: vid1, copia: 'n1' }, { op: 'congelar', ref: 'n1', en: 1 }]],
    ['borrar_silencios', [{ op: 'duplicar', ref: vid1, copia: 'n1' }, { op: 'borrar_silencios', ref: 'n1' }]],
    ['normalizar', [{ op: 'duplicar', ref: vid1, copia: 'n1' }, { op: 'normalizar', ref: 'n1', activo: true }]],
  ];
  for (const [que, ops] of casos) {
    const r = revisar(ops, vis);
    assert.deepEqual(r.resueltas.map((x) => x.op), ['duplicar'], `${que}: sólo el duplicar se aplica`);
    assert.equal(r.descartes.length, 1, `${que}: ${r.descartes.join(' | ')}`);
    assert.match(r.descartes[0], NO_EXISTE, que);
    assert.match(r.descartes[0], /^Copia de /, `${que}: nombra a la copia`);
    // Ninguna resuelta lleva un elemento sin id: al aplicar, el motor no lo encontraría.
    for (const x of r.resueltas as Array<OperacionResuelta & { el?: { elementId: string } }>) assert.notEqual(x.el?.elementId, '', `${que}: un id vacío llegó a aplicarse`);
  }
  // Con dos copias, cada una con su motivo (antes el segundo decía «ya se cambia por otra», mirando el id vacío).
  const dos = revisar([
    { op: 'duplicar', ref: br2, copia: 'n1' }, { op: 'duplicar', ref: br2, copia: 'n2' },
    { op: 'cambiar_broll', ref: 'n1' }, { op: 'cambiar_broll', ref: 'n2' },
  ], vis);
  assert.equal(dos.descartes.length, 2);
  for (const d of dos.descartes) assert.match(d, NO_EXISTE);
  // El original sí se cambia, y dos veces el mismo se rechaza por su ref.
  const mismo = revisar([{ op: 'cambiar_broll', ref: br2 }, { op: 'cambiar_broll', ref: br2 }], vis);
  assert.equal(mismo.resueltas.length, 1);
  assert.match(mismo.descartes.join(), /ya se cambia por otra en este mismo pedido/);
  // Y lo que ya existía se sigue procesando después del lote, en el mismo pedido que la copia.
  const conOriginal = revisar([{ op: 'duplicar', ref: vid1, copia: 'n1' }, { op: 'revertir', ref: vid1, revertido: true }], vis);
  assert.deepEqual(conOriginal.resueltas.map((x) => x.op), ['duplicar', 'revertir']);
  assert.deepEqual(conOriginal.descartes, []);
});

// ── R2. La copia nace como está el original en ese momento ──────────────────

test('R2: la copia hereda lo que el pedido ya le cambió al original (oculto, silenciado, volumen), no lo de antes', () => {
  const vis = VISTA();
  const br1 = refDe(vis, 'br1');
  const vid1 = refDe(vis, 'vid1');
  // Ocultar el original y después mostrar la copia: la copia nace oculta, así que mostrarla ES un cambio.
  const oc = revisar([{ op: 'ocultar', ref: br1, oculto: true }, { op: 'duplicar', ref: br1, copia: 'n1' }, { op: 'ocultar', ref: 'n1', oculto: false }], vis);
  assert.deepEqual(oc.resueltas.map((x) => x.op), ['ocultar', 'duplicar', 'ocultar']);
  assert.deepEqual(oc.cambios.at(-1), { tipo: 'cambia', titulo: 'Copia de B-roll: cafe', antes: 'oculto', despues: 'visible' });
  // Silenciar el original y después la copia: ya nace silenciada, no hay nada que cambiar.
  const si = revisar([{ op: 'silenciar', ref: vid1, silenciado: true }, { op: 'duplicar', ref: vid1, copia: 'n1' }, { op: 'silenciar', ref: 'n1', silenciado: true }], vis);
  assert.deepEqual(si.resueltas.map((x) => x.op), ['silenciar', 'duplicar']);
  // Lo mismo con el volumen.
  const vo = revisar([{ op: 'volumen', ref: vid1, db: -6 }, { op: 'duplicar', ref: vid1, copia: 'n1' }, { op: 'volumen', ref: 'n1', db: -6 }], vis);
  assert.deepEqual(vo.resueltas.map((x) => x.op), ['volumen', 'duplicar']);
  const vo2 = revisar([{ op: 'volumen', ref: vid1, db: -6 }, { op: 'duplicar', ref: vid1, copia: 'n1' }, { op: 'volumen', ref: 'n1', db: 0 }], vis);
  assert.equal(vo2.cambios.at(-1)?.antes, 'volumen −6 dB', 'la fila dice el volumen con que nace');
});

// ── R3. Sólo el fondo ────────────────────────────────────────────────────────

test('R3: de los ajustes del proyecto, el chat compara sólo el fondo del lienzo, por su valor', () => {
  const color = (c: string, fps = 30) => ({ fps, canvasSize: { width: 1080, height: 1920 }, background: { type: 'color' as const, color: c } });
  assert.equal(mismoFondo(color('#000000', 30), color('#000000', 60)), true, 'unos fps que suben solos no son un cambio del chat');
  const otroTamano = { ...color('#000000'), canvasSize: { width: 1, height: 1 } };
  assert.equal(mismoFondo(color('#000000'), otroTamano), true);
  assert.equal(mismoFondo(color('#FFAA00'), color('#ffaa00')), true, 'un objeto nuevo con el mismo color es el mismo fondo');
  assert.equal(mismoFondo(color('#000000'), color('#ffffff')), false);
  assert.equal(mismoFondo(color('#000000'), { background: { type: 'blur', blurIntensity: 200 } }), false);
  assert.equal(mismoFondo({ background: { type: 'blur', blurIntensity: 200 } }, { background: { type: 'blur', blurIntensity: 500 } }), false);
  assert.equal(mismoFondo({ background: { type: 'blur', blurIntensity: 200 } }, { background: { type: 'blur', blurIntensity: 200 } }), true);
  assert.equal(mismoFondo(null, undefined), true);
  assert.equal(mismoFondo(null, color('#000000')), false);
});

test('R3b: aplicar usa esa regla en los cuatro lugares, y el B-roll entra a Multimedia sin subir los fps del proyecto', () => {
  const apl = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  assert.equal([...apl.matchAll(/mismoFondo\(/g)].length, 4, 'el paso del lote, «cambió algo», y las dos miradas de «Restaurar»');
  assert.doesNotMatch(apl, /ajustes(De)?\(\) !==|ajustesDespues !== ajustesAntes|ajustes\(\) === a\.ajustes/, 'nada compara los ajustes enteros');
  const red = sinComentarios(leer('app/video-editor/_opencut/broll/red.ts'));
  assert.match(red, /editor\.media\.addMediaAsset\(\{ projectId, asset: procesado, subirFps: false \}\)/);
  const mm = sinComentarios(leer('app/video-editor/_opencut/core/managers/media-manager.ts'));
  assert.match(mm, /subirFps = true,/, 'importar sigue subiendo los fps (lo de siempre)');
  assert.match(mm, /if \(subirFps\) \{\s*this\.editor\.project\.ratchetFpsForImportedMedia\(/);
  assert.equal([...mm.matchAll(/ratchetFpsForImportedMedia\(/g)].length, 1, 'un solo lugar sube los fps al agregar');
});

// ── R4. Una pista bloqueada, y lo que se sacó mientras se traía ─────────────

test('R4: «Otra» no cambia un B-roll de una pista bloqueada, y al volver distingue «lo sacaste» de «no es un B-roll»', () => {
  const libre = escena();
  const bloq = escena({ bloqueada: true });
  const ref = (id: string) => ({ trackId: 'pbr', elementId: id });
  assert.equal(puedeCambiarBroll(libre, ref('br1')), 'si');
  assert.equal(puedeCambiarBroll(bloq, ref('br1')), 'bloqueada');
  assert.equal(puedeCambiarBroll(libre, ref('img9')), 'no-broll');
  assert.equal(puedeCambiarBroll(libre, ref('no-existe')), 'falta');
  // Lo mismo en la función que arma la línea nueva: con la pista bloqueada no hay línea.
  const medio = { mediaId: 'mf2', type: 'image' as const, nombre: 'pexels-99.jpg', width: 1080, height: 1920 };
  const linea = (t: SceneTracks) => lineaConOtroBroll({
    tracks: t, ref: ref('br1'), medio, foto: { id: 99, autor: 'Marta' }, tps: TPS, lienzo: { width: 1080, height: 1920 },
    tamanoDe: () => ({ width: 1080, height: 1920 }), base,
  });
  assert.ok(linea(libre).ok);
  assert.deepEqual(linea(bloq), { ok: false, motivo: 'bloqueada' });
  // Antes de bajar y al volver: la misma pregunta, dicha según el momento.
  assert.equal(motivoSiNoSePuede('si', 'antes'), null);
  assert.equal(motivoSiNoSePuede('bloqueada', 'antes'), 'bloqueada');
  assert.equal(motivoSiNoSePuede('bloqueada', 'despues'), 'bloqueada');
  assert.equal(motivoSiNoSePuede('falta', 'antes'), 'sin-broll');
  assert.equal(motivoSiNoSePuede('falta', 'despues'), 'sacado', 'mientras se traía, la persona lo sacó');
  assert.equal(motivoSiNoSePuede('no-broll', 'despues'), 'sacado', 'o lo reemplazó');
  assert.equal(textoDeCambioBroll({ ok: false, motivo: 'sacado' }), 'Lo sacaste mientras se traía: no se tocó nada.');
  assert.match(textoDeCambioBroll({ ok: false, motivo: 'bloqueada' }), /pista bloqueada: desbloquéala para cambiarlo/);
  // La sección sabe cuáles están en una pista bloqueada (el botón «Otra» sale apagado).
  assert.deepEqual(pendientesDe(bloq).map((p) => [p.element.id, p.bloqueada ?? false]), [['br1', true]]);
  assert.deepEqual(brollsDejados(bloq).map((p) => [p.element.id, p.bloqueada ?? false]), [['br2', true]]);
  assert.deepEqual(pendientesDe(libre).map((p) => p.bloqueada ?? false), [false]);
});

test('R4b: el cambio pregunta ANTES de bajar y otra vez al VOLVER, y el botón se apaga con la pista bloqueada', () => {
  const cambiar = sinComentarios(leer('app/video-editor/_opencut/broll/cambiar.ts'));
  const antes = cambiar.indexOf('motivoSiNoSePuede(escena ? puedeCambiarBroll(escena.tracks, ref) : "falta", "antes")');
  const bajada = cambiar.indexOf('await bajarDePexels(');
  const despues = cambiar.indexOf('motivoSiNoSePuede(puedeCambiarBroll(ahora, { trackId: clip.track.id, elementId: clip.element.id }), "despues")');
  const linea = cambiar.indexOf('lineaConOtroBroll(');
  for (const [que, i] of [['antes', antes], ['la bajada', bajada], ['después', despues], ['la línea', linea]] as const) assert.ok(i > 0, `falta ${que}`);
  assert.ok(antes < bajada && bajada < despues && despues < linea, 'antes de bajar, y al volver antes de tocar la línea');
  const vista = sinComentarios(leer('app/video-editor/_opencut/broll/components/broll-view.tsx'));
  assert.match(vista, /disabled=\{ocupado \|\| p\.bloqueada === true\}/);
});

// ── R5. Los textos ───────────────────────────────────────────────────────────

test('R5: lo que se dice nombra lo que se pidió y, si no sale, qué hacer', () => {
  // Sin Pexels (12/11/2026): dice cómo se consigue la clave y qué hizo MaKo mientras tanto (tests/video-editor-broll-propio.test.ts).
  assert.match(avisoFaltaPexels('videos'), /^para los videos, conecta Pexels en «B-roll de MaKo» \(gratis, con tu clave de pexels\.com\/api\)/);
  assert.match(avisoFaltaPexels('fotos'), /^para las fotos, conecta Pexels en «B-roll de MaKo»/);
  assert.match(sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts')), /avisoFaltaPexels\(r\.videos \? "videos" : "fotos", hecho\.propios \?\? 0\)/);
  assert.match(TEXTO_MOTIVO_CAMBIO_BROLL.corto, /: acorta el B-roll en la línea de tiempo y vuelve a pedir otro, o elige fotos\.$/);
  assert.match(FALLA_VIDEO_PEXELS.pesado.error, /: prueba con otro o elige fotos\.$/);
  assert.equal(FALLA_VIDEO_PEXELS.pesado.status, 413);
  assert.match(FALLA_VIDEO_PEXELS.plazo.error, /Vuelve a intentar\.$/);
  assert.equal(FALLA_VIDEO_PEXELS.plazo.status, 504);
  assert.match(sinComentarios(leer('lib/pexels.ts')), /\{ ok: false, \.\.\.FALLA_VIDEO_PEXELS\[hecho\.motivo\] \}/, 'la ruta contesta con esos textos');
});

// ── R6. El plazo total de un video ──────────────────────────────────────────

const mp4 = (n = 64) => { const b = new Uint8Array(n); b.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70], 0); return b; };
const archivos = (...lados: number[]): ArchivoVideoPexels[] => lados.map((lado) => ({ url: `https://videos.pexels.com/${lado}.mp4`, lado }));

/** Un reloj de mentira y una bajada que hace `saltos` pedidos por archivo, cada uno de `msPorSalto` (o lo que le den). */
function simulacion({ saltos, msPorSalto, cuerpo }: { saltos: number; msPorSalto: number; cuerpo: (url: string) => { status: number; cuerpo: Uint8Array } }) {
  let ahora = 1_000_000;
  const plazos: number[] = [];
  const pedidos: string[] = [];
  const archivosPedidos: string[] = [];
  const bajar = async (url: string, plazoDelSalto: () => number) => {
    archivosPedidos.push(url);
    for (let s = 0; s < saltos; s++) {
      const ms = plazoDelSalto();
      plazos.push(ms);
      if (!ms) throw new Error('sin plazo');
      pedidos.push(url);
      // El salto tarda lo suyo; si es más que su plazo, se corta en el plazo (como el timeout de pedirClavado).
      if (msPorSalto > ms) { ahora += ms; throw new Error('timeout'); }
      ahora += msPorSalto;
    }
    return cuerpo(url);
  };
  return { bajar, reloj: () => ahora, inicio: ahora, plazos, pedidos, archivosPedidos, transcurrido: () => ahora - 1_000_000 };
}

test('R6: un video que redirige y tarda: cada salto con lo que queda, y todo dentro del plazo (no más de 90 s)', async () => {
  // Cinco saltos de 25 s por archivo y tres archivos: antes eran hasta 375 s, contra los 120 de la ruta.
  const s = simulacion({ saltos: 5, msPorSalto: 25_000, cuerpo: () => ({ status: 200, cuerpo: mp4() }) });
  const r = await primerVideoQueEntra({ candidatos: archivos(540, 720, 1080), bajar: s.bajar, reloj: s.reloj, limite: s.inicio + PLAZO_VIDEO_BROLL_MS });
  assert.deepEqual(r, { ok: false, motivo: 'plazo' });
  assert.ok(s.transcurrido() <= PLAZO_VIDEO_BROLL_MS, `tardó ${s.transcurrido()} ms`);
  assert.ok(s.plazos.every((ms) => ms <= PLAZO_PEDIDO_VIDEO_MS), 'ningún salto espera más de 30 s');
  // Y no se arrancó un pedido con menos de 2 s, ni otro archivo sin tiempo para bajarlo.
  assert.ok(s.plazos.filter((ms) => ms > 0).every((ms) => ms >= PLAZO_MINIMO_PEDIDO_MS));
  assert.deepEqual(s.archivosPedidos, ['https://videos.pexels.com/540.mp4'], 'el primero se cortó en el plazo: no se empieza otro');
  // El mismo video que tarda poco sale.
  const rapido = simulacion({ saltos: 5, msPorSalto: 1_000, cuerpo: () => ({ status: 200, cuerpo: mp4() }) });
  const ok = await primerVideoQueEntra({ candidatos: archivos(540), bajar: rapido.bajar, reloj: rapido.reloj, limite: rapido.inicio + PLAZO_VIDEO_BROLL_MS });
  assert.equal(ok.ok, true);
});

test('R6b: el plazo del pedido: hasta su tope, nunca más de lo que queda, y nada con menos de 2 s', () => {
  assert.equal(plazoDelPedido(100_000, 0), PLAZO_PEDIDO_VIDEO_MS);
  assert.equal(plazoDelPedido(100_000, 90_000), 10_000);
  assert.equal(plazoDelPedido(100_000, 98_500), 0);
  assert.equal(plazoDelPedido(100_000, 120_000), 0);
  assert.equal(plazoDelPedido(100_000, 0, 5_000), 5_000);
});

test('R6c: el archivo que vuelve: uno que pasa del techo hace probar uno más chico, uno que no es MP4 el siguiente', async () => {
  const limite = () => Date.now() + PLAZO_VIDEO_BROLL_MS;
  const pesados = new Set(['https://videos.pexels.com/720.mp4']);
  const probados: string[] = [];
  const r = await primerVideoQueEntra({
    candidatos: archivos(720, 1080, 540, 480),
    reloj: Date.now,
    limite: limite(),
    bajar: async (url) => {
      probados.push(url);
      if (pesados.has(url)) return { status: 200, cuerpo: new Uint8Array(MAX_BYTES_VIDEO_BROLL + 1) };
      if (url.endsWith('540.mp4')) return { status: 200, cuerpo: new Uint8Array(64) }; // no es un MP4
      return { status: 200, cuerpo: mp4() };
    },
  });
  assert.ok(r.ok);
  // El de 1080 no se prueba (es más grande que uno que ya pesó de más).
  assert.deepEqual(probados.map((u) => u.match(/(\d+)\.mp4$/)![1]), ['720', '540', '480']);
  const soloPesados = await primerVideoQueEntra({
    candidatos: archivos(540), reloj: Date.now, limite: limite(),
    bajar: async () => ({ status: 200, cuerpo: new Uint8Array(MAX_BYTES_VIDEO_BROLL + 1) }),
  });
  assert.deepEqual(soloPesados, { ok: false, motivo: 'pesado' });
  const fallo = await primerVideoQueEntra({ candidatos: archivos(540), reloj: Date.now, limite: limite(), bajar: async () => ({ status: 404, cuerpo: mp4() }) });
  assert.deepEqual(fallo, { ok: false, motivo: 'fallo' });
});

test('R6d: el plazo entra en el de la ruta (con margen) y en el del navegador, y la ruta lo usa en cada salto', () => {
  const ruta = sinComentarios(leer('app/api/video-editor/broll/route.ts'));
  const maxDuration = Number(ruta.match(/export const maxDuration = (\d+);/)?.[1]);
  assert.ok(maxDuration > 0);
  assert.ok(PLAZO_VIDEO_BROLL_MS + 20_000 <= maxDuration * 1000, 'margen para leer la clave y mandar los bytes');
  const red = sinComentarios(leer('app/video-editor/_opencut/broll/red.ts'));
  const delNavegador = Number(red.match(/AbortSignal\.timeout\(video \? ([\d_]+) :/)?.[1].replace(/_/g, ''));
  assert.ok(PLAZO_VIDEO_BROLL_MS < delNavegador, 'el navegador espera más que la ruta');
  const pexels = sinComentarios(leer('lib/pexels.ts'));
  assert.match(pexels, /const limite = reloj\(\) \+ PLAZO_VIDEO_BROLL_MS;\s*const r = await pedir\(clave, `\/videos\/videos\/\$\{id\}`\)/, 'el plazo cuenta desde antes de la API');
  assert.match(pexels, /const ms = plazoDelSalto\(\);\s*if \(!ms\) throw/);
});

// PROBADO ROMPIÉNDOLO (10/11/2026, base 11/0; una rotura por vez, restaurada de memoria):
//   · `cambiar_broll` con `resolver` en vez de `resolverExistente`                -> 10/1 (R1)
//   · `revertir/congelar/normalizar` con `resolver`                              -> 10/1 (R1)
//   · `borrar_silencios` con `resolver`                                           -> 10/1 (R1)
//   · lo repetido de cambiar_broll por `elementId`, solo                          -> 11/0: con R1 ninguna copia llega
//     ahí (es la segunda red); junto con `resolver` en vez de `resolverExistente`  -> 10/1 (R1)
//   · la copia sin `oculto: st.oculto` (lo de antes del pedido)                   -> 10/1 (R2)
//   · la copia sin `volumenDb: st.volumenDb`                                      -> 10/1 (R2)
//   · `mismoFondo` comparando los ajustes enteros                                 -> 10/1 (R3)
//   · `mismoFondo` sin pasar el color a minúsculas                                -> 10/1 (R3)
//   · aplicar vuelve a comparar `ajustesDe() !== ajustesAntes`                    -> 10/1 (R3b)
//   · el B-roll entra con `subirFps` en true                                      -> 10/1 (R3b)
//   · `puedeCambiarBroll` sin mirar `locked`                                      -> 10/1 (R4)
//   · `motivoSiNoSePuede` dice «sin-broll» al volver                              -> 10/1 (R4)
//   · el cambio sin la segunda pregunta (al volver)                               -> 10/1 (R4b)
//   · el botón «Otra» sin mirar la pista bloqueada                                -> 10/1 (R4b)
//   · el aviso de Pexels siempre «para las fotos»                                 -> 10/1 (R5)
//   · cada salto con 30 s fijos (sin `Math.min` con lo que queda)                 -> 9/2 (R6, R6b)
//   · el bucle sin mirar el plazo total antes de cada archivo                     -> 10/1 (R6)
//   · `plazoDelPedido` sin el mínimo de 2 s                                       -> 10/1 (R6b)
//   · `primerVideoQueEntra` devuelve lo que pasa del techo                        -> 10/1 (R6c)
//   · sin `esMp4`                                                                 -> 10/1 (R6c)
//   · el plazo total en 110 s (sin margen en la ruta)                             -> 10/1 (R6d)
//   · un cambio sin efecto (renombrar `sinTiempo` en broll-pexels.ts)             -> 11/0
// Lo que NO ve este archivo: el comando que duplica, el cambio de fondo y el B-roll corriendo en el editor (necesitan el
// motor y el WASM, que no cargan en node), ni Pexels de verdad: eso se mira en el navegador.
