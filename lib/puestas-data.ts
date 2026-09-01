// =============================================================================
// puestas-data — el catálogo de PUESTAS EN ESCENA (data pura, sin server-only)
// =============================================================================
// El SEGUNDO eje del creativo, y no es el mismo que `angulos-data.ts`. Conviene
// tenerlo claro antes de tocar cualquiera de los dos, porque el vocabulario se
// pisa y ya costó una discusión:
//
//   ÁNGULO  (lib/angulos-data.ts) = QUÉ se cuenta.  «Comparación», «Hook de
//           problema», «Mini-VSL». Es el eje de marketing.
//   PUESTA  (este archivo)        = CÓMO se filma.  «Podcast», «Plano secuencia»,
//           «Voz en off». Es el eje de producción.
//
// Son ORTOGONALES: elegir «Hook de problema» no dice si se filma en un auto o
// caminando por una oficina. El creativo final es el cruce de los dos, y por eso
// el cliente elige uno de cada lado — que es el pedido de «formatos a la carta».
//
// ⚠️ Este archivo NO importa ni modifica `angulos-data.ts`. Ese eje ya tiene
// cuatro consumidores vivos (`api/onboarding/formatos`, `api/onboarding/razones`,
// `MatrizView`, `cerebro-grafo`) y MatrizView es uno de los dos archivos que las
// dos cuentas de Claude tocan a la vez — ya rompió el build en prod el 16/08.
// Los ejes conviven; no se fusionan.
//
// De dónde salen los números: `confianza` lo dice en cada ficha y no es
// decorativo. `medido` = salió de producir un anuncio real y contarlo;
// `curso` = lo dice AvatarHype y todavía nadie lo verificó acá. Un parámetro de
// curso puede estar mal (la tabla de créditos de Flow lo estaba), así que antes
// de apoyar una promesa al cliente en uno, se mide.
// =============================================================================

/** Cómo se comporta la cámara durante el clip. */
import { DURACIONES_FLOW } from './costo-clip';

export type Camara =
  | 'estatica'      // trípode. Podcast, Dualcast, producto en mano.
  | 'mano'          // alguien filma con el teléfono: temblor, encuadre descentrado.
  | 'selfie'        // brazo estirado, la persona se filma a sí misma.
  | 'seguimiento';  // la cámara acompaña el desplazamiento (retrocede, orbita, sigue).

/** Si el avatar habla en cámara, nunca, o se alterna clip a clip. */
export type Habla = 'siempre' | 'nunca' | 'mixto';

/** De dónde sale cada número de la ficha. */
export type Confianza = 'medido' | 'curso';

