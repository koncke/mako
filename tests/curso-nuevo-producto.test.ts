// =============================================================================
// curso-nuevo-producto — «+ Nuevo producto» en el menú de la marca del curso
// =============================================================================
// Item 17 del audio del 08/10/2026 (docs/feedback-curso-08oct.md, minuto 00:40). Martín, textual: «hoy en
// día tenés que irte al CRM y en el CRM pones nuevo producto… eso yo también lo voy a poner ahí en el
// mismo curso, que vos puedas agregar un nuevo producto».
//
// Lo que estos tests cuidan es lo que NO se ve hasta que alguien lo nota en otra pantalla:
//   · que se cree con la CADENA del CRM (`crearServicioAction` → `crearProductoConFunnel`: producto →
//     oferta → embudo con sus etapas) y no con `upsertProducto`, que deja un producto que el desplegable
//     del CRM no lista (lista EMBUDOS) — el error que parece obvio, ya escrito en
//     app/customer-success/actions.ts;
//   · que al crearlo se navegue DURO y con el `?ws=` (lo que cambió es QUÉ EXISTE: un `router.refresh()`
//     dejaría la tab sin el producto recién creado, y sin el `?ws=` el super admin terminaría en su
//     propio workspace);
//   · que el diálogo viva AFUERA del curso (adentro, la hoja le saca la piel a sus botones) y sea de
//     quien edita;
//   · y que se pueda ESCRIBIR el nombre (audio del 08/10/2026 a la noche, punto 1: «cada vez que se
//     introduce un carácter se deselecciona el cuadro de texto»). La causa NO era un componente definido
//     adentro de otro: era el `onCerrar` de una flecha nueva por render, del que depende el efecto de foco
//     de `Modal` (app/customer-success/curso/dialogo-foco.ts). Los guards de abajo barren TODOS los
//     `Modal` de la tab Curso, no sólo éste.
// Se lee el fuente SIN comentarios y por bloque (AGENTS.md).
//
// PROBADO ROMPIÉNDOLO (08/10/2026, scratchpad/general/romper-producto.mjs, en memoria y sin git): al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\}/g, '{}');

const APP = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
const NUEVO = sinComentarios(leer('app/customer-success/curso/NuevoProducto.tsx'));

test('el menú de la marca ofrece «+ Nuevo producto» a quien edita, al final de la lista de cursos', () => {
  const ini = APP.indexOf('const menuMarca = ');
  const marca = APP.slice(ini, APP.indexOf('if (!servicio) {', ini));
  assert.ok(marca.length > 500 && marca.length < 9000, `el recorte del menú mide ${marca.length}`);
  // `pedirSalida` primero (revisión final del 08/10/2026): crear navega DURO, y con la lección a medio
  // guardar la salida la atajaba el `beforeunload` con el producto ya creado. Roto (sin `pedirSalida`): 4 / 1.
  const item = /\{puedeEditar && \(\s*<ItemMenuUgc onClick=\{\(\) => \{ cerrar\(\); leccionAbierta\.pedirSalida\(\(\) => setCreandoProducto\(true\)\); \}\}>\+ Nuevo producto<\/ItemMenuUgc>\s*\)\}/;
  assert.match(marca, item, '«+ Nuevo producto» sin la puerta de quien edita, sin cerrar el menú, o sin preguntar por la lección sin guardar');
  assert.ok(marca.indexOf('servicios.map(') < marca.search(item), 'va al FINAL de la lista de cursos');
});

test('el diálogo va AFUERA del curso, montado por la pantalla', () => {
  const finCurso = APP.indexOf('textos={TEXTOS_EDITOR}');
  const dialogo = APP.indexOf('{creandoProducto && <NuevoProducto onCerrar={() => setCreandoProducto(false)} />}');
  assert.ok(finCurso > 0 && dialogo > finCurso, 'el diálogo quedó adentro de <CursoUgc> (sus botones salen sin piel)');
});

