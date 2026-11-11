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
| Novoads | [novoads.ai/es](https://novoads.ai/es) | «Tu próximo anuncio está a 4 minutos» / «Elige un actor IA, pega tu guión y listo. Olvídate de creadores caros, estudios y semanas de espera.» | Eliges un actor de IA (con acentos mexicano, argentino, chileno, colombiano, peruano), pegas o generas el guion y sale el anuncio | «+2,000 equipos», «100+ actores IA», «32 idiomas», «~$3 por anuncio»; un bloque del cofundador que contesta por WhatsApp. Sin testimonios | Starter US$15, Plus US$49, Ultra US$129 al mes | Sí |
| Higgsfield | [higgsfield.ai](https://higgsfield.ai/) | Suite creativa con IA | Presets, Soul ID (tu personaje entrenado con fotos), estudio de influencers de IA | Concurso de US$1.000.000, comunidad | — | Sí (la portada es un catálogo, no una landing) |
| MakeUGC, Captions, Argil, Hedra, Synthesia | — | MakeUGC: actores UGC baratos (búsqueda). Captions: editor para creadores. Argil: estudio de video para equipos y agentes. Hedra: infraestructura de modelos (ya no vende avatares). Synthesia: videos de formación para empresas | — | — | — | Argil, Hedra y Synthesia sí; MakeUGC y Captions no abrieron |

**Ganadora: la página de HeyGen en español para anuncios UGC.** Es la que mejor cuenta el uso de MaKo —anuncios para Meta,
TikTok e Instagram— en español de LATAM (es-mx), y su estructura pone el problema antes que la herramienta: sin / con, 3
pasos y casos de uso, que en MaKo son sus plantillas de venta. **Novoads** es la startup LATAM más cercana y se leyó entera
(hero → cifras → «Tu equipo creativo de IA» → 3 pasos → «tu agente puede hacer estos anuncios» → el cofundador → precios →
preguntas → cierre), pero vende **actores**, la cara de otro, y su historia descansa en el precio por anuncio; MaKo vende
**tu** cara, que es la promesa de la portada de HeyGen («videos protagonizados por ti»). Su ángulo para tomar: «tu próximo
anuncio está a 4 minutos», y el fundador que contesta por WhatsApp.

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
| **Leadsales** | [leadsales.io](https://leadsales.io/) | «CRM para WhatsApp, Facebook e Instagram» / «Unifica tu bandeja, ordena a tu equipo y multiplica su rendimiento con IA; para que escales tu operación sin escalar el caos.» | Bandeja unificada con embudo, envíos masivos por la API oficial, asignación entre asesores, mensajes programados y «Lead Agent», un agente de IA que atiende y califica 24/7 | «+2,800 empresas», casos de Mednet y Bodegas Grimaldi, Forbes México y Shark Tank México | «Planes desde $97 USD al mes»; prueba de 14 días | Sí |
| respond.io | [respond.io/es](https://respond.io/es) | «Los clientes preguntan por chat. Llama para más detalles. Confirma por correo electrónico. ¿Puedes seguir el ritmo?» | Un buzón de equipo con chats, llamadas y correos en un hilo, agentes de IA y CRM propio | «Más de 10k marcas», 4.8 en G2, Serie B de US$62,5M, «60% ciclo de ventas más rápido», «81% conversión», «42.5x ROI» | Prueba gratis; precio en otra página | Sí |
| Kommo | [kommo.com/es](https://www.kommo.com/es/) | «Potencia tus chats, evita todo el caos» | Bandeja, embudo, Salesbot y agentes de IA de ventas y reservas | «+100,000 clientes», casos con porcentajes | Por usuario: Básico, Avanzado, Pro, por plazos de 6 a 24 meses | Sí |
| Darwin AI | [getdarwin.ai](https://www.getdarwin.ai/) | Agentes de IA para WhatsApp, Instagram y voz (búsqueda) | — | Caso Promotora Baqueira (búsqueda) | Sin precio público (búsqueda) | No |
| Callbell, Wati, SleekFlow, Treble, Cliengo | — | Bandejas de WhatsApp (búsqueda) | — | — | — | No |

**Ganadora: Leadsales.** Es de LATAM, en español, para equipos que venden por WhatsApp, y cuenta el problema como lo vive
quien compra anuncios de WhatsApp («ventas en chats sueltos»). respond.io queda de contraste: es la global, para B2C.

**Orden de secciones de Leadsales:** (1) navegación con «Agenda una demo» · (2) hero «CRM para WhatsApp, Facebook e
Instagram» · (3) «Así funciona el CRM para WhatsApp de Leadsales», en pestañas: Embudo, Conversaciones, Agenda, Lead Agent,
Métricas; con «+2,800 empresas» · (4) «Tu equipo necesita un CRM pensado para vender por WhatsApp.»: «Ventas en chats
sueltos» contra «con Leadsales» · (5) «Del primer mensaje al cierre de cada venta.»: envío masivo y oficial, embudo, mensajes
programados, responde y califica 24/7 · (6) «Todo lo que incluye Leadsales» · (7) «Planes desde $97 USD al mes» · (8) «Lo
que dicen nuestros clientes.» · (9) «Lo que necesitas saber para usar Leadsales.» (preguntas) · (10) «Tu próximo paso:
organizar las ventas de tu equipo.» · (11) los medios · (12) Shark Tank México · (13) pie.
**Arco:** vendes por chats sueltos y nadie sabe quién atiende qué → una bandeja con embudo, asignación y un agente de IA lo
ordena → casos reales de LATAM.
**Ángulo:** «escala tu operación sin escalar el caos».

**respond.io, para comparar:** (1) Serie B · (2) la pregunta «¿Puedes seguir el ritmo?» · (3) tour interactivo · (4) «Más de
10k marcas» · (5) Captura / Convierte / Retén · (6) «Chats, llamadas y correos en un solo hilo» · (7) la carta del CEO sobre
la IA · (8) beneficios del agente · (9) cifras · (10) casos · (11) testimonios · (12) G2 · (13) cuatro razones · (14) cierre.
Su ángulo: «tus leads no se pierden aunque cambien de canal».

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
| **SetSmart** | [setsmart.io/es](https://setsmart.io/es) | «Tu AI setter convierte tus DM de Instagram en llamadas de venta calificadas» / «…responde tus DM de Instagram, califica tus prospectos y agenda tus llamadas de venta, 24/7. Tú solo cierras en la llamada.» | Describes tu oferta, tono y criterios; conectas Instagram; la IA responde, califica con tu guion, agenda dentro del chat (Calendly, GHL, iClosed, Cal.com), manda notas de voz y hace seguimientos | «Elegido por 500+ coaches», 4.8 en Trustpilot, ~35 testimonios con nicho y seguidores, una tabla «setter humano contra SetSmart» y una calculadora de ahorro | «$97/mes» contra un setter de «$2,000/mes»; prueba de 7 días | Sí |
| ManyChat | [manychat.com](https://www.manychat.com/) | Automatizaciones de Instagram y WhatsApp | — | — | — | **No**: verificación de Cloudflare |
| GoHighLevel (Conversation AI) | [gohighlevel.com](https://www.gohighlevel.com/) | El chat y la voz con IA de su plataforma | — | — | Incluido en sus planes | Sólo como mención |
| Darwin AI, Dapta | getdarwin.ai, dapta.ai/es | Agentes de venta con IA para WhatsApp en LATAM (búsqueda) | — | — | — | No |

**Ganadora: SetSmart.** Hace lo mismo que el setter de MaKo, para coaches e infoproductores, en español.
**Orden de secciones:** (1) navegación · (2) hero con «Crear Mi Agente IA» y una maqueta de la bandeja con la ficha del lead ·
(3) integraciones y «Más de 500 coaches online confían en nosotros» · (4) «La solución: gestionar tus DM con SetSmart»: el
lead que se enfría contra el que reserva en 30 segundos · (5) «Lo que nuestros clientes realmente dicen» · (6) «Todo lo que
hace tu setter IA» (del comentario al DM, califica, notas de voz, reserva en el chat, seguimientos, suena humana) ·
(7) «Automatiza el agendamiento de citas con IA conversacional» · (8) «Crea tu IA en solo unos clics» · (9) «Operativo en
menos de 10 minutos» (3 pasos) · (10) «Supera a los setters humanos.» (tabla) · (11) «Calcula tu ROI» · (12) «Funciona con
tu stack» y un testimonio en video · (13) «Estadísticas en vivo» · (14) «Controla SetSmart desde tu propia IA» (MCP) ·
(15) 16 preguntas, entre ellas «¿Hay riesgo de ser baneado en Instagram?» · (16) pie.
**Arco:** el lead se enfría porque respondes tarde → un setter de IA responde y agenda en segundos → la prueba son coaches con
nombre y un setter humano que cuesta veinte veces más.
**Ángulo:** «tú solo cierras en la llamada».

## Agenda
| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **iClosed** | [iclosed.io](https://www.iclosed.io/) | «ONLY 3 OUT OF 10 LEADS BOOK FROM YOUR SCHEDULER / Triple your leads using high-converting Scheduler» | Un embed delante de tu funnel: toma el formulario antes de mostrar horarios, descalifica a los que no compran, rutea al mejor closer, recupera a los que abandonan por SMS o WhatsApp y mide ingresos por llamada | «5/5 on G2», «Join 20,000 high ticket funnels», citas de Hyros, Sendblue y Alex Becker, casos en dólares («$129k JUST from the extra leads», «11.7× ROAS») | «7-day free trial»; precio no visible | Sí |
| Calendly / Cal.com / Chili Piper / OnceHub | — | Agendas generales (búsqueda) | Recordatorios, ruteo | — | Calendly desde US$10 por usuario (búsqueda) | No |

**Ganadora: iClosed.** Es la única hecha para el flujo high ticket.
**Orden de secciones:** (1) aviso y navegación · (2) hero «Triple your leads…» con «Start for free» y la maqueta de la agenda ·
(3) tres citas cortas · (4) «Keep the same funnels. Change the scheduler, make more profit.» en pestañas: Qualify &amp; Route,
Engage, Measure, AI Agent · (5) «Save 100+ hours and close 34% more» · (6) «You already follow them. They already run on
iClosed.» · (7) «The money's already in your funnel. Plug in. Take it back.» · (8) «Everything your booking page should've
done all along» · (9) «Your whole team, closing in one inbox» · (10) «Built around your offer» (VSL, webinar, challenge) ·
(11) integraciones · (12) «Proof, in their own words» · (13) «The lift, measured in cold dollars» · (14) cierre «Stop leaking
pipeline» · (15) pie.
**Arco:** sólo 3 de cada 10 leads agendan → el dinero ya está en tu funnel → recupera, califica y rutea → casos en dólares.
**Ángulo:** «recupera el pipeline que ya pagaste con anuncios, sin rehacer el funnel».

## Closing Analyst
| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| Voicit | [voicit.com](https://voicit.com/) | «De reuniones y entrevistas a grandes resultados con IA. Sin bots.» | Transcribe y arma un informe con tu plantilla. **No analiza llamadas de venta**: es para actas y entrevistas | «+1.000 empresas», 4.8 | «Empieza gratis y sin tarjeta» | Sí, y no sirve de referencia |
| Fathom | fathom.ai | Notas de reuniones (búsqueda) | — | — | Gratis; Premium (búsqueda) | No |
| Hyperbound | hyperbound.ai | Roleplay con compradores de IA (búsqueda) | — | — | — | No |
| Practify IA | — | Roleplay y análisis de llamadas en español de España (búsqueda) | — | — | — | No |
| Gong | — | Contraste (EE.UU., enterprise) | — | — | — | No |

**Sin ganadora todavía.** Voicit se leyó y resultó ser un generador de actas, no de análisis de llamadas de venta. No
apareció en español una herramienta que lea tus llamadas y te diga por qué un lead no cerró: el espacio está vacío. Para
elegir hay que abrir Fathom, Gong o Hyperbound (hosts sin habilitar).

## Cobranza
| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Rebill** | [rebill.com/es](https://www.rebill.com/es) | «Infraestructura financiera para las Américas» / «Acepta pagos locales, ofrece cuotas y gestiona suscripciones…» | Pasarela con adquirentes locales: links de pago, cuotas, suscripciones, reintentos y avisos de rechazo | «Incrementa hasta 20 puntos porcentuales la aprobación», «Recupera cerca del 52% de los rechazos», casos por país | Precio en «Tarifas» | Sí |
| Mercado Pago (link de pago) | mercadopago.com.mx | Meses sin intereses (búsqueda) | — | — | Comisión por venta (búsqueda) | No |
| PorCobrar, Cliengo | — | Recordatorios de cobro por WhatsApp (búsqueda) | — | — | — | No |

**Ganadora: Rebill.** Apunta a empresas medianas: no hay nada hecho para cuotas de mentorías o infoproductos.
**Orden de secciones:** (1) navegación · (2) hero con «Activar cuenta ahora» y «Hablar con un experto» · (3) tres cifras ·
(4) «Conexiones locales. Pagos locales y cross-border.» · (5) funciones: links de pago, cuotas, suscripciones, avisos,
dashboard · (6) «Integración simple. Resultado profesional.» · (7) automatización sin código · (8) «Historias de clientes» ·
(9) preguntas · (10) pie con comparativas.
**Ángulo:** «más pagos aprobados en LATAM, con reintentos automáticos».

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
| **Gethookd** | [gethookd.ai](https://www.gethookd.ai/) | «Your AI cannot see Meta's ad library. Now it can. / Give Your AI 22 Million Live Meta Ads» | Biblioteca de anuncios vivos de Meta que consultas desde la app o desde tu IA; «Clone Ads» convierte un ganador en tu próxima estática | «100,000+ users», «22M+ active ads» | Desde US$29/mes; 7 días por $0 | Sí |
| Atria | tryatria.com | Califica tus anuncios y dice cómo mejorarlos (búsqueda) | — | Caso VaynerCommerce (búsqueda) | ~US$159/mes (búsqueda) | No |
| Motion | motionapp.com | Analítica creativa (búsqueda) | — | «2,100 teams» (búsqueda) | ~US$250/mes (búsqueda) | No |
| Fastlane | [usefastlane.ai](https://www.usefastlane.ai/) | Su bloque «Reads the results. Doubles down.» | Métricas por anuncio y variaciones del ganador | — | — | Sí |

**Ganadora: Gethookd**, por «convierte un ganador en tu próximo anuncio», que es lo que hace el Ads Analyst con tus propios
anuncios. Ojo: Gethookd mira los anuncios del mercado, no los tuyos; para «cuál de los míos gana», el modelo es el bloque de
Fastlane.
**Orden de secciones:** (1) navegación · (2) hero con «Start a 7-Day Trial for $0» · (3) «Ask your AI» · (4) «Do it
yourself, or hand it to your AI» · (5) Explore, Connect, Ask · (6) Brand Spy · (7) Shops · (8) Boards · (9) Clone Ads ·
(10) precios · (11) 14 preguntas · (12) cierre «Your competitors already found the winning ad» · (13) pie.

## Competitor Spy
| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Foreplay** | [foreplay.co](https://www.foreplay.co/) | «The Complete Winning Ad Workflow» | Guardas anuncios de Meta, TikTok y LinkedIn, los ordenas, rastreas competidores 24/7 y escribes briefs con IA | «Powering +10,000 Social Ad Teams & Agencies», «30,000 Users» de la extensión, contador de anuncios guardados | «Unrestricted 7 day free trial» | Sí |
| Gethookd | [gethookd.ai](https://www.gethookd.ai/) | «Brand Spy»: avisa cuando un competidor lanza | — | — | Desde US$29/mes | Sí |
| Minea | minea.com/es | Anuncios con datos por producto (búsqueda) | — | — | ~US$49/mes (búsqueda) | No |
| Atria, BigSpy, AdSpy | — | Bibliotecas de anuncios (búsqueda) | — | — | — | No |

**Ganadora: Foreplay**, la que más se parece a «guardas con un botón y te ordena la inspiración». En español no apareció
ninguna herramienta propia, sólo guías.
**Orden de secciones:** (1) navegación · (2) hero «The Complete Winning Ad Workflow» · (3) «Powering +10,000…» · (4) «Your
new secret weapon for ads»: antes (chats, links vencidos) y después · (5) Research &amp; Inspiration · (6) «Save ads from
anywhere, forever» · (7) «Automatically track competitors» · (8) «The smartest ad search engine» · (9) la extensión gratis ·
(10) Creative Analytics &amp; Production · (11) colaboración · (12) compartir y presentar · (13) «Miles beyond the status quo»
· (14) cierre «Ready to ship more winning ads?» · (15) pie.

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
| **PostNitro** | [postnitro.ai/es](https://postnitro.ai/es) | «El creador de carruseles con IA que diseña y programa tus publicaciones.» | Das un tema, un link o un texto; «Nitro Chat» propone un esquema, lo apruebas y diseña con tu kit de marca; después lo programa o lo exporta | «5.0», «86,000+ creators», «200+ platforms embed our editor» | Descuento de Black Friday; precio en otra página | Sí |
| Contentdrips | contentdrips.com | Tu marca en cada carrusel (búsqueda) | — | — | — | No |
| AdCreative.ai | adcreative.ai | Creativos con puntaje de conversión (búsqueda) | — | — | US$29 a US$109/mes (búsqueda) | No |
| Predis.ai | predis.ai | Anuncios y carruseles en español (búsqueda) | — | — | — | No |
| Fastlane | [usefastlane.ai](https://www.usefastlane.ai/) | «Create infinite content, based on winning formats» | Formatos probados (pizarra, meme, remix de la competencia) | Ver arriba | «First 5 statics free» | Sí |
| Canva | — | Contraste | — | — | — | No |

**Ganadora: PostNitro**: un chat que diseña carruseles, como la Image de MaKo, y en español.
**Orden de secciones:** (1) aviso y navegación · (2) hero · (3) «Publica en» (6 redes) · (4) «Dale acceso a PostNitro a tu
agente» · (5) prueba social · (6) «Pruébalo, no es un video» (editor interactivo) · (7) «Más de 100 plantillas, todas
editables» · (8) «De la idea a la publicación programada en tres pasos» · (9) «Cada parte de la publicación es tuya» ·
(10) «Nitro Chat lo diseña contigo» · (11) «Tu kit de marca hace el trabajo de diseño» · (12) lienzo · (13) imágenes por
diapositiva · (14) cronograma · (15) planificador · (16) para agencias · (17) automatizar · (18) creadores.
**Ángulo:** «de la idea al carrusel, con tu marca y sin diseñador».

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
| **Motion** | [usemotion.com](https://www.usemotion.com/) | «Get an unfair advantage by using AI to double productivity» | Toma proyectos, tareas, prioridades y fechas, arma el plan en tu calendario y lo reacomoda varias veces al día; notas de reuniones y proyectos con IA | «Over 1 million top performers and teams trust Motion», citas con ahorros en dinero, reseñas de G2 | «Start your free trial. Cancel in 1 click.» | Sí |
| Reclaim, ClickUp Brain, Linear | — | Agenda automática o tareas con IA (búsqueda) | — | — | — | No |

**Ganadora: Motion**: «la IA decide el orden por ti». Nada en español saca tareas de tus reuniones grabadas.
**Orden de secciones:** (1) navegación · (2) hero con «What AI tools would you like to use?» · (3) confianza y cuatro citas ·
(4) «Stop using tech from the pre-AI era» (tabla contra tus herramientas de siempre) · (5) «Motion's AI detects and
prioritizes your most urgent and important tasks, automatically» · (6) proyectos con IA · (7) asistente de reuniones ·
(8) de documentos a tareas · (9) «Have an AI assistant schedule your day» · (10) flujos · (11) reportes · (12) reseñas ·
(13) «Why Motion's all-in-one platform is better than using 10 separate tools» · (14) integraciones y seguridad · (15) cierre.

## Offer
| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Atlas AI (DFY)** | [go.doneforyou.com/offer-formula](https://go.doneforyou.com/offer-formula) | «How I Build Profitable OFFERS in Hours — Not Months» / «For Anyone Tired of Guessing What to Sell» | Entrenamiento en video de 5 pasos y «Atlas AI», que arma oferta, precio, bonos y posicionamiento | «4.7 / 5 based on 398+ verified students» | 7 días gratis, después US$97/mes; garantía de 30 días | Sí |
| $100K Offer Generator, GPTs de «Grand Slam Offer», kits de prompts | — | Ofertas en minutos (búsqueda) | Prompts o GPTs | — | US$97 o menos (búsqueda) | No |

**Ganadora: Atlas AI**, lo más parecido a un producto. Todo lo demás son prompts: no hay en español una app que diagnostique
y arme la oferta en un PDF.
**Orden de secciones:** (1) navegación · (2) «For Anyone Tired of Guessing What to Sell» · (3) titular y VSL («Make Sure Your
Sound Is Turned ON!») · (4) botón · (5) precio · (6) «This Is Exactly How…» · (7) «Without…» (sin nicho, sin seguidores, sin
copywriter) · (8) «Here's Everything You're Getting» · (9) garantía · (10) botón final.

## Funnels / embudo
| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Hyros** | [hyros.com](https://hyros.com/) | «Tracking that grows ads / Custom Made For You» | Rastrea las ventas que el píxel perdió y se las devuelve a Meta y Google para que optimicen mejor | «Tracking $5B+ in ad spend», «5,000+ brands», logos de Tony Robbins y Alex Hormozi | «Guaranteed or you don't pay» | Sí |
| ClickFunnels | clickfunnels.com | «Marketing Funnels Made Easy» (búsqueda) | Plantillas de embudo y checkout | — | US$97 a US$297/mes (búsqueda) | No |
| Systeme.io | — | All-in-one gratis en español (búsqueda) | — | — | Gratis; desde US$17/mes (búsqueda) | No |
| GoHighLevel | [gohighlevel.com](https://www.gohighlevel.com/) | Ver CRM | — | — | — | Sí |

**Ganadora: Hyros**: su ángulo es el del funnel de MaKo, la venta real y no la que dice la plataforma.
**Orden de secciones:** (1) aviso de Black Friday y navegación · (2) hero con la demo «Meta vs HYROS · 7 days» y «138 missed
sales» · (3) «Tracking $5B+ in ad spend for:» · (4) «Any Feature You Want Is Just A Prompt Away» · (5) «Brands that add
Hyros see…» · (6) «Guaranteed or you don't pay» · (7) las funciones · (8) AI Swarm Tracking · (9) «Pick your business model»
(SaaS, ecommerce, llamadas B2B, info) · (10) el MCP · (11) la garantía · (12) pie.
**Ángulo:** «Meta se equivoca porque no ve todas tus ventas».

## Email marketing
| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **beehiiv** | [beehiiv.com](https://www.beehiiv.com/) | «NEWSLETTERS. PODCASTS. COMMUNITY. ONE PLATFORM.» | Editor, automatizaciones, recomendaciones, anuncios y suscripciones pagas, sitio y comunidad | «4.9/5 from 28,479 customers», «135K+ publishers», «400M+ unique readers every month» | Free; Lite desde US$49/mes; Pro desde US$95 | Sí |
| Kit, MailerLite, Mailrelay, Doppler, Brevo | — | Email para creadores o pymes (búsqueda) | — | — | Con plan gratis (búsqueda) | No |

**Ganadora: beehiiv.**
**Orden de secciones:** (1) navegación · (2) hero con registro sin tarjeta · (3) logos · (4) «Everything you need to turn
attention into growth» (crear, crecer, monetizar, automatizar, integrar, medir) · (5) podcasts · (6) productos digitales ·
(7) monetización · (8) comunidad · (9) sitios · (10) clientes · (11) planes · (12) citas · (13) cifras · (14) integraciones
· (15) preguntas · (16) «What are you waiting for?» · (17) pie.

## Classroom (curso, comunidad y clientes)
| Competidor | URL | Titular / promesa | Mecanismo | Pruebas | Oferta y precio | ¿Abierta? |
|---|---|---|---|---|---|---|
| **Skool** | [skool.com](https://www.skool.com/) | Comunidad, cursos y eventos; «set it up in less than 30-minutes» (de su página «about») | — | — | Desde US$9/mes (búsqueda) | **No**: la portada carga vacía sin sesión |
| Hotmart, Circle, Kajabi, Coachful | — | Cursos y membresías (búsqueda) | — | — | — | No |

**Ganadora: Skool**: pocas palabras y es la referencia mental de este público. Su portada no se pudo leer.

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
