-- =============================================================================
-- 0179 — La cara de un CLIENTE de la plataforma: su portada y su marca
-- =============================================================================
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy. Son cuatro columnas que el
-- código nuevo LEE en cada carga del panel de la plataforma (`WS_COLS`); sin ellas
-- PostgREST rechaza el select ENTERO y la lista de clientes no se dibuja. No es
-- que se pierda la portada: se pierde la pantalla.
--
-- EL PEDIDO: «El detail está mal, te había dicho que idéntico al del plan, solo que
-- con más opciones para administrar al usuario» (28/09/2026), sobre el detalle de un
-- cliente en la vista del super admin. El detalle de un PROYECTO tiene portada a
-- sangre, marca cruzándola y las pastillas para cambiarla; un WORKSPACE no tenía
-- dónde guardar nada de eso, así que «idéntico» era imposible de escribir.
--
-- ⚠️ Y CIERRA UN HUECO QUE YA ESTABA ANOTADO. Hasta hoy la cara de la tarjeta de un
-- cliente era la de SU ADMIN (su foto de Google, o el Gravatar de su email — ver
-- `caraDeUsuario` en lib/gravatar.ts). Eso es un respaldo razonable y no es lo mismo
-- que la imagen del NEGOCIO: el día que ese admin se va, el cliente cambia de cara.
-- La precedencia queda `icono del workspace > la cara de su admin > las iniciales`,
-- y la primera es la única que alguien eligió A PROPÓSITO para ese cliente.
--
-- ⚠️ MISMO FORMATO QUE `leads` Y `plan_proyectos` (migs 0173/0174), a propósito: las
-- tres las dibuja la MISMA función (`fondoPortada`, lib/portadas.ts) y el mismo
-- componente (`Marca`). Un cuarto formato sería un cuarto parser.
--
-- ⚠️ ES SEGURO AGREGARLAS, y se verificó antes de escribirlo — no se dio por
-- supuesto. El modo de falla caro de una columna nueva es el `upsert` de fila entera
-- armada en el navegador, que manda `undefined` en lo que el mapper de lectura no
-- trajo y BORRA la columna en el próximo guardado de cualquier otra cosa (AGENTS.md,
-- «El tablero es UNO y las tablas son DOS»). Acá no puede pasar: las TRES escrituras
-- que existen sobre `workspaces` son parciales o enumeran sus columnas —
-- `actualizarWorkspace` (update con un patch, lib/workspace.ts), `crearWorkspace`
-- (insert de cuatro campos) y el alta del Cliente de Diseño (insert de cinco) — y no
-- hay un solo `upsert` en todo el repo. Lo que sí hay que hacer, y se hace en el
-- mismo commit, es sumarlas a `WS_COLS`: una columna que el select no trae es una
-- columna que la pantalla pinta como `undefined`.

alter table workspaces add column if not exists portada   text;
alter table workspaces add column if not exists portada_y smallint;
alter table workspaces add column if not exists icono     text;
alter table workspaces add column if not exists avatar_y  smallint;

comment on column workspaces.portada is
  'Portada del cliente (mig 0179): `grad:<id>` del catálogo de lib/portadas.ts, o una URL https de un origen permitido. NULL = el degradado derivado del nombre. Mismo formato que leads.portada y plan_proyectos.portada — las tres las pinta `fondoPortada`.';
comment on column workspaces.portada_y is
  'Encuadre vertical de la portada, 0-100 (mig 0179). NULL = centrado. Sólo aplica si la portada es una foto.';
comment on column workspaces.icono is
  'La marca del cliente (mig 0179): `icon:<set>:<nombre>` de Iconify, `emoji:<x>`, o una URL https del bucket. NULL = la cara de su admin (foto de Google o Gravatar, ver caraDeUsuario), y sin eso las iniciales. Es la única de las tres que alguien eligió A PROPÓSITO para este cliente.';
comment on column workspaces.avatar_y is
  'Encuadre vertical de la marca dentro de su caja, 0-100 (mig 0179). NULL = centrado.';

-- El mismo rango que la 0174 les puso a `leads` y a `plan_proyectos`. Va con DO
-- porque `add constraint` no tiene `if not exists`, y esta migración se puede volver
-- a correr.
do $$
begin
  alter table workspaces add constraint workspaces_portada_y_rango
    check (portada_y is null or (portada_y between 0 and 100));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table workspaces add constraint workspaces_avatar_y_rango
    check (avatar_y is null or (avatar_y between 0 and 100));
exception when duplicate_object then null;
end $$;
