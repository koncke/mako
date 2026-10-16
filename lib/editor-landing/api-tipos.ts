// =============================================================================
// editor-landing/api-tipos — el CONTRATO entre la pantalla y las rutas
// =============================================================================
// Tipos puros (sin server-only) que comparten el editor (cliente) y las tres
// rutas: /api/landing-generator (documentos), /api/landing-generator/ia (MaKo) y
// /api/landing-generator/imagenes. Toda respuesta es `{ ok: true, ... }` o
// `{ ok: false, error }` (skill nextjs16-conventions). Diseño:
// docs/diseno-editor-landing.md.
// =============================================================================

import type { JsonNodo, LandingContenido } from './doc';
import type { ObjetivoLanding } from '../landing-spec';
import type { FallaEnNavegador, Lectura } from './lectura-tipos';
import { ESTILO_DEFAULT, type IdEstilo } from './animaciones';

export type Falla = { ok: false; error: string; conflicto?: boolean; versionActual?: number };

// ─────────────────────────────────────────────────────────────────────────────
// Configuración del documento (se guarda entera en landing_docs.config)
// ─────────────────────────────────────────────────────────────────────────────

export type EnlaceNav = { texto: string; destino: string };
export type BotonNav = { texto: string; destino: string; estilo: 'primario' | 'secundario' };

export type ConfigSitio = {
  nombre: string;
  favicon: string | null;            // URL pública de landing-imagenes
  seoTitulo: string;                 // ≤ 60
  seoDescripcion: string;            // ≤ 160
  ogImagen: string | null;           // imagen para compartir (WhatsApp, redes)
  indexar: boolean;                  // «Permitir la indexación en buscadores» (default false, como Gamma)
  nav: { mostrar: boolean; logo: string | null; enlaces: EnlaceNav[]; botones: BotonNav[] }; // ≤ 5 enlaces, ≤ 2 botones
  pie: { mostrar: boolean; texto: string };
  metaPixelId: string | null;        // sólo dígitos; el código lo arma el server
  marcaMako: boolean;                // «Hecho con MaKo»
};

/**
 * T3 (tanda 2): qué es el documento. «Página web» = secciones fluidas; «Presentación» = cada
 * sección es una DIAPOSITIVA (la UI dice «diapositiva», Presentar es la acción principal y, con
 * una proporción fija, la diapositiva tiene la forma de `proporcion`: css.ts, «Presentaciones»).
 */
export const FORMATOS = ['pagina', 'presentacion'] as const;
export type FormatoDoc = (typeof FORMATOS)[number];
/** La «Relación de aspecto» de Gamma para una presentación. En una página no se usa. */
export const PROPORCIONES = ['16:9', '4:3', 'fluido'] as const;
export type Proporcion = (typeof PROPORCIONES)[number];

export type ConfigLanding = {
  tema: string;                      // id de TEMAS (lib/editor-landing/temas.ts) o 'ws:<id>' (temas propios)
  /** Opcional en el TIPO porque lo guardado antes de la tanda 2 no lo trae; `sanearConfig` lo completa ('pagina'). */
  formato?: FormatoDoc;
  /** Sólo cuenta en una presentación ('16:9' por default). */
  proporcion?: Proporcion;
  sitio: ConfigSitio;
  /**
   * `animaciones` es el interruptor MAESTRO (apagado, nada anima). `estiloAnimacion` es la «Animación de página»
   * (animaciones.ts, `ESTILOS_PAGINA`): la que heredan las secciones que no eligieron la suya. Lo guardado antes
   * del catálogo no lo trae: `sanearConfig` lo completa con `ESTILO_DEFAULT` («Subir», la entrada de siempre).
   */
  pagina: { animaciones: boolean; estiloAnimacion: IdEstilo; fondoImagen: string | null };
  /** Lo que MaKo usó para generarla (para «Ver instrucción de origen»). */
  origen?: { modo: 'cero' | 'ia' | 'plantilla' | 'importar' | 'generador'; pedido?: string; objetivo?: ObjetivoLanding; basadoEnUrl?: string | null; plantilla?: string };
};

