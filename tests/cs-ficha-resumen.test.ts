// =============================================================================
// La ficha de un cliente: Resumen · Tareas · Pagos · Llamadas · Historial · (Equipo)
// =============================================================================
// Y la tanda del 06/10/2026: «Prioridades» pasa a «Tareas» con «Ver en el Plan» en el lugar
// del «⋮»; el Resumen son los datos de la Información principal del CRM y sus Notas; Pagos e
// Historial son los del CRM. La regla de qué productos tiene un cliente está en
// tests/cs-pertenencia.test.ts.
//
// Pedido de Martín (05/10/2026), puntos 4 y 5 sobre /customer-success:
//
//   4. «En el detail de un cliente, la tab de "Equipo" y en general todo lo que tenga que
//      ver con invitar a MaKo, debería solo verse si la cuenta es AGENCIA, sino, no
//      deberían estar esas opciones.»
//   5. «Una tab de "Resumen" antes de "Prioridades", que contenga los datos más importantes
//      del cliente… Un apartado de "Notas"… Y tal vez otra tab con las llamadas de fathom…
//      dejar solo la sección de "PRIORIDADES"… y que haya un botón que te redirija con el
//      filtro ya puesto para ver solo las tareas o proyectos de ese cliente.»
//
// Dos mitades. Las funciones PURAS (`ficha-datos.ts`) se EJECUTAN: deciden qué etapa, qué
// número y qué llamadas se le muestran a alguien, y un guard de cableado no dice si hacen lo
// que dicen. El cableado (quién ve el equipo, qué vista monta el tablero, a dónde lleva el
// botón) se mira sobre el código SIN comentarios: los archivos explican en prosa lo que se
// sacó, y un guard sobre la prosa se acusa a sí mismo.
//
// PROBADO ROMPIÉNDOLO: ver el pie, con los números.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { llamadasDe, rutaPlanDeCliente, type FilaGrabacion } from '../app/customer-success/ficha-datos';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO (AGENTS.md: un «/*» adentro de una abre un bloque)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\}/g, '');          // lo que queda de un {/* … */} de JSX

// ── Las llamadas: dos fuentes, sin repetir, las más nuevas primero ──────────

const g = (x: Partial<FilaGrabacion>): FilaGrabacion => ({
  title: null, call_date: null, started_at: null, duration_min: null, share_url: null, call_url: null, category: null, ...x,
});

test('junta las grabaciones del Closing Analyst con los links del CRM, sin repetir la misma', () => {
  const l = llamadasDe({
    grabaciones: [
      g({ title: 'Sesión 3', call_date: '2026-10-02', share_url: 'https://fathom.video/share/AAA', category: 'entrega_servicio', duration_min: 44.6 }),
      g({ title: 'Cierre', call_date: '2026-08-20', call_url: 'https://fathom.video/calls/9', category: 'venta' }),
    ],
    // El primero es el MISMO link que la sesión 3 con otra forma (query y barra final): no se repite.
    links: [{ label: 'Reunión 1', url: 'https://fathom.video/share/AAA/?tab=summary' }, { label: 'Reunión 2', url: 'https://fathom.video/share/BBB' }],
    fechaJ1: '2026-08-01', fechaJ2: '2026-08-10',
  });
  assert.deepEqual(l.map((x) => [x.titulo, x.fecha, x.tipo]), [
    ['Sesión 3', '2026-10-02', 'entrega'],
    ['Cierre', '2026-08-20', 'venta'],
    ['Reunión 2', '2026-08-10', null],   // la fecha de SU reunión, con el reparto del CRM
  ]);
  assert.equal(l[0].duracionMin, 45);
  assert.equal(l[0].url, 'https://fathom.video/share/AAA', 'el link para compartir le gana al de la llamada');
});

test('sin fecha va al final, y entre dos sin fecha manda el más nuevo de fathom_links', () => {
  const l = llamadasDe({
    grabaciones: [g({ title: 'Con fecha', started_at: '2026-09-01T15:00:00Z', share_url: 'https://x/1' })],
    links: [{ label: 'Viejo', url: 'https://x/a' }, { label: 'Nuevo', url: 'https://x/b' }],
    fechaJ1: null, fechaJ2: null,
  });
  assert.deepEqual(l.map((x) => x.titulo), ['Con fecha', 'Nuevo', 'Viejo']);
  assert.equal(l[0].fecha, '2026-09-01', 'sin call_date, el día sale de started_at');
  // Y una grabación SIN fecha —que entra primero— no le gana a un link que sí la tiene.
  const m = llamadasDe({
    grabaciones: [g({ title: 'Sin día', share_url: 'https://x/9' })],
    links: [{ label: 'Reunión 1', url: 'https://x/r1' }],
    fechaJ1: '2026-07-01', fechaJ2: null,
  });
  assert.deepEqual(m.map((x) => x.titulo), ['Reunión 1', 'Sin día']);
});

