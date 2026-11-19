# Serie 2 — Educación: tutoriales con la voz de Martín

Contenido para las redes de Martín con su personaje en cubos y su voz clonada, hecho con el método de los videos por código
(HTML + GSAP/Three.js, `C:/dev/artefactos-animaciones`). Arrancó el 19/11/2026 (cuenta claude5, chat `serie-educacion`).
El ranking de temas, con cómo lo explica cada mentor, está en [serie-2-temas.md](serie-2-temas.md).

## Qué pidió Martín (textual, 19/11)

> «contenido de educación de todo tipo… que te enfoques muchísimo en la transcripción de todos los cursos que tenemos, que
> hagas un relevo por ahí y que detectes los top topics y temas que más se repiten, o los que incluso tú consideres a ojo…
> vas a ver cómo lo explican esos mentores, esos gurús. Y como tercer paso también vas a salir afuera a investigar… para ver
> cómo también lo plantearon y descargar el copy y la transcripción de esos otros videos. Y hacemos tutoriales con nuestro
> formato y dándoles nuestra voz… videos de oferta, de vender high ticket, las comparativas, los miedos, videos de anuncios,
> contenido viral versus contenido de nicho, carruseles, creación de contenido, trial reels, historias… es súper importante
> que vayas y hagas una búsqueda de esos temas… para ver si los otros referentes ya lo explican de una manera viral, el hook
> sobre todo».

## Las reglas de la serie

- **Objetivo: SEGUIDORES.** No se vende nada: ni MaKo, ni un curso, ni «comenta y te paso». El cierre invita a seguir la
  cuenta (y, si el tema da para dos partes, «la parte 2 sale mañana»). La chispa dorada de MaKo va chica, como firma.
- **Se toma la idea, nunca se calca.** De los cursos y de los videos de afuera sale QUÉ se enseña y qué gancho funcionó;
  el guion, el ejemplo y las palabras son nuestros. El ejemplo, siempre con un negocio high ticket (coach, mentoría,
  agencia, consultoría, inmobiliaria).
- **Números reales.** O son cuentas que se ven (4 × US$2.500 = US$10.000) o tienen su fuente (Hormozi, con su libro o su
  video). Nada de estadísticas inventadas.
- **Personaje:** Martín en cubos (`reels/kit/toma.js`, `KIT.martin`). Nunca el ilustrado redondo ni el plano de rulos.
- **Voz:** `bash tools/voz_formato.sh <id>` (eleven_v4, voz `I2d6BR9P2dAopVw1khNv`, `_para_texto_sin_video` de
  `C:/dev/reel-mentores/voz/LA-CONFIG.json`). Se escribe como suena: «Máko», «Ei-Ai». El chequeo del guion corre solo al
  final del script: una palabra de más o cambiada pide otra toma.
- **Edición:** la duración la dan las palabras (≈ 3,2 por segundo); sin silencios muertos (el script los recorta a 0,3 s);
  un efecto por momento; subtítulos bajo el mentón; cámara cerca de lo que pasa; nada que suene fuera del guion.
- **Idioma:** español neutro con «tú», neutro en género, frases cortas que se lean en el teléfono.
- **Nada de relleno en pantalla (Cerebro, 19/11, al ver el video 1):** las rayitas grises «de texto» y los recuadros
  vacíos se leen como un boceto sin terminar. Cada tarjeta muestra desde que aparece lo que la hace distinta (su frase,
  su número); para marcar el momento en que la voz lo dice, un golpe de escala o de color, no aparecer de la nada. Y un
  título que no alcanza a leerse entero (menos de 1 s, o cortado) se saca.
- **Nada de letra chica (Martín, 19/11, por la galería):** todo texto se lee en el teléfono sin acercarse. Piso: 44 px
  en el cuadro de 1080 (≈ 16 pt en un celular) para lo secundario (fuente, «vistas», etiquetas) y 48+ para lo que se lee.
  Ojo con lo que vive dentro de algo escalado: una frase de 58 px en una tarjeta que la cámara aleja a ×0,46 queda en
  27 px. Si hay que mostrar varias cosas juntas, se arma una tabla sin escalar (video 1) o filas a ancho completo (las
  cinco versiones), no tarjetitas.
