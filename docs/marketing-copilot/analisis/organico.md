# Análisis de lo orgánico en «Tu negocio»: Instagram, YouTube, la web y la máquina de contenido

> Relevo de los cursos de Knowledge (11/11/2026) para el rediseño de Marketing CoPilot. Pedido de Martín: cada canal de «Tu negocio» no es una réplica de la plataforma, es un ANÁLISIS con los puntos que hay que tocar según los cursos y feedback en cada uno; además, una «máquina de contenido» y una pestaña «Tu web».
> Construye sobre `funnels/organico-instagram.md`, `funnels/youtube-newsletter.md`, `funnels/piezas.md` y `funnels-simples.md`: no repite lo que ahí ya está (quién contesta los mensajes, qué se mide en general, lead magnet, newsletter). Aquí va lo que MaKo debe REVISAR en la cuenta de la persona.
> Fuentes como «curso (slug) · n — título corto». Los números van con el nombre de quien los dice: son cifras de cada docente, no promedios del mercado. Los ejemplos de feedback están en tú.

## 0. Qué dato tiene MaKo y qué no (condiciona todo lo demás)

**Instagram (Competitor Spy y lector de perfil, `lib/instagram-perfil.ts`, `lib/spy-medio.ts`, `lib/spy-transcripcion.ts`):**
- Del perfil: bio, enlace de la bio (web), seguidores, cantidad de publicaciones.
- De cada pieza (hasta 25 en la lectura de piezas; 6 en la lectura liviana): tipo (reel, carrusel, imagen), láminas del carrusel cuando la fuente las da (con Meta oficial queda en null), texto o caption, fecha, vistas, me gusta, comentarios, enlace a la pieza y miniatura.
- Transcripción del reel: se hace sola y en segundo plano, se guarda 30 días; puede estar pendiente.
- **Un contador ausente no es cero**: el dueño puede ocultar likes, comentarios y vistas uno por uno; ahí el campo no viene y MaKo no lo juzga (regla de `lib/spy-reglas.ts`).
- **NO tiene:** historias (ni cuántas ni si venden), destacadas, el CTA hablado dentro del reel si no hay transcripción, ni el horario de las historias. Esos puntos se preguntan a la persona (una pregunta cerrada) o se marcan «sin dato»; nunca se inventa «0 historias». Si la cuenta propia está conectada por Meta podría leerse más, pero no lo verifiqué en el código.

**YouTube (`lib/spy-youtube.ts`):** del canal, nombre, descripción, suscriptores, videos y @; de cada video, título, descripción (cortada), fecha, etiquetas, miniatura, duración, vistas, me gusta y comentarios. **No tiene:** retención, CTR, comentario fijado, listas de reproducción, tarjetas ni pantallas finales de un canal ajeno. Esos se piden a la persona (capturas de Studio) o se marcan «sin dato». Cuidado: desde el 24/8/2026 YouTube cambió cómo cuenta las vistas; el salto de esa fecha no es del canal.

**Web:** ya existe el Landing Analyst (sección 3). Lee el copy en orden y el comportamiento real medido por el Pixel; nunca estima métricas.

Regla general: **MaKo juzga contra lo que la persona vende (su oferta y su funnel), no contra «las buenas prácticas»**. Casi todos los puntos de abajo dicen «coherente con la oferta».

---

## 1. Instagram: qué revisa MaKo

Orden sugerido en pantalla: Perfil → Contenido → Cadencia → Historias → Conversión.

### 1.A Perfil

**1. Nombre de usuario, nombre y palabra clave**
- Dato: usuario y nombre del perfil.
- Criterio: usuario simple, fácil de leer y de encontrar, sin guiones bajos ni símbolos que compliquen la búsqueda, igual en todas las plataformas (masteryhaus · 212 — Optimización del perfil). El nombre descriptivo lleva una palabra clave del negocio, porque Instagram posiciona por ahí (emprende-con-instagram · 13 — Propuesta de valor; bluehacker · 342 — Cuenta de IG optimizada).
- Feedback: «Tu usuario tiene dos guiones bajos y un punto. Quien te vio una vez no te encuentra después. Y tu nombre no dice a qué te dedicas: añade una palabra clave del servicio».

**2. Foto**
- Dato: la foto no se lee como texto; MaKo solo puede avisar si no hay o si el perfil es de marca sin cara (la imagen sí se puede mirar con visión si el producto lo decide).
- Criterio: cara clara y de calidad, fondo simple, si es una marca personal (bluehacker · 341 — Optimización de perfil); logo o cara, con rasgos distintivos que se reconozcan en miniatura, la misma en todas las plataformas (masteryhaus · 212).
- Feedback: «Tu foto es un logo ilegible en miniatura. En una marca personal, una cara conecta más».

**3. Bio: qué haces, para quién, con qué resultado**
- Dato: texto de la bio.
- Criterio: tres respuestas en dos renglones: a quién ayudas, qué resultado logra y cómo (bluehacker · 341). La versión de Emprende: qué haces, a quién ayudas, cómo y para qué; sin eslóganes vagos; si vendes solo a una zona, dilo (emprende-con-instagram · 13). Masteryhaus llama a esto la frase ABC y pide que se entienda en una oración (masteryhaus · 212). Social Funnel lo divide en autoridad, vehículo y llamado (social-funnel · 10 — Social Landing Page).
- Feedback: «Tu bio habla de ti pero no dice a quién ayudas ni qué logra esa persona contigo. Reescríbela con este molde: ayudo a [quién] a [resultado] con [cómo]».

**4. Llamado a la acción de la bio: uno solo, ligado a la oferta**
- Dato: la última línea de la bio y el enlace. MaKo compara con la oferta que la persona declaró (Offer).
- Criterio: la bio necesita un CTA que invite a tocar el enlace, con una flecha o un dedo hacia abajo (emprende-con-instagram · 13; bluehacker · 341; social-funnel · 10). Debe prometer lo mismo que hay detrás del enlace (social-funnel · 10; manychat-master-instagram · 14 — Dónde mando, según el relevo previo). **Ninguno** es el error de no pedir nada. **Varios** es el error de repartir la atención: Emprende los llama puntos de fuga (emprende-con-instagram · 13) y Blue Hacker desaconseja Linktree porque la gente se desenfoca (bluehacker · 341).
- Feedback: «Tu bio no pide nada. Añade una línea como "Agenda tu diagnóstico gratis" con una flecha al enlace. Y hoy tu enlace lleva a tres cosas distintas; deja la que corresponde a lo que vendes».

