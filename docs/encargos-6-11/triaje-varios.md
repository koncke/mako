# Triaje de «Varios» — los 73 de `equipo-otro.json` (6/11/2026)

Los 73 pendientes que no cayeron en ningún área se leyeron uno por uno y se comprobaron **contra el
código de `origin/main`** (3e83ac1ce, worktree `C:/dev/wt-varios-6-11`). Esto es el resultado de esa
pasada, no un plan: para cada item hay un veredicto y la prueba que lo sostiene.

## Los números

| Veredicto | Cuántos |
|---|---|
| **Ya estaban hechos** cuando se escribió la foto | **6** |
| **Parcialmente hechos**: la foto describe un estado que ya no existe | **6** |
| **Son de un área** que tiene un chat trabajando al lado | **17** |
| **No se entienden**, ni leyendo el `original` | **3** |
| **Los destraba Martín**, o piden un teléfono, la base de producción o una clave | **20** |
| **Quedan míos** | **21** |

Los dos primeros renglones se cruzan con los otros: de los 6 «parciales», el **309** lo termina Infra y
el **583** lo terminé yo (está contado en los 21), y el **580** y el **596** siguen con su área. Los 73
ids se reparten sin solaparse así: 6 + 6 + 17 + 3 + 20 + 21 = 73, contando cada id una sola vez en la
fila que manda.

Y hay un número que no estaba en la lista: **73 ids son 68 trabajos**. Cinco items están escritos dos
veces, con otro título: `67 ≡ 325` (la página de «no encontrado»), `306 ≡ 464` (las aperturas de MaKo),
`572 ≡ 619` (las seis mediciones que faltan), y `465 ≡ 609`, cuya segunda mitad es además el `466`.

## Lo que más tiempo ahorra: los fantasmas

Seis pendientes **ya estaban cerrados el 6/11**, y cuatro de ellos ese mismo día o el anterior. Otro
grupo (los «parciales») describe un árbol que cambió el 5/11, el día antes de la foto.

| id | Qué decía | Prueba de que ya estaba |
|---|---|---|
| **319** | «Faltan cuenta regresiva, prueba social y escasez en las landings» | Los tres nodos existen: `app/web-generator/editor/extensiones/nodos.ts:533-535` (`CuentaRegresiva`, `PruebaSocial`, `Escasez`) y el catálogo los inserta en `insertar.ts:217-219`. Commit **9bfa14326, 5/11**: «Black November… tres bloques de venta en las landings». Un día antes de la foto. |
| **473** | «AGENTS.md dice que Creem modera lo que genera imagen o video» | `AGENTS.md:11547-11553` ya dice textual «Hoy no modera nadie: Creem cerró la tienda y `PROVEEDOR_DE_MODERACION` vale null», con la regla operativa intacta. Commit **1be60d0a4, 5/11**. |
| **591** | «Cinco tablas con `workspace_id` quedan fuera del proxy de inquilino» | Las cinco están DENTRO de `TABLAS_DE_INQUILINO`: `lib/tablas-de-inquilino.ts:66` (`avisos_programados`), `:83` (`flujo_corridas`), `:96` (`insistencias`), `:140` (`replay_lotes`, `replay_sesiones`). El comentario de `:63-65` nombra el hallazgo y el test. Commit **eb6092ef1, 17/10**: veinte días antes de la foto. |
| **594** | «Dos STT clavados en `whisper-1` no pasan por el choke point» | `transcribeMediaBuffer` (`lib/transcribe.ts:178`) y `transcribeAd` (`:266`) llaman a `escuchar()`, que llama a `ai.transcribirAudio` (`:64`). No queda ningún `whisper-1` en el archivo. Commit **cf00a3b92, 22/10** («IA7: una sola puerta para el audio»). Lo que sí sigue con las keys del entorno es `lib/transcribe-plataforma.ts:91`, y eso es a propósito: son las clases de los cursos, no el negocio. |
| **601** | «`contexto.ts` sigue con el `GRAFO` viejo» | No existe ningún `const GRAFO` en `lib/copywriter/`: `contexto.ts:1-12` es un re-export de `lib/negocio-para-crear.ts`, que ya lee `grafoParaChat`. El encabezado fecha la mudanza el 29/10. |
| **364** | «Al mover un bloque en el Copywriter, lo que estaba dentro se queda atrás» | Existe `lib/copywriter/seccion-arrastre.ts` y el editor lo usa: `app/copywriter/editor/CuerpoNotion.tsx:37` lo importa y `MenuLateral` (`:244-251`) selecciona la sección con `setSelection(tramo.desde, tramo.hasta)` **antes** del arrastre de BlockNote. Con su test (`tests/copywriter-arrastrar-seccion.test.ts`, probado rompiéndolo) y su recorrido visual. Commit **8b384b9e5, 6/11**: el mismo día de la foto. ⚠️ **Este casi se me pasa**, y por mi culpa: busqué `DragHandleMenu`/`children` —los nombres de la API de BlockNote que el item nombra— en vez del nombre que le puso el repo. Lo delató la fila del índice de `docs/hallazgos.md`. Antes de dar un item por abierto, se lee la fila de su área en el índice. |

