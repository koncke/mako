# TikTok y LinkedIn en Automations: qué se puede de verdad (14/10/2026)

> Pedido de Martín (14/10/2026, textual en app/admin/dev/chatbot/bitacora.ts): «Implementar TikTok y LinkedIn... Intentar
> automatizar el chatbot para TikTok y Linkedin, eso sería un gran diferencial, ya que Manychat no se conecta a esas apps».
>
> Salió de una corrida de sólo lectura (workflow wf_5ff0c95d-2ac): el código de MaKo y tres frentes web (Zernio, TikTok,
> LinkedIn), con fuentes consultadas el 14/10/2026. Las líneas de código son de `ca125dc3`: se corren. ES EL PLAN DE TRABAJO.

## Para Martín, en cuatro líneas
- **TikTok sí se puede, por Zernio y por la vía oficial, pero sólo para contestar.** Funciona si la persona escribe primero, con una cuenta Business registrada fuera de Europa y del Reino Unido (LATAM entra), y con un tope de 10 mensajes en 48 h.
- **«ManyChat no se conecta a TikTok» es falso.** Lo tiene desde enero de 2025 y en EE.UU. desde noviembre de 2025. Lo que ManyChat no tiene en TikTok es el «comentario → DM». En LATAM eso no lo puede hacer nadie por vía oficial.
- **El chatbot de LinkedIn no se puede hacer de forma legal.** No hay DMs para terceros. Las herramientas que lo hacen entran con la sesión del usuario, y eso arriesga la cuenta de cada cliente. Encima, LinkedIn prohíbe que una IA conteste comentarios o mensajes, y prohíbe meter sus datos en un CRM.
- **Antes de TikTok hay que construir algo que falta.** Hoy el AI Step no contesta ni por Instagram ni por Messenger: una respuesta social sólo pausa el flujo. Eso se arregla primero y sirve para los tres canales.

---

## 1. Matriz por plataforma

Las fuentes están al final, en §6.

### TikTok

| Capacidad | API oficial de TikTok | Zernio (lo que usaría MaKo) | Otros / no oficial | Riesgo |
|---|---|---|---|---|
| **Recibir DMs** | **Sí.** Business Messaging API en beta abierta en APAC, LATAM, METAP y Norteamérica. No anda para cuentas del EEE, Suiza ni Reino Unido. En EE.UU. pide una revisión aparte (USDS) [TT-BETA][TT-PAIS] | **Sí, desde el 11/09/2026.** Webhook `message.received` [Z-BLOG][Z-TT][Z-WH] | ManyChat, respond.io y SleekFlow lo tienen por la vía oficial [MC-HELP][RIO-INT][SLEEK] | Bajo por la vía oficial |
| **Responder DMs** | **Sí.** Hasta 10 mensajes en 48 h desde el último mensaje del usuario [TT-SEND]. Otra página de TikTok da otra regla: ilimitado si el usuario responde, y 3 más pasadas las 48 h [TT-LIM]. Texto de hasta 6.000 caracteres, imagen, o tarjetas con 1 a 3 botones | **Sí.** El endpoint es `POST /v1/inbox/conversations/{id}/messages`, el mismo que ya usa `enviarDm`. Tope: 10 mensajes en 48 h. Cada mensaje es texto (≤6.000) **o** imagen JPG/PNG (≤3 MB); juntos dan `400 PLATFORM_LIMITATION`. Sin botones ni respuestas rápidas [Z-TT] | — | Bajo |
| **Iniciar la conversación** | **No, está prohibido.** «You are prohibited from initiating a conversation…» [TT-INI]. Sólo la arranca el usuario: escribiendo, desde un link TikTok.me con referencia o desde un anuncio de mensajes (`im_referral_msg`) | **No.** «TikTok does not let a business start a conversation» [Z-TT]. No confirmé si el referral de TikTok.me llega por Zernio | ManyChat dispara por link con referencia y por QR [MC-REF] | Escribir en frío viola los términos [TT-TOS] |
| **Comentarios: leer y responder** | **Sí,** en videos propios: leer, responder en público, like, ocultar y borrar. El webhook `comment.update` avisa en ≤5 min. Muchas respuestas parecidas seguidas se marcan como spam y se ocultan [TT-COM][TT-COMWH][TT-SPAM] | **Sí:** listar, responder en público, like, ocultar y fijar. Webhook `comment.received`, que **trae sólo el id del autor**. La doc se contradice sobre si hace falta cuenta Business [Z-TT][Z-PL] | — | Medio: el filtro de spam si las respuestas salen iguales |
| **Comentario → DM** | **Sólo para cuentas registradas en Vietnam, Indonesia y Tailandia** (Comment-to-Message). TikTok elige los comentarios «de alta intención»; no hay palabra clave [TT-C2M] | **No.** La respuesta privada es «Supported on Instagram and Facebook only»; un campo de DM da 400 [Z-PL] | ManyChat: «Coming next» (editado el 17/02/2026) [MC-NEXT] | Hacerlo por fuera de la API = baneo [TT-CG] |
| **Webhooks** | `im_receive_msg` (y `_eu` aparte), `im_referral_msg`, `im_receive_high_intent_comment`, `comment.update` | `message.received`, `message.sent`, `comment.received`, `reaction.received`. Un DM que no es texto llega con `metadata.tiktokMessageType` y el texto vacío [Z-WH] | — | — |