export const CONFIG_DEFAULT: ConfigLanding = {
  tema: 'pewter',
  formato: 'pagina',
  proporcion: '16:9',
  sitio: {
    nombre: '', favicon: null, seoTitulo: '', seoDescripcion: '', ogImagen: null, indexar: false,
    nav: { mostrar: false, logo: null, enlaces: [], botones: [] },
    pie: { mostrar: false, texto: '' },
    metaPixelId: null, marcaMako: true,
  },
  pagina: { animaciones: true, estiloAnimacion: ESTILO_DEFAULT, fondoImagen: null },
};

/** El formato de una configuración (sin el campo, o con uno que no existe: 'pagina'). */
export function formatoDe(c: { formato?: unknown } | null | undefined): FormatoDoc {
  return c?.formato === 'presentacion' ? 'presentacion' : 'pagina';
}
export const esPresentacion = (c: { formato?: unknown } | null | undefined): boolean => formatoDe(c) === 'presentacion';
/** La proporción de las diapositivas (sin el campo, o con uno que no existe: '16:9'). */
export function proporcionDe(c: { proporcion?: unknown } | null | undefined): Proporcion {
  const v = c?.proporcion;
  return (PROPORCIONES as readonly unknown[]).includes(v) ? (v as Proporcion) : '16:9';
}
/** ¿La diapositiva tiene forma fija? (presentación y no «Fluido»). */
export const diapositivaFija = (c: { formato?: unknown; proporcion?: unknown } | null | undefined): boolean =>
  esPresentacion(c) && proporcionDe(c) !== 'fluido';
/** Ancho / alto de la diapositiva (16/9 o 4/3), o null si no tiene forma fija. La usan Presentar y el PPTX. */
export function relacionDe(c: { formato?: unknown; proporcion?: unknown } | null | undefined): number | null {
  if (!diapositivaFija(c)) return null;
  return proporcionDe(c) === '4:3' ? 4 / 3 : 16 / 9;
}

/**
 * Cómo se llama la tarjeta según el formato («sección» / «diapositiva»: el `selectCardTerm` de
 * Gamma). Para que TODA la UI cambie de palabra con el formato y no cada pantalla a su manera.
 */
