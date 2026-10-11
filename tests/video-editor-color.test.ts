// =============================================================================
// Video Editor, color: los shaders `ce-*` y las LUT (paquete F, 11/10/2026)
// =============================================================================
// Los filtros, el Ajustar, el croma y los efectos de video corren en shaders GLSL
// propios (services/renderer/pases-ce.ts). Un shader que no compila o un uniform
// mal nombrado NO tira error: pases-ce.ts lo atrapa para que la reproducción siga,
// y el cuadro sale sin el efecto. Nadie se entera hasta mirarlo. Por eso:
//
//   1. NINGÚN UNIFORM SE DECLARA DOS VECES. La cabecera común (effects/glsl.ts)
//      declara el espacio (`u_capa`, `u_giro`, `u_lienzo`, `u_tiempo`…); un
//      efecto con un parámetro «Giro» que se mapeaba a `u_giro` lo redeclaraba y
//      el Remolino no compilaba (pasó, 11/10/2026, lo vio el compilador de GL).
//   2. CADA UNIFORM QUE MANDA UN PASE ESTÁ DECLARADO EN SU SHADER, y no es una de
//      las entradas que pone pases-ce.ts. Un nombre mal escrito da una ubicación
//      nula y el parámetro deja de hacer algo, en silencio; uno que pisa una
//      entrada (`u_textura` por `u_tamano`) le escribe un float a un sampler.
//   3. UN AJUSTE EN CERO NO CORRE NINGÚN PASE (la pestaña Ajustar crea el efecto
//      con el primer toque: si en cero costara un pase, cada clip tocado y vuelto
//      a cero pagaría una vuelta de GPU por cuadro).
//   4. LAS LUT SE LEEN EN EL ORDEN DE LA TEXTURA (R más rápido). El .3dl viene
//      con B más rápido: sin reordenar, los colores salen cruzados.
//
// Lo que este test NO ve: si el GLSL compila en WebGL2. Eso se revisó con el
// compilador de GL de escritorio (moderngl, #version 330 en lugar de 300 es) y
// buscando a mano enteros en contexto float, que GLSL ES no convierte solo.
//
// Correr: node --import tsx --test tests/video-editor-color.test.ts
// PROBADO ROMPIÉNDOLO (11/10/2026, de a una y restaurando):
//   R1 el Remolino otra vez con `uniform float u_giro` propio            → 3/1 (de 4)
//   R2 el grano mapeando «Textura» a `u_textura` en vez de `u_tamano`    → 3/1 (de 4)
//   R3 `ajusteEsNeutro` que siempre dice false                           → 3/1 (de 4)
//   R4 leer3dl sin reordenar (índice de línea = índice de textura)       → 3/1 (de 4)
// Restaurado: 4/0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajusteEffectDefinition } from '../app/video-editor/_opencut/effects/definitions/ajuste';
import { cromaEffectDefinition } from '../app/video-editor/_opencut/effects/definitions/croma';
import { filtroEffectDefinitions } from '../app/video-editor/_opencut/effects/definitions/filtros';
import { efectoEffectDefinitions } from '../app/video-editor/_opencut/effects/definitions/efectos';
import { shadersRegistrados } from '../app/video-editor/_opencut/services/renderer/pases-ce';
import { leer3dl, leerCube } from '../app/video-editor/_opencut/effects/lut/leer-lut';
import type { EffectDefinition } from '../app/video-editor/_opencut/effects/types';

const DEFINICIONES: EffectDefinition[] = [
  ajusteEffectDefinition,
  cromaEffectDefinition,
  ...filtroEffectDefinitions,
  ...efectoEffectDefinitions,
];

/** Los nombres de los uniforms declarados («uniform float u_a, u_b[3];»). */
function uniformsDeclarados(fuente: string): string[] {
  const sinComentarios = fuente.replace(/\/\/.*$/gm, '');
  const nombres: string[] = [];
  for (const m of sinComentarios.matchAll(/^\s*uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?\w+\s+([^;]+);/gm)) {
    for (const parte of m[1].split(',')) nombres.push(parte.trim().replace(/\[.*\]$/, ''));
  }
  return nombres;
}

