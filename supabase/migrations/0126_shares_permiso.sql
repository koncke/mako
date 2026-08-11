-- =============================================================================
-- 0126_shares_permiso — un share puede, además de mostrar, dejar escribir
-- =============================================================================
-- Hasta ahora `shares` era solo-lectura: `puedeVer()` era todo el contrato. La
-- tarea de cada bloque del programa la contesta el CLIENTE DE UN CLIENTE, que no
-- tiene ni va a tener cuenta en MaKo — son empresarios que no manejan la
-- computadora, y un login más es un bloque que no se contesta.
--
-- ⚠️ EL DEFAULT ES 'ver', Y ESO ES EL PUNTO. Todas las filas que ya existen
-- quedan exactamente como estaban: solo-lectura. Escribir se habilita fila por
-- fila y a propósito. Es la regla de la casa: un guard sobre algo delicado se
-- escribe en POSITIVO —«este share puede editar ESTO»— y nunca «cualquiera menos
-- aquél», porque la condición negativa deja pasar todo lo que todavía no existe.
--
-- El alcance sigue siendo el de siempre (`alcance` + `recurso_id`). `permiso` no
-- lo amplía: solo dice qué se puede hacer DENTRO de lo que el alcance ya deja
-- ver. Un share con permiso 'editar' y alcance 'item' puede escribir ese item y
-- nada más.
-- =============================================================================
begin;

alter table shares
  add column if not exists permiso text not null default 'ver'
  check (permiso in ('ver', 'editar'));

comment on column shares.permiso is
  'ver = solo mostrar (el default de siempre). editar = además puede escribir, acotado por alcance+recurso_id. Se decide al crear el share, nunca por request.';

commit;
