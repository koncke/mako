# Referentes para la serie de Martín: Ramiro, Víctor y Hormozi

Martín quiere una serie de ventas «muy similar» a la de Ramiro Cubría: un gancho exagerado de 10 a 15 s con su avatar de IA
(o animado) y después Martín en serio, hablando de sus 5 o 6 temas de siempre. Para elegir los temas ANTES de gastar segundos
de avatar (Omni 1.2 Flash por ApiMart, US$0,024 por segundo) se relevaron tres cuentas. Este documento las junta; el detalle
de cada una está en su relevo:

- [ramiro.md](ramiro.md) — Ramiro Cubría, 50 reels
- [victor.md](victor.md) — Víctor Heras, 35 reels
- [hormozi.md](hormozi.md) — Alex Hormozi, 48 reels

**Para elegir:** el artefacto «Serie con avatar IA» (https://claude.ai/artifact/FeLyfHY62GRHbLBAJX6QUz), rehecho el 21/11: una
galería con el reel de referencia de cada uno de los 20 temas (`propuestas-temas.json`) y, al tocarlo, la referencia y nuestra
versión lado a lado, con los dos guiones. Lo que Martín marca queda en la colección `votos` del artefacto, un documento por tema con
`estado` «si» o «no» (se lee con la herramienta ArtifactData). Nada se genera con IA antes de eso. Ver «La serie con avatar de IA»,
abajo.

## Cómo se relevó

Con el método de [../desarmar-video-referente.md](../desarmar-video-referente.md): cada reel bajado, transcrito y medido
(cortes, piso del audio) y una fila por reel en `<cuenta>/reels.json` mirando su hoja de cuadros, con UN tema de una lista
cerrada (`temas.json`). Un crítico reclasificó a ciegas (coincidió en 47 de 48, 32 de 33 y 45 de 47), afinó las definiciones y
recontó cada número (sección «Verificación» de cada relevo).

Cómo leer los números:

- **Reproducciones:** las de la grilla de Instagram el 19/11/2026. Sólo cuentan los **maduros** (más de 48 h y sin fijar):
  40 de Ramiro, 41 de Hormozi y, en Víctor, los 33 sin fijar, como en su relevo (incluye uno del 17/11). El **múltiplo** es reproducciones ÷ la mediana de la cuenta.
- **A igual edad:** los reels viejos juntan más reproducciones, así que la mediana cruda engaña. Cada reel se compara con los
  publicados cerca: en Ramiro y Hormozi, contra la mediana de los maduros de ±3 días; en Víctor, contra los 6 más cercanos y con
  un ajuste por edad. En Ramiro la edad casi no pesa (correlación de rangos edad–reproducciones de −0,03 entre sus maduros), así
  que crudo y a igual edad dan parecido. *El «a igual edad» de Ramiro es nuevo de este documento: no lo revisó el crítico; usa
  el método del crítico de Hormozi, que el script reproduce exacto.*
- **Ninguna comparación prueba causa:** en las tres cuentas el tema, la forma, el CTA y la fecha van juntos.

## Los tres lado a lado

| | Ramiro Cubría | Víctor Heras | Alex Hormozi |
|---|---|---|---|
| Cuenta | @ramiro.cubria · 531 mil · español rioplatense | @victorherasemprendedor · 494 mil · español de España | @hormozi · 5,2 millones · inglés |
| Reels mirados | 50 | 35 (de 36: uno restringido no bajó) | 48 (3 fijados) |
| Fechas y frecuencia | 07/11 al 19/11/2026 · 3,8 por día (de 1 a 5) | 08/01 al 17/11/2026 y 2 fijados de 2024 · a rachas: uno cada 3,5 días, con un hueco de 80; 7, 1, 6 y 8 por mes de agosto a noviembre | 29/10 al 18/11/2026 y 3 fijados · 2,1 por día (de 1 a 4) |
| Mediana de reproducciones (base del múltiplo) | 18.700 (40 maduros) | 85.100 (33 sin fijados) | 373.000 (41 maduros) |
| Duración mediana | 86 s | 50 s | 68 s |
| Formas (reels) y cuánto rinden a igual edad | pantalla dividida 12 (×0,63) · recorte de llamada 12 (×0,70) · **sketch entero con IA 8 (×1,95)** · **animado 5 (×2,18)** · a cámara 5 (×0,73) · gancho actuado sin IA 4 (×1,15) · gancho con IA + persona 3 (×0,55, un solo maduro) · b-roll 1 | a cámara 19 (la referencia) · **sketch con gente real 10 (×1,2 a ×2,4 sobre la cámara; crudo ×5,2)** · montaje sin voz 5 (×0,8 a ×1,5) · efecto visual 1 · IA: 0 | estudio blanco 19 (×0,90) · taller en vivo 13 (×0,95; ×1,00 a ×1,18 por mitad del período) · **podcast 3 (×2,48)** · estudio oscuro 3 (×0,66) · selfie 2 (×2,22, una por mitad y con resultados opuestos) · clase 2 (×0,59) · 6 sueltas |
| Gancho (mediana) | 7,2 s; con IA, 13,8 s (sketch) y 29 s (gancho + persona) | 5,8 s (a cámara 4,4; sketch 6,4) | 4,3 s |
| Cuándo aparece la persona real | filmado desde el 0 en 38 de 50; habla en serio desde el 0 en 29, desde el segundo 23 (mediana) en 7, nunca en 14 | habla desde el 0 en 19 de 35; después en 7 (mediana 19,3 s); nunca en 9 | desde el 0 en 46 de 48 |
| Cortes por minuto (mediana) | 1,25 (16 reels sin ningún corte) | 10,3 | 5,6 (estudio blanco 2,1; taller 17,5) |
| Fondo sonoro (medido) | constante en 48 de 50 (piso -31 dB) | constante en 29 de 35 (piso -30 dB) | silencio entre frases en 30 de 48; constante en 15 |
| Palabras por segundo | 3,9 | 3,25 | 4,0 |
| CTA más usado | «comentá PALABRA» en 34 de 50 (SOP 8); desde el 90 % del video | «comenta PALABRA» en 9 de 35 (RETO 4); desde el 84 % | «comenta PALABRA» en 30 de 48 (SALES 13); desde el 94 %, clip grabado aparte |
| Temas (% de los reels) | Ballenas, no quebrados 28 · La IA (Claude) hace el trabajo 18 · Follow me ads 16 · Sistema de adquisición 14 · Rentabilidad 12 · Trazabilidad 10 · otros 2 | Mentalidad 29 · Lujo y humor de millonario 23 · Crecer en redes 14 · Tu entorno 14 · Ganar dinero con contenido 11 · El dinero sí importa 9 | Cerrar la venta 31 · Foco y decisiones 19 · Armar el equipo de ventas 15 · Conseguir clientes 12,5 · Más plata por cliente 10 · Gente que rinda 8 · otros 4 |
| Tema que más rinde a igual edad | Trazabilidad (×3,13; sus 4 maduros son sketches con IA) y La IA hace el trabajo (×1,62) | ningún orden se sostiene; Mentalidad queda entre los dos que menos rinden | Foco y decisiones (×2,38; 7 de sus 8 maduros no piden nada) |

## La receta común a los tres

1. **Pocos temas, siempre los mismos.** 6 por cuenta (más un «otros» chico); el más usado ocupa del 28 al 31 % del feed. Un
   tema es el dolor o la promesa, no el formato: lo que cambia de un reel a otro es el envoltorio.
2. **Gancho corto en el segundo 0 y escrito en pantalla.** Mediana de 7,2 s (Ramiro), 5,8 s (Víctor) y 4,3 s (Hormozi); el
   cartel rojo de Hormozi está en 37 de 48.
3. **La persona real está desde el principio.** Hormozi en 46 de 48, Ramiro filmado desde el 0 en 38 de 50, Víctor hablando
   desde el 0 en 19 de 35. Cuando hay una escena antes, la persona entra en el segundo 19 (Víctor) o 23 (Ramiro) de mediana.
4. **El cuerpo es una lista o unos pasos numerados con un caso real y sus cifras:** el «mi cliente» de Ramiro, el Bernardo
   de Víctor, el negocio y la facturación de quien pregunta en el taller de Hormozi.
5. **Un solo CTA, siempre el mismo:** «comenta PALABRA» a cambio de un regalo concreto (un SOP, una clase, un
   entrenamiento), al final (desde el 90 %, el 84 % y el 94 % del video). Ninguno manda al link de la bio.
6. **La forma de todos los días no es la que más rinde.** A igual edad, la pizarra de Ramiro da ×0,63 y el estudio blanco de
   Hormozi ×0,90; Víctor a cámara queda debajo de sus sketches. Lo que sale de la rutina rinde más: el sketch con IA de
   Ramiro (×1,95), el recorte de podcast de Hormozi (×2,48), el sketch con actores de Víctor (×1,2 a ×2,4).

## En qué se diferencian

- **La IA.** Ramiro la usa en 16 de 50 (8 sketches enteros, 5 animados hechos con Claude, 3 ganchos) y es lo que más le
  rinde. Víctor, en 0 de 35: lo exagerado lo hacen actores y su lujo real. Hormozi, probable sólo en 1 de 48 (unas viñetas de
  cómic con su personaje, ×2,04).
- **El ritmo.** Ramiro casi no corta (1,25 cortes por minuto); Víctor corta 10,3; Hormozi tiene dos mundos (2,1 en el estudio,
  17,5 en el taller multicámara).
- **El sonido.** Ramiro y Víctor llevan un fondo constante debajo de la voz (48 de 50 y 29 de 35); Hormozi deja silencio
  entre frases en 30 de 48.
- **El CTA.** Ramiro lo pone en 34 de 50 (faltan los 12 recortes de llamada y 4 más); Hormozi en 30 de 48, casi todo desde su
  lanzamiento del 04/11 (25 de 29 maduros); Víctor sólo en 9 de 35, cuando vende su método de seguidores.
- **El tema y la prueba.** Ramiro y Hormozi enseñan oficio con cifras del negocio (anuncios, CRM, cerrar, equipo); Víctor
  vende aspiración (mentalidad, lujo, dinero) con su Ferrari y su jet como prueba.

## Lo que contradice el pedido original

**El molde pedido —gancho exagerado de 10 a 15 s con avatar y después la persona en serio— casi no aparece y no está
probado.**

- Sólo Ramiro lo usa: **3 de 50 reels**. Y no es lo que se imaginaba: Ramiro está filmado desde el segundo 0 y la IA es un
  elemento encima (la ballena en la pileta, la pantalla del estadio), no un avatar; el gancho dura **23 a 31 s**, no 10 a 15.
- 2 de los 3 tienen menos de 48 h. El único maduro (los mutantes) dio **×0,55** contra sus vecinos de fecha: el sexto más bajo
  de los 40 maduros de la cuenta.
- Víctor (0 de 35) y Hormozi (0 de 48) no usan avatar.
- Lo que sí está probado se le parece: el **gancho exagerado hecho con actores** (el falso noticiero del robo del Ferrari de
  Víctor: 11 s, después Víctor explica en serio y pide «comenta CLASE»; ×22,3 sobre su mediana y ×8,9 contra sus vecinos de
  fecha) y el **sketch ENTERO con el avatar** de Ramiro (×1,95 a igual fecha en 8 reels; en 7 no hay ninguna toma filmada).
  El sketch entero gasta IA en toda su duración: unos US$2,19 por 91 s, contra US$0,24 a 0,36 de un gancho de 10 a 15 s.
- El molde de gancho que inspira el pedido (la metáfora de animales: ballenas contra mutantes) se repite 4 veces en Ramiro,
  sólo 2 maduras, con mediana de 14.050: por debajo de su mediana.

Conclusión: hacer la serie como se pidió es una apuesta nueva, no una copia. Vale la pena probarla, pero midiéndola contra la
mediana propia y con el sketch entero y el animado con código como comparación.

## Qué copiar de la ESTRUCTURA (no de los videos)

1. **Una lista cerrada de 5 o 6 temas**, cada uno con su definición de una línea, y cada reel en uno solo; se eligen por lo
   que rinden a igual edad, no por la mediana cruda (en Hormozi el taller baja de ×1,47 a ×0,95). Los más cercanos a lo que
   vende MaKo: trazabilidad y la IA que hace el trabajo (Ramiro); cerrar la venta, armar el equipo de ventas y conseguir
   clientes (Hormozi).
2. **El gancho en el segundo 0, corto y escrito.** Si va con el avatar, que no pase de 10 a 15 s (el único maduro de Ramiro con
   gancho con IA dura 29 s y rindió ×0,55) y que la imagen exagerada traiga el consejo puesto: la metáfora del cliente (la ballena es quien paga)
   o la queja del cliente en un cartel (la pregunta del público de Hormozi).
3. **Martín en serio enseguida**: en los tres la persona está desde el 0 o entra entre el 19 y el 23; con el avatar sólo en el
   gancho, Martín a más tardar en el segundo 15.
4. **El cuerpo en pasos numerados con un caso de cliente con nombre y cifras**, la etiqueta de cada paso en pantalla (en
   Hormozi, un paso cada 5 a 15 s).
5. **El cartel fijo con el dolor o con un número, hecho con código**: no gasta segundos de avatar (37 de 48 en Hormozi; 20 de
   sus 42 títulos tienen un número).
6. **Un solo CTA «comenta PALABRA» con un regalo concreto**, desde el 84–94 % del video y de 4 a 10 s; la palabra nombra el
   regalo. En Víctor, con CTA hay 8,8 comentarios por cada 1.000 reproducciones contra 0,39 sin CTA.
7. **Dos carriles**: una forma barata para todos los días (a cámara, pizarra) y otra fuera de la rutina para apostar (sketch
   entero con el personaje, animado hecho con código, selfie de una toma con una lista). En los tres, lo que rinde es la segunda.
8. **No copiar**: las palabrotas en el gancho (14 de 50 en Ramiro), el «vos», el lujo y la política como prueba, ni los recortes
   de llamada sin CTA (24 % del feed de Ramiro, 0 comentarios de mediana).

## Avisos

- **Forma más usada de Ramiro:** la pantalla dividida y el recorte de llamada empatan en 12. La estructura típica de la página es
  la de la pantalla dividida (el recorte es un pedazo de una llamada, sin CTA en los 12).
- **Citas:** cortas (15 palabras como máximo); las de Hormozi, traducidas al español en este relevo; las de Ramiro, en su «vos»
  original.
- **Ejemplos por tema:** los 2 de más reproducciones entre los maduros, sin fijados (en Víctor, «Ganar dinero con contenido»
  tiene 2 fijados de 2024 con 7,2 y 1,9 millones que no entran).
- **Ganchos:** los 6 moldes más repetidos; los empates se desempatan por la mediana de reproducciones maduras (en Ramiro queda
  afuera la metáfora de animales; en Víctor, la pregunta incómoda a quien mira).
- **Ajuste por edad de Víctor** (×2,4 del sketch): es el del relevo verificado; el script de este documento no lo reproduce
  exacto (da ×2,3 con una regresión simple). El método de los 6 vecinos sí da igual (×1,28 y ×1,09).

## La serie con avatar de IA (21/11/2026)

Cada tema tiene UN reel de referencia: el que se calca, no siempre el de más vistas. La página se arma fuera del repo, en
`C:/dev/referentes-videos/artefacto/serie/`:
- `armar-fichas.mjs` → `fichas.json`: la referencia elegida para cada tema, con sus números y su transcripción.
- `comprimir.sh`: los 20 reels a 480 px para la página, un póster y un fotograma grande por reel.
- `guiones.json`: nuestra adaptación de cada uno (gancho de 10 a 15 s con el avatar y después Martín a cámara).
- `generar-imagenes.mts`: nuestra versión de la escena (Nano Banana Pro por ApiMart; frase por tema adentro).
- `armar-pagina.mjs` + `plantilla.html`: la página que se publica en la misma URL.

Cómo está hecho cada reel de referencia (de `<cuenta>/reels.json`; «persona real desde» = cuándo aparece filmada la persona
real, «nunca» en un sketch entero con avatar; el N× es contra la mediana de su cuenta y «nuevo» si tenía menos de 48 h):

| Tema | Referencia | Forma | Dura | Gancho hasta | Persona real desde | Cortes/min | Fondo | CTA |
|---|---|---|---|---|---|---|---|---|
| ¿Qué video te trajo al cliente que te pagó? | Rama · [Dfi5E4sioYt](https://www.instagram.com/reel/Dfi5E4sioYt/) · 4,7× | sketch entero con IA | 138 s | 11 s | nunca | 15,6 | constante | comenta CRM (126,9 s) |
| La agenda llena de gente que no puede pagar | Rama · [Df6GECpzVY8](https://www.instagram.com/reel/Df6GECpzVY8/) · nuevo | gancho con IA + persona | 101 s | 31 s | 0 s | 13 | constante | comenta BALLENA (89,9 s) |
| Un mes de contenido con IA sin grabarte todos los días | Rama · [Dfk06zNGQZo](https://www.instagram.com/reel/Dfk06zNGQZo/) · 6,3× | animado (motion graphics) | 39 s | 3,8 s | nunca | 0 | constante | comenta EDITAR (32,2 s) |
| El lead que se enfría | Rama · [DfhuBAPFHzF](https://www.instagram.com/reel/DfhuBAPFHzF/) · 0,9× | a cámara (selfie) | 101 s | 9,1 s | 0 s | 1,2 | constante | sin CTA |
| ¿Reemplazar al setter con IA? | Rama · [Df4kgp-Trlk](https://www.instagram.com/reel/Df4kgp-Trlk/) · nuevo | gancho con IA + persona | 90 s | 23,4 s | 0 s | 5,3 | constante | comenta SOP (76,3 s) |
| Muchos seguidores, poca plata | Víctor · [DW4OVoLkUH5](https://www.instagram.com/reel/DW4OVoLkUH5/) · 1× | efecto visual con contador | 28 s | 19,3 s | 19,3 s | 0 | silencio entre frases | comenta RETO (19,3 s) |
| Viral, pero sólo para tu nicho | Víctor · [DXzUw8jthB3](https://www.instagram.com/reel/DXzUw8jthB3/) · 22,3× | sketch: falso noticiero + persecución | 69 s | 11 s | 36,3 s | 11,4 | constante | comenta CLASE (36,3 s) |
| Copia lo que ya le funcionó a tu competencia | Rama · [DfzylOtE57v](https://www.instagram.com/reel/DfzylOtE57v/) · 0,7× | recorte de llamada | 41 s | 4,5 s | 0 s | 0 | constante | sin CTA |
| Anuncios que terminan en una conversación | Rama · [DflOHziDDVV](https://www.instagram.com/reel/DflOHziDDVV/) · 1,4× | pantalla dividida (pizarra + Ramiro) | 167 s | 12,8 s | 0 s | 0,4 | constante | comenta SOP (158,8 s) |
| Dónde se te escapa la plata en el embudo | Rama · [DfvwqMQDDyi](https://www.instagram.com/reel/DfvwqMQDDyi/) · 1,8× | sketch entero con IA | 91 s | 12,6 s | nunca | 17,8 | constante | comenta NVIDIA (83,9 s) |
| Facturas mucho y te queda poco | Rama · [DfbMdVPTRu8](https://www.instagram.com/reel/DfbMdVPTRu8/) · 1,6× | sketch entero con IA | 99 s | 19 s | nunca | 5,5 | constante | comenta CURSO (86,8 s) |
| Pagas siete herramientas que no se hablan entre sí | Rama · [DfuQ4RLjYc9](https://www.instagram.com/reel/DfuQ4RLjYc9/) · 1,6× | gancho actuado sin IA + a cámara | 80 s | 14,9 s | 0 s | 0 | constante | comenta SISTEMA (73,2 s) |
| Tu negocio no puede depender de ti | Rama · [DfvY9_NJcdn](https://www.instagram.com/reel/DfvY9_NJcdn/) · 1,2× | pantalla dividida (pizarra + Ramiro) | 103 s | 6,6 s | 0 s | 0,6 | constante | comenta SOP (91,5 s) |
| Lo que no publicas por miedo te cuesta clientes | Víctor · [Dd9pHdwPaC9](https://www.instagram.com/reel/Dd9pHdwPaC9/) · 1,1× | a cámara selfie en el coche | 77 s | 12,4 s | 0 s | 5,5 | constante | sin CTA |
| La mentoría que no te dio resultados | Rama · [Dfm3xDWiV0Z](https://www.instagram.com/reel/Dfm3xDWiV0Z/) · 0,8× | gancho actuado sin IA + a cámara | 93 s | 7,1 s | 0 s | 2,6 | constante | sin CTA |
| Sube el precio | Hormozi · [Dfpk7PcTfsK](https://www.instagram.com/reel/Dfpk7PcTfsK/) · 1,8× | a cámara en estudio blanco | 104 s | 4,3 s | 0 s | 3,5 | silencio entre frases | comenta TEAMS (101 s) |
| Una oferta que da vergüenza rechazar | Hormozi · [DfXyDVPopFX](https://www.instagram.com/reel/DfXyDVPopFX/) · 0,8× | a cámara en estudio blanco | 41 s | 3,8 s | 0 s | 5,8 | silencio entre frases | comenta SALES (36 s) |
| «Lo tengo que pensar» | Hormozi · [DfaawJpoCve](https://www.instagram.com/reel/DfaawJpoCve/) · 0,9× | a cámara en estudio blanco | 80 s | 6,2 s | 0 s | 1,5 | silencio entre frases | comenta SALES (72,5 s) |
| Haces diez cosas y ninguna vende | Hormozi · [DfLtZLvo7Cc](https://www.instagram.com/reel/DfLtZLvo7Cc/) · 4,8× | selfie con el teléfono | 31 s | 3,4 s | 0 s | 0 | constante | sin CTA |
| «No me alcanzan los clientes»: el caso real de la semana | Hormozi · [DfLELOsIJHF](https://www.instagram.com/reel/DfLELOsIJHF/) · 3,8× | taller en vivo: pregunta del público | 110 s | 6,03 s | 0 s | 25,6 | silencio entre frases | sin CTA |

