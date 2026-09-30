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

### ⚠️ Un dedup de «leer, hacer, marcar» sólo aguanta reintentos MÁS LENTOS que lo del medio

**Síntoma (Joan, 21/09/2026):** el aviso de MaKo al agendar un lead llega DUPLICADO. Y ya
se había arreglado una vez, un mes antes: el fix `f688ace6` le puso `dedupKey` por reserva
a los cuatro emisores y funcionó — para un cliente.

**Causa real: la ventana.** `emitirAviso` leía el dedup, mandaba el WhatsApp y recién
después marcaba. Y el envío no es instantáneo: `lib/mako-grupo.ts` le manda a Evolution un
delay de tipeo anti-ban de `min(1500 + largo*45, 9000)` con jitter, y Evolution retiene el
HTTP abierto mientras lo simula. Para un «Nuevo agendado» de 169-173 caracteres son **7,2 a
10,8 segundos con el dedup sin marcar**.

**Y por eso el mismo código da resultados opuestos según el proveedor:**

| Proveedor | Reentrega a los | Duplicados medidos |
|---|---|---|
| Calendly (ws1) | 22-41 s → *después* de la marca | 5 avisos, **0** |
| Cal.com (ws13) | 0,4-12,4 s → *dentro* de la ventana | 51 avisos, **21 pares** |

Quince de los veintiún huecos caen entre 5,1 y 12,4 s, justo encima del bloqueo del envío.

⚠️ **Y LA CADENCIA DE UN PROVEEDOR NO SE PUEDE MEDIR CON EL DEDUP PUESTO.** Sólo se ven los
reintentos más rápidos que la ventana: los lentos ya no dejan fila. El techo de 12,4 s es el
techo de LA VENTANA, no el de Cal.com. Por eso esto no se arregla ensanchando el TTL ni
acortando el delay de tipeo — cualquier número que se elija está calibrado sobre una muestra
censurada por el propio arreglo que se quiere calibrar.

**La cura es que la reclamación sea ATÓMICA**, y la pieza ya estaba escrita en el repo para
este mismo problema: `cambiarSettingSi` (`lib/settings.ts`), un compare-and-set que existe
porque dos clics en «Conectar por QR» abrían dos líneas de WhatsApp.

⚠️ **DÓNDE VA EL RECLAMO ES LA MITAD DEL ARREGLO**, y ponerlo en el lugar obvio revive un bug
ya cerrado. No va en la lectura temprana: entre ella y el envío está el interruptor de
«¿este aviso está prendido?», y marcar el dedup antes de ese guard envenena el interruptor —
apagar y volver a prender dejaba el aviso mudo hasta que venciera el TTL. Va **después del
interruptor y antes de los dos caminos que dicen algo** (la cola del resumen y el envío), así
un solo reclamo cubre a los dos.

**La regla:** un dedup de leer-hacer-marcar es correcto sólo mientras la operación del medio
sea más rápida que el reintento de quien llama. En cuanto lo del medio es una llamada de red
con delay, hace falta un compare-and-set. Y **medí la cadencia del proveedor antes de
declararlo arreglado con un solo cliente de muestra**.

**Vive en:** `lib/avisos.ts` (`reclamarAviso`) · `lib/settings.ts` ·
`tests/avisos-dedup-entidad.test.ts`

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

### ⚠️ El número de empresa compara teléfonos con tres reglas distintas, y la pantalla usa la única que no falla

**Síntoma:** un contacto «bloqueado» sigue recibiendo nutrición, o un «oculto» sigue en el
inbox. En pantalla no se ve nada raro.

**Causa real, regla por regla:**

- **Igualdad exacta.** `wa_bloqueados` y `wa_ocultos` guardan los dígitos como llegaron
  (lib/evolution-block.ts:10) y todo compara por `=`: el motor con
  `estaBloqueado(lead.telefono)` (lib/nutricion.ts:1153), el inbox con `bloq.has` /
  `ocultos.has` sobre el teléfono del espejo, que sale del jid
  (lib/evolution-mensajes.ts:377-388). `lead.telefono` y `wa_mensajes.telefono` difieren
  seguido (52 vs 521, con o sin lada): una sola fila no les sirve a los dos.
- **Subcadena.** `borrarChat` (:689-694) y `getMensajesDeChat` (:472-485) filtran
  `telefono LIKE %<últimos 10>%`, que no es un sufijo. La UI pasa siempre el teléfono
  completo del espejo y no lo sufre; con un número corto o mal transcripto, el DELETE alcanza
  varias conversaciones y la lectura mezcla personas.
- **Últimos 10.** Es la clave con la que se agrupa todo lo demás (`claveTel`, :195-198), y
  por eso la pantalla se ve coherente.

Dos vecinos de la misma familia: el deep link `?chat=<jid>` de `EmpresaInbox` matchea el jid
EXACTO y, si no está en la lista (otra lada, un lead sin mensajes), abre `convs[0]` sin
avisar — **el link lleva a la conversación de otra persona**
(app/whatsapp/EmpresaInbox.tsx:197-206). Y `leads.telefono_normalizado` puede traer el 52 o
el 521 adelante, así que un `.in()` por últimos 10 no calza: hace falta un OR de `LIKE`.

⚠️ **El deep link muerde a quien ARMA el link, no solo a quien lo abre (16/09/2026).** Un jid
construido con los dígitos crudos del CRM (`${tel}@s.whatsapp.net`, sin la lada con que lo
guardó el espejo) casi nunca matchea, así que el link «funciona»: abre `/whatsapp` con el chat
de OTRA persona al lado del borrador que se quería revisar. **Regla:** el jid de un link no se
inventa; se resuelve contra el espejo (`chatEmpresaPorUltimos10`,
lib/api-mako/areas/whatsapp.helpers.ts:140) y, si no hay conversación, el link va sin `chat=`
(lib/api-mako/areas/whatsapp.run.ts:683-687, lo mismo en cs.run.ts:152-155). **Deuda de la
pantalla:** con un `chat=` que no existe, abrir la cola vacía en vez de `convs[0]`.

⚠️ **Ojo con la API de MaKo mientras esto siga así:** para que el bloqueo agarre, la
operación escribe UNA fila por cada formato exacto conocido (el del lead y los del espejo) y
relee (lib/api-mako/areas/whatsapp.run.ts:769-778). Desbloquear desde /whatsapp borra UNA,
con `.eq` exacto (app/api/whatsapp/evolution/block/route.ts:44): las otras quedan, y el motor
sigue salteando al contacto.

**Regla:** en el número de empresa la identidad de una persona son los últimos 10 dígitos, en
TODAS las comparaciones —guardar, preguntar, borrar— y como sufijo (`LIKE '%<10>'`), nunca
como subcadena ni como igualdad.

**Deuda:** que `estaBloqueado`, `telefonosBloqueados`, `telefonosOcultos`,
`desbloquearContacto` y `mostrarContacto` comparen por sufijo de 10
(lib/evolution-block.ts:22-62), y que `borrarChat` y `getMensajesDeChat` usen sufijo. No se
hizo porque la corrida no podía tocar libs compartidas: el parche vive en
`lib/api-mako/areas/whatsapp.helpers.ts` (`registrosPorUltimos10`, `leadsPorUltimos10`,
`chatEmpresaPorUltimos10`, `contarParaBorrar`) y se borra el día que la lib lo haga.

**Vive en:** lib/evolution-block.ts · lib/nutricion.ts:1153 ·
lib/evolution-mensajes.ts:195-198, :377-388, :472-485, :689-694 ·
app/whatsapp/EmpresaInbox.tsx:197-206 · app/api/whatsapp/evolution/block/route.ts:44 ·
lib/api-mako/areas/whatsapp.helpers.ts · lib/api-mako/areas/whatsapp.run.ts:683-687 ·
*2026-09-16 api-mako-areas*

### ⚠️ Las bandejas cortan por el lado equivocado: «los últimos N» son los primeros N, e `incluirOcultos` es «solo ocultos»

Cuatro lecturas de bandeja, en los dos canales, que devuelven otra cosa que lo que su nombre
promete. Ninguna da error.

- **`getMensajesDeChat(jid, 300)`** ordena `wa_timestamp` ASCENDENTE y después aplica el
  `limit` (lib/evolution-mensajes.ts:479-480): en un chat de más de 300 mensajes devuelve los
  300 más VIEJOS. Y firma URLs de toda la media (hasta 8 s) aunque el que llama no la use.
- **`listarMensajes` de /instagram**, igual: `created_at` ascendente + `limit(300)`
  (app/instagram/ig-datos.ts:227-234). En un hilo largo se cortan justo el último DM del lead
  y el borrador pendiente.
- **`listarConversaciones`** cuenta `borradoresPendientes` dentro de los 600 mensajes más
  recientes de las 100 conversaciones JUNTAS (:196-212). Un borrador de un hilo que quedó
  afuera de esa ventana cuenta 0, así que un filtro «con borrador pendiente» pierde a los que
  esperan hace más. El comentario de arriba dice «el límite alcanza», y es cierto para lo que
  se escribió: el último texto de la vista previa.
- **`getConversacionesNoOficial(limite, true)`** no es «también los ocultos»: es SOLO los
  ocultos, y `[]` si no hay ninguno (lib/evolution-mensajes.ts:379-384). La revisión
  adversarial propuso resolver un chat contra esa llamada: habría fallado con todo chat
  visible.

**Regla:** `order asc` + `limit` nunca contesta «los últimos N»: va `desc` + `limit` y se da
vuelta en memoria. Un conteo se hace con su propia consulta, no dentro de la ventana que se
trajo para otra cosa. Y un booleano que se llama `incluirX` se lee antes de pasarle `true`.

**Deuda:** /whatsapp e /instagram siguen con los dos cortes. La API los esquiva con
`mensajesEspejoRecientes`, `mensajesRecientesIg` y `borradoresPorConversacionIg` (en
`lib/api-mako/areas/*.helpers.ts`): lógica duplicada que tiene que volver a la lib.

**Vive en:** lib/evolution-mensajes.ts:379-384, :472-485 · app/instagram/ig-datos.ts:196-212,
:227-234 · *2026-09-16 api-mako-areas*

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

**Y lo repitió (2026-09-16):** `historial_whatsapp` (lib/mako-tools.ts), la tool con la que
MaKo lee el WhatsApp oficial de un lead. **El diagnóstico obvio era que estaba bien**, porque
filtraba `messageType` 0/1/3; pero después rotulaba con `saliente`, así que las plantillas de
nutrición (3) le llegaban al modelo como mensajes DEL LEAD, y cualquier consejo sacado de ahí
leía nuestro marketing como objeciones. Hoy rotula por `messageType` (:212-217). **Filtrar
por el tipo no alcanza si el rótulo sale del booleano.**

**Vive en:** lib/chatwoot.ts (saliente = message_type === 1) · lib/lead-insights.ts
(bloqueChat) · lib/mako-tools.ts:211-217 (historial_whatsapp) · *2026-07-04
~auditoria-insights-del-lead + 2026-09-16 api-mako-areas*

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

### ⚠️ El guard del inbox oficial mira UNA conversación, y después se lee todo el contacto

**Síntoma:** el hilo de WhatsApp de un lead (en el inbox y en lo que lee MaKo) trae también
lo que esa persona escribió por Instagram, email o webchat, y abrirlo marca todo eso leído en
Chatwoot.

**Causa real:** `contactoEnInboxWA` —el único guard de aislamiento del canal oficial— exige
que el contacto tenga AL MENOS una conversación en el inbox de WhatsApp
(lib/chatwoot.ts:350-355). Pasada esa puerta, `getContactMessages` (:407-412) y
`markContactRead` (:385-389) recorren TODAS las conversaciones de `contactConversaciones`,
que trae el `inboxId` de cada una (:327-341) y nadie lo mira. Y el número contra el que
compara la puerta puede ser el `3` inventado de `cfg()` (ver «Sin `CHATWOOT_WA_INBOX_ID`…»).

**Regla:** un guard que habilita porque «existe una fila de X» no autoriza a leer todo lo
demás. El filtro por inbox va en la LECTURA, no solo en la puerta.

**Deuda:** un filtro `soloInboxWA` en `getContactMessages` y `markContactRead`
(lib/chatwoot.ts:385-412). Desde la API no se pudo: `contactConversaciones` y `cfg` son
privados, y reimplementarlo era copiar el cliente de Chatwoot. La API solo avisa en la
descripción de `hilo_contacto_whatsapp_oficial`.

**Vive en:** lib/chatwoot.ts:327-355, :385-412 · app/api/whatsapp/contacts/[id]/messages/route.ts:42 ·
app/api/whatsapp/contacts/[id]/read/route.ts:26 · lib/mako-tools.ts:211 (historial_whatsapp) ·
*2026-09-16 api-mako-areas*

### `unread_count` de Chatwoot vale 0 siempre, y un `can_reply` ausente se lee como ventana abierta

Dos campos de estado de la conversación que no dicen lo que parecen, los dos en `mapConv`:

- `sinLeer: cv.unread_count ?? 0` (lib/chatwoot.ts:220). En esta instalación el campo llega
  en 0 siempre: lo leído de la app vive en `localStorage`, y marcar leído en Chatwoot no
  cambia nada visible. **Todo «no leídos» derivado de Chatwoot miente.** La señal real de que
  hay algo sin contestar es la dirección del último mensaje (`ultimoEntrante`, :221).
- `puedeResponder: cv.can_reply !== false` (:223). Si Chatwoot no manda el campo, la ventana
  de 24 h figura ABIERTA — y de eso cuelga toda decisión de texto libre contra plantilla.

**Regla:** un campo del proveedor que falta no es el valor optimista. Es la misma forma que
el `?? '3'` del inbox.

**Vive en:** lib/chatwoot.ts:218-223 · memoria `chatwoot-unread-count-cero` · *2026-09-16
api-mako-areas*

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

**Y la lista puede no reflejarla por otra razón (2026-09-16):** `listMetaTemplates` pide
`limit=200` a Graph y no sigue `paging.next` (lib/meta-templates.ts:342-349). Con más de 200
plantillas en el WABA, buscar una por nombre contesta «no existe» sobre una que existe, y
`reconcileDrafts` deja borradores sin reconciliar sin decir nada. **Deuda:** paginar ahí; la
API solo aclara en su error cuántas leyó y que Meta corta en 200.

**Vive en:** lib/meta-templates.ts (submitTemplate + enviarBorradorAMeta + reconcileDrafts;
listMetaTemplates :342-349) · *2026-06-24 ~review-plantillas-whatsapp-meta + 2026-09-16
api-mako-areas*

### ⚠️ «Mandar a aprobar la plantilla» falla con «ya está en estado pending» mientras Meta dice que no existe

**Síntoma:** `asegurarPlantillaReporte` (la plantilla `reporte_mako` de la apertura diaria)
contesta siempre `la plantilla ya está en estado "pending"` —o `"approved"`— y Meta dice que
está rechazada o que no la tiene.

**Causa:** tres piezas correctas por separado. `upsertDraft` no toca `status` al actualizar, a
propósito (lib/meta-templates.ts:114-142). `enviarBorradorAMeta` solo manda borradores en
`borrador` o `rejected` (:296-303). Y `asegurarPlantillaReporte` (lib/reporte-template.ts:57-70)
mira a Meta, ve `rejected`/`ausente`, hace el upsert y llama al envío **sin reconciliar el estado
local**. Si la plantilla se borró en Meta o el rechazo nunca se reconcilió, la fila local queda
`pending`/`approved` para siempre y el envío falla igual en cada corrida — la del cron diario
(app/api/cron/reporte-diario/route.ts:36) y la del botón (app/api/perfil/plantilla/route.ts:19).
Y sin plantilla aprobada, la apertura diaria no sale nunca (reporte-diario/route.ts:38-39).

⚠️ **Llamar a `reconcileDrafts` (:448) no alcanza:** reconcilia solo lo que Meta SÍ lista
(`if (!m || !d.id) continue`, :457). Una plantilla borrada en Meta nunca vuelve a `borrador` por
ahí.

**Regla:** antes de reenviar algo que vive en un tercero, el estado local se confronta contra
el tercero, incluido el caso «no la tiene». El estado guardado es una foto, no un dato.

**Lo que quedó SIN hacer:** que `asegurarPlantillaReporte` resetee con `setDraftStatus(id,
'borrador')` cuando Meta dice `rejected` o `ausente`. Hoy solo lo hace el runner de la API de MaKo
(`asegurar_plantilla_reporte`, lib/api-mako/areas/equipo.run.ts:725-727).

**Vive en:** lib/meta-templates.ts:114-142, :296-308, :448-466 · lib/reporte-template.ts:57-70 ·
*2026-09-16 api-mako-areas*

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

**Estado al 2026-09-16:** `enviarBorrador` ya reclama así (lib/evolution-envio.ts:171-178).
Quedaron sin claim sus dos vecinos de la misma cola:

- `descartarBorrador` (:190-193) actualiza por `id` sin `.eq('estado','pendiente')`:
  descartar no sabe si el borrador ya salió o se está mandando.
- `crearBorrador` (:116-138) devuelve `void` y no mira el error del insert **ni del upsert**:
  un borrador que no se guardó es indistinguible de uno que sí. Para saber su id hay que volver
  a listar, y `listBorradores` (:146-153) trae los 200 MÁS VIEJOS, así que con más de 200
  pendientes el recién creado tampoco aparece.

**Y los dos se tragan el error hacia arriba (16/09/2026).** `listBorradores` tampoco mira
`error`: con la base caída la cola vale `[]`. Ordena `created_at` ascendente con `limit(200)`
porque está pensada para pintar la bandeja, no para buscar — usada para deduplicar, «no
encuentra» el borrador de hoy justo cuando la cola está llena. Y lo que cuelga de `crearBorrador`
contesta `ok` sin haber dejado nada: `borradorHayQueAprobar` y `borradorVioYNoContesto`
(`lib/cs-mensajes.ts:52-69`, `:77-94`) hacen `await crearBorrador(…)` y `return { ok: true }`.

**Regla:** para buscar un borrador puntual se consulta `wa_borradores` filtrado (lead o teléfono,
`estado='pendiente'`, origen) en orden DESCENDENTE, y después de crear se RELEE: si no está, no
se dice que quedó. Moldes: `borradorPendienteIgual` (`lib/api-mako/areas/whatsapp.helpers.ts:207`,
usado en `whatsapp.run.ts:690-696`) y `borradoresMakoDelLead` (`lib/api-mako/areas/cs.helpers.ts:131`).

**Deuda:** `.insert().select('id').single()` que tire (que `crearBorrador` devuelva el id o el
error), y la condición de estado en el descarte. La API relee antes y después: achica la
carrera, no la cierra. Los avisos de `lib/cs-mensajes.ts` siguen sin releer.

**Vive en:** lib/evolution-envio.ts:106-117 (hoy :116-193; crearBorrador :116-138,
listBorradores :146-153) · lib/cs-mensajes.ts:52-94 · *2026-07-09
~auditoria-envio-evolution-nutricion + 2026-09-16 api-mako-areas*

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

**Cómo se ve desde afuera (2026-09-16):** una secuencia de audios «activa» por el número de
empresa no le manda nada a los leads nuevos y se juntan borradores. No está rota: en la rama
no_oficial solo `esLeadCliente` recibe envío directo; al resto —texto **o audio**— le queda un
borrador para el setter (lib/nutricion.ts:1162-1204). El punto 1 de arriba ya está mitigado:
con un borrador de nutrición pendiente, `tieneBorradorNutriPendiente` no apila otro y corre la
inscripción 6 h sin avanzar.

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

**Y editar el copy de un paso oficial no cambia lo que recibe el lead (2026-09-16).**
`setSecuenciaPasos` conserva `template_wa` (lib/nutricion.ts:262), y el motor manda la
plantilla por NOMBRE: Meta entrega el cuerpo aprobado, no el `paso.cuerpo` nuevo. Las dos
salidas obvias fallan:

- **Poner `template_wa` en null** deja el paso fallando con «paso sin template_wa», un reintento
  cada 24 h para siempre (:1211-1214).
- **Volver a correr `plantillaDesdePaso`** tampoco: es idempotente por NOMBRE
  (`nombreMetaSafe(clave, orden)`), y si ya hay una en approved/pending/paused la re-vincula
  sin reenviarla (lib/nutricion-plantillas.ts:160-175). Vuelve a atar el texto viejo.

**Deuda:** hoy no hay camino en la app para que el texto nuevo de un paso oficial llegue al
lead. La API solo lo avisa en el resumen de `editar_pasos_secuencia_mensajes`.

**Vive en:** lib/nutricion.ts:1129 (content crudo) vs :1158 (aplicarVariables en no_oficial) ·
lib/nutricion.ts:78 y :264 (template_param) · lib/template-vars.ts:26 · lib/nutricion.ts:262,
:1211-1214 · lib/nutricion-plantillas.ts:160-175 · *2026-07-09 f33-understand + 2026-09-16
api-mako-areas*

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

### ⚠️ `setSecuenciaPasos` conserva las variantes por POSICIÓN: reescribir un paso del número de empresa deja saliendo el copy viejo

**Síntoma:** se reescribe el texto de un paso de WhatsApp no oficial y parte de los leads sigue
recibiendo la versión anterior.

**Causa real:** las variantes que MaKo escribe al armar la secuencia no viven en ningún
formulario, así que `setSecuenciaPasos` las conserva por `orden` cuando quien guarda no las
manda (lib/nutricion.ts:235-237 y :266-271). `textoDelPaso` sortea entre el cuerpo nuevo y
esas variantes viejas (:212-218), y la rama no oficial lo usa (:1143). Dos corolarios que salen
de la misma línea (:269):

- **Mandar `variantes: []` no las borra**: un array vacío cae al merge y vuelven las previas.
- **Reordenar pasos** le cuelga a cada uno las variantes del que estaba antes en esa posición.

**El diagnóstico obvio, para email, era el equivocado:** la rama de email manda `paso.cuerpo`
directo (:1271) y no sortea. Las variantes viejas sobreviven en el JSON pero no salen.

**Regla:** reescribir el cuerpo de un paso con variantes es reescribir sus variantes en la
misma escritura, y hoy la función no tiene forma de vaciarlas. Y el array `pasos` tiene DOS
escritores en la API con reglas distintas —`editar_pasos_secuencia_mensajes`
(lib/api-mako/areas/chatbot.def.ts:321) y `editar_pasos_secuencia_email` (email.def.ts:189)—:
cualquier cambio en el merge mira los dos.

**Vive en:** lib/nutricion.ts:212-218, :235-271, :1143, :1271 ·
lib/api-mako/areas/chatbot.run.ts:587 (el aviso) · *2026-09-16 api-mako-areas*

### ⚠️ Archivar una secuencia no la pausa: desarchivarla, o re-armar los audios, la revive prendida

**Síntoma:** una secuencia desarchivada, o re-armada desde los audios del onboarding, vuelve a
mandar mensajes sin que nadie la haya prendido.

**Causa real:** `archivarSecuencias` escribe `archivada_at` y cancela las inscripciones vivas,
pero deja `activa` como estaba (lib/secuencias-huecos.ts:90-116). El motor la ignora solo por
el filtro `archivada_at IS NULL` (lib/nutricion.ts:124-131), así que el día que ese campo
vuelve a null la secuencia está viva otra vez. Dos caminos lo vuelven a null sin tocar
`activa`:

- `desarchivarSecuencia` (lib/secuencias-huecos.ts:119-123).
- `armarSecuenciasDeAudios`, que reescribe las `chat-agent-*` existentes con
  `archivada_at: null` y sus pasos nuevos (lib/secuencias-audios.ts:244-249): una archivada
  estando prendida vuelve a enrolar, y una activa manda los pasos nuevos en el acto. De paso,
  pisa el texto y las variantes que se hubieran editado. La única que archiva bien es la
  post-agenda vieja, con `activa: false` en la misma escritura (:223-225).

**Regla:** archivar y pausar van en la MISMA escritura, y desarchivar devuelve la secuencia
pausada. Una marca que el motor usa para ignorar algo no reemplaza al interruptor que lo apaga.

**Deuda:** la pantalla de /chatbot tiene el mismo agujero. La API lo resuelve con
`desarchivarYPausar` (lib/api-mako/areas/chatbot.helpers.ts:56), que tiene que mudarse a
lib/secuencias-huecos.ts.

**Vive en:** lib/secuencias-huecos.ts:90-123 · lib/secuencias-audios.ts:223-225, :244-249 ·
lib/nutricion.ts:124-131 · *2026-09-16 api-mako-areas*

### ⚠️ Las lecturas del motor y del bloqueo no paginan: PostgREST corta en 1000 y el número sale corto sin error

Es la regla de AGENTS.md («un número redondo es una hipótesis de truncamiento») con nombre y
apellido en este dominio:

- **`planificarInscripciones`** busca los ya inscriptos con `.in('lead_id', candidatos)`
  (lib/nutricion.ts:613-617): con más de 1000 inscriptos en la cohorte, el dry-run lista como
  pendientes a leads que ya estaban.
- **`inscripcionesVencidas`** (:772-781) trae las vencidas sin `range` y sin orden.
- **`getSecuenciasConStats`** trae TODAS las inscripciones y los envíos del workspace para
  contarlos en JS (:169-182), y `getSettingData` hace lo mismo con 30 días de envíos
  (lib/setting-secuencias.ts:30-31): entre todas las secuencias, los contadores de la tab no
  pueden sumar más de 1000.
