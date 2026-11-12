// =============================================================================
// /vsl/ai-avatar — la landing de AI Avatar, con la ESTRUCTURA de la página de HeyGen para anuncios UGC (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, el DISEÑO):
//   https://www.heygen.com/es-mx/business/marketing/ugc-video-ads  (leída el 11/11/2026 con Chromium)
// El diseño copiado vive en ./disenos/ai-avatar.tsx; los valores medidos, en docs/diseno/landings-competencia/ai-avatar.md.
// Su orden, que se respeta acá bloque por bloque: hero (etiqueta, titular, bajada, dos renglones y el botón) → contadores →
// «El reto»: sin HeyGen / con HeyGen → 6 beneficios → «De la idea al video publicado en 3 pasos» → 6 casos de uso →
// reseñas y testimonios → preguntas frecuentes. Por qué ganó ésta: docs/competencia/landings-por-funcion.md → «AI Avatar».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus contadores son de USO (180 millones de videos). MaKo no tiene uno que mostrar: van los números de lo que la
//     función TRAE, contados del código (las escenas, los estilos y las plantillas de venta). Son tres, como sus tres
//     tarjetas negras; «una foto tuya para empezar» ya lo dice el hero.
//   · Sus reseñas son de HeyGen entero. La prueba de MaKo es la de todas sus landings: el caso de Mauricio. No se inventa
//     un testimonio de AI Avatar.
//   · Sus 6 beneficios se dicen con lo que AI Avatar hace hoy (lib/funciones-mako.ts y lib/ai-avatar/): tu cara y no un
//     actor, escenas imperfectas a propósito, ajustar la escena escribiendo, lo que falta antes de generar.
//   · Sus 6 casos de uso son las plantillas de venta de MaKo (lib/ai-avatar/plantillas-venta.ts), con su «cuándo usarla».
//
// Lo que NO se promete porque hoy no está (lib/funciones-mako.ts → `noHace`): tu voz clonada en el video, copiar el
// movimiento de otro video y un personaje sin foto. Lo dicen las preguntas, con «todavía no».
//
// Desde el 11/11/2026 AI Avatar no es una tab: se usa desde Video, con la plantilla «Tu personaje con IA»
// (app/video-editor/plantillas-crear.ts). La pregunta «¿Dónde está en MaKo?» lo dice con el nombre que se lee en pantalla.
// =============================================================================

import { CATEGORIAS, PLANTILLAS_AVATAR } from '@/lib/ai-avatar/plantillas';
import { PLANTILLAS_VENTA_AVATAR } from '@/lib/ai-avatar/plantillas-venta';
import { CONSEJO_FOTO } from '@/lib/ai-avatar/estudio';
import { CREDITOS } from '@/lib/ai-avatar/requisitos';
import type { LandingCompetencia } from './tipos';

const I = {
  avatar: ['M10 9a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M4 8v-2a2 2 0 0 1 2 -2h2', 'M4 16v2a2 2 0 0 0 2 2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M16 20h2a2 2 0 0 0 2 -2v-2', 'M8 16a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2'],
  camara: ['M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2', 'M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0'],
  otra: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
  lapiz: ['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4'],
  carpeta: ['M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2'],
  lista: ['M3.5 5.5l1.5 1.5l2.5 -2.5', 'M3.5 11.5l1.5 1.5l2.5 -2.5', 'M3.5 17.5l1.5 1.5l2.5 -2.5', 'M11 6l9 0', 'M11 12l9 0', 'M11 18l9 0'],
  guion: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
};

// El ejemplo del visual: la primera plantilla de venta, con su escena y la primera línea de su guion (el gancho).
const EJEMPLO = PLANTILLAS_VENTA_AVATAR[0];
const ESCENA_EJEMPLO = PLANTILLAS_AVATAR.find((p) => p.id === EJEMPLO.presetId);
const GANCHO_EJEMPLO = EJEMPLO.ejemplo.guion.split('\n')[1] ?? '';

const N_ESCENAS = PLANTILLAS_AVATAR.length;
const N_ESTILOS = CATEGORIAS.length;
const N_PLANTILLAS = PLANTILLAS_VENTA_AVATAR.length;

