# Relevo para el VSL principal: landings, funciones y números (18/11/2026)

Para rehacer el VSL principal con el personaje animado. Todo sale del código de la rama `vsl-principal`
(commit `54cd6f204`, recién sacada de `origin/main`). Donde algo se cuenta en tiempo de ejecución, se leyó la página
pública de producción con `curl` (sin navegador) el 18/11/2026, y se dice.

**En un minuto:**

- Hay **una sola portada** (`/`), **24 landings de función** (`/vsl/<slug>`), Precios (`/planes`), Accelerator,
  Partners, 7 páginas de funnels, 21 «MaKo vs X», 3 landings de industria publicadas desde Web Generator y 12
  landings viejas que ya no están en ningún menú.
- **Videos narrados (Panda) hay cuatro:** el VSL de la portada (que también usan `/planes` y las 3 de industria), el del
  Accelerator, el mini-VSL del CRM (en una ventana emergente de `/vsl/crm`) y el del Semáforo (landing vieja). El resto
  son grabaciones mudas de la app en bucle (`.webm`) y el video de Mauricio.
- **El CTA de todo el sitio es uno:** `PRUÉBALO GRATIS AHORA` → `/planes`. La única excepción es el Accelerator
  (`Aplica ahora` → formulario → llamada).
- **Las funciones fuertes existen.** Lo que el VSL no puede vender todavía: **AI Avatar** (está apagado para la venta),
  **generar video e imágenes con los MaKo Tokens** (la vitrina lo dice, pero ninguna ruta de la app lo hace hoy) y
  **cambiar solo tus miniaturas de YouTube**.

---

## 0. El VSL principal de hoy (junio de 2026)

Es el video de Panda «MaKo-VSL Principal» (`25c0684d-…`, 400 s, subido el 27/07), el corte v2 de
`OneDrive/Escritorio/MaKo-VSL/MaKo - VSL principal/`. Transcripción completa: [vsl-junio-transcripcion.md](vsl-junio-transcripcion.md).

- **Cómo es:** 6:40 de Martín a cámara, de corrido, en el living con el vidrio (4K, horizontal), con voseo.
- **Qué vende:** a Martín más que al software. MaKo como «inteligencia artificial multiagente» que conecta el VSL Funnel
  (anuncio → landing → VSL → agenda → WhatsApp → llamada) para dejar de decidir a ciegas; después, la auditoría de Martín y su
  acompañamiento. Cierra con «MaKo está en fase beta… cupos solo para cinco dueños de negocio» y «agenda una llamada conmigo».
- **Qué funciones nombra:** el dashboard que junta los datos del funnel (qué anuncio trae a los que pagan, qué parte del VSL
  retiene, qué objeción aparece en las llamadas, qué closer convierte). Nada más, y sin mostrar ninguna pantalla.
- **Qué le falta (lo que hoy es lo más fuerte de la app):** Second Brain y los referentes, Competitor Spy, Copywriting,
  carruseles, edición de video, Web Generator (replicar landings), Marketing CoPilot, Chats y el setter con IA, Automations,
  CRM con el tracking de cada lead, Closing, curso y comunidad. Tampoco dice el precio ni la prueba de 7 días.
- **Qué quedó viejo:** «fase beta, 5 cupos», «agenda una llamada conmigo» (hoy el único CTA es `PRUÉBALO GRATIS AHORA`, y la
  llamada existe sólo al aplicar al Accelerator), el caso de Mauricio con «más de setenta mil» (hoy, «más de US$100k
  vendidos») y «más de quinientos mil dólares para mis clientes» (hoy el Accelerator dice +US$1M).

---

## 1. Las landings

### 1.1 Portada, precios y programas

