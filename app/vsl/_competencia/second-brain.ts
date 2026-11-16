// =============================================================================
// /vsl/second-brain — Second Brain, el mapa de lo que MaKo sabe de tu negocio, con la ESTRUCTURA y el DISEÑO de la portada de Obsidian
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el diseño):
//   https://obsidian.md/  (leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px)
// El diseño copiado vive en ./disenos/second-brain.tsx, con los valores medidos de la referencia en su cabecera.
// Su orden, que se respeta aquí: «Sharpen your thinking.», su bajada y sus dos botones, con la ventana de la app debajo → sus tres frases
// («Your thoughts are yours.», «Your mind is unique.», «Your knowledge should last.») con «Free without limits.» al costado → «Spark
// ideas.» y su grilla de cuatro (Links, Graph, Canvas, Plugins), cada una con su muestra → «Sync securely.» (tres pestañas y su
// tarjeta) → «Publish instantly.» (tres columnas) → «It’s your time to shine.» y su botón → sus tres tarjetas de comunidad → su pie.
//
// POR QUÉ ÉSTA. El Second Brain de MaKo se hizo «como lo hace Obsidian, que son carpetas y archivos» (lib/vault-modelo.ts): el mismo
// grafo de notas conectadas, y su exportación es un vault de Obsidian (carpetas, archivos Markdown con su frontmatter y los enlaces que
// rearman el grafo). Obsidian es la app de notas en grafo que este público conoce, y su portada vende exactamente eso: tus ideas
// conectadas, el grafo y que lo que guardas es tuyo. Holo (la referencia de /vsl/mako) vende el chat que delega, no el mapa.
//
// Lo que se cambió de la referencia, y por qué:
//   · Su ventana de la app (el explorador, una nota y su grafo) es el Second Brain DE VERDAD: el mismo componente de la portada
//     (app/vsl/_sitio/BrainVivo.tsx, el Grafo real con el negocio de Alex Hormozi: 200 nodos de las lecturas de Competitor Spy y Offer),
//     que se arrastra, se acerca y se toca. Se reusa, no se copia.
//   · «Free without limits.» es que el Second Brain está en los dos planes (lib/topes-plan.ts: «LO QUE NO SE CIERRA … el Second Brain»).
//   · Sus muestras dibujadas (la nota con su enlace, el lienzo, los plugins) son, en MaKo, sus datos REALES contados del código: las
//     áreas (AREAS de lib/cerebro-modelo.ts), de dónde salió cada dato (AUTORIA_TEXTO), los tres modos de la búsqueda
//     (app/second-brain/BuscadorCerebro.tsx) y las carpetas del ZIP (`carpetaDe` de lib/vault-modelo.ts). El grafo, la foto del de la
//     portada (public/vsl-assets/sitio/cerebro.jpg). Ningún dibujo de una pantalla.
//   · «Sync securely.» (sincronizar entre dispositivos) es «Aprende solo», el recolector (lib/recolector.ts): MaKo no sincroniza notas, y
//     lo que el Second Brain tiene de propio es que aprende de tus conversaciones. «Publish instantly.» (publicar las notas como un sitio)
//     es «Llévatelo»: exportarlo en un ZIP. MaKo no publica tu Second Brain.
//   · Sus tarjetas de comunidad (Discord, el foro, la documentación para desarrolladores) son lo que MaKo tiene de eso: las preguntas, la
//     documentación de la API y el soporte (los links de «Recursos» del sitio).
//   · Su pie es el del sitio (PieGlobal); su barra, la del sitio (BarraGlobal), como en todas las landings.
// Lo que NO se promete: que aprenda solo sin que lo prendas (un negocio arranca con el recolector APAGADO), que aprenda de otra fuente
// que WhatsApp (es la única hoy, FUENTE_WHATSAPP), que se sincronice o se publique, ni que sea ilimitado (no hay un tope, pero tampoco una
// promesa).
// =============================================================================

