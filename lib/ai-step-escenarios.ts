// =============================================================================
// ai-step-escenarios — el CATÁLOGO de escenarios típicos de un AI Step (undécima tanda, puro)
// =============================================================================
// Martín (11/10/2026, punto 12): «No pongas tanto input de texto en AI Step... solo el primero donde le pides a la IA
// o grabas audio... El resto con desplegables». Un escenario no se escribe: sale de «✦ Armar», de «✦ Otro con MaKo»
// o de ESTE catálogo (docs/diseno-undecima-tanda.md §2, punto 12, y §7).
//
// ⚠️ NADA INVENTADO (la regla de Martín, pedida con enojo): son los casos que la galería ya repetía
// (lib/plantillas-automatizaciones.ts, de las automatizaciones de los clientes y de la galería v2), con sus
// textos TAL CUAL. UNA sola copia: la galería los toma de acá (`escenarioTipico`), y el editor los ofrece de acá.
//   · La libertad de antes pasa a la de hoy (§7): «sola + te aviso» → «Para aprobar» (MaKo no ve la agenda: el
//     horario lo coordina una persona, y «Sola» no avisa); «a revisar» → «Para aprobar»; «sólo avisa» → «Sólo te
//     avisa» (sin respuesta); «sola» → «Sola».
//   · «Pregunta el precio» tenía DOS respuestas en la galería (antes de agendar: «lo ven en una llamada»; después:
//     «se ve en la reunión»). Son dos entradas con el mismo nombre y su id dice cuál.
//
// ⚠️ PURO Y SIN `server-only`: lo importan la galería (cliente y server), el editor y los tests.
// =============================================================================

import type { CasoRespuesta } from './flujo-grafo';
import { camposDeLibertad, type Libertad } from './ai-step-libertad';

/** Un escenario del catálogo: lo que un AI Step lleva adentro, sin el id del caso (lo pone quien lo suma). */
export type EscenarioTipico = {
  /** La clave del catálogo (estable: la usan la galería y el editor). */
  id: string;
  titulo: string;
  /** Cuándo entra: lo que lee el clasificador. */
  cuando: string;
  /** Cómo responder: la guía del redactor. '' = no contesta («Sólo te avisa»). */
  responder: string;
  libertad: Libertad;
};

// Las respuestas que se repiten (de #212, #213 y #221 del ws1, sin el video ni el link; las de la galería v2).
const R_CONFIRMA = 'Agradece en una línea y confírmale que nos vemos en la reunión. No le hagas más preguntas.';
const R_PRECIO_REUNION = 'Dile que el precio se ve en la reunión, una vez que se entiende su caso. Invítalo a llegar con sus dudas anotadas. No des cifras.';
const R_PRECIO_LLAMADA = 'Dile que el precio depende de lo que necesite y que lo ven en una llamada corta. Invítalo a agendarla. No des cifras.';
const R_PREGUNTA_REUNION = 'Contesta lo que pregunta con lo que se sabe de su reunión. Si no tienes el dato, dile que se lo confirmas en un rato.';
const R_CAMBIAR = 'Dile que no hay problema y pregúntale qué día y horario le quedan mejor. No propongas horarios ni mandes links.';
const R_NO_INTERESA = 'Agradece que te avise, en una línea, sin insistir. Déjale la puerta abierta.';
const C_PRECIO = 'Pregunta cuánto cuesta, las formas de pago o si hay descuento.';

