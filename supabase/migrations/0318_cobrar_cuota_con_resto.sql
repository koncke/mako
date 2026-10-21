-- =============================================================================
-- 0318 — Cobrar una cuota por menos, con su diferencia pendiente, en UNA transacción (21/10/2026, Pagos)
-- =============================================================================
-- Un cobro de menos (la cuota de 500 cobrada por 300) hace DOS escrituras: tomar la cuota (cobrada, por 300) y dejar
-- la diferencia (una cuota nueva, impaga, de 200). Desde PostgREST son dos viajes, y la revisión adversarial del 21/10
-- encontró los dos órdenes rotos:
--   · la diferencia DESPUÉS de tomar la cuota: un error en el medio la dejaba cobrada sin su diferencia (200 de deuda
--     que desaparecían) o había que devolverla a impaga, y eso volvía mentira el «ya estaba cobrada» de otra pantalla;
--   · la diferencia ANTES de tomarla: un error en la toma (o una respuesta perdida) la dejaba como una cuota pendiente
--     FANTASMA, con el vencimiento de la cuota, que la cobranza le reclamaba al cliente; y el reintento agregaba OTRA.
-- Acá las dos van juntas o no va ninguna. Si la respuesta se pierde con todo escrito, el reintento ve la cuota cobrada
-- («ya estaba») y la diferencia está UNA vez.
--
-- La toma es la misma escritura condicional de lib/pagos.ts (`siSigue`): sólo si la cuota SIGUE impaga. Sin fila, la
-- cobró otro: no se escribe nada y vuelve `tomada: false`.
-- La numeración de la diferencia es la de siempre (la última del lead + 1). Las cuotas del lead quedan tomadas hasta el
-- final (`for update`), y si otro escritor que no pasa por acá (un pago suelto) toma el número igual, el índice
-- (lead_id, numero) hace fallar TODO con 23505 y el que llama reintenta una vez (lib/pagos.ts, `cobrarConResto`).
--
-- ORDEN DE DESPLIEGUE: ANTES del código que la llama. Sin la función, un cobro POR MENOS no se guarda y lo dice («falta
-- la migración 0318»); el cobro entero no la usa y sigue igual. Sin datos que migrar.
-- =============================================================================

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
  p_vence date
)
returns jsonb
language plpgsql
-- `security invoker`: la app entra con service_role, que ya bypassa RLS (como 0147). El workspace va EXPLÍCITO en cada
-- consulta: el rpc no pasa por el cliente con scoping de lib/workspace.ts (`getTenantDb` sólo estampa los `.from`).
security invoker
set search_path = public
as $$
declare
  v_id bigint;
  v_numero integer;
  v_resto bigint;
begin
  if p_resto is null or p_resto <= 0 then
    raise exception 'cobrar_cuota_con_resto: sin diferencia; el cobro entero va por la escritura condicional';
  end if;

  -- Las cuotas del lead, tomadas hasta el final: dos cobros de menos del mismo lead no se pisan el número. En orden de
  -- id, el mismo en que las toma el delete de la reconciliación: en otro orden, los dos podían esperarse (40P01).
  perform 1 from pagos where lead_id = p_lead and workspace_id = p_ws order by id for update;

  update pagos set
    pagado = true,
    fecha_pago = p_fecha,
    pago_hora = p_hora,
    monto_usd = coalesce(p_monto, monto_usd),
    -- La moneda en que se cobró; sin ella, una cuota a mano se limpia (lo último que se dijo manda) y la de la
    -- pasarela no se toca. La misma regla que `cobrarCuota`.
    moneda = case when p_moneda is not null then p_moneda when p_limpiar_moneda then null else moneda end,
    monto_original = case when p_moneda is not null then p_monto_original when p_limpiar_moneda then null else monto_original end
  where id = p_pago and lead_id = p_lead and workspace_id = p_ws and pagado is not true
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('tomada', false);
  end if;

  select coalesce(max(numero), 0) + 1 into v_numero from pagos where lead_id = p_lead;
  insert into pagos (workspace_id, lead_id, numero, monto_usd, fecha_esperada, pagado)
  values (p_ws, p_lead, v_numero, p_resto, p_vence, false)
  returning id into v_resto;

  return jsonb_build_object('tomada', true, 'resto', v_resto);
end;
$$;

comment on function public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date) is
  'Cobra una cuota por menos y deja la diferencia pendiente en UNA transacción (mig 0318). La llama cobrarCuota (lib/pagos.ts).';

-- Ninguna función de public ejecutable por la clave pública (0280). ⚠️ El default de la 0280 es POR ESQUEMA y no le saca
-- a PUBLIC el EXECUTE que da el default global: sin estas dos líneas, anon y authenticated la ejecutaban (revisión
-- adversarial del 21/10/2026, medido en Postgres 16 con has_function_privilege). Nace cerrada; el server la llama con
-- service_role. Las dos son idempotentes: la migración se puede volver a correr.
revoke execute on function public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date) from public, anon, authenticated;
grant execute on function public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date) to service_role;