export type Puesta = {
  id: string;
  /** El nombre de la plantilla, en inglés y entendible solo: «The Office». */
  nombre: string;
  /**
   * Cómo se llama esta puesta en la jerga de producción («plano secuencia»).
   *
   * No se muestra en la tarjeta —ahí el nombre alcanza— pero sí en el detalle:
   * quien abre el detalle quiere saber CÓMO se filma, y ese es el término con el
   * que va a encontrar material afuera.
   */
  tecnico: string;
  /** Una línea para la tarjeta. Sin subtítulo debajo. */
  descripcion: string;
  /** El criterio de elección: cuándo conviene ESTE y no otro. */
  cuando: string;
  personas: 1 | 2;
  /** Rango de clips [min, max] de un anuncio típico con esta puesta. */
  clips: [number, number];
  /** Rango de segundos por clip. */
  segundosClip: [number, number];
  camara: Camara;
  habla: Habla;
  /**
   * El patrón de alternancia, solo cuando `habla === 'mixto'`. H = habla en
   * cámara, O = voz en off. Se lee de izquierda a derecha, un carácter por clip.
   */
  ritmo?: string;
  /**
   * Palabras por segundo que entran en el clip. NO es preferencia de estilo: es
   * cuánto texto acepta el modelo antes de tartamudear o de sobrarle tiempo.
   */
  densidad: number;
  /**
   * Cuántas IMÁGENES hay que generar antes del video. Una por ESCENARIO, no por clip.
   *
   * ⚠️ Este número existe porque el orden correcto es IMAGEN → VIDEO, y el
   * catálogo decía lo contrario: había un `imagenesPrevias: boolean` que en
   * `The Office` y en `Car Talks` valía `false`, dato que salió de cómo se
   * produjo A MANO el cuarto anuncio y se generalizó a una regla del formato. El
   * primer clip que salió de punta a punta lo pagó: ángulo equivocado y sin
   * parecerse a la persona.
   *
   * Ese booleano ya no existe: contestaba la MISMA pregunta que este número y la
   * contestaba distinto. Toda puesta necesita al menos un escenario, así que la
   * pregunta «¿hay que generar imágenes?» ya no se hace — la respuesta es sí.
   *
   * La cuenta NO es por clip. Siete tomas dentro del mismo auto son un escenario
   * y una imagen; un recorrido por una oficina son varios lugares y varias
   * imágenes. Por eso vive acá, fijo por formato: es una propiedad de la puesta en
   * escena, no del guion.
   */
  escenarios: number;
  /** ¿Necesita character sheet además de la foto real? */
  characterSheet: boolean;
  /** Las que rompen el formato si se ignoran. Van a la tarjeta y al prompt. */
  reglas: string[];
  /** Dónde está documentado, para poder volver a la fuente. */
  fuente: string;
  confianza: Confianza;
  /**
   * El anuncio REAL que se produjo con esta puesta, recortado y comprimido para
   * mostrarlo al elegir.
   *
   * Es lo que decide si la puesta se OFRECE o no. Un formato descrito con tres
   * párrafos no se elige: se lee. Diez segundos de video contestan «cómo se ve»
   * mejor que cualquier texto, y encima prueban que el formato existe.
   *
   * Para sumar una puesta al menú: se produce un anuncio con ella, se recorta el
   * ejemplo y se agrega acá. Sin ejemplo no entra — no por prolijidad, sino
   * porque ofrecer un formato que nadie produjo es prometer sin haber medido.
   */
  ejemplo?: {
    /** 10 s mudos en loop, para la tarjeta. */
    video: string;
    poster: string;
    /** El anuncio ENTERO, con audio, para el detalle. */
    completo: string;
    /** Cuánto dura el anuncio entero, en segundos. */
    duracionSeg: number;
  };
};

// ── EL CATÁLOGO ──────────────────────────────────────────────────────────────
// Orden: primero las dos que produjimos nosotros y están medidas, después las
// del curso. No es ranking de calidad: es ranking de cuánto sabemos.

