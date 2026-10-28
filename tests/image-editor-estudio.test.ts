// =============================================================================
// El estudio del Image Editor: tus diseños en la tarjeta de la izquierda, sin cambiar de ruta, con los colores de la app
// =============================================================================
// Martín, 27/10/2026, textual: «veas de adaptar las tabs de video e imagen con el chat que tenemos de MaKo, para que se
// pueda editar con prompting, algo similar a lo que hicimos con Web Generator, que este al costado, que los "proyectos" se
// vean en la barra del costado, y que no cambie de ruta... Tambien ponle los colores de MaKo a esas tabs».
//
// Lo que fija, y que se rompe sin un solo error:
//   1. LA URL QUE SE ESCRIBE (`rutaEnLugar`): cambia el diseño y conserva el `?ws=` (sin él, el super admin termina en
//      OTRA cuenta) y el resto de la URL actual, también en una carpeta que no es la de escritorio.
//   2. QUÉ SE ABRE AL ENTRAR a /image-editor sola: el último editado; sin ninguno, la vista de crear.
//   3. LA LISTA EN LA TARJETA: buscar, «Nuevo diseño» primero, los diseños, la estrella que vuelve al chat y «Ver todo»;
//      la «←» de la cabecera del chat la trae. Y nada de eso navega.
//   4. ABRIR Y CREAR NO NAVEGAN: el estudio guarda, monta el otro y escribe la URL con `history.replaceState`; ni la
//      lista, ni «Proyectos», ni la vista de crear, ni una copia hacen `router.push` a otro diseño.
//   5. LOS COLORES SON LOS DE LA APP: tokens.css no escribe un color de cromo a mano (claro y oscuro salen solos), la
//      tarjeta del chat no redefine los tokens de la app, y el lienzo lee la marca de `.cv`.
//
// Correr: node --import tsx --test tests/image-editor-estudio.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ResumenDiseno } from '../lib/image-editor/tipos';
import { rutaEnLugar } from '../app/image-editor/ruta';
import { disenoAlEntrar, disenosDeLaLista } from '../app/image-editor/editor/estudio-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios (AGENTS.md: un guard de «esto NO está» se pregunta sobre el texto sin la prosa que lo explica). */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (r: string) => sinComentarios(leer(r));

/** El cuerpo de una función o un bloque: desde `desde` hasta la llave que lo cierra. */
function bloque(src: string, desde: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const abre = src.indexOf('{', i + desde.length - 1);
  let n = 0;
  for (let j = abre; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}' && --n === 0) return src.slice(i, j + 1);
  }
  throw new Error(`«${desde}» no cierra`);
}

const diseno = (id: string, titulo: string, actualizado: string): ResumenDiseno =>
  ({ id, titulo, ancho: 1080, alto: 1080, paginas: 1, miniatura: null, creado: actualizado, actualizado });

// ─────────────────────────────────────────────────────────────────────────────
// 1. La URL que se escribe
// ─────────────────────────────────────────────────────────────────────────────

