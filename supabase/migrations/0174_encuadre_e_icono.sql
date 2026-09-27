-- =============================================================================
-- 0174 — El encuadre de una imagen, y el ícono de un proyecto
-- =============================================================================
-- «Que al apretar reposicionar se pueda ajustar la imagen arrastrando» y «agregues
-- íconos y la opción de subir, tanto en los proyectos como en los clientes»
-- (27/09/2026), con las capturas de Notion al lado.
--
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy. Es una migración ADITIVA
-- cuyas columnas el código nuevo YA LEE: entre un deploy sin estas columnas y la
-- migración, PostgREST rechaza la fila entera del `upsert` y falla cada guardado
-- del tablero, con la pantalla ya pintada. Ver AGENTS.md → «Toda migración decide
-- su ORDEN de despliegue».
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ POR QUÉ COLUMNAS Y NO UN FRAGMENTO EN EL STRING QUE YA EXISTE
-- ─────────────────────────────────────────────────────────────────────────────
-- La primera versión de esto NO iba a tocar el esquema: la posición viajaba como
-- fragmento de la URL (`https://…/foto.jpg#y=35`) y el ícono subido se guardaba en
-- la columna `emoji` que ya existe. Era más barato y estaba mal. Un panel de tres
-- refutadores lo tumbó por unanimidad el 27/09/2026, y las cinco razones están
-- medidas contra el código, no argumentadas:
--
--   1. **`emoji` NO es un string: es un campo de glifo de cuatro caracteres.**
--      `lib/todo.ts:602` y `:621` hacen `(emoji || '🏷').slice(0, 4)`. Una URL
--      guardada ahí queda literalmente en `http`. Y la otra mitad del tablero
--      (`plan_proyectos`) NO trunca, así que el MISMO componente guarda bien en un
--      tablero y destruye en el otro. Ése es un SÉPTIMO lugar que la tabla de
--      AGENTS.md ni siquiera enumera.
--   2. **Y se rompía sin que nadie tocara el ícono.** `app/plan/TodoBoard.tsx:151`
--      manda la etiqueta ENTERA en cualquier edición, así que poner una portada le
--      borraba el ícono al proyecto. Y `lib/plan-board.ts:1131` escribe `emoji` con
--      lo que devolvió el modelo: el Perro le pisaba el ícono a cualquier proyecto
--      que pasara por su pasada.
--   3. **`emoji` viaja como TEXTO a cinco lugares que no son una pantalla**: el
--      prompt de extracción de reuniones (`lib/plan-fathom.ts:789`), el título del
--      Markdown y la columna del CSV del export (`app/plan/board/exportar.ts:146`
--      y `:111`), los desplegables de asignar, y la API pública de MaKo
--      (`lib/api-mako/areas/plan.run.ts`). `startsWith('https://')` arregla a quien
--      lo DIBUJA; no arregla a los que lo concatenan.
--   4. **El fragmento sobre un degradado BORRABA la portada, con `ok: true`.**
--      `saneaPortada` (`lib/portadas.ts:132`) busca `grad:indigo#y=35` en el
--      catálogo, no lo encuentra y devuelve `null` — y descartar acá es volver al
--      default. Respuesta exitosa, portada desaparecida, cero errores.
--   5. **El fragmento se acumulaba.** `new URL('…#y=20#y=35').hash` es
--      `'#y=20#y=35'` entero: arrastrás, soltás y la imagen vuelve a donde estaba.
--
-- Una columna `smallint` acotada no tiene ninguno de los cinco: no la trunca nadie,
-- no viaja a ningún prompt, no puede pisar al degradado —se queda en NULL— y no se
-- acumula. Se paga la regla de los seis lugares UNA vez y a la vista.
--
-- ⚠️ Y LOS PROYECTOS SON DOS TABLAS, COMO SIEMPRE (AGENTS.md → «El tablero es UNO y
-- las tablas son DOS»). Ya se pagó CINCO veces poner la columna en una sola mitad:
-- prioridad a mano, Quarter (0162), recurrencia (0164), cliente (0172) y portada
-- (0173). El modo de falla es siempre el mismo: el control se dibuja, la request
-- contesta 200 y no se guarda nada.

