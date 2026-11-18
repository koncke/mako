-- 0420 · mako_acciones_pendientes.reclamada_at: cuándo se reclamó una pendiente para ejecutarla (F114, 18/11/2026)
-- SIN APLICAR: la escribió una sesión de la nube, que no aplica migraciones. La aplica el Cerebro con
-- `node scripts/apply-migration.mjs supabase/migrations/0420_pendientes_reclamada_at.sql`.
--
-- Confirmar una pendiente la RECLAMA antes de ejecutarla (`reclamarPendiente`, lib/mako-pendientes.ts: 'pendiente' → 'confirmada').
-- Si la ejecución se corta en el medio, la fila queda 'confirmada' para siempre y no había forma de saber desde cuándo
-- (docs/hallazgos-api-mako.md: «no hay forma de saber cuándo se reclamó ni un barrido que pase a error las confirmada viejas»).
-- Con esta columna, el barrido nocturno (/api/cron/limpieza-colgados) cierra como 'error' la que lleva más de 30 minutos
-- reclamada sin resultado.
--
-- EN PALABRAS: agrega una columna (vacía para todas las filas de hoy) y un índice. No toca ninguna fila ni ninguna función.
-- ORDEN: da igual. Sin la columna, `reclamarPendiente` reclama igual sin anotar la hora (reintenta sin ella) y el barrido cierra
-- las colgadas por su vencimiento (`vence_at`), como ya las infería `ver_pendiente`. Idempotente.

begin;
alter table mako_acciones_pendientes add column if not exists reclamada_at timestamptz;
comment on column mako_acciones_pendientes.reclamada_at is
  'Cuándo se reclamó para ejecutarla (estado ''confirmada''). null = no se reclamó, o se reclamó antes de la 0420.';
-- El barrido busca las confirmadas sin resolver: pocas filas, por eso un índice parcial.
create index if not exists ix_mako_pend_confirmadas_colgadas
  on mako_acciones_pendientes (reclamada_at) where estado = 'confirmada' and resuelto_at is null;
commit;

notify pgrst, 'reload schema';