- **`telefonosBloqueados` / `telefonosOcultos`** traen el set entero sin `range`
  (lib/evolution-block.ts:36-39, :59-62): pasados los 1000, un bloqueado o un oculto más no
  se marca en el inbox.
- **`leadsDeSegmento`** (email): ver «Dos contadores del mismo segmento que no cuentan lo
  mismo».

**Regla:** contar va con `count: 'exact', head: true`; listar va paginado con `.range()` y
orden estable; y una pertenencia puntual («¿está bloqueado X?») se pregunta por X, no trayendo
el set.

**Estado al 17/09/2026:** `planificarInscripciones`, `comprometerInscripciones`,
`leadsEnFamiliaPostAgenda` y `horariosDeInscripcion` van en tandas de 200 ids, cada tanda
paginada (`inscriptosDe`), y un error corta con su motivo: antes el corte podía reinsertar
inscripciones, chocar con `unique(lead_id, secuencia_id)` y el `throw` frenaba la inscripción
entera. `inscripcionesVencidas`, `getSecuenciasConStats` y `lib/setting-secuencias.ts` paginan.
Las 13 cohortes de `leadsDeCohorte` pasan por `leerTodo` (la de `etapa_actual` ya daba 1.032
abiertos en ws1: un lead que caía del corte no se inscribía nunca). **Siguen sin paginar**
`telefonosBloqueados` / `telefonosOcultos` (0 y 15 filas hoy).

⚠️ **Arreglar la cohorte agrandó lo de abajo.** Antes de paginar, `etapa_actual` devolvía 1000
ids como máximo; después, todos los abiertos, y esa lista es la que alimenta los `.in()` de
inscriptos. Por eso esos `.in()` van en tandas: paginar una lectura cambia el tamaño de lo que
viene después ([hallazgos-infra.md](hallazgos-infra.md) → «Las formas de truncar que no parecen
truncar»).

**Vive en:** lib/nutricion.ts:169-182, :613-617, :772-781 · lib/setting-secuencias.ts:25-31 ·
lib/evolution-block.ts:36-39, :59-62 · *2026-09-16 api-mako-areas*

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
  **Medido el 17/09:** el audio ya se resolvió (las secuencias de audios de post-agenda). El
  lead magnet sigue sin entrega, y **hoy no hay nada que entregar**: 0 de 62 secuencias tienen
  `usa_lead_magnet` o `lead_magnet_id`, y los 13 Entregables de los 5 workspaces que tienen
  (`app_settings` `mako.entregable`) tienen **0 con `enlace`**. Construir la entrega ahora es
  construirla contra nada; se destraba cuando exista un Entregable con enlace y una secuencia
  que lo use. *Sin hacer, y visible:* el wizard (`SecuenciaWizard`, paso `lead_magnet`) deja
  elegir un Entregable sin enlace, o sea prometer algo que no tiene dónde estar.
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

**Volvió con otra forma (2026-09-16), y ésta no se arregló:** aquel fix cerró el filtro de email
vacío, no el tope de filas. `leadsDeSegmento` hace un select sin paginar
(lib/email-marketing.ts:262-270) y PostgREST corta en 1000; `contarSegmento` cuenta exacto
(:272-278). Síntoma esperado: «1500 destinatarios» en pantalla, 1000 enviados, broadcast
`'enviado'` y `truncado: false`, sin error — y como ya está `'enviado'`, el guard de reentrada
deja afuera al resto para siempre. `MAX_DESTINATARIOS = 2000` (:373) es inalcanzable, así que
`truncado` (:419) no puede dar true nunca.

**Deuda:** paginar con `.range()` hasta `MAX_DESTINATARIOS`, que conteo y lista salgan de la
misma resolución, y un test con 1001 leads que lo pruebe rompiéndolo. Y exportar
`leadsDeSegmento(segmento, limite)`: `filtroSegmento` es privado (:245), así que quien necesite
leer un segmento tiene que copiar el filtro — que es crear el segundo contador otra vez. La API
se niega a enviar o programar si `contarSegmento` pasa de 1000, pero un broadcast ya programado
cuyo segmento crezca después sale truncado por el cron.

**ARREGLADO el 17/09/2026, y ya estaba mordiendo:** el segmento «activos» de ws1 tenía 1.044
destinatarios; la pantalla prometía 1.044 y el broadcast le llegaba a 1.000, sin un log.
`leadsDeSegmento` pasa por `leerTodo` reusando `filtroSegmento`, así que conteo y lista salen
del mismo filtro. `MAX_DESTINATARIOS` (2.000) se exporta y es el tope real, por diseño: por
encima trunca, y la API de MaKo se niega. El guard de la API comparaba contra un `1000` copiado
a mano y bloqueaba justo el envío a los 1.044 (ver [hallazgos-api-mako.md](hallazgos-api-mako.md)).
**Sin revisar:** si el botón de la pantalla avisa por encima de 2.000.

Los KPIs de email (`getEmailKpis`) ya no bajan filas para contarlas: son 8 conteos
`head: true`, que no se pueden cortar.

**Vive en:** lib/email-marketing.ts (contarSegmento / leadsDeSegmento / enviarBroadcast;
filtroSegmento :245, :262-278, :373, :419) · *2026-06-30 ~auditoria-email-marketing-resend +
2026-09-16 api-mako-areas*

### ⚠️ Una lectura que protege de mandar dos veces falla ABIERTA de dos maneras

Los guards que deciden «a esta persona ya le escribimos» leen una lista y mandan a todos los
que no están en ella. Esa lista se puede quedar corta de dos formas, y las dos se leen igual
que «nadie fue contactado»:

1. **El corte de 1000.** Reanudar un broadcast de más de 1.000 destinatarios veía 1.000 «ya
   enviados», y el resto podía recibir el email dos veces. `leadsYaContactados` y
   `leadsConEnvioReciente` (`lib/nutricion.ts`) leían `wa_mensajes` con `.in('lead_id', ids)`
   sin tope, y **un solo lead de ws1 tiene 1.194 mensajes**: el audio de apertura se le
   presentaba de cero a alguien con quien ya se hablaba, y el anti-ban de 20 h le encimaba otro
   mensaje. Las dos fallas se leen como «MaKo suena a robot», nunca como «faltaron filas».
2. **El error tragado.** `data ?? []` sobre esa lectura: con la base caída, la lista vale `[]`
   y se le escribe a todo el segmento.

**Regla:** la lectura que protege de un doble envío **lanza** si no puede leer, y quien la
llama no manda nada y dice por qué (reanudar un broadcast devuelve un resultado de error, no
tira, para que el cron siga con los demás). Y para «¿este lead tiene al menos un mensaje?» no
se pagina: se pregunta por exclusión (`idsConAlMenosUnaFila`, `lib/ids-con-filas.ts`), una
consulta por vuelta que saca de la lista a los ya encontrados.

**Vive en:** lib/email-marketing.ts (`enviarBroadcast`, `leadsContactadosRecientemente`) · lib/nutricion.ts (`leadsYaContactados`, `leadsConEnvioReciente`) · lib/ids-con-filas.ts · *2026-09-17 caza de paginado*

### ⚠️ Una cola leída con `.limit(N)` sin excluir lo visto relee lo mismo para siempre

Dos colas del motor de nutrición tenían la misma forma: traer N pendientes, procesar las que
se puedan, dejar las otras como estaban. Las que quedan vuelven a salir primeras.

- **`procesarEnvios`** (`lib/nutricion.ts`) ordenaba por `proximo_envio_at` —que se repite—
  con `.limit(LOTE)` (18). Las saltadas por el guard de 20 h no se actualizan, así que la
  vuelta siguiente relee las mismas 18: todas en `vistos`, `due` vacío, el bucle corta. Si las
  18 más viejas están frenadas, no sale nada en esa corrida ni en las siguientes. Ahora excluye
  en la base lo ya visto (`.not('id','in',…)`) y desempata por `id`.
- **`evaluarDesenlaces`** (`lib/nutricion-desenlace.ts`) leía `desenlace is null` con
  `.limit(500)` y sin orden. Ese conjunto no se vacía solo: quedan ahí las secuencias sin
  estrategia, las que están en hand-off y las completadas sin logro. Pasadas las 500, las
  mismas 500 bloqueaban a las nuevas en cada corrida. Ahora lee la cola entera ordenada por `id`.

**Y un truncado que adelanta una decisión:** en la misma función, «qué se mandó» a cada
inscripción era una consulta sin paginar. Cortada, se pierde el mensaje más reciente, el reloj
de silencio arranca de uno anterior, y la secuencia se marca fallida y el lead cambia de etapa
**antes de su plazo**. Truncar no solo pierde filas: decide antes de tiempo. Va por
`lib/nutricion-envios-resumen.ts` (tandas de 200 + `leerPorPaginas`), y si esa lectura falla,
`evaluarDesenlaces` corta con error en vez de decidir sin datos.

**Lo que quedó SIN hacer:** `procesarEnvios` todavía puede trabarse si hay más de 6 × LOTE
inscripciones frenadas a la vez por el guard de 20 h.

**Vive en:** lib/nutricion.ts (`procesarEnvios`) · lib/nutricion-desenlace.ts · lib/nutricion-envios-resumen.ts · *2026-09-17 caza de paginado*

### ⚠️ El hilo de WhatsApp mostraba los 300 mensajes más VIEJOS y escondía el último

**Síntoma:** en un chat largo, el inbox no muestra lo que se acaba de hablar.

**Causa:** `getMensajesDeChat` (`lib/evolution-mensajes.ts`) ordenaba `wa_timestamp`
**ascendente** y cortaba en `.limit(300)`: un tope sobre un orden ascendente se queda con la
punta vieja. Medido el 17/09/2026: 16 chats pasan los 300 (máximo 1.163 en ws1, 1.526 en ws11).
El censo de la corrida lo había dado por bueno como «tope deliberado» —el tope lo era, la
dirección no— y la API de MaKo ya lo sabía: el comentario de `whatsapp.helpers.ts` decía «la lib
devuelve los MÁS VIEJOS», y el arreglo se había hecho solo en la copia de la API
(`mensajesEspejoRecientes`).

**Arreglo:** descendente con desempate por `id` para cortar, y se reordena en memoria para
mostrar. Lo fija `tests/lecturas-sin-corte.test.ts`.

**Regla:** si una capa deja escrito un defecto de otra, el arreglo va en la otra. Una copia
arreglada deja la original rota con un testigo al lado.

**Lo que quedó SIN hacer:** la búsqueda de leads de todas las conversaciones del inbox
(`lib/evolution-mensajes.ts`, ~:320) no tiene tope; hoy son 46 ids por workspace.

**Vive en:** lib/evolution-mensajes.ts (`getMensajesDeChat`) · app/api/whatsapp/evolution/mensajes/route.ts · lib/api-mako/areas/whatsapp.helpers.ts · *2026-09-17 caza de paginado*

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

### ⚠️ `enviarBroadcast` no reclama el broadcast: dos corridas mandan dos veces, y cancelar no frena al cron

**Síntoma esperado:** el mismo lead recibe el broadcast dos veces, o un broadcast cancelado sale
igual. No hay error en ningún lado.

**Causa real:**

- `enviarBroadcast` calcula `yaRegistrados` al arrancar (lib/email-marketing.ts:424-427) y pasa
  a `'enviando'` con un update SIN condición (:432). Solo rechaza `'enviado'` (:407), no
  `'enviando'` ni `'programado'`. Los registros se escriben de a 100 (:436-455). Dos corridas a
  la vez —botón o API más cron, o dos reanudaciones— leen el mismo `yaRegistrados` y les mandan
  a los mismos leads.
- `procesarBroadcastsProgramados` lee los ids y los manda en serie (:518-532): uno cancelado
  DESPUÉS de esa lectura sale igual. `actualizarBroadcast` y `eliminarBroadcast` filtran solo
  por `id` (:336-353).
- `eliminarBroadcast` borra en cascada `email_broadcast_envios`
  (supabase/migrations/0046_email_marketing.sql:47), que es justo de donde lee el guard
  anti-doble-contacto de 20 h (`leadsContactadosRecientemente`, :380-391). Borrar un broadcast
  recién mandado le abre la puerta a otro correo a esos mismos leads en la misma hora.
- Y el presupuesto: corta a los 240 s y registra de a 100 (:446-455). Un llamador con menos de
  300 s de vida que muera antes deja hasta 99 envíos sin registrar, y la reanudación los repite.

**Regla:** una cola que puede correr desde dos lugares se RECLAMA con un update condicional
(`estado in (...)` + `returning id`), y editar, cancelar y borrar llevan la misma condición.

**Deuda, toda en lib/email-marketing.ts:** el reclamo atómico en `enviarBroadcast`;
`actualizarBroadcastSi` / `eliminarBroadcastSi`; y que la reanudación de
`procesarBroadcastsProgramados` reclame con `estado='enviando' and updated_at < now()-10 min`.
No se hizo porque son escrituras de la lib. La API cierra la carrera contra el cron con
`enManosDelCron` (no deja tocar un programado a 2 min o menos de su turno si el envío real está
prendido); sigue abierta la de dos confirmaciones humanas simultáneas.

**Vive en:** lib/email-marketing.ts:336-353, :380-391, :397-513, :518-532 ·
supabase/migrations/0046_email_marketing.sql:47 · *2026-09-16 api-mako-areas*

### El cron de broadcasts solo corre de 13 a 23 UTC: lo programado para la noche de México sale a la mañana siguiente

`vercel.json:57-58` agenda `/api/cron/email-broadcasts` con `*/30 13-23 * * *`. Todo lo
programado entre las 00:00 y las 12:59 UTC —la tarde y la noche de México— sale recién a las
13:00 UTC: un broadcast para las 20:00 de Ciudad de México (02:00 UTC) sale 11 horas tarde.
Nada en /email lo dice: **la fecha guardada es la pedida, no la real.**

Y por eso «enviar ahora» no se puede resolver como «programarlo para ahora y que lo mande el
cron»: fuera de la ventana esperaría hasta 13 horas.

**Regla:** si un cron tiene ventana, lo que programa muestra el primer turno REAL. La API ya lo
calcula (`primerTurnoCron`, lib/api-mako/areas/email.run.ts); la pantalla no. Ampliar la ventana
es decisión de producto.

**Vive en:** vercel.json:57-58 · app/api/cron/email-broadcasts/route.ts · *2026-09-16
api-mako-areas*

### «Secuencias de email activas» según `getEmailSecuencias` no es lo que manda el motor

`getEmailSecuencias` exige que TODOS los pasos sean de email (`esSecuenciaEmail`,
lib/email-marketing.ts:23-25) y no filtra `archivada_at` (:102-107). El motor, en cambio, manda
email por cualquier paso `canal='email'` de cualquier secuencia activa no archivada
(`getSecuenciasActivas`, lib/nutricion.ts:124-131, y la rama de :1256). O sea que cuenta
archivadas que no salen y omite las mixtas que sí. **Cualquier «qué sale si prendo el envío
real» armado con esta función da otro número.**

**Regla:** lo que va a salir se cuenta con la misma selección que usa el motor. La API lo hace
con `alcanceEnvioReal` (lib/api-mako/areas/email.helpers.ts), sin paginar a propósito: son
decenas de secuencias.

**Vive en:** lib/email-marketing.ts:23-25, :102-148 · lib/nutricion.ts:124-131 · *2026-09-16
api-mako-areas*

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
- **Conectar/desconectar el dominio de envío y generar copy con IA no tienen función de lib**
  (2026-09-16): viven inline en `app/api/email/dominio/route.ts` (con la consulta de
  titularidad cross-workspace adentro) y en `app/api/email/generar/route.ts`. Por eso la API de
  MaKo no los ofrece: hacerlo era duplicar la lógica de la ruta.
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

### ⚠️ El reporte horario no distingue «sin alertas» de «no pude mirar»

**Síntoma:** con Meta o la base caídas, el reporte horario dice «Todo tranquilo ✅». En
producción eso se ve como SILENCIO: el cron solo despacha si hay alertas
(app/api/cron/reporte-horario/route.ts:39), así que una fuente caída y una hora sin problemas
mandan lo mismo: nada. El texto verde aparece donde se pide la vista previa (`generar_reporte`
de la API de MaKo, lib/api-mako/areas/equipo.run.ts:312).

**Causa:** `buildReporteHorario` (lib/reportes.ts:95-151) envuelve cada sección —salud de Meta,
cuotas, fatiga de adsets, pendientes del CRM— en `catch { /* ignorar */ }` y, si no juntó
alertas, arma «Todo tranquilo ✅» con título «Todo en orden» (:144-148). El diario sí escribe
«no disponible» en cada sección, salvo pendientes (`catch { /* opcional */ }`, :74-82); el
semanal calla igual las cuotas por cobrar (:183-191). La cabecera del módulo lo presenta como
virtud: «si una fuente falla, el reporte se arma igual sin esa parte» (:5-6). Armarse igual está
bien; callar que faltó una parte, no.

**Regla:** un reporte que no pudo leer una fuente lo dice en esa sección; «todo tranquilo» solo
sale si se miró todo.

**Lo que quedó SIN hacer:** que `buildReporte*` devuelva la lista de secciones caídas. La vista
previa de la API de MaKo avisa que puede haber fallado algo (equipo.run.ts:316-322), pero no
puede saber QUÉ.

**Vive en:** lib/reportes.ts:95-151 (catch vacíos del horario), :74-82 (pendientes del diario),
:183-191 (cuotas del semanal) · app/api/cron/reporte-horario/route.ts:39 · *2026-09-16
api-mako-areas*

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

**16/09/2026: quitar el ÚLTIMO teléfono no limpia `mako.numero_dueno`.** Hoy la fuente es la
lista `notif_telefonos`, y `setDestinatarios` escribe los tres juntos — salvo con la lista
vacía: escribe `notif_telefonos=[]` y `user_telefono=''` y sale con `'sin_numeros'`
(lib/notif-destinatarios.ts:148-158) antes de llegar a `setNumeroDuenoYSync`, que es quien
escribe el singular. Los reportes se cortan, pero la persona sigue en el grupo —quitar a alguien
no lo echa, a propósito (:121-124)— y `mako.numero_dueno` queda con su número. El único lector
de esa clave es `getNumeroDueno` (lib/mako-grupo.ts:398): `getDestinatarios` ya no cae a él
porque `[]` cuenta como lista guardada (notif-destinatarios.ts:81-84), y `setNumeroDuenoYSync`
lo usa como «anterior», así que volver a cargar ese mismo número da `sin_cambios` y no intenta
sumarlo al grupo (mako-grupo.ts:416-428).

⚠️ **Y del otro lado: sumar un destinatario es darle un lugar en el grupo, y el grupo es un
canal de admin.** Cada teléfono después del primero entra como participante
(lib/notif-destinatarios.ts:184-194). El doer contesta en el grupo oficial del workspace sin
mirar quién escribe —`key.participant` solo aparece en el tipo (lib/mako-doer-in.ts:122)— y
corre con `rol: 'admin'` y `alcance: 'ejecutar'` (:830), con las pendientes de confirmación
del GRUPO a la vista (:808-810). Un contador o una asistente cargados para recibir reportes le
piden a MaKo lo mismo que el dueño, incluido el «sí» que confirma una acción de chat, y siguen
pudiendo después de que se los saca de la lista. **Sin hacer:** que el doer resuelva el rol por
el remitente, o que la pantalla de destinatarios diga que sumar a alguien le da ese acceso.

**Vive en:** lib/mako-grupo.ts:244 (setNumeroDuenoYSync) · lib/perfil.ts:122
(getContactoReportes) · app/api/cron/reporte-diario/route.ts:27 ·
app/perfil/NotificacionesPanel.tsx:96 · lib/notif-destinatarios.ts:148-158, :184-194 ·
lib/mako-doer-in.ts:830 · *2026-08-06 rediseno-notificaciones + 2026-09-16 api-mako-areas*

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

### ⚠️ `AVISOS_WA_EN_VIVO` no es la lista de lo que se dispara, y su propio comentario jura que sí

**Síntoma:** una lectura (o una pantalla) dice que un aviso «no se dispara» mientras le sigue
llegando al grupo. Y ese aviso no se puede apagar desde Notificaciones: el panel pinta solo esa
lista (app/perfil/NotificacionesPanel.tsx:365).

**Causa:** la lista (lib/notif-catalogo.ts:159-173) está escrita a mano y es la curada que
pinta Configuraciones › Notificaciones. El choke point (`emitirAviso` → `avisoWaActivo`,
lib/avisos.ts:135) respeta el interruptor de CUALQUIER tipo, y hoy salen avisos que no están en
ella: `reunion-recordatorio` (lib/reunion-recordatorio.ts:120), `meta-cuenta-frenada` y
`meta-cuenta-recuperada` (lib/alerta-critica.ts:219, :155), `lead-de-landing`
(app/api/track/optin/route.ts:198, :259), `lead-fusionado` (lib/leads.ts:415), `landing-cambio`
y `tracking-desactualizado` (app/api/cron/tracking-vigilante/route.ts:127, :234),
`clarity-grabacion-por-vencer` (app/api/cron/clarity-vigilante/route.ts:132), entre otros.

**El diagnóstico escrito era el equivocado.** La cabecera del módulo (lib/notif-catalogo.ts:16-26)
dice que `yaImplementado` miente —cierto— y que «lo único confiable es quién llama de verdad a
emitirAviso/emitirDelCatalogo, y eso es lo que lista este array» — falso. La misma creencia está
copiada en docs/api-mako-inventario.md:2091. Y ningún control sabe qué avisos del catálogo no
tienen emisor: el único test que cruza catálogo contra emisores (tests/alerta-critica.test.ts:40-57)
mira solo los rojos marcados `'si'`.

**Regla:** qué se emite se deriva de los emisores, no de una lista a mano. La API de MaKo ya lista
y deja silenciar todo el catálogo de voz, con la marca `en_configuraciones`
(lib/api-mako/areas/equipo.run.ts:22-27).

**Lo que quedó SIN hacer:** actualizar la lista y su comentario (o renombrarla: el nombre miente),
y un test en `tests/` que cruce los `emitirDelCatalogo('…')` y los `tipo:` de `emitirAviso`
contra el catálogo, en las dos direcciones.

**Vive en:** lib/notif-catalogo.ts:16-26, :159-173 · lib/avisos.ts:135 ·
app/perfil/NotificacionesPanel.tsx:365 · *2026-09-16 api-mako-areas*

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

**Y lo que dice «Meta» depende de Chatwoot (2026-09-16).** `submitTemplate`, `listMetaTemplates` y
el resto de lib/meta-templates.ts sacan token y WABA de `getWabaConfig`, que los lee del
`provider_config` del inbox de Chatwoot del workspace (lib/chatwoot.ts:584-593). Sin Chatwoot
conectado no hay plantillas de Meta, aunque la operación declare la integración `meta`.

**Vive en:** lib/chatwoot.ts:585 (getWabaConfig) · lib/meta-templates.ts:275 (enviarBorradorAMeta) ·
*2026-07-09 f33-understand + 2026-09-16 api-mako-areas*

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
| Archivar todas las secuencias | `POST /api/chat-agent/secuencias {action:'archivar'}` (`route.ts:139-144`) | archiva, no borra; reversible con `desarchivarSecuencia` — ⚠️ que la devuelve PRENDIDA si lo estaba (ver «Archivar una secuencia no la pausa», en Nutrición) |
| Reabrir la tab | `POST /api/chat-agent/onboarding {action:'reabrir'}` (`route.ts:57-59`) | resetea la tab **entera**, no un paso, y **no tiene ningún caller en la UI** |

Para volver un paso solo, se escribe `onboarding.tab.setting.steps.<paso>.done = false` en
`app_settings`. ⚠️ Y no copiar `scripts/wipe-chart-chats.mjs` como molde: `:20-21` hace
`DELETE FROM chart_chats` **sin `workspace_id`**.

**El orden importa:** resetear antes de arreglar el catálogo no sirve de nada — el cliente
regraba exactamente el mismo audio equivocado, porque `lib/audios-paso.ts:44,47` no cambió. El
reset es el último paso.

**Vive en:** `lib/reset-workspace.ts` · `lib/auth-session.ts:73-81` · `app/api/chat-agent/audios/route.ts:128-145` ·
`app/api/chat-agent/onboarding/route.ts:57-59` · `lib/secuencias-huecos.ts:90-123` · *2026-08-10 ~chatbot-funnel-leila*

### ⚠️ Enseñar un caso desde un hand-off no hace nada si la secuencia ya tiene 30

**Síntoma:** un caso enseñado desde un hand-off no aparece nunca en la estrategia de la
secuencia, y el hand-off figura resuelto.

**Causa real:** `escenariosDe` corta en 30 al PARSEAR (lib/setting-estrategia.ts:117-128), y
`resolverHandoff` agrega el caso nuevo AL FINAL sin mirar ese tope
(lib/chat-agent-handoff.ts:196). Se escribe en la base como el número 31 y la próxima lectura lo
recorta: se pierde justo el más nuevo. El hand-off se marca resuelto igual (:203-205).

