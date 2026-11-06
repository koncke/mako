# Lo pendiente al 30/10 (cuenta claude3, cierre)

Es todo lo que me pediste desde que arrancó esta cuenta (29/10 01:44) y sigue sin estar en producción, más el feedback de la
llamada de hoy con Leila. Va en el orden en que se ataca: primero lo que está roto para un cliente, después lo que es plata,
después lo que te traba a vos y al final las funciones nuevas.

## 1. Llamada con Leila (30/10, 11:55 a 13:53)

Lo más urgente: **Carruseles** está roto (el chat no recuerda, no pone imágenes, de la marca sólo aplica el fondo); el **«segundo nombre»** en los saludos bloquea su campaña de Black November; y una **automatización siguió mandando hasta las 23 h** (hay que ver si fue configuración o falla). Le prometiste resolver los errores **antes del lunes**, reunión el **lunes a las 12 (hora de Leila)**, y la **prueba de 7 días para Percho**. La transcripción tiene los hablantes cruzados: cada ítem se atribuyó por el contenido.

### 1. Bugs y cosas que no anduvieron en la prueba en vivo

1.1 [01:34:00] **Carruseles (Create > Imagen), chat de IA** — No recuerda lo que se le dijo antes. Leila le pidió «restaurar» y no hizo nada; no sigue las instrucciones. Martín: «Tiene que recordar bien todo lo que le dijiste antes». Esperaba: historial en el chat y que ejecute lo que se le pide. **ALTA**

1.2 [01:37:03] **Carruseles** — No coloca imágenes. Leila: «No pone imágenes… eso es un bug que hay que corregirlo». **ALTA**

1.3 [01:34:25] **Carruseles, marca** — Solo aplica el fondo de la marca; el resto del estilo no. Leila: «lo único que me está aplicando… es el fondo». Esperaba: que use su marca completa. Martín lo liga a que el Segundo Cerebro no conoce su brand board (ver 2.9). **ALTA**

1.4 [01:31:16] **Carruseles / Imagen, diseño de pantalla** — Se rompe cuando están desplegados a la vez la sidebar principal y el chat de MaKo. También se rompe, dentro de Imagen, el texto al lado de los títulos «Página 1, 2, 3» de los templates. Leila lo dictó a propósito para que Fathom lo tome. Matiz: Leila dice que puede depender de la pantalla o la configuración de cada computadora [01:31:00]. **MEDIA**

1.5 [01:34:56] **Carruseles → Web Generator (modo presentación)** — Leila intentó llevar el carrusel «como presentación» y no pudo («no puedo, no puedo»). Aparece una opción «usar de guía» que todavía no se podía personalizar (no se entiende bien qué pantalla era). **MEDIA**

1.6 [01:24:42] **Chat de MaKo en edición** (pantalla no clara, probablemente Web Generator o un editor) — Con un pedido de «oferta con Glitch» el chat se «buggeó» y Leila no entendió qué hacía. Martín detecta que ese chat no tiene los botones Discutir / Editar. Qué pidió exactamente: (no se entiende). **MEDIA**

1.7 [00:37:35] **Automations (WhatsApp)** — Una automatización que Leila armó «para que avise» siguió mandando mensajes hasta las 11 de la noche y tuvo que pararla a mano. Esperaba: que respetara reglas de horario. Martín le mostró que cada automatización tiene horario de envío y goteo (cantidad cada X tiempo y tope por día) [00:45:30]. No queda claro si fue configuración o falla. Verificar. **ALTA**

1.8 [00:54:30] **Copywriter (Create > Guiones), editor tipo Notion** — Al reordenar para dejar el gancho arriba, arrastrar un solo bloque dejó el contenido atrás («no me trajo») y no la dejaba mover. Control+Z lo recuperó; lo que funcionó fue seleccionar todo y arrastrar. Esperaba: arrastrar un bloque lleva sus sub-elementos. **MEDIA**

1.9 [00:53:15] **Copywriter, plantilla de guion** — La plantilla vuelve a preguntar «¿qué vendo?», «¿qué logra mi cliente?», «¿cómo validar qué es tendencia?», aunque MaKo ya tiene su oferta. Martín responde que existe el botón «Adaptar a tu negocio». Esperaba: que ya parta de su oferta. **MEDIA**

1.10 [00:52:03] **Copywriter** — El botón «Ver ejemplo» está escondido. Leila lo pondría en otro lugar o con color. **BAJA**

