-- =============================================================================
-- 0167 — la recurrencia, como la guarda Google Calendar: una RRULE
-- =============================================================================
-- «El tema de la frecuencia, copialo tal cual como lo hace Google Calendar… porque puede ser
-- personalizado, varios días de la semana, etc. Pero más simple, investiga y copialo tal
-- cual» (26/09/2026).
--
-- Investigado: el diálogo «Personalizado» de Google tiene (1) «Repetir cada [N]
-- [día|semana|mes|año]», (2) si la unidad es semana, VARIOS días a la vez, (3) si es mes,
-- «el día 15» o «el segundo martes», y (4) «Termina: nunca / el [fecha] / después de [N]».
-- Y por debajo Google no guarda un enum: guarda una **RRULE de RFC 5545**.
--
-- ⚠️ POR QUÉ UNA SOLA COLUMNA DE TEXTO Y NO CUATRO CAMPOS NUESTROS. Las 0165 y 0166 habían
-- modelado esto con `frecuencia` (enum de 6) + `frecuencia_dia` (texto), y ese modelo NO
-- puede expresar lo que Martín pidió: «varios días de la semana» necesita una lista,
-- «cada 3 semanas» necesita un intervalo, y «el segundo martes» necesita un ordinal. Cada
-- una de esas tres sería otra columna, y una recurrencia tiene UNA forma por vez: con cuatro
-- columnas, pasar de «cada semana, los lunes» a «cada mes» deja las viejas vivas
-- contradiciendo a la nueva. Es el mismo modo de falla que el `deadline` que sobrevivía a
-- marcar algo recurrente, multiplicado por cuatro.
--
-- La RRULE lo dice todo en un string y es un ESTÁNDAR, así que el día que esto genere la
-- próxima ocurrencia de verdad, cualquier librería la expande sin traducir nada:
--   FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR      cada 2 semanas, lunes miércoles y viernes
--   FREQ=MONTHLY;BYMONTHDAY=15                 el 15 de cada mes
--   FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2           el segundo martes de cada mes
--
-- ⚠️ LO QUE **NO** SE COPIA, Y ES A PROPÓSITO: `UNTIL` y `COUNT` — el «Termina» de Google.
-- Nada en este producto calcula la próxima ocurrencia: el día es una ETIQUETA, no dispara
-- ni el reparto diario ni un aviso ni un recordatorio. «Después de 12 repeticiones» sería un
-- dato que nadie lee jamás y un control que no hace nada, que es justo lo que la casa
-- prohíbe. Vuelve el día que la recurrencia genere algo.
alter table plan_tareas        add column if not exists recurrencia text;
alter table experimento_tareas add column if not exists recurrencia text;
alter table plan_proyectos     add column if not exists recurrencia text;
alter table tarea_categorias   add column if not exists recurrencia text;

-- ── EL BACKFILL, desde las dos columnas que esto reemplaza ───────────────────
-- Se hace acá y no «cuando alguien vuelva a guardar»: una regla que se aplica al ESCRIBIR
-- no arregla ni una fila ya escrita, y en un tablero la mayoría no se toca nunca.
do $$
declare t text;
begin
  foreach t in array array['plan_tareas', 'experimento_tareas', 'plan_proyectos', 'tarea_categorias'] loop
    execute format($f$
      update %I set recurrencia =
        case frecuencia
          when 'diaria'     then 'FREQ=DAILY'
          when 'semanal'    then 'FREQ=WEEKLY'    || coalesce(';BYDAY=' || nullif(upper(left(frecuencia_dia, 2)), ''), '')
          when 'quincenal'  then 'FREQ=WEEKLY;INTERVAL=2' || coalesce(';BYDAY=' || nullif(upper(left(frecuencia_dia, 2)), ''), '')
          when 'mensual'    then 'FREQ=MONTHLY'   || coalesce(';BYMONTHDAY=' || nullif(frecuencia_dia, ''), '')
          when 'trimestral' then 'FREQ=MONTHLY;INTERVAL=3' || coalesce(';BYMONTHDAY=' || nullif(frecuencia_dia, ''), '')
          when 'anual'      then 'FREQ=YEARLY'    || coalesce(';BYMONTHDAY=' || nullif(frecuencia_dia, ''), '')
          else null
        end
      where recurrente = true and frecuencia is not null and recurrencia is null
    $f$, t);
  end loop;
