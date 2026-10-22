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
import { tmpdir } from 'node:os';
import { analizarMigraciones, formatear, leerArgumentos, leerCatalogo, opcionActiva, verificar } from '../scripts/verificar-migraciones-aplicadas.mjs';
import { cierreDeParentesis } from '../scripts/sql-migraciones.mjs';

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

// ---------------------------------------------------------------------------------------------------------------------------------
// «Aplicada» por existir el nombre: un REEMPLAZO no prueba nada (revisión del 21/10/2026: 6 migraciones salían «aplicada» sin haber corrido)
// ---------------------------------------------------------------------------------------------------------------------------------

test('un REEMPLAZO (drop + add con el mismo nombre, create or replace, if not exists) no prueba que la migración corrió: su presencia no cuenta, su ausencia sí', () => {
  const an = analizarMigraciones([
    { nombre: '0100_check.sql', sql: "create table t (tipo text, constraint t_tipo_check check (tipo in ('a')));" },
    { nombre: '0150_check_mas.sql', sql: "alter table t drop constraint t_tipo_check; alter table t add constraint t_tipo_check check (tipo in ('a','b'));" },
    { nombre: '0160_f.sql', sql: 'create function f() returns int language sql as $$ select 1 $$;' },
    { nombre: '0170_f2.sql', sql: 'create or replace function f() returns int language sql as $$ select 2 $$;' },
    { nombre: '0180_idx.sql', sql: 'create index i on t (tipo);' },
    { nombre: '0190_idx2.sql', sql: 'create index if not exists i on t (tipo); create index nuevo on t (tipo);' },
  ]);
  // La base tiene TODO lo que existía antes: las versiones viejas. Si 0150, 0170 y 0190 no corrieron, el informe no puede decir «aplicada» por eso.
  const conTodo = verificar(an, catalogo('tabla:public.t', 'columna:public.t.tipo', 'restriccion:public.t.t_tipo_check', 'funcion:public.f/0', 'indice:public.i', 'indice:public.nuevo'));
  const estado = (r: ReturnType<typeof verificar>) => Object.fromEntries(r.porMigracion.map((m) => [m.nombre, m.estado]));
  assert.equal(estado(conTodo)['0100_check.sql'], 'aplicada', 'la que creó la tabla por primera vez sí se prueba por existir');
  assert.equal(estado(conTodo)['0150_check_mas.sql'], 'reemplaza', 'drop + add del mismo check: el nombre existe por la versión VIEJA, eso no prueba nada');
  assert.equal(estado(conTodo)['0170_f2.sql'], 'reemplaza', 'create or replace de una función que ya existía');
  assert.equal(estado(conTodo)['0190_idx2.sql'], 'aplicada', 'crea un índice NUEVO que sí está: eso sí prueba, y el que sólo re-declara no lo cambia');
  assert.equal(conTodo.porMigracion.find((m) => m.nombre === '0190_idx2.sql')?.reemplazan, 1);
  assert.equal(estado(conTodo)['0160_f.sql'], 'aplicada');
  // La ausencia de un reemplazo SÍ prueba: si el check no está, la 0150 no corrió (y el drop que la deja sin check tampoco).
  const sinCheck = verificar(an, catalogo('tabla:public.t', 'columna:public.t.tipo', 'funcion:public.f/0', 'indice:public.i', 'indice:public.nuevo'));
  assert.equal(estado(sinCheck)['0150_check_mas.sql'], 'ausente');
  // Declarar dos veces lo mismo DENTRO de la misma migración (create table + add column if not exists) no es un reemplazo: es esa migración creándolo.
  const doble = analizarMigraciones([{ nombre: '0200_doble.sql', sql: 'alter table u add column a int; alter table u add column if not exists a int;' }]);
  assert.equal(estado(verificar(doble, catalogo('columna:public.u.a')))['0200_doble.sql'], 'aplicada', 'la misma migración dos veces no es un reemplazo (y su única clave es esa)');
  assert.equal(estado(verificar(doble, catalogo()))['0200_doble.sql'], 'ausente');
  const informe = formatear(an, conTodo);
  assert.match(informe, /2 SIN VERIFICAR/);
  assert.match(informe, /SIN VERIFICAR: sólo REEMPLAZAN[\s\S]*0150_check_mas\.sql — recrea 1 objeto\(s\)[\s\S]*0170_f2\.sql/);
  assert.match(informe, /Re-crear con el mismo nombre/, 'y lo dice entre lo que NO se mira');
});