1.11 [00:54:01] **Offer / chat de MaKo** — Al cargar más de una oferta, MaKo la reta: «Tenés que concentrarte en una oferta» (la línea completa está garbleada: no se entiende). Leila tiene varias ofertas (Academia del Coach, 1:1, Lidermente Online, agencia) y en Black November va a vender tres. Le dio risa, pero es fricción real. **MEDIA**

1.12 [01:09:05] **Ajustes, cuentas de IA (Claude / ChatGPT)** — Leila había conectado su Claude y su GPT a MaKo, pero en pantalla una conexión no aparece como conectada («Ahí está, no está… qué raro»). Martín: «me lo llevo para trabajar que se pueda conectar ya GPT desde la computadora». Depende de la IA con la suscripción del cliente. **MEDIA**

1.13 [01:02:31] **Integración Claude ↔ MaKo** — A veces Leila le pide a su Claude que se conecte con MaKo y «no encuentro»; y al revés. Martín propone que Claude levante el ticket en MaKo cuando algo falle; Leila dice que ya lo hizo. **MEDIA**

1.14 [01:20:00] **Video Editor, subtítulos** — Le quedaron solo en blanco; el resaltado decía «próximamente». Esperaba: resaltado y presets (ver 2.7). **MEDIA**

1.15 [01:03:43] **Video Editor** (pantalla exacta: no se entiende) — Ayer se le «volvía atrás» y no la dejaba seguir. Dice que el ticket llegó y ya se solucionó. Verificar que siga así. **BAJA**

1.16 [00:04:00] **Web Generator, Replicar landing** — Copió la landing (editable, se pueden borrar secciones; el botón es un botón con link), pero no trae las imágenes; Martín: «me faltan unas cositas para que lo copie un poco mejor». **BAJA**

1.17 [00:42:47] **CRM, scrapeo de grupos de WhatsApp** — Los contactos scrapeados aparecieron en el funnel de Lidermente y Leila los sacó a mano, porque eran de un funnel general. Inferido: sin elegir funnel de destino cae en uno por defecto. **BAJA**

1.18 [01:07:21] **MaKo Desktop / Onboarding** — Leila lo descargó y «no lo entendí»: no ve la diferencia con la web. Martín explica: sirve offline (editor, guiones, armar automatizaciones, sincroniza al volver) y para conectar Claude/GPT. **BAJA**

1.19 [01:11:21] **Agency / Partners** — Leila no encontraba la tab de Agency; están en el menú de la foto de perfil. **BAJA**

---

### 2. Pedidos de funciones o cambios

2.1 [00:48:50] **CRM / Automations / WhatsApp, variable de nombre** — Opción para usar primer, segundo, tercer nombre o nombre completo (hoy el CRM solo tiene nombre, nombre completo y apellido). Leila guarda contactos como «[ciudad/país] Nombre Apellido» (ej. «MX Nadia Calderón», «Kun Fabiola Pedraza»), y hoy el saludo sale «Hola Kun». Martín: «yo voy a poner una opción». Bloquea Black November. **ALTA**

2.2 [00:50:04] **WhatsApp (chats) / CRM** — Poder elegir cómo ver el nombre del contacto en los chats: como lo agendó ella o como el contacto mismo se llama (idea de Martín). Leila: «eso es importante para mí». **MEDIA**

2.3 [00:46:30] **Automations > Métricas** — Que «respondieron 8» sea clicable y muestre quiénes respondieron, para seguirlos. **MEDIA**

2.4 [00:47:29] **CRM, Mandar mensajes** — Los tres puntitos de cada columna ya envían mensajes de difusión (lo implementó Martín). Martín quiere mejorar el diseño del desplegable. **BAJA**

2.5 [01:19:19] **Todas las tabs, plantillas propias** — Crear, guardar y reutilizar templates en cualquier módulo (reels, Web Generator, edición…), privados o públicos para compartir con la comunidad de MaKo. Leila lo pide por cómo usa Gamma («mi diseño personalizado»). Martín: «anotate Fathom». **MEDIA**

2.6 [01:28:42] **Plantillas públicas** — Estrellas como GitHub y ver los mejores templates de la plataforma (idea de Martín). **BAJA**

2.7 [01:20:00] **Video Editor, subtítulos y estilos** — Resaltado de subtítulos (hoy «próximamente»), presets guardados por marca o cliente (ella, Nadia, Fabiola), subtítulos «bonitos» estilo Submagic, dos o tres tendencias de letra y kits de marca. **MEDIA**

