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
//
// TERCERA ROTURA, 12/8/2026 — y lo importante es que NO fue acá. El dueño reportó «me
// pone tareas a mí que deberían ser de Mau» y esta función había resuelto BIEN las 37:
// el cache de esa corrida tiene las 26 de Mauricio con `esDeOtro: true` y su email. Lo
// que las borró fue un gate río abajo que confundía «no le puedo mandar esto» con «no es
// de él» (ver lib/reunion-reparto.ts). Lo que SÍ se arregló acá es la bomba que estaba
// al lado: `esMio: true` le ganaba al email de un invitado real.
// =============================================================================

/** Quién mira el tablero. */
export type Yo = { nombre: string; email: string };
/** Alguien que estuvo en la reunión. */
export type ParticipanteRef = { nombre: string; email: string };

/** Lo que dijo el modelo sobre el dueño de una tarea. */
export type DueñoCrudo = { dueño?: unknown; dueñoEmail?: unknown; esMio?: unknown };

export type DueñoResuelto = {
  dueño: string; dueñoEmail: string; esDeOtro: boolean;
  /** El modelo dijo «es mía» y el email de un invitado REAL dice que es de otro. No hay
   *  regla determinista que separe «nombró al ejecutor» de «nombró al que habló» —esa
   *  fue la rotura nº2 del header, la consultoría—, así que la contradicción se DECLARA
   *  y viaja hasta la fila, en vez de resolverse en silencio. */
  atribucionDudosa?: boolean;
};

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
  // ⚠️ SIN NOMBRE EXACTO, VALE UN NOMBRE QUE ARRANCA IGUAL, SI ES UNO SOLO. Desde el
  // 07/10/2026 los invitados que salen de Google Calendar NO van al prompt (Uso Limitado
  // de Google, lib/datos-google-ia.ts): el modelo escribe el nombre como lo oyó
  // («Juan») y el email lo pone acá el código, contra «Juan Pérez» del calendario.
  // «Juan Gómez» no cae en «Juan Pérez» (tiene que ARRANCAR igual), y con dos Juanes
  // con email no se elige ninguno.
  const porPrefijo = (): string => {
    if (!dn) return '';
    const c = participantes.filter((p) => p.email.trim() && p.nombre
      && (normNombre(p.nombre) === dn || normNombre(p.nombre).startsWith(`${dn} `)));
    return c.length === 1 ? c[0].email.trim().toLowerCase() : '';
  };
  // `propuesto &&`: un invitado SIN email (un hablante de Fathom en un Meet improvisado)
  // deja la clave '' en `porEmail`, y un modelo que no puso email «matcheaba» esa fila
  // vacía — o sea que nunca llegaba al rescate por nombre. Lo destapó el test del Juan.
  const emailReal = propuesto && porEmail.has(propuesto) ? propuesto : (dn ? porNombre.get(dn) || porPrefijo() : '');

  // ¿Otro participante comparte mi primer nombre? Entonces el primer nombre no alcanza
  // para decidir (dos Martines en la reunión) y solo vale el email.
  const otroConMiPrimerNombre = participantes.some((p) =>
    p.email.trim().toLowerCase() !== yoEmail && !!p.nombre && primerNombre(p.nombre) === yoNombre.split(' ')[0]);

  const pareceMio = (!!yoEmail && (emailReal === yoEmail || dueñoDicho.toLowerCase() === yoEmail))
    || (!!dn && !!yoNombre && (dn === yoNombre || dn.includes(yoNombre) || yoNombre.includes(dn)))
    || (!!dn && !!yoNombre && primerNombre(dueñoDicho) === yoNombre.split(' ')[0] && !otroConMiPrimerNombre);

  // ── EL FLAG YA NO LE GANA AL EMAIL ────────────────────────────────────────────────
  // Antes esto era `o.esMio === true ? false`, sin ningún «salvo»: cortaba ANTES de
  // consultar `pareceMio`. El comentario de arriba prometía que la evidencia podía
  // contradecir al modelo y para ese valor no podía — la confianza era asimétrica justo
  // en la dirección peligrosa, que es reclamar una tarea ajena.
  //
  // No es lo que rompió la reunión del 12/8 (eso fue el gate de `reunion-auto`, ver
  // lib/reunion-reparto.ts), pero es la misma falla esperando: el día que el modelo
  // mande `esMio: true` sobre una tarea con el email de otro, entran 26 tareas ajenas al
  // tablero del dueño sin que nada avise.
  //
  // `esMio` es un token que el modelo tira sin pensar; el email de un invitado REAL de
  // la reunión es lo más caro de producir que hay acá. AGENTS.md ya tiene la regla:
  // «cuando el saneo tenga que elegir entre dos señales que se contradicen, gana la más
  // cara de producir». Se exige `!pareceMio` para no pisar nada cuando el nombre TAMBIÉN
  // apunta a mí — que es el caso del apellido de la cuenta de Fathom.
  const otroPorEmail = !pareceMio && !!emailReal && emailReal !== yoEmail;

  const esDeOtro = otroPorEmail ? true
    : o.esMio === true ? false
      : o.esMio === false ? !pareceMio
        : (!!dn && !pareceMio);

  return {
    dueño: dueñoDicho || (emailReal ? porEmail.get(emailReal)?.nombre ?? '' : ''),
    // El email de quien mira el tablero jamás cuenta como "de otro".
    dueñoEmail: emailReal === yoEmail ? '' : emailReal,
    esDeOtro,
    atribucionDudosa: otroPorEmail && o.esMio === true ? true : undefined,
  };
}
