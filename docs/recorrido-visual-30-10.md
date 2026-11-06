# El recorrido visual de MaKo en producción (30/10/2026)

Se miró hola-mako.com en el Chrome de Martín, con su sesión de super admin, sin guardar ni publicar nada. Hubo dos vueltas: la
primera (claude3, 8 de 22 pantallas, su texto entero al pie) y la segunda (claude1, chat «Landings de MaKo en Web Generator»).

**Estado: A MEDIAS.** Se vio la primera pantalla de las 14 que faltaban, más Ops Center, Chats y Second Brain. Lo que trae archivo en la
tabla se leyó en el código; lo marcado «1.ª vuelta» se vio en pantalla y no se volvió a mirar. Chrome se reinició a las 15:19 y volvió con la sesión de otro usuario, así que falta:

- las pestañas internas: Plan (Tareas, Proyectos, Recurrentes), Classroom (Community, Calendar, Members, Leaderboards, About,
  Methodology), Customers (Accounts, Billing, Agents), Settings (Perfil, Seguridad, Notificaciones, Instalar la app, Identidades
  fiscales), API (Tokens, Registro), Ads (Biblioteca);
- adentro de un proyecto de Video y de Image;
- **los anchos 1280 y 1024** de todo lo de la segunda vuelta. La barra única del editor web sigue sin verse a 1280 (lista en
  docs/diseno-editor-web-como-automations.md, «Cómo se verifica en pantalla»).

## Estado al 6/11/2026 (nube, rama `punta/recorrido-visual`)

Medido contra `origin/main` del 6/11, con un banco (el componente de verdad en Chromium, sin sesión) a 1440 y 390 px, o a 1280
y 1366 donde el defecto vive en ese ancho. Antes y después en `docs/recorrido-visual/`. **«En main» no es «en producción»:** desde
el 6/11 la lleva un cron una vez por día. El relevo, con las preguntas para Martín: docs/relevo/nube-recorrido-visual.md.

| # | Estado | Dónde quedó |
|---|---|---|
| AD1 | ✅ ya estaba en main | `2fb65f144` (lib/media-buyer/cartel-hoy.ts): sin campañas no dice «todo anda» |
| AD2 | ➡️ Ads | No se tocó (`app/ads-manager` lo rehace otro chat) |
| CR1 | ➡️ plantillas reales | Lo cubre docs/plantillas-reales/ (tanda 0 hecha; las miniaturas de cada tab, en su tanda) |
| OF1 | ✅ hecho | `80d1af1fc`: el nombre que se repite lleva su funnel («Crear una oferta nueva · Coaching») |
| AV1 | ➡️ plantillas reales | docs/plantillas-reales/avatar.md: los retratos se hacen en Flow; la nube no los puede generar |
| AV2 | ➡️ iniciativa T15 | «Antes de generar» se pliega en T15 (docs/mako-iniciativa/plan.md) |
| U3 | ❓ Martín / jefe Sidebar | La sidebar no scrollea (regla): que entre a 730 px es reorganizarla, y eso lo decide el jefe «Sidebar» |
| C1 | ✅ hecho | `968eea8ee`: la foto que no carga (también antes de hidratar) cae a las iniciales |
| C2 | ✅ hecho | `968eea8ee`: el nombre usa dos renglones y lleva `title`; el teléfono se lee entero |
| C4 | ✅ hecho | `968eea8ee`: «Mover la etapa» al lado de las flechas (y «Mover la hoja» en la ficha) |
| D1–D7 | ➡️ Dashboards | No se tocó (lo rehace otro chat) |
| A1 | ❓ Martín | El piso de zoom legible (`ZOOM_LEGIBLE`) es lo que corta el flujo: bajarlo o abrir el panel encima es suya |
| A2 | ❓ Martín | «CRON» es el rótulo que él pidió textual para el disparador: cambiarlo es suyo |
| A3 | ✅ hecho | `7132bc7f2`: con el interruptor prendido dice «Activa» |
| A4 | ❓ Martín | Los nombres en Mayúscula Inicial vienen de las plantillas y de la base: cambiar la regla es suya |
| A5 | ➡️ iniciativa T8 | El chat vacío del flujo lo llena la apertura de T8 |
| P2 | ✅ hecho | `7132bc7f2`: el porqué del objetivo va recortado a 5 renglones, sin el hueco |
| O1 | ✔️ a propósito | `app/page.tsx`: la raíz es la landing para todos; entrar es `/inicio` |
| SB1 | ➡️ Admin | `app/admin/operaciones/Conversacion.tsx:250` (`Escribe a ${chat.titulo}`): anotado para Admin |
| CH2 | ✅ hecho | `7132bc7f2`: un solo panel vacío y los filtros en una fila que se corre |
| EQ1 | ✅ ya estaba en main | `488e13b52`: sin «0 personas» ni el segundo «Invitar» |
| CU1, CU2 | ➡️ Admin | `lib/clientes-plataforma.ts:164` y `customers-vista.ts:74,78`: anotado para Admin |
| AP1 | ✅ hecho | `7132bc7f2`: «Automations» y docs/api-mako.md regenerado |
| W1 | ❓ Martín | El cartel «Continuar viendo» es del reproductor de Panda (su configuración), no de MaKo |
| W2 | ✅ ya estaba | Arreglado en `recorrido-web-3010` (abajo) |
| CH1 | ➡️ iniciativa T4b | La apertura de la portada de Video e Image, sin proyecto abierto (abajo) |