2.8 [01:21:00] **Video Editor** — «Clips mágicos» tipo Opus Clip: cortar un video largo en cortos (lo vio en Submagic). **BAJA**

2.9 [01:21:45] **Segundo Cerebro / Onboarding, brand board** — Que MaKo pida el brand board (PDF) y lo guarde en el Segundo Cerebro. Al entrar a cualquier editor (video, web, presentaciones) el chat debería pedirlo si no lo tiene y proponer: «¿lo hacemos con tu turquesa?». Soportar varios kits (el de ella y el de los clientes, ej. Espejito). Sin esto fallan los carruseles (1.3). **MEDIA**

2.10 [01:23:00] **Web Generator / landings, elementos de marketing** — Reloj de cuenta regresiva («te quedan 5 minutos»), pops de prueba social («tal persona compró»), «7 personas están viendo esta landing», barras de escasez. Martín: «súper importante». Sirve para la landing de Black November. **MEDIA**

2.11 [01:26:03] **Web Generator / Video Editor, pops** — Pops como los de Javi Tools / PopLab: «50% de descuento», «envío gratis», cuenta regresiva, simular un comentario de Instagram, una respuesta de WhatsApp o un testimonio; exportar PNG o MP4, quitar fondo, stickers. (Quién lo propone no queda claro.) **BAJA**

2.12 [01:25:34] **Chat de edición** — Mostrar siempre los botones Discutir / Editar para que la persona decida entre preguntar, discutir o editar. **MEDIA**

2.13 [01:31:50] **Layout general** — Al entrar a una tab, plegar automáticamente la sidebar principal (propuesta de Martín por el bug 1.4). **MEDIA**

2.14 [01:37:19] **Carruseles / Web Generator** — Que el carrusel (formato 4:5) se pueda hacer tanto en Imagen como en Web Generator. Leila: en Gamma sale «mucho más rápido» que emulando Canva. **MEDIA**

2.15 [01:41:20] **Video Editor, edición automática** — Que ubique solo los resaltados y los subtítulos, ponga B-roll y haga el «switch» (cambio de plano), como le sale a Leila editando con su Claude. Martín: «implementar Submagic, implementar B-roll». **MEDIA**

2.16 [01:51:02] **Video Editor, estilo de B-roll** — Secuencias de fondo en blur con un texto muy grande tipo reflexión; Leila lo ve funcionar y dice que Claude lo hace fácil. **BAJA**

2.17 [00:52:20] **Copywriter** — Que use su «arsenal de contenido» (un .md con sus ganchos y formatos). (No se entiende bien si ya lo cargó ni dónde.) **BAJA**

---

### 3. Decisiones o ideas de Martín sobre cómo va a ser MaKo

3.1 [00:59:04] **Competitor Spy (tab nueva)** — Trae los Reels ganadores y los anuncios ganadores de la competencia, y replica sus landings con Replicar landing. Esta semana lo termina de bajar a tierra. También dice que puede copiar cualquier diseño [01:30:20]. **BAJA**

3.2 [00:59:43] **Centro de conocimientos + plantillas «de influencers»** — Adapta los cursos que están dentro de MaKo a un centro de conocimientos de copywriting para generar guiones al estilo de Ramiro Curia, Sofía Contreras, etc. Dice que ya mandó links scrapeados (Alejandra Rincón: no se entiende bien el contexto). **BAJA**

3.3 [01:00:33] **Strategy / «Estratega» (hoy «Media Buyer» o Ads Manager)** — Última pieza de MaKo. Gestiona estrategia y publicación solo, en Instagram, Meta Ads, LinkedIn, email, TikTok. Se alimenta de los cursos y funnels de Martín. Coordina las otras tabs: variaciones de hook en Trial Reels, subir, bajar o apagar presupuesto en Meta Ads, cambiar el título o color de la sección de la landing que no funcionó [01:23:29]. Hoy solo está configurado para Meta Ads. Quiere tenerlo esta semana [01:01:35]. **BAJA**

3.4 [01:02:13] **Strategy, script de Leila** — Quiere unir dentro de MaKo lo que Leila ya armó con su Claude (publica solo y va haciendo variaciones): «Me está faltando como unir todo eso». **BAJA**

