// =============================================================================
// creativo-mako — los videos que MaKo ya generó, como creativos del Ads Manager
// =============================================================================
// Tarea #797: para publicar un anuncio hecho en /video-generator había que bajar el
// .mp4, buscarlo en el explorador y volver a subirlo. Ahora el modal ofrece lo que
// MaKo ya tiene en su bucket propio (`video-clips`, público, no vence) y el server se
// lo pasa a Meta por `file_url`: los bytes no pasan por el disco de nadie.
//
// DOS fuentes, en este orden en la pantalla:
//   · el anuncio MONTADO (montaje_trabajos 'listo'): el que se pensó para publicar;
//   · las TOMAS sueltas del historial (`video[n].url` de cada plan).
// ⚠️ Las dos hacen falta HOY: el 07/10/2026 no había NI UN montaje 'listo' en ningún
// workspace (el worker de montaje nunca tomó un trabajo: docs/hallazgos-generativa.md),
// así que con la primera sola el selector salía vacío para todos. Las tomas sí existen.
//
// ⚠️ LA URL SE DERIVA, NO SE VALIDA CONTRA UN PREFIJO. El bucket es público y la ruta
// no lleva el workspace (`video-generator/<plan>/…`): una url que viajara del navegador
// dejaría a un admin del ws A publicar el video del ws B, y un «empieza con
// …/video-clips/» (urlEsPropia, lib/api-mako/areas/video.helpers.ts) lo aceptaría. Acá
// la url se ARMA desde datos del workspace —el id del montaje, el plan y la toma— con
// la misma función que la escribió, y se exige que lo guardado sea EXACTAMENTE eso.
// Lo que no coincide no se ofrece: un `resultado.url` es un dato que manda el worker, y
// una toma vieja puede tener guardado el enlace firmado de Google (vence a las ~6 h).
//
// SIN `server-only` a propósito: lo prueban los tests, y el modal importa SÓLO sus
// tipos (la frontera de 'use client' es de datos: AGENTS.md).
// =============================================================================

/** El bucket donde el generador deja las tomas y el montaje los anuncios. */
export const BUCKET_CLIPS_MAKO = 'video-clips';

export type OrigenCreativoMako = 'montaje' | 'toma';

export type CreativoMako = {
  /**
   * Lo ÚNICO que vuelve del navegador al server: `montaje:<id>` o `toma:<plan>:<n>:<op>`.
   * Con eso el server vuelve a buscar el archivo en el workspace de la sesión.
   */
  ref: string;
  origen: OrigenCreativoMako;
  plan_id: string;
  /** El título del anuncio del que sale (el del plan del generador). */
  titulo: string;
  /** El número de toma; null en un anuncio montado. */
  toma: number | null;
  /**
   * La url pública del archivo, para la vista previa y la miniatura. ⚠️ Baja del
   * server y NO vuelve: el POST manda `ref`, nunca esto.
   */
  url: string;
  /**
   * Hoy siempre 'video'. ⚠️ El tipo ya admite la imagen y la pantalla no la ofrece: no
   * existe un generador de imágenes con storage propio (/image-generator es ComingSoon,
   * #298) y las imágenes de escena del video-generator son urls de Flow que vencen.
   */
  media_type: 'video' | 'image';
  /** Cuándo quedó listo (montado) o cuándo se guardó el anuncio (toma). */
  fecha: string | null;
};

// ⚠️ LA REF DE UNA TOMA NOMBRA EL CLIP, NO SÓLO EL NÚMERO DE TOMA (revisión del 07/10).
// Con `toma:<plan>:<n>` el server resolvía lo que esa toma tuviera guardado AL HACER
// CLIC, mientras la miniatura de la bandeja, el análisis de MaKo y la vista previa
// salían de la url que vino en la lista. Si la toma se volvía a filmar en el medio
// (/video-generator guarda `toma-<n>-<op nueva>.mp4` y mueve `video[n]` a ella), a Meta
// subía un video distinto del que la persona vio y aprobó, sin que nada fallara.
// La `op` es la operación de Flow de ESE archivo (la misma con la que se arma su ruta):
// identifica el clip sin que la url viaje, y si hoy la toma guarda otra, no resuelve.
// El montado no la necesita: cada montaje es una fila nueva con su id.
export type RefCreativoMako =
  | { origen: 'montaje'; id: number }
  | { origen: 'toma'; plan_id: string; toma: number; op: string };

