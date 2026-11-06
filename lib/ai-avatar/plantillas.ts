// =============================================================================
// Los PRESETS de AI Avatar: la galería de Higgsfield, con lo que MaKo puede generar
// =============================================================================
// 29/10/2026, Martín: «Lo mismo para AI Avatar... En ese caso replica a higgsfield tal cual». La galería copia la
// de los presets de Higgsfield (su selector «All presets · New · TikTok Core · Instagram Aesthetics · Camera
// Presets · Mood…», relevado en higgsfield.ai el 29/10/2026: docs/hallazgos-ai-avatar.md): una baldosa por preset,
// con su nombre arriba a la izquierda y «Usar preset» al pasar el cursor. Lo que se copia es la EXPERIENCIA y los
// nombres de estilos fotográficos genéricos (selfie de iPhone, ojo de pez, cámara de seguridad), no la marca.
//
// Nacieron el 17/10 como las «plantillas» copiadas de HeyGen (Look = personaje + escena); las ocho de entonces
// siguen, con su id, en otra categoría. Un preset es una ESCENA: la persona lo elige, MaKo arma el look con SU cara
// (la foto) por el puente a Flow y, si quiere, lo anima con su guion en el Video Generator.
//
// Las reglas de la casa que mandan acá (docs/hallazgos-generativa.md):
//   · `prompt` describe la COMPOSICIÓN —lugar, luz, encuadre, cámara— y NUNCA la cara: la identidad la pone la
//     foto. Describir el aspecto rompía el parecido. Por eso NO hay categoría «Beauty» como en Higgsfield: sus
//     presets (maquillaje, cejas, piel) describen la cara, que es justo lo que acá no se toca.
//   · Imperfecto a propósito (grano de celular, luz real) y la actuación hacia abajo: lo perfecto «canta a IA».
//   · El cliente nunca ve un prompt: ve `nombre`, `resumen` y `lugar`.
//   · `puestaId` es el formato del Video Generator: decide el encuadre de las tomas al animarlo.
//     ⚠️ 'selfie-movimiento' trae su prompt de imagen VALIDADO (lib/prompts-imagen.ts) y ése GANA ENTERO sobre la
//     escena del preset (`promptFinal`): un preset con ese formato sale SIEMPRE en el auto. Sólo «Charla en el
//     auto» lo usa (tests/ai-avatar.test.ts).
//   · `guion` es un ejemplo en español neutro, de tú: la persona lo reemplaza.
//
// SIN `server-only`: lo leen la pantalla, el teléfono y el server.

import { VOCES_GALERIA } from './voces-galeria';
import { PRESETS_NUEVOS_VENTA } from './plantillas-venta';

