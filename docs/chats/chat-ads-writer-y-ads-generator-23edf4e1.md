# Ads Writer y Ads Generator

`2026-08-05 20:25` → `2026-08-07 07:04` · 9 mensajes de Martín · 106 respuestas de Claude · sesión `23edf4e1`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-08-05 20:25`

Revisa el plan... Mañana tengo reunión con Mauricio y quiero terminar completamente la funcionalidad de creación de guiones, para ello hay muchas tareas pendientes, revisalo.

### Claude

Voy a revisar el plan. Primero me pongo al día con el contexto de guiones.

### Claude

Ya tengo las tareas del board. Ahora verifico contra el código qué está realmente hecho, porque varias parecen viejas.

### Claude

Revisé el board (362 tareas abiertas, ws 9) y lo crucé contra el código. El problema principal: **el plan no refleja el estado real**. Hay tareas cerradas que siguen abiertas y, sobre todo, lo que realmente falta no está bien descrito.

## Ya está hecho (el board lo muestra pendiente)

- **#216 · Generación automática de guiones desde la matriz** (score 45, baja) — **hecho completo**. `generarGuion()` en [lib/razones.ts:404](dashboard-marketing/lib/razones.ts:404), acción `guion` en el route, se guarda en `mako.razones` y aparece en la tab. Toda su checklist está cubierta.
- **#288 · HOOK Generator** (score 42) — **~80% cubierto**. Los 14 ángulos de [lib/guion-angulos.ts](dashboard-marketing/lib/guion-angulos.ts) ya traen `ejemplosHook` con patrones y la regla "el ángulo manda" pisa la estructura. Falta solo la taxonomía como módulo aparte y probarlo en campaña real.
- Multi-guion por celda, copiar/descargar .md/borrar, edición por sección, "MaKo lo hace solo", "Elegir con MaKo" con preguntas cerradas, y los editores de ángulos y estructuras en `/admin/guiones`: todo funcionando.

## Lo que falta de verdad

**1. El guion no existe fuera de la celda.** `GuionItem = { id, anguloId, anguloNombre, texto }` ([lib/razones.ts:35](dashboard-marketing/lib/razones.ts:35)). Sin fecha, sin estado, sin vínculo al anuncio. Esto bloquea tres tareas del board a la vez:
- #330 (filtro por fecha) es **imposible hoy**: no hay campo fecha ni una vista de guiones creados. La única lista que existe, `/ads-analyst/guiones`, es de anuncios **ya publicados** que bajan de Meta — otro universo, no se tocan.
- #529 (unificar el detalle del guion con el lenguaje de Analyst: score, patrón, estado, rendimiento) no tiene dónde engancharse.
- No hay camino guion → Ads Manager ni vuelta de rendimiento real.

**2. No tiene tab propia.** La fábrica vive dentro de `/onboarding`; en el sidebar solo existe el ítem "Onboarding" ([nav.ts:126](dashboard-marketing/app/_components/nav.ts:126)). Para la demo es lo más visible: la herramienta principal está enterrada en el flujo de configuración inicial. **#305 y #292 son la misma tarea duplicada.**

**3. El wizard pierde el estado al cambiar de tab (#299).** Confirmado: [MatrizView.tsx:282](dashboard-marketing/app/onboarding/MatrizView.tsx:282) hace `setNuevo(null)` en cada cambio de tab y [:209](dashboard-marketing/app/onboarding/MatrizView.tsx:209) también al abrir la celda. Si estás a media pregunta cerrada y vas a "Contexto" a chequear el copy, perdiste las elecciones. Es de minutos y se nota mucho en vivo.

**4. Tres escritores son un cartel.** `vsl-writer`, `dm-writer` y `landing-writer` son `<ComingSoon/>` de 7 líneas. `ads-writer` sí funciona pero escribe **copy, no guion de video, y no persiste nada**. Si Mauricio entra a VSL Writer en la demo, ve el cartel (#51, #204).

## Ruido en el board

Además de #305/#292 duplicadas, hay **cuatro tareas distintas para lo mismo**: #298 (Nano Banana), #503, #417 y #197 son todas "generar imágenes/videos con IA". Esa es la capa siguiente, no creación de guiones — conviene sacarlas del alcance de mañana explícitamente.

## Lo que yo haría para "completa"

En orden de impacto sobre costo: (1) fix de #299, minutos. (2) Darle identidad al guion — `creadoEn`, `estado`, referencia a la celda —, que desbloquea #330 y #529, 1-2 h. (3) Tab propia con la Matriz, medio día si es solo ruta + nav. (4) Vista global de guiones con filtro. (5) Cerrar #216 en el board y bajarle el alcance a #288.

Quedan fuera: imagen/video, Vendedor IA (#505), POV (#498), editor de video (#357).

Dos cosas antes de seguir: ¿arranco por el 1-2-3 y lo dejo andando para mañana? Y por separado, puedo mandarte una propuesta a `/plan/revisar` para cerrar #216, fundir #305 con #292 y reescribir #330/#529 con lo que realmente hay que hacer — avisame porque ya tenés 6 propuestas pendientes sin aplicar y no quiero apilarte una séptima sin que la pidas.


---

## Martín

`2026-08-05 20:35`

Si, hazlo todo e implementalo en Ads Writer, reemplaza completamente lo que hoy vive en ads writer

### Claude

Voy a hacerlo. Primero leo lo que hay que tocar.

### Claude

Empiezo por el modelo: darle identidad al guion.

### Claude

Ahora que `generarGuion` estampe los campos nuevos, y la función para cambiar el estado.

### Claude

Ahora la API: que `guardar` preserve los campos nuevos y la acción `guion-estado`.

### Claude

Tengo un choque de nombres ahí (`estado` es también la función del route). Lo corrijo:

### Claude

Falta declarar los campos nuevos en el tipo del body y documentar la acción:

### Claude

Ahora el fix del wizard (#299) y el chip de estado/fecha en la tarjeta del guion.

### Claude

Ahora la tarjeta del guion muestra fecha y estado, y deja cambiarlo. Primero el tipo local y un helper compartido:

### Claude

Mejor una sola fuente de verdad en vez de duplicar constantes. Creo un módulo compartido cliente/servidor:

### Claude

Ahora `lib/razones.ts` toma de ahí en vez de declararlo:

### Claude

El re-export no trae los nombres al scope local; agrego el import:

### Claude

Ahora el módulo de UI compartido que usa MatrizView:

### Claude

Ahora la cabecera de cada guion en la matriz: fecha, estructura y el chip de estado clickeable.

### Claude

Ahora la cabecera de la tarjeta, que hoy solo muestra el ángulo:

### Claude

Ahora el componente `EstadoChip`, que reuso también en la vista global:

### Claude

Ahora la vista global de guiones con filtros.

### Claude

Ahora el shell de Ads Writer:

### Claude

Typecheck limpio. Ahora reviso lo que quedó huérfano y la descripción que MaKo usa de esta tab:

### Claude

`lib/ad-copy.ts` está enganchado al registro de prompts editables, así que borrarlo arrastraría `/configuraciones`. Lo dejo y lo reporto. Actualizo lo que MaKo le dice al usuario sobre esta tab:

### Claude

Ahora lo levanto y lo pruebo en vivo.

### Claude

El server se cayó. Lo levanto de nuevo:

### Claude

El dev server de otra sesión está peleando por `.next` en esta carpeta. Verifico contra el que ya está corriendo:

### Claude

El server ya está listo. Reintento:

### Claude

El dev server muere apenas arranca — la otra sesión tiene tomada esta carpeta. Corro el build, que es lo que sí valida los límites cliente/servidor (el typecheck no los ve):

### Claude

Está implementado. Ads Writer ya no es el generador de copy suelto: es la fábrica de guiones.

## Qué quedó

**Ads Writer, dos vistas del mismo material** ([AdsWriterApp.tsx](dashboard-marketing/app/ads-writer/AdsWriterApp.tsx))
- **Matriz** — la grilla avatar × motivación. Es el mismo `MatrizView` del hub de onboarding reusado, no una copia: una sola implementación, dos entradas.
- **Guiones** — todos los guiones escritos, aplanados de todas las celdas, con el avatar y la motivación de los que salieron.

Las dos quedan montadas y se ocultan con `display`, así que cambiar de vista no puede tirar un guion a medias. Al entrar a Guiones se refresca desde la API porque la matriz pudo escribir uno nuevo.

**El guion ahora es una pieza, no un texto suelto** ([lib/guion-estado.ts](dashboard-marketing/lib/guion-estado.ts))
`GuionItem` gana `creadoEn`, `estado`, `estructuraId` y `estructuraNombre`. Puse el contrato en un módulo aparte sin `server-only` porque los componentes de cliente lo necesitan y una copia del lado del cliente se desincroniza en silencio. Los guiones viejos entran con `creadoEn: 0` y se muestran **"sin fecha"** — no les invento una, que falsearía el filtro.

**Filtros** ([GuionesGlobal.tsx](dashboard-marketing/app/ads-writer/GuionesGlobal.tsx)): búsqueda en el texto, ángulo, avatar, rango desde/hasta, orden, y contadores por estado que además filtran al tocarlos. Pipeline borrador → aprobado → grabado → publicado con un chip de un clic. Cada guion tiene "↗ Anuncio" que salta a su celda en la matriz.

**Fix #299**: cambiar de tab dentro del modal ya no cancela el "Nuevo guion". Si hay un borrador vivo, la tab Guiones muestra un `•` y reabrir la celda cae ahí.

Dos detalles que resolví por el camino y vale que sepas: el día se calcula local, no con `toISOString()` (un guion de las 23:30 caía en el día siguiente y el filtro "hasta hoy" lo dejaba afuera), y el `guardar` de la API ahora pasa por `normalizarGuion` — armaba el objeto a mano, así que cualquier campo nuevo se perdía al guardar una edición.

## Lo que no verifiqué

**El typecheck pasa limpio** y probé la lógica de fechas y estados con casos reales (incluido el bug de UTC). Pero **no pude abrirlo en el navegador**: el dev server de otra sesión tiene tomada esta carpeta y mata al mío apenas arranca — lo intenté tres veces —, y `npm run build` responde "Another next build process is already running". Dejé el build reintentando en background y te aviso cuando entre.

Si querés verlo ya, cerrá el dev server de la otra sesión y:

```bash
npm run dev
```

## Una cosa para tu decisión

Borré `AdsWriterApp.tsx` (el generador de copy), pero **dejé vivos `/api/ads-writer` y `lib/ad-copy.ts`**: `lib/prompt-registry.ts` los importa, así que borrarlos arrastra los prompts editables de `/configuraciones` y deja huérfanos los overrides guardados en la base. Quedaron inalcanzables desde la UI. Decime si los saco con el registro y todo, o los dejamos ahí.

Y sigue pendiente lo que te dije que quedaba fuera de estas tres: la vista de guiones creados **todavía no habla con `/ads-analyst/guiones`** (los anuncios ya publicados que bajan de Meta) — ese es #529, y ahora sí es enganchable porque el guion tiene identidad. También quedó sin tocar el board: #216 sigue abierta estando hecha, y #305/#292 quedaron cubiertas por esto. Avisame si te mando la propuesta a `/plan/revisar` para cerrarlas.

### Claude

El build pasó (exit 0, cero errores). Confirmo que la ruta compiló y aprovecho que se liberó el lock para intentar el navegador:

### Claude

El build entró y pasó: **exit 0, cero errores, `/ads-writer` en el manifest de rutas**. Eso es lo que valida los límites cliente/servidor que el typecheck no ve, así que el módulo compartido `guion-estado` está bien del lado del cliente.

Lo que quedó verificado:

- `npm run typecheck` limpio
- `npm run build` exitoso, con `/ads-writer/page` compilado
- La lógica de fechas y estados probada con casos reales, incluido el bug de UTC que hubiera dejado los guiones de la noche fuera del filtro

Lo que no pude: **abrirlo en el navegador**. Lo intenté cuatro veces; el dev server de la otra sesión tiene tomada la carpeta y mata al mío entre el "Ready" y la primera request. No llegué a ver la matriz ni a crear un guion en vivo, así que el flujo end-to-end (crear guion → aparece en la lista con fecha y estado → filtrar → marcar grabado → saltar al anuncio) está sin probar contra la app corriendo.

Para destrabarlo, cerrá el dev server de la otra sesión y:

```bash
npm run dev
```

Con eso lo miro yo o lo mirás vos directo en `/ads-writer`. Es lo único que falta antes de mañana; el resto está implementado.

Sigue abierto lo que te planteé: si borro `/api/ads-writer` + `lib/ad-copy.ts` con su entrada en el registro de prompts, y si te mando la propuesta a `/plan/revisar` para cerrar #216 y fundir #305 con #292.

### Claude

El dev server de la otra sesión sí responde por HTTP (y sirve mi código, porque corre desde esta misma carpeta). Verifico contra él:

### Claude

Sesión abierta y la página responde 200. Veo qué renderizó:

### Claude

La matriz del dueño tiene 9 celdas pero 0 guiones. Busco dónde hay guiones reales para probar el backfill contra datos viejos de verdad:

### Claude

Esos 3 guiones reales son exactamente el caso legacy: sin `creadoEn`, sin `estado`, sin estructura. Verifico que la app los normalice bien:

### Claude

Ahí está: el backfill funciona sobre datos legacy reales — `creadoEn: 0` (mostrará "sin fecha", no una inventada), estado `borrador`, y el texto intacto. Pruebo que la acción nueva esté cableada, sin tocar datos:

### Claude

Esos otros `_tmp-*` son de la otra sesión, no los toco.

### Claude

Aproveché el dev server de la otra sesión (corre desde esta misma carpeta, así que sirve mi código) y quedó bastante más verificado de lo que te dije antes.

## Verificado contra la app corriendo

- **`/ads-writer` devuelve 200** con la UI nueva: "Tus guiones de anuncios", las tabs Matriz y Guiones, y el estado vacío correcto. **Cero rastros del generador de copy viejo** en el HTML.
- **La API responde bien**: 9 celdas y 3 avatares en el workspace del dueño.
- **El backfill funciona sobre datos legacy reales.** Encontré 3 guiones escritos antes de este cambio (ws 10 y ws 11), guardados sin `creadoEn`, sin `estado` y sin estructura. La app los devuelve con `creadoEn: 0` → se mostrarán como **"sin fecha"** en vez de una inventada, `estado: borrador`, y el texto entero intacto (968, 1024 y 1084 caracteres). Era el riesgo real del cambio de modelo y está cubierto.
- **La acción `guion-estado` está cableada y valida**: 400 con un estado inventado, 422 con una celda inexistente.
- Más el `npm run build` exitoso y el typecheck limpio de antes.

## Lo que sigue sin probar

El **flujo interactivo**: crear un guion nuevo de punta a punta, los filtros, el chip de estado moviendo un guion de verdad, y el salto "↗ Anuncio". Eso necesita navegador y el preview de esta sesión sigue muriendo por el conflicto con el otro dev server.

Dos aclaraciones sobre lo que hice y no hice ahí: probé la acción de estado solo por sus caminos de error, **no cambié el estado de ningún guion real** — los únicos que existen son de los workspaces 10 y 11, y no me pareció que corresponda escribirle datos a un cliente en producción para una prueba sin que me lo pidas. Y el workspace del dueño tiene la matriz armada pero **cero guiones**, así que si mañana vas a mostrarlo con tu propia cuenta, conviene generar uno antes para no demostrar sobre una pantalla vacía.

Sigue abierto lo mismo de antes, y ahora se suma una tercera: si borro `/api/ads-writer` + `lib/ad-copy.ts` con su entrada del registro de prompts; si te mando la propuesta a `/plan/revisar` para cerrar #216 y fundir #305 con #292; y si querés que haga el round-trip completo del cambio de estado sobre un guion de ws 11 dejándolo como estaba.


---

## Martín

`2026-08-06 16:30`

Revisa el plan, hay muchas tareas respecto a la generación de guiones...
Por otro lado:

1. Creo que sería bueno que aprovechemos la IA y no la limitemos en la generación. Me refiero a que en lugar de generar solo 3 avatares, solo 3 razones, solo 3 lead magnet... No se, pueda generar 100. Y que de eso eliga el mejor y que luego el usuario si no está conforme pueda cambiarlo por todas las otras disponibles.
2. Ya tenemos construida toda la funcionalidad de Ads Analyst, y no la estamos aprovechando para la generación de guiones... No estamos viendo cuales son los ganadores para basarnos más en eso o recomendarle al usuario que ese es un angulo ganador... No estamos etiquetando a los guiones que se crearon y publicaron en Meta por fuera de Ads Writes con las etiquedas de avatar, angulo, razon, etc... No estamos aprovechando los "Patrones" que ya hace ads analyst... Revisalo bien todo para poder aprovecharlo.
3. Revisa bien el diseño de la tab, tiene que ser mucho más simple de utilizar, de navegar... Tiene que ser minimalista, se tiene que ver "wow" no puro texto o botones amontonados... ¿Cómo harías que esta tab se vea "wow" que se vea intuitiva y linda de usar? Si son muchos guiones podemos hacer un formato galería, aprovechar el diseño que tenemos en otros lugares, etc...

### Claude

Es un pedido grande y con tres frentes. Hago un scout rápido y después lanzo la investigación en paralelo.

### Claude

Encontré algo importante de entrada: Ads Analyst tiene **su propia taxonomía** de ángulos y avatares (`lib/script-angles.ts`, `lib/script-avatares.ts`), separada de la de creación. Lanzo la investigación a fondo.

### Claude

Lancé la investigación (10 agentes en 3 fases: 6 investigando en paralelo, 3 diseñando una propuesta por frente, y un revisor adversarial que verifica los supuestos contra el código). Te aviso cuando termine.

Mientras tanto, el hallazgo estructural que ya tengo y que explica tu punto 2:

**Hay dos vocabularios paralelos que nunca se cruzaron.** El lado de análisis tiene sus propios ángulos y avatares — [lib/script-angles.ts](dashboard-marketing/lib/script-angles.ts) con 5 ángulos (`visionario`, `capataz`, `dolor`, `testimonio`, `oferta`) y [lib/script-avatares.ts](dashboard-marketing/lib/script-avatares.ts) —, más `HOOK_TYPES`, `BEAT_KINDS` y `TAG_VOCAB` en [lib/ads-analyst.ts:42-56](dashboard-marketing/lib/ads-analyst.ts:42). El lado de creación tiene otros: 14 ángulos ricos en `lib/guion-angulos.ts`, avatares firmográficos en `lib/avatares.ts`, y las razones de compra, que **del lado del análisis directamente no existen**.

O sea: no es que falte "conectar un cable". Es que los dos lados hablan idiomas distintos sobre la misma pieza, y el ángulo "Dolor" de un guion creado y el ángulo `dolor` de un anuncio analizado hoy no son el mismo objeto. Eso es lo primero que hay que resolver para que lo demás — ganadores, patrones, etiquetado — tenga dónde apoyarse.

Es también la tarea #529 del board que te mencioné ayer ("Unificar detalle de guion con el lenguaje de Analyst", score 69, con deadline 21/08). Estaba bien identificada, solo que el board la describe como un problema de presentación cuando en realidad es de modelo de datos.

### Claude

La investigación terminó (10 agentes, 411 llamadas a herramientas). Extraigo lo importante del resultado.

### Claude

Tengo el resultado. Antes de resumirte, verifico el dato que nadie chequeó y que decide si el punto 2 es demostrable mañana:

### Claude

Un dato decisivo: **el workspace de Mauricio (ws 1) tiene 89 anuncios analizados** — o sea que sí hay con qué demostrar. Pero **ninguno tiene avatar** (0 de 98), y razón directamente no existe como columna.

### Claude

## El plan

El núcleo está construido y funciona. Lo que el tablero muestra mal:

- **#216 y #299: hechas.** Verificadas abriendo el código. #299 se resolvió no desmontando los componentes, que es mejor que lo que pedía su checklist (localStorage); lo único que no sobrevive es un reload.
- **#305 y #292 son la misma tarea**, y quedan a medias por dos cosas chicas: `lib/mako-capacidades.ts:37` sigue mandando la "Fábrica de creativos" a `/onboarding`, y `MatrizView` está montado en tres lugares.
- **#503, #417, #197 y #298 son cuatro tareas para un solo trabajo que no existe.** No hay ningún proveedor de generación de imagen ni video en el repo — `lib/ai-cheap.ts` tiene `VISION_CASCADE` pero es solo *lectura* de imágenes, y `model-registry` no declara un solo modelo de imagen o video.
- **#205 (ElevenLabs)**: la key se pide, se cifra y se verifica, y no la usa ni una línea de código.
- **#89 está al 75% con 3 de 4 ítems tildados y ningún archivo borrado.** Encima le sumé dos huérfanos ayer: `app/api/ads-writer/route.ts` y `lib/ad-copy.ts` siguen registrados en `lib/prompt-registry.ts:70-75` y expuestos como prompts editables en `/configuraciones` — el usuario ve prompts de una feature que ya no corre.

Aviso transversal: varias tareas citan `nav.ts:94, grupo Tools`. Ese grupo ya no existe.

## 1 · Generar 100

El número no es el problema. **El problema es el criterio para elegir.** Generar 100 avatares y quedarse con el mejor solo sirve si "mejor" significa algo; si no, es la misma decisión arbitraria con más ruido y más gasto. Hoy no hay criterio: la elección la haría el mismo modelo con el mismo brief.

Y hay tres cosas que se rompen antes de llegar a los 100:

- **El "3" también vive en el texto de los prompts**, y `renderPrompt` honra overrides guardados en la base por encima del código. Las claves `avatares.system` / `razones.system` / `entregable.system` **no están en el registro**, así que ni siquiera son visibles en `/configuraciones`: un override viejo con el "3" ganaría en silencio sobre todo el trabajo.
- **La cascada usa un timeout fijo de 30s sin importar los `maxTokens`.** Pedirle más volumen hoy trunca, y la truncación es indistinguible de un fallo de red: termina en "probá de nuevo".
- **`preservarIds` empareja avatares por índice**, y los routes reescriben los objetos campo por campo en vez de usar los normalizadores — ya se está borrando `enlace` de los lead magnets en silencio. Cualquier campo nuevo que agregue esto se borra en la siguiente escritura.

Mi recomendación: **24 avatares, 12 razones por avatar, 8 lead magnets** (da ~80 en la matriz, cumple el espíritu del "100" sin inventar el número), y **arreglar la cascada y la persistencia primero**. Antes de fijar el reparto conviene medir una corrida real de 12 avatares: 5 minutos, y define si el lote es de 12 o de 6.

## 2 · Ads Analyst

Acá encontré lo más grave y también la mejor noticia.

**Los "Patrones" existen y son buenos**: 11 reglas que ya redactan frases accionables. Pero viven en `app/ads-analyst/ScriptsBrowser.tsx`, se recalculan en cada render y se tiran. Y **`buildPatterns` no es una función pura**: lee `let ANGLE`, un global mutable de módulo. El propio archivo lo justifica con "*(Single-tenant: … es seguro)*". Moverlo al server tal cual sería una **fuga cross-tenant**: el workspace que renderiza último pisa el vocabulario de todos.

**La señal de "ángulo ganador" hoy es falsa.** El patrón `eff` corona un ángulo con **una sola agenda** (`ag > 0`). Enchufar eso a un prompt es enseñarle a MaKo a afirmar cosas falsas con seguridad. Hace falta un piso explícito antes de que MaKo se anime a decir "este ángulo viene ganando".

**El dato real, que nadie había mirado:**

| | ws 1 (Mauricio) | ws 3 (Prueba) |
|---|---|---|
| Anuncios analizados | **89** | 9 |
| Con avatar etiquetado | **0** | 0 |
| Con razón | no existe la columna | — |

Los ángulos de Mauricio: `dolor` 59, `capataz` 15, `visionario` 14, `oferta` 1. Dos cosas de ahí: **hay material de sobra para demostrar**, y el 66% concentrado en "dolor" ya es un hallazgo presentable por sí solo. Pero esos ángulos son el vocabulario viejo de 5 — **el lado de creación no los conoce**. Y el 100% lo clasificó la IA, nada a mano.

Sobre etiquetar lo publicado: el punto de enganche natural no sirve — es solo-video y las tres rutas de publicación están gateadas por `esDuenoAdmin`, o sea que no llega a clientes. El punto correcto es `app/api/ads-manager/ad-add/route.ts`, que ya tiene el `ad_id` y funciona para imagen, video y creativo reusado.

Y hay un choque entre tus puntos 1 y 2 que hay que resolver antes de codear: **los UUID de avatar no son estables**. Si etiquetás 89 anuncios con el UUID del avatar y después regenerás candidatos y hacés swap, el histórico apunta a una clave muerta y la pantalla muestra un UUID crudo. Se arregla denormalizando el nombre al momento de etiquetar.

## 3 · El diseño

La pregunta difícil es: **¿cuál es la portada de un guion?** Un guion es texto, y una galería de texto es fea por default. La respuesta que me convenció: **el gancho**. `parsearSecciones` ya se ejecuta hoy para cada fila y el resultado se tira — la portada no cuesta cómputo nuevo.

La tarjeta sería: el gancho como texto grande, una espina proporcional que muestra las secciones del guion de un vistazo, tags neutros de ángulo y estructura, y al pie la fecha con el chip de estado. Grilla `auto-fill minmax(300px, 1fr)`.

**La matriz en carriles** en vez de tabla: un carril por avatar con su cobertura ("2 de 3"), y adentro tarjetas; la celda con guion muestra su estado más avanzado y cuántos guiones tiene, la vacía es punteada e invita a que MaKo la escriba ahí mismo. Elimina el scroll horizontal.

**El shell**: cobertura de un vistazo ("12 de 18 anuncios con guion · 3 listos para grabar") y **una sola acción primaria** — "Escribir el próximo guion", que elige la primera celda sin guion y dispara `guion-auto`, que ya existe. Cero backend.

Dos cosas que la revisión frenó: el lector de solo lectura **mataba la única edición de guion que existe** (hoy cada bloque es editable in-place dentro del modal) — va con una prop `onEditar` opcional; y **el chip de estado cicla**: `publicado → borrador`. Hoy con seis controles al lado el riesgo es bajo; en una tarjeta donde es la única acción, un clic errado despublica.

## Lo que tenés que saber para mañana

Voy a ser directo: **de los tres frentes, solo el rediseño produce algo que se ve mañana.** Los puntos 1 y 2 son programas de backend cuyo resultado es invisible por días — un guion publicado no le enseña nada al generador hasta que junte impresiones suficientes. No hay orden en el que lleguen antes que el diseño.

Lo que sí haría entrar antes de la reunión, en este orden: la higiene (una hora, y saca de `/configuraciones` los prompts muertos que dejé ayer), las fundaciones visuales, la galería, y el shell con la cobertura y el botón único. Eso es una demo real. El bucle con Ads Analyst y la capa de candidatos van después, y con los arreglos de cascada y persistencia primero.

## Lo que necesito que decidas

Tres cosas cambian materialmente lo que construyo:

1. **El nombre.** Hoy es "Ads Writer" en el sidebar y "Fábrica de creativos" en el catálogo de capacidades, y las dos apuntan a lugares distintos. Sin eso el título queda provisorio.
2. **El piso de significancia**: ¿a partir de cuántos anuncios y agendas MaKo se anima a decir "este ángulo viene ganando"? Yo propongo 5 confiables en la cuenta y 3 anuncios con 3 agendas en ese ángulo. Es el número que define cuándo MaKo se calla.
3. **El reparto de candidatos**: ¿24/12/8, o querés otro?

Y decime si arranco por la higiene + el rediseño para mañana, o preferís otro orden.


---

## Martín

`2026-08-06 18:48`

1. Será "Content Machine" el nombre. Hay otro claude trabajando en la sidebar y las rutas.
2. Desde a partir de 1 agenda... Pero también tener en cuenta la INTENCION declarada, como los formularios rellenados. Aunque claro que gana las agendas siempre.
3. Si, está bien ese reparto.

### Claude

Anotado: **Content Machine**, no toco `nav.ts` ni rutas (queda para la otra sesión), reparto 24/12/8 aprobado.

Sobre el piso: acepto **desde 1 agenda**, y tu idea de sumar la intención declarada lo mejora — más eventos, señal más densa. Lo voy a implementar así: **el dato nunca se oculta, lo que escala es cuánto se anima MaKo a afirmar**. Con 1 agenda dice "hay una primera señal"; con 10, "este ángulo viene ganando". Agendas pesan siempre más que formularios. Así no te escondo nada abajo de un umbral y tampoco le enseño a afirmar de más.

Arranco por la higiene y el rediseño, que es lo mostrable mañana.

### Claude

El otro Claude ya movió la ruta a `/content-machine`. Chequeo el estado real antes de escribir nada, para no pisarme con esa sesión.

### Claude

El otro Claude dejó `/ads-writer` como redirect y movió todo a `/content-machine`. Trabajo ahí y no toco `nav.ts`, rutas ni `mako-capacidades`. Veo el sistema de diseño que voy a usar:

### Claude

Tengo todo. Armo las tareas y arranco.

### Claude

Ahora la higiene: borro el generador de copy muerto y sus prompts editables.

### Claude

El typecheck tira dos errores que **no son míos**: uno es un artefacto viejo de `.next` que apunta a la ruta que acabo de borrar (se regenera solo), y el otro es `CatalogoUI.tsx` con `NavFamilia`, que es el refactor de nav de la otra sesión. Sigo.

### Claude

Ahora `EstadoChip`: que deje de ciclar `publicado → borrador` de un clic y que alcance el área táctil.

### Claude

Ahora las dos piezas centrales del rediseño: la tarjeta y el lector.

### Claude

El hover va a `ui.css`, no inline (regla del sistema):

### Claude

Ahora el lector, con la prop `onEditar` opcional que evita perder la edición in-place que existe hoy:

### Claude

Ahora la galería, con la barra de 3 controles en vez de 7:

### Claude

Ahora el shell, con la cobertura y la acción única.

### Claude

Typecheck limpio (y el error de `CatalogoUI` se resolvió solo — era de la otra sesión). Verifico que renderice:

### Claude

El HTML de error no dice nada útil. Compruebo si el 500 es mío o de la otra sesión:

### Claude

El estado cambió mientras probaba — la otra sesión está editando en vivo. Reviso:

### Claude

Mi directorio desapareció. Reviso qué pasó antes de reescribir nada:

### Claude

Nada se perdió — la otra sesión **revirtió el rename**, así que mis archivos volvieron a `app/ads-writer/` intactos. Veo cuál es el path vigente ahora:

### Claude

La otra sesión dejó a propósito el label "Content Machine" apuntando a `/ads-writer`. Me adapto a eso. Pero quedó un cabo suelto real: `mako-capacidades` sigue mandando a `/content-machine`, que ahora es un 404 duro.

### Claude

Renderiza. Verifico que sea el diseño nuevo y no el viejo:

### Claude

El header sale pero las tabs y el botón no: los condicioné a que ya haya datos, y en el primer render todavía no llegaron. Eso deja el header pelado mientras carga. Lo arreglo:

### Claude

El header ya se arma completo desde el primer render. Intento verlo en el navegador:

### Claude

El preview de esta sesión sigue muriendo (quinto intento). Antes de cerrar, hay un agujero que me dejó el cambio del chip: en la matriz, un guion en «publicado» ya no tiene forma de volver atrás.

### Claude

`window.confirm` viola la regla del sistema (hay una sola implementación de confirmación). Lo hago bien: el confirm vive arriba y baja como prop.

### Claude

Falta montar `useConfirm` en MatrizView:

### Claude

Ahora lo mismo en la galería: el retroceso vive arriba, donde ya está el confirm.

### Claude

Como no pude correrlo en el navegador, mando una revisión adversarial del diff en paralelo:

### Claude

Está implementado. Te aviso cuando termine la revisión adversarial.

## Lo que quedó

**Higiene.** Borré `app/api/ads-writer/route.ts` y `lib/ad-copy.ts`, y saqué su grupo de `lib/prompt-registry.ts` — eran cuatro prompts editables que el usuario veía en `/configuraciones` para una feature que ya no corre. También lo saqué del selector de modelos. La etiqueta en `ia-labels` la dejé marcada como retirada: el historial de gasto de IA tiene filas viejas con ese tag y sin ella se verían como un slug crudo.

**La tarjeta.** La portada de un guion es **su gancho**: `parsearSecciones` ya lo separaba para cada fila y el resultado se tiraba, así que la galería no cuesta cómputo nuevo. Debajo va una **espina** de 4px donde cada segmento es una sección y su ancho es proporcional al texto que tiene — un gancho que se comió medio guion se ve sin leer una palabra. Las cuatro acciones grises idénticas que había por fila se mudaron al lector, donde pueden tener jerarquía.

**La barra pasó de siete controles a tres.** El pipeline de estados es a la vez el resumen y el filtro, así que la fila de contadores desapareció sin perder información, y los `<input type="date">` nativos se fueron adentro del popover.

**El shell.** Título Content Machine, línea de propósito, cobertura arriba ("N de M anuncios con guion · N listos para grabar") y **una sola acción primaria**: "Escribir el próximo guion", que elige la primera celda sin guion y dispara `guion-auto`, que ya existía. Cero backend nuevo. "Rehacer la matriz" ahora pasa por confirmación diciendo cuántos guiones borra — antes los borraba todos sin preguntar.

Dos cosas que corregí sobre la marcha: el dorado de "aprobado" pasó a azul (el dorado significa "acá intervino MaKo" y gastarlo en un estado lo vuelve mudo), y **el chip de estado dejó de ciclar** `publicado → borrador`, que en una tarjeta de galería despublicaba de un clic errado. La vuelta atrás existe pero pregunta, y aclara que no toca nada en Meta.

## Dos cosas que tenés que saber

**La otra sesión revirtió el rename a `/content-machine`** mientras yo trabajaba. Mis archivos volvieron intactos a `app/ads-writer/` — no se perdió nada —, pero quedó un cabo suelto real que arreglé: `mako-capacidades` seguía mandando a `/content-machine`, que ahora es un 404 duro. Lo apunté a `/ads-writer`. **La tab se llama Content Machine y la ruta sigue siendo `/ads-writer`**; unificar eso es de la otra sesión.

**No pude verlo en el navegador.** Quinto intento; el dev server de esta sesión muere apenas arranca por el conflicto de carpeta. Lo que sí verifiqué contra el server que está corriendo: typecheck limpio, la página devuelve **200**, y el header renderiza con el título, la acción primaria y las dos tabs, sin un solo rastro del diseño viejo. Lo que **no** está probado es todo lo interactivo: abrir una tarjeta, los filtros, el popover, el cambio de estado y el salto guion→anuncio. Por eso mandé la revisión adversarial en paralelo.

Para verlo, cerrá el otro dev server y:

```bash
npm run dev
```

## Lo que no entró

Los tres frentes que decidimos: **la matriz en carriles** (es la mejor pieza visual pero toca `MatrizView`, que está montado en tres lugares), **la capa de candidatos 24/12/8** y **el bucle con Ads Analyst**. Los dos últimos necesitan primero los arreglos de cascada y persistencia que te mencioné — hoy el timeout es fijo de 30s sin importar los `maxTokens`, así que pedir más volumen trunca en silencio.


---

## Martín

`2026-08-06 19:17`

Continua con lo siguiente

### Claude

Lo siguiente es lo que más se nota: la vista **Anuncios** es la primera que se ve al entrar y todavía es la tabla vieja. Voy con la matriz en carriles.

### Claude

Ahora reemplazo la tabla por los carriles:

### Claude

Ahora las piezas que faltan: el handler, los imports y el estilo base de la tarjeta.

### Claude

Verifico que las tres pantallas donde vive la matriz sigan respondiendo:

### Claude

Listo el siguiente tramo: la vista **Anuncios** ya no es la tabla vieja.

## La matriz en carriles

Era lo más urgente porque es **la primera pantalla que se ve al entrar** — tenías el rediseño en Guiones y aterrizabas en la tabla de antes.

La tabla mentía: la grilla obligaba a que todos los avatares tuvieran la misma cantidad de razones y rellenaba los faltantes con `—`, y las columnas se llamaban "Razón 1/2/3", una numeración que no codifica nada. Ahora hay **un carril por avatar** con su cobertura al costado ("2 de 3"), y adentro una tarjeta por razón de compra.

Cada tarjeta dice **cómo viene** sin abrirla: el estado más avanzado de sus guiones y cuántos tiene — dato que ya existía y no se mostraba en ningún lado. Y la tarjeta **sin guion es punteada**: un clic y MaKo lo escribe ahí mismo, sin abrir el modal, con el trabajo visible **en esa misma tarjeta** para que se vea dónde está trabajando. La cobertura se lee sin leyenda: sólido = hecho, punteado = falta.

De paso desapareció el scroll horizontal, que era el motivo por el que los nombres de avatar estaban truncados con puntos suspensivos.

**Un detalle de coordinación**: `MatrizView` se monta en tres lugares (Content Machine, el hub de onboarding y el wizard). Le puse una prop `sinCabecera` para que solo Content Machine esconda el título propio — el hub no tiene shell y sin eso se quedaba sin forma de regenerar. Verifiqué que `/ads-writer` y `/onboarding` siguen devolviendo 200.

## Estado

Typecheck limpio, las dos rutas responden 200, y confirmé que los marcadores de la tabla vieja (`Razón 1`, `Avatar`) ya no aparecen en el HTML.

Sigue sin probarse lo interactivo, por lo mismo de antes. Y **la revisión adversarial que lancé todavía está corriendo** — te la paso cuando llegue, con lo que haya encontrado.

Actualicé la memoria del proyecto con el estado v6, incluido el detalle de que **la tab se llama Content Machine pero la ruta sigue siendo `/ads-writer`** y que `/content-machine` es hoy un 404 duro, para que ninguna sesión apunte ahí.

Lo que queda del plan que acordamos: los arreglos de cascada y persistencia (precondición dura para el reparto 24/12/8) y el bucle con Ads Analyst. ¿Sigo con eso, o preferís que primero prueben la pantalla y ajustemos con lo que vean?


---

## Martín

`2026-08-06 19:30`

Continua

### Claude

Sigo con los arreglos de fondo que son precondición del reparto 24/12/8. Leo lo que hay que tocar.

### Claude

Confirmado el diagnóstico. Arreglo la cascada primero: hoy corre con 30s fijos aunque le pidas 4000 tokens.

### Claude

La revisión encontró dos bugs graves — y uno **pierde guiones**. Eso va antes que cualquier otra cosa. Veo la lista completa:

### Claude

36 hallazgos confirmados (con duplicados entre lentes). Los dos graves son reales y uno **borra guiones**. Voy por esos primero.

### Claude

Quedó un `</div>` de más al sacar el bloque del contenedor. Lo corrijo:

### Claude

Popover arreglado. Ahora el grave: la pérdida de guiones. Agrego escrituras quirúrgicas que leen del servidor en vez de mandar el array entero.

### Claude

Ahora el shell: que use esas acciones y que se entere de lo que escribe la matriz.

### Claude

Ahora que la matriz avise cuando escribe, para que la cobertura y la galería no queden viejas:

### Claude

Ahora los arreglos medianos: el borrado que cerraba antes de confirmar, la acción que no muestra su resultado, y el botón dentro de botón.

### Claude

Ahora el botón dentro de botón en la tarjeta, que es HTML inválido:

### Claude

Ahora los tres de la acción primaria: que muestre su resultado, que no mienta cuando no hay nada que escribir, y las áreas táctiles.

### Claude

Y el hover/foco del menú, que estaba inline y por eso no existía:

### Claude

Falta que el lector sea un diálogo de verdad (Escape y foco) y corregir su comentario, que decía lo contrario de lo que hace:

### Claude

Dos más que son de honestidad de la interfaz: el estado optimista que no volvía atrás y el "Copiado" que mentía.

### Claude

Listo. La revisión valió la pena: encontró dos bugs que el navegador habría mostrado en el primer minuto y que yo no podía ver.

## Los dos graves

**El popover de filtros era invisible.** La barra estaba envuelta en `.mk-scroll-x`, que es `overflow-x: auto` — y por la regla de CSS Overflow el eje que queda en `visible` pasa a `auto`, así que la caja recortaba en **los dos** ejes. El menú colgaba 6px por debajo de una fila de 44px: no se veía nada. Ángulo, avatar y fecha eran **inalcanzables**, y no había otra entrada a esos filtros. Saqué el botón y su popover fuera del contenedor; el scroll de mobile se lo quedó el pipeline, que es lo único que se pone ancho.

**La galería borraba guiones.** El shell cargaba la matriz una sola vez y `MatrizView` escribe por su cuenta sin avisar. Como la acción `guardar` **reemplaza la matriz entera** con lo que le manden, la secuencia era: generás un guion en Anuncios → vas a Guiones → borrás o editás cualquier otro → se manda la copia vieja → **el guion recién generado desaparece**. Lo arreglé por los dos lados: acciones nuevas `guion-borrar` y `guion-texto` que releen del servidor y tocan un solo guion (nunca más el array entero desde el cliente), y un `onCambio` que la matriz dispara al escribir, así la cobertura del header y "el próximo guion" dejan de mentir.

## Los demás

También arreglé: borrar desde el lector cerraba el modal **antes** de que confirmaras (cancelar te dejaba afuera igual); "Escribir el primero" no hacía nada sin matriz; la acción principal escribía 30-60 segundos y no te mostraba dónde quedó el guion — ahora abre la celda; `<button>` dentro de `<button>` en la tarjeta, que es HTML inválido; áreas táctiles por debajo de `--touch`; el menú sin `:hover` ni `:focus-visible` (estaba inline, donde eso no existe); el lector ahora cierra con Escape y toma el foco; la chispa dorada sobre el botón dorado se borraba; la cobertura mezclaba anuncios con guiones en la misma frase; y "Todos tienen guion" seguía clickeable y te cambiaba de tab en silencio.

Dos de honestidad de la interfaz: el chip de estado ahora **vuelve atrás** si el guardado falla en vez de quedarse pintado en un estado que el servidor no tiene, y "Copiado" dejó de mentir — si el navegador bloquea el portapapeles (pasa entrando por `http://` desde la red local) ahora te lo dice.

