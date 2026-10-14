-- =============================================================================
-- 0273 — Las CREACIONES que un negocio publica para los demás, y sus ESTRELLAS (como GitHub)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae lib/creaciones.ts, la página /creaciones y el área
-- «creaciones» de la API de MaKo. Agrega y no saca nada: la versión desplegada no la nombra. Sin ella, el código
-- nuevo contesta «Falta la migración 0273 (creaciones).» y nada más se rompe.
--
-- Pedido de Martín (13/10/2026, punto 10 del feedback), textual: «Quiero implementar el sistema de "estrellas" de
-- github en todo MaKo... Yo como creador de MaKo, jamás voy a poder idear todos los escenarios, todas las
-- automatizaciones, los dashboards, los formatos de generación de vídeo o imagen, etc etc... Por eso quiero crear un
-- sistema parecido al de github de estrellas, para que los usuarios hagan sus creaciones y otros usuarios puedan
-- puntuarles. Yo claro que puedo hacer ciertos templates en un inicio, pero luego la comunidad se va a encargar.»
--
-- UN mecanismo para todas las creaciones (automatizaciones, dashboards, formatos de video y de imagen): una tabla de
-- lo publicado y una de estrellas. Lo que cambia por tipo —qué es la definición, cómo se exporta y cómo se usa— vive en
-- el código de cada feature (lib/creaciones-enchufes.ts), no acá.
--
-- `creaciones`, una fila por publicación:
--   · `definicion`: la DEFINICIÓN de la creación (el mismo criterio que «Copiar flujo» con un token, mig 0265): las
--     tarjetas de una automatización, no sus leads ni sus envíos. La valida el enchufe de su tipo al publicar.
--   · `workspace_origen`: el negocio que la publicó. ⚠️ NO SE LLAMA `workspace_id` A PROPÓSITO (como `flujo_copias`):
--     la fila se LEE desde cualquier negocio —es para compartir—, así que no pasa por `getTenantDb` ni va en
--     `TENANT_TABLES`. Borrar el negocio borra lo que publicó (cascade).
--   · `de_mako`: la publicó el workspace de la plataforma (las plantillas «de MaKo» del arranque).
--   · `estrellas` y `usos`: contadores que mantienen los triggers de abajo (la fuente son las otras dos tablas). Nunca
--     se escriben a mano.
--   · `estado`: 'publicada' o 'retirada'. Retirar no borra: los que ya la usaron tienen su copia.
--
-- `creacion_estrellas`: UNA estrella por NEGOCIO y creación (no por persona: cinco del mismo equipo no inflan una
-- creación). `quien` es el email de quien la dio, para auditar. Un negocio no se da estrellas a sí mismo (lo frena el
-- código: lib/creaciones-reglas.ts).
--
-- `creacion_usos`: los negocios que la USARON, uno por fila (el «Used by» de GitHub). Con el mismo criterio que las
-- estrellas: usarla diez veces no la infla, y su autor usándola no cuenta (lo frena el código). `veces` y `ultimo_uso`
-- quedan para auditar.
--
-- RLS prendida sin políticas y `revoke` explícito: el que mantiene afuera a la clave pública es el revoke. El servidor
-- lee y escribe con service_role (`getSupabaseServer`).

begin;

create table if not exists creaciones (
  id               bigserial primary key,
  tipo             text not null check (tipo ~ '^[a-z_]{3,40}$'),
  titulo           text not null check (char_length(titulo) between 1 and 80),
  descripcion      text not null default '' check (char_length(descripcion) <= 500),
  definicion       jsonb not null,
  workspace_origen bigint not null references workspaces(id) on delete cascade,
  origen_id        text,
  autor_nombre     text not null default '' check (char_length(autor_nombre) <= 80),
  publicado_por    text not null default '' check (char_length(publicado_por) <= 200),
  de_mako          boolean not null default false,
  estado           text not null default 'publicada' check (estado in ('publicada', 'retirada')),
  estrellas        integer not null default 0 check (estrellas >= 0),
  usos             integer not null default 0 check (usos >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- `origen_id` es el id de la cosa en el negocio que la publicó, como TEXTO: una automatización tiene un número y un
-- anuncio del Video Generator un UUID. La primera versión lo creó bigint (aplicada el 14/10 con la tabla vacía): esto
-- lo deja en texto y es un no-op si ya lo es.
alter table creaciones alter column origen_id type text using origen_id::text;

create index if not exists idx_creaciones_galeria on creaciones (tipo, estado, estrellas desc, id desc);
create index if not exists idx_creaciones_origen on creaciones (workspace_origen);

create table if not exists creacion_estrellas (
  creacion_id          bigint not null references creaciones(id) on delete cascade,
  workspace_estrella   bigint not null references workspaces(id) on delete cascade,
  quien                text not null default '' check (char_length(quien) <= 200),
  created_at           timestamptz not null default now(),
  primary key (creacion_id, workspace_estrella)
);

create index if not exists idx_creacion_estrellas_ws on creacion_estrellas (workspace_estrella);

-- El contador sale de la tabla de estrellas, en la misma transacción: nunca se escribe a mano.
create or replace function creaciones_contar_estrellas() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update creaciones set estrellas = estrellas + 1 where id = new.creacion_id;
  elsif tg_op = 'DELETE' then
    update creaciones set estrellas = greatest(estrellas - 1, 0) where id = old.creacion_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_creacion_estrellas on creacion_estrellas;
create trigger trg_creacion_estrellas after insert or delete on creacion_estrellas
  for each row execute function creaciones_contar_estrellas();

create table if not exists creacion_usos (
  creacion_id      bigint not null references creaciones(id) on delete cascade,
  workspace_uso    bigint not null references workspaces(id) on delete cascade,
  veces            integer not null default 1 check (veces >= 1),
  primer_uso       timestamptz not null default now(),
  ultimo_uso       timestamptz not null default now(),
  primary key (creacion_id, workspace_uso)
);

-- `usos` cuenta NEGOCIOS: sube cuando aparece uno nuevo (el insert), no cuando uno repite (el update de `veces`).
create or replace function creaciones_contar_usos() returns trigger
language plpgsql set search_path = public as $$
begin
  update creaciones set usos = usos + 1 where id = new.creacion_id;
  return null;
end $$;

drop trigger if exists trg_creacion_usos on creacion_usos;
create trigger trg_creacion_usos after insert on creacion_usos
  for each row execute function creaciones_contar_usos();

comment on table creaciones is 'Lo que un negocio publica para los demás (automatizaciones, dashboards, formatos): la definición, nunca los datos del negocio. Se lee desde cualquier negocio.';
comment on table creacion_estrellas is 'Una estrella por negocio y creación (como las de GitHub). El contador de creaciones.estrellas lo mantiene un trigger.';
comment on table creacion_usos is 'Los negocios que usaron una creación, uno por fila. El contador de creaciones.usos lo mantiene un trigger.';

alter table creaciones enable row level security;
alter table creacion_estrellas enable row level security;
alter table creacion_usos enable row level security;
revoke all on creaciones from anon, authenticated;
revoke all on creacion_estrellas from anon, authenticated;
revoke all on creacion_usos from anon, authenticated;
revoke all on function creaciones_contar_estrellas() from public, anon, authenticated;
revoke all on function creaciones_contar_usos() from public, anon, authenticated;

commit;
