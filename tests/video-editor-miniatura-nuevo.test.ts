// =============================================================================
// «Nuevo video»: cada plantilla de anuncio dibuja SU miniatura, sin traer el motor a la portada (F160, 18/11/2026)
// =============================================================================
// La ranura `miniatura` de PantallaCrear existía desde el 29/10 y Video no la llenaba: las tarjetas de anuncio se veían como
// el marco vacío con su rótulo (app/video-editor/miniatura-nuevo-video.tsx cuenta el porqué). Esto fija, EJECUTANDO:
//   1. cada tarjeta de anuncio de «Nuevo video» se dibuja con su canvas (la tarjeta REAL de app/_crear con la función real),
//      y lo que no es un anuncio sigue con lo suyo;
//   2. el grafo de la miniatura (leído con el parser de TypeScript, sólo los imports de VALOR) no llega al motor: ni el
//      núcleo, ni el .wasm, ni mediabunny, ni la puerta ./editor-cargado. Si llegara, la portada bajaría el editor entero;
//   3. la pantalla de la computadora le pasa esa función a PantallaCrear.
//
// Correr: node --import tsx --test tests/video-editor-miniatura-nuevo.test.ts
//
// PROBADO ROMPIÉNDOLO (18/11/2026): base 3/0 →
//   · `plantillaDeTarjeta` devolviendo siempre null → 2/1 (cae el 1);
//   · `plantillaDeTarjeta` devolviendo la plantilla del catálogo, sin el ejemplo → 2/1 (cae el 1);
//   · `plantillaDeTarjeta` armando un objeto nuevo en cada llamada → 2/1 (cae el 1);
//   · `import { EditorCore } from './_opencut/core'` en miniatura-nuevo-video.tsx → 1/2 (caen el 2, por el grafo, y el 1, que
//     ya no carga en node: el .wasm del núcleo tira al importarse);
//   · `miniatura={miniaturaDeNuevoVideo}` sacado de VideoEditorCliente → 2/1 (cae el 3).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { PlantillaCrear } from '@/app/_crear/reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ⚠️ Las piezas se importan ADENTRO del test, no arriba: si la miniatura arrastrara el motor, su .wasm tiraría al CARGAR el
// archivo, y un archivo que tira al cargar no nombra qué test cayó (AGENTS.md → «un archivo que tira AL CARGAR»).
test('1. cada plantilla de anuncio de «Nuevo video» se dibuja con SU miniatura, y lo demás sigue con lo suyo', async () => {
  const { TarjetaPlantilla } = await import('@/app/_crear/TarjetaPlantilla');
  const { miniaturaDeNuevoVideo } = await import('@/app/video-editor/miniatura-nuevo-video');
  const { plantillaDeTarjeta, plantillasNuevoVideo } = await import('@/app/video-editor/plantillas-crear');
  const { PLANTILLAS } = await import('@/lib/editor-video/plantillas');
  const tarjeta = (pl: PlantillaCrear) => renderToStaticMarkup(createElement(TarjetaPlantilla, {
    pl, activa: false, usando: null, miniatura: miniaturaDeNuevoVideo, onUsar: () => {}, onActiva: () => {},
  }));
  const todas = plantillasNuevoVideo(null);
  const anuncios = todas.filter((p) => plantillaDeTarjeta(p.id));
  assert.equal(anuncios.length, PLANTILLAS.length, 'una tarjeta dibujada por cada plantilla del catálogo');
  for (const p of anuncios) {
    const html = tarjeta(p);
    const id = plantillaDeTarjeta(p.id)!.id;
    assert.match(html, /<canvas\b/, `${p.nombre}: sin canvas, sigue siendo el marco vacío`);
    assert.ok(html.includes(`data-miniatura-plantilla="${id}"`), `${p.nombre}: dibuja otra plantilla que la suya`);
    assert.doesNotMatch(html, /cr-plantilla__marco/, `${p.nombre}: el marco vacío no va debajo de la miniatura`);
  }
  // Un lienzo, «Generar con IA» y las guiadas no son anuncios: ni canvas ni marca.
  for (const p of todas.filter((x) => !plantillaDeTarjeta(x.id))) {
    const html = tarjeta(p);
    assert.doesNotMatch(html, /<canvas\b|data-miniatura-plantilla/, `${p.nombre}: no es una plantilla de anuncio`);
  }
  assert.equal(miniaturaDeNuevoVideo({ id: 'plantilla:no-existe', nombre: 'x', formato: '9 / 16' }, false), null, 'un id que no está en el catálogo');
  // Lo que se dibuja es el EJEMPLO (la «Miniatura» de cada plantilla en docs/plantillas-reales/video.md), no la muestra
  // genérica del catálogo, y es el MISMO objeto en cada render (la tarjeta la pide siempre; uno nuevo la redibujaría).
  const { ejemploDeVideo } = await import('@/lib/editor-video/plantillas-ejemplos');
  let comparados = 0;
  for (const p of anuncios) {
    const dibujada = plantillaDeTarjeta(p.id)!;
    assert.equal(plantillaDeTarjeta(p.id), dibujada, `${p.nombre}: otro objeto en cada llamada`);
    const e = ejemploDeVideo(dibujada.id);
    if (!e) continue;
    for (const pieza of dibujada.piezas) {
      if (pieza.tipo !== 'texto' || !pieza.hueco || !(pieza.hueco.nombre in e.textos)) continue;
      assert.equal(pieza.muestra, e.textos[pieza.hueco.nombre], `${p.nombre}: el hueco ${pieza.hueco.nombre} no muestra el ejemplo`);
      comparados++;
    }
  }
  assert.ok(comparados >= 10, `sólo ${comparados} huecos comparados: el lector no miró los ejemplos`);
});

