-- =============================================================================
-- 0319_funciones_sin_public — ninguna función de `public` (que no sea de una extensión) ejecutable por la clave pública, de verdad
-- =============================================================================
-- Revisión de la 0318 (Pagos) del 21/10/2026, probada en un Postgres real (PGlite, con los default privileges de Supabase y la 0280):
-- la línea 45 de la 0280 (`alter default privileges for role postgres in schema public revoke execute on functions from public, anon,
-- authenticated`) NO le saca el EXECUTE a PUBLIC. Ese permiso no viene del default del esquema sino del default GLOBAL de Postgres
-- (EXECUTE para PUBLIC en toda función nueva), y un REVOKE por esquema sólo sirve para deshacer un GRANT por esquema, no uno global
-- (documentación de ALTER DEFAULT PRIVILEGES). anon y authenticated son miembros de PUBLIC, así que toda función creada después de la 0280
-- nació ejecutable por la clave anon —la que viaja al navegador (NEXT_PUBLIC_SUPABASE_ANON_KEY)—, aunque su migración jure lo contrario.
-- La 0280, la 0154 y docs/hallazgos-seguridad.md creían lo mismo: «desde la 0280 nacen cerradas». No era cierto.
--
-- Lo que se sabe sin tocar producción (análisis de las migraciones): de las 11 funciones que crean, 10 llevan su revoke de PUBLIC y una no:
-- `pagos_funnel_del_momento` (0310, función de un trigger). Se suma `cobrar_cuota_con_resto` de la 0318 de Pagos cuando llegue. Las
-- funciones que alguien haya creado a mano en el panel de Supabase no figuran en ninguna migración: por eso el paso 2 recorre el catálogo.
--
-- Qué hace:
--  1. El default GLOBAL del dueño de las migraciones (postgres): las funciones que vengan nacen sin EXECUTE para PUBLIC, y con EXECUTE para
--     service_role. Es lo que la 0280 creyó hacer. ⚠️ Es GLOBAL: alcanza a las funciones que postgres cree en CUALQUIER esquema, no sólo en
--     `public`; por eso lleva también el grant a service_role (en `public` ese grant ya lo da el default por esquema de Supabase; en otro esquema
--     no existe, y una función de postgres en `privado` nacería sin PUBLIC y sin service_role: el servidor, que llama con la service role, no
--     podría ejecutarla ni una función de `public` que la use). Más el del esquema, otra vez (idempotente).
--  2. Las funciones que YA existen: revoke de PUBLIC, anon y authenticated, y grant a service_role, en TODA rutina de `public` (función,
--     procedimiento, agregado) cuyo dueño sea quien corre la migración y que NO sea de una extensión (esas no se tocan: ver el punto 4). No hay
--     lista de excepciones: el servidor llama a todas las RPC con la service role (ver «Orden»). Si algún día una función tiene que quedar abierta
--     a anon (un webhook público que se llame desde el navegador con la clave pública), se agrega acá con su porqué escrito y se la saca del bucle.
--  3. `pagos_funnel_del_momento` por nombre (la que ya estaba abierta), para que quede dicho y lo fije el test.
--  4. Lo que esta migración NO cierra se AVISA al aplicarla (WARNING, no aborta): las rutinas de `public` de otro dueño que siguen ejecutables por anon, y —aparte—
--     las FUNCIONES DE EXTENSIONES instaladas en `public`, que quedan fuera del bucle a propósito (son de la extensión). Ojo con ésas: en Supabase un
--     `create extension` sin `with schema` cae en `public`, y si es `http`, `pg_net` o `dblink` la clave anon puede, por /rest/v1/rpc, hacer que el
--     servidor pida una URL o abra una conexión (SSRF). Si el aviso las nombra: mover la extensión a `extensions` (`alter extension … set schema
--     extensions`) o revocarla con su dueño. NO se hace acá porque rompería a quien la use con el nombre de esquema `public`.
--
-- ⚠️ La verificación NO es «cero»: la consulta de abajo cuenta lo que esta migración cierra (rutinas de `public` que no son de una extensión); las de
-- extensiones se miran aparte (el WARNING de acá y `node scripts/medir-funciones-publicas.mjs`, que las lista por extensión).
--
-- Orden de despliegue: SEGURA ANTES O DESPUÉS DEL CÓDIGO. Verificado en el código: los seis `.rpc(` no-test —flow_cerrar_abandonados
-- (cron/flow-abandono), montaje_tomar (cron/montaje y montaje/worker), flow_tomar_trabajos (lib/flow-cola), landing_pago_rechazo_sumar
-- (pago-landing-server) y retencion_vsl_resumen (graficos-datos-extra)— usan SUPABASE_SERVICE_ROLE_KEY, directo o por getSupabaseServer /
-- getTenantDb. Ningún componente de cliente importa supabase-js; la clave anon sólo viaja como `apikey` de las subidas firmadas a Storage
-- (no es un RPC). Las migraciones no crean policies, extensiones, auth hooks ni jobs de pg_cron que dependan de que PUBLIC ejecute una
-- función, y la ejecución de la función de un trigger se mira al CREAR el trigger, no al dispararlo (como dice la 0280).
--
-- Verificación (en el catálogo, nunca leyendo la migración): `select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
-- and has_function_privilege('anon', p.oid, 'execute') and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`
-- tiene que dar 0 (rutinas de la app; las de extensiones, aparte), y `node scripts/medir-funciones-publicas.mjs` lista el detalle. Y un POST
-- anónimo a /rest/v1/rpc/<función> con la clave anon tiene que contestar 401 «42501 permission denied for function», no entrar a la función.
--
-- Requiere la 0310 aplicada (el paso 3 nombra `pagos_funnel_del_momento`); si falta, la migración entera se revierte con «function … does not exist».
-- Idempotente: se puede reaplicar.
-- =============================================================================
begin;

