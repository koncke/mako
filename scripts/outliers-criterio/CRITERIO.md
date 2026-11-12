# Criterio para clasificar reels por su EDICIÓN (primera pasada: por la portada)

Para qué: la portada de la tab Video de MaKo («Encuentra tu siguiente OUTLIER») tiene que mostrar SÓLO los reels que enseñan un
patrón de EDICIÓN que se pueda copiar (cortes, texto en pantalla y tipografía, B-roll, zooms, transiciones, ritmo). El dueño lo
dijo así: «no debería tener reels random al azar… lo que queremos es poder replicar ciertos patrones de edición. Hay algunos que no
son necesarios, por ejemplo hablando a cámara nada más o sentados tipo podcast: no tienen mucha edición (alguno sí, por un estilo
de tipografía o de texto, pero la mayoría no)».

Esta pasada mira la PORTADA (el primer cuadro que muestra Instagram) y el texto del posteo. No se ve el movimiento: lo que no se
pueda decidir con la portada es «dudoso» y va a una segunda pasada con el video. No inventes lo que no se ve.

Cada hoja es una imagen con 24 portadas numeradas (el número amarillo arriba a la izquierda) y un .txt al lado con, por número:
la cuenta, la fecha, vistas y me gusta, y el comienzo del texto del posteo. Un recuadro gris liso es una portada que no se pudo bajar.

## Por cada reel, estos campos

- `n`: el número de la hoja.
- `formato` (uno):
  - `podcast`: dos o más personas sentadas conversando con micrófonos, entrevista, o una persona con micrófono de estudio.
  - `a-camara`: una persona hablando a cámara (selfie, plano medio, caminando), SIN texto diseñado encima (a lo sumo subtítulos simples).
  - `a-camara-texto`: una persona a cámara CON texto diseñado encima (título con tipografía elegida, palabra resaltada, cajas, colores).
  - `escenario`: charla en un escenario, evento, público.
  - `texto-protagonista`: el texto ES la pieza (una frase o cita con tipografía grande sobre un fondo o una imagen); la persona no está o es secundaria.
  - `broll-estetico`: planos estéticos (naturaleza, objetos, manos, ciudad, lifestyle), sin alguien hablando a cámara.
  - `actuado`: sketch, escena actuada, dos personajes, humor, POV.
  - `tutorial`: pantalla grabada, paso a paso, demostración de una herramienta.
  - `producto`: el producto es el protagonista.
  - `otro`.
- `texto`: `ninguno` | `subtitulos-simples` | `subtitulos-estilizados` (palabra resaltada, color, caja) | `titulo-disenado`
  (tipografía elegida, jerarquía, mezcla serif + sans) | `texto-protagonista`.
- `senales`: lista (puede ir vacía) de lo que se VE en la portada: `mezcla-tipografias`, `palabra-resaltada`, `caja-texto`,
  `gran-titulo`, `texto-detras-del-sujeto`, `b-roll`, `pantalla-dividida`, `collage`, `encuadre-cerrado`, `fondo-recortado`,
  `grafico-o-emoji`, `desenfoque-o-movimiento`, `blanco-y-negro`, `color-graduado`.
- `veredicto` (uno):
  - `patron`: enseña algo de edición que se puede copiar (un texto diseñado, una tipografía con estilo, B-roll, collage, recorte,
    un efecto), AUNQUE haya una persona a cámara.
  - `descartar`: podcast o entrevista sentados, o una persona a cámara o en un escenario SIN texto diseñado ni otra señal de edición:
    lo que se ve es sólo alguien hablando.
  - `dudoso`: la portada no alcanza para decidir (a cámara con subtítulos simples, una portada oscura o ambigua, algo que puede tener
    edición adentro). Usalo con honestidad, no como comodín: si se ve claro, decidí.
- `patron`: si es `patron`, el patrón en 2 a 6 palabras, concreto y reutilizable («título serif + sans sobre B-roll», «palabra roja
  detrás del sujeto», «cita en serif sobre fondo liso»). Si no, null.
- `motivo`: una frase corta (máx. 15 palabras) de por qué ese veredicto, con lo que se ve.

Escribí en español rioplatense neutro, sin inventar: si no se ve, no lo pongas.
