// =============================================================================
// Los outliers de video: la portada de la tab Video (`/video-editor`), el contrato (PURO; 9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «Tal como en imágenes, que se llame Video… vas a ver tus outliers primero»: reels y anuncios que funcionan
// y se pueden replicar. Copiado de Image (`/image-editor`, lib/carruseles/explorar.ts): la portada son los ejemplos, a pantalla
// completa, y «Crear desde cero» lleva a las plantillas (`?ver=crear`).
//
// DE DÓNDE SALEN: de FUENTES enchufables (lib/video-outliers-servidor.ts → FUENTES_OUTLIERS_VIDEO). La que investiga el chat
// «Outliers de reels y anuncios» entra como una fuente más, sin tocar la portada. Hoy hay una: la curada de MaKo
// (`OUTLIERS_CON_PLANTILLA`), un outlier por plantilla guiada (lib/video-plantillas/): el reel del que sale cada una.
//
// LAS REGLAS QUE LA PORTADA YA CUMPLE (la fuente no las repite):
//   · «No pude leer» no es «no hay»: una fuente que falla vuelve `{ ok: false, motivo }` y la portada lo dice.
//   · El outlier es el de toda la app (lib/multiplo-rendimiento.ts), con su motivo cuando no hay número; nunca uno propio.
//   · El dato de un tercero no se republica: la tarjeta lleva el link al original; la miniatura, sólo si la fuente la puede
//     servir (null si no: la tarjeta dibuja la ESTRUCTURA de su plantilla). AGENTS.md, «Copiar código y usar el dato».
//   · «Replicar» sólo con una plantilla guiada que existe (`plantillaGuiada`).
//
// Puro (sin `server-only`): lo usan el lector, la pantalla, la API y los tests.
// =============================================================================

import { multiplosDe, type Multiplo, type PiezaParaMultiplo } from './multiplo-rendimiento';
import { recetaDeFamilia } from './video-recetas';
import { conVariedad } from './carruseles/variedad';
import type { PublicacionOrganica } from './organico-reglas';
import { plantillaGuiada, PLANTILLAS_GUIADAS } from './video-plantillas';

export type RedOutlier = 'instagram' | 'tiktok' | 'youtube' | 'meta-ads';
export type FormatoOutlier = 'reel' | 'short' | 'anuncio';

export type OutlierVideo = {
  /** `<fuente>:<id de la fuente>`: único entre fuentes, estable (los guardados y la API lo usan). */
  id: string;
  fuente: string;
  red: RedOutlier;
  formato: FormatoOutlier;
  /** `foto`: la de su cuenta (la que guardó Spy). `competidorId`: su ficha en Competitors Spy (null = no es de Spy). */
  creador: { nombre: string; usuario: string | null; foto?: string | null; competidorId?: number | null };
  /** El link al original: siempre (una tarjeta sin él no se puede verificar). */
  url: string;
  /** Una imagen que la fuente PUEDE servir (nuestro bucket, o la que el proveedor autoriza mostrar). null = no hay. */
  miniatura: string | null;
  titulo: string;
  /** Lo que lo hace funcionar, en una frase (el gancho, la estructura). */
  porque: string;
  duracionS: number | null;
  /** El número de toda la app, o su motivo. null = la fuente no lo midió. */
  multiplo: Multiplo | null;
  /** El id de la plantilla guiada que lo replica (lib/video-plantillas/). null = todavía no hay. */
  plantilla: string | null;
  /** Lo que se ve en la tarjeta, como en la de Image (null = no se leyó, nunca 0). */
  vistas?: number | null;
  megusta?: number | null;
  comentarios?: number | null;
  /** Cuándo se publicó (ISO): «hace 3 días», y la ventana de la vidriera. */
  publicada?: string | null;
  /** El patrón de EDICIÓN que enseña (lib/video-outliers-criterio.ts). null = todavía nadie lo miró. */
  edicion?: EdicionReel | null;
  /** La receta que lo replica (lib/video-recetas.ts), si su patrón tiene una. */
  receta?: string | null;
};

