# La competencia de cada función de MaKo y la landing que gana (11/11/2026)

Pedido de Martín (11/11/2026): «Fíjate si no me faltan más… investigues a la competencia de absolutamente todas las
funcionalidades que tenemos en MaKo, así podemos sacar sus ángulos de comunicación mejores». Y: «Algo que es muy hot dentro
de MaKo es AI Avatar y no encontré competencia, pero tú puedes buscarla».

**Cómo se hizo.** La lista de funciones sale del código (la barra de la app, `app/_components/nav.ts`, y las 24 landings de
`/vsl/<slug>`), no de memoria. Cada landing se leyó con un Chromium real, en orden de arriba a abajo. Lo que no se pudo abrir
salió de búsquedas web y va marcado **(búsqueda)**: es lo que dijo el buscador, no lo que se vio en la página. Las cifras de
cada competidor son las que **su** página afirma; no las verificamos.

**Prioridad al elegir.** Primero startups con landing que venden por anuncios, VSL y high ticket, en español y de LATAM;
después white-labels de GoHighLevel, setters con IA y fábricas de creativos; los SaaS grandes, sólo de contraste.

## Resumen: la ganadora de cada función

| Función de MaKo | Ganadora (la estructura que se copia) | ¿Se abrió? | Landing de MaKo |
|---|---|---|---|
| **AI Avatar** | HeyGen, su página en español de anuncios UGC (`heygen.com/es-mx/business/marketing/ugc-video-ads`) | Sí | `/vsl/ai-avatar` (nueva) |
| Chats (WhatsApp + Instagram) | respond.io (`respond.io/es`) | Sí | pendiente |
| CRM | GoHighLevel (`gohighlevel.com`) | Sí | pendiente |
| Automations / setter con IA | SetSmart (`setsmart.io/es`) | ver abajo | pendiente |
| Agenda | iClosed (`iclosed.io`) | ver abajo | pendiente |
| Closing Analyst | Voicit (`voicit.com`) | ver abajo | pendiente |
| Cobranza | Rebill (`rebill.com`) | ver abajo | pendiente |
| Marketing CoPilot / Media Buyer | Master Ads (`masterads.ai`) | Sí | pendiente |
| Ads Analyst | Gethookd (`gethookd.ai`) | ver abajo | pendiente |
| Competitor Spy | Foreplay (`foreplay.co`) | ver abajo | pendiente |
| Dashboard y reportes | Reportei (`reportei.com/es`) | Sí | pendiente |
| Video (editor) | Cherry Studio (`cherrysweet.app`) | Sí | pendiente |
| Image (carruseles y creativos) | PostNitro (`postnitro.ai`) | ver abajo | pendiente |
| Copywriting | The Copy Machine (`theoperatorstack.io/copy-machine`) | Sí | pendiente |
| Web Generator | HighLevel AI Studio (`gohighlevel.com/ai-studio`) | Sí | pendiente |
| Ops Center / Second Brain (MaKo, tu consultor) | Holo (`tryholo.ai`) | Sí | pendiente |
| Plan (prioridades) | Motion (`usemotion.com`) | ver abajo | pendiente |
| Offer | Atlas AI de DFY (`go.doneforyou.com/offer-formula`) | ver abajo | pendiente |
| Funnels / embudo | Hyros (`hyros.com`) | ver abajo | pendiente |
| Email marketing | beehiiv (`beehiiv.com`) | ver abajo | pendiente |
| Classroom (curso y comunidad) | Skool (`skool.com`) | ver abajo | pendiente |

Newsletter, VSL Generator, Sales Email, Closing Script y Sales Roleplay **no se investigaron**: en el código están como
«Coming soon» (`PRONTO`, sólo para el super admin), así que hoy no son funciones que se vendan.

---

## Las 9 páginas que encontró Martín: qué función de MaKo compite

