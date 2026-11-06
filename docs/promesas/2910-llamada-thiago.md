# Promesas de la llamada con Thiago

> Llamada «Thiago <> Martin» del 29/10/2026 (Fathom 197943284), contrastada con main ff908e645 y las ramas con VERDE por 6 verificadores y 6 refutadores. Al implementar una de estas, el hito lleva la promesa resuelta y la cosecha va al docs/hallazgos-<área>.md de su área.

## Para el jueves 5/11 a las 17 h (estado del 30/10, contrastado con main `e8b3eb040` y la rama `agency-thiago-2910`)

Lo de abajo es la foto del 29/10 y ya quedó atrás en varios puntos. **Esto se contrastó leyendo el código, no usándolo:** ninguna pantalla se recorrió en el navegador.

**Lo que frena la demo de Agency, y no es código:**
- **Thiago todavía no tiene cuenta.** Medido en producción el 30/10: ningún negocio con su nombre, y la única agencia es Código Inmobiliario. Sin MaKo Pro no se suma como Agency.
- **Stripe en modo real y los precios en euros (de Martín).** Sin eso, a una cuenta de España no le sale el link del primer mes: queda pendiente hasta aprobarla a mano, 27 veces.

**Las tres cosas para mostrar:**
1. **Agency** (`agency-thiago-2910`, si el tren sube antes): abrir la cuenta de un cliente eligiendo Esencial o Pro, entrar con «Inspeccionar», que el cliente no vea MaKo Partners ni «Pasar a Pro», y darla de baja.
2. **Media Buyer** (en main): dónde, hasta cuándo y «lánzame una campaña», que nace en pausa.
3. **Automations y Calendario** (en main): las plantillas y el goteo de la sección 4, y las publicaciones que se repiten.

**Se puede sumar si Martín hace el clic de la prueba de anuncios por Zernio:** «súbeme este anuncio» desde el grupo con un video o un Drive (en main). Sin ese clic, un creativo nuevo puede rebotar con el error 1885183.

**Hecho el 6/11/2026 en `punta/thiago-anuncios`** (en main cuando la punta da verde; en producción con el deploy diario de las 08:05. Relevo: docs/relevo/nube-thiago-anuncios.md):
- «Guardar en MaKo» desde un perfil de Instagram o LinkedIn: la extensión 0.77.0, que publica el Cerebro.
- «Usar en un anuncio» desde los editores (Video, Image, Copywriter) y el AI Avatar: arma la campaña y la PROPONE; lanzarla se confirma en /mako/revisar.
- Variar el CTA, hooks de video con el avatar (el AI Avatar ofrece los «Hooks ganadores») y pausar el original cuando una variación le gana.
- «Subir creativos» acepta un video que MaKo ya generó: por la API. La pantalla del Media Buyer todavía no lo lista (la rehace el chat Marketing CoPilot).

**Decirlo antes de que lo pregunte (no existe):**
- La guía «Migrar tu CRM con Claude» y el token de agencia: la migración de sus 27 clientes hoy es de a una cuenta.
- Para LinkedIn, el tutorial de importar el Connections.csv.
- En Calendario: el anuncio y el email enlazados, las reuniones del equipo por persona y las reservas de Google Calendar como etapa del CRM.
- LinkedIn en Chats y Automations: lo decide Martín (no oficial, partner sólo para Páginas, o no hacerlo y aclararlo).

Thiago tiene una agencia con 27 clientes en España. La próxima reunión es el jueves que viene a las 17:00. Revisé todo contra main (ff908e645) y contra las ramas con VERDE.

En la llamada prometiste 61 cosas distintas: **27 ya están**, **23 están a medias o en camino**, **8 no existen** y **3 no dependen del código**.

---

## 1. Lo que prometiste y NO existe

Ordenado según el riesgo que tiene para el jueves.

