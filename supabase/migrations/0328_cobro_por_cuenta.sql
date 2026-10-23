-- =============================================================================
-- 0328 · Cada cobro dice por qué CUENTA de la pasarela se cobró (22/10/2026, varias cuentas por proveedor)
-- =============================================================================
-- Un negocio puede conectar varias cuentas de Stripe o de Mercado Pago (lib/cuentas-integracion.ts): las de siempre, sin
-- sufijo, y `…__C2`, `…__C3`. Todo lo que se hace después con un cobro (releer su pago, devolverlo, cancelar su suscripción)
-- se hace con las claves de LA cuenta que lo cobró, y «Vincular cobro» decide si un pago es de un vínculo por esa cuenta.
--   · cuenta NULL = la principal (todo cobro de antes de esta migración). 'c2', 'c3'… = las demás.
--   · cuenta_ref = el id de esa cuenta EN EL PROVEEDOR (el `acct_…` de Stripe, el `user_id` de Mercado Pago). Es lo que
--     dice de quién es un cobro: si la cuenta se desconecta y vuelve con OTRO sufijo, el cobro la sigue encontrando
--     (revisión de plata del 22/10/2026: con el sufijo solo, sus avisos se ignoraban con un 200 y no se podía devolver).
--     Los cobros de ANTES lo completan acá, del ruteo (`webhook_routing` guarda el id en claro), SÓLO donde el negocio
--     tiene UNA cuenta de esa pasarela y ninguna con sufijo: sin esto, la principal que se desconecta y vuelve por
--     «Conectar otra» cae en otro sufijo, y las renovaciones de sus suscripciones viejas se ignoraban con un 200
--     (segunda revisión de plata, 22/10/2026). Donde hay duda (más de una fila) queda NULL: se rige por su sufijo.
-- Agrega columnas y un índice, y completa `cuenta_ref` de los cobros de antes donde no hay duda: idempotente (el
-- `update` sólo toca filas con `cuenta_ref` NULL).
-- =============================================================================

begin;

alter table cobros add column if not exists cuenta text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cobros_cuenta_check') then
    alter table cobros add constraint cobros_cuenta_check check (cuenta is null or cuenta ~ '^c([2-9]|[1-9][0-9]{1,2})$');
  end if;
end $$;
alter table cobros add column if not exists cuenta_ref text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cobros_cuenta_ref_check') then
    alter table cobros add constraint cobros_cuenta_ref_check check (cuenta_ref is null or char_length(cuenta_ref) between 1 and 120);
  end if;
end $$;
-- Volver a conectar una cuenta busca el sufijo de SUS cobros (lib/cuentas-pago-server.ts, `cuentaParaConectar`).
create index if not exists cobros_cuenta_ref_idx on cobros (workspace_id, proveedor, cuenta_ref) where cuenta_ref is not null;
update cobros c
   set cuenta_ref = r.identificador
  from (
    select workspace_id, servicio, min(identificador) as identificador
      from webhook_routing
     where servicio in ('stripe', 'mercadopago')
     group by workspace_id, servicio
    having count(*) = 1
  ) r
 where c.cuenta_ref is null
   and c.cuenta is null
   and c.workspace_id = r.workspace_id
   and c.proveedor = r.servicio
   and not exists (
     select 1 from credenciales k
      where k.workspace_id = c.workspace_id
        and k.clave like (case when c.proveedor = 'stripe' then 'STRIPE\_ACCOUNT\_ID\_\_%' else 'MERCADOPAGO\_USER\_ID\_\_%' end)
   );
comment on column cobros.cuenta_ref is 'El id de la cuenta EN EL PROVEEDOR que lo cobró (mig 0328): acct_… de Stripe, user_id de Mercado Pago. NULL en los cobros de antes.';
comment on column cobros.cuenta is 'La cuenta de la pasarela que lo cobró (mig 0328): NULL = la principal; c2, c3… = las demás (claves con sufijo __C2).';

commit;
