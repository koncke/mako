// =============================================================================
// cache — caché de LECTURA cross-request para acelerar la navegación entre tabs
// =============================================================================
// Las páginas son force-dynamic (dependen de searchParams / datos en vivo), así
// que NO se pueden cachear a nivel ruta. En su lugar cacheamos las queries de
// agregación pesadas con unstable_cache: el mismo (args) se sirve de la Data
// Cache entre navegaciones hasta que (a) una mutación llama revalidateTag(tag) o
// (b) vence `revalidate` (red de seguridad).
//
// Reglas de frescura:
//   - tag 'marketing' → datos alimentados por crons diarios (toleran minutos).
//   - tag 'leads' / 'pagos' / 'settings' / 'pipeline' → datos mutados por el
//     usuario; las server actions los invalidan al instante con revalidateTag.
//   - revalidate corto (60s) en datos de usuario = piso de frescura aunque
//     faltara un tag; 600s en datos de cron.
//
// Multi-inquilino: la caché se aísla POR WORKSPACE. El workspace se resuelve
// desde cookies FUERA de unstable_cache (adentro cookies() está prohibido) y se
// (a) mete en la clave de caché y (b) fija en el AsyncLocalStorage para que las
// lecturas scopeadas (getTenantDb) lo vean sin volver a leer cookies.
// =============================================================================

import 'server-only';
import { unstable_cache } from 'next/cache';
import { cache as reactCache } from 'react';
import { getWorkspaceActual, runWithWorkspace } from './workspace';

export const TAG = {
  marketing: 'marketing',
  leads: 'leads',
  pagos: 'pagos',
  settings: 'settings',
  pipeline: 'pipeline',
} as const;

// Revalidate por defecto (segundos).
export const TTL = { cron: 600, user: 60 } as const;

/**
 * Envuelve una función de lectura con caché cross-request (unstable_cache) +
 * dedup por-request (React cache). `keyPrefix` identifica la función; los
 * argumentos se hashean automáticamente, así cada (start,end)/(id) se cachea
 * por separado.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cachedRead<T extends (...args: any[]) => Promise<any>>(
  keyPrefix: string,
  fn: T,
  opts: { tags: string[]; revalidate: number },
): T {
  return (reactCache(async (...args: unknown[]) => {
    const ws = await getWorkspaceActual(); // cookies OK acá (fuera de unstable_cache)
    // El workspace entra en la clave (aísla la Data Cache por cliente) y se fija
    // en el ALS para que fn() lo vea adentro sin tocar cookies.
    const cached = unstable_cache(
      (...a: unknown[]) => runWithWorkspace(ws, () => fn(...a)),
      [keyPrefix, `ws:${ws}`],
      { tags: opts.tags, revalidate: opts.revalidate },
    );
    return cached(...args);
  }) as unknown) as T;
}
