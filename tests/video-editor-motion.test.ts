// =============================================================================
// Motion graphics en el Video Editor: el elemento, su dibujo en cada cuadro y dónde aparece (10/11/2026)
// =============================================================================
// Pedido de Martín (26/10/2026, otra vez el 9/11): «implementa esto de punta a punta: https://github.com/iart-ai/motion-skills
// que se puedan hacer motions graphics en la web y en el editor». Un motion graphic es un elemento `graphic` del motor de
// OpenCut con `definitionId` = «motion-<plantilla>» (app/video-editor/_opencut/graphics/definitions/motion.ts): sus campos
// son los params de la definición y se dibuja en CADA cuadro con su tiempo, del tamaño del lienzo. Lo que fija este archivo:
//   · una definición por plantilla, con los campos de lib/motion como params (y el paso de 0,01 del número de una cifra);
//   · el dibujo: el cuadro 0 y el último del clip vacíos, el medio con los textos, y sin tiempo (una miniatura) el final;
//   · el tamaño, la clave y el reuso del lienzo de la textura (graphics/fuente-grafico.ts), que preguntan cuatro lugares;
//   · que un motion NO aparece como forma en Stickers › Formas (stickers/providers/formas-reglas.ts);
//   · el cableado: el registro, la biblioteca «Motion», la pestaña «Motion» del inspector y el descriptor del cuadro.
// Lo visual (que se vea bien, que el reproductor no se trabe, el export) se mira en Chrome: acá no hay WebGPU.
//
// Correr: node --import tsx --test tests/video-editor-motion.test.ts
//
// PROBADO ROMPIÉNDOLO (10/11/2026, base 11/0, Node 24, cada rotura restaurada de memoria): la tabla, al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PREFIJO_MOTION, idDefinicionMotion, motionGraphicDefinitions, plantillaDeDefinicion, valoresDeParams,
} from '../app/video-editor/_opencut/graphics/definitions/motion';
import { claveDeFuente, reusaLienzo, tamanoDeFuente } from '../app/video-editor/_opencut/graphics/fuente-grafico';
import { DEFAULT_GRAPHIC_SOURCE_SIZE } from '../app/video-editor/_opencut/graphics/types';
import { formasNuevasDelRegistro } from '../app/video-editor/_opencut/stickers/providers/formas-reglas';
import { PLANTILLAS, camposDe, valoresPorDefecto } from '../lib/motion/plantillas';
import { PLANTILLAS_MOTION } from '../lib/motion/tipos';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const def = (p: (typeof PLANTILLAS_MOTION)[number]) => motionGraphicDefinitions.find((d) => d.id === `motion-${p}`)!;

