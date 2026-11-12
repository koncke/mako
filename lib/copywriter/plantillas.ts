// =============================================================================
// copywriter/plantillas — las plantillas de «Nueva»: «¿Qué vas a crear hoy?» (PURO)
// =============================================================================
// Pedido de Martín (29/10/2026): «Nueva» abre TEMPLATES: guiones de Reels (vienen del Editor, donde se retira esa tab),
// copys de anuncios, emails, posts, VSL y lo que ya tenga Copywriter. Diseño: docs/diseno-copywriter.md (D12 y D16).
//
// DESDE EL 29/10/2026 CADA PLANTILLA TRAE UN EJEMPLO COMPLETO (Martín: «Los templates tienen que ser reales… deben ser
// ejemplos reales»): `contenido()` es el ejemplo de un negocio ficticio (./plantillas-ejemplos.ts) y `esqueleto()` sus
// secciones vacías. El plan: docs/plantillas-reales/copywriter.md.
//   · La página NACE CON EL ESQUELETO, con una guía por sección (./plantillas-guias.ts): en la galería, en el teléfono y
//     en la API de MaKo. Martín (29/10/2026): «al crear un template ya te crea un guion de ejemplo; eso es confuso porque
//     el usuario piensa que es el guion que MaKo le creó para su negocio». El ejemplo se ve aparte («Ver ejemplo», con
//     «Usar como base») y MaKo pregunta para qué es y a qué oferta adaptarlo (./iniciativa.ts).
//   · La TARJETA de la galería sí muestra el ejemplo (`extractoDe`, `chipsDe`, la insignia y la cinta «Ejemplo»): que se
//     vea lo que se va a crear. Martín: «No pueden haber miniaturas en blanco».
//   · Las de una estructura FIJAN su id (`pas`, `youtube-retencion`…): un ejemplo escrito con esas etiquetas no puede
//     seguir a la primera de la biblioteca editable. Si el super admin la cambió o la apagó, la página nace con el ejemplo
//     y sin estructura elegida (trampa 5).
//   · Tres VSL no tienen ejemplo todavía: salen de la galería (`visible: false`) y siguen resolviendo por id (la API).
//
// LA FORMA DE CADA UNA copia algo que la casa ya tiene (la regla «copiar antes de crear»): el Reel, la tab Reels del
// Editor (app/reels/reel-pedido.ts); las Stories, `story-dia` y `PiezaStory` (lib/ig-writer.ts); el Carrusel,
// `PiezaCarrusel`; el Copy de anuncio, el Media Buyer (Texto principal, Título, Botón, Link); el Email, Email Marketing;
// las VSL, lib/vsl-estructuras.ts; el YouTube, `youtube-retencion` (lib/guion-estructuras.ts).
// Cada sección es un Título 2 con su etiqueta (doc.ts), así MaKo escribe «el asunto» o «el gancho» por su nombre.
// =============================================================================

import { CAPTION_VISIBLE } from '../ig-formatos';
import { ESTRUCTURAS_GUION_DEFAULT } from '../guion-estructuras';
import { ESTRUCTURAS_VSL_DEFAULT } from '../vsl-estructuras';
import { bloquesDelDoc, docDeEstructura, docVacio, nombreDeSeccion, parrafo, tituloDeSeccion } from './doc';
import type { CatalogosCopy } from './catalogos';
import type { DatoNegocio } from './experto';
import { EJEMPLOS } from './plantillas-ejemplos';
import { GUIAS, OBJETIVOS } from './plantillas-guias';
import { docDeEjemplo } from './texto';
import { INFO_TIPO, type JsonNodo, type TipoGuion } from './tipos';

export const GRUPOS_PLANTILLA = ['Anuncios', 'Redes sociales', 'Email', 'VSL', 'Video largo', 'Básicos'] as const;
export type GrupoPlantilla = (typeof GRUPOS_PLANTILLA)[number];

