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
//
// LOS TEXTOS DE HEYGEN, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual, porque
// coinciden con MaKo»), traducidos a español neutro de tú. Sólo se cambió la palabra que en MaKo no es cierta:
//   · el titular «Anuncios de video estilo UGC que generan conversiones sin contratar creadores» → «…con tu cara, sin
//     contratar creadores» (las conversiones no están medidas; la cara es lo que MaKo pone);
//   · la bajada «Genera anuncios de video UGC auténticos con avatares de IA que se ven y se sienten como contenido real de
//     creadores…» → con TU avatar, que se ve como un video grabado con el celular (las escenas imperfectas a propósito);
//   · «Actualiza el contenido al instante cuando cambien tus productos» → «…cuando cambie tu oferta: cambias el guion»;
//   · «El reto del marketing», «El reto de crear contenido de marketing», «La solución de HeyGen» (→ de MaKo), sin sus
//     números ($200-500 por video, 3-5 veces más conversiones, 175 idiomas: no son de MaKo);
//   · los seis beneficios con sus nombres: «Pruebas ilimitadas…» → «Más pruebas de creatividades» (cada video gasta
//     créditos de Flow), «Estética auténtica de creador», «Control creativo total», «Calidad constante», «Sin problemas de
//     derechos de uso»; «Resultados al instante» se cambió por «Tu cara, no la de un actor» (el tiempo no está medido);
//   · los 3 pasos «Escribe tu gancho» (su texto entero), «Elige tu estilo de creador» → «Elige tu escena» (con escenas de
//     MaKo de lib/ai-avatar/plantillas.ts), «Genera e implementa» → «Genera tu anuncio» (MaKo no lo sube a Meta solo);
//   · «De la idea al video publicado en 3 pasos» → «…al anuncio listo» (no publica), «Diseñado para todas tus
//     necesidades de marketing» → «…para cada momento de tu embudo», «¿Tienes preguntas? Tenemos respuestas».
// =============================================================================

import { CATEGORIAS, PLANTILLAS_AVATAR } from '@/lib/ai-avatar/plantillas';
import { PLANTILLAS_VENTA_AVATAR, PRESETS_NUEVOS_VENTA, ganchoDeEjemplo } from '@/lib/ai-avatar/plantillas-venta';
import { CONSEJO_FOTO } from '@/lib/ai-avatar/estudio';
import { CREDITOS } from '@/lib/ai-avatar/requisitos';
import type { EscenaAvatar, LandingCompetencia } from './tipos';

const I = {
  avatar: ['M10 9a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M4 8v-2a2 2 0 0 1 2 -2h2', 'M4 16v2a2 2 0 0 0 2 2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M16 20h2a2 2 0 0 0 2 -2v-2', 'M8 16a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2'],
  camara: ['M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2', 'M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0'],
  otra: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
  lapiz: ['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4'],
  carpeta: ['M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2'],
  lista: ['M3.5 5.5l1.5 1.5l2.5 -2.5', 'M3.5 11.5l1.5 1.5l2.5 -2.5', 'M3.5 17.5l1.5 1.5l2.5 -2.5', 'M11 6l9 0', 'M11 12l9 0', 'M11 18l9 0'],
  guion: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
};

// El visual del hero: tres plantillas de venta con la IMAGEN REAL de su preset (public/formatos/presets/, hechas en Flow con
// la cara de Martín; él lo aprobó el 12/11/2026: «Sí, con imágenes»). HeyGen pone ahí el video de un creador; MaKo, tu
// cara en tres escenas. La primera es la principal: lleva la primera frase de su gancho como subtítulo. Se eligieron por
// la imagen (una selfie, la calle con micrófono, el podcast): las tres se leen al primer vistazo como un anuncio UGC.
// 14/11/2026 (la copia fiel de HeyGen): en el hero va ahora el REPRODUCTOR con el anuncio de Martín (como el video de HeyGen); estas
// tres escenas se dibujan en los pasos 2 y 3 (disenos/ai-avatar.tsx). ⚠️ PENDIENTE de Martín: las imágenes de los presets NO
// muestran su cara sino la de un hombre que se parece a Mauricio (CLIENTE); hasta que lo confirme no se suman en ningún lugar nuevo.
const ESCENAS_DEL_HERO = ['respondo-comentario', 'entrevista-calle', 'episodio-podcast'] as const;
const PRESETS = [...PLANTILLAS_AVATAR, ...PRESETS_NUEVOS_VENTA];

