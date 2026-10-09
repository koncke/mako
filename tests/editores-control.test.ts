// =============================================================================
// Los editores de control sin aire: el panel mide por TIPO y el selector es el protagonista
// =============================================================================
// Cuarta tanda, punto 1 (literal de Martín, 09/10/2026): «No me gusta que el editor del CRON como
// muchos otros tengan tanto espacio en blanco y un desplegable chico arriba del todo, mejora el
// diseño». Las capturas: DELAY y ACTION en un panel de ~720 × 420 con un renglón arriba y el resto
// vacío; la CONDITION igual.
//
// Lo que fija este test (el tamaño de cada tipo lo mide tests/lienzo-muelles.test.ts, ejecutando
// `editorDeTarjeta`):
//   1. el lienzo le da al panel el alto que le pasan, TAMBIÉN de columna, y el contenido scrollea
//      adentro (una caja cuyo alto es un tope salta al pasar de tarjeta: AGENTS.md);
//   2. el lienzo de /chatbot le pasa el tamaño del TIPO de la tarjeta abierta;
//   3. DELAY, TAG, ACTION y GO TO llevan el campo grande de la casa (48 de alto), de ancho completo;
//      MAKO llena el panel con el mensaje;
//   4. ningún editor de estos tiene un `maxWidth` propio que deje media caja vacía.
//
// Los tests que leen fuente normalizan \r\n y preguntan sobre el texto SIN comentarios (la casa
// explica en el comentario lo que se sacó, y un guard de «esto no está» se acusaría solo).
//
// PROBADO ROMPIÉNDOLO (09/10/2026): ver el pie.
//
// Correr: npx tsx --test tests/editores-control.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorEtiqueta } from '../app/chatbot/EditorEtiqueta';
import { ALTO_CAMPO_GRANDE, campoGrande, botonGrande } from '../app/_components/Lienzo';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

const LIENZO = sinComentarios(leer('app/_components/Lienzo.tsx'));
const FLUJO = sinComentarios(leer('app/chatbot/FlujoLienzo.tsx'));
const ETIQUETA = sinComentarios(leer('app/chatbot/EditorEtiqueta.tsx'));
const ACCION = sinComentarios(leer('app/_components/EditorAccionMako.tsx'));
const CAMPOS = sinComentarios(leer('app/_components/CamposAccion.tsx'));

