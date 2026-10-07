// =============================================================================
// EL FILTRO DE CLIENTE DEL PLAN, Y EL TABLERO DE UNA SOLA VISTA
// =============================================================================
// El pedido (05/10/2026), sobre la ficha de un cliente en Customer Success: «dejar solo la
// sección de PRIORIDADES y Tareas, Proyectos y Recurrentes que se vean en la tab de Plan, y
// que haya un botón que te redirija con el filtro ya puesto para ver solo las tareas o
// proyectos de ese cliente».
//
// Lo que se fija acá, y por qué cada cosa:
//
//  · LA REGLA de «qué es de un cliente» es la de su ficha (`filasDeTodos`): los proyectos
//    que lo declaran, y las tareas que lo declaran MÁS las de esos proyectos. Si el filtro
//    contestara distinto, «Ver en el Plan» llevaría a otra lista que la que la ficha acaba
//    de mostrar. Se prueba con DOS clientes: con uno solo, una regla que ignore el id pasa.
//  · EL FILTRO NO ES UNA PREFERENCIA: `useState`, nunca `usePref`. Restaurado en silencio la
//    próxima visita, el Plan abriría filtrado sin que nadie lo pida — la trampa «localStorage
//    restaura una PREFERENCIA, nunca pisa una DECISIÓN».
//  · EN TODAS LAS VISTAS, con UN predicado por pregunta: si una vista filtra y otra no, el
//    mismo link muestra cosas distintas según la tab.
//  · VIVE EN LA URL mientras está puesto: si no se borrara de ahí, sacarlo con la ✕ y apretar
//    F5 lo volvía a poner.
//  · LA PÁGINA LO LEE EN EL SERVER y los dos redirects (/plan ↔ /plan/agencia) lo llevan.
//  · `soloVista` saca el selector de vistas (la ficha trae sus tabs).
//
// Verificado en el navegador el 05/10/2026 contra el dev server (datos reales, POST
// bloqueados): /plan?vista=tareas&cliente=2473 en el tablero del super admin → 2 tarjetas de
// 416 y el chip «Cliente Leila»; con la ✕ → 416, y el F5 ya no lo repone; ?cliente=999999 →
// chip «Cliente #999999» y 0 tarjetas. En el ws1 (/plan?ws=1&cliente=31) → 20 tareas de 212 y
// 2 proyectos, que es EXACTAMENTE lo que la regla de la ficha cuenta contra la base (20).
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA ROTURA POR VEZ, restaurando desde memoria (nunca git).
// Base: **19 pasan, 0 fallan** (`node --import tsx --test tests/plan-filtro-cliente.test.ts`).
// Ver la tabla al pie del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  leerClienteDeUrl, hrefPlanDeCliente, proyectosDelCliente, tareaEsDelCliente,
  nombreDelCliente, opcionesDeCliente, PARAM_CLIENTE,
} from '../app/plan/board/filtro-cliente';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: la convención de la casa es citar en el comentario lo que se sacó, así
 *  que todo `doesNotMatch` sobre el texto crudo se acusa a sí mismo. Las líneas primero. */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque entre dos anclas, con su cierre REAL — nunca un número de caracteres. */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde.slice(0, 60)}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j >= 0, `no encontré el cierre «${hasta.slice(0, 40)}» después de «${desde.slice(0, 40)}»`);
  return src.slice(i, j + hasta.length);
}

const SHELL = sinComentarios(leer('app/plan/board/BoardShell.tsx'));

// ── La regla, ejecutada ─────────────────────────────────────────────────────

test('leerClienteDeUrl: sólo un entero positivo escrito entero', () => {
  assert.equal(leerClienteDeUrl('31'), 31);
  assert.equal(leerClienteDeUrl(' 2473 '), 2473);
  assert.equal(leerClienteDeUrl(['7', '9']), 7);
  for (const malo of ['0', '-3', '12abc', 'abc', '', '1.5', '007', undefined, null, []]) {
    assert.equal(leerClienteDeUrl(malo as never), null, `«${String(malo)}» no es un cliente`);
  }
});

