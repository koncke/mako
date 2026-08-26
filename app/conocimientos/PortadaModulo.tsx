/**
 * PortadaModulo — la tapa de un modulo DIBUJADA, para los 369 que no tienen .webp.
 *
 * AvatarHype tiene cinco laminas reales (public/cono-ugc/m1..m5.webp): hoja de cuaderno,
 * espiral, numero gigante hueco, MODULO en versalitas y el titulo sobre un brochazo lima.
 * Los otros 369 modulos (374 en total, 37 cursos) caian al degrade oscuro con el chip.
 * Esto replica ese lenguaje a partir de dos datos —el numero y el titulo— sin generar un
 * solo archivo.
 *
 * ⚠️ LA APUESTA, y gobierna cada decision de abajo: esto NO es la referencia achicada.
 * Los .webp miden 1280x715 y la tarjeta se dibuja a ~296x166 css px — una reduccion de
 * 4,4x. A esa escala los doodles ilustrados (el libro, el microfono, la claqueta, el
 * plano con compas) miden 17-30 px con trazo de 1 px: no son un microfono, son una
 * mancha gris que compite con el titulo. Lo que sobrevive al achique es lo MACIZO y lo
 * de alto contraste: el espiral, el numero hueco, el brochazo, el sticker.
 *
 * ── LO QUE CAMBIO EN LA v2, y por que ──────────────────────────────────────────────
 *
 * 1. EL NUMERO ES UN ALFABETO PROPIO, AHUECADO CON UNA <mask> (ver GLIFOS/AVANCE/EJE).
 *    Antes era `<text stroke>` con la familia Archivo, y eso tenia dos fallas medidas:
 *    (a) la pieza que DOMINA la tarjeta colgaba de que Google Fonts hubiera aterrizado,
 *        y la hoja del origen se inyecta en RUNTIME y adentro hace otro @import: la
 *        ventana sin Archivo no es teorica.
 *    (b) el trazo salia de grosor CONSTANTE, y en m1 el contorno del «0» medido a tres
 *        alturas da 4,1 / 4,2 / 1,1 unidades — un marcador varia, una tipografia no.
 *    Ademas el hueco ahora es TRANSPARENCIA y no papel pintado: en m1 la cuadricula se
 *    ve adentro del cero, y rellenar con `PAPEL` mentiria el dia que el fondo cambie.
 *
 * 2. EL REPARTO VERTICAL ES UNA CADENA DE RESTAS, no una tabla de escalones.
 *    `tituloTop = BASE_TITULO - alto` → `numeroPie = tituloTop - HUECO_KICKER` →
 *    `numAlto = clamp(numeroPie - NUM_TOP)`, y `ALTO_TITULO_MAX` sale DERIVADO del piso
 *    del numero. El alto del numero aterriza donde tiene que aterrizar sin que nadie
 *    elija ese numero, y no hay «modo corto»/«modo largo» que se desincronicen.
 *
 * TRES COSAS QUE NO SON DE ESTILO Y HAY QUE MANTENER:
 *
 * 1. LOS `id` SON UNICOS POR INSTANCIA, Y NO SALEN DE UN HOOK. Los id de un SVG son
 *    GLOBALES al documento: con hasta 47 tarjetas en pantalla, 47 `url(#hueco)` resuelven
 *    todos contra el PRIMERO y las mascaras se pisan — sin error, sin log y sin mas
 *    sintoma que «se ven raras». El sufijo sale del hash de `${n}\0${titulo}` y NO de
 *    `useId()`, que obligaria a `'use client'` (los hooks no corren en un server
 *    component) y le sacaria a este archivo la propiedad de servir de las dos puntas.
 *    Es unico porque `grupo` es la CLAVE de un Map en CursoReplica —dos modulos del
 *    mismo curso no pueden tener el mismo nombre— y ademas degrada solo: repetir el id
 *    exige mismo `n` Y mismo titulo, o sea que las dos mascaras dibujarian exactamente
 *    los mismos digitos y no se veria nada raro.
 *    VERIFICADO sobre los 374 modulos de los 37 cursos, todos en la MISMA pagina (un caso
 *    que en produccion no existe: el rail dibuja un curso por vez): 373 ids distintos y
 *    UN repetido, `pm1qwaw45`, que son «construir-app / 1 / Onboarding» y
 *    «creativos-ugc-realistas / 1 / Onboarding» — la misma entrada, no una colision de
 *    hash. Las dos laminas dibujan el mismo «01» con la misma deriva.
 *
 * 2. NO HAY FILTROS SVG. feTurbulence + feDisplacementMap es la forma obvia de hacer el
 *    trazo irregular del marcador y es la trampa: rasteriza, en Safari lo deja borroso a
 *    baja resolucion, y se paga por tarjeta en cada scroll. La irregularidad va por
 *    GEOMETRIA: el marcador pasa DOS veces, la segunda corrida un pelo por el hash.
 *
 * 3. NO HAY `Math.random()` NI `Date`. Este componente lo renderiza tambien el server
 *    (CursoReplica es 'use client', pero Next lo pinta igual del lado del server), asi
 *    que cualquier fuente de variacion que no sea pura da mismatch de hidratacion. Todo
 *    lo decorativo cuelga de un FNV-1a entero sobre `${n}|${titulo limpio}`.
 *
 * Y una regla que no se puede romper: LA VARIACION NO CODIFICA NADA. Ni el giro del
 * sticker, ni cuantos destellos, ni la fase del espiral significan algo sobre el modulo.
 *
 * ⚠️ EL TONO NO SE ARREGLA ACA, Y ES LO QUE MAS SE VE. Una tapa real pasa por
 * `filter: saturate(.8) brightness(.92)` (regla `.ugc-modcard-cover img`) mas el `.shade`
 * que va de 12% a 55% de negro. Medido con PIL sobre el banco de comparacion, el papel
 * DENTRO de la tarjeta:
 *
 *      referencia (m1..m5) .... (190,188,180) arriba · (159,158,151) medio · (124,123,115) abajo
 *      esta lamina CRUDA ...... (244,243,231) plano, en las tres alturas
 *      esta lamina EN PRODUCCION (189,188,181) · (159,158,151) · (123,122,115)
 *
 * O sea: cruda esta 55 / 85 / 120 niveles por encima, y con el pipeline puesto queda a
 * uno o dos niveles de la referencia. La salida es colgarse del MISMO pipeline, no
 * imitarlo: la lamina va adentro de `.ugc-modcard-cover` ANTES de `.shade` (con eso
 * hereda el degrade gratis) y UNA regla de CSS le da el mismo `filter` que a un `<img>`,
 * porque aquella es un selector de ELEMENTO y un <svg> no matchea `img`.
 * NO se compensa con colores mas oscuros aca adentro: eso seria la misma regla escrita en
 * dos lugares, y el dia que el shade cambie esta lamina queda sola y equivocada.
 * Importa en un caso real: AvatarHype tiene 6 modulos, 5 con .webp y el 6 sin archivo,
 * asi que su grilla quedaria con 5 tarjetas apagadas y 1 brillante.
 *
 * No lleva `'use client'` a proposito: es una funcion pura sin hooks ni estado, asi que
 * sirve igual desde un server component. Cuando la importa CursoReplica (que si es
 * cliente) viaja al bundle como parte de el, y no arrastra nada: no importa ningun
 * catalogo — la frontera de DATOS de AGENTS.md se respeta por no tener imports.
 */

/* ─────────────────────────── paleta ───────────────────────────
   Medida con PIL sobre las cinco referencias, salvo donde se anota. */

/**
 * El crema del papel. Se EXPORTA porque CursoReplica lo necesita para el fondo de la
 * caja mientras la lamina no pinto: tenerlo escrito a mano alla («#F4F3E7») era la misma
 * constante en dos archivos, o sea el segundo quedandose viejo.
 */
