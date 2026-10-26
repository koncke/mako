// =============================================================================
// Eliminar un programa desde Clients, y el clic derecho del Classroom (f25 y f26, llamada con Leandro, 24/10/2026)
// =============================================================================
// Textual (Fathom 196023930): @49:10 «El curso sin nombre lo quiero eliminar. (...) ¿Existe todavía la opción de
// eliminar? (Martín: Eso lo tengo que poner.)» · @38:00 «Tengo que implementar el click derecho en toda la app (...)
// Leandro lo estaba usando en Classroom, en la sección de curso, y no funciona».
//
// Lo que fija este archivo:
//   · las reglas puras: qué hace «Eliminar» (archivar sus embudos o darlo de baja, como el CRM), que el «Deshacer» no
//     restaure un embudo ajeno, cuándo se pregunta (sólo con alumnos o clases) y qué ofrece el menú de un programa;
//   · el cableado: la action decide con la regla y devuelve el «Deshacer»; la cabecera pregunta con la cuenta, navega
//     DURO y el «Deshacer» cruza la recarga; el clic derecho de un módulo o una clase abre SU «…».
//
// Verificado rompiéndolo: ver «ROTURAS» al final.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deshacerValido, pasoParaEliminar, preguntaAlEliminar } from '../app/customer-success/eliminar-programa';
import { itemsPrograma, opcionesPrograma } from '../app/classroom/menu-contextual-clients';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(i >= 0 && j > i, `no encontré «${desde}» … «${hasta}»`);
  return src.slice(i, j);
};
const antes = (src: string, a: string, b: string) => { const i = src.indexOf(a); const j = src.indexOf(b); return i >= 0 && j > i; };

test('pasoParaEliminar: con embudo vivo los archiva; sin ninguno, la baja; el principal no; todo archivado, nada', () => {
  assert.deepEqual(pasoParaEliminar([{ id: 4, activo: true, esDefault: false }, { id: 5, activo: false, esDefault: false }]), { tipo: 'archivar', ids: [4] });
  assert.deepEqual(pasoParaEliminar([]), { tipo: 'baja' });
  const principal = pasoParaEliminar([{ id: 1, activo: true, esDefault: true }]);
  assert.equal(principal.tipo, 'no');
  assert.deepEqual(pasoParaEliminar([{ id: 5, activo: false, esDefault: false }]), { tipo: 'nada' });
});

test('deshacerValido: sólo los embudos de ESTE producto (el «Deshacer» viaja por el navegador)', () => {
  const suyos = [{ id: 4, activo: false, esDefault: false }];
  assert.equal(deshacerValido({ tipo: 'embudos', ids: [4] }, suyos), true);
  assert.equal(deshacerValido({ tipo: 'embudos', ids: [4, 9] }, suyos), false, 'restauraría un embudo ajeno');
  assert.equal(deshacerValido({ tipo: 'embudos', ids: [] }, suyos), false);
  assert.equal(deshacerValido({ tipo: 'baja' }, []), true);
});

test('preguntaAlEliminar: sin alumnos ni clases no se pregunta; con, la cuenta y de dónde vuelve', () => {
  assert.equal(preguntaAlEliminar({ nombre: 'Curso sin nombre', alumnos: 0, clases: 0, conEmbudo: true }), null);
  const q = preguntaAlEliminar({ nombre: 'Fiesta Music', alumnos: 3, clases: 12, conEmbudo: true })!;
  assert.equal(q.titulo, '¿Eliminar «Fiesta Music»?');
  assert.equal(q.texto, '3 alumnos dejan de verlo. Tiene 12 clases. Lo recuperas en Productos eliminados del CRM.');
  assert.equal(preguntaAlEliminar({ nombre: 'X', alumnos: 1, clases: 0, conEmbudo: false })!.texto, '1 alumno deja de verlo.');
});

test('el menú de un programa: un admin; el principal sin «Eliminar»; «Eliminar» al final, separado y en rojo', () => {
  assert.deepEqual(opcionesPrograma({ admin: false, principal: false }), [], 'sin nada que ofrecer no hay menú');
  assert.deepEqual(opcionesPrograma({ admin: true, principal: true }), ['renombrar', 'duplicar']);
  const ids = opcionesPrograma({ admin: true, principal: false });
  assert.deepEqual(ids, ['renombrar', 'duplicar', null, 'eliminar']);
  const items = itemsPrograma(ids);
  assert.equal(items[2], null);
  assert.deepEqual(items[3], { id: 'eliminar', label: 'Eliminar', icono: 'borrar', peligro: true });
});

