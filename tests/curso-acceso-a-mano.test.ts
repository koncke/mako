// =============================================================================
// El acceso dado a mano (mig 0331, 23/10/2026): el link de una invitación del buscador abre sin Ganado
// =============================================================================
// Pedido (el Cerebro, 23/10/2026, sobre lo que reportó Martín): «el link de una invitación explícita ABRA aunque el lead
// no esté en Ganado: que resolverAcceso acepte el acceso dado a mano. No alcanza con cambiar el texto del mail. Cortar
// sigue cortando igual».
//
// La causa: invitar desde el buscador «en cualquier etapa» (13/10/2026) levantaba las guardas AL ESCRIBIR (creaba el
// acceso y mandaba el mail) y no dejaba nada que la puerta de LECTURA reconociera: `resolverAcceso` exige Ganado. La
// regla que queda: un permiso que levanta una guarda al escribir deja una marca que la guarda de lectura reconoce.
//
// Decisiones del Cerebro (23/10/2026): el permiso sobrevive a Perdido y a un reembolso (se corta a mano desde el
// buscador), y estos alumnos no reciben los WhatsApp del curso.
//
// Lo que se fija acá: las reglas puras (lib/curso-invitar-reglas.ts), ejecutadas; y sobre el fuente, que la puerta de
// lectura acepta el permiso SÓLO sin Ganado y con la versión en el WHERE, que el líder sigue exigiendo Ganado, que la
// marca la escribe UN solo lugar, y que el buscador puede cortarla y volver a habilitarla.
//
// PROBADO ROMPIÉNDOLO: ver el bloque al final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  saneaAMano, aManoVigente, abrePorPermiso, necesitaPermiso, aManoTrasDar, productosQueVe, productosVisibles,
  faltaColumnaAMano, estadoEnBuscador,
} from '../lib/curso-invitar-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El tramo de `src` desde `ini` hasta `fin` (el cierre real del bloque, nunca un largo a ojo). */
function bloque(src: string, ini: string, fin: string): string {
  const i = src.indexOf(ini);
  assert.ok(i >= 0, `no encontré «${ini}»`);
  const j = src.indexOf(fin, i + ini.length);
  assert.ok(j > i, `no encontré el cierre «${fin}» de «${ini}»`);
  return src.slice(i, j);
}

const DATOS = sinComentarios(leer('lib/curso-datos.ts'));
const NUCLEO = sinComentarios(leer('lib/curso-invitar.ts'));
const ACC = sinComentarios(leer('app/customer-success/curso/invitar-actions.ts'));

// ── Las reglas puras, ejecutadas ─────────────────────────────────────────────

test('saneaAMano: al revés que productos, lo ilegible es NINGUNO', () => {
  assert.deepEqual(saneaAMano(null), []);
  assert.deepEqual(saneaAMano(undefined), []);
  assert.deepEqual(saneaAMano('x'), []);
  assert.deepEqual(saneaAMano({}), []);
  assert.deepEqual(saneaAMano(['39', 39, 0, -1]), [39]);
  assert.deepEqual(saneaAMano('{10,39}'), [10, 39]);
});

test('aManoVigente y abrePorPermiso: abre sólo lo que su acceso también abre', () => {
  assert.deepEqual(aManoVigente(null, [39]), [39]);
  assert.deepEqual(aManoVigente([10], [39]), [], 'le sacaron el curso de productos y el permiso siguió abriendo');
  assert.equal(abrePorPermiso(null), false, 'sin fila vigente (o sin la columna) abrió');
  assert.equal(abrePorPermiso({ abre: null, aMano: [] }), false, 'sin nada a mano abrió');
  assert.equal(abrePorPermiso({ abre: [10], aMano: [39] }), false);
  assert.equal(abrePorPermiso({ abre: [39], aMano: [39] }), true);
});

test('necesitaPermiso: sólo quien no entra por la venta', () => {
  assert.equal(necesitaPermiso({ ganado: false, esCliente: false }), true);
  assert.equal(necesitaPermiso({ ganado: false, esCliente: true }), true);
  assert.equal(necesitaPermiso({ ganado: true, esCliente: false }), true, 'un ganado de OTRO producto no entra por la venta');
  assert.equal(necesitaPermiso({ ganado: true, esCliente: true }), false, 'le dejó un permiso a quien ya entra por la venta');
});