test('hrefPlanDeCliente: va a /plan, abre en Tareas y vuelve a leerse igual', () => {
  assert.equal(hrefPlanDeCliente(31), '/plan?vista=tareas&cliente=31');
  assert.equal(hrefPlanDeCliente(31, 'prioridades'), '/plan?cliente=31');
  const sp = new URLSearchParams(hrefPlanDeCliente(2473).split('?')[1]);
  assert.equal(leerClienteDeUrl(sp.get(PARAM_CLIENTE)), 2473);
});

// Dos clientes (10 y 20), tres proyectos (uno de cada uno y uno de nadie).
const PROYS = [
  { id: 'p10', clienteLeadId: 10, clienteNombre: 'Ana' },
  { id: 'p20', clienteLeadId: 20, clienteNombre: 'Beto' },
  { id: 'pX', clienteLeadId: null, clienteNombre: null },
];
const T = (id: string, labels: string[], clienteLeadId: number | null = null) => ({ id, labels, clienteLeadId, clienteNombre: clienteLeadId ? `#${clienteLeadId}` : null });
const TAREAS = [
  T('declara10', ['pX'], 10),          // la declara: es de 10 aunque su proyecto no
  T('en-p10', ['p10']),                // vive en un proyecto de 10
  T('en-p20', ['p20']),                // de 20
  T('declara20-en-p10', ['p10'], 20),  // declara 20 pero vive en p10: es de los DOS (regla de la ficha)
  T('de-nadie', ['pX']),
];
const de = (leadId: number) => {
  const ps = proyectosDelCliente(PROYS, leadId);
  return TAREAS.filter((t) => tareaEsDelCliente(t, leadId, ps)).map((t) => t.id);
};

test('las tareas de un cliente: las que lo declaran MÁS las de sus proyectos (dos clientes)', () => {
  assert.deepEqual(de(10), ['declara10', 'en-p10', 'declara20-en-p10']);
  assert.deepEqual(de(20), ['en-p20', 'declara20-en-p10']);
  assert.deepEqual(de(30), []);
});

test('los proyectos de un cliente: SÓLO los que lo declaran', () => {
  assert.deepEqual([...proyectosDelCliente(PROYS, 10)], ['p10']);
  assert.deepEqual([...proyectosDelCliente(PROYS, 20)], ['p20']);
  // Un nombre sin id no ata a nadie (`clienteDe`).
  assert.deepEqual([...proyectosDelCliente([{ id: 'q', clienteLeadId: null, clienteNombre: 'Ana' }], 10)], []);
});

test('el nombre del filtro: la cartera, después las tarjetas, y si no, «Cliente #N»', () => {
  const cartera = [{ leadId: 10, nombre: 'Ana López' }];
  assert.equal(nombreDelCliente(10, cartera, []), 'Ana López');
  assert.equal(nombreDelCliente(20, cartera, PROYS), 'Beto');
  assert.equal(nombreDelCliente(99, cartera, PROYS), 'Cliente #99');
});

test('las opciones del menú: la cartera más los que sólo están en tarjetas, sin repetir', () => {
  const ops = opcionesDeCliente([{ leadId: 20, nombre: 'Beto' }], [...PROYS, ...TAREAS]);
  assert.deepEqual(ops.map((o) => o.leadId), [10, 20]);
  assert.deepEqual(ops.map((o) => o.nombre), ['Ana', 'Beto']);
});

// ── Cableado en el tablero ──────────────────────────────────────────────────

test('el filtro es estado de la sesión: useState, nunca usePref ni localStorage', () => {
  const decl = bloque(SHELL, 'const [fCliente, setFCliente] =', ';');
  assert.match(decl, /=\s*useState</, decl);
  assert.doesNotMatch(SHELL, /usePref(Set)?<[^>]*>\(\s*'[^']*cliente/i);
  assert.doesNotMatch(SHELL, /localStorage\.[a-zA-Z]+\([^)]*cliente/i);
});

test('Tareas (Kanban y tabla): `passes` pregunta por el cliente', () => {
  const p = bloque(SHELL, 'const passes = ', ';\n');
  assert.match(p, /&& pasaCliente\(t\)/);
});