- **En pantalla, la misma palabra que la voz, y nada cortado (Cerebro, 19/11, video 2):** la plantilla decía «Dame un
  tiempo…» y la voz «dame un minuto»; la lista decía «Una pregunta con dos» para que entrara en un renglón. Si la voz
  dice «minuto», la pantalla dice «minuto». Una etiqueta que no entra se parte en dos renglones, no se recorta.
- **Voseo que el chequeo no ve:** con el clon rioplatense, los verbos de «tú» que en voseo sólo cambian el acento
  («dejas» → «dejás», «completes», «quédate») pueden salir agudos. Se lee la transcripción buscando esas tildes; si una
  sale aguda, se cambia por un verbo de raíz distinta («le pierdes el miedo», no «dejas de tenerle miedo»).

## El gancho: la regla de Martín (19/11/2026, para todas las series)

Martín, al ver el piloto de la serie 1: «no se entiende, sobre todo el hook… copiar los hooks de las estructuras… no
utilizar palabras técnicas… ser más simple». Antes de grabar, el gancho pasa estas cuatro preguntas:

1. **¿Copia la ESTRUCTURA de un gancho viral de afuera?** No la frase: la forma. Las que funcionaron
   (`docs/series/serie-2-afuera/`):
   - dos números que chocan sobre lo mismo: «gana un millón al año y tiene 5.800 seguidores»;
   - la frase del cliente en su boca: «Lo hablo con mi esposa» rindió 3,6 veces más que la explicación;
   - una escena en primera persona con un número absurdo: «un plomero me cobró 5.000 por 15 minutos»;
   - «dame un minuto y te borro el miedo a…».
2. **¿Se entiende en el primer segundo sin saber nada de marketing?** Si hace falta saber qué es un «funnel», un «CTA»
   o un «hook», no.
3. **¿Tiene alguna palabra técnica?** Se cambia por una de todos los días:
   - «gancho» → «la primera frase»;
   - «high ticket» → «vender caro» o el precio con número;
   - «cerrar» → «vender»;
   - «lead» → «alguien que te escribió».

   Lo que es nombre de una función de la app («reels de prueba») se deja, porque es como lo va a buscar.
4. **Los referentes, por el nombre corto que usa su público:** «Hormozi», no «Alex Hormozi». Si no es conocido (Dan
   Martell), no va en el gancho: el gancho es el número, y el nombre llega después.

El video 1 se rehízo por esta regla: el gancho era «Dan Martell subió el mismo video tres veces» y pasó a ser «El mismo
video tuvo treinta mil vistas… y casi cuatro millones». Además, «gancho» pasó a ser «primera frase», y el cierre «los
ganchos que más venden high ticket» pasó a ser «cinco primeras frases que funcionan».

## La plantilla de guion (≈ 110-160 palabras, 35-55 s; la voz habla a ~2,9 palabras por segundo)

| Tramo | Qué dice | Qué se ve |
|---|---|---|
| Gancho (0-3 s) | Lo contrario de lo que todos creen, o una promesa concreta con número. Una frase. | Martín en cubos grande + UNA imagen que lo pruebe. |
| Por qué importa (3-8 s) | El error que casi todos cometen y lo que les cuesta. | El error dibujado (tachado, en rojo). |
| El cuerpo (8-40 s) | El marco del mentor en 2-4 pasos, cada uno con el ejemplo de un negocio high ticket. | Una tarjeta o un plano por paso, atado a la palabra que lo nombra. |
| La vuelta (40-45 s) | La frase que resume todo, para guardar. | La frase sola, grande. |
| Cierre (últimos 2-3 s) | «Sígueme para más» o «la parte 2, mañana». | La chispa de MaKo, chica. |