**Lo de la llamada con Leila del 5/11:**

| Pedido | Estado | Dónde quedó |
|---|---|---|
| Copywriter: arrastrar un bloque deja su contenido atrás (1.8) | ✅ hecho | `8b384b9e5`: un título se lleva su sección. Visto arrastrando en Chromium |
| CRM: el desplegable de «Mensajes de difusión» | ✅ ya estaba en main | `6bf0a40a8` (entró el 2/11, `648fe07a8`); el CRM lo monta. Si Leila vio la cara vieja, producción no lo tenía |
| Web Generator: el carrusel 4:5 | ✅ hecho | `cd0f4811e`: una presentación puede ser 4:5 (pantalla, miniaturas, presentar, PDF y PowerPoint) |
| Image Editor: rota con la barra fijada y el chat (1.4) | ✅ hecho | `e7c51f1b2`: con el editor angosto el panel va encima del lienzo (a 1280: de 257 a 619 px) |
| MaKo Desktop: para qué sirve | ✅ hecho | `49a7cad73`: Settings › Instalar la app › «Para qué sirve» |
| Agency: más a la vista en el menú del perfil | ✅ hecho | `49a7cad73`: Partners y Agency, justo debajo de Settings |

## Abiertos, por dueño (para repartir)

Severidad: **A** se rompe o miente; **M** se usa pero se ve o se lee mal; **B** detalle.

**Lo más grave es AD1:** no es visual, la app afirma algo que no midió. Sin campañas tiene que decir que no hay datos.