/** Las categorías del selector, en el orden de Higgsfield («New» va aparte: es un filtro, `nuevo`). */
export const CATEGORIAS = ['UGC y TikTok', 'Instagram', 'Cámara', 'Negocio', 'Producto', 'Clima y luz'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export type PlantillaAvatar = {
  id: string;
  nombre: string;
  categoria: Categoria;
  /** Qué es, en una línea corta. Lo que se lee en la tarjeta. */
  resumen: string;
  /** Dónde es, en español. Pasa a la escena del plan. */
  lugar: string;
  /** La composición para Flow, en inglés. Nunca la cara. */
  prompt: string;
  /** El formato del Video Generator que decide el encuadre de las tomas. */
  puestaId: string;
  /** Un guion de ejemplo, para empezar. */
  guion: string;
  /** Una voz de la galería que le queda bien al tema (para escuchar el tono). */
  voz: string;
  /** El filtro «Nuevos» del selector (el «New» de Higgsfield). */
  nuevo?: boolean;
  /** Un video real hecho con este formato, si lo hay. */
  ejemplo?: { video: string; poster: string };
};

export const PLANTILLAS_AVATAR: readonly PlantillaAvatar[] = Object.freeze([
  // ── UGC y TikTok ───────────────────────────────────────────────────────────
  {
    id: 'auto-testimonio',
    nombre: 'Charla en el auto',
    categoria: 'UGC y TikTok',
    resumen: 'Cuentas tu experiencia como si grabaras con el celular.',
    lugar: 'En el auto, estacionado, de día',
    prompt: 'Vertical selfie shot from the driver seat of a parked car, daytime soft light through the side window, seatbelt on, phone held at arm length, relaxed posture, casual t-shirt, natural phone camera look with slight grain, background of a quiet residential street',
    puestaId: 'selfie-movimiento',
    guion: 'El otro día me preguntaron cómo hice para ordenar mi negocio. Te cuento lo que me cambió todo, porque a mí también me costaba.',
    voz: 'rioplatense-hombre-1',
    ejemplo: { video: '/formatos/selfie-movimiento.mp4', poster: '/formatos/selfie-movimiento.jpg' },
  },
  {
    id: 'espejo-resultado',
    nombre: 'Antes y después',
    categoria: 'UGC y TikTok',
    resumen: 'Cuentas el resultado frente al espejo, sin producto a la vista.',
    lugar: 'En casa, frente al espejo del baño',
    prompt: 'Vertical mirror selfie in a clean home bathroom, soft diffused light, person holding the phone, relaxed expression, towel and plants in the background, phone camera look with slight grain',
    puestaId: 'ugc-sin-producto',
    guion: 'Hace tres meses estaba igual que tú. No te voy a vender humo: te cuento qué hice distinto y qué resultado tuve.',
    voz: 'latino-mujer-1',
  },
  {
    id: 'calle-promo',
    nombre: 'Promo caminando',
    categoria: 'UGC y TikTok',
    resumen: 'Anuncias una oferta caminando por la calle.',
    lugar: 'Caminando por una calle con negocios',
    prompt: 'Vertical selfie walking shot on a sunny street with small shops, person holding the phone at arm length while walking, natural motion, daylight, casual outfit, slight phone camera shake',
    puestaId: 'trends-virales',
    guion: 'Solo hasta el domingo tienes un descuento que no vas a ver de nuevo. Te cuento qué incluye y cómo aprovecharlo.',
    voz: 'rioplatense-mujer-1',
  },
  {
    id: 'comiendo',
    nombre: 'Comiendo algo rico',
    categoria: 'UGC y TikTok',
    resumen: 'Recomiendas un lugar con el plato en la mesa.',
    lugar: 'En la mesa de un restaurante',
    prompt: 'Vertical UGC shot at a restaurant table holding a fork over a plate, food in the foreground, warm ambient light, candid moment, other diners blurred behind, phone camera look',
    puestaId: 'ugc-con-producto',
    guion: 'Si estás por la zona, tienes que venir a probar esto. Te digo qué pedir y por qué vale cada peso.',
    voz: 'mexicano-mujer-1',
    nuevo: true,
  },
  {
    id: 'gimnasio-espejo',
    nombre: 'En el gimnasio',
    categoria: 'UGC y TikTok',
    resumen: 'Hablas de entrenamiento frente al espejo del gimnasio.',
    lugar: 'En un gimnasio, frente al espejo',
    prompt: 'Vertical mirror selfie in a modern gym with weight racks behind, bright overhead light, athletic outfit, water bottle in hand, candid post workout moment, phone camera look',
    puestaId: 'ugc-sin-producto',
    guion: 'Tres errores que cometía cuando empecé a entrenar y que me frenaron meses. El segundo lo hace casi todo el mundo.',
    voz: 'colombiano-hombre-1',
  },

  // ── Instagram ──────────────────────────────────────────────────────────────
  {
    id: 'cafe-un-dia',
    nombre: 'Un día conmigo',
    categoria: 'Instagram',
    resumen: 'Muestras tu día de trabajo, con voz en off.',
    lugar: 'En un café, trabajando con la computadora',
    prompt: 'Vertical shot of a person working on a laptop at a cozy cafe table with a coffee cup, warm ambient light, people blurred in the background, candid moment, natural phone camera look',
    puestaId: 'voz-en-off',
    guion: 'Así es un día normal en mi negocio. Arranco temprano, respondo mensajes y después me enfoco en lo que de verdad mueve la aguja.',
    voz: 'espana-mujer-1',
  },
  {
    id: 'espejo-ascensor',
    nombre: 'Espejo del ascensor',
    categoria: 'Instagram',
    resumen: 'La selfie de cuerpo entero en el espejo del ascensor.',
    lugar: 'En el ascensor de un edificio, frente al espejo',
    prompt: 'Vertical mirror selfie inside a modern elevator with brushed steel walls and soft overhead light, phone held at chest height, outfit visible from head to toe, candid and casual',
    puestaId: 'ugc-sin-producto',
    guion: 'Voy camino a una reunión y te quiero contar algo rápido antes de entrar. Esto le sirve a cualquiera que tenga un negocio.',
    voz: 'latino-mujer-2',
    nuevo: true,
  },
  {
    id: 'calle-vista',
    nombre: 'Vista de la calle',
    categoria: 'Instagram',
    resumen: 'Foto de estilo callejero, tomada desde la acera de enfrente.',
    lugar: 'En una acera de la ciudad',
    prompt: 'Vertical street style shot on a busy city sidewalk, photographed from across the street with a long lens, pedestrians blurred in the foreground, natural daylight, full outfit visible',
    puestaId: 'plano-secuencia',
    guion: 'Cuando empecé no tenía oficina ni equipo. Hoy te cuento las tres decisiones que me trajeron hasta aquí.',
    voz: 'rioplatense-mujer-2',
  },
  {
    id: 'lujo-silencioso',
    nombre: 'Lujo silencioso',
    categoria: 'Instagram',
    resumen: 'Editorial sobrio en el lobby de un hotel, tonos neutros.',
    lugar: 'En el lobby de un hotel elegante',
    prompt: 'Vertical editorial shot in an elegant hotel lobby with marble floors and warm table lamps, neutral tailored outfit in beige and cream tones, calm confident stance, soft natural light',
    puestaId: 'plano-secuencia',
    guion: 'La calidad no se grita, se nota. Te muestro por qué nuestros clientes vuelven y nos recomiendan.',
    voz: 'espana-hombre-1',
    nuevo: true,
  },
  {
    id: 'metro',
    nombre: 'En el metro',
    categoria: 'Instagram',
    resumen: 'Sentado en el vagón, con luz de tubo y la ciudad pasando.',
    lugar: 'Sentado en un vagón del metro',
    prompt: 'Vertical shot of a person seated inside a subway car, fluorescent overhead light, windows with motion blur, other passengers out of focus, candid documentary look',
    puestaId: 'voz-en-off',
    guion: 'Todos los días hago este viaje y lo uso para pensar en lo que quiero lograr. Hoy te comparto una idea que me cambió la semana.',
    voz: 'rioplatense-hombre-2',
  },
  {
    id: 'cabina-fotos',
    nombre: 'Cabina de fotos',
    categoria: 'Instagram',
    resumen: 'Foto de cabina antigua, en blanco y negro.',
    lugar: 'En una cabina de fotos antigua',
    prompt: 'Vertical vintage photo booth picture with a plain gray curtain background, direct flat flash, slightly faded black and white film, playful pose, small dust specks',
    puestaId: 'trends-virales',
    guion: 'Esto que ves es de cuando arranqué. Te cuento qué le diría hoy a esa persona que recién empezaba.',
    voz: 'latino-hombre-1',
  },

  // ── Cámara ─────────────────────────────────────────────────────────────────
  {
    id: 'selfie-iphone',
    nombre: 'Selfie de iPhone',
    categoria: 'Cámara',
    resumen: 'La selfie de todos los días, con la cámara frontal del teléfono.',
    lugar: 'Afuera, de día, con la cámara frontal',
    prompt: 'Vertical front camera selfie taken with a recent smartphone at arm length, outdoors in soft daylight, slight wide angle distortion, casual outfit, everyday background softly out of focus, natural phone processing',
    puestaId: 'ugc-sin-producto',
    guion: 'Te grabo esto rápido porque me lo preguntan todo el tiempo. La respuesta corta es esta, y la larga te la dejo abajo.',
    voz: 'mexicano-mujer-2',
    nuevo: true,
  },
  {
    id: 'selfie-gran-angular',
    nombre: 'Selfie 0.5',
    categoria: 'Cámara',
    resumen: 'Con el gran angular del teléfono, desde arriba.',
    lugar: 'En la calle, con el gran angular',
    prompt: 'Vertical ultra wide 0.5x lens selfie taken from slightly above, strong wide angle perspective, phone held high, playful framing, urban background, bright daylight',
    puestaId: 'trends-virales',
    guion: 'Si te sientes estancado, esto es para ti. Te muestro lo que hice cuando me pasó lo mismo.',
    voz: 'colombiano-mujer-1',
  },
  {
    id: 'ojo-de-pez',
    nombre: 'Ojo de pez',
    categoria: 'Cámara',
    resumen: 'Muy cerca del lente, con la deformación del ojo de pez.',
    lugar: 'En la calle, muy cerca de la cámara',
    prompt: 'Vertical fisheye lens shot very close to the camera, strong barrel distortion, person leaning toward the lens, street background curving around the frame, bright daylight, skate video look',
    puestaId: 'trends-virales',
    guion: 'Esto no te lo cuenta nadie, así que te lo cuento yo. Presta atención a lo que pasa al final.',
    voz: 'latino-hombre-2',
  },
  {
    id: 'camara-seguridad',
    nombre: 'Cámara de seguridad',
    categoria: 'Cámara',
    resumen: 'Vista desde la esquina del techo, como una cámara de seguridad.',
    lugar: 'En un local, visto desde la cámara del techo',
    prompt: 'High angle security camera view from a ceiling corner of a small shop, wide lens, slightly washed colors and low resolution, person looking up toward the camera, grainy surveillance look',
    puestaId: 'trends-virales',
    guion: 'Nos quedó grabado el momento exacto en que un cliente entendió lo que hacemos. Te lo explico en diez segundos.',
    voz: 'rioplatense-hombre-3',
    nuevo: true,
  },
  {
    id: 'camara-2000',
    nombre: 'Cámara digital 2000',
    categoria: 'Cámara',
    resumen: 'Con flash directo, como una cámara compacta de los 2000.',
    lugar: 'De noche, con flash directo',
    prompt: 'Vertical photo taken with an early 2000s compact digital camera with direct flash at night, harsh flash highlights, dark background, slight noise, candid party moment',
    puestaId: 'ugc-sin-producto',
    guion: 'Esta foto es de la noche que festejamos el primer gran cliente. Te cuento cómo llegamos ahí.',
    voz: 'espana-mujer-2',
  },
  {
    id: 'grano-90',
    nombre: 'Grano de los 90',
    categoria: 'Cámara',
    resumen: 'Rollo de 35 mm con grano y colores gastados.',
    lugar: 'Afuera, con luz de tarde',
    prompt: 'Vertical 35mm film photo with visible grain and warm faded colors, 1990s snapshot aesthetic, soft afternoon daylight, slightly off center framing, casual outfit',
    puestaId: 'plano-secuencia',
    guion: 'Hay cosas que no pasan de moda, y la confianza es una. Te cuento cómo la construimos con cada cliente.',
    voz: 'mexicano-hombre-1',
  },

  // ── Negocio ────────────────────────────────────────────────────────────────
  {
    id: 'oficina-presentador',
    nombre: 'Presentador en la oficina',
    categoria: 'Negocio',
    resumen: 'Hablas a cámara en una oficina luminosa.',
    lugar: 'En una oficina con ventanales',
    prompt: 'Vertical medium shot of a person standing in a bright modern office with floor to ceiling windows and city view, plants in the background, natural daylight, looking at camera, calm and confident stance, handheld camera feel',
    puestaId: 'plano-secuencia',
    guion: 'Si tienes un negocio y sientes que trabajas todo el día sin avanzar, quédate. En treinta segundos te muestro cómo lo resolvemos.',
    voz: 'rioplatense-hombre-3',
    ejemplo: { video: '/formatos/plano-secuencia.mp4', poster: '/formatos/plano-secuencia.jpg' },
  },
  {
    id: 'podcast-experto',
    nombre: 'Experto en el podcast',
    categoria: 'Negocio',
    resumen: 'Explicas un tema con autoridad, en un estudio de podcast.',
    lugar: 'En un estudio de podcast',
    prompt: 'Vertical medium shot of a person seated at a podcast desk with a studio microphone on a boom arm, warm practical lights and acoustic panels behind, looking slightly off camera as if talking to a host, cinematic but natural look',
    puestaId: 'podcast',
    guion: 'El error más común que veo es querer hacer todo al mismo tiempo. Te explico cómo ordenarlo en tres pasos.',
    voz: 'latino-hombre-2',
  },
  {
    id: 'escritorio-demo',
    nombre: 'Demostración en la compu',
    categoria: 'Negocio',
    resumen: 'Muestras cómo funciona, frente a la computadora.',
    lugar: 'En un escritorio de casa, frente a la computadora',
    prompt: 'Vertical medium shot of a person sitting at a home desk with a laptop open, turning slightly toward the camera, desk lamp and bookshelf behind, natural window light, casual look, handheld phone camera feel',
    puestaId: 'plano-secuencia',
    guion: 'Te muestro cómo lo hago en dos minutos. Primero entro aquí, después elijo esto, y listo: ya está funcionando.',
    voz: 'colombiano-mujer-1',
  },
  {
    id: 'frente-casa',
    nombre: 'Frente a la propiedad',
    categoria: 'Negocio',
    resumen: 'Presentas una propiedad parado en la entrada.',
    lugar: 'En la entrada de una casa en venta',
    prompt: 'Vertical shot in front of a modern house with a small front garden, sunny day, person holding a set of keys toward the camera, welcoming stance, real estate tour look, handheld phone camera feel',
    puestaId: 'plano-secuencia',
    guion: 'Esta casa salió hoy y no va a durar. Te muestro en un minuto por qué es una oportunidad para vivir o para invertir.',
    voz: 'mexicano-hombre-2',
    nuevo: true,
  },
  {
    id: 'biblioteca',
    nombre: 'En la biblioteca',
    categoria: 'Negocio',
    resumen: 'Entre estantes de libros, con luz cálida de lectura.',
    lugar: 'Entre los estantes de una biblioteca',
    prompt: 'Vertical shot between tall wooden bookshelves in a quiet library, warm reading lamps, person holding an open book, calm thoughtful mood, soft natural light',
    puestaId: 'voz-en-off',
    guion: 'Leí más de cincuenta libros de negocios y casi todos dicen lo mismo. Te resumo la única idea que de verdad aplico.',
    voz: 'espana-hombre-2',
  },

  // ── Producto ───────────────────────────────────────────────────────────────
  {
    id: 'cocina-producto',
    nombre: 'Producto en mano',
    categoria: 'Producto',
    resumen: 'Muestras el producto en la cocina, como una recomendación.',
    lugar: 'En la cocina de casa, con el producto en la mano',
    prompt: 'Vertical UGC shot in a home kitchen with warm morning light, person holding a product box at chest height toward the camera, countertop and plants slightly out of focus, casual clothes, phone camera look',
    puestaId: 'ugc-con-producto',
    guion: 'Esto lo uso todos los días y te digo por qué. Es simple, rinde un montón y me ahorra tiempo. Te dejo el link abajo.',
    voz: 'mexicano-mujer-2',
  },
  {
    id: 'unboxing-mesa',
    nombre: 'Abriendo la caja',
    categoria: 'Producto',
    resumen: 'El unboxing en la mesa de la sala, recién llegado.',
    lugar: 'En la sala, abriendo un paquete',
    prompt: 'Vertical UGC shot at a living room coffee table opening a cardboard package, tissue paper and the product partly visible, afternoon window light, candid excited moment, phone camera look',
    puestaId: 'ugc-con-producto',
    guion: 'Me acaba de llegar y lo abro contigo. Te digo la primera impresión sin filtro, lo bueno y lo que mejoraría.',
    voz: 'colombiano-mujer-2',
  },

  // ── Clima y luz ────────────────────────────────────────────────────────────
  {
    id: 'dia-lluvia',
    nombre: 'Día de lluvia',
    categoria: 'Clima y luz',
    resumen: 'En la acera mojada, con paraguas y luz de día nublado.',
    lugar: 'En la calle, un día de lluvia',
    prompt: 'Vertical shot on a city sidewalk on a rainy day holding a transparent umbrella, wet pavement reflections, overcast soft light, raindrops in the air, moody but natural',
    puestaId: 'plano-secuencia',
    guion: 'Llueve, hace frío y aun así salí, porque esto te lo tenía que contar hoy.',
    voz: 'rioplatense-mujer-1',
  },
  {
    id: 'niebla',
    nombre: 'Mañana con niebla',
    categoria: 'Clima y luz',
    resumen: 'En el parque, con niebla y luz pálida de la mañana.',
    lugar: 'En un parque, una mañana con niebla',
    prompt: 'Vertical shot in a park on a foggy morning, diffused pale light, trees fading into the mist, person wearing a warm coat, calm atmosphere',
    puestaId: 'voz-en-off',
    guion: 'Empiezo cada día igual: diez minutos para pensar antes de mirar el teléfono. Te cuento por qué.',
    voz: 'latino-mujer-1',
  },
  {
    id: 'atardecer-playa',
    nombre: 'Atardecer en la playa',
    categoria: 'Clima y luz',
    resumen: 'Contraluz dorado del atardecer, con el mar detrás.',
    lugar: 'En la playa, al atardecer',
    prompt: 'Vertical shot on a beach at sunset, golden backlight, soft lens flare, gentle waves behind, relaxed summer outfit, phone camera look',
    puestaId: 'ugc-sin-producto',
    guion: 'Hace un año no me podía tomar ni un fin de semana. Hoy trabajo desde donde quiero, y te cuento cómo.',
    voz: 'mexicano-mujer-1',
    nuevo: true,
  },
  {
    id: 'bajo-el-foco',
    nombre: 'Bajo el foco',
    categoria: 'Clima y luz',
    resumen: 'Un solo foco desde arriba y el fondo en negro.',
    lugar: 'En un escenario oscuro, bajo un foco',
    prompt: 'Vertical shot on a dark stage with a single hard spotlight from above, deep black background, dramatic contrast, person standing center stage, theatrical mood',
    puestaId: 'plano-secuencia',
    guion: 'Si te quedas con una sola idea de este video, que sea esta. Lo demás es ruido.',
    voz: 'espana-hombre-1',
  },
  // Los 5 presets de las plantillas de venta (docs/plantillas-reales/avatar.md, AV-1; 6/11/2026): viven con sus plantillas
  // en ./plantillas-venta.ts y entran acá para que el estudio y la galería los conozcan como a cualquier otro.
  ...PRESETS_NUEVOS_VENTA,
]);

/**
 * La voz de la galería que sugiere cada plantilla, por una clave estable
 * (`<acento>-<genero>-<n>`) y no por el id de ElevenLabs: si una voz se va de la
 * biblioteca pública, se cambia en un solo lugar.
 */
export function vozSugerida(clave: string) {
  const m = /^(rioplatense|mexicano|latino|colombiano|espana)-(mujer|hombre)-(\d+)$/.exec(clave);
  if (!m) return null;
  const acento = { rioplatense: 'Rioplatense', mexicano: 'Mexicano', latino: 'Latino neutro', colombiano: 'Colombiano', espana: 'España' }[m[1]];
  const del = VOCES_GALERIA.filter((v) => v.acento === acento && v.genero === m[2]);
  return del[Number(m[3]) - 1] ?? del[0] ?? null;
}

export function plantillaPorId(id: string): PlantillaAvatar | null {
  return PLANTILLAS_AVATAR.find((p) => p.id === id) ?? null;
}

/** El filtro del selector: una categoría, «Nuevos» o todos (`null`), y lo que se escribió en «Buscar presets». */
export function filtrarPresets(filtro: Categoria | 'Nuevos' | null, busca: string): PlantillaAvatar[] {
  const q = normal(busca);
  return PLANTILLAS_AVATAR.filter((p) => {
    if (filtro === 'Nuevos' && !p.nuevo) return false;
    if (filtro && filtro !== 'Nuevos' && p.categoria !== filtro) return false;
    return !q || normal(`${p.nombre} ${p.resumen} ${p.lugar} ${p.categoria}`).includes(q);
  });
}

/** Sin tildes ni mayúsculas: «camara» encuentra «Cámara». */
function normal(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
