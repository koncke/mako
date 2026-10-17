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

// =============================================================================
// onRequestError — los errores del SERVIDOR van solos a la Ticketera (17/10/2026)
// =============================================================================
// Martín: «córrelo en toda la app: MaKo en los chats de la app, errores al navegar o lo que sea. Y todo lo solucionas
// automáticamente». Una pantalla que falla en el servidor le llega al navegador sin su mensaje (sólo el digest), así que
// el que lo reporta es el servidor: lib/errores-app.ts lo agrupa por huella y la primera vez abre un ticket de bug que va
// solo al Cerebro. Quién lo vio sale de la cookie de sesión (verificada), para avisarle cuando esté arreglado.
// ⚠️ NUNCA TIRA y se espera (lo pide la doc de Next): `registrarError` no lanza, y un fallo acá se loguea.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routePath?: string; routeType?: string },
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const e = (err && typeof err === 'object' ? err : {}) as { name?: string; message?: string; stack?: string; digest?: string };
    const cabecera = (k: string) => { const v = request.headers[k]; return Array.isArray(v) ? v.join('; ') : v ?? ''; };
    const galletas = Object.fromEntries(cabecera('cookie').split(';').map((p) => p.trim().split('=')).filter((p) => p.length >= 2).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
    const { SESSION_COOKIE, IMPERSONATE_COOKIE, verificarToken, leerImpersonacion } = await import('./lib/auth-session');
    const sesion = verificarToken(galletas[SESSION_COOKIE]);
    const ws = (sesion?.rol === 'admin' ? leerImpersonacion(galletas[IMPERSONATE_COOKIE]) : null) ?? sesion?.ws ?? null;
    const { identidadDe } = await import('./lib/tickets-db');
    const { registrarError } = await import('./lib/errores-app');
    const quien = sesion?.email && ws ? await identidadDe(ws, sesion.email, sesion.nombre) : null;
    await registrarError({
      origen: 'servidor', nombre: e.name || context.routeType || 'Error', mensaje: e.message || '(sin mensaje)',
      stack: e.stack, digest: e.digest, ruta: request.path, navegador: cabecera('user-agent'),
    }, quien);
  } catch (x) {
    console.error('[onRequestError] no pude registrar el error:', x instanceof Error ? x.message : String(x));
  }
}