-- ── el encuadre vertical: 0 = arriba de todo · 100 = abajo de todo ───────────
-- NULL = centrado, que es lo que se ve hoy (`fondoPortada` cableaba `center`).
-- ⚠️ NULL Y NO 50: son dos cosas distintas. «Nadie lo movió» tiene que poder
-- distinguirse de «lo movió y lo dejó justo al medio», porque lo primero se puede
-- reencuadrar solo el día que cambiemos el alto de la banda y lo segundo no.
--
-- ⚠️ SÓLO EL EJE Y, a propósito. La banda es más ancha que alta y la foto se sirve
-- ya recortada a esa proporción (`/1600/420`), así que sobra alto y nunca ancho:
-- un eje X existiría para mover algo que no se puede mover. La foto de perfil es
-- cuadrada y el mismo razonamiento aplica al revés — ahí lo que se recorta es el
-- lado largo, que en un retrato es el vertical.
alter table leads            add column if not exists portada_y smallint;
alter table leads            add column if not exists avatar_y  smallint;
alter table plan_proyectos   add column if not exists portada_y smallint;
alter table tarea_categorias add column if not exists portada_y smallint;

-- El rango se fija en la BASE y no sólo en el saneo de TypeScript: a estas tablas
-- les escriben el navegador, dos crons y la API de MaKo, y un `y` de 9999 deja la
-- imagen fuera de su caja sin que nada avise.
do $$ begin
  alter table leads            add constraint leads_portada_y_rango            check (portada_y is null or (portada_y between 0 and 100));
  alter table leads            add constraint leads_avatar_y_rango             check (avatar_y  is null or (avatar_y  between 0 and 100));
  alter table plan_proyectos   add constraint plan_proyectos_portada_y_rango   check (portada_y is null or (portada_y between 0 and 100));
  alter table tarea_categorias add constraint tarea_categorias_portada_y_rango check (portada_y is null or (portada_y between 0 and 100));
exception when duplicate_object then null; end $$;

-- ── el ícono: al lado de `emoji`, NUNCA adentro ──────────────────────────────
-- Guarda `icon:<set>:<nombre>` (un ícono de Iconify — ver `lib/iconos-catalogo.ts`,
-- que sólo acepta los sets MIT/ISC) o una URL https de un origen permitido (una
-- imagen subida al bucket `portadas`).
--
-- ⚠️ `emoji` NO SE TOCA Y SIGUE SIENDO LA FUENTE DE LOS CONSUMIDORES DE TEXTO. La
-- regla de lectura es `icono ?? emoji`, y sólo la PANTALLA la aplica: el prompt, el
-- export y la API siguen leyendo `emoji`, que siempre es un glifo. Por eso elegir
-- un emoji en el selector nuevo escribe `emoji` y deja `icono` en NULL, y elegir un
-- ícono o una imagen escribe `icono` y deja el `emoji` que había como respaldo.
-- Así no hay dos respuestas a la misma pregunta: hay una respuesta y un respaldo,
-- y el respaldo nunca puede ser una URL.
alter table plan_proyectos   add column if not exists icono text;
alter table tarea_categorias add column if not exists icono text;

-- Y el cliente también, porque el selector es EL MISMO («que sea lo mismo el pop-up
-- de edición de la foto del perfil»). Acá no hay columna `emoji` que respalde: la
-- regla de lectura es `icono ?? avatar_url ?? las iniciales`, y las iniciales sobre
-- el color derivado del nombre siguen siendo el default de siempre.
--
-- ⚠️ Y NO SE METE EN `avatar_url`, por la misma razón que el ícono no se mete en
-- `emoji`: esa columna la valida `urlDeImagenOk` y la comparte con
-- `/api/perfil/avatar`, que es otra feature y no sabe de `icon:`. Un `icon:lucide:x`
-- ahí vuelve `null` y la foto se borra sin error.
alter table leads            add column if not exists icono text;

comment on column leads.portada_y            is 'Encuadre vertical de la portada, 0-100 (mig 0174). NULL = centrado. Sólo aplica si la portada es una foto.';
comment on column leads.avatar_y             is 'Encuadre vertical de la foto de perfil dentro del círculo, 0-100 (mig 0174). NULL = centrado.';
comment on column leads.icono                is 'El ícono del cliente (mig 0174): `icon:<set>:<nombre>` de Iconify, o una URL https del bucket. NULL = usar `avatar_url`, y sin foto, las iniciales.';
comment on column plan_proyectos.portada_y   is 'Encuadre vertical de la portada, 0-100 (mig 0174). NULL = centrado.';
comment on column tarea_categorias.portada_y is 'Encuadre vertical de la portada, 0-100 (mig 0174). NULL = centrado.';
comment on column plan_proyectos.icono       is 'El ícono del proyecto (mig 0174): `icon:<set>:<nombre>` de Iconify, o una URL https del bucket. NULL = usar `emoji`. `emoji` NUNCA guarda una URL: lo leen el prompt de reuniones, el export y la API de MaKo.';
comment on column tarea_categorias.icono     is 'Ídem plan_proyectos.icono (mig 0174). ⚠️ `emoji` acá se trunca a 4 caracteres en lib/todo.ts: una URL ahí queda en «http».';
