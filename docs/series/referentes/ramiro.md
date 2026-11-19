# Ramiro Cubría (@ramiro.cubria): sus temas, sus ganchos y cómo está hecho cada reel

Relevo para que Martín elija los temas de su serie con avatar de IA. Todos los números salen de un script sobre
`C:/dev/referentes-videos/ramiro/reels.json` (una fila por reel, leída mirando la hoja de cuadros de cada uno) y
`temas.json` (la lista cerrada de temas con su definición). Las citas son cortas a propósito: no hay transcripciones acá.

## Ficha

| | |
|---|---|
| Cuenta | @ramiro.cubria · 531 mil seguidores · español rioplatense («vos») · vende su programa y su mentoría 1 a 1 a coaches, mentores e infoproductores |
| Reels mirados | 50: los más nuevos de la grilla, publicados del 07/11 al 19/11/2026 |
| Cada cuánto publica | 3,8 reels por día (entre 1 y 5 por día); la mitad de las veces pasan menos de 3,9 h entre uno y otro |
| Duración mediana | 86 s (de 28 a 167) |
| Reproducciones medianas | **18.700** en los 40 reels con más de 48 h. Los 10 del 17 al 19/11 todavía juntan reproducciones (mediana 8.750): no entran en las medianas por tema ni por forma, ni en el múltiplo |
| Comentarios | mediana 31 por reel; los animados sobre Claude, de 896 a 3.679 |
| Cómo se relevó | `yt-dlp` baja el video y el texto de la publicación; `ffmpeg` mide los cortes de escena y arma la hoja de cuadros; `faster-whisper` transcribe con el segundo de cada frase; `tools/audio.py` mide el fondo sonoro. Las reproducciones son las que mostraba la grilla de Instagram el 19/11/2026. Las 50 hojas se miraron una por una |

## La receta en dos líneas

1. Habla siempre de los **mismos 6 temas** (Ramiro lo dice en varios reels: «los mismos 6 o 7 temas») y los cambia de
   envoltorio: 8 formas de video, casi 4 por día, y en 34 de 50 cierra con «comentá PALABRA» a cambio de un regalo por DM.
2. Lo que más se ve **no es Ramiro hablando**: los sketches enteros con su avatar de IA y las animaciones hechas con Claude
   rinden casi el doble de su mediana; la pizarra y las llamadas, casi la mitad de lo que sube, quedan por debajo.

## Sus temas de siempre

Un tema es de qué habla (el dolor o la promesa), no el formato. Cada reel va en uno solo. Reproducciones medianas sobre los
reels con más de 48 h (entre paréntesis, cuántos son).

