# Migrar desde otro CRM a MaKo: investigación (08/10/2026)

Pedido de Martín (audio del 08/10): «averiguar cuáles son esas plataformas… de CRM conocidas, averiguar si tienen API, integrar la API… con un botón podés empezar la migración en lote». Esta es la mitad de CRM; la de cursos vive en `docs/migracion-cursos.md`. Es sólo investigación: no se construyó nada.

## Resumen: la recomendación y lo que decides tú

1. **Lo primero no necesita ninguna API:** todos los CRMs de la lista exportan CSV o Excel, y MaKo ya importa CSV/XLSX revisando fila por fila y sin duplicar. Lo que falta es que entren también la **etapa, las etiquetas, las notas y la fecha original**; hoy sólo entran nombre, email, teléfono, empresa y pago. Esto sirve para todos los CRMs desde el primer día.
2. **Después, dos conexiones por token**, en este orden: **GoHighLevel**, con un token de «Private Integration», que es el único que entrega por API las conversaciones de WhatsApp, SMS, email e Instagram; y **Kommo**, con un token de larga duración. Kommo es muy usado en LatAm para vender por WhatsApp, pero **su historial de chats no se puede sacar por API**.
3. **El plan B, que cumple la regla al pie de la letra** («el cliente NUNCA crea una app»): son los que se conectan con un botón OAuth registrado por MaKo. **Pipedrive** permite una app privada instalable por link y sin revisión. **HubSpot** permite una app propia de MaKo, con un tope de 25 cuentas hasta que se publique en su Marketplace.
4. **Decisión A:** ¿sacar un token desde una «integración privada» (GHL, Kommo y HubSpot lo piden así) cuenta como «crear una app»? Si cuenta, GHL y Kommo quedan fuera de la conexión directa y sólo entran por el export en CSV.
5. **Decisión B:** los leads migrados, ¿entran **quietos** o entran a secuencias y automatizaciones? Ningún módulo de nutrición ni de CRM automático filtra hoy por `origen_lead`. Si entran 10.000 contactos viejos, nada impide que reciban mensajes (no lo verifiqué a fondo).
6. **Decisión C:** ¿se migran las **conversaciones**? Sólo GHL las entrega por token. En HubSpot salen email, chat y Messenger; WhatsApp no está confirmado. Kommo y Pipedrive no las entregan.
7. **Decisión D:** ¿con qué **fecha de creación** entran? Hoy `createLead` no recibe la fecha, así que 10.000 leads migrados aparecerían como «leads de hoy» en las métricas.
8. **Lo que no sé:** qué CRM usan de verdad nuestros clientes. No hay ningún dato en el repo ni en la memoria. Antes de construir conviene hacerles una pregunta: «¿de qué CRM vienes?».

## Tabla comparativa

Dificultad: **1** = ya funciona en MaKo, **5** = no vale la pena para nuestro público. «nc» = no confirmado en la documentación oficial.

