# Diseño · Los pedidos sueltos en los chats de MaKo (`lib/mako-pedidos`)

Pedido de Martín (16/10/2026), textual, por el coordinador «Cerebro»:

> «En el chat de MaKo en Automations, como en general esto en todos los chats... Si hablo con un "sub-chat" y en algún
> momento le digo algo como "Quiero eliminar la otra automatización que tengo porque podría unificarla..." Que sepa como
> hacerlo, y a que automatización se refiere incluso sin nombrarla, interpretandolo y de última preguntando... Y si en
> cualquier momento, por ejemplo, estoy creando una automatización, o un dashboard, una web, o lo que sea y le digo algo
> como "Feedback sobre lo actual... Y luego <y también quiero que me crees otra landing para mi otro producto...>" ahí
> debe saber interpretarlo y llamar a la función para crear otra landing, e incluso proponerle "¿Quieres que primero
> terminemos esto y luego creamos la otra landing?..." o cosas así... Es más incluso si se está trabajando en una tab y
> se envía un mensaje totalmente diferente, relacionado a otra tab, que el chat le deje ahí en el chat el link para ir a
> donde corresponde. Esto se logra teniendo el "Second Brain" con todo, y la API de MaKo, que facilita que todos tengan
> contexto de todo, en todo momento.»

Decidido por el coordinador (16/10, no se re-pregunta):
1. Un módulo en `lib/` que, dado el mensaje, la tab y el objeto abierto, separa el mensaje en pedidos y dice de cada uno:
   es sobre lo ACTUAL / sobre OTRO objeto de esta tab (y cuál: con la lista de objetos del negocio, el nombre, lo último
   que se tocó y lo que dice el mensaje; con dos candidatos, pregunta con las dos opciones) / es de OTRA tab (su link y,
   si la API de MaKo tiene la acción, la acción). Las acciones salen del REGISTRO de la API de MaKo, nunca de una lista
   propia.
2. Con dos pedidos: se contesta el de lo actual y se propone el otro («¿Terminamos esto y después creamos la otra
   landing?»), con botones Sí / Después. Borrar algo SIEMPRE pide confirmación.
3. Primero en el chat del Web Generator; después Automations engancha su chat (punto de enganche simple y documentado,
   abajo).
4. IA: la red de texto que ya existe, sin crédito de Claude (Martín lo dejó sólo para el onboarding). Si el mensaje trae
   datos de leads, nunca un gratis que entrena (`pii` de `chatCheapCascade`).
5. Tests con los ejemplos de Martín tal cual, probados rompiéndolos. El diseño «AI native» del Centro de Operaciones
   (`docs/diseno-mako-ai-native.md`) no existía el 16/10: esto entra como una pieza de él.

## Las piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| El núcleo PURO | `lib/mako-pedidos.ts` (sin `server-only`, sin valores del registro) | `partirPedidos(texto)` separa con reglas; `resolverPedidos(crudos, ctx)` decide de cada uno qué es, qué objeto, qué operación, el link, si confirma, y arma la propuesta |
| La IA | `lib/mako-pedidos-ia.ts` (`server-only`) | `partirConIA(texto, ctx)`: SÓLO separa y etiqueta (verbo, área del catálogo `AREAS`, la frase que nombra el objeto). Nunca decide el objeto ni la acción |
| El orquestador | `lib/mako-pedidos-ia.ts` → `interpretarMensaje(texto, ctx)` | reglas → IA sólo si las reglas dudan → resolver |
| La ruta compartida | `app/api/mako/pedidos/route.ts` (POST, con sesión; NO es pública) | arma el contexto (la vista de la persona, las operaciones VISIBLES del registro, los objetos de la tab) y devuelve la interpretación |
| El chat del Web Generator | `app/web-generator/editor/paneles/PanelAgente.tsx` | antes de «editar con IA», interpreta; lo actual sigue por el camino de siempre y el resto se propone |

## El contrato (`lib/mako-pedidos.ts`)

