// =============================================================================
// instrumentation — arranque de cada instancia del server (Next 16)
// =============================================================================
// register() corre UNA vez por instancia (cada cold start). hidratarCredenciales()
// hace los DOS sentidos (ver lib/credenciales.ts):
//   1. base → process.env: para que las ~70 libs que leen env sigan funcionando
//      sin saber que el valor vino de la base. La base manda.
//   2. process.env → base (migrarEnvACredenciales): copia las credenciales del
//      dueño que todavía vivan solo en el entorno del server, así puede
//      gestionarlas desde la app y después borrarlas del entorno.
// Si Supabase no está configurada (local), no hace nada.
//
// ⚠️ NO asumas que esto terminó antes del primer request. La doc de Next 16 dice
// que register() "must complete before the server is ready to handle requests",
// pero el código NO lo cumple en el despliegue por función de Vercel: prepare()
// llama a ensureInstrumentationRegistered(...) SIN await
// (node_modules/next/dist/server/route-modules/route-module.js:356, y así queda en
// el runtime compilado). En `next start` no se nota porque base-server ya lo esperó.
//
// Por eso quien necesita una credencial NO la lee de process.env a secas: usa
// `envCred()` (o al menos espera `credencialesListas()`), que es la MISMA promesa
// que se arranca acá. Medición del 2026-08-05: sin eso, 3 de cada 10 requests al
// webhook de Calendly entraban sin la clave y devolvían 401.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Default de META_API_VERSION: varias libs de Meta la leen con getEnv() que
  // TIRA si falta (lib/meta-ads.ts, lib/meta-health.ts). No es un secreto que
  // se cargue desde la app, así que la fijamos acá si no vino del entorno.
  if (!process.env.META_API_VERSION) process.env.META_API_VERSION = 'v24.0';

  const t0 = Date.now();
  console.log('[credenciales] boot: hidratando…');
  const { credencialesListas } = await import('./lib/credenciales');
  // Memoiza la promesa: los lectores esperan ESTA, no arrancan otra hidratación.
  await credencialesListas();
  console.log(`[credenciales] boot: listo en ${Date.now() - t0}ms`);
}
