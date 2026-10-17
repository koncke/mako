// =============================================================================
// «Review» (punto 6, 16/10/2026): lo que un chat implementó y Martín tiene que ir a revisar
// =============================================================================
// Martín: «que graficamente me diga que tengo que ir a revisar de las cosas que ha implementado, si puede dejarme el
// link». El chat deja la página en su cierre (`cartero.mjs cierre … --revisar "/crm?lead=12"`) o en el hito de su
// bitácora (`revisar`); el Centro la pone en «Review» con el link «Revisar», que abre el visor de «Centro de Operaciones
// › Review» con el contrato de docs/relevo/centro-operaciones.md. Lo que se fija:
//   · sólo una ruta INTERNA de MaKo llega a «Revisar» (nunca una URL de afuera adentro del visor), con la misma regla que
//     la Ticketera;
//   · el nodo sabe qué sesión lo hizo (a ella vuelve la devolución);
//   · el link lleva lo que el visor espera.
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 3 pases (4 con el del visor):
//   · aceptando «//otro-host» en rutaParaRevisar → 2 fallos («la misma regla» y «el cierre se sanea»);
//   · sin sanear el revisar del cierre (guardándolo crudo) → 1 fallo («el cierre se sanea»);
//   · porRevisar con lo que no está terminado → 1 fallo («el nodo y el link»);
//   · el link sin la sesión que lo hizo → 1 fallo («el nodo y el link»);
//   · el interruptor del visor encendido sin la página, o «Revisar» siempre al visor → 1 fallo cada uno («Revisar lleva al
//     visor sólo si existe»).
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026, «Review» lista todo lo terminado; sin página, la tab del jefe), contra la base en
// verde de 8 pases (los 4 de arriba + los 4 nuevos). Una rotura por vez, restaurado a mano (script con restauración en un
// `finally` y el archivo comparado byte a byte al final):
//   · porRevisar vuelve a pedir `&& n.revisar` (el bug que vio Martín) → 2 fallos («el nodo y el link» y «Review lista todo»);
//   · porRevisar sin mirar el estado (entra lo en curso y lo que no salió) → 2 fallos (los mismos);
//   · rutaDeLaTab con los ítems al revés (gana /admin/dev/crm) → 2 fallos («la tab del jefe» y «Revisar: con página propia…»);
//   · rutaDeLaTab comparando el nombre crudo, sin normalizar → 1 fallo («la tab del jefe»);
//   · rutaDeLaTab aceptando cualquier href («//host», «https:») → 1 fallo («la tab del jefe»);
//   · destinoDeReview con el título entero y no el jefe (el sub-chat «CRM › Lead Detail» sin tab) → 1 fallo («Revisar: con
//     página propia…»); ignorando la página propia (siempre la tab) → 1 fallo (ése); marcando siempre «visor» → 1 fallo (ése);
//   · Avance.tsx con la barra del super admin primero → 1 fallo («la pantalla de Review arma las tabs…»); Avance.tsx
//     filtrando otra vez `.filter((n) => n.revisar)` sobre porRevisar → 1 fallo (ése);
//   · restaurado: 8 pases, 0 fallos.
// Lo que el test NO ve: que el `<Link>` se pinte y abra la tab en otra pestaña (no hay navegador en estos tests).

import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { rutaParaRevisar, sanearCierres } from '../lib/operaciones-reglas';
import { esHrefInterno } from '../app/admin/runway/decisiones';
import { ADMIN_NAV, MAKO_NAV, TODOS_LOS_ITEMS } from '../app/_components/nav';
import {
  VISOR_REVISAR, avanceDelChat, conteoAvance, destinoDeReview, enlaceRevisar, hrefRevisar, porRevisar, rutaDeLaTab,
  type LineaChat, type NodoAvance, type TrabajoP,
} from '../lib/centro-chats';
import type { PasoP, PedidoP } from '../lib/progreso-reglas';