```ts
type ObjetoChat = { id: string; nombre: string; tocadoAt?: string | null };
type OperacionChat = { id: string; area: Area; tipo: 'lectura' | 'accion'; titulo?: string; descripcion: string };
type ContextoPedidos = {
  tab: Area;                          // el área del chat: 'landing' en el Web Generator, 'chatbot' en Automations
  actual?: ObjetoChat | null;         // lo abierto (la landing del editor, la automatización del lienzo)
  objetos?: readonly ObjetoChat[];    // los objetos de ESTA tab del negocio (para «la otra», «la de Juan»)
  operaciones: readonly OperacionChat[]; // las del registro VISIBLES para esta persona (gatingOk / visible)
  ws?: number | null;                 // para el link (`conWs`, que pega el ?ws=)
  ordenar?: (ops, texto) => ops;      // `ordenarPorRelevancia` del registro, INYECTADO (es un valor del registro)
};
type Verbo = 'crear' | 'borrar' | 'editar' | 'ver' | 'otro';
// `etiqueta`: quién puso el ÁREA. 'ia' (validada) se toma tal cual; 'reglas' (el default) se trata con prudencia.
type PedidoCrudo = { texto: string; verbo: Verbo; area: Area | null; referencia: string | null; etiqueta?: 'reglas' | 'ia' };
type PedidoResuelto =
  | { sobre: 'actual'; texto: string }
  | { sobre: 'otro'; texto: string; verbo: Verbo; objeto: ObjetoChat | null; candidatos: ObjetoChat[];
      operacion: string | null; confirmar: boolean; pregunta: string | null }
  | { sobre: 'nuevo'; texto: string; operacion: string | null;           // crear otro de esta MISMA tab
      producto?: { objeto: ObjetoChat | null; candidatos: ObjetoChat[]; pregunta: string | null } }  // la ruta
  | { sobre: 'otra-tab'; texto: string; area: Area; titulo: string; link: string; operacion: string | null; confirmar: boolean };
type Interpretacion = {
  pedidos: PedidoResuelto[];
  propuesta: { texto: string; botones: readonly ['Sí', 'Después'] } | null;
  origen: 'reglas' | 'ia';
};
// y: partirPedidos(texto) · resolverPedidos(crudos, ctx, { origen, texto }?) · dudaDeLasReglas(crudos, ctx)
//    leerRespuestaIA(raw, texto, tab) · llevaDatosPersonales(texto, tab) · interpretarCon(texto, ctx, pedirIA?)
```

Reglas del resolver (código, no IA):
- **El área** de un pedido, según las reglas: la del OBJETO DIRECTO del verbo («crees otra LANDING», «agéndame una
  REUNIÓN»); si no, la primera nombrada después del verbo (`AREA_KEYWORDS`, sobre el texto y sobre el texto sin tildes);
  sin área nombrada, la de la tab. ⚠️ **Área ≠ tab NO alcanza para irse a otra tab** (cambiado al construir): `AREA_KEYWORDS`
  es ancha a propósito —se hizo para sumar herramientas, donde sobrar es barato— y en el chat del Web Generator «cambia el
  precio» nombra `negocio`, «quita el video» nombra `video` y «un formulario para leads» nombra `crm`, y los tres son cambios
  de la landing abierta. Con las reglas solas, va a `otra-tab` sólo si es FUERTE: el verbo CREA un objeto de esa área (su
  objeto directo), o no hay nada abierto. Lo demás va a lo actual (lo que el chat hacía antes: cero regresión) y cuenta
  como duda, así que entra la IA. Si la IA etiquetó el área (validada), se toma tal cual. Link: `AREA_INFO[área].ruta`.
