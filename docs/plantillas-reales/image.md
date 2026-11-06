# Image (el editor tipo Canva): plantillas reales y el Diseñador de MaKo

> Parte de [Plantillas reales en Create](README.md). La regla común, el elenco, el patrón del agente experto, la tabla única de licencias y el orden de implementación viven en el README; este archivo es la parte de Image, entera, con sus ejemplos completos.

**Qué es:** la parte de Image del plan «plantillas reales + agente experto por tab». Son 12 plantillas llenas, cada una con un negocio ficticio del elenco común, foto y texto reales, y una miniatura que es la pieza terminada. Las acompaña el **Diseñador de MaKo**, el experto de la tab: sus prompts se editan en `/configuraciones`, y adapta la plantilla al negocio con las operaciones que el chat del editor ya sabe aplicar.
**Estado:** es un plan; no hay nada implementado. Se midió contra `origin/main` `1cf06eba9` (29/10/2026, 13:55). No se usó la copia de OneDrive.
**De dónde sale:** la investigación completa del 29/10 (`a540914c733338456.json`), el patrón de experto (`a13fe8c023075188f.json`), la regla común del [README](README.md) (sección 2) y lo que se verificó de nuevo hoy:
- las licencias de las 4 skills MIT y de `canvas-design` (Apache-2.0);
- la licencia de Pexels y los términos de su API;
- la licencia de Unsplash;
- los estudios de vidIQ y 1of10, y las skills de miniaturas y carruseles.

Dos cifras de la investigación se corrigen: el umbral de legibilidad y lo que 1of10 dice de las caras en los negocios (ver la sección 6).

---

## 0. Lo que hay hoy y por qué se ve vacío

- **Las plantillas:** `app/image-editor/mako/plantillas.ts` tiene las **10 de Doory**: anuncio de oferta, frase, historia de evento, presentación para inversores, póster de concierto, volante, invitación de boda, currículum, miniatura de YouTube y tarjeta. La mitad no le sirve a un negocio high ticket (las de boda, concierto y currículum).
- **Las fotos son rectángulos grises:** capas `… (relleno)` con `rgba(140, 128, 132, 0.18)`. Por eso se ven vacías, aunque el texto ya esté en español desde el 14/10.
- **«Nuevo diseño»:** `app/image-editor/plantillas-crear.ts` arma una sola lista. Primero vienen los 6 tamaños en blanco de `TAMANOS_API` y el carrusel de 5 páginas, después las 10 de Doory con su miniatura `public/cv/plantillas/<slug>.webp`. La misma lista la usan la computadora (`ImageEditorCliente.tsx` → `PantallaCrear`) y el teléfono (`app/m/image-editor/InicioImagenM.tsx`), y las dos crean con la misma acción (`actions.ts` → `crearDisenoNuevoAction`).
- **La tarjeta recorta:** `PlantillaCrear` (`app/_crear/reglas.ts`) tiene `id | nombre | formato | imagen | rotulo`. La tarjeta mete la miniatura en una caja 4:3 con `object-fit: cover` (`crear.css:106`), así que a una historia 9:16 solo se le ve el tercio del medio.
- **El chat «MaKo IA»** (`lib/image-editor/chat/`) propone operaciones sobre el diseño abierto: `cambiar_texto`, `estilo_texto`, `color`, `fondo`, `mover`, `agregar_pagina`, etc. **No sabe nada del negocio:** su prompt de usuario recibe solo la instrucción, el alcance y el diseño. **Tampoco puede poner fotos ni usar plantillas** (`NO_SE_PUEDE_CHAT_IMAGEN`). La vista del diseño sí trae el `nombre` de cada capa y de cada página (`vista.ts:110`, `:185`): el experto puede llenar las capas **por su nombre**.
- **El motor ya tiene marcadores de foto:** una `image` con `isPlaceholder: true` y un `slot` (`isPlaceholder?` y `slot?` en `app/image-editor/_doory/editor/engine/objects/dory.ts:39-41`; el tipo `SlotSpec`, en `app/image-editor/_doory/types/document.ts:138`). Al tocarla, pide una foto y la mete en el marco con su máscara. `slot.src` recuerda la foto de muestra. Es justo lo que hace falta para «toca la foto de ejemplo y pon la tuya».
- **Lo que el editor no tiene:**
  - **«Quitar fondo» está apagado** (`docs/hallazgos-editor-imagen.md`), así que no se puede usar la persona recortada sobre el fondo, que es la miniatura de manual.
  - **No hay banco de fotos:** `stock: null` en `mako/adaptadorNube.ts:148`.
  - **Las páginas sí tienen notas** (`DocPage.notes`): ahí va el texto de la publicación o del anuncio.

---

## 1. Cómo lo hacen los mejores, y qué copiamos de su forma de mostrar

**Canva.** Se miró en el navegador el 29/10, porque WebFetch devuelve 403.
- Páginas: https://www.canva.com/youtube-thumbnails/templates/ («Showing 50 of 20,149») y https://www.canva.com/facebook-ads/templates/ («… of 12,238»).
- La primera tarjeta es «Create a blank …». **Todas las demás son el diseño terminado**, con foto y texto reales: «05 SIMPLE VEGAN BREAKFAST RECIPES» con la foto del bowl, «THE KNOCK» con la silueta. Ninguna es un rectángulo con un nombre.
- Los nombres siguen el patrón **Color + Estilo + Nicho + Formato**: «Blue and White Simple Dental Clinic Facebook Ad». Cada plantilla es de **un** nicho, con un negocio inventado pero creíble.
- Las de varias páginas llevan la insignia «1 of 3».
- Hay filtros por estilo, tema y color.

