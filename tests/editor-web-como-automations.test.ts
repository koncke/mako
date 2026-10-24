// =============================================================================
// El editor web como Automations: la tarjeta lista ↔ chat, UNA barra, el Panel sólo sin landings
// =============================================================================
// Pedidos de Martín (24/10/2026): «Hay 2 topbar de edición, debería haber solo 1», «2 veces el titulo, no tiene sentido»,
// «que sea el mismo sistema de "Automations" con el chat flotando y con la flecha para atras... que no me redirija», «Ese
// "panel" principal, solo sale si un usuario no ha creado nunca ninguna landing», «"Compartir y exportar" podrían ser el
// mismo botón» y «los botones se superponen». Plan: docs/diseno-editor-web-como-automations.md.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { landingMasReciente, landingsDeLaLista, RUTA_NUEVA_LANDING } from '../app/web-generator/panel-reglas';
import type { LandingResumen } from '../lib/editor-landing/api-tipos';

const leer = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const doc = (id: number, actualizado: string, extra: Partial<LandingResumen> = {}) =>
  ({ id, titulo: `L${id}`, tema: 't', creado: actualizado, actualizado, creadoPor: null, favorito: false, carpeta: null, papelera: false, slug: null, publicadoAt: null, ...extra }) as LandingResumen;

test('/web-generator abre la última landing tocada; sin ninguna (o todas en la papelera), el Panel', () => {
  assert.equal(landingMasReciente([doc(1, '2026-10-01'), doc(2, '2026-10-20'), doc(3, '2026-10-10')])?.id, 2);
  assert.equal(landingMasReciente([doc(1, '2026-10-01'), doc(2, '2026-10-20', { papelera: true })])?.id, 1, 'la papelera no se abre');
  assert.equal(landingMasReciente([doc(2, '2026-10-20', { papelera: true })]), null);
  assert.equal(landingMasReciente([]), null);
  const page = sinComentarios(leer('app/web-generator/page.tsx'));
  // Sólo sin nada en la URL (o el ?ws=) y con la lista leída: un error de lectura no salta, lo dice el Panel.
  assert.match(page, /if \(!errorLista && Object\.keys\(sp\)\.every\(\(k\) => k === 'ws'\)\) \{/);
  assert.match(page, /redirect\(await rutaConWs\(`\/web-generator\/\$\{ultima\.id\}`\)\)/);
});

test('la lista de la tarjeta: sin la papelera, la más tocada primero, y buscar filtra por título', () => {
  const docs = [doc(1, '2026-10-01', { titulo: 'Coaches' }), doc(2, '2026-10-20', { titulo: 'Inmobiliarias' }), doc(3, '2026-10-10', { titulo: 'Borrada', papelera: true })];
  assert.deepEqual(landingsDeLaLista(docs, '').map((d) => d.id), [2, 1]);
  assert.deepEqual(landingsDeLaLista(docs, 'coach').map((d) => d.id), [1]);
  assert.deepEqual(landingsDeLaLista(docs, 'borr'), []);
  // «Nueva landing» y «Ver todo en el Panel» van al Panel de verdad (sin ?panel=1, /web-generator saltaría a una landing).
  assert.equal(RUTA_NUEVA_LANDING, '/web-generator?panel=1');
});

test('la «←» del chat va a la LISTA de la tarjeta sin navegar, y la cabecera dice «MaKo», no el título', () => {
  const agente = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.match(agente, /titulo: 'MaKo', criatura: 'MaKo'/);
  assert.match(agente, /antes: <button type="button" className="gma-pb-iconbtn gma-ag-volver" onClick=\{\(\) => setPanelIzq\('landings'\)\}/);
  assert.doesNotMatch(agente, /antes: <Link href="\/web-generator"/, 'volvió la casa que navega al Panel');
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  assert.match(editor, /panelIzq === 'landings' \? \(\s*<section role="complementary" className="gma-izq" data-panel="landings"/);
});

test('UNA sola barra: el título, el guardado, Compartir, Publicar y el ⋯ viven en la de herramientas', () => {
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  // En el editor (fuera de la pantalla de error) ya no hay <header className="gma-barra">.
  assert.equal((editor.match(/<header className="gma-barra">/g) ?? []).length, 0, 'volvió la segunda barra');
  assert.doesNotMatch(editor, /gma-avatar/, 'el avatar está en la barra lateral de la app');
  const barra = editor.slice(editor.indexOf('className="gma-herramientas"'), editor.indexOf('className="gma-area"'));
  for (const pieza of ['className="gma-titulo"', '<IndicadorGuardado', "setDialogo('compartir')", "setDialogo('publicar')", 'aria-label="Menú del documento"']) {
    assert.ok(barra.includes(pieza), `la barra única tiene que llevar ${pieza}`);
  }
  // Compartir lleva Exportar adentro.
  assert.match(sinComentarios(leer('app/web-generator/editor/dialogos/DialogoCompartir.tsx')), /onClick=\{\(\) => setDialogo\('exportar'\)\}/);
});

test('la columna del bloque no tapa sus propios botones: tooltip de la casa a la derecha, sin title nativo', () => {
  const t = sinComentarios(leer('app/web-generator/editor/nodos/TarjetaVista.tsx'));
  assert.doesNotMatch(t, /title=\{`Opciones · arrastra/, 'el title nativo sale abajo del cursor y tapa la columna');
  assert.doesNotMatch(t, /title="Ask Agent"/);
  assert.match(t, /className="gmc-btn gmc-tip"\s*data-asa=""\s*data-tip=\{`Opciones · arrastra/);
  const css = leer('app/web-generator/editor/extensiones/estilos-nodos.ts');
  assert.match(css, /\.gmc-tip::before \{ content: attr\(data-tip\); position: absolute; left: calc\(100% \+ 6px\)/);
});