/** Un contexto 2D que anota los textos que se dibujan visibles (mismo molde que tests/motion.test.ts). */
function ctxAnotador() {
  const textos: string[] = [];
  const nada = () => {};
  const ctx = new Proxy({ filter: 'none', letterSpacing: '0px', font: '', globalAlpha: 1 } as Record<string, unknown>, {
    get(obj, k: string) {
      if (k in obj) return obj[k];
      if (k === 'measureText') return (s: string) => ({ width: s.length * 10 });
      if (k === 'fillText') return (s: string) => { if ((obj.globalAlpha as number) > 0.01) textos.push(s); };
      return nada;
    },
    set(obj, k: string, v) { obj[k] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, textos };
}

test('V1: una definición ANIMADA por plantilla, con los campos de lib/motion como params', () => {
  assert.deepEqual(motionGraphicDefinitions.map((d) => d.id), PLANTILLAS_MOTION.map((p) => `motion-${p}`));
  for (const p of PLANTILLAS_MOTION) {
    const d = def(p);
    assert.equal(d.animado, true, `${p}: se dibuja en cada cuadro`);
    assert.equal(d.name, `Motion · ${PLANTILLAS[p].nombre}`);
    assert.ok(d.keywords.includes('motion'));
    const campos = camposDe(p);
    assert.deepEqual(d.params.map((x) => x.key), campos.map((c) => c.clave), `${p}: los mismos campos, en el mismo orden`);
    for (const x of d.params) assert.equal(x.keyframable, false, `${p} ${x.key}: la coreografía es de la plantilla`);
  }
  const tipos = Object.fromEntries(def('cifra').params.map((x) => [x.key, x.type]));
  assert.deepEqual([tipos.prefijo, tipos.numero, tipos.colorAcento, tipos.tono, tipos.conFondo], ['text', 'number', 'color', 'select', 'boolean']);
  const numero = def('cifra').params.find((x) => x.key === 'numero') as { step?: number };
  assert.equal(numero.step, 0.01, 'el panel deja escribir 4,5 (con paso 1, el motor lo llevaba a 5)');
});

test('V2: «motion-<plantilla>» va y vuelve; lo que no es una plantilla no es un motion', () => {
  for (const p of PLANTILLAS_MOTION) assert.equal(plantillaDeDefinicion(idDefinicionMotion(p)), p);
  assert.equal(plantillaDeDefinicion('motion-carrusel'), null);
  assert.equal(plantillaDeDefinicion('rectangle'), null);
  assert.equal(plantillaDeDefinicion(`${PREFIJO_MOTION}`), null);
});

test('V3: los valores de la plantilla salen de los params SIN lo del elemento (posición, opacidad)', () => {
  const params = { ...valoresPorDefecto('cifra'), numero: 4.5, 'transform.positionX': 40, opacity: 0.9, inventado: 'x' };
  const v = valoresDeParams('cifra', params);
  assert.equal(v.numero, 4.5);
  assert.ok(!('transform.positionX' in v) && !('opacity' in v) && !('inventado' in v));
  assert.deepEqual(Object.keys(v), camposDe('cifra').map((c) => c.clave));
});

test('V4: el dibujo: el cuadro 0 y el último del clip vacíos, el medio con sus textos, y sin tiempo el estado final', () => {
  for (const p of PLANTILLAS_MOTION) {
    const d = def(p);
    const params = valoresPorDefecto(p);
    const duracion = PLANTILLAS[p].duracionMs / 1000;
    const dibujar = (tiempo: number | undefined, W = 1920, H = 1080) => {
      const a = ctxAnotador();
      d.render({ ctx: a.ctx, params, width: W, height: H, tiempo, duracion: tiempo === undefined ? undefined : duracion });
      return a.textos;
    };
    assert.deepEqual(dibujar(0), [], `${p}: el primer cuadro vacío`);
    assert.deepEqual(dibujar(duracion), [], `${p}: el último cuadro vacío`);
    assert.ok(dibujar(duracion * 0.6).length > 0, `${p}: en el medio se ve`);
    assert.ok(dibujar(duracion * 0.6, 1080, 1920).length > 0, `${p}: en vertical también`);
    assert.ok(dibujar(undefined).length > 0, `${p}: la miniatura (sin tiempo) es el bloque terminado`);
  }
  // Una cifra con decimales: el lienzo dibuja «4», «,» y «5» (nunca un «5» solo).
  const a = ctxAnotador();
  def('cifra').render({ ctx: a.ctx, params: { ...valoresPorDefecto('cifra'), prefijo: '', numero: 4.5 }, width: 1920, height: 1080 });
  assert.ok(a.textos.includes(','), 'la coma decimal se dibuja');
});

test('V5: fuera del navegador no hay fuentes que esperar (preparar devuelve null)', () => {
  for (const p of PLANTILLAS_MOTION) assert.equal(def(p).preparar?.(valoresPorDefecto(p)), null, p);
});

test('V6: el tamaño de la fuente: un animado es del lienzo; una forma, el cuadrado de 512', () => {
  assert.deepEqual(tamanoDeFuente({ animado: true, lienzo: { width: 1080.4, height: 1919.6 } }), { width: 1080, height: 1920 });
  assert.deepEqual(tamanoDeFuente({ animado: true, lienzo: { width: 0, height: 0 } }), { width: 2, height: 2 }, 'nunca un lienzo de 0');
  assert.deepEqual(tamanoDeFuente({ animado: false, lienzo: { width: 1920, height: 1080 } }), { width: DEFAULT_GRAPHIC_SOURCE_SIZE, height: DEFAULT_GRAPHIC_SOURCE_SIZE });
});

test('V7: la clave del dibujo: un animado cambia con el tiempo (al milisegundo); una forma, no', () => {
  const base = { definitionId: 'motion-titular', params: { titulo: 'Hola' }, width: 1920, height: 1080 };
  const anim = (tiempo: number) => claveDeFuente({ ...base, animado: true, tiempo, duracion: 5 });
  assert.notEqual(anim(1), anim(1.02), 'cada cuadro es otro dibujo');
  assert.equal(anim(1.0001), anim(1), 'el mismo milisegundo, el mismo dibujo');
  const forma = (tiempo: number) => claveDeFuente({ ...base, definitionId: 'rectangle', animado: false, tiempo });
  assert.equal(forma(1), forma(3), 'una forma no se redibuja por el tiempo');
  assert.notEqual(claveDeFuente({ ...base, animado: false }), claveDeFuente({ ...base, animado: false, width: 1080 }), 'el tamaño entra en la clave');
});

test('V8: sólo un animado reusa su lienzo, y sólo si mide lo mismo', () => {
  const previo = { width: 1920, height: 1080 };
  assert.equal(reusaLienzo({ animado: true, previo, width: 1920, height: 1080 }), true);
  assert.equal(reusaLienzo({ animado: true, previo, width: 1080, height: 1920 }), false, 'otro tamaño, lienzo nuevo');
  assert.equal(reusaLienzo({ animado: true, previo: null, width: 1920, height: 1080 }), false);
  assert.equal(reusaLienzo({ animado: false, previo: { width: 512, height: 512 }, width: 512, height: 512 }), false, 'una forma sigue como antes');
});

test('V9: Stickers › Formas no muestra los motion graphics', () => {
  const rect = { id: 'rectangle', name: 'Rectangle', animado: undefined };
  const otra = { id: 'heart', name: 'Corazón', animado: undefined };
  const nuevas = formasNuevasDelRegistro([rect, otra, ...motionGraphicDefinitions], new Set(['rectangle']));
  assert.deepEqual(nuevas, [{ shapeKey: 'heart', name: 'Corazón', definitionId: 'heart' }]);
});

test('V10: los cuatro lugares que miden la fuente de un `graphic` preguntan lo mismo (tamanoFuenteGrafico)', () => {
  for (const f of [
    'app/video-editor/_opencut/preview/element-bounds.ts',
    'app/video-editor/_opencut/services/renderer/compositor/frame-descriptor.ts',
    'app/video-editor/_opencut/services/renderer/resolve.ts',
    'app/video-editor/_opencut/services/renderer/nodes/graphic-node.ts',
  ]) {
    const src = sinComentarios(leer(f));
    assert.match(src, /tamanoFuenteGrafico\(\{/, `${f}: pregunta el tamaño`);
    assert.doesNotMatch(src, /DEFAULT_GRAPHIC_SOURCE_SIZE/, `${f}: no supone el cuadrado de 512`);
  }
  // (Las regex no nombran variables locales: renombrar una no puede ponerlas en rojo.)
  assert.match(sinComentarios(leer('app/video-editor/_opencut/graphics/index.ts')), /return tamanoDeFuente\(\{/);
  // El descriptor del cuadro (reproductor y export): espera las fuentes, pasa el tiempo y la versión de la textura.
  const fd = sinComentarios(leer('app/video-editor/_opencut/services/renderer/compositor/frame-descriptor.ts'));
  assert.match(fd, /const (\w+) = node\.preparar\(node\.resolved\.resolvedParams\);\s*if \(\1\) await \1;/, 'espera las fuentes antes de dibujar');
  assert.match(fd, /tiempo: node\.resolved\.localTime \/ TICKS_PER_SECOND,\s*duracion: node\.params\.duration \/ TICKS_PER_SECOND,/);
  assert.match(fd, /node instanceof GraphicNode\s*\?\s*node\.versionFuente/);
  const nodo = sinComentarios(leer('app/video-editor/_opencut/services/renderer/nodes/graphic-node.ts'));
  assert.match(nodo, /reusaLienzo\(\{/);
  assert.match(nodo, /claveDeFuente\(\{/);
  assert.match(nodo, /this\.versionFuente\+\+;/);
});

test('V11: el cableado: registrado, en la biblioteca «Motion» y con su pestaña «Motion» en el inspector (no «Formas»)', () => {
  assert.match(sinComentarios(leer('app/video-editor/_opencut/graphics/definitions/index.ts')), /\.\.\.motionGraphicDefinitions,/);
  assert.match(sinComentarios(leer('app/video-editor/ce/extensiones.ts')), /import '\.\.\/_opencut\/motion\/registro';/);
  const reg = sinComentarios(leer('app/video-editor/_opencut/motion/registro.ts'));
  assert.match(reg, /categoria: "plantillas",\s*id: SECCION_PLANTILLAS_MOTION,\s*etiqueta: "Motion"/);
  const ins = sinComentarios(leer('app/video-editor/_opencut/components/editor/panels/properties/registry.tsx'));
  assert.match(ins, /id: "formas",[\s\S]{0,80}aplica: \(\{ element \}\) => element\.type === "graphic" && !element\.definitionId\.startsWith\(PREFIJO_MOTION\)/);
  assert.match(ins, /id: "motion",\s*etiqueta: "Motion",[\s\S]{0,40}aplica: \(\{ element \}\) => element\.type === "graphic" && element\.definitionId\.startsWith\(PREFIJO_MOTION\)/);
  // El panel de un motion es el suyo (textos y estilo), no el de una forma.
  assert.match(sinComentarios(leer('app/video-editor/_opencut/graphics/components/graphic-tab.tsx')), /if \(definition\.animado\) return <MotionTab /);
  // La biblioteca agrega con la duración de la plantilla, en el cabezal y en su pista.
  const bib = sinComentarios(leer('app/video-editor/_opencut/motion/components/biblioteca-motion.tsx'));
  assert.match(bib, /definitionId: idDefinicionMotion\(plantilla\)/);
  assert.match(bib, /element\.duration = mediaTimeFromSeconds\(\{ seconds: def\.duracionMs \/ 1000 \}\)/);
  assert.match(bib, /editor\.timeline\.insertElement\(\{ placement: \{ mode: "auto" \}, element \}\)/);
});

// PROBADO ROMPIÉNDOLO (10/11/2026, base 11/0):
//   · el número de la cifra con `step: 1` en el panel                         -> 10/1 (V1)
//   · los motion fuera del registro (definitions/index.ts)                    -> 10/1 (V11)
//   · Stickers › Formas muestra los animados                                  -> 10/1 (V9)
//   · `tamanoDeFuente` INVERTIDO                                              -> 10/1 (V6)
//   · la clave del dibujo sin el tiempo (el reproductor se quedaría quieto)   -> 10/1 (V7)
//   · una forma reusa su lienzo                                               -> 10/1 (V8)
//   · el descriptor del cuadro no espera las fuentes                          -> 10/1 (V10)
//   · el dibujo ignora el tiempo                                              -> 10/1 (V4)
//   · los valores de la plantilla con los params del elemento                 -> 10/1 (V3)
//   · la pestaña «Formas» también para un motion                              -> 10/1 (V11)
//   · el nodo sin `versionFuente++`                                           -> 10/1 (V10)
//   · sin efecto: renombrar las locales `previo` (graphic-node.ts) y `listo` (frame-descriptor.ts) -> 11/0
