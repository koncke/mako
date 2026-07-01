// =============================================================================
// instrumentation — arranque de cada instancia del server (Next 16)
// =============================================================================
// register() corre UNA vez por instancia (cada cold start en Vercel), antes de
// aceptar requests. Acá hidratamos las credenciales guardadas desde /metodo a
// process.env, para que las ~70 libs que leen env sigan funcionando sin saber
// que el valor vino de la base. La env de Vercel siempre gana (ver
// lib/credenciales.ts). Si Supabase no está configurada (local), no hace nada.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Default de META_API_VERSION: varias libs de Meta la leen con getEnv() que
  // TIRA si falta (lib/meta-ads.ts, lib/meta-health.ts). No es un secreto que
  // se cargue desde /metodo, así que la fijamos acá. La env de Vercel gana.
  if (!process.env.META_API_VERSION) process.env.META_API_VERSION = 'v24.0';

  const { hidratarCredenciales } = await import('./lib/credenciales');
  await hidratarCredenciales();
}
