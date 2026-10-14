// =============================================================================
// La vista previa de una plantilla de hoja es una PÁGINA (14/10/2026)
// =============================================================================
// Martín: «Y los templates, la preview debería ser como los de landing generator, porque justamente se deberían ver como
// una pagina... Lo mismo te pido que le digas a dashboard». ./app/dashboard/MiniaturaHoja.tsx dibuja la FORMA de cada
// plantilla (sus componentes en su lugar de la grilla, con su título y un boceto de su tipo) sin pedir datos.
//
// Lo que fija, DIBUJANDO cada plantilla del Dashboard y de General (no leyendo el fuente):
//   · cada componente está en la página, y lo que se lee es lo de la plantilla: el título de cada gráfico, el nombre de
//     cada bloque de General y el texto de cada Texto, con sus variables ya con el ejemplo (una llave cruda se lee como
//     un error);
//   · es DETERMINISTA: la pantalla en blanco se dibuja también en el server, y un HTML distinto en el navegador rompe la
//     hidratación;
//   · no pide datos (medir cada plantilla al abrir serían ~157 gráficos por apertura).
// Correr: npx tsx --test tests/dashboard-miniatura-hoja.test.ts
//
// PROBADO ROMPIÉNDOLO (14/10/2026; base 3 / 0), cada rotura → 2 / 1:
//   · un bloque de General dibujado vacío (`return null` en vez de su tarjeta)            → «cada componente…»
//   · el Texto sin `conVariables` («{{saludo}}, {{nombre}}» crudo)                         → «cada componente…»
//   · el boceto con `Math.random()` en vez del azar estable por id                          → «determinista…»
//   · un `useEffect` en la miniatura                                                          → «no pide datos…»

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { esElemento, esGrafico, tituloDe } from '../lib/graficos-catalogo';
import { VARIABLES_TEXTO, conVariables, esPiezaGeneral, piezaGeneral } from '../lib/general-piezas';
import { MiniaturaHoja, hojaDeMuestra } from '../app/dashboard/MiniaturaHoja';

const TODAS = [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const dibujar = (id: string) => {
  const p = TODAS.find((x) => x.id === id)!;
  return renderToStaticMarkup(createElement(MiniaturaHoja, { hoja: hojaDeMuestra(p) }));
};
const EJEMPLOS = Object.fromEntries(VARIABLES_TEXTO.map((v) => [v.id, v.ejemplo]));

test('cada componente de cada plantilla está en la página, con lo que dice la plantilla', () => {
  let vistos = 0;
  for (const p of TODAS) {
    const h = hojaDeMuestra(p);
    assert.ok(h, `${p.id}: la plantilla no se arma`);
    const html = dibujar(p.id);
    assert.equal((html.match(/class="mh-pos"/g) ?? []).length, h!.componentes.length, `${p.id}: falta un componente en la página`);
    assert.ok(html.includes(esc(h!.nombre)), `${p.id}: sin el nombre de la hoja arriba`);
    assert.doesNotMatch(html, /\{\{|NaN|undefined/, `${p.id}: una variable cruda o una medida rota`);
    for (const c of h!.componentes) {
      let esperado: string | null = null;
      if (esGrafico(c)) esperado = tituloDe(c);
      else if (esElemento(c) && c.tipo === 'texto') esperado = conVariables(c.texto, EJEMPLOS);
      else if (esElemento(c) && c.tipo === 'general' && esPiezaGeneral(c.general?.pieza)) esperado = c.texto.trim() || piezaGeneral(c.general!.pieza).nombre;
      if (!esperado) continue;
      assert.ok(html.includes(esc(esperado)), `${p.id}/${c.id}: no se lee «${esperado}»`);
      vistos++;
    }
  }
  assert.ok(vistos > 150, `revisé ${vistos} componentes: el recorrido no está mirando`);
  // La Bienvenida saluda con el ejemplo, no con la llave.
  assert.ok(dibujar('bienvenida').includes(esc(conVariables('{{saludo}}, {{nombre}}', EJEMPLOS))));
});

test('es determinista: el server y el navegador dibujan lo mismo', () => {
  for (const p of TODAS) assert.equal(dibujar(p.id), dibujar(p.id), `${p.id}: dos dibujos distintos`);
});

test('no pide datos: dibuja la forma, sin efectos ni lecturas', () => {
  const src = readFileSync(join(__dirname, '..', 'app/dashboard/MiniaturaHoja.tsx'), 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.doesNotMatch(src, /\bfetch\(|datosDeGraficos|useEffect|useState|Math\.random/);
});
