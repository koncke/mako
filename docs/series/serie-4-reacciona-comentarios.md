# Serie 4 — Martín reacciona a los comentarios (con continuación)

**Objetivo:** SEGUIDORES de nicho y comentarios. Un personaje al que la gente le pregunta cosas y él contesta con humor;
cada parte termina pidiendo las preguntas de la siguiente, así que los comentarios SON el guion de la próxima.
Protagonista SIEMPRE: Martín en cubos (`makeBoy`), con matices del nicho: high ticket, marketing, ventas y contenido.
Sin CTA de venta. Chat dueño: `galeria-series` (cuenta claude5, 19/11/2026).

## 1. La referencia: @manuelzapater (analizada el 19/11/2026)
- 137 mil seguidores, «dibujos y comedia». Reels en 3D low-poly: un personaje de cubos con anteojos y barba, casi siempre
  en el mismo cuarto violeta.
- Lo más visto, por lejos, es la serie **«Respondiendo preguntas de seguidores»**: parte 1 = 3,2 M vistas, 524 mil me gusta,
  2.035 comentarios; parte 2 = 2,3 M, 412 mil, 2.772 comentarios. El resto de su cuenta anda en 50 mil-900 mil.
- Bajados y transcritos 8 reels (`C:/dev/series-ref/zapater/`, `C:/dev/series-ref/trans/z-*.txt`, hojas en
  `C:/dev/series-ref/hojas/z-*.jpg`).
- **Duración:** 66-72 s. **Palabras:** 175-180 (2,5 por segundo), en ráfagas: cada pregunta con su respuesta dura 4-8 s.
- **Cortes:** un plano nuevo cada 1,5-2 s (medido con ffmpeg, umbral de escena 0,08). Es lo opuesto a la Serie 1.

### Estructura por segundos (parte 1, 66,7 s)
| Segundo | Qué pasa |
|---|---|
| 0-1,7 | Título amarillo redondeado palabra por palabra: «respondiendo / preguntas de / seguidores», él posa con las manos en la cintura. |
| 1,7-60 | 10-11 beats. Cada beat: **la tarjeta del comentario** (blanca, avatar + usuario + texto) entra al lado de él → la pregunta se escucha → él contesta en 1-3 frases con un gesto exagerado y, a veces, un gag visual. |
| 60-66 | Cierre que pide la próxima: «deja en comentarios tu pregunta para el siguiente vídeo». |

**Tipos de preguntas que funcionan** (de las dos partes):
1. Sobre él (edad, anteojos, el cuarto): «¿Cómo eres tan millennial?» → «Soy del 97, ¿vale? Soy gen Z» ×3 con zoom.
2. Absurdas o del propio formato: «¿Existe un Manuel 2D?», «¿Y un Manuel 4D?».
3. Una que lo provoca y él esquiva con un chiste (política → «plena libertad de expresión» + un sonido).
4. **Pedidos que él cumple** («haz ASMR», «revive a Mini Manuel»): son los momentos más compartidos.
5. Un gag recurrente entre partes (Mini Manuel aparece en la 1 y «revive» en la 2).

### Por qué engancha
1. **Los comentarios son el guion de la próxima parte:** comentar es participar (2.000-2.800 comentarios por parte).
2. Ritmo: un beat cada ~6 s y un corte cada ~2 s: no hay tiempo para irse.
3. Un personaje fijo (mismo cuarto, misma ropa) que se vuelve familiar; se autoburla.
4. Gags visuales que no necesitan contexto (T-pose con cursor = «¿una IA podría animar así?»).

### Estilo de animación
- 3D low-poly de caras planas (muy cerca de nuestro Martín en cubos), UN cuarto monocromo violeta con luz suave y viñeta.
- Planos que alternan cuerpo entero ↔ cara enorme; corte seco en cada beat.
- La tarjeta del comentario: rectángulo blanco con esquinas redondeadas, avatar circular, usuario gris chico, texto negro;
  entra inclinada al lado de él (a veces la sostiene como un cartel).
- Subtítulos chicos y centrados, más o menos a la altura del pecho, SOLO para lo que él dice.
- Efectos de sonido en los gags (ducha, arma, grito). Nosotros: no (ver decisiones).

## 2. Cómo lo hacemos nosotros
- Martín en cubos en **un cuarto AZUL noche** (no el violeta de Zapater), título dorado (Baloo 2), tarjeta blanca.
- **Lee la pregunta en voz alta** y contesta (una sola voz: el clon de Martín). La tarjeta muestra la pregunta; los
  subtítulos, sólo la respuesta, **bajo el mentón**.
- Los usuarios de las tarjetas, en la parte 1, son PERSONAJES del nicho y parte del chiste (@mama.de.martin,
  @coach_sin_clientes, @setter_cansado…). **Desde la parte 2, sólo comentarios reales** de las partes publicadas (se piden en
  el cierre). Así nunca se inventa a un seguidor real.
- Mezcla de preguntas: personales (la mamá), del formato (por qué de cubos), **una de valor** («¿el high ticket no es una
  estafa?» → una respuesta corta que posiciona a Martín), una con un referente (Hormozi, siempre con respeto y la
  autoburla del lado de Martín), un pedido que cumple («véndeme este bolígrafo») y un remate visual (el pijama).
- Sin CTA de venta. Cierre: «Deja tu pregunta en los comentarios y la respondo en la parte dos. Sígueme.»