import { AREAS, AUTORIA_TEXTO, NIVEL1 } from '@/lib/cerebro-modelo';
import { carpetaDe } from '@/lib/vault-modelo';
import { DIAS_PRIMERA_VEZ } from '@/lib/recolector-reglas';
import type { LandingCompetencia } from './tipos';

/** Las áreas del Second Brain, con su nombre y lo que guarda cada una (AREAS de lib/cerebro-modelo.ts). */
export const AREAS_SECOND_BRAIN: readonly { nombre: string; que: string }[] = AREAS.map((a) => ({ nombre: a.nombre, que: a.que }));

/** De dónde salió cada dato, con las palabras del mapa y del ZIP (AUTORIA_TEXTO). */
export const PROCEDENCIAS: readonly string[] = Object.values(AUTORIA_TEXTO);

/** Las carpetas del ZIP que te llevas (`carpetaDe`: las mismas que arma la exportación). */
export const CARPETAS_ZIP: readonly string[] = AREAS.map((a) => carpetaDe(a.id));

/** Los tres modos de la barra del mapa (app/second-brain/BuscadorCerebro.tsx, su cabecera). */
export const MODOS_BUSQUEDA: readonly { modo: string; que: string }[] = [
  { modo: 'Simple', que: 'Por el nombre, que es lo que ves en el mapa.' },
  { modo: 'Avanzada', que: 'Por el contenido, de dónde salió o el área.' },
  { modo: 'Con MaKo', que: 'Lo describes con tus palabras y MaKo lo busca en el mapa entero.' },
];

/** Lo que lee el recolector la primera vez (DIAS_PRIMERA_VEZ de lib/recolector-reglas.ts): la tarjeta de «Aprende solo». */
export const PRIMERA_VEZ = `La primera vez, los últimos ${DIAS_PRIMERA_VEZ} días`;

/** El archivo del ZIP que se muestra en «Llévatelo»: el avatar «Founder de 7 cifras» del negocio de Alex Hormozi, el mismo del grafo. */
export const NODO_DE_MUESTRA = 'av:founder';

/** Los textos del diseño que no son un bloque (el segundo botón del hero y el cierre). */
export const TEXTOS_SECOND_BRAIN = {
  verPrecios: 'Ver precios',
  cierre: 'Es hora de que MaKo conozca tu negocio.',
} as const;

const I = {
  // «brain» de Tabler (MIT), el mismo del menú del sitio (app/vsl/_sitio/datos.ts).
  brain: [
    'M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8', 'M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8',
    'M17.5 16a3.5 3.5 0 0 0 0 -7h-.5', 'M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0', 'M6.5 16a3.5 3.5 0 0 1 0 -7h.5', 'M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10',
  ],
};