**Regla:** un tope de lectura sin tope de escritura tira lo último que entró. Si hay tope, se
valida al escribir y se dice.

**Vive en:** lib/setting-estrategia.ts:117-128 · lib/chat-agent-handoff.ts:181-205 · *2026-09-16
api-mako-areas*

### ⚠️ Dos escritores reemplazan `mako.voz_guia` entera, y el comentario que la cuida solo cubre el caso vacío

**Síntoma:** la guía de voz destilada desde los anuncios desaparece después de contestar una
pregunta del onboarding, o al revés.

**Causa real:** son dos procesos que derivan el MISMO texto de fuentes distintas y lo escriben
entero en la misma clave:

- `destilarVoz` la arma desde las transcripciones de anuncios y el perfil de marca
  (lib/nutricion-generator.ts:103-123 → `setVozGuia`, :94-96).
- La ruta de contexto del onboarding la recompone desde la evidencia de las charlas y las
  respuestas manuales con `componerVozGuia`
  (app/api/chat-agent/onboarding/contexto/route.ts:75-76 y :157-158).

Gana el último que escribe; no hay merge. El comentario de la ruta dice «NUNCA escribir una
guía vacía: borraría la que destila el generador» — y una NO vacía la borra igual.

**Regla:** dos procesos que derivan el mismo dato escriben en dos claves y se componen al LEER
(AGENTS.md → «Dos escritores con dos ritmos son dos claves»).

**Vive en:** lib/nutricion-generator.ts:25, :94-123 ·
app/api/chat-agent/onboarding/contexto/route.ts:75-76, :157-158 ·
lib/api-mako/areas/chatbot.helpers.ts (el escritor de la API) · *2026-09-16 api-mako-areas*

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
- **Varias acciones de la tab del chatbot no tienen función de lib, y por eso no están en la
  API de MaKo** (2026-09-16). `sugerir()` —gancho, preguntas de calificación, criterio— vive inline en
  `app/api/chat-agent/secuencias/route.ts:101`; el guion del audio, el ensayo y guardar un caso
  del ensayo viven inline en `app/api/chat-agent/onboarding/*`. Y `lib/nutricion.ts` no exporta
  inscribir ni cancelar UN lead en UNA secuencia: `archivarSecuencias` cancela todas y
  `pausarPorRespuesta` es otra semántica. Sin esa función no hay un camino gateado para
  ofrecerlo por fuera de la pantalla.
- **Lecturas laxas de mapas en app_settings** (2026-09-16). `mapaAudios`
  (lib/secuencias-audios.ts:91-95) lee con `getSetting`, que convierte un error de base en `{}`
  (ver «getSetting devuelve null…» en hallazgos-infra.md). Y para leer estricto, la API tuvo que
  repetir dos claves privadas: `mako.entregable` (`SETTING_KEY`, lib/entregable.ts:38) y
  `mako.chat_agent.voz.manual` (`KEY_MANUAL`, lib/chat-agent-voz.ts:81). Faltan
  `getEntregablesEstricto` / `getManualEstricto` en esas libs.
- **La ventana de «últimos 30 días» de las métricas del chatbot es UTC**: `getSettingData`
  resta 30×24 h desde ahora (lib/setting-secuencias.ts:27), no cuenta días en la zona del
  workspace (2026-09-16).

---

## La secuencia decia «Activa» cinco dias con el numero caido, y el motor tiraba el motivo

**Vive en:** `lib/nutricion.ts` (el insert en `nutricion_envios`, `leadsConEnvioReciente`) ·
`app/api/chat-agent/secuencias/route.ts` · `app/chatbot/ChatAgentApp.tsx`

**Sintoma:** se prendio la secuencia de post-agenda del ws1 y se pregunto si iba a
**chocar** con la automatizacion oficial de n8n, que ya le escribe a los agendados. La
tab mostraba la secuencia Activa, con sus tres pasos, sus dos audios y el flag
`envio_whatsapp_enabled = true`.

**Causa real: no habia choque porque no salia NADA.** La sesion de Evolution del ws1
(`mako_ws1`) esta en `desconectado` desde el **2026-09-03T04:17**. El unico envio real de
la secuencia —al unico lead del cohorte, Gerardo Avila, el 08/09 a las 12:00 de Mexico—
cayo en la rama `!evoConectado`, quedo en `'fallo'` y se reprogramo +24 h. Va a repetir
ese ciclo para siempre.

**Lo que hizo caro el diagnostico: el motivo se calculaba y se tiraba.** Cada rama del
envio llena una variable `nota` («WhatsApp de empresa no conectado», «el audio del paso ya
no existe», el error del proveedor) y el `insert` en `nutricion_envios` **no la escribia**:
la columna `error` quedaba en `null`. Desde afuera, un numero caido, un audio borrado y un
rechazo del proveedor son la misma fila. Reconstruirlo costo cinco consultas.

**Como se separo «Evolution caido» de «se cayo la sesion de el»:** el ultimo mensaje
espejado por workspace. El ws11 espejo uno el mismo dia; el ws1, hace 5,6 dias. Con un
solo workspace ese dato no dice nada — es la regla de «con UN solo valor configurado no se
puede saber si lo leas del lugar correcto», aplicada a un diagnostico.

⚠️ **CORRECCION (mismo dia, tras el «revisalo» del dueño). Aca arriba decia que
`EVOLUTION_BASE_URL` estaba «presente pero vacia» en `.env.local` y que por eso no se podia
medir en vivo desde local. ERA FALSO, y las dos mitades del error valen mas que la
conclusion:**

1. **`grep -o "^NOMBRE="` IMPRIME SOLO LO QUE MATCHEA, o sea el nombre y el `=`.** El
   valor nunca entra en la salida. Miré `EVOLUTION_BASE_URL=` y leí «esta vacia» sobre un
   comando que, por diseño, no puede mostrar un valor. Para preguntar si una env var tiene
   valor va `grep -c '^NOMBRE=..'` (dos puntos = al menos un caracter despues del `=`), que
   contesta sin imprimir el secreto.
2. **El script de chequeo no cargaba `.env.local` en absoluto.** No tenia `dotenv`, asi que
   `evolutionConfigurado()` daba `false` porque no habia NINGUNA env, no porque faltara una.
   Un script suelto en `scripts/` no hereda el entorno de Next: `config({ path: '.env.local' })`
   va **antes** de cualquier import que toque el modulo, porque los modulos leen
   `process.env` al cargarse.

**Las dos fallan igual: producen un «no configurado» que se lee como una medicion.** Y las
dos me llevaron a escribir «no se puede medir en vivo» sobre algo que se medía perfecto.
Con el entorno cargado de verdad, la API viva contesta `socketVivo: false` y
`estadoEnVivo: 'desconectado'` — o sea que la conclusion aguanto, pero **por casualidad**:
la fila y la API coincidian. El dia que discrepen, este metodo no lo habria visto.

**La regla: un chequeo que contesta «no configurado» tiene que distinguir «falta el valor»
de «no cargué el entorno», o no es un chequeo.** Es la misma familia que «"No puedo hacer X
con este dato" no es "este dato es falso"», aplicada al que verifica.

**Lo que quedo:**

1. `error: nota ?? null` en el insert. Un fallo que no dice por que es indistinguible de
   cualquier otro fallo.
2. **El estado del numero viaja en el GET de la tab y se pinta en la pantalla de
   TRABAJO.** Antes vivia solo en `OnboardingChatAgent.tsx`, o sea que el dueno dejaba de
   verlo justo cuando terminaba el onboarding. El aviso solo sale si hay alguna secuencia
   **activa**: con todo pausado, un numero desconectado no rompe nada.
3. Tres estados, no dos: `sin_vincular` (nunca lo conecto), `desconectado` (se cayo) y
   `desconocido` (no pudimos preguntarlo). El tercero **no acusa nada**.

**Y el punto ciego que NO se puede cerrar desde aca.** `leadsConEnvioReciente` —el guard
anti-ban de 20 h— leia solo `nutricion_envios` y `email_broadcast_envios`, o sea solo lo
que mando la app. Se le sumo `wa_mensajes` con `from_me = true`, que cierra el caso del
dueno escribiendo a mano desde su telefono. **Lo que sigue invisible es el canal
OFICIAL**: lo que sale por Meta/n8n no toca ninguna de las tres tablas, y el espejo es de
Evolution. Mientras una automatizacion de afuera le hable a los mismos leads, ningun guard
nuestro puede saberlo — no es un descuido, es el limite de lo que se puede medir, y por eso
esta escrito en el codigo.

⚠️ **Era el mismo punto ciego que `leadsYaContactados`, una funcion mas arriba, y ese se
habia arreglado el mismo dia.** Dos funciones vecinas que hacen la misma pregunta a la
misma base tienen el mismo agujero; arreglar una y no mirar la de al lado es como se paga
dos veces.

*(Corrida del 08/09/2026, revisando si la post-agenda recien prendida chocaba con n8n.)*

## «Conectado» se pintaba desde la fila, y la confirmacion era de un solo lado

**Vive en:** `lib/evolution.ts` (`sondearSocket`, `estadoEnVivo`) ·
`app/api/whatsapp/evolution/route.ts` (GET) · `app/whatsapp/EvolutionConnect.tsx` ·
`app/whatsapp/WhatsAppApp.tsx` · `lib/canal-vigilante.ts` ·
`app/chatbot/OnboardingChatAgent.tsx`

**Sintoma:** el dueno miro la barra de /whatsapp y dijo «aca me dice que esta todo
conectado», con el numero caido hacia cinco dias y la nutricion fallando en silencio.

**Lo que la barra decia de verdad — y por que se leia al reves.** Tres chips en fila:
«API Oficial» VERDE, «API no Oficial: conectar» GRIS, «Envio real: ON» VERDE. El del medio
significaba desconectado, y fallaba de tres formas a la vez: el rotulo era un INFINITIVO
(una invitacion, no un estado), el estilo era NEUTRO (gris = «opcion disponible», no «esto
esta roto») y «no conectado» tapaba a «no pude preguntarlo» — `estado` arranca en
'desconectado' antes del primer fetch. **El color no era el unico portador: no habia
ninguno.**

Y «Envio real: ON» afirmaba la MITAD BUENA de un proceso de dos pasos: cierto sobre el
FLAG, falso sobre el SISTEMA.

⚠️ **Y UN NIVEL MAS ABAJO, EL VERDE SALIA DE LA FILA.** `evolution_instancias.estado` lo
escribe el webhook con el `state` de Evolution — el campo del que este repo ya tiene medido
que miente en las dos direcciones. O sea que arreglar el chip del caso desconectado dejaba
vivo el caso peor: decir «conectada» en verde, con el numero al lado, sobre una sesion
muerta. Lo encontro una corrida de 152 agentes; era el hallazgo #1 de 23.

**La confirmacion existia y era de un solo lado.** `estadoEnVivo` confirmaba el `open` con
una operacion real y aceptaba el `close` a ojos cerrados, **sobre el mismo campo que se
sabe mentiroso en los dos sentidos**. Un chequeo que solo desconfia cuando la respuesta le
gusta no es un chequeo: es un sesgo. Y el lado que faltaba es el caro — un `close` falso,
con el chip nuevo, manda a re-escanear un QR, y re-escanear TUMBA la sesion viva.

**No hay sonda barata. Medido el 08/09/2026 buscando reemplazo:**

| endpoint | mako_ws1 (MUERTA) | mako_ws11 (viva) |
|---|---|---|
| `connectionState` | 200 `close` | 200 `open` |
| `fetchInstances` | 200 `connecting` | 200 `open` |
| `fetchAllGroups` | **500 Connection Closed** | 200 · **TIMEOUT a los 30s** |
| `whatsappNumbers` | **200** (miente) | 200 |
| `fetchProfile` | **200 con todo en null** (miente) | 200 con foto |

Los dos candidatos baratos contestan **200 sobre la sesion muerta** — el «200 con el fallo
adentro» de siempre. El unico que exige el socket es traer los grupos, y en una cuenta con
muchos grupos no termina. **La respuesta a una sonda cara no es una sonda peor: es un
presupuesto por llamada.** El GET le da 4s; si no llega, no afirma — devuelve la fila con
`confirmado: false` y el chip lo dice («conectada segun el ultimo registro, sin
confirmar»), con borde punteado en vez de verde pleno.

**Y «no pude preguntar» dejo de decidir cosas.** Era un booleano (`socketVivo`) y ahora son
tres (`sondearSocket`: vivo / muerto / sin_respuesta), porque de ese booleano colgaban tres
acciones destructivas:

1. `estadoEnVivo` **persistia** 'error' en la fila que lee el MOTOR — un corte de red de
   dos segundos quedaba escrito como desconexion. Ahora no se guarda lo que no se midio.
2. `vigilarVozMaKo` mandaba un email AFIRMANDO que la sesion estaba caida y mandando a
   re-escanear. Ahora `sin_respuesta` sale sin tocar la marca.
3. El onboarding ofrecia «Generar codigo QR». **Su comentario describia exactamente este
   bug y la linea de al lado lo dejaba pasar por la otra puerta**: el guard cubria la
   EXCEPCION, y la API devuelve `estado: 'error'` como valor valido, asi que
   `j.ok && j.estado` daba verdadero.

**La regla que queda: cuando un booleano decide una accion IRREVERSIBLE, contá cuantos
estados del mundo colapsa.** Si «no se» cae del mismo lado que «no», la accion se va a
disparar sobre la duda.

*(Corrida del 08/09/2026, 152 agentes. 23 hallazgos confirmados, 26 refutados; los que
quedaron sin arreglar estan listados al final de esta entrada.)*

**Lo que quedo SIN hacer, con el archivo:**
- `app/whatsapp/ChatwootWebhookChip.tsx:94` — el chip «API Oficial» se pinta VERDE cuando
  `salud === null`, que cubre «no configurado», «fallo el fetch» y «cargando». Es el mismo
  bug del otro chip, sin arreglar.
- `lib/setting-metricas.ts:36` · `lib/nutricion.ts:171` · `lib/email-marketing.ts:61` —
  **ningun contador de la app cuenta los FALLOS**, y los «N enviados» incluyen los
  simulados. El KPI puede contradecir al banner de al lado.
- `app/perfil/NotificacionesPanel.tsx:208` — «MaKo puede avisar por WhatsApp» se decide con
  «hay un telefono cargado»: mide el destino, no el emisor.
- `app/agencia/PlantillasView.tsx:122` — los ~48 avisos se muestran «Activa» aunque su
  deteccion no exista, incluido «WhatsApp de empresa desconectado», que es justo el que
  habria cazado este caso.
- `lib/mako-canal.ts` — confirma el socket en un solo sentido, igual que estaba
  `lib/evolution.ts`. No se toco por ser trabajo en vuelo de la sesion vecina.
- `lib/evolution.ts:187-194` — **`getInstanciaRow` no mira el `error` de Supabase** y devuelve
  `null`. El `.catch(() => undefined)` de `app/api/chat-agent/secuencias/route.ts:64` es codigo
  muerto: con la base caida la tab dice `sin_vincular` y el tercer estado de la entrada
  anterior (`desconocido`) nunca sale por ahi. Y `estado` es el ultimo guardado, no una sonda.
  La API consulta `evolution_instancias` directo por eso. *(2026-09-16 api-mako-areas)*

## «Desconectado» no le dice nada al dueño: su TELEFONO anda

**Vive en:** `lib/evolution.ts` (`motivoCaida`) · `app/api/whatsapp/evolution/route.ts` ·
`app/api/chat-agent/secuencias/route.ts` · `app/whatsapp/EvolutionConnect.tsx` ·
`app/chatbot/ChatAgentApp.tsx`

**Sintoma:** con el aviso ya arreglado y midiendo bien, el dueño contesto: *«no entiendo…
aca me sigue diciendo que el WhatsApp esta desconectado, pero me voy a la tab de WhatsApp
de Mauricio y esta perfecto, cargan los ultimos chats, se puede enviar mensajes»*.

**Tenia razon en las tres cosas, y ninguna contradecia el diagnostico:**

1. **Su telefono anda.** La app NO usa su telefono: usa un **dispositivo vinculado** por
   QR. Ese se cae solo y no se nota desde el telefono — salvo mirando «Dispositivos
   vinculados», que nadie mira.
2. **«Cargan los ultimos chats»** es NUESTRO espejo en la base. Se ve igual con la sesion
   viva o muerta. Los chats que veia eran del 03/09 y anteriores: el espejo congelado.
3. **«Se puede enviar mensajes»** era el composer, que se dibuja siempre.

**La medicion que lo cierra — el espejo por dia, ws1:**

| dia | entran | salen |
|---|---|---|
| 2026-09-01 | 107 | 137 |
| 2026-09-02 | 66 | 78 |
| 2026-09-03 | 10 | 9 |
| 2026-09-04 … 09-08 | **0** | **0** |

Venia capturando 60-180 por dia; el 03/09 alcanzo a agarrar 19 y despues cinco dias en
cero. Ese numero no pasa cinco dias sin un mensaje.

⚠️ **Y LA PRIMERA VERSION DE ESA TABLA DECIA QUE EL ESPEJO MORIA EL 24/08.** Los conteos
sumaban **exactamente 1000**: el tope de PostgREST, no un dato. Es la trampa que este
mismo AGENTS.md documenta («un numero redondo es una hipotesis de truncamiento») y se
cayo en ella igual, sobre una consulta escrita para probar un diagnostico. Paginando con
`.range()` el total real es 2799 y la foto cambia por completo.

**LA CAUSA EXACTA, que Evolution guardaba y la app no miraba nunca.**
`/instance/fetchInstances` trae tres campos que ningun consumidor leia:

    mako_ws1   connectionStatus=connecting  disconnectionReasonCode=403
               disconnectionAt=2026-09-03T08:42:25.322Z
    mako_ws11  connectionStatus=open        disconnectionReasonCode=null

El **403 de Baileys es «WhatsApp cerro la sesion»**: el dispositivo fue desvinculado. Por
eso queda en `connecting` para siempre —un 403 no se reconecta solo— y la unica salida es
escanear un QR nuevo. La fecha coincide al milisegundo con el `ultimo_evento_at` de
nuestra fila.

**La regla que queda: un aviso que describe NUESTRO estado no es accionable; uno que
nombra un HECHO del mundo del usuario, si.** «Tu WhatsApp esta desconectado» lo mando a
mirar su telefono, encontrarlo bien y descartar el aviso. «WhatsApp cerro la sesion del
dispositivo vinculado el 3 de septiembre — tu telefono esta bien» nombra algo que puede ir
a comprobar, y le dice donde.

Y el corolario del dato: **el motivo ya estaba, a una llamada de distancia.** No hubo que
inventar nada ni agregar una columna — solo mirar el campo que el proveedor ya devolvia.
Antes de escribir un aviso vago, revisa que trae la respuesta que ya pedis.

⚠️ `motivoCaida` solo se consulta cuando el canal esta CAIDO: en el camino feliz seria una
llamada de mas en cada carga de pantalla. Y distingue 403/401 («te desvinculo», hay que
re-escanear) de cualquier otro codigo (un corte, que puede volver solo) — mandar a
re-escanear sobre un corte tumbaria la sesion que estaba por volver.

*(Corrida del 08/09/2026, a partir del «no entiendo» del dueño.)*

## La post-agenda «prendida» no podía mandar un solo audio, ni con la línea conectada

**Vive en:** `lib/nutricion.ts` (la rama del audio: `esLeadCliente` → `crearBorrador`) ·
`lib/evolution-envio.ts` (`esLeadCliente`) · `lib/nutricion-desenlace.ts` ·
`lib/setting-estrategia.ts` (`silencioCumplido`) · `lib/nutricion-canal.ts`

**Síntoma:** la secuencia de audios a agendados se prendió el 8/9 en ws1 y al 17/9 no había
salido un solo audio. El diagnóstico heredado era «la línea de Mauricio está caída: que
re-vincule el QR y listo».

**⚠️ El diagnóstico era correcto y NO alcanzaba.** Con la línea conectada tampoco iba a salir
nada: el motor manda automático **solo a quien ya pagó** (`esLeadCliente` exige
`fecha_primer_pago`); a todos los demás les deja un **borrador** para que alguien lo mande a
mano. Es una regla vieja del PDF («a leads calientes NUNCA se dispara automático») que se
cruza con la decisión del 8/9 de que los audios a agendados salgan solos (08-T09). Un
agendado, por definición, no pagó. Medido: **0 de 4** leads inscriptos tenían pago. O sea
que re-vincular la línea iba a convertir «falla cada 24 h» en «4 borradores que nadie mira».

**La regla que queda: antes de decir «esto se destraba con X», recorré el camino ENTERO
hasta el envío.** La primera rama que corta (la línea caída) tapa a la segunda (el
borrador), y arreglar la primera deja la segunda a la vista recién en producción.
**Decidido (Martín, 17/09): excepción POR SECUENCIA, no apagar la regla.** Cada estrategia
tiene `envio_automatico` (solo un `true` literal lo prende; default `false`, así que lo viejo
sigue igual). El motor manda solo si `sec.envio_automatico || esLeadCliente(lead)`. Las
post-agenda de audios nacen con `true`; en ws1 se prendió en 212 y 213 (7c0d1d68). La
bienvenida (198) quedó sin prender: activarla con auto-envío le escribe a un backlog de 126
leads, 66 de más de 14 días, con un texto que dice «vi que dejaste tus datos».
No confundir con `modo: 'automatico'`: ese decide qué pasa cuando el lead CONTESTA; esto,
qué pasa con lo que SALE.

⚠️ **PRENDER una secuencia no la aplica «de acá en adelante»: la inscribe sobre todo el
acumulado.** El cron (`comprometerInscripciones`) toma la cohorte entera de `VENTANA_DIAS = 30`,
y el camino por evento del webhook (el «de acá en adelante») es solo una de las dos entradas.
El «filtro duro de antigüedad» que Mauricio fijó el 31/07 para la bienvenida —«si pasan días…
nos van a tratar como extraños»— nunca se había implementado. Medido el 17/09 sobre la 198
(`instant_form_sin_agenda`): sin tope entran **125**; con 24 h, 5; con 48 h, 11; con 72 h, 15;
con 7 días, 32. Ahora es `estrategia.antiguedad_max_horas` (de5b4c56), `null` = sin tope. Vale
en el plan, en el commit y en `enrolarPorEvento` — **y otra vez al mandar el primer paso**, que la
primera versión no hacía: con la línea caída una inscripción espera días, y un lead que entró con
2 h recibía la bienvenida con 5 días. Ahí se cierra sin mandar, como el recordatorio de una
reunión que ya pasó. Cableado cuidado por `tests/antiguedad-cableada.test.ts`. **Regla: antes de activar una secuencia,
contar cuántos entran EN LA PRIMERA CORRIDA**, no cuántos van a entrar por día.

⚠️ **La trampa que casi lo deja muerto al nacer: guardar la estrategia la RECONSTRUYE
campo por campo.** `app/api/chat-agent/secuencias/route.ts` pasa el body por
`parseEstrategia`, así que un campo que el cliente no manda vuelve en su default. El perfil
de la secuencia armaba el objeto a mano, sin el campo nuevo: **cambiar el gancho APAGABA el
auto-envío sin decir nada**. Lo mismo el wizard de redacción, que reescribe la estrategia
entera. **Regla: un campo nuevo de `Estrategia` se busca en TODOS los que la escriben**
(`SecuenciaPerfil.guardar`, `SecuenciaWizard`, `secuencias-audios.estrategiaDe`, y los que
hacen spread: `chat-agent-handoff`, `setting-secuencias`, `chatbot.run`). El typecheck no
avisa: el campo es obligatorio en el tipo, pero `{...est, x}` y los literales parciales
pasan igual.

**Y de paso, dos bugs del desenlace que sí se arreglaron:**

1. **El fallo por silencio solo podía dispararse en el momento equivocado.** Corría con la
   inscripción `activa` —o sea A MITAD de la secuencia, matando el recordatorio de 24 h con
   `falloHoras = 12`— y nunca al terminar, porque el motor pasa la inscripción a
   `completada` justo en el último paso. Sin nada enviado, contaba desde la inscripción:
   las 4 de ws1 quedaron en `no_responde` con `ultimo_paso_at = null`. El tipo decía
   «tras el último paso»; la línea hacía otra cosa.
2. **El aviso al dueño afirmaba lo que no pasó**: «le mandé el audio y le insistí: no
   contestó» salía siempre, incluso sobre leads a los que no les salió nada. Ahora el texto
   sale de los envíos con estado `enviado`, y `ultimo_paso_at` no sirve de base porque el
   motor lo escribe también sobre un borrador.

**El motor dejó de creerle a la fila.** `evoConectado` salía de
`evolution_instancias.estado`; ahora decide la sonda viva y la fila queda para cuando la
sonda no contesta (y el fallo lo dice). Una por corrida, ~250 ms.

⚠️ **Un chequeo que pasa mientras lo que mira está apagado no está probado.** El script
`partir-post-agenda.ts` verificaba «no más de una secuencia viva», pasó el 8/9 con las dos
mitades pausadas, y el 17/9 —con las dos prendidas, como deben estar— acusó de «solapadas» a
dos secuencias excluyentes por diseño. Ahora mira triggers repetidos.