3.5 [01:05:00] **AI Avatar** — Clon de Leila. Dice tenerlo bastante avanzado y que se parece mucho a Higgsfield. **BAJA**

3.6 [01:17:00] **Guía de IA en cada pestaña** — Si no sabes qué hacer, le preguntas a MaKo («¿qué hago acá?») y te arma un tutorial personalizado: «apretá este botón». **BAJA**

3.7 [01:19:19] **Plantillas propias, privadas o públicas, en todo MaKo, con estrellas** — Decisión dicha en voz alta (ver 2.5 y 2.6). **MEDIA**

3.8 [01:38:00] **QA con Claude** — Va a pedirle a su Claude que simule muchas experiencias de usuario dentro de MaKo (ejecutar una presentación, etc.) para detectar errores. **MEDIA**

3.9 [01:37:40] **Carruseles en ambos lugares** — Que se puedan hacer en Imagen y en Web Generator (ver 2.14). Dice que «todo partiría de que el segundo cerebro conozca tu brand board» (Leila). **MEDIA**

3.10 [01:42:17] **Criterio para recomendar MaKo** — Martín quiere resolver los «errorcitos» antes de recomendarlo a su círculo («Yo soluciono todo esto»). Leila: ya desde el lunes, para no trabarse haciendo tutoriales. **ALTA**

3.11 [01:06:00] **Extensión de Chrome** — Ya está actualizada: la persona no tiene que descargar nada aparte. **BAJA**

3.12 [01:06:31] **Seguridad** — Ya están authenticator, email de recuperación, llave de acceso, contraseña y códigos de recuperación descargables. Leila duda en activar la verificación en dos pasos («me rompe las bolas», no queda claro si finalmente la activa). Martín: son datos sensibles. **BAJA**

3.13 [01:07:17] **MaKo Desktop** — Funciona offline y sincroniza al reconectar; además permite conectar Claude/ChatGPT para que MaKo use los créditos de la suscripción de la persona, no su API (ver bug 1.12). **BAJA**

3.14 [01:18:01] **Calendario / Web Generator / lead magnets** — Ya se pueden programar publicaciones desde el calendario. En Web Generator se puede compartir como PDF y armar lead magnets tipo quiz cuyos leads caen al CRM [01:22:34] (Martín primero creyó que no estaba y luego confirma que sí). **BAJA**

3.15 [01:16:35] **Zernio** — Averiguó que no hay costo por mensaje como ManyChat (que cobra más cuantos más mensajes mandas). El límite es de mil mensajes por hora y, si se pasa, bloquea. **BAJA**

3.16 [01:14:00] **Planes y landing de MaKo** — Cambió «SaaS» por «software» en la landing principal («sas lo entendemos solamente los nerds»). El plan 47 tiene un solo funnel; Martín cree que a un cliente que solo quiere seguimiento le alcanza el de 47, no necesita el de 97. Leila notó que la tarjeta de precios parecía sin actualizar (no se entiende qué parte). **BAJA**

3.17 [01:57:03] **Classroom / Cursos desde el Segundo Cerebro** — Idea: que MaKo (Strategy / Ops), según tu promesa de valor, te diga qué cápsulas o módulos necesita tu curso y los ordene según la oferta. Martín cree que sirve para diseñar la mentoría de MaKo y Lidermente. **BAJA**

3.18 [01:02:49] **Ticketera** — Pedirle al Claude de la persona que levante un ticket directamente en MaKo cuando algo falla. Leila usa mucho la ticketera; Martín: «yo ni me entero» de cómo se van resolviendo [00:42:41]. **BAJA**

3.19 [00:44:00] **Envíos con variantes** — Martín recuerda que MaKo permite mandar mensajes distintos a distintos contactos (ver sección 5). **BAJA**

3.20 [01:56:46] **Gestor de comunidades** — Leila menciona «una más… para el gestor de comunidades», sin que se entienda si es un tutorial o una función. (No se entiende.) **BAJA**

---

### 4. Promesas o tareas concretas

De Martín:

4.1 [01:13:43] **Percho** — Prueba gratuita de 7 días de MaKo para Percho, un conocido de Leila que preguntó si hay precio amigo. Su dolor es el seguimiento y con el plan de 47 le alcanza. El envío del link no se dice textualmente; es la promesa implícita. **MEDIA**