export const CATALOGO_PUESTAS: Puesta[] = [
  {
    id: 'plano-secuencia',
    nombre: 'The Office',
    tecnico: 'Plano secuencia',
    descripcion:
      'La persona recorre un espacio real mientras cuenta la historia: camina, saluda, se sirve un café.',
    cuando:
      'Cuando la historia dura más de un minuto y un plano fijo la vuelve pesada. Es el formato que mejor disimula que el video es generado, porque el movimiento continuo distrae del avatar.',
    personas: 1,
    clips: [7, 9],
    segundosClip: [8, 10],
    camara: 'seguimiento',
    habla: 'mixto',
    ritmo: 'H O H O H O H H',
    densidad: 2.1,
    escenarios: 4,
    characterSheet: false,
    reglas: [
      'Lo que se ve NO ilustra la frase. El fondo es contexto, no subtítulo.',
      'En los clips de voz en off la persona sigue en cuadro: solo no habla.',
      'Nunca dos clips de voz en off seguidos.',
      'La acción se escribe en el prompt. Si no se escribe, el modelo rellena repitiendo sílabas.',
      'El corte de escenario llega temprano, para no repetir el mismo rincón dos veces.',
      'No se describe la cara. La identidad la resuelve la foto real, siempre la misma.',
    ],
    fuente: 'Mauricio/GUION-04-oficina-plano-secuencia.md · anuncio 4 producido 24/08/2026',
    confianza: 'medido',
    ejemplo: {
      video: '/formatos/plano-secuencia.mp4',
      poster: '/formatos/plano-secuencia.jpg',
      completo: '/formatos/plano-secuencia-full.mp4',
      duracionSeg: 56,
    },
  },
  {
    id: 'selfie-movimiento',
    nombre: 'Car Talks',
    tecnico: 'Selfie en movimiento',
    descripcion:
      'Plano cerrado, brazo estirado, la persona habla a cámara mientras se mueve o va en un vehículo.',
    cuando:
      'Cuando el mensaje es directo y personal, y quieres máxima cercanía. Es el más barato de producir: no hay que generar imágenes de escenario.',
    personas: 1,
    clips: [7, 12],
    segundosClip: [8, 10],
    camara: 'selfie',
    habla: 'siempre',
    densidad: 3,
    escenarios: 1,
    characterSheet: false,
    reglas: [
      'Una sola foto real como referencia. El escenario lo pone el prompt.',
      'En espacios chicos con fondo corriendo por una ventanilla el fondo alucina. En espacios amplios con luz pareja, aguanta.',
      'Los ojos no miran fijo a cámara todo el tiempo: mientras piensa mira a otro lado y vuelve.',
      'Un clip de 10 s admite entre 26 y 30 palabras. Menos de 26 tartamudea, más de 30 no entra.',
    ],
    fuente: 'Mauricio/GUION-01-v4.md, GUION-02.md, GUION-03.md · anuncios 1 a 3',
    confianza: 'medido',
    ejemplo: {
      video: '/formatos/selfie-movimiento.mp4',
      poster: '/formatos/selfie-movimiento.jpg',
      completo: '/formatos/selfie-movimiento-full.mp4',
      duracionSeg: 92,
    },
  },
  {
    id: 'podcast',
    nombre: 'The Podcast',
    tecnico: 'Podcast a dos cámaras',
    descripcion:
      'Dos personas conversando en un set de podcast, cada una filmada por separado, con micrófonos de brazo.',
    cuando:
      'Cuando el mensaje gana si alguien lo pregunta y otro lo responde. Sirve para instalar una objeción y contestarla sin que suene a discurso.',
    personas: 2,
    clips: [4, 8],
    segundosClip: [6, 8],
    camara: 'estatica',
    habla: 'siempre',
    densidad: 3,
    escenarios: 2,
    characterSheet: false,
    reglas: [
      'Dos imágenes de referencia, una por persona, cada una a un lado del set.',
      'El fondo de la segunda es la MISMA habitación pero no idéntico. Voltear la primera en espejo queda raro.',
      'La cámara no se mueve.',
      'Cada clip lleva una microacción: asiente, reacciona, confirma.',
      'Solo en el primer clip alguien mira el teléfono. Después miran a la otra persona.',
    ],
    fuente: 'AvatarHype · Formato Podcast · Producción y Edición',
    confianza: 'curso',
  },
  {
    id: 'dualcast',
    nombre: 'Duo Cam',
    tecnico: 'Dualcast',
    descripcion:
      'Dos personas juntas en el mismo cuadro, hablando entre ellas y a la audiencia.',
    cuando:
      'Cuando quieres el efecto conversación sin el costo del podcast: no hay que generar imágenes nuevas, se pasa directo a los clips.',
    personas: 2,
    clips: [4, 8],
    segundosClip: [4, 6],
    camara: 'estatica',
    habla: 'siempre',
    densidad: 3,
    escenarios: 2,
    characterSheet: false,
    reglas: [
      'La cámara no se mueve. En el prompt se indica cuál de las dos habla en ese clip.',
      'Sirve para cualquier escena con dos personas en cámara, incluida la entrevista en la calle.',
      'La duración se saca del largo del guion, con un margen: si entra en 4 s, se pide 6.',
      'Se refuerza en edición con imágenes de lo que están diciendo.',
    ],
    fuente: 'AvatarHype · Formato Dualcast',
    confianza: 'curso',
  },
  {
    id: 'voz-en-off',
    nombre: 'Day in My Life',
    tecnico: 'Voz en off',
    descripcion:
      'Muchos clips cortos de la persona haciendo cosas, sin hablar, con la narración por encima.',
    cuando:
      'Cuando el mensaje es una rutina o un recorrido —«un día conmigo»— y la publicidad entra de costado. Es el más barato de animar: los clips mudos no necesitan el modelo caro.',
    personas: 1,
    clips: [6, 12],
    segundosClip: [4, 8],
    camara: 'mano',
    habla: 'nunca',
    densidad: 2.55,
    escenarios: 3,
    characterSheet: true,
    reglas: [
      'El prompt lleva «no talking» siempre. Sin eso el modelo la hace hablar aunque no le des guion.',
      'El character sheet en esta puesta SÍ hace falta: la imagen de avatar sola no define bien los rasgos.',
      'Primero se generan todas las imágenes, después se anima cada una.',
      'La narración tiene que ENTRAR en el clip. A 2,55 palabras por segundo son unas 20 palabras por cada 8 s.',
      'El prompt de animación es siempre el mismo molde: esta imagen, sin cambiar nada de la persona, haciendo esta acción.',
    ],
    fuente: 'AvatarHype · Formato Voz en off · Producción y Edición',
    confianza: 'curso',
  },
  {
    id: 'ugc-con-producto',
    nombre: 'Product in Hand',
    tecnico: 'UGC con producto',
    descripcion:
      'La persona habla a cámara mientras usa el producto: lo prepara, lo toma, lo guarda.',
    cuando:
      'Cuando hay algo físico que mostrar y la demostración es el argumento. No sirve para servicios.',
    personas: 1,
    clips: [3, 5],
    segundosClip: [8, 8],
    camara: 'estatica',
    habla: 'siempre',
    densidad: 3,
    escenarios: 2,
    characterSheet: false,
    reglas: [
      'Una imagen por momento del producto: preparándolo, con el vaso en la mano, guardándolo, el primer plano final.',
      'La cámara no se mueve.',
      'La acción pasa MIENTRAS habla. En el prompt va explícito, no como gesto suelto.',
      'Aunque esté guardando el producto, mira a cámara.',
    ],
    fuente: 'AvatarHype · UGC con producto · Producción y Edición',
    confianza: 'curso',
  },
  {
    id: 'ugc-sin-producto',
    nombre: 'Before & After',
    tecnico: 'UGC sin producto',
    descripcion:
      'La persona habla a cámara contando su antes y después, con imágenes de apoyo superpuestas.',
    cuando:
      'Cuando lo que se vende es un resultado y no un objeto: un servicio, un método, una transformación.',
    personas: 1,
    clips: [4, 8],
    segundosClip: [6, 10],
    camara: 'mano',
    habla: 'siempre',
    densidad: 3,
    escenarios: 2,
    characterSheet: false,
    reglas: [
      'Hacen falta las imágenes del antes y del después, además del avatar base.',
      'La referencia sale de una captura real de una red, no de una imagen generada.',
      'Las imágenes de apoyo se superponen en edición, no se generan como clip.',
    ],
    fuente: 'AvatarHype · UGC sin producto · Producción y Edición',
    confianza: 'curso',
  },
  {
    id: 'trends-virales',
    nombre: 'Trend Jack',
    tecnico: 'Trends virales',
    descripcion:
      'Se toma un video que ya funciona como base, se le conserva la música, y encima van los clips propios.',
    cuando:
      'Cuando el formato lo pone el algoritmo y no tú. Es el de menos control creativo y el de más alcance orgánico.',
    personas: 1,
    clips: [4, 8],
    segundosClip: [4, 8],
    camara: 'mano',
    habla: 'nunca',
    densidad: 2.55,
    escenarios: 2,
    characterSheet: false,
    reglas: [
      'Se produce igual que Voz en off: primero las imágenes, después se anima cada una.',
      'La música y el ritmo salen del video base. Los clips propios se acomodan a esos cortes.',
      'El texto en pantalla va por encima, traducido al idioma del mercado.',
      'El último clip es el del producto: es el que convierte el trend en anuncio.',
      'La música del video base es de un tercero. Antes de pautar hay que resolver de dónde sale la pista.',
    ],
    fuente: 'AvatarHype · Formato Trends virales · Producción y Edición',
    confianza: 'curso',
  },
];

