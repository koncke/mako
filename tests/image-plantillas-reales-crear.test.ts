// =============================================================================
// Las plantillas reales de Image en «Nuevo diseño», en su «Ver ejemplo» y en la API de MaKo (6/11/2026)
// =============================================================================
// Martín, 29/10/2026: «Los templates tienen que ser reales» y «Poné la estructura, la misma, y en algún lado un botón de
// "ver ejemplo"». El módulo de las plantillas (lib/image-editor/plantillas-reales.ts) lo cuida su propio test; éste fija
// cómo entran a la pantalla:
//   1. cada plantilla tiene su tarjeta, con su grupo, su insignia, cuándo usarla y «Ver ejemplo» (sin la cinta «Ejemplo»,
//      que cae en la misma esquina), y un id que no choca con ninguna otra;
//   2. la acción crea la ESTRUCTURA (nunca el ejemplo lleno) cuando la tarjeta es una real;
//   3. la miniatura de la tarjeta dibuja lo que se crea (los textos de la estructura y los marcos de foto vacíos), y el
//      ejemplo dibuja la misma composición llena, sin un solo link a una foto;
//   3b. cada fuente que usan existe en el catálogo del editor, con su peso: la miniatura la pide ahí y el motor también
//      (una que falta cae a la del sistema sin avisar, y el texto se sale del marco: medido el 6/11/2026);
//   4. la pantalla de la computadora y la del teléfono la dibujan con la MISMA pieza, y «Ver ejemplo» abre el diálogo;
//   5. la API crea la estructura con `plantilla: <id>` y lista las reales con los textos de su ejemplo.
//
// Correr: node --import tsx --test tests/image-plantillas-reales-crear.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PLANTILLAS_NUEVO_DISENO, PREFIJO_REAL, plantillaNueva } from '../app/image-editor/plantillas-crear';
import { PLANTILLAS_IMAGEN, plantillaImagen } from '../lib/image-editor/plantillas-reales';
import { resumirDoc, srcsLocales, textosDe } from '../lib/image-editor/reglas';
import { MiniaturaDiseno, familiaPrincipal } from '../app/image-editor/MiniaturaDiseno';
import { FUENTES } from '../app/image-editor/mako/fuentes';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

let n = 0;
const id = () => `x${++n}`;
/** El texto visible de un HTML, con las entidades más comunes de vuelta. */
const visible = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const plano = (s: string) => s.replace(/\s+/g, ' ').trim();

test('1: cada plantilla real tiene su tarjeta, con su grupo, insignia, cuándo usarla y «Ver ejemplo»', () => {
  assert.ok(PLANTILLAS_IMAGEN.length >= 9, 'faltan plantillas reales');
  for (const p of PLANTILLAS_IMAGEN) {
    const t = plantillaNueva(`${PREFIJO_REAL}${p.id}`);
    assert.ok(t, `«${p.nombre}» no está en «Nuevo diseño»`);
    assert.equal(t.real, p.id);
    assert.equal(t.nombre, p.nombre);
    assert.equal(t.grupo, p.grupo, `${p.id}: el grupo de la tarjeta`);
    assert.equal(t.insignia, p.insignia);
    assert.equal(t.ayuda, p.cuando);
    assert.equal(t.verEjemplo, true, `${p.id}: el ejemplo se ve aparte`);
    assert.equal(t.ejemplo, undefined, `${p.id}: la cinta «Ejemplo» cae en la esquina de «Ver ejemplo»`);
    assert.deepEqual([t.ancho, t.alto, t.paginas], [p.ancho, p.alto, p.paginas]);
    assert.equal(t.formato, `${p.ancho} / ${p.alto}`);
  }
  const ids = PLANTILLAS_NUEVO_DISENO.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'dos tarjetas con el mismo id');
  assert.equal(plantillaImagen('no-existe'), null);
  assert.equal(plantillaImagen({}), null);
});