⚠️ **Y el `dev-areas` test falla en todo checkout limpio**: el área `local-dev-environment`
declara `.claude/settings.local.json`, que no está versionado. En el clon donde se trabaja
existe y pasa; en un worktree —el camino que manda AGENTS.md cuando el árbol compartido no
compila— falla. *Sin arreglar: vive en `app/admin/dev/areas.ts`.*

*(Corrida del 17/09/2026, tareas 08-T14 y 08-T17 del reparto de las llamadas del 8 y 9/9.)*

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

**Y con la decisión tomada, la lectura sigue escribiendo (2026-09-16).** El guard de arriba
cubre solo «sin resolver». Resuelta, `estadoConexionIg → listAccounts → profileIdEfectivo →
ensureProfile` hace el upsert de `zernio_workspace` la primera vez, y con BYOK
(`profile_id: null`) pide `GET /v1/profiles` y llama a `upsertRouting('zernio', …)` en CADA
lectura (lib/zernio.ts:154-172, :214-222). Cualquier «¿está conectado Instagram?» —incluida la
operación de la API que sale por HTTP, y el inbox de la API— es una escritura de ruteo del
webhook más un pedido de más a Zernio. Idempotente, pero no es una lectura. **Deuda:** una
variante de solo lectura de `listAccounts`. No se hizo desde afuera porque `cfg` y `zFetch` son
privados de lib/zernio.ts, y reimplementar el cliente duplicaría la resolución de la key BYOK o
de plataforma, que es justo lo que no puede divergir.

Del mismo camino: `cuentas.find(c => c.isActive !== false) ?? cuentas[0]`
(app/instagram/ig-datos.ts:131) devuelve una cuenta INACTIVA como «la conectada» si no hay
ninguna activa. El inbox y el envío usan ese `accountId` y fallan en Zernio con un error que no
dice «la cuenta está desconectada».

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

### ⚠️ `generarBorradorIg` no es «redactar»: pisa el borrador corregido, avisa aunque nadie escribió y puede mandar sola

**Síntoma:** rehacer el borrador de un DM —desde un agente o una persona, sin ningún mensaje
nuevo— le manda al dueño «@x respondió por Instagram» y reemplaza el texto que alguien ya había
corregido a mano.

**Causa real, las tres en la misma función (lib/ig-chatbot.ts):**

1. **Pisa.** Si la conversación ya tiene un borrador, le hace `update` del texto (:168-184). Lo
   corregido a mano se pierde. Y como el webhook de Zernio la corre en cada DM entrante, el
   texto de un borrador puede cambiar entre que alguien lo lee y lo aprueba.
2. **Avisa siempre.** El aviso al dueño sale al final, dispare quien dispare (:210-220), con la
   clave `wa-mensaje-entrante` (ver «Lo que quedó SIN hacer»).
3. **Manda.** Relee `ig_auto_respuesta` y la ventana DESPUÉS de redactar y envía sola si los dos
   están prendidos (:201-208). No hay un modo «solo redactar»: quien la llama para rehacer tiene
   que chequear antes, y queda una carrera de los segundos que tarda el modelo.

**Regla:** una función que redacta no manda ni avisa; eso lo decide quien la llama, que sabe si
entró un DM o si se está rehaciendo.

**Deuda:** `{ noEnviar: true }` (y sin aviso) en lib/ig-chatbot.ts, y no pisar un borrador que
editó una persona.

**Vive en:** lib/ig-chatbot.ts:74 (generarBorradorIg), :168-220 · app/api/webhooks/zernio/route.ts:258 ·
*2026-09-16 api-mako-areas*

### ⚠️ «Actualizar» una publicación fallida borra la única explicación del fallo

**Síntoma:** se aprieta «Actualizar» sobre un post que falló y el motivo por plataforma
desaparece: queda «Instagram rechazó la publicación (ver Zernio para el detalle)», o nada.

**Causa real:** el webhook `post.failed` guarda en `contenido_posts.error` el detalle de cada
plataforma (app/api/webhooks/zernio/route.ts:317-333). `getPost` no trae ese detalle, y
`refrescarPublicacionAction` escribe `error` igual: un texto genérico, o `null` si ninguna
plataforma viene con status `failed` (app/instagram/actions.ts:474-506).

**Regla:** un refresco que no trae un campo no lo escribe. Es la misma que «El upsert del espejo
borra la media ya guardada…».

**Deuda:** la acción de /instagram sigue pisándolo. La copia de la API
(`sincronizarPublicacionIg`, lib/api-mako/areas/instagram.helpers.ts) ya conserva el error
mientras el post siga en fallo — y son dos copias de la misma lógica (ver abajo).

**Vive en:** app/instagram/actions.ts:474-506 · app/api/webhooks/zernio/route.ts:317-333 ·
*2026-09-16 api-mako-areas*

### Lo que quedó SIN hacer

- **Vincular lead ↔ conversación IG no existe** (ni UI ni backend). Cuando se haga: por
  `lead_identidades(ws, canal, external_id)`, NUNCA por el camino telefónico (el IGSID
  de 17 dígitos pasa `normalizarTelefono` y matchea leads reales — ver arriba).
- **Adjuntos entrantes se listan como texto** en el inbox (`refreshUrl` necesita un proxy
  autenticado para servirse al navegador); `previewMediaAction`/`firmarPreview` quedaron
  exportadas sin call-site: usar o podar.
- El aviso al dueño reusa la clave **`wa-mensaje-entrante`** (2 call-sites en
  `lib/ig-chatbot.ts`) — cambiar cuando el catálogo de avisos gane clave de Instagram. Mientras
  tanto, **apagar el aviso de WhatsApp apaga el de Instagram** (2026-09-16).
- **Las server actions de /instagram no se pueden reusar fuera de la pantalla** (2026-09-16):
  `ctxAdmin()` lee el rol de la SESIÓN, que por HTTP o por WhatsApp no existe
  (app/instagram/actions.ts). La API copió cancelar, refrescar, editar y descartar en
  `lib/api-mako/areas/instagram.helpers.ts` —dos copias que van a divergir; ya divergen en
  «refrescar», ver arriba— y tienen que mudarse a `lib/ig-chatbot.ts` y a un
  `lib/ig-publicar.ts` que no existe. **Publicar y programar quedaron fuera de la API** por lo
  mismo: `crearPublicacionAction` (~100 líneas) no está extraída.
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
- **(16/09/2026) `getIncidentes` devuelve `[]` cuando la lectura FALLA**
  (`lib/meta-health-history.ts:178-181`: `catch` → `console.error` → `return []`). Es el mismo
  agujero de esta entrada, del lado de la lectura: un historial vacío por un error de base es
  indistinguible de «nunca hubo incidentes». Y la pantalla lo afirma: con la lista vacía,
  `/integraciones` pinta **«Todo en orden.»** (`app/integraciones/IntegracionesBoard.tsx:748-749`).
  La API de MaKo lo tapa con una nota en `listar_incidentes_meta`
  (`lib/api-mako/areas/ads.run.ts:483`), pero cualquier consumidor nuevo que tome `[]` como «todo
  sano» afirma de más. **Regla:** «no pude leer» llega como error o como un campo aparte, nunca
  como lista vacía. *2026-09-16 api-mako-areas*

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
- **Y con eso `tzDeWorkspace` dejó de ser una lectura (2026-09-16).** Sin zona guardada corre
  `resolverYGuardarTz` y hace `setSetting` (lib/timezone.ts:39-43). Como caché es inocuo, pero
  no se puede llamar desde un camino que promete no escribir —el `preparar()` de una operación
  de la API de MaKo, una consulta—. La lectura pura es `getSetting(KEY_TIMEZONE)` +
  `esTzValida`, cayendo a UTC y diciéndolo (`tzGuardada`, lib/api-mako/areas/email.helpers.ts:81).

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

---

## «Cómo agregar mi pixel de Meta a mi landing»: la landing del cliente NO es MaKo

**Vive en:** `lib/tutorial-video.ts` · `lib/tutorial-video-texto.ts` · `lib/mako-tools.ts` ·
`lib/hechos-mako.ts` · `lib/mako-doer-in.ts`

Corrección de la entrada anterior. Ahí leí la queja del pixel como «MaKo inventó que Clarity
necesita el pixel de Meta» —que era cierto y estaba mal— y **me perdí la pregunta que el
dueño estaba señalando**, que era otra y literal: *«decime cómo agregar mi pixel de meta a mi
landing page»*.

Mi arreglo mandaba eso a `/integraciones?abrir=meta`. **Contesta otra pregunta.** Ahí se pega
el token DENTRO de MaKo; el cliente preguntaba cómo instalar el píxel en SU Vercel.

### La distinción que faltaba

| La pregunta | Dónde vive | Qué corresponde |
|---|---|---|
| «¿cómo hago X **en MaKo**?» | la herramienta | la tarjeta de /integraciones, con el tutorial oficial del equipo |
| «¿cómo hago X **en mi sitio / mi cuenta de otra herramienta**?» | el stack del cliente | **MaKo no lo sabe y no tiene por qué**: video |

Confundirlas es lo que produjo las sesenta líneas con el `<script>` de Meta y el id de
juguete `1234567890123456`. **Se le pidió a MaKo que explicara algo que está fuera de su
producto, y explicó igual** — que es la misma raíz que la entrada anterior (un modelo sin los
hechos rellena), pero con un remedio distinto: acá no hay hechos que darle, porque no es su
producto.

**Y por eso la propuesta del dueño era la correcta y yo la desaconsejé:** para lo de MaKo, la
tarjeta propia es mejor que un video ajeno; para lo de afuera, un video es mejor que un texto
largo inventado. No era «video sí o no», era **de quién es la herramienta**.

### La tool

`buscar_tutorial(tema)` → YouTube Data API, en español, embebibles, **acotado a los últimos 3
años** (en un tutorial de configuración la antigüedad no es un detalle: las pantallas de Meta
y Vercel cambian, y un video de 2021 manda a buscar un botón que ya no existe — peor que no
contestar, porque el que lo mira cree que está haciendo algo mal). Si no hay nada reciente se
afloja el filtro antes que quedarse mudo.

Key: la del cliente si la cargó, si no la de la plataforma. Buscar un video no es un dato del
cliente ni le gasta cuota que le sirva para otra cosa — la free tier son ~100 búsquedas
diarias.

### Y el link lo manda el CÓDIGO

En la primera prueba el modelo llamó bien a la tool y después escribió *«ahí tenés el video
paso a paso»* **sin el link**: se comió los 11 caracteres del id de YouTube. Mismo patrón que
`mensajeBorrador`, misma razón, tercera vez esta semana. Lo del modelo se antepone (suele ser
la aclaración útil de «esto es en tu sitio, no en MaKo») y el video va abajo, íntegro.

⚠️ **El mensaje lleva canal y año.** No es decoración: MaKo no vio ese video y no puede
presentarlo como oficial. Decir de quién es y de cuándo le deja a la persona con qué
juzgarlo — y el test lo exige, junto con que NO diga «oficial» ni «garantizado».

*Corrida del 25/08/2026 — probado con la pregunta textual: la tool se llama sola y devuelve
«Como instalar el Pixel de Meta directamente en la Landing Page» (2025). Typecheck 0 errores,
1253/1253 tests.*

---

## Todas las previews de WhatsApp eran la misma tarjeta

**Vive en:** `lib/preview-links.ts` · `app/login/page.tsx` · `app/api/og/route.tsx` ·
`lib/rutas-publicas.ts`

El dueño mirando el grupo de un cliente: *«revisá los mensajes con link y preview que envía
MaKo… deberíamos hacer diferentes preview para cada cosa, porque son todos iguales y
confunde»*.

Medido contra producción con el user-agent de WhatsApp — un borrador del plan, el resumen de
un lead, una integración y el plan — los cuatro devuelven **exactamente lo mismo**:

```
og:title        MaKo
og:description  Marketing, CRM y ventas en una sola app.
og:image        /og-mako.jpg
```

### La causa no estaba en las páginas

**El crawler de WhatsApp no tiene sesión**, así que `proxy.ts` lo corta ANTES de que la
página exista: `307 → /login?next=%2Fplan%2Frevisar%2F…`. La tarjeta que se veía nunca fue la
de la pantalla: **era el metadata raíz del login**, idéntico para todo.

Por eso poner `generateMetadata` en cada pantalla no habría servido de nada — no se ejecutan.
Cuando una preview sale mal, lo primero es preguntar **qué HTML recibe el crawler**, no qué
metadata declara la página. Son dos cosas distintas cuando hay un middleware en el medio.

### El arreglo no le abre ninguna ruta a nadie

El destino viaja en el `next=` del redirect, que **ya es público** (está en el link que la
persona recibió). `/login` deriva la tarjeta de ese path con `previewDeDestino()`.

⚠️ **LA TARJETA SALE DE LA RUTA, NUNCA DEL DATO.** «Borrador de tareas», no «3 tareas para el
proyecto X»; «Resumen del lead», no el nombre del lead. Quien resuelve el OpenGraph es un
servidor de WhatsApp, sin sesión y sin permiso: **una preview que leyera la base convertiría
un link en una filtración.** Lo que se muestra es de qué TIPO de cosa se trata, que es
exactamente lo que hacía falta para no confundirse. El test lo exige (`preview-links` no
puede tener un `await` ni tocar Supabase).

Y la imagen se genera al vuelo (`/api/og?tipo=`) en vez de subir doce archivos: el catálogo de
tipos es uno solo y agregar uno no obliga a abrir un editor de imágenes. Solo acepta `tipo`,
que es una clave de un conjunto CERRADO — un texto libre ahí sería dejar que cualquiera
dibuje lo que quiera en una tarjeta con la marca.

⚠️ **`/api/og` va en `lib/rutas-publicas.ts` o no existe**: con el 401 del middleware el
crawler se queda sin imagen y volvemos al problema original. Es la regla que AGENTS.md ya
tiene escrita, y acá se cumplió al revés de lo habitual — la ruta es genuinamente pública
(no lee nada), no «se autentica sola».

**Gotcha del camino:** en local dio 401 igual. Era el dev server con el middleware VIEJO
—Next no lo recarga en caliente y ese proceso llevaba horas—, no un problema de la lista. La
verificación buena fue llamar a `esPublica('/api/og')` directo, que es determinista.

---

## Que MaKo acuse recibo: reacciones a stickers, emojis y peticiones

**Vive en:** `lib/reaccion-emoji.ts` · `lib/mako-grupo.ts` · `lib/mako-doer-in.ts`

Pedido del dueño, en dos partes: risa o corazón a todo sticker/emoji/gif («corazón si
amerita, como un sticker de gracias»), y un 👍 a cada petición «para afirmar que la recibió».

**Hasta hoy un sticker no producía NADA.** Sin texto, sin audio y sin adjunto, caía en el
skip de «sin texto ni audio ni adjunto» y MaKo quedaba muda — indistinguible de estar caída,
que es justamente la sensación que este cliente ya tuvo tres veces esta semana. Por eso la
reacción va **antes** de ese skip, y el test verifica el ORDEN.

Una reacción es el acuse más barato que existe: no ocupa un renglón del chat, no interrumpe y
se ve al instante.

⚠️ **El único error caro acá es reírse de un «gracias»**: queda como burla. Como el default es
risa, la lista del corazón se mira PRIMERO — emojis de agradecer/celebrar/querer y las
palabras («gracias», «crack», «genio», «felicit…»).

Y «solo emoji» es solo emoji: «jaja 😂» es un mensaje y se contesta. El 👍 va `void` +
`.catch`: fallar en el acuse no puede costar la respuesta.

Endpoint: `POST /message/sendReaction/{instancia}` con `{ key, reaction }` — verificado
mandando un payload vacío a propósito, que contesta 400 con el contrato en vez de 404. Probar
que una ruta existe sin disparar su efecto es más barato que deshacer el efecto.

### Lo que quedó SIN hacer

- **El acuse ahora está DUPLICADO**: MaKo ya mandaba «Recibido 👍 dame un momento y te
  contesto» como TEXTO. Con la reacción, ese renglón sobra — una reacción dice lo mismo sin
  ocupar el chat. No se sacó porque el dueño no lo pidió y es un cambio visible; es borrar
  una línea cuando lo decida.

*Corrida del 25/08/2026. Typecheck 0 errores, build OK, 1279/1279 tests.*

---

## La voz de MaKo, seis días muerta diciendo «open»

**Vive en:** `lib/canal-vigilante.ts` · `lib/evolution.ts` · `app/api/cron/alerta-critica/route.ts`

08/09/2026. Martín: *«MaKo en WhatsApp NO está funcionando»*. Lo que lo resolvió fue medir el
transporte antes que la lógica:

```
mako_doer_conv, últimas 48 h ............ 0 mensajes
último entrante de cualquier cliente .... 2026-09-02
connectionState mako_superadmin ......... "state": "open"
operación REAL sobre ese socket ......... HTTP 428 · Connection Closed
```

**Seis días sin entrar NI SALIR un mensaje.** Mauricio y el cliente de Codigo Inmobiliario le
escribieron a una pared; los avisos que los crons generaron esos días se escribieron, se pagó
la IA que los redactó, y ninguno llegó.

### Dos hipótesis mías que la medición mató

Vale anotarlas porque las dos eran plausibles y las dos eran falsas:

1. **«La allowlist `mako.doer.grupos` deja afuera a los clientes».** Tiene solo 2 grupos y
   ninguno es el de Mauricio ni el del cliente — pero el código YA contempla eso: el grupo
   oficial de un cliente pasa por existir (`grupoOficialDe`), con el comentario que cuenta
   ese mismo bug de agosto.
2. **«El webhook descarta por instancia sin workspace».** Hay un early-return exacto para
   eso… y también un caso especial que devuelve `OWNER_WS` para la línea de SuperAdmin.

Las dos se descartaron leyendo el código con el dato en la mano, no antes.

### El campo de estado miente EN LAS DOS DIRECCIONES

Medido sobre las cuatro instancias del servidor, con una operación viva contra cada una:

| instancia | `state` | operación real |
|---|---|---|
| `mako_superadmin` (la VOZ) | `open` | **428 Connection Closed** |
| `mako_ws1` | `close` | **funciona** |
| `mako_ws13` | `close` | **funciona** |
| `mako_ws11` | `open` | funciona |

**`open` no prueba que ande y `close` no prueba que no.** La única pregunta contestable es la
que se hace hablando con WhatsApp. Y el servidor de Evolution estaba sano: la muerta era una
sola instancia, justo la que le pone la voz a MaKo.

⚠️ **`restart` y `connect` NO la recuperan** — los dos contestan 200 «open» y el socket sigue
cerrado. Y **ninguna instancia sana está dentro de los grupos de los clientes**, así que
mover `mako.voz.instancia` tampoco sirve: los grupos son de la línea de SuperAdmin. La única
salida es volver a vincular el número (QR).

### Lo que faltaba NO era la detección

`socketVivo()` existe, hace la lectura correcta, y `estadoCanalMaKo()` la usa con este
comentario escrito el 16/08:

> «"open" es la fila en la base de Evolution, no la sesión. Sin esta confirmación el panel
> dice "conectado" con el socket muerto.»

Sabíamos exactamente esto. **`estadoCanalMaKo()` tenía UN consumidor: la ruta del panel
`/agencia`.** Un estado correcto que solo se calcula cuando alguien abre una pantalla no es un
control, es un dato disponible — y nadie abre un panel que no tiene motivo para abrir.

Es el tercer caso del mismo patrón en este repo (`getPersona()`, `setTimezoneWorkspace()`, y
ahora éste): **una función correcta que nadie llama desde donde importa.** Cuando encuentres
una, grepeá sus call-sites antes de darla por cableada.

### ⚠️ La alarma de un canal NO puede viajar por ese canal

Es lo que hace distinto a este aviso: mandar «tu WhatsApp está caído» por WhatsApp es no
mandar nada. `vigilarVozMaKo()` avisa **por email**, repite cada hora mientras siga caída (es
una hemorragia, no una noticia) y **sabe decir «ya está»** al recuperarse — una alarma que no
cierra obliga a adivinar si se arregló o si se rompió el aviso.

Corre en el cron `alerta-critica` (cada pocos minutos, «la guardia que no se calla»), va
PRIMERO y es best-effort: si la vigilancia falla, el resto del cron corre igual.

### Lo que quedó SIN hacer

- **Recuperar la sesión necesita el QR**, y eso solo lo puede hacer Martín desde el teléfono
  dueño del número (`/agencia`). No hay camino automático.
- **Las instancias de los CLIENTES no están vigiladas**: esto mira solo la voz. `mako_ws13`
  aparece `close` y funciona, así que el mismo campo mentiroso gobierna sus semáforos.
- **Nada reintenta los avisos que se perdieron** mientras la voz estaba caída. Se generaron,
  se pagaron y se descartaron; no hay cola.

*Corrida del 08/09/2026 — caída detectada y reproducida en vivo; `vozViva()` devuelve `false`
sobre la instancia que `connectionState` da por `open`. Typecheck 0 errores, 2162/2162 tests.*

### Addendum: el botón de recuperar estaba roto en su propio caso

Martín fue a reconectar la línea zombi y le salió **«No se pudo generar el QR»**.

Evolution **no emite QR si cree que la instancia ya está conectada**: `/instance/connect/`
devolvía `{"instance":{"state":"open"}}` —sin `base64` ni `code`— y `conectarCanalMaKo` leía
`b.base64 ?? null`. **El mismo campo mentiroso que causó la caída bloqueaba la salida de la
caída.**

Para que vuelva a dar un QR hay que soltar la sesión muerta. Ahora lo hace solo, con dos
límites que importan:

- **Solo `logout`, nunca `delete`.** `desconectarCanalMaKo` hace logout + DELETE de la
  instancia + devuelve la voz al default: eso es *desconectar a propósito*, y usarlo para
  recuperarse de una caída se lleva puesta la instancia y su webhook. Recuperar y desconectar
  no son la misma operación aunque compartan un paso.
- ⛔ **Solo con el socket verificablemente muerto** (`socketVivo()` en positivo, jamás el
  `state`). Un logout sobre una sesión viva desvincula el número y deja a TODOS los clientes
  sin MaKo — el arreglo sería peor que el bug.

Y cuando aun así no hay QR, el mensaje dice qué pasó en vez de «no se pudo»: si el socket
está vivo, la respuesta correcta es *«ya está conectada, no hace falta reconectarla»*.

**La regla que queda: un camino de recuperación hay que probarlo EN EL ESTADO DEL QUE
RECUPERA.** Éste funcionaba con la instancia recién creada o limpiamente desconectada —los
dos casos en que no hace falta— y fallaba con la instancia zombi, que es el único caso en que
alguien lo aprieta.

### Addendum 2 (11/09): Evolution NO suelta la instancia trabada, por ninguna ruta

Con el arreglo de arriba desplegado, el botón pasó a decir *«Evolution no devolvió el QR.
Reintenta en unos segundos; si sigue igual, desconecta la línea y vuelve a vincularla»*. Los
dos consejos eran callejones: reintentar daba lo mismo cada vez, y el botón «Desconectar» ni
aparece con la línea en `error` (el panel lo muestra solo en `conectado`).

Medido en vivo sobre `mako_superadmin`:

| Llamada | Respuesta | Después |
|---|---|---|
| `DELETE /instance/logout` | **500** `Error: Connection Closed` | `open`, `ownerJid` intacto, igual a los 15 s |
| `POST /instance/restart` | 200 `{"state":"open"}` | socket muerto a los 30 s |
| `GET /instance/connect` ×5 | `{"instance":{"state":"open"}}` | nunca un QR |

**La causa, leída en el código de Evolution 2.3.7:** el estado vive EN MEMORIA y solo lo
cambia el evento `connection.update` del socket, que está muerto y no emite. `logout` y
`delete` le avisan a WhatsApp por ese mismo socket y se caen (`delete` hace `logout` adentro);
`restart` cierra el socket y llama a `connect`, que ve `open` y devuelve el estado. Son 8
rutas de instancia y ninguna la saca de `open`. Lo único que la libera es reiniciar el
servidor de Evolution, y desde el repo no hay acceso a Railway.

**El diagnóstico obvio era el equivocado:** «Evolution tarda en soltar la sesión: hay que
esperar más o reintentar». El código esperaba 1,5 s y reintentaba. No era el tiempo: el
`logout` devolvía **500** y nadie leía la respuesta.

**La salida:** una línea NUEVA (`mako_superadmin_<sufijo>`), que no pasa por el socket
muerto. La instancia vigente del canal vive en el setting `mako.canal.instancia`, y lo que
antes comparaba contra el nombre fijo ahora pregunta `instanciaCanal()`:

- el webhook reconoce SOLO la vigente. Con el nombre fijo la línea nueva quedaba sorda, y si
  la vieja revive tras un reinicio de Evolution las dos contestarían el mismo mensaje;
- la voz se muda en el servidor al llegar el `connection.update` `open`, no solo desde el
  panel abierto;
- el orden: QR directo → sin `open`, se espera el QR y solo se sigue con un 401/403 →
  sondeo justo antes de tocar la sesión (`vivo` y `sin_respuesta` no tocan nada) → `logout`
  leyendo su resultado (si soltó, se espera el QR) → recién si no suelta, línea nueva
  reservada con compare-and-set. Nunca `delete`. (La primera versión, b25f8e2f, no tenía el
  corte de `open`: una instancia sin escanear también da «Connection Closed», así que cada
  clic mientras Evolution armaba el QR abría otra línea.)

