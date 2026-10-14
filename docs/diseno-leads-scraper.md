# Leads Scraper: qué fuentes se pueden usar y con qué riesgo (14/10/2026)

> Pedido de Martín, pasado por el chat «Estrategia 3 cuentas» el 14/10/2026: scrapear leads de Instagram, LinkedIn,
> Skool, Hotmart, grupos de WhatsApp «y las que encuentres que valgan», y que **se sumen solos al CRM**. Hay que basarse
> en **repos públicos** o **copiar lo que hacen otras apps**. Antes de construir, hay que ver qué fuentes son viables y
> qué riesgo tiene cada una (las cuentas y lo legal).
>
> Esto es el RELEVAMIENTO, no hay código. Las fuentes web se consultaron el 14/10/2026 (lista en §9). Lo que no se pudo
> confirmar está marcado «no medido».

## Para Martín, en cinco líneas

- **Hay dos clases de fuente, y no se tratan igual.** Las que **avisan** son tu propio público: compró en Hotmart, entró
  a tu Skool, te comentó en Instagram o se sumó a tu grupo. Ésas entran solas al CRM y no tienen riesgo. Las que **se
  buscan** son la prospección en frío: Google Maps, perfiles públicos de Instagram y otras comunidades. Ésas entran a
  una lista aparte, con un puntaje, y vos pasás al CRM los 100 mejores.
- **LinkedIn no se scrapea.** LinkedIn le ganó juicios a quienes lo hicieron: hiQ, Proxycurl (2025) y ProAPIs (10/2025).
  En marzo de 2025 bajó las páginas de Apollo y Seamless, y banea las cuentas. Lo que sí se puede: importar el CSV de
  tus conexiones y un botón «Guardar en MaKo» en la extensión, perfil por perfil.
- **Instagram se puede leer sin entrar con una cuenta.** Un juez de EE.UU. falló en 2024 que scrapear perfiles públicos
  sin login no viola los términos de Meta (Meta v. Bright Data). Sacar los seguidores de una cuenta exige entrar con
  una cuenta, y eso termina en baneo. No se hace.
- **Tener el dato no da permiso para escribir.** Un WhatsApp en frío desde la línea no oficial arriesga la línea. Por
  Instagram, la API no deja escribirle primero a nadie. Resend exige opt-in. El primer mensaje a un prospecto frío sale
  a mano, y MaKo lleva el registro.
- **Los grupos de WhatsApp sirven sólo si son tuyos.** En los grupos ajenos, WhatsApp oculta muchos números (`@lid`, 2025).
  Además, escribirle en frío a alguien que sacaste de un grupo es la forma más rápida de perder la línea.

---

## 1. Dónde se enchufa (no hay una segunda puerta)

Medido en el árbol el 14/10/2026:

| Pieza | Dónde | Para qué sirve acá |
|---|---|---|
| El alta de UN lead | `createLead` (`lib/leads.ts:863`) | Revisa duplicados (`duplicadosDeLead`, por email, teléfono y nombre), asigna al vendedor único y escribe `origen_lead` |
| El alta EN LOTE | `importarLeadsRevisadosAction` (`app/crm/actions.ts:1866`) + `FilaImport` (`app/crm/leads-importar.ts`) | Ya tiene los tres destinos de una fila (`omitir`, `crear`, `enriquecer`), el funnel destino y un tope de **3.000 filas** (`MAX_FILAS_IMPORT`). **Es la puerta de los prospectos que pasan al CRM.** |
| Un lead en varios funnels | `agregarAProducto` / `agregarLoteAProducto` (`lib/lead-funnel.ts`) | Desde la mig 0207 se AGREGA a otro funnel, nunca se mueve |
| Lo que avisa un tercero | `upsertLeadFromMeta`, `upsertLeadFromCalendly` (`lib/leads.ts`) | Molde de las fuentes que avisan. Funden por teléfono o email y lo avisan (`avisarFusion`) |
| La credencial del cliente | `credWs` / `credWsEstricta` (`lib/credenciales.ts`) | La API key de Apify, Hotmart o Google, por workspace |
| El ruteo de un webhook | `webhook_routing` + `ROUTING_CREDS` (`lib/webhook-routing.ts`) | Hotmart y Skool llegan sin sesión. El workspace sale del ruteo, y se lee ESTRICTO |
| Instagram propio | Zernio (`lib/zernio.ts`, webhook `message.received` / `comment.received`) | Ya es un canal de Automations. Un comentario o un DM ya llega |
| WhatsApp | Evolution (`lib/evolution*.ts`). El `@lid` ya se canoniza en `lib/evolution-mensajes.ts:36` | Los grupos y sus participantes |
| La extensión de Chrome | `extension/` (MaKo 0.68.0). Hoy sólo tiene permisos de `hola-mako.com` y Flow | Ahí iría el botón «Guardar en MaKo» de un perfil |
| La API de MaKo | `lib/api-mako/areas/crm.def.ts` (ya tiene `proponer_lead`, en pantalla) | Regla del 13/10: el scraper se declara ahí |

