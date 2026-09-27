// =============================================================================
// cs-autoasignar — de quién es cada cosa, decidido solo
// =============================================================================
// «Si un proyecto o tarea es de un cliente, en casos evidentes como "Cliente:
// Mauricio" o que en la descripción lo diga, MaKo debería auto asignar a ese
// cliente… debería razonarlo» (26/09/2026).
//
// Son DOS problemas distintos y sólo uno se puede resolver sin IA. Medido el
// 26/09/2026 contra producción, los cuatro workspaces:
//
//   ws    clientes  proyectos  tareas   ata por nombre   «mencionan» a un cliente
//    1       14         19      212           6                    3
//    9        3         71      396           1                   43
//   11       11          9       68           0                    1
//   13        2          6        19          0                    0
//
// ⚠️ LA COLUMNA DE LA DERECHA ES UNA TRAMPA, Y ES LA RAZÓN DE ESTE MÓDULO. De las
// 43 de tu workspace, las que se ven son:
//
//     «Que Leila y Leandro puedan entrar como clientes antes del viernes»
//     «Probar el onboarding con un cliente de prueba (ANTES que entre Leila)»
//     «No funciona al crear un grupo de cliente (probado con Mauricio)»
//
// Las tres NOMBRAN a un cliente y ninguna es trabajo PARA ese cliente: son
// trabajo de producto que lo usa como ejemplo, como caso de prueba o como fecha
// límite. Asignarlas llenaría la ficha de Leila con los bugs de MaKo.
//
// Es exactamente la misma forma del error que AGENTS.md ya tiene medido para las
// recurrentes: buscar «semanal/diaria/recurrente» en las 212 tareas del ws1 daba
// 11 y NINGUNA era una recurrencia — eran «Diseñar la estructura de la junta
// semanal», o sea trabajo CON FIN que monta un ritual.
//
// De ahí las dos vías, y por qué una lleva IA y la otra no:
//
//   · POR NOMBRE DEL PROYECTO  → determinista. «Cliente: Mauricio» ↔ el lead
//     Mauricio es un subconjunto de palabras en las dos direcciones, que es el
//     mismo criterio con el que el ruteo CREA esos proyectos. No hay nada que
//     razonar y no se paga un modelo para contestarlo.
//
//   · POR MENCIÓN EN EL TEXTO  → la pregunta no es «¿lo nombra?» sino «¿es
//     trabajo PARA él?», y eso no lo contesta ninguna regla. Va a la IA, de a
//     lotes, y lo que la IA no afirme queda sin asignar. El default del que no
//     sabe es NO asignar: una tarea sin cliente se ve en el tablero como
//     siempre, y una tarea en la ficha equivocada es una mentira que alguien va
//     a leer como un hecho.
//
// ⚠️ SIN `server-only` A PROPÓSITO: la decisión es una función pura con test, y
// el módulo que escribe en la base es otro. Un guard que no se puede testear es
// justo el que termina sin red.

import { atar, type ClienteCruce, type ProyectoCruce, type ComoAto } from '@/app/customer-success/cruce';

/** Una tarjeta del tablero, en lo mínimo que hace falta para decidir de quién es. */
export type Tarjeta = {
  id: string;
  titulo: string;
  detalle: string;
  /** Sólo las tareas: los ids de sus proyectos. */
  proyectos?: string[];
  /** Lo que ya tiene escrito, si tiene. Lo asignado a mano NO se toca. */
  clienteLeadId?: number | null;
};

/** Lo que se va a escribir sin preguntarle a nadie. */
export type Asignacion = { id: string; tipo: 'proyecto' | 'tarea'; leadId: number; cliente: string; como: ComoAto };

/** Lo que NO se puede decidir con una regla: va a la IA con su contexto. */
export type Duda = {
  id: string; tipo: 'proyecto' | 'tarea'; titulo: string; detalle: string;
  /** El cliente que el texto nombra. Uno solo: con dos, la duda se parte en dos. */
  leadId: number; cliente: string;
};

export type Plan = { asignar: Asignacion[]; dudas: Duda[] };

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Las palabras con las que se reconoce a un cliente DENTRO DE UN TEXTO LIBRE.
 *
 * ⚠️ EL UMBRAL ES 4 Y NO 3, al revés que en el cruce por nombre de proyecto, y la
 * diferencia no es cosmética: ahí las palabras se comparan contra otro NOMBRE (un campo
 * corto y curado), acá contra prosa de varios miles de caracteres, donde una palabra de
 * tres letras matchea por casualidad. «HMO» distingue una cuenta en un título de proyecto
 * y no distingue nada adentro de un detalle.
 */
