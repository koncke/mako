# Retomar: avisos, reportes y las líneas de WhatsApp

**Qué cubre:** los crons que le mandan mensajes a un cliente (reportes, avisos del catálogo,
cobranza), las líneas de WhatsApp no oficial de cada negocio (vincular, elegir por cuál sale
cada cosa, vigilar que no se caigan) y la bandeja de `/whatsapp`.
**Ventana:** del commit `6785dc16` (05/10/2026 12:33) a `de64b5b7` (06/10/2026 15:58).
**Cuenta:** `claude1`. Todo pusheado (`git log origin/main..HEAD` vacío) y desplegado
(último deploy de producción en Ready, medido el 06/10 a las 19:42 UTC).

Las mediciones de este documento se tomaron el **06/10/2026 entre las 19:30 y las 19:45 UTC**,
contra la base de producción por la API REST con la service role (sólo lectura).

---

## 1. En qué quedó

### El reporte semanal ahora le llega a cada cliente — `c7510ddd` (06/10 14:17)

Era la mitad abierta de la tarjeta #834. Hasta acá los tres crons de reporte corrían **una
vez y fuera de todo `runWithWorkspace`**: sin cookie de sesión `getWorkspaceActual()` cae al
ws1 por contrato, así que se armaba y se mandaba el reporte de Mauricio y nada más — con el
semanal igual en la lista que ve cada cliente y prendido por defecto.

Decisión de Martín: **«b: solo el semanal para los clientes»**.

- `app/api/cron/reporte-semanal/route.ts` recorre los workspaces **activos** y corre cada uno
  adentro de `runWithWorkspace(w.id, …)`. Un workspace que falla no corta a los demás; si
  fallan todos, 500 (con 200 el monitoreo de Vercel no se entera). `?dry=1[&ws=N]` lista a
  quién le mandaría, con los destinos enmascarados.
- **«Apagado» son DOS interruptores** y el cron leía uno: `notification_prefs.semanal.activo`
  y el `enabled` de la plantilla en `/mensajes`, que es el que ve el cliente. Ahora pregunta
  por los dos (`lib/reporte-destino.ts:54`, `decidirReporte`).
- La regla de destinos («la lista del negocio y, si está vacía, el contacto suelto») estaba
  escrita dos veces en `lib/notify.ts`; vive en `lib/reporte-destino.ts:36` y la usan el cron
  y `despacharReporte` (`lib/notify.ts:37`).
- **Diario y horario NO se tocaron**: siguen siendo sólo del dueño, a propósito, y hay un test
  que lo fija («los reportes diario y horario siguen siendo sólo del dueño»).

**El primer semanal real sale el lunes 12/10 a las 14:20 UTC** (`vercel.json`, `"20 14 * * 1"`).
Medido de nuevo el 06/10 — 10 workspaces activos, **nadie** tiene el semanal apagado porque
`DEFAULT_PREFS` lo trae activo:

| Workspace | Qué le llega |
|---|---|
| ws1 | un teléfono y un mail |
| ws10, ws13, ws14 | un teléfono y un mail cada uno |
| ws11 | **dos** teléfonos y un mail |
| ws15 | dos teléfonos y **ningún** mail |
| ws3, ws4, ws9, ws17 | nada: quedan salteados por `sin_destinatario` |
| ws5 | pausado, el cron no lo itera |

⚠️ **El renglón de WhatsApp sale por el Chatwoot del workspace.** Según lo medido al hacerlo,
sólo el ws1 lo tiene completo, así que a los demás les llega **sólo por mail** — y a ws15, que
no tiene mail, no le llega nada aunque el cron diga que salió. **Esto no lo pude re-verificar
desde acá:** las credenciales de Chatwoot se leen por `credWs` (BYOK cifrado), no por
`app_settings`. Ver la contradicción al final de la sección 3.

### La línea caída se le avisa al dueño de la línea — `c7510ddd` + `d23b3685` (06/10 14:17 y 14:36)

Tarjeta #784. La línea por QR del ws1 estuvo muerta 26 días (03/09 → 29/09) sin un solo
aviso: la vigilancia existía pero era sólo de la **voz de MaKo**; las líneas de los clientes
no las miraba nadie. Decisión de Martín: **«c: solo al cliente»** (su grupo de MaKo, sin mail
a la agencia).

