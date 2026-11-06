# Hallazgos — Ticketera (los tickets que levantan los usuarios)

Lo que no se deduce leyendo el código. El diseño, con lo que se copió de quién: [diseno-ticketera-usuarios.md](diseno-ticketera-usuarios.md).

---

## El correo de avance: lo difícil no era mandarlo, era a quién NO (4/11/2026, nube)

**El pedido:** Joan, el 2/11: «¿cómo van esos tickets?». Martín: «que se le envíe por email los avances». La regla de qué hito
avisa ya estaba (lib/tickets-avance.ts, con su test) y nadie la llamaba.

**Lo que no se deduce del código:**
- **Ningún camino de los tickets mandaba un correo.** `avisarPendientes` (lib/tickets-cierre.ts) avisa por push, chat y WhatsApp, y
  su consulta filtra los estados FINALES: no sirve para el avance. El correo es una vuelta aparte del cron, el paso 4.
- **El remitente es MaKo** (`REMITENTE_MAKO`, la key de la plataforma, el contexto del workspace de la plataforma), como el aviso de
  cambio de plan (lib/aviso-plan.ts). Con la key del negocio un correo de soporte de MaKo saldría por el Resend de un cliente.
- **Apagarlos no existía.** No hay una preferencia de email por persona (el canal «Email» de Notificaciones es a quién le avisa MaKo
  lo del NEGOCIO). Va en `usuarios.perfil.ticketsPorEmail`, sin migración, con un link firmado por persona (otro prefijo que el de la
  baja de un lead) en el pie y en `List-Unsubscribe`.
- **El GET del link no apaga nada:** los antivirus de los correos abren los links solos. Apaga el botón (POST) o el «Cancelar
  suscripción» de Gmail (One-Click, RFC 8058). La baja de los leads (/api/email/unsubscribe) apaga con el GET: ahí no se tocó.
- **A quién NO:** los tickets que abre MaKo solo (`esRefDelSistema`, canal `sistema`: seis fallas en un día serían seis «Recibimos
  tu ticket» de algo que nadie mandó), los de la plataforma, una persona de otro negocio (el super admin o una agencia mirando un
  cliente), una suspendida y un ticket sin cuenta (por WhatsApp sin perfil el email es `whatsapp:<teléfono>`). `esRefDelSistema`
  pasó a lib/tickets-reglas.ts para que la regla pura la use.
- **Sólo lo que cambió en las últimas 48 horas:** el día que se prende no le llega a nadie un correo por un ticket viejo que ya se
  avisó por WhatsApp. Marcar el correo no toca `updated_at`.
- **Se marca antes de mandar**, compare-and-set contra el hito que había: dos vueltas a la vez mandan uno. Si Resend falla, ese
  hito se pierde y queda anotado en el ticket; el siguiente avisa igual.

**Vive en:** lib/tickets-avance.ts (la regla y la vuelta, pura) · lib/tickets-avance-email.ts (base y Resend) ·
app/api/email/unsubscribe/tickets/route.ts · app/api/cron/tickets/route.ts. Lo fijan tests/tickets-avance.test.ts y
tests/tickets-avance-email.test.ts (corre la vuelta, la baja y el cron reales contra una base y un Resend de mentira).

**Sin medir:** que Resend entregue en producción. La primera vuelta lo dice en el registro del cron («correos de avance N»).

## El hito de commit no cierra, y `arreglado` puede quedar antes del deploy (3/11/2026)

**Síntoma:** el ticket #45 quedó dado por resuelto en el relevo y el #44 figuraba `arreglado` con «Ya puedes cargar documentos…» sin que la
función estuviera en producción.

**Causa:** un ticket se cierra SOLO con el hito `tickets: [n]` en la bitácora, cuando el deploy lo trae (lib/tickets-cierre.ts). Un
«Ticket #45» en el mensaje de un commit no cierra nada. Y `scripts/tickets.ts arreglado` guarda el texto para el cliente aunque el arreglo no
se haya subido.

**La regla:** el hito con `tickets: [n]` va en el MISMO commit que el arreglo, y `arreglado` se escribe recién con la rama en main.

## «La pantalla se rompió» era una pantalla que se volvió a dibujar sola (ticket #39, 1/11/2026)

- **Síntoma:** un ticket automático de prioridad alta, «La pantalla CRM se rompió», con React #418. La persona movió un lead de etapa menos de dos minutos después (`lead_audit`).
- **Causa de la alarma:** el reportador de la ventana (`app/_components/ReportarErrores.tsx`) escucha `error`, y React avisa por ahí de lo que ya recuperó. Se le ponía el título de una pantalla caída, y ese texto lo lee el cliente.
- **⚠️ `args[]=HTML` NO ES ANIDADO INVÁLIDO.** Es el texto del mensaje: «the server rendered HTML», contra «text». Dice que difiere un elemento, no por qué.
- **Lo que hay que mirar antes de sospechar de lo último que se tocó:** cuántas veces pasó (`errores_app.veces`) y si la persona siguió trabajando. Una sola vez en toda la historia no es un dato roto: se repetiría en cada visita.
- **La causa de este caso NO se sabe.** No se reprodujo en otra sesión, y no se abrió el negocio del cliente. Por eso el reporte ahora trae `pistas`: `<font>` es el traductor del navegador, una etiqueta con guion es una extensión. Si el próximo caso trae `font=0` y ninguna ajena, entonces sí es nuestro.


## El PEDIDO DELEGADO desde el grupo: la regla del negocio no alcanza, y lo que escribe el Cerebro tiene tres puertas (30/10/2026, claude3)

**Vive en:** `delegadoQueDecideMartin` y `DELEGADO_SEGURO`, `clasificar` (opción `decideMartin`), `textoDelAviso`, `paraElCliente`,
`sinLoInterno` (lib/tickets-reglas.ts) · `crearTicket` (lib/tickets-db.ts) · `bloqueDePedidos` (lib/pedidos-del-negocio.ts). Las
revisiones: C:/dev/revisiones/2910-revision-privacidad-wa-despachante-85a0d9ead.md y 3010-reverificacion-wa-despachante-d49539722.md.

- ⚠️ **Una lista de lo PROHIBIDO no frena nada.** La primera guarda del «hazlo» buscaba palabras de plata, envíos y borrados: la
  re-verificación probó 23 frases dichas de otra manera («subile a 50 por día», «activá la secuencia», «sacá a Juan del CRM») y 15
  salían con el «hazlo» por la regla de Leandro, Leila o Mauricio. **La regla:** lo que se hace sin Martín es una lista CERRADA de lo
  seguro (`DELEGADO_SEGURO`: landings, tareas y plan, notas, borradores de copy, reportes), con los vetos encima; todo lo demás, a
  Martín. Es una guarda dura en `clasificar`: ni la regla del negocio la saltea. El pedido compuesto pasa por el mismo lugar.
- ⚠️ **La respuesta del Cerebro tiene TRES puertas al cliente, no una.** El aviso al grupo (`textoDelAviso`), el bloque de pedidos
  que lee cada turno del grupo 3 días (`bloqueDePedidos`) y /tickets y /m/tickets (`paraElCliente`). Arreglar el aviso solo dejaba
  las otras dos crudas. En un pedido delegado: el «listo» es fijo en las tres, lo demás pasa por `sinLoInterno` y el turno no lo ve.
  **La regla:** antes de dar por filtrado un texto que va al cliente, buscar todo `respuesta` que lo lea.
- **`sinLoInterno` no conoce los negocios** (es pura): reconoce ids, `ws`, commits, rutas, links ajenos y «Nombre Apellido». Un nombre
  de pila suelto («lo de Leila») todavía pasa; para eso habría que pasarle los nombres de los otros negocios (no se hizo).

- **El síntoma (medido esa noche por el Cerebro):** había 8 tickets en `esperando_decision` (Leila, Leandro, Martín) que no
  le llegaron al Cerebro, uno de 6 minutos antes. Y el #15 (Video Editor de Leila) siguió «esperando la decisión» con su
  arreglo en producción y su hito `tickets: [15]`.
- **La causa:** el camino del Runner se diseñó el 17/10 para los bugs del triage (`despacho = 'runner'` + `en_curso`); lo
  demás iba a llegar con la firma de Martín al aprobarlo. Desde su regla del 27/10 («siempre lee todos los tickets e
  implementalos») el Cerebro trabaja tickets que Martín no aprobó todavía, y esos no tenían camino. El cierre
  (`cerrarLosDesplegados`) miraba sólo `en_curso`/`arreglado` por la misma suposición: el hito llegaba DESPUÉS de la decisión.
- **La regla que queda:** un ticket que espera a Martín (`nuevo`/`esperando_decision`, sin despacho) le llega al Cerebro con
  su PROPIA marca (`cerebro_*`, mig 0343) y su propio texto fijo (`mensajeTicketNuevo`, en lib/tickets-aviso.ts y en el
  cartero, comparados por un test). `aviso_*` no se reutiliza: la bandeja lo dibuja como «Entregado al Cerebro» y quiere
  decir «es un bug del triage que ya se está arreglando». Va en un array APARTE (`ticketsNuevos`) y sólo a un cartero ≥ 1.23.0:
  en `tickets`, un cartero de antes le mandaría el texto de «BUG EVIDENTE». El deploy cierra todo lo ABIERTO
  (`ESTADOS_QUE_CIERRA_EL_DEPLOY`); uno rechazado o duplicado no se reabre.
- **Trampa — una marca nueva no puede ser nullable si se filtra por «no entregado»:** `cerebro_estado <> 'entregado'` en SQL
  deja afuera los null, y un ticket sin marca no saldría NUNCA (sin error: la vuelta da vacío). Por eso arranca en
  `'pendiente'`, `not null`, y la vuelta filtra con un `in`.
- **Trampa — todo texto fijo nuevo que el Runner le escribe a un chat va a la lista de textos que NO se suben como
  conversación** (`cartero.mjs`, la línea del `CRUZADO_RE`): si no, el Centro de Operaciones muestra el aviso como algo que
  dijo un chat.
- **Trampa — subir la versión del cartero rompe cinco tests que la fijan con `equal`** (chat-en-el-acto, feedback-2710-tanda1,
  ops-center-decisiones; y la lista de preguntas-cadena-y-ask y turnos-enteros). No es un rojo del cambio: se actualizan.
- **Trampa — `tests/tickets.test.ts` corta lib/tickets-aviso.ts desde el PRIMER `export function mensajeTicket`:** una función
  nueva cuyo nombre empieza igual tiene que ir DESPUÉS, o el corte agarra el resto del archivo y el «no interpola nada del
  ticket» da rojo por un `titulo` de otra función.
- **Correr `cicloCartero` fuera de Next (para un test por la entrada real):** usa `after` de `next/server`, que tira fuera de un
  request, y cargar `next/server` ya tira «AsyncLocalStorage accessed in runtime where it is not available». Se resuelve en el
  hijo: `globalThis.AsyncLocalStorage = AsyncLocalStorage` ANTES de cargar lib/operaciones (import dinámico), y la vuelta
  adentro de `workAsyncStorage.run({ afterContext: { after } })`. Molde: tests/_tickets-al-cerebro-hijo.ts.
- **En el arnés del cartero (`cartero.mjs ciclo` de verdad), un chat de la CLI es `cli_<sessionId>`, no `local_…`:** un destino
  `local_` cae en «El Cerebro se cerró antes de avisarle» y la entrega da vacía sin otro error. Y las carpetas del arnés van en
  POSIX (`/dev/x`, `cwds: ['/dev/']`): `enCwds` compara texto, y un `C:\…` en un test frena en `tests/rutas-windows-en-tests.test.ts`
  (en Linux es una ruta relativa). El molde (tests/cartero-carpetas.test.ts) usa Windows porque está en su lista blanca.
- **El PostgREST de mentira no entendía el `or` de `ticketsSinEntregar`** (`in.(…)` y `and(…)` anidado): tiraba «filtro sin mock».
  Ahora existe `orCompleto`, opt-in: el `or` del candado sigue tirando sin `candado`, y de eso dependen otros hijos.
- **Probado rompiéndolo:** la tabla al pie de tests/tickets-al-cerebro.test.ts. Lo que falta, en «Lo que quedó sin hacer».

## Leer la Ticketera de producción pide el sí de Martín, también al Cerebro (27/10/2026)

- El 27/10 el clasificador de permisos negó `scripts/tickets.ts pendientes` y toda lectura de `tickets` /
  `ticket_eventos` al Cerebro y a sus subagentes, aunque Martín había pedido «revisa los tickets». Una revisión de
  tickets necesita su sí escrito en el chat del Cerebro (o que él corra `pendientes`). Un lector que no pudo leer lo
  tiene que decir: el de ese día sacó los estados de los docs, y pueden estar viejos.
- `scripts/tickets.ts` lee el `.env.local` del cwd: desde un worktree sin `.env.local` (como `C:/dev/wt-push-q`)
  falla; se corre con cwd en el clon principal.
- `pendientes` no muestra el historial: el estado y el porqué de un ticket salen de `ver <n>`.
- Tickets arreglados en código pero SIN hito `tickets: [n]` no se cierran solos: el #5 y el #6 (Mauricio, «Claude
  vetado» y «sin proveedor gratis», desplegados el 24/10) hay que cerrarlos a mano.

## La Ticketera del cliente es un CHAT con MaKo, y todo error tiene «Reportar a Soporte» (23/10/2026)