| CRM | API | Cómo se conecta | Plan mínimo con API | Qué trae (contactos · deals · etapas · notas · conversaciones) | Rate limit / paginación | 10.000 contactos (cálculo, no medido) | Dif. |
|---|---|---|---|---|---|---|---|
| **Planilla / export CSV-Excel** de cualquier CRM | n/a | Subir el archivo (**ya existe**) | n/a | Hoy: nombre, email, teléfono, empresa y pago. Etapa, etiquetas y notas: no | Tope de 3.000 filas por importación | 4 tandas; ver el riesgo de tiempo más abajo | **1** |
| **GoHighLevel** (LeadConnector) | Sí, REST v2 | **Token pegado** (Private Integration Token: Ajustes → Private Integrations, eliges permisos y copias) · OAuth de MaKo: app privada con tope de **5 agencias**; para pasar el tope hace falta revisión | Starter (la «API básica» está en Starter y Unlimited); que el token de sub-cuenta exista en Starter: nc | ✅ contactos · ✅ oportunidades · ✅ pipelines y etapas · ✅ notas y tareas · ✅ **mensajes** (SMS, WhatsApp, Email, FB, IG, GMB) | 100 cada 10 s y 200.000 por día por app y sub-cuenta (doc OAuth; para el token: nc). Mensajes: 20 por página por defecto | Contactos: ~100 llamadas, más de 10 s. Mensajes: al menos 1 llamada por conversación, 10.000 conversaciones son más de 17 min | **2** |
| **Kommo** (ex amoCRM) | Sí, REST v4 | **Token de larga duración** dentro de una «integración privada» (sólo admin, sin moderación, vence entre 1 día y 5 años) | nc (la página de planes no restringe la API; los webhooks están en Advanced o más) | ✅ contactos y empresas · ✅ leads (= deals) · ✅ pipelines y etapas · ✅ notas, tareas y eventos · ❌ **chats**: sólo con la Chats API y un canal registrado por soporte | 7 por segundo; 250 por página (aconsejan 50 al escribir); si te pasas, bloqueo por IP | ~40 llamadas, unos 6 s | **3** |
| **HubSpot** | Sí, REST v3 | **Token pegado** de una «app privada heredada» (sólo super admin, en Development → Legacy apps) · **OAuth de MaKo**: hasta 25 cuentas, después hay que publicar en el Marketplace | **Free** (las apps privadas existen en todos los planes) | ✅ contactos y empresas · ✅ deals · ✅ pipelines y etapas · ✅ notas, tareas y llamadas · ⚠️ conversaciones: email, chat y Messenger sí; WhatsApp nc | Free y Starter: 100 cada 10 s y 250.000 por día. Pro: 190 cada 10 s. Búsqueda: 5 por segundo y máximo 10.000 resultados. Listado: 100 por página | ~100 llamadas, más de 10 s. O **1 export** CSV/XLSX con la Exports API (30 por día) | **3** |
| **Pipedrive** | Sí, REST v1/v2 | **Token personal** (Preferencias personales → API) · **OAuth de MaKo con app privada**: link de instalación, **sin revisión** | **Todos** (Lite incluido) | ✅ personas y organizaciones · ✅ deals · ✅ pipelines y etapas · ✅ notas, actividades y archivos · ❌ chats del Messaging inbox (viven en la app del proveedor: nc) | Presupuesto diario de 30.000 tokens × plan × usuarios. Ráfaga con token: 20 cada 2 s en Lite. 500 por página | ~20 llamadas; segundos | **2** |
| **ActiveCampaign** | Sí, REST v3 | **URL + API key** pegadas (Settings → Developer, una por usuario) | Todos (nc). **Deals sólo desde Plus** (fuentes de terceros) | ✅ contactos y cuentas · ✅ deals (Plus+) · ✅ pipelines y etapas · ✅ notas y tareas · ❌ conversaciones: nc | **5 por segundo por cuenta**; 100 por página (para listas grandes, `id_greater`) | ~100 llamadas, unos 20 s, sin contar campos y etiquetas si van aparte | **2** |
| **Zoho CRM** | Sí, REST v8 | **Sólo OAuth**: app de MaKo en la API Console (revisión: nc) o un «Self Client» que crea el cliente (eso es crear una app) | **Free** (5.000 créditos por día) | ✅ leads, contactos y cuentas · ✅ deals · ✅ etapas · ✅ notas (**sólo un admin las puede leer**) · ❌ conversaciones | Créditos por día según la edición; de 5 a 25 llamadas simultáneas; 200 por página; más allá de 2.000 hace falta `page_token` | ~50 llamadas, o 1 job de Bulk Read (hasta 200.000; sin notas) | **4** |
| **Clientify** | Sí, REST (v1 y v2) | **API key** (Ajustes → API; hay que ser admin y **tener el addon de API**, que es pago) | **Addon pago** (precio: nc) | ✅ contactos y empresas · ✅ oportunidades · ✅ pipelines y etapas · ✅ tareas y notas · ✅ etiquetas y campos · ⚠️ Inbox (canales, conversaciones, mensajes): existe, alcance nc | nc | nc | **3** |
| **monday CRM** | Sí, **GraphQL** | **Token personal** (Developers → API token) | Todos, pero **1.000 llamadas por día** en Free, Basic y Standard (10.000 en Pro) | ✅ ítems de tableros (contactos y deals son tableros libres) · ✅ columnas y estados · ⚠️ updates nc · ❌ emails y actividades nc | 10 millones de puntos de complejidad por minuto (1 millón en free y trial); 500 ítems por página; el cursor vence a los 60 min | ~20 llamadas; ojo con el tope diario si se piden updates por ítem | **3** |
| **RD Station CRM** (Brasil) | Sí, REST v1 | **Token del usuario** (va en la URL) | nc | ✅ contactos y empresas · ✅ negociaciones · ✅ funnels y etapas · ✅ tareas, anotaciones y campos · ❌ conversaciones | **120 por minuto**; **sólo los primeros 10.000 registros por consulta** | Con más de 10.000 hay que partir por fecha | **3** |
| **Bitrix24** | Sí, REST | **URL de webhook entrante** pegada (Aplicaciones → Recursos para desarrolladores) | nc (la ayuda manda a ver los precios) | ✅ contactos, empresas y leads · ✅ deals · ✅ etapas · ✅ actividades · ❌ chats de Canales Abiertos: nc | 2 por segundo (5 en Enterprise); 50 por página; **batch de 50 comandos** | ~200 llamadas, unos 100 s; con batch, ~4 | **2** |
| **Tokko Broker** (inmobiliarias) | Sí, REST v1 | API key (sin key responde 401; dónde se saca: nc) | nc | ✅ `contact`, `webcontact`, `contact_tag` y propiedades · el resto nc | nc | nc | **3** |
| **Salesforce** (sólo para comparar) | Sí, REST + Bulk 2.0 | Sólo OAuth (app conectada en la org) | **Enterprise o más**; Professional sólo con add-on | Todo | 100.000 + 1.000 por licencia cada 24 h | Bulk API | **5** |