**5. Enlace de la bio**
- Dato: la URL de la bio. MaKo puede leer el destino con el lector de landing (detecta formulario, video, agenda, WhatsApp).
- Criterio: un solo enlace a un funnel o, si no hay, a la agenda con preguntas de filtro (bluehacker · 341). Si todavía no hay web, un mensaje directo («escríbeme un DM») es válido (emprende-con-instagram · 13). El destino pesa tanto como el contenido (manychat-master-instagram · 14, relevo previo). Postura distinta: Masteryhaus usa varios enlaces o una landing propia con todos los recursos (masteryhaus · 212); Growing dice que sin mensajes que te desborden no se pone enlace (growing-content-specialist · 84, relevo previo). Ver sección 5.
- Feedback: «Tu enlace lleva a la portada de tu sitio. Quien llega desde Instagram ve un menú, no tu oferta. Llévalo directo a la página de [oferta]».

**6. Hashtags y enlaces a otras cuentas en la bio**
- Criterio: ninguno; son puntos de fuga (emprende-con-instagram · 13). Excepción de Masteryhaus: un hashtag propio para instalar el nombre del podcast (masteryhaus · 212).
- Feedback: «Tu bio tiene un hashtag y una mención a otra cuenta: son salidas del perfil. Quítalos salvo el que sea el nombre de tu programa».

**7. Tipo de cuenta, categoría y botón de contacto**
- Dato: no siempre llega en la lectura; se pregunta.
- Criterio: creador para marca personal, empresa para negocio; la categoría puede ocultarse; la información de contacto se activa en «Mostrar información de contacto» (emprende-con-instagram · 16 — Tipo de perfil y de cuenta). Una cuenta personal no muestra estadísticas (ídem).
- Feedback: «Tu cuenta es personal: no te da métricas. Pásala a creador o empresa».

**8. Verificación**
- Criterio: transmite confianza; Masteryhaus la considera una inversión necesaria, aunque se pague (masteryhaus · 212). Es opinión de un solo curso: nunca como falla, solo como sugerencia.

**9. Destacadas**
- Dato: **no está en Spy**; se pregunta («¿tienes destacadas?, ¿cuáles?»).
- Criterio: máximo cinco, con portada de marca (bluehacker · 341). Las que cita Emprende: quién soy, preguntas y respuestas, opiniones de clientes, productos y servicios, tips (emprende-con-instagram · 14 — Historias destacadas). Bluehacker: casos de resultados, servicios con un llamado al final. Masteryhaus ancla historias antiguas que cuentan el origen y dan autoridad (masteryhaus · 212).
- Feedback: «No tienes una destacada de resultados de clientes. Es lo primero que mira alguien que aún no te conoce».

### 1.B Contenido

**10. Mezcla de formatos: qué publicas y qué NO publicas**
- Dato: conteo de piezas por tipo (reel, carrusel, imagen) en las últimas piezas leídas, con su porcentaje.
- Criterio: los reels son la puerta para llegar a gente nueva; los carruseles bajan conceptos difíciles de condensar en un reel, hasta 10 láminas (masteryhaus · 213 — Formatos de contenido); las fotos y el texto sirven para el vínculo. El reto de Emprende pide al menos un reel o un carrusel entre las tres publicaciones de la semana (emprende-con-instagram · 21). Heras pide variar el formato también dentro de las historias (master-marca-personal-5-0 · 58). Ningún curso da un porcentaje ideal de cada formato; MaKo no inventa uno: señala **ausencias** («no publicas carruseles») y **concentración** («todo es reel»), y pregunta si es a propósito.
- Feedback: «En tus últimas 20 piezas, 20 son reels y ninguna es carrusel. Los reels te traen gente nueva; un carrusel de 7 u 8 láminas sirve para explicar el método paso a paso. Prueba uno por semana».

**11. Pilares de contenido (variedad de temas)**
- Dato: MaKo agrupa por tema los textos y transcripciones.
- Criterio: de cuatro a seis pilares (emprende-con-instagram · 18 — Pilares de contenido). El Método Contenido Irresistible usa siete: producto, historias interesantes, promociones, nuevos productos, educativo, testimonios y opinión personal (metodo-contenido-irresistible · 16 — Pilares: Productos); para marca personal cambia la lista (metodo-contenido-irresistible · 22, relevo previo). Growing los reduce a tres tipos de valor: informar, entretener, motivar (growing-content-specialist · 44 — Tres tipos de valor).
- Feedback: «El 90% de tus piezas habla del mismo tema y no hay una sola de testimonios. Añade casos de clientes, que son los que más pesan en la decisión».

**12. Mezcla alcance / nicho / venta**
- Dato: MaKo clasifica cada pieza: amplia (llega a cualquiera interesado en el tema grande), de nicho (nutre a tu avatar), de venta (pide una acción).
- Criterio (growing-content-specialist · 41 — Nicho, mainstream y venta): para quien está empezando, 70% amplio y 30% de nicho; para una cuenta avanzada, mitad crecer y mitad nutrir; y al menos un video por semana que invite a comentar una palabra clave por mensaje. Es una receta de un solo curso: se presenta como «una forma de hacerlo», no como regla.
- Feedback: «Todas tus piezas son de nicho muy cerrado: te ven los que ya te conocen. Si quieres crecer, necesitas contenido más amplio dentro de tu tema».

**13. Hook (primeros segundos) del reel**
- Dato: la primera frase de la transcripción y el texto en pantalla si hay.
- Criterio: el gancho se juega en los primeros 3 segundos y puede estar en el guion, en lo visual y en el sonido (masteryhaus · 216 — Estructura de contenidos); es lo más importante del contenido (masteryhaus · 173 — Estructura de contenido ganador). Growing propone dos hooks por video (growing-content-specialist · 42). Inteligencia Viral lo trata como la decisión de si el espectador se queda (inteligencia-viral-2026 · 13 — Los primeros segundos). Estructura de piezas: gancho, contexto, llamada (masteryhaus · 173).
- Feedback: «Tu reel de las 3 mejores empieza con "hola, hoy les voy a hablar de...". Esa frase no da razón para quedarse. Empieza por el resultado o por la pregunta incómoda».

