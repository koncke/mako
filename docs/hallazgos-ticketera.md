# Hallazgos — Ticketera (los tickets que levantan los usuarios)

Lo que no se deduce leyendo el código. El diseño, con lo que se copió de quién: [diseno-ticketera-usuarios.md](diseno-ticketera-usuarios.md).

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

## Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| La bandeja en el teléfono | app/m/operaciones/TicketeraMovil.tsx | Hoy la Ticketera del teléfono sigue siendo el mazo |
| «Tus tickets» en el teléfono | app/m (no existe) | `rutaMovil('/tickets')` es null: en el teléfono se levanta y se consulta por el chat de MaKo (`mis_tickets`) |
| Levantarlo por WhatsApp | lib/mako-doer-in.ts | Es del chat «MaKo en WhatsApp»: el registro ya acepta `actor: 'whatsapp:<teléfono>'` (lo atribuye a la persona del negocio con ese teléfono) y el aviso de vuelta pasa por `sanearSalida` |
| Adjuntar una captura a mano | app/tickets | El contexto automático cubre el caso del chat |
| Borrar el mazo de las preguntas de los chats | app/tickets/decisiones, app/admin/runway | Cuando ande el formulario de opciones dentro de cada chat (Ops Center) |