test('Recurrentes: las tareas y los proyectos pasan por el MISMO predicado', () => {
  assert.match(bloque(SHELL, 'const recurrentesVisibles = ', '));'), /pasaCliente\(t\)/);
  assert.match(bloque(SHELL, 'const proyRecurrentesVisibles = ', '));'), /pasaClienteProy\(l\)/);
});

test('Proyectos: la grilla y la tabla filtran por cliente, y la vista lo recibe', () => {
  assert.match(bloque(SHELL, 'const shown = conEscalon', ';\n'), /\.filter\(\(\{ l \}\) => pasaCliente\(l\)\)/);
  assert.match(bloque(SHELL, "view === 'proyectos' && <ProyectosView", '/>'), /pasaCliente=\{pasaClienteProy\}/);
});

test('Prioridades: las cinco tarjetas y el objetivo son del cliente; las columnas del Kanban no se mueven', () => {
  assert.match(bloque(SHELL, 'const pendientesTodas = ', ';\n'), /&& pasaCliente\(t\)/);
  assert.match(bloque(SHELL, "view === 'prioridades' && <Prioridades", '/>'), /objetivo=\{objetivoVista\}/);
  assert.match(bloque(SHELL, 'const esDelTop = ', ';\n'), /topVistaId/);
  // `topProjectId` decide la COLUMNA de cada tarjeta: un filtro que la cambia reordena.
  assert.match(bloque(SHELL, 'const topProjectId = ', ';\n'), /objetivoPrincipal\?\.id/);
});

test('la URL lleva el cliente mientras está puesto, y lo borra al sacarlo', () => {
  assert.match(bloque(SHELL, 'const urlEstado = ', ';\n'), /fCliente/);
  const efecto = bloque(SHELL, "if (openProj) sp.set('proyecto', openProj)", 'window.history.replaceState');
  assert.match(efecto, /if \(fCliente != null\) sp\.set\(PARAM_CLIENTE, String\(fCliente\)\); else sp\.delete\(PARAM_CLIENTE\);/);
});

test('el filtro se VE en todas las vistas (chip con su ✕) y «Filtrar» lo cuenta y lo limpia', () => {
  const chip = bloque(SHELL, '{nombreFiltroCli != null && (', '</span>\n        )}');
  assert.match(chip, /onClick=\{\(\) => setFCliente\(null\)\}/);
  // El chip vive FUERA de los `view === …`: si colgara de una vista, Prioridades filtraría
  // sin que se vea (allá no hay botón «Filtrar»).
  assert.doesNotMatch(chip, /view ===/);
  const menu = bloque(SHELL, 'function FilterMenu(', 'return (');
  assert.match(menu, /\(cliente\?\.valor != null \? 1 : 0\)/);
  assert.match(bloque(menu, 'const limpiarTodo = ', ';\n'), /cliente\?\.set\(null\)/);
});

