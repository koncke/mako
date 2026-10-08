-- =============================================================================
-- 0227 — Los COMENTARIOS DE UNA CLASE: un post de la comunidad por clase
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. El código nuevo LEE la columna en cada consulta de posts
-- de la comunidad: el feed la filtra (`clase_id is null`, los hilos de clase no salen ahí) y `postDe`
-- la pide para decidir si un alumno ve el hilo. Sin la columna, PostgREST rechaza la consulta ENTERA y
-- se cae el feed de TODAS las comunidades. Agrega y no saca nada: aplicarla antes no molesta a la
-- versión desplegada, que no la mira.
--
-- Pedido del audio del 08/10/2026 (item 13 de docs/feedback-curso-08oct.md, minuto 15:00): «agregar si
-- el usuario quiere agregar un apartado de chat, que a veces muchas plataformas tienen, entonces vos
-- puedes chatear acerca de esa clase».
--
-- ⚠️ NO ES UNA TABLA NUEVA DE COMENTARIOS, A PROPÓSITO. Los comentarios de una clase son un post de la
-- comunidad del producto (`comunidad_posts`) con `clase_id` puesto, creado la primera vez que alguien
-- comenta. Así heredan TODO lo que la comunidad ya resuelve: comentar en dos niveles, los likes (los
-- puntos y el nivel), la moderación (borrar lo ajeno, cerrar comentarios, sacar a alguien), la campana
-- y el seguimiento del post. Una tabla aparte sería la segunda implementación de cada una de esas
-- cosas, y la primera que se quedaría vieja.
--
-- ⚠️ LA COLUMNA VA EN UNA TABLA QUE YA ESTÁ registrada como de inquilino (`comunidad_posts` está en
-- TENANT_TABLES de lib/workspace.ts y en TABLAS_DE_INQUILINO de lib/tablas-de-inquilino.ts desde la
-- 0217): no hay registro nuevo que hacer.
--
-- ⚠️ ON DELETE CASCADE: el hilo se va con su clase. Una clase en la papelera (mig 0223) NO se borra
-- todavía —el hilo queda, invisible para el alumno porque su clase «no existe» para él— y la purga de
-- los 7 días borra la fila de la clase y con ella el hilo, sus comentarios y sus likes.
--
-- ⚠️ LA FK VA APARTE DEL `add column`, con su DO: un `add column if not exists … references` sobre una
-- columna que YA existe es un no-op silencioso y no agrega la FK (AGENTS.md).

begin;

alter table comunidad_posts add column if not exists clase_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comunidad_posts_clase_fk') then
    alter table comunidad_posts
      add constraint comunidad_posts_clase_fk foreign key (clase_id) references curso_clases(id) on delete cascade;
  end if;
end $$;

-- UN hilo por clase: dos primeros comentarios en el mismo segundo no crean dos posts (el segundo
-- choca con 23505 y lee el del primero, lib/comunidad-datos.ts → `hiloDeLaClase`).
create unique index if not exists comunidad_posts_clase_uk
  on comunidad_posts (workspace_id, producto_id, clase_id) where clase_id is not null;

comment on column comunidad_posts.clase_id is
  'El hilo de comentarios de UNA clase (mig 0227): null = un post del feed. Uno por clase; se crea con el primer comentario. No sale en el feed ni en la búsqueda.';

-- La tabla ya tenía RLS y el revoke (0217); se re-afirman, idempotentes.
alter table comunidad_posts enable row level security;
revoke all on comunidad_posts from anon, authenticated;

commit;
