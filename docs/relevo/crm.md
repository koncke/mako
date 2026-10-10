# Relevo — CRM, leads y embudos

**Ventana:** del 05/10/2026 12:33 (commit `6785dc16`) al 10/10/2026 18:59 (`9862c146`).
**Escrito el 10/10/2026 a las 19:10** por la sesión de CRM (cuenta `claude2`), reescribiendo
el briefing anterior (`b5f7fb55`, 10/10 17:10) con todo verificado contra el árbol.
**Rutas de esta área:** `app/crm/**`, `lib/leads.ts`, `lib/funnel*.ts`, `lib/crm*.ts`,
`lib/lead-*.ts`, `lib/campana-*.ts`, `lib/etiquetas*.ts`, `lib/pipeline.ts`.

**Qué es esta parte del producto, para quien nunca la vio.** MaKo es una plataforma de
marketing y ventas que Martín Koncke (el dueño) le vende a negocios. El CRM es la tab
`/crm`: un tablero kanban donde cada tarjeta es un **lead** (un contacto interesado) y cada
columna una **etapa** del recorrido de venta (llegó → agendó una reunión → asistió → pagó →
Ganado). El conjunto de etapas se llama **embudo** o **funnel**, y un negocio puede tener
varios: uno por producto que vende. Los leads entran solos (un formulario de Meta, la
landing del cliente, Calendly/Cal.com, WhatsApp) o importados de una planilla.

Vocabulario que se usa acá y no se explica dos veces:

- **ws1, ws11, ws13**: los negocios (workspaces) por número. **ws1 es Mauricio Bustos, un
  CLIENTE** (el primer cliente, por eso la constante se llama `OWNER_WS` — no es el dueño).
  ws11 es Leila, ws13 es Código Inmobiliario, ws3 es el Cliente de Prueba.
- **La casa de un lead**: el producto donde «vive» (`leads.funnel_id` + `leads.pipeline_stage`).
- **`funnel_id = NULL` NO es «sin producto»**: es el embudo del NEGOCIO, el que viene por
  defecto. Es la trampa número uno del área (abajo).

---

## 1. En qué quedó: lo hecho y DESPLEGADO

Todo lo de esta lista está en `main` y desplegado. Un commit por renglón, salvo donde se dice.

**El cambio de modelo de la ventana: un lead está en VARIOS productos** (`f26c0a94`, 06/10,
mig `0207_lead_funnel`). Antes un lead tenía UN solo `funnel_id`, así que ponerlo en un
segundo producto obligaba a MOVERLO —y moverlo le reseteaba la etapa y, si estaba en Ganado,
le limpiaba la venta—. Martín lo reportó textual: *«Le acabo de dar a un lead a "Mover a
prueba" y se desapareció del producto principal de Mauricio. Eso JAMÁS debe pasar… No se debe
"Mover" se debe agregar al otro producto»*. Ahora: la **casa** sigue en `leads.funnel_id`, y
cada otro producto es una fila de la tabla nueva `lead_funnel` con su etapa propia. «Agregar»,
nunca «mover». Entra por la ficha, el tablero, el lote, «Traer de otro producto», el alta, las
campañas y el opt-in de la landing. El detalle y sus trampas:
`docs/hallazgos-crm.md` → «Un lead en VARIOS productos».

**El tablero y la tabla.** Marca de dónde vas a soltar la tarjeta (`3faab70d`); el tablero
sigue desplazándose con el cursor fuera del kanban (`abbb7a12`); acciones en lote
(`403e9f40`); la tabla deja de ser una lista y se le arrastran las filas (`cceda0d3`,
`ef4dcab5`); la casilla de selección sale al pasar el cursor (`9dc1cf2e`); arrastrar dentro
de la misma columna la deja ahí, con «Ordenar → Manual» (`1703c786`, mig
`0200_lead_orden`).