/**
 * Las puestas que se le OFRECEN al cliente: las que tienen un anuncio real para
 * mostrar.
 *
 * El catálogo entero sigue existiendo porque el motor sabe planificar las ocho, y
 * porque son el orden de trabajo de lo que falta producir. Lo que no se ofrece es
 * lo que nadie hizo todavía: un formato elegido desde una descripción es un
 * formato elegido a ciegas, y el cliente se entera al ver el resultado.
 *
 * Hoy son dos. Se suman de a una, cada vez que se produce un anuncio nuevo.
 */
export function puestasOfrecidas(): Puesta[] {
  return CATALOGO_PUESTAS.filter((p) => p.ejemplo);
}

export function puestaPorId(id: string): Puesta | undefined {
  return CATALOGO_PUESTAS.find((p) => p.id === id);
}

/**
 * El router de proveedor, por CLIP y no por puesta.
 *
 * La regla del curso: avatar hablando va al modelo caro, avatar sin hablar va al
 * barato — un plano de recurso consume la misma cuota y no aporta nada. Con
 * `habla: 'mixto'` la decisión cambia clip a clip, así que no puede vivir como
 * campo de la ficha.
 */
export function proveedorDeClip(hablaEnEsteClip: boolean): 'caro' | 'barato' {
  return hablaEnEsteClip ? 'caro' : 'barato';
}