- **La operación** sale del registro, por el verbo y el área: crear → `crear_*` / `generar_*` / `agendar_*` (con
  `proponer_` adelante cuenta: `proponer_agendar_reunion`); borrar → PRIMERO lo reversible (`mandar_*_a_papelera`,
  `archivar_*`) y sólo si no hay, `borrar_*` (memoria «Cerrar no es borrar»); editar → `cambiar_*` / `editar_*` /
  `configurar_*`; ver → `ver_*` / `listar_*` (sólo lecturas; los demás, sólo acciones). Entre varias, la de más relevancia
  con el texto (`ordenarPorRelevancia` del registro, que llega INYECTADA en `ctx.ordenar`: el núcleo no importa valores del
  registro). Sólo de las que la persona VE. Sin ninguna, `operacion: null` (queda el link).
- **El producto de un pedido nuevo** («para mi otro producto», `productoDelPedido`): la ruta lee los productos activos
  del catálogo (`listProductos(true)`) sólo si hay un pedido `nuevo` y para el admin, y le agrega `producto` al
  pedido: el que el texto nombra, o `candidatos` (los primeros 4) y la pregunta «¿Para cuál producto?» si dice
  «producto» sin nombrarlo; con uno solo, ése, salvo «otro producto». El chat del Web Generator pregunta y escribe el
  elegido en el pedido de Crear con IA. Un `producto` roto no tira la respuesta.
- **Nuevo vs. cambio**: crear con objeto directo de ESTA tab («créame otra landing») es `nuevo`; «crea una sección» es un
  cambio de lo abierto. ⚠️ **Las PARTES de lo abierto son por TAB, no por área** (`PARTES_DE_LO_ABIERTO`):
  `AREA_KEYWORDS` dice de qué área es una palabra, pero si nombra otro objeto o una parte del abierto depende de dónde se
  dice. Web Generator: «página» (un sitio tiene páginas, «Añadir página»). Image Editor: «página» también (un diseño
  tiene páginas, como Canva), y ahí la palabra es de OTRA área (`landing`): sin esto «crea otra página» en un diseño se
  iba al Web Generator. Dashboard: «gráfico», «métrica» (una hoja los tiene). General: además «tarea», «proyecto»,
  «prioridad», «deadline», «KPI», «objetivo», «meta», «semáforo», «agenda», «cobro»… — sus bloques son VISTAS de otras
  tabs (lib/general-piezas.ts): sin esto «agrega un bloque de tareas» en General mandaba al Plan, y «tareas» es justo
  lo que la IA etiqueta como otra área (está en el test con `origen: 'ia'`). Video Editor: «clip», «escena». Dentro de su
  tab no crean otro objeto, no borran lo abierto, no son «la otra» ni mandan a otra tab (aunque la IA etiquete la otra
  área); fuera de ella sí cuentan («créame otra página» en Automations es una landing del Web Generator).
- **El objeto** («la otra», «la anterior», «la de Juan», un nombre entero o entre comillas): sin el actual; un nombre que
  calza → ése; «la otra» con UN solo otro → ése; con dos o más → los DOS más recientes (`tocadoAt`) en `candidatos` y una
  `pregunta` («¿Cuál: «X» o «Y»?»); sin ninguno, «¿Cuál? Dime su nombre.». «Otra X» sólo cuenta si X es la palabra de esta
  tab («otra sección» en el editor es una sección de la landing abierta). Nunca se elige el primero de una lista ambigua.
- **Borrar siempre confirma** (`confirmar: true`), aunque el objeto esté claro, con la pregunta según la operación
  («¿Archivo «X»?», «¿Mando «X» a la papelera?»). Borrar lo ABIERTO («elimina esta landing») también sale como `otro`
  con el actual de objeto: el camino de siempre del editor no borra.
- **La propuesta**: si hay un pedido `actual` y otro que no lo es, `propuesta = «¿Terminamos esto y después <lo
  otro>?»` con Sí / Después («creamos otra landing», «agendamos una reunión», «vamos a CRM»). Sin pedido actual, no hay
  propuesta: lo otro se contesta directo (el link o la pregunta). Los pedidos sobre lo actual se juntan en UNO; si todo es
  de lo actual, va el mensaje entero.

