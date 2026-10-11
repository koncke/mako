# Hallazgos — MaKo Mobile (/m, la PWA del teléfono)

Lo que no se ve leyendo el código de `app/m/`, `lib/movil-*`, `lib/push*`, `lib/mako-turno-app*`,
`public/sw.js` y las extracciones que comparte con escritorio. Las decisiones y la spec están en
[diseno-mako-mobile.md](diseno-mako-mobile.md); el pedido textual, en `/admin/dev/mako-mobile`.
Corrida del 11/10/2026 (relevo de 7 agentes + 11 de implementación + 1 revisión adversarial).

## Lo que más cuesta redescubrir

- **El manifest abría la LANDING de venta a la persona logueada.** `start_url: '/'` y la raíz es la
  landing pública desde que el repartidor se mudó a `/inicio`. Se cambió a `/inicio` con `id: '/'`
  fijo: sin `id`, el id ES el `start_url`, y cambiarlo convierte la app instalada en «otra app» para
  Chrome. En iOS el ícono ya agregado congela el manifest viejo: hay que volver a agregarlo.
  **Vive en:** app/manifest.ts
- **`/m` no se puede salir del layout raíz** (no hay route groups): se apaga el cromo de escritorio
  sumando `esRutaMovil(p)` a `esVistaSinChrome`, nunca a `isPublicLandingPath` (ésa significa
  «público» y apaga los pollers). Y **nunca `startsWith('/m')`**: atrapa `/mako`, `/marketing`,
  `/mensajes` y la ruta PÚBLICA `/m.js` del Pixel. **Vive en:** lib/movil-rutas.ts,
  app/_components/PublicRouteGate.tsx
- **La home es `/m/hoy`, no `/m`**: Next redirige `/m/` → `/m` (trailingSlash false) y un scope
  `'/m/'` no cubre `/m`. `/m` sólo reparte. **Vive en:** app/m/page.tsx
- **Los guards de escritorio sacan al usuario de la app**: `requireRolWs`, `requireCapa` y
  `guardOnboarding` redirigen a `/crm`, `/plan` y `/onboarding`. En `/m` va `requireMovil` (los
  mismos predicados, destinos `/m`) en CADA página: los layouts no se re-ejecutan al navegar.
  **Vive en:** lib/movil-guard.ts
- **`black-translucent` obliga a un header OSCURO**: iOS pinta reloj y batería en blanco sobre lo
  que haya debajo. `env(safe-area-inset-*)` vale 0 sin `viewportFit: 'cover'`. **Vive en:**
  app/m/layout.tsx, app/m/m.css
- **«Háptica = navigator.vibrate» deja al iPhone sin háptica**: en iOS no existe. El patrón que anda
  (web-haptics) es un click sincrónico a un `<input type=checkbox switch>` oculto (iOS 18+).
  **Vive en:** lib/haptico.ts
- **La campanita no existía**: la tabla `notificaciones` (mig 0048) nunca se aplicó y
  `crearNotificacion` se tragaba el error; además no tenía `workspace_id` (aplicada tal cual le
  mostraba a cada cliente los avisos de todos). Ahora es la 0250, con workspace y leído por persona
  (marca de agua en `usuarios.perfil`). Los avisos son de admin, en el feed y en el push.
  **Vive en:** lib/notificaciones.ts, app/api/notificaciones/route.ts
- **Una suscripción push se ata a la PERSONA, no al workspace de la pestaña**: un super admin con
  `?ws=N` habría recibido en su celular los avisos del cliente que miraba. Y al cambiar de cuenta en
  el mismo teléfono la suscripción seguía siendo de la anterior: se re-ata al abrir el shell y se
  suelta al cerrar sesión desde /m (el logout del Sidebar de escritorio todavía NO la suelta).
  **Vive en:** app/api/push/suscripcion/route.ts, lib/push-cliente.ts, app/m/_ui/ShellM.tsx
- **El par VAPID NO se regenera nunca en runtime**: regenerar una fila ilegible (otro
  `CREDENCIALES_SECRET`) invalida todas las suscripciones. Se generó UNA vez por script,
  insert-if-absent, en el workspace de plataforma (`envCred` resuelve contra el ws1, un cliente).
  **Vive en:** scripts/push-vapid-generar.mts, lib/push.ts
- **`?ws=` con el propio workspace es impersonación para un admin global**: un push a Martín con
  `?ws=9` le abría el plan vacío (el tablero de cliente). Los links al workspace de plataforma salen
  sin `?ws=`. El diagnóstico obvio («todo link que sale lleva `?ws=`») era el equivocado para ese
  caso. **Vive en:** lib/push-payload.ts (`wsDelLink`)
- **Un aislamiento por persona sobre una tabla compartida se cae por la ruta vieja**: los chats del
  teléfono son por persona (`mako-movil:<persona>`), pero `chart_sessions` también la leen por id
  `/api/chart-insights` y `/api/mako-doer` (ids correlativos): un closer leía los chats del dueño.
  Al restringir filas, grep de TODO lo que lee o escribe esa tabla por id. **Vive en:** lib/chart-chats.ts
- **Un default de límite silencioso convierte un conteo en mentira**: `listPropuestasPendientes()`
  sin argumento topa en 8, y el teléfono decía «8 borradores» con 133. **Vive en:** lib/plan-hoy.ts
- **El parche de fetch (WsFetch) no cubre `XMLHttpRequest`**: la subida con progreso del chat le
  pega el `?ws=` a mano. **Vive en:** app/m/mako/
