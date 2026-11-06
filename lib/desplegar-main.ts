// =============================================================================
// desplegar-main — compila producción si main tiene algo nuevo que salga en la app (6/11/2026)
// =============================================================================
// Lo corre el cron /api/cron/desplegar-main una vez por día. El porqué, en lib/desplegar-main-reglas.ts.
// =============================================================================

import 'server-only';
import { compararConMain } from './github-commits';
import { decidirDespliegue, type Decision } from './desplegar-main-reglas';

/** El repo en GitHub, como lo tiene conectado el proyecto de Vercel (`link.repoId`). */
const REPO_ID = 1248884951;
/** Una compilación tarda unos 4 minutos: una «en curso» más vieja que esto es un estado colgado, y no frena la próxima. */
const COLGADA_MS = 30 * 60 * 1000;

function vercel(): { token: string; proyecto: string; equipo: string | null } | null {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  if (!token) return null;
  return { token, proyecto: process.env.VERCEL_PROJECT_ID?.trim() || 'mako', equipo: process.env.VERCEL_TEAM_SLUG?.trim() || null };
}

type Produccion = { enCurso: boolean; sha: string | null };

async function leerProduccion(v: NonNullable<ReturnType<typeof vercel>>, ahora: number): Promise<Produccion> {
  const q = new URLSearchParams({ projectId: v.proyecto, target: 'production', limit: '15' });
  if (v.equipo) q.set('slug', v.equipo);
  const r = await fetch(`https://api.vercel.com/v6/deployments?${q}`, {
    headers: { authorization: `Bearer ${v.token}` }, cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`Vercel contestó ${r.status} al listar los deployments.`);
  const j = (await r.json()) as { deployments?: Array<{ state?: string; readyState?: string; created?: number; meta?: { githubCommitSha?: string } }> };
  const lista = j.deployments ?? [];
  const estado = (d: (typeof lista)[number]) => d.state ?? d.readyState ?? '';
  return {
    enCurso: lista.some((d) => ['BUILDING', 'QUEUED', 'INITIALIZING'].includes(estado(d)) && ahora - (d.created ?? 0) < COLGADA_MS),
    sha: lista.find((d) => estado(d) === 'READY')?.meta?.githubCommitSha ?? null,
  };
}

export type ResultadoDespliegue = {
  ok: boolean;
  decision?: Decision;
  enProduccion?: string | null;
  main?: string | null;
  deployment?: string;
  error?: string;
  dry?: boolean;
};

export async function desplegarMainSiHaceFalta(o: { dry?: boolean } = {}, ahora = Date.now()): Promise<ResultadoDespliegue> {
  const v = vercel();
  if (!v) return { ok: false, error: 'Falta el token de Vercel en el servidor.' };
  const produccion = await leerProduccion(v, ahora);
  // Sin lo de GitHub se compila igual, con «main» a secas: que una credencial vencida no deje producción sin actualizar.
  const cmp = produccion.sha ? await compararConMain(produccion.sha) : null;
  const leido = cmp?.ok ? cmp : null;
  const decision = decidirDespliegue({
    enCurso: produccion.enCurso, enProduccion: produccion.sha, main: leido?.main ?? '',
    adelante: leido?.adelante ?? 0, archivos: leido?.archivos ?? null,
  });
  const base = { decision, enProduccion: produccion.sha, main: leido?.main ?? null };
  if (decision.hacer === 'nada' || o.dry) return { ok: true, dry: !!o.dry, ...base };

  const q = new URLSearchParams({ forceNew: '1' });
  if (v.equipo) q.set('slug', v.equipo);
  const r = await fetch(`https://api.vercel.com/v13/deployments?${q}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${v.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'mako', project: v.proyecto, target: 'production',
      gitSource: { type: 'github', repoId: REPO_ID, ref: 'main', ...(leido?.main ? { sha: leido.main } : {}) },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!r.ok) return { ok: false, ...base, error: `Vercel contestó ${r.status}: ${String(j.error?.message ?? '').slice(0, 200)}` };
  return { ok: true, ...base, deployment: j.id };
}
