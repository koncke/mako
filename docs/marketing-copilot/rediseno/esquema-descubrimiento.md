# Marketing CoPilot: el esquema del arranque (la primera vez)

Lo que pidió Martín sobre las maquetas (11/11/2026, cinco vueltas):
- **Al entrar por primera vez no está el chat.** Primero una pregunta simple, **«¿Por dónde vendes?»**, con botones grandes:
  Anuncios, Instagram, YouTube, sin subtítulo. Prospección no va por ahora, porque su lectura no se puede hacer.
- **Después, botones grandes para cargar lo que haga falta según lo elegido.**
  - Anuncios, Instagram y YouTube **se conectan** con Zernio, como Meta: no se pega el @ ni el link.
  - Para todos: tu web y el PDF o archivo que explica tu oferta.
  - **Ninguno es obligatorio**, y se tiene que ver que no lo es.
- **La lectura con la animación de MaKo**: lee todo lo que se cargó.
- **Paso 4, «Tu negocio», es un ANÁLISIS y no lleva chat al costado (todavía).**
  - «Tu oferta» con su nota y «Mejorar oferta».
  - «Tu web», que dibuja la página.
  - Una pestaña por canal con los puntos que hay que tocar según los cursos, y feedback en cada uno.
  - No es una réplica de cada plataforma.
- **Paso 5, «La operación»**, aparte porque en una pestaña era demasiado:
  - lo que MaKo hace solo: presupuesto, cortar, renovar;
  - lo que te pide: grabar un anuncio, una historia o un video;
  - los resultados;
  - la máquina de contenido de cada canal.
- **Siempre hay salida para quien no tiene nada todavía** (sin web, sin publicar).

Las maquetas, en `docs/marketing-copilot/rediseno/`, una por vuelta para poder compararlas:

| Maqueta | Qué cambia | Artifact |
|---|---|---|
| [`maqueta-analisis.html`](maqueta-analisis.html) | **La vigente.** Zernio en el paso 2; «Tu negocio» como análisis y sin chat; «Tu oferta» con «Mejorar oferta», la nota al costado y «Mejorar» / «Corregir» en cada nota; «Tu web» dibujada; el paso 5, la operación. | claude.ai/artifact/6oFhRx6JnoHMVgFyoUxcNN |
| [`maqueta-por-canal.html`](maqueta-por-canal.html) | «Tu negocio» con una pestaña por canal, cada una con la cara de su app; logos reales; varios archivos de oferta; el texto en tú. | claude.ai/artifact/97pKNFeiPV4U8asB9ejLwn |
| [`maqueta-arranque.html`](maqueta-arranque.html) | Botones primero, sin chat, y la lectura de lo que se cargó. | claude.ai/artifact/LUyer4k7kV1sokRuBYeX44 |
| [`maqueta-descubrimiento.html`](maqueta-descubrimiento.html) | El chat desde el principio, pidiendo tu Instagram y tu web en el bloque. | claude.ai/artifact/XboRwCiqtwybpf4iPXQpqw |
| [`maqueta-dos-columnas.html`](maqueta-dos-columnas.html) | La primera: «Tu funnel» como página de Copywriter. Martín no la quiso. | claude.ai/artifact/PyGboJ5AsKL2wUiPe2Kssk |

Lo que hay que revisar en cada canal, con su curso y su clase, está en `docs/marketing-copilot/analisis/`:
- `organico.md`: Instagram, YouTube, la web y la máquina de contenido;
- `anuncios.md`: los cuatro tipos de funnel con anuncios, los anuncios en sí y su máquina;
- `zernio.md`: qué trae de verdad la conexión.

## Los pasos

### 1. ¿Por dónde vendes?

- **Qué pasa:** tres tarjetas, Anuncios, Instagram y YouTube, sin subtítulo; se puede elegir más de uno.
- **Cómo se ve:** pantalla completa, sin chat.
- **De dónde sale:** el wizard de la casa (`app/_components/WizardShell.tsx`).