/**
 * Cuántas palabras entran en un clip de esta puesta.
 *
 * Redondea hacia abajo: pasarse no se arregla en el montaje —hay que regenerar—
 * mientras que quedarse corto solo deja aire, que sí se recorta.
 */
export function palabrasQueEntran(puesta: Puesta, segundos: number): number {
  return Math.floor(puesta.densidad * segundos);
}

/**
 * Cuenta palabras del texto hablado de un clip.
 *
 * Vive acá y no en `video-planner.ts` por la misma razón que
 * `exigirClienteDePrueba` vive fuera del módulo que hace el trabajo sucio: es la
 * SEGUNDA capa de la regla de densidad —la que atrapa al modelo cuando el prompt
 * no alcanza— y adentro de un módulo con `server-only` ningún test la puede
 * importar. Una guarda sin test se degrada sin que nadie se entere.
 *
 * Saca lo que no se pronuncia —los asteriscos con que el modelo marca el énfasis
 * y la puntuación suelta— porque si no, `**palabra**` contaría como tres cosas y
 * el aviso saltaría sobre un texto que sí entra.
 */
export function contarPalabras(texto: string): number {
  return texto
    .replace(/\*+/g, ' ')
    .split(/\s+/)
    .filter((p) => /[\p{L}\p{N}]/u.test(p))
    .length;
}

/**
 * Reparte la duración objetivo entre los clips, dentro del rango de la puesta.
 *
 * Prefiere clips largos: menos clips es menos deriva de identidad entre saltos y
 * menos llamadas que pagar. El sobrante se reparte de a un segundo desde el
 * primero, que es donde el espectador todavía está decidiendo si se queda.
 *
 * ⚠️ Si todos los clips llegan al techo y todavía sobra tiempo, devuelve lo que
 * SÍ entra en vez de estirar fuera de rango: una puesta con piso de 7 clips de
 * 8 s no puede entregar un anuncio de 30 s, y fingir que sí es mentirle a quien
 * lo pidió. La pantalla lee esa diferencia y la avisa.
 */
