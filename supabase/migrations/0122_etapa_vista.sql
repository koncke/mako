-- =============================================================================
-- 0122 — leads.etapa_vista: la última etapa que el historial YA registró
-- =============================================================================
-- El lead 1395 ("José Antonio Villarreal rodriguez") tenía pipeline_stage NULL y
-- CERO filas en lead_audit, pero el CRM lo mostraba moviéndose de columna. No es
-- un bug de la auditoría: la etapa que ve el usuario es DERIVADA en tiempo de
-- lectura (deriveStageKey en lib/pipeline.ts) a partir de las fechas y las
-- asistencias del lead. Nadie escribe nada cuando la R1 pasa y asistio_j1 sigue
-- en null — y sin escritura no hay nada que interceptar ni que auditar.
--
-- La pieza que faltaba es MEMORIA: guardar por lead cuál fue la última etapa que
-- el historial dio por registrada. Con eso, la pasada que ya recorre todos los
-- leads (los "Datos sin marcar" del CRM) puede comparar la etapa efectiva contra
-- esta columna EN MEMORIA — sin una query por lead — y escribir la línea que
-- falta. Y como la columna se actualiza junto con la línea, correr la comparación
-- dos veces no vuelve a escribir: la idempotencia vive en el dato, no en un flag.
--
-- Arranca en NULL a propósito. NULL significa "todavía no sabemos qué etapa vio
-- este lead", y la primera pasada solo FIJA el valor sin escribir historia: un
-- lead que hoy está en No Show desde hace tres semanas no puede recibir una línea
-- fechada hoy diciendo que recién cambió. Eso sería inventar historia vieja.
-- =============================================================================

begin;

alter table leads add column if not exists etapa_vista text;

comment on column leads.etapa_vista is
  'Última etapa efectiva (override pipeline_stage o la derivada) que YA quedó registrada en lead_audit. La compara la pasada de "Datos sin marcar" para detectar cambios de etapa derivados, que no tienen escritura que interceptar. NULL = nunca se registró: la primera pasada la fija sin escribir línea (no inventar historia vieja).';

commit;

notify pgrst, 'reload schema';