## Proceso por video (y cuánto lleva)

1. Tema y gancho: del ranking + la investigación de afuera (`docs/series/serie-2-temas.md`).
2. Guion → `C:/dev/artefactos-animaciones/voz/guion-<id>.json` (escenas `[["s1","…"],…]`), contado en palabras.
3. Voz: `bash tools/voz_formato.sh <id>` → `reels/voz-<id>.mp3` + `reels/t-<id>.js` + el chequeo del guion.
4. Animación: `reels/<id>.html` sobre el kit (`reels/kit/kit.js`, `toma.js`), con el formato de la galería que mejor sirve.
5. Mirar: capturas por el turno (`node tools/turno.mjs node tools/capturar.mjs …`) y la hoja (`python -I tools/hoja.py`).
6. MP4: `node tools/turno.mjs node tools/render-mp4.mjs reels/<id>.html mp4/<id>.mp4 <dur> reels/voz-<id>.mp3 30`.
7. Ficha `reels/fichas/<id>.json` y aviso a «Galería y series 1 y 4», que la publica en la sección de la serie 2.

**Cuánto lleva (video 1, 19/11):** guion 3 min · voz 5 min (2 tomas) · animación 5 min · cada captura 10-25 min, casi
todo esperando la cola del navegador · cada ronda de arreglos 5 min · render de 55 s ≈ 14 min de máquina. Lo que más
cuesta es la cola: la captura se pide apenas el HTML compila y mientras tanto se hace otra cosa (el siguiente guion,
el commit, la cosecha).

## Videos

### 1. «El mismo video, tres veces» (`edu-mismo-video`) — temas 1 y 10 (el gancho y los trial reels)

- **Qué enseña:** el arranque decide; abre con algo que te pasó y un número, no con un consejo; y cómo probarlo sin
  quemar la cuenta: los reels de prueba, cambiando la primera frase y el texto.
- **Gancho (versión 2, por la regla de arriba):** «El mismo video tuvo treinta mil vistas… y casi cuatro millones.» Son
  dos números que chocan, se entiende sin saber de marketing, y el nombre (Dan Martell) llega en la tercera frase.
- **Los datos, verificados con yt-dlp el 19/11/2026 a la 01:15 (hora de Uruguay):**

| Video | Cómo arranca | Vistas | Subido |
|---|---|---|---|
| Dan Martell, «Never charge for your time»: https://www.youtube.com/watch?v=ZO0jOH-VKH0 | la regla («Never charge for your time») | 30.565 | 14/05/2025 |
| Dan Martell, «Never Charge For Your Time»: https://www.youtube.com/watch?v=jyR5-787ckc | ejemplo genérico («when you hire a plumber…») | 35.131 | 03/04/2024 |
| Dan Martell, «Never charge for your time»: https://www.youtube.com/watch?v=g13FnSgICA8 | recuerdo propio («I remember one time I hired a plumber…»: 15 minutos, US$5.000) | 3.974.284 | 01/09/2024 |
| Alex Hormozi, «Why Hooks Are So Important»: https://www.youtube.com/watch?v=V-loNBSqdWY | cuenta que rehicieron sólo los primeros 5 s de un video: de 4.000 a 850.000 vistas | (el dato lo da él, 0-15 s) | 02/09/2025 |

  - Las vistas cambian con el tiempo: el guion dice «treinta mil», «treinta y cinco mil» y «casi cuatro millones», y la
    pantalla muestra el número exacto con la fecha («vistas al 19/11/2026»).
  - Los tres de Martell son del mismo canal, pero de fechas distintas (abril y septiembre de 2024, mayo de 2025). Orientan;
    no son un experimento controlado. El guion no dice «experimento».
  - El ×130 de la pantalla es la cuenta 3.974.284 ÷ 30.565; el ×212 es 850.000 ÷ 4.000 (Hormozi lo redondea a «200x»).
  - El tope de 5 reels de prueba por día lo dice Hormozi en su workshop (curso 100m-money-models,
    [1JLx-787IC7sl26D-96RBpOHtaPG1KEzN], carácter ~215.093). No es oficial y fue bajando (25 → 20 → 5); el guion dice
    «hasta cinco por día».
  - El filtro de duplicados: si se cambia SÓLO el gancho, Instagram puede marcar la copia como duplicada (Modern Millie,
    ijGh9LtBJ7U, 16:24). Por eso el guion dice «con otra primera frase y otro texto».