export function repartirDuracion(puesta: Puesta, cantidad: number, totalSeg: number): number[] {
  const [minSeg, maxSeg] = puesta.segundosClip;

  // ⚠️ SOLO LAS DURACIONES QUE FLOW SABE GENERAR, y antes no era así.
  //
  // Esto repartía el resto sumando `+= 1` segundo por clip, así que con un
  // formato de `[8, 10]` producía clips de **9 segundos** — una duración que
  // Flow no genera. Medido en el anuncio de una clienta, en vivo: 7 de sus 8
  // clips salieron en 9 s.
  //
  // Y no falla ruidoso: el número se ve razonable, la pantalla lo muestra, y el
  // costo tampoco lo delata porque 9 no está en la tabla de precios y cae a
  // «estimado». Un valor fuera del catálogo que nadie valida se propaga hasta el
  // modelo.
  //
  // La lista sale de `lib/costo-clip.ts`, que es donde vive la tabla de precios:
  // lo que se puede comprar es exactamente lo que se puede pedir.
  const posibles = DURACIONES_FLOW.filter((d) => d >= minSeg && d <= maxSeg);
  // Un formato cuyo rango no contenga ninguna válida no puede quedar sin
  // duración: se usa su mínimo declarado y que el catálogo se corrija aparte.
  const escalones: number[] = posibles.length ? [...posibles] : [minSeg];

  // La más larga que entre `cantidad` veces en el total. Si ni la más corta
  // entra, se usa la más corta igual: un anuncio más largo que lo pedido es
  // mejor que uno con clips que no existen.
  const base = [...escalones].reverse().find((d) => d * cantidad <= totalSeg) ?? escalones[0];
  const segundos = Array.from({ length: cantidad }, () => base);

  // El resto se gasta SUBIENDO DE ESCALÓN —de 8 a 10, nunca a 9—, y sólo cuando
  // el salto entero entra. Lo que no alcanza para un escalón se deja: el anuncio
  // queda unos segundos más corto que lo pedido, que es la única forma honesta de
  // redondear contra un catálogo cerrado.
  let resto = totalSeg - base * cantidad;
  for (let i = 0; i < cantidad && resto > 0; i++) {
    const sig = escalones.find((d) => d > segundos[i]);
    if (sig === undefined) continue;
    const salto = sig - segundos[i];
    if (salto > resto) continue;
    segundos[i] = sig;
    resto -= salto;
  }
  return segundos;
}

/**
 * Las marcas de voseo rioplatense que NO pueden aparecer en el guion de un
 * cliente mexicano.
 *
 * Existe porque el prompt solo no alcanza: la voz de MaKo es rioplatense y se
 * cuela en lo que escribe PARA el cliente si nadie la corta. Ya pasó —el primer
 * plan generado salió con «sos vos», «¿y vos qué vas a hacer?» y «Tocá el botón»
 * para un cliente norteño de México— y `lib/campaign-structurer.ts:83` tenía la
 * prohibición escrita desde antes, en otro writer. Una regla aplicada en un
 * lugar de dos no está implementada, está documentada.
 *
 * Solo formas VERBALES y pronominales inequívocas: nada de palabras que existen
 * en las dos variedades. `mirá`/`dale` quedan afuera a propósito — «dale» es
 * común en México y `mirá` sin tilde es `mira`.
 */
// ⚠️ NO usar `\b`: en JavaScript el límite de palabra es ASCII, así que después
// de una vocal acentuada NO hay boundary y `tocá`, `andá`, `mirá` o `dejá` se
// escapan del detector en silencio — justo las formas de imperativo, que son las
// que aparecen en todo CTA. Se comprobó con `Tocá el botón`: `\b` daba cero
// coincidencias. Los límites van por Unicode, con lookarounds sobre `\p{L}`.
const VOSEO = /(?<!\p{L})(vos|sos|tenés|querés|podés|sabés|hacés|venís|decís|ponés|elegís|andá|tocá|mandá|fijate|acordate|dejá|mirá|escuchá|contame|acá)(?!\p{L})/giu;

/**
 * Devuelve las marcas de voseo encontradas en un texto, sin repetir.
 *
 * Vacío = limpio. No corrige: el guion se marca y se pide rehacer, porque
 * reemplazar formas verbales a mano rompe la prosodia que el guion venía a
 * cuidar.
 */
export function marcasDeVoseo(texto: string): string[] {
  const hallado = texto.match(VOSEO) ?? [];
  return [...new Set(hallado.map((m) => m.toLowerCase()))];
}