| Ruta | Archivo | Titular y bajada (textuales) | Funciones que nombra | Video | CTA |
|---|---|---|---|---|---|
| `/` | `app/page.tsx` → `app/vsl/_sitio/Portada.tsx` (textos en `_sitio/datos.ts`) | **«El mejor software para vender High Ticket.»** / «Marketing, ventas y entrega del servicio en una sola app. Con una IA que conoce tu negocio, desde que alguien te descubre hasta que es tu cliente y le entregas lo que compró.» | Las 16 filas de la tabla 1.2, el caso de Mauricio, los precios (las mismas columnas de `/planes`), «Lo que probablemente ya pagas», 30 integraciones, preguntas frecuentes | **Panda** `https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=25c0684d-528e-4382-9796-d1ec74b79634&color=%232F6FED` (`_sitio/vsl-portada.ts`, `VSL_PORTADA`). Más: `/vsl-assets/mauricio.mp4` en el caso, y grabaciones `.webm` mudas en cada fila | `PRUÉBALO GRATIS AHORA` → `/planes`. Cierre: «¿Lo quieres funcionando en tu negocio?» |
| `/vsl` | `app/vsl/page.tsx` | Redirect permanente a `/` | — | — | — |
| `/vsl/sitio` | `app/vsl/sitio/page.tsx` | Redirect permanente a `/` | — | — | — |
| `/planes` | `app/planes/page.tsx`, `Vitrina.tsx`, `Tarjetas.tsx` | El mismo titular y la misma bajada de la portada | Tres columnas (Essential, Pro, Accelerator), MaKo Tokens de cada plan, barra de tokens extra, «Compara los planes», preguntas | **Panda**, el mismo `VSL_PORTADA` (`Vitrina.tsx:154`) | Essential y Pro: `PRUÉBALO GRATIS AHORA` y «Quiero el anual». Accelerator: `MÁS INFORMACIÓN` → `/accelerator` |
| `/accelerator` | `app/accelerator/LandingAcelerador.tsx`, textos en `contenido.ts` | Ceja «Programa por aplicación · Cupos limitados». **«Construye un sistema de adquisición de clientes predecible.»** / «A diferencia de otros programas que te dan un PDF, yo te incluyo MaKo, el mejor software para vender High Ticket.» | El programa de 3 meses con Martín, 12 entregables en 3 fases, caso Mauricio, otros 4 casos, filtro «¿Esto es realmente para ti?», la inversión | **Panda** `https://player-vz-dd4ad08b-375.tv.pandavideo.com.br/embed/?v=d0b3e8db-29b7-4e73-a350-b9ce7bd9f81f` (`VSL_ACELERADOR`). Más: `mauricio.mp4` y `/vsl-assets/testi-axel.mp4` | `Aplica ahora` → `/accelerator/aplicar` (formulario; la agenda se abre después, a quien califica) |
| `/mako-partners` | `app/mako-partners/LandingPartners.tsx` | **«Recomienda MaKo y llévate el 30%»** / «Cada negocio que traes te deja el 30% de lo que paga, todos los meses. Trae 10 y son US$291 extra por mes.» | Programa de referidos, calculadora, 3 pasos, preguntas | No tiene | `HACERME PARTNER` → `/partners?alta=1` (pide sesión) |
| `/partners` | `app/partners/page.tsx` | El panel del partner; pide sesión | — | — | — |
| `/vsl/comparaciones` | `_sitio/Comparaciones.tsx` (noindex) | **«Lo que probablemente ya pagas en tu negocio»** + «MaKo vs las demás.» + «Compara precios y funciones.» | La tabla trabajo por trabajo (53 apps) | No tiene | `PRUÉBALO GRATIS AHORA` |
| `/vsl/comparaciones/<slug>` (21) | `comparaciones/[slug]/page.tsx` (noindex) | «MaKo vs {competidor}» | activecampaign, canva, capcut, circle, clickfunnels, gamma, gohighlevel, heygen, higgsfield, hotmart, hubspot, kajabi, mailchimp, make, manychat, metricool, notion, opusclip, skool, systeme-io, zap | No tiene | Igual |
| `/vsl/funnels/<id>` (7) | `funnels/[funnel]/page.tsx`, textos en `_sitio/funnels-datos.ts` (noindex) | «Tu funnel de VSL con llamada, completo en MaKo.» · «…de anuncios a WhatsApp…» · «…con formulario…» · «…de venta directa…» · «Tu Instagram con lead magnet…» · «…de YouTube…» · «…de newsletter…» | Las piezas de MaKo de cada funnel | Grabaciones `.webm` mudas | Igual |
| `/vsl/coaches` · `/vsl/infoproductores` · `/vsl/inmobiliarias` | `app/vsl/[slug]/page.tsx`: **documentos de Web Generator en la base**, no en el código (`lib/editor-landing/landing-mako.ts`) | Leídos en producción: «Llena tu agenda de llamadas que cierran, no de curiosos» · «Sal de Skool y Hotmart: tu curso, tu comunidad y tus ventas en MaKo» · «Más cierres para tu inmobiliaria, sin perder un interesado» | Por industria | **Panda**, el mismo `VSL_PORTADA` (`v=25c0684d…`) en las tres | El HTML servido trae un «Agenda tu llamada» (`#beta`) que el código reescribe en el navegador a `PRUÉBALO GRATIS AHORA` (`app/vsl/landing-contenido.ts`, paso 5). **No lo verifiqué mirando** |
| `/agency` | `app/agency` | La de sumarse como agencia; pide sesión. Es «Industrias → Agencias» en el menú | — | — | — |

### 1.2 Las 16 filas de la portada (en su orden)

Fuente: `TARJETAS_PORTADA`, `app/vsl/_sitio/datos.ts:353-405`. El «Con MaKo Pro.» no se escribe a mano: sale de
`lib/topes-plan.ts` (`soloPro`).

| # | Fila | Titular | Visual | Plan |
|---|---|---|---|---|
| 1 | Second Brain | «Second Brain: todo tu negocio, en un solo mapa.» | El grafo REAL, que se arrastra (`BrainVivo.tsx`), con el negocio de Alex Hormozi | Los dos |
| 2 | Referentes | «Chatea con los referentes del mercado.» | `referentes.webm` | Con MaKo Pro |
| 3 | Competitor Spy | «Mira todo lo que publica tu competencia.» | `spy.webm` | Los dos (1 competidor en Essential) |
| 4 | Copywriting | «Replica y adapta un guion de la competencia con IA.» | `copywriting.webm` | Con MaKo Pro |
| 5 | Carruseles | «Replica los carruseles que funcionan.» | `carruseles.webm` | Con MaKo Pro |
| 6 | Video | «Edita tus videos con inteligencia artificial.» | `video.webm` | Con MaKo Pro |
| 7 | AI Avatar | «Anuncios de video estilo UGC con tu cara.» | Los dos videos reales (`sitio/avatar/martin.webm`, `mauricio.webm`) | Sin aviso: **no se vende todavía** |
| 8 | Marketing CoPilot | «Gestiona tus anuncios, tu Instagram y tu YouTube con IA.» | `copilot.webm` | Piloto automático, con MaKo Pro |
| 9 | Web Generator | «Replica una landing de tu competencia.» | `replicar.webm` | Con MaKo Pro |
| 10 | CRM | «El CRM trackea tus leads de forma automática.» | `crm-ficha.webm` | Los dos |
| 11 | Automations | «Automatiza tu WhatsApp, Instagram y email.» | `automations.webm` | Setter con IA, con MaKo Pro |
| 12 | Chats | «WhatsApp, Instagram, Messenger y email, desde MaKo.» | `chats.webm` | Los dos |
| 13 | Closing | «Analiza todas tus llamadas de venta con IA.» | Componente con dos llamadas reales de Mauricio, sin nombres (`ClosingAntesDespues.tsx`) | Con MaKo Pro |
| 14 | Dashboard | «Tus números, en tableros.» | Carrusel de 13 tableros grabados | Los dos |
| 15 | Equipo | «Tu equipo de ventas, cada uno con su rol.» | Organigrama | Con MaKo Pro, hasta 5 personas |
| 16 | Classroom | «Tu curso y tu comunidad, alojados en MaKo.» | `comunidad.webm` | La comunidad, con MaKo Pro |

