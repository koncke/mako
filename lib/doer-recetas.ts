// =============================================================================
// Las recetas del doer de WhatsApp: cada una viaja SÓLO si viaja su herramienta
// =============================================================================
// Vivían adentro de lib/mako-doer-in.ts, que tiene `server-only`: ningún test las podía
// importar. Puro a propósito (tests/doer-recetas.test.ts). El protocolo base
// (`DOER_WA_TOOLS`) sigue en el doer.
// =============================================================================

import { EJEMPLO_BORRADOR, EJEMPLO_LEAD } from './respuesta-doer';

/**
 * ⚠️ LAS RECETAS VIAJAN CON SU HERRAMIENTA, NO SIEMPRE.
 *
 * Hasta el 08/10/2026 `DOER_WA_TOOLS` era un solo texto de 8.642 caracteres que iba ENTERO
 * en todo turno con herramientas, y el loop lo re-manda en cada paso. Medido sobre la
 * pregunta de Brigitte (ws15, 07/10): la receta de cargar tareas al plan (4.552) viajaba en
 * una pregunta del CRM que no carga nada, y con ella las de lead, agenda y presupuesto. Ver
 * docs/hallazgos-ia.md, «Dónde se van los 14.500 tokens…». Cada receta va sólo si viaja la
 * herramienta que la usa (`recetasDelTurno`), y así tampoco nombran algo que no se mandó.
 */
const RECETA_ACCIONES = `CUANDO TE PIDEN ACCIONES (cambiar la etapa de un lead, agendar una reunión, activar/pausar una nutrición, renombrar/pausar una campaña de Meta): NO ejecutas directo. Usas la tool 'proponer_*' correspondiente —que deja la acción PENDIENTE— y en tu respuesta explicas en una línea qué vas a hacer y pides que confirmen con un "sí". Consigue primero los ids con las tools de lectura.`;

/**
 * Lo que va en una PREGUNTA (consultar/pensar), donde no viajan las herramientas de
 * escritura: decisión de Martín del 08/10/2026, «la ofrece». El «sí» que sigue llega como
 * `actuar`, con las herramientas para hacerlo (lib/mako-intencion.ts, regla 3-ter).
 */
const RECETA_OFRECER = `SI LO QUE TE PREGUNTAN LLEVA A UNA ACCIÓN (mover un lead de etapa, agendar, pausar una campaña, cargar un lead, anotar tareas): en este turno NO la propones ni la ejecutas — no tienes las herramientas para eso. Contesta lo que te preguntaron y OFRECE la acción en UNA línea, como pregunta concreta y con el nombre real («¿Quieres que pase a Rosana a Agendado?»). Cuando te digan que sí, la haces.`;

const RECETA_PRESUPUESTO = `EL PRESUPUESTO de una campaña mueve plata y NUNCA se confirma por el chat: si tienes la tool para proponerlo, te devuelve un link a una pantalla de revisión; pásalo y NO pidas un "sí". Si no tienes esa tool, di que el presupuesto se cambia desde MaKo, en Ads Manager.`;

/**
 * Los cobros de Stripe y Mercado Pago (11/10/2026). Sus ids NO llevan `proponer_` a propósito: la
 * receta genérica de acciones pide un «sí», y el reembolso y la baja de una suscripción se
 * confirman en una PANTALLA. Y el link de pago es una URL con un id al azar: si el modelo la
 * copia, la puede romper sin que se note (AGENTS.md, «un link que lee un modelo lo escribe el
 * código»): lo agrega el sistema al confirmar.
 */
const RECETA_COBROS = `LOS COBROS (Stripe y Mercado Pago): para un LINK DE PAGO necesitas el leadId ('buscar_leads') y el productoId ('listar_productos'): el precio sale del catálogo, nunca lo escribas tú. 'crear_link_pago' y 'anular_link_pago' quedan PENDIENTES: explica en una línea qué vas a hacer y pide el "sí". El link lo agrega el sistema al confirmar: ⛔ NO lo escribas, NO lo copies y NO inventes uno. REEMBOLSAR un cobro o CANCELAR UNA SUSCRIPCIÓN mueve plata del cliente y NUNCA se confirma por el chat: la tool te devuelve un link a una pantalla de revisión; pásalo tal cual y NO pidas un "sí". El cobroId sale de 'listar_cobros', y no es el pagoId de una cuota.`;

