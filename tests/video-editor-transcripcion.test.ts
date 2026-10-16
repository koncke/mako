// =============================================================================
// Edición por transcripción y «Eliminar las muletillas»: borrar texto corta el video
// =============================================================================
// Pedido de Martín (15/10/2026, pasos 2–4 del plan de subtítulos). Acá se prueba la
// parte pura: qué tramos se van al borrar palabras (transcripcion/modelo.ts) y cómo
// queda la línea de tiempo sin ellos (transcripcion/cortar.ts): la pista principal
// cortada, los subtítulos sin esas palabras y corridos, lo vinculado corrido y lo
// demás quieto. «Dividir» entra de mentira (el de verdad llega al WASM, que no carga
// en node; es el cuerpo de SplitElementsCommand, sin cambios). Lo que se ve en
// pantalla no tiene test: hay que mirarlo en el navegador.
//
// Probado rompiéndolo (15/10/2026): el resultado de cada rotura está al final.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  aLinea, cortarTramos, normalizarTramos, piezasSinTramos, tramosConClip, type Dividir,
} from '../app/video-editor/_opencut/transcripcion/cortar';
import {
  buscarFrase, muletillasDe, palabrasEnOrden, tramosDePalabras, transcripcionDe,
} from '../app/video-editor/_opencut/transcripcion/modelo';
import { codificarPalabras, leerCodificadas, palabrasDe, PARAM_PALABRAS } from '../app/video-editor/_opencut/subtitles/palabras';

/** Ticks por segundo de mentira: milisegundos, para leer los números. */
const TPS = 1000;
const ms = (s: number) => Math.round(s * TPS);

let n = 0;
/** «Dividir» de mentira: reparte el tiempo y marca qué lado perdió qué (como sinSalida/sinEntrada). */
const dividir: Dividir = ({ element, splitTime, retainSide = 'both' }) => {
  const ini = element.startTime as number;
  const fin = ini + (element.duration as number);
  if (splitTime <= ini || splitTime >= fin) return null;
  const rel = splitTime - ini;
  const izq = {
    ...element, duration: rel, trimEnd: (element.trimEnd as number) + (fin - splitTime),
    params: retainSide === 'both' ? { ...element.params, salida: false } : element.params,
  };
  const der = {
    ...element, id: `${element.id}+${++n}`, startTime: splitTime, duration: fin - splitTime, trimStart: (element.trimStart as number) + rel,
    params: retainSide === 'both' ? { ...element.params, entrada: false } : element.params,
  };
  return {
    izquierda: retainSide === 'right' ? null : (izq as never),
    derecha: retainSide === 'left' ? null : (der as never),
  };
};

// ── Fixtures ────────────────────────────────────────────────────────────────

type W = [string, number, number] | [string, number, number, 'm'];
const video = (id: string, ini: number, fin: number, params: Record<string, unknown> = {}) =>
  ({ id, name: id, type: 'video', mediaId: 'm', startTime: ms(ini), duration: ms(fin - ini), trimStart: 0, trimEnd: 0, params: { salida: true, entrada: true, ...params } });
const sub = (id: string, ini: number, fin: number, palabras?: W[], contenido?: string) => {
  const ws = palabras?.map(([texto, a, b, m]) => ({ texto, inicio: a, fin: b, ...(m ? { muletilla: true } : {}) }));
  return {
    id, name: id, type: 'text', startTime: ms(ini), duration: ms(fin - ini), trimStart: 0, trimEnd: 0,
    params: {
      subtitulo: true,
      content: contenido ?? ws!.filter((w) => !w.muletilla).map((w) => w.texto).join(' '),
      ...(ws ? { [PARAM_PALABRAS]: codificarPalabras({ palabras: ws, origen: ini, precision: 'palabra' }) } : {}),
    },
  };
};
const sticker = (id: string, ini: number, fin: number) =>
  ({ id, name: id, type: 'sticker', stickerId: 's', startTime: ms(ini), duration: ms(fin - ini), trimStart: 0, trimEnd: 0, params: {} });
const musica = (id: string, ini: number, fin: number) =>
  ({ id, name: id, type: 'audio', sourceType: 'library', sourceUrl: 'x', startTime: ms(ini), duration: ms(fin - ini), trimStart: 0, trimEnd: 0, params: {} });

