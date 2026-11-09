# Relevo — El reel para mentores high ticket (9/11/2026, claude1 al 99 %)

Martín y yo estuvimos armando un reel vertical calcado del de **Josep, «el chico de los
pistachos»** (crema Tacho), orientado a **mentores high ticket**, para MaKo. Esto es todo lo que
hay que saber para seguir sin volver a preguntar nada.

---

## 1. El guión, con las palabras de Martín

Él escribió estas líneas; **son textuales suyas y no se cambian sin que él lo pida**:

| bloque | t | lo que dice |
|---|---|---|
| 1 · DISPARO | 0,0–2,9 s | «Este es un mensaje para todos los **mentores high ticket**.» |
| 2 · CREDENCIAL | 3,5–8,6 s | «Me llamo Martín, **tengo 25 años** y me **estudié a todos los gurús** que conoces.» |
| 3 · PRODUCTO | 9,6–12,6 s | «Por eso creé una app para que **no tengas que gastarte miles de dólares en vendehumos**.» |
| 4 · BENEFICIO | 13,2–16,4 s | «Vas a poder **crear y editar videos como el que estás viendo** en minutos.» |
| 5 · REMATE | 17,0–20,6 s | «Dejá de comentarle a los que te dan **un triste PDF**. Mejor comentá **“App”** y te regalo **1 semana de prueba**.» |
| 6 · CIERRE MUDO | 20,6–30,8 s | sin voz: **COMENTÁ “APP”** y **1 SEMANA GRATIS** |

**La página con el guión lado a lado contra el de Josep (versión 2, la vigente):**
https://claude.ai/artifact/3Q3B7ciG1eQLbhcZA4N6jd

⚠️ **El «1 semana de prueba» choca con la decisión del 30/10**, donde la prueba gratis quedó
apagada y entró 50 % el primer mes. Hay que prenderla de nuevo antes de publicar el reel, o
cambiar el remate. **Martín todavía no contestó esto.**

### La estructura del reel de Josep, por si hace falta volver a ella
30,8 s, 16 tomas, dos mundos alternados (la nave real / el inserto sobre blanco a contraluz).
Habla sólo hasta los 20,5 s; los últimos 10 s son mudos. El desarme completo está en
`docs/video-avatar-desde-foto.md`.

---

## 2. Dónde está cada pieza

**El proyecto de Flow:** `nov 09 - 04:27`
https://flow.google.com/project/4c7f36b5-74aa-4a7b-876e-e8097775ec6e

| pieza | estado | archivo |
|---|---|---|
| Clip 1 (él con la polaroid, estudio) | **hecho, aprobado** | `C:\Users\marti\Downloads\Young_man_holding_photo_card_0240f818.mp4` |
| Piezas sobre fondo blanco (dedo arriba, brazos cruzados, perfil manos) | **hechas** | `Downloads\Person_crossing_arms_*.mp4`, `Man_moving_fingers_*.mp4`, `Brazo_levantado_*.mp4` |
| **Clip 2 — la imagen** (él con la polaroid delante del corcho de gurús) | **hecha** | `Downloads\image.png_4a780f5f.jpg` |
| **Clip 2 — el video, con la voz de Martín** | **HECHO (9/11 07:36)** | `Downloads\CLIP2-CON-VOZ.mp4` |

### Las versiones de la imagen del clip 2, en orden
1. `Downloads\image.png_dd69edaa.jpg` — el corcho con las 32 caricaturas, **sin** la persona del clip 1.
2. `Downloads\image.png_63f5c9e6.jpg` — **él con la polaroid delante del corcho**. Aprobado por Martín.
3. `Downloads\image.png_cb36014f.jpg` — idem, tras pedir «papel impreso con la misma luz». **Casi idéntica a la 2.**
4. `Downloads\image.png_8d4c34fb.jpg` — ⛔ **RECHAZADA por Martín**: le blanqueó el fondo a todas las fotos. «No quiero que se les quite el color de fondo a cada foto.»

