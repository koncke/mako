-- =============================================================================
-- 0418 — borrados_workspace: la constancia de que el super admin borró un negocio (18/11/2026, F126)
-- =============================================================================
-- ⚠️ SIN APLICAR (se escribió en la nube, que no puede aplicar migraciones). Se aplica con el sí de Martín.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy. Agrega y no saca nada: la versión desplegada no la mira, y el código nuevo
-- TOLERA que no esté (lib/eliminar-workspace.ts): sin la tabla, el borrado sigue y avisa «no quedó anotado». Lo que NO tolera es
-- la tabla instalada que no contesta: ahí no borra nada, porque un borrado sin constancia no tiene vuelta atrás ni rastro.
--
-- El porqué: «Eliminar» un cliente (lib/eliminar-workspace.ts) vacía sus 89 tablas, sus archivos y sus personas, y hasta hoy
-- no quedaba NADA que dijera que pasó: ni quién, ni cuándo, ni de qué agencia era. `bajas_cuenta` (0371) sobrevive al borrado,
-- pero sólo anota los pedidos de «Eliminar mi cuenta»; un borrado que decide el super admin no pasaba por ahí.
--
-- ⚠️ SIN CLAVES FORÁNEAS Y SIN `workspace_id`, Y NO ES UN OLVIDO (el molde es 0371). La fila tiene que sobrevivir a lo que
-- anota: una FK en cascada la borraría junto con el negocio, y una que no cascadea frenaría el DELETE de `workspaces`. Por eso
-- `negocio_id` no se llama `workspace_id` ni va a TENANT_TABLES ni a TABLAS_DE_INQUILINO: es de la plataforma, no del negocio.
--
-- ⚠️ SIN DATOS DE PERSONAS: `quien` es el email del super admin que borró (el equipo de MaKo, no un cliente), las personas que se
-- fueron con el negocio van como un número, y de las altas de agencia se guardan los ids y los estados, nunca el email ni el
-- nombre de la persona dada de alta. Una constancia de que se borró a alguien no puede ser el último lugar donde siguen sus datos.
-- =============================================================================

begin;

create table if not exists borrados_workspace (
  id            bigserial primary key,
  -- La anota el código ANTES de borrar y la cierra al terminar: con esta clave (no con el id, que la base de mentira de los tests
  -- no devuelve) se encuentra la misma fila.
  clave         text not null unique check (char_length(clave) <= 64),
  negocio_id    bigint not null,
  negocio       text not null default '' check (char_length(negocio) <= 200),
  capa          text check (capa is null or char_length(capa) <= 40),
  quien         text not null check (char_length(quien) <= 320),
  desde_ws      bigint,
  usuarios      int not null default 0,
  -- Sus filas de agencia_clientes y agencia_altas (como agencia y como cliente), que se van en cascada con el negocio.
  agencia       jsonb not null default '{}'::jsonb,
  estado        text not null default 'empezado' check (estado in ('empezado', 'hecho', 'fallo')),
  -- Lo que se borró (filas por tabla, archivos, leads desligados) y los avisos. Lo escribe el cierre.
  resumen       jsonb,
  error         text check (error is null or char_length(error) <= 2000),
  empezado_at   timestamptz not null default now(),
  terminado_at  timestamptz
);

create index if not exists idx_borrados_workspace_negocio on borrados_workspace (negocio_id, empezado_at desc);

comment on table borrados_workspace is 'Borrados de un negocio hechos por el super admin. De la plataforma: sobrevive al borrado (sin FK).';

-- RLS on sin políticas = sólo server-side (service_role), igual que el resto.
alter table borrados_workspace enable row level security;
revoke all on borrados_workspace from anon, authenticated;
revoke all on sequence borrados_workspace_id_seq from anon, authenticated;

commit;
