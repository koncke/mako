// =============================================================================
// Desde el Ops Center: compartir tu Dashboard con un link, exportar una hoja a CSV y mover una tarjeta (2.6)
// =============================================================================
// Ops Center = lo principal (20/10/2026, docs/ops-center-principal.md, pieza 2.6): las tres cosas se hacían sólo en la
// pantalla. Ahora están en el registro de la API de MaKo:
//   · compartir_dashboard: el MISMO share que «Compartir» (lib/shares.ts), sobre el informe de quien chatea, con la
//     tarjeta del chat. Invitar por email espera la decisión D3c.
//   · exportar_hoja_dashboard: una lectura que deja el link a app/api/graficos/exportar, que corre leer_hoja_dashboard
//     en CSV por el choke point con la sesión de quien lo abre.
//   · mover_componente_dashboard: con la grilla de la pantalla (react-grid-layout/core, lib/graficos-mover.ts).
// Lo que se puede romper sin que se vea: que mover reacomode distinto que la pantalla, que una tarjeta se achique por
// debajo de su mínimo, que se pueda compartir el informe de OTRA persona, que el link pase por el modelo, que exportar
// arme su propio CSV, y que la ruta de descarga lea el informe de alguien que no es quien la abre.
//
// Correr: node --import tsx --test tests/api-mako-dashboard-compartir-exportar-mover.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (20/10/2026, base 6/0): mover sin la librería de la grilla (el lugar pedido tal cual, sin
// correr a las demás) → 3 / 3; el ancho sin el mínimo → 5 / 1; compartir leyendo `persona` → 5 / 1; el link de
// compartir en el `resumen` (lo leería el modelo) → 5 / 1; la ruta de exportar sin `quien` → 5 / 1; exportar sólo-app
// abierto a WhatsApp → 5 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moverComponente, ANCHOS } from '../lib/graficos-mover';
import { aplicarCambio } from '../lib/api-mako/areas/dashboard.helpers';
import { porId } from '../lib/api-mako/registro';
import type { Componente, Grafico, Tablero } from '../lib/graficos-catalogo';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

const g = (id: string, x: number, y: number, w: number, h: number): Componente =>
  ({ clase: 'grafico', id, x, y, w, h, tipo: 'barras', fuente: 'leads', metricas: ['leads'], dimension: null, desglose: null, controles: [] }) as unknown as Grafico;
const lugar = (cs: Componente[]) => Object.fromEntries(cs.map((c) => [c.id, [c.x, c.y, c.w, c.h]]));

test('mover: como al arrastrar en la pantalla, las demás tarjetas se corren y lo de arriba sube', () => {
  const hoja = [g('a', 0, 0, 6, 3), g('b', 6, 0, 6, 3), g('c', 0, 3, 12, 4)];
  const arriba = moverComponente(hoja, 'c', { lugar: 'arriba' });
  assert.ok(arriba.ok);
  assert.deepEqual(lugar(arriba.componentes), { a: [0, 4, 6, 3], b: [6, 4, 6, 3], c: [0, 0, 12, 4] });
  // Al lado de otra, si entran las dos en la fila; si no, lo dice (no lo deja encimado).
  const chica = [g('a', 0, 0, 6, 3), g('b', 0, 3, 6, 3)];
  const lado = moverComponente(chica, 'b', { lugar: 'al_lado_de', referencia: 'a' });
  assert.ok(lado.ok);
  assert.deepEqual(lugar(lado.componentes), { a: [0, 0, 6, 3], b: [6, 0, 6, 3] });
  const noEntra = moverComponente(hoja, 'c', { lugar: 'al_lado_de', referencia: 'a' });
  assert.equal(noEntra.ok, false);
  assert.match((noEntra as { error: string }).error, /No entran las dos en la misma fila/);
  // Lo que ya está así no se propone.
  assert.equal((moverComponente(hoja, 'a', { lugar: 'arriba' }) as { yaEstaba?: true }).yaEstaba, true);
});