(El comentario de `datos.ts` que explica el orden todavía cuenta 14.)

### 1.3 Las 24 landings de función (`/vsl/<slug>`)

Todas: `app/vsl/<slug>/page.tsx` → `LandingCompetencia` con los textos de `app/vsl/_competencia/<slug>.ts` y el diseño
copiado de su referencia en `_competencia/disenos/<slug>.tsx`. **CTA de todas: `PRUÉBALO GRATIS AHORA` → `/planes`.**
**Video de todas:** grabaciones mudas de la app en bucle (`public/vsl-assets/...`) y el video de Mauricio en el caso;
sólo `/vsl/crm` tiene además un Panda. Están todas en el menú «Producto» (`LANDINGS_COMPETENCIA`, `_competencia/registro.ts`).

| Ruta | Función | Titular | Bajada | Visual del héroe |
|---|---|---|---|---|
| `/vsl/second-brain` | Second Brain | «Tu negocio, en un mapa.» | «El mapa de lo que MaKo sabe de tu negocio, conectado y a la vista.» | El grafo real (`BrainVivo`) |
| `/vsl/copywriting` | Copywriting | «32 referentes del marketing, instalados en tu IA.» | «Tu IA escribe como la de todos porque no sabe nada de ti. MaKo lee tu negocio, te pregunta lo que falta y escribe en tu página. Y en el chat de MaKo eliges a qué referente seguir: te contesta con su método. Con MaKo Pro.» | Grabación + caricaturas |
| `/vsl/competitor-spy` | Competitor Spy | «El flujo completo para anuncios ganadores» | «Todo lo que necesitas para hacer anuncios que conviertan, desde la primera chispa de inspiración guardando anuncios de la Biblioteca de Anuncios de Meta hasta tu versión, lista para editar en Image.» | `spy.webm` |
| `/vsl/image` | Image (carruseles) | «El creador de carruseles con IA que replica lo que funciona.» | «Carruseles, publicaciones, historias, anuncios y miniaturas: diseñados con IA (Con MaKo Pro) o a mano en un editor de arrastrar y soltar de formato libre, en tu kit de marca, a partir de los carruseles que mejor les funcionan a las cuentas que sigues.» | `carruseles.webm` |
| `/vsl/video` | Video | «MaKo tu contenido, de la idea al video listo» | «Súbelo tal cual salió y míralo volver cortado y con subtítulos. La Edición automática quita las pausas, subtitula, propone B-roll y deja el volumen listo, y todo lo ves pasar en la línea de tiempo. Con MaKo Pro.» | Grabaciones del editor |
| `/vsl/ai-avatar` | AI Avatar | «Anuncios de video estilo UGC con tu cara, sin contratar creadores» | «Genera anuncios de video UGC con tu avatar de IA, que se ven y se sienten como un video grabado con el celular. Produce más anuncios para TikTok, Instagram y Meta sin tener que coordinar creadores, negociar tarifas ni esperar entregas.» | Reel con el avatar de Martín (`avatar/martin.webm`) y anuncio de Mauricio |
| `/vsl/ads` | Marketing CoPilot | «Tus anuncios de Meta, revisados todos los días.» | «Pídele lo que quieras y MaKo te va a ayudar a crear y optimizar campañas que vendan, medidas contra lo que vendiste.» | `copilot.webm` y variantes |
| `/vsl/web-generator` | Web Generator | «Landings impulsadas por Web Generator» | «Describe lo que necesitas. Web Generator la diseña, la escribe y la conecta a tu CRM y a tu agenda. O pega el link de una landing que ya funciona y la replica.» | `replicar.webm` |
| `/vsl/crm` | CRM | «El CRM trackea tus leads de forma automática» | «Todas las herramientas que necesitas para captar, nutrir y cerrar leads nuevos y convertirlos en reuniones, ventas y cuotas cobradas, con tu CRM en el centro.» | `crm/ficha-hero.webm` + **Panda en ventana emergente** `…/embed/?v=018788b3-453e-496c-86c1-124bae1fea4c&autoplay=true&color=%232F6FED` (`features.ts`, `crm.videoEmbed`) |
| `/vsl/seguimiento` | Automations · setter con IA | «Tu setter con IA convierte tus DM de Instagram en llamadas de venta calificadas» | «Tu setter con IA responde tus DM de Instagram, califica a tus prospectos con tus propios criterios y los lleva a agendar su llamada de venta. Tú solo cierras en la llamada. También en WhatsApp, Messenger y email.» | `automations.webm` |
| `/vsl/whatsapp` | Chats | «CRM para WhatsApp, Facebook e Instagram» | «Unifica tu bandeja, ordena a tu equipo y deja que MaKo le proponga qué contestar; para que escales tu operación sin escalar el caos.» | `chats.webm` |
| `/vsl/closing` | Closing | «Análisis de llamadas con IA: por qué cierras y por qué no» | «Cada llamada de venta, transcrita y analizada: MaKo la puntúa con el método SPIN, marca cada objeción y te dice qué decide tus cierres, en español aunque la llamada sea en otro idioma. Deja de adivinar qué te está costando ventas. Con MaKo Pro.» | Componente de llamadas reales (sin video) |
| `/vsl/dashboard` | Dashboard | «Crea informes y dashboards de marketing digital y ventas, pidiéndoselos a MaKo» | «Reúne 44 fuentes de datos de tu negocio en una sola pantalla: tus anuncios de Meta, tu landing y tu VSL, tus leads del CRM, tus pagos, tus llamadas grabadas, tus mensajes de WhatsApp y tus automatizaciones.» | `dashboard/hero.webm` |
| `/vsl/classroom` | Classroom | «Aloja tu curso y tu comunidad en MaKo» | «El curso y la comunidad de tus alumnos, adentro de la app con la que les vendes. La comunidad, con MaKo Pro.» | Fotos |
| `/vsl/mako` | Ops Center | «Tu departamento de marketing. Una sola contratación.» | «Cuéntale tu negocio: MaKo planea y escribe tus anuncios, tu contenido, tus emails y tus landings, y sus automatizaciones conversan con tus leads por WhatsApp. Lo que cambia algo, lo confirmas con un toque.» | Grabaciones |
| `/vsl/offer` | Offer | «Cómo armar tu OFERTA en una conversación, no en meses» | «MaKo te pregunta por cada pieza, la diagnostica con una rúbrica y te escribe la oferta nueva en un PDF, aunque nunca hayas vendido en línea, no tengas un nicho u odies escribir textos de venta.» | `offer/chat.webm` |
| `/vsl/funnel` | Funnels | «Cada venta, con su anuncio.» | «Del anuncio al pago, lead por lead. Y Meta aprende de tus ventas reales.» | Grabaciones |
| `/vsl/script` | Ads Analyst | «Dale a tu IA tus anuncios de Meta, leídos palabra por palabra» | «Conecta tu Meta a MaKo y pregúntale qué anuncios te funcionan a ti y cuáles a tu competencia: te devuelve sus ganchos, sus ángulos y los cierres de tu CRM.» | Grabaciones |
| `/vsl/email` | Email | «Tus emails, escritos y enviados desde tu CRM.» | «La plataforma todo en uno que te ayuda a escribir, enviar y medir tus emails: secuencias que salen solas por lo que hizo cada lead en tu embudo y envíos a un segmento de tu CRM, firmados con tu dominio.» | Capturas (imágenes) |
| `/vsl/cobranza` | Cobranza | «Cobranza en cuotas para las Américas» | «Acepta pagos con un link de Stripe o Mercado Pago, ofrece cuotas y gestiona suscripciones, con tu propia cuenta de cada pasarela. Cada pago entra solo a tu CRM.» | Grabaciones |
| `/vsl/agenda` | Agenda | «Ordena tus leads usando tu misma agenda» | «MaKo conecta tu Calendly o Cal.com a tu CRM: quien reserva entra con lo que contestó, en la etapa del funnel que elegiste, y con Automations recuperas a los que no terminaron de agendar y les das seguimiento por el canal correcto.» | Grabaciones |
| `/vsl/prioridades` | Plan | «Tus tareas más importantes, elegidas por tu IA» | «…MaKo saca las tareas de tus reuniones grabadas, le pone a cada una un puntaje de 1 a 100 con su razón y te deja las 5 que van primero.» | Grabaciones |
| `/vsl/equipo` | Equipo | «El CRM para tu equipo de setters y closers» | «Invitas a cada persona con su correo y le das su rol. El setter, el closer y el admin entran con su cuenta de Google, cada uno a lo suyo.» | `equipo.webm` |
| `/vsl/calendario` | Calendario de contenido | «El calendario que publica tu semana de contenido» | «Conectas tus redes una vez. Después planificas la semana, la programas entera y cada publicación sale sola, a su hora.» | `calendario.webm` |