**Lo que está pendiente ahora mismo:** partir de la **3** (la que tiene los colores) y lograr que
las fotos del corcho **se integren al cuadro SIN perder su color**. Martín: *«que mimetice un
poquito más el fondo… no me refiero a que deje de hacer caricaturas… sino que la foto que puso ahí
se ven muy diferentes al resto».*
- Ya probado y **no alcanza**: «Las fotos del corcho son papel impreso, con la misma luz que el resto del cuadro.»
- Ya probado y **está mal**: «Cada foto del corcho tiene el fondo claro, como una foto de carnet.» (las blanquea)
- **Sin probar todavía:** pedir la integración por **sombra propia** y por **profundidad de campo**
  (el corcho está detrás de él, debería tener algo de desenfoque), nombrando explícitamente que
  **los colores quedan**.

### Las referencias que yo compongo (scripts y salidas)
Carpeta: `C:\Users\marti\AppData\Local\Temp\claude\fb1d94a1aca5ced3\1513b896-575e-41c6-9939-5fc19e4bad6a\scratchpad\`
- `tablero-lotes.py` → `clip2\LOTE-1.jpg` y `clip2\LOTE-2.jpg` (16 caras de 225 px cada uno) — **es el que anda**.
- `tablero-denso.py` → `clip2\TABLERO-denso.jpg` (32 caras de 150 px, una sola imagen) — se leen peor.
- `clip2\CLIP1-bueno.png` — el fotograma del clip 1 que eligió Martín (**t = 3,2 s**; el de 5,6 s lo descartó).
- Las caricaturas salen de `C:\dev\wt-push-q\public\asesores\grandes\*.png` (**32**, 600×600).

---

## 3. Cómo se maneja Flow desde acá (lo que costó encontrar)

Todo el detalle, con los seis intentos fallidos, está en **`docs/video-avatar-desde-foto.md`**
(commits `1fdb7df18`, `c5ada6133`, `2a185e74c`, `0cdb1acc9`, `cda12c3eb`, `6c0ea53ee`,
`c54729e74`, `7ebeb4ad3`). El resumen operativo:

1. **Las capturas de pantalla se cuelgan** (`Page.captureScreenshot timed out`) pero la página vive:
   se trabaja con `get_page_text`, `read_page` y `javascript_tool`.
2. **Una imagen propia entra por el PORTAPAPELES**, no por el botón de subir (el `input[type=file]`
   no existe hasta que lo toca una persona, y tampoco aparece con el `+` del editor):
   ```powershell
   Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing
   $img = [System.Drawing.Image]::FromFile("C:\ruta\REF.jpg")
   [System.Windows.Forms.Clipboard]::SetDataObject($img, $true)
   ```
   ⚠️ **tiene que ser VERTICAL** (4:5 o 9:16). Una apaisada Flow la sube como imagen nueva y te
   abre SU editor, y perdés la imagen en la que estabas.
3. **La secuencia que funciona, y cada paso importa:** entrar al editor **por URL** → **clic real**
   en la caja (sobre `rect.x + 25`, porque mide 20 px de alto) → `Ctrl+V` → **clic real en la caja
   otra vez** → escribir → **verificar `location.pathname` y el texto** → clic en la flecha.
   Nunca `Ctrl+A` (se propaga al documento), nunca `.focus()` por JS (el pegado se vuelve subida),
   nunca `submit.click()` por JS (no envía).
4. **Lo que queda intacto va de imagen BASE; lo que se cambia entra como REFERENCIA.** Al revés
   falla o te trae la escena entera de la referencia.
5. Las **imágenes son gratis**; los **créditos de VIDEO están agotados**.

---

## 4. Lo que sigue, en orden

1. **Arreglar la integración de las fotos del corcho** partiendo de `image.png_cb36014f.jpg`, sin
   quitarles el color. Es lo único abierto en imagen.
2. **El video del clip 2**, cuando haya crédito. Ya está decidido qué pedirle:
   - imagen de partida: la del punto 1, como **primer fotograma** (modo **Fotogramas**, no Ingredientes);
   - lo que dice: la línea del bloque 2 del guión;
   - el movimiento, escrito con la regla de nombrar primero lo quieto:
     **«El cuerpo queda quieto y habla a cámara. Sólo abre la mano y la foto cae.»**
   - ajustes del panel: **Omni 1.2 Flash** (regla de Martín: sólo Omni), **720p**, **9:16**, **x1**.
3. **Las tomas que falten del guión**, que en imagen no cuestan nada.

### Los créditos de Flow VOLVIERON (9/11 ~10:30)
⚠️ **El cartel «You're out of Google Flow credits» de las 04:00 ya no aplica**: a las 10:30 el panel
decía «La generación usará 24 créditos» y el clip 2 se generó sin problema. **El saldo se verifica
en el momento, abriendo el panel de configuración con el modo en Video — no se da por perdido
porque lo dijera un cartel hace seis horas.** (ApiMart sigue con US$ 0,26 del 8/11.)

### Dos avisos sueltos
- Le **pisé el portapapeles** con las imágenes de referencia.
- En la papelera de Flow quedó la versión vertical del tablero (`/project/<id>/trash`,
  «Restaurar todo» la devuelve), y hay varias tarjetas «Imagen subida» de los pegados que conviene barrer.

---

# ACTUALIZACIÓN 9/11/2026 ~11:00 UTC (claude1 al 99 %)

## El clip 2 está APROBADO

`C:\Users\marti\Downloads\CLIP2-v2-CON-TU-VOZ.mp4` — Martín: **«Ahora sí, el segundo salió bien.»**

**Lo que lo destrabó, y es la lección:** la voz sonaba española y yo busqué la causa en ElevenLabs
durante cuatro vueltas. **No estaba ahí: estaba en el ORIGEN.** El voice-to-voice conserva la
prosodia del audio que le das, así que si Omni habla en español de España, el clon lo arrastra.
Se arregló **regenerando el video** con el acento pedido en el prompt, **no tocando ElevenLabs**:

```
Habla con acento argentino de Buenos Aires. El cuerpo queda quieto y habla a cámara
diciendo: "Me llamo Martín, tengo 25 años y me estudié a todos los gurús que conoces."
Al principio abre la mano y deja caer la foto.
```

⚠️ **El acento va PRIMERO en el prompt.** Y el contexto completo de ese clip está en
`Downloads\CLIP2-voz-wavnivel.contexto.md` (la regla nueva, ver AGENTS.md).

**Lo otro que estaba mal y era mío:** no nivelaba el audio de origen antes de mandarlo a
ElevenLabs. Va `loudnorm=I=-19:TP=-3:LRA=11,highpass=f=70` ANTES del STS (de −29 dB a −21).

## Lo que pidió Martín ahora, textual

> «no veo conexión entre la toma número 1 y la toma número 2… el fondo es diferente… Yo creo que lo
> más sencillo es hacer el clip número 1 con el nuevo fondo. **Pero el problema es que no me gusta
> mucho este fondo para todo el video**… Sí me gusta, de hecho, el otro fondo de tipo en la oficina.
> **Tal vez podemos hacer de que este clip comience con el último fotograma y que Martín se levante
> y se mueva la cámara y ahí está el pizarrón**, que es el que ya habíamos construido en su momento,
> el que parece que también está en un cuarto… **habría que quitarle la mesa abajo para que Martín
> se pueda acercar a hablar** ahí. O incluso ponerle el resto de fotos o tratar de replicar cómo
> está… Obviamente siguiendo la metodología de siempre, **primero la imagen. O las imágenes en este
> caso. Y después el clip.**»

### Qué hay que hacer con eso

El clip de enlace usa el modo **primer y último fotograma** de Omni (Flow: modo «Fotogramas», botones
**Iniciar** y **Finalizar**). Hacen falta **dos imágenes**:

| | qué es | estado |
|---|---|---|
| **Iniciar** | el **último fotograma del clip 1** (él en la oficina, con los monitores) | extraído: `scratchpad\clip2\CLIP1-ULTIMO.png` (720×1280) |
| **Finalizar** | **él parado delante del pizarrón**, sin la mesa abajo | **FALTA** |

Para la de **Finalizar**, el pizarrón es el que Martín adjuntó: `scratchpad\...\images\2.jpg`
(768×1376) — el corcho horizontal con las caricaturas, en una pared de cuarto, con escritorio,
planta y ventana. **Hay que quitarle el escritorio de abajo** para que entre el cuerpo de Martín, y
después meterlo a él con el método ya validado: **la persona de BASE, el fondo de REFERENCIA**.

⚠️ **El fondo del corcho NO va en todo el reel**: la oficina se queda para el clip 1 y el pizarrón
aparece recién cuando la cámara se mueve. Es decisión de Martín.

## Los prompts de Martín, en orden, para no volver a pedírselos

1. `Este es un mensaje para todos los mentores high ticket.` *(hook, bloque 1)*
2. `Me llamo Martín, tengo 25 años y me estudié a todos los gurús que conoces.` *(bloque 2)*
3. `Por eso creé una app para que no tengas que gastarte miles de dólares en vendehumos.` *(bloque 3)*
4. `Vas a poder crear y editar videos como el que estás viendo en minutos.` *(bloque 4)*
5. `Dejá de comentarle a los que te dan un triste PDF. Mejor comentá "App" y te regalo 1 semana de prueba.` *(bloque 5)*

### Y sus correcciones de método, que valen para todo lo que falta
- «que sea más simple, que no tenga tantas imágenes» · «que no repita influencer» · «pásale más, tenemos más».
- «que mimetice un poquito más el fondo… **no quiero que se les quite el color de fondo a cada foto**».
- «**estable tiene que ser cero**… tienes que copiarlo idéntico… si tienes otra información, **borra el resto**».
- «cada clip que salga, que salga con **todas las configuraciones**… que cada generación traiga todo un contexto».
- «**primero la imagen**. O las imágenes en este caso. Y después el clip.»

## Estado del CLIP DE ENLACE (9/11 ~11:15, cuota al 99 %)

Martín quiere un clip que **una la toma 1 con la toma 2**: arranca en la oficina (último fotograma
del clip 1), él se levanta, la cámara se mueve y aparece el pizarrón. Se hace con el modo
**primer y último fotograma** de Omni (Flow: «Fotogramas» + botones Iniciar / Finalizar).

| | archivo | estado |
|---|---|---|
| **Iniciar** | `scratchpad\clip2\CLIP1-ULTIMO.png` (720×1280) — él en la oficina, de frente, con la polaroid | **listo**, y ya subido al proyecto de Flow |
| **Finalizar** | `Downloads\image.png_b69f5e41.jpg` | **casi**: ver abajo |

### Lo que falta de la imagen de llegada
El pizarrón ya quedó bien —sin la mesa, pared hasta el piso, y con las fotos **chicas y muchas**,
que es la versión que Martín aprobó— pero **la pose se desvió**: quedó de perfil tocando el hilo
rojo, sin la polaroid. Para que enganche con el clip 2 (que arranca soltando la foto) tiene que
estar **de frente a cámara con la polaroid en la mano**.

**El prompt que falta aplicar**, sobre la última versión de la pila `c4f1dd63-aef1-4bce-a6f8-dbc595e679a6`:
```
El corcho y el cuarto quedan igual. La persona está de pie mirando a la cámara,
con una foto polaroid en la mano.
```
⚠️ Dos intentos de aplicarlo rebotaron al editor de VIDEO (`458a7843-…`): entrar por URL a la
imagen y verificar `location.pathname` ANTES de escribir.

### La corrección de Martín que hay que respetar
> «ahora nuevamente el pizarrón con esas imágenes enormes y gigantescas; **me gustaba como estaba la
> última versión que habíamos logrado**»

La versión buena del corcho es **`Downloads\image.png_4a780f5f.jpg`** (la del clip 2 aprobado):
fotos chicas, muchas, con notas, colores conservados. La que Martín adjuntó como `images\2.jpg`
tiene las caras GRANDES y es anterior — **no usar ésa como referencia de tamaño.**

### El prompt del clip de enlace, para cuando las dos imágenes estén
```
La cámara acompaña mientras él se levanta y camina hasta la pared del pizarrón.
Sigue con la foto en la mano.
```
Sin voz: es una transición. Omni 1.2 Flash · Fotogramas · 720p · 9:16 · x1 · 24 créditos.

---

# ⛔ CHECKLIST DEL CORCHO — mirar la imagen contra esto ANTES de mandarla

Martín, 9/11: **«el mismo feedback que antes… guarda el contexto, el feedback. Para ser criterioso,
mirar y revisar si está bien luego.»** Le entregué dos veces una imagen que repetía errores que él
ya había marcado, porque miré el resultado sin compararlo con lo ya dicho. **Esta lista se recorre
mirando la imagen, una por una, antes de que la vea él.**

| # | qué tiene que pasar | cómo falló antes |
|---|---|---|
| 1 | **El corcho está LLENO**, con muchas fotos chicas | «no hay tantas fotos»; quedó medio vacío (9/11, dos veces) |
| 2 | **Las fotos son las caricaturas de los gurús**, no caras inventadas | Flow las inventa si no le pasás los lotes |
| 3 | **Todas del mismo tamaño** | «que tengan evidentemente el mismo tamaño» |
| 4 | **Ninguna se repite** | «repitió a muchas y no usó a otras» |
| 5 | **No se ven como stickers**: integradas al cuarto | «vuelven a ser stickers» (9/11, dos veces) |
| 6 | **Conservan su color de fondo** | ⛔ «no quiero que se les quite el color de fondo a cada foto» — pedir «fondo claro» las BLANQUEA y está rechazado |
| 7 | **Nítidas y completas**, sin pixelar ni cortar | se degradan solas tras 3-4 ediciones encadenadas |
| 8 | **La escena es simple y real**, no un set de película | «está muy complejo… se tiene que ver real» |
| 9 | **La CARA de la persona está bien**: mirar los ojos de cerca | «el personaje tiene el ojo raro» tras 9 ediciones encadenadas |
| 10 | **Lo que sostiene en la mano está nítido** | «la foto que está subiendo también salió deforme» |

**Lo que resuelve cada cosa, probado:**
- **(1) y (4):** adjuntar `LOTE-1.jpg` + `LOTE-2.jpg` y **decir el número**: «van estas 32 caras, una
  sola vez cada una». Un adverbio («llenándolo») hace que multiplique y repita.
- **(5) sin romper (6):** la integración se pide por la **profundidad de campo**, no por el color:
  «El corcho de atrás queda un poco desenfocado, como en una foto de verdad. **Las fotos mantienen
  sus colores.**» ⚠️ El efecto sale sutil; si no alcanza, se insiste sobre esa misma propiedad.
- **(7):** volver a adjuntar los lotes cada 3-4 ediciones, aunque no sea lo que estás cambiando.

⚠️ **Y cada pedido nuevo tiene que anclar lo ya aprobado**, si no se pierde: «La persona, su pose y
el cuarto quedan igual» — ya pasó que al arreglar las caras se perdió la pose, y al arreglar la pose
se perdieron las caras.

### El punto 5 de la checklist («no parecen stickers») sigue abierto — qué se probó

| intento | resultado |
|---|---|
| «son papel impreso, con la misma luz que el resto del cuadro» | **nada**, idéntica |
| «cada foto tiene el fondo claro, como una foto de carnet» | ⛔ **las blanquea** — rechazado por Martín |
| «el corcho queda un poco desenfocado… las fotos mantienen sus colores» | mejora **sutil**, casi no se nota |
| «cada foto es un papel que se curva un poco y proyecta su sombra sobre el corcho» | **mejor**: aparece la sombra de contacto y se ven apoyadas. **Sigue sin cerrar del todo.** |

**Lo que queda por probar**, en orden de probabilidad:
1. Pedir la textura del soporte: «las fotos están impresas en papel mate, con el grano del papel».
2. Pedir el reflejo: «el papel brillante toma la luz de la ventana en algunas fotos».
3. Aceptar que una caricatura con fondo plano **siempre** va a leer algo de collage dentro de una
   foto realista, y resolverlo al revés: que el corcho entero sea parte del mismo dibujo, o que las
   caricaturas tengan un fondo con textura en vez de color plano (se cambia en `tablero-lotes.py`,
   que es nuestro, antes de mandarlas como referencia).

⚠️ La 3 es la única que ataca la causa: **el fondo plano saturado viene de las caricaturas del
repo**, no de Flow. Darle un fondo con grano a cada caricatura en el lote de referencia es más
barato que pelearla con prompts.

## ⚠️ Lo que está mal en la última imagen (9/11 ~11:30) y cómo se arregla

Martín: *«La cara de Ramiro sigue deformada —la de la tarjeta que estoy sujetando— y se deformaron
también las caras que están atrás. No veo las caras que más me interesan: Sofía Contreras, Alex
Hormozi, Francisco Doglio… sí están, pero están como más escondidas.»*

**El camino que él indicó, y es el que hay que seguir** (ver AGENTS.md, «Una cosa al 100 % primero»):

1. **Terminar el PIZARRÓN SOLO, sin la persona**, hasta que esté al 100 %:
   - caras nítidas, del mismo tamaño, sin repetir;
   - **que se vean bien las que le importan: Sofía Contreras, Alex Hormozi, Francisco Doglio**
     — no escondidas detrás de donde va la persona;
   - con su color y con la luz del cuarto (referencia: `Downloads\image.png_4a780f5f.jpg`).
2. **Recién ahí meter a la persona**, desde el fotograma del clip 1 (`scratchpad\clip2\CLIP1-ULTIMO.png`),
   que es donde **la cara de Martín y la de Ramiro en la polaroid se ven bien**, con una sola frase:
   **«Pon a esta persona, con la misma foto y la misma pose, delante de este pizarrón.»**

⚠️ Las caras que le importan deben quedar en la **mitad izquierda** del corcho: la persona tapa la
derecha.

---

# TODO LO QUE DIJO MARTÍN, TEXTUAL (9/11/2026)

Para no volver a pedírselo. Lo que está entre comillas son sus palabras.

## El guión (sus cinco líneas, no se tocan)
1. «Este es un mensaje para todos los **mentores high ticket**.»
2. «Me llamo Martín, **tengo 25 años** y me **estudié a todos los gurús** que conoces.»
3. «Por eso creé una app para que **no tengas que gastarte miles de dólares en vendehumos**.»
4. «Vas a poder **crear y editar videos como el que estás viendo** en minutos.»
5. «Dejá de comentarle a los que te dan **un triste PDF**. Mejor comentá **"App"** y te regalo **1 semana de prueba**.»

## Sus reglas de método, en orden de aparición
| | lo que dijo | dónde quedó |
|---|---|---|
| Simpleza | «está muy complejo… **se tiene que ver real** también. No se tiene que ver tan complejo» | docs/video-avatar-desde-foto.md |
| Cantidad | «que sea más simple, que **no tenga tantas imágenes**» · luego «**pásale más**, tenemos más» · luego «**no hay tantas fotos**» | checklist del corcho |
| Unicidad | «**que no repita influencer**» · «repitió a muchas y no usó a otras, **asegúrate de pasarles las suficientes** para que tengan material» | ídem |
| Tamaño | «que tengan **evidentemente el mismo tamaño**» · «el pizarrón con esas **imágenes enormes y gigantescas**, me gustaba la última versión que habíamos logrado» | ídem |
| Integración | «que **mimetice** un poquito más el fondo… **no me refiero a que deje de hacer caricaturas**… se ven muy diferentes al resto» | ídem |
| Color | ⛔ «**no quiero que se les quite el color de fondo** a cada foto» | ídem |
| Referencia | «**dale la referencia que ya habíamos logrado**, que son más chiquitas las imágenes y justamente tiene la **iluminación correcta**» | docs/video-avatar-desde-foto.md |
| Degradación | «**pásale nuevamente la referencia**… se están pixeleando, se están cortando, están desfigurándose» | ídem |
| Cadena | ⛔ «**no generes sobre otro generador, que vuelvas para atrás**. Eso, como regla, porque provoca que la IA haga estas cosas» | **AGENTS.md** |
| Armado | «tener **100% el pizarrón sin la persona**, y luego metería la persona del clip que ya tenemos… **pon a esta persona con la misma foto y la misma pose enfrente**» | **AGENTS.md** |
| Revisión | «el **mismo feedback que antes**… guarda el contexto, el feedback. Para ser **criterioso, mirar y revisar** si está bien luego» | **AGENTS.md** + checklist |
| Contexto | «cada clip que salga, que salga con **todas las configuraciones**… la imagen de referencia que se le juntó… qué modelo se utilizó… que **cada generación traiga todo un contexto**, pues si no estamos dando vueltas» | **AGENTS.md** |
| Orden | «**primero la imagen**. O las imágenes en este caso. **Y después el clip**» | metodología Avatar Hype |
| Voz | «**estable tiene que ser cero**… tienes que **copiarlo idéntico**… si tienes otra información, **borra el resto** y que quede solamente eso, si no se confunde siempre» | LA-CONFIG.json + memoria |
| Acento | «suena como **español** en lugar de argentino» → se arregla en el **origen** (regenerar el clip con el acento en el prompt), no en ElevenLabs | docs/video-avatar-desde-foto.md |
| Guardado | «**guarda mis prompts** y guarda esto como regla», «ve guardando todos mis prompts, para que sigamos con la otra cuenta» | este documento |

## Los prompts de Flow que funcionaron
```
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
```