/** Lo que pases-ce.ts le pone a cada pase: un pase no lo manda. */
const ENTRADAS = new Set(['u_textura', 'u_texturaB', 'u_resolucion', 'u_lutTex', 'u_lutTamano']);

function pasesPorDefecto(def: EffectDefinition) {
  const params: Record<string, number | string | boolean> = { __tiempo: 1.5 };
  for (const p of def.params) params[p.key] = p.default;
  // Que todos los caminos manden sus uniforms: algo distinto de cero en cada número.
  for (const p of def.params) if (p.type === 'number' && p.default === 0) params[p.key] = (p.max ?? 100) / 2;
  return def.renderer.buildPasses!({ effectParams: params, width: 320, height: 180 });
}

test('ningún shader ce-* declara dos veces el mismo uniform', () => {
  const repetidos: string[] = [];
  for (const [id, fuente] of shadersRegistrados()) {
    const nombres = uniformsDeclarados(fuente);
    const vistos = new Set<string>();
    for (const n of nombres) {
      if (vistos.has(n)) repetidos.push(`${id}: ${n}`);
      vistos.add(n);
    }
  }
  assert.deepEqual(repetidos, []);
});

test('cada uniform que manda un pase está declarado en su shader', () => {
  const sueltos: string[] = [];
  for (const def of DEFINICIONES) {
    for (const pase of pasesPorDefecto(def)) {
      const fuente = shadersRegistrados().get(pase.shader);
      assert.ok(fuente, `${def.type}: el shader ${pase.shader} no está registrado`);
      const declarados = new Set(uniformsDeclarados(fuente));
      for (const nombre of Object.keys(pase.uniforms)) {
        // Las entradas las pone pases-ce.ts: un pase que manda `u_textura` le
        // escribe un float a un sampler (error de GL, el pase no dibuja).
        if (ENTRADAS.has(nombre)) sueltos.push(`${def.type} → ${nombre} (lo pone pases-ce)`);
        // `u_lut` no es un uniform: pases-ce.ts lo cambia por la textura `u_lutTex`.
        const real = nombre === 'u_lut' ? 'u_lutTex' : nombre;
        if (!declarados.has(real)) sueltos.push(`${def.type} → ${nombre}`);
      }
    }
  }
  assert.deepEqual(sueltos, []);
});

test('un ajuste en cero no corre pases; con un deslizador movido, uno', () => {
  const ceros: Record<string, number | string | boolean> = {};
  for (const p of ajusteEffectDefinition.params) ceros[p.key] = p.default;
  const build = ajusteEffectDefinition.renderer.buildPasses!;
  assert.equal(build({ effectParams: ceros, width: 10, height: 10 }).length, 0);
  assert.equal(build({ effectParams: { ...ceros, brillo: 10 }, width: 10, height: 10 }).length, 1);
  assert.equal(build({ effectParams: { ...ceros, 'hsl.verde.saturacion': -40 }, width: 10, height: 10 }).length, 1);
});

test('las LUT .cube y .3dl salen en el orden de la textura (R más rápido)', () => {
  // La identidad de 2³ en orden de textura: índice = (b·2 + g)·2 + r.
  const identidad: number[] = [];
  for (let b = 0; b < 2; b++) for (let g = 0; g < 2; g++) for (let r = 0; r < 2; r++) identidad.push(r * 255, g * 255, b * 255, 255);

  const cube = ['LUT_3D_SIZE 2', '0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1'].join('\n');
  assert.deepEqual([...leerCube(cube).rgba], identidad);

  // El .3dl lista con B más rápido: línea = (r·2 + g)·2 + b, en 10 bits.
  const lineas = ['0 1023'];
  for (let r = 0; r < 2; r++) for (let g = 0; g < 2; g++) for (let b = 0; b < 2; b++) lineas.push(`${r * 1023} ${g * 1023} ${b * 1023}`);
  assert.deepEqual([...leer3dl(lineas.join('\n')).rgba], identidad);

  assert.throws(() => leerCube('LUT_1D_SIZE 2\n0 0 0\n1 1 1'));
});
