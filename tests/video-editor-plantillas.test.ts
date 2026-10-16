// =============================================================================
// Plantillas de anuncio vertical: el catálogo y el armado (la parte pura)
// =============================================================================
// Orden de Martín (15/10/2026, «Estrategia 3 cuentas»): cinco plantillas con lo que
// el editor ya tiene, más dos variantes que sumó el coordinador (máquina de escribir y
// glitch). Plan: docs/editor-video/plan-plantillas-anuncio.md §6.
//   1–9   el catálogo (lib/editor-video/plantillas.ts) contra el motor y contra sus
//         propias reglas: ids que existen, principal pegada, cuadros de 30 fps, zona
//         segura de Meta, huecos coherentes.
//   10–11 el armado (_opencut/plantillas/armar.ts) con el motor de mentira: `base`,
//         `medir` (partirYUbicar llega al WASM, que no carga en node) y los ids.
//   12–14 cubrir una celda, la escena de la miniatura y validar los valores.
// Lo que se ve en pantalla (la letra medida de verdad, el recorte en el reproductor)
// no tiene test: hay que mirarlo en el navegador.
//
// Probado rompiéndolo (15/10/2026): el resultado de cada rotura está al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cajaDeTexto, huecosDe, LIENZO_REF, largoTexto, MARGEN_TEXTO, PLANTILLAS, plantillaPorId, validarValores, ZONA_SEGURA,
  type HuecoClip, type Pieza, type PiezaTexto, type Plantilla,
} from '../lib/editor-video/plantillas';
import { TOPES_CHAT } from '../lib/editor-video/chat-catalogo';
import { POSE_IDENTIDAD, presetAnimacion, presetsPara, type CategoriaAnimacion } from '../app/video-editor/_opencut/animaciones/catalogo';
import { DURACION_MINIMA_ANIMACION, VUELTA_MAXIMA_BUCLE } from '../app/video-editor/_opencut/animaciones/elegir';
import { transicionPorId } from '../app/video-editor/_opencut/transiciones/catalogo';
import { DURACION_MINIMA } from '../app/video-editor/_opencut/transiciones/claves';
import { EFECTOS_TEXTO, FUENTES_PLANTILLAS } from '../app/video-editor/_opencut/text/estilos-predefinidos';
import { PLANTILLAS_SUBTITULO } from '../app/video-editor/_opencut/subtitles/estilos';
import { ANIM } from '../app/video-editor/_opencut/params/extra/animaciones';
import { armarLinea, type ArmarLinea, type Medir, type MedioHueco } from '../app/video-editor/_opencut/plantillas/armar';
import { cubrirCelda } from '../app/video-editor/_opencut/plantillas/geometria';
import { escenaEn } from '../app/video-editor/_opencut/plantillas/escena';
import { huecosEnLinea, leerAncla, leerMarcas, MARCA, quedanMuestras } from '../app/video-editor/_opencut/plantillas/huecos';
import type { TimelineElement } from '../app/video-editor/_opencut/timeline';

const cerca = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
const nombreDe = (p: Pieza) => (p.tipo === 'clip' ? p.hueco.nombre : p.tipo === 'texto' ? (p.hueco?.nombre ?? p.muestra) : 'forma');
const textos = (p: Plantilla) => p.piezas.filter((x): x is PiezaTexto => x.tipo === 'texto');
const porId = (id: string) => plantillaPorId(id) as Plantilla;

// ── El catálogo ──────────────────────────────────────────────────────────────

test('1: cada id existe en el motor (animaciones, transiciones, efectos, fuentes, subtítulos)', () => {
  const efectos = new Map(EFECTOS_TEXTO.map((e) => [e.id, e]));
  // Las cinco del plan y las dos variantes del coordinador (máquina de escribir y glitch).
  assert.deepEqual(PLANTILLAS.map((p) => p.id), ['gancho', 'gancho-escrito', 'testimonio', 'antes-despues', 'beneficios', 'oferta', 'oferta-glitch']);
  for (const p of PLANTILLAS) {
    assert.equal(plantillaPorId(p.id), p);
    if (p.subtitulos) assert.ok(PLANTILLAS_SUBTITULO.some((s) => s.id === p.subtitulos), `${p.id}: subtítulos «${p.subtitulos}»`);
    for (const pieza of p.piezas) {
      const donde = `${p.id} · ${nombreDe(pieza)}`;
      for (const [categoria, valor] of Object.entries(pieza.animacion ?? {})) {
        const [id] = valor as [string, number];
        const cat = categoria as CategoriaAnimacion;
        assert.ok(presetAnimacion(cat, id), `${donde}: ${categoria} «${id}» no existe`);
        assert.ok(presetsPara(cat, pieza.tipo === 'texto').some((x) => x.id === id), `${donde}: «${id}» no se ofrece para este tipo`);
      }
      if (pieza.tipo === 'clip' && pieza.transicion) assert.ok(transicionPorId(pieza.transicion.id), `${donde}: transición «${pieza.transicion.id}»`);
      if (pieza.tipo === 'texto') {
        const efecto = efectos.get(pieza.estilo.efecto);
        assert.ok(efecto, `${donde}: efecto «${pieza.estilo.efecto}»`);
        assert.ok(FUENTES_PLANTILLAS.includes(pieza.estilo.fuente), `${donde}: fuente «${pieza.estilo.fuente}» no se carga`);
        // Una tarjeta es un efecto con fondo MÁS su relleno: el relleno del motor, en 9:16
        // con letra chica, deja ~10 px (plan §0.5). Y un relleno sin fondo no dibuja nada.
        assert.equal(efecto.params['background.enabled'] === true, Boolean(pieza.estilo.relleno), `${donde}: fondo ⇔ relleno`);
      }
    }
  }
  assert.equal(plantillaPorId('no-existe'), null);
  assert.equal(plantillaPorId(3), null);
});