/** La primera oración de lo que dice el avatar en el gancho: es lo que entra en el subtítulo de un teléfono. */
function primeraFrase(texto: string): string {
  const m = texto.match(/^.+?[.!?»](?=\s|$)/);
  return (m ? m[0] : texto).trim();
}

export const ESCENAS_AVATAR: EscenaAvatar[] = ESCENAS_DEL_HERO.flatMap((id) => {
  const p = PLANTILLAS_VENTA_AVATAR.find((x) => x.id === id);
  const preset = p ? PRESETS.find((x) => x.id === p.presetId) : undefined;
  if (!p || !preset?.ejemplo?.poster) return [];
  return [{ escena: p.nombre, poster: preset.ejemplo.poster, frase: primeraFrase(ganchoDeEjemplo(p).dice), segundos: p.duracion }];
});

const N_ESCENAS = PLANTILLAS_AVATAR.length;
const N_ESTILOS = CATEGORIAS.length;
const N_PLANTILLAS = PLANTILLAS_VENTA_AVATAR.length;

export const LANDING_AI_AVATAR: LandingCompetencia = {
  slug: 'ai-avatar',
  nombre: 'AI Avatar',
  icono: I.avatar,
  referencia: { nombre: 'HeyGen — anuncios UGC con avatares (es-MX)', url: 'https://www.heygen.com/es-mx/business/marketing/ugc-video-ads', leida: '2026-11-11' },
  metaTitle: 'AI Avatar de MaKo: anuncios de video estilo UGC con tu cara, sin contratar creadores',
  metaDesc: `Subes una foto tuya, eliges una de ${N_ESCENAS} escenas y MaKo genera tu avatar diciendo tu guion, en video vertical para tus anuncios de Meta, TikTok e Instagram.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Anuncios en video estilo UGC',
      titulo: 'Anuncios de video estilo UGC con tu cara, sin contratar creadores',
      bajada: 'Genera anuncios de video UGC con <strong>tu avatar de IA</strong>, que se ven y se sienten como un video grabado con el celular. Produce más anuncios para TikTok, Instagram y Meta sin tener que coordinar creadores, negociar tarifas ni esperar entregas.',
      puntos: ['Una foto de tu cara alcanza para empezar', 'Actualiza el anuncio cuando cambie tu oferta: cambias el guion y lo vuelves a generar'],
      visual: { tipo: 'avatar', escenas: ESCENAS_AVATAR },
    },
    {
      tipo: 'cifras',
      // El renglón de debajo de la cinta (HeyGen: «Millones de personas… confían en nosotros», debajo de sus logos de clientes).
      // La cinta de MaKo pasa los lugares donde va el video vertical: el renglón dice eso.
      titulo: 'En vertical, listo para Instagram, TikTok, Facebook y tus anuncios de Meta.',
      items: [
        { valor: String(N_ESCENAS), label: 'escenas listas para usar' },
        // Un renglón, como «Videos generados» en las tarjetas de HeyGen (cuáles son, lo dice el paso «Elige tu escena»).
        { valor: String(N_ESTILOS), label: 'estilos de escena' },
        { valor: String(N_PLANTILLAS), label: 'plantillas de venta con su guion' },
      ],
    },
    {
      tipo: 'contraste',
      etiqueta: 'El reto del marketing',
      titulo: 'Crea anuncios a escala con una plataforma que convierte tu guion en video con IA.',
      sin: {
        titulo: 'El reto de crear contenido de marketing',
        texto: 'Tus anuncios que mejor funcionan suelen ser videos estilo UGC, pero producirlos a gran escala es lento y costoso. Coordinar creadores, negociar derechos de uso y esperar las entregas pronto se vuelve una carga, mientras tú sigues necesitando decenas de variantes para descubrir qué funciona. Y en high ticket la gente compra tu experiencia: en el anuncio tiene que estar <strong>tu</strong> cara.',
      },
      con: {
        titulo: 'La solución de MaKo',
        texto: `El creador de anuncios con IA de MaKo genera anuncios de video estilo UGC sin contratar creadores. Subes tu foto una vez y eliges una de ${N_ESCENAS} escenas que se ven naturales en TikTok e Instagram. Solo escribe tu guion y genera tu anuncio sin coordinar creadores, negociar derechos de uso ni esperar. ¿Necesitas varias versiones para probar distintos ganchos? <strong>Cambias el texto y lo vuelves a generar</strong> con el mismo avatar.`,
      },
      cta: true,
    },
    {
      tipo: 'tarjetas',
      titulo: 'Todo lo que necesitas para crear anuncios a gran escala',
      items: [
        { icono: I.otra, titulo: 'Más pruebas de creatividades', texto: 'Genera variantes de tu anuncio para probar distintos ganchos, problemas de tu audiencia, beneficios y llamados a la acción. <strong>Sin pagarle a un creador por cada variante.</strong>' },
        { icono: I.camara, titulo: 'Estética auténtica de creador', texto: 'Un look de video grabado con celular: grano, luz real, encuadres de selfie. Un mensaje directo a cámara. Las escenas son imperfectas a propósito, para que tus anuncios se integren en el feed como contenido nativo.' },
        { icono: I.avatar, titulo: 'Tu cara, no la de un actor', texto: 'La identidad la pone tu foto. MaKo describe la escena —el lugar, la luz, el encuadre— y <strong>nunca tu cara</strong>, para que el avatar se siga pareciendo a ti.' },
        { icono: I.lapiz, titulo: 'Control creativo total', texto: 'Tu visión, sin interpretaciones de un creador. Escribe en el guion exactamente lo que quieres decir, y ajusta la escena con tus palabras: «con camisa blanca de lino», «de noche».' },
        { icono: I.carpeta, titulo: 'Calidad constante', texto: 'El mismo avatar, la misma escena y un estilo uniforme. Vuelves a cada avatar y a sus videos desde tu estudio, y partes de ahí para el próximo anuncio.' },
        { icono: I.lista, titulo: 'Sin problemas de derechos de uso', texto: 'Es tu cara: sin contratos que vencen ni renegociar para seguir usándola. Y si te falta algo para generar, MaKo te lo muestra paso a paso <strong>antes</strong> de que aprietes el botón.' },
      ],
    },
    {
      tipo: 'pasos',
      fondo: true,
      titulo: 'De la idea al anuncio listo en 3 pasos',
      pasos: [
        { titulo: 'Escribe tu gancho', texto: 'Escribe el guion de tu anuncio. Empieza con un gancho que haga que la gente deje de deslizar. Aborda un problema. Presenta una solución. Incluye un llamado a la acción claro. O parte del guion de ejemplo de una plantilla de venta.' },
        { titulo: 'Elige tu escena', texto: `Sube ${CONSEJO_FOTO.charAt(0).toLowerCase()}${CONSEJO_FOTO.slice(1)} Después eliges el escenario: tu auto para un toque auténtico, un gimnasio para marcas de fitness, una oficina o un podcast para un experto. ${N_ESCENAS} escenas en ${N_ESTILOS} estilos.` },
        { titulo: 'Genera tu anuncio', texto: 'Haz clic en generar. MaKo anima tu avatar diciendo tu guion, en <strong>formato vertical 9:16</strong> para Reels, TikTok y tus anuncios.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Diseñado para cada momento de tu embudo',
      bajada: 'Cada plantilla de venta trae su escena, su estructura de guion y un ejemplo completo para reemplazar con lo tuyo.',
      columnas: 3,
      items: PLANTILLAS_VENTA_AVATAR.map((p) => ({ icono: I.guion, titulo: p.nombre, texto: p.cuando, meta: `Ejemplo de ${p.duracion} s` })),
    },
    { tipo: 'caso' },
    {
      tipo: 'preguntas',
      titulo: '¿Tienes preguntas? Tenemos respuestas',
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
