-- =============================================================================
-- 0327 · La UBICACIÓN aproximada de cada computadora conectada (Tus cuentas de IA, 23/10/2026)
-- =============================================================================
-- Martín (por el Cerebro, 23/10/2026): cada dispositivo muestra su ubicación como lo hace Google en «Tus dispositivos»:
-- «Grandbourg, Buenos Aires, Argentina». Sale de los headers de geolocalización que Vercel le pone al latido de la PC
-- (x-vercel-ip-city, x-vercel-ip-country-region, x-vercel-ip-country): ningún servicio de terceros recibe la IP.
-- ⚠️ ES UN DATO PERSONAL: se guarda SÓLO el texto «ciudad, provincia, país» (lib/ia-pc-reglas.ts → textoDeUbicacion).
-- NUNCA la IP ni las coordenadas. Lo ve quien ve ese dispositivo (su dueño, el admin de su negocio y el super admin).
-- Aditiva y segura con el código de antes: nadie la lee. El código nuevo la aguanta ausente: el latido reintenta sin ella y
-- las listas la dejan en null (lib/ia-pc.ts, «FALTA LA MIG 0327»). Se aplica después de la revisión del Cerebro (AGENTS.md).
-- =============================================================================

begin;

alter table ia_pc_dispositivos add column if not exists ubicacion text;

comment on column ia_pc_dispositivos.ubicacion is
  'Ciudad, provincia y país aproximados del último latido (de los headers de Vercel). Nunca la IP ni coordenadas.';

commit;
