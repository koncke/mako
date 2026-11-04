// =============================================================================
// email-freno — cuándo se apaga solo el envío de email de un negocio (puro)
// =============================================================================
// La campaña de email de Mauricio (4/11/2026, punto 7): 1.128 personas y un dominio recién conectado. Si muchas direcciones
// rebotan o la gente lo marca como spam, Gmail y Outlook castigan al DOMINIO del negocio (y Resend, la cuenta). Lo que se
// pidió: «en 24 h con 50 enviados o más, rebotes de 5 % o más o quejas de 0,3 % o más apagan el envío y avisan al negocio».
//
// La cuenta es sobre lo ENVIADO en las últimas 24 h y lo que de eso rebotó o se marcó como spam (lib/email-reputacion.ts).
// Con menos de 50 enviados no frena: con 20, un solo rebote ya es el 5 % y no dice nada del dominio. Rebote = el permanente
// (la dirección no existe); el temporal (buzón lleno) no cuenta, como no da de baja al lead (app/api/webhooks/resend).
// Apagar es el mismo interruptor de siempre (`envio_email_enabled`): lo vuelve a prender una persona, nunca solo.
// =============================================================================

export const FRENO_EMAIL = { minimoEnviados: 50, rebotes: 0.05, quejas: 0.003 } as const;

export type ConteoEmail = { enviados: number; rebotes: number; quejas: number };

export type FrenoEmail =
  | { frena: false }
  | { frena: true; motivo: 'rebotes' | 'quejas'; porcentaje: number };

/** ¿Se apaga el envío? Primero las quejas (castigan más), después los rebotes. */
export function decidirFrenoEmail(c: ConteoEmail): FrenoEmail {
  if (c.enviados < FRENO_EMAIL.minimoEnviados) return { frena: false };
  const quejas = c.quejas / c.enviados;
  if (quejas >= FRENO_EMAIL.quejas) return { frena: true, motivo: 'quejas', porcentaje: quejas * 100 };
  const rebotes = c.rebotes / c.enviados;
  if (rebotes >= FRENO_EMAIL.rebotes) return { frena: true, motivo: 'rebotes', porcentaje: rebotes * 100 };
  return { frena: false };
}

/** Lo que se le dice al negocio cuando frena. Corto: qué pasó, por qué importa y qué hacer. */
export function textoDelFreno(f: Extract<FrenoEmail, { frena: true }>, c: ConteoEmail): string {
  const pct = f.porcentaje.toLocaleString('es-MX', { maximumFractionDigits: 1 });
  const que = f.motivo === 'quejas'
    ? `${c.quejas} de ${c.enviados} emails de las últimas 24 h se marcaron como spam (${pct} %)`
    : `${c.rebotes} de ${c.enviados} emails de las últimas 24 h rebotaron: esas direcciones no existen (${pct} %)`;
  return `Apagué el envío de email: ${que}. Si sigue, Gmail y Outlook mandan tus emails a spam. Revisa la lista y vuelve a prenderlo desde Email.`;
}
