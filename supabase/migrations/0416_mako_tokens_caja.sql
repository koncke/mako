-- =============================================================================
-- 0416 — La CAJA de MaKo Tokens: acreditar el cupo, descontar un gasto, liquidar la diferencia (15/11/2026)
-- =============================================================================
-- Martín, 15/11/2026: «vinculemos todas las cosas que utilicen inteligencia artificial y que todo utilice MaKo Tokens…
-- la generación de transcripciones, la generación de análisis de la competencia, que eso también gasta dinero. O sea,
-- todo debería consumir MaKo Tokens».
--
-- La 0412 creó las dos tablas y dejó escrito CÓMO tiene que descontarse (un `update` que es chequeo y descuento a la vez).
-- Ningún código las escribía: `grep mako_tokens_movimientos` sobre app/ lib/ supabase/ scripts/ devolvía sólo la propia
-- migración y listas de tablas. Esto agrega lo que faltaba para que la caja exista de verdad, y nada más.
--
-- EN PALABRAS: suma UNA columna a `mako_tokens_saldo` y crea TRES funciones. No toca ninguna fila existente.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ POR QUÉ HACE FALTA UNA SEGUNDA COLUMNA, Y NO ES UN CAPRICHO
-- ─────────────────────────────────────────────────────────────────────────────
-- El saldo tiene DOS partes con reglas opuestas, y la 0412 no las separa:
--
--   · EL CUPO DEL MES **SE REINICIA** (decisión de Martín, 07/11: «esos tokens no deberían acumularse»; el porqué entero
--     está en lib/uso-del-cupo.ts). Si se acumulara, un cliente que no usó nada en seis meses podría gastar seis cupos
--     de una, y la plata de esos meses ya se gastó. Acumular convierte un techo mensual en una deuda sin fecha.
--   · LO QUE COMPRÓ APARTE **NO SE REINICIA**: lo pagó. «el cupo se reinicia, el saldo comprado no»
--     (docs/costos-ia-y-planes.md, `compraDelMes`).
--
-- Con UNA sola columna las dos reglas se pisan, y el reinicio del mes es el que gana: acreditar el cupo de diciembre
-- escribiendo `saldo = cupo` le borra al cliente el paquete que compró el 28 de noviembre. Eso es plata de alguien que
-- pagó, desapareciendo sola el día 1. No hay forma de reconstruir el reparto desde el ledger: una vez que se gastó, los
-- movimientos no dicen de qué balde salió cada token.
--
-- Así que: `saldo` pasa a ser **el cupo del mes que queda** (es lo que ya era, y la 0412 y
-- scripts/probar-concurrencia-saldo.mjs siguen valiendo tal cual), y `comprado` es **lo que pagó aparte**. El gasto sale
-- PRIMERO del cupo, que es el que se vence: gastar primero lo que no se vence le quemaría al cliente lo que compró
-- mientras se le vence lo que ya tenía.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ EL CHEQUEO Y EL DESCUENTO SON LA MISMA SENTENCIA. ES TODA LA MIGRACIÓN.
-- ─────────────────────────────────────────────────────────────────────────────
-- Lo dice la 0412 y vale igual con dos columnas: un chequeo en el código seguido de un descuento aparte vuelve a tener
-- el bug NO ATÓMICO de la migración 0113 (`app_settings` con read-modify-write: dos pedidos leen el mismo saldo, los dos
-- creen que alcanza, los dos escriben, y el contador dice que se gastó una vez). Con video eso no es teórico: una
-- persona dispara varias piezas de un tirón.
--
-- La forma con dos baldes:
--
--     update mako_tokens_saldo
--        set saldo    = greatest(0, saldo - :cuesta),
--            comprado = comprado - greatest(0, :cuesta - saldo)
--      where workspace_id = :ws and saldo + comprado >= :cuesta;
--
-- ⚠️ Las dos asignaciones ven el saldo VIEJO (en SQL todas las expresiones del `set` se evalúan contra la fila de antes),
-- así que `comprado` resta exactamente lo que al cupo le faltó. Si se escribiera en dos `update`, el segundo vería el
-- cupo ya en cero y le restaría todo a `comprado`: se cobraría dos veces.
--
-- Postgres serializa el `update` sobre la fila, así que no hay carrera posible. Y el `check (saldo >= 0)` de la 0412 —más
-- el `check (comprado >= 0)` de acá— es LA RED, no el mecanismo: si alguna vez alguien descuenta sin el `where`, la base
-- lo frena en vez de dejar el saldo en negativo y regalar generaciones.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ EL CUPO SE ACREDITA SOLO, Y LA IDEMPOTENCIA ES UN ÍNDICE, NO UN `if`
-- ─────────────────────────────────────────────────────────────────────────────
-- No hay cron que barra todos los workspaces el día 1: el cupo del mes se acredita **la primera vez que ese negocio
-- necesita saldo ese mes**, adentro de la misma llamada que va a gastar. Un barrido mensual tiene que acertar en una
-- fecha para todos a la vez, y un reintento regala un mes entero de IA; la acreditación perezosa no tiene fecha que
-- errar y el reintento es gratis.
--
-- Lo que la hace segura ya estaba en la 0412: el índice único parcial `mako_tokens_movimientos_cupo_unico` sobre
-- (workspace_id, referencia) where motivo = 'cupo'. La referencia es el MES (`cupo:2026-11`), así que el mes entra una
-- sola vez por negocio por construcción. El `insert … on conflict do nothing` **repite el predicado del índice**: sin
-- eso Postgres no infiere un índice parcial y el insert tira en vez de no hacer nada.
--
-- Y el orden adentro de la función importa: primero el movimiento (que es el candado), después el saldo. Las dos cosas
-- adentro de la misma función, o sea de la misma transacción: si se cayera en el medio, las dos vuelven atrás y el mes
-- queda sin acreditar — nunca «marcado como acreditado» y sin saldo, que sería un mes de IA perdido para el cliente.
--
-- ⚠️ SIN BACKFILL, igual que la 0412: un workspace sin fila tiene cupo null y no alcanza. Darle saldo a alguien es una
-- decisión de negocio (su plan, su pago). Lo que cambia es que ahora el plan se lo da solo, en su primera llamada.
--
-- ORDEN DE DESPLIEGUE: esta migración va PRIMERO y el código después. Sin ella, `gastarMt` no encuentra la función y
-- falla CERRADO (lib/mako-tokens-caja.ts): lo peor que pasa es que no se genere — nunca que se genere gratis.
-- =============================================================================
begin;

