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
import { execFileSync } from 'node:child_process';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

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

// =============================================================================
// EL INVERSO COMPLETO (17/10/2026). El de arriba recorre SÓLO el loop de la 0054: una tabla nueva
// con `workspace_id` que alguien se olvidara de sumar a TENANT_TABLES no la cazaba nadie, y el
// modo de falla es el peor que hay: `getTenantDb()` sobre una tabla que no está en el Set es
// PASSTHROUGH — devuelve las filas de todos los negocios, sin un error.
//
// Medido ese día al escribirlo: además de las de siempre, `tickets` (mig 0311), `pasarela_eventos`
// (0255) y `email_entrantes` (0245) estaban fuera del Set SIN que ningún guard lo supiera (las tres a
// propósito, pero eso lo decía sólo un comentario); y `lib/branding.ts` leía `branding_assets` con
// `getTenantDb()` —su comentario juraba «devuelve null si no existe EN ESTE workspace (cierra el
// IDOR)»— y le volvían las filas de todos. Y contra PRODUCCIÓN, cinco tablas con `workspace_id`
// (`avisos_programados`, `flujo_corridas`, `insistencias`, `replay_sesiones`, `replay_lotes`) faltaban
// en TABLAS_DE_INQUILINO: vaciar un negocio las dejaba.
//
// Tres preguntas, y cada una con su lista en POSITIVO:
//   1. Toda tabla que una migración crea (o le agrega) con `workspace_id` está en
//      TABLAS_DE_INQUILINO —la lista de «qué es de un cliente», medida contra producción—.
//   2. Toda tabla de TABLAS_DE_INQUILINO pasa por el proxy (TENANT_TABLES) o está en
//      FUERA_DEL_PROXY con su porqué.
//   3. Ninguna tabla de FUERA_DEL_PROXY se lee con `getTenantDb()`: ahí no la filtra nadie.
//
// Probado rompiéndolo (17/10/2026), una rotura por vez, sobre los 6 de este archivo (base 6 / 0):
// sacando 'tickets' de FUERA_DEL_PROXY → 5 / 1 (el 2); sacando 'insistencias' de TABLAS_DE_INQUILINO
// → 4 / 2 (el 1, y el 2 por su lista de «en el Set sin porqué»); con lib/branding.ts volviendo a
// `const db = await getTenantDb()` → 5 / 1 (el 3).
// =============================================================================

