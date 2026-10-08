// =============================================================================
// La APARIENCIA del curso y la VISTA DEL ALUMNO (pedido de Martín del 08/10/2026, items 2, 3 y 14)
// =============================================================================
//   · item 3: «Los textos de la descripción y tarea deben seguir la misma tipografía... Las tipografías se
//     deberían editar en el mismo lugar que se editan los colores, y que cambie todo cuando se elige esa
//     tipografía». → el ajuste `fuente` (lib/curso-estilo.ts) con un catálogo CERRADO
//     (app/_cursos/fuentes.ts), elegido en el menú de la marca, pintado en `.ugc` para todo el curso.
//   · item 14: «Vista de alumnos, invitar a alumno y ? deberían estar donde hoy está "Negocio que
//     escala" 106 clases... En la vista de alumnos, si ven ese texto del título del curso, pero el
//     editor ve esos 3 botones». → `acciones` de CursoUgc.
//   · item 2: la vista previa sin el desplegable de la etapa, con «Vista del alumno» en su lugar y
//     «← Volver a editar».
//
// Lo que se EJECUTA: el saneo y las variables de la fuente. Lo que se LEE del fuente (sin comentarios y
// con los `\r` normalizados): el cableado en las tres pantallas, la barra de arriba y la de la vista previa.
//
// ── Roturas (08/10/2026, scratchpad/apariencia/romper.mjs: una por vez sobre el archivo real,
//    restaurada de MEMORIA y comprobada con md5; nunca con git) ──────────────────────────────────────
// Sin romper: 10 pass / 0 fail. Cada rotura, con lo que cayó:
//   · el saneo de `fuente` sin la lista cerrada (guarda cualquier texto)     → 8 / 2 («sólo guarda un id» · «lo que se LEE»)
//   · `fuenteGuardable` guardando la de siempre (no borra la fila)           → 7 / 3 (las dos de arriba · «las variables»)
//   · `varsDeFuente` sin `--font-archivo` (la hoja del origen no cambia)     → 9 / 1 «las variables»
//   · el dibujo sin `varsDeFuente` en el style de `.ugc`                     → 9 / 1 «el dibujo pinta la fuente»
//   · el dibujo sin `useHojasDeFuentes([fuente])`                            → 9 / 1 «el dibujo pinta la fuente»
//   · el portal sin `fuente={estilo?.fuente}`                                → 9 / 1 «la eligen en el menú…»
//   · la regla de la fuente sin `.mk-textarea` (la tarea con Geist)          → 9 / 1 «la descripción y la tarea…»
//   · el deshacer leyendo el «antes» de la PANTALLA                          → 9 / 1 «se deshacen escribiendo en el server»
//   · el deshacer que sólo revierte la pantalla                              → 9 / 1 «se deshacen escribiendo en el server»
//   · las acciones AL LADO del nombre (el nombre no se va)                   → 9 / 1 «arriba a la derecha»
//   · las acciones en el hueco del buscador (`topbarExtra`)                  → 9 / 1 «arriba a la derecha»
//   · las acciones escondidas en el teléfono (`display: none`)               → 9 / 1 «arriba a la derecha»
//   · el botón de la vista previa diciendo «Volver al curso»                 → 9 / 1 «la vista previa»
//   · la página de la vista previa leyendo `?etapa=` otra vez                → 9 / 1 «la vista previa»
// Después de las catorce: 10 / 0, y el md5 de cada archivo igual al de antes.
//
// Y en el navegador (scratchpad/apariencia/banco: esbuild + Chrome headless, la tab ENTERA con stubs de
// las actions), lo que un test de fuente no ve: con Lora elegida, el título, la barra, las tarjetas, la
// descripción (ProseMirror) y los campos de la tarea (`.ec-pregunta`, `.mk-textarea`) computan Lora; el
// botón del curso sigue en JetBrains Mono; «Deshacer» manda `fuente: null` al server; el alumno ve el
// nombre arriba a la derecha y el editor sus tres botones; a 390 px las acciones bajan de renglón sin
// scroll de costado (scrollWidth 390).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ajusteDe, ajusteValido, armarEstilo, claveDe, conAjuste, estiloVacio, sanearAjuste, valorDe,
} from '../lib/curso-estilo';
import { estiloQueViaja } from '../lib/curso-portal';
import { FUENTES, FUENTE_DEFAULT, fuenteDe, fuenteGuardable, varsDeFuente } from '../app/_cursos/fuentes';
import { CSS_UGC } from '../app/_cursos/estilos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque que arranca en `desde` y termina en el primer `hasta` después de él. */
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