- `lib/lineas-vigilante.ts:66` (`vigilarLineasClientes`) recorre las **filas** de
  `evolution_instancias` —N por negocio desde las migs 0198/0199, el nombre ya no se deriva
  del ws—, deja afuera la voz y la plataforma, sondea cada una y avisa con
  `emitirDelCatalogo('wa-desconectado', { ws })`.
- La decisión vive aparte y es pura: `lib/linea-vigilancia.ts:62` (`decidirLinea`).
  `sin_respuesta` no toca nada (no poder preguntar no es estar caída); la primera medición
  muerta sólo fija el «desde»; una línea que nunca se vinculó no se «cae»; se avisa una vez y
  después cada 24 h. El texto manda a re-escanear **sólo** con 401/403.
- Enganchado al cron `alerta-critica` (cada 10 min) **después** de la voz:
  `app/api/cron/alerta-critica/route.ts:55`. Si la voz está caída el aviso no llega, y eso ya
  lo grita el mail de la voz.
- `wa-desconectado` pasó a `porDefecto: 'on'` y `yaImplementado: 'si'`
  (`lib/avisos-catalogo.ts:724`). Sin eso nacía apagado y no salía en ningún lado.

**`d23b3685` es la revisión adversarial del anterior, y encontró algo que iba a salir a gente
real:** `desconectar()` borra la instancia en Evolution y, si era la de por default, deja su
fila en «desconectado». El vigilante la sondeaba igual, Evolution contesta 404 «the … instance
does not exist», el veredicto lo leía como `muerto` — y el negocio que **suelta su número a
propósito** recibía «🔴 Se cortó tu WhatsApp… reconéctalo» cada 24 h para siempre. Lo que
separa las dos cosas es la sonda: una caída de verdad deja la instancia **viva** en Evolution
(medido el 25/09: una llevaba 22 días así); una desvinculada no tiene instancia.
`esInstanciaInexistente` (`lib/evolution-sonda.ts:79`) lo reconoce en un solo lugar, y
`decidirLinea` recibe `sinInstancia` **obligatorio** para que un vigilante que se olvide de
pasarlo no compile.

**Medido el 06/10 a las 19:35 UTC: el vigilante no mandó ningún aviso todavía.** No existe
ninguna clave `mako.aviso.last.wa-desconectado` en `app_settings`. Es consistente con el
estado de las líneas: ws1 y ws11 conectadas (última conexión 19:17 y 19:13 UTC) y la del ws13
con `ultima_conexion_at` en null desde el 18/08 → nunca se vinculó → no avisa.

### Varias líneas de WhatsApp por negocio — `0936f1da` (06/10 05:13), cosecha en `5bc6f78b`

Pedido de Martín: *«haz que los usuarios puedan escanear varios QR… es la misma dinámica que
"Productos" en el CRM… un desplegable que cambiaría el chat. Y dentro del chatbot una opción
para seleccionar de qué número sale esa automatización»*.

- `/whatsapp`, canal No Oficial: desplegable con los números del negocio y «Agregar otro
  número». La línea viaja en la URL (`?linea=`), como el producto en el CRM, y la bandeja, el
  hilo, las respuestas, la media y sincronizar hablan de **esa** línea. Panel de gestión por
  línea: nombre, «Usar por default», desvincular, «Quitar este número».
- `/chatbot`: «Sale por» en la tarjeta de entrada, **sólo visible con dos números o más**.
- **Lo que decide todo es UNA función:** `elegirLinea` (`lib/lineas-whatsapp.ts:91`, pura y con
  test). Una línea pedida se usa sólo si es del negocio; si no, **no se manda y NO cae a la de
  por default**, porque elegir otra es mandar desde el número equivocado sin que nadie lo vea.
  La regla quedó en `AGENTS.md` (`5bc6f78b`).
- La migración va partida a propósito: **0198 agrega antes del deploy, 0199 saca después**,
  porque `upsertInstancia` hacía `onConflict: 'workspace_id'` y sacar el único antes de
  desplegar rompe «conectar» para todos.

**Verificado en producción el 06/10 (índices de `evolution_instancias`, por el pooler):**
existe `idx_evolution_default_por_ws` (UNIQUE parcial sobre `workspace_id` WHERE `es_default`)
y **ya no existe ningún unique sobre `workspace_id` solo** → las dos migraciones están
aplicadas. También: **cero filas de `wa_mensajes` con `instance_name` vacío** (el relleno de la
0198 se sostuvo).

