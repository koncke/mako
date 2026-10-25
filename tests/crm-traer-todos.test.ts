// =============================================================================
// Los P0 del CRM de la llamada con Mauricio (22/10/2026): traer a TODOS de otro funnel, y arrastrar a varios
// =============================================================================
// C1 (min 26:00-28:23): «Traer de otro funnel» mostraba «300 de 1050», el «todos» tildaba sólo los 300 que se veían, los
// que ya estaban en el CRM salían en gris ocupando esos 300 lugares («luego ya no me deja los siguientes 300»), y el
// botón de agregar quedaba abajo de todo. Medido en el ws1 el 22/10 (sólo lectura): 1.050 en «reactivacion» del CRM
// principal y 300 ya agregados a «Sprint 3 días»: ahora se ven 300, la casilla tilda a los 750 y una línea dice que
// 300 ya están.
// C2 (02:13:00-02:14:40): varios leads tildados y arrastrados a otra etapa tienen que moverse TODOS (Mauricio va a mover
// 50 por día a «Prospección activa»), y la cajita junto a la foto tiene que entenderse.
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 5 / 0, una rotura por vez y restaurada:
//   · `filasParaTraer` listando a los que ya están                                     → 4 / 1
// Desde el 24/10/2026 los que ya están VUELVEN a verse, abajo y en gris (`presentes`): «Mejor que sea como en los grupos de
// whatsapp, que aparezca todo, pero en gris» (Martín). Siguen sin ser candidatos y sin quitarles lugar.
//   · «todos» volviendo a tildar sólo lo que está en pantalla (`enPantalla`)            → 4 / 1
//   · el pie sin `position: 'sticky'`                                                 → 4 / 1
//   · el arrastre de un tildado sin pasar por la barra de lote                         → 4 / 1
//   · la casilla sin `data-seleccionando`                                              → 4 / 1
// Correr: node --import tsx --test tests/crm-traer-todos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TANDA_AGREGAR, TOPE_PANTALLA, enTandas, filasParaTraer, type FilaTraible } from '../app/crm/traer-seleccion';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const fila = (id: number, o: Partial<FilaTraible> = {}): FilaTraible => ({
  id, nombre: `Lead ${id}`, email: null, telefono: null, empresa: null, etapaKey: 'reactivacion', yaEsta: false, ...o,
});