type RefToma = Extract<RefCreativoMako, { origen: 'toma' }>;

// El plan es un uuid y la operación de Flow también. Medido el 07/10/2026 con un SELECT
// de sólo lectura: las 31 tomas con url de ws1 y ws11 tienen esa forma, y las 31 son
// EXACTAMENTE la ruta armada con su `mediaId` (que en las 31 es igual a `operacion`).
// Se acota la FORMA para que ninguno de los dos pueda meter una barra ni un `..` en la
// ruta que se arma con ellos.
const PLAN_OK = /^[A-Za-z0-9-]{1,64}$/;
const OP_OK = /^[A-Za-z0-9_-]{1,128}$/;
const TOMA_MAX = 999;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const entero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,12}$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

export function refDeCreativo(r: RefCreativoMako): string {
  return r.origen === 'montaje' ? `montaje:${r.id}` : `toma:${r.plan_id}:${r.toma}:${r.op}`;
}

/**
 * Lee la referencia que mandó el navegador. null = no tiene la forma de ninguna.
 * La forma vieja de la toma (`toma:<plan>:<n>`, sin el clip) no se acepta: es justo la
 * que dejaba subir otro video que el que se vio.
 */
export function leerRefCreativo(v: unknown): RefCreativoMako | null {
  // 5 + 64 + 1 + 3 + 1 + 128 = 202 caracteres para la toma más larga posible.
  if (typeof v !== 'string' || v.length > 256) return null;
  const m = /^montaje:(\d{1,12})$/.exec(v);
  if (m) { const id = entero(m[1]); return id ? { origen: 'montaje', id } : null; }
  const t = /^toma:([A-Za-z0-9-]{1,64}):(\d{1,3}):([^:]+)$/.exec(v);
  if (t) {
    const toma = entero(t[2]);
    return toma && toma <= TOMA_MAX && OP_OK.test(t[3]) ? { origen: 'toma', plan_id: t[1], toma, op: t[3] } : null;
  }
  return null;
}

/** La misma ruta que acuña app/api/montaje/worker/route.ts al entregar el trabajo. */
export function rutaDelMontado(planId: string, id: number): string {
  return `video-generator/${planId}/montado-${id}.mp4`;
}

/** La misma ruta que escribe `guardarClip` (app/video-generator/video-action.ts). */
export function rutaDeToma(planId: string, n: number, operacion: string): string {
  return `video-generator/${planId}/toma-${n}-${operacion}.mp4`;
}

/** Una fila de montaje_trabajos 'listo', con la url y el título ya sacados del jsonb. */
export type FilaMontajeListo = { id: unknown; plan_id: unknown; url: unknown; titulo: unknown; listo_at: unknown };

/**
 * Los anuncios montados que se pueden ofrecer: los que dejaron su archivo EXACTAMENTE
 * donde el server dijo, uno por anuncio (el último montaje), el más nuevo primero.
 * `urlDe` es la url pública de una ruta del bucket (en el server, getPublicUrl).
 */
export function creativosDeMontajes(filas: ReadonlyArray<FilaMontajeListo>, urlDe: (ruta: string) => string): CreativoMako[] {
  const porPlan = new Map<string, CreativoMako & { _id: number }>();
  for (const f of filas) {
    const id = entero(f.id);
    const plan = str(f.plan_id);
    const url = str(f.url);
    if (!id || !PLAN_OK.test(plan) || !url) continue;
    if (url !== urlDe(rutaDelMontado(plan, id))) continue;
    const previo = porPlan.get(plan);
    if (previo && previo._id > id) continue;
    porPlan.set(plan, {
      _id: id, ref: refDeCreativo({ origen: 'montaje', id }), origen: 'montaje', plan_id: plan,
      titulo: str(f.titulo).trim() || 'Anuncio', toma: null, url, media_type: 'video', fecha: str(f.listo_at) || null,
    });
  }
  return [...porPlan.values()]
    .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '') || b._id - a._id)
    .map(({ _id: _fuera, ...c }) => c);
}

