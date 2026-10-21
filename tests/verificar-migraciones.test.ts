// =============================================================================
// verificar-migraciones-aplicadas: ¿lo que crean las migraciones EXISTE en la base? (el analizador, el cruce con el catálogo y que sea de sólo lectura)
// =============================================================================
// El 21/10/2026 se supo que la 0283 (`workspaces.mfa_obligatorio_desde`) nunca se había aplicado en producción: `scripts/apply-migration.mjs` ejecuta el archivo y no deja registro, y el código la
// lee con tolerancia a que falte, así que nada se rompió: sólo NO RIGIÓ lo que la columna habilita (el 2FA obligatorio). scripts/verificar-migraciones-aplicadas.mjs lee las 315 migraciones en
// orden, lleva el estado de lo que crean y borran, y lo cruza con el catálogo. Corre en producción sólo con el permiso de Martín; lo que se fija acá es lo que se puede fijar SIN producción:
//   · el ANALIZADOR, con SQL de mentira: qué espera de cada forma de DDL, y que lo que una migración posterior borra o renombra ya no se espere;
//   · el CRUCE: falta / dudoso (un DO condicional) / sobra, y el estado por migración (aplicada, a medias, ausente, sin objetos);
//   · que sea de SÓLO LECTURA por construcción: toda consulta al catálogo es un `select`, y la transacción es `read only`;
//   · que sobre las 315 migraciones REALES no quede DDL sin entender (si una migración nueva trae una forma que el analizador no conoce, este test lo dice ANTES de que alguien corra el
//     verificador en producción y lea un informe incompleto).
// Además se validó contra un Postgres de verdad (PGlite, SIN producción): las 315 migraciones aplicadas en orden dan 0 discrepancias y 0 «sobran»; 125 objetos reales borrados a mano, los 125
// detectados; y saltear la 0283 da «AUSENTE: columna:public.workspaces.mfa_obligatorio_desde», exactamente el caso real. Ver docs/hallazgos-infra.md.
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizarMigraciones, formatear, leerCatalogo, verificar } from '../scripts/verificar-migraciones-aplicadas.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(REPO, 'scripts', 'verificar-migraciones-aplicadas.mjs');

const un = (sql: string, nombre = '0500_x.sql') => analizarMigraciones([{ nombre, sql }]);
const claves = (sql: string) => [...un(sql).vivos.keys()].sort();

// ---------------------------------------------------------------------------------------------------------------------------------
// El analizador: qué espera de cada forma de DDL
// ---------------------------------------------------------------------------------------------------------------------------------

test('create table: la tabla, sus columnas y sus restricciones con nombre (no las sin nombre)', () => {
  assert.deepEqual(claves(`
    create table if not exists public.pagos (
      id bigserial primary key,
      "Monto Total" numeric not null default 0,
      estado text check (estado in ('a','b')),
      constraint pagos_estado_ck check (estado is not null),
      unique (id, estado),
      primary key (id)
    );`), [
    'columna:public.pagos."monto total"'.replace('"monto total"', 'Monto Total'), // un identificador entre comillas conserva su forma
    'columna:public.pagos.estado', 'columna:public.pagos.id', 'restriccion:public.pagos.pagos_estado_ck', 'tabla:public.pagos',
  ].sort());
  assert.deepEqual(claves('create table leads (id int, like otra including all);'), ['columna:public.leads.id', 'tabla:public.leads'], 'LIKE no es una columna');
  assert.deepEqual(claves('create temp table t (a int);'), [], 'una tabla temporal no se espera');
});

test('alter table: add column (varias a la vez, con y sin la palabra column), add constraint con nombre; sin nombre no se espera', () => {
  assert.deepEqual(claves(`
    alter table leads
      add column if not exists a text,
      add b int default 3,
      add column c jsonb,
      add constraint leads_a_ck check (a <> ''),
      add primary key (id),
      alter column c set not null;`), ['columna:public.leads.a', 'columna:public.leads.b', 'columna:public.leads.c', 'restriccion:public.leads.leads_a_ck']);
});