-- ── Lo que compró aparte, que NO se reinicia con el mes ─────────────────────
alter table mako_tokens_saldo
  add column if not exists comprado bigint not null default 0 check (comprado >= 0);

comment on column mako_tokens_saldo.saldo is
  'Lo que QUEDA del cupo de ESTE mes. Se reinicia al acreditar el mes siguiente (mako_tokens_acreditar_cupo): decision de Martin del 7/11/2026, el cupo no se acumula.';

comment on column mako_tokens_saldo.comprado is
  'Lo que el negocio pago APARTE (un paquete). NO se reinicia con el mes: lo pago. El gasto sale primero del cupo, que es el que se vence.';

-- Qué mes de cupo tiene acreditado cada negocio. Es el mismo dato que el ledger ya garantiza con su índice único; está
-- acá para poder contestar «¿este negocio ya cobró el cupo de noviembre?» sin tocar una tabla de millones de filas.
alter table mako_tokens_saldo
  add column if not exists cupo_mes text check (cupo_mes is null or char_length(cupo_mes) between 1 and 40);

comment on column mako_tokens_saldo.cupo_mes is
  'La referencia del ultimo cupo acreditado (ej. cupo:2026-11). Es cache del ledger, no la verdad: la verdad la impone mako_tokens_movimientos_cupo_unico.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ACREDITAR EL CUPO DEL MES. Idempotente por el índice único de la 0412.
