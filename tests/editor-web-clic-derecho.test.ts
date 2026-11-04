// =============================================================================
// El clic derecho en los chats embebidos y en el lienzo de Web Generator (24/10/2026, P5)
// =============================================================================
// Martín, 24/10: «en Automations o Web Generator, si le doy click derecho, no hace nada» y «en el lienzo de Web tambien
// debería funcionar el click derecho, como en otros editores». Plan en docs/diseno-editor-web-como-automations.md §5.
//   1. El menú de un mensaje (MensajeWA, `Deslizable`) se prende con `ContextoWA`, que sólo daban el Ops Center, el
//      teléfono y el Second Brain. Ahora HiloMako pone uno MÍNIMO si quien lo monta no trae el suyo: Copiar siempre, y
//      Responder cuando la pantalla sabe poner la cita en su caja (`onCitar`). La pieza es UNA (HiloMako): el chat del
//      editor, el de Automations, Offer y el onboarding lo heredan sin tocar nada.
//   2. En el editor, Responder pone la cita arriba de la caja del agente (la del Ops Center) y sale con lo escrito
//      (`armarConCita`).
//   3. En el lienzo, el clic derecho sobre una sección abre el MISMO menú del ⋮, en el punto del clic.
// Esto DIBUJA el hilo del editor en node (los .css, vacíos) y lee el código de lo que no se puede dibujar sin navegador.
// Correr: node --import tsx --test tests/editor-web-clic-derecho.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as modulo from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({
  load(url, ctx, next) {
    if (/\.css($|\?)/.test(url)) return { format: 'commonjs', source: '', shortCircuit: true };
    return next(url, ctx);
  },
});

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ITEMS = [
  { k: 'msg', id: 'u1', role: 'user', texto: 'Cambiá el título', at: '2026-10-24T10:00:00Z' },
  { k: 'msg', id: 'a1', role: 'assistant', texto: 'Listo, cambié el título.', at: '2026-10-24T10:00:05Z' },
] as const;

async function dibujarHilo(conAfuera: boolean): Promise<string> {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HiloAgente } = await import('../app/web-generator/editor/paneles/ChatAgente');
  const { ContextoWA } = await import('../app/admin/operaciones/MensajeWA');
  const hilo = createElement(HiloAgente, { items: ITEMS as never, corriendo: false, enMensaje: () => null, onCitar: () => {} });
  const afuera = { abrirMenu: () => {}, responder: () => {}, reaccionar: () => {} };
  return renderToStaticMarkup(conAfuera ? createElement(ContextoWA.Provider, { value: afuera as never }, hilo) : hilo);
}

test('el hilo del editor trae el menú de cada mensaje aunque la pantalla no tenga el suyo (el chat embebido)', async () => {
  const html = await dibujarHilo(false);
  const opciones = html.match(/aria-label="Opciones del mensaje"/g) ?? [];
  assert.equal(opciones.length, 2, 'cada mensaje (el de la persona y el de MaKo) con su ⌄ de opciones');
});

test('si quien monta el hilo ya trae su ContextoWA (el Ops Center, el teléfono), se usa el suyo, no el mínimo', async () => {
  const html = await dibujarHilo(true);
  assert.equal((html.match(/aria-label="Opciones del mensaje"/g) ?? []).length, 2);
  const src = sinComentarios(leer('app/_chat/HiloMako.tsx'));
  assert.match(src, /const deAfuera = useContext\(ContextoWA\);\s*if \(deAfuera\) return <CuerpoHilo \{\.\.\.p\} \/>;/);
});

test('el menú mínimo: Copiar siempre; Responder sólo si la pantalla sabe citar; con el dedo no se abre', () => {
  const src = sinComentarios(leer('app/_chat/HiloMako.tsx'));
  // Desde el 4/11/2026 (ticket #57) lleva además «Reportar» en lo de MaKo: tests/reportar-en-el-menu.test.ts.
  assert.match(src, /\.\.\.\(onCitar \? \[\{ id: 'responder', label: 'Responder', icono: 'cita' as const \}\] : \[\]\),\s*\{ id: 'copiar', label: 'Copiar', icono: 'copiar' as const \}/);
  assert.match(src, /abrirMenu: \(m, x, y, tactil\) => \{ if \(!tactil\) setAbierto\(\{ m, x, y \}\); \}/,
    'en Android el contextmenu que llega después cerraría el menú en el mismo gesto');
  // Copiar copia lo que se escribió, sin la cita de arriba.
  assert.match(src, /const t = leerCita\(m\.texto\)\?\.resto \?\? m\.texto;/);
});

test('Responder en el editor: la cita va arriba de la caja del agente y sale con lo escrito', () => {
  const chat = sinComentarios(leer('app/web-generator/editor/paneles/ChatAgente.tsx'));
  assert.match(chat, /enMensaje=\{enMensaje\} onCitar=\{onCitar\} \/>/, 'HiloAgente le pasa onCitar a HiloMako');
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.match(panel, /<HiloAgente items=\{nota\.conNotas\(items\)\} corriendo=\{hilo\.corriendo\} enMensaje=\{enMensaje\} onCitar=\{citar\}\s+onReintentar=\{nota\.reintentar\(\(\) => \{\}\)\} onDescartar=\{nota\.descartar\} \/>/);
  assert.match(panel, /arriba=\{cita \? <CitaAgente cita=\{cita\} onQuitar=\{\(\) => setCita\(null\)\} \/> : null\}/);
  assert.match(panel, /const conCita = armarConCita\(cita, texto\);/);
  assert.equal((panel.match(/pedir(Discusion|Edicion)\(ctxRef\.current, conCita,/g) ?? []).length, 2, 'en Editar y en Discutir');
  assert.match(panel, /setTexto\(''\);\s*setCita\(null\);/, 'la cita se va con el mensaje');
  // PanelAgente lo cargan tests en node: lo que trae .css (MensajeWA) entra por ChatAgente, dinámico.
  assert.doesNotMatch(panel, /from '@\/app\/admin\/operaciones\/MensajeWA'/);
});

test('el clic derecho sobre una sección abre el menú del ⋮ en el punto del clic', () => {
  const src = sinComentarios(leer('app/web-generator/editor/nodos/TarjetaVista.tsx'));
  assert.match(src, /seccion\.addEventListener\('contextmenu', alClicDerecho\);/);
  assert.match(src, /setPanel\(\{ tipo: 'menu', ancla: \{ x: e\.clientX, y: e\.clientY \} \}\);/);
  // Quedan con el menú del navegador: Shift, un bloque de adentro que ya lo atendió, y el texto elegido (copiar, corrector).
  assert.match(src, /if \(e\.shiftKey \|\| e\.defaultPrevented\) return;/);
  assert.match(src, /if \(sel && !sel\.isCollapsed && sel\.anchorNode && seccion\.contains\(sel\.anchorNode\)\) return;/);
  assert.match(src, /if \(!seccion \|\| !editable\) return;/, 'en la vista sin editar (presentar, publicada) no');
  // Lo que se abre desde el menú (estilo, notas, diseños) se ancla al ⋮ aunque el menú haya salido del clic derecho.
  assert.doesNotMatch(src, /asaRef\.current \?\? panel\.ancla/);
  assert.equal((src.match(/ancla: anclaSub\(\)/g) ?? []).length, 4);
  const piezas = sinComentarios(leer('app/web-generator/editor/extensiones/piezas.tsx'));
  assert.match(piezas, /ancla: HTMLElement \| \{ x: number; y: number \};/, 'Flotante acepta un punto');
  assert.match(piezas, /'contains' in ancla && ancla\.contains\(t\)/);
});
