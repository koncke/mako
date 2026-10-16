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

import test from 'node:test';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { rutaParaRevisar, sanearCierres } from '../lib/operaciones-reglas';
import { esHrefInterno } from '../app/admin/runway/decisiones';
import { VISOR_REVISAR, avanceDelChat, enlaceRevisar, hrefRevisar, porRevisar, type LineaChat, type TrabajoP } from '../lib/centro-chats';
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

test('el nodo y el link: lo terminado con página va a «Review», con la sesión que lo hizo', () => {
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
  assert.deepEqual(r.map((n) => n.id), ['t:t1', 'p:crm:4'], 'lo terminado con página, lo más nuevo arriba; lo entregado sin cierre todavía no');
  assert.deepEqual(r[0].revisar, { pagina: '/crm?lead=12', sesion: S(2) }, 'un trabajo: la sesión a la que se mandó');
  assert.deepEqual(r[1].revisar, { pagina: '/crm?vista=funnel', sesion: S(3) }, 'un pedido: la del paso que la dejó');
  const link = enlaceRevisar(r[0], { clave: 'nombre:crm', sesion: S(9) })!;
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