## 3. Premisas (19/11) y las dos elegidas
| # | Premisa | Nicho | Referente | Nota |
|---|---|---|---|---|
| 1 | **Respondiendo sus preguntas**: la estructura de Zapater, con preguntas del nicho mezcladas con personales y absurdas. | ✔✔ | Hormozi (en una pregunta) | **ELEGIDA (piloto).** |
| 2 | **Lo que digan los comentarios**: cada comentario es una ORDEN que Martín cumple («cierra esta venta en 10 segundos», «explica el high ticket como a un niño de 5», «haz un guion de VSL con 3 palabras»). | ✔✔ | según el pedido | **ELEGIDA** para alternar con la 1 desde la parte 2 (son los beats más compartidos en Zapater). |
| 3 | Comentarios de odio: lee críticas al high ticket («los coaches son estafadores») y contesta con humor y un dato. | ✔ | — | potente pero arriesgada: va como UN beat dentro de la 1 (ya está). |
| 4 | Las objeciones de los seguidores: cada comentario es la objeción que más escuchan y Martín la desarma en 5 s con un gag. | ✔✔ | — | buena para una parte 3 «especial objeciones». |
| 5 | Los DMs: lee mensajes absurdos de leads («¿precio?») y responde como setter. | ✔ | — | sketch más que comentarios. |
| 6 | Un compañerito recurrente (un Martín mini). | ✗ | — | sería copiar el gag de Zapater: descartada. |

## 4. Plantilla de guion
```
s1     «Respondiendo sus preguntas. Parte N.»                    (título dorado palabra por palabra)
s2…    «¿PREGUNTA?» (la lee él; va en la tarjeta)  →  RESPUESTA (1-2 frases, ≤ 14 palabras, termina en el remate)
       Orden de los beats: personal → del formato → UNA de valor → referente → pedido que cumple → remate visual
sN     «Deja tu pregunta en los comentarios y la respondo en la parte N+1. Sígueme.»
```
- 7-9 beats; 120-180 palabras; 45-70 s (la voz va a ~3 palabras/s con las pausas recortadas).
- Cada respuesta tiene UN gag visual o un gesto grande, atado a la palabra del remate.
- Nada de números inventados; si se nombra una cifra, que sea real.

## 5. Episodios
### Hechos
- **Parte 1** — ver §6.
### Por hacer
- Parte 2: los mejores comentarios reales de la parte 1 (+ seguir el gag del pijama si la gente lo pide).
- Parte 3: alternar con la premisa 2 («lo que digan los comentarios»).

## 6. Piloto — parte 1 (terminado, 19/11)
- Guion: `C:/dev/artefactos-animaciones/voz/guion-serie4-comentarios-1.json` (19 escenas, 129 palabras); voz
  `reels/voz-serie4-comentarios-1.mp3` (44,78 s, chequeada: dice exactamente el guion).
- Página `reels/serie4-comentarios-1.html` + `reels/serie4/comentarios-1.js` (el cuarto azul, las tarjetas, los gags);
  la construyó un agente con `series/BRIEF-serie4.md` (el brief sirve para la parte 2: cambiar guion, tiempos y gags).
- MP4 `mp4/serie4-comentarios-1.mp4` (calidad completa) y `mp4/para-ig/…` (el liviano de la galería). Portada:
  `series/portadas/serie4-comentarios-1.png` = el cuadro del segundo 2,6 (el título ya está en el video).
- En la galería: https://claude.ai/artifact/Xn37U48gr5sKx4zyDsEzUm#serie4-comentarios-1
- **Texto del post:** «Respondo sus preguntas (parte 1). ¿La tuya? Déjala en los comentarios y la respondo en la parte 2.»
- Revisado cuadro por cuadro: dos instantes de 0,2 s (11,5 y 33 s) en que el subtítulo roza la tarjeta que se va; no
  justificaba otro render.

## 6b. 19/11 — correcciones de Martín (por el Cerebro) aplicadas a la parte 1
- **«Nada de letra chica»:** las tarjetas de los comentarios pasaron de 680 px con texto de 52 px a 880 px con 68 px
  (usuario 48 px, avatar 88 px): la pregunta se lee en el teléfono sin acercarse, como un comentario de Instagram visto de
  cerca. Subtítulos: ya iban a 70 px.
- **Palabras de todos los días** (la misma regla que la Serie 1): «Mamá, enseño a vender high ticket» → «Mamá, enseño a
  vender»; «Me renderizaron con el plan gratis» → «Me hicieron con la versión gratis»; «¿El high ticket no es una
  estafa?» → «¿Vender cursos caros no es una estafa?». Voz nueva (43,6 s; la primera toma dijo «Respondiendo **a** sus
  preguntas»: se rehízo hasta que dijo exactamente el guion).
- El gancho («Respondiendo sus preguntas. Parte uno.» + la mamá) ya cumplía: se entiende en el primer segundo.

## 7. Decisiones
- 19/11: cuarto azul noche (no violeta) y título dorado: se copia la estructura, no la marca de Zapater.
- 19/11: una sola voz (la de Martín) lee la pregunta y contesta; sin efectos de sonido ni música (ante la duda, ninguno).
  Si Martín los quiere, se suma UNO por gag, como hace Zapater.
- 19/11: «Mamá, enseño a vender high ticket» en vez de un precio: no sabemos cuánto cobra Martín y no se inventan cifras.