**14. Llamado a la acción en cada pieza: con un objetivo**
- Dato: la última frase de la transcripción o el caption; si pide palabra clave, MaKo la reconoce.
- Criterio: cada video debe tener un objetivo antes de grabarse; el CTA promete algo que la persona necesita; a veces no hay CTA y está bien si el objetivo es solo alcance (master-marca-personal-5-0 · 47 — Llamada a la acción). La palabra clave en comentarios activa una automatización con entrega de un recurso (manychat-master-instagram · 8, 9, 15; bluehacker · 244, por el relevo previo): una sola palabra por publicación. Blue Hacker pide al menos una publicación o historia con CTA al día (bluehacker · 340 — Stories marketing). Social Funnel pide al menos cuatro llamados por semana sin cansar, variando su forma (social-funnel · 11 — Infinite CTAs).
- Feedback: «Ninguna de tus últimas 12 piezas pide nada. Entre ellas, elige las dos mejores y termínalas con una palabra clave que entregue tu guía».

**15. Desempeño contra tus propios seguidores**
- Dato: vistas del reel contra seguidores del perfil.
- Criterio: Heras: las vistas medias de los reels deben pasar el 30% de los seguidores; en una cuenta que no llega y no arranca, a veces conviene empezar de cero (master-marca-personal-5-0 · 48 — Cómo saber si un video va bien; también 21). Es regla de un solo docente, dicha para Instagram. Jaque Blue: los me gusta rondan el 10% de las vistas, pero lo que hace viral es que se vea hasta el final (jaque-blue-creacion-de-contenido · 18 — Comunidad).
- Feedback: «Tus reels tienen en promedio unas vistas por debajo del 30% de tus seguidores (regla de Víctor Heras). Mira los 3 que superaron esa marca y repite su gancho».

**16. Consistencia con la oferta**
- Dato: MaKo compara el tema de las piezas con la oferta y el avatar declarados.
- Criterio: un perfil sin claridad sobre a quién ayuda y a qué no convierte (bluehacker · 341; growing-content-specialist · 84, relevo previo). El contenido tiene que atraer a quien después compra; ampliar el público sin perder esa conexión (master-marca-personal-4-0 · 60 y 61, relevo previo).
- Feedback: «Tu oferta es para dueños de clínicas, pero tus reels hablan a emprendedores en general. Quien te sigue por ahí no es quien compra».

**17. Texto de las piezas (caption)**
- Criterio: palabras clave del tema, porque Instagram ya posiciona por texto (emprende-con-instagram · 13). Hashtags: los cursos no coinciden (sección 5).

### 1.C Cadencia

**18. Frecuencia de reels y carruseles**
- Dato: fechas de las piezas leídas → publicaciones por semana, y huecos.
- Criterio: en la sección 4 se ponen los rangos de cada curso; aquí MaKo juzga: (a) **regularidad**, porque publicar cuando hay tiempo es peor que no hacerlo (bluehacker · 342) y el algoritmo premia el horario estable (universidad-de-youtube · 34, para YouTube); (b) **hueco largo**: Blue Hacker dice que con más de tres meses sin publicar conviene evaluar una cuenta nueva (bluehacker · 342).
- Feedback: «Publicaste 9 veces en el último mes, pero 6 fueron en una sola semana. Con la misma cantidad repartida en 3 por semana pesa más».

**19. Fechas y horarios**
- Criterio: no coinciden (sección 5). MaKo no impone hora: sugiere probar y medir.

### 1.D Historias (casi todo se pregunta)

**20. Cuántas historias y cuántos días por semana**
- Dato: **sin dato en Spy**. MaKo pregunta: «¿cuántos días por semana subes historias y más o menos cuántas por día?».
- Criterio: rangos de la sección 4 (Blue Hacker, Masteryhaus, Stories Master). En todos: las historias son para quien ya te sigue, no para llegar a gente nueva (stories-master · 3, relevo previo; master-marca-personal-5-0 · 57).
- Feedback: «Dices que subes historias un día por semana. Las ven los más comprometidos de tus seguidores: para ellos eres casi invisible seis días de siete».

**21. ¿Hay historias de venta?**
- Dato: pregunta («¿has subido esta semana alguna historia que ofrezca algo?»).
- Criterio: las historias de venta tienen gancho, contexto y llamada (stories-master · 10 — Estructura perfecta de ventas); una sola oferta por secuencia (stories-master · 17 — No negociables); no pasarse de unas nueve historias por secuencia, porque el alcance baja (stories-master · 10); alternar formatos y no hablar un minuto seguido a cámara (master-marca-personal-5-0 · 58 — Errores en historias). Después de la primera historia, una de prueba social antes del llamado (bluehacker · 340). Son las historias donde está el oro de ManyChat (manychat-master-instagram · 10, relevo previo).
- Feedback: «Subes historias, pero ninguna con una oferta. Prueba una secuencia de 5 con este esquema: gancho, dos de contexto, una de prueba y una con la llamada».

**22. Semana de venta (ritmo semanal)**
- Criterio: la plantilla de Heras: lunes y martes sobre el problema; miércoles el método; jueves responde dudas; viernes un caso de éxito; sábado pregunta si quieren; domingo muestra la demanda; lunes siguiente abre plazas (master-marca-personal-5-0 · 62 — Plantilla para ganar dinero en una semana). Stories Master propone un reto de 7 días con valor el último día (stories-master · 19 — Convierte desde stories).
- Feedback: «Antes de lanzar tu programa, dedica una semana de historias a una sola idea por día. Empieza hablando solo del problema».

**23. Interacciones en historias**
- Criterio: caja de preguntas (genera conversaciones uno a uno y vende en privado), cuestionarios para segmentar y educar (stories-master · 6 — Elementos de venta); hay que contestarse las primeras preguntas si la comunidad es chica (stories-master · 6; emprende-con-instagram · 14).

