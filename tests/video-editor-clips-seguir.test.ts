// =============================================================================
// Clips mágicos: seguir a la PERSONA al pasar el clip a vertical (clips/seguir.ts, clips/cubrir.ts)
// =============================================================================
// Hasta el 10/11/2026 el 16:9 se recortaba al centro (pendientes §5.1). Acá se EJECUTA la decisión con máscaras
// sintéticas como las que devuelve el segmentador (confianza 0–1 por punto): de la máscara al centro de la persona,
// del camino al encuadre, y del encuadre a los params del clip. Las cuentas de geometría se comprueban contra el
// compositor (frame-descriptor.ts: encaja la fuente entera y la escala la agranda, centrada en lienzo/2 + posición):
// la persona queda en el medio del vertical y el video nunca deja de cubrir el cuadro.
//
// Lo que corre en el navegador (los cuadros con mediabunny, el segmentador y los fotogramas clave del motor) no carga
// en node (`_opencut/wasm`): se fija su cableado leyendo el fuente, al final.
//
// Correr: node --import tsx --test tests/video-editor-clips-seguir.test.ts
// ── Roturas ── al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SEGUIR,
  caminoDelEncuadre,
  dibujoDelClip,
  encuadreQueSigue,
  encuadresDeLosClips,
  momentosAMuestrear,
  paramsDelEncuadre,
  perfilDePersona,
  simplificarCamino,
  type EncuadreSeguido,
  type Mirada,
  type MuestraPersona,
} from '../app/video-editor/_opencut/clips/seguir';
import { clipsConAnimacionDelEncuadre, principalCubriendo } from '../app/video-editor/_opencut/clips/cubrir';
import { avisoDeAnimaciones } from '../app/video-editor/_opencut/clips/resultado';
// El gancho de «Reflejar» de VERDAD (se registra al importar): lo que dibuja un clip reflejado sale de ahí, no de una cuenta copiada.
import '../app/video-editor/_opencut/recorte/ganchos';
import { aplicarGanchosVisual } from '../app/video-editor/_opencut/services/renderer/ganchos-ce';

const ANCHO = 128;
const ALTO = 72;
const FUENTE = { width: 1920, height: 1080 };
const LIENZO = { width: 1080, height: 1920 };

/** Una máscara de persona: rectángulos con su confianza (lo demás, fondo en 0,02). */
function mascara(cajas: Array<{ x0: number; x1: number; y0?: number; y1?: number; c?: number }>, { deFondo = false } = {}) {
  const m = new Float32Array(ANCHO * ALTO).fill(0.02);
  for (const { x0, x1, y0 = 0.2, y1 = 1, c = 0.97 } of cajas) {
    for (let y = Math.floor(y0 * ALTO); y < Math.ceil(y1 * ALTO); y++) {
      for (let x = Math.floor(x0 * ANCHO); x < Math.ceil(x1 * ANCHO); x++) m[y * ANCHO + x] = c;
    }
  }
  if (deFondo) for (let i = 0; i < m.length; i++) m[i] = 1 - m[i];
  return m;
}
const centroDe = (cajas: Parameters<typeof mascara>[0], deFondo = false) =>
  perfilDePersona({ confianza: mascara(cajas, { deFondo }), esDeFondo: deFondo, ancho: ANCHO, alto: ALTO }).centro;

/** Las muestras de un clip de `n` segundos con el centro que diga `centro(t)`. */
const muestras = (n: number, centro: (t: number, i: number) => number | null): MuestraPersona[] =>
  momentosAMuestrear(n).map((t, i) => ({ t, centro: centro(t, i) }));

/**
 * Dónde cae en el lienzo el punto `c` (0–1 del ancho de la fuente), como lo dibuja el compositor. La transformación pasa
 * por los ganchos visuales de VERDAD (el de «Reflejar» invierte la escala en X); después, la cuenta de
 * services/renderer/compositor/frame-descriptor.ts: el ancho es fuente × contain × escala (negativo = `flipX`), el centro
 * es lienzo/2 + la posición, y el espejo es alrededor de ese centro (`ctx.scale(-1, 1)` en él).
 */
