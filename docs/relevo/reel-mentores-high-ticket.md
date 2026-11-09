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
| **Clip 2 — la imagen** (él con la polaroid delante del corcho de gurús) | **hecha, en revisión** | ver abajo |
| Clip 2 — el video | **FRENADO: sin créditos** | — |

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

### ⛔ El freno de verdad
- **Flow: «You're out of Google Flow credits»** desde el 9/11 ~04:00. Imágenes sí, video no.
- **ApiMart: US$ 0,26** medido el 8/11 — no alcanza para un clip de 5 s (US$ 0,2795).
- **Hay que recargar uno de los dos para que el reel avance a video.** Martín lo sabe y no decidió.

### Dos avisos sueltos
- Le **pisé el portapapeles** con las imágenes de referencia.
- En la papelera de Flow quedó la versión vertical del tablero (`/project/<id>/trash`,
  «Restaurar todo» la devuelve), y hay varias tarjetas «Imagen subida» de los pegados que conviene barrer.