test('aManoTrasDar: suma, no repite, topea y no acepta un id malo', () => {
  assert.deepEqual(aManoTrasDar([], 39), [39]);
  assert.deepEqual(aManoTrasDar([39], 39), [39]);
  assert.deepEqual(aManoTrasDar([10], 39), [10, 39], 'reemplazó en vez de sumar: le sacó el curso de antes');
  const lleno = Array.from({ length: 200 }, (_, i) => i + 1);
  assert.equal(aManoTrasDar(lleno, 999).length, 200);
  assert.deepEqual(aManoTrasDar([10], -3), [10]);
});

test('productosQueVe: sin permiso es lo de siempre; con permiso, sin Ganado ve SÓLO lo dado a mano', () => {
  const ofrecidos = [10, 39, 50, 77];
  const suyos = [10, 39, 50];
  // (1) Sin nada a mano: idéntico a productosVisibles, byte a byte.
  for (const abre of [null, [39], [50, 10]] as const) {
    assert.deepEqual(productosQueVe({ porVenta: true, deCliente: suyos, ofrecidos, abre, aMano: [] }), productosVisibles(suyos, abre));
  }
  // (2) Ganado de [10] con [77] a mano: los dos, en el orden del catálogo.
  assert.deepEqual(productosQueVe({ porVenta: true, deCliente: [10], ofrecidos, abre: null, aMano: [77] }), [10, 77]);
  // (3) Ya no está en Ganado, con su casa en [10] y [77] a mano: sólo [77] (nunca lo que tuvo de cliente).
  assert.deepEqual(productosQueVe({ porVenta: false, deCliente: [10], ofrecidos, abre: null, aMano: [77] }), [77],
    'un ex cliente con un curso a mano volvió a ver lo que compró');
  // (4) El permiso que su acceso ya no abre no cuenta.
  assert.deepEqual(productosQueVe({ porVenta: false, deCliente: [10], ofrecidos, abre: [10], aMano: [77] }), []);
  // (5) Un producto que el negocio ya no ofrece no se ve.
  assert.deepEqual(productosQueVe({ porVenta: false, deCliente: [], ofrecidos: [10, 39], abre: null, aMano: [88] }), []);
});

test('faltaColumnaAMano: la columna de la 0331, por código o por mensaje, y nada más', () => {
  assert.equal(faltaColumnaAMano({ code: '42703', message: 'column curso_accesos.productos_a_mano does not exist' }), true);
  assert.equal(faltaColumnaAMano({ code: 'PGRST204', message: "Could not find the 'productos_a_mano' column of 'curso_accesos' in the schema cache" }), true);
  // `leerTodo` pierde el código: el mensaje alcanza.
  assert.equal(faltaColumnaAMano({ message: 'column curso_accesos.productos_a_mano does not exist' }), true);
  assert.equal(faltaColumnaAMano({ code: '42703', message: 'column curso_accesos.otra does not exist' }), false);
  assert.equal(faltaColumnaAMano({ code: '57014', message: 'canceling statement due to statement timeout' }), false);
  assert.equal(faltaColumnaAMano(null), false);
});

test('estadoEnBuscador: un invitado sin Ganado ni permiso vuelve a «invitar» (su link no abría)', () => {
  const base = { productoId: 39, ganado: false };
  assert.equal(estadoEnBuscador({ ...base, acceso: null, aMano: [] }), 'invitar');
  assert.equal(estadoEnBuscador({ ...base, acceso: { cortado: true, productos: [39], invitacionEnviadaAt: 'x' }, aMano: [39] }), 'cortado');
  assert.equal(estadoEnBuscador({ ...base, acceso: { cortado: false, productos: [39], invitacionEnviadaAt: 'x' }, aMano: [39] }), 'dado-a-mano');
  assert.equal(estadoEnBuscador({ ...base, acceso: { cortado: false, productos: [39], invitacionEnviadaAt: 'x' }, aMano: [] }), 'invitar',
    'el invitado del 13/10 sin Ganado ni permiso figura «Ya invitado» y su link no abre');
  assert.equal(estadoEnBuscador({ productoId: 39, ganado: true, acceso: { cortado: false, productos: null, invitacionEnviadaAt: 'x' }, aMano: [] }), 'invitado');
  assert.equal(estadoEnBuscador({ ...base, acceso: { cortado: false, productos: [10], invitacionEnviadaAt: 'x' }, aMano: [39] }), 'invitar');
});

// ── La puerta de lectura ─────────────────────────────────────────────────────