-- ─────────────────────────────────────────────────────────────────────────────
-- Devuelve cuántos MT acreditó (0 = el mes ya estaba acreditado) y el saldo que quedó.
-- ⚠️ `p_cupo` lo decide el CÓDIGO (`cupoDeCapa`, lib/mako-tokens-reglas.ts), no esta función: qué cupo trae cada plan es
-- una decisión de producto que cambia sin deploy de base, y una capa que no vende cupo (el Acelerador) devuelve null allá
-- y acá no se llama. Un número de plan cableado en SQL es el que nadie vuelve a mirar.
create or replace function mako_tokens_acreditar_cupo(p_ws bigint, p_cupo bigint, p_mes text)
returns table (acreditado bigint, saldo bigint, comprado bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entro boolean := false;
  v_cupo bigint;
  v_comprado bigint;
begin
  if p_cupo is null or p_cupo <= 0 or p_mes is null or btrim(p_mes) = '' then
    select s.saldo, s.comprado into v_cupo, v_comprado from mako_tokens_saldo s where s.workspace_id = p_ws;
    return query select 0::bigint, coalesce(v_cupo, 0::bigint), coalesce(v_comprado, 0::bigint);
    return;
  end if;

  -- El CANDADO va primero: si el mes ya se acreditó, el índice único parcial lo rechaza y no se toca el saldo.
  -- ⚠️ El `where` del `on conflict` REPITE el predicado del índice parcial: sin eso Postgres no lo infiere y tira.
  insert into mako_tokens_movimientos (workspace_id, delta, motivo, feature, referencia)
  values (p_ws, p_cupo, 'cupo', null, p_mes)
  on conflict (workspace_id, referencia) where motivo = 'cupo' and referencia is not null
  do nothing;

  v_entro := found;

  if not v_entro then
    select s.saldo, s.comprado into v_cupo, v_comprado from mako_tokens_saldo s where s.workspace_id = p_ws;
    return query select 0::bigint, coalesce(v_cupo, 0::bigint), coalesce(v_comprado, 0::bigint);
    return;
  end if;

  -- El cupo del mes REEMPLAZA al del mes anterior, no se suma: el cupo no se acumula (ver la cabecera).
  -- `comprado` no se toca: eso lo pagó el cliente y sobrevive al reinicio.
  insert into mako_tokens_saldo (workspace_id, saldo, cupo_mes, actualizado_en)
  values (p_ws, p_cupo, p_mes, now())
  on conflict (workspace_id) do update
    set saldo = p_cupo, cupo_mes = p_mes, actualizado_en = now()
  returning mako_tokens_saldo.saldo, mako_tokens_saldo.comprado into v_cupo, v_comprado;

  return query select p_cupo, coalesce(v_cupo, 0::bigint), coalesce(v_comprado, 0::bigint);
end;
$$;

revoke all on function mako_tokens_acreditar_cupo(bigint, bigint, text) from public, anon, authenticated;
grant execute on function mako_tokens_acreditar_cupo(bigint, bigint, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GASTAR. El chequeo y el descuento, en UNA sentencia. Es la pieza que protege la caja.
-- ─────────────────────────────────────────────────────────────────────────────
-- Devuelve `ok = true` y lo que quedó si alcanzaba; `ok = false` y el saldo SIN TOCAR si no.
-- `tomado_cupo` / `tomado_comprado` dicen de qué balde salió cada token: lo necesita la liquidación para devolver a los
-- mismos baldes, en el orden inverso, y dejar la fila exactamente como estaba.
--
-- ⚠️ Acredita el cupo del mes ANTES de intentar, en la misma transacción: así una generación no se frena porque nadie
-- corrió todavía el cron del día 1, y el camino caliente sigue siendo UN viaje a la base.
create or replace function mako_tokens_gastar(
  p_ws bigint, p_cuesta bigint, p_cupo bigint, p_mes text,
  p_feature text, p_costo_usd numeric, p_referencia text
)
returns table (ok boolean, saldo bigint, comprado bigint, tomado_cupo bigint, tomado_comprado bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_antes_cupo bigint;
  v_antes_comprado bigint;
  v_despues_cupo bigint;
  v_despues_comprado bigint;
begin
  if p_cuesta is null or p_cuesta <= 0 then
    -- Cuesta nada: no se toca la caja y se deja pasar. Una feature que rutea a un free tier no tiene por qué pedir saldo.
    select s.saldo, s.comprado into v_antes_cupo, v_antes_comprado from mako_tokens_saldo s where s.workspace_id = p_ws;
    return query select true, coalesce(v_antes_cupo, 0::bigint), coalesce(v_antes_comprado, 0::bigint), 0::bigint, 0::bigint;
    return;
  end if;

  perform mako_tokens_acreditar_cupo(p_ws, p_cupo, p_mes);

  select s.saldo, s.comprado into v_antes_cupo, v_antes_comprado from mako_tokens_saldo s where s.workspace_id = p_ws;

  -- ⚠️ LA SENTENCIA. Las dos asignaciones ven el saldo de ANTES; el `where` mira el total de los dos baldes.
  update mako_tokens_saldo s
     set saldo          = greatest(0, s.saldo - p_cuesta),
         comprado       = s.comprado - greatest(0, p_cuesta - s.saldo),
         actualizado_en = now()
   where s.workspace_id = p_ws
     and s.saldo + s.comprado >= p_cuesta
  returning s.saldo, s.comprado into v_despues_cupo, v_despues_comprado;

  if not found then
    -- No alcanzaba (o no hay fila): NO se tocó nada. Se devuelve el saldo tal como está para poder decirle cuánto falta.
    return query select false, coalesce(v_antes_cupo, 0::bigint), coalesce(v_antes_comprado, 0::bigint), 0::bigint, 0::bigint;
    return;
  end if;

  insert into mako_tokens_movimientos (workspace_id, delta, motivo, feature, costo_usd, referencia)
  values (p_ws, -p_cuesta, 'gasto', nullif(btrim(coalesce(p_feature, '')), ''), p_costo_usd, nullif(btrim(coalesce(p_referencia, '')), ''));

  return query select true, v_despues_cupo, v_despues_comprado,
                      least(p_cuesta, v_antes_cupo),
                      greatest(0::bigint, p_cuesta - v_antes_cupo);
end;
$$;

revoke all on function mako_tokens_gastar(bigint, bigint, bigint, text, text, numeric, text) from public, anon, authenticated;
grant execute on function mako_tokens_gastar(bigint, bigint, bigint, text, text, numeric, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LIQUIDAR. Lo que sobró de una reserva, o lo que faltó.
-- ─────────────────────────────────────────────────────────────────────────────
-- El costo de una llamada de TEXTO se sabe DESPUÉS, cuando el modelo contesta y se cuentan sus tokens. Así que el
-- medidor reserva una estimación (`mtReservaDeFeature`) y después ajusta con el costo real.
--
-- ⚠️ EL AJUSTE DICE A QUÉ BALDE VA CADA TOKEN, y lo decide quien llama, no esta función: devolver al cupo lo que salió de
-- `comprado` le regalaría al cliente tokens que se le vencen a fin de mes en lugar de los que no, y al revés le vencería
-- lo que pagó. La regla está en lib/mako-tokens-medidor.ts: **se devuelve en el orden inverso al que se tomó** (primero
-- `comprado`, después el cupo), y así la fila queda exactamente como estaba antes de la reserva.
--
-- ⚠️ UN COBRO DE MÁS SE RECORTA EN CERO (`greatest`) Y SE ANOTA. Si el costo real superó la reserva y ya no hay saldo, la
-- alternativa sería que el `check (saldo >= 0)` rechace el ajuste: ahí el gasto quedaría SIN registrar y el cliente se
-- llevaría gratis la diferencia, que es el único sentido del error que cuesta plata. Se cobra lo que haya, el ledger
-- queda con el delta real y la diferencia se puede ver sumando. El cobro de más está acotado a UNA llamada: la siguiente
-- ya encuentra el saldo en cero y no arranca.
create or replace function mako_tokens_ajustar(
  p_ws bigint, p_delta_cupo bigint, p_delta_comprado bigint,
  p_motivo text, p_feature text, p_costo_usd numeric, p_referencia text
)
returns table (saldo bigint, comprado bigint, aplicado bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_antes_cupo bigint;
  v_antes_comprado bigint;
  v_cupo bigint;
  v_comprado bigint;
  v_aplicado bigint;
begin
  if p_motivo is null or p_motivo not in ('gasto', 'devolucion', 'ajuste', 'compra') then
    raise exception 'motivo invalido para mako_tokens_ajustar: %', p_motivo;
  end if;
  if coalesce(p_delta_cupo, 0) = 0 and coalesce(p_delta_comprado, 0) = 0 then
    return query select s.saldo, s.comprado, 0::bigint from mako_tokens_saldo s where s.workspace_id = p_ws;
    return;
  end if;

  select s.saldo, s.comprado into v_antes_cupo, v_antes_comprado from mako_tokens_saldo s where s.workspace_id = p_ws;
  if v_antes_cupo is null then
    -- Sin fila no hay nada que ajustar: una devolución sin reserva previa inventaría saldo.
    return query select 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  update mako_tokens_saldo s
     set saldo          = greatest(0, s.saldo + coalesce(p_delta_cupo, 0)),
         comprado       = greatest(0, s.comprado + coalesce(p_delta_comprado, 0)),
         actualizado_en = now()
   where s.workspace_id = p_ws
  returning s.saldo, s.comprado into v_cupo, v_comprado;

  -- Lo que REALMENTE se movió, después del recorte en cero. Es lo que va al ledger: el movimiento tiene que explicar el
  -- saldo, así que anotar el delta pedido en vez del aplicado dejaría un ledger que no cierra contra la fila.
  v_aplicado := (v_cupo - v_antes_cupo) + (v_comprado - v_antes_comprado);

  if v_aplicado <> 0 then
    insert into mako_tokens_movimientos (workspace_id, delta, motivo, feature, costo_usd, referencia)
    values (p_ws, v_aplicado, p_motivo, nullif(btrim(coalesce(p_feature, '')), ''), p_costo_usd, nullif(btrim(coalesce(p_referencia, '')), ''));
  end if;

  return query select v_cupo, v_comprado, v_aplicado;
end;
$$;

revoke all on function mako_tokens_ajustar(bigint, bigint, bigint, text, text, numeric, text) from public, anon, authenticated;
grant execute on function mako_tokens_ajustar(bigint, bigint, bigint, text, text, numeric, text) to service_role;

commit;