**24. Descanso y horario de las historias**
- Criterio: como mucho un día de descanso seguido; al tercer día cae el alcance (stories-master · 18 — Trucos para vender). Masteryhaus lo contradice a propósito: pausa de 48 horas (sección 5). El horario de ventas, al final del día o en horario laboral, según dónde esté tu gente (stories-master · 18).

### 1.E Conversión

**25. A dónde manda cada pieza y qué recibe a cambio**
- Dato: palabra clave y destino citado en el caption o la transcripción.
- Criterio: un trato claro: quien comenta o escribe recibe algo (relevo previo, manychat-master-instagram · 8 y 16). El destino debe ser coherente con el anuncio y la bio (punto 4).
- Feedback: «Tu reel promete una plantilla pero tu bio manda a agendar una llamada. Alinea las dos».

**26. Prueba social visible**
- Criterio: casos y testimonios en destacadas, en carruseles y en historias antes de pedir (bluehacker · 340 y 341; emprende-con-instagram · 14). La reputación pesa más que el número de seguidores (growing-content-specialist · 52, relevo previo).

**27. Lives**
- Dato: no está en Spy; se pregunta si los hace.
- Criterio: no dependen de la audiencia: el primero puede tener diez personas (metodo-fukuda-poder-organico · 37, relevo previo); nutren en Instagram (masteryhaus · 217).

---

## 2. YouTube: qué revisa MaKo

**1. Nombre, descripción del canal y enlaces**
- Dato: nombre, descripción del canal, @.
- Criterio: el canal con enlaces a la tienda o la landing (nuevo-organic-ecom-3-0-junio-2026 · 52 — Dónde pongo el enlace). Cuenta de marca con identidad clara: logo, banner y nombre (universidad-de-youtube · 14 a 17, por título; no leídas a fondo).
- Feedback: «La descripción de tu canal no dice a quién ayudas ni qué enlace seguir. Es lo primero que lee quien llega por un video».

**2. Títulos: palabra clave y emoción**
- Dato: títulos de los últimos videos.
- Criterio: el título cumple dos funciones: palabra clave para posicionar y gancho para el clic (masteryhaus · 184 — Thumbnails y títulos). Aporta valor adelantado y genera curiosidad (masteryhaus · 184). Emociones como miedo, escasez o deseo, mayúsculas selectivas y un emoji para guiar la vista (monetizatube · 19 — Títulos). Se prueban varios con VidIQ (universidad-de-youtube · 31 — Cómo optimizar títulos). Los dos deben ser coherentes con lo que hay en el video (masteryhaus · 186).
- Feedback: «Tres de tus últimos cinco títulos no tienen palabra clave que alguien escribiría en el buscador. Prueba: "Cómo [resultado] sin [obstáculo]"».

**3. Miniaturas**
- Dato: miniatura de cada video (MaKo guarda el archivo, así que la puede mirar).
- Criterio: llamar la atención en una fracción de segundo, colores saturados, poco texto y que complete el título; en marca personal, la cara (monetizatube · 20 — Miniaturas). Título y miniatura se piensan juntos y antes de guionar el video (masteryhaus · 184). Se prueba con A/B (masteryhaus · 185, no leída). Si el video queda estancado, se cambia el título o la miniatura (universidad-de-youtube · 33). Una miniatura floja con buen video es un error clásico (aumenta-tu-valor-y-atv-advantage · 55, relevo previo).
- Feedback: «Tus miniaturas repiten el título con letra pequeña. Deja 3 palabras y tu cara».

**4. Primeros segundos y apertura**
- Dato: transcripción (Gemini transcribe el enlace del video) → primeras frases.
- Criterio: entre el 30 y el 40% se va en los primeros 30 segundos, según Monetizatube; la apertura debe ser rápida, sin presentarse ni explicar el canal (monetizatube · 21 — Buenas introducciones). La introducción propia, si la hay, corta y metida después de un minuto o más. Un llamado inicial a quedarse hasta el final suma retención (universidad-de-youtube · 23 — Retención). Gancho y guion con estructura (masteryhaus · 186).
- Feedback: «Tu video empieza con 25 segundos de presentación. Muestra primero lo que va a lograr quien lo ve».

**5. Largo del video**
- Dato: duración.
- Criterio: no hay acuerdo (sección 5). Para captar clientes: 10 a 20 minutos convierten (instituto-de-marca-personal · 29, relevo previo); la masterclass recomienda probar formatos más largos para tickets altos (youtube-2026 · 1); Monetizatube ubica 8 a 12 minutos para AdSense (relevo previo; no aplica a captar clientes). MaKo no dice «alarga»: compara contra el objetivo (captar o monetizar) y contra la retención si la persona la comparte.

**6. Descripción: estructura, enlace y palabras clave**
- Dato: descripción de cada video (cortada).
- Criterio: tres partes: descripción del video, índice de capítulos y descripción general del canal (masteryhaus · 190 — Cómo subir videos). Universidad de YouTube añade un párrafo con llamado a la acción (universidad-de-youtube · 33). El enlace va en la descripción (masteryhaus · 174, relevo previo; metodo-fukuda-poder-organico · 61, relevo previo) o en un comentario fijado con una frase en la descripción que lo anuncie; el curso Organic Ecom aclara que sin la cuenta verificada no se puede fijar (nuevo-organic-ecom-3-0-junio-2026 · 52). Una descripción mal armada pierde leads (aumenta-tu-valor-y-atv-advantage · 55, relevo previo).
- Feedback: «Tu descripción está vacía salvo un enlace. Abre con 2 líneas que repitan la palabra clave del título y pon el enlace de [oferta] antes del corte de "ver más"».

**7. Llamado a la acción dentro del video**
- Dato: transcripción (a mitad y al final).
- Criterio: un pedido claro y único; a mitad del video si el objetivo es agendar (bluehacker · 404, relevo previo). Tres momentos según Universidad: al inicio (quedarse hasta el final), tras la introducción (suscribirse) y al final (universidad-de-youtube · 23). Cortar la narrativa para vender es error; el pedido se integra (instituto-de-marca-personal · 29, relevo previo). Debe decir qué gana quien lo hace (aumenta-tu-valor-y-atv-advantage · 55).
- Feedback: «Tu video termina con "gracias por ver". Pide una sola cosa: el enlace de tu guía, y di qué recibe».