**Requisitos por Zernio** [Z-TT]:
- Cuenta **Business**: «TikTok refuses personal accounts».
- Región de registro **fuera del EEE, Suiza y el Reino Unido**.
- Conectada por la **TikTok for Business app**. Las conectadas antes del 10/09 dan `400` y hay que reconectarlas. Ojo: reconectar con OTRO @handle **borra para siempre** el inbox y el historial de la cuenta anterior.
- La cuenta tiene que aceptar DMs de «todos» o por «solicitudes». Si no, no llega el webhook.
- La vía oficial pide además «Advanced Access», que se obtiene vinculando la cuenta a TikTok for Business o a un Business Center [TT-ACC]. No confirmé si Zernio lo exige.

### LinkedIn

| Capacidad | Perfil personal | Página de empresa | Zernio | No oficial (Unipile, HeyReach, Expandi, Waalaxy) |
|---|---|---|---|---|
| **Recibir DMs** | **No.** La Messages API es «restricted to approved partners» [LI-MSG]. El programa está cerrado y es sólo para empresas reguladas por FINRA/SEC [LI-COMP] | **Sólo por 6 partners:** Bird, Brandwatch, Hootsuite, Oktopost, Sprinklr y Zoho Recruit [LI-PART]. No encontré endpoints públicos ni un formulario para ser partner | **No:** «LinkedIn blocks third-party DM access» [Z-LI] | Sí, con la cookie `li_at` o con usuario y contraseña, más proxies [UNI] |
| **Responder DMs** | No. Además, cada mensaje tiene que salir de una acción de la persona: «Member actions do not include an automated or scheduled event» [LI-MSG] | Sólo por esos partners. La persona escribe primero [LI-PAGES] | No | Sí, no oficial |
| **Iniciar la conversación** | No | No: «only… if they message the Page first» [LI-PAGES] | No | Sí, no oficial |
| **Comentarios: leer y responder** | No: `r_member_social_feed` es «select developers only» [LI-CMT] | **Sí,** por la Community Management API, con una app aprobada [LI-CMT][LI-REV] | **Sí, sólo en páginas de organización,** con respuesta pública. Zernio los lee por sondeo, sin frecuencia documentada [Z-LI] | — |
| **Comentario → DM** | No | No | No | — |
| **Webhooks** | — | Comentarios nuevos, editados y borrados, sólo en el nivel Standard [LI-WH][LI-TIER] | `comment.received`, que nace del sondeo (no es tiempo real). No hay webhooks de mensajes | — |
| **Riesgo** | — | **Alto en lo legal**, por las tres reglas de abajo | Mismas reglas (ver §5) | **Alto:** el Acuerdo de Usuario (§8.2) prohíbe «bots… send or redirect messages». LinkedIn restringe o cierra cuentas [LI-UA][LI-HELP] |

