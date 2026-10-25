// =============================================================================
// curso-portal-aviso — la ÚNICA frase que ve un alumno cuando su acceso no abre
// =============================================================================
// f33 de la llamada con Leandro (24/10/2026): un alumno sacado entraba al curso y la comunidad le decía otra cosa
// («Tu acceso a la comunidad no está activo», con un «Reportar a Soporte» que contestaba «no autenticado»). Un solo
// mensaje de entrada: la del link, la de /mi-curso y la de la comunidad del portal dicen ESTO, sin el porqué
// (contestar distinto ayudaría a enumerar: cortado, sacado, producto ajeno).
//
// ⚠️ SIN `server-only` NI `'use client'`: lo leen las páginas del portal (server) y la API de la comunidad del alumno
// (app/_comunidad/api.ts, en el navegador).

export const SIN_ACCESO_PORTAL = 'Tu acceso ya no está activo.';
