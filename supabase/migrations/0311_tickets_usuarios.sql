-- =============================================================================
-- 0311 — La Ticketera de los USUARIOS: el ticket que levanta un cliente, y su historial
-- =============================================================================
-- Pedido de Martín (17/10/2026): «La ticketera desde ahora será exclusiva para los tickets levantados por los
-- usuarios... el ticket me tiene que llegar con el reporte de a quién pertenece... un bug evidente que debería funcionar
-- bien debe solucionarse automáticamente, pero si alguien pide implementar algo nuevo, eso sí depende de mi decisión».
-- El diseño entero, con lo que se copió de quién: docs/diseno-ticketera-usuarios.md.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. Crea dos tablas nuevas que el código nuevo YA LEE; el viejo no las conoce.
-- Si el código llegara antes, /tickets dice «todavía no está disponible» (lib/tickets-db.ts, `faltaTabla`) y no se cae
-- nada. Idempotente: se puede volver a correr.
--
-- ⚠️ MULTI-INQUILINO: las dos tablas tienen RLS SIN políticas y el revoke a anon/authenticated, como todo lo del repo:
-- el servidor lee con service_role y el corte lo hace el código (lib/tickets-db.ts): un usuario ve SÓLO los suyos
-- (`usuario_email` dentro de su workspace), el super admin ve todos. Lo fija tests/tickets.test.ts.
--
-- ⚠️ QUIÉN LO LEVANTÓ ES UNA FOTO: el nombre, el email, el rol y el plan se copian al crearlo. Un ticket de hace un mes
-- tiene que decir quién era esa persona ESE día, aunque después la saquen del equipo o el negocio cambie de plan.
--
-- ⚠️ LO QUE DECIDE EL TRIAGE NO SE PISA: `triage` es el veredicto de la máquina, con su porqué, y queda como estaba.
-- Si Martín lo corrige, cambia `tipo` y se prende `tipo_manual`: ningún proceso automático vuelve a clasificarlo
-- (AGENTS.md, «Lo que la IA decide, la persona lo tiene que poder cambiar»).

begin;

create table if not exists tickets (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- La clave de idempotencia del que lo levanta (un doble clic, un reintento): el mismo `ref` es el mismo ticket.
  ref             text unique check (ref is null or char_length(ref) between 8 and 120),

  -- ── quién ────────────────────────────────────────────────────────────────
  workspace_id    bigint not null references workspaces(id) on delete cascade,
  usuario_id      bigint references usuarios(id) on delete set null,
  usuario_email   text not null check (usuario_email = lower(usuario_email)),
  usuario_nombre  text not null default '',
  rol             text,
  plan            text,

  -- ── qué ──────────────────────────────────────────────────────────────────
  tipo            text not null check (tipo in ('bug', 'pedido', 'pregunta')),
  tipo_manual     boolean not null default false,
  titulo          text not null check (char_length(titulo) between 1 and 140),
  descripcion     text not null default '' check (char_length(descripcion) <= 4000),
  -- Por dónde lo levantó: por ahí mismo le llega el aviso.
  canal           text not null check (canal in ('chat_app', 'chat_movil', 'whatsapp', 'formulario', 'api')),
  -- Lo que se junta SOLO (lib/tickets-reglas.ts, `sanearContexto`): la pantalla, el chat, lo que pidió, lo que contestó
  -- MaKo, el error, la hora y el navegador. Nunca lo escribe la persona.
  contexto        jsonb not null default '{}'::jsonb,

  -- ── en qué anda ──────────────────────────────────────────────────────────
  estado          text not null default 'nuevo'
    check (estado in ('nuevo', 'esperando_decision', 'esperando_cliente', 'en_curso', 'arreglado', 'resuelto', 'rechazado', 'duplicado')),
  prioridad       text not null default 'media' check (prioridad in ('urgente', 'alta', 'media', 'baja')),
  triage          jsonb,

  -- ── lo que decidió Martín ────────────────────────────────────────────────
  decision        text check (decision in ('arreglar', 'hacer', 'rechazar', 'duplicado', 'responder', 'preguntar')),
  decision_nota   text check (decision_nota is null or char_length(decision_nota) <= 2000),
  decidido_at     timestamptz,
  duplicado_de    bigint references tickets(id) on delete set null,
  -- Lo que lee el cliente en su ticket (la respuesta, por qué no, o qué se arregló).
  respuesta       text check (respuesta is null or char_length(respuesta) <= 2000),

  -- ── el pedido al Cerebro ─────────────────────────────────────────────────
  -- 'firmado': lo mandó Martín desde su dispositivo (operaciones_pedidos.id en pedido_id).
  -- 'runner': un bug del triage; lo entrega el Runner con un texto FIJO (lib/tickets-aviso.ts), como el aviso de la
  -- Ticketera vieja. Los aviso_* son los mismos de admin_decisiones (mig 0288).
  despacho        text check (despacho in ('firmado', 'runner')),
  pedido_id       uuid,
  despachado_at   timestamptz,
  aviso_id        uuid,
  aviso_estado    text check (aviso_estado is null or aviso_estado in ('tomado', 'entregado', 'no_entregado', 'incierto')),
  aviso_at        timestamptz,
  aviso_intentos  integer not null default 0,
  aviso_motivo    text,

  -- ── el arreglo ───────────────────────────────────────────────────────────
  arreglado_at    timestamptz,
  arreglo_nota    text check (arreglo_nota is null or char_length(arreglo_nota) <= 2000),
  resuelto_at     timestamptz,
  -- Cuándo se le avisó al cliente que está resuelto (o que no se va a hacer). null = falta avisar.
  avisado_at      timestamptz
);

comment on table tickets is 'Los tickets que levantan los usuarios de MaKo (mig 0311). Un usuario ve sólo los suyos; el super admin, todos. docs/diseno-ticketera-usuarios.md.';
comment on column tickets.triage is 'El veredicto del triage automático (tipo, autoArreglo, confianza, porque[]). Lo escribe la máquina una vez y no se pisa.';
comment on column tickets.tipo_manual is 'Martín corrigió el tipo: ningún proceso automático lo vuelve a clasificar.';
comment on column tickets.canal is 'Por dónde lo levantó: por ahí le llega el aviso de que se resolvió.';
comment on column tickets.despacho is 'Cómo llegó al Cerebro: firmado por Martín, o por el Runner con un texto fijo (bug del triage).';

create index if not exists tickets_usuario_idx on tickets (workspace_id, usuario_email, created_at desc);
create index if not exists tickets_estado_idx on tickets (estado, created_at desc);
create unique index if not exists tickets_aviso_id_idx on tickets (aviso_id) where aviso_id is not null;

create table if not exists ticket_eventos (
  id         bigint generated always as identity primary key,
  ticket_id  bigint not null references tickets(id) on delete cascade,
  at         timestamptz not null default now(),
  actor      text not null check (actor in ('cliente', 'mako', 'triage', 'martin', 'cerebro', 'sistema')),
  tipo       text not null check (char_length(tipo) between 1 and 40),
  texto      text check (texto is null or char_length(texto) <= 2000),
  datos      jsonb
);

comment on table ticket_eventos is 'El historial de cada ticket: quién hizo qué y cuándo (mig 0311).';

create index if not exists ticket_eventos_ticket_idx on ticket_eventos (ticket_id, at);

alter table tickets enable row level security;
alter table ticket_eventos enable row level security;
revoke all on tickets from anon, authenticated;
revoke all on ticket_eventos from anon, authenticated;

commit;
