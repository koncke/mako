-- =============================================================================
-- 0347 — La diferencia de un cobro por menos nace en la MONEDA de la cuota (29/10/2026, Pagos; revisión de 805afb460, N3)
-- =============================================================================
-- El plan por tramos (ticket #13 de Leila) arma cuotas pactadas en pesos: MXN 12.000 = US$600. Cobrada a medias en esa moneda
-- (6.000 MXN), `cobrar_cuota_con_resto` (0318 y 0323) dejaba la diferencia SÓLO en dólares: `US$300`, sin moneda. El
-- recordatorio le pedía al cliente «US$ 300» en vez de «$ 6.000 MXN», y el link y «Marcar pagada» de la diferencia salían en
-- dólares: el caso normal de Leila (cobra en MXN, a veces a medias) dejaba la deuda en una moneda que su cliente no usa.
--
-- Ahora, si la cuota tiene su moneda (no USD) y su monto en ella, y el cobro fue en ESA moneda, la diferencia nace con esa
-- moneda y `monto_original` = lo pactado menos lo cobrado (12.000 − 6.000). Sus dólares siguen siendo `p_resto`, los que
-- calcula la app (lib/pagos-diferencia.ts). Si el cobro fue en otra moneda, o la cuota es en dólares, todo como antes.
--
-- La moneda pactada se lee ANTES de tomar la cuota: la toma la pisa con la del cobro («lo último que se dijo manda»).
--
-- Misma firma que la 0323 (`create or replace` del cuerpo): el código no cambia, y no importa qué se despliega primero. Seguro
-- de re-ejecutar. Medido en sólo lectura el 29/10/2026: ninguna cuota impaga en otra moneda en producción todavía (el plan por
-- tramos no está desplegado), así que no hay diferencias viejas que corregir.
-- =============================================================================

begin;

create or replace function public.cobrar_cuota_con_resto(
  p_ws bigint,
  p_pago bigint,
  p_lead bigint,
  p_fecha date,
  p_hora text,
  p_monto numeric,
  p_moneda text,
  p_monto_original numeric,
  p_limpiar_moneda boolean,
  p_resto numeric,
  p_vence date,
  p_original numeric default null
)
returns jsonb
language plpgsql
-- `security invoker`, como la 0318: la app entra con service_role, que ya bypassa RLS (como 0147). El workspace va
-- EXPLÍCITO en cada consulta: el rpc no pasa por el cliente con scoping de lib/workspace.ts.
security invoker
set search_path = public
as $$
declare
  v_id bigint;
  v_numero integer;
  v_resto bigint;
  v_moneda text;
  v_pactado numeric;
  v_resto_moneda text;
  v_resto_original numeric;
begin
  if p_resto is null or p_resto <= 0 then
    raise exception 'cobrar_cuota_con_resto: sin diferencia; el cobro entero va por la escritura condicional';
  end if;

  -- Las cuotas del lead, tomadas hasta el final, en orden de id (como el delete de la reconciliación: 0318).
  perform 1 from pagos where lead_id = p_lead and workspace_id = p_ws order by id for update;

  -- La moneda PACTADA de la cuota, antes de tomarla: la toma la pisa con la del cobro.
  select moneda, monto_original into v_moneda, v_pactado
  from pagos where id = p_pago and lead_id = p_lead and workspace_id = p_ws;

  -- La toma: sigue impaga Y con el monto que se leyó (`p_original`). Si no, la cobró otro o la cambiaron: nada.
  update pagos set
    pagado = true,
    fecha_pago = p_fecha,
    pago_hora = p_hora,
    monto_usd = coalesce(p_monto, monto_usd),
    moneda = case when p_moneda is not null then p_moneda when p_limpiar_moneda then null else moneda end,
    monto_original = case when p_moneda is not null then p_monto_original when p_limpiar_moneda then null else monto_original end
  where id = p_pago and lead_id = p_lead and workspace_id = p_ws and pagado is not true
    and (p_original is null or monto_usd = p_original)
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('tomada', false);
  end if;

  -- Cobrada a medias en SU moneda: la diferencia queda en esa moneda, lo pactado menos lo cobrado (0347).
  if v_moneda is not null and upper(v_moneda) <> 'USD' and v_pactado > 0
     and p_moneda is not null and upper(p_moneda) = upper(v_moneda)
     and p_monto_original is not null and v_pactado - p_monto_original > 0 then
    v_resto_moneda := v_moneda;
    v_resto_original := v_pactado - p_monto_original;
  end if;

  -- La diferencia, marcada con la cuota de la que sale: no ocupa un lugar del plan.
  select coalesce(max(numero), 0) + 1 into v_numero from pagos where lead_id = p_lead;
  insert into pagos (workspace_id, lead_id, numero, monto_usd, fecha_esperada, pagado, resto_de, moneda, monto_original)
  values (p_ws, p_lead, v_numero, p_resto, p_vence, false, v_id, v_resto_moneda, v_resto_original)
  returning id into v_resto;

  return jsonb_build_object('tomada', true, 'resto', v_resto);
end;
$$;

comment on function public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date, numeric) is
  'Cobra una cuota por menos (sólo si sigue impaga y con el monto leído, p_original) y deja la diferencia pendiente, marcada con resto_de y en la moneda de la cuota si se cobró en ella, en UNA transacción (mig 0318, 0323 y 0347). La llama cobrarCuota (lib/pagos.ts).';

-- Cerrada para la clave pública, como la 0323. `create or replace` conserva los permisos; se repiten por si acaso. Idempotentes.
revoke execute on function public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date, numeric) from public, anon, authenticated;
grant execute on function public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date, numeric) to service_role;

commit;