test('lo que una migración posterior borra o renombra ya no se espera, y queda anotado como borrado', () => {
  const an = analizarMigraciones([
    { nombre: '0001_a.sql', sql: 'create table t (a int, b int, c int); create index t_a on t (a); create index t_b on t (b);' },
    { nombre: '0002_b.sql', sql: 'alter table t drop column b; alter table t rename column c to d; drop index t_a; alter table t rename to u;' },
  ]);
  assert.deepEqual([...an.vivos.keys()].sort(), ['columna:public.u.a', 'columna:public.u.d', 'indice:public.t_b', 'tabla:public.u']);
  assert.ok(an.borrados.has('columna:public.t.b') && an.borrados.has('indice:public.t_a'), 'lo borrado queda anotado: si SIGUE ahí, la migración que lo borra no se aplicó');
  assert.ok(!an.borrados.has('columna:public.t.c'), 'un renombre no es un borrado');
});

test('drop table se lleva sus columnas, sus índices, sus triggers y sus políticas', () => {
  const an = analizarMigraciones([
    { nombre: '0001_a.sql', sql: `create table t (a int); create index t_a on t (a); create trigger tr before insert on t for each row execute function f(); create policy p on t for select using (true); alter table t enable row level security;
      create table keep (a int);` },
    { nombre: '0002_b.sql', sql: 'drop table if exists public.t cascade;' },
  ]);
  assert.deepEqual([...an.vivos.keys()].sort(), ['columna:public.keep.a', 'tabla:public.keep']);
  assert.ok(an.borrados.has('tabla:public.t'));
});

test('funciones: por nombre y cantidad de argumentos (los OUT no cuentan); drop sin firma borra todas las sobrecargas', () => {
  const an = analizarMigraciones([
    { nombre: '0001_a.sql', sql: `create or replace function public.f(a int, b text default 'x') returns int language sql as $$ select 1 $$;
      create function f(a int) returns int language sql as $$ select 1; $$;
      create function g(a int, out b int) language sql as $$ select 1 $$;
      create procedure p() language sql as $$ select 1 $$;` },
  ]);
  assert.deepEqual([...an.vivos.keys()].sort(), ['funcion:public.f/1', 'funcion:public.f/2', 'funcion:public.g/1', 'funcion:public.p/0']);
  const despues = analizarMigraciones([{ nombre: '0001_a.sql', sql: 'create function f(a int) returns int language sql as $$ select 1 $$; create function f(a int, b int) returns int language sql as $$ select 1 $$;' }, { nombre: '0002_b.sql', sql: 'drop function f(int);' }]);
  assert.deepEqual([...despues.vivos.keys()], ['funcion:public.f/2'], 'drop con firma borra sólo esa');
  const todas = analizarMigraciones([{ nombre: '0001_a.sql', sql: 'create function f(a int) returns int language sql as $$ select 1 $$; create function f(a int, b int) returns int language sql as $$ select 1 $$;' }, { nombre: '0002_b.sql', sql: 'drop function if exists f;' }]);
  assert.deepEqual([...todas.vivos.keys()], [], 'drop sin firma borra todas');
});

test('vistas, triggers, políticas, tipos, extensiones, secuencias, esquemas, RLS y buckets', () => {
  assert.deepEqual(claves(`
    create or replace view v_a as select 1;
    create materialized view if not exists public.mv as select 1;
    create trigger trg_a before update on public.t for each row execute function f();
    create policy "solo el dueño" on public.t for all using (true);
    create type public.estado as enum ('a', 'b');
    create extension if not exists pg_trgm;
    create sequence s1;
    create schema if not exists extra;
    alter table public.t enable row level security;
    insert into storage.buckets (id, name, public) values ('creativos', 'creativos', false);`),
  ['bucket:creativos', 'esquema:extra', 'extension:pg_trgm', 'politica:public.t.solo el dueño', 'rls:public.t', 'secuencia:public.s1', 'tipo:public.estado', 'trigger:public.t.trg_a', 'vista:public.mv', 'vista:public.v_a']);
  const sinRls = analizarMigraciones([{ nombre: '0001_a.sql', sql: 'alter table t enable row level security;' }, { nombre: '0002_b.sql', sql: 'alter table t disable row level security;' }]);
  assert.deepEqual([...sinRls.vivos.keys()], [], 'disable row level security: ya no se espera');
  assert.equal(sinRls.borrados.has('rls:public.t'), false, 'y no es un «sobra»');
});

test('lo que NO es DDL de objetos no se espera, no rompe, y no queda como «sin entender»', () => {
  const an = un(`
    comment on table t is 'x'; grant select on t to anon; revoke all on t from anon; notify pgrst, 'reload schema';
    insert into t values (1); update t set a = 1; delete from t; select 1; begin; commit; set local x = 1;
    alter default privileges in schema public revoke execute on functions from public;
    alter function f(int) owner to postgres; alter table t owner to postgres;`);
  assert.deepEqual([...an.vivos.keys()], []);
  assert.deepEqual(an.sinEntender, []);
  assert.ok((an.sinMirar.get('0500_x.sql') ?? 0) >= 3, 'los datos que siembra se cuentan, para decirlo en el informe');
});