**La regla que queda: la salida de un estado trabado no puede pasar por lo que está
trabado.** Es la de la alarma que no viaja por el canal caído, vista del otro lado: si soltar
la sesión exige hablarle al socket muerto, soltarla no es un camino.

#### Lo que quedó SIN hacer

- **La instancia vieja sigue en Evolution**, trabada en `open`, hasta que se reinicie el
  servidor. Conviene sacar ese dispositivo desde el teléfono de MaKo (*Dispositivos
  vinculados*) para que no reviva con las credenciales viejas.
- **Las instancias de los CLIENTES tienen la misma trampa** y no tienen la rotación:
  `conectar()` en `lib/evolution.ts` devuelve `qr.base64: null` sobre una `mako_ws<id>`
  zombi. Su nombre está atado a `evolution_instancias`, así que rotarla no es copiar esto.
- **Nadie limpia las instancias rotadas** que queden huérfanas en Evolution.

### Addendum 3 (11/09): «Ya lo escaneé y no funcionó». Funcionaba; mentía el panel

Martín escaneó el QR de la línea nueva y el panel le mostró **«WhatsApp Admin con error»**
con el botón «Conectar por QR». Su conclusión fue la razonable: no funcionó.

Medido cinco minutos después:

- `mako_superadmin_mtxclf3x` en `open`, con el número de MaKo, desde las **20:00:14Z**;
- la voz de MaKo mudada a esa línea a las **20:00:46Z**, por el `connection.update` del
  webhook. **Fue ese camino y no el panel:** el panel solo muda la voz si ve `conectado`,
  y veía `error`;
- a las 20:06 un «Hola?» en el grupo SuperAdmin: 👍 al segundo y respuesta a los 5 s,
  las dos guardadas como enviadas en Evolution.

**La causa: la sonda de vida nunca podía decir «vivo» en una cuenta grande.**
`sondearSocket` traía los grupos (`fetchAllGroups`) y sobre esta línea VIVA no respondió
**ni con 90 s de tope**. `mako_ws11` ya había timeouteado a los 30 s el 08/09, y el
comentario lo trataba como un costo aceptable («aunque tarde»). Tres consecuencias con la
misma raíz: el panel pintaba `error` sobre una línea perfecta, el vigilante no podía mandar
«MaKo volvió a WhatsApp» (nunca veía `vivo`) y el chip de los clientes quedaba «sin
confirmar».

La matriz que decidió el reemplazo, sobre las cinco instancias del servidor:

| | zombi (`open`) | 403 | nunca vinculada | viva (voz) | viva (ws11) |
|---|---|---|---|---|---|
| `fetchBusinessProfile` | 500 Closed | 500 Closed | 500 Closed | **200** 280 ms | **200** 220 ms |
| `findGroupInfos` (grupo falso) | 404 Closed | 404 Closed | 404 Closed | 404 item-not-found | 404 item-not-found |
| `fetchPrivacySettings` | **200** ⚠️ | · | · | 200 | · |
| `fetchProfilePictureUrl` | **200** ⚠️ | · | · | 200 | · |
| `fetchAllGroups` | 500 Closed | · | · | **timeout 90 s** | (30 s el 08/09) |

La sonda nueva es `fetchBusinessProfile`: 200 solo si WhatsApp contesta, ~250 ms, no manda
nada. Y «muerto» sale **solo** con «Connection Closed» o sin instancia (404): de ese veredicto
cuelga un `logout`, así que un error de otra naturaleza queda en `sin_respuesta`.

**El diagnóstico obvio era el equivocado:** «el escaneo falló, hay que volver a generar el
QR». Volver a escanear era trabajo inútil sobre una línea que andaba. El guard de
`sin_respuesta` impidió que el botón la tocara, pero el panel igual invitaba a apretarlo.

**La regla que queda (AGENTS.md):** una sonda se valida contra algo que se SABE muerto y
algo que se SABE vivo, con reloj. La del 08/09 se validó solo del lado muerto.

#### Lo que quedó SIN hacer

- **Los mensajes que los clientes mandaron con la línea muerta no los contesta nadie.** En
  «MaKo <> Codigo Inmobiliario» quedaron «¿Seguís vivo?», «¿mako desapareció?» y «Le
  gastamos los tokens o algo así». No hay reproceso: el webhook nunca los recibió.

### Addendum 4 (11/09): la sonda nueva también mentía, y el aviso no le llegaba a nadie

Tres cosas más, las tres encontradas CORRIENDO el código contra producción antes de
desplegar, no leyéndolo.

**1. El veredicto leía un error que nunca llegaba.** La sonda nueva, corrida sobre las cinco
instancias, dio `sin_respuesta` en las TRES muertas. Evolution 2.3.7 anida el mensaje
(`response.message`) y `evFetch` buscaba solo `body.message`: todo error llegaba como
«Evolution 500», y «Connection Closed» no lo veía nadie. Los tests por regex pasaban
(miraban el endpoint, no la respuesta). Desplegado así, la próxima zombi no se rotaba y el
vigilante no avisaba. Ahora el veredicto vive en `lib/evolution-sonda.ts`, puro, testeado
sobre los bodies medidos. Y el 404 exige «instance does not exist»: **una ruta inexistente
también da 404** (`Cannot POST …`, medido), y de «muerto» cuelga un `logout`. Con «todo 404
es muerto», un upgrade de Evolution que renombre la ruta soltaba la voz viva al primer clic.

**2. El vigilante avisaba a una lista vacía.** Mandaba a los destinatarios del ws SuperAdmin
(9): `{"telefonos":[],"emails":[]}`. Cada «🚨 MaKo no puede hablar por WhatsApp» terminó en
un `console.error`, y la marca de «ya avisé» se ponía ANTES de mandar, así que ni reintentaba.
Ahora va siempre a martinkoncke@gmail.com (pedido de Martín), con el remitente de plataforma
(`REMITENTE_MAKO`, mudado a lib/app-url.ts para compartirlo con los accesos), y la marca se
pone solo si el mail salió.

**3. Nadie mira un panel.** Arriba de todas las pantallas de admin aparece una alerta roja de
64 px (`AlertaVozMaKo`) cuando la voz está caída MEDIDA, con «hace cuánto» y «Reconectar
ahora». Mide en vivo cada minuto (`/api/admin/voz-alerta`, ~250 ms); `sin_respuesta` no la
enciende. Comparte el hueco `--barra-agencia` en vez de abrir otro.

**La regla que queda (AGENTS.md):** una sonda se prueba EJECUTÁNDOLA contra los estados
reales. Leerla —y testearla por regex— no encuentra que la respuesta se lee mal.

### Addendum 5 (11/09): lo que encontró la revisión adversarial antes de desplegar

Una corrida de 15 agentes (5 lentes + un escéptico por hallazgo principal, solo lectura)
sobre la rotación, la sonda y la alerta. Confirmó doce problemas. Los que importan:

- **Una lectura fallida de la base elegía OTRA línea.** `getSetting` devuelve null ante un
  5xx, y el `||` lo completaba: el canal pasaba a ser la zombi y la voz la de un cliente
  (`mako_ws1`, cerrada). De ahí salían una rotación ENCIMA de la línea viva —el guard
  positivo verificaba bien que la zombi estaba muerta— y barra roja con mail falsos. Ahora
  se lee con `getSettingEstricto` (tira) el canal, la voz del vigilante y sus marcas.
- **Dos clics a la vez abrían dos líneas.** Ahora la nueva se reserva con compare-and-set
  (`cambiarSettingSi`) ANTES de crearla; la request que pierde devuelve el QR de la ganadora.
- **Evolution caído no avisaba nunca**: un 502 o un 401 dan `sin_respuesta` para siempre.
  Ahora, a la media hora, sale un mail distinto («no puedo comprobar», sin mandar a
  re-escanear) y la barra se pone ámbar.
- **La voz viva quedaba sorda entre la rotación y el escaneo**: el webhook oía solo el canal.
  Ahora oye canal y voz; el doble recibo lo deduplica `ux_doer_buffer_msg` (mig 0113).
- **Mi arreglo del lector de errores le mostraba JSON crudo a los clientes.** `evFetch` volvió
  a su `error` de siempre y el mensaje anidado viaja aparte, en `detalle`, solo para la sonda.
- Menores: rotaba aunque el logout sí hubiera soltado; soltaba con un 403 viejo sin sondear;
  la barra tapaba modales (ahora z 55); una sonda por pestaña (memo de 30 s, y las pestañas
  ocultas no preguntan); el mail salía con una sola medición; la regla de `aside` estiraba
  cualquier panel lateral; «Reconectar ahora» caía con el panel cerrado (`/agencia?canal=1`);
  «no pude medir» se pintaba «con error» (ahora «sin confirmar», sin botón de reconectar).
- **Y tests que pasaban con el bug que dicen cubrir:** un mail literal declarado y sin usar, un
  `qrConEspera` que cumplía otra rama, un «confirma con el socket» que cumplía otra función, y
  nada que mirara si el veredicto testeado estaba cableado.

**El diagnóstico obvio era el equivocado, otra vez:** «los tests pasan y lo probé en vivo,
está listo». Se probó en vivo con la base respondiendo, Evolution arriba y un solo clic. Los
huecos estaban en la base fallando, en dos clics y en Evolution caído.

#### Lo que quedó SIN hacer

- **«Desconectar» no pide confirmación** y muda la voz a `mako_ws1`, la línea de un cliente
  (`desconectarCanalMaKo`).
- **Número distinto al rotar**: si la línea nueva se escanea con OTRO chip, la voz vieja
  (muerta) no puede agregarlo a los grupos. La voz se muda igual y queda un `console.error`
  con cuántos faltan, que nadie ve en pantalla.
- **`instanciaVoz()` sin `estricto`** sigue cayendo a `mako_ws1` para los avisos y el doer.

### Addendum 6 (11/09): la segunda revisión, y la agenda de MaKo escrita en los contactos de un cliente

Una segunda corrida adversarial (9 agentes) sobre los arreglos confirmó cuatro problemas y dejó
varios menores. El que más pesa no estaba en el código nuevo, sino en uno viejo que el escaneo
dejó a la vista.

**La agenda del teléfono de MaKo se escribió en los contactos de Mauricio.** `wsDeInstancia`
mapea la línea de MaKo a `OWNER_WS` para que el doer corra, pero ese workspace lo usan TODOS los
handlers del webhook, no solo el doer, y `OWNER_WS` es el ws1: Mauricio, un cliente. Al escanear
la línea rotada, Evolution sincronizó la agenda del teléfono con `contacts.upsert`. Medido en
`evolution_contactos` del ws1:

| | |
|---|---|
| escrituras entre 20:01 y 20:33 UTC (el escaneo fue a las 20:00:14) | **1448** |
| escrituras en las 43 h anteriores | 0 |
| contactos nuevos (id mayor al máximo previo) | 10 |
| contactos que ya existían y se pisaron | **1438** (todos con nombre; 631 con foto) |

`upsertContacto` hace upsert por (workspace, teléfono) y pisa `nombre` y `foto_url`: los nombres
que el ws1 tenía para esos 1438 números quedaron reemplazados por los de la agenda de MaKo, y la
tabla no guarda historial. Ahora el webhook corta todo evento que no sea mensaje de grupo para las
líneas de MaKo (`if (esNombreDeCanal(instance))`, antes de `messages.update`).

Los otros tres confirmados:

- **La request que perdía la carrera de clics devolvía el QR de una línea que quizá nadie
  preparó** (sin webhook): conectaba y no oía nada. Ahora el perdedor no devuelve QR, y
  `usarCanalComoVoz` prepara la línea antes de mudar la voz, como red.
- **Un «no pude comprobar» apagaba la alerta roja** en todas las pestañas, y quedaba 30 s en el
  memo. Ahora la respuesta trae `medido`: lo no medido no se memoriza ni apaga la alerta, y la
  roja se sostiene mientras siga puesto el «desde» de una caída medida.
- **Un 401 o un 502 de Evolution se pintaba «con error»** en el panel, con «Conectar por QR»,
  justo lo que la alerta ámbar dice que no hay que hacer. Ahora el único error que es un dato es
  «instance does not exist»; lo demás es «sin confirmar».

Menores ya arreglados: «volvió» mandado sobre una marca heredada del código viejo, el «no puedo
comprobar» sin mail de cierre, un Resend colgado que frenaba el cron (tope de 15 s), el copy de
«sin confirmar» que afirmaba lo que no midió, «Volver a comprobar» sin ninguna señal, la ámbar con
el error crudo en inglés, y el botón de la alerta que recargaba /agencia en medio de un QR.

**La regla que queda (AGENTS.md):** darle un workspace a algo que no es de ningún cliente para UN
propósito obliga a que los demás handlers corten explícitamente.

#### Lo que quedó SIN hacer

- **Los 1438 nombres pisados del ws1 no están restaurados.** La tabla no tiene historial: solo se
  recuperan desde un backup de Supabase o volviendo a sincronizar la agenda del propio WhatsApp de
  Mauricio (su `mako_ws1` está desvinculada, 403). Los 10 contactos nuevos siguen ahí. Nada de esto
  se toca sin el OK del dueño de los datos.
- **`accionParticipantes` (lib/mako-chat.ts) cuenta como éxito un 200 con el 403 adentro**, así
  que el log de «no quedó en N grupos» de `usarCanalComoVoz` puede no saltar.
- **La reversión de la reserva decide por el status del create**: un create que sí se guardó
  detrás de un 502 revierte sobre una línea que existe.
- **Los encabezados `sticky top:0`** (la barra de guardar del lead, /comercial, /marketing) quedan
  debajo de la alerta mientras está prendida, igual que ya pasaba con la barra de agencia.
- **El link de la alerta no conserva `?ws=`**.
- **El fail-open del webhook no salva el mensaje**: con la base fallando, el doer lo descarta como
  re-entrega.


## La post-agenda del ws 1 quedó «prendida» el 8/9 y no le llegó un audio a nadie

Medido en producción el 2026-09-16, repasando las llamadas con Mauricio del 8 y el 9/9 para repartir
sus tareas entre los chats.

- `nutricion_envios` del ws 1 desde el 8/9: **5 filas, las 5 en `fallo`**. Cuatro dicen «WhatsApp de
  empresa no conectado». La última es del 10/9 y después no hay ningún intento más.
- `evolution_instancias` del ws 1: `mako_ws1` sigue en `desconectado`, sin cambios desde el 8/9.
- La memoria del proyecto y el cierre de la sesión del 8/9 decían «prendido». Lo que se prendió fue
  la secuencia; el envío no ocurrió nunca.

**El diagnóstico obvio era el equivocado, dos veces.** En la llamada del 8/9 la lectura fue «la
pantalla dice desconectado y es mentira, en /whatsapp figura conectado». d5c26261 midió que no
mentía: WhatsApp desvinculó el dispositivo el 3/9 (403). Y después, «ya está activo» se leyó del
interruptor, no de una fila `enviado`.

**La regla: una secuencia está andando cuando hay una fila `enviado` en `nutricion_envios` para un
lead real. Ni el interruptor, ni la pantalla, ni el estado de la instancia lo prueban.**

**Sin resolver.** Mauricio tiene que volver a vincular `mako_ws1` desde /whatsapp con su teléfono. Al
hacerlo, hay que mirar que `evolution_instancias.estado` pase a `conectado`, porque el motor decide
con esa fila (`lib/nutricion.ts:962`) y ese campo ya se midió mintiendo en las dos direcciones
(60e8bd93). Tampoco se sabe por qué no hubo intentos después del 10/9.

**Actualizado el 17/09:** el motor ya no decide con la fila (sonda viva, 31856521), y la línea no
era el único corte: aunque se re-vinculara, a un agendado sin pago le quedaba un borrador. Los
intentos se cortaron el 10/9 porque el desenlace mató a las 4 inscripciones por «silencio» sin
haberles mandado nada. Las dos cosas, en «La post-agenda "prendida" no podía mandar un solo
audio, ni con la línea conectada».

**Vive en:** lib/nutricion.ts:962 · lib/secuencias-audios.ts · app/chatbot/ChatAgentApp.tsx · *2026-09-16*

## «Maco, haz un reporte» se guardaba como una nota: el clasificador solo hablaba rioplatense (08-T13)

En la llamada del 8/9 Mauricio contó: «A Maco yo le dije, Maco, haz un reporte tal, tal, y ni
siquiera me responde». Esos días la voz estaba caída (ver arriba), pero con la línea viva el
pedido tampoco habría funcionado. Medido el 17/9 con el clasificador real:

| frase | intención | tools en la mesa |
|---|---|---|
| «Mako haz un reporte de mis resultados de marketing de junio julio y agosto» | capturar (dudosa) | solo las del plan |
| «¿cómo me fue en el trimestre?» | consultar | todas |

`IMPERATIVO` solo conocía el voseo con tilde («hacé») o con pronombre («haceme»). Mauricio es
mexicano y escribe en tuteo: «haz», «hazme», «muéstrame». Y «muéstrame» tampoco matcheaba
«muestrame», porque `\w` no incluye la «é». El pedido caía al default y se guardaba como una
idea, con el aviso «Lo dejé anotado»: sin `metricas_negocio` en la mesa, no había un número
posible. Y aunque lo hubiera, nada del doer sabía que el informe de junio a agosto ya existía
(`/analisis/trimestre`, leído en dólares).

**El diagnóstico obvio era el equivocado:** «la línea estaba caída, y ya se reconectó». La
línea explica por qué ese día no contestó nada; no explica que, con la línea viva, la respuesta
habría sido «lo dejé anotado».

El arreglo:

- imperativos de tuteo que no son tercera persona («haz», «pon» y todo lo que lleva el pronombre
  pegado), comparados contra el texto sin tildes; el voseo sigue exigiendo la tilde;
- `PEDIDO_DATOS`: «un reporte / informe / resumen de mis resultados, ventas, leads… de junio» es
  `consultar`, solo en mensajes cortos y sin cruzar oraciones. Con `.` en vez de `[^.\n]`, un
  volcado de 3060 caracteres («…reportes. Por ejemplo, ayer… este mes…») se leía como pedido;
- el link del informe lo agrega el CÓDIGO al final de la respuesta cuando una tool de números pidió
  un rango que cubre al menos la mitad del trimestre, y solo en el workspace dueño
  (`lib/informe-congelado.ts`; el período sale del propio `datos.ts` del informe).

Comparado el clasificador viejo contra el nuevo sobre los 143 mensajes reales de
`mako_doer_conv`: cambian 2 clasificaciones, y las dos eran pedidos que se perdían («…dime qué
piensas…», «genérame una junta…»).

**La regla que queda:** un clasificador por regex se mide contra cómo escribe CADA usuario real,
no contra cómo escribe quien lo programó. El corpus del test era todo del dueño rioplatense.

#### Lo que quedó SIN hacer

- **No se probó por WhatsApp de punta a punta**: mandar un mensaje de prueba al grupo de Mauricio
  necesita su OK.
- **«IDEA de ciberseguridad:» no se detecta como volcado**: `ENCABEZADO_VOLCADO` exige «Idea:»
  pegado a los dos puntos.
- `metricas_negocio` suma el `spend` de Meta tal como lo guarda la base (en pesos para Mauricio,
  según `app/analisis/trimestre/datos.ts`); el informe congelado se lee en dólares.

## Agrupar avisos: la salida barata PIERDE los avisos, y el registro que el motor promete no existe (23/09/2026)

El pedido era simple —*«las notificaciones de WhatsApp son demasiadas»*— y la
implementación obvia está mal por dos razones que sólo se ven leyendo `lib/avisos.ts`.

### 1. Subir el `dedupTtlMin` no agrupa: descarta

`emitirAviso` chequea el dedup **antes** de escribir nada:

```ts
if (a.dedupTtlMin && (await avisadoReciente(...))) return { ok: true, feedId: null, wa: false, deduped: true };
```

Sale por arriba, antes de `crearNotificacion`. Así que «lo junto subiendo el TTL a 1440» no
junta nada: **tira los avisos 2..N sin dejar rastro de que existieron.** Es «una política
puede RECHAZAR; no puede no dejar rastro» (AGENTS.md) en su versión más cara, porque el que
investigue después no puede distinguir «no pasó nada» de «lo tiramos nosotros».

**La regla: posponer es ESCRIBIR primero y decidir el canal después.** La cola es una tabla
(mig 0161) con una fila por aviso y `enviado_at` como estado entero; y si el insert falla,
el aviso **sale igual, en el momento**.

### 2. El registro que el motor dice tener no existe en producción

`lib/avisos.ts` afirma, textual: *«Se apaga el WHATSAPP, no el registro: la fila del feed
queda igual, así que silenciar un aviso no borra la bitácora de que el evento pasó»*. Hoy
eso es falso: `crearNotificacion` escribe en la tabla `notificaciones` de la mig **0048, que
nunca se aplicó** — atrapa el error, loguea y devuelve `null`, y `emitirAviso` sigue como si
nada con `feedId: null`. Se ve en cada corrida:

```
[notificaciones] crear falló: Could not find the table 'public.notificaciones' in the schema cache
```

O sea que hasta ahora, **cuando un aviso no salía por WhatsApp no quedaba en ningún lado**:
ni feed, ni cola, ni turno del doer. Lo único era la clave de dedup en `app_settings`, que
dice «ya lo dije» y no qué se dijo. `avisos_cola` es, de hecho, el primer registro durable
de un aviso que existe en este sistema.

### Tres decisiones del diseño que no son obvias

- **La lista de lo que puede esperar va en POSITIVO** (`lib/avisos-agrupables.ts`). Con
  «todos menos éste», cada aviso que se cablee mañana entra a los pospuestos sin que nadie
  lo decida — y el día que sea uno urgente, el dueño se entera al otro día.
- **Un aviso de categoría `accion` o `pregunta` NO se pospone, aunque esté en la lista.**
  `emitirAviso` guarda el turno del doer sólo cuando el mensaje sale de verdad; si se
  pospone, el «sí» del dueño de mañana se pega a otra conversación. Ya pasó una vez y
  duplicó dos tareas.
- **La cola es del que va a LEER el mensaje, no del que lo generó.** Un aviso `alDueno` sale
  por el grupo del super-admin aunque lo emita el cron de un cliente. Si se encolara en el
  workspace del cliente, la preferencia que decide sería la de él y el resumen saldría
  partido en un mensaje por cliente — exactamente lo que este resumen viene a evitar.

⚠️ **Y dos trampas de implementación que costaron una vuelta cada una:**

- **`emitirDelCatalogo` pagaba el modelo ANTES del gate.** `generarMensajeAviso` es una
  llamada a la IA y corría siempre: también para un aviso apagado, uno que el dedup iba a
  descartar, y ahora uno que se resume en una línea. Se paga sólo si el mensaje sale.
- **Una lectura «sin scope» no devuelve todo: devuelve NADA.** `getTenantDb` scopea toda
  consulta por el workspace del contexto y sin contexto usa `-1`. La primera versión del
  cron encolaba bien y veía la cola vacía. Se recorre workspace por workspace, como los
  otros crons que iteran inquilinos.

**Vive en:** lib/avisos.ts · lib/avisos-agrupables.ts · lib/avisos-cola.ts · app/api/cron/avisos-resumen/route.ts · supabase/migrations/0161_avisos_cola.sql · *2026-09-23*

## El resumen decía QUÉ pasó y no de qué: el título de un aviso del catálogo es ESTÁTICO (23/09/2026)

El resumen diario junta los avisos que pueden esperar y manda uno solo. Su primera versión
imprimía una línea por aviso **con el título y nada más**, con el argumento razonable de que
el título ya dice de qué se trata.

No lo dice. `emitirDelCatalogo` arma el aviso con `cat.titulo`, que es una constante del
catálogo («Cambió tu landing», «Se venció una grabación»), así que tres cambios en tres
páginas distintas salían como **tres renglones idénticos**. Lo concreto —qué página, qué
grabación, qué proyecto— vive en el TEXTO, que lo escribe el código justamente porque son
datos exactos que no pueden pasar por un modelo.

Y había una segunda mitad: cuando el aviso se posponía y no traía `texto` propio, lo que se
guardaba en la cola era `referenciaPlantilla(id)` — **la misma frase de referencia para
todos los avisos de ese tipo**. Se guardaba lo único que no distingue un evento de otro. Al
resumen va ahora el `contexto` crudo, que es feo (son notas para el modelo) pero es el dato.

⚠️ **Y la URL no se recorta.** El renglón corta la prosa a 100 caracteres y pega el link
entero al final: un link cortado a la mitad se ve clicable y no lleva a ningún lado, que es
peor que no ponerlo. El recorte va sobre el texto, nunca sobre la línea armada.

La regla que queda, y vale para cualquier digest: **un resumen de N eventos del mismo tipo
se lee bien sólo si cada renglón dice DE QUÉ habla.** Antes de armar una línea con un campo,
preguntá si ese campo varía entre dos eventos del mismo tipo; si es una constante del
catálogo, el resumen no resume, enumera.