⚠️ **Pero ningún negocio tiene una segunda línea todavía.** Medido: tres filas en
`evolution_instancias`, una por workspace (1, 11 y 13), las tres con `es_default = true` y
`etiqueta` en null. O sea que el desplegable, el «Sale por» y todo el camino de dos líneas
**nunca se ejercitaron contra un segundo QR real**. Ver la sección 2.

### Agregar al CRM desde la bandeja no oficial — `3ce45ab1` (05/10 23:22)

Tarjeta #830. El alta de un contacto desde el chat existía desde el #381 y vivía **sólo** en
la bandeja oficial (Chatwoot). La no oficial —la que usa el chatbot y la que quedó por
default— no la tenía. Medido contra producción en el ws1: de 225 conversaciones, 52 ya tenían
lead, 33 no tienen teléfono (grupos) y **140 quedaban sin salida**. En 23 de esas 140 WhatsApp
no da nombre, así que el lead nace con el teléfono como nombre y por eso se abre la ficha
editable en el acto. Guard: `tests/inbox-agregar-al-crm.test.ts`, que mira el **conjunto**
(«toda bandeja ofrece el alta»), que es justo lo que no se cumple solo.

### El Oficial se escondió, el onboarding viejo se cayó — `2d991183` (05/10 22:52)

Tarjetas #832 y #833. Esconder una integración son **tres** lugares y uno no es obvio: la
tarjeta de `/integraciones` (que ahora sólo se dibuja si el workspace **ya** tiene el token de
Chatwoot, para no romperle la pantalla a quien lo usa), el botón del canal en `/whatsapp`, y
**el deep link `?canal=oficial`**, que convertía un link viejo en una pantalla fantasma. Más
un cuarto que no es pantalla: los pasos `wa_oficial*` del catálogo de onboarding.

Y la mitad de código del #834: el «este lead no es de esta cuenta» sobre un lead propio **no
era el chatbot cruzando workspaces**, eran los links de los avisos armados pegando
`APP_BASE_URL` + la ruta a mano, que salían sin `?ws=`. 22 links en 15 archivos pasaron por
`linkApp()`, con guard sobre el fuente.

### Los avisos por tiempo no mandan el texto de ejemplo — `16c0d66c` (06/10 12:26)

El grupo de Leila recibió **cuatro días seguidos a las 9:00** un recordatorio de reunión con
un lead real de **otro** cliente. Tres eslabones que andan bien por separado: elegir «Por
tiempo» agenda en el acto todos los días a las 9; el drenador manda el texto tal cual; y para
un mensaje del catálogo que nadie reescribió ese texto es el **`ejemplo`**, que además
nombraba a un lead de verdad.

- `motivoNoAgendable(texto, ejemploDeFabrica)` (`lib/cron-aviso.ts:278`, puro) devuelve
  `'ejemplo'` o `'sin-texto'`. Lo preguntan las **dos** puntas: `setProgramado` se niega antes
  de escribir y `drenarProgramados` lo vuelve a mirar en cada tick, sobre la misma variable que
  manda. Se compara contra el ejemplo de fábrica, no contra «¿hay override?».
- Las dos rutas de `cron-set` contestan 400 con el motivo (la de la agencia devolvía el 500 de
  Next en HTML). Si el server se niega, «Por tiempo» vuelve atrás en la pantalla.
- Los ejemplos de `reunion-recordatorio` y `reunion-tareas-al-plan` pasaron a ser ficticios
  (el segundo decía «Mau <> Martín»), con guard sobre los 65 ejemplos del catálogo.

**En producción se borraron las dos filas agendadas. Verificado el 06/10 19:33 UTC:
`avisos_programados` tiene CERO filas.**

### La cobranza dejó de prometer — `c7510ddd`

Tarjeta #19, decisión de Martín: **«C: nada al cliente»**. El paso `wa_lead` creaba una
pendiente `flujo_wa_lead` que `confirmarPendiente` cerraba como «operación desconocida»
(`lib/flujos.ts:14` y `:207`): ya no la crea y lo dice en el log. El «¿Le escribo el
recordatorio?» de cuota-vencida y el «¿Le escribo?» de cuota-por-vencer se fueron, y
`requiereRespuesta` pasó a `false` — la vista previa dibujaba al dueño diciendo «Sí, adelante
👍» y a MaKo diciendo «Listo, lo hago ahora» sobre algo que no iba a pasar.

### Dos cruces reales entre clientes, de la misma familia — `260bff7d` y `157a302a` (06/10 03:01 y 03:10)

