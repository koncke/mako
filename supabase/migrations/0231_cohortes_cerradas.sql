-- =============================================================================
-- 0231 — Las vistas de cohortes dejan de leerse con la clave pública
-- =============================================================================
-- Decisión de Martín, 09/10/2026 («terminalo todo», sobre la recomendación de cerrarlas).
--
-- QUÉ ESTABA ABIERTO (medido en producción el 09/10/2026, antes de aplicar):
--   · `v_cohortes_semanales` y `v_cohortes_mensuales` contestaban HTTP 200 con 54 y 19 filas
--     a la clave `anon` Y a la publishable — las dos viajan al navegador
--     (`creative-signurl` la devuelve para subir directo al storage).
--   · Traen, por workspace y por semana o mes, la facturación (`ingreso_total_usd`), los
--     cierres y las asistencias de TODOS los clientes. No son datos personales; sí es lo que
--     un cliente no le muestra a otro.
--   · Eran las ÚNICAS vistas de `public` con SELECT para `anon` (barrido del mismo día).
--
-- POR QUÉ UNA VISTA SE ESCAPA DEL RLS: `alter table … enable row level security` no existe
-- para una vista, y una vista corre con los permisos de SU DUEÑO (postgres), que se saltea el
-- RLS de `leads`. La 0118 cerró las tablas y estas dos quedaron afuera por eso.
--
-- LAS DOS CAPAS:
--   · `security_invoker = on`: la vista lee con los permisos de quien la consulta, así que el
--     RLS de `leads` vuelve a valer aunque mañana alguien le devuelva un grant.
--   · `revoke all … from anon, authenticated`: nadie con la clave pública la lee.
--
-- NO CAMBIA NADA PARA LA APP: el server las lee con la service role (`getTenantDb`,
-- lib/queries.ts), que tiene BYPASSRLS. Medido: ningún cliente de supabase-js con la clave
-- pública las consulta.
--
-- ORDEN DE DESPLIEGUE: indistinto. Sólo cambia permisos; el código no cambia.
-- =============================================================================

alter view v_cohortes_semanales set (security_invoker = on);
alter view v_cohortes_mensuales set (security_invoker = on);

revoke all on v_cohortes_semanales from anon, authenticated;
revoke all on v_cohortes_mensuales from anon, authenticated;
