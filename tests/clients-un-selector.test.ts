// =============================================================================
// Clients: UN selector de programa, la barra del Classroom sin desplegable (f27, f28 y f29, llamada con Leandro)
// =============================================================================
// Textual (Fathom 196023930, 24/10/2026): «La sidebar negra del Classroom, ahí no tiene que ser un desplegable. Eso es
// un bug» · «el coso de Fiesta Music no debería ser clickeable (...) y que toda la configuración de diseño se vaya al
// botón de personalizar» · «me cambian los dos al mismo tiempo» (el selector de arriba y el de la barra) · y, entrando
// como alumno, «me aparece tu programa como que también me deja crear mi propio programa».
//
// Lo que fija este archivo: la marca del Classroom es un rótulo; el programa se elige (y se crea) SÓLO en la cabecera de
// Clients, con links que la guarda de la lección sin guardar ataja; «Personalizar» tiene todo el diseño, también «Otro
// color»; y el alumno no ve «Tu programa» en una LISTA de programas. Lo demás (el deshacer del color, la fuente, el
// diálogo del producto nuevo) lo fijan tests/curso-apariencia, curso-estilo y curso-nuevo-producto.
//
// Verificado rompiéndolo: ver «ROTURAS» al final.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIN_NOMBRE_ALUMNO, SIN_NOMBRE_ALUMNO_EN_LISTA } from '../lib/curso-nombre';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
const SHELL = sinComentarios(leer('app/clients/ClientsShell.tsx'));
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(i >= 0 && j > i, `no encontré «${desde}» … «${hasta}»`);
  return src.slice(i, j);
};

test('f27: la marca del Classroom es un RÓTULO (sin menú ni clic): CursoUgc la dibuja sin botón', () => {
  assert.match(APP, /marca=\{marcaDelProducto\(tituloDe\(servicio\)\)\}/);
  assert.doesNotMatch(APP, /menu: menuMarca|const menuMarca|ItemMenuUgc|TituloMenuUgc/, 'volvió el desplegable de la barra');
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  assert.match(ugc, /\) : \(\s*<div className="ugc-side-brand" data-recorrido="marca">/, 'sin menú ni onClick la marca tiene que ser un div');
});

test('f28: UN selector, el de la cabecera; cada programa es un link (la guarda de la lección lo ataja)', () => {
  const prog = tramo(SHELL, 'function Programa(', 'function Personalizar(');
  assert.match(prog, /<Link key=\{p\.id\} href=\{hrefDe\(p\.id\)\}/);
  assert.match(SHELL, /hrefDe=\{\(id\) => hrefConPrograma\(pathname, search, id\)\}/);
  assert.doesNotMatch(SHELL, /router\.push\(/);
  // La guarda que lo ataja: los links del documento, en captura (app/customer-success/curso/LeccionEditable.tsx).
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  assert.match(le, /document\.addEventListener\('click', f, true\);/);
  assert.match(le, /closest\?\.\('a\[href\]'\)/);
});

test('f27: «Personalizar» tiene todo el diseño, también «Otro color»; el Classroom ya no elige color', () => {
  const pers = tramo(SHELL, 'function Personalizar(', 'function Pop(');
  assert.match(pers, /<input type="color" value=\{acento\} aria-label="Otro color" onChange=\{\(e\) => probarOtro\(e\.target\.value\)\} \/>/);
  assert.match(pers, /timer\.current = window\.setTimeout\(\(\) => \{/, 'el «otro» guarda en cada movimiento');
  assert.doesNotMatch(APP, /probarAcento|type="color"/, 'el selector de color volvió al Classroom');
});

test('f29: el alumno no ve «Tu programa» en una LISTA de programas (se leía como «crear el tuyo»)', () => {
  assert.equal(SIN_NOMBRE_ALUMNO, 'Tu programa');
  assert.equal(SIN_NOMBRE_ALUMNO_EN_LISTA, 'Programa sin nombre');
  const portal = sinComentarios(leer('app/compartido/curso/[token]/PortalAlumno.tsx'));
  const menu = tramo(portal, '<TituloMenuUgc>Tus programas</TituloMenuUgc>', ') : undefined;');
  assert.match(menu, /\{p\.estilo\?\.titulo \?\? \(p\.nombre === SIN_NOMBRE_ALUMNO \? SIN_NOMBRE_ALUMNO_EN_LISTA : p\.nombre\)\}/);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 25/10/2026 contra este archivo + curso-nuevo-producto, curso-apariencia y curso-guardado-manual (45 tests),
// cada una sola (scratchpad de la sesión «Clients», romper-selector.mjs, restaura de una copia en memoria):
//   la marca con un menú otra vez → 1 / 44 · los programas como botones y no links → 2 / 43 (éste y «salir con
//   cambios pregunta») · «+ Nuevo producto» sin la puerta del admin → 1 / 44 · el aviso del color sin «Deshacer» →
//   1 / 44 · sin «Otro color» → 1 / 44 · el alumno con «Tu programa» en la lista → 1 / 44.