export function terminoTarjeta(c: { formato?: unknown } | null | undefined, op: { plural?: boolean; mayuscula?: boolean } = {}): string {
  const t = esPresentacion(c) ? (op.plural ? 'diapositivas' : 'diapositiva') : (op.plural ? 'secciones' : 'sección');
  return op.mayuscula ? t[0].toUpperCase() + t.slice(1) : t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Documentos
// ─────────────────────────────────────────────────────────────────────────────

export type LandingResumen = {
  id: number;
  titulo: string;
  tema: string;
  creado: string;                    // ISO
  actualizado: string;               // ISO
  creadoPor: string | null;          // nombre de quien la creó
  favorito: boolean;
  carpeta: string | null;
  papelera: boolean;
  slug: string | null;
  publicadoAt: string | null;
  /**
   * El dominio propio VERIFICADO de la landing (tanda 4), o null. Con él el Panel reconoce como nuestra
   * una página analizada en `https://<dominio>` (antes aparecía «de afuera»).
   */
  dominio?: string | null;
  /** La primera sección, para dibujar la miniatura del Panel en el navegador. */
  primera: JsonNodo | null;
  /** T1/T3: el ícono del renglón y la forma de la miniatura (sin el campo: una página). Lo llena `listar` desde `config`. */
  formato?: FormatoDoc;
  proporcion?: Proporcion;
  /**
   * La página de AFUERA de la que es copia (`config.origen.basadoEnUrl` de una replicada), o null. Con
   * esto «Aplicar» en el Diagnóstico de esa página usa la copia que ya existe en vez de replicar de nuevo
   * (verificación de la tanda 6: cada «Aplicar» armaba otra copia, con IA paga).
   */
  replicaDe?: string | null;
};

export type LandingCompleta = {
  id: number;
  titulo: string;
  contenido: LandingContenido;
  config: ConfigLanding;
  version: number;                   // concurrencia optimista: guardar exige la que se abrió
  slug: string | null;
  publicadoAt: string | null;
  /** true si lo guardado cambió después de publicar («Tienes cambios que publicar»). */
  cambiosSinPublicar: boolean;
  sitioActivo: boolean;
  urlPublica: string | null;
  /**
   * La base de la dirección pública (lo que va antes del slug, sin barra final): `https://hola-mako.site`
   * en producción, `<app>/l` en local y en los previews (tanda 4). La decide el SERVER
   * (`baseLandings`, lib/app-url.ts): el navegador no sabe en qué entorno corre. La usa el diálogo
   * Publicar para mostrar la dirección antes de publicar.
   */
  baseLandings: string;
  creado: string;
  actualizado: string;
  /** La estrella del menú ⋯ (y del Panel). */
  favorito: boolean;
  /** El nombre de quien la creó (la cabeza del menú ⋯), o null si no se sabe. */
  creadoPor: string | null;
};

export type VersionResumen = { id: number; creado: string; motivo: string; autor: string | null; titulo: string };

export type Comentario = {
  id: number; tarjetaId: string; parentId: number | null; texto: string;
  autor: string; autorSub: string | null; resuelto: boolean; creado: string;
  /** Lo escribió quien mira (lo decide el server por el `sub` de la sesión): el tacho sale sólo acá. */
  propio: boolean;
};

export type Analitica = {
  publicada: boolean;
  urls: string[];                    // las URLs normalizadas que se miden
  visitas30: number;
  visitantes30: number;
  leads30: number;
  porDia: { dia: string; visitas: number }[];
  /** % de visitantes que llegó a cada sección (por scroll), si el Pixel lo midió. null = no medido, NUNCA 0. */
  alcancePorSeccion: { tarjetaId: string; pct: number | null }[] | null;
  enAnalyst: boolean;                // si el Landing Analyst ya la tiene declarada
  /**
   * Los pedidos del Botón de pago que se rechazaron en los mismos días (Paquete 3 de la tanda 6, mig 0282;
   * se muestra desde la verificación de la tanda 6). null = no se pudo leer o todavía no se cuentan: no se
   * dibuja nada (nunca un «0» que no se sabe).
   */
  rechazosPago?: { total: number; dias: number } | null;
};

export type TemaPropio = { id: string; nombre: string; base: string; cambios: Record<string, unknown> };

/** POST /api/landing-generator — un `accion` por operación. */
export type PedidoDocs =
  | { accion: 'listar' }
  | { accion: 'abrir'; id: number }
  | { accion: 'crear'; titulo?: string; contenido?: LandingContenido; config?: Partial<ConfigLanding> }
  | { accion: 'guardar'; id: number; version: number; titulo?: string; contenido?: LandingContenido; config?: ConfigLanding }
  | { accion: 'duplicar'; id: number }
  | { accion: 'renombrar'; id: number; titulo: string }
  | { accion: 'papelera'; id: number }
  | { accion: 'restaurar'; id: number }
  | { accion: 'borrar'; id: number }                       // sólo desde la papelera
  | { accion: 'versiones'; id: number }
  | { accion: 'version'; id: number; versionId: number }
  | { accion: 'guardarVersion'; id: number; motivo: string }
  | { accion: 'restaurarVersion'; id: number; versionId: number }
  | { accion: 'slugDisponible'; id: number; slug: string }
  | { accion: 'publicar'; id: number; version: number; slug: string }
  | { accion: 'despublicar'; id: number }
  | { accion: 'sitioActivo'; id: number; valor: boolean }
  | { accion: 'vistaPrevia'; id: number; regenerar?: boolean }  // link privado al borrador
  | { accion: 'comentarios'; id: number }
  | { accion: 'comentar'; id: number; tarjetaId: string; texto: string; parentId?: number | null }
  | { accion: 'resolverComentario'; id: number; comentarioId: number; valor: boolean }
  | { accion: 'borrarComentario'; id: number; comentarioId: number }
  | { accion: 'analitica'; id: number }
  | { accion: 'temas' }
  | { accion: 'guardarTema'; tema: TemaPropio }
  | { accion: 'borrarTema'; temaId: string }
  | { accion: 'borradoresViejos' }                         // landing_drafts del generador anterior
  | { accion: 'importarBorrador'; draftId: number }
  // Tanda 4: con qué cobra el «Botón de pago» (las pasarelas conectadas y los productos activos del
  // catálogo). Lo leen el control del botón y el aviso de Publicar (pago-landing.ts).
  | { accion: 'cobro' };

// ─────────────────────────────────────────────────────────────────────────────
// IA (POST /api/landing-generator/ia)
// ─────────────────────────────────────────────────────────────────────────────

export const TEXTO_POR_SECCION = ['breve', 'medio', 'detallado', 'extenso'] as const;
export type TextoPorSeccion = (typeof TEXTO_POR_SECCION)[number];

export const FUENTES_IMAGEN = ['stock', 'marcadores', 'ninguna'] as const;
export type FuenteImagenes = (typeof FUENTES_IMAGEN)[number];

export type ParamsGeneracion = {
  cantidad: number;                  // 1..20 secciones
  textoPorSeccion: TextoPorSeccion;
  idioma: string;                    // 'es-MX' por default
  audiencia: string;
  tono: string;
  objetivo: ObjetivoLanding;
  basadoEnUrl: string | null;        // landing ya analizada por el Landing Analyst
  fuenteImagenes: FuenteImagenes;
  instrucciones: string;             // ≤ 5.000
  modoTexto: 'generar' | 'condensar' | 'conservar';
  /** T3: 'presentacion' pide diapositivas (poco texto, diseños optimizados). Sin el campo, una página. */
  formato?: FormatoDoc;
};

export type SeccionEsquema = { titulo: string; puntos: string[] };
export type Esquema = { titulo: string; secciones: SeccionEsquema[] };

export const ACCIONES_TEXTO = ['mejorar', 'corregir', 'acortar', 'ampliar', 'simplificar', 'especifico', 'tono', 'traducir', 'continuar'] as const;
export type AccionTexto = (typeof ACCIONES_TEXTO)[number];

/**
 * `esquema` en modo «importar» (tanda 6): `url` (se baja TAL CUAL, con su www y su query) o `lectura`
 * (la página ya leída en el navegador de la persona, lectura-tipos.ts: no se baja nada). Si la página
 * no se lee desde el server, la respuesta es `FallaEnNavegador` (HTTP 422).
 */
export type PedidoIA =
  | { accion: 'esquema'; modo: 'generar' | 'pegar' | 'importar'; prompt?: string; texto?: string; url?: string; lectura?: Lectura; params: ParamsGeneracion }
  | { accion: 'secciones'; esquema: Esquema; indices: number[]; params: ParamsGeneracion; temaId: string }
  | { accion: 'editar'; instruccion: string; tarjetas: JsonNodo[]; alcance: 'landing' | 'seccion'; params?: Partial<ParamsGeneracion> }
  | { accion: 'texto'; tipo: AccionTexto; texto: string; contexto?: string; tono?: string; idioma?: string }
  /** `params.formato` (tanda 6): en una presentación las alternativas son diapositivas, no secciones de página. */
  | { accion: 'disenos'; tarjeta: JsonNodo; params?: Partial<ParamsGeneracion> }
  | { accion: 'notas'; tarjeta: JsonNodo };

export type RespuestaIA =
  | { ok: true; esquema: Esquema }
  | { ok: true; tarjetas: JsonNodo[]; resumen?: string }
  | { ok: true; texto: string }
  | { ok: true; opciones: JsonNodo[] }
  | { ok: true; notas: string }
  /** Tanda 6: «Importar» de una página que se arma en el navegador o que nos rechaza (`pegable`, `enNavegador`, `motivo`). */
  | FallaEnNavegador
  | Falla;

// ─────────────────────────────────────────────────────────────────────────────
// Imágenes (POST /api/landing-generator/imagenes)
// ─────────────────────────────────────────────────────────────────────────────

export type FotoStock = { id: string; mini: string; grande: string; autor: string; licencia: string };
export type ArchivoBiblioteca = { url: string; nombre: string; tipo: 'imagen' | 'video'; creado: string };

export type PedidoImagenes =
  | { accion: 'firmar'; nombre: string; tipo: string; tamano: number }
  | { accion: 'registrar'; path: string }
  | { accion: 'buscar'; q: string; pagina?: number; orientacion?: 'horizontal' | 'vertical' | 'cuadrada' }
  | { accion: 'elegir'; id: string }
  | { accion: 'desdeUrl'; url: string }
  | { accion: 'biblioteca' };

/** Lo que MaKo entiende por «subir una imagen» desde cualquier pantalla del editor. */
export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const TIPOS_VIDEO = ['video/mp4', 'video/webm'] as const;
export const TOPE_IMAGEN_BYTES = 15 * 1024 * 1024;
export const TOPE_VIDEO_BYTES = 100 * 1024 * 1024;
