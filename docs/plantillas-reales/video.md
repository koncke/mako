# Video: plantillas reales y el Editor de MaKo (plan, 29/10/2026)

> Parte de [Plantillas reales en Create](README.md). La regla común, el elenco, el patrón del agente experto, la tabla única de licencias y el orden de implementación viven en el README; este archivo es la parte de Video, entera, con sus ejemplos completos.

**Qué es:** el plan para que «Nuevo video» de Create muestre plantillas **llenas** y no un marco vacío con «15 s», y para que al abrir una MaKo la adapte al negocio con un agente experto editable en `/configuraciones`.
**Estado:** plan; no hay nada implementado. Medido contra `origin/main` `1cf06eba9` (29/10/2026, 13:55). Licencias releídas hoy en su archivo LICENSE (sección 4).
**De dónde sale:** la investigación completa del 29/10 (tab Video y patrón de agente) y el código de `origin/main`. El elenco de negocios ficticios y la regla común son los del [README](README.md) (sección 2): Cierre Consultivo (Andrea Salcedo), Consulta Rentable (Dra. Mariana Ochoa), Pulso Dental (Diego Ferrer), Torre Alameda (Querétaro, sin desarrolladora con nombre) y Voz de Líder (Rodrigo Ibarra), con sus clientes inventados. Los datos de cada negocio son **los mismos que usa Copywriter** (Lucía 6 → 21 pacientes, Altamira 6 → 23 valoraciones, Torre Alameda 78 m² y 60 % de avance, Voz de Líder 90 días y 12 lugares), para que la persona reconozca el negocio en el guion y en el video.

---

## 0. Lo que hay hoy en el código (y por qué se ve vacío)

- **El catálogo:** `lib/editor-video/plantillas.ts` tiene 7 plantillas de anuncio vertical: `gancho`, `gancho-escrito`, `testimonio`, `antes-despues`, `beneficios`, `oferta`, `oferta-glitch`. Cada una es una línea de tiempo con **huecos con nombre** (como CapCut): tiempos, animaciones y transiciones bien hechos y fijados por `tests/video-editor-plantillas.test.ts`.
- **La tarjeta de Create:** `app/video-editor/plantillas-crear.ts` convierte cada plantilla en un `PlantillaCrear` sin `imagen`, así que `NuevaCrear` (`app/_crear/PantallaCrear.tsx`) dibuja **un marco vacío 9:16 con el rótulo «15 s»**. Ese es el «rectángulo con un nombre».
- **La miniatura ya existe, pero en otro lado:** `_opencut/plantillas/components/miniatura-plantilla.tsx` dibuja la plantilla en un canvas (quieta en `portada`, en bucle con el mouse encima). La usa sólo la pestaña Plantillas del editor; Create no la llama.
- **Lo que se ve al dibujarla:** los clips son un PNG gris con «Tu clip», «Antes» o «Después» (`_opencut/plantillas/muestras.ts` + `dibujo.ts`), y los textos son de e-commerce: «ESTO LO CAMBIA TODO», «50 % DE DESCUENTO», «¡COMPRA AHORA!», «Envío gratis incluido», «María López».
- **El chat ya sabe usar plantillas:** `usar_plantilla`, `cambiar_texto` y `reemplazar_clip` están en `lib/editor-video/chat-catalogo.ts`, y la vista de la línea de tiempo marca cada elemento con su `plantilla`, su `hueco`, si es `muestra` y el tope de caracteres (`_opencut/chat/linea.ts`).

**El diagnóstico:** el motor no es el problema. Faltan tres cosas: un ejemplo real de un negocio high ticket, una muestra de clip que no sea un rectángulo gris y que Create dibuje la plantilla en vez de un marco.

---

## 1. Cómo lo hacen los mejores y qué copiamos de esa forma de mostrar

