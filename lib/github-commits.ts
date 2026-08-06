import 'server-only';

// =============================================================================
// github-commits — leer qué se pusheó, sin depender de la PC de nadie
// =============================================================================
// La pregunta original del dueño, cuando pidió el auto-completado de las tareas de
// desarrollo: «¿Debo tener mi PC encendida todo el tiempo con Claude abierto?».
//
// No. Esto corre en un cron de Vercel y le pregunta a GitHub qué commits entraron desde
// la última vez. Nada corre local, nada depende de que alguien tenga algo abierto.
//
// POR QUÉ LA API DE GITHUB Y NO `git log`: en Vercel no hay repo — la función corre sobre
// el build, no sobre un clon. Y un hook de git local volvería a atar todo a la máquina de
// Martín, que es exactamente lo que se quiso evitar.
//
// LO ÚNICO MANUAL: un token de GitHub (fine-grained, permiso `Contents: read-only` sobre
// este repo). Sin token esto NO adivina ni falla ruidosamente: devuelve vacío y dice por
// qué en el log, para que el cron siga corriendo el resto.
// =============================================================================

import { credWs } from './credenciales';
import { wsSuperAdmin } from './workspace';

const API = 'https://api.github.com';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** El repo del producto. No es por-workspace: hay UN repo y es el de la agencia. */
export const REPO = process.env.GITHUB_REPO || 'mbustos-digital/dashboard-marketing';

export type Commit = {
  sha: string;
  fecha: string;
  autor: string;
  mensaje: string;
  /** Los archivos que tocó. Es la mitad más útil: un commit que dice «arreglos varios»
   *  igual delata en qué parte del producto estuvo. */
  archivos: string[];
};

/** El token vive en el workspace del SUPER-ADMIN. Ojo: NO es `OWNER_WS` — esa
 *  constante vale 1 y ese workspace es de un cliente. La primera versión de esto leía
 *  de ahí y el bot decía «no hay token» con el token cargado y visible en pantalla. */
async function token(): Promise<string | null> {
  const t = await credWs('GITHUB_TOKEN', await wsSuperAdmin()).catch(() => null);
  return t || process.env.GITHUB_TOKEN || null;
}

async function gh(ruta: string, tk: string): Promise<unknown> {
  const r = await fetch(`${API}${ruta}`, {
    headers: { Authorization: `Bearer ${tk}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} en ${ruta}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/**
 * Los commits de `main` desde una fecha. `desdeISO` vacío = las últimas 24 horas, que es
 * la cadencia del cron: pedir todo el historial la primera vez traería mil commits y
 * ninguno sirve para saber qué se terminó ESTA semana.
 *
 * Devuelve [] y lo explica en el log si no hay token — nunca lanza por eso. Un cron que
 * se cae por una credencial que falta deja de correr lo demás.
 */
export async function commitsDesde(desdeISO: string, tope = 60): Promise<{ commits: Commit[]; motivo: string }> {
  const tk = await token();
  if (!tk) return { commits: [], motivo: 'No hay GITHUB_TOKEN cargado (Integraciones → GitHub). Sin eso no puedo leer los commits.' };

  const desde = desdeISO || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  try {
    const lista = await gh(`/repos/${REPO}/commits?sha=main&since=${encodeURIComponent(desde)}&per_page=${Math.min(tope, 100)}`, tk) as Array<Record<string, unknown>>;
    if (!Array.isArray(lista) || !lista.length) return { commits: [], motivo: 'sin commits nuevos' };

    // Los archivos NO vienen en el listado: hay que pedir cada commit. Por eso el tope —
    // son N llamadas, y con 60 commits ya se tiene el panorama de una semana larga.
    const commits: Commit[] = [];
    for (const c of lista.slice(0, tope)) {
      const sha = String((c as { sha?: unknown }).sha ?? '');
      const cm = (c as { commit?: Record<string, unknown> }).commit ?? {};
      const autor = String(((cm.author as Record<string, unknown>)?.name) ?? '');
      const fecha = String(((cm.author as Record<string, unknown>)?.date) ?? '');
      const mensaje = String(cm.message ?? '');
      let archivos: string[] = [];
      try {
        const det = await gh(`/repos/${REPO}/commits/${sha}`, tk) as { files?: Array<{ filename?: string }> };
        archivos = (det.files ?? []).map((f) => String(f.filename ?? '')).filter(Boolean).slice(0, 40);
      } catch (e) { console.warn(`[github] no pude leer los archivos de ${sha.slice(0, 8)}: ${msg(e)}`); }
      commits.push({ sha, fecha, autor, mensaje, archivos });
    }
    return { commits, motivo: `${commits.length} commits desde ${desde.slice(0, 10)}` };
  } catch (e) {
    console.error(`[github] ${msg(e)}`);
    return { commits: [], motivo: msg(e) };
  }
}

/** El commit como se lo damos a un modelo: mensaje entero (ahí está el porqué) + los
 *  archivos. El mensaje se recorta a 1200 porque los de este repo son largos a propósito
 *  y con seis commits ya se llenaría el prompt. */
export const commitParaPrompt = (c: Commit, tope = 1200): string => [
  `--- ${c.sha.slice(0, 8)} · ${c.fecha.slice(0, 10)} · ${c.autor}`,
  c.mensaje.trim().slice(0, tope),
  c.archivos.length ? `Archivos: ${c.archivos.join(', ')}` : '',
].filter(Boolean).join('\n');
