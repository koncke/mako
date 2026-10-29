// =============================================================================
// copywriter/plantillas — los templates de «Nueva»: «¿Qué vas a crear hoy?» (PURO)
// =============================================================================
// Pedido de Martín (29/10/2026): «Nueva» abre TEMPLATES: guiones de Reels (vienen del Editor, donde se retira esa tab),
// copys de anuncios, emails, posts, VSL y lo que ya tenga Copywriter. Diseño: docs/diseno-copywriter.md (D12).
//
// NINGUNO SE INVENTÓ: cada uno copia la forma de algo que la casa ya tiene (la regla «copiar antes de crear»):
//   · Guion de Reel        ← la tab Reels del Editor (app/reels/reel-pedido.ts, `guionATexto`): Gancho (frase hablada,
//                            título en pantalla, visual), escenas con Locución y Cámara, Moraleja, CTA con palabra clave y
//                            Caption (125 caracteres a la vista, lib/ig-formatos.ts), con la estructura «reel-viral».
//   · Stories del día      ← la estructura «story-dia» y los frames de `PiezaStory` (lib/ig-writer.ts: tipo, texto,
//                            indicación).
//   · Carrusel             ← `PiezaCarrusel` (lib/ig-writer.ts: slides con texto y visual, CTA, caption).
//   · Guion de anuncio     ← la estructura por defecto de Ad de la biblioteca (lib/guion-estructuras.ts).
//   · Copy de anuncio      ← los textos del anuncio del Media Buyer (app/ads-manager/MediaBuyer.tsx): Texto principal,
//                            Título, Botón y Link de destino.
//   · Email                ← el broadcast de Email Marketing (lib/email-marketing.ts: asunto, preheader, cuerpo).
//   · VSL                  ← lib/vsl-estructuras.ts (una por estructura activa: Respuesta directa, Clase gratuita…).
//   · Guion de YouTube     ← sin estructura: no hay fuente en el repo (docs/diseno-copywriter.md, D6).
//   · Página en blanco     ← la «Página vacía» de Notion.
// Cada sección es un Título 2 con su etiqueta (doc.ts), así MaKo escribe «el asunto» o «el gancho» por su nombre.
// =============================================================================

import { CAPTION_VISIBLE } from '../ig-formatos';
import { ESTRUCTURAS_VSL_DEFAULT } from '../vsl-estructuras';
import { docDeEstructura, docVacio, nombreDeSeccion, parrafo, tituloDeSeccion } from './doc';
import { estructuraPorDefecto, type CatalogosCopy } from './catalogos';
import { INFO_TIPO, type JsonNodo, type TipoGuion } from './tipos';

export const GRUPOS_PLANTILLA = ['Anuncios', 'Redes sociales', 'Email', 'VSL', 'Video largo', 'Básicos'] as const;
export type GrupoPlantilla = (typeof GRUPOS_PLANTILLA)[number];

export type Plantilla = {
  id: string;
  grupo: GrupoPlantilla;
  nombre: string;
  /** Una línea: qué es (lo que se ve en la tarjeta). */
  descripcion: string;
  emoji: string;
  tipo: TipoGuion;
  /** La estructura de la biblioteca que queda elegida en la página (null = ninguna). */
  estructura: string | null;
  /** El cuerpo con el que nace la página. */
  contenido: () => JsonNodo;
};

// ── Armar ────────────────────────────────────────────────────────────────────