/** Un video de 10 s, dos subtítulos, stickers y música. */
function escena({ subtitulosBloqueados = false } = {}) {
  return {
    main: { id: 'main', name: 'p', type: 'video', muted: false, hidden: false, elements: [video('v1', 0, 10)] },
    overlay: [
      {
        id: 'subs', name: 's', type: 'text', hidden: false, locked: subtitulosBloqueados, elements: [
          sub('s1', 1, 2.5, [['Hola', 1, 1.4], ['mundo', 1.5, 2], ['cruel.', 2.1, 2.5]]),
          sub('s2', 5.9, 7, [['adiós', 6, 6.4], ['eh,', 6.45, 6.55, 'm'], ['amigo', 6.6, 7]]),
        ],
      },
      { id: 'stk', name: 'g', type: 'graphic', hidden: false, elements: [sticker('k1', 1.2, 3), sticker('k2', 3, 5)] },
    ],
    audio: [{ id: 'aud', name: 'a', type: 'audio', muted: false, elements: [musica('mu', 0, 10)] }],
  } as never;
}
type Vinculado = (e: { type: string }) => boolean;
const todoVinculado: Vinculado = () => true;
const nadaVinculado: Vinculado = () => false;
const cortar = (tracks: unknown, tramos: Array<[number, number]>, vinculado: Vinculado = todoVinculado) =>
  cortarTramos({ tracks: tracks as never, tramos: tramos.map(([a, b]) => [ms(a), ms(b)] as const), tps: TPS, vinculado, dividir });
const el = (r: ReturnType<typeof cortar>, id: string) =>
  [r.tracks.main, ...r.tracks.overlay, ...r.tracks.audio].flatMap((t) => t.elements as Array<Record<string, any>>).find((e) => e.id === id);

// ── Los tramos ──────────────────────────────────────────────────────────────

test('1: borrar una palabra se lleva su voz y la mitad de cada pausa vecina', () => {
  const parrafos = transcripcionDe({ tracks: escena(), tps: TPS });
  const todas = palabrasEnOrden(parrafos);
  const mundo = todas.find((w) => w.texto === 'mundo')!;
  const [t] = tramosDePalabras({ palabras: todas, quitar: new Set([mundo.id]) });
  assert.deepEqual(t.map((x) => Math.round(x * 100) / 100), [1.45, 2.05]);
});

test('2: palabras seguidas son UN tramo; al principio y al final de todo, el corte va al borde de la palabra', () => {
  const todas = palabrasEnOrden(transcripcionDe({ tracks: escena(), tps: TPS }));
  const ids = (...ts: string[]) => new Set(todas.filter((w) => ts.includes(w.texto)).map((w) => w.id));
  assert.equal(tramosDePalabras({ palabras: todas, quitar: ids('Hola', 'mundo') }).length, 1);
  assert.deepEqual(tramosDePalabras({ palabras: todas, quitar: ids('Hola') })[0][0], 1);
  assert.deepEqual(tramosDePalabras({ palabras: todas, quitar: ids('amigo') })[0][1], 7);
});

test('3: los tramos se juntan si casi se tocan y se estiran hasta el borde de un clip cercano', () => {
  // Al revés se endereza, y a 30 ms del anterior se junta con él.
  assert.deepEqual(normalizarTramos({ tramos: [[2000, 1500], [2030, 2500], [5000, 5100]], tps: TPS }), [[1500, 2500], [5000, 5100]]);
  // A 30 ms del final del clip: sin estirar quedaría una astilla de 30 ms.
  assert.deepEqual(normalizarTramos({ tramos: [[4000, 4970]], tps: TPS, bordes: [0, 5000] }), [[4000, 5000]]);
});

test('4: aLinea corre lo de después y lo de adentro cae en el borde del hueco', () => {
  const tramos = [[1000, 2000], [5000, 6000]] as const;
  assert.equal(aLinea(500, tramos), 500);
  assert.equal(aLinea(1500, tramos), 1000);
  assert.equal(aLinea(3000, tramos), 2000);
  assert.equal(aLinea(9000, tramos), 7000);
});

// ── El corte ────────────────────────────────────────────────────────────────

test('5: un tramo en el medio de un clip: dos piezas, la primera conserva el id, y la Salida queda en la derecha', () => {
  const piezas = piezasSinTramos(video('v1', 0, 10) as never, [[ms(2), ms(3)]], dividir) as Array<Record<string, any>>;
  assert.equal(piezas.length, 2);
  assert.equal(piezas[0].id, 'v1');
  assert.deepEqual([piezas[0].startTime, piezas[0].duration, piezas[1].startTime, piezas[1].duration], [0, 2000, 3000, 7000]);
  assert.equal(piezas[0].params.salida, false);
  assert.equal(piezas[1].params.salida, true);
});