**El dato que cambia el diseño:** los 1.000+ contactos de la prospección en frío no pueden entrar directo como leads.
Con 1.000 tarjetas en «Lead entrante» no hay forma de elegir los 100 mejores, y además cada alta dispara automatizaciones
por etapa. Ver §4.

---

## 2. Las fuentes que AVISAN (tu propio público): entran solas al CRM

No es scraping: son integraciones oficiales. El riesgo es cero y es lo primero que conviene hacer.

| Fuente | Técnica | Qué trae | Credencial del cliente | Veredicto |
|---|---|---|---|---|
| **Hotmart** | Webhook oficial («Postback»): compra, reembolso, suscripción y **abandono de carrito** (sólo productor) | Nombre, email, teléfono (si lo pidió el checkout), producto y estado | Token del webhook (`hottok`, no medido el nombre exacto) + la URL de MaKo pegada en Hotmart | **Sí, primero.** El abandono de carrito es el lead más caliente que hay. Mismo molde que Stripe y Calendly. Después se suman Kiwify y Eduzz, que tienen webhook parecido (no medido) |
| **Skool (tu comunidad)** | Zapier tiene dos triggers oficiales: «Answered Membership Questions» y «New Paid Member» | Nombre, email y **las respuestas a las preguntas de ingreso**, que son el formulario de calificación | Un Zap que le pega a una URL de MaKo con secreto por workspace. «Webhooks by Zapier» es una app paga de Zapier (no medido si sigue siéndolo). Un blog dice que Skool tiene API key propia: no está confirmado en la doc de Skool | **Sí.** Las respuestas van a `optin_respuestas` (mig 0274), igual que las del opt-in de la landing |
| **Instagram (tu cuenta)** | Zernio, que ya está conectado: comentario, DM y referral | El @, el nombre y el mensaje | La que ya tiene el canal | **Sí, y casi está.** Falta que el primer contacto cree el lead (hoy dispara Automations). Es lo que hace ManyChat: comentario con palabra clave → DM → pide el email → CRM |
| **Grupo de WhatsApp tuyo** | Evolution, evento de participantes del grupo (alguien entra) | El número. Si el grupo oculta números, llega un `@lid` sin número | La línea ya conectada | **Sí, si el grupo es del cliente.** «Entró al grupo» = lead. Con un `@lid` sin número no hay lead: queda anotado |
| **LinkedIn Lead Gen Forms** | Lead Sync API (oficial) | Los datos que la persona dejó en el formulario del anuncio | OAuth de LinkedIn. **MaKo tiene que pedir el producto Lead Sync** y pasar la revisión: organización verificada, dominio y caso de uso | **Después.** Sólo sirve a quien pauta en LinkedIn, y la aprobación lleva semanas (no medido cuánto) |
| **LinkedIn (tus conexiones)** | El export oficial de LinkedIn («Obtener una copia de tus datos» → `Connections.csv`) | Nombre, empresa, cargo y, a veces, el email | Ninguna: lo baja la persona | **Sí, ya anda.** Entra por el importador de CSV que existe. Sólo falta el tutorial de cómo bajarlo |

