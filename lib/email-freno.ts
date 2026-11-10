// =============================================================================
// email-freno — cuándo se apaga solo el envío de email de un negocio (puro)
// =============================================================================
// La campaña de email de Mauricio (4/11/2026, punto 7): 1.128 personas y un dominio recién conectado. Si muchas direcciones
// rebotan o la gente lo marca como spam, Gmail y Outlook castigan al DOMINIO del negocio (y Resend, la cuenta). Lo que se
// pidió: «en 24 h con 50 enviados o más, rebotes de 5 % o más o quejas de 0,3 % o más apagan el envío y avisan al negocio».
//
// ⚠️ LOS ÚLTIMOS 100 ENVÍOS, NO «LAS ÚLTIMAS 24 H» (ticket #76, 10/11/2026). Con la ventana de 24 h, el freno apagó el
// envío de Mauricio a las 9:01 con «3 de 52 (5,8 %)»: el envío de ayer (Piloto A, 100 a las 9:00) se había ido yendo de la
// ventana y quedaba su COLA, con 2 de sus 3 rebotes, más los primeros 7 del de hoy (Piloto B). Los envíos enteros estaban
// en 3 de 100 (3 %) y 2 de 78 (2,6 %). Una ventana de tiempo parte un envío por la mitad y deja un denominador chico en el
// borde; una de CANTIDAD siempre mira la misma muestra. Los umbrales son los mismos (50, 5 %, 0,3 %).
// Y la cuenta arranca cuando una persona PRENDE el envío: «Revisa la lista y vuelve a prenderlo» no sirve si los rebotes
// que ya lo apagaron siguen adentro y el próximo lo vuelve a apagar (`desdeDelFreno`, que usa lib/email-reputacion.ts).
//
// Rebote = el permanente (la dirección no existe); el temporal (buzón lleno) no cuenta, como no da de baja al lead
// (app/api/webhooks/resend). Apagar es el mismo interruptor de siempre (`envio_email_enabled`): lo vuelve a prender una
// persona, nunca solo.
// =============================================================================

export const FRENO_EMAIL = { minimoEnviados: 50, rebotes: 0.05, quejas: 0.003, ultimos: 100, dias: 7 } as const;

export type ConteoEmail = { enviados: number; rebotes: number; quejas: number };

/** Un email enviado, como lo lee el freno: cuándo salió y si rebotó o se marcó como spam. */
export type EnvioParaFreno = { created_at: string; rebotado_at?: string | null; queja_at?: string | null };

/**
 * Los últimos `FRENO_EMAIL.ultimos` emails enviados (de todas las tablas juntas, el más nuevo primero), contados. Las filas
 * llegan ya filtradas por fecha (`desdeDelFreno`); acá sólo se ordena y se corta, para que dos tablas con 100 cada una no
 * sumen 200.
 */
export function conteoDeLosUltimos(filas: readonly EnvioParaFreno[], n: number = FRENO_EMAIL.ultimos): ConteoEmail {
  const ultimos = [...filas].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, n);
  return {
    enviados: ultimos.length,
    rebotes: ultimos.filter((f) => f.rebotado_at != null).length,
    quejas: ultimos.filter((f) => f.queja_at != null).length,
  };
}

/**
 * Desde cuándo mira el freno: hace `FRENO_EMAIL.dias`, o desde que una persona prendió el envío si fue después. `prendidoAt`
 * es el `updated_at` de la setting cuando vale 'true' (null si no hay o no se pudo leer: entonces, los días).
 */
export function desdeDelFreno(ahoraMs: number, prendidoAt: string | null): string {
  const dias = ahoraMs - FRENO_EMAIL.dias * 86_400_000;
  const prendido = prendidoAt ? Date.parse(prendidoAt) : NaN;
  return new Date(Number.isFinite(prendido) && prendido > dias && prendido <= ahoraMs ? prendido : dias).toISOString();
}

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
    ? `de los últimos ${c.enviados} emails, ${c.quejas} se marcaron como spam (${pct} %)`
    : `de los últimos ${c.enviados} emails, ${c.rebotes} rebotaron: esas direcciones no existen (${pct} %)`;
  return `Apagué el envío de email: ${que}. Si sigue, Gmail y Outlook mandan tus emails a spam. Revisa la lista y vuelve a prenderlo desde Email.`;
}