**1. Dar de baja la cuenta de un cliente** [10:07-10:20]
- Dijiste: la agencia puede «darlo de baja cuando vos quieras».
- Falta todo. La ficha solo tiene «Pagar su mes», «Activar renovación» e «Inspeccionar». Hace falta un «Dar de baja» en la computadora, en el teléfono y en la API que haga cuatro cosas: cancelar la renovación (en Mercado Pago o en Stripe), pasar la cartera a revocada, cortar el Inspeccionar y avisarle al cliente. Antes tenés que decidir qué pasa con los datos de ese cliente.
- Cómo está hoy: la suscripción le sigue cobrando a Thiago hasta que la cancele él en Mercado Pago, y aun cancelada la cuenta queda abierta.
- Chat: **Agency** · Tamaño: **mediano**

**2. «Subime este anuncio» mandando un Drive al grupo** [35:18-35:20]
- Falta una operación nueva que baje el Drive (o el video o la imagen que se mande al grupo), lo suba a Meta y proponga el anuncio en pausa con confirmación. El despachante de wa-fallas tiene que proponerla y no delegarla.
- Antes hace falta un paso tuyo: el clic de la prueba de anuncios por Zernio. Sin eso, cualquier anuncio con un creativo nuevo rebota con el error 1885183 si la app de Meta del cliente está en desarrollo.
- Chat: **MaKo en WhatsApp** (junto con Ads Manager) · Tamaño: **grande**

**3. Media Buyer: «que sea en tal zona, país o ciudad»** [29:00-29:15]
- Falta un campo «Dónde» en Ajustes. El motor no tiene que prender ni escalar lo que quede fuera de esa zona. También falta poder editar el público por Zernio: hoy solo se puede con el token viejo, que está deprecado.
- Chat: **Ads Manager** · Tamaño: **mediano**

**4. Media Buyer: «solamente hasta tal fecha»** [29:10-29:20]
- Falta un campo «Hasta». Cuando pasa la fecha, la corrida diaria pausa lo que cubre, y Surf deja de subir presupuestos cuando la fecha está cerca.
- Chat: **Ads Manager** · Tamaño: **chico**

**5. LinkedIn en Chats: «acá vos podés enviar mensajes»** [13:21]
- Hoy la app dice lo contrario: la tarjeta de LinkedIn en Integraciones dice «Sus mensajes no llegan a MaKo».
- Primero tenés que decidir entre tres caminos:
  - (a) La vía no oficial: anda, pero viola el acuerdo de usuario de LinkedIn y pone en riesgo la cuenta de cada cliente.
  - (b) Un partner oficial: solo sirve para Páginas de empresa.
  - (c) No hacerlo y aclararlo el jueves: en LinkedIn, MaKo publica desde el Calendario y arma el CRM de prospección.
- Chat: **CRM y Chats** · Tamaño: **grande** (con la opción c, no hay código)

**6. Scraper de Instagram y LinkedIn en la extensión: «ya lo estoy implementando»** [17:52-18:04]
- ✅ 6/11/2026: el botón «Guardar en MaKo» está hecho (extensión 0.77.0, `punta/thiago-anuncios`). Falta el tutorial del Connections.csv.
- (29/10) No hay nada empezado en ninguna rama.
- Falta un botón «Guardar en MaKo» sobre el perfil que se está mirando, de a uno, en Instagram y en LinkedIn. Para LinkedIn, además, un tutorial para importar el Connections.csv. Nada masivo en LinkedIn, porque le banean la cuenta al cliente.
- Chat: **Extensión** · Tamaño: **grande** (**mediano** si es solo el botón de Instagram)

**7. Publicaciones recurrentes en el Calendar** [19:25-19:29]
- Falta un «Repetir» en el evento (una regla de repetición, con migración), un cron que cree la publicación y la programe en Zernio cada vez, y que el Calendario dibuje las próximas.
- Chat: **Calendario** · Tamaño: **mediano**

**8. LinkedIn en Automations: «lo voy a agregar»** [19:58-20:00]
- Lo dijiste en futuro. Depende de la misma decisión que el punto 5. La propia investigación de MaKo recomienda no hacerlo: la política de LinkedIn prohíbe que una IA conteste.
- Chat: **Automations** · Tamaño: **grande**

---

## 2. Lo que está a medias o en camino

Para cada una, lo que falta para que sea cierto lo que dijiste.

### Riesgo alto