4.2 [01:54:39] **Reunión del lunes** — Lunes a las 12:00 hora de Leila (las 14:00 de Martín), de 1,5 a 2 horas. Leila también propone dejar fijo el horario de los viernes [01:55:49] (no se entiende bien si es el mismo). **MEDIA**

4.3 [01:42:17] **Resolver los errores antes del lunes** — Chat de carruseles, imágenes, subtítulos y lo demás, para que Leila empiece los tutoriales y la recomendación. **ALTA**

4.4 [00:37:26] **Black November, embudo y automatizaciones** — Leila pide ayuda «para pedirle la lógica a MaKo» (condiciones, etiquetas, a qué funnel mandar). Martín ofrece revisarlo juntos [00:42:08] y dice «las cosas que se me van ocurriendo te las voy pasando» [00:46:41]. Compromiso implícito. **MEDIA**

4.5 [00:48:50] **Variable de nombre** — Opción de primer, segundo, tercer nombre o completo (ver 2.1). **ALTA**

4.6 [00:59:04] **Competitor Spy esta semana** — Cierra el análisis de competencia (ver 3.1). **BAJA**

4.7 [01:01:35] **Strategy esta semana** — Lo quiere tener esta semana (ver 3.3). **BAJA**

4.8 [01:19:19] **Plantillas propias** (privadas o públicas) en todas las tabs, y estrellas [01:28:37]. **MEDIA**

4.9 [01:41:39] **Submagic y B-roll** — «Implementar Submagic» y B-roll, junto con Competitor Spy y el feedback de la llamada. **MEDIA**

4.10 [01:37:40] **Carruseles en Imagen y en Web Generator.** **MEDIA**

4.11 [01:38:00] **QA automático con Claude** simulando usuarios. **MEDIA**

4.12 [01:25:34] **Botones Discutir / Editar** siempre en el chat de edición. **MEDIA**

4.13 [01:09:46] **Conectar GPT desde la computadora.** **MEDIA**

4.14 [00:47:29] **Mejorar el diseño del desplegable** de Mensajes de difusión en el CRM. **BAJA**

4.15 [00:51:08] **Videos de sugerencias de MaKo** para Leila: «Yo te voy a hacer muchos videos». **BAJA**

4.16 [01:04:00] **Terminar el AI Avatar** (clon de Leila). **BAJA**

4.17 [01:17:00] **Guía de IA por pestaña.** **BAJA**

De Leila:

4.18 [01:54:29] **Black November** — Define la oferta y la lógica, lo arma en MaKo y le va comentando (ver sección 5). **MEDIA**

4.19 [01:56:27] **Tutoriales (Loom) de todo MaKo**, una vez resueltos los errores. Quién lo dice exactamente: la etiqueta está invertida. **MEDIA**

4.20 [00:51:26] **Video testimonio** del coaching de MaKo («lo co-creamos juntos»): se lo pide Martín y ella acepta. El programa exacto no queda claro. **BAJA**

4.21 [01:18:40] **Pulir su oferta** en MaKo para ver todo lo nuevo. **BAJA**

4.22 [01:52:12] **Anuncios** — La semana que viene empieza a preparar el terreno para invertir en anuncios y grabarlos todos con MaKo. **BAJA**

4.23 [00:40:52] **Zernio** — Martín recuerda que ayer ella le pidió «conecta a Zernio con otra cuenta» (no se entiende el contexto; podría ser un segundo Zernio o una cuenta adicional). **BAJA**

---

### 5. Lo que Leila necesita de MaKo para Black November

Contexto [00:38:23]: usar MaKo para una secuencia de Black November a todo su historial de alumnos online. Canal: WhatsApp. Martín le ofrece email y ella lo descarta. Es cash flow: «si no sale tampoco me quita nada» [01:53:00]. El resumen de Fathom habla de «3.000 contactos», pero ese número en la transcripción es de los leads de Jerry; el tamaño real de su base no se dice.

5.1 [00:38:23] **Volumen** — Que todos los días mande mensaje a los que se pueda, 50 a 100 por día. **MEDIA**

5.2 [00:39:10] **Segmentos (tres ramas)** — (a) quienes no hicieron la Academia del Coach: oferta única a mil dólares; (b) quienes ya la hicieron: coaching 1:1 con ella; (c) dueños de negocio: Lidermente Online. Hace falta poder segmentar por esas condiciones (etiquetas o campos en el CRM). Leila: «quiero tirar la casa por la ventana». **ALTA**