Verificado: typecheck limpio, `/ads-writer` y `/onboarding` en 200, y las dos acciones nuevas responden 422 con el mensaje correcto ante una celda inexistente.

## Lo que queda

De los 36 hallazgos confirmados quedan **siete, todos de gravedad baja**: los dos GET duplicados a la misma API, el dorado que sobrevive en el chip de ángulo dentro del modal, el `EmptyState` que dibuja su acción en azul en vez de dorado, editar una sección normaliza el texto y se come las viñetas, un guion viejo sin etiquetas no se edita desde la galería (sí desde la matriz), el filtro de avatar ofrece avatares sin guiones, y las tabs sin `role="tablist"`.

Y una corrección sobre lo que dije al empezar este tramo: **el arreglo de la cascada no está hecho**. Había empezado con él, la revisión llegó con la pérdida de datos y prioricé eso. Sigue pendiente el timeout fijo de 30s sin importar los `maxTokens` y el `esfuerzo` que nunca viaja — o sea que el reparto 24/12/8 todavía no se puede pedir sin que trunque en silencio.


---

## Martín

`2026-08-06 21:42`

Quiero crear algo similar a mila.gg

"Para cada guion de investigación usamos decenas de fuentes, artículos, reportes, threads, videos. El problema no es escribir, es lo que pasa antes de escribir. Tener esas fuentes organizadas por videos, saber cuál dato viene de dónde y no perder el enlace justo cuando ya lo necesito para citar. Normalmente eso vivía repartido entre pestañas abiertas y notas sueltas que nunca cuadraban entre sí. Por eso probé Mila, la suite diseñada para reemplazar herramientas como War o Google Docs. Usé Cloud Opus 4.6 dentro de Mila para que tomara todas las fuentes que había reunido para un video específico sobre la burbuja de la IA y me armara un documento organizado por tema, cada fuente con su enlace, una nota de qué dato aporta y agrupada según en qué parte del guion las iba a necesitar, sin que yo tuviera que acomodar nada a mano. Eso es lo que me convenció. No tuve que decirle cómo estructurar el documento, solo le pasé las fuentes y le dije para qué video eran. Y Mila hizo el trabajo de organización completo con un documento limpio y fácil de navegar en vez de una lista desordenada. Si tú también tienes trabajos con muchas fuentes por proyecto y sientes que se te desordena todo antes de siquiera empezar, dale una oportunidad a Mila, link y código de descuento en la descripción."

