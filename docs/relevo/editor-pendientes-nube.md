# Relevo — los pendientes del Video Editor (chat de la nube, 9-10/11/2026)

> Lo escribe el chat «Video Editor: pendientes (nube)», sesión `cli_899d9bf8-5e22-5c18-bb6c-4f077c3d9e08`, cuenta `nube`.
> Se actualiza al cerrar cada tanda. La lista de lo pendiente es `docs/editor-video/pendientes-video-editor.md`: ahí se tacha lo hecho.

## Lo que pidió Martín (9/11/2026, textual)

«continúes sobre todo con absolutamente todos los pendientes que tenemos en Video Editor, porque dentro de poco lo vamos a empezar a
utilizar… por ejemplo, duplicar Submagic para el tema de los subtítulos. Y teníamos también otras cosas como Motion Graphics. Yo te
había enviado varios ejemplos.»

Fuera de esta tanda, a propósito: la música y los efectos con licencia (§7.1, decisión D7g), el render en servidor (§11.2), Lottie
(§3.2) y todo lo que pide mirar el editor en Chrome (§13): va a la lista de la PC, abajo.

## Las puntas

Las puntas salen firmadas por la nube (`noreply@anthropic.com`); `punta.yml` las frena por el autor del último commit hasta que el
Cerebro las vuelva a firmar. El árbol no cambia, así que el `Veredicto:` del mensaje sigue valiendo.

| Tanda | Punta | Commit con VERDE | Qué trae |
|---|---|---|---|
| 1 | `punta/edicion-arreglos-0911` | `101042780` (7227 tests de 722 archivos + tsc entero, Node 24) | Los bugs de la revisión de la edición automática (§2.2). Trae debajo `punta/edicion-reel-0911` (la edición automática misma) |
| 2 | `punta/subtitulos-submagic-0911` | `8af141aff` (7263 tests de 724 archivos + tsc entero, Node 24) | Subtítulos de Submagic (§1.2, §1.3, §1.4, §1.5), con lo que encontró su revisión. Trae debajo la tanda 1 |
| 3 | `punta/motion-0911` | `947524c66` (7150 tests de 716 archivos + tsc entero, Node 24) | Motion graphics por partes (§3.1), con lo que encontró su revisión. Trae debajo las tandas 1 y 2 |
| 4 | `punta/editor-tanda4-0911` | (en revisión) | Ruido en un worker (§7.2), seguir a la persona en Clips (§5.1), el chat suma cinco botones (§9.1), B-roll «Otra» y videos de Pexels (§4.1), atajos y exportar el rango I/O (§10.1). Trae debajo la tanda 3 |

La rama designada de la sesión, `claude/magical-tesla-t2stbc`, sigue la última punta.

## Lo hecho

### Tanda 1 — la edición automática, arreglada (§2.2)
- Un video sin muletillas ya no termina como «1 no pudo» (`NO_HAY_MULETILLAS`, una constante para los dos archivos).
- El volumen a −14 LUFS se mide por toma, no por pedazo (`normalizarJuntos`).
- «Detener» ya no es una falla; si los subtítulos fallan, el B-roll no vuelve a transcribir; sin Pexels no se gasta la IA.
- «Deshacer todo» ve los atajos aunque el foco esté afuera; reproducir no lo saca. La pastilla dice qué agente trabaja. «Lima» en minúsculas.
- Revisión adversarial de un lector que no escribió el código: 7 hallazgos, los 7 arreglados en `101042780`.
- Tests: `tests/video-editor-enjambre.test.ts`, casos 15 a 20.
- **No arreglado:** los casos 7, 8, 10 y 13 de ese test siguen leyendo el fuente (§2.2, último punto).

### Tanda 2 — subtítulos de Submagic (§1)
- `docs/editor-video/relevo-submagic.md`: lo que publica Submagic (sitio, blog, documentación) y lo que no; la app pide cuenta.
- «Animación de la palabra»: «Salta» (pop de abajo hacia arriba) y «Crece», con o sin karaoke. «Tamaño de las palabras clave» (100-160 %).
- Marcar o desmarcar a mano una palabra clave en el panel del subtítulo; por chat, «sumar» y «quitar».
- Plantillas «Hormozi» y «Hormozi clásico».
- «Emojis automáticos»: el interruptor al generar ya anda, la sección «Emojis» en la pestaña Subtítulos, sin IA.
- Por chat: `animar_palabras`, `palabras_clave` (con `tamano`, `sumar`, `quitar`), `emojis_subtitulos`. Por la API de MaKo:
  `animar_palabras_video`, `poner_emojis_subtitulos`, y los presets con `animacion_palabra` y `tamano_claves`.
- Tests: `tests/video-editor-subtitulos-submagic.test.ts` (21 casos, con sus roturas al final).
- Revisión adversarial (render real con node-canvas): la palabra que crece pisaba a las vecinas («HOYDINEROYA») y los
  emojis no seguían a su subtítulo. Arreglado en `39abf3f61`: el renglón reserva el lugar (en la medición) y
  `sincronizarEmojis` corre en `timeline.updateTracks`. Más: pista oculta o bloqueada, emoji dentro del cuadro,
  subtítulos cortos, falsos positivos del diccionario, la vista compacta del chat.