**Vive en:** lib/avisos-agrupables.ts (`lineaDeAviso`) · lib/avisos.ts (`emitirDelCatalogo`) · tests/avisos-agrupables.test.ts · *2026-09-23*


## La post-agenda mandaba «llegá con contexto» DESPUÉS de la reunión, y el chatbot nunca mandó un solo mensaje

Auditoría del proyecto «Agente: Chatbot» contra el código y producción (25/09/2026, 28 agentes:
17 miden una tarjeta cada uno, 4 refutan los «ya está hecho», 3 juzgan prioridad con lentes
distintas, 1 consolida, 2 buscan lo que no tiene tarjeta, 1 critica la corrida).

**Vive en:** `lib/nutricion.ts` (el loop de `procesarEnvios`) · `lib/nutricion-familias.ts`
(`preparaUnaReunion`) · `lib/chat-agent-handoff.ts:78` · `lib/canal-vigilante.ts:100` ·
`lib/evolution.ts:238-251` · `tests/reunion-ya-paso.test.ts`

⚠️ **UN REINTENTO DIARIO CONVIERTE UN MENSAJE A TIEMPO EN UN MENSAJE TARDE.** La guarda «sin
reunión futura no hay nada que mandar» existía, pero solo para el paso con `ancla: 'reunion'`.
Los pasos de la post-agenda NO están anclados: salen 1 h y 24 h después de AGENDARSE. Con la
línea caída, cada fallo reprogramaba +24 h, y los dos únicos leads en cola de todo el sistema
—de Mauricio, secuencia 213— terminaron con la reunión el 23/09 y el 25/09 a las 20:00 y el
audio programado para el 25/09 a las 21:00. El mensaje que iban a recibir, con la voz del
dueño: «te dejo el video para que llegues con contexto». Arreglado (277dac8d): la pregunta por
la reunión cubre la familia entera, no solo el paso que la declara.

**La regla que queda: un envío que habla de un MOMENTO tiene que re-preguntar por ese momento al
salir, no al programarse.** Y el corolario, que es el que no se ve: mientras el canal está
caído, el reintento conserva el texto del mensaje pero no su sentido.

⚠️ **«Termina en borrador» era falso: termina en SILENCIO.** El reporte del 20/09 y el detalle de
tres tarjetas afirmaban que cuando un lead contesta, MaKo redacta y deja un borrador para
aprobar. Medido: `asistirRespuesta` llama a `clasificarEscenario` ANTES de redactar, y el
clasificador es fail-closed (`lib/chat-agent-handoff.ts:78`: sin escenarios, `encaja: false`).
Las cuatro secuencias de ws1 (212, 213, 198, 199) tienen **cero escenarios**, y
`chat_agent_handoffs` tiene **cero filas**. O sea: el camino asistido nunca corrió, y no por
falta de inscripciones, sino por dos candados en serie, de los que el repo documentaba uno.
Consecuencia de prioridad: la tarjeta de cargar los escenarios tenía score 3 sobre 100 y es el
portón de todo el entregable conversacional (hoy 88).

⚠️ **El chatbot no mandó UN mensaje en toda su vida, y nadie lo sabía.** `nutricion_envios` de
ws1: 12 filas, las 12 en `fallo`. En TODO el producto no hay una sola fila `enviado`. La causa
de fondo no es la línea caída: es que **las instancias de los CLIENTES no están vigiladas**.
`lib/canal-vigilante.ts:100` sondea solo la línea de la voz de MaKo, así que la línea de un
cliente puede estar muerta 22 días y el único rastro es una fila de fallo por día que nadie lee.

**Y recuperar una línea desvinculada (403) no es escanear el QR.** `conectar()`
(`lib/evolution.ts:238-251`) sobre una instancia que ya existe pide `/instance/connect`, que en
una sesión zombi devuelve `base64: null`: el modal dice «conectando» y no muestra nada. El único
camino que funciona es `desconectar()` (logout + delete) y volver a conectar, y eso no lo dice
ninguna pantalla. La línea de MaKo tiene esa rotación desde el 11/09
(`lib/mako-canal.ts:212-258`); las de los clientes no. Peor: el botón «Desconectar» pedía una
confirmación que se dibujaba DETRÁS del modal (ver `hallazgos-ui.md`), así que **la línea de un
cliente no se podía recuperar desde la app**. Las dos cosas se arreglaron el 25/09; la
recuperación en un clic quedó como tarjeta #785.