// ── La fuente: qué se guarda ─────────────────────────────────────────────────

test('la fuente es un ajuste con su clave, y sólo guarda un id del catálogo (la de siempre BORRA la fila)', () => {
  const f = { tipo: 'fuente' } as const;
  assert.equal(claveDe(f), 'fuente');
  assert.deepEqual(ajusteDe('fuente'), f);
  assert.deepEqual(ajusteValido({ tipo: 'fuente' }), f);
  for (const x of FUENTES.slice(1)) assert.equal(sanearAjuste(f, x.id), x.id, `no guarda ${x.id}`);
  // La de siempre no se guarda: volver a ella borra la fila (mig 0214), como el color o la disposición.
  assert.equal(sanearAjuste(f, FUENTE_DEFAULT), null);
  // LISTA CERRADA, escrita tal cual: el valor termina en el `style` del curso de cada alumno.
  for (const malo of ['Lora', ' lora', 'LORA', '"Lora", serif', 'Comic Sans MS', 'url(https://evil.tld/x.woff2)', 'lora; color: red',
    '__proto__', 'constructor', '', null, undefined, 3, {}, ['lora']]) {
    assert.equal(sanearAjuste(f, malo), null, `guardó ${JSON.stringify(malo)}`);
  }
});

test('lo que se LEE también se sanea: una fuente vieja o rota vuelve a la de siempre', () => {
  assert.equal(armarEstilo([{ clave: 'fuente', valor: 'lora' }]).fuente, 'lora');
  assert.equal(armarEstilo([{ clave: 'fuente', valor: 'papyrus' }]).fuente, null);
  assert.equal(armarEstilo([{ clave: 'fuente', valor: 'archivo' }]).fuente, null, 'la de siempre no se guarda: si quedó una fila, es la de siempre');
  assert.equal(estiloVacio().fuente, null);
  // La pantalla la aplica antes de que conteste el server, y la saca con `null`.
  assert.equal(conAjuste(estiloVacio(), { tipo: 'fuente' }, 'nunito').fuente, 'nunito');
  assert.equal(conAjuste({ ...estiloVacio(), fuente: 'nunito' }, { tipo: 'fuente' }, null).fuente, null);
  assert.equal(valorDe({ ...estiloVacio(), fuente: 'nunito' }, { tipo: 'fuente' }), 'nunito');
  // Y le VIAJA al alumno (portal y vista previa): es el mismo curso.
  assert.equal(estiloQueViaja({ ...estiloVacio(), fuente: 'lora' }, []).fuente, 'lora');
});