---

## 3. Las fuentes que SE BUSCAN (prospección en frío): van a «Prospectos», no al CRM

| Fuente | Técnica (repo o app) | Qué trae | Riesgo de cuenta | Riesgo legal | Veredicto |
|---|---|---|---|---|---|
| **Google Maps** (negocios locales) | **gosom/google-maps-scraper** (Go, MIT, ~3-4 k estrellas, trae una API REST y saca emails de la web del negocio con `-email`), o el actor de Apify | Nombre, rubro, teléfono, web, dirección, reseñas, rating y email (si la web lo muestra) | Ninguno: no hay login. Puede caer un bloqueo de IP. En 03/2026 se rompió cuando Google cambió la pantalla | Medio-bajo. Los términos de Google prohíben el acceso automatizado, pero no hay cuenta que banear | **Sí, para el que vende B2B a negocios locales** (inmobiliarias, clínicas, despachos). La API oficial (Places) cuesta ~US$35 cada 1.000 con teléfono y web, y **prohíbe guardar** teléfono y web: choca con un CRM |
| **Instagram** (perfiles públicos) | Actores de Apify **sin login**: `apify/instagram-scraper` y `instagram-profile-scraper` (~US$1,5-2,3 cada 1.000). Por hashtag, por lugar o por lista de @ | Bio, web, cantidad de seguidores, categoría y el email o teléfono público de las cuentas de empresa | **Ninguno, si no se entra con una cuenta.** Con login (seguidores de un competidor, `instaloader` o `instagrapi` logueado) → baneo | Medio. Meta v. Bright Data (2024): scrapear sin login lo público no viola los términos de Meta. Hay apelación posible y no se verificó | **Sí, sin login.** Sacar los **seguidores de una cuenta, no**: exige login. El enriquecimiento oficial (Business Discovery de la Graph API, por @ de una cuenta profesional) depende del App Review de la app MaKo (no medido) |
| **Skool** (comunidades ajenas) | Actores de Apify que exportan miembros con TU sesión de Skool (cookie) | Nombre, bio, links (IG, LinkedIn, web) y ubicación. El email casi nunca | **Medio-alto:** usa tu cuenta de Skool | Medio: no se leyeron los términos de Skool (no medido) | **No para la v1.** Si se hace, uno por comunidad y con un tope |
| **Grupos de WhatsApp ajenos** | Evolution: la lista de participantes de un grupo donde está la línea | El número, o un `@lid` sin número donde el grupo oculta números (comunidades, 2025) | **Alto si después se les escribe en frío:** baneo de la línea | Alto. Nadie en ese grupo aceptó que lo prospecten | **No.** Sacarlos no banea, escribirles sí. Y lo que no se puede usar no se junta |
| **LinkedIn** (búsquedas) | PhantomBuster, Waalaxy, Unipile, `linkedin-api` (no oficial, con la cookie `li_at`) | Perfiles y cargos | **Alto:** baneo de la cuenta personal del cliente | **Alto:** §8.2 del Acuerdo de Usuario. Juicios ganados por LinkedIn (hiQ 2022, Proxycurl 07/2025, ProAPIs 10/2025). Prohíbe usar sus datos para crear leads o «enriquecer un CRM» (ver `docs/diseno-tiktok-linkedin.md`) | **No.** La alternativa es la de folkX (folk CRM): un botón en la extensión, sobre el perfil que la persona ya está mirando, de a uno. Igual técnicamente roza los términos. Riesgo bajo si es de a uno y a mano |
| **YouTube** | YouTube Data API v3 (oficial, cuota gratis): canales por palabra clave | Nombre del canal, descripción, suscriptores y links. El email NO (la API no lo da) | Ninguno | Bajo | **Después.** Sirve para prospectar creadores. Sin contacto directo hay que enriquecer |
| **TikTok** | Sólo Apify (la API de investigación es académica) | Perfil público | Ninguno sin login | Medio | **No para la v1.** |
| **Enriquecer** (completar el email) | Hunter.io (por dominio) o Apollo.io (base B2B propia). Las dos tienen API oficial | Email profesional | Ninguno | Bajo, con su propia licencia | **Opcional, BYOK.** Completa los de Google Maps que no tienen email (precios no medidos) |

