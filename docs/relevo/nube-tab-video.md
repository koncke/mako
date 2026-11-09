# La tab «Video»: Video Editor + AI Avatar en una sola, con MaKo guiando (nube, 9/11/2026)

**El pedido** (Martín, 9/11/2026, casi textual): «Tal como en imágenes, que se llame Video… vas a ver tus outliers primero»;
replicar contenido como el reel de mentores de punta a punta; documentar y reusar las piezas (personaje, fondo, voz, tomas
blancas, música, subtítulos, efectos); «No quiero que sea difícil para el usuario visualizarlo… que MaKo le vaya dando los
pasos»; al elegir un clip o una plantilla se abre la edición y MaKo pide lo que falta («pásame una foto o seleccioná de estas»),
con el resto de la pantalla opacado y su mensaje marcado; las carpetas del proyecto (recursos, generaciones…); «simplificar…
que no haya exageradamente tantos botones»; y que MaKo «pueda ir haciendo toda la animación que ya implementamos en los cursores».

Rama: `punta/tab-video` (sobre `punta/creator-activo`, que trae `docs/plantillas-video/`). Sin escrituras en producción ni
migraciones: todo lo de esta tanda vive en el navegador o en módulos puros.

---

## 1. Qué se unifica y qué se depreca

| Hoy | Queda |
|---|---|
| Fila «Video» (`video-editor`, la copia de CapCut) | **La tab «Video»**, la única de video de Create. Misma key, misma ruta (`/video-editor`): la miran las capas, la API y el teléfono. |
| Fila «AI Avatar» (`ai-avatar`, la réplica de Higgsfield) | **Se queda en la barra, por ahora.** Su estudio también se abre desde Video («Tu personaje con IA» en «Nuevo video» y el paso del personaje de una plantilla guiada). La primera versión la sacaba de la barra y la revisión lo frenó: Video es sólo de Pro (`NAV_SOLO_PRO`, lib/plan-esencial-reglas.ts) y AI Avatar es de los tres planes, así que un Esencial se quedaba sin ninguna puerta a su personaje. **Decide Martín:** ¿Video entra en los tres planes (y la fila se va), o AI Avatar sigue como fila para Esencial? `tests/video-tab.test.ts` (9) lo ata a esa condición. |
| «Generar con IA» (Video Generator) | Sigue como plantilla de «Nuevo video» (ya lo era). |

Lo que NO se depreca en esta tanda (y por qué): los lienzos vacíos y las plantillas de anuncio de «Nuevo video» siguen; son la
otra mitad («crear desde cero»). El AI Avatar mudo de las plantillas (`SIN_MOTOR.voz`) se queda como está hasta que la voz
voice-to-voice tenga su ruta (tanda 3).

## 2. Cómo se ve la tab

Copiada de Image (6/11: «La tab de "Encuentra tu siguiente OUTLIER" tiene que ser la principal»):

- **`/video-editor`** → **«Encuentra tu siguiente outlier»**: reels y anuncios que funcionan, a pantalla completa y sin la
  tarjeta del chat (en Image la tarjeta sale sólo mientras se edita). Cada tarjeta: el creador, de dónde sale, su número de
  outlier (el «3,7×» de `lib/multiplo-rendimiento.ts`, nunca otro) y **«Replicar»** cuando MaKo tiene la plantilla que lo
  copia. Arriba a la derecha, «Crear desde cero».
- **`/video-editor?ver=crear`** → la pantalla de Create de siempre: el chat de MaKo a la izquierda, «Nuevo video» con las
  plantillas. La primera sección es **«Replicar un outlier»** (hoy: «Mensaje para…»), después «Tu personaje con IA», los
  lienzos, «Generar con IA» y las de anuncio.
- **`/video-editor/<proyecto>`** → el editor con la tarjeta de MaKo a la izquierda. En un proyecto de plantilla guiada, el
  editor abre en **modo simple** (§5) y MaKo lleva los pasos (§4).

### El contrato de los outliers (lo enchufa el chat «Outliers de reels y anuncios»)

`lib/video-outliers.ts` (puro) define `OutlierVideo` y `FuenteOutliersVideo`; `lib/video-outliers-servidor.ts` junta las
fuentes registradas en `FUENTES_OUTLIERS_VIDEO`. Para enchufar una fuente nueva:

1. un módulo `lib/video-outliers/<fuente>.ts` que exporte una `FuenteOutliersVideo` (`id`, `nombre`, `leer(): Promise<LecturaFuente>`);
2. su línea en `FUENTES_OUTLIERS_VIDEO`;
3. nada más: la portada, el orden y los vacíos ya los resuelve `juntarOutliers`.

Reglas que la portada ya cumple y la fuente no tiene que repetir:

- **«No pude leer» no es «no hay»**: una fuente que falla vuelve `{ ok: false, motivo }` y la portada lo dice, nunca un vacío.
- **El outlier es el de toda la app** (`Multiplo`), con su `motivo` cuando no hay número; nunca un número propio.
- **El dato de un tercero no se republica**: la tarjeta lleva el link al original y una miniatura sólo si la fuente la puede
  servir legalmente (`miniatura: null` si no; la tarjeta dibuja la ESTRUCTURA de la plantilla).
- **Replicar** sólo si `plantilla` nombra una plantilla guiada que existe (`plantillaGuiada(id)`); si no, «Guardar» y «Ver».

La primera fuente es la curada de MaKo (`OUTLIERS_CON_PLANTILLA`): el reel de Josep (Tacho), del que sale «Mensaje para…».

## 3. Las piezas reutilizables

`lib/video-plantillas/piezas.ts` (puro): una fila por pieza con qué es, de dónde sale y su regla, para TODA plantilla:

| Pieza | Qué pide MaKo | Regla (manual §3/§8) |
|---|---|---|
| Personaje | una foto real o un personaje ya aprobado | base de TODA imagen; nunca un fotograma de otro clip |
| Fondo | una referencia del lugar | se termina solo, sin personas; después entra la persona |
| Clip hablado | la frase del bloque | imagen primero, OK, UN video; duración = palabras (`duracionDeClip`) |
| Voz | su voz clonada (o grabarla) | voice-to-voice, el acento lo pone el origen |
| Toma blanca | la pose (una foto de referencia) | a contraluz, la luz copiada de una toma aprobada |
| Música | la de la referencia o una de ElevenLabs Music | golpes donde los pone la referencia, nunca debajo de la voz |
| Subtítulos | nada (los arma el editor) | 2-3 palabras, debajo del mentón medido por clip |
| Efectos | nada | de a uno, sólo donde suma |
| Cartel | el CTA y la oferta | legibles, en el cierre mudo |

## 4. El flujo guiado de «Mensaje para…», paso por paso

La plantilla vive en `lib/video-plantillas/mensaje-para.ts` (los 6 bloques con sus tiempos medidos, las piezas, las reglas y
los pasos). Lo que dice MaKo en cada paso es una APERTURA (`lib/aperturas/video-guia.ts`): la arma el código, sin IA, y la
primera pregunta es de hecho. Mientras MaKo pregunta, el resto de la pantalla se opaca y su mensaje queda marcado (el velo de la
guía, §6). Lo elegido queda en el proyecto (`app/video-editor/guia/estado.ts`, en el navegador, con el workspace en la clave).

| # | Paso | Lo que pide MaKo (en el chat, opacado lo demás) | Opciones |
|---|---|---|---|
| 1 | La referencia | «Este video copia el de Josep: 6 bloques en 30 s. ¿Quieres verlo antes de empezar?» | Ver el original · Empezar · Ahora no |
| 2 | El destinatario | «¿A quién le habla tu mensaje? Es el "mensaje para…" del arranque.» | se escribe en el guion |
| 3 | El guion | «Tu guion tiene 6 bloques. ¿Ya lo tienes escrito?» | Escribirlo ahora (abre el editor de 6 bloques con palabras y segundos por clip) · Usar el ejemplo · Ahora no |
| 4 | El personaje | «Para tu personaje necesito una foto tuya, de frente y con luz de día. ¿Cuál uso?» | **las fotos que ya subió y sus personajes aprobados, cliqueables** · Subir una foto · Crear mi personaje (el estudio) · Ahora no |
| 5 | La voz | «Tu video va con tu voz. ¿Ya la grabaste?» | Usar mi voz · Grabarla ahora · Ahora no |
| 6 | El fondo | «¿Dónde vas a estar? Se arma el fondo solo, sin ti.» | Corcho de investigación (el del ejemplo) · Otro lugar · Ahora no |
| 7 | Los clips | «Clip 1 de 5: "…". Dura 6 s (18 créditos). ¿Lo filmo con tu personaje?» | Ver la imagen primero · Ahora no — los créditos sólo con el OK a la imagen |
| 8 | Las tomas blancas | «Faltan las tomas a contraluz: dedo arriba, brazos cruzados y perfil. ¿Las armo?» | — |
| 9 | El montaje | MaKo lo arma con sus cursores (§7) y muestra cada paso | — |
| 10 | La entrega | «¿Lo subes con la canción o se la pones desde Instagram?» | Con música · Sin música |

