// =============================================================================
// El Video Editor con el chat de MaKo FIJO a la izquierda, los proyectos en la misma tarjeta y SIN cambiar de ruta
// =============================================================================
// Martín, 27/10/2026, textual: «veas de adaptar las tabs de video e imagen con el chat que tenemos de MaKo, para que se
// pueda editar con prompting, algo similar a lo que hicimos con Web Generator, que este al costado, que los "proyectos"
// se vean en la barra del costado, y que no cambie de ruta... Tambien ponle los colores de MaKo a esas tabs».
// Lo que fija este archivo (el marco: app/video-editor/_opencut/marco.tsx):
//   1-3. lo puro de app/video-editor/proyectos.ts, EJECUTADO: la URL que queda sin navegar, la lista y el último;
//   4. la tarjeta del chat va a la IZQUIERDA del editor, mide lo del Web Generator, y es el chat o la lista;
//   5. el chat está SIEMPRE abierto: arranca abierto y no hay con qué cerrarlo;
//   6. cambiar de proyecto NO navega: `history.replaceState`, y ninguna pieza del camino hace `router.push`/`<Link`;
//   7. abrir otro guarda ANTES lo pendiente del abierto, y el editor no se re-monta por proyecto;
//   8. la lista se carga ANTES de abrir un proyecto, y `/video-editor` abre el último;
//   9. el teléfono: la tarjeta a todo el ancho y el proyecto cargado detrás para el chat;
//   10-11. los colores de MaKo: el `.ce-mako`, sin ciclos entre los tokens de CapCut y los de la app, lo que lee un
//          canvas sin `color-mix`, `dark:` sólo con MaKo en oscuro y sin el oscuro forzado.
//
// PROBADO ROMPIÉNDOLO (27/10/2026, base 11/0; cada rotura restaurada de memoria y vuelta a 11/0):
//   R1  urlDelProyecto conserva el `?propuesta=`                                   → 10/1 (1)
//   R2  la lista ordena por nombre en vez de por el último tocado                  → 9/2 (2 y 3: el «último» sale de ahí)
//   R3  la tarjeta DESPUÉS del editor (el chat a la derecha)                       → 10/1 (4)
//   R4  `abierto: false` en chat/estado.ts (el chat arranca cerrado)               → 10/1 (5)
//   R5  PanelProyectos abre con `router.push(rutaEditor(...))`                     → 10/1 (6)
//   R6  `setIdAbierto(id)` ANTES de `await guardarAhora()`                         → 10/1 (7)
//   R7  la condición INVERTIDA: `if (editor.project.getIsInitialized())` carga     → 10/1 (8)
//   R8  `--primary: inherit` borrado del `.ce-mako` (ciclo con --cc-accent)        → 10/1 (10)
//   R9  `--cc-ruler` como `color-mix(...)`                                         → 10/1 (10)
//   R10 `dark:` atado otra vez a todo `.ce`                                        → 10/1 (11)
//   R11 EditorPage sin `soloCarga` (en el teléfono el chat no tiene proyecto)      → 10/1 (9)
//   R12 el hook tira sin el marco (rompía el editor del teléfono, que usa el provider) → 10/1 (6)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { proyectosDeLaLista, rutaProyecto, ultimoProyecto, urlDelProyecto } from '../app/video-editor/proyectos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md, «Un test que no probaste ROMPIÉNDOLO»); y los `{/* */}` de JSX.
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const VE = 'app/video-editor';
const MARCO = sinComentarios(leer(`${VE}/_opencut/marco.tsx`));
const CSS = leer(`${VE}/capcut-theme.css`);
const CSS_VIVO = sinComentarios(CSS);

/** El bloque de una regla CSS por su selector EXACTO (hasta su llave de cierre). */
function reglaCss(src: string, selector: string): string {
  const i = src.indexOf(`\n${selector} {`);
  assert.ok(i >= 0, `no encontré la regla «${selector}»`);
  return src.slice(i, src.indexOf('\n}', i));
}

/** El cuerpo de un `const nombre = useCallback(` hasta el próximo `const ` de su nivel. */
function callback(src: string, nombre: string): string {
  const i = src.indexOf(`const ${nombre} = useCallback(`);
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const fin = src.indexOf('\n\tconst ', i + 10);
  return src.slice(i, fin < 0 ? undefined : fin);
}

// ── 1-3. Lo puro, ejecutado ───────────────────────────────────────────────────────────────────────────────────────

