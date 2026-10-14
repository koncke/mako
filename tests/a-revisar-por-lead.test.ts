// =============================================================================
// «A revisar»: una fila por lead, con su cara, y se cierra al tocar afuera
// =============================================================================
// Pedido de Martín (14/10/2026), textual: «El desplegable de "A revisar" si toco otra cosa, se
// debería cerrar. No pongas muchas filas del mismo lead, en todo caso un número de cuantos datos sin
// revisar tiene... No pongas subtitulos, pon antes del nombre la foto de perfil. Que el botón de
// revisar sea azul y con una flecha, no un lapiz. Y el botón de ignorar que sea una X. No pongas
// para cerrarlo un botón que dice "después", pon una X.»
//
// Piezas: app/_components/MakoConfirmGate.tsx (el panel), app/api/datos-sin-marcar-count/route.ts
// (las filas y las caras) y app/crm/datos-sin-marcar-actions.ts (la ✕ que ignora el lead entero).
//
// Correr: npx tsx --test tests/a-revisar-por-lead.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026, base 11/0), cada rotura restaurada antes de la siguiente.
// Los números son los que dio la corrida, no los esperados:
//   · la ruta vuelve a una fila por dato (`for (const f of i.faltantes ?? [])` con su push) → 10 / 1
//   · el número de arriba deja de contar leads (`total: items.length` → la suma de datos)  → 10 / 1
//   · la lectura de las caras sin `.in('id', ids)` (todos los leads del negocio)            → 10 / 1
//   · el Gravatar sin armar en el server (`fotoEmail: null`)                                → 10 / 1
//   · la cara de la fila con un teléfono en vez de `null` (un pedido a Evolution por fila)   → 10 / 1
//   · revisar con el lápiz (`nombre="editar"`)                                               → 10 / 1
//   · revisar con el fondo gris en vez de `var(--primary)`                                   → 10 / 1
//   · la ✕ de la fila llamando a `ignorarDatoAction` con un solo dato                        → 10 / 1
//   · la ruta sin la marca `porOtraCosa` (la ✕ borra de la vista un lead que vuelve)          → 10 / 1
//   · el panel sin mirar `porOtraCosa` al ignorar                                            → 10 / 1
//   · «Después» de vuelta en vez de la ✕ de arriba                                           → 10 / 1
//   · el cierre de afuera sin `profundidadModales()` en el Escape                            → 10 / 1
//   · el Escape sin mirar si el foco está en un menú abierto                                 → 10 / 1
//   · el toque sin `panelRef.current?.contains` (tocar adentro lo cierra)                    → 10 / 1
//   · el toque sin `enCapaFlotante(e.target)` (elegir en un menú portaleado lo cierra)        → 10 / 1
//   · el efecto sin cortar con la ficha abierta (`if (!abierta) return;`)                    → 10 / 1
//   · `ignorarDatosDelLeadAction` sin el filtro de NO_IGNORABLES                             → 10 / 1
//   · `ignorarDatosDelLeadAction` sin `haySesion()`                                          → 10 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const gate = leer('app/_components/MakoConfirmGate.tsx');
const ruta = leer('app/api/datos-sin-marcar-count/route.ts');
const acciones = leer('app/crm/datos-sin-marcar-actions.ts');
const queries = leer('lib/queries.ts');

/** Desde `desde` hasta `hasta` (excluido), o falla si no encuentra el comienzo. */
const tramo = (src: string, desde: string, hasta: string): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  return src.slice(i, j < 0 ? undefined : j);
};
const filasDelPanel = () => tramo(gate, '{filas.map(', '{verMas && ignorados.map(');
const cuerpoDe = (src: string, fn: string) => tramo(src, `export async function ${fn}`, '\nexport ');