function enElLienzo(e: EncuadreSeguido, c: number, x = e.x, params: Record<string, unknown> = {}) {
  const contain = Math.min(LIENZO.width / FUENTE.width, LIENZO.height / FUENTE.height);
  const visto = aplicarGanchosVisual(
    { transform: { scaleX: e.escala, scaleY: e.escala, position: { x, y: 0 }, rotate: 0 }, opacity: 1 } as never,
    { params: params as never, elementoId: 'clip', localTime: 0, duration: 30, lienzo: LIENZO },
  ).transform;
  const ancho = FUENTE.width * contain * visto.scaleX;
  const alto = Math.abs(FUENTE.height * contain * visto.scaleY);
  const centroX = LIENZO.width / 2 + visto.position.x;
  const lado = Math.abs(ancho);
  return { px: centroX + Math.sign(ancho) * (c - 0.5) * lado, cubreAncho: centroX - lado / 2 <= 0 && centroX + lado / 2 >= LIENZO.width, cubreAlto: alto >= LIENZO.height, reflejado: ancho < 0 };
}

/** El valor de `transform.positionX` en `t`, interpolando las claves como una recta (y quieto antes y después). */
function xEn(e: EncuadreSeguido, t: number) {
  if (!e.claves) return e.x;
  const k = e.claves;
  if (t <= k[0].t) return k[0].x;
  if (t >= k[k.length - 1].t) return k[k.length - 1].x;
  const j = k.findIndex((p) => p.t >= t);
  const f = (t - k[j - 1].t) / (k[j].t - k[j - 1].t);
  return k[j - 1].x + f * (k[j].x - k[j - 1].x);
}

// ─────────────────────────────────────────────────────────────────────────────

test('1: el centro de la persona en la máscara, pesado por su área', () => {
  assert.ok(Math.abs(centroDe([{ x0: 0.1, x1: 0.3 }])! - 0.2) < 0.01, 'a la izquierda');
  assert.ok(Math.abs(centroDe([{ x0: 0.7, x1: 0.9 }])! - 0.8) < 0.01, 'a la derecha');
  // Dos personas igual de anchas: más cerca de la que ocupa MÁS (la de la izquierda, el doble de alta). Contando sólo
  // las columnas con alguien, daría el medio (0,5).
  const dos = centroDe([{ x0: 0.1, x1: 0.3, y0: 0.2 }, { x0: 0.7, x1: 0.9, y0: 0.6 }])!;
  assert.ok(Math.abs(dos - 0.4) < 0.02, `dos personas: ${dos}`);
  // Una máscara que mide el FONDO (MediaPipe con dos categorías) da lo mismo.
  assert.ok(Math.abs(centroDe([{ x0: 0.1, x1: 0.3 }], true)! - 0.2) < 0.01, 'máscara de fondo');
  assert.equal(centroDe([]), null, 'nadie');
  assert.equal(centroDe([{ x0: 0.5, x1: 0.51, y0: 0.5, y1: 0.55 }]), null, 'una mancha de menos del 1 % no es una persona');
  // Lo que está debajo de la rampa (0,3) es fondo, aunque cubra el cuadro.
  assert.equal(centroDe([{ x0: 0, x1: 1, y0: 0, y1: 1, c: 0.25 }]), null);
  assert.equal(perfilDePersona({ confianza: new Float32Array(10), esDeFondo: false, ancho: ANCHO, alto: ALTO }).centro, null, 'una máscara de otro tamaño');
});

