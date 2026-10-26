// =============================================================================
// Second Brain — punto 13b del feedback del 17/10/2026: la CONSTRUCCIÓN DE MAKO como segunda capa del super admin
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · lib/cerebro-construccion.ts arma un nodo por área con bitácora, sus últimos hitos (con tope por área), los chats
//     jefe que anotaron dos hitos o más en 14 días, y las aristas que se explican: hito → área y → su chat, jefe → cada
//     área donde anotó, área ↔ área cuando comparten dos archivos o más que no están en todas;
//   · el racimo de una familia es de sus ÁREAS (con los hitos adentro el hub daba 14,8× contra 4,5×, medido con el
//     registro real);
//   · la fecha de un hito sale en la hora de Argentina con su desfase (la fecha corta dice el día de la bitácora);
//   · el grafo trae su taxonomía y el componente la usa: color, racimo y filtro (pasaFiltro con la taxonomía);
//   · sólo quien OPERA recibe la capa (la guarda del Centro), y la construcción no se edita ni se exporta;
//   · /admin/dev lleva al grafo y MapaAreas.tsx se fue; el teléfono tiene el mismo selector.
//
// Verificado ROMPIÉNDOLO (17/10/2026), cada rotura contra la base en verde (8 / 0) y restaurando después:
//   · los hitos de vuelta en el racimo de su familia (`dev:` → `dev:|hito:` en los miembros): 7 / 1.
//   · un chat jefe con UN solo hito (sin el tope `hitosJefe`): 7 / 1.
//   · «comparten código» con un solo archivo en común (`>= 2` → `>= 1`): 7 / 1.
//   · `isoDeHito` en UTC (sin el desfase de Argentina): 7 / 1.
//   · `pasaFiltro` ignorando la taxonomía (con AREAS del negocio): 7 / 1.
//   · la capa armada para todos (sin `opera ?`): 7 / 1.
//   · el grafo de la construcción con «Exportar» (el slot `accion`): 7 / 1.
//   · /admin/dev mostrando otra vez la barra (sin el redirect): 7 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { armarConstruccion, isoDeHito, TAXONOMIA_CONSTRUCCION, TOPES_CONSTRUCCION, type AreaDeObra } from '../lib/cerebro-construccion';
import { pasaFiltro, filtroVacio } from '../lib/cerebro-filtro';
import { rellenoNodo } from '../lib/cerebro-areas';
import type { HitoP } from '../lib/progreso-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const AHORA = Date.parse('2026-10-17T12:00:00Z');
const hito = (fecha: string, hora: string, chat: string, titulo: string, extra: Partial<HitoP> = {}): HitoP => ({
  fecha, hora, chat, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion', titulo, puntos: [`**${titulo}**: lo que pasó`], ...extra,
});
const AREAS: AreaDeObra[] = [
  { slug: 'crm', titulo: 'CRM', familia: 'Sales Machine', estado: 'parcial', alcance: 'El tablero de leads.', nota: 'stageMeta miente', verEnApp: '/crm', vive: ['app/crm/a.tsx', 'lib/leads.ts', 'lib/comun.ts', 'lib/workspace.ts'],
    partes: [{ titulo: 'Ficha', detalle: '', estado: 'hecha' }, { titulo: 'Bandeja', detalle: '', estado: 'sigue' }],
    bitacora: [hito('1 sep', '10:00', 'CRM', 'viejo'), hito('15 oct', '10:00', 'CRM', 'uno'), hito('16 oct', '10:00', 'CRM', 'dos'), hito('17 oct', '03:47', 'CRM', 'tres', { revisar: '/crm' })] },
  { slug: 'pagos', titulo: 'Pagos', familia: 'Business', estado: 'listo', alcance: 'Cobros.', vive: ['app/pagos/b.tsx', 'lib/leads.ts', 'lib/comun.ts', 'lib/workspace.ts'],
    partes: [], bitacora: [hito('16 oct', '22:30', 'Pagos', 'cobro'), hito('17 oct', '01:00', 'Solito', 'una vez')] },
  { slug: 'mobile', titulo: 'MaKo Mobile', familia: 'Operate', estado: 'parcial', alcance: 'El teléfono.', vive: ['app/m/x.tsx', 'lib/leads.ts', 'lib/workspace.ts'],
    partes: [], bitacora: [hito('17 oct', '02:00', 'Pagos', 'teléfono de pagos')] },
  // Tres áreas más para que lib/workspace.ts esté «en todas» (no cuenta como código compartido).
  ...['a', 'b', 'c', 'd'].map((s) => ({ slug: s, titulo: s, familia: 'Infra', estado: 'listo', alcance: '', vive: ['lib/workspace.ts'], partes: [], bitacora: [] })),
];

