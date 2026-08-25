# Hallazgos de comunicación (WhatsApp, nutrición, email, avisos)

Todo lo que hay que saber antes de tocar el espejo de Evolution (`lib/evolution-*.ts`), el
inbox oficial (`lib/chatwoot.ts`, `lib/meta-templates.ts`), el motor de nutrición
(`lib/nutricion.ts`), el email (`lib/resend.ts`, `lib/email-marketing.ts`) o los avisos
(`lib/avisos.ts`). **No es un changelog.**

Buena parte del material viene de los journals de las corridas multi-agente de junio a
agosto de 2026: **es de segunda mano**, sale de lo que devolvieron los subagentes en su
momento y no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué
fecha viene; antes de actuar sobre una, verificá contra el código. Las que se
re-verificaron lo aclaran. El registro completo de corridas está en
[corridas-multiagente.md](corridas-multiagente.md).

### Lo que más muerde acá

- **Un `200` del intermediario no es una entrega.** Chatwoot, Meta y Resend contestan OK y
  rechazan después, asincrónico: el contador dice «enviado» y el lead nunca recibió nada.
  Ver [WhatsApp oficial](#whatsapp-oficial-chatwoot-y-meta) y [Email](#email-resend).
- **Un link armado con `+` en un template literal no es un link, y nadie lo mira**: el aviso
  de cada mensaje entrante sale con `${acc}` y `${convId}` literales por unas barras
  invertidas. Vivo en producción. Ver
  [Instagram](#instagram-lo-que-hay-que-saber-antes-de-abrir-el-canal).
- **MaKo se queda mudo y nadie se entera:** toda su voz sale por UNA instancia de
  Evolution sin fallback, y los mensajes descartados no dejan traza. Estuvo dos semanas
  sin contestarle a ningún cliente. Ver [La voz de MaKo](#la-voz-de-mako-el-grupo-y-el-doer).
- **Un estado de error que no avanza ni reagenda tapona la cola entera** del motor de
  nutrición, sin señal y sin recuperación. Ver [Nutrición](#nutrición-y-secuencias).
- **Los defaults que inventan un dato son fugas:** el inbox `3` es el de Mauricio y el
  remitente sandbox de Resend entrega solo al dueño de la cuenta — 13 días de emails que
  «se enviaban». Ver [Webhooks y credenciales](#webhooks-dominios-y-credenciales).
- **El aviso del cliente termina en el grupo de la agencia** y su interruptor queda
  decorativo. Ver [Avisos y reportes](#avisos-y-reportes).
- **Los comentarios del código mienten seguido acá**: juran un arreglo, un orden o un
  relleno que ninguna rama hace. Ver [WhatsApp no oficial](#whatsapp-no-oficial-evolution).
- **El chatbot le pone a todo cliente el funnel de Mauricio**, y no por falta de contexto:
  el funnel SÍ le llega al modelo y pierde contra un imperativo del catálogo. Una clienta
  que prospecta en frío grabó un audio que dice «vi que dejaste tus datos en el anuncio».
  Ver [El Chatbot y el funnel](#el-chatbot-ex-setting--chat-agent-y-el-funnel-del-cliente).

---

## Reglas del dueño para todo lo que sale de la app

Cinco reglas transversales: valen para WhatsApp, para email, para los avisos y para
cualquier texto que MaKo genere.

### Toda prueba que sale hacia afuera va a Martín, nunca a un lead real

No hay entorno de staging para mensajería: probar es mandar de verdad. **Los envíos de
prueba van siempre a `martinkoncke@gmail.com` y a `+5493764673479`** («prefiero que todas
las pruebas siempre se hagan a:», 2026-07-14). Y probás vos: mandás el mensaje, movés el
lead, verificás en la UI. No se devuelve la prueba al usuario («No funciona... Por favor,
prueba tú.», 2026-07-20).

### MaKo habla en argentino cuando ASESORA; lo que produce para el cliente va en español neutro

Guiones, copy de anuncios, emails, mensajes de nutrición, textos de la app, onboarding:
todo en español plano y profesional — «tú» y no «vos», «dinero» y no «plata». «Esta bien
que MaKo tenga el acento Argentino al asesorar, pero no al crear cosas para el cliente»
(2026-06-30); «los textos de estos no deben estar en argentino o ser así de informales»
(2026-08-01). Lo mismo para las instrucciones que lee el usuario: «revisa como normalmente
escribimos las instrucciones, no deben estar en Argentino, debe ser más claro»
(2026-08-02).

**Vive en:** `lib/nutricion-generator.ts` · `app/api/email/generar` · todos los prompts de
`lib/prompt-registry.ts` que escriben de cara al cliente

### Cada mensaje de MaKo se tiene que entender solo, sin el anterior

Quién es la persona, qué es la campaña, dónde quedó. La cita es literal: «Cada mensaje se
tiene que entender por si solo. Eso es una regla que ya lo habíamos hablado. "Entró José
Rodríguez ¿QUIÉN ES JOSÉ? UN NUEVO LEAD... por el anuncio de RECON ¿QUÉ ES EL ANUNCIO
RECON?"» (2026-07-24). Y nada de jerga interna: «"Vieron tus videos", nuevamente no se
entiende. ¿Qué videos? mis reels? mis ads? Sería, vieron tus anuncios» (2026-06-30).

### Un mensaje por evento agrupado, no uno por ítem

Si son tres reuniones, va **un solo** WhatsApp, con la fecha y la hora de cada una: «si son
varias reuniones prefiero 1 solo mensaje, me parecía mas ordenado» / «El mensaje de
WhatsApp me debe decir la fecha y hora que se tuvo esa reunión» (2026-07-29).

### Ningún cambio de comunicación es solo para el dueño

Todo lo que se construye para el super-admin se construye para los clientes **en la misma
pasada**: «todo esto tiene que modificarse también para los clientes, que les aparezca lo
mismo, hoy en los clientes, sigue igual que antes» (2026-07-12); «Nunca razones que es solo
para el dueño» (2026-07-22). En esta área eso significa: si tocás avisos, plantillas o
inbox, verificá que la ruta esté scopeada por workspace y que la pantalla del cliente sea
la misma.

---

## WhatsApp no oficial (Evolution)

### El costo del WhatsApp escala con NÚMEROS CONECTADOS, no con mensajes enviados

**Síntoma:** al presupuestar «prendemos el chatbot y le escribimos a los 1.251 leads» se
asume que la factura del servidor se dispara, y al presupuestar «entran 10 clientes» se
asume que no cambia. **Es exactamente al revés.**

**Causa:** Evolution mantiene **una sesión de WhatsApp Web abierta y prendida las 24 h por
cada número vinculado** — la RAM se paga por estar despierta, no por mensaje. Y Railway
cobra por memoria y CPU prendidos (US$0,0139 por GB-hora) más tráfico (US$0,05 por GB), no
por request. Medido: escribirle a los 1.251 leads y recibir respuestas mueve ~45 MB =
**entre US$0,01 y US$0,05**. Cada cliente nuevo que escanea su QR, en cambio, deja una
sesión prendida para siempre y baja su historial (Leila conectó el 3/8 y metió 50.125
mensajes en 10 días): **US$1-3 por cliente por mes**.

**Regla:** para presupuestar el WhatsApp, contá **sesiones**, no mensajes. Y el techo real
de mandar mil mensajes no es la plata del servidor: es el **baneo del número** — mil
mensajes fríos seguidos desde WhatsApp Web es el patrón que Meta caza. Por eso el tope de
40 envíos/día por cliente existe y no se sube «para terminar antes»: eso no lo paga
Railway, lo paga el teléfono.

⚠️ **Dos cosas medidas en vivo que conviene saber:** (1) hay **un teléfono conectado dos
veces** — `mako_superadmin` y `mako_ws3` corren la MISMA cuenta de WhatsApp en dos
sesiones simultáneas, que además de pagar RAM de más es de los patrones que más rápido
gatillan un baneo; (2) **el motor de nutrición nunca mandó un mensaje**: la tabla de envíos
tiene cero filas en toda su historia y no hay ninguna secuencia activa de verdad (las que
figuran «activa» están archivadas, y el código exige las dos cosas). «Prender el chatbot»
no es un botón: es decidir qué secuencia y a qué grupo.

**Y sobre a quién pertenece esto:** Evolution y Chatwoot son software abierto que corre en
cualquier lado — **no hay dependencia de Railway**, hay una dirección en una línea de
config (`lib/evolution.ts:24`). Lo que sí ata es lo que ese servidor **guarda**: las
sesiones vinculadas. Mudarlo sin migrar eso obliga a **todos los clientes a re-escanear el
QR**. No conviene que cada cliente ponga el suyo: ya funciona compartido (un servidor, N
sesiones, el cliente solo escanea), no está en el catálogo de integraciones del cliente, y
el mínimo de Chatwoot son 4 GB ≈ US$41/mes **por cliente** para reemplazar algo que hoy
cuesta US$2.

**Vive en:** lib/evolution.ts:24 (EVOLUTION_BASE_URL) · lib/nutricion.ts:99 (tope 40/día) y :123-131 (secuencia activa) · *2026-08-13 railway-y-transcripcion*

### ⚠️ Evolution no trae nombres ni fotos de contacto, y desconectar no desconecta

**Síntoma:** el inbox no oficial muestra «Voce» o el nombre del propio dueño en vez del
contacto, trae contactos identificados por ID en vez de por número, trae muy pocos cuando
debería traerlos todos, el historial de chats llega recortado, y tras desconectar la
instancia sigue trayendo chats y dejando avanzar el onboarding. «Empezar de 0» tampoco
borra el historial de verdad. Reportado el 10/07, el 12/07 y de nuevo el 02/08 — sigue
igual.

**Regla:** este frente está roto de punta a punta, no en un solo punto; cualquier arreglo
parcial acá vuelve a aparecer. Antes de tocarlo, leé las dos entradas de más abajo sobre
`findMessages`/`findChats` y sobre las fotos de perfil: la mitad de los síntomas salen de
cómo pagina y cachea Evolution, no de nuestro mapeo.

**Vive en:** lib/evolution.ts · lib/evolution-mensajes.ts · app/whatsapp/EmpresaInbox.tsx ·
*2026-08-02 (reportes del dueño 10/07, 12/07, 02/08)*

### ⚠️ Las fotos de perfil no cargan, y la causa es distinta en cada canal

**Síntoma:** el inbox pinta iniciales generadas en vez del avatar, en los dos canales.
Reportado el 10/07 y todavía igual el 02/08 (con solo 4 chats expandidos).

**Causa real, canal por canal:**

- **Evolution:** las URLs de `pps.whatsapp.net` las firma el CDN de Facebook con los params
  `oh` (firma) y `oe` (expiración): **caducan en horas o días** y después el `<img>` queda
  roto con 403. Guardarlas en la base como si fueran permanentes es el error. Hay que
  re-fetchearlas con `/chat/fetchProfilePictureUrl` (en vivo) o bajar los bytes al bucket
  propio, y renderizar con `referrerPolicy="no-referrer"` porque el CDN puede rechazar por
  Referer. Ojo con la fuente: el `profilePicUrl` de `findChats`/`findContacts` sale de la
  tabla `Contact` cacheada y puede venir null, vacío o stale.
- **Chatwoot:** la foto **ya llega** y se tira en el mapeo. Cada conversación de
  `GET /conversations` trae `meta.sender.thumbnail` con la URL absoluta, en el MISMO objeto
  del que ya sacamos `sender.id`, `sender.name` y `sender.phone_number`. Pero `ConvRaw` no
  declara el campo, `mapConv`/`ChatwootConversation` no lo mapean y el acumulador `Acc` de
  `/api/whatsapp/conversations` no lo propaga. Esta URL **no** caduca: es absoluta del
  server de Chatwoot y sirve directo en un `<img>`.

**Regla:** al cablearlo, dos trampas. Chatwoot manda **cadena vacía** (no null) cuando el
contacto no tiene foto — un `?? null` no la normaliza y el `<img>` queda con `src` vacío —,
y como la ruta agrupa varias conversaciones por persona hay que quedarse con el primer
thumbnail no vacío.

**Vive en:** lib/evolution.ts (fetchProfilePic) · lib/chatwoot.ts (ConvRaw ~187,
ChatwootConversation ~168, mapConv ~191) · app/api/whatsapp/conversations/route.ts (Acc ~69)
· app/whatsapp/page.tsx (interface Contacto 22-37, avatarStyle 145, usos 538 y 563) ·
*2026-07-10 evolution-live-pull-research + 2026-06-23 wa-inbox-recon*

### ⚠️ El paso «Verificación» del onboarding no verifica el canal que dice verificar

**Síntoma:** un cliente con el WhatsApp completamente desvinculado completa igual el paso
`wa_no_oficial_prueba`, que se presenta como la prueba de que su canal entrega de verdad.
El comentario del propio route lo dice: «guardar la credencial NO es estar conectado; el
paso cierra cuando llega un mensaje de verdad».

**Causa real:** el código manda el código con `enviarCodigoVerificacion` →
`enviarAlGrupoMaKo` → `instanciaVoz()`, que devuelve `mako_ws1` o `mako_superadmin`: la
línea de **voz de MaKo**, nunca `mako_ws<N>`. El destino cae al teléfono del perfil y el
código llega desde MaKo.

**Regla:** un paso de verificación tiene que usar exactamente el transporte que verifica.
Corolario que se derivó de esto: **no** tiene sentido desmarcar el paso al desvincular — lo
que hay que arreglar es que pruebe el canal del cliente.

**Vive en:** app/api/chat-agent/onboarding/prueba/route.ts:45-51 · lib/mako-grupo.ts:30
(instanciaVoz), :308, :409-411 · *2026-08-02 mako-desconexion-estado-pegado*

### ⚠️ El upsert del espejo borra la media ya guardada cuando el mensaje se re-entrega

**Síntoma:** el archivo queda huérfano en el bucket y el mensaje pierde su media — se
pierde el «respaldo total» que es el objetivo de la feature.

**Causa real:** `guardarMensajeUpsert` escribe todas las columnas incondicionalmente con
`onConflict (workspace_id, wa_message_id)`. Evolution reenvía `messages.upsert` con el
MISMO `key.id` en dos sabores: `'notify'` (en vivo, trae el base64) y `'append'` (sync de
historial o reconexión, generalmente sin media), y el webhook procesa los dos por igual. La
re-entrega sin base64 produce `mediaPath=null` y **pisa con null** el `media_path` que la
primera entrega guardó bien. Ídem `texto`.

**Regla:** en un upsert de espejo, leé la fila primero y no escribas columnas que la
entrega actual no puede llenar.

**Vive en:** lib/evolution-mensajes.ts:104-125 · app/api/webhooks/evolution/route.ts:89 ·
*2026-07-09 ~auditoria-espejo-evolution-inbox*

### ⚠️ Una reacción o un mensaje borrado pausan la nutrición como si fueran una respuesta

**Síntoma:** una inscripción pasa de `activa` a `respondio` y se anula `proximo_envio_at`
sin que el lead haya contestado nada. De paso se pintan burbujas vacías que ensucian el
preview de la conversación.

**Causa real:** `extraerContenido` cae a `{ tipo: messageType, texto: null }` para todo lo
que no reconoce —`reactionMessage`, `protocolMessage` (borrar/revocar), `editedMessage`— y
`guardarMensajeUpsert` solo filtra grupos y status. Esas filas entran al espejo como
mensajes normales, y como el disparo es `!fromMe && leadId`, un pulgar arriba llama a
`pausarPorRespuesta(leadId)`.

**Regla:** guardar el crudo está bien; lo que falta es **segregar los eventos que no son
contenido** de los caminos de display y de pausa.

**Vive en:** lib/evolution-mensajes.ts:56 y :94-131 · *2026-07-09
~auditoria-espejo-evolution-inbox*

### ⚠️ El mime de la media lo elige el remitente y se sirve inline

**Síntoma:** superficie de XSS almacenado sobre el inquilino, sin necesidad de tener el
secreto del webhook: es el camino normal de la feature.

**Causa real:** `extraerContenido` toma `media_mime` verbatim del payload de WhatsApp
(`img.mimetype`, `doc.mimetype`, …), `subirMedia` lo pasa tal cual como `contentType` del
upload, y `getMensajesDeChat` lo devuelve con una signed URL **sin disposition** — o sea
Supabase lo sirve inline con el content-type que declaró el remitente. El mimetype de un
`imageMessage` lo pone el cliente que envía y es trivialmente forjable con un Baileys
modificado: se pueden mandar bytes de HTML/JS declarados `text/html`. La migración del
bucket `wa-media` no define `allowed_mime_types` ni `file_size_limit`, así que el único
freno es el cap de 25 MB de la app.

**Vive en:** lib/evolution-mensajes.ts:45-54 y :86 · supabase/migrations/0073 · *2026-07-09
~auditoria-espejo-evolution-inbox*

### ⚠️ `wa-media` es un bucket compartido: borrar el espejo por prefijo `${ws}/` se lleva los audios del Setting

**Síntoma:** limpiar el espejo de un número desvinculado borraría la biblioteca de notas de
voz que el dueño grabó para las secuencias. Y al revés: cada vez que alguien apretó «Borrar
todo el historial» dejó binarios huérfanos en el bucket. **Ya hay basura acumulada.**

**Causa real:** los binarios del WhatsApp no oficial viven en `wa-media` bajo
`${ws}/mako_ws${ws}/`, pero en el MISMO bucket, bajo `${ws}/setting-audios/`, vive la
biblioteca de audios. El patrón que uno copia por inercia es el de `reset-workspace`, que
borra el prefijo `${ws}/` entero. Y `borrarEspejoNoOficial` borra ÚNICAMENTE filas de
`wa_mensajes`: nada en el repo borra los binarios salvo `resetearWorkspace`.

**Regla:** el prefijo correcto es siempre `${ws}/mako_ws${ws}/`.

**Vive en:** lib/evolution-media.ts:24 · lib/setting-audios.ts:52 ·
lib/evolution-mensajes.ts:572-576 (borrarEspejoNoOficial) · lib/reset-workspace.ts:138-149 ·
*2026-08-02 mako-desconexion-estado-pegado*

### El comentario del código juraba que el bug ya estaba arreglado

**Síntoma:** la mitad de la agenda de WhatsApp aparecía con el número crudo, como si esos
contactos no tuvieran nombre guardado.

**Causa real:** `getNombresContacto` paginaba con `.range()` **sin ORDER BY**, así que la
página 2 repetía contactos de la 1 y salteaba otros — y los salteados son exactamente los
que salen con el número crudo. El comentario que había arriba del bucle atribuía el arreglo
de **ese mismo síntoma** al `.range()` que se había agregado antes.

**El diagnóstico obvio era el equivocado dos veces:** primero se creyó «falta paginar» (era
la mitad), y después el comentario hizo creer que ya estaba resuelto. La trampa completa
está en [hallazgos-infra.md](hallazgos-infra.md) §1.

**Regla:** un comentario que declara un síntoma resuelto **no es evidencia**. Si el síntoma
sigue, el comentario es parte del bug.

**Vive en:** lib/evolution-mensajes.ts (getNombresContacto) · *corrida 08/2026*

### Comentarios que afirman un orden o un relleno que no existen

La misma trampa, tres casos verificados en el mismo frente: el comentario promete algo que
ninguna rama del código hace.

1. `getMessagesForConvs` hace `ids.slice(0,15)` y el comentario dice que los convIds vienen
   «recent-first» — es falso, se pushean en orden de iteración de páginas, así que con más
   de 15 conversaciones se corta cualquiera.
2. El espejo escribe `instance_name:''` y `raw:{local:true}` con un «lo completa el webhook
   si vuelve»: ninguna rama los rellena nunca (si llega primero el eco, el espejo lo PISA;
   si llega primero el espejo, el patch queda vacío).
3. El matcher de teléfono de Evolution usa `.like('%'+last10).limit(1)` **sin `order`**, o
   sea match no determinista, mientras el de Chatwoot ya fue endurecido con `.eq` exacto
   primero y verificación de los últimos 10 dígitos en JS.

**Regla:** cuando un comentario afirma un orden, un relleno o una garantía, buscá la línea
que lo cumple antes de confiar.

**Vive en:** lib/chatwoot.ts:398 · lib/evolution-envio.ts:31-42 ·
lib/evolution-mensajes.ts:67-73 vs app/api/webhooks/chatwoot/route.ts:42-59 · *2026-06-23
~auditoria-inbox-whatsapp-chatwoot + 2026-07-09 ~auditoria-espejo-evolution-inbox*

### `wa_timestamp` se repite en ráfagas, así que paginar por él saltea mensajes

Es la misma trampa que la paginación de contactos, y por eso vuelve: 16 mensajes en 4
segundos comparten timestamp, y los volcados del importador entran de a cientos con el
mismo valor. Los dos bucles del onboarding (`contexto/route.ts`,
`conversaciones/route.ts`) paginaban por `wa_timestamp` a secas. Hoy desempatan por `id`
(`bigint identity primary key` de `wa_mensajes`).

**Regla:** en `wa_mensajes` el orden **siempre** lleva `id` de desempate, en cualquier
sentido.

**Vive en:** app/api/chat-agent/onboarding/contexto/route.ts ·
app/api/chat-agent/onboarding/conversaciones/route.ts · *corrida 08/2026*

### En Evolution, «connecting» no significa que se esté por conectar

`GET /instance/connectionState` decía `close` y `GET /instance/fetchInstances` decía
`connecting` para la misma instancia, al mismo tiempo. No es un bug de reporte: son dos
fuentes distintas — `connectionState` lee **memoria** y `fetchInstances` lee la **fila de
Postgres**. En 2.3.7 el valor `connecting` de la fila se escribe SOLO dentro del bloque que
emite QR, o sea que es el rastro del último QR emitido, no un estado en curso. Y
`setInstance` auto-conecta al bootear todo lo que esté en `open` o `connecting`, así que
cada reinicio del contenedor repite el ciclo QR → límite → close indefinidamente.

**Regla:** si `disconnectionAt` es null pero pidió QR, la sesión está invalidada: hay que
re-escanear.

**Vive en:** Evolution API v2.3.7 (externo); se consulta desde lib/evolution.ts y
lib/mako-canal.ts (estadoCanalMaKo) · *2026-07-29 ~forense-canal-mako-mudo*

### El estado `'error'` de Evolution viaja con `ok:true` y el onboarding te ofrece re-escanear el QR

**Síntoma:** con Evolution caído (host inalcanzable, timeout, 5xx) el onboarding le muestra
«Generar código QR» a un número que ya estaba vinculado — y **re-escanear tumba la sesión
viva**.

**Causa real:** `estadoEnVivo()` devuelve `{estado:'error'}` y la ruta lo envuelve en
`Response.json({ ok:true, ...s })`. El onboarding chequea solo `j.ok && j.estado`, guarda
`'error'`, no matchea ninguna rama y cae al último else. `EvolutionConnect.tsx` ya
compensaba a mano con `body.ok && body.estado !== 'error'`; el onboarding se olvidó esa
mitad de la guarda, y `'conectando'` tampoco tiene rama.

**Regla:** un `ok:true` con un campo `estado:'error'` adentro es una mentira de contrato; si
no se pudo comprobar, que la ruta devuelva `ok:false` o un `'desconocido'` explícito. Dato
útil: `estadoEnVivo` corta con return ANTES del upsert, así que el `'conectado'` cacheado en
`evolution_instancias` sigue siendo confiable como respaldo.

**Vive en:** lib/evolution.ts:242 (estadoEnVivo) · app/api/whatsapp/evolution/route.ts:68 ·
app/chat-agent/OnboardingChatAgent.tsx:407-418 · *2026-08-05
~verificar-commits-contra-el-board*

### En `findMessages` de Evolution, `offset` es el tamaño de página, no el desplazamiento

Pedir la «página 2» con `offset:50` devuelve otra vez lo mismo. En Evolution v2.3.7
`offset` es el **take** (default 50) y el skip lo calcula el server como
`offset*(page===1?0:page-1)`; `findChats`, del mismo controlador, en cambio usa take/skip
crudos. Además `findMessages` **no devuelve un array**: devuelve
`{messages:{total,pages,currentPage,records:[...]}}` ordenado por `messageTimestamp` DESC
(epoch en segundos), y `findChats` sí devuelve array plano pero armado desde la tabla
`Message`, así que **un contacto sin mensajes no aparece nunca**.

**Regla:** contra Evolution, parsear defensivo las dos formas y no asumir que dos endpoints
del mismo controlador paginan igual.

**Vive en:** lib/evolution.ts (evFetch) → POST /chat/findMessages/{instance} y
/chat/findChats/{instance} · *2026-07-10 evolution-live-pull-research*

### Un «Cargando…» que no termina nunca no puede ser una query vacía ni un error

**Síntoma:** el hilo del inbox no oficial se quedaba en «Cargando…» para siempre.

**Causa real:** los tres diagnósticos obvios eran los equivocados y se descartaron por
razonamiento mecánico, sin tocar la base: si el `chat_jid` no matcheaba, la query volvía
vacía y la UI pinta «Sin mensajes»; si el server tiraba, el catch devuelve 500 y la UI pinta
el error con botón Reintentar; si el ref de selección se desincronizaba, el siguiente
`loadMsgs` apagaba el loading igual. **Toda respuesta que resuelve cae en poblado, vacío o
error — ninguno de esos estados sostiene un spinner.** La causa era la única I/O que el hilo
tenía de más respecto de la lista (que sí cargaba): `getMensajesDeChat` firmaba la media con
`createSignedUrl` en un loop secuencial con await, y ese llamado al storage no resolvía.

**Regla doble:** (1) al diagnosticar, dejá que el síntoma descarte causas — «eterno» acusa a
un request colgado, no a un dato faltante; (2) todo fetch que alimenta un spinner necesita
`AbortController` con timeout, si no un backend colgado se convierte en una pantalla sin
error y sin salida.

El firmado ya pasó a batch (`createSignedUrls` con try/catch: si el storage falla se sirve el
hilo sin media) y `loadMsgs` ya tiene su controller, pero el `jget` genérico de
`EmpresaInbox:51` —el que trae la LISTA— **sigue sin `signal`**.

**Vive en:** lib/evolution-mensajes.ts (firmado de media de `getMensajesDeChat`) ·
app/whatsapp/EmpresaInbox.tsx:51 (`jget` sin AbortController) · *2026-07-10
wa-no-oficial-paridad-diagnostico*

### `evFetch` no tiene timeout y el cron de nutrición itera workspaces en serie

El cliente de Evolution llama a `fetch()` **sin `AbortSignal`**, así que una conexión colgada
dura hasta que Vercel mata la función. El cron recorre TODOS los workspaces activos en serie
dentro de UNA invocación con `maxDuration=300`, y cada envío bloquea entre 1,2 y 10,8 s por
el delay anti-ban (~65 s por workspace en el peor caso): un solo socket trabado se come la
corrida y **mata de hambre a los workspaces siguientes**. Peor: el envío ocurre ANTES de que
se commitee el avance del paso, así que un kill a mitad deja el paso sin avanzar y el mensaje
se re-manda en la corrida siguiente.

**Regla:** todo fetch a un proveedor externo lleva `AbortSignal.timeout`.

**Vive en:** lib/evolution.ts:43-64 y :253-258 · app/api/cron/nutricion/route.ts:100 ·
*2026-07-09 ~auditoria-envio-evolution-nutricion*

### Los topes del espejo son de producto: se escriben, no se esconden en el `for`

Los dos barridos de `lib/evolution-mensajes.ts` tenían un tope mudo de 20.000 filas escondido
en el `for`. Se preservó tal cual (`TOPE_PAGINAS_ESPEJO = 20`) porque bajarlo dejaría sin
inbox a un workspace grande — pero ahora vive en el call-site
(`return nro < TOPE_PAGINAS_ESPEJO`) y, con el orden `desc`, dice lo que hace: **los 20.000
mensajes más recientes**. Lo mismo en los dos routes del onboarding (8.000 / 20.000).

Relacionado con la regla del dueño: **no poner límites arbitrarios** («no limites las horas,
que se pueda agendar a la madrugada si quieren», 2026-08-07). El tope lo pone la API o el
costo, no nosotros — y cuando existe, se escribe.

**Vive en:** lib/evolution-mensajes.ts (TOPE_PAGINAS_ESPEJO) ·
app/api/chat-agent/onboarding/* · *corrida 08/2026*

### Qué degrada y qué rompe se decide por dato, no por módulo

En el mismo lote, dos decisiones opuestas y las dos correctas:

- **`getNombresContacto` degrada** a `Map` vacío (`.catch(() => new Map())`): la agenda es un
  adorno del inbox. Sin ella se ve el número; una agenda ilegible **no puede** dejar al dueño
  sin inbox.
- **Los routes del onboarding propagan** el error (500 con mensaje). Antes un fallo en la
  página 1 daba `filas = []` → «no tenés conversaciones», que es el falso all-clear.

**Regla:** la pregunta no es «¿este módulo tolera errores?» sino «**¿qué le decimos al
usuario si esta lectura falla?**». Si la respuesta es una frase que también significa «no hay
nada», tiene que romper.

**Vive en:** lib/evolution-mensajes.ts · app/api/chat-agent/onboarding/* · *corrida 08/2026*

### Decisión: el canal no oficial copia el diseño del oficial, con UNA marca que los distinga

«quiero que sea igual. Lo único es que me gustaría tener algo que los diferencie, para que
nunca se confundan» (2026-07-10). No son dos productos: es la misma pantalla con una marca
visible de canal.

### Lo que sigue sin hacer

- **Los PDF no se previsualizan** («ha rechazado la conexión») ni en el canal no oficial ni
  en la app en general. Reportado dos veces el mismo día y de nuevo el 12/07.
- **«Ocultar contacto» no oculta nada** y no muestra el pop-up de confirmación. Falta el
  botón de ocultar/desocultar en el inbox, para las conversaciones personales que el dueño no
  quiere previsualizar en MaKo (10/07).
- **Aprovechar más el webhook de Evolution**: por ejemplo, poner la etiqueta de WhatsApp
  automáticamente según la ETAPA del lead (10/07).

---

## WhatsApp oficial (Chatwoot y Meta)

### ⚠️ Un 200 de Chatwoot NO es una entrega: Meta rechaza después y nadie se entera

**Síntoma:** la UI dice «enviado» para algo que el lead nunca recibió. Pasa en los dos
caminos:

- **Adjuntos:** el route responde `ok:true` en cuanto Chatwoot crea el mensaje saliente; el
  rechazo de Meta llega asincrónico y el mensaje queda en el hilo marcado `failed` sin ningún
  aviso. Tres motivos que el código no valida: **tipo de archivo** (el `accept` del input es
  cosmético, cualquiera postea al route), **tope por tipo** (WhatsApp corta imágenes en 5 MB
  mientras el route usa un cap único de 16 MB) y **ventana de 24h cerrada** (la guarda es solo
  de UI, sobre un snapshot polleado cada 20s).
- **Nutrición, rama oficial:** `sendWhatsappTemplate` devuelve `{ok:true}` en cuanto Chatwoot
  acepta. El rechazo de Meta (plantilla no aprobada, pausada, variables que no calzan) solo
  aparece como `status='failed'` + `content_attributes.external_error` en el hilo de
  Chatwoot — nunca en `nutricion_envios`, que ya escribió `'enviado'` y avanzó la inscripción.
  Las únicas validaciones síncronas son «lead sin teléfono» y «paso sin `template_wa`»; nadie
  verifica que la plantilla esté APROBADA antes de disparar (`ensureTemplateSynced` solo
  sincroniza la lista de Chatwoot).

**Regla:** validar allowlist de MIME y tope por tipo antes de mandar; para lo que no se pueda
validar, que la UI diga «encolado», no «enviado»; y si el fallo real vive en otro lado, hay
que ir a buscarlo (reconciliar contra `getMessages` o el webhook) o el contador de enviados
miente.

**Vive en:** app/api/whatsapp/contacts/[id]/attachments/route.ts + lib/chatwoot.ts
(sendAttachmentToContact) · lib/chatwoot.ts:139-171 (sendWhatsappTemplate) · lib/nutricion.ts
rama oficial (~1120-1140) · lib/meta-templates.ts:427 (reconcileDrafts, **sin cron propio**:
hoy depende de que alguien abra la app) · *2026-06-23 ~review-adjuntos-whatsapp + 2026-07-09
f33-understand*

### ⚠️ Desbloquear en WhatsApp resucita a un lead que estaba descalificado por otra razón

**Síntoma:** un lead legítimamente descalificado que alguien bloquea y desbloquea vuelve a
«abierto» y **pierde su motivo histórico**.

**Causa real:** al desbloquear, la ruta hace `else if (estado === 'descalificado')` →
`estado_lead:'abierto'`, `motivo_perdida:null`, `pipeline_stage:null`. La condición asume que
TODO lead descalificado lo está por culpa del bloqueo, y el comentario del código lo dice
explícito («el bloqueo es lo que descalifica acá»). Falso: `bloqueado` viene del contacto de
Chatwoot y `estado_lead` del lead, coexisten, y un closer o el formulario pueden haber
descalificado antes.

Verificado el 2026-08-07: la rama de **bloquear** ya se arregló (solo mueve si el lead estaba
`'abierto'`), pero la de **desbloquear sigue revirtiendo a ciegas**.

**Regla:** un deshacer que no guarda quién puso el estado no es un deshacer, es un pisado.

**Vive en:** app/api/whatsapp/contacts/[id]/block/route.ts (rama
`else if (estado === 'descalificado')`) · *2026-06-23 ~review-inbox-whatsapp*

### Se ESCRIBE en una conversación de Chatwoot y se LEE de otras: el mensaje propio desaparece tras el refetch

**Síntoma:** mandás un mensaje, aparece la burbuja optimista, y al refrescar el hilo el
mensaje ya no está (o no entra un entrante reciente del lead).

**Causa real:** el diagnóstico obvio —«el POST falló»— es el equivocado: el mensaje llegó
bien, pero a una conversación que la lectura no mira. `crearOReusarConversacion`
(lib/chatwoot.ts:396) elige la conversación con `status==='open'`; `getMessagesForConvs`
(:417) lee las N más recientes por `last_activity_at`. Son **dos ejes distintos**, y
`last_activity_at` en Chatwoot bumpea por actividad que NO es un mensaje (cambios de estado,
labels, asignaciones), así que una conv `'open'` vieja puede quedar fuera del corte.

**Regla:** la conversación de ENVÍO tiene que estar SIEMPRE en el conjunto que se lee — que el
listado marque explícitamente la `sendConvId` y el hilo la incluya, en vez de confiar en el
orden. Ojo también con el comentario del código: dice «solo las 4 más recientes» y afirma que
«los mensajes actuales viven en la última conversación» — el corte hoy es 6 y la premisa es
justamente la que no se cumple.

**Vive en:** lib/chatwoot.ts (crearOReusarConversacion :392-400 vs getMessagesForConvs
:417-424) + app/api/whatsapp/thread/route.ts · *2026-06-23 ~review-inbox-whatsapp*

### `saliente` es un booleano sobre CUATRO tipos de mensaje de Chatwoot

**Síntoma:** el análisis del lead sacaba dolor, objeciones y señales de compra **de nuestro
propio marketing**.

**Causa real:** `getMessages` mapea `saliente = message_type === 1`, pero Chatwoot tiene 4:
`0` entrante, `1` saliente, `2` actividad del sistema, `3` plantilla (saliente). Las
plantillas de nutrición que mandamos NOSOTROS y los «conversación resuelta» del sistema
entraban al prompt etiquetados como «LEAD:». Peor: el gate de «hay sustancia para analizar»
contaba esas líneas, así que se abría sin un solo mensaje real del lead. El propio repo ya
filtraba el type 2 en otro camino (`mapConv`) porque las actividades con texto enmascaraban la
dirección — el filtro nunca se había replicado acá.

**Regla:** hoy `lead-insights` usa `messageType` explícito, pero el mapeo booleano de
`lib/chatwoot.ts` sigue igual: **cualquier consumidor nuevo repite el error**.

**Vive en:** lib/chatwoot.ts (saliente = message_type === 1) · lib/lead-insights.ts
(bloqueChat) · *2026-07-04 ~auditoria-insights-del-lead*

### `cwFetch` fuerza Content-Type JSON: un adjunto por multipart entra sin archivo y sin error

`authHeaders()` (lib/chatwoot.ts:32-34) devuelve
`{ api_access_token, 'Content-Type': 'application/json' }` y `cwFetch` lo spreadea ANTES de
`init.headers` (l.40-54). Si reusás `cwFetch` para postear un `FormData` a
`/conversations/{id}/messages`, Chatwoot recibe Content-Type JSON con un body multipart y no
parsea el archivo: **el mensaje entra igual, sin adjunto y sin error**.

**Regla doble y contraintuitiva:** para el adjunto va un `fetch` propio con SOLO
`api_access_token`, y NUNCA se setea Content-Type a mano en multipart (fijarlo rompe el
boundary que pone undici). El campo es `attachments[]` —con corchetes— en el mismo endpoint
que el texto libre; no hace falta el endpoint de `/upload` de assets.

**Vive en:** lib/chatwoot.ts (authHeaders 32-34, cwFetch 40-54, sendText 279-291) +
app/api/whatsapp/contacts/[id]/messages/route.ts (POST, hoy solo `req.json()`) · *2026-06-23
wa-inbox-recon*

### No persistir el `contact_id` de Chatwoot: duplica por +54 vs +549

Chatwoot crea contactos duplicados para el mismo teléfono según el formato (`+54` vs `+549`) y
cuál es el «bueno» **cambia con la actividad** — por eso la ruta de conversaciones ya re-elige
`sendContactId` en cada carga. Guardar `chatwoot_contact_id` en el lead lo congela en el
duplicado equivocado y los envíos empiezan a caer en un hilo muerto.

**Regla:** resolver el contacto en vivo con `buscarOCrearContacto`; para deep-linkear a la tab
no hace falta el id, alcanza el groupId determinístico `'p' + últimos 10 dígitos` del teléfono.

**Vive en:** app/api/whatsapp/conversations/route.ts:72 (groupKey) · lib/chatwoot.ts ·
*2026-07-02 audit-automatizaciones-lead*

### El navegador NO graba en el formato que sabe reproducir: la nota de voz de Chrome/Edge salía «OK» y Meta la tiraba

**Síntoma:** el usuario veía el envío terminar bien y Meta dropeaba el audio sin aviso. Solo
Firefox (ogg) y Safari (mp4) entregaban.

**Causa real:** `pickAudioMime` probaba `audio/ogg;codecs=opus` y `audio/mp4` primero, pero el
MediaRecorder de Chrome y Edge solo sabe **reproducir** esos formatos, no grabarlos:
`isTypeSupported` devuelve false y cae a `audio/webm`, que la Cloud API no acepta. Y la barrera
del server era `if (base.startsWith('audio/')) return true`, así que lo dejaba pasar y Chatwoot
lo reenviaba tal cual.

**Reglas:** (1) nunca asumir que MediaRecorder graba lo que el navegador reproduce — hay que
mirar el `mimeType` real del recorder, no el que pediste; (2) la barrera del server va con
lista blanca real (`AUDIO_OK` = ogg/mpeg/mp4/aac/amr/3gpp), nunca con `startsWith`; (3) MP3 es
el único formato que WhatsApp entrega acá, así que se transcodifica en el cliente antes de
mandar.

**Vive en:** app/whatsapp/WhatsAppApp.tsx (onstop → blobToMp3) · app/whatsapp/audio.ts ·
app/api/whatsapp/contacts/[id]/attachments/route.ts:34-41 (AUDIO_OK) · *2026-06-23
~review-inbox-whatsapp*

### Lo que sigue sin hacer

- **MP3 nunca va a ser una nota de voz de WhatsApp, y el 131053 no es por el MP3.** Dos cosas
  que quedaron claras y no están escritas en ningún otro lado. (1) El `131053` de Meta es un
  error **genérico de media**, no «MP3 no soportado»: `audio/mpeg` está soportado hasta 16 MB y
  48 kHz no es la causa; lo que falla es el header que arma lamejs o el MIME mal puesto, y si el
  `error_data.details` habla de 429/fwdproxy hay que subir por `media_id` en vez de por URL. (2)
  WhatsApp solo pinta la burbuja de nota de voz con `.ogg`/OPUS y `audio:{voice:true}` — con MP3
  ese techo es **inalcanzable por definición**. El backend YA acepta `audio/ogg` (`AUDIO_OK`):
  falta solo el encoder del lado del cliente (opus-recorder, un único asset de ~175 KB gzip
  servido desde `/public`, import dinámico con `ssr:false`). Hoy se graba con MediaRecorder y se
  re-encodea a MP3 con lamejs (Opus→PCM→MP3: doble transcodificación con pérdida, JS puro, lenta
  en móviles). Antes de prometer «nota de voz nativa», verificar que Chatwoot exponga
  `voice:true` hacia la Cloud API: el OGG es condición necesaria, no suficiente.
  **Vive en:** app/whatsapp/audio.ts (blobToMp3) · app/whatsapp/EmpresaInbox.tsx:374 ·
  app/api/whatsapp/contacts/[id]/attachments/route.ts:34 · *2026-06-23 wa-audio-131053*
- **Contador de la ventana de 24hs por lead** en la tab WhatsApp, y poder filtrar a los leads
  dentro/fuera de esa ventana (2026-06-24).

---

## Plantillas de Meta

### ⚠️ 18 de las 29 plantillas de `docs/nutricion-templates.md` arrancan con `{{nombre}}`, que es rechazo automático

La investigación de las reglas de aprobación (fuentes oficiales de Meta + checklists de la
industria) dejó una rúbrica con bloqueantes, y el primero es: **el body no puede empezar ni
terminar con una variable** — una plantilla «demasiado rellenable» se lee como infraestructura
de spam y se rechaza sola. El archivo que hoy es fuente de verdad para cargarlas tiene 18
plantillas que empiezan literal con `{{nombre}},`.

Los otros bloqueantes, que valen para el generador de MaKo: ratio de texto fijo
≈ 3×(nº de variables)+1, cada variable con su sample obligatorio, nada de acortadores ni links
`wa.me`, footer sin variables ni emojis, y nombre en snake_case sin «test».

**Cambio de enforcement:** desde abr-2025 Meta recategoriza UTILITY→MARKETING sola (y desde el
16/4 sin el aviso previo de 24h) — una utility con redacción persuasiva empieza a costar como
marketing sin que toques una palabra.

**Vive en:** docs/nutricion-templates.md (18 plantillas) · lib/nutricion-plantillas.ts (el
generador que hoy las escribe) · lib/meta-rules.ts · *2026-06-24
~map-secuencias-y-plantillas-meta*

### `{{1}}` con `parameter_format: NAMED` = rechazo de Meta sin explicación

**Causa real:** el regex de `detectarVars` era `/\{\{\s*([a-z0-9_]+)\s*\}\}/gi`, así que
aceptaba `{{1}}` y `{{123}}` como nombre de variable; `syncParams` generaba `param_name:'1'` y
`buildGraphPayload` mandaba siempre `parameter_format:'NAMED'`. Meta rechaza con error 100
porque `{{1}}` es sintaxis POSITIONAL.

**La trampa:** existía una validación de nombre (`/^[a-z0-9_]+$/`) que hacía creer que estaba
cubierto — pero valida el nombre de la **plantilla**, no las variables del cuerpo.

**Regla:** el regex que extrae variables tiene que exigir que empiecen con letra o `_`, y el
backend debe rechazar un body con `{{\d}}` o con una `{{var}}` que no esté en `params[].name`
**antes** de gastar el viaje a Meta.

**Vive en:** app/whatsapp/PlantillasPanel.tsx (detectarVars) + lib/meta-templates.ts
(buildGraphPayload) · *2026-06-24 ~review-plantillas-whatsapp-meta*

### Plantillas de Meta vía Chatwoot: tres errores que se confunden entre sí

- Para variables nombradas hay que mandar SÍ O SÍ `parameter_format:'NAMED'`, y
  `example.body_text_named_params` necesita un item por cada **APARICIÓN** de `{{}}` en el
  cuerpo, no uno por variable única — si no, Meta rechaza con «parámetros incorrectos, deben ser
  {{1}}, {{2}}» o «BODY missing example».
- Una plantilla recién creada por la Graph API falla al enviarse con **error 132000** porque
  Chatwoot arma mal los params de las plantillas que no conoce: hay que forzar
  `POST /inboxes/{id}/sync_templates` (~4s).
- El **error 131049** es OTRA cosa y no se arregla tocando el formato: es el límite de ENTREGA
  de Meta por frecuencia de marketing al mismo usuario.

Formato que funciona al enviar: `processed_params:{body:{<param>:valor}}`.

**Vive en:** lib/meta-templates.ts · lib/chatwoot.ts (ensureTemplateSynced, getWabaConfig) ·
*2026-08-07 contexto-mako-md*

### «Meta respondió 200» no es «Meta te dio el id»

`submitTemplate` devolvía `{ok:true, metaId: j.id}` sin verificar que `j.id` existiera. Si Meta
contestaba ok pero sin id, el borrador se guardaba con `meta_template_id: null` y quedaba en
`pending` para siempre: `reconcileDrafts` solo podía matchear por `name::language`, un match
frágil de por vida (y si la plantilla todavía no se refleja en la lista de Meta, nunca se
actualiza).

**Regla:** tras el chequeo de `res.ok`/`j.error`, validar explícitamente el campo que necesitás
para reconciliar y fallar ahí — un id ausente cuesta más que un error.

**Vive en:** lib/meta-templates.ts (submitTemplate + enviarBorradorAMeta + reconcileDrafts) ·
*2026-06-24 ~review-plantillas-whatsapp-meta*

### Un `.catch(() => [])` atrapa el error pero no la lentitud

El GET de plantillas hacía `Promise.all` con `listMetaTemplates().catch(() => [])` y eso daba
sensación de estar cubierto. No lo estaba: los `fetch` a Graph no tenían `AbortController` ni
timeout, así que si Meta tardaba 25s el `Promise.all` esperaba igual y el usuario veía **carga
infinita** — el catch nunca se dispara por lentitud.

**Regla:** degradar con `.catch` solo tapa la mitad; toda llamada a un tercero en el camino de
una pantalla necesita además un timeout explícito (~8s). No hace falta cola ni retry: timeout +
el catch existente alcanza.

**Vive en:** lib/meta-templates.ts (fetch de submitTemplate/listMetaTemplates) +
app/api/whatsapp/templates/drafts/route.ts · *2026-06-24 ~review-plantillas-whatsapp-meta*

### Minúsculas en el código y la base; UPPERCASE solo en el payload que sale a Meta

`listMetaTemplates` normalizaba `category` y `status` a UPPERCASE, pero el tipo y el check de
`whatsapp_template_drafts` usan minúsculas: reusar una `MetaTemplate` para crear o actualizar un
draft rompía el upsert. En la UI funcionaba de casualidad porque `statusChip` hacía
`.toLowerCase()` en cada uso, y `reconcileDrafts` lo bajaba otra vez — **dos normalizaciones
opuestas en el mismo camino**.

**Regla:** normalizá en el borde de ENTRADA a la convención interna (minúsculas) y aplicá el
`.toUpperCase()` solo en `buildGraphPayload`, que es el único lugar donde Meta lo pide.

**Vive en:** lib/meta-templates.ts (listMetaTemplates / buildGraphPayload / reconcileDrafts) ·
*2026-06-24 ~review-plantillas-whatsapp-meta*

### Los límites de WhatsApp son por PORTFOLIO, y el tope de 2 plantillas marketing por usuario/24h es cross-brand

Dos constantes externas que gobiernan el diseño de la nutrición y no dependen de nosotros:

1. Desde oct-2025 el tier de envío se aplica al **Business Portfolio**, no al número: sumar
   números oficiales al mismo Business Manager NO suma capacidad (heredan el mismo tier) y un
   solo número en quality RED congela la progresión de TODOS.
2. El tope de **2 plantillas MARKETING por usuario cada 24h** lo cuenta Meta sobre el usuario
   final sumando a TODAS las empresas: una cadencia de 3 toques marketing en un día no llega
   aunque tu cuenta esté verde, y no hay forma de esquivarlo con más números ni con otro BSP.
   UTILITY y AUTHENTICATION están exentas del cap.

**Consecuencia práctica:** la cadencia se reparte en días (que es lo que ya hace el seed), y si
hace falta densidad, es por utility legítima, no por volumen.

**Vive en:** lib/nutricion.ts (cadencia y guards) · docs/nutricion-templates.md · memoria
[[sistema-hibrido-comunicacion]] · *2026-06-22 research-whatsapp-antiban*

### Decisión: las plantillas son REFERENCIA para MaKo, no moldes fijos

Si fueran moldes, no tendría sentido usar IA: MaKo tiene que ser libre de modificarlas según el
caso (2026-07-14). Lo que sí es rígido son los bloqueantes de aprobación de arriba — la libertad
es de redacción, no de formato.

### Lo que sigue sin hacer

- **Ver el motivo por el que Meta rechazó una plantilla.** Lo pidió varias veces: la plantilla
  rechazada queda en modo editar/borrador sin mostrar la causa (2026-06-24).
- **Bloquear el envío hasta que se cumpla el límite de tiempo de Meta**, poder ver las plantillas
  **sin el formato de EDICIÓN** (con botón para editar arriba), y mostrar el preview con el
  nombre real en vez de `{{name}}` (2026-06-24).
- **Validador de plantillas en vivo**: referencia de Meta al costado con scroll hasta la regla,
  botón «Aplicar» por recomendación, X para cerrar/abrir las recomendaciones, y desplegable de
  variables más allá de `{{nombre}}` (`{{nombre_completo}}`, `{{apellido}}`) (2026-06-24).
- **Notificación con sonido diferente y pop-up global cuando Meta aprueba una plantilla**
  (2026-06-24).
- **Adjuntar multimedia en los templates de Meta.** Él mismo lo dejó en pausa: «Por ahora lo
  dejamos como idea» (2026-06-24).

---

## Nutrición y secuencias

### ⚠️ Un «fallo» que no avanza ni reagenda no es un fallo: es un bloqueo de cabecera

**Síntoma:** el motor deja de mandar y no hay ninguna señal. Dos casos del mismo defecto:

- **WhatsApp:** «lead sin teléfono» y «paso sin `template_wa`» se marcaban `fallo` sin
  `terminal`, y un fallo no terminal no avanza `paso_actual` ni toca `proximo_envio_at`. Como la
  ventana de trabajo es `limit(cupo*3)` (18 filas) ordenada por `proximo_envio_at` ASC, esas
  inscripciones conservan el timestamp más viejo y ocupan las primeras posiciones en TODAS las
  corridas: **con 18 leads sin teléfono en un workspace, la ventana queda 100% llena de fallos
  que ni siquiera consumen cupo** y no vuelve a salir un solo envío real. Además insertan una
  fila de `fallo` por corrida, para siempre.
- **Email:** un lead con `email_opt_out` o sin email se registraba como `estado='fallo'` y el
  manejo hacía `continue` sin avanzar ni cerrar la inscripción («se reintenta»). Como
  `leadTuvoEnvioReciente` solo cuenta `'enviado'`/`'simulado'`, esas filas no activaban el guard
  de 20h: cada corrida volvía a elegir al mismo lead e insertaba otra fila basura, sin tope y sin
  unique constraint que lo frenara.

**Regla:** distinguí fallo **transitorio** (red, 5xx del proveedor) de condición **terminal**
(opt-out, sin dato de contacto, sin plantilla). Lo terminal avanza el paso o cierra la
inscripción; solo lo transitorio reintenta — y todo estado de error de una cola tiene que
avanzar el paso o correr el `proximo_envio_at`. Si no hace ninguna de las dos, es un bloqueo de
cabecera.

**Vive en:** lib/nutricion.ts (procesarEnvios: fetch de vencidas + manejo de `'fallo'` vs
`'saltado'`; ya tiene backoff) · nutricion_envios · *2026-07-09 ~review-canal-email + 2026-06-30
~auditoria-email-marketing-resend*

### ⚠️ Los `[tu link …]` NUNCA se reemplazan, y tres comentarios del repo juran que sí

**Síntoma:** mensajes de nutrición que le llegan al lead diciendo literal «te dejo el video de
preparación: [tu link del video]».

**Causa real:** `aplicarVariables` (lib/template-vars.ts:41) solo sustituye `{{key}}`/`{key}`
contra las 4 claves de `VARIABLES_LEAD` — **no hay una sola línea en el repo que toque los
corchetes**. Peor: `RX_RELLENO` (lib/nutricion.ts:541) los excluye A PROPÓSITO del detector de
«copy sin terminar», así que el único control de calidad que existe los deja pasar; y el prompt
del generador (lib/nutricion-generator.ts:146) le ordena al modelo «DEJALOS TAL CUAL. El sistema
los reemplaza; si los tocás, se rompen».

**El diagnóstico obvio (el modelo escribió mal) es el equivocado:** el modelo obedeció una
promesa que el sistema nunca cumplió.

**Regla:** o se implementa el reemplazo (un catálogo de links del negocio, hoy inexistente) o se
sacan los `[tu link …]` de los prompts y del `RX_RELLENO`. Mientras tanto, cualquier paso que los
use sale roto al lead. El contra-ejemplo del mismo archivo muestra el otro extremo: un paso con
`[tu nombre]` SÍ matchea `RX_RELLENO` y entonces **nunca sale**, reagendándose +24h en cada
corrida sin que nadie se entere.

**Vive en:** lib/nutricion.ts:539-543 (RX_RELLENO) · lib/template-vars.ts:41 (aplicarVariables) ·
lib/nutricion-generator.ts:146 · lib/setting-simulador.ts:30 · *2026-08-02
~investigar-onboarding-chat-agent*

### ⚠️ `requiere: 'sin_respuesta'` está declarado, sembrado y pintado en la UI — y el motor no lo evalúa nunca

**Síntoma:** un paso que la pantalla promete como «Solo si el lead no respondió» sale igual
aunque el lead haya contestado. Toda la red de seguridad que se le atribuye («no mandes el
recordatorio si ya contestó») **no existe**.

**Causa real:** el valor existe en el tipo (`PasoSecuencia.requiere`, lib/nutricion.ts:59),
sobrevive al normalizador de `setSecuenciaPasos` (:252), lo usa una plantilla real
(lib/secuencias-audios.ts:114) y se pinta como etiqueta en el resumen del onboarding — pero el
loop de `procesarEnvios` solo tiene ramas para `'respondio'`, `'ya_contactado'` y
`'primer_contacto'`. `'sin_respuesta'` cae al camino normal. **La condición no falla: no
existe**, y el compilador no dice nada.

**Del mismo flujo, dos vecinos:** `pausarPorRespuesta` trata igual un «sí, confirmo» que un «no
puedo, cambiámelo» —pone la inscripción en `'respondio'`— y el destrabe posterior solo reactiva
secuencias que tengan un paso con `requiere==='respondio'`, así que **el lead que confirma queda
en un callejón sin salida**; y como las secuencias de `armarSecuenciasDeAudios` nacen con
`estrategia` NULL, `asistirRespuesta` retorna en silencio: ni aviso al dueño ni borrador.

**Regla:** un valor nuevo de `requiere` toca TRES lugares (tipo + normalizador + rama del loop del
motor). Antes de agregar un condicional nuevo, buscá el `if (paso.requiere === …)` del loop y
confirmá que el valor esté ahí.

**Vive en:** lib/nutricion.ts:59 (tipo), :944-965 (el loop de procesarEnvios), :1249
(pausarPorRespuesta), :1305 (asistirRespuesta) · lib/secuencias-audios.ts:114 ·
app/api/chat-agent/onboarding/resumen/route.ts:67 · *2026-08-02
~investigar-onboarding-chat-agent + 2026-08-05 ~verificar-commits-contra-el-board*

### ⚠️ El audio copiado del dueño se degrada a un WhatsApp VACÍO, y el comentario que lo justifica miente

**Síntoma:** sale un WhatsApp en blanco, se marca `'enviado'` y la cadencia avanza como si todo
hubiera salido bien; si el lead es caliente, deja un **borrador en blanco** para el setter.

**Causa real:** `remapearJson` cierra con `?? null`, así que un `audio_id` que no se pudo
remapear queda en null. El comentario del archivo afirma que «en el mejor caso el motor falla
("el audio del paso ya no existe") y reintenta para siempre». **Falso:** el motor decide con
`const esAudio = paso.tipo === 'audio' && Number(paso.audio_id) > 0`, y `Number(null) === 0`, así
que nunca entra a la rama de audio ni a ese error. El paso cae a la rama de texto y sale con
`paso.cuerpo`, que en las secuencias del Chat Agent es el PIE — y en post-agenda es literalmente
`''`.

Es exactamente lo que el propio motor declara que no quiere hacer («no degradamos a texto en
silencio»).

**Vive en:** lib/datos-mau.ts:489 y :77-81 · lib/nutricion.ts:1031-1090 ·
lib/setting-secuencias.ts:183 · *2026-08-02 ~ensayo-chat-agent-y-datos-mau*

### ⚠️ `esLeadCliente` llama «cliente» a un `'ganado'` que todavía no pagó

**Causa real:** `estado_lead === 'ganado' || !!fecha_primer_pago`, con un docstring que dice
«pagó». El propio motor demuestra que `'ganado'` no implica pago: la cohorte
`confirmado_sin_pago` selecciona justamente leads con `estado_lead IN ('abierto','ganado')` y
`fecha_primer_pago IS NULL`.

**Consecuencia:** en la rama no_oficial eso manda al lead por `enviarYEspejar` (automático
directo) en vez de `crearBorrador`, violando la regla dura «automático directo SOLO a clientes
que ya pagaron» — y sobre el lead recién confirmado, que es exactamente el caliente que la cola
de borradores existe para proteger del riesgo de ban. **Es el único hueco por donde un no-pagador
recibe auto-send.**

**Vive en:** lib/evolution-envio.ts:17-22 · lib/nutricion.ts:309-320 y :631-648 · *2026-07-09
~auditoria-envio-evolution-nutricion*

### ⚠️ `enviarBorrador` es check-then-act: dos setters mandan el mismo WhatsApp dos veces

**Causa real:** SELECT del estado → guard `estado !== 'pendiente'` → enviar → marcar
`'enviado'`. La ventana entre el read y el write es de **segundos** porque `enviarTexto` bloquea
el HTTP durante todo el delay anti-ban (`min(1500+len*45, 9000)*1.2` ≈ hasta 10,8 s), así que dos
setters sobre la cola compartida (o un doble clic con latencia) pasan los dos el guard y el lead
recibe el mensaje duplicado por el número no oficial — exactamente el patrón de spam que la
feature existe para evitar.

El espejo no lo tapa: cada envío devuelve un `wa_message_id` distinto, así que entran dos filas y
salen dos WhatsApp. El guard `borrBusy` de la UI protege un solo navegador, no la cola.

**Arreglo:** claim atómico
(`UPDATE ... SET estado='enviando' WHERE id=? AND estado='pendiente' RETURNING ...`).

**Vive en:** lib/evolution-envio.ts:106-117 · *2026-07-09 ~auditoria-envio-evolution-nutricion*

### El borrador avanza el paso igual, así que se apilan y descartarlo pierde el toque

Crear un borrador no es `'fallo'`, así que la inscripción avanza `paso_actual` y agenda el
siguiente en cadencia, sin importar si el setter lo mandó. Dos consecuencias sin mitigar:

1. Cada paso posterior tiene un `paso` distinto, así que el índice único
   `(workspace_id, inscripcion_id, paso)` **no dedupea** y se acumulan N borradores pendientes
   del mismo lead caliente — y `leadsConEnvioReciente` solo cuenta estados
   `'enviado'`/`'simulado'`, o sea que un borrador no frena nada: el setter puede dispararlos
   todos en ráfaga, que es el patrón de ban que la feature evita.
2. `descartarBorrador` solo pone `estado='descartado'` y nunca toca la inscripción, que ya
   avanzó: **el toque se pierde sin reintento**.

Aparte: el guard anti-ban de 20 h se evalúa ANTES de ramificar por proveedor, así que difiere
hasta 20 h la CREACIÓN de un borrador que no manda nada.

**Vive en:** lib/nutricion.ts:610-613, :644-648 y :746-755 · lib/evolution-envio.ts:119-122 ·
*2026-07-09 ~auditoria-envio-evolution-nutricion*

### En la rama oficial `paso.cuerpo` es el espejo del inbox, NO el mensaje; y `template_param` es campo muerto

Dos trampas del mismo envío, las dos vivas el 7/8/2026:

1. La rama oficial pasa `content: paso.cuerpo` **crudo** (sin `aplicarVariables`): ese texto es
   solo lo que Chatwoot muestra en el hilo. Lo que el lead recibe es la plantilla aprobada en
   Meta rellenada con `bodyParams`. Si el cuerpo del paso diverge del texto aprobado, **el inbox
   miente sobre lo que se mandó**. Contrasta con la rama no_oficial, que sí hace
   `aplicarVariables` porque ahí el cuerpo SÍ es el mensaje.
2. `template_param` se persiste (default `'nombre'` en `setSecuenciaPasos`) y se edita en la UI
   del editor de secuencias, pero `procesarEnvios` lo ignora por completo: siempre manda TODAS
   las variables del catálogo vía `valoresVariablesLead`. **Es configuración que el usuario toca
   y no hace nada.**

**Vive en:** lib/nutricion.ts:1129 (content crudo) vs :1158 (aplicarVariables en no_oficial) ·
lib/nutricion.ts:78 y :264 (template_param) · lib/template-vars.ts:26 · *2026-07-09
f33-understand*

### «Viene de un formulario» no es excusa cuando no hay formulario

**Causa real:** `lib/nutricion-desenlace.ts` movía leads con `setPipelineStage` **sin validar**
los requisitos de la etapa. La justificación general —los callers que vienen de un formulario ya
validaron con lo que la persona acaba de tipear— no aplica: acá es el **cron** del desenlace, y
`logradoEtapa`/`falloEtapa` son **configurables por workspace**. Un cliente que apunte
`logradoEtapa: 'ganado'` escribe la etapa de venta sin monto. Agravante: el `catch` era un
`console.error`, así que el movimiento fallido no dejaba rastro ni en `lead_audit` ni en la
respuesta.

**Regla:** un caller automático que escribe una etapa **que configura el cliente** valida
siempre. Hoy no rechaza nada porque esas etapas no tienen requisitos; la validación es la
garantía para el día que un funnel de cliente se los ponga. Los dos call-sites usan
`moverLeadAuto()` (lib/leads.ts:1725), el mismo helper que el motor del CRM: valida, y si falta
algo no mueve y escribe el porqué en el historial.

**Vive en:** lib/nutricion-desenlace.ts · lib/leads.ts:1725 (moverLeadAuto) · *corrida 08/2026*

### Decisión: las secuencias terminan por OBJETIVO y hacen hand-off a la siguiente

Cada secuencia se cierra cuando se cumple su objetivo —positivo o negativo— y encadena a la que
sigue, teniendo en cuenta cuándo fue el último mensaje. Sin objetivo, el ensayo con MaKo no corta
nunca: «MaKo pareciera un eterno objetor... eso no es el comportamiento normal de un lead». Al
cerrar tiene que felicitar al usuario, «para que sea dopamínico» (2026-08-05).

### Decisión: primero WhatsApp, el email después; la reactivación va por goteo

La reactivación de leads viejos se hace **por goteo**, con tope de X mensajes cada X horas, para
evitar baneos de WhatsApp; pidió explícitamente investigar buenas prácticas anti-ban (2026-06-22).
Los guards de `HS_MIN_ENTRE_MSGS` y `MAX_POR_CORRIDA` son la expresión de esta decisión, no un
detalle de implementación.

### Decisión: se llama «Nueva Secuencia de Mensajes», nunca «Jugada»

«no lo llames nunca más en ningún lado "Jugada"» (2026-08-02). El modal de creación es idéntico
en tamaño y diseño al del onboarding (barra negra al costado).

### Decisión: solo se ven las secuencias que armó el usuario, y MaKo avisa los huecos del funnel

Al entrar a la vista de secuencias no se muestran ejemplos: las de muestra se borran. En cambio,
MaKo avisa cuando hay un estado de nutrición del funnel **sin secuencia asociada** — «MaKo sabe
todos los pasos de tu funnel... y sabe que no existe una secuencia armada cuando existe ese
status de nutrición» (2026-08-02).

### Lo que sigue sin hacer

- **Un paso de un canal apagado se marca `'omitido'` y AVANZA — y la inscripción es
  una-vez-en-la-vida.** Cuando un workspace tiene un canal prendido y el paso es del canal
  apagado, `procesarEnvios` marca `'omitido'` y avanza la cadencia sin enviar. Y
  `comprometerInscripciones` dedupea por (lead, secuencia) con un unique de la migración 0034: el
  lead **no se puede reinscribir nunca**, así que el paso queda QUEMADO — prender el canal después
  no lo re-manda. Hoy no hay daño heredado (0 filas en `nutricion_inscripciones` y
  `nutricion_envios`, el motor nunca comprometió nada), así que **ésta es la ventana para decidir
  la semántica antes del go-live**: re-mandar, no-avanzar (como ya hace la rama de borrador
  pendiente) o aceptar el quemado. Nota del mismo audit: `'saltado'` en nutrición es solo detalle
  en memoria (hace `continue` sin insertar fila) pero SÍ persiste como fila en
  `email_broadcast_envios` — «por qué no salió este mensaje» se responde en fuentes distintas
  según el canal.
  **Vive en:** lib/nutricion.ts:396, :530 y :607-631 · supabase/migrations/0034_nutricion.sql ·
  lib/envio-flags.ts · *2026-07-31 ~mapa-envio-flags-nutricion-crm-auto*
- **Lo acordado para la prospección no entra en el motor: tres bloqueos concretos.** De la reunión
  salió que el primer toque post-agenda es un AUDIO del dueño y que el lead magnet se manda como
  archivo. El motor no puede ninguna de las dos: `PasoSecuencia` solo tiene `cuerpo` de texto
  (aunque `lib/evolution-envio.ts` ya sabe mandar notas de voz), y la jugada guarda
  `lead_magnet_id` apuntando a un Entregable que el motor no sabe entregar. El tercer bloqueo es
  el guard anti-ban `HS_MIN_ENTRE_MSGS = 20`: la secuencia acordada exige varios toques cercanos
  (audio + conversación + pedido de ver el video) y con la reunión en 48h el candado de 20 horas
  mata la preparación — hay que **separar el presupuesto anti-ban de la prospección fría del de
  una conversación ya abierta**. Además el enrolamiento es por cron con ventanas amplias y tope
  `MAX_POR_CORRIDA=6`, contra la regla explícita de que el contacto al que llenó el formulario de
  Meta salga **casi inmediato**.
  **Vive en:** lib/nutricion.ts (PasoSecuencia, HS_MIN_ENTRE_MSGS, MAX_POR_CORRIDA) ·
  lib/setting-estrategia.ts (lead_magnet_id) · lib/evolution-envio.ts · *2026-08-01
  ~extraccion-reunion-mau-mensajes*
- **Rehacer el editor de flujos de nutrición:** volver al dibujo que había antes (triggers tal
  cual, el mensaje dentro de su paso, lápiz de editar por paso y «nuevo paso» abajo de todo).
  Quedó frenado en «vuelve a como estaba al comienzo» (2026-07-15).
- **Cargar en «Datos de Mauricio» lo hecho con las secuencias de su cuenta**, para replicar el
  onboarding en el cliente de prueba (2026-08-03).

---

## Email (Resend)

### ⚠️ El generador de emails escribe para el negocio de Mauricio, no para el del cliente

**Síntoma:** cualquier cliente que toque «generar email» en `/email` recibe copy de OTRO negocio,
con el link de agenda de otro y en voseo aunque su audiencia sea mexicana.

**Causa real:** el SYSTEM de `/api/email/generar` arranca literal con «Sos MaKo escribiendo EMAIL
MARKETING para Mauricio Bustos (consultor: Negocio que Escala™)» y más abajo ordena usar
`https://calendly.com/mauriciobustoseguia/60min` como link de agenda. No lee el perfil del
workspace ni la guía de voz destilada: solo pasa por `brandSystem()`.

**Verificado el 2026-08-07 y de nuevo el 2026-08-10: sigue vivo, hardcodeado en
`app/api/email/generar/route.ts:18` y `:23`.** Y hay que arreglarlo **antes** de multi-producto,
no después: cuando la oferta pase a salir del catálogo, esta ruta va a seguir escribiendo la de
Mauricio y va a parecer que el catálogo no funciona. El molde correcto
está en el mismo dominio: `lib/nutricion-generator.ts` sí inyecta perfil + funnel + guía de voz +
estrategia.

**Vive en:** app/api/email/generar/route.ts (líneas 18 y 23) · molde correcto en
lib/nutricion-generator.ts:265-283 · *2026-08-07 ideas-content-machine*

### ⚠️ Los emails «se enviaban» y no llegaban a nadie durante 13 días

**Síntoma:** ningún error de configuración, ningún log: solo emails que no llegan. Quedó así 13
días sin que nadie lo notara.

**Causa real:** sin el setting `resend_from`, sin la credencial `RESEND_FROM` y sin env,
`getEmailFrom()` cae a un SANDBOX_FROM hardcodeado (`onboarding@resend.dev`) que Resend entrega
**solo a la casilla del dueño de la cuenta**.

**Regla:** ante cualquier «no sale el mail», lo primero es
`select value from app_settings where key='resend_from'`, antes de tocar dominios o DNS.
Relacionado: la `RESEND_API_KEY` de producción es «sending only» **a propósito**, así que
`GET /domains` y `/api-keys` devuelven 401 — el mini-onboarding de dominio de la tab `/email` no
puede funcionar con ella.

**Vive en:** lib/resend.ts (getEmailFrom, createResendDomain) · app/email → DominioSetup ·
*2026-08-07 contexto-mako-md*

### ⚠️ Con el envío en simulado, el tracking de email se pierde para siempre

**Causa real:** con el envío real apagado o el remitente en sandbox, `procesarEnvios` registra la
fila como `'simulado'` **sin `proveedor_id`** — y el webhook de Resend matchea justamente por ese
id, así que `abierto_at`/`clic_at` de esas filas quedan vacíos y **no hay backfill posible
después**. Encima algunos KPIs cuentan `'simulado'` como enviado, así que la tasa de apertura sale
artificialmente en 0.

**Dos vecinos del mismo insert:** `nutricion_envios.error` no se escribe nunca (el insert omite la
columna que la migración 0034 previó, así que el motivo del fallo se pierde), y el secreto del
link de baja cae a `SUPABASE_SERVICE_ROLE_KEY` si no hay `UNSUBSCRIBE_SECRET` — **el día que esa
key rote, todos los links de baja ya enviados dejan de validar**.

**Vive en:** lib/nutricion.ts:642 (procesarEnvios) · lib/email-marketing.ts ·
app/api/email/unsubscribe · *2026-07-02 audit-automatizaciones-lead (+ 2026-07-19)*

### ⚠️ Las stats por paso se alinean por POSICIÓN, no por identidad estable

**Síntoma:** reordenar los pasos de una secuencia en `/email` reasigna el histórico al paso
equivocado.

**Fix propuesto:** `paso_id` estable en el JSON del paso y columna nueva
`nutricion_envios.paso_id`.

**Vive en:** lib/email-marketing.ts (getEmailSecuencias) · lib/nutricion.ts (procesarEnvios) ·
*2026-06-30*

### Dos contadores del mismo segmento que no cuentan lo mismo

**Síntoma:** la UI mostraba «N destinatarios» y el envío resolvía 0 — y el broadcast quedaba
bloqueado **para siempre** mostrando «Listo: 0 enviados (de 0)» como éxito.

**Causa real:** `contarSegmento` contaba todos los ids del segmento y `leadsDeSegmento` filtraba
además por `!!l.email`. Como `enviarBroadcast` marcaba `estado='enviado'` de forma incondicional
(con `total_destinatarios: 0`) y el guard de re-entrada es `if (b.estado === 'enviado') return
error`, el estado terminal se consumía con un envío vacío.

**Regla:** el contador que ve el usuario y la lista que se envía salen de la MISMA función; y solo
se marca `'enviado'` cuando `total_destinatarios > 0`.

**Vive en:** lib/email-marketing.ts (contarSegmento / leadsDeSegmento / enviarBroadcast) ·
*2026-06-30 ~auditoria-email-marketing-resend*

### El guard anti-doble-contacto vivía en una tabla y los broadcasts escribían en otra

**Síntoma:** un lead en una secuencia activa que además caía en el segmento de un broadcast podía
recibir 2-3 correos en la misma hora.

**Causa real:** `leadTuvoEnvioReciente` consultaba solo `nutricion_envios`, y `enviarBroadcast`
escribía en `email_broadcast_envios` sin consultar ningún guard. El hueco era bidireccional. **Lo
peor era el comentario de la migración 0046**, que afirmaba que broadcasts y secuencias «comparten
el guard de 20h»: documentación que sobre-promete y hace que nadie vuelva a mirar.

**Regla:** un guard por-lead tiene que consultar TODAS las tablas donde se registra un contacto con
ese lead; si agregás una tabla de envíos nueva, sumala al guard **en el mismo commit**.

**Vive en:** lib/nutricion.ts (leadTuvoEnvioReciente) + lib/email-marketing.ts (enviarBroadcast,
mig 0046) · *2026-06-30 ~auditoria-email-marketing-resend*

### Matchear el texto del error de un proveedor es matchear algo que el proveedor nunca prometió

`createResendDomain` era «idempotente»: ante un fallo del POST buscaba el dominio por nombre solo
si el mensaje matcheaba `/already exists|ya existe/i`. Resend responde «The `x.com` domain has been
registered already» —**«registered», no «exists»**— y encima no localiza sus errores, así que la
rama «ya existe» jamás matcheaba: el flujo de reconectar (desconectar deja el dominio vivo en la
cuenta) devolvía 502 y el usuario quedaba trabado sin poder recuperar su propio dominio.

**Regla:** discriminá por status o por el campo `name` del error, o directamente hacé el
list-lookup ante cualquier 4xx; el `message` es copy del proveedor, no un contrato.

**Vive en:** lib/resend.ts:303-305 (ya reescrito: 4xx → buscar por nombre) · *2026-07-09
~review-canal-email*

### Decisión: la interfaz de Email se copia de un clon de Gmail, no de WhatsApp

«Lo que no quiero es que se parezca a WhatsApp cuando estamos enviando un email, eso haría todo muy
confuso» (2026-08-06). En la misma línea: antes de construir de cero, buscar un proyecto open
source que ya lo tenga y copiarle diseño y features («podemos COPIAR codigo de proyectos open
source como este: https://github.com/TryGhost/Ghost», 2026-08-06).

### ⚠️ Dar de alta a alguien creaba su cuenta y NO le avisaba: la app no mandaba un solo mail de acceso

**Síntoma:** un cliente nuevo (o el closer que suma el cliente desde `/equipo`) nunca se entera de
que tiene cuenta. No hay error, no hay log, no hay pantalla rota: la persona simplemente no existe
para sí misma hasta que alguien se acuerda de escribirle por WhatsApp.

**Causa real:** los TRES puntos que crean personas —`app/api/admin/workspaces/route.ts` (cliente
nuevo), `app/api/admin/usuarios/route.ts` (usuario suelto) y `app/api/equipo/route.ts`— llamaban a
`crearUsuario()` y ahí terminaban. La fila en `usuarios` **es** la invitación (el callback de Google
la busca por email y la pasa de `invitado` a `activo` sola), así que el sistema funcionaba
exactamente como estaba escrito. Lo que faltaba era el mensaje.

**Y la pantalla afirmaba que sí se había avisado.** `/admin` decía, en verde: *«Cliente creado.
Cuando su admin entre con Google usando ese email, la cuenta se activa sola»*. Cada palabra es
cierta y el mensaje entero es falso — da por hecho que el cliente va a entrar por su cuenta a una
URL que nadie le pasó. Es la forma de mentira más cara que hay y ya está tipificada en AGENTS.md:
**afirmar la mitad verdadera de un proceso de dos pasos**. Peor en `/equipo`, donde la acción del
API se llama literalmente `'invitar'` y el botón dice «Invitar»: el nombre prometía lo que el
código no hacía, así que el cliente no tenía *cómo* saber que faltaba avisarle.

**El indicador tampoco lo distinguía.** El chip decía «invitado — nunca entró», que es verdad y no
sirve para actuar: no separa «le llegó el mail y no entró» de «nunca supo que existía la cuenta», y
son dos problemas con dos arreglos distintos (a uno se le reenvía, al otro se lo llama). Por eso el
fix trae columna propia (`invitacion_enviada_at`, mig 0138) y no se deduce del estado.

**Vive en:** lib/invitaciones.ts (el envío) · lib/invitacion-aviso.ts (el texto en pantalla, **sin
`server-only`** para que lo importen las pantallas y los tests) · los 3 call-sites de arriba ·
tests/invitaciones.test.ts

### ⚠️ `OWNER_WS` para un mail de la PLATAFORMA: el remitente salía de la config de un cliente

La trampa más cara de esta corrida, y **no daba ningún síntoma porque funciona de casualidad**.

Un mail que manda MaKo (no un cliente) necesita contexto de workspace para resolver la key y el
remitente, y el reflejo es `runWithWorkspace(OWNER_WS, …)`. Pero **`OWNER_WS` vale 1 y el 1 es
Mauricio, un CLIENTE** — `lib/workspace.ts:288` ya lo advierte, y el nombre igual engaña. Medido
contra la base: el único `resend_from` configurado en TODO el sistema es el de ws1, y hoy dice
`MaKo <equipo@hola-mako.com>`. O sea que salía bien por coincidencia.

Lo que se rompe después, sin avisar:

- El día que ese cliente cambie su remitente a su propio negocio, **todos los clientes nuevos de
  MaKo reciben su acceso firmado por otro cliente**. Sale un mail válido, con un remitente válido.
- Si carga su propia `RESEND_API_KEY` (`resendKey()` prefiere la credencial del ws sobre el env),
  los mails de la plataforma salen por **su** cuenta de Resend.

**La regla:** la identidad de la plataforma vive en el código, no en un `app_settings` de un
inquilino — es «una cosa, un lugar» aplicada a quién firma. En concreto: constante
`REMITENTE_MAKO` (overridable por `MAKO_EMAIL_FROM`), `from` **explícito** en `sendEmail` (sin él
resuelve el del workspace en curso), el preflight de sandbox mirando **esa** constante y no
`remitenteEsSandbox()` —que contesta por el workspace actual, o sea por otra cosa—, y el envío
corriendo en `wsSuperAdmin()`, que no tiene credencial propia y por eso cae en la key del env.

**El olfato que sirve para la próxima:** cuando algo de la plataforma pida un workspace, preguntá
*de quién es ese workspace*, no si el código compila. Y si el sistema tiene UN solo valor
configurado, no se puede saber si lo estás leyendo del lugar correcto — probalo mentalmente con dos.

**Vive en:** lib/app-url.ts (`EMAIL_MAKO`) · lib/invitaciones.ts (`REMITENTE_MAKO`) ·
lib/resend.ts:34-48 (`resendKey` / `getEmailFrom`) · lib/workspace.ts:285-295
(`wsSuperAdmin`, resuelto por capa y no por número)

### ⚠️ Tener MX NO prueba que la casilla exista — y ese es el diagnóstico obvio y equivocado

El mail de acceso termina con «si algo no funciona, escríbenos a `equipo@hola-mako.com`». Eso
es una promesa: alguien lee esa casilla. Y **mandar y recibir no tienen nada que ver entre sí**:

- **Mandar** lo hace Resend, con DKIM/SPF sobre el subdominio `send.hola-mako.com`. Funciona:
  se mandó un mail real el 16/08 y Resend lo aceptó.
- **Recibir** depende de los **MX del apex**, que son de otro proveedor:
  `hola-mako.com MX → fwd1.porkbun.com / fwd2.porkbun.com`. Eso es **reenvío**, que entrega
  **alias por alias** y solo para los que estén dados de alta **a mano en el panel**. Un alias
  que no existe se descarta, y el dominio sigue mandando perfecto.

**Y acá está la parte que ahorra el tiempo:** mirar el MX y concluir «entonces recibe» es
exactamente el error, porque **el MX ya estaba el 2026-08-05** —la tabla de la mudanza lo
registra como *«MX/SPF de mail forwarding: intactos, no los toqué»*— y **al día siguiente**, con
ese mismo MX en su lugar, la sesión escribió textual:

> *«Lo que sí falta es recibir. Si alguien responde uno de esos mails hoy, escribe a un buzón
> que no existe. Eso son reglas de reenvío en Porkbun, y la API no las expone (404 en las tres
> variantes) — es panel.»*

O sea: el MX presente y el buzón inexistente **convivieron el mismo día**. Y como la API de
Porkbun no expone las reglas de reenvío, **no hay forma de verificar esto desde el código**: se
mira en el panel, o se manda un mail a la casilla y se ve si aparece. Nada escrito después dice
que el alias se haya creado.

⚠️ El repo tampoco es una segunda red: **no existe ninguna ruta de correo entrante**. El webhook
`app/api/webhooks/resend/route.ts` es de EVENTOS (aperturas, clics, rebotes, quejas — firma
Svix), no de correo recibido; confundirlos es fácil y lleva a creer que la app ve algo. Todo lo
que entre a `equipo@` vive o muere en el reenvío de Porkbun, afuera del producto.

Y ya hubo deriva de la dirección: durante la mudanza el remitente fue `hola@hola-mako.com` y
hoy el configurado es `equipo@`. Con la dirección escrita en cada archivo que la necesita, la
mitad se queda en la vieja — por eso `EMAIL_MAKO` vive en `lib/app-url.ts`, al lado de
`APP_BASE_URL`: las dos contestan «¿por dónde nos encuentra alguien de afuera?» y las dos se
mudan juntas. El punto 8 del checklist de mudanza de ese archivo es nuevo por esto.

**La regla:** antes de poner una dirección en un lugar donde le pedís a un cliente que
escriba, mandale un mail y verificá que llegue. Un buzón que no existe se ve exactamente
igual que uno que nadie contestó todavía.

**Vive en:** lib/app-url.ts (`EMAIL_MAKO` + el checklist de mudanza) · lib/invitaciones.ts

### Lo que sigue sin hacer

- **`equipo@hola-mako.com` probablemente NO recibe todavía**, y eso es más fuerte que «sin
  verificar»: el 2026-08-06 quedó escrito que quien respondiera escribía a un buzón inexistente,
  y nada posterior dice que el alias se haya creado (ver la entrada de arriba). Se arregla en el
  panel de Porkbun —la API no lo expone— y se comprueba mandando un mail a esa casilla. **Hasta
  entonces, la última línea del mail de acceso y los dos textos de `/configuraciones` y
  `/email` mandan a la gente a una dirección que puede no existir.**
- **`app/api/email/unsubscribe/route.ts:40` dice «escribinos» y NO se tocó, a propósito.** Esa
  página la ve el LEAD de un cliente, no un usuario de MaKo: poner ahí nuestra dirección
  mandaría los leads de otro negocio a nuestra casilla. Lo que le falta es el contacto **del
  cliente**, que es otra tarea.
- **`MAKO_EMAIL` no está en Vercel.** Hoy no hace falta —`lib/app-url.ts` trae el default correcto
  en código— pero mientras no exista, cambiar la dirección de la plataforma es un deploy.
- **Nada reencola un mail que falló.** Si Resend rechaza, queda el botón «Reenviar acceso» y una
  persona que se acuerde. No hay cola ni reintento.
- **Bandeja tipo Gmail dentro de MaKo:** recibir todos los mails ahí, escribir, y elegir con qué
  email se envía — en lugar de crear una casilla nueva (2026-08-06).
- **Definir a qué email van las notificaciones.** No quiere que lleguen a su correo personal y
  preguntó si abrir uno nuevo. **Quedó sin respuesta** (2026-08-06).

*Alta → mail de acceso, 16/08/2026. Typecheck 0 errores, 1004/1004 tests, mig 0138 aplicada.*

---

## Avisos y reportes

### ⚠️ El interruptor no era el problema: el aviso del cliente se va al grupo de la AGENCIA

**Síntoma:** el cliente apaga un aviso en `/configuraciones` y el aviso sale igual.

**Causa real:** el diagnóstico obvio («el gate lee las prefs del workspace equivocado») lo refutó
un verificador: el gate lee el mismo ws al que se ENTREGA, así que respecto del destinatario está
bien. La causa es de **ruteo**: `const ws = a.ws ?? OWNER_WS` ignora el contexto ambiente, y **8
emisores** corren dentro de `runWithWorkspace(wsDelCliente)` sin pasar `ws` (webhooks de
chatwoot/meta-leads/calendly/fathom, retro-pipeline, todo-seeds, ads-manager/ad-aprobacion) — el
WhatsApp del cliente termina en el grupo del dueño, y de yapa su interruptor queda decorativo.

**Ojo con el mecanismo:** `avisoWaActivo` hace `runWithWorkspace(1, …)`, que **pisa** el
AsyncLocalStorage del webhook.

**Regla:** se arregla en el choke point (`a.ws ?? (await getWorkspaceActual()) ?? OWNER_WS`), no en
los 8 call-sites.

**Vive en:** lib/avisos.ts:71 y :89 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

### ⚠️ Apagar un aviso envenena su dedup: al volver a prenderlo sigue mudo hasta 3 días

La rama de «apagado» llama igual a `marcarAvisado(ws, tipo)`, así que la marca
`mako.aviso.last.<tipo>` se refresca **durante el silencio**. Al reprender el interruptor,
`avisadoReciente()` encuentra una marca fresca escrita mientras nadie recibía nada y devuelve
`deduped:true` sin enviar — con `tracking-apagado` (TTL 3 días) el primer WhatsApp llega hasta 3
días después.

**Regla:** un gate que corta un envío no debe tocar el estado de dedup de ese envío; si querés
conservar el anti-spam del feed, usá una key aparte (`${tipo}#mute`).

**Vive en:** lib/avisos.ts:89-92 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

### ⚠️ Las plantillas de avisos son GLOBALES aunque la UI las muestre por workspace: si un cliente apaga un aviso, lo apaga para todos

**Síntoma:** un aviso deja de llegarle a un cliente sin ningún error — `emitirDelCatalogo` devuelve
`{ ok: true, deduped: true }`, o sea **éxito**.

**Causa real:** el store de plantillas vive en `app_settings` bajo `mako.plantillas.store` y se lee
y se escribe SIEMPRE dentro de `runWithWorkspace(OWNER_WS, …)`, así que el texto de cada plantilla
y su on/off no son por inquilino: son uno solo para toda la instalación. `emitirDelCatalogo`
consulta `plantillaActiva(id)` antes de mandar y, si otro workspace la desactivó, se traga el aviso
con un ok. **Sigue vivo hoy** (verificado en lib/plantillas.ts:32 y :37, y lib/avisos.ts:157).

**Regla:** un store montado a mano sobre `OWNER_WS` es global aunque la pantalla que lo edita se vea
dentro de un workspace; antes de exponer un toggle por cliente, mirá con qué ws se resuelve el
`getSetting`. Y **nunca devuelvas `ok: true` para «apagado»** — apagado y enviado no son el mismo
resultado.

**Vive en:** lib/plantillas.ts:32,37 (store `mako.plantillas.store` en app_settings) ·
lib/avisos.ts:157 (emitirDelCatalogo) · *2026-08-02
~investigacion-rediseno-chat-agent-17-puntos*

### ⚠️ Los reportes salen por default y su email no mira el flag de envío

`DEFAULT_PREFS` trae horario/diario/semanal con `activo:true` (diario y semanal además con email),
así que **sin configurar nada los reportes SALEN**. Y `lib/notify.ts` importa `sendEmail` directo,
sin consultar `EMAIL_SEND_ENABLED` ni el setting por workspace: apagar el envío de email marketing
no apaga los reportes. Son dos canales distintos con la misma cañería, y el flag que todo el mundo
asume global cubre uno solo. Sigue vivo.

**Vive en:** lib/perfil.ts:125-130 (DEFAULT_PREFS) · lib/notify.ts:17,60 · *2026-07-09
~mapa-app-doer*

### ⚠️ Tres almacenes de teléfono que parecen uno solo, y cambiar el del grupo no cambia el de los reportes

- `mako.numero_dueno` (app_settings por workspace): crea y sincroniza el **grupo de MaKo**.
- `user_telefono` (app_settings por workspace): a dónde el **CRON manda los reportes**.
- `usuarios.perfil.telefono`: solo dato de perfil de la persona.

`setNumeroDuenoYSync` escribe el primero y **NO** el segundo, así que quien cambia su número desde
la card «Tu WhatsApp» sigue recibiendo la apertura diaria en el teléfono viejo. El falso positivo
más peligroso es el campo «Teléfono» de `/perfil`: parece lo mismo y no toca el grupo.

Hoy solo el wizard del onboarding los sincroniza juntos — y esa card es el **único** lugar donde un
usuario que ya terminó el onboarding puede cambiar el número (el wizard es inalcanzable con
`status:'done'`), así que borrarla deja al workspace sin grupo y todo aviso falla con un
`console.error`.

**Vive en:** lib/mako-grupo.ts:244 (setNumeroDuenoYSync) · lib/perfil.ts:122
(getContactoReportes) · app/api/cron/reporte-diario/route.ts:27 ·
app/perfil/NotificacionesPanel.tsx:96 · *2026-08-06 rediseno-notificaciones*

### ⚠️ Un aviso que pregunta algo que nadie escucha: el momento del disparo era el bug

**Síntoma:** el dueño mostró su WhatsApp con MaKo y señaló *«muchos están incompletos, como el
que te pregunta ¿Querés que te pase el resumen y las objeciones acá? y al final no hace nada»*.

**El diagnóstico obvio era el equivocado.** Parecía que faltaba cablear la respuesta —enseñarle
al doer a entender el «sí» y mandar el resumen—. No era eso: el aviso se emitía en el **instante
del webhook de Fathom**, y el Closing Analyst corre **después**, adentro del `after()`. En el
momento en que MaKo ofrecía «te paso el resumen y las objeciones», el resumen y las objeciones
**todavía no existían**. Cablear la respuesta habría hecho que contestar «sí» devolviera vacío.

**Regla:** un aviso que habla de un análisis se emite DESPUÉS del análisis, no en paralelo. Si el
trabajo pesado va en `after()`, el aviso va adentro del mismo `after()` — y se emite igual
aunque el análisis falle, con el texto adaptado a lo que de verdad haya. Un webhook que avisa
antes de trabajar solo puede prometer.

**Y el corolario que vale para todo el catálogo:** una pregunta por WhatsApp exige que exista un
receptor de la respuesta. Cuando no existe, **la salida es un LINK, no una pregunta**. Auditados
los 48 avisos contra sus call-sites, cuatro preguntaban al vacío (`reunion-ocurrio-fathom`,
`reunion-cancelada`, `lead-formulario-meta`, y `reunion-nuevo-agendado` que decía «la ficha ya
quedó armada en el CRM» sin dar el link a esa ficha).

**Vive en:** app/api/webhooks/fathom/route.ts (el `after()`) · lib/lead-resumen.ts
(`textoAvisoPostLlamada`) · *2026-08-11*

### ⚠️ El nombre de una columna `respuesta_*` no es su pregunta, y una de ellas se leía AL REVÉS

**Síntoma:** la vista nueva del lead mostraba «¿Cuánto factura al año? → Si».

**Causa real:** las columnas del formulario de Calendly se llaman por su TEMA, no por su
pregunta. `respuesta_facturacion` no guarda una facturación: guarda el Sí/No a *«este programa
está enfocado en negocios que facturan +$20M MXN al año, ¿es tu caso?»*.

**Lo caro es la otra.** `respuesta_decisor` guarda el Sí/No a *«¿alguien MÁS participa en la
decisión?»*. Rotularla «¿Decide solo?» **invierte el sentido**: un «No» —que significa que decide
él— se lee como que NO decide él. Eso no es un rótulo feo, es entrar a la llamada con la
estrategia dada vuelta, y el dato se ve idéntico de correcto.

**Regla:** antes de rotular una columna `respuesta_*`, leé qué frase la llena en
`extractRespuestaPorFrase` (el webhook de Calendly). Y ante un Sí/No, chequeá el SENTIDO de la
pregunta, no solo el tema: la mitad de estas están redactadas en negativo.

**Vive en:** lib/lead-resumen.ts (`PREGUNTAS`) · las frases, en
app/api/webhooks/calendly/route.ts:247-264 · *2026-08-11*

### ⚠️ Calendly SÍ reserva por API, pero la ubicación del event type la rechaza

Existe la **Scheduling API** (`POST https://api.calendly.com/invitees`) y **no hace falta una app
OAuth**: el personal access token que ya tenemos alcanza. Requiere plan pago. Verificado en vivo
contra la cuenta del dueño el 2026-08-11, sin crear ninguna reserva (un `start_time` que no es un
hueco abierto falla en validación).

El contrato, probado a mano:

| Qué | Cómo |
|---|---|
| Huecos | `GET /event_type_available_times?event_type=<uri>&start_time=&end_time=` — tope 31 días |
| Reservar | `POST /invitees` con `{event_type, start_time, invitee:{email,name,timezone}, event:{location_configuration:{kind}}}` |

**El bloqueo abierto:** los event types del dueño declaran `locations:[{kind:'zoom_conference'}]`
y la API rechaza ese kind —y los otros once que se probaron— con *«Specified location kind is not
configured for this event type»*. La causa más probable es la integración de Zoom desconectada o
sin re-autorizar del lado de Calendly; **se arregla en el panel de Calendly, no en el código**.
Por eso el error de Calendly sube TEXTUAL hasta el WhatsApp: un «no pude agendar» genérico manda
a buscar el problema al lugar equivocado.

**Dos trampas más, medidas:**
- `GET /invitees` devuelve **404**, no 405. Un 404 en esta API no prueba que la ruta no exista:
  para saberlo hay que pegarle con el método correcto y body vacío (devuelve 400 con los campos
  que faltan, que además es la forma más rápida de descubrir el schema).
- `start_time` no se redondea ni se aproxima. Tiene que ser **exactamente** uno de los
  `start_time` que devolvió el endpoint de huecos — que es justo el tipo de dato que un LLM no
  puede transportar. Por eso se revalida contra Calendly al proponer **y** al confirmar.

**Vive en:** lib/calendly-agenda.ts · *2026-08-11*

### Ojo: `CALENDLY_EVENT_TYPE_J1/J2` guardan el NOMBRE, no la URI — y está bien

El catálogo (`lib/metodo-catalogo.ts`) pide `https://api.calendly.com/event_types/…`, pero en
producción esas credenciales tienen el nombre del event type («Calificación para Programa
Directivo»). No es un bug: `clasificarJunta` compara contra `event_type`, `name` **y** `uri` con
un matcher tolerante (trim + lowercase + slug), así que el nombre matchea.

Lo que sí importa: **cualquier código nuevo que resuelva un event type tiene que usar ESE mismo
matcher** (`mismoEventType`, exportado de `lib/calendly.ts`), no comparar URIs. Si MaKo reservara
en un event type y el webhook clasificara la reunión resultante como la otra, el lead terminaría
con la R2 escrita en el campo de la R1. Verificado contra la cuenta real: R1 y R2 resuelven a un
único event type activo cada una.

**Vive en:** lib/calendly.ts (`mismoEventType`) · lib/calendly-agenda.ts
(`eventTypeDeReunion`) · *2026-08-11*

### El dedup de los avisos es por TIPO, no por entidad

`emitirAviso`/`emitirDelCatalogo` dedupean con una key `mako.aviso.last.<tipo>` por workspace. Si le
pasás `dedupTtlMin` a un **evento discreto** (un lead nuevo, un pago, un mensaje entrante), el
SEGUNDO lead dentro de la ventana se traga en silencio: nunca te enterás de que no avisó.

**Regla:** eventos discretos van SIN `dedupTtlMin` y se protegen con una guarda de transición
(estado previo ≠ nuevo); los agregados de cron (cobranza, salud de Meta) sí llevan dedup. Si
necesitás dedup por entidad, no uses el catálogo: llamá `emitirAviso` directo con un `tipo`
compuesto tipo `reunion-no-show:{leadId}:{j1|j2}`.

**Vive en:** lib/avisos.ts (emitirAviso, emitirDelCatalogo) · catálogo en lib/avisos-catalogo.ts ·
*2026-07-14 mako-cableado-avisos*

### El aviso paga la llamada al modelo ANTES de decidir si el aviso sale

En `emitirDelCatalogo` el texto se genera con IA (`generarMensajeAviso` → `chatClaude`, feature
`'avisos'`) en `lib/avisos.ts:158-159`, pero el dedup por `dedupTtlMin` y el interruptor
`avisoWaActivo` se evalúan **dentro de `emitirAviso`** (:86, :106). O sea: se paga Sonnet igual
cuando el aviso se dedupea o está apagado. Y 6 de los 13 call-sites viven en webhooks;
`wa-mensaje-entrante` dispara por CADA mensaje, así que con la ráfaga ya conocida de 16 mensajes en
4 segundos son **16 llamadas al modelo adentro de un handler de webhook**.

**Regla:** la redacción va después del gate, nunca antes, y los avisos de alto volumen se quedan con
texto fijo (`texto:`), no con `contexto:`.

**Vive en:** lib/avisos.ts (emitirDelCatalogo :158-159 vs emitirAviso :86,:106) +
lib/plantillas.ts:147-153 · *2026-08-06 mila-ia-nativa*

### Decisión: los avisos tienen DOS apagadores, y son maestro/hijo, no una regla duplicada

`plantillaActiva(id)` (store global del dueño, `/agencia › Plantillas`) corta **antes** que
`avisoWaActivo(ws,id)` (preferencia por workspace, `/configuraciones › Notificaciones`). Un revisor
lo reportó como «una cosa, un lugar» roto; la verificación decidió que **no**: son dos compuertas de
alcance distinto (plataforma vs inquilino), cada una con un solo lugar de definición, y arrancan sin
divergencia porque el store nace vacío.

**Lo que sí es defecto:** el hijo se dibuja sin mirar al maestro — con la plantilla desactivada por
la agencia, el panel muestra el interruptor PRENDIDO y no llega nada. El propio catálogo dice que
«ofrecerle al usuario un interruptor para algo que nunca se enciende es peor que no ofrecerlo», y el
panel ya resuelve bien el caso maestro/hijo del pop-up/sonido con `disabled`.

**Vive en:** lib/avisos.ts:139 + lib/plantillas.ts:32 vs lib/perfil.ts:218 y
app/perfil/NotificacionesPanel.tsx:361 · *2026-08-06
~auditoria-notificaciones-y-titulo-de-pestana*

### Decisión: MaKo avisa solo lo que importa

Nada de «todo bien» ni ruido: «me parece perfecto que no avise 'todo bien' o que no avise cosas
innecesarias» (2026-07-11). Sí avisa **wins**, pero hay que definir qué es una win (ejemplo suyo:
una campaña de testeo encontró un ad ganador).

### Decisión: mensaje nuevo se notifica en TODA la app

Badge en la sidebar como el del CRM, sonido, y pop-up lateral de 5 segundos que al clickearlo lleva
al chat: «SI alguien está navegando por cualquier otro lado de la App y le llega un mensaje de un
lead, lo tiene que saber» (2026-06-24). Con una salvedad textual suya: si eso hace más lento el
pop-up, mejor no lo hagas.

### Decisión: Telegram se saca de toda la app

«ya no lo utilizamos más» (2026-07-16) y «saquemos de todos lados telegram, no lo quiero»
(2026-07-26). Si aparece una referencia a Telegram en un catálogo de canales o en una pref de
notificación, se borra.

---

## La voz de MaKo: el grupo y el doer

### ⚠️ MaKo no le contestó a NINGÚN cliente por WhatsApp durante dos semanas y no quedó ni una traza

**Síntoma:** los clientes le escriben al grupo de MaKo y no pasa nada. Como MaKo sí mandaba avisos
**salientes** por ese mismo grupo, parecía funcionar.

**Causa real:** el onboarding crea el grupo oficial de cada cliente (`asegurarGrupoMaKo`) pero
**nunca lo agrega a la allowlist `mako.doer.grupos`**, que solo se escribe desde una acción manual
del super-admin. `manejarEntranteDoer` cortaba en la segunda línea con `skip:'grupo no habilitado'`,
antes de resolver workspace o IA. Lo que lo volvió **invisible** fueron dos cosas más: los entrantes
de GRUPO no se espejan en ninguna tabla (el webhook manda a `guardarMensajeUpsert` solo los 1-a-1) y
el webhook descarta el `ResultadoDoer` sin loguearlo, así que un mensaje descartado es
indistinguible de uno respondido y el 200 sale igual.

**Reglas:** espejar el entrante **antes** de evaluar los gates, y loguear el motivo del skip. Al
habilitar grupos, ojo con el modo default `'libre'`: MaKo contesta CADA mensaje del grupo, incluida
la charla del cliente con su equipo, con un loop de tools de Claude por mensaje.

**Sigue reportado roto:** «MaKo en WhatsApp pierde contexto, contesta al día siguiente, y a Mauricio
y Leila no les respondió nada» — 19/07, 20/07 y de nuevo el 01/08.

**Vive en:** lib/mako-doer-in.ts (manejarEntranteDoer, modoDoer) ·
app/api/webhooks/evolution/route.ts:123-150 · lib/mako-grupo.ts:183 · *2026-08-01
auditoria-plan-y-whatsapp*

### ⚠️ Toda la voz de MaKo sale por UNA instancia y no hay fallback ante fallo

**Síntoma:** el cron corrió bien, creó las propuestas, y el aviso nunca llegó a WhatsApp; el log
solo decía «Evolution 400».

**Causa real:** TODO envío de MaKo (avisos, doer, chat admin, flujos, reportes, y hasta crear
grupos) pasa por `instanciaVoz()`, que lee el setting `mako.voz.instancia` del ws1. Con esa
instancia caída, **MaKo queda mudo para TODOS los workspaces a la vez**. El
`INSTANCIA_VOZ_DEFAULT = 'mako_ws1'` NO es un fallback ante fallo: solo aplica si la setting está
vacía, y no hay health-check previo.

**Regla:** antes de culpar al emisor, mirá qué instancia resuelve `instanciaVoz()` y su
`connectionState`.

**Vive en:** lib/mako-grupo.ts:26-36 (instanciaVoz) · setting `mako.voz.instancia` en app_settings
del ws1 · *2026-07-29 ~forense-canal-mako-mudo*

### ⚠️ La instancia de la voz no está en la tabla: no se monitorea, no se repara y «Reparar espejo» no la alcanza

**Síntoma:** se repara workspace por workspace, todo queda verde, y la voz sigue muerta.

**Causa real, en tres capas:**

1. `mako_superadmin` —la línea que le da voz a MaKo— **no tiene fila en `evolution_instancias`**. El
   webhook de `connection.update` hace `update ... .eq('instance_name', ...)` y afecta 0 filas: la
   caída no se registra en ningún lado y el estado sigue diciendo lo de siempre.
2. `repararWebhook()` resuelve el nombre con `instanceNameDeWs(ws) → mako_ws<id>`, así que el botón
   «Reparar espejo» **nunca** alcanza esa instancia. La única vía por app es
   `POST /api/admin/mako-doer {"action":"preparar-voz"}`, **que no tiene botón en ninguna parte del
   repo**.
3. `setWebhook` es un **no-op mudo** si falta `EVOLUTION_WEBHOOK_SECRET` en el entorno donde corre:
   la instancia queda `state=open` («conectado») con el webhook nunca registrado, sin un solo
   mensaje en el espejo y sin error.

**Regla:** si una instancia no está en la tabla, no está monitoreada ni reparable.

**Vive en:** app/api/webhooks/evolution/route.ts:28-37 y :101 · lib/evolution.ts (setWebhook,
estadoWebhook, repararWebhook) · lib/mako-canal.ts · app/api/admin/mako-doer · tabla
evolution_instancias · *2026-07-29 ~forense-canal-mako-mudo (confirmado de nuevo el 2026-08-05 y el
2026-08-07)*

### El doer arranca ESCUCHANDO por default, al revés que los flags de envío

`mako.doer.activo` tiene default **ON** (solo el string `'false'` lo apaga), mientras que
`envio_email_enabled` / `envio_whatsapp_enabled` / `crm_auto_enabled` son fail-closed a propósito: un
workspace SIN la setting queda apagado.

**La asimetría importa al clonar o crear un workspace:** no hace falta copiar nada para que el doer
quede activo, queda solo. Y si además se copia la allowlist `mako.doer.grupos`, el ws nuevo escucha
los grupos **reales** del otro y MaKo responde dos veces cada mensaje.

**Vive en:** lib/mako-doer-in.ts:41 (KEY_ACTIVO) · lib/envio-flags.ts · *2026-08-01
mapa-clonar-workspace*

### El acuse del doer NO sale justo en los casos más lentos

**La regla del dueño:** MaKo por WhatsApp acusa recibo **casi inmediato**, antes de razonar, para que
no parezca que no funcionó («aún tarda MUCHO en darme la primera respuesta. Esa debe ser casi
inmediata», 2026-07-19).

**Lo que hace hoy:** el gate del acuse es
`!audio && !adjunto && textoDirecto.length > 10 && vigentes.length === 0` y adentro exige
`tier !== 'cheap'` o carga de plan. O sea: **no hay acuse** para nota de voz, imagen/PDF, textos de
≤10 caracteres, turnos con una acción pendiente de confirmar, ni charla barata. Y el fallback tampoco
cubre: `enviarPresencia(...,'composing',12000)` dura 12 segundos.

Esto importa antes de fijar cualquier ventana de espera: la más larga (audio, ~30s) es exactamente la
que hoy queda muda **por partida doble**. Hay que mandar acuse también en audio/adjunto y en cheap, o
renovar la presencia mientras dure la ventana.

**AMPLIADO Y RESUELTO PARA MEDIA el 2026-08-08.** Lo de arriba era la mitad. La otra mitad, que es la
que explica por qué el acuse tampoco era «casi inmediato» para el texto que SÍ pasa el gate: **el
buffer del lote se agregó DELANTE del acuse y lo empujó detrás de la ventana de silencio.** El bloque
vive dentro de `procesarDoer`, y `procesarDoer` se llama después de `esperarSilencio` — 21 s reales
para audio, 9 s para texto. El comentario del código que dice «lo mandamos ACÁ, lo primero» era cierto
cuando se escribió (jul-19) y quedó falso el día del buffer (ago-05). *Antes de confiar en un
comentario de posición, mirá quién llama a esa función y qué hay antes.*

Medido en prod sobre los tres audios de ws9 del 8/8: **38,6 · 50,6 · 51,7 segundos de silencio total**.
Y el costo real está en la base: el dueño reenvió el mismo audio 2 min 43 s después creyendo que no
había llegado (`mako_doer_buffer` id=25 e id=26, dos turnos idénticos de 1.892 chars) → **dos
borradores duplicados de la misma reunión**.

El acuse de media va ahora en `bufferearYResponder`, justo después de `reclamar()`. Ese es **el único
punto del pipeline por el que pasa exactamente UNA invocación por lote** (el que pierde el candado ya
volvió), y está delante de la espera: mandar tres audios seguidos deja un solo «te escucho». Solo para
media a propósito — audio y adjunto siempre enganchan (`esMedia` saltea el chequeo de modo/ventana),
así que ahí no hace falta repetir esa guarda; el acuse de texto sigue en `procesarDoer` porque sí
depende de si lo nombran y de si hay una charla pendiente.

⚠️ **Una vez que acusaste, cerrás siempre.** `procesarDoer` tenía seis salidas mudas; las dos que
importan después de un acuse (`audio sin base64`, `adjunto sin base64`) ahora avisan y piden el reenvío
en vez de irse con un `console.error`. Acusar y desaparecer es peor que no acusar.

**Vive en:** lib/mako-doer-in.ts (`bufferearYResponder` tras `reclamar`; las salidas de `sin base64`) · lib/mako-doer-buffer.ts:36-42 (VENTANA_AUDIO_MS) · *2026-08-05 ~fathom-preguntas-lote-whatsapp-forense · ampliado y resuelto 2026-08-08*

### El anti-eco del doer sigue con el read-modify-write que ya explotó una vez en el dedup

`registrarEnviados` lee `mako.doer.sent.<jid>` de `app_settings`, le agrega el id y hace `setSetting`
— un read-modify-write sin atomicidad sobre un upsert last-write-wins. Dos invocaciones concurrentes
leen el mismo array y una pisa a la otra: un id enviado desaparece del ring buffer y, cuando llega su
eco `fromMe`, **MaKo lo procesa como si fuera un mensaje del dueño** (respuesta duplicada o loop).

Es exactamente el bug que ya se pagó en el dedup de mensajes y que se resolvió migrándolo a un índice
único ([[lote-whatsapp-buffer]]); el anti-eco quedó con el patrón viejo. Se mitigó batcheando un solo
write por respuesta, lo que angosta la ventana pero no elimina la carrera entre dos entrantes del
dueño.

**Vive en:** lib/mako-doer-in.ts:59-70 (registrarEnviados) y :324 (el guard del eco) · *2026-07-19
~review-doer-whatsapp-y-snapshot*

### Decisión: el grupo se llama «MaKo <> {Cliente}», y el del SuperAdmin es otro

Todos los grupos con clientes los integran Martín (el dueño) y el cliente: «mi idea es que todos los
grupos con clientes esté yo el dueño (Martín) y esté el cliente» (2026-07-14). El **SuperAdmin tiene
su propio grupo**, con foto distinta (estrella azul), porque Mauricio ya no vuelve a pasar por el
onboarding y **los avisos de un cliente no pueden caer en el grupo del SuperAdmin**. Los clientes
crean el suyo en el onboarding cargando el número del dueño, y ese número se puede cambiar después
desde `Configuraciones › Notificaciones` (ver arriba: hoy cambiarlo ahí **no** cambia el de los
reportes).

### Decisión: los mensajes a terceros salen del número del usuario, no del de MaKo

Cuando se le mandan tareas de una reunión a un colaborador, el mensaje sale del número del **usuario
del workspace**, no de la cuenta de MaKo: no corresponde que MaKo hable en nombre del dueño. Queda
pendiente revisar en qué otros momentos el número de MaKo le escribe a leads (2026-08-05).

### Decisión: si MaKo puede resolverlo, lo resuelve

Solo pregunta cuando **no** encuentra la respuesta: «Si lo puede hacer MaKo, siempre debería, solo me
debe preguntar en caso de NO encontrar respuesta» (2026-07-19). Y toda acción irreversible o generada
por IA pasa por un modal de confirmación que **previsualiza exactamente lo que va a pasar**
(2026-07-17). Todo lo que toca la IA deja rastro en el historial, firmado **MaKo** con ícono de IA, no
con foto de usuario (2026-07-14, 2026-07-17).

### Lo que sigue sin hacer

- **WhatsApp no notifica cuando el mensaje sale del mismo número del dueño.** Lo planteó sin solución:
  «no se me ocurre como resolverlo» (2026-07-14).
- **Que la creación del grupo con el cliente esté en el onboarding de cada cliente nuevo.** Preguntó
  «¿Cómo lo hacemos?» y no hay respuesta en el hilo (2026-07-14). Ojo: el onboarding ya llama a
  `asegurarGrupoMaKo` — lo que falta es la allowlist del doer (ver el primer hallazgo de esta
  sección).
- **WhatsApp rechaza un `.txt`** al intentar cargar tareas al plan: «Eso no debe pasar, solucionalo
  primero» (2026-08-06). El catálogo de formatos vive en `lib/formatos-archivo.ts`.
- **F4: poder hacer modificaciones en la app directo desde WhatsApp** (2026-07-10).

---

## Webhooks, dominios y credenciales

Lo que comparten los dos canales: cómo entran los eventos y con qué credenciales salen.

### ⚠️ El reparador compara la URL entera, así que tras mudar de dominio no reconoce el suyo

**Síntoma medido:** dos webhooks entregando, cada mensaje entrante disparando el receiver **dos
veces**, avisos duplicados al dueño y turnos repetidos en `mako_doer_conv` contaminando la memoria del
doer.

**Causa real:** `webhooksPropios()` filtraba con `sinQuery(h.url) === sinQuery(esperada)`, y
`esperada` incluye el **HOST**. Al cambiar el dominio, el webhook propio deja de matchear, `propios`
queda vacío, `repararWebhookChatwoot()` entra por la rama «no hay ninguno» y hace POST **creando uno
nuevo** en vez de PATCH — y el DELETE de duplicados nunca corre sobre los viejos.

**El gemelo del mismo error:** `estadoWebhook()` de Evolution compara contra `APP_BASE_URL` y
devuelve `no_registrado`, así que dos clientes reales veían «el webhook no está activado» mientras los
mensajes entraban perfecto.

**Regla:** la identidad de un webhook auto-registrado es el **`pathname`**, nunca la URL completa — el
host es exactamente lo que cambia. `lib/chatwoot.ts` ya compara por path; el lado Evolution hay que
verificarlo antes de confiar.

**Vive en:** lib/chatwoot.ts:693 y :732-734 (webhooksPropios, repararWebhookChatwoot) ·
lib/evolution.ts:380 (estadoWebhook) · app/whatsapp/EvolutionConnect.tsx:240 · *2026-08-05
~auditoria-mudanza-dominio + 2026-08-07 contexto-mako-md*

### ⚠️ Sin `CHATWOOT_WA_INBOX_ID` los mensajes del cliente salen por el inbox 3 — el de Mauricio

**Causa real:** un default que inventa un dato. `cfg()` (lib/chatwoot.ts:30) hace
`Number(inboxRaw ?? '3')`. Los otros tres valores (base, account, token) **tiran error** si faltan;
este INVENTA uno, y el `3` es el inbox de WhatsApp del dueño. Encima el catálogo marca
`CHATWOOT_WA_INBOX_ID` como `opcional: true`, así que un cliente puede terminar el onboarding sin
cargarlo.

**La cadena de daño es toda silenciosa:** `listConversations` filtra por `inbox_id=3` y el inbox de
`/whatsapp` sale VACÍO sin ningún error; `contactoEnInboxWA` devuelve false para todos los contactos,
así que mensajes, adjuntos y bloqueo rebotan a todo el mundo; `ensureContactoWhatsapp` cuelga
conversaciones en el inbox equivocado; y `getWabaConfig`/`getApprovedTemplates` leen el
`provider_config` de un inbox ajeno, o sea que **las plantillas de nutrición se sincronizan contra el
WABA que no es**.

**Vivo hoy:** solo ws1 y ws3 tienen fila de ese campo.

**Regla:** en una config por-workspace, un default numérico que apunta a una entidad real de otro
inquilino no es un default, es una fuga. `cfg()` debería tirar igual que con base/account/token, o
resolverlo en vivo listando los inboxes de la cuenta (que es lo que ya hace `metodo-verificar`).

**Vive en:** lib/chatwoot.ts:30 (cfg) · lib/metodo-catalogo.ts:100 y :139 · *2026-07-16
~censo-features-onboarding + 2026-08-05 ~auditoria-ruleta-hidratacion-credenciales*

### ⚠️ `getWabaConfig` cae a `OWNER_WS`: un cron sin workspace fijado manda con las credenciales del dueño

`getWabaConfig()` resuelve el workspace con `(await getWorkspaceActual()) ?? OWNER_WS`. En un request
está bien, y los routes de plantillas encima gatean con `integracionConectada`, que devuelve false
cuando el ws es null. Pero **cualquier cron o job** que llame `enviarBorradorAMeta`/`submitTemplate`
sin envolver en `runWithWorkspace` no tiene sesión: `getWorkspaceActual()` devuelve null, el `??` lo
tapa y la llamada sale con el WABA y el token del DUEÑO, sobre la cuenta equivocada, **sin error**.

**Regla:** cualquier job de plantillas fija el workspace explícito antes de llamar; el fallback a
`OWNER_WS` es aceptable solo cuando el caller es un request del propio dueño.

**Vive en:** lib/chatwoot.ts:585 (getWabaConfig) · lib/meta-templates.ts:275 (enviarBorradorAMeta) ·
*2026-07-09 f33-understand*

### ⚠️ `FATHOM_WEBHOOK_SECRET` es una clave global que solo se hidrata desde ws1

Los webhooks de Fathom de los workspaces 9 y 11 **nunca entregaron un solo evento en su vida**, y NO
es por el dominio: la firma se valida contra una clave única global que solo se hidrata desde las
credenciales del ws1, así que cualquier otro workspace muere en 401 «Firma no coincide» apunte a donde
apunte.

**Queda sin arreglar:** mientras el secreto no sea por-workspace, la tab de Fathom de un cliente se
puede pintar verde y no recibir nada.

**Vive en:** app/api/webhooks/fathom/route.ts + lib/fathom.ts (verifyFathomSignature) · hidratación en
lib/credenciales.ts:215 (solo OWNER_WS) · *2026-08-05 ~auditoria-mudanza-dominio*

### `after()` de Next no garantiza que la invocación sobreviva, y Evolution no reintenta

El webhook de Evolution es fire-and-forget: encola el doer en `after()` y devuelve 200. Eso da lugar
para esperar (`maxDuration 300`), pero **no es un lugar durable**: si la instancia se congela o se
recicla, el trabajo pendiente se pierde sin retry — el 200 ya salió y Evolution no reintenta. El único
rastro sería un `console.error`.

Cuanto más se espere dentro del `after` (que es exactamente lo que hace un buffer de mensajes), más
grande la ventana de pérdida silenciosa.

**Regla para el buffer:** persistir en DB **antes** de devolver el 200, y que el cron de red barra los
huérfanos.

**Vive en:** app/api/webhooks/evolution/route.ts:133-152 · lib/mako-doer-in.ts · *2026-08-05
~fathom-preguntas-lote-whatsapp-forense*

---

## El Chatbot (ex Setting / Chat Agent) y el funnel del cliente

Todo lo de acá salió de la corrida `chatbot-funnel-leila` (13 subagentes, 2026-08-10), con
lectura de producción por `SELECT`. Los cuatro puntos que se citan con línea exacta están
**re-verificados contra el código de hoy**.

### ⚠️ El chatbot mira la SALIDA del funnel, y lo que separa a un cliente de otro es la ENTRADA

**Síntoma.** Leila (ws11) vende por WhatsApp: campañas de mensajes, prospección en frío y un
lead magnet. No tiene landing, no tiene VSL y nadie se agenda solo. El sistema le pidió tres
audios y ella grabó los tres; el de Bienvenida dice, textual, *«vi que dejaste tus datos en
el anuncio»*. Sus 27 leads tienen `meta_lead_id = 0` y `origen_lead` todo `NULL`: **ninguno
dejó sus datos en ningún anuncio.** El audio es inservible y ya está grabado.

**Causa.** El único eje que el chatbot lee del funnel es
`hayReunion = stages.some(s => s.kind === 'reunion')`
(`app/api/chat-agent/audios/route.ts:62`, `.../onboarding/resumen/route.ts:80`), que describe
**cómo termina** el embudo. Y `hayReunion` no la distingue de Mauricio: ella **sí** hace
llamadas (3 leads con `fecha_junta_1` en prod). Lo que no tiene es **formulario de anuncio ni
agendamiento automático** — o sea, la entrada. Ese dato no existe como campo en ningún lado:
grep de `tiene_landing|canal_adquisicion|prospecc` sobre `lib/` y `app/` da cero. `Stage`
(`lib/pipeline.ts:29-42`) no tiene ningún atributo de activo, y el brief del negocio
(`lib/onboarding.ts:17-49`, 18 campos) no lo pregunta.

**La regla.** Un funnel modelado solo por sus etapas describe el recorrido y **no** los
activos que lo hacen posible. Antes de derivar contenido de un funnel, separar qué de la
premisa es *etapa* y qué es *activo declarado* (landing, video, formulario, agenda
automática, lead magnet). Los activos se declaran; no se infieren de la forma del pipeline.

**Vive en:** `lib/pipeline.ts` (`Stage`) · `lib/leads.ts:1439-1472` (`getFunnel`/`saveFunnel`) ·
`lib/audios-paso.ts` · `app/api/chat-agent/audios/route.ts:62` · *2026-08-10 ~chatbot-funnel-leila*

### El contexto del funnel SÍ le llega a MaKo, y pierde contra la instrucción que está 15 líneas más abajo

**Síntoma.** El diagnóstico obvio —«MaKo no sabe el funnel del cliente, hay que pasárselo»—
**era el equivocado**, y perseguirlo habría costado el trabajo entero. `resumenFunnel()`
(`lib/mako-context.ts:51-67`) ya inyecta el funnel textual en cuatro features:
`guion-audio/route.ts:88`, `ensayo/route.ts:190`, `lib/setting-simulador.ts:137`,
`lib/nutricion-generator.ts:259`. El modelo tenía el dato y escribió el audio equivocado igual.

**Causa.** El funnel entra como **dato descriptivo**, arriba; el catálogo de Mauricio entra
como **orden**, abajo. `lib/audios-paso.ts:47` («Menciona de dónde llegó su dato: dejó sus
datos en el anuncio») viaja crudo hasta el bloque encabezado *«QUÉ TIENE QUE DECIR EL AUDIO,
EN ESTE ORDEN»* (`guion-audio/route.ts:53,118`). Un imperativo concreto le gana a un párrafo
de contexto, siempre.

**La regla, con el molde ya escrito en el mismo archivo.** Es la regla de AGENTS.md («una
regla en un prompt no es una regla») en su forma positiva: el link de video se resuelve
**determinísticamente** con `guionDe(def, linkVideo)` (`lib/audios-paso.ts:94-99`), que
inserta el bullet solo si hay link, **y además** manda al prompt una prohibición explícita,
`VIDEO_SIN` (`guion-audio/route.ts:72`): *«este negocio no tiene ningún video configurado. NO
menciones videos, links ni material para ver»*. Dato → guion determinista → regla negativa.
Cualquier eje nuevo del funnel se consume copiando ese molde, no agregando contexto arriba.

**Vive en:** `lib/audios-paso.ts:44,47,94-99` · `app/api/chat-agent/onboarding/guion-audio/route.ts:53,71-72,88,117-118` ·
`lib/mako-context.ts:51-67` · *2026-08-10 ~chatbot-funnel-leila*

### La premisa del origen está repetida en los 9 escenarios del ensayo, y ahí manda sobre todo

`quien: 'dejaste tus datos en un anuncio…'` aparece en
`lib/chat-agent-escenarios.ts:106,133,156,202,224,246` y llega al prompt por `bloqueEscenario`
(`:368`), donde el propio texto dice *«Ese renglón manda sobre todo lo demás»*
(`ensayo/route.ts:68`). `escenariosDe` (`:331-337`) filtra por `requiereVideo` y por la reunión
del audio asociado — **nunca por el origen**. Peor: `fueraDeTema` prohíbe explícitamente «decir
que no recuerdas haber dejado tus datos» (`:121,145`), que es la reacción número uno de alguien
contactado en frío. El ensayo entrena contra la realidad del cliente.

**Vive en:** `lib/chat-agent-escenarios.ts:106,121,133,145,156,202,224,246,331-337,368` · *2026-08-10 ~chatbot-funnel-leila*

### Las secuencias de audios nacen colgadas de columnas que un cliente sin Meta nunca llena

`lib/secuencias-audios.ts:76` cuelga de `trigger:'instant_form_sin_agenda'`, que exige
`meta_lead_id NOT NULL` (`lib/nutricion.ts:320`) — lo escribe **solo** el ingest de Meta
lead-ads. `:128` cuelga de `'agendado_sin_confirmar'`, que exige `fecha_junta_1` futura
(`lib/nutricion.ts:362-370`). Para un workspace con 0 leads de Meta: el cliente graba,
aprueba, prende la secuencia y **no sale un solo mensaje**. Sin aviso, sin log, con la
pantalla diciendo que está activa.

**La regla.** Toda secuencia que se crea sola tiene que **contar su cohorte al activarse** y
decirlo en pantalla si da 0. La mitad del dato ya existe y se tira: `GET /resumen` devuelve
`sinGrabar` y la UI ni lo lee (`resumen/route.ts:85` vs `OnboardingChatAgent.tsx:569`).

Adyacente y vivo: esas secuencias nacen con `estrategia` NULL (`lib/secuencias-audios.ts:149-152`
no la setea), y eso hace que `asistirRespuesta` retorne en silencio — ver
[Nutrición](#nutrición-y-secuencias). Verificado en prod: las 11 secuencias de ws11 tienen
`estrategia` NULL.

**Vive en:** `lib/secuencias-audios.ts:76,87,116-121,128,149-152` · `lib/nutricion.ts:320,362-370` · *2026-08-10 ~chatbot-funnel-leila*

### Todo el chatbot falla ABIERTO hacia el funnel del dueño

Cuatro defaults, los cuatro optimistas: `hayReunion` arranca en `true` en el cliente
(`app/chatbot/OnboardingChatAgent.tsx:315`), `escenariosDe` tiene `hayReunion = true` por
default (`lib/chat-agent-escenarios.ts:331`), y `getFunnel()` cae a `DEFAULT_PIPELINE` con
`agenda:'reunion'` tanto si no hay fila como si hubo **error** (`lib/leads.ts:1455,1460` ·
`lib/pipeline.ts:316,318`). Un cliente sin funnel declarado —o con Supabase caído— recibe el
funnel de Mauricio y no se entera. Es la misma forma del guard en negativo que AGENTS.md ya
prohíbe: `null` («no declarado») tiene que ser distinto de un default que afirma algo.

**Vive en:** `app/chatbot/OnboardingChatAgent.tsx:315` · `lib/chat-agent-escenarios.ts:331` ·
`lib/leads.ts:1455,1460` · `lib/pipeline.ts:316,318` · *2026-08-10 ~chatbot-funnel-leila*

### Tres roturas silenciosas más, verificadas a mano

- **`/api/chat-agent/envio` no existía** (ARREGLADO 2026-08-10). `app/chatbot/OnboardingChatAgent.tsx:367`
  la llamaba; `app/api/chat-agent/` tiene solo `audios`, `onboarding`, `secuencias` y
  `simulador`, y no hay rewrite en `next.config.ts`. Medido contra el dev server: esa ruta da
  **404 con HTML**, así que `.json()` reventaba, lo tragaba el catch mudo de `:369`, `canales`
  quedaba `null` y el paso `wa_oficial` mostraba **siempre** «no está conectado» (`:1169`). Es
  exactamente el bug que el comentario de `:355-362` juraba haber arreglado la vez anterior —
  otro caso de la sección «los comentarios mienten». Ahora apunta a `/api/whatsapp/envio`, que
  devuelve las tres claves que el componente esperaba (`{ok, envioHabilitado, oficialConectado,
  evolutionConectado}`).
  **La regla que queda, que es más grande que el bug:** el catch ya no puede ser mudo, porque
  era lo único que separaba «no está conectado» de «no pudimos preguntarlo», y un `null` que se
  pinta como una afirmación es una mentira en pantalla. Por eso el error vive en su propio
  estado (`canalesErr`) y no colapsado en el `null` del dato. Ojo también con el guard: ese GET
  exige **rol admin del workspace**, así que a un miembro le da 403 — que sin el estado aparte
  se leía como «desconectado».
- **`setting.guion_audio` no está en `lib/prompt-registry.ts`** (0 hits; sus cinco hermanos
  `setting.*` sí están, `:355,362,369,411,418`), aunque se renderiza con `renderPrompt`
  (`guion-audio/route.ts:101`). El prompt más atado al funnel es el único que no se puede ni
  parchear desde `/configuraciones`.
- **`contextoDe()` devuelve `null` sin avisar** para la etapa `conversando`
  (`lib/etapas-contexto.ts:26-97,100`), que es la etapa central de la plantilla `conversaciones`
  (`lib/pipeline.ts:520`) — justo la de un negocio que vende por chat. `SecuenciaWizard.tsx:290`
  simplemente no pinta la caja. Y `huecosDeSecuencias` excluye `reunion_excepcional` pero no
  `noshow_r3` (`lib/secuencias-huecos.ts:27`), así que a un funnel sin reuniones le reclama
  igual una secuencia de No Show R3.

**Vive en:** `app/chatbot/OnboardingChatAgent.tsx:355-369,1169` · `lib/prompt-registry.ts` ·
`lib/etapas-contexto.ts:100` · `lib/secuencias-huecos.ts:27` · *2026-08-10 ~chatbot-funnel-leila*

### El canal declarado no se propaga al funnel cuando el diagnóstico se rehace desde el hub

`app/api/onboarding/route.ts:261-274` propaga el canal al funnel; `app/api/onboarding/fase/route.ts:38`
llama solo a `setDiagnosticoFase` y **no propaga**. Rehacer el diagnóstico desde el hub deja el
funnel viejo y no lo nota nadie. Además `:35` castea `body.canal as CanalId` sin validar contra
`CANALES`. Es una regla en dos lugares: va a **una** función (`aplicarCanalAlFunnel`) que llamen
los dos.

**Vive en:** `app/api/onboarding/fase/route.ts:35,38` · `app/api/onboarding/route.ts:261-274` · *2026-08-10 ~chatbot-funnel-leila*

### Resetear el chatbot de un cliente real: qué se puede y qué no

`resetearWorkspace` **no sirve** para esto y no debería: `exigirClienteDePrueba`
(`lib/auth-session.ts:73-81`, `WS_PRUEBA=3`) bloquea cualquier workspace real en las tres capas
(`lib/reset-workspace.ts:110`, `app/api/datos-mau/route.ts:31-37`, `app/_components/PanelAgencia.tsx:194`),
con test explícito que itera `[9,10,11,42]` (`tests/reset-workspace.test.ts:49-56`). Y si se
saltara, además de los datos **corta la sesión de Evolution** (`lib/reset-workspace.ts:120-126`):
hay que re-escanear el QR. No deja backup, a diferencia de los scripts one-off.

Lo que sí existe y **funciona en cualquier workspace** (guard = admin del ws):

| Qué | Cómo | Nota |
|---|---|---|
| Borrar un audio | `DELETE /api/chat-agent/audios?id=N` (`route.ts:128-145`) | borra fila + binario + la clave del mapa `chat_agent.audios_clave` en un golpe |
| Archivar todas las secuencias | `POST /api/chat-agent/secuencias {action:'archivar'}` (`route.ts:139-144`) | archiva, no borra; reversible con `desarchivarSecuencia` |
| Reabrir la tab | `POST /api/chat-agent/onboarding {action:'reabrir'}` (`route.ts:57-59`) | resetea la tab **entera**, no un paso, y **no tiene ningún caller en la UI** |

Para volver un paso solo, se escribe `onboarding.tab.setting.steps.<paso>.done = false` en
`app_settings`. ⚠️ Y no copiar `scripts/wipe-chart-chats.mjs` como molde: `:20-21` hace
`DELETE FROM chart_chats` **sin `workspace_id`**.

**El orden importa:** resetear antes de arreglar el catálogo no sirve de nada — el cliente
regraba exactamente el mismo audio equivocado, porque `lib/audios-paso.ts:44,47` no cambió. El
reset es el último paso.

**Vive en:** `lib/reset-workspace.ts` · `lib/auth-session.ts:73-81` · `app/api/chat-agent/audios/route.ts:128-145` ·
`app/api/chat-agent/onboarding/route.ts:57-59` · `lib/secuencias-huecos.ts:90-123` · *2026-08-10 ~chatbot-funnel-leila*

### Lo que se hizo (2026-08-10) y lo que quedó a mitad

**Hecho, con tests:** el eje `funnel_config.data.entradas` (5 valores, array, `[]` = no
declarado) + `evento` + el canal `presencial` con su plantilla; `audiosDe(entradas, canal)`
y `escenariosDe(hayVideo, entradas, canal)` **sin default**; cuatro audios nuevos
(`bienvenida_landing`, `apertura_fria`, `respuesta_entrante`, `evento_confirmado`) con los
tres de ws1 **intactos y congelados por `assert.equal` literal**; cuatro escenarios de
ensayo para prospección en frío y evento; `guionDe(def, {linkVideo, evento})`; las
`PROHIBICIONES` con `violaPerfil` + un reintento en `guion-audio/route.ts`; la tarjeta
«¿Cómo entra tu gente?» en `/funnel`; el merge del jsonb en `saveFunnel`; el guard de rol
que le faltaba a `saveFunnelAction`; y el gate de Fathom por conexión viva.

**Sin terminar, y hay que saberlo antes de seguir:**

- **La tarjeta no PREMARCA nada.** El diseño pedía inferir la entrada de la evidencia real
  (`leads.origen_lead`, `meta_lead_id`, la dirección del primer mensaje de `wa_mensajes`) y
  que el cliente solo confirmara. Hoy elige de cero. `lib/funnel-evidencia.ts` no existe.
  ⚠️ El join de WhatsApp es la parte frágil: `wa_mensajes.lead_id` está casi vacío y
  `wa_mensajes.telefono` es el jid (`5219983928070`) contra `leads.telefono_normalizado`
  (`9984607078`) — la igualdad exacta da **cero filas en los tres workspaces**. Hay que
  matchear por los últimos 10 dígitos, acotado al workspace.
- **No hay backfill.** Los workspaces existentes arrancan con `entradas: []`, así que el
  paso de audios les va a pedir declararlo antes de grabar. Para ws1 la evidencia es dura
  (790 leads con `instant_form` + 65 con `calendly`) y el backfill es un UPDATE de una fila.
  ⚠️ ws5 y ws9 **no tienen fila** en `funnel_config` y no hay que crearla: ver la entrada de
  `hallazgos-crm.md` sobre por qué «sin fila» no es «vacío».
- **Falta el escritor único de canal.** `app/api/onboarding/fase/route.ts:38` sigue sin
  propagar el canal al funnel ni validar `body.canal` contra `CANALES`. Con un canal nuevo
  esto empeora: se puede elegir «presencial» desde el hub y quedarse con el funnel de
  llamadas para siempre.
- **Faltan los consumidores de segunda línea:** `lib/secuencias-audios.ts` sigue colgando de
  `instant_form_sin_agenda` (que exige `meta_lead_id`) sin mirar `entradas`;
  `lib/setting-estrategia.ts` no tiene el objetivo `'asistir'`, así que **la secuencia «nos
  vemos el miércoles» no tiene forma de parar** cuando la persona ya fue; y
  `landing-writer.ts:150`, `landing-analyst.ts:345` y `campaign-structurer.ts:144` siguen
  leyendo la entrada del LABEL de una etapa.
- **`onboarding.funnel_tipos` sigue escribiéndose** (1 escritor, 0 lectores).

### Lo que sigue sin hacer
- El **inbox de WhatsApp tiene su propio funnel hardcodeado en cuatro copias**
  (`lib/wa-etapas.ts:48`, `app/api/whatsapp/conversations/route.ts:29`, `lib/meta-rules.ts:78`,
  `app/whatsapp/WhatsAppApp.tsx:227`), ciego a `funnel_config`. Todos los leads de un cliente
  así quedan en «Abierto» para siempre, y ese label es lo único que recibe
  `lib/whatsapp-advisor.ts:175`. Es la pantalla donde vive un cliente que vende por chat.
- **Cinco prompts con la identidad de Mauricio hardcodeada para todos los workspaces**, ninguno
  en el registry. El peor: `app/api/email/generar/route.ts:18-24` mete el Calendly de Mauricio
  como CTA de cualquier cliente.
- `saveFunnelAction` (`app/crm/actions.ts:1771`) **no valida rol**.
- `/comercial` y las vistas `v_cohortes_*` filtran `fecha_junta_1 IS NOT NULL` **en SQL**
  (`supabase/migrations/0001_initial_schema.sql:159-168,197-207`): para un cliente sin llamadas
  no es un flag, es una migración.
- `generateFunnel` siembra «Reunión excepcional» y «No Show R3» en todo funnel con etapa
  `kind:'pago'` (`lib/pipeline.ts:429-439`), y **no** genera Reactivación salvo que haya
  reunión (`:451`) — que es justo la que más le sirve a quien prospecta en frío.

---

## Instagram: lo que hay que saber antes de abrir el canal

De la corrida de 21 agentes del 14/08/2026 (evaluación de factibilidad: DM directo vs
ManyChat vs Chatwoot, + publicación de contenido). **12 afirmaciones se mandaron a
verificación adversarial y 9 volvieron refutadas o matizadas** — el research de una sola
pasada sobre APIs de Meta no es confiable, y las tres correcciones más caras están abajo.

⚠️ **Y lo que NO se mandó a verificar salió peor.** De los dos bugs de código que la corrida
reportó acá como vivos en producción, **uno no existía**: era una línea mal transcripta por
la herramienta de búsqueda, «confirmada» ejecutando la transcripción en vez del archivo. La
autopsia es la primera entrada de abajo y vale más que el hallazgo que reemplaza.

### ~~El link del aviso de WhatsApp entrante nunca se generó~~ — el bug NO EXISTÍA

**Vive en:** `app/api/webhooks/chatwoot/route.ts:175` · `tests/chatwoot-canal-aviso.test.ts`

**El diagnóstico obvio era el equivocado, y el «obvio» era una alucinación de la
herramienta.** La corrida del 14/08/2026 reportó acá que el link del aviso se armaba con
barras invertidas (`` `${base}\app\accounts\${acc}\…` ``), que eso cancelaba la
interpolación y que el dueño venía recibiendo un link roto en **cada** mensaje entrante.
Se escribió como bug VIVO en producción. **Era falso.** El archivo siempre tuvo barras
normales:

```js
const link = convId && base ? `${base}/app/accounts/${acc}/conversations/${convId}` : '';
```

`git log -L 175,175:app/api/webhooks/chatwoot/route.ts` lo prueba: la línea nació así en
`f8c636fe` y solo la tocó `5117160f` para meterle `credWs`. Nunca hubo una versión con `\`.
Y no es el caso de «se arregló hace una hora» que ya tiene su regla en AGENTS.md: acá
**nunca estuvo roto**.

**La causa real: la herramienta de búsqueda del agente reescribe `/` como `\` en el
contenido que devuelve.** No en el path del resultado — en la LÍNEA del archivo. Medido el
mismo día, sobre archivos de este repo:

| El archivo dice | El `Grep` del agente devuelve |
|---|---|
| `` `${base}/app/accounts/${acc}/conversations/${convId}` `` | `` `${base}\app\accounts\${acc}\conversations\${convId}` `` |
| `// Habla de un CONTACTO, no del sistema:` (`lib/avisos-catalogo.ts:106`) | `\ Habla de un CONTACTO, no del sistema:` |
| `// El `ws` va EXPLÍCITO.` (`lib/nutricion.ts:1370`) | `\ El `ws` va EXPLÍCITO.` |

Un `//` que vuelve como `\` es la firma: **eso no es código que exista en ningún lado**, es
normalización de rutas de Windows aplicada al renglón entero. Solo pasa en los resultados
cuyo path viene ACORTADO a relativo; los que traen el path absoluto completo vuelven
intactos, y por eso en un mismo bloque de resultados hay líneas sanas y líneas mangleadas.
`Read` y `cat -A` devuelven la verdad.

**Y la trampa que convirtió el error en un hallazgo publicado: «verificado ejecutándolo».**
El agente pegó en node el string que había leído del `Grep` y node le devolvió, con toda
razón, `"https://mauricio.up.railway.appappaccounts…"`. Ejecutar **confirma la
transcripción, no el archivo**. Una verificación que no vuelve a la fuente no verifica nada.

**Las reglas que quedan** (la operativa está en AGENTS.md → «lo que devuelve la búsqueda no
es el archivo»):

1. Antes de reportar un bug de un CARÁCTER —una barra, una comilla, un escape— releer esa
   línea con `Read` o `sed -n 'Np' | cat -A`. `Grep` sirve para ENCONTRAR, no para citar.
2. Antes de escribir «bug vivo en producción», `git log -L <línea>,<línea>:<archivo>`. Si la
   línea nunca tuvo la forma que reportás, el bug es del diagnóstico.
3. Un test que evalúa la expresión del archivo cierra las dos puntas de una vez, porque
   `readFileSync` no miente. Existe: `tests/chatwoot-canal-aviso.test.ts` arma el link con
   la línea REAL del route y compara la URL resultante — era cierto que ningún test miraba
   el texto de un aviso, y esa parte del hallazgo sí valía.

### El webhook de Chatwoot no miraba de qué canal viene el mensaje — CERRADO 14/08/2026

**Vive en:** `lib/chatwoot-canales.ts` · `app/api/webhooks/chatwoot/route.ts` ·
`lib/metodo-verificar.ts` · `tests/chatwoot-canal-aviso.test.ts`

El tipo `ChatwootHook` declara `inbox?: { id?: number }` con el comentario «por si más
adelante se rutea a nivel de inbox» — y **nunca se lee**. No hay campo `channel` en el
tipo. El único filtro es `event === 'message_created'` + entrante.

Hoy no muerde porque la cuenta 3 tiene un solo inbox. **El día que alguien agregue un
inbox de Instagram, de email o de webchat a esa misma cuenta de Chatwoot**, cada mensaje
entrante cae acá: `sender.phone_number` viene vacío, `buscarLeadPorTelefono('')` devuelve
`null`, los cuatro bloques de lead se saltean en silencio — y `emitirDelCatalogo(
'wa-mensaje-entrante')` de la línea 176 **es incondicional**, así que el dueño recibe un
aviso rotulado como WhatsApp por un DM de Instagram, sin teléfono y con el link roto de
arriba. Es el patrón de «el default que inventa un dato», acá en forma de canal.

**Al filtrar, aceptar los DOS valores.** El canal viaja en `conversation.channel` (el
objeto `inbox` del payload trae solo `{id, name}` — confirmado en la doc y en
`Conversations::EventDataPresenter#webhook_data`). Pero los inboxes de Instagram creados
por el flujo legacy «Instagram via Facebook Login» emiten `Channel::FacebookPage`, no
`Channel::Instagram`: el propio Chatwoot los desambigua con
`instagram? = (facebook? || instagram_direct?) && channel.instagram_id.present?`, y ese
`instagram_id` **no viaja en el webhook**. Matchear solo `Channel::Instagram` pierde los
DMs de todo inbox legacy.

**Cómo quedó.** `lib/chatwoot-canales.ts` (sin `server-only`, para que los tests lo puedan
importar) es la fuente única de qué canal es qué, y el webhook filtra **en positivo** por
`esCanalWhatsapp`: enumerar lo que NO es WhatsApp deja pasar cada canal nuevo de Chatwoot
sin avisar. Los dos valores de Instagram viven ahí escritos en `CANALES_INSTAGRAM` — el
webhook de WhatsApp no los necesita, pero el receptor de Instagram sí, y es donde la
omisión cuesta.

Dos decisiones que conviene no revisar a ciegas:

- **Un payload SIN `channel` se procesa igual.** Chatwoot lo manda desde hace varias
  versiones, pero rechazar por ausencia apagaría los avisos de un self-hosted viejo sin
  ningún síntoma que apunte al webhook. El caso que el guard cierra —un inbox de otro
  canal— SÍ trae `channel`, así que la tolerancia no lo debilita. El canal descartado se
  loguea con su nombre, que es lo que después dice qué falta en la lista.
- **La lista blanca tiene UN solo valor** (`Channel::Whatsapp`). El WhatsApp no oficial va
  por Evolution, que tiene su propio webhook. Si alguna vez un cliente conecta WhatsApp por
  Twilio (`Channel::TwilioSms`), se agrega a mano.

**Y el mismo error, vivo, en otro lado.** `lib/metodo-verificar.ts` buscaba el inbox de
WhatsApp con `(i.channel_type ?? '').includes('whatsapp')` — en minúsculas, contra el nombre
de la clase Ruby, que es `Channel::Whatsapp` con W mayúscula. **Nunca matcheaba**, y se caía
a `inboxes[0]`. Con un solo inbox eso da la respuesta correcta por casualidad, y por eso
nadie lo vio; el día que haya dos, «Probar conexión» le rotula al cliente «Tu bandeja de
WhatsApp» sobre la bandeja equivocada. Es el patrón de AGENTS.md → «un fallback que no cobra
es una degradación silenciosa», acá en forma de `?? inboxes[0]`. Ahora usa el mismo
`esCanalWhatsapp`.

### Son TRES trámites de Meta, no dos — y el tercero es el que nadie planifica

**El diagnóstico obvio era el equivocado.** El research de primera pasada concluyó
«Business Verification + App Review para Advanced Access, y listo». La verificación lo
refutó: falta **Access Verification / Tech Provider**, y la doc de Meta es taxativa —
*«access verification is independent of App Review and permission access levels»*.

- No es exclusivo de WhatsApp (ahí estaba el error de razonamiento): está documentado a
  nivel plataforma desde jun-2022 y la lista de permisos que lo disparan incluye
  `instagram_business_basic` — que es **obligatorio** para mandar un solo DM.
- El modo de falla no es «más lento»: sin Tech Provider *«other businesses»* no pueden
  usar la app. Tenés el código andando y **cero clientes conectables**, con error 100
  («Object with ID … does not exist, cannot be loaded due to missing permissions»).
- Por qué se pasa por alto: la página índice de *Release* de Meta lista App Review y
  Business Verification como pasos de go-live y **no lista** Access Verification, aunque
  la subpágina existe y es terminante.

Lo que sí se confirmó: el App Review es **una sola vez, a nivel app**, por set de
permisos. Ningún cliente final necesita review ni verificación propia — solo autoriza por
OAuth.

⚠️ **Esto rompe el atajo que MaKo usa hoy en Ads.** Hoy cada cliente genera su token en SU
Business Manager con SU app, y por eso no hay App Review (ver memoria
`meta-un-solo-token`). Con DMs no se puede repetir: los webhooks de mensajes se suscriben
**a nivel de app**, no de token.

### Los scopes de Private Replies: la doc de Meta miente por omisión

La página de Private Replies (comentario→DM, que es la razón comercial nº1 por la que
alguien compra automatización de Instagram) lista para Instagram Login **solo**
`instagram_business_basic` + `instagram_business_manage_comments`. Es una lista
incompleta: la private reply se manda por `POST /<IG_ID>/messages`, cuya guía pide
`instagram_business_manage_messages`, y el follow-up dentro de las 24 h lo necesita por
partida doble (para recibir el webhook `messages` y para enviar).

**Pedir los TRES scopes en el OAuth y mandar los tres a App Review.** Diseñar con dos deja
un comment→DM que no puede continuar la conversación y probablemente ni manda el primer
mensaje (error 200 / subcódigo 2534066). Los webhooks `comments`/`live_comments` exigen
Advanced Access explícitamente.

### El tag `HUMAN_AGENT` en Instagram Login no está documentado en ningún lado

Para contestar fuera de la ventana de 24 h (hasta 7 días) hace falta el tag. Tres trampas
verificadas:

- El valor es **`HUMAN_AGENT` en MAYÚSCULAS**. El `human_agent` en minúscula que aparece
  en el Instagram Platform Overview es el nombre de la **feature de App Review**, no el
  valor del enum. Los enums de Graph son case-sensitive: mandarlo en minúscula es error 100.
- El campo `tag` está documentado **solo** para `POST /<PAGE_ID>/messages` en
  `graph.facebook.com`. La doc de Instagram Login lista únicamente `recipient` y `message`,
  y el link «reference» del endpoint va a un índice sin nodo `/messages`. Que `tag` ande en
  `graph.instagram.com` es **inferencia por analogía, no un hecho documentado**.
- Ninguna doc vigente muestra hoy un ejemplo con `messaging_type` + `tag` juntos: la vieja
  página de message-tags devuelve 404. Hay que probarlo contra la API real: primero
  `{recipient, message, tag:"HUMAN_AGENT"}`, y si falla
  `{… messaging_type:"MESSAGE_TAG", tag:"HUMAN_AGENT"}`.

Desde el 27/04/2026 `CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE` y `POST_PURCHASE_UPDATE`
dan error 100. Para Instagram el único tag que queda es `HUMAN_AGENT`.

### La política de bots de Meta choca de frente con «un canal PROPONE, una persona confirma»

No es un bug: es una contradicción entre el producto y la plataforma, y hay que resolverla
**antes** de escribir el Chat Agent de Instagram.

MaKo nunca le contesta solo a un lead — todo va a `wa_borradores` y lo manda un humano con
un clic (regla de AGENTS.md, y regla de riesgo del canal no oficial). La política de Meta
exige que el bot responda a **todo** input del usuario en **≤30 segundos**, que se divulgue
que es automatizado, y castiga con aviso en el Page Support Inbox, 7 días para corregir y
después **restricción de envío a nivel app — para todos los clientes a la vez**. Encima
Meta **prohíbe explícitamente** usar `HUMAN_AGENT` para mensajes automatizados y dice que
detecta el abuso.

Un borrador que espera aprobación humana no responde en 30 segundos.

**En Instagram el default se invierte:** auto-envío inmediato para los escenarios que
`clasificarEscenario` marca como cubiertos (+ disclosure al inicio del hilo), hand-off a
humano solo para el resto, y **cero** envíos fuera de la ventana desde un cron. Y la
ventana de 24 h deja de ser prosa en un prompt para ser un guard determinista en el sender.

### `normalizarTelefono` acepta un IGSID sin chistar

**Vive en:** `lib/leads.ts` (`normalizarTelefono = tel.replace(/\D/g,'')`) y los cuatro
matchers (`buscarLeadPorTelefono`, `matchLeadPorTelefono`, `resolverLeadIdsPorTelefono`,
`buscarLeadsComoPlaceholders`).

Un IGSID es **numérico y de 17 dígitos**: pasa el normalizador sin error, y el matcheo por
`ilike '%últimos 10 dígitos'` puede engancharlo con el teléfono de un lead **real**. Sin
excepción, sin log, sin aviso: dos conversaciones de personas distintas fusionadas en una
ficha. No rompe una feature — corrompe datos, y lo ve el cliente antes que vos.

Cualquier canal cuya identidad no sea un teléfono necesita `lead_identidades(ws, canal,
external_id)` **antes** que el transporte, con un guard que rechace escribir un
identificador no telefónico por el camino del teléfono. Hermano silencioso:
`asistirRespuesta` solo deja borrador `if (sugerida && lead?.telefono)` — sin teléfono,
MaKo redacta, gasta la llamada de IA y **tira la respuesta sin log**.

### El Chatwoot de MaKo es self-hosted, y eso mata el único atajo que existía

`CHATWOOT_BASE_URL=https://mauricio.up.railway.app` (verificado en `.env.local`, 14/08/2026)
— Railway, y encima en la infra personal de Mauricio, mismo patrón que la app de Meta.

Con Chatwoot **Cloud** se usa la app de Meta de Chatwoot y `human_agent` ya viene
habilitado: cero App Review para MaKo y cero para el cliente. Con **self-hosted** el atajo
se evapora y el App Review vuelve, pero ahora con un tercero en el medio:

- Chatwoot pinnea **Graph v22.0 con `locked:true`** — expira el **20/05/2027** (issue
  #13846, sin respuesta desde marzo). La fecha de vencimiento del canal la fija un tercero.
- Solo se suscribe a `messages`, `message_reactions`, `messaging_seen`: **no hay comentarios
  ni private replies**. El comment→DM es imposible por Chatwoot.
- Contactos como `Unknown (IG: <igsid>)`, y el bug abierto #14584 (DMs que llegan de algunos
  usuarios y de otros no).
- En self-hosted las claves de Instagram **no se prenden por env var**: la fila ya existe en
  `installation_configs` con `value` nil/false sembrada por `ConfigLoader`, y
  `first_or_create` devuelve la fila existente sin pisarla. Van por
  `{url}/super_admin/app_config?config=instagram` + el feature flag de cuenta
  `channel_instagram`. Corolario feo: el Super Admin guarda el valor **crudo** del form, así
  que un `"false"` string es truthy para `GlobalConfigService.load` (ventana de 7 días en la
  UI) y `false` para `GlobalConfig.get` (request **sin** el tag) — la UI habilita responder
  y el envío falla.

### ManyChat no es una arquitectura, es una demo

*«Only one business account can be linked to each channel at a time within the same
Manychat account»* + *«you will need to create a separate Manychat account for each»*. El
«unlimited channel connections» de los planes significa un canal **de cada tipo**, no varios
Instagram. 30 clientes = 30 suscripciones (~$870/mes anual en Pro), 30 API keys a mano, sin
descuento por volumen, sin white-label, sin OAuth.

Y el timeout de External Request / Dynamic Block es *«limited to 10 seconds. It cannot be
changed»* — no alcanza para un LLM con tool-use, obliga al patrón asíncrono (ack <10 s +
push por `/fb/sending/sendContent`). El rumor de la excepción para `openai.com` sale de un
moderador de foro que dice «I think, not 100% sure»; lo que sí tiene 120 s es el bloque
**nativo** de ChatGPT, que no es tu endpoint. Sumale que no expone historial de
conversación: MaKo pondría el cerebro y ManyChat se quedaría con el dato y con el contacto.

### Publicación de contenido: los cinco detalles que muerden

**Vive en (lo reusable):** `lib/meta-ads-create.ts` (`uploadAdVideoByUrl` ya publica por
URL firmada en producción), `app/api/creative-upload`.

- **El cupo diario no se hardcodea.** La doc de Meta se contradice consigo misma: 100 en
  «Rate Limit», 50 en las limitaciones de carrusel, `quota_total: 50` «currently» en la
  referencia del endpoint, y no hay changelog que diga cuál quedó viejo. Leer
  `GET /{ig-id}/content_publishing_limit` por cuenta y tratar ese número como la verdad.
  (El 25/día que circula en blogs no figura en ninguna página vigente.)
- **El container expira a las 24 h**: se crea en el momento de publicar, no cuando el
  usuario programa el post. La signed URL se firma al publicar (hoy son 3600 s).
- **No hace falta CDN propio ni bucket público.** Meta hace cURL del archivo: *«it must be on
  a public server»* significa alcanzable en ese instante — una signed URL de Supabase
  alcanza. El resumable upload (`rupload.facebook.com`) sí es exclusivo de Facebook Login for
  Business, pero el flujo por URL funciona en **ambas** configuraciones: construir ese. Lo
  único que se pierde sin rupload es el reintento por offset en archivos grandes.
- **Solo JPEG** en imágenes. `creative-upload` acepta PNG porque Meta Ads lo toma; en IG
  orgánico rebota.
- `getInstagramActorId()` cachea en un `let` module-level: **en un cron multi-tenant
  devuelve el IG del primer workspace a todos los demás.** Mismo patrón que el global
  mutable de `buildPatterns` (ver `hallazgos-ads.md`).

### GOTCHA de investigación: no se puede leer la doc de Meta con WebFetch a secas

`developers.facebook.com` se sirve **geolocalizada en español** y con el contenido dentro
del payload JS. WebFetch resume la traducción y devuelve enums inventados (apareció
`TAGGED_MESSAGE`, que no existe; el enum real es `{RESPONSE, UPDATE, MESSAGE_TAG, UTILITY}`).

**Agregar `.md` a la URL devuelve el markdown fuente en inglés, limpio**
(`…/docs/business-messaging/messenger-platform/send-messages.md`). No funciona en las
páginas de reference autogeneradas: esas hay que bajarlas en HTML y grepear.

### Lo que quedó SIN hacer

- **El link roto de `route.ts:175` sigue en producción** — fix de una línea, no se aplicó en
  esta corrida (era una evaluación de factibilidad, no una implementación).
- **El filtro por canal del webhook tampoco** (`route.ts:102`), con la aceptación de
  `Channel::FacebookPage` legacy.
- **Los dos catálogos declaran envs distintos hoy**: `integraciones-catalogo.ts` lista 3 y
  `metodo-catalogo.ts` lista 4 para Chatwoot. Es exactamente el desfase que produce un
  `credWs` null en silencio; al sumar Instagram hay que tocar los dos con la misma lista.
- **`CHATWOOT_WA_INBOX_ID` tiene default `3`** (el inbox de Mauricio) y
  `Number(inboxRaw ?? '3')` no aplica el `??` sobre un valor no numérico → NaN silencioso.
  Al parametrizar `cfg(inboxKey)` hay que **matar** ese default, no replicarlo.
- **`meta-write.ts` no tiene el candado `assertCuentaDelDueno`** que sí tiene
  `meta-ads-create.ts`, y lee `process.env.META_ACCESS_TOKEN` directo: siempre la cuenta de
  Mauricio, sin error ruidoso.
- **Verificar contra la API real** (no hay forma de saberlo por doc): el formato del body con
  `tag` en `graph.instagram.com`, y el `quota_total` de una cuenta viva.

*Corrida del 14/08/2026 — 21 agentes, 12 verificaciones adversariales (9 refutadas o
matizadas). Evaluación de factibilidad; no se tocó código.*

---

## Zernio: el canal Instagram implementado (y sus trampas)

De la corrida de implementación del 15/08/2026 (7 agentes). Lo construido está en el
commit; acá va solo lo que NO se deduce del código. El canal quedó: webhook →
`lib/ig-chatbot.ts` (borrador del Chat Agent, flag `ig_auto_respuesta` apagado de
nacimiento) → envío con un clic; publicaciones vía `POST /v1/posts` con programación
nativa de Zernio (sin cron propio); tab `/instagram` con onboarding de 3 etapas.

### El spec real de Zernio NO es el del repo GitHub que se llama "openapi-specs"

**El diagnóstico obvio era el equivocado.** `github.com/zernio-dev/openapi-specs` parece
la fuente canónica y es una trampa de nombre: `instagram.yaml` ahí es el spec de la
**Graph API de Meta** (server `graph.instagram.com`, paths `/{user-id}/media`) — el repo
documenta las APIs que Zernio *envuelve*, no la de Zernio. Codear contra eso es codear
contra Meta con otro nombre. Las fuentes reales:

- `https://docs.zernio.com/api/openapi` — OpenAPI 3.1 de la API de Zernio (es YAML aunque
  no tenga extensión), **con la sección `webhooks` y el schema formal de los 49 eventos**.
- `https://docs.zernio.com/llms-full.txt` — la doc completa en un solo archivo (4,1 MB).

### Dos mecanismos de idempotencia DISTINTOS según el endpoint

- Inbox y profiles: header **`Idempotency-Key`** (replay del response original con
  `Idempotent-Replayed: true`; mismo key con body distinto ⇒ 422; en vuelo ⇒ 409; 24 h).
- Posts: header **`x-request-id`**, y el replay devuelve `200 {existingPost}` — un shape
  DISTINTO del `201` tipado, y solo descrito en prosa. Verificar antes de apoyarse.

El envío de borradores usa `Idempotency-Key: ig_borrador_<id>` — un reintento replay-ea
en Zernio en vez de duplicar el DM.

### IG/FB «replayan» hasta 500 conversaciones de ANTES de conectar la cuenta

Al conectar una cuenta, el inbox de Zernio trae hasta 500 conversaciones / 500 mensajes
de historia pre-conexión — sin webhooks y ya leídas. Un sync histórico que las trate como
nuevas dispararía 500 borradores del chatbot y 500 avisos al dueño. El webhook no las ve
(solo llegan por `GET /v1/inbox/conversations`), así que hoy no muerde; muerde el día que
se agregue un poll de backfill.

### `attachments[].url` de Instagram EXPIRA; lo persistible es `refreshUrl`

La `url` de un adjunto IG/FB es CDN de Meta firmada con vencimiento — guardarla es
guardar un link muerto. `refreshUrl` (solo IG/FB) re-mintea la URL y es lo único seguro
de persistir. Corolario en la otra dirección: la URL firmada de la media de un post
programado tiene que sobrevivir **hasta `programado_at`**, no 3600 s — acá se firma con
+7 días de margen sobre la fecha programada.

### Los 2 fixes que dejó la auditoría (el patrón vale para cualquier webhook)

**Vive en:** `app/api/webhooks/zernio/route.ts`

1. **En un evento SALIENTE, el `sender` es el NEGOCIO, no el lead.** El upsert de
   conversación tomaba `message.sender` para igsid/username también en `message.sent` —
   pisaba la identidad del participante con la de la propia cuenta del cliente (y el
   aviso diría «@su_propia_cuenta escribió»). El participante de un saliente sale de
   `conversation.participant*`; y los campos de identidad solo se escriben cuando HAY
   valor, para que un payload parcial no borre con `null` lo ya sabido.
2. **`'x' in OBJETO` matchea la cadena de prototipos** (`'toString' in {}` es `true`): un
   evento basura firmado caía al procesador de posts con `estado = Function`. Para mapas
   literales usados como catálogo: `Object.hasOwn`.

### ESTRUCTURAL — BYOK sin webhook: la key propia deja el canal a medias

El endpoint del webhook valida SOLO el secret de PLATAFORMA. Un cliente con su propia
cuenta de Zernio (BYOK) firma sus eventos con SU secret → 401 → **sus DMs entrantes y
estados de post nunca entran**. No es fuga: es canal muerto para BYOK. Hoy el BYOK de
Zernio sirve para lo SALIENTE (publicar, enviar) y el tiempo real solo funciona con la
key de plataforma. Resolver exige o `credWs('ZERNIO_WEBHOOK_SECRET', ws)` con resolución
de ws PREVIA a la verificación (delicado: hoy la firma se verifica antes de mirar el
payload, que es lo correcto) o documentar que BYOK opera por polling.

**Y el gemelo del secret:** si un cliente pega LA MISMA key de plataforma como "propia",
se lo trata como BYOK y usaría el profile Default de la AGENCIA (mezcla de datos).
CERRADO A MEDIAS 15/08/2026: `guardarZernioKeyAction` (app/instagram/actions.ts) rechaza
la igualdad exacta con `envCred('ZERNIO_API_KEY')` + auditoría + prueba de vida con
rollback. Pero el MISMO guard falta en `app/api/integraciones/credencial/route.ts`: desde
la card de Zernio en /integraciones la key de la agencia todavía entra sin chistar.

### ensureProfile MATERIALIZABA la elección de cuenta con solo ABRIR la tab

**Vive en:** `app/instagram/ig-datos.ts` (`estadoZernioIg`), `app/instagram/actions.ts`, `lib/zernio.ts`

**Síntoma:** el cliente veía «Conectar Instagram» directo, sin que nadie le preguntara si
operaba con la cuenta de la plataforma o con la suya (BYOK). **Causa:** la CONSULTA de
estado escribía: `estadoConexionIg → listAccounts → profileIdEfectivo → ensureProfile`
creaba el profile `mako_ws_<ws>` y la fila en `zernio_workspace` — o sea, tomaba la
decisión de plataforma en silencio, con solo montar la page. `getConnectUrl` tiene el
mismo camino. **Regla:** una lectura de estado no puede pasar por un camino que ESCRIBE;
si la decisión no está resuelta (key BYOK propia o fila en `zernio_workspace`, señales
VIVAS de `estadoZernioIg`), no se toca la API de Zernio y `cuenta` vuelve `null`. El que
rechaza es el SERVER (`conectarInstagramAction`), no el botón escondido. Detalle fino:
para `OWNER_WS` la caída de `credWs` a env NO cuenta como key propia — ese env ES la
cuenta de plataforma. Y `estadoZernioIg` LANZA en error de base: un fallo de infra no se
lee como «sin resolver» ni reabre pasos.

### KEY_PASOS_COMPARTIDOS comparte pasos que NO son la misma configuración

**Vive en:** `lib/tab-onboarding-state.ts`

El registro compartido hace que un paso con la misma key en dos tabs se marque en las dos
a la vez. Está bien cuando ES la misma cosa (`conectar` = la misma cuenta de Instagram en
/instagram, /reels y /stories). Pero los `contexto`/`ensayo` PELADOS de la tab instagram
colisionan con «Tu forma de escribir» y «Ensayo de conversación» del Chat Agent (setting):
terminar el ensayo de una marca el de la otra sin ser la misma configuración. **Regla:
un paso comparte key SOLO si es la MISMA configuración; todo lo demás va namespaced por
tab** (`reels_*`, `carousels_*`, `stories_*`, como hicieron las tres tabs nuevas).
Pendiente: renombrar los pelados de instagram/setting con migración del estado guardado.
Y quedaron DOS criterios conviviendo para el mismo paso: reels/stories comparten
`conectar` (se refleja solo, la tab nunca lo marca) y carousels creó `carousels_instagram`
namespaced que nunca se marca — vale unificar en la compartida.

### Lo que quedó SIN hacer

- **Vincular lead ↔ conversación IG no existe** (ni UI ni backend). Cuando se haga: por
  `lead_identidades(ws, canal, external_id)`, NUNCA por el camino telefónico (el IGSID
  de 17 dígitos pasa `normalizarTelefono` y matchea leads reales — ver arriba).
- **Adjuntos entrantes se listan como texto** en el inbox (`refreshUrl` necesita un proxy
  autenticado para servirse al navegador); `previewMediaAction`/`firmarPreview` quedaron
  exportadas sin call-site: usar o podar.
- El aviso al dueño reusa la clave **`wa-mensaje-entrante`** (2 call-sites en
  `lib/ig-chatbot.ts`) — cambiar cuando el catálogo de avisos gane clave de Instagram.
- `ENSAYO_SYSTEM` hardcodeado en `app/instagram/actions.ts` con TODO «mover a
  prompt-registry» (archivo tomado por sesión paralela el 15/08).
- Las keys restringidas de Zernio (`zrk_`) sin el resource group `messages` dan **403 en
  todo el inbox** — la prueba de vida del onboarding valida con `GET /v1/profiles`, que
  no lo detecta.
- `descartarBorradorDmAction` BORRA la fila; si se quiere rastro, va migración que sume
  `'descartado'` al CHECK de `ig_mensajes`.
- `message.sent` puede traer un id distinto al `messageId` del send → posible fila
  saliente duplicada (hoy se mitiga matcheando por texto exacto); verificar con payloads
  reales.
- Señal de conexión real para crons: `integracionConectada('zernio')` solo da true con
  key propia; falta un `estadoZernio` que mire `zernio_workspace` + cuenta IG conectada.
  (Para la TAB ya existe `estadoZernioIg` en `app/instagram/ig-datos.ts`, 15/08.)
- El guard anti key-de-plataforma vive SOLO en `guardarZernioKeyAction`: falta replicarlo
  en `app/api/integraciones/credencial/route.ts` (la card de Zernio en /integraciones
  todavía acepta la key de la agencia como BYOK).
- No hay ping de Zernio en `lib/metodo-verificar.ts` (PINGS): el tilde de la card de
  /integraciones guarda la key SIN probarla (`verificarServicio('zernio')` devuelve
  «servicio inválido»). Va un `GET /v1/profiles`.

*Corrida del 15/08/2026 — 7 agentes (2 recon, 3 build, integrador, auditoría).
Typecheck limpio, build OK, 915/915 tests. La migración 0136 y el alta del webhook las
hizo el orquestador al cierre.*

## Los writers de contenido IG (Reels / Carousels / Stories)

Corrida del 15/08/2026 (fix del onboarding de /instagram + base + 3 tabs + integrador).
El motor es `lib/ig-writer.ts` (`generarPieza`, saneo por formato) sobre
`lib/ig-formatos.ts` (límites técnicos + metodología de los cursos) y el puente a
`contenido_posts` es `lib/ig-contenido.ts` (`crearBorradorPublicacion`, camino borrador
sin tocar Zernio).

### La doctrina de caption y hashtags es NEGATIVA, y eso también es un dato

**Vive en:** `lib/ig-formatos.ts` (`METODOLOGIA_TRANSVERSAL`)

Ningún curso de la casa enseña caption ni hashtags como palanca: la palanca es el gancho.
La «regla de los 125 caracteres» es el corte de UI de Instagram (dónde trunca el feed),
no doctrina. El módulo lo dice honesto en vez de inventar metodología, y las UIs de las
tabs lo repiten (sin hashtags a propósito, con el porqué en pantalla). Si alguien pide
«mejorar los hashtags», la respuesta correcta es que no hay doctrina positiva que aplicar.

### Historial de un writer sin tabla genérica: app_settings con tope chico, nunca la tabla de otro feature

**Vive en:** `app/reels/reels-datos.ts` (`reels.historial`), `app/carousels/CarouselsApp.tsx`, `app/stories/StoriesApp.tsx`

No existe tabla genérica de piezas generadas (`landing_drafts` es del Landing Generator;
`contenido_posts` guarda solo lo enviado a publicación). Reels persiste en `app_settings`
(tope 10, read-modify-write sin lock, anotado); carousels y stories viven en memoria de
la sesión de página y lo DICEN en pantalla. Si el producto quiere historial durable o
cross-formato, es UNA tabla con migración coordinada entre corridas — no subir topes ni
colonizar la tabla de otro.

### Las notas de producción viajan ANEXADAS a la caption, y el total puede superar 2.200

**Vive en:** `lib/ig-contenido.ts`

`contenido_posts` (mig 0136) no tiene columna para el guion/notas del writer: aceptarlas y
tirarlas era pérdida silenciosa, así que van anexadas a la caption con rótulo visible
(«NOTAS DE PRODUCCIÓN — borra este bloque antes de publicar»). Consecuencia asumida: el
borrador puede superar los 2.200; el tope lo aplica Instagram/Zernio al publicar en
/instagram, no la base. Y `crearBorradorPublicacion` NO es idempotente (doble click = dos
borradores); reels lo mitiga guardando `borradorId` por entrada del historial, las otras
dos tabs solo deshabilitan el botón.

### El objetivo del día viaja DENTRO del pedido no confiable, porque el motor no tiene canal de instrucciones

**Vive en:** `app/stories/objetivos.ts`, `lib/ig-writer.ts`

`generarPieza(ws, formato, pedido)` no tiene parámetro de directivas: todo lo que no es
el system entra como contenido no confiable (anti-inyección), incluido el objetivo del
día de stories. La verificación va en las dos capas: el texto lo pide y
`generarSecuenciaAction` lo valida determinista (venta/interacción sin CTA ni palabra
clave → rechazo con motivo, nunca un frame inventado). Si aparece un tercer caso así,
vale agregarle `directivas` al motor en vez de seguir coloreando el pedido. Ojo además:
`generarPieza` corta el pedido a 4.000 caracteres EN SILENCIO — los composers de las tabs
topean por campo por eso (`app/reels/reel-pedido.ts`).

### Decisión de capas: las tres tabs las ve solo 'completo'

**Vive en:** `lib/capas.ts`, `app/_components/nav.ts`

Las keys `reels`/`carousels`/`stories` de nav.ts no están en ningún `navKeys`: las ve la
capa `completo` (navKeys null = ve todo), que es la de Content Machine y la default de
los clientes. `pm` no las compró y `superadmin` no corre contenido de cliente — a
propósito, no hizo falta tocar `lib/capas.ts`. Si mañana se venden sueltas, es agregar
las 3 keys a los navKeys de la capa que corresponda.

### Lo que quedó SIN hacer

- Los prompts del writer son constantes locales en `lib/ig-writer.ts` con TODO «mover a
  prompt-registry» (archivo tomado por sesión paralela 15/08): hoy NO son editables desde
  /configuraciones. Migrarlos con la skill `add-editable-prompt` al liberarse.
- Unificar el criterio del paso «cuenta de Instagram» en `lib/tab-onboarding-state.ts`:
  reels/stories comparten `conectar` (se refleja solo), carousels creó
  `carousels_instagram` que nunca se marca — que las tres usen la compartida.
- Renombrar los `contexto`/`ensayo` PELADOS de instagram y setting a keys namespaced,
  con migración del estado guardado (la colisión de KEY_PASOS_COMPARTIDOS, ver arriba).
- El clamp de duración del reel recorta la CIFRA a 90 s en silencio (el guion queda
  entero): la UI debería decir que se recortó.
- El saneo de story no topea frames; `enviarSecuenciaAction` corta en 50 borradores EN
  SILENCIO (el aviso de parciales solo aparece si un insert FALLA).
- Deep-link de vuelta: los borradores mandan a /instagram entero, sin ancla por post
  (`?post=`); `enviarSecuenciaAction` ya devuelve href, es un cambio de una línea cuando
  la tab Instagram sume el ancla.

*Corrida del 15/08/2026 — fix onboarding + base (formatos/writer/contenido) + 3 tabs +
integrador. Typecheck 0 errores, build OK (las 3 rutas), 915/915 tests.*

---

## MaKo le dijo cuatro veces a un cliente que su cuenta estaba caída. Estaba Activa

**Vive en:** `lib/alerta-critica.ts` · `lib/alerta-critica-texto.ts` ·
`lib/meta-health-history.ts` · `lib/meta-cuenta-id.ts` ·
`app/api/integraciones/credencial/route.ts` · `supabase/migrations/0139_service_incidents_confirmado.sql`

El 21/08/2026 el workspace 13 (`Codigo Inmobiliario`) recibió cuatro WhatsApps de MaKo, a
las 21:15, 22:30, 23:31 y 00:40, con este texto:

> 🚨⚠️ **3 H 25 MIN SIN ENTREGAR** ⚠️🚨
> ⛔ Tu cuenta publicitaria está **NO SE PUDO LEER EL ESTADO DE META**.
> 🔁 Es la **4ª vez** que te aviso y sigue igual.
> 💸 Seguís sin recibir un solo lead.

Su cuenta publicitaria estaba `account_status: 1` — **Activa**, `disable_reason: 0`, sin
deuda, entregando. Las tres afirmaciones del mensaje eran falsas y la del medio ni siquiera
era una oración.

### La cadena: cinco eslabones, y cada uno bastaba para cortarla

1. **La credencial se guardó con la forma equivocada.** Meta devuelve la misma cuenta con
   dos nombres en la MISMA respuesta de `/me/adaccounts` — `id: "act_1357728489423123"` y
   `account_id: "1357728489423123"` —; todo el repo consume la primera y Business Manager
   le muestra al cliente la segunda, que es la que tiene a mano para copiar. Pegó el id
   pelado. `GET /v24.0/1357728489423123` → **400 «Object with ID does not exist»**.

   **Lo que lo hizo invisible es la parte que hay que recordar: la verificación
   normalizaba y el guardado no.** El ping de `metodo-verificar.ts` hacía
   `startsWith('act_') ? … : act_…` antes de pegarle a la API, así que el botón de
   verificar daba **verde** sobre un valor que nunca se almacenó. El alta automática
   (`route.ts:319`) también normalizaba. El guardado manual normalizaba `CLARITY_PROJECT_ID`
   y nada más — con el comentario que describe exactamente este bug **pegado arriba**,
   escrito sobre la otra credencial: *«verificar una cosa y guardar otra es cómo se llega a
   una credencial que pasó la prueba y no funciona»*. La regla estaba escrita y le faltaba
   este campo. Eran cuatro copias del mismo ternario y la que importaba no existía.

2. **«No pude leer» se registró como `severidad: 'rojo'`.** `problemaMeta(null, metaError)`
   abría un incidente rojo con `statusLabel: 'No se pudo leer el estado de Meta'`. Es la
   regla de AGENTS.md «"No puedo hacer X con este dato" no es "este dato es falso"»,
   cobrada en la pantalla de un cliente: un error de lectura NUESTRO se guardó como un
   estado de SU cuenta.

3. **`esCritico()` no podía distinguirlos.** `entrega_frenada || severidad === 'rojo'` —
   nada exigía que Meta hubiera contestado. Un rojo nacido de una ignorancia entra igual
   que una cuenta suspendida de verdad, y la alerta crítica está hecha, a propósito, para
   **no parar nunca**: cada hora hasta que se resuelva.

4. **`causaDe()` interpoló un mensaje de error en una ranura de estado.** El default
   `Tu cuenta publicitaria está *${estado.toUpperCase()}*` estaba pensado para un
   `account_status` que Meta agregue y acá no esté mapeado, y **asumía un TIPO que el dato
   no siempre tiene**. Cualquier string que caiga ahí sale afirmado con la gramática de la
   frase prestándole autoridad.

5. **El mensaje afirmaba en cuatro lugares y la regla estaba aplicada en uno.** El módulo
   tiene escrito, textual: *«"No corre un solo anuncio" es un HECHO verificado
   (entrega_frenada), no una forma de decir. Si Meta no lo confirma, no se afirma»* — y
   colgaba de `entregaFrenada` **solo la línea de al lado**. El titular del contador
   («X SIN ENTREGAR»), «Seguís sin recibir un solo lead», «No entra *ningún* lead nuevo» y
   la escalada de las 6 h salían siempre. **Una regla que se cumple en un lugar y en los
   otros tres no, no está implementada: está documentada.**

### Y el disparador no fue el cron: fue un RENDER

`reconciliarIncidentes` tiene dos call-sites y el que abrió el incidente es
`app/integraciones/page.tsx:47` — **abrir la pantalla escribe en la base**. El cron
(`registrarEstadoMeta`) pasa `metaError = null` y por ese camino el incidente de lectura
fallida no puede nacer. O sea: alguien abrió `/integraciones` del cliente a las 00:14:51 UTC
y eso arrancó una persecución de una hora de cadencia que ya no dependía de nadie.

Cuando busques quién abrió un incidente, **mirá los renders además de los crons**. Un cron
se audita solo (corre siempre, deja log); una escritura colgada de un render depende de que
alguien haya mirado, así que no hay ningún registro de por qué empezó ese día y no otro.

### Qué quedó

- **Migración 0139**: `service_incidents.confirmado`. `TRUE` = el servicio contestó y este
  es su estado (un hecho). `FALSE` = no se pudo leer (una ignorancia): **se muestra en el
  historial y nunca dispara la persecución por WhatsApp.** Es una COLUMNA y no una
  convención sobre el texto de `status_label` para que el guard se pueda escribir en
  positivo en vez de adivinar si una cadena parece un estado.
- `esCritico()` = `confirmado && (entrega_frenada || severidad === 'rojo')`. **En positivo**
  — descartar el `statusLabel` que hoy sabemos que salió mal protege este caso y deja pasar
  los que todavía no pasaron: el próximo error de lectura dirá otra cosa.
- `lib/meta-cuenta-id.ts`: `normalizarCuentaMeta()`, el único lugar donde vive la forma de
  `META_AD_ACCOUNT_ID`, usado por los cuatro caminos. Toca solo dígitos pelados; lo que no
  entiende **vuelve intacto** para que falle a la vista en la verificación en vez de
  desaparecer en el saneo.
- `getIncidentes` lee `r.confirmado !== false` y **no** `!!r.confirmado`: con la migración
  sin aplicar la columna no viene, y degradar a «no confirmado» apagaría la alerta REAL —
  el bug de 8/2026 al revés y peor, porque una cuenta suspendida de verdad dejaría de
  avisar.

### Lo que quedó SIN hacer

- **`integracionConectada('meta')` mide que EXISTAN las filas de credenciales, no que la
  conexión ande** (`lib/credenciales.ts:197`). ws13 daba `true` con una cuenta ilegible, y
  por eso entraba en el loop del cron. Es «estado vivo, no recordado» sin resolver: no hay
  ningún lado donde se guarde el resultado de la última verificación, así que nadie puede
  distinguir «lo configuró» de «funciona». Vive en `lib/credenciales.ts` +
  `lib/metodo-verificar.ts`.
- **La escritura de incidentes colgada del render** sigue en `app/integraciones/page.tsx:47`.
  Se dejó porque también es la que CIERRA los incidentes al recuperarse, y sacarla sin
  mover ese cierre al cron dejaría incidentes colgados para siempre.
- **Nadie le avisó al cliente que la alerta era falsa.** El motor sabe decir «ya está
  entregando» (`textoRecuperada`) pero no sabe decir «lo que te dije no era cierto». Un
  canal que insiste necesita las dos contracaras, y hoy tiene una.

*Corrida del 21/08/2026 — incidente #101 cerrado a mano en prod, credencial de ws13
corregida a `act_…`, mig 0139 aplicada. Typecheck 0 errores, 1030/1030 tests.*

---

## La mitad in-app de TODOS los avisos de MaKo nunca existió en producción

**Vive en:** `lib/notificaciones.ts` · `lib/avisos.ts` ·
`supabase/migrations/0048_notificaciones.sql` · `scripts/check-migrations.mjs`

Encontrado el 21/08/2026 revisando el resto de los avisos después de la alerta falsa de
Meta. **La tabla `notificaciones` no existe en la base de producción.** 77 tablas en
`public`, ninguna es esa, y no hay sustituto — no fue renombrada, nunca se creó: la
migración `0048_notificaciones.sql` jamás se aplicó.

Consecuencias, todas silenciosas:

- `emitirAviso()` es, por diseño, «feed in-app + WhatsApp». **Solo funcionó la mitad de
  WhatsApp**, desde el día uno y para los 59 avisos del catálogo.
- **La campanita del sidebar está vacía y siempre lo estuvo.** `listNotificaciones()` lee
  la misma tabla.
- `crearNotificacion()` hace `catch → console.error → return null`, y `emitirAviso`
  devuelve `{ ok: true, feedId: null }`. **Nada río arriba se entera**: el `ok: true` es
  cierto respecto de lo que salió por WhatsApp y falso respecto de lo que se prometió.

**Por qué importa para la alerta falsa de al lado:** el único rastro de los cuatro
mensajes que recibió el cliente fue su propio WhatsApp. No había ninguna pantalla donde
mirar qué se le había mandado, ni cuándo, ni por qué — el registro durable que la 0048
venía a dar es exactamente lo que hacía falta para diagnosticarlo. **Un aviso es un
EVENTO; una bandeja es un ESTADO**, y acá se perdió el estado de todos los avisos.

**Y lo que lo mantuvo invisible tres meses:** `scripts/check-migrations.mjs` —el script que
existe precisamente para cazar esto— tiene la lista de migraciones **hardcodeada hasta la
0022**, con el repo en la 0139. Reporta prolijamente 22 de 139 y da una sensación de
cobertura que no tiene. Es un indicador que afirma la mitad verdadera: todo lo que mira
está bien, y no mira el 84%.

### Lo que quedó SIN hacer

- **Aplicar la 0048** (`node scripts/apply-migration.mjs supabase/migrations/0048_notificaciones.sql`).
  NO se aplicó en esta corrida a propósito: enciende la campanita para todos los clientes de
  golpe, que es un cambio visible de producto y no una urgencia. Es aditivo y seguro de
  re-ejecutar.
- **Que `check-migrations.mjs` lea el directorio** en vez de una lista a mano, y contraste
  contra el esquema. Mientras siga en 0022, la próxima migración olvidada tampoco se ve.
- **Que `emitirAviso` no devuelva `ok: true` con `feedId: null`** cuando el feed era parte
  del contrato. Hoy el éxito parcial se reporta como éxito.

*Hallazgo del 21/08/2026, sin arreglar: el diagnóstico está completo, la decisión de
encender el feed es de producto.*

---

## «Le di a enviar y no pasó nada, ni siquiera un mensaje de error»

**Vive en:** `app/perfil/DestinatariosModal.tsx` · `app/_components/TelefonoConPais.tsx` ·
`lib/mako-grupo.ts` · `lib/notif-destinatarios.ts` · `lib/paises.ts`

Reportado el 21/08/2026: el cliente de Codigo Inmobiliario no podía sumar a nadie al grupo
de MaKo desde Configuraciones › Notificaciones. Tenía razón en las dos mitades — no se
podía, y no se enteraba. **Cinco caminos de rechazo, los cinco mudos.**

### 1. `agregarParticipanteGrupo` informaba un éxito que no ocurría

La más cara, y la que explica la frase exacta del reporte. Medido contra la API real
pidiendo agregar un número inexistente:

```
HTTP 200
{ "updateParticipants": [ { "status": "403", "jid": "…", "attrs": { "addressable": "false" } } ] }
```

**Evolution contesta 200 con el fallo adentro del body**, exactamente como Meta (la regla ya
estaba en AGENTS.md, para el otro proveedor). El código hacía `return r.ok ? { ok: true } : …`
→ devolvía éxito. No había ningún error que mostrar porque **el sistema creía que había
funcionado**. Cuando el síntoma es «no pasa absolutamente nada», sospechá de un éxito
falso antes que de un error tragado: un error tragado al menos deja un log.

### 2. Y encima el resultado se descartaba dos veces

`for (const t of …) await agregarParticipanteGrupo(ws, t).catch(() => {})` — el `.catch`
vacío se comía la excepción **y** el `{ ok: false, error }` ni se miraba. Las dos mitades
del mismo error. Sumar al grupo es lo que la pantalla PROMETE («el resto se suma a ese
mismo grupo»), así que su fallo va donde el usuario mira, no a un log.

### 3. El teléfono se pedía sin selector de país

Medido, y es toda la historia en dos líneas:

```
542233550684 → exists: true          2233550684 → exists: false
```

El MISMO teléfono sin la lada **no existe** en WhatsApp. El onboarding ya tenía el selector
con banderas; esta pantalla pedía el número con un input pelado y un placeholder, delegando
en el usuario una regla que el sistema conoce mejor que él. La validación (`>= 8 dígitos`)
lo aceptaba sin protestar.

### 4. Lo escrito y no «Agregado» se perdía entero

Escribir el número y tocar **Guardar** directo —sin tocar «Agregar»— dejaba la lista sin
cambios, con lo cual el botón Guardar estaba **deshabilitado por `!dirty`** y no respondía
ni explicaba. Es la hipótesis que mejor calza con el reporte, y no hace falta elegir entre
las cinco: todas se arreglaron.

### 5. Los descartes silenciosos del saneo

`normalizarDestinatarios` tira lo que tiene menos de 8 dígitos y deduplica, las dos cosas
sin decir nada. La persona agrega a alguien, la lista no cambia, y no sabe si funcionó.

### La regla que queda

**Un botón deshabilitado que no explica es indistinguible de uno roto.** Ahora «Agregar»
nunca se apaga: contesta siempre, y cuando no puede dice por qué (vacío / incompleto / ya
está). «Guardar» solo se apaga mientras guarda. Y si la lista se guardó pero alguien no
entró al grupo, **el modal no se cierra**: cerrarlo sería volver a decir «listo» sobre algo
que no pasó.

### Dos gotchas del camino

- **El menú del `Dropdown` se portalea a `document.body` con `zIndex: 1000`, y un modal de
  esta app está en `3000`.** Sin pasarle `portalTo` con el nodo del modal, el desplegable de
  países se abre POR DETRÁS — desde afuera, idéntico a un selector que no responde. Es
  `position: fixed`, así que el `overflow` del modal no lo recorta.
- **`splitTelefono` comparaba con el `+` puesto** (`t.startsWith('+54')`) y todo lo que este
  repo GUARDA son dígitos pelados (`542233550684`): no matcheaba ninguna lada de un número ya
  guardado y caía siempre al país por default, con el `54` adentro del "resto". Vivía suelto
  en `OnboardingWizard.tsx`; se movió a `lib/paises.ts` (sin `server-only`, testeable) y ahora
  lo comparten el wizard y el modal.
- **Estados Unidos y Canadá comparten `+1`**, y el `PAISES.map` daba dos opciones con la
  misma `value` → React tiraba «Encountered two children with the same key» (venía de antes,
  en el onboarding) y con claves repetidas puede omitir o duplicar renglones. Se funden en un
  renglón que nombra a los dos.

### Lo que quedó SIN hacer

- **`telefonoValido` sigue siendo «8 dígitos o más»** (`lib/notif-catalogo.ts`). Con el
  selector el número siempre lleva lada, pero la función sola no lo garantiza: cualquier
  otro call-site que la use sigue pudiendo aceptar un número inservible.
- **La verificación real (`numeroTieneWhatsApp`) corre solo al sumar al GRUPO**, no al
  agregar a la lista. Alguien puede quedar guardado como destinatario de reportes con un
  número que no existe; se entera recién al guardar.
- **Nadie revisó los otros usos de `normalizarDestinatarios`**: sigue descartando en
  silencio para quien no pase por este modal.

*Corrida del 21/08/2026 — verificado en navegador (Playwright, los 5 caminos + cero errores
de consola). Typecheck 0 errores, 1163/1163 tests.*

### Segunda vuelta (24/08): el arreglo tenía adentro el mismo error que arreglaba

El dueño probó lo de arriba y saltaron dos cosas. La segunda duele porque es, exactamente,
la falla que esta misma corrida vino a cerrar — cometida al escribir el arreglo.

**1. `whatsappNumbers` NORMALIZA, y el resultado se tiraba.** Medido: las tres formas del
mismo teléfono resuelven al MISMO jid.

```
5402233550684 ┐
 542233550684 ├──→  5492233550684@s.whatsapp.net   exists: true
5492233550684 ┘
```

La consulta le saca el `0` de tránsito y le pone el `9` de móvil argentino. **`updateParticipant`
NO normaliza**: con el crudo `5402233550684` contesta **HTTP 400**. O sea que el chequeo ya
sabía cuál era el número bueno y se descartaba, para después actuar con el que la persona
había tipeado. Es **el mismo bug que el prefijo `act_` de Meta**, del mismo día, en otro
proveedor: *verificar con una forma y actuar con otra*. La regla generaliza — **cuando una
API te devuelve el identificador canónico de algo, ese es el que se usa y el que se guarda**;
si lo tirás, ya tenés dos formas del mismo dato conviviendo.

Se guardaba el crudo, así que el número roto quedó en la base (`notif_telefonos`,
`user_telefono`, `mako.numero_dueno`) y la pantalla mostraba `+54 02233550684`. **Un dato que
entra torcido sale torcido en toda pantalla que lo lea después.**

**2. Se afirmó un envío que no ocurrió.** El 403 de `updateParticipant` trae adentro un
`add_request` con un código. Se leyó como «WhatsApp mandó la invitación» y el mensaje al
cliente decía «Le llegó una invitación para entrar al grupo». **No se había mandado nada:**
`add_request` es un token que WhatsApp ofrece, y el envío real es otro endpoint
(`/group/sendInvite`) que nadie llamaba. El dueño lo cazó al toque: *«dice que MaKo le envió
algo, y no envió nada»*.

Es la regla de `AGENTS.md` («un mensaje que sale solo no puede AFIRMAR lo que no verificó»)
violada por el commit que la escribió. **Leer un campo en una respuesta no es haber hecho la
acción que ese campo sugiere.** El 403 dice UNA cosa —esa persona restringió quién puede
sumarla a grupos— y nada sobre invitaciones.

**Y la pregunta del dueño que ordenó el arreglo:** *«no entiendo cómo podemos crear grupos con
personas pero luego no podemos invitar a nuevas»*. La respuesta es que **sí se puede**, solo
que por otro camino: `addressable: false` es la configuración de privacidad de esa persona y
no se puede saltear, pero el **link de invitación del grupo** (`/group/inviteCode`) funciona
siempre. Ahora, cuando el alta directa falla, se manda la invitación de verdad y además se
muestra el link en la pantalla para pasarlo a mano. Que WhatsApp diga que no a un camino no
puede dejar al usuario trabado.

*Segunda vuelta del 24/08/2026 — número de ws13 corregido en prod a su forma canónica.
Typecheck 0 errores, 1170/1170 tests. **Sin verificar:** que `sendInvite` entregue de verdad
el mensaje (requiere mandar un WhatsApp real; el código solo afirma el envío si la API lo
acepta, y siempre ofrece el link como salida).*

---

## «OPA» → «No pude armar el borrador con eso»: tres bugs encadenados

**Vive en:** `lib/mako-intencion.ts` · `lib/mako-doer-in.ts` · `lib/respuesta-doer.ts` ·
`lib/veto-claude.ts`

El 24/08/2026 el cliente de Codigo Inmobiliario estrenó su grupo de MaKo. Escribió `OPA` y
recibió *«No pude armar el borrador con eso»*. Más tarde preguntó cuál era su oferta y
recibió lo mismo. El dueño lo reportó como «MaKo cree que todo hay que subirlo al plan» —
lectura razonable, porque **eso es exactamente lo que el mensaje dice**. La causa real era
otra, y el mensaje mandó a diagnosticar el lugar equivocado.

### 1. La escalada a Claude es una puerta tapiada

`lib/mako-doer-in.ts` escala a Claude cuando ninguna IA barata arma el borrador. Pero
`mako-doer-in` **no está en `CLAUDE_PERMITIDO`** (`lib/veto-claude.ts`) y el veto vive en el
`fetch`: la llamada tira **siempre**. Dos sistemas correctos —la escalada, escrita para no
perder el trabajo del cliente; el veto, escrito para no pagar de más— que se contradicen, y
ninguno de los dos sabe del otro.

Medido en `anthropic_usage`: **8 vetos de `mako-doer-in` entre el 17/8 y el 24/8**, cada uno
terminando en un «no pude» para un cliente. Ninguno visible en ningún lado. La forma de la
falla: `catch (e3) { console.error(...) }` → `respuesta` queda vacía → `throw` → el `catch`
de arriba escribe el mensaje genérico.

**La regla:** cuando un camino de código depende de un PERMISO, hay que preguntar por el
permiso, no descubrirlo con una excepción. `evaluarPermiso` es puro y síncrono — preguntar
cuesta cero y convierte una excepción garantizada en un estado con nombre.

Y el centinela: `tests/respuesta-doer.test.ts` afirma que `mako-doer-in` **NO** está
autorizado. Si algún día se autoriza, ese test falla y obliga a mirar la escalada. Las dos
cosas se mueven juntas o vuelven a divergir.

### 2. El error genérico se presentaba como un error específico

`AVISO_NO_PUDE` («No pude armar el borrador con eso») era la respuesta del `catch` genérico
que atrapa CUALQUIER caída del modelo. Para un saludo o una pregunta sobre la oferta, es
falso — y peor que falso: **manda a buscar el problema donde no está.** El dueño estuvo
mirando el ruteo del plan, que no tenía nada roto.

**La regla: el mensaje de error describe lo que falló, no la ruta que el código tenía más a
mano.** Hoy son dos (`avisoNoPude(eraDePlan)`).

### 3. Una adivinanza obligaba a llamar la herramienta

El clasificador tiene un default explícito y bien pensado: ante la duda, `capturar`, porque
«anotar de más cuesta un click y contestar de más PIERDE EL MATERIAL». Correcto. Lo que no
está bien es que `capturar` trae `forzarTool: true`, así que a un mensaje que **no se pudo
clasificar** se le exigía al modelo llamar `proponer_tareas_plan` sí o sí. Con `OPA` (tres
letras) el pedido era parir una tarea de la nada.

**`dudosa: true` significa «no sé». Forzar sobre un «no sé» es hacer la suposición MÁS
fuerte que la certeza** — «el fallback es más débil que el camino feliz, nunca más fuerte»
(AGENTS.md), dado vuelta. Ahora `forzarTool` exige `!intencion.dudosa`.

Y la razón por la que `OPA` llegó al default: **la regla de saludo ya existía** (paso 3 del
clasificador, con tope de 80 chars y sin links) y solo le faltaban las aperturas
rioplatenses («opa», «che», «ola») y las palabras con las que alguien PRUEBA un canal nuevo
(«test», «prueba», «probando», «ping»). Se amplió esa regla en vez de escribir otra al lado.

⚠️ **El umbral está medido, no elegido a ojo.** La captura legítima más corta de toda la
base son **69 caracteres** («Investigar: <link> Sobre todo sus ads»); todo lo más corto que
sí era material —pregunta, confirmación, contacto, adjunto— ya lo agarra una regla anterior.

### Y la pregunta de fondo: ¿MaKo en WhatsApp ve TODA la info?

Medido generando el system prompt real de ws13 (7.060 chars, ~1.765 tokens):

| | |
|---|---|
| ✅ Oferta | completa: nombre, ticket, promesa, entregables, garantía |
| ✅ Funnel | `Lead (Instant form) → Agenda R1 → Ganado` + nutriciones + descartados |
| ✅ Fase del negocio, perfil, avatar (texto), tabs sin configurar | |
| ⚠️ **La cara de marca** | LA TENÍA CARGADA y no llegaba al prompt — ver la corrección de abajo |
| ⚠️ RAG (`TU METODOLOGÍA`) y experimentos | VACÍOS para este workspace |

O sea: **la oferta y el funnel los tenía desde siempre.** No contestó porque la llamada
nunca llegó al modelo. Cuando MaKo diga «no tengo ese dato», antes de sumar contexto hay que
verificar que la llamada haya ocurrido — el contexto faltante y la llamada caída se ven
exactamente igual desde afuera.

### Lo que quedó SIN hacer

- **ws13 tiene UNA sola key de IA** (`GEMINI_API_KEY`). La cascada es
  `[gemini, groq, cerebras, mistral, openai]` y los otros cuatro no tienen key: si Gemini
  falla un segundo, fallan los cinco y no hay red. **Cero redundancia para cualquier cliente
  con una sola key.** Vive en `lib/ia-keys.ts` + el onboarding de IA.
- **Decidir si `mako-doer-in` se autoriza a pagar Claude.** Hoy la escalada está apagada por
  el veto: cuando las gratis fallan, el cliente recibe un «no pude» en vez de una respuesta.
  Es una decisión de plata del dueño, no de código.
- ~~Las imágenes del cliente no son accesibles desde WhatsApp.~~ **CORREGIDO el mismo día,
  ver la entrada siguiente: la descripción SÍ existía y ahora va en el contexto.**
- **El aviso de que MaKo falló no le llega a nadie.** 8 veces en una semana y se supo por un
  cliente. Un fallo de MaKo debería avisarle al SuperAdmin, no al cliente.

*Corrida del 24/08/2026 — clasificación verificada contra los 4 mensajes reales del cliente;
prompt de contexto medido sobre ws13. Typecheck 0 errores, 1176/1176 tests.*


---

## CORRECCIÓN: «MaKo no puede describirte» era falso, y el error fue de método

**Vive en:** `lib/persona.ts` · `lib/mako-context.ts`

En la entrada de arriba escribí que MaKo no tenía acceso a las imágenes del cliente y que
por eso no podía describirlo. **Era falso.** El dueño lo corrigió mostrando la pantalla:
`/onboarding › Persona` tenía **5 fotos y 1.166 caracteres** de descripción hecha por MaKo,
con ocho secciones — `IDENTIDAD · ROSTRO · OJOS · CABELLO · COMPLEXIÓN · MARCAS
DISTINTIVAS · VESTIMENTA · ACTITUD`— al detalle de «ojos avellana claro», «1,78 m» y una
curita en el puente nasal.

### Cómo me equivoqué (importa más que el bug)

Medí el system prompt buscando las palabras que YO esperaba —`avatar`, `imagen`, `foto`— y
al no encontrarlas concluí «no tiene acceso». **Buscar la ausencia de los términos que uno
imagina no es medir: es confirmar la propia hipótesis.** La pregunta correcta no era «¿está
la palabra foto en el prompt?» sino «¿qué hay cargado en el producto sobre esto?», y esa se
contesta abriendo la pantalla o la tabla, no grepeando el prompt.

Y hubo una trampa que lo facilitó: **en este repo conviven DOS «personas».**

| | |
|---|---|
| `getActivePersona()` — `lib/mako-prompts.ts` | la **VOZ** de MaKo. Ya iba en todos los prompts. |
| `getPersona()` — `lib/persona.ts` | la **CARA DE MARCA** del cliente: sus fotos y su descripción física. |

Ver la primera en `buildSystemPrompt` hacía parecer que la persona ya estaba cubierta. Dos
cosas distintas con el mismo nombre a tres archivos de distancia.

### El hallazgo de fondo, más grande que WhatsApp

`getPersona()` tenía **dos consumidores**: el grafo del cerebro (`lib/cerebro-grafo.ts`) y su
propia ruta de onboarding. **Ninguna IA la leía.** La tab dice, textual, «Subí fotos de la
persona que aparece en tus creativos y describí su estilo» — y ningún generador de
creativos la usaba. Un dato que se le pide al cliente, que se procesa con IA para redactarlo,
y que muere en `app_settings`.

**La regla que queda: cuando una pantalla le PIDE un dato al usuario, alguien río abajo lo
tiene que consumir — y eso se verifica grepeando el getter, no leyendo la pantalla.** Un
campo huérfano no da error: da trabajo al cliente y silencio después.

### Qué se hizo

`resumenCaraDeMarca()` en `lib/persona.ts`, enchufado a `buildSystemPrompt` — o sea que lo
ve MaKo en TODOS lados (WhatsApp, chat, writers), no solo donde se reportó. Condicional: ws13
pasó de 7.060 a 8.428 chars y ws9, sin persona cargada, quedó igual.

El encabezado aclara que la cara de marca **casi siempre es el dueño pero eso no está
confirmado**, para no inventar un dato que nadie cargó — la misma disciplina que faltó en los
avisos falsos de Meta de esta semana.

**Verificado con la pregunta textual del cliente** (Groq, porque Gemini estaba caído):
contestó la oferta exacta, el funnel VSL con su estructura, y la descripción física completa.

⚠️ **Y la verificación dejó una demostración en vivo del punto anterior:** las CUATRO keys de
Gemini contestaron 429/503 mientras corría la prueba. ws13 tiene una sola key: cuando Gemini
se cae, se cae MaKo entero para ese cliente.

*Corrección del 24/08/2026. Typecheck 0 errores, 1202/1202 tests.*

---

## Un cliente con UNA sola key no tiene cascada

**Vive en:** `lib/ai-cheap.ts` · `lib/mako-doer-in.ts`

25/08/2026, 02:45 UTC. Tercera vez que el mismo cliente recibe un error probando el canal,
esta vez con los arreglos anteriores YA desplegados (3,5 h antes). La evidencia que lo
resolvió está en lo que NO hay: **ni una sola llamada en `anthropic_usage` en ese minuto**,
y la misma consulta funcionando perfecto **74 segundos después**.

### La cascada de cinco era un intento de uno

El ws13 tiene cargada `GEMINI_API_KEY` y nada más. El doer prueba
`[gemini, groq, cerebras, mistral, openai]`, y `provDe` devuelve `null` al instante para las
cuatro que no tienen key — por diseño, con la regla escrita en el módulo:

> «un cliente sin fila propia → null, **nunca la del dueño** (aislamiento)»

La regla es correcta para el camino normal (cada uno gasta en SU cuenta) y tenía un costo
que nadie había medido: **cinco casilleros, un solo intento real.** Gemini tosió y el
cliente se quedó sin MaKo.

**La regla que queda: una cascada no vale por su LARGO, vale por cuántos de sus escalones
existen para ESTE inquilino.** Cinco proveedores en el código y una key cargada son un
punto único de falla con aspecto de redundancia — que es peor que no tenerla, porque nadie
la audita.

### Y el reintento existía… en la otra mitad del módulo

`chatCheapCascade` reintenta los fallos transitorios con backoff desde hace meses.
`chatCheapTools` —el camino del **tool-use**, o sea el que usa MaKo en WhatsApp— pegaba UNA
vez y tiraba. La misma política, escrita, aplicada a una de las dos mitades.

Al portarla hubo que afinar dos cosas que la verificación mostró:

- **El 429 NO se reintenta.** Es la CUOTA de esa cuenta: volver a pegarle en un segundo es
  pedirle otra vez a quien ya dijo que no. Lo que se reintenta es la SATURACIÓN (5xx,
  timeout), que es un bache de segundos — exactamente lo del 25/8.
- **Nunca después de que una tool tocó datos** (`toolsUsados === 0`). Reintentar después de
  que una tool creó un borrador crea DOS. El módulo ya tenía la regla escrita para la
  cascada; acá se respeta igual.

### La red de plataforma, con sus tres límites

Cuando ninguna key del cliente contesta, se prueban las **gratis de la agencia**.
`provsGratisDePlataforma()` devolvió **11** en la medición: ws13 pasa de 1 intento real a 12.

1. **Solo GRATIS** — `openai` y `anthropic` quedan afuera: ahí una llamada de más es una
   factura de más, y eso es una decisión de plata que no toma el código.
2. **Solo último recurso** — mientras el cliente tenga con qué, gasta lo suyo.
3. **Se REGISTRA** — el motivo dice «⚠ red de plataforma», así que en el Saldo de IA se ve
   cuánto se apoya cada cliente en la agencia. Un respaldo que se vuelve permanente y no se
   ve es indistinguible de uno que nunca se usó, y el que tiene que cargar su key nunca se
   entera.

Dos cosas más que salieron de MEDIRLO, no de pensarlo:

- **Presupuesto de tiempo (25 s).** Probar 11 keys sin tope es un minuto largo y del otro
  lado hay alguien mirando el chat. A los 40 s ya no importa si la respuesta llega.
- **No arrancar por el proveedor que acaba de fallar.** Si el cliente corre en Gemini y
  Gemini está saturado, la Gemini de la agencia lo está igual: es el mismo servicio del otro
  lado. En la primera verificación, dos keys de Gemini se comieron los 25 s enteros. Con el
  orden corregido, **Groq contestó en 1,1 s** con la oferta y la descripción física
  completas, con Gemini caído en las cuatro keys.

### Y el error seguía apoyándose en una adivinanza

«soy mako obvio que puedo responderte» cayó en `capturar (dudosa)` —el default de «sin señal
clara»— y `esRutaPlan` da true para `→ capturar`. O sea que **la suposición elegía el texto
del error** y volvía a salir «No pude armar el borrador con eso». El arreglo anterior partió
el mensaje en dos y dejó la misma señal dudosa decidiendo cuál de los dos: media corrección.

*Corrida del 25/08/2026 — red de plataforma verificada desde ws13 con Gemini caído (429 en
la key 1, 503 en las otras tres): Groq contestó en 1,1 s. Typecheck 0 errores, 1207/1207
tests.*


---

## MaKo se comía la culpa de la cuota del cliente

**Vive en:** `lib/fallo-ia-texto.ts` · `lib/mako-doer-in.ts`

Cierre del hilo de las tres fallas del ws13. Con la red de plataforma puesta, el dueño marcó
lo que faltaba y es lo más importante de todo el hilo:

> *«Si la culpa es DEL CLIENTE, porque no cargó sus key, el mensaje tiene que reflejar eso.
> No un "He fallado en la transcripción"… Ahí MaKo queda mal, queda como el culpable. Tiene
> que decir "Te quedaste sin Tokens, cargá tus otras key aquí" y enviar el link.»*

El mensaje que había era, literal: **«Me llegó tu audio pero no lo pude escuchar (se me cayó
la transcripción)»** — cuando lo que pasaba era que el cliente tenía UNA sola key y estaba
agotada.

### El daño no es la injusticia, es la información escondida

Que el producto quede como el roto es feo. Lo caro es lo otro: **«reintentá en un momento»
sobre una cuota agotada manda a repetir algo que va a fallar igual**, mientras la solución
está a dos clics y el cliente no tiene forma de enterarse. Un mensaje que se echa la culpa
tampoco dice qué hacer — son la misma omisión.

### Cuatro causas, cuatro mensajes

`causaDelFallo(errores, keysDelCliente)` clasifica, y `keysDelCliente` es el dato que hacía
falta: separa «se cayó el proveedor» de «se cayó el proveedor Y no tenías respaldo». El
hecho técnico es idéntico y lo que el cliente puede hacer, no.

| Causa | Qué dice | Link |
|---|---|---|
| `sin_keys` | «todavía no cargaste ninguna API key» | sí |
| `sin_cuota` | «te quedaste sin cuota; cargá otra y sigo funcionando *ahora*» | sí |
| `sin_respaldo` | «tu proveedor se cayó y tenés *una sola* key» | sí |
| `proveedor_caido` | «**no es nada tuyo, tus keys están bien**» | **no** |

⚠️ **La última fila es tan importante como las otras tres.** Culpar al cliente por un bache
ajeno es el mismo error con el signo cambiado y se paga peor: lo manda a tocar algo que está
bien. Por eso `proveedor_caido` no lleva link.

### Dos detalles que costaron un test cada uno

- **La causa se decide con TODOS los errores, no con el último.** El último suele ser el
  casillero vacío del final de la cascada («falta OPENAI_API_KEY») cuando lo que de verdad
  pasó fue el 429 del primero. Clasificar por el último manda al cliente a cargar la key
  equivocada.
- **El `429` se busca con borde de palabra.** Sin eso, un id o un timestamp que contenga
  «429» clasifica un bache de red como cuota agotada, y el cliente sale a resolver un
  problema que no tiene.

El link es `?abrir=gemini`, el deep-link real del board: cae con el modal abierto, no en la
pantalla para que busque. Un link a la home es la mitad de un link.

*Corrida del 25/08/2026. La regla quedó en AGENTS.md → «Un mensaje de error dice DE QUIÉN
fue y QUÉ HACER». Typecheck 0 errores, 1215/1215 tests.*

---

## La reunión en horario de México para un cliente argentino

**Vive en:** `lib/timezone.ts` · `lib/calcom.ts` · `lib/google-calendar.ts` · `lib/paises.ts`

25/08/2026. El dueño: *«Se agendó una reunión y se preseteó al horario de MEX, cuando ese
cliente es de otro país. Y es MUY fácil que obtengas esa info si se tiene conexión a Google
Calendar»*.

### La causa no era un cálculo: era un setter sin call-site

`setTimezoneWorkspace()` existe desde que el producto se hizo multi-inquilino, y **no tenía
un solo call-site**. Nadie fijaba nunca la zona de un workspace, así que TODOS caían al
default — `America/Tijuana`, donde vive el primer cliente — y **no había forma de cambiarlo
desde la app**. Medido: de 8 workspaces, uno solo tenía zona, y estaba puesta a mano en la
base.

Es el mismo patrón que la cara de marca dos entradas más arriba: **una función correcta que
nadie llama.** Y su forma de fallar es peor que un error, porque el resultado *es*
plausible: una hora, bien formateada, en la zona equivocada.

**La regla: un setter sin call-site es un DEFAULT disfrazado de configuración** — y el peor
tipo de default, porque el código sugiere que se puede cambiar y nadie audita algo que
«ya está resuelto».

### El dato estaba a una llamada, en dos lugares

| Fuente | Qué contesta | Estado antes |
|---|---|---|
| **Cal.com** `GET /me` | `timeZone: "America/Buenos_Aires"` | nunca se pedía |
| **Google Calendar** `calendars/primary` | `timeZone` | **se pedía y se descartaba** — `emailDelCalendario` leía el `id` del MISMO objeto |

⚠️ El caso real no era Google: **ws13 usa Cal.com**, no Calendar. La intuición del dueño era
correcta y la fuente era otra — por eso se cablearon las dos, y no solo la que él nombró.

### Tres fuentes, en orden de autoridad

`tzDeWorkspace(ws)` ahora, cuando la zona no está guardada, la AVERIGUA y la guarda:

1. **Cal.com** — el cliente la eligió ahí.
2. **Google Calendar** — ídem.
3. **El teléfono**, y solo para países de UNA sola zona.

⚠️ **Lo que NO está en la tabla del teléfono es lo importante.** México tiene cuatro zonas y
Estados Unidos seis: un cliente de Tijuana y uno de Cancún comparten el `+52` y tienen tres
horas de diferencia. Ahí se devuelve `null` y gana el default, porque **adivinar es peor que
no saber: se guarda, y nadie lo vuelve a mirar.**

### Tres cosas que salieron de medirlo

- **Memo por proceso + persistencia.** `tzDeWorkspace` se llama en caminos calientes (el
  resumen de un lead, cada acción del doer); sin memo, cada uno se comería una llamada de red.
- **Techo de 4 s.** Un workspace sin Cal.com tardaba **3,9 s** en caer al default, y son dos
  fuentes con 5 s cada una. Un proveedor colgado no puede frenar el render de nadie.
- **Un default que no se pudo verificar NO se guarda.** Guardarlo convierte «no pude
  averiguarlo» en «esta es su zona» y ya no se reintenta nunca. Es la regla de la casa —«no
  poder leer un dato no es un valor del dato»— aplicada acá.

### Resultado, corrido contra los workspaces reales

```
ws13  → America/Buenos_Aires              (de Cal.com)   ← el caso reportado
ws10  → America/Argentina/Buenos_Aires    (del teléfono)
ws11  → America/Tijuana                   (clienta mexicana: +52 es ambiguo, gana el default)
ws1   → America/Tijuana                   (correcto)
```

Y un test cazó una fila muerta de la tabla nueva: `+809` no la produce nunca
`splitTelefono`, porque el catálogo tiene `+1809`. Una fila inalcanzable parece cobertura y
no lo es.

### Lo que quedó SIN hacer

- **No hay pantalla para elegir la zona.** Se resuelve sola, pero un cliente mexicano de
  Cancún —o cualquiera con lada ambigua y sin agenda conectada— sigue sin poder corregirla.
  El setter ya existe (`setTimezoneWorkspace`); falta el campo en /configuraciones.
- **`hoyEnTijuana()` sigue anclado en el resto del repo** (crm-auto, closing, calendly,
  campaign-structurer). Ya estaba anotado en `lib/timezone.ts` como «otra tarea» y sigue
  abierto: esas pantallas calculan «hoy» en México para todos.

*Corrida del 25/08/2026 — zonas resueltas y persistidas en prod para ws13 y ws10. Typecheck
0 errores, 1226/1226 tests.*

---

## MaKo inventando cómo funciona MaKo

**Vive en:** `lib/hechos-mako.ts` · `lib/mako-context.ts` · `lib/mako-doer-in.ts`

25/08/2026, tres problemas en la misma conversación con el cliente de prueba.

### 1. Inventó hechos sobre su propio producto (el grave)

El cliente preguntó si Clarity necesitaba el pixel de Meta. MaKo contestó, textual:

> «Clarity usa el **Pixel de Meta** para grabar eventos y mapas de calor»
> «Si querés datos reales de tu landing, el Pixel de Meta es **obligatorio**»

**Las dos son falsas.** Clarity es de Microsoft y **viaja adentro del propio snippet de MaKo**
(`bloqueClarity`, lib/landing-token.ts:1378). Después le dictó el `<script>` de Meta con un
id de juguete (`1234567890123456`) y le dijo que una env var en Vercel «ya instala el Pixel»
— que tampoco: una variable no instala nada si el código no la lee.

Lo peor: **hora y media antes MaKo le había dado el diagnóstico CORRECTO** («el código que
tenés instalado es de una versión vieja, repegalo») y lo reemplazó por uno inventado.

**Por qué pasó, y no fue el modelo teniendo un mal día:** el prompt trae el negocio del
cliente —oferta, funnel, fase, avatar— y **cero sobre cómo funciona MaKo**.
`buscar_conocimiento` busca en la base del CLIENTE, vacía para uno nuevo. Preguntado sobre su
propia herramienta, el modelo hizo lo único que podía: rellenar.

**La regla: un modelo sin los hechos VA a inventar los hechos.** Y prohibirle inventar sin
darle qué contestar es pedirle que se calle sobre su propio producto, que tampoco sirve. Van
las dos capas: `hechosMako(base)` con lo verificado contra el código, y las prohibiciones
duras (no dictar código de terceros con ids de ejemplo, no afirmar que algo «quedó
instalado», no inventar rutas ni variables).

⚠️ Va en `buildSystemPrompt`, no en el preámbulo del doer: la IA inventa sobre el producto en
el chat de la app igual que en WhatsApp.

⚠️ Y **la base del link la pone el código**. En la primera prueba MaKo contestó bien el
contenido y linkeó a `https://tu-dashboard.com/integraciones`: un dominio inventado. Es el
corolario de siempre — un dato exacto que pasa por un LLM deja de ser exacto.

### 2. Un tutorial de 60 líneas adentro de un WhatsApp

El preámbulo ya pedía «2-5 líneas» y el modelo escribió un manual con bloques de código y
encabezados markdown. **Una instrucción de estilo suelta no gana contra un contenido que
"pide" ser largo.** Por eso `LARGO_WHATSAPP` no repite el pedido: le da la SALIDA (el link de
la tarjeta de /integraciones, que ya trae el tutorial oficial escrito por el equipo).
**Prohibir sin ofrecer alternativa no cambia el comportamiento.**

### 3. Tres borradores de plan que nadie pidió

«ahí hice la prueba», «hay un problema chiquito con el botón de prueba del pixel», «probá de
vuelta, ya agregué otra api key» → tres «Listo, te armé el borrador» con un link a revisar un
plan que el cliente nunca pidió. El dueño: *«¿qué sentido tiene?»*.

Los tres son `capturar (dudosa)`, el default de «sin señal clara». El arreglo del día
anterior le quitó la OBLIGACIÓN de llamar la tool, y el modelo la llamó igual porque la
tenía sobre la mesa.

**Ahora una intención dudosa no VE `proponer_tareas_plan`.** Y el default del clasificador
NO se toca: ante la duda, capturar sigue siendo correcto para el dueño volcando ideas. Lo que
se corrige es que **la duda no EJECUTE** — el material no se pierde (sigue en la
conversación) y el preámbulo le pide a MaKo que OFREZCA anotarlo. Es «un canal PROPONE, una
persona confirma» aplicado a su propio criterio: crear un borrador que nadie pidió es hacer.

*Corrida del 25/08/2026 — la respuesta al caso real verificada contra el modelo: «Clarity no
necesita el pixel de Meta; solo el script de MaKo es suficiente», con el link correcto.
Typecheck 0 errores, 1240/1240 tests.*

---

## «Nuevo agendado» saliendo 2 y 3 veces

**Vive en:** `lib/avisos.ts` · `app/api/webhooks/calcom/route.ts` · `app/api/webhooks/calendly/route.ts`

El dueño: *«repite los mensajes… el de nueva reunión lo manda varias veces con algunos leads,
con otros lo manda 1 sola vez»*.

### Lo que dijeron los datos

Medido sobre 10 días de conversación de ws1 y ws13, el patrón es nítido y descarta media
docena de hipótesis de una:

- Los duplicados son **SIEMPRE «Nuevo agendado»**. Nunca los recordatorios de 30 min, nunca
  los «Terminó la R1».
- Siempre **dentro del mismo minuto**: 9 s, 25 s, 38 s y 41 s de diferencia.
- En los **DOS** proveedores (Calendly en ws1, Cal.com en ws13).

Eso no es un bug de lógica: es **el mismo webhook entregado varias veces**. Los proveedores
reentregan, y el handler no tenía idempotencia.

**El «con algunos leads sí y con otros no» que desconcertaba al dueño es exactamente lo que
se espera de un reintento:** el proveedor reentrega cuando la primera respuesta tarda o falla,
o sea de forma irregular. Cuando un síntoma es intermitente sin patrón por-entidad, el
sospechoso no es la entidad — es el transporte.

### La causa: la clave del dedup contestaba una sola pregunta

`keyLast(tipo)` deduplicaba **solo por tipo**. Con eso, poner `dedupTtlMin` en un aviso
por-entidad se tragaba el agendado de OTRO lead — así que los avisos de reunión se cablearon
**sin dedup**, y con el comentario puesto:

> «Todos con `emitirDelCatalogo` best-effort, sin `dedupTtlMin` (el dedup es por-tipo global
> → tragaría eventos de otros leads)»

O sea: la decisión estaba razonada y era correcta *dada la herramienta*. **La herramienta era
la que estaba mal.** «¿Ya avisé de ESTO?» y «¿ya avisé de ESTE TIPO de cosa?» son dos
preguntas distintas y la clave tenía una sola.

### Qué queda

`dedupKey` opcional en `emitirAviso`/`emitirDelCatalogo`: sin él, el comportamiento de
siempre (por tipo, correcto para un aviso global como «tu cuenta de Meta está frenada»); con
él, la ventana se acota a esa entidad. El id ajeno se **hashea** — un URI de Calendly son ~80
caracteres y la clave de `app_settings` no es lugar para meterlo entero.

⚠️ **La clave lleva el HORARIO además del id de la reserva**
(`calcom:${uid}|${inicio}`). Un reintento trae los dos iguales; un **reagendado** cambia el
horario, así que ese sí avisa. Con solo el id, mover una reunión quedaba tapado por el dedup
— y mover una reunión es justo lo que hay que avisar.

Y son **CUATRO** emisores del mismo aviso (2 en Cal.com, 2 en Calendly): arreglar tres deja
el cuarto duplicando. El test cuenta emisores contra emisores-con-dedup en vez de afirmar un
número, así que un quinto emisor nuevo también lo obliga.

### Lo que quedó SIN hacer

- **Los otros avisos por-entidad siguen sin dedup**: `reunion-cancelada`,
  `lead-formulario-meta`, `wa-mensaje-entrante`. La herramienta ya existe; falta pasarles su
  `dedupKey`. Mismo riesgo, mismo arreglo de una línea.
- **Las marcas se acumulan**: una fila de `app_settings` por reserva. Con ~10 agendados/día
  son ~3.600 filas al año por workspace. No molesta hoy y conviene un barrido cuando el
  volumen crezca.

*Corrida del 25/08/2026. Typecheck 0 errores, 1243/1243 tests.*
