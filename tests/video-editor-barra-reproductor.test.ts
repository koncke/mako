// =============================================================================
// La fila de abajo del reproductor: a ningún ancho de panel se encima nada (Martín, 30/10/2026)
// =============================================================================
// Martín mandó una captura del reproductor de un 9:16 a ~500 px con «00:00:00:00 / 00:00:00…», ▶, «Completa ▾», la lupa,
// «Relación ▾» y pantalla completa encimados: «Se siguen rompiendo cosas, como esta… revisa bien todo». La barra era una
// grilla de tres columnas iguales (`1fr auto 1fr`) con los botones de texto fijos.
//
// Medido en el banco (la barra REAL compilada con esbuild y el CSS real con Tailwind, el motor reemplazado por datos
// inventados, en Chrome sin ventana; cada pieza medida por lo que se VE, sus letras y sus íconos):
//   · antes: de 460 px para abajo el ▶ pisa «Completa», de 380 para abajo el total se corta, de 230 para abajo «Completa»
//     sale del panel;
//   · después: de 120 a 700 px nada encimado, nada afuera, nada cortado, con un video de 60 s y otro de 1 h 02 min.
// Los niveles y sus umbrales viven en preview/barra-niveles.ts; acá se fijan, y lo que la pantalla hace con ellos.
//
// Probado rompiéndolo (30/10/2026): ver el final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatoDelTiempo, nivelDeBarra, UMBRALES_BARRA } from '../app/video-editor/_opencut/preview/barra-niveles';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('los niveles salen del ancho de la BARRA, con los umbrales medidos en el banco', () => {
  // Medido: la fila completa entra desde ~500 px; la compacta en una fila desde ~300; dos filas desde ~150.
  assert.deepEqual(UMBRALES_BARRA, { ancha: 520, media: 340, angosta: 165 });
  const casos: Array<[number, string]> = [
    [0, 'ancha'], // sin medir todavía: lo de siempre
    [700, 'ancha'], [520, 'ancha'],
    [519, 'media'], [500, 'media'], [340, 'media'], // la captura de Martín (~500 px) cae acá
    [339, 'angosta'], [230, 'angosta'], [165, 'angosta'],
    [164, 'minima'], [120, 'minima'],
  ];
  for (const [ancho, nivel] of casos) assert.equal(nivelDeBarra(ancho), nivel, `${ancho} px`);
});

test('el tiempo: con cuadros sólo en la ancha; compacto sin horas salvo que el video pase la hora', () => {
  assert.equal(formatoDelTiempo('ancha', 60), 'HH:MM:SS:FF');
  assert.equal(formatoDelTiempo('ancha', 3725), 'HH:MM:SS:FF');
  for (const nivel of ['media', 'angosta', 'minima'] as const) {
    assert.equal(formatoDelTiempo(nivel, 60.06), 'MM:SS', nivel);
    assert.equal(formatoDelTiempo(nivel, 3599.9), 'MM:SS', nivel);
    assert.equal(formatoDelTiempo(nivel, 3600), 'HH:MM:SS', `${nivel}: un video de una hora no cabe en MM:SS`);
  }
});

test('la pantalla: mide su ancho, no usa columnas que se desbordan, y cada botón tiene su forma compacta con el valor en el tooltip', () => {
  const src = sinComentarios(leer('app/video-editor/_opencut/preview/components/toolbar.tsx'));
  // El ancho de la barra, antes de pintar y con cada cambio del panel (el hook lo comparte con la barra de la línea de tiempo).
  assert.match(sinComentarios(leer('app/video-editor/_opencut/hooks/use-ancho.ts')), /useLayoutEffect\(\(\) => \{[\s\S]*?new ResizeObserver\(/);
  assert.match(src, /import \{ useAncho \} from "@\/app\/video-editor\/_opencut\/hooks\/use-ancho";/);
  assert.match(src, /const nivel = nivelDeBarra\(useAncho\(ref\)\);/);
  assert.match(src, /formato=\{formatoDelTiempo\(nivel, total \/ TICKS_PER_SECOND\)\}/);
  // `1fr` toma el mínimo de su contenido y la derecha se desbordaba sobre el ▶: va `minmax(0,1fr)`.
  assert.doesNotMatch(src, /grid-cols-\[1fr_auto_1fr\]/, 'volvieron las columnas que se desbordan');
  assert.equal((src.match(/grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/g) ?? []).length, 2);
  // Cuatro formas, y la de cada nivel.
  assert.match(src, /nivel === "ancha" \|\| nivel === "media" \?/);
  assert.match(src, /nivel === "angosta" \?/);
  assert.match(src, /const compacta = nivel !== "ancha";/);
  for (const menu of ['ResolucionMenu', 'ZoomMenu', 'RelacionMenu']) {
    assert.match(src, new RegExp(`<${menu} compacta=\\{compacta\\} />`), `${menu} no recibe la forma compacta`);
    assert.match(src, new RegExp(`function ${menu}\\(\\{ compacta \\}: \\{ compacta: boolean \\}\\)`));
  }
  // Compacta: sin texto, con el valor en el tooltip y en el nombre accesible.
  assert.match(src, /const ayuda = `Calidad de la reproducción: \$\{actual\.etiqueta\}`;/);
  assert.match(src, /const ayuda = isAtFit \? "Zoom: ajustado" : `Zoom: \$\{zoomPercent\}%`;/);
  assert.match(src, /const ayuda = tildada \? `Relación: \$\{tildada\.etiqueta\}` : "Relación";/);
  assert.equal((src.match(/aria-label=\{compacta \? ayuda : undefined\}/g) ?? []).length, 3);
  // El teléfono la esconde por su marca (app/m/video-editor/video-editor.css), no por una clase que ahora cambia.
  assert.match(src, /<div ref=\{ref\} data-barra-reproductor="" data-nivel=\{nivel\}/);
});

// Roturas (30/10/2026, base 3/0), cada una sola y restaurada con su copia, por con-turno:
// · B1 el umbral de la ancha baja a 440 → 2/1 (los niveles). Y en el banco, con ese umbral, la fila de 460 px vuelve a
//   «pisa Reproducir × Completa»: el número no es de gusto, sale de medir.
// · B2 las columnas vuelven a `1fr_auto_1fr` → 2/1 (la pantalla).
// · B3 la barra nunca compacta (`compacta = false`) → 2/1 (la pantalla).
// · B4 el tiempo compacto con horas siempre → 2/1 (el tiempo).
// · B5 el zoom sin el % en el tooltip → 2/1 (la pantalla).