test('1. la URL que queda al abrir sin navegar: la ruta del proyecto con el ?ws= y NADA más', () => {
  assert.equal(urlDelProyecto('abc-1', '?ws=3&propuesta=0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f'), '/video-editor/abc-1?ws=3');
  assert.equal(urlDelProyecto('abc-1', '?desde=montaje%3A12&plantilla=testimonio'), '/video-editor/abc-1');
  assert.equal(urlDelProyecto(null, '?ws=7'), '/video-editor?ws=7', 'sin proyecto, la ruta de la tab con su ?ws=');
  assert.equal(urlDelProyecto('abc-1', ''), '/video-editor/abc-1');
  assert.equal(rutaProyecto('a b'), '/video-editor/a%20b', 'un id raro no rompe la ruta');
});

const P = (id: string, name: string, updatedAt: Date | string | number) => ({ id, name, updatedAt });

test('2. la lista de la tarjeta: el último que se tocó primero, y se busca sin mayúsculas ni acentos', () => {
  const lista = [P('a', 'Anuncio', new Date('2026-10-20')), P('b', 'Promoción otoño', '2026-10-26T10:00:00Z'), P('c', 'Zeta', Date.parse('2026-10-25'))];
  assert.deepEqual(proyectosDeLaLista(lista, '').map((p) => p.id), ['b', 'c', 'a']);
  assert.deepEqual(proyectosDeLaLista(lista, '  PROMOCION ').map((p) => p.id), ['b']);
  assert.deepEqual(proyectosDeLaLista(lista, 'nada'), []);
  assert.deepEqual(lista.map((p) => p.id), ['a', 'b', 'c'], 'no ordena la lista del motor en el lugar');
});

test('3. `/video-editor` abre el último que se tocó; sin ninguno, nada (y el editor muestra «Crear proyecto»)', () => {
  assert.equal(ultimoProyecto([]), null);
  assert.equal(ultimoProyecto([P('a', 'A', '2026-10-01'), P('b', 'B', 'no es fecha'), P('c', 'C', '2026-10-27')])?.id, 'c');
});

// ── 4-9. La estructura ────────────────────────────────────────────────────────────────────────────────────────────

test('4. la tarjeta de MaKo va a la IZQUIERDA del editor, mide lo del Web Generator, y es el chat o la lista', () => {
  const tarjeta = MARCO.indexOf('<section role="complementary" className="ce-izq"');
  const editor = MARCO.indexOf('<div className="ce-der">');
  assert.ok(tarjeta > 0 && editor > tarjeta, 'el chat va a la izquierda, antes del editor (como `.gma-izq`)');
  assert.match(MARCO.slice(tarjeta, editor), /\{enChat \? \(\s*<PanelChat[\s\S]*?\) : \(\s*<PanelProyectos \/>\s*\)\}/, 'la misma tarjeta: el chat o la lista');
  const izq = reglaCss(CSS_VIVO, '.ce-izq');
  assert.match(izq, /width: 340px;/, 'mide 340, como la del Web Generator y la del Image Editor');
  assert.match(izq, /margin: 8px 0 8px 8px;/);
  assert.match(izq, /border-radius: 12px;/);
  // Y el editor estira con flex (Safari da cero con `height: 100%`, AGENTS.md).
  assert.match(reglaCss(CSS_VIVO, '.ce-der'), /flex: 1;\s*min-width: 0;\s*min-height: 0;/);
  assert.match(sinComentarios(leer(`${VE}/VideoEditorCliente.tsx`)), /<MarcoEditor proyectoId=\{proyectoDeRuta\} propuesta=\{propuesta\} \/>/, 'las dos rutas montan el marco');
});

test('5. el chat está SIEMPRE abierto: arranca abierto y nada lo cierra', () => {
  assert.match(sinComentarios(leer(`${VE}/_opencut/chat/estado.ts`)), /\babierto: true,/, 'arranca en el chat');
  const panel = sinComentarios(leer(`${VE}/_opencut/chat/PanelChat.tsx`));
  assert.doesNotMatch(panel, /onCerrar|Cerrar el panel/, 'el chat ya no tiene con qué cerrarse');
  const cabecera = sinComentarios(leer(`${VE}/_opencut/components/editor/editor-header.tsx`));
  assert.doesNotMatch(cabecera, /BotonChat|setAbierto\(!abierto\)/, 'volvió «Editar con IA», que abría y cerraba el chat');
});

/** Las piezas del camino de abrir, crear y volver al inicio. */
const CAMINO = [
  `${VE}/_opencut/marco.tsx`,
  `${VE}/_opencut/inicio/PanelProyectos.tsx`,
  `${VE}/_opencut/inicio/projects-page.tsx`,
  `${VE}/_opencut/components/editor/editor-header.tsx`,
  `${VE}/_opencut/components/editor/mobile-gate.tsx`,
  `${VE}/_opencut/components/providers/editor-provider.tsx`,
  `${VE}/_opencut/actions/use-editor-actions.ts`,
];