**Qué usa nuestro público:** no está medido. Lo que se sabe sin datos propios: GHL es el CRM típico de agencias e infoproductores (MaKo ya se compara con él en precios, `docs/costos-ia-y-planes.md`); Kommo y Clientify apuntan a la venta por WhatsApp en LatAm y en el mundo hispano; Tokko a inmobiliarias de Argentina; RD Station a Brasil. Es una estimación, no un dato.

## Lo que MaKo ya tiene para importar

**El importador de leads del CRM está completo y se reusa entero.** Hace esto:

- **Lee** CSV, XLSX, XLSM y ODS con un parser exacto (sin IA), y PDF, DOCX, TXT e imágenes con la IA barata (esas filas quedan marcadas de baja confianza). Encuentra las columnas por nombre: Nombre, Apellido(s), Email, Teléfono o WhatsApp, Empresa y una columna de pago. Prueba todas las hojas del archivo.
  - `app/crm/leads-importar.ts`: el contrato que comparten cliente y server (`filasDesdeCsv`, `recalcular`, `destinoDe`, `MAX_FILAS_IMPORT = 3000`).
  - `app/crm/importar-server.ts`: lee el archivo y arma el índice de duplicados por email, teléfono exacto y **últimos 10 dígitos** (`marcarExistentes`).
  - `app/api/crm/importar-leads/route.ts`: el POST que sólo lee; tope de 8 MB.
  - `app/crm/ImportarLeadsModal.tsx` y `app/crm/TablaRevisionLeads.tsx`: la tabla donde la persona revisa, corrige y tilda.
  - `app/crm/actions.ts` → `importarLeadsRevisadosAction(filas, funnelId)`: vuelve a validar todo **contra la base**. Cada fila tiene tres destinos: **crear**, **completar** la ficha que ya existe sin pisar nada, u **omitir**. Respeta el embudo, marca `origen_lead = 'importacion'` y puede **entrar como Ganado** con su monto usando `setPipelineStage`.
