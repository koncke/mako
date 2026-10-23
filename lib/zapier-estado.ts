// =============================================================================
// zapier-estado — qué dice la tarjeta del puente de leads, y cuándo se queda callada de más (puro)
// =============================================================================
// El puente (lib/zapier-lead.ts) vive en una cuenta de un TERCERO (Make o Zapier): si el negocio deja de pagarla, apaga el escenario o el Zap
// o se le corta el disparador, los leads dejan de llegar y NADA lo dice —el webhook no recibe nada que contestar—.
// La investigación del 23/10/2026 lo nombra como el riesgo del puente («si el cliente deja de pagar, los leads dejan
// de llegar y nadie se entera»; en Make hay disparadores que se cortan solos). La señal honesta de «anda» es la
// misma que la del Pixel (lib/integraciones.ts → `estadoLanding`): que lleguen leads de verdad, no que haya una clave.
//
// Lo que se guarda, por workspace, en `app_settings` (`zapier.estado`): cuándo llegó el último aviso del Zap, cuándo
// llegó el último LEAD, y por qué el último aviso no fue un lead (sin contacto). Una sola fila: una lectura para
// dibujar la tarjeta y una escritura por aviso.
//
// ⚠️ EL UMBRAL ES UN PROXY: 72 horas sin un lead. Un negocio con tres leads por semana lo cruza sin que pase nada, y
// uno con cien por día tardaría demasiado en enterarse. Por eso la tarjeta sólo se pone ámbar —nunca roja— y dice
// «Revisa tu Zap» en vez de afirmar que está roto: Meta no nos dice cuántos leads se generaron (para eso hace falta
// el permiso que este puente reemplaza). Se mide contra el ritmo propio de cada negocio el día que haya datos.
//
// SIN `server-only`: lo prueban los tests (tests/zapier-leads.test.ts).

export const KEY_ESTADO_ZAPIER = 'zapier.estado';
/** Horas sin un lead a partir de las cuales la tarjeta pide revisar el Zap. */
export const HORAS_SIN_LEADS = 72;

export type EstadoZapier = {
  /** ISO del último aviso AUTENTICADO del Zap (haya sido un lead o no). */
  entrega: string | null;
  /** ISO del último lead que entró (creado o completado). */
  lead: string | null;
  /** Por qué el último aviso no fue un lead; null si lo fue. */
  motivo: string | null;
};

export const ESTADO_VACIO: EstadoZapier = { entrega: null, lead: null, motivo: null };

const iso = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);

/** Lo guardado, saneado: basura o nada → vacío. Nunca tira. */
export function parsearEstadoZapier(crudo: string | null | undefined): EstadoZapier {
  if (!crudo) return ESTADO_VACIO;
  try {
    const o: unknown = JSON.parse(crudo);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return ESTADO_VACIO;
    const r = o as Record<string, unknown>;
    return { entrega: iso(r.entrega), lead: iso(r.lead), motivo: typeof r.motivo === 'string' && r.motivo.trim() ? r.motivo.trim().slice(0, 200) : null };
  } catch {
    return ESTADO_VACIO;
  }
}

/**
 * El estado después de un aviso. Un lead pone su fecha y borra el motivo; un aviso que no fue un lead deja la fecha
 * del último lead como estaba (es lo que dice si el puente SIGUE trayendo gente) y anota por qué.
 */
export function estadoDespuesDe(previo: EstadoZapier, r: { lead: boolean; motivo?: string | null }, ahora: Date): EstadoZapier {
  const t = ahora.toISOString();
  return r.lead
    ? { entrega: t, lead: t, motivo: null }
    : { entrega: t, lead: previo.lead, motivo: r.motivo?.trim().slice(0, 200) || null };
}

/** «5 h» o «3 días»: lo justo para una línea de la tarjeta. */
export function haceCuanto(desde: string, ahoraMs: number): string {
  const horas = Math.max(0, Math.floor((ahoraMs - Date.parse(desde)) / 3_600_000));
  if (horas < 1) return 'menos de 1 h';
  if (horas < 48) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  return `${dias} días`;
}

/**
 * Lo que dice la tarjeta cuando la clave ya está guardada. `falta` (ámbar) sólo si ya entró algún lead y hace más de
 * `HORAS_SIN_LEADS` que no entra otro: un puente que nunca recibió nada está «esperando», no «caído» (todavía no
 * pegaron el Zap, o no lo probaron), y avisarle de un apagón a quien nunca lo prendió es ruido.
 */
export function tarjetaDelPuente(e: EstadoZapier, ahoraMs: number): { estado: 'conectada' | 'falta'; detalle: string } {
  if (e.lead) {
    const horas = (ahoraMs - Date.parse(e.lead)) / 3_600_000;
    if (horas > HORAS_SIN_LEADS) return { estado: 'falta', detalle: `Sin leads hace ${haceCuanto(e.lead, ahoraMs)}. Revisa tu escenario de Make o tu Zap.` };
    return { estado: 'conectada', detalle: `Último lead hace ${haceCuanto(e.lead, ahoraMs)}.` };
  }
  if (e.entrega) return { estado: 'conectada', detalle: 'Llegó un aviso sin email ni teléfono. Revisa lo que manda tu escenario o tu Zap.' };
  return { estado: 'conectada', detalle: 'Esperando tu primer lead. Prueba tu escenario de Make o tu Zap.' };
}