test('2: los momentos: uno por segundo, al medio de cada tramo, y no más de 60', () => {
  assert.deepEqual(momentosAMuestrear(3), [0.5, 1.5, 2.5]);
  assert.equal(momentosAMuestrear(30).length, 30);
  const largo = momentosAMuestrear(90);
  assert.equal(largo.length, SEGUIR.maxMuestras);
  assert.ok(largo[0] > 0 && largo[largo.length - 1] < 90);
  assert.deepEqual(momentosAMuestrear(0), []);
  assert.deepEqual(momentosAMuestrear(0.4), [0.2], 'un clip de menos de un segundo se mira una vez');
});

test('3: persona a la IZQUIERDA o a la DERECHA: encuadre fijo, con ella en el medio y el video cubriendo el vertical', () => {
  const izq = encuadreQueSigue({ muestras: muestras(30, () => 0.2), fuente: FUENTE, lienzo: LIENZO })!;
  assert.ok(izq, 'sin encuadre');
  assert.equal(izq.claves, null, 'quieta: sin fotogramas clave');
  assert.ok(izq.x > 0, 'para ver la izquierda de la fuente, la fuente se corre a la derecha');
  const enIzq = enElLienzo(izq, 0.2);
  assert.ok(Math.abs(enIzq.px - LIENZO.width / 2) < 1, `la persona cae en ${enIzq.px.toFixed(1)} px, no en el medio`);
  assert.ok(enIzq.cubreAncho && enIzq.cubreAlto, 'quedó una banda sin video');
  // Muy a la derecha (0,9): el encuadre llega al borde y no lo pasa; la persona queda a la vista.
  const der = encuadreQueSigue({ muestras: muestras(30, () => 0.9), fuente: FUENTE, lienzo: LIENZO })!;
  assert.ok(der.x < 0);
  const enDer = enElLienzo(der, 0.9);
  assert.ok(enDer.cubreAncho && enDer.cubreAlto, 'se salió del cuadro');
  assert.ok(enDer.px > LIENZO.width / 2 && enDer.px < LIENZO.width, `la persona cae en ${enDer.px.toFixed(1)} px`);
  assert.ok(Math.abs(enElLienzo(der, 1).px - LIENZO.width) < 1, 'el borde derecho de la fuente toca el del vertical');
  // Los params: sin recorte (lo que sobra lo tapa el borde), con la escala y la X.
  const p = paramsDelEncuadre(izq);
  assert.deepEqual([p['recorte.izquierda'], p['recorte.derecha'], p['recorte.arriba'], p['recorte.abajo']], [0, 0, 0, 0]);
  assert.equal(p['transform.scaleX'], izq.escala);
  assert.equal(p['transform.scaleY'], izq.escala);
  assert.equal(p['transform.positionX'], izq.x);
  assert.equal(p['transform.positionY'], 0);
  // REFLEJADO («Reflejar»): lo que la máscara ve a la izquierda se dibuja a la derecha. Con el encuadre de siempre la
  // persona quedaba afuera del vertical; con el que sabe del reflejo, en el medio.
  const REFLEJO = { 'reflejo.horizontal': true };
  const sinSaber = enElLienzo(izq, 0.2, izq.x, REFLEJO);
  assert.ok(sinSaber.reflejado, 'el gancho de «Reflejar» no espejó');
  assert.ok(sinSaber.px > LIENZO.width || sinSaber.px < 0, `sin saber del reflejo, la persona cae en ${sinSaber.px.toFixed(1)} px (adentro)`);
  const ref = encuadreQueSigue({ muestras: muestras(30, () => 0.2), fuente: FUENTE, lienzo: LIENZO, dibujo: dibujoDelClip({ params: REFLEJO }) })!;
  assert.equal(ref.x, -izq.x, 'reflejado se corre al revés');
  const enRef = enElLienzo(ref, 0.2, ref.x, REFLEJO);
  assert.ok(Math.abs(enRef.px - LIENZO.width / 2) < 1, `reflejado, la persona cae en ${enRef.px.toFixed(1)} px, no en el medio`);
  assert.ok(enRef.cubreAncho && enRef.cubreAlto, 'reflejado, quedó una banda sin video');
});