/**
 * Pone el acento en el prompt de un clip, sacando primero el que haya escrito el
 * modelo.
 *
 * **El acento no lo transporta el modelo.** Medido el 25/08/2026: se pidió
 * `Mexican Spanish with a northern (norteño) accent` y los siete clips salieron
 * con `Spoken in neutral Latin American Spanish` — no lo parafraseó, lo ignoró.
 * Es la regla de AGENTS.md sobre datos exactos: si tiene que llegar intacto, lo
 * pone el código.
 *
 * Y por qué además se BORRA lo que escribió el modelo en vez de solo agregar el
 * nuestro: dos frases de acento contradictorias en el mismo prompt son peor que
 * una equivocada — el modelo de video elige una y no hay forma de saber cuál.
 */
export function conAcento(prompt: string, acento: string): string {
  const limpio = prompt
    // «Spoken in X.» / «Spoken with a X accent.» / «Accent: X.» — las tres formas
    // que el modelo usa para cerrar el prompt. Sin la `m`, `$` no corta por línea.
    .replace(/(?:^|\s)(?:spoken\s+(?:in|with|naturally\s+with|clearly\s+with)|accent\s*:)[^.\n]*\.?/gim, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim();
  return `${limpio}\nSpoken in ${acento}.`;
}

/**
 * El patrón habla/off expandido a un array por clip.
 *
 * Devuelve `true` donde la persona habla en cámara. Si la puesta no es mixta, el
 * patrón es uniforme. Si el ritmo declarado no cubre todos los clips pedidos, se
 * repite cíclicamente en vez de cortar: un anuncio más largo mantiene la
 * alternancia en lugar de quedarse mudo al final.
 */
export function ritmoDeClips(puesta: Puesta, cantidadClips: number): boolean[] {
  if (puesta.habla !== 'mixto' || !puesta.ritmo) {
    const hablaSiempre = puesta.habla === 'siempre';
    return Array.from({ length: cantidadClips }, () => hablaSiempre);
  }
  const patron = puesta.ritmo.replace(/\s+/g, '').toUpperCase().split('');
  if (patron.length === 0) return Array.from({ length: cantidadClips }, () => true);
  return Array.from({ length: cantidadClips }, (_, i) => patron[i % patron.length] === 'H');
}

/**
 * De un guion de MaKo, solo lo que se DICE a cámara.
 *
 * Los guiones vienen con sus bloques rotulados —GANCHO, HISTORIA, CTA…— porque el
 * prompt que los escribe se lo exige: «No cambies el nombre, el orden ni el
 * formato: la app las usa para separar el guion en tarjetas». Esos rótulos no se
 * pronuncian.
 *
 * ⚠️ Y contarlos NO es un detalle estético: la duración del video sale de las
 * palabras, así que cada etiqueta que se cuela infla el largo y puede hacer que un
 * guion que entra en el formato parezca que no. Un aviso de «esto no entra» sobre
 * algo que entra es peor que no avisar: manda a recortar un texto que estaba bien.
 *
 * Vive acá y no junto a quien lee los guiones porque aquel módulo tiene
 * `server-only` y esto necesita test — es el mismo criterio que
 * `exigirClienteDePrueba`.
 *
 * Una línea es rótulo si está SOLA, es corta y va toda en mayúsculas. Se le exige
 * al menos una letra para no confundir una línea de guiones, números o signos con
 * un rótulo.
 */
export function soloHablado(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      const esRotulo = t.length <= 24 && /\p{L}/u.test(t) && t === t.toUpperCase();
      return !esRotulo;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── La duración sale del GUION, no de un menú ────────────────────────────────

/** Qué se puede decir sobre cuánto va a durar un guion en una puesta. */
export type CabidaGuion = {
  palabras: number;
  /** Los segundos que ese texto necesita a la densidad de esta puesta. */
  segundosNecesarios: number;
  /** Los segundos que la puesta puede entregar, ya acotados a su rango. */
  segundosReales: number;
  clips: number;
  /** `true` cuando el guion NO entra: hay que acortarlo o cambiar de formato. */
  desborda: boolean;
  /** Cuántas palabras sobran. `0` si entra. */
  palabrasDeMas: number;
};

/**
 * Cuánto dura un guion en una puesta, y si entra.
 *
 * Invierte la aritmética que el resto del módulo hace al derecho: donde
 * `palabrasQueEntran` va de segundos a palabras, esto va de palabras a segundos.
 *
 * ⚠️ Existe porque preguntarle la duración a alguien no tiene sentido: un guion
 * dura lo que dura. Y porque hasta ahora, cuando el texto no entraba en el
 * formato, `repartirDuracion` devolvía el techo **sin decir nada** — el guion se
 * grababa cortado y el único aviso vivía en un paso del wizard.
 *
 * Una puesta impone un rango DURO: The Office son 7-9 clips de 8-10 s (56-90 s), y
 * a 2,1 palabras por segundo eso son 117-189 palabras. Un guion de 400 no entra, y
 * el sistema tiene que decirlo en vez de recortarlo.
 */
export function cabidaDeGuion(puesta: Puesta, texto: string): CabidaGuion {
  const palabras = contarPalabras(texto);
  const segundosNecesarios = Math.ceil(palabras / puesta.densidad);

  const [minClips, maxClips] = puesta.clips;
  const [minSeg, maxSeg] = puesta.segundosClip;
  const pisoSeg = minClips * minSeg;
  const techoSeg = maxClips * maxSeg;


  // ⚠️ EL PLAN SE DIMENSIONA CONTRA LA CAPACIDAD REAL, NO CONTRA UN PROMEDIO.
  //
  // Antes: `clips = round(segundosReales / ((minSeg + maxSeg) / 2))`. Dos errores
  // encadenados. El primero, que 9 —el promedio de 8 y 10— no es una duración que
  // Flow genere, así que el plan se dimensionaba contra clips que no existen. El
  // segundo, peor: preguntaba «¿cuántos clips cubren estos segundos?» cuando la
  // pregunta es «¿cuántos hacen falta para que el guion ENTRE?».
  //
  // Y había un tercero, que es el que de verdad mordía: `segundosReales` salía de
  // `ceil(palabras / densidad)` —un número cualquiera— y las duraciones que se
  // pueden armar de verdad casi nunca suman eso. Medido con el anuncio de una
  // clienta: 211 palabras → 71 s → 8 clips; pero los 8 clips que
  // `repartirDuracion` arma suman 70 s, o sea 210 palabras de capacidad. UNA
  // palabra de más — y el reparto vuelca todo el sobrante en la última toma.
  //
  // El dueño lo diagnosticó antes que nadie: «siempre en el último clip apila
  // todo lo restante… tal vez es un bug que tiene predefinida la cantidad de
  // clips».
  //
  // Ahora se busca la combinación MÁS CHICA que alcanza: se prueban las cantidades
  // de menor a mayor y, para cada una, el total de segundos de menor a mayor,
  // midiendo con las duraciones que `repartirDuracion` va a emitir de verdad y con
  // `palabrasQueEntran` de cada una. El anuncio queda tan largo como el guion
  // necesita y ni un segundo más.
  //
  // Si ni el máximo alcanza, se usa el máximo y `desborda` lo dice: un guion que
  // no cabe no cabe. Pero el plan ya no nace GARANTIZANDO el apilado.
  const capacidadDe = (c: number, total: number) =>
    repartirDuracion(puesta, c, total).reduce((t, seg) => t + palabrasQueEntran(puesta, seg), 0);

  let clips = maxClips;
  let segundosReales = Math.min(techoSeg, Math.max(pisoSeg, segundosNecesarios));
  buscar: for (let c = minClips; c <= maxClips; c++) {
    const desde = Math.max(c * minSeg, segundosNecesarios);
    for (let total = desde; total <= c * maxSeg; total++) {
      if (capacidadDe(c, total) >= palabras) {
        clips = c;
        segundosReales = total;
        break buscar;
      }
    }
  }

  const desborda = segundosNecesarios > techoSeg;
  const palabrasDeMas = desborda ? palabras - Math.floor(puesta.densidad * techoSeg) : 0;

  return { palabras, segundosNecesarios, segundosReales, clips, desborda, palabrasDeMas };
}