test('2: la pista principal va pegada de 0 a la duración', () => {
  for (const p of PLANTILLAS) {
    const principal = p.piezas.filter((x) => x.pista === 'principal').sort((a, b) => a.inicio - b.inicio);
    assert.equal(principal[0].inicio, 0, p.id);
    for (let i = 1; i < principal.length; i++) {
      assert.ok(cerca(principal[i].inicio, principal[i - 1].fin), `${p.id}: hueco o pisada en ${principal[i].inicio} s`);
    }
    assert.ok(cerca(principal[principal.length - 1].fin, p.duracion), `${p.id}: la principal termina en ${principal[principal.length - 1].fin}`);
    for (const x of p.piezas) assert.ok(x.inicio >= 0 && x.fin > x.inicio && x.fin <= p.duracion + 1e-9, `${p.id} · ${nombreDe(x)}`);
    assert.ok(p.portada >= 0 && p.portada < p.duracion, `${p.id}: portada`);
  }
});

test('3: nada se pisa dentro de una pista', () => {
  for (const p of PLANTILLAS) {
    const pistas = new Map<string, Pieza[]>();
    for (const x of p.piezas) pistas.set(x.pista, [...(pistas.get(x.pista) ?? []), x]);
    for (const [pista, piezas] of pistas) {
      const orden = piezas.slice().sort((a, b) => a.inicio - b.inicio);
      for (let i = 1; i < orden.length; i++) {
        assert.ok(orden[i].inicio >= orden[i - 1].fin - 1e-9, `${p.id} ${pista}: «${nombreDe(orden[i])}» pisa a «${nombreDe(orden[i - 1])}»`);
      }
    }
  }
});

test('4: todo cae en cuadros de 30 fps (tiempos, animaciones y transiciones)', () => {
  const enCuadro = (s: number) => cerca(s * 30, Math.round(s * 30), 1e-6);
  for (const p of PLANTILLAS) {
    assert.ok(enCuadro(p.duracion) && enCuadro(p.portada), p.id);
    for (const x of p.piezas) {
      const donde = `${p.id} · ${nombreDe(x)}`;
      assert.ok(enCuadro(x.inicio) && enCuadro(x.fin), `${donde}: ${x.inicio}–${x.fin}`);
      for (const [, s] of Object.values(x.animacion ?? {}) as Array<[string, number]>) assert.ok(enCuadro(s), `${donde}: animación de ${s} s`);
      if (x.tipo === 'clip' && x.transicion) assert.ok(enCuadro(x.transicion.duracion), donde);
    }
  }
});

test('5: lo de encima empieza y termina dentro de la pieza principal que acompaña', () => {
  // La vinculación ancla por el INICIO (ripple/iman.ts): si la persona alarga su clip,
  // lo que va encima se corre con la pieza principal que tiene debajo.
  for (const p of PLANTILLAS) {
    const principal = p.piezas.filter((x) => x.pista === 'principal');
    for (const x of p.piezas.filter((y) => y.pista !== 'principal')) {
      assert.ok(
        principal.some((m) => m.inicio <= x.inicio + 1e-9 && x.fin <= m.fin + 1e-9),
        `${p.id} · ${nombreDe(x)} (${x.inicio}–${x.fin}) cruza un corte de la principal`,
      );
    }
  }
});