### Los parciales: la foto cuenta un estado que ya no existe

| id | Lo que la foto afirma | Lo que hay hoy |
|---|---|---|
| **306 ≡ 464** | «`lib/aperturas/` sólo tiene `ops.ts`, `comunes.ts` y `reglas.ts`» | Tiene **nueve** aperturas: `calendario`, `clients`, `crm`, `dashboard`, `image`, `ops`, `plan`, `video`, `web`. Entraron el 5/11 (`ac253236f`, `8c73958ba`, entre otras). Lo que falta está en la tabla viva de `docs/relevo/nube-iniciativa.md:35-51`, no en este item: la escalera del Ops Center (T3), Offer, la mudanza de Copywriter, la guía de Automations, el Pixel del Web Generator, Classroom, AI Avatar, Mobile y la hoja de General. |
| **583** | «`recurrente` no entra por WhatsApp ni por la API, y `juzgarConCriterio` es código muerto» | Tres de cuatro están: `lib/mako-doer-acciones.ts` sí manda `recurrente` (`:213`, `:223`, `:233`, y el schema de la tool en `:493`); `lib/plan-propuesta.ts` tiene `TareaExtra.recurrente` (`:73`), `decidirRecurrente` (`:207`) y lo pasa en `tareasDesdeRespuestas` (`:731-738`); y **`juzgarConCriterio` NO es código muerto**: lo llama `lib/reunion-auto.ts:431`. Quedaba uno solo, y es el que arreglé. |
| **580** | «`moverClienteDeEtapa` sin compare-and-set manda el mensaje dos veces» | El compare-and-set **ya está**: `lib/cs-mover-etapa.ts:278` escribe con `.eq('id', previa.id).eq('etapa', previa.etapa)`, y el comentario de `:139` explica el caso que perdía. Quedan la CAPA en las server actions (lo dice `app/customer-success/actions.ts:35-36`) y los tres de producto. |
| **596** | «`leadsEnElWebhook` … ninguna pantalla lo usa» | **Ya tiene consumidor**: `app/api/cron/meta-leads-poll/route.ts:54` lo usa junto a `asegurarWebhook`, y `lib/zernio-leads-estado.ts` es su módulo puro. Lo que falta de verdad es la pantalla, el barrido de recuperación y el `created:false` de `upsertLeadFromMeta`. |
| **309** | «`\| Ads \|` 5 veces y `\| AI Avatar \|` 3 veces, en las líneas 145-303» | `AI Avatar` ya es **una sola** fila (`docs/hallazgos.md:168`). `Ads` sigue cinco veces (`:23`, `:27`, `:130`, `:148`, `:149`) y las dos primeras son casi idénticas. **Los números de línea del item ya no valen**: el archivo tiene 300 líneas, no 303+. |