| Chat dueño | # | Sev. | Dónde | Qué pasa | Dónde vive / verificado |
|---|---|---|---|---|---|
| **Ads Manager** | AD1 | **A** | Ads Manager, «Hoy» | Dice «Hoy no hay cambios. Todo anda dentro de tu objetivo» sobre una cuenta con 0 campañas y $0 gastados (la pestaña Campañas sí lo dice bien). | app/ads-manager/MediaBuyer.tsx:276-277 y app/m/ads/MediaBuyerM.tsx:84-85: sólo mira `hoy.length` y `config.encendido`. Leído en el código. |
| Ads Manager | AD2 | B | Ads Manager | Dos entradas a MaKo a la vista: la caja del centro y el botón de la estrella. | Sólo visto en pantalla |
| **Create** (el shell) | CR1 | M | Video, Image (las primeras 7), Offer | Plantillas con un rectángulo vacío y las medidas. Regla de Martín del 29/10: «No pueden haber miniaturas en blanco». | app/_crear/reglas.ts:49 (`el marco vacío`), app/_crear/TarjetaPlantilla.tsx |
| Create / Offer | OF1 | M | Offer | Dos plantillas se llaman igual, «Crear una oferta nueva»: lo que las distingue es un texto chiquito adentro del cuadro. | app/offer/arbol.ts:242: una por funnel, con el mismo `nombre` y el funnel en `rotulo` |
| **AI Avatar** | AV1 | M | AI Avatar | 26 de 28 presets sin imagen: sólo un fondo de color (misma regla). | lib/ai-avatar/plantillas.ts: 2 `ejemplo:` en 28 `id:`. Contado. |
| AI Avatar | AV2 | M | AI Avatar | «Antes de generar» y la barra quedan fijos tapando casi la mitad de la pantalla, sin cerrarse, encima de los presets. | app/ai-avatar/Estudio.tsx (`hf-barra-*`). Lo cubre T15 («Antes de generar» se pliega) |
| **Sidebar** | U3 | M | Barra lateral, en todas las pantallas | A esta altura (730-811 px) el último ítem queda cortado detrás del avatar. Estando en AI Avatar o Copywriting, el activo no se ve. | app/_components/Sidebar.tsx; a confirmar si el ítem activo hace scroll hasta verse |
| **CRM** | C1 | M | Tablero | Tarjetas con imagen rota en vez de las iniciales. | 1.ª vuelta |
| CRM | C2 | M | Tablero | Nombres y teléfonos cortados con «…»: en un lead sin nombre, el teléfono no se lee entero. | 1.ª vuelta |
| CRM | C4 | B | Menú ⋯ de una columna | Dos flechas sueltas, sin texto. | 1.ª vuelta |
| **Dashboard** | D1 | M | /dashboard de Martín | Sin hojas. **A verificar con Martín:** si tenía, pasa a A. | 1.ª vuelta |
| Dashboard | D2 | M | Editor, 1536 a 1024 | El panel de propiedades flota encima del gráfico seleccionado. | 1.ª vuelta |
| Dashboard | D3 | B | Editor, 1024 | «Estilo de la hoja» cae a un segundo renglón. | 1.ª vuelta |
| Dashboard | D5 | B | «Audiencia y alcance» | Tres tarjetas de 440 px con una línea. | 1.ª vuelta |
| Dashboard | D6 | B | Miniaturas de plantillas | Botones adentro de un botón. | 1.ª vuelta |
| Dashboard | D7 | B | Miniaturas | Sólo «SUM»: los demás son nombres y van en inglés (ver «Descartados»). | 1.ª vuelta |
| **Automations** | A1 | M | Flujo, 1024 a 1280 | El lienzo no encuadra el flujo: el segundo nodo queda cortado. | 1.ª vuelta |
| Automations | A2 | B | Disparador | Dice «CRON» en eventos que no son programados: la etiqueta está mal. | 1.ª vuelta |
| Automations | A3 | B | Lista | «Activar» con el interruptor ya encendido. | 1.ª vuelta |
| Automations | A4 | B | Lista | Mayúscula Inicial a la inglesa en los nombres. A confirmar con la regla de nombres. | 1.ª vuelta |
| Automations | A5 | B | Flujo abierto | El chat vacío ocupa 550 px en blanco. | 1.ª vuelta (lo cubre T8 de la iniciativa) |
| **Plan** | P2 | B | Tarjeta del objetivo | Unos 200 px vacíos. | 1.ª vuelta |
| **Ops Center** | O1 | B | `/` con sesión | Muestra la landing pública. A confirmar si es a propósito. | 1.ª vuelta |
| Ops Center | SB1 | B | Second Brain | El chat se llama MaKo y la caja dice «Escribe a Chat nuevo». | app/admin/operaciones/Conversacion.tsx:245 (`Escribe a ${chat.titulo}`) |
| **Chats** | CH2 | B | /chats sin elegir | Dos paneles vacíos que dicen lo mismo; el filtro «Etapa» cae solo a un 2.º renglón. | app/chats/ChatsApp.tsx:507, PanelContacto.tsx:92 |
| **Settings** | EQ1 | B | Equipo | «0 personas» y abajo «Todavía eres el único»; dos botones Invitar. | app/equipo/EquipoView.tsx:168 |
| **Customers** | CU1 | B | «Clientes» | Las cuentas de prueba (Prueba real, Cliente de Diseño, Cliente de Prueba) cuentan como clientes. | lib/clientes-plataforma-reglas.ts |
| Customers | CU2 | B | Arriba | «Nuevos en 30 días» no cuenta a los clientes de agencia y «Para mirar» sí: dos alcances sin aclarar. | lib/clientes-plataforma-reglas.ts:254 y :165 |
| **API** | AP1 | B | Índice | «Chatbot y secuencias» y «Ads (Manager y Analyst)»: nombres viejos. | lib/api-mako/tipos.ts:46 y :54 (también salen en docs/api-mako.md) |
| **Web Generator** (este chat) | W1 | B | `/`, reproductor | El cartel «Continuar viendo» queda encima del título del video. | 1.ª vuelta |
| Web Generator (este chat) | W2 | **A** | Landing copiada | Las imágenes de una landing copiada daban 404. **Arreglado en esta rama, probado contra la página real (0 → 32 de 32) y #88 reparada** (abajo). | lib/landing-fetch.ts, lib/editor-landing/replicar-reglas.ts |
| Iniciativa (T4 a T8) | CH1 | M | AI Avatar siempre; Video e Image mientras no hay un proyecto abierto (Copywriting y Offer tienen chat propio) | El chat abre con la conversación del Cerebro (una del 11/10, ajena a la pantalla) y sin pregunta de MaKo: `PantallaCrear` no le pasa `apertura`. La conversación compartida es a propósito (`ConversacionCerebro`, app/_crear/PantallaCrear.tsx:17; regla «UN chat en toda la app»): el defecto es que no haya pregunta arriba. ⚠️ **T4 sola no lo arregla:** sólo agrega el reenvío de `apertura`, y hoy ninguna de las tres tabs pasa una. AI Avatar la recibe en T15 (última, sobre la tarjeta del Cerebro, sin chat propio). T11 y T12 son para Video e Image con un proyecto abierto: **sin proyecto abierto, ninguna tanda les da pregunta.** | docs/mako-iniciativa/plan.md:376, :383-384, :387 |

## La prueba en vivo de Leila (pendientes-30-10.md, 1.1): qué se midió

Medido en la base del ws11 y en el código. **Sin mirar la pantalla:** el Chrome conectado tiene la sesión de un cliente y el navegador integrado no tiene ninguna.