**Campañas de Meta → producto.** Asignar campañas y conjuntos de Meta a un producto desde
«Lead entrante», para que sus leads caigan en ese tablero (`c2a02c1a`, `ebcfbad8`,
`dc8a8ae6`, `721ad387`, mig `0193_lead_campana_meta`). Y filtrar el tablero por campaña y por
creativo (`117ea2bd`).

**El filtro «Anuncio» (10/10, `686c51be`).** Martín: *«Acá al filtrar, en campaña, y en
Origen, aparece lo mismo. Y falta el filtro de ANUNCIO, para filtrar por un ad específico»*.
Eran dos causas y ninguna estaba en la atribución: (a) el `select` del tablero (`LISTA_COLS`
en `lib/leads.ts`) no pedía `utm_content`, que es donde la landing guarda el id del anuncio
—44 de los 52 leads de ws13 lo tienen, con 13 anuncios distintos—, así que la categoría
existía desde el 06/10 y se escondía sola por no tener opciones; (b) el filtro «Origen»
listaba `origenLegible`, que dice lo más específico que se sepa (anuncio → campaña → canal),
o sea las campañas otra vez. Ahora el filtro usa `canalDeLead` (`app/crm/origen-lead.ts`,
nueva) y el rótulo pasa de «Creativo» a «Anuncio». Lo hizo el chat de **Ads Manager**, no
este, porque no había un chat de CRM abierto.

**La ficha del lead.** Producto en el pop-up, campo Web, un solo WhatsApp, la cara del
contacto, sin «Reactivar» (`ee98547d`, `7f5377dc`, migs `0194_lead_web` y
`0195_lead_foto_guardada`); las fotos de WhatsApp se copian a nuestro bucket porque la URL de
WhatsApp vence a los 10 días (`0418a6ab`); la ficha dice por qué un lead no tiene grabación en
vez de inventar duraciones (`6106544d`); cada campo se edita en el lugar.

**Ganado y plata.** El paso a Ganado pregunta el monto del contrato, la tarjeta muestra la
suscripción («$X/mes») y se corrige en Deal Details (`9f9bfc57`); «Completar datos» ya no
devuelve al lead a la etapa de antes y la ficha se relee al guardar (`65ec2298`); al ganar se
puede invitar al curso, por embudo y **apagado por default** (`77279ea4`).

**Reuniones.** En el editor de etapas se marca qué etapa es una reunión (`adf1ca3d`); el
resumen muestra lo que el lead contestó en Cal.com (`0218e6ed`, `6cd9d5dd`); una reunión nueva
limpia la marca de «no asistió» (`6e75cc0c`); lo que contestó en el formulario de Meta se ve
legible en el pop-up, y su WhatsApp nace apagado (`e21003d6`).

**Etiquetas del CRM** (`f92559e0`, `3f3aadd8`, mig `0224_crm_etiquetas`). Pedido de Martín del
08/10: un CRUD de etiquetas por negocio, vinculables a etapas del CRM, que sirvan en las
condiciones de las automatizaciones, disparen CRON y se espejen en WhatsApp. El espejo
etapa↔etiqueta mira **transiciones** con una foto por workspace, no impone por barrido.

