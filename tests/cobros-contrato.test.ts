// =============================================================================
// El contrato de datos de la pasarela: la migración 0250 y las listas que el compilador no ve
// =============================================================================
// Nada de esto da error en el momento: una tabla sin RLS se lee con la anon key, un `default` en
// `workspace_id` le atribuye al ws1 (Mauricio, un CLIENTE) lo de otro, una tabla fuera de
// TENANT_TABLES hace a getTenantDb PASSTHROUGH (la tab Pagos de una ficha listaría los cobros de
// TODOS los negocios), y una cuota insertada con el cliente de servicio cae en el `default 1` de
// `pagos.workspace_id`. Se lee el FUENTE (la migración sin comentarios, los Set de texto) y la lista
// de inquilino se importa (es pura).
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde y restaurando de
// memoria (un script que guarda el texto y lo repone, nunca git). Con el código como está:
// 5 pases, 0 fallos. Rota (pases / fallos):
//   · sin el `revoke all on cobros from anon, authenticated;`                      → 4 / 1
//   · `cobros.workspace_id … default 1`                                            → 4 / 1
//   · `create table if not exists public.pasarela_eventos`                        → 4 / 1
//   · `cobros` fuera de TENANT_TABLES (lib/workspace.ts)                           → 4 / 1
//   · `pasarela_eventos` agregada a TENANT_TABLES                                  → 4 / 1
//   · registrarCobroDeProveedor con `getSupabaseServer()`                          → 4 / 1
// Correr: node --import tsx --test tests/cobros-contrato.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** La migración sin comentarios SQL (la cabecera explica el `default` que NO lleva, y lo nombra). */
const SQL = leer('supabase/migrations/0250_cobros_pasarela.sql').replace(/--.*$/gm, '');

/** El `create table … ( … );` de una tabla. */
function tabla(nombre: string): string {
  const i = SQL.search(new RegExp(`create table if not exists ${nombre} \\(`));
  assert.ok(i >= 0, `la migración ya no crea ${nombre}`);
  return SQL.slice(i, SQL.indexOf('\n);', i) + 3);
}
const columna = (t: string, c: string) => (new RegExp(`^\\s*${c}\\s+[^\\n]*$`, 'm').exec(t) ?? [''])[0];

test('cobros y pasarela_eventos: RLS prendido y nada para anon ni authenticated', () => {
  for (const t of ['cobros', 'pasarela_eventos']) {
    assert.match(SQL, new RegExp(`alter table ${t} enable row level security;`), `${t} sin RLS`);
    assert.match(SQL, new RegExp(`revoke all on ${t} from anon, authenticated;`), `${t} sin el revoke`);
  }
});

test('cobros.workspace_id NOT NULL y SIN default (el 1 es Mauricio); el de pasarela_eventos admite null y tampoco tiene default', () => {
  const ws = columna(tabla('cobros'), 'workspace_id');
  assert.match(ws, /bigint not null references workspaces\(id\) on delete cascade/);
  assert.doesNotMatch(ws, /default/i, `cobros.workspace_id con default: ${ws.trim()}`);
  const ev = columna(tabla('pasarela_eventos'), 'workspace_id');
  assert.match(ev, /references workspaces\(id\)/);
  assert.doesNotMatch(ev, /not null|default/i, 'un aviso que no es de nadie se guarda con null, no con «el 1»');
  assert.doesNotMatch(SQL, /workspace_id\s+set\s+default/i);
  // Y la idempotencia de las renovaciones: el único parcial por (workspace, proveedor, pago).
  assert.match(SQL, /create unique index if not exists pagos_proveedor_uk\s+on pagos \(workspace_id, proveedor, proveedor_pago_id\) where proveedor_pago_id is not null;/);
});

test('los nombres van SIN `public.` (el regex de tests/tenant-tables-contract.test.ts no los ve)', () => {
  assert.doesNotMatch(SQL, /\bpublic\./i);
});

/** TENANT_TABLES es un Set NO exportado de un módulo server-only: se lee el texto (molde: tenant-tables-contract). */
function tenantTables(): string[] {
  const m = leer('lib/workspace.ts').match(/const TENANT_TABLES = new Set<string>\(\[([\s\S]*?)\]\)/);
  assert.ok(m, 'no encontré TENANT_TABLES en lib/workspace.ts');
  return [...m![1].replace(/\/\/[^\n]*/g, '').matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
}

test('`cobros` en las DOS listas; `pasarela_eventos` sólo en la de inquilino (nadie la lee con getTenantDb)', () => {
  const tenant = tenantTables();
  assert.ok(tenant.length > 40, `TENANT_TABLES se leyó mal (${tenant.length} tablas)`);
  assert.ok(tenant.includes('cobros'), 'sin cobros en TENANT_TABLES, getTenantDb es PASSTHROUGH: la ficha listaría los cobros de todos');
  assert.ok(!tenant.includes('pasarela_eventos'), 'pasarela_eventos tiene workspace nullable: el proxy le filtraría los avisos sin dueño');
  const inquilino: readonly string[] = TABLAS_DE_INQUILINO;
  assert.ok(inquilino.includes('cobros'), 'borrar un cliente dejaría sus cobros');
  assert.ok(inquilino.includes('pasarela_eventos'), 'borrar un cliente dejaría sus avisos');
});

test('la cuota que confirma la pasarela se escribe con getTenantDb, nunca con el cliente de servicio', () => {
  const src = leer('lib/pagos.ts').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const f of ['registrarCobroDeProveedor', 'desmarcarCobroDeProveedor']) {
    const i = src.indexOf(`export async function ${f}(`);
    assert.ok(i >= 0, `no encontré ${f} en lib/pagos.ts`);
    const cuerpo = src.slice(i, src.indexOf('\n}\n', i));
    assert.match(cuerpo, /const db = await getTenantDb\(\);/, `${f} sin getTenantDb`);
    assert.doesNotMatch(cuerpo, /getSupabaseServer/, `${f}: pagos.workspace_id tiene default 1 — el cobro de otro caería en el CRM de Mauricio`);
  }
});