| Punto | Qué era | Dónde quedó |
|---|---|---|
| 1.1, 1.2, 1.3 Carruseles | La validación doble tiraba todo el texto; el chat no recibía lo ya hablado | Arreglado. Causa y medición en hallazgos-editor-imagen.md |
| 1.2, poner fotos | El chat no sabía hacerlo | **Hecho** el 30/10: de Subidos y adjuntas. Probado contra el cargador del motor; no visto en el editor completo |
| 1.3, la marca entera | El chat no conoce colores ni logo | **Sin hacer.** Depende de 2.9 |
| 1.4 Página 1, 2, 3 | El encabezado no entraba en una página angosta | Arreglado; medido en una réplica |
| 1.4 Barra y chat abiertos | La barra ya arranca plegada; queda abierta para quien la fijó, por decisión del 24/10 | **Arreglado el 6/11** (`e7c51f1b2`): con el editor angosto el panel de herramientas va encima del lienzo. Visto con el editor de verdad en un banco |
| 1.5 Llevarlo a presentación | La landing #89 (ws11) nació del texto del carrusel, en modo IA y sin imágenes. «Usar de guía» no aparece en el código | **Sin diagnosticar.** Falta qué pantalla era |
| 1.8 Arrastrar | Un Título y lo de abajo son bloques hermanos: BlockNote mueve sólo el que se arrastra. Seleccionar todo funciona porque arrastra la selección | **Arreglado el 6/11** (`8b384b9e5`): un título se lleva su sección. Visto arrastrando en Chromium |
| 1.9 «¿Qué vendo?» | Esas frases no están en el código. La pregunta con botones «¿Lo adapto a tu oferta? ¿A cuál?» entró a main el 29/10 23:11 y Martín nombró en la llamada un botón «Adaptar a tu negocio» que ya no existe. Puede ser una versión anterior | **A confirmar** con la versión desplegada |
| 1.10 Ver ejemplo | Estaba gris, como una miga | Arreglado (azul). Sin verlo en pantalla |
| 1.11 «Concentrarte en una oferta» | No sale de un chat del 30/10: la última sesión de Offer del ws11 es del 12/10 y su informe dice «congelas la venta… para concentrarte al 100%» (criterio D9 Foco, `alertaFoco`). No es un error: es el método | **Decisión de producto:** qué hace D9 con quien vende varias a propósito |
| 1.16 Replicar | La dirección base de la página. No comparte causa con 1.2 | Arreglado, probado (0 → 32 de 32) y #88 reparada |

## Las aperturas de Create: decisiones del Cerebro (30/10) y texto para el plan

**Decidido:**

- **Video e Image sin proyecto abierto: va una apertura nueva al plan.** Es donde Martín vio el problema y hoy no la cubre ninguna tanda. Hasta que exista, no se tacha CH1.
- **AI Avatar queda en T15, la última: no se vende** (`AI_AVATAR_SE_VENDE = false`) y el plan la deja para cuando el motor genere un look en producción. **Vale hasta que entren a AI Avatar los
  estudios de `open-generative-ai`,** que Martín pidió hoy y se están construyendo en la nube. Con eso la tab pasa a ser una pantalla que la gente usa, y T15 deja de poder ser la última: hay que
  volver a decidir.
- **No se le agrega un chat propio a AI Avatar:** va contra la regla de Martín «UN chat en toda la app» y contra el plan (:334).
- **La tarjeta de Create abre SIEMPRE abajo del historial, sin condición de fecha.** Con pregunta, muestra la pregunta; sin pregunta, la caja vacía para escribir. Lo anterior se sube a leer. Hoy, con
  historia, la pregunta va después del último mensaje (plan :109) y la charla de octubre se sigue viendo arriba de ella. No toca la regla del UN chat: la conversación es la misma, cambia dónde empieza la vista.
  **Por qué sin fecha:** un corte por tiempo falla de los dos lados. «Es de hoy» deja a quien escribió a la mañana en el Ops Center justo en la charla ajena, que es la queja.
- **Sólo en la tarjeta de Create.** `ConversacionCerebro` es también el de la estrella: cambiarlo para las dos es otra decisión, no un efecto.
- **El proyecto de [Sí, lo subo] toma el tamaño del video que sube.** Si no se puede leer, 9:16, como la primera tarjeta de Nuevo video.

**El texto para `docs/mako-iniciativa/plan.md`** (`plan.md` no es de este chat; lo reparte el Cerebro):

Una tanda nueva después de T4, porque usa su reenvío de `apertura`:

| Tanda | Chat | Qué | Archivos | Listo cuando |
|---|---|---|---|---|
| T4b | **Video Editor e Image** (después de T4) | La apertura de la portada, sin proyecto abierto. Sin `corto`: el centro ya dibuja «¿Qué vas a crear hoy?» (el mismo criterio que Dashboard, :326) | `app/video-editor/VideoEditorCliente.tsx` (:158-168), `app/image-editor/ImageEditorCliente.tsx` (:151-165), `lib/aperturas/video.ts` y `lib/aperturas/image.ts` (los de T11 y T12: los crea el que llegue primero) | En ws3, sin nada abierto, cada tab abre con su pregunta y sus botones andan sin la app; contestada en la portada, no se repite adentro del proyecto; también con la tarjeta plegada |

