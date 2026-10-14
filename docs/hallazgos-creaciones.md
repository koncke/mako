# Hallazgos — Creaciones y estrellas (como GitHub)

**Vive en:** `lib/creaciones.ts`, `lib/creaciones-reglas.ts`, `lib/creaciones-enchufes.ts`,
`lib/creaciones-automatizacion.ts`, `app/creaciones/`, `lib/api-mako/areas/creaciones.{def,run}.ts`,
`supabase/migrations/0273_creaciones.sql`.

El pedido de Martín (13/10/2026, punto 10 del feedback), textual: *«Quiero implementar el sistema de "estrellas" de
github en todo MaKo... Yo como creador de MaKo, jamás voy a poder idear todos los escenarios, todas las
automatizaciones, los dashboards, los formatos de generación de vídeo o imagen, etc etc... Por eso quiero crear un
sistema parecido al de github de estrellas, para que los usuarios hagan sus creaciones y otros usuarios puedan
puntuarles. Yo claro que puedo hacer ciertos templates en un inicio, pero luego la comunidad se va a encargar.»*

## Un mecanismo y un enchufe por tipo

La tabla, las estrellas, la galería (`/creaciones`), los botones y el área de la API son UNO para todo MaKo. Lo
que cambia por tipo —qué es la definición, cómo se exporta de una cosa del negocio y cómo se usa en otro— es su
**enchufe** (`lib/creaciones-enchufes.ts`: `opciones`, `exportar`, `resumir`, `usar`). Un tipo sin enchufe se
lista en `POR_ENCHUFAR` con el chat dueño de su feature, y `tests/creaciones.test.ts` exige que cada tipo esté en
UNA de las dos listas.

Al 14/10/2026: `automatizacion` enchufada; `dashboard` la enchufa Graphics (reusando `hojaParaOtroNegocio` de
`lib/graficos-copia.ts`); `formato_video` y `formato_imagen` esperan una decisión de Martín (ver abajo).

## Se publica la DEFINICIÓN, nunca los datos del negocio

Una copia con token (`flujo_copias`, mig 0265) la recibe el negocio a quien se le pasó el token; una creación la
ve CUALQUIER negocio. Por eso la definición publicada de una automatización pasa por `definicionPublicable`
(`lib/creaciones-automatizacion.ts`, puro): `limpiarReferencias` contra un negocio VACÍO (un audio con guion pasa a
texto, un archivo queda sin elegir), el CRON sin ids de embudo/producto/etiqueta, y sin remitente, plantilla de
Meta, voz clonada, ejemplos del ensayo ni ids/emails/teléfonos en los parámetros de «⚡ Acción». El test lo prueba
con centinelas (un email, un teléfono, una voz) que no pueden aparecer en el JSON publicado.

- **La definición la arma el código desde la base**, nunca un JSON que mande el pedido: `publicar_creacion` recibe
  el id de la cosa, no su contenido (lo fija el test).
- **Se publica lo PUBLICADO** (`pasos`), no el borrador de la automatización.
- **Los textos de las tarjetas viajan tal cual**: son la creación. El modal lo dice antes del botón.

## Una estrella y un uso cuentan por NEGOCIO

`creacion_estrellas` y `creacion_usos` tienen PK `(creacion, workspace)`: cinco personas del mismo equipo no
inflan una creación, y usar diez veces la misma cuenta uno. El autor no se da estrellas ni se cuenta un uso. Los
contadores los mantienen triggers en la misma transacción; nunca se escriben a mano.

## Las tablas son de todos: `workspace_origen`, no `workspace_id`

Una creación se lee desde cualquier negocio, así que no pasa por `getTenantDb` (que filtra por la columna
`workspace_id` de las tablas de `TENANT_TABLES`). Va con el cliente crudo, con el workspace EXPLÍCITO en cada
función, y lo que sale a otro negocio nunca trae el workspace de origen ni el email de quien publicó: trae el
nombre de autor que eligió quien publica (`mia` dice si es tuya). Mismo criterio que `flujo_copias`.

## El id de la cosa es TEXTO (lo marcó Content Machine)

La primera versión declaró `origen_id bigint` y `origenId: number` en el enchufe, pensando en automatizaciones. Un
anuncio del Video Generator (`PlanGuardado`) tiene un UUID. Se cambió el 14/10 con la tabla vacía (la 0273 ya
estaba aplicada en prod): `origen_id text`, un `alter … using origen_id::text` idempotente en la misma migración,
y `sanearOrigenId` (número o `[A-Za-z0-9_-]{1,80}`). **La lección: un contrato que otros van a enchufar se escribe
con el id más general que puedan necesitar, no con el del primer tipo.**

## La migración era 0266 y tuvo que pasar a 0273

`git pull` + `ls supabase/migrations/` (lo que AGENTS.md pedía) daba 0265 como la última. Los números 0266 a 0272
ya estaban tomados en OTROS worktrees, sin commitear (`0266_segundo_factor`, `0267_lead_nota_adjunto`,
`0268_dashboard_copias`, `0269_funnel_nombre_propio`, `0270_lead_datos_ignorados`, `0271_calendario_eventos`,
`0272_lead_oferta`). Lo encontró recorrer `git worktree list` y listar cada `supabase/migrations/`. La regla quedó
en AGENTS.md.

## Lo que quedó sin hacer

- **`formato_video` y `formato_imagen` sin enchufe** (14/10): según Content Machine, los «formatos» de video son
  las 8 puestas de `lib/puestas-data.ts` (un catálogo fijo, igual para todos) y `/image-generator` es un
  «Próximamente» sin backend. Lo más parecido a «un formato del negocio» es un anuncio del historial
  (`PlanGuardado`), y eso lo decide Martín. Quedan en `POR_ENCHUFAR`.
- **El botón «Publicar» en Automations y en el Dashboard** lo ponen sus chats cuando esto llegue a main.
- **Sin tab en la barra**: se entra por `/creaciones` y por los botones «Publicar». Se le preguntó a Martín.
- **No se verificó en el navegador** el 14/10: con ~19 chats en la máquina no había RAM para un `next dev`. Se
  verificó con tests (los dos archivos se rompieron a propósito) y aplicando la migración en prod.
