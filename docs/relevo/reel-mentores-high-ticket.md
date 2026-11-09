# Relevo — El reel para mentores high ticket

**Estado al 9/11/2026 ~11:40 UTC. claude1 llegó al 100 % de cuota.**
Si Martín escribe «Continua», este documento es el punto de partida: está todo acá.

---

## 000 · 9/11 ~12:35 UTC: Martín RECHAZÓ los clips nuevos — «muy de IA»; se rehace todo por separado

Martín, textual: «salió tanto la imagen como el pizarrón de atrás muy de IA… quiero que lo vuelvas a hacer todo por
separado… te adjunto una referencia de que así quiero más o menos el resultado final, que se vea realista». La
referencia que mandó es `Downloads\image.png_4a780f5f.jpg`: él de cerca con la polaroid, el corcho detrás DESENFOCADO,
luz cálida, fotos chicas sueltas, notas, chinches e hilo rojo. La causa, en sus palabras: bajar en 2K reescalado y
volver a meter eso a Flow (ver AGENTS.md, «A Flow jamás le entra una imagen reescalada»). **Los clips nuevos de §00
quedan DESCARTADOS.**

**Lo hecho después** (todo en 1K original, en `C:\dev\reel-mentores\pizarron-real\`):
- `a1-original.jpg`: base = el pizarrón limpio de la pared, con los dos lotes y la referencia. Salió la toma lejana con
  luz fría (lo mismo de antes) y repitió caras. Descartada.
- `a2-corcho-solo.jpg` → `a3-corcho-32.jpg`: **base = LA REFERENCIA de Martín** + los dos lotes por lado, en una sola
  edición: «Solo el corcho de esta foto, de frente y llenando todo el cuadro, con la misma luz cálida y el mismo
  aspecto de foto real. En el corcho hay solo 32 fotos… cada cara aparece una sola vez. El resto lo llenan notas…».
  **Este es el look que pide.** ⚠️ Pero repite caras (en la a3, unas 44 fotos para 32 caras): el corcho de la
  referencia tiene más huecos que caricaturas. Esperando que Martín diga si sigue así o si se hacen más caricaturas.
- **Martín, sobre la a3 (9/11 ~12:40), textual:** «No solamente tiene que ser sin repetir, sino que tienes que lograr
  que esté en el escenario horizontal. Porque eso es vertical… que esté en el mismo lugar que estábamos produciendo los
  clips. Pero con esa nueva distribución, con ese nuevo diseño. Y obviamente sin repetir. Y… que las palabras sean en
  español.»
  - `b1`: base = el cuarto de los clips (`Downloads\image.png_07353b02.jpg`) + los lotes + la a3 como referencia de
    diseño. **El corcho se volvió VERTICAL** y tapó la pared: una referencia vertical le cambia la forma al objeto.
    No usar la a3 como referencia.
  - **`b2-horizontal.jpg` ✅ la mejor:** misma base + sólo los dos lotes, con el diseño dicho en palabras: «El mismo
    cuarto, la misma pared y el mismo corcho horizontal, del mismo tamaño y en el mismo lugar. En el corcho hay solo 32
    fotos chicas… cada una una sola vez, sueltas y un poco torcidas, entre notas de papel escritas en español, chinches
    de colores e hilo rojo. Luz cálida de tarde. Las caras de la primera referencia van en la mitad izquierda.» No le
    encontré repetidas. Notas en español, con errores («¿Socpechoeo?»).
  - `b3`: lo mismo, con las palabras exactas de las notas entre comillas → **repitió** a Hormozi y a la rubia, y las
    notas siguieron con errores. Las palabras entre comillas no arreglan la ortografía de Nano Banana.
- **Martín (~12:50):** «mira la imagen que te pasé de referencia… las fotografías están más chiquitas y más realistas».
  `c1` (base + 2 lotes + un recorte de las fotos de su referencia + párrafo) **copió las tarjetas grandes de los LOTES**:
  el lote manda sobre la muestra. Y ahí Martín: **«No le pases muchas referencias… Los prompts simples, con una sola
  referencia»** → regla ⛔ en AGENTS.md y en la memoria `una-referencia-prompt-simple`.
- **Con su método (base = `b2-horizontal.jpg`, subida de nuevo · UNA referencia · una frase):**
  - con el corcho SOLO de referencia (`a3`), Flow **reemplazó la imagen entera** por ese corcho vertical: una
    referencia que es «toda la imagen» se copia entera;
  - con la referencia COMPLETA de Martín y «Mantén el cuarto, el corcho y las fotos de los personajes, pero quiero que
    las tarjetas se vean como en esta referencia. Más realista.» → **`d1-tarjetas-reales.jpg`**: cuarto, corcho
    horizontal y distribución intactos, pero las caricaturas pasaron a FOTOS DE PERSONAS REALES y las tarjetas no se
    achicaron. Mostrada a Martín, esperando su veredicto.
- **✅ EL CORCHO ELEGIDO (Martín, ~13:05): la `v3` de §0** — «Esa, está bien, vamos directamente con esa». Su 1K
  original está en `C:\dev\reel-mentores\aprobado\corcho-v3-1k.jpg` (en Flow, la última versión de `/edit/05deab67-…`).
  Las notas quedaron en inglés: así la eligió.
- **✅ EL AVATAR DELANTE (~13:15):** `C:\dev\reel-mentores\aprobado\avatar-delante-v1.jpg`. Base = la referencia de
  Martín (`Downloads\image.png_4a780f5f.jpg`, él real), UNA referencia = el corcho elegido, y la frase: «La persona queda
  igual, con la misma ropa, la misma pose y la misma foto en la mano. Detrás de ella va este cuarto con este corcho.»
  Cara, pelo y polaroid idénticos. (El primer intento lo frenó Flow por «actividad inusual»; salió a los 5 minutos.)
  Mostrado a Martín. **Sigue:** los clips 1 y 2 con esta imagen de fotograma inicial (prompts y configuración en
  §00) y `voz\poner-voz.sh`.
- **✅ CLIPS 1 Y 2 (~13:35), desde el avatar aprobado:** `C:\dev\reel-mentores\clips-final\CLIP1-CON-TU-VOZ.mp4` y
  `CLIP2-CON-TU-VOZ.mp4` (de Flow: `clip1-flow.mp4`, `clip2-flow.mp4`; el 2 arranca de `clip1-ULTIMO.png`). Misma
  configuración y prompts que §00. Voz: 38 ms de diferencia en los dos; 136 y 134 Hz (los reales son 128). Mandados a
  Martín, esperando su OK. **Sigue:** clips 3, 4 y 5 (cada uno desde el último fotograma del anterior), cierre mudo y
  montaje con subtítulos (§9).
- **⛔ (~13:40) Martín RECHAZÓ los clips del avatar «de la referencia» y la voz profesional:** «no me gusta el avatar,
  fíjate cómo se generó este [CLIP-wavnivel.mp4]… salió impecable» y «No es mi voz». La receta de ese clip (9/11 madrugada):
  - personaje = una foto REAL suya del álbum → imagen de estudio en Flow → edición con la polaroid →
    `Downloads\Young_man_talking_on_phone_9b0328bc.jpg` (copia en `C:\dev\reel-mentores\omni\personaje-bueno-original.jpg`);
  - video = Omni 1.2 Flash, 9:16, 720p, 5 s, con el prompt en inglés y «young man from Uruguay» (texto exacto en
    `omni\omni-clip.mjs`);
  - voz = clon NORMAL «wav nivelado» `1crLVxcTqcz5I2mDmBlO`, origen = el audio del clip a mp3 SIN filtros, loudnorm −14
    (`voz\poner-voz-wavnivel.sh`). LA-CONFIG.json ya quedó así.
  - **⛔ El video va por FLOW, no por ApiMart** (Martín: «¿por qué usaste ApiMart, si estamos usando Flow para no
    gastar?»). Se lanzó UNA tarea por ApiMart antes de su mensaje (`omni\clip1-omni.mp4.task.txt`); no se relanza nada.
- **✅ (~14:05) clip 1 rehecho en Flow con esa receta:** base = `omni\personaje-corcho.jpg` (el personaje bueno + el
  corcho elegido, con una referencia y una frase), Fotogramas · Omni 1.2 Flash · 720p · 9:16 · 5 s · x1 = 15 créditos →
  `omni\CLIP1-CON-TU-VOZ.mp4`. Mandado a Martín. Sigue el clip 2 igual, desde el último fotograma.
- **(~14:20) Martín aprobó el clip 1 de Flow.** Clip 2: «que ya no tenga la foto, y que yo esté parado al lado del cuadro de corcho». Imagen hecha desde el avatar ORIGINAL (`omni/personaje-bueno-original.jpg`) + UNA referencia (el corcho) → `omni/clip2-imagen-al-lado.jpg`. Lo que falló antes: «cerca del corcho» lo puso de cuerpo entero y lejos; «plano medio» lo centró delante. Lo que anduvo: «de pie y con las manos vacías, parada al lado de este corcho: el corcho a un costado y él al otro, de la cintura para arriba. Mira a cámara.» Esperando su OK para el video (Flow, misma receta, 5–8 s, frase del bloque 2 y voz wav nivelado).
- **Lo que sigue:** con el corcho aprobado, la persona entra con la receta que dio la referencia: base = la referencia
  de Martín (él, real) y referencia = el corcho aprobado, en una sola edición: «Misma persona, misma foto en la mano
  y misma luz. Detrás de ella va este corcho, desenfocado como en esta foto.» Después, los clips 1 y 2 con
  `voz\poner-voz.sh`.

## 00 · CAMBIO DE PLAN, 9/11 ~12:15 UTC: los clips 1 y 2 se REGENERAN delante del pizarrón nuevo

Martín, textual: «veo que ya salió bien. Creo que lo mejor sería regenerar tanto el clip 1 como el clip 2 con este
nuevo fondo. Así lo mantenemos durante todo el video.» → **el clip de enlace ya NO hace falta**, y el fondo del reel
es este pizarrón, no la oficina. También dijo: «Todo siempre en la calidad original, también los videos» (memoria
`descargar-calidad-original`): en Flow se baja «1K · Tamaño original», nunca el 2K reescalado.

| pieza | estado | archivo (en `C:\dev\reel-mentores\`) |
|---|---|---|
| Imagen inicial: él delante del pizarrón v3 | ✅ aprobada («ya salió bien») | `finalizar\persona-delante-v1-2k.jpg` (en Flow es la 4.ª del selector de marcos) |
| **Clip 1 nuevo** | hecho, falta el OK | `clips\CLIP1-NUEVO-CON-TU-VOZ.mp4` (de Flow: `clips\clip1-nuevo-flow.mp4`) |
| **Clip 2 nuevo** | hecho, falta el OK | `clips\CLIP2-NUEVO-CON-TU-VOZ.mp4` (de Flow: `clips\clip2-nuevo-flow.mp4`; arranca de `clips\clip1-nuevo-ULTIMO.png`). Voz: 38 ms, 131 Hz |

- **Configuración de los dos, igual a la aprobada:** Video · **Fotogramas** · Omni 1.2 Flash · 720p · 9:16 · 8 s · x1
  · 24 créditos. Pegar una imagen en la caja con el modo Fotogramas puesto la deja de fotograma INICIAL (además de
  subirla).
- **Prompt del clip 1:** «Habla con acento argentino de Buenos Aires. El cuerpo queda quieto, sostiene la foto a cámara
  y dice: "Este es un mensaje para todos los mentores high ticket."»
- **Prompt del clip 2:** «Habla con acento argentino de Buenos Aires. El cuerpo queda quieto y habla a cámara diciendo:
  "Me llamo Martín, tengo 25 años y me estudié a todos los gurús que conoces." Al principio abre la mano y deja caer la
  foto.»
- **La voz:** `bash voz\poner-voz.sh <clip de Flow> <salida>` aplica `LA-CONFIG.json` tal cual: el clon PROFESIONAL
  `I2d6BR9P2dAopVw1khNv`, stability 0, sin speaker boost, loudnorm −14 y `-c:v copy`. ⚠️ La §8 de abajo, con el clon
  normal y un «antes», está VIEJA: gana LA-CONFIG.json. Clip 1: 38 ms de diferencia, 143 Hz (los reales son 128).

## 0 · AL 9/11 ~12:00 UTC (claude4): el PIZARRÓN SOLO, versión 3, esperando el OK de Martín

- **Flow está en la cuenta de Google que en el Chrome de Claude es `/u/2/`**:
  https://flow.google.com/u/2/project/4c7f36b5-74aa-4a7b-876e-e8097775ec6e. Con /u/0 o /u/1, Flow dice que el proyecto
  no existe.
- **El material ya NO vive en scratchpads**, porque se borran. Está en `C:\dev\reel-mentores\`:
  - `voz\`: LA-CONFIG.json, la-config.mjs (que ahora apunta ahí) y la clave;
  - `clip2\`: CLIP1-ULTIMO, LOTE-1 y LOTE-2;
  - `clip2\izq-der\`: los lotes por lado; el izquierdo empieza con Sofía Contreras, Hormozi y Doglio;
  - `pizarron\`: v1, v2 y v3 en 2K.
- **Cómo salió el paso 1:**
  - **v1** = la base `image.png_07353b02.jpg`, subida (editor `/edit/dabd6171-…`), más los dos lotes por lado:
    «En el corcho hay 32 fotos chicas, una por cada una de estas caras… las de la primera referencia van en la mitad
    izquierda». Salieron las 32, sin repetir, del mismo tamaño y con su color, pero en una GRILLA prolija.
  - **v2** = v1 más la referencia del corcho del clip 2. Se ve igual al clip 2, pero REPITE caras y cambia los tamaños:
    descartada. **La referencia de look trae su densidad: si tiene más huecos que caras, repite.**
  - **v3** = v1 subida de nuevo (editor `/edit/05deab67-…`), SIN referencia: «Las mismas 32 fotos, en los mismos
    lugares y del mismo tamaño. Ahora están un poco torcidas, con algunas notas de papel… hilo rojo… como un tablero de
    investigación.» Pasa los puntos 1 a 7 y el 11. Las notas salieron en inglés (CONNECTION?, SUSPECT): lo decide Martín.
- **Paso 2, con el orden que funciona** (docs/video-avatar-desde-foto.md): base = `CLIP1-ULTIMO.png` (la persona) y
  referencia = el pizarrón aprobado, con «La persona queda igual, con la misma ropa y la misma foto en la mano. Detrás
  de ella va este corcho.» Al revés, falla.

## 1 · QUÉ ESTAMOS HACIENDO Y PARA QUÉ

Un **reel vertical de ~30 s para vender MaKo a mentores y coaches high ticket**, calcado en
estructura del reel de **Josep, «el chico de los pistachos»** (crema Tacho), que funciona muy bien.

- **A quién le habla:** mentores y coaches que venden programas caros con llamada.
- **Qué vende:** MaKo, como la app que reemplaza el stack de herramientas y los cursos de gurús.
- **Dónde se publica:** Instagram/TikTok. El CTA es **comentar «App»** para recibir una prueba.
- **Martín aparece en cámara** como personaje generado con IA, no filmado.

**El artefacto con los dos guiones lado a lado —el de Josep y el nuestro— está acá:**

### 👉 https://claude.ai/artifact/3Q3B7ciG1eQLbhcZA4N6jd

Ahí está el reel de Josep desarmado toma por toma (16 tomas, 30,8 s, con los fotogramas reales) y
enfrente el nuestro, bloque por bloque, con los tiempos. **Es la versión 2, la vigente.**

### La estructura, que es lo que se copia de Josep
| bloque | t | qué hace |
|---|---|---|
| 1 · DISPARO | 0–2,9 s | nombra al destinatario y lo pincha |
| 2 · CREDENCIAL | 3,5–8,6 s | por qué le vas a creer |
| 3 · PRODUCTO COMO CONSECUENCIA | 9,6–12,6 s | el producto se deduce, no se presenta |
| 4 · BENEFICIO DEL OTRO | 13,2–16,4 s | lo traduce a lo que el otro quiere |
| 5 · REMATE | 17–20,6 s | vuelve al insulto de la apertura |
| 6 · CIERRE MUDO | 20,6–30,8 s | **10 s sin voz**: insertos + CTA |

Dos mundos alternados (la escena real / el inserto sobre fondo blanco a contraluz). Los insertos de
la primera mitad son flashes de 0,6–1,0 s; los del final se estiran a 1,4–3,1 s.

---

## 2 · EL GUIÓN — las cinco líneas de Martín, textuales, no se tocan

1. «Este es un mensaje para todos los **mentores high ticket**.»
2. «Me llamo Martín, **tengo 25 años** y me **estudié a todos los gurús** que conoces.»
3. «Por eso creé una app para que **no tengas que gastarte miles de dólares en vendehumos**.»
4. «Vas a poder **crear y editar videos como el que estás viendo** en minutos.»
5. «Dejá de comentarle a los que te dan **un triste PDF**. Mejor comentá **"App"** y te regalo **1 semana de prueba**.»

**Cierre mudo:** **COMENTÁ "APP"** y **1 SEMANA GRATIS**.

⚠️ **Sin resolver:** el remate promete «1 semana de prueba» y el **30/10 la prueba gratis quedó
apagada** (entró 50 % el primer mes). Hay que prenderla de nuevo o cambiar el remate. **Martín no
contestó esto.**

---

## 3 · DÓNDE ESTÁ CADA PIEZA

**Proyecto de Flow:** `nov 09 - 04:27`
https://flow.google.com/project/4c7f36b5-74aa-4a7b-876e-e8097775ec6e

| pieza | estado | archivo |
|---|---|---|
| **Clip 1** — él en la oficina sosteniendo una polaroid de un gurú | **aprobado** | `Downloads\Young_man_holding_photo_card_0240f818.mp4` |
| Piezas sobre fondo blanco (dedo arriba, brazos cruzados, perfil manos) | **hechas** | `Downloads\Person_crossing_arms_*.mp4`, `Man_moving_fingers_*.mp4`, `Brazo_levantado_*.mp4` |
| **Clip 2** — delante del corcho, suelta la foto y dice el bloque 2, con su voz | ✅ **APROBADO** | `Downloads\CLIP2-v2-CON-TU-VOZ.mp4` |
| **Clip de enlace** (del clip 1 al clip 2) | **en curso — ver §4** | — |
| Clips 3, 4, 5 y cierre mudo | **sin empezar** | — |

### Material de trabajo
Carpeta: `C:\Users\marti\AppData\Local\Temp\claude\fb1d94a1aca5ced3\1513b896-575e-41c6-9939-5fc19e4bad6a\scratchpad\`

- `tablero-lotes.py` → `clip2\LOTE-1.jpg` y `LOTE-2.jpg` — 16 caricaturas de 225 px cada uno. **Es el que anda.**
- `clip2\CLIP1-ULTIMO.png` — último fotograma del clip 1. **Acá la cara de Martín y la de Ramiro en la polaroid se ven BIEN.**
- Las 32 caricaturas salen de `C:\dev\wt-push-q\public\asesores\grandes\*.png`.
- **`Downloads\image.png_4a780f5f.jpg`** — el corcho del clip 2. **Es LA referencia de look**: fotos chicas, muchas, con su color y la luz del cuarto.
- `Downloads\image.png_07353b02.jpg` — el pizarrón en el cuarto **sin la mesa**, base limpia del paso 1.

---

## 4 · EL CLIP EN EL QUE ESTAMOS: el ENLACE entre la toma 1 y la toma 2

### El problema que resuelve
El clip 1 pasa en **la oficina** (monitores, estudio) y el clip 2 delante del **pizarrón**. Martín:
*«no veo conexión entre la toma 1 y la toma 2… el fondo es diferente».* Y no quiere el pizarrón en
todo el reel: *«no me gusta mucho este fondo para todo el video… sí me gusta el otro, el de la
oficina».*

### La solución que él eligió
Un clip de transición que **empieza con el último fotograma del clip 1** (él en la oficina), **se
levanta, la cámara se mueve y aparece el pizarrón**. Se hace con el modo **primer y último
fotograma** de Omni (Flow: modo «Fotogramas» + botones **Iniciar** y **Finalizar**).

| | qué es | estado |
|---|---|---|
| **Iniciar** | `scratchpad\clip2\CLIP1-ULTIMO.png` | ✅ listo y ya subido a Flow |
| **Finalizar** | él de pie delante del pizarrón, con la polaroid | ❌ **es lo que falta** |

### ⛔ LO QUE HAY QUE HACER, en este orden (método de Martín, 9/11)

> *«Un truco que yo hago es tener una cosa y luego tener 100% lo otro. Yo lo que haría es tener
> **100% el pizarrón sin la persona**, y luego metería **la persona del clip que ya tenemos**, que
> estoy sujetando esa foto y me veo muy bien ahí y Ramiro se ve muy bien. Puedes literalmente
> decirle: ahora que ya tenemos este pizarrón, **pon a esta persona con la misma foto y la misma
> pose enfrente**. Y listo, es eso nomás.»*

**Paso 1 — el PIZARRÓN SOLO, sin persona, hasta el 100 %.**
Base limpia: `Downloads\image.png_07353b02.jpg`. Tiene que quedar con:
- caras **nítidas**, **del mismo tamaño**, **sin repetir**;
- **Sofía Contreras, Alex Hormozi y Francisco Doglio bien visibles** — Martín los quiere ver y
  quedaron escondidos. ⚠️ **Que caigan en la mitad IZQUIERDA del corcho**, porque la persona tapa la derecha;
- con **su color** y la **luz del cuarto** — referencia de look: `Downloads\image.png_4a780f5f.jpg`.

**Paso 2 — meter a la persona, UNA sola edición.**
Referencia: `scratchpad\clip2\CLIP1-ULTIMO.png`. Frase:

    Pon a esta persona, con la misma foto en la mano y la misma pose, delante de este pizarrón.

**Paso 3 — el clip de enlace.** Iniciar + Finalizar puestos, y:

    La cámara acompaña mientras él se levanta y camina hasta la pared del pizarrón.
    Sigue con la foto en la mano.

Sin voz: es una transición. **Omni 1.2 Flash · Fotogramas · 720p · 9:16 · x1 · 24 créditos.**

### Lo que está mal en el último intento (y por qué)
Martín: *«La cara de Ramiro sigue deformada —la de la tarjeta que estoy sujetando— y se deformaron
también las caras que están atrás.»* Causa: **nueve ediciones encadenadas** sobre la misma imagen.
Por eso el método de arriba: cada pieza en su cadena corta, y la unión en una sola edición.

---

## 5 · LAS REGLAS DE MARTÍN (sus palabras)

| tema | lo que dijo | dónde vive |
|---|---|---|
| **Cadena** | ⛔ «**no generes sobre otro generador, que vuelvas para atrás**. Eso, como regla, porque provoca que la IA haga estas cosas» | AGENTS.md |
| **Armado** | «tener **100 % el pizarrón sin la persona**, y luego metería la persona del clip que ya tenemos» | AGENTS.md |
| **Revisión** | «el **mismo feedback que antes**… para ser **criterioso, mirar y revisar** si está bien luego» | AGENTS.md + §6 |
| **Contexto** | «cada clip que salga, que salga con **todas las configuraciones**… que cada generación **traiga todo un contexto**, pues si no estamos dando vueltas» | AGENTS.md |
| **Orden** | «**primero la imagen**. O las imágenes en este caso. **Y después el clip**» | Avatar Hype |
| **Referencia** | «**dale la referencia que ya habíamos logrado**, que son más chiquitas las imágenes y justamente tiene la **iluminación correcta**» | docs/video-avatar-desde-foto.md |
| **Degradación** | «**pásale nuevamente la referencia**… se están pixeleando, se están cortando, están desfigurándose» | ídem |
| **Simpleza** | «está muy complejo… **se tiene que ver real** también» | ídem |
| **Color** | ⛔ «**no quiero que se les quite el color de fondo** a cada foto» | §6 |
| **Tamaño** | «que tengan **evidentemente el mismo tamaño**» · «me gustaba **la última versión que habíamos logrado**» | §6 |
| **Unicidad** | «**que no repita influencer**» · «asegúrate de pasarles **las suficientes** para que tengan material» | §6 |
| **Voz** | «**estable tiene que ser cero**… **copiarlo idéntico**… si tienes otra información, **borra el resto**» | LA-CONFIG.json |
| **Acento** | «suena como **español** en lugar de argentino» | §8 |

---

## 6 · CHECKLIST DEL CORCHO — mirar la imagen contra esto ANTES de mandarla

Martín dio dos veces el mismo feedback porque yo miraba el resultado sin compararlo con lo ya dicho.
**Se recorre mirando la imagen, punto por punto.**

| # | tiene que pasar | cómo falló |
|---|---|---|
| 1 | El corcho está **lleno**, con muchas fotos chicas | quedó medio vacío, dos veces |
| 2 | Son **las caricaturas de los gurús** | Flow las inventa si no le pasás los lotes |
| 3 | **Todas del mismo tamaño** | «evidentemente el mismo tamaño» |
| 4 | **Ninguna se repite** | «repitió a muchas y no usó a otras» |
| 5 | **No parecen stickers** | «vuelven a ser stickers», dos veces |
| 6 | **Conservan su color de fondo** | ⛔ pedir «fondo claro» las BLANQUEA — rechazado |
| 7 | **Nítidas y completas** | se degradan tras 3-4 ediciones encadenadas |
| 8 | Escena **simple y real** | «está muy complejo» |
| 9 | **La cara de la persona** — mirar los ojos de cerca | «el personaje tiene el ojo raro» |
| 10 | **Lo que sostiene en la mano** está nítido | «la foto que está sujetando salió deforme» |
| 11 | **Se ven los gurús que le importan** | Sofía Contreras, Alex Hormozi y Francisco Doglio quedaron escondidos |

**Qué resuelve cada cosa, probado:**
- **(1) y (4):** adjuntar `LOTE-1` + `LOTE-2` y **decir el número**: «van estas 32 caras, una sola vez
  cada una». Un adverbio («llenándolo») hace que multiplique y repita.
- **(5) sin romper (6):** **la mejor referencia es un resultado ya aprobado**, no describir el efecto.
  Pasarle `image.png_4a780f5f.jpg` y decir «el corcho queda como el de esta referencia: las fotos de
  ese tamaño, esa cantidad y esa misma luz». Describirlo con palabras falló cuatro veces.
- **(7), (9), (10):** volver a pasar la referencia de eso, y **no encadenar más de 2-3 ediciones**.

⚠️ **Cada pedido ancla lo ya aprobado**: «La persona, su pose y el cuarto quedan igual». Si no, al
arreglar una cosa se rompe la otra.

---

## 7 · CÓMO SE MANEJA FLOW DESDE ACÁ

Detalle completo con los intentos fallidos en **`docs/video-avatar-desde-foto.md`**. Lo operativo:

1. **Las capturas de pantalla se cuelgan** (`Page.captureScreenshot timed out`) pero la página vive:
   se trabaja con `get_page_text`, `read_page` y `javascript_tool`.
2. **Una imagen propia entra por el PORTAPAPELES** — el `input[type=file]` no existe hasta que lo
   toca una persona, ni con el `+` del editor:

       Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing
       $img = [System.Drawing.Image]::FromFile("C:\ruta\REF.jpg")
       [System.Windows.Forms.Clipboard]::SetDataObject($img, $true)

   ⚠️ **Tiene que ser VERTICAL** (4:5 o 9:16). Una apaisada se sube como imagen nueva y te abre SU editor.
3. **La secuencia que funciona:** entrar al editor **por URL** → **clic real** en la caja (sobre
   `rect.x + 25`; mide 20 px de alto) → `Ctrl+V` → **clic real en la caja otra vez** → escribir →
   **verificar `location.pathname` y el texto** → clic en la flecha.
   Nunca `Ctrl+A`, nunca `.focus()` por JS, nunca `submit.click()`.
4. **Lo que queda intacto va de imagen BASE; lo que se cambia entra como REFERENCIA.**
5. **Las imágenes son gratis**; un video 720p 8 s x1 cuesta **24 créditos**. ⚠️ El cartel «out of
   credits» de las 04:00 **ya no aplicaba** a las 10:30: **el saldo se mira en el momento**.

---

## 8 · LA VOZ

**Una sola configuración, en un solo lugar, se copia idéntica:** `scratchpad\walter\LA-CONFIG.json`,
aplicada con `la-config.mjs <origen.wav> <salida.mp3>`. **Nunca escribirla a mano.**

    voz:      1crLVxcTqcz5I2mDmBlO   (clon normal «wav nivelado»)
    model_id: eleven_multilingual_sts_v2   ·   output_format mp3_44100_192
    settings: { stability: 0, similarity_boost: 1, style: 1, use_speaker_boost: false }
    antes:    loudnorm=I=-19:TP=-3:LRA=11,highpass=f=70   sobre el audio de ORIGEN
    después:  loudnorm=I=-14:TP=-1:LRA=11   y montar con -c:v copy

⚠️⚠️ **El acento NO se arregla en ElevenLabs.** El voice-to-voice conserva la prosodia del audio de
origen: si Omni habla en español de España, el clon lo arrastra. **Se arregla regenerando el video**
con el acento **al principio** del prompt: «Habla con acento argentino de Buenos Aires. …».
Eso fue lo que destrabó el clip 2.

---

## 9 · LO QUE FALTA, EN ORDEN

1. **El pizarrón solo al 100 %** (§4, paso 1).
2. **Meterle la persona**, una sola edición (§4, paso 2).
3. **El clip de enlace** (§4, paso 3).
4. **Los clips 3, 4 y 5** del guión, cada uno con su imagen primero.
5. **El cierre mudo** de 10 s.
6. **Montar el reel** y los subtítulos: blancos, centrados, **a media altura (no abajo)**, 2-3
   palabras por cartel, como los de Josep.

### Sin respuesta de Martín
- El **«1 semana de prueba»** del remate contra la decisión del 30/10.
- Si la polaroid tiene que mostrar **exactamente** la misma caricatura que el clip 1 (perdió la gorra).

### Avisos sueltos
- Se le **pisó el portapapeles** con las imágenes de referencia.
- En el proyecto de Flow quedaron varias tarjetas «Imagen subida» de los pegados: conviene barrerlas.
- En la papelera de Flow está la versión vertical del tablero (`/project/<id>/trash` → «Restaurar todo»).

---

## 10 · LOS PROMPTS DE FLOW QUE FUNCIONARON

    Un tablero de corcho con fotos unidas por hilo rojo, en la pared de una habitación normal con luz de día.
    En el corcho sólo hay fotos de caras de personas.
    Misma persona y mismo cuadro. En el corcho hay 32 fotos, una por cada una de estas caras.
    Las mismas caras, repartidas por todo el corcho.
    La persona queda igual, con la misma ropa y la misma foto en la mano. Detrás de ella va este corcho.
    El corcho de atrás queda un poco desenfocado, como en una foto de verdad. Las fotos mantienen sus colores.
    El mismo pizarrón y la misma pared. Debajo del pizarrón la pared sigue vacía hasta el piso.
    El corcho queda como el de esta referencia: las fotos de ese tamaño, esa cantidad y esa misma luz.
    Habla con acento argentino de Buenos Aires. El cuerpo queda quieto y habla a cámara diciendo: "…".
       Al principio abre la mano y deja caer la foto.

- **(~14:25) Martín: «toma la imagen del fondo sin nadie y le agregas el personaje. No al revés».** Con el personaje de base, el corcho salió desfasado y la pared apuntando para otro lado. Base = `aprobado/corcho-v3-1k.jpg`, referencia = `omni/personaje-bueno-original.jpg`, frase: «Agrega a esta persona de pie al lado del corcho, mirando a cámara, con las manos vacías. El corcho, la pared y el cuarto quedan igual.» → `omni/clip2-fondo-mas-persona.jpg`: perspectiva intacta. **Regla: cuando el que manda es el escenario, el FONDO va de base y la persona entra de referencia. Antes de mandar, revisar la perspectiva del fondo y de la pared.** Esperando su OK para el video.

- **(~14:40) Clip 2, pruebas con el método nuevo de Martín** (primero ALEJAR el fondo solo, después agregar a la persona; rostro «exactamente igual al original» en cada frase; revisar escala, rostro y perspectiva ANTES de mandar):
  - `omni/fondo-alejado.jpg` ✅: el corcho elegido, más chico en la pared, con más pared, piso y la ventana (frase: «La misma pared y el mismo corcho, con la cámara un poco más lejos: el corcho se ve más chico, con más pared y piso alrededor.»).
  - `omni/clip2-v4.jpg`: base = fondo alejado + avatar original. Escala REAL, pero de cuerpo entero y lejos: la cara es chica y pierde el parecido. No mandada.
  - v5 (en Flow, `/edit/52bc9f7a-…`, sin bajar): «cerca de la cámara, de la cintura para arriba, a un costado del corcho» → quedó cortado en el borde izquierdo y de costado. No mandada.
  - (~14:45) Persona del lado derecho, «de la cintura para arriba», sin decir «primer plano» → otra vez de cuerpo entero junto a la pared (Flow respeta la cámara de la base). No mandada.
  - ✅ **(~14:50) `omni/clip2-imagen-A.jpg`** (Flow `/edit/4b5c7b50-…`, versión `166bd9d0`): base = `omni/fondo-alejado.jpg`, ref = `omni/personaje-bueno-original.jpg`, frase: «Agrega a esta persona en primer plano, cerca de la cámara, a la derecha: se ve de la cintura para arriba, de frente, con las manos vacías. El corcho queda detrás, a su izquierda, entero. Su rostro, sus expresiones, su pelo y su ropa son idénticos a los del original. El corcho, la pared y el cuarto quedan igual.» De la cintura para arriba, el corcho entero detrás, pared recta, escala real. La cara es la misma, apenas más fina que en el selfie original. **La llave fue «en primer plano, cerca de la cámara».** Mandada a Martín junto al original (`omni/clip2-A-al-lado-del-original.jpg`); **falta su OK** para gastar los créditos del video.
  - Muestra B (`omni/clip2-primer-plano-b.jpg`, versión `573259b5`, misma base y misma referencia, frase con «misma forma de cara, mismos ojos…»): más corrida a la derecha y cortada en el borde. Quedó la A.
  - **(~14:55) Martín sobre la A:** «me gusta más», pero (1) «estaría parado más cerca, casi al lado de las imágenes, o luego en el video poder señalarlo o jugar mirando las imágenes»; (2) «me gusta que sea ese el estilo del fondo, pero no que esté tan sucio, feo el piso o el techo. Sutileza sí puede tener, pero no tanto».
  - (2) se corrigió en el fondo ORIGINAL (`aprobado/corcho-v3-1k.jpg`, Flow `/edit/56f90c16-…`), una edición: «El piso de madera y el techo se ven limpios y cuidados, con apenas un poco de uso. El corcho, las fotos, la pared y la ventana quedan igual.» → `omni/fondo-limpio.jpg` (versión `f6d68206`): el corcho y las fotos idénticos, el piso prolijo. **Trampa: alejar el fondo le había inventado el piso manchado y el techo descascarado.**
  - (1) base = `omni/fondo-limpio.jpg` (cámara cercana, NO el alejado), ref = `omni/personaje-bueno-original.jpg`, frase: «Agrega a esta persona de pie justo al lado del corcho, del lado derecho, pegada a las fotos como para poder señalarlas: se ve de la cintura para arriba, de frente a cámara, con las manos vacías. Su rostro, sus expresiones, su pelo y su ropa son idénticos a los del original. El corcho, la pared y el cuarto quedan igual.» → ✅ `omni/clip2-imagen-B.jpg` (versión `373b784a`): pegado al corcho y señalando las fotos, cabeza ≈ 2,5 fotos (escala real), misma cara (hasta la cadenita), pared y corcho intactos. Mandada con `omni/clip2-B-al-lado-del-original.jpg`; **falta su OK**.
  - **(~15:20) Martín sobre la B:** «Sí, me gusta», pero las notas del corcho en español, sin romper las fotos de los gurús, y regrabar también el clip 1 (salió con notas en inglés); «ya con eso podríamos grabar el clip 1 y 2».
  - Notas en español, todo desde `omni/fondo-limpio.jpg` (Flow `/edit/56f90c16-…`), sin editar encima de lo generado:
    - 1.ª «Las notas… en español: ¿CONEXIÓN?, SOSPECHOSO, ¿COARTADA? y PISTAS…» → quedó «LAST SEEN?» en inglés.
    - 2.ª «Todas las notas… con palabras como …» → el modelo agregó CRONOLOGÍA y la escribió «CRDIIOLOGÍA»; la rosa, sin sentido.
    - 3.ª (encima de la 2.ª, para arreglar dos notas) → cambió la nota equivocada. Descartada.
    - ✅ 4.ª `omni/fondo-espanol-4.jpg` (versión `f3f32103`): «Todas las notas de papel del corcho están escritas en español, con palabras cortas y simples: ¿DÓNDE?, PISTAS, MOTIVO, FECHAS, SOSPECHOSO y ¿COARTADA?. Las fotos de las caras, el hilo rojo, el corcho y el cuarto quedan exactamente igual.» Todas las legibles en español, caras intactas (revisadas lado a lado con el fondo limpio). **Regla: darle la lista cerrada de palabras CORTAS; si no, inventa una larga y la escribe mal.**
  - Clip 2 sobre ese fondo: la frase de la B dio dos veces una persona más atrás y sin señalar (`clip2-espanol.jpg`, `-b.jpg`). Con «señalando una de las fotos con la mano» (sin «manos vacías») → `-c.jpg` (pelo menos enrulado) y ✅ **`omni/clip2-espanol-d.jpg`** (versión `8480abfb`): pegado al corcho, señalando, cara y rulos iguales. Frase: «Agrega a esta persona de pie pegada al corcho, del lado derecho, señalando una de las fotos con la mano: se ve de la cintura para arriba y mira a cámara. Su rostro, sus expresiones, su pelo y su ropa son idénticos a los del original. El corcho, la pared y el cuarto quedan igual.»
  - Clip 1 sobre ese fondo: ✅ **`omni/clip1-espanol.jpg`** (versión `29428905`), igual encuadre que el aprobado, con la polaroid: «Agrega a esta persona en primer plano, muy cerca de la cámara, sosteniendo la foto como en el original: se ve del pecho para arriba, de frente a cámara, con el corcho detrás. Su rostro, sus expresiones, su pelo, su ropa y la foto son idénticos a los del original. El corcho, la pared y el cuarto quedan igual.»
  - Panel de video en el proyecto (persiste entre recargas): Video · Fotogramas · Omni 1.2 Flash · 720p · 9:16 · x1. La duración es un deslizador «Longitud» (`input[type=range]` 0–7; 2 = 5 s). Pegar la imagen en la caja la deja de fotograma inicial (el botón «Iniciar» pasa a «cancel»).
  - **(~15:30) Dos revisores (workflow `wf_b89a9b2a-856`) frenaron las dos imágenes antes de gastar:** el post-it amarillo de arriba a la derecha decía «MOTIMO» (V rota, viene del fondo 4) y en `clip2-espanol-d.jpg` el barbudo del buzo rojo quedó con el mentón blanqueado. Lo de la persona estaba bien.
    - Arreglo en el FONDO, una edición localizada sobre `fondo-espanol-4`: «¿QUIÉN?» salió ilegible («UGOCH?», la nota está inclinada en el borde) → desde la 4 otra vez: «El post-it amarillo que está más a la derecha del corcho, arriba, tiene solo dos signos de pregunta grandes: ??. …» → ✅ **`omni/fondo-espanol-6.jpg`** (versión `2223ecf1`). La resta de píxeles contra la 4 sólo marca ese post-it; las caras, idénticas. **Regla: en una nota inclinada o chica, símbolos («??»), no palabras.** **Regla: verificar cada edición de fondo con una resta de píxeles (`blend=all_mode=difference`) contra la versión anterior.**
    - ✅ **Clip 1:** `omni/clip1-final-a.jpg` (versión `87b49a83`), misma frase de la polaroid. ✅ **Clip 2:** `omni/clip2-final-a.jpg` (versión `cf5aaa4b`), frase «señalando una de las fotos con la mano»; señala el «??» con círculo; las caras que quedan a la vista, intactas (las que no se ven las tapa la mano).
    - Videos lanzados en Flow (~15:45): clip 1 = 5 s (15 créditos), clip 2 = 8 s (24 créditos). El deslizador «Longitud» va de 0 a 7: 2 = 5 s, 5 = 8 s. Prompts en inglés con la receta de CLIP-wavnivel; el del clip 2 cambia la acción: «While he speaks he keeps pointing at the photos on the cork board, glances at them once and looks back at the camera.»
  - ✅ **(~15:38) Clips 1 y 2 hechos y mandados a Martín:** `C:/dev/reel-mentores/clips-espanol/CLIP1-ESPANOL-CON-TU-VOZ.mp4` (5,06 s, voz a 27 ms) y `CLIP2-ESPANOL-CON-TU-VOZ.mp4` (8,08 s, 38 ms). De Flow: `clip1-flow.mp4`, `clip2-flow.mp4` (720p original). Voz con `voz/poner-voz-wavnivel.sh`. **Falta su OK.** (Ojo: `clips-final/` tiene los clips VIEJOS rechazados; los nuevos están en `clips-espanol/`.)
  - Martín pidió MEDIR los tiempos de cada paso y preguntarse después si se podía más rápido sin perder calidad: planilla `C:/dev/reel-mentores/tiempos.csv`, resumen y respuestas en `docs/manual-video-mako.md` §6.11.
  - **(~15:40) Martín:** «el primer clip queda cien por ciento… me gusta que tenga algo de movimiento». Guardar el clip 2, pero probar una VARIACIÓN: desde el último fotograma del clip 1, que diga la frase 2 y «en lo que va diciendo la frase, que tire la tarjetita que tiene en la mano». (Excepción pedida por él a «cada clip desde el avatar original».) Último fotograma: `C:/dev/reel-mentores/clips-espanol/clip1-ultimo-fotograma.png` (720×1280, PNG). Prompt del clip 2 con: «While he speaks, he tosses the polaroid photo card he is holding out of the frame with a casual flick of his hand.» 8 s, 24 créditos. A las 15:43 Flow lo frenó con «Detectamos actividad inusual» (unas 30 generaciones en 75 min): no se generó; se espera 5 min y se relanza.
  - ✅ **(~16:08) Variación del clip 2 hecha y mandada:** `C:/dev/reel-mentores/clips-espanol/CLIP2-VARIACION-CON-TU-VOZ.mp4` (8 s; tira la polaroid a los 0,6 s). Se relanzó a las 16:04 tras dos rechazos de «actividad inusual» (15:43 y 15:49, sin video). El clip 1 quedó APROBADO («queda cien por ciento»).
  - ✅ **(~16:20) Clip 3 hecho y mandado:** imagen `omni/clip3-imagen-b.jpg` (Martín: «está perfecto», 2.ª muestra; la 1.ª salió corrida y chica), frase «Por eso creé una app para que no tengas que gastarte miles de dólares en vendehumos.», 8 s, 24 créditos medidos (684 → 660), sin la polaroid por continuidad con el clip 2. `clips-espanol/CLIP3-CON-TU-VOZ.mp4`. Frase de la imagen que funcionó: «Agrega a esta persona en el centro, con el mismo encuadre de cerca que en el original, como un selfie: se ve del pecho para arriba, de frente a cámara, con las manos abajo y el corcho detrás. …»
  - Reglas nuevas de Martín (9/11 tarde): continuidad entre clips; de video NO se hacen variaciones (cada video espera el OK a su imagen); medir los tiempos. Están en AGENTS.md y en el manual.
  - **(~16:30) Martín sobre el clip 3:** Omni REPITIÓ palabras («…en vendehumo, en vendehumos») porque se le dieron 8 s para 16 palabras → regla de duración por palabras (AGENTS.md, manual) y chequeo con `C:/dev/reel-mentores/voz/chequear-guion.mjs` (transcribe y compara). Y lo quiere mostrando el celular con MaKo (Segundo Cerebro). No se graba la pantalla (la app /m/ desde la PC manda al Ops Center): la pantalla la inventa Flow.
    - Asset nuevo `omni/avatar-celular.jpg` (versión `0acbe592`): base = avatar original, sin referencia: «En vez de la foto, sostiene un celular con la pantalla mirando a cámara. En la pantalla se ve una app oscura con un mapa de puntos azules y celestes unidos por líneas finas, como una red de ideas. Su rostro, sus expresiones, su pelo, su ropa y el cuarto quedan exactamente igual.»
    - Combinación `omni/clip3-celular.jpg` (versión `c1fa94ce`): base = `fondo-espanol-6`, ref = avatar-celular, la frase del clip 1 con «sosteniendo el celular como en el original». Mandada a Martín para su OK. Video previsto: 7 s (16 palabras con gesto → 0,8 + 5,7 + 0,3), 21 créditos.
  - **(~16:40) Martín prefirió un CRM al Segundo Cerebro.** `omni/avatar-crm.jpg` (versión `4e14400c`, desde el avatar original): «En vez de la foto, sostiene un celular con la pantalla mirando a cámara. En la pantalla se ve una app de ventas oscura, como un CRM: columnas con tarjetas de clientes, cada una con una foto redonda y una etiqueta de color azul, verde o naranja. …». Pidió probarlo en modo claro: rehacerlo desde el original con «clara, de fondo blanco» dio OTRO diseño (Martín: «algo mal le diste en el prompt»); lo correcto fue editar la imagen que le gustó: «La pantalla del celular pasa a modo claro: el mismo diseño, las mismas columnas, tarjetas, fotos y etiquetas de colores, pero con fondo blanco y letras oscuras. …» → `avatar-crm-blanco.jpg`, idéntico en claro. **Regla: «tal cual, pero X» = editar la imagen aprobada pidiendo sólo X, nunca regenerar.** Al final eligió el OSCURO.
  - ✅ **(~16:58) Clip 3 final:** `omni/clip3-crm-oscuro.jpg` (versión `00dff70c`: fondo-espanol-6 + avatar-crm de referencia, la frase de siempre con «sosteniendo el celular como en el original») → video 7 s (16 palabras), 21 créditos, chequeo del guion EXACTO (habla 0,78–6,10 s) → `clips-espanol/CLIP3-CRM-CON-TU-VOZ.mp4`. Mandado.
  - **(~18:00) Clip 4:** Martín cambió el guion a «Vas a poder crear y editar videos como el que estás viendo en este momento.» Se transforma en la caricatura de Hormozi de la app (`public/asesores/hormozi.png`; la cara REAL de Hormozi no se genera: sería su imagen en un anuncio) y vuelve: dos videos de 4 s con fotograma inicial y final (vos → caricatura «Vas a poder crear y editar videos»; caricatura → vos «como el que estás viendo en este momento»). Fotogramas sin celular: `clip4/clip4-martin-sin-celular.jpg` y `clip4/clip4-caricatura-sin-celular.jpg` (pedido corto «Que sea la persona de la referencia, tal cual.» + la caricatura de la app: la más fiel). **Regla: con la foto de referencia alcanza; el pedido largo la aleja (Martín: «Dale la foto y sabrá, no tanto prompt»).**
  - La variación del clip 2 hecha desde el último fotograma del clip 1 DERIVÓ la cara (Martín: «el 2 creo que no es»): se rehace desde `omni/clip1-final-a.jpg`, 7 s. Confirma la regla: cada clip desde la imagen original, nunca desde un cuadro de video.
  - ✅ **(~18:20) Clips listos y mandados** (en `C:/dev/reel-mentores/clips-espanol/` y en Descargas › «Reel mentores high ticket (9-11)» › «1 - Clips finales con tu voz»): clip 1 (aprobado), clip 2 variación V2 (desde `clip1-final-a.jpg`, 7 s, guion exacto), clip 2 señalando (guardado), clip 3 CRM (7 s, exacto), clip 4 = 4a vos→caricatura «Vas a poder crear y editar videos» + 4b caricatura→vos «como el que estás viendo en este momento» (4 s c/u, guion exacto), unidos en `CLIP4-CON-TU-VOZ.mp4`. Créditos al cierre: medir de nuevo (684 a las 16:15; clip 3 = 21, clip 4 = 24, variación = 21).
  - **(~18:30) Clip 5, guion nuevo de Martín:** «Dejá de comentarle a los vendehumos que solo te dan un PDF… Mejor comentá "App" y te regalo 1 semana de prueba.» Martín: se hace HUMO durante la primera frase. Dos videos lanzados en Flow (18:31 y 18:33 UTC): 5a = inicio `clip4/clip4-martin-sin-celular.jpg`, final `omni/fondo-espanol-6.jpg` (cuarto vacío), 7 s, se disuelve en humo gris al terminar la frase; 5b = inicio el cuarto vacío, final su imagen, reaparece desde el humo y dice el CTA, 5 s. Falta: bajarlos (el más nuevo es el 5b), `voz/chequear-guion.mjs`, `voz/poner-voz-wavnivel.sh`, unirlos en `CLIP5-CON-TU-VOZ.mp4` (concat como el clip 4) y mandarlos.
  - ✅ **(~18:40) Clip 5 hecho y mandado:** `clips-espanol/CLIP5-CON-TU-VOZ.mp4` (12 s = 5a 7 s + 5b 5 s, guion exacto en las dos; el humo funcionó con fotograma inicial/final). En Descargas › «1 - Clips finales con tu voz». **Sigue: el cierre mudo (~10 s, CTA «COMENTÁ "APP"» y «1 SEMANA GRATIS») y el montaje con subtítulos.**
  - **(~18:50) Martín sobre el clip 5:** «No me gusta mucho el efecto… que se vaya convirtiendo en humo MIENTRAS va diciendo eso… más realista, no tan caricaturesco», y «cuando digo mejor comentá App ahí ya no debería ser humo». PENDIENTE (Flow frenó por actividad inusual a las 18:51; reintentar ~19:06):
    - 5a (7 s, 21 cr): inicio `clip4/clip4-martin-sin-celular.jpg`, final `omni/fondo-espanol-6.jpg`, prompt: «Vertical 9:16, one continuous handheld shot, no cuts, photorealistic. The young man looks straight at the camera and says, IN SPANISH, exactly this and nothing else: «Dejá de comentarle a los vendehumos que solo te dan un PDF.» He speaks CONTINUOUSLY, taking about 4.3 seconds. Serious, direct tone, young man from Uruguay. From his first words, his body slowly and gradually turns into thin, translucent wisps of real smoke, like incense smoke drifting in the room, starting at his shoulders and spreading while he keeps talking, until by the last word he has completely faded away, leaving the empty room of the last frame. No on-screen text, no subtitles.»
    - 5b (5 s, 15 cr): Martín: «tiene que tener un efecto de reaparición, porque si no es como medio aparezco así de la nada». Inicio = `omni/fondo-espanol-6.jpg` (cuarto vacío), final = `clip4/clip4-martin-sin-celular.jpg`. Prompt: el mismo humo realista (thin translucent wisps, like incense smoke) se junta en el primer segundo y lo forma; ya entero, sin humo, mira a cámara y dice «Mejor comentá App y te regalo una semana de prueba.» (about 3 seconds), photorealistic.
    - Después: chequear-guion, poner-voz-wavnivel, concat → `CLIP5-CON-TU-VOZ.mp4` (reemplaza al de la nube grande), mandar y actualizar Descargas.
  - ✅ **(~19:10) Clip 5 V2 hecho y mandado:** `clips-espanol/CLIP5-V2-CON-TU-VOZ.mp4` (5a humo realista que lo disuelve mientras habla + 5b reaparece desde el humo y dice el CTA sin humo; guion exacto en las dos). Reemplazó al de la nube caricaturesca en Descargas. **Sigue: cierre mudo (~10 s) y montaje con subtítulos.**
  - **(~19:15) Martín prefirió el clip 5 DEL INICIO** (CLIP5-CON-TU-VOZ.mp4, la nube): «salió bastante mal el efecto… prefiero el del inicio. Dale libertad sobre todo a Flow que lo genere como le parezca». Restaurado en Descargas. Regla: un efecto se pide corto (qué y cuándo), sin la receta.
  - (viejo) clip 5 (bloque 5: «Dejá de comentarle a los que te dan un triste PDF. Mejor comentá "App" y te regalo 1 semana de prueba.»), el cierre mudo de ~10 s y el montaje. Cada imagen primero para el OK; duración por palabras; chequeo del guion. (bloques 4 y 5 del guion), el cierre mudo y el montaje — cada imagen se manda primero para el OK.
  - **Con el OK:** en Flow, Fotogramas · Omni 1.2 Flash · 720p · 9:16 · x1, desde la imagen que apruebe (hoy `omni/clip2-imagen-B.jpg`, 1K original), frase 2: «Me llamo Martín, tengo 25 años y me estudié a todos los gurús que conoces.», prompt en inglés con la receta de CLIP-wavnivel (sin la polaroid). Después `bash voz/poner-voz-wavnivel.sh`.
