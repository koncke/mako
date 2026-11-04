-- =============================================================================
-- 0346 — sin_conexion_aplicadas: los cambios hechos sin conexión que ya se subieron (MaKo sin conexión, T2, 28/10/2026)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae app/sin-conexion/acciones.ts. Agrega y no saca nada. Sin la
-- tabla, el código nuevo NO sube nada (contesta «reintentar»): sin la idempotencia, un corte a mitad podía duplicar una nota.
-- (El número puede cambiar al integrar: es el siguiente libre de esta rama.)
--
-- Una fila por CAMBIO de la cola (lib/sin-conexion/cola.ts): `id` es el que generó el navegador (16 bytes al azar en
-- base64url), su llave de idempotencia. Antes de escribir se inserta «en-curso» (la llave única frena a otra ventana que
-- suba lo mismo); al terminar pasa a «final» con el resultado, y repetir el mismo id devuelve ese resultado sin aplicar nada.
-- Lo arma lib/sin-conexion/subir.ts; el diseño, docs/diseno-mako-desktop-sin-conexion.md (punto 4).
--
-- Se lee y se escribe SIEMPRE con la persona (`usuario_id`, `usuarioPropio`) y el negocio de la sesión, por eso no va a
-- TENANT_TABLES: el filtro es explícito (app/_sin-conexion/acciones.ts) y el id sólo lo conoce el navegador que lo generó.
-- SÍ va a TABLAS_DE_INQUILINO (lib/tablas-de-inquilino.ts): vaciar o borrar un negocio se lleva sus filas.
-- =============================================================================

begin;

create table if not exists sin_conexion_aplicadas (
  id            text primary key check (char_length(id) between 8 and 64),
  usuario_id    bigint not null references usuarios(id) on delete cascade,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  tipo          text not null check (tipo in ('nota', 'etapa', 'contacto', 'tarea-estado', 'tarea-nueva')),
  estado        text not null check (estado in ('en-curso', 'final')),
  resultado     jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_sin_conexion_aplicadas_usuario on sin_conexion_aplicadas (usuario_id, created_at desc);

comment on table sin_conexion_aplicadas is 'MaKo sin conexión: los cambios de la cola ya subidos (id = llave de idempotencia del navegador). en-curso → final con su resultado.';

-- RLS on sin políticas = sólo server-side (service_role), igual que el resto.
alter table sin_conexion_aplicadas enable row level security;
revoke all on sin_conexion_aplicadas from anon, authenticated;

commit;