- **[10:07] Abrir una cuenta para cada cliente.** Existe, pero el cobro sale solo por Mercado Pago y en pesos. Para España no se genera ningún link, así que cada cuenta queda pendiente hasta que la apruebes a mano, 27 veces. Falta cobrar por Stripe en USD o EUR según el país, como ya hace /planes. Además, Thiago tiene que tener MaKo Pro él mismo para sumarse como Agency. Paso tuyo: confirmar que Stripe está en modo real en la cuenta de MaKo. *(Agency)*
- **[10:24] «Los mismos planes, de 47 y 97».** Hoy todas las cuentas de agencia se abren a 47 y sin ningún tope, así que usan todo lo de Pro. Falta elegir Esencial o Pro al abrir la cuenta (y poder cambiarlo después), un precio por plan en el cobro y que los topes de Esencial también se apliquen a estas cuentas. Antes tenés que decidirlo vos. *(Agency)*
- **[15:12] «Le entran acá los leads» de los formularios de Meta.** Con la app de Meta propia del negocio anda. Por Zernio nunca llegó un lead real. Falta probar un lead real por Zernio, un barrido por si el webhook no llega y un aviso cuando falta el permiso. *(Integraciones)*
- **[12:19] «Lánzame una campaña».** Si le pregunta cómo van sus anuncios, contesta. Lanzar una campaña no existe. Falta una herramienta que cree la campaña por Zernio (objetivo, presupuesto, lugares, fecha de fin y creativo) con confirmación, y una pantalla «Nueva campaña» en el Media Buyer. *(Ads Manager)*
- **[31:17] AI Avatar: «es clonarte».** En main solo lo ves vos, como super admin. La rama que lo abre a todos ya viaja en tren-ad. El motor nunca generó un look en producción y la voz no se clona. Falta subir la rama, hacer una prueba completa en la cuenta de prueba (la hacés vos: extensión, Flow y una foto) y poner la voz clonada sobre el video. *(AI Avatar)*
- **[35:14 y 35:18] «Desde el grupo, lo que quieras» y «replicame esta landing».** En main anda. Si wa-fallas-2710 sube tal cual, replicar una landing, pausar campañas y casi todo lo complejo pasa a ser un ticket para el Cerebro de tu PC. Antes de subir esa rama falta decidir qué hace MaKo directo (replicar y analizar landings, estado y presupuesto de campañas, borrador de WhatsApp). También falta que, si nadie toma un pedido delegado en 30 minutos, el grupo reciba un aviso. *(MaKo en WhatsApp)*

### Riesgo medio-alto

- **[40:21-42:00] «La migración es instantánea porque tengo API».** Los contactos entran de a 200 y las etapas se pueden poner en bloque. Falta:
  - una guía «Migrar tu CRM con Claude» en /api-mako;
  - guardar las UTM, la fecha original y el id del CRM viejo;
  - que los leads migrados entren quietos, sin disparar «Un Lead Entró»;
  - decir claro que las conversaciones de GHL no se traen;
  - un token que sirva para todas las cuentas de la agencia.

  *(API de MaKo / CRM)*
- **[30:17] «Crea, publica y optimiza solo».** Publicar a mano desde el Calendario anda. El botón «Publicar» en Video, Image y Copywriter está en zernio-token-2910, con VERDE. Falta subir esa rama, sumar «Usar en un anuncio» en los editores y en AI Avatar, y poder crear campañas desde la app. *(Ads Manager / Editores)*
- ✅ 6/11/2026 (`punta/thiago-anuncios`): «Usar en un anuncio» en el AI Avatar, y «Subir creativos» acepta un video generado por la API. **[31:25] Anuncios hechos con el avatar del cliente.** Falta un «Usar en un anuncio» desde AI Avatar y el Video Generator, y que «Subir creativos» del Media Buyer deje elegir un video ya generado. Hoy solo acepta archivos del disco. *(AI Avatar)*
- **[10:00] «Yo no me meto con ese cliente».** Hoy el cliente de la agencia ve «Pasar a Pro · US$97», el grupo «Recomienda MaKo» y la entrada «MaKo Partners» en la barra. Falta un `esClienteDeAgencia` que apague todo eso. Es un cambio chico. *(Agency)*