"Hola,

Mila es software de oficina reconstruido desde cero con la IA en su núcleo, no añadida como una ocurrencia tardía.

Soy Fred. Trabajo en Microsoft (no en Office). Veíamos constantemente a la gente copiar y pegar entre ChatGPT y sus documentos, luchando contra herramientas que no fueron diseñadas para la forma en que se trabaja hoy en día. Así que algunos de nosotros empezamos a construir algo mejor por las noches y fines de semana: un espacio de trabajo donde la IA no es una barra lateral, es la base."

Eso es lo que le falta a muchas cosas de MaKo, que se sienta como IA.
Investiga a Mila, como funciona e implementemos.
O incluso si hay otras opciones parecidas a Mila

### Claude

Buen norte. Antes de investigar quiero marcar algo que va a condicionar la propuesta: Mila es una **suite de oficina**, y MaKo no. Copiar el producto sería expandir el alcance a un lugar equivocado; lo que sí se transfiere es el principio —la IA como sustrato, no como barra lateral— y hay un caso en MaKo que calza casi exacto con el ejemplo del video: **escribir con fuentes**.

Lo investigo a fondo antes de proponer.

### Claude

La landing es casi vacía, así que hay que buscar en fuentes secundarias. Lanzo la investigación completa.

### Claude

Lancé la investigación (10 agentes: Mila y su producto real, el mapa de alternativas IA-nativas, los patrones de diseño que separan "IA en el núcleo" de "IA agregada", y dos auditorías del código de MaKo — dónde está la IA hoy y qué tiene de manejo de fuentes).