/** Tienen `workspace_id` y NO pasan por `getTenantDb()`, a propósito. Quien las lee filtra a mano. */
const FUERA_DEL_PROXY: Record<string, string> = {
  actividad_acciones: 'la medición de Admin › Activity: la escribe lib/actividad-registro.ts con el workspace explícito y la lee sólo el super admin (lib/actividad.ts), que cruza negocios',
  actividad_uso: 'la medición de Admin › Activity: la suma la función sumar_actividad con el workspace de la sesión y la lee sólo el super admin (lib/actividad.ts)',
  grupo_mensajes: 'el hilo del grupo (mig 0372): lo lee un invitado de OTRO negocio, así que getTenantDb le daría el grupo de SU negocio y estamparía su ws. lib/grupo-app.ts, con el ws de la URL ya autorizada',
  grupo_invitados: 'quién está invitado al grupo (mig 0372): lib/grupo-puerta.ts y lib/grupo-app.ts, con el ws explícito; se lee también por usuario, cruzando negocios',
  grupo_leidos: 'hasta dónde leyó cada persona el grupo (mig 0372): lib/grupo-app.ts, con el ws explícito',
  app_settings: 'settings por clave; lib/settings.ts pone el workspace_id a mano',
  credenciales: 'cifradas; lib/credenciales.ts resuelve el workspace y filtra a mano',
  partner_codigos: 'el código de MaKo Partners (mig 0330): lib/partners-programa.ts con el cliente de servicio y el ws de la sesión; /r/<código> lo busca por código',
  partner_codigos_anteriores: 'los códigos que un partner dejó de usar (mig 0341): lib/partners-programa.ts con el cliente de servicio y el ws de la sesión; /r/<código> los busca por código',
  funnel_config: 'deprecada por la mig 0170 (la reemplaza `funnels`), sin lectores',
  shares: 'cross-workspace por diseño: el link compartido trae su workspace',
  webhook_routing: 'cross-workspace por diseño: identificador de un proveedor → workspace',
  branding_assets: 'el material de marca, sólo para el super admin (lib/branding.ts, cliente de servicio)',
  credenciales_auditoria: 'la escribe lib/credenciales.ts con el workspace explícito',
  agente_consentimiento: 'la escribe y lee lib/agente-* con el workspace del token',
  email_entrantes: 'workspace_id admite null (un mail que no es de nadie); lib/email-entrante.ts',
  pasarela_eventos: 'workspace_id admite null (un aviso de Stripe/MP sin dueño); lib/pasarela-eventos.ts',
  tickets: 'la Ticketera de la plataforma lee todos; lib/tickets-db.ts filtra por negocio a mano',
  recibos_negocio_numeracion: 'el contador de los recibos de cada negocio (mig 0399): sólo la toca la función emitir_recibo_negocio, con el workspace del payload; ningún código la lee',
  // La IA del cliente en su computadora (migs 0320 y 0321): el negocio sale del TOKEN de la PC, no de la sesión.
  ia_pc_codigos: 'la puerta de la PC del cliente; lib/ia-pc.ts filtra por negocio a mano (service role)',
  media_buyer_config: 'el Media Buyer (mig 0332): lib/media-buyer/store.ts con el cliente de servicio y el ws explícito (corre en un cron, sin sesión)',
  media_buyer_decisiones: 'el registro del Media Buyer (mig 0332): lib/media-buyer/store.ts, siempre con el workspace_id filtrado a mano',
  ia_pc_dispositivos: 'la puerta de la PC del cliente; lib/ia-pc.ts filtra por negocio a mano (el negocio sale del token)',
  ia_pc_turnos: 'la puerta de la PC del cliente; lib/ia-pc.ts filtra por negocio y por PC a mano',
  // Las pruebas A/B (mig «pruebas_ab», 25/10/2026): lib/pruebas/store.ts con el cliente de servicio y el ws explícito.
  pruebas: 'las pruebas A/B: lib/pruebas/store.ts con el ws explícito (la página pública y el cron no tienen sesión)',
  prueba_variantes: 'las ramas de una prueba A/B: lib/pruebas/store.ts, siempre con el workspace_id filtrado a mano',
  prueba_asignaciones: 'quién vio qué rama: lib/pruebas/store.ts, siempre con el workspace_id filtrado a mano',
  prueba_lecturas: 'los números diarios de una prueba: lib/pruebas/store.ts, siempre con el workspace_id filtrado a mano',
  prueba_historial: 'el porqué de cada decisión de una prueba: lib/pruebas/store.ts, siempre con el workspace_id filtrado a mano',
  // MaKo sin conexión, T2 (mig 0346, 28/10/2026): la idempotencia de lo escrito sin conexión.
  sin_conexion_aplicadas: 'lo ya subido de la cola sin conexión: app/_sin-conexion/acciones.ts con el cliente de servicio, la persona (usuario_id) y el id del cambio',
};
/** En TENANT_TABLES y no en TABLAS_DE_INQUILINO, con su porqué. */
const EN_EL_SET_SIN_SER_TABLA: Record<string, string> = {
  v_cohortes_semanales: 'vista (mig 0084): no se vacía, se recalcula',
  v_cohortes_mensuales: 'vista (mig 0084): no se vacía, se recalcula',
  meta_health_history: 'migración 0071 escrita y NUNCA aplicada en producción (medido el 17/10/2026)',
};

/** Las tablas a las que alguna migración les dio `workspace_id` (create table o alter … add column),
 *  menos las que una migración posterior borró. Lee el cuerpo del `create table` por paréntesis
 *  balanceados: un lookahead de N caracteres cruza al statement siguiente. */