### Riesgo medio

- **[25:15] Offer: «se me rompió justo el diseño».** El arreglo está hecho y tiene VERDE en create-qa-2910, pero vive solo en tu PC: no hay rama remota. Falta subirla y desplegar. *(Offer)*
- **[29:15] «Optimiza la campaña solito, vos no hacés nada».** En Pro, con el piloto automático prendido, se cumple. Falta un Stop Loss durante el día, porque hoy corre una sola vez, a las 14:30 UTC. También tenés que decidir si Esencial tiene piloto: hoy recibe 2 recomendaciones por día que se aprueban a mano. *(Ads Manager)*
- ✅ 6/11/2026 (`punta/thiago-anuncios`): la variación de botón, los hooks en el AI Avatar y el relevo del original. **[33:00] Variaciones de hooks y de CTA, publicadas solas.** Hoy son 4 variaciones de texto sobre el mismo video. Falta variar el botón (el CTA), filmar hooks de video con el avatar y pausar el original cuando una variación le gana. *(Ads Manager)*
- **[13:13] «Centraliza todas las plataformas».** Las cuatro que nombraste están. TikTok sería solo para contestar DMs por Zernio, y no funciona con cuentas registradas en el Espacio Económico Europeo, España incluida. Falta la cuenta TikTok Business de prueba, que depende de vos. *(CRM y Chats)*
- **[09:11] Partners: «una persona refiere a MaKo».** Hoy hace falta MaKo Pro, pero dos landings dicen «gratis» y «cualquier plan». Falta decidir y corregir esos textos, y sumar un campo de partner al alta a mano. *(Planes y Partners)*
- **[15:30] El calendario «con Calendly, con Cal, con lo que vos quieras».** Calendly y Cal.com andan. Falta que las reservas de Google Calendar caigan en una etapa, y sumar otras agendas si algún cliente usa otra. *(CRM y Chats)*
- **[15:46] «Conectado con Stripe, con Mercado Pago».** Falta un cobro real de punta a punta, que nunca se hizo, y prender las ventas externas de Stripe, que hoy están apagadas en todos los negocios. *(Pagos)*
- **[19:12] Programar en el Calendar «un anuncio, un email».** Reel, post, story y video salen solos. El anuncio y el email quedan como un recordatorio que hay que tildar a mano. Falta enlazarlos con Email Marketing y con campañas que tengan fecha de inicio. *(Calendario)*
- **[19:29] «Gestionar las reuniones de tu equipo».** Al Calendario solo entra el admin. Falta abrirlo a closers y setters con sus propias llamadas, y un filtro por persona. *(Calendario)*
- **[35:31] «Moveme la reunión y mandale un WhatsApp».** Mover la reunión anda con Google Calendar. El WhatsApp al lead queda como borrador, porque desde el 21/10 un envío al lead se aprueba con un toque en la app. Con wa-fallas, esa parte del mensaje se pierde. Falta decidir si el «sí» escrito en el grupo alcanza, y que un pedido compuesto haga lo simple y delegue lo demás. *(MaKo en WhatsApp)*

### Riesgo bajo

- **[23:23] La zona horaria «de esta automatización».** El huso es uno por negocio, a propósito. Alcanza con decir «la zona del negocio». *(Automations)*
- **[18:08] «O puedo scrapear base de datos».** Importar una base y completarla desde WhatsApp anda. Scrapear bases externas, como Google Maps, se retiró el 25/10. *(CRM)*

**Para subir antes del jueves:** create-qa-2910 (arregla Offer), zernio-token-2910 (Publicar desde los editores) y tren-ad (AI Avatar para todos). **wa-fallas-2710 no la subas** hasta decidir qué hace MaKo directo desde el grupo.

---

## 3. Lo que no es código

