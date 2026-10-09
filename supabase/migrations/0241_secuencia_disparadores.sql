-- =============================================================================
-- 0241_secuencia_disparadores — VARIOS CRON por automatización de /chatbot
-- =============================================================================
-- Pedido de Martín (09/10/2026, sexta tanda, CRON punto 10): «Me gusta que se vea la opción de Cron
-- que seleccioné y abajo también "+Nuevo CRON", es decir, agrega la opción de tener más de un CRON».
-- El modelo vive en lib/disparadores.ts (puro, con test); lo que costó, en
-- docs/hallazgos-chatbot.md → «Parte disparadores».
--
--  · `nutricion_secuencias.disparadores` (jsonb) — la LISTA entera de los CRON:
--    `[{ id, trigger_tipo, etapa?, etapas?, funnel_id?, producto_id?, etiqueta_id?, ignorar?,
--    subtipo?, cron?, cron_proxima_at?, grupo? }]`. El PRIMERO es el disparador de siempre y su
--    verdad siguen siendo las COLUMNAS (`trigger_tipo`, `etapa`, `etapas`, `funnel_id`, `producto_id`,
--    `etiqueta_id`, `cron`, `cron_proxima_at`): de la lista toma sólo lo que las columnas no tienen
--    (`ignorar`, `subtipo`, `grupo`, el id), y sólo si es del mismo `trigger_tipo`
--    (`disparadoresDe`). Así los quince lectores que no saben de listas —la API de MaKo, /email, el
--    generador de copy, la clonación, Customer Success— siguen leyendo exactamente lo de antes, y un
--    escritor viejo que cambia el disparador de siempre no se lleva puestos los demás.
--  · `nutricion_secuencias.disparadores_rev` — el compare-and-set de la lista: cada escritura lo sube
--    en 1 y exige el que leyó. La lista tiene adentro la próxima ocurrencia de cada Recurrente
--    (`cron_proxima_at` de los CRON que no son el primero), y la escriben DOS: la pantalla al guardar
--    y el motor al avanzar la ocurrencia (`comprometerInscripciones`). Sin esto, dos invocaciones del
--    mismo tick inscribían dos veces (el mismo agujero que el `.eq('cron_proxima_at', …)` del primero
--    ya cerró, medido: 21 pares duplicados el 27/09), o un guardado pisaba la ocurrencia recién
--    avanzada.
--
-- SIN BACKFILL: NULL = la lista de UNO, el de las columnas, que es exactamente cómo dispara hoy cada
-- automatización. Medido el 09/10/2026: 10 secuencias vivas, 0 con horario, 3 prendidas (198, 212,
-- 213), ninguna por etiqueta.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY (recomendado), pero el código la TOLERA ausente, a
-- propósito (como la 0230 y la 0233; al revés que la 0229): las lecturas del motor
-- (`leerFilasDeSecuencias`, lib/nutricion.ts) piden la lista y, con 42703 / PGRST204, vuelven a pedir
-- sin ella — cada automatización dispara por sus columnas, como hoy, y queda el log. Guardar DOS o más
-- CRON sin la columna contesta «Aún no se pueden varios CRON» (guardar sólo el primero sería guardar
-- otra cosa que lo elegido, en silencio); guardar UNO escribe las columnas, como siempre. Lo que queda
-- sin poder hacerse hasta aplicarla es justamente lo pedido: el segundo CRON. Y mientras falte, cada
-- lectura del motor hace un pedido de más (el que falla): aplicarla también saca eso.
-- =============================================================================

begin;

alter table public.nutricion_secuencias
  add column if not exists disparadores jsonb,
  add column if not exists disparadores_rev integer not null default 0;

-- El CHECK va aparte y con nombre: `add column if not exists … check` no lo agrega si la columna ya
-- existía (un no-op silencioso que deja creyendo que la restricción está; la 0203 y la 0228).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nutricion_secuencias_disparadores_chk') then
    alter table public.nutricion_secuencias add constraint nutricion_secuencias_disparadores_chk
      check (disparadores is null or jsonb_typeof(disparadores) = 'array');
  end if;
end $$;

comment on column public.nutricion_secuencias.disparadores is
  'Los CRON de la automatización: [{id, trigger_tipo, …}]. El primero es el de las columnas de siempre (su verdad son ellas); de acá toma sólo ignorar, subtipo, grupo y el id. NULL = sólo el de las columnas. Ver lib/disparadores.ts.';
comment on column public.nutricion_secuencias.disparadores_rev is
  'Compare-and-set de disparadores: cada escritura lo sube en 1 y exige el valor que leyó (la pantalla al guardar y el motor al avanzar la ocurrencia de un Recurrente).';

commit;