5.3 [01:54:00] **Base de datos** — Ya la tiene: es el CRM exportado de la academia, no quiere crear uno nuevo en MaKo. Necesita importarlo y segmentarlo. **MEDIA**

5.4 [00:47:43] **Segundo nombre** — Sus contactos son «[ciudad/país] Nombre Apellido». Sin esto el mensaje saldría «Hola MX» o «Hola Kun» (ver 2.1). Es lo más urgente. **ALTA**

5.5 [00:50:04] **Nombre en el chat** — Poder ver en los chats el nombre como lo agendó (ver 2.2). **MEDIA**

5.6 [00:37:52] **Lógica del embudo** — Le cuesta definir las condiciones: qué etiqueta ponerle y a qué funnel mandarlos. Quiere «pensar el embudo más que la automatización» [00:38:00]. Necesita que Martín la ayude (ver 4.4). **ALTA**

5.7 [00:42:00] **Reglas de envío** — Por ejemplo, de 10 de la mañana a 8 de la noche. Martín le mostró que MaKo ya tiene horario por automatización y goteo con tope diario [00:45:30]; el bug 1.7 muestra que no estaba claro. **ALTA**

5.8 [00:44:00] **Variantes de mensaje** — Lección del bloqueo de 24 horas en el número de Mauricio: pasó de unos 20 por día a 60, los mensajes eran idénticos y posiblemente lo reportaron. Martín: en MaKo se puede configurar que a algunos les mande uno y a otros otro. Leila ya usaba tres variantes antes [00:44:20]. Necesita este esquema y ramp-up gradual. **ALTA**

5.9 [00:41:03] **Funnels y nutrición actuales** — Separó los funnels y armó uno general con nutrición de unos 12 seguimientos «muy cápsula», para quienes vienen de eventos como Hagamos Negocios. Se siente «un poquito nublada con el esquema» [00:41:42]: no sabe cómo encajar Black November con eso. **MEDIA**

5.10 [00:47:00] **Envío desde el CRM** — Usar Mandar mensajes desde los tres puntitos de la columna para el segmento (ya existe). **BAJA**

5.11 [00:46:30] **Métricas clicables** — Ver quiénes respondieron para seguir a esas personas (ver 2.3). **MEDIA**

5.12 [00:39:00] **Mensaje base** — Texto personalizado para cada rama, con tono de «yo sé que me sigues hace mucho tiempo». Lo arma en MaKo con Copywriter/Automations. **BAJA**

5.13 [01:53:00] **Embudo todo por mensajería** — Leila le dice a un tercero que lo hará «por mensajería» con MaKo; MaKo «te va mandando mensajitos cuando ya lo va teniendo todo» (esta última frase: no se entiende bien). **BAJA**

5.14 [01:23:00] **Landing de la oferta** — Si hace una página para Black November, le sirve cuenta regresiva, escasez y pops (ver 2.10). Leila no lo pide expresamente para esta campaña. **BAJA**

5.15 [01:16:35] **Zernio** — El límite de mil mensajes por hora no afecta un envío de 50 a 100 al día. **BAJA**

---

## 2. Lo que ya está hecho y volvió con fallas (lo retoma la próxima cuenta)

Cada uno tiene su devolución de Integración en la carpeta compartida
(`C:/Users/marti/AppData/Roaming/Claude/side-session-notes/local_428051c1-0369-4df2-ae6b-bcb42f63b64b/`).

- **Calendario y Classroom.** Tiene MaKo al costado, menos botones de Google, las reuniones de entrega, y Clientes y Miembros
  juntos en Classroom. Quedó afuera del tren por 4 fallas en la pantalla de Clientes; una es de privacidad: el super admin, sin
  entrar como el cliente, no puede ver las fichas. Detrás espera el arreglo del **botón de MaKo que tapa contenido** en
  Calendario (la casilla de los calendarios de Google), Plan, CRM y Dashboard.
- **Agency, lo prometido a Thiago.** 3 fallas: puede mostrar datos de otro cliente cuando entrás como un cliente, el plan se ve
  en cuentas no aprobadas y faltan las zonas de México. La reunión con Thiago es el **jueves 5/11 a las 17 h**.
- **Newsletter** (el CRM «Newsletter» y la tab de ediciones). Cualquier admin de un negocio entra a la tab y a su API, no sólo
  vos; además hay un doble envío en «Enviar ahora», lo programado sale vencido cuando el email está apagado, y archivar el CRM
  no frena sus ediciones. Hoy no hay riesgo, porque nadie tiene el email prendido.