Y dos filas en la tabla de aperturas:

| Dónde | Cuándo | Pregunta | Botones | Se va |
|---|---|---|---|---|
| **Video** · portada de Create | Sin proyecto abierto | «¿Ya grabaste tu video?» (la de :328, misma clave) | [Sí, lo subo ★] (`hacer`: el proyecto nuevo y la biblioteca; el tamaño, abajo) · [Todavía no] → «Te escribo qué decir.» (`ir` /copywriter) | — |
| **Image** · portada de Create | Sin diseño abierto | «¿Dónde lo vas a publicar?» (la de :329, misma clave) | [Historia] [Carrusel] [Anuncio] [Miniatura] → `hacer`: `crearDisenoNuevoAction` con `historia`, `carrusel_instagram`, `anuncio_facebook` o `miniatura_youtube` | — |

**Para el que implemente la vista** (`ConversacionCerebro`, app/_chat/MakoEnLaTab.tsx:305):

- ⚠️ **Hoy el hilo baja sólo cuando cambia `k.items.length` o `k.trabajo`, no cuando llega la apertura.** La apertura llega después, cuando carga la memoria: con historia larga puede quedar abajo, fuera de la vista.
- **Dejar el historial fuera de la vista pide lugar abajo de él:** sin eso, el navegador no puede subirlo y la charla vieja sigue a la vista.
- **Se ve bien con poco historial y falla con el largo:** probarlo con una conversación larga, como la de Martín.

**Para el que implemente el tamaño:** el editor ya hace casi todo. Sin `relacion` fijada, el primer clip con medidas pone el lienzo (`_opencut/commands/timeline/element/insert-element.ts:90-107`).

- ⚠️ **El 9:16 no se puede poner con la tarjeta `lienzo:reel`:** esa guarda `relacion: '9:16'`, y con una relación fija el primer clip ya no cambia el lienzo. Con eso nunca se usaría el tamaño del video.
- **Lo que corresponde:** crear el proyecto con `canvasSize` 1080×1920 y sin `relacion`. Leído en el código, sin correr.

**La prueba final, al desplegar:** Martín abre Video, Image y AI Avatar y no ve la charla de octubre, también después de contestar. Hasta entonces, CH1 sigue abierto.

## Cerrados o que esperan en otra rama

K1 a K5, P1, C3 y D4 (el botón de MaKo que tapaba y lo del Calendario) los cierra `recorrido-k-3010` @ 246bae899, que espera a
Calendario. Le faltan sus tests afectados. K1 y la casilla de K2 ya no existen con esa base; K4 es un dato de Google.

## Descartados: no eran problemas

- **Los «textos en inglés»** (U1, U2, D7 salvo «SUM», y lo que parecía en la 2.ª vuelta en Customers, Classroom, Settings y Agency).
  **El diagnóstico obvio era el equivocado:** es regla de Martín, «Nosotros siempre utilizamos nomenclatura en inglés»: tabs,
  features y títulos van en inglés; el copy, en español neutro. La cuenta de la 1.ª vuelta: 27 hallazgos, menos 8 que cierra `recorrido-k-3010`, menos U1 y U2 = 17 abiertos, los de la tabla.
- **«Para mirar 9 de 9 clientes»:** son 9 de 15 cuentas. «Todos 9» no cuenta a los 6 clientes de agencia.
- **Los dos botones «tapados» por la barra en el Ops Center** y los «Más acciones» de /chats: quedan abajo del pie o aparecen al pasar
  el mouse. La auditoría automática los marca y no son defectos.

## La imagen rota de una landing copiada (W2)

**Síntoma:** la landing #88 («Content Partner», copia de contentpartner.com.co) se veía con el logo y el hero rotos.

**Causa:** se pegó `…/inmersion` y el sitio redirige a `…/inmersion/`. Lo relativo (`kit-marca/x.webp`) se resolvía contra la
dirección pegada y perdía la carpeta de la página: 404. `htmlDePagina` no devolvía la dirección final, y `baseDeDocumento` usaba el
`canonical` y el `og:url` como sustitutos: esta página no tiene ninguno, y además el navegador nunca resuelve contra ellos.

**El arreglo (rama `recorrido-web-3010`):** `paginaConDireccion` devuelve la dirección final; Replicar, el estilo, el Diagnóstico y el
lector resuelven contra ella; el `canonical` y el `og:url` dejan de decidir. **Sin hacer:** correr los tests (quedó frenado por falta
de RAM, 4 aserciones actualizadas sin correr), medir de punta a punta con la página real (la prueba dio 0 imágenes: revisar la
prueba) y reparar la #88, que hoy sigue rota. De las 28 copias que hay, es la única con esta causa (la #70 dio error por un
falso positivo de la medición: su URL de `_next/image` tiene query).