Mientras corre, dos cosas que quiero dejar planteadas porque van a condicionar la propuesta:

**Lo que sí se transfiere y lo que no.** Mila es una suite de oficina: documentos, hojas, presentaciones. MaKo no es eso y construir un editor de documentos sería el error más caro posible. Lo transferible es el principio —que la IA sea el sustrato y no una barra lateral— y el caso de uso concreto del video, que en MaKo tiene un equivalente casi exacto.

**Ese equivalente.** Fijate qué describe el creador del video: junta decenas de fuentes para escribir **un guion**, y el problema no es escribir sino lo de antes — tener el material organizado y saber de dónde salió cada dato. Eso es literalmente el hueco que dejamos ayer en Content Machine: MaKo escribe guiones a partir del brief del negocio, pero **el guion no tiene fuentes**. No hay forma de traer un artículo, un video o un reporte, ni de que el guion diga de dónde sacó una afirmación.

Y hay un detalle de tu propia historia que refuerza el punto. Cuando el prompt de guiones salió malo, lo que lo arregló de verdad no fue reescribirlo a ojo: fue una investigación con agentes en paralelo sobre frameworks de copywriting reales, y después un prompt que citaba qué hallazgo justificaba cada regla. **Eso pasó acá, en Claude Code, en tiempo de desarrollo.** Dentro del producto, MaKo no puede hacer nada parecido: no investiga, no junta material, no cita. Esa asimetría es probablemente buena parte de lo que estás sintiendo cuando decís que no se siente como IA.