**El plazo de cada etapa y el lead quieto** (`5a4e3f04`, 09/10, tarea #800). Pastilla «Plazo»
en el editor de etapas y aviso diario `crm-lead-quieto` para los que pasaron el plazo, sin
moverlos y sin depender del CRM automático. **Nace sin efecto: nadie tiene plazos cargados
todavía.** En el mismo commit, `/crm/revisar` dejó de perder al contacto repetido de la
landing, sus productos y su campaña.

**Dos cosas de navegación.** El CRM entra directo al tablero, sin el panel de activación
delante (`713661d7`, 08/10: es una decisión más nueva de Martín que le gana a la regla
«onboarding en toda tab»). Y «¿Qué hacer ahora?» volvía a no abrir nada por dos capas en la
pila de modales para una sola pantalla (`b57a53ba`).

**Verificado ahora (10/10 19:04):** `tests/crm-orden-manual`, `crm-revisar-propuesta`,
`lead-quieto`, `crm-origen-lead` y `etiquetas-contrato` → **65 pass / 0 fail**.

---

## 2. Lo que NACIÓ en la ventana (el 05/10 no existía)

- **`lead_funnel`** (mig 0207): la tabla que permite un lead en varios productos, con
  `lib/lead-funnel.ts` (agregar, quitar —que promueve la casa—, mover, lote) y
  `lib/lead-funnel-reglas.ts` (puro, con test).
- **`lead_orden`** (mig 0200): el orden manual de cada columna del kanban. UNA fila por
  (embudo, etapa) con la lista de leads, no una posición por lead.
- **`crm_etiquetas`** (mig 0224): el catálogo de etiquetas de cada negocio y qué lead tiene
  cuál, con el espejo a las etapas y a WhatsApp.
- **`leads.meta_campaign_id`** (0193), **`leads.web`** (0194), **`leads.foto_auto_url` +
  `foto_auto_at`** (0195).
- **El plazo por etapa** y el aviso `crm-lead-quieto` (`lib/lead-quieto.ts`,
  `lib/lead-quieto-aviso.ts`).
- **Las acciones en lote del CRM** (`app/crm/AccionesLoteLeads.tsx`) y el arrastre de filas en
  la vista de tabla.
- **El filtro por campaña, creativo/anuncio** (`lib/campana-atribucion.ts`,
  `app/crm/origen-lead.ts`).
- **La asignación de campañas y conjuntos de Meta a un producto**
  (`lib/campana-asignar.ts`, `lib/campana-funnel.ts`, `lib/campana-traer.ts`,
  `app/crm/campanas-actions.ts`, `app/crm/CampanasModal.tsx`).

---

## 3. Lo que quedó a medio hacer o sin verificar, con el archivo donde vive

### ✅ El filtro «Anuncio» como ÁRBOL — TERMINADO y desplegado (lo escribe el chat de Ads Manager, que lo hizo)

A las 19:04 y 19:11 esta sección lo describía como trabajo sin commitear de otra sesión: era
el chat de **Ads Manager** (cuenta `claude2`) y ya está todo en `main`, desplegado y probado en
el navegador sobre Código Inmobiliario (ws13):

- **`bdbf3707`** — el árbol. Martín: *«No separes el filtro de Campaña y Anuncio... Que dentro
  del filtro de "Anuncio" estén las campañas primero como arbol y dentro se pueda seleccionar
  anuncios de esas camapañas»*. Una sola lista «Anuncio»: cada campaña con sus anuncios
  colgados (`arbolDeAnuncios`), cruce «O» entre los dos niveles (`pasaFiltroAnuncio`), y
  tildar/destildar en `app/crm/arbol-seleccion.ts` (puro, con test).
- **`8a39bb02`** — tres ajustes que pidió al verlo: *«El botón de desplegar debe estar a la
  derecha, no a la izquierda, siempre»*, *«quiero que se abra el desplegable cuando clickeo»*
  la campaña, y *«El ancho del desplegable debe ser más grande. Bajo ningún motivo debe tener
  scroll hacia la derecha»*. El panel pasa a 360 px y su lugar sale de `lugarDelPanel`
  (`app/crm/filtro-panel.ts`): nunca pasa el borde derecho de la ventana y nunca se mete
  debajo de la barra lateral.
- **`f531a170`** — destildar la campaña la vuelve a plegar (tildarla la despliega).
- **`0a55645e`** — se fue la fila de chips debajo de «Filtrar» y su «Limpiar»: *«No debe salir
  los chips de abajo del filtro y el botón de "limpiar" si para eso ya está la notificacion en
  filtros»*. Limpiar es «Limpiar filtros (N)» abajo del menú, igual que en el Plan.
- **`0deedbe5`** — los filtros (etapa, origen, campaña, anuncio y «Ordenar») sobreviven a un F5
  y a irse de la tab: se guardan en el navegador por cliente y por embudo.
- **`bd4251c9`** — la cosecha, en `docs/hallazgos-crm.md` («Campaña y Anuncio pasan a ser UN
  árbol…») y en la bitácora del CRM.

`tests/crm-filtro-ads.test.ts`: 17/17, cada guard probado rompiéndolo. Lo que NO se tocó: a
390 px de ancho la página del CRM ya tiene 55 px de scroll lateral ANTES de abrir el filtro
(medido el 10/10 con el panel cerrado); no es del filtro, y nadie lo pidió todavía.

### Lo demás, con su archivo

- **La COHORTE del panel lateral del lead.** El panel (`app/crm/LeadSheet.tsx:225`) no dibuja
  la cohorte que la ruta sí dibuja (`app/crm/[id]/page.tsx:207`), y hay un ⚠️ escrito en el
  archivo explicándolo: no se arregla pasando la prop, porque sale de `labelMadurez` /
  `estadoMadurezLead` en `lib/leads.ts:1980` (2.600 líneas, con dependencias de servidor) y
  `LeadSheet` es `use client`. Se calcula en el server y baja por props, como hace la ruta.
  Abierto desde el 05/10.
- **El duplicado del opt-in de la landing no lleva los productos.** Falta `funnelIds` en
  `FilaImport` (`app/crm/leads-importar.ts:211`, verificado: no está) y en el importador
  (`app/crm/actions.ts`). Hoy ese lead entra al producto del negocio y una persona lo tiene
  que agregar a mano desde la ficha.
- **Confirmar una propuesta MARCA DESPUÉS de crear**
  (`app/crm/revisar/[id]/acciones.ts:83`). El comentario de arriba lo declara a propósito
  desde el 11/08/2026 (`2d4201b2`) y afirma que «dos pestañas o un doble click crean UN solo
  lote». **Eso no lo pude verificar y la lectura del código dice que no se sostiene para dos
  pestañas simultáneas**: las dos crean y recién después una de las dos `marcarAplicada`
  devuelve false; lo que las salva es el dedup del importador, no la guarda. El molde de
  reclamar-antes-de-ejecutar ya existe en el repo: `lib/api-mako/acciones.ts:137` y
  `lib/api-mako/flujo.ts:172` (`marcarAplicada(id, { en_curso: true })` ANTES).
- **El barrido del espejo etapa↔etiqueta no lo ejecuta ningún test** (lo cubren `planEspejo`,
  que es puro, y guardas de fuente), y reconoce lo que tocó una persona por el **NOMBRE** en
  `lead_audit`: una etiqueta renombrada entre dos corridas se espeja igual. Sin medir contra
  datos reales. Vive en `lib/etiquetas-motor.ts` y en el cron
  `app/api/cron/crm-automatico/route.ts` (`conciliarEspejoEtapas`).
- **Dos leads en Ganado sin `fecha_cierre`** (uno en ws1, uno en ws13). Antes cualquier
  corrección les ponía la de hoy; ahora no se les inventa nada. Se completan a mano.
- **Ninguna de las pantallas de la ventana se miró en un navegador**, salvo el modelo de
  `lead_funnel` (verificado el 06/10 en ws4 con un producto de prueba que después se borró) y
  el grabador de sesiones. El resto —Ganado con monto, etiquetas, plazo por etapa, filtros—
  está verificado por tests y por lectura, no por ojo.
- **Las propuestas pendientes de ws11 (Leila): SIN VERIFICAR hoy.** El briefing del 09/10
  decía «5 contactos de su landing esperando en `/crm/revisar`, uno de hoy». No lo pude
  medir: requiere consultar la base. Lo que SÍ está medido y escrito en el repo es más
  viejo: `app/crm/revisar/page.tsx:15` registra **4 leads reales en `pendiente` en ws11 el
  14/08/2026** (Diana Vallin, Ibrahim Dosal, Marina Olvera, Magdiel Cortes). Si entrás,
  mirá la bandeja antes de prometerle nada a nadie.
- **Las tareas del tablero `Feature: CRM`: SIN VERIFICAR.** Vienen del briefing del 09/10 y
  viven en la base, no en el repo: **#671** («Agendar R2» necesita un Calendly conectado para
  probarlo, y sólo lo tiene el ws1), **#18** (el texto de los follow-ups), **#15** (en qué
  cliente se prende el piloto del CRM automático), **#40** (el planificador del CRM automático
  sigue en R1/R2 y necesita una migración para la reunión N) y **#20** (n8n: se apaga o se
  pasa el acceso).