## Son de un área (no los hago yo)

⚠️ **Y acá hay un agujero.** Los 73 ids de «Varios» **no aparecen en ningún otro `equipo-*.json`**:
verifiqué los once archivos y no hay un solo id repetido. Así que «es de otra área» no significa «ya
tiene dueño». Sólo cuatro tienen un equivalente real en la lista de otro equipo; los otros trece hay
que **pasárselos a mano** o se caen entre las sillas.

| id | Área | ¿Tiene dueño? |
|---|---|---|
| **467** La tarjeta de Apify dice «Sin conectar» con la clave 2 puesta | Infra | **Sí: Infra id 100**, y mejor diagnosticado — la función no vive en `lib/integraciones.ts` sino en **`lib/credenciales.ts:285`**. Confirmado: el respaldo por cuenta con sufijo existe, pero sólo para `PASARELAS`, y Apify no es una pasarela. |
| **468** Las varias claves de Apify y el «sin crédito» en pantalla | Infra | **Sí: Infra id 104** (el mismo recorrido) y **101** (el tope que la tarjeta informa mal: dice 40, el real es 150). |
| **309** El índice de hallazgos con filas repetidas | Infra | **Sí: Infra id 611**, que cubre el índice entero (194 filas para 53 documentos). Tocar esa tabla desde dos puntas es el conflicto de siempre. |
| **476** El Marketing CoPilot nunca habló con una IA de verdad | Admin / Infra | **Sí: Admin id 230** (las 14 corridas con IA real) y **Infra id 36**, que agrega el dato que importa: la punta `punta/marketing-copilot` (`361c64223`) **nunca subió**, así que correr las conversaciones hoy mide código que no está en main. |
| **475** El múltiplo de rendimiento nunca se miró en pantalla | Spy / Carruseles | **No.** El chip vive en `app/competitor-spy/SpyApp.tsx` y en `/image-editor`; Carruseles tiene el id 121 y Spy el 95 mirando esas mismas pantallas. Hay que pasárselo. |
| **561** El CoPilot sin cifras de Google Ads ni LinkedIn | Marketing CoPilot | **No.** `lib/media-buyer/copiloto-contexto.ts`, pendiente anotado en `docs/hallazgos-marketing-copilot.md:41`. |
| **562** Lo que la sesión duplicada del CoPilot dejó sin portar | Marketing CoPilot | **No.** Y la decisión no es técnica: son reglas parafraseadas de dos repos MIT y hay que decidir si entran, con su licencia en el commit. |
| **563** Autopilot rotula «pausar» con los textos del ganador | Marketing CoPilot | **No** — pero el item lo dice solo: «Lo rehace el chat Marketing CoPilot porque sumar una táctica rompe el `Record<Tactica,…>` de `mb-modelo.ts`». |
| **618** Una hoja del Dashboard sin enchufe en creaciones | Graphics / Dashboard | **No.** Confirmado: `lib/creaciones-reglas.ts:45` tiene `ENCHUFADOS` con tres tipos y `:47-52` `POR_ENCHUFAR` con DOS entradas vivas, `dashboard: 'Graphics'` y `formato_video: 'Video Editor'`. El dueño lo nombra el código. |
| **574** La cadena de pago sale del dominio del cliente | Cobros | **No**, aunque Cobros tiene 21 items sobre esa misma cadena. |
| **575** Nadie poda `landing_pago_pedidos` | Cobros | **No.** Y la mitad de medir el `form-action` con un checkout de Stripe en dominio propio pide Chrome y Safari de verdad. |
| **576** Avisarle al negocio un pago rechazado | Cobros / Chat | **A medias: Chat id 288** es «falta la automatización lista para cuando rechazan un pago», que es la mitad de esto. |
| **577** Los diseños con animaciones del Web Generator | Web Generator | **No**, y hay un chat de landings abierto en paralelo. |
| **625** «Probar» exige una línea conectada | Chat | **A medias.** Sale del §Sin hacer de `docs/relevo/automations.md:451-470`, el MISMO bloque que los ids 624 y 628 del equipo Chat. Verificado abierto. |
| **626** Al crear, la IA escribe el texto de un audio que graba la persona | Chat | **A medias.** Toca `app/api/chat-agent/secuencias/ia/route.ts`, el mismo archivo que el id **624** del equipo Chat. |
| **627** No hay «solo estos días» del goteo | Chat | **A medias.** Mismo §Sin hacer. Verificado abierto: `lib/config-automatizacion.ts:70` define `goteo?: { minutos?, dia?, arranque? }` — no hay elección de días, y `:19` confirma que son los del horario propio. |
| **368** Lo que falta de lo prometido a la agencia de Thiago | Calendario / Ads / CRM | **A medias**, y por otra puerta: las filas «Lo prometido a Thiago (6/11, nube)» ya están cosechadas en `docs/hallazgos.md` para Calendario y para Ads, así que esos chats lo trabajaron. La parte de Ads se solapa con el id 563. |
| **305** Seis cosas de la llamada de Leandro sin repartir | varias | **No, y no es un trabajo: es un reparto.** Los seis son de áreas distintas (iconos y sidebar = UI, `curso.def.ts` y `cs.def.ts` = API de MaKo, el bloque de Instagram inventado = Chat). Repartir lo hace el Cerebro. |

