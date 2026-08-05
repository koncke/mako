-- =============================================================================
-- 0114 — Notas libres + la razón del deadline que puso el Perro
-- =============================================================================
-- NOTAS: un campo de texto libre en cada tarea y cada proyecto, de los dos tableros.
-- El `detalle` describe QUÉ hay que hacer y lo escribe (o lo amplía) la IA; las notas
-- son del dueño y no las toca nadie: dónde quedó, con quién habló, el link que le
-- pasaron, por qué lo frenó. Sin esto todo eso terminaba metido en el detalle, donde
-- el Perro lo reescribe.
--
-- DEADLINE_RAZON: el Perro ahora también propone la FECHA, no solo el score, y como
-- toda decisión suya tiene que poder explicarse y debatirse — igual que score_razon.
-- =============================================================================

begin;

alter table plan_tareas      add column if not exists notas text not null default '';
alter table plan_proyectos   add column if not exists notas text not null default '';
alter table experimento_tareas add column if not exists notas text not null default '';
alter table tarea_categorias add column if not exists notas text not null default '';

alter table plan_tareas        add column if not exists deadline_razon text;
alter table experimento_tareas add column if not exists deadline_razon text;

comment on column plan_tareas.notas          is 'Notas libres del dueño. La IA NUNCA las escribe ni las pisa (mig 0114).';
comment on column plan_tareas.deadline_razon is 'Por qué el Perro puso esa fecha. Se debate igual que el score (mig 0114).';

commit;

notify pgrst, 'reload schema';