### 1.4 Las 12 landings viejas (fuera de los menús)

`app/vsl/<slug>/page.tsx` → `_detalle/FeatureDetail.tsx`, textos en `_detalle/features.ts`. Siguen publicadas pero
ningún menú lleva a ellas. Algunas hablan de vos («Editás», «Soltá»): no siguen la regla del «tú».
CTA: `PRUÉBALO GRATIS AHORA`.

| Ruta | Titular | Video |
|---|---|---|
| `/vsl/api` | «Meta es tan buena como lo que le dejas ver» | — |
| `/vsl/conocimiento` | «Tu método adentro de la IA. No los genéricos de ChatGPT.» | — |
| `/vsl/contrato` | «Del contrato firmado al deal cargado, sin escribir una línea…» | — |
| `/vsl/customer` | «Cerrar al cliente es la mitad. Que se quede es donde está el dinero.» | — |
| `/vsl/experimentos` | «Ningún gurú sabe qué funciona en TU negocio. Un experimento sí.» | — |
| `/vsl/fase-norte` | «Antes de escalar, MaKo te dice en qué fase estás de verdad…» | — |
| `/vsl/integraciones` | «Tus llaves, tu embudo, tu saldo. Ninguna caja negra en el medio.» | — |
| `/vsl/onboarding` | «Tu primer login ya conoce tu negocio» | — |
| `/vsl/perfil-reportes` | «Tu dashboard te habla por WhatsApp. Y solo cuando cuesta plata.» | — |
| `/vsl/pipeline` | «Editás una fila. El resto del embudo se escribe solo.» | — |
| `/vsl/retro` | «Tus datos viven en 6 tabs. La Retro te da UNA tesis…» | — |
| `/vsl/semaforo` | «Ningún dashboard te avisó nunca nada. MaKo sí.» | **Panda** `…/embed/?v=8b1d420a-00bd-4f18-9c6a-730067a5125c&autoplay=true&color=%232F6FED` |

Además: `features.ts` guarda un Panda del funnel (`v=8d035c87-3767-4b84-8a3d-da41efc6524f`) que **ya no se dibuja en
ningún lado** (la landing `/vsl/funnel` tiene su propio diseño). `/vsl/estrategia` redirige a `/admin/estrategia`;
`/vsl/costos` es un documento interno sólo para el admin.

### 1.5 Sobre la portada vieja

