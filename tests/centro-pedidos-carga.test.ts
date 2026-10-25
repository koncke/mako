// =============================================================================
// La carga del Ops Center sin la historia entera de pedidos (23/10/2026)
// =============================================================================
// Medido: /admin/operaciones mandaba en CADA carga los 455 pedidos de todas las fechas (733 KB); lo sin terminar eran 21
// (16 KB). Lo terminado sólo se dibuja en la conversación de su chat, así que viaja lo sin terminar y lo terminado reciente,
// y lo viejo de un chat se pide al abrirlo. La lista sigue armándose con TODOS (Martín, 16/10: «traer mayor historial»).
//
// Correr: node --import tsx --test tests/centro-pedidos-carga.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIAS_EN_LA_CARGA, pedidosDeLaCarga, pedidosQueFaltan, type PedidoP } from '../lib/progreso-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const DIA = 86_400_000;
const AHORA = Date.UTC(2026, 9, 23, 18);
const pedido = (id: string, estado: PedidoP['estado'], hace: number): PedidoP => ({
  id, texto: id, titulo: id, instante: AHORA - hace, areas: ['ops'], tomo: null, estado, pasos: [], commits: [], junto: 0,
  ultimo: AHORA - hace, cierre: null, pidioEn: { chat: 'Ops Center', sesion: null },
});

test('1. viaja lo sin terminar (de cualquier fecha) y lo terminado de los últimos días; lo viejo terminado no', () => {
  const todos = [
    pedido('pendiente-viejo', 'pendiente', 60 * DIA),
    pedido('en-curso-viejo', 'en_curso', 30 * DIA),
    pedido('hecho-hoy', 'hecho', DIA / 2),
    pedido('hecho-borde', 'hecho', DIAS_EN_LA_CARGA * DIA),
    pedido('hecho-viejo', 'hecho', DIAS_EN_LA_CARGA * DIA + 1),
    pedido('hecho-muy-viejo', 'hecho', 200 * DIA),
  ];
  assert.deepEqual(pedidosDeLaCarga(todos, AHORA).map((p) => p.id), ['pendiente-viejo', 'en-curso-viejo', 'hecho-hoy', 'hecho-borde']);
});

test('2. al abrir un chat se piden sólo los suyos que faltan', () => {
  const tengo = new Set(['a', 'b']);
  assert.deepEqual(pedidosQueFaltan(['a', 'c', 'b', 'd'], tengo), ['c', 'd']);
  assert.deepEqual(pedidosQueFaltan([], tengo), []);
});

test('3. las páginas mandan la carga liviana, la lista se arma con todos, y el motor pide lo que falta al abrir un chat', () => {
  for (const f of ['app/admin/operaciones/datos.ts', 'app/m/operaciones/page.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /base: chatsDeBitacoras\(\{ areas, pedidos, ahora, dias: DIAS_HISTORIAL \}\)/, `${f}: la lista, con TODOS`);
    assert.match(src, /pedidos: pedidosDeLaCarga\(pedidos, ahora\),/, `${f}: a la pantalla, la carga liviana`);
  }
  const motor = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  assert.match(motor, /const faltan = pedidosQueFaltan\(c\.pedidos,/, 'al abrir un chat (mirar)');
  assert.match(motor, /leerCentro<.*?>\('trabajos', \{ id: faltan \}\)/, 'por GET, que no hace cola');
  const acc = sinComentarios(leer('app/admin/operaciones/acciones.ts'));
  const cuerpo = acc.slice(acc.indexOf('export async function pedidosDelChatAction('), acc.indexOf('export async function pushesCentroAction('));
  assert.match(cuerpo, /if \(!puedeOperar\(admin, await wsSuperAdmin\(\)\)\) return \{ ok: false, error: NO_PUEDE \};/, 'sólo quien opera');
  assert.match(cuerpo, /\.slice\(0, TOPE_PEDIDOS_POR_LECTURA\)/, 'con tope');
  assert.match(sinComentarios(leer('app/api/operaciones/lectura/route.ts')), /trabajos: \(req\) => pedidosDelChatAction\(req\.nextUrl\.searchParams\.getAll\('id'\)\),/);
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 3/0):
//   · `pedidosDeLaCarga` devolviendo todos                     → 2/1 (1)
//   · datos.ts mandando `pedidos,` entero otra vez             → 2/1 (3)
//   · la acción sin la guarda de `puedeOperar`                 → 2/1 (3)