test('resolverAcceso: Ganado abre como siempre; sin Ganado, SÓLO el permiso vigente, con la versión en el WHERE', () => {
  const r = bloque(DATOS, 'export async function resolverAcceso(', 'export async function resolverAccesoPortal(');
  assert.match(r, /\.eq\('estado_lead', 'ganado'\)/);
  const corte = r.indexOf('if (!f || f.revocado_at || f.version !== a.version) return null;');
  const permiso = r.indexOf('permisoAManoDe(');
  assert.ok(corte >= 0 && permiso > corte, 'el permiso se mira antes que la versión y el corte');
  assert.match(r, /if \(!lead && !abrePorPermiso\(await permisoAManoDe\(a\.leadId, \{ version: a\.version \}\)\)\) return null;/);
  // El permiso, con la versión y «no revocado» EN EL WHERE; sin la columna, cerrado; otro error, tira.
  const p = bloque(DATOS, 'export async function permisoAManoDe(', 'export async function aManoDeVarios(');
  assert.match(p, /base\.eq\('version', opts\.version\)\.is\('revocado_at', null\)/);
  assert.match(p, /if \(faltaColumnaAMano\(error\)\) \{[^}]*return null; \}\n\s*throw new Error\(error\.message\);/);
  // El líder sigue exigiendo Ganado: un permiso a mano es del cliente, no de sus líderes.
  const portal = bloque(DATOS, 'export async function resolverAccesoPortal(', '\n}\n');
  assert.doesNotMatch(portal, /permisoAManoDe\(/, 'el líder entra por un permiso a mano del cliente');
});