- Mandarle a Thiago por WhatsApp el link de la grabación de Fathom de esta llamada [37:20, 45:33].
- Confirmar la reunión del jueves con la hora de cada uno: en la llamada quedaron 19 tuyas y 17 de su lado.
- La llamada para migrar a sus clientes [45:00]: agendarla cuando Thiago la pida, y llegar con la guía de migración.
- La prioridad para su agencia [36:23]: atender sus pedidos primero. La parte de código es chica: cuando exista su cuenta, sumar la agencia y su cartera a los aprobados por regla de la Ticketera.
- Avisarle a la clienta que pidió sacar el ruido de afuera [36:00] que ya está, en Audio › Reducir el ruido. Antes, confirmar que ya se desplegó.
- Pasos tuyos que destraban código:
  - (el cartero 1.23.0 ya está instalado desde el 29/10: los audios y los tickets le llegan al Cerebro);
  - poner Stripe en modo real en la cuenta de MaKo;
  - hacer el clic de la prueba de anuncios por Zernio;
  - crear la cuenta TikTok Business de prueba.

---

## 4. Lo que SÍ está (lo podés mostrar tranquilo)

| Min | Qué | Ojo |
|---|---|---|
| 10:07 | Panel de agencia e «Inspeccionar» | Solo con cuentas pagadas o aprobadas |
| 11:20 | Mandar un audio que abre un ticket y llega a tu Claude | Necesita el cartero 1.23.0 y el Cerebro abierto |
| 41:20 | Passkeys, contraseña, códigos de recuperación y 2FA | El código por WhatsApp no se envía |
| 13:09 | Chats de WhatsApp, Instagram, Messenger y email | Instagram y Messenger: solo texto y con la clave de Zernio del cliente |
| 13:26 | Varias cuentas de WhatsApp e Instagram para setters | Un 2.º Instagram puede cobrarle US$6 por mes al cliente sin aviso. Arreglo chico: lib/zernio-redes.ts:246 |
| 19:42 | Automations en WhatsApp, Instagram, Messenger y email | — |
| 20:00 | Plantillas: entró, agendó, no asistió, compró, no avanzó | — |
| 22:22 | Probar y Probar en WhatsApp | Solo el admin manda la prueba real |
| 23:10 | Goteo, tope por día y horario de oficina | — |
| 22:05 | Métricas: enviados, respondieron y tasa | «Respondieron» puede contar de más |
| 15:09 | Campañas de Meta en el CRM y varios CRM | Varios CRM, solo en Pro |
| 16:17 | Scraper de grupos de WhatsApp | La tienda de Chrome todavía tiene la 0.39.1 (la 0.74.3 está en revisión) |
| 19:36 | Calendar conectado con Google Calendar | Invitados y repetición se terminan en Google |
| 28:28 | Media Buyer con IA | No prende lo que pausó la persona |
| 29:00 | Tope de presupuesto por día | El tope del mes no frena el gasto |
| 34:52 | App del celular con los dashboards | No está en las tiendas: se instala desde el navegador |
| 35:01 | Grupo de WhatsApp con MaKo desde el onboarding | — |
| 35:26 | «¿Cómo vienen mis campañas?» por WhatsApp | Necesita la cuenta de anuncios conectada |
| 13:34 | Dashboards personalizables que se comparten con un link | Solo con anuncios de Meta |
| 14:08 | Pedirle a MaKo que agregue un gráfico | Solo editando y como admin |
| 14:47 | Plantillas de dashboard y mapa de calor | El mapa necesita el Pixel de MaKo en la landing |
| 30:00 | Video Editor por prompt | Pide IA del negocio y GPU, y es pesado |
| 36:00 | Reducir el ruido | — |
| 23:34 | School: cursos, comunidad, kanban y alumnos | Panda pide el código del reproductor, no el link |
| 25:55 | Web Generator: analizar, replicar y editar | La réplica «adaptada» pide IA del negocio |
| 30:41 | Copywriter: guion de anuncio con adjuntos | — |
| 30:17 | Image Editor: imágenes y carruseles | No hay plantillas de anuncio (son bodas y currículums) |

**Ojo para la demo:** Offer y los chats de Video, Image, Copywriter, Dashboard y Web Generator se bloquean sin la app de escritorio de MaKo. Si Thiago los prueba en Chrome sin instalarla, ve «Instala MaKo para escribir».