export function clavesEnTexto(cliente: { nombre: string; empresa: string | null }): string[] {
  const base = norm(cliente.empresa?.trim() || cliente.nombre);
  return [...new Set(base.split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4))];
}

/**
 * Qué se asigna solo y qué hay que razonar.
 *
 * `proyectos` y `tareas` son el tablero entero; `clientes`, la cartera. `esDeCliente`
 * se inyecta por lo mismo que en `atar`: vive en un módulo `server-only`.
 */
export function planDeAsignacion(
  clientes: ClienteCruce[],
  proyectos: Array<Tarjeta & { nombre: string }>,
  tareas: Tarjeta[],
  esDeCliente: (nombre: string) => boolean,
): Plan {
  const asignar: Asignacion[] = [];
  const dudas: Duda[] = [];
  const nombreDe = new Map(clientes.map((c) => [c.leadId, c.nombre]));

  const paraCruce: ProyectoCruce[] = proyectos.map((p) => ({ id: p.id, nombre: p.nombre, clienteLeadId: p.clienteLeadId }));
  const cruce = atar(clientes, paraCruce, { esDeCliente });

  // ── 1. LOS PROYECTOS, por el mismo criterio con el que el ruteo los CREA ────
  // Sólo `nombre`: un subconjunto de palabras en las dos direcciones. `clave` ya está
  // escrito (no hay nada que hacer) y `parecido` es, por definición del módulo que lo
  // calcula, un PARECIDO — materializarlo lo convertiría en un hecho, que es justo lo
  // que su nombre dice que no es.
  const yaTiene = new Set(proyectos.filter((p) => p.clienteLeadId).map((p) => p.id));
  for (const [leadId, lista] of cruce.porLead) {
    for (const a of lista) {
      if (a.como !== 'nombre' || yaTiene.has(a.proyectoId)) continue;
      asignar.push({ id: a.proyectoId, tipo: 'proyecto', leadId, cliente: nombreDe.get(leadId) ?? `#${leadId}`, como: 'nombre' });
    }
  }

  // ── 2. LAS TAREAS QUE NOMBRAN A UN CLIENTE, a la IA ────────────────────────
  // Sólo las SUELTAS: si su proyecto ya quedó atado, la tarea es de ese cliente por
  // el cruce y escribirle el id encima no agrega un dato — agrega N escrituras y un
  // segundo lugar donde la misma respuesta puede quedar vieja.
  const proyectoAtado = new Set<string>([...yaTiene, ...asignar.filter((a) => a.tipo === 'proyecto').map((a) => a.id)]);
  for (const [, lista] of cruce.porLead) for (const a of lista) proyectoAtado.add(a.proyectoId);

  const clavesPorLead = clientes.map((c) => ({ c, claves: clavesEnTexto(c) }));
  for (const t of tareas) {
    if (t.clienteLeadId) continue;                                   // asignada a mano
    if ((t.proyectos ?? []).some((p) => proyectoAtado.has(p))) continue;  // ya es de alguien por su proyecto
    // ⚠️ SÓLO EL TÍTULO, NO EL DETALLE, y esto es lo que hace que la pregunta tenga
    // sentido. Medido el 26/09/2026 en el ws9: buscando en título+detalle salían 46
    // candidatas y la mitad eran cosas como «Que la Retro se ejecute SOLA» o «Arreglar el
    // botón de copiar en el Segundo Cerebro», atribuidas a Leila porque su nombre aparece
    // UNA vez en un detalle de 6.000 caracteres. El juez recibía «¿"Que la Retro se
    // ejecute SOLA" es de Leila?» y no tenía con qué contestar — y contestó que sí a
    // veinticinco de ellas.
    //
    // El detalle es CONTEXTO: menciona a todo el mundo. El título es lo que la tarea ES.
    // Buscando sólo ahí quedan 6 para Leila y 0 para Juanfran, que son las candidatas de
    // verdad. El detalle se sigue mandando al juez como evidencia, que es su lugar.
    const texto = norm(t.titulo);
    const nombran = clavesPorLead.filter(({ claves }) => claves.length > 0 && claves.every((w) => texto.includes(w)));
    // ⚠️ CON DOS CLIENTES NOMBRADOS NO SE PREGUNTA: se deja. «Que Leila y Leandro
    // puedan entrar como clientes» nombra a dos y no es de ninguno; preguntar por cada
    // uno invita a que la IA elija uno de los dos por desempate, que es adivinar con
    // más pasos.
    if (nombran.length !== 1) continue;
    const { c } = nombran[0];
    dudas.push({ id: t.id, tipo: 'tarea', titulo: t.titulo, detalle: t.detalle.slice(0, 600), leadId: c.leadId, cliente: c.nombre });
  }

  return { asignar, dudas };
}