test('4: persona que SE MUEVE de izquierda a derecha: fotogramas clave que la siguen, pocos, y sin salir del cuadro', () => {
  const ida = (t: number) => 0.3 + 0.4 * (t / 30);
  const e = encuadreQueSigue({ muestras: muestras(30, ida), fuente: FUENTE, lienzo: LIENZO })!;
  assert.ok(e.claves && e.claves.length >= 2, 'se mueve y no tiene fotogramas clave');
  assert.ok(e.claves.length <= 6, `${e.claves.length} fotogramas clave para una recta`);
  assert.equal(e.x, e.claves[0].x, 'la X de base es la del primer fotograma');
  for (let i = 1; i < e.claves.length; i++) assert.ok(e.claves[i].x <= e.claves[i - 1].x, 'la persona va a la derecha: la fuente se corre a la izquierda');
  // En cada segundo del clip, la persona a menos de un 10 % del ancho del vertical del medio, y el video cubriendo.
  for (const t of momentosAMuestrear(30).slice(2, -2)) {
    const donde = enElLienzo(e, ida(t), xEn(e, t));
    assert.ok(Math.abs(donde.px - LIENZO.width / 2) < LIENZO.width * 0.1, `en ${t} s la persona cae en ${donde.px.toFixed(0)} px`);
    assert.ok(donde.cubreAncho, `en ${t} s quedó una banda sin video`);
  }
  // Y al revés, de vuelta.
  const vuelta = encuadreQueSigue({ muestras: muestras(30, (t) => 0.7 - 0.4 * (t / 30)), fuente: FUENTE, lienzo: LIENZO })!;
  assert.ok(vuelta.claves && vuelta.claves[0].x < vuelta.claves[vuelta.claves.length - 1].x);
});

test('5: NINGUNA persona (o casi ninguna): sin encuadre, y el clip se recorta al centro como siempre', () => {
  assert.equal(encuadreQueSigue({ muestras: muestras(30, () => null), fuente: FUENTE, lienzo: LIENZO }), null);
  // Una mancha en un cuadro de 30 no mueve el encuadre.
  assert.equal(encuadreQueSigue({ muestras: muestras(30, (_, i) => (i === 7 ? 0.1 : null)), fuente: FUENTE, lienzo: LIENZO }), null);
  // Con la persona en la mayoría y algunos cuadros sin nadie, sigue a la persona: se sostiene lo último visto.
  const conHuecos = encuadreQueSigue({ muestras: muestras(30, (_, i) => (i % 3 === 0 ? null : 0.2)), fuente: FUENTE, lienzo: LIENZO })!;
  assert.equal(conHuecos.claves, null);
  assert.ok(Math.abs(enElLienzo(conHuecos, 0.2).px - LIENZO.width / 2) < 1);
  // Una fuente que no es más ancha que el vertical no tiene costados que elegir.
  assert.equal(encuadreQueSigue({ muestras: muestras(30, () => 0.2), fuente: { width: 1080, height: 1920 }, lienzo: LIENZO }), null);
  assert.equal(encuadreQueSigue({ muestras: muestras(30, () => 0.2), fuente: { width: 0, height: 0 }, lienzo: LIENZO }), null);
});

test('6: el balanceo de quien habla y un cuadro con la máscara equivocada no mueven el encuadre', () => {
  const balanceo = encuadreQueSigue({ muestras: muestras(30, (_, i) => (i % 2 ? 0.48 : 0.52)), fuente: FUENTE, lienzo: LIENZO })!;
  assert.equal(balanceo.claves, null, 'se movía con el balanceo');
  assert.ok(Math.abs(balanceo.x) < 60, `quedó corrido ${balanceo.x} px`);
  const pico = encuadreQueSigue({ muestras: muestras(30, (_, i) => (i === 12 ? 0.95 : 0.3)), fuente: FUENTE, lienzo: LIENZO })!;
  assert.equal(pico.claves, null, 'un cuadro equivocado hizo mover el encuadre');
  assert.ok(Math.abs(enElLienzo(pico, 0.3).px - LIENZO.width / 2) < 1);
  // El camino nunca se acerca al borde más que media ventana, venga lo que venga.
  const camino = caminoDelEncuadre(muestras(10, () => 0.99), 0.3)!;
  assert.ok(camino.every((p) => Math.abs(p.centro - 0.85) < 1e-9));
});