test('un DDL que no conoce va a «sin entender», con su migración (no se pierde en silencio)', () => {
  const an = un('create foreign table raro (a int) server s; create aggregate foo(int) (sfunc = x, stype = int);');
  assert.equal(an.sinEntender.length, 1, 'create foreign table no se entiende; create aggregate se ignora a propósito');
  assert.equal(an.sinEntender[0][0], '0500_x.sql');
});

test('un DO condicional: lo que crea se espera pero como «condicional» (si falta es dudoso, no falta)', () => {
  const an = un(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'x_fk') then alter table t add constraint x_fk foreign key (a) references u(id); end if; end $$;
                 do $$ begin execute format('alter table %I add column z int', 't'); end $$;`);
  assert.deepEqual([...an.vivos.keys()], ['restriccion:public.t.x_fk']);
  assert.equal(an.vivos.get('restriccion:public.t.x_fk')?.condicional, true);
});

test('lo que está en un comentario, en un string o en el cuerpo de una función NO es DDL de la migración', () => {
  assert.deepEqual(claves(`
    -- create table fantasma (a int);
    /* alter table fantasma add column b int; */
    create function f() returns text language sql as $$ select 'create table dentro (a int)'; $$;
    insert into t values ('create table otra (a int)');`), ['funcion:public.f/0']);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// El cruce con el catálogo
// ---------------------------------------------------------------------------------------------------------------------------------

const catalogo = (...c: string[]) => ({ claves: new Set(c), buckets: true });

test('verificar: falta / dudoso / sobra, y el estado de cada migración', () => {
  const an = analizarMigraciones([
    { nombre: '0001_tabla.sql', sql: 'create table t (a int, b int);' },
    { nombre: '0002_col.sql', sql: 'alter table t add column c int;' },
    { nombre: '0003_dos.sql', sql: 'create index i1 on t (a); create index i2 on t (b);' },
    { nombre: '0004_datos.sql', sql: "insert into t values (1, 2);" },
    { nombre: '0005_cond.sql', sql: "do $$ begin alter table t add constraint ck check (a > 0); end $$;" },
    { nombre: '0006_borra.sql', sql: 'drop index i2; create table viejo (a int); ' },
    { nombre: '0007_borra_viejo.sql', sql: 'drop table viejo;' },
    { nombre: '0008_medias.sql', sql: 'create index i3 on t (a); create index i4 on t (b);' },
  ]);
  const r = verificar(an, catalogo('tabla:public.t', 'columna:public.t.a', 'columna:public.t.b', 'indice:public.i1', 'tabla:public.viejo', 'indice:public.i2', 'indice:public.i3'));
  const estado = Object.fromEntries(r.porMigracion.map((m) => [m.nombre, m.estado]));
  assert.equal(estado['0001_tabla.sql'], 'aplicada');
  assert.equal(estado['0002_col.sql'], 'ausente', 'la columna c no está: la migración 0002 no se aplicó');
  assert.equal(estado['0003_dos.sql'], 'aplicada', 'i1 está; i2 lo borra la 0006, así que ya no se espera (y como sigue ahí sale en «sobra»)');
  assert.equal(r.porMigracion.find((m) => m.nombre === '0004_datos.sql'), undefined, 'una migración sin objetos no aparece');
  assert.equal(estado['0008_medias.sql'], 'a-medias', 'i3 está y i4 no: aplicada a medias, que NO es lo mismo que ausente');
  assert.equal(r.porMigracion.find((m) => m.nombre === '0008_medias.sql')?.faltan.join(), 'indice:public.i4');
  assert.deepEqual(r.falta.map((f) => f.clave), ['columna:public.t.c', 'indice:public.i4'], 'falta la columna y el índice: lo condicional va aparte y lo borrado ya no se espera');
  assert.deepEqual(r.dudoso.map((f) => f.clave), ['restriccion:public.t.ck']);
  assert.deepEqual(r.sobra.map((s) => s.clave).sort(), ['indice:public.i2', 'tabla:public.viejo'], 'siguen ahí y una migración los borra: esa migración no se aplicó');
});

test('verificar: --desde ignora lo anterior; sin acceso a storage.buckets los buckets no se verifican', () => {
  const an = analizarMigraciones([{ nombre: '0100_a.sql', sql: 'create table a (x int);' }, { nombre: '0200_b.sql', sql: "create table b (x int); insert into storage.buckets (id) values ('bk');" }]);
  const r = verificar(an, { claves: new Set<string>(), buckets: false }, { desde: '0200' });
  assert.deepEqual(r.falta.map((f) => f.clave).sort(), ['columna:public.b.x', 'tabla:public.b'], 'sin 0100 y sin el bucket');
});

test('formatear: lo importante primero, y dice lo que NO mira', () => {
  const an = analizarMigraciones([{ nombre: '0283_mfa.sql', sql: 'alter table workspaces add column mfa_obligatorio_desde timestamptz;' }, { nombre: '0284_x.sql', sql: "insert into t values (1); create table x (a int);" }]);
  const informe = formatear(an, verificar(an, catalogo('tabla:public.x', 'columna:public.x.a')));
  assert.match(informe, /2 migraciones con objetos verificables: 1 aplicadas · 0 A MEDIAS · 1 AUSENTES/);
  assert.match(informe, /AUSENTES[\s\S]*0283_mfa\.sql — 1 objeto\(s\): columna:public\.workspaces\.mfa_obligatorio_desde/);
  assert.match(informe, /LO QUE NO SE MIRA[\s\S]*sentencias de datos[\s\S]*grant\/revoke/);
});

test('las dos mitades hablan el mismo idioma: lo que el analizador espera de un esquema es EXACTAMENTE lo que el lector del catálogo devuelve para ese esquema', async () => {
  const sql = `
    create table public.t (a int, b int);
    create unique index t_a_idx on public.t (a);
    alter table public.t add constraint t_b_ck check (b > 0);
    alter table public.t enable row level security;
    create policy p_t on public.t for select using (true);
    create trigger tr_t before insert on public.t for each row execute function public.f(int, int);
    create function public.f(a int, b int) returns trigger language plpgsql as $$ begin return new; end $$;
    create view public.v_t as select a from public.t;
    create type public.estado as enum ('x');
    create extension if not exists pg_trgm;
    create sequence public.s_t;
    create schema extra;`;
  // Las filas que Postgres devolvería para ese esquema, por consulta (se reconocen por la tabla del catálogo que leen).
  const filasPor: [RegExp, Record<string, unknown>[]][] = [
    [/relrowsecurity[\s\S]*from pg_class c/, [
      { e: 'public', n: 't', t: 'r', rls: true }, { e: 'public', n: 't_a_idx', t: 'i', rls: false }, { e: 'public', n: 'v_t', t: 'v', rls: false }, { e: 'public', n: 's_t', t: 'S', rls: false }]],
    [/from pg_attribute a/, [{ e: 'public', t: 't', c: 'a' }, { e: 'public', t: 't', c: 'b' }, { e: 'public', t: 'v_t', c: 'a' }]],
    [/from pg_proc p/, [{ e: 'public', n: 'f', a: 2, m: null }]],
    [/from pg_trigger g/, [{ e: 'public', t: 't', n: 'tr_t' }]],
    [/from pg_policies/, [{ e: 'public', t: 't', n: 'p_t' }]],
    [/from pg_type t/, [{ e: 'public', n: 'estado' }]],
    [/from pg_extension/, [{ n: 'pg_trgm' }]],
    [/from pg_constraint o/, [{ e: 'public', t: 't', n: 't_b_ck' }]],
    [/from pg_namespace where/, [{ n: 'public' }, { n: 'extra' }]],
  ];
  const cat = await leerCatalogo(async (texto: string) => filasPor.find(([re]) => re.test(texto))?.[1] ?? []);
  const an = un(sql);
  const r = verificar(an, cat);
  assert.deepEqual(r.falta.map((f) => f.clave), [], 'nada de lo que el analizador espera falta en ese catálogo: las claves de las dos mitades coinciden');
  assert.deepEqual([...an.vivos.keys()].filter((c) => !cat.claves.has(c)), []);
  for (const tipo of ['tabla', 'columna', 'indice', 'vista', 'secuencia', 'rls', 'funcion', 'trigger', 'politica', 'tipo', 'extension', 'restriccion', 'esquema']) {
    assert.ok([...an.vivos.keys()].some((c) => c.startsWith(`${tipo}:`)), `el esquema de prueba cubre ${tipo}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// SÓLO LECTURA, por construcción
// ---------------------------------------------------------------------------------------------------------------------------------

test('el catálogo se lee con puros `select`, de a una consulta por vez (nada que escriba ni que encadene sentencias)', async () => {
  const consultas: string[] = [];
  const c = await leerCatalogo(async (texto: string) => { consultas.push(texto); return []; });
  assert.ok(consultas.length >= 10, `lee los diez catálogos: ${consultas.length}`);
  for (const q of consultas) {
    assert.match(q, /^\s*select\b/i, `una consulta que no es un select: ${q.slice(0, 80)}`);
    assert.doesNotMatch(q, /;|\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy)\b/i, `una consulta que escribe o encadena: ${q.slice(0, 80)}`);
  }
  assert.equal(c.buckets, false, 'sin filas en storage.buckets no se verifican los buckets');
});

test('el script abre una transacción `read only` y NO tiene ninguna escritura ni DDL en su código', () => {
  const fuente = readFileSync(SCRIPT, 'utf8');
  const codigo = fuente.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.match(codigo, /sql\.begin\('read only'/, 'la transacción es read only: Postgres rechaza cualquier escritura');
  assert.match(codigo, /statement_timeout/, 'con tope de tiempo');
  assert.doesNotMatch(codigo, /\.unsafe\(\s*[`'"](?!\s*select)/i, 'ninguna consulta directa que no sea un select');
  assert.doesNotMatch(codigo, /console\.(log|error)\([^)]*\bconn\b[^)]*\)/, 'no imprime la URL de conexión (sí avisa que falta)');
});

test('sin DATABASE_URL el script se frena antes de conectarse (exit 1, con el modo de uso)', () => {
  const env = { ...process.env }; delete env.DATABASE_URL; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /Falta DATABASE_URL/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Sobre las migraciones REALES
// ---------------------------------------------------------------------------------------------------------------------------------

const reales = () => readdirSync(join(REPO, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => ({ nombre: f, sql: readFileSync(join(REPO, 'supabase', 'migrations', f), 'utf8') }));

test('las migraciones REALES se entienden enteras: ningún DDL queda «sin entender», y la 0283 espera su columna', () => {
  const migs = reales();
  const an = analizarMigraciones(migs);
  assert.deepEqual(an.sinEntender.map(([m, s]) => `${m}: ${s.slice(0, 90)}`), [],
    'una forma de DDL que el analizador no conoce: sumala a scripts/verificar-migraciones-aplicadas.mjs (aplicarSentencia) antes de que alguien lea un informe incompleto');
  assert.ok(migs.length > 300, `hay ${migs.length} migraciones`);
  assert.ok(an.vivos.size > 3000, `se esperan miles de objetos (hoy ~3.300): ${an.vivos.size}`);
  assert.equal(an.vivos.get('columna:public.workspaces.mfa_obligatorio_desde')?.migracion, '0283_mfa_obligatorio.sql', 'el caso que motivó esto');
  const sinObjetos = migs.filter((m) => !an.creadasPor.has(m.nombre)).length;
  assert.ok(sinObjetos < migs.length * 0.1, `casi todas las migraciones crean algo verificable (${sinObjetos} no)`);
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura): 24 roturas, 24 rojas — una salió verde en la primera pasada (la «ausente si falta ALGO»: ningún caso tenía una migración a medias) y se agregó.
//   el analizador (13): create table sin columnas → 6 · add column sólo la primera → 1 · un renombre contado como borrado → 1 · drop table que deja columnas → 2 y índices → 1 · los argumentos OUT contados → 1 · drop function sin firma que no borra las
//     sobrecargas → 1 · un DO que no es condicional → 2 · el RLS que no se quita → 1 · renombrar una tabla sin mover sus columnas → 1 · una tabla temporal esperada → 1 · el DDL sin entender que no se registra → 1 · los comentarios leídos como SQL → 2.
//   el cruce (6): lo dudoso mezclado con lo que falta → 1 · «sobra» nunca → 1 · ausente cuando falta ALGO → 1 · --desde ignorado → 1 · los buckets exigidos sin poder leerlos → 1 · (y las dos claves del catálogo que no coinciden: abajo).
//   las dos mitades (2): la clave de la función del catálogo con otra cantidad de argumentos → 1 · la de la columna sin esquema → 1.
//   sólo lectura (2): una consulta del catálogo con un delete encadenado → 1 · la transacción sin `read only` → 1.
//   el tokenizador (2): las sentencias cortadas dentro de $$ → 2 · los comentarios `--` que no se sacan → 1.
// =============================================================================