- **Guion:** `C:/dev/artefactos-animaciones/voz/guion-edu-mismo-video.json`. Versión 2: 155 palabras y 55,0 s (la 1, con el gancho viejo, quedó en `guion-edu-mismo-video.v1.json`). «Hormozi» se
  escribe «Jormozi» para la voz.
- **Formato:** pizarrón con cámara propia (los tres videos → la cámara entra a cada uno → los tres juntos con el ×130),
  la línea de tiempo con la tijera para Hormozi, «así no / así sí» para el coach, el celular con el interruptor
  «Reel de prueba» y las cinco versiones con una que gana. Martín en cubos abajo, como quien explica; los subtítulos,
  bajo el mentón.
- **Versión 3 (19/11, por el Cerebro):** las tres tarjetas mostraban rayitas grises hasta que la voz llegaba a cada una,
  y «TRES VECES» salía apenas visible y cortado. Ahora cada tarjeta muestra desde el principio su primera frase y sus
  vistas (el número final, con un golpe de escala cuando la voz lo dice), y el título se sacó. El HTML anterior quedó
  en `reels/edu-mismo-video.v2.html`.
- **Versión 4 (19/11, «nada de letra chica»):** la cámara ya no se aleja a ver las tres tarjetas (la frase quedaba en
  27 px); con «tres veces» y con «casi cuatro millones» entra una tabla sin escalar (frase en 48 px, vistas en 72 px,
  el ×130 debajo de la fila 3). Las cinco versiones A-E pasaron de tarjetitas con rayitas a filas a ancho completo, cada
  una con su primera frase (48 px); la que gana (C) es la que el video recomendó y se llena de amarillo.

### 2. «Cinco primeras frases» (`edu-cinco-frases`) — tema 1 (el gancho), lo que promete el cierre del video 1

- **Qué enseña:** cinco formas de arrancar un video, cada una con su hueco para completar (la forma la da la pieza #27
  que guardó Martín, @startrunningads) y un ejemplo para coaches.
- **Gancho:** «Si tu video arranca con «Hola, soy…», ya lo pasaron de largo.» Es una advertencia sobre algo que casi
  todos hacen; se entiende sin saber de marketing.
- **Las cinco, cada una con el Short de donde sale (vistas al 19/11/2026, yt-dlp):**

| # | Primera frase | Short | Vistas |
|---|---|---|---|
| 1 | Dos números que chocan | Hormozi, «She Only Has 5,000 Followers?»: https://www.youtube.com/watch?v=vQlUvyDpJF4 | 388.048 |
| 2 | La frase de tu cliente, tal cual | Hormozi, «Sales Objections»: https://www.youtube.com/watch?v=VQBH4XvZGvs | 1.480.002 |
| 3 | Algo que te pasó, con un número | Dan Martell, «Never charge for your time»: https://www.youtube.com/watch?v=g13FnSgICA8 | 3.974.284 |
| 4 | Dame un minuto y te quito un miedo | Dan Martell, «Give me 58 sec..i'll DELETE your fear of rejection»: https://www.youtube.com/watch?v=UwMS0J2eTXE | 12.770.196 |
| 5 | Una pregunta con dos respuestas | Hormozi, «Which Ads Did Better?»: https://www.youtube.com/watch?v=6XAfOAhUx1E | 317.473 |

  - La suma es 18.930.003: el guion dice «casi diecinueve millones» y la pantalla muestra el número exacto con la fecha.
  - Los ejemplos de la ficha son inventados para un coach («Tengo novecientos seguidores… y vendo mentorías de tres mil
    dólares»); el número de cada ficha es el del Short real.