- **La regla «un canal propone, una persona confirma» ya tiene pantalla:** `/crm/revisar/[id]` (`app/crm/revisar/[id]/acciones.ts`) confirma lo que propuso un canal y delega en la misma action. Una migración por API debería entrar como propuesta por este mismo camino, no por otro.
- **Ya hay un motor de tandas que se retoma solo:** `lib/onboarding-extract.ts` hace la extracción histórica del onboarding (Meta 365 días, leads de Meta 90 días con `pollMetaLeads(90)`, Fathom, etc.). Cada tick tiene un presupuesto de tiempo y guarda su cursor; si el usuario cierra, sigue al próximo login. Es el molde para que una migración de 10.000 no dependa de una sola request.
- **Ya hay trabajo en segundo plano con `after()`:** `lib/importar-en-segundo-plano.ts`, hoy sólo para tareas del Plan.
- **Ya hay dónde guardar los tokens pegados:** `lib/credenciales.ts` → `credWs(clave)`, cifrado AES-256-GCM por workspace. La skill `add-provider-integration` documenta cómo sumar un proveedor sin que `credWs` devuelva null en silencio.
- **Ya hay destino para etiquetas y para el historial:** `crm_etiquetas` y `crm_lead_etiquetas` (mig `0224`), `lead_audit` (el historial del lead), `lead_funnel` (un lead en varios productos) y `lead_respuestas`.
- **Ingestas en vivo que no son migración:** Meta Lead Ads (`lib/meta-leads.ts`, webhook más poll de 90 días), Calendly (`lib/calendly.ts`) y Cal.com (`lib/calcom.ts`). Las tres traen leads nuevos; no importan un CRM.

**Lo que falta para migrar de verdad (con dónde vive):**

- **Faltan campos.** `FilaImport` sólo tiene nombre, email, teléfono, empresa y pago. No hay etapa, etiquetas, notas, fecha de creación, campos personalizados ni id externo (`app/crm/leads-importar.ts`).
- **Falta la fecha.** `createLead` no acepta `created_at` (`lib/leads.ts`, ~línea 818): todo entra con fecha de hoy.
- **Falta un id externo.** No hay columna para el id del CRM de origen, así que re-correr la migración depende sólo del cruce por email y teléfono. Hace falta una migración nueva.
- ⚠️ **Riesgo de tiempo, sin medir.** La action corre una fila por vez, con 3 o 4 viajes a la base por lead, y como se llama desde `/crm` hereda `maxDuration = 60` (`app/crm/page.tsx:36`). Que 3.000 filas entren en 60 s está por verse: hay que probarlo antes de prometer 10.000. Para la migración, el camino es la tanda que se retoma, no la action.
- ⚠️ **Las automatizaciones no distinguen a un lead importado.** Ninguno de `lib/nutricion*.ts` ni `lib/crm-auto*.ts` lee `origen_lead`: lo busqué con grep. No verifiqué si un lead importado en la primera etapa entra a una secuencia.

## Qué haría el botón «Migrar en lote» (versión mínima)

1. **Elegir el origen.** «¿De dónde vienes?» → GHL / Kommo / Pipedrive / HubSpot / Otro (subir el export). Un paso por pantalla.
2. **Conectar.** Se pega el token y se prueba con una lectura chica (pipelines y total de contactos). La respuesta es un número concreto («Encontré 8.412 contactos y 3 embudos»), no un «conectado».
3. **Mapear etapas.** MaKo lee los embudos y etapas de allá y **propone** a qué etapa de acá va cada una. La persona confirma, que es la regla de la casa. Ninguna clave de etapa que el embudo no tenga, que es como se perdieron los 1.057 leads fuera del embudo.
4. **Correr en segundo plano, por tandas.** Con el motor de `onboarding-extract`: cursor guardado, presupuesto de tiempo y reanudable. Por cada contacto: dedupe con el índice actual (`marcarExistentes` y `telefonoComparable`), crear o completar, etapa, etiquetas en `crm_etiquetas`, notas al historial, monto del deal con `setPipelineStage`, fecha original e id externo.
5. **Entrar quieto por defecto.** Sin secuencias ni avisos (Decisión B), con `origen_lead = 'importacion'`.
6. **Cerrar con el resumen.** Creados, completados y omitidos con su motivo (el mismo `ImportLeadsResult`). Se puede volver a correr sin duplicar.

**Fuera de la versión mínima:** conversaciones (sólo GHL las da), archivos adjuntos, campos personalizados como columnas nuevas (en la v1 pueden ir como nota del historial) y sincronización continua.

## Detalle por CRM