**Lo que quedó SIN hacer**, con su tarjeta: vigilar la línea del cliente (#784), la recuperación
en un clic (#785), prender la bienvenida con tope de antigüedad y resolver que la secuencia
SEMBRADA #1 comparte trigger con la #198 —hoy un lead nuevo entraría a las dos y recibiría el
audio más los tres textos— (#786), decidir si la respuesta redactada sale sola (#787), que MaKo
pueda contestar más de una vez por lead (#788: `pausarPorRespuesta` solo mira inscripciones
`activa`, así que el segundo mensaje del lead no dispara nada), rescatar a los 5 agendados con
la inscripción cerrada y cero envíos (#789) y la cohorte del residuo (#790).

*(Corrida del 25/09/2026, auditando el proyecto contra el reporte de accionables del 20/09.)*


## Recrear una instancia de WhatsApp: el «connecting» no distingue una zombi de una que está por vincularse

**Vive en:** `lib/evolution-sonda.ts` (`hayQueRecrear`) · `lib/evolution.ts` (`conectar`) ·
`tests/recrear-instancia-zombi.test.ts`

Del mismo día en que se le dio a la app la capacidad de recuperar sola una línea desvinculada
(logout + delete + create). La revisión adversarial del cambio —40 agentes, 4 lentes y una
refutación por hallazgo— encontró que la primera versión borraba de más, por dos caminos
distintos, y los dos le costaban el WhatsApp a un cliente:

1. **No miraba POR QUÉ se cayó.** Una instancia recién creada esperando el escaneo y una que
   WhatsApp desvinculó dicen las dos `connecting`, y las dos pueden no devolver QR por un
   instante. Sin distinguirlas, **abrir la tab dos veces durante el pairing le borraba al dueño
   el QR que tenía en la mano** — justo el momento en que más mira la pantalla. El
   discriminador ya estaba en la misma respuesta: `disconnectionReasonCode` 403/401.
2. **Decidía con una foto vieja.** `fetchInstances` se lee al principio de `conectar()`, y el
   `if` que borra está dos round-trips después (setWebhook, setSettings y el connect en el
   medio): alguien pudo escanear entre medio. Ahora manda el estado que devuelve el propio
   connect, y la foto es solo el respaldo.

**La regla: antes de borrar algo del mundo real, preguntá por qué está como está — y con el
dato más fresco que tengas, no con el que trajiste al entrar.** Un estado ambiguo
(`connecting`) no alcanza para una acción irreversible; hace falta el motivo.

**Y una medición que corrige lo que este mismo documento decía:** el 25/09, sobre la instancia
desvinculada de ws1 (403 desde el 3/09), `/instance/connect` **SÍ devolvió un QR escaneable**.
La recuperación no hizo falta y no se disparó — la instancia en Evolution seguía siendo la del
16/07. O sea que «una zombi nunca da QR» es más fuerte de lo que se midió: a veces lo da. Lo
que no hay es forma de saberlo de antemano, así que el camino de recuperación se queda, pero
como respaldo y con las dos guardas de arriba.

## Los avisos editables eran del DUEÑO para todos, y la repetición no existía (28/09/2026)

Tarea #823 («qué se avisa, cada cuánto y qué lo dispara») + #724 (insistir hasta que
confirme). El modelo y el motor ya estaban construidos; lo que faltaba no era lo que
parecía.

### ⚠️ El store de plantillas y flujos estaba clavado a OWNER_WS, y ya se disparaba en el grupo del cliente

**Vive en:** `lib/plantillas.ts` (leerStore/guardarStore) · `lib/flujos.ts` (dispararEvento)

**Síntoma que todavía NO se vio, y por qué.** `leerStore`/`guardarStore` hacían
`runWithWorkspace(OWNER_WS, …)`. El primer cliente que editara el texto de un aviso se lo
cambiaba **a todos los clientes**. No explotó nunca porque la única pantalla que escribe
ahí vive en `/agencia` y sólo entra el super-admin — o sea que el bug estaba esperando a
que la feature saliera al cliente, que es exactamente lo que pedía la tarea.

**Y la mitad de lectura ya estaba activa:** `dispararEvento` leía `listarFlujosActivos()`
—del dueño— y ejecutaba los pasos con `ws = ctx.ws`, el del evento. Los flujos que armara
la agencia ya se disparaban **dentro del grupo de cada cliente**. Medido: ws1 y ws4 tenían
los mismos dos flujos (`ad-fatiga`, `meta-cuenta-frenada`), porque `clonar-config` copia el
store entero al crear un workspace.

**La regla que queda.** Un store «del dueño» que lo lee un runtime multi-inquilino no es
un default: es un dato compartido sin dueño claro. Cuando algo así tiene que volverse
editable por el cliente, el orden es **primero el scope, después la pantalla** — al revés,
la primera edición de un cliente es un incidente.

**Cómo quedó:** el store es por workspace, con el del dueño como DEFAULT heredado, y el
copy-on-write es **por ENTRADA, no por store**. Esa distinción es la que importa: guardar
el efectivo entero materializaría las 49 entradas en el workspace y lo congelaría — un
aviso que el dueño mejore después ya no le llegaría a ese cliente. `mutar` lee lo efectivo
(para no perder lo heredado al apagar) y escribe sólo lo propio.

*2026-09-28*

### El techo de una insistencia no puede ser configurable, y va en DOS lugares

**Vive en:** `lib/flujos-tipos.ts` (INSISTIR_MAX_VECES, sanearInsistir, proximaSalida) ·
`supabase/migrations/0180_insistencias.sql` (los CHECK) · `lib/insistencias.ts`

El pedido, textual: «ellos quieren que cuando un lead de sus clientes entre al CRM, MaKo en
WhatsApp le reviente a mensajes insistiendo que le LLAME». Lo que se quema es la línea de
WhatsApp **del cliente**, no la nuestra.

Decisión de Martín (28/09): **5 repeticiones, mínimo 30 minutos**, y no es configurable. El
cliente elige dentro de ese marco y `sanearInsistir` recorta lo que se pase. Verificado
contra el dev server con el caso literal: se pidieron `99 veces cada 1 minuto` y volvieron
`5 cada 30`.

**Las dos capas, que es la regla de AGENTS.md aplicada a un número y no a un prompt:** el
saneo en el código y el `check` en la tabla. Verificado en prod que la base rechaza
`veces=9` y `cada_min=1` — una fila escrita a mano desde el SQL editor tampoco puede
armar un bucle.

**Y los otros dos cortes que no se discuten:** cualquier «ok» en el grupo cierra TODAS las
insistencias vivas de ese workspace (quien escribe está mirando el grupo: seguir
insistiendo con otra cosa es el mismo ruido que esto viene a resolver), y de noche no sale
nada — se corre a las 8.

⚠️ **`esAcuse` mira sólo mensajes cortos (≤40 caracteres) y de otra persona (`fromMe`
false).** Sin el largo, una charla del equipo que dijera «ok pero antes…» apagaría el aviso
que justamente nadie leyó; sin `fromMe`, MaKo se acusaría recibo a sí misma — sus propios
mensajes al grupo vuelven por el mismo webhook.

*2026-09-28*

### Un paso `esperar` que corta la ejecución es una promesa que la UI ya estaba haciendo

**Vive en:** `lib/flujos.ts` (ejecutarPasos) · `app/agencia/FlujoEditor.tsx`

`ejecutarPasos` tenía `if (paso.tipo === 'esperar') break;` con el comentario «necesitan el
cron drenador (pendiente)». O sea: el editor de flujos dejaba poner una espera, y cualquier
flujo que la usara se ejecutaba hasta ahí y moría **en silencio**. El «cada cuánto» de la
tarea no existía, aunque la pantalla lo ofreciera.

Lo que se construyó para la insistencia (tabla + cron `7,37 * * * *` + compare-and-set al
drenar) es el molde de lo que le falta a `esperar`, que sigue sin drenador.

*2026-09-28*

### Los avisos EN VIVO no pasan por el motor de flujos

**Vive en:** `lib/avisos.ts` (emitirAviso) · `lib/notif-catalogo.ts` (AVISOS_WA_EN_VIVO)

Hay dos caminos por los que sale un mensaje y es fácil creer que son uno: los **flujos**
(`dispararEvento`, cableado en 5 webhooks) y los **avisos** (`emitirAviso`, el choke point
de los 15 en vivo). Configurar la insistencia en una plantilla no hacía nada hasta
engancharla **en `emitirAviso`**, porque los avisos no pasan por el motor.

Dato al pasar: **5 de los avisos en vivo no existen en el catálogo de voz**
(`wa-mensaje`, `wa-mensaje-empresa`, `wa-plantilla`, `plan-proyecto-vence`,
`avisos-resumen`), así que su texto de referencia arranca vacío. La pantalla lo dice en el
placeholder en vez de mostrar un campo vacío sin explicación.

*2026-09-28*

### Lo que sigue sin hacer

- **`esperar` sigue sin drenador**: el paso existe, la UI lo ofrece y corta la ejecución.
- **El disparador no se edita desde el cliente**, a propósito: los 15 avisos en vivo tienen
  su enganche cableado en el webhook. Si el pedido crece a «quiero un aviso nuevo con mi
  propio disparador», eso es un FLUJO y hoy sólo se arma desde `/agencia`.
- Las tareas hermanas quedaron sin tocar: **#287** (el problema es de JERARQUÍA, no de
  volumen — él ya apagó avisos y siguió sin ver el que importaba), **#800** (SLA por etapa)
  y **#345** (anuncio rechazado), que son disparadores nuevos para este mismo molde.

### Dos campos que apagan lo mismo son un switch que miente (28/09/2026)

**Vive en:** `lib/perfil.ts` (avisoWaActivo) · `lib/plantillas.ts` (enabled) ·
`scripts/migrar-apagados-a-plantillas.mjs`

Cada aviso tenía DOS interruptores: `notification_prefs.avisos[id]` (el toggle de la
lista) y `mako.plantillas.store[id].enabled` (el punto verde de la pantalla de mensajes).
Se consultaban **en cadena**, así que apagar cualquiera silenciaba el aviso — y prender
uno sin ver que el otro estaba apagado no hacía nada. Nadie lo notó porque las dos
pantallas vivían en lugares distintos.

**La regla al unificar: la migración de datos va ANTES del cambio de código, y en su
propio script.** Había 5 apagados en el campo que dejaba de leerse (ws1: 1, ws13: 4).
Cambiar el código primero les habría **vuelto a prender a dos clientes reales** mensajes
que habían silenciado. Migrar primero deja el aviso apagado por los dos lados un rato,
que no le hace mal a nadie.

*2026-09-28*

### Un override que NADIE pidió pisa el default y lo vuelve mentira

**Vive en:** `mako.plantillas.store` · `lib/clonar-config.ts` ·
`scripts/limpiar-overrides-redundantes.mjs`

Al cambiar el default de «todo prendido» a una lista corta, un aviso seguía saliendo
igual. La causa: su entrada tenía `{"enabled": true}` explícito, y el override gana sobre
el default — correcto por diseño. Lo que estaba mal es de dónde salía ese `true`: del
**clon de configuración** al crear el workspace (`clonar-config` copia el store del dueño
entero) y de pruebas. Nadie lo había prendido.

**La regla:** un override sólo significa algo si lo escribió una persona decidiendo. Los
que nacen de un clon o de una prueba son ruido que congela al cliente en el default del
día que se creó su cuenta — y cuando el producto mejora ese default, no le llega.
Distinguirlos importa: el script borra `{}` y `{enabled:true}`, y **no toca los
`enabled:false`**, que sí son decisiones (ws13 apagó cuatro).

*2026-09-29*

### Para decidir qué ve un cliente, lista blanca — nunca marcar lo que se esconde

**Vive en:** `AVISOS_DEL_CLIENTE` en `lib/avisos-catalogo.ts`

Primero se marcaron 13 entradas como «administrativas» para ocultarlas. Funcionaba y era
frágil: obliga a acordarse de marcar **cada aviso nuevo**, y el que se olvide aparece en la
pantalla de todos los clientes sin que nadie lo haya decidido. La lista blanca falla del
lado seguro — un aviso nuevo no se ve hasta que alguien lo agregue a propósito — y además
se lee de un vistazo, que es lo que permite discutirla con el dueño.

**Y el corolario, que costó una corrección:** «no editable» no era lo pedido. Mostrar 13
filas en solo-lectura llena la pantalla de cosas que el cliente no puede tocar; esconder
la fila y seguir emitiendo el aviso es lo que resuelve el problema. Lo que desaparece es
la fila, no el aviso.

*2026-09-29*

### Cambiar un default apaga cosas que nadie pidió apagar

**Vive en:** `porDefecto` en `lib/avisos-catalogo.ts`

Al pasar de «todo prendido» a una lista corta, los avisos que el pedido NO nombró caen a
apagado por omisión. Entre ellos estaban el Pixel caído y el anuncio retenido por Meta:
apagarlos de rebote es una regresión en silencio, y quien la descubre es un cliente que
se quedó sin enterarse de que su cuenta estaba frenada.

**La regla:** al cambiar un default masivo, la lista de lo que el pedido nombra NO alcanza
— hay que enumerar aparte lo que ya venía funcionando y decidir uno por uno si se
conserva. Acá se conservaron cuatro.

⚠️ Y queda uno para mirar: `meta-cuenta-frenada` (cuenta de Meta deshabilitada) nace
apagado. Hoy da igual porque **no está cableado** —el cableado de las transiciones de
meta-health sigue pendiente—, pero el día que se conecte hay que prenderlo o no va a salir.

*2026-09-29*

### El editable tipo chat estaba copiado a mano en dos lados, con un comentario pidiendo sincronizarlos

**Vive en:** `app/whatsapp/_shared/BurbujaMaKo.tsx` (la forma, ahora una sola) ·
`ChatHilo` · `MensajesChat`

La burbuja de WhatsApp vivía duplicada en `ChatHilo` (hilo real, solo lectura) y en
`MensajesChat` (pasos de una secuencia, editables), cada una con un ⚠️ avisando que si
alguien tocaba una había que mover la otra. **Dos copias con un comentario que pide
sincronizarlas a mano son dos copias que se van a desincronizar**: el comentario no es un
mecanismo. Al aparecer el tercer uso se extrajo.

*2026-09-28*

### Y una pantalla que ya existía: antes de construir, buscar dónde está

`/mensajes` (`PlantillasView`) ya hacía «ver como llega, editar, prender y apagar» para el
super-admin, y se reusaba en `/agencia`. El primer intento fue construir un editor nuevo
colapsable por fila. Lo que hacía falta era **parametrizar el endpoint** de la que existía
(mismo protocolo, otro guard: `getSesionAdmin` allá, admin del workspace acá) y montarla.

**La señal que había que leer antes:** el dueño dijo «lo tenemos en varios lugares». Cuando
alguien nombra que algo ya existe en plural, la tarea es encontrarlo y compartirlo, no
escribirlo de nuevo.

*2026-09-28*

### Reemplazar un modal por una pantalla deja sus TESTS mirando al muerto

**Vive en:** `app/perfil/DestinatariosCanal.tsx` · `app/perfil/DestinatariosLista.tsx` ·
`tests/destinatarios-telefono.test.ts`

Los destinatarios se editaban en un modal con las dos listas juntas; pasaron a editarse en
la página, un canal a la vez. El modal quedó con **cero call sites** y su archivo intacto —
y ahí está el problema: **cuatro tests seguían leyendo ese archivo** (`noAgregados` se
muestra, `linkGrupo` se puede copiar, ningún camino rechaza en silencio). Los cuatro
seguían en VERDE sobre código que nadie puede abrir, mientras el editor nuevo salía sin el
botón de copiar el link del grupo — o sea sin la única salida cuando WhatsApp se niega a
sumar a alguien.

**La regla: al reemplazar una pieza, los tests se MUEVEN con ella en el mismo commit.** Un
test que lee un archivo por su ruta no se entera de que dejó de ejecutarse: contesta sobre
el texto, no sobre el producto. El síntoma es el peor de todos — verde sobre una pantalla
que perdió una función.

Y la otra mitad: **lo que el muerto tenía de propio se enumera antes de borrarlo.** Acá
eran cuatro cosas que el editor nuevo no tenía (el link del grupo con su copiar, el aviso
de quién no entró, la nota de que sacar a alguien de la lista no lo echa del grupo, y el
rechazo del borrador a medio escribir). La última es la que más costaba ver: sin ella, un
número incompleto se manda igual, el saneo del server lo descarta, y la pantalla dice
«Guardado ✓» — afirmar lo que no pasó, otra vez.

El test que quedó en lugar del que murió con su sujeto pregunta por el **call site**
(`<DestinatariosCanal` en el panel) y por que no vuelvan a ser dos (que no exista de nuevo
un `DestinatariosModal.tsx`). Probado rompiéndolo: 10 pasan / 1 falla en cada dirección.

*2026-09-29*

### El remitente de un email no se dibuja: se pregunta

**Vive en:** `app/perfil/BandejaEmail.tsx` · `getEmailFrom()` en `lib/resend.ts` ·
`GET /api/email/dominio`

La bandeja de email previsualiza cómo llega un reporte, así que necesita un «De:». Se
escribió `MaKo <equipo@hola-mako.com>` de memoria. Medido contra el ws1: ese valor es
**exactamente el correcto**… porque es el `resend_from` que ese workspace tiene hoy. El
remitente sale del setting de CADA workspace —«el De: es el negocio del cliente, no la
agencia»—, así que para un cliente con su dominio conectado la pantalla habría dibujado el
remitente de otro.

**Es la trampa de siempre con una cara nueva: un dato hardcodeado que da bien en el único
workspace donde se prueba.** La prueba mental que la caza es la de `OWNER_WS`: probalo con
dos: si la respuesta cambia según de quién sea el segundo, el lugar está mal aunque hoy dé
bien.

Y cuando la lectura falla, la línea del «De:» **no se dibuja** y el nombre va en «—». Un
remitente inventado en una previsualización es peor que uno que falta: la pantalla existe
justamente para que alguien juzgue cómo llega el mensaje.

*2026-09-29*

### Un bloque que sube al tope deja su botón de Guardar al pie

**Vive en:** `setItem` en `app/perfil/NotificacionesPanel.tsx`

«Dentro de la app» pasó a ser lo primero de la pantalla, y su barra pegajosa de «Guardar
preferencias» siguió al pie — con el editor de mensajes entero en el medio (620 px de
chat). O sea: toco un chip en el primer renglón y tengo que scrollear la pantalla para
confirmarlo.

**Al reordenar una pantalla, el estado sin guardar se reevalúa.** Acá los dos vecinos ya
guardaban solos (los destinatarios y cada mensaje), así que esa barra era el único estado
pendiente de la pantalla — y lo que se pierde al navegar sin apretarla no avisa. Los chips
pasaron a guardar al toque, optimistas, **revirtiendo el chip si el server dice que no**:
dejarlo puesto afirma un guardado que no pasó.

*2026-09-29*

### Un link a una tab que se mudó no da error: aterriza y no tiene lo que promete

**Vive en:** `lib/notify.ts` (el `link` de cada reporte)

Cada reporte dejaba en el feed un link a `/perfil?tab=notificaciones`. El panel se había
mudado a `/configuraciones` hacía tiempo, así que ese link aterrizaba en una pantalla que
dice, textual, «los reportes y las notificaciones se configuran en Configuraciones» — el
producto mandando a leer un cartel en vez de al control. No es un 404 y no lo reporta
ningún test: es un link que funciona y no sirve.

Lo encontró grepear `tab=notificaciones` al pasar, no un síntoma. **La contraparte de
«retirar una ruta es enumerar sus links» es: al mudar un PANEL de pantalla, se grepea el
querystring que lo nombraba.** Un `?tab=` viejo sobrevive a la mudanza porque sigue
resolviendo a una ruta que existe.

⚠️ Y el destino correcto no lleva `?tab=`: `ConfigInnerTabs` **no lee la tab de la URL**
(arranca en `notif` por default). Así que `/configuraciones` aterriza justo donde hace
falta, y escribirle un `?tab=notif` habría sido un parámetro que nadie lee — que es cómo se
construye la próxima ilusión de que el link elige la tab.

*2026-09-29*

### «Solo hay 1 template» no era un problema de filas: el email tenía UN camino

**Vive en:** `lib/avisos.ts` (el choke point) · `canales` en `lib/plantillas.ts` ·
`POR_EMAIL`, retirado de `app/perfil/BandejaEmail.tsx`

La bandeja de correo listaba un solo mensaje y la salida obvia era sumar ids a
`AVISOS_DEL_CLIENTE`. Está mal por dos razones que no se ven desde la pantalla:

1. **Esa lista no es una lista de vista: es el permiso del servidor.**
   `app/api/perfil/plantillas/route.ts` define `esAdministrativo = (id) => !esAvisoDelCliente(id)`
   y con eso contesta **403** a `texto` y a `reset`. Sumar un id ahí le da al cliente permiso
   de EDITAR el texto de un aviso que redacta MaKo, no de verlo.
2. **Y alimenta las dos pantallas.** `listarPlantillas()` filtra con la misma función, y la
   vista de WhatsApp usa el MISMO endpoint: las filas nuevas aparecen también en el chat, que
   nadie pidió tocar.

La causa real era que **por email sólo salían los tres reportes** (`lib/notify.ts` es el único
`sendEmail` de los avisos) y el cliente ve uno. Lo que resuelve el pedido es darle a cada
aviso su canal (`canales: { wa, email }` en su entrada del store) y despacharlo en el choke
point — con eso los seis mensajes del cliente pueden salir por correo y la bandeja tiene seis.

⚠️ **Y el email arranca APAGADO, no prendido.** Es la regla del default sin consecuencias, y
acá tiene tres: cuesta plata, se le escribe a direcciones que quizá nadie revisó, y un correo
no deseado quema la reputación del dominio para **todos** los mails del producto.

*2026-09-29*

### El hallazgo caro: editar el texto de un REPORTE no cambia el mail

**Vive en:** `lib/reportes.ts` (`:88`, `:146`, `:198`) · `lib/notify.ts`

`lib/reportes.ts` arma el cuerpo del reporte con `L.join('\n')` a partir de los datos, y **no
importa `lib/plantillas` en ninguna línea**. O sea que el texto que el cliente edita en el
detalle del «Reporte semanal» es una MUESTRA y no un molde: se guarda, se ve, y el correo que
sale no lo lee nunca.

No se tocó, y es una decisión de producto, no un bug con arreglo obvio: o el reporte deja de
ofrecer edición de texto, o `despacharReporte` pasa a usar la referencia. Lo que no puede
quedar es una pantalla que guarda con un ✓ sobre algo que el mail ignora.

⚠️ **Y hay un segundo piso, medido en la misma corrida:** los tres crons de reporte
(`app/api/cron/reporte-*/route.ts`) **no iteran inquilinos** — no hay `correrPorWorkspace`,
y tanto `getNotifPrefs()` como `getDestinatarios()` caen al dueño. **Hoy ningún cliente
recibe un reporte.** La bandeja de correo lo muestra igual porque describe lo que el mensaje
dice, no lo que el cron hace.

*2026-09-29*

### Una función PURA adentro de un módulo `server-only` deja a la pantalla sin poder mostrar lo que el server manda

**Vive en:** `lib/email-html.ts` (nuevo) · `lib/resend.ts`

`renderEmailHtml` vivía en `lib/resend.ts`, que lleva `server-only` porque ahí está la API
key. Correcto para la key y caro para todo lo demás: la bandeja de correo no podía usarlo, así
que dibujaba el texto plano en un `<div>` y el lector veía los `*asteriscos*` de WhatsApp que
el mail real **no tiene**. Una previsualización que no muestra lo que llega no sirve para lo
único que hace.

La función no tocaba credenciales, ni settings, ni la base: se mudó entera a un módulo sin
`server-only` y se re-exporta desde `resend.ts`, así que los siete call sites no se enteraron.

⚠️ **Y el módulo mudado no puede importar NADA del repo, ni transitivamente.**
`tests/frontera-use-client.test.ts` sólo mira imports DIRECTOS, así que un `server-only`
colgando dos saltos más abajo no lo caza nadie — y el síntoma sería el build entero con un
error que nombra otra ruta. El guard nuevo cuenta los imports y exige cero.

*2026-09-29*

### Y el orden del pipeline de escape: las marcas se convierten DESPUÉS de escapar

**Vive en:** `marcasAHtml` en `lib/email-html.ts`

`*negrita*` → `<strong>` corriendo ANTES de `escapeHtml` produce `&lt;strong&gt;` y el lector
ve las etiquetas como texto. Va después, igual que `linkify`, que ya lo decía en su comentario
desde el día uno («opera sobre texto YA escapado»).

Es la misma familia que «si el paso B puede consumir lo que el paso A tenía que producir, es
un bug de ORDEN», y acá la salida correcta estaba escrita al lado — en la función de al lado.

⚠️ **Y el comentario que lo explica no puede CITAR la regex vieja.** El `replace` que borraba
las marcas contiene la secuencia que cierra un bloque de comentario, así que pegarlo adentro de
un `/** … */` parte el archivo al medio: el typecheck escupió seis errores de sintaxis en
líneas que no tenían nada. Es el gemelo del backtick adentro de un template literal, ya escrito
en AGENTS.md, en el otro contexto.

*2026-09-29*

### El interruptor de un aviso y su canal son DOS preguntas

**Vive en:** `estadoAviso` en `lib/perfil.ts` · el gate de `emitirAviso` en `lib/avisos.ts`

`avisoWaActivo(ws, tipo)` devolvía un booleano que fundía «¿este mensaje existe para este
negocio?» con «¿sale por WhatsApp?». Por eso «éste sí, pero sólo por mail» no existía: el único
camino era apagarlo entero. Ahora son tres campos (`activo`, `wa`, `email`) leídos en UNA sola
pasada del store, y apagar los dos canales equivale a apagarlo **conservando su texto y su
flujo**.

⚠️ **El fail-open es sólo para WhatsApp.** Si la lectura de la preferencia falla, el aviso sale
por donde salía siempre —un error nuestro no puede silenciar el mensaje que dice que los
números dejaron de llegar— pero **no se abre el email**: ese canal se prende a mano, y un fallo
de lectura no es un permiso.

*2026-09-29*

### `emitirDelCatalogo` leía la plantilla en el contexto AMBIENTE, no en el del workspace

**Vive en:** `lib/avisos.ts`

`plantillaActiva(id)` se llamaba ANTES de resolver `const ws = opts.ws ?? …`. Todo call site
que pasa el workspace explícito sin estar adentro de un `runWithWorkspace` —así llaman los
crons que iteran inquilinos— consultaba el interruptor **del dueño** ahí, y el del cliente ocho
líneas más abajo. O sea: un aviso que el dueño tenía apagado moría para TODOS sus clientes, sin
importar lo que cada uno hubiera configurado, y el interruptor del cliente era decorativo para
ese camino.

Preexistente y silencioso: el aviso simplemente no salía, que es indistinguible de «no pasó
nada que avisar». Lo encontró un refutador leyendo el orden de las líneas, no un síntoma.

**La regla que queda:** en una función que acepta `ws` por parámetro, la resolución del
workspace es la PRIMERA línea del cuerpo. Cualquier lectura de settings antes de eso está
preguntando por otro inquilino.

*2026-09-29*

### El guard se acusa a sí mismo cuando el código NOMBRA lo que decidió no usar

**Vive en:** `tests/email-y-canales.test.ts`

Un guard que exige que `lib/avisos.ts` **no** contenga `envioEmailHabilitado` falla contra el
propio comentario que explica por qué ese flag no se usa. Ya estaba escrito en AGENTS.md para
el guard de `/funnel` y volvió a pasar el mismo día que se leyó.

Va con el fuente sin comentarios, y **los de línea se sacan ANTES que los de bloque**: un
`/*` que aparece adentro de un `//` se traga cincuenta líneas de código real, que es
exactamente como un guard de esta casa dio verde sobre algo que nunca miró.

*2026-09-29*

### Un editor «avanzado» puede ser el único lugar donde vive lo que sí funciona

**Vive en:** `app/agencia/Recordatorios.tsx` · `lib/avisos.ts` (el enganche) ·
`app/agencia/FlujoEditor.tsx`, retirado

El dueño mandó sacar «⚙️ Editar el flujo (avanzado)» con un argumento correcto: «no
tiene sentido si literalmente YA lo estoy editando». Y adentro de ese panel estaba lo
ÚNICO de todo el motor de flujos que un aviso del catálogo sí ejecuta: el paso
`insistir`. Borrarlo sin mirar se llevaba puesta la única función viva del panel.

**Lo que hace la diferencia es dónde se ENGANCHA cada cosa.** Un aviso del catálogo no
pasa por el motor de flujos: sale por el choke point de `lib/avisos.ts`. De todo el
flujo, ese choke point mira UNA sola cosa —busca el paso `insistir` y abre una fila en
`insistencias`— y el resto (el disparador por evento, los pasos de mensaje y acción)
gobierna el otro camino, el de los 5 webhooks. Así que al desarmar un panel, la
pregunta no es qué controles tiene sino **cuál de ellos toca el camino de ESTA
pantalla**.

⚠️ **Y lo que autorizó borrar el resto fue una consulta, no un juicio.** Antes de
retirar el editor: **4 flujos guardados en toda la base, los 4 con `disparador:
manual` y CERO pasos**, y **0 filas en `insistencias`** desde que existe la tabla. O
sea que ese editor nunca produjo un flujo que corriera. Sin ese número, sacarlo era
una apuesta.

*2026-09-29*

### «Se DEBE poder configurar» a veces significa que no hay nada que configurar

**Vive en:** el bloque «Qué lo dispara» en `app/agencia/TemplateDetalleModal.tsx`

El pedido fue que el disparador se pudiera elegir: un evento, o cada X tiempo. Medido:
para **60 de los 65 mensajes** lo que los hace salir es el CALL SITE que los emite —un
webhook, un cron, un cambio de estado— y para los tres reportes es una expresión de
cron que vive en `vercel.json`, global y de deploy. El selector de evento que existía
en el panel «avanzado» gobierna el motor de flujos, que estos avisos no usan.

**Un selector ahí habría sido el control que se dibuja y no cambia nada**, y encima en
el primer renglón de la pantalla — el lugar donde más se cree lo que dice.

Lo que se dibujó es lo verdadero: **qué lo dispara, en prosa**. Y lo que haría falta
para que se pueda elegir quedó escrito en el mismo comentario: una variante por TIEMPO
en el tipo `Disparador`, un cron que la recorra, y que el choke point de los avisos
mire el disparador. Son tres cosas y ninguna es la pantalla.

*2026-09-29*

### Un interruptor que apaga lo que viene no apaga lo que ya salió

**Vive en:** `cerrarPorConfiguracion` en `lib/insistencias.ts` · `setFlujo` en
`lib/plantillas.ts`

`drenarInsistencias` no consulta NINGUNA configuración: lee la tabla y manda hasta
agotar las veces. No es un descuido —una fila abierta es un compromiso ya tomado— pero
convierte a «apagar los recordatorios» en un interruptor que miente: se apaga, y
siguen saliendo hasta cinco mensajes más.

**La regla: cuando un control apaga algo que tiene COLA, apagarlo cierra la cola.** El
cierre va en el mismo camino que la configuración (`setFlujo`, que es por donde pasan
todas las escrituras del flujo) y con su propio motivo —`config`, no `acuse`—: son dos
hechos distintos, «alguien lo vio» y «alguien no lo quiere más», y meterlos en el mismo
casillero hace que el día que se mida cuántas se acusan, el número mienta.

⚠️ Y el hermano, del otro lado: el choke point leía el flujo con `getFlujo`, que **no
filtra por `activo`** —el que filtra es `listarFlujosActivos`, que alimenta al otro
camino—, así que un flujo pausado abría insistencias igual.

*2026-09-29*

### Forzar un campo derivado para que el control «funcione» es escribir a escondidas

**Vive en:** `cambiarCanal` en `app/perfil/PrefsDeMensaje.tsx`

Los tres reportes tienen `{ activo, wa, email }`, y sus crons cortan por `activo`. Al
cablear los chips de canal escribí `activo: true` en cada cambio, para que prender un
canal hiciera algo. Consecuencia: **tocar Email reencendía un reporte que el dueño
había apagado**, sin pedirlo y sin decirlo.

**`activo` no es un campo que se setea: es uno que se DERIVA** — un reporte está activo
si sale por algún lado, y por ninguno es apagado. El olor que lo delata: cuando para
que tu control funcione tenés que escribir de paso OTRO campo, ese otro campo o es
derivado (y se calcula) o es el interruptor de alguien más (y no se toca).

*2026-09-29*

### Y el rechazo pintado de verde

**Vive en:** `flashOk` / `flashMal` en `app/agencia/TemplateDetalleModal.tsx`

La rama de error que se agregó para que «Guardar» dejara de ser mudo usaba el MISMO
`flashOk` que el éxito, y el `<span>` estaba cableado a `var(--good)`. O sea que el 403
de un aviso que MaKo redacta —el que dice «esto no lo podés editar»— se leía en verde,
al lado del botón, exactamente como un guardado.

**Un rechazo pintado de «hecho» es peor que ninguno**: el mudo al menos hace que la
persona vuelva a intentar; éste la manda a otra cosa convencida. Al agregar una rama de
error, el color se agrega con ella.

*2026-09-29*

### Antes de borrar el único editor de un campo, contá las filas que lo tienen en `false`

**Vive en:** `prefs.secciones` · `app/perfil/PrefsDeMensaje.tsx`

«Qué trae adentro» eran cuatro casillas que escribían `notification_prefs.secciones`,
que leen los TRES armadores de reporte (once lecturas en `lib/reportes.ts`) y una
operación de la API de MaKo. Sacarlas deja el campo vivo y sin pantalla — un consumidor
huérfano, que es la forma en que un producto empieza a mentir en silencio.

Lo que volvió seguro borrarlas fue una consulta de una línea: **en los cuatro
workspaces con preferencias guardadas, las cuatro secciones están en `true`**. Nadie
apagó nunca una, así que sacar el control no cambia lo que sale.

**La regla: un campo con default y cero desviaciones medidas se puede quedar sin
pantalla; uno con desviaciones, no.** La diferencia son treinta segundos de consulta, y
sin ella las dos decisiones se parecen.

*2026-09-29*

### El botón de negrita ENVUELVE; los dos precedentes del repo REEMPLAZAN

**Vive en:** `app/agencia/EditorMensaje.tsx`

Los dos lugares del repo que insertan algo en un campo —los slots de un prompt, los
parámetros de una plantilla de Meta— sustituyen la selección por un token y dejan el
caret detrás. Copiar ese mecanismo para un botón de formato hace que apretar **B** con
texto seleccionado lo **borre** y deje dos asteriscos.

Un botón de formato envuelve y **vuelve a seleccionar lo de adentro**, que es lo que
permite encadenar (negrita y después itálica sobre lo mismo). Y la restauración va en el
tick siguiente: React todavía no pintó el valor nuevo, así que mover la selección ahí
mismo la aplica sobre el texto viejo.

⚠️ **Y el formato es el DIALECTO DEL CANAL, no HTML.** WhatsApp entiende `*negrita*`,
`_itálica_` y `~tachado~`, y el email los traduce solo (`marcasAHtml`). Un editor
contentEditable se vería bien en la pantalla y llegaría a WhatsApp como `<b>` literal —
al canal principal. Por eso el campo sigue siendo un textarea que muestra las marcas:
lo que se ve es lo que sale.

*2026-09-29*

### «Se DEBE poder configurar» tenía DOS mitades, y sólo una era una opción

**Vive en:** `lib/disparador-mensaje.ts` · `app/agencia/Disparador.tsx` · el reclamo en
`lib/espaciado.ts`

El pedido volvió después de shippearlo en prosa: **«el "Qué lo dispara" NO es
editable»**. La respuesta anterior —medir que para 60 de 65 mensajes el disparador es el
call site y dejarlo como un hecho— era cierta **y contestaba media pregunta**. «¿Qué lo
dispara? Un evento o está configurado por tiempo cada X tiempo» se lee como una sola
cosa y son dos: QUÉ lo produce (no es una opción: es lo que el mensaje ES) y CADA CUÁNTO
llega (sí lo es, y era la que faltaba).

**La trampa de leer «no se puede configurar» y cerrar el tema: casi siempre hay una
dimensión vecina que sí se puede, y es la que la persona quería.** Lo que la delató fue
buscar el mecanismo antes que el control: el `dedupTtlMin` del choke point ya decidía
cada cuánto sale cada aviso, con reclamo atómico y todo — sólo que el número estaba
cableado en cada call site en vez de salir de la pantalla.

⚠️ **Y la regla que hace que el control no dé miedo: se puede ESPACIAR, nunca APRETAR.**
Lo que pide quien emite es el TECHO de frecuencia (el cron de alerta crítica revisa cada
10 min y avisa cada hora a propósito), así que el choke point toma el **mayor** de los
dos. Con un `??` en vez del `Math.max`, elegir «cada vez» borraría esa protección y la
pantalla pasaría a poder producir **más** mensajes que antes — lo único que un control
así no puede hacer. Con el `Math.max`, en el peor caso produce uno de menos, que es
exactamente lo que se eligió.

*2026-09-29*

### El id con el que se guarda y el id con el que se busca no eran el mismo

**Vive en:** `ID_DE_REPORTE` en `lib/disparador-mensaje.ts` · el gate de
`despacharReporte` (`lib/notify.ts`)

Los tres reportes se identifican internamente con guion **BAJO** (`reporte_diario`, que
es también el `tipo` de su fila en el feed) y en el catálogo de mensajes con guion
**MEDIO** (`reporte-diario`). Buscar la configuración del primero en el store del
segundo no da error: no encuentra la entrada, contesta el default, y **el control de la
pantalla queda decorativo justo para los tres mensajes que más se abren.**

El mapa va **explícito** y no con un `replace` de guiones: un mapa que no conoce una
clave devuelve `undefined` y el llamador cae al comportamiento de siempre, mientras un
`replace` inventa un id plausible para cualquier `tipo` que se agregue mañana. Lo fija
`tests/disparador-frecuencia.test.ts`, que falla si alguno de los tres no está en el
catálogo (probado rompiéndolo: 2 fallos, 10 pases).

⚠️ **El olor general: dos sistemas que nombran la misma cosa y uno de los dos nombres
nació de una convención distinta.** No hay compilador que lo mire, y el síntoma es un
control que guarda bien y no cambia nada.

*2026-09-29*

### Dónde corta un espaciado decide si el hecho queda en la bitácora

**Vive en:** `emitirAviso` (`lib/avisos.ts`) contra `despacharReporte` (`lib/notify.ts`)

El mismo mecanismo, en los dos despachadores, y el lugar del corte es **opuesto a
propósito**:

- En un AVISO va **después** de `crearNotificacion`. El hecho pasó igual —un lead
  agendó, la cuenta se frenó— y tiene que quedar registrado aunque el negocio haya
  pedido que no le escriban tan seguido. Es la misma decisión que el interruptor: se
  apaga el WhatsApp, no el registro.
- En un REPORTE va **antes**. Ahí el feed ES el mensaje: no hay un hecho aparte que
  valga la pena guardar, y cortar después llenaría el historial de reportes que nadie
  pidió.

**La pregunta que lo resuelve en treinta segundos: ¿lo que estoy espaciando es el
MENSAJE o el HECHO del que habla?** Si son cosas distintas, el corte va después del
registro; si son la misma, antes.

*2026-09-29*

### Un guard que lee un archivo por su ruta se rompe cuando el código se MUDA

**Vive en:** `tests/avisos-dedup-entidad.test.ts` · `lib/espaciado.ts`

El reclamo atómico del dedup se mudó de `lib/avisos.ts` a `lib/espaciado.ts` porque lo
necesitaban los dos despachadores. Los cuatro tests que lo perseguían seguían haciendo
`readFileSync('../lib/avisos.ts')` y buscando `keyLast` con un regex: dos se pusieron
**rojos en el acto**, que es la suerte. La versión silenciosa de este mismo bug es la
contraria —el guard sigue en VERDE leyendo un archivo que ya no manda— y esta casa ya la
pagó al reemplazar un modal por un editor en la página.

**Al mudar una pieza, sus tests se mudan en el MISMO commit, y se vuelven a probar
rompiéndolos en el archivo nuevo.** Re-medido acá: volver el compare-and-set a un
`setSetting` da 3/1 en ese archivo y 14/2 corriéndolo junto con el test nuevo.

*2026-09-29*

### Un control nuevo se verifica ELIGIENDO y recargando, no mirándolo dibujado

**Vive en:** `app/agencia/Disparador.tsx`

Un desplegable optimista se ve idéntico cuando guardó y cuando no: pinta el valor nuevo
igual, y el 403 o el `undefined` aparecen recién en la recarga siguiente, cuando nadie
está mirando. La verificación son tres pasos y no dos: elegir, **recargar la página**, y
comprobar que sigue ahí.

Medido en el navegador contra `/mensajes`: «Cada vez» → elegir «Máximo uno por día» → la
respuesta de `/api/perfil/plantillas` trae `frecuenciaMin: 1440` → F5 → sigue en «Máximo
uno por día». Y el paso que no se saltea: **se deja como estaba**, porque el único
workspace donde esa pantalla se puede ver es el **ws1, que es un cliente real**.

*2026-09-29*

### «El flujo de conversación» no existía como pantalla, y elegir cuál era es la decisión cara

**Vive en:** `app/chatbot/FlujoLienzo.tsx` · `lib/flujo-conversacion.ts`

El pedido dijo «los editables del flujo de conversación» como si hubiera uno. Hay
**siete cosas que modelan pasos** y sólo dos se llaman «flujo» en el código — y la
frase «flujo de conversación» **no aparece en una sola pantalla del producto** (0 hits
en `app/` y `lib/`). O sea que el nombre no desempata: desempata el dato.

Medido en producción el 30/09/2026:

| Candidato | Filas | Pasos | ¿El motor ejecuta ramas? |
|---|---|---|---|
| `Flujo` de aviso (`lib/flujos-tipos.ts`), el que se llama «Flow Editor» | **4** | **0** | no: `esperar` hace `break` y ningún cron lo drena |
| `nutricion_secuencias.pasos` (el Chat Agent) | **62** | **136** | **sí**: `requiere` (27 usos), `variantes`, y `logradoSecuencia`/`falloSecuencia` con `encadenar()` cableado al cron vivo |

El que se LLAMA editor de flujos está vacío; el que no se llama así es el único con
algo que dibujar. **Cuando un pedido nombra una pantalla que no existe, el candidato
se elige por dónde están las filas y qué ejecuta el motor, no por el nombre del
módulo** — y son treinta minutos de consulta contra una semana construyendo el
editor de un modelo muerto.

⚠️ Y el segundo número da vuelta el diseño: **la secuencia más grande de toda la base
tiene TRES pasos** (promedio 2,2). Un lienzo infinito con paneo, zoom y posiciones
guardadas para siete nodos es maquinaria desproporcionada — por eso el layout se
calcula y no se guarda.

*2026-09-30*

### Un pedido puede contradecir una decisión escrita del MISMO dueño

**Vive en:** el comentario de cabecera de `lib/flujo-conversacion.ts`

«Quiero que sea como el editable de Manychat» choca de frente con tres cosas suyas ya
escritas: el canvas drag-to-connect del funnel **se construyó** (14 etapas, 24
flechas), él lo llamó **«rebuscado»**, y la conclusión quedó en tres lugares —
`docs/estado-del-arte.md`, `docs/hallazgos-crm.md` y la memoria, esta última con la
frase «el editor manual es el último recurso, y simple (**lista/forms, no canvas**)».
Más: en las 48 horas previas mandó borrar **dos** editores, uno de ellos el mapa de
transiciones con flechas, pidiendo «que sea simple la edición, nada compleja».

Lo que resuelve la contradicción no es elegir un bando: es **separar QUÉ pidió de
CÓMO**. Releyendo su propia cita, lo rebuscado era *configurar flechas* — «así se
evita que el usuario tenga que configurar flechas». Un lienzo donde las aristas
**salen del dato** (el orden de los pasos, `requiere`, `logradoSecuencia`) no pide
configurar ninguna: aparecen porque la secuencia hace eso. Se cumple el pedido nuevo
sin revertir el viejo.

**La regla: cuando un pedido contradice una decisión suya versionada, se busca la
dimensión en la que las dos son ciertas — y si no la hay, se dice antes de construir,
no después.** Gana el pedido más NUEVO, siempre; lo que no se puede es no haberlo
mirado.

*2026-09-30*

### Un lienzo DIBUJA UNA AFIRMACIÓN, y por eso miente más fuerte que un formulario

**Vive en:** `CONDICIONES_VIVAS` en `lib/flujo-conversacion.ts` · el guard en
`tests/flujo-conversacion.test.ts`

Una flecha que se bifurca dice «acá el motor decide». Se lee sin abrir nada y parece
la estructura del sistema, así que si el motor no decide ahí, el dibujo miente con la
autoridad de un diagrama — bastante más que un campo en un formulario.

El caso concreto: `requiere: 'sin_respuesta'` está escrito en **7 pasos de
producción**, y `lib/nutricion.ts` tiene rama para `respondio`, `ya_contactado` y
`primer_contacto` **y para ésta no**: cae de largo y el mensaje sale igual, le haya
contestado el lead o no. El lienzo dibuja lo que PASA («sale siempre», con su marca) y
no lo que el campo promete.

Lo que lo sostiene es un guard que **lee las condiciones del motor de su propia
fuente** y falla si las dos listas se separan — en cualquiera de las dos direcciones.

⚠️ **Y la primera versión de ese guard midió el universo equivocado**: contaba también
el SANEO (`...(p.requiere === 'respondio' || … || p.requiere === 'sin_respuesta' ?
…)`, que sólo dice qué valores se GUARDAN) y concluía que el motor evalúa las cuatro —
o sea que habría dado permiso para dibujar la bifurcación muerta. Lo que decide si un
paso sale es un `if` del despachador o el `findIndex` que salta al siguiente. **Al
atar un dibujo a un motor, la pregunta no es «¿dónde aparece el campo?» sino «¿qué
línea DECIDE?».**

*2026-09-30*

### `setPointerCapture` retargetea el `pointerup`: el clic se anota al APRETAR

**Vive en:** `onPointerDown` / `onPointerUp` en `app/chatbot/FlujoLienzo.tsx`

Un lienzo captura el puntero para que el paneo no se corte al salirse del contenedor.
La captura **retargetea todos los eventos siguientes al elemento que capturó**, así
que en el `pointerup` el `e.target` **es el contenedor** y `closest('[data-nodo]')`
devuelve null SIEMPRE. Síntoma: tocar un paso no abre nada, con el handler leyéndose
perfecto. El nodo se anota en el `pointerdown`, que es el único momento en que
`e.target` todavía es el nodo.

⚠️ **Y `releasePointerCapture` puede TIRAR, y llevarse el clic puesto.** Estaba antes
de resolver la selección; un `InvalidPointerId` —cuando la captura no llegó a
tomarse— abortaba el handler entero. Va adentro de un `try` y **después** de resolver
el clic.

⚠️ **Y `overflow: hidden` NO impide que el contenedor se scrollee POR CÓDIGO.** Un
`scrollIntoView`, el foco de un input de un nodo fuera de cuadro o el buscar-en-página
lo corren, y ahí el `transform` sigue diciendo una cosa y en pantalla todo está en
otra: medido, un nodo a 1652 px se «movió» 330 px con el transform intacto. La vista
la gobierna el transform y nada más — `onScroll` devuelve el scroll a cero.

⚠️ **Y `ResizeObserver.observe()` dispara al suscribirse.** Cualquier cosa que
reinstale el observer vuelve a encuadrar y deshace el paneo que la persona acaba de
hacer; se lee como que el lienzo «rebota solo». Reencuadrar es una DECISIÓN: se guarda
la firma de lo último encuadrado (grafo + caja) y el botón «Centrar» es el único que
lo fuerza.

*2026-09-30*

### Verificar una pantalla nueva cuando el árbol compartido no compila

**Vive en:** el procedimiento, no un archivo

La otra sesión tenía trabajo a medias (`leadsDeOtrosProductosAction` sin exportar) y la
app **entera** no hidrataba: cualquier verificación en el clon compartido habría dado
«la pantalla no existe» sobre una pantalla que estaba perfecta. Se verifica desde un
worktree limpio con los propios archivos copiados encima.

⚠️ **Y el junction de `node_modules` que alcanza para pushear NO alcanza para correr
el dev server**: Turbopack lo rechaza con «Symlink [project]/node_modules is invalid,
it points out of the filesystem root», porque su raíz es el worktree y el destino está
por encima. Se arregla subiendo `turbopack.root` al clon principal **en el worktree
solamente** — copiar `node_modules` no es una opción, es del orden de los minutos.

⚠️ **Y `innerText` aplica `text-transform`.** Un rótulo con `textTransform:
'uppercase'` vuelve en MAYÚSCULAS, así que un `includes('El mensaje')` da false sobre
un editor perfectamente abierto. Costó dos vueltas diagnosticando un clic que
funcionaba: lo que estaba roto era la aserción. **Antes de creerle a una verificación
que dice «no aparece», comprobá que el DOM no esté diciendo lo mismo con otras
letras** — `aria-pressed` del elemento no miente y `innerText` sí.

*2026-09-30*

### El relevo midió bien y eligió mal: QUÉ pantalla lo dice quien pide, no el dato

**Vive en:** `app/agencia/FlujoAviso.tsx` · `app/chatbot/FlujoLienzo.tsx`

«Quiero que los editables del flujo de conversación sea como el editable de
Manychat» no nombra una pantalla que exista. Cinco relevos midieron el dato y la
respuesta fue nítida: el modelo con filas y con ramas es la secuencia del Chat
Agent (62 secuencias, 136 pasos) y no el que se llama «Flow Editor» (4 flujos, 0
pasos). Se construyó ahí. **Y él estaba mirando Configuraciones › Notificaciones**,
que es donde venía trabajando las cinco tandas anteriores.

Lo caro no es que la medición estuviera mal —estaba bien— sino que contestaba otra
pregunta. «¿Dónde está el modelo que más se parece a esto?» no es «¿qué pantalla
tenía abierta?», y la segunda la contesta una captura o una frase, no una consulta.

⚠️ **Y el propio relevo lo había marcado.** En su lista de *no medido* decía, con
todas las letras: «Cuál de las dos pantallas quiere… es la ambigüedad que más
cambia el alcance». **Un «no medido» que el relevo describe como lo que más cambia
el alcance no es una nota al pie: es la pregunta.** Si no se puede medir y decide
el trabajo, se pregunta antes de construir — cuesta una frase.

Lo que abarató el error: el lienzo se había escrito lo bastante genérico como para
mudarlo. `app/_components/Lienzo.tsx` no sabe qué dibuja; lo propio de cada flujo
son el grafo y los editores por nodo. Llevarlo a la otra pantalla fue un grafo
nuevo de 90 líneas, no un editor nuevo.

*2026-09-30*

### `margin: 0 auto` en un item flex dibujó un lienzo al 33%

**Vive en:** el contenedor del detalle en `app/agencia/TemplateDetalleModal.tsx`

Ya estaba escrito que `margin-inline: auto` sin `width: 100%` **encoge** un item
flex en vez de centrarlo, medido en una barra que salió a 419 px y partida en dos
renglones. Con un lienzo adentro el mismo bug se ve distinto y peor: el contenedor
quedó en **344 px dentro de un panel de 1130**, el encuadre automático hizo su
trabajo y dibujó el grafo **al 33%** — cuatro tarjetas ilegibles del tamaño de una
uña, sin un solo error, sin nada roto.

**El síntoma de esta familia no es «se desborda»: es «se ve chiquito».** Y con un
lienzo que se auto-encuadra, el encuadre TAPA la causa — hace exactamente lo que le
pidieron con el ancho que le dieron. Lo que lo delata es recorrer los ancestros con
`getComputedStyle` y mirar dónde cae el ancho: el salto fue de 1130 a 344 en un
solo nivel.

*2026-09-30*

### Un guard que recorta el archivo puede no ver justo lo que persigue

**Vive en:** `tests/flujo-aviso.test.ts`

El guard del `margin: 0 auto` leía los **1400 caracteres anteriores** al montaje del
lienzo, con un razonamiento razonable: el contenedor está ahí arriba. El contenedor
estaba ochenta líneas más arriba. Devolver el bug **pasó en verde**.

Lo cazó romperlo, no leerlo: la rotura R1 dio 10 pases y 0 fallos, que es el
resultado que no tenía que dar. **Recortar el archivo antes de buscar es elegir un
universo, y un universo elegido a ojo deja afuera lo que uno no está imaginando.**
Si la afirmación es «esto no vuelve a aparecer», el universo es el archivo entero;
el recorte sólo se justifica cuando lo que se busca es legítimo en otra parte del
mismo archivo — y entonces hay que decir por qué.

*2026-09-30*

### Cuando la misma pieza va a servir a dos pantallas, se extrae ANTES de la segunda

**Vive en:** `app/_components/Lienzo.tsx` · `lib/lienzo-grafo.ts`

El segundo lienzo apareció el mismo día que el primero. Extraer el chrome
—paneo, zoom, encuadre, el panel, las curvas— costó una hora; copiarlo habría
costado cero y habría dejado dos lienzos con las mismas cuatro trampas resueltas en
dos lugares, que se separan en la primera edición. Es la razón escrita por la que
se borró el editor de diagramas del funnel dos días antes.

⚠️ **Y lo que hace que la mudanza sea barata es que los guards se pongan ROJOS.**
Al mover la maquinaria, los seis tests que leían `FlujoLienzo.tsx` por su ruta
fallaron en el acto y se mudaron con ella a `tests/lienzo.test.ts`. La versión
silenciosa de este mismo bug —un guard que sigue VERDE leyendo un archivo que ya no
manda— es la que esta casa ya pagó al reemplazar un modal por un editor en la
página. **Un test que lee una ruta es un test que hay que mudar a mano; lo único
que lo hace visible es que la ruta vieja deje de tener lo que el test busca.**

*2026-09-30*

### Un nodo de un lienzo es algo que OCURRE, no un dato del mensaje

**Vive en:** `grafoDeAviso` en `lib/flujo-aviso.ts`

«Te llega al grupo de WhatsApp» era un nodo, y el dueño lo tumbó con una frase que
vale como regla: **«es un paso que no hace nada»**. Por dónde sale un mensaje es
una PROPIEDAD del mensaje, no un paso del flujo — y dibujarla como paso hace que
el grafo cuente un hecho de más, encima uno que desde ahí no se puede tocar
(el canal se elige al entrar al mensaje, no adentro).

Lo que sí había que conservar es la parte que AVISA: con los dos canales apagados
el mensaje no sale por ningún lado, y eso no se ve en ninguna otra pantalla desde
que los chips de canal se sacaron del detalle. Se mudó al título del nodo del
MENSAJE, que es de quien es.

**La prueba, antes de agregar un nodo: ¿esto ocurre, o esto es un campo?** Si es un
campo, va adentro del nodo al que pertenece.

*2026-09-30*

### El chrome de un lienzo FLOTA, o el dibujo se queda sin la mitad

**Vive en:** `chrome` en `app/_components/Lienzo.tsx` · `app/agencia/TemplateDetalleModal.tsx`

El detalle tenía topbar + cabecera + lienzo + pie, cada uno con su renglón. Medido:
entre los tres le comían **~180 px de 620**, el encuadre automático hizo su trabajo
con lo que quedaba y el grafo entró **al 33%** — cuatro tarjetas del tamaño de una
uña. El pedido fue literal: «el lienzo tiene que ocupar absolutamente todo el
recuadro, incluso donde dice "cerrar el editor"».

Todo lo que no es el dibujo pasa a flotar ENCIMA, en tarjetitas con fondo propio
para leerse sobre el punteado. Y flotar no alcanza: el contenedor tiene que
entregarle el alto entero (`sinMarco`, porque dos marcos anidados dejan un filete
doble) y el chrome va con `pointerEvents: 'none'` en su capa y `auto` en su
contenido, o la franja de arriba se traga el paneo.

⚠️ **Y el botón de guardar estaba PINTADO DETRÁS del dibujo**, asomando por un
costado: «hay un botón azul detrás del lienzo, no tiene sentido». Cuando un lienzo
pasa a ocupar el recuadro, todo lo que estaba abajo queda debajo — no al lado.

*2026-09-30*

### Un componente que puede no mostrar nada tiene que poder NO DIBUJARSE

**Vive en:** `PrefsDeMensaje` (`app/perfil/PrefsDeMensaje.tsx`)

`PrefsDeMensaje` devuelve `null` para todos los mensajes menos uno. Envuelto en una
tarjeta desde AFUERA —`<div style={tarjeta}><PrefsDeMensaje/></div>`— ese `null` se
convierte en **una cajita blanca vacía flotando sobre el lienzo**. No es un error,
no rompe nada, y se ve exactamente como un bug.

**El envoltorio lo elige quien monta, pero lo APLICA el componente.** Va como prop
de estilo, después del `return null`. Vale para cualquier pieza condicional: el que
sabe si hay algo que mostrar es ella, no el que la coloca.

*2026-09-30*

### Escribir con formato sobre un modelo de MARCAS: contentEditable, y sus tres trampas

**Vive en:** `app/agencia/EditorMensaje.tsx` · `app/_components/TextoMarcas.tsx`

Lo que se guarda son las marcas del canal (`*negrita*`, `_itálica_`, `~tachado~`):
eso es lo que WhatsApp entiende y lo que el email traduce solo. Hasta ahora el
campo era un textarea que las MOSTRABA, con el argumento de que «lo que se ve es
lo que sale» — y el dueño lo reportó dos veces como un defecto: «tiene cosas como
`**` pero no se formatea, eso está mal».

El modelo no cambió; cambió cómo se escribe. Las tres trampas, todas medidas:

1. **El caret salta si se reescribe el HTML en cada tecla.** React no controla ese
   nodo: el HTML se escribe una vez y sólo se vuelve a escribir cuando el valor
   viene de AFUERA — se compara contra lo último que el propio editor emitió.
2. **`execCommand` está deprecado y es lo correcto acá.** Es lo único que envuelve
   una selección respetando los límites de los nodos y dejando el caret donde va;
   reimplementarlo con Range es el bug de «apretar B con texto seleccionado lo
   borra», que este repo ya pagó. Va con `styleWithCSS = false` para que emita
   `<b>` y no un `<span style>` que el serializador tenga que adivinar.
3. **Lo que pega el portapapeles entra con su HTML.** Se intercepta `paste` y se
   inserta texto plano.

⚠️ **Y el render NO es markdown.** Una marca abre y cierra en la MISMA línea y no
puede estar vacía: `**` suelto —lo que deja el botón cuando no hay nada
seleccionado— es TEXTO, y tratarlo como markdown lo haría desaparecer de la
pantalla mientras al lead le llega igual.

*2026-09-30*

### Arrastrar un nodo: el delta se divide por el ZOOM

**Vive en:** `onPointerMove` en `app/_components/Lienzo.tsx`

La primera versión del lienzo calculaba el layout y no lo guardaba, con el
argumento de que para cuatro nodos acomodar a mano es ceremonia. El dueño pidió lo
contrario —«no se pueden arrastrar por el lienzo las tarjetas, sí deberían»— y la
posición pasó a persistirse por mensaje.

Tres cosas que no son obvias:

- **El delta del mouse va DIVIDIDO por la escala.** Al 50%, mover el cursor 100 px
  tiene que mover la tarjeta 200 en coordenadas del grafo; sin eso el dibujo se
  despega del cursor, y cuanto más lejos del 100%, más.
- **Agarrar una tarjeta la mueve; agarrar el fondo panea.** Es la misma distinción
  que hace cualquier editor de nodos, y sale del `data-nodo` que ya se anota en el
  `pointerdown` por la trampa de la captura.
- **El guardado va al SOLTAR, con un respiro.** Un POST por `pointermove` son
  sesenta por segundo contra la misma fila. Y es OPTIMISTA a propósito: esperar la
  respuesta deja la tarjeta volviendo a su lugar en cada arrastre.

⚠️ **Y las posiciones se PODAN al guardar.** Una coordenada de un nodo que ya no
existe sobrevive para siempre, y el próximo paso con el mismo id nace en el lugar
del que se fue.

*2026-09-30*

### Dos dueños del mismo objeto: el segundo en guardar se lleva puesto al primero

**Vive en:** `FlujoAviso` (`app/agencia/FlujoAviso.tsx`), donde se absorbió `Recordatorios`

`setFlujo(id, flujo)` reemplaza el flujo ENTERO. Mientras el único que lo tocaba
era el paso `insistir`, tener a `Recordatorios` leyéndolo y escribiéndolo por su
cuenta funcionaba. En cuanto el lienzo pasó a editar también el DISPARADOR y los
PASOS, eran dos componentes con su propia copia del mismo objeto: el que guardara
segundo escribía su copia vieja encima.

**El olor que lo delata antes de que pase: dos componentes que llaman al mismo
setter de un objeto COMPLETO.** No hace falta que se pisen hoy — basta con que los
dos puedan escribir. La cura no es coordinarlos: es que haya uno.

Al absorberlo se enumeró lo que tenía de propio (las dos opciones, los números con
su techo dicho, el aviso de WhatsApp apagado, y que apagar cierre las insistencias
ya abiertas) y se movió todo. Lo único que quedó del componente viejo es su nombre
en el `vive[]` del área, que el test de rutas cazó en el acto.

*2026-09-30*

---

## Un BORRADOR no es un default: es lo único del store que no se hereda

**Vive en:** `lib/plantillas.ts` · `app/agencia/TemplateDetalleModal.tsx` ·
`app/api/perfil/plantillas/route.ts` · `app/api/admin/plantillas/route.ts`

El pedido, textual (30/09/2026): *«siempre que se cierra y haya cambios, debe
preguntarme si quiero publicar o guardar como borrador […] y que siempre que me salgo
de la vista, de la manera que sea, se guarde como borrador, que no se pierda nada.
Pero solo cuando le doy a publicar, se publica»*.

El store de plantillas es **por workspace con lo del dueño como default**, y la fusión
es **por CAMPO** (`leerStore`): un cliente que sólo apagó un aviso conserva el texto y
el flujo que venían de la agencia. Eso es correcto para todo lo que ya había — y
convierte a un campo nuevo de borrador en una fuga:

- cada cliente abre el mensaje con un **«Sin publicar»** que nunca tipeó,
- lee un texto que escribió otro,
- y al apretar **Publicar** publica en SU negocio el borrador de la agencia.

**La regla: un default es algo terminado. Un borrador no.** `borrador` es el único
campo que `leerStore` **saca de la base heredada** antes de fusionar, con la excepción
escrita en el merge — que es el único lugar donde alguien la va a leer. Y el motor
nunca lo ve: resuelve el texto por `referenciaPlantilla` → `ejemplo` → `e.texto`, así
que el borrador no puede salir por WhatsApp ni por mail aunque alguien se olvide de
publicar. Lo fija `tests/flujo-aviso.test.ts` («EL MOTOR NO PUEDE LEER UN BORRADOR»),
que además barre `avisos.ts`, `notify.ts`, `flujos.ts` e `insistencias.ts` buscando la
palabra.

⚠️ **Y PUBLICAR PROMUEVE LO GUARDADO, no lo que está en pantalla.** El borrador se
guarda con 900 ms de respiro (uno por tecla serían sesenta por segundo), así que
`publicar` sin mandar el borrador primero **y sin cancelar el debounce** publica el
texto de hace un segundo. Es el modo de falla de siempre: nada da error, sale la
versión anterior, y el cartel dice «Publicado ✓». El orden queda fijado por un guard
que compara los índices de los dos `action:` dentro del cuerpo de `publicar`.

⚠️ **Y «salir de la vista, de la manera que sea» son DOS caminos distintos.** El
desmonte del componente cubre cerrar el detalle y cambiar de mensaje;
`visibilitychange` cubre cambiar de pestaña y cerrar el navegador, donde el desmonte
**no corre**. Lo que no se cubre es matar el proceso, y por eso la ventana real de
pérdida son los 900 ms del debounce — escrito en el comentario, porque un «no se
pierde nada» sin su letra chica es una promesa que el código no puede cumplir.

⚠️ **Y el guard de eso era DÉBIL hasta que se rompió.** Pedía
`assert.match(src, /visibilitychange/)`, y la palabra aparece también en el
`removeEventListener` y en el comentario: borrar el `addEventListener` entero dejaba el
test en **VERDE** (medido: exit 0). Ahora pide el ALTA
(`addEventListener('visibilitychange', alEsconder)`). Es la regla de la casa aplicada a
un guard propio: **un test que no se probó rompiéndolo es una afirmación.**

⚠️ **Y el borrador que iguala a lo publicado se BORRA, no se guarda.** Un «Sin
publicar» sobre un texto idéntico al que sale es un cartel que no se puede apagar:
deshacer a mano lo que se había escrito tiene que devolver la pantalla a limpio.
`setBorradorPlantilla` compara contra `referenciaPlantilla` y elimina la clave — y si
la entrada queda vacía, se va entera (una entrada vacía dice «este cliente tocó esto»
cuando no tocó nada).

Verificado en el navegador el 30/09/2026 (ws1, `/configuraciones` → Notificaciones →
Reporte semanal → Editar): escribir dispara UN POST `borrador`, aparece «Sin
publicar», Publicar se habilita, y al apretarlo los POSTs salen en el orden
`["borrador","publicar"]` y el cartel desaparece. Cerrando con la ✕ sale el diálogo
con los dos botones —«Dejar como borrador» / «Publicar y cerrar»—, y al volver a abrir
el texto con el cambio **sigue ahí** con su «Sin publicar».

*2026-09-30*

---

## El filtro de «qué pasos DIBUJA el lienzo» estaba escrito cinco veces, y el ＋ depende de él

**Vive en:** `lib/flujo-aviso.ts` (`pasosDibujados`, `insertarPasoTras`,
`quitarPasoDibujado`) · `app/agencia/FlujoAviso.tsx`

El ＋ aparece **al costado de una tarjeta**, así que promete dónde va a caer el paso
—que es justo lo que un botón suelto en una esquina no puede decir—. Los ids de los
pasos del grafo son `paso-<i>` sobre la lista **dibujada**, y `esperar` e `insistir` no
se dibujan: son del mensaje, no de la cadena.

`FlujoAviso.tsx` tenía ese filtro escrito **cinco veces** —el grafo, el editor, el
«quitar» y dos altas— y las cinco tienen que contestar lo mismo, o el ＋ de `paso-2`
inserta en otro lugar. Se mudó al módulo del grafo, que es quien define los ids.

⚠️ **Y LA PRIMERA VERSIÓN DE MI PROPIO TEST PASÓ EN VERDE CON EL BUG PUESTO.** Probaba
insertar tras `paso-0` en `[accion, esperar, accion]` contando sobre el array crudo: el
**orden dibujado salía idéntico** y lo único roto era que el `esperar` quedaba
**DUPLICADO** en el flujo guardado. Un `assert.deepEqual` sobre lo dibujado no lo
puede ver. Lo que lo caza es la **invariante de conservación**: insertar devuelve
`length + 1` y cada paso original aparece exactamente una vez. Medido rompiéndolo:
con `const vivos = pasos` el test viejo daba exit 0 y el nuevo da exit 1.

**La regla que queda:** cuando una función inserta o saca de una lista filtrada, no
alcanza con comprobar el ORDEN del resultado visible — hay que comprobar que no
duplicó ni perdió nada de lo que no se ve.

*2026-09-30*

---

## Mover un control flotante a una esquina: enumerá qué ya vive ahí

**Vive en:** `app/_components/Lienzo.tsx` (`ZOOM_ALTO`)

El pedido fue *«que los botones de zoom con el de acomodar la pantalla estén abajo a la
izquierda»*. Abajo a la izquierda ya vivía el **panel del editor de un nodo**, de
328×355 px. Medido con Playwright: solapamiento **total** — con un nodo abierto la
barra de zoom dejaba de existir, justo cuando hay algo que mirar y se quiere alejar.

Un lienzo tiene cuatro esquinas y las cuatro están tomadas (el chrome flotante arriba,
el panel del nodo abajo-izquierda, la acción abajo-derecha). **La esquina la pide quien
usa la pantalla; lo que se mueve es lo que ya estaba.** El panel abre `ZOOM_ALTO` px más
arriba y su `maxHeight` descuenta lo mismo, con el porqué al lado del número.

⚠️ **Y DOS BOTONES DECÍAN «Cerrar el editor» Y CERRABAN COSAS DISTINTAS.** El de la
pantalla se va del mensaje —y pregunta si publicar—; el del panel sólo repliega un
nodo. No lo encontró nadie leyendo: lo delató el **strict mode de Playwright**
(`getByLabel('Cerrar el editor')` → «resolved to 2 elements»). El del nodo pasó a
«Cerrar este paso». Es la regla de que cada botón nombra su acción y su objeto, vista
desde el otro lado: el rótulo genérico no se nota hasta que hay dos.

*2026-09-30*

---

## Un 404 de una ruta que EXISTE puede ser el caché de dev de Turbopack

**Vive en:** nada del repo — es una trampa del entorno.

Costó ~20 minutos el 30/09/2026. `/api/auth/dev-login` —la puerta por la que se
verifica todo en local— devolvía el **404 HTML de Next**, y con él `/api/auth/me` y
`/api/auth/logout`. El archivo estaba intacto, el guard `habilitado()` daba true, y la
MISMA URL había funcionado una hora antes en la misma sesión.

Las tres señales que lo distinguen de un bug de código, y conviene mirarlas en ese
orden:

1. **El SEGMENTO entero falla y sus hermanos contestan.** `/api/health`,
   `/api/perfil/plantillas` y `/api/admin/plantillas` devolvían 401 —o sea el
   middleware, o sea que el ruteo andaba— y sólo `/api/auth/*` daba 404.
2. **El 404 es la PÁGINA de Next, no el JSON de la ruta.** Si fuera el guard, el
   cuerpo sería `{"ok":false,"error":"not found"}`. El HTML dice que no matcheó nada.
3. **El log dice `application-code: NNms`**, que se lee como «la ruta corrió» y es el
   404 renderizándose.

La cura es matar el ÁRBOL del dev server (`taskkill /T /F` sobre el pid de `npm run
dev`) y borrar `.next/dev`. Lo que lo produce es editar mientras Turbopack compila, que
en este clon pasa siempre: dos sesiones y un servidor de dev.

⚠️ **Y la trampa gemela, del lado de la verificación:** una sonda que buscó el botón con
`/^Publicar$/` contra `aria-label || title || textContent` reportó **`publicar: null`**
sobre un botón que estaba dibujado y funcionaba — porque el botón tiene un `title`
largo («Publicar: MaKo empieza a usar este texto») y la comparación mira el título
primero. Es la misma familia que el `＋ Nuevo lead` del 30/09: **la primera hipótesis
correcta ante un resultado redondo e inesperado es la medición, no el código.**

*2026-09-30*
