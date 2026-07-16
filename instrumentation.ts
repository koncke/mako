// =============================================================================
// instrumentation — arranque de cada instancia del server (Next 16)
// =============================================================================
// register() corre UNA vez por instancia (cada cold start), antes de aceptar
// requests. hidratarCredenciales() hace los DOS sentidos (ver lib/credenciales.ts):
//   1. base → process.env: para que las ~70 libs que leen env sigan funcionando
//      sin saber que el valor vino de la base. La base manda.
//   2. process.env → base (migrarEnvACredenciales): copia las credenciales del
//      dueño que todavía vivan solo en el entorno del server, así puede
//      gestionarlas desde la app y después borrarlas del entorno.
// Si Supabase no está configurada (local), no hace nada.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Default de META_API_VERSION: varias libs de Meta la leen con getEnv() que
  // TIRA si falta (lib/meta-ads.ts, lib/meta-health.ts). No es un secreto que
  // se cargue desde la app, así que la fijamos acá si no vino del entorno.
  if (!process.env.META_API_VERSION) process.env.META_API_VERSION = 'v24.0';

  const { hidratarCredenciales } = await import('./lib/credenciales');
  await hidratarCredenciales();
}