export const PAPEL = '#F4F3E7'; // medido rgb(246,244,232) / rgb(245,243,230)
const TINTA = '#16150F';        // es --u-ink de ugc.css: no se inventa un negro nuevo
const MARGEN = '#BE6560';       // rojo apagado, casi rosa: rgb(184,107,99) en m1
const ESPIRAL_BANDA = '#EBE8DB';
const ESPIRAL_CANTO = '#CFC9B6';
const ANILLO = '#2E2A1F';       // el 10% mas oscuro de la banda: rgb(39,30,18) en m2
const ANILLO_LUZ = '#F2EEE2';
const LIMA_BROCHA = '#DCF35F';  // promedio del brochazo: rgb(216,243,78)
const LIMA_STICKER = '#D5F240'; // medido en m3: rgb(213,242,64)

/**
 * ⚠️ El canto de la hoja es una ESCALERA DE CUATRO COLORES PLANOS, no un rectangulo
 * translucido. El de la v1 daba, en su pixel mas oscuro, rgb(237,234,220): a media altura
 * de m1 el canto real llega a rgb(164,150,127) — 70 niveles de diferencia, o sea que en
 * la tarjeta la hoja no tenia canto. Los cuatro valores estan medidos sobre el perfil de
 * m1 (lum 244 → 221 → 192 → 165 entre x=0,92 y x=0,97 del ancho).
 *
 * Va en colores planos y no en un `<linearGradient>` aunque ahora SI se puedan tener id:
 * un def mas es un def mas que mantener por tarjeta, y a 296 px de ancho el salto entre
 * cuatro bandas de 10/5/3/2 unidades no se distingue de un degrade.
 */
const CANTO = ['#EAE4D4', '#DCD3BD', '#C5B89D', '#AE9C80'] as const;

/**
 * ⚠️ La grilla NO va con el color medido. El medido es rgb(202,204,193) —un gris calido—
 * y a 0,65 css px de trazo desaparece bajo el antialiasing: la hoja queda LISA y se
 * pierde la unica textura que dice «cuaderno». Va subida de contraste y tirada al azul.
 * Es un sacrificio consciente de fidelidad por legibilidad, anotado aca para que el
 * proximo que compare la lamina con el .webp no lo lea como un error de medicion.
 */
const GRILLA = '#C3D0DB';

/**
 * Archivo ya esta cargada: ugc.css:17 la importa de Google y la 1881 la pone como
 * font-family de todo el scope `.ugc`. La usan el KICKER y el TITULO. El NUMERO ya no:
 * tiene su propio alfabeto, justamente porque es la pieza que no puede depender de que
 * una hoja inyectada en runtime haya terminado su @import.
 */
const FAMILIA = "Archivo, 'Archivo Fallback', Arial, Helvetica, sans-serif";

/* ─────────────────────────── el lienzo ───────────────────────────
   320x180 = 16/9 exacto, que es el aspect-ratio de .ugc-modcard-cover (ugc.css:1977).
   La tarjeta mide 260-330 css px de ancho segun cuantas columnas entren, o sea que
   1 unidad ≈ 0,92 css px: casi 1:1. */
const W = 320;
const H = 180;

/** Ancho de la banda del encuadernado. Debajo del espiral no hay cuadricula. */
const ESPIRAL_W = 24;

/**
 * ⚠️ La linea roja. Estaba en x=38 —pegada al espiral— y esta MEDIDA por columna de
 * maxima rojez sobre las cinco referencias: m1 63,8 · m2 42,0 · m3 37,0 · m4 61,0 ·
 * m5 29,2 unidades. La dispersion es enorme porque cada .webp esta recortado distinto
 * (m5 es una foto de escritorio y su hoja arranca en x=46), asi que la mediana cruda
 * no dice nada. Lo que SI es estable es la distancia al ARRANQUE DE LA HOJA: 23-25 u en
 * m2, m3 y m4. Con la banda del espiral en 24, la linea cae en 47.
 */
const MARGEN_X = 47;
/** Donde arranca el canto: de ahi a 320 la hoja se dobla y no se dibuja nada mas. */
const CANTO_X = 306;

/* ── el reparto vertical ────────────────────────────────────────────────────────────
   LA REGLA, en una frase: el titulo se lleva de arriba lo que necesite para entrar
   legible, y el NUMERO ES LA VARIABLE DEPENDIENTE — se queda con todo el resto. */
const CAP = 0.73;             // alto de mayuscula / font-size, en Archivo 900
const INTER = 1.06;           // interlinea / font-size
const BASE_TITULO = 158;      // la ULTIMA baseline cae aca; el bloque crece hacia arriba
const KICKER_SOBRE_TIT = 9;   // del alto del titulo a la baseline de MODULO
const HUECO_KICKER = 25;      // del alto del titulo al PIE del numero
/** La tapa del numero. Medido sobre el .webp: 22,4 · 29,2 · 35,5 · 35,2 · 34,2 u; y sobre
 *  la tarjeta ya renderizada (que es lo que se ve): 23,8 · 30,1 · 36,8 · 39,9. */
const NUM_TOP = 30;
/**
 * Los topes del numero, en unidades del lienzo. Medidos con PIL sobre el bbox de tinta:
 * en el .webp crudo m1 0,568 H · m2 0,449 · m3 0,442 · m4 0,431 · m5 0,459; y sobre la
 * tarjeta renderizada 0,523 · 0,439 · 0,429 · 0,401. Mediana 0,44.
 *
 * ⚠️ Estos dos numeros NO se eligieron para que el numero mida 0,44: se eligieron para
 * que el clamp NO muerda con ningun titulo real, y el 0,44 lo produce la cadena de restas
 * sola. Es la unica forma de saber que la cadena esta calibrada y no que «quedo lindo» en
 * el caso que se probo. La primera pasada de la v2 daba mediana 0,49 —un 10% de mas— y lo
 * que se corrigio fue NUM_TOP y HUECO_KICKER, no el clamp.
 */
const NUM_ALTO_MAX = 88;      // 0,489 H
const NUM_ALTO_MIN = 52;      // 0,289 H
const NUM_ANCHO_MAX = 176;    // un «104» se aprieta, no desborda

/**
 * La caja del titulo, centrada en EJE. `EJE` esta MEDIDO y no elegido: el centro del
 * numero de las cinco referencias cae en 157,1 · 164,9 · 159,1 · 163,8 · 164,1 (media
 * 161,8) y el del titulo en 165,1 · 172,8 · 162,1 · 175,1 · 163,2. O sea que la
 * referencia esta CENTRADA, apenas corrida a la derecha por el espiral: no hay bloque
 * anclado a la izquierda que traer.
 */
const EJE = 178;              // el centro de la CAJA de arriba, no el del lienzo: el espiral se come 24 u a la izquierda
/**
 * ⚠️ La caja mide 178 y no 212 (v1) ni 196 (primera pasada de la v2), y es una CONCESION
 * MEDIDA, no una preferencia. La mancha del titulo de la referencia mide 147 · 198 · 202 ·
 * 140 · 146 unidades de ancho: los titulos cortos NO llenan la caja, se quedan en ~145. La
 * razon es que su tipografia es una condensada pesada y la nuestra (Archivo 900) es un 25%
 * mas ancha por caracter, asi que no se pueden igualar las dos cosas: o el alto de
 * mayuscula o el ancho de la mancha. Con la caja en 196 «Onboarding» salia ocupando 184 u
 * contra las 147 de m1, y eso —no el alto— era lo que rompia el parecido.
 */