---

## 4. Las trampas de esta área (esto es lo que ahorra tiempo)

**1. `funnel_id = NULL` ES el embudo del negocio, y el producto del negocio se escribe de DOS
formas.** El tablero del negocio pide sus leads con `.is('funnel_id', null)`; un `.eq()` con
null no matchea nada en Postgres (`= NULL` es NULL, no true) y pierde los leads en silencio
—1.530 al 05/10—. Y como **fila** de `lead_funnel` el producto del negocio va con su id REAL
(la FK no admite NULL). Escribir el id del default en `leads.funnel_id` deja al lead **fuera
de TODOS los tableros**, con el producto correcto escrito y sin un error. Toda escritura de la
casa pasa por `casaParaEscribir` (`lib/lead-funnel-reglas.ts`).

**2. «¿Está en este producto?» se contesta por CASA o por FILA, y hay que mirar las dos.** Los
lectores que lo preguntaban se fueron encontrando de a uno: el dedup del alta, «Traer de otro
producto», el lote, la traída de campañas, la validación del orden manual
(`app/crm/orden-actions.ts:71-77`) y el conteo por etapa — en ése, sin sumar las filas, una
etapa con gente agregada decía 0 y se borraba **sin preguntar**. El próximo lector que
pregunte por `leads.funnel_id` solo, mide la mitad.