test('6: zona segura de Meta: textos entre 269 y 1248 y a 65 px de los costados; celdas en el lienzo; textos sin pisarse', () => {
  const tol = 0.5;
  // El peor caso: el máximo de caracteres, todo en mayúsculas, en palabras de 5.
  const peorCaso = (x: PiezaTexto) => {
    const n = x.hueco?.maxCaracteres ?? largoTexto(x.muestra);
    let s = '';
    while (s.length < n) s += (s ? ' ' : '') + 'XXXXX';
    return s.slice(0, n);
  };
  const margen = LIENZO_REF.ancho * MARGEN_TEXTO;
  const anchoLetra = LIENZO_REF.ancho - 2 * margen;
  for (const p of PLANTILLAS) {
    for (const x of textos(p)) {
      const donde = `${p.id} · ${nombreDe(x)}`;
      for (const texto of [x.muestra, peorCaso(x)]) {
        const c = cajaDeTexto(x, texto);
        assert.ok(c.y >= ZONA_SEGURA.arriba - tol, `${donde} «${texto}»: arriba en ${c.y.toFixed(0)}`);
        assert.ok(c.y + c.alto <= ZONA_SEGURA.abajo + tol, `${donde} «${texto}»: abajo en ${(c.y + c.alto).toFixed(0)}`);
      }
      // Los costados, con la letra ocupando todo el ancho que deja partirYUbicar (842 px).
      // Centrada, la tarjeta sobresale `rx` del margen; a la IZQUIERDA el borde de la
      // tarjeta va en el margen y por la derecha llega a margen + 842 + 2·rx.
      const rx = (x.estilo.relleno?.[0] ?? 0) * x.estilo.px;
      const [izq, der] =
        x.estilo.alineacion === 'izquierda' ? [margen, margen + anchoLetra + 2 * rx] : [margen - rx, LIENZO_REF.ancho - margen + rx];
      assert.ok(izq >= ZONA_SEGURA.izquierda - tol, `${donde}: borde izquierdo en ${izq.toFixed(1)}`);
      assert.ok(der <= ZONA_SEGURA.derecha + tol, `${donde}: borde derecho en ${der.toFixed(1)}`);
    }
    for (const x of p.piezas) {
      const celda = x.tipo === 'texto' ? undefined : x.celda;
      if (!celda) continue;
      assert.ok(celda.x >= 0 && celda.y >= 0 && celda.x + celda.ancho <= LIENZO_REF.ancho && celda.y + celda.alto <= LIENZO_REF.alto, `${p.id} · ${nombreDe(x)}`);
    }
    // Con las muestras, dos textos que se ven a la vez no se pisan.
    const ts = textos(p);
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const [a, b] = [ts[i], ts[j]];
        if (a.fin <= b.inicio || b.fin <= a.inicio) continue;
        const [ca, cb] = [cajaDeTexto(a), cajaDeTexto(b)];
        const separados = ca.y + ca.alto <= cb.y || cb.y + cb.alto <= ca.y || ca.x + ca.ancho <= cb.x || cb.x + cb.ancho <= ca.x;
        assert.ok(separados, `${p.id}: «${a.muestra}» pisa a «${b.muestra}»`);
      }
    }
  }
});

test('7: las muestras son cortas (≤ 5 palabras) y entran en su hueco, y el hueco en lo que deja el chat', () => {
  for (const p of PLANTILLAS) {
    for (const x of textos(p)) {
      const donde = `${p.id} · ${nombreDe(x)}`;
      assert.ok(x.muestra.trim().split(/\s+/).length <= 5, `${donde}: «${x.muestra}»`);
      if (!x.hueco) continue;
      assert.ok(largoTexto(x.muestra) <= x.hueco.maxCaracteres, `${donde}: la muestra no entra en ${x.hueco.maxCaracteres}`);
      assert.ok(x.hueco.maxCaracteres <= TOPES_CHAT.texto, `${donde}: más de lo que deja el chat`);
    }
  }
});

test('8: entrada + salida entran en la pieza; la transición, entre su mínimo y su tope, con un clip pegado a la derecha', () => {
  for (const p of PLANTILLAS) {
    for (const x of p.piezas) {
      const donde = `${p.id} · ${nombreDe(x)}`;
      const D = x.fin - x.inicio;
      const entrada = x.animacion?.entrada?.[1] ?? 0;
      const salida = x.animacion?.salida?.[1] ?? 0;
      assert.ok(entrada + salida <= D + 1e-9, `${donde}: entrada ${entrada} + salida ${salida} > ${D}`);
      for (const [, s] of Object.values(x.animacion ?? {}) as Array<[string, number]>) assert.ok(s >= DURACION_MINIMA_ANIMACION, donde);
      if (x.animacion && 'bucle' in x.animacion && x.animacion.bucle) assert.ok(x.animacion.bucle[1] <= VUELTA_MAXIMA_BUCLE, donde);
      if (x.tipo !== 'clip' || !x.transicion) continue;
      const derecha = p.piezas.find((y) => y.tipo === 'clip' && y.pista === x.pista && cerca(y.inicio, x.fin));
      assert.ok(derecha, `${donde}: transición sin un clip pegado a la derecha`);
      // El tope es la mitad del clip más corto del corte (transiciones/reglas.ts, duracionMaxima).
      const tope = Math.min(D, derecha.fin - derecha.inicio) / 2;
      assert.ok(x.transicion.duracion >= DURACION_MINIMA && x.transicion.duracion <= tope, `${donde}: transición de ${x.transicion.duracion} s (tope ${tope})`);
    }
  }
});