test('el catálogo: cerrado, de 6 a 8, la de siempre primero y sin hoja, cada una con su hoja de Google', () => {
  assert.ok(FUENTES.length >= 6 && FUENTES.length <= 8, `son ${FUENTES.length}`);
  assert.equal(FUENTES[0].id, FUENTE_DEFAULT);
  assert.equal(FUENTES[0].hoja, null, 'la de siempre ya la carga la hoja del curso');
  assert.equal(new Set(FUENTES.map((f) => f.id)).size, FUENTES.length, 'ids repetidos');
  assert.equal(new Set(FUENTES.map((f) => f.nombre)).size, FUENTES.length, 'dos con el mismo nombre en el menú');
  for (const f of FUENTES) {
    assert.match(f.id, /^[a-z][a-z0-9-]{1,23}$/, `id raro: ${f.id}`);
    assert.ok(f.nombre.length <= 16 && f.tipo.length <= 14, `muy largo para el menú: ${f.nombre} · ${f.tipo}`);
    assert.match(f.pila, /, (sans-serif|serif|monospace)$/, `${f.id} sin respaldo genérico`);
    if (f.id === FUENTE_DEFAULT) continue;
    assert.ok(f.hoja && new URL(f.hoja).origin === 'https://fonts.googleapis.com', `${f.id}: la hoja no es de Google Fonts`);
    assert.match(f.hoja!, /display=swap/, `${f.id}: sin display=swap, el texto queda invisible mientras baja`);
    // ⚠️ Ninguna elegible es una familia que la hoja del origen ya declara con @font-face propios (que
    //    apuntan a /_next/static/media del sitio de origen y dan 404): se dibujaría la de respaldo.
    const familia = /^"([^"]+)"/.exec(f.pila)?.[1] ?? '';
    assert.ok(!/^(Archivo|Hanken Grotesk|Bricolage Grotesque|JetBrains Mono|Spline Sans Mono|Instrument Serif|Caveat)$/.test(familia),
      `${f.id} usa ${familia}, que ugc.css declara con fuentes que dan 404`);
  }
  // Las categorías que pidió el pedido: una serif, una redondeada, una geométrica, una de máquina.
  const tipos = FUENTES.map((f) => f.tipo.toLowerCase());
  for (const t of ['serif', 'redondeada', 'geométrica', 'de máquina']) assert.ok(tipos.includes(t), `falta una ${t}`);
});

test('las variables: la de siempre no pinta nada; otra redefine --font-archivo y --ugc-fuente', () => {
  assert.equal(varsDeFuente(null), undefined);
  assert.equal(varsDeFuente(FUENTE_DEFAULT), undefined);
  assert.equal(varsDeFuente('papyrus'), undefined, 'un id desconocido no pinta nada');
  const v = varsDeFuente('lora')!;
  assert.equal(v['--font-archivo'], fuenteDe('lora').pila);
  assert.equal(v['--ugc-fuente'], fuenteDe('lora').pila);
  assert.match(v['--font-archivo'], /^"Lora", .*serif$/);
  assert.equal(fuenteDe('papyrus').id, FUENTE_DEFAULT);
  assert.equal(fuenteGuardable('maquina'), 'maquina');
});

// ── La fuente: dónde se pinta ────────────────────────────────────────────────