Te paso el resultado con la propuesta y el orden cuando termine.

### Claude

La investigación llegó lejos: los agentes leyeron los bundles de JavaScript de Mila y sacaron los textos reales de la interfaz. Extraigo lo importante.

### Claude

Antes de reportarte los dos bugs vivos que encontró, los verifico yo mismo:

### Claude

Confirmado, y es serio. Verifico el segundo:

### Claude

Los dos bugs son reales; los verifiqué yo. Guardo lo aprendido y te resumo.

### Claude

Investigación terminada. Empiezo por lo que más te va a cambiar el plan.

## Mila no tiene la feature del video

Los agentes leyeron los bundles de JavaScript de la app y sacaron los textos reales de su interfaz. **No existe ningún "gestor de fuentes" en Mila.** No hay Source Manager, no hay Research Library. Lo que hay son cuatro primitivas sueltas:

1. Adjuntar archivos al chat.
2. Un `@` que referencia tus propios archivos ya guardados — el placeholder dice literalmente *"Plan, research, or @ to reference files"*.
3. Un toggle de búsqueda web que al responder pinta una tarjeta *"Web Search — N sources"*.
4. El agente escribe el documento.

El creador del video dice "no tuve que decirle cómo estructurar el documento". Es cierto — pero porque **eso lo resolvió el modelo, no una feature**. La agrupación por tema, la nota de qué aporta cada fuente y el enlace son salida de texto, no objetos del sistema.

