'use client';

// =============================================================================
// Calendly embebido — agendar R1/R2 desde el CRM
// =============================================================================
// Abre el popup de Calendly (carga el widget on-demand), precargando nombre/email
// del lead, y avisa cuando la reunión queda agendada. La fecha la setea el
// webhook de Calendly (que matchea por email/teléfono), y el lead avanza solo.

const CAL_URLS: Record<string, string> = {
  agenda: 'https://calendly.com/mauriciobustoseguia/60min',
  agendaj2: 'https://calendly.com/mauriciobustoseguia/calificacion-para-programa-directivo-reunion-2',
};

type CalendlyWin = Window & {
  Calendly?: {
    initPopupWidget: (o: { url: string; prefill?: { name?: string; email?: string } }) => void;
    closePopupWidget?: () => void;
  };
};

/** ¿Esta etapa se agenda por Calendly? (R1 / R2) */
export function calendlyUrlFor(stageKey: string): string | null {
  return CAL_URLS[stageKey] ?? null;
}

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
 * Abre Calendly para R1/R2. Devuelve true si abrió. Llama onScheduled cuando el
 * usuario completa la reserva (evento calendly.event_scheduled).
 */
export async function openCalendlyFor(
  stageKey: string,
  opts: { name?: string; email?: string; onScheduled?: () => void },
): Promise<boolean> {
  const url = CAL_URLS[stageKey];
  if (!url) return false;
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