// ── Lo que se le pregunta a la IA ────────────────────────────────────────────

/**
 * ⚠️ LA PREGUNTA NO ES «¿LO NOMBRA?» — eso ya lo contestó el código y por eso esta duda
 * existe. Es «¿el trabajo se hace SOBRE él?».
 *
 * ⚠️ Y LA PRIMERA VERSIÓN DE ESTE PROMPT DIJO QUE NO A TODO. Tenía los contraejemplos
 * («probado con X», «antes de que entre X») y un «ante la duda, NO» de cierre, y con eso
 * rechazó las 43 tareas del ws9 — incluidas «Borrarle a Leila los audios 21 a 24 para que
 * los regrabe» y «Reiniciar el onboarding de Leila sin perder su CRM ni su plan», que son
 * exactamente trabajo sobre la cuenta de un cliente. Se reportó así: «tampoco funcionó lo
 * de que MaKo auto-asigne, porque tanto Leila como Juanfran tienen tareas y me dice que no
 * hay nada» (26/09/2026).
 *
 * Lo que faltaba eran los ejemplos del lado del SÍ. Con los de UNA sola dirección, un
 * modelo prudente aprende que la respuesta es no, y el «ante la duda» sella la puerta. Un
 * prompt que enumera una sola dirección no está pidiendo un juicio: está pidiendo esa
 * dirección — y el resultado se lee como que la función no anda.
 */
export const SYSTEM_JUEZ = [
  'Decides de quién es un trabajo de un tablero interno de una agencia.',
  'Te doy tareas que MENCIONAN a un cliente. Mencionarlo no alcanza: hay que decidir si el',
  'trabajo se hace SOBRE ese cliente, o si el cliente aparece por otra razón.',
  '',
  'SÍ es de ese cliente cuando la tarea se hace sobre SU cuenta, SU negocio, SU material,',
  'SU campaña, SU reunión o SU configuración. Da igual que suene a trabajo técnico: si el',
  'OBJETO de la tarea es la cuenta o el negocio de esa persona, es de ella.',
  '  · "Borrarle a X los audios 21 a 24 para que los regrabe"          -> SÍ',
  '  · "Reiniciar el onboarding de X sin perder su CRM ni su plan"     -> SÍ',
  '  · "Revisar el VSL de X y preparar documento de feedback"          -> SÍ',
  '  · "Desvincular la infraestructura de Meta de X"                   -> SÍ',
  '',
  'NO es de ese cliente cuando aparece como una circunstancia y el trabajo es de otra cosa:',
  '  · una FECHA o condición:  "antes de que entre X"                  -> NO',
  '  · un CASO DE PRUEBA:      "probado con X", "con un cliente de prueba" -> NO',
  '  · un EJEMPLO de un bug:   "no saltear pasos (caso X)"             -> NO',
  '  · un HITO del producto:   "que X y otro puedan entrar como clientes" -> NO',
  '',
  'La pregunta corta: si esa tarea se hace, ¿cambia algo de la cuenta o del negocio de esa',
  'persona? Si sí, es de ella. Si lo que cambia es el producto y ella es el ejemplo, no.',
  '',
  'Ante la duda real, NO. Pero "es trabajo técnico" no es una duda: mira sobre QUÉ se hace.',
  '',
  'Responde SÓLO un JSON: {"de_ese_cliente":[<ids que SÍ>]}. Sin texto alrededor.',
].join('\n');

export function userJuez(dudas: Duda[]): string {
  return dudas.map((d) => [
    `id: ${d.id}`,
    `cliente mencionado: ${d.cliente}`,
    `título: ${d.titulo}`,
    d.detalle.trim() ? `detalle: ${d.detalle.trim().replace(/\s+/g, ' ').slice(0, 400)}` : null,
  ].filter(Boolean).join('\n')).join('\n---\n');
}

/** Los ids que la IA afirmó, saneados contra lo que se preguntó. Lo que no esté en las
 *  dudas se descarta: un modelo que inventa un id no puede escribir en la base. */
export function leerVeredicto(crudo: string, dudas: Duda[]): Asignacion[] {
  let ids: unknown;
  try { ids = (JSON.parse(crudo) as { de_ese_cliente?: unknown }).de_ese_cliente; } catch { return []; }
  if (!Array.isArray(ids)) return [];
  const pedidas = new Map(dudas.map((d) => [d.id, d]));
  const out: Asignacion[] = [];
  for (const raw of ids) {
    const d = pedidas.get(String(raw));
    if (d) out.push({ id: d.id, tipo: d.tipo, leadId: d.leadId, cliente: d.cliente, como: 'clave' });
  }
  return out;
}
