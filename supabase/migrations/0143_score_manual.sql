-- =============================================================================
-- 0143 — un número que el dueño le ganó al Perro discutiendo no es un número más
-- =============================================================================
-- `ProyectoDebateModal` y `DebateModal` son el único lugar del sistema donde el dueño le
-- gana una discusión al Perro: argumenta, el Perro cede, y el score cambia. Hasta hoy eso
-- se escribía en la misma columna que todo lo demás y quedaba INDISTINGUIBLE de un score
-- que puso una corrida automática.
--
-- Con la re-priorización corriendo todos los días, eso significa que mañana a las 9:10 una
-- corrida ve `score: 34`, no tiene forma de saber que ese 34 salió de una discusión que él
-- ganó, y lo pisa. La regla de ESTABILIDAD del prompt —«ante la duda, MANTENÉ»— es prosa, y
-- ya sabemos cuánto vale una regla que solo vive en la prosa de un prompt.
--
-- La marca convierte eso en un candado real. Y el candado es de UNA dirección: el Perro
-- puede PROPONER mover un score marcado —lo escribe en la razón, donde el dueño lo ve— pero
-- no lo escribe. Es «un canal PROPONE, una persona confirma» aplicado al número que gobierna
-- la pantalla entera.
-- =============================================================================

begin;

alter table plan_proyectos     add column if not exists score_manual boolean not null default false;
alter table plan_tareas        add column if not exists score_manual boolean not null default false;
alter table experimento_tareas add column if not exists score_manual boolean not null default false;

comment on column plan_proyectos.score_manual is 'true = este score lo decidió el DUEÑO (debate o arrastre). El Perro puede proponer moverlo en la razón, pero no lo escribe (mig 0143).';

commit;

notify pgrst, 'reload schema';