| Tema | Definición (para clasificar un reel nuevo) | Reels | % | Repro. medianas | Ejemplo | Por qué le pega a su público |
|---|---|---|---|---|---|---|
| **Ballenas, no quebrados** (nicho y ángulos) | Te escriben curiosos y quebrados porque tu contenido es viral o genérico; la promesa es anicharte y hablar con ángulos (un paradigma nuevo para el problema de siempre) que atraen a quien paga de 3.000 a 10.000 por adelantado | 14 | 28 % | 14.900 (11) | [#30](https://www.instagram.com/reel/Dfn3e1YgCUi/) | Es el dolor de todos los días: la bandeja llena de gente que pregunta el precio y no paga |
| **La IA (Claude) hace el trabajo** | Producir contenido o contestar mensajes te obliga a pagar editor, setters o agencia; la promesa es que Claude edite, anime, publique y filtre los mensajes por vos | 9 | 18 % | 29.500 (6) | [#36](https://www.instagram.com/reel/Dfk06zNGQZo/) | Ahorra el costo más visible (el editor, el setter) y es novedad; regala la herramienta, y eso dispara los comentarios (mediana 896) |
| **Follow me ads y anuncios** | Los anuncios te salen caros o te traen gente que no califica; la promesa es correr bien follow me ads, retargeting o reconocimiento: qué contenido promocionar, qué KPI mirar, qué reglas poner | 8 | 16 % | 14.800 (6) | [#35](https://www.instagram.com/reel/DflOHziDDVV/) | Muchos ya pagan anuncios y ven subir el costo por seguidor; les habla con sus números (KPI según el ticket) |
| **Sistema de adquisición** (embudo, webinars, historias) | Tu audiencia mira pero no agenda llamadas calificadas; la promesa es el camino completo para convertirla: embudo TOFU-MOFU-BOFU, webinars, historias y retargeting. Incluye la receta de punta a punta («mismos temas + follow me ads + webinars») aunque no nombre el embudo | 7 | 14 % | 13.300 (7) | [#17](https://www.instagram.com/reel/DfvwqMQDDyi/) | Le da un mapa a quien tiene seguidores pero no llamadas |
| **Rentabilidad** (margen, backend, plata perdida) | Facturás pero te queda poco, o seguís pagando algo que no te da resultados; la promesa es margen de 70 %, vender más a los clientes que ya tenés y una base orgánica que abarata los anuncios | 6 | 12 % | 14.900 (5) | [#50](https://www.instagram.com/reel/DfbMdVPTRu8/) | Toca el ego: «vos mostrás facturación, yo muestro ganancia» |
| **Trazabilidad: qué contenido trae plata** | Subís contenido todos los días y no sabés cuál vende; la promesa es medir leads, llamadas y cash por cada pieza (su CRM). Va acá sólo si el reel nombra o muestra la medición: «hablo siempre de los mismos 6 o 7 temas» solo no alcanza, porque Ramiro lo dice en reels de varios temas | 5 | 10 % | **55.250** (4) | [#39](https://www.instagram.com/reel/Dfi5E4sioYt/) | Quien ya publica y no vende siente que trabaja gratis; la promesa es dejar de adivinar |
| otros | Lo que no habla de un dolor del cliente (estilo de vida, presumir sin método) | 1 | 2 % | 48.200 (1) | [#22](https://www.instagram.com/reel/Dfs0Oh2kkVD/) | — |

Ojo al comparar: 4 de los 5 reels de trazabilidad son sketches enteros con IA, la forma que mejor le rinde, y son justo
sus 4 reels maduros (el quinto, el actuado del Rolls, todavía no tiene 48 h). Con 40 reels maduros **no se puede separar el efecto del
tema del de la forma**.

## Los ganchos que más repite

El molde es la idea del arranque, en abstracto. Reproducciones medianas sobre los reels con más de 48 h.

| Molde | Veces | Repro. medianas | Una cita | Qué se ve |
|---|---|---|---|---|
| Contra la creencia común | 8 | 14.700 | «Mientras más seguidores tenés, más estoy dispuesto a apostar que sos un quebrado» | selfie con la frase escrita en una caja arriba |
| Respuesta suelta de una llamada, con título | 8 | 16.300 | «inflamación es un ángulo de descubrimiento» | cuadro 16:9 de videollamada con un título fijo arriba, en blanco y amarillo |
| «Cómo hacer X» + tutorial paso a paso | 7 | 29.400 | «¿Cómo editar un video con Claude? Es facilísimo, son solamente 7 pasos.» | animación limpia donde el título se escribe solo; 6 de 7 son sobre IA |
| Parodia de película o escena absurda | 7 | 35.050 | «Mañana, uno de ustedes me va a traicionar» | escena de cine generada con IA (la Última Cena, el Papa, una batalla de rap, Nvidia) |
| Cifra de resultado + «te explico mi sistema» | 6 | 11.800 | «Estrategia de historias de 4.7 millones de dólares» | Ramiro a cámara con un titular enorme y la cifra entre paréntesis, o la cifra encerrada en la pizarra |
| Metáfora de animales para tipos de cliente | 4 | 14.050 (sólo 2 maduros) | «Su contenido, ¿te trae mutantes o te trae...?» | ballena en la pileta, mutantes, alienígenas, un zombie: el cliente que paga contra el que no |
| Dolor concreto: «si te pasa X» | 4 | 17.550 | «Cuando se te llena de mierda la bandeja» | pizarra o llamada con el problema como título |
| Imitar al cliente (su queja u objeción) | 4 | 24.650 | «Necesito contratar una agencia que me haga el contenido» | selfie lloriqueando con la frase del cliente arriba, o el cliente furioso en animación tipo Pixar |
| Credenciales de autoridad | 2 | 66.500 (1 maduro) | «Tengo 500.000 seguidores. Mentira. Verdad.» | un Rolls Royce y un disfraz de rico; o un jet con un «detector de mentiras» |

Condimento que atraviesa todo: **14 de 50 dicen una palabrota en los primeros 10 s** (13 sin contar «carajo») y 34 de 50
en algún momento.

## Cómo está hecho

### Las formas de video

| Forma | Reels (de 50) | Repro. medianas (maduros) | Múltiplo mediano | Gancho (mediana) | Cortes/min | Comentarios (mediana) |
|---|---|---|---|---|---|---|
| Pantalla dividida: pizarra arriba, Ramiro abajo | 12 | 13.300 (9) | 0,7 | 9,2 s | 2,0 | 39 |
| Recorte de llamada (16:9 con título) | 12 | 14.200 (10) | 0,8 | 4,7 s | 0,0 | 0 |
| **Sketch entero con IA** | 8 | **35.050** (8) | **1,9** | 13,8 s | 13,8 | 131 |
| **Animado (motion graphics hecho con Claude)** | 5 | **38.750** (4) | **2,1** | 4,8 s | 0,0 | **1.443** |
| A cámara (selfie) | 5 | 13.950 (4) | 0,8 | 9,1 s | 0,7 | 11 |
| Gancho actuado sin IA + a cámara | 4 | 19.700 (3) | 1,1 | 21,8 s | 2,2 | 55 |
| Gancho con IA + persona | 3 | 10.900 (1) | 0,6 | 29,0 s | 10,7 | 22 |
| B-roll de estilo de vida con texto | 1 | 48.200 (1) | 2,6 | 7,0 s | 18,6 | 39 |

- **Gancho con IA y después Ramiro a cámara** (3: la [ballena en la pileta](https://www.instagram.com/reel/Df6GECpzVY8/), el
  [béisbol](https://www.instagram.com/reel/Df4kgp-Trlk/) y los [mutantes](https://www.instagram.com/reel/Dfe0JRHD2PM/)). Los tres
  en el mismo deck de madera con pileta. En los cuadros se ve **rodaje real con un elemento generado encima** (en el de béisbol
  se ve la sombra del trípode, y la pantalla y el lanzador aparecen y desaparecen entre cuadros), no un avatar entero. Ramiro
  está en cuadro desde el segundo 0 en los tres; en el de béisbol ya habla en serio a cámara desde el 13, dentro de la escena. El gancho dura 23 a 31 s, no 10 a 15, y la IA vuelve en el cuerpo (la
  ballena sigue en la pileta detrás de Ramiro; inserts animados). Es lo más nuevo de su feed: 2 de los 3 son de las últimas 48 h,
  y el único maduro dio 0,6 veces su mediana.
- **Sketch entero con IA** (8). El avatar de Ramiro en 7 de 8, en estilos distintos: cine realista en 16:9 (la Última Cena, el Papa, el
  jet, la batalla de rap), caricatura 2D sobre fondos reales, Pixar 3D y **low-poly de bloques en el de Nvidia** (lo más parecido
  a un personaje en cubos). En el del zombie la IA es el otro personaje y Ramiro aparece filmado. Duran 55 a 138 s (mediana 91)
  y en 5 de 8 el CTA es una línea del diálogo: otro personaje pregunta «¿y dónde consigo eso?» y el avatar contesta «comentá…».
  En los cuadros no se ve con qué herramienta los hace; la publicación del Papa aclara «Ficción 100% generada con IA».
- **Animado** (5, todos sobre Claude). Gráficos limpios estilo app, sin persona; voz en off y un giro al final: «este reel lo
  hizo Claude». Es la forma más corta (mediana 45 s) y la de más comentarios. No se ve en los cuadros si la voz es la de Ramiro
  o generada.
- **Pantalla dividida** (12). Arriba una pizarra animada de hoja cuadriculada, marcador rojo que encierra y verde para lo bueno;
  abajo Ramiro escribe en la tablet sin mirar a cámara (7), o arranca 10 a 15 s a cámara con un titular enorme y después pasa a
  la pizarra (3), o habla a cámara abajo (2). Es la forma más larga (mediana 135 s) y las 12 tienen CTA.
- **Recorte de llamada** (12). Un pedazo de una videollamada, 16:9 dentro del vertical, con otra persona en cuadro (8) o sólo
  Ramiro (4). Ninguno de los 12 tiene CTA y la mediana de comentarios es 0.
- **A cámara** (5) y **gancho actuado sin IA** (4): selfie en casa o en el auto; el actuado arranca imitando al cliente (con un
  filtro que deforma la cara, o lloriqueando) o disfrazado de rico con un Rolls, y entre el segundo 7 y el 29 pasa a hablar en serio.

### Duración del gancho y qué tiene de exagerado

- Mediana **7,2 s** (de 2,5 a 32). Por tipo: animado 4,8 s · llamada 4,7 · titular en pizarra 6,6 · a cámara 9,9 · sketch con
  IA 13,8 · actuado 21,8 · **gancho con IA + persona 29,0** (23 a 31).
- Lo exagerado no es un efecto: es **la metáfora hecha imagen** (la ballena es el cliente que paga; los mutantes y alienígenas,
  los quebrados) o **una escena absurda que trae el consejo puesto** (en el béisbol, la pantalla gigante dice «no uses setters,
  usá Claude»). En el de la ballena, los primeros 6 s son pura imagen, sin una palabra.

### Cuándo pasa a la persona

- En **29 de 50** Ramiro está hablando desde el segundo 0.
- En **7** arranca con IA o actuación y pasa a Ramiro en serio en el segundo **23** (mediana; de 7 a 37).
- En **14** nunca aparece hablando en serio: los 8 sketches, los 5 animados y el de estilo de vida.
- Otra cosa es si **Ramiro está filmado** (columna `persona_real_desde_s`): sí, desde el segundo 0, en **38 de 50**; nunca en
  **12** (los 7 sketches con su avatar y los 5 animados). En los 3 ganchos con IA y en el sketch del zombie está filmado desde
  el 0 y la IA es un elemento encima: el «paso a la persona» de arriba es cuando termina la escena con IA, no cuando aparece.

### Plano, lugar, luz, subtítulos, cortes, sonido, b-roll, formato

- **Plano y lugar:** el escritorio de madera con lámparas de pie de su estudio (10, la pizarra), videollamadas (11), selfies en
  un interior con escalera (4), el auto (2 más el del disfraz), el deck y el jardín (5) y escenarios generados (7).
- **Luz:** natural de día 19 · cálida de estudio 10 · cálida de interior 7 · generada 7 · atardecer 2 · no aplica (animados) 5.
- **Subtítulos: en los 50.** Cada forma tiene el suyo: palabra por palabra en caja negra o amarilla sobre la línea divisoria
  (pantalla dividida, 12); amarillo en cursiva abajo más el título fijo arriba (llamadas, 12); frases en blanco abajo más la frase
  gancho en una caja arriba los primeros segundos (selfies, 8); palabras grandes con color o brillo (ganchos con IA y actuados, 7);
  chicos, tipo película (sketches, 6); palabra por palabra en negro (animados, 5).
- **Cortes por minuto:** mediana 1,25. Casi todo es plano continuo: 16 de 50 no tienen ningún corte. Cortan mucho el sketch con IA
  (13,8 por minuto), el gancho con IA (10,7) y el estilo de vida (18,6). *Los 5 sketches horizontales se recontaron sin franjas:
  la medición automática daba 0 a 1,4 por minuto y el conteo real es 4 a 26.*
- **Fondo sonoro (medido):** 48 de 50 tienen un fondo constante debajo de la voz (piso mediano -31 dB, la voz unos 14 dB
  arriba). La medición no distingue música de ambiente. Sólo 2 tienen silencio entre frases: dos animados de Claude.
- **B-roll:** 24 de 50 insertan algo: capturas de perfiles y resultados de clientes, del administrador de anuncios o del CRM, la
  tapa del regalo al final, inserts animados. Al menos 12 nombran a «mi cliente» con sus cifras.
- **Formato:** 45 verticales; 5 horizontales (los sketches de cine), que se suben con franjas negras.

## Estructura típica por segundos

De las medianas de los 50:

- **0 a 7 s — gancho.** Si es un gancho con IA, hasta el 29.
- **Persona:** desde el 0 en 29 de 50; si arranca con otra cosa, entra en el 23.
- **7 a 85 s — desarrollo:** planteo, un caso de cliente con cifras o sus propios números, y los pasos (en la pizarra, numerados).
- **Desde el 85 s — CTA** (de 32 a 159): empieza en el 90 % del video (entre el 66 y el 96 %) y dura unos 9 s.
- **Final: 86 s.**

## CTA

- **34 de 50 (68 %): «comentá PALABRA»**, y el texto de la publicación repite «Comentá PALABRA ⤵️» en esos 34 y en ninguno más.
  Los 16 sin CTA son los 12 recortes de llamada, 3 selfies y 1 actuado.
- **Palabras:** SOP 8 · BALLENA 4 · CRM 4 · IA 3 · CLASE 3 · YO 2 · CURSO 2 · AGENTE, SKILL, NVIDIA, SISTEMA, INSTAGRAM,
  EDITAR, REEL y GALO, 1 cada una. La palabra nombra el regalo: un SOP, una clase, la plantilla del CRM, una skill.
- 13 de los 34 dicen en voz que lo manda por mensaje privado o DM, y 7 «en menos de un minuto».
- Con CTA, mediana de 24.100 reproducciones (maduros) y 62,5 comentarios; sin CTA, 14.900 y 2.

## Lo que mejor le funcionó

Múltiplo = reproducciones ÷ 18.700 (su mediana). Sólo reels con más de 48 h.

| # | Reel | Múltiplo | Repro. | Tema | Gancho |
|---|---|---|---|---|---|
| 36 | [Dfk06zNGQZo](https://www.instagram.com/reel/Dfk06zNGQZo/) | 6,3 | 118.000 | La IA hace el trabajo | animado: «cómo editar un video con Claude», 7 pasos; CTA EDITAR (1.443 comentarios) |
| 39 | [Dfi5E4sioYt](https://www.instagram.com/reel/Dfi5E4sioYt/) | 4,7 | 87.600 | Trazabilidad | sketch IA de cine: el Papa ordena buscar a Ramiro; CTA CRM |
| 34 | [DflavpUisyG](https://www.instagram.com/reel/DflavpUisyG/) | 3,9 | 73.500 | Trazabilidad | sketch IA tipo Pixar: el cliente furioso con sus leads; CTA CRM |
| 21 | [DftPNs1D0oy](https://www.instagram.com/reel/DftPNs1D0oy/) | 3,6 | 66.500 | Sistema de adquisición | sketch IA en un jet: sus cifras como verdad o mentira; CTA CLASE |
| 22 | [Dfs0Oh2kkVD](https://www.instagram.com/reel/Dfs0Oh2kkVD/) | 2,6 | 48.200 | otros | b-roll de estilo de vida, sin voz, texto con giro; CTA YO |

Casi empatado, el sexto: el [animado en pixel art](https://www.instagram.com/reel/DfgGjvEGl4H/) (2,6). Fuera del múltiplo, el
[animado de los 30 reels con Claude](https://www.instagram.com/reel/Df3h8q8ztGF/) ya tiene 65.400 con menos de 48 h.

**Qué tienen en común:** ninguno es Ramiro hablando a cámara; 4 de 5 son IA o animación desde el primer cuadro; 2 de 5 son del
tema trazabilidad y piden comentar CRM. En la otra punta, la pizarra y las llamadas (24 de 50 reels) tienen múltiplo mediano
0,7 y 0,8. De los 40 maduros, 6 pasan el doble de su mediana: 3 sketches con IA, 2 animados y el de estilo de vida.

## Qué le sirve a Martín y qué no

1. **Sí: el sketch entero con su personaje, no sólo el gancho.** En Ramiro rinde 1,9 veces su mediana (8 reels) y el de Nvidia
   ya es de bloques. Con Omni 1.2 Flash a US$0,024 por segundo, un sketch de 91 s cuesta unos US$2,19; el gancho largo de
   Ramiro (29 s), US$0,70; uno de 10 a 15 s, US$0,24 a 0,36.
2. **Con cuidado: el «gancho con IA + persona» todavía no está probado** (3 reels, 2 recién publicados, el maduro dio 0,6). Si
   Martín lo usa, que la IA sea la metáfora del cliente (la ballena es quien paga) y que dure 10 a 15 s, no 23 a 31.
3. **Sí: los dos temas que más le rinden son los más cercanos a lo que vende MaKo (CRM e IA):** «no sabés qué contenido te trae plata» (trazabilidad,
   55.250 de mediana, pero son 4 reels y los 4 son sketches con IA) y «la IA hace el trabajo» (29.500 y 896 comentarios). Ballenas contra quebrados es el que más repite
   (28 %) pero rinde 0,8: sirve de fondo, no como apuesta.
4. **Sí: «comentá PALABRA» con un regalo concreto** (34 de 50; con CTA, 24.100 contra 14.900), y los animados hechos con código,
   que no gastan segundos de avatar y le dan 2,1 veces su mediana y 1.443 comentarios.
5. **No:** el insulto como gancho (13 de 50 en los primeros 10 s), el «vos», el lujo (Rolls, mansión, autos) ni los recortes de
   llamada (24 % de su feed, sin CTA, 0 comentarios de mediana); Martín escribe en neutro y con «tú».

## Lo que no se ve en los cuadros

Con qué herramienta hace los sketches y los ganchos con IA; si la voz de los animados es la de Ramiro o generada; si las
tomas del reel de estilo de vida son suyas; si el fondo sonoro es música o ambiente; y cuánto del rendimiento es del tema y
cuánto de la forma. Los segundos de fin de gancho y de inicio del CTA son el comienzo de la frase en la transcripción (±3 s).

## Todos los reels

Fecha de publicación; reproducciones de la grilla el 19/11/2026 (las del 17/11 en adelante todavía suben); el gancho con su tipo
y su segundo de fin; el CTA con su palabra y el segundo en que empieza.

| # | Reel | Fecha | Repro. | Duración | Tema | Gancho (tipo, fin) | CTA (desde) |
|---|---|---|---|---|---|---|---|
| 1 | [Df6GECpzVY8](https://www.instagram.com/reel/Df6GECpzVY8/) | 19/11 | 5.746 | 101 s | Ballenas | ia-exagerado, 0–31,0 s | BALLENA (89,9 s) |
| 2 | [Df5uuJAJxFr](https://www.instagram.com/reel/Df5uuJAJxFr/) | 18/11 | 3.822 | 82 s | Rentabilidad | persona-a-camara, 0–13,0 s | — |
| 3 | [Df5UMnTT-1C](https://www.instagram.com/reel/Df5UMnTT-1C/) | 18/11 | 5.858 | 113 s | IA hace el trabajo | texto-en-pantalla, 0–5,4 s | AGENTE (108,5 s) |
| 4 | [Df48MCuT_hj](https://www.instagram.com/reel/Df48MCuT_hj/) | 18/11 | 14.500 | 46 s | Follow me ads | otro, 0–6,4 s | — |
| 5 | [Df4kgp-Trlk](https://www.instagram.com/reel/Df4kgp-Trlk/) | 18/11 | 19.500 | 90 s | IA hace el trabajo | ia-exagerado, 0–23,4 s | SOP (76,3 s) |
| 6 | [Df3h8q8ztGF](https://www.instagram.com/reel/Df3h8q8ztGF/) | 18/11 | 65.400 | 70 s | IA hace el trabajo | animado, 0–3,6 s | IA (63,9 s) |
| 7 | [Df3Has0BEqi](https://www.instagram.com/reel/Df3Has0BEqi/) | 17/11 | 9.679 | 139 s | Follow me ads | persona-a-camara, 0–14,4 s | SOP (130,1 s) |
| 8 | [Df2vaYCHFoQ](https://www.instagram.com/reel/Df2vaYCHFoQ/) | 17/11 | 7.821 | 58 s | Ballenas | otro, 0–4,1 s | — |
| 9 | [Df2XYVUBIHB](https://www.instagram.com/reel/Df2XYVUBIHB/) | 17/11 | 6.214 | 161 s | Ballenas | texto-en-pantalla, 0–7,5 s | BALLENA (149,4 s) |
| 10 | [Df1_VdftG1g](https://www.instagram.com/reel/Df1_VdftG1g/) | 17/11 | 30.000 | 102 s | Trazabilidad | situacion-actuada, 0–32,0 s | CRM (90,4 s) |
| 11 | [Df0jEFZIRTI](https://www.instagram.com/reel/Df0jEFZIRTI/) | 16/11 | 11.700 | 83 s | Ballenas | persona-a-camara, 0–8,0 s | — |
| 12 | [DfzylOtE57v](https://www.instagram.com/reel/DfzylOtE57v/) | 16/11 | 12.900 | 41 s | Follow me ads | otro, 0–4,5 s | — |
| 13 | [Dfzacw9HAMU](https://www.instagram.com/reel/Dfzacw9HAMU/) | 16/11 | 20.600 | 122 s | Trazabilidad | sketch-ia-entero, 0–17,6 s | CRM (111,7 s) |
| 14 | [Dfx9y6jD7bs](https://www.instagram.com/reel/Dfx9y6jD7bs/) | 15/11 | 11.800 | 144 s | Sistema de adquisición | texto-en-pantalla, 0–5,9 s | IA (137,2 s) |
| 15 | [Dfxmz3ggKQ5](https://www.instagram.com/reel/Dfxmz3ggKQ5/) | 15/11 | 24.700 | 45 s | IA hace el trabajo | animado, 0–6,8 s | SKILL (38,3 s) |
| 16 | [Dfw24m4Abwg](https://www.instagram.com/reel/Dfw24m4Abwg/) | 15/11 | 13.500 | 33 s | Follow me ads | otro, 0–7,0 s | — |
| 17 | [DfvwqMQDDyi](https://www.instagram.com/reel/DfvwqMQDDyi/) | 15/11 | 33.100 | 91 s | Sistema de adquisición | sketch-ia-entero, 0–12,6 s | NVIDIA (83,9 s) |
| 18 | [DfvY9_NJcdn](https://www.instagram.com/reel/DfvY9_NJcdn/) | 14/11 | 21.600 | 103 s | Sistema de adquisición | texto-en-pantalla, 0–6,6 s | SOP (91,5 s) |
| 19 | [Dfuo5PDpfKc](https://www.instagram.com/reel/Dfuo5PDpfKc/) | 14/11 | 16.100 | 40 s | Follow me ads | otro, 0–2,5 s | — |
| 20 | [DfuQ4RLjYc9](https://www.instagram.com/reel/DfuQ4RLjYc9/) | 14/11 | 29.600 | 80 s | IA hace el trabajo | situacion-actuada, 0–14,9 s | SISTEMA (73,2 s) |
| 21 | [DftPNs1D0oy](https://www.instagram.com/reel/DftPNs1D0oy/) | 14/11 | 66.500 | 56 s | Sistema de adquisición | sketch-ia-entero, 0–24,1 s | CLASE (47,5 s) |
| 22 | [Dfs0Oh2kkVD](https://www.instagram.com/reel/Dfs0Oh2kkVD/) | 13/11 | 48.200 | 71 s | otros | b-roll, 0–7,0 s | YO (62,7 s) |
| 23 | [DfscJU1EVFg](https://www.instagram.com/reel/DfscJU1EVFg/) | 13/11 | 14.900 | 36 s | Ballenas | otro, 0–2,8 s | — |
| 24 | [DfsEJLUgHzo](https://www.instagram.com/reel/DfsEJLUgHzo/) | 13/11 | 8.135 | 131 s | Rentabilidad | texto-en-pantalla, 0–15,7 s | SOP (121,0 s) |
| 25 | [DfrsGgXkR_X](https://www.instagram.com/reel/DfrsGgXkR_X/) | 13/11 | 37.000 | 88 s | Trazabilidad | sketch-ia-entero, 0–14,9 s | IA (72,1 s) |
| 26 | [Dfqpj_5zi24](https://www.instagram.com/reel/Dfqpj_5zi24/) | 13/11 | 29.400 | 67 s | IA hace el trabajo | animado, 0–4,8 s | INSTAGRAM (60,2 s) |
| 27 | [DfpfYpuAfoe](https://www.instagram.com/reel/DfpfYpuAfoe/) | 12/11 | 13.300 | 133 s | Sistema de adquisición | persona-a-camara, 0–13,5 s | SOP (126,1 s) |
| 28 | [DfpMoI4G5dx](https://www.instagram.com/reel/DfpMoI4G5dx/) | 12/11 | 9.423 | 74 s | Ballenas | otro, 0–5,7 s | — |
| 29 | [DfoDa85EyA6](https://www.instagram.com/reel/DfoDa85EyA6/) | 12/11 | 17.200 | 91 s | Ballenas | sketch-ia-entero, 0–6,4 s | BALLENA (59,7 s) |
| 30 | [Dfn3e1YgCUi](https://www.instagram.com/reel/Dfn3e1YgCUi/) | 12/11 | 21.000 | 137 s | Ballenas | persona-a-camara, 0–12,7 s | CLASE (124,3 s) |
| 31 | [DfnSkt_iI_M](https://www.instagram.com/reel/DfnSkt_iI_M/) | 11/11 | 19.700 | 93 s | Follow me ads | situacion-actuada, 0–28,6 s | SOP (81,9 s) |
| 32 | [Dfm3xDWiV0Z](https://www.instagram.com/reel/Dfm3xDWiV0Z/) | 11/11 | 14.900 | 93 s | Rentabilidad | situacion-actuada, 0–7,1 s | — |
| 33 | [Dfmjc92pXpa](https://www.instagram.com/reel/Dfmjc92pXpa/) | 11/11 | 10.700 | 60 s | Follow me ads | otro, 0–4,5 s | — |
| 34 | [DflavpUisyG](https://www.instagram.com/reel/DflavpUisyG/) | 11/11 | 73.500 | 60 s | Trazabilidad | sketch-ia-entero, 0–8,8 s | CRM (47,2 s) |
| 35 | [DflOHziDDVV](https://www.instagram.com/reel/DflOHziDDVV/) | 11/11 | 26.200 | 167 s | Follow me ads | texto-en-pantalla, 0–12,8 s | SOP (158,8 s) |
| 36 | [Dfk06zNGQZo](https://www.instagram.com/reel/Dfk06zNGQZo/) | 10/11 | 118.000 | 39 s | IA hace el trabajo | animado, 0–3,8 s | EDITAR (32,2 s) |
| 37 | [DfkSW69iZu1](https://www.instagram.com/reel/DfkSW69iZu1/) | 10/11 | 10.100 | 139 s | Sistema de adquisición | persona-a-camara, 0–10,8 s | SOP (130,5 s) |
| 38 | [Dfj9fp1mcwV](https://www.instagram.com/reel/Dfj9fp1mcwV/) | 10/11 | 17.700 | 28 s | Ballenas | otro, 0–5,6 s | — |
| 39 | [Dfi5E4sioYt](https://www.instagram.com/reel/Dfi5E4sioYt/) | 10/11 | 87.600 | 138 s | Trazabilidad | sketch-ia-entero, 0–11,0 s | CRM (126,9 s) |
| 40 | [DfiWtj2FES2](https://www.instagram.com/reel/DfiWtj2FES2/) | 09/11 | 14.700 | 79 s | Ballenas | texto-en-pantalla, 0–6,0 s | CLASE (71,0 s) |
| 41 | [DfhuBAPFHzF](https://www.instagram.com/reel/DfhuBAPFHzF/) | 09/11 | 16.200 | 101 s | Ballenas | persona-a-camara, 0–9,1 s | — |
| 42 | [DfhZZkWlzra](https://www.instagram.com/reel/DfhZZkWlzra/) | 09/11 | 28.000 | 28 s | IA hace el trabajo | otro, 0–4,9 s | — |
| 43 | [DfgGjvEGl4H](https://www.instagram.com/reel/DfgGjvEGl4H/) | 09/11 | 48.100 | 45 s | IA hace el trabajo | animado, 0–5,8 s | REEL (41,9 s) |
| 44 | [DffeHnrGfro](https://www.instagram.com/reel/DffeHnrGfro/) | 08/11 | 10.800 | 95 s | Rentabilidad | persona-a-camara, 0–7,2 s | GALO (91,0 s) |
| 45 | [DffIv6aD-5F](https://www.instagram.com/reel/DffIv6aD-5F/) | 08/11 | 11.500 | 38 s | Sistema de adquisición | otro, 0–3,8 s | — |
| 46 | [Dfe0JRHD2PM](https://www.instagram.com/reel/Dfe0JRHD2PM/) | 08/11 | 10.900 | 89 s | Ballenas | ia-exagerado, 0–29,0 s | BALLENA (72,6 s) |
| 47 | [DfdeYjNCs1g](https://www.instagram.com/reel/DfdeYjNCs1g/) | 08/11 | 12.400 | 103 s | Ballenas | persona-a-camara, 0–5,5 s | YO (92,3 s) |
| 48 | [Dfcz8mriaBU](https://www.instagram.com/reel/Dfcz8mriaBU/) | 07/11 | 24.100 | 73 s | Rentabilidad | persona-a-camara, 0–9,1 s | CURSO (63,5 s) |
| 49 | [DfcYYsoCiYP](https://www.instagram.com/reel/DfcYYsoCiYP/) | 07/11 | 20.500 | 59 s | Ballenas | otro, 0–6,2 s | — |
| 50 | [DfbMdVPTRu8](https://www.instagram.com/reel/DfbMdVPTRu8/) | 07/11 | 30.000 | 99 s | Rentabilidad | sketch-ia-entero, 0–19,0 s | CURSO (86,8 s) |

## Carruseles y posts

Todo lo que no es reel en su grilla el 19/11/2026: **10 carruseles** (ninguna imagen ni video suelto), 4 de
julio y agosto (los casos de cliente, arriba de todo) y 6 del 02/11/2026 al 16/11/2026. Las hojas de las 10 se
miraron una por una (`C:/dev/referentes-videos/ramiro/pub/<id>/hoja.jpg`); los números salen de un script sobre
`ramiro/publicaciones.json`.

- **Tipo:** de 5 a 8 láminas (mediana 7); 34 de sus 66 láminas son video: se mueven.
- **Temas:** Sistema de adquisición 5 · La IA hace el trabajo 4 · otros 1. Son 2 de los 6 temas de sus reels; no hay carruseles de Ballenas (el tema que más repite en
  reels, 14 de 50), Follow me ads, Rentabilidad ni Trazabilidad. El «otros» es su mejor carrusel: 5 ideas de carruseles.
- **Moldes de portada:** Caso de éxito: «Cómo escalamos [negocio] a [cifra]» + foto con el cliente + tarjeta de su perfil 4 · Etiqueta NUEVO o URGENTE + lo que Claude ahora hace por ti 2 · «Dejá de hacer [lo de siempre]» + la alternativa o N ideas 2 · Cifra propia + «esta es la estructura que uso» 1 · «Cómo armar un equipo de contenido con Claude»: la IA como empleados 1.
- **Estructura típica:** portada con la promesa → una pieza del caso, un paso o una idea por lámina, siempre con una captura
  real (chats, campañas, flujos, sus métricas) → última lámina de CTA: un libro 3D con el nombre del regalo (o el video del
  perfil del cliente) y «Comentá "PALABRA"» en grande.
- **CTA:** los 10 piden comentar una palabra, en la última lámina y en el pie: PDF 2 · INFO 2 · SOP 1 · AGENTE 1 · IA 1 · CLAUDE 1 · FIDEL 1 · BRYAN 1. En los casos, la palabra
  es el nombre del cliente o INFO, y regala una clase gratuita; en los demás, el PDF, el ebook o el archivo de lo que enseña.
- **Me gusta medianos: 188** (de 76 a 7.789); comentarios medianos 139,5. Sus reels: mediana de 145 me gusta (50 reels).
  Las 5 ideas de carruseles ([DfQb-eqnJ3Q](https://www.instagram.com/p/DfQb-eqnJ3Q/)) tienen 7.789 me gusta y 16.680 comentarios: 41,4 veces la mediana. Los 4 de IA:
  1.341, 949, 162, 93 comentarios.
- **De venta: los 10** (todos regalan algo a cambio de comentar). Los 4 casos de cliente son la venta directa de su servicio:
  la cifra del cliente → quién es y cómo estaba → la clave → el sistema con capturas → «Comentá NOMBRE y te mando la clase».
- **Fijados:** los 4 casos aparecen arriba de la grilla, antes que los de noviembre, aunque son de julio y agosto
  (orden de `urls-pub.txt`). Lo marqué como fijado por ese orden; conviene confirmarlo en el perfil.

**Qué le sirve a Martín para sus carruseles:**

1. **El caso de cliente en 6 o 7 láminas**, igual de armado: cifra + foto con el cliente + tarjeta de su perfil → quién es y
   cómo estaba → la clave (oferta, ángulos, anuncios) → el sistema con capturas → CTA con la palabra. En MaKo, el caso de
   un cliente con sus agendas y cierres, y las capturas de la app.
2. **El tutorial «PASO 1…N» con una captura por lámina y el libro 3D del regalo al final**: lo usa para todo lo de IA y se
   hace con código.
3. **«Dejá de hacer [lo de siempre]» + N ideas**: su carrusel más comentado, por lejos.
4. **No:** el voseo, el insulto en la portada («pedorros», «de mier*») ni la cara de una persona famosa.

| Publicación | Fecha | Tipo | Tema | Portada | Láminas | Me gusta | CTA |
|---|---|---|---|---|---|---|---|
| [Df0KjTdHM_w](https://www.instagram.com/p/Df0KjTdHM_w/) | 16/11/2026 | carrusel | Sistema de adquisición | «Hice +$9.000.000 con mi marca personal. Esta es la estructura de setting que uso.» | 7 | 76 | SOP |
| [DfxNwgHHEv4](https://www.instagram.com/p/DfxNwgHHEv4/) | 15/11/2026 | carrusel | La IA hace el trabajo | «NUEVO · Cómo reemplazar a tus setters con Claude» | 8 | 163 | AGENTE |
| [Dfh9gs-nJ4i](https://www.instagram.com/p/Dfh9gs-nJ4i/) | 09/11/2026 | carrusel | La IA hace el trabajo | «URGENTE · Claude se conecta con Meta para correr todos tus anuncios» | 7 | 205 | IA |
| [Dffx80AmQZW](https://www.instagram.com/p/Dffx80AmQZW/) | 08/11/2026 | carrusel | La IA hace el trabajo | «Dejá de hacer carruseles estáticos · Creá carruseles animados en solo 5 minutos con Claude» | 5 | 598 | PDF |
| [DfdJuzvGUlK](https://www.instagram.com/p/DfdJuzvGUlK/) | 07/11/2026 | carrusel | La IA hace el trabajo | «Cómo armar un equipo de contenido con Claude» | 7 | 551 | CLAUDE |
| [DfQb-eqnJ3Q](https://www.instagram.com/p/DfQb-eqnJ3Q/) | 02/11/2026 | carrusel | otros | «Dejá de hacer carruseles PEDORROS · Te dejo 5 ideas de carruseles…» | 7 | 7.789 | PDF |
| [Db_4IxGnAt8](https://www.instagram.com/p/Db_4IxGnAt8/) | 13/08/2026 (fijado) | carrusel | Sistema de adquisición | «Cómo escalamos a 100K/mes su coaching para negocios inmobiliarios con solo 7000 seguidores» | 6 | 171 | FIDEL |
| [DbrlMwznPqu](https://www.instagram.com/p/DbrlMwznPqu/) | 06/08/2026 (fijado) | carrusel | Sistema de adquisición | «Cómo escalamos su bizop para latinos en EE.UU. a +400K/mes» | 7 | 161 | BRYAN |
| [DbmJbjNHPCE](https://www.instagram.com/p/DbmJbjNHPCE/) | 03/08/2026 (fijado) | carrusel | Sistema de adquisición | «Cómo escalamos su coaching de mentalidad a 140k/mes» | 6 | 919 | INFO |
| [DbWuwwMHDKR](https://www.instagram.com/p/DbWuwwMHDKR/) | 28/07/2026 (fijado) | carrusel | Sistema de adquisición | «Cómo metimos 125K en los últimos 26 días con su consultoría fitness» | 6 | 164 | INFO |

## Verificación

Revisión crítica del 19/11/2026 sobre `reels.json`, `temas.json`, las transcripciones y las hojas de cuadros. Los números
salen de un script que recuenta el documento entero desde `reels.json` (más `meta.json`, `audio.json` y `video.info.json`).

**Integridad.** 50 carpetas con `meta.json` y 50 filas en `reels.json`, una por carpeta, sin ids repetidos y en el mismo
orden que `urls.txt`. La fecha, la duración y las reproducciones de cada fila coinciden con `meta.json` y la grilla.

**Temas, a ciegas.** Clasifiqué los reels leyendo sólo la transcripción (con `resumen.py`) y las definiciones, sin mirar la
columna `tema`, y comparé después. La muestra pedida eran 28 reels (uno de cada tres, los n.º 3, 6, … 48, más todos los de
los temas más chicos: «otros» y los tres empatados en 6); amplié a los 50. **Reclasifiqué 48 a ciegas y coincidí en 47**
(en la muestra: 27 a ciegas, 26 coincidencias; los n.º 1 y 2 los vi antes de empezar y no cuentan). El único desacuerdo es
el **#21** (el del jet, «Mentira. Verdad.»): lo puse en Sistema de adquisición y el relevo en Trazabilidad. El reel no
nombra ninguna medición; da la receta «mismos 6 o 7 temas + follow me ads», la misma del de Nvidia (#17), que los dos
pusimos en Sistema. La definición de Trazabilidad era vaga justo ahí («repetir siempre los mismos 6 o 7 temas» lo dice
Ramiro en reels de varios temas), así que la cambié en `temas.json` y en la tabla (Trazabilidad sólo si nombra o muestra la
medición; Sistema incluye la receta de punta a punta) y reclasifiqué con ella: sólo se mueve el #21.

- **Trazabilidad pasó de 6 a 5** (12 % → 10 %; mediana de 66.500 en 5 maduros → 55.250 en 4).
- **Sistema de adquisición pasó de 6 a 7** (12 % → 14 %; mediana de 12.550 en 6 → 13.300 en 7).
- Los demás quedan igual: Ballenas 14, IA 9, Follow me ads 8, Rentabilidad 6, otros 1.
- Coincidimos, pero con una segunda opción razonable, en 10 reels más: #7 (follow me ads o IA), #11, #23, #41 y #50
  (su tema u «otros»), #20 (IA o Rentabilidad), #25 (Trazabilidad o Ballenas), #30 y #38 (Ballenas o Sistema) y #44
  (Rentabilidad o Follow me ads). Si Martín elige por tema, esos 10 pueden bailar uno o dos puntos en los porcentajes.

**Formas, mirando las hojas.** Miré la hoja de los 16 reels que el relevo marcó como sketch entero con IA (8), gancho con IA +
persona (3) y animado (5), de 5 más al azar (n.º 2, 19, 24, 33 y 48: selfie, llamada, pizarra, llamada, selfie), del #10 y del
#22, y una grilla con el primer cuadro de los 50; en el zombie, los mutantes y el béisbol saqué cuadros grandes del video.
**No cambió ninguna forma, ningún `gancho_fin_s` ni ningún `paso_a_persona_s`**: las formas están bien y los segundos caen
dentro de 1 s del final de la frase (el #34, 0,8 s antes; dentro de los ±3 s que avisa el documento). Lo que agrego:

- Los **7 sketches con avatar** (#13, 17, 21, 25, 34, 39, 50) son 100 % generados, sin rodaje: ahí el costo es la
  duración entera.
- En el **zombie (#29)** Ramiro está filmado y habla desde el segundo 0; la IA es el zombie, que está todo el video. Para el
  costo se queda en «sketch entero con IA» (hay IA en todos los segundos), pero no es un avatar.
- En los **3 ganchos con IA + persona** Ramiro también está filmado desde el 0: la IA es un elemento encima (la ballena; la
  pantalla y el lanzador; el mutante y el alienígena). `paso_a_persona_s` marca cuándo termina la escena con IA, no cuándo
  aparece la persona. Para no mezclar las dos cosas agregué a `reels.json` la columna **`persona_real_desde_s`**: 0 en 38
  reels, vacía en 12 (los 7 sketches con avatar y los 5 animados).
- Los **5 animados** no tienen presentador; en el de los 30 reels (#6) aparece un clip suyo filmado dentro de un celular
  dibujado.

**Recuento contra el documento.** Coinciden con el script la ficha (3,85 reels por día, de 1 a 5; 3,9 h entre uno y otro;
86 s; 18.700 en 40 maduros; 8.750 en los 10 nuevos; 31 comentarios; 896 a 3.679 en los animados), la tabla de formas entera
(cantidades, medianas, múltiplos, gancho, cortes, comentarios), los 9 moldes de gancho, la duración del gancho por tipo, el
paso a la persona (29, 7 con mediana 23, 14), la luz, el fondo sonoro (48 de 50, -31 dB, 14 dB), el b-roll (24), los 5
horizontales, la estructura (CTA desde el 85 s, 90 % del video, 9 s), el CTA (34, palabras, con y sin CTA 24.100 contra
14.900 y 62,5 contra 2 comentarios) y los 5 mejores con sus múltiplos. **Corregí 7 frases:**

1. La tabla de temas y los totales de Trazabilidad y Sistema (arriba).
2. «4 de los 6 reels de trazabilidad son sketches»: ya estaba mal antes del cambio (eran 5 de 6); ahora son 4 de 5.
3. «3 de 5 de los mejores son de trazabilidad y piden CRM»: el #21 pedía CLASE, no CRM; ahora son 2 de 5.
4. «Trazabilidad, 66.500 de mediana» en lo que le sirve a Martín: ahora 55.250, con la aclaración de que son 4 sketches.
5. «Al menos 18 de los 34 dicen que lo manda por mensaje privado»: en la voz lo dicen 13 (la transcripción del tramo del CTA).
6. Palabrotas en los primeros 10 s: 14, no 13 (13 si no se cuenta «carajo»); en algún momento, 34, como decía.
7. Cortes por minuto: mediana 1,25, no 1,2.

En `reels.json` corregí 1 fila de datos (el tema del #21), agregué la columna `persona_real_desde_s` a las 50 y una nota de
verificación en 5 filas (#1, 5, 6, 29 y 46).
