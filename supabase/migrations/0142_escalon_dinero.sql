-- =============================================================================
-- 0142 — el escalón de la escalera del dinero deja de ser prosa
-- =============================================================================
-- La metodología del Perro (GUARDIAN_SYSTEM_TEMPLATE) ordena todo con una ESCALERA de
-- cinco escalones: cobrar > traer una conversación nueva > no perder a un cliente que ya
-- está adentro > convertir mejor > construir una capacidad. Es «lo que configuramos en el
-- perro», textual, en la frase con la que el dueño rechazó la versión anterior.
--
-- Hasta hoy ese escalón se decidía en cada corrida, se escribía adentro de una frase en
-- lenguaje natural, y ahí moría: no se podía ordenar por él, ni mostrarlo, ni contar cuántas
-- cosas del tablero caen en cada uno, ni chequear que un escalón 5 no estuviera por encima
-- de un escalón 1. `escalon` no existía en NINGUNA parte del repo — ni columna, ni tipo, ni
-- campo de JSON.
--
-- Guardarlo es lo que convierte la regla más pesada del prompt en algo verificable, que es
-- la deuda que este board acaba de pagar cara: una regla que solo vive en la prosa se
-- cumple casi siempre, y «casi siempre» es como se ve un tablero mal priorizado.
--
-- `desbloquea` es la contrapartida obligatoria del escalón 5: la metodología permite que
-- «construir» le gane a «convertir» SOLO si desbloquea explícitamente un escalón de arriba,
-- y exige nombrar a cuál. Sin la columna, esa condición no se puede verificar — se le cree
-- al modelo o no, que es exactamente lo que no queremos.
-- =============================================================================

begin;

alter table plan_proyectos     add column if not exists escalon int;
alter table plan_proyectos     add column if not exists desbloquea text;
alter table plan_tareas        add column if not exists escalon int;
alter table plan_tareas        add column if not exists desbloquea text;
alter table experimento_tareas add column if not exists escalon int;
alter table experimento_tareas add column if not exists desbloquea text;

comment on column plan_proyectos.escalon is '1-5 de la escalera del dinero: 1 cobrar · 2 conversación nueva · 3 no perder un cliente · 4 convertir mejor · 5 construir capacidad (mig 0142).';
comment on column plan_proyectos.desbloquea is 'Solo para escalón 5: a QUÉ escalón de arriba habilita. Sin esto, un 5 no puede ganarle a un 1-4 (mig 0142).';

commit;

notify pgrst, 'reload schema';