test('7: simplificar el camino: una recta queda en sus dos puntas; un ida y vuelta, con su vuelta', () => {
  const recta = Array.from({ length: 20 }, (_, i) => ({ t: i, centro: 0.3 + i * 0.02 }));
  assert.deepEqual(simplificarCamino(recta).map((p) => p.t), [0, 19]);
  const ve = Array.from({ length: 21 }, (_, i) => ({ t: i, centro: 0.3 + 0.02 * (10 - Math.abs(10 - i)) }));
  assert.deepEqual(simplificarCamino(ve).map((p) => p.t), [0, 10, 20]);
  assert.equal(simplificarCamino(recta.slice(0, 2)).length, 2);
});

test('8: principalCubriendo con lo seguido: el clip con encuadre se agranda y se anima; el otro, al centro', () => {
  const el = (id: string, mediaId: string) => ({ id, type: 'video', mediaId, name: id, startTime: 0, duration: 1, trimStart: 0, trimEnd: 0, params: { opacity: 1 } });
  const tracks = { main: { id: 'm', name: 'Main', type: 'video', elements: [el('a', 'h'), el('b', 'h')], muted: false, hidden: false }, overlay: [], audio: [] };
  const encuadre = encuadreQueSigue({ muestras: muestras(30, () => 0.2), fuente: FUENTE, lienzo: LIENZO })!;
  const animados: Array<[string, EncuadreSeguido]> = [];
  const r = principalCubriendo(tracks as never, LIENZO, () => FUENTE, {
    encuadres: new Map([['a', encuadre]]),
    animar: (e, enc) => {
      animados.push([e.id, enc]);
      return { ...e, animations: { marca: true } } as never;
    },
  }) as unknown as typeof tracks;
  const [a, b] = r.main.elements as Array<{ params: Record<string, unknown>; animations?: unknown }>;
  assert.equal(a.params['transform.positionX'], encuadre.x);
  assert.equal(a.params['transform.scaleX'], encuadre.escala);
  assert.equal(a.params['recorte.izquierda'], 0, 'el clip seguido no se recorta');
  assert.equal(a.params.opacity, 1, 'lo demás queda');
  assert.deepEqual(a.animations, { marca: true }, 'no pasó por quien escribe los fotogramas clave');
  assert.deepEqual(animados, [['a', encuadre]]);
  // El que no tiene encuadre: el recorte al centro de siempre (tests/video-editor-clips.test.ts, 4b).
  assert.ok((b.params['recorte.izquierda'] as number) > 0.3 && b.params['transform.positionX'] === 0);
  assert.equal(b.animations, undefined);

  // Lo animado de la posición y la escala (del cuadro horizontal) se saca en LOS DOS caminos; lo demás animado queda.
  const animado = (id: string) => ({ ...el(id, 'h'), animations: { 'transform.positionX': { k: 1 }, 'transform.scaleY': { k: 2 }, opacity: { k: 3 } } });
  const conClaves = { ...tracks, main: { ...tracks.main, elements: [animado('a'), animado('b'), el('c', 'h')] } };
  assert.equal(clipsConAnimacionDelEncuadre(conClaves as never, () => FUENTE), 2, 'se cuentan para avisar');
  // Con la MISMA pregunta que cubrir: sin tamaño de la fuente (ni encuadre), el clip queda como estaba y no se cuenta.
  assert.equal(clipsConAnimacionDelEncuadre(conClaves as never, () => null), 0);
  assert.equal(clipsConAnimacionDelEncuadre(conClaves as never, () => null, new Map([['a', encuadre]])), 1);
  const sinTamano = principalCubriendo(conClaves as never, LIENZO, () => null) as unknown as typeof tracks;
  assert.deepEqual((sinTamano.main.elements[0] as { animations?: unknown }).animations, animado('a').animations, 'sin tamaño no se toca');
  const r2 = principalCubriendo(conClaves as never, LIENZO, () => FUENTE, {
    encuadres: new Map([['a', encuadre]]),
    animar: (e) => e,
  }) as unknown as typeof tracks;
  const [a2, b2] = r2.main.elements as Array<{ animations?: Record<string, unknown> }>;
  assert.deepEqual(a2.animations, { opacity: { k: 3 } }, 'el que sigue a la persona');
  assert.deepEqual(b2.animations, { opacity: { k: 3 } }, 'el que queda al centro (antes no se tocaba: la animación tapaba el recorte)');
  assert.equal(avisoDeAnimaciones(0), null);
  assert.match(avisoDeAnimaciones(1)!, /^Saqué las animaciones de posición y escala del video: eran del cuadro horizontal\./);
  assert.match(avisoDeAnimaciones(2)!, /de 2 clips del video/);
});

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('10: lo que el clip ya hace con su fuente: reflejado se sigue al revés (también moviéndose); girado no se sigue', () => {
  assert.deepEqual(dibujoDelClip({ params: {} }), { reflejado: false, girado: false });
  assert.deepEqual(dibujoDelClip({ params: { 'reflejo.horizontal': true } }), { reflejado: true, girado: false });
  assert.deepEqual(dibujoDelClip({ params: { 'reflejo.vertical': true } }), { reflejado: false, girado: false }, 'voltear de arriba abajo no cambia los costados');
  assert.equal(dibujoDelClip({ params: { 'transform.rotate': 15 } }).girado, true);
  assert.equal(dibujoDelClip({ params: { 'transform.rotate': 360 } }).girado, false, 'una vuelta entera es no girar');
  assert.equal(dibujoDelClip({ params: {}, animations: { 'transform.rotate': { tipo: 'algo' } } }).girado, true, 'con fotogramas clave de giro');
  assert.equal(dibujoDelClip({ params: {}, animations: { 'transform.positionX': {} } }).girado, false);
  // Girado: sin encuadre (el recorte al centro de siempre).
  assert.equal(encuadreQueSigue({ muestras: muestras(30, () => 0.2), fuente: FUENTE, lienzo: LIENZO, dibujo: { reflejado: false, girado: true } }), null);
  // Reflejado y moviéndose: cada fotograma clave al revés del de siempre, y la persona en el medio en cada segundo.
  const ida = (t: number) => 0.3 + 0.4 * (t / 30);
  const REFLEJO = { 'reflejo.horizontal': true };
  const comun = encuadreQueSigue({ muestras: muestras(30, ida), fuente: FUENTE, lienzo: LIENZO })!;
  const ref = encuadreQueSigue({ muestras: muestras(30, ida), fuente: FUENTE, lienzo: LIENZO, dibujo: dibujoDelClip({ params: REFLEJO }) })!;
  assert.deepEqual(ref.claves!.map((k) => k.x), comun.claves!.map((k) => -k.x + 0));
  for (const t of momentosAMuestrear(30).slice(2, -2)) {
    const donde = enElLienzo(ref, ida(t), xEn(ref, t), REFLEJO);
    assert.ok(Math.abs(donde.px - LIENZO.width / 2) < LIENZO.width * 0.1, `reflejado, en ${t} s la persona cae en ${donde.px.toFixed(0)} px`);
  }
});