Eso es liberador: no hace falta construir un producto entero para lograr esa sensación.

## Y peor: Mila no garantiza lo que promete

En el bundle del editor **no existe ningún modelo de datos de fuente**. Ni "citation", ni "Cite", ni "Sources". Los enlaces del documento son texto que el modelo transcribió, sin verificación. Las fuentes web se adjuntan al *mensaje del chat*, no al documento. El visor de PDF no tiene IA: sus únicas cadenas son "Previous page", "Zoom in", "Download PDF".

O sea que la promesa central del video —*"saber cuál dato viene de dónde y no perder el enlace"*— **no está garantizada por el producto**. Si copiamos el look sin la fila de datos, copiamos el bug. Ahí está tu diferencial.

## Lo que sí hay que robarle

Una sola cosa, y es arquitectura, no copy: **el mismo componente de chat instanciado en documento, hoja, slide y web builder, con exactamente las mismas props.** No es "una IA por pestaña con comportamientos distintos". Es una superficie de IA reutilizada. Eso es "la IA no es una barra lateral, es la base" implementado de verdad.

## El diagnóstico de MaKo, con números

Tenés razón, y el código lo prueba. De **~73 puntos donde MaKo usa IA: 47 son botón** ("Generar/Analizar" y esperar), 6 son chat, 17 automáticos y **solo 3 ambiente** — y de esos 3, uno ni siquiera usa IA (el gate del CRM corre con umbrales, no importa ningún modelo) y otro es el contador de gasto.

