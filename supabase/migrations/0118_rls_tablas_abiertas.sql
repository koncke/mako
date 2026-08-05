-- =============================================================================
-- 0118 — cerrar las 15 tablas que quedaron abiertas al rol `anon`
-- =============================================================================
-- HALLAZGO (medido contra producción el 5/8/2026, no deducido): estas 15 tablas
-- tenían relrowsecurity=false y el rol `anon` tenía SELECT/INSERT/UPDATE/DELETE/
-- TRUNCATE sobre todas. Con la clave anon —que Supabase considera PUBLICABLE, no
-- un secreto— se leían filas reales de TODOS los workspaces a la vez, sin login y
-- sin pasar por Next: teléfonos y respuestas de leads, insights, el catálogo de
-- productos, el tablero de tareas de cada cliente, las retros, el gasto de IA y
-- las conversaciones con MaKo. Un PATCH/DELETE con filtro vacío devolvió 204: la
-- escritura también estaba habilitada.
--
-- Las tablas que SÍ tenían RLS (leads, credenciales, usuarios, app_settings,
-- plan_propuestas, plan_tareas) devolvían 0 filas por la misma vía. O sea: el
-- mecanismo funciona donde está puesto; estas 15 se lo saltearon al crearse.
--
-- POR QUÉ NO HAY POLÍTICAS: todo el runtime entra con service_role (lib/supabase.ts),
-- que bypassa RLS por diseño. El aislamiento entre inquilinos lo hace la aplicación
-- (getTenantDb + TENANT_TABLES). RLS acá es la puerta de calle, no el reparto de
-- llaves adentro. Es el mismo contrato de 0099_shares_invitados.sql:38.
--
-- QUÉ NO ROMPE: la app usa la clave anon en UN solo lugar (creative-signurl), y es
-- como `apikey` de Storage —otra API, no PostgREST—, así que no la toca.
-- =============================================================================

alter table anthropic_usage      enable row level security;
alter table chart_chats          enable row level security;
alter table chart_sessions       enable row level security;
alter table experimento_tareas   enable row level security;
alter table funnel_config        enable row level security;
alter table identidades_fiscales enable row level security;
alter table landing_visits       enable row level security;
alter table lead_audit           enable row level security;
alter table lead_insights        enable row level security;
alter table lead_respuestas      enable row level security;
alter table mako_confirmaciones  enable row level security;
alter table pipeline_stages      enable row level security;
alter table productos            enable row level security;
alter table retros               enable row level security;
alter table workspace_telefonos  enable row level security;

-- Cinturón además del tirante: sin el GRANT, ni con RLS mal configurado se llega.
revoke all on anthropic_usage, chart_chats, chart_sessions, experimento_tareas,
              funnel_config, identidades_fiscales, landing_visits, lead_audit,
              lead_insights, lead_respuestas, mako_confirmaciones, pipeline_stages,
              productos, retros, workspace_telefonos
  from anon, authenticated;

-- Y para que la tabla 53 no repita el descuido: lo que se cree de acá en adelante
-- en el schema public nace SIN permisos para anon/authenticated. Aplica solo a las
-- tablas que cree este rol; si alguna migración futura corre con otro dueño, hay
-- que repetir el revoke a mano.
alter default privileges in schema public revoke all on tables from anon, authenticated;
