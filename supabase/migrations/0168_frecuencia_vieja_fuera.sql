-- =============================================================================
-- 0168 — sacar las columnas que la 0167 reemplazó
-- =============================================================================
-- ⛔ ESTA MIGRACIÓN SE APLICA **DESPUÉS** DE DESPLEGAR EL CÓDIGO DE LA 0167, no antes.
-- Mientras haya una versión desplegada que emita `frecuencia` en su mapper, dropearla hace
-- que PostgREST rechace la fila ENTERA y falle cada guardado de una tarjeta, con la pantalla
-- ya pintada y sin ningún error a la vista. Pasó el 26/09/2026 y duró minutos porque se
-- devolvieron en el acto; el orden correcto es: agregar → desplegar → sacar.
--
-- El dato ya vive en `recurrencia` (RRULE), migrado y verificado por la 0167. Estas dos
-- quedan vacías desde entonces: lo que se saca acá es la SEGUNDA definición de la misma
-- cosa, que es la que se queda vieja porque nadie la mira.
alter table plan_tareas        drop column if exists frecuencia, drop column if exists frecuencia_dia;
alter table experimento_tareas drop column if exists frecuencia, drop column if exists frecuencia_dia;
alter table plan_proyectos     drop column if exists frecuencia, drop column if exists frecuencia_dia;
alter table tarea_categorias   drop column if exists frecuencia, drop column if exists frecuencia_dia;

notify pgrst, 'reload schema';