Martín (22/10): «Mira la ticketera, se ve bastante feo... Cuando podría tener el mismo diseño que un chat y que los usuarios le
comenten a MaKo cual fue su problema... Y en toda la app, SIEMPRE que sale un error, en donde sea, debe aparecer el botón de
"Reportar a Soporte"». La Ticketera del Ops Center del cliente, /tickets y /m/tickets son el MISMO chat de Soporte
(app/tickets/soporte/: PanelDeChat, HiloMako y CajaChat, con sus tickets arriba); se borraron `TicketsCliente.tsx` y
`m/tickets/[id]/TicketM.tsx`. El botón de los errores está en [hallazgos-ui.md](hallazgos-ui.md).

- **MaKo de Soporte NO usa IA, a propósito** (lib/soporte-chat.ts). Repregunta con reglas: «cuéntame más» si contó menos de 5
  palabras; dónde y si pasa siempre, sólo para algo que no anda; «dónde» sólo si no nombró una tab; cada una UNA vez. Lo que no
  anda puede ser justamente la IA del negocio (el ws3 no tiene), y el triage tampoco paga un modelo.
- **El tipo lo lee el MISMO `clasificar` del servidor**, y viaja sólo si la persona lo cambió en la tarjeta. El primer borrador
  lo mandaba siempre: con `declaradoPor: null` el triage lo cuenta como «MaKo lo propuso» y le suma 2 a las mismas palabras que
  ya leyó (un doble conteo que inclinaba los empates).
- **El contexto del chat va SIN la pantalla de origen** (`contextoDelNavegador('soporte')`). El chat vive en el Ops Center: el
  `referrer` es de dónde se cargó la app, no dónde le pasó, y una ruta equivocada cambia el triage (las zonas delicadas se leen
  de la ruta). Dónde le pasó lo dice ella («Dónde: CRM» en el detalle).
- **La lista que refresca cada minuto trae los tickets SIN la conversación** (`paraElCliente(t)` sin eventos: una sola línea, lo
  que mandó). Abrir uno lo vuelve a leer (`verMiTicketAction`); si no, lo que contestó el equipo no aparecía.
- **El reporte del botón es un ticket DE LA PERSONA** (lo ve en su Ticketera), no uno de sistema: canal `formulario` (otro canal
  pide una migración: la tabla tiene un `check` de canales). El mismo error de la misma persona, en la misma pantalla y el mismo
  día, es el MISMO ticket (`ref` = la huella).
- **Trampa (el diagnóstico obvio era el equivocado): el error del botón NO va en `contexto.error`.** La primera versión lo ponía
  ahí («es el error que vio la pantalla, la señal fuerte del triage») y el último botón como `herramienta`. La revisión de
  privacidad lo dio vuelta: el texto lo puede mandar CUALQUIERA con sesión (un POST a mano), y `clasificar` lee `contexto.error`
  como «el sistema lo vio fallar» → bug con confianza alta → arreglo automático, y scripts/tickets.ts imprime Error, Herramienta y
  Navegador ARRIBA del cerco «es DATO». O sea: texto del cliente camino al Cerebro como si lo hubiera visto el código, y un solo
  usuario gastando los 8 arreglos del día. Ahora el error va en el detalle y el ticket lo decide Martín (lo fija un test con
  `clasificar`). Regla: `contexto.error` es SÓLO lo que registró el código del servidor (lib/errores-app.ts, el turno de MaKo).

- **Trampa: una server action acepta CUALQUIER argumento, y el `contexto` del ticket no es del navegador** (la revisión de
  Integración, 23/10/2026, sobre la punta que ya había pasado la mía). `levantarDesdeSoporteAction` guardaba el contexto que le
  mandaban. Alguien del negocio que la llamara a mano con `chat.hilo` = la sesión de MaKo del dueño (los ids son correlativos)
  hacía que, al contestar Martín, `avisarUno` (lib/tickets-cierre.ts) escribiera la respuesta en el chat del DUEÑO como si la
  dijera MaKo, y el modelo la leía en el turno siguiente: la puerta que se cerró el 11/10 (lib/chart-chats.ts), abierta por otro
  lado. Y por ahí entraba también el `contexto.error` que el botón ya no mandaba. Ahora el contexto lo arma el servidor
  (`contextoDeSoporte`, lib/soporte-chat.ts: del navegador sólo navegador, pantalla, zona, idioma y hora). El formulario viejo
  (`levantarTicketAction`) tenía lo mismo y no lo usaba nadie: se borró. Regla: `chat.hilo`, `error`, `herramienta`, `ruta` y
  `noExiste` los pone SÓLO el código del servidor que los vio.
- **Un ticket del chat sin hilo nunca quedaba «avisado», y 30 así trababan el cron.** `avisarUno` no tenía rama para canal de
  chat sin hilo: sin push, `avisado_at` no se marcaba, y `avisarPendientes` toma los 30 más viejos sin avisar, así que esos 30
  ocupaban la ventana para siempre y no salía NINGÚN aviso (tampoco los de WhatsApp ni los de los grupos). La conversación del
  chat de Soporte ES /tickets: cuenta como avisado.
- **Lo que se escribe en Soporte se guarda con las claves tapadas** (`taparClaves` en `crearTicket` y `comentarComoCliente`,
  lib/tickets-db.ts). El chat se ve como los del Ops Center, que las tapan, y lo de un ticket viaja en el push, la bandeja y al
  Cerebro. La caja dice «Eso parece una clave» como la del Ops Center.

**Vive en:** lib/soporte-chat.ts · lib/soporte-reporte.ts · app/tickets/soporte/ · app/tickets/acciones.ts (`levantarDesdeSoporteAction`) · app/api/soporte/reportar/route.ts · tests/ticketera-chat-soporte.test.ts · tests/reportar-a-soporte.test.ts

---

## La Ticketera del CLIENTE, en su Ops Center: sus tickets con su historial (22/10/2026, D2)

Martín: «Que el Ops Center de clientes sea IGUAL que el de SuperAdmin, que tengan su ticketera, pero en este caso ellos suben el
ticket y ven sus tickets ya subidos y el historial con el status». El botón «Ticketera» va arriba de su barra, como el del super
admin, con su número (los que esperan su respuesta). Abre el panel con la pieza de /tickets (TicketsCliente): levantar uno y ver
los suyos. En el teléfono es una fila a /m/tickets.

- **No hizo falta otra Ticketera:** /tickets ya era la del cliente (Intercom + Zendesk, docs/diseno-ticketera-usuarios.md). Se montó
  la misma pieza, con una acción que lee lo mismo que la página (app/tickets/acciones.ts → `misTicketsAction`: workspace y email
  de la SESIÓN, y la lectura filtra por los dos).
- **El historial sale de las FECHAS del ticket** (`historialDelTicket`): recibido, en curso, arreglado y resuelto. No hay un evento
  por cada cambio de estado, pero `created_at`, `despachado_at`, `decidido_at`, `arreglado_at` y `resuelto_at` alcanzan.
- **Trampa: «Arreglado» sólo con el ticket resuelto** (la revisión de privacidad). `arreglado` es «commiteado, sin desplegar», y al
  cliente se le muestra «En curso» a propósito. Con el paso a la vista, diría «Arreglado» con el error todavía en producción.
- **Trampa: un canal con una clave inventada da null en silencio.** El mapa usaba `app`, `chat` y `telefono`, pero los canales de
  verdad son los de `CANALES` (`chat_app`, `chat_movil`, `whatsapp`, `formulario`, `api`, `sistema`). Se tipó contra `Canal`.
  `sistema` no se dice.
- **La puerta del plan:** la acción mira la tab `tickets` como /tickets (`tabEnCapa`), y sin ella no se ofrece el botón.
- **SIN HACER:** dentro del panel abierto, un cambio de estado no se ve hasta volver a abrirlo (TicketsCliente parte de lo que
  recibió). Con el super admin en «ver como», el botón muestra los tickets de Martín en ese negocio, no los del cliente: el email
  sale de la sesión. Y ya existía antes: un ticket de WhatsApp se asigna por los últimos 8 dígitos de `perfil.telefono` sin mirar si
  está verificado (lib/tickets-db.ts), así que otra persona del negocio con ese teléfono en su perfil lo vería.

## La tarjeta se entiende en 3 segundos: Martín no lee el título del cliente, y «Pedido» era el efecto de DEVOLVERLO (22/10/2026, 17:25)

**El síntoma** (Martín, desde el Ops Center, con la captura del #5): el mazo corrido a la izquierda con «#6 …» suelta a la
derecha; Rechazar y Preguntar chicos y con texto, «Hacer» enorme y verde; la tarjeta decía «MaKo no pudo «contestarte»»,
los chips «Pedido · Alta · Automático», un bloque rosa de código (`lib/veto-claude.ts`…) y un párrafo del Cerebro. «No se
entiende ni de qué es el bug, ni qué hay que hacer, ni cómo se originó, o si lo levantó Mauricio o si lo detectó MaKo».

**Los diagnósticos obvios que estaban mal:**
- **«El título está mal escrito».** Está bien escrito para quien lo lee: el CLIENTE, en «Tus tickets» y en el aviso a su
  grupo (`tituloDeError`, lib/errores-app-reglas.ts: «contestarte» le habla a él). No se toca. Lo que lee Martín es OTRA
  frase, armada por reglas desde el canal, `chat.donde`, la herramienta y la pantalla (`quePaso`): «MaKo no le pudo
  contestar a Mauricio en su chat». La pantalla se nombra como en la barra (`tituloDe`, lib/titulo-tab.ts), no por la ruta.
- **«El triage clasificó mal el #5 y el #6: son Pedido».** El triage dijo `bug` con confianza alta (el error lo registró el
  código). Los pasó a `pedido` el CEREBRO, con `scripts/tickets.ts reclasificar <n> pedido`, que es lo que le pide el texto
  fijo del Runner (`mensajeTicket`, lib/tickets-aviso.ts) cuando «no es un bug de verdad (es algo nuevo, o no se
  entiende)». **«Pedido» ES un veredicto: «no es un bug»** (ver abajo, la revisión). La pantalla muestra el tipo de la fila,
  que es el último juicio: el triage, el Cerebro al devolverlo, Martín a mano. Y la naturaleza real de esos dos es
  CONFIGURACIÓN (abajo, «Un negocio sin IA no es un bug»): el tipo no tiene esa casilla, la dice el renglón de qué hacer
  («Conectar su IA»).
- **«Lo que sigue al costado sirve en la compu».** Era lo que sacaba la tarjeta del centro: dos columnas desde 780 px de
  PANEL. Tinder no tiene lista: lo que sigue es la tarjeta que asoma detrás y el «1 de N». Se fue.
- **«"Volver" arriba lo pidió Martín».** Pidió «un botón para volver» (14/10); «arriba» lo decidió un chat. Ahora es el
  primero de la fila de botones (el rewind de Tinder), siempre a la vista y apagado si no hay nada que deshacer.
- **«El "Hacer" grande es el llamado principal».** Martín no lo quiere distinto: los cuatro redondos e iguales, sólo el
  ícono con su color; lo que hace cada uno, en el `title` y el `aria-label`. Al pasar el mouse o arrastrar hacia su lado,
  se llena con su color (`gestoMarcado`, desde 24 px: donde arrancan los sellos).

**La regla del texto: todo sale de reglas, nunca de un modelo** (`leerTicket`, app/tickets/bandeja/mazo-reglas.ts). El
porqué y el qué hacer de un error salen de `ERRORES_FRECUENTES` («Claude vetado» o «sin proveedor gratis» = «No tenía una
IA para contestarle» / «Conectar su IA»; un error que no calza cae en «Algo falló en el código» / «Arreglar el código»). La
nota del Cerebro va en una línea con piezas conocidas (`estadoDeLaNota`: «el código ya está arreglado · lo decides tú») o
su primer tramo recortado; la entera, el error técnico y los links quedan plegados en «Detalle». Un error nuevo que se
repite es una fila más en la tabla.

**Trampas del entorno:**
- En el arnés, un `button.click()` de JS sobre la tarjeta DESPUÉS de un arrastre no hace nada: `comerClick` se come el clic
  que sigue a un arrastre, y `arrastro` sólo baja con un `pointerdown` real. Una persona siempre aprieta antes de soltar
  (anda); el arnés tiene que apretar y soltar de verdad (`cdp-clara.mjs`, pasos `apretar` / `soltar`).
- La marca del botón se ENCIENDE sólo arrastrando: la tarjeta que vuelve con «Volver» entra desde el costado y encendía el
  ✓. Y una encendida se sigue mirando aunque `arrastro` ya haya bajado (el clic de después), para que se apague con el
  resorte.
- Chrome sin ventana con el MISMO perfil en dos corridas seguidas: «Chrome no abrió el puerto» (el anterior todavía lo
  tenía tomado). Un perfil por plan.
- `python -I` ignora `PYTHONIOENCODING`: imprimir «→» en la consola de Windows (cp1252) tira el script a mitad de camino
  (el archivo roto se restauró en el `finally`). Va `sys.stdout.reconfigure(encoding='utf-8')`.

**Medido** (22/10, Chrome sin ventana por CDP, la bandeja real empaquetada con esbuild, el #5 y el #6 leídos de producción,
sólo lectura): a 375, 1024 y 1440 el centro de la tarjeta es el del panel y el de la fila de botones (188 / 778 / 986 px);
los cuatro botones miden lo mismo (58 o 60 px), sin texto; sin scroll horizontal ni código a la vista; arrastrar 88 px a la
derecha marca el ✓ y soltar lo apaga; «Detalle» abre el error y la nota. Los tests, probados rompiendo cada regla.