// Desde el 25/10/2026 lo que escribe vive en app/customer-success/programa-datos.ts (lo usan la action y la API de MaKo);
// la action es la puerta: el admin antes que nada.
test('la action decide con la regla y devuelve el «Deshacer»; restaurar valida los embudos ANTES de escribir', () => {
  const acc = sinComentarios(leer('app/customer-success/actions.ts'));
  const elim = tramo(acc, 'export async function eliminarServicioAction(', 'export async function previaEliminarServicioAction(');
  assert.ok(antes(elim, 'if (!(await adminDeWorkspaceActual()))', 'eliminarPrograma(productoId)'), 'elimina sin ser admin');
  assert.match(elim, /return \{ ok: true, deshacer: r\.deshacer \};/);
  const rest = tramo(acc, 'export async function restaurarServicioAction(', '\n}\n');
  assert.ok(antes(rest, 'if (!(await adminDeWorkspaceActual()))', 'restaurarPrograma(productoId, deshacer)'), 'restaura sin ser admin');
  const datos = sinComentarios(leer('app/customer-success/programa-datos.ts'));
  const e = tramo(datos, 'export async function eliminarPrograma(', 'export async function restaurarPrograma(');
  assert.match(e, /const paso = pasoParaEliminar\(await embudosDelProducto\(productoId\)\);/);
  assert.match(e, /return \{ ok: true, deshacer: \{ tipo: 'embudos', ids: paso\.ids \} \};/);
  const r = tramo(datos, 'export async function restaurarPrograma(', 'export async function restaurarProgramaEliminado(');
  assert.ok(antes(r, 'deshacerValido(deshacer, await embudosDelProducto(productoId))', 'restaurarFunnel('), 'restaura un embudo sin mirar de quién es');
  const previa = tramo(acc, 'export async function previaEliminarServicioAction(', 'export async function restaurarServicioAction(');
  assert.match(previa, /miembrosDeLaComunidad\(ws, productoId\)/, 'los alumnos se cuentan con la regla del portal');
  assert.match(sinComentarios(leer('app/customer-success/entrega.ts')), /principal: principales\.has\(p\.id\), conEmbudo: conEmbudo\.has\(p\.id\)/);
});

test('la cabecera: pregunta con la cuenta, navega DURO con el ?ws= y el «Deshacer» cruza la recarga', () => {
  const shell = sinComentarios(leer('app/classroom/ClientsShell.tsx'));
  const elim = tramo(shell, 'const eliminar = async (p: ProgramaClients) => {', 'const elegirEnPrograma = ');
  assert.ok(antes(elim, 'previaEliminarServicioAction(p.id)', 'eliminarServicioAction(p.id)'), 'elimina sin contar a los alumnos');
  assert.match(elim, /if \(q && !\(await confirm\(q\.texto, \{ title: q\.titulo, confirmLabel: 'Eliminar' \}\)\)\) return;/);
  assert.match(elim, /if \(r\.deshacer\) anotarDeshacer\(`«\$\{p\.nombre\}» eliminado`, \{ tipo: 'restaurar', id: p\.id, deshacer: r\.deshacer \}\);/);
  assert.match(shell, /window\.sessionStorage\.setItem\(NOTA_DESHACER, JSON\.stringify\(\{ texto, accion, hasta: Date\.now\(\) \+ 12_000 \} satisfies NotaDeshacer\)\)/);
  assert.match(elim, /window\.location\.href = conWs\(/, 'cambió QUÉ EXISTE: un refresh llega un paso atrás');
  // Al montar: se lee, se BORRA (una sola vez) y sólo dentro de su plazo.
  const efecto = tramo(shell, 'window.sessionStorage.getItem(NOTA_DESHACER)', '}, [show, deshacerNota]);');
  assert.match(efecto, /window\.sessionStorage\.removeItem\(NOTA_DESHACER\);/);
  assert.match(efecto, /nota\.hasta < Date\.now\(\) \|\| !nota\.accion/);
  assert.match(shell, /\{menu && programaDelMenu && itemsDelMenu\.length > 0 && \(\s*<MenuContextual /);
  // El diálogo de Renombrar: el foco no salta con cada letra (app/customer-success/curso/dialogo-foco.ts).
  const ren = tramo(shell, 'function RenombrarPrograma(', 'function Personalizar(');
  assert.match(ren, /const cerrar = useCerrarEstable\(onCerrar, guardando\);/);
  assert.match(ren, /useFocoInicial\(id\);/);
  assert.match(ren, /guardarEstiloCursoAction\(programa\.id, \{ tipo: 'titulo' \}, nombre\.trim\(\) \|\| null\)/, 'renombra el producto del CRM en vez del curso');
});

test('el clic derecho de un módulo o una clase abre SU «…»; sobre un texto que se edita, el del navegador', () => {
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  const f = tramo(ugc, 'function clicDerechoAlMenu(', 'function BotonOpciones(');
  assert.match(f, /if \(\(e\.target as Element\)\.closest\('input, textarea, \[contenteditable="true"\]'\)\) return;/);
  assert.match(f, /e\.preventDefault\(\);/);
  assert.match(ugc, /onContextMenu=\{clicDerechoAlMenu\(estructura\.conMenuModulo \? \(a\) => estructura\.mostrarOpciones\(\{ tipo: 'modulo', key: m\.key \}, a\) : null\)\}/);
  assert.match(ugc, /onContextMenu=\{clicDerechoAlMenu\(estructura\.conMenuClase \? \(a\) => estructura\.mostrarOpciones\(\{ tipo: 'clase', id: c\.id \}, a\) : null\)\}/);
  // Abre siempre (el «…» alterna; un segundo clic derecho no tiene que cerrarlo).
  assert.match(ugc, /const mostrarOpciones = \([^)]*\) =>\s*setOpciones\(\{ \.\.\.o, ancla \}\);/);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 25/10/2026 contra este archivo (7 tests), cada una sola (scratchpad de la sesión «Clients»,
// romper-eliminar.mjs, restaura de una copia en memoria): el principal se elimina · el «Deshacer» acepta un embudo
// ajeno · se pregunta sin nada que perder · el menú ofrece «Eliminar» al principal · el menú para quien no es admin ·
// restaurar sin validar los embudos · eliminar sin preguntar · la nota del «Deshacer» sin borrarse · el clic derecho
// sobre un texto que se edita · la clase sin clic derecho → cada una, 1 fallo y 6 pases.