test('9: un hueco con varias piezas es uno solo (mismo tipo, acepta, rótulo); cada plantilla tiene un clip para llenar', () => {
  for (const p of PLANTILLAS) {
    const clips = new Map<string, HuecoClip>();
    const deTexto = new Map<string, PiezaTexto>();
    for (const x of p.piezas) {
      if (x.tipo === 'clip') {
        const ya = clips.get(x.hueco.nombre);
        if (ya) assert.deepEqual(x.hueco, ya, `${p.id}: «${x.hueco.nombre}» con dos definiciones`);
        clips.set(x.hueco.nombre, x.hueco);
        assert.ok(!deTexto.has(x.hueco.nombre), `${p.id}: «${x.hueco.nombre}» es clip y texto`);
      } else if (x.tipo === 'texto') {
        // Lo que escriba la persona se ve como la muestra: una muestra en mayúsculas lleva «May./min.».
        if (/\p{L}/u.test(x.muestra) && x.muestra === x.muestra.toUpperCase()) assert.ok(x.estilo.mayusculas, `${p.id}: «${x.muestra}» sin mayúsculas`);
        if (!x.hueco) continue;
        const ya = deTexto.get(x.hueco.nombre);
        if (ya) {
          assert.deepEqual(x.hueco, ya.hueco, `${p.id}: «${x.hueco.nombre}» con dos topes`);
          assert.equal(x.muestra, ya.muestra);
          assert.equal(Boolean(x.estilo.mayusculas), Boolean(ya.estilo.mayusculas));
        }
        deTexto.set(x.hueco.nombre, x);
        assert.ok(!clips.has(x.hueco.nombre), `${p.id}: «${x.hueco.nombre}» es clip y texto`);
      }
    }
    assert.ok([...clips.values()].some((h) => !h.opcional), `${p.id}: ningún clip para llenar`);
    const huecos = huecosDe(p);
    assert.equal(huecos.length, clips.size + deTexto.size, p.id);
    assert.ok(huecos.findIndex((h) => h.tipo === 'texto') >= clips.size, `${p.id}: los clips van primero`);
  }
  // El video que llena «antes» tiene que alcanzar para su pieza más larga (6–11 s).
  assert.equal(huecosDe(porId('antes-despues')).find((h) => h.nombre === 'antes')?.segundos, 5);
});

// ── El armado, con el motor de mentira ───────────────────────────────────────

/** Ticks por segundo de mentira: milisegundos, para leer los números. */
const TPS = 1000;
type Valores = Record<string, string | number | boolean>;
/** Los params por defecto de cada tipo, como los declara el motor (los que importan acá). */
const base = (tipo: string): Valores => ({
  'transform.scaleX': 1, 'transform.scaleY': 1, 'transform.positionX': 0, 'transform.positionY': 0, 'transform.rotate': 0, opacity: 1,
  [ANIM.entrada.id]: 'ninguno', [ANIM.entrada.duracion]: 0.5, [ANIM.salida.id]: 'ninguno', [ANIM.salida.duracion]: 0.5,
  ...(tipo === 'video' || tipo === 'image'
    ? { [ANIM.combo.id]: 'ninguno', [ANIM.combo.duracion]: 0.5, 'recorte.izquierda': 0, 'recorte.arriba': 0, 'recorte.derecha': 0, 'recorte.abajo': 0 }
    : { [ANIM.bucle.id]: 'ninguno', [ANIM.bucle.duracion]: 0.5 }),
  ...(tipo === 'video' ? { volume: 0, muted: false } : {}),
  ...(tipo === 'text'
    ? { content: 'Texto predeterminado', fontFamily: 'Arial', fontSize: 15, 'background.enabled': false, 'background.paddingX': 30, 'background.paddingY': 42 }
    : {}),
});
type Pedido = { contenido: unknown; vertical?: string; margenPx?: number; bordeInferior?: number; margenIzquierdo?: number; margenDerecho?: number };
/** partirYUbicar de mentira: anota lo que le piden y deja la caja donde la ubicación dice. */
function medidor() {
  const pedidos: Pedido[] = [];
  const medir: Medir = ({ params, lienzo, ubicacion = {} }) => {
    pedidos.push({ contenido: params.content, ...ubicacion });
    const y = ubicacion.bordeInferior ?? (ubicacion.vertical === 'top' ? (ubicacion.margenPx ?? 0) - lienzo.height / 2 : 0);
    return { content: params.content, 'transform.positionX': 0, 'transform.positionY': y };
  };
  return { medir, pedidos };
}
const muestra = (id: string) => ({ mediaId: id, width: 1080, height: 1920 });
const MUESTRAS = {
  'Tu clip': muestra('m-clip'), Antes: muestra('m-antes'), 'Después': muestra('m-despues'), 'Tu producto': muestra('m-producto'), '': muestra('m-final'),
};
function armar(plantilla: Plantilla, lienzo = { width: 1080, height: 1920 }, extra: Partial<ArmarLinea> = {}) {
  let n = 0;
  const { medir, pedidos } = medidor();
  const r = armarLinea({
    plantilla, lienzo, fps: 30, tps: TPS,
    principal: { id: 'principal', name: 'Principal', type: 'video', elements: [], muted: false, hidden: false },
    muestras: MUESTRAS, base, medir, nuevoId: () => `e${++n}`, ...extra,
  });
  return { ...r, pedidos };
}
const p = (el: { params: Valores }, k: string) => el.params[k];

