-- =============================================================================
-- 0283 — desde cuándo un NEGOCIO exige el segundo factor (14/10/2026)
-- =============================================================================
-- Pedido de Martín: el 2FA obligatorio para TODOS, con plazo al 21/10 a las 24:00 (en la
-- hora de cada negocio). No se desloguea a nadie a una hora: el negocio guarda la FECHA y
-- `requiereSegundoFactor` (lib/mfa-reglas.ts) la calcula en cada pedido. Desde esa hora,
-- una sesión sin segundo factor deja de valer y el login pide enrolar uno antes de dejar
-- pasar. A quien ya lo tiene no lo toca (su sesión trae `mfa`).
--
-- null = el negocio no lo exige. La escribe la acción «Exigir el 2FA desde una fecha»
-- (registro de la API, área equipo, SÓLO la plataforma); «Dejar de exigir» la vuelve a null.
--
-- ORDEN DE DESPLIEGUE: indistinto. El código que la lee (lib/mfa-obligatorio.ts) contesta
-- «no exige» si la columna todavía no existe, así que desplegar antes no deja afuera a nadie.
-- Lo que SÍ necesita la columna es la acción que la escribe: aplicarla antes de correrla.
--
-- Es una columna de `workspaces`, que ya tiene su RLS y sus permisos: no agrega función ni
-- vista, así que no lleva revoke propio.
-- =============================================================================

alter table workspaces add column if not exists mfa_obligatorio_desde timestamptz;

comment on column workspaces.mfa_obligatorio_desde is
  'Desde cuándo el negocio exige el segundo factor (null = no lo exige). Lo calcula requiereSegundoFactor en cada pedido.';
