-- =============================================================================
-- 0132 — anthropic_usage.cuenta: CUÁL de las API keys del proveedor corrió
-- =============================================================================
-- El free tier de las IA gratis se agota POR CUENTA, no por proveedor. Desde la
-- migración a multi-key (lib/ia-keys.ts) un workspace puede tener hasta 3 keys de
-- Gemini, y `provider = 'gemini'` dejó de alcanzar para saber cuánta cuota queda.
--
-- El síntoma que lo obligó, reportado por una clienta con TRES cuentas: el panel
-- decía «240,6k / 750,0k» —o sea "te sobra cuota"— mientras la generación fallaba.
-- Los dos números eran ciertos y la conclusión falsa: 750k es la SUMA de los topes
-- de las 3 cuentas, pero el uso estaba todo apilado sobre la cuenta 1, que ya
-- estaba al 96% de SU tope de 250k. Sumar cuotas que no se pueden trasvasar es
-- exactamente lo que hace que un tablero mienta sin decir una sola cosa falsa.
--
-- NULLABLE a propósito: las filas anteriores a esta migración no tienen con qué
-- rellenarse. Se leen como cuenta 1, que es la verdad histórica — antes de
-- multi-key había una sola key por proveedor y todo corrió por ella.
-- =============================================================================
begin;

alter table anthropic_usage
  add column if not exists cuenta smallint;

comment on column anthropic_usage.cuenta is
  'Nº de cuenta (API key) del proveedor que atendió esta llamada: 1 = la de siempre, 2 y 3 = las cuentas extra de lib/ia-keys.ts. NULL en filas anteriores a la mig 0132, que se leen como 1. Sin esto la cuota solo se puede medir sumada por proveedor, y esa suma miente cuando el uso está apilado en una sola cuenta.';

-- El gauge y la rotación preguntan siempre lo mismo: uso de HOY, de un workspace,
-- agrupado por (provider, cuenta).
create index if not exists anthropic_usage_ws_fecha_prov_idx
  on anthropic_usage (workspace_id, created_at desc, provider);

commit;