**Reglas de LinkedIn que chocan con cómo funciona MaKo:**
- **Nada al CRM:** prohíbe usar los datos de las personas «to create leads, to enhance customer data in a CRM» [LI-USE].
- **Plazos:** un comentario se guarda 48 h como máximo; el perfil, 24 h en caché [LI-STO].
- **IA:** prohíbe la «AI functionality that creates or modifies posts, comments, messages» a partir del contenido de terceros [LI-AI]. Un AI Step que contesta en LinkedIn viola esa regla.
- **Aprobación de la app:** organización legal registrada, email de empresa y una grabación de pantalla. El nivel Development deja 500 llamadas por día y no tiene webhooks [LI-REV][LI-TIER].

---

## 2. ¿ManyChat no se conecta a TikTok ni a LinkedIn?

- **TikTok: es FALSO.**
  - Beta abierta desde el 21/01/2025 [MC-TT1].
  - En EE.UU. desde el 04/11/2025, «in collaboration with the TikTok team» [MC-US].
  - Su ayuda, actualizada el 13/10/2026: sólo cuentas Business, nada en la UE ni el Reino Unido, una cuenta de TikTok por cuenta de ManyChat, sin costo extra [MC-HELP].
  - Dispara por palabra clave en DM, por link con referencia y por QR [MC-REF].
  - **No tiene el comentario → DM:** figura como «Coming next» [MC-NEXT].
  - Además tienen TikTok respond.io (desde el 24/01/2025; levantó lo de EE.UU. en 08/2026) [RIO-INT] y SleekFlow [SLEEK].
  - **El argumento «somos los únicos con TikTok» se cae.** Lo que queda como diferencial posible: un chatbot con IA (AI Step) atado al CRM y al funnel, con el mismo flujo en todos los canales. No verifiqué si ManyChat ofrece respuestas con IA en TikTok.
- **LinkedIn: es CIERTO, pero no por mérito de nadie.**
  - Lo dijo un moderador de su comunidad (06/03/2024 y 27/05/2025): «Still not possible… LinkedIn does not have a conversations API» [MC-LI]. No hay una declaración oficial de ManyChat.
  - Nadie lo hace de forma legal, salvo los 6 partners en Páginas. Bird anuncia un chatbot con IA en ese canal [BIRD].
  - El «diferencial» de LinkedIn sólo existe frente a ManyChat, y MaKo no lo puede alcanzar de forma legal.

---

## 3. Recomendación

**Se puede construir YA, seguro y por Zernio:**
1. **DMs de TikTok, sólo para contestar.** Llega el DM, se dispara una automatización, contesta una tarjeta TikTok o el AI Step, siempre dentro de 10 mensajes en 48 h.
2. **Comentario de TikTok → respuesta pública** con plantilla, que invita a escribir por DM. Hay que variar el texto por el filtro de spam [TT-SPAM]. No hay respuesta privada.
3. **Primero, el motor de respuesta social** (fase 0 de §4). Sin eso no hay «chatbot» en ningún canal social.

**Lo tiene que gestionar Martín (paso concreto):**
- **Una cuenta TikTok Business de prueba** registrada en LATAM, para el ws3 (nunca el ws1):
  - En TikTok: Privacidad → Mensajes directos → «Todos» o «Solicitudes».
  - Si TikTok lo pide, vincularla a TikTok for Business o a un Business Center.
  - Conectarla desde Integraciones (OAuth de Zernio).
- **El cupo de Zernio:**
  - Desde la 3.ª cuenta conectada, US$6 por cuenta al mes; de la 11.ª en adelante, US$3 [Z-PRICE].
  - 10.000 mensajes salientes por mes gratis; después, US$1 cada 10.000. Sin tarjeta cargada, el mensaje 10.001 falla con `403` [Z-PRICE-MSG].
- **Preguntarle por escrito al soporte de Zernio:**
  - (a) ¿Atienden cuentas de TikTok registradas en EE.UU. (revisión USDS)?
  - (b) ¿MaKo necesita su propia revisión de seguridad con TikTok?
  - (c) ¿Los DMs de TikTok entran en los mensajes que se cobran?
  - (d) ¿Llega el referral de TikTok.me o de los anuncios de mensajes?
  - (e) ¿Los comentarios piden cuenta Business?
- **Si insiste con DMs en Páginas de LinkedIn:** la única vía es contactar a un partner (por ejemplo Bird). Es una integración nueva y sin documentación pública. No la recomiendo antes del 04/11.