## No se entienden

Tres items no se pueden trabajar ni sabiendo qué quisieron decir, porque el pedido no está escrito en
ninguna parte. No los adivino.

- **304 — «Hay fuentes de pedidos de clientes que nadie leyó nunca».** No es un pendiente de código: es
  leer ocho fuentes y repartir lo que salga. Y **la mitad no está en el repo**: el WhatsApp personal de
  Martín, `C:/dev/cerebro-herramientas/llamada-mau-22-10.txt`, las side-session-notes y los mensajes del
  Ops Center que el Runner no levantó el 27/10. Desde un chat no se puede ni empezar ni medir si está hecho.
- **320 — «Varios logos no son los reales».** Dice «muchos» y nombra **uno**. Verificado: `LogoMeet`
  (`app/_components/ServicioVisual.tsx:216-228`) es un dibujo propio, y su comentario dice que fue a
  pedido («"Asignar evento" con el logo de Meet», 16/10). Cuáles son los otros no está escrito, y bajar
  el logo de un tercero no es algo que un chat haga por su cuenta.
- **367 — «Que la IA use MaKo como si fuera un cliente».** No dice qué recorridos, con qué workspace, ni
  qué cuenta como error encontrado. «Sin script» es el estado, no el pedido.

## Los destraba Martín, o piden algo que un chat no tiene

Veinte items. No están trabados por falta de trabajo.

**Piden una firma, una clave o una decisión suya (9):**

