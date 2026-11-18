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
- ~~**El botón «Publicar» en el Dashboard**~~ — hecho el 18/11/2026, ver «El Dashboard enchufado» abajo. El de
  Automations ya estaba.

## El Dashboard enchufado, y por qué su pantalla NO usa `usar` (18/11/2026)

**Vive en:** `lib/creaciones-dashboard.ts` (lo puro), el enchufe `dashboard` de `lib/creaciones-enchufes.ts`,
`tomarCreacion` en `lib/creaciones.ts`, `app/dashboard/PlantillasPropiasHoja.tsx` y el «Guardar como plantilla» del ⋮ de
una hoja (`app/dashboard/Cabecera.tsx` → `EditorInforme.tsx`). Lo prueba `tests/creaciones-dashboard.test.ts`.

- **La definición es UNA hoja del informe de quien mira** (el informe es por persona y por negocio,
  `lib/graficos-tablero.ts`). Compartida, sale con lo mismo que ya hacía pegar un dashboard en otro negocio
  (`hojaParaCopiar` + `hojaParaOtroNegocio`, reusados tal cual) más lo que la limpieza de textos NO ve porque no es un
  texto del negocio sino un link o un id: la dirección de una imagen, un video, un «Insertar» o un enlace de afuera, un
  experimento ya arrancado (`experimento.id` es una fila del negocio) y los funnels de un bloque de General.
- **La trampa: el `usar` del contrato ESCRIBE por detrás, y el Dashboard tiene el informe ABIERTO.** El editor autoguarda
  el informe entero con compare-and-set (`guardarTableroSi`): una hoja que el server sumara mientras la pestaña está
  abierta haría que el próximo autoguardado choque («Cambió en otra pestaña»), y además el editor no la vería (se monta
  con `key="dashboard"` y no se re-siembra al navegar). Por eso hay DOS puertas con UNA regla: la pantalla pide la
  definición (`tomarCreacion`: las mismas comprobaciones que `usarCreacion` y el uso contado) y la agrega ella con
  `hojaParaUsar` + `crearHoja`; la galería y la API usan el `usar` del enchufe, que lee con su versión, suma con
  `informeConHoja` (la misma regla de `crearHoja`: al final, o la única si estaba en blanco, y el tope de hojas) y
  reintenta una vez si alguien guardó en el medio. **Una tab nueva cuyo editor guarde un documento abierto con versión
  va por `tomar`, no por `usar`.**
- **«Guardar como plantilla» espera el autoguardado.** El enchufe exporta lo GUARDADO, no la pantalla: con el respiro del
  autoguardado, una hoja recién creada daba «No existe esa hoja en tu Dashboard». El ⋮ manda lo pendiente y espera lo que
  viaja (`colaRef.current.pedir(ultimoGuardado)` devuelve la promesa en vuelo) antes de abrir el modal.
- **Sin sesión no hay de quién**: un turno de WhatsApp que pide publicar o usar una hoja recibe «Esto se hace desde el
  Dashboard». El id de una hoja (`g…`) pasa `sanearOrigenId`.
- **La galería de «Nueva hoja» necesita la definición** para dibujar la miniatura (`MiniaturaHoja` es la hoja de verdad
  con datos de ejemplo): `plantillasDelTipo(…, { conDefinicion: true })` trae hasta 24 propias con su definición (una hoja
  pesa decenas de KB; con 40, la galería pedía un par de MB al abrir).

## La moderación de lo publicado: Admin › Products › Templates (18/11/2026)

**Vive en:** `app/admin/(polar)/products/templates/`, `app/admin/_polar/datos/plantillas.ts` (con su test,
`tests/admin-plantillas-moderar.test.ts`), `app/admin/plantillas/actions.ts` y `creacionesParaModerar` en
`lib/creaciones.ts`.

- `retirarCreacion` ya dejaba retirar a la plataforma desde el 13/10 (`puedeRetirar`); faltaba la PUERTA. Es la lista y los
  filtros del Catalogue de Polar con el «Cortar la suscripción» de SubscriptionActionsMenu como molde del retiro.
- **La acción retira con `wsSuperAdmin()`, nunca con el workspace de la cookie**: el super admin puede estar mirando a un
  cliente con `?ws=`, y con ese ws `puedeRetirar` diría que no es suya.
- **La lectura trae `workspace_origen` y el nombre del negocio**: por eso es otra función (`creacionesParaModerar`) con su
  propio tipo (`CreacionModerada`), y no se suma al tipo `Creacion` que sale a los negocios (lo fija
  `tests/creaciones.test.ts`). Las privadas no salen ni ahí.
- **Sembrar las «de MaKo»** no necesita pantalla: es «Guardar como plantilla» → «Toda la comunidad» desde el workspace de la
  plataforma (`de_mako` lo pone el server). La lista de Templates las marca «De MaKo». Qué sembrar lo decide Martín.

## Lo que quedó sin hacer (18/11/2026)

- **Web Generator sin enchufe:** una landing lleva imágenes del storage, formularios, embeds, el píxel, el dominio, bloques
  de pago y HTML libre, y puede ser la RÉPLICA de la página de un tercero. Su `paraPublico` tiene que recorrer el esquema
  entero del editor (`lib/editor-landing/doc.ts`), y compartir con la comunidad una réplica de otro sitio lo decide Martín.
- **AI Avatar:** ¿se publica el look (`lib/ai-avatar/proyectos.ts`) o la escena? Lo decide Martín.
- **Video Editor:** el proyecto vive en IndexedDB del navegador; el enchufe necesita que el editor arme la plantilla en el
  cliente y suba la definición (sin los archivos). Sigue en `POR_ENCHUFAR`.
- **Offer:** el enchufe, «Ver ejemplo» en la conversación y `OFFER_EXPERTO` tocan el turno y la propuesta de Offer, que
  hoy usa también el chat del reto de 7 días: quedan para cuando ese chat termine. El precio «USD 1,200 al mes» se
  arregló aparte (`montosDe`, `tests/offer-nivel-y-voz.test.ts`).
- **El ítem /creaciones en la barra** lo pone el jefe «Sidebar» (`app/_components/nav.ts`).
- **«Tus plantillas» en el teléfono** (Image: F17, otro chat; las demás de `app/m`, sin hacer).
- **No se verificó en el navegador** el 18/11: la nube no tiene la base. Se verificó con tests que ejecutan el código
  (rotos a propósito) y con el `tsc` acotado.