**8. Pantalla final, tarjetas y listas**
- Dato: no está en el lector; se pregunta o se pide captura.
- Criterio: en la pantalla final poner videos propios para que el algoritmo no recomiende los de otros (masteryhaus · 190). Los shorts se vinculan al video largo (masteryhaus · 189 — Programación y difusión).

**9. Shorts y relación con el largo**
- Dato: videos de menos de un minuto.
- Criterio: los cortos atraen, pero no son lo que mejor convierte tickets altos (youtube-2026 · 1); un video de más de 60 segundos va al algoritmo de largos (masteryhaus · 180, por la búsqueda de palabras). Del contenido largo se sacan reels y cortos (masteryhaus · 175 y 176).
- Feedback: «Todo tu canal son shorts. Para lo que vendes, sirve más un video largo que explique el método y que los shorts mandan hacia él».

**10. Temas de búsqueda**
- Dato: títulos y etiquetas.
- Criterio: videos que respondan lo que el cliente busca antes de comprar; el contenido buscado no caduca, un reel dura unas 48 horas (masteryhaus · 179, relevo previo). Etiquetas de apoyo, en menor escala que título y descripción (masteryhaus · 188 — SEO). Evergreen contra tendencia (universidad-de-youtube · 10, por título).

**11. Frecuencia y horario estable**
- Dato: fechas de subida.
- Criterio: rango por curso en la sección 4. Estable sobre todo: mismos días y horas; romper una vez no es grave, hacerlo seguido sí (universidad-de-youtube · 34 — Importancia del horario). Programar como estreno (masteryhaus · 189); YouTube tarda unos 30 minutos en procesar (monetizatube · 48, relevo previo).

**12. Regla de los 40 videos**
- Dato: número de videos del canal.
- Criterio: con 40 videos subidos el canal debería mostrar avance; si no, el problema suele ser calidad (universidad-de-youtube · 19 — La regla del 40). Solo de ese curso, y pensado para canales monetizados con anuncios: MaKo lo usa como pista, no como veredicto.

**13. Interacción: comentarios**
- Dato: comentarios por video.
- Criterio: la conversación en comentarios es señal; el comentario fijado con el enlace se anuncia en la descripción (nuevo-organic-ecom-3-0-junio-2026 · 52). Medición de CTR sano 2 a 10% (masteryhaus · 191, relevo previo; la persona lo trae de Studio).

---

## 3. Tu web: qué revisa MaKo

**Lo que MaKo ya hace (reusar, no inventar):**
- `lib/landing-analyst.ts` (`analizarLanding`): baja la página, extrae el copy, junta el comportamiento real de esa URL (visitas, retención del VSL, agendas por visitante) y devuelve score, veredicto, **cinco dimensiones** (claridad, promesa, prueba, llamado a la acción, fricción), hallazgos con **cita literal**, arreglo escrito y qué dice cada sección. Regla dura: no inventa métricas; si no hay datos, lo dice.
- Herramientas del chat (`lib/api-mako/areas/landing.def.ts`): `analizar_landing`, `listar_analisis_landing`, `ver_diagnostico_landing`, `ver_comportamiento_landing`, `ver_comentarios_diagnostico_landing`, `aplicar_comentario_landing`.
- `lib/editor-landing/diagnostico.ts`: el diagnóstico como recorrido con comentarios señalados sobre la página, tanto de una landing creada en el editor como de una de afuera (se previsualiza aislada y se puede replicar).
- `lib/editor-landing/lector-navegador.ts` y `lector-script.ts`: detecta video, formulario, agenda, botón de WhatsApp.

**Lo que falta para «Tu web» y es nuevo:** la pestaña que **dibuja** la web de la persona (sección por sección, con lo que lee el Analyst) y pone cada comentario en su sitio; reutiliza el recorrido de comentarios del editor. Y cruzar la web con la **oferta** y con los **anuncios** (hoy el Analyst usa el contexto del negocio, no compara con el texto del anuncio).

**Puntos a revisar** (fuente de cada uno; dimensión del Analyst entre paréntesis):