test('6. cambiar de proyecto NO navega: la URL se acompaña con history.replaceState', () => {
  const efecto = MARCO.slice(MARCO.indexOf('useEffect(() => {\n\t\tif (idAbierto === undefined) return;'), MARCO.indexOf('}, [idAbierto]);'));
  assert.ok(efecto.length > 40, 'no encontré el efecto que acompaña la URL');
  assert.match(efecto, /if \(window\.location\.pathname === rutaProyecto\(idAbierto\)\) return;/, 'la URL de entrada conserva su ?propuesta=');
  assert.match(efecto, /window\.history\.replaceState\(null, "", urlDelProyecto\(idAbierto, window\.location\.search\)\);/);
  const navegan: string[] = [];
  for (const f of CAMINO) {
    const s = sinComentarios(leer(f));
    for (const re of [/\brouter\.(push|replace)\(/, /\buseRouter\b/, /<Link\b/, /window\.location\.(href|assign|replace)\b/]) {
      if (re.test(s)) navegan.push(`${f}: ${re}`);
    }
  }
  assert.deepEqual(navegan, [], 'estas piezas navegan para cambiar de proyecto (el marco se desmonta y la tarjeta parpadea)');
  // Se lo piden al marco, que envuelve todo; y sin marco (el editor del TELÉFONO monta el EditorProvider solo) el hook
  // no tira: navega como antes. Tiraba, y rompía el editor del teléfono.
  assert.match(MARCO, /<ProveedorProyectoAbierto value=\{valor\}>/);
  const hook = sinComentarios(leer(`${VE}/_opencut/inicio/proyecto-abierto.tsx`));
  assert.match(hook, /return c \?\? sinMarco;/);
  assert.doesNotMatch(hook, /\bthrow\b/);
});

test('7. abrir otro guarda ANTES lo pendiente, y el editor se queda montado (el provider recarga por projectId)', () => {
  const abrir = callback(MARCO, 'abrir');
  const guarda = abrir.indexOf('await guardarAhora();');
  const cambia = abrir.indexOf('setIdAbierto(id);');
  assert.ok(guarda > 0 && cambia > guarda, 'se cambia de proyecto sin guardar lo pendiente del abierto');
  const crear = callback(MARCO, 'crear');
  const guardaAlCrear = crear.indexOf('await guardarAhora();');
  assert.ok(guardaAlCrear > 0 && guardaAlCrear < crear.indexOf('createNewProject('), 'crear también guarda antes');
  const guardar = callback(MARCO, 'guardarAhora');
  assert.match(guardar, /await editor\.project\.prepareExit\(\);/, 'la miniatura (lo que hacía la salida)');
  assert.match(guardar, /if \(editor\.save\.getIsDirty\(\)\) await editor\.save\.flush\(\)/, 'lo que quedaba por guardar');
  assert.doesNotMatch(MARCO, /<EditorPage\s[^>]*\bkey=/, 'con `key` el editor se re-monta y su «al salir» le pone la miniatura del viejo al nuevo');
  assert.match(MARCO, /<EditorPage\s+projectId=\{abierto\}/);
  assert.match(sinComentarios(leer(`${VE}/_opencut/components/providers/editor-provider.tsx`)), /\}, \[projectId, propuesta\]\);/, 'el provider recarga cuando cambia el proyecto');
});

