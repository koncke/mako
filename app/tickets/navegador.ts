// =============================================================================
// «Reportar problema»: lo que el NAVEGADOR sabe al levantar un ticket, y el «hace un rato» de cada fila
// =============================================================================
// Módulo puro (sin 'use client'): lo usan la pantalla de la computadora (TicketsCliente.tsx) y la del teléfono
// (app/m/tickets). Una sola copia: el contexto que junta cada una es el que lee el triage (`sanearContexto`, en el
// servidor), y dos copias divergen a la tercera edición. Sólo se LLAMA en el navegador (lee window y document).
// =============================================================================

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('es', { numeric: 'auto' }) : null;

/** «recién», «hace 5 minutos», «ayer»: cuándo cambió un ticket, en palabras. */
export function hace(iso: string): string {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  if (!rtf || !Number.isFinite(s)) return '';
  const a = Math.abs(s);
  if (a < 60) return 'recién';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86_400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86_400), 'day');
}

/**
 * De dónde venía la persona, el navegador, la pantalla, la zona y la hora. Se limpia en el servidor (`sanearContexto`).
 * `donde` dice desde qué entrada se levantó (la de la computadora o la del teléfono).
 */
export function contextoDelNavegador(donde: 'reportar-problema' | 'reportar-problema-movil' = 'reportar-problema'): Record<string, unknown> {
  try {
    let ruta: string | undefined;
    if (document.referrer) {
      const u = new URL(document.referrer);
      if (u.origin === window.location.origin && !u.pathname.startsWith('/tickets')) ruta = `${u.pathname}${u.search}`;
    }
    return {
      ...(ruta ? { ruta } : {}), chat: { donde },
      navegador: navigator.userAgent, pantalla: `${window.innerWidth}x${window.innerHeight}`,
      zona: Intl.DateTimeFormat().resolvedOptions().timeZone, idioma: navigator.language, hora: new Date().toISOString(),
    };
  } catch {
    return {};
  }
}