const armar = () => {
  const c = armarConstruccion(AREAS, AHORA);
  return { ...c, porId: new Map(c.nodos.map((n) => [n.id, n])) };
};

test('13b · las áreas, sus últimos hitos y los chats jefe, con sus aristas', () => {
  const { nodos, aristas, porId, taxonomia, negocio } = armar();
  assert.equal(negocio, 'Construcción de MaKo');
  assert.equal(taxonomia, TAXONOMIA_CONSTRUCCION, 'el grafo trae su taxonomía');
  assert.equal(porId.get('raiz')!.etiqueta, 'MaKo');
  const crm = porId.get('dev:crm')!;
  assert.equal(crm.area, 'sales-machine');
  assert.equal(crm.href, '/crm', 'el área abre su tab: la página de su bitácora (/admin/dev/crm) se fue con Dev');
  assert.equal(porId.get('dev:pagos')!.href, undefined, 'sin página propia, el nodo no abre nada (nunca un link muerto)');
  assert.ok((crm.datos ?? []).some((d) => d.k === 'Partes' && d.v === '1 hechas · 1 siguen · 0 en cola'));
  const hitosCrm = nodos.filter((n) => n.id.startsWith('hito:crm:'));
  assert.equal(hitosCrm.length, TOPES_CONSTRUCCION.hitosPorArea, 'los últimos de cada área, con tope');
  assert.ok(!porId.has('hito:crm:0'), 'el viejo no entra');
  assert.equal(porId.get('hito:crm:3')!.href, '/crm', 'el «Revisar» del hito');
  assert.ok(porId.has('jefe:crm') && porId.has('jefe:pagos'), 'los jefes con dos hitos o más en 14 días');
  assert.ok(!porId.has('jefe:solito'), 'un chat con UN hito no es un jefe del mapa');
  const e = (de: string, a: string) => aristas.find((x) => x.de === de && x.a === a);
  assert.ok(e('hito:crm:3', 'dev:crm') && e('hito:crm:3', 'jefe:crm'), 'el hito, con su área y su chat');
  assert.match(e('jefe:pagos', 'dev:mobile')?.motivo ?? '', /Este chat trabaja en esta área: 1 hito/);
  const ids = new Set(nodos.map((n) => n.id));
  for (const a of aristas) assert.ok(ids.has(a.de) && ids.has(a.a), `${a.de} → ${a.a}`);
});

test('13b · comparten código: dos archivos o más que no están en todas', () => {
  const { aristas } = armar();
  const comparten = aristas.filter((a) => a.motivo.startsWith('Comparten'));
  assert.deepEqual(comparten.map((a) => `${a.de}|${a.a}`), ['dev:crm|dev:pagos'], 'crm y pagos comparten leads.ts y comun.ts; mobile sólo leads.ts');
  assert.ok(!comparten.some((a) => a.motivo.includes('workspace.ts')), 'lo que está en todas no dice nada');
});

test('13b · el racimo de una familia es de sus áreas, no de los hitos', () => {
  const { aristas } = armar();
  const alRacimo = aristas.filter((a) => a.a.startsWith('area:')).map((a) => a.de);
  assert.ok(alRacimo.length > 0 && alRacimo.every((id) => id.startsWith('dev:')), alRacimo.join(', '));
});

