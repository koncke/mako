// =============================================================================
// Ticket #88 (12/11/2026): «La pantalla Web Generator se rompió» — React #419 en /web-generator?vista=plantillas&diseno=…
// =============================================================================
// La causa, en los logs de Vercel (11 veces entre 10:39 y 10:41 UTC, digest 2575089915): «ReferenceError: document is not
// defined» en el chunk de MiniaturaLanding. `?vista=plantillas&diseno=<id>` (el enlace de las plantillas de la portada) abre
// «¿De qué quieres crearla?» desde el PRIMER render (Inicio.tsx, `disenoInicial`), y `DialogoGamma` hacía
// `createPortal(…, document.body)` en el render del SERVIDOR. React pasaba esa parte a dibujarse en el cliente (#419), la
// pantalla se veía igual, y el reportador de errores abría un ticket por cada visita. Lo que fija:
//   1. el diálogo y el menú de Gamma se dibujan en node (sin `document`) sin tirar, y no dejan nada en el HTML del servidor;
//   2. el guardia es `useSyncExternalStore` (servidor e hidratación dan lo mismo: sin desajuste) y el portal va después de él.
// Correr: node --import tsx --test tests/web-generator-ticket-88.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DialogoGamma, MenuFlotante } from '../app/web-generator/MiniaturaLanding';

test('1. el diálogo y el menú de Gamma se dibujan en el servidor sin tirar (y sin nada en el HTML)', () => {
  assert.equal(typeof (globalThis as { document?: unknown }).document, 'undefined', 'esto corre como el servidor: sin document');
  // `children` en las props (no como tercer argumento): así lo pide el tipo de los dos (el tsc de la punta lo marcó).
  const dialogo = renderToString(createElement(DialogoGamma, { titulo: '¿De qué quieres crearla?', onCerrar: () => {}, children: 'Agenda una llamada' }));
  assert.equal(dialogo, '', 'el diálogo aparece en el render siguiente, en el navegador');
  const menu = renderToString(createElement(MenuFlotante, { ancla: null, onCerrar: () => {}, children: 'Renombrar' }));
  assert.equal(menu, '');
});

test('2. el guardia es useSyncExternalStore y cada portal va después de él', () => {
  const src = readFileSync(join(process.cwd(), 'app/web-generator/MiniaturaLanding.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /return useSyncExternalStore\(sinSuscripcion, \(\) => true, \(\) => false\);/);
  const portales = [...src.matchAll(/return createPortal\(/g)].map((m) => m.index ?? 0);
  assert.equal(portales.length, 2, 'el menú y el diálogo');
  for (const i of portales) {
    const antes = src.slice(Math.max(0, i - 200), i);
    assert.match(antes, /if \(!enNavegador\) return null;\s*$/, 'sin el guardia justo antes, el servidor llega a document.body');
  }
  // Abierto desde la hidratación, el menú se mide y el diálogo toma el foco cuando ya existe.
  assert.match(src, /\}, \[enNavegador, ancla, ancho, alinear\]\);/);
  assert.match(src, /if \(!visible \|\| !enNavegador\) return;[\s\S]{0,300}\}, \[visible, enNavegador\]\);/);
});