export type Plantilla = {
  id: string;
  grupo: GrupoPlantilla;
  nombre: string;
  /** Cuándo usarla, en una línea (la segunda línea en el teléfono y el `title` de la tarjeta). */
  descripcion: string;
  emoji: string;
  tipo: TipoGuion;
  /** La estructura de la biblioteca que queda elegida en la página (null = ninguna). */
  estructura: string | null;
  /** En segundos (la duración de la página); sin ella, la del tipo. */
  duracion?: number;
  /** El negocio FICTICIO del ejemplo (el slot {{ejemplo}} y el primer mensaje de MaKo). */
  ejemplo?: { negocio: string; rubro: string };
  /** Lo que el ejemplo usa del negocio, en orden: MaKo pregunta lo que falte. */
  pide?: readonly DatoNegocio[];
  /** El formato y la duración, para la tarjeta («📣 Anuncio · 45 s»): 18 caracteres como máximo, o se corta. */
  insignia?: string;
  /** Para qué suele ser (./plantillas-guias.ts): los botones de la primera pregunta de MaKo (./iniciativa.ts). */
  objetivos?: readonly string[];
  /** false = no sale en la galería (sigue resolviendo por id). */
  visible?: boolean;
  /** El ejemplo completo de un negocio ficticio (o el esqueleto, si no tiene): lo que muestra «Ver ejemplo». */
  contenido: () => JsonNodo;
  /**
   * Las secciones del ejemplo, vacías, con una línea de guía en cada una (./plantillas-guias.ts): con esto NACE la página
   * (la galería, el teléfono y la API de MaKo). El ejemplo nunca entra solo (Martín, 29/10/2026).
   */
  esqueleto: () => JsonNodo;
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
const caption = () => destacado('✂️', `Los primeros ${CAPTION_VISIBLE} caracteres se ven sin tocar «más».`);
/** El ejemplo de una plantilla (o, si no tiene, su esqueleto). */
const ejemploO = (id: string, esqueleto: () => JsonNodo) => () => (EJEMPLOS[id] ? docDeEjemplo(EJEMPLOS[id]) : esqueleto());

/**
 * La estructura que fija una plantilla: su id si está en el catálogo con las MISMAS etiquetas que la de fábrica; si el
 * super admin la cambió o la apagó, ninguna (el ejemplo está escrito con las etiquetas de fábrica).
 */
function fija(c: CatalogosCopy, id: string): string | null {
  const deFabrica = ESTRUCTURAS_GUION_DEFAULT.find((e) => e.id === id)?.etiquetas ?? ESTRUCTURAS_VSL_DEFAULT.find((e) => e.id === id)?.etiquetas;
  const enCatalogo = c.estructuras.find((e) => e.id === id);
  return enCatalogo && deFabrica && enCatalogo.etiquetas.join('|') === deFabrica.join('|') ? id : null;
}
const etiquetasDe = (id: string): string[] => ESTRUCTURAS_GUION_DEFAULT.find((e) => e.id === id)?.etiquetas ?? [];

// ── Las plantillas ───────────────────────────────────────────────────────────

/** 1 · Anuncio a cámara (PAS) · Cierre Consultivo. */
function guionAnuncio(c: CatalogosCopy): Plantilla {
  const esqueleto = () => {
    const d = docDeEstructura(etiquetasDe('pas'));
    d.content = [...(d.content ?? []), tituloDeSeccion('TEXTO DEL ANUNCIO'), vinetas(campo('Texto principal'), campo('Título'), campo('Botón'))];
    return d;
  };
  return {
    id: 'guion-anuncio', grupo: 'Anuncios', nombre: 'Anuncio a cámara (PAS)', emoji: INFO_TIPO.ad.emoji, tipo: 'ad', estructura: fija(c, 'pas'),
    descripcion: 'Para tráfico frío: nombra el problema y vende una llamada.', duracion: 45, insignia: '📣 Anuncio · 45 s',
    ejemplo: { negocio: 'Cierre Consultivo', rubro: 'mentoría de ventas para coaches' }, pide: ['oferta', 'avatar', 'accion', 'quien_habla'],
    contenido: ejemploO('guion-anuncio', esqueleto), esqueleto,
  };
}

/** 2 · Testimonio de cliente · Pulso Dental. */
function testimonio(c: CatalogosCopy): Plantilla {
  const esqueleto = () => doc(
    tituloDeSeccion('GANCHO'), parrafo(),
    tituloDeSeccion('HISTORIA'), vinetas(campo('Antes'), campo('Lo que cambió'), campo('Después')),
    tituloDeSeccion('CTA'), parrafo(),
  );
  return {
    id: 'testimonio', grupo: 'Anuncios', nombre: 'Testimonio de cliente', emoji: '🗣️', tipo: 'ad', estructura: fija(c, 'gancho-historia-cta'),
    descripcion: 'Un cliente cuenta su antes y después, grabado con su celular.', duracion: 40, insignia: '🗣️ Cliente · 40 s',
    ejemplo: { negocio: 'Pulso Dental', rubro: 'agencia de pacientes para clínicas dentales' }, pide: ['prueba', 'accion', 'avatar'],
    contenido: ejemploO('testimonio', esqueleto), esqueleto,
  };
}

/** 3 · Copy de anuncio: 3 ángulos · Consulta Rentable. Las secciones del Media Buyer (1 a 1). */
const COPY_ANUNCIO: Plantilla = {
  id: 'copy-anuncio', grupo: 'Anuncios', nombre: 'Copy de anuncio: 3 ángulos', emoji: '🪧', tipo: 'ad', estructura: null,
  descripcion: 'Tres textos con ángulos distintos para probar en una campaña.', insignia: '🪧 Meta · 3 textos',
  ejemplo: { negocio: 'Consulta Rentable', rubro: 'programa para nutriólogas' }, pide: ['oferta', 'accion', 'prueba'],
  esqueleto: () => doc(
    tituloDeSeccion('TEXTO PRINCIPAL'), parrafo(),
    tituloDeSeccion('TITULO'), parrafo(),
    tituloDeSeccion('BOTON'), parrafo(),
    tituloDeSeccion('LINK'), parrafo(),
  ),
  contenido: () => docDeEjemplo(EJEMPLOS['copy-anuncio']),
};

/** 4 · 10 ganchos para un anuncio · Torre Alameda. */
const BANCO_GANCHOS: Plantilla = {
  id: 'banco-ganchos', grupo: 'Anuncios', nombre: '10 ganchos para un anuncio', emoji: '🪝', tipo: 'ad', estructura: null,
  descripcion: 'Diez aperturas para el mismo anuncio: gana la que frena el scroll.', insignia: '🪝 10 ganchos',
  ejemplo: { negocio: 'Torre Alameda', rubro: 'preventa inmobiliaria en Querétaro' }, pide: ['oferta', 'avatar', 'prueba', 'accion'],
  esqueleto: () => doc(
    tituloDeSeccion('GANCHOS'), tabla(['Tipo', 'Se ve (0-3 s)', 'Se dice', 'Texto en pantalla'], 10),
    tituloDeSeccion('CUERPO'), parrafo(),
    tituloDeSeccion('CTA'), parrafo(),
  ),
  contenido: () => docDeEjemplo(EJEMPLOS['banco-ganchos']),
};

/** 5 · Reel que trae mensajes · Cierre Consultivo. La forma de la tab Reels del Editor. */
function reel(c: CatalogosCopy): Plantilla {
  return {
    id: 'reel', grupo: 'Redes sociales', nombre: 'Reel que trae mensajes', emoji: INFO_TIPO.reel.emoji, tipo: 'reel', estructura: fija(c, 'reel-viral'),
    descripcion: 'Enseña algo útil y termina en una conversación por mensaje.', duracion: 52, insignia: '🎬 Reel · 52 s',
    ejemplo: { negocio: 'Cierre Consultivo', rubro: 'mentoría de ventas para coaches' }, pide: ['avatar', 'palabra_clave', 'recurso'],
    esqueleto: () => doc(
      tituloDeSeccion('GANCHO'), vinetas(campo('Frase hablada'), campo('Título en pantalla'), campo('Visual')),
      tituloDeSeccion('HISTORIA'), tabla(['Escena', 'Locución', 'Cámara'], 3, (i) => String(i + 1)),
      tituloDeSeccion('MORALEJA'), parrafo(),
      tituloDeSeccion('CTA'), parrafo(), vinetas(campo('Palabra clave')),
      tituloDeSeccion('CAPTION'), caption(), parrafo(),
    ),
    contenido: () => docDeEjemplo(EJEMPLOS.reel),
  };
}

/** 6 · Stories que venden · Voz de Líder. */
function stories(c: CatalogosCopy): Plantilla {
  return {
    id: 'stories', grupo: 'Redes sociales', nombre: 'Stories que venden', emoji: INFO_TIPO.story.emoji, tipo: 'story', estructura: fija(c, 'story-dia'),
    descripcion: 'Siete stories de una sola idea que terminan en un mensaje directo.', insignia: '📱 Stories · 7',
    ejemplo: { negocio: 'Voz de Líder', rubro: 'programa de oratoria para gerentes' }, pide: ['oferta', 'fecha_cupo', 'prueba', 'palabra_clave'],
    esqueleto: () => doc(
      destacado('💡', 'Una sola idea en todo el día.'),
      tituloDeSeccion('GANCHO'), parrafo(),
      tituloDeSeccion('CONTEXTO'), tabla(['Frame', 'Tipo', 'Texto', 'Indicación'], 3, (i) => String(i + 1)),
      tituloDeSeccion('MORALEJA'), parrafo(),
      tituloDeSeccion('CTA'), parrafo(), vinetas(campo('Palabra clave')),
    ),
    contenido: () => docDeEjemplo(EJEMPLOS.stories),
  };
}

/** 7 · Carrusel que se guarda · Torre Alameda. */
const CARRUSEL: Plantilla = {
  id: 'carrusel', grupo: 'Redes sociales', nombre: 'Carrusel que se guarda', emoji: INFO_TIPO.post.emoji, tipo: 'post', estructura: null,
  descripcion: 'Una lista útil que la gente guarda y que termina en un mensaje.', insignia: '📝 Carrusel · 10',
  ejemplo: { negocio: 'Torre Alameda', rubro: 'preventa inmobiliaria en Querétaro' }, pide: ['avatar', 'palabra_clave', 'recurso'],
  esqueleto: () => doc(
    tituloDeSeccion('SLIDES'), tabla(['Slide', 'Texto en la imagen', 'Visual'], 5, (i) => (i === 0 ? '1 · Portada' : String(i + 1))),
    tituloDeSeccion('CTA'), parrafo(), vinetas(campo('Palabra clave')),
    tituloDeSeccion('CAPTION'), caption(), parrafo(),
  ),
  contenido: () => docDeEjemplo(EJEMPLOS.carrusel),
};

/** 8 · Email de cierre · Voz de Líder. La forma de Email Marketing. */
const EMAIL: Plantilla = {
  id: 'email', grupo: 'Email', nombre: 'Email de cierre', emoji: INFO_TIPO.email.emoji, tipo: 'email', estructura: null,
  descripcion: 'Vende una cohorte con fecha de cierre real.', insignia: '✉️ Email',
  ejemplo: { negocio: 'Voz de Líder', rubro: 'programa de oratoria para gerentes' }, pide: ['oferta', 'fecha_cupo', 'accion'],
  esqueleto: () => doc(
    tituloDeSeccion('ASUNTO'), parrafo(),
    tituloDeSeccion('VISTA PREVIA'), parrafo(),
    tituloDeSeccion('CUERPO'), parrafo(),
    tituloDeSeccion('BOTON'), parrafo(),
  ),
  contenido: () => docDeEjemplo(EJEMPLOS.email),
};

/** 9 · 5 emails tras una descarga · Consulta Rentable. La secuencia de nutrición de marketingskills, en 5 correos. */
const SECUENCIA: Plantilla = {
  id: 'secuencia-nutricion', grupo: 'Email', nombre: '5 emails tras una descarga', emoji: '📬', tipo: 'email', estructura: null,
  descripcion: 'Lleva a quien descargó tu guía hasta agendar, en 10 días.', insignia: '📬 5 emails',
  ejemplo: { negocio: 'Consulta Rentable', rubro: 'programa para nutriólogas' }, pide: ['recurso', 'historia', 'prueba', 'oferta', 'objecion'],
  esqueleto: () => doc(...[1, 2, 3, 4, 5].flatMap((n) => [
    tituloDeSeccion(`EMAIL ${n}`), vinetas(campo('Día'), campo('Asunto'), campo('Vista previa')), parrafo(), vinetas(campo('Botón')),
  ])),
  contenido: () => docDeEjemplo(EJEMPLOS['secuencia-nutricion']),
};

/** 10 y 11 · Las VSL: las dos con ejemplo, visibles; las otras tres, fuera de la galería y con su esqueleto. */
const VSL_CON_EJEMPLO: Readonly<Record<string, Pick<Plantilla, 'nombre' | 'descripcion' | 'duracion' | 'insignia' | 'ejemplo' | 'pide'>>> = {
  'vsl-respuesta-directa': {
    nombre: 'VSL para agendar', descripcion: 'El video de la página de agenda, para tráfico frío.', duracion: 600, insignia: '🎥 VSL · 10 min',
    ejemplo: { negocio: 'Pulso Dental', rubro: 'agencia de pacientes para clínicas dentales' }, pide: ['oferta', 'mecanismo', 'prueba', 'objecion', 'accion'],
  },
  'vsl-clase-educativa': {
    nombre: 'Clase gratuita: 3 claves', descripcion: 'Enseñas de verdad y la oferta llega al final, ganada.', duracion: 2_520, insignia: '🎓 Clase · 42 min',
    ejemplo: { negocio: 'Consulta Rentable', rubro: 'programa para nutriólogas' }, pide: ['oferta', 'mecanismo', 'historia', 'fecha_cupo'],
  },
};
function vsls(c: CatalogosCopy): Plantilla[] {
  return ESTRUCTURAS_VSL_DEFAULT.filter((v) => v.activo).map((v) => {
    const esqueleto = () => docDeEstructura(v.etiquetas);
    const con = VSL_CON_EJEMPLO[v.id];
    return {
      id: v.id, grupo: 'VSL' as const, emoji: v.emoji, tipo: 'vsl' as const, estructura: con ? fija(c, v.id) : v.id,
      ...(con ?? {
        // Sin ejemplo todavía (docs/plantillas-reales/copywriter.md, «Sin hacer»): no sale en la galería.
        nombre: v.nombre, visible: false,
        descripcion: `${v.minutos} minutos, en ${v.etiquetas.length} bloques: de ${nombreDeSeccion(v.etiquetas[0])} a ${nombreDeSeccion(v.etiquetas[v.etiquetas.length - 1])}.`,
      }),
      contenido: con ? ejemploO(v.id, esqueleto) : esqueleto, esqueleto,
    };
  });
}

/** 12 · YouTube de 12 minutos · Pulso Dental, con `youtube-retencion` (claude-youtube). */
function youtube(c: CatalogosCopy): Plantilla {
  const esqueleto = () => docDeEstructura(etiquetasDe('youtube-retencion'));
  return {
    id: 'youtube', grupo: 'Video largo', nombre: 'YouTube de 12 minutos', emoji: INFO_TIPO.youtube.emoji, tipo: 'youtube', estructura: fija(c, 'youtube-retencion'),
    descripcion: 'Un video largo que sostiene la atención y trae clientes.', duracion: 720, insignia: '▶️ Video · 12 min',
    ejemplo: { negocio: 'Pulso Dental', rubro: 'agencia de pacientes para clínicas dentales' }, pide: ['avatar', 'prueba', 'recurso', 'accion'],
    contenido: ejemploO('youtube', esqueleto), esqueleto,
  };
}

const BLANCO: Plantilla = {
  id: 'blanco', grupo: 'Básicos', nombre: 'Página en blanco', emoji: INFO_TIPO.pagina.emoji, tipo: 'pagina', estructura: null,
  descripcion: 'Una página vacía, como en Notion.', insignia: '📄 Página',
  contenido: () => docVacio(), esqueleto: () => docVacio(),
};

/** La guía de cada sección, debajo de su título: una línea en itálica (la persona la reemplaza; MaKo, al escribir la sección). */
function conGuias(d: JsonNodo, guias: Readonly<Record<string, string>> | undefined): JsonNodo {
  if (!guias) return d;
  const content: JsonNodo[] = [];
  for (const b of d.content ?? []) {
    content.push(b);
    const etiqueta = b.type === 'heading' && typeof b.attrs?.seccion === 'string' ? b.attrs.seccion : null;
    const guia = etiqueta ? guias[etiqueta] : undefined;
    if (guia) content.push({ ...parrafo(), content: [{ type: 'text', text: guia, marks: [{ type: 'italic' }] }] });
  }
  return { ...d, content };
}

/** Lo común a todas: la guía en el esqueleto y los objetivos de la primera pregunta. */
const conLoComun = (p: Plantilla): Plantilla => {
  const esqueleto = p.esqueleto;
  return { ...p, esqueleto: () => conGuias(esqueleto(), GUIAS[p.id]), ...(OBJETIVOS[p.id] ? { objetivos: OBJETIVOS[p.id] } : {}) };
};

/** Todas las plantillas, en el orden de la galería (también las que no salen en ella: `visible: false`). */
export function plantillasDe(c: CatalogosCopy): Plantilla[] {
  return [guionAnuncio(c), testimonio(c), COPY_ANUNCIO, BANCO_GANCHOS, reel(c), stories(c), CARRUSEL, EMAIL, SECUENCIA, ...vsls(c), youtube(c), BLANCO].map(conLoComun);
}

/** Las que se ven en «¿Qué vas a crear hoy?». */
export const plantillasVisibles = (ps: readonly Plantilla[]): Plantilla[] => ps.filter((p) => p.visible !== false);

/** Las plantillas agrupadas, en el orden de los grupos (lo que dibuja «¿Qué vas a crear hoy?»). */
export function gruposDePlantillas(ps: readonly Plantilla[]): { grupo: GrupoPlantilla; plantillas: Plantilla[] }[] {
  return GRUPOS_PLANTILLA.map((grupo) => ({ grupo, plantillas: ps.filter((p) => p.grupo === grupo) })).filter((g) => g.plantillas.length);
}

export const plantillaPorId = (c: CatalogosCopy, id: unknown): Plantilla | null => (typeof id === 'string' ? plantillasDe(c).find((p) => p.id === id) ?? null : null);

// ── Lo que dibuja la tarjeta y lo que queda del ejemplo ─────────────────────

/** Los rótulos de lo que se DICE o se LEE (el gancho de verdad), antes que lo que se ve. */
const RE_DICHO = /^(Dice|Frase hablada|Texto principal|Asunto|A · [^:]+|Agarre[^:]*):\s*/i;

/** Lo que se lee de un renglón: lo primero entre «», o el renglón sin su rótulo ni sus acotaciones [ ]. */
function loQueSeLee(l: string): string {
  const citado = l.match(/«([^»]+)»/)?.[1]?.trim();
  return citado || l.replace(RE_DICHO, '').replace(/^[^:]{1,30}:\s+/, '').replace(/\[[^\]]*\]\s*/g, '').trim();
}