test('C1: los que ya están van aparte (abajo, en gris), y «todos» son todos los del filtro, no los de la pantalla', () => {
  // La foto del ws1 del 22/10: 1.050 en reactivación, los 300 primeros ya en el Sprint, y otras etapas.
  const filas = [
    ...Array.from({ length: 1050 }, (_, i) => fila(i + 1, { yaEsta: i < 300 })),
    ...Array.from({ length: 52 }, (_, i) => fila(2000 + i, { etapaKey: 'noshow_r1' })),
  ];
  const r = filasParaTraer(filas, { q: '', etapa: 'reactivacion' });
  assert.equal(r.candidatos.length, 750, 'los 750 que faltan traer');
  assert.equal(r.yaEstan, 300, 'y los 300 que ya están, contados aparte');
  assert.ok(r.candidatos.every((f) => !f.yaEsta), 'ninguno de los que ya están entre los que se tildan');
  assert.equal(r.presentes.length, 300, 'los que ya están, para dibujarlos abajo en gris');
  assert.ok(r.presentes.every((f) => f.yaEsta));
  assert.equal(r.candidatos[0].id, 301, 'arranca por el primero que falta (antes, los 300 de arriba eran los ya traídos)');
  assert.ok(r.candidatos.length > TOPE_PANTALLA, 'más de lo que entra en la pantalla: por eso «todos» no puede mirar sólo lo dibujado');
  // El filtro manda: lo que el filtro deja afuera no se tilda.
  assert.equal(filasParaTraer(filas, { q: '', etapa: '' }).candidatos.length, 802);
  assert.deepEqual(filasParaTraer(filas, { q: 'lead 2003', etapa: '' }).candidatos.map((f) => f.id), [2003]);
  assert.equal(filasParaTraer([fila(1, { yaEsta: true })], { q: '', etapa: '' }).yaEstan, 1);
  // De a tandas (el server corta en 2.000 sin decirlo).
  assert.deepEqual(enTandas([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.ok(TANDA_AGREGAR <= 2000);
});

test('C1: la pantalla tilda a TODOS los candidatos, agrega de a tandas, el botón queda abajo y se puede deshacer', () => {
  const t = sinComentarios(leer('app/crm/TraerDeOtroProducto.tsx'));
  // Con el filtro diferido desde el 23/10/2026 (el loader al filtrar: tests/crm-traer-23-10.test.ts).
  assert.match(t, /const \{ candidatos, presentes, yaEstan \} = useMemo\(\(\) => filasParaTraer\(filas \?\? \[\], \{ q: qDiferida, etapa: etapaDiferida \}\)/);
  assert.match(t, /const ids = new Set\(candidatos\.map\(\(f\) => f\.id\)\);/, '«todos» volvió a mirar sólo la pantalla');
  assert.match(t, /const todosTildados = candidatos\.length > 0 && candidatos\.every/);
  // Los que ya están: DESPUÉS de los nuevos, en gris y sin casilla (24/10/2026, como en los grupos de WhatsApp).
  const iNuevos = t.indexOf('{enPantalla.map((f) => {');
  const iGris = t.indexOf('{presentesEnPantalla.map((f) => (');
  assert.ok(iNuevos > 0 && iGris > iNuevos, 'los que ya están tienen que ir abajo de los que se pueden traer');
  assert.doesNotMatch(t.slice(iGris, t.indexOf('</tbody>', iGris)), /type="checkbox"|onClick=/, 'a uno que ya está se lo puede tildar');
  assert.match(t, /`Ya están en este funnel · \$\{miles\(yaEstan\)\} · no se traen`/);
  // El pie pegado vive en `VistaConPie` desde el 24/10/2026 (tests/crm-traer-23-10.test.ts, 4).
  assert.match(t, /<VistaConPie/, 'el botón de agregar volvió a quedar abajo de todo');
  assert.match(t, /for \(const tanda of enTandas\(sel, TANDA_AGREGAR\)\) \{\s*const r = await agregarLoteAProductoAction\(tanda, destino\);/);
  // La línea «Se ven 300 de 869… 300 ya están en este funnel» se fue el 23/10/2026 (Martín: «si hace falta algo, que sea
  // el número en la casilla»): tests/crm-traer-23-10.test.ts.
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(b, /onTraidos=\{\(movidos, fallaron, deshacer\) => \{/, 'el tablero volvió a tirar el deshacer');
  assert.match(b, /void deshacer\(\)\.then\(\(\) => router\.refresh\(\), \(\) => mostrarAviso\('No se pudo deshacer', undefined, 'bad'\)\);/);
});

test('C2: arrastrar uno de varios tildados mueve a TODOS, por la misma pregunta que la barra de lote', () => {
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  const i = b.indexOf('const handleDrop = ');
  const drop = b.slice(i, b.indexOf('const guardarLugar', i));
  assert.match(drop, /const desdeArrastre = idASoltar\.current == null;/);
  assert.match(drop, /if \(desdeArrastre && selLeads\.has\(id\) && elegidos\.length > 1 && manijaLote\.current\) \{\s*manijaLote\.current\.moverDeEtapa\(stageKey\);\s*return;\s*\}/);
  // Y antes del «ya está en esa etapa» NO: soltar el grupo en la columna del que se agarró reordena ése, como siempre.
  assert.ok(drop.indexOf('if (effStage(lead) === stageKey)') < drop.indexOf('if (desdeArrastre'));
  // La copia que viaja dice cuántos van.
  assert.match(b, /if \(varios\) nodo\.dataset\.varios = `\$\{elegidos\.length\} leads`;\s*montarCopia\(nodo, ev\.clientX - r\.left, ev\.clientY - r\.top\);\s*if \(varios\) delete nodo\.dataset\.varios;/);
  assert.match(leer('app/globals.css'), /\.mk-tarjeta-lead\[data-varios\]::after \{\s*content: attr\(data-varios\);/);
});

test('C2: la cajita se entiende: dice para qué es, y con algo tildado se ven todas', () => {
  const b = leer('app/crm/CrmBoard.tsx');
  assert.match(b, /const rotPoner = \(nombre: string\) => `Seleccionar «\$\{nombre\}» para moverlo o editarlo junto con otros`;/);
  assert.match(sinComentarios(b), /data-seleccionando=\{selLeads\.size > 0 \? '1' : undefined\}/);
  assert.match(leer('app/globals.css'), /\.mk-sel-tarjeta\[data-seleccionando='1'\] \{ width: 15px; margin-right: 0; opacity: 1; \}/);
});

test('la barra de lote es la que mueve: `moverDeEtapa` es la misma pregunta de su desplegable «Etapa»', () => {
  const lote = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(lote, /moverDeEtapa: pedirEtapa,/);
  assert.match(lote, /onChange=\{pedirEtapa\}/);
});
