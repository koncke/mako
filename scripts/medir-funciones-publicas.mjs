#!/usr/bin/env node
// =============================================================================
// medir-funciones-publicas.mjs — qué funciones puede ejecutar la clave pública, MEDIDO en el catálogo (sólo lectura)
// =============================================================================
// Uso:  node --env-file=C:/dev/mako-api/.env.local scripts/medir-funciones-publicas.mjs [--json salida.json]
//
// POR QUÉ: la regla del repo es «se mide con `has_function_privilege('anon', …)`, nunca leyendo la migración» (AGENTS.md, docs/hallazgos-seguridad.md). El 21/10/2026 la
// revisión de la 0318 probó que el default de la 0280 NO cerraba el EXECUTE de PUBLIC: «desde la 0280 nacen cerradas» era falso y nadie lo había medido. Este script es esa
// medición, para correr ANTES y DESPUÉS de aplicar una migración que toque permisos de funciones (la 0319 lo cierra).
//
// SÓLO LECTURA, por construcción: todo va dentro de una transacción `read only` (Postgres rechaza cualquier escritura), con `statement_timeout` de 20 s. Lee el catálogo
// (pg_proc, pg_default_acl, pg_depend, information_schema.columns): no toca filas de clientes. No imprime la URL de conexión.
//
// Qué imprime, por cada función visible para anon (esquemas con USAGE para anon, sin pg_catalog/information_schema):
//   esquema.firma · DEFINER/invoker · dueño · anon / authenticated / service_role (¿ejecuta?) · si es de una extensión · si devuelve trigger · las tablas que menciona su cuerpo
//   (las que tienen `workspace_id` van marcadas: son datos de clientes). Al final, el resumen: cuántas puede ejecutar anon, cuántas son DEFINER y cuántas tocan clientes.
// El cuerpo se mira como TEXTO (nombre de tabla entre límites de palabra): es una pista para priorizar, no un análisis; una función dinámica puede tocar más.
// =============================================================================

import postgres from 'postgres';
import { writeFileSync } from 'node:fs';

const conn = process.env.DATABASE_URL;
if (!conn) { console.error('Falta DATABASE_URL (corré con: node --env-file=C:/dev/mako-api/.env.local scripts/medir-funciones-publicas.mjs)'); process.exit(1); }
const iJson = process.argv.indexOf('--json');
const salidaJson = iJson > 0 ? process.argv[iJson + 1] : null;

const sql = postgres(conn, { ssl: 'require', connect_timeout: 60, max: 1 });
try {
  const datos = await sql.begin('read only', async (tx) => {
    await tx`set local statement_timeout = '20s'`;
    const [{ n }] = await tx`select count(*)::int as n from leads`;
    const defaults = await tx`
      select pg_get_userbyid(defaclrole) as rol, defaclnamespace::regnamespace::text as esquema, defaclobjtype as tipo, defaclacl::text as acl
      from pg_default_acl order by 1, 2, 3`;
    const tablas = await tx`
      select c.relname as tabla,
             exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'workspace_id') as con_ws
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')`;
    const funciones = await tx`
      select n.nspname as esquema, p.oid::regprocedure::text as firma, p.prokind as tipo, p.prosecdef as definer, pg_get_userbyid(p.proowner) as dueno,
             (p.prorettype = 'trigger'::regtype) as es_trigger, p.proacl::text as acl,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
             has_function_privilege('service_role', p.oid, 'execute') as service_role,
             exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') as de_extension,
             p.prosrc as cuerpo
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast') and has_schema_privilege('anon', n.oid, 'usage')
      order by n.nspname, p.proname, 2`;
    return { n, defaults, tablas, funciones };
  });

  const conWs = new Set(datos.tablas.filter((t) => t.con_ws).map((t) => t.tabla));
  const nombres = datos.tablas.map((t) => t.tabla);
  const filas = datos.funciones.map((f) => {
    const cuerpo = String(f.cuerpo ?? '').replace(/--[^\n]*/g, '');
    const tablasQueToca = nombres.filter((t) => new RegExp(`(^|[^a-z0-9_])${t}([^a-z0-9_]|$)`, 'i').test(cuerpo));
    const { cuerpo: _cuerpo, ...resto } = f;
    return { ...resto, tablas: tablasQueToca, tocaClientes: tablasQueToca.some((t) => conWs.has(t)) };
  });

  console.log(`[medir-funciones-publicas] conexión OK (leads=${datos.n}) · transacción de sólo lectura`);
  console.log('default privileges (pg_default_acl):');
  for (const d of datos.defaults) console.log(`  ${d.rol} · ${d.esquema} · ${d.tipo} · ${d.acl}`);
  console.log('\nesquema.firma · definer · dueño · anon/auth/service_role · extensión · trigger · tablas (* = con workspace_id)');
  for (const f of filas) {
    const marca = `${f.anon ? 'A' : '-'}${f.authenticated ? 'U' : '-'}${f.service_role ? 'S' : '-'}`;
    console.log(`${marca} ${f.esquema}.${f.firma} · ${f.definer ? 'DEFINER' : 'invoker'} · ${f.dueno}${f.de_extension ? ' · extensión' : ''}${f.es_trigger ? ' · trigger' : ''}${f.tablas.length ? ` · ${f.tablas.map((t) => (conWs.has(t) ? `${t}*` : t)).join(',')}` : ''}`);
  }
  const abiertas = filas.filter((f) => f.anon && !f.de_extension);
  console.log(`\nRESUMEN: ${filas.length} funciones visibles para anon · ${abiertas.length} ejecutables por anon (sin contar extensiones) · ${abiertas.filter((f) => f.definer).length} de esas son SECURITY DEFINER · ${abiertas.filter((f) => f.tocaClientes).length} mencionan tablas con workspace_id`);
  console.log('(A = anon la ejecuta, U = authenticated, S = service_role. Después de la 0319 tiene que quedar «--S» en todas las de `public` que no son de una extensión.)');
  if (salidaJson) { writeFileSync(salidaJson, JSON.stringify({ defaults: datos.defaults, filas }, null, 1)); console.log(`\nDetalle completo en ${salidaJson}`); }
} catch (e) {
  console.error('Error:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
