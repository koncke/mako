# Plantilla «Mensaje para…»: el proceso de punta a punta (reel de mentores, 9/11/2026)

El primer reel hecho entero copiando un reel que funciona (el de Josep / Tacho, `instagram.com/reel/DdTdIIPDzHU`). Esto es
lo que MaKo tiene que poder guiar al usuario, paso por paso, dentro de la tab Video. Las reglas y las trampas, con su porqué,
están en `docs/manual-video-mako.md` (§6.5 Flow, §8.3 edición, tabla de errores) y en `docs/hallazgos-video-editor.md` →
«Cortar al ritmo de una referencia». El relevo con cada archivo: `docs/relevo/reel-mentores-high-ticket.md`.

## Los pasos

1. **La referencia (el outlier).** Se baja el reel (`yt-dlp`), se desarma en tomas (ffmpeg `select='gt(scene,0.3)'`),
   se transcribe (ElevenLabs scribe, `scripts/palabras.mjs`) y se mide su gramática: cuánto dura cada tramo hablado,
   palabras/s, dónde entra la música y dónde corta (`mediciones/ritmo-josep.json`, `ritmo-habla.json`). La canción se
   identifica con Shazam en los tramos SIN voz (`mediciones/cancion-shazam.json`: «WE ON GO», BIA).
2. **El guion**, con la estructura de la referencia (6 bloques: disparo, credencial, producto, beneficio, remate, cierre
   mudo). El usuario pone su texto; la estructura no se toca.
3. **El personaje.** La base de TODA imagen es la foto/personaje aprobado del usuario (acá `personaje-bueno-original`).
   Nunca una toma derivada. Una edición por vez, «tal cual pero X», con UNA referencia y una frase corta.
4. **El fondo** se termina solo al 100 % (el corcho con las caricaturas) y recién después entra la persona.
5. **Los clips hablados** (Google Flow, Omni 1.2 Flash, 720p, 9:16): imagen primero, OK del usuario, UN video. La duración
   sale de contar palabras (`0,8 + palabras/ritmo + 0,3` s). Se transcribe y se compara con el guion (`chequear-guion.mjs`).
6. **La voz:** voice-to-voice con el clon del usuario (`scripts/poner-voz-wavnivel.sh`), loudnorm −14.
7. **Las tomas blancas** (los insertos a contraluz): desde el personaje → «sin la foto, sobre fondo blanco» → la pose →
   la luz copiada de una toma YA aprobada («Copiá SÓLO la luz y la exposición…»). Con un cuadro de otra persona, Flow
   reemplaza la imagen entera o le copia la ropa. Un objeto de la marca (el abanico de polaroids, `scripts/abanico.py`)
   se arma a mano y se pasa como referencia.
8. **El montaje** (`scripts/montar.mjs`, se vuelve a correr en ~35 s cada vez que cambia algo):
   - voz seca, sin música debajo, acelerada 1,10 con `atempo` (conserva el tono);
   - 5 golpes de la canción, uno al cerrar cada bloque, con su toma blanca y la palabra roja en el cuadro del corte, el
     sujeto delante del texto (máscara);
   - animaciones sin voz aceleradas; UN efecto de sonido (el humo al irse), nada más;
   - subtítulos de 2-3 palabras justo debajo del mentón, medido por clip;
   - cierre mudo de 10 s con la canción desde su 0:00 y los dos carteles (CTA y oferta), legibles.
9. **La verificación:** transcribir el reel entero, contar los silencios (ninguno > 0,55 s en lo hablado) y los golpes,
   mirar los cortes cuadro por cuadro. Agentes independientes encontraron lo que se le escapó al montaje (v2 → v3).
10. **La entrega:** con la música y SIN música (para ponerle la canción desde Instagram).

## Las piezas reutilizables (para cualquier plantilla)

| Pieza | Qué es | Dónde está la regla |
|---|---|---|
| Personaje | la foto/personaje aprobado del usuario, base de todo | manual §5, memoria `referencia-personaje-siempre-la-misma` |
| Fondo | se termina solo, después entra la persona | manual §4 «una cosa al 100 %» |
| Voz | clon de ElevenLabs, voice-to-voice | manual §6.4 |
| Tomas blancas | insertos a contraluz con la palabra roja | este archivo, paso 7 |
| Música | la de la referencia (o una pista de ElevenLabs Music), golpes donde los pone la referencia | manual §8.3 |
| Subtítulos | 2-3 palabras, bajo el mentón | manual §8.3 |
| Efectos | de a uno, sólo donde suman | memoria `efectos-con-moderacion` |

Lo que el usuario veía como fricción (y la tab Video tiene que resolver): elegir la base correcta, pasar la luz, cuántos
golpes poner, dónde van los subtítulos. Fueron siete versiones del montaje para llegar acá; cada una está en el relevo.