/**
 * ⚠️ ACA HAY UNA ELECCION Y CONVIENE QUE SE VEA. La caja estuvo en 178 para que la MANCHA
 * del titulo midiera lo mismo que en la referencia (~145 u). El razonamiento era correcto
 * —su tipografia es una condensada pesada y Archivo 900 es ~25% mas ancha por caracter,
 * asi que no se pueden igualar el alto de mayuscula Y el ancho de la mancha— pero elegia
 * la mitad equivocada: igualaba la SILUETA y perdia la LEGIBILIDAD.
 *
 * Visto en el riel real, al lado de las cinco tapas de AvatarHype, «Creativos Animados»
 * salia a menos de la mitad del cuerpo de «Fundamentos del metodo». Y el titulo es la
 * carga util de la lamina: la tarjeta existe para que el modulo se lea de un golpe.
 *
 * Asi que se elige el ALTO. La caja va al maximo que el dibujo permite sin pisar nada, y
 * el limite lo fijan las dos lineas verticales de la hoja, no un gusto:
 *     margen rojo en 47 + los ~15 u que el brochazo se pasa por la izquierda  -> 62
 *     canto en 306   - los ~12 u que se pasa por la derecha                   -> 294
 * o sea 232 u de caja centrada en 178. Se deja 222 y el eje en 178: 5 u de aire de cada
 * lado. La mancha pasa a ser mas ancha que la de la referencia, y esta bien: aquella es
 * angosta por su tipografia, no porque alguien lo haya querido.
 */
const CAJA = 222;             // x 67..289: el brochazo despeja el margen rojo y el canto
/**
 * ⚠️ ESTE NUMERO ESTA MEDIDO, NO ELEGIDO — y era el que mas mentia. El ancho del titulo
 * se ESTIMA con la tabla de `anchoEm` (no se puede medir: esto corre tambien en el server
 * y medir 47 tarjetas en un efecto es un reflow por tarjeta), y `SEGURO` es el margen de
 * error que se le da a esa estimacion. Estaba en 0,94 —«asumo hasta un 6% de error»— y
 * corrido contra los 374 titulos reales, midiendo `getBBox()` en el navegador SIN Archivo
 * cargada, el ancho realizado dio 1,098 veces el objetivo en la mediana y 1,156 en el
 * peor caso: el margen real era del 16%, no del 6%.
 *
 * Con 0,86 la mancha del titulo aterriza en 168 u de mediana (la referencia mide 140 ·
 * 146 · 147 · 198 · 202, media 167) y en 177 en el peor caso, o sea justo adentro de la
 * caja. Es la diferencia entre una constante que describe el sistema y una que lo adorna.
 */
const SEGURO = 0.86;
const ANCHO_UTIL = CAJA * SEGURO;
const TIT_FS_MAX = 34;
const TIT_FS_PISO = 15;       // 13,9 css px de Archivo 900 sobre lima: el piso de lectura
const MAX_LINEAS = 4;

/**
 * Hasta aca puede trepar el titulo, y SALE DE LA CADENA en vez de ser un numero elegido:
 * es exactamente donde el numero ya no se puede achicar mas. Si alguien mueve NUM_TOP o
 * el piso del numero, esto se mueve solo — que es lo que una tabla de escalones no hace.
 */
const TITULO_TOP_MIN = NUM_TOP + NUM_ALTO_MIN + HUECO_KICKER;
const ALTO_TITULO_MAX = BASE_TITULO - TITULO_TOP_MIN;

/** El brochazo se pasa del texto, y mas por la izquierda. Medido (sobrante del brochazo
 *  respecto del texto): izquierda 8,8 · 16,2 · 15,0 · 27,2 · 15,2 u; derecha 20,2 · 4,5 ·
 *  12,5 · 4,2 · 43,0. Estos dos topes son la hoja, no el gusto: ninguno de los cinco
 *  brochazos CRUZA la linea roja (m3 es el que mas se acerca, y la despeja por 9 u). */
const BROCHA_MIN_X = 56;
const BROCHA_MAX_X = 290;

/* ─────────────────────────── hash ─────────────────────────── */

/** FNV-1a. Entero, sin flotantes, misma respuesta en el server y en el navegador. */
function h32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
/** Cada rasgo lee SUS bits: agregar uno no corre a los demas. */
const bits = (h: number, desde: number, cuantos: number) => (h >>> desde) & ((1 << cuantos) - 1);
const r2 = (v: number) => Math.round(v * 100) / 100;

/* ─────────────────────────── el titulo ─────────────────────────── */

/**
 * 154 de 374 titulos empiezan repitiendo lo que la lamina ya dice en versalitas y en
 * numero gigante: «Modulo 7 - », «Fase 1 - », «(02) », «013. », «M10 - », «Módulo 8_ ».
 * Comerlos baja la mediana de largo de 26 a 19 caracteres y el p90 de 42 a 36 — es la
 * palanca mas grande que hay y no cuesta un solo pixel.
 *
 * ⚠️ Y tapa una contradiccion que si no queda a la vista: el numero de la lamina es la
 * POSICION del modulo y 133 de los 214 titulos numerados dicen un numero DISTINTO — los
 * cursos que arrancan en «Modulo 00» corren toda la serie un lugar. El numero gigante
 * tiene que quedar como unica autoridad, porque ademas es el mismo que el chip
 * `.ugc-modcard-n` dibuja arriba a la izquierda: si la lamina dijera otro, la tarjeta se
 * contradice a si misma.
 *
 * ⚠️ La `m` suelta (para «M10 - Actualizaciones») EXIGE digitos. Sin eso se come la M de
 * «(2) Mindset» y lo deja en «indset» — una palabra plausible, que es por que este tipo
 * de falla no se ve probando tres ejemplos a mano.
 */
const PREF_NOMBRADO =
  /^\s*(?:m[oó]d(?:ulo)?|semana|clase|unidad|secci[oó]n|bloque|nivel|parte|fase|etapa|d[ií]a|paso|cap[ií]tulo|tema|lecci[oó]n|m)\s*#?\s*\d{1,3}(?:\.\d+)?\s*[_:.)–—-]*\s*/iu;
/** «(02) INTRO», «[3] Algo» — aca el separador es OPCIONAL: el parentesis ya separa. */
const PREF_PAREN = /^\s*[(\[]\s*\d{1,3}\s*[)\]]\s*[_:.–—-]*\s*/u;
/**
 * «013. STUDENT INTERVIEWS», «2 - Fundamentos». El numero SUELTO exige separador a
 * proposito: sin esa exigencia se come el 5 de «5 errores que te cuestan plata», que es
 * contenido y no un prefijo.
 */
const PREF_NUM_SEP = /^\s*\d{1,3}\s*[_:.)–—-]+\s*/u;
/**
 * El caso que a `PREF_NUM_SEP` se le escapa: «1 INTRODUCCIÓN», sin separador ninguno.
 * La condicion que lo separa de «5 errores que te cuestan plata» es la de la palabra
 * siguiente: un prefijo va delante de un TITULO (mayuscula), una cantidad va delante de
 * un sustantivo (minuscula). El `(?![\p{Ll}\d])` es lo que lo decide.
 *
 * ⚠️ Corrido contra los 374 grupos reales cambia CERO titulos —hoy no hay ninguno asi—,
 * y va igual: es la unica de las cuatro que no esta respaldada por datos, y por eso es la
 * unica escrita en NEGATIVO acotado (mira la clase de la letra que sigue) en vez de
 * confiar en un separador que puede no estar.
 */
const PREF_NUM_SUELTO = /^\s*\d{1,3}\s+(?![\p{Ll}\d])/u;

/**
 * El unico emoji de los 374 titulos («📊 Optimización de Perfil») y su compania. Una
 * sans no lo tiene: sale tofu, y justo en la primera posicion.
 *
 * ⚠️ VA CON ESCAPES `\u` Y NO CON LOS BYTES CRUDOS. La v1 tenia el selector de variacion
 * y el ZWJ escritos literales adentro de la clase: son caracteres INVISIBLES en el
 * fuente, y AGENTS.md tiene una seccion entera sobre eso — ripgrep declara el archivo
 * BINARIO y deja de devolver lineas, asi que el proximo que busque «PICTOGRAMAS» no
 * encuentra nada y cree que no existe.
 */