test('10: armarLinea: principal pegada, pistas en orden, marcas, animaciones, transición, letra y relleno', () => {
  const ad = porId('antes-despues');
  const { tracks, descartes, pedidos } = armar(ad);
  assert.deepEqual(descartes, []);
  // La principal conserva su id y va pegada (ticks de mentira = ms).
  assert.equal(tracks.main.id, 'principal');
  assert.deepEqual(tracks.main.elements.map((e) => [e.startTime, e.duration]), [[0, 3000], [3000, 3000], [6000, 5000], [11000, 3000]]);
  // Pistas de arriba hacia abajo: texto-1, texto-2, forma-1, video-1.
  assert.deepEqual(tracks.overlay.map((t) => t.type), ['text', 'text', 'graphic', 'video']);
  assert.deepEqual(tracks.overlay[0].elements.map((e) => e.startTime), [200, 3200, 6600, 11000]);
  // Marcas.
  const [antes, despues, antesArriba, final] = tracks.main.elements;
  const despuesAbajo = tracks.overlay[3].elements[0];
  for (const t of [...tracks.overlay, tracks.main]) for (const e of t.elements) assert.equal(p(e, MARCA.id), 'antes-despues');
  assert.deepEqual(leerMarcas(antes.params), { plantilla: 'antes-despues', hueco: 'antes', muestra: true, opcional: false, silenciar: false, ancla: null });
  assert.equal(antes.type, 'image');
  assert.equal(antes.mediaId, 'm-antes');
  assert.equal(final.mediaId, 'm-final');
  assert.equal(leerMarcas(final.params)?.opcional, true);
  assert.equal(leerMarcas(antesArriba.params)?.silenciar, true);
  assert.equal(leerMarcas(despuesAbajo.params)?.silenciar, true);
  const rotuloGrande = tracks.overlay[0].elements[0];
  assert.deepEqual(leerAncla(rotuloGrande.params), { borde: 'arriba', y: 300, margen: 0.11 });
  assert.equal(leerMarcas(rotuloGrande.params)?.hueco, 'rotulo-antes');
  // Un hueco en dos lugares: «antes» son el clip suelto y el de arriba.
  const enLinea = huecosEnLinea(tracks);
  assert.deepEqual(enLinea.find((h) => h.nombre === 'antes')?.elementos.map((e) => e.elementId), [antes.id, antesArriba.id]);
  assert.equal(quedanMuestras(tracks), true);
  // Animaciones: lo que escribe el panel al elegir (combinado fuera) y con la duración pedida.
  assert.equal(p(antesArriba, ANIM.entrada.id), 'deslizar-derecha');
  assert.equal(p(antesArriba, ANIM.entrada.duracion), 0.5);
  assert.equal(p(antesArriba, ANIM.salida.id), 'desaparecer-gradualmente');
  assert.equal(p(antesArriba, ANIM.salida.duracion), 0.4);
  assert.equal(p(antesArriba, ANIM.combo.id), 'ninguno');
  assert.equal(p(rotuloGrande, ANIM.entrada.id), 'rebote');
  assert.equal(p(rotuloGrande, ANIM.entrada.duracion), 0.4, 'la de la plantilla, no la del preset (0,5)');
  const cta = tracks.overlay[1].elements[1];
  assert.equal(p(cta, ANIM.bucle.id), 'pulso');
  assert.equal(p(cta, ANIM.bucle.duracion), 1);
  // La transición, en la pieza de la IZQUIERDA del corte, y en ninguna otra.
  assert.equal(p(antes, 'transicion.id'), 'barrido-derecha');
  assert.equal(p(antes, 'transicion.duracion'), 0.5);
  for (const e of [despues, antesArriba, final, despuesAbajo]) assert.equal(p(e, 'transicion.id'), undefined);
  // Letra y relleno: fontSize = px·90/1920; padding = em·1920/6.
  assert.equal(p(rotuloGrande, 'fontSize'), 4.5);
  assert.equal(p(rotuloGrande, 'background.paddingX'), 128);
  assert.equal(p(rotuloGrande, 'background.paddingY'), 48);
  assert.equal(p(rotuloGrande, 'background.enabled'), true);
  assert.equal(p(rotuloGrande, 'texto.mayusculas'), 'mayusculas');
  assert.equal(p(cta, 'fontSize'), Math.round((64 * 90) / 1920 * 10) / 10);
  assert.equal(p(cta, 'fontWeight'), 'bold');
  // El ancla, a partirYUbicar: arriba = margen de arriba; centro = al medio y corrido; abajo = borde de abajo.
  assert.deepEqual(pedidos[pedidos.findIndex((x) => x.contenido === 'ANTES')], { contenido: 'ANTES', vertical: 'top', margenPx: 300, margenIzquierdo: 0.11, margenDerecho: 0.11 });
  assert.equal(p(rotuloGrande, 'transform.positionY'), 300 - 960);
  const titulo = tracks.overlay[0].elements[3];
  assert.equal(p(titulo, 'transform.positionY'), 620 - 960);
  const nombre = armar(porId('testimonio')).tracks.overlay[1].elements[0];
  assert.equal(p(nombre, 'transform.positionY'), 1010 - 960);
  assert.equal(p(nombre, 'textAlign'), 'left');
  // Celdas: «antes» arriba y «después» abajo, recortados a 1080x960; el divisor en el medio.
  assert.equal(p(antesArriba, 'recorte.arriba'), 0.25);
  assert.equal(p(antesArriba, 'transform.positionY'), -480);
  assert.equal(p(despuesAbajo, 'transform.positionY'), 480);
  const divisor = tracks.overlay[2].elements[0];
  assert.equal(divisor.type === 'graphic' && divisor.definitionId, 'rectangle');
  assert.deepEqual([p(divisor, 'fill'), p(divisor, 'transform.scaleX'), p(divisor, 'transform.scaleY'), p(divisor, 'transform.positionY')], ['#ffffff', 1, 0.0111, 0]);

  // Con medios y textos: el video llena el hueco (recortado a 9:16) y lo que no sirve se descarta.
  const video: MedioHueco = { mediaId: 'v1', type: 'video', width: 1920, height: 1080, duracion: 20, nombre: 'mi video.mp4' };
  const g = armar(porId('gancho'), undefined, { medios: { clip: video }, textos: { gancho: 'NUEVO', cta: 'x'.repeat(25), otro: 'hola' } });
  const clip = g.tracks.main.elements[0];
  assert.equal(clip.type, 'video');
  assert.deepEqual([clip.mediaId, clip.name, clip.trimStart, clip.trimEnd, clip.type === 'video' && clip.sourceDuration], ['v1', 'mi video.mp4', 0, 8000, 20000]);
  assert.equal(leerMarcas(clip.params)?.muestra, false);
  assert.equal(p(clip, 'recorte.izquierda'), 0.3418);
  assert.equal(p(clip, 'muted'), false);
  assert.equal(p(g.tracks.overlay[0].elements[0], 'content'), 'NUEVO');
  assert.equal(p(g.tracks.overlay[1].elements[0], 'content'), 'Escríbenos hoy');
  assert.equal(g.descartes.length, 2);
  assert.equal(quedanMuestras(g.tracks), false, 'el cierre es opcional');
  // Un video de 4 s no llena «antes» (su pieza más larga dura 5 s): quedan las muestras.
  const corto = armar(ad, undefined, { medios: { antes: { ...video, duracion: 4 } } });
  assert.equal(corto.descartes.length, 1);
  assert.ok(corto.tracks.main.elements.every((e) => e.type === 'image'));
  // Silenciar: un video en la pantalla partida va sin sonido.
  const lleno = armar(ad, undefined, { medios: { antes: { ...video, duracion: 6 } } });
  assert.deepEqual(lleno.tracks.main.elements.slice(0, 3).map((e) => [e.type, p(e, 'muted')]), [['video', false], ['image', undefined], ['video', true]]);

  // Las siete se arman sin descartes y con la principal pegada de 0 a la duración.
  for (const pl of PLANTILLAS) {
    const r = armar(pl);
    assert.deepEqual(r.descartes, [], pl.id);
    let hasta = 0;
    for (const e of r.tracks.main.elements) {
      assert.equal(e.startTime, hasta, pl.id);
      hasta += e.duration;
    }
    assert.equal(hasta, pl.duracion * TPS, pl.id);
  }
  // Las variantes cambian UNA cosa: la transición, o la entrada del gancho.
  assert.equal(p(armar(porId('oferta-glitch')).tracks.main.elements[0], 'transicion.id'), 'glitch');
  const escrito = armar(porId('gancho-escrito')).tracks.overlay[0].elements[0];
  assert.deepEqual([p(escrito, ANIM.entrada.id), p(escrito, ANIM.entrada.duracion), escrito.duration], ['maquina-escribir', 1.5, 3000]);
});