- **Chatwoot elegía la línea con un número cableado.** `cfg()` hacía `Number(inboxRaw ?? '3')`:
  ese número decide **por qué WhatsApp sale un mensaje**. Ahora es `number | null` y se lee
  siempre por `inboxWA(c)` (`lib/chatwoot.ts:30`), que tira diciendo qué falta. Y
  `crearOReusarConversacion` reusaba la primera conversación abierta del contacto sin mirar de
  qué bandeja era.
- **El drenador de corridas sólo veía al ws1.** `corridasVencidas` leía con `getTenantDb()`
  desde un cron sin sesión: un «esperar 2 horas» de cualquier otro cliente esperaba para
  siempre, sin un solo error. El descubrimiento pasa a lectura cruda y lo que toca datos sigue
  adentro de `runWithWorkspace(ws)`.
- **Los clientes heredaban los mensajes del ws1.** La base de la herencia del store de
  plantillas era `OWNER_WS`: siete workspaces veían como ejemplo un `reporte-semanal` con los
  números reales de Mauricio. La base pasó a `wsSuperAdmin()` (`lib/workspace.ts:433`).

**Tests del área, corridos el 06/10 a las 19:40: 95 de 95 en verde**, sobre
`linea-vigilancia`, `lineas-whatsapp`, `evolution-sonda`, `reporte-semanal-clientes`,
`cron-aviso`, `cobranza`, `cruce-notificaciones`, `link-con-workspace` e
`inbox-agregar-al-crm`.

---

## 2. Lo que quedó a medio hacer, y dónde vive

**Lo más urgente está arriba de todo:**

1. ⚠️ **El lunes 12/10 a las 14:20 UTC sale el primer reporte semanal a clientes reales, y
   nadie lo pidió.** Cinco negocios (ws10, 11, 13, 14 y 15) lo reciben **sin haber configurado
   nada**, porque `DEFAULT_PREFS` lo trae activo y el catálogo lo nace prendido. Correr
   `/api/cron/reporte-semanal?dry=1` antes del lunes es la verificación barata; el cron lista a
   quién le mandaría, enmascarado, sin armar ni mandar nada.
   Vive en `app/api/cron/reporte-semanal/route.ts`.

2. ⚠️ **Nadie escaneó un segundo QR todavía.** Las tres filas de `evolution_instancias` son una
   por negocio. Todo lo de varias líneas se verificó con tests, contra producción (las dos
   migraciones) y en el navegador con las escrituras abortadas, pero **la primera vez que
   alguien escanee un segundo número es la prueba que falta**. Vive en
   `app/whatsapp/EvolutionConnect.tsx` y `lib/evolution.ts`.

Lo demás, por archivo:

- **El cartel rojo de `/chatbot` sigue mirando sólo la línea por default**
  (`estadoCanalWhatsapp`, el GET de `/api/chat-agent/secuencias`). La tarjeta de cada secuencia
  ya avisa si **su** número está caído; el cartel general no.
- **El seguimiento post-llamada** (`lib/post-llamada.ts`, `crearBorrador` sin línea) y **las
  etiquetas, la foto de perfil y el LID** (lectores sin línea pedida en `lib/evolution.ts`) van
  por la de por default.
- **Desvincular la de por default con otras vivas** deja a las secuencias sin línea apuntando a
  una caída: hay que tocar «Usar por default» en otra. No se promueve sola a propósito.
- **Un mensaje entre dos líneas del MISMO negocio** choca con el único `(workspace_id,
  wa_message_id)` del espejo: el lado que llega segundo no se guarda.
- **El aviso de línea caída nunca va a nombrar el número.** Verificado: el webhook
  (`app/api/webhooks/evolution/route.ts:148`) y `desconectar()` (`lib/evolution.ts:675`) ponen
  `numero` en null al desconectar, y las tres filas de producción tienen `etiqueta` en null. El
  ejemplo del catálogo muestra «(+52 55 1234 5678)» y promete algo que no pasa. Hace falta
  guardar el último número conocido.
- **Un aviso apagado se loguea como «ya avisado hace poco»**: `lib/avisos.ts:377` devuelve
  `deduped: true` y no `apagado`. Sólo afecta al log, y lo hace mentir.