test('un link sin URL no es una llamada, y un título vacío no se dibuja vacío', () => {
  const l = llamadasDe({ grabaciones: [g({ share_url: 'https://x/1' })], links: [{ label: 'Nada', url: '  ' }], fechaJ1: null, fechaJ2: null });
  assert.deepEqual(l.map((x) => x.titulo), ['Llamada']);
});

// ── El cableado ───────────────────────────────────────────────────────────────

const PAGE = sinComentarios(leer('app/customer-success/page.tsx'));
const FICHA = sinComentarios(leer('app/customer-success/FichaCliente.tsx'));
const PESTANAS = sinComentarios(leer('app/customer-success/FichaPestanas.tsx'));
const CUENTA = sinComentarios(leer('app/customer-success/CuentaDeMaKo.tsx'));
const SHELL = sinComentarios(leer('app/plan/board/BoardShell.tsx'));
const PLANB = sinComentarios(leer('app/plan/PlanBoard.tsx'));
const TODOB = sinComentarios(leer('app/plan/TodoBoard.tsx'));

test('EL QUE IMPORTA (punto 4): cuentas y equipo se ven SÓLO si el workspace es agencia', () => {
  // Es del WORKSPACE, no de quien mira: con `esSuper ||` el super admin parado en un cliente
  // común veía controles que ese cliente no tiene.
  assert.match(PAGE, /\n\s+visible: esAg,\n/, '`visible` dejó de ser «este workspace es agencia»');
  assert.ok(!/visible:[^\n]*esSuper/.test(PAGE), 'volvió el super admin a la condición de `visible`');
  // Y las lecturas que cruzan de inquilino cuelgan de lo mismo: sin agencia, no hay cartera.
  assert.match(PAGE, /const cartera = esAg && agenciaWs \? await carteraDeAgencia\(agenciaWs\) : \[\];/);
  // El control de la cuenta sigue cortando con el mismo flag.
  assert.match(CUENTA, /if \(!cuentas\?\.visible\) return null;/);
});