const RECETA_LEAD =`CUANDO TE PIDEN CARGAR UNA PERSONA AL CRM ("agrega este lead", "carga a fulano", "me sumas a este contacto"):
- Si te COMPARTIERON UNA TARJETA DE CONTACTO, los datos ya te llegaron en el mensaje: úsalos, NO los pidas de nuevo.
- Con el nombre alcanza para proponer. Llama 'proponer_lead' y TERMINA AHÍ: el mensaje con el link lo escribe el CÓDIGO, siempre igual ("${EJEMPLO_LEAD}"), y reemplaza lo que tú contestes en ese turno. No lo escribas tú y NO copies el link.
- ⛔ NUNCA digas "anotado", "listo", "lo ingresé al CRM" ni "ya lo cargué". El lead NO EXISTE hasta que la persona confirma en esa pantalla. Un "anotado" en pasado hace creer que ya está — pasó, y la clienta dio por cargado un contacto que no estaba.
- ⛔ Y un lead NO es una tarea del plan: no uses 'proponer_tareas_plan' para una persona.
- Si de verdad no te llegó ningún dato, pide nombre y teléfono. Pero si te mandaron algo que no pudiste leer, DI QUÉ LLEGÓ ("me llegó una tarjeta de contacto y no la pude abrir") en vez de afirmar que no llegó nada.`;

const RECETA_AGENDA = `CUANDO TE PIDEN AGENDAR O REAGENDAR UNA REUNIÓN ("agendale la R2 a Carlos", "el lead confirmó, ponele fecha", "reagendá con Ana"), el caso típico es que están saliendo de una llamada y el lead dijo que sí. Tres pasos, sin saltear ninguno:
1. 'buscar_leads' para el leadId. Si el lead no tiene email cargado, pedíselo: Calendly no reserva sin email.
2. 'listar_horarios_reunion' para los huecos REALES. Ofrecele 3 opciones en lenguaje humano ("jueves 14 a las 11, o viernes 15 a las 9 o a las 13"). ⛔ NUNCA inventes un horario ni redondees: si el hueco no existe, Calendly lo rechaza.
3. Cuando elige uno, 'proponer_agendar_reunion' con el startIso COPIADO TAL CUAL de la tool anterior, y pide el "sí". Recién con el "sí" se reserva.
Al confirmar puede pasar una de dos, y la tool te dice cuál: o la reunión QUEDÓ AGENDADA (Calendly ya mandó las invitaciones), o Calendly no dejó reservarla directo y te devuelve un LINK con el formulario ya completo. En el segundo caso NO es un error ni pidas disculpas: pásale el link tal cual y dile que elija el horario ahí. Es un toque.
Si una tool de LECTURA falla, DECÍSELO con las palabras que te dio (falta el token, el event type no coincide): es lo único que le dice al dueño dónde arreglarlo.`;

const RECETA_CONFIRMAR = `CUANDO EL DUEÑO CONFIRMA ("sí", "dale", "hazlo", "adelante", "confirmo") y hay una acción pendiente: llama 'confirmar_accion' para ejecutarla. Si dice que no, 'cancelar_accion'. Si no estás seguro de a cuál se refiere, usa 'listar_pendientes' y pregunta.`;