- **No hecho:** el subtítulo escalonado (§1.6): no hay descripción en el repo de cómo se ve el «Stagger Stack» y copiarlo de memoria es
  diseñarlo; hace falta mirar el reel (`origin/referencias/reels-0911:edicion-mako.mp4`).

### Tanda 3 — motion graphics (§3.1)
- Portado por un agente en el worktree `.claude/worktrees/agent-a44eb269e818a7999`, rama `worktree-agent-a44eb269e818a7999`, 3 commits:
  `4ce9c4983` (el motor `lib/motion/` y `LICENSE-IART`), `10fad3f61` (el elemento del editor), `b621ac894` (chat y API).
- Arreglados: la cifra 4,5 se ve «4,5» (paso de 0,01, coma decimal; lo que no entra se rechaza con su motivo) y el test M10 (se arregló
  el catálogo, no el test).
- Revisión adversarial: 11 hallazgos, 10 arreglados (`cc85b23c4`, `bb4930f5c`): un solo lector de números («1.250» se
  leía 1,25), la pestaña valida al salir del campo y un vacío no se llena con el ejemplo, las barras se validan, la
  escena dura lo que el clip, las cajas crecen con los renglones, el aviso BSD de WebKit, «motion» nombra el área video
  en el chat de la app (salvo con una landing o una web).
- **Decisión para Martín:** dividir un motion repite la entrada en la mitad derecha (copiar CapCut con `trimStart` le
  cortaría la entrada a quien acorta el clip por el borde izquierdo).

## Lo que falta probar en la PC (Chrome, ws9 o ws3; NUNCA ws1)

En el Chrome de Martín, en el negocio de MaKo (ws9) o en el Cliente de Prueba (ws3). **Nunca en el ws1** (Mauricio, un cliente real):
el editor escribe preferencias y presets en el negocio. Con un video de prueba de 30-60 s con voz.

1. **Edición automática** (tanda 1):
   - En un video grabado con guion (sin muletillas), correrla: el resumen NO dice «1 no pudo».
   - Con pausas largas: después de correrla, escuchar dos frases seguidas de la misma toma: mismo volumen.
   - Apretar «Detener» mientras transcribe: no aparece «Reportar a Soporte».
   - Sin Pexels conectado: el paso del B-roll dice que falta Pexels y no gasta la IA (mirar Uso).
   - Apretar «Reproducir» al final: «Deshacer todo» sigue ofrecido. Mover un clip con el teclado con el foco en la barra: ya no se ofrece.
   - La pastilla arriba dice «en vivo · <agente> · paso N de 10».
2. **Subtítulos de Submagic** (tanda 2):
   - Generar subtítulos; en la pestaña Subtítulos del inspector, «Animaciones de subtítulos»: elegir «Salta» y reproducir. La palabra
     que se dice entra de abajo, crece y se asienta. Mirar que no tiemble ni tape a las vecinas.
   - Lo mismo con «Crece», con y sin «Subtítulos pronunciados» en «Palabra».
   - Plantillas › «Hormozi»: Anton en mayúsculas, contorno amarillo, la palabra salta; después «Clásico»: la palabra deja de saltar.
   - «Palabras clave»: prender, subir «Tamaño» a 140 %; tocar una palabra del subtítulo elegido para marcarla y otra vez para
     desmarcarla; Ctrl+Z deshace cada toque.
   - «Emojis»: prender la casilla; aparece la pista «Emojis» arriba, un emoji sobre los subtítulos que lo piden, con rebote, sin dos
     iguales seguidos. Poner un sticker propio, apagar la casilla: se van los emojis y el sticker propio queda.
   - En Subtítulos automáticos (Multimedia), prender «Emojis automáticos» y generar: salen solos.
   - Chat del editor: «haz que la palabra salte como Hormozi», «pon emojis en los subtítulos», «agranda las palabras clave»,
     «saca la palabra gratis de las claves»: cada uno propone y «Aceptar» lo aplica en un paso.
   - Exportar el video: la animación y los emojis salen en el MP4.
3. **Motion graphics** (tanda 3): Biblioteca › Plantillas › Motion: agregar cada una de las 9, cambiar el tono y el formato; la cifra con
   «4,5». Por chat: «agrega un contador que diga 4,5 estrellas».

## Para el que siga

- Tanda 4 (B-roll con videos de Pexels y «Cambiar por otra» §4.1, clips mágicos §5.1, ruido en un worker §7.2, lo que el chat no sabe
  §9.1) y lo que se pueda de §6, §8.2 y §10 sin navegador.
- Al sacar un veredicto en un worktree, que ese worktree tenga su `node_modules` propio (ver «⚠️ El `npm ci` del veredicto…» en
  `docs/hallazgos-video-editor.md`).