## Trampas de un recorrido (para el próximo)

- ⚠️ **Antes de CADA tanda, `/api/auth/me`.** La extensión se conecta al perfil de Chrome que esté abierto: a las 15:19 volvió con el
  Profile 9, cuya sesión de MaKo es de un usuario de otro negocio (rol «usuario», ws10). Se notó por la barra y el avatar distintos,
  después de abrir dos pestañas de su Plan, sin escribir nada. Un recorrido sin esa pregunta da verde mirando otra cuenta.
- **El sitio no se deja embeber:** un iframe para ver otro ancho da `SecurityError`. `resize_window` contesta «ok» y no cambia nada
  con la ventana maximizada. Queda el emulador de la 1.ª vuelta (reescribe las media queries).
- **La ventana cambia:** 1536×730 en la 1.ª vuelta y 1707×811 en la 2.ª (DPR 1,25 y 1,125).
- **Una auditoría no reemplaza mirar, y mirar no reemplaza medir:** las imágenes rotas de la #88 no las vio el chequeo automático
  (viven en un iframe); se vieron en la captura y la causa salió de la base y de `curl`. Y antes de contar algo como defecto, leer la regla: lo del inglés
  y lo de la conversación del Cerebro eran decisiones.

---

# Apéndice: el texto de la primera vuelta (claude3), tal cual

Vivía en el scratchpad de su sesión. Los IDs de arriba son éstos.


Producción: https://hola-mako.com, en el Chrome de Martín con la sesión iniciada. Sólo se miró: no se guardó ni se publicó nada.

**Cobertura PARCIAL.** De los cuatro grupos se escribieron dos: `inicio.md` (incompleto) y `ventas.md`. **`create.md` y `resto.md` no existen.** De 22 chats dueños, se revisaron 8. El resto figura al final, en «Sin revisar».

**Anchos:** 1536×730 es el ancho real de Martín (pantalla 1920×1080 al 125 %). 1440, 1280 y 1024 se **emularon** dentro de la pestaña sólo en el grupo «ventas» (CRM, Dashboard, Calendario, Automations), siempre con 730 de alto. Lo de «inicio» se vio sólo a 1536.

