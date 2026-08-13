'use client';

// =============================================================================
// Calendly embebido — agendar R1/R2 desde el CRM
// =============================================================================
// Abre el popup de Calendly (carga el widget on-demand), precargando nombre/email
// del lead, y avisa cuando la reunión queda agendada. La fecha la setea el
// webhook de Calendly (que matchea por email/teléfono), y el lead avanza solo.
//
// ⚠️ EL LINK NO VIVE ACÁ, Y NO PUEDE VOLVER A VIVIR ACÁ. Hasta el 13/08/2026 este
// módulo tenía un `CAL_URLS` con la página de Calendly DEL DUEÑO hardcodeada, y
// como es un módulo de cliente sin noción de workspace, se la servía a TODOS. En
// el CRM de una clienta el botón «Agendarla por Calendly» abría la agenda de otra
// persona —con su nombre, su foto y el nombre de su oferta— y el prospecto de ella
// reservaba una reunión en el calendario de él. Ella no se enteraba: la reserva
// entra por el event type de él, así que el webhook la rutea al workspace de él y
// en el de ella nunca aparece la fecha.
//
// Ahora la URL la resuelve el SERVER contra la cuenta de Calendly de ESE workspace
// (`linkDeAgendaAction` → `eventTypeDeReunion`), y qué etapas se agendan por
// Calendly lo decide el server también (`calendlyStages`, del page). Un módulo de
// cliente no puede decidir nada que dependa de quién está mirando.

type CalendlyWin = Window & {
  Calendly?: {
    initPopupWidget: (o: { url: string; prefill?: { name?: string; email?: string } }) => void;
    closePopupWidget?: () => void;
  };
};

function ensureLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as CalendlyWin;
    if (w.Calendly) return resolve();
    if (!document.getElementById('calendly-css')) {
      const link = document.createElement('link');
      link.id = 'calendly-css';
      link.rel = 'stylesheet';
      link.href = 'https://assets.calendly.com/assets/external/widget.css';
      document.head.appendChild(link);
    }
    const existing = document.getElementById('calendly-js') as HTMLScriptElement | null;
    if (existing) {
      if (w.Calendly) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Calendly')));
      return;
    }
    const s = document.createElement('script');
    s.id = 'calendly-js';
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar Calendly'));
    document.head.appendChild(s);
  });
}

/**
 * Abre Calendly para R1/R2 en la URL que resolvió el server para ESTE workspace.
 * Devuelve true si abrió. Llama onScheduled cuando el usuario completa la reserva.
 *
 * `url` es un parámetro obligatorio a propósito: sin default, ningún call-site
 * puede volver a abrir «la agenda de alguien» sin decir de quién.
 */
export async function openCalendlyEn(
  url: string,
  opts: { name?: string; email?: string; onScheduled?: () => void },
): Promise<boolean> {
  if (!url?.trim()) return false;
  await ensureLoaded();
  const w = window as CalendlyWin;
  if (!w.Calendly) return false;

  const onMsg = (e: MessageEvent) => {
    if (typeof e.origin === 'string' && e.origin.includes('calendly.com') && e.data?.event === 'calendly.event_scheduled') {
      window.removeEventListener('message', onMsg);
      try { w.Calendly?.closePopupWidget?.(); } catch { /* noop */ }
      opts.onScheduled?.();
    }
  };
  window.addEventListener('message', onMsg);
  w.Calendly.initPopupWidget({ url, prefill: { name: opts.name, email: opts.email } });
  return true;
}
