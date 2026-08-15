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

### Lo que sigue sin hacer

- **Bandeja tipo Gmail dentro de MaKo:** recibir todos los mails ahí, escribir, y elegir con qué
  email se envía — en lugar de crear una casilla nueva (2026-08-06).
- **Definir a qué email van las notificaciones.** No quiere que lleguen a su correo personal y
  preguntó si abrir uno nuevo. **Quedó sin respuesta** (2026-08-06).

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