function tablasConWorkspaceEnMigraciones(): Set<string> {
  const dir = resolve(ROOT, 'supabase/migrations');
  const con = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(resolve(dir, f), 'utf8').replace(/--[^\n]*/g, '');
    for (const t of tablasDelArrayBulk(sql)) con.add(t);
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s*\(/gi)) {
      const desde = (m.index ?? 0) + m[0].length;
      let i = desde;
      let d = 1;
      while (i < sql.length && d > 0) { if (sql[i] === '(') d++; else if (sql[i] === ')') d--; i++; }
      if (/(^|[\s,(])workspace_id\s/i.test(sql.slice(desde, i))) con.add(m[1].toLowerCase());
    }
    for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?workspace_id/gi)) {
      con.add(m[1].toLowerCase());
    }
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) con.delete(m[1].toLowerCase());
  }
  return con;
}

const esDeInquilino = (t: string): boolean => (TABLAS_DE_INQUILINO as readonly string[]).includes(t);

test('INVERSO 1 — toda tabla con workspace_id de las migraciones está en TABLAS_DE_INQUILINO', () => {
  const con = tablasConWorkspaceEnMigraciones();
  assert.ok(con.size >= 120, `el parser dejó de ver las migraciones (vio ${con.size})`);
  const faltan = [...con].filter((t) => !esDeInquilino(t) && t !== 'usuarios' && !EN_EL_SET_SIN_SER_TABLA[t]);
  assert.deepEqual(faltan, [], `tienen workspace_id y no están en lib/tablas-de-inquilino.ts (vaciar o borrar un negocio las deja): ${faltan.join(', ')}`);
});

test('INVERSO 2 — toda tabla de inquilino pasa por el proxy o declara por qué no', () => {
  const set = new Set(leerTenantTables());
  const sinProxy = TABLAS_DE_INQUILINO.filter((t) => !set.has(t) && !FUERA_DEL_PROXY[t]);
  assert.deepEqual(sinProxy, [], `no están en TENANT_TABLES ni en FUERA_DEL_PROXY: getTenantDb() las devolvería ENTERAS, de todos los negocios: ${sinProxy.join(', ')}`);
  // Y las listas de excusas no se quedan viejas: una entrada que ya no es cierta, se va.
  const sobran = Object.keys(FUERA_DEL_PROXY).filter((t) => set.has(t) || !esDeInquilino(t));
  assert.deepEqual(sobran, [], `FUERA_DEL_PROXY nombra tablas que ya están en el Set o que no son de inquilino: ${sobran.join(', ')}`);
  const raras = [...set].filter((t) => !esDeInquilino(t) && !EN_EL_SET_SIN_SER_TABLA[t]);
  assert.deepEqual(raras, [], `en TENANT_TABLES y no en TABLAS_DE_INQUILINO, sin porqué: ${raras.join(', ')}`);
});

test('INVERSO 3 — ninguna tabla de FUERA_DEL_PROXY se lee con getTenantDb()', () => {
  const archivos = execFileSync('git', ['grep', '-l', 'getTenantDb', '--', 'lib', 'app'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  assert.ok(archivos.length >= 50, `el guard dejó de ver los archivos (vio ${archivos.length})`);
  const malos: string[] = [];
  for (const f of archivos) {
    const src = readFileSync(resolve(ROOT, f), 'utf8');
    const vars = [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*await\s+getTenantDb\(\)/g)].map((m) => m[1]);
    for (const t of [...Object.keys(FUERA_DEL_PROXY), 'usuarios']) {
      if (new RegExp(`getTenantDb\\(\\)\\)\\s*\\.from\\(['"]${t}['"]\\)`).test(src)) malos.push(`${f} → ${t}`);
      for (const v of vars) if (new RegExp(`\\b${v}\\s*\\.from\\(['"]${t}['"]\\)`).test(src)) malos.push(`${f} → ${t} (por ${v})`);
    }
  }
  assert.deepEqual(malos, [], `getTenantDb() NO filtra estas tablas (passthrough): usá getSupabaseServer() con .eq('workspace_id', ws) a mano: ${malos.join('; ')}`);
});