const PICTOGRAMAS = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

/** El literal que pone CursoReplica cuando una clase no trae `grupo`. No es un titulo:
 *  es la AUSENCIA de uno, y dibujarlo seria escribir «Sin modulo» en grande sobre el
 *  resaltador. Sin titulo la lamina es el numero solo, que no afirma nada falso. */
const SIN_MODULO = /^sin\s*m[oó]dulo$/iu;

function limpiarTitulo(crudo: string): string {
  // NFC antes de nada: hay tildes y ñ, y contar con .length sobre NFD da otro largo.
  const base = crudo.normalize('NFC').replace(PICTOGRAMAS, '').replace(/\s+/g, ' ').trim();
  if (!base || SIN_MODULO.test(base)) return '';

  // UNA sola pasada, anclada en ^: «Módulo 1 - Fase 1 - Nivel Inicial» tiene que quedar
  // «Fase 1 - Nivel Inicial», no «Nivel Inicial». El segundo nivel es contenido.
  let out = base;
  for (const re of [PREF_NOMBRADO, PREF_PAREN, PREF_NUM_SEP, PREF_NUM_SUELTO]) {
    if (re.test(out)) { out = out.replace(re, ''); break; }
  }
  out = out.replace(/[\s_:.)–—-]+$/u, '').replace(/\s+/g, ' ').trim();

  /**
   * ⚠️ SIETE TITULOS DEL CATALOGO **SON** SU PROPIO PREFIJO: «Día 1», «Día 2», «Día 3»,
   * «Parte 1»..«Parte 4». La v1 los RESTAURABA (`length < 3 ? base : out`) y ahi nacia el
   * peor defecto de la lista: «Parte 2» cae en la posicion 4, asi que la lamina dibujaba
   * «04» gigante y abajo «Parte 2» — dos numeros de la MISMA serie afirmando cual modulo
   * es, a la misma vista. No es un tema estetico: es una mentira en pantalla.
   *
   * Restaurar no era la salida y truncar tampoco: la salida es CALLARSE. El nombre real
   * del modulo esta escrito en texto de verdad 15 px mas abajo, en `.ugc-modcard-t`, asi
   * que la lamina sin titulo no pierde ni un dato — es la misma politica que `SIN_MODULO`.
   *
   * Un resto de UNA o DOS letras si se conserva: «Módulo 59 - IA» tiene que quedar «IA»,
   * que es contenido. La v1 lo perdia por el mismo `< 3`.
   */
  return out;
}

/* ── ancho estimado, en em ──
   No se mide texto: no hay DOM garantizado (esto tambien corre en el server) y medir 47
   tarjetas en un efecto seria un reflow por tarjeta. Los valores son de Archivo 900, que
   es pesada y ancha. Las mayusculas van a 0,68 — con eso los 54 titulos que vienen TODO
   EN MAYUSCULAS quedan contemplados solos, sin ningun factor aparte. */
const ANGOSTOS = "iljItfr.,;:!'’|()[]-–—·";
const ANCHOS = 'mwMW@%&';
const MAYUS_ACENTUADAS = 'ÁÉÍÓÚÜÑ';

function anchoEm(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (ch === ' ') w += 0.27;
    else if (ANGOSTOS.includes(ch)) w += 0.36;
    else if (ANCHOS.includes(ch)) w += 0.92;
    else if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || MAYUS_ACENTUADAS.includes(ch)) w += 0.68;
    else w += 0.58;
  }
  return w;
}

/**
 * Reparte `n` palabras en exactamente `L` renglones minimizando el mas ANCHO.
 *
 * ⚠️ El termino `0.18 * (max - min)` no es decoracion: sin el, el minimax puro produce
 * «Ventas / 247 - Automatizaciones y / Estrategias de Conversión» —una primera linea de
 * una palabra con dos llenas debajo—, que es el peor corte que sale del corpus.
 *
 * Fuerza bruta sobre los cortes. El titulo mas largo del catalogo tiene 12 palabras: con
 * L=4 son C(11,3)=165 combinaciones, o sea nada. No hace falta una DP.
 */
function repartir(palabras: string[], L: number): string[][] | null {
  const n = palabras.length;
  if (n < L) return null;
  if (L === 1) return [palabras];

  const pesos = palabras.map(anchoEm);
  const acc = [0];
  for (let i = 0; i < n; i++) acc.push(acc[i] + pesos[i]);
  const ancho = (i: number, j: number) => acc[j] - acc[i] + 0.27 * (j - i - 1);

  const cortes = new Array<number>(L + 1);
  cortes[0] = 0;
  cortes[L] = n;
  let mejor: string[][] | null = null;
  let mejorCosto = Infinity;

  const rec = (k: number) => {
    if (k === L) {
      let max = 0;
      let min = Infinity;
      for (let t = 0; t < L; t++) {
        const w = ancho(cortes[t], cortes[t + 1]);
        if (w > max) max = w;
        if (w < min) min = w;
      }
      const costo = max + 0.18 * (max - min);
      if (costo < mejorCosto) {
        mejorCosto = costo;
        mejor = Array.from({ length: L }, (_, t) => palabras.slice(cortes[t], cortes[t + 1]));
      }
      return;
    }
    for (let i = cortes[k - 1] + 1; i <= n - (L - k); i++) {
      cortes[k] = i;
      rec(k + 1);
    }
  };
  rec(1);
  return mejor;
}

type Caja = {
  lineas: string[];
  fs: number;
  tituloTop: number;
  kickerBase: number;
  numeroPie: number;
};

/**
 * EL AJUSTE, que es una regla y no una escalera de `if`:
 *
 *   el titulo usa la MENOR cantidad de renglones con la que su cuerpo no baja del piso de
 *   lectura; si ni con el maximo llega, se queda con el maximo y achica — pero NUNCA
 *   trunca.
 *
 * Lo de no truncar no es delicadeza: 60 de los 374 titulos miden exactamente 32
 * caracteres porque el pipeline de ingesta los corto («Modulo 25 - Mercado laboral del»,
 * «Sesiones Q&»). Un «…» encima corta lo ya cortado y hace pasar por decision de diseño
 * lo que es un bug de datos. Y se puede no truncar porque el titulo COMPLETO ya esta
 * escrito 15 px mas abajo, en `.ugc-modcard-t`: el de la lamina es un eco decorativo, y
 * el `<svg>` anidado lo recorta si la estimacion de ancho se equivoco.
 *
 * De ahi para abajo TODO es la cadena de restas, con el numero como variable dependiente.
 *
 * ── CORRIDO CONTRA LOS 374 `grupo` REALES, midiendo `getBBox()` en el navegador y SIN
 *    Archivo cargada (el peor caso, que es el que la estimacion tiene que sobrevivir):
 *
 *      renglones ............ 170 / 157 / 32 / 7   (1, 2, 3 y 4)
 *      truncados ............ 0
 *      desbordan la hoja .... 0   (el titulo va de x=76 a x=254; margen rojo 47, canto 306)
 *      mas anchos que CAJA .. 0   (mancha realizada: mediana 168,4 u, maxima 177,2)
 *      sin decoracion ....... 0
 *      sticker sobre el numero 0
 *      laminas mudas ........ 8   (los 7 titulos que SON su ordinal + «Sin modulo»)
 *      cuerpo del titulo .... 13,0 / 20,3 / 34,0   (min / mediana / max)
 *      ALTO DEL NUMERO / H .. mediana 0,420 · media 0,407 · max 0,490 · min 0,291
 *          y separado por renglones, que es lo unico comparable contra la referencia
 *          —sus cinco titulos son de UN renglon—:
 *            1 renglon (170): mediana 0,485      la referencia mide 0,401..0,523
 *            2 renglones (157): mediana 0,366
 *            3-4 renglones (39): 0,291, o sea el piso
 *          Un titulo largo le come el alto al numero, y esta bien: es la cadena
 *          funcionando. Pero deja 105 de 374 laminas con el numero MAS CHICO que
 *          cualquiera de las cinco referencias, y eso no tiene contraparte medida —
 *          ninguno de los cinco .webp tiene un titulo de dos renglones.
 */