**73% de la IA de MaKo exige que el usuario la vaya a buscar.** Y `/general`, la pantalla donde vive todo cliente, tiene 499 líneas y **ni una sola invocación de IA**. La tab que se llama "Second Brain" son 49 líneas de formularios.

Además MaKo no sabe dónde estás: solo 4 archivos importan el contexto compartido; los otros ~50 puntos arman su prompt desde cero.

## Dos bugs vivos que encontré de paso

Los verifiqué yo, línea por línea:

**1. Pegar un link en El Archivero puede reescribirle el brief al cliente.** `procesarLink` corre la extracción sobre el HTML de *cualquier* URL e inserta la fila; `listFiles` no filtra nada; y `computeEffective` recorre todos los archivos con la regla "el último pisa". Resultado: **pegás la web de un competidor y su precio y su oferta pasan a ser los del cliente** — y ese brief alimenta avatares, razones y guiones. No es un riesgo futuro, pasa hoy.

**2. El chat ✨ de cada gráfico congela los datos.** El contexto se guarda al crear la sesión y después se usa siempre ese. Un cliente que abrió el chat en enero recibe en marzo respuestas razonadas con los números de enero, sin ninguna señal. Eso no es "no se siente IA": es MaKo mintiendo.

## Por dónde empezar

El revisor fue duro con las dos propuestas de diseño y tenía razón: las dos arrancaban con cosas invisibles (refactor de color, migraciones, plomería). Después de dos semanas abrís la app y no ves nada distinto — que es exactamente la queja original.

**El primer paso es el bloque de MaKo arriba de `/general`.** El contenido ya existe: `buildReporteDiario` arma ese resumen y hoy sale solo por WhatsApp. Ya lo considerás lo bastante bueno como para mandártelo. Lo único que falta es mostrarlo donde la persona está parada. Cero tablas nuevas, cero refactor. Es lo único que se ve el mismo día.

Después: arreglar el envenenamiento del brief (chico y urgente), registrar las ~28 features que hoy caen al default **Opus 4.8 con effort high** —lo más caro que hay, y esto *financia* el resto—, y recién ahí mover puntos de botón a ambiente.

## Lo que decidí no proponerte

Nada de editor de documentos, hojas ni slides: el artefacto de MaKo es **la fila** (una tarea, un lead, un guion), no el documento. Nada de selector de modelos con multiplicador de costo — ya decidiste lo contrario y decidiste mejor. Nada de inspector de tokens ni checkpoints: son tripas de LLM. Y ninguna tab nueva: `nav.ts` ya muestra **6 features en "próximamente"**, y sumar una séptima promesa empeora justo lo que querés arreglar.

Una nota sobre el caso del guion: el revisor desaconsejó que los guiones de anuncios citen fuentes, y coincido. Un guion es diálogo hablado de 30-90 segundos cuyo propio prompt prohíbe la jerga y las cifras no confirmadas; una cita en un anuncio pagado es una afirmación con plata detrás. La cadena de citas rinde en el **Archivero y el Closing**, no en el anuncio.

Decime si arranco por el bloque de `/general`, o si preferís que primero tape el agujero del Archivero — es chico y es corrupción de datos real.


---

## Martín

`2026-08-07 06:27`

A demás de los guiones, los angulos, los avatares, etc... Me gustaría agregar "IDEAS" que sea algo similar a lo de la landing de Mila, un solo input de texto que tiene una animación que va escribiendo y borrando, y a raiz de eso, salen las IDEAS que los dueños de negocio pueden ir teniendo sueltas...

Esa idea dentro de la content machine se puede transformar en muchas piezas de contenido. 

Luego tenemos que procesar esas ideas, ir guiandole al usuario para expandirla y transformarla en un guion.

### Claude

Me gusta, y encaja con algo que ya notamos: hoy Content Machine solo sabe empezar desde la matriz (avatar × razón). Una idea suelta no tiene puerta de entrada.

Antes de construir hay una decisión de arquitectura real que quiero resolver bien, no adivinar: **si una idea se enruta a la matriz existente o vive aparte**. Lo investigo junto con el resto.

### Claude

Lanzado. Mientras corre, te dejo dónde estoy parado, porque hay una trampa en este pedido que conviene ver antes de construir.

**El input no es la feature. El problema es el cementerio.** Toda herramienta de captura rápida muere igual: capturás entusiasmado dos semanas y nunca volvés a mirar la lista. Si IDEAS es solo "un lugar lindo donde anotar", en un mes es una lista muerta de 40 renglones que da culpa abrir. Lo que hay que diseñar con más cuidado no es la captura —eso es un input— sino **qué hace que una idea vuelva a aparecer sola cuando sirve**.

**Mi inclinación sobre la arquitectura.** La idea vive en carril propio, con su tabla: capturar no puede pedirte que elijas un avatar, eso mata la captura. Pero **"expandir" es el momento en que MaKo la coloca**: te propone a qué avatar le habla y por qué razón de compra, y de ahí en adelante usa la maquinaria que ya funciona (los 14 ángulos, las estructuras, `generarGuion`). Así la idea entra al mundo existente en vez de crear un universo paralelo de generación.