test('6: si se va el FINAL, lo que queda conserva la Salida (como «Borrar a la derecha»); si se va todo, no queda nada', () => {
  const [p] = piezasSinTramos(video('v1', 0, 10) as never, [[ms(8), ms(10)]], dividir) as Array<Record<string, any>>;
  assert.equal(p.duration, 8000);
  assert.equal(p.params.salida, true);
  assert.equal(piezasSinTramos(video('v1', 0, 10) as never, [[0, ms(10)]], dividir).length, 0);
  // Se va el principio: la pieza que queda es la de la derecha, pero con el id de siempre.
  const [q] = piezasSinTramos(video('v1', 0, 10) as never, [[0, ms(1)]], dividir) as Array<Record<string, any>>;
  assert.equal(q.id, 'v1');
  assert.equal(q.trimStart, 1000);
});

test('7: borrar «mundo»: el video se corta, el subtítulo pierde la palabra y lo que sigue se corre 0,6 s', () => {
  const r = cortar(escena(), [[1.45, 2.05]]);
  assert.equal(r.quitado, 600);
  const principal = r.tracks.main.elements as Array<Record<string, any>>;
  assert.deepEqual(principal.map((e) => [e.startTime, e.duration]), [[0, 1450], [1450, 7950]]);
  const s1 = el(r, 's1')!;
  assert.equal(s1.params.content, 'Hola cruel.');
  assert.deepEqual([s1.startTime, s1.duration], [1000, 900]);
  const g = leerCodificadas(s1.params[PARAM_PALABRAS])!;
  assert.deepEqual(g.palabras.map((p) => [p.texto, p.inicio]), [['Hola', 0], ['cruel.', 0.5]]);
  assert.equal(el(r, 's2')!.startTime, 5300);
  assert.equal(r.subtitulosCambiados, 1);
});

test('8: lo vinculado se corre (y se ACORTA si atraviesa el tramo); la música, si no está vinculada, no se mueve', () => {
  const r = cortar(escena(), [[1.45, 2.05]], (e) => e.type !== 'audio');
  assert.deepEqual([el(r, 'k1')!.startTime, el(r, 'k1')!.duration], [1200, 1200]);
  assert.deepEqual([el(r, 'k2')!.startTime, el(r, 'k2')!.duration], [2400, 2000]);
  assert.deepEqual([el(r, 'mu')!.startTime, el(r, 'mu')!.duration], [0, 10000]);
  const quieto = cortar(escena(), [[1.45, 2.05]], nadaVinculado);
  assert.equal(el(quieto, 'k2')!.startTime, 3000);
});

test('9: un subtítulo que se queda sin palabras dichas se borra; uno sin tiempos se acorta como un bloque', () => {
  const r = cortar(escena(), [[5.95, 6.42], [6.58, 7.0]]);
  assert.equal(el(r, 's2'), undefined);
  assert.equal(r.subtitulosBorrados, 1);
  const tracks = escena() as any;
  tracks.overlay[0].elements.push(sub('s3', 8, 9.5, undefined, 'escrito a mano'));
  const r2 = cortar(tracks, [[8.5, 9]]);
  assert.deepEqual([el(r2, 's3')!.startTime, el(r2, 's3')!.duration], [8000, 1000]);
});

test('10: sacar una muletilla guardada no cambia el texto, pero sí corre las palabras de después', () => {
  const todas = palabrasEnOrden(transcripcionDe({ tracks: escena(), tps: TPS }));
  const ids = muletillasDe(transcripcionDe({ tracks: escena(), tps: TPS }), 'es');
  assert.deepEqual([...ids].map((id) => todas.find((w) => w.id === id)!.texto), ['eh,']);
  const tramos = tramosDePalabras({ palabras: todas, quitar: ids });
  const r = cortar(escena(), tramos);
  const s2 = el(r, 's2')!;
  assert.equal(s2.params.content, 'adiós amigo');
  const g = leerCodificadas(s2.params[PARAM_PALABRAS])!;
  assert.equal(g.palabras.some((p) => p.muletilla), false);
  assert.ok(s2.duration < 1100);
});

