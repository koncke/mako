# Víctor Heras (@victorherasemprendedor): sus temas, sus ganchos y cómo está hecho cada reel

Relevo para que Martín elija los temas de su serie con avatar de IA. Todos los números salen de un script sobre
`C:/dev/referentes-videos/victor/reels.json` (una fila por reel, leída mirando la hoja de cuadros de cada uno) y
`temas.json` (la lista cerrada de temas con su definición). Las citas son cortas a propósito: no hay transcripciones acá.
Los «#n» son el número de orden de la tabla del final.

## Ficha

| | |
|---|---|
| Cuenta | [@victorherasemprendedor](https://www.instagram.com/victorherasemprendedor/) · 494 mil seguidores · español de España · bio: «El sistema para ganar 100.000 seguidores con tu cuenta de Instagram» |
| Reels mirados | 35 de los 36 de la pestaña Reels. DWb_L4GEdHP no bajó (Instagram lo restringe; 47,6K en la grilla) |
| Fechas | 2 reels **fijados** de 2024 (29/09 y 07/10/2024) y 33 del 08/01/2026 al 17/11/2026 |
| Cada cuánto publica | A rachas: 33 reels en 313 días (mediana: uno cada 3,5 días) con un hueco de 80 días entre enero y abril. De enero a julio, entre 0 y 3 por mes (febrero y marzo, ninguno de los bajados; el que no bajó cae en ese hueco); desde agosto, 7, 1, 6 y 8 por mes (noviembre, hasta el 17) |
| Duración mediana | 50,3 s (de 9,7 a 87,7). Los 27 con la voz de Víctor, 56,2 s; los 8 sin voz (montajes y sketches mudos), 14,2 s |
| Reproducciones medianas | **85.100** sin los fijados (de 13.000 a 1,9 M). Los fijados: 7,2 M y 1,9 M |
| Cómo se relevó | `yt-dlp` baja el video y el texto de la publicación; `ffmpeg` mide los cortes de escena y arma la hoja de cuadros; `faster-whisper` transcribe con el segundo de cada frase; `tools/audio.py` mide el fondo sonoro. Las reproducciones son las que mostraba la grilla de Instagram el 19/11/2026. Las 35 hojas se miraron una por una |

**Ojo al comparar reproducciones.** Los reels tienen edades muy distintas y los viejos tienen más (correlación de rangos
edad–reproducciones: 0,52). Los 12 de los últimos 30 días tienen mediana 49.300; los 21 anteriores, 156.000. Además,
desde agosto Víctor cambió de forma: 17 de los 22 reels de agosto a noviembre son a cámara, contra 2 de 11 de enero a
julio. Fecha y forma van juntas: la comparación a igual edad (abajo, en «Las formas de video» y en los temas) achica
mucho las diferencias. El múltiplo (reproducciones ÷ 85.100) ordena; no prueba.

## La receta en dos líneas

1. **Dos carriles.** A cámara (en un estudio oscuro o en el coche): una frase cruda de mentalidad o dinero en los primeros
   4 s, una lista de ejemplos y un cierre con su historia, casi siempre sin CTA. Y sketches con gente real y su lujo
   verdadero (jet, Ferrari, concesionario, falso noticiero) que viran a Víctor explicando en serio y cierran con
   «comenta RETO / CLASE / BERNARDO» para vender su método de seguidores.
2. **Lo que más se ve son los sketches y las provocaciones**, no la charla a cámara: los sketches tienen mediana 310.000;
   los a cámara, 59.800. Ojo: buena parte es edad; a igual edad la ventaja del sketch queda entre ×1,2 y ×2,4, no ×5
   (ver «Las formas de video»).

## Sus temas de siempre

Un tema es de qué habla (el dolor o la promesa), no el formato. Cada reel va en uno solo. Reproducciones medianas sin los
dos fijados (los dos son de «Ganar dinero con contenido»).

| Tema | Definición (para clasificar un reel nuevo) | Reels | % | Repro. medianas | Ejemplo | Por qué le pega a su público |
|---|---|---|---|---|---|---|
| **Mentalidad: miedo, riesgo y constancia** | Lo que frena por dentro a quien mira: miedo a fracasar o a perder, no intentarlo, no cumplir metas, rendirse; se responde con disciplina, constancia y su historia de antes y después. Si otras personas son sólo el marco de ese miedo (la madre que no creía), va acá; un montaje sin voz con una lección escrita, también | 10 | 29 % | 49.300 | [#17](https://www.instagram.com/reel/Dc6dMZnvxDE/) «El 99% del éxito…» (225K) | Le habla a gente joven con trabajos mal pagados (lo nombra en sus reels); el freno es el miedo y Víctor se pone de prueba: de repartir pizzas al Ferrari |
| **Lujo y humor de millonario** | Su vida (jet, Ferrari, compras caras) con humor, memes de tendencia, ironía ante la crítica o provocación política; sin lección ni oferta (si deja una lección, va a Mentalidad) | 8 | 23 % | 174.500 | [#35](https://www.instagram.com/reel/DTQghEPke4O/) «Cómo abren un Ferrari los de…» (742K) | Aspiración pura que se comparte; además es la prueba de que su método da plata |
| **Crecer en redes** | Ganar seguidores o viralizar una cuenta: el reto de 100.000 en 30 días, el caso de un cliente (Bernardo), la clase gratis; la promesa es la cifra de seguidores. Si el reel habla de seguidores y de dinero, decide lo que regala el CTA: el método de seguidores va acá | 5 | 14 % | **272.000** | [#31](https://www.instagram.com/reel/DXzUw8jthB3/) el robo del Ferrari (1,9 M) | Es su bio y su producto: una cifra concreta con un caso real. Ojo: los 5 son de abril a julio (viejos) |
| **Tu entorno** | Las personas de tu vida: amistades, pareja, quienes te critican, gente que te usa y el círculo que necesitas; con quién te juntas decide en quién te conviertes. Va acá cuando el tema son las otras personas, no el miedo propio | 5 | 14 % | 59.800 | [#19](https://www.instagram.com/reel/DctWos5x6zO/) «Mujeres bonitas hay en todas partes» (673K) | Lo social duele: las amistades que no avanzan, la pareja, quienes critican |
| **Ganar dinero con contenido** | El contenido como negocio: cuánto se gana haciendo videos para marcas o con una marca personal, por qué es la oportunidad del momento y lo que cobra Víctor; la promesa es dinero, no seguidores. Si habla también de seguidores, va acá sólo si el CTA regala cómo cobrar con contenido | 4 | 11 % | 41.750 (2; los 2 fijados: 7,2 M y 1,9 M) | [#2](https://www.instagram.com/reel/DAg2pofSqLD/) 200.000 € en un maletín (7,2 M, fijado) | Promete un oficio con el que se gana sin título ni capital, filmado desde un concesionario o un jet |
| **El dinero sí importa** | Defensa del dinero frente a quien dice que no importa: lo que cuesta ser pobre, la libertad que da, por qué unos ganan más (valor percibido) | 3 | 9 % | 85.700 | [#12](https://www.instagram.com/reel/DfDNJ5VPrMA/) coches que valen como una casa (195K) | Polémico y validante: le da permiso a quien quiere ganar más |

Todos los temas caben en la lista: no hizo falta «otros».

**A igual edad, el orden de los temas no se sostiene.** Los temas también van con la fecha: «Crecer en redes» (mediana de
202 días) y «Lujo y humor» (152) son viejos; «Mentalidad» (24) y «El dinero sí importa» (22), nuevos. Descontando la edad
de dos maneras (sin los fijados):

| Tema | Múltiplo contra los 6 reels más cercanos en fecha | A igual edad, contra Mentalidad (ajuste por edad) |
|---|---|---|
| El dinero sí importa (3) | 1,32 | ×2,0 |
| Lujo y humor de millonario (8) | 1,28 | ×2,7 |
| Ganar dinero con contenido (2) | 1,27 | ×0,7 |
| Tu entorno (5) | 1,26 | ×1,7 |
| Mentalidad (10) | 0,75 | ×1 |
| Crecer en redes (5) | 0,71 | ×3,3 |

Los dos métodos no coinciden en el orden (Crecer en redes queda último en uno y primero en el otro: sus vecinos en fecha
son los sketches viejos que más se vieron). Lo único que se repite: **Mentalidad queda entre los dos que menos rinden**.
Para elegir temas, la mediana cruda no alcanza; con 2 a 10 reels por tema, todo esto es una pista.

## Los ganchos que más repite

De 35 reels. Con 4 reels por molde, las medianas son una pista, no una ley.

| Molde | Veces | Citas | Qué se ve | Repro. medianas |
|---|---|---|---|---|
| **Afirmación tajante o cruda** | 5 | «Ser pobre es una mierda» (#7) · «Si todos tus amigos son gordos, terminarás siendo gordo» (#15) | Víctor a cámara con la frase escrita, o la frase actuada con extras | 348.000 |
| **Parodia o sketch con giro** | 4 | «Roban el Ferrari de más de 400.000 euros de un influencer de Miami» (#31) · «¿Qué empresa de alquiler de coche es tan rara?» (#34) | Falso noticiero con cámara de seguridad; detrás de cámaras con un cliente; ironía con el título del coche en la mano; un partido político por bloque | **507.000** |
| **El lujo como gancho** | 4 | «Tengo aquí 200.000 euros y me quiero comprar un coche» (#2) · «Voy a comprar las entradas para el Mundial» (#25) | Un maletín en un concesionario; la compra en el portátil; la cifra en verde | 283.000 (con un fijado; sin el fijado, 195.000) |
| **Promesa (número o profecía)** | 4 | «El 99% del éxito en la vida depende de tres cosas» (#17, #22) · «Vas a ser rico, y lo sé porque estás viendo este vídeo» (#32) | Estudio oscuro con micrófono; título fijo arriba | 144.750 |
| **Historia personal de antes y después** | 4 | «Este gordo de mierda era yo hace 3 meses» (#16) · «Un día llegué a casa y le dije a mi madre…» (#3) | Fotos de antes y después flotando sobre la cabeza; videos caseros de su pasado | 57.100 |
| **Contra la creencia común** | 4 | «La persona más peligrosa en tu vida no es la que te odia» (#23) | A cámara, en estudio o selfie | 46.000 |
| **Pregunta incómoda a quien mira** | 4 | «Si antes no lo tenías, ¿por qué ahora te da miedo perderlo?» (#9) · «Pero ¿qué pasa si me sale mal?» (#5) | A cámara; la pregunta en una caja blanca | 25.350 (la más floja) |
| **POV o meme de tendencia en texto** | 3 | «POV: tus amigos creen que estás de vacaciones desde 2021» (#6) | Montaje de lujo con canción y el texto fijo (#6, #10); en #28, POV de alguien que le da cosas raras | 85.100 |
| **Pregunta de un desconocido en la calle** | 2 | «Hey, perdona, perdona. ¿A qué te dedicas?» (#1) | Alguien para a Víctor en la calle o junto al jet y le pregunta qué hace o cuánto gana | 976.550 (con un fijado; el otro, 53.100) |
| **Escalera visual de números** | 1 | (sin voz) «1000 seguidores… 500.000 seguidores» (#33) | Víctor quieto; el coche de al lado mejora con cada cifra | 86.500 |

## Cómo está hecho

### Las formas de video

| Forma | Reels (de 35) | Repro. medianas | Cómo es |
|---|---|---|---|
| **Persona a cámara** | 19 | 59.800 | Estudio (10, 9 con micrófono de podcast; mediana 45.250), frente a su casa o sus coches (4; 126.300), selfie en el coche (3; 32.200), selfie en la calle (1), pantalla verde con fotos (1) |
| **Sketch o situación actuada con gente real** | 10 (8 sin fijados) | **310.000** sin fijados (359.500 con ellos) | Entrevista callejera armada (2), concesionario, falso noticiero, detrás de cámaras con un cliente, escenas con extras y voz en off, vlog de una compra, sketches mudos con texto (3: el diálogo en el jet, los partidos políticos, el POV de las cosas raras) |
| **Montaje sin voz: texto fijo + canción** | 5 | 54.600 | POV de lujo, meme de tendencia, antes y después con su archivo personal, frase provocadora bajando del jet |
| **Efecto visual** | 1 | 86.500 | El coche cambia con el contador de seguidores en un plano fijo |
| Gancho con avatar de IA, sketch entero con IA o explicación animada | **0** | — | No aparece ninguna de las tres formas de Ramiro |

Regla para separar sketch de montaje: si el remate está en lo que alguien hace o dice en una escena armada (aunque el
diálogo vaya escrito), es sketch; si son clips de su vida o de su archivo pegados bajo un texto y una canción, es montaje.

**A igual edad.** Los sketches son viejos (mediana de 152 días, contra 75 de los a cámara), así que la mediana cruda
(310.000 contra 59.800, ×5,2) exagera. Tres maneras de descontar la edad, sin los fijados:

| Forma | Reels | Repro. medianas | Enero a julio | Agosto a noviembre | Múltiplo contra sus 6 vecinos en fecha | A igual edad, contra a cámara (ajuste por edad) |
|---|---|---|---|---|---|---|
| Persona a cámara | 19 | 59.800 | 401.500 (2) | 59.600 (17) | 1,09 | ×1 |
| Sketch | 8 | 310.000 | 272.000 (7) | 348.000 (1) | 1,28 | ×2,4 |
| Montaje sin voz | 5 | 54.600 | 839.000 (1) | 49.300 (4) | 0,84 | ×1,5 |
| Efecto visual | 1 | 86.500 | 86.500 (1) | — | 0,20 | ×0,6 |

- **Por período** casi no hay con qué comparar: de enero a julio 7 de 11 son sketches; de agosto a noviembre, 17 de 22 son
  a cámara. En enero a julio la mediana de los 2 a cámara (#32 y #34, 401.500) supera la de los sketches (272.000); en
  agosto a noviembre el único sketch (#15, 348.000) tiene 5,8 veces la mediana de los a cámara.
- **Contra sus vecinos en fecha** (las reproducciones de cada reel ÷ la mediana de los 6 publicados más cerca): sketch
  1,28 contra 1,09 de los a cámara.
- **Ajuste por edad** (las reproducciones crecen ×1,3 cada vez que la edad se duplica; descontado eso): sketch ×2,4 contra
  a cámara.
- Conclusión: el sketch rinde más, pero entre ×1,2 y ×2,4, no ×5. Con 8 sketches es una pista, no una prueba.

**¿Usa IA? No, en nada de lo que se ve: 0 de 35.** El «gancho exagerado» Víctor lo hace con actores y su lujo real. El
falso noticiero del robo del Ferrari (#31) es el mismo molde que pidió Martín (11 s exagerados que se notan armados →
Víctor explica en serio → «comenta CLASE») y es su reel no fijado más visto (1,9 M; 22,3×). Las escenas con extras de
#15 (11,8 s de gancho con voz en off seria) son el otro caso. En el b-roll del estudio hay clips de cine reconocibles
(«El lobo de Wall Street», «El club de la pelea») y escenas en blanco y negro: no se ve en los cuadros si alguna es
generada. En la escalera de coches (#33) el coche cambia sin corte y Víctor sigue igual: composición o IA, no se
distingue.

### Gancho y paso a la persona

- **Duración del gancho:** mediana 5,8 s (de 1,8 a 19,3) en los 30 reels donde se puede medir. A cámara, 4,4 s (de 1,9 a
  12,4); en los sketches, 6,4 s (de 1,8 a 11,8). En los 5 montajes sin voz el video entero es el gancho.
- **Qué tiene de llamativo:** arranca hablando: en 26 de los 27 reels con su voz la primera palabra está en el segundo 0
  (el otro es la escalera de coches, que habla recién a los 19,3 s). En al menos 16 de 35 hay un título o texto fijo en
  pantalla («Si escuchas hasta el final vas a ser rico», «"Ferrari Alquilado"», el rótulo del noticiero).
- **Cuándo pasa a la persona:** en 19 Víctor habla a cámara desde el segundo 0. En 7 aparece después: mediana 19,3 s
  (de 2,1 a 66,3): a los 2,1 y 2,6 s en las entrevistas callejeras, 9,1 en el detrás de cámaras, 19,3 en la escalera,
  34,0 y 36,3 en las escenas con extras y el falso noticiero, 66,3 en el concesionario. En 9 nunca habla en serio
  (montajes, sketches mudos, el vlog de la compra).

### Plano, lugar, luz, subtítulos

- **Plano:** medio, sentado, en los 10 del estudio (con micrófono de podcast en 9; en #32, sin micrófono); selfie en 4; de pie a cámara con trípode,
  delante de sus coches, en 4. Vertical en 32; horizontal en 3 (#3, #12, #30).
- **Lugar:** estudio en 10 (5 oscuros con cuadros o cortina, 4 de fondo blanco o gris, 1 con ventanal y coches); el coche
  en 3; frente a su casa, sus coches o su garaje en 5; jet o pista de jets en 4.
- **Luz:** de estudio en 11; natural de día en 15; de noche en 2; interior artificial en 2; mezclada en 3 montajes y en 2
  sketches (#15, #28).
- **Subtítulos:** frase corta en blanco chico en 20 de 35 (al centro en 19; arriba en #13); palabra por palabra en 4 (los sketches con diálogo
  y #32); sin subtítulos (sólo texto fijo) en 8; otros 3 (palabra clave en MAYÚSCULAS condensadas en #15, rótulo de
  noticiero en #31, contador en #33). En el estudio, sobre el b-roll la frase pasa a grande en serif (8 de 10; en 5,
  mezclada con sans). Las cifras van en verde grande en los 2 fijados de 2024.

### Cortes, sonido y b-roll

- **Cortes por minuto:** mediana 10,3 (de 0 a 81,6). A cámara (verticales): 5,9; estudio: 10,4; sketches: 15,0; montajes:
  36,6. Ojo: el detector da 0 en 8 reels; 5 son de verdad un solo plano (#8, #13, #29, #33, #35), pero en #3, #30
  (horizontales) y #32 (enmarcado) la hoja muestra cambios de plano: las barras negras esconden el corte. Igual en #12
  (horizontal, 1 corte medido). En esos el número es un piso.
- **Fondo sonoro (medido):** 29 de 35 con fondo constante (música o ambiente), con el piso en -30,0 dB de mediana, unos
  12 dB debajo de la voz (de 2 a 16). 4 dudosos (piso de -40 a -44 dB): el concesionario (#2), una selfie en el coche
  (#5), el vlog (#25) y la entrevista del jet (#26). 2 salen «sin fondo» y no lo son: #29 (medio segundo mudo; el resto
  suena a -17 dB) y #33 (los primeros 19 s llegaron mudos en el archivo, seguramente una canción de Instagram que no se
  baja). Salvo #33, que no se puede medir, ningún reel con su voz baja a silencio limpio (-45 dB o menos) entre frases.
- **Ritmo de voz:** 3,25 palabras por segundo de mediana (de 1,25 a 4,0) en los 27 con su voz.
- **B-roll:** 30 de 35 insertan algo. Clips de cine o de stock oscuros en 9 de los 10 del estudio; fotos flotando sobre la
  cabeza en 4 (#4, #5, #8, #16); su archivo de antes y después en 6; capturas como prueba (transferencias, saldo, el
  perfil de Bernardo, el grupo de WhatsApp) en 6.

## Estructura típica por segundos

**A cámara, sin CTA** (16 reels, mediana 53,7 s): **0 a 4 s** gancho (frase cruda o pregunta, a veces escrita arriba) →
**4 a 22 s** lista de ejemplos o un dato (famosos que fallaron, un experimento, pares «difícil / más difícil») →
**22 a 38 s** giro o lección → **desde los 38 s** (68,3 % del video) cierre personal: su pasado (pizzas, 450 € al mes) o su
presente (el Ferrari). No pide nada.

**Con CTA** (9 reels, mediana 68,6 s; 5 son sketches): **0 a 8,7 s** gancho → planteo y prueba con cifras (lo que cobra,
seguidores ganados, un caso con nombre) → **CTA desde los 50,6 s** (mediana; el 84 % del video, de 53 % a 87 %), unos
10 s de CTA (de 5,5 a 32,3). En el falso noticiero el CTA empieza a mitad de video (53 %): la oferta (la clase gratis)
ocupa toda la segunda mitad.

## CTA

- **9 de 35 piden algo, y los 9 piden lo mismo: «comenta la palabra».** RETO 4, MARCA 2, VIRAL 1, BERNARDO 1, CLASE 1.
  26 no tienen CTA. Ninguno manda al link de la bio ni pide escribir por DM: el mensaje lo manda Víctor después del
  comentario.
- **Por tema:** tienen CTA los 5 de «Crecer en redes» y los 4 de «Ganar dinero con contenido»; ninguno de los otros 26.
- **Qué regala:** el grupo de WhatsApp del reto (#32, #33), la clase en directo (#31), la metodología del caso de Bernardo
  (#26, #30) y su método (#1, #2, #4, #21). Nunca hay precio; en #31 y #32 lo dice: es gratis.
- **La palabra va también en el texto de la publicación** en 8 de 9, y en la transcripción aparece 2 o 3 veces desde que
  empieza el CTA.
- **Hace comentar:** los 7 no fijados con CTA tienen mediana 758 comentarios (8,8 por cada 1.000 reproducciones); los 26
  sin CTA, 28 (0,39 por cada 1.000): 22,4 veces más por reproducción, con reproducciones parecidas (86.500 contra 74.800).

## Lo que mejor le funcionó

Los 5 de mayor múltiplo sin los fijados (mediana de la cuenta: 85.100).

| # | Reel | Múltiplo | Tema | Gancho |
|---|---|---|---|---|
| 31 | [01/05/2026](https://www.instagram.com/reel/DXzUw8jthB3/) · 1,9 M | 22,3× | Crecer en redes | Falso noticiero del robo de su Ferrari → persecución → Víctor explica la clase gratis («comenta CLASE») |
| 29 | [24/05/2026](https://www.instagram.com/reel/DYur-tjvboE/) · 839K | 9,9× | Lujo y humor | «Cuanto más dinero ganas, menos socialistas conoces» escrito mientras baja de un jet (10 s, sin voz) |
| 35 | [08/01/2026](https://www.instagram.com/reel/DTQghEPke4O/) · 742K | 8,7× | Lujo y humor | Sketch mudo «Cómo abren un Ferrari los de…», un partido por bloque |
| 19 | [31/08/2026](https://www.instagram.com/reel/DctWos5x6zO/) · 673K | 7,9× | Tu entorno | A cámara: «Siempre recuerda esto, mujeres bonitas hay en todas partes» (22 s) |
| 32 | [15/04/2026](https://www.instagram.com/reel/DXKExrOEx8_/) · 610K | 7,2× | Crecer en redes | A cámara: «Vas a ser rico…» con el título «Si escuchas hasta el final vas a ser rico» → reto 100k («comenta RETO») |

**Qué tienen en común:**
- Los 5 abren con algo exagerado o polémico en el segundo 0: un robo falso, política (2), un consejo sobre mujeres, una
  profecía. Ninguno es una pregunta a quien mira ni de «Mentalidad».
- Son más cortos que el resto: mediana 32,4 s contra 50,8 s.
- Los 2 con CTA venden lo mismo (el método de seguidores) y son los de más comentarios de los no fijados (14.830 y 2.785).
- Los 5 tienen 80 días o más: parte del múltiplo es tiempo acumulado.
- Fuera de la cuenta, los 2 fijados de 2024 (84,6× y 22,3×) también son sketches con lujo y «comenta RETO».

## Qué le sirve a Martín y qué no

1. **Sirve, y es su mejor reel: sketch exagerado → la persona real explica en serio → «comenta PALABRA».** Víctor hace el
   gancho con actores (11 s de falso noticiero, 22,3×); Martín puede hacerlo con su avatar de IA o su personaje en cubos
   (por ejemplo, un falso noticiero sobre alguien que vende coaching y pierde una venta por contestar tarde). A US$0,024 por segundo, un
   gancho de 11 s cuesta US$0,26 y uno de 15 s, US$0,36.
2. **Sirve: CTA de una palabra a cambio de algo gratis** (grupo, clase, caso). Saca 8,8 comentarios por cada 1.000
   reproducciones contra 0,39 sin CTA. En MaKo la palabra puede disparar el DM automático del chatbot.
3. **Sirve: el caso de un cliente con nombre como prueba y como palabra del CTA** («BERNARDO», #30: 3,2×, 2.571
   comentarios). Para MaKo, un caso de cliente con nombre y sus números de agenda y de cierres.
4. **No sirve: el lujo y la política como gancho.** A Víctor le rinden (9,9× y 8,7×) porque su público quiere hacerse rico;
   a quien vende high ticket (coaching, consultoría, mentorías) le convence más un número de su negocio (llamadas
   agendadas, ventas cerradas) que un Ferrari, y los partidos españoles no se trasladan.
5. **No sirve: la charla de mentalidad a cámara sin CTA.** Es lo que más publica desde agosto (17 de 22) y lo que menos
   rinde (estudio: 45.250; «pregunta incómoda»: 25.350; a igual edad, Mentalidad sigue entre los dos temas que menos
   rinden). Si Martín graba a cámara, que sea con el dolor de su cliente
   (agenda vacía, leads que no contestan, cierres que se caen) y con CTA; para la serie con avatar, el carril de los
   sketches.

## Tabla de todos los reels

| # | Link | Fecha | Reproducciones | Duración | Tema | Gancho (tipo y segundos) | CTA |
|---|---|---|---|---|---|---|---|
| 1 | [DA1ZY5ESsnU](https://www.instagram.com/reel/DA1ZY5ESsnU/) (fijado) | 07/10/2024 | 1.900.000 | 37,8 s | Ganar dinero con contenido | situación actuada, 0–5,0 s | RETO desde 32,3 s |
| 2 | [DAg2pofSqLD](https://www.instagram.com/reel/DAg2pofSqLD/) (fijado) | 29/09/2024 | 7.200.000 | 87,7 s | Ganar dinero con contenido | situación actuada, 0–3,9 s | RETO desde 76,6 s |
| 3 | [Df2iWtXvOlN](https://www.instagram.com/reel/Df2iWtXvOlN/) | 17/11/2026 | 59.600 | 70,4 s | Mentalidad: miedo, riesgo y constancia | a cámara, 0–8,5 s | — |
| 4 | [DfsTOp5vD6v](https://www.instagram.com/reel/DfsTOp5vD6v/) | 13/11/2026 | 66.300 | 72,7 s | Ganar dinero con contenido | a cámara, 0–8,7 s | MARCA desde 62,6 s |
| 5 | [DfnEGEfPcDq](https://www.instagram.com/reel/DfnEGEfPcDq/) | 11/11/2026 | 22.200 | 68,4 s | Mentalidad: miedo, riesgo y constancia | a cámara, 0–1,9 s | — |
| 6 | [Dfh7KqWvZ83](https://www.instagram.com/reel/Dfh7KqWvZ83/) | 09/11/2026 | 26.600 | 11,0 s | Lujo y humor de millonario | texto en pantalla, todo el video | — |
| 7 | [DffXLJyvXVg](https://www.instagram.com/reel/DffXLJyvXVg/) | 08/11/2026 | 38.900 | 33,4 s | El dinero sí importa | a cámara, 0–3,7 s | — |
| 8 | [DfaM1Bzxl0L](https://www.instagram.com/reel/DfaM1Bzxl0L/) | 06/11/2026 | 32.200 | 59,9 s | Mentalidad: miedo, riesgo y constancia | a cámara, 0–4,4 s | — |
| 9 | [DfVMQ4HPWCY](https://www.instagram.com/reel/DfVMQ4HPWCY/) | 04/11/2026 | 13.000 | 56,2 s | Mentalidad: miedo, riesgo y constancia | a cámara, 0–3,4 s | — |
| 10 | [DfP5SDSPMIq](https://www.instagram.com/reel/DfP5SDSPMIq/) | 02/11/2026 | 102.000 | 14,8 s | Lujo y humor de millonario | texto en pantalla, todo el video | — |
| 11 | [DfIEUdavs3f](https://www.instagram.com/reel/DfIEUdavs3f/) | 30/10/2026 | 54.600 | 20,8 s | Mentalidad: miedo, riesgo y constancia | texto en pantalla, todo el video | — |
| 12 | [DfDNJ5VPrMA](https://www.instagram.com/reel/DfDNJ5VPrMA/) | 28/10/2026 | 195.000 | 44,2 s | El dinero sí importa | a cámara, 0–9,6 s | — |
| 13 | [De-CSW3vRX8](https://www.instagram.com/reel/De-CSW3vRX8/) | 26/10/2026 | 85.700 | 33,5 s | El dinero sí importa | a cámara, 0–8,5 s | — |
| 14 | [De2EOyVvIrG](https://www.instagram.com/reel/De2EOyVvIrG/) | 23/10/2026 | 44.000 | 13,6 s | Mentalidad: miedo, riesgo y constancia | texto en pantalla, todo el video | — |
| 15 | [Der8y50vyd6](https://www.instagram.com/reel/Der8y50vyd6/) | 19/10/2026 | 348.000 | 50,3 s | Tu entorno | situación actuada, 0–11,8 s | — |
| 16 | [Dd9pHdwPaC9](https://www.instagram.com/reel/Dd9pHdwPaC9/) | 01/10/2026 | 93.600 | 76,8 s | Mentalidad: miedo, riesgo y constancia | a cámara, 0–12,4 s | — |
| 17 | [Dc6dMZnvxDE](https://www.instagram.com/reel/Dc6dMZnvxDE/) | 05/09/2026 | 225.000 | 86,6 s | Mentalidad: miedo, riesgo y constancia | a cámara, 0–3,3 s | — |
| 18 | [DcjlNo7PZL6](https://www.instagram.com/reel/DcjlNo7PZL6/) | 27/08/2026 | 23.500 | 22,9 s | Mentalidad: miedo, riesgo y constancia | a cámara, 0–2,9 s | — |
| 19 | [DctWos5x6zO](https://www.instagram.com/reel/DctWos5x6zO/) | 31/08/2026 | 673.000 | 21,7 s | Tu entorno | a cámara, 0–3,4 s | — |
| 20 | [DcmNX9jPL30](https://www.instagram.com/reel/DcmNX9jPL30/) | 28/08/2026 | 59.800 | 22,7 s | Tu entorno | a cámara, 0–9,2 s | — |
| 21 | [DcbtsZ1vwVf](https://www.instagram.com/reel/DcbtsZ1vwVf/) | 24/08/2026 | 17.200 | 60,6 s | Ganar dinero con contenido | a cámara, 0–3,7 s | MARCA desde 50,6 s |
| 22 | [DcZBsS7AcG4](https://www.instagram.com/reel/DcZBsS7AcG4/) | 23/08/2026 | 64.500 | 85,6 s | Mentalidad: miedo, riesgo y constancia | a cámara, 0–3,1 s | — |
| 23 | [DcE2zo9Pfgw](https://www.instagram.com/reel/DcE2zo9Pfgw/) | 15/08/2026 | 30.700 | 64,3 s | Tu entorno | a cámara, 0–5,9 s | — |
| 24 | [Db8ouXqgYLT](https://www.instagram.com/reel/Db8ouXqgYLT/) | 12/08/2026 | 28.500 | 51,3 s | Tu entorno | a cámara, 0–6,1 s | — |
| 25 | [Da8pWRUPhno](https://www.instagram.com/reel/Da8pWRUPhno/) | 18/07/2026 | 371.000 | 31,7 s | Lujo y humor de millonario | situación actuada, 0–2,2 s | — |
| 26 | [DansxJ5R9CS](https://www.instagram.com/reel/DansxJ5R9CS/) | 10/07/2026 | 53.100 | 69,3 s | Crecer en redes | situación actuada, 0–5,7 s | VIRAL desde 59,4 s |
| 27 | [DZ755ukhsc5](https://www.instagram.com/reel/DZ755ukhsc5/) | 23/06/2026 | 156.000 | 9,7 s | Lujo y humor de millonario | situación actuada, 0–1,8 s | — |
| 28 | [DZqADM3SXD2](https://www.instagram.com/reel/DZqADM3SXD2/) | 16/06/2026 | 85.100 | 56,7 s | Lujo y humor de millonario | situación actuada (sketch mudo), 0–7,0 s | — |
| 29 | [DYur-tjvboE](https://www.instagram.com/reel/DYur-tjvboE/) | 24/05/2026 | 839.000 | 10,1 s | Lujo y humor de millonario | texto en pantalla, todo el video | — |
| 30 | [DX4rykXv0ia](https://www.instagram.com/reel/DX4rykXv0ia/) | 03/05/2026 | 272.000 | 77,1 s | Crecer en redes | situación actuada, 0–9,1 s | BERNARDO desde 51,6 s |
| 31 | [DXzUw8jthB3](https://www.instagram.com/reel/DXzUw8jthB3/) | 01/05/2026 | 1.900.000 | 68,6 s | Crecer en redes | situación actuada, 0–11,0 s | CLASE desde 36,3 s |
| 32 | [DXKExrOEx8_](https://www.instagram.com/reel/DXKExrOEx8_/) | 15/04/2026 | 610.000 | 54,9 s | Crecer en redes | a cámara, 0–10,4 s | RETO desde 38,3 s |
| 33 | [DW4OVoLkUH5](https://www.instagram.com/reel/DW4OVoLkUH5/) | 08/04/2026 | 86.500 | 28,0 s | Crecer en redes | efecto visual, 0–19,3 s | RETO desde 19,3 s |
| 34 | [DTqYYVBj0NF](https://www.instagram.com/reel/DTqYYVBj0NF/) | 18/01/2026 | 193.000 | 26,5 s | Lujo y humor de millonario | a cámara, 0–2,3 s | — |
| 35 | [DTQghEPke4O](https://www.instagram.com/reel/DTQghEPke4O/) | 08/01/2026 | 742.000 | 32,4 s | Lujo y humor de millonario | situación actuada, 0–8,0 s | — |

## Verificación

Revisión crítica del 19/11/2026 sobre `reels.json`, `temas.json`, las transcripciones y las hojas de cuadros. Los números
salen de un script que recuenta el documento entero desde `reels.json` (más `meta.json`, `audio.json` y `lista-ig.json`).

**Integridad.** 35 carpetas con `meta.json` y 35 filas en `reels.json`, una por carpeta, sin ids repetidos y en el mismo
orden que `urls.txt`. DWb_L4GEdHP no tiene datos (47,6K en la grilla). La fecha, la duración, los cortes por minuto y las
reproducciones de cada fila coinciden con `meta.json` y la grilla.

**Temas, a ciegas.** Clasifiqué los reels leyendo sólo la transcripción (con `resumen.py`) y las definiciones, sin mirar la
columna `tema`, y comparé después; en los que no tienen voz o hablan tarde miré la hoja (#6, 10, 11, 14, 27, 28, 29, 33,
35). La muestra
pedida eran 16 reels (uno de cada tres, los n.º 1, 4, … 34, más todos los de los dos temas más chicos: #7, 12, 13 y #30 a
33); amplié a los 35, porque para saber cuáles son los de los temas chicos había que mirar la columna. Los n.º 1 y 2 los vi
antes de empezar y no cuentan: **reclasifiqué 33 a ciegas y coincidí en 32** (en la muestra pedida: 15 a ciegas, 15
coincidencias). El único desacuerdo es el **#26** (la entrevista junto al jet): el relevo lo puso en «Ganar dinero con
contenido» y yo en «Crecer en redes». Las dos definiciones le calzan: habla de lo que cobra por cliente (100.000 dólares)
y cierra regalando la metodología con la que Bernardo ganó 800.000 seguidores («comenta VIRAL»). Cambié las dos
definiciones en `temas.json` y en la tabla con una regla de desempate (si habla de dinero y de seguidores, decide lo que
regala el CTA) y reclasifiqué con ella: sólo se mueve el #26.

- **Crecer en redes pasó de 4 a 5** (11 % → 14 %; mediana de 441.000 → 272.000; ahora van de abril a julio).
- **Ganar dinero con contenido pasó de 5 a 4** (14 % → 11 %; mediana sin fijados de 53.100 en 3 → 41.750 en 2).
- Los demás quedan igual: Mentalidad 10, Lujo y humor 8, Tu entorno 5, El dinero sí importa 3.
- Coincidimos, pero con una segunda opción razonable, en 7 reels más: #3 (Mentalidad o Tu entorno: la madre que no
  creía), #11 y #14 (Mentalidad o Lujo: montajes de antes y después), #19 y #20 (Tu entorno o Mentalidad), #24 (Tu entorno
  o El dinero sí importa) y #32 (Crecer en redes o Ganar dinero: abre con «Vas a ser rico»). Agregué a `temas.json` la
  regla que los decide (Tu entorno sólo si el tema son las otras personas; un montaje con lección escrita va a
  Mentalidad); con ella ninguno se mueve.

**Formas, mirando las hojas.** Miré la hoja de los 9 que el relevo marcó como sketch (#1, 2, 15, 25, 26, 27, 30, 31 y 35),
de 5 a cámara al azar (con semilla fija: #4, 17, 19, 24 y 32) y de los 6 montajes y el efecto que ya había mirado para el
tema: 21 hojas. Cambió esto:

1. **#28 pasó de montaje a sketch.** «Dándole cosas raras a mi jefe»: alguien en primera persona le da cosas raras a
   Víctor en la pista del jet, el campo de tiro, el bar y el gimnasio, y él reacciona. Es una escena armada con remate,
   como los otros dos sketches mudos (#27, #35); los montajes pegan clips de su vida bajo un texto. Dejé la regla escrita
   debajo de la tabla de formas. Montaje: 6 → 5 (mediana 69.850 → 54.600). Sketch: 9 → 10 (mediana sin fijados 348.000 →
   310.000; con fijados 371.000 → 359.500). Su `gancho_fin_s` quedó en 7,0 (el primer corte, 6,97 s).
2. **#27, `gancho_fin_s` de 2,5 a 1,8:** la pregunta termina en el corte medido de 1,8 s; 2,5 era el cuadro de la hoja.
3. Las demás formas, `gancho_fin_s` y `paso_a_persona_s` están bien: caen en el final de la frase o en un corte medido.
4. **IA: 0 confirmado** en las 21 hojas: ningún avatar, ningún sketch generado, ninguna explicación animada. Lo que no se
   distingue en los cuadros sigue igual: las imágenes de cámara de seguridad del #31, el cambio de coche del #33
   (composición o IA) y algunas fotos de b-roll del estudio (#9, el paisaje del #19, las fotos en blanco y negro del #24).
   Lo que se mueve en pantalla (la caja de comentario, las capturas que aparecen) es edición, no animación explicativa.

**Recuento contra el documento.** Coinciden con el script la ficha (313 días, uno cada 3,5, hueco de 80 días, los reels
por mes, 50,3 s, 56,2 y 14,2 s, 85.100, Spearman 0,52, 49.300 contra 156.000, 17 de 22 y 2 de 11), los 10 moldes de
gancho con sus medianas, los a cámara (19, 59.800, sus 5 variantes), el paso a la persona (19, 7 con mediana 19,3, 9), la
primera palabra (26 de 27), los horizontales, el lugar, la luz, los subtítulos palabra por palabra (4) y sin subtítulos
(8), los cortes (10,3; 5,9; 10,4; 8 en cero), el fondo (29, 4 dudosos, 2 «sin fondo», 12 dB), el ritmo (3,25), el b-roll
(30), la estructura (16 a cámara sin CTA, 53,7 s; 9 con CTA, 68,6 s, CTA desde 50,6 s, 84 %, 10 s), el CTA (9, las
palabras, 8 de 9 en el texto, 758 contra 28 comentarios, 86.500 contra 74.800) y los 5 mejores con sus múltiplos.
**Corregí 12 cosas:**

1. La tabla de temas (el #26), con la definición nueva.
2. La tabla de formas, la duración del gancho (5,8 s en 30; sketches 6,4 s, de 1,8 a 11,8) y la tabla del final (#27 y
   #28).
3. Fondo sonoro: el piso mediano es -30,0 dB, no -32,5. El -32,5 era la mediana de los 35 audios, contando los 4 dudosos
   y los 2 «sin fondo»; en los 29 con fondo constante da -30,0.
4. Estructura a cámara: el cierre arranca en el 68,3 % del video, no 68,5 %.
5. Comentarios con CTA: 22,4 veces más por reproducción, no 22,5 (el 22,5 salía de dividir los valores redondeados).
6. Estudio: micrófono de podcast en 9 de 10 (en #32 no hay).
7. Subtítulos del estudio: la frase grande en serif está en 8 de 10, pero mezclada con sans sólo en 5.
8. Frase corta en blanco chico: al centro en 19 y arriba en #13 (no 20 al centro).
9. Cortes por minuto: sketches 15,0 (no 18,5) y montajes 36,6 (no 29,4), por el cambio del #28.
10. Luz mezclada: 3 montajes y 2 sketches (antes 4 y 1), por el #28.
11. CTA por tema: 5 de «Crecer en redes» y 4 de «Ganar dinero con contenido».
12. La receta y el aviso de edad: la mediana del sketch (310.000) y que la ventaja se achica a igual edad.

**Agregué** la comparación de formas a igual edad (en «Las formas de video») y la de temas (debajo de la tabla de temas).
Lo que cambia la lectura: la ventaja del sketch baja de ×5,2 en crudo a entre ×1,2 y ×2,4, y el orden de los temas
depende del método; sólo se sostiene que Mentalidad queda entre los dos que menos rinden.

En `reels.json` corregí 3 filas (#26: tema; #27: `gancho_fin_s`; #28: `gancho_tipo`, `formato` y `gancho_fin_s`), cada
una con una nota «Verificación 19/11». En `temas.json` agregué la regla de desempate a 5 de las 6 definiciones.
