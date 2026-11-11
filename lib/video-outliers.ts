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
};

export type LecturaFuente = { ok: true; outliers: readonly OutlierVideo[] } | { ok: false; motivo: string };

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
};

/** El outlier del que sale cada plantilla guiada: la fuente curada de MaKo. */
export const OUTLIERS_CON_PLANTILLA: readonly OutlierVideo[] = PLANTILLAS_GUIADAS.map((p): OutlierVideo => ({
  id: `mako:${p.id}`,
  fuente: 'mako',
  red: p.referencia.red,
  formato: p.referencia.formato,
  creador: { nombre: p.referencia.creador.nombre, usuario: p.referencia.creador.usuario },
  url: p.referencia.url,
  miniatura: null,
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
  for (const { fuente, lectura } of lecturas) {
    if (!lectura.ok) { caidas.push({ fuente: fuente.id, nombre: fuente.nombre, motivo: lectura.motivo }); continue; }
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
  return { outliers: vidriera(outliers, ahora), caidas };
}

/** La ventana de la vidriera: un outlier viejo sigue siendo copiable, pero su audio y su tendencia ya pasaron (§2). */
export const DIAS_VIDRIERA = 90;
/** Con menos que esto adentro de la ventana, se muestra todo: una portada casi vacía es peor que una con reels viejos. */
export const MINIMO_EN_VENTANA = 12;

/**
 * Lo que se ve primero (docs/investigacion-outliers-video.md §2, «La vidriera»): los de los últimos 90 días (si alcanzan), en
 * el orden de arriba, y como mucho 2 del mismo creador cada 12 tarjetas (`conVariedad`, la de los carruseles: sin eso la
 * primera pantalla es de una sola cuenta). Lo replicable (una plantilla de MaKo) va siempre, primero.
 */
function vidriera(orden: readonly OutlierVideo[], ahora: number): OutlierVideo[] {
  const replicables = orden.filter((o) => o.plantilla);
  const resto = orden.filter((o) => !o.plantilla);
  const desde = ahora - DIAS_VIDRIERA * 86_400_000;
  const recientes = resto.filter((o) => { const t = Date.parse(o.publicada ?? ''); return Number.isFinite(t) && t >= desde; });
  const elegidos = recientes.length >= MINIMO_EN_VENTANA ? recientes : resto;
  return [...replicables, ...conVariedad(elegidos, (o) => o.creador.usuario ?? o.creador.nombre)];
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
