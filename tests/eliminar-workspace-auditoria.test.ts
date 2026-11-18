// =============================================================================
// Borrar un cliente deja constancia, y se lleva TODOS sus archivos (18/11/2026, F126)
// =============================================================================
// Dos agujeros de lib/eliminar-workspace.ts y lib/reset-workspace.ts:
//   1. NO HABÍA AUDITORÍA. «Eliminar» vacía 89 tablas, los archivos y las personas de un negocio, y no quedaba nada que dijera
//      quién lo hizo, cuándo, ni de qué agencia era (sus filas de agencia_clientes y agencia_altas se van en cascada).
//      `bajas_cuenta` (0371) sobrevive al borrado, pero sólo anota los pedidos de «Eliminar mi cuenta». Ahora
//      `borrados_workspace` (0418) se escribe ANTES de lo primero que no tiene vuelta atrás y se cierra al terminar. Si la tabla
//      está y no contesta, no se borra nada; si todavía no está instalada, se borra y se avisa.
//   2. DOS CARPETAS QUE EL BARRIDO POR `<ws>/` NO VE: las tomas del Video Generator (`video-clips/video-generator/<planId>/`, sin
//      el negocio en la ruta) y los creativos que llegan por el grupo (`ads-creatives/grupo/<ws>/`). Los planes se leen ANTES de
//      vaciar las tablas, y el guard va en positivo: sólo un UUID, y nunca uno que nombre otro negocio (ni `ai-avatar/`, que es de
//      todos).
// Lo que corre de verdad, sobre una base de mentira, está en tests/_eliminar-auditoria-hijo.ts.
//
// Probado rompiéndolo (18/11/2026), base 8 pases / 0 fallos, una rotura por vez y restaurando de memoria:
//   · la constancia escrita DESPUÉS de `cerrarLoDeAfuera` y de vaciar                           → 5 / 3 (el orden, y la caída borra)
//   · un error de la auditoría tomado como «sin instalar» (`if (true)` en vez de `migracionSinAplicar`) → 7 / 1 (la caída)
//   · la tabla sin instalar frenando el borrado                                                  → 7 / 1 (sin la migración)
//   · sin `['ads-creatives', grupo/<ws>]` en CARPETAS_APARTE                                    → 6 / 2 (eliminar y reset)
//   · `planesDeVideoDelNegocio` sin excluir lo que nombra otro negocio                           → 6 / 2 (lo leído y lo borrado)
//   · `planesDeVideo` sin el filtro de UUID en el historial                                       → 7 / 1 (lo puro: entra ai-avatar)
//   · `resetearWorkspace` sin pasarle los planes a `borrarArchivos`                              → 7 / 1 (el reset)
// Correr: node --import tsx --test tests/eliminar-workspace-auditoria.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const RAIZ = join(__dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_eliminar-auditoria-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const P_HIST = '11111111-1111-4111-8111-111111111111';
const P_MONTAJE = '22222222-2222-4222-8222-222222222222';
const P_FLOW = '33333333-3333-4333-8333-333333333333';
const P_COMPARTIDO = '44444444-4444-4444-8444-444444444444';
const P_PRUEBA = '55555555-5555-4555-8555-555555555555';

test('los planes de video: sólo UUIDs, de las tres fuentes, y nunca uno que nombre otro negocio', () => {
  assert.deepEqual(R.puro, [P_HIST, P_MONTAJE, P_FLOW], '`ai-avatar` es de todos los negocios: no se borra nunca');
  assert.deepEqual(R.puroIlegible, [], 'un historial ilegible no nombra ningún plan');
  assert.deepEqual(R.delNegocio, { planes: [P_HIST, P_MONTAJE, P_FLOW], avisos: [] }, 'el plan que también nombra otro negocio no es de éste');
});