### GoHighLevel (LeadConnector)
- La API v1 llegó al fin de soporte el 31/12/2025, y ya no se pueden generar API keys nuevas. Lo vigente es la v2 con **OAuth 2.0 (apps del Marketplace)** o el **Private Integration Token** (para integraciones internas o de una sola sub-cuenta). La «API básica» está en Starter y Unlimited; la avanzada (OAuth y API keys de agencia), en Agency Pro. https://help.gohighlevel.com/support/solutions/articles/48001060529-highlevel-api-documentation
- El token: existe para agencias y sub-cuentas, se crea en Settings → Private Integrations (si no aparece, hay que prenderlo en Labs), se eligen los permisos y no se refresca solo. Recomiendan rotarlo cada 90 días; al rotar, el viejo convive 7 días con el nuevo. Por defecto lo crean los admins de la agencia. https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/
- Límites: 100 cada 10 s y 200.000 por día, por app y por sub-cuenta, con headers `X-RateLimit-*`. La doc habla de OAuth; para el token no lo dice. https://marketplace.gohighlevel.com/docs/other/rate-limits — el token de sandbox tiene 25 cada 10 s y 10.000 por día: https://marketplace.gohighlevel.com/docs/oauth/SandboxPIT
- Mensajes: `GET /conversations/:conversationId/messages`, 20 por defecto, paginado con `lastMessageId`. Se filtra por tipo: SMS, Email, Facebook, GMB, Instagram y WhatsApp. https://marketplace.gohighlevel.com/docs/ghl/conversations/get-messages
- Una app OAuth privada se instala en un máximo de 5 agencias. Para pasar el tope: revisión de seguridad o publicarla (plazo y costo: nc). https://marketplace.gohighlevel.com/docs/MarketplacePolicies/PrivateAppInstallLimits

### Kommo
- Integración privada: Settings → Integrations → Create integration. **No pasa moderación**; sólo hace falta ser admin. https://developers.kommo.com/docs/private-integration
- Token de larga duración: se genera en la pestaña «Keys and scopes», sin refresh_token, y dura entre 1 día y 5 años. https://developers.kommo.com/docs/long-lived-token
- Límites: 7 por segundo; 429 al pasarse y 403 con bloqueo de IP si se repite; 250 entidades por pedido (al escribir, recomiendan menos de 50); hasta 50 embudos con 100 etapas cada uno. https://developers.kommo.com/docs/limitations
- Planes: todos incluyen «Full data exports»; webhooks y WebSDK desde Advanced. https://support.kommo.com/docs/kommo-subscription-plans-overview.md
- **La trampa:** el historial de chats sólo se lee con la Chats API (`amojo`), un **canal registrado** pidiéndoselo a soporte, y para los chats de ese canal (máximo 50 por página). No da acceso al WhatsApp que el cliente ya tenía conectado. https://developers.kommo.com/reference/chat-history · https://kommo.com/developers/content/chats/register-chat-channel · https://developers.kommo.com/reference/chats-api-add-on

### HubSpot
- App privada heredada: Development → Legacy apps → Create legacy app → Private. Sólo la crea un super admin, existe en todos los planes y da un token fijo. HubSpot la llama «legacy»: sigue soportada, pero sin las funciones nuevas. https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview
- En la plataforma nueva hay apps de «static auth» para una sola cuenta, que se suben con la CLI: no es algo que haga un cliente. https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview
- Límites por plan: Free y Starter, 100 cada 10 s y 250.000 por día; Pro, 190 cada 10 s y 625.000; Enterprise, 190 y 1.000.000. Las apps OAuth públicas tienen 110 cada 10 s por cuenta. https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines.md
- Tope de instalación: las apps OAuth creadas en la plataforma 2025.2 se instalan en un máximo de 25 cuentas hasta que se publican en el Marketplace. https://developers.hubspot.com/changelog/new-marketplace-distribution-app-install-limits
- Listar contactos: 100 por pedido, con cursor `after`; batch de 100. https://developers.hubspot.com/docs/api-reference/crm-contacts-v3/guide — la búsqueda corta en 10.000 resultados: https://developers.hubspot.com/docs/api-reference/search/guide
- Export masivo: CSV, XLSX o XLS; 30 por día y de a uno; el permiso `crm.export` lo da un super admin; el link de descarga vence a los 5 minutos. https://developers.hubspot.com/docs/api-reference/crm-exports-v3/guide
- Conversaciones: `conversations.read`, hilos y mensajes del inbox. Enviar por WhatsApp no se puede; leerlo no está aclarado. https://developers.hubspot.com/docs/guides/api/conversations/inbox-and-messages

