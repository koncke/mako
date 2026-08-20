// Lo que comparten los scripts del pipeline de cursos.
//
// ⚠️ Existe porque `esIntermedio` estaba COPIADO en tres archivos —`curso-a-drive.mjs`,
// `curso-audio.mjs` y `curso-organizar.mjs`— con el mismo bug en los tres. Es la regla
// de AGENTS.md «una cosa, un lugar»: la copia no divergió, pero arreglarla exigía
// acordarse de los tres, y el que se olvidara habría dejado el bug vivo en su camino.

import { basename } from 'node:path';

const EXT_VIDEO = /^(mp4|mkv|webm|m4v)$/i;

/**
 * ¿Es un archivo INTERMEDIO de yt-dlp (`…​.f614.mp4`, `…​.fhls-fastly_skyfire-audio.mp4`)?
 *
 * Hay que excluirlos porque la copia incremental corre MIENTRAS el descargador escribe:
 * captura sus transitorios, y cuando yt-dlp los mergea y borra en local, las copias del
 * destino SOBREVIVEN. Así se subieron a Drive tres intermedios de 500 MB con la pista de
 * video y sin audio.
 *
 * ⚠️ La versión anterior era `/\.f[^.]*\.(mp4|mkv|webm|m4v)$/i` y el problema estaba en la
 * bandera **`i`**: hacía que CUALQUIER título que después de un punto empezara con «F» se
 * tomara por intermedio. En «Bigseo Academy» eso escondió cuatro clases —«09.Funciones del
 * Keyword Planner», «07.Formatos para Contenidos», «02.Funciones», «02.Funcionamiento de
 * los datos estructurados»— y ninguna llegó a Drive. El síntoma era «no está bajado
 * todavía» sobre archivos que estaban en disco, con el nombre exacto que se esperaba.
 *
 * La distinción real: yt-dlp escribe `f` **minúscula** seguida de un id de formato, que es
 * numérico (`f614`) o un protocolo (`fhls-…`, `fdash-…`, `fhttp…`). Un título humano no
 * tiene esa forma. Por eso la comparación es sensible a mayúsculas y exige la forma del id
 * en vez de aceptar cualquier cosa después de la `f`.
 */
export const esIntermedio = (ruta) => {
  const b = basename(String(ruta));
  // ⚠️ `<clase>.temp.mp4` TAMBIÉN es un intermedio, y es el que más engaña: es el
  // archivo donde yt-dlp UNE video y audio cuando la calidad alta viene en pistas
  // separadas, así que crece hasta pesar casi lo mismo que el final y tiene la
  // extensión del final. Faltaba acá, y el efecto se vio en dos lados a la vez con la
  // clase 11 de «Trilogía de BRIAN TRACY» (4,6 GB de video + 955 MB de audio):
  // `curso-audio.mjs` intentó convertir el merge a medio hacer y falló, y el contador
  // de `curso-pipeline.mjs` lo contó como clase terminada —11/11— y dio la descarga
  // por cerrada con ffmpeg escribiendo a 253 MB cada 15 s.
  const t = /\.temp\.([A-Za-z0-9]{2,4})$/.exec(b);
  if (t && EXT_VIDEO.test(t[1])) return true;
  const m = /\.f([^.]*)\.([A-Za-z0-9]{2,4})$/.exec(b);
  if (!m || !EXT_VIDEO.test(m[2])) return false;
  return /^(\d|hls[-_.]|dash[-_.]|http)/.test(m[1]);
};

/** El número de clase que abre el nombre del archivo: «068 - 1.Fast M5-95.mp4» → 68. */
export const nDeArchivo = (f) => {
  const m = /^(\d{1,3})\s*-\s*/.exec(basename(String(f)));
  return m ? Number(m[1]) : null;
};

/**
 * ¿Es basura del Finder de macOS y no material del curso?
 *
 * Cuando alguien sube una carpeta desde una Mac, el Finder mete un hermano `._<nombre>`
 * por cada archivo —el resource fork, «AppleDouble»— que pesa ~1,8 KB y no abre con
 * nada. La plataforma los ingirió como recursos más, así que la API los declara igual
 * que a los buenos: mismo `file_type`, mismo módulo, su propio `file_size`.
 *
 * En «Programa RAIO» son CIEN de los 283. Publicados, serían cien filas en «Recursos»
 * que al hacer clic no muestran nada.
 *
 * ⚠️ VIVE ACÁ Y NO EN EL BAJADOR PORQUE LO NECESITAN TRES. El filtro nació adentro de
 * `curso-recursos-vip.mjs` y ese mismo día `curso-recursos-todos.mjs` y
 * `curso-faltantes.mjs` empezaron a mentir: siguen contando los `._` como «lo que la
 * fuente tiene», así que RAIO quedó con «80 faltan» PERMANENTE —un lote de cuatro pasos
 * que vuelve a bajar, subir, esperar ids y republicar 183 recursos para terminar donde
 * estaba— y el informe que mira el dueño lo afirmaba bajo el rótulo «y acá el número SÍ
 * es duro». Un cambio de política que solo se aplica en un extremo de la cadena no es un
 * filtro: es una discrepancia.
 */
export const esFinderJunk = (titulo) => {
  const t = String(titulo ?? '').trim();
  return /^\._/.test(t) || /^\.DS_Store$/i.test(t);
};