- **La imagen NO llega a Gemini como bloque por chatCheapTools** (medido): se lee antes con el lector
  compartido y su texto entra al turno; lo leído no queda en la memoria del chat (sólo el
  placeholder). **Vive en:** lib/mako-adjuntos.ts
- **Infra: un `next dev` lanzado en segundo plano por esta corrida quedó huérfano, llegó a 8 GB y
  tumbó la app de Claude con 7 chats** (el diagnóstico, en docs/hallazgos-infra.md). Desde entonces el
  vigía mata los `next dev` grandes; al reintentar, mató el mío a los 4 GB compilando `/m/hoy` con
  750 MB libres. Consecuencia: **ninguna pantalla de /m se renderizó antes del deploy**, y salió con el
  reparto de teléfonos apagado (`MOVIL_ACTIVO = false` en lib/movil-desvio.ts).
- **tsc salta todo el chequeo de tipos si cualquier archivo tiene un error de SINTAXIS** (TS1005):
  «los errores son de otro archivo» no prueba que lo tuyo compile. Con errores semánticos (TS2304) el
  resto sí se chequea.

## El rediseño v2 (11/10/2026, tarde): lo que el relevo midió

Diseño y prototipo en [diseno-mako-mobile-v2.md](diseno-mako-mobile-v2.md) (tres lectores sobre las
pantallas de escritorio; nada implementado todavía).

- **«El editor de video estilo CapCut (/video-generator)» no está en `/video-generator`.** La lectura
  obvia del pedido manda a diseñar sobre un editor que en `main` no existe: ahí hay un wizard de tomas
  (`PasoTomas.tsx`). El CapCut vive en la rama `video-editor` (`C:/dev/wt-video-editor`) y el editor
  tipo Gamma en `wt-gamma`; los dos sin mergear. Antes de diseñar una versión reducida de algo, se
  mira qué hay en `main`. **Vive en:** app/video-generator/, app/landing-generator/
- **El verde y el rojo de la casa no sirven como TEXTO chico**: `--good` da 3,45:1 y `--bad` 4,26:1
  sobre blanco (AA pide 4,5), y `--primary` da 4,20:1 sobre `--bg`. En el teléfono el color va en la
  marca (punto, flecha) con el texto en tinta, y los links sobre `--bg` en `--primary-strong` (5,27).
  **Vive en:** app/globals.css
- **Un header claro invierte el hallazgo de `black-translucent`**: con el header claro va `default`
  (texto oscuro) y `themeColor` claro; en iOS instalada `default` pinta su propia franja, que hay que
  mirar en un iPhone contra `--bg`. **Vive en:** app/m/layout.tsx
- **Ads Manager no tiene propuestas de MaKo para aprobar** (son de Meta) y **Automations no muestra
  números** (están en `/chat-analyst`): un diseño que los dé por existentes inventa trabajo de
  backend. **Vive en:** app/ads-manager/, app/automations/, app/automations/DashboardChatAgent.tsx
- **`chrome --headless --window-size=390,844 --screenshot` NO mira un teléfono: diagnostica un
  desborde que no existe.** Chrome en Windows topea el ancho de la ventana en ~500 px; la página se
  arma a 500 (y el `@media (max-width: 520px)` igual aplica, así que no se nota) y la captura sale
  recortada a 390. Medido el 11/10 sobre el prototipo: las tarjetas cortadas en el borde derecho y
  la barra con 4 de sus 5 destinos, sobre una página que a 390 de verdad mide 390 justos. Para mirar
  a ancho de teléfono va `Emulation.setDeviceMetricsOverride` por CDP (molde: el puente `mirar.mjs`
  de `verificar-en-navegador`), y la medición que lo confirma es `document.documentElement.scrollWidth`
  contra `innerWidth`, no la captura. **Vive en:** docs/prototipos/mako-mobile-v2.html

## Lo que quedó sin hacer

- **Implementar la v2** (barra Today · CRM · Inbox · Plan · More, header claro con título grande, las
  diez secciones): espera las tres respuestas de Martín al final de diseno-mako-mobile-v2.md. Suma el
  token `--m-titulo` (32 px) y dos íconos al set (bandeja, computadora).
- **Un teléfono que abre una pantalla de escritorio la ve con el Sidebar en miniatura** (la captura de Martín del 11/10): eso es lo que tapa <DesvioMovil>, inerte hasta prender MOVIL_ACTIVO. Y antes de prenderlo, la revisión tab por tab de /m en un teléfono.

- **Ver /m funcionando en producción y prender `MOVIL_ACTIVO`** (lib/movil-desvio.ts). Ninguna
  pantalla se miró en un navegador; tampoco /general, /plan/agencia y /mako/pendientes después de las
  extracciones (revisadas por diff, no por pantalla).
- **Medir en un iPhone y un Android reales**: la voz (SpeechRecognition en una PWA standalone), el push
  (activar dentro del toque, iOS 16.4+ instalada), instalar, el teclado con el composer, los gestos del
  sheet y del mic, la háptica.
- El logout del Sidebar de escritorio no suelta la suscripción push (sólo el de /m).
- lib/mako-intencion.ts (ACCION_CUENTA_RE) no reconoce imperativos con tú («mueve», «pausa»): el chat
  del teléfono no propone mover etapas con copy neutro. Afecta también a WhatsApp.
