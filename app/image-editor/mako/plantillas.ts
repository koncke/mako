// =============================================================================
// Las plantillas del editor (el panel «Diseño» de Canva)
// =============================================================================
// Por ahora, las 10 de Doory (`backend/data/templates` del commit de `_doory/COMMIT-DOORY`; misma
// licencia que el código portado, la Attribution Assurance License: el crédito ya se muestra).
//
// · Los DOCUMENTOS viven en `./plantillas/<slug>.json` y se cargan con `import()` sólo al usar una:
//   juntos pesan ~370 KB y no tienen por qué ir en el bundle del editor.
// · Las MINIATURAS son las de Doory, en `public/cv/plantillas/<slug>.webp` (el proxy exime `.webp`
//   por extensión: no quedan detrás del login).
// · Lo que se ve en el panel (título, categoría, etiquetas) está en español acá. Adentro de cada
//   documento se tradujeron los nombres de página, de capa y las notas; el TEXTO del lienzo sigue en
//   inglés porque la miniatura lo muestra así (traducirlo pide re-renderizar las miniaturas).
// · Ningún documento apunta al backend de Doory (`/media/…`): los dos `image` son códigos QR que el
//   editor redibuja desde su `qr`, y las fotos son «stand-ins» dibujados con formas.
// · Fuentes que usan: Anton, Archivo, Lora, Oswald, Pinyon Script y Playfair Display; todas están
//   en `./fuentes.ts` (si una faltara, el texto caería a la del sistema sin avisar).
// · Primero las SUGERIDAS para este negocio (Martín, 16/10/2026; lib/plantillas-sugeridas.ts y la
//   tabla ./plantillas-etiquetas.ts), con `suggested_reason`: el panel dibuja «Sugerido».