- **Guion:** `voz/guion-edu-cinco-frases.json`, 52,96 s. «Hormozi» se escribe «Jormosi» (con «Jormozi» el chequeo oyó
  «George Mozi»). «Dame un minuto y dejas de…» salió con voseo («dejás»): quedó «le pierdes el miedo».
- **Formato:** el reel de «Hola, soy Carla…» que se pasa de largo → la lista de cinco → una ficha por frase (nombre,
  hueco, ejemplo y de qué Short sale; la ficha crece cuando llega cada cosa, nunca hay espacio vacío ni rayitas) → el
  aro que se abre y se cierra («abren una pregunta que sólo se cierra si sigues mirando») → la suma.

### 3. «Lo tengo que pensar» (`edu-lo-pienso`) — tema 2 (las objeciones del cierre)

- **Qué enseña:** el cierre del 1 al 10 de Hormozi: «del uno al diez, ¿dónde estás?» → «¿por qué no un uno?» (el
  cliente se vende solo) → «¿qué haría falta para llegar a diez?» → si no nombra nada, «¿a qué le tienes miedo?».
- **Gancho:** la frase literal del cliente, «Me encanta. Lo tengo que pensar.». Es la estructura del viral de Hormozi
  «Sales Objections» (VQBH4XvZGvs, 1.480.002): el mismo clip pasó de 413.547 a 1.480.002 vistas cuando se reeditó para
  abrir con la frase del cliente.
- **El dato:** «Sales Close For Hesitant Buyers», subido tres veces: https://www.youtube.com/watch?v=f0mnkPDtiWg
  (1.047.716), https://www.youtube.com/watch?v=9jeuJA2QuHw (160.700), https://www.youtube.com/watch?v=wGmrvuVtmNI
  (341.171) = 1.549.587 vistas al 19/11/2026. El guion dice «más de un millón y medio».
- **Guion:** `voz/guion-edu-lo-pienso.json`, 138 palabras, 44,94 s, una toma exacta. Antes de grabar se sacaron los
  verbos que en voseo sólo cambian el acento: «pregúntale» → «hazle esta pregunta», «no le preguntes» → «en vez de…, le
  dices», «si vendes» → «si eres coach».