- lib/api-mako/ejecutar.ts:184 escribe la instrucción de WhatsApp («confirmen con un sí») para todos
  los canales; el teléfono la reemplaza con `conInstruccionDeTarjeta`.
- `tarjetaDePendiente` (lib/mako-turno-app-reglas.ts) repite la decisión de `aFila`
  (lib/bandeja-filas.ts): que la llame.
- Faltan íconos en app/_components/icons.tsx (más, enviar, cámara, foto, archivo, candado, calendario,
  compartir): app/m/mako/iconos.tsx los dibuja aparte.
- Today (app/m/hoy/FilasPlan.tsx) tiene su propia fila del plan; /m/plan tiene ListaPlan y CheckTarea.
- Los leads quietos son una segunda lectura en lib/crm-movil.ts (copia de lib/lead-quieto-aviso.ts).
- Latencia del chat: gemini-flash-latest cortó o dio 503 y rotó a flash-lite (23-108 s por turno).
- `setNotifPush` y `setNotifVistoHasta` reescriben el perfil sin comparar: dos guardados pueden pisarse.
- El proyecto «Feature: MaKo Mobile» no existe en el tablero del dueño.

## Las trampas que midieron los agentes, por área

Tal como las devolvieron (síntoma → causa · dónde · regla). Son la materia prima de lo de arriba.


### Shell y PWA
- **Un test que dice «coincide con el ua-parser de Next» no podía correr desde el scratchpad: «Cannot find package 'next'».** → Un .mts en el scratchpad resuelve los paquetes desde su propia carpeta, no desde el repo. · tests/movil-dispositivo.test.ts (importa userAgentFromString de next/server) · REGLA: Lo que importa paquetes del repo se prueba como test dentro de tests/ (o con imports dinámicos por ruta absoluta), no como script suelto en el scratchpad.
- **El guard «toda regla de m.css tiene alcance» marcaba 10 selectores sin alcance (h2, label, select…) que sí lo tenían.** → Partir la lista de selectores por coma corta adentro de :is(h1, h2, h3, p), así que los pedazos pierden el prefijo [data-m]. · tests/movil-shell.test.ts → partirPorComas · REGLA: Para partir una lista de selectores CSS se usan sólo las comas de primer nivel (contando paréntesis), nunca split(',').
- **Un flick suave hacia abajo desde «alto» a mitad de camino terminaba en «medio», y se leía como bug del sheet.** → destinoDelSheet elige el snap más cercano a la proyección. A 600 de 800, con medio en 400, el más cercano es medio; el flick sólo fuerza un escalón si supera 0,11 px/ms. · app/m/_ui/gestos.ts → destinoDelSheet · REGLA: La expectativa de un test de snaps se calcula con la proyección (visible − v·99), no a ojo; si cae al medio de dos snaps, el resultado es el más cercano.
- **/inicio y la redirección a /m no se pueden probar en local sin el dev server, y el server compartido desapareció a mitad de la corrida.** → Otra sesión (o la guardia de RAM) cerró el next dev de localhost:3000. Un node de 2,8 GB seguía vivo, pero sin escuchar el puerto. · localhost:3000 (dev compartido) · REGLA: Si el dev compartido no contesta, la verificación visual se declara PENDIENTE en el reporte con el comando exacto. No se arranca otro server ni se declara «verificado».
- **El comentario de ejemplo de badges.ts decía `inbox: (ctx) => contarParaDecidir(ctx)`, y eso compilaría con un objeto donde se espera un número.** → contarParaDecidir devuelve { total, porTipo }, no un número. El ejemplo se escribió antes de que existiera lib/inbox-movil.ts. · app/m/badges.ts (comentario de cabecera) · REGLA: Un ejemplo de enchufe en un comentario se reescribe contra la firma REAL cuando el módulo aparece. Acá ya está corregido a `.total`, donde null = no se pudo leer = sin badge.


