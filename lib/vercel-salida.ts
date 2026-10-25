// =============================================================================
// Leer lo que imprime el CLI de Vercel (24/10/2026) — puro, para la prueba de producción
// =============================================================================
// La usa scripts/avisar-arreglo-al-grupo.mts (`pruebaDeProduccion`): un aviso «ya quedó arreglado» al grupo de un cliente sale
// sólo si hola-mako.com SIRVE un despliegue de un commit de main que contiene el arreglo. Lo fija tests/vercel-salida.test.ts,
// con salidas reales del CLI 65.2.0.
//
// ⚠️ EL COMMIT VA ENTERO (40 caracteres). `vercel ls --meta githubCommitSha=<sha>` compara el texto tal cual: con el sha corto
//    contesta «No deployments found» para un despliegue vivo, y con el entero lo encuentra. Medido el 24/10/2026 con 59d228ea1
//    (el de producción): corto → nada; entero → «● Ready Production». Esa noche se creyó que Vercel no guardaba el commit
//    (docs/hallazgos-infra.md); lo guarda.
// ⚠️ LA TABLA SALE POR STDERR (18/10/2026): quien lea sólo stdout no ve «Ready». Se le pasan las dos juntas.

/** Un sha de git entero: lo único que el filtro `--meta githubCommitSha=` reconoce. */
export function esShaEntero(sha: string): boolean {
  return /^[0-9a-f]{40}$/.test(sha);
}

/** De `vercel inspect <dominio>`: la URL del despliegue que sirve ese dominio, o null. */
export function urlQueSirve(salida: string): string | null {
  return /^\s*url\s+(https:\/\/\S+\.vercel\.app)\s*$/m.exec(salida)?.[1] ?? null;
}

/** De `vercel ls --environment production --meta …`: la fila de producción (su URL y si está Ready), o null si no hay. */
export function filaDeProduccion(salida: string): { url: string; lista: boolean } | null {
  const fila = salida.split('\n').find((l) => /https:\/\/\S+\.vercel\.app/.test(l) && /Production/.test(l));
  if (!fila) return null;
  return { url: /https:\/\/\S+\.vercel\.app/.exec(fila)![0], lista: /●\s*Ready/.test(fila) };
}