**El placeholder animado tiene un trabajo real, y ahí está tu "que se sienta como IA".** En una pantalla vacía, el placeholder que se escribe solo enseña qué tipo de cosa va ahí. Pero si los ejemplos son genéricos ("Escribir un plan de negocios") es decoración. Si salen **del negocio del cliente** —de su brief, de sus avatares, de lo que ya cargó en el onboarding— entonces la pantalla demuestra que MaKo ya sabe de qué se trata su negocio antes de que escriba una letra. Eso es exactamente lo contrario del botón ✨ que espera órdenes.

**Y una advertencia sobre "una idea → muchas piezas".** Suena bien y es donde más fácil se rompe: si las N piezas son la misma cosa reformateada, el usuario lo nota en el primer intento y deja de confiar. MaKo ya tiene el mecanismo correcto para que sean genuinamente distintas —los ángulos con sus requisitos, y la regla "un anuncio, un mensaje"—, pero sospecho que la respuesta honesta para la v1 es **un solo tipo de pieza, el guion**, porque varios de los otros writers siguen siendo carteles de "próximamente". Prometer cinco formatos y entregar uno empeora justo lo que querés arreglar.

Te paso el diseño con el modelo de datos, las pantallas y qué entra en la primera tanda cuando termine.

### Claude

El hallazgo más importante ya cambia el diseño. Extraigo el resto.

### Claude

Verifico los tres puntos que más cambian el plan:

### Claude

Verificado todo. Tres cosas cambian el plan.

## El slot ya existe

`nav.ts:220` ya tiene `{ key: 'ideas', label: 'Ideas', href: '/ideas', comingSoon: true }`. O sea que **Ideas es una de las seis promesas de "próximamente"** que te mencioné ayer. Construirla no agrega una promesa: cumple una. Corrijo lo que dije entonces: acá sí corresponde.

## El hallazgo que reordena todo: el inbox *es* el cementerio

La investigación encontró el testimonio exacto de una power-user de Tana sobre el patrón "capturá sin decidir, procesá después": *"once it's out of my head and into that inbox, I legit forget about it"* — 35+ ítems, meses sin vaciar. Su solución fue **eliminar el inbox**.

De siete mecanismos de retorno que existen en el mercado, **solo tres funcionan sin disciplina del usuario**, y los tres comparten una cosa: el usuario **nunca entra a la lista de ideas**. La idea viene a él dentro de algo que ya estaba haciendo.

La regla que sale de ahí: **el retorno no es una pantalla, es un slot vacío.** Si IDEAS es una lista a la que hay que entrar, ya perdió — y el motor de retorno tiene que salir en el **mismo release** que la captura, no como fase 2, porque la fase 2 nunca llega y para entonces el usuario ya aprendió que la app se traga las ideas.

## La arquitectura

Confirmo mi inclinación, y el diseño la afinó: **la idea no es un carril paralelo ni una celda más — es un insumo de una celda.** Se captura libre, y "anclar" es donde MaKo la coloca en la matriz que ya existe. Con una salida honesta: si no calza en ninguna celda, queda `sin_anclar`, y eso es un estado válido, no un error.

Tabla propia (`0123_ideas.sql`, verifiqué que 0122 es el tope), no el blob de settings — meter ideas en `mako.razones` sería repetir exactamente el bug de pérdida de datos que arreglamos hoy.

**Y un gate que no se puede saltear:** `'ideas'` no está en `TENANT_TABLES` (`lib/workspace.ts:43`). Crear la tabla sin registrarla ahí es una fuga cross-tenant silenciosa. Va en el mismo commit.

## Dos supuestos falsos, y uno es mío

El revisor rompió la parte que más te interesa:

**1. El wizard de expansión no puede ver la idea.** `sugerirGuion(celdaId, { anguloId, timeoutMs })` — verifiqué la firma: no hay slot para el texto del dueño. Su prompt arma brief + celda + biblioteca de ángulos. La idea recién aparece al final, como `opts.nota` de `generarGuion`. O sea que el wizard le preguntaría al dueño **cosas del anuncio mientras él cree que está expandiendo su idea**.

**2. El retorno más fuerte casi nunca se enciende — y es culpa de un cambio que hice hoy.** Diseñaron el retorno alrededor del botón primario de Content Machine, que cuando la matriz está cubierta pasaría a "Escribir desde una idea tuya". Pero **hoy ese botón solo se apaga con cobertura 100%** (`disabled={hayMatriz && !proximaCelda}`) — lo escribí yo esta tarde arreglando otra cosa. Con 9 o 18 celdas por llenar, eso no pasa en meses. Justo los meses en que le estás enseñando al usuario a capturar. Ahí se construye el cementerio.

## La primera tanda

El diseño completo son 13 pasos: es un producto, no una tanda. Lo que entra: la migración con `TENANT_TABLES`, el input con label real y placeholder animado (por `ref`, sin estado de React, con `prefers-reduced-motion` y chips clickeables con los mismos ejemplos para quien no ve la animación), el micrófono, el guardado inmediato, el anclaje con cero o una pregunta cerrada, y **los dos retornos**: las ideas de esa celda como chips dentro del panel "Nuevo guion" —que ya funciona y precarga `opts.nota`—, y la condición del botón primario corregida.

Se corta: la escalera de expansión de tres escalones, los ángulos con score, el cron de re-anclaje, y el email como segunda pieza (está bloqueado por un hardcode de Mauricio Bustos y su Calendly en el system prompt de `/api/email/generar` — bug aparte que anoto).

## Tres decisiones

1. **¿Cambio la condición del botón primario** para que ofrezca una idea sin esperar cobertura total? Sin esto la v1 captura y no devuelve.
2. **¿El micrófono entra en la v1?** El backend ya existe (`transcribirAudio`). Sin él, IDEAS es una libreta de escritorio y no cumple la premisa de "las ideas que uno va teniendo sueltas" — que llegan manejando, no frente a la pantalla.
3. **¿La idea entra al prompt que elige el ángulo, o solo al final como nota?** Abrirle un slot al texto del dueño en `razones.sugerir` mejora mucho la expansión, pero cambia el guion de **toda** la Content Machine, no solo el de ideas.

Mi recomendación: sí a 1 y 2 (son chicas y sin ellas la feature no cumple su propia premisa), y **no** a 3 por ahora — la nota ya viaja al prompt, y tocar el ángulo de toda la fábrica el día antes de una demo es el peor momento posible.


---

## Martín

`2026-08-07 07:03`

En donde lo metiste? hay una tab de ideas

### Claude

No lo metí en ningún lado — todavía no construí nada. Solo investigué y diseñé; quedamos en las tres decisiones. La tab que ves ya existía. Dejame confirmarte qué hay ahí:

### Claude

No implementé nada. La tab que ves es un cartel de "próximamente" que ya existía antes de que empezáramos con esto.

**Qué hay:** `app/ideas/page.tsx` son 8 líneas que renderizan `<ComingSoon title="Ideas" />`. La entrada del nav está en `nav.ts:220` con `comingSoon: true`. Las dos vienen del commit `72984b8` *("Rediseño · el hover roto, Content Machine como sección y tus tres íconos")*, que es de la otra sesión — la que está trabajando el sidebar. No aparece en mis cambios sin commitear.

Y hay un detalle interesante: quien la creó ya tenía la intuición correcta. El comentario arriba de la línea dice:

> *"Antes de la pieza está de qué hablar. Por eso Ideas va suelto arriba y no adentro de un canal: no es de Meta ni de Instagram ni de YouTube."*

Y la página: *"El primer paso de la fábrica: de qué hablar, antes de que haya pieza."*

Es exactamente lo que me pediste. O sea que Ideas ya está **ubicada** en la navegación —suelta arriba de Content Machine, fuera de los canales— y lo que falta es el contenido: la captura, el anclaje y el retorno.

Eso hace más simple lo que sigue: no tengo que decidir dónde vive ni tocar `nav.ts` (que es territorio de la otra sesión). Solo reemplazar el `ComingSoon` de `app/ideas/page.tsx` por la pantalla real, y sacar el `comingSoon: true` al final, cuando funcione.

Sigo esperando las tres decisiones para arrancar: si cambio la condición del botón primario para que ofrezca ideas sin esperar cobertura total, si el micrófono entra en la v1, y si la idea entra al prompt que elige el ángulo o solo como nota al final.