### Push y feed
- **Un script de diagnóstico en el scratchpad tira ERR_MODULE_NOT_FOUND para 'dotenv' aunque el comando se corra con cwd en el repo.** → En un .mts, el import('dotenv') se resuelve contra la carpeta del SCRIPT y no contra el cwd. Como el scratchpad no tiene node_modules, no lo encuentra. · Scripts en scratchpad/<clave>/*.mts corridos con npx tsx --conditions=react-server. · REGLA: Para los paquetes, usar import(pathToFileURL(path.join(process.cwd(),'node_modules','dotenv','lib','main.js')).href).default, y para los módulos del repo, rutas absolutas con pathToFileURL. Nunca un especificador pelado desde un script que vive fuera del repo.
- **Hay que medir si un paquete nuevo (web-push) compila con Turbopack, y el dev server 'compartido' de localhost:3000 contesta HTTP 000.** → El dev server no estaba corriendo a esa hora. La regla de la corrida prohíbe levantar uno, así que la medición del bundle queda sin hacer. · next.config.ts (serverExternalPackages) y el primer request a /api/push/clave. · REGLA: Que un paquete cargue bajo tsx no dice que Turbopack lo empaquete. La medición queda pendiente y se declara como no medida; no se agrega serverExternalPackages a ciegas.
- **Los avisos alDueno aparecerían en el feed del CLIENTE y su push iría a los teléfonos del cliente.** → Antes, crearNotificacion y la cola usaban el ws del contexto en que se emitía el aviso. Un aviso de agencia sobre un cliente se emite adentro del workspace de ese cliente. · lib/avisos.ts, emitirAviso: wsLector = alDueno ? wsSuperAdmin() : ws. Lo comparten el feed, la cola y el push. · REGLA: El workspace de un aviso es el de quien lo va a LEER, no el de quien lo generó. Un canal nuevo de emitirAviso usa wsLector, nunca ws.
- **Una pendiente que se confirma en el mismo pedido (un token detallado con escritura directa por /api/v1, o el paso de un flujo) igual haría sonar «MaKo te pide confirmar».** → crearPendiente y crearPropuesta se llaman también desde caminos que las aplican en el acto (aplicarEnElActo). · lib/mako-pendientes.ts (avisarPendiente) y lib/propuestas.ts (avisarPropuesta): se saltean los orígenes 'app' y 'flujo:*', y pushPorDetras vuelve a preguntar el estado justo antes de mandar. · REGLA: Un push sobre algo que espera a una persona se manda después de la respuesta (after) y re-preguntando si sigue vigente; nunca en el mismo instante del insert.


### Turno de MaKo
- **Un turno real del doer corrido con tsx fuera de Next contesta «tuve un problemita técnico al consultar la base de datos» o «no pude localizar al lead»: parece un bug del turno o del runner.** → Las lecturas pasan por cachedRead → unstable_cache, que fuera del servidor de Next tira primero «Invariant: AsyncLocalStorage accessed in runtime where it is not available» y después «Invariant: incrementalCache missing in unstable_cache». El runner devuelve {ok:false,error} y el modelo lo traduce a una excusa. buscar_leads es una de esas lecturas; metricas_negocio no. · lib/cache.ts:46-62 (cachedRead); node_modules/next/dist/server/web/spec-extension/unstable-cache.js:60 · REGLA: Un script que corre un turno o una lectura del doer pone, ANTES de importar nada del repo, `globalThis.AsyncLocalStorage = (await import('node:async_hooks')).AsyncLocalStorage` y un `globalThis.__incrementalCache` que no guarda nada ({generateCacheKey: async k=>k, get: async()=>null, set: async()=>{}, isOnDemandRevalidate:false}); molde en scratchpad/turno/e2e.mts. Si en un script el modelo dice «no pude consultar», se corre esa herramienta a mano antes de tocar el turno.
- **El system del chat del teléfono dice «se confirma TOCANDO la tarjeta» y aun así el modelo contesta «Confirma con un «sí» para que quede registrada».** → La salida de toda acción que deja una pendiente trae `instruccion: 'Di qué vas a hacer y pide que confirmen con un «sí»'`, fija para todos los canales. Lo que dice el resultado de la herramienta le gana al system. · lib/api-mako/ejecutar.ts:184; se resolvió en conInstruccionDeTarjeta (lib/mako-turno-app-reglas.ts), aplicada en runTool de lib/mako-turno-app.ts · REGLA: Un canal donde se confirma distinto que en WhatsApp reescribe la `instruccion` de la salida de la pendiente antes del memo. Cambiar el texto del system no alcanza (medido el 11/10/2026: con la reescritura, el modelo dice «tocando la tarjeta de aquí abajo»).
- **Se manda una foto como bloque de imagen al doer (chatClaudeTools, feature 'mako-doer') y el modelo contesta como si no hubiera foto: a «si no te llegó, responde NO_VEO» respondió «NO_VEO».** → El registro resuelve la feature a Gemini, que corre por chatCheapTools. bloqueATexto aplana cada mensaje y descarta todo lo que no es texto: la imagen no sale nunca, sin error. El diagnóstico obvio («Gemini no ve imágenes») es falso: por el lector nativo (archivoATexto → leerDocumentoIA, inline_data) la misma imagen da «Imagen completamente roja». · lib/ai-cheap.ts:772 (bloqueATexto); lib/mako-adjuntos.ts (cabecera) · REGLA: Una foto o un PDF que tiene que entender el doer se LEE antes con lib/archivo-a-texto.ts y entra al turno como texto; el bloque nativo sirve solo por un camino que mande bloques (Claude, vetado). El turno completo con foto tardó 108 s: la ruta necesita maxDuration 300 y el cliente un AbortSignal de 305 s.
- **Un script de diagnóstico que «prueba» una acción llamando a runnerDelRegistro(ctx)(nombre, input) deja una fila nueva en mako_acciones_pendientes (pasó con la #148, que hubo que cancelar).** → El runner del registro no tiene modo de prueba: una ACCIÓN con confirmación 'chat' corre preparar() y crea la pendiente de verdad en la base de producción (.env.local). · lib/api-mako/ejecutar.ts (runnerDelRegistro) → lib/api-mako/acciones.ts:88 proponerChat → crearPendiente · REGLA: En un script de diagnóstico se llaman sólo LECTURAS por el runner. Para probar una acción, por el turno completo y con cancelarPendiente al final; se revisa `select … where grupo_jid like 'app:%' and estado='pendiente'` antes de cerrar.
- **En el chat del teléfono (copy neutro con «tú»), «mueve a Rosana a Agendado», «pasa a Rosana a Agendado» o «pausa la campaña» no traen ninguna herramienta de acción: MaKo no puede proponer y responde de largo.** → clasificarIntencion los clasifica como 'capturar' (dudosa) porque ACCION_CUENTA_RE sólo reconoce imperativos en voseo («pausá» → actuar, «pausar» o «pausa» → capturar). Notas («agrega una nota al lead…») sí entran por el área crm. · lib/mako-intencion.ts (ACCION_CUENTA_RE); medido con scratchpad/turno/frases.mts · REGLA: El clasificador tiene que reconocer los imperativos en tú (mueve, pasa, pausa, cambia) además del voseo. Hasta que eso pase, un test que necesite una acción de cuenta usa la frase en voseo y lo dice en un comentario (tests/mako-turno-app.test.ts lo hace).


### Vista general (/general y Today)
- **La cabecera de /general escondía la acción del día comparando foco.hrefLabel === 'Cargar el objetivo'.** → No había un campo que dijera qué falta configurar, así que la pantalla dependía del copy del botón. Cambiar ese texto en lib/focus.ts rompía la cabecera en silencio, y el móvil iba a copiar la misma comparación. · lib/focus.ts (Foco.pideConfigurar) y app/general/Cabecera.tsx:248 · REGLA: Una pantalla decide por un campo explícito del modelo (pideConfigurar, tipo de alerta), nunca por el texto que ese modelo dibuja.
- **Con getDataSources() caído, el semáforo podía prender el verde y el foco decía «vas al día» sobre un negocio del que no se sabía nada.** → La página hacía fuentes = [] en el catch, y la guarda era `fuentes.length > 0 && ninguna con lastSync`, o sea que con [] daba sinFuentes=false. Lo mismo pasaba por fuente: un error de supabase dejaba lastSync null, que se leía como «nunca entregó nada» y mandaba a «conectar» una fuente conectada. · lib/vista-general-modelo.ts (estadoFuentes, en positivo: sólo 'con-datos' permite opinar) y lib/sources.ts (DataSource.error) · REGLA: Una lectura caída es un tercer estado ('sin-leer'), no [] ni null de un campo. La guarda #165 se escribe en positivo: se puede opinar sólo si hay al menos una fuente con datos, y si ninguna tiene datos pero alguna no se pudo leer, la respuesta es «no sé», no «sin datos».
- **La marca del tiempo de un objetivo ANUAL caía en el último día del trimestre (en Q4, al 100% del año).** → Cabecera llamaba fraccionDeRango(desde, hasta, progreso.hasta): pasaba el FIN del trimestre como si fuera hoy. No se veía porque no había ningún objetivo anual en la base. · lib/vista-general-modelo.ts fraccionDelObjetivo (antes en app/general/Cabecera.tsx) · REGLA: Un parámetro llamado `hoy` recibe el hoy del workspace, nunca un borde del período que está a mano.
- **El escalón «Plan» del foco no disparaba nunca para el dueño (ws9).** → Leía siempre experimento_tareas (el tablero del cliente, con 0 filas en ws9) en vez de plan_tareas. Además dejaba competir a las recurrentes, que no tienen un fin que se pueda adelantar. · lib/vista-general.ts (tableroActual + listPlanBoard/listTareas) y lib/focus.ts (sinRecurrentes dentro de elegirFoco) · REGLA: Quien lee «el tablero» desde afuera elige la mitad con tableroActual(). Y el filtro de recurrentes va dentro del que ELIGE, no sólo en quien llama, para que una pantalla nueva no las pueda colar.
- **El dev server compartido de localhost:3000, que la tarea daba por corriendo, no respondía (curl 000, ningún listener en 3000-3010). La captura «antes» de la corrida anterior es la página de error de Chrome guardada como PNG.** → El servidor se cayó o lo apagaron entre corridas. mirar.mjs no falla: guarda un PNG de «localhost refused to connect» y un JSON con hidrato:false. · scratchpad/mirar.mjs y shots/hoy-antes-ws1.png · REGLA: Antes de dar por buena una captura, leer el JSON de mirar.mjs: con url chrome-error:// o hidrato:false no hay captura. Y antes de capturar, `curl -m 5 localhost:3000/login`.


### Plan
- **La rotura 'banda del ítem con la urgencia heredada en vez de t.score' pasaba 12/0: ningún test la detectaba aunque el tablero de prueba tenía una dependencia.** → La única dependencia del fixture la ponía una tarea de score 12 frenando a una de 15: la urgencia heredada caía en la misma banda ('futuro'), así que las dos fórmulas daban igual. · tests/plan-hoy.test.ts (fixture `tablero()`), app/plan/board/hoy.ts (`banda: prioFromScore(t.score)`) · REGLA: Para probar una regla de urgencia heredada, la tarea bloqueada tiene que estar en OTRA banda que la que la frena (95 contra 10). Si la herencia no cruza de banda, el test no puede distinguir las dos fórmulas.
- **El script de prueba contra el ws3 decía 'SIN TAREAS ABIERTAS', y con el filtro .eq('recurrente', false) daba lo mismo.** → El Cliente de Prueba (ws3) está vacío de tareas abiertas: es un dato, no un error del filtro. · experimento_tareas del ws3 · REGLA: Para probar escrituras del plan del cliente en el ws3, hay que crear la tarea con crearTarea (lib/todo.ts no llama al Perro) y borrarla en un finally, comprobando con una relectura que quedan 0 filas.
- **El deshacer de marcarHecha deja la fila idéntica salvo updated_at.** → editarTarea es parcial y vuelve a derivar estado y hecho_at a partir del avance. El único rastro que queda es el timestamp de actualización. · lib/plan-marcar.ts → lib/todo.ts editarTarea · REGLA: Al verificar 'quedó exactamente como estaba', comparar la fila ENTERA y aceptar solo updated_at como diferencia. Cualquier otro campo distinto es un bug del deshacer.
- **La captura de /plan 'antes' de la corrida anterior era la página de Chrome 'This site can’t be reached', guardada como si fuera la evidencia.** → El dev server compartido de :3000 estaba caído y mirar.mjs igual escribe un png sin fallar. · scratchpad/mirar.mjs, shots/plan-antes.png · REGLA: Antes de usar una captura como evidencia, hay que leer su 'texto' u 'hidrato' en la salida de mirar.mjs o hacer `curl -w %{http_code}` al server. Un png existente no prueba que la pantalla cargó.


### Datos del Inbox
- **La bandeja de pendientes de MaKo o la de borradores del plan aparece vacía, y el badge diría 0, cuando en realidad la lectura falló.** → `pendientesDelWorkspace` y `listPropuestasPendientes` no miran el `error` de supabase-js y devuelven `[]` si la lectura falla. «No pude leer» queda igual que «no hay nada». · lib/mako-pendientes.ts y lib/plan-propuesta.ts. Se trabaja alrededor en lib/inbox-movil.ts (leerPendientes y leerBorradores). · REGLA: Para estas lecturas, un conteo que sí mira el error se hace ANTES de la lista y sirve de prueba. Si el conteo falla, o dice que hay y la lista volvió vacía, es una falla y no un vacío. Un badge nunca suma una bandeja caída como 0: el total queda null.
- **Al tocar dos veces «Deshacer el cambio» o una opción del CRM automático, el lead se revierte o se mueve de etapa dos veces. Mover de etapa puede mandar una conversión a Meta que no se deshace.** → `resolverConfirmacion` leía el estado, aplicaba y cerraba la confirmación AL FINAL con `.eq('id')` y nada más. Los dos toques leían 'pendiente' y aplicaban los dos. · lib/mako-confirmaciones.ts, resolverConfirmacion. · REGLA: Lo que escribe cosas no idempotentes se reclama primero con compare-and-set (`.eq('estado','pendiente')` + `.select('id')`; si vuelve vacío, no se aplica nada), igual que reclamarPendiente. Si lo que se aplica falla, se suelta con `.eq('estado', <el que reclamé>)` para que se pueda reintentar.
- **Una server action de /m saltea un permiso que en el escritorio sí se cumplía. Ejemplo: un rol con una capa sin 'mako' podría confirmar acciones de MaKo.** → La capa la chequeaba la PÁGINA de escritorio (`requireRolWs([], { nav: 'mako' })`). Las acciones de escritorio sólo miran la sesión y el rol, y una server action no hereda ningún guard de la página que la monta. · app/mako/pendientes/acciones.ts y app/mako/revisar/[id]/acciones.ts. El chequeo nuevo está en app/m/inbox/acciones.ts (noPuede). · REGLA: Antes de reexportar una acción de escritorio, revisar qué guard ponía su página. Las de /m vuelven a chequear rol y capa con la MISMA regla que arma la lista (`tiposVisibles`).
- **Después de confirmar desde el teléfono, el ítem sigue en el Inbox y el badge lo sigue contando.** → Las acciones de escritorio hacen `revalidatePath` de su propia ruta (/mako/...), no de /m. · app/m/inbox/acciones.ts, función refrescar. · REGLA: Las acciones de /m llaman a `refresh()` de next/cache después de escribir, envuelto en try para que un fallo al refrescar no convierta en error una escritura que ya se hizo.
- **`descartarLeadsAction` contestaba «ok» con cualquier id, aunque fuera de otro tipo.** → `descartarPropuesta` no mira el tipo, y la acción pedía cualquier sesión. Un closer podía descartar por id una propuesta de ACCIÓN de MaKo, que sólo debería tocar el admin. · app/crm/revisar/[id]/acciones.ts. · REGLA: Una acción que recibe un id de propuesta verifica tipo y estado antes de escribir. No alcanza con confiar en que la pantalla sólo muestra las suyas.


### Today
- **La capa del super admin (ws9) recibiría el Pulso de /general en Today, aunque el diseño dice que su Today es plan + vencimientos + aprobaciones.** → tabEnCapa deja pasar 'general' para la capa superadmin (userNavKeys null), así que puedeVerKey('general','admin','superadmin') da true. Medido con tsx el 11/10/2026. · lib/movil-rutas.ts puedeVerKey / lib/capas.ts tabEnCapa; resuelto en lib/hoy-movil-modelo.ts composicionHoy · REGLA: La COMPOSICIÓN de Today nombra la capa (superadmin/pm) además de puedeVerKey; derivar el Pulso sólo de la visibilidad de 'general' le muestra al dueño un tablero de cliente.
- **Un Today que pide el Inbox o los leads sin marcar escribe en la base en cada apertura.** → leerParaDecidir marca vencidas y getPendientesDeMarcar dispara adjuntarFathomAutoThrottled y cierra historial; leerVistaGeneral corre migrarSettingsAObjectives. Parecen lecturas. · lib/inbox-movil.ts, lib/queries.ts getPendientesDeMarcar, lib/vista-general.ts · REGLA: Desde Today el Inbox se CUENTA (contarParaDecidir, no escribe) y getPendientesDeMarcar se llama a lo sumo una vez por render (el admin la recibe dentro del Pulso); fijado por test.
- **La reunión de hoy no tiene hora si se usa sólo getJuntasProximas.** → JuntaProxima no expone junta_N_at aunque la columna está poblada (ws13: 5 de 5 con hora). · lib/queries.ts getJuntasProximas / lib/hoy-movil.ts leerReuniones · REGLA: La hora se completa con una lectura por ids (getTenantDb) y se formatea en la zona del NEGOCIO (tzDeWorkspace), nunca la del teléfono.
- **Un proyecto vencido con sólo tareas recurrentes se dibujaría «0 tareas abiertas».** → Desde la mig 0163 las recurrentes no cuentan como abiertas; el texto correcto vive en `carga` de lib/plan-vencimientos.ts, que es privada. · lib/plan-vencimientos.ts carga; app/m/hoy/page.tsx carga · REGLA: Quien dibuje FilaVencimiento mira abiertas Y recurrentes; mejor exportar `carga` que copiarla.
- **El dev server compartido de :3000 estuvo caído ~12 min y no se pudo mirar la pantalla.** → No es del código: ninguna sesión lo tenía arriba (sin listener). · entorno · REGLA: No arrancarlo desde un subagente (regla de la corrida); declarar la captura como BLOQUEANTE con el comando exacto.


### Inbox y Cuenta
- **Una confirmación del CRM que ya resolvió otra persona contesta ok:true, no «ya no está pendiente».** → resolverConfirmacion (lib/mako-confirmaciones.ts:273 y :287) hace `return` silencioso cuando el estado ya no es 'pendiente' o cuando otro toque ganó el reclamo. No hay error que leer. · lib/mako-confirmaciones.ts → app/m/inbox/acciones.ts resolverConfirmacionMovil · REGLA: En el teléfono, una confirmación ya resuelta se ve como «Listo» y la fila sale. Si hace falta decir «ya la resolvió otro», el server tiene que devolver un dato distinto. La pantalla no lo puede deducir.
- **La ruta /api/push/prueba nunca devuelve ok:true con enviados=0, así que la rama «ok y cero enviados» de un toast es código muerto.** → La ruta calcula ok = r.enviados > 0 (app/api/push/prueba/route.ts). sinSuscripciones cuenta USUARIOS sin teléfono suscrito, no teléfonos. · app/api/push/prueba/route.ts + app/m/cuenta/cuenta-ui.ts toastDePrueba · REGLA: Antes de escribir las ramas de un resultado, leé cómo la ruta arma `ok`. Si es un derivado de otro campo, la combinación contradictoria no existe.
- **El detalle de una acción mostraba dos veces el mismo parámetro (como campo editable y como línea de lectura), o lo filtraba mal.** → Las líneas de `detalle` usan rotuloDeParametro(def), que sale de un diccionario de respaldo, y no `p.rotulo ?? p.nombre`. Con dos fuentes del rótulo, el filtro por nombre no calza. · lib/inbox-movil-reglas.ts lineasDelPayload ↔ app/m/inbox/InboxM.tsx · REGLA: Para cruzar un parámetro con su línea de detalle, usá la MISMA función de rótulo (rotuloDeParametro de lib/editor-acciones.ts, que es apta para el cliente).
- **El botón «Probar aviso» y el resto de la sección dependen del teléfono, y pintados en el primer render provocaban un desfase de hidratación.** → esIOS, estaInstalada, Notification.permission y la suscripción sólo existen en el navegador. · app/m/cuenta/CuentaM.tsx AvisosTelefono · REGLA: Todo lo que depende del dispositivo se lee en un useEffect y arranca en 'cargando'. Nunca se decide en el render del server.


### Chat de MaKo
- **Un super admin que mira a un cliente sube una foto al chat del teléfono y el turno corre en el workspace equivocado (el suyo).** → El parche de app/_components/WsFetch.tsx sólo le pega el ?ws= a fetch(); XMLHttpRequest no pasa por ahí. El XHR, que es el único camino con progreso de subida, salía sin el ws. · app/m/mako/ChatMako.tsx (postConProgreso(conWs(RUTA, ws), …)) y app/m/mako/subir.ts · REGLA: Todo XMLHttpRequest a /api arma la URL con conWs(ruta, useWs()). La regla «las llamadas a /api salen solas con el ?ws=» vale sólo para fetch. Lo fija tests/m-mako-chat.test.ts.
- **Mantener el mic para grabar una nota también arrancaba el dictado, o lo cortaba al soltar.** → Después de pointerdown/pointerup el navegador igual dispara click. Si el toque se resuelve en onClick y el mantener en los pointer events, el click de después de mantener cuenta como un toque. · app/m/mako/Composer.tsx (gesto.current.suprimirClick) · REGLA: Cuando un mismo botón tiene tocar y mantener, el temporizador de mantener marca que hay que suprimir el próximo click. El toque se resuelve SÓLO en onClick, que es lo que también cubre el teclado (Enter/Espacio).
- **Al soltar la nota de voz, el mensaje se manda solo, y en WhatsApp la regla de la casa dice «nada sale al soltar».** → No es una contradicción. La regla de WhatsApp protege un AUDIO que le llega a una persona. Acá lo que viaja es la transcripción, a MaKo, que sólo propone: toda acción se confirma en su tarjeta. · app/m/mako/Composer.tsx (comentario de cabecera) · REGLA: Si un día la nota de voz del chat sale como audio hacia afuera (a un lead o a un grupo), vuelve a valer «nada sale al soltar». Martín no lo confirmó: es una decisión de producto abierta.
- **Un error de red o un corte por tiempo al mandar un turno invita a «Reintentar», y eso puede dejar dos acciones pendientes iguales y pagar el modelo dos veces.** → El route guarda el mensaje y corre el turno antes de contestar. Un 5xx, un status 0 o el corte a los 305 s pueden haber corrido el turno entero. · app/m/mako/chat-ui.ts (leerRespuesta / ERROR_INCIERTO) · REGLA: Sólo es reintentable un 4xx con su {ok:false,error}: el route lo devuelve antes de guardar nada. Todo lo demás se muestra como «No sé si llegó» con «Recargar el chat». Es el default de la casa: no reintentar lo que gasta.


### CRM
- **Ninguna lectura del CRM que viaja con React/Next corre en un script tsx: «Invariant: incrementalCache missing in unstable_cache».** → getJuntasProximas, getPendientesDeMarcar y listLeads son cachedRead (unstable_cache), que necesita el incrementalCache del server de Next. runWithWorkspace no alcanza. · lib/queries.ts:2512 y :2270, lib/leads.ts:359; lo encontré al probar lib/crm-movil.ts · REGLA: Para probar sin navegador, las funciones que no tocan cachedRead (fichaMovil, quietos) se llaman directo con runWithWorkspace. Lo que pasa por cachedRead se mide en Next real, o se llama a su _versión privada.
- **Un error de tipos «EtapaM[] no es asignable a readonly EtapaLite[]» al pasar las etapas de etapasDeProducto a etapaVigenteDe o pideWizardAlElegir.** → etapasDeProducto devuelve kind?: string|null y EtapaLite (lib/funnel-etapas.ts) acepta kind?: string, sin null. · lib/lead-funnel.ts:26 contra lib/funnel-etapas.ts:41 · REGLA: Se pasa por comoLite() (app/m/crm/reglas.ts). No se castea.
- **La lista de etapas a las que se puede mover viajaba al teléfono con colores, columnas y bandas de cada etapa.** → etapasDeProducto devuelve el objeto Stage entero aunque el tipo declarado sólo nombre key, label, kind, band y dot. · lib/lead-funnel.ts:26 · REGLA: Lo que va a un componente cliente se mapea a los campos que usa, como etapasMovibles en reglas.ts.
- **El chequeo de voseo marcaba «acá» en archivos nuevos, y un sed con \bacá\b no lo reemplazaba.** → \b es ASCII: no hay borde de palabra después de la á (la misma trampa que AGENTS.md documenta para las regex sobre español). · Al editar app/m/crm/* y lib/crm-movil.ts · REGLA: Los reemplazos en español se hacen con node y un string literal, o con (?<!\p{L})…(?!\p{L}). Nunca con \b en sed o grep.
- **Un heredoc de node -e con backticks se comió el texto del comentario del test sin dar error.** → En bash los backticks dentro de comillas dobles ejecutan comandos. · tests/crm-movil.test.ts, al editar el comentario de la rotura · REGLA: Los textos con backticks se editan con la herramienta Edit, o con un heredoc 'EOF' entre comillas simples.
- **Mover desde el teléfono a una etapa de reunión o de nutrición manual habría salteado la pregunta de la fecha o del plazo.** → setLeadStageAction «guarda SIEMPRE» y no valida nada. El wizard lo decide sólo el cliente de escritorio (pideWizardAlElegir). · app/crm/actions.ts:1129 · REGLA: La regla del teléfono (seMueveEnElTelefono) se vuelve a mirar en la server action. Esconder la etapa en la lista no protege nada. Lo fija tests/crm-movil.test.ts.


### Plan (pantalla)
- **leerPlanHoy devuelve la misma tarea en `prioridades` y en `semana`, así que en /m/plan aparecería dos veces** → hoyDelTablero le saca a `hoy` las tareas de prioridades, pero a `semana` no (dice textual «Todas, estén o no en prioridades»): está pensado para Today, que pinta prioridades+hoy · app/plan/board/hoy.ts (tipo HoyDelTablero.semana); se resuelve en app/m/plan/ListaPlan.tsx (el filtro `vistos`) · REGLA: Una pantalla que pinta las tres listas deduplica por id y gana la primera. Lo fija tests/movil-plan-formato.test.ts
- **Un check dentro de una FilaM con onClick sería un <button> dentro de otro <button> (HTML inválido, y el toque cae en el padre)** → FilaM con onClick renderiza la fila entera como <button>, y `leading` vive adentro · app/m/_ui/FilaM.tsx (rama p.onClick) · REGLA: Para una fila con un control propio a la izquierda Y que abre algo al tocarla: FilaM sin onClick (un div, que conserva el swipe) + un botón position:absolute;inset:0 adentro del título (z-index 1) + el control en z-index 2. El botón vive dentro de .m-fila__t (overflow hidden), pero su bloque contenedor es .m-fila (position relative), así que no lo recorta
- **Después de un swipe confirmado, la fila vuelve a su lugar un frame antes de irse** → FilaM llama a onAccion() y en el mismo tick hace mover(0). Un setState normal se pinta después · app/m/_ui/FilaM.tsx alSoltar → setTimeout(accion.onAccion(); mover(0)) · REGLA: Si el onAccion de un swipe saca la fila, la oculta de forma síncrona (flushSync) o la deja invisible antes de que FilaM la devuelva
- **Un script tsx que importa módulos del repo con path.join tira ERR_UNSUPPORTED_ESM_URL_SCHEME en Windows** → import() de una ruta absoluta C:/… se lee como un esquema de URL «c:» · scripts de diagnóstico del scratchpad (patrón de la tarea: imports dinámicos con path.join) · REGLA: En Windows los imports dinámicos van con pathToFileURL(p).href
