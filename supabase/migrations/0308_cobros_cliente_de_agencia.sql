-- =============================================================================
-- 0308_cobros_cliente_de_agencia — MaKo le cobra a una agencia el lugar de cada cliente (17/10/2026)
-- =============================================================================
-- Las tarjetas #866 y #867 del Plan, de la llamada «Revisión de MaKo» con Código Inmobiliario (16/10):
--   · #866 (1:51:21): al abrirle la cuenta a un cliente, la agencia paga su primer mes con un link de la Mercado Pago de
--     MaKo, y el pago lo habilita sin que Martín lo apruebe. 47 dólares por cliente.
--   · #867 (1:59:00): ese mes corre desde que el cliente termina el onboarding; ahí MaKo crea la suscripción mensual,
--     que empieza a cobrar un mes después.
--
--   · `cobros.agencia_ws` + `cobros.cliente_ws`: el cobro (de la plataforma) paga el lugar de ESE cliente de ESA agencia.
--     Al pagarse el primer mes, la cartera pasa a aprobada (lib/agencia-habilitar.ts). null en todo otro cobro.
--   · `cobros.inicio_at`: cuándo empieza a cobrar una suscripción que no cobra al autorizarla (la renovación del cliente:
--     Mercado Pago lo recibe como `start_date`).
--   · `cobros_un_vivo_por_cliente_de_agencia`: un primer mes y una renovación vivos por cliente. Dos clics, dos pestañas o
--     el cron dos veces eran dos meses cobrados; con el índice, el segundo choca y `crearCobro` devuelve el que ganó. Uno
--     anulado, devuelto o una suscripción cancelada no cuentan: se puede crear otro.
--
-- Las FK son `on delete set null` y no cascade: un cobro es plata, y borrar el workspace no lo borra.
--
-- ORDEN: ANTES del deploy que las lee. Sin ellas, abrir la cuenta de un cliente de agencia queda como siempre (espera la
-- aprobación: el insert del cobro falla y se dice), la pantalla de la agencia no muestra links y el cron lo anota en el
-- log; ningún otro cobro las lee ni las escribe (COLS_COBRO no las tiene). Seguro de re-ejecutar.
-- =============================================================================

alter table cobros add column if not exists agencia_ws bigint references workspaces(id) on delete set null;
alter table cobros add column if not exists cliente_ws bigint references workspaces(id) on delete set null;
alter table cobros add column if not exists inicio_at timestamptz;

comment on column cobros.agencia_ws is
  'La agencia que paga el lugar de un cliente suyo (con cliente_ws). Sólo en cobros de la plataforma. Mig 0308.';
comment on column cobros.cliente_ws is
  'El cliente de agencia cuyo lugar paga este cobro: el primer mes lo habilita (lib/agencia-habilitar.ts). Mig 0308.';
comment on column cobros.inicio_at is
  'Cuándo empieza a cobrar una suscripción que no cobra al autorizarla (la renovación de un cliente de agencia). Mig 0308.';

create unique index if not exists cobros_un_vivo_por_cliente_de_agencia
  on cobros (cliente_ws, tipo)
  where cliente_ws is not null
    and estado in ('pendiente', 'fallido', 'pagado')
    and suscripcion_estado is distinct from 'cancelada';

-- «¿Qué tiene que pagar esta agencia?» — la lectura de su pantalla de clientes.
create index if not exists cobros_por_agencia on cobros (agencia_ws, cliente_ws) where agencia_ws is not null;