test('11: una muletilla que sigue en el texto también se encuentra (con «Identificar las muletillas» apagado)', () => {
  const tracks = escena() as any;
  // «Bueno» pegado a lo que sigue no suena a muletilla; «eh» es un sonido: siempre.
  tracks.overlay[0].elements = [sub('s1', 1, 3, [['Bueno', 1, 1.3], ['eh', 1.35, 1.5], ['compramos.', 2.1, 2.8]])];
  const parrafos = transcripcionDe({ tracks, tps: TPS });
  const ids = muletillasDe(parrafos, 'es');
  assert.deepEqual([...ids].map((id) => palabrasEnOrden(parrafos).find((w) => w.id === id)!.texto), ['eh']);
});

test('12: si se va la primera palabra de una oración, la que queda primera lleva la mayúscula', () => {
  const r = cortar(escena(), [[1, 1.45]]);
  assert.equal(el(r, 's1')!.params.content, 'Mundo cruel.');
});

test('13: buscarFrase encuentra cada vez que se dice, sin mayúsculas ni puntuación, y se lleva la muletilla de adentro', () => {
  const parrafos = transcripcionDe({ tracks: escena(), tps: TPS });
  assert.deepEqual(buscarFrase(parrafos, 'MUNDO cruel').map((a) => a.length), [2]);
  assert.deepEqual(buscarFrase(parrafos, 'adiós amigo').map((a) => a.length), [3]);
  assert.deepEqual(buscarFrase(parrafos, 'no está'), []);
});

test('14: una pista bloqueada no se toca; con la principal bloqueada no se corta nada', () => {
  const r = cortar(escena({ subtitulosBloqueados: true }), [[1.45, 2.05]]);
  assert.equal(el(r, 's1')!.params.content, 'Hola mundo cruel.');
  const tracks = escena() as any;
  tracks.main.locked = true;
  assert.equal(cortar(tracks, [[1.45, 2.05]]).tracks, tracks);
});

test('15: el audio extraído del video se corta igual que el video', () => {
  const tracks = escena() as any;
  tracks.audio.push({ id: 'voz', name: 'v', type: 'audio', muted: false, elements: [{ ...musica('ex', 0, 10), sourceType: 'upload', mediaId: 'm', params: { 'audio.extraidoDe': 'v1' } }] });
  const r = cortar(tracks, [[1.45, 2.05]], nadaVinculado);
  const voz = r.tracks.audio[1].elements as Array<Record<string, any>>;
  assert.deepEqual(voz.map((e) => [e.startTime, e.duration]), [[0, 1450], [1450, 7950]]);
  assert.equal(voz[0].id, 'ex');
});

test('17: un subtítulo partido con «Dividir» conserva sus tiempos al cortar, y lo que se borra en una mitad se va de las dos', () => {
  // «uno dos tres eh cuatro» de 1 a 4,2 s, partido en 3 s: las dos mitades guardan el texto y las palabras enteras.
  const ws: W[] = [['uno', 1, 1.4], ['dos', 1.5, 1.9], ['tres', 3.1, 3.4], ['eh', 3.45, 3.55, 'm'], ['cuatro', 3.6, 4]];
  const izq = sub('L', 1, 3, ws);
  const der = { ...sub('R', 1, 4.2, ws), id: 'R', startTime: ms(3), duration: ms(1.2), trimStart: ms(2) };
  const tracks = escena() as any;
  tracks.overlay[0].elements = [izq, der];
  // Se va la muletilla (sólo en lo visible de R) y «dos» (en lo visible de L).
  const r = cortar(tracks, [[3.42, 3.58], [1.45, 1.95]]);
  const R = el(r, 'R')!;
  assert.equal(R.params.content, 'uno tres cuatro');
  const visibles = palabrasDe({ contenido: R.params.content, param: R.params[PARAM_PALABRAS], inicio: R.startTime / TPS, recorteInicio: R.trimStart / TPS, duracion: R.duration / TPS });
  assert.ok(visibles, 'las palabras siguen valiendo para el texto entero');
  assert.deepEqual(visibles!.palabras.map((p) => p.texto), ['tres', 'cuatro']);
  assert.equal(el(r, 'L')!.params.content, 'uno tres cuatro');
});

test('18: el audio extraído de una SUPERPOSICIÓN no se corta (su video no se corta)', () => {
  const tracks = escena() as any;
  tracks.overlay.push({ id: 'sup', name: 's', type: 'video', muted: false, hidden: false, elements: [video('b1', 0, 10)] });
  tracks.audio.push({ id: 'voz', name: 'v', type: 'audio', muted: false, elements: [{ ...musica('ex', 0, 10), sourceType: 'upload', mediaId: 'm', params: { 'audio.extraidoDe': 'b1' } }] });
  const r = cortar(tracks, [[1.45, 2.05]], nadaVinculado);
  assert.equal(r.tracks.audio[1].elements.length, 1);
  assert.equal(el(r, 'ex')!.duration, 10000);
});

