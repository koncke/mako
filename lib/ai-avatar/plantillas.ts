// =============================================================================
// La galería de TEMAS de AI Avatar: plantillas por tipo de anuncio
// =============================================================================
// Copiado de la galería de HeyGen (por su documentación: las categorías de
// https://www.heygen.com/business/marketing/ugc-video-ads y los «Look Packs» de
// https://www.heygen.com/academy/avatars/how-to-generate-looks, 17/10/2026). Una
// plantilla es lo que HeyGen llama «Look = personaje + escena» más un guion de
// ejemplo: la persona elige el tema, MaKo arma el look con SU cara y, si quiere,
// el video con el guion.
//
// Las reglas de la casa que mandan acá (docs/hallazgos-generativa.md):
//   · `prompt` describe la COMPOSICIÓN —lugar, luz, encuadre, pose— y NUNCA la
//     cara: la identidad la pone la foto. Describir el aspecto rompía el parecido.
//   · Imperfecto a propósito (grano de celular, luz real) y la actuación hacia
//     abajo (calma, natural): lo perfecto «canta a IA».
//   · El cliente nunca ve un prompt: ve `lugar` y `resumen`.
//   · `puestaId` es el formato del Video Generator: decide el encuadre de las tomas.
//   · `guion` es un ejemplo en español neutro, de tú: la persona lo reemplaza.
//
// SIN `server-only`: lo leen la pantalla y el server.

import { VOCES_GALERIA } from './voces-galeria';

export const CATEGORIAS = ['Testimonio', 'Producto', 'Presentador', 'Demostración', 'Promoción', 'Detrás de escena'] as const;
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
  /** Un video real hecho con este formato, si lo hay. */
  ejemplo?: { video: string; poster: string };
};

export const PLANTILLAS_AVATAR: readonly PlantillaAvatar[] = Object.freeze([
  {
    id: 'auto-testimonio',
    nombre: 'Charla en el auto',
    categoria: 'Testimonio',
    resumen: 'Cuentas tu experiencia como si grabaras con el celular.',
    lugar: 'En el auto, estacionado, de día',
    prompt: 'Vertical selfie shot from the driver seat of a parked car, daytime soft light through the side window, seatbelt on, phone held at arm length, relaxed posture, casual t-shirt, natural phone camera look with slight grain, background of a quiet residential street',
    puestaId: 'selfie-movimiento',
    guion: 'El otro día me preguntaron cómo hice para ordenar mi negocio. Te cuento lo que me cambió todo, porque a mí también me costaba.',
    voz: 'rioplatense-hombre-1',
    ejemplo: { video: '/formatos/selfie-movimiento.mp4', poster: '/formatos/selfie-movimiento.jpg' },
  },
  {
    id: 'oficina-presentador',
    nombre: 'Presentador en la oficina',
    categoria: 'Presentador',
    resumen: 'Hablas a cámara en una oficina luminosa.',
    lugar: 'En una oficina con ventanales',
    prompt: 'Vertical medium shot of a person standing in a bright modern office with floor to ceiling windows and city view, plants in the background, natural daylight, looking at camera, calm and confident stance, handheld camera feel',
    puestaId: 'plano-secuencia',
    guion: 'Si tienes un negocio y sientes que trabajas todo el día sin avanzar, quédate. En treinta segundos te muestro cómo lo resolvemos.',
    voz: 'rioplatense-hombre-3',
    ejemplo: { video: '/formatos/plano-secuencia.mp4', poster: '/formatos/plano-secuencia.jpg' },
  },
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
    id: 'espejo-resultado',
    nombre: 'Antes y después',
    categoria: 'Testimonio',
    resumen: 'Cuentas el resultado frente al espejo, sin producto a la vista.',
    lugar: 'En casa, frente al espejo del baño',
    prompt: 'Vertical mirror selfie in a clean home bathroom, soft diffused light, person holding the phone, relaxed expression, towel and plants in the background, phone camera look with slight grain',
    puestaId: 'ugc-sin-producto',
    guion: 'Hace tres meses estaba igual que tú. No te voy a vender humo: te cuento qué hice distinto y qué resultado tuve.',
    voz: 'latino-mujer-1',
  },
  {
    id: 'podcast-experto',
    nombre: 'Experto en el podcast',
    categoria: 'Presentador',
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
    categoria: 'Demostración',
    resumen: 'Muestras cómo funciona, frente a la computadora.',
    lugar: 'En un escritorio de casa, frente a la computadora',
    prompt: 'Vertical medium shot of a person sitting at a home desk with a laptop open, turning slightly toward the camera, desk lamp and bookshelf behind, natural window light, casual look, handheld phone camera feel',
    puestaId: 'plano-secuencia',
    guion: 'Te muestro cómo lo hago en dos minutos. Primero entro aquí, después elijo esto, y listo: ya está funcionando.',
    voz: 'colombiano-mujer-1',
  },
  {
    id: 'calle-promo',
    nombre: 'Promo caminando',
    categoria: 'Promoción',
    resumen: 'Anuncias una oferta caminando por la calle.',
    lugar: 'Caminando por una calle con negocios',
    prompt: 'Vertical selfie walking shot on a sunny street with small shops, person holding the phone at arm length while walking, natural motion, daylight, casual outfit, slight phone camera shake',
    puestaId: 'trends-virales',
    guion: 'Solo hasta el domingo tienes un descuento que no vas a ver de nuevo. Te cuento qué incluye y cómo aprovecharlo.',
    voz: 'rioplatense-mujer-1',
  },
  {
    id: 'cafe-un-dia',
    nombre: 'Un día conmigo',
    categoria: 'Detrás de escena',
    resumen: 'Muestras tu día de trabajo, con voz en off.',
    lugar: 'En un café, trabajando con la computadora',
    prompt: 'Vertical shot of a person working on a laptop at a cozy cafe table with a coffee cup, warm ambient light, people blurred in the background, candid moment, natural phone camera look',
    puestaId: 'voz-en-off',
    guion: 'Así es un día normal en mi negocio. Arranco temprano, respondo mensajes y después me enfoco en lo que de verdad mueve la aguja.',
    voz: 'espana-mujer-1',
  },
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
