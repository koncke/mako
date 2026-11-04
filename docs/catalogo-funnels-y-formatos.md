# Catálogo de funnels y formatos para Competitors Spy

> **Para qué:** que Spy diga **qué funnel usa un competidor** y **qué formatos de contenido le funcionan**, a partir de sus
> piezas públicas (reels y carruseles de Instagram con su caption y su bio, videos de YouTube con título y descripción, el
> texto de sus webs, sus páginas de enlaces —linktr.ee, beacons, stan.store— y sus anuncios de la Biblioteca de Anuncios de
> Meta). Pedido de Martín (4/11/2026): «una investigación profunda de todos los tipos de formatos y funnels para poder
> clasificar bien».
>
> **Cómo se armó (4/11/2026):** búsqueda web en inglés, español y portugués sobre las taxonomías de funnels para coaches,
> infoproductos y marca personal, y sobre formatos de contenido corto. ⚠️ Desde esta sesión no se pudieron abrir las
> páginas (la red sólo dejó usar el buscador), así que cada definición sale de lo que el buscador resume de la página
> citada, no de leerla entera. La mayoría de las fuentes son blogs de proveedores (ClickFunnels, ManyChat, EasyWebinar,
> ScoreApp…): sirven para **definir** cada tipo, no para medir nada. Este documento no trae ni una tasa de conversión, a
> propósito.

---

## 1. La regla: se clasifica con evidencia citada; sin evidencia, «no sé»

Un funnel no se adivina por el nicho ni por la fama. Que alguien sea «speaker» no dice que venda eventos; que venda un
programa caro no dice que use llamadas. **Spy afirma un funnel sólo si puede citar la pieza y la frase (o el dominio) que
lo prueba.** Si no hay evidencia, la respuesta es «no sé», y eso es distinto de «no usa funnels».

**Qué es evidencia:** una tupla `{pieza, lugar, lo que dice}`: el reel con su id y la frase literal del caption, el botón de
su página de enlaces con su texto y su URL, el anuncio con su texto y su dominio de destino, la landing con la frase y el
host del formulario o del checkout.

**Fuerte, débil y lo que descarta:**

| Tipo de señal | Qué alcanza | Ejemplo |
|---|---|---|
| **FUERTE** | Una sola, citada, alcanza para afirmar el funnel | un botón que lleva a una ticketera (`passline.com/…`); «comenta GUÍA y te la envío por DM» |
| **DÉBIL** | Hacen falta **2 o más distintas**, idealmente de **2 piezas distintas** (o una débil + una fuerte de otro funnel que la ubique) | «evento», «en vivo», «masterclass» |
| **DESCARTA** | Si aparece en la MISMA pieza, baja la fuerte de esa pieza a débil para ese funnel | «por Zoom» al lado de «masterclass» descarta lo presencial de esa pieza |

**Vigente o histórico.** Una fecha ya pasada o un anuncio inactivo prueban que **lo usó**, no que lo use hoy. La salida
marca cada funnel como `vigente` (anuncio activo, fecha futura, botón en la bio de hoy) o `historico`.

**Puede tener varios.** Un competidor suele correr dos o tres a la vez (contenido con «comenta X» → lead magnet → llamada;
y un evento al año). Se devuelve una lista, cada uno con su evidencia, ordenada por fuerza y por vigencia. «El principal»
es el de más evidencia vigente; si empatan, se dicen los dos.

**Dos ejes: la puerta y el cierre.** Casi todo funnel es una **puerta** (cómo capta: comentario, anuncio, lead magnet,
reto, webinar, evento) seguida de un **cierre** (dónde cobra: checkout, llamada, sala del evento, membresía). Conviene que
el código pueda decir los dos cuando los ve («reto → llamada»), y que no invente el que no ve.

| Puerta \ Cierre | Checkout | Llamada (closer) | En la sala | Membresía |
|---|---|---|---|---|
| Comentario/DM (palabra clave) | low ticket | dm-setter, agenda | — | comunidad |
| Webinar (en vivo o automatizado) | oferta en la clase | aplicación | — | — |
| Reto | oferta del día 5 | aplicación | — | comunidad |
| Evento presencial | entrada pagada | — | **venta en sala** | — |
| Lead magnet / quiz | secuencia → oferta | agenda | — | — |

**Cómo se compara el texto (para el código):**
- Todo se normaliza a minúsculas y sin tildes antes de comparar; las frases del apéndice se escriben con tildes.
- Los límites de palabra van por Unicode (`(?<!\p{L})…(?!\p{L})`), nunca `\b`: con `\b` una frase que termina en vocal
  acentuada no matchea nunca (regla de AGENTS.md, voseo).
- La normalización sin tildes ya junta casi todas las formas neutras y rioplatenses de un imperativo («compra», «agenda», «aplica»,
  «reserva»). Las que cambian una letra (las rioplatenses de «inscríbete», «escríbeme», «únete», «súmate», «anótate») no
  las junta: el código las genera desde el infinitivo, como `lib/voseo.ts`, en vez de escribirlas a mano. Importa: el caso
  de referencia de este documento es argentino.
- Cada funnel lleva sus frases en inglés: hay competidores que escriben en los dos idiomas.
- Un host se compara por dominio registrable; una marca con varios dominios de país se escribe con su raíz y un punto
  (`eventbrite.` cubre `eventbrite.com.mx`, `eventbrite.es`…). Lo que ya lee `lib/spy-funnel.ts` (los checkouts y los
  reproductores de video de la web) es evidencia directa: no se vuelve a detectar con frases.

**Dónde pesa más cada lugar:** la **landing** dice el recorrido; los **anuncios activos** dicen lo que empuja hoy; la **bio y
la página de enlaces** dicen su puerta principal (cada botón es una puerta: se lee su texto y su host); los **captions**
dicen sus llamados a la acción repetidos. Una página de enlaces por sí sola no es un funnel: son sus botones los que dicen.

**Lo que NO es evidencia de funnel:** «link en mi bio» solo (dice que hay una puerta, no cuál); «sígueme»; un código de
descuento de una marca ajena (es patrocinio); un sorteo («boletos» de una rifa); la cantidad de seguidores; una nota de
prensa sobre esa persona (no es una pieza suya).

---

## 2. Funnels

### 2.1 Evento presencial (`evento-presencial`)