1. **Titular y promesa (promesa, claridad).** Una promesa concreta y única, repetida con el nombre del producto (the-perfect-launch · 139 — Sales page). En cinco segundos se entiende qué es, para quién y qué hay que hacer (criterio del propio Analyst). Los títulos se entienden solos y en tú porque los leads deslizan; máximo dos líneas (vsl-landing · 8 — El hilo del storytelling, el curso de Martín). Para reescribirla, describir primero dolores y beneficios del cliente y pedir tres opciones de titular (protocolo-ia · 108 — Promesa con IA). Ejemplo: «Tu titular dice "soluciones integrales". No dice qué logra una persona contigo ni en cuánto tiempo».
2. **Coherencia con el anuncio, el reel o el video que trae a la gente (claridad).** El video es la promesa y la página tiene que sostenerla; si no hablan de lo mismo, el visitante siente un cambio de tema y se va (vsl-landing · 6 — Auditar antes de escribir). Un producto por página y un anuncio por producto (formula-ventas-ilimitadas-2024 · 95 — 12 leyes de la página de venta). Ejemplo: «Tu reel promete una guía gratis y esta página vende una mentoría. Quien llega siente que lo engañaron».
3. **Coherencia con la oferta declarada (hallazgo de severidad alta en el Analyst).** Si el copy contradice lo que el negocio vende, es severidad alta (prompt de `landing-analyst.ts`). Un solo producto a la vez y no un supermercado (formula-ventas-ilimitadas-2024 · 95).
4. **Beneficios y dolores, no solo características (promesa).** Tres o cuatro beneficios y dolores principales, las características como apoyo (formula-ventas-ilimitadas-2024 · 95). La pregunta ¿para qué le sirve esto a la persona? en cada sección (vsl-landing · 8).
5. **Prueba (prueba).** Casos y testimonios con nombre; la landing principal de Sell Your Knowledge lleva VSL, testimonios, entregables y calendario (sell-your-knowledge · 59 — Armado de landing). Foto y video de calidad (formula-ventas-ilimitadas-2024 · 95). Ejemplo: «No hay un solo testimonio con nombre antes del botón. Pon dos arriba».
6. **Llamado a la acción: uno, visible y repetido (llamado a la acción).** Botón arriba, justo después de la promesa (the-perfect-launch · 139) y botones numerosos a lo largo de la página (formula-ventas-ilimitadas-2024 · 95); CTA al cierre de cada bloque (vsl-landing · 7 — Maquetación). El botón con el precio visible, la garantía y el acceso inmediato, en una página de venta de curso (imperio-afiliado · 30 — Anatomía de la página de ventas). Ejemplo: «Tienes tres botones distintos (comprar, agendar, WhatsApp). Elige uno según tu oferta».
7. **Precio (prueba, fricción).** Visible en el botón (imperio-afiliado · 30); si el producto pasa de unos 60 a 70 euros, imperio-afiliado sugiere un video de ventas que genere valor antes (imperio-afiliado · 30). En lanzamientos, contador de tiempo arriba (the-perfect-launch · 139) y urgencia (formula-ventas-ilimitadas-2024 · 95).
8. **Video (claridad, prueba).** El video reemplaza al párrafo introductorio; el subtítulo baja a una línea (vsl-landing · 6). VSL con testimonios y entregables (sell-your-knowledge · 59). El Analyst ya mide reproducciones y retención del VSL.
9. **Formulario y captura (fricción).** Una página de captura no debe tener menú ni salidas, solo el campo de correo (imperio-afiliado · 31 — Anatomía de la página de captura); el formulario en una ventana que se abre al tocar el botón convirtió más que el campo a la vista, según su experiencia (imperio-afiliado · 31) y Masteryhaus abre un pop-up con los datos (masteryhaus · 56 — Landings y funnels). Pide solo lo que necesitas (masteryhaus · 205, relevo previo). Lo que se da a cambio debe valer la pena (masteryhaus · 56).
10. **Velocidad (fricción).** Carga en menos de cuatro segundos; medir con GTmetrix o similar (vender-por-fb-e-ig-ads · 119 — Cómo optimizar tus ventas en una página web). Hoy el Analyst no mide velocidad: sería un dato nuevo de MaKo (no inventarlo desde el copy).
11. **Móvil primero (fricción).** La gran mayoría llega desde el teléfono; que en el primer pantallazo se vean titular, beneficios y oferta (formula-ventas-ilimitadas-2024 · 95). Cantidad de ese «90%»: lo dice el docente, no es un promedio.
12. **Formato limpio (claridad).** Dos colores, tamaños de fuente coherentes, espacios iguales entre secciones; primero se corrige el formato y después el texto (master-escala-100k · 160 — Revisión de landing; master-marca-personal-5-0 · 52 — Errores de diseño). Contraste: el texto no va sobre una imagen difícil de leer (master-marca-personal-5-0 · 52).
13. **Lo que mide el comportamiento (todas).** Mapas de calor y grabaciones (Clarity) para ver dónde se pierde la gente (master-escala-100k · 133 — Clarity). Lo ve el Analyst con el Pixel; MaKo lo cita de ahí, no del curso.
14. **Seguridad y confianza en el pago.** Garantía, medios de pago, envío (formula-ventas-ilimitadas-2024 · 95, de e-commerce; solo aplica si la web vende productos).
15. **Pasos posteriores.** Después de agendar, una página de preparación con un video más corto o más largo que el de la primera página (sell-your-knowledge · 59). Gracias con siguientes pasos.
16. **Reglas de Martín que aplican a su propio copy (vsl-landing).** Sin jerga técnica (ni detalle de interfaz); personal y en tú; el nombre de cada cosa se entiende sin contexto; fondos alternados por bloque (vsl-landing · 7, 8). MaKo las aplica al copy de la web de la persona solo en tono y claridad, no los colores de MaKo.

---

## 4. La máquina de contenido de lo orgánico

**Cómo se lee:** cada fila es lo que dice un curso, con su dueño. La máquina de MaKo propone UN rango por formato según el nivel y el tiempo de la persona, y muestra de dónde sale. Donde los cursos no coinciden, se dice.

### Reels y carruseles (Instagram)
| Quién | Cadencia | Fuente |
|---|---|---|
| Ana Clavellinas (Emprende) | Unas 3 publicaciones por semana, al menos una reel o carrusel; con 7 al mes creció la mitad que con el doble | emprende-con-instagram · 21 |
| Método Contenido Irresistible | Nivel 1: una por semana; nivel 2: cuatro; nivel 3: seis; empieza por 1 y sube cuando hay interacción | metodo-contenido-irresistible · 20, 37, 38 |
| Victor Heras | 12 a 20 videos al mes (de 3 a 5 por semana); él recomienda 3 a 4 | master-marca-personal-5-0 · 21 |
| Home Studio & Viral Blueprint | Mínimo 2 reels por semana, mejor 3 | home-studio-and-viral-video-blueprint · 17 |
| Masteryhaus | Un reel, post o carrusel todos los días; "suban la mayor cantidad que puedan" | masteryhaus · 178 |
| Blue Hacker | Al menos una publicación o historia con CTA por día | bluehacker · 340 |
| Growing | Con uno por día se crece; si vendes, más (cifras de 60 por día en cuentas de equipo, sin detalle claro) | growing-content-specialist · 13, 21 |
| Organic Ecom (TikTok/IG de producto) | Cuenta nueva: 1 al día los 4 primeros días, luego 2 y luego 3; nunca más de 3; si baja el alcance, vuelve a 1; separar 3 a 4 horas | nuevo-organic-ecom-3-0-junio-2026 · 18, 47 |

**Lectura:** no coinciden y no deben mezclarse. El rango bajo (1 a 3 por semana) es de quien parte de poco tiempo; el medio (3 a 5) es de marca personal; el diario es de equipos y de cuentas en crecimiento. Ninguno es para todos: MaKo propone según cuánto puede grabar la persona (batch, abajo). Lo único en que todos coinciden: **constante antes que mucho**; mejor poco y bueno (emprende-con-instagram · 21) que publicar cuando hay tiempo (bluehacker · 342).