## Cuándo entra la IA

Las reglas cubren lo común (un conector «y también», «y luego», «y después», «además», «otra cosa», un salto de línea; un
área nombrada; un verbo de borrar o crear). «y + verbo» NO separa: «Crea otra landing y ponle el título X» es un pedido
sobre la landing nueva. La IA entra SÓLO si las reglas dudan (`dudaDeLasReglas`): un pedido con dos áreas nombradas; uno
que nombra otra área pero puede ser un cambio de lo abierto (esto cubre «un verbo que no reconocen»: sin otra área
nombrada, un mensaje sin verbo conocido es de lo actual y no duda); o dos verbos distintos sin conector cuando hay algo más
que lo actual en juego. Un mensaje sin ninguna señal de otra cosa no gasta una llamada.

La IA sólo etiqueta, y `leerRespuestaIA` valida: un `texto` que no está en el mensaje la descarta entera; un verbo o un área
que no existen caen a las reglas de ese pedido; un área que el pedido no nombra (ni es la de la tab) no se acepta; una
`referencia` que no está en el pedido cae a la de las reglas; cualquier id u «objeto» que mande se ignora.

Plazo: 7 s en total (7,5 s con la carrera), intentos de 4 s; el chat del Web Generator espera 12 s a la ruta
(`PLAZO_PEDIDOS_MS`), que antes lee la sesión, la vista y las landings. ⚠️ **No va por `chatCheapCascade`** (cambiado el
16/10 tras mirarlo en producción): su preámbulo (las cuotas del día y la clave de Anthropic del negocio, ~3 s) y su
mínimo de 15 s por intento se comían el plazo y la IA no corría NUNCA. Va un bucle propio, `probarEnOrden` (núcleo puro,
con un test de reloj falso): las keys del negocio en orden, cada intento acotado a lo que queda. Si no llega, quedan las
reglas (`origen: 'reglas'`). Feature propia `mako-pedidos` en `lib/model-catalogo.ts`, default GRATIS (Groq
`gpt-oss-120b`), lista `groq → gemini → openrouter → mistral` con el pin de /modelos-ia primero si es gratis. Medido en
ws9: Groq 1,4 s, Gemini 6,6-10,9 s; de punta a punta, 3-5,5 s.

⛔ **Sin crédito de Claude** — y por eso NO `redDePlataforma` de `chatCheapCascade` (cambiado al construir): desde el
16/10 esa red prueba PRIMERO el crédito de Claude de la plataforma (`conCreditoDeLaPlataforma`), así que pedirla era
pedir Claude. La red va aparte, sólo con las keys gratis de la agencia (`provsGratisDePlataforma`), como Offer. La clave
PROPIA de Anthropic del negocio está permitida (decisión A de Martín, la paga el negocio), pero desde que no se usa la
cascada no se prueba acá: para etiquetar en segundos sólo sumaba 1,3 s.

`pii` (`llevaDatosPersonales`): un email, un teléfono, o una tab de leads (`crm`, `chats`, `whatsapp`, `closing`,
`cobros`). Con `pii` la red gratis no corre (el plan gratis de Gemini entrena) y quedan las reglas.

## El punto de enganche (para Automations y cualquier chat nuevo)

```ts
// en el cliente, ANTES de mandar el mensaje al modelo del chat:
const r = await fetch('/api/mako/pedidos', { method: 'POST', body: JSON.stringify({ texto, tab: 'chatbot', actualId, actualNombre }) });
const { ok, pedidos, propuesta } = await r.json(); // ok:false (400/401/429) → seguir con el mensaje entero, como siempre
// 1. lo `actual` va a su camino de siempre (sólo su texto);
// 2. el resto se dibuja como burbuja de MaKo: `otra-tab` con su link, `otro` con su pregunta/confirmación,
//    `nuevo` con la propuesta y los botones Sí / Después.
```