| id | Qué falta de su lado |
|---|---|
| **65** | Él decidió destilar los cursos **afuera** de la app por los créditos de IA, y de las «plantillas de influencers» no hay ni análisis ni links en el repo. ⚠️ La trampa que anota el item vale: una ficha cargada desde la pantalla sale con `fuente:'manual'` y **no le llega a ningún negocio**. |
| **313** | Conectar Drive es dar de alta scopes nuevos en Google Cloud y pasar el consentimiento. Verificado: cero scopes de Drive en el repo (`grep auth/drive` sin resultados); los de Google son sólo Calendar. |
| **336** | El propio item lo dice: transcribir YouTube pide la clave de Gemini, desde la PC. |
| **373** | La mitad que falta es «responderle la fecha» a Mauricio. |
| **310** | Lo único escrito es «Otra funcionalidad buena es el Hook generator… Lo dejo como backlog». Verificado: cero código y cero especificación. Qué entra, qué sale y en qué tab vive no está en ninguna parte. |
| **311** | «100 anuncios en menos de una hora» sin decir **de qué**: ¿imagen, video, copy, las tres? Sólo figura en `docs/como-venden-otros.md:146`. Verificado: no existen `lib/video-generator` ni `app/image-generator`. |
| **314** | Verificado: cero resultados de «cambió de opinión» en `lib/` y `app/`. Y «historial en progreso» no dice de qué pantalla ni qué cuenta como decisión. |
| **315** | Focus Tracker (Toggl por BYOK) y Productivity Analyst: dos features nombradas, cero requisitos. Verificado: ni «toggl» ni «Focus Tracker» en `app/` ni `lib/`. |
| **361** | «Que MaKo diga qué cápsulas necesita el curso y las ordene según la oferta» es una feature de IA entera sin criterio escrito. |

**Piden un teléfono, un navegador o datos reales (11):**

| id | Qué entorno pide |
|---|---|
| **72** | El script existe (`scripts/medir-funciones-publicas.mjs`, 8,3 kB) pero mide qué puede ejecutar la clave pública **contra la base de producción**. No lo corrí: va con el sí de Martín o desde el chat de seguridad. |
| **308** | 401 recursos en 10 cursos y 2.342 sin publicar son filas de producción. |
| **372** | Mirar la pantalla en escritorio y teléfono, y C8 **espera que P7 esté aplicado** (`mudanza-avisos-plataforma --eventos=reunion_tareas_al_plan`). |
| **469** | La nube no ve los paneles de aprobación. No es un arreglo: es correr el vigía con `--guardar <id> auto "<texto>"` la primera vez que lea cada panel. |
| **472** | Play, TestFlight, el aviso a equipo@ y el id 900001 en la base real. |
| **481** | Safari, Firefox, la app de iPhone y la subida contra Vercel y Supabase de verdad. La lógica pura ya está probada (`tests/grabar-llamada.test.ts`). |
| **571** | Las 20 hojas están verificadas por composición, tipos y tests; falta **abrirlas** con datos de un workspace (ws3 y ws1). |
| **604** | La primera prueba A/B real va en el ws3 con la migración ya aplicada, y la dimensión «rama» hay que verla en pantalla. |
| **608** | Lo verificable está verificado contra un servidor de mentira; falta un cliente con el hook puesto y confirmar los nombres de los eventos (`UserPromptSubmit`, `SessionEnd`) y los campos del stdin. |
| **572 ≡ 619** | Las seis mediciones (retención por segundo, confianza de un A/B, cohortes M0-M5, motivos de baja, foco por tarea, horas ahorradas) **no existen en MaKo**. El mismo item escrito dos veces, con una variante: en 619 la sexta es «alcance y CTR antes del clic». |

## Los míos, por lo que le cuesta a un cliente

Veintidós, ordenados por lo que pasa si no se hacen. Los tres primeros valen más que los otros
diecinueve juntos.

