// =============================================================================
// tarea-dueno — ¿esta tarea es MÍA o de otra persona de la reunión? PURO, testeable
// =============================================================================
// Vive aparte de plan-fathom.ts (que es 'server-only' por el CRM y la IA) para poder
// probar la regla sin base ni red — mismo split que reunion-clasificar.
//
// Por qué merece módulo propio: la regla se rompió DOS veces, y las dos en silencio.
//   1) El nombre del hablante en la transcripción es el de SU cuenta de Fathom, que no
//      tiene por qué ser el de la app: "Martin Carballo" en el transcript vs "Martin
//      Koncke" en usuarios → 40 tareas propias aparecían en la tab de "otra persona".
//   2) En una CONSULTORÍA el que habla (el consultor) no es el que ejecuta, así que
//      atribuir por "quién lo dijo" manda todo el trabajo al dueño equivocado.
//
// El orden de confianza es: EMAIL (dato duro) → nombre completo → primer nombre, y este
// último solo si ningún otro participante lo comparte.
// =============================================================================

/** Quién mira el tablero. */
export type Yo = { nombre: string; email: string };
/** Alguien que estuvo en la reunión. */
export type ParticipanteRef = { nombre: string; email: string };

/** Lo que dijo el modelo sobre el dueño de una tarea. */
export type DueñoCrudo = { dueño?: unknown; dueñoEmail?: unknown; esMio?: unknown };

export type DueñoResuelto = { dueño: string; dueñoEmail: string; esDeOtro: boolean };

/** minúsculas, sin acentos, sin espacios de más. */
export function normNombre(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const primerNombre = (s: string): string => normNombre(s).split(' ')[0] ?? '';

/**
 * Resuelve el dueño de UNA tarea candidata.
 * - `dueñoEmail` solo se acepta si es un participante REAL de la reunión (si no, es un
 *   email inventado y le mandaríamos las tareas a cualquiera). Si falta, se rescata
 *   cruzando el nombre contra los invitados.
 * - `esDeOtro` respeta lo que dijo el modelo salvo que la evidencia diga lo contrario.
 */
export function resolverDueño(o: DueñoCrudo, yo: Yo, participantes: ParticipanteRef[] = []): DueñoResuelto {
  const yoEmail = (yo.email ?? '').trim().toLowerCase();
  const yoNombre = normNombre(yo.nombre ?? '');
  const porEmail = new Map(participantes.map((p) => [p.email.trim().toLowerCase(), p]));
  const porNombre = new Map(participantes.filter((p) => p.nombre).map((p) => [normNombre(p.nombre), p.email.trim().toLowerCase()]));

  const dueñoDicho = String(o.dueño ?? '').trim().slice(0, 80);
  const dn = normNombre(dueñoDicho);
  const propuesto = String(o.dueñoEmail ?? '').trim().toLowerCase();
  const emailReal = porEmail.has(propuesto) ? propuesto : (dn ? porNombre.get(dn) ?? '' : '');

  // ¿Otro participante comparte mi primer nombre? Entonces el primer nombre no alcanza
  // para decidir (dos Martines en la reunión) y solo vale el email.
  const otroConMiPrimerNombre = participantes.some((p) =>
    p.email.trim().toLowerCase() !== yoEmail && !!p.nombre && primerNombre(p.nombre) === yoNombre.split(' ')[0]);

  const pareceMio = (!!yoEmail && (emailReal === yoEmail || dueñoDicho.toLowerCase() === yoEmail))
    || (!!dn && !!yoNombre && (dn === yoNombre || dn.includes(yoNombre) || yoNombre.includes(dn)))
    || (!!dn && !!yoNombre && primerNombre(dueñoDicho) === yoNombre.split(' ')[0] && !otroConMiPrimerNombre);

  const esDeOtro = o.esMio === true ? false
    : o.esMio === false ? !pareceMio
      : (!!dn && !pareceMio);

  return {
    dueño: dueñoDicho || (emailReal ? porEmail.get(emailReal)?.nombre ?? '' : ''),
    // El email de quien mira el tablero jamás cuenta como "de otro".
    dueñoEmail: emailReal === yoEmail ? '' : emailReal,
    esDeOtro,
  };
}
