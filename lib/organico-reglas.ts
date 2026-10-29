// =============================================================================
// organico-reglas — Instagram orgánico por Zernio: lo que se lee y cómo se dice (28/10/2026)
// =============================================================================
// Martín a Teo (28/10, 00:16:26): «por WhatsApp preguntás cómo vienen las últimas publicaciones de Instagram». MaKo no tenía
// ninguna fuente de redes orgánicas (docs/revisiones: «el dashboard está conectado a todos tus datos… ninguna de redes»).
// Zernio la tiene (`/v1/analytics/instagram/account-insights`, `…/follower-history` y `/v1/analytics`), con su complemento
// de Analytics (pago, aparte: sin él contesta 402).
//
// ⚠️ «NO PUDE LEER» NO ES «CERO»: lo que no vino es null. Un 0 inventado le diría al cliente que nadie vio su reel.
//
// Puro (sin `server-only`): lo prueba tests/organico-reglas.test.ts. La lectura: lib/zernio-organico.ts.
// =============================================================================

export type MotivoOrganico = 'sin-analytics' | 'sin-clave' | 'sin-cuenta' | 'clave-mala' | 'respuesta' | 'error';

export const TEXTO_MOTIVO_ORGANICO: Record<MotivoOrganico, string> = {
  'sin-analytics': 'La cuenta de Zernio no tiene el complemento de Analytics: sin él, Zernio no entrega las métricas de Instagram. Se activa desde tu cuenta de Zernio (en sus planes, el complemento «Analytics») y lo paga el negocio.',
  'sin-clave': 'Zernio no está conectado en este negocio.',
  'sin-cuenta': 'No hay una cuenta de Instagram conectada en Zernio.',
  'clave-mala': 'Zernio no aceptó la clave del negocio.',
  respuesta: 'Zernio contestó algo que MaKo no sabe leer.',
  error: 'No se pudo leer Zernio en este momento.',
};

/**
 * Los mismos motivos cuando la clave es de la CUENTA DE MaKo (el ws1, o un negocio con la cuenta prestada de la plataforma): ni
 * «tu cuenta» ni «lo paga el negocio», que no es suya (la verificación del 28/10; la misma regla que `motivoDeError` de Conectar).
 */
const TEXTO_DE_LA_CASA: Partial<Record<MotivoOrganico, string>> = {
  'sin-analytics': 'La cuenta de Zernio con la que MaKo lee este negocio no tiene el complemento de Analytics: sin él, Zernio no entrega las métricas de Instagram. Lo resuelve el equipo de MaKo.',
  'clave-mala': 'Zernio no aceptó la clave con la que MaKo se conecta. Lo resuelve el equipo de MaKo.',
};

/** El texto de un motivo, según de quién es la clave con la que se habló. */
export function textoOrganico(m: MotivoOrganico, deLaCasa: boolean): string {
  return (deLaCasa && TEXTO_DE_LA_CASA[m]) || TEXTO_MOTIVO_ORGANICO[m];
}

export function motivoDeStatus(status: number): MotivoOrganico {
  if (status === 402) return 'sin-analytics';
  if (status === 401 || status === 403) return 'clave-mala';
  if (status === 404) return 'sin-cuenta';
  return 'error';
}

/** Los días máximos que Zernio deja pedir de una vez (89 los seguidores, 90 la cuenta: se usa el menor). */
export const MAX_DIAS_ORGANICO = 89;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const diaUtc = (f: string) => Date.parse(`${f}T00:00:00Z`);
const sumarDias = (f: string, n: number) => new Date(diaUtc(f) + n * 86_400_000).toISOString().slice(0, 10);