### 2. Pásame lo que tengas

- **Qué pasa:**
  - Se conectan **Tu cuenta de anuncios** («Conectar con Facebook»), **Tu Instagram** («Conectar Instagram», con la nota «Tu cuenta tiene que ser de empresa o de creador») y **Tu canal de YouTube** («Conectar YouTube»).
  - Para todos: **Tu página web** y **Sube lo que explica tu oferta**.
  - «Leer todo» se habilita con uno solo.
- **Cómo se ve:** pantalla completa, sin chat.
- **De dónde sale:**
  - El botón para conectar por Zernio (`ConectarViaZernio`), el mismo para las tres redes.
  - La zona para soltar archivos del Archivero.
  - Las descripciones prometen sólo lo que Zernio confirma (`analisis/zernio.md`).

### 3. La lectura

- **Qué pasa:** la estrella de MaKo, paso por paso («Trayendo tu Instagram…», «Leyendo los números de tus reels…», «Mirando cuánto miran tus videos…»), y la película de las piezas que se reparten en carpetas.
- **Cómo se ve:** la pestaña entera.
- **De dónde sale:** la lectura de Competitor Spy (`mirarCompetidor`, `PeliculaDeOrden`).

### 4. Tu negocio: el análisis

- **Qué pasa:** pestañas **Tu oferta**, **Tu web** y una por canal. Arriba a la derecha, **«Ponerlo en marcha»** lleva al paso 5.
  - **Tu oferta:**
    - su funnel de hoy y lo que leí;
    - **Nota por nota**, cada una con su porqué y «Mejorar» (abre Offer en esa parte) y «Corregir» (un campo: puede estar mal leído);
    - al costado, «Mejorar oferta» y la nota total.
  - **Tu web:** la página entera en el navegador del Spy, con marcas numeradas sobre la captura y la lista de lo que hay que tocar.
  - **Instagram:** perfil (link, bio, destacadas), lo que publicas, cada cuánto, historias.
  - **YouTube:** el canal y los videos.
  - **Anuncios:** el tipo de funnel arriba (mensajes, VSL con llamada, formulario, compra directa), sus puntos y los de los anuncios en sí.
- **Cómo se ve:** a todo el ancho, sin chat.
  - Cada punto es una fila con su estado (Bien, Mejorar, Arreglar, Sin dato) y una frase.
  - Al abrirla: lo que vi, lo que dicen los cursos (con curso y clase), «Mejorar» y «Corregir».
  - Al costado: cuántos puntos están bien, «Lo primero», y con qué se leyó.
- **De dónde sale:**
  - Las pestañas de la ficha (`.spy-pestanas`).
  - Las filas de nota de Offer (`.of-fila`, `app/offer/Conclusion.tsx`), con su desplegable.
  - La cabeza de la oferta del Spy (`.spy-oferta-cabeza`, el anillo).
  - El navegador de «Sus páginas» (`.spy-navegador`, `app/competitor-spy/SusPaginas.tsx`).
  - Las pastillas del gráfico del Spy (`.spyg-red`).
  - Los puntos, de `analisis/organico.md` y `analisis/anuncios.md`.

### 5. La operación

- **Qué pasa:** una pestaña por canal, cada una con:
  - **Te toca:** lo que MaKo te pide («Graba 3 anuncios nuevos», «Graba esta historia hoy», «Graba el video de esta semana»), con su guion.
  - **Lo que hice solo:** subir un presupuesto, apagar un anuncio, renovar un conjunto cansado, programar reels, hacer la miniatura; cada uno con «Deshacer».
  - **La máquina de contenido:** cuánto publicar y cuánto grabar según el ritmo (Poco tiempo, Marca personal, Con equipo), cada número con su curso. En Anuncios, las 9 razones de compra (3 «a quién» × 3 «por qué», de Jan Schroeder).
  - Al costado: los resultados y la semana.