export const LANDING_AI_AVATAR: LandingCompetencia = {
  slug: 'ai-avatar',
  nombre: 'AI Avatar',
  icono: I.avatar,
  referencia: { nombre: 'HeyGen — anuncios UGC con avatares (es-MX)', url: 'https://www.heygen.com/es-mx/business/marketing/ugc-video-ads', leida: '2026-11-11' },
  metaTitle: 'AI Avatar de MaKo: tus anuncios con tu cara, sin grabarte cada vez',
  metaDesc: `Subes una foto tuya, eliges una de ${N_ESCENAS} escenas y MaKo genera tu avatar diciendo tu guion, en video vertical para tus anuncios de Meta, TikTok e Instagram.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Anuncios con tu avatar de IA',
      titulo: 'Tus anuncios con tu cara, sin grabarte cada vez.',
      bajada: 'Subes una foto tuya, eliges una escena y MaKo te pone ahí, <strong>diciendo tu guion</strong>. Videos verticales para tus anuncios de Meta, TikTok e Instagram, sin volver a prender la cámara.',
      puntos: ['Una foto de tu cara alcanza para empezar', `${N_ESCENAS} escenas y ${N_PLANTILLAS} plantillas de venta con su guion`],
      visual: { tipo: 'avatar', escena: EJEMPLO.nombre, estilo: ESCENA_EJEMPLO?.categoria ?? 'UGC y TikTok', frase: GANCHO_EJEMPLO, segundos: EJEMPLO.duracion },
    },
    {
      tipo: 'cifras',
      titulo: 'Lo que trae AI Avatar hoy',
      items: [
        { valor: String(N_ESCENAS), label: 'escenas listas para usar' },
        { valor: String(N_ESTILOS), label: 'estilos: UGC, Instagram, cámara, negocio, producto y clima' },
        { valor: String(N_PLANTILLAS), label: 'plantillas de venta con su guion' },
      ],
    },
    {
      tipo: 'contraste',
      etiqueta: 'El reto de los anuncios con tu cara',
      titulo: 'Probar un gancho nuevo no debería costarte otra grabación',
      sin: {
        titulo: 'Cada gancho nuevo es otra sesión frente a la cámara',
        texto: 'Para que tus anuncios no se cansen tienes que probar ganchos nuevos todo el tiempo. Y cada uno es volver a armar la luz, buscar el lugar y repetir la toma hasta que salga. Contratar creadores tampoco te resuelve: en high ticket la gente compra tu experiencia, y en el anuncio tiene que estar <strong>tu</strong> cara.',
      },
      con: {
        titulo: 'Una foto tuya, y cada anuncio sale de un guion',
        texto: 'Subes tu foto una vez. Eliges dónde quieres aparecer —tu auto, una oficina, un podcast, la calle— y escribes lo que vas a decir. MaKo arma tu avatar en esa escena y lo anima diciendo tu guion. ¿Otro gancho? <strong>Cambias el texto y lo vuelves a generar.</strong>',
      },
      cta: true,
    },
    {
      tipo: 'tarjetas',
      titulo: 'Todo lo que necesitas para probar más anuncios con tu cara',
      items: [
        { icono: I.avatar, titulo: 'Tu cara, no la de un actor', texto: 'La identidad la pone tu foto. MaKo describe la escena —el lugar, la luz, el encuadre— y <strong>nunca tu cara</strong>, para que el avatar se siga pareciendo a ti.' },
        { icono: I.camara, titulo: 'Escenas imperfectas a propósito', texto: 'Grano de celular, luz real, encuadres de selfie: lo perfecto delata a la IA, así que las escenas se ven como un video grabado con el teléfono.' },
        { icono: I.otra, titulo: 'Más ganchos, sin volver a grabarte', texto: 'Cambias el guion y generas otra versión con el mismo avatar. Pruebas el gancho, no tu paciencia frente a la cámara.' },
        { icono: I.lapiz, titulo: 'Ajustas la escena con tus palabras', texto: '«Con camisa blanca de lino», «de noche»: lo escribes y se suma a la escena, sin tocar tu cara.' },
        { icono: I.carpeta, titulo: 'Tu avatar queda listo para el próximo anuncio', texto: 'Vuelves a cada avatar y a sus videos desde tu estudio, y partes de ahí para la siguiente versión.' },
        { icono: I.lista, titulo: 'Te dice qué falta antes de generar', texto: 'Si te falta algo para generar, MaKo te lo muestra paso a paso <strong>antes</strong> de que aprietes el botón. Nada falla callado.' },
      ],
    },
    {
      tipo: 'pasos',
      fondo: true,
      titulo: 'De tu foto al anuncio, en 3 pasos',
      pasos: [
        { titulo: 'Sube tu foto', texto: `${CONSEJO_FOTO} Es la que pone tu cara en cada escena.` },
        { titulo: 'Elige la escena', texto: `Tu auto, el podcast, la oficina, la cocina o la calle: ${N_ESCENAS} escenas en ${N_ESTILOS} estilos. Si quieres, la ajustas escribiendo, por ejemplo «con camisa blanca de lino».` },
        { titulo: 'Escribe tu guion y genera', texto: 'Pegas lo que vas a decir o partes del guion de ejemplo de la plantilla. MaKo anima tu avatar diciéndolo, en <strong>video vertical</strong> para Reels, TikTok y tus anuncios.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Una plantilla de venta para cada momento del embudo',
      bajada: 'Cada una trae su escena, su estructura de guion y un ejemplo completo para reemplazar con lo tuyo.',
      columnas: 3,
      items: PLANTILLAS_VENTA_AVATAR.map((p) => ({ icono: I.guion, titulo: p.nombre, texto: p.cuando, meta: `Ejemplo de ${p.duracion} s` })),
    },
    { tipo: 'caso' },
    {
      tipo: 'preguntas',
      titulo: '¿Tienes preguntas? Aquí las respuestas',
      items: [
        { p: '¿Tengo que grabarme?', r: `No. ${CONSEJO_FOTO} Con eso MaKo arma tu avatar en la escena que elijas.` },
        { p: '¿El video habla con mi voz?', r: 'Todavía no. El video habla con una voz generada: tu voz clonada en el video no está disponible.' },
        { p: '¿Qué necesito para generar?', r: `Google Flow abierto con tu cuenta, en Chrome, y la extensión de MaKo conectada a tu negocio. ${CREDITOS} MaKo te muestra paso a paso qué te falta antes de generar.` },
        { p: '¿Puedo crear un personaje sin foto, o copiar el movimiento de otro video?', r: 'Todavía no. Hoy tu avatar parte siempre de tu foto, y la escena que eliges pone el lugar, la luz y el encuadre.' },
        { p: '¿En qué formato sale?', r: 'En vertical, para Reels, TikTok, historias y tus anuncios en esos lugares.' },
        { p: '¿Dónde está en MaKo?', r: 'En Video: al crear un video nuevo, la plantilla «Tu personaje con IA».' },
        { p: '¿Está incluido en mi plan?', r: 'Sí: AI Avatar está en todos los planes de MaKo. Lo que se gasta al generar son los créditos de tu cuenta de Google Flow.' },
      ],
    },
  ],
};
