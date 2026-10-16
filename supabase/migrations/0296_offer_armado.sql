-- =============================================================================
-- 0296 — offer_sesiones.armado: la oferta se ARMA en el servidor (16/10/2026)
-- =============================================================================
-- Hasta acá «Armar mi oferta» eran DOS pedidos que esperaba el navegador (diagnóstico y oferta): si la
-- persona cerraba la pestaña en el primero, la oferta no se hacía nunca. Ahora el servidor corre los dos
-- pasos solo (`after()`, app/api/offer/route.ts) y avisa cuando termina (el evento de la plataforma
-- `oferta_lista`). Esta columna es el armado EN CURSO o el que falló: cuándo arrancó, en qué paso va, de
-- dónde vino y el error para el dueño. null = no hay ninguno. La regla de cuándo vale vive en
-- lib/offer-reglas.ts (`sanearArmado`, `armadoEnCurso`).
--
-- ⚠️ VA ANTES DEL DEPLOY: `armado` entra en las COLS de lib/offer-sesiones.ts y un select con una columna
-- que no existe rechaza la consulta ENTERA (toda lectura de la tabla fallaría). Es aditiva y nullable: el
-- código de antes no la lee, así que aplicarla primero no cambia nada.

alter table public.offer_sesiones add column if not exists armado jsonb;

comment on column public.offer_sesiones.armado is
  'El armado de la oferta en el servidor: { desde, paso: diagnostico|oferta, origen: arranque|tab, intento, error? }. null = ninguno.';

notify pgrst, 'reload schema';