**3. Lo que lee SÓLO la casa, a propósito (decisión v1 de Martín):** métricas, el CAPI de
Meta, el CRM automático, MaKo, la nutrición, la etiqueta de WhatsApp y Customer Success. Es lo
que hizo posible cambiar el modelo sin tocarlos. No es un olvido; está escrito en la cabecera
de `supabase/migrations/0207_lead_funnel.sql`. La consecuencia de producto está abierta y la
decide Martín (sección 5).

**4. El tablero no ve una columna que su `select` no pide.** Los mappers de `app/crm/crm-map.ts`
leen campos que `LISTA_COLS` (`lib/leads.ts`) tiene que traer. Una categoría de filtro sin
opciones **no se ofrece** (`app/crm/CrmToolbar.tsx:449`), así que una columna que falta no se
ve como un error: se ve como un filtro que no existe. Eso fue exactamente el bug del 10/10, y
el diagnóstico obvio (la atribución) era el equivocado: su test pasaba. Desde `686c51be` hay
un guard del CABLEADO, derivado del tipo `LeadAtribuible` y del cuerpo real de las funciones,
no de una lista copiada.

**5. Mover un Ganado a una etapa ABIERTA le limpia la venta.** No es un bug suelto: está
escrito y es consciente en `lib/lead-desenlace.ts:38` y `lib/leads.ts:918`. La causa es que
`setPipelineStage` manda SIEMPRE `estado_lead`, y la coerción del desenlace corre cuando el
caller tocó un campo que decide la venta. Pasar de «Facturando» a «Falta pago» entra ahí.
Es una línea para cambiarlo y la decide Martín (sección 5).