En esta tanda andan de punta a punta los pasos 1 a 5 (el guion, la foto, la voz) y el cálculo de cada clip; del 6 al 10 MaKo
dice qué falta y lleva al lugar donde se hace hoy (el estudio del personaje, el Video Generator). Lo que falta para que MaKo los
haga solo, en §8.

## 5. El modo simple del editor

En un proyecto de plantilla guiada el editor abre simple; un botón «Todas las herramientas» lo deja como siempre (y se recuerda
por proyecto). Lo que se esconde, contado de la barra real (docs/hallazgos-video-editor.md):

- **Biblioteca:** quedan Multimedia, Audio, Texto y Subtítulos. Se esconden Stickers, Efectos, Transiciones, Filtros, Ajuste,
  Plantillas y Avatar de IA.
- **Línea de tiempo:** quedan Seleccionar, Deshacer, Rehacer, Dividir, Eliminar y el zoom. Se esconden Borrar izquierda/derecha,
  Marcador, Imán, Ajuste automático, Vinculación, Eje de vista previa y las de clip (Recortar, Reflejar, Girar, Congelar,
  Revertir).
- **Cabecera:** se esconden Diseño ▾ y Atajos; quedan el nombre, Guardado, Exportar y «Todas las herramientas».

El criterio es «lo que el paso de la plantilla pide», no un recorte a ojo: cada herramienta escondida tiene que poder volver con
un toque, y lo que MaKo pide tocar nunca se esconde.

## 6. El velo de la pregunta (se reusa la guía, no se reinventa)

`app/_ui/guia/VeloGuia.tsx` ya opaca la pestaña con huecos en el ancla y en cada chat (`[data-mako-chat]`). Se le suma UN modo:
**`destacarEnElChat()`** (`app/_ui/guia/store.ts`): sin objetivo de la guía, opaca todo menos el chat y le pone el aro al
mensaje marcado (`[data-mako-destacado]`), sin frase ni avance por toque. La tarjeta del chat del editor pasa a llevar
`data-mako-chat`. Lo decide la función pura `dibujoDestacado` (lib/guia/huecos.ts), con test.

## 7. Los cursores de MaKo (tanda 2)

Los que hay (`app/video-editor/_opencut/enjambre/`): `CursoresAgentes` dibuja las flechas con nombre y `anotar(agente, …)` las
mueve; no hacen clic de verdad. El montaje de una plantilla guiada va a correr como una corrida del enjambre con SUS agentes
(guion, clips, voz, golpes, subtítulos, efecto, cierre), cada uno con la función de su botón (la regla de «Edición
automática»: el «Aceptar» del chat, «Deshacer todo» por el historial). Esta tanda no lo hace: deja la plantilla con los
`agentes` de cada paso declarados para que la corrida los lea.

## 8. Lo que queda, por tandas

- **Tanda 2:** el estudio del personaje adentro de Video (`?ver=personaje`, la tarjeta con «Video»), `/ai-avatar` →
  redirige con la query entera; las carpetas en Multimedia (Recursos · Generaciones · Voz · Música · Entregas, la
  definición ya está en la plantilla); la corrida del montaje con los cursores.
- **Tanda 3:** la voz voice-to-voice con el clon (`convertirVoz` existe en lib/elevenlabs.ts sin ningún llamador de la app);
  la música y los golpes (`ritmos.ts` + Beat This!, docs/hallazgos-video-editor.md); el chequeo del clip con la transcripción
  (`chequearGuion` ya está, puro).