test('1: la URL cambia el diseño y conserva el ?ws= y lo demás de la URL actual', () => {
  assert.equal(rutaEnLugar('https://hola-mako.com/image-editor?ws=7', 'abc'), '/image-editor/abc?ws=7', 'desde la tab sola');
  assert.equal(rutaEnLugar('https://hola-mako.com/image-editor/viejo?ws=7#x', 'nuevo'), '/image-editor/nuevo?ws=7#x', 'de un diseño a otro');
  assert.equal(rutaEnLugar('https://hola-mako.com/image-editor/viejo/', 'nuevo'), '/image-editor/nuevo');
  assert.equal(rutaEnLugar('https://hola-mako.com/m/image-editor/viejo?ws=2', 'nuevo'), '/m/image-editor/nuevo?ws=2', 'la carpeta se respeta');
  assert.equal(rutaEnLugar('https://hola-mako.com/image-editor/viejo?ws=7', null), '/image-editor?ws=7', 'sin diseño, la tab');
  assert.equal(rutaEnLugar('/image-editor', 'a b/c'), '/image-editor/a%20b%2Fc', 'el id va codificado');
  assert.equal(rutaEnLugar('https://hola-mako.com/image-editor/viejo?ws=7&propuesta=p1', 'nuevo'), '/image-editor/nuevo?ws=7', 'la propuesta del link es del diseño de antes');
  const ruta = codigo('app/image-editor/ruta.ts');
  assert.match(bloque(ruta, 'export function marcarEnUrl('), /window\.history\.replaceState\(null, '', destino\)/, 'se escribe con replaceState, sin navegar');
  assert.match(bloque(ruta, 'export function marcarEnUrl('), /rutaEnLugar\(window\.location\.href, id\)/, 'y se parte de la URL ACTUAL');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Qué se abre al entrar, y el filtro de la lista
// ─────────────────────────────────────────────────────────────────────────────

test('2: /image-editor sola abre el último editado; sin diseños, la vista de crear', () => {
  const lista = [
    diseno('viejo', 'Viejo', '2026-10-20T10:00:00Z'),
    diseno('ultimo', 'Último', '2026-10-27T09:00:00Z'),
    diseno('medio', 'Medio', '2026-10-25T09:00:00Z'),
  ];
  assert.equal(disenoAlEntrar(lista), 'ultimo');
  assert.equal(disenoAlEntrar([]), null);
  const estudio = codigo('app/image-editor/editor/Estudio.tsx');
  const entrar = estudio.slice(estudio.indexOf('if (!buscando) return;'), estudio.indexOf('}, [buscando, ws]);'));
  assert.match(entrar, /const id = r\.ok \? disenoAlEntrar\(r\.disenos\) : null;/);
  assert.match(entrar, /if \(id\) \{\s*setAbierto\(id\);\s*marcarEnUrl\(id\);\s*\} else \{\s*[\s\S]*?setCreando\(true\);/, 'con uno, se abre y se escribe; sin ninguno, crear');
  // La página sola ya no es un inicio aparte: monta el estudio, igual que la del diseño.
  const pagina = codigo('app/image-editor/page.tsx');
  assert.doesNotMatch(pagina, /vista="inicio"/);
  assert.match(pagina, /<ImageEditorCliente ws=\{ws\} senales=\{senales\} \/>/);
  assert.match(codigo('app/image-editor/ImageEditorCliente.tsx'), /<Estudio disenoId=\{disenoId \?\? null\} ws=\{ws\} senales=\{senales\} \/>/);
});

test('2b: la lista de la tarjeta busca sin tildes ni mayúsculas', () => {
  const lista = [diseno('a', 'Promoción de otoño', '2026-10-27T09:00:00Z'), diseno('b', 'Logo', '2026-10-26T09:00:00Z'), diseno('c', '', '2026-10-25T09:00:00Z')];
  assert.deepEqual(disenosDeLaLista(lista, 'PROMOCION').map((d) => d.id), ['a']);
  assert.deepEqual(disenosDeLaLista(lista, '  ').map((d) => d.id), ['a', 'b', 'c'], 'sin búsqueda, todos');
  assert.deepEqual(disenosDeLaLista(lista, 'sin titulo').map((d) => d.id), ['c'], 'el sin título se encuentra como se ve');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. La lista de diseños en la tarjeta (copiada de la de landings del Web Generator)
// ─────────────────────────────────────────────────────────────────────────────

test('3: la tarjeta tiene tus diseños: buscar, «Nuevo diseño» primero, los diseños, la estrella y «Ver todo»', () => {
  const lista = codigo('app/image-editor/mako/ListaDisenos.tsx');
  const vista = lista.slice(lista.indexOf('return (\n    <div className={styles.lista}'));
  const orden = ['aria-label="Buscar un diseño"', 'onClick={estudio.verChat}', '<span className={styles.nombre}>Nuevo diseño</span>', 'visibles.map((d) =>', 'Ver todo</button>'];
  let desde = 0;
  for (const pieza of orden) {
    const i = vista.indexOf(pieza, desde);
    assert.ok(i >= 0, `falta (o está fuera de orden) ${pieza}`);
    desde = i;
  }
  assert.match(vista, /onClick=\{\(\) => estudio\.nuevo\(\)\}/, '«Nuevo diseño» muestra la vista de crear');
  assert.match(vista, /onClick=\{\(\) => \(actual \? estudio\.verChat\(\) : estudio\.abrir\(d\.id\)\)\}/, 'un renglón abre ESE diseño; el abierto vuelve al chat');
  assert.match(vista, /onClick=\{\(\) => estudio\.nuevo\('disenos'\)\}>Ver todo/, '«Ver todo» abre «Mis diseños»');
  assert.match(lista, /const actual = !creando && d\.id === abierto;/);
  // La «←» de la cabecera del chat trae la lista a la MISMA tarjeta; la tarjeta elige.
  const chat = codigo('app/image-editor/mako/chat/PanelMakoIA.tsx');
  assert.match(chat, /antes: estudio \? \(\s*<button [^>]*onClick=\{estudio\.verDisenos\}[^>]*>←<\/button>/, 'la «←» en la cabecera, como el `antes:` del Web Generator');
  const tarjeta = codigo('app/image-editor/editor/TarjetaLateral.tsx');
  assert.match(tarjeta, /if \(estudio\?\.tarjeta === 'disenos'\) return <ListaDisenos \/>;\s*return <PanelMakoIA \/>;/);
  // Fija a la izquierda en la computadora y en la hoja de la tira en el teléfono: la misma tarjeta.
  assert.match(codigo('app/image-editor/editor/PantallaEditor.tsx'), /chatLateral=\{<TarjetaLateral \/>\}/);
  assert.match(codigo('app/image-editor/mako/registro.ts'), /component: TarjetaLateral,/);
  // Sin diseño montado (crear, «Abriendo…»), la misma tarjeta con la lista, en el mismo armazón.
  assert.match(codigo('app/image-editor/editor/Marco.tsx'), /<section className=\{`\$\{armazon\.chat\} \$\{styles\.tarjeta\}`\}[^>]*>\s*<ListaDisenos \/>/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Abrir y crear no navegan
// ─────────────────────────────────────────────────────────────────────────────

const NAVEGA = /router\.(push|replace)\(|window\.location\.(href\s*=|assign|replace)|<Link\b|\bhref=/;

test('4: abrir otro diseño guarda, lo monta en el lugar y escribe la URL (sin navegar)', () => {
  const estudio = codigo('app/image-editor/editor/Estudio.tsx');
  assert.doesNotMatch(estudio, NAVEGA, 'el estudio no navega');
  const abrir = bloque(estudio, 'const abrir = useCallback((id: string) =>');
  assert.match(abrir, /void guardarActual\(\)\.then\(\(\) => \{\s*setAbierto\(id\);[\s\S]*?marcarEnUrl\(id\);\s*\}\);/, 'primero guarda; después monta y escribe la URL');
  assert.match(bloque(estudio, 'const guardarActual = useCallback(async () =>'), /if \(!editor\?\.isDirty\(\)\) return;\s*try \{\s*await editor\.saveNow\(\);/);
  // Un diseño = un editor: se REMONTA por id (el guardado en vuelo termina con el adaptador del diseño de antes).
  assert.match(estudio, /<PantallaEditor key=\{abierto\} disenoId=\{abierto\} /);
  // «Nuevo diseño»: la vista de crear ENCIMA del editor, que queda montado, oculto e `inert`.
  assert.match(estudio, /<div className=\{styles\.capa\} inert=\{creando\}/);
  assert.match(bloque(estudio, 'const nuevo = useCallback('), /setCreando\(true\);/);
  assert.doesNotMatch(bloque(estudio, 'const nuevo = useCallback('), /setAbierto/, 'crear no desmonta el diseño abierto');

  // Lo que abre o crea un diseño adentro del estudio avisa, no navega.
  for (const f of ['app/image-editor/mako/ListaDisenos.tsx', 'app/image-editor/editor/TarjetaLateral.tsx', 'app/image-editor/editor/Marco.tsx']) {
    assert.doesNotMatch(codigo(f), NAVEGA, `${f} navega`);
  }
  const inicio = codigo('app/image-editor/inicio/Inicio.tsx');
  assert.match(inicio, /if \(onCreado\) onCreado\(r\.id\);\s*else router\.push\(rutaDiseno\(r\.id\)\);/, 'crear abre en el lugar (navega sólo montada sola)');
  assert.match(inicio, /const abrir = \(d: FilaLista\) => \(onAbrir \? onAbrir\(d\.id\) : router\.push\(rutaDiseno\(d\.id\)\)\);/);
  assert.match(estudio, /onAbrir=\{abrir\}\s*onCreado=\{abrir\}/, 'el estudio le pasa los dos avisos');
  const pantalla = codigo('app/image-editor/editor/PantallaEditor.tsx');
  assert.match(pantalla, /irA\.current = \(id: string\) => \(estudio \? estudio\.abrir\(id\) : router\.push\(rutaDiseno\(id\)\)\);/);
  assert.match(bloque(pantalla, 'duplicar: async ({ title, document }) =>'), /irA\.current\(r\.id\);/, '«Copiar y redimensionar» abre la copia en el lugar');
  assert.match(bloque(pantalla, 'async function resolverConflicto('), /if \(r\.ok\) irA\.current\(r\.id\);/, '«Guardar una copia» también');
  assert.doesNotMatch(bloque(pantalla, 'async function resolverConflicto('), /window\.location\.href\s*=/);
  assert.match(pantalla, /run: \(\) => nuevo\.current\(\)/, '«Archivo → Crear un diseño nuevo» muestra la vista de crear');
  assert.doesNotMatch(pantalla, /<Link\b/, '«Inicio» de la barra es un botón, no un link a otra ruta');
  const proyectos = codigo('app/image-editor/mako/ProyectosPanel.tsx');
  assert.match(bloque(proyectos, 'async function abrir('), /if \(estudio\) \{\s*estudio\.abrir\(id\);\s*return;\s*\}[\s\S]*window\.location\.href = rutaDiseno\(id\);/, '«Proyectos» del riel abre en el lugar');
});

test('4b: un editor tapado por la vista de crear no toma atajos ni pega', () => {
  const atajos = codigo('app/image-editor/_doory/editor/hooks/useKeyboardShortcuts.ts');
  assert.match(bloque(atajos, 'export function isCovered('), /return root\.closest\('\[inert\]'\) !== null/);
  assert.match(bloque(atajos, 'const onKeyDown = (e: KeyboardEvent): void =>'), /if \(isCovered\(root\)\) return/);
  assert.match(bloque(atajos, 'const applicable = (e: Event): boolean =>'), /if \(isCovered\(root\)\) return false/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Los colores son los de la app (claro, oscuro y Nord)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que NO es cromo y no sigue el tema, a propósito: el contenido y el escenario (ver el encabezado de tokens.css). */
const CONTENIDO = new Set(['--cv-paper', '--cv-color-stage', '--cv-color-on-stage', '--cv-guide-color', '--cv-ai-gradient']);
/** Un color escrito a mano: hex, rgb()/hsl() o los nombres (no `white-space`). */
const COLOR_A_MANO = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|(^|[\s:(,])(white|black)\s*($|[;,)])/i;

function declaraciones(css: string, selector: string): Map<string, string> {
  const i = css.indexOf(`${selector} {`);
  assert.ok(i >= 0, `no está «${selector} {»`);
  const cuerpo = sinComentarios(css.slice(i, css.indexOf('\n}', i)));
  const out = new Map<string, string>();
  for (const m of cuerpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

test('5: tokens.css: el cromo sale de los tokens de la app, nunca de un color escrito a mano', () => {
  const css = leer('app/image-editor/_doory/styles/tokens.css');
  const tokens = declaraciones(css, '.cv');
  const malos: string[] = [];
  for (const [nombre, valor] of tokens) {
    if (CONTENIDO.has(nombre) || nombre.startsWith('--cv-shadow-')) continue;
    if (COLOR_A_MANO.test(valor)) malos.push(`${nombre}: ${valor}`);
  }
  assert.deepEqual(malos, [], `Colores de cromo escritos a mano (en el oscuro de alguien quedan claros): van como var(--token de la app)`);
  // Los que lo arman todo, contra su token de la app.
  const esperado: Record<string, string> = {
    '--cv-color-surface': 'var(--surface)', '--cv-color-text': 'var(--ink)', '--cv-color-text-muted': 'var(--dim)',
    '--cv-color-brand': 'var(--primary)', '--cv-color-on-brand': 'var(--on-primary)', '--cv-chrome': 'var(--bg)',
    '--cv-color-canvas-workspace': 'var(--bg)', '--cv-header-gradient': 'var(--surface)', '--cv-header-share-bg': 'var(--primary)',
    '--cv-focus-ring': 'var(--focus-ring)', '--cv-selection-color': 'var(--primary)',
  };
  for (const [nombre, valor] of Object.entries(esperado)) assert.equal(tokens.get(nombre), valor, nombre);
  // Lo que lee un <canvas> (engine/objects/theme.ts, workspace/Rulers.tsx) no puede ser un color-mix: llega como texto.
  for (const nombre of ['--cv-selection-color', '--cv-guide-color', '--cv-color-surface', '--cv-color-text-subtle', '--cv-color-text', '--cv-color-canvas-workspace']) {
    assert.doesNotMatch(tokens.get(nombre) ?? '', /color-mix/, `${nombre} lo lee el lienzo`);
  }
  assert.match(css, /\[data-tema='oscuro'\] \.cv \{\s*color-scheme: dark;/, 'con el tema oscuro, los controles nativos también');
});

test('5b: la tarjeta del chat no pisa los tokens de la app, y los neutros de Canva no vuelven a los módulos', () => {
  const chat = leer('app/image-editor/mako/chat/chat.module.css');
  const columna = declaraciones(chat, '.columna');
  assert.deepEqual([...columna.keys()], [], 'la columna del chat redefine tokens de la app (en el oscuro queda clara)');
  assert.doesNotMatch(sinComentarios(chat.slice(chat.indexOf('.columna {'))), COLOR_A_MANO, 'la tarjeta del chat con un color a mano');
  // Los velos negros de Canva, su violeta «elegido» y sus textos oscuros sobre avisos: en el oscuro no se veían.
  const CANVA = /rgb\((64 79 109|57 70 96|28 33 48|163 112 252) \/|#(3e2a14|501b21|182c59|133416|5100a8|ebdcff|3d8bff)\b/i;
  const modulos = (dir: string): string[] => readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const r = `${dir}/${n}`;
    return statSync(join(RAIZ, r)).isDirectory() ? modulos(r) : r.endsWith('.css') ? [r] : [];
  });
  const malos = [...modulos('app/image-editor/_doory/editor'), ...modulos('app/image-editor/inicio'), ...modulos('app/image-editor/mako')]
    .filter((f) => CANVA.test(sinComentarios(leer(f))));
  assert.deepEqual(malos, [], 'vuelven los colores de Canva: usar --cv-neutral-*, --cv-selected-*, --cv-color-on-soft');
  // El lienzo lee la marca donde vive (`.cv`), y se redibuja con el tema de MaKo (`data-tema`).
  const tema = codigo('app/image-editor/_doory/editor/engine/objects/theme.ts');
  assert.match(tema, /return document\.querySelector\('\.cv'\) \?\? document\.documentElement/);
  assert.match(tema, /const cs = getComputedStyle\(el \?\? themeRoot\(\)\)/);
  assert.match(codigo('app/image-editor/_doory/editor/engine/editor.ts'), /attributeFilter: \['data-theme', 'data-tema', 'data-tema-candidato', 'class'\]/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. El teléfono (390 px): nada se sale de costado
// ─────────────────────────────────────────────────────────────────────────────

test('6: en la pantalla chica el lienzo no se pasa del ancho, y el encabezado de página tampoco', () => {
  // «Ajustar» deja la página 48 px adentro de cada borde; con 64 de costado el contenido medía 32 px más que la pantalla.
  const area = codigo('app/image-editor/_doory/editor/workspace/Workspace.tsx');
  assert.match(area, /const METRICS_COMPACT: StackMetrics = \{ \.\.\.METRICS, sidePadding: 16 \}/);
  assert.match(area, /const metrics = compact \? METRICS_COMPACT : METRICS/);
  assert.match(area, /paddingInline: metrics\.sidePadding \}\}>/, 'el CSS usa el mismo costado que la cuenta del ancho');
  // «Página 1 - Agregar título de página» mide 372 como mínimo, pero nunca más que la pantalla.
  assert.match(codigo('app/image-editor/_doory/editor/workspace/PageSlot.tsx'), /const headerWidth = `max\(\$\{width\}px, min\(\$\{HEADER_MIN_WIDTH\}px, 100vw - 16px\)\)`/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Crear una imagen con la IA del negocio: el chat dice qué hace, y un error trae su arreglo
// ─────────────────────────────────────────────────────────────────────────────

test('7: mientras la IA crea la imagen el hilo lo dice, y el error trae el link a la integración y «Reportar»', () => {
  const chat = codigo('app/image-editor/mako/chat/PanelMakoIA.tsx');
  // `Hilo.progreso` lo escribe mako/chat/acciones.ts («Creando la imagen…»); se dibuja sólo mientras corre.
  assert.match(chat, /\{hilo\.corriendo && hilo\.progreso \? \(\s*<p className=\{styles\.progreso\} role="status">[\s\S]*?\{hilo\.progreso\}<\/p>/);
  const hueco = chat.slice(chat.indexOf('const enMensaje = ('), chat.indexOf('const pildoras = ('));
  assert.match(hueco, /arriba: m\.error \? <p className=\{styles\.error\} role="alert">\{m\.texto\}<ReportarASoporte error=\{m\.texto\} \/><\/p> : null/);
  // `/integraciones?abrir=openai` abre SU modal acá (no navega fuera del editor): el link de la casa para integraciones.
  assert.match(hueco, /m\.links\.map\(\(l\) => <LinkIntegracion key=\{l\.href\} href=\{l\.href\}/);
  assert.doesNotMatch(hueco, /<Link\b/);
  assert.match(chat, /import \{ LinkIntegracion \} from '@\/app\/_components\/ConectarIntegracion';/);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (27/10/2026, base 9/0; un arnés que rompe de a una y restaura DE MEMORIA). Las 21 cayeron:
//   R1 la URL sin la query (?ws=) → 1 · R2 INVERTIDA, el más viejo en vez del último → 2 · R3 INVERTIDA, sin búsqueda
//   ninguno → 2b · R4 un renglón de la lista navega → 3 y 4 · R5 el chat sin la «←» → 3 · R6 INVERTIDA, la tarjeta con la
//   lista cuando se eligió el chat → 3 · R7 abrir no escribe la URL → 4 · R8 sin remontar por diseño → 4 · R9 INVERTIDA,
//   el editor `inert` sin la vista de crear → 4 · R10 «Guardar una copia» recarga en otra ruta → 4 · R11 «Proyectos» del
//   riel sin el estudio → 4 · R12 los atajos sin mirar si el editor está tapado → 4b · R13 un color a mano en tokens.css → 5
//   · R14 la selección del lienzo con color-mix → 5 · R15 la tarjeta del chat pisa --surface → 5b · R16 vuelve el violeta
//   de Canva a un módulo → 5b · R17 el lienzo lee los tokens de <html> → 5b · R18 el lienzo sin `data-tema` → 5b · R19
//   crear navega → 4 · R20 INVERTIDA, al entrar crea con diseños → 2 · R21 el teléfono con 64 de costado → 6.
//   Cada una 8/1 (R4: 7/2). Restaurado: 9/0. Con el test 7 (base 10/0): R22 INVERTIDA, el progreso cuando NO corre → 7 ·
//   R23 el link del error con el `Link` común → 7 · R24 el error sin «Reportar» → 7 · R25 INVERTIDA, el `?propuesta=` del
//   link viaja al otro diseño → 1 (cada una 9/1). Restaurado: 10/0.
// ─────────────────────────────────────────────────────────────────────────────