- **Formato:** globos de chat (el cliente en blanco a la izquierda, tú en amarillo a la derecha) sobre una escala del 1
  al 10 que se llena (la idea es de la pieza #68). Los globos crecen con su texto (`width:max-content`, máximo 880 px):
  con `white-space:nowrap` las preguntas largas se salían del cuadro.

### 4. «Viral contra nicho» (`edu-viral-nicho`) — tema 3

- **Qué enseña:** las vistas no son clientes; un video le sirve a quien te puede comprar. 300 vistas son una sala llena.
- **Gancho:** «Una dietista gana casi un millón de dólares por año… y tiene cinco mil ochocientos seguidores.» Dos números
  que chocan, como el viral de donde sale.
- **Los datos (Hormozi, «She Only Has 5,000 Followers?», https://www.youtube.com/watch?v=vQlUvyDpJF4, 388.048 vistas al
  19/11/2026):** casi un millón por año, 5.800 seguidores, 19 «me gusta» y un comentario por publicación, todo sobre
  facturarle al seguro, el 100 % de sus clientes de Instagram orgánico. La abuela de la cachetada es de «Don't Focus On
  Views» (QR1q5645iTQ) y la sala llena, de «You Don't Need More Views» (5jGFq7nYO-g). El guion no le pone número a las
  vistas de la abuela (Hormozi no lo da): «se llena de vistas».
- **Voz:** salió a 2,72 palabras por segundo (52,6 s); se aceleró ×1,10 con `atempo` y se reescalaron los tiempos: 47,84 s
  a 3,08 palabras por segundo, con la transcripción igual. Los originales quedaron en `voz/*-lento.*`.
- **Formato:** un panel por idea (los números del gancho, la publicación con su corazón, el video de Hormozi, la grilla
  de seis publicaciones del mismo tema, los medidores, la columna de vistas contra el 0 de clientes, la sala de 300
  puntos, la cuenta de US$9.000, «todo el mundo» tachado).

### 5. «Dar menos» (`edu-dar-menos`) — tema 4 (la oferta que se vende sola)

- **Qué enseña:** cada cosa que se le suma a un programa sube las bajas; la pregunta es qué es lo mínimo que da el
  resultado. Es el término «esfuerzo» de la ecuación de valor, contado como historia (así lo hace el viral).
- **Gancho:** «Un amigo de Hormozi tiene un boletín que factura quinientos mil dólares por mes.» Es el gancho del viral:
  un tercero y una cifra grande.
- **El dato (transcripción leída, no el resumen):** Hormozi, «Maybe You Need to Offer Less?»,
  https://www.youtube.com/watch?v=HQn41kV9wOc, 254.729 vistas al 19/11/2026. Las bajas más bajas: una llamada de
  preguntas al mes (hasta contestar todo) y un boletín impreso; pasó a llamadas semanales y sumó cosas, y cada agregado
  subió las bajas. Gym Launch va por la versión «9 o 10» (el guion lo dice así, no «la 10»), cada una más corta; la causa
  n.º 1 de baja, el agobio. Lo que sumó no lo dice: en pantalla son cajas «+1 … +4».
- **Guion:** `voz/guion-edu-dar-menos.json`, 147 palabras, 46,9 s, 3,24 palabras por segundo, una toma.
- **Formato:** «lo que daba» contra la columna de bajas (verde y chica → roja y alta), el video de Hormozi, las dos
  versiones del programa (alta contra baja), «AGOBIO», la pregunta tachada contra la buena, y la igualdad final.
- **Trampa de esta animación:** un bloque con `left/top` y sin `position:absolute` (la tarjeta amarilla) se fue arriba
  de todo y tapó el texto tachado; se vio en la captura.
- **Lo que vio el MP4 a 1 cuadro por segundo (19/11, y no las capturas):** 1,9 s de pizarra vacía al arrancar la
  escena 7 (de «Si eres coach» a «qué»: el panel entraba sin nada hasta la segunda frase) y 0,3 s de «la razón número
  uno» encima de los bloques que se iban. Arreglo: «Si eres coach, / la pregunta no es:» arriba desde «si» (las mismas
  palabras de la voz) y los bloques se van antes de que entre el texto. Se re-renderizó sólo el tramo 29-39 s.

### 6. «Vergüenza de grabarte» (`edu-verguenza`) — tema 5 (el miedo a mostrarte), lo que promete el cierre del 5

- **Qué enseña:** la vergüenza viene de lo que puede decir gente que no te compra; quien te paga no dice eso. La crítica
  llega igual si no haces nada; sólo grabando ayudas a alguien.
- **Gancho:** «Una mujer factura un millón de dólares por año vendiéndoles a jefes de bomberos. Y le daba vergüenza
  grabarse.» Una persona real, una cifra grande y un miedo que choca con la cifra.
- **El dato (transcripción leída):** Hormozi, «The Criticism Is a Fixed Cost Either Way»,
  https://www.youtube.com/watch?v=1UhIosOiM0E, 199.835 vistas al 19/11/2026. Su pregunta: «¿alguno de los que te
  compraron te dijo eso?» — ninguno; lo que pesaba eran un par de comentarios de terceros. Hormozi cierra con «una opción
  cambia vidas» (ella vende algo que salva vidas): acá queda «ayudas a alguien», que sirve para cualquier negocio.
- **Guion:** `voz/guion-edu-verguenza.json`, 143 palabras. La toma salió a 48,0 s y se aceleró un 5 % (`atempo`):
  45,8 s de voz, 3,1 palabras por segundo; los originales en `voz/*-lento.*`.
- **Formato:** el gancho con contador y sello rojo, el miedo en un globo, la pregunta en tarjeta amarilla, «NINGUNO» con
  la columna verde de lo que le pagaban contra 3 globos «Nunca le compraría», el video de Hormozi, las dos tarjetas
  «Si no haces nada / Si haces algo» con «Te critican» en las dos y «Ayudas a alguien» sólo en la segunda, la misma
  pregunta para quien mira, y «Graba para quien te paga» con «no para quien comenta» tachado.
- **Antes de capturar, en el código:** los dos títulos del panel 6 («Y le dijo:» → «La crítica llega igual.») se
  cruzaban en el mismo lugar, la falla que el MP4 del 5 mostró; ahora uno se va y después entra el otro.

### 7. «Cobrar más por lo mismo» (`edu-cobrar-mas`) — tema 6 (cobrar más), lo que promete el cierre del 6

- **Qué enseña:** subir el precio no pide cambiar el servicio; pide decirlo. A los de siempre, un mensaje que les
  respeta el precio si compran ahora; a los nuevos, el precio nuevo.
- **Gancho:** «Un negocio que instala luces de Navidad facturó cuatrocientos cincuenta mil dólares el año pasado.» Un
  rubro que se ve en un segundo (la guirnalda que se enciende) y una cifra.
- **El dato (transcripción leída):** Hormozi, «"How Do I Raise My Prices?"», https://www.youtube.com/watch?v=nZ0flY52BCM,
  1.811.091 vistas al 19/11/2026. «¿Qué te impide decir un precio más alto?» — «supongo que nada». Hormozi propone un
  precio nuevo pero no dice el viejo: en pantalla no hay precios inventados. Su broma («todos estos locos nuevos que nos
  quieren dar plata») queda en «los nuevos».
- **Guion:** `voz/guion-edu-cobrar-mas.json`, 135 palabras. La toma salió a 45,1 s y se aceleró un 4 %: 43,4 s de voz,
  3,1 palabras por segundo.
- **Formato:** la guirnalda de 9 focos y el contador, la etiqueta que se balancea «lo mismo que hace dos años», la
  pregunta en globo, la contrapregunta en amarillo y «Supongo que nada.», el video de Hormozi, el mensaje en tres globos
  de chat al ritmo de la voz, y «MANDA ESE MENSAJE HOY».
- **El cierre promete el 8:** «por qué tu primer anuncio no vendió nada» (tema 7; la investigación está en
  `docs/series/serie-2-afuera/anuncios-creativo.md`).

### 8. «Tu primer anuncio» (`edu-anuncio-prueba`) — tema 7 (el creativo de los anuncios), lo que promete el cierre del 7

- **Qué enseña:** un anuncio vende cuando muestra que ya funcionó (prueba); el que dice quién eres, qué haces y
  «escríbeme» está con el 80 % que no vende. Si no vendió, el problema no era el público.
- **Gancho:** «Hormozi revisó dos mil anuncios. De los cincuenta que más vendieron, cuarenta tenían una sola cosa.» El
  gancho del viral (dos cifras y una conclusión en 5 s), con la conclusión guardada para el segundo 7.
- **El dato (transcripción leída):** Hormozi, «I Analyzed 2,000 Ads (Here's My Biggest Learning)»,
  https://www.youtube.com/watch?v=9XIgalr9aWY, 352.847 vistas al 19/11/2026: de los 50 mejores, 40 eran prueba y 10
  educativos («una aproximación de la prueba»); de los 2.000, el 80 % no era prueba; «más anuncios de prueba». Qué es
  «prueba» Hormozi no lo dice: los tres ejemplos (alguien que compró contando qué le pasó, la captura de un resultado, un
  antes y un después) son explicación nuestra.
- **Guion:** `voz/guion-edu-anuncio-prueba.json`, 136 palabras. La toma salió a 2,82 palabras por segundo; con ×1,10 el
  chequeo oyó «Jord Mozi» las dos veces, con ×1,06 la oyó entera: 45,8 s de voz, 3,0 palabras por segundo.
- **Formato:** el contador de 2.000, la grilla de los 50 mejores con 40 que se encienden, «PRUEBA» con tres tarjetas,
  los otros 10 que también se encienden, 8 de 10 tachados, el video de Hormozi, el primer anuncio dibujado con el sello
  «8 de cada 10», la conclusión, «No era el público» tachado y la tarjeta «Pon a un cliente contando su resultado».
- **El cierre promete el 9:** «qué vende en Instagram, y no son los reels» (tema 8, las historias; la investigación
  está en `docs/series/serie-2-afuera/historias-que-venden.md`).

## Piezas que guardó Martín para esta serie (19/11/2026)

Las juntó el chat «Inspiración». El detalle de cada una (gancho, estructura, CTA, transcripción y cuadros) está en
`C:/dev/inspiracion/relevo.json` y en `C:/dev/inspiracion/piezas/NN/`. Las que llevan (?) las tiene que confirmar Martín.

| # | Cuenta | Qué tiene | Dónde se usa |
|---|---|---|---|
| 27 | @startrunningads | plantillas de primera frase con huecos entre corchetes, que se completan mientras habla | video 3 («cinco primeras frases que funcionan»: lo que promete el cierre del video 1) |
| 68 (?) | @thenet.lab | barra del 1 al 10 que se llena con íconos; probablemente es un anuncio | video 2 (el cierre del 1 al 10 de «lo tengo que pensar») |
| 24 (?) | @hormozi | cada consejo dicho dos veces, mal y bien, con un gráfico simple | el «así no / así sí» del video 1; temas de ventas |
| 29 (?) | @luca4business | ranking con nota X/10 y un ejemplo chiquito de cada uno | tema 11 (cada cuánto publicar) o un ranking de formatos |
| 30 (?) | @wallsframeacademy | escalera de porcentajes (80 % → 1 %) con una pirámide que se enciende | tema 3 (viral contra nicho: de cada 100 que te ven, cuántos compran) |
| 7 (?) | @wallsframeacademy | debate de dos posturas extremas y alguien que da la respuesta | las «comparativas listas» de serie-2-temas.md |
| 33 (?) | @viewcci | «Para esto: / Usa esto:» por categorías; la persona casi no habla | tema 29 (anuncio contra orgánico) o herramientas |
| 48 (?) | @ramiro.cubria | pantalla partida: arriba notas que se escriben solas, abajo la persona | formato base para cualquier tema de pasos |
| 50 (?) | @ramiro.cubria | un caso de cliente como clase: «$25K → $123K», con el ANTES en 3 cajas rojas | tema 4 (la oferta que se vende sola) |
| 65 (?) | @cherrystudio.app | tablero de detective: «desarmé 12 videos de un mentor» | un video sobre la propia investigación (los 27.700 Shorts) |
| 67 (?) | @dakota.hermes | un costo que sube en 3 saltos, y ponerle nombre al problema | tema 6 (cobrar más) o 14 (el seguimiento) |

## Investigación de afuera (los 10 primeros temas)

Por tema, en `docs/series/serie-2-afuera/<tema>.md`: los virales que lo enseñan, con el gancho literal, la estructura
por segundos, el copy, por qué funcionó, el patrón entre ellos, lo que los cursos dicen y los virales no, tres ganchos
nuestros y los números con su fuente. Hecho sólo en YouTube (base de 27.700 Shorts de 47 creadores con sus vistas); TikTok
e Instagram quedan pendientes.

## Decisiones

- 19/11: la serie no lleva CTA de venta ni «comenta PALABRA» (eso es de la serie 3); cierra invitando a seguir.
