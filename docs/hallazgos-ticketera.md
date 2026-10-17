# Hallazgos — Ticketera (los tickets que levantan los usuarios)

Lo que no se deduce leyendo el código. El diseño, con lo que se copió de quién: [diseno-ticketera-usuarios.md](diseno-ticketera-usuarios.md).

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

## Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| Ver la bandeja del teléfono en un teléfono real | app/m/operaciones/TicketeraMovil.tsx | Hecha el 17/10 y probada con tests; falta mirarla en pantalla (ws3, super admin) |
| Avisar al cliente por OTRO canal cuando ninguno sale | lib/tickets-cierre.ts | Hoy un negocio sin push, hilo ni grupo queda «El aviso al cliente no salió» para siempre; ahora se VE, no se resuelve |
| «Tus tickets» en el teléfono | app/m (no existe) | `rutaMovil('/tickets')` es null: en el teléfono se levanta y se consulta por el chat de MaKo (`mis_tickets`) |
| Levantarlo por WhatsApp | lib/mako-doer-in.ts | Es del chat «MaKo en WhatsApp»: el registro ya acepta `actor: 'whatsapp:<teléfono>'` (lo atribuye a la persona del negocio con ese teléfono) y el aviso de vuelta pasa por `sanearSalida` |
| Adjuntar una captura a mano | app/tickets | El contexto automático cubre el caso del chat |
| Borrar el mazo de las preguntas de los chats | app/tickets/decisiones, app/admin/runway | Cuando ande el formulario de opciones dentro de cada chat (Ops Center) |