const ID = '00000000-0000-4000-8000-0000000000a1';
const S = (n: number) => `local_${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

test('sólo una ruta interna de MaKo: la misma regla que la Ticketera', () => {
  const casos = ['/crm?lead=12', '/admin/operaciones?ws=9', '//evil.com/x', '/\\evil.com', 'https://claude.ai/x', 'javascript:alert(1)', 'crm', '/'];
  for (const c of casos) assert.equal(rutaParaRevisar(c) !== null, esHrefInterno(c), `«${c}»`);
  assert.equal(rutaParaRevisar('/crm lead'), null, 'un renglón, sin espacios');
  assert.equal(rutaParaRevisar(`/${'x'.repeat(300)}`), null, 'hasta 300 caracteres');
  assert.equal(rutaParaRevisar(42), null);
});

test('el cierre se sanea: la ruta interna se guarda, lo demás se pierde sin tirar el cierre', () => {
  const [bien] = sanearCierres([{ id: ID, cierre: { hecho: 'Listo el filtro', revisar: '/crm?lead=12' } }]);
  assert.equal(bien.cierre.revisar, '/crm?lead=12');
  const [mal] = sanearCierres([{ id: ID, cierre: { hecho: 'Listo el filtro', revisar: '//evil.com' } }]);
  assert.equal(mal.cierre.hecho, 'Listo el filtro', 'el cierre entra igual');
  assert.equal(mal.cierre.revisar, undefined, 'sin la ruta de afuera');
});

test('el nodo y el link: lo terminado va a «Review», y el que dejó página lleva la sesión que lo hizo', () => {
  const T = Date.parse('2026-10-16T12:00:00Z');
  const w = (id: string, estado: TrabajoP['estado'], revisar?: string): TrabajoP => ({
    id, destino: S(2), destino_titulo: 'CRM', destino_cuenta: 'claude2', created_at: '2026-10-16T11:00:00Z', texto: `Trabajo ${id}`, estado,
    cierre: { decidido: '', hecho: 'Hecho', comprobado: '', sigue: '', prueba: null, ...(revisar ? { revisar } : {}) },
  });
  const paso: PasoP = { instante: T, chat: 'CRM', sesion: S(3), tipo: 'implementacion', titulo: 'El filtro', commits: [], cuenta: 'claude3', revisar: '/crm?vista=funnel' };
  const pedido: PedidoP = {
    id: 'crm:4', texto: 'Arregla el filtro', titulo: 'Arregla el filtro', instante: T - 10, areas: ['CRM'], tomo: 'CRM', estado: 'hecho', pasos: [paso],
    commits: [], junto: 0, ultimo: T, cierre: T, pidioEn: { chat: 'CRM', sesion: S(3) },
  };
  const lineas: LineaChat[] = [
    { tipo: 'pedido', instante: T - 10, pedido, pasos: [paso], desde: null },
    { tipo: 'trabajo', instante: T, trabajo: w('t1', 'hecho', '/crm?lead=12') },
    { tipo: 'trabajo', instante: T + 1, trabajo: w('t2', 'entregado', '/crm?lead=13') },
    { tipo: 'trabajo', instante: T + 2, trabajo: w('t3', 'hecho') },
  ];
  const r = porRevisar(avanceDelChat(lineas));
  // 17/10/2026: antes se pedía «terminado Y con página» y t3 (terminado, sin página) no aparecía: Review quedaba vacío.
  assert.deepEqual(r.map((n) => n.id), ['t:t3', 't:t1', 'p:crm:4'], 'todo lo terminado, lo más nuevo arriba; lo entregado sin cierre todavía no');
  assert.equal(r[0].revisar, null, 'lo que no dejó página entra igual');
  assert.deepEqual(r[1].revisar, { pagina: '/crm?lead=12', sesion: S(2) }, 'un trabajo: la sesión a la que se mandó');
  assert.deepEqual(r[2].revisar, { pagina: '/crm?vista=funnel', sesion: S(3) }, 'un pedido: la del paso que la dejó');
  const link = enlaceRevisar(r[1], { clave: 'nombre:crm', sesion: S(9) })!;
  const u = new URL(link, 'https://hola-mako.com');
  assert.equal(u.pathname, '/admin/operaciones/revisar');
  assert.deepEqual(Object.fromEntries(u.searchParams), { pagina: '/crm?lead=12', chat: 'nombre:crm', nodo: 't:t1', sesion: S(2) });
  assert.equal(enlaceRevisar({ id: 'x', revisar: null }, { clave: 'nombre:crm', sesion: null }), null);
});

test('«Revisar» lleva al visor sólo si el visor existe; si no, a la página (un link al visor daría 404)', () => {
  // El visor lo hace «Centro de Operaciones › Review»: cuando crea la página, enciende VISOR_REVISAR en el mismo commit.
  assert.equal(VISOR_REVISAR, existsSync('app/admin/operaciones/revisar/page.tsx'), 'el interruptor y el archivo dicen lo mismo');
  const n = { id: 't:t1', revisar: { pagina: '/crm?lead=12', sesion: S(2) } };
  const href = hrefRevisar(n, { clave: 'nombre:crm', sesion: null });
  assert.equal(href, VISOR_REVISAR ? enlaceRevisar(n, { clave: 'nombre:crm', sesion: null }) : '/crm?lead=12');
  assert.equal(hrefRevisar({ id: 'x', revisar: null }, { clave: 'nombre:crm', sesion: null }), null);
});

// ── 17/10/2026: «Review» lista TODO lo terminado; sin página propia, el link es la tab del jefe del chat ──────────
// Martín, mirando producción: «Se terminaron y pushearon cosas y no las puedo ver en Review, me dice "Nada para revisar
// todavía"». El diagnóstico obvio —«el chat no terminó nada» o «el filtro de estado falla»— era el equivocado: lo
// terminado estaba bien (estado 'hecho', con sus commits); lo que lo dejaba afuera era el `&& n.revisar` de `porRevisar`.

/** El orden de las tabs que usa la pantalla: la del producto primero (lo mismo que `nombresDeTabs`). */
const TABS = [...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV];
const nodo = (id: string, estado: NodoAvance['estado'], instante: number, revisar: NodoAvance['revisar'] = null): NodoAvance => ({
  id, origen: 'pedido', titulo: `Cosa ${id}`, prompt: `Cosa ${id}`, instante, estado, cuentas: [], pasos: [], commits: [], trabajaron: [], cierre: null, motivo: null, revisar,
});

test('Review lista todo lo terminado traiga o no página; «Nada para revisar» sólo si no terminó nada', () => {
  const nodos = [
    nodo('a', 'hecho', 10), nodo('b', 'hecho', 30, { pagina: '/crm?lead=1', sesion: null }), nodo('c', 'hecho', 20),
    nodo('d', 'en_curso', 40), nodo('e', 'sin_empezar', 50), nodo('f', 'no_salio', 60),
  ];
  assert.deepEqual(porRevisar(nodos).map((n) => n.id), ['b', 'c', 'a'], 'lo terminado con y sin página, lo más nuevo arriba; lo demás no');
  // El número de la sub-tab es `porRevisar(...).length` y el «hechos» del encabezado del Plan: dicen lo mismo.
  assert.equal(porRevisar(nodos).length, conteoAvance(nodos).hechos, 'el número cuenta todo lo de la lista');
  assert.deepEqual(porRevisar(nodos.filter((n) => n.estado !== 'hecho')), [], 'sin nada terminado, la lista queda vacía («Nada para revisar todavía»)');
  assert.deepEqual(porRevisar([]), []);
});

test('la tab del jefe: el nombre de la barra, sin mayúsculas ni tildes, y la del producto antes que la de desarrollo', () => {
  assert.equal(rutaDeLaTab('CRM', TABS), '/crm', 'no /admin/dev/crm: ese nombre se repite en la barra del super admin');
  assert.equal(rutaDeLaTab('Dashboard', TABS), '/dashboard');
  assert.equal(rutaDeLaTab('Second Brain', TABS), '/second-brain');
  assert.equal(rutaDeLaTab('  second   BRAIN ', TABS), '/second-brain', 'misma comparación que las secciones del Centro');
  // Con el orden al revés, la de desarrollo ganaría: por eso el orden va contado en la función y en la pantalla.
  assert.equal(rutaDeLaTab('CRM', [...TABS].reverse()), '/admin/dev/crm');
  // Lo que no es una tab de la barra no tiene ruta: el título que inventó la app, el orquestador, un área del producto
  // sin tab propia («Closing Analyst», «Puente a Google Flow»: nombres válidos de jefe, pero sin pantalla), vacío.
  for (const jefe of ['dashboard-marketing-7d', 'Sin asignar', 'Cerebro', 'Closing Analyst', 'Puente a Google Flow', '', '   ']) assert.equal(rutaDeLaTab(jefe, TABS), null, `«${jefe}»`);
  // Sólo una ruta interna de MaKo.
  assert.equal(rutaDeLaTab('X', [{ label: 'X', href: 'https://evil.com' }]), null);
  assert.equal(rutaDeLaTab('X', [{ label: 'X', href: '//evil.com' }]), null);
  assert.equal(rutaDeLaTab('X', [{ label: 'X', href: '/ok' }]), '/ok');
  // Toda tab de la barra tiene a dónde llevar: un chat jefe con su nombre nunca queda sin botón por una ruta vacía.
  for (const i of TABS) assert.ok(rutaDeLaTab(i.label, TABS)?.startsWith('/'), `«${i.label}»`);
});

test('«Revisar»: con página propia igual que siempre; sin ella, la tab del jefe (también el sub-chat); sin tab, sin botón', () => {
  const chatDe = (titulo: string) => ({ clave: `nombre:${titulo.toLowerCase()}`, sesion: S(9), titulo });
  const con = nodo('c', 'hecho', 1, { pagina: '/crm?lead=12', sesion: S(2) });
  const sin = nodo('s', 'hecho', 2);
  // Con página propia: la misma que `hrefRevisar` (el visor si existe, la página si no), aunque el jefe sea una tab.
  const propio = destinoDeReview(con, chatDe('CRM'), TABS);
  assert.equal(propio?.href, hrefRevisar(con, chatDe('CRM')));
  assert.equal(propio?.via, VISOR_REVISAR ? 'visor' : 'pagina');
  // Sin página: la tab del jefe, para el jefe y para un sub-chat suyo («CRM › Lead Detail» o «CRM > Funnels»).
  assert.deepEqual(destinoDeReview(sin, chatDe('CRM'), TABS), { href: '/crm', via: 'tab' });
  assert.deepEqual(destinoDeReview(sin, chatDe('CRM › Lead Detail'), TABS), { href: '/crm', via: 'tab' }, 'el jefe de «CRM › Lead Detail» es CRM');
  assert.deepEqual(destinoDeReview(sin, chatDe('Second Brain > Memoria'), TABS), { href: '/second-brain', via: 'tab' });
  // Sin página y sin tab (un chat «Sin asignar»), o sin saber el chat: no hay link, la fila se ve igual.
  assert.equal(destinoDeReview(sin, chatDe('dashboard-marketing-7d'), TABS), null);
  assert.equal(destinoDeReview(sin, chatDe('Cerebro'), TABS), null);
  assert.equal(destinoDeReview(sin, undefined, TABS), null);
  // Sin el chat, la página propia sigue abriéndose como página.
  assert.deepEqual(destinoDeReview(con, undefined, TABS), { href: '/crm?lead=12', via: 'pagina' });
});

test('la pantalla de Review arma las tabs en el mismo orden que tabs.ts y no vuelve a pedir «con página»', () => {
  const orden = '[...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV]';
  assert.ok(readFileSync('app/admin/operaciones/Avance.tsx', 'utf8').includes(orden), 'Avance.tsx: la tab del producto primero');
  assert.ok(readFileSync('app/admin/operaciones/tabs.ts', 'utf8').includes(orden), 'tabs.ts: el orden que Avance.tsx copia');
  // La lista y el número salen de `porRevisar` (la que prueba el caso de arriba): la pantalla no filtra por su cuenta.
  const pantalla = readFileSync('app/admin/operaciones/Avance.tsx', 'utf8');
  assert.ok(pantalla.includes('destinoDeReview(n, chat, TABS_DEL_MENU)'), 'cada fila usa destinoDeReview');
  assert.ok(!/porRevisar\([^)]*\)\s*\.filter/.test(pantalla), 'la pantalla no filtra lo que porRevisar ya da');
});