### Qué hacen otras apps (lo que hay para copiar)

- **folk CRM (folkX):** botón «Add to folk» en el perfil de LinkedIn, Instagram, X o TikTok. Junta los datos visibles, y
  si ya existe dice «Open in folk». Antes de guardar se elige el grupo. Es el molde del botón de la extensión.
- **Apollo, Lusha, Kaspr:** el mismo botón sobre LinkedIn, más su propia base. Apollo y Seamless perdieron su página
  de LinkedIn en 03/2025 por esto: es la parte que NO se copia.
- **ManyChat:** comentario con palabra clave → DM → pide el email → CRM. MaKo ya tiene las piezas (Zernio + Automations).
- **Apify y PhantomBuster:** lanzás una corrida y vuelve un dataset por webhook. Es el molde de cómo se corre una
  búsqueda (§5).

---

## 4. Los 100 mejores: el diseño propuesto

Hoy no hay forma de separar los 100 mejores de 1.000 adentro del CRM. La propuesta:

1. **Una búsqueda** (fuente + parámetros: «inmobiliarias en Tijuana», «#coachdenegocios», una lista de @) se guarda
   en `prospeccion_busquedas` con su costo estimado. Como cuesta plata, se confirma en pantalla y es sólo admin.
2. **Los resultados caen en `prospectos`**, una tabla por workspace (`TENANT_TABLES`). Cada fila tiene fuente, id externo
   único por fuente, contacto, datos crudos, **puntaje y razón**, y estado (`nuevo` / `descartado` / `en_crm`).
3. **El puntaje sale del cliente ideal que MaKo ya tiene cargado** (avatar, oferta). Lo calcula la IA gratis, en lote,
   con una razón de una frase. La alternativa son reglas fijas: seguidores, reseñas, tiene web (decisión 7).
4. **«Pasar al CRM» con los N elegidos** arma `FilaImport[]` y llama a `importarLeadsRevisadosAction(filas, funnelId)`.
   Es la misma puerta del CSV, con su chequeo de duplicados. Escribe `origen_lead = 'prospeccion:<fuente>'` y deja el
   `lead_id` en el prospecto.
5. **Las fuentes que avisan (§2) NO pasan por acá:** van directo con `createLead`, más `agregarAProducto` al funnel que
   el cliente elija para esa fuente.

En la API de MaKo va un área `prospeccion`. Las lecturas son `listar_prospectos` y `busquedas_prospeccion`. Las acciones:
`buscar_prospectos` (cuesta plata: pantalla + admin), `pasar_prospectos_al_crm` (pantalla) y `descartar_prospectos`
(chat). **Sin `'http'`** en lo que devuelve datos de personas, hasta que se decida lo contrario.

---

## 5. Dónde corre el scraping

Una función de Vercel corta a los 300 s, y una búsqueda de 1.000 resultados tarda más. Hay dos caminos:

- **Apify con la key del cliente (BYOK):** MaKo lanza el actor por API con un webhook de vuelta
  (`/api/webhooks/apify`, con el workspace firmado en el payload). Al terminar, lee el dataset y lo escribe en
  `prospectos`. Se paga por resultado, sin servidor nuestro. Los actores son de terceros y se rompen o cambian de precio.
- **Repos open source en un servidor propio:** `gosom/google-maps-scraper` en Docker y `instaloader` sin login. No se
  paga por resultado, pero hay un servidor que mantener. El servidor de Evolution podría alojarlo (no medido si le
  sobra RAM). Y cuando Google o Meta cambian la pantalla, lo arreglamos nosotros.

**Recomendación:** Apify para la v1. Es lo que más rápido llega a «los 1.000 del lunes», y el costo lo paga la key de
cada cliente. Si un actor se vuelve caro, ése se pasa a su repo open source.

---

## 6. La trampa del contacto: el dato no es el permiso

| Canal | Qué pasa con un prospecto frío |
|---|---|
| WhatsApp no oficial (Evolution) | Los términos de WhatsApp prohíben la mensajería masiva automatizada. El riesgo real es el **baneo de la línea** del cliente o la de MaKo. Ya está escrito: `app/admin/dev/gtm-oferta-y-precios/bitacora.ts:164` (Messaging Policy §1(b) para la oficial) |
| Instagram por Zernio | La API sólo deja escribir dentro de las 24 h del último mensaje de la persona, o como respuesta privada a su comentario. **En frío no sale.** Es AGENTS.md («ahí SÍ manda la ventana de 24 h») |
| Email por Resend | La política de uso de Resend exige opt-in y puede cerrar la cuenta. Un mail en frío desde el dominio del negocio arriesga su envío transaccional |
| A mano (teléfono, DM desde la app, Loom) | Es lo que ya decidió la estrategia: prospección personalizada, un Loom por lead (`app/admin/dev/areas.ts:1012`). **MaKo lleva el registro**: etapa, nota y siguiente paso |

O sea: el scraper arma y ordena la lista, y el CRM registra. El primer mensaje sale a mano. Automatizar ese primer
mensaje es la decisión 8, y tiene un costo de cuenta que hay que aceptar a sabiendas.

---

## 7. Decisiones para Martín (las junta Estrategia)

1. **LinkedIn:** (a) sin scraping: CSV de conexiones + botón «Guardar en MaKo» de a uno [recomendada] · (b) scraping
   en lote con la sesión de la cuenta (PhantomBuster o Unipile): baneo y juicio.
2. **Instagram:** (a) perfiles públicos sin login + tus comentarios y DMs por Zernio [recomendada] · (b) sacar los
   seguidores de una cuenta: pide login, termina en baneo.
3. **WhatsApp:** (a) sólo grupos tuyos: el que entra es lead [recomendada] · (b) participantes de cualquier grupo donde
   esté la línea: números ocultos, y escribirles arriesga la línea.
4. **Dónde caen los 1.000:** (a) lista aparte «Prospectos» con puntaje, y pasás al CRM los que elegís [recomendada] ·
   (b) directo al CRM, en una etapa «Prospectos» ordenable por puntaje.
5. **Dónde corre:** (a) Apify con la key de cada cliente, pago por resultado [recomendada] · (b) repos open source en un
   servidor nuestro: gratis por resultado, pero hay que mantenerlo.
6. **Google Maps:** (a) scraper (gosom o Apify), que guarda teléfono y web [recomendada] · (b) la API oficial de Places:
   ~US$35 cada 1.000 y Google prohíbe guardar teléfono y web.
7. **El puntaje:** (a) MaKo puntúa contra tu cliente ideal con IA gratis, con una razón [recomendada] · (b) reglas fijas
   (seguidores, reseñas, tiene web).
8. **El primer mensaje en frío:** (a) a mano, y MaKo registra [recomendada] · (b) automático desde una línea de WhatsApp
   aparte y descartable, con tope diario.

**Orden propuesto, si se aprueba lo recomendado:**
1. Hotmart y Skool (oficiales, entran solas).
2. `prospectos` + Google Maps e Instagram por Apify + «Pasar al CRM» (los 1.000).
3. El botón de la extensión (LinkedIn e Instagram, de a uno).
4. Grupos de WhatsApp propios.
5. LinkedIn Lead Gen Forms, cuando haya quien pauta en LinkedIn.

---

## 8. Lo que no se pudo confirmar (no medido)

- El nombre exacto de los eventos de Hotmart (si el del abandono es `PURCHASE_OUT_OF_SHOPPING_CART`) y cómo se firma el
  webhook. Se mira en el historial del webhook de una cuenta real.
- Si Skool tiene API propia (lo dice un blog, no la doc de Skool), si «Webhooks by Zapier» sigue siendo pago, y los
  términos de Skool sobre exportar miembros.
- Si la Business Discovery API devuelve `website`. La doc de Meta no lo lista en el ejemplo.
- Si Meta apeló el fallo de Bright Data.
- Las excepciones de consentimiento de la nueva LFPDPPP de México (vigente desde el 21/03/2025) para datos de «fuentes
  de acceso público». Antes de vender esto a un cliente, una consulta con un abogado de datos.
- El precio vigente de cada actor de Apify (las páginas se contradicen entre US$1,5 y US$5 cada 1.000), y el de Hunter y Apollo.
- El workspace donde Martín va a prospectar: el 03/10 no tenía línea, ni agenda, ni setter/closer
  (`app/admin/dev/crm/bitacora.ts:92`). Sin eso, los 1.000 nacen sin vendedor asignado.

---

## 9. Fuentes (consultadas el 14/10/2026)

- Meta v. Bright Data: https://www.fbm.com/post/102kqw7/ · https://www.mediapost.com/publications/article/392920/judge-sides-against-meta-in-battle-over-scraping-p.html
- LinkedIn contra Proxycurl: https://www.socialmediatoday.com/news/linkedin-wins-legal-case-data-scrapers-proxycurl/756101/ · https://news.bloomberglaw.com/artificial-intelligence/linkedins-war-against-bot-scrapers-ramps-up-as-ai-gets-smarter
- Apollo y Seamless fuera de LinkedIn: https://martech.org/a-pair-of-lead-gen-providers-have-disappeared-from-linkedin/
- LinkedIn Lead Sync: https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/getting-access-leadsync?view=li-lms-2024-07 · https://docs.n8n.io/integrations/builtin/credentials/linkedin
- Instagram Business Discovery: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery
- Apify Instagram: https://apify.com/apidojo/instagram-scraper/pricing · https://scrapecreators.com/blog/apify-instagram-scraper-benchmark
- gosom/google-maps-scraper: https://gittrend.io/repo/gosom/google-maps-scraper · https://www.sourcepulse.org/projects/1419906 · https://thunderbit.com/de/blog/google-maps-scraper-github-guide
- Google Places, precio y caché: https://developers.google.com/maps/billing-and-pricing/pricing?hl=en_US · https://developers.google.cn/maps/documentation/places/web-service/policies?hl=en · https://openplacesapi.com/blog/google-places-api-pricing
- Skool en Zapier: https://zapier.com/apps/skool/integrations/zaxaa · actores de Skool: https://apify.com/scrapersdelight/skool-members-scraper/examples/export-skool-members-csv.md
- Hotmart Webhook: https://help.hotmart.com/en/article/how-to-set-up-your-api-through-webhook-postback-/360001491352 · abandono en Zapier: https://zapier.com/de/apps/activecampaign/integrations/hotmart-7006/1725788/create-or-update-activecampaign-contacts-when-new-cart-abandonment-events-occur-in-hotmart
- `@lid` en grupos de WhatsApp: https://support.whapi.cloud/help-desk/what-is-lid-in-whatsapp-groups · https://github.com/WhiskeySockets/Baileys/issues/1737
- folkX: https://help.folk.app/en/articles/5587856-capture-contacts-from-socials-with-folkx
- Resend, política de uso: https://resend.com/legal/acceptable-use
- Nueva LFPDPPP: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf · https://www.hoganlovells.com/es/publications/mexicos-new-federal-data-protection-law-what-it-means-for-companies