test('el dibujo pinta la fuente en .ugc y pide su hoja ANTES de cualquier return', () => {
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  assert.match(ugc, /<div className="ugc" style=\{\(acento \|\| fuente \? \{ \.\.\.varsDeAcento\(acento\), \.\.\.varsDeFuente\(fuente\) \} : undefined\)/);
  const cuerpo = bloque(ugc, 'export default function CursoUgc(', 'function Indice(');
  const hook = cuerpo.indexOf('useHojasDeFuentes([fuente]);');
  const primerReturn = cuerpo.indexOf('return');
  assert.ok(hook > 0 && hook < primerReturn, 'el hook de la hoja quedó detrás de un return (pantalla en blanco, AGENTS.md)');
});

test('la eligen en el menú de la marca, al lado del color, y la ven el editor, el portal y la vista previa', () => {
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  const menu = bloque(app, 'const menuMarca = ', 'if (!servicio)');
  const color = menu.indexOf('<TituloMenuUgc>Color</TituloMenuUgc>');
  const fuente = menu.indexOf('<TituloMenuUgc>Fuente</TituloMenuUgc>');
  assert.ok(color > 0 && fuente > color, 'la fuente no está en el menú de la marca, debajo del color');
  assert.match(menu, /<SelectorFuente actual=\{estilo\.fuente\} onElegir=\{\(id\) => void cambiarAspecto\(\{ tipo: 'fuente' \}, id, 'Fuente cambiada'\)\} \/>/);
  assert.match(app, /\sfuente=\{estilo\.fuente\}/, 'el editor no le pasa la fuente al dibujo');
  assert.match(sinComentarios(leer('app/compartido/curso/[token]/PortalAlumno.tsx')), /\sfuente=\{estilo\?\.fuente\}/, 'el alumno no ve la fuente');
  // El selector carga las muestras al abrirse y escribe cada una con ella misma.
  const sel = sinComentarios(leer('app/_cursos/SelectorFuente.tsx'));
  assert.match(sel, /useHojasDeFuentes\(FUENTES\.map\(\(f\) => f\.id\)\);/);
  assert.match(sel, /style=\{\{ fontFamily: f\.pila \}/);
  assert.match(sel, /onElegir\(f\.id === FUENTES\[0\]\.id \? null : f\.id\)/, 'la de siempre tiene que mandar null (borrar la fila)');
});

test('la descripción y la tarea van con la letra del curso: los campos de la app ya no traen la suya', () => {
  const css = CSS_UGC.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.ahdoc\.ahdoc--ugc \.ugc \{ --ugc-fuente: var\(--font-archivo\), system-ui, sans-serif; \}/);
  const regla = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /font-family:\s*var\(--ugc-fuente\)/.test(m[2]));
  assert.ok(regla, 'no hay regla que pinte los campos con la fuente del curso');
  const sels = regla![1].split(',').map((s) => s.trim());
  for (const pieza of ['.mk-input', '.mk-textarea', '.mk-rico', '.mk-editor-rico', 'select', 'textarea']) {
    assert.ok(sels.some((s) => s.startsWith('.ahdoc.ahdoc--ugc .ugc .ugc-content') && s.includes(`:where(${pieza})`)),
      `${pieza} adentro del curso sigue con su letra`);
  }
});