test('crea con la CADENA del CRM (producto → oferta → embudo), nunca con upsertProducto', () => {
  assert.match(NUEVO, /import \{ crearServicioAction \} from '\.\.\/actions';/);
  assert.match(NUEVO, /const r = await crearServicioAction\(n\);/);
  assert.doesNotMatch(NUEVO, /upsertProducto|from '@\/app\/crm/, 'una segunda forma de crear un producto');
  // Y la action sigue siendo la de la cadena entera, de un admin.
  const acc = sinComentarios(leer('app/customer-success/actions.ts'));
  const ini = acc.indexOf('export async function crearServicioAction(');
  const crear = acc.slice(ini, acc.indexOf('\n}\n', ini));
  assert.match(crear, /if \(!\(await adminDeWorkspaceActual\(\)\)\) return/);
  assert.match(crear, /await crearProductoConFunnel\(nombre\)/);
});

test('al crearlo se navega DURO al curso nuevo, con el ?ws= de la pestaña; con error, el diálogo se queda', () => {
  assert.match(NUEVO, /const ws = useWs\(\);/);
  assert.match(NUEVO, /window\.location\.href = conWs\(rutaDelCurso\(r\.productoId\), ws\);/);
  assert.match(NUEVO, /const rutaDelCurso = \(id: number\) => `\/customer-success\/curso\?producto=\$\{id\}`;/);
  assert.doesNotMatch(NUEVO, /router\.refresh\(\)/, 'un refresh llega tarde para lo que cambió QUÉ EXISTE');
  // Un error no cierra el diálogo: se dice y se puede corregir el nombre.
  assert.match(NUEVO, /if \(!r\.ok\) \{ setError\(r\.error\); setCreando\(false\); return; \}/);
  assert.ok(NUEVO.indexOf('if (!r.ok)') < NUEVO.indexOf('window.location.href'), 'navega antes de saber si se creó');
});

test('el texto del diálogo: corto y en neutro', () => {
  const textos = [...NUEVO.matchAll(/(?:label|placeholder|hint|titulo)="([^"]+)"|>([^<>{}\n]{3,})</g)].map((m) => m[1] ?? m[2]).join('\n');
  assert.ok(textos.includes('Crear producto'), 'el barrido de textos no encontró nada');
  assert.deepEqual(marcasDeVoseo(textos), []);
});

// ── EL FOCO DEL NOMBRE (audio del 08/10/2026 a la noche, punto 1) ─────────────────────────────────
// Medido en Chromium con el componente real (scratchpad fb-editor/banco.mjs): con la flecha, tipeando
// «Fiesta» quedaba «F» y el foco en `div.mk-modal` después de cada tecla; al abrir, el foco se quedaba en el
// botón de ATRÁS del diálogo. Arreglado: el foco en el nombre a los 60 ms y «Fiesta» entero sin un clic,
// con el padre re-renderizándose cada 300 ms en el medio.

const DIR_CURSO = join(RAIZ, 'app/customer-success/curso');
/** Todos los `.tsx` de la tab Curso, del DISCO (un archivo nuevo sin `git add` también cuenta). */
const tsxDeCurso = (dir = DIR_CURSO): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (statSync(p).isDirectory()) return tsxDeCurso(p);
  return n.endsWith('.tsx') ? [p] : [];
});
const fuente = (p: string) =>
  ts.createSourceFile(p, readFileSync(p, 'utf8').replace(/\r\n/g, '\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
/** Se parsean UNA vez para los tres barridos. */
let parseados: ts.SourceFile[] | null = null;
const fuentesDeCurso = () => (parseados ??= tsxDeCurso().map(fuente));
const recorrer = (n: ts.Node, f: (n: ts.Node) => void) => { f(n); n.forEachChild((c) => recorrer(c, f)); };
const donde = (sf: ts.SourceFile, n: ts.Node) =>
  `${relative(RAIZ, sf.fileName).replace(/\\/g, '/')}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
const esFuncion = (n: ts.Node) => ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n);
/** La función que contiene a `n`: ahí se busca la declaración de lo que se le pasa al `Modal`. */
const alcanceDe = (n: ts.Node): ts.Node => { let a = n.parent; while (a && !esFuncion(a)) a = a.parent; return a ?? n.getSourceFile(); };

/** ¿`nombre` se declara en `alcance` con una identidad FIJA? `useCerrarEstable(…)` o `useCallback(…, [])`. */
function esEstable(alcance: ts.Node, nombre: string): boolean {
  let ok = false;
  recorrer(alcance, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || n.name.text !== nombre) return;
    const i = n.initializer;
    if (!i || !ts.isCallExpression(i) || !ts.isIdentifier(i.expression)) return;
    const deps = i.arguments[1];
    if (i.expression.text === 'useCerrarEstable') ok = true;
    if (i.expression.text === 'useCallback' && deps && ts.isArrayLiteralExpression(deps) && deps.elements.length === 0) ok = true;
  });
  return ok;
}

test('ningún Modal de la tab Curso recibe un onCerrar que cambie en cada render (el foco salta a la caja)', () => {
  const modales: string[] = [];
  const malos: string[] = [];
  for (const sf of fuentesDeCurso()) {
    recorrer(sf, (n) => {
      if (!(ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) || n.tagName.getText(sf) !== 'Modal') return;
      modales.push(donde(sf, n));
      const attr = n.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText(sf) === 'onCerrar');
      const exp = attr?.initializer && ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : undefined;
      if (!exp || !ts.isIdentifier(exp) || !esEstable(alcanceDe(n), exp.text)) malos.push(`${donde(sf, n)} onCerrar={${exp?.getText(sf) ?? '?'}}`);
    });
  }
  // NuevoProducto, QuitarEtapa, la pregunta de salir (LeccionEditable) y los dos de invitar.
  assert.ok(modales.length >= 5, `el barrido encontró ${modales.length} Modal en la tab Curso: ¿cambió la carpeta?`);
  assert.deepEqual(malos, [], 'el efecto de foco de Modal depende de onCerrar: va useCerrarEstable (./dialogo-foco.ts)');
});

test('adentro de un Modal de la tab Curso nada confía en autoFocus (la caja nace con display:none)', () => {
  const malos: string[] = [];
  for (const sf of fuentesDeCurso()) {
    recorrer(sf, (n) => {
      if (!ts.isJsxAttribute(n) || n.name.getText(sf) !== 'autoFocus') return;
      for (let a: ts.Node | undefined = n.parent; a; a = a.parent) {
        if (ts.isJsxElement(a) && a.openingElement.tagName.getText(sf) === 'Modal') { malos.push(donde(sf, n)); break; }
      }
    });
  }
  assert.deepEqual(malos, [], 'el foco al abrir va con useFocoInicial (./dialogo-foco.ts)');
});

test('el nombre del producto recibe el foco al abrir y el cerrar tiene identidad fija', () => {
  assert.match(NUEVO, /import \{ useCerrarEstable, useFocoInicial \} from '\.\/dialogo-foco';/);
  assert.match(NUEVO, /const cerrar = useCerrarEstable\(onCerrar, creando\);/);
  assert.match(NUEVO, /\n {2}useFocoInicial\(id\);/);
  assert.match(NUEVO, /<Input id=\{id\} value=\{nombre\}/, 'el foco va al campo con el id que se le pasa a useFocoInicial');
  assert.match(NUEVO, /<Modal titulo="Nuevo producto" ancho=\{440\} onCerrar=\{cerrar\}/);
});

const FOCO = sinComentarios(leer('app/customer-success/curso/dialogo-foco.ts'));
const cuerpoDe = (nombre: string) => {
  const ini = FOCO.indexOf(`export function ${nombre}(`);
  const fin = FOCO.indexOf('\n}\n', ini);
  assert.ok(ini >= 0 && fin > ini, `no encontré ${nombre}`);
  return FOCO.slice(ini, fin);
};

test('useCerrarEstable: UNA identidad para toda la vida del diálogo, y llama al onCerrar de AHORA', () => {
  const c = cuerpoDe('useCerrarEstable');
  assert.match(c, /return useCallback\(\(\) => \{ if \(!ultimo\.current\.ocupado\) ultimo\.current\.onCerrar\(\); \}, \[\]\);/);
  // Sin dependencias en el efecto: corre después de CADA render, así un cierre usa el onCerrar del último.
  assert.match(c, /useLayoutEffect\(\(\) => \{ ultimo\.current = \{ onCerrar, ocupado \}; \}\);/);
});

test('useFocoInicial: enfoca recién cuando el campo SE VE, y deja de intentar', () => {
  const c = cuerpoDe('useFocoInicial');
  assert.match(c, /if \(el && el\.getClientRects\(\)\.length > 0\) \{ el\.focus\(\); return; \}/);
  assert.match(c, /if \(\+\+intentos < INTENTOS_MAX\) t = window\.setTimeout\(intentar, CADA_MS\);/);
  assert.match(c, /return \(\) => window\.clearTimeout\(t\);/);
});

test('ningún componente de la tab Curso se define ADENTRO de otro (se remontaría en cada render)', () => {
  // La causa «obvia» del punto 1, que no era: hoy no hay ninguno. Esto evita que aparezca.
  const anidados: string[] = [];
  for (const sf of fuentesDeCurso()) {
    const visitar = (n: ts.Node, dentro: boolean) => {
      let nombre: string | null = null;
      if (ts.isFunctionDeclaration(n) && n.name) nombre = n.name.text;
      if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) nombre = n.parent.name.text;
      if (esFuncion(n) && dentro && nombre && /^[A-Z]/.test(nombre)) anidados.push(`${donde(sf, n)} ${nombre}`);
      n.forEachChild((c) => visitar(c, dentro || esFuncion(n)));
    };
    visitar(sf, false);
  }
  assert.deepEqual(anidados, [], 'un componente va al nivel del módulo y recibe lo que necesita por props');
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (scratchpad/general/romper.mjs + roturas.mjs, en memoria y sin git). Con todo en
// su lugar: 5 pass / 0 fail. Cada rotura, sola, dio 4 / 1:
//  33. «+ Nuevo producto» sin `puedeEditar`        → «el menú de la marca ofrece…»
//  34. navega sin el `?ws=` · 36. con error navega igual → «al crearlo se navega DURO…»
//  35. crea con `upsertProducto`                   → «crea con la CADENA del CRM…»
//  37. el diálogo no se monta afuera del curso     → «el diálogo va AFUERA del curso…»
//
// Los guards del foco, medidos el 09/10/2026 (scratchpad fb-editor/romper.mjs: escribe la rotura, corre y
// restaura de memoria). Sano: 11 pass / 0 fail. Cada rotura, sola:
//  R1. NuevoProducto con la flecha de antes        → 9 / 2 (el barrido de Modal y «el nombre recibe el foco…»)
//  R2. QuitarEtapa con la flecha · R3. la pregunta de salir (LeccionEditable) con la flecha
//      · R4. `useCallback(…, [haciendo, onCerrar])` → 10 / 1 cada una («ningún Modal… onCerrar…»)
//  R5. el nombre vuelve a `autoFocus`             → 10 / 1 («…nada confía en autoFocus»)
//  R6. sin `useFocoInicial(id)`                   → 10 / 1 («el nombre del producto recibe el foco…»)
//  R7. `useCerrarEstable` con `[onCerrar]`        → 10 / 1 · R8. enfoca aunque esté escondido → 10 / 1
//  R9. `const Campo = () => …` adentro de NuevoProducto → 10 / 1 («ningún componente… ADENTRO de otro»)
