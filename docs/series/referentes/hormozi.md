# Alex Hormozi (@hormozi): sus temas, sus ganchos y cómo está hecho cada reel

Relevo para que Martín elija los temas de su serie con avatar de IA. Todos los números salen de un script sobre
`C:/dev/referentes-videos/hormozi/reels.json` (una fila por reel, leída mirando la hoja de cuadros de cada uno) y
`temas.json` (la lista cerrada de temas con su definición). Las citas son cortas, en inglés y con la traducción entre
paréntesis: no hay transcripciones acá. Los «#n» son el número de orden de la tabla del final.

## Ficha

| | |
|---|---|
| Cuenta | [@hormozi](https://www.instagram.com/hormozi/) · 5,2 millones de seguidores · inglés · le habla a quien tiene un negocio que ya factura («business owners doing over a million dollars a year», #5); regala entrenamientos («Scaling Roadmap», «$100M Sales Teams») y vende los talleres presenciales de Acquisition.com |
| Reels mirados | 48: 3 **fijados** (15/04, 09/05 y 21/09/2026) y los 45 más nuevos de la grilla, del 29/10 al 18/11/2026 |
| Cada cuánto publica | 2,1 reels por día: 45 en 21 días, entre 1 y 4 por día, ningún día sin publicar |
| Duración mediana | 68 s (de 8 a 176) |
| Reproducciones medianas | **373.000** en los 41 no fijados con más de 48 h (de 157.000 a 1,8 M). Los 4 del 17 y el 18/11 todavía juntan reproducciones (mediana 424.500): no entran en las medianas por tema, forma ni molde, ni en el múltiplo. Los fijados: 4,7 M, 2,6 M y 1,9 M |
| Comentarios | mediana 532 por reel (sin los fijados), de 48 a 7.148 |
| Cómo se relevó | `yt-dlp` baja el video y el texto de la publicación; `ffmpeg` mide los cortes de escena y arma la hoja de cuadros; `faster-whisper` transcribe con el segundo de cada frase; `tools/audio.py` mide el fondo sonoro. Las reproducciones son las que mostraba la grilla de Instagram el 19/11/2026. Las 48 hojas se miraron una por una |

**Ojo al comparar reproducciones.** En estas tres semanas cambian dos cosas a la vez. La edad: los reels más viejos tienen
más (correlación de rangos edad–reproducciones: 0,48 en los 41 maduros; mediana de 514.500 en los 18 del 29/10 al 05/11
contra 298.000 en los 23 del 06/11 al 16/11). Y el lanzamiento: desde el 04/11 Hormozi empuja su entrenamiento gratis
«$100M Sales Teams», y 25 de los 29 reels maduros de esa etapa piden «comenta SALES / TEAMS», casi todos a cámara en el
estudio blanco y sobre ventas; antes del 04/11 lo pide 1 de 12. Fecha, tema, forma y CTA van juntos: el múltiplo ordena,
no prueba.

## La receta en dos líneas

1. **Dos fábricas.** El taller en vivo: alguien del público cuenta su negocio al micrófono, su problema va de título en un
   cartel rojo y Hormozi lo resuelve de pie en el escenario (13 de 48, entre ellos los 3 fijados). Y el estudio blanco:
   Hormozi sentado a la mesa, un cartel rojo con número («8 WAYS TO AVOID A DISCOUNT») y una lista numerada en casi una
   sola toma (19 de 48).
2. **Lo que más se ve es lo más simple y no pide nada.** Los 5 de mayor múltiplo no tienen CTA en el video y 3 son una sola
   toma sin cortes (10 reglas en una selfie, 15 años de ventas contra un reloj, un recorte de podcast). El estudio blanco,
   la forma del lanzamiento, queda por debajo de su mediana (0,88; 0,90 también a igual edad).

## Sus temas de siempre

Un tema es de qué habla (el dolor o la promesa), no el formato. Cada reel va en uno solo. Reproducciones medianas sobre los
41 maduros (entre paréntesis, cuántos son).

| Tema | Definición (para clasificar un reel nuevo) | Reels | % | Repro. medianas | Ejemplo | Por qué le pega a su público |
|---|---|---|---|---|---|---|
| **Cerrar la venta** | Lo que pasa dentro de la conversación de venta: guion, tono, objeciones, precio y descuentos, calificar y educar al prospecto, agenda y asistencia; la promesa es cerrar más con los mismos prospectos. Desempate: si le sirve igual a quien vende sin equipo, va acá; si se le vende a quien ya es cliente, va en «Más plata» | 15 | 31 % | 379.000 (13) | [#37](https://www.instagram.com/reel/DfS9tS4IcP6/) 15 años de ventas en 60 s (1,7 M) | Es lo que mejor sabe y lo dice: «my sales content always crushes» (lo de ventas siempre arrasa, #8). Una frase para usar mañana en la llamada |
| **Foco y decisiones al frente del negocio** | Cómo decide y se maneja quien dirige el negocio: foco en una sola cosa, el cuello de botella de hoy, metas, socios, vender o no la empresa, disciplina y reglas generales para ganar | 9 | 19 % | **879.000** (8) | [#43](https://www.instagram.com/reel/DfLtZLvo7Cc/) 10 reglas para ganar (1,8 M) | Le habla a la persona, no al negocio, y se comparte. Ojo: 7 de esos 8 no piden nada y son de la primera semana (fecha mediana 02/11); 3 de los 9 son disciplina personal y no del negocio (gimnasio #45, entorno #47, 10 trucos #33) |
| **Conseguir clientes** | Que lleguen más prospectos o se agenden más llamadas: anuncios, contenido, landing, VSL, una oferta de captación, la regla de 100; la promesa es más leads | 6 | 12 % | 549.000 (5) | [#44](https://www.instagram.com/reel/DfLELOsIJHF/) tutorías que cobran poco (1,4 M) | El dolor más directo («I'm not getting enough customers») con el caso de un negocio chico y sus números |
| **Armar el equipo de ventas** | Contratar, entrenar, pagar y motivar a quienes venden (setters y closers), y que el equipo venda sin depender de quien fundó el negocio; la promesa es un equipo que vende solo. Va acá sólo lo que necesita a otras personas vendiendo por ti (también el guion pensado para que lo use otro) | 7 | 15 % | 251.000 (7) | [#35](https://www.instagram.com/reel/DfVRSAYoFPf/) de cero a vender en 14 días (579.000) | Es el tema del producto que lanza. El que menos rinde: los 7 son del lanzamiento, con CTA, 6 del estudio blanco (fecha mediana 13/11) |
| **Más plata por cliente** | Ganar más con lo que ya vendes o quedarte con más: qué producto empujar (LTV contra CAC), subir precios, upsell, impuestos; la promesa es más margen sin más clientes. Va acá lo que se le vende a quien ya es cliente aunque el cartel diga «proceso de venta»: el tema lo decide la lección, no el título | 5 | 10 % | 318.000 (4) | [#27](https://www.instagram.com/reel/Dfa-MSCIfkP/) el error de impuestos de 29 millones (860.000); el fijado #1 (1,9 M) y su copia resubida #34 (373.000): 4 lecciones distintas en 5 reels | Cifras grandes y concretas: plata que ya tienes y estás dejando ir |
| **Gente que rinda y se quede** | El resto del equipo (no quienes venden): entrenar para que el negocio no dependa de quien lo dirige, retener con una escalera de carrera, sacar a quien no rinde | 4 | 8 % | 510.000 (2) | [#40](https://www.instagram.com/reel/DfQCX0KIvOH/) «un mal fichaje es peor que una silla vacía» (668.000); el fijado #2 (4,7 M, el más visto de la cuenta); #25 es la misma pregunta del taller que #2, ampliada en el estudio | El dolor de todo negocio de servicios: entrenas a alguien y se va con tus clientes |
| otros | Anuncios de sus productos o tráileres de su programa, sin una lección | 2 | 4 % | 276.000 (2) | [#46](https://www.instagram.com/reel/DfIF1hiomFo/) tráiler de su programa | — |

Ojo al comparar: 12 de los 15 de «Cerrar la venta» son del estudio blanco; los 9 de «Foco» son talleres (4), podcasts (2),
una selfie, el horizontal y uno del estudio oscuro. Con 41 reels maduros **no se puede separar el efecto del tema del de la forma, el CTA y la fecha**.
A igual edad (ver «Las formas y los temas a igual edad»), «Foco» sigue arriba (×1,8 a ×2,9) y «Conseguir clientes» baja
de ×1,47 a ×0,95 contra sus vecinos de fecha.

## Los ganchos que más repite

El molde es la idea del arranque, en abstracto. Reproducciones medianas sobre los maduros.

| Molde | Veces | Repro. medianas | Citas | Qué se ve |
|---|---|---|---|---|
| **Pregunta o queja del público como título** | 10 (los 3 fijados) | 461.000 (6) | «Why do my employees leave?» (¿por qué se van mis empleados?, #2, 4,7 M) · «I'm not getting enough customers» (#44) | pantalla dividida: Hormozi arriba, quien pregunta abajo, al micrófono; la frase entre comillas en el cartel rojo, de 3,8 a 12,7 s |
| **La frase de Hormozi como título** | 3 | **668.000** (3) | «How are you doing so little?» (¿cómo hacen tan poco?, #36) · «A bad fit is worse than an empty seat» (#40) | lo mismo, pero el cartel es la reacción o la conclusión de Hormozi |
| **Afirmación tajante** | 5 | 573.500 (4) | «Never lower your price to win a client» (nunca bajes el precio, #16) · «For the love of God, get in shape» (#45) | a cámara, la frase de una y el cartel con la lista |
| **Lista con número** | 5 | 480.000 (5) | «10 rules to WIN in business» (#43) · «2 reasons why no one is buying» (#31) | el número en el título; cuenta con los dedos o con una barra de pasos |
| **Cómo hacer X / cómo lo hago yo** | 5 | 279.000 (5) | «How I make 450 ads» (#23) · «How I pay my salespeople» (#20) | cartel «HOW I…» y enseguida el paso 1 |
| Queja u objeción del cliente entre comillas | 3 | 329.000 (3) | «I need to talk to my spouse, business partner, dog, rabbi» (lo hablo con mi pareja, mi perro…, #28) | la objeción en el cartel, con anillos y un perro en 3D sobre la mesa |
| Contra la creencia común (mito o refrán) | 2 | 300.000 (2) | «You can lead a horse to water but you can't make it drink» (#38) | un caballo al lado de Hormozi en el estudio |
| Historia personal | 2 | 506.500 (2) | «My first psychopath sales guy kept closing more» (#14) | arranca por la mitad de la historia, o con viñetas de cómic (#22) |
| Credencial: lo mejor que conozco | 2 | 262.500 (2) | «Let me tell you one of the best sales techniques I know» (#19) | se calla unos 4 s mientras corre una cuenta regresiva roja |
| Escala o ranking | 2 | 230.000 (1) | «What level of sales are you at?» (¿en qué nivel estás?, #5) | pestañas LV1 a LV5; dos columnas sobrevalorado / infravalorado |

Una vez cada uno (9): **lista contra reloj** (#37, 1,7 M: «15 years of sales advice in 60 seconds»), **pregunta directa**
(#30, 1,1 M: «What is the reason most business partnerships fall apart?»), **error caro con cifra** (#27, 860.000:
«This tax mistake cost us $29M»), si tuviera que hacerlo desde cero (#35), reacciona a su propio clip viral (#25), si
quieres X haz Y (#7), anuncio de un regalo gratis (#8), promesa absoluta (#21) y un tráiler sin voz (#46).

Condimento que atraviesa todo: **el cartel rojo fijo con el gancho escrito, en 37 de 48** (5 más llevan un título de otro
color). 20 de los 42 títulos tienen un número; en los maduros, con número dan mediana 480.000 (19) y sin número 355.500.

## Cómo está hecho

### Las formas de video

| Forma | Reels (de 48) | Repro. medianas (maduros) | Múltiplo mediano | Gancho (mediana) | Cortes/min | Comentarios (mediana) |
|---|---|---|---|---|---|---|
| A cámara en estudio blanco | 19 | 329.000 (17) | 0,88 | 3,8 s | 2,1 | 704 |
| Taller en vivo: pregunta del público | 13 (3 fijados) | 549.000 (9) | 1,47 | 4,3 s | 17,5 | 351 |
| A cámara en estudio oscuro con micrófono | 3 | 259.000 (3) | 0,69 | 6,3 s | 2,9 | 129 |
| **Recorte de podcast** | 3 | **1.100.000** (3) | **2,95** | 5,7 s | 13,0 | 418 |
| **Selfie con el teléfono** | 2 | **1.030.500** (2) | **2,76** | 4,4 s | 0,0 | 4.493 |
| Clase frente a una pantalla | 2 | 272.500 (2) | 0,73 | 2,5 s | 15,0 | 155 |
| Una vez cada una | 6 | — | — | — | — | — |

Las 6 sueltas: una charla con rotafolio en un escenario (#23, 2,37 veces su mediana), una historia con viñetas de cómic
(#22, 2,04), un video horizontal viejo con sus tuits (#33, 1,76), su reacción a su propio clip (#25, 0,94), el tráiler de
su programa (#46, 0,78) y un a cámara en un sillón de un living (#6, de las últimas 48 h).

- **Taller en vivo** (13). Sale de los talleres presenciales de Acquisition.com: quien pregunta se para al micrófono, dice su
  rubro y cuánto factura («I sell Christmas light installation»), y Hormozi responde de pie; en 6 de 13 dibuja en el
  rotafolio. Multicámara: es la forma más cortada (17,5 cortes por minuto; de 11,7 a 25,6). Arranca en pantalla dividida con
  el cartel rojo. 8 de 13 no piden nada en el video. **Se recicla:** #34 es el mismo recorte que el fijado #1 (los 32 cortes
  coinciden al segundo), resubido el 05/11 con otro título («I DON'T HAVE A SALES PROCESS..» en vez de «AM I SELLING THE
  WRONG THING?») y un CTA pegado al final; el fijado tiene 1,9 M y la copia 373.000, justo su mediana. Y #25 usa el fijado
  #2 de gancho, en un recuadro, antes de ampliarlo en el estudio.
- **A cámara en estudio blanco** (19). Mesa de madera, fondo blanco, plano medio corto, sentado, en musculosa negra o camisa a
  cuadros con el logo de Acquisition.com. Casi una toma única (2,1 cortes por minuto; de 0 a 6,9). Cada paso lleva su
  etiqueta («STEP #1», «FIX #2») y un dibujo de palitos, una placa violeta o un objeto 3D. 17 de 19 piden comentar: es la
  forma del lanzamiento (fecha mediana 11/11).
- **Recorte de podcast** (3): sentados frente a micrófonos o en un living con biblioteca, con Leila Hormozi o su equipo;
  título blanco (no rojo) o sin título, subtítulos chicos. 2 de 3 sin CTA.
- **Selfie** (2): el anuncio del lanzamiento (#8, 7.148 comentarios, el que más) y las 10 reglas (#43, 1,8 M, el más visto
  de los no fijados: 31 s, una toma, cada regla escrita entera en pantalla).
- **Estudio oscuro con micrófono** (3) y **clase frente a una pantalla** (2): material de otra época (gorra, tira nasal,
  subtítulos en cajas verdes); múltiplos de 0,45 a 1,02.

### Las formas y los temas a igual edad

Las medianas crudas mezclan la forma con la edad del reel (correlación 0,48). Dos maneras de sacarla, sobre los 41
maduros: la mediana de cada grupo dentro de cada mitad del período, como múltiplo de la mediana de esa mitad (514.500 del
29/10 al 05/11; 298.000 del 06/11 al 16/11); y cada reel contra la mediana de los reels maduros publicados 3 días antes o
después (de 6 a 17 vecinos), con la mediana del grupo. Entre paréntesis, cuántos reels.

| Forma o tema | Cruda | 29/10 a 05/11 | 06/11 a 16/11 | Contra sus vecinos de fecha |
|---|---|---|---|---|
| Estudio blanco (17) | ×0,88 | ×0,93 (5) | ×0,96 (12) | ×0,90 |
| Taller en vivo (9) | ×1,47 | ×1,18 (6) | ×1,00 (3) | ×0,95 |
| Estudio oscuro (3) | ×0,69 | ×0,55 (2) | ×0,87 (1) | ×0,66 |
| **Recorte de podcast** (3) | ×2,95 | ×2,33 (1) | ×3,29 (2) | **×2,48** |
| Selfie (2) | ×2,76 | ×3,50 (1) | ×0,88 (1) | ×2,22 |
| Clase (2) | ×0,73 | ×0,74 (1) | ×0,56 (1) | ×0,59 |
| Cerrar la venta (13) | ×1,02 | ×0,80 (6) | ×1,20 (7) | ×1,10 |
| **Foco y decisiones** (8) | ×2,36 | ×1,81 (6) | ×2,87 (2) | **×2,38** |
| Armar el equipo de ventas (7) | ×0,67 | ×1,13 (1) | ×0,81 (6) | ×0,87 |
| Conseguir clientes (5) | ×1,47 | ×1,89 (2) | ×1,22 (3) | ×0,95 |
| Más plata por cliente (4) | ×0,85 | ×0,72 (1) | ×0,88 (3) | ×0,77 |
| Gente que rinda (2) | ×1,37 | ×1,30 (1) | ×1,18 (1) | ×1,13 |

- **El taller pierde casi toda su ventaja:** ×1,47 crudo, ×1,00 a ×1,18 en cada mitad y ×0,95 contra sus vecinos. 6 de sus
  9 maduros son de la primera mitad: lo que parecía la forma era, sobre todo, la edad (como en Víctor, donde ×5,2 bajó a
  ×1,2–2,4).
- **El estudio blanco no rinde menos por ser nuevo:** queda en ×0,90 a ×0,96 también a igual edad.
- **El podcast y el tema «Foco» aguantan** (×2,3 a ×3,3 y ×1,8 a ×2,9), pero son 3 y 8 reels, 4 de los 8 de «Foco» son
  podcast, selfie u horizontal, y 7 de 8 no piden nada: tema, forma y CTA siguen juntos.
- **La selfie no dice nada:** una por mitad, con resultados opuestos (las 10 reglas ×3,50; el anuncio del lanzamiento ×0,88).

### Duración del gancho y qué tiene de exagerado

- Mediana **4,3 s** (de 1,2 a 15,9): estudio blanco 3,8 s, taller 4,3 s, podcast 5,7 s.
- **Avatar, en ninguno de los 48; IA, probable en uno** (#22: viñetas de cómic con su personaje en escenas que no se
  filmaron; no se puede confirmar). El gancho no es una imagen exagerada: es **el problema dicho por alguien
  real** (taller) o **una frase tajante con un número** (estudio). Lo único que se sale de eso: esa historia con viñetas de
  cómic de Las Vegas con Hormozi dibujado (#22, 762.000, 2,04 veces su mediana), objetos 3D sobre la mesa (un Ferrari con su
  precio, anillos de boda, un perro: 3 reels), un caballo en el estudio (#38) y una cuenta regresiva de verdad (#19, #37).

### Cuándo pasa a la persona

- En **46 de 48** Hormozi está desde el segundo 0 y habla en serio de entrada (en el taller, en pantalla dividida mientras
  habla quien pregunta).
- En #25 mira su clip en el teléfono y entra a hablar en el 16,1. En #46 (el tráiler) no habla nunca.

### Plano, lugar, luz, subtítulos, cortes, sonido, b-roll, formato

- **Plano:** sentado en 28 (estudios, podcasts, el sillón, la selfie de las reglas); de pie en 19 (talleres, rotafolio,
  clases, la selfie del anuncio); el tráiler es montaje.
- **Lugar:** estudio de fondo blanco 21 · escenarios y salas de taller 14 · estudio oscuro con barras de luz 3 · sets de
  podcast 3 · interiores comunes (sillón, pasillo, oficina) 3 · sala con pantalla 2 · estudio gris 1 · set de su programa 1.
- **Luz:** de estudio, suave y pareja 22 · de evento 14 · cálida de interior o de cine 3 · contrastada sobre fondo negro 3 ·
  fría de interior 2 · natural 2 · otras 2.
- **Subtítulos: en 46 de 48.** Palabra por palabra en 37: blanco al centro con la palabra clave en negrita (en los 13
  talleres, en amarillo). Frases enteras en 9 (2 podcasts, las 2 selfies, el horizontal, las 2 clases en cajas verdes, uno
  del estudio oscuro y la charla del escenario). Ninguno en 2 (#37 sólo etiqueta cada consejo; el tráiler).
- **Cortes por minuto:** mediana 5,6, pero son dos mundos: el estudio blanco (2,1) y el taller (17,5). 6 no tienen ningún
  corte y 20 pasan de 10 por minuto. *El horizontal #33 se recontó dentro de la franja 16:9: la medición automática daba 0
  y son 10 cortes (12,9 por minuto).*
- **Fondo sonoro (medido):** 30 de 48 sin fondo (silencio entre frases), 15 con fondo constante (piso mediano -35 dB) y 3
  dudosos. Los 13 talleres, sin fondo. La medición no distingue música de ambiente: el fondo constante aparece en las 2
  selfies, 2 de los 3 podcasts, 2 de los 3 del estudio oscuro, 4 de los 19 del estudio blanco, el tráiler, una de las 2 clases y 3 sueltos (el sillón, el
  rotafolio del escenario y el horizontal).
- **B-roll:** 34 de 48 insertan algo: el rotafolio (9), dibujos a mano estilo pizarra (8: palitos, cuentas, tarjetas),
  gráficos animados de pasos o listas (5), objetos 3D (3), capturas de su landing y de sus tuits, placas violetas a pantalla
  completa, las tapas de sus lanzamientos. 14 no insertan nada.
- **Formato:** 47 verticales; 1 horizontal con franjas negras (#33).

## Estructura típica por segundos

De las medianas de los 48:

- **0 a 4,3 s — gancho:** el cartel rojo y la primera frase (la pregunta de quien pregunta, la frase tajante o «N formas de…»).
- **Persona:** desde el 0 en 46 de 48.
- **4,3 a ~64 s — desarrollo.** En el estudio: la lista numerada, un paso cada 5 a 15 s, cada uno con su etiqueta. En el
  taller: el negocio y sus números → el diagnóstico → la regla (en el rotafolio) → una frase de cierre que a veces es el
  mismo título (#40).
- **CTA (en 30 de 48):** empieza en el 94 % del video (mediana; segundo 68,5, de 4,0 a 171,6) y dura unos 4 s. En 16 de los 21 hablados es
  un clip grabado aparte.
- **Final: 68 s.**

## CTA

- **30 de 48 piden comentar una palabra en el video**: 21 lo dicen y 9 sólo lo escriben en pantalla. 18 no piden nada.
- **Palabras en el video:** SALES 13 · TEAMS 7 · MAP 5 · TEAM 3 · WEALTH 1 · LINK 1. La palabra nombra el regalo: SALES,
  TEAMS y TEAM, el entrenamiento gratis «$100M Sales Teams» (primero la lista de espera, después el lanzamiento); MAP, el
  «Scaling Roadmap» personalizado; WEALTH, el taller de patrimonio; LINK, el episodio de su programa.
- **La publicación pide una palabra en 43 de 48** (SALES 16 · WIN 8 · MAP 6 · TEAMS 5 · TEAM 5 · WEALTH, PARTNER y LINK, 1
  cada una): 13 reels sin CTA en el video lo piden en el texto. En 2 la palabra dicha (TEAMS) no es la del texto (TEAM).
- **El CTA es un clip aparte:** en 16 de los 21 hablados cambian la ropa o el fondo, y se repiten 4 frases grabadas una vez:
  «comenta para la lista de espera» (8), «sale algo grande, te va a encantar» (4), «en vez de escribir un libro este año…»
  (3) y «esto es una pieza, comenta por las otras cuatro horas» (2). 4 son propios del reel.
- **Cuándo:** antes del 04/11, 1 de 12 reels maduros pide algo (el tráiler); desde el 04/11, 25 de 29.
- Con CTA, mediana de 313.500 reproducciones (26 maduros) y 536 comentarios; sin CTA, 658.000 (15) y 355. En la misma
  etapa (desde el 04/11), con CTA 329.000 (25) y sin CTA 879.000, pero son sólo 4. Con estos datos no se puede decir que el
  CTA reste: los que no piden nada son, sobre todo, los más viejos.
- **Los más comentados:** el anuncio #8 (7.148, TEAMS), la VSL #29 (3.459, SALES), los 450 anuncios #23 (2.858, MAP sólo
  escrito), #35 (2.764) y el parque infantil resubido #34 (2.698).

## Lo que mejor le funcionó

Múltiplo = reproducciones ÷ 373.000 (su mediana). Sólo los 41 no fijados con más de 48 h.

| # | Reel | Múltiplo | Repro. | Tema | Gancho |
|---|---|---|---|---|---|
| 43 | [DfLtZLvo7Cc](https://www.instagram.com/reel/DfLtZLvo7Cc/) | 4,83 | 1.800.000 | Foco | selfie de 31 s: «10 rules to WIN in business», una regla escrita cada 3 s, sin cortes |
| 37 | [DfS9tS4IcP6](https://www.instagram.com/reel/DfS9tS4IcP6/) | 4,56 | 1.700.000 | Cerrar la venta | «15 years of sales advice in 60 seconds» con un reloj de cuenta regresiva en la mesa; 11 consejos en una toma |
| 44 | [DfLELOsIJHF](https://www.instagram.com/reel/DfLELOsIJHF/) | 3,75 | 1.400.000 | Conseguir clientes | taller: «I'M NOT GETTING ENOUGH CUSTOMERS..»; tutorías que cobran poco, paquetes y una beca como anuncio |
| 36 | [DfTSZcnovSg](https://www.instagram.com/reel/DfTSZcnovSg/) | 3,22 | 1.200.000 | Foco | taller: la reacción de Hormozi de título, «HOW ARE YOU DOING SO LITTLE?», ante un negocio de infoproductos con 500 llamadas por día |
| 45 | [DfJL0pcIGG0](https://www.instagram.com/reel/DfJL0pcIGG0/) | 3,22 | 1.200.000 | Foco | recorte de podcast: «for the love of God, get in shape» |

Siguen el podcast de las sociedades (#30, 2,95), los 450 anuncios (#23, 2,37), el error de impuestos (#27, 2,31) y el cómic
de Las Vegas (#22, 2,04). Los fijados están de 5 a 12,6 veces arriba de la mediana.

**Qué tienen en común:** ninguno de los 5 pide nada en el video; los 5 son del 31/10 al 04/11, la semana más vieja del
relevo, cuando todavía casi no pedía nada; 3 son de «Foco» y 3 son una sola toma sin cortes. En la otra punta, de los 10 de menor
múltiplo, 8 piden comentar y 5 son del estudio blanco.

## Qué le sirve a Martín y qué no

1. **Sí: el gancho del taller, con su avatar en el lugar de quien pregunta.** Es lo que llevó a Hormozi a sus fijados (4,7 M,
   2,6 M, 1,9 M): un cliente dice su queja en 4 a 13 s, con la frase en un cartel arriba, y enseguida viene la respuesta en
   serio. El personaje en cubos puede decir la queja de siempre del high ticket («tengo seguidores y nadie agenda») y Martín
   entra a responder. Ojo: a igual edad el taller rinde como sus vecinos de fecha (×0,95 a ×1,18): lo que se copia es el
   gancho, no una forma que rinda más sola. Con Omni 1.2 Flash a US$0,024 por segundo: el gancho mediano de Hormozi (4,3 s) cuesta US$0,10; uno de
   10 a 15 s, US$0,24 a 0,36.
2. **Sí: el cartel fijo con el dolor o con un número y la lista numerada** (37 de 48 llevan cartel; 20 títulos con número),
   que se hace con código y no gasta segundos de avatar. Los temas que más se acercan a MaKo son los suyos de siempre:
   «Cerrar la venta» (31 % del feed: guion, objeciones, no bajar el precio) y «Armar el equipo de ventas» (setters y closers).
3. **Sí: lo más barato es lo que más se vio.** «10 reglas» en una selfie (31 s, 1,8 M) y «15 años en 60 segundos» con un
   reloj (49 s, 1,7 M), una toma y sin cortes: sirven para los días sin avatar.
4. **Con cuidado: el tema del lanzamiento rinde menos.** «Armar el equipo de ventas» tiene múltiplo 0,67 (a igual edad, 0,81
   en la segunda mitad, donde están 6 de sus 7, y 0,87 contra sus vecinos de fecha) y el estudio blanco (17 de 19 con CTA), 0,88 (0,90 a 0,96 a igual edad); los 5 mejores no piden nada. Si Martín usa «comenta PALABRA», que el gancho sea el dolor y no el regalo
   (con estos datos no se sabe si el CTA resta: va mezclado con la edad).
5. **No:** copiar a Hormozi en lo de la IA (la única probable son las viñetas de cómic con su personaje, #22, una
   buena pista para el personaje en cubos), el inglés, la cifra «$250M/year» en el cartel con el nombre y el taller
   con cientos de personas que Martín no tiene: ahí el avatar hace de público.

## Lo que no se ve en los cuadros

Si el caballo del #38 es real o montado; si las viñetas del #22 están hechas con IA (por el estilo lo parecen y en `reels.json` van como IA); si el fondo
constante es música o ambiente; si algún reel tiene anuncios pagos detrás (los fijados de millones); y cuánto del
rendimiento es del tema, de la forma, del CTA o de la edad. Los segundos de fin de gancho y de inicio del CTA son el comienzo
de la frase en la transcripción o el corte en que se va el cartel (±3 s); en los 9 CTA sólo escritos, el primer cuadro de
la hoja donde se ve (hasta ±10 s en #6 y #25).

## Todos los reels

Fecha de publicación; reproducciones de la grilla el 19/11/2026 (las del 17/11 en adelante todavía suben); el múltiplo
(÷ 373.000; los fijados y los de menos de 48 h van marcados y no cuentan en las medianas); el gancho con su tipo y su
segundo de fin; el CTA con su palabra y el segundo en que empieza («escrito» si no lo dice).

| # | Reel | Fecha | Repro. | Múltiplo | Duración | Tema | Forma | Gancho (tipo, fin) | CTA (desde) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | [DXJzl3jySxZ](https://www.instagram.com/reel/DXJzl3jySxZ/) | 15/04/2026 (fijado) | 1.900.000 | 5,09 (fijado) | 110 s | Más plata por cliente | taller en vivo | otro, 0–4,3 s | — |
| 2 | [Ddii_P4BHns](https://www.instagram.com/reel/Ddii_P4BHns/) | 21/09/2026 (fijado) | 4.700.000 | 12,60 (fijado) | 147 s | Gente que rinda | taller en vivo | otro, 0–12,7 s | — |
| 3 | [DYGVdp0u-OI](https://www.instagram.com/reel/DYGVdp0u-OI/) | 09/05/2026 (fijado) | 2.600.000 | 6,97 (fijado) | 151 s | Foco | taller en vivo | otro, 0–4,0 s | — |
| 4 | [Df5fHGgoAfg](https://www.instagram.com/reel/Df5fHGgoAfg/) | 18/11 | 177.000 | 0,47 (< 48 h) | 102 s | Gente que rinda | taller en vivo | otro, 0–3,8 s | MAP (100,2 s, escrito) |
| 5 | [Df47unjuoLK](https://www.instagram.com/reel/Df47unjuoLK/) | 18/11 | 437.000 | 1,17 (< 48 h) | 48 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–1,2 s | SALES (43,1 s) |
| 6 | [Df3SUd3oVhP](https://www.instagram.com/reel/Df3SUd3oVhP/) | 18/11 | 412.000 | 1,10 (< 48 h) | 86 s | Conseguir clientes | casa (sillón) | persona-a-camara, 0–4,8 s | MAP (84,8 s, escrito) |
| 7 | [Df2ZGHFTED1](https://www.instagram.com/reel/Df2ZGHFTED1/) | 17/11 | 630.000 | 1,69 (< 48 h) | 83 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–4,2 s | SALES (77,0 s) |
| 8 | [DfzyEY9Iu_o](https://www.instagram.com/reel/DfzyEY9Iu_o/) | 16/11 | 261.000 | 0,70 | 57 s | otros | selfie | persona-a-camara, 0–5,4 s | TEAMS (4,0 s) |
| 9 | [DfxqSY3IXEl](https://www.instagram.com/reel/DfxqSY3IXEl/) | 15/11 | 157.000 | 0,42 | 85 s | Equipo de ventas | estudio blanco | persona-a-camara, 0–3,7 s | TEAMS (81,1 s) |
| 10 | [DfxMnPJogj3](https://www.instagram.com/reel/DfxMnPJogj3/) | 15/11 | 223.000 | 0,60 | 176 s | Equipo de ventas | estudio blanco | persona-a-camara, 0–1,8 s | SALES (171,6 s) |
| 11 | [DfvXW4II3pz](https://www.instagram.com/reel/DfvXW4II3pz/) | 14/11 | 213.000 | 0,57 | 43 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–3,4 s | TEAMS (39,4 s) |
| 12 | [Dfuy2Ivor21](https://www.instagram.com/reel/Dfuy2Ivor21/) | 14/11 | 230.000 | 0,62 | 156 s | Equipo de ventas | estudio blanco | persona-a-camara, 0–2,5 s | SALES (151,5 s) |
| 13 | [Dfsi_bnhENS](https://www.instagram.com/reel/Dfsi_bnhENS/) | 13/11 | 294.000 | 0,79 | 112 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–2,9 s | SALES (105,3 s) |
| 14 | [DfsCJRUujkJ](https://www.instagram.com/reel/DfsCJRUujkJ/) | 13/11 | 251.000 | 0,67 | 68 s | Equipo de ventas | estudio blanco | persona-a-camara, 0–8,0 s | TEAMS (64,5 s) |
| 15 | [DfqJOLWI5p0](https://www.instagram.com/reel/DfqJOLWI5p0/) | 12/11 | 613.000 | 1,64 | 119 s | Foco | taller en vivo | otro, 0–9,8 s | MAP (117,6 s, escrito) |
| 16 | [Dfpk7PcTfsK](https://www.instagram.com/reel/Dfpk7PcTfsK/) | 12/11 | 683.000 | 1,83 | 104 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–4,3 s | TEAMS (101,0 s) |
| 17 | [DfnZb7fhqZ9](https://www.instagram.com/reel/DfnZb7fhqZ9/) | 11/11 | 166.000 | 0,45 | 52 s | Más plata por cliente | clase | persona-a-camara, 0–2,9 s | TEAMS (49,1 s) |
| 18 | [Dfm-f1fznqw](https://www.instagram.com/reel/Dfm-f1fznqw/) | 11/11 | 464.000 | 1,24 | 86 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–3,2 s | TEAMS (82,8 s) |
| 19 | [Dfky14eO6zy](https://www.instagram.com/reel/Dfky14eO6zy/) | 10/11 | 359.000 | 0,96 | 32 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–7,0 s | TEAM (30,8 s, escrito) |
| 20 | [DfkXCTbTnmO](https://www.instagram.com/reel/DfkXCTbTnmO/) | 10/11 | 279.000 | 0,75 | 96 s | Equipo de ventas | estudio blanco | texto-en-pantalla, 0–7,0 s | TEAM (91,4 s) |
| 21 | [DfieHm4ICHc](https://www.instagram.com/reel/DfieHm4ICHc/) | 09/11 | 259.000 | 0,69 | 61 s | Conseguir clientes | estudio oscuro | persona-a-camara, 0–8,4 s | — |
| 22 | [Dfh7jNKzEmm](https://www.instagram.com/reel/Dfh7jNKzEmm/) | 09/11 | 762.000 | 2,04 | 57 s | Cerrar la venta | a cámara + cómic | otro, 0–9,0 s | TEAM (55,6 s, escrito) |
| 23 | [DfgNZ9VhWjc](https://www.instagram.com/reel/DfgNZ9VhWjc/) | 09/11 | 883.000 | 2,37 | 50 s | Conseguir clientes | escenario con rotafolio | persona-a-camara, 0–2,1 s | MAP (47,7 s, escrito) |
| 24 | [Dff9AfKIjZb](https://www.instagram.com/reel/Dff9AfKIjZb/) | 08/11 | 298.000 | 0,80 | 97 s | Equipo de ventas | taller en vivo | otro, 0–8,0 s | SALES (91,4 s) |
| 25 | [DfddWMco7dy](https://www.instagram.com/reel/DfddWMco7dy/) | 08/11 | 352.000 | 0,94 | 124 s | Gente que rinda | reacción a su clip | otro, 0–15,9 s | MAP (122,9 s, escrito) |
| 26 | [DfcpmqYoDLd](https://www.instagram.com/reel/DfcpmqYoDLd/) | 07/11 | 263.000 | 0,71 | 62 s | Más plata por cliente | taller en vivo | otro, 0–4,0 s | SALES (53,6 s) |
| 27 | [Dfa-MSCIfkP](https://www.instagram.com/reel/Dfa-MSCIfkP/) | 07/11 | 860.000 | 2,31 | 51 s | Más plata por cliente | podcast | otro, 0–8,8 s | WEALTH (46,6 s, escrito) |
| 28 | [DfaawJpoCve](https://www.instagram.com/reel/DfaawJpoCve/) | 06/11 | 329.000 | 0,88 | 80 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–6,2 s | SALES (72,5 s) |
| 29 | [DfaGTlsoI7m](https://www.instagram.com/reel/DfaGTlsoI7m/) | 06/11 | 365.000 | 0,98 | 54 s | Conseguir clientes | estudio blanco | persona-a-camara, 0–2,3 s | SALES (45,5 s) |
| 30 | [DfYfvMeo430](https://www.instagram.com/reel/DfYfvMeo430/) | 06/11 | 1.100.000 | 2,95 | 38 s | Foco | podcast | otro, 0–3,6 s | — |
| 31 | [DfXyDVPopFX](https://www.instagram.com/reel/DfXyDVPopFX/) | 05/11 | 278.000 | 0,75 | 41 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–3,8 s | SALES (36,0 s) |
| 32 | [DfXZyinIVtU](https://www.instagram.com/reel/DfXZyinIVtU/) | 05/11 | 480.000 | 1,29 | 64 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–2,2 s | SALES (56,3 s) |
| 33 | [DfV6LqsB2gd](https://www.instagram.com/reel/DfV6LqsB2gd/) | 05/11 | 658.000 | 1,76 | 47 s | Foco | horizontal con tuits | texto-en-pantalla, 0–4,0 s | — |
| 34 | [DfVy7ddIls2](https://www.instagram.com/reel/DfVy7ddIls2/) | 05/11 | 373.000 | 1,00 | 117 s | Más plata por cliente | taller en vivo | otro, 0–4,3 s | SALES (108,8 s) |
| 35 | [DfVRSAYoFPf](https://www.instagram.com/reel/DfVRSAYoFPf/) | 04/11 | 579.000 | 1,55 | 69 s | Equipo de ventas | estudio blanco | persona-a-camara, 0–4,6 s | SALES (60,8 s) |
| 36 | [DfTSZcnovSg](https://www.instagram.com/reel/DfTSZcnovSg/) | 04/11 | 1.200.000 | 3,22 | 89 s | Foco | taller en vivo | otro, 0–4,6 s | — |
| 37 | [DfS9tS4IcP6](https://www.instagram.com/reel/DfS9tS4IcP6/) | 03/11 | 1.700.000 | 4,56 | 49 s | Cerrar la venta | estudio blanco | persona-a-camara, 0–3,9 s | — |
| 38 | [DfSV88LohWW](https://www.instagram.com/reel/DfSV88LohWW/) | 03/11 | 443.000 | 1,19 | 67 s | Cerrar la venta | estudio blanco | situacion-actuada, 0–5,4 s | — |
| 39 | [DfQcB1Eox9Z](https://www.instagram.com/reel/DfQcB1Eox9Z/) | 02/11 | 371.000 | 0,99 | 49 s | Cerrar la venta | estudio oscuro | persona-a-camara, 0–6,1 s | — |
| 40 | [DfQCX0KIvOH](https://www.instagram.com/reel/DfQCX0KIvOH/) | 02/11 | 668.000 | 1,79 | 107 s | Gente que rinda | taller en vivo | otro, 0–3,2 s | — |
| 41 | [DfOSmdBIVrA](https://www.instagram.com/reel/DfOSmdBIVrA/) | 02/11 | 379.000 | 1,02 | 38 s | Cerrar la venta | clase | persona-a-camara, 0–2,0 s | — |
| 42 | [DfNV1vho-OA](https://www.instagram.com/reel/DfNV1vho-OA/) | 01/11 | 549.000 | 1,47 | 111 s | Conseguir clientes | taller en vivo | otro, 0–4,4 s | — |
| 43 | [DfLtZLvo7Cc](https://www.instagram.com/reel/DfLtZLvo7Cc/) | 01/11 | 1.800.000 | 4,83 | 31 s | Foco | selfie | persona-a-camara, 0–3,4 s | — |
| 44 | [DfLELOsIJHF](https://www.instagram.com/reel/DfLELOsIJHF/) | 31/10 | 1.400.000 | 3,75 | 110 s | Conseguir clientes | taller en vivo | otro, 0–6,0 s | — |
| 45 | [DfJL0pcIGG0](https://www.instagram.com/reel/DfJL0pcIGG0/) | 31/10 | 1.200.000 | 3,22 | 35 s | Foco | podcast | otro, 0–5,7 s | — |
| 46 | [DfIF1hiomFo](https://www.instagram.com/reel/DfIF1hiomFo/) | 30/10 | 291.000 | 0,78 | 8 s | otros | tráiler | b-roll, 0–8,1 s | LINK (6,0 s, escrito) |
| 47 | [DfH_ca6oRk3](https://www.instagram.com/reel/DfH_ca6oRk3/) | 30/10 | 197.000 | 0,53 | 32 s | Foco | estudio oscuro | persona-a-camara, 0–6,3 s | — |
| 48 | [DfGKrspoo_L](https://www.instagram.com/reel/DfGKrspoo_L/) | 29/10 | 376.000 | 1,01 | 93 s | Foco | taller en vivo | otro, 0–2,6 s | — |

## Carruseles y posts

Todo lo que no es reel en su grilla el 19/11/2026: **20 publicaciones, 17 carruseles y 3 imágenes sueltas**, del 23/10/2026 al
19/11/2026. 2 son publicaciones de Leila Hormozi en colaboración (el embarazo y el nacimiento de su hijo). Las hojas se
miraron una por una (`C:/dev/referentes-videos/hormozi/pub/<id>/hoja.jpg`); los números salen de un script sobre
`hormozi/publicaciones.json`.

- **Tipo:** de 1 a 13 láminas (mediana 7,5); todas imágenes salvo 1 lámina de video.
- **Temas:** Foco 6 · otros 4 · Más plata por cliente 3 · Cerrar la venta 3 · Conseguir clientes 2 · Gente que rinda 2. En los reels manda «Cerrar la venta» (15 de 48); acá, «Foco» (los tuits de
  disciplina). «Armar el equipo de ventas», el tema del lanzamiento en sus reels (7 de 48), no aparece: el lanzamiento va
  como «otros» (2 anuncios).
- **Moldes de portada:** Tuit en captura (foto, nombre, verificado) 9 · Pregunta del público en el taller: cuánto factura + su problema 3 · Fotos de familia sin texto (colaboración de Leila Hormozi) 2 · Anuncio de su lanzamiento 2 · Título-tutorial con dibujos de palitos («Mozi Minute») 2 · Página de su libro 1 · Escena de su programa con la promesa de N pasos 1.
- **Estructura típica:** en los tuits no hay portada aparte: la portada es el primer tuit y sigue uno por lámina (foto, nombre,
  tilde azul, fondo negro o blanco). Desde el 08/11/2026, 7 de sus 8 publicaciones propias terminan en una lámina de CTA: «comenta "PALABRA"»
  (en inglés), la palabra gigante entre comillas sobre el producto borroso. Los talleres son sus reels cortados en láminas (dos cuadros apilados con el subtítulo); los
  «Mozi Minute», un dibujo de palitos y una idea por lámina.
- **CTA:** 13 de 20 piden una palabra: TEAM 4 · MAP 3 · WIN 3 · TEAMS 1 · 100LEADS 1 · SCALE 1. En la lámina, 10
  (en 3, quemada al pie de un taller); sólo en el pie, 3. Lo que regala: la lista de espera o el curso «$100M Sales Teams»
  (TEAM, TEAMS), la hoja de ruta (MAP, WIN, 100LEADS) y un episodio (SCALE).
- **Me gusta medianos: 15.047** (de 3.443 a 308.792); sin las 2 de Leila, 13.108,5.
  Comentarios medianos 425,5. Sus reels: mediana de 8.585 me gusta (48 reels).
  Con más de 48 h y sin las colaboraciones: con CTA en la lámina, 12.601 (8); sin CTA en la lámina, 24.349,5 (8).
  Como en los reels, va mezclado con la fecha: los que no piden nada son los más viejos.
  El anuncio del lanzamiento ([Df0AD3MlLaU](https://www.instagram.com/p/Df0AD3MlLaU/)) tiene 20.564 comentarios, el récord de las tres cuentas.
- **De venta:** 13: enseñanza + regalo por comentar en la última lámina 5 · taller + palabra quemada al pie de la última lámina 3 · sólo el pie pide la palabra 3 · lanzamiento de su producto 2.

**Qué le sirve a Martín para sus carruseles:**

1. **El tuit en captura**: 9 de 20, lo más barato (texto y una foto) y sin portada aparte. Con frases de Martín
   sobre vender high ticket y una última lámina de CTA.
2. **El «Mozi Minute»**: problema → la frase para decir → ejemplo con números (forma vieja contra nueva) → resultado → CTA,
   con dibujos simples. Se puede hacer con el personaje en cubos.
3. **La lámina final de CTA**: la palabra gigante entre comillas sobre el regalo borroso, y la palabra repetida en el pie.
4. **La línea de tiempo «cada año…»** para anunciar algo: cada lámina, un logro con su prueba, y el anuncio al final.
5. **No:** las fotos de familia (las de más me gusta, pero no se copian), el inglés ni la cifra «$250M/year» del cartel.

| Publicación | Fecha | Tipo | Tema | Portada | Láminas | Me gusta | CTA |
|---|---|---|---|---|---|---|---|
| [Df59TgLCEej](https://www.instagram.com/p/Df59TgLCEej/) | 19/11/2026 | carrusel | Conseguir clientes | «El secreto de la publicidad de respuesta directa: hacer afirmaciones locas» | 8 | 5.170 | MAP |
| [Df3izljCP0e](https://www.instagram.com/p/Df3izljCP0e/) | 18/11/2026 | carrusel | Más plata por cliente | «Mi empresa pasó de 0 a 500.000 dólares en 4 meses» | 8 | 3.443 | MAP |
| [Df2R33MGymo](https://www.instagram.com/p/Df2R33MGymo/) | 17/11/2026 | carrusel · con @leilahormozi | otros | «Pie: Te damos la bienvenida al mundo, Cyrus Alexander Hormozi» | 4 | 308.792 | — |
| [Df0AD3MlLaU](https://www.instagram.com/p/Df0AD3MlLaU/) | 16/11/2026 | carrusel | otros | «GRAN ANUNCIO» | 6 | 14.002 | TEAMS |
| [Dfyl114CP0z](https://www.instagram.com/p/Dfyl114CP0z/) | 16/11/2026 | carrusel | Cerrar la venta | «Mata la pregunta del precio» | 9 | 6.739 | TEAM |
| [Dfv2Z-HiA00](https://www.instagram.com/p/Dfv2Z-HiA00/) | 15/11/2026 | carrusel | Más plata por cliente | «Cómo hacerte asquerosamente rico:» | 8 | 39.171 | MAP |
| [Dfn2YKdCDqL](https://www.instagram.com/p/Dfn2YKdCDqL/) | 12/11/2026 | carrusel | Cerrar la venta | «Cómo abrir una llamada de venta» | 12 | 9.301 | TEAM |
| [DfiopoZiGHc](https://www.instagram.com/p/DfiopoZiGHc/) | 10/11/2026 | carrusel | Cerrar la venta | «Si pudiera decirle una sola cosa sobre ventas a mi yo de 22 años…» | 9 | 39.595 | TEAM |
| [DffbP3wiALk](https://www.instagram.com/p/DffbP3wiALk/) | 08/11/2026 | carrusel | otros | «Cada año dedico de 200 a 2.000 horas a un solo gran proyecto…» | 6 | 11.200 | TEAM |
| [DfREpNnCGJd](https://www.instagram.com/p/DfREpNnCGJd/) | 03/11/2026 | carrusel | Gente que rinda | «Facturamos 2,2 millones con un solo local» | 9 | 8.992 | WIN |
| [DfN5ZVRCC_S](https://www.instagram.com/p/DfN5ZVRCC_S/) | 01/11/2026 | carrusel | Foco | «Todo es difícil. Nada funciona a la primera. Todo parece no tener sentido.» | 7 | 39.291 | — |
| [DfKcvPXm7cr](https://www.instagram.com/p/DfKcvPXm7cr/) | 31/10/2026 | carrusel · con @leilahormozi | otros | «Pie: En cualquier momento…» | 5 | 120.192 | — |
| [DfGWvCrjCES](https://www.instagram.com/p/DfGWvCrjCES/) | 30/10/2026 | imagen | Foco | «Si sientes que estás por detrás de donde deberías estar a esta altura…» | 1 | 12.215 | — |
| [DfI7YLLiOmB](https://www.instagram.com/p/DfI7YLLiOmB/) | 30/10/2026 | carrusel | Gente que rinda | «Gano 4,3 millones como youtuber de viajes y comida» | 13 | 16.092 | WIN |
| [DfD_mFulLdm](https://www.instagram.com/p/DfD_mFulLdm/) | 29/10/2026 | imagen | Foco | «Las razones más comunes para fracasar, en orden: 1) no empezar…» | 1 | 20.874 | — |
| [DfBatfzl4sF](https://www.instagram.com/p/DfBatfzl4sF/) | 28/10/2026 | carrusel | Conseguir clientes | «Por qué nadie hace clic en tus enlaces…» | 5 | 4.945 | 100LEADS |
| [DfBNIjulzx4](https://www.instagram.com/p/DfBNIjulzx4/) | 28/10/2026 | imagen | Foco | «Todo es difícil. Nada funciona a la primera. Todo parece no tener sentido.» | 1 | 27.825 | — |
| [De8RSEmF4HW](https://www.instagram.com/p/De8RSEmF4HW/) | 26/10/2026 | carrusel | Foco | «Lo más promedio del mundo es creer que estás por encima del promedio» | 10 | 29.371 | — |
| [De586IuF_fb](https://www.instagram.com/p/De586IuF_fb/) | 25/10/2026 | carrusel | Más plata por cliente | «Este proceso de venta de 4 pasos arrasa…» | 8 | 6.733 | SCALE |
| [De0VDB-l6Ru](https://www.instagram.com/p/De0VDB-l6Ru/) | 23/10/2026 | carrusel | Foco | «Mucha gente quiere verte fracasar para justificar los riesgos que eligió no tomar» | 6 | 52.925 | WIN |

## Verificación

Revisión crítica del 19/11/2026 sobre `reels.json`, `temas.json`, las transcripciones y las hojas de cuadros. Los números
salen de un script que recuenta el documento desde `reels.json` (y `meta.json` para los cortes y las transcripciones).

**Integridad.** 48 carpetas con `meta.json` y 48 filas en `reels.json`, una por carpeta, sin ids repetidos, numeradas de
1 a 48. Los 48 múltiplos coinciden con reproducciones ÷ 373.000.

**Temas, a ciegas.** Clasifiqué leyendo sólo la transcripción (con `resumen.py`) y las definiciones, sin mirar la columna
`tema`, y comparé después. La muestra pedida eran 21 reels: uno de cada tres (#1, 4, … 46) más los de los dos temas más
chicos y «otros» (#2, 8, 17, 26 y 27; elegidos por script sin mostrarme el tema de cada uno). Amplié a los 48. El #1 lo vi
antes de empezar y no cuenta: **reclasifiqué 47 a ciegas y coincidí en 45** (en la muestra pedida: 20 a ciegas, 19
coincidencias). Los dos desacuerdos caen en las fronteras que se esperaban:

1. **#9 «4 mitos del guion»: de «Cerrar la venta» a «Armar el equipo de ventas».** Los mitos son los de quien hace vender
   a otros («your rep's going to make one up», «no one can sell like me»), igual que el #24, que el relevo ya tenía en
   «Equipo».
2. **#34, el parque infantil resubido: de «Cerrar la venta» a «Más plata por cliente».** Es el mismo video que el fijado #1
   (los 32 cortes coinciden y comparten el 81 % de las secuencias de 4 palabras), que el relevo puso en «Más plata». La
   lección es venderle el cumpleaños a quien ya pagó la entrada; lo único que cambia es el cartel («I DON'T HAVE A SALES
   PROCESS..» en vez de «AM I SELLING THE WRONG THING?»). Un mismo video no puede tener dos temas.

Agregué a `temas.json` y a la tabla dos reglas de desempate: si la lección le sirve igual a quien vende sin equipo, es
«Cerrar la venta» (si necesita a otros vendiendo por ti, «Equipo»); si se le vende a quien ya es cliente, es «Más plata»,
diga lo que diga el cartel. Con ellas sólo se mueven esos dos. Coincidimos, con una segunda opción razonable, en 6 más que
no se mueven: #32 (arreglos de agenda «para tu equipo», pero le sirven a quien vende solo), #36 (el cuello de botella es
contratar vendedores: Foco o Equipo), #37 y #41 (precio: Cerrar o Más plata), #42 (editores para hacer anuncios:
Conseguir o Foco) y #44 (tutorías baratas y una beca como anuncio: Conseguir o Más plata).

- **Cerrar la venta: 17 → 15** (35 % → 31 %; mediana 373.000 en 15 → 379.000 en 13; 12 de los 15 son del estudio blanco).
- **Armar el equipo de ventas: 6 → 7** (12 % → 15 %; mediana 265.000 → 251.000; múltiplo 0,71 → 0,67).
- **Más plata por cliente: 4 → 5** (8 % → 10 %; mediana 263.000 en 3 → 318.000 en 4).
- Quedan igual Foco 9, Conseguir clientes 6, Gente que rinda 4 y otros 2.
- **Dos repeticiones que inflan los temas chicos:** #34 = #1 (Más plata: 4 lecciones en 5 reels) y #25 = la pregunta del
  #2 ampliada en el estudio (Gente: 3 lecciones en 4 reels). Ningún otro par comparte más del 17 % del texto.
- «Foco» mezcla 6 de negocio con 3 de disciplina personal (#33, #45, #47); lo dejé anotado en la tabla.

**Formas, mirando las hojas.** Miré 22 hojas: los 3 podcasts (#27, 30, 45), las 2 selfies (#8, 43), los 3 del estudio
oscuro (#21, 39, 47), las 2 clases (#17, 41), las 6 sueltas (#6, 22, 23, 25, 33, 46), 5 al azar con semilla fija (#1, 15,
20, 32, 36) y el #34. Las 22 formas están bien y los 22 `gancho_fin_s` caen en el final de la primera frase o en el corte
en que se va el cartel (±1 s). Cambió esto:

1. **#22: `ia_en_el_cuerpo` de false a true.** Las viñetas (de 1,5 a 15 s y en el 20) son ilustraciones de su personaje en
   escenas que no se filmaron (la calle de Las Vegas, el helicóptero por dentro); casi seguro IA, no se puede confirmar. El
   documento decía «no hay IA en ninguno»: ahora dice «probable en uno».
2. Sin cambio, pero anotado: la selfie #43 es el teléfono apoyado (se ven las dos manos contando), no en la mano como la
   #8; el grupo «selfie» quiere decir teléfono y una toma. El #45 tiene a Hormozi solo en cuadro, pero mira a alguien fuera
   de cámara frente al micrófono: sigue como podcast. Lo que se mueve en #20, #25 y #32 son dibujos e íconos de edición,
   no IA.

**Recuento contra el documento.** Coinciden con el script la ficha (48, 3 fijados, 45 en 21 días, 2,1 por día, 68 s,
373.000 en 41, 424.500, 532 comentarios, Spearman 0,48, 514.500 contra 298.000, 25 de 29 y 1 de 12), los moldes de gancho
con sus medianas, el cartel rojo (37 y 5), los títulos con número (20 de 42; 480.000 contra 355.500), la tabla de formas
salvo un valor, los talleres (6 de 13 con rotafolio, de 11,7 a 25,6 cortes, 8 sin CTA), el gancho (4,3 s, de 1,2 a 15,9),
la persona (46 de 48), el plano (28 y 19), el lugar, la luz, los subtítulos (37, 9, 2), los cortes (5,6; 6 en cero; 20 sobre
10), el fondo (30, 15, 3; -35 dB), el b-roll (34 y 14), el CTA entero (30; 21 y 9; las palabras; 43 en el texto; 94 %,
68,5 s; 16 de 21; 313.500 contra 658.000; 329.000 contra 879.000), los más comentados, los 5 mejores, los 4 que siguen y
los 10 de menor múltiplo (8 con CTA, 5 del estudio blanco). **Corregí 7 cosas:**

1. La tabla de temas y la tabla del final (#9 y #34), con las definiciones nuevas, y lo que depende de ellas: «12 de los
   15» del estudio blanco, el 31 % de «Qué le sirve» y el múltiplo 0,67 de «Equipo».
2. «Equipo»: los 7 son del lanzamiento, 6 del estudio blanco, fecha mediana 13/11 (no 11/11).
3. Selfie: múltiplo mediano 2,76, no 2,77 (1.030.500 ÷ 373.000 = 2,763).
4. Estudio blanco: fecha mediana 11/11 en los 19 (el 10/11 era la de los 17 maduros).
5. Fondo constante: los «4 sueltos» eran una de las 2 clases (#17) y 3 sueltos.
6. La IA del #22, en «Duración del gancho» y en «Qué le sirve».
7. Las notas de repetición en «Más plata» (#34 = #1) y en «Gente» (#25 = #2).

**Agregué** «Las formas y los temas a igual edad». Lo que cambia la lectura: **la ventaja del taller casi desaparece**
(×1,47 crudo; ×1,00 a ×1,18 en cada mitad; ×0,95 contra sus vecinos de fecha), el estudio blanco queda en ×0,90 a ×0,96
con o sin edad, y lo único que aguanta es el podcast (×2,3 a ×3,3, 3 reels) y el tema «Foco» (×1,8 a ×2,9, 8 reels), los
dos mezclados con la falta de CTA.

En `reels.json` corregí 3 filas (#9: `tema`; #34: `tema` y `subtema`; #22: `ia_en_el_cuerpo`), cada una con una nota
«Verificación 19/11». En `temas.json` agregué la regla de desempate a 3 definiciones (Cerrar, Equipo y Más plata).
