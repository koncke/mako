-- =============================================================================
-- 0070 — junta_1_at / junta_2_at: fecha+HORA de las reuniones (timestamptz)
-- =============================================================================
-- Hoy fecha_junta_1/2 guardan solo el DÍA (el webhook de Calendly descartaba la
-- hora con isoToFechaTijuana). Estas columnas guardan el instante exacto (ISO
-- del start_time de Calendly), para que el CRM automático dispare el chequeo de
-- No Show a las "3 h EXACTAS después" de la reunión (antes: cuando el día ya
-- pasó). Aditivo: fecha_junta_1/2 se conservan; junta_*_at es opcional (los leads
-- viejos quedan null → el motor cae al fallback por fecha).

alter table leads add column if not exists junta_1_at timestamptz;
alter table leads add column if not exists junta_2_at timestamptz;