/** Lo que hace falta de un plan del historial (PlanGuardado, app/video-generator/video-datos.ts). */
export type PlanConTomas = {
  id: string;
  at?: string;
  pedido?: string;
  plan: { titulo?: string };
  video?: Record<string, { url?: string; mediaId?: string; operacion?: string } | undefined>;
};

/**
 * Las tomas filmadas que viven en el bucket propio. La operación de Flow está en la
 * marca (`mediaId`, y `operacion` en las viejas): la url se arma con ella y tiene que
 * coincidir. El anuncio más nuevo primero y sus tomas en orden.
 */
export function creativosDeTomas(planes: ReadonlyArray<PlanConTomas>, urlDe: (ruta: string) => string): CreativoMako[] {
  const out: CreativoMako[] = [];
  const orden = [...planes].sort((a, b) => str(b.at).localeCompare(str(a.at)));
  for (const p of orden) {
    if (!PLAN_OK.test(str(p.id))) continue;
    const titulo = str(p.plan?.titulo).trim() || str(p.pedido).trim() || 'Anuncio';
    const tomas: CreativoMako[] = [];
    for (const [k, m] of Object.entries(p.video ?? {})) {
      const n = entero(k);
      const url = str(m?.url);
      if (!n || n > TOMA_MAX || !url) continue;
      // La op que va en la ref es la que ARMA esta url: mientras se vuelve a filmar,
      // `operacion` ya es la nueva y `url`/`mediaId` siguen siendo del clip anterior.
      const op = [str(m?.mediaId), str(m?.operacion)].filter((o) => OP_OK.test(o))
        .find((o) => url === urlDe(rutaDeToma(p.id, n, o)));
      if (!op) continue;
      tomas.push({
        ref: refDeCreativo({ origen: 'toma', plan_id: p.id, toma: n, op }), origen: 'toma', plan_id: p.id,
        titulo, toma: n, url, media_type: 'video', fecha: str(p.at) || null,
      });
    }
    out.push(...tomas.sort((a, b) => (a.toma ?? 0) - (b.toma ?? 0)));
  }
  return out;
}

/**
 * La toma que pidió el navegador, contra lo que se ofrece HOY para ese plan (la salida
 * de creativosDeTomas, o sea la MISMA función que armó la lista).
 *   · null      → esa toma ya no se ofrece (no está filmada, o su archivo no coincide);
 *   · 'cambio'  → se ofrece OTRO clip: se volvió a filmar después de abrir la lista, y
 *                 subir el de hoy sería publicar un video que la persona no vio;
 *   · el creativo, si es exactamente el que se mostró.
 */
export function tomaPedida(ofrecidas: ReadonlyArray<CreativoMako>, ref: RefToma): CreativoMako | 'cambio' | null {
  const hoy = ofrecidas.find((c) => c.origen === 'toma' && c.plan_id === ref.plan_id && c.toma === ref.toma);
  if (!hoy) return null;
  return hoy.ref === refDeCreativo(ref) ? hoy : 'cambio';
}

/**
 * ¿La url es del mismo ORIGEN que el storage propio? Segunda red antes de pasársela a
 * Meta. Con `new URL(...).origin`, nunca con includes()/startsWith(): `…supabase.co@otro.tld`
 * empieza igual y su origen real es `otro.tld` (AGENTS.md, «Un guard de ORIGEN»).
 */
export function mismoOrigen(url: string, base: string | null | undefined): boolean {
  if (!base) return false;
  try {
    const u = new URL(url);
    const b = new URL(base);
    return u.protocol === 'https:' && !u.username && !u.password && u.origin === b.origin;
  } catch {
    return false;
  }
}
