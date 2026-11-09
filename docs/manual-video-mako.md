# Manual de video de MaKo

Es la fuente de verdad para generar videos con avatar. Lo siguen MaKo (la IA de la app), Claude y cualquier persona del equipo.
Reglas dictadas por Martín el 9/11/2026, más todo lo medido hasta esa fecha.

**Índice:**
[1. Qué es](#1-qué-es-esto-y-cómo-se-usa) ·
[2. Palabras](#2-las-palabras) ·
[3. Reglas universales](#3-reglas-universales) ·
[4. El flujo](#4-el-flujo-paso-a-paso) ·
[5. Checklists](#5-checklists-de-validación) ·
[6. Herramientas](#6-herramientas-y-modelos) ·
[7. Templates](#7-templates) ·
[8. Assets](#8-assets) ·
[9. Sin resolver](#9-lo-que-todavía-no-está-resuelto)

---

## 1. Qué es esto y cómo se usa

- Sirve para que cualquier usuario haga su video con avatar fácil, sin gastar créditos en algo que después no le sirve.
- Hay tres capas de reglas: **universales** (§3), **por template** (§7) y **por asset** (§8). Las tres se cumplen a la vez.
- Antes de mostrarle una imagen al usuario, MaKo o Claude recorren los checklists que tocan (§5). Recién cuando todo está bien, la mandan para su OK.
- Si una regla falta, se agrega acá. Martín: «Seguro se me olvidaron reglas: anótalo todo como regla, que sea nuestro manual.»
- Si otro documento dice otra cosa, se mide y se corrige el que está mal. Gana la nota que se puede medir, no la más nueva.
- El detalle y la historia de cada regla viven en `docs/video-avatar-desde-foto.md`, `docs/edicion-video-automatica.md`, `docs/relevo/reel-mentores-high-ticket.md` y en `AGENTS.md` (desde «Un método de generación se prueba con el modelo MÁS BARATO»).

---

## 2. Las palabras

| Palabra | Qué es |
|---|---|
| **Template** | Un video viral que los usuarios quieren replicar con SUS guiones, avatares y fondos, siguiendo exactamente la misma estructura y los mismos pasos. Ejemplo: «Mensaje para…» (§7). |
| **Asset** | Cada pieza que se arma por separado y se reusa: el fondo, el avatar, un inserto, los subtítulos, la música, la cartela final. Cada uno tiene sus parámetros, reglas y estándares. |
| **Avatar** | La persona del video, hecha con IA desde una foto real. Se hace sola, sin el fondo del video. |
| **Fondo** | El lugar donde está la persona. Se hace solo, sin personas. |
| **Imagen original** | La versión aprobada y limpia de cada pieza (el fondo solo, cada avatar solo), bajada en «1K · Tamaño original». Es el punto de retorno. Nunca es una imagen combinada, ni una edición encima de otra, ni un reescalado. |
| **Combinación** | La edición que mete al avatar en el fondo. Es UNA sola edición: el fondo de base y el avatar de referencia. |
| **Win / estándar** | Lo que al usuario le gustó: su avatar, su fondo, su voz. Se guarda en el momento, con su contexto, y pasa a ser su estándar. Lo siguiente parte de ahí. |
| **Base** | La imagen que se edita y que tiene que quedar intacta. |
| **Referencia** | La UNA imagen que muestra cómo tiene que quedar lo que cambia. |
| **Fotograma inicial** | La imagen desde la que arranca el video («Fotogramas» en Flow, `image_urls` en ApiMart). |
| **Checklist** | La lista de puntos que se revisa mirando la imagen antes de mostrarla. |
| **contexto.md** | El archivo que va junto a cada clip con todo lo que se usó para generarlo (§6.9). |
| **Créditos** | Lo que cuesta el video. En Flow las imágenes no gastan créditos; el video sí. |

---

## 3. Reglas universales

### Las de Martín (9/11/2026)

1. **Todo video parte de una imagen, siempre.**
   El video anima una imagen ya aprobada. Nunca se genera un video desde un texto.

2. **Nunca se regenera nada sobre una imagen hecha con IA: ante un feedback, se vuelve a la imagen original.**
   «Si el usuario tiene un feedback, se tiene que volver a la imagen original», para no perder calidad. Lo mismo entre clips: «por más de que haya cambios de movimiento, de posición, etcétera, siempre se debe partir desde el avatar original… si no, van a haber discordancias seguro en los avatares». Nunca del fotograma de otro clip ni de otra combinación.

3. **Un win se guarda y pasa a ser el estándar del usuario.**
   Cuando le gusta su avatar o su fondo, «hay que guardarlo»: lo siguiente parte de ahí y no se vuelve a buscar.

4. **El fondo y el avatar se crean en imágenes separadas, nunca juntos.**
   «Nunca ambas cosas juntas, porque eso confunde a la IA.» Primero todo el fondo, después todo el avatar, y recién ahí se combinan: el fondo de base y el avatar de referencia («toma la imagen del fondo sin nadie y le agregas el personaje. No al revés»). Dos personas son tres imágenes (fondo, avatar 1, avatar 2) antes del video.

5. **Un feedback se corrige en la imagen original de ESA pieza, nunca en la combinada.**
   Si es del fondo, se vuelve al fondo solo, se corrige y se combina de nuevo. Si es de un avatar, se vuelve a SU imagen original.

6. **Todo se valida con su checklist antes de mostrárselo al usuario, sobre todo la imagen.**
   Cada template y cada asset tiene sus parámetros, reglas y estándares. Se recorren las reglas generales de avatar, de fondo y de combinación, más las extra del template (por ejemplo, en «Mensaje para…», el avatar propio con iluminación y fondo blanco) y las del asset. Entre las generales, dos que Martín marcó el 9/11: la escala real («no puede ser posible que el pizarrón sea exageradamente grande… y yo quede así de chiquito») y el rostro idéntico al original («que el rostro y las expresiones y todo sea idéntico al original»). Recién cuando Claude o MaKo están seguros, se manda para el OK.

7. **Los créditos se gastan recién con el OK del usuario a la imagen. Nunca antes.**
   «Cuando el usuario da el ok, generar el video: ahí recién se pasa a gastar los créditos.» «Para que no sea culpa nuestra casi nunca.»

   **Duración = palabras, y el clip se transcribe antes de entregar** (Martín, 9/11): «porque elegiste una duración más larga de la que debería… repitió una palabra, eso no debería pasar… contar las palabras para determinar cuántos segundos le vas a mandar a la instrucción. Y de paso también se ahorran tokens». Si el video dura más que la frase, Omni repite palabras («…en vendehumo, en vendehumos», clip 3 con 16 palabras en 8 s). Ritmo real de Omni (transcripción): ~3,3 palabras/s quieto, ~2,8 con un gesto; el habla arranca ~0,8 s. Duración = el valor más chico de Flow (3–10 s, 3 créditos/s) que cubra `0,8 + palabras/ritmo + 0,3`. Antes de entregar: `node C:/dev/reel-mentores/voz/chequear-guion.mjs <clip.mp4> "<guion>"` (ElevenLabs speech-to-text) marca palabras REPETIDAS, faltantes o cambiadas.
   **Y nunca variaciones de video** (9/11): «no debería generar variaciones de video, de imágenes sí tienes libertad absoluta porque básicamente imagen no gasta casi nada, pero video sí gasta, entonces prefiero de última que el usuario te lo valide.» De imagen, todas las muestras que hagan falta; de video, uno por pedido, con el OK a su imagen.
8. **Una sola referencia y un prompt simple. Siempre.**
   «No le pases muchas referencias porque ahí lo hace mal la inteligencia artificial.» Cada referencia de más compite con las otras.

9. **A Flow jamás le entra una imagen reescalada: siempre el original de 1K.**
   «La IA vuelve a regenerar sobre eso y elimina muchos detalles.» Todo en calidad original, también los videos.

10. **Lo que se aprende se anota como regla en este manual.**
    «Anótalo todo como regla, que sea nuestro manual.»

Martín también pidió dejar fijas las reglas de ElevenLabs y de la voz (qué modelos se usan y cuáles jamás), las de la generación de video y el proceso de clonado de voz: están en §6.1, §6.3 y §6.4. El video va por Flow, no por ApiMart: «¿por qué usaste ApiMart, si estamos usando Flow para no gastar?» (§6.2). Y pidió investigar si el template actual tiene nombre, quizás por su soundtrack: está en §7.1.

### Del oficio (medidas)

11. **Toda generación parte de una base, nunca de puro prompt.**
    Martín: «el modelo de Omni entiende muy bien cuando le pasas una imagen de referencia… nunca con puro prompt, le sale mal».

12. **El prompt es corto y humano: pide el efecto, no la receta.**
    «Mientras más simple y humano, mejor te entiende.» El modelo cumple cada frase técnica al pie de la letra y, todas juntas, arman otra foto.

13. **Lo que no quieres, no lo nombres.**
    Lo escrito en negativo se cumple al revés: «sin sombra proyectada» metió un fondo plano de recorte.

14. **La cara y la pose no se describen con palabras: se pasa la foto.**
    La descripción compite con la foto. Con la referencia y una frase, la pose salió al primer intento después de cuatro fallidos.

15. **Lo que queda intacto va de base; lo que se agrega entra de referencia.**
    Para combinar: base = el fondo, referencia = la persona. Martín: «toma la imagen del fondo sin nadie y le agregas el personaje. No al revés». Con la persona de base, el corcho salió desfasado y la pared apuntando para otro lado.

16. **Las ediciones no se apilan: dos o tres como mucho, y se vuelve a la versión limpia.**
    La degradación no avisa: a la novena edición había un ojo deformado y la foto de la mano desfigurada, sin que nadie los tocara.

17. **Lo generado se chequea antes de entregar, contra todo el feedback que ya se dio.**
    Martín: «hay que chequear antes de entregar». Con la misma referencia y la misma frase, dos corridas dan resultados distintos y el modelo no avisa.

18. **Lo que replica una referencia se mira al lado de la referencia.**
    «Te pido que lo compares con Josep siempre.» El parecido se juzga comparando, no de memoria.

19. **Cada clip sale con su contexto.md, escrito al generar.**
    «Que cada generación traiga todo un contexto, pues si no estamos dando vueltas.» Un nombre de archivo no es documentación.

20. **Para una cara que habla, sólo Omni.**
    «TENÉS PROHIBIDO USAR OTRO MODELO QUE NO SEA OMNI… el resto NO sale bien.»

21. **El acento lo pone el origen: cómo habla el video.**
    El voice-to-voice conserva la prosodia del audio de origen. El acento no se arregla en ElevenLabs.

22. **La configuración de voz vive en un solo archivo y se copia idéntica.**
    «Tienes que copiarlo idéntico… si no se confunde siempre.» Cada vez que se retipeó, salió distinta.

23. **El método se prueba con lo más barato; lo caro se paga una vez.**
    «El método de AvatarHype lo pensaron para AHORRAR.» No se disparan dos modelos «para elegir».

24. **Lo que gasta créditos no se reintenta por defecto.**
    Sólo se reintenta si consta que el pedido nunca salió. Un reintento a ciegas cobra dos veces.

25. **Una pieza que ya existe se arregla; no se reemplaza por otra «mejor».**
    «Lo que no podés hacer es salirte de lo que estamos haciendo.» Si no se puede arreglar, se dice y se pregunta.

26. **Si el chequeo no es automático, el usuario ve la referencia y el resultado juntos.**
    Que el usuario descubra el error es justo lo que el producto no le puede hacer.

27. **El acento del cliente es un dato que se pregunta, no un default.**
    Una detección automática mide la máquina de quien verifica. Así a un cliente de Baja California le quedó acento argentino.

28. **Antes de la primera generación de un área, se lee su curso.**
    `lib/curso-avatar.ts` ya tenía escritas las dos causas del video malo del 7/11, y se abrió recién después de ocho generaciones.

29. **Cuando dos notas se contradicen, gana la que se puede medir.**
    Se siguió la nota más nueva sin medir y se entregó una voz que no era la de Martín.

---

## 4. El flujo paso a paso

Hasta el paso 5 todo es gratis (imágenes). **Los créditos empiezan en el paso 6, y sólo con el OK del usuario.**

### Paso 0 · Preparar
- Lee el template (§7) y los assets que usa (§8).
- Junta una foto real de cada persona: frontal, de día, con la cara nítida y grande. Las de Martín salen de su álbum de Google Photos, no del disco.
- Si la persona es de sonrisa fácil, usa una foto sonriendo.
- Pregunta el acento de cada persona que habla. No lo deduzcas de la zona horaria ni del idioma del navegador.
- Abre el contexto.md de la pieza.

### Paso 1 · El fondo solo, al 100 %
- Base: una referencia del lugar (la del template o la que elija el usuario). Nunca puro prompt.
- Una frase con el objeto y el lugar, sin adjetivos de ambiente. Ejemplo que funcionó: «Un tablero de corcho con fotos unidas por hilo rojo, en la pared de una habitación normal con luz de día.»
- Sin personas. Acá se itera libre: no hay nada que romper.
- Checklist de fondo (§5.2) y el del asset (§8).
- Win: se baja «1K · Tamaño original» y se guarda como el **fondo original**, con su contexto.

### Paso 2 · Cada avatar solo, al 100 %
- Base: la foto real de la persona. Receta aprobada: foto real de Martín → imagen de estudio en Flow con la foto pegada como referencia → edición para que sostenga una polaroid (con una foto de referencia).
- El avatar no sale de una imagen de referencia de look: el que se hizo así (`avatar-delante-v1.jpg`) Martín lo rechazó, «no me gusta el avatar».
- Una persona por imagen. Dos personas son dos avatares, cada uno en su propia cadena.
- Un cambio por edición, anclando lo que no cambia: «La persona queda igual, con la misma ropa…».
- **«Tal cual, pero X»: se edita la imagen que le gustó y se pide sólo X.** Si se regenera desde el original con otra descripción, el modelo inventa otro diseño (9/11: el CRM del celular pasado a modo claro). Frase que funcionó: «La pantalla del celular pasa a modo claro: el mismo diseño, las mismas columnas, tarjetas, fotos y etiquetas de colores, pero con fondo blanco y letras oscuras. Todo lo demás, él, su mano y el cuarto, queda exactamente igual.»
- **Un objeto con pantalla (celular, notebook):** se agrega en el avatar, como la polaroid, describiendo la pantalla por lo que se ve (colores, formas, tipo de app) y sin pedir textos: el modelo los escribe mal. Grabar la pantalla real no hace falta (9/11: el CRM inventado por Flow se reconoce como app).
- La pose se pide con una foto de referencia y una frase: «que haga la misma pose que la foto que adjunto».
- Checklist de avatar (§5.1) y el del template (por ejemplo, en «Mensaje para…», el avatar con iluminación y fondo blanco).
- Win: 1K original guardado como el **avatar original** de esa persona, con su contexto.

### Paso 3 · La combinación (UNA edición)
- Base = el fondo original. Referencia = el avatar original. Nada más. Martín: «toma la imagen del fondo sin nadie y le agregas el personaje. No al revés».
- Frase probada (9/11, perspectiva intacta): «Agrega a esta persona de pie al lado del corcho, mirando a cámara, con las manos vacías. El corcho, la pared y el cuarto quedan igual.»
- **Para que salga de la cintura para arriba, se pide «en primer plano, cerca de la cámara».** Sobre un fondo amplio, «de la cintura para arriba» solo no alcanza: Flow respeta la cámara de la base y la pone de cuerpo entero junto a la pared, con la cara chica (9/11, dos veces). Con «en primer plano» salió bien encuadrada, el corcho entero detrás y la pared recta: «Agrega a esta persona en primer plano, cerca de la cámara, a la derecha: se ve de la cintura para arriba, de frente, con las manos vacías. El corcho queda detrás, a su izquierda, entero. Su rostro, sus expresiones, su pelo y su ropa son idénticos a los del original. El corcho, la pared y el cuarto quedan igual.» (`C:/dev/reel-mentores/omni/clip2-imagen-A.jpg`).
- **Para que pueda señalar o mirar las fotos, va pegada al corcho, no en primer plano.** Martín (9/11): «estaría parado más cerca, casi al lado de las imágenes… poder señalarlo o jugar mirando las imágenes». El primer plano lo aleja de las fotos. Funcionó con el fondo de cámara cercana (el corcho original, no el alejado): «Agrega a esta persona de pie justo al lado del corcho, del lado derecho, pegada a las fotos como para poder señalarlas: se ve de la cintura para arriba, de frente a cámara, con las manos vacías. Su rostro, sus expresiones, su pelo y su ropa son idénticos a los del original. El corcho, la pared y el cuarto quedan igual.» Salió señalando las fotos, con la cabeza unas dos veces y media más grande que una foto del corcho (escala real) (`C:/dev/reel-mentores/omni/clip2-imagen-B.jpg`).
- Las imágenes no gastan créditos: si la cara no convence, se saca otra muestra desde los mismos dos originales y se elige la más fiel. Nunca se edita encima de lo generado.
- A un par de metros, la cara sale apenas más fina que en un selfie de cerca. Al mostrarla, se dice y se manda al lado del original.
- Toda frase que mete o mueve a una persona suma: «Su rostro, sus expresiones, su pelo y su ropa son exactamente iguales a los del original.»
- Antes de seguir: escala real, perspectiva del fondo y la cara al lado de la original.
- **Alejar el fondo le inventa piso y techo, y los ensucia.** `fondo-alejado.jpg` salió con el piso manchado y el techo descascarado; Martín: «me gusta que sea ese el estilo del fondo, pero no que esté tan sucio, feo el piso o el techo. Sutileza sí puede tener, pero no tanto». Se corrigió en el fondo original con una edición: «El piso de madera y el techo se ven limpios y cuidados, con apenas un poco de uso. El corcho, las fotos, la pared y la ventana quedan igual.» (`omni/fondo-limpio.jpg`).
- Si la toma pide otro encuadre (por ejemplo, de pie al lado del corcho), primero se ajusta el fondo solo y después entra la persona. Funcionó: «La misma pared y el mismo corcho, con la cámara un poco más lejos: el corcho se ve más chico, con más pared y piso alrededor.» (`omni/fondo-alejado.jpg`).
- Si sale mal, no se corrige encima. Se repite la combinación desde los dos originales, o se corrige la pieza que falló en su original (paso 1 o 2).
- Dos personas: todavía no está probado (§9).

### Paso 4 · Checklist de la imagen
- Checklist de combinación (§5.3), más el del template y los de los assets.
- Recorre la lista de correcciones de esa pieza: todo el feedback que el usuario ya dio, punto por punto.
- Mírala al lado de la referencia (hstack, §6.8).
- Si un punto falla, vuelve al original de la pieza que falla. No mandes nada «casi bien».

### Paso 5 · El OK del usuario
- Muéstrale la imagen. Si el chequeo no fue automático, muéstrala al lado de su referencia.
- Pregunta una sola cosa: si va así.
- Sin OK no hay video.

### Paso 6 · El video (acá se gastan los créditos)
- Omni 1.2 Flash en Flow, no por ApiMart, con la imagen aprobada (original 1K) como fotograma inicial.
- Prompt: el de la receta aprobada (§6.2): el acento, la frase entre comillas y lo que queda quieto.
- Revisa el panel antes de generar: 720p, 9:16, Fotogramas, x1, 5 s (15 créditos) u 8 s (24). Los defaults vienen mal.
- Si hay varios clips con imagen y frase listas, se lanzan en paralelo y después se chequean de a uno.
- Cada clip parte del avatar original, aunque cambien el movimiento o la posición: nunca del fotograma de otro clip ni de otra combinación (regla 2).
- El contexto.md se escribe al generar.

### Paso 7 · El chequeo del clip
- Checklist de clip (§5.4).
- Un inserto mudo se entrega sin pista de audio (`ffmpeg -i clip.mp4 -an -c:v copy mudo.mp4`).

### Paso 8 · La voz
- Voice-to-voice sobre el audio del propio clip (§6.3). Nunca un audio nuevo pegado encima.
- Checklist de voz (§5.5). Lo decide el usuario de oído, no un número.

### Paso 9 · La edición y el montaje
- Según el template: orden de tomas, insertos, subtítulos, música y cierre.
- Se monta sin recomprimir donde se pueda (`-c:v copy`).
- Template «Mensaje para…»: `reel-mentores/montaje/montar-v2.mjs` arma todo de una con la gramática MEDIDA del reel de
  Josep (§8.3) y se vuelve a correr cuando cambia una toma (30-70 s). Las duraciones van en cuadros enteros, y los tiempos
  del .ass se redondean SIEMPRE hacia abajo: redondeando al más cercano, el subtítulo quedaba un cuadro sobre el inserto.
  Antes de entregar, transcribir el reel entero con `chequear-guion.mjs` (un recorte puede comerse una palabra).
- **Regla de Martín (9/11): el montaje copia el RITMO de la referencia.** Se mide en la referencia y en lo nuestro: cuánto
  dura cada tramo hablado antes de cada corte, sílabas/palabras por segundo, huecos entre palabras y entre frases. No
  quedan silencios muertos: una animación se corta o se acelera (sólo la imagen). La voz se acelera con `atempo`, que
  conserva el tono (medido: 130,6 → 130,6 Hz); `asetrate` la sube 9,7 %: voz de ardilla.

### Paso 10 · La entrega
- Clip más su contexto.md. Lo que el usuario aprueba se guarda como win.

### Ante un feedback

| El feedback es sobre… | Vuelves a… | Y después… |
|---|---|---|
| El fondo | El fondo original, solo | Corriges ahí (dos o tres ediciones como mucho), checklist de fondo, guardas el nuevo original y repites la combinación: el nuevo fondo de base y el avatar original de referencia. |
| Un avatar | El original de ESE avatar | Corriges ahí, checklist de avatar y combinas de nuevo. |
| La combinación (se ve pegada, escala, perspectiva, posición) | Los dos originales | Repites la combinación desde los dos originales, con otra frase. La combinada no se edita. |
| El movimiento o la boca del video | La imagen aprobada | Cambias la frase del prompt (qué queda quieto) y generas de nuevo. Gasta créditos otra vez: dile al usuario cuántos antes de generar. |
| El acento | El prompt del video | El acento se pide en el origen y se regenera el video. ElevenLabs no lo arregla. |
| La voz («no es mi voz», grave, bajita) | LA-CONFIG.json | Verificas que se usó la configuración exacta. La voz no se procesa (ni tono, ni velocidad). |
| Algo que estaba bien y se degradó | La última versión limpia | Le vuelves a pasar la referencia de eso. No pidas «que se vea mejor». |
| Otra foto, o un cambio del avatar a mitad del reel | Se genera lo que pide | Pero antes se le advierte, mostrándole su avatar original, que si no se sigue con esa imagen es muy posible que haya diferencias sutiles entre clips: cada foto trae otra luz (cambia el color del pelo o las facciones), otra sonrisa y otra calidad, y la IA lo copia. |

---

## 5. Checklists de validación

Se recorren mirando la imagen, antes de mostrarla. Se suman el del template (§7) y el del asset (§8).

### 5.1 Avatar (cada persona, sola)
- [ ] Es la misma persona de la foto real. Mira los ojos de cerca: ninguno raro.
- [ ] Ojos abiertos y boca natural. Si sale de un fotograma, no es un parpadeo ni media palabra (elige mirando seis cuadros).
- [ ] Si va a hablar: una sola cara, de frente o en 3/4, que ocupa entre el 20 % y el 40 % del cuadro.
- [ ] No es de cuerpo entero si importa el parecido: a ese tamaño la cara son cuatro píxeles.
- [ ] Lo que sostiene (una foto, un producto) está nítido y sin deformar.
- [ ] La ropa, el pelo y la expresión son los aprobados.
- [ ] Si la persona es de sonrisa fácil, sonríe como en su foto.
- [ ] Sale del original de 1K: no de un reescalado ni de un cuadro recomprimido.
- [ ] Está en vertical (9:16 o 4:5).
- [ ] Cumple todas las correcciones que el usuario ya dio sobre este avatar.

### 5.2 Fondo
- [ ] No hay personas.
- [ ] Se ve simple y real: una habitación normal, con luz de día, nada «de película».
- [ ] Están los objetos pedidos y nada más. Cada objeto que se nombra, el modelo lo pone.
- [ ] La forma y la orientación del objeto son las pedidas (por ejemplo, el corcho horizontal, en la pared).
- [ ] Si lleva fotos o tarjetas: la cantidad pedida con número, todas del mismo tamaño, ninguna repetida.
- [ ] Las fotos conservan sus colores de fondo y no parecen stickers.
- [ ] Todo nítido y completo: nada pixelado, cortado o desfigurado.
- [ ] No se ve «de IA» (piel plástica, textura empastada). Es el síntoma de un reescalado.
- [ ] Piso y techo prolijos: un poco de uso, nada sucio ni descascarado (Martín: «sutileza sí puede tener, pero no tanto»).
- [ ] Deja lugar para la persona donde va a ir, sin tapar lo importante.
- [ ] Original de 1K.
- [ ] Cumple el checklist del asset y el feedback ya dado.

### 5.3 Combinación
- [ ] La persona es idéntica a su original: cara, expresión, ojos, pelo, ropa, pose y lo que sostiene. Se compara la cara con la original, lado a lado.
- [ ] El prompt dijo que el rostro, las expresiones, el pelo y la ropa son exactamente iguales a los del original.
- [ ] El fondo es idéntico a su original: no cambió, no se perdió, no se recortó.
- [ ] La perspectiva quedó intacta: la pared y el corcho no se desfasaron ni apuntan para otro lado.
- [ ] La referencia no se pegó entera: no reemplazó toda la imagen ni impuso su encuadre.
- [ ] El objeto del fondo conserva su forma (un corcho horizontal no se volvió vertical).
- [ ] La persona no trae pegada la escena de su foto (el fondo de estudio).
- [ ] La escala es real: una persona es más alta que un corcho de pared y una foto pinchada es más chica que una cara. Si no es real, no se manda.
- [ ] La persona no tapa lo que importa.
- [ ] La cara no quedó chica: de cuerpo entero y lejos, la escala es real pero el parecido se pierde.
- [ ] No se ve recortada: el fondo puede quedar un poco desenfocado, como en una foto de verdad.
- [ ] Vertical 9:16.
- [ ] **Continuidad con el clip anterior:** lo que tiene en la mano, lo que tiró, dónde está parado, la ropa, el encuadre y hacia dónde mira siguen como terminó el clip anterior. Martín (9/11): «si yo ya había tirado la tarjeta, la Polaroid, no debería tenerla otra vez. Y eso justamente se hace a raíz de la imagen… siempre tienes que tú estar presente para hacerte preguntas y tener criterio a ver si todo está bien.»
- [ ] Se hizo en UNA edición: el fondo original de base y el avatar original de referencia.
- [ ] Se miró al lado de la referencia del template.

### 5.4 Clip (después de generar)
- [ ] `ffprobe`: duración y tamaño esperados (720×1280).
- [ ] `volumedetect`, medido apenas baja: el nivel tiene sentido (un clip puede volver mudo, o ponerse a hablar solo).
- [ ] Tira de 5 fotogramas: la cara sigue siendo la misma de principio a fin.
- [ ] La boca dice la frase entera, sin pausas raras, y dice exactamente el guion.
- [ ] **Transcripto y comparado con el guion** (`node C:/dev/reel-mentores/voz/chequear-guion.mjs <clip.mp4> "<guion>"`): ni una palabra repetida, faltante o cambiada. La duración se eligió contando palabras.
- [ ] El cuerpo hace sólo lo pedido: lo quieto quedó quieto.
- [ ] El modelo no inventó texto ni subtítulos.
- [ ] El acento es el pedido (se escucha).
- [ ] Si es un inserto mudo, va sin pista de audio.

### 5.5 Voz
- [ ] Se usó LA-CONFIG.json tal cual: voz, modelo, ajustes y formato.
- [ ] El origen fue el audio del propio clip, a mp3 192k SIN filtros (ni loudnorm ni highpass antes).
- [ ] Nivelada a −14 LUFS.
- [ ] Duración de la voz contra el clip: decenas de milisegundos (el aprobado, CLIP-wavnivel: 5,000 s de video y 5,062 s de voz, 62 ms).
- [ ] No se le tocó el tono ni la velocidad.
- [ ] La escuchó el usuario y dijo que es su voz.

---

## 6. Herramientas y modelos

### 6.1 Qué se usa y qué JAMÁS

| Para | Se usa | Jamás |
|---|---|---|
| Imágenes | Flow con Nano Banana 2.1 (gratis). Por API: ApiMart `gemini-nano-banana-2.1-ext` (US$ 0,012). Es el mismo modelo, así que sale igual por los dos lados. | Puro prompt. Describir caras con palabras. `gemini-omni-1.2-flash-ext` para imagen (no pasa la revisión de contenido). Una imagen reescalada. |
| Video de una cara que habla | Omni 1.2 Flash en Flow: Fotogramas, 720p, 9:16, 5 u 8 s, x1. Por Flow, no por ApiMart (Martín: «¿por qué usaste ApiMart, si estamos usando Flow para no gastar?»). Lo que corre por API (la app) usa ApiMart: `gemini-omni-1.2-flash` (5 u 8 s) u `Omni-Flash-Ext` (10 s). | Cualquier modelo que no sea Omni. `wan2.5-preview` mueve la boca sin sincronizar. Veo 3.1 Lite (el default de Flow). Dos modelos «para elegir». |
| Voz sobre un clip | ElevenLabs voice-to-voice, `eleven_multilingual_sts_v2`, clon NORMAL «wav nivelado» `1crLVxcTqcz5I2mDmBlO`. | Un audio de texto a voz pegado encima (despega los labios). El clon profesional en voice-to-voice (Martín: «No es mi voz»). OpenVoice V2. Procesar la voz. |
| Voz desde texto, sin video | `eleven_v4` con el clon profesional `I2d6BR9P2dAopVw1khNv`. | `eleven_v3` (lo mexicaniza) y `eleven_multilingual_v2`. |
| Voz o avatar con otro modelo | Sólo con licencia comercial limpia (ver `docs/hallazgos-ai-avatar.md`). | XTTS-v2, F5-TTS y VoiceStudio: no son de uso comercial. Que Replicate o fal los hospeden no limpia la licencia. |

### 6.2 La receta aprobada: CLIP-wavnivel.mp4 (9/11/2026)

Martín: «salió impecable».

1. **Personaje.** Foto REAL de Martín (álbum de Google Photos) → imagen de estudio en Flow con la foto pegada como referencia → edición en Flow para que sostenga una polaroid (una foto de Ramiro de referencia). Archivo: `C:/Users/marti/Downloads/Young_man_talking_on_phone_9b0328bc.jpg`, bajado en 1K original.
2. **Video.** Va por **Flow**: Fotogramas · Omni 1.2 Flash · 720p · 9:16 · 5 u 8 s · x1 (15 o 24 créditos), con la imagen aprobada en su 1K original como fotograma inicial. El clip de la receta salió por ApiMart (`gemini-omni-1.2-flash`, imagen a video, 9:16, 720P, 5 s), que cobra: no se vuelve a usar para esto. Script de entonces, sólo como referencia: `C:/dev/reel-mentores/omni/omni-clip.mjs`. Uso: `node omni-clip.mjs <imagen.jpg> <salida.mp4> <5|8> "<frase en español>" ["<acción en inglés>"]`. El prompt va en inglés, con la frase en español entre comillas y «young man from Uruguay» para el acento:

   ```
   Vertical 9:16, one continuous handheld shot, no cuts. The young man looks straight at the camera and says, IN SPANISH, exactly this and nothing else: «<frase>» He speaks the sentence CONTINUOUSLY, at a steady unhurried pace, WITHOUT stopping or pausing in the middle, taking about 3.4 seconds from the first word to the last. Serious, direct tone, young man from Uruguay. He holds a small polaroid photo card near his chest and lifts it slightly toward the lens. Everything else stays exactly as in the image. No on-screen text, no subtitles.
   ```

   Para 8 s, «about 6 seconds».

   Martín: «¿por qué usaste ApiMart, si estamos usando Flow para no gastar?». El clip 1 del reel se rehízo en Flow con esta receta (Fotogramas · Omni 1.2 Flash · 720p · 9:16 · 5 s · x1 = 15 créditos, fotograma inicial `C:/dev/reel-mentores/omni/personaje-corcho.jpg`) y Martín lo aprobó el 9/11.
3. **Voz.** `bash C:/dev/reel-mentores/voz/poner-voz-wavnivel.sh <clip de Omni.mp4> <salida.mp4>`. El origen es el audio del propio clip pasado a mp3 192k SIN filtros → voice-to-voice → loudnorm → montaje con `-c:v copy`.

### 6.3 ElevenLabs: los ajustes exactos

La fuente única es `C:/dev/reel-mentores/voz/LA-CONFIG.json`. Se lee, no se retipea. Si aparece otra configuración en otro lado, gana ésta y la otra se borra.

```
POST https://api.elevenlabs.io/v1/speech-to-speech/1crLVxcTqcz5I2mDmBlO?output_format=mp3_44100_192
model_id        eleven_multilingual_sts_v2
voice_settings  { "stability": 0, "similarity_boost": 1, "style": 1, "use_speaker_boost": false }
origen          el audio del clip de Omni, a mp3 192k, sin filtros
después         loudnorm=I=-14:TP=-1:LRA=11
montaje         ffmpeg -i <clip> -i <voz> -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest
```

- **stability es 0, siempre.** También en voice-to-voice. Un 1 en el archivo hizo fallar la voz cuatro veces en una noche.
- **use_speaker_boost en false.** Con true sale «súper grave»: mueve unos 55 Hz.
- **output_format es obligatorio.** El default es 128 kbps y se escucha peor. PCM y WAV a 44,1 kHz piden plan Pro.
- **No existe un voice-to-voice v4.** Los únicos modelos son `eleven_multilingual_sts_v2` y `eleven_english_sts_v2`.
- **El acento lo pone el origen.** Si Omni habló en español de España, el clon lo arrastra.
- **El origen va SIN filtros.** El relevo viejo (§8 de `docs/relevo/reel-mentores-high-ticket.md`) y el CLIP2 del 9/11 lo nivelaban antes (`loudnorm=I=-19:TP=-3:LRA=11,highpass=f=70`). La receta aprobada no lo hace.
- **La voz aprobada no se procesa.** Ni speed, ni atempo, ni corrimiento de tono. Si no entra en el video, se ajusta el video (`setpts`) o se regenera con otra duración.
- **ElevenLabs entrega a −27 dB de media.** Por eso se nivela a −14 LUFS. Es ganancia: no toca el timbre.
- **El tono (Hz) sirve para descartar material, no para juzgar.** La voz se le manda al usuario para que escuche, sin un veredicto adelante.
- **Texto a voz:** `eleven_v4` ignora `<break time>` y `speed`. Si hacen falta pausas, se genera un pedazo por bloque. `clone_strength` sólo existe en v4 con clon profesional, va en cada pedido (no se guarda con `/settings/edit`) y 1,0 es el mejor valor (0,5 es el peor).
- **La clave** empieza con `sk_` y se ve una sola vez. La ID que muestra el panel no sirve como clave.
- **El JSON del pedido va por archivo o por script**, nunca inline en bash: la «ú» se rompe.
- **Un voice_id anotado se verifica** con `GET /v1/voices/{id}` antes de usarlo.
- Martín está en el plan Creator desde el 8/11/2026. No hay que recomendarle subir de plan.

### 6.4 Cómo se clona una voz

1. **Autorización primero.** El titular graba su autorización ANTES de clonar y se guarda con el material. En MaKo es un paso que bloquea el onboarding de voz, no un checkbox.
2. **Material en el registro del destino.** Para anuncios, tomas cortas de anuncios en un solo estilo, no lectura tranquila. Once minutos de charla dieron un clon peor que 97 segundos de anuncios. Las notas de voz de WhatsApp son la mejor fuente.
3. **Mide el tono de cada archivo** (autocorrelación entre 70 y 300 Hz). Saca los que están fuera de registro y los de otra persona. De ocho notas, sólo cuatro eran de Martín en registro.
4. **Nivela, no recodifiques.** Entre −23 y −18 dB RMS, pico en −3. El material se sube tal cual llega.
5. **Tope de 11 MB por archivo** en `/v1/voices/add`: corta en tramos de 90 s en FLAC (`-f segment -segment_time 90`) y súbelos como muestras separadas (hasta 25). No bajes la calidad.
6. **Clon profesional (PVC):** mínimo 30 minutos de audio. Idioma y acento se eligen al crearlo (el default es English y después no se cambia). La verificación la graba el dueño, no se automatiza y puede vencerse. El estado real es `fine_tuning.state` en `GET /v1/voices/<id>`, no lo que muestra la web. Tardó unos 25 minutos.
7. **Desde el navegador:** las muestras van en .mp3 de 192 kbps o más (un .m4a se rechaza). No dispares el evento de cambio a mano porque duplica las muestras: cuenta las filas «Remove audio sample».
8. **Prueba con un clip real** y que el dueño escuche. Hoy, en voice-to-voice, el clon normal «wav nivelado» le ganó al profesional.

### 6.5 Flow

- **Cuenta:** el proyecto del reel está en la cuenta de Google que en el Chrome de Claude es `/u/2/`. Con `/u/0` o `/u/1`, Flow dice que el proyecto no existe.
- **Panel de video:** Video · **Fotogramas** (no Ingredientes) · **Omni 1.2 Flash** (no Veo 3.1 Lite) · **720p** (no 360p) · **9:16** · **5 s** (15 créditos, el de la receta aprobada) u **8 s** (24) · **x1**. Los defaults vienen mal: revísalo siempre.
- **Imágenes:** el radio de Imagen es el primero. Al tocarlo, el modelo pasa solo a Nano Banana 2.1. Las imágenes no gastan créditos.
- **Descargas:** siempre «1K · Tamaño original». Nunca «2K/4K Reescalado». Los videos, en su original.
- **Referencias propias:** entran por el portapapeles. En PowerShell, `[System.Windows.Forms.Clipboard]::SetDataObject($img, $true)` (no `SetImage`; sin el `$true` se vacía) y después Ctrl+V en la caja. Avísale a Martín que se pisa su portapapeles.
- **Las referencias tienen que ser VERTICALES** (4:5 o 9:16). Una apaisada se sube como imagen nueva y abre SU editor: pierdes la imagen en la que estabas.
- **Pegar en el editor:** entra por URL (`/edit/<id>`) → clic real en la caja (en `rect.x + 25`, mide 20 px de alto) → Ctrl+V (nunca Ctrl+A antes) → clic real en la caja otra vez → escribe → verifica `location.pathname` y el texto → clic real en la flecha. Nunca `.focus()` por JS ni `submit.click()`.
- **La caja del editor dice «¿Qué quieres cambiar?».** Si dice «crear», estás en el proyecto, donde generar reinventa a la persona.
- **Escape no cierra un menú: sale del editor.** Cierra los menús con un clic en un lugar vacío.
- **La papelera está pegada a descargar.** Saca una captura antes de hacer clic. Lo borrado vuelve desde `/project/<id>/trash`.
- **Recargar la página borra el fotograma inicial** y puede resetear el panel.
- **En el selector todas las imágenes se llaman image.png.** Elige mirando la vista previa grande.
- **«Detectamos actividad inusual»** aparece después de unas 15 ediciones en una hora. No es la imagen ni el prompt. Espera unos minutos: reintentar enseguida vuelve a fallar.
- **«No se pudo completar la acción»** tiene botón de reintentar, y el reintento corre distinto.
- **Los créditos se miran en el momento** («La generación usará N créditos»). Un cartel viejo no es el estado actual.
- **Cada pegado deja una tarjeta «Imagen subida».** Bárrelas al terminar.
- **Si las capturas se cuelgan,** trabaja por el DOM. Limpia la caja antes de escribir: si no, mezcla los prompts.
- **La pestaña Avatars** captura cara y voz con un video selfie, sólo en inglés, y la tiene que grabar la persona. La pestaña Voices no clona.

### 6.6 ApiMart

- **Un POST arranca una tarea que se paga, aunque la entrada sea basura.** Una tarea con la URL de imagen rota costó US$ 1,40. Si la tarea FALLA, devuelve la cuota. Consultar el estado es gratis; probar parámetros con POST, no.
- **Acepta parámetros inventados y contesta 200.** La API no se descubre probando.
- **Sin task_id, no reintentes:** puede haberse cobrado. Si sigue corriendo después de unos 10 minutos, no relances: se cobra de nuevo. Guarda el task_id en `<salida>.task.txt`.
- **El task_id viene en `data.task_id` o en `data[0].task_id`.** Lee las dos formas.
- **El video necesita la imagen en una URL http(s) pública.** Se sube con `/v1/uploads/images` (lo que hace `omni-clip.mjs`). Un `data:` se rechaza en video.
- **Omni sólo acepta 16:9 o 9:16** y, si no se le pide, devuelve 16:9. La imagen ya tiene que ser 9:16. Si no lo es, se acolcha antes con el fondo desenfocado.
- **duration 6 no existe.**
- **Si la voz dura unos 4,3 s, alcanza el video de 5 s.** Pedir 10 paga el doble por nada.
- **`APIMART_API_KEY` es la clave de la plataforma:** con ese saldo generan video todos los clientes. Hay que recargarla antes de que se acabe (el 8/11 quedaban US$ 0,26).
- **El «precio oficial» de ApiMart es su precio × 1,25.** Los precios reales aparecen en `/v1/tasks/{id}` al terminar la tarea. Un precio no medido no se escribe como dato.

### 6.7 Costos medidos

| Qué | Dónde | Costo |
|---|---|---|
| Imagen | Flow (Nano Banana 2.1) | 0 créditos |
| Imagen | ApiMart `gemini-nano-banana-2.1-ext` | US$ 0,012 |
| Video 720p, 3 s, x1 | Flow (Omni 1.2 Flash) | 9 créditos |
| Video 720p, 5 s, x1 | Flow (Omni 1.2 Flash) | 15 créditos |
| Video 720p, 8 s, x1 | Flow (Omni 1.2 Flash) | 24 créditos |
| Video 720p, 8 s, x2 | Flow (Omni 1.2 Flash) | 48 créditos |
| Video 360p, 8 s, x1 | Flow | 8 créditos (no sirve: el precio engaña) |
| Video 720P, 5 s | ApiMart `gemini-omni-1.2-flash` | US$ 0,279 |
| Video 10 s | ApiMart `Omni-Flash-Ext` | US$ 0,40 |

La imagen cuesta unas 23 veces menos que el video: el encuadre se itera en la imagen y el video se paga una vez.

### 6.8 Chequeos con ffmpeg

```
# al lado de la referencia
ffmpeg -i ref.jpg -i toma.jpg -filter_complex "[0]scale=400:716[a];[1]scale=400:716[b];[a][b]hstack=inputs=2" lado.jpg
# un cuadro
ffmpeg -i clip.mp4 -vf "select='eq(n\,30)'" -frames:v 1 cuadro.jpg
# clip sin pista de audio
ffmpeg -i clip.mp4 -an -c:v copy mudo.mp4
```

- Para elegir un fotograma, saca seis con `-ss` a lo largo del clip y ponlos en una tira `tile=6x1`.
- En esta PC `drawtext` no corre y `-pattern_type glob` no existe: usa secuencias numeradas (`-i t_%02d.jpg`).

### 6.9 El contexto.md de cada clip

Va junto a cada `<clip>.mp4` como `<clip>.contexto.md`, y se escribe al generar:

1. **Imagen de partida:** archivo, medidas, herramienta, modelo, la cadena completa de prompts en orden (una edición por línea) y cada referencia con su ruta.
2. **Video:** herramienta, modelo, modo (Fotogramas o Ingredientes), resolución, formato, variantes, créditos y el prompt exacto entre comillas.
3. **Voz:** servicio, voice_id y de qué clon es, model_id, voice_settings completos, output_format, pre-proceso del origen y post-proceso.
4. **Lo medido:** duración del video, duración de la voz y el desfase entre ambas.
5. **Lo que falta decidir.**

### 6.10 Síntomas y su causa (lo que falló el 9/11)

| Ves esto | La causa | Qué haces |
|---|---|---|
| Caras repetidas, tarjetas copiadas del lote | Varias referencias y un párrafo largo | Una referencia y una frase |
| El objeto cambió de forma (el corcho horizontal se volvió vertical) | La referencia era un corcho vertical | La referencia va en vertical, pero con el objeto en su forma real y con aire alrededor (el cuarto con el corcho) |
| La imagen entera se reemplazó por la referencia | La referencia era «toda una imagen» (un corcho que llena el cuadro) | Una referencia con el objeto dentro de su escena |
| Todo «muy de IA», piel plástica | Se bajó en 2K reescalado y se volvió a subir | Volver al original de 1K |
| Las caricaturas se volvieron fotos de personas reales | Se pidió «más realista» | Nombrar la propiedad (nitidez, sombra, escala) y anclar «mantienen sus colores» |
| Un ojo deformado, la foto de la mano desfigurada | Nueve ediciones encadenadas | Volver a la versión limpia |
| El corcho desfasado, la pared apuntando para otro lado | La persona de base y el fondo de referencia | Al revés: el fondo de base y la persona de referencia («No al revés», Martín) |
| La persona llega con su fondo de estudio y se come el corcho | La persona de referencia con «la persona es este chico» | Decir dónde va y qué queda: «Agrega a esta persona de pie al lado del corcho… El corcho, la pared y el cuarto quedan igual.» |
| La persona chiquita delante de un corcho gigante con fotos enormes | No se miró la escala antes de mandar | Escala real (§5.3). Martín: «se ve muy feo» |
| «No me gusta el avatar» | El avatar salió de una imagen de referencia de look, no de la cadena foto real → estudio | Volver al avatar original (`personaje-bueno-original.jpg`) |
| «¿Por qué usaste ApiMart?» | El video se mandó por API | Flow |
| Unas 40 caras repetidas | «Llenándolo» | Dar el número: «estas doce caras, una sola vez cada una» |
| Relleno de luz o fondo plano de recorte | Negativos en el prompt | Pedir en positivo |
| Una luz en la cara cuando se quería contraluz | «Que la cara siga legible» | Una frase con el efecto: «a contraluz contra un fondo blanco» |
| El cuarto de la referencia se metió en la toma (se perdió el fondo blanco) | Una referencia con su escena (la polaroid en la mano, delante del corcho) | Recortar la referencia al objeto solo: la polaroid, el celular |
| «Gurú» en el prompt dio gurús de la India | La palabra | Darle las caricaturas reales: un abanico armado a mano con las de `public/asesores/grandes/` (`reel-mentores/blancas/abanico.py`) |
| «A contraluz» casi no cambia la imagen | Nano Banana no reilumina a la persona | La silueta la da el video (las tomas blancas de la noche salieron así) |
| Una «risa» o un «gruñido» en un hueco sin voz | El voice-to-voice pasó el soplido del efecto (humo) por la voz | En el montaje se calla la pista de voz entre la última palabra y la siguiente; la música sostiene. La transcripción lo marca como «[gruñido]» |
| «No se parece a mí» en una toma nueva (el perfil) | La base fue una toma ya generada (la blanca de la noche), no su personaje | Base = SIEMPRE `omni/personaje-bueno-original.jpg`. De a un cambio: 1) «Sin la foto en la mano y sobre un fondo blanco liso, con todo lo demás igual»; 2) la pose y la luz con una referencia que tenga su misma ropa (la de Josep le copió la camisa). Tres cuartos se parece más que perfil puro |
| La luz de las tomas blancas no queda como las otras («no tiene la iluminación que estábamos teniendo») | Se cambió pose y fondo sin pasar la luz | Una edición más: «Copiá SÓLO la luz y la exposición de la referencia; no cambies ni la persona ni la pose ni el encuadre», con una toma NUESTRA ya aprobada como referencia (el abanico). Con el cuadro de Josep, Flow reemplazó la imagen entera por la de él |
| «Detectamos actividad inusual» | Unas 15 ediciones en una hora | Esperar unos minutos |
| «No es mi voz» | Clon profesional en voice-to-voice | Clon «wav nivelado» |
| Voz «súper grave» | `use_speaker_boost` en true | false |
| «Suena como español en lugar de argentino» | Omni habló con otro acento | El acento en el prompt del video |
| Voz bajita | ElevenLabs entrega a −27 dB | loudnorm a −14 |
| Labios despegados | Un audio nuevo pegado encima | Voice-to-voice del audio del propio clip |
| «Qué barato» en Flow | 360p por default | 720p |

---

### 6.11 Tiempos medidos y la pregunta de después

Martín (9/11): «optimizar los tiempos. Sin perder el control y el chequeo de calidad… empezar a medirnos los tiempos… y que nos hagamos la pregunta luego de ya generado de ¿podríamos haberlo hecho de otra forma más rápido sin perder la calidad?» Para qué: que MaKo le avise al usuario cuánto suele tardar lo que está por generar, lo deje corriendo en segundo plano mientras sigue con lo suyo y le mande una notificación cuando esté listo.

**Las dos reglas:**
1. **Cada paso se mide:** inicio, fin, herramienta e intentos. La planilla del reel es `C:/dev/reel-mentores/tiempos.csv`; si no se anotó en el momento, las horas salen del transcript (el `timestamp` de cada acción).
2. **Al cerrar cada tanda se pregunta, paso por paso: ¿se podía más rápido sin perder calidad?** Lo que sale se vuelve regla acá.

**Medido el 9/11 (Flow, cuenta `/u/2/`):**

| Paso | Tiempo | Nota |
|---|---|---|
| Una imagen (edición en Flow, Nano Banana 2.1) | menos de 30 s; unos 40 s hasta tenerla bajada | 0 créditos |
| Una vuelta completa por imagen (pegar, escribir, mandar, bajar, revisar lado a lado) | 1 a 2 min | |
| Revisión con 2 agentes | 6 min | encontró lo que se me pasó |
| Video Omni 1.2 Flash 720p, 5 s | ≤ 3,5 min | 15 créditos |
| Video Omni 1.2 Flash 720p, 8 s | ≤ 2,5 min (lanzado en paralelo) | 24 créditos |
| Voz (ElevenLabs voice-to-voice + loudnorm + montaje) | 3 a 4 s por clip | |
| Bajar, tira de 5 cuadros y volumedetect de 2 clips | 1,5 min | |
| **La tanda entera** (notas en español + imágenes de los clips 1 y 2 + videos + voz) | **unos 36 min** | se podía en unos 20 |

**¿Se podía más rápido? (9/11)**
- **Texto en el fondo: 5 intentos, 9 min.** Se podía en 1: pedir de entrada la lista cerrada de palabras cortas, y símbolos («??») en las notas chicas o inclinadas.
- **Imagen del clip 2: 4 muestras, 6 min.** Se podía en 1: arrancar con la frase que ya había funcionado («señalando una de las fotos con la mano»).
- **Esperas fijas de 30 s por imagen.** Mejor esperar a que aparezca la versión nueva (por el DOM) y seguir: unos 10 s menos por imagen.
- **Revisión, 6 min.** La resta de píxeles contra la versión anterior (`blend=all_mode=difference`) muestra en segundos si una edición tocó algo más; los agentes quedan para los textos y la cara, con los recortes ya hechos.
- **Lo que ya estaba bien:** los dos videos se lanzaron en paralelo, y la voz va por script.

## 7. Templates

### 7.1 «Mensaje para…» (el template actual)

**El nombre.** El formato no tiene un nombre establecido. Es el de Josep Casas (@soyjosepcasas, cofundador de Naturitas, hoy en EuroPistachios, Lleida; crema de pistacho Tacho). Su frase de presentación es «Soy Josep y planto pistachos». No se le encontró un soundtrack famoso: en la web no aparece una canción asociada al formato, y la copia que tenemos no tiene pista de audio, así que no se pudo escuchar. Lo que lo identifica es la voz y la frase. Para confirmarlo, hay que mirar el crédito de audio del reel publicado.
Nombre recomendado: **«Mensaje para…»**, de su propia fórmula («Este es un mensaje para…»). Dice la mecánica (el cliente completa a quién le habla), nombra la estructura y no el insulto, y suena igual en España y en Argentina.
Otros posibles: «El Pique», «El Zasca» (en Argentina, «El Palito»), «Estilo Pistachero». Falta que Martín elija.

**El molde.** `pistachos-video.mp4` (Josep, crema Tacho): 720×1280, 30,8 s, 16 tomas. Ya está medido: no se vuelve a desarmar. Desarme toma por toma: https://claude.ai/artifact/3Q3B7ciG1eQLbhcZA4N6jd. La copia no tiene pista de audio: lo que dice está en los subtítulos quemados.

**La estructura.**

| # | Bloque | Tiempo | Qué pasa | En el reel de mentores |
|---|---|---|---|---|
| 1 | Disparo | 0 – 3 s | Nombra al destinatario y lo pincha. «Este es un mensaje para todos los ___ de pacotilla.» | «Este es un mensaje para todos los mentores high ticket.» |
| 2 | Credencial | 3,5 – 8,6 s | Nombre, años, manos en la materia prima: por qué le vas a creer. | «Me llamo Martín, tengo 25 años y me estudié a todos los gurús que conoces.» |
| 3 | El producto como consecuencia | 9,5 – 12,6 s | «Para ahora crear ___». Se deduce, no se presenta. El producto aparece recién a los 9,6 s. | «Por eso creé una app para que no tengas que gastarte miles de dólares en vendehumos.» |
| 4 | Beneficio del otro | 13 – 16,5 s | «Una fuente de ___ para todos aquellos que ___». | «Vas a poder crear y editar videos como el que estás viendo en minutos.» |
| 5 | Remate | 17 – 20,6 s | Vuelve al pinchazo de la apertura y cierra el círculo. | «Dejá de comentarle a los que te dan un triste PDF. Mejor comentá "App" y te regalo 1 semana de prueba.» |
| 6 | Cierre mudo | 20,6 – 30,8 s | Unos 10 s sin voz: insertos, dominio y dónde se compra. | El CTA: «COMENTÁ "APP"» y «1 SEMANA GRATIS». |

**Reglas extra del template.**

1. **Dos mundos que se alternan:** la escena real (el avatar delante del fondo) y el inserto sobre blanco quemado a contraluz. En la primera mitad nunca van dos tomas seguidas del mismo mundo. Los insertos son la mitad del reel.
2. **Insertos: el avatar propio, con iluminación y fondo blanco, a contraluz.** La cara queda en sombra, más oscura que el pelo. Se pide «que esté a contraluz contra un fondo blanco», sin pedir que la cara siga legible (eso le pone luz).
3. **Duración de los insertos:** flashes de 0,6 a 1,0 s en la primera mitad; de 1,4 a 3,1 s al final, cuando ya no hay voz.
4. **Poses de inserto:** dedo arriba, brazos cruzados, perfil con las manos (juntas, delante de la cara sin tocarla, codos abajo, palmas hacia adelante). La pose se pasa con una foto de referencia.
5. **El movimiento se pide por lo que queda quieto:** «Los brazos quedan cruzados todo el tiempo; sólo respira y mueve apenas la cabeza.» Inserto mudo: «La boca cerrada y quieta.»
6. **Palabras en pantalla:** una sola por inserto, roja, con serif, arriba. Sólo tres en toda la parte hablada, más dos carteles al final.
7. **Subtítulos de la parte hablada:** blancos, centrados, a media altura (no abajo), de 2 a 3 palabras por cartel.
8. **El mismo fondo durante todo el video.**
9. **La imagen de cada clip sale del avatar original y del fondo original, nunca del último fotograma del clip anterior.** La continuidad la dan los mismos originales. Martín: «siempre se debe partir desde el avatar original… si no, van a haber discordancias seguro en los avatares».
10. **El prompt de un clip hablado lleva el acento, la frase entre comillas y lo quieto.** El vigente es el de la receta aprobada (§6.2): en inglés, con la frase en español entre comillas y «young man from Uruguay». Antes también salió a la primera en Flow, en español: «Habla con acento argentino de Buenos Aires. El cuerpo queda quieto y habla a cámara diciendo: "…". Al principio abre la mano y deja caer la foto.»
11. **El guion del cliente es textual y no se toca.** Además, cambiar el copy despega los labios.
12. **La duración de cada clip sale del texto:** unas 3 palabras por segundo si habla quieto, 2,1 si hace una acción.

**Checklist del template.**
- [ ] El disparo nombra al destinatario en los primeros 3 s.
- [ ] La credencial va antes del producto, y el producto aparece cerca de un tercio adentro.
- [ ] El remate vuelve a la apertura.
- [ ] Cierre mudo de unos 10 s con el CTA y dónde comprar.
- [ ] Los mundos se alternan: nunca dos tomas seguidas iguales en la primera mitad.
- [ ] Insertos sobre blanco quemado, a contraluz, con la cara en sombra, y con el mismo avatar de la escena real.
- [ ] Insertos cortos al principio, largos al final.
- [ ] Como mucho tres palabras rojas en la parte hablada, una por inserto.
- [ ] Subtítulos blancos a media altura, de 2 a 3 palabras.
- [ ] El guion es el del cliente, textual.
- [ ] El mismo fondo en todo el video, y la imagen de cada clip sale de los mismos originales (avatar y fondo), no del último cuadro del anterior.
- [ ] Cada toma se miró al lado de la del molde de Josep.
- [ ] Unos 30 s en total, 720×1280.

### 7.2 Molde vacío para el próximo template

```
### «<Nombre>»
- Qué es y de dónde sale (el video viral, el link, quién lo hizo):
- Molde medido (archivo, medidas, duración, cantidad de tomas, link al desarme):
- Para quién es y dónde se publica:
- Estructura: | # | Bloque | Tiempo | Qué pasa | Ejemplo |
- Assets que usa (fondos, avatares, insertos, música, subtítulos, cartela):
- Reglas extra (luz, fondo del avatar, ritmo, palabras en pantalla, subtítulos, cierre):
- Prompts probados, textuales, con lo que salió:
- Checklist del template:
- Lo que falta decidir:
```

---

## 8. Assets

### 8.1 Fondo «corcho de investigación»

Un tablero de corcho con las caricaturas de los gurús unidas por hilo rojo, en la pared de una habitación normal con luz de día. Es el fondo de todo el reel de mentores.

- **Aprobado (win):** `C:/dev/reel-mentores/aprobado/corcho-v3-1k.jpg` (en Flow, la última versión de `/edit/05deab67-…`). Elegido por Martín: «Esa, está bien, vamos directamente con esa».
- **Cómo se hizo:** editando la v1, sin referencia: «Las mismas 32 fotos, en los mismos lugares y del mismo tamaño. Ahora están un poco torcidas, con algunas notas de papel… hilo rojo… como un tablero de investigación.»
- **Con el avatar delante:** `C:/dev/reel-mentores/omni/personaje-corcho.jpg` (el avatar «Martín con la polaroid» delante del corcho). Es el fotograma inicial del clip 1, que Martín aprobó en Flow el 9/11.
- **Para el clip 2** («que ya no tenga la foto, y que yo esté parado al lado del cuadro de corcho»): `omni/clip2-fondo-mas-persona.jpg` (el fondo de base y el avatar de referencia) dejó la perspectiva intacta, pero Martín marcó la escala («el pizarrón… exageradamente grande… y yo quede así de chiquito»). Después: el fondo alejado (`omni/fondo-alejado.jpg`) de base, el avatar original de referencia y «en primer plano, cerca de la cámara» → `omni/clip2-imagen-A.jpg`. Martín: le gustó más, pero pidió estar casi al lado de las fotos y el piso y el techo menos sucios. Ahora: el corcho original con piso y techo prolijos (`omni/fondo-limpio.jpg`) y la persona pegada a las fotos, señalándolas → `omni/clip2-imagen-B.jpg` (falta su OK).
- **Rechazado:** `C:/dev/reel-mentores/aprobado/avatar-delante-v1.jpg`, a pesar de la carpeta. Su avatar salió de la imagen de referencia de look y Martín dijo «no me gusta el avatar».

**Reglas.**
1. **Horizontal, en la pared,** en el mismo cuarto donde se producen los clips. Nunca vertical.
2. **Ninguna cara se repite.** Se da el número y la unicidad en positivo: «En el corcho van estas doce caras, una sola vez cada una.» Nunca «llenándolo» ni «muchas».
3. **Las caras salen de las caricaturas del repo** (`public/asesores/grandes/*.png`, 32 aprobadas de 600×600), compuestas con PIL en la referencia (`tablero-lotes.py`). No se le piden al modelo: inventa caras genéricas.
4. **Todas del mismo tamaño y con el mismo marco.**
5. **Conservan su color de fondo.** Nunca «fondo claro, como una foto de carnet». Para que no se vean pegadas: «El corcho de atrás queda un poco desenfocado, como en una foto de verdad. Las fotos mantienen sus colores.»
6. **«Más realista» no es una instrucción.** Convirtió las caricaturas en fotos de personas reales. Se nombra la propiedad que separa el elemento del resto y se ancla lo aprobado.
7. **Sofía Contreras, Alex Hormozi y Francisco Doglio van en la mitad IZQUIERDA,** porque la persona tapa la derecha: «Las caras de la primera referencia van en la mitad izquierda».
8. **El material tiene que alcanzar para los huecos.** Si hay más huecos que caras, el modelo repite. El corcho tiene unos 50 huecos y hay 32 caricaturas.
9. **La referencia de look trae su propia densidad.** Si tiene más huecos que caras, repite. No se usa el corcho vertical (a3) como referencia.
10. **Si quedan amontonadas:** «Las mismas caras, repartidas por todo el corcho.», sin volver a adjuntar la referencia.
11. **Lo que sobra se saca en positivo:** «En el corcho sólo hay fotos de caras de personas.»
12. **Las comillas no arreglan la ortografía de Nano Banana** en las notas. La v3 elegida tiene las notas en inglés.

**Checklist del corcho.**
- [ ] Lleno de fotos chicas.
- [ ] Son las caricaturas de los gurús.
- [ ] Todas del mismo tamaño.
- [ ] Ninguna se repite.
- [ ] No parecen stickers.
- [ ] Conservan su color de fondo.
- [ ] Nítidas y completas.
- [ ] La escena es simple y real.
- [ ] El corcho es horizontal y está en la pared.
- [ ] Se ven los gurús que importan, en la mitad izquierda.
- [ ] Con la persona delante: su cara (mira los ojos de cerca) y lo que sostiene, nítidos.

### 8.2 Avatar «Martín con la polaroid»

- **Aprobado (win):** `C:/Users/marti/Downloads/Young_man_talking_on_phone_9b0328bc.jpg` (1K original, 768×1376; copia en `C:/dev/reel-mentores/omni/personaje-bueno-original.jpg`) y, delante del corcho, `omni/personaje-corcho.jpg`. De ahí salió CLIP-wavnivel.mp4: «salió impecable».
- **Cómo se hizo:** foto real del álbum de Google Photos → imagen de estudio en Flow con la foto pegada como referencia → edición para que sostenga una polaroid (con la foto de Ramiro de referencia).
- **Reglas:** la cara sale siempre de la foto real, nunca de una descripción ni de una imagen de referencia de look (el avatar hecho así, `avatar-delante-v1.jpg`, quedó rechazado). Girarlo de perfil a frontal no es una edición menor: el modelo reconstruye la cara y el parecido se va.

### 8.3 Edición (subtítulos y audio)

Los parámetros completos y sus trampas están en `docs/edicion-video-automatica.md`. Lo central:
- Música medida y llevada a −33 LUFS, con fade in de 0,8 s y fade out de 2,5 s. Nunca un «−20 dB» a ojo.
- **Template «Mensaje para…» (medido en el reel de Josep, 9/11): la música NO va bajo la voz.** Josep la apaga del todo
  mientras habla (piso de −49,7 dBFS). La música entra SÓLO como golpe en cada inserto blanco: el mismo pedazo de la
  canción, desde el «1» de una frase (808 + hats), con el corte de imagen en el golpe o un cuadro antes, cortado en seco
  al volver la voz; la palabra roja aparece en el cuadro del corte. Inserto corto = 1,3 beats (0,6 s, 15 cuadros a 24 fps);
  el largo, 2,1 beats (1,0 s). El cierre mudo arranca con la canción en su 0:00 y sigue continua; ahí los cortes siguen la
  acción. La música suena ~4,5 LU por encima de la voz. Detalle: `docs/hallazgos-video-editor.md` → «Cortar al ritmo de
  una referencia».
- **Cuántos golpes y dónde (Martín, 9/11: «pusiste demasiadas partes de música»):** los MISMOS que la referencia. Josep pone
  5 en lo hablado, uno al CERRAR cada bloque del guion (disparo, nombre, credencial, producto, beneficio), ninguno adentro
  de un bloque ni en el remate. El v3 tenía 8 (partía bloques y le ponía golpe al humo) y se sentía recargado.
- **Efectos, de a uno (Martín, 9/11: «no seas exagerado»):** el v4 sumó zoom «punch-in» + whoosh en la transformación,
  whoosh de vuelta y dos efectos en el humo; quedó sólo el del humo al desvanecerse (ElevenLabs Sound Effects,
  `reel-mentores/voz/efecto.mjs`). Un efecto que suene a soplido pegado a la voz se lee como un suspiro del personaje.
- El v1 del 9/11 ponía la música bajo la voz con `sidechaincompress`: es la gramática de un anuncio, no la de este template.
- Se entrega siempre también una versión SIN música, para ponerle el audio desde Instagram (la canción de Josep es «WE ON GO»,
  de BIA; no se verificó que esté en la biblioteca de Instagram de una cuenta de empresa).
- Si no hay música elegida: UNA pista de ElevenLabs Music (`reel-mentores/voz/musica.mjs`, `music_v1`, instrumental;
  48 s tardaron 7 s). El archivo arranca con ~2 s de silencio: se entra en el segundo 2.
- Mezcla con `amix=inputs=2:normalize=0`, y loudnorm de dos pasadas sobre la mezcla (I=-14:TP=-1:LRA=11, linear) forzando `-ar 48000`.
- Fuente de los subtítulos: Anton o Montserrat ExtraBold. libass no falla si falta la fuente: cae a Arial en silencio.
- Se recortan los «eh» y espasmos del modelo: es la diferencia entre «un video con IA» y un anuncio.
- Los subtítulos del template mandan sobre los del pipeline de anuncios (en «Mensaje para…», blancos y a media altura).

### 8.4 Molde vacío para un asset

```
### «<Nombre>» (fondo | avatar | inserto | edición | música | subtítulos | cartela)
- Qué es y en qué templates se usa:
- Versión aprobada (win): ruta del original 1K, link de Flow y contexto.md:
- Cómo se hizo: la base, la UNA referencia y la frase exacta:
- Parámetros (medidas, formato, cantidad, tamaños, colores, posición):
- Reglas (lo aprendido, con su porqué):
- Lo que falló y por qué:
- Checklist del asset:
```

---

## 9. Lo que todavía no está resuelto

1. **Documentos con la voz vieja.** `docs/video-avatar-desde-foto.md` (§ «En voice-to-voice va el clon PROFESIONAL»), `docs/relevo/reel-mentores-high-ticket.md` (§00) y la memoria `voz-elevenlabs-sts.md` dicen el clon profesional; el §8 del relevo filtra el origen antes del voice-to-voice. Este manual sigue a `LA-CONFIG.json` y a `poner-voz-wavnivel.sh`: el clon normal «wav nivelado», con el origen sin filtros. Hay que corregirlos. El «119 Hz» de `_medido_9_11` en LA-CONFIG puede ser una medición del profesional, y sus 38 ms son del CLIP2, no del clip aprobado.
2. **Documentos con el orden viejo de la combinación.** `docs/video-avatar-desde-foto.md` («EL ORDEN DE LA COMPOSICIÓN: la PERSONA va de base») y el §0 y «Lo que sigue» del relevo dicen la persona de base. Martín lo dio vuelta el 9/11: el fondo de base. Hay que corregirlos. El primer plano con el fondo de base ya se midió (9/11, `omni/clip2-imagen-A.jpg`, paso 3); el clip 1 aprobado (`personaje-corcho.jpg`) se había hecho con la persona de base.
3. **Quién pone el acento en voice-to-voice.** LA-CONFIG dice «el ORIGEN» en `_ojo_3` y «el CLON» en `_ojo_5`. Este manual sigue al origen, que es lo que se vio el 9/11. Falta medirlo con los dos clones sobre el mismo origen.
4. **Cómo se pide el acento.** La receta aprobada dice «young man from Uruguay»; los clips de Flow de antes decían «Habla con acento argentino de Buenos Aires». Los de `C:/dev/reel-mentores/clips-final/` (CLIP1 y CLIP2-CON-TU-VOZ) quedaron rechazados por el avatar y la voz profesional, no por el acento. Falta que Martín diga cuál es su acento por defecto.
5. **Negativos en el prompt de video.** El prompt aprobado dice «no cuts» y «No on-screen text, no subtitles», contra la regla 13. Funcionó así y no se probó sin ellos.
6. **Dos personas.** Falta probar cómo entran dos avatares en el fondo respetando «una sola referencia» por edición: uno por edición son dos ediciones encadenadas. Y con dos caras en cuadro, elegir la más grande para mover la boca no sirve: se elige por posición o se genera el clip con una sola persona.
7. **Lo más barato contra sólo Omni.** AGENTS.md dice probar el método con el modelo más barato (Hailuo, US$ 0,15). Para una cara que habla, este manual dice sólo Omni, en su opción más barata (5 s).
8. **El vertical en Omni:** acolchar a 9:16 antes (`docs/video-avatar-desde-foto.md`) o recortar al centro después (`docs/edicion-video-automatica.md`). Este manual dice antes.
9. **Dónde se consulta el estado en ApiMart.** Los documentos dicen `GET /v1/tasks/<id>`; `omni-clip.mjs` consulta `/v1/videos/generations/<id>` y funcionó.
10. **`clone_strength` en voice-to-voice.** La guía de edición dice que el voice-to-voice lo acepta; LA-CONFIG no lo usa.
11. **El tono en voice-to-voice.** Una nota dice que hereda el tono del origen y otra que lo reconstruye desde el clon.
12. **La memoria `metodologia-avatar-hype.md`** dice `kling-v3-omni` para video y coqui-tts local para la voz. Está desactualizada.
13. **Imágenes en 2K.** El curso AvatarHype dice generarlas en 2K «porque cuesta lo mismo». No está medido si generar en 2K es distinto de bajar el reescalado. Mientras tanto, 1K original.
14. **Ediciones encadenadas.** `docs/video-avatar-desde-foto.md` dice volver a pasar la referencia cada 3 o 4; este manual toma el techo de 2 o 3 del relevo y de AGENTS.md.
15. **El template.** Falta que Martín elija el nombre, y confirmar el audio del reel publicado (la copia no tiene pista). La «1 semana gratis» del cierre choca con que la prueba gratis está apagada desde el 30/10. Falta saber si la polaroid tiene que mostrar la misma caricatura del clip 1 (perdió la gorra).
16. **El reel de mentores.** El clip 1 está aprobado (Flow, `C:/dev/reel-mentores/omni/CLIP1-CON-TU-VOZ.mp4`). Falta el OK de la imagen del clip 2 (`omni/clip2-imagen-B.jpg`: el fondo limpio de base, el avatar de referencia, pegado a las fotos) y, después, su video; los clips 3, 4 y 5 (cada uno con su imagen primero), el cierre mudo de 10 s y el montaje. Estado en `docs/relevo/reel-mentores-high-ticket.md`.
17. **El corcho.** Hay 32 caricaturas para unos 50 huecos: o se baja a 32 fotos o se generan más caricaturas (`lib/asesores/`). Martín pidió las notas en español y eligió la v3, que las tiene en inglés.
18. **En el producto.** El checklist automático todavía no existe (YuNet sobre la imagen antes de pagar, la comparación al lado). Hoy lo recorren Claude o MaKo a mano. AI Avatar no se probó con un look real (la prueba es de Martín, en el ws3). Del catálogo de avatares falta el experimento de un personaje base contra uno por arquetipo.
19. **La edición automática.** Falta decidir dónde corre ffmpeg (Vercel no lo trae), la fuente de los subtítulos y la música (la de Pixabay no sirve para el SaaS). −14 LUFS es un default, no un requisito de las plataformas.