test('soloVista: arranca en esa vista y no dibuja ni el logo ni las tabs', () => {
  assert.match(bloque(SHELL, 'const [view, setView] = useState<Vista | string>(', ');'), /\(\s*soloVista\s*\?\?/);
  const cab = bloque(SHELL, '<header style=', '<span style={{ flex: 1 }} />');
  assert.match(cab, /\{!soloVista && <div style=\{\{ display: 'inline-flex', alignItems: 'center', gap: 12/);
  assert.match(cab, /\{!soloVista && <div style=\{\{ display: 'inline-flex', flex: 'none', background/);
});

test('PlanBoard y TodoBoard le pasan las props al tablero', () => {
  for (const f of ['app/plan/PlanBoard.tsx', 'app/plan/TodoBoard.tsx']) {
    const b = bloque(sinComentarios(leer(f)), 'return <BoardShell ', '/>;');
    assert.match(b, /soloVista=\{soloVista\}/, f);
    assert.match(b, /clienteInicial=\{clienteInicial\}/, f);
    assert.match(b, /nombreCliente=\{clienteFijo\?\.nombre\}/, f);
  }
});

test('los vacíos de Prioridades nombran al cliente (el del filtro o el de la ficha)', () => {
  // Adentro de la ficha de un cliente sin trabajo, «no queda ninguna tarea abierta en todo
  // el plan» es falso: el plan tiene, el que no tiene es él.
  assert.match(bloque(SHELL, "view === 'prioridades' && <Prioridades", '/>'), /cliente=\{nombreFiltroCli \?\? nombreCliente \?\? null\}/);
  const prio = bloque(SHELL, 'function Prioridades(', '\n}\n');
  assert.match(prio, /\{cliente \? `\$\{cliente\} no tiene proyectos\.` :/);
  assert.match(prio, /\{cliente \? `\$\{cliente\} no tiene tareas abiertas\.` :/);
});

test('las dos páginas leen ?cliente= en el server', () => {
  const plan = sinComentarios(leer('app/plan/page.tsx'));
  assert.match(bloque(plan, 'return <TodoBoard ', '/>;'), /clienteInicial=\{leerClienteDeUrl\(cliente\)\}/);
  const ag = sinComentarios(leer('app/plan/agencia/page.tsx'));
  assert.match(bloque(ag, 'return <PlanBoard ', '/>;'), /clienteInicial=\{leerClienteDeUrl\(params\.cliente\)\}/);
});

test('los dos redirects llevan el query: /plan → /plan/agencia y la vuelta', () => {
  const plan = sinComentarios(leer('app/plan/page.tsx'));
  const ida = bloque(plan, "if (sesion?.rol === 'admin'", 'redirect(');
  assert.match(ida, /Object\.entries\(await searchParams\)/);
  const ag = sinComentarios(leer('app/plan/agencia/page.tsx'));
  const vuelta = bloque(ag, "if (sesion?.rol !== 'admin'", "redirect(await rutaConWs(`/plan${qs ? `?${qs}` : ''}`));");
  assert.match(vuelta, /Object\.entries\(params\)/);
});

test('embebido no ofrece el filtro: nace en null y el menú no recibe la capa', () => {
  assert.match(bloque(SHELL, 'const [fCliente, setFCliente] =', ';'), /embebido \? null/);
  assert.match(bloque(SHELL, 'const menuCli', ';\n'), /embebido \? undefined/);
});

// ── La tabla de roturas ─────────────────────────────────────────────────────
// Corrida el 05/10/2026 con un arnés que aplica UNA rotura, corre este archivo y la deshace
// reemplazando el pedazo roto por el original (nunca git: el árbol es compartido).
//
//  #   Qué se rompió                                                          pasan/fallan
//  1   `tareaEsDelCliente` mirando sólo lo que declara (sin `labels`)               18/1
//  2   `proyectosDelCliente` devolviendo TODOS los proyectos                        17/2
//  3   `leerClienteDeUrl` con `parseInt` (acepta «12abc»)                           18/1
//  4   `fCliente` con `usePref('tablero.cliente', …)`                               18/1
//  5   `passes` sin `&& pasaCliente(t)`                                             18/1
//  6   `recurrentesVisibles` sin `pasaCliente(t)`                                   18/1
//  7   la grilla de Proyectos sin `.filter(({ l }) => pasaCliente(l))`              18/1
//  8   `pendientesTodas` sin `&& pasaCliente(t)`                                    18/1
//  9   Prioridades con `objetivo={objetivoPrincipal}`                               18/1
//  10  la URL sin `sp.set/delete(PARAM_CLIENTE…)`                                    18/1
//  11  «Limpiar» sin `cliente?.set(null)`                                           18/1
//  12  las tabs sin `!soloVista &&`                                                 18/1
//  13  TodoBoard sin `clienteInicial={clienteInicial}`                              18/1
//  14  /plan/agencia volviendo a `redirect(await rutaConWs('/plan'))` pelado         18/1
//  15  PlanBoard sin `nombreCliente={clienteFijo?.nombre}`                          18/1
//  16  Prioridades con `cliente={nombreFiltroCli}` (sin el de la ficha)             18/1
//  17  el vacío de tareas volviendo a «en todo el plan» siempre                    18/1
//
// Las 17 restauradas y comprobadas con md5 contra el archivo de antes de romper.
