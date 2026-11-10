# Pendientes del Video Editor

**Al 9/11/2026.** En esta lista se juntan los pendientes que salieron de los documentos y el código, los de los mensajes de Martín y la memoria, y la revisión de la rama de la edición automática. Lo que dice cada **Estado real** está comprobado en el código con `git grep`, `ls-tree`, `show` y `merge-tree`, sin escribir nada, sobre estas tres versiones:

- `origin/main` @ `406dfd8fc`
- `origin/punta/edicion-reel-0911` @ `7c3dfbb1a`
- la etiqueta `rescate/motion-imagen-2610` @ `c45142425`

Las prioridades se leen así:

- **P1**: hace falta para que Martín empiece a USAR el editor pronto.
- **P2**: lo pidió y suma mucho, pero no frena el uso.
- **P3**: después.

---

## En un minuto

- **Duplicar Submagic va bastante avanzado, pero nadie lo vio andar.** En main están las palabras clave automáticas, los presets por marca, el karaoke, la palabra resaltada, 16 plantillas, el B-roll de fotos y los clips mágicos. Falta lo que más se nota de Submagic: que la palabra salte o crezca, los emojis de IA y el B-roll en video.
- **La «Edición automática» del reel (10 agentes) está terminada y en verde, pero no entró a main.** Se mezcla con el main de hoy sin conflictos. GitHub la frenó sólo porque el último commit salió firmado por `noreply@anthropic.com`. Antes de subirla hay que arreglar un bug: cualquier video sin muletillas termina marcado como falla.
- **Motion graphics no está en main.** Vive en la etiqueta `rescate/motion-imagen-2610`, que sí está en GitHub. Probé la mezcla con main sin tocar nada y salen 97 archivos en conflicto. Lo suspendió Martín el 26/10, y hoy lo volvió a pedir.
- **Nada del editor se vio funcionar en un navegador, ni siquiera exportar un MP4 en producción.** Esto se prueba en la PC de Martín, porque la nube no corre el editor (necesita WebGPU y WASM).
- **Exportar no es sólo descargar**, al revés de lo que decían los dos relevamientos. Desde el 29/10 está «Publicar», que lleva el video al Calendario, y desde el 6/11 «Usar en un anuncio». Falta «Mandar al grupo de MaKo».

## Por dónde empezar

