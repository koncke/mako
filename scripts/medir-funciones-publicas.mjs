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
// (pg_proc, pg_default_acl, pg_depend, pg_extension, information_schema.columns): no toca filas de clientes. No imprime la URL de conexión.
//
// Qué imprime, en DOS partes que no se mezclan (la verificación de la 0319 es sobre la primera; la segunda no se cierra con ella y no se debe esconder):
//  1. FUNCIONES DE LA APP (las que no son de una extensión), por cada una visible para anon: esquema.firma · DEFINER/invoker · dueño · A/U/S (¿la ejecuta anon, authenticated,
//     service_role?) · si devuelve trigger · las tablas que menciona su cuerpo (las que tienen `workspace_id` van con `*`: son datos de clientes). Después de la 0319 tiene que
//     quedar «--S» en todas (o «---» en un trigger), y ninguna con A o U.
//  2. FUNCIONES DE EXTENSIONES, agrupadas por extensión y por esquema: cuántas ejecuta anon. Una extensión de red (http, pg_net, dblink, postgres_fdw, file_fdw…) en `public`
//     ejecutable por anon es un SSRF por /rest/v1/rpc: va marcada ⚠️. La 0319 no las toca (son de la extensión): hay que mover la extensión a `extensions` o revocarla con su dueño.
// El cuerpo se mira como TEXTO (nombre de tabla entre límites de palabra): es una pista para priorizar, no un análisis; una función dinámica puede tocar más.
// =============================================================================

import postgres from 'postgres';
import { writeFileSync } from 'node:fs';

/** Extensiones que hacen pedidos de red, abren conexiones o leen archivos: con la clave anon en `public` son un SSRF o peor. */
const EXTENSIONES_PELIGROSAS = ['http', 'pg_net', 'dblink', 'postgres_fdw', 'file_fdw', 'plpython3u', 'plperlu', 'adminpack'];

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
             (select x.extname from pg_depend d join pg_extension x on x.oid = d.refobjid
               where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e' and d.refclassid = 'pg_extension'::regclass limit 1) as extension,
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
    const tablasQueToca = f.extension ? [] : nombres.filter((t) => new RegExp(`(^|[^a-z0-9_])${t}([^a-z0-9_]|$)`, 'i').test(cuerpo));
    const { cuerpo: _cuerpo, ...resto } = f;
    return { ...resto, tablas: tablasQueToca, tocaClientes: tablasQueToca.some((t) => conWs.has(t)) };
  });
  const deLaApp = filas.filter((f) => !f.extension);
  const deExtensiones = filas.filter((f) => f.extension);

  console.log(`[medir-funciones-publicas] conexión OK (leads=${datos.n}) · transacción de sólo lectura`);
  console.log('default privileges (pg_default_acl):');
  for (const d of datos.defaults) console.log(`  ${d.rol} · ${d.esquema} · ${d.tipo} · ${d.acl}`);

  console.log('\n== 1. FUNCIONES DE LA APP (no son de una extensión) ==');
  console.log('esquema.firma · definer · dueño · trigger · tablas (* = con workspace_id)   [A=anon U=authenticated S=service_role]');
  for (const f of deLaApp) {
    const marca = `${f.anon ? 'A' : '-'}${f.authenticated ? 'U' : '-'}${f.service_role ? 'S' : '-'}`;
    console.log(`${marca} ${f.esquema}.${f.firma} · ${f.definer ? 'DEFINER' : 'invoker'} · ${f.dueno}${f.es_trigger ? ' · trigger' : ''}${f.tablas.length ? ` · ${f.tablas.map((t) => (conWs.has(t) ? `${t}*` : t)).join(',')}` : ''}`);
  }
  const abiertas = deLaApp.filter((f) => f.anon);
  console.log(`RESUMEN APP: ${deLaApp.length} funciones visibles para anon · ${abiertas.length} ejecutables por anon · ${abiertas.filter((f) => f.definer).length} de esas SECURITY DEFINER · ${abiertas.filter((f) => f.tocaClientes).length} mencionan tablas con workspace_id`);
  console.log('Después de la 0319 tiene que ser 0 ejecutables por anon (y «--S» en todas las de `public`, «---» en las de trigger).');

  console.log('\n== 2. FUNCIONES DE EXTENSIONES (la 0319 NO las toca) ==');
  const porExt = new Map();
  for (const f of deExtensiones) {
    const k = `${f.extension} · ${f.esquema}`;
    const e = porExt.get(k) ?? { extension: f.extension, esquema: f.esquema, total: 0, anon: 0 };
    e.total++; if (f.anon) e.anon++;
    porExt.set(k, e);
  }
  for (const e of porExt.values()) {
    const peligrosa = EXTENSIONES_PELIGROSAS.includes(e.extension) && e.anon > 0;
    console.log(`${peligrosa ? '⚠️ SSRF ' : '        '}${e.extension} en ${e.esquema}: ${e.anon} de ${e.total} funciones ejecutables por anon${peligrosa ? ' → mover la extensión a `extensions` o revocarla con su dueño' : ''}`);
  }
  if (porExt.size === 0) console.log('(ninguna extensión con funciones visibles para anon)');

  if (salidaJson) { writeFileSync(salidaJson, JSON.stringify({ defaults: datos.defaults, filas }, null, 1)); console.log(`\nDetalle completo en ${salidaJson}`); }
} catch (e) {
  console.error('Error:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