test('8. la lista se carga ANTES de abrir un proyecto, y `/video-editor` abre el último', () => {
  assert.match(MARCO, /if \(!editor\.project\.getIsInitialized\(\)\) void editor\.project\.loadAllProjects\(\);/);
  // El editor (y su EditorProvider, que abre el proyecto) recién cuando la lista está.
  const der = MARCO.slice(MARCO.indexOf('<div className="ce-der">'));
  assert.match(der, /^<div className="ce-der">\s*\{!listos \|\| idAbierto === undefined \? \(/, 'el editor no espera a la lista: cargarla después frena el guardado');
  assert.match(MARCO, /if \(idAbierto === undefined && listos\) \{\s*setIdAbierto\(ultimoProyecto\(editor\.project\.getSavedProjects\(\)\)\?\.id \?\? null\);/);
  // El inicio (crear y todos los proyectos) va EN LUGAR del editor, sin navegar, como «¿Qué vas a crear hoy?».
  assert.match(MARCO, /const inicio = idAbierto === null \|\| \(nueva && !enChat\);/);
  assert.match(der, /\) : inicio \|\| !abierto \? \(\s*<ProjectsPage \/>/);
});

test('9. el teléfono: la tarjeta a todo el ancho y el proyecto cargado detrás (sin dibujar el editor) para el chat', () => {
  assert.match(MARCO, /const ANGOSTA = "\(max-width: 767px\)";/);
  assert.match(CSS_VIVO, /@media \(max-width: 767px\) \{\s*\.ce-marco \{\s*flex-direction: column;/, 'el mismo corte en el CSS');
  assert.match(MARCO, /soloCarga=\{angosta && movil === "chat"\}/);
  const pagina = sinComentarios(leer(`${VE}/_opencut/editor-page.tsx`));
  const provider = pagina.indexOf('<EditorProvider projectId={projectId} propuesta={propuesta}>');
  const solo = pagina.indexOf('{soloCarga ? null : (');
  const aviso = pagina.indexOf('<MobileGate onAtras={onAtras}>');
  assert.ok(provider > 0 && solo > provider && aviso > solo, 'el proyecto se carga AFUERA del aviso de pantalla chica');
});

// ── 10-11. Los colores de MaKo ────────────────────────────────────────────────────────────────────────────────────

/** Las declaraciones `--x: valor;` de un bloque. */
const declaraciones = (bloque: string) => new Map([...bloque.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));

test('10. `.ce-mako` saca los colores de la app, sin ciclos con los de CapCut, y lo que lee un canvas es un var() liso', () => {
  const capcut = declaraciones(reglaCss(CSS_VIVO, '.ce'));
  const mako = declaraciones(reglaCss(CSS_VIVO, '.ce.ce-mako'));
  assert.equal(mako.get('--cc-accent'), 'var(--primary)', 'el azul de acción de MaKo en lugar del cian');
  assert.equal(mako.get('--cc-text'), 'var(--ink)');
  assert.equal(mako.get('--cc-panel'), 'var(--surface)');
  // En el elemento `.ce.ce-mako` valen las dos reglas (la de MaKo gana): un nombre que el `.ce` de CapCut pisa y el de
  // MaKo lee tiene que volver a la app con `inherit`. Si no, dos declaraciones se citan entre sí en el MISMO elemento y
  // las dos quedan INVÁLIDAS: transparente, sin un error. Se buscan los ciclos en el grafo de `var()` de lo que vale ahí.
  const efectivo = new Map([...capcut, ...mako]);
  const lee = (v: string) => [...v.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
  const ciclos = new Set<string>();
  const visitar = (inicio: string, n: string, camino: string[]): void => {
    if (camino.includes(n)) {
      if (n === inicio) ciclos.add([...camino, n].join(' → '));
      return;
    }
    const v = efectivo.get(n);
    if (!v || v === 'inherit') return;
    for (const r of lee(v)) visitar(inicio, r, [...camino, n]);
  };
  for (const n of efectivo.keys()) visitar(n, n, []);
  assert.deepEqual([...ciclos], [], 'tokens en ciclo (inválidos en silencio)');
  for (const n of ['--primary', '--border', '--surface', '--ink', '--bg', '--on-primary']) assert.equal(mako.get(n), 'inherit', `${n} no vuelve al valor de la app`);
  // guides/reglas.tsx las lee con getComputedStyle y las pasa a un canvas: un `color-mix()` ahí se ignora en silencio.
  for (const n of ['--cc-sunken', '--cc-panel', '--cc-line-2', '--cc-ruler', '--cc-text-3']) {
    assert.match(mako.get(n) ?? '', /^var\(--[a-z0-9-]+\)$/, `${n} lo lee un canvas: tiene que ser un var() liso`);
  }
  assert.match(sinComentarios(leer(`${VE}/VideoEditorCliente.tsx`)), /className="ce ce-mako"/, 'la tab del escritorio lleva los colores de MaKo');
});

test('11. `dark:` sólo con MaKo en oscuro, y la tab ya no fuerza el oscuro de CapCut', () => {
  const variante = /@custom-variant dark \((.+)\);/.exec(CSS_VIVO)?.[1] ?? '';
  assert.ok(variante.includes('[data-tema="oscuro"] .ce-mako'), '`dark:` no se prende con MaKo en oscuro');
  assert.ok(!/(^|[(,]\s*)\.ce(,|\s\*)/.test(variante), '`dark:` volvió a atarse a TODO `.ce`: el editor claro sale con las clases de oscuro');
  assert.ok(variante.includes('.ce:not(.ce-mako)'), 'el editor del teléfono (CapCut oscuro) perdió `dark:`');
  for (const f of [`${VE}/VideoEditorCliente.tsx`, `${VE}/page.tsx`, `${VE}/[proyecto]/page.tsx`]) {
    assert.doesNotMatch(sinComentarios(leer(f)), /<TemaOscuro(Script)?\b/, `${f}: fuerza el oscuro (la tab sigue el claro u oscuro de la persona)`);
  }
});