test('11: los clips uno por uno: uno que no se lee queda al centro y se sigue con el próximo; sin segmentador se corta', async () => {
  const visto: Mirada = { tipo: 'visto', muestras: muestras(30, () => 0.2) };
  const clip = (id: string, dibujo = { reflejado: false, girado: false }) => ({ id, fuente: FUENTE, dibujo });
  const mirados: string[] = [];
  const fallas: unknown[] = [];
  const r = await encuadresDeLosClips({
    clips: [clip('a'), clip('roto'), clip('tira'), clip('girado', { reflejado: false, girado: true }), clip('b'), clip('sin-seg'), clip('c')],
    lienzo: LIENZO,
    alFallar: (e) => fallas.push(e),
    mirar: async (c) => {
      mirados.push(c.id);
      if (c.id === 'roto') return { tipo: 'no-se-lee' };
      if (c.id === 'tira') throw new Error('mediabunny');
      if (c.id === 'sin-seg') return { tipo: 'sin-segmentador' };
      return visto;
    },
  });
  assert.deepEqual([...r.keys()], ['a', 'b'], 'el que no se lee no corta a los que siguen');
  assert.deepEqual(mirados, ['a', 'roto', 'tira', 'b', 'sin-seg'], 'el girado ni se mira, y sin segmentador no se mira nada más');
  assert.equal(fallas.length, 1);
  // Reflejado: el encuadre de ese clip, al revés.
  const ref = await encuadresDeLosClips({ clips: [clip('r', { reflejado: true, girado: false })], lienzo: LIENZO, mirar: async () => visto });
  assert.equal(ref.get('r')!.x, -r.get('a')!.x);
});