test('11: en 2160x3840 las posiciones y el relleno van ×2; las escalas y la letra, iguales', () => {
  const ad = porId('antes-despues');
  const chico = armar(ad);
  const grande = armar(ad, { width: 2160, height: 3840 });
  const todos = (t: typeof chico.tracks) => [...t.overlay, t.main].flatMap((x): TimelineElement[] => x.elements);
  const [a, b] = [todos(chico.tracks), todos(grande.tracks)];
  assert.equal(a.length, b.length);
  let textosConTarjeta = 0;
  a.forEach((x, i) => {
    const y = b[i];
    for (const k of ['transform.positionX', 'transform.positionY']) assert.ok(cerca(Number(p(y, k)), 2 * Number(p(x, k)), 0.11), `${x.name} ${k}: ${p(x, k)} → ${p(y, k)}`);
    for (const k of ['transform.scaleX', 'transform.scaleY', 'fontSize']) assert.equal(p(y, k), p(x, k), `${x.name} ${k}`);
    assert.deepEqual([y.startTime, y.duration], [x.startTime, x.duration]);
    if (p(x, 'background.enabled') === true) {
      textosConTarjeta++;
      for (const k of ['background.paddingX', 'background.paddingY']) assert.equal(p(y, k), 2 * Number(p(x, k)), `${x.name} ${k}`);
    }
  });
  assert.equal(textosConTarjeta, 5, 'los cuatro rótulos y el botón');
  // Lo que se le pide a partirYUbicar también va en px del lienzo grande.
  assert.equal(grande.pedidos.find((x) => x.contenido === 'ANTES')?.margenPx, 600);
});