Los objetos de cada tab los resuelve la ruta (`objetosDeTab`), una función por área y cada una con la MISMA puerta que su
pantalla (sin eso, alguien leería por acá los nombres de lo que su pantalla le esconde). Un chat nuevo agrega la suya:

| Área (tab) | Objetos | Fuente | Puerta |
|---|---|---|---|
| `landing` (Web Generator) | las landings, sin las de la papelera, la última tocada arriba | `listar()` de lib/editor-landing/server.ts (la del Panel) | admin y `landing-writer` en la capa |
| `imagen` (Image Editor) | los diseños, sin los borrados, el último editado arriba | `listarDisenos(ws)` de lib/image-editor/server.ts (la del inicio del editor) | `veEditorImagen()` (admin y la tab en la capa) |
| `metricas` (Dashboard) | las HOJAS del informe de QUIEN MIRA (es por persona), en el orden de sus pestañas | `leerTablero()` + `hojasVisibles` | admin y `graphics` en la capa; quien nunca guardó un informe ve la pantalla sin páginas → [] |
| `general` (General) | las hojas del informe de General de quien mira, en el orden de sus pestañas | `leerInformeGeneral()` + `hojasVisibles`, sólo si `estado === 'propio'` | admin y `general` en la capa (la del guardado de General en `/api/graficos`: quien no la pasa no edita ahí); sin informe propio → [] |
| `chatbot` (Automations) | las automatizaciones sin archivar, la última tocada arriba | `nutricion_secuencias` con `getTenantDb` (lo que muestra su lista) | admin y setter (la de GET /api/chat-agent/secuencias) |
| `video` (Video Editor) | sus proyectos | los manda el NAVEGADOR (`objetos` del cuerpo) | — (son suyos) |

⚠️ **El Video Editor no tiene de dónde listarse en el servidor**: sus proyectos viven en IndexedDB (decisión 5 de su
diseño). Para las tabs de `TABS_CON_OBJETOS_EN_EL_NAVEGADOR` (hoy sólo `video`) la lista la manda su chat y la ruta la
valida (`objetosDelNavegador`: forma, sin repetidos, nombres cortados, tope de 200); en las demás, lo que mande el
navegador se ignora. Son SUYOS y sólo vuelven a él (una pregunta o un link): no se ejecuta nada con ellos ni van a la IA.
Su chat los arma así:

```ts
const objetos = (await storageService.loadAllProjectsMetadata())
  .map((p) => ({ id: p.id, nombre: p.name, tocadoAt: p.updatedAt.toISOString() }));
fetch('/api/mako/pedidos', { method: 'POST', body: JSON.stringify({ texto, tab: 'video', actualId: proyecto.id, actualNombre: proyecto.name, objetos }) });
```

El área `video` es también la del Video Generator: su chat, si se engancha, no manda `objetos` y queda con [].
Automations (`chatbot`) engancha la ruta y dibuja las burbujas en app/automations/pedidos-chat.ts: «Eliminar» es
ARCHIVAR, como el «⋯» de la lista, siempre con confirmación.

El link es RELATIVO con `?ws=` (`conWs`, lib/ws-tab.ts, isomórfico): el chat está adentro de la app. `linkPantalla`
(lib/api-mako/link.ts) no sirve acá: importa lib/workspace (server-only) y arma el link absoluto de los que salen de la app.

Las operaciones salen de la vista de la persona: `vistaDe` con canal `app` y alcance `proponer` (como el chat de la app),
y `REGISTRO.filter(visible)`. Las ACCIONES del registro son siempre propuestas que confirma una persona; `confirmar` del
pedido es además la pregunta del chat antes de proponer.

## Lo que falta