test('la constancia se anota ANTES de lo primero que no tiene vuelta atrás, y se cierra al terminar', () => {
  assert.equal(R.borrado.ok, true, JSON.stringify(R.borrado));
  const ev = R.eventos as string[];
  const anota = ev.indexOf('POST borrados_workspace');
  assert.ok(anota >= 0, 'no se anotó el borrado');
  const destructivo = ev.findIndex((e) => /^(DELETE|PATCH) (?!borrados_workspace)|^storage /.test(e));
  assert.ok(destructivo > anota, `se tocó algo antes de anotar el borrado: ${ev[destructivo]} (posición ${destructivo}, la constancia en ${anota})`);
  assert.ok(ev.lastIndexOf('PATCH borrados_workspace') > ev.indexOf('DELETE workspaces'), 'la constancia se cierra DESPUÉS de borrar la fila');
  const c = R.constancia;
  assert.equal(c?.estado, 'hecho');
  assert.equal(c.quien, 'super@test.com');
  assert.equal(c.negocio, 'Se Va');
  assert.equal(c.negocio_id, 40);
  assert.equal(c.desde_ws, 9);
  assert.equal(c.usuarios, 2);
  assert.ok(c.terminado_at, 'sin la hora de cierre no se sabe si terminó');
  assert.deepEqual(c.agencia['agencia_clientes.cliente_ws'], [{ agencia_ws: 44, cliente_ws: 40, estado: 'aprobado', decidido_por: 'super@test.com' }]);
  assert.deepEqual(c.agencia['agencia_altas.cliente_ws'], [{ id: 77, agencia_ws: 44, cliente_ws: 40, rol_ws: 'admin', estado: 'aprobado' }]);
  const todo = JSON.stringify(c);
  assert.ok(!todo.includes('dueno@cliente.test') && !todo.includes('Dueño Real'), 'la constancia no guarda el email ni el nombre de una persona');
  assert.equal(R.sigueElNegocio, false);
});

test('se llevan las tomas de sus planes y los creativos del grupo, y nada ajeno', () => {
  const s = R.storage as string[];
  for (const p of [P_HIST, P_MONTAJE, P_FLOW]) assert.ok(s.some((x) => x.startsWith(`video-clips:video-generator/${p}/`)), `no se borraron las tomas del plan ${p}`);
  assert.ok(s.includes('ads-creatives:grupo/40/archivo.mp4'), 'no se borraron los creativos que llegaron por el grupo');
  assert.ok(!s.some((x) => x.includes(P_COMPARTIDO)), 'se borraron las tomas de un plan que también es de otro negocio');
  assert.ok(!s.some((x) => x.includes('ai-avatar')), 'se borraron escenas del AI Avatar, que son de todos los negocios');
});

test('con la auditoría instalada y caída, NO se borra nada', () => {
  assert.equal(R.caida.ok, false);
  assert.match(R.caida.error, /no borré nada/);
  const tocado = (R.eventosCaida as string[]).filter((e) => /^(DELETE|PATCH) |^storage /.test(e));
  assert.deepEqual(tocado, [], 'se tocó algo sin haber podido anotar el borrado');
  assert.equal(R.sigueCaida, true);
  assert.equal(R.personaCaida, true);
});

test('con la migración sin aplicar, se borra igual y se avisa que no quedó anotado', () => {
  assert.equal(R.sinTabla.ok, true, JSON.stringify(R.sinTabla));
  assert.ok((R.sinTabla.avisos as string[]).some((a) => /no quedó anotado/.test(a)), 'el borrado sin constancia tiene que decirlo');
  assert.equal(R.sigueSinTabla, false);
});

test('el reset del negocio de prueba también se lleva las tomas de sus planes y los creativos del grupo', () => {
  const s = R.storageReset as string[];
  assert.ok(s.some((x) => x.startsWith(`video-clips:video-generator/${P_PRUEBA}/`)), 'el reset no borró las tomas de su plan');
  assert.ok(s.includes('ads-creatives:grupo/3/archivo.mp4'));
});

test('la ruta del panel le pasa a eliminarWorkspace quién borra', () => {
  const r = leer('app/api/admin/workspaces/route.ts');
  assert.match(r, /await eliminarWorkspace\(body\.id, String\(body\.nombre \?\? ''\), await getWorkspaceActual\(\), admin\.email\)/);
});

test('la tabla sobrevive a lo que anota: sin FK, sin workspace_id, fuera de las tablas de inquilino, cerrada', () => {
  const sql = leer('supabase/migrations/0418_borrados_workspace.sql');
  const codigo = sql.replace(/--.*$/gm, '');
  assert.doesNotMatch(codigo, /references\s/i, 'una FK en cascada la borraría con el negocio');
  assert.doesNotMatch(codigo, /\bworkspace_id\b/, 'una columna workspace_id la haría tabla de inquilino');
  assert.ok(!(TABLAS_DE_INQUILINO as readonly string[]).includes('borrados_workspace'), 'vaciar el negocio la borraría');
  assert.match(codigo, /enable row level security/);
  assert.match(codigo, /revoke all on borrados_workspace from anon, authenticated;/);
  assert.match(sql, /SIN APLICAR/);
  assert.match(sql, /ORDEN DE DESPLIEGUE/);
});