// ── Geometría, escena y valores ──────────────────────────────────────────────

test('12: cubrirCelda recorta la fuente a la proporción de la celda y la lleva ahí', () => {
  const L = { width: 1080, height: 1920 };
  const arriba = { x: 0, y: 0, ancho: 1080, alto: 960 };
  const vertical = cubrirCelda({ fuente: { width: 1080, height: 1920 }, celda: arriba, lienzo: L });
  assert.deepEqual(vertical, { recorte: { izquierda: 0, arriba: 0.25, derecha: 0, abajo: 0.25 }, escala: 1, x: 0, y: -480 });
  const horizontal = cubrirCelda({ fuente: { width: 1920, height: 1080 }, celda: arriba, lienzo: L });
  assert.deepEqual(horizontal.recorte, { izquierda: 0.1836, arriba: 0, derecha: 0.1836, abajo: 0 });
  assert.equal(horizontal.escala, 1);
  const cuadrada = cubrirCelda({ fuente: { width: 1080, height: 1080 }, celda: arriba, lienzo: L });
  assert.deepEqual(cuadrada.recorte, { izquierda: 0, arriba: 0.0556, derecha: 0, abajo: 0.0556 });
  // Lo que se ve CUBRE la celda (±1 px), con cualquier fuente y celda: el encaje del
  // compositor es «contain» (frame-descriptor.ts) y la escala lo multiplica.
  const celdas = [arriba, { x: 0, y: 960, ancho: 1080, alto: 960 }, { x: 0, y: 0, ancho: 1080, alto: 1920 }, { x: 100, y: 300, ancho: 400, alto: 700 }];
  for (const fuente of [{ width: 1080, height: 1920 }, { width: 1920, height: 1080 }, { width: 4000, height: 3000 }, { width: 720, height: 1280 }]) {
    for (const celda of celdas) {
      const c = cubrirCelda({ fuente, celda, lienzo: L });
      const w = fuente.width * (1 - c.recorte.izquierda - c.recorte.derecha);
      const h = fuente.height * (1 - c.recorte.arriba - c.recorte.abajo);
      const encaje = Math.min(L.width / w, L.height / h);
      const donde = `${fuente.width}x${fuente.height} en ${JSON.stringify(celda)}`;
      assert.ok(cerca(w * encaje * c.escala, celda.ancho, 1) && cerca(h * encaje * c.escala, celda.alto, 1), donde);
      assert.ok(cerca(c.x, celda.x + celda.ancho / 2 - 540, 0.01) && cerca(c.y, celda.y + celda.alto / 2 - 960, 0.01), donde);
    }
  }
});

test('13: escenaEn: lo que se ve, en orden de dibujo y con la pose del editor', () => {
  const gancho = porId('gancho');
  // t = 0: «Rebote» arranca chico y transparente.
  const alPrincipio = escenaEn(gancho, 0);
  assert.deepEqual(alPrincipio.map((x) => nombreDe(x.pieza)), ['clip', 'gancho']);
  const frase = alPrincipio[1];
  assert.ok(cerca(frase.pose.escala, 0.3, 1e-9));
  assert.equal(frase.pose.opacidad, 0);
  assert.equal(frase.rect.y, 300);
  // Al terminar la entrada (0,5 s), la identidad.
  assert.deepEqual(escenaEn(gancho, 0.5)[1].pose, POSE_IDENTIDAD);
  // t = 13: el cierre, de abajo hacia arriba (la principal primero).
  assert.deepEqual(escenaEn(gancho, 13).map((x) => nombreDe(x.pieza)), ['final', 'cta', 'titulo-final']);
  // El botón entra en 12,6 s con «Aparecer gradualmente» de 0,5 s: a la mitad, opacidad 0,5.
  const boton = escenaEn(gancho, 12.85).find((x) => nombreDe(x.pieza) === 'cta');
  assert.ok(boton && cerca(boton.pose.opacidad, 0.5, 1e-9), `opacidad ${boton?.pose.opacidad}`);
  // En `duracion` se ve el último cuadro, no nada.
  assert.equal(escenaEn(gancho, 15).length, 3);
  assert.equal(frase.revelado, null);
  // «Gancho escrito»: la máquina de escribir no mueve, revela. A la mitad de su 1,5 s, la mitad.
  const escrito = porId('gancho-escrito');
  const aMedias = escenaEn(escrito, 0.75).find((x) => nombreDe(x.pieza) === 'gancho');
  assert.deepEqual(aMedias?.revelado, { fraccion: 0.5, modo: 'caracter' });
  assert.equal(escenaEn(escrito, 1.5).find((x) => nombreDe(x.pieza) === 'gancho')?.revelado, null);
});