function calcular(titulo: string): Caja {
  // Un separador suelto («Formación Nueva - Gestionando…») se pega a la palabra anterior:
  // si no, el reparto puede empezar un renglon con un guion huerfano.
  const palabras: string[] = [];
  for (const p of titulo.split(' ')) {
    if (!p) continue;
    if (/^[-–—|]$/u.test(p) && palabras.length) palabras[palabras.length - 1] += ' ' + p;
    else palabras.push(p);
  }

  let lineas: string[] = [];
  let fs = 0;
  for (let L = 1; L <= Math.min(MAX_LINEAS, palabras.length); L++) {
    const reparto = repartir(palabras, L);
    if (!reparto) break;
    lineas = reparto.map((ps) => ps.join(' '));
    const mayor = Math.max(...lineas.map(anchoEm));
    fs = Math.min(TIT_FS_MAX, ANCHO_UTIL / mayor, ALTO_TITULO_MAX / ((L - 1) * INTER + CAP));
    if (fs >= TIT_FS_PISO) break;
  }

  const L = lineas.length;
  const alto = L ? ((L - 1) * INTER + CAP) * fs : 0;
  // Sin titulo el bloque de abajo no existe y el numero se centra en la hoja entera, en
  // vez de quedar colgado arriba con medio dedo de papel vacio debajo.
  const tituloTop = L ? BASE_TITULO - alto : H - 6;
  return {
    lineas,
    fs,
    tituloTop,
    kickerBase: tituloTop - KICKER_SOBRE_TIT,
    numeroPie: tituloTop - HUECO_KICKER,
  };
}

/**
 * `calcular` corre una fuerza bruta por cada L=1..4 y el indice de un curso dibuja hasta
 * 47 tarjetas: sin esto se rehace entero en cada render (un scroll, un cambio de estado
 * del padre, cualquier cosa). El cache es un memo PURO —la clave es el unico argumento y
 * el valor no depende de nada mas—, asi que es seguro compartirlo entre requests del
 * server; se vacia entero al pasarse de tamaño para que no crezca sin techo.
 */
const MEMO = new Map<string, Caja>();
function componer(titulo: string): Caja {
  const hit = MEMO.get(titulo);
  if (hit) return hit;
  const v = calcular(titulo);
  if (MEMO.size > 800) MEMO.clear();
  MEMO.set(titulo, v);
  return v;
}

/* ═══════════════════════════ EL ALFABETO ═══════════════════════════
   Diez esqueletos dibujados a mano en una caja de 64x100 (tinta de y=12 a y=88), con las
   curvas deliberadamente desparejas: las verticales caen fuera de plomo y los bucles no
   cierran donde arrancaron. Se trazan con un stroke gordo y se ahuecan con uno fino
   adentro, que es exactamente la construccion del numero de la referencia —un anillo
   grueso contorneado, no un glifo relleno—.

   `AVANCE` es el ancho que ocupa cada digito y `EJE_G` el centro real de su dibujo: el 1
   mide la mitad que el 0 y su tinta esta corrida a la izquierda, asi que sin las dos
   tablas el «01» sale con un agujero a la derecha.

   `TRACKING` sale de medir la referencia: el bbox de tinta de sus numeros de dos digitos
   da ancho/alto = 1,11 · 1,23 · 1,39 · 1,46 · 1,41 (media 1,30). Con los avances pelados
   un «00» da 116/97 = 1,20, o sea que la referencia lleva aire ENTRE los digitos. Con
   TRACKING=8 el «00» da 1,28 y el «01» 1,15 (medido en m1: 1,11).
   ═══════════════════════════════════════════════════════════════════ */
const GLIFOS: readonly string[] = [
  'M32,12 C20.4,12.6 12.6,28.6 12,50 C11.4,71.6 20,88.2 32,88 C44.2,87.8 52.6,71 52,50 C51.4,28.8 43.8,11.4 32,12 Z',
  'M17,28.5 C23,24 29,18.4 33.5,12 C35.5,30 37.4,60 39.5,88',
  'M13.6,29 C15,17.6 24,11.4 34,12 C45.4,12.6 52.2,20.2 51.4,31 C50.6,42.4 41.6,50.2 31.6,58 C23.6,64.4 15.8,73 13,87.6 C25.4,86.8 41,87.4 53,87',
  'M14,25.6 C17.4,15.6 25.2,11.4 34,12 C45,12.6 51.2,18.8 50.4,28 C49.6,37.6 41.6,44.2 31,45.2 C42.4,45 52.2,50.4 52,62 C51.8,76.4 43,88.8 31,88 C20.8,87.4 14.2,82 12,72.6',
  'M40.6,12 C31.4,29.4 21.2,45.4 12,60.4 C24.4,61 40.4,60.4 53,60.6 M40.4,37 C40.8,54 40.2,71 40.6,88',
  'M50.4,12.6 C39.4,12 27,12.6 17.2,13.2 C16,25.4 15,34.4 13.8,44.4 C22,40.2 30.2,38.4 37.2,40 C47.4,42.4 53,50.4 52.4,62 C51.8,77 43,88.8 31,88 C20.8,87.4 14.2,82.6 12,73.6',
  'M47,13.6 C33,19 22,31 16,45 C12.2,54.8 11.6,61.6 12,66 C12.6,79.4 21,88.6 32,88 C43.4,87.4 51.2,79 51,66.4 C50.8,55 43,47.4 32,47.6 C21.2,47.8 12.4,55 12,66',
  'M12,13 C25,12.4 41,13.2 53,12.4 C46.4,32 39.2,52 33,88',
  'M32,12 C22,12.2 15,18.4 15,27 C15,36 23.4,43 32,47.2 C43.4,51.6 52,58 52,68 C52,79.8 43,88.4 32,88 C21.2,87.6 12,79.8 12,68 C12,58 20.8,51.6 32,47.2 C41,43 49,36 49,27 C49,18.4 42.2,11.8 32,12 Z',
  'M17,86.4 C31,81 42,69 48,55 C51.8,45.2 52.4,38.4 52,34 C51.4,20.6 43,11.4 32,12 C20.6,12.6 12.8,21 13,33.6 C13.2,45 21,52.6 32,52.4 C42.8,52.2 51.6,45 52,34',
];
const AVANCE = [58, 46, 58, 58, 58, 58, 58, 56, 58, 58];
const EJE_G = [32, 28.2, 32.5, 32, 32.5, 32.5, 31.5, 32.5, 32, 32.5];
const TRACKING = 8;
const TRAZO_GORDO = 21;                        // en unidades de glifo
const TRAZO_HUECO = 12;
const GLIFO_ALTO = 88 - 12 + TRAZO_GORDO;      // 97: lo que el digito mide CON su trazo
const GLIFO_TOP = 12 - TRAZO_GORDO / 2;        // 1,5: donde arranca la tinta

/* ─────────────────────────── el componente ─────────────────────────── */