test('19: cada pedazo del audio extraído queda emparejado con el pedazo de video que tiene arriba', () => {
  const tracks = escena() as any;
  tracks.audio.push({ id: 'voz', name: 'v', type: 'audio', muted: false, elements: [{ ...musica('ex', 0, 10), sourceType: 'upload', mediaId: 'm', params: { 'audio.extraidoDe': 'v1' } }] });
  const r = cortar(tracks, [[1.45, 2.05]], nadaVinculado);
  const videos = r.tracks.main.elements as Array<Record<string, any>>;
  const voz = r.tracks.audio[1].elements as Array<Record<string, any>>;
  assert.deepEqual(voz.map((e) => e.params['audio.extraidoDe']), videos.map((v) => v.id));
});

test('20: el corte y su deshacer no pasan por el imán (la cuenta ya trae todo en su lugar)', () => {
  // Leyendo el fuente: con el imán, deshacer un corte corría un sticker que empezaba justo donde
  // empezaba el tramo (la regla de «lo que el cambio no tocó se corre con su clip», ripple/iman.ts).
  const fuente = readFileSync(new URL('../app/video-editor/_opencut/commands/timeline/element/cortar-tramos.ts', import.meta.url), 'utf8');
  assert.equal((fuente.match(/updateTracks\([^)]*\{ sinIman: true \}\)/g) ?? []).length, 2);
});

test('21: Supr en la transcripción es de la transcripción: el atajo global no borra además el clip elegido', () => {
  // Medido en producción el 15/10: elegir «de prueba.» y Supr borró el CLIP de 3 s que estaba
  // elegido en la línea de tiempo (el atajo global escucha en captura sobre el documento).
  const vista = readFileSync(new URL('../app/video-editor/_opencut/transcripcion/components/transcripcion-view.tsx', import.meta.url), 'utf8');
  assert.ok(vista.includes('data-teclas-propias="delete backspace"'));
  const atajos = readFileSync(new URL('../app/video-editor/_opencut/actions/use-keybindings.ts', import.meta.url), 'utf8');
  assert.ok(atajos.includes('closest("[data-teclas-propias]")'), 'el atajo global mira si la tecla es de un panel');
});

test('16: tramosConClip separa lo que tiene clip debajo de lo que no', () => {
  const { con, sin } = tramosConClip(escena(), [[ms(1), ms(2)], [ms(11), ms(12)]]);
  assert.equal(con.length, 1);
  assert.equal(sin.length, 1);
});

// Roturas (15/10/2026), base 16 de 16 en verde; cada una restaurada (16/0 al final):
// · cortar en el borde de la palabra, sin media pausa → 15/1 (cae el 1).
// · lo de adentro de un tramo no cae en el borde del hueco → 15/1 (4).
// · sin juntar tramos que casi se tocan → 15/1 (3). · sin estirar hasta el borde del clip → 15/1 (3).
// · si se va el final, partir en dos igual (pierde la Salida) → 15/1 (6).
// · la primera pieza no conserva el id → 15/1 (6).
// · el subtítulo no pierde las palabras del tramo → 12/4 (7, 9, 10, 12).
// · lo vinculado no se acorta → 14/2 (8, 9). · el audio extraído no se corta → 15/1 (15).
// · sin mayúscula heredada → 15/1 (12). · una pista bloqueada se toca → 15/1 (14).
// · muletillas: sólo las guardadas → 15/1 (11). · buscarFrase sin la muletilla de adentro → 15/1 (13).
// · tramosConClip cuenta todo como con clip → 15/1 (16).
//
// Los arreglos de la revisión adversarial (15/10/2026), base 20 de 20:
// · el subtítulo guarda sólo las palabras visibles → 19/1 (17).
// · se corta el audio extraído de cualquier video → 19/1 (18).
// · sin emparejar el audio extraído con su pedazo de video → 19/1 (19).
// · el deshacer del corte pasa por el imán → 19/1 (20). Restaurado: 20/0.
// · Supr (test 21, visto en producción): el panel no declara sus teclas → 20/1 (21); el atajo global
//   no mira las teclas del panel → 20/1 (21). Restaurado: 21/0.