test('formatear nombra las migraciones de las que NO puede decir nada (sólo datos, grant/revoke, alter … set): ya no desaparecen del informe', () => {
  const an = analizarMigraciones([
    { nombre: '0010_datos.sql', sql: "insert into planes values (1);" },
    { nombre: '0011_grants.sql', sql: 'revoke all on t from anon;' },
    { nombre: '0012_tabla.sql', sql: 'create table x (a int);' },
    { nombre: '0013_borra.sql', sql: 'drop table x;' },
  ]);
  const informe = formatear(an, verificar(an, catalogo()));
  assert.match(informe, /SIN NADA QUE VERIFICAR \(4\)[\s\S]*0010_datos · 0011_grants · 0012_tabla · 0013_borra/, 'las cuatro, por nombre (de la 0012 no queda nada que esperar: la 0013 borra lo que crea)');
  const conObjetos = analizarMigraciones([{ nombre: '0010_tabla.sql', sql: 'create table x (a int);' }, { nombre: '0011_datos.sql', sql: 'insert into x values (1);' }]);
  assert.doesNotMatch(formatear(conObjetos, verificar(conObjetos, catalogo('tabla:public.x', 'columna:public.x.a'))).split('SIN NADA QUE VERIFICAR')[1] ?? '', /0010_tabla/, 'una que crea algo verificable no está en la lista');
  assert.doesNotMatch(formatear(an, verificar(an, catalogo(), { desde: '0013' }), { desde: '0013' }).split('SIN NADA QUE VERIFICAR')[1]?.split('\n')[1] ?? '', /0010_datos/, '--desde también recorta esta lista');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// security_invoker de las vistas (la 0231 cierra las de cohortes a `anon` con eso, y no creaba ninguna clave)
// ---------------------------------------------------------------------------------------------------------------------------------

test('opcionActiva: security_invoker encendido con on/true/1/sin valor; apagado con off/false; create or replace view lo resetea', () => {
  assert.equal(opcionActiva('security_invoker = on', 'security_invoker'), true);
  assert.equal(opcionActiva("security_invoker = 'true'", 'security_invoker'), true);
  assert.equal(opcionActiva('security_barrier = on, security_invoker=true', 'security_invoker'), true);
  assert.equal(opcionActiva('security_invoker', 'security_invoker'), true, 'una opción booleana sin valor es verdadera');
  assert.equal(opcionActiva('security_invoker = off', 'security_invoker'), false);
  assert.equal(opcionActiva('security_barrier = on', 'security_invoker'), false);
  assert.equal(opcionActiva(' with (security_invoker = on) as select 1', 'security_invoker', true), true, 'en un create view, el with antes del as');
  assert.equal(opcionActiva(" as select 'with (security_invoker = on)'", 'security_invoker', true), false, 'lo que está DESPUÉS del as (un string, una CTE) no cuenta');
  const an = analizarMigraciones([
    { nombre: '0001_v.sql', sql: 'create view v as select 1; create view w as select 1; create view x with (security_invoker = on) as select 1; create view y as select 1; create view z as select 1;' },
    { nombre: '0002_inv.sql', sql: 'alter view v set (security_invoker = on); alter view w set (security_invoker = true); alter view y set (security_invoker = on); alter view z set (security_invoker = on);' },
    { nombre: '0003_resetea.sql', sql: 'create or replace view w as select 2; alter view y set (security_invoker = off); alter view z reset (security_invoker); drop view if exists nada;' },
  ]);
  assert.deepEqual([...an.vivos.keys()].filter((c) => c.startsWith('invoker:')).sort(), ['invoker:public.v', 'invoker:public.x'], 'w lo pierde por el create or replace; y y z por el off y el reset');
  assert.deepEqual(an.sinEntender, []);
  const borrada = analizarMigraciones([{ nombre: '0001_v.sql', sql: 'create view v as select 1; alter view v set (security_invoker = on);' }, { nombre: '0002_d.sql', sql: 'drop view v;' }]);
  assert.deepEqual([...borrada.vivos.keys()], [], 'una vista borrada no se espera ni con su opción');
});

test('security_invoker: el lector del catálogo lo lee de pg_class.reloptions, y una vista sin la opción deja a la migración AUSENTE', async () => {
  const an = analizarMigraciones([
    { nombre: '0001_v.sql', sql: 'create view v as select 1; create view w as select 1;' },
    { nombre: '0002_inv.sql', sql: 'alter view v set (security_invoker = on); alter view w set (security_invoker = on);' },
  ]);
  const filas = (o: Record<string, string | null>) => async (texto: string) => (/from pg_class c/.test(texto) && /relrowsecurity/.test(texto)
    ? Object.entries(o).map(([n, op]) => ({ e: 'public', n, t: 'v', rls: false, o: op }))
    : []);
  const bien = await leerCatalogo(filas({ v: '{security_invoker=on}', w: '{security_barrier=true,security_invoker=true}' }));
  assert.ok(bien.claves.has('invoker:public.v') && bien.claves.has('invoker:public.w'), 'on y true, solos o con otras opciones');
  assert.equal(estadoDe(verificar(an, bien), '0002_inv.sql'), 'aplicada');
  const mal = await leerCatalogo(filas({ v: '{security_invoker=on}', w: null }));
  assert.ok(!mal.claves.has('invoker:public.w'), 'una vista sin reloptions no es invoker');
  assert.equal(estadoDe(verificar(an, mal), '0002_inv.sql'), 'a-medias', 'la 0231 «aplicada» sólo con las dos vistas en security_invoker');
  const off = await leerCatalogo(filas({ v: '{security_invoker=off}', w: '{security_invoker=on}' }));
  assert.ok(!off.claves.has('invoker:public.v'), 'security_invoker=off tampoco');
});
const estadoDe = (r: ReturnType<typeof verificar>, nombre: string) => r.porMigracion.find((m) => m.nombre === nombre)?.estado;

// ---------------------------------------------------------------------------------------------------------------------------------
// Los bajos de la revisión: storage.buckets dentro de la transacción, los argumentos, la carpeta de migraciones, el tokenizador
// ---------------------------------------------------------------------------------------------------------------------------------

test('storage.buckets: se PREGUNTA si se puede leer antes de leerlo (un select que falla dentro de la transacción la tira entera)', async () => {
  const consultas: string[] = [];
  const leer = (ok: boolean | undefined, ids: string[]) => async (texto: string) => {
    consultas.push(texto);
    if (/to_regclass\('storage\.buckets'\)/.test(texto)) return ok === undefined ? [] : [{ ok }];
    if (/from storage\.buckets/.test(texto)) return ids.map((id) => ({ id }));
    return [];
  };
  const no = await leerCatalogo(leer(false, ['bk']));
  assert.equal(no.buckets, false, 'sin acceso a storage los buckets no se verifican');
  assert.ok(!consultas.some((q) => /^\s*select id from storage\.buckets/.test(q)), 'y NO se lee storage.buckets: ese select es el que tiraría abajo la corrida');
  const si = await leerCatalogo(leer(true, ['bk', 'otro']));
  assert.equal(si.buckets, true);
  assert.ok(si.claves.has('bucket:bk') && si.claves.has('bucket:otro'));
  assert.equal((await leerCatalogo(leer(true, []))).buckets, true, 'con acceso y sin ningún bucket, los buckets SE verifican (y faltan todos)');
  const pregunta = consultas.find((q) => /to_regclass/.test(q)) ?? '';
  assert.match(pregunta, /^\s*select\b/i);
  assert.match(pregunta, /case when to_regclass\('storage\.buckets'\) is null then false else[\s\S]*has_table_privilege/, 'el permiso se mira sólo si la tabla existe: has_table_privilege tira error si no existe');
});

test('leerArgumentos: --json y --desde en cualquier posición (primero también), con valor; lo que no entiende se dice', () => {
  assert.deepEqual(leerArgumentos(['--json', 's.json']), { json: 's.json', desde: '', detalle: false, malos: [] }, 'un --json PRIMERO se ignoraba en silencio (indexOf > 0)');
  assert.deepEqual(leerArgumentos(['--desde', '0200', '--detalle', '--json', 'a.json']), { json: 'a.json', desde: '0200', detalle: true, malos: [] });
  assert.deepEqual(leerArgumentos(['--desde']).malos, ['--desde (sin valor)']);
  assert.deepEqual(leerArgumentos(['--json', '--detalle']).malos, ['--json (sin valor)'], 'no toma una opción por su valor');
  assert.deepEqual(leerArgumentos(['--detalles', 'x']).malos, ['--detalles', 'x'], 'un error de tipeo no se ignora');
});

test('el script lee las migraciones de SU carpeta (no del cwd), dice cuántas y cuál es la última, y rechaza un argumento que no entiende', () => {
  const env = { ...process.env }; delete env.DATABASE_URL; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: tmpdir(), encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /\[verificar-migraciones\] \d{3} migraciones leídas de .*supabase[\\/]migrations[\\/]? \(la última: \d{4}_/, 'corrido desde OTRA carpeta, igual lee las del repo del script');
  assert.ok(r.stdout.replace(/\\/g, '/').includes(REPO.replace(/\\/g, '/').replace(/\/$/, '')), 'y dice de cuál carpeta');
  const mal = spawnSync(process.execPath, [SCRIPT, '--detalles'], { cwd: REPO, encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(mal.status, 2, `${mal.stdout}${mal.stderr}`);
  assert.match(mal.stderr, /argumento\(s\) que no entiendo: --detalles/);
});

test('el tokenizador: un `)` entre comillas no cierra la lista, y un renombre de índice o de restricción va a «sin entender» (no se sigue esperando el nombre viejo en silencio)', () => {
  const t1 = "(a text default ')', b int)";
  assert.equal(cierreDeParentesis(t1, 0), t1.length - 1, 'el paréntesis de la comilla no cierra: cierra el último');
  const t2 = '(a int default (1), "col)" int)';
  assert.equal(cierreDeParentesis(t2, 0), t2.length - 1, 'ni el de un identificador entre comillas, y uno anidado se cuenta');
  assert.equal(cierreDeParentesis('(abierto', 0), -1);
  assert.deepEqual(claves("create table t (id int, a text default ')', b int, constraint t_chk check (id > 0));"), ['columna:public.t.a', 'columna:public.t.b', 'columna:public.t.id', 'restriccion:public.t.t_chk', 'tabla:public.t'], 'la columna b y la restricción t_chk SÍ se esperan');
  assert.deepEqual(claves("create function f(a text default ')', b int) returns int language sql as $$ select 1 $$;"), ['funcion:public.f/2'], 'dos argumentos aunque uno traiga un `)` en el default');
  for (const sql of ['alter index i rename to j;', 'alter table t rename constraint a to b;', 'alter trigger tr on t rename to tr2;', 'alter view v rename to w;', 'alter sequence s rename to s2;']) {
    assert.equal(un(sql).sinEntender.length, 1, `«${sql}» se dice, no se ignora`);
  }
  assert.equal(un('alter table t rename to u;').sinEntender.length, 0, 'renombrar una tabla sí se sigue');
  assert.equal(un('alter table t rename column a to b;').sinEntender.length, 0, 'y una columna también');
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

test('sobre las REALES: saltear la 0150, 0177_capa_agencia, 0199, 0257, 0084 o 0057 ya NO sale «aplicada», y saltear la 0231 (security_invoker de las cohortes) sale AUSENTE', () => {
  const migs = reales();
  const an = analizarMigraciones(migs);
  const nombre = (p: string) => migs.find((m) => m.nombre.startsWith(p))?.nombre ?? `(no hay ${p})`;
  const sinLa = (saltear: string) => {
    // La base «tiene todo lo que crean las OTRAS migraciones»: lo que sólo crea la saltada no está; lo que otra ya había creado (y ella recrea) sí.
    const c = new Set<string>();
    for (const [mig, cl] of an.creadasPor) if (mig !== saltear) for (const x of cl) if (an.vivos.has(x)) c.add(x);
    for (const [clave, v] of an.vivos) if (v.migracion !== saltear) c.add(clave);
    return verificar(an, { claves: c, buckets: true }).porMigracion.find((m) => m.nombre === saltear);
  };
  for (const p of ['0057', '0084', '0150', '0177_capa_agencia', '0199', '0257']) {
    const m = sinLa(p === '0177_capa_agencia' ? nombre('0177_capa_agencia') : nombre(p));
    assert.ok(m && m.estado !== 'aplicada', `${p}: saltearla no puede dar «aplicada» (da ${m?.estado})`);
  }
  assert.ok(an.vivos.has('invoker:public.v_cohortes_semanales') && an.vivos.has('invoker:public.v_cohortes_mensuales'), 'la 0231 espera security_invoker en las dos vistas de cohortes');
  const m231 = sinLa(nombre('0231'));
  assert.ok(m231 && ['ausente', 'a-medias'].includes(m231.estado), `saltear la 0231 aparece en el informe (da ${m231?.estado}), antes «no aparecía»`);
  assert.ok(m231.faltan.some((c) => c.startsWith('invoker:')), 'y dice que faltan los invoker');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura): 24 roturas, 24 rojas — una salió verde en la primera pasada (la «ausente si falta ALGO»: ningún caso tenía una migración a medias) y se agregó.
//   el analizador (13): create table sin columnas → 6 · add column sólo la primera → 1 · un renombre contado como borrado → 1 · drop table que deja columnas → 2 y índices → 1 · los argumentos OUT contados → 1 · drop function sin firma que no borra las
//     sobrecargas → 1 · un DO que no es condicional → 2 · el RLS que no se quita → 1 · renombrar una tabla sin mover sus columnas → 1 · una tabla temporal esperada → 1 · el DDL sin entender que no se registra → 1 · los comentarios leídos como SQL → 2.
//   el cruce (6): lo dudoso mezclado con lo que falta → 1 · «sobra» nunca → 1 · ausente cuando falta ALGO → 1 · --desde ignorado → 1 · los buckets exigidos sin poder leerlos → 1 · (y las dos claves del catálogo que no coinciden: abajo).
//   las dos mitades (2): la clave de la función del catálogo con otra cantidad de argumentos → 1 · la de la columna sin esquema → 1.
//   sólo lectura (2): una consulta del catálogo con un delete encadenado → 1 · la transacción sin `read only` → 1.
//   el tokenizador (2): las sentencias cortadas dentro de $$ → 2 · los comentarios `--` que no se sacan → 1.
// REVISIÓN DEL CEREBRO (21/10 tarde): 24 roturas, 24 rojas (una salió verde la primera vez: «un reemplazo dentro de la MISMA migración», porque la migración de prueba tenía otra clave que daba la prueba; ahora su única clave es la repetida).
//   los reemplazos (6): sin marcarlos → 2 · marcados aunque sean de la misma migración → 1 · el dueño que pasa al que reemplaza → 1 · su presencia que cuenta como prueba → 2 · su ausencia que no cuenta → 1 · el estado «reemplaza» que nunca se dice → 2.
//   «sin nada que verificar» (2): sin nombrarlas → 1 · --desde que no recorta la lista → 1.
//   security_invoker (6): create or replace que no lo resetea → 1 · alter view set que no crea la clave → 3 · off/reset que no la quitan → 1 · drop view que no la quita → 1 · el catálogo que no lee reloptions → 1 · una opción sin valor que no es verdadera → 1.
//   los bajos (10): storage.buckets leído sin preguntar → 2 · los buckets sin filas que no se verifican → 1 · --json primero ignorado → 1 · un argumento desconocido ignorado → 1 · --desde sin valor aceptado → 1 · las migraciones del cwd → 1 ·
//     un `)` entre comillas que cierra la lista (create table) → 1 y (cierreDeParentesis) → 1 · un renombre de restricción ignorado → 1 · un renombre de índice ignorado → 1.
// =============================================================================