/** El catálogo, en el orden del embudo (agendar → reunión → después → cobrar → cliente). */
export const ESCENARIOS_TIPICOS: ReadonlyArray<EscenarioTipico> = [
  { id: 'quiere-agendar', titulo: 'Quiere agendar', cuando: 'Dice que sí, que quiere agendar, pide horarios o pregunta cómo seguimos.',
    responder: 'Agradece en una línea y dile que con gusto lo ayudamos a agendar. Pregúntale qué día y horario le quedan mejor. No propongas horarios ni mandes links.', libertad: 'aprueba' },
  { id: 'precio-llamada', titulo: 'Pregunta el precio', cuando: C_PRECIO, responder: R_PRECIO_LLAMADA, libertad: 'aprueba' },
  { id: 'no-le-interesa', titulo: 'No le interesa', cuando: 'Dice que no le interesa, que no es el momento o pide que no le escriban.', responder: R_NO_INTERESA, libertad: 'aprueba' },
  { id: 'confirma', titulo: 'Confirma', cuando: 'Confirma que va a estar, o contesta solo con un sí, ok, gracias o un emoji.', responder: R_CONFIRMA, libertad: 'sola' },
  { id: 'precio-reunion', titulo: 'Pregunta el precio', cuando: C_PRECIO, responder: R_PRECIO_REUNION, libertad: 'aprueba' },
  { id: 'pregunta-reunion', titulo: 'Pregunta por la reunión', cuando: 'Pregunta a qué hora es, qué día, cuánto dura, de qué se trata o dónde está el link.', responder: R_PREGUNTA_REUNION, libertad: 'aprueba' },
  { id: 'cambiar-dia', titulo: 'Quiere cambiar el día', cuando: 'Dice que no puede en el horario que agendó, pide cambiar el día o la hora, o pregunta cómo reagendar.', responder: R_CAMBIAR, libertad: 'aprueba' },
  { id: 'puede-no-calificar', titulo: 'Puede no calificar', cuando: 'Cuenta que no es quien decide o que no puede invertir en este momento.', responder: '', libertad: 'avisa' },
  { id: 'quiere-reagendar', titulo: 'Quiere reagendar', cuando: 'Pide disculpas, cuenta por qué no pudo, dice que quiere reprogramar o pregunta por otro horario.', responder: R_CAMBIAR, libertad: 'aprueba' },
  { id: 'quiere-retomarlo', titulo: 'Quiere retomarlo', cuando: 'Dice que sí, que le interesa retomarlo, pregunta cómo seguimos o pide horarios.',
    responder: 'Agradece en una línea y dile que con gusto lo retoman. Pregúntale qué día y horario le quedan mejor esta semana. No menciones precios.', libertad: 'aprueba' },
  { id: 'ya-pago', titulo: 'Dice que ya pagó', cuando: 'Dice que ya pagó, manda un comprobante o pregunta si llegó el pago.',
    responder: 'Agradece en una línea y dile que lo confirmas en un rato. No confirmes el pago tú.', libertad: 'aprueba' },
  { id: 'problema-pago', titulo: 'Tiene un problema para pagar', cuando: 'Cuenta que no le funciona el pago, que no tiene los datos o que le rebotó la tarjeta.',
    responder: 'Pregúntale qué pasó, en una línea. No des datos de cuentas ni montos.', libertad: 'aprueba' },
  { id: 'no-quiere-comprar', titulo: 'Ya no quiere comprar', cuando: 'Dice que se arrepintió, que ya no le interesa o que no es el momento.', responder: '', libertad: 'avisa' },
  { id: 'acepta-testimonio', titulo: 'Acepta dejar el testimonio', cuando: 'Dice que sí, que con gusto, o pregunta cómo hacerlo.',
    responder: 'Agradece en una línea y pregúntale si prefiere grabar un video corto o escribirlo. No mandes links.', libertad: 'aprueba' },
  { id: 'tiene-queja', titulo: 'Tiene una queja', cuando: 'Cuenta algo que no le gustó, un problema o que no ve resultados.', responder: '', libertad: 'avisa' },
  { id: 'no-puede-ahora', titulo: 'No puede ahora', cuando: 'Dice que no tiene tiempo o que lo hace más adelante.', responder: 'Agradece y dile que no hay apuro, en una línea. No insistas.', libertad: 'sola' },
];

/** Un escenario del catálogo por su clave, o null. */
export function escenarioPorId(id: string): EscenarioTipico | null {
  return ESCENARIOS_TIPICOS.find((e) => e.id === id) ?? null;
}

/**
 * EL ESCENARIO COMO CASO del AI Step (`CasoRespuesta`), con el id de caso que le da quien lo suma y la libertad
 * escrita por `camposDeLibertad` (la única que escribe `sola` / `no_contesta`). Una clave que no existe TIRA: es un
 * error de quien arma la plantilla, y el test de la galería la recorre entera.
 */
export function escenarioTipico(id: string, casoId: string): CasoRespuesta {
  const e = escenarioPorId(id);
  if (!e) throw new Error(`escenario típico desconocido: ${id}`);
  return {
    id: casoId, titulo: e.titulo, cuando: e.cuando, siguiente: null,
    ...(e.responder ? { responder: e.responder } : {}),
    ...camposDeLibertad(e.libertad),
  };
}