`app/vsl/Portada.tsx`, `Landing.tsx`, `landing-html.ts` y `PreciosLanding.tsx` ya no sirven la raíz: sólo dibujan los
documentos de Web Generator de `/vsl/<slug>` (las 3 de industria). `sufijo-a-planes.ts` es la regla que pasa el origen
de la campaña y el `?ref=` del partner a los botones de cada plan: la usan la portada y `/planes`.

---

## 2. Las funciones fuertes, verificadas en el código

| Función | ¿Existe? | Qué hace (en una frase) | Dónde vive | Plan | Lo que falta o lo que la landing dice de más |
|---|---|---|---|---|---|
| **Second Brain** | Sí | El chat de MaKo (Ops Center) que conoce tu negocio, más el «Mapa»: un grafo de tu oferta, cliente, avatares, mensaje y funnel que sus chats leen para contestarte. | `/second-brain` (`app/second-brain/page.tsx`, `Grafo.tsx`, `ChatSecondBrain.tsx`) | Los dos, sin tope a propósito | El Mapa es sólo del admin; closers y setters ven el chat. |
| **Chat con referentes** | Sí | Eliges un referente y MaKo te contesta con su método, sacado de la ficha de un curso suyo. Son 32 y la pantalla dice «Inspirado en». | `app/second-brain/ElegirReferente.tsx`, `ChatDelReferente.tsx`; catálogo `lib/asesores/catalogo.ts`; candado en `app/api/mako/chat/route.ts` | Sólo Pro | Vive dentro del Second Brain/Ops Center, no es una pantalla aparte. Las personas no participan ni respaldan nada: se dice «inspirado en», nunca «con Hormozi». |
| **Competitor Spy** | Sí | Pegas un competidor y MaKo trae su Instagram (reels y posts), sus videos de YouTube, su landing (y qué cambió), y los anuncios de la Biblioteca de Meta que guardas con un clic desde la extensión; los ordena por formato y por vistas. | `/competitor-spy` (`app/competitor-spy/SpyApp.tsx`), `lib/spy.ts`, `lib/spy-captura.ts` | Essential 1 competidor; Pro ilimitados. «Copiar su sitio», sólo Pro | **Los anuncios no se traen solos:** fuera de la UE la API de Meta no los da; se guardan con la extensión de Chrome, desde la Biblioteca. |
| **Copywriting** | Sí | Escribe guiones de reels, anuncios, VSL y emails con tu negocio, desde plantillas con ejemplo (15 plantillas, 16 estructuras, 14 ángulos); ve los videos que más funcionaron de la competencia y los replica con tu oferta. | `/copywriter` (`Copywriter.tsx`, `OutliersCopy.tsx`, `ReplicarPegado.tsx`), `lib/copywriter/` | Escribir: los dos. Replicar un guion: sólo Pro (`lib/copywriter/replica-candado.ts`) | — |
| **Carruseles** | Sí | Explora los carruseles que mejor les funcionan a las cuentas que sigues y arma el tuyo con el mismo diseño, tus textos y tu marca, editable. | `/image-editor` → `app/image-editor/carruseles/` (`ExplorarCarruseles.tsx`, `ReplicarGuiado.tsx`); `lib/carruseles/` | Editor: los dos. Replicar con IA: sólo Pro (`ia-editores`) | Donde el original tiene una persona, su lugar **queda marcado**: la persona generada con IA todavía no está (`lib/carruseles/replica-servidor.ts:247-249`). |
| **Video (edición)** | Sí | Editor tipo CapCut con «Edición automática»: un equipo de agentes corta pausas, subtitula, propone B-roll y nivela el volumen; además «Clips mágicos» (de un video largo, varios cortos). | `/video-editor` (`app/video-editor/_opencut/`, `enjambre/`), candado en `lib/editores-ia-pro.ts` | Editor y subtítulos: los dos. Edición con IA, B-roll y clips: sólo Pro | — |
| **Video (generación)** | A medias | Genera tomas y anuncios con IA **por Google Flow, con la extensión de Chrome y los créditos de Flow del cliente**. | `/video-generator` (`app/video-generator/video-action.ts`, `lib/flow-cola.ts`) | `/planes` promete «10 minutos de video con IA» en Pro | **Generar video pagándolo con MaKo Tokens no está conectado:** `lib/apimart.ts` existe pero ninguna ruta lo importa. Lo admite `lib/planes-comparacion.ts:113-148` («la vitrina promete algo que el producto todavía no entrega»). |
| **AI Avatar** | Existe, **no se vende** | Con una foto tuya arma «looks» y videos estilo UGC con tu cara, por Google Flow + la extensión. | `/ai-avatar` (`app/ai-avatar/Estudio.tsx`, `filmar.ts`, `acceso.ts`) | Cerrado en Essential; `AI_AVATAR_SE_VENDE = false` (`lib/planes-comparacion.ts:110`) | No se vende hasta que ande de punta a punta. La prueba del 10/11 dio 12 fallas en 35 casos (`docs/hallazgos-ai-avatar.md:541`). Aun así, la portada (fila 7) y `/vsl/ai-avatar` lo muestran. |
| **Marketing CoPilot** | Sí | Revisa tus anuncios de Meta cada día y te propone mejoras medidas contra lo que vendiste (apruebas con un toque o lo dejas en piloto), y arma el plan de Instagram y YouTube con tareas semanales. | `/ads-manager/copiloto` (`CoPilot.tsx`), `lib/media-buyer/`, `lib/copiloto/` | Essential: 2 recomendaciones por día, sin piloto. Pro: ilimitadas y piloto de anuncios, Instagram y YouTube | **No crea campañas desde cero** (`lib/planes-mako.ts:180`). **«Cambia tus miniaturas»** (fila 8 de la portada): no encontré código que cambie miniaturas en YouTube; lo que hay es una tarea «Haz la miniatura vertical de tu próximo Short» (`lib/copiloto/tareas.ts:103`). El piloto de YouTube «todavía no tiene nada que configurar» (`lib/copiloto/piloto.ts`). Los Trial Reels sí (vía Zernio, `lib/copiloto/piloto-redes.ts`). |
| **Web Generator** | Sí | Le describes la landing y la diseña, la escribe y la conecta a tu CRM y tu agenda; o pegas el link de una que ya vende y la replica sección por sección con tu oferta. | `/web-generator` (`app/web-generator/crear/CrearConIA.tsx`, `Replicar.tsx`), `lib/editor-landing/` | Essential: 1 landing publicada, sin dominio propio. Pro: ilimitadas, dominio propio y Replicar | — |
| **CRM** | Sí | Tablero por etapas; cada lead trae de qué anuncio vino, sus visitas, cuánto vio del VSL, su recorrido clic por clic y la grabación de su visita. | `/crm` (`CrmBoard.tsx`, `lead-view/ComportamientoCard.tsx`, `GrabacionCard.tsx`, `TrackingTimelineCard.tsx`) | Essential: 2.000 leads y 1 pipeline. Pro: ilimitados | El tracking necesita el píxel de MaKo en la landing; sin él, la ficha dice por qué no hay grabación (`lib/replay-ficha.ts`). |
| **Automations** | Sí | Flujos por WhatsApp, Instagram, Messenger y email (confirmar una reunión, mandar la guía a quien comenta una palabra) y el setter con IA que sigue la charla. | `/automations` (`FlujoLienzo.tsx`), `lib/setter-ia-reglas.ts` | Essential: 2 activas. Pro: ilimitadas y setter con IA | El setter **manda el link de tu agenda**; no reserva él la llamada (`app/accelerator/contenido.ts:190`). |
| **Chats** | Sí | Una bandeja con WhatsApp, Instagram, Messenger y email, la ficha del CRM al lado y MaKo proponiendo qué contestar. | `/chats` (`ChatsApp.tsx`, `ConectarCanal.tsx`) | Essential: 1 WhatsApp. Pro: 3 | WhatsApp se conecta **por QR** (como WhatsApp Web, `ConectarCanal.tsx`). No prometas «API oficial». |
| **Closing** | Sí | Toma las llamadas de tu grabador con su transcripción, separa las de venta de las de servicio y las puntúa con SPIN, marca objeciones con su minuto y deja coaching y seguimiento, en español. | Hoja «Closing» del Dashboard (`/closing` redirige ahí), `lib/closing.ts`, `lib/grabadores/` | Sólo Pro (`TABS_SOLO_PRO`) | Necesita un grabador conectado: Fathom, tl;dv, Fireflies, Zoom u Otter. Google Meet y Read AI dicen «Próximamente». Sin transcripción, no se analiza. |
| **Dashboards** | Sí | Tableros de ventas, anuncios, llamadas, cobranza, VSL y más, listos o pedidos a MaKo, con 44 fuentes de datos. | `/dashboard` (`app/dashboard/`, `lib/graficos-catalogo.ts`) | Los dos, sin tope (la hoja Closing es de Pro) | — |
| **Curso (Classroom)** | Sí | Alojas tu curso con módulos y clases (video subido o de YouTube, Vimeo, Loom, Drive, Panda…); tus alumnos entran por su link y se ve lo que avanza cada uno. | `/classroom`, `app/customer-success/curso/`, `app/compartido/curso/[token]/` | Essential: 1 curso. Pro: ilimitados | — |
| **Comunidad** | Sí | Feed, eventos, miembros y ranking para tus alumnos, al lado del curso. | `/classroom/community`, `app/_comunidad/`, candado `lib/comunidad-solo-pro.ts` | Sólo Pro | — |