- **Cómo se ve:** a todo el ancho, sin chat. «← El análisis» vuelve al paso 4.
- **De dónde sale:**
  - Las cadencias, de `organico.md` §4 y `anuncios.md` §3.
  - Las reglas de corte y de cansancio, del código de MaKo (Recon y `getFatigaAdsets`, `lib/queries.ts`).

### 6. Sin nada todavía

- **Qué pasa:** el chat a pantalla completa con las preguntas justas: qué vendes, a quién, qué logra, cuánto cobras, si ya vendiste y una del canal.
  - Con eso aparece «Tu negocio» **sin chat**: tu oferta en borrador con lo que le falta, y en cada canal **lo primero que hay que dejar armado** (bio, link, destacadas, primeros videos, las 3 razones y el primer anuncio), todo «Por hacer».
- **Cómo se ve:** el chat solo mientras pregunta; después, «Tu negocio» a todo el ancho.
- **De dónde sale:**
  - Las preguntas, de `PIEZAS_DEL_ARRANQUE` y `PREGUNTAS_GUIA` (`lib/offer-marco.ts`), y de programa-meta-ads-the-net-lab · 11 y 12.

## Lo que la maqueta simula

- **El negocio es Federico Cristofari**, del Competitor Spy del ws 9 (`competidor=20`), leído el 11/11. Es de verdad:
  - sus piezas: 141 de Instagram y 91 de YouTube;
  - sus formatos, fechas, vistas y destinos;
  - lo que rinde cada tipo de pieza;
  - las palabras clave de sus reels;
  - el link de su perfil (linktw.in/pywydg, que abre un video de YouTube);
  - los comentarios de su último video;
  - su oferta: 46/100 y el porqué de cada nota, pasado de «su web» a «tu web»;
  - su página foundersbc.cascaraco.com, con la captura de ese día.
- **Es de ejemplo, y la maqueta lo marca «ejemplo»:**
  - lo que sólo trae la conexión con Zernio (alcance, visitas al perfil, toques al link, minutos vistos, suscriptores ganados);
  - sus anuncios y sus chats;
  - todo el paso 5.
- **Las razones de compra** del paso 5 son frases de su página y sus reels.

## Lo que falta en el código para hacerlo de verdad

Viene de los tres relevos; el detalle está en cada documento.

- **Zernio:**
  - no se sabe si trae la bio ni su link (`zernio.md` §4): la maqueta la lee del perfil público;
  - las historias se leen sólo desde que se conecta;
  - el porcentaje de clics de la miniatura de YouTube no lo da nadie;
  - las rutas de historias y de analytics de YouTube no están en el código;
  - hay un 402 del 28/10 que contradice que Analytics esté incluido.
- **Anuncios** (`anuncios.md` §0 y §4):
  - el sincronizador de Meta no guarda conversaciones iniciadas ni compras;
  - no existe leer los chats en lote: el Asesor lee uno y el Chat Analyst nunca lee el texto;
  - no se transcribe el video del VSL;
  - el área `ads` del conocimiento está vacía.
- **Web:**
  - el Landing Analyst no mide la velocidad ni compara con el anuncio;
  - la captura con marcas es nueva: reusa el recorrido de comentarios del editor de landing.

## Lo que falta decidir

- **Quién paga leer tu propio negocio.** Cuesta lo mismo que leer un competidor: Apify más la IA del análisis. Es plata, y se pregunta una vez, en palabras de producto, antes de programarla.
- **La recomendación del funnel** (antes la cerraba el chat): sin chat en el paso 4, falta decidir dónde va.
- **Dónde vuelve el chat** y qué se ve al lado.
- **Qué hace MaKo solo y qué te pregunta** en la operación: presupuesto, apagar, publicar. La maqueta lo hace solo con «Deshacer».
- **Prospección** quedó afuera: su lectura no se puede hacer.
- **Newsletter** no está entre los tres canales. Entra después, como funnel.