import type { EditorServices } from '../_doory/types/adapter';
import type { Page, TemplateCategory, TemplateDetail, TemplateSummary } from '../_doory/types/api';
import type { DoryDocument } from '../_doory/types/document';
import { ordenarConSugeridas, type SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { ETIQUETAS_IMAGEN } from './plantillas-etiquetas';

interface Categoria {
  slug: string;
  name: string;
  /** Ícono de lucide (como el `icon` de las categorías de Doory). */
  icon: string;
}

/** En el orden en que se muestran (el de Doory). */
const CATEGORIAS: Categoria[] = [
  { slug: 'redes-sociales', name: 'Redes sociales', icon: 'share-2' },
  { slug: 'presentaciones', name: 'Presentaciones', icon: 'presentation' },
  { slug: 'posteres', name: 'Pósteres', icon: 'image' },
  { slug: 'volantes', name: 'Volantes', icon: 'file-text' },
  { slug: 'invitaciones', name: 'Invitaciones', icon: 'mail' },
  { slug: 'curriculums', name: 'Currículums', icon: 'file-user' },
  { slug: 'youtube', name: 'YouTube', icon: 'circle-play' },
  { slug: 'negocios', name: 'Negocios', icon: 'briefcase' },
];

interface Plantilla {
  slug: string;
  title: string;
  categoria: string;
  tags: string[];
  description: string;
  preset: string;
  is_featured: boolean;
  width: number;
  height: number;
  page_count: number;
  cargar: () => Promise<{ default: unknown }>;
}

// Medidas y páginas leídas de cada documento (en px; el `unit` del documento sólo cambia cómo se muestran).
const PLANTILLAS: Plantilla[] = [
  {
    slug: 'bold-sale-announcement',
    title: 'Anuncio de oferta',
    categoria: 'redes-sociales',
    tags: ['oferta', 'instagram', 'promoción', 'descuento', 'tienda', 'minimalista', 'publicación'],
    description: 'Una publicación de oferta: una palabra gigante, un sello redondo con el descuento y un botón claro.',
    preset: 'instagramPost',
    is_featured: true,
    width: 1080,
    height: 1080,
    page_count: 1,
    cargar: () => import('./plantillas/bold-sale-announcement.json'),
  },
  {
    slug: 'serif-quote-card',
    title: 'Frase destacada',
    categoria: 'redes-sociales',
    tags: ['frase', 'cita', 'instagram', 'minimalista', 'neutro', 'tipografía', 'publicación'],
    description: 'Una publicación serena: comillas enormes, la frase con serifa y una línea chica con el autor.',
    preset: 'instagramPost',
    is_featured: false,
    width: 1080,
    height: 1080,
    page_count: 1,
    cargar: () => import('./plantillas/serif-quote-card.json'),
  },
  {
    slug: 'rooftop-event-story',
    title: 'Historia de evento',
    categoria: 'redes-sociales',
    tags: ['historia', 'evento', 'instagram', 'fiesta', 'música', 'atardecer', 'story'],
    description: 'Una historia para un evento: foto grande redondeada, título con serifa, fecha, lugar y botón para confirmar.',
    preset: 'instagramStory',
    is_featured: true,
    width: 1080,
    height: 1920,
    page_count: 1,
    cargar: () => import('./plantillas/rooftop-event-story.json'),
  },
  {
    slug: 'modern-pitch-deck',
    title: 'Presentación para inversores',
    categoria: 'presentaciones',
    tags: ['presentación', 'pitch', 'startup', 'negocio', 'inversores', 'diapositivas'],
    description: 'Una presentación 16:9 en crema, tinta y verde: portada con foto, una diapositiva de cifras y el cierre.',
    preset: 'presentation',
    is_featured: true,
    width: 1920,
    height: 1080,
    page_count: 3,
    cargar: () => import('./plantillas/modern-pitch-deck.json'),
  },
  {
    slug: 'night-bloom-concert-poster',
    title: 'Póster de concierto',
    categoria: 'posteres',
    tags: ['póster', 'concierto', 'festival', 'música', 'evento', 'impresión', 'cartel'],
    description: 'Un póster tipográfico para imprimir: el artista principal enorme, los teloneros y los datos en orden.',
    preset: '',
    is_featured: true,
    width: 1728,
    height: 2304,
    page_count: 1,
    cargar: () => import('./plantillas/night-bloom-concert-poster.json'),
  },
  {
    slug: 'grand-opening-flyer',
    title: 'Volante de inauguración',
    categoria: 'volantes',
    tags: ['volante', 'inauguración', 'café', 'local', 'tienda', 'impresión', 'minimalista', 'flyer'],
    description: 'Un volante cálido para una inauguración: foto en arco, título con serifa, una promo y los datos en una fila.',
    preset: 'letter',
    is_featured: false,
    width: 816,
    height: 1056,
    page_count: 1,
    cargar: () => import('./plantillas/grand-opening-flyer.json'),
  },
  {
    slug: 'botanical-celebration-invitation',
    title: 'Invitación botánica',
    categoria: 'invitaciones',
    tags: ['boda', 'invitación', 'botánica', 'elegante', 'minimalista', 'matrimonio'],
    description: 'Una invitación de boda elegante: papel de lino, un arco con follaje, nombres caligráficos y un QR para confirmar.',
    preset: '',
    is_featured: false,
    width: 480,
    height: 672,
    page_count: 1,
    cargar: () => import('./plantillas/botanical-celebration-invitation.json'),
  },
  {
    slug: 'modern-resume',
    title: 'Currículum moderno',
    categoria: 'curriculums',
    tags: ['currículum', 'cv', 'trabajo', 'empleo', 'a4', 'minimalista'],
    description: 'Un currículum A4 de una columna, fácil de leer: perfil, experiencia, educación y habilidades.',
    preset: 'a4',
    is_featured: false,
    width: 794,
    height: 1123,
    page_count: 1,
    cargar: () => import('./plantillas/modern-resume.json'),
  },
  {
    slug: 'bold-youtube-thumbnail',
    title: 'Miniatura de YouTube',
    categoria: 'youtube',
    tags: ['youtube', 'miniatura', 'video', 'antes y después', 'desafío'],
    description: 'Una miniatura de alto contraste: un número enorme, tres palabras, dos fotos y una flecha.',
    preset: 'youtubeThumbnail',
    is_featured: false,
    width: 1280,
    height: 720,
    page_count: 1,
    cargar: () => import('./plantillas/bold-youtube-thumbnail.json'),
  },
  {
    slug: 'clean-business-card',
    title: 'Tarjeta de presentación',
    categoria: 'negocios',
    tags: ['tarjeta', 'tarjeta de presentación', 'contacto', 'impresión', 'minimalista', 'marca personal'],
    description: 'Una tarjeta de dos caras: tu nombre grande y los datos al frente, una inicial gigante y un QR atrás.',
    preset: 'businessCard',
    is_featured: false,
    width: 336,
    height: 192,
    page_count: 2,
    cargar: () => import('./plantillas/clean-business-card.json'),
  },
];

/** Minúsculas y sin tildes, para que «poster» encuentre «Póster». */
const plano = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function orientacion(p: Pick<Plantilla, 'width' | 'height'>): TemplateSummary['orientation'] {
  return p.width === p.height ? 'square' : p.width > p.height ? 'landscape' : 'portrait';
}

function resumen(p: Plantilla, i: number): TemplateSummary {
  const cat = CATEGORIAS.find((c) => c.slug === p.categoria);
  return {
    id: `tpl-${p.slug}`,
    slug: p.slug,
    title: p.title,
    category: cat ? { id: `cat-${cat.slug}`, slug: cat.slug, name: cat.name } : null,
    tags: p.tags,
    width: p.width,
    height: p.height,
    orientation: orientacion(p),
    preset: p.preset,
    page_count: p.page_count,
    thumbnail_url: `/cv/plantillas/${p.slug}.webp`,
    is_featured: p.is_featured,
    // Sin uso real todavía: el orden de la lista hace de «más usadas».
    use_count: PLANTILLAS.length - i,
    created_at: '2026-10-14T00:00:00Z',
  };
}

function pagina<T>(todo: T[], q?: { page?: number; page_size?: number }): Page<T> {
  const tam = q?.page_size ?? 24;
  const desde = ((q?.page ?? 1) - 1) * tam;
  return { count: todo.length, next: desde + tam < todo.length ? 'next' : null, previous: null, results: todo.slice(desde, desde + tam) };
}

/**
 * La galería en el orden en que se muestra: las sugeridas para ESTE negocio primero, con su porqué, y las demás en el
 * orden de siempre. `i` es el lugar de siempre (el `use_count` de mentira sale de ahí). Sin señales, el orden de siempre.
 */
function enOrden(senales: SenalesNegocio | null | undefined) {
  return ordenarConSugeridas(PLANTILLAS.map((p, i) => ({ id: p.slug, p, i })), ETIQUETAS_IMAGEN, senales)
    .map(({ plantilla: { p, i }, porque }) => ({ p, i, porque }));
}

/**
 * El servicio `templates` del adaptador de MaKo. Con las señales del negocio, las sugeridas van primero y marcadas.
 * ⚠️ Se ordena la galería ENTERA, una vez, y cada pedido filtra y pagina lo ya ordenado: el panel ve sólo una página
 * (no podría ordenar él), y ordenar lo ya filtrado volvería «Sugerido» a una que no está entre las tres primeras.
 */
export function servicioPlantillas(senales?: SenalesNegocio | null): EditorServices['templates'] {
  const galeria: TemplateSummary[] = enOrden(senales).map(({ p, i, porque }) => ({ ...resumen(p, i), ...(porque ? { suggested_reason: porque } : {}) }));
  return {
    async categories(): Promise<TemplateCategory[]> {
      return CATEGORIAS.map((c, i) => ({
        id: `cat-${c.slug}`,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        template_count: PLANTILLAS.filter((p) => p.categoria === c.slug).length,
        sort_order: i,
      }));
    },
    async list(q) {
      const aguja = q.q ? plano(q.q.trim()) : '';
      let todas = galeria.filter((t) => {
        if (q.category && t.category?.slug !== q.category) return false;
        if (q.orientation && t.orientation !== q.orientation) return false;
        if (q.preset && t.preset !== q.preset) return false;
        if (q.featured !== undefined && t.is_featured !== q.featured) return false;
        if (!aguja) return true;
        const donde = plano([t.title, t.category?.name ?? '', ...t.tags].join(' '));
        return aguja.split(/\s+/).every((palabra) => donde.includes(palabra));
      });
      const orden = q.ordering;
      if (orden === 'title' || orden === '-title') {
        todas = [...todas].sort((a, b) => a.title.localeCompare(b.title, 'es'));
        if (orden === '-title') todas.reverse();
      } else if (orden === 'use_count') {
        todas = [...todas].reverse();
      }
      return pagina(todas, q);
    },
    async get(slug): Promise<TemplateDetail> {
      const i = PLANTILLAS.findIndex((p) => p.slug === slug);
      if (i < 0) throw new Error('Esa plantilla no existe.');
      const p = PLANTILLAS[i];
      const modulo = await p.cargar();
      // Copia: el módulo JSON queda en caché y el editor no tiene por qué ver el mismo objeto dos veces.
      const document = structuredClone(modulo.default) as DoryDocument;
      return { ...resumen(p, i), description: p.description, document };
    },
  };
}

// ── Para la API de MaKo (lib/api-mako/areas/imagen.run.ts) ──
// Sin el motor: este módulo sólo importa TIPOS de `_doory/`, así que el server lo puede leer.

/**
 * El catálogo, con lo que la API muestra de cada plantilla. Con las señales del negocio, en el orden del panel: las
 * sugeridas primero, con `sugerida: "<porqué>"`.
 */
export function catalogoPlantillas(senales?: SenalesNegocio | null): { slug: string; titulo: string; categoria: string; ancho: number; alto: number; paginas: number; descripcion: string; sugerida?: string }[] {
  return enOrden(senales).map(({ p, porque }) => ({
    slug: p.slug, titulo: p.title, categoria: CATEGORIAS.find((c) => c.slug === p.categoria)?.name ?? p.categoria,
    ancho: p.width, alto: p.height, paginas: p.page_count, descripcion: p.description, ...(porque ? { sugerida: porque } : {}),
  }));
}

/** El documento de una plantilla (el mismo que usa «Usar en esta página»), o null si no existe. */
export async function documentoDePlantilla(slug: string): Promise<unknown | null> {
  const p = PLANTILLAS.find((x) => x.slug === slug);
  if (!p) return null;
  const m = await p.cargar();
  return (m as { default?: unknown }).default ?? m;
}