### Pipedrive
- El token está en Preferencias personales → API. Hay uno por usuario y por empresa, y sólo uno activo a la vez. https://pipedrive.readme.io/docs/how-to-find-the-api-token
- Límites: 30.000 tokens × multiplicador del plan (Lite 1, Growth 2, Premium 5, Ultimate 7) × usuarios, por día. Ráfaga por cada 2 s: con token, 20 en Lite y 120 en Ultimate; con OAuth, 80 y 480. Todos los planes tienen API. https://pipedrive.readme.io/docs/core-api-concepts-rate-limiting
- Paginación: 100 por defecto y 500 como máximo. https://pipedrive.readme.io/docs/core-api-concepts-pagination
- **La trampa:** los campos personalizados llegan como hashes de 40 caracteres, y las opciones, como ids. Hay que cruzarlos con `/personFields` y `/dealFields`. https://pipedrive.readme.io/docs/core-api-concepts-custom-fields
- Una app privada se instala por link en cualquier empresa, sin pasar por el Marketplace y sin revisión. https://pipedrive.readme.io/docs/marketplace-registering-a-private-app
- Export de la interfaz a CSV o Excel: https://support.pipedrive.com/en/article/exporting-data-from-pipedrive

### ActiveCampaign
- La key se saca en Settings → Developer; hay una por usuario. https://developers.activecampaign.com/reference/authentication
- 5 pedidos por segundo por cuenta. https://developers.activecampaign.com/reference/rate-limits
- 20 por página por defecto y 100 como máximo; para listas grandes recomiendan `orders[id]=ASC` con `id_greater`. https://developers.activecampaign.com/reference/pagination
- Que los deals estén sólo desde Plus lo dicen fuentes de terceros (por ejemplo https://flowium.com/blog/activecampaign-pricing/): **no lo confirmé en la página oficial**.

### Zoho CRM
- Créditos por día: Free 5.000; Standard 50.000 + 250 por licencia; Professional + 500; Enterprise + 1.000; Ultimate + 2.000. Llamadas simultáneas: de 5 a 25. Bulk Read inicial: 50 créditos. https://www.zoho.com/crm/developer/docs/api/v8/api-limits.html
- Tipos de cliente OAuth, entre ellos el «Self Client»: https://www.zoho.com/crm/developer/docs/api/v8/register-client.html. El access token dura 1 hora y el refresh token, hasta que lo revoquen: https://www.zoho.com/crm/developer/docs/api/v8/oauth-overview.html
- **La trampa:** hay varios data centers (.com, .eu, .in, .com.au, .jp, zohocloud.ca, .com.cn), y cada cuenta usa el dominio de API que le toca. https://www.zoho.com/crm/developer/docs/api/v8/multi-dc.html
- Paginación: 200 por página; más allá de 2.000 hace falta `page_token`; las notas las lee sólo un admin. https://www.zoho.com/crm/developer/docs/api/v8/get-records.html
- Bulk Read: hasta 200.000 por job, el archivo está disponible 1 día y no incluye Notes, Attachments ni Emails. https://www.zoho.com/crm/developer/docs/api/v8/bulk-read/limitations.html

### Clientify
- API v2: la key está en Ajustes → API; «hace falta ser administrador de la cuenta y tener el addon de API». Tiene contactos, empresas, ventas, tareas, Inbox (canales, conversaciones y mensajes), campos personalizados y webhooks. https://api-plus.clientify.com/api/docs/v2/overview/
- API v1, con `Authorization: Token`: https://developer.clientify.com/view/metadata/2s9Y5VV4wj
- El precio del addon aparece en el buscador sobre clientify.com/precios, pero la página no lo mostró al leerla: **nc**.

### monday CRM
- El token sale de Developers → API token y tiene los mismos permisos que el usuario. https://developer.monday.com/api-reference/docs/authentication
- 10 millones de puntos por minuto con token personal (1 millón en free y trial); **1.000 llamadas por día en Free, Basic y Standard**, 10.000 en Pro y 25.000 en Enterprise. https://developer.monday.com/api-reference/docs/rate-limits
- `items_page`: 500 como máximo y el cursor vence a los 60 min. https://developer.monday.com/api-reference/docs/items_page

### RD Station CRM
- API v1: «limite de **120 requisições por minuto**» y «só os **10 mil primeiros registros**» por consulta. Recursos: negociaciones, contactos, empresas, funnels, etapas, tareas, anotaciones, productos y campos personalizados. https://developers.rdstation.com/crm-v1

### Bitrix24
- Webhook entrante: Aplicaciones → Recursos para desarrolladores → Otros → Webhook entrante. La URL lleva el secreto adentro y usa los permisos de quien la crea. https://apidocs.bitrix24.com/local-integrations/local-webhooks.html
- Límites: 2 por segundo con un balde de 50 (Enterprise: 5 por segundo y 250); batch de 50 comandos; 50 por página. https://apidocs.bitrix24.com/limits.html
- Qué planes lo incluyen: la ayuda dice que lo mires en la página de precios. https://helpdesk.bitrix24.com/open/5838415/

### Tokko Broker
- Recursos publicados: `contact`, `webcontact`, `deletedcontact`, `contact_tag`, `property`, `development` y otros. https://www.tokkobroker.com/api/v1/ — el schema de `contact` pide autenticación (responde 401).

### Salesforce (comparación)
- La API viene en Enterprise, Performance, Unlimited y Developer; en Professional, sólo con add-on. https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api/intro_rest_compatible_editions.htm
- Bulk API: https://developer.salesforce.com/docs/platform/api-asynch/guide/bulk-common-limits.html

### Planillas (Google Sheets, CSV o Excel)
- Subir el CSV o XLSX **ya funciona** (lo de arriba).
- Leer un Google Sheet directo: `spreadsheets.readonly` es un permiso **sensible**, que pide verificación de Google, mientras que `drive.file` es **no sensible** y el recomendado. La app OAuth de Google de MaKo está publicada pero sin verificar. https://developers.google.com/workspace/sheets/api/scopes — cuota: 60 lecturas por minuto por usuario. https://developers.google.com/workspace/sheets/api/limits
- Lo más simple: «Archivo → Descargar → .xlsx» y subirlo.

## Lo que NO pude confirmar

- **Qué CRM usan nuestros clientes.** No hay ningún dato. La tabla mezcla doc oficial con mi estimación de uso.
- **GHL:** si el token de sub-cuenta existe en el plan Starter (la ayuda dice «API básica» en Starter, sin nombrar el token); si los límites de 100 cada 10 s y 200.000 por día valen también para el token; el tamaño máximo de página de contactos y de mensajes; plazo y costo de la revisión del Marketplace.
- **Kommo:** si hay planes sin API; si la API de eventos devuelve el texto de los mensajes de chat (supuse que no).
- **HubSpot:** si la API de conversaciones devuelve los hilos de WhatsApp; si las apps privadas heredadas se van a poder seguir creando (la doc sólo dice que «siguen soportadas»); plazo y costo de publicar en el Marketplace.
- **Pipedrive:** si las conversaciones del Messaging inbox se pueden leer por la API pública. Lo deduje de que la extensión de mensajería las sirve desde el proveedor.
- **ActiveCampaign:** en qué plan oficial están los deals (sólo lo vi en terceros) y si existe alguna API de conversaciones.
- **Zoho:** si una app OAuth «Server-based» de MaKo necesita revisión para que la usen otras organizaciones.
- **Clientify:** precio del addon de API, límites de tasa y tamaño de página.
- **monday CRM:** si los emails y actividades del CRM salen por la API pública.
- **RD Station CRM:** si existe una API v2 con OAuth (la mencionan terceros, no lo vi en la doc oficial), dónde está el token y el tamaño de página.
- **Bitrix24:** qué planes incluyen webhooks; si los chats de Canales Abiertos se pueden leer.
- **Tokko Broker:** dónde se obtiene la key, plan, límites, y si la API devuelve el historial de consultas de cada contacto.
- **MaKo:** lo leído en el código se confirmó el 08/10 (`maxDuration = 60` en `app/crm/page.tsx`, `createLead` sin fecha de creación, ninguna automatización lee `origen_lead`, tope de 3.000 filas). Lo que sigue sin medir es cuánto tarda de verdad `importarLeadsRevisadosAction` con 3.000 filas frente a los 60 s de `/crm`; si las secuencias o el CRM automático toman a un lead recién importado.
- **Los tiempos de «10.000 contactos»** de la tabla son cuentas sobre la paginación y el rate limit de la doc. No se midió nada.