---

## 3. Números verdaderos (con su fuente)

| Dato | Valor | Fuente |
|---|---|---|
| MaKo Essential | **US$47/mes**, US$470/año (2 meses gratis) | `lib/planes-mako.ts` (`PLANES_MAKO_DEFAULT`, `MESES_GRATIS_ANUAL`) |
| MaKo Pro | **US$97/mes**, US$970/año | `lib/planes-mako.ts` |
| Prueba gratis | **7 días** en los dos planes, con tarjeta; se cobra el día 8 si no te das de baja | `PRUEBA_DIAS`, `PLANES_CON_PRUEBA`, `PRUEBA_GRATIS_PRENDIDA = true` (`lib/planes-mako.ts`) |
| Lo que se puede crear en la prueba | Hasta 3 videos armados, 30 tomas, 20 imágenes y 1 landing publicada; sin exportar en masa | `TOPES_PRUEBA`, `lib/topes-plan.ts` |
| MaKo Tokens de Essential | **7.000 al mes**: 0 minutos de video, o 580 imágenes, o 770 análisis de competidores, o 630 transcripciones, o 150 páginas de venta escritas con IA | `CUPO_ESSENTIAL_MT` (`lib/mako-tokens-reglas.ts`); las equivalencias, `app/planes/CalculadoraTokens.tsx` (leídas en `/` el 18/11) |
| MaKo Tokens de Pro | **14.400 al mes**: 10 minutos de video, o 1.200 imágenes, o 1.600 análisis de competidores, o 1.300 transcripciones, o 320 páginas de venta | `MINUTOS_DEL_CUPO_PRO = 10` |
| Qué es un MaKo Token | 1.000 MaKo Tokens = US$1 de costo real de IA. Desde el 15/11 **todo** lo que usa IA gasta MaKo Tokens, salvo que el negocio conecte su propia clave | `MT_POR_USD`, `lib/mako-tokens-medidor.ts` |
| Tokens extra | US$1 = 288 MaKo Tokens. Paquetes de US$10, 20, 40 y 100 (2.880 / 5.760 / 11.520 / 28.800). El minuto de video extra sale US$5 | `MT_POR_DOLAR`, `PAQUETES`, `USD_POR_MINUTO_SUELTO` (`lib/mako-tokens-paquetes.ts`) |
| Topes Essential → Pro | Leads 2.000 → ilimitados · pipelines 1 → ilimitados · WhatsApp 1 → 3 · automatizaciones activas 2 → ilimitadas · landings publicadas 1 → ilimitadas · dominio propio no → sí · cuentas de cobro 1 → ilimitadas · personas 1 → 5 · recomendaciones de anuncios por día 2 → ilimitadas · competidores 1 → ilimitados · cursos 1 → ilimitados | `TOPES`, `lib/topes-plan.ts` |
| Sólo en Pro | Copiar landings, replicar guiones, editar con IA (video e imagen), setter con IA, pilotos automáticos, comunidad, chat con referentes, análisis de llamadas, traer contactos de un grupo de WhatsApp | `FUNCIONES_SOLO_PRO`, `TABS_SOLO_PRO` |
| MaKo Accelerator | **US$1.500 por los 3 meses**; se puede pagar en cuotas, pero ninguna página dice cuántas | `PROGRAMA_ACELERADOR` (`lib/planes-mako.ts`) |
| Qué trae el Accelerator | MaKo Pro los 3 meses · hasta 10 horas de Martín la primera semana para armar tu sistema · 3 sesiones 1 a 1 de 2 horas · 12 asesorías grupales en vivo (una por semana) · WhatsApp personal de Martín · comunidad · expertos invitados | `PROGRAMA_ACELERADOR.incluye`, `HORAS_SEMANA_1`, `ASESORIAS_DEL_PROGRAMA` |
| Promesa del Accelerator | «En 90 días, Martín Koncke, el creador de MaKo, te instala el sistema de adquisición de clientes a la medida de tu oferta.» | `PROGRAMA_ACELERADOR.promesa` |
| Garantía del Accelerator | «Si al terminar la primera semana tu sistema de ventas no está armado, te devolvemos lo que pagaste y no pagas nada más.» | `PROGRAMA_ACELERADOR.garantia` |
| Para quién es el Accelerator | Facturas más de US$5.000 al mes, con clientes y oferta validada; servicios, no productos | `FILTRO`, `app/accelerator/contenido.ts` |
| Después del Accelerator | Continuidad, US$297/mes (no está en la vitrina) | `PROGRAMA_ACELERADOR.despues` |
| MaKo Partners | **30% de cada pago** de cada negocio que traes, todos los meses mientras pague; del precio de lista. Cobras del 1 al 5 de cada mes, en dólares por Binance o en pesos. Cualquier plan puede ser partner | `COMISION_PARTNER_DIRECTO = 0.3` (`lib/partners-reglas.ts`), `app/mako-partners/LandingPartners.tsx` |
| Ejemplo de Partners | 10 negocios en Pro = US$291 por mes | `NEGOCIOS_DEL_EJEMPLO = 10` × US$97 × 30% |
| Referentes | **32** (Alex Hormozi, Iman Gadzhi, Vilma Núñez, Juan Osorio, Romuald Fons…) | `ASESORES`, `lib/asesores/catalogo.ts` |
| Copywriting | 15 plantillas con ejemplo · 16 estructuras de guion · 14 ángulos de gancho · 5 tipos de pieza | Contados en `app/vsl/_competencia/copywriting.ts` (leídos en `/vsl/copywriting` el 18/11) |
| Funciones con landing | **24** | `LANDINGS_COMPETENCIA`, `app/vsl/_competencia/registro.ts` |
| Integraciones | **30** que un negocio puede conectar hoy | `integracionesVivas()`, `app/vsl/_sitio/datos.ts` (leído en `/` el 18/11) |
| Fuentes de datos del Dashboard | **44** | `FUENTES`, `lib/graficos-catalogo.ts` (leído en `/vsl/dashboard` el 18/11) |
| Lo que ya pagas | 11 apps = **US$388,98/mes** (GoHighLevel 97, Skool 99, ManyChat 39, Zapier 29,99, Metricool 25, Mailchimp 20, CapCut 19,99, Higgsfield 19, Canva 18, Notion 12, Gamma 10). Con MaKo Pro **te ahorras US$291,98 por mes** | `STACK_TIPICO`, `app/vsl/_sitio/reemplaza.ts` (precios de lista leídos el 13/11), `LoQuePagas.tsx` |
| Apps en la comparación | 53 apps distintas; 21 páginas «MaKo vs X» | `STACK_QUE_REEMPLAZA` (`reemplaza.ts`), `competencia-datos.ts` |
| Caso Mauricio | De meses de menos de US$9k a más de US$100k vendidos; US$14k en abril, US$20k en mayo, más de US$40k en junio; «sin cambiar la oferta ni el funnel» | `CASO`, `app/vsl/_competencia/marca.tsx`. **Es la palabra de Martín**, no sale de un dato del código |
| Mauricio en el Accelerator | Antes cobraba US$300 por cliente; hoy más de US$7.000. Speaker en Cancún frente a más de 100 personas | `MAURICIO`, `app/accelerator/contenido.ts`. Palabra de Martín |
| Trayectoria de Martín | +US$1M generados para sus clientes, +80M de views, +20 nichos | `RESULTADOS`, `app/accelerator/contenido.ts`. Palabra de Martín |

