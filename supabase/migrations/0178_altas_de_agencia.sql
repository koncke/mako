-- =============================================================================
-- 0178 — Lo que una agencia PIDE: sumar a alguien a la cuenta de un cliente suyo
-- =============================================================================
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy, por lo mismo que la 0175.
-- El código nuevo la lee en cada carga del panel de la plataforma y en la ficha
-- de un cliente de agencia; sin la tabla, PostgREST contesta un error, el bloque
-- de aprobaciones lo dice y la agencia no puede pedir nada. Es fail-closed, pero
-- deja la feature muerta con cara de rota.
--
-- EL PEDIDO: «En super admin, me tienen que aparecer las notificaciones de cuando
-- una agencia intenta agregar a un nuevo usuario, para poder aceptarlo o
-- rechazarlo» (27/09/2026).
--
-- ⚠️ POR QUÉ UNA TABLA Y NO `propuestas` (mig 0128), QUE ES LA GENÉRICA.
-- `propuestas` es POR INQUILINO: la escribe y la lee `getTenantDb`, y todo su
-- diseño asume que quien propone y quien confirma están en el mismo workspace.
-- Acá no: propone la AGENCIA, el efecto cae en el workspace del CLIENTE, y firma
-- el SUPER ADMIN, que es un tercero. Meterlo ahí obligaría a saltear el scope del
-- tenant en las tres puntas, que es exactamente el corte que esa tabla protege.
--
-- ⚠️ Y POR QUÉ NO SE CREA EL USUARIO «SUSPENDIDO» Y SE LO ACTIVA AL APROBAR, que
-- era la salida barata. Porque crear la fila YA MANDA EL MAIL de acceso
-- (lib/invitaciones.ts) y ya ocupa el email —`usuarios.email` es único—, así que
-- un pedido rechazado dejaría a esa persona avisada de una cuenta que no existe y
-- al email quemado para el alta de verdad. Un pedido pendiente no es un usuario a
-- medias: es otra cosa, y va en otra tabla.

create table if not exists agencia_altas (
  id           bigserial   primary key,

  -- Quién pide (la agencia) y dónde cae el efecto (la cuenta del cliente).
  agencia_ws   bigint      not null references workspaces(id) on delete cascade,
  cliente_ws   bigint      not null references workspaces(id) on delete cascade,

  -- A quién quiere sumar. El email es LA identidad: `usuarios.email` es único y es
  -- por donde le va a llegar la invitación si esto se aprueba.
  email        text        not null,
  nombre       text        not null default '',
  rol_ws       text        not null default 'admin'
                 check (rol_ws in ('admin', 'closer', 'setter')),

  -- ⚠️ TRES ESTADOS Y NINGUNO SE BORRA, igual que en la 0175: «esta agencia quiso
  -- meter a esta persona y se le dijo que no» es un hecho que alguien va a querer
  -- auditar, y una fila borrada no cuenta nada.
  estado       text        not null default 'pendiente'
                 check (estado in ('pendiente', 'aprobada', 'rechazada')),

  -- Quién pidió y quién firmó, los dos por EMAIL y no por id: las cuentas se dan
  -- de baja y la decisión queda igual.
  pedido_por   text,
  decidido_por text,
  decidido_at  timestamptz,
  motivo       text,

  -- El usuario que se creó al aprobar. Es lo que hace que la fila conteste «¿en
  -- qué terminó?» sin tener que cruzarla a mano contra `usuarios` por el email —
  -- que además fallaría si a esa persona la borran y la vuelven a crear.
  usuario_id   bigint,

  created_at   timestamptz not null default now(),

  -- Una agencia no se suma gente a sí misma por este camino: para su propio
  -- workspace el alta es la normal. Mismo criterio que la 0175.
  constraint agencia_alta_no_es_su_propio_cliente check (agencia_ws <> cliente_ws)
);

comment on table agencia_altas is
  'Lo que una agencia pide sumar al equipo de un cliente suyo, esperando la firma del super admin. NO es un usuario a medias: hasta que se aprueba no existe fila en `usuarios` (crearla mandaría el mail y quemaría el email). Ver docs/hallazgos-seguridad.md → «Vista de agencia».';

-- ⚠️ IDEMPOTENCIA, y es la que evita el duplicado que nadie ve: dos clicks, dos
-- pestañas o un reintento con mala conexión dejarían dos pedidos por la misma
-- persona, y el super admin aprobaría el primero y vería el segundo como un
-- pedido nuevo sobre alguien que ya está adentro. Parcial sobre 'pendiente' a
-- propósito: rechazado el pedido, volver a pedirlo tiene que poderse.
create unique index if not exists agencia_altas_pendiente_unica
  on agencia_altas (cliente_ws, lower(email)) where estado = 'pendiente';

-- «¿Qué está esperando mi firma?» — la lectura del panel de la plataforma.
create index if not exists agencia_altas_estado on agencia_altas (estado, created_at);
-- «¿Qué pedí yo?» — la que dibuja la ficha del cliente en la vista de agencia.
create index if not exists agencia_altas_agencia on agencia_altas (agencia_ws, estado);

-- RLS + REVOKE, como toda tabla nueva. El server lee con `service_role`
-- (BYPASSRLS), así que esto no le cambia nada; lo que cierra es que `anon` pueda
-- leer los emails de la gente que una agencia quiso sumar. Y el revoke va
-- explícito porque el grant que llega depende de QUIÉN aplique el DDL.
alter table agencia_altas enable row level security;
revoke all on agencia_altas from anon, authenticated;
