-- ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy.
-- El código nuevo YA lee estas dos columnas (lib/nutricion.ts), y un `select` de
-- PostgREST con UNA columna que no existe rechaza la consulta ENTERA: entre un
-- deploy sin las columnas y esta migración, `getSecuenciasActivas` devolvería vacío
-- y la nutrición no inscribiría ni enviaría nada, SIN UN SOLO ERROR.
--
-- QUÉ ES: el horario de una secuencia, para que se pueda disparar POR TIEMPO y no
-- sólo por una acción (pedido del 05/10/2026 sobre el lienzo del chatbot: «con las 2
-- opciones por tiempo o por acción»). La forma del horario es la MISMA que ya usan
-- los avisos (lib/cron-aviso.ts: unidad, cada, hora, minuto, diaSemana, diaMes, mes),
-- y se guarda con el mismo saneador — un segundo formato para la misma pregunta es
-- cómo se desincronizan dos pantallas que dicen lo mismo.
--
-- `null` = se dispara por una acción, que es lo que hacen hoy las 62 filas. O sea:
-- SIN BACKFILL y sin cambio de comportamiento para nada de lo que ya existe.
alter table public.nutricion_secuencias
  add column if not exists cron jsonb,
  -- La próxima ocurrencia AGENDADA. No es «cuándo salió»: es el ancla con la que se
  -- calcula la siguiente, y por eso se guarda aparte de cualquier `updated_at`. Con
  -- `now()` como ancla el horario deriva (lib/nutricion-agenda.ts lo explica).
  add column if not exists cron_proxima_at timestamptz;

comment on column public.nutricion_secuencias.cron is
  'Horario con el que la secuencia inscribe (formato CronAviso de lib/cron-aviso.ts). null = se dispara por una accion.';
comment on column public.nutricion_secuencias.cron_proxima_at is
  'Proxima ocurrencia AGENDADA. Se avanza con compare-and-set desde este valor, nunca desde now().';