test('en la ficha, todo lo de equipo cuelga de UN flag, y es ése', () => {
  assert.match(FICHA, /const verCuentas = Boolean\(cuentas\?\.visible\);/);
  assert.equal((FICHA.match(/cuentas\?\.visible/g) ?? []).length, 1, 'la regla se lee en UN lugar');
  // La tab, su panel, pedir y sumar: los cuatro.
  assert.match(FICHA, /\.\.\.\(verCuentas \? \[\{ id: 'equipo'/, 'la tab «Equipo»');
  assert.match(FICHA, /\{verCuentas && \(\s*<Panel id="equipo"/, 'el panel del equipo');
  assert.match(FICHA, /const puedePedir = Boolean\(\s*verCuentas && /, '«Pedir sumar…»');
  assert.match(FICHA, /const puedeSumar = Boolean\(verCuentas && /, '«Sumar a alguien»');
  // Y no vuelve a depender de lo que tenga adentro (el bug del 29/09).
  assert.ok(!/hayEquipo/.test(FICHA), 'volvió una condición por contenido');
});

test('las tabs: Resumen · Tareas · Curso · Pagos · Llamadas · Historial (y Equipo en una agencia)', () => {
  // «Que la tab pase a llamarse "Tareas"», «traigas la tab de Pagos», «falta la tab de
  // Historial» (06/10/2026). El id de Tareas sigue siendo `prioridades`: es la vista del tablero.
  // Y «Dentro del Detail de los clientes de Mauricio se tiene que ver este CURSO» (06/10/2026).
  const ids = [...FICHA.matchAll(/\{ id: '(\w+)', label: '([^']+)'/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(ids, ['resumen:Resumen', 'prioridades:Tareas', 'curso:Curso', 'pagos:Pagos', 'llamadas:Llamadas', 'historial:Historial', 'equipo:Equipo']);
  assert.equal((FICHA.match(/<Tabs\b/g) ?? []).length, 1, 'la ficha dibuja UNA fila de tabs');
});

test('del tablero queda SÓLO esa vista, y «Ver en el Plan» va donde estaba el «⋮»', () => {
  const boards = FICHA.match(/<(PlanBoard|TodoBoard)\b[\s\S]*?\/>/g) ?? [];
  assert.equal(boards.length, 2, `esperaba los dos tableros, hay ${boards.length}`);
  for (const b of boards) {
    assert.match(b, /soloVista="prioridades"/, `un tablero monta todas sus vistas: ${b.slice(0, 40)}`);
    assert.match(b, /accionEnLugarDelMenu=\{verEnPlan\}/, `un tablero volvió a su «⋮»: ${b.slice(0, 40)}`);
    assert.ok(!/vistaExtra=/.test(b), 'el equipo volvió a colgarse del selector del tablero');
  }
  // Y el tablero lo honra: con `soloVista` y la acción puesta, el menú de acciones no se dibuja.
  // Sin `soloVista` se ignora, o /plan perdería sus botones si alguien lo pasara por error.
  assert.match(SHELL, /\{soloVista && accionEnLugarDelMenu \? accionEnLugarDelMenu : <BarraAcciones /);
  // Pasa por los dos parents, o queda con cero call sites en uno de los dos tableros.
  for (const p of [PLANB, TODOB]) assert.match(p, /accionEnLugarDelMenu=\{accionEnLugarDelMenu\}/);
});

test('«Ver en el Plan» va al Plan filtrado a ESTE cliente, por el Link que preserva el ?ws=', () => {
  // La URL la arma el tablero (`hrefPlanDeCliente`, el que la LEE): una copia a mano del
  // nombre del parámetro es la que se queda vieja. Aterriza en Tareas.
  assert.equal(rutaPlanDeCliente(42), '/plan?vista=tareas&cliente=42');
  assert.match(FICHA, /import Link, \{ useRouter \} from '@\/app\/_ui\/Link';/);
  assert.ok(!/from 'next\/link'/.test(FICHA), 'un next/link pierde la pestaña del super admin');
  assert.match(FICHA, /const verEnPlan = <Link className="fc-plan" href=\{rutaPlanDeCliente\(c\.leadId\)\}>/);
  // Y el Resumen ya no lleva el renglón «Trabajo»: «para eso ya está la sección de Prioridades».
  assert.ok(!/rutaPlanDeCliente|fr-plan/.test(PESTANAS), 'volvió el renglón «Trabajo» al Resumen');
});

test('Resumen, Pagos e Historial son los componentes del CRM, no copias', () => {
  // Contacto con copiar y WhatsApp, las Notas, la venta con sus cuotas y el registro de cambios.
  for (const [comp, desde] of [
    ['InfoPrincipalCard', '@/app/crm/lead-view/InfoPrincipalCard'],
    ['NotasCard', '@/app/crm/lead-view/NotasCard'],
    ['AuditHistory', '@/app/crm/lead-view/AuditHistory'],
    ['DealDetailsCard', '@/app/crm/[id]/DealDetailsCard'],
  ]) {
    assert.ok(PESTANAS.includes(`import { ${comp} } from '${desde}';`), `${comp} dejó de venir del CRM`);
    assert.ok(new RegExp(`<${comp}\\b`).test(PESTANAS), `${comp} se importa y no se monta`);
  }
  // La Entrega salió del Resumen: vive en la cabecera (FichaEntrega).
  assert.ok(!/Fila k="Entrega"|LineaEntrega/.test(PESTANAS), 'volvió la sección «Entrega» al Resumen');
  assert.match(FICHA, /<FichaEntrega leadId=\{c\.leadId\}/);
});

test('Pagos e Historial leen UNA vez, al abrir la primera de las dos', () => {
  assert.match(FICHA, /const pideCrm = abiertas\.has\('pagos'\) \|\| abiertas\.has\('historial'\);/);
  assert.match(FICHA, /if \(!pideCrm \|\| crm !== null\) return;/);
  // La action se cuida sola: un id ajeno no es un cliente de este workspace.
  const ACC = sinComentarios(leer('app/customer-success/actions.ts'));
  const cuerpo = ACC.slice(ACC.indexOf('export async function pagosDeClienteAction'), ACC.indexOf('export async function', ACC.indexOf('export async function pagosDeClienteAction') + 10));
  assert.match(cuerpo, /if \(!\(await clienteDelWorkspace\(leadId\)\)\) return \{ ok: false/);
});

test('renombrar al cliente desde su ficha DEJA HISTORIAL', () => {
  // «Es importante que se registre historial en los clientes de Customer Success.»
  const ACC = sinComentarios(leer('app/customer-success/actions.ts'));
  const ini = ACC.indexOf('export async function guardarDatosClienteAction');
  const cuerpo = ACC.slice(ini, ACC.indexOf('export async function', ini + 10));
  assert.match(cuerpo, /const antes = await getLead\(leadId\)/);
  assert.match(cuerpo, /await logLeadChanges\(leadId, antes, despues, await autorActual\(\)\)/);
});

test('«no pude leer» no se pinta como «no tiene»', () => {
  // `null` = lectura caída. Un «no hay llamadas» ahí afirmaría algo falso.
  assert.match(PESTANAS, /\{!llamadas \? \(\s*<p className="fl-nada">No pude leer sus llamadas\.<\/p>/);
  assert.match(PESTANAS, /if \(!datos\.ok\) return <><p className="fl-nada">No pude leer sus pagos\./);
});

// PROBADO ROMPIÉNDOLO (06/10/2026), corrido junto con cs-pertenencia: baseline 20 pass / 0
// fail. Cada rotura, de a una y restaurada de memoria, cayó en el test que le toca — 19/1:
//   1. FichaCliente: el TodoBoard sin `accionEnLugarDelMenu` → «del tablero queda SÓLO…».
//   2. BoardShell: la acción sin `soloVista &&` (le sacaría los botones a /plan) → el mismo.
//   3. actions: `guardarDatosClienteAction` sin `logLeadChanges` → «renombrar… DEJA HISTORIAL».
//   4. FichaCliente: sin la tab Historial → «las tabs: Resumen · Tareas…».
// (La tanda del 05/10, con las roturas de `entregasDe` y `conteoDeTrabajo`, se fue con esas
// funciones. Las de las llamadas, el flag de agencia y el Link siguen valiendo.)