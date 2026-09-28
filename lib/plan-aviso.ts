// =============================================================================
// plan-aviso — qué se le dice EN LA PANTALLA a quien le cambió el plan a un cliente
// =============================================================================
// Hermano de `lib/invitacion-aviso.ts` y por el mismo motivo: el cambio de plan MANDA
// UN MAIL, y el resultado de ese envío no es el resultado de la operación. El plan ya
// está cambiado —eso no se deshace porque se haya caído un servicio de correo— así que
// la pantalla tiene que distinguir tres cosas que un «listo» mudo confunde:
//
//   · se le avisó       → terminó, y se dice a qué dirección.
//   · no salió el mail  → el plan CAMBIÓ igual, falta avisar a mano, y se dice a quién.
//   · no hay a quién    → esa cuenta todavía no tiene a nadie adentro. NO es una falla.
//
// Sin `server-only` a propósito: lo importa la pantalla (es un componente de navegador)
// y lo importa el test. Es la misma razón por la que `invitacion-aviso` vive separado de
// `invitaciones`.

export type ResultadoAvisoPlan = {
  enviado: boolean;
  /** Legible para una persona: se pinta cuando el mail no salió. */
  error?: string;
  /** A quién se le escribió (o se le habría escrito). Vacío = no había nadie. */
  a?: string;
};

export type AvisoPlan = {
  /** `ok` = no queda nada por hacer · `warn` = falta un paso HUMANO. */
  tono: 'ok' | 'warn';
  texto: string;
};

export function avisoCambioPlan(r: ResultadoAvisoPlan | null | undefined, plan: string): AvisoPlan {
  const a = (r?.a ?? '').trim();

  // ⚠️ SIN NADIE ADENTRO NO ES UN ERROR, y ponerlo en rojo enseñaría a ignorar los rojos.
  // Es exactamente el estado que dejó el bug del 28/09 (una cuenta aprobada con cero
  // usuarios), así que la frase lo nombra en vez de decir «falló el envío».
  if (!a) return { tono: 'ok', texto: `Listo, ahora tiene ${plan}. Todavía no hay nadie adentro de esa cuenta a quien avisarle.` };

  if (r?.enviado) return { tono: 'ok', texto: `Listo, ahora tiene ${plan}. Se le avisó a ${a}.` };

  const porque = r?.error ? ` (${r.error})` : '';
  return { tono: 'warn', texto: `El plan quedó en ${plan}, pero el aviso NO salió${porque}. Avísale tú a ${a}.` };
}