test('2: la acción crea la ESTRUCTURA de una real, antes que cualquier otra rama', () => {
  const src = sinComentarios(leer('app/image-editor/actions.ts'));
  assert.match(src, /const real = pl\.real \? plantillaImagen\(pl\.real\) : null;/);
  assert.match(src, /const doc = real\s*\?\s*real\.estructura\(randomUUID\)\s*:\s*tipo/, 'la real va primero, con su estructura');
  assert.doesNotMatch(src, /\.ejemplo\(/, 'el ejemplo lleno no se crea: se ve aparte');
});

test('3: la miniatura dibuja la estructura (textos y marcos vacíos), y el ejemplo, la misma composición llena', () => {
  for (const p of PLANTILLAS_IMAGEN) {
    const est = p.estructura(id);
    const ej = p.ejemplo(id);
    assert.ok(resumirDoc(est) && resumirDoc(ej), `${p.id}: sin forma de diseño`);
    assert.deepEqual(srcsLocales(est), [], `${p.id}: la estructura trae fotos locales`);
    for (const [cual, doc] of [['estructura', est], ['ejemplo', ej]] as const) {
      const html = renderToStaticMarkup(createElement(MiniaturaDiseno, { doc, titulo: p.nombre }));
      const texto = plano(visible(html));
      for (const t of textosDe(doc)[0].textos) {
        assert.ok(texto.includes(plano(t)), `${p.id} (${cual}): la miniatura no dibuja «${t.slice(0, 40)}»`);
      }
      assert.doesNotMatch(html, /<image|href="http|src="/, `${p.id} (${cual}): una miniatura no carga fotos`);
    }
    assert.notDeepEqual(textosDe(est), textosDe(ej), `${p.id}: la estructura y el ejemplo dicen lo mismo`);
  }
});

test('3b: cada fuente de las plantillas está en el catálogo del editor, con su peso y su estilo', () => {
  assert.equal(familiaPrincipal('"Anton", sans-serif'), 'Anton', 'el motor guarda la pila CSS: se pide la primera');
  assert.equal(familiaPrincipal("'DM Serif Display', serif"), 'DM Serif Display');
  for (const p of PLANTILLAS_IMAGEN) {
    for (const doc of [p.estructura(id), p.ejemplo(id)]) {
      for (const pg of doc.pages) {
        for (const o of pg.objects as unknown as Record<string, unknown>[]) {
          if (o.type !== 'textbox') continue;
          const fam = familiaPrincipal(o.fontFamily);
          const peso = typeof o.fontWeight === 'number' ? o.fontWeight : 400;
          const estilo = o.fontStyle === 'italic' ? 'italic' : 'normal';
          const v = FUENTES.find((f) => f.family === fam)?.variants.find((x) => x.weight === peso && x.style === estilo);
          assert.ok(v, `${p.id}: «${fam}» ${peso} ${estilo} no está en app/image-editor/mako/fuentes.ts`);
        }
      }
    }
  }
});

test('4: la computadora y el teléfono la dibujan con la misma pieza, y «Ver ejemplo» abre su diálogo', () => {
  const escritorio = sinComentarios(leer('app/image-editor/ImageEditorCliente.tsx'));
  assert.match(escritorio, /miniatura=\{miniatura\}/);
  assert.match(escritorio, /onVerEjemplo=\{onVerEjemplo\}/);
  assert.match(escritorio, /doc \? <MiniaturaTarjetaDiseno doc=\{doc\} nombre=\{p\.nombre\} \/> : miniaturaCarrusel\(p\)/, 'las reales con su estructura, los carruseles con lo suyo');
  assert.match(escritorio, /if \(real\) setEjemploReal\(\{ tarjeta: p\.id, real \}\);\s*else verEjemploCarrusel\(p\);/);
  assert.match(escritorio, /<EjemploPlantillaImagen p=\{plantillaDelEjemplo\} alSalir=\{[^}]+\} alUsar=\{\(\) => crearPlantilla\(ejemploReal\.tarjeta\)\} \/>/);
  const dialogo = sinComentarios(leer('app/image-editor/EjemploPlantillaImagen.tsx'));
  assert.match(dialogo, /p\.ejemplo\(idLocal\)/, 'el diálogo dibuja el ejemplo, no la estructura');
  assert.match(dialogo, /negocio ficticio/);
  const telefono = sinComentarios(leer('app/m/image-editor/InicioImagenM.tsx'));
  assert.match(telefono, /<MiniaturaTarjetaDiseno doc=\{docsReales\.get\(p\.id\)!\} nombre=\{p\.nombre\} \/>/);
  assert.match(telefono, /real\.estructura\(idLocal\)/);
});

test('5: la API crea la estructura de una real y lista las reales con los textos de su ejemplo', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/imagen.run.ts'));
  assert.match(run, /const real = plantilla \? plantillaImagen\(plantilla\) : null;\s*if \(real\) \{\s*return \{\s*doc: real\.estructura\(randomUUID\)/);
  assert.match(run, /reales: PLANTILLAS_IMAGEN\.map\(/);
  assert.match(run, /ejemplo: \{ negocio: `\$\{p\.negocio\} \(ficticio\)`, textos: textosDe\(p\.ejemplo\(randomUUID\)\) \}/);
  const def = leer('lib/api-mako/areas/imagen.def.ts');
  // Desde el 6/11/2026 `plantilla` acepta SÓLO el id de una real: las 10 de Doory, que entraban por su slug, se
  // borraron. Antes decía «el id o el slug».
  assert.match(def, /El id de una plantilla de MaKo/, 'el modelo sabe que `plantilla` acepta el id de una real');
  assert.doesNotMatch(def, /diseño libre|el slug/, 'volvió a ofrecer las plantillas de Doory, que ya no existen');
});

// PROBADO ROMPIÉNDOLO (6/11/2026, base 5/0; de a una y restaurando):
//   · la acción con `real.ejemplo(randomUUID)` en vez de la estructura         → 4/1 (2);
//   · la tarjeta con `ejemplo: p.negocio` (la cinta en la esquina del botón)    → 4/1 (1);
//   · la miniatura sin el `foreignObject` del texto                             → 4/1 (3);
//   · `onVerEjemplo={carruseles.onVerEjemplo}` en la pantalla                   → 4/1 (4);
//   · `familiaPrincipal` devolviendo la pila entera (el bug que se vio mirando)  → 5/1 (3b).
// Restaurado: 6/0.
