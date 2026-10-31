// =============================================================================
// Media Buyer — SUBIR CREATIVOS NUEVOS a un conjunto, por la Zernio del negocio: la parte PURA
// =============================================================================
// Martín, 25/10/2026: «subir creativos nuevos (lo que hoy Meta rechaza con el error 1885183 desde la app del cliente) y
// publicar». Con el token de la app propia del cliente, un creativo nuevo nace como post de ESA app y Meta lo rechaza
// (docs/hallazgos-ads.md, «Publicar por Zernio»). Zernio lo crea con SU app: `POST /v1/ads/create` en la forma «attach»
// (`adSetId`), que hereda presupuesto, público y calendario del conjunto. Contrato leído en el OpenAPI v1.353.0:
//   · imagen: `imageUrl` (Zernio la baja); video: `video: { url }` (Zernio lo sube a la cuenta y espera a Meta);
//   · en Meta, `body`, `headline`, `callToAction` y `linkUrl` son obligatorios; con un formulario instantáneo va
//     `leadGenFormId` y el link sobra;
//   · `status: 'PAUSED'` en la forma attach pausa SÓLO el anuncio nuevo.
//
// Sin `server-only`: lo prueban los tests.
// =============================================================================

import type { ConexionAnunciosZernio } from '@/lib/zernio-ads-cuerpo';

export const CTAS = ['LEARN_MORE', 'SIGN_UP', 'APPLY_NOW', 'BOOK_NOW', 'CONTACT_US', 'GET_QUOTE', 'SHOP_NOW', 'SUBSCRIBE', 'DOWNLOAD'] as const;
export type Cta = (typeof CTAS)[number];

export const NOMBRE_CTA: Record<Cta, string> = {
  LEARN_MORE: 'Más información', SIGN_UP: 'Registrarte', APPLY_NOW: 'Solicitar ahora', BOOK_NOW: 'Reservar',
  CONTACT_US: 'Contactarnos', GET_QUOTE: 'Pedir cotización', SHOP_NOW: 'Comprar', SUBSCRIBE: 'Suscribirte', DOWNLOAD: 'Descargar',
};

/** Lo que la persona escribe (o lo que se toma del mejor anuncio del conjunto). */
export type TextosCreativo = {
  textoPrincipal: string;
  titulo: string;
  cta: Cta;
  /** El destino: una URL https, o null si el conjunto usa un formulario instantáneo. */
  link: string | null;
  formularioId: string | null;
};

export type ArchivoSubido = { path: string; tipo: 'image' | 'video'; nombre: string };

/** Un conjunto al que se puede subir: lo lista la pantalla, los prendidos primero. */
export type ConjuntoParaSubir = { id: string; nombre: string; campana: string | null; prendido: boolean; anuncios: number };

const MAX_TEXTO = 2200;

/** Lo que no se puede publicar, en una frase para la persona; null si está bien. */
export function errorDeTextos(t: TextosCreativo): string | null {
  if (!t.textoPrincipal.trim()) return 'Falta el texto principal.';
  if (t.textoPrincipal.length > MAX_TEXTO) return `El texto principal pasa de ${MAX_TEXTO} caracteres.`;
  if (!t.titulo.trim()) return 'Falta el título.';
  if (t.titulo.length > 255) return 'El título pasa de 255 caracteres.';
  if (!CTAS.includes(t.cta)) return 'El botón no es válido.';
  if (!t.formularioId && !(t.link && /^https:\/\/[^\s]+$/i.test(t.link))) return 'Falta el link de destino (https://…), o el formulario.';
  return null;
}

/**
 * El cuerpo de `POST /v1/ads/create` para UN creativo en un conjunto que ya existe. `urlDescarga` es la URL firmada del
 * archivo en nuestro staging: Zernio la baja una vez y la sube a la cuenta de Meta.
 */
export function cuerpoCreativoEnConjunto(x: {
  conexion: ConexionAnunciosZernio;
  adSetId: string;
  nombre: string;
  archivo: ArchivoSubido;
  urlDescarga: string;
  textos: TextosCreativo;
  activo: boolean;
}): Record<string, unknown> {
  const t = x.textos;
  const cuerpo: Record<string, unknown> = {
    accountId: x.conexion.accountId,
    adAccountId: x.conexion.adAccountId,
    adSetId: x.adSetId,
    name: x.nombre,
    adName: x.nombre,
    status: x.activo ? 'ACTIVE' : 'PAUSED',
    body: t.textoPrincipal.trim(),
    headline: t.titulo.trim(),
    callToAction: t.cta,
  };
  if (t.formularioId) cuerpo.leadGenFormId = t.formularioId;
  if (t.link) cuerpo.linkUrl = t.link;
  if (x.archivo.tipo === 'video') cuerpo.video = { url: x.urlDescarga };
  else cuerpo.imageUrl = x.urlDescarga;
  return cuerpo;
}

/** El nombre del anuncio nuevo: el del archivo sin extensión, con la marca de MaKo. */
export function nombreDeAnuncio(nombreArchivo: string, i: number): string {
  const base = nombreArchivo.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 80) || `Creativo ${i + 1}`;
  return `${base} · MaKo`;
}

/** Una subida tal como llega: de la pantalla (/api/media-buyer → subir_creativos) o de la API de MaKo (subir_creativos_media_buyer). */
export type PedidoDeSubida = { adSetId: string | null; archivos: ArchivoSubido[]; textos: TextosCreativo; activo: boolean };

const ID_META = /^\d{1,30}$/;

/**
 * El pedido de una subida, leído en UN lugar para las dos puertas: el conjunto (un id numérico), los archivos (path, tipo y
 * nombre; lo que no es video es imagen), los textos (el botón cae a «Más información» si no es uno de CTAS; el link vacío es
 * null) y si sale activo (`activo: false` lo deja en pausa; sin decirlo, activo, como la pantalla). Valida la FORMA; lo que
 * se puede publicar lo dicen `errorDeTextos` y lib/media-buyer/subir.ts.
 */
export function leerPedidoDeSubida(o: Record<string, unknown>): PedidoDeSubida {
  const adSetId = typeof o.adSetId === 'string' && ID_META.test(o.adSetId) ? o.adSetId : null;
  const archivos = (Array.isArray(o.archivos) ? o.archivos : []).map((a): ArchivoSubido => {
    const x = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
    return { path: String(x.path ?? ''), tipo: x.tipo === 'video' ? 'video' : 'image', nombre: String(x.nombre ?? 'creativo').slice(0, 120) };
  });
  const t = (o.textos && typeof o.textos === 'object' ? o.textos : {}) as Record<string, unknown>;
  const textos: TextosCreativo = {
    textoPrincipal: String(t.textoPrincipal ?? ''), titulo: String(t.titulo ?? ''),
    cta: (CTAS as readonly string[]).includes(String(t.cta)) ? (t.cta as Cta) : 'LEARN_MORE',
    link: typeof t.link === 'string' && t.link.trim() ? t.link.trim() : null,
    formularioId: typeof t.formularioId === 'string' && ID_META.test(t.formularioId) ? t.formularioId : null,
  };
  return { adSetId, archivos, textos, activo: o.activo !== false };
}
