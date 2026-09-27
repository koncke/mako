-- =============================================================================
-- 0173 — La portada y la foto: de un cliente y de un proyecto
-- =============================================================================
-- «Quiero que la foto de perfil del cliente se pueda configurar y también el
-- banner… como lo hace Notion, que te ofrece varias imágenes para la portada.»
-- Y: «Quiero que los proyectos también tengan portada» (27/09/2026).
--
-- Hasta hoy las dos cosas se DERIVABAN del nombre: `colorDe()` hashea el nombre a
-- un hue y con eso se pintan la banda y las iniciales. Eso está bien como DEFAULT
-- —un color estable es mejor que un gris— y no es configurable por definición: el
-- único modo de cambiarlo era renombrar al cliente.
--
-- ⚠️ UNA SOLA COLUMNA PARA LAS DOS COSAS (degradado o foto), y es a propósito. El
-- valor es `grad:<id>` (un degradado del catálogo de `lib/portadas.ts`) o una URL
-- https de un origen permitido. Dos columnas —`portada_color` + `portada_url`—
-- serían dos formas de contestar «¿qué se ve arriba?», y la pantalla tendría que
-- desempatarlas: el día que las dos estén puestas, gana la que el código mire
-- primero y nadie sabe cuál es. Vacío/null = el degradado derivado del nombre, que
-- es lo que ya se ve hoy.
--
-- ⚠️ Y LOS PROYECTOS SON DOS TABLAS, COMO SIEMPRE. `BoardShell` es UNO y lo montan
-- el tablero del super-admin (`plan_proyectos`) y el de cada cliente
-- (`tarea_categorias`). Ya se pagó cuatro veces poner la columna en una sola mitad
-- (prioridad, Quarter 0162, recurrencia 0164, cliente 0172) y el modo de falla es
-- siempre el mismo: el control se dibuja, la request contesta 200 y no se guarda
-- nada. Ver AGENTS.md → «El tablero es UNO y las tablas son DOS».
--
-- ⚠️ LA FOTO DEL CLIENTE VA EN `leads` Y NO EN UNA TABLA DE CLIENTES, porque no hay
-- tabla de clientes: un cliente es un lead con `estado_lead = 'ganado'`
-- (`lib/clientes-ganados.ts`). Se guarda donde se lee.

-- ── el cliente (un lead ganado) ─────────────────────────────────────────────
alter table leads add column if not exists avatar_url text;
alter table leads add column if not exists portada    text;

-- ── el proyecto, en las DOS mitades del tablero ─────────────────────────────
alter table plan_proyectos   add column if not exists portada text;
alter table tarea_categorias add column if not exists portada text;

comment on column leads.avatar_url is 'Foto de perfil del cliente (mig 0173). URL pública del bucket `portadas`. null = iniciales sobre el color derivado del nombre.';
comment on column leads.portada    is 'Portada del cliente (mig 0173): `grad:<id>` del catálogo de lib/portadas.ts, o una URL https de un origen permitido. null = el degradado derivado del nombre.';
comment on column plan_proyectos.portada   is 'Portada del proyecto (mig 0173). Mismo formato que leads.portada. Su gemela es tarea_categorias.portada.';
comment on column tarea_categorias.portada is 'Portada del proyecto (mig 0173). Mismo formato que leads.portada. Su gemela es plan_proyectos.portada.';

-- ⚠️ ADITIVA, Y VA ANTES O JUNTO CON EL DEPLOY. Nada se borra y nada cambia de
-- tipo: el código viejo sigue andando con las columnas nuevas ignoradas, y el
-- código nuevo las LEE desde el primer render — así que aplicarla después dejaría
-- a PostgREST rechazando la fila entera en cada guardado. Es la regla de la
-- cabecera que AGENTS.md pide («Toda migración decide su ORDEN de despliegue»).