test('qué ve: la puerta es productosQueVe, y la etapa se lee sólo si tiene algo a mano', () => {
  const f = bloque(DATOS, 'export async function productosConCasaDelAlumno(', 'async function productosQueAbre(');
  assert.match(f, /productosQueVe\(/);
  assert.match(f, /permisoAManoDe\(leadId\)/);
  assert.match(f, /aMano\.length \? await leadEnGanado\(leadId\) : true/);
});

// ── Quién escribe la marca ───────────────────────────────────────────────────

test('la marca la escribe UN solo lugar: marcarInvitacion, y sólo cuando el buscador la pide', () => {
  const archivos = execFileSync('git', ['ls-files', 'lib', 'app'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
  const escriben = archivos.filter((f) => {
    let src = '';
    try { src = sinComentarios(leer(f)); } catch { return false; }
    return /productos_a_mano\s*:/.test(src);
  });
  assert.deepEqual(escriben, ['lib/curso-datos.ts'], `otro archivo escribe productos_a_mano: ${escriben.join(', ')}`);
  const marcar = bloque(DATOS, 'export async function marcarInvitacion(', 'const RECLAMO_MS');
  const fuera = DATOS.replace(marcar, '');
  assert.doesNotMatch(fuera, /productos_a_mano\s*:/, 'productos_a_mano se escribe fuera de marcarInvitacion');
  assert.match(marcar, /if \(area == null && productoId != null && opts\.aMano === true\) \{\n\s*aMano = \{ productos_a_mano: aManoTrasDar\(/);
  assert.match(marcar, /invitando_at: null, \.\.\.productos, \.\.\.aMano \}/);
  // El alta del acceso y el camino automático al ganar no la nombran.
  assert.doesNotMatch(bloque(DATOS, 'async function asegurarAcceso(', '\n}\n'), /productos_a_mano|aMano/);
  assert.doesNotMatch(sinComentarios(leer('lib/crm-curso-al-ganar.ts')), /productos_a_mano|aMano/, 'el camino automático deja un permiso a mano');
  // El reclamo con permiso: el compare-and-set sobre productos_a_mano, sólo en su rama.
  const reclamar = bloque(DATOS, 'export async function reclamarInvitacion(', 'export async function soltarInvitacion(');
  assert.match(reclamar, /conProducto && opts\.aMano === true\n\s*\? base\.or\(libre\.map\(\(b\) => `and\(productos_a_mano\.not\.cs\.\{\$\{productoId\}\},\$\{b\}\)`\)/);
  assert.equal(reclamar.split('productos_a_mano.not.cs.').length - 1, 1);
});

test('el núcleo deja el permiso sólo cuando hizo falta, y no pregunta de quién es cliente a un no ganado', () => {
  assert.match(NUCLEO, /const abrir = cualquierEtapa && productoId != null && !yaConPermiso/);
  assert.match(NUCLEO, /esCliente: lead\.ganado && \(await d\.esCliente\(p\.leadId, productoId\)\)/);
  assert.match(NUCLEO, /if \(!reenviar && !abrir && yaInvitado\) return \{ tipo: 'no', motivo: 'ya-invitado' \};/);
  assert.match(NUCLEO, /if \(!reenviar && !abrir && yaEntro\) return \{ tipo: 'no', motivo: 'ya-entro' \};/);
});

test('la comunidad y el paso de etapa ven al alumno con permiso', () => {
  const com = sinComentarios(leer('lib/comunidad-datos.ts'));
  assert.match(com, /\.contains\('productos_a_mano', \[productoId\]\)/);
  const bucle = bloque(com, 'for (const leadId of aMano) {', '\n  }\n');
  assert.match(bucle, /!vigente\.has\(leadId\)/);
  assert.match(bucle, /baneados\.has\(k\)/, 'un alumno baneado entra a la comunidad por su permiso a mano');
  assert.match(sinComentarios(leer('lib/curso-avance.ts')), /etapaActualDe\(p\.leadId, clase\.productoId, \[clase\.productoId\]\)/);
});

// ── El buscador: cortar y volver a habilitar ─────────────────────────────────

test('el buscador corta con el corte de siempre, habilita sólo lo dado a mano, y la pantalla llama a las dos', () => {
  assert.match(ACC, /estado: estadoEnBuscador\(\{/);
  const cortar = bloque(ACC, 'export async function cortarAccesoDadoAManoAction(', '\n}\n');
  assert.match(cortar, /const no = await puedeUsarCs\(\); if \(no\) return/);
  assert.match(cortar, /await revocarAcceso\(id\)/);
  assert.match(cortar, /if \(!despues\?\.revocado\) return \{ ok: false/, 'dice «cortado» sin releer');
  const habilitar = bloque(ACC, 'export async function habilitarAccesoDadoAManoAction(', '\n}\n');
  assert.match(habilitar, /const no = await puedeUsarCs\(\); if \(no\) return/);
  assert.ok(habilitar.indexOf('permisoAManoDe(') >= 0 && habilitar.indexOf('permisoAManoDe(') < habilitar.indexOf('reactivarAcceso('),
    'habilita un acceso de la venta desde el buscador');
  assert.match(habilitar, /if \(!permiso\?\.aMano\.length\) return \{ ok: false, error: 'Habilítalo desde su ficha\.' \};/,
    'habilita desde el buscador un acceso que no se dio a mano');
  const comp = sinComentarios(leer('app/customer-success/curso/InvitarAlumnos.tsx'));
  assert.match(comp, /await cortarAccesoDadoAManoAction\(f\.id\)/, 'cortar no tiene call site');
  assert.match(comp, /await habilitarAccesoDadoAManoAction\(f\.id\)/, 'habilitar no tiene call site');
});

test('la migración 0331: antes del deploy, vacía es ninguno, sólo el cliente, y sin backfill', () => {
  const mig = leer('supabase/migrations/0331_curso_accesos_a_mano.sql');
  assert.match(mig, /ORDEN DE DESPLIEGUE: ANTES del deploy/);
  const sql = mig.replace(/--.*$/gm, '');
  assert.match(sql, /productos_a_mano bigint\[\] not null default '\{\}'::bigint\[\]/);
  assert.match(sql, /area is null or cardinality\(productos_a_mano\) = 0/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on curso_accesos from anon, authenticated/);
  assert.doesNotMatch(sql, /\bupdate\b/i, 'la 0331 no hace backfill');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, este archivo + tests/curso-invitar.test.ts, base 0 fallos / 45 pases, restaurado de
// memoria). Cada rotura y lo que cayó:
//   · saneaAMano sin `?? []` (null pasaría a «todos»)                     → 1 fallo
//   · aManoVigente sin el filtro                                          → 4 fallos
//   · abrePorPermiso siempre true (equivale a sacar el chequeo de Ganado)  → 1 fallo
//   · aManoTrasDar reemplaza en vez de sumar                              → 1 fallo
//   · productosQueVe ignora `porVenta` (el ex cliente ve su casa)          → 1 fallo
//   · faltaColumnaAMano mira sólo el código                               → 1 fallo
//   · estadoEnBuscador ignora `ganado` (el bug del 13/10)                  → 1 fallo
//   · resolverAcceso sin `!lead &&`                                       → 1 fallo
//   · permisoAManoDe traga todo error                                     → 1 fallo
//   · marcarInvitacion sin `opts.aMano === true`                          → 1 fallo
//   · el núcleo siempre deja el permiso                                   → 4 fallos
//   · «ya invitado» corta aunque haga falta el permiso                    → 2 fallos
//   · la comunidad deja entrar a un baneado por su permiso                → 1 fallo
//   · habilitar desde el buscador sin mirar el permiso                    → 1 fallo