**Capturas:** todas están en `C:\Users\marti\.claude\projects\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\4d1a09d4-c870-4075-94b3-7d1450a71bcc\tool-results\`. Abajo va sólo el nombre del archivo, sin el prefijo `mcp-claude-in-chrome-blob-`.

**Consola:** 0 errores de MaKo en todas las pantallas revisadas. El único error fue de la extensión SingleFile, que es ajena.

---

### ALTO: se rompe o no se puede usar (1)

#### Calendario
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| K2 | `/calendario`, en todos los anchos | El botón flotante de MaKo **tapa la casilla y el texto** de los calendarios de Google al pie del panel izquierdo («martinkoncke@gmail.com», «…stivos en Argentina»). Esa casilla **no se puede tocar**. En la vista «Llamadas» a 1024 tapa además «Venció: domingo…». *Reclasificado de MEDIO a ALTO porque deja un control inutilizable.* | `1793337525128-aytcfj.png`, `1793337601731-gsvi0q.jpg` |

---

### MEDIO: se usa, pero se ve mal o se lee mal (7)

#### Plan
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| P1 | `/plan/agencia`, pestaña Prioridades, a 1536 | El botón flotante de MaKo tapa el principio de la fecha de la tarjeta «Feature: CRM»: se lee «ie 7 oct · 23 días atrasado» en vez de «mié 7 oct». | `1793336366775-x22vvy.jpg` |

#### CRM
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| C1 | `/crm`, tablero, en todos los anchos | Tarjetas con **ícono de imagen rota** en vez de las iniciales: 16 de 42 caras en una recarga. El proxy `/api/whatsapp/evolution/mensajes?avatarimg=` da 404, el `<img>` queda visible y `span.tk-ini` sigue en `display:none`. En la primera carga sí aparecían las iniciales; en las recargas, no. Probablemente el `onError` se dispara antes de hidratar y se pierde. | `1793336757439-4k0406.png` |
| C2 | `/crm`, tablero, en todos los anchos (también a 1536) | Nombres y **teléfonos cortados con «…»**: un teléfono y dos nombres de leads (sacados de este documento). Hay 67 textos cortados a 1536. En un lead sin nombre, el teléfono hace de nombre y no se lee entero. La píldora «Ver info» le quita ancho. | `1793336748458-2e69fs.jpg` |

#### Dashboard
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| D1 | `/dashboard` (workspace de Martín) | **No hay ninguna hoja.** «Focus/General» y «Dashboard» abren los dos en «¿Qué vas a crear hoy?» y no aparece «Archivados». **A VERIFICAR con Martín:** si tenía hojas, se perdieron y esto pasa a ALTO. | `1793337100198-w6ee7o.jpg`, `1793337222805-ilbxe5.jpg` |
| D2 | `/dashboard`, editor, de 1536 a 1024 (revisado en ws=3, hoja «Prueba de TB3») | El panel de propiedades («Serie temporal») **flota encima del gráfico seleccionado** y le tapa la parte derecha: la curva, el final del eje y los botones ▽ y MaKo del bloque. A 1536 tapa un tercio del bloque; a 1024, la mitad. | `1793337425854-r43o4y.png`, `1793337453584-pe1phk.jpg` (1024) |

#### Calendario
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| K1 | `/calendario`, vista Semana, a 1024 | El panel izquierdo (el mini calendario y «Mis calendarios», unos 250 px) **no se pliega**. Las columnas de la semana quedan en unos 85 px y los eventos no se leen («Sp…», «9 – 9:», «Regenera…»). El título se corta: «Oct – nov de 2…». | `1793337554149-njw3lw.jpg`, `1793337565058-q1t3da.png` |

#### Automations
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| A1 | `/automations`, flujo abierto, a 1024 (justo en el límite a 1280) | El lienzo no encuadra el flujo: el segundo nodo (EMAIL / «MaKo en WhatsApp») queda **cortado contra el borde derecho** aunque se baje el zoom al 85 %. El título se corta: «Restablecer Contra…», «Se Cortó el WhatsA…». | `1793337690293-jaa7uk.jpg`, `1793337738242-nj4yxe.jpg` |

---

### BAJO: detalle visual, texto o idioma (19)

#### Ops Center
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| O1 | `/` con la sesión iniciada, a 1536 | Muestra la landing pública («Entrar», «Agenda tu llamada») en lugar del Ops Center, que vive en `/admin/operaciones`. **A confirmar** si es a propósito. | `1793336330681-kocg2v.jpg` |

#### Plan
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| P2 | `/plan/agencia`, tarjeta «Feature: CRM», a 1536 | Sobra espacio vacío: una franja degradada arriba y unos 200 px vacíos entre «OBJETIVO PRINCIPAL» y la fecha del pie. | `1793336366775-x22vvy.jpg` |

#### CRM
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| C3 | `/crm`, en todos los anchos | El botón flotante de MaKo tapa la última tarjeta visible de «Lead entrante» (la cara de un lead). | `1793337069850-za85n4.png` |
| C4 | `/crm`, menú ⋯ de una columna | En la sección «Columnas» hay dos flechas ← → sueltas, sin texto («Mover a la izquierda/derecha»). | `1793337056023-gkpl0g.png` |

#### Dashboard
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| D3 | `/dashboard`, editor, a 1024 | La barra de herramientas no entra y «Estilo de la hoja» cae sola a un segundo renglón. | `1793337463990-ro18dj.png` |
| D4 | `/dashboard`, en todos los anchos | El botón flotante de MaKo tapa la etiqueta «30/09» del eje del gráfico «Agendas»: se lee «09». | `1793337315995-lbzlss.png` |
| D5 | `/dashboard`, «Audiencia y alcance» | Hay tres tarjetas de unos 440 px de alto con una sola línea («Conecta Meta para ver tu audiencia»). A 1024, «Plataforma» queda en unos 210 px y el texto se parte. | `1793337379552-92ljb8.jpg` |
| D6 | `/dashboard`, miniaturas de plantillas | Hay botones dentro del botón «Usar la plantilla…» («Marcar cobrada la cuota de Ana Gómez», «Editar este OKR»). Toman el foco con Tab, y un clic ahí puede hacer otra cosa en vez de elegir la plantilla (no se probó). | (árbol de accesibilidad) |
| D7 | `/dashboard` | Textos en inglés: la pestaña «Focus», el botón «Templates», «SUM» en las métricas, «Ad Spend» y «Cash Collected» en las miniaturas. | `1793337415912-ugha68.jpg` |

#### Calendario
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| K3 | `/calendario`, Semana, desde 1536 (peor a 1280 y 1024) | Los eventos superpuestos cortan el texto sin «…»: «Go to Gym, 7», «Gym 7:30 – 8:45 a». | `1793337525128-v7mqub.png` |
| K4 | `/calendario`, sábado y domingo | Hay un bloque gris de 7:15 a. m. a 1 p. m. con el título «-» (un evento sin nombre). | `1793337525128-v7mqub.png` |
| K5 | `/calendario`, vista Llamadas | El panel «Tareas con fecha — Del Plan, las que vencen pronto» muestra tareas **vencidas** hace dos semanas (16/10, 18/10, 25/10): el subtítulo no dice lo que muestra. El centro queda casi vacío. | `1793337588159-da2mvn.jpg` |

#### Automations
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| A2 | `/automations`, disparador | Dice **«CRON»** en eventos que no son programados («Alguien pide restablecer su contraseña», «Se corta el WhatsApp de un negocio»). La etiqueta está mal y además en jerga. «EMAIL» también está en inglés. | `1793337662320-yojbps.png` |
| A3 | `/automations`, lista | El interruptor dice «Activar» cuando ya está encendido: no se sabe si está activa o si hay que activarla. | `1793337641842-20k2u3.jpg` |
| A4 | `/automations`, lista | Los nombres usan Mayúscula Inicial a la inglesa: «Se Cortó el WhatsApp de un Negocio», «Meta Frenó la Cuenta Publicitaria». | `1793337641842-20k2u3.jpg` |
| A5 | `/automations`, flujo abierto | El panel izquierdo pasa al chat de MaKo vacío: unos 550 px en blanco con «Pídele lo que quieras cambiar». | `1793337710698-0jr6u4.jpg` |

Nota, no es un defecto: «Restablecer Contraseña» abre con punto naranja y «Publicar» habilitado, o sea que tiene cambios sin publicar que no hizo el recorrido.

#### Web Generator (landing pública `/`)
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| W1 | `/`, reproductor del video, a 1536 | El cartel «Ya comenzaste a ver este video / Continuar viendo / Ver desde el principio» queda encima del título del video, que asoma detrás («…n Ticket»). | `1793336330681-kocg2v.jpg` |

#### UI compartida
| # | Dónde | Qué se ve mal | Captura |
|---|---|---|---|
| U1 | Barra lateral, en todas las pantallas | El link a `/calendario` se llama «Calendar», en inglés. Los otros links son nombres de producto, pero la ruta de este está en español. | — |
| U2 | Título de la pestaña del navegador | Aparecen «MaKo - Calendar» y «MaKo - Automations». Probablemente toman el mismo nombre que la barra lateral. | — |

---

### Lo que se repite en varias pantallas

1. **El botón flotante de MaKo tapa contenido: 5 hallazgos en 4 chats** (K2 ALTO, P1, C3, D4, más «Venció…» en Llamadas). Es un botón de 56×56 con `position: fixed` abajo a la izquierda, y el contenido no le reserva lugar. La causa probable es una sola, en el layout compartido: falta un `padding-bottom` o una zona libre en el contenedor principal, o el botón debería vivir dentro de la barra lateral. Si se arregla una vez en UI compartida, se cierran los cinco.
2. **Los paneles laterales de ancho fijo no se pliegan por debajo de unos 1280 px: 4 hallazgos** (K1, A1, D2, D3). El panel del calendario, el panel de chat de Automations, el panel de propiedades del Dashboard y la barra de herramientas mantienen su ancho a 1024, y el contenido central se queda sin lugar. Falta un breakpoint común que pliegue o superponga el panel.
3. **Textos cortados en tarjetas y títulos: 4 hallazgos** (C2, K3, A1, D5). Los anchos son fijos y no hay salto de línea ni tooltip. En K3 ni siquiera aparece «…».
4. **Inglés y Mayúscula Inicial: 6 hallazgos** (U1, U2, D7, A2, A4, C4 sin texto). Las etiquetas están escritas a mano en inglés en la navegación, las plantillas y los disparadores.
5. **Bloques enormes casi vacíos: 4 hallazgos** (P2, D5, A5, K5). Los estados vacíos ocupan todo el alto de la tarjeta o del panel.

---

### Sin revisar (no hay datos; no se inventa nada)

- **Faltan los grupos completos «create» y «resto»** (`create.md` y `resto.md` no se escribieron). Quedan sin mirar Copywriter, Video Editor (incluida la barra del reproductor de la captura de Martín), Image Editor, AI Avatar, Offer, Web Generator (la app; sólo se vio la landing pública), Ads Manager, Classroom, Clientes, Integraciones, Configuraciones, Agency, API y Planes.
- **Grupo «inicio» cortado:** no se cargaron el Ops Center (`/admin/operaciones`), Chats (`/chats`) ni Second Brain. De Plan sólo se vio Prioridades, sin bajar; faltan Tareas, Proyectos y Recurrentes. No se abrió el chat de MaKo y no se vio la barra lateral abierta.
- **Anchos:** el grupo «inicio» sólo se vio a 1536. En ningún grupo se probaron los altos de 900, 800 ni 768.

### Trampas del recorrido (para la próxima corrida)

- **La ventana de Chrome está maximizada:** `resize_window` responde «Successfully resized», pero no cambia nada y el área visible queda siempre en 1536×730. Para medir otros anchos hay que sacarla de maximizada a mano o emularlos dentro de la pestaña, como se hizo en «ventas» con `C:\Users\marti\AppData\Local\Temp\claude\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\4d1a09d4-c870-4075-94b3-7d1450a71bcc\scratchpad\recorrido\emular-ventas.js`.
- **El bloqueo de permisos cortó el recorrido.** El pedido que lanzó la corrida fue «Dame la investigacion de gmail», que no se parece a un recorrido de la app. Por eso el clasificador bloqueó la navegación después de `/plan`. Es muy probable que por la misma razón falten `create.md` y `resto.md`.
- **El registro de la consola empieza después de la carga:** los errores de la carga inicial no quedan registrados.