- **Por tiempo, un mensaje del catálogo manda la FOTO, nunca el dato.** La guarda caza el
  ejemplo de fábrica; **no caza un texto propio con números viejos**. Verificado el 06/10: el
  store del ws1 **todavía** tiene guardado el `reporte-semanal` con «07/07 al 13/07 — $640 · 92
  leads · CPL $6,9 · 4 cierres». Hoy no sale (`avisos_programados` está vacía), pero si alguien
  vuelve a elegir «Por tiempo» sobre ese mensaje, vuelve a salir esa foto de julio.
- **Un click para mirar sigue agendando.** `app/agencia/FlujoAviso.tsx:693`: elegir «Por
  tiempo» escribe `CRON_DEFAULT` en el acto y recién revierte si el server se niega.
- **La tabla `notificaciones` sigue sin existir en producción** (verificado: PostgREST contesta
  PGRST205). Un aviso que no sale por WhatsApp no queda en ningún lado.
- **Los pasos `accion` de un flujo mueren como «operación desconocida»**, y el lienzo sigue
  dibujando un `wa_lead` como «Le escribe al lead» aunque ya no escriba nada
  (`lib/flujos.ts`, `lib/flujo-pasos.ts`).

**Las dos mediciones que pedía el relevo anterior, al día de hoy:**

- **Los tres crons de reporte:** ya **no** es cierto que ninguno itere inquilinos. El semanal lo
  hace desde `c7510ddd`. El diario y el horario **siguen sin un solo `runWithWorkspace` ni
  `listarWorkspaces`** (verificado por grep sobre `app/api/cron/reporte-diario/route.ts` y
  `-horario`), y es a propósito: son del dueño, con un test que lo fija.
- **`nutricion_envios` ya no son 12 filas todas fallidas: son 15, y las 3 nuevas salieron.**
  Las 12 viejas siguen en `fallo` («WhatsApp de empresa desconectado»), la última del 24/09. Las
  ids 13, 14 y 15 son del **06/10 entre las 18:00:48 y las 18:01:19 UTC**, ws1, secuencia 198,
  paso 1, estado `enviado`, `texto_autor: 'fijo'`, sin error, con el texto «Te dejo aquí el
  video: https://confirmar.lovable.app» a tres leads distintos. **Son los primeros envíos
  reales del motor en producción.** Y quedan 3 inscripciones activas en el ws1 (199 sobre la
  secuencia 198; 200 y 201 sobre la 213, con reunión el 10/10 y el 13/10), o sea que van a salir
  más. Si algo sale mal con clientes, mirar acá primero.

---

## 3. Las trampas del área

- **El diagnóstico obvio del semanal era el equivocado.** Parecía que el arreglo iba en el
  choke point `despacharReporte` —un solo lugar, los tres crons pasan por ahí—. No: el diario y
  el horario **no** tienen `porDefecto 'on'` y se habrían callado en el ws1. El arreglo vive en
  el cron semanal, no en el despachador.
- **«No existe la instancia» y «la sesión se cayó» llegan igual de muertas, y no son lo mismo.**
  Ni el estado de la fila ni `ultima_conexion_at` sirven para distinguirlas: el webhook escribe
  lo mismo en los dos casos. Lo único que las separa es **qué contestó la sonda**. Un aviso que
  no distingue le escribe para siempre a quien soltó su número a propósito.
- **Las cachés son las que se olvidan** cuando algo pasa de uno a varios. Dos cachés de
  **módulo** en la bandeja (hilos y conversaciones) estaban indexadas como si hubiera una sola
  línea: ninguna da error, pintan la conversación de otro número por un instante y una además la
  marcaba como leída. Sobreviven al cambio de línea **y al cambio de cliente en la misma
  pestaña**.
- **Un nombre de línea derivado («el primer número libre»: `_2`, `_3`…) hereda el espejo del
  anterior.** Al desvincular se borra la fila pero no `wa_mensajes`, así que el número **nuevo**
  mostraba y contestaba los chats del **viejo**. El sufijo pasó a ser al azar
  (`nombreLineaNueva`, `lib/lineas-whatsapp.ts:54`).
- **`getInstanciaRow()` era un `.maybeSingle()` sin filtro.** Con dos filas supabase-js devuelve
  error y `data` null: los ~15 lugares que preguntan «¿hay WhatsApp?» habrían leído «no» el día
  que alguien vinculara su segundo número. El mismo `maybeSingle` estaba copiado en
  `lib/api-mako/areas/chatbot.helpers.ts`.