| # | id | Qué le cuesta al cliente | Estado |
|---|---|---|---|
| 1 | **600** | **Escribe un documento, se guarda bien, y la pantalla dice «No existe».** Ver abajo: es el peor de los 73. | **hecho** (`punta/varios-copywriter-crear`) |
| 2 | **590** | Alguien sin sesión puede ejecutar acciones de pantallas que no son el CRM. Medido hoy: **95** archivos con `'use server'` en `app/`, **24** con `exigirSesion`; fuera de `app/crm` quedan **71 sin corte**, entre ellos `app/admin/cobros/actions.ts`, `app/customer-success/actions.ts` y `app/configuraciones/*`. | abierto, grande |
| 3 | **587** | Nueve pendientes del núcleo de la API, y uno **rompe skills ya instaladas en clientes** (`historial_whatsapp` y `reuniones_lead` por `/api/agente/consultar`). Otro devuelve el error dentro de un 200. | abierto, se cierran de a uno |
| 4 | **583** | Una tarea que se pide recurrente por la API se crea como tarea única, sin aviso. | **hecho** (`punta/varios-plan-recurrente-api`) |
| 5 | **606** | El reporte de WhatsApp dice una meta y la pantalla dice otra. **Y la receta del item está mal** — ver abajo. | abierto, pide una firma |
| 6 | **573** | Se filtra un mes, los gráficos cambian y los números de arriba siguen mostrando el negocio entero. Hay alcance empezado (`app/general/datos.ts:25` importa de `lib/general-alcance.ts`) pero `leerVistaGeneral()` (`lib/vista-general.ts:112`) sigue sin recibirlo, y es la que alimenta el objetivo, los KPIs, el semáforo y los pendientes. Más los dos formateadores de plata (`fmtUSD`, `lib/format.ts:12`). | abierto |
| 7 | **599** | Leer una imagen, un PDF escaneado o un audio **puede cobrar en la OpenAI del cliente**: verificado, no hay ningún `sinPago` en `lib/ai-cheap.ts`. Más el PDF externo de Offer y el umbral de `alertaFoco` sin medir. | abierto |
| 8 | **67 ≡ 325** | Entra a un link viejo y ve una pantalla ajena a MaKo. Confirmado: **no existe `app/not-found.tsx`**. El bloqueo que los dos declaran («pide un navegador para copiar la referencia») **ya no aplica a este chat**. | abierto, destrabado |
| 9 | **335** | Copywriter, Newsletter, Automations y WhatsApp escriben sin apoyarse en los 5.050 emails ya estudiados. **La verificación que pedía el item está hecha, y la respuesta es cero** — ver abajo. | medido |
| 10 | **465 ≡ 609 ≡ 466** | En Offer, AI Avatar, Web Generator, Dashboard y Video nadie puede guardar lo que hizo para reusarlo, y nadie puede retirar lo que publica un cliente. Confirmado: `lib/creaciones-enchufes.ts:169` tiene `ENCHUFES` con tres tipos. Tres items, un trabajo; toca `app/admin/`, que el brief anterior prohibía. | abierto |
| 11 | **307** | El Second Brain contesta sin saber la mitad de lo que pasa. `construirCerebro()` vive en `lib/cerebro-grafo.ts:326`; medir las 21 lecturas pide la base. Lo que sí se puede sin ella es el item 569. «El Second Brain bien en el teléfono» es otra cosa y debería ser su propio item. | abierto, grande |
| 12 | **569** | Un campo nuevo del brief no aparece en el mapa que promete «todo lo que MaKo sabe de tu negocio». Confirmado: `lib/cerebro-grafo.ts:155-158` tiene las cuatro listas fijas, usadas en `:506-507`. Latente mientras ningún workspace tenga esquema propio. | abierto |
| 13 | **566** | Una campaña nace en pausa y alguien tiene que prenderla a mano a la hora justa. Verificado: `lib/calendario.ts` no tiene tipo `'anuncio'`. **Empieza a gastar plata a una hora**: pasa por `lanzar` con zona, fecha de fin y topes, y por revisión adversarial. | abierto, no sale en una tanda |
| 14 | **603** | En cinco pantallas el clic derecho no hace lo mismo que en el resto. Y una pide decidir: el selector de Offer es el `Dropdown` de la casa, así que tocarlo cambia el desplegable de **toda** la app. | abierto |
| 15 | **333** | Ocho restos del Ops Center en un item. Dos ya tienen base: `CARTERO_VIVO_MS` existe (`lib/centro-chats.ts:25`, `:221`) y «Renombrar» por fila también (`app/admin/operaciones/Conversacion.tsx:112-114`). `/api/mako-doer` sigue en pie. | abierto |
| 16 | **477** | Un título pegado al borde se corta en el mapa del negocio. | **hecho** (`punta/varios-grafo-encuadre`) |
| 17 | **570** | Todo lo medido del grafo se puede romper sin una señal roja. Confirmado: `lib/cerebro-grafo.ts:36` lleva `import 'server-only'`, así que ningún test lo importa. La salida está escrita en el propio archivo (`:71`): la parte pura vive en `lib/cerebro-modelo.ts`, sin la marca. | abierto |
| 18 | **602** | Costo para el cliente hoy: ninguno. El costo es que la próxima pantalla vuelva a hacer el menú distinto. Confirmado: `app/_ui/MenuContextual.tsx` lo usan nueve pantallas por ruta directa, pero `grep -c MenuContextual app/_ui/index.ts` = **0** y no está en el catálogo. | abierto, chico |
| 19 | **312** | El menú promete VSL Generator y no existe. Confirmado: `app/_components/nav.ts:494` lo marca `comingSoon: true` — **y hay otros siete iguales** (Sales Email, Newsletters, Closing Script, Sales Roleplay, YouTube Writer, Ideas). No es una excepción: es cómo está armado el menú. Si molesta, la decisión es sobre los ocho. | abierto, prioridad baja |