### Historias
| Quién | Cadencia | Fuente |
|---|---|---|
| Blue Hacker | Mínimo 5 al día; más baja el alcance; al menos una con llamado a la acción por día | bluehacker · 340 |
| Masteryhaus | Promedio de 3 por día, cinco días a la semana; 48 horas sin subir por decisión | masteryhaus · 178 |
| Stories Master (Andy) | No más de unas 9 por secuencia; un día de descanso como máximo; una oferta por secuencia | stories-master · 10, 17, 18 |
| Victor Heras | Una idea por día; semana de venta de 7 días | master-marca-personal-5-0 · 58, 62 |

**Lectura:** hay desacuerdo sobre cuántas por día (3 contra 5 o más). Coinciden en que son para la audiencia que ya te sigue, que se publican con estructura y que hay que variar formato. El descanso: 48 horas (Masteryhaus) contra un día como tope (Stories Master). No hay curso que dé cuántas historias de venta por semana; lo más cercano: el reto de 7 días, y Social Funnel que pide al menos cuatro llamados por semana (social-funnel · 11). MaKo propone: **todos los días con historias de conexión, y entre 2 y 4 días a la semana una secuencia de venta (hasta 9 historias)** — esta cifra es de MaKo, calculada con Social Funnel; no lo dice así ningún curso.

### Mezcla de tipos de pieza
- Reparto 70/30 amplio/nicho, y un video por semana con palabra clave, para quien empieza (growing-content-specialist · 41). Cuenta avanzada: 50/50.
- Siete pilares, con cuatro publicaciones por semana mezclando producto, historia, educativo, opinión, promoción y testimonio (metodo-contenido-irresistible · 20).
- Estructura de la semana de Masteryhaus: lunes podcast, miércoles video de YouTube, domingo newsletter; todo lo demás empuja hacia esa pieza ese día (masteryhaus · 178). Los cortos de la semana se calendarizan para llevar al largo.

### YouTube
| Quién | Cadencia | Fuente |
|---|---|---|
| Masteryhaus | Un video largo por semana (los miércoles; 4 al mes); programar como estreno | masteryhaus · 187, 189 |
| Universidad de YouTube (Derek) | Para empezar, 3 por semana, siempre los mismos días y horas | universidad-de-youtube · 34 |
| Blue Hacker | 2 o 3 contenidos por semana, no a diario | bluehacker · 404 (relevo previo) |
| Metodo Fukuda | En su etapa de arranque, 2 por día | metodo-fukuda-poder-organico · 61 (relevo previo) |
| Masteryhaus (Shorts) | Shorts 2 por semana | masteryhaus · 178 |
| Organic Ecom | Los Shorts no tienen tope; separar 1 a 1,5 horas | nuevo-organic-ecom-3-0-junio-2026 · 51 |
| Imperio Afiliado | No prometerse uno por semana sin capacidad real | imperio-afiliado · 86 (relevo previo) |

**Lectura:** de 1 por semana a 3 o más; el consenso es la **constancia**. Para ticket alto, uno bueno por semana pesa más que tres flojos (inferencia de MaKo: ningún curso lo compara).

### Cómo se arma la semana y se graba
- **Grabación en bloque.** Masteryhaus bloquea una jornada al mes (o cada dos) y graba hasta 5 o 6 videos de 15 a 20 minutos; de cada uno salen hasta 6, 7 u 8 reels (masteryhaus · 175, 176). Así la cadencia se sostiene sin grabar a diario.
- **Plantilla de semana de Heras para vender** (master-marca-personal-5-0 · 62): días 1 y 2 problema, día 3 método, día 4 dudas, día 5 caso de éxito, día 6 pregunta, día 7 demanda, día 8 apertura.
- **Calendario mensual con pilares, formatos y hora** (metodo-contenido-irresistible · 20; emprende-con-instagram · 22).
- **Un plan de 40 videos** de YouTube para no improvisar (universidad-de-youtube · 20).
- **Una pieza de palabra clave por semana** que mande a un recurso gratis (growing-content-specialist · 41).

**Propuesta de la máquina de MaKo (por nivel, todo con dueño):**
- **Nivel base (poco tiempo):** 1 a 2 reels/carruseles por semana (MCI nivel 1 a 2 y Home Studio), historias 3 días a la semana, 1 video de YouTube cada 2 semanas.
- **Nivel medio:** 3 a 4 reels/carruseles (Heras, Emprende), historias casi todos los días con 1 a 2 secuencias de venta, 1 video de YouTube por semana (Masteryhaus).
- **Nivel alto (equipo o editor):** diario (Masteryhaus), historias diarias, video de YouTube semanal + 2 shorts.
Los números son los de cada docente; MaKo elige nivel según tiempo declarado, cuántos reels puede grabar en un día de bloque y si tiene editor.

**Cuántos reels grabar:** si se graba en bloque, la cuenta es cadencia × semanas de la tanda. Ejemplo con 3 por semana y tandas de 4 semanas son 12 reels por jornada (Heras: de 12 a 20 al mes). Ningún curso da "reels por jornada" fuera de los 6 a 8 reels por video largo de Masteryhaus.

---

## 5. Contradicciones entre cursos