/** Hasta 140 caracteres: las primeras oraciones que entran (al menos 40), o un corte en un borde de palabra. */
function corto140(t: string): string {
  if (t.length <= 140) return t;
  const oraciones = t.match(/[^.!?…]+[.!?…]+["»”]?\s*/g) ?? [];
  let out = '';
  for (const o of oraciones) { if ((out + o).trim().length > 140) break; out += o; }
  if (out.trim().length >= 40) return out.trim();
  const corte = t.lastIndexOf(' ', 139);
  return `${t.slice(0, corte > 0 ? corte : 139)}…`;
}

/**
 * Lo primero que se lee del ejemplo después de su primera sección: lo que se dice (o el texto en la imagen de una tabla),
 * sin rótulos ni comillas, hasta 140 caracteres. Es la hoja de la tarjeta, y sale del mismo ejemplo: nunca se desfasa.
 */
export function extractoDe(p: Plantilla): string {
  return extractoDelDoc(p.contenido());
}

/** Lo mismo sobre cualquier página: lo primero que se dice o se lee después de su primera sección (el título de respaldo). */
export function extractoDelDoc(doc: JsonNodo): string {
  const bloques = bloquesDelDoc(doc);
  const desde = bloques.findIndex((b) => b.tipo === 'seccion');
  for (const b of bloques.slice(desde + 1)) {
    if (b.tipo === 'seccion' || b.tipo === 'destacado' || b.tipo === 'separador') continue;
    let crudo: string | undefined;
    if (b.tipo === 'tabla') {
      // La primera fila con datos, en la columna de lo que se dice o se lee.
      const [enc, fila] = b.texto.split('\n').map((l) => l.split(' | '));
      const k = (enc ?? []).findIndex((h) => /se dice|locuci[oó]n|texto/i.test(h));
      crudo = fila?.[k >= 0 ? k : 1];
    } else {
      const renglones = b.texto.split('\n').map((l) => l.replace(/^- /, '').trim()).filter(Boolean);
      crudo = renglones.find((l) => RE_DICHO.test(l)) ?? renglones.find((l) => !/^\(.*\)$/.test(l) && !/^(Se ve|Día):/i.test(l));
    }
    const t = crudo ? loQueSeLee(crudo) : '';
    if (t) return corto140(t);
  }
  return '';
}

/** Los nombres de las secciones del ejemplo («Gancho», «Problema», «Agitación»…): los chips de la tarjeta. */
export const chipsDe = (p: Plantilla): string[] => bloquesDelDoc(p.contenido()).filter((b) => b.tipo === 'seccion' && b.seccion).map((b) => nombreDeSeccion(b.seccion!));

const normal = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Lo que queda del ejemplo en una página: `bloques`, los bloques con el MISMO texto que un bloque del ejemplo (más de 12
 * caracteres, sin contar las secciones); `datos`, cuántos «[DATO:» faltan completar. Con algo de eso, la página todavía
 * no es del negocio (la franja de la página y el aviso al copiar).
 */
export function restosDelEjemplo(d: JsonNodo, p: Plantilla): { bloques: number; datos: number } {
  // Lo que también está en el esqueleto (el ✂️ del caption, «Una sola idea en todo el día») es la forma, no un dato.
  const deLaForma = new Set(bloquesDelDoc(p.esqueleto()).map((b) => normal(b.texto)));
  const delEjemplo = new Set(bloquesDelDoc(p.contenido()).filter((b) => b.tipo !== 'seccion').map((b) => normal(b.texto)).filter((t) => t.length > 12 && !deLaForma.has(t)));
  const bloques = bloquesDelDoc(d).filter((b) => b.tipo !== 'seccion' && delEjemplo.has(normal(b.texto))).length;
  const todo = bloquesDelDoc(d).map((b) => b.texto).join('\n');
  return { bloques, datos: (todo.match(/\[DATO:/g) ?? []).length };
}