**Qué es.** Se vende una entrada a un evento en un lugar físico (seminario, conferencia, taller, «experiencia»), y ahí
—en la sala o en los días siguientes— se vende el programa principal, la mentoría o la entrada VIP de la próxima edición.
En la práctica de alto precio, el salón hace buena parte de la venta y la entrada suele cubrir los costos del lugar
([The Profit Partner](https://theprofitpartner.substack.com/p/room-vs-funnel),
[Medium/Webfriendly](https://medium.com/webfriendly/how-to-sell-out-an-event-with-a-sales-funnel-52ae1c284eaa),
[Entrepreneur](https://www.entrepreneur.com/growing-a-business/how-we-sold-out-our-live-event-in-just-60-days/502263),
[James Schramko](https://www.jamesschramko.com/playbooks/live-event-sales/)).

**Recorrido.** contenido o anuncio → página del evento (qué es, fecha, ciudad, sede, speakers, agenda, entradas por nivel)
→ compra de la entrada (ticketera o checkout propio) → recordatorios → el evento → oferta en la sala (programa, mentoría,
VIP) → recap en redes que vende la próxima edición. Una página de evento lleva casi siempre **fecha, lugar, agenda,
speakers y niveles de entrada** (preventa/early bird, general, VIP)
([Zoho Backstage](https://www.zoho.com/backstage/event-website-guide.html),
[Dryfta](https://dryfta.com/10-things-to-include-in-your-event-landing-page/),
[Xtix](https://xtix.ai/blog/event-landing-page-best-practices-aboveatheafold-elements-that-drive-buys)).

**Señales.**
- **Web/landing.** FUERTE: un enlace o formulario de una **ticketera** (lista en el apéndice); «comprar entradas», «comprar
  boletos», «compra tu entrada», «get tickets», «buy tickets»; **sede/lugar + fecha** en la misma página («sede», «lugar del
  evento», «dirección», «auditorio», «centro de convenciones», «salón», «hotel», «teatro», «venue»); niveles de entrada con
  precio («preventa», «general», «vip», «platinum», «backstage») en la misma página que una sede; un enlace a un mapa
  (`maps.app.goo.gl`, `google.com/maps`, `waze.com`); «evento presencial», «100 % presencial», «in person». DÉBIL:
  «evento», «conferencia», «seminario», «congreso», «experiencia», «speakers», «agenda», «networking», «edición 2026»,
  «early bird» (también se usa para programas online), «cupo limitado», «aforo».
- **Bio / página de enlaces.** FUERTE: un botón a una ticketera; un botón que dice «entradas», «boletos», «tickets»,
  «🎟»; «próximo evento: [ciudad] [fecha]». DÉBIL: «speaker», «conferencista», «creador/a de [nombre del evento]», el
  nombre de un evento con año.
- **Captions/títulos.** FUERTE: «entradas agotadas», «boletos agotados», «últimas entradas», «quedan pocas entradas», «nos
  vemos en [ciudad]», «gracias [ciudad]», «abrimos la venta de entradas», «preventa de entradas»; un **recap del evento**
  (formato `recap-evento`) con fecha o ciudad. DÉBIL: «sold out» y «agotamos» (también se dicen de un programa online),
  «agotado» suelto (también es «cansado»), «escenario», «subí al escenario», «gira», «tour», «en vivo» (ambiguo),
  «primera edición», «la próxima edición».
- **Anuncios.** FUERTE: destino en una ticketera o en la página del evento; texto con fecha + ciudad + entradas; botón de
  entradas (en la Marketing API figura como `BUY_TICKETS`; **no verificado** en esta búsqueda). DÉBIL: texto que nombra un
  evento sin fecha ni lugar.

**Señales compuestas (las arma el código, no son frases):** `fecha` (día + mes, o dd/mm) **+** `ciudad o sede` **+**
(`entradas` | `boletos` | `tickets` | `preventa` | `vip`) en la misma pieza ⇒ FUERTE.

**Descarta (en la misma pieza):** «online», «en línea», «virtual», «por zoom», «desde tu casa», «desde donde estés», «link de
acceso», «transmisión», «replay», «grabación». Con «presencial y online», «modalidad híbrida» o «streaming» además de una
sede ⇒ se clasifica `evento-presencial` con la nota «híbrido».

**Se confunde con.** «Masterclass», «taller», «workshop» y «clase en vivo» pueden ser online: sin sede, no es presencial.
«Entradas» también son las entradas de un blog, y «boletos», los de una rifa. Eventbrite y Luma publican eventos en línea
igual que presenciales: el dominio de la ticketera es fuerte **para «vende entradas»**, y la sede o el «en línea» de esa
misma página deciden cuál de los dos. Un congreso presencial con muchos speakers no es un `summit-virtual`.

**Caso de referencia: Den Borg** (speaker y mentora de marca personal, Argentina). Según la prensa, creó el primer evento de
marcas personales de Argentina y su primera edición agotó las entradas
([Forbes Argentina](https://www.forbesargentina.com/liderazgo/la-marca-personal-tambien-construye-fuera-redes-n93196);
la nota no se pudo abrir desde esta sesión, se cita el resumen del buscador; no se encontró el nombre del evento). Para
Spy eso **no es evidencia**: es una nota de prensa. Lo que Spy tiene que encontrar en SUS piezas es lo de arriba: un
botón de su bio o de su página de enlaces a una ticketera o a la página del evento; captions con «entradas agotadas»,
«últimas entradas», «nos vemos el [fecha] en [ciudad]»; reels de recap con escenario y público; anuncios que lleven a la
venta de entradas. Con cualquiera de las fuertes, `evento-presencial`; con dos débiles de piezas distintas («sold out» en
una, «primera edición» o «escenario» en otra), también; sin nada de eso, «no sé», aunque «todo el mundo sepa» que hace
eventos.

### 2.2 Mastermind o retiro (`mastermind-retiro`)

**Qué es.** Grupo chico y caro, con encuentros presenciales de varios días (retiro, inmersión) o llamadas grupales, al que se
entra **por aplicación**, no con un botón de compra
([Membership.io](https://membership.io/blog/high-ticket-coaching-funnel-the-call-first-playbook),
[Cohere](https://mastermind.cohere.live/)).

**Recorrido.** contenido → página del programa → aplicación (formulario) → llamada o entrevista → pago → encuentros.

**Señales.** Web/landing FUERTE: «mastermind» + «aplica»/«aplicación»; «retiro» o «retreat» + fechas + lugar
(«hospedaje», «todo incluido», «habitación», «villa», un destino); «solo por aplicación», «application only»,
«by invitation». DÉBIL: «grupo reducido», «cupos limitados», «intensivo», «inmersión», «círculo», «cohorte». Bio y captions:
las mismas; anuncios: rara vez se anuncia. **Se confunde con** `aplicacion-llamada` (el mastermind es el producto que esa
llamada vende) y con `evento-presencial` (un retiro no vende entradas sueltas: hay aplicación).

### 2.3 Webinar en vivo (`webinar-en-vivo`)

**Qué es.** Una clase en vivo, gratuita, con registro previo y fecha y hora fijas; al final se presenta la oferta (compra
directa o agendar llamada)
([HeroSpark](https://herospark.com/guias/webinar), [EasyWebinar](https://easywebinar.com/blog/coaching-sales-funnel/),
[Avit Marine](https://www.avitmarine.com/webinars-vs-vsls-what-s-the-best-funnel-for-coaches-service-businesses-in-2025.html)).

**Recorrido.** anuncio o contenido → página de registro (título, fecha, hora con zona horaria) → página de gracias (suele
mandar a un grupo de WhatsApp o Telegram para recordatorios) → la clase (Zoom, YouTube Live, StreamYard) → oferta con plazo
→ repetición por tiempo limitado.

**Señales.** Web/landing FUERTE: registro con **fecha y hora** + («regístrate», «reserva tu lugar», «inscríbete gratis»)
**sin sede**; «clase en vivo gratuita», «masterclass gratuita en vivo», «webinar gratuito», «free live training», «free
webinar»; hosts de webinar (`zoom.us/webinar/register`, `event.webinarjam.com`, `livestorm.co`, `demio.com`,
`streamyard.com`, `crowdcast.io`, `bigmarker.com`, `gotowebinar.com`; los dominios, no los formatos exactos de sus URL,
que no se verificaron). DÉBIL: «reserva tu lugar», «regístrate gratis», «save your seat», «register now» (las cuatro
también están en eventos presenciales), «masterclass», «clase gratuita», «taller online», «live workshop», «en vivo»,
«live», «hora méxico», «hora colombia», «hora argentina», «hora españa», `chat.whatsapp.com`. DESCARTA: una sede o
«presencial» en la misma página. Captions FUERTE: «regístrate a mi clase en vivo», «clase gratuita en vivo este [día]». DÉBIL: «este
jueves en vivo» (puede ser un directo de Instagram), «link de registro en mi bio». Anuncios FUERTE: destino en una página de registro con fecha; botón «Registrarte»/«Sign up» (verificado en
[SaveMyLeads](https://savemyleads.com/blog/other/what-call-to-action-buttons-are-available-in-meta-ads-manager)).

**Se confunde con** `webinar-automatizado` (horario fijo vs «elige tu horario»), `evento-presencial` (falta sede),
`lanzamiento` (varias clases con carrito que se abre y se cierra) y `reto` (varios días).

### 2.4 Webinar automatizado o evergreen (`webinar-automatizado`)

**Qué es.** Una grabación que se emite como si fuera en vivo, en sesiones que arrancan cada pocos minutos o a pedido
(«just in time», repetición instantánea, horarios recurrentes)
([EasyWebinar, ayuda](https://support.easywebinar.com/en/articles/6986089-how-to-set-up-just-in-time-webinars-and-instant-replays),
[Contrast](https://www.getcontrast.io/learn/automated-webinar-funnels), [Growbo](https://www.growbo.com/automated-webinars)).

**Señales.** Web/landing FUERTE: un selector de sesión («elige tu horario», «elige el horario», «próxima sesión en»,
«comienza en 15 minutos», «sesiones cada», «instant replay», «just in time»); hosts `everwebinar.com`, `easywebinar`,
`stealthseminar`. DÉBIL: «ver ahora», «watch now», «on demand» (son botones de cualquier video); una «clase gratuita» sin
fecha y siempre disponible; «acceso inmediato» con registro. **Se confunde con** `clase-gratis` (no
hay sesiones: se mira cuando quieras) y con `vsl-*` (un VSL está en la misma página, sin registro).

### 2.5 VSL → llamada (`vsl-llamada`)

**Qué es.** Página con un video de ventas (VSL) que termina en «agenda tu llamada», con el calendario en la misma página o
en la siguiente ([Avit Marine](https://www.avitmarine.com/webinars-vs-vsls-what-s-the-best-funnel-for-coaches-service-businesses-in-2025.html),
[Webtonic](https://www.webtonic.io/blog/high-ticket-agency-funnel)).

**Señales.** Web/landing FUERTE: video principal + calendario (`calendly.com`, `cal.com`, `api.leadconnectorhq.com`, …) o
«agenda tu llamada»/«book a call» en la misma página; «mira este video antes de agendar». DÉBIL: «agenda tu llamada» o
«book a call» sin video (eso es `agenda-directa`), «mira este video», «watch the video», «sesión estratégica», «llamada de
diagnóstico», «sesión de claridad», «evaluación gratuita». **Se distingue** de
`aplicacion-llamada` por el formulario: si hay preguntas de calificación antes del calendario, es `aplicacion-llamada`
(con la nota «con VSL»).

### 2.6 VSL → compra directa (`vsl-compra`)

**Qué es.** Video de ventas + botón de compra a un checkout, con el precio a la vista; a veces el botón aparece después de
cierto minuto del video.

**Señales.** Web/landing FUERTE: un **checkout** de los que lee `lib/spy-funnel.ts` (Hotmart, Kiwify, Stripe, Mercado Pago,
Kajabi, Gumroad, ThriveCart, SamCart…) en una página con video; «comprar ahora», «quiero acceso», «inscríbete ahora»,
«garantía de 7 días», «garantía de devolución», «buy now». DÉBIL: «oferta especial», «precio de lanzamiento», «solo
hoy», «bonos», «acceso de por vida», «por solo». Sin video es una página de ventas: se clasifica igual, con la nota «sin
VSL». **Se confunde con** `low-ticket` (precio bajo + oferta añadida en el checkout), con `tienda` («comprar ahora» sobre un
catálogo) y con `lanzamiento` (si el carrito tiene fecha de cierre).

### 2.7 Aplicación + llamada, alto precio (`aplicacion-llamada`)

**Qué es.** Un formulario de calificación («aplica») antes de una llamada de venta con un closer; es el funnel de las
ofertas caras (mentorías, programas, done-for-you). El orden típico es VSL o webinar → aplicación → calendario
([ClickFunnels, tipos de funnel](https://support.myclickfunnels.com/docs/understanding-funnel-types-in-clickfunnels/),
[Membership.io](https://membership.io/blog/high-ticket-coaching-funnel-the-call-first-playbook)).

**Señales.** Web/landing FUERTE: «aplica aquí», «aplica ahora», «solicita tu lugar», «postúlate», «completa la
aplicación», «apply now»; un formulario (`typeform.com`, `tally.so`, `jotform.com`, `forms.gle`) seguido de un calendario;
«revisamos cada aplicación». DÉBIL: «aplica» suelto, «application» (también es «app»), «no es para todos», «solo trabajamos
con», «mentoría 1:1», «programa de acompañamiento», «high ticket», «trabajemos juntos», «cupos por mes». Bio FUERTE: «aplica a mi mentoría» con enlace a un
formulario. Anuncios: «Solicitar»/«Apply now» (en la API de Meta, `APPLY_NOW`, **no verificado**).

### 2.8 Agenda directa (`agenda-directa`)

**Qué es.** Un enlace directo al calendario para una llamada gratuita (consulta, diagnóstico, «discovery call»), sin video
ni aplicación larga: la llamada misma califica
([AttractWell](https://blog.attractwell.com/blog/discovery-call-setup-for-coaches),
[LeadQuizzes](https://www.leadquizzes.com/discovery-call-booking-funnel/)).

**Señales.** FUERTE en cualquier lugar: un enlace de calendario (`calendly.com`, `cal.com`, `tidycal.com`, `savvycal.com`,
`as.me`, `acuityscheduling.com`, `meetings.hubspot.com`, `calendar.app.google`, `youcanbook.me`, `zcal.co`,
`oncehub.com`); «agenda tu llamada gratis», «reserva tu sesión», «consulta gratuita», «llamada de descubrimiento», «book a
free call», «free consultation». DÉBIL: «llamada», «sesión», «agenda», «diagnóstico». Anuncio: botón «Reservar»/«Book now».

### 2.9 Conversación por DM con setter (`dm-setter`)

**Qué es.** El contenido invita a escribir por mensaje; un «setter» conversa, califica y agenda la llamada de venta con un
closer. No se vende en el DM ([Setsmart](https://setsmart.io/blog/high-ticket-coaching),
[Setsmart, funnels](https://setsmart.io/blog/sales-funnel-for-coaches)).

**Señales.** Casi todas DÉBILES desde afuera (no se ve si contesta una persona o un bot): «escríbeme», «envíame un
mensaje», «mándame un DM», «DM para info», «hablemos», «DM me», «send me a message»; enlaces `ig.me/m/…`, `m.me/…`. Se
afirma con 2+ de esas **y** alguna señal de llamada (agenda, «sesión»). **Se distingue** de `dm-palabra-clave` porque no pide
una palabra exacta.

### 2.10 DM por palabra clave, estilo ManyChat (`dm-palabra-clave`)

**Qué es.** La pieza pide **comentar o escribir una palabra exacta**, y una automatización (ManyChat u otra) manda por DM el
enlace (guía, clase, registro). La respuesta pública al comentario y el DM con el enlace salen solos
([ManyChat](https://manychat.com/blog/the-ultimate-guide-for-instagram-comment-automation/),
[ManyChat, creadores de cursos](https://manychat.com/blog/how-course-creators-use-instagram-dm-automation/),
[ManyChat ES](https://manychat.com/blog/es/como-empezar-con-la-automatizacion-de-dms-de-instagram-4-automatizaciones-que-necesitas-🤩-2/),
[Blabla](https://blabla.ai/es/blog/instagram-comment-to-dm-automation)).

**Señales.** Captions FUERTE: «comenta [PALABRA]», «comenta la palabra», «escribe [PALABRA] en los comentarios», «déjame
[PALABRA] en comentarios», «escríbeme [PALABRA] por DM», «te lo envío por DM», «te llega por mensaje», «comment
[WORD]», «DM me [WORD]»; una palabra en MAYÚSCULAS o entre comillas pegada a «comenta». DÉBIL: «por DM», «te lo
mando», «link por mensaje». ⚠️ «Escribe en los comentarios qué opinas» **no** es esto: sin una palabra exacta es un
pedido de interacción. **Es una puerta:** lo que se manda (un lead magnet, un registro) es otro funnel, y se clasifica
aparte sólo si se ve.

### 2.11 Conversación por WhatsApp (`whatsapp-conversacional`)

**Qué es.** Un anuncio o un enlace abre un chat de WhatsApp donde se vende, se agenda o se manda el pago; en
Latinoamérica es muy común ([360dialog](https://360dialog.com/blog/click-to-whatsapp-ads),
[ManyChat](https://manychat.com/blog/how-to-create-a-whatsapp-sales-funnel/)).

**Señales.** FUERTE: `wa.me/…`, `api.whatsapp.com/send`, `whatsapp.com/send` en la bio, la web o el destino de un anuncio;
anuncio «clic para enviar mensaje» (botón «Enviar mensaje de WhatsApp», **no verificado**). DÉBIL: «escríbenos por
WhatsApp», «info por WhatsApp», «whatsapp». **No confundir:** `chat.whatsapp.com/…` es la invitación a un GRUPO (va con
`lanzamiento`, `webinar-en-vivo` o `comunidad`), y `whatsapp.com/channel/…` es un canal de difusión.

### 2.12 Reto o challenge (`reto`)

**Qué es.** Un evento gratuito (o barato) de varios días, casi siempre 3 a 5, con una tarea por día en un grupo (Facebook,
WhatsApp, Telegram) o por email; la oferta principal se presenta al final, típicamente el último día
([ClickFunnels](https://support.myclickfunnels.com/docs/understanding-funnel-types-in-clickfunnels/),
[Course Coach](https://course-coach.pages.dev/courses/challenge-funnels/),
[Content Sparks](https://contentsparks.com/run-a-5-day-challenge)).

**Señales.** FUERTE: «reto gratuito», «únete al reto», «inscríbete al reto», «día 1 del reto», y con registro: «reto de [N]
días», «challenge de [N] días», «[N]-day challenge», «desafío de [N] días»; página de registro con fechas de inicio y fin.
DÉBIL: «reto», «desafío», «challenge», «días», un grupo `chat.whatsapp.com` o `facebook.com/groups`. **Se confunde con**
`lanzamiento` (un reto puede ser el vehículo de un lanzamiento: se dicen los dos) y con un «reto de 30 días» de
contenido, sin registro ni oferta (es un formato, no un funnel).

### 2.13 Lanzamiento con secuencia de videos (`lanzamiento`)

**Qué es.** Una ventana de venta corta (el «carrito abierto», de días) precedida por contenido gratuito, típicamente una
serie de tres videos o clases (el «contenido de prelanzamiento», CPL), según la fórmula de Jeff Walker y su versión
brasileña de Érico Rocha (con sus variantes: semilla, interno, externo, relámpago, perpetuo)
([Smart Passive Income, entrevista a Walker](https://www.smartpassiveincome.com/?p=6372),
[Cooler Insights](https://coolerinsights.com/?p=634),
[Hotmart, tipos de lanzamiento](https://hotmart.com/pt-br/blog/tipos-de-lancamento-digital),
[Neil Patel BR](https://neilpatel.com/br/blog/formula-de-lancamento/)). En español, los lanzamientos se agrupan por su
«evento»: webinar, reto, evento virtual o VSL ([Benchmark](https://www.benchmarkemail.com/es/blog/tipos-funnel-de-marketing/)).

**Señales.** FUERTE: «carrito abierto», «abrimos
inscripciones», «inscripciones abiertas», «cierre de inscripciones», «últimas horas para inscribirte», «inscripciones
cerradas», «lista de espera», «próxima apertura», «cart open», «doors open», «doors close», «waitlist»; un «grupo VIP» de
WhatsApp para el lanzamiento. DÉBIL: una serie numerada («clase 1», «clase 2», «clase 3», «video 1 de 3», «aula 1»: también
puede ser contenido suelto), «cpl», «lanzamiento», «muy pronto», «se viene algo grande», «preventa». **Es una ventana, no
un vehículo:** se informa junto con el vehículo que se vea (webinar, reto, clase gratis).

### 2.14 Clase gratis, mini curso o serie de videos (`clase-gratis`)

**Qué es.** Acceso gratuito a una clase grabada, a una serie corta de videos (suelen ser tres) o a un mini curso por email,
sin fecha ni sesiones, que termina en una oferta ([Zenler](https://www.zenler.com/blog/video-series-funnel-evergreen-workshop),
[Funnelytics](https://funnelytics.io/blog/mini-class-funnel)).

**Señales.** FUERTE: «clase gratuita» + «acceso inmediato»/«mírala ahora»; «mini curso gratis», «curso gratuito»,
«entrenamiento gratuito», «serie de 3 videos», «free training», «free mini course», «free video series». DÉBIL: «gratis»,
«clase», «aprende gratis». **Se confunde con** `webinar-automatizado` (ése tiene sesiones) y con `lanzamiento` (ése cierra).

### 2.15 Lead magnet → email (`lead-magnet`)

**Qué es.** Un recurso gratis (guía, plantilla, checklist, ebook, PDF) a cambio del email o el WhatsApp; después, una
secuencia de correos y una oferta. Página de captura, página de gracias que entrega y propone el siguiente paso, secuencia
([Kajabi](https://www.kajabi.com/blog/lead-magnet-funnel), [OptinMonster](https://optinmonster.com/what-is-a-lead-magnet/),
[ClickFunnels, lead squeeze](https://support.myclickfunnels.com/docs/understanding-funnel-types-in-clickfunnels/)).

**Señales.** FUERTE: «descarga gratis», «descárgala gratis», «guía gratuita», «plantilla gratis», «checklist gratis», «ebook
gratis», «pdf gratis», «te lo envío a tu correo», «free download», «free guide», «free template»; un formulario de email con
un host de email marketing (`kit.com`, `ck.page`, `convertkit.com`, `mailchi.mp`, `eepurl.com`, `flodesk.com`,
`mailerlite.com`, `activehosted.com`, `systeme.io`). DÉBIL: «gratis», «recurso», «regalo», «freebie». **Muchas veces llega por
`dm-palabra-clave`**: se informan los dos.

### 2.16 Quiz o test (`quiz`)

**Qué es.** Un cuestionario (de 5 a 50 preguntas) con una página de resultados según el puntaje o el perfil, y el siguiente
paso según ese resultado ([ScoreApp](https://www.scoreapp.com/?p=29803),
[Perspective](https://www.perspective.co/article/scoreapp-alternative),
[involve.me](https://www.involve.me/involveme-vs-scoreapp)).

**Señales.** FUERTE: «haz el test», «responde el quiz», «descubre qué tipo de», «qué tipo de [x] eres», «test gratuito»,
«scorecard», «take the quiz»; hosts `scoreapp.com`, `tryinteract.com`, `outgrow.co`, `involve.me`. DÉBIL: «descubre»,
«test», «evaluación gratuita» (también es una llamada), «find out your», «diagnóstico en 2 minutos», `typeform.com`
(también es de aplicaciones). **Se confunde con** `aplicacion-llamada`: el quiz devuelve un resultado; la aplicación, una llamada.

### 2.17 Comunidad o membresía (`comunidad`)

**Qué es.** Una comunidad gratuita como puerta (o paga como producto, con cuota mensual), con aula y feed en el mismo lugar;
la gratuita alimenta a la paga o a una oferta cara ([Skoolprep](https://skoolprep.com/what-is-a-skool-community),
[Skoolprep, vender sin webinars](https://skoolprep.com/how-to-sell-your-course-without-webinars-funnels-or-ads),
[Skool Help](https://skool-help.pages.dev/blog/how-to-price-your-skool-community)).

**Señales.** FUERTE: `skool.com/…`, `circle.so`, `mn.co` (Mighty Networks), `discord.gg`, `discord.com/invite`, `t.me/…`
en la bio o la web; «únete a mi comunidad», «comunidad gratuita», «membresía», «suscripción mensual», «join my community», «free
community». DÉBIL: «comunidad», «tribu», «club», «miembros», «al mes» con precio (también es un plan de pagos),
`chat.whatsapp.com`.

### 2.18 Low ticket o tripwire → upsell (`low-ticket`)

**Qué es.** Un producto barato de compra inmediata (taller, plantilla, mini curso, reto pago) con oferta añadida en el
checkout (order bump) y ofertas después de pagar (upsell, downsell) que llevan al producto mayor; si lo que entra cubre la
pauta, se le dice oferta autoliquidable ([Systeme](https://systeme.io/learn/tripwire-funnel/),
[OptinMonster](https://optinmonster.com/how-to-create-a-tripwire-funnel/),
[The Art of Online Business](https://theartofonlinebusiness.com/why-your-self-liquidating-offer-isnt-paying-for-itself-yet/)).

**Señales.** FUERTE: un checkout con precio bajo + «agrega también», «oferta única», «solo en esta página», «one time
offer», «upgrade». DÉBIL: «taller de [precio]», «por solo», «a solo», «menos de lo que cuesta un café», «precio especial»,
«oferta», `stan.store`, `gumroad.com`, `payhip.com`, `whop.com`. ⚠️ Comparar precios entre monedas no es
trivial: «bajo» se decide con la moneda y el mercado, y si no se puede, el precio se cita sin calificarlo.

### 2.19 Cumbre virtual o summit (`summit-virtual`)

**Qué es.** Un evento online de varios días con muchos expertos que lo difunden a su público; el registro es gratis y se
vende el «pase de acceso total» a las grabaciones ([ClickFunnels, summit](https://support.myclickfunnels.com/docs/how-to-create-a-summit-funnel/),
[Membership.io](https://membership.io/blog/virtual-summits-how-to-use-one-to-fill-your-membership-funnel),
[Entrepreneur](https://www.entrepreneur.com/article/250580)).

**Señales.** FUERTE: «summit», «cumbre virtual», «congreso virtual», «[N] expertos», «pase gratuito», «all access pass»,
«pase de acceso total», «pase vip» + online. DÉBIL: «speakers», «expertos», «conferencias», «congreso». Un congreso con
sede es `evento-presencial`.

### 2.20 Libro gratis + envío (`libro`)

**Qué es.** Se regala un libro físico y se cobra sólo el envío; la ganancia está en las ofertas que siguen (el «free plus
shipping» de *DotCom Secrets*) ([DotCom Secrets](https://archive.org/download/DotComSecretsByRussellBrunson/DotCom%20Secrets%20by%20Russell%20Brunson.pdf),
[Markinblog](https://www.markinblog.com/?p=2019905)).

**Señales.** FUERTE: «solo pagas el envío», «free + shipping», «free plus shipping», «consigue mi libro gratis». DÉBIL:
«libro gratis» suelto (puede ser un ebook: eso es `lead-magnet`), «mi libro», «autor de», enlace a Amazon de su propio
libro.

### 2.21 Tienda o ecommerce (`tienda`)

**Qué es.** Catálogo de productos físicos o digitales con carrito; el contenido lleva a la tienda o a una ficha de producto.

**Señales.** FUERTE: `myshopify.com`, `mitiendanube.com`, `tiendanube.com`, `mercadolibre.`, `amazon.` (su tienda),
rutas `/products/`, `/collections/`, `/cart`, `/carrito`, `/producto/`; «agregar al carrito», «envío gratis», «tienda
online», «shop now». Anuncio: botón «Comprar»/«Shop now» (verificado en SaveMyLeads) hacia una ficha de producto.
DÉBIL: «envíos a todo el país», «productos», «catálogo».

### 2.22 Newsletter (`newsletter`)

**Qué es.** Una suscripción a un boletín periódico como relación de largo plazo; vende con el propio boletín o con
patrocinios. **Señales.** FUERTE: `substack.com`, `beehiiv.com`, «suscríbete a mi newsletter», «newsletter semanal», «cada
domingo en tu correo», «subscribe to my newsletter». DÉBIL: «correo», «email», «suscríbete».

### 2.23 Las fuentes que nombran los tipos, en una línea

ClickFunnels agrupa lead squeeze, summit y challenge como funnels de captación, y la aplicación entre los de llamada
([ClickFunnels](https://support.myclickfunnels.com/docs/understanding-funnel-types-in-clickfunnels/)); el tripwire es de
Perry Belcher, según Brunson ([Entrepreneur](https://www.entrepreneur.com/growing-a-business/3-core-sales-funnels-to-fuel-your-quest-for-online-income/306893));
otra guía los ordena por precio, como regla de autor y no de Brunson
([Lilach Bullock](https://www.lilachbullock.com/types-of-sales-funnels-which-to-use/)). Hormozi describe pegar un llamado a
la acción al contenido orgánico que ya rinde («organic plus CTA»), que es lo que se ve como captions con «comenta» o «agenda»
([Shortform](https://www.shortform.com/podcast/episode/the-game-w-alex-hormozi-2025-06-02-episode-summary-the-funnel-we-use-to-make-250m-ep-898)).

---

## 3. Formatos de contenido

### 3.0 Dos ejes: qué cuenta (formato) y cómo se ve (puesta)

El formato es **qué cuenta la pieza** (un tutorial, una historia, una lista); la puesta es **cómo está hecha** (a cámara,
pantalla verde, voz en off, carrusel). Las fuentes los mezclan, y un mismo tema se puede contar en cualquier formato
([Socialync](https://socialync.io/blog/content-pillars-guide-2026),
[Sked Social](https://skedsocial.com/blog/15-content-ideas-you-can-plan-and-execute-this-week-by-content-pillar.md)).
«¿Qué formatos le funcionan?» compara **formatos**; la puesta es un filtro aparte (y en buena parte sale de los metadatos:
`tipoDeContenido` en `lib/spy-vista.ts` ya separa reels, carruseles, shorts, largos y anuncios).

Los ids que ya usa Spy (`FORMATOS` en `lib/spy-detalle.ts`: `pov`, `storytime`, `antes-despues`, `tutorial`, `lista`,
`opinion`, `resena`, `testimonio`, `detras`, `entrevista`, `otro`) se conservan tal cual. Este catálogo suma `caso-de-exito`,
`mito`, `preguntas`, `reaccion`, `recap-evento`, `tendencia`, `frase` y `promo`.

Las señales de formato son casi todas **débiles**: un caption puede decir «tutorial» sin serlo. La IA mira la pieza; las
frases sirven para darle evidencia y para chequearla.

### 3.1 Tutorial (`tutorial`)
Paso a paso de cómo hacer algo, a cámara, con las manos, con grabación de pantalla o en silencio con texto
([Cursa](https://cursa.app/en/page/tiktok-influencer-starter-kit-understand-tiktok-formats-and-what-theyre-for),
[Followr](https://help.followr.ai/en/articles/10600881-video-formats-for-your-reels)). FUERTE en el título: «tutorial»,
«paso a paso», «cómo hacer», «how to», «step by step». DÉBIL: «cómo», «aprende a», «te enseño», «guía», «así se hace»,
una grabación de pantalla. Incluye la demo de una herramienta.

### 3.2 Lista o tips (`lista`)
Varios puntos numerados («3 errores», «5 tips»); en carrusel, un punto por lámina con portada-gancho y lámina final de
llamado a la acción ([Dev.to](https://dev.to/fermainpariz/how-to-create-instagram-carousel-posts-that-get-saved-and-shared-2026-guide-1jjm),
[Tubefilter](https://www.tubefilter.com/2019/02/12/taxonomy-youtube-videos-develop-original-content-that-works/)).
FUERTE (compuesta): un número + «errores», «tips», «consejos», «claves», «pasos», «razones», «cosas», «hábitos»,
«herramientas», «señales», «mistakes», «ways». DÉBIL: «top», «lista», un carrusel de 5 o más láminas con texto.

### 3.3 Storytime o mi historia (`storytime`)
Una anécdota personal contada a cámara, a menudo con giro o lección
([Cursa](https://cursa.app/en/page/tiktok-influencer-starter-kit-understand-tiktok-formats-and-what-theyre-for),
[Platzi](https://platzi.com/cursos/creacion-reels/estilo-de-un-reel/)). FUERTE: «storytime», «mi historia», «les cuento
cómo», «te cuento cómo», «nunca les conté», «la vez que», «lo que me pasó». DÉBIL: «hace [N] años», «cuando yo»,
«cuando empecé», «my story».

### 3.4 POV (`pov`)
Primera persona que mete al espectador en una situación, sin introducción
([Empirio Labs](https://catalog.empiriolabs.ai/blog/how-to-create-viral-pov-videos)). FUERTE: «pov», «pov:», «punto de
vista:». DÉBIL: «cuando eres», «tú cuando».

### 3.5 Antes y después (`antes-despues`)
El estado inicial, el cambio y el resultado; en carrusel: gancho → antes → proceso → después → qué cambió
([Dev.to](https://dev.to/fermainpariz/how-to-create-instagram-carousel-posts-that-get-saved-and-shared-2026-guide-1jjm)).
FUERTE: «antes y después», «antes vs ahora», «before and after», «glow up». DÉBIL: «transformación» (un coach la dice de
todo), «de [x] a [y]», «hace un año», «hoy».

### 3.6 Testimonio (`testimonio`)
Habla el CLIENTE: un clip corto con su experiencia ([Shootsta](https://shootsta.com/blog/testimonials-vs-case-studies-which-to-use-and-when),
[Testimonial.to](https://testimonial.to/resources/client-testimonial-videos)). FUERTE: «testimonio», «lo que dice [nombre]»,
«opinión de mi alumna», «review de mi cliente», «testimonial». DÉBIL: «alumno», «alumna», «cliente», «gracias a»,
«resultados».

### 3.7 Caso de éxito (`caso-de-exito`)
Más largo que un testimonio: el problema, la solución y los resultados con cifras, a menudo contado por el creador
([Testimonial.to](https://testimonial.to/resources/case-study-video), [Shootsta](https://shootsta.com/blog/testimonials-vs-case-studies-which-to-use-and-when)).
FUERTE: «caso de éxito», «case study», «cómo [nombre] pasó de», «cómo ayudé a». DÉBIL: «facturó», «resultados»,
«en [N] meses», «de [x] a [y]».

### 3.8 Opinión o postura (`opinion`)
Una toma de posición, a menudo contra lo establecido, para generar conversación ([Sked Social](https://skedsocial.com/blog/15-content-ideas-you-can-plan-and-execute-this-week-by-content-pillar.md)).
FUERTE: «opinión impopular», «unpopular opinion», «hot take», «me van a odiar por esto», «nadie te dice». DÉBIL: «la
verdad sobre», «deja de», «stop», «polémico», «mi opinión».

### 3.9 Mito vs realidad (`mito`)
Desmiente una creencia común de su nicho ([Girard Media](https://girardmedia.com/blog/instagram-carousel-content-educational-strategy),
[Influencers Time](https://www.influencers-time.com/stitch-and-duet-response-content-building-the-fast-approval/)).
FUERTE: «mito», «mitos», «mito vs realidad», «myth», «te mintieron», «no es cierto que». DÉBIL: «falso», «mentira»,
«en realidad».

### 3.10 Reseña o comparación (`resena`)
Prueba y opina de un producto o herramienta; incluye unboxing y «vs» ([Visme](https://visme.co/blog/types-of-youtube-videos/)).
FUERTE: «reseña», «review», «unboxing», «honest review». DÉBIL: «probé», «vale la pena», «vs», «comparación», «mejor».

### 3.11 Detrás de escena (`detras`)
La trastienda del negocio (preparar, grabar, el equipo), un día en su vida o un vlog
([Planoly](https://www.planoly.com/blog/vlogging-for-social-media), [PlayPlay](https://playplay.com/blog/day-in-the-life-video-ideas/),
[Kontentino](https://www.kontentino.com/social-media-urban-dictionary/day-in-the-life/)). FUERTE: «detrás de cámaras»,
«detrás de escena», «behind the scenes», «bts», «un día en mi vida», «day in my life», «vlog». DÉBIL: «mi rutina», «así
es mi día», «preparando».

### 3.12 Recap de evento (`recap-evento`)
Un resumen corto (uno a tres minutos) de un evento presencial, híbrido o virtual, con escenario, público y momentos clave;
sirve para vender la próxima edición ([Vimeo](https://vimeo.com/blog/post/event-recap-video)). FUERTE: «recap», «resumen
del evento», «así se vivió», «aftermovie», «highlights», «gracias [ciudad]». DÉBIL: «sold out», «así fue», «lleno
total», «qué noche», «edición», «escenario». ⚠️ **Es evidencia de funnel:** un recap con público es señal FUERTE de
`evento-presencial` (histórico si la fecha pasó).

### 3.13 Entrevista o clip de podcast (`entrevista`)
Una conversación con invitado, o un fragmento vertical subtitulado de un episodio largo que se entiende solo
([Choppity](https://www.choppity.com/blog/how-to-repurpose-podcast-into-shorts/),
[Tubefilter](https://www.tubefilter.com/2019/02/12/taxonomy-youtube-videos-develop-original-content-that-works/)).
FUERTE: «entrevista», «podcast», «episodio», «invitado», «conversación con», «charla con». DÉBIL: «ep.», «con @»,
dos personas con micrófonos.

### 3.14 Preguntas y respuestas (`preguntas`)
Responde preguntas de su audiencia; en Instagram, el video que responde un comentario lo muestra como sticker
([TechCrunch](https://techcrunch.com/2021/12/13/instagram-now-lets-users-reply-to-comments-with-reels/),
[RouteNote](https://routenote.com/blog/reply-to-reels-comments-with-video/)). FUERTE: «respondiendo a @», «preguntas
frecuentes», «me preguntaron», «q&a», «preguntas y respuestas», «ask me anything». DÉBIL: «respondo» (también es «te
respondo por DM»), «pregunta de», «me escriben».

### 3.15 Reacción, stitch o dueto (`reaccion`)
Usa el video de otro (al principio o al lado) para comentarlo o rebatirlo
([Influencers Time](https://www.influencers-time.com/stitch-and-duet-response-content-building-the-fast-approval/),
[Tubefilter](https://www.tubefilter.com/2019/02/12/taxonomy-youtube-videos-develop-original-content-that-works/)).
FUERTE: «reacciono», «reaccionando a», «reaction», «stitch», «dueto», «duet». DÉBIL: «vi este video», «opino sobre».

### 3.16 Tendencia, meme o sketch (`tendencia`)
Un formato de humor o un audio en tendencia adaptado a su nicho; casi siempre con texto en pantalla
([Cursa](https://cursa.app/en/page/tiktok-influencer-starter-kit-understand-tiktok-formats-and-what-theyre-for)).
FUERTE: «trend», «meme», «sketch», «parodia». DÉBIL: líneas que arrancan con «nadie:» o «yo:», un audio que no es suyo (el
`media_audio_type` MUSIC que ya lee Spy), menos de 15 s.

### 3.17 Frase o reflexión (`frase`)
Una cita o una idea suelta en una imagen o en texto sobre un fondo. FUERTE: una sola imagen con una cita entre
comillas. DÉBIL: «frase», «recuerda», «reflexión», «quote».

### 3.18 Promoción directa (`promo`)
La pieza vende algo concreto: su evento, su programa, su clase, con precio, fecha o llamado a inscribirse. FUERTE:
«inscríbete», «inscripciones abiertas», «últimos lugares», «entradas a la venta», «preventa», «link en mi bio para
inscribirte». DÉBIL: «link en mi bio», «cupos», «oferta», «descuento», «hasta el [fecha]», un precio con su moneda. ⚠️ **Es evidencia de
funnel:** lo que promociona dice la puerta (evento, webinar, reto…).

### 3.19 Otro (`otro`)
Lo que no entra en ninguno. Un formato inventado no suma a ninguna fila (regla de `formatoDe`).

### 3.20 La puesta: cómo está hecha

| Puesta | Qué es | Señal (débil salvo que se diga) |
|---|---|---|
| `a-camara` | Talking head: la persona habla a cámara, plano de hombros para arriba ([Opus](https://www.opus.pro/blog/talking-head-videos-guide), [Kontentino ES](https://www.kontentino.com/es/diccionario-urbano-de-redes-sociales/talking-head-video/)) | una cara de frente casi todo el video |
| `pantalla-verde` | Habla delante de una imagen o un post de fondo ([Socialync](https://www.socialync.io/glossary/green-screen)) | «#greenscreen», «pantalla verde» (FUERTE) |
| `voz-en-off` | Sin cara: imágenes de apoyo y voz ([Dev.to](https://dev.to/wedgemethoddev/how-to-make-viral-short-form-videos-without-showing-your-face-37hl)) | ninguna cara, voz continua |
| `texto-en-pantalla` | Sin voz: el mensaje va en texto sobre un video o un audio de moda | texto largo sobre el video, audio de música |
| `grabacion-de-pantalla` | Muestra una pantalla de computadora o de celular | interfaz visible |
| `camara-en-mano` | Vlog: varias locaciones, la cámara se mueve con la persona | «vlog» |
| `podcast` | Set con micrófonos, dos o más personas | «podcast», «ep.» |
| `carrusel` | Varias láminas; la cuenta de láminas ya la trae la pieza ([Creatorflow](https://creatorflow.so/blog/instagram-carousel-posts-guide)) | metadato (FUERTE) |
| `slideshow` | Fotos que pasan con música (modo foto de TikTok) ([Neal Schaffer](https://nealschaffer.com/how-to-make-a-slideshow-on-tiktok/)) | metadato |
| `imagen` | Una sola imagen | metadato |
| `en-vivo` | Repetición de un directo | «en vivo», «directo», «live», «replay» |

### 3.21 Formatos que también son evidencia de funnel

- `recap-evento` con público o escenario ⇒ `evento-presencial` (FUERTE; histórico si ya pasó).
- `promo` ⇒ el funnel de lo que promociona (evento, webinar, reto, lanzamiento).
- Cualquier formato con «comenta [PALABRA]» en el caption ⇒ `dm-palabra-clave`.
- `testimonio` y `caso-de-exito` con «mentoría», «programa» o «aplica» ⇒ débil para `aplicacion-llamada`.
- Una serie numerada («clase 1/3», «día 3 del reto») ⇒ `lanzamiento` o `reto`.

---

## 4. Tabla para el código

Reglas de lectura de esta tabla:
- Frases en minúsculas, con tildes; el código normaliza (sin tildes, sin mayúsculas) y compara con límites de palabra
  Unicode. Sin sintaxis de regex.
- `fuertes`: una alcanza. `debiles`: 2 o más distintas (mejor de 2 piezas). `descarta`: si aparece en la misma pieza, sus
  fuertes bajan a débiles para ese id.
- `hosts`: dominio registrable o prefijo de ruta; una raíz con punto final (`eventbrite.`) cubre todos sus países.
- `compuestas`: combinaciones que el código arma (número + palabra, fecha + lugar); están en palabras, no en regex.
  Cuentan como FUERTE salvo las que terminan en «(débil)».
- `nota_hibrido` (sólo en `evento-presencial`): con una sede, estas frases no descartan: agregan la nota «híbrido».
- `[N]` en una compuesta es un número; `MAYÚSCULAS` es una palabra en mayúsculas o entre comillas.

### 4.1 Funnels

```yaml
- id: evento-presencial
  label: Evento presencial
  que: Vende entradas a un evento en un lugar, y ahí vende lo caro.
  fuertes: ["comprar entradas", "compra tu entrada", "comprar boletos", "compra tu boleto", "boletos a la venta", "entradas a la venta", "venta de entradas", "preventa de entradas", "últimas entradas", "quedan pocas entradas", "entradas agotadas", "boletos agotados", "evento presencial", "100% presencial", "lugar del evento", "sede del evento", "centro de convenciones", "get tickets", "buy tickets", "in person event"]
  debiles: ["evento", "conferencia", "seminario", "congreso", "experiencia", "escenario", "speakers", "speaker", "conferencista", "agenda del evento", "networking", "auditorio", "teatro", "salón", "hotel", "sede", "dirección", "aforo", "cupo limitado", "primera edición", "próxima edición", "edición", "gira", "tour", "vip", "preventa", "early bird", "sold out", "agotamos", "agotado", "boletos", "entradas", "tickets", "venue"]
  compuestas: ["fecha + ciudad o sede + (entradas | boletos | tickets | preventa | vip)", "recap-evento con público + fecha o ciudad", "gracias + nombre de ciudad", "nos vemos en + nombre de ciudad"]
  descarta: ["online", "en línea", "virtual", "por zoom", "zoom", "desde tu casa", "desde donde estés", "link de acceso", "transmisión", "replay", "grabación", "en directo por youtube"]
  nota_hibrido: ["presencial y online", "modalidad híbrida", "híbrido", "streaming"]
  hosts: ["eventbrite.", "ticketmaster.", "passline.com", "boletia.com", "joinnus.com", "teleticket.com.pe", "tuboleta.com", "puntoticket.com", "eticket.", "ticketek.", "allaccess.com.ar", "tickantel.com.uy", "superboletos.com", "boletomovil.com", "entradium.com", "feverup.com", "dice.fm", "woutick.com", "wegow.com", "sympla.com.br", "luma.com", "lu.ma", "maps.app.goo.gl", "goo.gl/maps", "google.com/maps", "waze.com/ul"]
- id: mastermind-retiro
  label: Mastermind o retiro
  que: Junta a un grupo chico unos días, por un precio alto.
  fuertes: ["mastermind", "retiro", "retreat", "solo por aplicación", "application only", "by invitation", "por invitación", "todo incluido", "hospedaje incluido"]
  debiles: ["grupo reducido", "cupos limitados", "intensivo", "inmersión", "círculo", "cohorte", "aplica", "destino"]
  compuestas: ["mastermind + (aplica | aplicación)", "retiro + fechas + lugar"]
  descarta: ["llamadas grupales por zoom"]
  hosts: ["typeform.com", "tally.so", "jotform.com", "forms.gle"]
- id: webinar-en-vivo
  label: Webinar en vivo
  que: Una clase gratis en vivo, con registro, y la oferta al final.
  fuertes: ["clase en vivo gratuita", "masterclass gratuita en vivo", "webinar gratuito", "webinar en vivo", "regístrate a la clase", "free live training", "free webinar"]
  debiles: ["reserva tu lugar", "regístrate gratis", "inscríbete gratis", "save your seat", "register now", "masterclass", "clase gratuita", "taller online", "taller gratuito", "live workshop", "en vivo", "live", "webinar", "hora méxico", "hora colombia", "hora argentina", "hora españa", "hora cdmx", "grupo de whatsapp"]
  compuestas: ["(regístrate | reserva tu lugar | inscríbete) + fecha + hora, sin sede"]
  descarta: ["elige tu horario", "on demand", "acceso inmediato", "sede", "presencial", "centro de convenciones"]
  hosts: ["zoom.us/webinar/register", "zoom.us/meeting/register", "event.webinarjam.com", "livestorm.co", "demio.com", "streamyard.com", "crowdcast.io", "bigmarker.com", "gotowebinar.com", "chat.whatsapp.com"]
- id: webinar-automatizado
  label: Webinar automatizado
  que: La misma clase grabada, que se ve a la hora que elijas.
  fuertes: ["elige tu horario", "elige el horario", "próxima sesión en", "comienza en minutos", "sesiones cada", "instant replay", "just in time"]
  debiles: ["ver ahora", "watch now", "on demand", "clase gratuita", "acceso inmediato", "webinar", "masterclass"]
  compuestas: ["registro + selector de sesión sin fecha fija"]
  descarta: ["solo en vivo", "no habrá repetición"]
  hosts: ["everwebinar.com", "easywebinar", "stealthseminar"]
- id: vsl-llamada
  label: VSL → llamada
  que: Un video de venta que termina en agendar una llamada.
  fuertes: ["mira el video antes de agendar", "mira este video antes de agendar"]
  debiles: ["agenda tu llamada", "book a call", "agenda una sesión", "mira este video", "watch the video", "sesión estratégica", "llamada de diagnóstico", "sesión de claridad", "evaluación gratuita", "llamada gratuita"]
  compuestas: ["video principal + calendario en la misma página"]
  descarta: ["aplica", "aplicación", "postúlate"]
  hosts: ["calendly.com", "cal.com", "api.leadconnectorhq.com", "tidycal.com", "savvycal.com"]
- id: vsl-compra
  label: VSL → compra directa
  que: Un video de venta con el botón de compra debajo.
  fuertes: ["comprar ahora", "quiero acceso", "inscríbete ahora", "garantía de devolución", "garantía de 7 días", "garantía incondicional", "buy now", "get instant access"]
  debiles: ["oferta especial", "precio de lanzamiento", "solo hoy", "bonos", "acceso de por vida", "garantía", "por solo"]
  compuestas: ["video principal + checkout (lib/spy-funnel.ts)"]
  descarta: ["agenda tu llamada", "aplica", "agregar al carrito"]
  hosts: ["pay.hotmart.com", "go.hotmart.com", "pay.kiwify.com", "buy.stripe.com", "checkout.stripe.com", "mpago.la", "link.mercadopago.", "mykajabi.com/offers", "thrivecart.com", "samcart.com", "gumroad.com"]
- id: aplicacion-llamada
  label: Aplicación + llamada
  que: Llenas una solicitud y, si calificas, te llaman.
  fuertes: ["aplica aquí", "aplica ahora", "aplica a mi mentoría", "solicita tu lugar", "postúlate", "completa la aplicación", "llena la aplicación", "apply now", "revisamos cada aplicación"]
  debiles: ["aplica", "application", "no es para todos", "solo trabajamos con", "mentoría 1:1", "mentoría 1 a 1", "programa de acompañamiento", "high ticket", "trabajemos juntos", "cupos por mes", "llamada de evaluación"]
  compuestas: ["formulario + calendario después"]
  hosts: ["typeform.com", "tally.so", "jotform.com", "forms.gle", "docs.google.com/forms", "api.leadconnectorhq.com", "calendly.com"]
- id: agenda-directa
  label: Agenda directa
  que: Del anuncio o el contenido, directo a agendar una llamada.
  fuertes: ["agenda tu llamada gratis", "agenda una llamada gratis", "reserva tu sesión", "consulta gratuita", "llamada de descubrimiento", "book a free call", "free consultation", "discovery call"]
  debiles: ["llamada", "sesión", "agenda", "diagnóstico", "reservar"]
  compuestas: ["enlace de calendario en la bio o en un botón"]
  descarta: ["aplica", "aplicación"]
  hosts: ["calendly.com", "cal.com", "tidycal.com", "savvycal.com", "as.me", "acuityscheduling.com", "meetings.hubspot.com", "calendar.app.google", "youcanbook.me", "zcal.co", "oncehub.com"]
- id: dm-setter
  label: Conversación por DM → llamada
  que: Te escribe por mensaje privado y te lleva a una llamada.
  debiles: ["escríbeme", "envíame un mensaje", "mándame un dm", "dm para info", "info por dm", "hablemos", "dm me", "send me a message", "agenda por dm"]
  compuestas: ["2 o más débiles + alguna señal de llamada (agenda, sesión, calendly)"]
  descarta: ["comenta"]
  hosts: ["ig.me/m", "m.me"]
- id: dm-palabra-clave
  label: DM por palabra clave
  que: Comentas una palabra y te llega el enlace por mensaje.
  fuertes: ["comenta la palabra", "te lo envío por dm", "te lo mando por dm", "te llega por mensaje", "te envío el link por dm", "comment the word"]
  debiles: ["por dm", "te lo mando", "link por mensaje", "comenta"]
  compuestas: ["comenta + MAYÚSCULAS", "escribe + MAYÚSCULAS + en los comentarios", "déjame + MAYÚSCULAS + en comentarios", "escríbeme + MAYÚSCULAS + (por dm | por mensaje)", "comment + MAYÚSCULAS", "dm me + MAYÚSCULAS"]
- id: whatsapp-conversacional
  label: Conversación por WhatsApp
  que: Te lleva a WhatsApp y vende conversando.
  fuertes: ["escríbenos por whatsapp", "escríbeme por whatsapp", "mándanos un whatsapp"]
  debiles: ["whatsapp", "info por whatsapp", "pide informes"]
  compuestas: ["anuncio cuyo destino es wa.me o api.whatsapp.com"]
  hosts: ["wa.me", "api.whatsapp.com/send", "whatsapp.com/send"]
- id: reto
  label: Reto o challenge
  que: Un reto gratis de varios días que termina en la oferta.
  fuertes: ["reto gratuito", "únete al reto", "inscríbete al reto", "día 1 del reto"]
  debiles: ["reto", "desafío", "challenge", "días"]
  compuestas: ["(reto | desafío | challenge) + de + [N] + días + registro", "[N]-day challenge + registro", "día [N] del reto"]
  hosts: ["chat.whatsapp.com", "facebook.com/groups", "t.me"]
- id: lanzamiento
  label: Lanzamiento
  que: Una serie de videos gratis antes de abrir las ventas.
  fuertes: ["carrito abierto", "abrimos inscripciones", "inscripciones abiertas", "cierre de inscripciones", "últimas horas para inscribirte", "inscripciones cerradas", "lista de espera", "próxima apertura", "cart open", "doors open", "doors close", "waitlist", "contenido de prelanzamiento"]
  debiles: ["lanzamiento", "muy pronto", "se viene algo grande", "grupo vip", "preventa", "cpl"]
  compuestas: ["clase + [N] (serie de 3) (débil)", "video [N] de [N] (débil)", "aula [N] (débil)"]
  hosts: ["chat.whatsapp.com"]
- id: clase-gratis
  label: Clase gratis o mini curso
  que: Clases o un mini curso gratis que llevan a la oferta.
  fuertes: ["mini curso gratis", "curso gratuito", "entrenamiento gratuito", "serie de videos gratis", "mírala ahora", "free training", "free mini course", "free video series", "free course"]
  debiles: ["clase gratuita", "gratis", "clase", "aprende gratis", "acceso inmediato"]
  compuestas: ["clase gratuita + acceso inmediato", "serie de [N] videos"]
  descarta: ["elige tu horario", "en vivo"]
- id: lead-magnet
  label: Lead magnet → email
  que: Un regalo a cambio del email, y después la venta por correo.
  fuertes: ["descarga gratis", "descárgala gratis", "guía gratuita", "guía gratis", "plantilla gratis", "checklist gratis", "ebook gratis", "pdf gratis", "te lo envío a tu correo", "free download", "free guide", "free template", "free checklist"]
  debiles: ["gratis", "recurso", "regalo", "freebie", "plantilla", "guía", "checklist", "ebook"]
  compuestas: ["formulario de email + recurso gratis"]
  hosts: ["kit.com", "ck.page", "convertkit.com", "mailchi.mp", "eepurl.com", "flodesk.com", "mailerlite.com", "activehosted.com", "systeme.io"]
- id: quiz
  label: Quiz o test
  que: Un test que te dice qué te conviene y te ofrece algo.
  fuertes: ["haz el test", "responde el quiz", "descubre qué tipo de", "test gratuito", "scorecard", "take the quiz"]
  debiles: ["descubre", "test", "quiz", "evaluación gratuita", "find out your", "diagnóstico en 2 minutos", "qué tipo de"]
  compuestas: ["preguntas + página de resultados"]
  hosts: ["scoreapp.com", "tryinteract.com", "outgrow.co", "involve.me"]
- id: comunidad
  label: Comunidad o membresía
  que: Una comunidad o membresía con pago cada mes.
  fuertes: ["únete a mi comunidad", "comunidad gratuita", "membresía", "suscripción mensual", "join my community", "free community"]
  debiles: ["comunidad", "tribu", "club", "miembros", "al mes"]
  compuestas: ["precio + al mes (o /mes) (débil)"]
  hosts: ["skool.com", "circle.so", "mn.co", "discord.gg", "discord.com/invite", "t.me", "patreon.com", "whop.com"]
- id: low-ticket
  label: Low ticket → upsell
  que: Algo barato primero, y después lo caro.
  fuertes: ["agrega también", "oferta única", "solo en esta página", "one time offer", "order bump"]
  debiles: ["por solo", "a solo", "precio especial", "oferta", "taller", "menos de lo que cuesta un café"]
  compuestas: ["checkout + precio bajo para su mercado", "taller + precio (débil)"]
  descarta: ["aplica", "agenda tu llamada"]
  hosts: ["pay.hotmart.com", "pay.kiwify.com", "stan.store", "gumroad.com", "payhip.com", "whop.com", "lemonsqueezy.com"]
- id: summit-virtual
  label: Cumbre virtual
  que: Varias charlas online gratis, con un pase pago.
  fuertes: ["summit", "cumbre virtual", "congreso virtual", "pase gratuito", "all access pass", "pase de acceso total"]
  debiles: ["speakers", "expertos", "conferencias", "congreso", "pase vip"]
  compuestas: ["[N] expertos + online"]
  descarta: ["sede", "centro de convenciones", "presencial"]
- id: libro
  label: Libro gratis + envío
  que: Un libro gratis, pagas el envío, y después la oferta.
  fuertes: ["solo pagas el envío", "free plus shipping", "consigue mi libro gratis"]
  debiles: ["libro gratis", "mi libro", "autor de", "libro"]
  hosts: ["amazon."]
- id: tienda
  label: Tienda online
  que: Vende productos en su tienda online.
  fuertes: ["agregar al carrito", "tienda online", "envío gratis", "shop now", "add to cart"]
  debiles: ["envíos a todo el país", "productos", "catálogo", "tienda"]
  compuestas: ["ruta /products/ o /collections/ o /cart o /carrito o /producto/"]
  hosts: ["myshopify.com", "mitiendanube.com", "tiendanube.com", "mercadolibre.", "amazon."]
- id: newsletter
  label: Newsletter
  que: Un correo periódico que vende de a poco.
  fuertes: ["suscríbete a mi newsletter", "newsletter semanal", "subscribe to my newsletter"]
  debiles: ["newsletter", "correo", "suscríbete", "cada domingo"]
  hosts: ["substack.com", "beehiiv.com"]
```

**Hosts que no deciden solos (constructores de funnels y páginas):** `myclickfunnels.com`, `clickfunnels.com`,
`leadconnectorhq.com` y `msgsndr.com` (GoHighLevel), `systeme.io`, `kartra.com`, `mykajabi.com`, `carrd.co`,
`leadpages.com`, `unbounce.com`, `framer.website`, `webflow.io`. Dicen que hay un funnel, no cuál: se lee la página.

**Páginas de enlaces (no son un funnel; se leen sus botones):** `linktr.ee`, `beacons.ai`, `beacons.page`, `stan.store`
(también vende: cuenta para `low-ticket`), `taplink.cc`, `bio.link`, `lnk.bio`, `hoo.be`, `campsite.bio`, `solo.to`
([Buttondown](https://buttondown.com/comparison-guides/link-in-bio-tools),
[Taplink](https://taplink.at/en/blog/linktree-vs-stan-store.html)).

**Botones de anuncios de Meta:** verificados como botones de la lista fija: «Más información» (Learn more), «Registrarte»
(Sign up), «Reservar» (Book now), «Comprar» (Shop now), «Obtener acceso» (Get access)
([SaveMyLeads](https://savemyleads.com/blog/other/what-call-to-action-buttons-are-available-in-meta-ads-manager),
[LeadEnforce](https://leadenforce.com/blog/meta-ads-cta-buttons-explained-by-objective)). **No verificados** en esta
búsqueda (confirmar contra el enum `call_to_action` de la Marketing API antes de usarlos): «Comprar entradas»
(`BUY_TICKETS`), «Solicitar» (`APPLY_NOW`), «Enviar mensaje de WhatsApp» (`WHATSAPP_MESSAGE`). La Biblioteca de Anuncios
muestra el creativo tal como lo ve el usuario, si está activo, desde cuándo y en qué plataformas
([Jon Loomer](https://www.jonloomer.com/meta-ad-library/), [Buffer](https://buffer.com/resources/meta-ad-library/)).

### 4.2 Formatos

```yaml
- id: tutorial
  label: Tutorial
  fuertes: ["tutorial", "paso a paso", "cómo hacer", "how to", "step by step"]
  debiles: ["cómo", "aprende a", "te enseño", "guía", "así se hace", "demo"]
- id: lista
  label: Lista o tips
  debiles: ["top", "lista", "tips", "consejos"]
  compuestas: ["[N] + (errores | tips | consejos | claves | pasos | razones | cosas | hábitos | herramientas | señales | mistakes | ways)"]
- id: storytime
  label: Storytime
  fuertes: ["storytime", "mi historia", "les cuento cómo", "te cuento cómo", "nunca les conté", "la vez que", "lo que me pasó"]
  debiles: ["cuando yo", "cuando empecé", "my story"]
  compuestas: ["hace + [N] + años (débil)"]
- id: pov
  label: POV
  fuertes: ["pov", "punto de vista"]
  debiles: ["cuando eres", "tú cuando"]
- id: antes-despues
  label: Antes y después
  fuertes: ["antes y después", "antes vs ahora", "before and after", "glow up"]
  debiles: ["transformación", "hace un año", "antes", "después"]
  compuestas: ["de + cifra + a + cifra (débil)"]
- id: testimonio
  label: Testimonio
  fuertes: ["testimonio", "testimonial", "opinión de mi alumna", "opinión de mi alumno", "review de mi cliente"]
  debiles: ["alumno", "alumna", "cliente", "gracias a", "resultados"]
  compuestas: ["lo que dice + nombre"]
- id: caso-de-exito
  label: Caso de éxito
  fuertes: ["caso de éxito", "case study", "cómo ayudé a"]
  debiles: ["facturó", "resultados", "en meses"]
  compuestas: ["cómo + nombre + pasó de", "de + cifra + a + cifra + en + [N] + meses (débil)"]
- id: opinion
  label: Opinión
  fuertes: ["opinión impopular", "unpopular opinion", "hot take", "me van a odiar por esto", "nadie te dice"]
  debiles: ["la verdad sobre", "deja de", "stop", "polémico", "mi opinión"]
- id: mito
  label: Mito vs realidad
  fuertes: ["mito vs realidad", "mitos", "mito", "myth", "te mintieron", "no es cierto que"]
  debiles: ["falso", "mentira", "en realidad"]
- id: resena
  label: Reseña
  fuertes: ["reseña", "review", "unboxing", "honest review"]
  debiles: ["probé", "vale la pena", "vs", "comparación", "mejor"]
- id: detras
  label: Detrás de escena
  fuertes: ["detrás de cámaras", "detrás de escena", "behind the scenes", "bts", "un día en mi vida", "day in my life", "vlog"]
  debiles: ["mi rutina", "así es mi día", "preparando"]
- id: recap-evento
  label: Recap de evento
  fuertes: ["recap", "resumen del evento", "así se vivió", "aftermovie", "highlights"]
  debiles: ["sold out", "así fue", "lleno total", "qué noche", "edición", "escenario"]
  compuestas: ["gracias + nombre de ciudad"]
- id: entrevista
  label: Entrevista o podcast
  fuertes: ["entrevista", "podcast", "episodio", "invitado", "conversación con", "charla con"]
  debiles: ["ep.", "con @"]
- id: preguntas
  label: Preguntas y respuestas
  fuertes: ["respondiendo a", "preguntas frecuentes", "me preguntaron", "q&a", "preguntas y respuestas", "ask me anything"]
  debiles: ["respondo", "pregunta de", "me escriben"]
- id: reaccion
  label: Reacción
  fuertes: ["reacciono", "reaccionando a", "reaction", "stitch", "dueto", "duet"]
  debiles: ["vi este video", "opino sobre"]
- id: tendencia
  label: Tendencia o meme
  fuertes: ["trend", "meme", "sketch", "parodia"]
  compuestas: ["línea que arranca con nadie: o yo: (débil)", "audio que no es suyo + menos de 15 s (débil)"]
- id: frase
  label: Frase
  debiles: ["frase", "recuerda", "reflexión", "quote"]
  compuestas: ["una sola imagen + texto entre comillas"]
- id: promo
  label: Promoción directa
  fuertes: ["inscríbete", "inscripciones abiertas", "últimos lugares", "entradas a la venta", "preventa", "link en mi bio para inscribirte"]
  debiles: ["link en mi bio", "cupos", "oferta", "descuento"]
  compuestas: ["hasta el + fecha (débil)", "precio + moneda (débil)"]
- id: otro
  label: Otro
```

---

## 5. Fuentes

Las páginas no se pudieron abrir desde esta sesión: cada fuente se usó por lo que el buscador resume de ella (4/11/2026).

**Taxonomías de funnels** — https://support.myclickfunnels.com/docs/understanding-funnel-types-in-clickfunnels/ · https://support.myclickfunnels.com/docs/how-to-create-a-summit-funnel/ · https://www.entrepreneur.com/growing-a-business/3-core-sales-funnels-to-fuel-your-quest-for-online-income/306893 · https://archive.org/download/DotComSecretsByRussellBrunson/DotCom%20Secrets%20by%20Russell%20Brunson.pdf · https://www.lilachbullock.com/types-of-sales-funnels-which-to-use/ · https://www.benchmarkemail.com/es/blog/tipos-funnel-de-marketing/ · https://www.shortform.com/podcast/episode/the-game-w-alex-hormozi-2025-06-02-episode-summary-the-funnel-we-use-to-make-250m-ep-898

**Lanzamientos** — https://www.smartpassiveincome.com/?p=6372 · https://coolerinsights.com/?p=634 · https://hotmart.com/pt-br/blog/tipos-de-lancamento-digital · https://neilpatel.com/br/blog/formula-de-lancamento/ · https://herospark.com/blog/tipos-de-lancamento/amp/

**Webinar, VSL, aplicación, agenda, setter** — https://herospark.com/guias/webinar · https://easywebinar.com/blog/coaching-sales-funnel/ · https://www.avitmarine.com/webinars-vs-vsls-what-s-the-best-funnel-for-coaches-service-businesses-in-2025.html · https://support.easywebinar.com/en/articles/6986089-how-to-set-up-just-in-time-webinars-and-instant-replays · https://www.getcontrast.io/learn/automated-webinar-funnels · https://www.growbo.com/automated-webinars · https://www.webtonic.io/blog/high-ticket-agency-funnel · https://membership.io/blog/high-ticket-coaching-funnel-the-call-first-playbook · https://mastermind.cohere.live/ · https://blog.attractwell.com/blog/discovery-call-setup-for-coaches · https://www.leadquizzes.com/discovery-call-booking-funnel/ · https://setsmart.io/blog/high-ticket-coaching · https://setsmart.io/blog/sales-funnel-for-coaches

**Eventos presenciales y páginas de evento** — https://theprofitpartner.substack.com/p/room-vs-funnel · https://medium.com/webfriendly/how-to-sell-out-an-event-with-a-sales-funnel-52ae1c284eaa · https://www.entrepreneur.com/growing-a-business/how-we-sold-out-our-live-event-in-just-60-days/502263 · https://www.jamesschramko.com/playbooks/live-event-sales/ · https://www.zoho.com/backstage/event-website-guide.html · https://dryfta.com/10-things-to-include-in-your-event-landing-page/ · https://xtix.ai/blog/event-landing-page-best-practices-aboveatheafold-elements-that-drive-buys · https://www.forbesargentina.com/liderazgo/la-marca-personal-tambien-construye-fuera-redes-n93196 (caso Den Borg)

**Ticketeras (Latinoamérica y España)** — https://www.bloomberglinea.com/latinoamerica/peru/ticketmaster-aterriza-en-peru-que-significara-para-teleticket-y-joinnus/ · https://infonegocios.com.py/y-ademas/passline-la-plataforma-de-autogestion-de-eventos-busca-expandirse-a-nuevos-rubros · https://elceo.com/negocios/con-mas-de-12-millones-de-boletos-vendidos-boletia-revoluciona-el-acceso-a-eventos/ · https://www.valoraanalitik.com/tuboleta-plataforma-de-compra-y-venta/ · https://www.iqmagazine.com/publications/international-ticketing-report-2025/mexico/ · https://www.ticketfairy.com/compare/ticketing/mexico · https://www.genbeta.com/actualidad/la-estadounidense-eventbrite-compra-el-portal-espanol-de-venta-de-entradas-ticketea · https://elreferente.es/innovadores/wegow-adquiere-el-100-del-capital-de-nvivo/ · https://hackceleration.com/es/labs/cambiar/eventbrite

**Reto, comunidad, low ticket, quiz, summit, libro, lead magnet, clase gratis** — https://course-coach.pages.dev/courses/challenge-funnels/ · https://contentsparks.com/run-a-5-day-challenge · https://skoolprep.com/what-is-a-skool-community · https://skoolprep.com/how-to-sell-your-course-without-webinars-funnels-or-ads · https://skool-help.pages.dev/blog/how-to-price-your-skool-community · https://systeme.io/learn/tripwire-funnel/ · https://optinmonster.com/how-to-create-a-tripwire-funnel/ · https://theartofonlinebusiness.com/why-your-self-liquidating-offer-isnt-paying-for-itself-yet/ · https://www.scoreapp.com/?p=29803 · https://www.perspective.co/article/scoreapp-alternative · https://www.involve.me/involveme-vs-scoreapp · https://membership.io/blog/virtual-summits-how-to-use-one-to-fill-your-membership-funnel · https://www.entrepreneur.com/article/250580 · https://www.markinblog.com/?p=2019905 · https://www.kajabi.com/blog/lead-magnet-funnel · https://optinmonster.com/what-is-a-lead-magnet/ · https://www.zenler.com/blog/video-series-funnel-evergreen-workshop · https://funnelytics.io/blog/mini-class-funnel

**DM, WhatsApp, páginas de enlaces, anuncios** — https://manychat.com/blog/the-ultimate-guide-for-instagram-comment-automation/ · https://manychat.com/blog/how-course-creators-use-instagram-dm-automation/ · https://manychat.com/blog/es/como-empezar-con-la-automatizacion-de-dms-de-instagram-4-automatizaciones-que-necesitas-🤩-2/ · https://blabla.ai/es/blog/instagram-comment-to-dm-automation · https://360dialog.com/blog/click-to-whatsapp-ads · https://manychat.com/blog/how-to-create-a-whatsapp-sales-funnel/ · https://buttondown.com/comparison-guides/link-in-bio-tools · https://taplink.at/en/blog/linktree-vs-stan-store.html · https://taplink.at/en/blog/beacons-vs-linktree.html · https://savemyleads.com/blog/other/what-call-to-action-buttons-are-available-in-meta-ads-manager · https://leadenforce.com/blog/meta-ads-cta-buttons-explained-by-objective · https://www.jonloomer.com/meta-ad-library/ · https://buffer.com/resources/meta-ad-library/

**Formatos de contenido** — https://cursa.app/en/page/tiktok-influencer-starter-kit-understand-tiktok-formats-and-what-theyre-for · https://help.followr.ai/en/articles/10600881-video-formats-for-your-reels · https://www.opus.pro/blog/talking-head-videos-guide · https://www.kontentino.com/es/diccionario-urbano-de-redes-sociales/talking-head-video/ · https://www.socialync.io/glossary/green-screen · https://catalog.empiriolabs.ai/blog/how-to-create-viral-pov-videos · https://platzi.com/cursos/creacion-reels/estilo-de-un-reel/ · https://dev.to/fermainpariz/how-to-create-instagram-carousel-posts-that-get-saved-and-shared-2026-guide-1jjm · https://girardmedia.com/blog/instagram-carousel-content-educational-strategy · https://creatorflow.so/blog/instagram-carousel-posts-guide · https://socialync.io/blog/content-pillars-guide-2026 · https://skedsocial.com/blog/15-content-ideas-you-can-plan-and-execute-this-week-by-content-pillar.md · https://www.influencers-time.com/stitch-and-duet-response-content-building-the-fast-approval/ · https://www.planoly.com/blog/vlogging-for-social-media · https://playplay.com/blog/day-in-the-life-video-ideas/ · https://www.kontentino.com/social-media-urban-dictionary/day-in-the-life/ · https://vimeo.com/blog/post/event-recap-video · https://www.choppity.com/blog/how-to-repurpose-podcast-into-shorts/ · https://www.tubefilter.com/2019/02/12/taxonomy-youtube-videos-develop-original-content-that-works/ · https://visme.co/blog/types-of-youtube-videos/ · https://shootsta.com/blog/testimonials-vs-case-studies-which-to-use-and-when · https://testimonial.to/resources/client-testimonial-videos · https://testimonial.to/resources/case-study-video · https://techcrunch.com/2021/12/13/instagram-now-lets-users-reply-to-comments-with-reels/ · https://routenote.com/blog/reply-to-reels-comments-with-video/ · https://nealschaffer.com/how-to-make-a-slideshow-on-tiktok/ · https://dev.to/wedgemethoddev/how-to-make-viral-short-form-videos-without-showing-your-face-37hl