**Lo que NO conviene hacer:**
- **DMs de LinkedIn por Unipile, HeyReach, Expandi o Waalaxy.** Violan el §8.2 del Acuerdo de Usuario y el riesgo cae sobre la cuenta personal de cada cliente (HeyReach perdió su página y los perfiles de sus directivos el 25/03/2026 [HEYREACH]).
- **Un AI Step sobre comentarios de LinkedIn, o crear leads desde LinkedIn.** Lo prohíben la política de IA [LI-AI] y los usos restringidos [LI-USE].
- **En TikTok:** mensajes en frío, comentario → DM fuera de la API, o extensiones de Chrome (la que hay tiene 1,2 estrellas y reseñas de cuentas bloqueadas) [TT-CHROME][TT-CG].
- **Prometer «comentario → DM en TikTok»** para clientes de LATAM.
- **Respuestas a comentarios de LinkedIn con plantilla fija:** técnicamente es posible, pero da poco valor y no puede crear leads. Por la poda («puede ser» → no se hace), queda **postergado**.

---

## 4. Plan de implementación

Las líneas son de `C:/dev/wt-undecima` en `ca125dc3`. `origin/main` ya está en `46958506`: revisar las líneas sobre main antes de editar.

**Fase 0. Que el AI Step conteste por redes (prerrequisito; destraba también Instagram y Messenger)**
- `lib/nutricion.ts:4922-4991`: `pausarPorRespuesta` con `soloPausa` hoy sólo pausa. Tiene que contestar por el medio de origen. `asistirRespuesta` (`:5038`, `:5167`) tiene que recibir `{ medio }`.
- `app/automations/EditorPasoIA.tsx:75`: sumar los medios sociales a `MEDIOS_OFRECIDOS` recién cuando el motor conteste (lo pide su comentario de `:40-41`).
- `lib/flujo-ia.ts:1562` y `:2126`: dejar de sacar «Si responde» de los flujos sociales.
- `lib/ig-chatbot.ts` (`git show 8d16c6ff^:lib/ig-chatbot.ts`): sirve sólo como referencia. Se rehace con las piezas de hoy (regla «nunca una versión vieja»).
- **Recibir el primer evento real de Zernio en el ws3.** Nunca llegó ninguno: el 12/10, los ws10, 11 y 13 tenían `webhook_ok=false`.

**Fase 1. Que el canal social no sea sólo de Meta (refactor sin cambio visible)**
- `lib/canal-social.ts`:
  - `esCanalSocial` (`:26`) tiene que salir de la tupla.
  - Los ternarios binarios pasan a `Record<CanalSocial,…>`, así el compilador obliga a completarlos: `plataformaDe` y `canalDePlataforma` (`:29-31`), `problemaDeAdjunto` (`:288-298`), `linkDeReferencia` (`:503-507`), `logoSocialSvg` (`:552`).
  - Hoy, si se suma `'tiktok'`, esos ternarios lo tratarían como Messenger **sin avisar**.
  - `decidirSalida` (`:84-100`, `:50-52`) pasa a una política por plataforma. Meta: 24 h y una respuesta privada en 7 días. TikTok: 48 h, 10 mensajes, sin respuesta privada, texto o imagen.
  - `TOPE_TEXTO_SOCIAL` (`:310`) pasa a ser por plataforma: 1.000 en Meta, 6.000 en TikTok.
- `lib/zernio.ts`:
  - El filtro `:226` descarta hoy toda cuenta de TikTok.
  - `urlParaConectar` (`:232`) se tipa con la plataforma nueva.
  - `esLimiteDeMeta` (`:399-404`) pasa a errores por plataforma (`400 PLATFORM_LIMITATION`).
  - Para TikTok se filtra por `accountId` y no por `platform`: el openapi.yaml de Zernio todavía no lista TikTok [Z-OAS].
- `app/api/zernio/route.ts:57`: aceptar `tiktok`.
- Tests que fijan hoy el comportamiento binario: `tests/canal-social.test.ts`, `disparadores-canal-social.test.ts`, `condiciones-instagram.test.ts`, `editor-disparadores.test.ts`, `publicar-cron-social.test.ts`, `medios-automatizacion.test.ts` y `zernio-*.test.ts`.

