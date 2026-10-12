-- =============================================================================
-- 0262 — landing_visits: de dónde viene cada visita (país, región, ciudad y coordenadas redondeadas)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy del Dashboard v5. Es lo que el código nuevo YA
-- ESCRIBE (el beacon del Pixel, app/api/track/vsl/route.ts) y YA LEE (el conjunto `ubicacion`,
-- lib/graficos-datos-extra.ts). Agrega columnas nulables y no saca nada: la versión desplegada no las
-- nombra, así que aplicarla antes no le molesta a nadie.
--    · Si el deploy sale ANTES: el beacon detecta la columna que falta (42703/PGRST204) y guarda la visita SIN
--      la ubicación —una columna inexistente tira la fila ENTERA, y así se perdieron una vez los pageviews de
--      producción (tests/landing-optin.test.ts)—; el gráfico «De dónde te visitan» dice «No pude leer».
--
-- ⚠️ EL NÚMERO: 0261 es `retencion_vsl_resumen`, de la misma tanda. Si al integrar alguien ya usó 0262, se
-- RENUMERA antes de pushear y se borra el archivo viejo.
--
-- DECISIÓN DE MARTÍN (12/10/2026, contrato docs/relevo/dashboard-v5.md, decisión 4): «Se guarda país, región
-- y ciudad de cada visita del Pixel (de los headers `x-vercel-ip-*`, NUNCA la IP), y se suma al aviso de
-- privacidad. El mapa dibuja cualquier país por región (Meta) y ciudades como burbujas (datos propios).»
-- Meta no da ciudades (sólo país y región): esto es lo único con lo que un negocio ve SUS ciudades.
--
-- Lo que se guarda (lo arma `ubicacionDeHeaders`, lib/graficos-datos-puro.ts, puro y con test):
--   · pais    — ISO 3166-1 alfa-2 («MX»), de `x-vercel-ip-country`.
--   · region  — la parte de la región del ISO 3166-2 («BCN»), de `x-vercel-ip-country-region`. El lector la
--               devuelve completa («MX-BCN»): así calza con la geometría (Natural Earth) sin diccionario.
--   · ciudad  — de `x-vercel-ip-city` (llega codificada como URL; se decodifica).
--   · lat/lon — de `x-vercel-ip-latitude/longitude`, REDONDEADAS a un decimal (~11 km): alcanza para ubicar
--               una ciudad y no ubica a nadie.
-- ⚠️ NUNCA LA IP: no hay columna para ella y el beacon no la lee para esto (la de `clientIp` es sólo del
-- anti-flood). Una visita sin headers (otra plataforma, un pedido de prueba) va con las cinco en null.
--
-- Sin índice: el conjunto `ubicacion` lee las visitas del período por (workspace_id, created_at), el índice
-- que ya existe; agrupar por país o ciudad es en memoria.
-- =============================================================================

begin;

alter table landing_visits add column if not exists pais text;
alter table landing_visits add column if not exists region text;
alter table landing_visits add column if not exists ciudad text;
alter table landing_visits add column if not exists lat numeric(4, 1);
alter table landing_visits add column if not exists lon numeric(4, 1);

comment on column landing_visits.pais is 'ISO 3166-1 alfa-2 de la visita (x-vercel-ip-country). NUNCA se guarda la IP. Mig 0262.';
comment on column landing_visits.region is 'La parte de la región del ISO 3166-2 (x-vercel-ip-country-region): «BCN» de MX-BCN. Mig 0262.';
comment on column landing_visits.ciudad is 'La ciudad (x-vercel-ip-city, decodificada). Mig 0262.';
comment on column landing_visits.lat is 'Latitud redondeada a un decimal (~11 km): ubica una ciudad, no a una persona. Mig 0262.';
comment on column landing_visits.lon is 'Longitud redondeada a un decimal (~11 km). Mig 0262.';

commit;

notify pgrst, 'reload schema';