**6. La etapa que se VE no es `pipeline_stage`.** Es `pipelineStageOf`: el override o la
derivada de las fechas, y en la mayoría de los leads la columna es NULL. Agendar por Calendly,
marcar asistencia o ganar desde la ficha mueven la etapa **derivada** sin escribirla. Por eso
el espejo de etiquetas mira transiciones comparando `pipelineStageOf(antes)` contra después, y
no la columna. (El hallazgo viejo «stageMeta miente» es de esta misma familia.)

**7. El techo de 1000 filas de PostgREST.** Un `.select()` suelto anda perfecto hasta que la
tabla pasa las 1000 y desde ahí pierde datos sin un log. Ya se pagó en este área: el CRM
mostró 4 ganados de 13 (US$52.700) porque `_listLeads` no paginaba. Se lee con `leerTodo` /
`leerPorPaginas` (`lib/supabase-paginado.ts`) y con un orden que termine en una columna
ÚNICA. `.limit(2000)` no sube el techo.

**8. `docs/hallazgos-crm.md` tiene 7.771 líneas: NO se abre entero.** Se busca con `Grep` de
la ruta del archivo que vas a tocar — cada entrada trae adentro su línea `**Vive en:**`. Abrirlo
completo son decenas de miles de tokens para encontrar una cosa.

**9. El fin de línea es POR ARCHIVO en este clon.** `app/crm/[id]/page.tsx` es LF y otros del
mismo directorio son CRLF. Un script de parcheo contesta «0 coincidencias» sobre un ancla
copiada carácter por carácter del propio archivo. Y un guard con regex sobre fuente va con
`\r?\n`, nunca `\n` solo.

**10. La herramienta de búsqueda reescribe `/` como `\` en el CONTENIDO que devuelve.** Un
`//` que vuelve como `\` es la firma. `Grep` sirve para ENCONTRAR, no para CITAR: antes de
reportar un bug que depende de un carácter, releé la línea con `Read`.

**11. Hay varias sesiones sobre este MISMO clon y el árbol no tiene un estado, tiene una
hora.** Un rojo de un test puede no ser tuyo (hoy pasa: ver sección 3). Antes de acusar a
nadie: `git status --short` de los archivos que el error nombra, y `git show HEAD:<archivo>`
para saber si el bug existe en HEAD o sólo en el disco de alguien que está tipeando. Y
**nunca** `git add -A` ni `git commit` pelado: va `git commit <ruta> -F <msg>`.

**12. El próximo número de migración NO es 0225.** En disco hay hasta `0242_canales_zernio`,
y además existen **DOS archivos con el número 0223** (`0223_curso_papelera` y
`0223_flujo_grafo`), que es la colisión clásica de dos sesiones eligiendo el mismo número.
Antes de nombrar una migración nueva: `git pull` y `ls supabase/migrations/ | tail -5`.

---

## 5. Qué espera una decisión de Martín

Ninguna de estas se decide sola y ninguna se re-pregunta si ya está contestada en el chat.

1. **Ganar en un producto AGREGADO no marca al lead como ganado.** Es la v1 a propósito (manda
   la casa), y la consecuencia es que si alguien compra el segundo producto, esa venta no
   existe para Revenue, el CAPI de Meta ni Customer Success hasta que ese producto sea la casa.
   **Opciones:** (a) dejarlo así y que el equipo cambie la casa al ganar; (b) que ganar en
   cualquier producto marque al lead como ganado y la plata se sume por producto; (c) que el
   monto viva en la fila de `lead_funnel` y Revenue sume casa + filas.
2. **La casa de un opt-in de la landing con varios productos es el PRIMERO tildado** en la
   configuración. **Opciones:** (a) alcanza el orden de los tildes; (b) hace falta marcar
   explícitamente cuál es el principal.
3. **Mover entre dos etapas abiertas limpia la venta** (Facturando → Falta pago).
   **Opciones:** (a) dejarlo; (b) limpiar sólo cuando el estado CAMBIA de verdad (Ganado →
   abierta). Es una línea en `setPipelineStage`.
