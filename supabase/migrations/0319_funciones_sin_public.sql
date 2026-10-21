-- =============================================================================
-- 0319_funciones_sin_public — NINGUNA función de `public` ejecutable por la clave pública, de verdad
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
--  1. El default GLOBAL del dueño de las migraciones (postgres): las funciones que vengan nacen sin EXECUTE para PUBLIC. Es lo que la 0280
--     creyó hacer. Más el del esquema, otra vez (idempotente).
--  2. Las funciones que YA existen: revoke de PUBLIC, anon y authenticated, y grant a service_role, en TODA función de `public` cuyo dueño
--     sea quien corre la migración (postgres) y que NO sea de una extensión (esas no se tocan). No hay lista de excepciones: el servidor
--     llama a todas las RPC con la service role (ver «Orden»). Si algún día una función tiene que quedar abierta a anon (un webhook público
--     que se llame desde el navegador con la clave pública), se agrega acá con su porqué escrito y se la saca del bucle.
--  3. `pagos_funnel_del_momento` por nombre (la que ya estaba abierta), para que quede dicho y lo fije el test.
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
-- tiene que dar 0, y `node scripts/medir-funciones-publicas.mjs` lista el detalle. Y un POST anónimo a /rest/v1/rpc/<función> con la
-- clave anon tiene que contestar 401 «42501 permission denied for function», no entrar a la función.
--
-- Idempotente: se puede reaplicar.
-- =============================================================================
begin;

-- 1) Las funciones que vengan: sin EXECUTE para PUBLIC (default GLOBAL de postgres) y, por esquema, sin anon ni authenticated.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 2) Las que ya existen. El dueño tiene que ser quien corre la migración (un REVOKE sobre una función ajena no hace nada o falla), y las
--    de una extensión (pg_depend 'e') no se tocan: son de la extensión.
do $$
declare
  f record;
  n int := 0;
begin
  for f in
    select p.oid::regprocedure::text as firma, (p.prorettype = 'trigger'::regtype) as es_trigger,
           case p.prokind when 'p' then 'procedure' else 'function' end as clase
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind in ('f', 'p')
      and pg_get_userbyid(p.proowner) = current_user
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    order by 1
  loop
    -- Un PROCEDURE (prokind 'p') se revoca con `on procedure`: con `on function` Postgres contesta «is not a function» (42809) y tira abajo toda la migración.
    execute format('revoke execute on %s %s from public, anon, authenticated', f.clase, f.firma);
    -- La función de un trigger no se llama a mano: no necesita grant. Las demás las llama el servidor con la service role.
    if not f.es_trigger then
      execute format('grant execute on %s %s to service_role', f.clase, f.firma);
    end if;
    n := n + 1;
  end loop;
  raise notice '0319: % funciones de public cerradas a public, anon y authenticated', n;
end $$;

-- 3) La única que una migración dejó abierta (0310), por nombre: función de un trigger; llamada suelta no hace nada.
revoke execute on function public.pagos_funnel_del_momento() from public, anon, authenticated;

-- 4) Lo que NO se pudo cerrar se dice al aplicarla (WARNING, no aborta): una función de `public` de otro dueño que sigue ejecutable por anon. El bucle del
--    paso 2 no la toca a propósito (un REVOKE sobre una función ajena no hace nada). Las de una extensión no se listan: son de la extensión.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as firma, pg_get_userbyid(p.proowner) as dueno
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind in ('f', 'p')
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    order by 1
  loop
    raise warning '0319: sigue ejecutable por anon: % (dueño %): cerrala a mano con su dueño', r.firma, r.dueno;
  end loop;
end $$;

commit;