/** Lo que enseña un reel de edición: su familia, el patrón, por qué, lo que se ve, y si se decidió por la portada o mirando el video. */
export type EdicionReel = { familia: FamiliaEdicion; patron: string; motivo: string; senales: readonly string[]; base: 'portada' | 'video' };

/**
 * Las familias de patrones de EDICIÓN (11/11/2026): una lista cerrada para que «los mejores» se junten por patrón y la portada
 * se pueda filtrar. La misma tabla que usó el juez de la clasificación (docs/hallazgos-video-outliers.md).
 */
export const FAMILIAS_EDICION = {
  'titulo-en-caja': 'Título en caja',
  'mezcla-tipografias': 'Mezcla de tipografías',
  'palabra-resaltada': 'Palabra resaltada',
  'texto-detras-del-sujeto': 'Texto detrás de la persona',
  'pantalla-dividida': 'Pantalla dividida',
  'cita-sobre-podcast': 'Cita sobre un podcast',
  'tarjeta-tweet': 'Tweet como tarjeta',
  'titulo-sobre-broll': 'Título sobre B-roll',
  'frase-protagonista': 'La frase es la pieza',
  'ilustracion-o-grafico': 'Ilustración o gráfico',
  'etiquetas-de-contraste': 'Etiquetas de contraste',
  'serie-con-plantilla': 'Serie con plantilla',
  'subtitulos-con-estilo': 'Subtítulos con estilo',
  'blanco-y-negro-o-color': 'Blanco y negro o color',
  'actuado-con-rotulos': 'Actuado con rótulos',
  'cifra-gancho': 'Cifra como gancho',
} as const;
export type FamiliaEdicion = keyof typeof FAMILIAS_EDICION;
export const esFamiliaEdicion = (x: unknown): x is FamiliaEdicion =>
  typeof x === 'string' && Object.prototype.hasOwnProperty.call(FAMILIAS_EDICION, x);

/** El código de un reel de Instagram (`/reel/<código>/`, `/p/…`, `/tv/…`); null si el link no es de uno. */
export function codigoDeReel(url: string | null | undefined): string | null {
  const m = /^https:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]{5,40})/.exec(url ?? '');
  return m ? m[1] : null;
}