## Tres cosas que no sabíamos

### 1. El peor bug de los 73 estaba descrito en una línea, y es real (item 600, B7)

`lib/copywriter/server.ts` → `crear()`: si `cambiarIndice()` devuelve `!ok`, borra el documento que
acababa de escribir. Y `cambiarIndice()` (mismo archivo) devuelve `falla(500, …)` **cuando
`cambiarSettingSi` TIRA** — un timeout de red cuya escritura sí llegó al servidor.

Entonces: la fila queda en el índice, el documento se borra, y el cliente abre lo que acaba de escribir
y lee «No existe». El `catch` que promete limpiar un huérfano es el que produce la pérdida.

**La regla:** un rollback no se dispara con «la operación falló», sino con «la operación **no** dejó
rastro». Antes de borrar hay que volver a leer. Está arreglado así.

### 2. La receta del item 606 estaba equivocada, y al aplicarla se empeora

El item dice: «unificarlo es mover esos dos call-sites a `objetivosContextoTexto()`». No se puede, por
dos razones que sólo se ven leyendo las dos funciones:

- `objetivosContextoTexto()` (`lib/objectives.ts:622`) devuelve **prosa para un prompt**, no números. El
  reporte imprime `cierres_actual/cierres_meta` y `cash_actual/cash_meta`. Mover el call-site le mete un
  bloque de texto de varias líneas al WhatsApp del cliente.
- Y hay un problema que el item no ve: la meta nueva es **por trimestre**, y el actual que el reporte
  muestra se acumula desde `objetivo_desde` (`lib/queries.ts:2995-2997`). Cambiar sólo la meta compara
  una meta trimestral contra un acumulado histórico: **una mentira peor que la de ahora.**

El arreglo correcto es que el reporte lea `quarterActual()` + `listObjectives()` + `avanceDeObjetivo()`.
El mapeo es mecánico (`metrica: 'cash_usd'` y `metrica: 'cierres'`, ver `migrarSettingsAObjectives` en
`lib/objectives.ts:568-595`), pero **cambia qué número lee el cliente en su reporte**, así que lo firma
Martín. Lo dejé sin tocar.

### 3. Los 5.050 emails estudiados no los lee nadie (item 335)

El item pedía comprobar si los patrones de email se usan. Está comprobado y la respuesta es **cero**:
`docs/conocimiento/patrones-email.md` existe y pesa 92 kB, y **ningún archivo de `lib/` ni de `app/` lo
nombra**. Sólo lo citan otros documentos.

Enchufarlo no es pegar 92 kB en un prompt: pide un destilado indexado, como el que ya existe para los
cursos en `lib/knowledge-modulos.ts`. Eso es una decisión de diseño, no una tarea.
