// =============================================================================
// La ficha de un cliente: Resumen · Prioridades · Llamadas · (Equipo, sólo en una agencia)
// =============================================================================
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
import { entregasDe, conteoDeTrabajo, fraseConteo, llamadasDe, rutaPlanDeCliente, type FilaGrabacion } from '../app/customer-success/ficha-datos';
import type { EtapaEntrega, FaseEntrega } from '../lib/servicio-etapas';
import type { TrabajoDeCliente } from '../app/customer-success/trabajo';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO (AGENTS.md: un «/*» adentro de una abre un bloque)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\}/g, '');          // lo que queda de un {/* … */} de JSX

// ── La entrega: la MISMA regla que el kanban ──────────────────────────────────

const ETAPAS: EtapaEntrega[] = [
  { key: 'onb', label: 'Onboarding', tone: 'info', dot: '#111111' },
  { key: 'h1', label: 'Hito 1', tone: 'teal', dot: '#222222', fase: 'f1' },
];
const FASES: FaseEntrega[] = [{ key: 'f1', label: 'Cimientos', tone: 'violet', dot: '#999999' }];
const SERV = [{ productoId: 7, nombre: 'Programa', etapas: ETAPAS, fases: FASES }];

test('un cliente SIN fila está en la primera etapa, y su reloj no arrancó', () => {
  // Es la regla del kanban (`repartirEnEtapas`): la tarjeta dice «Onboarding», y el Resumen
  // del mismo cliente no puede decir otra cosa.
  const [e] = entregasDe(5, SERV, { 7: {} });
  assert.equal(e.etapa, 'Onboarding');
  assert.equal(e.desde, null, 'sin fila no hay «desde»: inventarlo sería afirmar algo que nadie midió');
  assert.equal(e.color, '#111111');
});

test('con fila, su etapa, su fase y el color que pinta el kanban (el de la fase gana)', () => {
  const [e] = entregasDe(5, SERV, { 7: { 5: { etapa: 'h1', etapa_desde: '2026-10-01T10:00:00Z' } } });
  assert.deepEqual(
    { etapa: e.etapa, fase: e.fase, color: e.color, desde: e.desde },
    { etapa: 'Hito 1', fase: 'Cimientos', color: '#999999', desde: '2026-10-01T10:00:00Z' },
  );
});

test('una fila con una etapa que ya no existe se DICE, no se reparte en otra', () => {
  const [e] = entregasDe(5, SERV, { 7: { 5: { etapa: 'borrada', etapa_desde: '2026-10-01T10:00:00Z' } } });
  assert.equal(e.etapa, null);
  assert.equal(e.servicio, 'Programa');
});

test('un renglón por servicio, y un servicio sin etapas no dice nada', () => {
  const dos = [...SERV, { productoId: 8, nombre: 'Otro', etapas: [], fases: [] }, { productoId: 9, nombre: 'Tercero', etapas: ETAPAS, fases: [] }];
  assert.deepEqual(entregasDe(5, dos, {}).map((e) => e.servicio), ['Programa', 'Tercero']);
});

// ── El trabajo: los números de «Prioridades», no los del cruce ───────────────

test('cuenta abiertas con fin, recurrentes aparte — en el tablero del CLIENTE', () => {
  const t = (estado: string, recurrente = false) => ({ estado, recurrente }) as unknown;
  const trabajo = {
    dueno: false,
    tareas: [t('por_hacer'), t('en_curso'), t('en_seguimiento'), t('hecho'), t('no_cumple'), t('por_hacer', true), t('hecho', true)],
    categorias: [{}, {}],
  } as unknown as TrabajoDeCliente;
  // `no_cumple` NO es pendiente (lib/todo-estados), y las recurrentes cuentan aunque estén hechas.
  assert.deepEqual(conteoDeTrabajo(trabajo), { proyectos: 2, tareas: 3, recurrentes: 2 });
});

test('y en el del DUEÑO, donde «abierta» sale del avance', () => {
  const t = (progress: number, recurrente = false) => ({ progress, recurrente }) as unknown;
  const trabajo = { dueno: true, tareas: [t(0), t(40), t(100), t(10, true)], proyectos: [{}] } as unknown as TrabajoDeCliente;
  assert.deepEqual(conteoDeTrabajo(trabajo), { proyectos: 1, tareas: 2, recurrentes: 1 });
});

test('la frase lleva los tres números y el singular', () => {
  assert.equal(fraseConteo({ proyectos: 1, tareas: 0, recurrentes: 2 }), '1 proyecto · 0 tareas · 2 recurrentes');
});

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