| Página | Qué es | Compite con | ¿Se abrió? |
|---|---|---|---|
| [saleads.ai](https://saleads.ai/es) | Campañas completas con IA para Meta, Google y TikTok | Marketing CoPilot / Media Buyer | Sí, pero casi sólo se lee el bloque de precios: «Cómo funciona» y «Resultados» se animan sin texto |
| [usefastlane.ai](https://www.usefastlane.ai/) | Agente que estudia tu marca y tu competencia, crea anuncios, los lanza y mide | MaKo entero en su lado de creativos (Create, Spy, Ads Analyst, Media Buyer). **No arma landings** | Sí |
| [motionads.impultienda.ar](https://motionads.impultienda.ar/) | Anuncios en video (por lo que se ve desde afuera) | Create / Video | **No**: la tapa una verificación de Cloudflare. No se evade (regla de la casa): se mira desde el Chrome de Martín |
| [The Copy Machine](https://theoperatorstack.io/copy-machine) | 7 skills que instalas en tu Claude o ChatGPT para escribir copy | Copywriting | Sí |
| [cherrysweet.app](https://cherrysweet.app/) | Cherry Studio: estudio de contenido en español para reels | Video (no Image, como se pensaba) | Sí |
| [reportei.com](https://reportei.com/es/) | Informes y dashboards de marketing con IA | Dashboard y reportes | Sí |
| [tryholo.ai](https://tryholo.ai/) | «Tu departamento de marketing, una sola contratación» | Ops Center (MaKo que propone y tú apruebas) y MaKo entero, en su lado de marketing | Sí |
| [masterads.ai](https://masterads.ai/) | Chat con tu data de Meta, Google y tu tienda, con agente por WhatsApp | Marketing CoPilot y Dashboard | Sí |
| [respond.io](https://respond.io/es) | Bandeja de WhatsApp, Instagram, TikTok y Facebook con agentes de IA | Chats y Automations | Sí |

---

## AI Avatar

MaKo hoy (`lib/funciones-mako.ts`, `lib/ai-avatar/`): subes una foto tuya, eliges una escena (28 escenas en 6 estilos) o una
de las 10 plantillas de venta con su guion, y MaKo genera tu avatar en esa escena y lo anima diciendo tu guion. Genera con tu
cuenta de Google Flow por la extensión de MaKo. Todavía no: tu voz clonada, copiar el movimiento de otro video ni un
personaje sin foto.

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas que muestra | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **HeyGen (anuncios UGC, en español)** | [heygen.com/es-mx/…/ugc-video-ads](https://www.heygen.com/es-mx/business/marketing/ugc-video-ads) | «Anuncios de video estilo UGC que generan conversiones sin contratar creadores» | Escribes el guion, eliges un avatar presentador y un escenario, generas en minutos | Contadores de uso (180 millones de videos), «Más de 1,000 reseñas», 4.8, testimonios de Miro, Workday y Vision Creative Labs | «No necesitas tarjeta de crédito»; precio en otra página | Sí |
| HeyGen (portada) | [heygen.com](https://www.heygen.com/) | «AI videos starring you, made in minutes» / «Be your best self, every time» | Tu «Personal Avatar» con tu cara y tu voz, sin filmar cada video | G2 #1, Forbes AI 50, «85% de las Fortune 100» | Gratis para empezar | Sí |
| Arcads | [arcads.ai/es](https://www.arcads.ai/es) | «Genera winning ads con Arcads 3.0» | +1.000 actores de IA o tu propio avatar; eliges modelo, editas y partes de formatos probados | Muro de anuncios con vistas e ingresos, «+6.000 teams», testimonios de fundadores | «Prueba gratis de 3 días» | Sí |
| Creatify | [creatify.ai/es](https://creatify.ai/es) | «Anuncios de IA que ganan» | Un agente que investiga, crea y analiza; su modelo Aurora convierte una foto y un audio en una persona hablando | Casos con cifras (ROAS +73%, costo por lead −28%), «15M+ anuncios creados» | Prueba gratis | Sí |
| Novoads | [novoads.ai/es](https://novoads.ai/es) | Actores de IA con acento latino para anuncios (búsqueda) | Filtras actores por edad, género y acento (búsqueda) | — | Prueba de 3 días por US$1, después desde US$49/mes (búsqueda) | ver abajo |
| Higgsfield | [higgsfield.ai](https://higgsfield.ai/) | Suite creativa con IA | Presets, Soul ID (tu personaje entrenado con fotos), estudio de influencers de IA | Concurso de US$1.000.000, comunidad | — | Sí (la portada es un catálogo, no una landing) |
| MakeUGC, Captions, Argil, Hedra, Synthesia | — | MakeUGC: actores UGC baratos (búsqueda). Captions: editor para creadores. Argil: estudio de video para equipos y agentes. Hedra: infraestructura de modelos (ya no vende avatares). Synthesia: videos de formación para empresas | — | — | — | Argil, Hedra y Synthesia sí; MakeUGC y Captions no abrieron |

**Ganadora: la página de HeyGen en español para anuncios UGC.** Es la única que habla en español y de LATAM (es-mx) del uso
exacto de MaKo —anuncios para Meta, TikTok e Instagram— y su estructura pone el problema antes que la herramienta. Arcads y
Novoads venden **actores** (la cara de otro); MaKo vende **tu** cara, que es justo la promesa de la portada de HeyGen
(«videos protagonizados por ti»). Novoads es la startup LATAM a mirar cuando se pueda abrir.

**Orden de secciones de la ganadora:**
1. Hero: etiqueta «Anuncios en video con contenido generado por usuarios», titular, bajada, dos renglones («No necesitas
   tarjeta de crédito» · «Actualiza el contenido al instante…») y el botón «Empieza a crear gratis».
2. Contadores de uso (videos generados, avatares, traducidos).
3. «El reto del marketing»: **Sin HeyGen** (el problema de producir UGC con creadores) y **Con HeyGen** (la solución).
4. «Todo lo que los equipos de marketing necesitan para crear a gran escala»: 6 beneficios.
5. «De la idea al video publicado en 3 pasos»: escribe tu gancho, elige tu estilo de creador (y el escenario), genera e implementa.
6. «Diseñado para todas tus necesidades de marketing»: 6 casos de uso (reseña de producto, respuesta directa, testimonios,
   demostración, comparación, de temporada).
7. Prueba social: reseñas, métricas y tres testimonios.
8. «¿Tienes preguntas? Tenemos respuestas»: preguntas frecuentes.

**Arco:** los anuncios UGC son los que venden, pero producirlos con creadores es lento y caro → con avatares escribes,
eliges y generas → todo lo que puedes probar → cómo se hace en 3 pasos → para qué sirve → quién lo usa → dudas.
**Ángulo que mejor comunica:** «anuncios que venden, sin contratar creadores». Para MaKo: **sin grabarte cada vez**.

---

## Chats (WhatsApp, Instagram y Messenger en una bandeja)

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **respond.io** | [respond.io/es](https://respond.io/es) | «Los clientes preguntan por chat. Llama para más detalles. Confirma por correo electrónico. ¿Puedes seguir el ritmo?» | Un buzón de equipo con chats, llamadas y correos en un hilo, agentes de IA y CRM propio | «Más de 10k marcas», 4.8 en G2, Serie B de US$62,5M, «60% ciclo de ventas más rápido», «81% conversión», «42.5x ROI» | Prueba gratis; precio en otra página | Sí |
| Leadsales | [leadsales.io](https://leadsales.io/) | CRM para vender por WhatsApp, Instagram y Facebook (búsqueda) | Chats asignados a vendedores, leads por etapa (búsqueda) | Un caso de «100% de ventas por WhatsApp» (búsqueda) | Desde US$97/mes (búsqueda) | ver abajo |
| Kommo | [kommo.com](https://www.kommo.com/) | «AI-powered WhatsApp CRM» (búsqueda) | Cada conversación es una tarjeta del embudo; Salesbot sin código (búsqueda) | — | — | ver abajo |
| Darwin AI | [getdarwin.ai](https://www.getdarwin.ai/) | Agentes de IA para WhatsApp, Instagram y voz (búsqueda) | — | Caso Promotora Baqueira (búsqueda) | Sin precio público (búsqueda) | No |
| Callbell, Wati, SleekFlow, Treble, Cliengo | — | Bandejas de WhatsApp (búsqueda) | — | — | — | No |

**Ganadora: respond.io.** Es la referencia de «que la conversación no se rompa aunque el cliente cambie de canal», que es lo
que vive quien compra anuncios de WhatsApp. Está hecha para B2C global, no para LATAM: Leadsales es la de LATAM a mirar.

**Orden de secciones:** (1) barra con la Serie B · (2) hero con la pregunta «¿Puedes seguir el ritmo?» · (3) tour interactivo
«Explora el poder de Respond.io» · (4) «Más de 10k marcas confían…» · (5) «Haz crecer tu negocio con cada conversación»
(Captura / Convierte / Retén) · (6) «Chats, llamadas y correos electrónicos en un solo hilo» · (7) «IA construida sobre una
base de confianza» (la carta del CEO) · (8) beneficios del agente de IA · (9) «Resultados de negocios como el tuyo» ·
(10) casos de éxito · (11) testimonios · (12) G2 · (13) «Así te prepara respond.io para el éxito» · (14) cierre «Triplica
los resultados de tu negocio» y comparativas contra Manychat y Wati.
**Arco:** el cliente salta de canal y se rompe la conversación → un solo buzón con IA lo une → la prueba son cifras.
**Ángulo:** «tus leads no se pierden aunque cambien de canal».

## CRM

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **GoHighLevel** | [gohighlevel.com](https://www.gohighlevel.com/) | «The AI-powered business operating system behind agencies, founders and the businesses they grow» | Todo en uno, revendible con tu marca: captura, nutre, cierra, «evangeliza» y reactiva | Contadores de leads, citas y ventas; testimonios de agencias; comunidad | 14 días gratis; Starter US$97, Unlimited US$297, Founder US$497 al mes | Sí |
| Leadsales | [leadsales.io](https://leadsales.io/) | CRM de chats para LATAM (búsqueda) | — | — | Desde US$97/mes (búsqueda) | ver abajo |
| Kommo | [kommo.com](https://www.kommo.com/) | CRM de WhatsApp (búsqueda) | — | — | — | ver abajo |
| Clientify | clientify.com | CRM español fuerte en WhatsApp (búsqueda) | — | — | — | No |
| Clint | [clint.digital/es](https://clint.digital/es) | CRM brasileño para lanzamientos y high ticket (búsqueda) | WhatsApp, Instagram, pagos, calendario (búsqueda) | — | — | No |
| HubSpot / Pipedrive | — | Contraste | — | — | — | No |

**Ganadora: GoHighLevel.** Es la que ya conoce quien vende high ticket con anuncios y la que MaKo reemplaza.
**Orden de secciones:** (1) cabecera con «Start 14-day trial» · (2) «Power up your business with AI» y la promesa ·
(3) contadores (llamadas de voz con IA, leads, citas, ventas) · (4) «We're in the business of helping you grow your business»
· (5) «Your all-in-one solution for business growth» con cinco pestañas: Capture, Nurture, Close, Evangelize, Reactivate ·
(6) tres principios: all-in-one, la IA como base, la comunidad · (7) «Join the movement» · (8) «What's included with
HighLevel» · (9) precios · (10) testimonios, comparativas y cierre con la prueba de 14 días.
**Arco:** una sola plataforma → el ciclo entero del cliente → comunidad y precio escalonado.
**Ángulo:** «el sistema operativo de tu negocio: una cosa en vez de diez».

## Automations / setter con IA

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **SetSmart** | [setsmart.io/es](https://setsmart.io/es) | «+34% más llamadas cualificadas con IA para tu negocio de coaching online» (búsqueda) | Setter de IA en los DMs de Instagram, WhatsApp y Messenger: califica y agenda; dos seguimientos a las 4 h y a las 23 h (búsqueda) | — | Light US$25, Pro US$97, Scale US$297, Enterprise US$797 al mes (búsqueda) | ver abajo |
| ManyChat | [manychat.com](https://www.manychat.com/) | Automatizaciones de Instagram y WhatsApp | — | — | — | **No**: verificación de Cloudflare |
| GoHighLevel (Conversation AI) | [gohighlevel.com](https://www.gohighlevel.com/) | El chat y la voz con IA de su plataforma | — | — | Incluido en sus planes | Sólo como mención |
| Darwin AI, Dapta | getdarwin.ai, dapta.ai/es | Agentes de venta con IA para WhatsApp en LATAM (búsqueda) | — | — | — | No |

**Ganadora: SetSmart.** Hace lo mismo que el setter de MaKo, para coaches e infoproductores, en español.
**Ángulo (búsqueda):** «más llamadas calificadas por mucho menos que un setter humano».

## Agenda

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **iClosed** | [iclosed.io](https://www.iclosed.io/) | «The Sales Engine Behind The Fastest-Growing Teams» (búsqueda) | Agenda conectada al CRM, Stripe y Hyros (búsqueda) | — | A medida (búsqueda) | ver abajo |
| Calendly / Cal.com / Chili Piper / OnceHub | — | Agendas generales (búsqueda) | Recordatorios, ruteo | — | Calendly desde US$10 por usuario (búsqueda) | No |

**Ganadora: iClosed.** Es la única hecha para el flujo high ticket: agenda, CRM, pagos y de qué anuncio vino.

## Closing Analyst

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Voicit** | [voicit.com](https://voicit.com/) | Grabar llamadas comerciales con IA y cerrar más (búsqueda) | Transcribe en español, detecta objeciones y próximos pasos, lo pasa al CRM (búsqueda) | — | — | ver abajo |
| Fathom | fathom.ai | Notas de reuniones (búsqueda) | — | — | Gratis; Premium (búsqueda) | No |
| Hyperbound | hyperbound.ai | Roleplay con compradores de IA (búsqueda) | — | — | — | No |
| Practify IA | — | Roleplay y análisis de llamadas en español de España (búsqueda) | — | — | — | No |
| Gong | — | Contraste (EE.UU., enterprise) | — | — | — | No |

**Ganadora: Voicit**, por el ángulo en español y las objeciones.

## Cobranza

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Rebill** | [rebill.com](https://www.rebill.com/) | Cobros recurrentes y suscripciones en LATAM (búsqueda) | Links de pago, cuotas, 15 monedas, conciliación (búsqueda) | Ronda liderada por Tiger Global (búsqueda) | — | ver abajo |
| Mercado Pago (link de pago) | mercadopago.com.mx | Meses sin intereses (búsqueda) | — | — | Comisión por venta (búsqueda) | No |
| PorCobrar, Cliengo | — | Recordatorios de cobro por WhatsApp (búsqueda) | — | — | — | No |

**Ganadora: Rebill**, por «no pierdas cuotas por rechazos». Apunta a empresas medianas: no hay nada hecho para cuotas de
mentorías o infoproductos.

## Marketing CoPilot / Media Buyer con IA

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Master Ads** | [masterads.ai](https://masterads.ai/) | «Marketing digital simple.» / «"Master, que las campañas de la empresa mejoren"» | Un chat conectado a Meta, Google y tu tienda; reportes, alertas, agente por WhatsApp; la IA propone y tú apruebas | Casi ninguna: un dashboard y un chat «de ejemplo» | 3 días gratis sin tarjeta; US$29/mes por 5 fuentes | Sí |
| SaleADS | [saleads.ai/es](https://saleads.ai/es) | «A 52 segundos de... más ventas» | Campañas completas sin tocar el Administrador de Anuncios | «18x retorno», «50K+ anuncios», «6K+ negocios» | Pro US$69, Business US$129 al mes; un pago único «vitalicio» por tiempo limitado | Sí (casi sólo precios) |
| Fastlane | [usefastlane.ai](https://www.usefastlane.ai/) | «Your next winning ad on autopilot» | Aprende tu marca → investiga → crea → lanza → lee resultados, en ciclo | «70,000+ businesses», un caso de 36 millones de vistas, tuits, prensa | Desde US$29/mes, 7 días gratis | Sí |
| Holo | [tryholo.ai](https://tryholo.ai/) | «Your Marketing Department. One Hire.» | Autopilot con aprobación | «4.6/5 from 4,268 customers», «3.2× average ROAS» | No visible | Sí |
| Madgicx, AdAmigo.ai | madgicx.com | Media buyer con IA para Meta que audita y recomienda (búsqueda) | — | — | Madgicx desde ~US$45/mes (búsqueda) | No |

**Ganadora: Master Ads.** Es la única en español y lo dice con una frase que entiende cualquier dueño («Master, que las
campañas mejoren»), con WhatsApp como pantalla. Su página es corta y con poca prueba.
**Orden de secciones:** (1) hero «Marketing digital simple.» con la frase de ejemplo · (2) «¿Con qué arrancamos?» con cuatro
accesos rápidos y «Probar gratis» · (3) «Inteligencia artificial, atención humana.» · (4) «"Master, lo de siempre": 5 piezas
claves…» · (5) «"Te pido un cafecito y un reporte por favor"»: reportes en segundos · (6) «Agente desde WhatsApp: pregúntale
a tu negocio como le preguntarías a un especialista» · (7) «Se conecta con» · (8) «Pensado para el día a día de las pymes» ·
(9) cierre con el precio.
**Ángulo:** hablarle a tu data como a un especialista, sin jerga.

## Ads Analyst

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Gethookd** | [gethookd.ai](https://www.gethookd.ai/) | Investigación de anuncios y creativos con IA (búsqueda) | Transcribe anuncios para sacar ganchos y llamados, y escribe guiones (búsqueda) | Biblioteca de decenas de millones de anuncios (búsqueda) | Desde US$19/mes, 7 días gratis (búsqueda) | ver abajo |
| Atria | tryatria.com | Califica tus anuncios y dice cómo mejorarlos (búsqueda) | — | Caso VaynerCommerce (búsqueda) | ~US$159/mes (búsqueda) | No |
| Motion | motionapp.com | Analítica creativa (búsqueda) | — | «2,100 teams» (búsqueda) | ~US$250/mes (búsqueda) | No |
| Fastlane | [usefastlane.ai](https://www.usefastlane.ai/) | Su bloque «Reads the results. Doubles down.» | Métricas por anuncio y variaciones del ganador | — | — | Sí |

**Ganadora: Gethookd**: transcribe el anuncio y escribe guiones nuevos, como el Ads Analyst de MaKo.

## Competitor Spy

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Foreplay** | [foreplay.co](https://www.foreplay.co/) | Guardas anuncios con un botón y los ordenas (búsqueda) | Extensión, biblioteca, briefs y seguimiento de competidores (búsqueda) | Biblioteca de millones de anuncios (búsqueda) | Desde US$175/mes (búsqueda) | ver abajo |
| Gethookd | gethookd.ai | «Brand Spy» (búsqueda) | — | — | US$19/mes (búsqueda) | ver abajo |
| Minea | minea.com/es | Anuncios con datos por producto (búsqueda) | — | — | ~US$49/mes (búsqueda) | No |
| Atria, BigSpy, AdSpy | — | Bibliotecas de anuncios (búsqueda) | — | — | — | No |

**Ganadora: Foreplay**, la que más se parece a «guardas con un botón y te ordena la inspiración». En español no apareció
ninguna herramienta propia, sólo guías.

## Dashboard y reportes

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Reportei** | [reportei.com/es](https://reportei.com/es/) | «Crea Informes y Dashboards de Marketing Digital en 3 segundos» | +50 integraciones, informes, dashboards en tiempo real, IA, envío por correo y WhatsApp | «+10.000 clientes en 70 países», líder de GetApp, testimonios de agencias | «Probar gratis por 3 días»; precio en otra página | Sí |
| Master Ads | [masterads.ai](https://masterads.ai/) | Reportes en segundos y agente por WhatsApp | — | — | US$29/mes | Sí |
| Hyros | [hyros.com](https://www.hyros.com/) | Atribución high ticket con llamadas (búsqueda) | — | — | Con ventas (búsqueda) | ver abajo |
| AgencyAnalytics, Whatagraph, DashThis, Triple Whale | — | Reportes para agencias o ecommerce (búsqueda) | — | — | — | No |

**Ganadora: Reportei**: en español, una promesa concreta («3 segundos») y la automatización por WhatsApp.
**Orden de secciones:** (1) menú con «Probar gratis» · (2) hero «Crea Informes y Dashboards… en 3 segundos» · (3) logos de
integraciones y «Más de 10.000 empresas… usan Reportei» · (4) «¡Deja de perder tiempo con informes y dashboards hechos a mano
y gana productividad!»: 9 piezas · (5) «Los indicadores de todos tus canales en una sola pantalla» · (6) «Conoce la
herramienta» en pestañas · (7) Flux (publicaciones) · (8) Reportei Sync (Google Sheets) · (9) «Mira los resultados de
nuestros clientes» · (10) texto largo de SEO · (11) pie.
**Ángulo:** «todos tus canales en un informe, en 3 segundos, y se manda solo».

## Video (editor)

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Cherry Studio** | [cherrysweet.app](https://cherrysweet.app/) | «Cherry Studio, very sweet: tu contenido, de la idea a los resultados» | Subes el clip como salió del celular: corta pausas, subtítulos al ritmo, zoom con sonido; también guion, publicación y comentarios | Un simulador para probar sin cuenta y un antes/después del audio. Sin testimonios | Gratis una vez, sin tarjeta; Basic, Creator, Studio (los precios se leen pegados: confirmar) | Sí |
| Submagic | submagic.co | «Edit shorts 10x faster with AI» (búsqueda) | Subtítulos, silencios, B-roll y zoom (búsqueda) | — | — | No |
| Captions | captions.ai | Editor con IA para creadores (búsqueda) | — | — | Pro US$9,99, Max US$24,99 (búsqueda) | ver abajo |
| OpusClip, Vizard, Descript, Kapwing | — | Clips y edición por texto (búsqueda) | — | — | — | No |

**Ganadora: Cherry Studio.** En español, habla como el creador LATAM («subes el video como salió del celular»), deja probar
sin registrarse y cierra con un plan gratis.
**Orden de secciones:** (1) barra con «Empezar gratis» · (2) hero con cuatro chips: «Corta las pausas», «Subtítulos al
ritmo», «Publica sola», «Te dice qué grabar» · (3) «Lo que Cherry hace por ti» · (4) «Mira a Cherry en acción» · (5) «Haz tu
primer reel aquí mismo» (simulador) · (6) «Arrastra y mira lo que le quita a tu video» (antes/después) · (7) «Y todo lo que
rodea al video también lo tiene» · (8) «Tu semana de contenido se publica sola» · (9) «Conecta tu Instagram…» · (10) «Tres
pasos y tienes tu primer reel» · (11) «Cherry Studio trabaja con» · (12) precios · (13) «Lo que más nos preguntan» ·
(14) cierre «Tu próximo reel puede estar listo hoy».
**Ángulo:** «súbelo como salió del celular y míralo volver editado».

## Image (carruseles y creativos)

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **PostNitro** | [postnitro.ai](https://postnitro.ai/) | Carruseles chateando con «Nitro, tu asistente de diseño» (búsqueda) | Tema, link o texto a carrusel, y lo publica (búsqueda) | «82.000+ creadores» (búsqueda) | Gratis; pago desde US$15/mes (búsqueda) | ver abajo |
| Contentdrips | contentdrips.com | Tu marca en cada carrusel (búsqueda) | — | — | — | No |
| AdCreative.ai | adcreative.ai | Creativos con puntaje de conversión (búsqueda) | — | — | US$29 a US$109/mes (búsqueda) | No |
| Predis.ai | predis.ai | Anuncios y carruseles en español (búsqueda) | — | — | — | No |
| Fastlane | [usefastlane.ai](https://www.usefastlane.ai/) | «Create infinite content, based on winning formats» | Formatos probados (pizarra, meme, remix de la competencia) | Ver arriba | «First 5 statics free» | Sí |
| Canva | — | Contraste | — | — | — | No |

**Ganadora: PostNitro**: un chat que diseña carruseles, como la Image de MaKo, y con página en español.

## Copywriting

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **The Copy Machine** | [theoperatorstack.io/copy-machine](https://theoperatorstack.io/copy-machine) | «100 years of copywriting, installed into your AI.» | 7 skills en tu Claude o ChatGPT: te entrevista una vez, escribe y un revisor («The Chief») pasa 25 chequeos antes de mostrarte el borrador; no inventa números | 3 páginas reescritas lado a lado, 11 testimonios, «1,400+ compradores», «refund rate is 0.85%» | Pago único, US$47 por Black Friday (después hasta US$67); garantía de 14 días | Sí |
| Jasper, Copy.ai | jasper.ai, copy.ai | Agentes de marketing con tu voz de marca (búsqueda) | — | — | Jasper US$49-59 por asiento (búsqueda) | No |
| VSL.AI, Leadde | — | Guiones de VSL (búsqueda) | — | — | — | No |

**Ganadora: The Copy Machine.** Está en la lista de Martín y su argumento es el de MaKo: tu IA escribe como la de todos
porque no te conoce.
**Orden de secciones:** (1) banner de Black Friday · (2) hero con el precio y la garantía al lado del botón · (3) «WHAT'S
INSIDE, AT A GLANCE» · (4) «See what the Copy Machine does to a real page» (3 reescrituras, antes y después) · (5) «What
buyers wrote back» (11 reseñas) · (6) «Put the Copy Machine to work» por tipo de negocio · (7) «Copy only you can run» (el
argumento del «papel tapiz») · (8) «Who built it» (el fundador) · (9) «What you get» (las 7 skills) · (10) «Your first
hour» · (11) «Who it's for» y «Who it isn't for» · (12) «The math» · (13) «The offer» · (14) el agregado del embudo ·
(15) preguntas · (16) cierre.
**Ángulo:** «si un competidor puede pegar tu titular en su web, no tienes copy: tienes papel tapiz».

## Web Generator

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **HighLevel AI Studio** | [gohighlevel.com/ai-studio](https://www.gohighlevel.com/ai-studio) | «Your website is one sentence away» | Describes el sitio; lo diseña, lo escribe y lo conecta al CRM, la agenda y las automatizaciones | «700K+ sitios y funnels», «175K+ publicados», «85K+ negocios», posts de usuarios | 14 días gratis | Sí |
| Gamma, Durable, Framer, Lovable, Landingi | — | Sitios y landings con IA (búsqueda) | — | — | — | No |
| Hostinger (clonador) | hostinger.com | Recrea un sitio desde su link (búsqueda) | — | — | — | No |

**Ganadora: HighLevel AI Studio**: sitio, CRM, agenda y automatización juntos, como MaKo.
**Orden de secciones:** (1) barra con «Start your 14-day trial» · (2) hero «Your website is one sentence away» con ejemplos
por rubro y un sitio «Ready to publish · 5.7s» · (3) «They typed a sentence. Here's what came out» · (4) «Trusted by
businesses using AI to grow» (cifras) · (5) «What is AI Studio?»: lo describes y lo arma, más que landings, conectado el día
que sale · (6) muestras (landing, encuesta, formulario, reserva, tienda) · (7) «Why businesses use it» · (8) «Who is AI Studio
for?» con la cadena «After they hit submit» (contacto en el CRM, cita, confirmación, recordatorios).
**Ángulo:** «describes tu negocio en una frase y sale publicado, ya conectado».

## Ops Center / Second Brain (MaKo, tu consultor con IA)

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Holo** | [tryholo.ai](https://tryholo.ai/) | «Your Marketing Department. One Hire.» / «You just tap approve.» | Pegas tu web; planea, escribe y publica anuncios, redes, emails y SEO; propone solo («Scale campaign budget by 30%») y nada sale sin tu OK | «4.6/5 from 4,268 customers», «87% lower cost than an agency retainer», 13 testimonios, G2, inversores | No visible; «founding-member price» | Sí |
| Olympia | olympia.chat | Consultores de negocio con IA (búsqueda) | — | — | — | No |
| El CEO Automático | gumroad | Curso de prompts para usar la IA como CEO (búsqueda) | — | — | €134 (búsqueda) | No |

**Ganadora: Holo.** No encontramos un «consultor de negocio con IA» en español con datos medidos: el espacio está vacío. El
ángulo de Holo («propone solo, tú solo apruebas») es el del chat que delega.
**Orden de secciones:** (1) hero con «4.6/5 from 4,268 customers» · (2) confianza y números por canal · (3) «Ads that sell.
Socials that grow…» · (4) «How it works?» (5 pasos) y lo que ahorras · (5) «Proactive. No prompt needed.» · (6) «Real
customer results» · (7) para quién · (8) «Inside your new marketing department» (las piezas) · (9) «Early signals, first
tweaks» (semana a semana) · (10) testimonios · (11) premios y privacidad · (12) inversores · (13) «Skeptical? Good. Read
this.» (preguntas) · (14) cierre «Approve your first week of marketing content today».
**Ángulo:** «un departamento entero en una sola contratación; tú solo apruebas».

## Plan (prioridades)

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Motion** | [usemotion.com](https://www.usemotion.com/) | La IA ordena tus tareas por prioridad, fecha y capacidad (búsqueda) | Reordena sola cuando algo cambia (búsqueda) | — | Desde US$19 por usuario (búsqueda) | ver abajo |
| Reclaim, ClickUp Brain, Linear | — | Agenda automática o tareas con IA (búsqueda) | — | — | — | No |

**Ganadora: Motion**: «la IA decide el orden por ti». Nada en español saca tareas de tus reuniones grabadas.

## Offer

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Atlas AI (DFY)** | [go.doneforyou.com/offer-formula](https://go.doneforyou.com/offer-formula) | Asistente para armar tu oferta (búsqueda) | Entrenamiento de 5 pasos (búsqueda) | — | — | ver abajo |
| $100K Offer Generator, GPTs de «Grand Slam Offer», kits de prompts | — | Ofertas en minutos (búsqueda) | Prompts o GPTs | — | US$97 o menos (búsqueda) | No |

**Ganadora: Atlas AI**, lo más parecido a un producto. Todo lo demás son prompts: no hay en español una app que diagnostique
y arme la oferta en un PDF.

## Funnels / embudo

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Hyros** | [hyros.com](https://www.hyros.com/) | Atribución de la llamada hasta el cierre, «true ROAS» (búsqueda) | Conecta la venta cerrada con el anuncio de origen (búsqueda) | Casos con llamadas (búsqueda) | Por ingreso rastreado (búsqueda) | ver abajo |
| ClickFunnels | clickfunnels.com | «Marketing Funnels Made Easy» (búsqueda) | Plantillas de embudo y checkout | — | US$97 a US$297/mes (búsqueda) | No |
| Systeme.io | — | All-in-one gratis en español (búsqueda) | — | — | Gratis; desde US$17/mes (búsqueda) | No |
| GoHighLevel | [gohighlevel.com](https://www.gohighlevel.com/) | Ver CRM | — | — | — | Sí |

**Ganadora: Hyros**: su ángulo es el del funnel de MaKo, el ROAS que cobraste y no el que dice la plataforma.

## Email marketing

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **beehiiv** | [beehiiv.com](https://www.beehiiv.com/) | Crecer y monetizar tu newsletter (búsqueda) | Red de anuncios y suscripciones pagas (búsqueda) | — | Gratis hasta 1.000 suscriptores (búsqueda) | ver abajo |
| Kit, MailerLite, Mailrelay, Doppler, Brevo | — | Email para creadores o pymes (búsqueda) | — | — | Con plan gratis (búsqueda) | No |

**Ganadora: beehiiv.**

## Classroom (curso, comunidad y clientes)

| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Skool** | [skool.com](https://www.skool.com/) | Comunidad y cursos en un lugar (búsqueda) | — | — | Desde US$9/mes (búsqueda) | ver abajo |
| Hotmart, Circle, Kajabi, Coachful | — | Cursos y membresías (búsqueda) | — | — | — | No |

**Ganadora: Skool**: pocas palabras y es la referencia mental de este público.

---

## Competidores que te faltaban

Los que aparecieron y no estaban en tu lista:

- **SetSmart** ([setsmart.io](https://setsmart.io/es)): setter con IA para coaches e infoproductores, en español. Es el más
  parecido a MaKo en el nicho.
- **Novoads** ([novoads.ai](https://novoads.ai/es)): actores de IA con acento latino para anuncios. Es la competencia LATAM de
  AI Avatar.
- **Arcads** ([arcads.ai](https://www.arcads.ai/es)) y **Creatify** ([creatify.ai](https://creatify.ai/es)): anuncios con
  avatares de IA, con su página en español.
- **HeyGen** ([heygen.com](https://www.heygen.com/)): tu avatar con tu cara y tu voz; tiene páginas en español para LATAM.
- **GoHighLevel** ([gohighlevel.com](https://www.gohighlevel.com/)): el all-in-one que revenden las agencias.
- **Leadsales** ([leadsales.io](https://leadsales.io/)) y **Kommo** ([kommo.com](https://www.kommo.com/)): CRM de chats.
- **Clint** ([clint.digital/es](https://clint.digital/es)): CRM brasileño para infoproductores y high ticket.
- **Darwin AI** y **Dapta**: agentes de venta con IA para WhatsApp en LATAM.
- **Hyros** ([hyros.com](https://www.hyros.com/)): atribución para high ticket.
- **iClosed** ([iclosed.io](https://www.iclosed.io/)): agenda para equipos de venta high ticket.
- **Rebill** ([rebill.com](https://www.rebill.com/)): cobros recurrentes en LATAM.
- **Voicit** ([voicit.com](https://voicit.com/)): análisis de llamadas de venta en español.
- **Gethookd**, **Foreplay** y **Atria**: investigación de anuncios.
- **PostNitro**: carruseles con un chat.
- **Madgicx** y **AdAmigo.ai**: media buyer con IA para Meta.
- **Ryze AI**: «Paid Ads Autopilot» (búsqueda).

## Lo que no se pudo abrir

- **motionads.impultienda.ar** y **ManyChat**: los tapa una verificación de Cloudflare. No se evade: se miran desde el Chrome
  de Martín, con la extensión de MaKo.
- **SaleADS**: abre, pero «Cómo funciona» y «Resultados» se animan sin texto legible; hay que verla en un navegador a mano.
- Las marcadas «ver abajo» se están leyendo en esta misma tanda; las que sigan sin abrir quedan con su ángulo de búsqueda.
