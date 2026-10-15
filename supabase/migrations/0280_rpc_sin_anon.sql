-- =============================================================================
-- 0280_rpc_sin_anon — las RPC de las colas, sin la clave pública
-- =============================================================================
-- Auditoría de seguridad del 14/10/2026 (chat «Ciberseguridad»). Medido en el catálogo de
-- producción: `flow_tomar_trabajos(bigint,int)` y `flow_cerrar_abandonados(int)` son SECURITY
-- DEFINER con dueño postgres (que se saltea el RLS) y tenían EXECUTE para anon y authenticated.
-- La clave anon viaja al navegador (es NEXT_PUBLIC_SUPABASE_ANON_KEY, y las subidas firmadas la
-- devuelven), así que cualquiera podía, por la REST de Supabase y sin pasar por proxy.ts, tomar
-- los trabajos de Flow de CUALQUIER workspace (prompts e imágenes en base64) o cerrarlos todos
-- en una llamada.
--
-- ⚠️ El comentario de la 0154 dice «SIN GRANT A anon NI A authenticated», y su
-- `revoke all ... from public` no los saca: Supabase les da EXECUTE DIRECTO por default
-- privileges (pg_default_acl, postgres/public/f: anon=X, authenticated=X). La 0118 cerró eso
-- para las TABLAS; para las FUNCIONES seguía abierto. Acá se cierra también para las que vengan.
--
-- `montaje_tomar` es SECURITY INVOKER (el RLS la frena) y se cierra igual: no la llama nadie
-- más que el server.
--
-- Orden de despliegue: cuando sea, antes o después del código. Ningún código depende de estos
-- grants: el server llama a las tres con la service role (lib/flow-cola.ts,
-- app/api/cron/flow-abandono/route.ts, app/api/montaje/worker/route.ts).
--
-- Verificación: un GET anónimo a /rest/v1/rpc/flow_tomar_trabajos?p_ws=999999&p_cuantos=1 con
-- la clave anon tiene que contestar 401 «42501 permission denied». Antes contestaba 405
-- «25006 cannot execute UPDATE in a read-only transaction», o sea que ENTRABA a la función.
-- =============================================================================
begin;

revoke execute on function public.flow_tomar_trabajos(bigint, integer) from public, anon, authenticated;
revoke execute on function public.flow_cerrar_abandonados(integer) from public, anon, authenticated;
revoke execute on function public.montaje_tomar(integer) from public, anon, authenticated;
-- La cuarta y última de `public` que anon podía ejecutar (medido en pg_proc el 14/10). Es la
-- función de un trigger: llamada suelta no hace nada, y quitarle el EXECUTE no cambia cómo
-- dispara (el permiso se mira al CREAR el trigger). Va para que el invariante quede limpio:
-- NINGUNA función de public ejecutable por la clave pública.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

grant execute on function public.flow_tomar_trabajos(bigint, integer) to service_role;
grant execute on function public.flow_cerrar_abandonados(integer) to service_role;
grant execute on function public.montaje_tomar(integer) to service_role;

-- La próxima función que cree una migración (corren como postgres) ya no nace abierta a la
-- clave pública: hay que dársela a propósito.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