test('del tablero queda SÓLO Prioridades, sin su selector (una fila de tabs: la de la ficha)', () => {
  const boards = FICHA.match(/<(PlanBoard|TodoBoard)\b[\s\S]*?\/>/g) ?? [];
  assert.equal(boards.length, 2, `esperaba los dos tableros, hay ${boards.length}`);
  for (const b of boards) {
    assert.match(b, /soloVista="prioridades"/, `un tablero monta todas sus vistas: ${b.slice(0, 40)}`);
    assert.ok(!/vistaExtra=/.test(b), 'el equipo volvió a colgarse del selector del tablero');
  }
  assert.equal((FICHA.match(/<Tabs\b/g) ?? []).length, 1, 'la ficha dibuja UNA fila de tabs');
  // Resumen primero, y Prioridades después: el orden lo pidió Martín.
  assert.match(FICHA, /\{ id: 'resumen', label: 'Resumen' \},\s*\{ id: 'prioridades', label: 'Prioridades' \},\s*\n?\s*\{ id: 'llamadas'/);
});

test('«Ver en el Plan» va al Plan filtrado a ESTE cliente, por el Link que preserva el ?ws=', () => {
  // La URL la arma el tablero (`hrefPlanDeCliente`, el que la LEE): una copia a mano del
  // nombre del parámetro es la que se queda vieja. Aterriza en Tareas, no en Prioridades
  // (eso ya lo muestra la ficha).
  assert.equal(rutaPlanDeCliente(42), '/plan?vista=tareas&cliente=42');
  assert.match(PESTANAS, /import Link from '@\/app\/_ui\/Link';/);
  assert.ok(!/from 'next\/link'/.test(PESTANAS), 'un next/link pierde la pestaña del super admin');
  assert.match(PESTANAS, /<Link className="fr-plan" href=\{rutaPlanDeCliente\(c\.leadId\)\}>/);
});

test('las Notas son las del CRM, el mismo componente', () => {
  assert.match(PESTANAS, /import \{ NotasCard \} from '@\/app\/crm\/lead-view\/NotasCard';/);
  assert.match(PESTANAS, /<NotasCard leadId=\{c\.leadId\} \/>/);
});

test('«no pude leer» no se pinta como «no tiene»', () => {
  // `null` = lectura caída. Un «—» o un «no hay llamadas» ahí afirmaría algo falso.
  assert.match(PESTANAS, /\{!llamadas \? \(\s*<p className="fl-nada">No pude leer sus llamadas\.<\/p>/);
  assert.match(PESTANAS, /contacto === null\s*\?\s*<span className="fr-nada">No lo pude leer\.<\/span>/);
  assert.match(PESTANAS, /entregas === null \? \(/);
});

// PROBADO ROMPIÉNDOLO (05/10/2026). Baseline: 16 pass / 0 fail. Cada rotura, de a una y
// restaurada de memoria (nunca con `git checkout`), cayó en el test que le toca y en
// ningún otro — 15 pass / 1 fail las diez:
//   1. ficha-datos: `entregasDe` con `desde: fila?.etapa_desde ?? new Date().toISOString()`
//      → «un cliente SIN fila…».
//   2. ficha-datos: `llamadasDe` sin el `if (vistas.has(k)) continue;` → «junta las
//      grabaciones…» (la sesión 3 sale dos veces).
//   3. ficha-datos: `conteoDeTrabajo` con `x.estado !== 'hecho'` en vez de `estaPendiente`
//      → «…en el tablero del CLIENTE» (cuenta el no_cumple).
//   4. page.tsx: `visible: esSuper || esAg,` → «EL QUE IMPORTA (punto 4)».
//   5. FichaCliente: la tab «Equipo» sin `verCuentas ?` → «…cuelga de UN flag».
//   6. FichaCliente: `soloVista` fuera del TodoBoard → «del tablero queda SÓLO…».
//   7. FichaPestanas: `import Link from 'next/link'` → «Ver en el Plan…».
//   8. FichaCliente: `puedeSumar` sin `verCuentas` → «…cuelga de UN flag».
//   9. page.tsx: la cartera leída sin `esAg &&` → «EL QUE IMPORTA (punto 4)».
//  10. ficha-datos: el orden sin las dos líneas de «lo que no tiene fecha va al final» →
//      «sin fecha va al final…». ⚠️ La PRIMERA versión de ese test dio VERDE con esta
//      rotura (16/0): sus datos ya venían con lo fechado adelante, así que el orden de
//      inserción tapaba el bug. Se le sumó el caso de una grabación SIN fecha que entra
//      primero, y recién ahí cayó.