---

## 4. Lo que el VSL nuevo puede prometer sin mentir

- **«El mejor software para vender High Ticket»**, con marketing, ventas y entrega en una sola app (es el titular de
  todo el sitio).
- **MaKo conoce tu negocio:** el Second Brain arma el mapa de tu oferta, tu cliente y tu funnel, y sus chats lo usan.
- **Mira a tu competencia y replica lo que le funciona:** sus reels, videos, landing y los anuncios que guardas de la
  Biblioteca de Meta; replicar guiones, carruseles y landings con tu oferta (**con MaKo Pro**).
- **Chatea con 32 referentes del marketing**, «inspirado en» su método (**con MaKo Pro**).
- **Edita tus videos con IA:** cortes, subtítulos, B-roll y volumen (**con MaKo Pro**; el editor está en los dos).
- **Tu landing en minutos**, conectada a tu CRM y tu agenda.
- **Cada lead trackeado solo:** de qué anuncio vino, cuánto vio tu VSL, qué hizo en tu página.
- **WhatsApp, Instagram, Messenger y email en una sola bandeja**, con MaKo proponiendo qué contestar.
- **Automatizaciones** que confirman reuniones y mandan tu guía por DM; **setter con IA** que sigue la charla y manda tu
  agenda (**con MaKo Pro**).