- **Fuera de este chat:** la fuente de outliers («Outliers de reels y anuncios»).

## 9. Hecho en esta tanda (9/11/2026, rama `punta/tab-video`)

- **La portada** (`/video-editor`): «Encuentra tu siguiente OUTLIER» con las clases de la de Image; `?ver=crear` la pantalla de
  Create; `?replicar=<plantilla>` arma el proyecto guiado y REEMPLAZA la URL (con «Atrás» no se arma otro). Una fuente que no
  se puede leer se dice con «Reportar a Soporte». Hoy la única fuente es la de MaKo (el reel de Josep, sin su imagen).
- **«Nuevo video»** empieza por «Replicar un outlier»: «Mensaje para…» (arma un proyecto 9:16 con ese nombre y lo marca como
  guiado) y «Tu personaje con IA» (el estudio). El teléfono no ofrece las guiadas (`sinGuiadas`).
- **MaKo guía en el chat del editor** (`app/video-editor/guia/GuiaEnElChat.tsx`): la referencia, el guion, el personaje (sus
  fotos y personajes, cliqueables, o «Subir una foto»), la voz (la clonada, o «Grabarla ahora» con el modal de siempre), el
  fondo, y cuántos segundos y créditos suman los clips. Con la pregunta a la vista, el velo opaca todo menos el chat y la marca;
  un toque fuera del chat lo apaga hasta la próxima pregunta.
- **El editor del guion** (`guia/EditorGuion.tsx`): un campo por bloque con su molde, las palabras, los segundos y los créditos
  de su clip, y lo que falta antes de filmar.
- **El modo simple**: biblioteca con Multimedia · Audio · Texto · Subtítulos; línea de tiempo con elegir, deshacer, dividir,
  borrar, zoom y subtítulos; sin «Diseño» ni «Atajos»; «Todas las herramientas» lo apaga (se recuerda por proyecto).
- **AI Avatar** sigue en la barra (ver §1: la revisión lo frenó por el plan Esencial; la decisión es de Martín).
- **El catálogo de funciones** (lib/funciones-mako.ts) dice lo nuevo y lo que todavía no hace.
- **La revisión adversarial (9/11) y lo que se cambió por ella:**
  - **La memoria de la guía es el PROYECTO.** Con la de las aperturas, «Ahora no» en un paso callaba la guía entera (MaKo sólo
    muestra el primer paso que falta). Ahora un paso salteado se saltea, sigue el siguiente, y la lista «Tu video» deja
    «Retomar» lo salteado y «Editar» el guion. Con todo hecho, dice que los clips se filman en «Tu personaje con IA».
  - **Lo de siempre calla sólo MIENTRAS MaKo pregunta** (`onHablando`): con «el proyecto es guiado» a secas, el chat quedaba
    sin sugerencias para siempre.
  - **Un guion «listo» es completo Y filmable**: un bloque que no entra en 10 s ya no cuenta como listo, y los clips esperan.
  - **La tarjeta del chat se abre sola** si estaba plegada y MaKo pregunta.
  - **La foto nueva es la que no estaba** (no la última de la lista), y lo que la ruta saltea (no es una imagen, pasa de 15 MB)
    se dice. «No pude leer tus fotos» no es «no tienes fotos».
  - **«Volver al inicio» y borrar el proyecto abierto** llevan a la lista de proyectos (`?ver=crear`), no a los outliers.
  - **«Replicar» no arma dos proyectos** con un doble clic, y si falla lo dice.
  - **En modo simple, la pestaña abierta no se esconde** (otro panel abre «Efectos»).
  - **El velo** vuelve a buscar la pregunta cada 250 ms cuando no está a la vista, no en cada cuadro.
- **Probado**: `tests/video-tab.test.ts` (10 casos, 21 roturas, un cambio sin efecto en verde) y los tests que fijaban lo de
  antes, actualizados (el orden de «Nuevo video»; en iniciativa-video y enjambre, dos guardas que citaban una línea pasaron a
  afirmar lo que cuidan). Tipos acotados sin errores en los archivos tocados. **No se miró en un navegador**: la nube no corre el editor (docs/hallazgos-video-editor.md, «SIN
  RESOLVER: el editor no carga en un Chrome sin ventana»).