**La revisión (22/10, noche): lo que la tarjeta clara decía FALSO.**
- **El diagnóstico obvio equivocado: «"Pedido" es el efecto de devolverlo; un automático con error es Bug».** El triage da
  `bug` a TODO automático con error (`clasificar`: +4 por el error, +2 por declararlo el sistema; nada lo lleva a pedido).
  Así que la regla «automático con error = Bug» sólo cambiaba algo donde el Cerebro ya había dicho «no es un bug»: pisaba
  su veredicto. La tarjeta del #6 decía «Bug» al lado de «Estado: … no es de código», y el ✓ («Arreglar») le firmaba al
  Cerebro «ARREGLARLO (es un bug)» sobre lo que él acababa de devolver: otra vuelta del mismo ticket. Se fue `tipoDe`: el
  tipo es el de la fila. Y «Arreglar el código» (las filas de código de `ERRORES_FRECUENTES`) no se dice sobre un ticket
  devuelto: ahí manda el tipo («Decidir si se hace», «Responderle»). Lo del negocio («Conectar su IA») sigue.
- **«A MaKo le falló el servidor».** Un error sin persona (un cron, un webhook, una página pública, MaKo en WhatsApp sin
  saber quién escribió) lo firma la identidad del SISTEMA (`identidadDelSistema`, lib/errores-app.ts: «MaKo (lo detectó
  solo)», sistema@hola-mako.com, el negocio de la plataforma). La frase la tomaba por la afectada: «MaKo no le pudo
  contestar a MaKo en su chat». Ahora: «Falló el servidor en «CRM»», «MaKo no pudo contestar en un chat», sin negocio.
- **La regresión se perdía.** `abrirTicket` titula «Volvió a pasar: …», y la frase se armaba sin el título: Martín no veía
  que era algo que ya se había arreglado, y el regex de lo que intentó MaKo no calzaba (caía al nombre de la herramienta).
- **El contador pegado al error.** `ticketDeError` le suma «· 429 veces» y el digest al final de `contexto.error`; la tabla
  lo leía entero, y un TypeError de 429 veces calzaba con `\b429\b`: «La IA estaba saturada · Probar de nuevo».
- **«Permission denied» a secas no es la base:** es el navegador (el micrófono o la cámara, `NotAllowedError`). El de
  Postgres dice sobre qué («permission denied for table leads»).
- **De paso:** la tarjeta se anunciaba al lector de pantalla con el título del cliente (ahora con la frase); la marca del
  botón quedaba encendida si la tarjeta se iba en pleno arrastre; y a menos de 280 px de panel los cuatro botones se salían
  por los dos lados (corte de 300 px: 52 px, 10 de separación; la cuenta la fija H9, no se midió en el arnés).
- Los botones redondos sí tienen nombre (`aria-label` con la tecla y `title`), el centrado sale de `margin: 0 auto` y de la
  fila con `justify-content: center` en el mismo ancho, y lo que escribió el cliente sólo se dibuja como texto: eso estaba
  bien.

**Vive en:** app/tickets/bandeja/mazo-reglas.ts (`leerTicket`, `quePaso`, `EMAIL_DEL_SISTEMA`, `ERRORES_FRECUENTES`,
`errorFrecuente`, `estadoDeLaNota`, `gestoMarcado`) · TarjetaTicket.tsx · MazoTickets.tsx · TablaTickets.tsx ·
BandejaTickets.tsx · bandeja.css · tests/ticketera-mazo.test.ts (B1, F1, G1, G3 y H1–H9)

---

## La Ticketera vuelve a ser un MAZO, con TABLA a elección y la cara de quien lo levantó (22/10/2026)

**El síntoma** (Martín, 22/10 13:18, con una captura de su Android): «La ticketera se ve horrible... vuelva la vista de
tarjetas y el desplazamiento tipo tinder... si quiero elegir la vista tabla también... ver quién levantó el ticket con su foto
de perfil, por donde lo levantó». La pantalla era una lista plana (`#6 MaKo no pudo «contestarte» · Mauricio Bustos ·
Mauricio Bustos Eguia · Pedido`), los cuatro chips, el interruptor a todo el ancho y un «Actualizar» suelto.

**Qué se tomó de quién** (búsqueda del 22/10; las ayudas de Superhuman e Intercom no dejan leerse enteras):
- **Tinder / Bumble**: la tarjeta sigue al dedo con un giro, sale si pasó un umbral (~100 px) o fue un tirón, y si no vuelve
  con resorte; los botones disparan el MISMO evento que el gesto. Y el «volver»: Bumble lo llamó *Backtrack* para el
  deslizamiento sin querer, que es exactamente el pedido del 14/10.
- **Superhuman (teléfono)**: dos gestos (izquierda «Done», derecha «Remind me») y una barra abajo con los mismos dos como
  botones. De ahí la franja del pulgar con un botón por gesto.
- **Linear Triage**: Accept / Decline (con comentario) / Duplicate / Snooze, con atajo. Son las acciones que ya tenía la
  Ticketera: derecha = Aprobar, izquierda = Rechazar, arriba = Preguntar. Snooze NO existe acá y no se inventó.
- **Front**: cada lado del deslizamiento es una acción configurable, y las respuestas guardadas. De ahí las respuestas
  guardadas de la caja (`RESPUESTAS_GUARDADAS`): se tocan para llenar, se editan, nunca salen solas.
- **Help Scout (teléfono)**: tocar la cara abre el perfil y su historial; arriba de la conversación, estado y hora. De ahí
  «Ver todo» → el ticket entero en una hoja.
- **Intercom**: una bandeja con todos los canales, y su comunidad pidiendo (julio de 2026) el canal AL LADO del nombre sin
  abrir la conversación. De ahí la insignia del canal sobre la foto.
- **Gmail («Deshacer envío»)**: no recoge el mail, lo DEMORA 5 a 30 s. Ver abajo.

**Los diagnósticos obvios que estaban mal:**
- **«Volver deshace la decisión en la base».** Una decisión no se recoge: Rechazar/Preguntar/Responder le avisan al cliente en
  el `after()` de la acción, y Aprobar le FIRMA el ticket al Cerebro desde el navegador. La regla (el método de Gmail): cada
  decisión del mazo ESPERA `VENTANA_DESHACER_MS` (8 s) antes de salir, y «Volver» (arriba, siempre; apagado si no hay nada) la
  saca de la espera: no llega nada a ningún lado. Si Martín se va de la pantalla (otra pestaña, la tabla, cerrar), lo que
  esperaba sale en el acto: lo decidió. Medido en el arnés: deslizar → «Aprobado · #5» → Volver a los 1,5 s → a los 10 s,
  cero llamadas al servidor.
- **«La foto es MiFoto».** MiFoto es la foto de MARTÍN (`/api/perfil` de quien mira). La de quien lo levantó es
  `usuarios.foto_url` por el FK `tickets.usuario_id`: `bandeja()` la trae con el embed `usuarios(foto_url)` (sólo https).
  Medido en producción (22/10, lectura): el embed responde, y el #5 y el #6 traen su foto. Quien escribió por WhatsApp sin
  usuario no tiene fila: va con iniciales (y la W si es un teléfono).
- **«Arriba» sobre una tarjeta con scroll.** El dedo vertical lo gana el scroll. La tarjeta NO scrollea (`touch-action:
  none`): lo largo se corta con un fundido y está entero en «Ver todo». Y `overflow: hidden` sigue siendo un contenedor de
  scroll para el FOCO (la caja con `autoFocus` puede correr el contenido): la tarjeta va con `overflow: clip`.
- **«El gesto sin texto manda igual».** Rechazar, Preguntar y Responder los rechaza el servidor sin texto
  (`motivoDecisionInvalida`). El gesto sin texto abre la caja de «lo que lee el cliente» y la tarjeta vuelve; no se manda nada.
- **«Lo que escribió» en un ticket automático** es el aviso fijo para el cliente («MaKo lo detectó solo…»): no se muestra como
  texto de la persona (`textoDeLaPersona`); lo que importa es el error, en corto y en letra de código.

**Por dónde entró** sale del canal y de `contexto.chat.donde` (`origenDe`): Automático (`error-mako` / `-navegador` /
`-servidor`), Chat de MaKo (`chat_app` / `chat_movil`), Reportar problema (`reportar-problema[-movil]`), WhatsApp y API. El link
ENTRA al negocio con `?ws=` (el «Inspeccionar» de la ficha; el proxy sólo se lo acepta a un admin): la conversación con MaKo
(`/second-brain?chat=<hilo>`) si se sabe, si no la pantalla. WhatsApp no tiene link: la conversación vive en el teléfono.

**Los cortes son del PANEL (container queries), no de la ventana.** En la compu, el panel del Ops Center a 1440 tiene ≈870 px
útiles (1440 − la barra − los chats − el relleno): la tabla va con anchos fijos y el título se parte en dos renglones; debajo de
720 px de panel cada fila es un renglón doble y el orden se elige con un selector (el teléfono DESTILA, no achica). Medido en
Chrome sin ventana: 375 (sin scroll horizontal ni vertical; el mazo entra entre la cabecera y la barra), 1024 (panel 492: la
tabla en renglón doble), 1440 (panel 908: el mazo con «lo que sigue» al costado, la tabla 866 de 868). En oscuro, `--good`,
`--bad` y `--primary` son CLAROS: el texto blanco encima no se leía (el botón «Hacer»); va con tinta oscura.

**Trampas del entorno:**
- La animación de salida no termina con la pestaña de fondo (sin cuadros, `onComplete` no llega): la tarjeta quedaba sin
  salir. La salida tiene un tope de 600 ms.
- El panel del navegador de Claude oculto tampoco dibuja: capturas que vencen y gestos que no corren (motion va con
  `requestAnimationFrame`). El arnés que sí mide y arrastra es Chrome sin ventana por CDP (`Input.dispatchTouchEvent`), con la
  bandeja REAL empaquetada con esbuild y las acciones de mentira.
- `scripts/tsc-acotado.mjs` con diez archivos dio «NO SE PUDO CHEQUEAR» (código 1, cero bytes) aun con `--heap=3584`; el mismo
  tsconfig con `tsc` directo pasó (código 0) y minutos después también cayó igual. **No es «la RAM de la PC» a secas: es el
  GRAFO** (la revisión, abajo). `acciones.ts` importa `lib/tickets-cierre`, que importa `app/admin/dev/registros` (TODAS las
  bitácoras), y `cerebro.ts` trae los tipos de `useCentro` (el Ops Center entero). `mazo-reglas.ts` con su test: 13 s;
  `MazoTickets.tsx` solo: el vigía lo mató a los 166 s. Lo que anduvo: una copia SOMBRA de la carpeta con esos dos imports
  cambiados por su tipo (`avisarTicket` declarado, `CerebroParaTickets` copiado), 243 s y código 0.
- El heredoc de la herramienta Bash rechazó dos scripts largos («unexpected EOF while looking for matching `'`»): los archivos
  de más de unas líneas, con el editor (como la trampa del `\b`, más abajo).

**Vive en:** app/tickets/bandeja/MazoTickets.tsx · TablaTickets.tsx · TarjetaTicket.tsx · mazo-reglas.ts · BandejaTickets.tsx ·
bandeja.css · lib/tickets-db.ts (`COLS_MARTIN`, la última nota) · lib/perfil.ts (`ticketeraVista`) · tests/ticketera-mazo.test.ts

---

## La revisión del mazo: lo que fallaba con la pantalla ABIERTA, y un link a otro sitio (22/10/2026, tarde)

El arnés midió el mazo recién abierto. Lo que se rompía era lo que pasa después, con el panel abierto una hora:

- **Un ticket que VUELVE a esperar a Martín no volvía al mazo.** El mazo recordaba «ya lo vi» por NÚMERO (un Set) para
  no traer de vuelta la lectura vieja de algo recién decidido. Pero Preguntar → el cliente contesta (`comentarComoCliente`) o
  Aprobar → el Cerebro lo devuelve (`reclasificar`, lo que pasó con el #5 y el #6) lo dejan otra vez «por decidir». El mazo
  decía «Nada por decidir» y la tabla, «Por decidir 1». **El diagnóstico obvio era «el refresco no lo trae»: lo traía; lo
  filtraba el mazo.** La regla: «visto» es la VERSIÓN (`id` + `updated_at`, que esos dos caminos tocan). La lectura vieja trae
  la misma versión y no vuelve; lo que cambió, sí (`refrescarMazo`, test D2).
- **Una tecla sostenida aprobaba un ticket detrás de otro.** → apretada: el `keydown` repetido decidía la tarjeta siguiente en
  cuanto la anterior terminaba de volar (~0,3 s), cada una con su pedido firmado al Cerebro a los 8 s. Y ← → sobre las pestañas
  Mazo / Tabla (que se recorren con flechas) aprobaban o rechazaban. Ahora `teclaDelMazo`: la repetida no decide, en las
  pestañas las flechas son de las pestañas, y con la caja abierta no deciden otra cosa (test C3).
- **«Ver la pantalla» podía abrir OTRO sitio.** `contexto.ruta` la manda el navegador del cliente, y `sanearContexto` sólo mira
  que empiece con una barra. `/.//malo.test` pasa, y `new URL(ruta, base).pathname` lo deja en `//malo.test`: escrito como
  href, es relativo al protocolo. El link se arma con el camino YA resuelto y se descarta si empieza con `//`, si el origen no
  es la base, o si es `/api/` (un GET ahí, con la sesión de Martín, actúa). La regla general quedó en AGENTS.md («Un guard de
  ORIGEN...»). Trampa vecina, hoy salvada de casualidad: `volverSeguro` (lib/meta-login.ts) devuelve `//malo.test/x` para
  `/.//malo.test/x`, y sus dos usos (`destinoDeVuelta`, `destinoGcal`) lo vuelven a parsear y terminan en `/x`.
- **Una lectura pedida en el medio de otra se perdía**, y la que estaba en vuelo había salido ANTES de la decisión: la tabla
  mostraba lo recién decidido como estaba, hasta 30 s. Y si la PRIMERA lectura fallaba, la vista (mazo o tabla) no llegaba
  nunca (los refrescos no la piden): «Cargando…» para siempre y sin el botón de reintentar. Ahora `lectorDeBandeja`: lo
  pedido en el medio se lee al terminar, y la vista se pide hasta que una lectura que anda la trae (test D3).
- **J / K de la tabla recorrían en el orden de llegada**, no en el que se ve si se ordenó por otra columna: el orden lo
  guarda la bandeja y lo recibe la tabla (test E3).

**Vive en:** app/tickets/bandeja/mazo-reglas.ts (`refrescarMazo`, `teclaDelMazo`, `lectorDeBandeja`, `linkDeOrigen`) ·
MazoTickets.tsx · BandejaTickets.tsx · TablaTickets.tsx · tests/ticketera-mazo.test.ts (A2b, C3, D2, D3, E3, probados rompiendo)

---

## La Ticketera del teléfono era el mazo viejo, y traer la bandeja no alcanzaba (17/10/2026)

**El síntoma**: Martín abría el Ops Center en el teléfono y la fila «Ticketera» seguía llevando al mazo de las preguntas de los
chats; la bandeja de los tickets de los clientes sólo existía en la computadora.

**El diagnóstico obvio era el equivocado, dos veces.**
- «Se monta `BandejaTickets` en la página del teléfono y listo»: la bandeja lee y decide con sus propias acciones de servidor, pero
  **«Aprobar» le firma el ticket al chat Cerebro desde el navegador** (`cerebroDelCentro`, app/tickets/bandeja/cerebro.ts), y eso sale
  del motor del Centro (`useCentro`: la firma, la lista de chats, el estado del Runner). Sin él, `cerebro` queda en `null` y
  Aprobar deja el ticket «en curso» sin entregar y con un cartel que miente («No hay un chat Cerebro en Ops Center»: el chat existe, es la pantalla la que no lo ve). La pantalla del teléfono monta
  `useCentro` con los mismos datos que la lista de chats (`TicketsMovil`).
- «La ruta ya viaja»: `/admin/operaciones?ticketera=tickets` —el ítem «Ticketera» de la barra, los links «revisar» de las
  bitácoras— **se convertía en `/m/operaciones` a secas**: `rutaMovil` sólo dejaba pasar `tarjetas` y `lista`. En el teléfono todo
  link a la Ticketera nueva caía en la lista de chats, sin error.

**La regla**: una pantalla que FIRMA algo desde el navegador lleva el motor de la firma, aunque lea sus datos sola; y una vista
nueva de una query (`?ticketera=`) se da de alta en las TRES puntas: la página, `rutaMovil` y `rutaEscritorio`
(tests/ticketera-movil-y-avisos.test.ts). El teléfono tiene dos filas, una por paso: «Ticketera» (los tickets, con su número) y
«Preguntas de los chats» (el mazo de siempre).

**Vive en:** app/m/operaciones/TicketeraMovil.tsx · app/m/operaciones/page.tsx · app/m/operaciones/CentroAppMovil.tsx ·
lib/movil-rutas.ts · app/tickets/bandeja/bandeja.css (la hoja se importa en la PÁGINA, no en el componente)

---

## La Ticketera no mostraba si el aviso llegó: el dato estaba, y el renglón del historial sólo existe si salió (17/10/2026)

**El síntoma**: Martín decide, el cliente «debería enterarse», y nadie podía ver si se enteró. Una pendiente de siempre
(docs/hallazgos-operaciones.md) la daba por «el dato está, la pantalla no lo dibuja».

**Medido** (17/10/2026, leyendo la bandeja): `avisado_at` no se dibujaba en ninguna parte y `aviso_estado` tampoco; `aviso_at` ni
siquiera se pedía (`COLS`). Lo único visible era el renglón del historial `Aviso al cliente: push, chat` (lo escribe `avisarUno`), y
ése existe **sólo cuando el aviso SALIÓ**: el aviso que no sale no deja nada que mirar, que es justo el caso que importa.

**Lo que hay que saber para leerlo**:
- hay DOS avisos y no son lo mismo: `avisado_at` es el aviso **al cliente** (se marca si salió por ALGÚN canal; un negocio sin push,
  sin hilo y sin grupo no lo recibe nunca y el cron lo reintenta cada 15 min para siempre); `aviso_estado` es la entrega **al
  Cerebro** de un bug del triage (`despacho = 'runner'`), con sus 5 intentos;
- «sin avisar» se cuenta desde el CIERRE (`resuelto_at` / `decidido_at`), no desde `updated_at`, que se mueve al cambiar la prioridad;
- el umbral es el doble del cron (30 min): antes de eso es «Avisando…», después es «no salió».

⚠️ **Con datos reales no se pudo probar**: el 17/10 ~15:55 AR la tabla `tickets` de producción tenía **0 filas** (conteo de sólo
lectura, sin leer ningún texto). Los avisos están fijados por tests con filas armadas a mano; el primer ticket real es la prueba que falta.

La bandeja ahora tiene un bloque «Avisos» en cada ticket y marca «⚠ sin avisar» en la lista; el mazo viejo dice en cada contestada si
el aviso llegó al chat (`vistaDelAviso`). Las reglas están en lib/tickets-aviso.ts y lib/decisiones-aviso.ts (puras, con test).

**Vive en:** lib/tickets-aviso.ts (`avisoAlCliente`, `entregaAlCerebro`) · lib/decisiones-aviso.ts (`vistaDelAviso`) ·
app/tickets/bandeja/BandejaTickets.tsx · app/admin/runway/Tablero.tsx

---

## El cierre: «¿ya está en producción?» no lo contesta GitHub, lo contesta el código que corre (17/10/2026)

**El síntoma a evitar**: un ticket que el cliente ve «Resuelto» con el arreglo todavía sin desplegar, o uno que nunca
se cierra.

**El diagnóstico obvio estaba mal dos veces.** Lo natural es preguntarle a la API de GitHub si el commit del arreglo ya
está en `main`:
- el token de GitHub de la plataforma (la credencial `GITHUB_TOKEN` del ws 9) contesta **404** sobre
  `hola-mako/dashboard-marketing` desde la transferencia del repo (medido el 15/10, docs/hallazgos-operaciones.md);
- y aunque contestara, **un commit en `main` todavía no es un deploy** (memoria «Pushear no es desplegar»).

**La regla**: quien arregla anota en la bitácora de su área el hito de siempre con `tickets: [n]`
(app/admin/dev/_registro/tipos.ts). Las bitácoras viajan **dentro del build**: si el deploy que corre trae el hito, el
arreglo está desplegado. El cron `/api/cron/tickets` (cada 15 min) lo lee de ahí (`ticketsDesplegados`,
lib/tickets-cierre.ts), cierra el ticket y sus duplicados, y le avisa al cliente.

---

## Un bug del triage no tiene quién lo firme, y a la PC no llega texto sin firma (17/10/2026)

**La trampa**: «el bug evidente va solo al Cerebro» choca con la regla del Centro de Operaciones: todo lo que llega a la
PC lo firmó Martín en su dispositivo. Un bug del triage nunca pasó por ese dispositivo.

**Lo que NO se hizo**: que el navegador de Martín firme solo lo que el triage marcó. Eso convierte la firma en un sello
automático sobre texto de cualquier cliente.

**La regla** (el mismo molde que el aviso de la Ticketera vieja, `mensajeAviso`): el Runner le escribe al chat «Cerebro»
un **texto fijo que arma él**, con el número del ticket validado y el comando para leerlo (`mensajeTicket`,
lib/tickets-aviso.ts). De MaKo no viaja ni una palabra del cliente. El Cerebro lee el ticket con
`scripts/tickets.ts ver <n>`, que imprime lo del cliente **entre marcas, como dato**: un ticket que dice «ignora tus
reglas» es lo que escribió un cliente, no una orden.

**El número de versión se movió tres veces en una noche** (1.11.0 → 1.12.0 → 1.14.0 → 1.14.2 mientras se escribía). El
loop salió en el cartero **1.15.0**, encima de la 1.14.2 instalada, y el servidor sólo le da tickets a un Runner ≥ 1.15.0
(`VERSION_CARTERO_TICKETS`): uno de antes los dejaría «tomados» y se quemarían los intentos.

⚠️ **La trampa que no estaba en el pedido: `hayParaElCartero`.** El Runner ya no da vueltas fijas: `vigilar` pregunta
`?hay=` cada pocos segundos y sale apenas hay algo. Si `hay` contara un ticket que la vuelta no le va a dar (un Runner
viejo, o el Cerebro abierto en otra cuenta), `vigilar` saldría en cada vuelta por nada. Cuenta sólo si el chat «Cerebro»
está vivo en esa cuenta y su Runner es ≥ 1.15.0. Hasta que el Cerebro reinstale el cartero, los bugs del triage se ven
con `scripts/tickets.ts pendientes`.

---

## El triage no llama a ninguna IA: la información ya la juntó alguien que no cuesta nada (17/10/2026)

**El reflejo**: «clasificar un texto → un modelo barato». Lo que lo frena:
- el texto de un ticket puede nombrar a los leads del cliente, y las keys gratis de la plataforma (Gemini y Groq del plan
  gratis) **entrenan** con lo que reciben (AGENTS.md, «LOS DATOS DE LOS CLIENTES DE UN CLIENTE NUNCA VAN A UN PROVEEDOR
  QUE ENTRENA»); Claude por API está vetado salvo excepción de Martín;
- y la señal fuerte ya existe sin modelo: **el error lo registró el código** al fallar (la señal de Sentry: un fallo que
  el sistema vio no es una opinión), y **el tipo lo propuso MaKo** con la IA que ya estaba leyendo esa conversación.

**La regla**: reglas puras con su porqué (`clasificar`, lib/tickets-reglas.ts), arreglo automático sólo con confianza
alta, y el juicio caro («¿es un bug de verdad?») lo hace el Cerebro antes de tocar código, con Claude Code (pago con la
suscripción, no entrena). Si no lo es: `scripts/tickets.ts reclasificar <n> pedido --porque "…"`.

---

## Un 400 no es un bug, y un 404 tampoco (17/10/2026)

`runnerDelRegistro` (lib/api-mako/ejecutar.ts) devuelve **texto** para un 400 (un pedido corregible: «falta el monto»,
«no encontré ese lead») e `isError` para un 404 o un 500. Si el chat propusiera un ticket por cualquier `ok: false`, cada
dato que falta sería un bug. Y de los `isError`, «operación desconocida» y «no está disponible en este chat» son del
MODELO (inventó un nombre o llamó a algo que no viajó), no de MaKo. Sólo lo demás cuenta (`errorParaTicket`).

---

## «Reportar problema» existía en el menú y no lo podía abrir casi nadie (17/10/2026)

Tres cosas, ninguna con error:
- el ítem de nav.ts decía `rolesWs: ['closer', 'setter']`, pero la página pedía `requireRolWs([])` (sólo admin): al
  closer se lo redirigía;
- la capa `pm` no tenía `tickets` en `userNavKeys`: ni lo veía;
- `requireRolWs` frena por el onboarding: el que está trabado a la mitad del wizard —el que más necesita reportar algo—
  no podía entrar. Va con `gateOnboarding: false`.

---

## La campanita no le llega a UNA persona (17/10/2026)

`notificaciones` es **por workspace** y `/api/notificaciones` devuelve vacío para quien no es admin: un closer no la ve. Para
avisarle a la persona que levantó el ticket se usa lo que sí tiene destinatario: un **push** a sus teléfonos
(`enviarPushAUsuario`), un mensaje en **el hilo del chat** donde lo levantó (`contexto.chat.hilo`), o el grupo de
WhatsApp del negocio. Y `/tickets` es la bandeja: si el aviso no llega, el estado igual está ahí.

---

## Quién lo levantó se fija al PROPONER (17/10/2026)

Una pendiente del chat la puede confirmar otra persona: el admin, desde la bandeja de pendientes del negocio. Si el
ticket tomara el `ctx.actor` de la confirmación, sería del admin. El email va en el payload desde `preparar()`
(lib/api-mako/areas/tickets.run.ts).

---

## Los errores de la app: la huella no puede llevar el stack, y un error del servidor llega sin mensaje (17/10/2026)

Martín: «córrelo en toda la app... Y todo lo solucionas automáticamente». Tres cosas que no se ven en el código:

- **El reflejo es agrupar por stack, y abre un ticket por deploy.** En producción el stack del navegador está minificado y
  los archivos llevan un hash que cambia en cada build (`page-abc123.js` → `page-zz9999.js`). La huella es el tipo, el
  mensaje sin números ni citas y la pantalla sin ids (`huellaDe`, lib/errores-app-reglas.ts). El stack se guarda, pero
  no agrupa.
- **Un error del SERVIDOR le llega al navegador sin su mensaje**: Next lo cambia por «An error occurred in the Server
  Components render… omitted in production» y deja sólo el `digest`. Si el boundary lo reportara, todos los errores del
  servidor caerían en UNA huella sin información. Lo reporta el servidor (`onRequestError`, instrumentation.ts) con el
  error real, y el boundary lo saltea.
- **Lo que parece un error de MaKo a veces es del proveedor de IA.** Un 503 o el cupo de Gemini hacen que MaKo «no pueda
  contestar», y el Cerebro no lo arregla: va a `RUIDO`, igual que una pestaña vieja después de un deploy
  (`ChunkLoadError`), una extensión del navegador o la red cortada.

**La decisión que cambió**: un error en un chat de MaKo ya no se le propone a la persona como tarjeta («¿se lo mando al
equipo?»): se registra solo, y a la persona se le dice «le avisé al equipo» sólo si entró. La tarjeta queda para lo que
pide algo que la app no tiene (`levantar_ticket` con `noExiste`).

⚠️ **Una trampa del entorno que costó un rojo silencioso**: un script de Python pasado por el heredoc de la herramienta
Bash convirtió el `\b` de una regex en un carácter de control (el retroceso). La regex quedó «válida» y sin hacer nada.
Lo cazó la revisión del archivo con `cat -A`. Para editar código con barras, el editor; nunca un heredoc.

---

## Un negocio sin IA no es un bug: la Ticketera abrió el #5 y el #6 por algo que el código no arregla (18/10/2026)

**El síntoma**: dos tickets de bug de Mauricio (ws1), con arreglo automático, por «MaKo no pudo contestarte». El #5 decía
«Claude vetado» (ése sí era de código y ya salió: el `catch` del registro se tragaba el error) y el #6, ya arreglado eso,
«falló la IA (sin proveedor gratis disponible)».

**La causa**: la cascada con herramientas no tuvo NINGUNA cuenta que probar. Desde el 16/10 una key de la plataforma copiada
en la fila de un negocio no cuenta como suya, y en el ws1 no queda ninguna (el porqué, que es más hondo:
[hallazgos-integraciones.md](hallazgos-integraciones.md) → «El ws1 no puede tener una IA propia»). No hay nada roto: falta
la IA del negocio, que es la decisión A de Martín (cada negocio conecta la suya).

**La regla**: un fallo porque al negocio le falta algo SUYO es configuración, no un bug (`esDeConfiguracion`,
lib/errores-app-reglas.ts): `registrarError` lo descarta antes de la huella, y el chat le dice a la persona qué hacer, con el
botón que abre el modal ahí mismo (`faltaIADelNegocio` y `conectar`, lib/mako-turno-app-reglas.ts). Se reconoce por el texto
que escribe la cascada cuando no había con qué probar, y por la cuenta de cuentas propias con la MISMA lectura que usa la
cascada (`provsDe`): una lectura propia de «¿tiene IA?» diverge en silencio. «falta RESEND_API_KEY» del servidor sigue siendo un
bug: es de la plataforma.

**Vive en:** lib/errores-app-reglas.ts · lib/errores-app.ts · lib/mako-turno-app.ts (`iaPropiaDelTurno`) · lib/mako-turno-app-reglas.ts · app/_chat/ConectarDelAviso.tsx · tests/mako-sin-ia.test.ts

---

## «No se entiende» la tarjeta del #5: lo técnico ya estaba plegado; faltaban el DÓNDE y QUÉ decidir (23/10/2026, feedback 7)

**Síntoma (Martín, con captura):** la tarjeta «MaKo no le pudo contestar a Mauricio» no se entiende. Él quería tres cosas: DÓNDE
(qué chat o tab), POR QUÉ en palabras, y QUÉ hay que decidir. Lo técnico, plegado.

**El diagnóstico obvio era el equivocado:** no es una decisión de `admin_decisiones` ni del bloque del Ops Center. Es un ticket de
la tabla `tickets`, y su frase se arma al dibujar (app/tickets/bandeja/mazo-reglas.ts → `leerTicket`). Y lo técnico («Claude
vetado — lib/veto-claude.ts») ya iba plegado en «Detalle» desde el 22/10: lo medido en producción el 23/10 lo confirma. Lo que no
se entendía era el resto:
- «en su chat» sin decir cuál;
- «→ Conectar su IA» y «Estado: el código ya está arreglado · lo decides tú», que no dicen qué se decide.
- Los cuatro botones son redondos y sin rótulo: ↺ ✕ ↑ ✓.

**Cómo quedó:**
- **DÓNDE:** la bandeja suma a cada ticket el título y la clave del chat donde falló MaKo (`conChatDeLosTickets`: una lectura de
  chart_sessions por `contexto.chat.hilo`). La tarjeta dice «En el chat de CRM «Ana»» o «En su chat «X» del Ops Center», con
  `origenDeClave`, y vale también para los tickets viejos. Sabiendo cuál, la frase ya no repite «en su chat».
- **POR QUÉ:** «No tiene su IA conectada (Claude o GPT), y MaKo no presta la suya»: la regla del 22/10, cada negocio usa su IA.
  El texto de antes, «No tenía una IA», no decía de quién era lo que faltaba.
- **QUÉ decidir:** una pregunta que se contesta con el ✓ (`queDecide`), por ejemplo «¿Le pedimos a Mauricio que conecte su IA?».
- **El deshacer:** sale de la fila de botones y va arriba, a la franja de «1 de N», como un «Deshacer» sutil que aparece sólo con
  algo para deshacer. ⌫ y Ctrl+Z siguen igual.

**Trampa para lo que venga:** a lo que dice la tarjeta lo fija tests/ticketera-mazo.test.ts (F1, G1, H2); al dónde de la base,
tests/ticketera-tarjeta-7.test.ts. MazoTickets.tsx lo toca también Chats de las tabs (el «Reportar a Soporte»), en otro lugar
del archivo.

**SIN HACER:** los tickets nuevos podrían guardar el chat al abrirse (en `registrarError` desde lib/mako-turno-app.ts:
`s.titulo` y `entrada.desde.tab`), y así no habría que buscarlo después. Eso pasa por tres saneadores que tiran lo que no
conocen: `sanearReporte`, `ticketDeError` y `sanearContexto`. Ojo: `chat.donde` acepta como mucho 40 caracteres de `[a-z0-9-]`.
Lo que falla por WhatsApp no trae `hilo`, así que no dice dónde.

## Todo «no pude» de MaKo abre un ticket SOLO (Martín, 27/10/2026, 20:37)

**Vive en:** `lib/no-existe*.ts` (rama `mako-inteligente-2710-c4`) · `lib/tickets-reglas.ts` · `lib/tickets-db.ts` · `lib/mako-turno-app.ts`

- **La decisión de Martín:** «Siempre que MaKo responda algo como "No lo pude hacer" debe levantar automáticamente un
  ticket». Reemplaza, para ese caso, el «MaKo PROPONE la tarjeta» del 17/10.
- **Medido en producción (14 días, sólo GET):** el detector de «no puedo» marcó 15 de 105 respuestas de la app y 11 de 192
  de WhatsApp. En ese tiempo sólo se registraron 2 huellas de MaKo. Hoy abren ticket solos únicamente el error de una
  herramienta y la falla de la IA nuestra. Quedan afuera:
  - la acción confirmada que falla al ejecutarse;
  - el «no puedo» que sólo está en el texto;
  - los carteles de IA;
  - los chats de los editores.
- ⚠️ **El vigía no lo cubre:** el cron está apagado en producción, porque no existe la marca `mako.vigia.grupos`, y el
  script de la sesión avisa por mensaje, no abre tickets.
- **Decisiones del Cerebro:**
  - Lo que falla por el proveedor (la IA sin crédito) o por la configuración SÍ abre ticket, como dijo Martín. Abre uno solo
    por negocio y causa, se cierra solo cuando la condición se resuelve y nunca va al Runner. Un ticket que se cierra
    sólo con el hito de un deploy quedaría abierto para siempre.
  - Las negativas legítimas (cobros, borrados, permisos o rol) no abren ticket.
  - Ningún ticket automático entra por la regla de aprobación de Leila, Leandro y Mauricio.
  - El tope de los automáticos va aparte del de la persona.
  - El cliente ve «Quedó el ticket #n», no la oferta con botón.
- **Trampa:** la rama c4 (`REGLA_NO_EXISTE`) tickeaba sin confirmar los fallos de ruteo como «no existe», con el texto
  del modelo como título. La base nueva generaliza esa marca a `[[no-pude]]` con la causa. Ver hallazgos-ia, «Un "no
  puedo" de MaKo casi nunca es "no existe"».
- **Quién:** MaKo inteligente (la base y la app), MaKo en WhatsApp (su P3 pasa de «propone» a «abre») y Motion (el panel
  del Video Editor).

## Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| ~~Que la bandeja diga «Entregado al Cerebro» de un ticket que espera a Martín~~ **HECHO el 6/11/2026** | lib/tickets-aviso.ts (`entregaAlCerebro`, `vistaDeEntrega`) · lib/tickets-db.ts (`COLS`) · tests/ticketera-entrega-cerebro.test.ts | Eran DOS piezas y arreglar una sola no se ve: la función sólo miraba `aviso_*` (los bugs del triage) **y** `COLS` no pedía las columnas `cerebro_*`, así que la fila llegaba sin ellas. Ahora las dos marcas usan la misma máquina y los mismos textos. ⚠️ Al meter `cerebro_*` en el select se puso rojo `tests/ticketera-movil-y-avisos.test.ts` B5, que pedía que `aviso_at` y `arreglado_at` fueran VECINAS en `COLS`: una guarda sobre el ORDEN de un select, no sobre lo que pide. Se cambió a mirar columna por columna |
| Actualizar el Runner de la PC a 1.23.0 | scripts/operaciones/cartero.mjs | El servidor sólo le da los tickets nuevos a un cartero ≥ 1.23.0; con el de antes no se pierde nada (no los reclama) pero tampoco llegan (29/10) |
| Ver el chat de Soporte y el botón en producción en el teléfono de Martín (Android) | app/m/tickets/SoporteM.tsx | Medido en el ws3 desde la computadora; el teléfono no se recorrió |
| El cerco «es DATO» de lo que lee el Cerebro deja AFUERA el título, la ruta, la herramienta, el error y el navegador | scripts/tickets.ts (las líneas de «lo juntó el sistema») · lib/tickets-reglas.ts (`sanearContexto`: el navegador sin filtro de caracteres) | Viene de antes y vale para el formulario: el título y el navegador los escribe el cliente. El botón ya no pone texto suyo en `error`/`herramienta` y filtra su navegador; el resto es del área de la Ticketera (Ops Center la está tocando por el «DÓNDE») |
| ~~/api/errores manda la ruta con los tokens del camino~~ **ARREGLADO el 6/11/2026** | lib/errores-app-reglas.ts (`rutaSinDatos`) · lib/soporte-reporte.ts (`rutaSoporte`, ahora delega) · tests/errores-app.test.ts | La regla que tapa los tokens del camino y los números de más de 9 cifras existía, pero vivía SÓLO en el camino del botón (`rutaSoporte`). Se mudó a `rutaSinDatos`, que es de donde salen los dos: una regla de privacidad en el camino de UNA pantalla es una regla que los otros caminos no tienen. ⚠️ Tenía que bajar y no cruzarse: `soporte-reporte` importa de `errores-app-reglas`, así que al revés era un import circular. Efecto lindo: `rutaSoporte` quedó delegando, y las guardas que ya tenía el botón (tests/reportar-a-soporte.test.ts, tests/curso-soporte-alumno.test.ts) ahora cubren también /api/errores |
| Un canal propio para «Reportar a Soporte» | supabase/migrations (el `check` de `tickets.canal`) · lib/tickets-reglas.ts (`CANAL_PARA_EL_CLIENTE`) | Hoy sale por `formulario` y el cliente lo ve «Desde «Reportar problema»». Un canal nuevo es una migración |
| Una captura de pantalla en el ticket del botón | app/_ui/ReportarASoporte.tsx | El reporte lleva el texto del aviso, no la pantalla: una captura traería los datos de los leads que se ven. Decisión de producto |
| MaKo de Soporte con IA | lib/soporte-chat.ts | Son reglas. Con IA podría contestar una pregunta sin levantar un ticket, pero pagaría o usaría la del negocio (que puede ser lo que falla) |
| Ver el mazo y la tabla en el teléfono de Martín (Android) | app/tickets/bandeja/MazoTickets.tsx | 22/10 (dos veces, la segunda con la tarjeta clara): medido en Chrome sin ventana a 375, 1024 y 1440 con los #5 y #6 reales y datos de prueba; la app no se levantó (`next dev` escribe en producción). El modo oscuro de la tarjeta clara no se midió |
| Devolver un ticket que no es «algo nuevo» | scripts/tickets.ts (`reclasificar`) · lib/tickets-aviso.ts (`mensajeTicket`) | El Runner le pide al Cerebro `reclasificar <n> pedido` para TODO lo que no es un bug («es algo nuevo, o no se entiende»), y lo de configuración (el #5 y el #6) queda como «Pedido». Una casilla o un `devolver <n> --porque` que no lo meta en «pedido» es decisión de producto |
| Qué hace el ✓ con un ticket de CONFIGURACIÓN | app/tickets/bandeja/mazo-reglas.ts (`accionesDe`) | El #5 y el #6 piden «Conectar su IA», y el ✓ dice «Hacer»: le firma al Cerebro «HACERLO (es algo nuevo)», que sirve si MaKo paga la IA y no si la conecta el negocio (ahí van ↑ Preguntar o «Responder» en el ticket entero). Hasta la revisión del 22/10 (noche) firmaba «ARREGLARLO (es un bug)», peor. Es una decisión de producto |
| OpenAI sin crédito no abre ticket | lib/errores-app-reglas.ts (`RUIDO`) | «429 You exceeded your current quota» calza con `\b429\b` y `quota`, que son «el proveedor no contestó»: es ruido y no hay ticket, pero reintentar no lo arregla (hay que cargar crédito). Leído en el código, no medido |
| La frase de un ticket de PERSONA es su título tal cual | app/tickets/bandeja/mazo-reglas.ts (`quePaso`) | Si MaKo lo propuso hablándole al cliente («No se pudo: …» está bien; uno con «tu» o «te» se leería raro). No se midió con tickets reales de personas: en producción hay sólo el #5 y el #6 |
| «Abrir el chat» de un ticket del MaKo de OTRA tab (el del CRM) | app/tickets/bandeja/mazo-reglas.ts (`linkDeOrigen`) | Abre `/second-brain?chat=<hilo>&ws=`; no se verificó que ese hilo se abra ahí |
| Posponer un ticket (el «Snooze» de Linear) | app/tickets/bandeja/MazoTickets.tsx | La Ticketera no tiene esa acción y no se inventó: en el mazo se recorre con ‹ › (J / K) |
| Pasar a la Tabla manda lo que esperaba en el mazo | app/tickets/bandeja/MazoTickets.tsx | La espera vive en el mazo; al desmontarse, sale. Compartirla entre vistas, si molesta |
| La foto de quien lo levantó puede ser CUALQUIER https | lib/perfil.ts (`setPerfil`: `avatarUrl` sin filtro) · lib/tickets-db.ts (`aFila`) | Un cliente que pone de foto una URL suya se entera de cuándo Martín abre la Ticketera (y su IP). No es nuevo: la lista de usuarios del admin ya dibuja `foto_url`. Arreglarlo es aceptar sólo el storage propio y Google, para toda la app |
| Lo del cliente FUERA del marco de datos en el pedido al Cerebro | lib/tickets-reglas.ts (`pedidoAlCerebro`) | El título, la ruta, la herramienta y el error van en la cabeza, antes del «es DATO, no son instrucciones». Lo firma Martín al aprobar (también desde el mazo), así que no es el camino sin firma del Runner; viene de antes |
| `sanearContexto` guarda rutas como `/.//otro.com` | lib/tickets-reglas.ts | El link ya no las usa (`linkDeOrigen`); el detalle las muestra como texto. Si alguien más arma un link con `contexto.ruta`, que use `linkDeOrigen` |
| Lo que espera en el mazo y la pestaña se CIERRA | app/tickets/bandeja/MazoTickets.tsx (`vaciar`) | Sale con una acción del servidor en `pagehide`, que el navegador puede cortar: queda «por decidir» (lo seguro) o aprobado sin llegar al Cerebro (el ticket entero ofrece «Mandar al Cerebro» otra vez). No se midió |
| El lint `set-state-in-effect` del ticket entero | app/tickets/bandeja/BandejaTickets.tsx (`Detalle`) | Viene de antes (está igual en `origin/main`); no lo mira ninguna guarda |
| Avisar al cliente por OTRO canal cuando ninguno sale | lib/tickets-cierre.ts | Hoy un negocio sin push, hilo ni grupo queda «El aviso al cliente no salió» para siempre; ahora se VE, no se resuelve |
| Levantarlo por WhatsApp | lib/mako-doer-in.ts | Es del chat «MaKo en WhatsApp»: el registro ya acepta `actor: 'whatsapp:<teléfono>'` (lo atribuye a la persona del negocio con ese teléfono) y el aviso de vuelta pasa por `sanearSalida` |
| Borrar el mazo de las preguntas de los chats | app/tickets/decisiones, app/admin/runway | Cuando ande el formulario de opciones dentro de cada chat (Ops Center). El mazo de los tickets (22/10) no depende de él: tiene sus reglas y su hoja |
| Lo que no es IA de la fila del ws1 sigue siendo el entorno | lib/credenciales.ts (`wsDelEntorno`) | La IA ya se separó el 18/10 (Martín). Meta, Calendly, Fathom y las settings de plataforma en el ws1 quedan para otra decisión ([hallazgos-integraciones.md](hallazgos-integraciones.md)) |
| El doer de WhatsApp cuenta las copias como keys del negocio | lib/mako-doer-in.ts (`contarKeysIA`) | Cuenta `clavesCargadas`, con las copias de la plataforma: en el ws1 nunca daría `sin_keys`. Leído en el código, no medido. Es del chat «MaKo en WhatsApp» |

## Un negocio aprobado por regla (Leandro) va por el arreglo automático, no por una firma de Martín (26/10/2026)

**El pedido:** Martín, desde el Centro: «los tickets que vengan de Leandro pasen 100% sin mi aprobación... y tú después le tienes
que ir avisando... por el grupo de WhatsApp de MaKo los tickets que ya van siendo resueltos».

**Lo que no era obvio:** «como aprobado por Martín» NO puede ser el camino de «Aprobar»: ese firma un pedido en el dispositivo
de Martín, y el servidor no firma por él. El camino que ya existía sin Martín es el del arreglo automático (`despacho:
'runner'`): el Runner le escribe al Cerebro un texto FIJO con el número. Ese texto dice «bug evidente» y que un pedido se
devuelva a Martín, y cambiarlo pide un cartero nuevo en cada PC. Por eso la regla viaja en el triage (`regla`) y la lee el
Cerebro en `scripts/tickets.ts ver`, que le dice que NO lo reclasifique.

**La regla:**
- `APROBADOS_POR_REGLA` (lib/tickets-reglas.ts) es la lista: hoy, el ws 10 (Leandro). Su ticket va al arreglo automático sea bug,
  pedido o pregunta, y lleva la marca «Aprobado por regla: Leandro» en la bandeja y en lo que lee el Cerebro.
- Sigue esperando a Martín lo delicado (`zonaSensible`), lo que escribe en producción (`ESCRIBE_EN_PRODUCCION`) y todo con el
  interruptor apagado. Lo que choca con una decisión de Martín no se ve en el texto: lo frena el chat que lo trabaja.
- El tope de 8 arreglos por día no lo frena (Martín pidió el 100%). Al quedar desplegado (el hito con `tickets: [n]` en ESE build),
  el aviso va a su grupo de MaKo por `avisarArregloAlGrupo` (lib/tickets-cierre.ts), salvo que el ticket haya venido por WhatsApp.

**Lo que quedó SIN hacer:** el texto fijo del cartero (`mensajeTicket`, scripts/operaciones/cartero.mjs) sigue diciendo «bug
evidente» también para un pedido de Leandro. Lo corrige lo que lee el Cerebro, no el texto; cambiarlo pide un cartero nuevo.

**Vive en:** `lib/tickets-reglas.ts` (`APROBADOS_POR_REGLA`, `clasificar`) · `lib/tickets-db.ts` (`crearTicket`) ·
`lib/tickets-cierre.ts` (`avisarUno`) · `scripts/tickets.ts` (`ver`) · `app/tickets/bandeja/BandejaTickets.tsx` · `tests/tickets-por-regla.test.ts`

## Un ticket que levanta alguien de AFUERA del negocio: el alumno de un curso (27/10/2026, 874749710-18)

El alumno reporta desde su portal y el ticket le llega al DUEÑO del curso (el lado del portal, en
[hallazgos-customer-success.md](hallazgos-customer-success.md) → «El alumno reporta a soporte con su token»). Lo que hay que
saber antes de abrir otra puerta así:

- **El ticket es del dueño, no del alumno.** Lo del cliente se lee por (workspace, email): un ticket a nombre de
  `alumno:<lead>` no lo vería nadie más que Martín en la bandeja. El dueño lo ve en su Ticketera y le llega el aviso cuando se
  resuelve; la descripción dice que lo reportó un alumno y su ficha (`/crm/<id>`), nunca su nombre.
- ⚠️ **La regla de Leandro abría el arreglo automático a cualquiera con el link de su curso.** `aprobadoPorRegla(ws)` mira sólo
  el negocio: un alumno del ws 10 que escribiera «dejó de andar» mandaba SU texto al Runner. `crearTicket` con `tercero` pasa
  `deTercero` al triage, que corta antes de la regla: lo decide Martín, siempre.
- ⚠️ **El tope del día se le gastaba al dueño.** Se cuenta por (workspace, email) y el email es el del dueño: unos pocos alumnos
  lo dejaban sin tickets el día. El de un tercero se cuenta por el comienzo de su `ref` (`alumno:<ws>:<lead>:`,
  `TOPE_POR_DIA_TERCERO` = 3), y `crearTicket` rechaza una `ref` que no empieza con su clave.
- ⚠️ **`rutaSoporte` dejaba pasar el token del portal entero.** Reconocía un token como un segmento de letras, números, `_` y
  `-`; el del portal es `c1.<ws>.<lead>.<versión>.<firma>`, con puntos, y pasaba tal cual a la pantalla del ticket: la
  credencial del alumno a la vista del equipo y del Cerebro. Ahora el punto cuenta, y además la ruta del alumno pone la pantalla
  del portal ella misma (`rutaDelPortal`).

**Vive en:** `lib/tickets-db.ts` (`crearTicket`, `tercero`) · `lib/tickets-reglas.ts` (`clasificar`, `deTercero`,
`TOPE_POR_DIA_TERCERO`) · `lib/soporte-reporte.ts` (`rutaSoporte`, `ticketDelAlumno`, `claveDelAlumno`) ·
`tests/curso-soporte-alumno.test.ts` (6 roturas, cada una cae)

## Leila con vía libre «hasta un día», y la regla le llega al Cerebro por un nombre que el cartero ya conoce (27/10/2026)

**Lo decidido:** Martín le dio a Leila (ws 11) la vía libre en la llamada del 26/10, y el Cerebro la configuró así: lo que el
triage estima en MÁS DE UN DÍA de trabajo va a Martín (`hastaUnDia`).

**Lo que no era obvio:**
- «Más de un día» no lo puede estimar el triage con una IA (no paga IA, es una decisión). Se estima con reglas
  (`estimaMasDeUnDia`): un pedido que nombra algo grande (integrarse con otro servicio, una pantalla o una app nueva, rehacer
  algo entero) o de más de 1500 caracteres. Un bug o una pregunta, nunca. En la duda va a Martín.
- El cartero no toma texto de MaKo para el mensaje que le escribe al Cerebro (si MaKo estuviera comprometida, lo peor tiene
  que ser que no llegue). La regla viaja como un NOMBRE, y el cartero 1.20.0 la usa sólo si está en `REGLAS_CONOCIDAS`, su copia
  de `APROBADOS_POR_REGLA` (test diferencial). Sumar a alguien a la regla pide sumarlo en las DOS listas y una instalación.

**Lo que quedó SIN hacer:** instalar el cartero 1.20.0 en cada PC. Hasta entonces el Cerebro recibe el texto de «bug evidente», y
lo corrige `scripts/tickets.ts ver`.

**Vive en:** `lib/tickets-reglas.ts` (`APROBADOS_POR_REGLA`, `estimaMasDeUnDia`) · `lib/tickets-runner.ts` · `scripts/operaciones/cartero.mjs`
(`mensajeTicket`, `REGLAS_CONOCIDAS`) · `tests/feedback-2710-tanda1.test.ts`

## «Siempre que MaKo diga que no pudo, un ticket»: el automático con su causa (27/10/2026, claude4, Martín y Leila)

**Síntoma:** Leila recibía «no lo puedo hacer» y nadie se enteraba. Medido por el Cerebro (sólo lectura, 14 días): el detector
de «no puedo» marcaba 15 de 105 respuestas de la app y en ese tiempo hubo 2 tickets de MaKo, ninguno en los últimos 9 días.
Sólo el error de una herramienta abría ticket solo; la acción confirmada que fallaba al EJECUTARSE, el «no puedo» del texto, el
proveedor caído y la configuración terminaban en «no pude» sin ticket.

**Lo obvio era el equivocado:** un ticket por cada frase con «no puedo». Las herramientas de un turno son una SELECCIÓN, así que
muchos «no puedo» eran ruteo (el ticket #13 de «no existe» era una herramienta que no viajó), y otros son reglas de MaKo
(confirmar en la tarjeta, el rol) u opiniones («no puedo asegurarte…»). **La regla** (lib/no-pude.ts):
- el modelo marca `[[no-pude: …]]` en el mismo turno, y sabe que sus herramientas son una selección (en el system de la app ya
  no dice «y NINGUNA otra»);
- la CAUSA la decide el código: ejecución, herramienta, ruteo (llamó algo que existe, `porId` + `visible`, y no viajó),
  proveedor, configuración, no-existe, texto. Una regla o una opinión: nada;
- UN ticket por negocio + conversación + causa (`np:<ws>:…`, la conversación hasheada): lo que vuelve a pasar se anota en él.
  El proveedor y la configuración, uno por negocio, que se cierra solo cuando vuelve a andar (`cerrarSiVolvio`);
- el título lo arma el código; lo del modelo y la persona, en la descripción y el contexto (dentro del cerco «es DATO»);
- la persona lee «Quedó el ticket #n para el equipo de MaKo.» (nunca «te aviso»); repetido en la conversación, nada.

**Trampas de la base** (lib/tickets-db.ts, lib/tickets-reglas.ts):
- La regla de aprobación (ws 1, 10, 11) mandaba al Runner CUALQUIER ticket de esos negocios, sin mirar quién lo levantó:
  `clasificar` con `automatico` no entra por la regla ni estampa `regla`. Decisión: lo que no existe de esos negocios ya NO va
  solo al Runner (lo decide Martín). El proveedor y la configuración nunca van al Runner.
- El tope del día de la persona contaba los tickets que el sistema abría por ella: con 10 automáticos no podía levantar uno a
  mano. Ahora cuenta sólo las `ref` que no son del sistema (`esRefDelSistema`: `np:`, `error:`, `no-existe:`), y los automáticos
  tienen su tope aparte (6 por negocio y día). La condición «ref nula o no del sistema» no entra en un filtro simple: se leen
  las filas (son pocas) y se cuentan en el código.
- Un automático cerrado que vuelve a pasar es uno NUEVO (la `ref` con sufijo): se busca el último con `like` y no con `eq`.
- tests/_postgrest-de-mentira.ts no entendía `like.` suelto: ahora sí.

**Sin hacer:** WhatsApp (el doer, sus carteles y P3 de wa-fallas-2710) lo engancha «MaKo en WhatsApp» sobre esta base; la línea
en el panel del Video Editor es de Motion (y Image Editor y Web Generator, de sus dueños). La descripción de `levantar_ticket`
(lib/api-mako/areas/tickets.def.ts) todavía pide proponerlo ante una falla: cambiarla junto con WhatsApp, no antes. El 500 de
lib/api-mako/ejecutar.ts sigue llegando con el texto genérico. La red de texto (detectar «no pude» sin la marca) no se hizo:
la marca va primero; medir siete días antes de prender una red.

**Vive en:** `lib/no-pude.ts` · `lib/no-pude-server.ts` · `lib/no-existe-server.ts` · `lib/tickets-db.ts` (`crearTicket`,
`cerrarAutomatico`) · `lib/tickets-reglas.ts` (`clasificar`, `TOPE_AUTOMATICOS_POR_DIA`) · `lib/api-mako/acciones.ts`
(`ticketSiFallo`) · `lib/mako-turno-app.ts` · tests/no-pude*.test.ts

## La revisión de «no existe» contra producción: tres medios, con su test rojo-verde (27/10/2026, claude4)

La revisión adversarial del Cerebro sobre 34b0687f0 confirmó tres defectos del «no existe» automático. Los cubre la base del
ticket automático (lib/no-pude*.ts); tests/no-existe-revision.test.ts los fija y se midió ROJO sobre 34b0687f0 y VERDE encima:
1. en el ws 10 un «no existe» que marcó el modelo nacía aprobado por la regla de Leandro y se iba al Runner;
2. un fallo de RUTEO salía como «no existe» (y el arranque de Offer, sin el catálogo de MaKo, llevaba la regla que hace marcar);
3. los automáticos gastaban el tope de 10 de la persona y le trababan el Soporte.

**Trampas al medirlo:** «borrar los silencios» no sirve para probar la regla de aprobación: la zona delicada («borrados») ya la
frenaba; hace falta un pedido neutro. Y diez «no existe» en la MISMA conversación ya son un solo ticket: para medir los topes
hacen falta conversaciones distintas. **Lo nuevo:** con el tope de los automáticos lleno, lo que sigue se anota en el último
automático del negocio («Otro más, con el tope del día lleno»): no se pierde callado.

## La revisión del 28/10/2026 de la base del ticket automático (claude4)

**Lo obvio era el equivocado otra vez: «si la acción confirmada falló, ticket».** Un `ok:false` del runner casi nunca es una falla:
«Esa decisión ya no estaba abierta», «El email dejó de estar conectado» son negativas de estado o de configuración (hay ~600 en los
*.run.ts), y con el error en el contexto el triage las daba por «bug evidente» y las mandaba SOLAS al Runner. **La regla:** sólo abre
ticket lo que REVENTÓ al ejecutar (el catch, `reventoAlEjecutar` en lib/api-mako/acciones.ts).

Y además:
- **Un ticket por falla:** si `registrarError` ya dejó el suyo (la huella), la marca del modelo sólo se saca (`yaRegistrado`).
- **El ruteo solo no abre nada:** cuenta si MaKo además dijo que no pudo o que no existe.
- **Uno por pedido distinto:** la `ref` lleva lo que falló (lo marcado, o la herramienta), no sólo la conversación y la causa.
- **La negativa legítima se mira en la respuesta**, no sólo en la marca (la marca dice el qué, no el porqué).
- **La configuración se cierra sola sólo si contesta la cuenta que falló** (`contexto.herramienta`, `soloSi`).
- **Lo que levanta el SISTEMA** (un error de la app, `declaradoPor: 'sistema'`) tampoco entra por la regla de aprobación.
Cada uno con su test rojo-verde (tests/no-pude*.test.ts).



**La verificación del 28/10/2026 (claude4): cada arreglo se pasó de largo una vez.**
- «Sólo el catch abre ticket» dejaba sin ticket las fallas REALES: muchos runners se tragan la excepción y devuelven ok:false (los
  `sinLanzar` de las áreas, `ejecutarAccion` de WhatsApp, agendar). Esos dicen el error entre paréntesis («No se pudo aplicar
  (Error guardando setting …)»); una negativa de estado o de configuración no. `esFallaTragada` (lib/no-pude-frases.ts) los separa.
- La regla mirada en TODA la respuesta tapaba fallas que nombran «el token» o «tu pantalla»: se mira la oración que explica la
  marca, y la regla tiene que tener forma de regla («se confirma en tu tarjeta», «pega tu clave»), no la palabra suelta. Sólo
  apaga el «no pude», nunca el «no existe» de la misma respuesta.
- `yaRegistrado` sólo cuando registrarError DEJÓ ticket, y sólo apaga el «no pude».
- La clave de un fallo son sus dos primeras palabras con peso: «crear la tarea» y «crear la tarea en el plan» son el mismo.
- Sin ticket no hay línea: el test rompe la base para probarlo (no alcanza con el tope, que devuelve el último).
**La regla para medir:** cada arreglo de un detector se prueba también con las frases VECINAS de las del ticket, no sólo con ésas.

**El #16 de Leila, en producción y sin cerrarse (28/10/2026, claude4).** El arreglo (toda caja de chat adjunta y lee cualquier
documento) salió en 5b114031c, pero el ticket no se iba a cerrar por DOS cosas, y la obvia era sólo una:
- No tenía hito: el número iba en el MENSAJE del commit («(ticket #16 de Leila)»), que el cron no lee. Sólo cuenta
  `tickets: [n]` en el hito de la bitácora del área (ahora en app/admin/dev/second-brain/bitacora.ts).
- Seguía en «esperando_decision»: `cerrarLosDesplegados` (lib/tickets-cierre.ts) sólo toma «en_curso» y «arreglado». Un
  ticket que un chat arregla por el pedido de Martín, sin que pase por el mazo, no lo cierra el hito hasta que alguien lo
  apruebe; aprobado, el cron lo cierra en la vuelta siguiente porque el hito ya está desplegado. Cambiarle el estado a mano
  es escribir en producción: pide el sí de Martín.
**La regla:** el hito con `tickets: [n]` va en el MISMO commit del arreglo, y quien lo entrega mira el estado del ticket
(sólo lectura) y avisa si no está «en curso».

## Soporte sin adjuntos: el «+» sólo daba emojis (28/10/2026)

Martín (28/10): «las personas no están pudiendo usar la ticketera porque nuevamente el chat está mal configurado, solamente
permite emojis, no permite adjuntar ni archivos ni capturas ni documentos».

- **La causa:** la caja de Soporte (`CajaSoporte`, app/tickets/soporte/PiezasSoporte.tsx; el teléfono usa la misma) montaba la
  caja compartida SIN `adjuntos`, y sin esa prop el «+» de `CajaChat` sólo ofrece emojis. No falló nada: nunca se cableó.
  Regla: **una caja de chat nueva nace con adjuntos y voz, o dice por qué no** (lo barre el test de las cajas unificadas).
- **Dónde quedan, sin migración:** los archivos suben al bucket privado `archivero`, en `<ws>/tickets/<uuid>`
  (app/api/tickets/adjuntos/route.ts, con el negocio de la SESIÓN), y el ticket guarda sus referencias en el `datos` de su
  evento (`ticket_eventos.datos`, jsonb, que en los comentarios estaba siempre vacío): el «creado» para lo de la conversación
  nueva, cada «comentario» para lo de una respuesta. Cada referencia se valida contra el negocio de la sesión
  (`sanearAdjuntosTicket`): un path de otro negocio no se guarda.
- ⚠️ **`contexto` del ticket NO sirve para esto:** pasa por `sanearContexto`, una lista blanca que tira sin aviso cualquier clave
  que no conoce.
- **El Cerebro los ve** con `scripts/tickets.ts ver <n>` (la sección ADJUNTOS, con un link firmado de 1 hora), y el triage los
  nombra en su «porque».

### La revisión de 046d9e028: la foto se iba con el ticket SIGUIENTE, y el reintento grababa un «📎» falso (28/10/2026)

La revisión del Cerebro (C:/dev/revisiones/2810-ticketera-046d9e028.md) corrió el hook real con la subida en pausa. Lo que se
había anotado como «sin hacer» era peor de lo que decía:

- **El síntoma:** en la conversación nueva, el ticket que se levanta mientras una foto sube salía SIN la foto, y la descripción
  igual decía «📎 foto.jpg». Y la subida que terminaba después se sumaba a la conversación siguiente: la foto se iba con el
  próximo ticket de esa persona. **La causa:** `mandar()` metía la línea «📎» al relato en el acto y subía con un `.then` suelto
  que escribía en `delTicket` sin saber de qué conversación era; `mandarTicket` leía `delTicket` en el clic. **La regla:** el
  mensaje con archivos se ve ya («Enviando…») pero entra al relato recién cuando subió; el ticket ESPERA las subidas en curso
  («Subiendo archivos…»); una subida que termina en otra conversación (`ref.current` cambió) se descarta.
- **El reintento:** el turno guardaba el texto VISTO («📎 captura.png»), y «Reintentar» lo mandaba como texto de la persona y sin
  el archivo; en el historial del equipo no se distingue de un envío real. **La regla:** el turno guarda lo dicho, sus `File` y,
  si ya subieron, sus referencias (`dicho`, `archivos`, `subidos` en `Turno`): el reintento manda lo mismo y no sube dos veces.
- **Trampa al arreglarlo:** después de `await` de las subidas, React todavía no volvió a dibujar, así que la tarjeta «de ahora»
  (un ref sincronizado en un efecto) puede estar vieja. La descripción se completa con los nombres de lo que va con el ticket.
- **De paso:** el tope es POR TICKET en la conversación nueva (el alta recortaba el sexto en silencio; ahora la caja y las
  acciones lo dicen); la persona ve sus archivos en el ticket aunque haya escrito algo (`paraElCliente`, sólo nombres); y la
  ruta pone un tope por día por negocio (30 archivos o 50 MB), contado en el bucket y no en memoria (vale en todas las
  instancias; si listar falla, no traba).
- **Cómo se prueba:** `tests/ticketera-subidas.test.ts` arma el hook REAL con esbuild, un mini runtime de hooks (los efectos
  corren después de cada dibujo) y la subida en pausa. Sirve de molde para probar otro hook sin levantar la app.

**Sin hacer:** el barrido de los archivos huérfanos de `archivero/<ws>/tickets` (una conversación que no se levanta, una
respuesta que falla después de subir, el 1 de 3 que subió antes de que fallara el 2). `barrerMiniaturasViejas`
(lib/operaciones-adjuntos.ts) sólo recorre las carpetas del Ops Center.

### Lo adjuntado es de SU conversación (la verificación de tren-t, 28/10/2026)

- **El síntoma:** una foto adjuntada en un ticket abierto aparecía en el ticket cerrado que se abría después. Ahí la caja está
  apagada y, desde que la caja quieta no deja quitar (hallazgos-operaciones.md, «El chat nuevo lleva sus archivos»), no había
  forma de sacarla hasta volver a un ticket abierto.
- **La causa:** `useSoporte` tenía UNA lista de adjuntos para todo Soporte; `abrir` y `nuevo` no la tocaban. El defecto venía de
  antes: la caja quieta sólo lo hizo visible.
- **La regla:** lo de la caja es de su conversación (`claveCaja`): `soporte:<id>` para un ticket, y UNA sola clave,
  `soporte:nuevo`, para la conversación nueva, así lo que no se mandó sigue en la siguiente, como lo escrito. Si la persona
  levanta el ticket y le quedó algo sin mandar, no lo ve en el ticket: lo encuentra en la conversación nueva. Las notas de
  voz, en cambio, van por conversación (`claveNotas`, `soporte:nuevo:<id>`): una nota grabada no sale en la siguiente.
- **El obvio era el equivocado (la verificación de d2f690673):** mudar lo adjuntado de la clave vieja a la nueva al empezar otra
  conversación (`otraConversacion`). Mudaba lo de la pantalla, pero lo que la caja LEE (abajo) quedaba en la clave vieja, y una
  lectura en curso al levantar el ticket también terminaba ahí: el .pptx desaparecía sin aviso. Con una clave fija no hay nada
  que mudar.
- **Vive en:** app/tickets/soporte/useSoporte.ts (`claveCaja`, `claveNotas`, `adjuntosPor`) ·
  tests/ticketera-subidas.test.ts («lo adjuntado es de SU conversación» y «la caja de la conversación nueva tiene UNA clave»).
- **Y lo que la caja LEE (la verificación de 05d7c3187):** lo de arriba cubría lo que toma la pantalla (fotos, PDF, Office); lo
  que la caja lee sola (.pptx, .md, audio, video) seguía pasando de un ticket a otro, y lo que se leía al cambiar de ticket salía
  en el otro. Ahora la caja también lo guarda por conversación (`conversacion={s.claveCaja}`, PiezasSoporte.tsx): ver
  hallazgos-chat.md, «La caja QUIETA».
- **El ticket espera lo que la caja lee (la verificación de 1d586a686):** la tarjeta se apagaba sólo con las notas y el envío
  del ticket, y `mandarTicket` esperaba las SUBIDAS pero no la lectura de la caja. «Mandárselo al equipo» con un .pptx o un audio
  leyéndose levantaba el ticket sin ese mensaje. Ahora la caja avisa (`onLeyendo`) y la tarjeta dice «Leyendo lo que
  adjuntaste…» (`leyendoCaja` en useSoporte.ts).
- **Y hasta que el mensaje LLEGA a la tarjeta (la verificación de 5ddf1672a):** la tarjeta se volvía a encender al terminar de
  leer, pero el mensaje recién entra a la charla un dibujo después, sube su foto y MaKo lo contesta en 700 ms: apretarla en esa
  ventana levantaba el ticket SIN el mensaje, y el mensaje se perdía. El obvio, armar la descripción con la charla de ahora,
  no alcanzaba: lo que MaKo todavía no contestó tampoco está en la charla. La regla: la tarjeta espera mientras el mensaje va
  camino (`mensajeEnCamino`: la caja lee o entrega, un turno «enviando», MaKo escribiendo), con «Esperando tu mensaje…».

**La verificación del 28/10/2026 (claude4): cada arreglo se pasó de largo una vez.**
- «Sólo el catch abre ticket» dejaba sin ticket las fallas REALES: muchos runners se tragan la excepción y devuelven ok:false (los
  `sinLanzar` de las áreas, `ejecutarAccion` de WhatsApp, agendar). Esos dicen el error entre paréntesis («No se pudo aplicar
  (Error guardando setting …)»); una negativa de estado o de configuración no. `esFallaTragada` (lib/no-pude-frases.ts) los separa.
- La regla mirada en TODA la respuesta tapaba fallas que nombran «el token» o «tu pantalla»: se mira la oración que explica la
  marca, y la regla tiene que tener forma de regla («se confirma en tu tarjeta», «pega tu clave»), no la palabra suelta. Sólo
  apaga el «no pude», nunca el «no existe» de la misma respuesta.
- `yaRegistrado` sólo cuando registrarError DEJÓ ticket, y sólo apaga el «no pude».
- La clave de un fallo son sus dos primeras palabras con peso: «crear la tarea» y «crear la tarea en el plan» son el mismo.
- Sin ticket no hay línea: el test rompe la base para probarlo (no alcanza con el tope, que devuelve el último).
**La regla para medir:** cada arreglo de un detector se prueba también con las frases VECINAS de las del ticket, no sólo con ésas.

**El #16 de Leila, en producción y sin cerrarse (28/10/2026, claude4).** El arreglo (toda caja de chat adjunta y lee cualquier
documento) salió en 5b114031c, pero el ticket no se iba a cerrar por DOS cosas, y la obvia era sólo una:
- No tenía hito: el número iba en el MENSAJE del commit («(ticket #16 de Leila)»), que el cron no lee. Sólo cuenta
  `tickets: [n]` en el hito de la bitácora del área (ahora en app/admin/dev/second-brain/bitacora.ts).
- Seguía en «esperando_decision»: `cerrarLosDesplegados` (lib/tickets-cierre.ts) sólo toma «en_curso» y «arreglado». Un
  ticket que un chat arregla por el pedido de Martín, sin que pase por el mazo, no lo cierra el hito hasta que alguien lo
  apruebe; aprobado, el cron lo cierra en la vuelta siguiente porque el hito ya está desplegado. Cambiarle el estado a mano
  es escribir en producción: pide el sí de Martín.
**La regla:** el hito con `tickets: [n]` va en el MISMO commit del arreglo, y quien lo entrega mira el estado del ticket
(sólo lectura) y avisa si no está «en curso».

**La otra mitad de base 7 (28/10/2026, claude4): la guarda de una herramienta es una regla aunque el modelo no la explique.**
- El formato de la marca pide el QUÉ («borrar el lead de Juan»), no el porqué: la red de TEXTO (`esReglaUOpinion` sobre la marca y
  la oración que la explica) sólo ve la regla si el modelo la escribe. La señal que no depende del modelo es la salida de la
  herramienta: un 400 vuelve como TEXTO con `ok:false` y su `error`, SIN isError (`runnerDelRegistro`, lib/api-mako/ejecutar.ts);
  la heredada, como «❌ …». `esGuardaDeHerramienta` (lib/no-pude.ts) lo reconoce, y el turno de la app pasa `regla` cuando hubo
  una y nada falló de verdad (isError) ni hubo ruteo: con cualquiera de los dos, el «no pude» puede ser de eso.
- Lo que un runner se TRAGÓ también vuelve como 400 (el catch de `ejecutarOperacion` manda a 400 lo que no huele a
  infraestructura): con el error técnico entre paréntesis (`esFallaTragada`) NO es una guarda.
- `regla` apaga sólo el «no pude»: lo que no existe sigue, y con un ruteo es un ruteo (`causaDelNoPude`).
- **Lo obvio («una guarda y ningún error → regla») era el equivocado** (la verificación de 96e7840e8, el chat de WhatsApp):
  `errorParaTicket` sólo ve isError, y lo que un runner se TRAGA vuelve sin isError. «Falta el monto» (guarda) y un reintento que
  se traga un error de la base daba regla y la falla real quedaba sin ticket; una guarda vieja tapaba también otro «no pude». Es
  regla sólo si lo ÚLTIMO que corrió fue la guarda y no hubo errores ni tragadas (`esLaReglaDeUnaGuarda`,
  `esFallaTragadaDeHerramienta`, lib/no-pude.ts, que el doer de WhatsApp importa de ahí).
- **Y «lo último» tenía dos agujeros más** (la verificación de tren-t): una herramienta que REVIENTA después de una guarda no
  pasaba por «la última» (se anotaba después del `await`, y el loop atrapa el throw sin `errorParaTicket`): la guarda vieja le
  comía el ticket. Ahora lo que revienta cuenta como tragada (el `.catch` del `await`). Al revés, una LECTURA que anduvo entre la
  guarda y el «me falta el monto» la apagaba y abría un ticket por una regla: `laUltimaFueGuarda` (lib/no-pude.ts) deja que sólo
  una guarda la prenda y que la apaguen una escritura, un error o una tragada. El costo: guarda + lectura + un «no pude» de otra
  cosa queda como regla.
- **Y la guarda misma se adivinaba por el texto** (la verificación de 2cb1cf67e, D4): cualquier `ok:false` sin isError, o un
  «❌ …», era guarda. Fallas NUESTRAS tenían esa forma y no abrían ticket: la pendiente que no se pudo guardar
  (`crearRunnerAcciones`, lib/mako-doer-acciones.ts, que `traducirLegado` hace 400) y el 400 de las pasarelas (cobros.run.ts).
  **La regla:** es guarda sólo lo que MARCA quien lo produce, `{ ok:false, error, guarda:true }` (lib/api-mako/ejecutar.ts y el
  runner del doer lo ponen, lo hace el chat de WhatsApp); `esGuardaDeHerramienta` no mira el texto. Sin la marca, lo peor es un
  ticket de más. Lo tragado sí se sigue leyendo por el texto: nadie lo marca.
  ⚠️ **«Un ticket de más» eran cientos** (la verificación de 692368a60): ninguna área marcaba sus reglas, y «Quedó el ticket
  #N» salía en el grupo del cliente por «Sólo se reembolsa un cobro pagado». Desde el 28/10 el productor marca al revés: el
  error de un preparar ES guarda, y la falla lleva `falla: true` (docs/hallazgos-api-mako.md).
**Sin hacer:** el doer de WhatsApp (lib/mako-doer-in.ts, `conTicketsDeMaKo` con `yaRegistrado`) todavía no pasa la señal (va
con mako-wa-conexiones). Los chats que pasan por `conPedidoDeNoExiste` (Offer, el «Discutir» del Web Generator, el Video y el
Image Editor) NO corren herramientas: Offer llama a `chatCheapTools` con la lista vacía y los demás piden un JSON. No hay guarda
que mirar; su red es la del texto. Si uno suma herramientas, cuenta las guardas como el turno de la app (AGENTS.md).

## El despachante de MaKo en el grupo: un hito con tickets de dos negocios se le mostraba entero a uno (29/10/2026, Integración)

La revisión de privacidad de `wa-fallas-2710` (`85a0d9ead`) frenó la punta en el tren-ae y volvió a su chat. El informe está en
`C:/dev/revisiones/2910-revision-privacidad-wa-despachante-85a0d9ead.md`.

- ⚠️ **ALTA: el filtro de hitos era por los tickets del negocio, pero el hito se mostraba ENTERO, con título y 3 puntos.**
  - La bitácora de mako-doer es GLOBAL: un hito puede nombrar tickets de varios negocios. Por ejemplo, `app/admin/dev/crm/bitacora.ts`
    tiene `tickets: [13, 26]`: el #13 es de Leila y el #26 de Mauricio.
  - Con la rama sobre main, el turno del ws1 recibía para su #26 el punto «Ticket #13 (Leila): …6 meses de $12.000 MXN…», y la
    voz de la consulta le pedía contestar con eso.
  - Se verificó corriendo la función de la rama sobre las bitácoras de main. **Regla:** a un negocio sólo le llega un hito que
    nombra tickets SUYOS y nada más; si nombra otros, ni los puntos ni el título.
- ⚠️ **ALTA: el pedido delegado le decía al Cerebro «hazlo» aunque el triage dijera «lo decide Martín».**
  - Le pasaba justo a lo que `ACCIONES_SIMPLES` deja afuera: plata, envíos y borrados. Eso es lo que se delega, y lo puede pedir
    cualquiera del grupo, sin el «sí» de nadie.
  - El texto autorizaba «una escritura que no es del negocio», donde el de ticket le reserva a Martín «una escritura en producción»
    (`lib/tickets-aviso.ts`).
  - El Runner marca `delegado` sin mirar el triage ni el estado (`lib/tickets-runner.ts`, `cartero.mjs`).
  - **Regla:** un pedido delegado respeta el triage igual que un ticket. Lo que es de Martín espera a Martín.
- **MEDIA:**
  - El «listo» de un pedido delegado es texto libre del Cerebro y llega tal cual al grupo del cliente. Sólo pasa el filtro de
    promesas y groserías; nada saca ids, nombres de otros negocios ni notas internas.
  - El clasificador usa la clave del negocio. Si no tiene, usa el crédito de los grupos de la plataforma: tope de US$200 por cuenta
    y por mes, sin tope por negocio ni por grupo.
  - El DEBUG lo habilita el GRUPO (el de la plataforma y los de prueba de la allowlist), no quién escribe. Desde el grupo oficial
    de un cliente no se llega, y está verificado.
- **Lo que está bien (verificado):**
  - La puerta del DEBUG desde un cliente está cerrada.
  - Los textos fijos del ticket y del pedido los arma el código.
  - Cada cosa vuelve a su grupo.

## Un pendiente FANTASMA: «falta la prioridad por agencia» ya estaba hecho el mismo día que se anotó (6/11/2026)

`docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md` (A8) decía **FALTA**: «la prioridad sale sólo del texto
(`lib/tickets-reglas.ts:401`); no hay regla por agencia». El 6/11 se fue a implementarla y **ya estaba entera**, con fecha
5/11 — el mismo día de la auditoría. Se perdió una pasada de lectura completa (el triage, el cableado, la identidad y el
orden del mazo) para no escribir una línea.

La cadena, por si hay que volver a verificarla de punta a punta:
- `subirPorAgencia` (lib/tickets-reglas.ts): baja→media, media→alta, **nunca** urgente (urgente sale sólo del texto, «no
  puedo trabajar»).
- `clasificar` la aplica con `opts.deAgencia && !deTercero && !automatico`, y deja la marca `agencia: true` en el triage.
- El cableado real está en `lib/tickets-db.ts` (`crearTicket`): `deAgencia: n.identidad.agencia === true`.
- Y eso sale de `administraUnaAgencia(u)` en `identidadDe` (lib/tickets-db.ts), leído de la BASE con el email de la sesión.
- `ordenDelMazo` (app/tickets/bandeja/mazo-reglas.ts) pone a los que SUBIERON detrás de los de su misma prioridad que
  llegaron ahí solos: una agencia no le gana el lugar a un cliente con algo roto.
- Lo fija `tests/tickets-agencia.test.ts` (5 casos, probados rompiéndolo).

**La regla que queda:** un renglón «FALTA» de una auditoría es una medición CON FECHA, no un estado. Cuando la fecha del
renglón y la del trabajo son el mismo día, lo primero es `git log` del archivo que nombra, no leerlo y creerle. Y cuando se
confirma que estaba hecho, **se corrige el renglón en el mismo commit**: el fantasma no cuesta una línea de código, cuesta
la pasada de lectura entera, y la paga cada chat que lo vuelve a tomar.