/** Los archivos del repo que `desde` importa por VALOR, transitivamente; y los paquetes externos. */
function grafoDeValor(desde: string): { archivos: Set<string>; paquetes: Set<string> } {
  const archivos = new Set<string>();
  const paquetes = new Set<string>();
  const resolver = (de: string, esp: string): string | null => {
    const base = esp.startsWith('@/') ? join(RAIZ, esp.slice(2)) : esp.startsWith('.') ? resolve(dirname(de), esp) : null;
    if (!base) return null;
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) if (existsSync(base + ext)) return base + ext;
    return existsSync(base) && /\.(ts|tsx)$/.test(base) ? base : null;
  };
  const pila = [join(RAIZ, desde)];
  while (pila.length) {
    const f = pila.pop()!;
    if (archivos.has(f)) continue;
    archivos.add(f);
    const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const especificadores: string[] = [];
    sf.forEachChild((n) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        const c = n.importClause;
        if (c?.isTypeOnly) return;
        const nombres = c?.namedBindings && ts.isNamedImports(c.namedBindings) ? c.namedBindings.elements : null;
        // `import { type A, type B } from` sin nada más se borra al compilar.
        if (c && !c.name && nombres && nombres.length > 0 && nombres.every((e) => e.isTypeOnly)) return;
        especificadores.push(n.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) {
        especificadores.push(n.moduleSpecifier.text);
      }
    });
    // Y los `import()` dinámicos también cuentan: bajan su grupo.
    const dinamicos = [...sf.text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    for (const esp of [...especificadores, ...dinamicos]) {
      const r = resolver(f, esp);
      if (r) pila.push(r);
      else if (!esp.startsWith('.') && !esp.startsWith('@/')) paquetes.add(esp);
    }
  }
  return { archivos, paquetes };
}

test('2. la miniatura de «Nuevo video» no trae el motor: ni el núcleo, ni el .wasm, ni mediabunny, ni la puerta', () => {
  const { archivos, paquetes } = grafoDeValor('app/video-editor/miniatura-nuevo-video.tsx');
  const rel = [...archivos].map((f) => f.slice(RAIZ.length + 1).replace(/\\/g, '/'));
  // Un piso: si el lector dejara de seguir imports, contestaría «nada del motor» sin haber mirado.
  assert.ok(rel.includes('app/video-editor/_opencut/plantillas/dibujo.ts'), 'el lector no siguió los imports');
  assert.ok(rel.length >= 10, `el grafo tiene ${rel.length} archivos: el lector no siguió los imports`);
  const delMotor = rel.filter((f) => /^app\/video-editor\/(editor-cargado\.ts|_opencut\/(core|wasm|services|media)\/)/.test(f));
  assert.deepEqual(delMotor, [], 'la miniatura arrastra el motor a la portada');
  assert.ok(!paquetes.has('mediabunny'), 'la miniatura arrastra mediabunny a la portada');
});

test('3. la pantalla de la computadora le pasa la miniatura a PantallaCrear', () => {
  const src = vivo(leer('app/video-editor/VideoEditorCliente.tsx'));
  assert.match(src, /<PantallaCrear[\s\S]*?\bminiatura=\{miniaturaDeNuevoVideo\}[\s\S]*?>/, 'sin la ranura, las tarjetas de anuncio vuelven al marco vacío');
  assert.match(src, /^import \{ miniaturaDeNuevoVideo \} from '\.\/miniatura-nuevo-video';$/m, 'estática: un import() propio duplica lo que el editor también trae');
});