export function PortadaModulo({ n, titulo, className }: { n: number; titulo: string; className?: string }) {
  const limpio = limpiarTitulo(titulo);
  const { lineas, fs, tituloTop, kickerBase, numeroPie } = componer(limpio);
  const L = lineas.length;

  const h = h32(`${n}|${limpio}`);
  /** Ver la nota 1 de la cabecera: unico por instancia, sin hooks, y con una colision que
   *  no se puede ver porque exige que las dos tarjetas dibujen los mismos digitos. */
  const uid = h32(`${n}\u0000${titulo}`).toString(36);
  const idHueco = `pm${uid}`;

  /* ── EL NUMERO, ultimo eslabon de la cadena ── */
  const aire = numeroPie - NUM_TOP;
  const numAlto = Math.max(NUM_ALTO_MIN, Math.min(NUM_ALTO_MAX, aire));
  // Cuando el clamp muerde —titulos muy cortos, que dejan mucho aire— el numero se CENTRA
  // en el hueco en vez de colgar de la tapa. Sin esto «IA» deja un vacio abajo.
  const numTop = NUM_TOP + Math.max(0, aire - numAlto) / 2;

  const digitos = Array.from(String(Math.max(0, Math.trunc(n))).padStart(2, '0')).map(Number);
  const avanceTotal = digitos.reduce((a, d) => a + (AVANCE[d] ?? 58), 0) + TRACKING * (digitos.length - 1);
  let k = numAlto / GLIFO_ALTO;
  if (avanceTotal * k > NUM_ANCHO_MAX) k = NUM_ANCHO_MAX / avanceTotal;
  const numAncho = avanceTotal * k;
  const numX0 = EJE - numAncho / 2;
  const numX1 = EJE + numAncho / 2;
  const gx = numX0;
  const gy = numTop - GLIFO_TOP * k;

  // El corrimiento del segundo pasado del marcador. ±2,2 sobre un trazo de 21 es un 10%:
  // se lee como pulso de mano y no como doble impresion. Cada digito lee ADEMAS sus
  // propios bits de giro y deslizada — si compartieran, el «11» saldria con los dos palos
  // torcidos exactamente igual.
  const dx2 = (bits(h, 7, 3) / 7) * 4.4 - 2.2;
  const dy2 = (bits(h, 10, 3) / 7) * 4.4 - 2.2;
  const trazos = digitos.map((d, i) => {
    const rot = (bits(h, 2 + i * 3, 3) / 7) * 3.2 - 1.6;
    const desliz = (bits(h, 18 + i * 2, 2) / 3) * 2.4 - 1.2;
    let cursor = 0;
    for (let j = 0; j < i; j++) cursor += (AVANCE[digitos[j]] ?? 58) + TRACKING;
    const tx = cursor + (AVANCE[d] ?? 58) / 2 - (EJE_G[d] ?? 32);
    return {
      d: GLIFOS[d] ?? GLIFOS[0],
      t: `translate(${r2(tx)},${r2(desliz)}) rotate(${r2(rot)},${EJE_G[d] ?? 32},50)`,
    };
  });

  /* ── grilla ──
     Paso 12 unidades = 11 css px. La referencia mide 5,4-8 u; lo subo a proposito: a 8 u
     son 35 verticales y 22 horizontales en una tarjeta de 296 px, y con trazo sub-pixel
     eso no se lee como cuadricula — se lee como una neblina gris. `crispEdges` va SOLO
     aca: hace que el trazo de 0,7 caiga en un pixel entero y a plena intensidad. */
  const vert: string[] = [];
  for (let x = ESPIRAL_W + 4; x <= CANTO_X; x += 12) vert.push(`M${x},0V${H}`);
  const horiz: string[] = [];
  for (let y = 3; y <= H - 6; y += 12) horiz.push(`M${ESPIRAL_W - 2},${y}H${CANTO_X}`);

  /* ── espiral ──
     13 anillos = 12,5 css px por vuelta: se cuentan a ojo, que es lo que pasa en m1. Dos
     trazos y nada mas —uno oscuro grueso y uno claro fino corrido—: a ese tamaño es el
     minimo que todavia lee como «resorte». La fase la corre el hash para que dos tarjetas
     vecinas no rimen. */
  const fase = bits(h, 18, 3) * 0.6;
  const anillos: string[] = [];
  for (let i = 0; i < 13; i++) {
    const cy = 6 + fase + i * 13.5;
    const f = (v: number) => v.toFixed(1);
    anillos.push(
      `M3,${f(cy + 3)} C3,${f(cy - 2.4)} 7.6,${f(cy - 5)} 14.5,${f(cy - 5)}` +
        ` C20.4,${f(cy - 5)} 25.2,${f(cy - 2)} 25.2,${f(cy + 1.5)}`,
    );
  }

  /* ── la baseline de cada renglon: UNA sola formula ──
     ⚠️ En la v1 esto estaba calculado en dos lugares (`brochas.map` y `lineas.map`), que
     es la formula que alinea el brochazo con SU renglon escrita dos veces. Se
     desincronizan en cuanto alguien toque INTER, y el sintoma es un resaltador corrido
     medio renglon — que se lee como un bug de render, no como una constante duplicada. */
  const baseline = (i: number) => BASE_TITULO - (L - 1 - i) * INTER * fs;

  /* ── brochazos: UNO POR RENGLON, que es lo que hace una persona con dos lineas ── */
  const j0 = 12 + bits(h, 21, 3);
  const j1 = 4 + bits(h, 24, 3);
  const brochas = lineas.map((txt, i) => {
    const b = baseline(i);
    const w = anchoEm(txt) * fs;
    const x0 = Math.max(BROCHA_MIN_X, EJE - w / 2 - j0);
    const x1 = Math.min(BROCHA_MAX_X, EJE + w / 2 + j1);
    const yT = b - CAP * fs - 3;
    const yB = b + CAP * fs * 0.28 + 4;
    const f = (v: number) => v.toFixed(1);
    return {
      // La caja ENTERA, no solo `x1`: el sticker se ubica contra lo que hay ocupado, y
      // para eso necesita las cuatro coordenadas de cada renglon.
      x0, x1, y0: yT, y1: yB,
      d:
        `M${f(x0)},${f(yT + 2.5)} C${f(x0 + 6)},${f(yT - 1.5)} ${f(x1 - 18)},${f(yT + 1.5)} ${f(x1 - 2)},${f(yT - 0.5)}` +
        ` L${f(x1)},${f(yB - 3)} C${f(x1 - 14)},${f(yB + 2)} ${f(x0 + 22)},${f(yB - 1.5)} ${f(x0 + 3)},${f(yB + 1)} Z`,
    };
  });

  /* ── sticker ──
     ⚠️ TODOS los slots estan a la DERECHA, y eso esta medido: en las cinco referencias el
     papelito cae arriba a la derecha (m1: x 222..265 / y 48..88; m3: x 220..280 / y 9..68)
     o abajo a la derecha (m2, m4, m5: x 214..282 / y 136..174). Nunca a la izquierda. La
     v1 tenia un cuarto slot en [40,22] detras de una guarda —`if (numX0 >= 82)`— cuyo
     propio comentario se auto-refutaba; el slot se va, y con el la guarda muerta.
     Las dos guardas que quedan SI son de construccion: el de abajo solo entra si el
     brochazo no llego hasta ahi, y el del medio solo si el numero no se estiro hasta ahi. */
  const S = 34;

  /* ⚠️ EL SLOT SE ELIGE CONTRA LO QUE HAY OCUPADO, Y SI NO HAY HUECO NO HAY STICKER.
   *
   * La version anterior tenia tres guardas y despues, abajo, un `if (!slots.length)
   * slots.push(...)` que ponia el papelito igual. O sea: la rama que sabe que NINGUN lugar
   * esta libre elegia uno. Es la misma forma de «detectar la ambiguedad sin actuar» que ya
   * esta escrita en AGENTS.md, y el sintoma es el que se vio en el riel real: «Creativos
   * Animado▮» y «Instagram Reel▮», con el sticker apoyado encima de la ultima letra.
   *
   * Ademas las guardas miraban `x1` del ULTIMO renglon. Con dos renglones el papelito
   * puede chocar contra el PRIMERO sin que el ultimo lo sepa.
   *
   * Y no es una perdida: la decoracion obligatoria de cada lamina son los destellos (esos
   * se ubican en el hueco que deja el numero y siempre hay al menos uno). El sticker es el
   * extra que aparece cuando sobra lugar — que es exactamente lo que pasa en la referencia,
   * donde el hueco lo dejan los doodles. */
  const ocupado = [
    { x0: numX0 - 4, y0: numTop - 4, x1: numX1 + 4, y1: numTop + numAlto + 4 },
    ...brochas.map((b) => ({ x0: b.x0 - 3, y0: b.y0 - 3, x1: b.x1 + 3, y1: b.y1 + 3 })),
  ];
  const chocaAlgo = (x: number, y: number) =>
    ocupado.some((o) => x < o.x1 && x + S + 4 > o.x0 && y < o.y1 && y + S + 4 > o.y0);

  // Los tres lugares donde cae en las cinco referencias — siempre a la derecha (m1: x
  // 222..265 / y 48..88; m3: x 220..280 / y 9..68; m2/m4/m5: x 214..282 / y 136..174).
  const slots = ([[248, 28], [242, 64], [250, 124]] as [number, number][])
    .filter(([x, y]) => !chocaAlgo(x, y));
  const puesto = slots.length ? slots[h % slots.length] : null;
  const [sx, sy] = puesto ?? [0, 0];
  const giro = -14 + bits(h, 4, 3) * 4;
  const stick = puesto
    ? { x0: sx, y0: sy, x1: sx + S + 4, y1: sy + S + 4 }
    // Sin sticker, su caja no reserva nada: el hueco queda para los destellos.
    : { x0: -99, y0: -99, x1: -99, y1: -99 };

  /* ── destellos ──
     Lo unico que queda de los doodles: estrellas de 4 puntas MACIZAS, como las que rodean
     al «02» de m2. Sobreviven al achique porque son formas llenas y simples, al reves que
     el dibujo lineal. Y no se eligen por tema: un doodle elegido por palabra clave
     acertaria en el 20% de los titulos y afirmaria algo falso en el resto.

     ⚠️ TODA LAMINA LLEVA DECORACION. La v1 hacia `const cuantos = (h >>> 13) & 1 ? … : 0`,
     o sea que apagaba los destellos en la MITAD de los hashes; con los doodles amputados,
     esas laminas quedaban en papel + grilla + espiral + numero y nada mas. Ahora son 1 o
     2, nunca 0. Las anclas se DERIVAN del hueco que dejo el numero en vez de ser una tabla
     fija, asi que ninguna puede caer encima de el por mas que el numero se estire. */
  const izq = (MARGEN_X + 10 + numX0) / 2;
  const der = (numX1 + CANTO_X - 8) / 2;
  const anclas: [number, number][] = [
    [der, numTop + numAlto * 0.20],
    [izq, numTop + numAlto * 0.30],
    [der, numTop + numAlto * 0.70],
    [izq, numTop + numAlto * 0.74],
  ];
  const cuantos = 1 + bits(h, 13, 1);
  const desde = bits(h, 15, 1);
  const destellos = anclas
    .filter(([dx, dy]) => !(dx > stick.x0 - 10 && dx < stick.x1 + 10 && dy > stick.y0 - 10 && dy < stick.y1 + 10))
    .slice(desde, desde + cuantos)
    .map(([dx, dy], i) => {
      const s = 6 + bits(h, 16 + i, 1) * 2;
      const p = (v: number) => v.toFixed(1);
      return {
        k: `${i}`,
        d:
          `M0,${p(-s)} C0.5,${p(-s * 0.3)} ${p(s * 0.3)},-0.5 ${p(s)},0` +
          ` C${p(s * 0.3)},0.5 0.5,${p(s * 0.3)} 0,${p(s)}` +
          ` C-0.5,${p(s * 0.3)} ${p(-s * 0.3)},0.5 ${p(-s)},0` +
          ` C${p(-s * 0.3)},-0.5 -0.5,${p(-s * 0.3)} 0,${p(-s)} Z`,
        t: `translate(${r2(dx)},${r2(dy)})`,
      };
    });

  /* ── la caja del titulo, DERIVADA del reparto vertical ──
     ⚠️ En la v1 estos cuatro numeros eran literales (`x={24} y={80} width={296}
     height={100} viewBox="24 80 296 100"`) acoplados en silencio a BASE_ULTIMA: mover el
     titulo dejaba el recorte donde estaba. Ahora la caja arranca donde arranca el bloque
     de abajo y llega al pie de la hoja. */
  const clipY = Math.max(0, Math.min(tituloTop, kickerBase) - 12);
  const clipX = ESPIRAL_W + 2;
  const clipW = CANTO_X - clipX;
  const clipH = H - clipY;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      /* `ugc-lamina` va SIEMPRE, no como default de la prop: es el enganche por el que
         el CSS le aplica a la lamina el MISMO revelado que a una tapa real. Si
         dependiera de que el llamador la pase, el dia que alguien pase `className`
         para otra cosa la lamina sale sin revelar y nadie lo relaciona. */
      className={className ? `ugc-lamina ${className}` : 'ugc-lamina'}
      /* ⚠️ `.ugc-modcard-cover img` (ugc.css:1978) es un selector de ELEMENTO: un <svg>
         no matchea NADA de esa regla — ni position, ni inset, ni width/height, ni
         object-fit (que ademas no gobierna un svg inline: su equivalente es el
         preserveAspectRatio de arriba). Y `.ugc-modcard-cover` no tiene overflow propio
         —el unico `overflow: hidden` de la pila esta en `.ugc-modcard`—, asi que un svg
         mal dimensionado se dibujaria ENCIMA del titulo de la tarjeta.

         ⚠️ `height: 100%` PARECE redundante al lado de `inset: 0` y NO LO ES, porque un
         <svg> es un elemento REEMPLAZADO: con `height: auto` el alto sale de su relacion
         intrinseca (el viewBox), no de la restriccion top/bottom. Medido en el navegador
         sobre cuatro cajas:
             aspect-ratio:16/9 a 296 px → caja 166,50 · svg 166,50 · hueco 0,00 px
             aspect-ratio:16/9 a 261 px → caja 146,81 · svg 146,81 · hueco 0,00 px
             alto fijo 167 px           → caja 167,00 · svg 166,50 · hueco 0,50 px
             alto fijo 170 px           → caja 170,00 · svg 166,50 · hueco 3,50 px
         En produccion la caja es `aspect-ratio: 16/9` y hoy da 0, pero el dia que no lo
         sea el hueco muestra el degrade de `--u-night` por el borde de abajo. Es ademas
         lo que ya hace la regla hermana `.ugc-modcard-cover img`, que pone los cuatro
         (`inset: 0` + `width: 100%` + `height: 100%` + `object-fit`). */
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        fontFamily: FAMILIA,
      }}
      /* La lamina es DECORATIVA: el nombre del modulo ya esta escrito en texto real en
         `.ugc-modcard-t`, dentro del MISMO <button>. Un <title> aca se sumaria al nombre
         accesible del boton y un lector de pantalla diria el modulo dos veces. */
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/**
         * ⚠️ LA MASCARA ES DE LUMINANCIA Y EL HUECO VA EN NEGRO, no en color papel.
         * En m1 la CUADRICULA SE VE ADENTRO DEL CERO: eso solo sale si el hueco es
         * transparencia de verdad. Rellenarlo con `PAPEL` se ve igual hoy y miente el dia
         * que el fondo cambie —el `.shade` ya lo oscurece, y ahi el relleno quedaria como
         * una mancha clara adentro del numero—.
         * `maskUnits="userSpaceOnUse"` es obligatorio: el default (objectBoundingBox)
         * interpretaria las coordenadas del rect como fracciones.
         */}
        <mask id={idHueco} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <g
            transform={`translate(${r2(gx)},${r2(gy)}) scale(${r2(k)})`}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* 1) el trazo gordo */}
            <g stroke="#fff" strokeWidth={TRAZO_GORDO}>
              {trazos.map((t, i) => <path key={`a${i}`} d={t.d} transform={t.t} />)}
            </g>
            {/* 2) el marcador que paso una SEGUNDA vez, corrido: engorda el contorno de un
                   lado y lo deja fino del otro. De ahi sale la irregularidad, sin un solo
                   filtro SVG. Medido en m1: el contorno del «0» da 4,1 / 4,2 / 1,1
                   unidades a tres alturas — un marcador varia, `stroke-width` no. */}
            <g stroke="#fff" strokeWidth={TRAZO_GORDO * 0.94} transform={`translate(${r2(dx2)},${r2(dy2)})`}>
              {trazos.map((t, i) => <path key={`b${i}`} d={t.d} transform={t.t} />)}
            </g>
            {/* 3) el hueco: apaga tinta en vez de pintar papel */}
            <g stroke="#000" strokeWidth={TRAZO_HUECO}>
              {trazos.map((t, i) => <path key={`c${i}`} d={t.d} transform={t.t} />)}
            </g>
          </g>
        </mask>
      </defs>

      {/* papel: se pasa 4 u por lado para que el `slice` nunca muestre vacio */}
      <rect x={-4} y={-4} width={W + 8} height={H + 8} fill={PAPEL} />

      {/* cuadricula: DOS <path> con todos los segmentos concatenados, no 40 elementos
          sueltos — esto se paga hasta 47 veces en la misma pantalla */}
      <g stroke={GRILLA} strokeWidth={0.7} shapeRendering="crispEdges" fill="none">
        <path d={vert.join('')} />
        <path d={horiz.join('')} />
      </g>

      {/* margen rojo. Va con una curvatura minima: una recta perfecta delata la maquina */}
      <path
        d={`M${MARGEN_X + 0.3},0 C${MARGEN_X - 0.4},60 ${MARGEN_X + 0.8},120 ${MARGEN_X + 0.1},${H}`}
        stroke={MARGEN}
        strokeWidth={1.2}
        fill="none"
        opacity={0.82}
      />

      {/* canto derecho: cuatro bandas planas, de 14/8/4/2 unidades */}
      <g>
        <rect x={CANTO_X} y={0} width={W - CANTO_X} height={H} fill={CANTO[0]} />
        <rect x={W - 8} y={0} width={8} height={H} fill={CANTO[1]} />
        <rect x={W - 4} y={0} width={4} height={H} fill={CANTO[2]} />
        <rect x={W - 2} y={0} width={2} height={H} fill={CANTO[3]} />
      </g>

      {/* encuadernado */}
      <rect x={0} y={0} width={ESPIRAL_W} height={H} fill={ESPIRAL_BANDA} />
      <path d={`M${ESPIRAL_W},0V${H}`} stroke={ESPIRAL_CANTO} strokeWidth={1} fill="none" />
      <g fill="none" strokeLinecap="round">
        {anillos.map((d, i) => (
          <g key={i}>
            <path d={d} stroke={ANILLO} strokeWidth={3} />
            <path d={d} stroke={ANILLO_LUZ} strokeWidth={0.9} opacity={0.75} transform="translate(-0.7,-1)" />
          </g>
        ))}
      </g>

      {/* destellos */}
      <g fill={TINTA} opacity={0.8}>
        {destellos.map((d) => (
          <path key={d.k} d={d.d} transform={d.t} />
        ))}
      </g>

      {/* ── el numero: UN rect de tinta recortado por la mascara ── */}
      <rect x={0} y={0} width={W} height={H} fill={TINTA} mask={`url(#${idHueco})`} />

      {/* ── MÓDULO ──
          ⚠️ x = EJE + letterSpacing/2 y no EJE: en SVG el letter-spacing se agrega TAMBIEN
          despues de la ultima letra, asi que con text-anchor="middle" la palabra queda
          media unidad corrida a la izquierda. Es invisible en una tarjeta y evidente en
          una grilla de 47, que es donde se va a ver.
          El literal es fijo a proposito: este componente dibuja MODULOS. `TarjetaClase`
          usa el mismo `.ugc-modcard-cover`, asi que enchufarlo ahi sin parametrizar la
          palabra haria que cada CLASE dijera «MÓDULO» — una mentira en versalitas. */}
      {L > 0 && (
        <text
          x={EJE + 0.75}
          y={r2(kickerBase)}
          textAnchor="middle"
          fontSize={8.6}
          fontWeight={700}
          letterSpacing={1.5}
          fill={TINTA}
        >
          MÓDULO
        </text>
      )}

      {/* ── titulo sobre el brochazo ──
          ⚠️ El <svg> ANIDADO no es decoracion: clipea por defecto (`overflow: hidden` de
          la hoja del user agent para todo svg que no sea raiz), y es la red por si la
          estimacion de ancho se equivoca —Arial en vez de Archivo, un glifo raro—. Sin
          el, el modo de falla no es «se ve feo»: es un titulo que se sale de la tarjeta y
          pisa a la de al lado, porque el unico overflow:hidden de la pila esta dos
          niveles mas arriba. Hace el trabajo de un <clipPath> sin gastar otro id.
          El viewBox repite las coordenadas del padre, asi que la escala es 1 y adentro se
          puede seguir pensando en unidades del lienzo. */}
      {L > 0 && (
        <svg x={clipX} y={clipY} width={clipW} height={clipH} viewBox={`${clipX} ${clipY} ${clipW} ${clipH}`}>
          {/* El blend va en el GRUPO y no en cada trazo: con dos o tres renglones los
              brochazos se superponen un poco (como un resaltador de verdad) y un multiply
              por trazo dibujaria una franja mas oscura en cada solape.
              ⚠️ Si algun ancestro llegara a tener `isolation: isolate` o un `filter`, el
              multiply queda encerrado: el brochazo tapa la cuadricula en vez de dejarla
              ver. Degrada bien, pero no hay que ponerselo al padre a proposito. */}
          <g fill={LIMA_BROCHA} opacity={0.92} style={{ mixBlendMode: 'multiply' }}>
            {brochas.map((b, i) => (
              <path key={i} d={b.d} />
            ))}
          </g>
          <g fill={TINTA} fontWeight={900} fontSize={r2(fs)} letterSpacing={-0.2} textAnchor="middle">
            {lineas.map((txt, i) => (
              <text key={i} x={EJE} y={r2(baseline(i))}>
                {txt}
              </text>
            ))}
          </g>
        </svg>
      )}

      {/* ── sticker ──
          Sombra negra dura y desplazada, cuerpo lima, y el contorno interno que se ve
          clarito en m1. Los cuatro lados se dibujan a mano —cada vertice corrido medio
          punto— porque un <rect> a 34 unidades se lee como un chip de UI, no como un
          papelito pegado. Es la pieza mas maciza de la lamina y la que mejor aguanta el
          achique: a 296 px sigue leyendose como un post-it. */}
      {puesto && (
      <g transform={`translate(${sx},${sy}) rotate(${giro},${S / 2},${S / 2})`}>
        <path d={`M3.5,4.2 L${S + 3},3.5 L${S + 3.5},${S + 3} L4,${S + 3.5} Z`} fill={TINTA} />
        <path d={`M0.6,0.8 L${S - 0.4},0 L${S},${S - 0.6} L0,${S} Z`} fill={LIMA_STICKER} />
        <path
          d={`M4.2,4.6 L${S - 4},3.8 L${S - 3.6},${S - 4.2} L3.6,${S - 3.8} Z`}
          fill="none"
          stroke={TINTA}
          strokeWidth={1.5}
          strokeLinejoin="round"
          opacity={0.9}
        />
      </g>)}
    </svg>
  );
}
