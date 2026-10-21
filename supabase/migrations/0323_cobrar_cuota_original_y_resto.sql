-- =============================================================================
-- 0323 — Cobrar por menos: la cuota se toma sólo con el monto que se leyó, y la diferencia nace MARCADA (21/10/2026, Pagos)
-- =============================================================================
-- Dos arreglos a `cobrar_cuota_con_resto` (mig 0318), juntos porque redefinen la misma función:
--
--   · `p_original`: el monto de la cuota que leyó `cobrarCuota`. La 0318 tomaba la cuota sólo si seguía impaga, sin mirar
--     su monto: editada de 500 a 400 entre la lectura y el rpc, un cobro de 300 dejaba 300 cobrados + 200 pendientes
--     (500 de una cuota de 400). Ahora la toma también exige el monto leído; si cambió, no se escribe nada y vuelve
--     `tomada: false` (la app dice «La cuota cambió mientras la cobrabas»). Con `p_original` null, como la 0318: el
--     código de antes del deploy la sigue llamando con sus 11 argumentos.
--
--   · `pagos.resto_de`: el id de la cuota cobrada por menos de la que salió la diferencia. La 0318 la insertaba (impaga,
--     con el número siguiente) sin decir de dónde vino, y el plan uniforme la contaba como la cuota que sigue: con el
--     plan armado en la ficha (1.000 + 3 × 1.000), cobrar la cuota 1 por 600, pasar a 4 cuotas y cambiar el día
--     reescribía la diferencia de 400 como la cuota 4 de 1.000, y la cuota nueva quedaba intacta: US$600 de deuda
--     fantasma que la cobranza reclamaba por WhatsApp (revisión de 7524ec1c9, alta). Qué es una cuota del plan es UNA
--     regla (`esCuotaDelPlan`, lib/cobrado-lead.ts), y lee esta marca.
--     SIN clave foránea, a propósito: la marca dice de dónde NACIÓ la fila. Con `on delete set null`, si la cuota de
--     origen se borra (el Deshacer de un movimiento del tablero borra y REINSERTA cuotas con su mismo id,
--     app/crm/actions.ts) la diferencia perdía la marca para siempre y volvía a ocupar un lugar del plan: la deuda
--     fantasma de vuelta. Un id que ya no existe no rompe nada: sólo se mira si está o no.
--
-- Medido en sólo lectura el 21/10/2026: 0 diferencias en producción (la 0318 es del mismo día). Nada que rellenar.
--
-- La firma cambia (un argumento más), así que la de 11 se BORRA: con las dos, PostgREST no sabría a cuál llamar con 11
-- argumentos. Todo en una transacción: no hay un instante sin función.
--
-- ORDEN DE DESPLIEGUE: ANTES del código que manda `p_original`. Sin esta migración ese código no encuentra la función, y
-- un cobro POR MENOS no se guarda y lo dice («falta la migración 0323»); el cobro entero no la usa. Seguro de re-ejecutar.
-- =============================================================================

begin;

alter table pagos add column if not exists resto_de bigint;

comment on column pagos.resto_de is
  'La diferencia de un cobro por menos: el id de la cuota de la que salió. No es una cuota del plan (esCuotaDelPlan, lib/cobrado-lead.ts). Sin FK: es de dónde nació. Mig 0323.';

drop function if exists public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date);

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
begin
  if p_resto is null or p_resto <= 0 then
    raise exception 'cobrar_cuota_con_resto: sin diferencia; el cobro entero va por la escritura condicional';
  end if;

  -- Las cuotas del lead, tomadas hasta el final, en orden de id (como el delete de la reconciliación: 0318).
  perform 1 from pagos where lead_id = p_lead and workspace_id = p_ws order by id for update;

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

  -- La diferencia, marcada con la cuota de la que sale: no ocupa un lugar del plan.
  select coalesce(max(numero), 0) + 1 into v_numero from pagos where lead_id = p_lead;
  insert into pagos (workspace_id, lead_id, numero, monto_usd, fecha_esperada, pagado, resto_de)
  values (p_ws, p_lead, v_numero, p_resto, p_vence, false, v_id)
  returning id into v_resto;

  return jsonb_build_object('tomada', true, 'resto', v_resto);
end;
$$;

comment on function public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date, numeric) is
  'Cobra una cuota por menos (sólo si sigue impaga y con el monto leído, p_original) y deja la diferencia pendiente, marcada con resto_de, en UNA transacción (mig 0318 y 0323). La llama cobrarCuota (lib/pagos.ts).';

-- Cerrada para la clave pública, como la 0318: el default de la 0280 es por esquema y no le saca a PUBLIC el EXECUTE que
-- da el default global. Una función nueva (otra firma) nace con ese EXECUTE: sin estas dos líneas, anon y authenticated
-- la ejecutaban. Idempotentes.
revoke execute on function public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date, numeric) from public, anon, authenticated;
grant execute on function public.cobrar_cuota_con_resto(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date, numeric) to service_role;

commit;
