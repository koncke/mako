// Test de CONTRATO: cada tabla/vista del Set TENANT_TABLES (lib/workspace.ts) DEBE
// tener columna workspace_id en el esquema (migraciones). Si no, el proxy de
// getTenantDb le inyecta `.eq('workspace_id')` → error de Postgres en runtime.
// Es el drift que TypeScript NO ve. Lee todo por TEXTO (workspace.ts es server-only,
// no importable bajo tsx). Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Tablas con columna workspace_id que a propósito NO pasan por el proxy (scopeo
// explícito en su lib, o cross-workspace deliberado). Ver lib/workspace.ts:39-41.
// `funnel_config` sigue acá mientras la tabla exista: la mig 0170 la dejó de
// respaldo, DEPRECADA y sin lectores (su reemplazo, `funnels`, sí está en el Set).
const EXCEPTIONS = new Set(['app_settings', 'credenciales', 'funnel_config', 'usuarios']);

// ── TENANT_TABLES desde el texto de lib/workspace.ts (Set no exportado) ──────────
function leerTenantTables(): string[] {
  const src = readFileSync(resolve(ROOT, 'lib/workspace.ts'), 'utf8');
  const m = src.match(/const TENANT_TABLES = new Set<string>\(\[([\s\S]*?)\]\)/);
  assert.ok(m, 'no se encontró el Set TENANT_TABLES en lib/workspace.ts');
  const cuerpo = m![1].replace(/\/\/[^\n]*/g, ''); // quita comentarios de línea
  return [...cuerpo.matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
}

// ── SQL de todas las migraciones concatenado ─────────────────────────────────────
function leerMigraciones(): string {
  const dir = resolve(ROOT, 'supabase/migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(resolve(dir, f), 'utf8'))
    .join('\n');
}

// Tablas del loop bulk de 0054 (`tenant text[] := array[ ... ]`) — a todas les
// agrega workspace_id en un solo do-block.
function tablasDelArrayBulk(sql: string): Set<string> {
  const m = sql.match(/tenant\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/i);
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]));
}

// ¿La tabla/vista T tiene workspace_id declarado en alguna migración?
// Estrategias con lookahead ACOTADO para no cruzar de un statement a otro.
function tieneWorkspaceId(T: string, sql: string, bulk: Set<string>): boolean {
  if (bulk.has(T)) return true;
  const esc = T.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`create table (if not exists )?${esc}\\b[\\s\\S]{0,4000}?workspace_id`, 'i').test(sql) ||
    new RegExp(`alter table ${esc}\\b[\\s\\S]{0,300}?workspace_id`, 'i').test(sql) ||
    new RegExp(`create (or replace )?view ${esc}\\b[\\s\\S]{0,4000}?workspace_id`, 'i').test(sql)
  );
}

test('TENANT_TABLES — sin duplicados', () => {
  const t = leerTenantTables();
  assert.equal(new Set(t).size, t.length, `hay duplicados en TENANT_TABLES: ${t.filter((x, i) => t.indexOf(x) !== i)}`);
  assert.ok(t.length >= 40, `esperaba >=40 tablas, hay ${t.length}`);
});

test('CONTRATO forward — cada tabla de TENANT_TABLES tiene columna workspace_id en el esquema', () => {
  const tablas = leerTenantTables();
  const sql = leerMigraciones();
  const bulk = tablasDelArrayBulk(sql);
  const faltan = tablas.filter((T) => !tieneWorkspaceId(T, sql, bulk));
  assert.deepEqual(faltan, [], `estas tablas están en TENANT_TABLES pero NO tienen workspace_id en las migraciones (el proxy tiraría error Postgres en runtime): ${faltan.join(', ')}`);
});

test('CONTRATO inverse — toda tabla del loop bulk 0054 con workspace_id está scopeada (Set) o es excepción explícita', () => {
  // Habría cazado el leak de v_cohortes ANTES de la mig 0084: una tabla con
  // workspace_id que nadie scopea es un leak cross-tenant en potencia.
  const tablas = new Set(leerTenantTables());
  const bulk = tablasDelArrayBulk(leerMigraciones());
  const noScopeadas = [...bulk].filter((T) => !tablas.has(T) && !EXCEPTIONS.has(T));
  assert.deepEqual(noScopeadas, [], `estas tablas tienen workspace_id (loop 0054) pero NO están en TENANT_TABLES ni en EXCEPTIONS (posible leak): ${noScopeadas.join(', ')}`);
});
