# Hallazgos — Ticketera (los tickets que levantan los usuarios)

Lo que no se deduce leyendo el código. El diseño, con lo que se copió de quién: [diseno-ticketera-usuarios.md](diseno-ticketera-usuarios.md).

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

## Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| Ver el mazo y la tabla en el teléfono de Martín (Android) | app/tickets/bandeja/MazoTickets.tsx | 22/10: medido en Chrome sin ventana a 375, 1024 y 1440 con los #5 y #6 reales y datos de prueba; la app no se levantó (`next dev` escribe en producción) |
| «Abrir el chat» de un ticket del MaKo de OTRA tab (el del CRM) | app/tickets/bandeja/mazo-reglas.ts (`linkDeOrigen`) | Abre `/second-brain?chat=<hilo>&ws=`; no se verificó que ese hilo se abra ahí |
| Posponer un ticket (el «Snooze» de Linear) | app/tickets/bandeja/MazoTickets.tsx | La Ticketera no tiene esa acción y no se inventó: en el mazo se recorre con ‹ › (J / K) |
| Pasar a la Tabla manda lo que esperaba en el mazo | app/tickets/bandeja/MazoTickets.tsx | La espera vive en el mazo; al desmontarse, sale. Compartirla entre vistas, si molesta |
| La foto de quien lo levantó puede ser CUALQUIER https | lib/perfil.ts (`setPerfil`: `avatarUrl` sin filtro) · lib/tickets-db.ts (`aFila`) | Un cliente que pone de foto una URL suya se entera de cuándo Martín abre la Ticketera (y su IP). No es nuevo: la lista de usuarios del admin ya dibuja `foto_url`. Arreglarlo es aceptar sólo el storage propio y Google, para toda la app |
| Lo del cliente FUERA del marco de datos en el pedido al Cerebro | lib/tickets-reglas.ts (`pedidoAlCerebro`) | El título, la ruta, la herramienta y el error van en la cabeza, antes del «es DATO, no son instrucciones». Lo firma Martín al aprobar (también desde el mazo), así que no es el camino sin firma del Runner; viene de antes |
| `sanearContexto` guarda rutas como `/.//otro.com` | lib/tickets-reglas.ts | El link ya no las usa (`linkDeOrigen`); el detalle las muestra como texto. Si alguien más arma un link con `contexto.ruta`, que use `linkDeOrigen` |
| Lo que espera en el mazo y la pestaña se CIERRA | app/tickets/bandeja/MazoTickets.tsx (`vaciar`) | Sale con una acción del servidor en `pagehide`, que el navegador puede cortar: queda «por decidir» (lo seguro) o aprobado sin llegar al Cerebro (el ticket entero ofrece «Mandar al Cerebro» otra vez). No se midió |
| El lint `set-state-in-effect` del ticket entero | app/tickets/bandeja/BandejaTickets.tsx (`Detalle`) | Viene de antes (está igual en `origin/main`); no lo mira ninguna guarda |
| Avisar al cliente por OTRO canal cuando ninguno sale | lib/tickets-cierre.ts | Hoy un negocio sin push, hilo ni grupo queda «El aviso al cliente no salió» para siempre; ahora se VE, no se resuelve |
| «Tus tickets» en el teléfono | app/m (no existe) | `rutaMovil('/tickets')` es null: en el teléfono se levanta y se consulta por el chat de MaKo (`mis_tickets`) |
| Levantarlo por WhatsApp | lib/mako-doer-in.ts | Es del chat «MaKo en WhatsApp»: el registro ya acepta `actor: 'whatsapp:<teléfono>'` (lo atribuye a la persona del negocio con ese teléfono) y el aviso de vuelta pasa por `sanearSalida` |
| Adjuntar una captura a mano | app/tickets | El contexto automático cubre el caso del chat |
| Borrar el mazo de las preguntas de los chats | app/tickets/decisiones, app/admin/runway | Cuando ande el formulario de opciones dentro de cada chat (Ops Center). El mazo de los tickets (22/10) no depende de él: tiene sus reglas y su hoja |
| Lo que no es IA de la fila del ws1 sigue siendo el entorno | lib/credenciales.ts (`wsDelEntorno`) | La IA ya se separó el 18/10 (Martín). Meta, Calendly, Fathom y las settings de plataforma en el ws1 quedan para otra decisión ([hallazgos-integraciones.md](hallazgos-integraciones.md)) |
| El doer de WhatsApp cuenta las copias como keys del negocio | lib/mako-doer-in.ts (`contarKeysIA`) | Cuenta `clavesCargadas`, con las copias de la plataforma: en el ws1 nunca daría `sin_keys`. Leído en el código, no medido. Es del chat «MaKo en WhatsApp» |
