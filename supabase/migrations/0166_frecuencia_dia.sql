-- =============================================================================
-- 0166 — «1 vez a la semana» no dice CUÁNDO
-- =============================================================================
-- «La frecuencia debe poder configurarse como Google Calendar, es decir, si es 1 vez a la
-- semana ¿qué día? y así» (26/09/2026).
--
-- La 0165 dejó el RITMO («cada semana») y le falta el ANCLA. Sin ella, dos cosas que en el
-- calendario de cualquiera son distintas —la junta de los lunes y la de los viernes— se ven
-- iguales, y la tarjeta no alcanza para saber si algo cae hoy.
--
-- ⚠️ UN SOLO CAMPO, Y SE LEE SEGÚN `frecuencia`. No son dos columnas (día-de-semana y
-- día-de-mes) porque una recurrente tiene UNA frecuencia por vez: con dos columnas, cambiar
-- de «cada semana» a «cada mes» deja la vieja viva y contradiciendo a la nueva — que es el
-- mismo modo de falla del `deadline` que sobrevivía a marcarla recurrente.
--
--   frecuencia = 'semanal' | 'quincenal'                → 'lun' … 'dom'
--   frecuencia = 'mensual' | 'trimestral' | 'anual'     → '1' … '31' (día del mes)
--   frecuencia = 'diaria'                               → NULL (todos los días no tiene ancla)
--   NULL                                                → se repite y nadie dijo cuándo
--
-- ⚠️ SIN `check`, igual que `frecuencia` y por lo mismo: el saneo vive en
-- `lib/plan-recurrentes.ts`, que es lo que el repo testea y lo que pueden importar las dos
-- mitades. Un `check` acá tiraría un 400 opaco en vez de caer al default.
--
-- ⚠️ LAS CUATRO TABLAS: el tablero es UNO y lo montan el dueño y cada cliente, y se repiten
-- tanto las tareas como los proyectos. Tres de cuatro deja un control que no guarda nada.
alter table plan_tareas        add column if not exists frecuencia_dia text;
alter table experimento_tareas add column if not exists frecuencia_dia text;
alter table plan_proyectos     add column if not exists frecuencia_dia text;
alter table tarea_categorias   add column if not exists frecuencia_dia text;

comment on column plan_tareas.frecuencia_dia        is 'El ANCLA de la frecuencia, que se lee según `frecuencia`: lun..dom si es semanal/quincenal, 1..31 si es mensual/trimestral/anual, NULL si es diaria o si no se dijo (mig 0166).';
comment on column experimento_tareas.frecuencia_dia is 'El ANCLA de la frecuencia: lun..dom si es semanal/quincenal, 1..31 si es mensual/trimestral/anual, NULL si es diaria o si no se dijo (mig 0166).';
comment on column plan_proyectos.frecuencia_dia     is 'El ANCLA de la frecuencia: lun..dom si es semanal/quincenal, 1..31 si es mensual/trimestral/anual, NULL si es diaria o si no se dijo (mig 0166).';
comment on column tarea_categorias.frecuencia_dia   is 'El ANCLA de la frecuencia: lun..dom si es semanal/quincenal, 1..31 si es mensual/trimestral/anual, NULL si es diaria o si no se dijo (mig 0166).';

notify pgrst, 'reload schema';