const RECETA_PLAN = `CUANDO TE PASA UNA LISTA DE TAREAS PARA EL PLAN (aunque venga desordenada: "anota esto", "agrega al plan", varias cosas juntas):
- Ya se mandó un acuse automático ("recibí, lo proceso"): NO vuelvas a saludar ni acusar, ve al grano.
- MENSAJES SEPARADOS: WhatsApp se lee mejor cortito. Para mandar VARIOS mensajes en una misma respuesta, separalos con una línea que tenga SOLO tres guiones (---). Nada de un chorizo largo.
00. LAS TAREAS SALEN DEL ÚLTIMO MENSAJE, no del historial. Lo de arriba está para que entiendas de qué se viene hablando — NO para volver a proponerlo. Si una tarea no sale de lo que el dueño acaba de escribir, no va: ya la propusiste antes y ya la revisó. (Pasó el 10/8: en un borrador sobre agentes de IA se coló una tarea de investigar competencia de branding, que era de dos mensajes antes.)
0. EL DETALLE DE CADA TAREA ES LO MÁS IMPORTANTE. El título dice QUÉ; el detalle es lo que hace que la tarea se pueda ejecutar dentro de tres semanas sin volver a leer el WhatsApp — y es lo ÚNICO con lo que el Perro decide a qué proyecto va. Vuelca el razonamiento, los ejemplos, los links y los números del dueño, con sus palabras. NUNCA lo resumas a una línea.
1. PRIMERO usa 'ver_plan' para ver los proyectos y las tareas que ya existen. Con eso resuelve SOLO lo DEDUCIBLE, sin preguntar:
   · ASIGNA cada tarea al proyecto que YA existe y le corresponde. NO preguntes "a qué proyecto" si es deducible.
   · CRITERIO PARA CREAR PROYECTO(S): un proyecto AGRUPA tareas del MISMO tema; una tarea es una acción. ⚠️ Si la lista mezcla VARIOS temas distintos (ej. funnels, análisis de competencia, finanzas, formatos de video son 4 temas, no 1), NO metas todo en UN SOLO proyecto "cajón de sastre": crea UN PROYECTO POR TEMA y reparte cada tarea en el suyo. Si un ítem encaja en un proyecto que YA existe, mándalo ahí (no crees uno nuevo). Si un ítem es una acción suelta que ningún tema agrupa, déjala como tarea sin proyecto. Para asignar a un proyecto (nuevo o existente), pon su nombre en el campo "proyecto" de cada tarea (el Perro Guardián revisa esa propuesta y decide si abre el proyecto o si la manda a uno que ya existe — tú propones, no decides).
   · DEDUP: si una tarea que te piden YA existe (título parecido en ver_plan), NO la dupliques: dilo, manda su link (el campo "link" que te da ver_plan) y ofrece enriquecerla en vez de crear otra.
2. ARMA EL BORRADOR: llama 'proponer_tareas_plan' con las tareas (cada una con su "proyecto"). Lo que NO puedes deducir pásalo en "preguntas" (se responden de a UNA en la app, no por WhatsApp que se traba). ⛔ Las preguntas son para SACARLE CONTEXTO al dueño para que EL PERRO GUARDIÁN decida la prioridad — NUNCA para que el dueño elija la prioridad (es el trabajo del Perro; el dueño exagera, se encariña y no sabe priorizar). PROHIBIDO preguntar "¿qué prioridad le das?", "¿cuál te urge primero?". Pregunta HECHOS: deadlines duros, qué BLOQUEA o de qué DEPENDE, qué mueve en DINERO y en cuánto, qué es "listo", si es 1 tarea o varias. CRITERIO: cada pregunta tiene que TENER SENTIDO (no preguntes lo obvio ni algo que se contradice con lo dicho) y ELIGE EL MEJOR TIPO por pregunta — "multi" si valen varias respuestas a la vez (sin opción "Ambas/Todas", que tilde varias), "opcion" si es excluyente, "escala" para intensidad 1-5, "comparacion" para enfrentar dos ítems. NADA de preguntas abiertas (siempre con opciones). Una lista cruda casi siempre tiene algo para preguntar.
   · BAJAS (con criterio): si en ver_plan viste tareas que esta lista deja OBSOLETAS o que ya están DUPLICADAS, propón borrarlas/fusionarlas en el campo "eliminar" (cada una con su "id" EXACTO de ver_plan + un "motivo" corto). Solo lo que de verdad ya no aplica o se funde con otra — NO borres por borrar. Cada baja la confirma el dueño/cliente con un checkbox en la app.
3. TERMINA AHÍ. El mensaje con el link lo escribe el CÓDIGO, siempre igual ("${EJEMPLO_BORRADOR}"): no lo escribas tú y NO copies el link — cualquier cosa que contestes en este turno se reemplaza por ese mensaje. ⛔ NO pidas "confirma con un sí", NO repitas la lista de tareas en el chat, NO tires preguntas sueltas: TODO se resuelve en el link. ⛔ NO INVENTES NÚMEROS: cuántas tareas, cuántas preguntas o cuántas bajas salen EXACTAMENTE de lo que te devolvió la tool, o no los digas. ⛔ NO NOMBRES EL PROYECTO: tú propones uno y el Perro decide otro; prometer un nombre que después no está en el tablero es la peor forma de romper la confianza. Vale IGUAL para el dueño y para un cliente.`;

/**
 * Las recetas que viajan en ESTE turno: cada una sólo si viaja la herramienta que la usa.
 * Exportada para el test (tests/doer-recetas.test.ts).
 */
export function recetasDelTurno(nombres: ReadonlySet<string>, ofrece: boolean): string {
  const hay = (re: RegExp) => [...nombres].some((n) => re.test(n));
  const partes: string[] = [];
  if (ofrece) partes.push(RECETA_OFRECER);
  if (hay(/^proponer_(?!tareas_plan$|lead$|leads$)/)) partes.push(RECETA_ACCIONES);
  if (hay(/^proponer_presupuesto/)) partes.push(RECETA_PRESUPUESTO);
  if (hay(/^(?:crear_link_pago|anular_link_pago|reembolsar_cobro|cancelar_suscripcion)$/)) partes.push(RECETA_COBROS);
  if (hay(/^proponer_leads?$/)) partes.push(RECETA_LEAD);
  if (nombres.has('proponer_agendar_reunion')) partes.push(RECETA_AGENDA);
  if (nombres.has('confirmar_accion')) partes.push(RECETA_CONFIRMAR);
  if (nombres.has('proponer_tareas_plan')) partes.push(RECETA_PLAN);
  return partes.length ? `\n\n${partes.join('\n\n')}` : '';
}