export const LANDING_SECOND_BRAIN: LandingCompetencia = {
  slug: 'second-brain',
  nombre: 'Second Brain · lo que MaKo sabe de tu negocio',
  icono: I.brain,
  referencia: { nombre: 'Obsidian · Sharpen your thinking', url: 'https://obsidian.md/', leida: '16/11/2026' },
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Second Brain',
      // «Sharpen your thinking.»: una frase corta con su punto, en un renglón a 1440.
      titulo: 'Tu negocio, en un mapa.',
      // «The free and flexible app for your private thoughts.»
      bajada: 'El mapa de lo que MaKo sabe de tu negocio, conectado y a la vista.',
      visual: { tipo: 'detalle', slug: 'second-brain' },
    },
    {
      // Sus tres frases, y al costado «Free without limits.» (el título del bloque) con su link.
      tipo: 'tarjetas',
      titulo: 'En MaKo Essential y en MaKo Pro.',
      items: [
        { titulo: 'Lo arma MaKo.', texto: 'Con los documentos que le subes, tu oferta, tu cliente ideal y lo que va aprendiendo de tus conversaciones.' },
        { titulo: 'Lo leen tus chats.', texto: 'Los chats de MaKo leen tu Second Brain para contestarte sobre tu negocio: qué vendes, a quién y cómo suenas.' },
        { titulo: 'Es tuyo.', texto: 'Te lo llevas cuando quieras en carpetas y archivos Markdown, que abres en Obsidian o en cualquier editor.' },
      ],
    },
    {
      // «Spark ideas.» y su grilla de cuatro, cada una con su muestra (en el diseño: los datos reales de cada una).
      tipo: 'tarjetas',
      titulo: 'Tu negocio, conectado.',
      bajada: 'De tu diagnóstico a tu funnel, MaKo ordena lo que sabe de tu negocio y lo conecta en un solo lugar.',
      columnas: 2,
      items: [
        { titulo: 'Áreas', texto: `Tu negocio en ${AREAS.length} áreas, de tu oferta a tu funnel: cada una con lo que MaKo sabe de ella y lo que todavía falta.` },
        { titulo: 'Mapa', texto: 'Mira cómo se conecta todo en un grafo que arrastras, acercas y tocas para ver lo que guarda cada punto.' },
        { titulo: 'Procedencia', texto: 'Cada dato dice de dónde salió y quién lo puso. Filtra el mapa por eso, por área o por carpeta.' },
        { titulo: 'Búsqueda', texto: 'Busca por nombre, por contenido o por de dónde salió. O pregúntale a MaKo con tus palabras.' },
      ],
    },
    {
      // «Sync securely.»: sus tres pestañas, con la tarjeta al costado.
      tipo: 'pasos',
      titulo: 'Aprende solo.',
      bajada: 'Prende el recolector y MaKo aprende de tus conversaciones de WhatsApp lo que nadie le escribió.',
      pasos: [
        { titulo: 'De tus conversaciones.', texto: 'Lee lo nuevo de tus conversaciones de WhatsApp con tus leads y guarda los hechos de tu negocio, con su procedencia.' },
        { titulo: 'Sólo lee.', texto: 'No manda ningún mensaje, no marca nada como leído y no cambia ningún lead.' },
        { titulo: 'Tú decides.', texto: 'Arranca apagado: lo prendes desde tu Second Brain, y ves de dónde aprendió, cuándo fue la última vez y cuánto entró.' },
      ],
    },
    {
      // «Publish instantly.»: sus tres columnas.
      tipo: 'tarjetas',
      titulo: 'Llévatelo.',
      bajada: 'Exporta tu Second Brain en un ZIP: todo o sólo lo que filtras.',
      columnas: 3,
      items: [
        { titulo: 'Carpetas y archivos.', texto: `Una carpeta por cada parte de tu negocio (${NIVEL1.map((n) => n.nombre.toLowerCase()).join(', ').replace(/, ([^,]+)$/, ' y $1')}) y un archivo por cada cosa que MaKo sabe.` },
        { titulo: 'Con su procedencia.', texto: 'Cada archivo dice de dónde salió el dato y quién lo puso.' },
        { titulo: 'Ábrelo en Obsidian.', texto: 'Son archivos Markdown: se leen en cualquier editor, y en Obsidian los enlaces rearman el grafo.' },
      ],
    },
    {
      // Sus tres tarjetas de comunidad (Discord, el foro y la documentación): lo que MaKo tiene de eso, con sus links de «Recursos».
      tipo: 'tarjetas',
      titulo: 'Más de MaKo',
      items: [
        { titulo: 'Preguntas frecuentes', texto: 'Lo que más nos preguntan sobre MaKo y sus planes.', meta: '/#preguntas' },
        { titulo: 'Documentación de la API', texto: 'Lo que puedes leer y hacer en MaKo desde tu código.', meta: '/api-mako' },
        { titulo: 'Soporte', texto: 'Escríbenos si algo no anda o no sabes cómo hacerlo.', meta: '/soporte' },
      ],
    },
  ],
  metaTitle: 'Second Brain de MaKo: todo tu negocio en un mapa que tus chats leen',
  metaDesc: `El mapa de lo que MaKo sabe de tu negocio: ${AREAS.length} áreas conectadas en un grafo, con la procedencia de cada dato, una búsqueda con MaKo y un ZIP de archivos Markdown que abres en Obsidian. En MaKo Essential y en MaKo Pro.`,
};