- **Tus anuncios de Meta revisados cada día**, medidos contra lo que vendiste; tú apruebas o lo dejas en piloto
  (**el piloto, con MaKo Pro**).
- **Cada llamada de venta analizada con SPIN**, con sus objeciones y su minuto, en español (**con MaKo Pro**, con tu
  grabador conectado).
- **Tus números en tableros** listos o pedidos a MaKo.
- **Tu curso en MaKo**, y tu comunidad (**con MaKo Pro**).
- **Precios:** US$47 y US$97 al mes, **7 días gratis**, te das de baja cuando quieras. Lo que se hace con IA gasta
  MaKo Tokens: 7.000 y 14.400 al mes, y puedes comprar más.
- **«Con lo que pagas por GoHighLevel tienes MaKo Pro»** (US$97 contra US$97) y el ahorro de US$291,98 contra 11 apps.
- **El caso de Mauricio**, con sus números, dicho como su historia.
- **El Accelerator:** US$1.500 por 3 meses, por aplicación, con la promesa y la garantía de la semana 1, tal cual están.
- **Partners:** el 30% de lo que paga cada negocio que traes, todos los meses.

## 5. Lo que NO debe prometer

- **AI Avatar como algo que se compra.** Está cerrado para la venta (`AI_AVATAR_SE_VENDE = false`). Si el personaje
  animado del VSL se hizo con IA, no digas que MaKo lo hace hasta que Martín lo prenda.
- **«Generas videos e imágenes con tus MaKo Tokens».** Hoy el video sale por Google Flow con los créditos del cliente, y
  ninguna ruta genera imágenes o video cobrando MaKo Tokens. `/planes` ya lo dice; el VSL no debería repetirlo.
- **Que el Essential (US$47) genera video.** No lo hace (`GENERA_VIDEO`: 0 minutos).
- **«Ilimitado» de algo que gasta tokens**, ni «gratis» de lo que cuesta. Ilimitado sólo lo que no tiene tope en Pro
  (leads, landings, automatizaciones, competidores, cursos). «Gratis» sólo la prueba de 7 días.
- **Que MaKo crea tus campañas de Meta.** Revisa y mejora; crear desde cero ya no existe.
- **Que cambia solo tus miniaturas de YouTube.** No encontré ese código; hay una tarea para hacerla.
- **Que el setter agenda la llamada por ti.** Manda el link de tu agenda.
- **Que los anuncios de la competencia llegan solos.** Se guardan con la extensión desde la Biblioteca de Meta.
- **«API oficial de WhatsApp».** Se conecta por QR.
- **Que Hormozi u otros referentes participan.** Es «inspirado en».
- **Agendar una llamada** fuera del Accelerator. El único CTA es la prueba gratis.
- **El 50% del primer mes.** Depende de una variable de entorno (`PROMO_ENTRADA_ACTIVA`) y no va junto con la prueba
  gratis (`lib/planes-mako.ts:119`). Desde el código no se sabe si está prendido.
- **Cuotas del Accelerator** con número («3 cuotas de 500»): Martín lo sacó de todos lados.
- **Testimonios o números de uso inventados.** El único caso del sitio es Mauricio. Los números de la trayectoria de
  Martín son su palabra, no un dato del producto.
- **Que la IA corre en tu propia cuenta de Claude o ChatGPT.** La pregunta frecuente «¿Qué pasa con los datos de mis
  clientes?» (`app/vsl/_sitio/preguntas.ts`) todavía lo dice, pero desde el 15/11 por defecto todo pasa por MaKo Tokens;
  conectar tu clave es una opción.

---

## 6. Trampas para quien siga

- **Los guiones viejos de `docs/vsl/` están desactualizados.** `principal.md` cierra con «Agenda tu diagnóstico gratis» y
  empuja el Accelerator por llamada; hoy el CTA es la prueba gratis y la agenda sólo existe después de aplicar al
  Accelerator. Sus landings (`/vsl/crear-landings`, `/vsl/automatizaciones`…) no son las rutas de hoy.
- **El VSL que se cambie en la portada cambia también `/planes` y las 3 de industria:** las cinco usan `VSL_PORTADA`
  (`app/vsl/_sitio/vsl-portada.ts`). Las de industria lo traen pegado en su documento de Web Generator (en la base),
  así que **ahí hay que cambiarlo a mano**, desde Web Generator.
- **Las cifras que se cuentan solas (30 integraciones, 44 fuentes, 15 plantillas) se leyeron en producción**: el worktree
  no tiene `node_modules` para correrlas. Si el VSL las dice, revísalas el día que se grabe.
- **El comentario de `TARJETAS_PORTADA` cuenta 14 filas y son 16.**
- **AI Avatar dice dos cosas a la vez:** la portada y su landing lo muestran, y la vitrina no lo vende. Es una decisión de
  Martín, no un error de código.