**Fase 2. TikTok**
- **Base de datos:**
  - Una migración nueva cambia el CHECK de `0242_canales_zernio.sql:37-41` para sumar `'tiktok'`.
  - Hace falta un contador de mensajes en la ventana (para el tope de 10 en 48 h): una columna o un conteo sobre `nutricion_envios`.
  - El índice `(workspace_id, plataforma, igsid)` sirve tal cual.
- **Lo que entra:**
  - `lib/zernio-entrante.ts`: `filaDe` (`:90-108`) con la ventana de 48 h.
  - Un DM que no es texto llega con el texto vacío y `tiktokMessageType`.
  - El comentario trae sólo el id del autor, así que el lead nace sin username. `origen_lead` y `utm_source` se ajustan en `:170-171`.
  - `lib/canal-social.ts` `eventoSocialDe` (`:415-492`): storyReply, isStoryMention, referral.ad_id, standby e isLive son de Meta y no aplican.
  - Decidir si se suscribe `reaction.received` en `lib/zernio.ts:49`, o si se ignora explícitamente.
- **Lo que sale:**
  - `lib/canal-zernio.ts` `enviarPasoSocial` (`:106-185`): texto **o** imagen, sin respuesta privada; `siguenEnInstagram` (`:91`) no aplica.
  - La respuesta pública a un comentario es un endpoint nuevo en el cliente. La ruta exacta hay que sacarla del openapi o de la doc de Zernio.
- **CRON «Escribe por TikTok» y «Comenta en TikTok»:**
  - `lib/disparadores.ts`: `TRIGGER_TIKTOK`, `EVENTOS_TIKTOK`, `eventosDe` (`:252-258`), `TRIGGER_DE_CANAL` (`:285-290`), `CON_SUBTIPO` (`:356`), `claseDelTipo` (`:559-560`), `disparaPorEvento` (`:742-745`).
  - **Trampa:** hay que traducir `SUBTIPO_DEL_WEBHOOK` y `subtipoDelEvento` (`:264-281`). Si falta, la automatización no arranca nunca y no da error.
  - **Decide Martín:** la grilla de clases es 4+3, «nunca 3+3+1» (`:126-142`). Un botón TikTok la rompe.
  - En `lib/nutricion.ts`: `CanalNutricion` (`:127`), `EventoNutricion` (`:1849`), `TRIGGERS_POR_EVENTO` (`:1893-1894`).
- **Condiciones** (`lib/condiciones-catalogo.ts`):
  - `tiene_tiktok`, junto a `:443-449`.
  - `puede_escribir_tiktok`, junto a `:615-621`, con la política de TikTok.
  - La opción de origen, en `:728-729`.
  - `hechosDelCatalogo` (`nutricion.ts:3016-3077`).
  - Por la regla «MaKo nada por detrás», el tope de 48 h y 10 mensajes **se ve en el lienzo**: una condición con rama «no puede escribir» y un aviso, no un freno escondido en el motor.
- **Tarjeta TikTok:**
  - `EditorMensajeSocial.tsx` lleva un selector excluyente texto/imagen. Tope de 6.000 caracteres, imagen JPG/PNG de hasta 3 MB.
  - También: `SimuladorSocial.tsx`, `VistaMensajeSocial.tsx`, `social-ui.tsx:20/43-44/68`, `FlujoLienzo.tsx:658/703/805/816/1070`, `PanelProbar.tsx:141/169-170/1254-1255`, `EditorDisparadores.tsx:322`, `IconosDisparador.tsx:27/36`, `GaleriaPlantillas.tsx:111`.
  - En `ConectarMedio.tsx:166-179`, avisar que reconectar otra cuenta borra el historial.
- **AI Step por TikTok:**
  - `lib/flujo-grafo.ts:294-295/457-458/2156`.
  - `lib/flujo-ia.ts:263/920/1338-1339/2817-2818`. La regla del prompt «no deja escribir primero» (`:2933`) vale también para TikTok.
  - `lib/flujo-ia-preguntas.ts:62`.