test('14: validarValores: hueco que no existe, texto largo, medio en un hueco de texto', () => {
  const t = porId('testimonio');
  assert.deepEqual(validarValores(t, { cita: '  Muy bueno  ', clip: { medio: 'm1' } }), { ok: true, valores: { cita: 'Muy bueno', clip: { medio: 'm1' } } });
  assert.deepEqual(validarValores(t, undefined), { ok: true, valores: {} });
  const mal = (v: unknown) => {
    const r = validarValores(t, v);
    assert.equal(r.ok, false, JSON.stringify(v));
    return r.ok ? '' : r.motivo;
  };
  assert.match(mal({ foto: { medio: 'm1' } }), /no tiene el hueco "foto"/);
  assert.match(mal({ nombre: 'x'.repeat(29) }), /hasta 28 caracteres/);
  assert.match(mal({ cita: { medio: 'm1' } }), /es un texto/);
  assert.match(mal({ clip: 'm1' }), /es un clip/);
  assert.match(mal({ cita: '   ' }), /vacío/);
  mal('cita');
  mal([]);
  // 28 caracteres justos entran (un emoji cuenta uno).
  assert.equal(validarValores(t, { nombre: `${'x'.repeat(27)}😀` }).ok, true);
});

// Roturas (15/10/2026), base 14 de 14 en verde con las cinco; cada una restaurada (14/0 al final):
// · 1: «rebote» → «rebotar» en el gancho → 12/2 (1, 13: la escena también la usa). · fuente «Antón» → 13/1 (1).
//   · un recuadro sin relleno → 13/1 (1).
// · 2: testimonio de 16 s con la principal hasta 15 → 13/1 (2).
// · 3: el detalle de la oferta en texto-1 (pisa al botón) → 13/1 (3).
// · 4: el botón de beneficios en 12,41 s → 13/1 (4).
// · 5: el título de beneficios hasta 12,2 (cruza al cierre) → 13/1 (5).
// · 6: el detalle del testimonio en y=1200 → 13/1 (6). · relleno de beneficios a 0,6 em (la tarjeta a la
//   izquierda llega a 1033 px) → 13/1 (6). · beneficio-2 en y=640 (pisa al 1) → 13/1 (6).
// · 7: una muestra de 7 palabras → 13/1 (7). · tope del botón en 250 → 11/3 (6, 7 y 10: deja de descartar).
// · 8: transición de 2 s (tope 1,5) → 13/1 (8). · rebote de 0,6 en un número de 0,8 s → 13/1 (8).
// · 9: el segundo «antes» acepta sólo video → 13/1 (9). · un rótulo en mayúsculas sin «May./min.» → 12/2 (9, 10).
// · 10: la principal con id nuevo → 13/1. · pistas de abajo hacia arriba → 13/1. · sin cambiosDeDuracion → 13/1.
//   · sin transición → 13/1. · letra medida contra el ancho → 13/1. · relleno em·H/9 → 12/2 (10, 11).
//   · sin la marca de muestra → 13/1. · el centro sin correr → 13/1. · quedanMuestras cuenta el opcional → 13/1.
// · 11: celdas sin el factor del lienzo → 13/1 (11). · relleno contra el alto de referencia → 13/1 (11).
//   · el ancla sin el factor → 13/1 (11).
// · 12: una fuente ancha no pierde los costados → 12/2 (10, 12). · escala sin el encaje → 12/2 (11, 12).
// · 13: la pose con el tiempo absoluto → 13/1. · la principal se dibuja arriba → 13/1. · sin el último cuadro → 13/1.
// · 14: sin tope de caracteres → 13/1. · un medio en un hueco de texto pasa (revienta en trim) → 13/1.
//
// Las dos variantes del coordinador (gancho escrito y oferta con glitch), base 14 de 14 con las siete:
// · «maquina-de-escribir» → 11/3 (1, 10, 13). · máquina de 3 s en un gancho de 3 s → 11/3 (8; 10 y 13 porque
//   el panel acorta la salida). · «glitchh» → 12/2 (1, 10). · glitch de 3,5 s (tope 3) → 13/1 (8).
// · la escena no revela → 13/1 (13). Restaurado: 14/0.
