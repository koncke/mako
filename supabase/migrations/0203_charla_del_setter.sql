-- =============================================================================
-- 0203_charla_del_setter — la charla del setter con un lead: cuándo sigue y cuándo cerró
-- =============================================================================
-- Proyecto «Feature: Chatbot» del plan (06/10/2026), tareas #788 y #360.
--
-- #788 — MaKo contestaba UNA sola vez por lead. Al primer mensaje la inscripción pasa a
-- 'respondio' y en menos de una hora el desenlace la cierra como lograda; del segundo
-- mensaje en adelante no había inscripción activa y el setter no corría. Lo que decide
-- ahora si la charla sigue abierta es `conversacionAbierta` (lib/setter-conversacion.ts),
-- y necesita dos cosas que la fila no tenía:
--
--  · `conversacion_ultima_at` — cuándo fue el último intercambio que atendió el setter.
--    La ventana de 7 días cuenta desde ahí. NO se reusa `updated_at`: lo escriben el
--    motor, el desenlace y el destrabe de pasos por razones que no son «hubo charla».
--  · `conversacion_cierre` + `conversacion_cerrada_at` — por qué terminó la charla
--    (#360): el lead aceptó (`fin_bien`), dijo que no (`fin_mal`) o repitió por tercera
--    vez la misma objeción (`insistencia`). Una charla cerrada no se vuelve a abrir sola.
--
-- Y un candado en `wa_borradores`: UN borrador 'setter-asistido' pendiente por lead. Con
-- la charla abierta, N mensajes del lead dejaban N borradores apilados (el insert sin
-- `inscripcion_id` no tiene upsert), y dos mensajes en paralelo hacían dos veces
-- buscar-y-después-insertar. El índice es la guarda que no depende de la carrera.
-- Medido el 06/10: 0 borradores 'setter-asistido' en todo el producto, así que el índice
-- se crea sin chocar con nada.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES O JUNTO con el deploy. El código nuevo LEE estas
-- columnas en el `select` de las inscripciones del lead, y PostgREST rechaza la consulta
-- ENTERA si una columna no existe: sin la migración puesta, el setter no corre para nadie
-- (sin error visible: el lead escribe y no pasa nada).
-- =============================================================================

begin;

alter table nutricion_inscripciones
  add column if not exists conversacion_ultima_at timestamptz,
  add column if not exists conversacion_cierre text,
  add column if not exists conversacion_cerrada_at timestamptz;

-- El CHECK va aparte y con nombre: `add column if not exists … check` no lo agrega si la
-- columna ya existía (un no-op silencioso que deja creyendo que la restricción está).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'nutricion_inscripciones_conversacion_cierre_chk') then
    alter table nutricion_inscripciones
      add constraint nutricion_inscripciones_conversacion_cierre_chk
      check (conversacion_cierre is null or conversacion_cierre in ('fin_bien', 'fin_mal', 'insistencia'));
  end if;
end $$;

comment on column nutricion_inscripciones.conversacion_ultima_at is
  'Último intercambio que atendió el setter (modo asistido). La charla sigue abierta 7 días desde acá (lib/setter-conversacion.ts).';
comment on column nutricion_inscripciones.conversacion_cierre is
  'Por qué terminó la charla del setter: fin_bien (el lead aceptó), fin_mal (dijo que no) o insistencia (repitió la misma objeción por tercera vez). NULL = sigue o nunca hubo charla.';
comment on column nutricion_inscripciones.conversacion_cerrada_at is
  'Cuándo terminó la charla del setter. Con esto puesto MaKo no vuelve a redactar para este lead en esta secuencia.';

create unique index if not exists uq_wa_borradores_setter_pendiente
  on wa_borradores (workspace_id, lead_id)
  where origen = 'setter-asistido' and estado = 'pendiente' and lead_id is not null;

commit;