/** El rango a leer: por defecto los últimos 30 días hasta hoy; nunca más de 89. */
export function rangoOrganico(desde: string | null, hasta: string | null, hoy: string): { desde: string; hasta: string } | { error: string } {
  const h = hasta ?? hoy;
  const d = desde ?? sumarDias(h, -29);
  if (!FECHA.test(d) || !FECHA.test(h)) return { error: 'Las fechas van como YYYY-MM-DD.' };
  if (d > h) return { error: '«desde» no puede ser después de «hasta».' };
  const dias = Math.round((diaUtc(h) - diaUtc(d)) / 86_400_000) + 1;
  if (dias > MAX_DIAS_ORGANICO) return { error: `Hasta ${MAX_DIAS_ORGANICO} días de una vez.` };
  return { desde: d, hasta: h };
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** La serie de una métrica: `[{ date, value }]` → `[{ fecha, valor }]` (sólo los puntos con número). */
function serieDe(m: Json | null): Array<{ fecha: string; valor: number }> {
  const vals = Array.isArray(m?.values) ? (m!.values as unknown[]) : [];
  return vals.flatMap((x) => { const o = obj(x); const f = str(o?.date); const v = num(o?.value); return f && v != null ? [{ fecha: f.slice(0, 10), valor: v }] : []; });
}

/** El total de una métrica: `total` (o `value`), o la suma de su serie. null si no vino. */
function totalDe(m: Json | null): number | null {
  if (!m) return null;
  const t = num(m.total) ?? num(m.value);
  if (t != null) return t;
  const s = serieDe(m);
  return s.length ? s.reduce((a, x) => a + x.valor, 0) : null;
}

/**
 * El día de una publicación EN LA ZONA DEL NEGOCIO. Zernio manda `publishedAt` en UTC (con Z): cortarlo a 10 caracteres corre al
 * día siguiente todo lo publicado de noche (en Buenos Aires, de 21:00 a 23:59: la franja fuerte de Instagram; la verificación del
 * 28/10). Un día suelto (YYYY-MM-DD, sin hora) queda como vino. null si no se entiende.
 */
export function diaLocal(fecha: string | null, tz: string): string | null {
  if (!fecha) return null;
  if (FECHA.test(fecha)) return fecha;
  const ms = Date.parse(fecha);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/** Las métricas que Zernio puede decir que no entregó, en palabras. */
const ROTULO_METRICA: Record<string, string> = {
  follower_count: 'el total de seguidores', followers_gained: 'los seguidores ganados', followers_lost: 'los seguidores perdidos',
  reach: 'el alcance', views: 'las vistas', accounts_engaged: 'las cuentas que interactuaron', total_interactions: 'las interacciones',
  likes: 'los me gusta', comments: 'los comentarios', saves: 'los guardados', shares: 'los compartidos', profile_views: 'las visitas al perfil',
};

/**
 * Lo que Zernio dice que NO entregó (`unavailableMetrics: [{ metric, reason }]`, documentado en follower-history): queda en null
 * y además DICHO, con su motivo (la verificación del 28/10: el null estaba, el «qué faltó y por qué» no). [] si no dice nada.
 */
export function noEntregadasDe(body: unknown): string[] {
  const l = obj(body)?.unavailableMetrics;
  if (!Array.isArray(l)) return [];
  return l.flatMap((x) => {
    const o = obj(x);
    const m = str(o?.metric) ?? (typeof x === 'string' ? x : null);
    if (!m) return [];
    const r = str(o?.reason);
    return [`${ROTULO_METRICA[m] ?? m} no vino de Instagram${r ? ` (motivo de Zernio: ${r})` : ''}`];
  });
}

/** Los totales de la cuenta (`account-insights`), por métrica. null si la respuesta no trae `metrics`. */
export function totalesDeInsights(body: unknown, metricas: readonly string[]): Record<string, number | null> | null {
  const ms = obj(obj(body)?.metrics);
  if (!ms) return null;
  return Object.fromEntries(metricas.map((k) => [k, totalDe(obj(ms[k]))]));
}

/** Los seguidores (`follower-history`, time_series): el último conteo, ganados, perdidos y la serie. null sin `metrics`. */
export function seguidoresDe(body: unknown): { actual: number | null; ganados: number | null; perdidos: number | null; serie: Array<{ fecha: string; valor: number }> } | null {
  const ms = obj(obj(body)?.metrics);
  if (!ms) return null;
  const serie = serieDe(obj(ms.follower_count)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    actual: serie.length ? serie[serie.length - 1].valor : num(obj(ms.follower_count)?.total),
    ganados: totalDe(obj(ms.followers_gained)),
    perdidos: totalDe(obj(ms.followers_lost)),
    serie,
  };
}

export type PublicacionOrganica = {
  id: string; fecha: string | null; tipo: 'reel' | 'story' | 'post' | 'carrusel'; texto: string; url: string | null; miniatura: string | null;
  alcance: number | null; vistas: number | null; impresiones: number | null; meGusta: number | null; comentarios: number | null;
  compartidos: number | null; guardados: number | null; interaccionPct: number | null; deZernio: boolean;
  /** Zernio todavía no trajo sus métricas ('pendiente') o Instagram no las da ('no-disponible'): los números van en null. */
  sinMetricas: 'pendiente' | 'no-disponible' | null;
};

/**
 * ¿Zernio ya trajo las métricas de este post? `syncStatus` (synced | pending | partial | unavailable, el general) y, si viene, el de
 * Instagram en `platformAnalytics`. Mientras sincroniza manda 0 (y `lastUpdated` null): ese 0 NO es «nadie lo vio» (la verificación
 * del 28/10, el post recién publicado, justo el que se pregunta). Sin ninguno de los dos campos, se toma lo que vino.
 */
function sincronizacionDe(p: Json, a: Json): PublicacionOrganica['sinMetricas'] {
  const deIg = Array.isArray(p.platformAnalytics)
    ? (p.platformAnalytics as unknown[]).map(obj).find((x) => str(x?.platform)?.toLowerCase() === 'instagram')
    : null;
  const s = (str(deIg?.syncStatus) ?? str(p.syncStatus) ?? '').toLowerCase();
  if (s === 'pending') return 'pendiente';
  if (s === 'unavailable') return 'no-disponible';
  if (!s && 'lastUpdated' in a && a.lastUpdated == null) return 'pendiente';
  return null;
}

const TIPOS: Record<string, PublicacionOrganica['tipo']> = {
  reel: 'reel', reels: 'reel', video: 'reel', story: 'story', stories: 'story', carousel: 'carrusel', carousel_album: 'carrusel', image: 'post', photo: 'post', post: 'post', feed: 'post',
};
const tipoDe = (p: Json): PublicacionOrganica['tipo'] => TIPOS[(str(p.contentType) ?? str(p.mediaType) ?? str(p.type) ?? '').toLowerCase()] ?? 'post';

/** La lista de publicaciones (`/v1/analytics`), de la más nueva a la más vieja. null si la respuesta no trae una lista. */
export function publicacionesDe(body: unknown): PublicacionOrganica[] | null {
  const b = obj(body);
  const lista = Array.isArray(b?.posts) ? b!.posts : Array.isArray(b?.data) ? b!.data : Array.isArray(b?.items) ? b!.items : Array.isArray(body) ? body : null;
  if (!lista) return null;
  const out = (lista as unknown[]).flatMap((x) => {
    const p = obj(x);
    const id = str(p?.postId) ?? str(p?._id) ?? str(p?.id);
    if (!p || !id) return [];
    const a0 = obj(p.analytics) ?? {};
    const sinMetricas = sincronizacionDe(p, a0);
    const a: Json = sinMetricas ? {} : a0;
    const texto = (str(p.content) ?? '').replace(/\s+/g, ' ');
    return [{
      id, fecha: str(p.publishedAt) ?? str(p.scheduledFor), tipo: tipoDe(p), texto: texto.length > 140 ? `${texto.slice(0, 137)}…` : texto,
      url: str(p.platformPostUrl), miniatura: str(p.thumbnailUrl),
      alcance: num(a.reach), vistas: num(a.views), impresiones: num(a.impressions), meGusta: num(a.likes), comentarios: num(a.comments),
      compartidos: num(a.shares), guardados: num(a.saves), interaccionPct: num(a.engagementRate), deZernio: p.isExternal === false, sinMetricas,
    } satisfies PublicacionOrganica];
  });
  return out.sort((x, y) => (y.fecha ?? '').localeCompare(x.fecha ?? ''));
}