test('⚠️ el panel toma el alto que le pasan, TAMBIÉN de columna, y el contenido scrollea adentro', () => {
  assert.match(LIENZO, /const altoFijo = Number\(panelAlto\) > 0;/);
  // De columna: con alto, el mismo molde que el apaisado (alto fijo, columna flex, sin desborde del panel).
  const columna = bloque(LIENZO, "maxWidth: `calc(100% - ${PANEL_MARGEN * 2 + insetIzq + insetDer}px)`,", 'padding: 14, borderRadius: 14', 700);
  assert.match(columna, /\.\.\.\(altoFijo\s*\? \{ height: panelAlto, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' \}\s*: \{ overflowY: 'auto' as const \}\)/);
  // El contenido estira y scrollea con `flex: 1` + `minHeight: 0` (nunca `height: 100%`, que Safari da 0).
  assert.match(LIENZO, /\{altoFijo\s*\? <div style=\{\{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' \}\}>\{renderEditor\(nodoSel\)\}<\/div>/);
  // Sin alto (el lienzo de /mensajes), el alto libre de siempre.
  assert.match(LIENZO, /: renderEditor\(nodoSel\)\}/);
});

test('⚠️ el lienzo de /chatbot le pasa el tamaño del TIPO de la tarjeta abierta, no el del editor de WhatsApp', () => {
  assert.match(FLUJO, /import \{ editorDeTarjeta, type Muelles \} from '@\/lib\/lienzo-grafo';/);
  assert.match(FLUJO, /const talla = editorDeTarjeta\(muelles, sel != null \? grafo\.nodos\.find\(\(n\) => n\.id === sel\)\?\.tipo : null\);/);
  assert.match(FLUJO, /panelAncho=\{talla\.ancho\}/);
  assert.match(FLUJO, /panelAlto=\{talla\.alto\}/);
  assert.doesNotMatch(FLUJO, /panelAlto=\{muelles\?\.editorAlto\}/, 'volvió el alto del editor de WhatsApp para todas las tarjetas');
});

test('el campo protagonista de la casa: 48 de alto y letra de 16, para el input y para el desplegable', () => {
  assert.equal(ALTO_CAMPO_GRANDE, 48);
  assert.equal(campoGrande.minHeight, ALTO_CAMPO_GRANDE);
  assert.equal(botonGrande.minHeight, ALTO_CAMPO_GRANDE);
  assert.equal(campoGrande.fontSize, 16);
  assert.equal(botonGrande.fontSize, 16);
});

test('⚠️ DELAY: «Esperar [n] [unidad]» como una frase grande, con las cuatro unidades y su `key` por tarjeta', () => {
  const ed = bloque(FLUJO, 'function EditorEspera(', '\n}\n', 4_200);
  assert.match(ed, /style=\{\{ \.\.\.campoGrande, width: 96, flex: 'none', textAlign: 'center' \}\}/, 'el número no va con el campo grande');
  assert.match(ed, /<Dropdown value=\{unidad\} width="100%" ariaLabel="Unidad" search=\{false\} disabled=\{busy\} buttonStyle=\{botonGrande\}/, 'la unidad no llena el renglón con el campo grande');
  assert.match(ed, /options=\{UNIDADES_ESPERA\.map\(\(u\) => \(\{ value: u, label: rotuloUnidad\(u, n\) \}\)\)\}/, 'no se ofrecen segundos, minutos, horas y días');
  assert.match(ed, /fontSize: 18, fontWeight: 700/, '«Esperar» es parte de la frase grande');
  // El dato: minutos con decimales (segundos / 60), y la unidad elegida se recuerda (sin saltar al tipear).
  assert.match(ed, /minutosDeSegundos\(Math\.max\(1, Math\.round\(cuanto\)\) \* SEGUNDOS_DE\[u\]\)/);
  assert.match(ed, /const unidad = unidadMostrada\(seg, preferida\);/);
  // La `key` por tarjeta: con la unidad sembrada en un estado, pasar a otro DELAY mostraría la de antes.
  assert.match(FLUJO, /case 'esperar': return <EditorEspera key=\{`espera-\$\{id\}`\} /);
  // Lo que ya estaba anclado a la reunión se sigue viendo y editando (cuarta tanda, punto 9).
  assert.match(ed, /\{ value: 'antes_reunion', label: 'antes de la reunión' \}/);
});

test('TAG: «[Poner ▾] [etiqueta ▾]» con el campo grande en los dos, y la etiqueta llena el renglón', () => {
  assert.match(ETIQUETA, /import \{ botonGrande \} from '@\/app\/_components\/Lienzo';/);
  assert.equal((ETIQUETA.match(/buttonStyle=\{botonGrande\}/g) ?? []).length, 2, 'los dos desplegables de la frase van grandes');
  assert.match(ETIQUETA, /<div style=\{\{ flex: '1 1 220px', minWidth: 0 \}\}>\s*<SelectorEtiqueta/);
  // Y se ve: el botón dibujado trae los 48 de alto.
  const html = renderToStaticMarkup(createElement(EditorEtiqueta, { operacion: 'poner_etiqueta_lead', etiquetaId: null, onChange: () => {} }));
  assert.ok((html.match(/min-height:48px/g) ?? []).length >= 2, 'la frase no salió con el campo grande');
});

test('ACTION: el desplegable «Elige una acción» de ancho completo y grande, y debajo los campos de la elegida', () => {
  const ini = ACCION.indexOf('<Dropdown\n          value={valor.operacion');
  assert.ok(ini > 0, 'no encontré el desplegable de la acción');
  const sel = ACCION.slice(ini, ACCION.indexOf('/>', ini));
  assert.match(sel, /placeholder="Elige una acción"/);
  assert.match(sel, /width="100%"/);
  assert.match(sel, /buttonStyle=\{botonGrande\}/);
  // Los campos de la acción elegida van debajo, con la `key` por operación.
  assert.ok(ACCION.indexOf('<FormularioAccion key={elegida.id}') > ini, 'los campos de la acción no van debajo del desplegable');
});

test('GO TO y MAKO: el destino grande; el mensaje llena el panel', () => {
  const ir = bloque(FLUJO, 'function EditorIrA(', '\n}\n', 2_400);
  // SEXTA TANDA (punto 12): GO TO ya no elige destino; el botón que lo pasa a flecha es el campo grande.
  assert.match(ir, /style=\{\{ \.\.\.botonGrande, width: '100%'/);
  const mako = bloque(FLUJO, 'function EditorMako(', '\n}\n', 3_200);
  assert.match(mako, /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 \}\}>/, 'el editor MAKO no llena el alto del panel');
  assert.match(mako, /style=\{\{ \.\.\.inpLienzo, flex: 1, minHeight: 96, resize: 'none'/, 'el mensaje no es el que estira');
});

test('⚠️ ningún editor de control deja media caja vacía con un `maxWidth` propio (AGENTS.md)', () => {
  // El único `maxWidth` del diseño vive en el CONTENEDOR (el panel del lienzo). La CONDITION es de la
  // parte «condiciones» (app/chatbot/EditorCondicion.tsx) y no se mira acá.
  for (const [nombre, src] of [['FlujoLienzo', FLUJO], ['EditorEtiqueta', ETIQUETA], ['EditorAccionMako', ACCION], ['CamposAccion', CAMPOS]] as const) {
    assert.doesNotMatch(src, /maxWidth/, `${nombre} tiene un maxWidth propio`);
  }
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Arnés en el scratchpad (romper.mjs): una rotura por vez, restaurada DE MEMORIA, corriendo este
// archivo junto con tests/espera-duracion.test.ts y tests/lienzo-muelles.test.ts. Base: 32 / 0.
// Pasan / fallan con cada una:
//   E9. el DELAY ofrece sólo horas y días                               → 31 / 1 (acá)
//   M1. `editorDeTarjeta` devuelve el tamaño del mensaje para todas     → 30 / 2 (lienzo-muelles)
//   M2. el DELAY con 420 de alto                                        → 31 / 1 (lienzo-muelles)
//   M3. el ancho de control sin topar contra el de mensaje (1366 con «Probar») → 31 / 1 (lienzo-muelles)
//   M4. el panel de columna sin alto fijo                               → 31 / 1 (acá)
//   M5. el lienzo de /chatbot pasa el alto de WhatsApp a todas          → 31 / 1 (acá)
//   M6. la etiqueta sin el campo grande                                 → 31 / 1 (acá)
//   M7. la acción sin ancho completo                                    → 31 / 1 (acá)
//   M8. el DELAY sin `key` por tarjeta                                  → 31 / 1 (acá)
//   M9. un `maxWidth: 320` en la frase del DELAY                        → 31 / 1 (acá)