test('el ancho: en palabras, sin bajar del mínimo de la grilla (el mismo del editor)', () => {
  assert.deepEqual(ANCHOS, { completo: 12, dos_tercios: 8, mitad: 6, tercio: 4, cuarto: 3 });
  // Una sección va siempre a lo ancho (su mínimo es 12): «a la mitad» no la achica.
  const elemento = (tipo: string, id: string, w: number, h: number) => ({ clase: 'elemento', id, tipo, texto: '', x: 0, y: 0, w, h }) as unknown as Componente;
  const seccion = elemento('seccion', 's', 12, 2);
  const r = moverComponente([seccion, g('a', 0, 2, 6, 3)], 's', { ancho: 'mitad' });
  assert.equal(r.ok, false, 'la sección ya está en su mínimo: nada cambia');
  const exp = elemento('experimento', 'e', 6, 9);
  const r1 = moverComponente([exp], 'e', { ancho: 'cuarto' });
  assert.ok(r1.ok);
  assert.equal(r1.componentes[0].w, 4, 'un experimento no baja de 4 columnas (el cuarto son 3)');
  const r2 = moverComponente([g('a', 0, 0, 12, 3)], 'a', { ancho: 'mitad' });
  assert.ok(r2.ok);
  assert.deepEqual(lugar(r2.componentes), { a: [0, 0, 6, 3] });
  // La grilla es la de la pantalla: la misma librería y el mismo compactador, y el mismo mínimo.
  const mover = leer('lib/graficos-mover.ts');
  assert.match(mover, /from 'react-grid-layout\/core'/);
  assert.match(mover, /moveElement\(layout, item, x, y, true, false, 'vertical', COLS\)/);
  assert.match(mover, /verticalCompactor\.compact\(movido, COLS\)/);
  assert.match(mover, /minimoDeComponente\(/);
  assert.match(leer('app/dashboard/EditorInforme.tsx'), /compactor=\{verticalCompactor\}/);
});

test('mover es un cambio del informe: se aplica con el compare-and-set de siempre', () => {
  const t = { version: 5, hojas: [{ id: 'h1', nombre: 'Marketing', emoji: '📊', subtitulo: '', controles: [], componentes: [g('a', 0, 0, 6, 3), g('b', 0, 3, 12, 3)], tema: {} }] } as unknown as Tablero;
  const r = aplicarCambio(t, { op: 'mover_componente', hojaId: 'h1', componenteId: 'b', movida: { lugar: 'arriba' } });
  assert.ok(r.ok);
  assert.deepEqual(lugar(r.tablero.hojas[0].componentes), { a: [0, 3, 6, 3], b: [0, 0, 12, 3] });
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  assert.match(run, /mover_componente_dashboard: \{\s*preparar: \(input, ctx\) => proponer\(input, ctx, \(r\) => \{/);
  assert.match(run, /const prueba = moverComponente\(h\.componentes, c\.id, movida\);/, 'se prueba antes de proponer');
});

test('las tres están en el registro, con su confirmación y sus canales', () => {
  const compartir = porId('compartir_dashboard');
  const exportar = porId('exportar_hoja_dashboard');
  const mover = porId('mover_componente_dashboard');
  assert.ok(compartir && exportar && mover);
  assert.deepEqual([compartir.tipo, (compartir as { confirmacion?: string }).confirmacion, [...compartir.canales]], ['accion', 'chat', ['app']]);
  assert.deepEqual([exportar.tipo, [...exportar.canales]], ['lectura', ['app']], 'el link pide la sesión de quien lo abre');
  assert.deepEqual([mover.tipo, (mover as { confirmacion?: string }).confirmacion], ['accion', 'chat']);
  assert.ok(!compartir.parametros.some((p) => p.nombre === 'persona'), 'compartir es sólo de TU informe');
});

test('compartir: el informe de quien chatea, con el mismo share de la pantalla, y el link por fuera del modelo', () => {
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  const c = run.slice(run.indexOf('compartir_dashboard: {'), run.indexOf('copiar_dashboard: {'));
  assert.match(c, /const yo = quienChatea\(ctx\);/);
  assert.doesNotMatch(c, /str\(input, 'persona'\)|resolver\(/, 'no se elige otra persona');
  assert.match(c, /crearShare\(\{ ws: ctx\.ws, recurso: RECURSO_INFORME, alcance: 'item', recursoId: sub, modo: 'link',/);
  assert.match(c, /paraLaPersona: `Link para ver \$\{comillas\(nombre \?\? 'tu informe'\)\}: \$\{enlace\}/);
  assert.doesNotMatch(c, /resumen: `[^`]*\$\{enlace\}/, 'el link no va en lo que lee el modelo');
});

test('exportar: el link va a una ruta que corre leer_hoja_dashboard en CSV con la sesión de quien la abre', () => {
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  const e = run.slice(run.indexOf('exportar_hoja_dashboard: {'), run.indexOf('compartir_dashboard: {'));
  assert.match(e, /linkPantalla\(`\/api\/graficos\/exportar\?hoja=\$\{encodeURIComponent\(hoja\.id\)\}`, ctx\.ws\)/);
  assert.match(e, /paraLaPersona: `Descargar/);
  const ruta = leer('app/api/graficos/exportar/route.ts');
  assert.match(ruta, /if \(!sesion \|\| !rolWs\) return err\(401, 'no autenticado'\);/);
  assert.match(ruta, /const ws = await getWorkspaceActual\(\);/);
  assert.match(ruta, /quien: \{ sub, email: \(sesion\.email \?\? ''\)\.toLowerCase\(\), nombre: sesion\.nombre \?\? '' \}/);
  assert.match(ruta, /ejecutarOperacion\('leer_hoja_dashboard', \{ hoja \}, ctx, 'query'\)/);
  assert.match(ruta, /formato: 'csv'/);
  assert.doesNotMatch(ruta, /csvDeHoja|datosDeGraficos/, 'la ruta no arma su propio CSV');
});