/** El id de un video de YouTube (watch, shorts, youtu.be); null si no es uno. */
export function idDeYoutube(url: string | null | undefined): string | null {
  const m = /^https:\/\/(?:(?:www|m)\.youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(url ?? '');
  return m ? m[1] : null;
}

/**
 * Dónde se REPRODUCE adentro de MaKo (11/11/2026, Martín: «los videos ni siquiera se pueden reproducir ahí mismo: siempre te
 * redirige»): el reproductor OFICIAL de su red (el embed de Instagram, el de YouTube sin cookies), nunca una copia nuestra del
 * video. null = esa red no tiene uno: la tarjeta sigue abriendo el original.
 */
export function embedDeReel(o: Pick<OutlierVideo, 'url' | 'red'>): string | null {
  if (o.red === 'instagram') {
    const c = codigoDeReel(o.url);
    return c ? `https://www.instagram.com/reel/${c}/embed/` : null;
  }
  if (o.red === 'youtube') {
    const id = idDeYoutube(o.url);
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1` : null;
  }
  return null;
}

export type LecturaFuente = { ok: true; outliers: readonly OutlierVideo[]; resumen?: ResumenCriterio } | { ok: false; motivo: string };

/** Una fuente de outliers: la curada, la de Spy, la que traiga el chat de outliers. `leer` corre en el server. */
export type FuenteOutliersVideo = {
  id: string;
  nombre: string;
  leer: () => Promise<LecturaFuente>;
};

/** Lo que dibuja la portada: los outliers en orden, y las fuentes que no se pudieron leer (con su motivo). */
export type PortadaOutliers = {
  outliers: OutlierVideo[];
  caidas: { fuente: string; nombre: string; motivo: string }[];
  /** Lo que se miró con el criterio de edición (sumado de las fuentes que lo aplican); null = ninguna lo aplicó. */
  resumen?: ResumenCriterio | null;
};

/** El outlier del que sale cada plantilla guiada: la fuente curada de MaKo. */
export const OUTLIERS_CON_PLANTILLA: readonly OutlierVideo[] = PLANTILLAS_GUIADAS.map((p): OutlierVideo => ({
  id: `mako:${p.id}`,
  fuente: 'mako',
  red: p.referencia.red,
  formato: p.referencia.formato,
  creador: { nombre: p.referencia.creador.nombre, usuario: p.referencia.creador.usuario },
  url: p.referencia.url,
  miniatura: p.referencia.miniatura,
  titulo: p.nombre,
  porque: p.descripcion,
  duracionS: p.duracionS,
  // Sus números no se leyeron con la cuenta de su creador: no hay múltiplo, y se dice por qué (nunca uno inventado).
  multiplo: { veces: null, motivo: 'sin-cuenta', formato: 'corto', canal: p.referencia.red, comparadas: 0 },
  plantilla: p.id,
}));

export const FUENTE_MAKO: FuenteOutliersVideo = {
  id: 'mako',
  nombre: 'Plantillas de MaKo',
  leer: async () => ({ ok: true, outliers: OUTLIERS_CON_PLANTILLA }),
};

/** Una fila que no cumple el contrato no se dibuja (una fuente nueva puede traer basura): id con su fuente, link https. */
export function outlierValido(o: OutlierVideo): boolean {
  if (!o || typeof o.id !== 'string' || !o.id.startsWith(`${o.fuente}:`) || o.id.length > 120) return false;
  if (typeof o.url !== 'string' || !/^https:\/\//.test(o.url)) return false;
  if (o.miniatura != null && !/^(https:\/\/|\/)/.test(o.miniatura)) return false;
  return typeof o.titulo === 'string' && o.titulo.trim().length > 0;
}

/**
 * Junta lo leído de cada fuente: lo inválido afuera, sin repetidos (por id y por link), los que se pueden replicar primero y
 * después por múltiplo (sin número al final). Una fuente caída no tira las demás: queda en `caidas`, con su motivo.
 */
export function juntarOutliers(lecturas: readonly { fuente: FuenteOutliersVideo; lectura: LecturaFuente }[], ahora: number = Date.now()): PortadaOutliers {
  const vistos = new Set<string>();
  const outliers: OutlierVideo[] = [];
  const caidas: PortadaOutliers['caidas'] = [];
  let resumen: ResumenCriterio | null = null;
  for (const { fuente, lectura } of lecturas) {
    if (!lectura.ok) { caidas.push({ fuente: fuente.id, nombre: fuente.nombre, motivo: lectura.motivo }); continue; }
    if (lectura.resumen) resumen = sumarResumen(resumen, lectura.resumen);
    for (const o of lectura.outliers) {
      if (!outlierValido(o)) continue;
      const k = o.url.replace(/[?#].*$/, '').replace(/\/$/, '');
      if (vistos.has(o.id) || vistos.has(k)) continue;
      vistos.add(o.id); vistos.add(k);
      // Una plantilla que no existe no se ofrece: «Replicar» llevaría a nada.
      outliers.push(o.plantilla && !plantillaGuiada(o.plantilla) ? { ...o, plantilla: null } : o);
    }
  }
  const veces = (o: OutlierVideo) => (o.multiplo && o.multiplo.veces != null ? o.multiplo.veces : -1);
  // Sin número, después de los medidos y por sus vistas (docs/investigacion-outliers-video.md §2: «se ordena después de los
  // medidos, por sus vistas»).
  outliers.sort((a, b) => Number(!!b.plantilla) - Number(!!a.plantilla) || veces(b) - veces(a) || (b.vistas ?? -1) - (a.vistas ?? -1));
  return { outliers: vidriera(outliers, ahora), caidas, resumen };
}

// =============================================================================
// El criterio de EDICIÓN (11/11/2026)
// =============================================================================
// Martín, con la captura de la portada: «No debería tener una cantidad de reels random al azar… acá lo que queremos es poder
// replicar ciertos patrones de edición… Hay algunos que no son necesarios, por ejemplo hablando a cámara nada más o sentados
// tipo podcast». Cada reel de Spy se mira uno por uno (lib/video-outliers-criterio.ts: la clasificación con su juez) y a la
// portada llegan SÓLO los que enseñan un patrón de edición. Los descartados, los dudosos y los que todavía nadie miró no se
// muestran, pero se CUENTAN: la portada dice cuántos se midieron y cuántos quedaron.

/** Lo que dice la clasificación de un reel (por su código de Instagram). */
export type CriterioReel = {
  veredicto: 'patron' | 'descartar' | 'dudoso';
  familia: string | null;
  patron: string | null;
  motivo: string;
  formato: string;
  senales: readonly string[];
  base: 'portada' | 'video';
  receta?: string | null;
};

/**
 * Cuántos reels se midieron; cuántos enseñan un patrón Y superaron a su cuenta (los que se ven); cuántos tienen patrón pero no
 * superaron a su cuenta (o no se pudo medir); cuántos se descartaron; cuántos quedaron dudosos y cuántos falta mirar.
 */
export type ResumenCriterio = { medidos: number; conPatron: number; debajo: number; descartados: number; dudosos: number; sinMirar: number };

const sumarResumen = (a: ResumenCriterio | null, b: ResumenCriterio): ResumenCriterio =>
  a
    ? { medidos: a.medidos + b.medidos, conPatron: a.conPatron + b.conPatron, debajo: a.debajo + b.debajo, descartados: a.descartados + b.descartados, dudosos: a.dudosos + b.dudosos, sinMirar: a.sinMirar + b.sinMirar }
    : { ...b };

/**
 * Deja sólo los reels con un patrón de edición que ADEMÁS superaron a su cuenta (múltiplo ≥ 1), cada uno con lo que enseña (y
 * su receta, si tiene). Lo demás se cuenta. Un reel de otra red o sin código entra en «falta mirar» (no se inventa un veredicto).
 */
export function conCriterio(
  outliers: readonly OutlierVideo[],
  criterioDe: (codigo: string) => CriterioReel | null | undefined,
): { outliers: OutlierVideo[]; resumen: ResumenCriterio } {
  const resumen: ResumenCriterio = { medidos: 0, conPatron: 0, debajo: 0, descartados: 0, dudosos: 0, sinMirar: 0 };
  const quedan: OutlierVideo[] = [];
  for (const o of outliers) {
    resumen.medidos++;
    const codigo = o.red === 'instagram' ? codigoDeReel(o.url) : null;
    const c = codigo ? criterioDe(codigo) : null;
    if (!c) { resumen.sinMirar++; continue; }
    if (c.veredicto === 'descartar') { resumen.descartados++; continue; }
    // Un «patrón» sin familia de la lista no se muestra: no hay con qué juntarlo ni cómo filtrarlo (se cuenta como dudoso).
    if (c.veredicto === 'dudoso' || !c.patron || !esFamiliaEdicion(c.familia)) { resumen.dudosos++; continue; }
    // «Seleccionar los mejores» (Martín): un patrón que le fue PEOR que a su cuenta no prueba que funcione. Sin número, tampoco.
    if (!(o.multiplo?.veces != null && o.multiplo.veces >= 1)) { resumen.debajo++; continue; }
    resumen.conPatron++;
    quedan.push({
      ...o,
      edicion: { familia: c.familia, patron: c.patron, motivo: c.motivo, senales: c.senales, base: c.base },
      // La receta: la suya, o la de su familia (lib/video-recetas.ts).
      receta: c.receta ?? recetaDeFamilia(c.familia)?.id ?? null,
    });
  }
  return { outliers: quedan, resumen };
}

/** La ventana de la vidriera: un outlier viejo sigue siendo copiable, pero su audio y su tendencia ya pasaron (§2). */
export const DIAS_VIDRIERA = 90;
/** Con menos que esto adentro de la ventana, se muestra todo: una portada casi vacía es peor que una con reels viejos. */
export const MINIMO_EN_VENTANA = 12;

/**
 * Lo que se ve primero (docs/investigacion-outliers-video.md §2, «La vidriera»): los de los últimos 90 días (si alcanzan), en
 * el orden de arriba, y como mucho 2 del mismo creador cada 12 tarjetas (`conVariedad`, la de los carruseles: sin eso la
 * primera pantalla es de una sola cuenta). Lo replicable (una plantilla de MaKo) va siempre, primero; después, los que pasaron el
 * criterio de edición, sin ventana ni variedad.
 */
function vidriera(orden: readonly OutlierVideo[], ahora: number): OutlierVideo[] {
  const replicables = orden.filter((o) => o.plantilla);
  // Los que pasaron el criterio de edición, TODOS y en el orden de su múltiplo (Martín, 11/11/2026: «ordenados por cuánto
  // superaron a su cuenta»): un patrón de edición no vence a los 90 días como un audio de moda.
  const curados = orden.filter((o) => !o.plantilla && o.edicion);
  const resto = orden.filter((o) => !o.plantilla && !o.edicion);
  // Lo que no pasa por el criterio (los reels propios del negocio), con la ventana y la variedad de siempre, después.
  const desde = ahora - DIAS_VIDRIERA * 86_400_000;
  const recientes = resto.filter((o) => { const t = Date.parse(o.publicada ?? ''); return Number.isFinite(t) && t >= desde; });
  const elegidos = recientes.length >= MINIMO_EN_VENTANA ? recientes : resto;
  return [...replicables, ...curados, ...conVariedad(elegidos, (o) => o.creador.usuario ?? o.creador.nombre)];
}

// =============================================================================
// La fuente de Spy: los reels de las cuentas que el negocio sigue (11/11/2026)
// =============================================================================
// Martín, 11/11/2026, con la captura de la portada: UNA tarjeta (la plantilla), sin imagen y con «Sin datos de su cuenta». La
// fuente «Ya» de docs/investigacion-outliers-video.md §1: lo que Spy YA trajo (`spy_piezas`), sin gastar nada, con la miniatura
// que Spy guardó en NUESTRO bucket y el «×» de toda la app. Copia de lo que hace Image con los carruseles
// (lib/carruseles/explorar.ts → `carruselesDe`): el múltiplo de cada reel sale de TODAS las piezas de su cuenta (el mismo número
// que dice Spy), y lo que ya no se ve no entra.

/** Lo que se lee de `spy_piezas` (la forma de la tabla) para un reel. */
export type PiezaReel = PiezaParaMultiplo & {
  url: string;
  miniatura: string | null;
  analisis?: { gancho?: string | null } | null;
};
export type CuentaSpy = { id: number; nombre: string; instagram: string | null; avatar?: string | null };

/** ¿Es un reel de Instagram? (Spy los guarda como `tipo: 'reel'`; las publicaciones de video, con `medio: 'video'`). */
export const esReel = (p: Pick<PiezaReel, 'canal' | 'tipo' | 'medio'>): boolean => p.canal === 'instagram' && (p.tipo === 'reel' || p.medio === 'video');

/** El título de la tarjeta: el gancho que leyó Spy; si no, la primera línea del pie; si no, de quién es. */
export function tituloDeReel(p: Pick<PiezaReel, 'analisis' | 'texto'>, cuenta: Pick<CuentaSpy, 'nombre' | 'instagram'>): string {
  const gancho = p.analisis?.gancho?.trim();
  if (gancho) return gancho;
  const linea = (p.texto ?? '').split('\n').map((l) => l.trim()).find(Boolean);
  if (linea) return linea.length > 140 ? `${linea.slice(0, 139).trimEnd()}…` : linea;
  return `Reel de ${cuenta.instagram ? `@${cuenta.instagram}` : cuenta.nombre}`;
}

export function outliersDeSpy(piezas: readonly PiezaReel[], cuentas: readonly CuentaSpy[], ahora: number = Date.now()): OutlierVideo[] {
  // Sólo las cuentas con Instagram: sin el @ no hay a quién atribuirle el reel ni ficha a la que llevar.
  const porId = new Map(cuentas.filter((c) => !!c.instagram).map((c) => [c.id, c]));
  const porCuenta = new Map<number, PiezaReel[]>();
  for (const p of piezas) {
    if (p.canal !== 'instagram' || !porId.has(p.competidor_id)) continue;
    const xs = porCuenta.get(p.competidor_id);
    if (xs) xs.push(p); else porCuenta.set(p.competidor_id, [p]);
  }
  const out: OutlierVideo[] = [];
  for (const [cid, suyas] of porCuenta) {
    const c = porId.get(cid)!;
    const multiplos = multiplosDe(suyas, ahora);
    for (const p of suyas) {
      if (!esReel(p) || p.dejo_de_verse_en) continue;
      out.push({
        id: `spy:${p.id}`,
        fuente: 'spy',
        red: 'instagram',
        formato: 'reel',
        creador: { nombre: c.nombre, usuario: c.instagram, foto: c.avatar ?? null, competidorId: cid },
        url: p.url,
        miniatura: p.miniatura,
        titulo: tituloDeReel(p, c),
        porque: '',
        duracionS: null,
        multiplo: multiplos.get(p.id) ?? null,
        plantilla: null,
        vistas: p.vistas,
        megusta: p.megusta,
        comentarios: p.comentarios,
        publicada: p.publicada_en,
      });
    }
  }
  return out;
}

// =============================================================================
// Lo propio: los reels del negocio que le fueron mejor que a su mediana (11/11/2026)
// =============================================================================
// La fuente «3» de docs/investigacion-outliers-video.md §1: su Instagram por Zernio (lib/zernio-organico.ts). Totalmente legal
// (es su cuenta) y sin costo de MaKo. Entra a `multiplosDe` como una cuenta más, con un id que no choca con Spy (positivos) ni
// con la biblioteca (negativos chicos). Un post que Zernio todavía no sincronizó (`sinMetricas`) no tiene números: su 0 no es
// «nadie lo vio» (lib/organico-reglas.ts), así que no entra a la mediana ni se mide.

export const CUENTA_PROPIA = -1_000_000_000;

export function outliersPropios(
  cuenta: { usuario: string; nombre: string },
  publicaciones: readonly PublicacionOrganica[],
  ahora: number = Date.now(),
): OutlierVideo[] {
  const reels = publicaciones.filter((p) => p.tipo === 'reel' && typeof p.url === 'string' && /^https:\/\//.test(p.url));
  const piezas = reels.map((p, i) => ({
    id: i + 1, competidor_id: CUENTA_PROPIA, canal: 'instagram', tipo: 'reel', publicada_en: p.fecha, texto: p.texto,
    vistas: p.sinMetricas ? null : p.vistas, megusta: p.sinMetricas ? null : p.meGusta, comentarios: p.sinMetricas ? null : p.comentarios,
  }));
  const multiplos = multiplosDe(piezas, ahora);
  return reels.map((p, i): OutlierVideo => ({
    id: `propio:${p.id}`,
    fuente: 'propio',
    red: 'instagram',
    formato: 'reel',
    creador: { nombre: cuenta.nombre || cuenta.usuario, usuario: cuenta.usuario, foto: null, competidorId: null },
    url: p.url as string,
    // La del CDN de Instagram, leída AHORA (no se guarda: vence en días).
    miniatura: p.miniatura && /^https:\/\//.test(p.miniatura) ? p.miniatura : null,
    titulo: tituloDeReel({ texto: p.texto, analisis: null }, { nombre: cuenta.nombre, instagram: cuenta.usuario }),
    porque: '',
    duracionS: null,
    multiplo: multiplos.get(i + 1) ?? null,
    plantilla: null,
    vistas: piezas[i].vistas,
    megusta: piezas[i].megusta,
    comentarios: piezas[i].comentarios,
    publicada: p.fecha,
  }));
}