const texto = (t: string, negrita = false): JsonNodo => ({ type: 'text', text: t, ...(negrita ? { marks: [{ type: 'bold' }] } : {}) });
/** «Etiqueta:» en negrita y el resto para completar. */
const campo = (etiqueta: string): JsonNodo => ({ type: 'listItem', content: [{ type: 'paragraph', content: [texto(`${etiqueta}:`, true), texto(' ')] }] });
const vinetas = (...items: JsonNodo[]): JsonNodo => ({ type: 'bulletList', content: items });
const destacado = (emoji: string, t: string): JsonNodo => ({ type: 'callout', attrs: { emoji }, content: [{ type: 'paragraph', content: [texto(t)] }] });
const celda = (t: string, titulo = false): JsonNodo => ({ type: titulo ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', ...(t ? { content: [texto(t)] } : {}) }] });
function tabla(columnas: readonly string[], filas: number, primeraColumna?: (i: number) => string): JsonNodo {
  return {
    type: 'table',
    content: [
      { type: 'tableRow', content: columnas.map((c) => celda(c, true)) },
      ...Array.from({ length: filas }, (_, i) => ({ type: 'tableRow', content: columnas.map((_, k) => celda(k === 0 && primeraColumna ? primeraColumna(i) : '')) })),
    ],
  };
}
const doc = (...content: JsonNodo[]): JsonNodo => ({ type: 'doc', content });

// ── Los templates ────────────────────────────────────────────────────────────

const REEL: Plantilla = {
  id: 'reel', grupo: 'Redes sociales', nombre: 'Guion de Reel', emoji: INFO_TIPO.reel.emoji, tipo: 'reel', estructura: 'reel-viral',
  descripcion: 'Gancho de 3 segundos, escenas con locución y cámara, moraleja, CTA y caption.',
  contenido: () => doc(
    tituloDeSeccion('GANCHO'), vinetas(campo('Frase hablada'), campo('Título en pantalla'), campo('Visual')),
    tituloDeSeccion('HISTORIA'), tabla(['Escena', 'Locución', 'Cámara'], 3, (i) => String(i + 1)),
    tituloDeSeccion('MORALEJA'), parrafo(),
    tituloDeSeccion('CTA'), parrafo(), vinetas(campo('Palabra clave')),
    tituloDeSeccion('CAPTION'), destacado('✂️', `Los primeros ${CAPTION_VISIBLE} caracteres se ven sin tocar «más».`), parrafo(),
  ),
};

const STORIES: Plantilla = {
  id: 'stories', grupo: 'Redes sociales', nombre: 'Stories del día', emoji: INFO_TIPO.story.emoji, tipo: 'story', estructura: 'story-dia',
  descripcion: 'Una idea por día: gancho, contexto, moraleja y CTA, frame por frame.',
  contenido: () => doc(
    destacado('💡', 'Una sola idea en todo el día.'),
    tituloDeSeccion('GANCHO'), parrafo(),
    tituloDeSeccion('CONTEXTO'), tabla(['Frame', 'Tipo', 'Texto', 'Indicación'], 3, (i) => String(i + 1)),
    tituloDeSeccion('MORALEJA'), parrafo(),
    tituloDeSeccion('CTA'), parrafo(), vinetas(campo('Palabra clave')),
  ),
};

const CARRUSEL: Plantilla = {
  id: 'carrusel', grupo: 'Redes sociales', nombre: 'Post en carrusel', emoji: INFO_TIPO.post.emoji, tipo: 'post', estructura: null,
  descripcion: 'La portada que engancha, una idea por slide, CTA y caption.',
  contenido: () => doc(
    tituloDeSeccion('SLIDES'), tabla(['Slide', 'Texto en la imagen', 'Visual'], 5, (i) => (i === 0 ? '1 · Portada' : String(i + 1))),
    tituloDeSeccion('CTA'), parrafo(), vinetas(campo('Palabra clave')),
    tituloDeSeccion('CAPTION'), destacado('✂️', `Los primeros ${CAPTION_VISIBLE} caracteres se ven sin tocar «más».`), parrafo(),
  ),
};

const COPY_ANUNCIO: Plantilla = {
  id: 'copy-anuncio', grupo: 'Anuncios', nombre: 'Copy de anuncio', emoji: '🪧', tipo: 'ad', estructura: null,
  descripcion: 'Los textos del anuncio de Meta: texto principal, título, botón y link.',
  contenido: () => doc(
    tituloDeSeccion('TEXTO PRINCIPAL'), parrafo(),
    tituloDeSeccion('TITULO'), parrafo(),
    tituloDeSeccion('BOTON'), parrafo(),
    tituloDeSeccion('LINK'), parrafo(),
  ),
};

const EMAIL: Plantilla = {
  id: 'email', grupo: 'Email', nombre: 'Email', emoji: INFO_TIPO.email.emoji, tipo: 'email', estructura: null,
  descripcion: 'Asunto, vista previa, el cuerpo y el botón.',
  contenido: () => doc(
    tituloDeSeccion('ASUNTO'), parrafo(),
    tituloDeSeccion('VISTA PREVIA'), parrafo(),
    tituloDeSeccion('CUERPO'), parrafo(),
    tituloDeSeccion('BOTON'), parrafo(),
  ),
};

const YOUTUBE: Plantilla = {
  id: 'youtube', grupo: 'Video largo', nombre: 'Guion de YouTube', emoji: INFO_TIPO.youtube.emoji, tipo: 'youtube', estructura: null,
  descripcion: 'Un video largo: eliges la estructura o se lo pides a MaKo.',
  contenido: () => docVacio(),
};

const BLANCO: Plantilla = {
  id: 'blanco', grupo: 'Básicos', nombre: 'Página en blanco', emoji: INFO_TIPO.pagina.emoji, tipo: 'pagina', estructura: null,
  descripcion: 'Una página vacía, como en Notion.',
  contenido: () => docVacio(),
};

/** El guion de anuncio con la estructura por defecto de Ad (la de la biblioteca del negocio). */
function guionAnuncio(c: CatalogosCopy): Plantilla {
  const e = estructuraPorDefecto(c, 'ad');
  return {
    id: 'guion-anuncio', grupo: 'Anuncios', nombre: 'Guion de anuncio', emoji: INFO_TIPO.ad.emoji, tipo: 'ad', estructura: e?.id ?? null,
    descripcion: e ? `Un anuncio en video con ${e.nombre}.` : 'Un anuncio en video, sección por sección.',
    contenido: () => (e ? docDeEstructura(e.etiquetas) : docVacio()),
  };
}

/** Un VSL por estructura activa de lib/vsl-estructuras.ts. */
function vsls(): Plantilla[] {
  return ESTRUCTURAS_VSL_DEFAULT.filter((v) => v.activo).map((v) => ({
    // El nombre tal cual (el grupo ya dice «VSL»): «VSL clásico de respuesta directa», «Clase gratuita (webinar comprimido)».
    id: v.id, grupo: 'VSL' as const, nombre: v.nombre, emoji: v.emoji, tipo: 'vsl' as const, estructura: v.id,
    descripcion: `${v.minutos} minutos, en ${v.etiquetas.length} bloques: de ${nombreDeSeccion(v.etiquetas[0])} a ${nombreDeSeccion(v.etiquetas[v.etiquetas.length - 1])}.`,
    contenido: () => docDeEstructura(v.etiquetas),
  }));
}

/** Todos los templates, en el orden de la galería. */
export function plantillasDe(c: CatalogosCopy): Plantilla[] {
  return [guionAnuncio(c), COPY_ANUNCIO, REEL, STORIES, CARRUSEL, EMAIL, ...vsls(), YOUTUBE, BLANCO];
}

/** Los templates agrupados, en el orden de los grupos (lo que dibuja «¿Qué vas a crear hoy?»). */
export function gruposDePlantillas(ps: readonly Plantilla[]): { grupo: GrupoPlantilla; plantillas: Plantilla[] }[] {
  return GRUPOS_PLANTILLA.map((grupo) => ({ grupo, plantillas: ps.filter((p) => p.grupo === grupo) })).filter((g) => g.plantillas.length);
}

export const plantillaPorId = (c: CatalogosCopy, id: unknown): Plantilla | null => (typeof id === 'string' ? plantillasDe(c).find((p) => p.id === id) ?? null : null);