end $$;

-- ⚠️ `BYDAY` SE ARMA CON LOS DOS PRIMEROS CARACTERES EN MAYÚSCULA, Y ESO ES MAL PARA CINCO
-- DE LOS SIETE DÍAS. Acá había un comentario que decía «lun→MO, sab→SA y dom→SU ya salen
-- bien»: falso, y es el tipo de afirmación que se escribe sin correrla. `left('lun',2)` es
-- `lu` → `LU`, que no existe en RFC 5545; `dom` da `DO`, que tampoco. El único que salía
-- bien por casualidad era `sab` → `SA`.
--
-- No llegó a escribir una fila mala —se midió después: 1 sola fila con recurrencia en toda
-- la base, `FREQ=WEEKLY` y sin BYDAY, porque ninguna tenía día puesto— pero el archivo
-- quedaba con una traducción rota y un comentario afirmando lo contrario, que es peor que
-- el bug: el próximo que copie el patrón lo copia roto.
--
-- Se corrigen LOS SIETE, uno por uno y sin depender de ninguna coincidencia.
do $$
declare t text;
begin
  foreach t in array array['plan_tareas', 'experimento_tareas', 'plan_proyectos', 'tarea_categorias'] loop
    execute format($f$
      update %I set recurrencia = replace(replace(replace(replace(replace(replace(replace(recurrencia,
        'BYDAY=LU', 'BYDAY=MO'), 'BYDAY=MA', 'BYDAY=TU'), 'BYDAY=MI', 'BYDAY=WE'),
        'BYDAY=JU', 'BYDAY=TH'), 'BYDAY=VI', 'BYDAY=FR'), 'BYDAY=SA', 'BYDAY=SA'),
        'BYDAY=DO', 'BYDAY=SU')
      where recurrencia like '%%BYDAY=%%'
    $f$, t);
  end loop;
end $$;
-- (el `SA`→`SA` es un no-op a propósito: está en la lista para que los siete se lean de
--  corrido y nadie tenga que volver a deducir cuál salía bien por casualidad.)

-- ── LAS DOS VIEJAS NO SE DROPEAN ACÁ ───────────────────────────────────
-- ⚠️ ESTA MIGRACIÓN ES SOLO ADITIVA, Y LA PRIMERA VERSIóN NO LO ERA: dropeaba `frecuencia` y
-- `frecuencia_dia` en el mismo paso. Se aplicó así y ROMPIÓ PRODUCCIÓN por unos minutos: el
-- código desplegado todavía emite esas columnas en `taskToRow`, así que PostgREST rechazaba
-- la fila entera y cada guardado de una tarjeta fallaba con 400. Se devolvieron en el acto.
--
-- EL ORDEN, que es la lección: una migración que AGREGA va antes del deploy (una columna de
-- más es inofensiva para el código viejo); una que SACA va después, cuando ya no queda nadie
-- escribiendo ahí. Las dos en el mismo paso garantiza una ventana rota del tamaño del deploy.
-- El drop vive en la `0168`, que se aplica DESPUÉS de que esto esté desplegado.

comment on column plan_tareas.recurrencia        is 'RRULE de RFC 5545, como la guarda Google Calendar: FREQ + INTERVAL + BYDAY/BYMONTHDAY/BYSETPOS. Sin UNTIL ni COUNT a propósito (nada calcula la próxima ocurrencia todavía). NULL = se repite y nadie dijo cada cuánto. Sólo tiene sentido con recurrente = true (mig 0167).';
comment on column experimento_tareas.recurrencia is 'RRULE de RFC 5545 (FREQ/INTERVAL/BYDAY/BYMONTHDAY/BYSETPOS), sin UNTIL ni COUNT. NULL = se repite y nadie dijo cada cuánto (mig 0167).';
comment on column plan_proyectos.recurrencia     is 'RRULE de RFC 5545 (FREQ/INTERVAL/BYDAY/BYMONTHDAY/BYSETPOS), sin UNTIL ni COUNT. NULL = se repite y nadie dijo cada cuánto (mig 0167).';
comment on column tarea_categorias.recurrencia   is 'RRULE de RFC 5545 (FREQ/INTERVAL/BYDAY/BYMONTHDAY/BYSETPOS), sin UNTIL ni COUNT. NULL = se repite y nadie dijo cada cuánto (mig 0167).';

notify pgrst, 'reload schema';