test('13b · la fecha de un hito, en la hora de Argentina', () => {
  assert.equal(isoDeHito('16 oct', '22:30', AHORA), '2026-10-16T22:30:00-03:00', 'el día de la bitácora, no el del UTC');
  assert.equal(isoDeHito('nada', '10:00', AHORA), null);
});

test('13b · el componente usa la taxonomía del grafo: color y filtro', () => {
  const { porId } = armar();
  const crm = porId.get('dev:crm')!;
  assert.equal(rellenoNodo(crm, TAXONOMIA_CONSTRUCCION), 'var(--grafo-oferta)');
  const f = filtroVacio();
  f.carpetas.add('producto');
  assert.equal(pasaFiltro(crm, f, TAXONOMIA_CONSTRUCCION), true, 'Sales Machine es parte de Producto');
  assert.equal(pasaFiltro(porId.get('dev:pagos')!, f, TAXONOMIA_CONSTRUCCION), false, 'Business no');
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  assert.match(g, /const tax = cerebro\.taxonomia \?\? TAXONOMIA_NEGOCIO;/);
  assert.match(g, /pasaFiltro\(n, filtro, tax\)/);
  assert.match(g, /<FiltroMapa[\s\S]*?tax=\{tax\}/, 'el filtro conoce la taxonomía del grafo: las dos capas del super admin');
});

test('13b · sólo quien opera recibe la capa, y la construcción no se edita ni se exporta', () => {
  // 20/10/2026: la guarda y el cerebro que se dibuja viven en lib/second-brain-opera.ts (la usa también el grafo vivo).
  const p = sinComentarios(leer('lib/second-brain-opera.ts'));
  assert.match(p, /\(opera \?\? await quienOpera\(\)\) \? cerebroUnido\(negocio, construccionDeMako\(\)\) : negocio;/);
  // La guarda del Centro, tal cual, y desde el 18/10/2026 nunca mirando a un cliente (tests/second-brain-mirando-cliente.test.ts).
  assert.match(p, /if \(await estaImpersonando\(\)\) return false;\s*return puedeOperar\(await getSesionAdmin\(\), await wsSuperAdmin\(\)\);/, 'la guarda del Centro, tal cual');
  const v = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  // 17/10/2026: ya no hay un segundo grafo, sino UNO con las dos capas (lib/cerebro-union.ts).
  assert.equal((v.match(/<Grafo\b/g) ?? []).length, 1, 'un solo grafo');
  assert.match(v, /tax \? filtroDelNegocio\(filtro, tax\) : filtro/, '«Exportar» baja sólo el negocio');
  const m = sinComentarios(leer('app/m/second-brain/mapa/page.tsx'));
  assert.match(m, /grafo = await cerebroQueSeDibuja\(cerebro\);/, 'el teléfono, con la misma guarda y el mismo cerebro');
  assert.match(leer('lib/cerebro-construccion-datos.ts'), /^import 'server-only';/m);
});

test('13b · /admin/dev se fue (25/10/2026) y redirige al Ops Center; el mapa de áreas no vuelve', () => {
  assert.ok(!existsSync(join(RAIZ, 'app/admin/dev/MapaAreas.tsx')));
  assert.ok(!existsSync(join(RAIZ, 'app/admin/dev/page.tsx')), 'volvió la pantalla de Dev');
  assert.match(leer('next.config.ts'), /\{ source: '\/admin\/dev', destination: '\/admin\/operaciones', permanent: false \}/);
});

test('13b · `?capa=construccion` abre el mapa único ya filtrado a esa capa', () => {
  const v = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.match(v, /conObra && tax && params\?\.get\('capa'\) === CAPA_CONSTRUCCION \? filtroDeCapa\(filtroVacio\(\), tax, CAPA_CONSTRUCCION\)/);
});