test('la ruta arma UNA fila por lead, con todos sus datos adentro', () => {
  const lista = tramo(ruta, "searchParams.get('lista') === '1'", 'return Response.json({ total, items: filas');
  assert.match(lista, /filas\.push\(\{\s*lead_id: i\.lead_id, lead_nombre: i\.lead_nombre, pasos: \(i\.faltantes \?\? \[\]\)\.map\(/);
  assert.equal((lista.match(/filas\.push\(/g) ?? []).length, 1, 'volvió a haber más de una fila por lead');
  assert.doesNotMatch(lista, /for \(const f of i\.faltantes/, 'volvió la fila por dato');
  // Los ignorados llegan uno por dato: se juntan por lead.
  assert.match(lista, /ocultos\.find\(\(o\) => o\.lead_id === x\.lead_id\)/);
});

test('el número de arriba cuenta LEADS, lo mismo que las filas', () => {
  // `total` es el del worklist, que tiene un item por lead: el panel no lo recalcula.
  assert.match(ruta, /const \{ total, items, ignorados \} = await getPendientesDeMarcar\(/);
  assert.match(ruta, /return Response\.json\(\{ total, items: filas, ignorados: ocultos \}\);/);
  const worklist = tramo(queries, 'async function _getPendientesDeMarcar', '\nexport ');
  assert.match(worklist, /total: items\.length,/, 'el total dejó de ser la cantidad de leads');
  assert.match(gate, /setSinMarcar\(Number\(d\?\.total\) \|\| 0\)/);
});

test('la foto: UNA lectura más, sólo de las filas, y el Gravatar armado en el server', () => {
  assert.equal((ruta.match(/await ponerCaras\(/g) ?? []).length, 1);
  assert.match(ruta, /await ponerCaras\(\[\.\.\.filas, \.\.\.ocultos\]\);\s*return Response\.json\(\{ total, items: filas, ignorados: ocultos \}\);/, 'las caras se leen después de armar las filas');
  const caras = tramo(ruta, 'async function ponerCaras', '\nfunction ');
  assert.equal((caras.match(/\.from\(/g) ?? []).length, 1, 'una sola lectura extra');
  assert.match(caras, /\.select\('id, icono, avatar_url, avatar_y, foto_auto_url, email'\)\.in\('id', ids\)/);
  assert.match(caras, /fotoEmail: email \? urlGravatar\(email, 64\) : null/);
  // El hash usa node:crypto: en el navegador no se arma.
  assert.doesNotMatch(gate, /gravatar/i);
});

test('la cara va antes del nombre y NO le pide a Evolution una foto por fila', () => {
  const cara = tramo(gate, 'function CaraFila', '\nfunction Tarjeta');
  assert.match(cara, /useCaraDelLead\(\{\s*telefono: null,/, 'con el teléfono, cada fila le pide su foto al proxy de Evolution');
  assert.match(cara, /<Marca icono=\{icono\} foto=\{foto\} nombre=\{nombre\}/);
  assert.doesNotMatch(gate, /avatarimg/);
  const fila = tramo(gate, 'const fila = (', '\n  return (');
  const iCara = fila.indexOf('<CaraFila');
  assert.ok(iCara > 0 && iCara < fila.indexOf('{nombre}</span>'), 'la cara no está antes del nombre');
  // Sin bajada: un solo texto (el nombre) y el número de datos.
  assert.match(fila, /const n = l\.pasos\.length;/);
  assert.match(fila, /\{n > 0 && \(/);
  assert.doesNotMatch(gate, /mensaje/, 'volvió el subtítulo de la fila');
});

test('revisar: azul, con la flecha del set', () => {
  assert.match(gate, /const revisarBtn: CSSProperties = \{ \.\.\.iconoBtn, border: 'none', background: 'var\(--primary\)', color: '#fff' \};/);
  const filas = filasDelPanel();
  assert.match(filas, /style=\{revisarBtn\} onClick=\{\(\) => setFicha\(/);
  assert.match(filas, /<IconoMenu nombre="mover" size=\{15\} \/>/);
  assert.doesNotMatch(gate, /nombre="editar"/, 'volvió el lápiz');
});

test('ignorar: una ✕ que ignora TODOS los ignorables del lead, con una sola acción', () => {
  const filas = filasDelPanel();
  assert.match(filas, /onClick=\{\(\) => ignorarLead\(p, true\)\}[\s\S]{0,200}<IconoMenu nombre="cerrar"/);
  assert.match(gate, /const ids = si \? ignorablesDe\(l\) : l\.pasos\.map\(\(p\) => p\.id\);/);
  assert.match(gate, /void ignorarDatosDelLeadAction\(l\.lead_id, ids, si\)/);
  assert.doesNotMatch(gate, /ignorarDatoAction/, 'la fila es del lead: no ignora dato por dato');
  assert.doesNotMatch(gate, /nombre="silenciar"/);
});

test('ignorar los datos de un lead que está por OTRA cosa no lo saca de la vista', () => {
  // Una reunión pasada sin desenlace (tipo 'R') o una nutrición vencida ('M') siguen en la lista
  // con los datos ignorados: la ruta lo marca y el panel lo deja, sin el número.
  assert.match(ruta, /\.\.\.\(i\.tipo === 'R' \|\| i\.tipo === 'M' \? \{ porOtraCosa: true as const \} : \{\}\)/);
  assert.match(gate, /return quedan\.length \|\| x\.porOtraCosa \? \[\{ \.\.\.x, pasos: quedan \}\] : \[\];/);
});

test('«Ver más» también por lead, con «volver a avisar» por lead', () => {
  const ign = tramo(gate, '{verMas && ignorados.map(', '</ul>');
  assert.match(ign, /fila\(`ign:\$\{x\.lead_id\}`, x,/);
  assert.match(ign, /onClick=\{\(\) => ignorarLead\(x, false\)\}/);
  assert.match(ign, /<IconoMenu nombre="avisar"/);
});

test('cerrar es una ✕ arriba, sin «Después»', () => {
  assert.doesNotMatch(gate, /Después/);
  assert.match(gate, /onClick=\{\(\) => setAbierta\(false\)\} title="Cerrar" aria-label="Cerrar"[\s\S]{0,120}<IconoMenu nombre="cerrar"/);
});

test('se cierra al tocar afuera y con Escape, salvo con algo abierto encima', () => {
  const ef = tramo(gate, 'if (!abierta || ficha || config) return;', '}, [abierta, ficha, config]);');
  assert.match(ef, /document\.addEventListener\('pointerdown', alTocar, true\);/);
  assert.match(ef, /document\.addEventListener\('keydown', alTeclear\);/);
  assert.match(ef, /e\.key !== 'Escape' \|\| e\.isComposing \|\| profundidadModales\(\) > 0/, 'Escape no puede cerrar el panel con un modal encima');
  assert.equal((ef.match(/profundidadModales\(\) > 0/g) ?? []).length, 2, 'el toque y la tecla miran la pila');
  assert.match(ef, /panelRef\.current\?\.contains\(e\.target\)/);
  assert.match(ef, /enCapaFlotante\(e\.target\)/);
  assert.match(ef, /enCapaFlotante\(document\.activeElement\)/, 'el Escape de un menú abierto cierra el menú, no el panel');
  assert.match(gate, /closest\('\[role=menu\],\[role=listbox\],\[role=dialog\]'\)/);
  assert.match(gate, /<section ref=\{panelRef\}/);
});

test('la acción del lead: con sesión, sin los no ignorables, y la MISMA escritura que la del dato', () => {
  // Todas las exportadas cortan sin sesión: el panel lo monta el layout (tests/acciones-sin-sesion).
  const exportadas = [...acciones.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.ok(exportadas.includes('ignorarDatosDelLeadAction'), 'no está la acción del lead');
  for (const fn of exportadas) assert.match(cuerpoDe(acciones, fn), /if \(!\(await haySesion\(\)\)\) return/, `${fn} no corta sin sesión`);
  const lead = cuerpoDe(acciones, 'ignorarDatosDelLeadAction');
  assert.match(lead, /const pasos = sanearIds\(ids\)\.filter\(\(p\) => !NO_IGNORABLES\.has\(p\)\);/, 'la asistencia de una reunión pasada no se ignora aunque la mande el navegador');
  assert.match(lead, /return await escribirIgnorados\(leadId, pasos, ignorar\);/);
  assert.match(cuerpoDe(acciones, 'ignorarDatoAction'), /return await escribirIgnorados\(leadId, \[paso\], ignorar\);/);
  assert.equal((acciones.match(/\.update\(\{ datos_ignorados/g) ?? []).length, 1, 'dos escrituras de lo ignorado divergen');
});
