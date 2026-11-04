-- =============================================================================
-- 0371 — bajas_cuenta: quién pidió eliminar su cuenta, hasta cuándo hay plazo y cómo terminó
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy de «Eliminar mi cuenta» (lib/baja-cuenta.ts). Agrega y no saca nada:
-- la versión desplegada no la mira. Sin la tabla, el botón dice que no pudo y manda a escribir a soporte: nadie queda
-- creyendo que pidió algo que no quedó anotado.
--
-- Apple (5.1.1(v)) y Play piden poder eliminar la cuenta desde la app. T4, docs/tiendas-play-appstore.md: el dueño borra el
-- negocio entero, en hasta 30 días, con un mail al terminar. Lo borra el super admin con lo que ya existe; esta tabla es la
-- marca que él ve y lo que hace que el plazo no dependa de la memoria de nadie.
--
-- ⚠️ SIN CLAVES FORÁNEAS Y SIN `workspace_id`, Y NO ES UN OLVIDO. La fila tiene que sobrevivir a lo que anota: una FK en
-- cascada la borraría junto con el negocio, y una que no cascadea frenaría el DELETE de `workspaces`. Por eso `negocio_id`
-- no se llama `workspace_id` ni va a TENANT_TABLES ni a TABLAS_DE_INQUILINO: no es un dato del negocio, es de la plataforma.
--
-- ⚠️ AL CERRARSE SE BORRAN `email`, `nombre` y `negocio` (lib/baja-cuenta.ts): quedan los ids y las fechas. Una constancia de
-- que se borró a alguien no puede ser el último lugar donde siguen sus datos.
-- =============================================================================

begin;

create table if not exists bajas_cuenta (
  id          bigserial primary key,
  usuario_id  bigint not null,
  negocio_id  bigint,
  alcance     text not null check (alcance in ('persona', 'negocio')),
  email       text check (email is null or char_length(email) <= 320),
  nombre      text check (nombre is null or char_length(nombre) <= 200),
  negocio     text check (negocio is null or char_length(negocio) <= 200),
  -- El negocio de prueba: el pedido se anota, pero no apaga nada (el revisor de la tienda puede tocar el botón).
  prueba      boolean not null default false,
  -- Lo que ESTE pedido apagó: cancelar devuelve sólo eso. Un negocio pausado por impago sigue pausado.
  pauso_negocio     boolean not null default false,
  suspendio_usuario boolean not null default false,
  pedida_at   timestamptz not null default now(),
  vence_at    timestamptz not null,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'hecha', 'cancelada')),
  cerrada_at  timestamptz,
  cerrada_por text check (cerrada_por is null or char_length(cerrada_por) <= 320),
  notas       text check (notas is null or char_length(notas) <= 1000)
);

-- Pedirlo dos veces (dos toques, dos teléfonos) devuelve el mismo pedido y no apaga nada dos veces.
create unique index if not exists bajas_cuenta_una_pendiente_uk on bajas_cuenta (usuario_id) where estado = 'pendiente';
create index if not exists idx_bajas_cuenta_estado on bajas_cuenta (estado, vence_at);

comment on table bajas_cuenta is 'Pedidos de «Eliminar mi cuenta». De la plataforma, no de un negocio: sobrevive al borrado de lo que anota (sin FK).';

-- RLS on sin políticas = sólo server-side (service_role), igual que el resto.
alter table bajas_cuenta enable row level security;
revoke all on bajas_cuenta from anon, authenticated;

commit;