- **Después de verificar algo que agenda, se cuentan las filas que quedaron.** La fila id 12 de
  `avisos_programados` era un resto de una verificación del 30/09 (creada 20 minutos después del
  commit que armó el CRON) y llevaba una semana mandándole a Mauricio el reporte de julio todos
  los días. La cosecha anterior decía que la fila de la prueba «se borró» — se borró **una**.
- **Un `throw` de una server action llega al navegador como un mensaje genérico**, porque Next
  redacta el error en producción. Los ids que `LeadDuplicadoError` traía adentro para poder
  ofrecer «abrí el que ya tenés» se perdían. El choque vuelve como dato (`{ id } | ChoqueDeLead`),
  no como excepción.
- **Un guard que busca un patrón en el fuente se enumera en POSITIVO y se exime por BLOQUE.**
  `tests/link-con-workspace.test.ts` existía desde el 05/10 y daba verde sobre 25 links rotos:
  era ciego a la ruta guardada en una variable y a la URL armada en una constante de módulo, y
  eximía por **archivo** (una excusa legítima en una línea dejaba pasar todo el resto).
- **La conexión directa a la base es sólo IPv6.** Desde una red sin IPv6, `postgres` contesta
  `getaddrinfo ENOENT` y se lee como «se cortó internet» — mientras GitHub, Vercel y la API REST
  de Supabase contestan perfecto. La salida es el pooler de sesión, usuario `postgres.<ref>`,
  host `aws-1-us-west-2.pooler.supabase.com` (⚠️ `aws-0` contesta «tenant/user not found»).
  Para **mirar datos** alcanza la REST y no hace falta nada de esto. Detalle en
  `docs/hallazgos-infra.md`.

**⚠️ Una contradicción sin resolver, de dos mediciones del mismo día.** El comentario de
`lib/chatwoot.ts:23` (commit `260bff7d`, 06/10 03:01) dice «los dos workspaces con Chatwoot
(ws1 y ws4) lo tienen declarado». El encabezado de `app/api/cron/reporte-semanal/route.ts`
(commit `c7510ddd`, 06/10 14:17) dice «sólo el ws1 lo tiene completo». **No pude dirimirla**:
las credenciales se leen por `credWs` (cifradas), no por `app_settings`. Si el ws4 tiene
Chatwoot, el semanal del ws4 saldría también por WhatsApp — pero el ws4 hoy queda salteado por
no tener destinatarios, así que no cambia nada el 12/10. Vale medirlo antes de confiar en
cualquiera de los dos textos.

---

## 4. Qué espera una decisión de Martín

1. **¿`wa-desconectado` entra en la lista que el cliente puede apagar?** Hoy está marcado como
   aviso de `'sistema'` y **no** figura en `AVISOS_DEL_CLIENTE` (`lib/avisos-catalogo.ts:235`),
   así que el negocio no lo ve ni lo puede apagar desde `/mensajes`.
   · **A:** entra a la lista — el cliente puede apagarlo, y puede apagar justo el aviso que le
   dice que su canal está muerto.
   · **B:** queda como está — nunca se calla, pero tampoco se puede editar el texto.

2. **¿Hay un aviso de «volvió»?** Hoy, al recuperarse la línea, se borran las marcas **en
   silencio** (`decidirLinea` → `'limpiar'`). La decisión fue avisar la caída; un «volvió»
   pide un mensaje propio en el catálogo.

3. **¿El semanal a los clientes va también por el grupo de MaKo?** Hoy el WhatsApp sale por el
   Chatwoot del workspace y casi nadie lo tiene, así que en los hechos es un mail. La
   alternativa es mandarlo por la voz de MaKo al grupo del cliente, como hace el aviso de línea
   caída.

4. **¿Elegir «Por tiempo» tiene que guardar en el acto?** Hoy sí, y por eso un click para mirar
   qué hace el botón deja un envío diario vivo — que es exactamente lo que le pasó al grupo de
   Leila. Que abra el editor del horario **sin guardar hasta confirmar** choca con «elegir uno
   apaga el otro y es una escritura», que se pidió así. Es producto, no un arreglo.

5. **¿Los reportes diario y horario se abren a los clientes?** Hoy quedaron a propósito como
   del dueño. Abrirlos es empezar a mandar un WhatsApp y un mail por día a cada negocio.

6. **Para «Por tiempo» sobre un reporte: ¿mandar la foto o correr el generador?** Hoy manda el
   texto guardado, que envejece (el del ws1 sigue siendo el de julio). Que «Por tiempo» corra
   su generador a esa hora es una feature, no un arreglo.
