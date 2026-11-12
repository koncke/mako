# El juez: revisar la clasificación por edición, reel por reel

Sos el juez de una primera pasada que hizo OTRO clasificador mirando la portada de cada reel. Tu trabajo es verificar cada
veredicto contra la imagen y el texto, corregir lo que esté mal y ponerle a cada patrón su FAMILIA de una lista cerrada. Leé antes
CRITERIO.md (lo que se le pidió al clasificador): vale todo lo que dice, más lo de abajo.

## Más estricto que el clasificador

El clasificador fue generoso: marcó «patron» a casi cualquier portada con un título encima. El dueño dijo: «hablando a cámara nada
más o sentados tipo podcast no tienen mucha edición (alguno sí, por un estilo de tipografía o de texto, pero la mayoría no)». Así:

- Una persona a cámara, en un escenario o un podcast con UN título común encima (una sola tipografía, sin tratamiento) NO es
  «patron»: es «dudoso» (puede tener edición adentro: se decide con el video) o «descartar» si es claramente sólo hablar.
- Es «patron» cuando el TRATAMIENTO del texto o de la imagen es distintivo y se puede copiar: caja de color, mezcla serif + sans o
  cursiva, palabra resaltada en otro color o con marcador, texto detrás del sujeto, pantalla dividida, tarjeta tipo tweet, B-roll
  con título, ilustración o gráfico, etiquetas de contraste, una plantilla de serie reconocible, subtítulos con estilo propio.
- Podcast o entrevista: «patron» SÓLO si tiene un texto con estilo (cita en caja, pregunta en caja, cifra grande). Si no, «descartar».
- Una portada gris lisa (no se pudo bajar) es «dudoso».

## Las familias (elegí UNA para cada «patron»; para lo demás, null)

| familia | qué es |
|---|---|
| `titulo-en-caja` | título en una caja (blanca o de color) sobre la persona |
| `mezcla-tipografias` | título que mezcla serif o cursiva con sans, a menudo con una palabra en color |
| `palabra-resaltada` | una palabra clave resaltada: caja amarilla, color, subrayado de marcador |
| `texto-detras-del-sujeto` | texto gigante detrás de la persona (la persona recortada delante) |
| `pantalla-dividida` | pantalla partida: orador + rótulo, cita, público u otra toma |
| `cita-sobre-podcast` | clip de podcast o entrevista con la cita, pregunta o cifra en una caja encima |
| `tarjeta-tweet` | un tweet o posteo como tarjeta sobre la imagen |
| `titulo-sobre-broll` | título sobre planos estéticos o B-roll, sin alguien hablando a cámara |
| `frase-protagonista` | la frase es la pieza: tipografía grande sobre fondo liso o una imagen |
| `ilustracion-o-grafico` | ilustración, gráfico, animación, collage de recortes |
| `etiquetas-de-contraste` | etiquetas que contrastan (novato / experto, antes / después, versus) |
| `serie-con-plantilla` | serie reconocible: número de capítulo, logo + título fijo, «Consejo 3/25» |
| `subtitulos-con-estilo` | los subtítulos son el estilo: serif amarilla, cursiva, palabra en color |
| `blanco-y-negro-o-color` | tratamiento de color (blanco y negro, graduado fuerte) con texto |
| `actuado-con-rotulos` | sketch o escena actuada con rótulos (POV, personajes con nombre) |
| `cifra-gancho` | una cifra grande como gancho |

## Qué escribir

Para TODOS los números de tus hojas (no sólo los que corregís), un objeto:
`{"n":number,"de_acuerdo":boolean,"veredicto":"patron"|"descartar"|"dudoso","familia":string|null,"patron":string|null,"motivo":string}`
- `de_acuerdo`: true si el veredicto del clasificador queda igual.
- `veredicto`, `patron`, `motivo`: los FINALES (si estás de acuerdo, podés copiar los suyos o mejorarlos).
- `familia`: de la tabla, sólo si el veredicto final es «patron».
- `motivo`: una frase corta (máx. 15 palabras) con lo que se ve. En español.