-- 1) Las funciones que vengan: sin EXECUTE para PUBLIC (default GLOBAL de postgres), con EXECUTE para service_role (en CUALQUIER esquema), y, por
--    esquema, sin anon ni authenticated.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres grant execute on functions to service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 2) Las que ya existen. El dueño tiene que ser quien corre la migración (un REVOKE sobre una rutina ajena no hace nada o falla), y las de una
--    extensión (pg_depend 'e') no se tocan: son de la extensión. Sin filtrar por prokind: función, procedimiento, agregado y de ventana; `on routine`
--    sirve para todas (con `on function` un PROCEDURE contesta «is not a function», 42809, y tira abajo toda la migración).
do $$
declare
  f record;
  n int := 0;
begin
  for f in
    select p.oid::regprocedure::text as firma, (p.prorettype = 'trigger'::regtype) as es_trigger
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and pg_get_userbyid(p.proowner) = current_user
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    order by 1
  loop
    execute format('revoke execute on routine %s from public, anon, authenticated', f.firma);
    -- La función de un trigger no se llama a mano: no necesita grant. Las demás las llama el servidor con la service role.
    if not f.es_trigger then
      execute format('grant execute on routine %s to service_role', f.firma);
    end if;
    n := n + 1;
  end loop;
  raise notice '0319: % rutinas de public cerradas a public, anon y authenticated', n;
end $$;

-- 3) La única que una migración dejó abierta (0310), por nombre: función de un trigger; llamada suelta no hace nada.
revoke execute on function public.pagos_funnel_del_momento() from public, anon, authenticated;

-- 4a) Lo que NO se pudo cerrar se dice al aplicarla (WARNING, no aborta): una rutina de `public` de otro dueño que sigue ejecutable por anon. El bucle del paso 2
--     no la toca a propósito (un REVOKE sobre una rutina ajena no hace nada). Las de una extensión van en el 4b.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as firma, pg_get_userbyid(p.proowner) as dueno
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    order by 1
  loop
    raise warning '0319: sigue ejecutable por anon: % (dueño %): cerrala a mano con su dueño', r.firma, r.dueno;
  end loop;
end $$;

-- 4b) Las funciones de EXTENSIONES instaladas en `public`: no se tocan, pero se dicen, una línea por extensión. Una extensión que hace pedidos de red o abre conexiones
--     (http, pg_net, dblink, postgres_fdw, file_fdw) con la clave anon es un SSRF por /rest/v1/rpc.
do $$
declare
  e record;
begin
  for e in
    select x.extname, count(*) as n,
           (x.extname in ('http', 'pg_net', 'dblink', 'postgres_fdw', 'file_fdw', 'plpython3u', 'plperlu', 'adminpack')) as peligrosa
    from pg_proc p
    join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e' and d.refclassid = 'pg_extension'::regclass
    join pg_extension x on x.oid = d.refobjid
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'execute')
    group by x.extname
    order by 1
  loop
    if e.peligrosa then
      raise warning '0319: ⚠️ la extensión % está en public y la clave anon ejecuta %: pedidos de red o conexiones desde /rest/v1/rpc (SSRF). Movela a `extensions` o revocala con su dueño', e.extname, e.n;
    else
      raise warning '0319: la extensión % está en public y la clave anon ejecuta % de sus funciones (no se tocan: son de la extensión)', e.extname, e.n;
    end if;
  end loop;
end $$;

commit;