- **Medios:** `lib/disparadores-canales.ts:55/77-79/104-117`, `lib/medios-automatizacion.ts:41-67/230`.
- **Resto:** `Lienzo.tsx:1925-1926`, `ServicioVisual.tsx:136-137`, `flujo-conversacion.ts`, `chatbot-lista-filtro.ts:127`, `motor-tick.ts:53`, `plantillas-automatizaciones.ts`, `app/crm/origen-lead.ts:41-42/74-75`, `OrigenCard.tsx:65-67`, `integraciones-catalogo.ts:27`.
- **Plantilla:** «Responde los DMs de TikTok», con un AI Step por objetivo.
- **Anti-spam:** la rama social se salta el anti-ban (`nutricion.ts:4403-4404`). En las respuestas a comentarios hace falta un tope visible.
- **API de MaKo** (regla del 13/10, en el mismo trabajo):
  - `chatbot.def.ts:432`: `editar_pasos_secuencia_mensajes` hoy acepta sólo whatsapp y email. Sumar instagram, messenger y tiktok.
  - `:459/:466/:473`: `cambiar_crons_secuencia`, con los eventos de TikTok.
  - `:201` y `email.run.ts:140`.
  - No hay ninguna operación de Zernio (conectar, estado del canal). Habría que crearla.
  - Regenerar `docs/api-mako.md`, el snapshot y `plugin/`.

**Qué se reusa de Instagram:**
- **Tal cual:**
  - El webhook (`app/api/webhooks/zernio/route.ts`): firma HMAC por negocio, deduplicación por `payload.id` y ruteo por profile y cuenta.
  - El cliente `zFetch`, los profiles por negocio y la key propia del negocio (BYOK).
  - El endpoint de envío de DMs.
  - El OAuth en ventana emergente.
  - La tabla `ig_conversaciones`, con el CHECK nuevo.
  - El editor y el simulador social.
- **No sirve para TikTok:** la ventana de 24 h, la respuesta privada, el follow-status, `HUMAN_AGENT` y handover, los eventos de historia, en vivo y referral, las reglas de adjuntos de Meta y `esLimiteDeMeta`.

**LinkedIn:** nada en este plan.

---

## 5. Lo que no se pudo confirmar
- **TikTok:**
  - Si Zernio atiende cuentas registradas en EE.UU. (revisión USDS), y si su aprobación nos libra de pasar nuestra propia revisión de seguridad.
  - La ventana real: las dos páginas de TikTok dan reglas distintas. Hay que implementar la más estricta: 10 mensajes en 48 h desde el último mensaje del usuario.
  - Si los comentarios piden cuenta Business (la doc de Zernio se contradice), y si el «Advanced Access» es obligatorio por Zernio.
  - Si el referral de TikTok.me o de los anuncios llega por Zernio.
  - Si los DMs de TikTok se cobran: Zernio no los lista entre los canales cobrados.
  - Si hay una política de TikTok sobre respuestas generadas con IA, cuánto tarda la aprobación oficial y los límites de velocidad de la API.
  - Si TikTok deja poner links en las respuestas públicas.
- **ManyChat:** si ofrece IA en TikTok.
- **LinkedIn:**
  - Si sus restricciones (CRM, 48 h, IA) obligan a MaKo como cliente de Zernio o sólo a Zernio como dueño de la app. Hasta saberlo, se toman como si obligaran a MaKo.
  - Cada cuánto sondea Zernio los comentarios.
  - Cómo se entra al programa de partners de mensajería de Páginas, y si la política de IA cubre Page Messaging.
  - Si hay restricciones por país, y en qué países están los anuncios «Conversation».
  - Las tasas reales de baneo: las únicas cifras vienen de competidores.
- **Nada de Zernio se probó con tráfico real.**

**Cosecha:** hecha el 14/10 (docs/hallazgos-comunicacion.md y docs/hallazgos-chatbot.md).
- `docs/hallazgos-comunicacion.md`: las capacidades de TikTok y LinkedIn, el estado de ManyChat, el openapi atrasado de Zernio y las trampas para leer las fuentes. WebFetch no lee la doc de TikTok: se lee por `business-api.tiktok.com/gateway/api/doc/client/node/get/v2/?identify_key=c0138ffadd90a955c1f0670a56fe348d1d40680b3c89461e09f78ed26785164b&doc_id=<id>`. La ayuda de ManyChat da 403, pero se lee por `help.manychat.com/api/v2/help_center/en-us/articles/<id>.json`.
- `docs/hallazgos-chatbot.md`: «el AI Step no contesta por redes; una respuesta social sólo pausa», los ternarios que tratarían a TikTok como Messenger y la trampa de los dos vocabularios.
- El índice `docs/hallazgos.md`, en el mismo commit.