**Kapwing** (https://www.kapwing.com/templates/youtube-thumbnail) dice tener «14k+» plantillas, con filtros por tema (Christmas, Football, Funny, Motivational, News). Sus plantillas «come with placeholder text, graphics…» que se reemplazan. Hoy el contador de la página dice «0+», un error de carga suyo.

**Las skills de agentes** (licencias verificadas hoy en sus `LICENSE`):
- **`aabrole/claude-video-thumbnail-skill`** (MIT):
  - entrega **4 conceptos distintos y una grilla 2×2** para elegir;
  - como máximo **3 elementos** por miniatura;
  - tres composiciones: simétrica, por tercios y A→B;
  - **la esquina de abajo a la derecha queda libre** porque ahí va la duración;
  - el texto **complementa el título y no lo repite**;
  - tiene que **leerse a 320 × 180 px**.
- **`charlie947/social-media-skills`** (MIT):
  - la miniatura arranca de un **brief** que se aprueba antes de generar: composición, texto de 3 a 5 palabras (6 como mucho), paleta en hex, elemento de apoyo y tono;
  - el carrusel lleva **titular de hasta 8 palabras y cuerpo de hasta 15**;
  - se revisa a ~360 px, el tamaño del feed.
- **`jeevanbavandla/instagram-carousel-skill`** (MIT):
  - **4 estilos** que se eligen solos según el contenido (Bold Impact, Tweet Post, Clean Editorial, Product Showcase);
  - en **cada diapositiva**: cabecera de perfil (con **las iniciales si no hay foto**), barra de progreso, flecha y marca de agua con el usuario;
  - **la última diapositiva es blanca**, con la acción;
  - de 5 a 10 diapositivas, 7 lo ideal.
- **`coreyhaines31/marketingskills`** (`ad-creative/references/static-ad-templates.md`, MIT):
  - 22 plantillas de anuncio estático con su nivel: **Founder Message S**, **Origin Story S**, Grid A, **Us vs. Them B**, Before/After B, Challenging Your Beliefs B, Ugly/Post-it B (en períodos de venta), Stat Callout C, Review Card y Testimonial Stack **E**, Press Mention F;
  - la regla: «Real names, real stats, and real quotes only».

**Los datos detrás de las reglas** (leídos hoy):
- **vidIQ** (https://vidiq.com/research/youtube-thumbnail-study/; 500 miniaturas de videos que despegaron, publicados en junio de 2026):
  - 69 % tiene cara, y solo el 5 % una expresión exagerada;
  - el 28 % no tiene texto; las que tienen, una mediana de 5 palabras;
  - el propio estudio aclara que no prueba causalidad.
- **1of10** (https://1of10.com/blog/what-actually-makes-a-youtube-video-go-viral-in-2025; más de 300 mil videos de 2025):
  - con o sin cara rinden parecido en general; la cara **ayuda en finanzas y daña en salud y fitness**;
  - las miniaturas con texto tienen ~19 % menos vistas (lo mejor: sin texto o con menos de 10 caracteres);
  - el cian da ~36 % más vistas y **las oscuras rinden menos**.

**Qué copiamos de la forma de mostrar** (el patrón, nunca un diseño):
1. **La tarjeta es la pieza terminada**: la primera página renderizada con su foto y su texto reales, **a su proporción**. No se recorta a 4:3.
2. **Se agrupa por formato y, en cada grupo, primero la versión en blanco** («Miniaturas de YouTube: [En blanco 1280 × 720] [Resultado con cara] [Número sin cara]»), como «Create a blank …» de Canva. Dentro del grupo van primero las sugeridas para el negocio (`ordenarConSugeridas`).
3. **El nombre sigue el patrón «Formato · Ángulo · Nicho»**, por ejemplo «Miniatura · Número sin cara · Agencia».
4. **Insignia** en lo que tiene varias páginas («1 de 7») y en las miniaturas que traen dos versiones para probar («2 versiones»).
5. **Cada plantilla es de un negocio ficticio y lo dice:** al abrirla, el editor muestra «Ejemplo: Pulso Dental (negocio ficticio)». MaKo ofrece **una sola cosa**: «¿Lo adapto a tu negocio?».
6. **Las variantes vienen hechas**, como los 4 conceptos de la skill de miniaturas: cada miniatura trae la versión con cara y la versión sin cara en dos páginas, para la prueba A/B de YouTube Studio.

---

## 2. Las plantillas (12)

### 2.0 Reglas comunes a las 12

- **Elenco:** el del README, sección 2.2 (Cierre Consultivo, Consulta Rentable, Pulso Dental, Torre Alameda y Voz de Líder, con sus clientes inventados). Los datos repiten **los mismos números** que esos negocios tienen en Copywriter y en Video:
  - los 15 lugares y los 2 pagos de USD 800 de Andrea;
  - Altamira, que pasó de 6 a 23 valoraciones y cerró 9 tratamientos;
  - el embudo de una alumna de Mariana (no el de Mariana): 60 mensajes, 18 valoraciones y 11 pacientes;
  - el depa muestra de 78 m², desde MXN 2.4 M;
  - la cohorte de 12 personas de Rodrigo.
- **Números en formato de México:** «USD 1,500», «MXN 2.4 M», «8:00 p. m.».
- **Tamaños** (todos están en la lista de Redimensionar, `resizeSizes.ts`):

  | Formato | Tamaño | Cómo se descarga |
  |---|---|---|
  | Miniatura | 1280 × 720 | ×2: YouTube recomienda hoy 3840 × 2160 y muchos blogs siguen diciendo 1280 × 720 |
  | Carrusel y publicación | 1080 × 1350 (4:5) | |
  | Historia | 1080 × 1920 | |
  | Anuncio | 1080 × 1350 | ×2, que supera los 1440 × 1800 que recomienda Meta para el feed |
  | Presentación | 1920 × 1080 | |

- **Fuentes:** todas están en `app/image-editor/mako/fuentes.ts` (Anton, Archivo Black, Inter, DM Serif Display, DM Sans, Playfair Display, Lora, Caveat y Space Grotesk). Se usan dos familias por pieza como máximo.
- **Capas con nombre en español y por función:** «Gancho», «Titular», «Texto», «Tu foto», «Dato», «Acción», «Barra de progreso». El experto las encuentra por su nombre. La decoración que no se toca va **agrupada y bloqueada** (el chat no edita adentro de un grupo).
- **Tachado:** `linethrough` sobre un texto gris (#9CA3AF).
- **Resaltado de unas palabras:** van en **su propio texto**, con el efecto `background`. Una forma puesta detrás se desacomoda cuando el texto cambia.
- **Las fotos** se eligen a mano en pexels.com (licencia verificada) y se guardan como WebP de 1600 px de lado mayor, sin metadatos.
  - Ruta: `public/cv/plantillas/fotos/<rol>-<slug>-<capa>.webp`. Es el mismo origen que la app, así que no ensucia el lienzo al exportar.
  - **El prefijo dice el rol:**
    - `persona-`: la cara del dueño;
    - `lugar-`: algo del negocio (el consultorio, la propiedad);
    - `fondo-`: decorado genérico.
  - **Las de `persona-` y `lugar-` no se descargan sin reemplazarlas** (ver la sección 5): una cara o un depa de stock publicados como si fueran del negocio serían prueba falsa.
  - **Ninguna cara de stock** va en un «antes», en un fracaso, en un testimonio de cliente ni junto a un pago, una cifra del negocio o una credencial. Los clientes del elenco aparecen sin cara.
  - **La silueta propia** (`persona-silueta.webp`): una figura sin cara, dibujada por nosotros con formas. Es la «Tu foto» de la 1 y de la 12, que ponen la foto junto a pagos y credenciales, hasta que existan los retratos del elenco hechos en Flow (README, 2.2). Lleva el prefijo `persona-`, así que frena la descarga igual que una foto de muestra.
  - **La tarjeta de la galería es pública** (`public/cv/plantillas/<slug>.webp`) y no pasa por la guarda de descarga: ninguna muestra una cara de stock.
- **El texto de la publicación o del anuncio** va en las **notas** de la primera página: «Texto de la publicación: …» o «Texto principal / Titular / Descripción / Botón».
- **`pide`:** cada plantilla declara los hechos que necesita, en orden. El experto solo pregunta los que el negocio no tiene (sección 3).

### 2.1 Resumen

| # | Nombre en la tarjeta | Negocio | Tamaño · páginas | Trabajo | Fotos |
|---|---|---|---|---|---|
| 1 | Miniatura · Resultado con cara · Coach | Cierre Consultivo | 1280 × 720 · 2 versiones | Atraer | la silueta |
| 2 | Miniatura · Número sin cara · Agencia | Pulso Dental | 1280 × 720 · 2 versiones | Atraer | 1 persona (solo la versión B) |
| 3 | Carrusel · 3 frases que matan la venta · Coach | Cierre Consultivo | 1080 × 1350 · 7 | Abrir conversaciones | — |
| 4 | Carrusel · Mito vs. realidad · Infoproducto | Consulta Rentable | 1080 × 1350 · 7 | Atraer | — |
| 5 | Carrusel · Caso con números · Agencia | Pulso Dental | 1080 × 1350 · 8 | Vender | 1 lugar |
| 6 | Publicación · Ficha de propiedad · Inmobiliaria | Torre Alameda | 1080 × 1350 · 1 | Vender | 1 lugar |
| 7 | Publicación · Creencia al revés · Formación | Voz de Líder | 1080 × 1350 · 1 | Abrir conversaciones | — |
| 8 | Historia · Últimos lugares · Formación | Voz de Líder | 1080 × 1920 · 1 | Vender | — |
| 9 | Historia · Invitación a clase · Infoproducto | Consulta Rentable | 1080 × 1920 · 1 | Vender | 1 fondo |
| 10 | Anuncio · Carta del fundador · Agencia | Pulso Dental | 1080 × 1350 · 1 | Atraer (nivel S) | 1 lugar |
| 11 | Anuncio · Comparación · Inmobiliaria | Torre Alameda | 1080 × 1350 · 1 | Vender (nivel B) | — |
| 12 | Presentación · Clase que vende · Infoproducto | Consulta Rentable | 1920 × 1080 · 9 | Cerrar | la silueta |

Siete de las doce no llevan ninguna foto de stock (1, 3, 4, 7, 8, 11 y 12), y la versión A de la 2 tampoco: la cuadrícula, los asientos, las columnas y las barras se dibujan con formas, y la 1 y la 12 usan la silueta propia. Por eso son reales y verificables. En total hay **5 fotos** de Pexels (1 de persona, 3 de lugar y 1 de fondo) y la silueta.

---

### 1. Miniatura · Resultado con cara · Coach
- **Cuándo usarla** (`cuando`): «Tu video cuenta un resultado tuyo y vas a salir a cámara.»
- **Ejemplo:** Cierre Consultivo, de Andrea Salcedo (CDMX).
- **Título del video** (va en las notas, no en la imagen): «Cómo llené 15 lugares de mi programa solo por WhatsApp».
- **`pide`:** `titulo_video`, `resultado`, `foto`.

**Página 1, versión A sin cara (la que muestra la tarjeta):**
- **Fondo:** degradado lineal #0E7490 → #22D3EE, ángulo 0 del motor (0 apunta a la DERECHA).
- **«Gancho»:** «SIN ANUNCIOS» en Anton 150 px, blanco, con contorno (`outline`) #0B1220 de 6 px, en dos renglones, arriba a la izquierda (x 64, y 60). El título no dice «sin anuncios», así que el texto agrega y no repite.
- **«Dato»:** «15/15» en Anton 300 px #FACC15 con contorno #0B1220 de 8 px, a la derecha (x 700, y 60), más «LUGARES» en Archivo Black 64 blanco debajo.
- **«Notificaciones»:** grupo rotado −4° debajo del gancho, con tres tarjetas blancas de 540 × 92, radio 24 y sombra. Cada una lleva un círculo verde #16A34A con un tilde y texto en Inter SemiBold 32 #0B1220:
  - «Pago recibido · USD 1,500»
  - «Pago recibido · USD 800 (1 de 2)»
  - «Lugar 15 de 15 confirmado»
- **Zona libre:** 240 × 130 abajo a la derecha (ahí va la duración). Tiene 3 elementos: número, gancho y notificaciones.

**Página 2, versión B con cara:** el mismo fondo, el mismo gancho y las mismas notificaciones. En lugar del «Dato»:
- **«Marco de la foto»:** rectángulo blanco de 520 × 600, radio 28, a la derecha (x 700, y 60), con sombra suave.
- **«Tu foto»:** marcador de foto con máscara `rounded` (radio 0.05), 504 × 584, dentro del marco.
  - Archivo: `persona-silueta.webp`, la silueta propia, sin cara. **No va una cara de stock:** quedaría junto a «Pago recibido» y «Lugar 15 de 15», como si esa persona hubiera cobrado esos pagos (Pexels prohíbe insinuar respaldo; trampa 6).
  - Lo que el experto le pide a la persona: su foto de hombros para arriba, mirando a cámara, con una media sonrisa (natural, no de susto), luz de ventana y pared clara lisa. La cara ocupa entre el 35 % y el 45 % del alto.
  - Cuando existan los retratos del elenco hechos en Flow, la muestra es el de Andrea.

**Notas:** «Título: … · Prueba las dos versiones con la prueba A/B de miniaturas de YouTube Studio.»

**Miniatura de la tarjeta:** la página 1, sin cara. Se ven el degradado cian, «SIN ANUNCIOS» enorme en blanco, el «15/15» amarillo a la derecha y las tres notificaciones inclinadas. Lleva la insignia «2 versiones».

### 2. Miniatura · Número sin cara · Agencia
- **Cuándo usarla:** «Tu video revela un número que sorprende, sin que tengas que salir.»
- **Ejemplo:** Pulso Dental, de Diego Ferrer (Bogotá).
- **Título:** «Revisé 50 anuncios de clínicas dentales: por qué 43 no traen pacientes». Es el video 12 de Copywriter.
- **`pide`:** `titulo_video`, `resultado` (el número real del análisis).

**Página 1, versión A sin cara (la que va por defecto: 1of10 no encontró ventaja de la cara en general):**
- **Fondo:** #E0F2FE, claro, no oscuro.
- **«Cuadrícula de anuncios»:** grupo bloqueado a la izquierda (x 48 a 760) con 10 × 5 tarjetas blancas de 60 × 84, radio 6 y borde #CBD5E1. 43 llevan una X roja #DC2626 de 5 px y 7 un tilde verde #16A34A. **Son formas: no hay anuncios reales.**
- **«Señalado»:** una de las tarjetas con X, rodeada por un círculo #DC2626 de 10 px.
- **«Gancho»:** «¿EL TUYO?» en Anton 170 px #0B1220 sobre «Bloque del gancho» #FACC15 rotado −3°, arriba a la derecha.
- **«Flecha»:** trazo #0B1220 de 10 px desde el gancho hasta la tarjeta señalada.
- **Zona libre:** abajo a la derecha.

**Página 2, versión B con cara:** «Tu foto» (persona, `persona-numero-sin-cara-tu-foto.webp`). Se ve: un hombre de 35 a 45 años, seguro, mirando a cámara, de hombros para arriba, con fondo liso. Va a la derecha, en un marco blanco, y señala la cuadrícula. El gancho baja a 130 px.

**Miniatura de la tarjeta:** la cuadrícula llena de X rojas, con un círculo rojo sobre una y el bloque amarillo con «¿EL TUYO?».

**Ojo:** el brief de miniatura del guion 12 de Copywriter («43 DE 50 FALLAN») repite el título. Aquí el número vive en la cuadrícula y el texto agrega la pregunta. Ya se alineó: la plantilla 12 de Copywriter y la receta 2.12 de Video dicen «¿EL TUYO?».

### 3. Carrusel · 3 frases que matan la venta · Coach
- **Cuándo usarla:** «Quieres que te escriban por mensaje enseñando algo concreto.»
- **Ejemplo:** Cierre Consultivo. Es el mismo contenido de la plantilla 5 de Copywriter («Reel que trae mensajes»), en otro formato.
- **`pide`:** `respuesta_mensaje` (la palabra GUIA solo va si alguien la contesta).

**Estilo «Editorial limpio»** (Clean Editorial de la skill):
- fondo #FAFAF7 con una grilla sutil al 4 % y acento coral #F25F4C;
- titulares en DM Serif Display 84 #111111 y texto en Inter 40 #374151;
- márgenes de 96.

**En todas las diapositivas:**
- **«Cabecera»:** círculo de 72 px con las iniciales «AS» en Inter Bold 30 blanco sobre #F25F4C. Es un **marcador**: se toca y entra la foto del perfil. Al lado, «Andrea Salcedo» (Inter SemiBold 30) y «@cierreconsultivo» (Inter 26 #6B7280).
- **«Barra de progreso»:** 8 px abajo, coral, con un ancho igual a la página sobre 7.
- **«Flecha»:** «→» abajo a la derecha, de la 1 a la 6.

**Las diapositivas:**
1. **Portada.**
   - Titular: «3 frases que matan tu venta por WhatsApp».
   - Bajada: «Y qué escribir en su lugar.»
   - «Burbuja»: un globo de chat gris #E5E7EB con «¿Te mando la info?» tachado.
   - «Desliza →».
2. «La mayoría de las ventas se pierden en el chat.» / «Antes de la llamada.»
3. «1. "¿Te mando la info?"» (tachado) / «Mejor: "¿Qué te llevó a escribirme hoy?"» / «Pedir permiso para mandar un PDF es pedir permiso para que te ignoren.»
4. «2. "Es una inversión"» (tachado) / «Mejor: primero su problema, después el precio.» / «Dicho antes de conocer su problema, suena a excusa.»
5. «3. "Cualquier duda me dices"» (tachado) / «Mejor: "¿Martes o jueves para hablarlo 20 minutos?"» / «Cierra cada chat con una fecha, no con una puerta abierta.»
6. «En resumen» / «Pregunta antes de mandar.» · «Problema antes que precio.» · «Fecha antes de despedirte.»
7. **Fondo blanco.** «¿Quieres mis 6 preguntas de cada llamada?» / «Escríbeme GUIA por mensaje y te las mando.» / «Guárdalo para tu próximo chat.»

**Notas, «Texto de la publicación»:** «La mayoría de las ventas se pierden en el chat, antes de la llamada. Guarda este carrusel para tu próxima conversación.»

**Miniatura de la tarjeta:** la portada en crema, con el titular en serif, el globo gris tachado, la cabecera coral «AS» y la insignia «1 de 7».

### 4. Carrusel · Mito vs. realidad · Infoproducto
- **Cuándo usarla:** «Tus clientes creen algo que les impide comprar y tienes datos para responder.»
- **Ejemplo:** Consulta Rentable, de la Dra. Mariana Ochoa.
- **`pide`:** `creencia`, `resultado`, `caso`.

**Estilo «Alto contraste»** (Bold Impact):
- fondo #0F172A con grano al 6 %;
- «MITO» en Archivo Black 52 #EF4444, sobre una frase tachada;
- «REALIDAD» en Archivo Black 52 #22C55E;
- titulares en Archivo Black 88 blanco y texto en Inter 42 #CBD5E1.
- Cabecera «MO», «Dra. Mariana Ochoa», «@consultarentable».
- Barra de progreso y flecha, como en la 3.

**Las diapositivas:**
1. «Tu consulta no se llena con más recetas» / «4 mitos que te hacen cobrar de menos» / «Desliza →».
2. MITO «Si cobro menos, lleno la agenda.» → REALIDAD «Lucía cobró 900 pesos en vez de 600 y llegó a 21 pacientes al mes.» Letra chica: «Caso de una alumna. Tus resultados pueden variar.»
3. MITO «Necesito más seguidores.» → REALIDAD «Necesitas un paso entre el mensaje y la consulta: una valoración de 20 minutos.»
4. MITO «Por Instagram no se agenda.» → REALIDAD «Se agenda por mensaje: a una alumna, 60 conversaciones le dieron 18 valoraciones y 11 pacientes.» Letra chica: «Caso de una alumna.»
5. MITO «Hay que publicar todos los días.» → REALIDAD «Con 3 horas por semana alcanza si cada publicación lleva a una conversación.»
6. «Lo que sí llena la consulta:» / «Una oferta clara, una valoración de 20 minutos y seguimiento por mensaje.»
7. **Fondo blanco.** «¿Cuál de estos mitos te frenó a ti?» / «Respóndeme con el número.» / «Envíaselo a una colega que está por subir sus precios.»

**Si el negocio no tiene el número**, la REALIDAD se reescribe como una explicación sin cifra. Nunca se deja la cifra del ejemplo.

**Notas:** «Texto de la publicación: Si te identificas con el 1, no es tu precio: es tu agenda. Respóndeme con el número.»

**Miniatura de la tarjeta:** la portada azul noche con el titular blanco enorme y «1 de 7».

### 5. Carrusel · Caso con números · Agencia
- **Cuándo usarla:** «Tienes un cliente con permiso para mostrar su resultado.»
- **Ejemplo:** Pulso Dental con la Clínica Dental Altamira (Medellín).
- **`pide`:** `caso`, `resultado`, `respuesta_mensaje`.

**Estilo:**
- fondo blanco, acento #2563EB;
- números en Archivo Black y datos en Space Grotesk Bold;
- texto en Inter 40 #1F2937.
- Cabecera «PD», «Pulso Dental», «@pulsodental».

**Las diapositivas:**
1. **Portada.**
   - «Foto del caso» (lugar, `lugar-caso-con-numeros-foto.webp`), arriba, en el 40 % del alto. Se ve: un consultorio dental luminoso con el sillón blanco, sin personas y sin logos.
   - «6» en Archivo Black 180 #9CA3AF tachado, «→» y «23» en Archivo Black 220 #2563EB.
   - «Valoraciones de implantes al mes».
   - «Clínica Dental Altamira, Medellín · Misma inversión en anuncios».
2. «El punto de partida» / «80 a 100 mensajes al mes. Respuesta: 3 horas después. Valoraciones: 6.»
3. «Cambio 1: responder en menos de 5 minutos» / «Quien escribe a una clínica le escribe a tres. Gana la que contesta primero.»
4. «Cambio 2: 5 preguntas de filtro» / «Tratamiento, urgencia, zona, presupuesto y horario, antes de ofrecer la cita.»
5. «Cambio 3: el precio, antes de agendar» / «Un rango dicho en el chat evita la cita que no llega.»
6. «El resultado» / «Gráfica»: dos barras hechas con formas, 6 en gris y 23 en azul, con «Valoraciones de implantes por mes» y «9 tratamientos cerrados en el mes 3».
7. «Lo que NO cambió» / «La inversión en anuncios, los precios y el equipo de la clínica.»
8. **Fondo blanco.** «¿Tienes una clínica dental?» / «Escríbenos AUDITORIA y revisamos tus últimos 20 mensajes en 30 minutos.» / letra chica: «Resultado de una clínica en particular. El tuyo puede variar.»

**Miniatura de la tarjeta:** la foto del consultorio arriba y, abajo, «6 → 23» con el 23 en azul, más «1 de 8».

### 6. Publicación · Ficha de propiedad · Inmobiliaria
- **Cuándo usarla:** «Quieres mostrar una propiedad y que te escriban para visitarla.»
- **Ejemplo:** Torre Alameda (Querétaro). La desarrolladora no lleva nombre (README, 2.2).
- **`pide`:** `propiedad`, `foto` (de la propiedad), `respuesta_mensaje`.

**Capas:**
- **«Foto de la propiedad»** (lugar, `lugar-ficha-propiedad-foto.webp`): a sangre, en el 68 % de arriba. Se ve: la sala de un departamento moderno con un ventanal grande y árboles afuera, piso de madera y sofá claro, sin personas ni cuadros de marcas.
- **«Etiqueta»:** «ETAPA 2 · PREVENTA» en Archivo Black 30 #0B2545 sobre #C9A227, arriba a la izquierda.
- **«Banda»:** #0B2545, en el 32 % de abajo.
- **«Titular»:** «Depa con vista al parque» en Playfair Display 60 blanco.
- **«Precio»:** «Desde MXN 2.4 M» en Playfair Display Bold 84 blanco.
- **«Datos»:** Inter 34 #E2E8F0, con íconos de línea:
  - «2 recámaras · 2 baños · 78 m²»
  - «Enganche del 10 % diferido a 18 meses»
  - «Entrega: diciembre de 2027»
- **«Acción»:** «Escribe PRECIOS y te mandamos la lista hoy».
- **«Marca»:** «Torre Alameda · Querétaro», chico, abajo a la derecha.
- **«Aviso»:** «Imágenes ilustrativas», en 18 px.

**Notas:** «Texto de la publicación: De los 46 departamentos que quedan, 14 tienen vista al parque. A 8 minutos de Constituyentes, con alberca, gimnasio y roof garden. Escríbenos PRECIOS.»

**Miniatura de la tarjeta:** la sala luminosa, la banda azul con «Desde MXN 2.4 M» y la etiqueta dorada.

### 7. Publicación · Creencia al revés · Formación
- **Cuándo usarla:** «Escuchas siempre la misma creencia y quieres darle la vuelta para que te escriban.»
- **Ejemplo:** Voz de Líder, de Rodrigo Ibarra (Lima). Sale del frame 4 de la plantilla 6 de Copywriter («Stories que venden»): «Preparas todo lo que vas a decir, menos los primeros 20 segundos». Aquí el contraste sí va, porque es la forma de la pieza; en las stories se quitó.
- **`pide`:** `creencia`.

**Capas:**
- **Fondo:** crema #F5F0E8, con margen de 120 y mucho aire.
- **«Creencia»:** «No necesitas perder los nervios.» en DM Serif Display 88, gris #9CA3AF, tachado.
- **«Respuesta»:** «Necesitas ensayar los» en DM Serif Display itálica 88 #1F2937.
- **«Resaltado»:** «primeros 20 segundos.», un texto aparte con el efecto `background` #FDE68A.
- **«Firma»:** círculo de 96 px «RI» (marcador para la foto) y «Rodrigo Ibarra · Voz de Líder» en Inter 32 #6B7280.

**Notas:** «Texto de la publicación: Un gerente me dijo: "sé qué decir hasta que me toca el directorio". No eran nervios. Te cuento qué ensayamos:»

**Miniatura de la tarjeta:** el crema, la frase tachada en gris, la respuesta en serif con «primeros 20 segundos» resaltado en amarillo, y la firma.

### 8. Historia · Últimos lugares · Formación
- **Cuándo usarla:** «Cierras inscripciones y quedan lugares de verdad.» **Si el negocio no confirma los lugares y la fecha, la plantilla no se usa.**
- **Ejemplo:** Voz de Líder.
- **`pide`:** `cupos`, `fecha`, `respuesta_mensaje`.

**Zonas seguras:** nada importante en los 270 px de arriba (14 %), los 672 de abajo (35 %) ni los 65 de cada costado (6 %). Así sirve también como anuncio. El contenido vive entre y 270 e y 1248.

**Capas:**
- **Fondo:** #111111.
- **«Número»:** «4» en Anton 420 #FACC15.
- **«Titular»:** «lugares» en Archivo Black 96 blanco, con «Quedan» arriba en Inter SemiBold 44.
- **«Asientos»:** grupo de 12 círculos de 64 px en 3 filas: 8 llenos #FACC15 y 4 con borde #FACC15 de 4 px.
- **«Leyenda»:** «Cohorte de mayo», en Inter 38 #D4D4D4.
- **«Cierre»:** «Cierra el viernes».
- **«Acción»:** «Escríbeme JUNTA».

Son 11 palabras con el número: entra en el tope de la historia (12) y sirve también como anuncio. La primera versión tenía 38, el triple del tope que el Diseñador le pide a la IA.

**Notas:** «Cierre real: el viernes a las 11:59 p. m. (hora de Lima), la misma hora del email de cierre (Copywriter, plantilla 8). La hora va en el sticker de cuenta regresiva de Instagram, que se pone a mano. Para quien escriba JUNTA: 90 días, martes en vivo, USD 2,000.»

**Miniatura de la tarjeta:** el «4» amarillo gigante sobre negro, con los 12 asientos.

### 9. Historia · Invitación a clase · Infoproducto
- **Cuándo usarla:** «Das una clase en vivo y quieres que se registren desde tus historias.»
- **Ejemplo:** Consulta Rentable. Usa la misma fecha que la plantilla 9 de Video («Invitación a clase en vivo») y la clase 11 de Copywriter.
- **`pide`:** `fecha`, `oferta` (el tema de la clase).

**Capas:**
- **«Foto de fondo»** (fondo, `fondo-invitacion-clase-foto.webp`). Se ve: un escritorio visto desde arriba, con laptop, cuaderno y un plato de fruta, en vertical. Lleva un velo #0F172A al 55 %.
- **«Etiqueta»:** «CLASE GRATIS EN VIVO» en Archivo Black 40 sobre #22C55E.
- **«Titular»:** «Cómo llenar tu consulta online sin publicar todos los días» en DM Serif Display 80 blanco.
- **«Fecha»:** «Jueves 12 de noviembre» en Archivo Black 64 #FDE047.
- **«Horarios»:** «7:00 p. m. CDMX · 8:00 p. m. Bogotá y Lima · 10:00 p. m. Santiago», en Inter 34. Son los países de sus alumnas (México, Colombia y Chile), más Lima. Cuentas verificadas: CDMX en UTC−6 todo el año, Bogotá y Lima en UTC−5 y Santiago en UTC−3 en noviembre por el horario de verano. El 12/11/2026 es jueves.
- **«Acción»:** «Toca el enlace ↓», justo arriba de la franja libre donde se pega el sticker de enlace. **No hay ninguna guía dibujada**, porque saldría en la descarga.
- **Tope propio: 35 palabras** (`topePalabras`). Una invitación no entra en las 12 de una historia: la fecha y los horarios no se pueden quitar. El ejemplo tiene 35. Quién da la clase no va en el lienzo, porque la historia sale de su cuenta y su nombre ya está arriba.

**Miniatura de la tarjeta:** el escritorio oscurecido, la etiqueta verde, el titular en serif y la fecha amarilla.

### 10. Anuncio · Carta del fundador · Agencia
- **Cuándo usarla:** «Quieres llegar a gente que no te conoce contando por qué empezaste.» Es el estático de nivel S para público frío.
- **Ejemplo:** Pulso Dental. Usa la historia del VSL 10 de Copywriter.
- **`pide`:** `historia`, `oferta`, `foto`.

**Capas:**
- **Fondo:** papel #FBF8F1 con textura sutil (formas, sin foto).
- **«Carta»:** Lora 40 #1F2937, interlineado 1.45, margen de 110. El texto:
  > En 2021 perdí 4 de mis 6 clínicas.
  >
  > Los anuncios funcionaban. Lo que fallaba pasaba después: una tarde, en la recepción de una clínica, vi entrar 14 mensajes y contestar 5.
  >
  > Desde ese día no vendemos solo anuncios. Respondemos cada mensaje en menos de 5 minutos, y el paciente llega a su valoración sabiendo el rango de precio.
  >
  > Si tu clínica recibe mensajes pero no pacientes de implantes, te hago una auditoría gratis de 30 minutos y te digo con honestidad si te puedo ayudar.
- **«Firma»:** «Diego Ferrer» en Caveat 72, y «Pulso Dental» en Inter 28 debajo.
- **«Polaroid»:** marco blanco de 300 × 340 rotado 3°, con sombra, arriba a la derecha. Adentro, «Tu foto» (lugar, `lugar-carta-fundador-foto.webp`). Se ve: la recepción vacía de una clínica, con la pantalla de un celular sobre el mostrador, sin caras.
  - **No va una cara de stock:** firmaría una historia de fracaso, y la licencia de Pexels prohíbe mostrar a una persona identificable de forma negativa.
  - El experto pide la foto real del fundador.
- **Tope propio: 90 palabras** (`topePalabras`), con la firma. La carta es texto por diseño; el ejemplo tiene 89.

**Notas:**
- Texto principal (120 caracteres): «Para dueños de clínicas dentales que reciben mensajes pero no pacientes de implantes. Léela antes de cambiar de agencia.»
- Titular (30): «Auditoría gratis de 30 minutos».
- Descripción: «Para clínicas dentales».
- Botón: Más información.

**Miniatura de la tarjeta:** la hoja crema con la carta en serif, la firma manuscrita y la polaroid inclinada.

### 11. Anuncio · Comparación · Inmobiliaria
- **Cuándo usarla:** «Tu cliente duda entre tú y otra opción, y quieres mostrar la diferencia.» Es el Us vs. Them de nivel B, para quien ya conoce el proyecto.
- **Ejemplo:** Torre Alameda. Sale del gancho de contraste del banco de ganchos (plantilla 4 de Copywriter: «Si pagas unos 19 mil de renta…»).
- **`pide`:** `comparacion`, `oferta`, `respuesta_mensaje`.
- **Las cifras son las del elenco** (README, 2.2): el crédito estimado de MXN 18,900 al mes (MXN 2,160,000 a 20 años, con una tasa fija de referencia del 8.6 %) y una renta típica de MXN 14,000. Con esos datos, «el mismo pago al mes», que decía la primera versión, es falso para casi todos, y es una promesa que el negocio no puede sostener. El titular queda condicional.

**Capas:**
- **«Titular»:** «¿Pagas unos 19 mil de renta? Haz esta cuenta.» en Archivo Black 64 #0F172A, sobre blanco, arriba.
- **«Columna de ellos»:** fondo #E5E7EB, título «Sigues rentando», y texto en Inter 36 #6B7280 con cruces #9CA3AF:
  - «Nada queda a tu nombre»
  - «Sube cada año»
  - «Te pueden pedir el depa»
- **«Columna nuestra»:** fondo #0F766E, título «Torre Alameda», y texto en Inter SemiBold 36 blanco con tildes #5EEAD4:
  - «Escritura a tu nombre»
  - «Crédito desde MXN 18,900 al mes*»
  - «Enganche diferido a 18 meses»
- **«Banda»:** #F59E0B, con «Escribe VISITA y agenda tu recorrido» en Archivo Black 40 #111827.
- **«Letra chica»:** «*Crédito estimado a 20 años. Depende del banco.», en Inter 22 #6B7280, abajo.
- **No se nombra a ningún competidor real.**
- **Tope propio: 55 palabras** (`topePalabras`). Una comparación en dos columnas no entra en las 20 de un anuncio. El ejemplo tiene 55.

**Notas:**
- Texto principal (110): «Si pagas renta en Querétaro, haz la cuenta: el enganche se paga en 18 meses y el crédito, desde 18,900 al mes.»
- Titular (35): «Depa de 2 recámaras desde MXN 2.4 M».
- Botón: Enviar mensaje.

**Miniatura de la tarjeta:** las dos columnas, gris contra verde petróleo, y la banda naranja.

### 12. Presentación · Clase que vende · Infoproducto
- **Cuándo usarla:** «Das una clase o un webinar que enseña y termina en tu oferta.»
- **Ejemplo:** Consulta Rentable. Las diapositivas de la clase 11 de Copywriter, con su guion en las **notas** de cada una.
- **`pide`:** `oferta`, `fecha`, `foto`, `resultado`.

**Estilo:**
- la portada y la transición con fondo #0F172A; el contenido con fondo #F8FAFC;
- títulos en DM Serif Display 96 y texto en Inter 40 #334155;
- acento #16A34A.
- Una idea por diapositiva, con 25 palabras como máximo.

**Las diapositivas:**
1. «Cómo llenar tu consulta online sin publicar todos los días» / «Clase en vivo · Dra. Mariana Ochoa».
2. «Lo que te llevas hoy» / «La oferta de entrada que se entiende en una línea» · «El paso del medio entre el mensaje y la consulta» · «Cómo decir tu precio sin bajar la voz».
3. «Quién soy»
   - «Tu foto» (persona, `persona-silueta.webp`): la silueta propia, sin cara. Una cara de stock con el rótulo «Nutrióloga desde 2016 · 140 alumnas» le atribuiría esas credenciales a una persona real (Pexels prohíbe insinuar respaldo; trampa 6). Cuando existan los retratos del elenco hechos en Flow, la muestra es el de Mariana. El experto le pide a la persona su foto de medio cuerpo, en su consultorio, con luz clara.
   - «Nutrióloga desde 2016» · «140 alumnas desde 2023» · «Atiendo en línea desde Guadalajara».
4. «Clave 1 · La oferta de entrada» / «Resultado + tiempo + sin qué sacrificio» / «Ejemplo: "Plan de 3 meses para dejar el picoteo nocturno".» (el mismo de la clase 11 de Copywriter y el plan de Offer, plantilla 2)
5. «Clave 2 · El paso del medio» / tres barras hechas con formas: 60 → 18 → 11, con «mensajes → valoraciones → pacientes» y «Los números de una alumna».
6. «Clave 3 · El mensaje del precio» / «Primero el resultado que quiere, después el plan, al final el precio.»
7. **Fondo oscuro.** «¿Quieres que te acompañe a armarlo en 90 días?»
8. «Consulta Rentable · 90 días» / «Sesión grupal semanal + revisión de tus mensajes» / «USD 1,200 de contado o 2 pagos de USD 650» / «Bono: una revisión 1 a 1» / «20 lugares».
9. «Reserva tu lugar en el enlace del chat» / «Y quédate: ahora respondo tus preguntas.»

**Miniatura de la tarjeta:** la portada azul noche con el titular en serif blanco y «1 de 9».

### Las 5 fotos (Pexels, elegidas a mano en la web; sin la API) y la silueta

| Archivo | Rol | Búsqueda en pexels.com | Lo que tiene que cumplir |
|---|---|---|---|
| `persona-numero-sin-cara-tu-foto.webp` | persona | «hispanic man portrait confident plain background» | de hombros para arriba, gesto neutro y seguro; va solo en la versión B de la 2, junto a una cuadrícula de anuncios anónimos, sin pagos ni credenciales |
| `lugar-caso-con-numeros-foto.webp` | lugar | «modern dental clinic interior bright» | sin personas, sin marcas a la vista |
| `lugar-ficha-propiedad-foto.webp` | lugar | «modern apartment living room large window» | sin personas, sin cuadros ni marcas reconocibles |
| `fondo-invitacion-clase-foto.webp` | fondo | «top view desk laptop notebook fruit» | vertical, con aire en el centro |
| `lugar-carta-fundador-foto.webp` | lugar | «clinic reception desk empty» | sin caras |
| `persona-silueta.webp` | persona | ninguna: la dibujamos nosotros con formas | sin cara ni rasgos; la usan la 1 y la 12 |

- Junto a cada foto se guardan el autor y el link (campo `fotos` de la plantilla). Pexels no lo exige, pero sirve si alguna vez hay que bajarla.
- La foto de la persona de muestra **nunca** lleva un nombre real ni una afirmación negativa.
- **Antes de publicar el plan**, se buscan en la web los nombres del elenco: un nombre inventado puede coincidir con un negocio real.

---

## 3. El agente experto de la tab: el Diseñador de MaKo

### 3.1 El método

0. **Lee antes de preguntar.**
   - El negocio, con `contextoDelNegocio` (`lib/copywriter/contexto.ts`, Second Brain, 1,800 tokens).
   - La voz, con `vozDelNegocio` (`lib/nutricion-generator.ts`) y `vozParaPrompt` (`lib/offer-ia.ts`).
   - La ficha de la plantilla: su `cuando`, el negocio de ejemplo, los datos que son muestra y su `pide`.
1. **Pregunta solo hechos, de a uno.** Como máximo 3 antes de la primera versión, y solo de su `pide`, si el negocio no lo tiene. Lo que siga faltando va como `[DATO: …]` y se avisa en una línea.
2. **Define el trabajo de la pieza:** atraer, abrir conversaciones, vender o cerrar. Si la plantilla no sirve para lo que se pidió, lo dice y nombra la que sirve.
3. **Escribe por capa con los topes del formato:**
   - miniatura: de 0 a 4 palabras que no repiten el título;
   - carrusel: titular de 8 palabras y texto de 15 como máximo;
   - historia: 12 palabras;
   - anuncio: 20 palabras en la imagen, texto principal de 125 caracteres y titular de 40;
   - presentación: 25 palabras por diapositiva.
   - **Excepción por plantilla:** la que no entra en el tope de su formato declara el suyo (`topePalabras`): la invitación a una clase (9), 35; la carta del fundador (10), 90; la comparación en dos columnas (11), 55. El tope cuenta todas las capas de texto de la página.
   Si no entra, **acorta**: no baja la letra.
4. **Compone** con las reglas de las skills: un foco, 3 elementos, contraste, miniatura clara, zonas libres. En miniaturas, mantiene las dos versiones.
5. **Fotos:** no las cambia (el chat no puede). Le dice a la persona qué foto subir y que toque la de ejemplo.
6. **Revisa antes de entregar:**
   - que se lea en chico;
   - que no quede ningún dato del negocio ficticio;
   - que cada número salga del negocio;
   - que la acción exista de verdad.
   Si algo falla, lo dice.

### 3.2 Cómo se cablea (para que el prompt sea editable)

Se sigue `add-editable-prompt`: dos keys **nuevas** en el grupo «Editor de imágenes (Image Editor)» de `lib/prompt-registry.ts`, con los defaults exportados en `lib/image-editor/chat/prompts.ts`. Las dos van en `PROMPTS_CHAT_IMAGEN`, así que `tests/image-editor-chat.test.ts:412` ya exige que estén registradas.

| Key | kind | Slots | scope · sensitive | Uso |
|---|---|---|---|---|
| `image_editor.experto` | instruction | ninguno | full · false | En código va **antes** del system del chat (`image_editor.chat.system`) en todos los pedidos del chat. El chat de la tab ES el Diseñador. No es un slot: el system del chat es `static-only` y `sensitive` (`{{catalogo}}`, `{{formato}}`), y un slot nuevo en un prompt ya editado no llegaría nunca. |
| `image_editor.adaptar.user` | user | `plantilla`, `ejemplo`, `negocio`, `voz`, `respuestas`, `puede_preguntar`, `diseno` | full · false | El pedido de «Adaptar a mi negocio». `negocio`, `voz` y `diseno` van con `contenidoNoConfiable`. |

Con `/modelos-ia` se elige el modelo de la feature nueva **`image-editor-adaptar`** (una fila en `lib/model-catalogo.ts`), aparte de `image-editor-ia`: adaptar es **escribir** y conviene un modelo mejor que el de los retoques. El formato de la respuesta es el del chat más un campo:

```
FORMATO_ADAPTAR_IMAGEN = FORMATO_CHAT_IMAGEN + 'Si te falta un dato imprescindible y "puede_preguntar" es sí, devuelve en cambio {"pregunta": {"texto": "…", "opciones": ["…", "…"]}} sin operaciones.'
```

### 3.3 El prompt base (`image_editor.experto`), listo para registrar

```
Eres el Diseñador de MaKo en el editor de imágenes. Ayudas a negocios de Latinoamérica que venden programas, servicios y propiedades de alto valor (coaches, infoproductores, agencias, inmobiliarias y formadores) a hacer miniaturas de YouTube, carruseles, publicaciones, historias, anuncios de Facebook e Instagram y presentaciones. Hablas en español neutro, de tú, con frases cortas y sin jerga de diseño.

TU TRABAJO
Partes de una plantilla que trae un ejemplo completo de un negocio ficticio y la conviertes en la pieza de ESTE negocio, capa por capa. El ejemplo te enseña la forma. Sus datos no son de nadie y nunca pasan a la pieza nueva. Cada capa tiene un nombre que dice qué es («Gancho», «Titular», «Dato», «Tu foto», «Acción»): úsalo para saber qué va en cada una.

1. LEE ANTES DE PREGUNTAR
Usa lo que te llega del negocio: qué vende, a qué precio, para quién, sus resultados y casos con permiso, sus objeciones, el nombre del dueño, su usuario de Instagram, su ciudad y su voz. No preguntes lo que ya está ahí.

2. PREGUNTA SOLO HECHOS, DE A UNO
Si a la pieza le falta un dato imprescindible, haz UNA pregunta corta sobre un hecho, con opciones cuando se pueda. Como mucho tres antes de la primera versión. Si después de eso falta algo, arma la pieza igual, escribe [DATO: …] en ese texto y avísalo en una línea.

3. DEFINE EL TRABAJO DE LA PIEZA
- Atraer a quien no te conoce: miniatura, carrusel que enseña, carta del fundador.
- Abrir conversaciones: publicación que le da la vuelta a una creencia, carrusel que termina en una palabra por mensaje.
- Vender a quien ya te sigue: caso con números, comparación, últimos lugares, invitación a una clase.
- Cerrar: presentación de una clase o de una propuesta.
Si la plantilla no sirve para lo que la persona quiere, dilo y nombra la que sirve.

4. ESCRIBE CON ESTOS TOPES
- Miniatura de YouTube: de 0 a 4 palabras que agreguen algo al título y nunca lo repitan. Un número grande cuenta como una palabra. Si la imagen se explica sola, sin texto.
- Carrusel: una idea por diapositiva, con titular de hasta 8 palabras y texto de hasta 15. La última pide una sola acción real: guardar, enviárselo a alguien o escribir una palabra por mensaje.
- Publicación: una idea; el titular, de hasta 8 palabras.
- Historia: hasta 12 palabras en pantalla y una sola acción.
- Anuncio: hasta 20 palabras en la imagen. Texto principal de hasta 125 caracteres y titular de hasta 40.
- Presentación: una idea y hasta 25 palabras por diapositiva.
- Si LA PLANTILLA trae su propio tope de palabras (una invitación a una clase, una carta, una comparación en columnas), vale el de la plantilla.
Cuentan todos los textos de la página, también la letra chica, las fechas y los horarios. Si un texto no entra en su caja, acórtalo. No bajes la letra hasta que deje de leerse.

5. COMPÓN
- Un solo foco y como mucho tres elementos (por ejemplo: cara, número y objeto).
- Contraste fuerte: claro sobre oscuro u oscuro sobre claro. Nada de gris sobre gris.
- Miniaturas con fondo claro o de color vivo, no oscuro.
- Si aparece una persona: expresión natural, buena luz, de hombros para arriba. En una miniatura, deja también la versión sin cara (con un número o un objeto) para probar las dos.
- Dos familias de letra como mucho: las del diseño o las de la marca.
- Zonas libres: en la miniatura, la esquina de abajo a la derecha (ahí va la duración). En historias y anuncios verticales, nada importante en el 14 % de arriba, el 35 % de abajo ni el 6 % de cada costado.
- Si el negocio tiene colores, úsalos. Si no, deja los de la plantilla.

6. FOTOS
Las fotos de la plantilla son de ejemplo y nunca las presentes como del negocio. Tú no cambias fotos. Dile a la persona qué foto subir (qué se ve, con qué luz, horizontal o vertical) y que toque la foto de ejemplo para poner la suya. Nunca uses caras, logos ni capturas de otros sin permiso.

7. REGLAS QUE NO SE ROMPEN
- No inventes cifras, resultados, testimonios, nombres de clientes, fechas, precios, lugares disponibles ni garantías. Si el negocio no lo dio, escribe [DATO: …] o reescribe la frase sin el dato.
- Un resultado de dinero o de salud lleva la aclaración «Resultado de un caso en particular».
- Urgencia solo si es verdad: los lugares y la fecha los confirma el negocio.
- Una palabra para escribir por mensaje solo va si alguien la contesta.
- Nada sobre el cuerpo, la salud o el dinero de quien lee («¿Tienes deudas?», «¿Tienes sobrepeso?»).
- De una referencia copias la forma, nunca su texto ni su diseño.

8. ANTES DE ENTREGAR, REVISA
- ¿Se entiende en chico (una miniatura a 320 px de ancho, una publicación a 360 px)?
- ¿Quedó algún texto o dato del negocio de ejemplo? Cámbialo o bórralo.
- ¿Cada número y cada nombre salen de este negocio?
- ¿La acción final existe de verdad?
Si algo falla, dilo en vez de entregar.

CÓMO RESPONDES
En "resumen": una línea con la idea de la pieza y otra con las fotos que la persona tiene que cambiar y lo que supusiste. Los cambios van como operaciones, capa por capa.
```

**El default de `image_editor.adaptar.user`:**

```
LA PERSONA ABRIÓ ESTA PLANTILLA:
{{plantilla}}

EL EJEMPLO ES DE UN NEGOCIO FICTICIO. Te muestra la forma; ninguno de sus datos va a la pieza nueva:
{{ejemplo}}

LO QUE SE SABE DE SU NEGOCIO:
{{negocio}}

SU VOZ:
{{voz}}

LO QUE YA CONTESTÓ:
{{respuestas}}

¿PUEDES PREGUNTAR? {{puede_preguntar}}

EL DISEÑO ABIERTO (JSON):
{{diseno}}

Si falta un dato imprescindible y puedes preguntar, devuelve solo la pregunta. Si no, reescribe TODOS los textos del ejemplo con los datos de su negocio, capa por capa, con las operaciones del catálogo, en todas las páginas. Si el dato del ejemplo no tiene equivalente en su negocio, borra esa capa o deja [DATO: …]. Pon el texto de la publicación en el resumen.
```

**Lo que llena el código:**
- `{{plantilla}}`: «Título · cuándo usarla · trabajo · tope de palabras» (el del formato, o el `topePalabras` de la plantilla si lo tiene).
- `{{ejemplo}}`: «Negocio ficticio: Pulso Dental (Diego Ferrer, Bogotá). Son de ejemplo: los números 6, 23 y 9; Clínica Dental Altamira; Medellín; AUDITORIA; @pulsodental…».
- `{{puede_preguntar}}`: «sí» o «no». Con 3 respuestas, el código manda «no».

### 3.4 Las preguntas (por hechos, de a una, solo las del `pide` que el negocio no tenga)

| `pide` | Pregunta (texto de pantalla) | Opciones |
|---|---|---|
| `titulo_video` | «¿Cómo se llama el video?» | — |
| `resultado` | «¿Qué resultado real puedes mostrar? Un número y en cuánto tiempo.» | — |
| `caso` | «¿Tienes un cliente que te dio permiso para mostrar su resultado?» | Sí · No |
| `foto` | «¿Tienes una foto tuya de hombros para arriba con buena luz?» | Sí · No |
| `respuesta_mensaje` | «Si alguien te escribe una palabra por mensaje, ¿quién le contesta?» | Una automatización · Yo · Nadie todavía |
| `cupos` | «¿Cuántos lugares quedan y qué día cierras?» | — |
| `fecha` | «¿Qué día y a qué hora es, y desde qué ciudad?» | — |
| `propiedad` | «¿Desde qué precio, cuántas recámaras y cuántos m²?» | — |
| `comparacion` | «Cuando tus clientes dudan, ¿contra qué te comparan?» | Otra agencia · Hacerlo solos · Un curso grabado |
| `historia` | «¿Qué te pasó que te hizo empezar? En una frase.» | — |
| `creencia` | «¿Qué creencia de tus clientes escuchas siempre?» | — |
| `oferta` | «¿Cuánto cuesta y cómo se paga?» | — |

Cada pregunta es un mensaje de MaKo en el hilo, con las opciones como píldoras. La respuesta se puede escribir en la caja.

**Lo que cambia la respuesta:**
- «No» en `foto` → el experto borra la versión con cara y deja la sin cara, que en la 1 y en la 2 ya es la página 1.
- «Nadie todavía» en `respuesta_mensaje` → la acción pasa a «Escríbeme por mensaje», sin palabra clave.
- «No» en `caso` → el carrusel 5 se reescribe como «Cómo lo hacemos», con pruebas de proceso y sin números.

### 3.5 Cómo adapta cada plantilla (capa → dato del negocio)

| # | Capa | Sale de | Si no está |
|---|---|---|---|
| 1 | Gancho | el resultado, en 2 o 3 palabras que no estén en el título | sin texto: solo el número (o la cara) y las notificaciones |
| 1 | Dato y Notificaciones | los pagos o inscripciones reales (precio, cuotas, lugares) | se borran las notificaciones y queda el número |
| 2 | Cuadrícula + Gancho | el número real del video (n de N) | la cuadrícula se ajusta a N; si no hay número, se usa la plantilla 1 |
| 3, 4 | Titulares y textos | lo que enseña el negocio; los mitos, de sus objeciones | [DATO] en la diapositiva y se avisa |
| 5 | Portada, diapositivas 2 a 7 | el caso con permiso: antes, 3 cambios, después | «Cómo lo hacemos», sin cifras |
| 6 | Precio, Datos | la propiedad del Brain o de la Offer | [DATO: precio desde] |
| 7 | Creencia y Respuesta | la objeción que más escucha y su método | se pregunta `creencia` |
| 8 | Número, Asientos, Cierre | los lugares y la fecha **confirmados** | no se usa la plantilla y se dice |
| 9, 12 | Fecha, Horarios | el día, la hora y la ciudad; los demás horarios se **calculan**, no se escriben a mano | [DATO: fecha] |
| 10 | Carta, Firma | su historia, en su voz, en 4 párrafos | se pregunta `historia` |
| 11 | Columnas | contra qué lo comparan; su oferta | se pregunta `comparacion` |
| todas | Cabecera, @, Marca | el nombre y el usuario del negocio | las iniciales del nombre |

---

## 4. Qué se copia y de dónde

**Copiable** (licencia leída hoy en su `LICENSE`). Se toma el MÉTODO y las reglas, con texto propio en español, y aun así se conserva el aviso (decisión del README, sección 5): `lib/avisos/LICENSE-<REPO>` y la cabecera del archivo que lo usa.

| Fuente | Licencia exacta | Qué se toma | Dónde va |
|---|---|---|---|
| https://github.com/aabrole/claude-video-thumbnail-skill | MIT, «Copyright (c) 2026 aabrole» | 3 elementos como máximo, composiciones, la esquina de abajo a la derecha libre, zonas seguras verticales, legibilidad a 320 × 180, el texto que complementa el título y los conceptos distintos para elegir (aquí, las 2 versiones por miniatura) | `image_editor.experto`, plantillas 1 y 2 |
| https://github.com/charlie947/social-media-skills (`skills/youtube-thumbnail`, `skills/gemini-carousel`) | MIT, «Copyright (c) 2026 Charlie Hills» | el brief de miniatura (composición, texto, paleta, apoyo, tono), titular de 8 y cuerpo de 15 por diapositiva, la revisión a ~360 px. **Sin Gemini**: el circuito no se copia | `image_editor.experto`, plantillas 3 a 5 |
| https://github.com/jeevanbavandla/instagram-carousel-skill | MIT, «Copyright (c) 2026 Jeevan Bavandla» | los estilos por contenido (Editorial limpio y Alto contraste), la cabecera con iniciales si no hay foto, la barra de progreso, la flecha y la última diapositiva blanca con la acción | plantillas 3 a 5 |
| https://github.com/coreyhaines31/marketingskills (`skills/ad-creative/references/static-ad-templates.md`) | MIT, «Copyright (c) 2025 Corey Haines» | el nivel de cada estático (Founder Message S, Us vs. Them B, Challenging Your Beliefs B, Stat Callout C, Review Card E) para elegir el trabajo de la pieza; «real names, real stats, and real quotes only» | plantillas 7, 10 y 11; reglas del experto |
| https://www.pexels.com/license/ | Pexels License (leída hoy). Permite el uso libre y modificar, sin atribución obligatoria. Prohíbe mostrar personas identificables «in a bad light», «imply endorsement», vender copias sin modificar y redistribuir en otras plataformas de stock | las 5 fotos de ejemplo, elegidas a mano y guardadas en `public/cv/plantillas/fotos/` (la silueta de la 1 y la 12 es propia) | plantillas 2, 5, 6, 9 y 10 |

**Solo como idea** (no se copia texto, código ni diseño):

| Fuente | Por qué |
|---|---|
| Canva (https://www.canva.com/youtube-thumbnails/templates/, https://www.canva.com/facebook-ads/templates/) | Su Content License dice que las plantillas son para usar solo en Canva (lo leyó la investigación del 29/10; hoy WebFetch da 403). Se copia la FORMA de mostrar: la pieza terminada, el nicho en el nombre, «1 de 3» y el en blanco primero. |
| Kapwing (https://www.kapwing.com/templates/youtube-thumbnail) | Producto con copyright: solo los filtros por tema. |
| https://github.com/anthropics/skills/tree/main/skills/canvas-design | Apache-2.0 (LICENSE.txt de la carpeta, leído hoy). Copiable, pero no hace falta: la idea de «primero la idea de la pieza, después la composición» queda en la primera línea del resumen del experto. |
| vidIQ (https://vidiq.com/research/youtube-thumbnail-study/) y 1of10 (https://1of10.com/blog/what-actually-makes-a-youtube-video-go-viral-in-2025) | Son datos: se usan los hechos, no el texto, y no van como números en ningún prompt. |
| Pexels API (https://www.pexels.com/api/documentation/) | Términos leídos hoy: link visible a Pexels, crédito al fotógrafo cuando se pueda, 200 pedidos por hora y 20,000 por mes, prohibido replicar Pexels. **No se usa ahora**: las fotos de las plantillas se eligen a mano. Queda para un panel «Fotos» (hoy `stock: null`). |
| Unsplash (https://unsplash.com/license) | Leída hoy: prohíbe juntar fotos «to replicate a similar or competing service», y un editor con banco de fotos se parece a eso. Su API exige hotlink (dato de la investigación), lo que choca con «se guarda nuestra copia» de `lib/imagenes-stock.ts`. **No se usa.** |
| Google Fonts | Ya están en el editor (`fuentes.ts`: OFL-1.1 o Apache-2.0 según Fontsource). No se suma ninguna fuente. |

---

## 5. Cómo implementarlo sobre el código actual

**Orden:** primero la base común (tanda 0 del README, sección 6: los campos comunes de `PlantillaCrear` y el aviso «Ejemplo»), después las plantillas, después el experto.

### 5.1 Las plantillas

1. **Se escriben como datos compactos y se generan.** Doce JSON de Doory escritos a mano son ~400 KB de `fabric` crudo.
   - Molde: `scripts/image-editor/genera-elementos.mjs` y `genera-fuentes.mjs`.
   - Lo nuevo: `scripts/image-editor/genera-plantillas.mjs` lee `scripts/image-editor/plantillas-fuente/<slug>.mjs` (página → capas con nombre, tipo, caja, estilo y texto) y escribe `app/image-editor/mako/plantillas/<slug>.json`.
   - Los ids salen de un hash de `slug + página + capa`: son estables entre corridas. Sirven para reconocer la plantilla (5.3) y no se regeneran.
   - Las fotos van como `type: 'image'`, con `isPlaceholder: true` y `slot: { cx, cy, width, height, angle, mask, radius, src }`. Los marcos de las iniciales son marcadores con forma de círculo.
2. **`app/image-editor/mako/plantillas.ts`:**
   - `PLANTILLAS` pasa a tener las 12. **Las 10 de Doory se borran** (sus 10 JSON y sus 10 WebP). Los diseños ya creados no se rompen: llevan el documento adentro, no una referencia.
   - `CATEGORIAS` pasa a ser por formato: Miniaturas de YouTube · Carruseles · Publicaciones · Historias · Anuncios · Presentaciones.
   - `Plantilla` suma estos campos:
     - `cuando`;
     - `trabajo` ('atraer' | 'conversar' | 'vender' | 'cerrar');
     - `ejemplo: { negocio, quien, muestras: string[] }`;
     - `pide: Pide[]`;
     - `fotos: { capa, rol: 'persona' | 'lugar' | 'fondo', autor, url }[]` (la silueta, con `autor: 'MaKo'`);
     - `versiones?: 2`;
     - `topePalabras?: number`: el tope propio de la 9, la 10 y la 11 (3.1, punto 3). Sin él, vale el del formato.
   - `description` = `cuando`. Así lo lee también la API (`listar_plantillas_imagen` en `lib/api-mako/areas/imagen.run.ts`) y el Cerebro elige bien la plantilla.
   - Se corrige el comentario de cabecera: todavía dice que el texto del lienzo «sigue en inglés».
3. **`app/image-editor/mako/plantillas-etiquetas.ts`:** las 12 filas.
   - 3: `{canal: ['conversaciones'], entrada: ['chat_entrante']}`
   - 5: `{canal: ['llamadas']}`
   - 6: `{canal: ['presencial']}`
   - 8: `{canal: ['conversaciones']}`
   - 9 y 12: `{canal: ['webinar']}`
   - 10: `{canal: ['llamadas'], entrada: ['formulario_anuncio']}`
   - 11: `{canal: ['presencial'], entrada: ['formulario_anuncio']}`
   - 1, 2, 4 y 7: `{}`. Son de cualquier modo de vender, la misma regla que dejó la miniatura de Doory en `{}`.
4. **`public/cv/plantillas/<slug>.webp`:** las 12 miniaturas salen del propio editor, en el banco de esbuild + Chrome sin ventana (`docs/hallazgos-editor-imagen.md`, «Verificar el editor sin el dev server»), con las fotos ya puestas. **En el mismo paso** se mide cada texto con la fuente cargada (`measureText`). Un texto que no entra se arregla en la fuente de la plantilla con la medida escrita, como `AJUSTES`.
5. **`public/cv/plantillas/fotos/`:** las 5 fotos y la silueta. **Nunca se renombran ni se borran:** los diseños guardados las apuntan por ruta. Si hay que cambiar una, se sube con otro nombre.
6. **`scripts/image-editor/traducir-plantillas.mjs` y `traduce-plantillas.mjs`:** se borran, porque solo servían para las de Doory. ✅ **Hecho el 6/11/2026**, junto con las 10 plantillas, sus JSON, sus WebP y `mako/plantillas-etiquetas.ts`.

### 5.2 «Nuevo diseño» y la tarjeta

7. **`app/_crear/reglas.ts`:**
   - `PlantillaCrear` usa los campos comunes de la tanda 0 (README, sección 6). Image llena `grupo`, `insignia`, `ayuda` y `ejemplo`.
   - Suma también `cajaDeMiniatura(formato)`: la caja de la imagen a su proporción dentro del 4:3, como `marcoDe`, pero al 90 % y sin el margen del rótulo. No se llama `miniaturaDe`: ese nombre ya existe en `app/crm/lead-view/ficha/galeria.ts:99` y en `lib/embeds.ts:665`, con otras firmas (README, 2.4).
   - Su test: `tests/crear-pantalla.test.ts`.
8. **`app/_crear/PantallaCrear.tsx`** (`NuevaCrear`):
   - si las plantillas traen `grupo`, dibuja una sección por grupo, en el orden en que llegan;
   - la `<img>` va con `style={cajaDeMiniatura(pl.formato)}` y no a pantalla completa;
   - la insignia va arriba a la derecha de la miniatura.
   **`app/_crear/crear.css`:** la sombra de la miniatura en proporción y `.cr-plantilla__insignia`. En la caja de la tarjeta, `object-fit: contain`.
9. **`app/image-editor/plantillas-crear.ts`:**
   - `plantillasNuevoDiseno(senales)` reemplaza a la constante `PLANTILLAS_NUEVO_DISENO`;
   - arma los grupos por formato: el tamaño en blanco de ese formato primero y después las plantillas del formato, con las sugeridas adelante (`ordenarConSugeridas`);
   - `insignia` es «1 de N» si tiene varias páginas y «2 versiones» si `versiones` vale 2;
   - el blanco de 1080 × 1080 y el de 1200 × 628 quedan en Publicaciones y Anuncios, y el carrusel en blanco abre Carruseles.
   `ImageEditorCliente.tsx` ya tiene `senales`: se los pasa.
10. **`app/m/image-editor/InicioImagenM.tsx`:** la misma lista, los mismos grupos y la misma miniatura en proporción.

### 5.3 El aviso de ejemplo, las muestras y la descarga

11. **Nuevo `app/image-editor/mako/muestras.ts`** (puro):
    - `plantillaDeOrigen(doc)`: por los ids de la plantilla que siguen en el documento;
    - `textosDeMuestra(doc)`: los textos que siguen siendo iguales a los de alguna plantilla, de 10 caracteres o más, para no marcar «ANTES»;
    - `fotosDeMuestra(doc)`: las `image` cuyo `src` o `slot.src` empieza con `/cv/plantillas/fotos/`, con su rol según el prefijo del archivo.
12. **`app/image-editor/editor/PantallaEditor.tsx`:** con `plantillaDeOrigen`, una tira chica arriba del lienzo: «Ejemplo: Pulso Dental (negocio ficticio)». Se va cuando no quedan muestras.
13. **`app/image-editor/_doory/editor/dialogs/DownloadDialog.tsx`:**
    - con una foto `persona-` o `lugar-` de muestra, **no descarga** y dice «Cambia la foto de ejemplo por la tuya»;
    - con textos de muestra, avisa y deja seguir («Quedan textos del ejemplo»).
    Es código de Doory: el crédito sigue (`LICENSE-DOORY`).

### 5.4 El Diseñador

14. **`lib/image-editor/chat/prompts.ts`:**
    - `PROMPTS_CHAT_IMAGEN` suma `experto: { key: 'image_editor.experto' }` y `adaptar: { key: 'image_editor.adaptar.user' }`;
    - suma los defaults `EXPERTO_IMAGEN_TEMPLATE` y `ADAPTAR_IMAGEN_USER_TEMPLATE` de la sección 3.3.
15. **`lib/prompt-registry.ts`:** importa los dos defaults y suma las dos `Entry` al grupo «Editor de imágenes (Image Editor)». Después se corre la skill `verify-prompt-registry-sync`.
16. **`lib/image-editor/chat/ia.ts`:**
    - `editarImagen` antepone `renderPrompt(experto)` al system del chat;
    - **`adaptarImagen({ plantilla, respuestas, diseno })`** es nueva:
      - lee la ficha de la plantilla en `catalogoPlantillas` / `PLANTILLAS`;
      - lee el negocio con `contextoDelNegocio(cuando + pide)` y la voz con `vozDelNegocio()` + `vozParaPrompt`;
      - con 3 respuestas, `puede_preguntar` es `'no'`;
      - corre con la feature `image-editor-adaptar` y `formato: FORMATO_ADAPTAR_IMAGEN`;
      - devuelve `{ ok, pregunta }` o `{ ok, resumen, operaciones, descartes }`, validados con `validarOperaciones`, como siempre.
17. **`lib/image-editor/chat/catalogo.ts`:**
    - `FORMATO_ADAPTAR_IMAGEN`;
    - `validarPregunta` (texto de hasta 200 caracteres y hasta 3 opciones de 40);
    - **opcional:** la operación `notas` (`{ op: 'notas', pagina, texto }`), para que el texto de la publicación quede en las notas de la página y no solo en el resumen. Hay que sumarla también en `lib/image-editor/chat/aplicar.ts`.
18. **`lib/model-catalogo.ts`:** la fila `image-editor-adaptar` («Adaptar una plantilla al negocio en el Image Editor»).
19. **`app/api/image-editor/ia/route.ts`:** `body.modo === 'adaptar'` llama a `adaptarImagen` con `body.plantilla` (buscado en el catálogo, no confiado) y `body.respuestas` (hasta 3, de hasta 300 caracteres cada una). La puerta y el `rateLimit` siguen igual.
20. **`app/image-editor/mako/chat/acciones.ts`:** `pedirAdaptacion(editor, slug, respuestas)` contra la misma ruta.
21. **`app/image-editor/mako/chat/PanelMakoIA.tsx`:**
    - Si `plantillaDeOrigen(doc)` existe y quedan muestras, el hilo arranca con un mensaje de MaKo armado en el código, sin IA: «Es un ejemplo de Pulso Dental, un negocio ficticio. ¿Lo adapto a tu negocio?». Lleva dos píldoras: «Adaptar a mi negocio» y «Lo edito yo».
    - Una `pregunta` se muestra como mensaje de MaKo, con sus opciones como píldoras.
    - Las operaciones llegan como la propuesta de siempre, con «Original | Modificado», Aceptar y Restaurar.
    - Después de aceptar, si `fotosDeMuestra` no está vacío: «Falta tu foto: toca la de ejemplo para cambiarla.»

### 5.5 Tests

22. **`tests/image-editor-plantillas-crear.test.ts`:** cambian a propósito dos reglas: «primero todo lo en blanco» (ahora es por grupo) y `plantillas={PLANTILLAS_NUEVO_DISENO}` (ahora es la función con `senales`).
23. **Nuevo `tests/image-editor-plantillas-reales.test.ts`.** Para cada plantilla:
    1. ningún texto del lienzo ni de las notas tiene voseo (`marcasDeVoseo`). **El guard de `puente-panel-copy` solo recorre `.ts` y `.tsx`: los JSON pasan sin revisar**;
    2. no aparece «lorem» ni el nombre de un cliente real (la lista de `tests/variables-aviso.test.ts` hay que exportarla para usarla aquí);
    3. el negocio de ejemplo es del elenco;
    4. cada foto es un marcador con rol, crédito y archivo existente en `public/`;
    5. los topes de palabras se cumplen sumando **todas** las capas de texto de cada página («Leyenda», «Datos», «Horarios», las columnas y la letra chica también, no solo «Titular», «Texto» y «Gancho»), contra el tope del formato o el `topePalabras` de la plantilla. Una palabra es todo lo que tiene una letra o un número. La primera versión del plan medía solo tres capas, y la historia 8 (38 palabras, con un tope de 12), la 9 (44) y el anuncio 11 (56, con un tope de 20) pasaban;
    6. cada `pide` está en la tabla de preguntas;
    7. la miniatura existe;
    8. los horarios de una clase son coherentes entre sí (un horario de referencia + los husos).
24. **`tests/image-editor-chat.test.ts`:** cuenta sola con las keys nuevas. Hay que sumar que `adaptarImagen` hace `renderPrompt(PROMPTS_CHAT_IMAGEN.adaptar.key, ADAPTAR_IMAGEN_USER_TEMPLATE` y que la ruta busca la plantilla en el catálogo.

**Cosecha, en el mismo commit:** `docs/hallazgos-editor-imagen.md` suma la entrada con las trampas 1 a 8 de la sección 6.

---

## 6. Trampas

1. **El diagnóstico obvio era el equivocado: no faltaban plantillas, faltaba el ejemplo lleno y la foto.** Las 10 de Doory ya tenían estructura. Se ven vacías por los rectángulos grises `rgba(140,128,132,0.18)` y porque son de bodas, conciertos y currículums.
2. **La tarjeta recorta lo que no es 4:3:** `.cr-plantilla__mini img { object-fit: cover }`. Con plantillas reales, a una historia solo se le vería el tercio del medio. Hay que dibujarla a su proporción (`cajaDeMiniatura`).
3. **«Quitar fondo» está APAGADO**, así que la miniatura de manual (persona recortada con contorno blanco) no se puede ni diseñar ni repetir con la foto del usuario. Las plantillas usan la foto en un marco con máscara, que funciona igual con la foto que suba la persona.
4. **El chat no puede poner ni cambiar fotos** (`NO_SE_PUEDE_CHAT_IMAGEN`). El experto no «adapta la foto»: la pide. Para que tocarla ofrezca cambiarla, la foto tiene que ser un **marcador** (`isPlaceholder` + `slot`). Una `image` común no lo ofrece.
5. **El guard de voseo no ve las plantillas:** `puente-panel-copy` lista con `git ls-files` solo `.ts` y `.tsx`, y el texto del lienzo vive en `.json`. Hace falta su propio test (5.5, punto 23).
6. **Una cara de stock junto a una promesa es prueba falsa, y la licencia de Pexels (leída hoy) prohíbe «imply endorsement» y mostrar a alguien «in a bad light».** Por eso:
   - ninguna cara de stock va en un fracaso, en un «antes» ni en un testimonio (la carta del fundador usa la foto de la recepción);
   - **tampoco junto a un pago, una cifra del negocio o una credencial.** La primera versión ponía una cara de Pexels junto a «Pago recibido · USD 1,500» (la 1) y rotulaba a otra como «Nutrióloga desde 2016 · 140 alumnas» (la 12). Las dos usan ahora la silueta propia;
   - **la tarjeta de la galería no pasa por la guarda.** `public/cv/plantillas/<slug>.webp` es público; la guarda de descarga cuida el diseño, no la miniatura. Por eso la tarjeta de la 1 es la versión sin cara;
   - una foto `persona-` o `lugar-` de muestra no se descarga sin reemplazarla.
   No se encontró en el repo ningún «personaje base» ficticio para usar como cara de ejemplo, aunque el borrador anterior lo daba por hecho.
7. **Dos cifras de la investigación no eran lo que decían sus fuentes:**
   - **1of10 no dice que en «negocios» la cara rinda peor.** Dice que ayuda en finanzas y daña en **salud y fitness**. Eso le toca a Consulta Rentable (nutrición): sus piezas van sin cara o con la cara en la presentación, no en la miniatura.
   - **La legibilidad verificada es a 320 × 180 px** (skill de miniaturas, MIT) y ~360 px para el feed (charlie947). No a 120 px.
8. **Los ids de la plantilla viajan al diseño:** `documentoDePlantilla` copia el JSON tal cual. Sirve para saber de qué plantilla viene un diseño (`plantillaDeOrigen`) sin migración. Por eso el generador tiene que dar ids **estables**: si cambian entre versiones, los diseños viejos dejan de reconocerse. Y las fotos de `public/cv/plantillas/fotos/` no se renombran nunca.
9. **El español desborda:** «OFERTA» se cortaba en «OFERT» (hallazgo del 14/10). Cada texto se mide en el banco con la fuente real, y el experto **acorta**: no achica la letra.
10. **Tachar y resaltar:**
    - `linethrough` usa el color del texto: un tachado rojo sobre texto oscuro no existe; se tacha en gris;
    - una forma detrás de unas palabras se desacomoda cuando el texto cambia: el resaltado va en su propio texto con el efecto `background`.
11. **Las medidas «de siempre» están viejas:**
    - `anuncio_facebook` es 1200 × 628 (`lib/image-editor/tamanos.ts`), y Meta recomienda 4:5 para el feed;
    - Redimensionar no tiene 1440 × 1800, así que los anuncios van a 1080 × 1350 y se descargan ×2;
    - YouTube recomienda hoy 3840 × 2160 (dato de la investigación, no releído hoy).
12. **El system del chat es `static-only` y `sensitive`.** El método va en una key aparte, antepuesta en el código. Un slot nuevo en un prompt que alguien ya editó no llega nunca.
13. **El chat de imagen corre con `image-editor-ia`, que en `lib/model-catalogo.ts:241` tiene GEMINI por defecto**, y la decisión del 22/10 (memoria) es «sin Gemini». **Sin resolver:** se revisa antes de cablear. El experto va en su propia feature (`image-editor-adaptar`) para elegirle un modelo que escriba bien.
14. **Las skills copiables vienen atadas a Gemini o Nano Banana** (charlie947) y a generar píxeles. Claude no genera imágenes: el experto entrega operaciones sobre capas, no imágenes. Los «4 conceptos en grilla» quedan como **2 versiones dentro de la misma plantilla**.
15. **El brief de miniatura del guion 12 de Copywriter repite el título** («43 DE 50 FALLAN» con «por qué 43 no traen pacientes»). La plantilla 2 usa «¿EL TUYO?». Ya se alinearon en este plan: la plantilla 12 de Copywriter y la receta 2.12 de Video dicen lo mismo.
16. **Una palabra clave sin nadie que la conteste es una promesa rota.** El experto pregunta quién contesta y, si nadie, la acción pasa a «Escríbeme por mensaje».
17. **Dos tests se rompen a propósito y hay que reescribirlos, no forzarlos:** el test 1 de `image-editor-plantillas-crear` («primero lo en blanco», «cada plantilla del editor está en Nuevo diseño») y el test 5 (la lista literal en las dos pantallas).
18. **Las herramientas fallan en silencio:**
    - las licencias se leen en `raw.githubusercontent.com/<repo>/main/LICENSE` (anduvo con las 4 skills);
    - Canva da 403 a WebFetch;
    - la página de Kapwing muestra «0+» por un error de carga suyo;
    - la URL de plantillas de Adobe Express da 404.
19. **Sin verificar:**
    - el Content License de Canva (lo leyó la investigación, hoy da 403);
    - las medidas de la Meta Ads Guide y el límite de 20 ítems por carrusel (de la investigación, no releídos);
    - si los anuncios de vivienda caen en una categoría especial de Meta en México (afecta a la plantilla 11);
    - los términos del motor de Flow para generar caras de ejemplo propias;
    - que los nombres del elenco no coincidan con negocios reales (buscarlos antes de publicar).

**Lo que queda SIN hacer, con dónde vive:**
- todo lo de la sección 5, porque nada está implementado;
- la elección de las 5 fotos concretas en pexels.com y el dibujo de la silueta: la tabla de la sección 2 da la búsqueda y los criterios, no el id;
- el panel «Fotos» del editor (`stock: null` en `app/image-editor/mako/adaptadorNube.ts`);
- mover `contextoDelNegocio` y `vozDelNegocio` a un `lib/` común (tanda 0).
