// =============================================================================
// zernio-organico — lo orgánico de Instagram por Zernio: la cuenta, los seguidores y las publicaciones (28/10/2026)
// =============================================================================
// Martín a Teo (28/10): «por WhatsApp preguntás cómo vienen las últimas publicaciones de Instagram», y las plantillas de
// Instagram del Dashboard. Es LA fuente de redes orgánicas de MaKo: la usan la operación `ver_rendimiento_redes` (WhatsApp, el
// chat) y, después, el Dashboard y los reportes de agencia. Las decisiones puras: lib/organico-reglas.ts.
//
//   · La cuenta de Instagram es una de las conectadas en Zernio (`conexionesViaZernio`); con varias, la que se nombra o la primera.
//   · Las tres lecturas van a la vez y una que falla no tumba a las otras: lo que no se pudo leer se dice (`faltan`).
//   · ⚠️ El complemento de Analytics de Zernio es PAGO y aparte: sin él contesta 402, y eso se dice en palabras.
//
// Está en la lista `CANAL` de tests/sin-instagram.test.ts: habla con Zernio con la clave del negocio (`cfg`).
// =============================================================================

import 'server-only';
import { cfg, zFetch, ZernioError } from './zernio';
import { conexionesViaZernio, ZernioConectarError } from './zernio-conectar';
import {
  motivoDeStatus, publicacionesDe, seguidoresDe, TEXTO_MOTIVO_ORGANICO, totalesDeInsights, type MotivoOrganico, type PublicacionOrganica,
} from './organico-reglas';

/** Las métricas de la cuenta que se piden (todas «total_value»: sólo `reach` tiene serie). */
export const METRICAS_CUENTA = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'saves', 'shares', 'profile_views'] as const;

export type RendimientoOrganico = {
  cuenta: { accountId: string; usuario: string; nombre: string };
  desde: string; hasta: string;
  cuentaMetricas: Record<string, number | null> | null;
  seguidores: ReturnType<typeof seguidoresDe>;
  publicaciones: PublicacionOrganica[] | null;
  /** Lo que no se pudo leer, en palabras (una lectura que falla no tumba a las otras). */
  faltan: string[];
};

function motivoDe(e: unknown): MotivoOrganico {
  if (e instanceof ZernioConectarError) return e.motivo === 'sin-clave' ? 'sin-clave' : e.motivo === 'clave-mala' ? 'clave-mala' : 'error';
  if (e instanceof ZernioError) return e.status === 0 && /no está configurado/i.test(e.message) ? 'sin-clave' : motivoDeStatus(e.status);
  return 'error';
}

/**
 * El rendimiento orgánico de la cuenta de Instagram del negocio entre dos días. `{ error }` si no hay de dónde leer (sin
 * Zernio, sin Instagram conectado, o las tres lecturas fallaron por lo mismo: el complemento de Analytics, por ejemplo).
 */
export async function rendimientoInstagram(ws: number, p: { desde: string; hasta: string; usuario?: string | null; limite?: number }): Promise<RendimientoOrganico | { error: MotivoOrganico; texto: string }> {
  let cuentas;
  try {
    cuentas = (await conexionesViaZernio(ws, 'instagram')).filter((c) => c.activa);
  } catch (e) {
    const m = motivoDe(e);
    return { error: m, texto: TEXTO_MOTIVO_ORGANICO[m] };
  }
  const quiero = (p.usuario ?? '').replace(/^@/, '').trim().toLowerCase();
  const cuenta = (quiero ? cuentas.find((c) => c.usuario.toLowerCase() === quiero) : null) ?? cuentas[0];
  if (!cuenta) return { error: 'sin-cuenta', texto: TEXTO_MOTIVO_ORGANICO['sin-cuenta'] };

  const c = await cfg(ws);
  const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const rango = { fromDate: p.desde, toDate: p.hasta };
  const limite = String(Math.min(50, Math.max(1, Math.round(p.limite ?? 10))));
  const [ins, seg, pubs] = await Promise.allSettled([
    zFetch<unknown>(c.apiKey, `/analytics/instagram/account-insights?${q({ accountId: cuenta.accountId, metrics: METRICAS_CUENTA.join(','), metricType: 'total_value', ...rango })}`),
    zFetch<unknown>(c.apiKey, `/analytics/instagram/follower-history?${q({ accountId: cuenta.accountId, metricType: 'time_series', ...rango })}`),
    zFetch<unknown>(c.apiKey, `/analytics?${q({ platform: 'instagram', accountId: cuenta.accountId, source: 'all', sortBy: 'date', order: 'desc', limit: limite, ...rango })}`),
  ]);

  const faltan: string[] = [];
  const motivos: MotivoOrganico[] = [];
  const leer = <T>(r: PromiseSettledResult<unknown>, que: string, parsear: (b: unknown) => T | null): T | null => {
    if (r.status === 'rejected') {
      const m = motivoDe(r.reason);
      motivos.push(m);
      faltan.push(`${que}: ${TEXTO_MOTIVO_ORGANICO[m]}`);
      return null;
    }
    const v = parsear(r.value);
    if (v == null) { motivos.push('respuesta'); faltan.push(`${que}: ${TEXTO_MOTIVO_ORGANICO.respuesta}`); }
    return v;
  };
  const cuentaMetricas = leer(ins, 'La cuenta', (b) => totalesDeInsights(b, METRICAS_CUENTA));
  const seguidores = leer(seg, 'Los seguidores', seguidoresDe);
  const publicaciones = leer(pubs, 'Las publicaciones', publicacionesDe);
  // Las tres fallaron por LO MISMO (el complemento de Analytics, la clave): eso es la respuesta, no tres líneas iguales.
  if (motivos.length === 3 && motivos.every((m) => m === motivos[0])) return { error: motivos[0], texto: TEXTO_MOTIVO_ORGANICO[motivos[0]] };
  return {
    cuenta: { accountId: cuenta.accountId, usuario: cuenta.usuario, nombre: cuenta.nombre },
    desde: p.desde, hasta: p.hasta, cuentaMetricas, seguidores, publicaciones: publicaciones?.slice(0, Number(limite)) ?? null, faltan,
  };
}