| # | Qué | Por qué | Dónde |
|---|---|---|---|
| 1 | Probar en Chrome lo básico: importar, cortar, subtitular, exportar MP4 y «Publicar» | Nunca se exportó en producción; sin esto no se puede usar | PC (negocio de MaKo, ws9, o Cliente de Prueba, ws3; nunca el de Mauricio, ws1) |
| 2 | Arreglar el bug de las muletillas y subir la «Edición automática» (volver a firmar `7c3dfbb1a`) | Es lo que Martín pidió el 9/11 y ya está hecho | Nube (el arreglo) + Cerebro (subirla) |
| 3 | Subtítulos: palabra que salta o crece «tipo Hormozi» y emojis de IA | Son lo que más se ve de Submagic, y era el compromiso con Leila para hoy | Nube |
| 4 | Primera prueba real: montar el reel de mentores en el editor | Usarlo de verdad; lo que no deje hacer va a `docs/feedback-usando-mako.md` | PC |
| 5 | Decirle a Leila que reimporte «ESP_Fabi sentada_limpio.mp4» (ticket #15) | Es una clienta trabada | Cerebro |
| 6 | Retomar Motion graphics trayéndolo por partes sobre main | Martín lo volvió a pedir hoy | Nube, en paralelo |

---

## 1. Subtítulos estilo Submagic

### 1.1 Lo que ya está: verlo andar en Chrome — P1 · hecho, sin ver
- **Qué es:** palabras clave automáticas, presets de subtítulos por marca o cliente guardados en el negocio («De tu marca»), karaoke, palabra resaltada «tipo Hormozi» y 16 plantillas.
- **Martín:**
  - 26/10: «También vamos a armar un VidIQ y un submagic dentro de maximo 2 semanas».
  - A Leila, en la llamada del 26/10: «dentro de dos semanas que voy a implementar Submagic y VidaIQ al 100%, te va a ahorrar 147 dólares».
  - 27/10: «No quiero implementar aun VidIQ y Submagic».
  - 9/11: «duplicar Submagic para el tema de los subtítulos».
- **Leila (30/10):** pidió el resaltado, presets por marca (ella, Nadia y Fabiola), subtítulos «bonitos» estilo Submagic, dos o tres tendencias de letra y kits de marca. Martín lo resumió así: «implementar Submagic, implementar B-roll».
- **Ejemplos:** Martín no mandó ningún link de Submagic. El único que hay lo encontró un agente: https://www.submagic.co/blog/how-to-make-alex-hormozi-captions
- **Estado real:** en main existe `app/video-editor/_opencut/subtitles/claves.ts`.
  - `assets-view.tsx:14` dice que resaltar palabras clave «anda desde el 6/11/2026».
  - Los presets están en `subtitles/presets.ts`, con su ruta `app/api/video-editor/presets`.
  - `estilos.ts` trae 16 plantillas, y `estilos.ts:27` es el estilo «tipo Hormozi».
  - La rama de la edición automática suma 3 plantillas más («Lima» :217, «Recuadro Bebas» :229 y «Marcador» :241), o sea 19.
  - VidIQ no va en el editor: quedó en Competitor Spy.
- **Fuente:** `origin/main:docs/hallazgos-video-editor.md:2141-2184`; `docs/relevo/nube-video-clips.md`; `docs/relevo/pendientes-pc/pendientes-30-10.md:39,67`; `memory/leila-apps-y-pro-97.md:17-22`.

### ~~1.2 Que la palabra clave salte o crezca («pop» tipo Hormozi) — P1 · no está~~ — hecho el 10/11/2026 (`punta/subtitulos-submagic-0911`)
- **Hecho:** «Animación de la palabra» (`subtitulo.animPalabra`: «Salta» y «Crece», con o sin karaoke, por una tabla que no redibuja en cada cuadro: `text/resaltado.ts` → `formaDeAnim`) y «Tamaño de las palabras clave» (100 a 160 %). Dos plantillas nuevas, «Hormozi» y «Hormozi clásico», copiadas del blog de Submagic (`docs/editor-video/relevo-submagic.md`). Por chat `animar_palabras` y `palabras_clave` con `tamano`; por la API `animar_palabras_video` y los presets con `animacion_palabra` y `tamano_claves`. Tests: `tests/video-editor-subtitulos-submagic.test.ts`. Falta verlo en Chrome (§13).
- **Qué es:** la palabra resaltada se agranda o rebota cuando se dice.
- **Estado real (6/11):** en `subtitles/` no hay rebote ni tamaño por palabra. El único «rebote» del editor es la animación de entrada de un texto entero (`text/estilos-predefinidos.ts:176,224`). Para hacerlo hay que medir el renglón con dos tamaños en `text/dibujar.ts`.
- **Fuente:** `origin/main:docs/hallazgos-video-editor.md:2176`.

### ~~1.3 Emojis de IA — P1 · apagado~~ — hecho el 10/11/2026 (`punta/subtitulos-submagic-0911`)
- **Hecho:** «Emojis automáticos» (`subtitles/emojis.ts`, sin IA y gratis, como las palabras clave): un emoji animado («Rebote») encima de cada subtítulo que dice algo que se puede dibujar, en su pista «Emojis», nunca dos iguales seguidos y separados 2,5 s. Se prenden al generar (el interruptor ya no está en «Próximamente») o en la sección «Emojis» de la pestaña Subtítulos; apagarlos saca sólo los suyos. Por chat `emojis_subtitulos`, por la API `poner_emojis_subtitulos`. El nombre cambió a «Emojis automáticos» porque no los elige una IA: lo dice el relevo de Submagic.
- **Estado real (6/11):** está a la vista pero apagado, con el cartel «Próximamente»: `assets-view.tsx:248`, `<FilaInterruptor rotulo="Emojis de IA" activo={false} desactivado />`. El «Próximamente» de `:120` es el cartel de ese mismo interruptor, no otra función.

### ~~1.4 Relevar Submagic mirando la app — P1 · no se hizo~~ — hecho a medias el 10/11/2026
- **Hecho:** `docs/editor-video/relevo-submagic.md`, leyendo el sitio, el blog y la documentación de Submagic (la app pide cuenta y no se abrió desde la nube). Ahí están qué se copió con datos (los dos estilos de Hormozi), qué Submagic no publica (los números de sus animaciones, cuántos emojis pone) y qué falta mirar en la app con cuenta.
- **Qué es:** abrir Submagic y anotar sus estilos con nombre, los emojis, los sonidos y el acercamiento automático antes de seguir copiando. Lo pide la regla de copiar la app tal cual.
- **Estado real:** en el repo no hay ningún relevamiento hecho mirando la app; la única referencia es el post del blog.

### ~~1.5 Marcar o desmarcar a mano UNA palabra clave — P2 · no está~~ — hecho el 10/11/2026 (`punta/subtitulos-submagic-0911`)
- **Hecho:** en la sección «Palabras clave» del subtítulo elegido, cada palabra es un botón que la marca o la desmarca (`claves.ts` → `alternarClave`), en un paso de deshacer. Por chat, `palabras_clave` con «sumar» y «quitar».
- **Fuente:** `origin/main:docs/hallazgos-video-editor.md:2176`. No lo confirmé en el código.

### 1.6 Subtítulo escalonado («Stagger Stack» del reel) — P3 · no está
- **10/11/2026, sin hacer:** no hay en el repo una descripción de cómo se ve el «Stagger Stack» y la nube no puede mirar el reel cuadro por cuadro con criterio; copiarlo de memoria es diseñarlo de cero. Para hacerlo: mirar `origin/referencias/reels-0911:edicion-mako.mp4` en el momento del subtítulo escalonado y anotar cómo entra cada renglón.
- **Estado real:** buscar «stagger» o «escalonad» en las dos ramas no da nada. Pide medir y dibujar renglón por renglón en `text/dibujar.ts`.

### 1.7 Subtítulos bilingües — P3 · apagado
- **Estado real:** «Próximamente» en `assets-view.tsx:226-239`. El comentario de `:13` lo deja fuera de alcance de la v1.

### 1.8 Letras automáticas y kit de marca desde el brand board — P3 · no está
- El kit depende del brand board del Second Brain, que salió en `punta/image-marca` el 5/11.
- **Fuente:** `origin/main:docs/relevo/pendientes-pc/pendientes-30-10.md:67`.

**Reglas de subtítulos que Martín ya dio:**
- «Las letras tienen que ser EXACTAMENTE IGUAL a lo que dice el audio» (22/07).
- «cuando hay algo al costado SIEMPRE tienes que acomodar los subtitulos» (24/07).
- «Los subtitulos que generaste se superponen todos. Y se ponen en diferentes lugares cada vez, eso está mal» (24/08).

**Dato:** el modelo de transcripción por defecto es `whisper-small` (`transcription/models.ts:33`), que baja unos 300 MB la primera vez.

---

## 2. Edición automática (el reel de Higgsfield)

### 2.1 Subir la «Edición automática» a main — P1 · hecha, no está en main
- **Qué es:** diez agentes trabajan uno detrás de otro sobre el video:
  1. cortar las pausas;
  2. poner los subtítulos;
  3. probar tres estilos (A/B);
  4. sacar las muletillas;
  5. resaltar las palabras clave en lima;
  6. proponer B-roll;
  7. proponer cambios de plano;
  8. limpiar la voz;
  9. dejar el volumen en −14 LUFS;
  10. revisión final.

  Se ven trabajando: panel con el registro, cursores con nombre y la pastilla «en vivo». Hay «Deshacer todo». Por chat es `edicion_automatica` y por la API `editar_video_automatico`, que sólo propone.
- **Martín, 9/11:** «PARA LA EDICIÓN EN MAKO, ESTO QUIERO: https://www.instagram.com/reel/DffGz6yu565/?cplk=cW9qbGsxOG1jMnYw». Y: «delega a 2 chats de la nube aparte para que implementen esto».
- **Ejemplos:** https://www.instagram.com/reel/DffGz6yu565/?cplk=cW9qbGsxOG1jMnYw, bajado como `origin/referencias/reels-0911:edicion-mako.mp4`.
- **Estado real:**
  - Está en `origin/punta/edicion-reel-0911` @ `7c3dfbb1a`, con 5 commits fuera de main. El código vive en `app/video-editor/_opencut/enjambre/` (cursores, en vivo, plan, correr y registro).
  - El relevo con el VERDE está 2 commits más arriba, en `origin/claude/exciting-mccarthy-9rqrau` @ `9a4c7c1d1`.
  - Main avanzó 57 commits desde entonces, y aun así `git merge-tree` con el main de hoy sale **sin conflictos**.
  - La frenó `punta.yml:102-131`, que sólo mira al autor del **último** commit y rechaza `noreply@anthropic.com`.
  - `origin/ci-rojo/edicion-reel-0911` (mismo sha, corrida 42621502295) es la marca de ese freno por el autor, no un test en rojo.
  - **Para subirla:** volver a firmar sólo `7c3dfbb1a` con el correo del equipo (el árbol no cambia, así que el `Veredicto:` sigue valiendo), y después el relevo como una punta sólo de documentación.
- **Fuente:** `origin/claude/exciting-mccarthy-9rqrau:docs/relevo/edicion-reel-nube.md:60-130`; `origin/main:.github/workflows/punta.yml:98-134`.

### 2.2 Bugs que encontró la revisión (arreglar antes o junto con la subida)
- ~~**P1 · Un video sin muletillas termina como «falla».**~~ — arreglado el 10/11/2026 en `punta/edicion-arreglos-0911` @ `101042780`: `NO_HAY_MULETILLAS` es una constante (`transcripcion/modelo.ts`) que usan `linea.ts` y `esNadaQueHacer`, con el texto real en el test 15. Comprobado en el código:
  - `enjambre/plan.ts:245-247` (`esNadaQueHacer`) reconoce «no se cortó las muletillas».
  - Pero `chat/linea.ts:1720` devuelve «no se identificaron muletillas».
  - Resultado: el resumen dice «1 no pudo» y ofrece «Reportar a Soporte» en cualquier video grabado con guion.
  - Arreglo: sumar `/^no se identificaron muletillas/` y probarlo con el texto real.
- ~~**P1 · −14 LUFS por pedazo.**~~ — arreglado el 10/11/2026 (`101042780`): `normalizarJuntos` (`audio/normalizar.ts`) mide los pedazos de una misma toma JUNTOS y les pone la misma ganancia; un pedazo casi mudo usa la de su toma (`medidaDePedazos`). Falta OÍRLO en la PC (§13). El agente del volumen normaliza cada clip por separado, y después de cortar las pausas cada pedazo queda con su propio nivel. Hay que oírlo antes de usarlo con clientes.
- ~~**P2 · «Detener»** durante los subtítulos cuenta como falla.~~ — arreglado el 10/11/2026 (`101042780`, `comoTerminaFalla`).
- ~~**P2 · Si los subtítulos fallan,** el B-roll y los planos vuelven a transcribir todo dos veces más, y «Detener» no lo corta. Sin Pexels conectado, igual gasta una llamada a la IA del negocio.~~ — arreglado el 10/11/2026 (`101042780`): las frases se leen una vez y se pasan (`alLeerFrases`), y sin Pexels se pregunta ANTES de pedirle nada a la IA (`accion: 'pexels'`).
- ~~**P2 · «Deshacer todo» y los toques de la persona:**~~ — arreglado el 10/11/2026 (`101042780`, `cuentaComoToque`: un atajo con el foco afuera cuenta, reproducir o pantalla completa no). Antes: sólo se detectan dentro de un panel con `data-ce-zona`. Un atajo con el foco en otra parte queda mezclado en el paso, y apretar play ya saca «Deshacer todo».
- ~~**P3 · La plantilla «Lima»** se muestra en la tarjeta sin minúsculas, y `presetDesdeApi` no deja poner `minusculas`.~~ — arreglado el 10/11/2026 (`101042780`).
- ~~**P3 · La pastilla** dice «10 agentes en vivo · paso N de 10» (`en-vivo.tsx:43`), aunque los agentes trabajan de a uno.~~ — arreglado el 10/11/2026 (`101042780`, `textoPastilla`: «en vivo · <agente> · paso N de 10»).
- **P3 · Tests:** los casos 7, 8, 10 y 13 de `tests/video-editor-enjambre.test.ts` buscan texto en el código, y la corrida en sí no se prueba.

### 2.3 Lo del reel que todavía no está — P3
Sale del relevo, `edicion-reel-nube.md:66-73`:
- la foto de B-roll bajada queda en Multimedia después de «Deshacer todo»;
- el agente de color (exposición, grano, sombras), que antes necesita medir la luz de un cuadro;
- el «whoosh» en los cortes, bloqueado por la licencia (ver §7.1);
- la tarjeta flotante con una grabación de pantalla («masked card») y el collage de papel rasgado (ver §3);
- los monitores (forma de onda, vectorscopio) y la lectura de LUFS en pantalla;
- los agentes en paralelo: hoy van de a uno porque dos comandos sobre la misma línea de tiempo se pisan.

### 2.4 Edición automática de los videos del Video Generator (el pipeline de Mauricio) — P3
- **Martín:**
  - 24/08: «Yo hago esto con Capcut... 1. Recorto mejor. 2. Pongo musica. 3. Mejoro la voz. 4. Pongo efectos de sonido, como el de la maquina de café. 5. Pongo los subtitulos».
  - 01/09: «Quiero que el usuario se lleve este resultado final en MaKo».
  - 01/09: «Sería bueno que al final de la generación de todo, MaKo haga automáticamente la edición con los subtitulos, la música, los cortes... Pero que haya una interfaz tipo editor para personalizarlo».
- **Ejemplos:** su edición en CapCut, `C:/Users/marti/OneDrive/Escritorio/Mauricio/CUARTO VIDEO DE IA/Video 4 de IA - Mauricio.mp4`.
- **Estado real:** existe «Editar en el editor» (`app/video-generator/editor-video.tsx:4,28`). La edición automática del punto 2.1 cubre los cortes, los subtítulos y la voz. Faltan la música y los efectos de sonido (licencia) y que salga renderizado solo (ver §11.2).
- **Fuente:** `docs/edicion-video-automatica.md`; `memory/edicion-video-automatica-mako.md`.

---

## 3. Motion graphics y animaciones

### 3.1 Motion graphics en el editor (motion-skills) — P2 · hecho a medias, fuera de main
- **Qué es:** un motor propio de motion graphics, `lib/motion/`.
  - Tiene 9 plantillas (titular, palabras, cifra, tercio, logo, barras, testimonio, oferta y cierre), 4 tonos y 3 proporciones.
  - En el editor, un motion es el elemento `motion-<plantilla>`; aparece en Biblioteca › Plantillas › «Motion» y en una pestaña Motion.
  - Por chat son `agregar_motion` y `editar_motion`; por la API, `agregar_motion_video` y `editar_motion_video`.
- **Martín:**
  - 26/10: «implementa esto de punta a punta: https://github.com/iart-ai/motion-skills que se puedan hacer motions graphics en la web y en el editor».
  - Esa misma noche: «Suspende y deja para despues lo de Motion, el editor e imagenes, dejalo registrado para seguirlo con otra cuenta».
  - 9/11: «teníamos también otras cosas como Motion Graphics. Yo te había enviado varios ejemplos».
- **Ejemplos:**
  - https://github.com/iart-ai/motion-skills
  - https://www.instagram.com/p/DeOxisYD6ap/?img_index=8&psln=MWZpZ29heDVicXI5Yg== (15/10, animaciones tipo Lottie)
  - https://www.instagram.com/reel/DfUdHN9sMbg/?mdxt=eTg3c3EwdnE2NnZy (9/11, cursores, ver §3.3)
  - Para el VSL, no para el editor, pero con el mismo pedido de «ir creando un banco de gráficos que ya vimos que funcionan» (24/07): https://www.skills.sh/heygen-com/hyperframes/css-animations y https://undraw.co/
- **Estado real:**
  - En main no existe: `ls-tree origin/main lib/motion` sale vacío y `git grep agregar_motion` da 0.
  - Vive en la etiqueta `rescate/motion-imagen-2610` @ `c45142425`, que **sí está en GitHub** (`git ls-remote`), igual que `respaldo/motion-2710-nube` @ `bc54265b2`. La rama misma no está.
  - Allí están `lib/motion/` (10 archivos, con `LICENSE-IART`), `graphics/definitions/motion.ts` e `inicio/PanelProyectos.tsx`.
  - Son 24 commits que nacieron en `7f36fa9c6` (28/10), y main tiene 2694 commits encima.
  - Probé la mezcla con `git merge-tree`: **97 conflictos**. De ellos, 65 son del Image Editor. Del Video Editor y la API: `PanelChat.tsx`, `chat/linea.ts`, `contexto.ts`, `estado.ts`, `editor-header.tsx`, `dialogo-exportar.tsx`, `lib/editor-video/chat-catalogo.ts`, `ia.ts`, `propuesta-bloque.ts`, `lib/api-mako/areas/video.run.ts`, `docs/api-mako.md`, el snapshot de la API y los tests.
  - **Conviene traerlo por partes** sobre el main de hoy (motor → elemento → chat y API) y no mezclar la rama entera.
- **Lo que le faltaba según su propio relevo:**
  - el test M10 en rojo;
  - el presupuesto del turno sin medir;
  - el tsc sin terminar;
  - nada visto en un navegador;
  - un bug en la plantilla `cifra`, que redondea 4,5 a 5.
- **Sin hacer:** marquesina, pasos con íconos, el logo dibujado desde un SVG del cliente y exportar un motion solo con transparencia (WebM con alfa).
- **Ojo:** el bloque motion del Web Generator, que está en la misma rama, es del chat Landings.
- **Fuente:** `rescate/motion-imagen-2610:docs/relevo/motion-imagen.md:7-17,29-55,72-87`; `docs/hallazgos-motion.md:85-106`; `respaldo/motion-2710-nube:docs/relevo/motion-nube-2710.md:76-90`; `memory/noche-26-10-cinco-puntos.md:17-19`.

### 3.2 Animaciones tipo Lottie — P3 · espera decisión
- **Martín, 15/10:** «Puedes pasarle esto al video editor y a landing generator. https://www.instagram.com/p/DeOxisYD6ap/ … Es para crear animaciones... Y en ese caso son tipo Lottie, muy utilizado en landing. Pero puede investigar otras skills o investigar otras animaciones...»
- **Ejemplos:** https://www.instagram.com/p/DeOxisYD6ap/?img_index=8&psln=MWZpZ29heDVicXI5Yg== y https://github.com/diffusionstudio/lottie (licencia MIT; es una skill de agente, no una librería).
- **Estado real:** no hay nada de Lottie en `app/video-editor` ni en `lib/editor-video` (grep 0). Falta decidir el renderer (lottie-web o Skottie) y si el Gemini del cliente escribe un Lottie que sirva. Las plantillas de motion de 3.1 cubren parte del pedido por otro camino.
- **Fuente:** `origin/main:app/admin/dev/video-editor/bitacora.ts:173-180`; `docs/hallazgos-video-editor.md:1316-1328`.

### 3.3 La animación de los cursores (Swarm rebuild) — P3 · a medias
- **Martín, 9/11:** «Este reel explica como hacer la animación de los cursores para web generator y editor. Y viene de una extensión que tal vez podriamos encontrar su repo y copiar o tener mas referencias».
- **Ejemplos:** https://www.instagram.com/reel/DfUdHN9sMbg/?mdxt=eTg3c3EwdnE2NnZy, bajado como `origin/referencias/reels-0911:cursores-explica.mp4` con su `.txt`. Para Web Replicate: https://www.instagram.com/reel/DfZFAfzs3Ng/?obrf=MWJveW5sbjJham9wbA== (`web-replicate.mp4`).
- **Estado real:** los cursores del editor están en la rama de la edición automática (`enjambre/cursores.ts` y `enjambre/components/cursores.tsx`), no en main. No hay constancia de que alguien haya encontrado el repo de la extensión.
- **Fuente:** transcript 6ea62e88, 9/11, 11:43 y 12:07 UTC (la línea `queue-operation`).

### 3.4 Pops para video (estilo Javi Tools / PopLab) — P3 · no está
- **Qué es:** carteles del tipo «50 % de descuento», «envío gratis», cuenta regresiva, un comentario de Instagram o una respuesta de WhatsApp simulados y testimonios, exportables a PNG o MP4.
- **Quién lo pidió:** salió en la llamada con Leila del 30/10 (ítem 2.11), con prioridad baja. La transcripción no deja claro quién lo propuso.
- **Estado real:** no hay nada específico. Lo más cercano es la plantilla de anuncio `oferta` (`lib/editor-video/plantillas.ts:308`) y las plantillas motion `oferta` y `testimonio`, que están sólo en la etiqueta de motion.
- **Fuente:** `origin/main:docs/relevo/pendientes-pc/pendientes-30-10.md:75`.

---

## 4. B-roll y cambios de plano

### 4.1 B-roll de MaKo: completarlo — P2 · hecho a medias
- **Qué es:** Multimedia › «B-roll de MaKo» propone fotos de Pexels (con la clave de cada negocio) donde se dice algo que se puede mostrar. Los cambios de plano son el efecto «Acercar». Por chat es `broll` y por la API `proponer_broll_video`.
- **Pedido:** Leila, en la llamada del 30/10 (2.15), quería que el editor ubique solo los resaltados y los subtítulos, ponga el B-roll y haga el cambio de plano. Martín: «implementar Submagic, implementar B-roll».
- **Estado real:** está en main (`app/video-editor/_opencut/broll/`). Lo que falta:
  - **sólo fotos:** no se buscan videos de Pexels;
  - **no hay** «Cambiar por otra foto» (grep 0);
  - **el acercamiento va al centro:** no hay detección de caras en el editor (sólo `fondo/segmentador.ts`, que sirve para quitar el fondo);
  - nunca se corrió con la IA real (`scripts/probar-broll-ia.mts --ws 3`) ni se miró en el navegador.
- **Fuente:** `origin/main:docs/hallazgos-video-editor.md:2186-2228`; `docs/relevo/nube-video-clips.md:21-23,40-44`.

### 4.2 Secuencia de fondo en blur con un texto muy grande, tipo reflexión — P3 · no está
- **Pedido:** Leila, 30/10, ítem 2.16. Nadie lo hizo.

### 4.3 Las fotos de Martín como B-roll — P3 · no está en el editor
- **Martín, 8/11:** «Quiero que me ordenes todas mis fotos, las vamos a utilizar para b-roll y hacer mucho contenido. Organizalas.»
- **Ejemplos:** https://photos.app.goo.gl/ApHJPcswwtDVqANv6
- **Estado real:** no hay nada de Google Photos en el editor (grep 0). La memoria `fotos-de-martin-album.md` sólo lo usa como referencia de cara.

---

## 5. Clips mágicos (tipo Opus Clip)

### 5.1 Seguir la cara al pasar a vertical — P2 · hecho a medias
- **Qué es:** Multimedia › «Clips mágicos» busca los mejores momentos, les pone puntaje de 0 a 99 y arma cada clip en un proyecto nuevo, en 9:16 y con subtítulos. Por chat es `clips_magicos` y por la API `buscar_clips_video`.
- **Pedido:** Leila, 30/10 (2.8). Martín no tiene cita propia.
- **Ejemplos:** https://github.com/SamurAIGPT/AI-Youtube-Shorts-Generator (MIT, usado de referencia).
- **Estado real:** está en main. Falta:
  - seguir la cara: recorta al centro, porque no hay detección de caras;
  - las fotos y los textos del horizontal quedan como estaban;
  - el «Trend»;
  - correrlo con la IA real (`scripts/probar-clips-ia.mts --ws 3`) y verlo.
  - **Ojo:** copiar un video de una hora pesa en el navegador lo mismo que el original.
- **Fuente:** `origin/main:docs/hallazgos-video-editor.md:2230-2267`; `docs/investigacion-video-clips.md`.

---

## 6. Plantillas

### 6.1 Plantillas reales de video: las 6 nuevas, las muestras de Pexels y el agente experto — P3 · hecho a medias
- **Martín, 29/10:** «Los templates tienen que ser reales… deben ser ejemplos reales».
- **Ejemplos:** https://github.com/AgriciDaniel/claude-shorts · https://github.com/browser-use/video-use · https://github.com/heygen-com/hyperframes · https://www.capcut.com/templates
- **Estado real:**
  - Hecho: «Ver ejemplo» con el guion de rodaje de las plantillas que ya estaban (`lib/editor-video/plantillas-ejemplos.ts`).
  - `lib/editor-video/plantillas.ts` sigue con los 7 ids viejos (`gancho`, `testimonio`, `antes-despues`, `beneficios`, `oferta`, `gancho-escrito` y `oferta-glitch`). Las dos últimas se iban a retirar.
  - No están `respuesta-comentario`, `caso-numeros`, `historia`, `tres-errores`, `clip-podcast` ni `tour-propiedad` (grep 0).
  - Tampoco están las muestras sin caras.
  - `video_editor.experto` no existe (grep 0).
  - `PistaPlantilla` existe, pero no tiene pista de audio (`principal | video-1 | forma-1 | texto-1..4`).
- **Fuente:** `origin/main:docs/plantillas-reales/video.md`.

### 6.2 Plantillas propias, privadas o públicas, con estrellas — P3 · no está en Video
- **Pedido:** Leila, 30/10, ítem 2.5. Martín: «anotate Fathom».
- **Estado real:** hoy esto existe sólo en Web Generator y en el CRM.
- **Fuente:** `origin/main:docs/relevo/pendientes-pc/pendientes-30-10.md:63`.

---

## 7. Audio

### 7.1 Música de biblioteca y efectos de sonido (también el «whoosh») — P2 · bloqueado por una decisión
- **Estado real:**
  - `lib/musica-catalogo.ts` está **vacío a propósito**: falta la licencia, y la fuente elegida es Epidemic Sound Connect, pendiente de alta.
  - La pestaña Audio (`sounds/components/assets-view.tsx`) sólo usa audio propio, y se sacó Freesound por sus términos.
  - Esto bloquea el whoosh de la edición automática, las plantillas con audio, el pipeline de Mauricio y lo que se le prometió a Teo («un CapCut real con música»).
  - La música de Pixabay sirve para entregarle un archivo a un cliente, no para el SaaS.
- **Decide:** Martín (D7g).
- **Fuente:** `origin/main:docs/editor-video/inventario-copia-capcut.md:80`; `docs/pendientes-depurados-7-11.md:781-783,1022`.

### 7.2 Reducción de ruido en un worker — P2 · no está
- **Estado real:** RNNoise corre en el hilo principal, a unos 6 s por minuto y canal: un clip estéreo de 10 minutos traba el editor unos 2 minutos. En `audio/` no hay `new Worker`, y `audio/dsp/ruido.ts` ya es puro, listo para moverlo. Con un ventilador fuerte, «Borrar silencios» deja alguna pausa al límite.
- **Fuente:** `origin/main:docs/hallazgos-video-editor.md:1615-1624`.

### 7.3 Voz clonada, Mejorar voz y Canal — P3 · no está
- Aislar voz queda afuera porque los pesos de Demucs son CC BY-NC.
- En el reel de mentores, la voz clonada y el loudnorm se hicieron fuera de MaKo con ffmpeg (`LA-CONFIG.json`).
- **Fuente:** `origin/main:docs/hallazgos-video-editor.md:1525-1536`; `docs/relevo/reel-mentores-high-ticket.md:330-340`.

---

## 8. Exportar y que el video salga del editor

### 8.1 Exportar MP4, MOV y WebM en producción — P1 · nunca probado
- Hay que medirlo con ffprobe. Es parte de la verificación de §13.

### 8.2 «Mandar al grupo de MaKo» y la pantalla de «Mis creativos» — P2 · a medias
- **Martín, a Teo, en la llamada del 28/10:** «terminás el video y decís publicalo, mandáselo al cliente o programalo».
- **Estado real:** exportar **no es sólo descargar**, como decían los dos relevamientos.
  - Desde el 29/10 (`7e7c04207`), «Publicar» exporta el MP4, lo sube con la subida firmada del Calendario y lo deja como una Publicación para mañana a las 10:00 (`export/dialogo-exportar.tsx:178-316`, `app/calendario/publicar-desde-crear.ts`).
  - Desde el 6/11 (`97495f3b2`), «Usar en un anuncio» lo lleva a `/anuncio/nuevo` y lo **propone** (`dialogo-exportar.tsx:320-437`).
- **Falta:**
  - «Mandar al grupo de MaKo» (grep 0);
  - la pantalla de Ads Manager: el backend de «Subir creativos» ya acepta un video de MaKo, pero la pantalla no se tocó;
  - las operaciones de la API para publicar desde el editor;
  - publicar de verdad en Meta: `ZERNIO_ANUNCIOS_PROBADO` sigue en false.
- **Fuente:** `origin/main:app/admin/dev/video-editor/bitacora.ts:22`; `docs/relevo/video-editor-leila.md:15-18`; mensaje del commit `97495f3b2`.

---

## 9. Chat y API: editar todo por prompt

### 9.1 Lo que el chat todavía no sabe hacer — P2 · hecho a medias
- **Martín:**
  - 15/10: «En realidad debería saber hacer cualquier cosa que le pido... Si le pido que me subtitule todo, si le pido que me corte los silencios, si le pido que me haga una animación, transiciones específicas que le pida, si le pido corrección de color, corrección de audio, etc...».
  - 15/10: «tienen que pasarle absolutamente todos los botones. Todas las funciones a la API de MaKo».
  - 27/10: «si una persona quiere editar lo que sea debería poder. Con prompts en mako me refiero».
- **Estado real:** `lib/editor-video/chat-catalogo.ts:422-423` (`NO_SE_PUEDE_CHAT`) dice que por chat NO se puede:
  - agregar videos, imágenes, música, sonidos, stickers o formas de la biblioteca;
  - importar a Multimedia;
  - voz en off o texto a voz;
  - avatar de IA;
  - fotogramas clave;
  - máscaras;
  - quitar el fondo o el croma;
  - recortar el encuadre;
  - el fondo del lienzo;
  - las plantillas de estilo de texto;
  - guardar un preset de subtítulos;
  - duplicar o copiar;
  - pegar atributos.

  «Discutir | Editar» ya está en main (`PanelChat.tsx`). El inventario de la API con 30 filas en «falta» está sólo en la etiqueta de motion (`docs/editor-video/inventario-api.md`) y algunas ya se cubrieron.
- **Fuente:** `rescate/motion-imagen-2610:docs/relevo/motion-nube-2710.md:84,96`.

### 9.2 Pedir un cambio por WhatsApp o el Ops Center y aceptarlo en el editor, de punta a punta — P2 · piezas hechas, cadena sin probar
- **Martín, 20/10:** «quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...»
- **Estado real:** las piezas existen:
  - la migración `supabase/migrations/0302_video_editor_propuestas.sql`;
  - `?propuesta=` (`chat/foco.ts`);
  - la tarjeta «Original | Modificado» (`lib/editor-video/propuesta-bloque.ts`).

  Nunca se probó la cadena entera. La bitácora dice «falta la tarjeta», pero la tarjeta ya está.
- **Fuente:** `origin/main:docs/pendientes.md:466`; `docs/relevo/video-editor.md:25-29`.

---

## 10. Copia de CapCut y la pantalla

### 10.1 Terminar la copia de CapCut (40 funciones que faltan y 25 a medias) — P3
- **Martín:**
  - 11/10: «Quiero que implementes un editor de vídeo end-to-end replicando a Capcut... Que sea identico con todas sus funcionalidades».
  - 15/10: «Creo que Video Editor no terminó de copiar todo lo que debia copiar de capcut».
  - 28/10: «Y cual es el status de editor? Ya debería haber estado eso, asi le avisamos a Leila que ya puede utilizar MaKo y no capcut».
- **Ejemplos:** https://github.com/opencut-app/opencut (la base del port).
- **Estado real:** el inventario es del 15/10 y nadie lo volvió a medir: 158 funciones, de las que 77 están hechas, 25 a medias, 40 faltan y 16 quedaron afuera con su motivo. Siguen apagados con «Próximamente»:
  - Ajuste automático de color (`effects/components/panel-color.tsx:167`);
  - Efectos corporales (`effects/components/biblioteca.tsx:194`);
  - el pincel de Eliminación personalizada (`fondo/panel-eliminar-fondo.tsx:135`);
  - la portada incrustada (`timeline/components/portada-boton.tsx:315`).

  Faltan también la Burbuja, más fotogramas clave, el seguimiento de cara, las Curvas, la estabilización, el clip combinado, atajos (I/O, Shift+X, Ctrl+R, Shift+B, Ctrl+J), la marca de agua, exportar un rango, el vúmetro, la cámara lenta fluida y Favoritos.
- **Fuente:** `origin/main:docs/editor-video/inventario-copia-capcut.md:20-176`; `docs/hallazgos-video-editor.md:1523-1732`.

### 10.2 Chat fijo, proyectos en la barra del costado y colores de MaKo — P2 · hecho a medias
- **Martín, 27/10:** «veas de adaptar las tabs de video e imagen con el chat que tenemos de MaKo, para que se pueda editar con prompting, algo similar a lo que hicimos con Web Generator, que este al costado, que los "proyectos" se vean en la barra del costado, y que no cambie de ruta... Tambien ponle los colores de MaKo a esas tabs.»
- **Estado real:**
  - Ya están en main el chat siempre abierto (`chat/estado.ts:3-6`), «Discutir | Editar» y los colores.
  - `PanelProyectos.tsx` existe sólo en la etiqueta de motion: en main, `inicio/` tiene únicamente `nombre.ts` y `tamano.ts`.
  - `RUTAS_QUE_PLIEGAN` (`app/_components/Sidebar.tsx:125`) no incluye `/video-editor`, y ese archivo es de otro chat.
- **Fuente:** `rescate/motion-imagen-2610:docs/relevo/motion-nube-2710.md:25-33,87,93-97`.

### 10.3 Revisión de pantalla: la cabecera (paso 3) — P3 · trabado
- **Estado real:**
  - En el banco de pruebas, `EditorHeader` arrastra código de servidor (`@opentelemetry/api`, http, https, url y util).
  - Hay que reemplazar ese import por un stub y medir a siete anchos, de 688 a 1312 px. El banco está en `C:/dev/revisiones/editor-pantalla-3010/banco/`.
  - El recorrido visual general va en 8 de 22 pantallas.
- **Fuente:** `rescate/motion-imagen-2610:docs/relevo/video-editor-leila.md:93-119`; `origin/main:docs/pendientes.md:88,90`.

---

## 11. Dónde viven los proyectos y el render en servidor

### 11.1 Los proyectos viven en el navegador, sin tope por plan — P3
- **Estado real:** los proyectos están en OPFS e IndexedDB. Sólo hay un aviso de cuota (`services/storage/quota.ts:49-59`). Los medios efímeros no se limpian, y los clips mágicos copian el proyecto entero. El tope por plan se decide con el chat de Planes, pagos y Partners. Es otra de las promesas a Teo.
- **Fuente:** `origin/main:docs/relevo/pedidos-perdidos-2810.md:115`; `docs/hallazgos-video-editor.md:499-519`.

### 11.2 Render en servidor y MaKo Desktop (un video pedido por chat que sale renderizado) — P3 · espera decisión
- **Martín, 25/10 (respuesta a D7a):** las «dos vías», un servidor de MaKo y MaKo Desktop.
- **Estado real:** hoy se exporta sólo en el navegador, y por eso un pedido por chat queda como propuesta. `montar_anuncio_video` no existe (grep 0). Vercel no trae ffmpeg, y el worker de montaje no tiene contenedor: provisionarlo lo decide Martín.
- **Fuente:** `origin/main:docs/pendientes.md:237`; `docs/edicion-video-automatica.md:365-395`.

### 11.3 Avatar de IA dentro del editor, de punta a punta — P3 · desconocido
- Al 14/10, `mediaDeFlow` devolvía null con el payload posicional, y no lo comprobé contra el puente de hoy. «Crear» abre el Video Generator en otra pestaña, y la voz no se cambia desde el editor.
- **Fuente:** `origin/main:docs/hallazgos-video-editor.md:1538-1550`.

---

## 12. Clientes

### 12.1 Ticket #15 de Leila: no importa «ESP_Fabi sentada_limpio.mp4» — P1 · a medias
- **Estado real:** el aviso ya explica el motivo: un .mp4 cortado se lee «sin pistas» (`media/importar-motivo.ts:14`). Falta que Leila reimporte el archivo o lo abra en su computadora. Nadie le avisó y el ticket no se cerró.
- **Fuente:** `origin/main:docs/relevo/video-editor-leila.md:26-27,56-58`.

### 12.2 Avisarle a Leila que puede dejar Submagic — P1, después de §13
- Sólo cuando lo de §1.1 se haya visto andar.

---

## 13. Verla andar en Chrome (para todo lo de arriba) — P1

Se hace en el Chrome de Martín, con la ventana sin minimizar, en el negocio de MaKo (ws9) o en el Cliente de Prueba (ws3), y **nunca** en el de Mauricio (ws1). Tiene que ser en la PC: la nube no corre el editor.

1. Exportar MP4, MOV y WebM, y medirlos con ffprobe. Probar «Publicar» al Calendario y «Usar en un anuncio».
2. Reproducir el cuelgue de más de 90 s al agregar «Texto predeterminado» (visto el 13/10).
3. Transcripción, muletillas, karaoke, palabras clave y presets de marca.
4. B-roll y clips mágicos.
5. La edición automática, ya en main: el registro, los cursores, que la prueba de estilos no quede en el historial, «Deshacer todo», y por chat «edítalo todo» → Aceptar → «Restaurar». Oír el volumen entre cortes.
6. La tanda 5 de las plantillas de anuncio: «Utilizar plantilla», «Sustituir», Ctrl+Z y `usar_plantilla` / `reemplazar_clip` por chat.
7. Las fuentes medidas con LoAF en el proyecto `711d3216…`.

La primera prueba real puede ser el reel de mentores (`docs/relevo/reel-mentores-high-ticket.md` §9): subtítulos blancos a media altura, de 2 o 3 palabras.

**Fuente:** `origin/main:docs/pendientes.md:465`; `docs/relevo/video-editor.md:11-17,66-73,141-148,209-213`.

---

## Decisiones que esperan a Martín

1. **Licencia de música y efectos de sonido (D7g):** ¿Epidemic Sound Connect? Bloquea el whoosh, las plantillas con audio y el pipeline de Mauricio.
2. **Motion graphics:** el 26/10 lo suspendió y hoy lo nombró. ¿Se retoma ya, trayéndolo por partes en la nube?
3. **Lottie:** ¿sí o no, y con qué renderer?
4. **Render en servidor:** ¿se monta el contenedor del worker de montaje, dónde corre ffmpeg y qué lugar ocupa MaKo Desktop?
5. **Qué son los «B-rolls que genera la IA»:** el de Pexels no se genera.
6. **Qué es un «formato» de video o imagen para Creaciones:** `formato_video` está en `TIPOS_CREACION` (`lib/creaciones-reglas.ts:24`), pero sigue sin enchufar.
7. **Avatar de IA:** ¿se pausa después de la toma 1, como hace el Video Generator?
8. **Tope de almacenamiento por plan:** se decide con el chat de Planes.

## Correcciones a lo que decían los documentos

- **Exportar «sólo descarga»:** falso desde el 29/10 («Publicar» → Calendario) y desde el 6/11 («Usar en un anuncio»).
- **«Motion nunca se pusheó»:** la rama no, pero la etiqueta `rescate/motion-imagen-2610` y `respaldo/motion-2710-nube` sí están en GitHub.
- **El «Próximamente» de `assets-view.tsx:120`:** es el cartel del interruptor apagado de Emojis de IA, no otra función.
- **«No hay `PistaPlantilla`»:** el tipo existe. Lo que no hay es una pista de audio en las plantillas.
- **«Para subir la edición automática hay que mirar un action rojo»:** el rojo es sólo el freno por el autor del último commit. No falló ningún test.
- **La bitácora** (`app/admin/dev/video-editor/bitacora.ts:21-23`) dice «Abrirlo a los clientes: cola» y «falta la tarjeta». El editor está abierto a todos desde el 12/10 y la tarjeta existe.
- **`docs/pendientes-depurados-7-11.md:781`** («no tiene Deshacer, no reordena tomas y no tiene música») habla del editor de anuncios del Video Generator (`app/video-generator/EditorAnuncio.tsx`), no del editor tipo CapCut.

## Lo que no se pudo confirmar

- **Web Generator:** Martín preguntó cómo va, y no se revisó. Esta lista es sólo del Video Editor.
- **Otros ejemplos:** si Martín mandó más ejemplos por WhatsApp (su chat o el grupo Makito) sin pegarlos en un chat, no están en ningún transcript. Los únicos que aparecen son los de esta lista, y ninguno es de Submagic.
- **El cuelgue de «Texto predeterminado»** y **el resultado real de exportar:** sólo se ven en el navegador.
- **Marcar o desmarcar una palabra clave a mano** y las **«letras automáticas»:** salen del documento de hallazgos, no las busqué en el código.
- **El Avatar de IA:** si `mediaDeFlow` sigue devolviendo null con el puente de hoy.
- **El repo de la extensión «Swarm rebuild»:** nadie lo encontró.
- **La mezcla de la edición automática:** la probé contra el main de ahora (`406dfd8fc`), y main sigue moviéndose.
- **Los 97 conflictos de Motion:** son de un `merge-tree` contra la etiqueta completa. Traerlo por partes puede dar menos, y eso no lo medí.
- **El inventario de CapCut (15/10):** nadie lo volvió a medir, así que los números 77, 25, 40 y 16 pueden haber cambiado.