## 3. Lo que pediste y falta construir

1. **MaKo toma la iniciativa.** La base está en producción (MaKo abre cada chat con una pregunta, la guía con el fondo opaco).
   Falta:
   - el primer ingreso completo: bienvenida, cargar la oferta y elegir funnel o que MaKo lo recomiende;
   - las aperturas y la guía señalando en cada tab, de a una: Offer, Create, CRM, Dashboard, Automations, Web Generator,
     Calendario, Video, Image, Classroom, AI Avatar y Mobile.
2. **Plantillas que muestran lo que vas a crear**, con la estructura, «Ver ejemplo» y MaKo preguntando para qué es. Está en el
   Copywriter; falta en el resto de las tabs (va con el punto 1).
3. **El conocimiento de los cursos de Knowledge** para toda MaKo, modular como el Second Brain. El análisis quedó pausado; no
   hay plan ni nada construido.
4. **Lead Magnet Generator, Competitors Spy y las tendencias del nicho.** Hay relevamiento; falta el plan y construirlo.
5. **Los patrones de email de tu Gmail** (70 remitentes, unos 5.050 emails, ya en producción como documento) usados de verdad:
   las plantillas de email del Copywriter, las ediciones del Newsletter, los recordatorios de llamada en Automations y los
   mensajes de WhatsApp. Quedaron sin analizar los ~59 posteos de Marcos Razzetti en su comunidad y otros ~120 emails de un
   autor en inglés.
6. **Video Editor, «revisá bien todo».** En producción: la barra del Reproductor, la línea de tiempo y los paneles laterales.
   Falta la cabecera, y la parte de imagen y movimiento (Motion), que sigue sin su verificación final.
7. **El recorrido visual de toda la app.** Se miraron 8 de 22 pantallas y salieron 27 problemas: el más grave (el botón de
   MaKo) ya está arreglado y espera con Calendario; quedan 22 sin repartir (Plan, CRM, Dashboard, Automations, Ops Center,
   la landing y textos en inglés). Faltan las otras 14 pantallas.
8. **Lo de la llamada con Thiago que todavía no existe:** «Guardar en MaKo» desde un perfil de Instagram en la extensión; la
   guía «Migrar tu CRM con Claude» en la API; el token de agencia; en Calendario, anuncio y email enlazados y las reuniones
   del equipo por persona; «Usar en un anuncio» desde los editores y el AI Avatar; en Ads, variar el CTA y pausar el original
   cuando una variación le gana; las reservas de Google Calendar como etapa del CRM. La lista completa:
   `docs/promesas/2910-llamada-thiago.md`.
9. **Image Editor:** el chat usa Gemini por defecto, y decidiste «sin Gemini» (22/10).
10. **Restos chicos de los tickets de hoy:**
    - Zernio: gastar menos pedidos al conectar, y que los otros lugares que muestran «no contestó» ante un 429 digan «pausa»
      (Automations, Calendario).
    - Automations: el paso que muestra la API en una inscripción sin tarjeta; guardar lo que manda Instagram al tocar un botón.

## 4. Lo que es tuyo

- Generar un look real del AI Avatar en el negocio de prueba.
- Mandarle a Thiago la grabación de Fathom de la llamada y confirmar la hora del jueves.
- Stripe en modo real y los precios en euros.
- El clic de la prueba de anuncios por Zernio.
- LinkedIn en Chats y Automations: no oficial, partner sólo para Páginas, o no hacerlo y aclararlo.

## 5. Lo que se hizo hoy y ya está en producción

- Leila: «Borrar silencios» busca en todo el video (tickets #31 y #32, avisada).
- Código Inmobiliario: MaKo ya no inventa la hora de las reuniones (#35) y Zernio pide «pausa» en vez de reconectar (#34).
- Leandro: el botón de un DM viejo funciona y sus 8 secuencias volvieron a su estado (#33); la guía de botones de Instagram (#30).
- MaKo toma la iniciativa (la base), las tarjetas del Copywriter con «Ver ejemplo», el Video Editor (Reproductor, línea de
  tiempo, paneles), la privacidad de MaKo en WhatsApp y los patrones de email.
- Cinco cambios en la base, entre ellos el que hace andar «Invitar en cualquier etapa» de los cursos.
- La investigación de Gmail, mandada a Mauricio.