---

## 6. Fuentes (consultadas el 14/10/2026)
- **Zernio:**
  - [Z-TT] https://docs.zernio.com/platforms/tiktok
  - [Z-PL] https://docs.zernio.com/platforms
  - [Z-BLOG] https://zernio.com/blog/september-11-2026-product-updates
  - [Z-WH] https://docs.zernio.com/webhooks
  - [Z-LI] https://docs.zernio.com/platforms/linkedin
  - [Z-PRICE] https://docs.zernio.com/pricing
  - [Z-PRICE-MSG] https://docs.zernio.com/pricing/messages
  - [Z-OAS] https://zernio.com/openapi.yaml
- **TikTok:**
  - [TT-BETA] https://business-api.tiktok.com/portal/docs?id=1832183871604753
  - [TT-PAIS] …?id=1832184145137922
  - [TT-REV] …?id=1832184206708737
  - [TT-INI] …?id=1832184236919810 y …?id=1832190670631937
  - [TT-SEND] …?id=1832184403754242
  - [TT-LIM] …?id=1854823717597185
  - [TT-COM] …?id=1776065099288577
  - [TT-COMWH] …?id=1810515104773122
  - [TT-SPAM] …?id=1762228448779266
  - [TT-C2M] …?id=1843697551083522
  - [TT-ACC] https://ads.tiktok.com/help/article/about-tiktok-account-entitlements
  - [TT-TOS] https://www.tiktok.com/legal/page/row/terms-of-service/en
  - [TT-CG] https://www.tiktok.com/community-guidelines/en/integrity-authenticity
  - [TT-CHROME] https://chrome.google.com/webstore/detail/pfpiegecilfgecllhlnbfnikgkibjdak
- **Otros proveedores de TikTok:**
  - [RIO-INT] https://respond.io/integrations/tiktok-business-messaging
  - https://respond.io/help/tiktok/tiktok-overview
  - [SLEEK] https://help.sleekflow.io/en_US/tiktok-business-messaging/connecting-tiktok-business-messaging-to-sleekflow
- **ManyChat:**
  - [MC-TT1] https://community.manychat.com/product-updates/manychat-is-now-on-tiktok-4826
  - [MC-US] https://community.manychat.com/product-updates/tiktok-automations-are-now-available-in-the-u-s-7729
  - [MC-HELP] https://help.manychat.com/hc/en-us/articles/17928990909084
  - [MC-REF] https://help.manychat.com/hc/en-us/articles/21033455635996
  - [MC-NEXT] https://help.manychat.com/hc/en-us/articles/17961702404892
  - [MC-LI] https://community.manychat.com/general-q-a-43/how-to-connect-manychat-with-linkedin-660
- **LinkedIn:**
  - [LI-MSG] https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/messages
  - [LI-COMP] https://learn.microsoft.com/en-us/linkedin/compliance/compliance-faq
  - [LI-PAGES] https://www.linkedin.com/help/linkedin/answer/a1356464
  - [LI-PART] https://www.linkedin.com/help/linkedin/answer/a6246714
  - [LI-CMT] https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api
  - [LI-WH] https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-social-action-notifications
  - [LI-REV] https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review
  - [LI-TIER] https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access
  - [LI-USE] https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases
  - [LI-STO] https://learn.microsoft.com/en-us/linkedin/marketing/data-storage-requirements
  - [LI-AI] https://learn.microsoft.com/en-us/linkedin/marketing/developer-ai-policy
  - [LI-UA] https://www.linkedin.com/legal/user-agreement
  - [LI-HELP] https://www.linkedin.com/help/linkedin/answer/90586
- **Otros proveedores de LinkedIn:**
  - [BIRD] https://bird.com/nl-nl/blog/launching-our-newest-channel-linkedin-page-messaging
  - [UNI] https://developer.unipile.com/docs/linkedin
  - [HEYREACH] https://www.heyreach.io/blog/quick-update-from-nick