El chat del Web Generator ya está enganchado (`PanelAgente.tsx` + lo puro en `app/web-generator/editor/pedidos-chat.ts`,
tests en `tests/editor-landing-pedidos-chat.test.ts`): lo actual sigue a «editar» como siempre y el resto son burbujas de
MaKo. «Crear» (el Sí de la propuesta, o «Crear ahora» después de «Después») abre Crear con IA en Plan con el pedido
escrito, por el camino de la caja del Panel (`tomarCaja`, sessionStorage, nunca la URL). ⚠️ «Sí» a «¿Terminamos esto y
después…?» quiere decir PRIMERO esto: si el cambio de la landing abierta sigue sin aceptar ni descartar, la burbuja
espera («Al terminar esto, la abro.») y la creación se abre sola al terminarlo (`sinTerminar`, `alTerminar`). Abrirla
en el acto se iba del editor con el cambio a medias. Borrar OTRA landing confirma y
la manda a la Papelera (se restaura); la ABIERTA nunca se borra desde el chat: se dice dónde está «⋯ › Eliminar». Si la
ruta falla o tarda más de `PLAZO_PEDIDOS_MS`, el mensaje entero va a «editar», como antes.

«Editar con MaKo» del **Dashboard y General** también (16/10): `PanelEditarMako.tsx` + lo puro en
`app/dashboard/pedidos-hoja.ts`, tests en `tests/dashboard-pedidos-chat.test.ts`. Lee la respuesta con las MISMAS
`interpretacionDe` / `textoActual` del Web Generator; lo de la hoja abierta va a `/api/graficos/editar` como siempre y lo
demás son burbujas: crear OTRA hoja (la arma `/api/graficos/ia` con el pedido y entra por `crearHoja` del editor),
abrir otra hoja, archivar otra hoja (confirma; `eliminarHoja`, con su Deshacer), «¿Cuál?» con las dos candidatas, y el
link de otra tab. A diferencia del Web Generator, «Sí» crea en el acto: el cambio de la hoja abierta ya se aplicó cuando
aparece la burbuja (se deshace con su botón), así que no queda nada a medias que esperar.

- **Image Editor y Video Editor**: sus objetos ya están (16/10); falta que sus chats llamen a la ruta (el del Video
  Editor, mandando `objetos`).

- **Video Editor**: enganchado el 16/10 (`app/video-editor/_opencut/chat/pedidos.ts` + `PanelChat.tsx`, test
  `tests/video-editor-pedidos-chat.test.ts`): manda sus proyectos como `objetos`; lo del proyecto abierto va a su IA y
  lo demás son burbujas con link. Borrar un proyecto NO se hace desde el chat (no hay papelera: se va con su
  material); la burbuja dice dónde. Y «proyecto», que es palabra del Plan, ahí es otro video (`OBJETOS_DE_LA_TAB`).
- **Image Editor y Dashboard**: sus objetos ya están (16/10); falta que sus chats llamen a la ruta. ⚠️ El Image Editor
  todavía NO TIENE chat (es la etapa 4 de docs/diseno-mako-ai-native.md): hay que construirle uno antes de engancharlo.

- **Automations**: su función en `objetosDeTab` y el fetch de arriba en su chat. **16/10/2026: hecho en la rama
  `wip/automations-pedidos`, SIN SUBIR**: la revisión encontró regresiones del chat de siempre, varias del resolver
  (con el lienzo vacío, «crea una automatización» es de ESTA; un nombre de otra dentro de una edición no es un pedido
  aparte). Detalle en docs/hallazgos-chatbot.md («Los pedidos sueltos en el chat de Automations»).

- **Image Editor**: sus objetos ya están (16/10); su chat («MaKo IA», 16/10: `app/image-editor/mako/chat/acciones.ts`,
  `pedirEdicion`) todavía no llama a la ruta: se engancha como el del Video Editor, antes de su IA, con `tab: 'imagen'`
  y los diseños del server (no hace falta mandar `objetos`).

- **El chat único del Second Brain** (Centro de Operaciones): el mismo fetch con `tab` = el área de lo que esté abierto.
- **Correr la operación de OTRA tab** desde la burbuja: hoy `otra-tab` deja el link (y la operación como dato); ejecutarla
  pasa por el registro (`ejecutar.ts`), que propone y confirma como siempre.