1. **Frecuencia de reels:** una por semana (MCI nivel 1) a diario (Masteryhaus), pasando por 3 (Emprende), 3 a 5 (Heras), 2 a 3 (Home Studio). Explicación: marca personal con poco tiempo contra cuentas con equipo.
2. **Historias por día:** 5 o más (Blue Hacker) contra 3 (Masteryhaus) contra hasta 9 por secuencia (Stories Master). Cambia por qué cuentan: por día, o por secuencia.
3. **Descanso en historias:** 48 horas sin subir como decisión (Masteryhaus · 178) contra un día máximo porque el alcance cae (stories-master · 18).
4. **Enlace de la bio:** uno solo y sin Linktree (bluehacker · 341; social-funnel · 10) contra varios enlaces o una landing con todos los recursos (masteryhaus · 212) contra sin enlace al principio (growing-content-specialist · 84). MaKo juzga contra la oferta: si hay una oferta principal, un enlace.
5. **Hashtags:** no importan (master-marca-personal-5-0 · 21) contra 5 a 7 (emprende-con-instagram · 20, y masteryhaus · 219, relevo previo). En la **bio** ninguno (emprende-con-instagram · 13).
6. **Hora de publicar:** da lo mismo (master-marca-personal-5-0 · 21; stories-master · 18 para reels) contra "a las 7 de la tarde" como punto de partida (metodo-contenido-irresistible · 38) contra horario estable para YouTube (universidad-de-youtube · 34). Stories Master distingue: en reels es un mito, en historias sí hay mejor horario.
7. **Largo del video de YouTube:** 8 a 12 minutos para AdSense, 10 a 20 para convertir, más largos en 2026 (monetizatube · 46; instituto-de-marca-personal · 29; youtube-2026 · 1).
8. **Duración de un reel o de una historia en video:** más de 6 segundos y lo demás no importa (nuevo-organic-ecom-3-0-junio-2026 · 38, 66), consejo de producto de bajo precio; las historias en video, no más de un minuto (bluehacker · 340), y no hablar un minuto seguido a cámara (master-marca-personal-5-0 · 58). No chocan: son formatos y objetivos distintos.
9. **Dónde va el enlace en YouTube:** descripción (masteryhaus · 174; universidad-de-youtube · 33) contra comentario fijado más una frase en la descripción (nuevo-organic-ecom-3-0-junio-2026 · 52). MaKo revisa que haya uno de los dos.
10. **Cuánto vender:** una publicación con llamada al día (bluehacker · 340) y al menos cuatro llamados a la acción por semana (social-funnel · 11) contra sólo cuando hay semana de venta (master-marca-personal-5-0 · 62). MaKo pregunta si hay una oferta abierta.
11. **Página de venta corta o larga:** una carta de venta larga (formula-ventas-ilimitadas-2024 · 95) contra una página de ventas corta cuando ya hubo clases o contenido (the-perfect-launch · 139) contra una página super corta con video y formulario emergente (masteryhaus · 56). Depende del tráfico: frío, largo; caliente, corto.
12. **Producto por página:** uno solo (formula-ventas-ilimitadas-2024 · 95); lo apoya Martín (un concepto por VSL, vsl-landing · 6).
13. **Pagar para promocionar** el canal: tres cursos lo desaconsejan (relevo previo); no es parte del análisis orgánico.

---

## 6. Censo

**Clases leídas en esta tanda: 91** de los cursos de Knowledge (`public/cono-tx`) más 3 clases del curso de Martín `vsl-landing` (`app/conocimientos/curso-vsl.ts`: 6, 7, 8). Unas 60 con lectura de la apertura (2.000 a 4.500 caracteres) y el resto por filtro de frases. No leí ninguna clase de más de 60 KB entera. No repito aquí lo ya relevado en los tres documentos previos.

| Curso | Clases leídas |
|---|---|
| emprende-con-instagram | 10 (12, 13, 14, 15, 16, 18, 20, 21, 22, 24) |
| stories-master | 10 (3, 6, 7, 8, 10, 11, 17, 18, 19, 21) |
| master-marca-personal-5-0 | 9 (21, 47, 48, 52, 57, 58, 59, 61, 62) |
| masteryhaus | 15 (56, 173, 175, 178, 184, 186, 187, 188, 189, 190, 191, 212, 213, 216, 217) |
| universidad-de-youtube | 6 (19, 20, 23, 31, 33, 34) |
| nuevo-organic-ecom-3-0-junio-2026 | 7 (18, 37, 38, 47, 51, 52, 66) |
| monetizatube | 4 (19, 20, 21, 22) |
| bluehacker | 3 (340, 341, 342) |
| metodo-contenido-irresistible | 4 (16, 20, 37, 38) |
| growing-content-specialist | 4 (13, 41, 42, 44) |
| master-escala-100k | 3 (91, 133, 160) |
| social-funnel | 2 (10, 11) |
| imperio-afiliado | 2 (30, 31) |
| jaque-blue-creacion-de-contenido | 2 (18, 19) |
| metodo-fukuda-poder-organico | 2 (19, 37) |
| formula-ventas-ilimitadas-2024 | 1 (95) |
| protocolo-ia | 1 (108) |
| the-perfect-launch | 1 (139) |
| vender-por-fb-e-ig-ads | 1 (119) |
| sell-your-knowledge | 1 (59) |
| youtube-2026 | 1 (1, la masterclass, por filtro de frases) |
| inteligencia-viral-2026 | 1 (13) |
| home-studio-and-viral-video-blueprint | 1 (17) |
| vsl-landing (Martín) | 3 (6, 7, 8) |

**Límites a tener presentes:**
- Algunos cursos son de e-commerce con TikTok (nuevo-organic-ecom, master-escala-100k, formula-ventas-ilimitadas): lo cito solo donde el principio vale para cualquier cuenta; sus cadencias son para producto físico barato.
- Monetizatube y Universidad de YouTube enseñan canales de AdSense, a menudo sin cara; sus puntos de título, miniatura, retención y horario sirven; sus puntos de monetización no.
- La masterclass `youtube-2026` es larga (más de 85 KB); la leí por filtro de frases, no entera, y sus cifras son afirmaciones de la oradora.
- Los cursos de Growing tienen transcripciones desordenadas (grabaciones de llamadas); solo tomé lo que se entiende.
- Las cifras de un docente son de su cuenta o de sus alumnos, no de las del usuario.
- No leí `inteligencia-viral-2026` ni `jaque-blue` más allá de dos o tres clases: son de técnica de video y de creatividad; aportan poco a «qué revisar».
- Pendiente, con su lugar: el lector de Instagram no trae historias ni destacadas (`lib/instagram-perfil.ts`, `lib/spy-medio.ts`); el lector de YouTube no trae retención ni comentario fijado (`lib/spy-youtube.ts`); el Analyst no mide velocidad de carga ni compara con el texto del anuncio (`lib/landing-analyst.ts`).
