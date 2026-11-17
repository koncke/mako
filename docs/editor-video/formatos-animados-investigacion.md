# Formatos de video animado por código: qué rinde y qué lo hace verse profesional (relevo del 17/11/2026)

> Copia versionada del relevo del 17/11/2026 (chat «galería de animaciones», un agente). La evidencia —hojas de contacto,
> cuadros, transcripciones y el texto de las skills leídas— quedó fuera del repo, en `C:/dev/artefactos-animaciones/investigacion/`;
> las rutas `videos/…` de abajo son relativas a esa carpeta.


Construye sobre `docs/editor-video/animaciones-por-codigo.md` (rama `punta/animaciones-codigo`). No repite sus
referencias (Ale Ferr, Morrow, Adilet, mrcreates, sanji): suma 9 videos de YouTube, 11 de TikTok y las skills públicas
leídas por dentro. Todo lo bajado está en `videos/<id>/` (video, transcripción, hojas de contacto y cuadros). Las rutas de
este documento son relativas a `C:/dev/artefactos-animaciones/investigacion/`.

## Lo esencial, en un minuto

1. **Lo que se ve profesional casi nunca es un «estilo»: es algo real, movido con números.** La interfaz real del
   producto, la cara real del creador, el logo en su archivo original. La animación pone encima tiempos medidos: el
   movimiento dura de 0,3 a 0,6 s, aterriza desacelerando y sale acelerando, y nada nace de tamaño cero.
2. **Por qué la galería de 8 reels «todavía no» (hipótesis, falta mirarla con la lista):** las dos guías más serias que
   hay, las de HyperFrames y motionmaxxing, tienen una lista de **lo que delata un video generado**. Cuatro de los ocho
   reels se apoyan justo en eso:
   - **sanji**: neón y bloom;
   - **aleferr**: vidrio azul y degradé azul;
   - **adilet**: papel crema con serif y etiquetas en mono;
   - **partículas**: partículas como decoración.

   La lista también incluye los contadores tipo «PASO 2 DE 5» pegados en una esquina, y morrow los usa. Copiar la
   superficie de la referencia trae sus defaults. Lo que distingue a los buenos es el contenido real y el timing medido.
3. **Los formatos que más rinden**, ordenados por vistas en la muestra:
   1. el corto animado sin cara, con personaje: hasta 1,17 millones;
   2. el lanzamiento de producto con la interfaz real: 1,5 millones el oficial de Anthropic, 365.000 el de un creador;
   3. el reel a cámara con gráficos por código: de 190.000 a 250.000 en TikTok;
   4. el tutorial sin cara hecho entero en código: 137.000;
   5. los datos que aterrizan, que aparecen dentro de los otros cuatro.
4. **Para MaKo, en orden:** el reel de Martín a cámara con gráficos, el tutorial con la app real, el lanzamiento de una
   función y los datos reales. Las recetas están al final.

## 1. Fuentes

Vistas y likes leídos el 17/11/2026 con yt-dlp.

### YouTube (los 9 se bajaron y se miraron)