4. **El «Deshacer» de «Monto de cierre» sobre un lead abierto no hace nada**, porque el monto
   decide la venta y el lead no tiene `cerro`. **La pregunta:** ¿el monto puede vivir en un
   lead abierto? Hoy ya lo escriben por otro camino `lib/pagos.ts` y el editor del deal.
5. **La etiqueta que pone una ETAPA no dispara automatizaciones** (sólo dispara ponerla
   directo: la ficha, la API, un paso «⚡ Acción»). Es una decisión del constructor, tomada
   para que mover 200 leads en lote no disparara 200 WhatsApps. **Se la puede dar vuelta.**
6. **Prender en cada cliente lo que nació apagado:** la página de gracias → Ganado, invitar al
   curso al ganar, el WhatsApp de las respuestas del formulario de Meta. Nada nace prendido, a
   propósito.
7. **Los plazos por etapa están vacíos para todos.** El aviso del lead quieto existe y no
   avisa de nada hasta que alguien cargue plazos. ¿En qué cliente se arranca?
8. **Los datos mal cargados de ws11 (Leila), que son suyos y no del código:** Nadia #2605
   tiene como mensualidad 4.235,29, que es el TOTAL del contrato (con 12 cuotas de 4.235,29
   pendientes, eso infla el MRR un 85%); de Fabi #2606, ¿los 444 son USD o pesos?; y Fabi
   sigue en dos productos (Nora #2610 ya no). **Sin verificar hoy**: viene del briefing del
   08-09/10.
9. **Las tareas #671, #18, #15, #40 y #20** del tablero `Feature: CRM` (ver sección 3).

---

## 6. Correcciones al briefing anterior

Lo que el briefing previo daba por abierto y **ya no es cierto**:

- **«`AGENTS.md` sigue citando el opt-in viejo como ejemplo de "un alta que crea N filas"»** —
  **FALSO desde el 09/10.** El commit `5a4e3f04` le agregó el párrafo que lo corrige: *«⚠️ Y
  ANTES DE ESCRIBIR EL BUCLE, PREGUNTÁ SI SON N COSAS O UNA COSA EN N LUGARES. El opt-in de
  arriba ya no crea N fichas: desde el 06/10/2026 (`f26c0a94`) crea UNA y le AGREGA los otros
  productos»*. Verificado en `AGENTS.md`, sección «Un alta que pasa a crear N filas…».
  ⚠️ **`docs/hallazgos-crm.md:7086` todavía lo lista como pendiente** — ese archivo no es
  mío en esta corrida y lo dejé como está; el que lo toque, que lo saque.
- **«Hay que arreglar el filtro de anuncios» / «es una hipótesis sin medir»** — **HECHO el
  10/10 a las 17:08** (`686c51be`), con los datos medidos en ws13 (52 leads, 44 con
  `utm_content`, 13 anuncios). Y ya quedó viejo otra vez: hay un pedido posterior del mismo
  día, en curso y sin commitear (sección 3).
- **«Confirmar una propuesta no marca antes de crear» como simple pendiente** — es más matizado:
  está **decidido a propósito** desde el 11/08 con su comentario, y lo que no se sostiene es la
  afirmación de ese comentario sobre dos pestañas simultáneas (sección 3).
- **Los dos rojos de la suite que el briefing del 09/10 reportaba como ajenos**
  (`tests/curso-tareas-secciones` y `tests/inbox-agregar-al-crm`) ya no son el problema del
  momento. El único rojo que vi hoy en esta área fue `tests/crm-filtro-ads.test.ts` a las
  19:04, ajeno y transitorio: a las 19:11 ya estaba verde (sección 3). **Si lo reportás,
  fechá la lectura y volvé a medir antes de mandar el mensaje** — re-correrlo cuesta
  segundos y acusar a la sesión de al lado de romper el repo cuesta un turno de ella.