test('9: el cableado: abrir mira a la persona ANTES de pasar a vertical, con el segmentador de la pestaña y en silencio', () => {
  const abrir = sinComentarios(leer('app/video-editor/_opencut/clips/abrir.ts'));
  const mira = abrir.indexOf('await encuadresQueSiguen({');
  const vertical = abrir.indexOf('new UpdateProjectSettingsCommand({ relacion: "9:16"');
  assert.ok(mira > 0 && vertical > mira, 'el encuadre se busca antes del comando que pasa a vertical');
  assert.ok(abrir.indexOf('cortarTramosEnEditor(editor') < mira, 'se mira el clip ya cortado');
  assert.match(abrir, /principalCubriendo\(before, canvasSize, tamanoDe, \{ encuadres, animar: animarEncuadre \}\)/);
  assert.match(abrir, /fase: "encuadrando"/);
  const editor = sinComentarios(leer('app/video-editor/_opencut/clips/seguir-en-editor.ts'));
  assert.match(editor, /cargarSegmentador\(\{ avisar: false \}\)/, 'si no carga, sale el aviso de quitar el fondo');
  assert.match(editor, /Promise\.race\(\[cargarSegmentador\(\{ avisar: false \}\), esperar\(TOPE_SEGMENTADOR_MS\)\]\)/, 'abrir un clip espera los 2 min del recorte');
  assert.match(editor, /\{ avisar: false \},\s*\);\s*if \(!ok\) return \{ tipo: "sin-segmentador" \};/, 'un segmentador caído no deja el clip al centro');
  assert.match(editor, /sink\.canvasesAtTimestamps\(/);
  assert.match(editor, /propertyPath: "transform\.positionX",/);
  assert.match(editor, /time: roundMediaTime\(\{ time: clave\.t \* TICKS_PER_SECOND \}\)/);
  assert.match(editor, /desde \+ getSourceTimeAtClipTime\(\{ clipTime: t, retime: el\.retime, clipDuration: duracion \}\)/, 'se mira la fuente sin su recorte ni su velocidad');
  // Lo que el clip traía animado de su posición o su escala mandaría sobre el encuadre: lo saca ./cubrir.ts (lo corre
  // el 8), y abrir lo dice.
  assert.match(sinComentarios(leer('app/video-editor/_opencut/clips/cubrir.ts')), /export const ANIMADO_DEL_ENCUADRE = \["transform\.positionX", "transform\.positionY", "transform\.scaleX", "transform\.scaleY"\] as const;/);
  assert.match(editor, /let animations = \(sinAnimacionDelEncuadre\(elemento\)\.animations/);
  const sinAnimar = abrir.indexOf('const sinAnimar = clipsConAnimacionDelEncuadre(before, tamanoDe, encuadres);');
  assert.ok(sinAnimar > 0 && sinAnimar < abrir.indexOf('principalCubriendo(before'), 'se cuenta antes de sacarlas');
  assert.match(abrir, /avisoDeAnimaciones\(sinAnimar\)/);
  // Un archivo que no se decodifica no es un segmentador caído (lo corre el 11), y lo que el clip hace con su fuente
  // llega al encuadre (el 10).
  assert.match(editor, /if \(!pista \|\| !\(await pista\.canDecode\(\)\)\) return \{ tipo: "no-se-lee" \};/);
  assert.match(editor, /if \(!ok\) return \{ tipo: "sin-segmentador" \};/);
  assert.match(editor, /return encuadresDeLosClips\(\{/);
  assert.match(editor, /const dibujo = dibujoDelClip\(el\);/);
  assert.match(editor, /\[\{ id: el\.id, el, file: asset\.file, fuente, dibujo \}\]/);
  // La máscara se lee con la MISMA rampa que el recorte de «Eliminación automática».
  assert.match(sinComentarios(leer('app/video-editor/_opencut/fondo/mascara.ts')), /let previo = confianzaDePersona\(confianza\[fila\], esDeFondo\);/);
});

// ── Roturas (10/11/2026, base 9/0 + tests/video-editor-clips.test.ts 13/0): cada una sola, con un script que rompe,
//    corre los dos archivos y restaura desde la copia en memoria; 14 de 14 en rojo ──
//   C1  el centro por las columnas con alguien, sin el área          → el 1 (dos personas: 0,5 en vez de 0,4)
//   C2  la confianza cruda, sin la rampa                             → el 1
//   C3  los momentos desde el 0                                      → el 2
//   C4  el camino sin acotar al cuadro                               → el 6
//   C5  la escala redondeada para abajo                              → el 3 (una raya sin video arriba y abajo)
//   C6  la X con el signo al revés                                   → 3, 4, 5 y 6
//   C7  sin la mediana                                               → el 6 (un cuadro equivocado mueve el encuadre)
//   C8  sin la presencia mínima                                      → el 5 (una mancha corre el encuadre)
//   C9  sin simplificar el camino                                    → el 4 (30 fotogramas clave para una recta)
//   C10 sin «quieto»                                                 → 3, 5 y 6
//   C11 principalCubriendo no llama a quien anima                    → el 8
//   C12 abrir sin lo seguido                                         → el 9
//   C13 el segmentador con el aviso de quitar el fondo y sin su tope → el 9
//   C14 el encuadre sin sacar lo que el clip traía animado           → el 9
//   (la revisión del 10/11/2026, base 11/0, cada una sola y restaurada de memoria)
//   C15 el encuadre sin el reflejo (`centro = visto`)                → 3, 10 y 11
//   C16 el encuadre de un clip girado                                → el 10
//   C17 el giro con fotogramas clave no cuenta                       → el 10
//   C17b una vuelta entera (360°) cuenta como girado                 → el 10
//   C18 un clip que no se lee corta a los que siguen                 → el 11
//   C19 se mira (y se sigue) un clip girado                          → el 11
//   C19b el bucle no le pasa el dibujo al encuadre                   → el 11
//   C20 el camino al centro sin sacar lo animado                     → el 8
//   C20b el camino que sigue sin sacar lo animado                    → el 8
//   C21 abrir sin el aviso de lo que se sacó                         → el 9
//   C21b contar sin la pregunta de cubrir (también los sin tamaño)   → el 8
//   C22 un archivo que no se decodifica vuelve a cortar todo         → el 9
//   un cambio sin efecto (un `void 0` al lado del reflejo)           → 11/0
//   NO lo ve node: los cuadros de mediabunny, MediaPipe en el navegador y los fotogramas clave del motor (ver el relevo).