| Producto | Cómo muestra sus plantillas | Qué tomamos |
|---|---|---|
| **CapCut** (https://www.capcut.com/templates) | Galería por categorías (Business, Industry…). Cada tarjeta es un **video real** con la duración («00:10»), los usos y la cantidad de clips («8 Clips»). Al abrirla: «N clips por reemplazar», y los clips de la persona caen en los huecos. | La tarjeta con la plantilla real y una **insignia de duración y clips**. El modelo de huecos ya es el de MaKo. |
| **Descript** (https://help.descript.com/templates-and-presets/overview, https://www.descript.com/templates/find-highlights-0cR-EB) | Los «layouts» son escenas armadas (encuadre, tipografía, medios) en packs por uso. Los «templates» nuevos son flujos de IA: «Find highlights» propone los mejores momentos y dónde empieza y termina cada clip. | La IA **propone y la persona aprueba** antes de cortar. |
| **Opus Clip** (https://www.opus.pro/tools/opusclip-captions) | Estilos de subtítulos aparte de la plantilla, con karaoke; plantillas de marca (fuente, colores, logo); un puntaje de 0 a 99 por clip. | El estilo de subtítulos es **una elección aparte con nombre**; el puntaje para recortar. |
| **Submagic** (https://www.submagic.co/blog/how-to-make-alex-hormozi-captions) | Estilos de subtítulos con nombre propio, vistos en video; auto-zoom, B-roll y quitar silencios como funciones sueltas. | Estilos con nombre **genérico** (Impacto, Limpio, Karaoke). Nunca el nombre de una persona. |
| **claude-shorts** (https://github.com/AgriciDaniel/claude-shorts, MIT) | Antes de cortar propone de 8 a 12 clips puntuados; el gancho va como texto en los primeros 3 s; tres estilos de subtítulos con su uso declarado. | El método de recorte (sección 3). |
| **HyperFrames** (https://github.com/heygen-com/hyperframes, Apache-2.0) | Plantillas con su miniatura ya renderizada, una vitrina de videos terminados y unos 450 bloques buscables por intención («revelar un titular de a una línea»). | Ordenar los títulos y las transiciones **por intención**, no por estilo. |

**Lo que se repite en todos y copiamos:**
1. La tarjeta **es** la plantilla con contenido real, nunca un rectángulo.
2. Junto a la miniatura: duración y cuántos clips hay que poner (CapCut).
3. Se ordenan por **objetivo**: en MaKo, las sugeridas para el negocio primero (ya existe, `lib/plantillas-sugeridas.ts`).
4. El estilo de subtítulos se elige aparte.
5. La IA propone y la persona aprueba antes de cortar.

**Lo que MaKo hace distinto:** el ejemplo es de un negocio high ticket de Latinoamérica, ficticio y dicho como tal, y el Editor de MaKo lo reescribe con los datos del negocio de la persona.

---

## 2. Las plantillas

### 2.0 Reglas que valen para todas

- **Lienzo:** 1080×1920, 30 fps. El modelo de plantilla es **sólo 9:16**: `usarPlantilla` fija la relación 9:16 y `LIENZO_REF`/`ZONA_SEGURA` son los de Reels. YouTube 16:9 no entra como plantilla de huecos: va como receta del agente (2.12).
- **Zona segura de Meta** (ya en el código): textos entre y=269 e y=1248 y a 65 px de los costados.
- **Fuentes:** sólo Anton, Montserrat y Playfair Display. Están en `FUENTES_PLANTILLAS` y `cajaDeTexto` sabe medirlas. Inter no está.
- **Textos de muestra:** como máximo 5 palabras (test 7) y dentro de su tope. Una muestra en mayúsculas lleva `mayusculas: true` (test 9). Por eso el ejemplo largo (el guion) va en un campo nuevo, `ejemplo.guion`, y no en los huecos.
- **Sin música ni efectos de sonido:** las plantillas no tienen pista de audio y el chat no puede agregar audio de una biblioteca (está en «lo que no se puede» de `chat-catalogo.ts`).
- **Los clips de muestra no tienen caras.** Son tomas de apoyo de Pexels (manos, escritorio, pantallas, interiores, obra), elegidas a mano y guardadas en `public/video-editor/plantillas/`. Una persona de stock en un hueco «a cámara» quedaría diciendo, con los subtítulos, un resultado que nunca dijo, y la licencia de Pexels prohíbe insinuar respaldo (sección 4).
- **Cierre de 3 s:** como en las plantillas de hoy, el llamado se dice en el clip y la tarjeta final (`cierre()`) lo repite en pantalla.
- **Cada ejemplo trae:** el negocio ficticio, cuándo usarla, el guion para grabar con segundos, las tomas de apoyo, el texto del anuncio y los créditos de cada muestra.

| # | id | Nombre en la tarjeta | Objetivo | Negocio del ejemplo | Dura | Clips | Qué pasa con el código |
|---|---|---|---|---|---|---|---|
| 1 | `gancho` | Anuncio con gancho | Vender una llamada | Cierre Consultivo | 24 s | 1 (+1 opcional) | Se reescribe |
| 2 | `respuesta-comentario` | Respuesta a un comentario | Vender una llamada | Cierre Consultivo | 28 s | 1 | Nueva |
| 3 | `beneficios` | Lo que te llevas | Vender una llamada (retargeting) | Voz de Líder | 15 s | 1 | Cambia el texto |
| 4 | `testimonio` | Testimonio de cliente | Prueba social | Consulta Rentable (Lucía Garza) | 33 s | 1 (+1 opcional) | Se reescribe |
| 5 | `caso-numeros` | Caso con números | Prueba social | Pulso Dental (Clínica Altamira) | 25 s | 2 | Nueva |
| 6 | `historia` | Historia del fundador | Prueba social | Pulso Dental | 30 s | 1 (+1 opcional) | Nueva |
| 7 | `tres-errores` | Reel de 3 errores | Educar | Voz de Líder | 38 s | 1 (+1 opcional) | Nueva |
| 8 | `clip-podcast` | Clip de podcast o clase | Educar | Cierre Consultivo | 40 s | 1 | Nueva |
| 9 | `oferta` | Invitación a clase en vivo | Evento | Consulta Rentable | 16 s | 1 | Mismo id, otra plantilla |
| 10 | `tour-propiedad` | Tour de propiedad | Propiedad | Torre Alameda | 24 s | 6 | Nueva |
| 11 | `antes-despues` | Antes y después | Propiedad | Torre Alameda | 14 s | 2 | Cambia el texto |
| 12 | receta `youtube` | YouTube con retención | Educar | Pulso Dental | 12 min | — | Tanda 3 (no es de huecos) |
| — | `gancho-escrito`, `oferta-glitch` | — | — | — | — | — | **Se retiran** |

**Por qué se retiran las dos variantes:** son la misma idea que su original con otra animación («Máquina de escribir», «Glitch»). Con el ejemplo lleno, serían dos tarjetas iguales en la grilla. La máquina de escribir queda en el quiebre de la historia (6) y el glitch como transición que el agente puede usar una vez. Martín: «prefiero deprecar antes que conservar».

Las tablas de piezas usan los ids del motor: efectos de `text/estilos-predefinidos.ts`, animaciones de `animaciones/catalogo.ts`, transiciones de `transiciones/catalogo.ts` y subtítulos de `subtitles/estilos.ts`. «arriba 300» quiere decir que el borde de arriba del texto va en y=300.

---

### 2.1 Anuncio con gancho (`gancho`, 24 s)

**Cuándo usarla:** anuncio pagado o reel que vende una llamada a público frío. Frena el scroll en 3 s, prueba con un dato y cierra pidiendo un mensaje.

**Piezas** (subtítulos `palabra-resaltada`, portada en el segundo 1):

| Segundos | Pista | Pieza | Estilo | Animación |
|---|---|---|---|---|
| 0–21 | principal | hueco `clip` («Tu clip») | — | transición `mezclar` 0.5 a la tarjeta final |
| 6–9.5 | video-1 | hueco `broll` («Toma de apoyo», opcional, silenciado) | — | entra `aparecer-gradualmente` 0.3 · sale `desaparecer-gradualmente` 0.3 |
| 0–2.5 | texto-1 | `gancho` (28): «¿CIERRAS MENOS DEL 20 %?» | `amarillo-trazo-negro`, Anton 104, mayúsculas, arriba 300 | `rebote` 0.5 · sale 0.3 |
| 14–19 | texto-2 | `dato` (24): «2/10 → 4/10 CIERRES» | `recuadro-amarillo`, Montserrat 88 negrita, mayúsculas, centro 700 | `acercar` 0.4 · bucle `pulso` 1 · sale 0.3 |
| 14–19 | texto-1 | `aviso` (32): «Mediana de 52 alumnas» | `sombra-suave`, Montserrat 36, 80 % de opacidad, arriba 800 (el dato, en un renglón, termina cerca de 770) | `aparecer-gradualmente` 0.3 |
| 21–24 | principal + texto-1/2 | `cierre()`: título (32) «¿Vendes programas de +USD 1,000?» · botón (20) «Escribe LLAMADA» | los de `cierre()` | los de `cierre()` |

**Ejemplo completo: Cierre Consultivo** (Andrea Salcedo, coach de ventas para coaches, CDMX; programa de 90 días, USD 1,500). Negocio ficticio.

Guion para grabar (a cámara, de pie, plano medio):
- **0–3 s:** «Si cierras menos del 20 % de tus llamadas de venta, bajar el precio no lo va a arreglar.»
- **3–6 s:** «Lo que lo arregla está en los primeros cinco minutos.»
- **6–9.5 s:** «Casi todos abren la llamada presentando su programa: módulos, bonos, sesiones.» *(encima, la toma de apoyo)*
- **9.5–14 s:** «Las llamadas que cierran empiezan al revés: con preguntas sobre lo que le cuesta al cliente seguir igual.»
- **14–17 s:** «Con ese cambio, la mitad de mis alumnas ya cierra 4 de cada 10 llamadas o más.» *(es la mediana de Offer, plantilla 1: de 2 a 4 de cada 10, en 52 alumnas; no es un caso suelto)*
- **17–21 s:** «Si vendes programas de más de mil dólares, escríbeme LLAMADA y te mando mi guion de apertura.»

Tomas de apoyo: una agenda de llamadas en la pantalla de una laptop; manos tomando notas junto a una videollamada.
Texto del anuncio: «Te mando gratis el guion de los primeros cinco minutos de mi llamada de venta. Escríbeme LLAMADA por mensaje directo. El dato del video es la mediana de 52 alumnas en 4 cohortes; no es una promesa.»
Descripción visual: Andrea a cámara con fondo de oficina; el gancho amarillo está desde el primer cuadro; en el segundo 14 el dato entra con un acercamiento, con el aviso «Mediana de 52 alumnas» debajo; cierra la tarjeta oscura con el botón amarillo que pulsa.

**Miniatura:** en el segundo 1, la foto de la laptop con la videollamada (vista por encima del hombro, sin cara) y, arriba, «¿CIERRAS MENOS DEL 20 %?» en amarillo con trazo negro. Abajo a la izquierda, la marca chica «Tu clip» y la insignia «24 s · 1 clip». Con el mouse encima corre el bucle: el gancho rebota, el dato aparece y entra la tarjeta final.
**Muestras (Pexels, verticales, sin caras):** `gancho-clip.webp` (laptop con videollamada desde atrás) y `gancho-broll.webp` (agenda en pantalla). Búsqueda: «video call laptop», «calendar laptop», con orientación vertical.
**Sugerida para:** quien recibe leads de anuncios o de su página (`entrada: formulario_anuncio, landing`, igual que hoy).

---

### 2.2 Respuesta a un comentario (`respuesta-comentario`, 28 s)

**Cuándo usarla:** contenido de cierre para quien ya está considerando comprar. Responde una objeción de precio o de confianza con el formato «respuesta a comentario» de TikTok y Reels.

| Segundos | Pista | Pieza | Estilo | Animación |
|---|---|---|---|---|
| 0–25 | principal | hueco `clip` | — | `mezclar` 0.5 |
| 0–4 | texto-2 | `usuario` (24): «Pregunta frecuente» | `sombra-suave`, Montserrat 36 negrita, 80 % de opacidad, izquierda, arriba 300 | `aparecer-gradualmente` 0.3 |
| 0.2–4 | texto-1 | `comentario` (80): «¿Pagar si YouTube es gratis?» | `recuadro-blanco`, Montserrat 52 negrita, izquierda, arriba 350 | `acercar` 0.3 · sale 0.3 |
| 10–14 | texto-1 | `frase-clave` (28): «LA CORRECCIÓN NO ES GRATIS» | `recuadro-amarillo`, Montserrat 72 negrita, mayúsculas, arriba 300 | `rebote` 0.4 · sale 0.3 |
| 25–28 | — | `cierre()`: «3 llamadas revisadas: USD 150» · «Escribe LLAMADA» | — | — |

**Ejemplo completo: Cierre Consultivo** (Andrea).
- **0–4 s:** «Me preguntan seguido por qué cobro 1,500 dólares si en YouTube está casi todo gratis.»
- **4–10 s:** «Es cierto: la información está. Lo que no está es alguien que escuche tu llamada de venta y te diga en qué minuto la perdiste.»
- **10–16 s:** «Ver un video es gratis. Que alguien corrija tu llamada, no. Mis alumnas me pagan para lograrlo en 90 días y no en tres años.»
- **16–21 s:** «Si quieres probar, reviso tres de tus llamadas por 150 dólares, y se descuentan si después entras.»
- **21–25 s:** «Escríbeme LLAMADA.»

Descripción visual: la burbuja blanca del comentario entra con un acercamiento sobre Andrea a cámara; en el segundo 10, la frase clave en amarillo arriba; un acercamiento al 115 % en «Que alguien corrija tu llamada, no».
**Regla:** el comentario tiene que ser real. Si no hay uno, el rótulo dice «Pregunta frecuente» y el guion arranca con «Me preguntan seguido…». Nunca se inventa un usuario: un @ inventado puede ser una cuenta real.
**Miniatura:** en el segundo 2, la burbuja «¿Pagar si YouTube es gratis?» con «Pregunta frecuente» encima, sobre la toma de un escritorio con un micrófono. Insignia: «28 s · 1 clip».
**Muestra:** `respuesta-comentario-clip.webp` (escritorio con micrófono y laptop, sin persona).
**Sugerida para:** quien vende por chat y recibe mensajes (`canal: conversaciones`, `entrada: chat_entrante`).

---

### 2.3 Lo que te llevas (`beneficios`, 15 s)

**Cuándo usarla:** retargeting a quien ya vio contenido. Tres entregables concretos, uno tras otro, y agendar.

Se conservan las piezas de hoy (título 0–12, los tres beneficios en y=560/720/880 desde 2, 3.5 y 5 s, el botón en 12.4–15). Cambian los textos y se agrega un detalle:

| Hueco | Hoy | Ejemplo nuevo |
|---|---|---|
| `titulo` (28) | 3 RAZONES PARA PROBARLO | LO QUE TE LLEVAS |
| `beneficio-1` (24) | Fácil de usar | Apertura ensayada |
| `beneficio-2` (24) | Envío gratis | Práctica en vivo semanal |
| `beneficio-3` (24) | Garantía de 30 días | Simulacro con directorio |
| `cta` (20) | Pruébalo hoy | Agenda tu llamada |
| `detalle` (28), **nuevo**: texto-2, 12.8–15, `sombra-suave` Montserrat 48, arriba 880 | — | 12 lugares por cohorte |

**Ejemplo completo: Voz de Líder** (Rodrigo Ibarra, oratoria para gerentes, Lima; programa de 90 días en cohortes de 12, USD 2,000).
Guion (0–12 s, a cámara o en voz en off): «Si te toca presentar resultados, en 90 días te llevas tres cosas: una apertura ensayada, práctica en vivo cada martes y un simulacro frente a un directorio. Agenda tu llamada.»
Descripción visual: Rodrigo frente a una pantalla de sala de juntas; cada beneficio entra deslizándose cuando lo nombra; cierra la tarjeta final con el botón y «12 lugares por cohorte».
**Regla:** cada beneficio en 24 caracteres o menos. Con más, Montserrat 60 se parte en dos renglones y pisa al siguiente (`docs/hallazgos-video-editor.md`).
**Miniatura:** en el segundo 6, los tres beneficios apilados en tarjetas blancas sobre la sala de juntas vacía, con «LO QUE TE LLEVAS» arriba. Insignia: «15 s · 1 clip».
**Muestra:** `beneficios-clip.webp` (sala de juntas vacía con una pantalla encendida).

---

### 2.4 Testimonio de cliente (`testimonio`, 33 s)

**Cuándo usarla:** prueba social para anuncios y orgánico. Un cliente **real** cuenta su resultado; abre con el resultado, no con el saludo.

| Segundos | Pista | Pieza | Estilo | Animación |
|---|---|---|---|---|
| 0–30 | principal | hueco `clip` | — | `mezclar` 0.5 |
| 0–3.5 | texto-1 | `cita` (48): «“De 6 a 21 pacientes”» | igual que hoy (`recuadro-blanco`, Playfair Display 72 cursiva, arriba 300) | `subir` 0.6 · sale 0.3 |
| 1–6 | texto-2 / texto-3 | `nombre` (28): «Lucía Garza» · `detalle` (32): «Nutrióloga · Monterrey» | igual que hoy (zócalo que crece desde 1010 y 1030) | igual que hoy |
| 10–14 | video-1 | hueco `broll` («Toma de apoyo», opcional, silenciado) | — | 0.3 / 0.3 |
| 18–25 | texto-1 | `dato` (24): «21 PACIENTES AL MES» | `recuadro-amarillo`, Montserrat 80 negrita, mayúsculas, centro 700 | `acercar` 0.4 · sale 0.3 |
| 18–25 | texto-4 | `aviso` (32): «Resultado de un caso» | `sombra-suave`, Montserrat 36, 80 % de opacidad, arriba 830 (el dato ocupa dos renglones, de ~604 a ~796) | `aparecer-gradualmente` 0.3 |
| 30–33 | — | `cierre()`: «Únete al próximo grupo» · «Agenda tu llamada» | — | — |

Subtítulos `predeterminado` (Limpio): un testimonio editado como anuncio pierde credibilidad.

**Ejemplo completo: Lucía Garza**, nutrióloga en Monterrey, alumna de Consulta Rentable (Dra. Mariana Ochoa, programa de 90 días, USD 1,200). Las dos son ficticias.
- **0–3.5 s:** «Pasé de 6 a 21 pacientes al mes, y no fue por publicar más recetas.»
- **3.5–10 s:** «Atendía por consulta suelta. Tenía semanas llenas y semanas vacías, y nunca sabía cuántos pacientes iba a tener.»
- **10–18 s:** «En el programa de la Dra. Ochoa armé un plan de tres meses y aprendí a explicarlo en la primera consulta, sin sentir que estaba vendiendo.»
- **18–25 s:** «En la semana 9 ya atendía 21 pacientes al mes, y los jueves estaban llenos.»

Como puede ir en un anuncio, el guion no dice cuánto cobra ni cuánto gana Lucía (README, 2.2: en el anuncio no van resultados de ingresos). Lo de la consulta de 600 a 900 pesos queda para el orgánico y el email (Copywriter, plantilla 9).
- **25–30 s:** «Si eres nutrióloga y vives de consultas sueltas, este programa es para ti.»

Sólo las respuestas: las preguntas de quien entrevista se cortan.
Descripción visual: Lucía sentada en su consultorio, con luz de ventana; la cita entra en una tarjeta blanca y el zócalo con su nombre; en el segundo 10, una toma de apoyo de sus manos armando un plan; el dato con el aviso «Resultado de un caso».
**Regla:** sólo con un testimonio verdadero y el permiso de la persona; MaKo nunca lo inventa ni le cambia el sentido.
**Miniatura:** en el segundo 2, la cita en la tarjeta blanca y el zócalo «Lucía Garza / Nutrióloga · Monterrey» sobre la foto de un consultorio sin personas. Insignia: «33 s · 1 clip».
**Muestras:** `testimonio-clip.webp` (consultorio de nutrición vacío: escritorio, báscula, plato) y `testimonio-broll.webp` (manos escribiendo un plan de alimentación).

---

### 2.5 Caso con números (`caso-numeros`, 25 s)

**Cuándo usarla:** agencias y servicios con un resultado medible. Quien habla cuenta el caso y, encima, la captura del panel con los números.

| Segundos | Pista | Pieza | Estilo | Animación |
|---|---|---|---|---|
| 0–22 | principal | hueco `clip` | — | `mezclar` 0.5 |
| 5–18 | video-1 | hueco `pantalla` («Captura del panel», lienzo entero, silenciado: la voz sigue debajo) | — | `deslizar-arriba` 0.4 · sale 0.3 |
| 0–4 | texto-1 | `gancho` (28): «DE 6 A 23 VALORACIONES» | `amarillo-trazo-negro`, Anton 104, mayúsculas, arriba 300 | `rebote` 0.5 · sale 0.3 |
| 6–10 | texto-1 | `dato-1` (28): «VALORACIONES: 6 → 23» | `recuadro-amarillo`, Montserrat 64 negrita, mayúsculas, arriba 300 | `acercar` 0.3 · sale 0.2 |
| 10.5–14 | texto-1 | `dato-2` (28): «9 TRATAMIENTOS CERRADOS» | ídem | ídem |
| 14.5–18 | texto-1 | `dato-3` (28): «MISMA INVERSIÓN EN ANUNCIOS» | ídem | ídem |
| 22–25 | — | `cierre()`: «¿Tu clínica quiere lo mismo?» · «Escribe CITAS» | — | — |

Subtítulos `predeterminado`.

**Ejemplo completo: Pulso Dental** (Diego Ferrer, agencia para clínicas dentales, Bogotá; USD 1,200 al mes con contrato de 3 meses), con su cliente la **Clínica Dental Altamira** (Dr. Felipe Cárdenas, Medellín). Todos ficticios.
- **0–4 s:** «Así pasó una clínica dental de Medellín de 6 a 23 valoraciones de implantes al mes.»
- **4–9 s:** «Sus anuncios traían mensajes de "¿precio?", pero nadie los contestaba a tiempo y casi ninguno volvía.»
- **9–15 s:** «Cambiamos tres cosas: un anuncio por tratamiento, respuesta en menos de cinco minutos y el rango de precio dicho antes de agendar.»
- **15–19 s:** «Al tercer mes, con la misma inversión, cerraron 9 tratamientos.»
- **19–22 s:** «Si tienes una clínica dental, escríbeme CITAS y reviso tus anuncios.»

Texto del anuncio: «Así pasó la Clínica Dental Altamira de 6 a 23 valoraciones de implantes al mes. Resultados de una clínica en particular, mostrados con su permiso. Escríbenos CITAS y revisamos tus anuncios sin costo.»
Descripción visual: Diego a cámara; en el segundo 5 sube la captura del panel a pantalla completa y cada número entra arriba, en amarillo, cuando lo dice.
**Regla:** sólo con el permiso del cliente. Los nombres de los pacientes se tapan antes de subir la captura.
**Miniatura:** en el segundo 7, la captura del panel con «VALORACIONES: 6 → 23» arriba. Insignia: «25 s · 2 clips».
**Muestras:** `caso-numeros-clip.webp` (escritorio de una agencia con dos monitores, sin personas, de Pexels) y `caso-numeros-pantalla.webp`, **hecha por nosotros**: un panel genérico con barras y los números del ejemplo (6, 23, 9). No es una pantalla de MaKo.
**Sugerida para:** quien vende por llamada y cobra una suscripción (`canal: llamadas`, `cobro: suscripcion`).

---

### 2.6 Historia del fundador (`historia`, 30 s)

**Cuándo usarla:** orgánico de conexión: antes, quiebre y hoy, y cierra pidiendo un mensaje. Va en orgánico o como anuncio que habla de clientes atendidos, nunca de la facturación propia (sección 6, trampa 12).

| Segundos | Pista | Pieza | Estilo | Animación |
|---|---|---|---|---|
| 0–27 | principal | hueco `clip` | — | `mezclar` 0.5 |
| 4–8 | video-1 | hueco `broll` («Toma de apoyo», opcional, silenciado) | — | 0.3 / 0.3 |
| 0–3 | texto-1 | `gancho` (28): «PERDÍ 4 DE 6 CLÍNICAS» | `amarillo-trazo-negro`, Anton 104, mayúsculas, arriba 300 | `rebote` 0.5 · sale 0.3 |
| 3.2–9 | texto-1 | `etiqueta-antes` (16): «ANTES · 2021» | `etiqueta-roja`, Montserrat 56 negrita, mayúsculas, arriba 300 | `deslizar-izquierda` 0.3 · sale 0.2 |
| 9–13 | texto-2 | `quiebre` (32): «14 mensajes, 5 respuestas» | `recuadro-blanco`, Montserrat 64 negrita, centro 760 | `maquina-escribir` 1.0 · sale 0.3 |
| 13.2–20 | texto-1 | `etiqueta-cambio` (16): «EL CAMBIO» | `recuadro-amarillo`, Montserrat 56 negrita, mayúsculas, arriba 300 | `deslizar-izquierda` 0.3 · sale 0.2 |
| 20.2–27 | texto-1 | `etiqueta-hoy` (16): «DESDE 2022» | ídem | ídem |
| 21–27 | texto-2 | `numero` (24): «31 CLÍNICAS ATENDIDAS» | `amarillo-trazo-negro`, Anton 112, mayúsculas, centro 760 | `acercar` 0.4 · sale 0.3 |
| 27–30 | — | `cierre()`: «¿Tu clínica pierde mensajes?» · «Escribe AUDITORIA» | — | — |

Subtítulos `palabra-resaltada`.

**Ejemplo completo: Pulso Dental** (Diego Ferrer). Es la misma historia del VSL de Copywriter (plantilla 10) y de la carta de Image (plantilla 10): seis clínicas, cuatro perdidas en un semestre.
- **0–3 s:** «En 2021 manejaba los anuncios de seis clínicas y perdí cuatro en un semestre.»
- **3–9 s:** «Los anuncios traían mensajes baratos, y yo creía que con eso alcanzaba. Las clínicas no veían pacientes.»
- **9–13 s:** «Una tarde, en la recepción de una clínica, vi entrar 14 mensajes. Se contestaron 5.»
- **13–20 s:** «Ahí entendí que yo vendía mensajes y la clínica necesitaba pacientes. Sumamos lo que pasa después del anuncio: respuesta a cada paciente en menos de cinco minutos, con un guion.»
- **20–27 s:** «Desde 2022 atendimos a 31 clínicas de Colombia y México. Si tu clínica recibe mensajes y no pacientes, escríbeme AUDITORIA y reviso tus mensajes.»

Descripción visual: el «antes» más frío y desaturado, con una toma de un escritorio desordenado de noche; el quiebre se escribe letra por letra sobre Diego; el «desde 2022» más cálido, con el número grande. El 31 es el total desde 2022, no las clínicas activas (README, 2.2).
**Después de armarla, el Editor propone** (no lo hace la plantilla): `dividir` en 9 y en 13, `ajustar_color` del tramo 3–9 (saturación −30, temperatura −10) y del tramo 20–27 (temperatura +10), y un `fundido-negro` de 0.3 s en el 9. El quiebre no se arma con dos piezas del mismo hueco: ver la trampa 13.
**Miniatura:** en el segundo 10, «14 mensajes, 5 respuestas» a medio escribir sobre la foto de una recepción vacía, con la etiqueta «ANTES · 2021». Insignia: «30 s · 1 clip».
**Muestras:** `historia-clip.webp` (recepción de clínica vacía) y `historia-broll.webp` (escritorio desordenado de noche con una laptop).
**Sugerida para:** quien tiene el cuello en la conversión (`cuello: conversion`): la historia es la de lo que pasa después del anuncio. La versión anterior contaba que la agencia hacía anuncios «a cualquiera» y se nichó, y chocaba con el VSL, donde en 2021 ya trabajaba solo con clínicas.

---

### 2.7 Reel de 3 errores (`tres-errores`, 38 s)

**Cuándo usarla:** contenido orgánico de autoridad. Enseña algo concreto, junta comentarios y termina en un mensaje directo. Es el formato de lista con un título por bloque.

| Segundos | Pista | Pieza | Estilo | Animación |
|---|---|---|---|---|
| 0–38 | principal | hueco `clip` | — | — |
| 14–16 | video-1 | hueco `broll` («Toma de apoyo», opcional, silenciado) | — | 0.3 / 0.3 |
| 0–3 | texto-1 | `gancho` (28): «3 ERRORES ANTE EL DIRECTORIO» | `amarillo-trazo-negro`, Anton 100, mayúsculas, arriba 300 | `rebote` 0.5 · sale 0.3 |
| 3–11 | texto-1 | `titulo-1` (28): «ERROR 1 · INICIO IMPROVISADO» | `recuadro-negro`, Montserrat 60 negrita, mayúsculas, arriba 300 | `deslizar-izquierda` 0.3 · sale 0.2 |
| 11–20 | texto-1 | `titulo-2` (28): «ERROR 2 · LEER DIAPOSITIVAS» | ídem | ídem |
| 20–29 | texto-1 | `titulo-3` (28): «ERROR 3 · DEMASIADOS DATOS» | ídem | ídem |
| 29–35 | texto-2 | `pregunta` (24): «Comenta 1, 2 o 3» | `recuadro-blanco`, Montserrat 72 negrita, centro 760 | `rebote` 0.5 · sale 0.3 |
| 35–38 | texto-2 | `cta` (20): «Escribe JUNTA» | `recuadro-amarillo`, Montserrat 72 negrita, centro 760 | `rebote` 0.5 · bucle `pulso` 1 |

Subtítulos `palabra-resaltada`.

**Ejemplo completo: Voz de Líder** (Rodrigo Ibarra). La palabra JUNTA es la misma de sus historias en Copywriter.
- **0–3 s:** «Tres errores que hacen que el directorio deje de escucharte en el primer minuto.»
- **3–11 s:** «Error uno: improvisas el inicio. Los primeros 20 segundos se escriben y se ensayan en voz alta, como un discurso corto.»
- **11–20 s:** «Error dos: lees las diapositivas. Si la frase ya está en la pantalla, no la repitas; di lo que la pantalla no dice.»
- **20–29 s:** «Error tres: respondes una pregunta difícil con más datos. Primero contesta sí o no, y después da un solo número.»
- **29–35 s:** «¿Cuál te pasa más? Comenta 1, 2 o 3.»
- **35–38 s:** «Y si te toca presentar este mes, escríbeme JUNTA.»

Descripción visual: Rodrigo de pie junto a una pantalla; cada bloque abre con su título en recuadro negro, que se queda arriba todo el bloque; un acercamiento al 115 % en la frase clave de cada error; en el segundo 14, una toma de una sala de juntas.
**Miniatura:** en el segundo 4, «ERROR 1 · INICIO IMPROVISADO» en recuadro negro sobre la sala de juntas. Insignia: «38 s · 1 clip».
**Muestras:** `tres-errores-clip.webp` (atril o pantalla de presentación en una sala vacía) y `tres-errores-broll.webp` (mesa de directorio vacía).
**Sugerida para:** quien recibe mensajes entrantes (`entrada: chat_entrante`).

---

### 2.8 Clip de podcast o clase (`clip-podcast`, 40 s)

**Cuándo usarla:** sacar un clip vertical de un video largo (podcast, clase en vivo, webinar). Es el marco de cada momento que el Editor propone al recortar (sección 3).

| Segundos | Pista | Pieza | Estilo | Animación |
|---|---|---|---|---|
| 0–40 | principal | hueco `clip` | — | — |
| 0–3 | texto-1 | `gancho` (28): «TU PRECIO NO ES CARO» | `amarillo-trazo-negro`, Anton 104, mayúsculas, arriba 300 | `rebote` 0.5 · sale 0.3 |
| 3–37 | texto-3 | `encabezado` (32): «Podcast Ventas sin presión» | `sombra-suave`, Montserrat 36, 80 % de opacidad, arriba 300 | `aparecer-gradualmente` 0.4 |
| 37–40 | texto-1 | `cta` (32): «Episodio completo en el perfil» | `recuadro-blanco`, Montserrat 56 negrita, centro 760 | `subir` 0.4 |

Subtítulos `karaoke`.

**Ejemplo completo:** el podcast «Ventas sin presión», episodio 27, de Andrea Salcedo (Cierre Consultivo). El fragmento arranca en la frase más fuerte, no en la pregunta de quien entrevista:
> «Tu precio no es caro. Es caro para el cliente equivocado. Cuando alguien te dice "está caro", te está diciendo que no ve el problema tan grande como lo ves tú. Entonces no bajes el precio: vuelve al problema. Pregúntale cuánto le cuesta cada mes seguir así, y deja que haga la cuenta en voz alta. Casi siempre, la objeción se cae sola.»

Puntaje de muestra con el que el Editor lo eligió: gancho 88 · se entiende solo 90 · emoción 70 · valor 85 · remate 80 → **84/100**.
Recorte: con una persona, centrado en la cara; en un podcast de dos, corte a quien habla; en una grabación de pantalla, acercamiento moderado.
**Miniatura:** en el segundo 1, «TU PRECIO NO ES CARO» sobre la foto de un micrófono de podcast en un estudio vacío. Insignia: «40 s · 1 clip».
**Muestra:** `clip-podcast-clip.webp` (micrófono y audífonos en una mesa, sin persona).

---

### 2.9 Invitación a clase en vivo (`oferta`, 16 s)

**Cuándo usarla:** llenar el registro de una clase gratuita en vivo, la puerta de entrada típica del infoproductor high ticket. Fecha clara, horario por país y un solo llamado.

**Mismo id, otra plantilla:** se conserva `oferta` (su fila de etiquetas ya dice `webinar`) y se reemplaza el anuncio de e-commerce. Se va la cuenta regresiva 3-2-1 (la decoración `numero`) y el gancho «SOLO POR 48 HORAS».

| Segundos | Pista | Pieza | Estilo | Animación |
|---|---|---|---|---|
| 0–13 | principal | hueco `clip` | — | `destello-blanco` 0.4 |
| 0–3 | texto-1 | `gancho` (28): «CLASE GRATIS EN VIVO» | `etiqueta-roja`, Anton 104, mayúsculas, arriba 300 | `rebote` 0.5 · sale 0.3 |
| 3–9 | texto-1 | `fecha` (24): «JUEVES 12 DE NOVIEMBRE» | `amarillo-trazo-negro`, Anton 96, mayúsculas, arriba 300 | `acercar` 0.5 · bucle `latido` 1.2 · sale 0.3 |
| 3.6–9 | texto-2 | `horario` (32): «19:00 México · 20:00 Bogotá» | `sombra-suave`, Montserrat 48 negrita, arriba 620 | `aparecer-gradualmente` 0.4 · sale 0.3 |
| 13–16 | — | `cierre()`: «Llena tu consulta online» · «Regístrate gratis» (sin mayúsculas: el botón de `cierre()` no lleva `mayusculas`, y una muestra en mayúsculas sin ese estilo rompe el test 9) | — | — |
| 13.8–16 | texto-3 | `detalle` (28): «Sin costo · por Zoom» | `sombra-suave`, Montserrat 44, arriba 930 | `aparecer-gradualmente` 0.4 |

Subtítulos `palabra-resaltada`.

**Ejemplo completo: Consulta Rentable** (Dra. Mariana Ochoa). Es la clase «Cómo llenar tu consulta online sin publicar todos los días» de Copywriter.
- **0–3 s:** «Si eres nutrióloga y tu consulta no se llena, esta clase es para ti.»
- **3–9 s:** «El jueves 12 de noviembre te enseño en vivo cómo llenar tu consulta online sin publicar todos los días.»
- **9–13 s:** «Son tres claves, es gratis y es por Zoom. Regístrate en el link.»

Los horarios están verificados: el 12/11/2026 es jueves; CDMX está en UTC−6 (sin horario de verano desde 2022) y Bogotá en UTC−5, así que 19:00 en México son las 20:00 en Bogotá.
**Regla:** la fecha, la hora y «por Zoom» salen del evento real. El Editor calcula la hora de cada país desde la zona del evento y nunca copia la del ejemplo. «Cupo limitado» o «no queda grabada» sólo si son verdad.
**Miniatura:** en el segundo 4, «JUEVES 12 DE NOVIEMBRE» en amarillo y el horario debajo, sobre la foto de una laptop abierta en una videollamada (pantalla de galería borrosa). Insignia: «16 s · 1 clip».
**Muestra:** `oferta-clip.webp`.
**Sugerida para:** quien vende en webinars (`canal: webinar`). Sale `carrito` de su fila: ya no es una oferta de checkout.

---

### 2.10 Tour de propiedad (`tour-propiedad`, 24 s)

**Cuándo usarla:** presentar una propiedad o un departamento muestra: un espacio por toma, los datos en etiquetas y una visita como llamado. Es el formato que más publica una inmobiliaria.

| Segundos | Pista | Pieza | Estilo | Animación |
|---|---|---|---|---|
| 0–3 | principal | hueco `fachada` («Fachada u obra») | — | `empujar-izquierda` 0.3 |
| 3–6 | principal | hueco `sala` («Sala») | — | `empujar-izquierda` 0.3 |
| 6–9 | principal | hueco `cocina` («Cocina») | — | `empujar-izquierda` 0.3 |
| 9–12 | principal | hueco `recamara` («Recámara») | — | `empujar-izquierda` 0.3 |
| 12–15 | principal | hueco `amenidad` («Amenidad») | — | `mezclar` 0.4 |
| 15–24 | principal | hueco `asesor` («Asesor a cámara») | — | — |
| 0–3 | texto-1 | `gancho` (28): «DEPTO CON VISTA AL PARQUE» | `amarillo-trazo-negro`, Anton 96, mayúsculas, arriba 300 | `rebote` 0.5 |
| 0.4–3 | texto-2 | `precio` (20): «DESDE MXN 2.4 M» | `recuadro-negro`, Montserrat 56 negrita, mayúsculas, arriba 560 | `deslizar-arriba` 0.3 |
| 3.2–5.9 · 6.2–8.9 · 9.2–11.9 · 12.2–14.9 | texto-2 | `chip-1` a `chip-4` (28): «78 m² frente al parque» · «Cocina integral con barra» · «2 recámaras · 2 baños» · «Roof garden y alberca» | `recuadro-blanco`, Montserrat 48 negrita, abajo 1200 | `deslizar-arriba` 0.3 · sale 0.2 |
| 15.5–20 | texto-2 / texto-3 | `nombre` (28): «Karen Méndez» · `detalle` (32): «Asesora · Torre Alameda» | el zócalo de `testimonio` | ídem |
| 20.5–24 | texto-1 | `cta` (20): «Escribe VISITA» | `recuadro-amarillo`, Montserrat 72 negrita, centro 760 | `rebote` 0.5 · bucle `pulso` 1 |

Sin subtítulos mientras no hay voz: se generan sólo sobre la asesora.

**Ejemplo completo: Torre Alameda** (preventa en Querétaro; 2 recámaras desde MXN 2.4 M). Los datos son los de Copywriter.
- **0–15 s, tomas sin voz:** la obra vista desde la calle → la sala del departamento muestra con el parque por la ventana → la cocina → la recámara principal → el roof garden con la alberca. Cada toma con movimiento (hacia adelante o paneo lento).
- **15–24 s, Karen a cámara:** «Soy Karen, de Torre Alameda. Este sábado abrimos el departamento muestra. Escríbeme VISITA y te paso los horarios y la lista de precios.»

Texto del anuncio: «Departamentos de 2 recámaras en preventa en Querétaro, frente a un parque y a 8 minutos de Constituyentes. Desde MXN 2.4 millones, con enganche del 10 % diferido a 18 meses. Escríbenos VISITA para conocer el departamento muestra este sábado.»
**Regla:** cada etiqueta es un dato de la ficha de la propiedad. Si la persona no lo dio, el Editor lo pregunta; nunca pone metros, precio ni amenidades del ejemplo.
**Miniatura:** en el segundo 1, la foto de la fachada con «DEPTO CON VISTA AL PARQUE» y la etiqueta «DESDE MXN 2.4 M». Insignia: «24 s · 6 clips».
**Muestras:** `tour-propiedad-fachada.webp`, `-sala.webp`, `-cocina.webp`, `-recamara.webp`, `-amenidad.webp` (interiores y exteriores sin personas ni marcas) y `-asesor.webp` (escritorio de recepción de una sala de ventas vacía). Búsqueda: «modern living room apartment», «modern kitchen», «bedroom interior», «rooftop pool», «apartment building», en vertical.
**Sugerida para:** quien cierra en persona (`canal: presencial`).

---

### 2.11 Antes y después (`antes-despues`, 14 s)

**Cuándo usarla:** mostrar un cambio con el mismo encuadre: el avance de una obra, una remodelación, un espacio preparado para vender. Se conservan las piezas de hoy (antes 0–3, después 3–6, pantalla partida 6–11, cierre 11–14). Cambian los textos:

| Hueco | Hoy | Ejemplo nuevo |
|---|---|---|
| `rotulo-antes` (12) | ANTES | 2025 |
| `rotulo-despues` (12) | DESPUÉS | HOY · 60 % |
| `titulo-final` (32) | Tu cambio empieza hoy | Preventa desde MXN 2.4 M |
| `cta` (20) | Reserva tu cita | Escribe PRECIOS |

**Ejemplo completo: Torre Alameda.** Sin voz; lo cuenta el texto del anuncio: «Así estaba el terreno en 2025. Así va la etapa 2 hoy: 60 % de avance. La etapa 1 se entregó en noviembre de 2025, en la fecha del contrato. Departamentos de 2 recámaras desde MXN 2.4 millones. Escríbenos PRECIOS.»
Descripción visual: el terreno a pantalla completa; barrido a la torre en obra desde el mismo ángulo; las dos juntas, una arriba de la otra; la tarjeta final con el precio.
Se queda la nota de Meta de la descripción (mayores de 18 en cosmética y cirugía; plazo en bajar de peso): sirve si la plantilla se usa en otro nicho.
**Miniatura:** en el segundo 8, la pantalla partida: el terreno arriba con «2025» y la obra abajo con «HOY · 60 %». Insignia: «14 s · 2 clips».
**Muestras:** `antes-despues-antes.webp` (terreno o excavación de obra) y `antes-despues-despues.webp` (estructura de un edificio en obra).

---

### 2.12 Receta: YouTube con retención (16:9, 12 min). Tanda 3

No es una plantilla de huecos (el modelo es sólo 9:16). Es una tarjeta de «Nuevo video» que abre un lienzo de YouTube y le deja al Editor el plan de edición para el video largo que suba la persona.

**Ejemplo: Pulso Dental**, la edición del guion 12 de Copywriter: «Revisé 50 anuncios de clínicas dentales: por qué 43 no traen pacientes». Miniatura de YouTube: la plantilla 2 de Image («¿EL TUYO?» sobre la cuadrícula con 43 tachados). Los tiempos de abajo son los de la estructura `youtube-retencion` del guion.

| Minuto | Bloque | Edición | Nota |
|---|---|---|---|
| 0:00–0:05 | Agarre | Corte cada 3 s; los anuncios se tachan en pantalla | Cambio visual antes del segundo 5 |
| 0:05–0:15 | Promesa | Texto «4 errores · 7 que funcionan» antes del segundo 10 | Sin logo ni intro |
| 0:15–0:30 | Lo que está en juego | Acercamiento al 115 % en la cifra | El primer medio minuto prueba lo que promete el título |
| 0:30–1:30 | Intro: 31 clínicas, 12 puntos | Corte cada 5 a 10 s; zócalo «Diego Ferrer / Fundador · Pulso Dental» | Zócalo de 3 a 6 s |
| 1:30–3:00 | Bloque uno | Tarjeta de capítulo «ERROR 1 · VENDE LA LIMPIEZA» de 1.5 a 2 s | 2 a 4 acercamientos por minuto |
| 3:00–3:15 | CTA medio | Texto «Checklist de 12 puntos en la descripción» | Corto: 15 s |
| 3:15–5:00 | Bloque dos (abre con el reenganche del minuto 3) | «Les escribimos a las 50 clínicas como pacientes»; captura de los chats sin contestar | Ningún plano quieto de más de 30 s |
| 5:00–7:30 | Bloque tres (reenganche cerca del minuto 6) | Corte seco y texto en «Ahora viene lo interesante»; el ejemplo en pantalla | Pantalla cada 30 a 60 s |
| 7:30 | Regancho | Texto «El que más pacientes trae es el menos producido» | — |
| 7:30–11:00 | Bloque final | Las 7 que funcionan, una tarjeta por cada una | Una interrupción cada 30 a 40 s |
| 11:00–12:00 | Cierre | Auditoría y video siguiente, en seco; pantalla final de 20 s | Sin despedida larga |

Entrega del Editor: esta tabla con el segundo exacto de cada cambio en el video de la persona, los textos en pantalla y las tomas de apoyo que faltan.

---

### 2.13 Estilos del editor (no son plantillas)

| Pieza | Qué dice el Editor | En el motor |
|---|---|---|
| Subtítulos **Impacto** (anuncios) | 2 o 3 palabras, mayúsculas, la palabra que se dice en amarillo | `palabra-resaltada` (o `impacto`) |
| Subtítulos **Limpio** (testimonio, educativo) | 4 a 7 palabras, sin mayúsculas, sombra suave | `predeterminado` |
| Subtítulos **Karaoke** (podcast, clase) | La frase entera; cada palabra cambia de color al decirse | `karaoke` |
| Zócalo (nombre y cargo) | De 3 a 6 s, la primera vez que la persona habla, nunca en el gancho; una vez por persona | la geometría de `testimonio` |
| Títulos animados | Pregunta o cita: máquina de escribir de 0.8 a 1.2 s · lista: palabra por palabra · número: rebote o acercar · capítulo: deslizar, de 1.5 a 2 s | `maquina-escribir`, `palabra-por-palabra`, `rebote`, `acercar`, `deslizar-izquierda` |
| Transiciones | El corte seco es la norma. Mezclar = cambio de lugar o de tiempo; barrido = antes y después; destello = revelar un número; empujar = seguir la cámara; fundido a negro = quiebre o final; glitch, una vez por video como máximo | `mezclar`, `barrido-*`, `destello-blanco`, `empujar-*`, `fundido-negro`, `glitch` |

---

## 3. El agente experto: el Editor de MaKo

### 3.1 Su método

0. **Lee el contexto antes de preguntar:** el negocio (Second Brain y Offer, con `contextoDelNegocio`), su voz (`vozDelNegocio`), la plantilla y su ejemplo, y la línea de tiempo con sus marcas de hueco.
1. **Diagnostica en una línea** (de marketingskills, MIT):
   - **A:** plantilla con el ejemplo → la adapta;
   - **B:** video propio → lo pule sin cambiar su mensaje;
   - **C:** cambio puntual → hace sólo eso.
2. **Pregunta sólo lo que falta:** un hecho por mensaje y como máximo tres en una adaptación.
3. **Estrategia antes de cortar** (de video-use, MIT): en 4 a 8 líneas. Los textos de la plantilla los propone junto con la estrategia (la persona acepta o descarta la propuesta, como todo en el chat). Los cortes, los silencios y el orden de las tomas, recién después del sí.
4. **Adapta por huecos:** cada texto con su tope y sus mayúsculas, y el guion para grabar con los mismos segundos del ejemplo.
5. **Pule por capas** (de video-use y retention-editing, MIT): pausas y muletillas → acercamientos → tomas de apoyo → textos → transiciones → color → audio → subtítulos al final.
6. **Revisa antes de entregar**, con tres vueltas como máximo.
7. **Recorta un video largo** con puntaje (de claude-shorts, MIT): de 8 a 12 momentos, pesos 30/25/20/15/10 y un umbral de 60.
8. **Lee la curva de retención** (de retention-editing, MIT) con cinco patrones.

### 3.2 Las dos keys del registro

Se sigue la skill `add-editable-prompt`. Las dos van en el grupo «Editor de video (Video Editor)» de `lib/prompt-registry.ts`, con el default exportado desde `lib/editor-video/chat-prompts.ts`.

| Key | Tipo | Slots | Cómo entra |
|---|---|---|---|
| `video_editor.experto` | `instruction`, `scope: 'full'`, `sensitive: false`, sin slots | — | Se antepone en el código al system de siempre: `brandSystem(experto + '\n\n' + chat.system)`, en los dos modos. |
| `video_editor.adaptar.user` | `user`, `dynamic: true`, `scope: 'full'`, `sensitive: false` | `plantilla`, `ejemplo`, `huecos`, `negocio`, `voz`, `instruccion`, `linea` | Reemplaza a `video_editor.chat.user` cuando el pedido viene de «Adaptar a mi negocio». |

**Por qué el método va en una key aparte y no en `video_editor.chat.system`:** ese prompt es `static-only` y `sensitive` (lleva `{{catalogo}}` y `{{formato}}`); si alguien lo edita, un método metido adentro desaparece con su override. Y el negocio va en el user de la key nueva porque `video_editor.chat.user` no tiene `{{negocio}}`, y sumarle un slot a un prompt ya editado deja el override sin él.

### 3.3 Prompt base: `video_editor.experto` (completo, listo para registrar)

> ⚠️ El texto no cita ninguna forma de vos como ejemplo de lo prohibido: la guarda de `tests/puente-panel-copy.test.ts` recorre los strings de `lib/` y la frenaría (trampa 10).

```text
Eres el Editor de MaKo: editas anuncios y contenido orgánico en video para negocios que venden servicios de alto valor en Latinoamérica (coaches, infoproductores, agencias e inmobiliarias). Trabajas en el editor de video junto a la persona. Tu trabajo es que su video quede listo para publicar o pautar, con su material y su mensaje real.

EN QUÉ SITUACIÓN ESTÁS
Antes de responder, decide cuál de estas es y dilo en una línea al principio del resumen:
A) Plantilla con el ejemplo: la línea de tiempo trae textos o clips de una plantilla que siguen como el ejemplo ("muestra": true o "ejemplo": true). La adaptas al negocio.
B) Video propio: la persona ya puso su material. Lo pules sin cambiar su mensaje ni sus palabras.
C) Cambio puntual: pide algo concreto («cambia el color», «saca esa parte»). Haces sólo eso, sin proponer estrategia.

LO QUE NO SE NEGOCIA
1. En A y en B, la estrategia va primero, en "estrategia" y en 4 a 8 líneas: formato y duración, gancho, ritmo de cortes, textos en pantalla, estilo de subtítulos, tomas de apoyo, color y cierre. Los textos de una plantilla los propones junto con la estrategia. Los cortes, los silencios y el orden de las tomas no: primero la estrategia sola, y las operaciones recién cuando la persona dice que sí.
2. No inventas datos: ni cifras, ni nombres, ni testimonios, ni comentarios, ni fechas, ni cupos, ni precios. Usas lo que trae el negocio, lo que dice la persona o lo que se ve en su material. Si falta un dato que el video necesita, lo preguntas.
3. Los textos y el guion de una plantilla son de un negocio ficticio: muestran la forma. Los reemplazas todos, y nunca mezclas un dato del ejemplo con uno del negocio.
4. Un testimonio o un caso con números va sólo si es real y la persona dio permiso para mostrar su nombre, su cara y sus números. Nunca le cambias el sentido a lo que dijo. Si el resultado es de un caso particular, el video lo dice.
5. Un cierre que pide escribir una palabra («Escribe LLAMADA») va sólo si el negocio tiene quien responda esa palabra. Si no lo sabes, lo preguntas o usas otra acción: agendar o registrarse.
6. Nada de ingresos garantizados ni de preguntas sobre la salud, el cuerpo o el dinero de quien mira («¿Tienes deudas?»): Meta rechaza esos anuncios.
7. Escribes en español neutro y tratas de tú.
8. Usas sólo las operaciones del catálogo. Si algo no se puede, lo dices y ofreces lo más cercano que sí se puede.
9. Música sólo si el proyecto ya trae una pista con licencia comercial. No sugieras usar una canción de otro lado: es un reclamo de derechos sobre la cuenta del cliente.
10. No hablas de cómo funciona MaKo por dentro.

CÓMO EDITAS
Gancho: lo que se promete se entiende en los primeros 3 segundos, sin sonido, y queda resuelto antes del segundo 6. El video arranca en mitad de la acción: sin logo, sin intro y sin saludo. El texto del gancho está desde el primer cuadro, arriba, con 28 caracteres como máximo.
Zona segura en 9:16 (1080 × 1920): ningún texto arriba de y=269 ni abajo de y=1248, ni a menos de 65 px de los costados.
Reels, TikTok y Shorts: un cambio visual cada 2 a 3 segundos (un corte, un acercamiento, una toma de apoyo o un texto). Quitas pausas, muletillas y arranques en falso. Nunca cortas en mitad de una palabra. Alternas el plano normal con un acercamiento al 110–120 % en las frases clave. Dejas respirar un remate o una risa.
YouTube: en el primer medio minuto, un corte cada 3 a 5 segundos, un cambio visual antes del segundo 5 y un texto antes del 10. Después, un corte cada 5 a 10 segundos. Ningún plano quieto más de 30 segundos, un regancho cada 2 o 3 minutos, de 2 a 4 acercamientos por minuto, una toma de apoyo o una pantalla cada 30 a 60 segundos y menos de 5 segundos de silencio involuntario en todo el video. Cierre corto y pantalla final de 20 segundos.
Textos en pantalla: una idea por texto, y cada número importante en pantalla. Un texto entra en un corte y sale antes del siguiente. Como máximo un título animado cada 5 a 10 segundos, para no tapar a quien habla.
Subtítulos siempre, porque casi todos miran sin sonido, y al final, encima de todo. Impacto para anuncios: 2 o 3 palabras en mayúsculas y la que se dice resaltada. Limpio para testimonios y contenido educativo: 4 a 7 palabras, sin mayúsculas. Karaoke para podcast y clases. Nunca tapan una cara ni un texto de la plantilla.
Nombre y cargo: de 3 a 6 segundos, la primera vez que la persona habla, nunca durante el gancho.
Transiciones: el corte seco es la norma, y cada transición significa algo. Mezclar para un cambio de lugar o de tiempo, barrido para ir de antes a después, destello blanco para revelar un número, empujar o deslizar siguiendo el movimiento de cámara, fundido a negro para un quiebre o el final. Nunca dos distintas seguidas y ninguna en los primeros 3 segundos. Un glitch, como máximo uno por video.
Color: neutro con un poco de contraste. En una historia, el antes más frío y desaturado y el hoy más cálido. Cuidas el tono de piel.
Audio: la voz limpia y pareja. Si hay música con licencia, va de 12 a 15 dB debajo de la voz mientras alguien habla.
Cierre: un solo llamado a la acción, concreto, en los últimos 3 a 5 segundos.

CUANDO LA PERSONA YA PUSO SU CLIP
Propones el pulido en este orden: pausas y muletillas, acercamientos, tomas de apoyo, textos, transiciones, color, audio y, al final, subtítulos.

PARA RECORTAR UN VIDEO LARGO EN CLIPS
Propones de 8 a 12 momentos con un puntaje de 0 a 100 (gancho 30 %, se entiende solo 25 %, emoción 20 %, valor 15 %, remate 10 %) y sólo los de 60 o más. Cada clip empieza en la frase más fuerte, no en la pregunta de quien entrevista, y termina en un final de oración. Duran de 20 a 60 segundos.

SI LA PERSONA TRAE LA CURVA DE RETENCIÓN DE UN VIDEO PUBLICADO
Caída fuerte en los primeros 30 segundos: rehacer el arranque. Caída pareja: más variedad visual y reganchos. Un precipicio: cortar o reenganchar justo antes de ese segundo. Caída al final: acortar el cierre y adelantar el llamado. Un pico: repetir lo que lo causó.

ANTES DE ENTREGAR, REVISAS
El gancho se entiende sin sonido. No queda ningún texto ni clip del ejemplo. Todo dato es del negocio. Nada sale de la zona segura. Los subtítulos no tapan nada. No hay saltos raros, audio que explota ni silencios largos. Hay un solo llamado a la acción. La duración es la del formato. Si algo falla, lo corriges antes de mostrarlo, con tres vueltas como máximo; lo que no se pudo, lo dices en una línea.

CÓMO RESPONDES
Corto. Una sola pregunta por vez, y sólo si la respuesta no está en el negocio, en el material ni en lo que ya dijo la persona; nunca más de tres en una adaptación. El guion que la persona tiene que grabar va en "guion", con los segundos de cada parte.
```

### 3.4 Default de `video_editor.adaptar.user`

```text
LA PERSONA QUIERE ADAPTAR LA PLANTILLA: {{plantilla}}

EL EJEMPLO DE LA PLANTILLA (de un negocio ficticio: muestra la forma y ninguno de sus datos es de esta persona):
{{ejemplo}}

LOS HUECOS (nombre, tipo, máximo de caracteres y para qué es cada uno):
{{huecos}}

LO QUE SE SABE DE SU NEGOCIO (lo que no está aquí, no existe):
{{negocio}}

SU VOZ:
{{voz}}

LO QUE DICE AHORA:
{{instruccion}}

LÍNEA DE TIEMPO (JSON):
{{linea}}

QUÉ HACES
1. Busca en el negocio cada dato que pide el ejemplo: a quién le habla, el problema, la promesa, la prueba, el precio o la fecha y la acción final.
2. Si falta uno sin el que el video no se sostiene (la prueba de un testimonio, la fecha de una clase, el permiso de un caso), haz UNA pregunta sobre ese hecho en "resumen" y deja "operaciones" vacío.
3. Si no falta nada imprescindible:
   - "estrategia": lo que vas a hacer, en 4 a 8 líneas;
   - "operaciones": un cambiar_texto por cada texto de hueco que sigue como el ejemplo, dentro del máximo de su hueco y con las mismas mayúsculas;
   - "guion": lo que la persona tiene que grabar, con los mismos segundos que el ejemplo y con su voz. Un dato que todavía falta va como [DATO: …] en el guion, nunca en un texto del video.
4. Los clips los pone la persona. Si en "medios" ya hay uno que sirve para un hueco, lo propones con reemplazar_clip.
```

En el código, `{{instruccion}}` y `{{linea}}` van con `contenidoNoConfiable`, como en `video_editor.chat.user`. `{{ejemplo}}` es `plantilla.ejemplo` en texto: negocio, guion con segundos, textos de cada hueco, tomas y texto del anuncio. `{{huecos}}` sale de `huecosDe(p)` más el `para` de cada hueco.

### 3.5 Las preguntas (por hechos, de a una)

Las hace sólo si el dato no está en Offer, en el Second Brain, en el material subido ni en lo que ya dijo la persona. Como máximo tres por adaptación, en este orden de importancia:

| # | Pregunta | Cuándo |
|---|---|---|
| 1 | ¿Este video va como anuncio pagado o como publicación orgánica? | Siempre que no lo diga el pedido |
| 2 | ¿Qué resultado real tienes para este video, con el número y el plazo? | Gancho, caso, testimonio, historia |
| 3 | ¿La persona del testimonio dio permiso para mostrar su nombre, su cara y sus números? | Testimonio y caso |
| 4 | ¿Qué palabra contesta hoy tu automatización cuando alguien te escribe? | Cuando el cierre pide escribir una palabra |
| 5 | ¿Qué día, a qué hora y desde qué ciudad es la clase? | Invitación a clase |
| 6 | ¿Cuánto mide, cuántas recámaras tiene y desde cuánto se vende? | Tour y antes y después de una propiedad |
| 7 | ¿Quién sale a cámara y con qué cargo? | Cuando hay zócalo |
| 8 | ¿Qué tienes grabado hoy: tomas a cámara, pantalla, la propiedad o una clase? | Cuando no hay medios en el proyecto |
| 9 | ¿Cuál es el comentario real que quieres responder? | Respuesta a un comentario |

### 3.6 Cómo adapta la plantilla con los datos del negocio

| Hueco del ejemplo | De dónde sale el dato de la persona | Si no está |
|---|---|---|
| `gancho` | El dolor del cliente ideal en sus propias palabras, o la prueba más fuerte (Second Brain: avatar, dolor, casos) | Pregunta 2 |
| `dato`, `dato-1..3`, `numero` | Un resultado real con número y plazo (testimonios y casos del Brain) | Pregunta 2. Sin prueba, cambia a una prueba de proceso («6 preguntas en el mismo orden») y dice qué dato la haría más fuerte |
| `cita`, `nombre`, `detalle` | El testimonio guardado y su permiso | Pregunta 3. Sin permiso, no hay testimonio |
| `titulo-final` | El segmento y el precio o la promesa (Offer) | — |
| `cta` | La palabra de una automatización activa; si no hay, «Agenda tu llamada» o «Regístrate gratis» | Pregunta 4 |
| `fecha`, `horario` | El evento real; las horas de cada país se calculan desde su zona horaria | Pregunta 5 |
| `chip-*`, `precio` | La ficha de la propiedad | Pregunta 6 |
| `comentario`, `usuario` | Un comentario real; si no hay, «Pregunta frecuente» | Pregunta 9 |
| `titulo-1..3`, `beneficio-*` | Lo que enseña o entrega la oferta (Offer: entregables) | — |
| guion | Los mismos bloques y segundos del ejemplo, con la voz del negocio | Lo que falta va como `[DATO: …]` en el guion |

### 3.7 El flujo en el chat

1. «Usar plantilla» → el proyecto nace armado con el ejemplo (muestras de Pexels y textos del negocio ficticio) y se abre el editor con «Editar con IA» a la izquierda.
2. El chat arranca con un mensaje armado en el código, sin llamar a la IA: «Es un ejemplo de Cierre Consultivo, un negocio ficticio. ¿Lo adapto a tu negocio?», con los botones **«Adaptar a mi negocio»** y **«Lo edito yo»**.
3. «Adaptar a mi negocio» llama a la IA en modo `adaptar`. Vuelve una pregunta, o la estrategia + los textos nuevos (como propuesta para aceptar) + el guion para grabar, con «Copiar».
4. La persona graba y sube su clip. El Editor lo pone en el hueco (`reemplazar_clip`) y propone el pulido: estrategia primero; después del sí, `borrar_silencios`, `eliminar_muletillas`, `dividir` + `transformar` (acercamientos), `ajustar_color`, `normalizar`, `generar_subtitulos` con el estilo de la plantilla.
5. Al exportar, el aviso de siempre («Sustituye los clips de muestra») suma los **textos del ejemplo** que quedaron sin cambiar.

### 3.8 Pruebas del agente (evals, el formato de marketingskills)

| Pedido | Lo que tiene que pasar |
|---|---|
| Adaptar `gancho` para Voz de Líder, con un caso real en el Brain | `cambiar_texto` de los 4 textos, todos dentro de su tope; el guion con los segundos 0–21; ningún dato de Cierre Consultivo |
| Adaptar `testimonio` sin testimonios en el Brain | Una sola pregunta (la 2 o la 3) y ninguna operación |
| Adaptar `oferta` sin fecha | Pregunta 5; no deja «JUEVES 12 DE NOVIEMBRE» |
| «Cambia el botón a amarillo» | Situación C: una operación y sin estrategia |
| «Ponle una canción de moda» | Dice que no hay música con licencia en el proyecto; ninguna operación de audio |
| Recortar un podcast de 60 min | De 8 a 12 momentos con puntaje, sólo los de 60 o más, y ningún corte antes del sí |

---

## 4. Qué se copia y de dónde

**Copiable en un SaaS cerrado** (LICENSE abierto hoy, 29/10/2026). El aviso se conserva como decide el README (sección 5): una sola copia por repo en `lib/avisos/LICENSE-<REPO>` y una cabecera en cada archivo que toma algo (el molde de `app/video-editor/_opencut/LICENSE-OPENCUT`, en un solo lugar). Todo se traduce y se reescribe para high ticket en Latinoamérica.

| Fuente | Licencia exacta | Qué se copia | Dónde va |
|---|---|---|---|
| https://github.com/thecraighewitt/skills (`youtube/retention-editing/SKILL.md`) | MIT License, «Copyright (c) 2026 Craig Hewitt» | Ritmo por sección (3–5 s, 5–10 s), nada quieto más de 30 s, 2 a 4 acercamientos por minuto, toma de apoyo cada 30 a 60 s, menos de 5 s de silencio involuntario, los 5 patrones de la curva y el checklist | `video_editor.experto`; receta de YouTube |
| https://github.com/browser-use/video-use (`SKILL.md`) | MIT License, «Copyright (c) 2026 Browser Use» | Aprobar el plan antes de cortar, nunca cortar en mitad de una palabra, subtítulos al final, umbrales de silencio (400 ms limpio; 150–400 ms con revisión), 50/80 ms de aire, subtítulos de 2 palabras con mínimo de 0.35 s, música 12–15 dB debajo de la voz, autorrevisión en tres vueltas | `video_editor.experto` |
| https://github.com/AgriciDaniel/claude-shorts | MIT License, «Copyright (c) 2026 Daniel Agrici» | La lógica: puntaje con pesos 30/25/20/15/10, umbral de 60, de 8 a 12 candidatos, gancho en texto en los primeros 3 s, bordes en palabras y oraciones, recorte por tipo de contenido. **No el render**: depende de Remotion | `video_editor.experto` (recortar); `clip-podcast` |
| https://github.com/WyattBlue/auto-editor | The Unlicense (dominio público) | Los valores por defecto del borrado de silencios como referencia para calibrar `borrar_silencios` (verificarlos en su código antes de usarlos) | `borrar_silencios` |
| https://www.pexels.com/license/ | Licencia de Pexels: uso libre, también comercial; atribución no requerida («always appreciated»); se puede modificar. Prohibido: mostrar personas identificables de forma negativa u ofensiva, vender copias sin cambios, insinuar que las personas o marcas de la imagen respaldan el producto, redistribuir en otras plataformas de stock y usarlas como marca | Clips y fotogramas de muestra, elegidos a mano y sin caras, guardados en `public/video-editor/plantillas/`. Crédito «Video de X en Pexels» en el registro de créditos | Muestras de los huecos |
| https://www.pexels.com/api/documentation/ (sólo si después se busca stock desde el chat) | API de Pexels: link visible a Pexels con cada uso y crédito al autor cuando se pueda; 200 pedidos por hora y 20,000 por mes; prohibido replicar Pexels; la key va en el header `Authorization` (desde el servidor) | — | Tanda 3, opcional |
| https://kenney.nl/assets/interface-sounds | «Creative Commons CC0» (página del pack; 100 archivos) | Pop, click y whoosh, **cuando** exista una pieza de audio en las plantillas. Hoy no hay dónde ponerlos | Tanda 3 |
| https://github.com/diffusionstudio/lottie | MIT, «Copyright (c) 2026 Diffusion Studio Inc.» | La skill para que la IA escriba un Lottie con la marca del negocio (título, zócalo, logo) | Más adelante |

**Sólo como idea** (no se copia ni el texto, ni el código, ni el nombre):

| Fuente | Por qué |
|---|---|
| https://github.com/heygen-com/hyperframes | Es Apache-2.0 («Copyright 2026 HeyGen, Inc.»), pero cada bloque es un HTML con un timeline de GSAP, y la licencia gratuita de GSAP prohíbe usarlo «in tools that allow users to build visual animations without code» que compitan con Webflow: eso es el editor. Además el motor de MaKo es OpenCut/WASM, no HTML. Se toman los tiempos y el orden por intención |
| Remotion (https://www.remotion.dev) | «Remotion License»: gratis para personas y empresas de hasta 3 empleados; las demás necesitan Company License. Su FAQ no aclara el caso de un SaaS que renderiza para clientes |
| CapCut, Descript, Opus Clip, Submagic | Productos con copyright: se toma el modelo de la tarjeta y del flujo |
| Estilos «Hormozi» y «Ali Abdaal» | Son nombres de personas y no hay una fuente de primera mano; las que hay se contradicen |
| TikTok «Creative best practices», ayuda de YouTube | Se citan los hechos (propuesta en 3 s, gancho antes del 6; la métrica «Intro» de los primeros 30 s), no el texto |
| `remotion-dev/skills`, `reactvideoeditor/remotion-templates` | Sin LICENSE (según la investigación) |
| digitalsamba/claude-code-video-toolkit, agency-agents (`marketing-short-video-editing-coach`) | Licencia MIT según la investigación, no releída hoy: sólo el orden de los pasos |
| Coverr, Mixkit, música de Pixabay, Freesound API, LottieFiles | Excluyen editores de video, productos competidores, la redistribución o el uso como servicio (según la investigación) |

---

## 5. Cómo implementarlo sobre el código actual

### Tanda 1: el contenido y la tarjeta (sin IA)

| Archivo | Cambio |
|---|---|
| `lib/editor-video/plantillas.ts` | **Tipos:** `HuecoClip.muestra?: string` (ruta del WebP); `HuecoTexto.para?: string` (para qué es, lo lee el Editor); `Plantilla.objetivo` (`'vender-llamada' \| 'prueba-social' \| 'educar' \| 'evento' \| 'propiedad'`); `Plantilla.ejemplo: { negocio; cuando; guion: { desde; hasta; dice }[]; tomas: string[]; anuncio?: string; creditos: { archivo; autor; url; fuente: 'Pexels' \| 'MaKo' }[] }`. **Catálogo:** reescribir `gancho` y `testimonio`, cambiar los textos de `beneficios` y `antes-despues`, convertir `oferta` en la invitación a clase (borrar `numero`), sumar las 6 nuevas, borrar `ganchoEscrito` y `ofertaGlitch` y ordenar `PLANTILLAS` como la tabla de 2.0. `plantillasParaApi` suma `objetivo` y `cuando`. |
| `lib/editor-video/plantillas-etiquetas.ts` | Filas nuevas: `respuesta-comentario: { canal: ['conversaciones'], entrada: ['chat_entrante'] }`, `caso-numeros: { canal: ['llamadas'], cobro: ['suscripcion'] }`, `historia: { cuello: ['conversion'] }`, `tres-errores: { entrada: ['chat_entrante'] }`, `clip-podcast: {}`, `tour-propiedad: { canal: ['presencial'] }`. `oferta` pasa a `{ canal: ['webinar'] }`. Se borran las filas de las dos variantes. |
| `public/video-editor/plantillas/` (carpeta nueva) | Un WebP de 1080×1920 por hueco de clip (unos 30, de 60 a 120 KB cada uno), con el nombre `<plantilla>-<hueco>.webp`, más la captura propia de `caso-numeros`. Hay antecedentes en `public/anuncios/` y `public/cv/plantillas/`. |
| `app/video-editor/_opencut/plantillas/dibujo.ts` | `dibujarMuestraClip(ctx, rotulo, celda, imagen?, opcional?)`: con imagen, la dibuja cubriendo la celda y, si el hueco no es opcional, una marca chica con el rótulo abajo a la izquierda. Sumar `drawImage` a `Contexto2D`. Sin imagen, el gris de siempre. |
| `app/video-editor/_opencut/plantillas/uso.ts` | `nombreMuestra(rotulo, archivo?)`; `rotulosDe` pasa a `muestrasDe(plantilla)` → `{ rotulo, archivo, opcional }` sin repetir. |
| `app/video-editor/_opencut/plantillas/muestras.ts` | `prepararMuestras` recibe `muestrasDe`; baja el WebP con `fetch` + `createImageBitmap`, lo dibuja y lo guarda oculto como hoy. Si la imagen falla, usa el gris: el armado nunca se traba por una muestra. |
| `app/video-editor/_opencut/plantillas/armar.ts` · `instanciar.ts` | La muestra de cada pieza se busca por `rotulo + archivo` en vez de sólo por rótulo. |
| `app/video-editor/_opencut/plantillas/escena.ts` · `components/miniatura-plantilla.tsx` | La miniatura carga las imágenes de muestra (con caché de módulo) y las dibuja en sus celdas; se exporta para usarla desde Create. |
| `app/_crear/reglas.ts` | Los campos comunes de la tanda 0 (README, sección 6). Video llena `insignia` («Sugerida · 24 s · 1 clip»), `grupo` (el objetivo), `ayuda` y `ejemplo`. |
| `app/_crear/PantallaCrear.tsx` · `app/_crear/crear.css` | `NuevaCrear` acepta `miniatura?: (p: PlantillaCrear, activa: boolean) => ReactNode` (si devuelve algo, va en lugar del marco), guarda qué tarjeta tiene el mouse encima y dibuja la `insignia` sobre la miniatura (`.cr-plantilla__insignia`). Las otras tabs no cambian. |
| `app/video-editor/plantillas-crear.ts` | Cada plantilla lleva `insignia` = «Sugerida · » si corresponde + `${duracion} s · ${n} clip(s)` (los no opcionales). El `rotulo` queda sólo para el marco sin miniatura. Nuevo `plantillaDeTarjeta(id)` para dibujarla. |
| `app/video-editor/VideoEditorCliente.tsx` · `app/m/video-editor/InicioVideoM.tsx` | Pasan `miniatura` con `MiniaturaPlantilla` cargada con `dynamic(..., { ssr: false })`, como `PanelChat`. **Antes de subir:** medir el peso del chunk. Si arrastra el WASM del motor, la tarjeta usa un póster WebP exportado y la miniatura viva queda para la pestaña Plantillas. |
| `app/video-editor/_opencut/plantillas/huecos.ts` · `app/video-editor/_opencut/export/dialogo-exportar.tsx` | `textosDeEjemplo(tracks)`: los textos de hueco cuyo contenido sigue igual a la muestra de su plantilla. El diálogo de exportar los nombra junto al aviso de clips. |
| `app/video-editor/_opencut/chat/linea.ts` | Marca `ejemplo: true` en el texto de hueco que sigue igual al ejemplo, para que el Editor sepa qué falta adaptar. |
| Tests | `tests/video-editor-plantillas.test.ts`: las claves de `MUESTRAS` pasan a rótulo + archivo, y casos nuevos: cada `muestra` existe en `public/`, cada archivo tiene su crédito, el guion cubre la pieza principal, ningún ejemplo tiene voseo (`marcasDeVoseo`). `tests/video-editor-nuevo-video.test.ts`: la regex «Sugerida · 15 s» pasa a la `insignia`. `tests/plantillas-sugeridas-editores.test.ts`: las filas. `tests/video-editor-plantillas-uso.test.ts`: el dibujo con imagen. `tests/crear-pantalla.test.ts`: la insignia. |

### Tanda 2: el Editor de MaKo

| Archivo | Cambio |
|---|---|
| `lib/editor-video/chat-prompts.ts` | `PROMPTS_CHAT_VIDEO.experto` y `.adaptar`; los defaults `VIDEO_EXPERTO_TEMPLATE` (3.3) y `VIDEO_ADAPTAR_USER_TEMPLATE` (3.4). |
| `lib/prompt-registry.ts` | Las dos entradas de 3.2 en el grupo «Editor de video (Video Editor)». Después, correr la skill `verify-prompt-registry-sync`. |
| `lib/editor-video/chat-catalogo.ts` | `FORMATO_CHAT` suma dos campos opcionales: `"estrategia"` (hasta 8 líneas) y `"guion"`. Se validan con topes nuevos en `TOPES_CHAT`. |
| `lib/editor-video/ia.ts` | `PedidoChatVideo` suma `modo?: 'editar' \| 'adaptar'` y `plantilla?: string`. System: `brandSystem(experto + '\n\n' + chat.system)` en los dos modos. En `adaptar`, el user sale de `video_editor.adaptar.user` con `negocio` = `contextoDelNegocio(pedido)` (`lib/copywriter/contexto.ts`), `voz` = `vozParaPrompt(await vozDelNegocio())` (`lib/offer-ia.ts`, `lib/nutricion-generator.ts`), y `ejemplo` y `huecos` de la plantilla. `ResultadoChatVideo` devuelve `estrategia` y `guion` **aparte del resumen**, que hoy se corta a la primera línea y 300 caracteres. |
| `app/api/video-editor/ia/route.ts` | Pasa `modo` y `plantilla` (validada con `plantillaPorId`). |
| `app/video-editor/_opencut/chat/PanelChat.tsx` | Con el hilo vacío y textos `ejemplo: true` en la línea de tiempo: el mensaje local «Es un ejemplo de {negocio}, un negocio ficticio. ¿Lo adapto a tu negocio?» con «Adaptar a mi negocio» y «Lo edito yo». La respuesta muestra la estrategia y el guion (con «Copiar»). |
| `tests/video-editor-chat.test.ts` | Las keys y los slots nuevos coinciden con `renderPrompt`; `FORMATO_CHAT` con los dos campos; ningún default cita voseo. |

### Tanda 3

- **El clip en movimiento en la tarjeta:** un MP4 de 3 a 5 s por hueco (540×960), dibujado en el canvas de la miniatura con el mouse encima.
- **La receta de YouTube:** `DestinoNuevoVideo` suma `{ tipo: 'receta', id }`; abre el lienzo de YouTube y le deja la tabla de 2.12 al Editor.
- **Agrupar por objetivo** si la grilla pasa de 12 tarjetas.
- **Sonidos:** una pieza de audio en `Plantilla` y los de Kenney (CC0), verificando la licencia pack por pack.

**Dónde se cosecha** (en el mismo commit que el código): las trampas de la sección 6 van a `docs/hallazgos-video-editor.md` (el código vive en `app/video-editor` y `lib/editor-video`) con su línea en `docs/hallazgos.md`, y el plan de `docs/editor-video/plan-plantillas-anuncio.md` se actualiza con el catálogo nuevo.

---

## 6. Trampas

1. **El diagnóstico obvio («faltan diseños de plantillas») era el equivocado.** Los tiempos, las animaciones y los huecos están bien y tienen tests. Fallan el ejemplo (copy de e-commerce), la muestra (un PNG gris) y que **Create no dibuja la plantilla**: `plantillasNuevoVideo` no pasa `imagen`, así que la tarjeta es un marco con «15 s», aunque la miniatura viva ya existe en la pestaña Plantillas del editor.
2. **El modelo de plantilla es sólo 9:16.** `usarPlantilla` fija la relación 9:16 y `LIENZO_REF` y `ZONA_SEGURA` son de Reels. Una plantilla de YouTube 16:9 no se arma con lo que hay: va como receta.
3. **Las plantillas no tienen audio y el chat no puede agregarlo.** `PistaPlantilla` no tiene pista de audio, y «agregar música o sonidos de la biblioteca» está en la lista de lo que el chat no hace. Un plan que promete SFX o música en las plantillas no se puede cumplir.
4. **Una muestra tiene como máximo 5 palabras** (test 7). Por eso el comentario del ejemplo es «¿Pagar si YouTube es gratis?» y no la pregunta completa, el dato es «2/10 → 4/10 CIERRES» y el ejemplo largo va en `ejemplo.guion`.
5. **Inter no es una fuente de plantilla.** `FUENTES_PLANTILLAS` sale de las plantillas de texto (Anton, Montserrat, Playfair Display, Bebas Neue, Poppins…) y `cajaDeTexto` sólo sabe medir tres. El estilo «Clean» de claude-shorts (Inter) se arma con Montserrat.
6. **Una persona de stock en un hueco «a cámara» es un respaldo falso.** Con los subtítulos y el dato, la persona del clip «dice» un resultado que nunca dijo, y la licencia de Pexels prohíbe insinuar respaldo. Las muestras no tienen caras.
7. **Una muestra opcional que no se reemplaza se exporta tal cual.** `quedanMuestras` no cuenta las opcionales. Si la muestra de una toma de apoyo trae dibujado «Toma de apoyo», sale así en el anuncio. Las opcionales van sin rótulo.
8. **El resumen del chat se corta.** `editarVideo` se queda con la primera línea y 300 caracteres. La estrategia y el guion no caben ahí: necesitan campos propios.
9. **Las muestras se guardan por rótulo.** `nombreMuestra(rotulo)` reutiliza «Muestra · Tu clip.png» entre plantillas. Con imágenes distintas por plantilla, la clave tiene que llevar el archivo, o todas las plantillas muestran la misma foto.
10. **El prompt no puede citar voseo, ni siquiera como ejemplo de lo prohibido.** El prompt de la investigación decía «Nada de voseo (…)» con tres formas de vos entre paréntesis. `tests/puente-panel-copy.test.ts` recorre los strings de `lib/` y lo frena. Se dice «español neutro, tratando de tú».
11. **Números que la investigación traía y la fuente no dice:**
    - la música a 18–24 dB debajo de la voz no tiene fuente primaria; video-use dice 12–15 dB;
    - claude-shorts pone el gancho en los primeros 3 s, no 3.5 s;
    - retention-editing pide quitar silencios de más de 1 s; los 0.4 s son el umbral de video-use para un corte limpio.

    Va lo verificado.
12. **Meta y los cierres:**
    - «Escribe LLAMADA» sólo sirve si hay una automatización que conteste esa palabra; si no, el lead escribe y nadie responde.
    - Una cifra de facturación propia en un anuncio para captar negocios se lee como promesa de ingresos. Es una inferencia sin verificar contra la política, y por eso la historia del fundador habla de clínicas y no de dólares.
13. **No partir la pieza principal en dos piezas del mismo hueco.** El mismo `HuecoClip` en dos piezas es un solo hueco, y no está medido si la segunda pieza sigue el video o lo arranca de nuevo. El quiebre de la historia lo hace el Editor con `dividir`, no la plantilla.
14. **Cambiar duraciones y retirar ids rompe tests que parecen ajenos:**
    - `tests/video-editor-nuevo-video.test.ts` espera «Sugerida · 15 s» en el `rotulo` de `testimonio`;
    - `tests/plantillas-sugeridas-editores.test.ts` exige una fila por plantilla.

    Con `imagen` o miniatura, el `rotulo` no se dibuja: «Sugerida» tiene que pasar a la `insignia` o desaparece de la tarjeta. Los proyectos viejos con marcas de `gancho-escrito` u `oferta-glitch` siguen andando: `linea.ts` sólo pierde el tope de caracteres.
15. **Las «licencias libres» que no sirven para un editor:**
    - HyperFrames es Apache, pero corre sobre GSAP, que lo prohíbe en herramientas de animación sin código.
    - Remotion cobra a empresas de más de 3 personas.
    - Coverr y Mixkit excluyen editores de video y productos competidores.
16. **El modelo del chat.** El comentario de `lib/editor-video/ia.ts` dice que la feature `video-editor-ia` va por la cascada barata con Gemini por defecto y Claude vetado. Antes de medir al Editor hay que mirar en `/modelos-ia` qué modelo responde de verdad: un prompt de método largo en un modelo barato puede seguirse peor.
17. **Los horarios del ejemplo no se copian.** México no tiene horario de verano desde 2022 (salvo la frontera), Colombia y Perú nunca, Chile sí. El Editor calcula cada país desde la zona del evento.

---

## 7. Lo que queda sin hacer (con dónde vive)

- **Elegir los clips de Pexels** (unos 30): bajarlos, recortarlos a 1080×1920, exportar el fotograma WebP y anotar autor y URL en `ejemplo.creditos` de `lib/editor-video/plantillas.ts`. Ningún clip está elegido.
- **Hacer la captura de `caso-numeros`** (propia, con los números del ejemplo).
- **Medir el peso de `MiniaturaPlantilla` fuera del editor** (`VideoEditorCliente.tsx`). Si arrastra el WASM, ir por el póster WebP.
- **Buscar en la web los nombres del elenco** (Torre Alameda, Clínica Dental Altamira, «Ventas sin presión») antes de publicar.
- **Releer el LICENSE** de digitalsamba/claude-code-video-toolkit y de agency-agents si se va a copiar algo de ellos (hoy son sólo idea).
- **La música:** Epidemic Sound sigue «pendiente de alta» en `lib/musica-catalogo.ts`, y no está resuelto quién paga la licencia comercial de cada cliente.
- **Los sonidos de Kenney:** verificado el CC0 sólo de «Interface Sounds»; falta pack por pack.
- **Los valores por defecto de auto-editor:** verificarlos en su código antes de calibrar `borrar_silencios`.