test('el color y la fuente se deshacen escribiendo en el server, desde lo CONFIRMADO (item 18)', () => {
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  const f = bloque(app, 'const cambiarAspecto = async', 'const acentoActual');
  assert.match(f, /const antes = valorDe\(confirmados\.current\[productoId\] \?\? estiloVacio\(\), a\);/, 'el «antes» tiene que ser lo confirmado, no lo de pantalla');
  assert.match(f, /if \(await guardarAjuste\(a, v\)\) show\(aviso, \(\) => \{ void guardarAjuste\(a, antes\); \}\);/, 'el deshacer no escribe en el server');
  assert.match(bloque(app, 'const menuMarca = ', 'if (!servicio)'), /cambiarAspecto\(\{ tipo: 'acento' \}, a\.hex === ACENTO_DEFAULT \? null : a\.hex, 'Color cambiado'\)/);
  // El «otro» color: el de antes es el del PRIMER movimiento, no el de un tono a mitad de camino.
  const otro = bloque(app, 'const probarAcento = ', 'const guardarTexto');
  assert.match(otro, /if \(!otroAntes\.current\) otroAntes\.current = \{ v: valorDe\(confirmados\.current\[pid\]/);
  assert.match(otro, /show\('Color cambiado', \(\) => \{ void guardarAjuste\(\{ tipo: 'acento' \}, antes\.v\); \}\)/);
  // El nombre y la descripción del CURSO también (revisión final del 08/10/2026), como los de un módulo o
  // una clase. Roto (sin el `show` de este bloque) → 9 / 1, este test; restaurado 10 / 0.
  const texto = bloque(app, "if (que.tipo === 'curso-titulo' || que.tipo === 'curso-resumen') {", 'return ok;');
  assert.match(texto, /const antes = valorDe\(confirmados\.current\[pid\] \?\? estiloVacio\(\), a\);/);
  assert.match(texto, /show\(a\.tipo === 'titulo' \? 'Nombre cambiado' : 'Descripción cambiada', \(\) => \{ void guardarAjuste\(a, antes\); \}\)/);
});

// ── Item 14: arriba a la derecha, las acciones de quien edita ───────────────

test('arriba a la derecha: quien edita ve Vista del alumno, Invitar y el «?»; el alumno, el nombre del curso', () => {
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  const barra = bloque(ugc, '<div className="ugc-topbar">', '<div className="ugc-content">');
  assert.match(barra, /\{props\.acciones != null \? \(\s*<div className="ugc-topbar-acciones">\{props\.acciones\}<\/div>\s*\) : \(\s*<div className="ugc-topbar-curso">/,
    'con acciones, el nombre del curso tiene que IRSE (no dibujarse al lado)');
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /\sacciones=\{barraDeArriba\}/);
  assert.doesNotMatch(app, /\stopbarExtra=/, 'las acciones volvieron al hueco del lado del buscador');
  // En ESTE orden (el del pedido): vista del alumno, invitar, el «?».
  const b = bloque(app, 'const barraDeArriba = (', 'const cambiarAspecto');
  const iVista = b.indexOf('data-recorrido="vista-alumno"');
  const iInvitar = b.indexOf('data-recorrido="invitar"');
  const iAyuda = b.indexOf('<BotonRecorrido objetivo="ayuda"');
  assert.ok(iVista > 0 && iInvitar > iVista && iAyuda > iInvitar, `el orden no es el pedido: ${iVista} ${iInvitar} ${iAyuda}`);
  // El alumno (portal y vista previa) no recibe acciones: ve el nombre.
  assert.doesNotMatch(sinComentarios(leer('app/compartido/curso/[token]/PortalAlumno.tsx')), /\sacciones=/);
  // Y las acciones no se esconden en el teléfono como el nombre: bajan de renglón.
  const css = CSS_UGC.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.ahdoc\.ahdoc--ugc \.ugc \.ugc-topbar-acciones \{[^}]*margin-left: auto;[^}]*flex-wrap: wrap;/);
  assert.doesNotMatch(css, /\.ugc-topbar-acciones[^{]*\{[^}]*display:\s*none/, 'las acciones se esconden en algún ancho');
});

// ── Item 2: la vista previa ──────────────────────────────────────────────────

test('la vista previa: sin el desplegable de la etapa, «Vista del alumno» a la derecha y «← Volver a editar»', () => {
  const barra = sinComentarios(leer('app/customer-success/curso/vista/BarraVistaPrevia.tsx'));
  assert.doesNotMatch(barra, /<Select\b|etapa/i, 'volvió el desplegable de la etapa');
  // La flecha, escrita o escapada: las dos dibujan «←».
  assert.match(barra, /<ButtonLink size="sm" variant="secondary" href=\{hrefVolverAEditar\(productoId\)\}>\{'(?:←|\\u2190)'\} Volver a editar<\/ButtonLink>/,
    'el botón tiene que decir «← Volver a editar» y navegar con el ?ws= (ButtonLink usa app/_ui/Link)');
  assert.match(barra, /const hrefVolverAEditar = \(productoId: number\) => `\/customer-success\/curso\?producto=\$\{productoId\}`;/);
  assert.doesNotMatch(barra, /Volver al curso/);
  // «Vista del alumno» en el lugar del desplegable: después del espacio que empuja a la derecha.
  const aire = barra.indexOf('<span style={{ flex: 1 }} />');
  const rotulo = barra.indexOf('<Status tono="info">Vista del alumno</Status>');
  assert.ok(aire > 0 && rotulo > aire, '«Vista del alumno» no quedó a la derecha');
  const page = sinComentarios(leer('app/customer-success/curso/vista/page.tsx'));
  assert.doesNotMatch(page, /sp\.etapa|etapas=\{/, 'la página sigue leyendo la etapa elegida');
  assert.match(page, /const etapa = cfg\.etapas\[0\]\?\.key \?\? null;/, 'la vista previa es la del día uno');
  assert.match(page, /<BarraVistaPrevia productoId=\{productoId\} anotar=\{adminId != null\} \/>/);
});