| # | Título | Creador | Vistas | Fecha | Duración | Carpeta |
|---|---|---|---|---|---|---|
| Y1 | [Introducing Claude Dashboards and Claude Motion](https://www.youtube.com/watch?v=en0GuyhieQk) | Claude (oficial) | 1.501.626 | 08/10/2026 | 1:22 | `videos/en0GuyhieQk` |
| Y2 | [How to Make Viral Animated Shorts Using Claude (Full Workflow)](https://www.youtube.com/watch?v=OtbLL6OBNE4) | Mr omi | 1.173.676 | 01/11/2026 | 11:52 | `videos/OtbLL6OBNE4` |
| Y3 | [I Made VIRAL Animation Videos Using Claude Code (FREE Plugin)](https://www.youtube.com/watch?v=3tpaWHaiLQ8) | Grow With Kaz | 461.412 | 04/11/2026 | 10:01 | `videos/3tpaWHaiLQ8` |
| Y4 | [Claude Opus 5.5: How To Make Motion Graphics](https://www.youtube.com/watch?v=cDb-wPq0Iyk) | Rourke | 364.723 | 06/11/2026 | 17:58 | `videos/cDb-wPq0Iyk` |
| Y5 | [Claude MOTION is Unreal for Video. Master it in 12 minutes.](https://www.youtube.com/watch?v=Eg08Lr3zqdw) | Jay E, RoboNuggets | 261.497 | 16/10/2026 | 12:08 | `videos/Eg08Lr3zqdw` |
| Y6 | [How to Edit VIRAL Instagram Reels Using Opus 5.5!](https://www.youtube.com/watch?v=5UnK3c-nlIs) | Joseph, Video Editing | 187.406 | 11/10/2026 | 17:16 | `videos/5UnK3c-nlIs` |
| Y7 | [Cómo usar Claude para hacer Motion Graphics](https://www.youtube.com/watch?v=fiJXXJRLpkA) (en español) | Mauro Arredondo | 151.722 | 15/10/2026 | 13:45 | `videos/fiJXXJRLpkA` |
| Y8 | [How I Use Claude Code for Video Editing and Animation](https://www.youtube.com/watch?v=-x6ZjVTK8aI) | Tensaikun | 136.581 | 09/11/2026 | 10:17 | `videos/-x6ZjVTK8aI` (⚠️ la carpeta empieza con «-»: en la terminal, escribirla como `./-x6ZjVTK8aI`) |
| Y9 | [Your Videos Don't Have to Look Amateur Anymore (Claude + Remotion)](https://www.youtube.com/watch?v=i5bZ-Be9cAQ) | vidIQ | 83.003 | 06/07/2026 | 4:51 | `videos/i5bZ-Be9cAQ` |

### TikTok (los 4 primeros se bajaron y se miraron; del resto, sólo los números)

| Cuenta y link | Vistas | Likes | Comentarios | Duración | Fecha | Qué es |
|---|---|---|---|---|---|---|
| [@sebintel](https://www.tiktok.com/@sebintel/video/7624509507481242902) | 608.600 | 32.600 | 3.590 | 47 s | 03/04 | Promo de una herramienta en montaje rápido. Casi todo el video de fondo es IA, no código |
| [@taki.gpt](https://www.tiktok.com/@taki.gpt/video/7625035071883332880) | 597.900 | 23.900 | 1.610 | 73 s | 05/04 | A cámara y pantalla, «Comment "Claude"» |
| [@softgirlnocode](https://www.tiktok.com/@softgirlnocode/video/7642709908760153352) | 249.000 | 15.700 | 266 | 18 s | 22/05 | Un «POV» que muestra su video de YouTube con tarjetas blancas de HyperFrames |
| [@morfeoacademy](https://www.tiktok.com/@morfeoacademy/video/7693332207347289351) | 193.800 | 14.300 | 70 | 56 s | 05/10 | En español: pantalla partida, arriba los gráficos y abajo él a cámara. «Cada animación la hizo Claude» |
| [@gabrieladamuchi](https://www.tiktok.com/@gabrieladamuchi/video/7622318219663002900) | 241.000 | 18.200 | 115 | 57 s | 28/03 | Portugués, sobre la skill de Remotion |
| [@danyltn](https://www.tiktok.com/@danyltn/video/7628687650492386582) | 146.500 | 6.545 | 253 | 47 s | 14/04 | Francés: «comentá y te mando el comando» |
| [@le_raphine](https://www.tiktok.com/@le_raphine/video/7662419251566873888) | 78.600 | 3.913 | 38 | 28 s | 14/07 | Francés |
| [@monixette](https://www.tiktok.com/@monixette/video/7620667727610481928) | 68.500 | 4.487 | 153 | 288 s | 24/03 | Español: Remotion con Antigravity |
| [@luzzidigital](https://www.tiktok.com/@luzzidigital/video/7644299191434349844) | 56.200 | 2.916 | 35 | 19 s | 26/05 | Español: «comentá CLAUDE» |
| [@studywithricho](https://www.tiktok.com/@studywithricho/video/7644457638972935444) | 40.100 | 1.926 | 213 | 42 s | 27/05 | Indonesio |

### Instagram (de la investigación anterior; Instagram no da vistas sin sesión, sólo likes)

| Cuenta | Likes | Comentarios |
|---|---|---|
| Morrow | 82.648 | — |
| mrcreates | 35.630 | 26.205 |
| Adilet | 27.825 | 31.632 |
| sanji | 13.592 | 20.959 |

Cuando hay muchísimos más comentarios que likes, es el efecto del cierre «comentá PALABRA», no del video.

**Los creadores que más rinden en video corto:**
- **@sebintel y @taki.gpt:** noticia de herramienta con «comentá PALABRA», ~600.000 vistas, pero animan poco.
- **@softgirlnocode:** 249.000 vistas.
- **@morfeoacademy (Paul, «La Fábrica de Contenido»):** es el de mejor factura de toda la muestra y está en español
  rioplatense; es el modelo más directo para Martín.
- **Morrow:** de la investigación anterior.

## 2. Los formatos, por cuánto rinden

### F1. Corto animado sin cara, con personaje: hasta 1,17 millones (Y2, Y3)

- **Cómo se ve:**
  - **Y2:** personajes 2D en un mundo 3D, contornos de tinta y colores saturados.
  - **Y3:** finanzas o psicología sobre verde oscuro, con un personaje simple, cifras que suben y una curva que se
    dibuja.
  - Es el género de los canales sin cara: las referencias que nombran tienen 29 y 4,6 millones de vistas.
- **Cómo se hace:** three.js para el mundo y Remotion para armar el video, con voz de ElevenLabs y un guion de
  fórmula. Mr omi le hizo medir a Claude 20 cortos a 30 fps: 32.000 cuadros, una hoja de contacto cada 2 s y la cámara
  medida por correlación de fase.
- **Qué lo hace profesional (medido por Mr omi):**
  - **El guion:** ~4 palabras por segundo, sin aire muerto, y una paradoja en la primera frase.
  - **Los cortes:** 12 de los 20 tienen uno o ninguno.
  - **La cámara:** se mueve en el 65 % de los cuadros, acercándose despacio. Cada movimiento dura ~23 cuadros; el suyo
    duraba 3 y por eso se veía barato.
  - **El color:** nada de negro puro, sombras azules o violetas y luces cálidas.
  - **El foco:** el fondo desenfocado.
  - **La tinta:** contorno en 3 de cada 4 bordes.
  - **Los personajes:** 3,5 cabezas de alto.
- **Cuadros:**
  - `videos/OtbLL6OBNE4/hoja-general.jpg`
  - `videos/3tpaWHaiLQ8/hoja-resultado.jpg` (la cifra que sube de 25.477 a 75.150, la curva y «HOW MUCH MONEY?»
    tachado)
- **Para MaKo:** no, por ahora. No lleva a Martín, el 3D gasta mucho más y genera fallas: árboles que giran,
  personajes que atraviesan muebles.

### F2. Lanzamiento o anuncio de producto con la interfaz real y morphs: 1,5 millones el oficial, 365.000 Rourke (Y1, Y4, Y7)

- **Cómo se ve:**
  - **Y1, el oficial de Anthropic:** todo pasa DENTRO del producto: el reproductor, los comentarios, el cursor. Una
    ciudad isométrica en 3D con etiquetas, un título serif con la palabra clave en itálica y «seleccionada» en azul, y
    un rótulo en mono con el nombre de archivo.
  - **Y4:**
    - **El de Spotify:** el logo se vuelve círculo, el círculo un cuadrado, el cuadrado un reproductor; sigue una pared
      3D de playlists, el teléfono y el logo con su nombre.
    - **El de Candy Crush:** el tablero en 3D con el fondo desenfocado.
  - **Y7:** tarjetas de producto para un importador de DJI: eyebrow, título grande alineado a la izquierda, chip, «Qué
    te cambia» y el producto en un círculo.
- **Cómo se hace:**
  - **Rourke:** cuatro pasos. Los ingredientes reales (logo en alta, capturas), un storyboard numerado que se aprueba,
    Claude que lo construye y, al final, el sonido.
  - **Mauro:** un solo «súper prompt» con la web de la marca, Remotion y sus skills. Tardó 25 min y gastó el 21 % de la
    sesión de 5 h del plan de US$20.
- **Qué lo hace profesional:**
  - **Ritmo medido en la hoja:** el de Spotify tiene 9 momentos en 19 s, uno cada ~2,1 s; el de Mauro, ~2,5 s por
    producto.
  - **Transiciones:** cada plano se TRANSFORMA en el siguiente, nunca un fundido cruzado («se ve barato»). El oficial
    tiene **un solo corte duro en 82 s**: todo es cámara que viaja o zoom a través de un elemento.
  - **Encuadre:** la acción en el centro exacto; siempre algo en movimiento; poca profundidad de campo; una sola fuente
    de luz.
  - **Texto:** «sin rebote ni letras que aparecen: cada palabra sube a su lugar, una tras otra». En los valores que
    cambian, rodillo tipo tragamonedas con desenfoque (el nombre de la canción).
  - **Sonido:** un banco de efectos comprado (Ocular Sounds, ~£500) y el sonido al final, con la imagen cerrada.
- **Cuadros:**
  - `videos/cDb-wPq0Iyk/hoja-spotify-ad.jpg`
  - `videos/cDb-wPq0Iyk/cuadros/t134.2.jpg` (el rodillo del título)
  - `videos/cDb-wPq0Iyk/cuadros/t139.5.jpg` (la pared 3D desenfocada)
  - `videos/cDb-wPq0Iyk/hoja-ads-candy-genhq.jpg`
  - `videos/en0GuyhieQk/hoja-1.jpg` y `videos/en0GuyhieQk/hoja-2.jpg`
  - `videos/en0GuyhieQk/cuadros/t011.jpg` y `videos/en0GuyhieQk/cuadros/t052.jpg`
  - `videos/fiJXXJRLpkA/hoja-resultado.jpg`

### F3. Reel a cámara con gráficos por código: de 190.000 a 250.000 en TikTok, y el tutorial de YouTube 187.000 (Y6, @morfeoacademy, @softgirlnocode)

- **Cómo se ve:**
  - **Joseph (Y6):**
    - el creador sobre un fondo azul graduado;
    - subtítulos palabra por palabra, en blanco y sans, con UNA palabra en serif itálica azul del doble de tamaño;
    - widgets en la mitad de abajo (1-2-3 en círculos, un deslizador «Beginner → Professional» con cursor);
    - pantallas partidas y completas sobre papel blanco cuadriculado, con un objeto 3D (un ojo, el ícono de una app);
    - un marco azul fino.
  - **Morfeo:**
    - pantalla partida: arriba el gráfico sobre blanco o crema y abajo él;
    - golpes de color naranja a pantalla completa («4 PASOS», «EDITADO.»);
    - píldoras de paso («1 Elegí Opus 5.5 en Claude Code ↑»), código que se tipea, la paleta y las fuentes mostradas;
    - una línea de tiempo sobre la música.
- **Cómo se hace:**
  - **Joseph:**
    1. Una guía visual con tres partes: subtítulos, animaciones y animaciones en pantalla, más 100 piezas de
       inspiración. Después, otra guía de sonido. Las dos se convierten en skills.
    2. Claude corta los silencios y las tomas malas con 20 ms de margen: de 76 s quedaron 50.
    3. Una página de planificación donde cada línea del guion recibe uno de **cuatro tipos de escena**: subtítulos,
       subtítulos con un widget, pantalla partida o pantalla completa.
    4. Remotion anima y Claude pone 106 efectos de sonido.
    - **Tiempos:** 110 minutos, de los cuales 20 fueron de trabajo humano; menos del 10 % de la cuota semanal de Max.
  - **Morfeo:** Opus 5.5, HyperFrames y un `MOTION.md` de marca (colores, tipografías y timing sacados de la web), con
    una regla en `CLAUDE.md` para que siempre lo lea y los cortes sobre los golpes de la música (128 BPM).
- **Qué lo hace profesional:**
  - **Ritmo:** en morfeo, un momento nuevo cada ~2,3 s (24 cuadros de la hoja, todos distintos). En Joseph, 12
    animaciones en 50 s, una cada ~4 s, con subtítulos que cambian en cada palabra.
  - **La regla de los tres objetos:** uno principal al centro, dos de apoyo en los bordes y elementos de profundidad
    alrededor.
  - **Con un widget encima:** el fondo se oscurece y se desenfoca.
  - **Sus tres reglas:** todo 25 % más chico de lo que uno haría; pocos efectos; colores apagados, que se ven de alta
    gama (nada de negro, blanco o rojo puros).
  - **Tipografía de morfeo:** Anton (condensada) en mayúsculas para los títulos y los subtítulos con contorno negro,
    Geist para el cuerpo, Geist Mono para el código, y curvas cúbicas.
  - **Paleta de morfeo:** #EC4E0C de acento, #151513 tinta, #F3E8D6 crema y #FFFFFF.
- **Cuadros:**
  - `videos/5UnK3c-nlIs/cuadros/reel-tira.jpg` (los 4 tipos de escena)
  - `videos/5UnK3c-nlIs/hoja-reel-final.jpg`
  - `videos/tt-morfeoacademy-7693332207347289351/cuadros/tira.jpg`
  - `videos/tt-morfeoacademy-7693332207347289351/hoja.jpg`
  - `videos/tt-softgirlnocode-7642709908760153352/hoja.jpg`

### F4. Tutorial sin cara hecho entero en código: 137.000 (Y8; también la forma de Y3 y de los recuadros de Y5)

- **Cómo se ve:**
  - **Y8:**
    - el fondo alterna tres superficies: negro (#111), papel claro y una tarjeta de capítulo de color pleno (lima);
    - frases cinéticas palabra por palabra («Start with the **words**, not the visuals.»), con el resaltador de color
      detrás de las palabras clave;
    - una línea de pasos Setup → Script → Voice → Style → Fix → Render → Upload, que aparece en los cambios de capítulo;
    - maquetas de la interfaz de Claude con cursor, una pantalla partida «Two options» y diagramas de cámara.
  - **Y5:** la cara en un recuadro de esquinas redondeadas, a la derecha, y un diagrama que se arma a la izquierda
    (Brief → Plan → Video ✓).
- **Cómo se hace:**
  - Una skill describe el estilo en números: cámara alta a ¾, lente de 24°, tomas quietas que se acercan.
  - Whisper para los tiempos de cada palabra.
  - Una vista previa en vivo para revisar: anota y corrige sin renderizar. Renderizar 13 min le lleva 45.
  - **Cada nota que se repite se vuelve una regla de la skill:** 152 notas en la primera revisión y 10 rondas de reglas.
- **Qué lo hace profesional:**
  - Algo nuevo cada ~1,8 s (contado en `hoja-0-40s.jpg`: 22 composiciones en 40 s).
  - Un solo acento.
  - La palabra clave del color del acento o tachada («Claude ~~can't~~ do better»).
  - Las letras de los títulos de capítulo entran con desenfoque.
  - Los efectos de sonido que hace Claude en código «suenan todos igual y demasiado fuerte»: conviene traer los propios.
- **Cuadros:**
  - `videos/-x6ZjVTK8aI/cuadros/tira.jpg`
  - `videos/-x6ZjVTK8aI/hoja-0-40s.jpg`
  - `videos/-x6ZjVTK8aI/hoja-1m40-2m20.jpg`
  - `videos/Eg08Lr3zqdw/cuadros/t136.jpg` (la cara en el recuadro con el diagrama)

### F5. Datos que aterrizan: dentro de F1, F2 y F4 (Y3, Y9, Y1)

- **Cómo se ve:**
  - una cifra grande que sube y cambia de color al pasar un umbral;
  - una curva que se dibuja con un punto brillante en la punta;
  - una población de puntos («437.850+ respuestas»);
  - el mito tachado con una X roja;
  - en vidIQ: un contador de estadísticas sobre un video de juegos y una tarjeta de receta sobre un video de cocina.
- **Qué lo hace profesional:**
  - la cifra sube en 1,2 a 1,6 s y queda quieta, cayendo sobre un golpe;
  - el número héroe ocupa ~30 % del alto;
  - las barras crecen en 20 cuadros, frenando al final;
  - una sola anotación que dice por qué importa;
  - las etiquetas de los ejes de 28 px o más (a 1080).
  - Fuentes de estas reglas: HyperFrames y awesomeclaude.
- **Cuadros:**
  - `videos/3tpaWHaiLQ8/hoja-resultado.jpg`
  - `videos/i5bZ-Be9cAQ/hoja-ejemplos.jpg`

### F6. Estilos «de medio» (risografía, collage, pizarrón, isométrico, mapa)

- **Dónde:** es la vitrina de Claude Motion en Y5 (`videos/Eg08Lr3zqdw/hoja-general.jpg`) y las 99 de lemo-opuscar.
- **Rinden:** como demostración.
- **Para MaKo:** como mucho, el fondo de un tipo de escena.
- **El dato que más sirve de Y5:** el panel «Tweaks» de Claude Motion (`videos/Eg08Lr3zqdw/cuadros/t280.jpg`). Por
  escena muestra el nombre, la duración en segundos, la velocidad (0,5×, 1× o 2×) y «Words on screen», y se puede
  comentar sobre un elemento para que Claude cambie SÓLO ese. Es la interfaz que el Video Editor de MaKo puede copiar
  para la arquitectura «plantilla + datos».

## 3. Qué separa lo profesional de lo «hecho con IA»: los números

Los toman de piezas profesionales medidas cuadro por cuadro:
- **motionmaxxing:** 53 momentos y 4.288 movimientos.
- **HyperFrames:** sus películas oficiales.
- **video-shotcraft:** los casos de retrabajo.
- **Los creadores de arriba.**

| Tema | La regla, con su número | Fuente |
|---|---|---|
| Duración de un movimiento | Mediana de 10 cuadros (0,33 s a 30 fps): entradas de 11-12 cuadros, opacidad de 6, desenfoque de 7-8. Uno rápido, 0,3-0,6 s, con desenfoque de movimiento de 6-12 px en texto y 15-20 px a pantalla completa | motionmaxxing, HyperFrames |
| Curvas | Aterrizar frenando (`expo.out` o `power4.out`), cámara en las dos puntas (`power2.inOut`), salir acelerando (`power3.in`). El mismo `power2.out` en todo «se ve generado». Rebote en menos del 9 % de los movimientos; resortes de 0,7 a 0,85 de amortiguación para que se vea premium | motionmaxxing, HyperFrames |
| Cómo entra algo | Moviéndose, no con un fundido: 3.392 entradas por transformación contra 584 de opacidad. **Nada crece desde cero:** llega achicándose desde más grande (un logo, desde ~3,5×) o desde el borde | motionmaxxing |
| Salidas y superposición | La salida dura un 40-50 % menos que la entrada. Lo siguiente empieza cuando lo anterior va por el 30-50 %. Escalonado: letras a 1 cuadro, palabras a 60-120 ms, ítems a 40-80 ms | HyperFrames |
| Títulos | Cuando el título aterriza, queda QUIETO. Variar la entrada en cada escena: palabra por palabra con `blur(6px)` a 0 en 0,13 s y 0,067 s entre palabras; de gris a tinta; la línea entera desenfocada; o el rodillo de tragamonedas | HyperFrames |
| Lectura | Mantener 0,5 s más 0,3 s por palabra; la última línea, 2 s o más; la marca, 1 s o más. Texto de 28 px o más a 1080 (2,6 % del lado corto). Subtítulos narrativos de ≥56 px en un cuadro de 1080 de alto (5,2 %); el texto de apoyo, de ≥32 px. En vertical, los títulos ×1,35. Si no entra, se cortan palabras, nunca se achica | HyperFrames, video-shotcraft |
| Ritmo | En horizontal, algo nuevo cada 2-4 s. En vertical, planos de 1-2 s y un momento nuevo cada 2-4 s. Lo medido: Spotify 2,1 s; morfeo 2,3 s; Tensaikun 1,8 s; Mauro 2,5 s. **En los momentos profesionales de 3 a 7 s, algo se mueve en el ~99 % de los cuadros** (una pieza entera respira más), pero nunca con «respiración» o flotación en bucle | HyperFrames, motionmaxxing, hojas propias |
| Transiciones | De 3 a 5 tipos por pieza, cada una CAUSADA por algo en pantalla: zoom a través de un botón, el objeto que se vuelve el mundo, morph, golpe de color de 0,4 s, látigo de 0,13-0,3 s, iris desde el clic. Como mucho, 1 de cada 3 cortes es duro. Cortar en el cuadro más rápido del movimiento. Nunca fundido cruzado | HyperFrames, Rourke |
| Encuadre | El protagonista ocupa el 40 % del cuadro o más. Un movimiento héroe por plano; los secundarios recorren 50-70 % de esa distancia y arrancan 100-200 ms después. La acción al centro (Rourke). Tres objetos: principal, de apoyo y de profundidad (Joseph) | HyperFrames, Rourke, Joseph |
| Profundidad | Fondo desenfocado o poca profundidad de campo; sombra de contacto; una sola luz. Detrás de un widget, el fondo se oscurece y se desenfoca. Sin temblor de cámara en piezas de interfaz | Rourke, Mr omi, Joseph, video-shotcraft Q3 |
| Color | UN acento, que significa algo, en una palabra por cuadro. Colores apagados; nada de negro puro; sombras frías y luces cálidas | Joseph, Mr omi, HyperFrames |
| Sonido | Música de fondo, y efectos SÓLO en acciones visibles: whoosh en cortes y movimientos, clic en clics reales, pop en lo que aterriza, un riser con impacto una sola vez. Kit mínimo: 5 whooshes, 2-3 clics mecánicos, 2-3 sci-fi, 2-3 de interfaz (clic, éxito, error), 2 risers y 2 hits. Alternar 2-3 tomas de un mismo sonido. El pico del sonido, 1 cuadro DESPUÉS de la imagen. Música a −20 dB bajo la voz; la mezcla entre −16 y −14 LUFS y picos de −1 dBTP o menos. El sonido va AL FINAL, con la imagen cerrada | Joseph, HyperFrames, video-shotcraft S3 |
| Proceso | Medir la referencia, no opinar sobre ella. El estilo, en números dentro de una skill. Un storyboard numerado, aprobado antes de animar. Revisar en vista previa y renderizar una sola vez. Cada nota que se repite se vuelve regla | Mr omi, Tensaikun, Rourke, HyperFrames |

**Lo que delata un video generado** (prohibido por defecto en HyperFrames y en motionmaxxing; usarlo sólo si es material
real de la marca):
- un fondo negro o azul marino vacío con cosas chicas flotando;
- brillo, bloom, neón, destellos o partículas decorativas;
- degradés violetas o azules, y tarjetas de vidrio;
- papel crema con serif, palabras en itálica, etiquetas «01 / 02» y mayúsculas chicas en mono;
- todo centrado, o todo entrando a la vez con un fundido que sube;
- texto que se mueve mientras se lee;
- **el «chrome» de página: la marca en una esquina, el contador «02 / 07», el timecode, corchetes en las esquinas, una
  barra de progreso pegada.** Es la señal número 1 en la autopsia de motionmaxxing;
- tres tarjetas en fila, o un título sobre una captura oscurecida;
- tipear el titular letra por letra con un cursor.

⚠️ **Choca con lo decidido antes:** «PASO N DE M siempre a la vista». La salida es mostrarlo como un momento propio, a
pantalla completa o como la línea de pasos al cambiar de capítulo, como Tensaikun y morfeo. No pegado en una esquina
todo el video.

## 4. Las skills públicas (leídas, no instaladas)

| Skill | Licencia | Qué hace | ¿Sirve para MaKo? |
|---|---|---|---|
| [remotion-dev/skills](https://github.com/remotion-dev/skills) (oficial, 7,4k ⭐) | No hay archivo de licencia en ese repositorio. Vive en el monorepo de Remotion (`packages/skills`), bajo la **Remotion License** | 13 skills: `/remotion-best-practices`, `-markup`, `-create`, `-render`, `-studio`, `-captions`, `-maps`, `-saas`, `-interactivity`, `-docs`, `-license`, `-upgrade` y `-multimedia`. Reglas: animar SÓLO con `useCurrentFrame()` e `interpolate()` (las transiciones de CSS no se renderizan), `Easing.spring`, la escala en «perceptual-scale» y más de 60 efectos en `@remotion/effects` (blur, lightLeak, glow, motion blur…). Se instala con `npx remotion skills add` o `npx skills add remotion-dev/skills` | **Sí: es la base de la decisión del 11/11.** `remotion-saas` es la guía para integrarlo en un producto |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) (85,9k ⭐) | Apache-2.0. `/reverse-any-video` y `/style-sampling` son Pro (pagas) | 9 skills: `/hyperframes`, `-cli`, `-registry` (~450 bloques), `/media-use`, `/figma`, `/slideshow`, `/remotion-to-hyperframes` y las dos Pro. Se instala con `claude plugin marketplace add heygen-com/hyperframes`. ⚠️ Al arrancar, la skill manda un «usage beacon» de telemetría | **Como texto, es lo mejor que hay:** `skills-leidas/hyperframes/` (motion, spec, review, sound, vertical, launch, explainer). Como motor ya está evaluado en el documento anterior: GSAP y la captura en Windows |
| [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) (~21k ⭐) | Apache-2.0. El audio de Freesound tiene licencia por archivo | Promos de producto en Remotion: 124 recetas de plano en 10 categorías, una galería de 150 planos y reglas estéticas basadas en casos (R ritmo, Q calidad, S sonido, C texto, P proceso), en chino | **Sí, como reglas y recetas:** es el mismo stack, Remotion. Copia en `skills-leidas/video-shotcraft/` |
| [Tejashmakwana/motionmaxxing](https://github.com/Tejashmakwana/motionmaxxing) (1,6k ⭐) | Apache-2.0 | HTML, Chrome y ffmpeg. 53 momentos profesionales medidos, 12 curvas y una revisión automática del chrome de página con puertas G0-G5 (G2 falla con más de 3 cuadros quietos seguidos) | **Sí, como lista de control:** sus reglas y su revisión automática se pueden pasar a la revisión de MaKo |
| [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) (17,7k ⭐) | Código MIT; **los textos y las guías de estilo, CC BY-NC 4.0 (no comercial)**; las demos, CC BY 4.0; Clawd es de Anthropic | 99 estilos de película hechos por código | Sólo para mirar: sus `STYLE.md` no se pueden usar con fines comerciales |
| [mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) | MIT | Personajes 2D en un mundo 3D (three.js y Remotion) y 5.000 imágenes de referencia: la skill de Y2 | No, por ahora: es el formato F1 |
| [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) (3,1k ⭐) | MIT | Dibujos animados pintados con p5.js y p5.brush, con el personaje Clawd | No |
| [Hainrixz/motion-architect](https://github.com/Hainrixz/motion-architect) (Enrique Rocha, tododeia, en español) | MIT | Remotion con componentes (KineticTitle, LogoReveal, Counter, CardStack, Caption, ImagePan), un `brand.json`, un subagente que analiza la referencia, 4 formatos con zonas seguras. Sólo macOS y Linux | **Como modelo de arquitectura**, que es la misma de MaKo: componentes y datos de marca |
| [SamanwayBaranwal/reelsmith](https://github.com/SamanwayBaranwal/reelsmith) | MIT | Con el link de un reel mide los cortes, las palabras, los colores y las posiciones; lo rehace en canvas y lo compara lado a lado | **El método sí**, que es medir la referencia. Copiar reels ajenos tiene riesgo de derechos |
| [charlie947/motion-graphics-skills](https://github.com/charlie947/motion-graphics-skills) (708 ⭐) | MIT | 13 skills de lanzamientos | No se leyó por dentro |
| [nexu-io/openmotion](https://github.com/nexu-io/openmotion) (10,7k ⭐) | Apache-2.0 | Un video de referencia convertido en motion graphics editables | No se leyó por dentro |
| [iart-ai/motion-skills](https://github.com/iart-ai/motion-skills) (1,8k ⭐) y [echris6/motion-video-kit](https://github.com/echris6/motion-video-kit) (1,4k ⭐) | MIT | 56 skills, y videos de negocio con un crítico y diseño de sonido | No se leyeron por dentro |
| OpenMontage (81k ⭐), guizang-product-video-skill y onetake | **AGPL-3.0, AGPL-3.0 y PolyForm No Comercial** | Producción de video con agentes | **No: sus licencias no sirven para un producto pago** |
| [yihui-dev/awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos) | MIT (la lista) | 703 prompts de videos virales hechos con Opus 5.5, **todos publicados en X**: 369 de motion, 117 de 3D, 116 explicativos y 101 interactivos. Técnicas: canvas en 267, svg en 183, three.js en 131, shader en 92 y gsap en 86 | Para inspiración |
| [zhuyansen/awesome-claude-video-skills](https://github.com/zhuyansen/awesome-claude-video-skills) | — | Índice de ~400 repositorios de video con Claude | El índice para seguir buscando |
| Claude Motion (Anthropic) | Producto, no skill | Animación por código con el panel Tweaks; exporta MP4. Beta sólo en Team y Enterprise | El panel Tweaks es el modelo de la interfaz del Video Editor |

## 5. Recomendación: qué construir para MaKo, en orden

Las cuatro recetas comparten tres reglas:
- se trabaja en el motor propio o en Remotion, como dice el documento anterior;
- los datos y las pantallas son REALES (de MaKo, con datos ficticios donde haga falta);
- antes de entregar se pasa la lista de lo que delata un video generado (sección 3), sobre la hoja de contacto.

### 1.º El reel de Martín a cámara con gráficos por código (marca personal) — modelo: morfeo y Joseph

- **Formato:** 1080×1920, 30 fps, de 30 a 60 s. La toma REAL de Martín, sin clon, porque dijo «No es mi voz». Se
  cortan silencios y tomas malas con 20 ms de margen.
- **Los cuatro tipos de escena**, uno por línea del guion, elegidos en una página de planificación:
  1. **Subtítulos:** Martín a cámara.
  2. **Subtítulos con un widget en la mitad de abajo**, sobre el fondo oscurecido ~40 % y desenfocado ~8 px.
  3. **Pantalla partida:** el gráfico de 0 a 960 px, sobre papel claro, y Martín de 960 a 1920 px.
  4. **Pantalla completa.**
  - Una animación cada ~4 s; el gancho siempre lleva la cara.
- **Ritmo:**
  - un momento visual nuevo cada 2-2,5 s;
  - los subtítulos, palabra por palabra, con 1 a 3 palabras en pantalla;
  - las palabras entran con desenfoque, 6 px a 0 en 0,13 s y 0,067 s entre una y otra;
  - nada flota ni late cuando ya aterrizó.
- **Tipografía:**
  - subtítulos en sans de peso medio (Inter o Geist 500-600), blancos, de 56 a 64 px;
  - la palabra clave en una segunda familia, una serif itálica o una condensada en mayúsculas tipo Anton, al **doble de
    tamaño** y con el acento;
  - los golpes de capítulo, en la condensada en mayúsculas a 180-240 px;
  - todo el texto entre los 168 y los 1330 px de alto, que es la franja segura de Reels y TikTok.
- **Paleta:** la de la marca MaKo con UN acento, más una tinta casi negra (#151513 o similar), papel crema y blanco.
  Colores apagados. El acento, en una palabra o un objeto por cuadro.
- **Transiciones (3 a 5 tipos):**
  - golpe de color a pantalla completa para «PASO 1», 0,4 s con `power2.inOut`;
  - el gráfico que empuja la cara hacia abajo cuando entra la pantalla partida;
  - una píldora o tarjeta que se transforma en la siguiente;
  - un látigo con desenfoque de 0,13-0,3 s;
  - el iris que se abre desde el clic.
- **Widgets:** con la interfaz REAL de MaKo (capturas o componentes con datos ficticios). Por ejemplo, el lead que
  cambia de etapa, la notificación «agendó» o la cuota de tokens que se llena. Regla de los tres objetos, y todo 25 %
  más chico de lo que pide la mano.
- **Sonido:**
  - la voz de Martín y la música a −20 dB;
  - el kit mínimo de la sección 3, colocado sólo sobre acciones visibles y con el pico 1 cuadro después;
  - se hace al final.
- **Cierre:** «comentá PALABRA». MaKo ya responde comentarios de Instagram; falta probarlo en producción.

### 2.º El tutorial del reto de 7 días con la app real (la pantalla viva) — modelo: Tensaikun, el Y1 de Anthropic y la regla de la pantalla viva

- **Formato:** 1920×1080 (y una versión vertical RECOMPUESTA, no aplastada). La voz es el reloj: cada elemento aparece
  cuando la voz lo nombra, en la segunda mitad de la escena. Unas 19 palabras por escena.
- **La pantalla viva:**
  - la app real de MaKo; la cámara pasa de la ventana entera a un panel y del panel a un control, siempre a 1,6-2× de su
    tamaño;
  - movimientos de cámara de 0,4-0,6 s con desenfoque, que llegan al control y quedan quietos mientras la interfaz
    actúa (de 7 a 10 s como máximo);
  - un cursor grande, del 4 al 7 % del cuadro: cada movimiento dura 20-30 cuadros, hay una pausa de 8 cuadros antes de
    cada clic y el clic CAUSA lo siguiente en el mismo cuadro;
  - una acción cada 3-4 s.
- **Ideas clave:** frases cinéticas de 3 a 7 palabras, palabra por palabra, con el resaltador del acento detrás de las
  palabras clave, sobre papel claro o sobre tinta. Se mantienen 0,5 s más 0,3 s por palabra.
- **Capítulos:**
  - una tarjeta de color pleno «PASO 02 / 07» con el título entrando desenfocado;
  - o la línea de pasos de los 7 días durante 1-2 s, al cambiar de capítulo;
  - nunca un contador pegado en una esquina.
- **Opcional:** Martín en un recuadro de esquinas redondeadas al costado y un diagrama que se arma del otro lado, como
  Y5. Sirve para V3 y V4, que ya se habían pensado con `side`.
- **Tipografía:** una grotesca en negrita (Inter o Geist 700, con tracking de −2 %) para los títulos, al 6-9 % del alto
  (65-97 px a 1080); los rótulos, de 28 px o más; la mono, SÓLO para comandos.
- **Sonido:** la música de fondo a −20 dB. Clics sólo en clics reales, el tic de tecla en el texto que se tipea y un
  whoosh por cambio de capítulo.

### 3.º El lanzamiento de una función de MaKo, de 15 a 30 s (venta de MaKo y, más adelante, plantilla para los productos de los clientes) — modelo: Rourke (Spotify) y el Y1 de Anthropic

- **Estructura:** gancho, tensión, revelación, prueba, beneficio, frase y cierre. De 9 a 12 momentos de ~2 s; el de
  Spotify tiene 9 en 19 s.
- **Cada plano se transforma en el siguiente:**
  - un morph de 18-30 cuadros: el logo se vuelve círculo, después tarjeta, después la pantalla real y después el
    teléfono;
  - el zoom a través de un botón: la cámara viaja 0,6 s y el botón pasa de ~8 % a ~250 % en 0,35 s;
  - el objeto que se vuelve el mundo;
  - sin fundidos cruzados, y como mucho 1 corte duro de cada 3.
- **Encuadre y profundidad:**
  - la acción al centro;
  - el héroe ocupa el 40 % del cuadro o más;
  - una pared de tarjetas en 3D inclinada ~20-30°, con el fondo desenfocado 8-15 px;
  - una sola luz;
  - fondo con el color de la marca en radial, nunca un vacío negro con brillo.
- **Texto:** cada palabra sube a su lugar, sin rebote. Los valores que cambian giran como tragamonedas, ~0,1 s por
  vuelta.
- **Cierre:** la marca aterriza en el último 5-10 % del video, ocupando el 15-30 % del ancho, «actuada» (el cursor la
  clickea y la llena) y no con un fundido. Después, el llamado a la acción durante 1,5-3 s.
- **Sonido:** los cortes caen en los golpes de la música; whoosh en los morphs, pop en los chips y un solo riser con
  impacto en el remate.

### 4.º Datos que aterrizan: casos y números de MaKo, SÓLO con datos reales (la memoria «animaciones con datos reales»)

- **La cifra:** sube en 1,2-1,6 s y queda quieta sobre un golpe; el número héroe, a ~30 % del alto.
- **El cambio de color:** sólo si cruza un umbral con significado (en Kaz, de amarillo a rojo).
- **La curva:** se dibuja marca por marca con un punto en la punta; las barras crecen en 20 cuadros.
- **La anotación:** UNA, que dice por qué importa.
- **El mito:** tachado con rojo y lo correcto impreso encima.
- **Los ejes:** etiquetas de 28 px o más.
- **Los números:** todos salen de UN solo módulo de datos, para que coincidan entre sí.
- **Uso:** va dentro de los formatos 1 a 3, no como un video aparte.

### Para el Video Editor de MaKo (no es un formato, es la interfaz)

Copiar el panel Tweaks de Claude Motion: escenas con su nombre, la duración, la velocidad (0,5×, 1× o 2×) y las «palabras
en pantalla» editables, más un comentario sobre un elemento que cambia SÓLO ese elemento. Los cuatro tipos de escena de
Joseph son el menú natural de un editor de reels: subtítulos, subtítulos con un widget, pantalla partida y pantalla
completa.

### Lo que NO conviene

- **El corto animado sin cara (F1):** tiene muchas vistas, pero no lleva a Martín, es caro en tokens y genera fallas
  en 3D.
- **La promo con video de IA (@sebintel):** no es código.
- **Calcar la superficie de las referencias:** vidrio, neón, papel crema con serif.

## 6. Lo que NO se pudo ver, y por qué

- **Instagram:** yt-dlp no lista perfiles sin sesión («Unable to extract data») y no hubo forma de encontrar reels
  nuevos por URL. Los números de Instagram son de la investigación anterior, y Instagram no da vistas sin sesión.
- **TikTok:**
  - **Lo roto:** yt-dlp no lista perfiles («Unable to extract secondary user ID») ni hashtags («No working app info»).
    Las páginas de descubrimiento se arman en el navegador y llegan vacías.
  - **Cómo se armó la muestra:** las 11 se encontraron por búsqueda web; sesgo: lo que el buscador indexó.
  - **Lo que sí anda:** el video suelto, por su URL, se baja bien.
- **X:** los 703 videos de la lista awesome están en X y no se bajaron.
- **Los subtítulos de YouTube:**
  - **El error:** las pistas `es` y `en` traducidas dieron error 429.
  - **Lo que sí se bajó:** `en-orig` de todos, y español sólo de Mauro.
  - **Dónde quedaron:** las transcripciones están en `videos/<id>/transcripcion.txt`.
- **Material cerrado o pago, sin leer:**
  - la skill de Rourke (pide un formulario);
  - la guía visual y el kit de sonido de Joseph (pagos);
  - el plugin de Kaz (link acortado);
  - el PDF de RoboNuggets (Skool);
  - el «Video Hub» de Tensaikun (no es público);
  - el «Motion Director» de Sharbel.
- **Repositorios listados pero sin leer por dentro:** charlie947, openmotion, iart-ai, echris6.
- **El sonido:** no se escuchó ni se midió. Los números de sonido son de los creadores y de las skills.
- **Los cortes automáticos:** la detección de escenas de ffmpeg no sirvió (ver «Trampas»). El ritmo se contó a mano
  en las hojas de contacto.
- **La galería de 8 reels:** no se renderizó acá. Lo de que «se apoya en lo que delata un video generado» sale de las
  descripciones del LEEME y hay que verificarlo sobre sus cuadros.
- **La API de GitHub:** dio límite de pedidos (otros chats la estaban usando). Se leyó por raw.githubusercontent y por
  las páginas.

## 7. Trampas del entorno (para cosechar en `docs/hallazgos-video-pipeline.md`)

- **La detección de escenas de ffmpeg (`select='gt(scene,0.3)'`) no ve casi nada en estos videos:** en el oficial de
  Anthropic, 1 cambio en 82 s; en Tensaikun, 3 en 10 min. Las transiciones son morphs y zooms, y la diferencia entre
  dos cuadros seguidos queda por debajo de 0,1. Bajar el umbral tampoco calibra. **El ritmo se cuenta en una hoja de
  contacto con marca de tiempo.**
- **Hacer la hoja con `fps=1/N` decodifica todo el video:** 3 min para 12 min de video. Saltar con `-ss` a cada cuadro
  y después unir en grilla tarda ~40 s. Lo hace el script `scripts/hoja2.py`. También quedaron `bajar.sh` (video y subtítulos), `vtt2txt.py` e `info.py`.
- **Python con `-I` ignora `PYTHONIOENCODING`:** en Windows, imprimir emojis de las descripciones rompe con cp1252. Va
  `sys.stdout.reconfigure(encoding='utf-8')` dentro del script.
- **Una carpeta que empieza con «-»** (IDs de YouTube como `-x6ZjVTK8aI`) rompe ffmpeg y ls: se toma como opción. Se
  pasa como `./-x6ZjVTK8aI`.
- **Pedir subtítulos `es.*,en.*` pide también las traducciones automáticas**, y YouTube corta con 429 en la segunda o
  la tercera. `--sub-langs en-orig` con `--sleep-subtitles 8` anduvo en todos.

## Archivos

- **`videos/<id>/`:** `video.mp4` (720p), `video.info.json`, los subtítulos, `transcripcion.txt`, las hojas `hoja-*.jpg`
  y `cuadros/`. Ocupan 579 MB.
  - ⚠️ **El disco C: tiene 12 GB libres (98 % usado).** Los MP4 se pueden borrar; las hojas y los cuadros guardan la
    evidencia.
- **`skills-leidas/`:** el texto de las skills leídas, con su LICENSE.
  - **Reglas de motion y sonido:** HyperFrames, video-shotcraft y motionmaxxing, las tres Apache-2.0.
  - **Remotion:** sus skills NO tienen un archivo de licencia propio y caen bajo la Remotion License, así que no hay que
    subirlas a un repositorio público.
