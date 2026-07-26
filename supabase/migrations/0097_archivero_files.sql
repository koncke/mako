-- =============================================================================
-- 0097_archivero_files — El Archivero: los documentos del negocio, con procedencia
-- =============================================================================
-- El cliente "tira" sus documentos sueltos (avatar, oferta, nicho, guiones, web…)
-- y MaKo los ordena en el brief. A diferencia del flujo viejo (leer y descartar),
-- acá los binarios SE CONSERVAN (bucket privado 'archivero') y cada archivo guarda
-- QUÉ campos del brief aportó (para poder borrarlo en cascada) + un razonamiento
-- corto de qué encontró. El brief efectivo (mako.onboarding.answers) se deriva de
-- estos archivos + las respuestas manuales, así borrar un archivo recalcula todo.
-- =============================================================================

begin;

create table if not exists archivero_files (
  id            text        not null,
  workspace_id  bigint      not null default 1 references workspaces(id) on delete cascade,
  nombre        text        not null,
  mime          text,
  tamano        bigint,
  storage_path  text        not null,
  razonamiento  text,
  campos        jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, id)
);

create index if not exists archivero_files_ws on archivero_files (workspace_id);

-- Solo service_role (mismo criterio que el resto de las tablas multi-tenant).
alter table archivero_files enable row level security;

-- Bucket PRIVADO para los binarios (se sirven con URL firmada, patrón 'contratos').
insert into storage.buckets (id, name, public)
values ('archivero', 'archivero', false)
on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';
