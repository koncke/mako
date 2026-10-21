// =============================================================================
// Las recetas del doer de WhatsApp: cada una viaja SÓLO si viaja su herramienta
// =============================================================================
// Vivían adentro de lib/mako-doer-in.ts, que tiene `server-only`: ningún test las podía
// importar. Puro a propósito (tests/doer-recetas.test.ts). El protocolo base
// (`DOER_WA_TOOLS`) sigue en el doer.
// =============================================================================

import { EJEMPLO_BORRADOR, EJEMPLO_LEAD } from './respuesta-doer';
import { OPERACIONES_API } from './editor-video/chat-api';

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

/**
 * LA LANDING (pieza 1.15 del Ops Center, 20/10/2026; docs/ops-center-principal.md §4.8). Viaja con las herramientas que
 * CREAN una landing o una presentación. El código no adivina el producto (`productoDeLanding`,
 * lib/editor-landing/producto-de-landing.ts, en generar_landing_con_ia): la receta hace que MaKo pregunte antes de
 * proponer, y el código asegura que no se cree sin saberlo. Sin nombres de herramientas: no siempre viajan las que
 * nombraría.
 */
// La línea del producto viaja SÓLO con la herramienta que tiene dónde ponerlo (generar_landing_con_ia, `producto` y
// `producto_nuevo`; revisión del 21/10/2026): con las otras cuatro, la pregunta se hacía y la respuesta se perdía. Y en
// un turno de crear viajan juntas, así que la línea dice a qué camino aplica.
const PRODUCTO_LANDING = `- PARA QUÉ PRODUCTO, si la creas con IA desde una idea o un texto (desde un diseño, en blanco o con una plantilla no se usa: no lo preguntes): si te la piden PARA uno del catálogo, pasa su nombre exacto (no si lo nombran para excluirlo, compararlo o de modelo). Si no, NO lo adivines: antes de proponer, pregunta con opciones (los productos del catálogo, «Un producto nuevo» y «El negocio en general»). Si eligen uno nuevo, pregunta su nombre y de qué se trata.`;
const RECETA_LANDING = (conProducto: boolean): string => [
  'CUANDO TE PIDEN UNA LANDING O UNA PRESENTACIÓN:',
  ...(conProducto ? [PRODUCTO_LANDING] : []),
  '- Si te nombran una landing que coincide con dos, pregunta cuál: nunca elijas la primera.',
  '- No inventas testimonios, cifras, garantías ni precios, y no publicas sin que te lo pidan.',
].join('\n');

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

// ── Video e imagen (Ops Center, pieza 1.15, 20/10/2026) ───────────────────────────────────
// Sale de docs/ops-center-principal.md §4.10 y del mapa de video e imagen. EL CASO: «cortá el
// principio del video» llegaba con un corte por defecto en silencio; lo que cambia el resultado
// (qué proyecto, cuánto, dónde) se PREGUNTA, con opciones sacadas de los datos reales.
// Cada una viaja con su herramienta: la del editor sólo con sus ESCRITURAS (en una pregunta, que
// trae lecturas, no pesa), la del Generator con sus lecturas (el saldo y el puente son de ahí).

/** Las 34 escrituras del Video Editor (lib/editor-video/chat-api.ts): todas dejan una PROPUESTA. */
export const ESCRITURAS_EDITOR_VIDEO: ReadonlySet<string> = new Set(OPERACIONES_API.map((o) => o.id));

/** Lo del Video Generator y el puente a Flow. Un test exige que toda operación de video del registro esté en uno de estos grupos. */
export const OPERACIONES_GENERADOR_VIDEO: ReadonlySet<string> = new Set([
  'listar_anuncios_video', 'ver_anuncio_video', 'ver_montaje_anuncio', 'contar_escenarios_reusables', 'listar_guiones_para_video',
  'listar_formatos_video', 'listar_lugares_grabacion', 'ver_contexto_video', 'ver_voz_cliente', 'estado_onboarding_video',
  'ver_saldo_flow', 'calcular_alcance_anuncio', 'ver_puente_flow', 'listar_trabajos_flow',
]);

/** Las escrituras del Image Editor (lib/api-mako/areas/imagen.def.ts). */
export const ESCRITURAS_IMAGEN: ReadonlySet<string> = new Set(['crear_diseno_imagen', 'cambiar_textos_diseno_imagen', 'duplicar_diseno_imagen', 'borrar_diseno_imagen']);

const RECETA_VIDEO_EDITOR = `EL VIDEO EDITOR: el proyecto vive en el navegador de quien lo editó y tú lees una COPIA, que puede estar vieja. Antes de cualquier cambio usa 'listar_proyectos_video' y 'ver_proyecto_video'. Las refs (v1, t2), los medios (m1) y los ids de transiciones, filtros y fuentes se copian EXACTOS de esa vista: nunca los inventes.
SI FALTA UN DATO QUE CAMBIA EL RESULTADO, PREGUNTA UNA SOLA COSA con 2 o 3 opciones sacadas de los datos reales (con 'preguntar_al_usuario' si la tienes) y no propongas nada hasta tener la respuesta:
- Qué proyecto, si hay más de uno o te dicen «el video» sin nombre: ofrece los 3 más recientes.
- Cuánto cortar y dónde, si no te lo dicen («corta el principio»): ofrece cortes concretos con los clips y sus tiempos.
- Un texto que es un hecho (fecha, precio, dirección, hora): pídelo, nunca lo rellenes.
Todo cambio queda PROPUESTO hasta que una persona lo acepta en el editor: ⛔ nunca digas «listo», «aplicado» ni «ya está». El link lo pone el sistema: no lo escribas. ⛔ No borres un proyecto: no hay papelera. Lo que el editor no puede por chat (quitar el fondo, borrar silencios, exportar, música de biblioteca) se DICE así, no se simula.`;

const RECETA_VIDEO_GENERADOR = `EL VIDEO GENERATOR: antes de prometer algo que genere, mira 'estado_onboarding_video', 'ver_contexto_video' y 'ver_puente_flow'. Antes de filmar, 'ver_saldo_flow' y 'calcular_alcance_anuncio': créditos null quiere decir que NUNCA se leyó, no que tenga cero; di la fecha de la lectura. El guion sale de Ads Writer ('listar_guiones_para_video') y va LITERAL: aquí no se escriben guiones. Qué guion, qué formato y qué lugar se preguntan con 2 o 3 opciones. ⛔ Filmar gasta créditos de Flow del cliente: una toma por vez, con el costo dicho («N créditos, te quedan M, leído el …»), nunca en lote, y una toma que falló no se reintenta sola. ⛔ Nunca muestres un prompt.`;

const RECETA_AVATAR = `AI AVATAR: mira 'ver_avatares' antes de hablar de looks. Una cara o una voz se usan sólo con la autorización de su dueño, y no afirmes que la cara de marca es la del dueño. Antes de clonar una voz, el consentimiento explícito. ⛔ No digas que el avatar habla con la voz clonada: eso no está hecho. La voz usa el ElevenLabs del cliente, nunca el de la plataforma.`;

const RECETA_IMAGEN = `EL IMAGE EDITOR: mira 'listar_disenos_imagen' y 'ver_diseno_imagen' antes de cambiar textos; 'listar_plantillas_imagen' trae primero las sugeridas para el negocio. Si falta qué diseño o el tamaño (post, story o banner), PREGUNTA UNA cosa con 2 o 3 opciones. Los textos que son hechos (fecha, precio, dirección) se piden, no se inventan, y si un hueco de la plantilla queda con el texto de ejemplo, DILO. No hay kit de marca (logo, colores): no lo prometas. Lo que el chat no puede (cambiar colores, poner el logo, descargar) se dice así. ⛔ Nunca metas datos de leads en un diseño.`;

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
  if (hay(/^(?:generar_landing_con_ia|crear_landing_desde_diseno|crear_landing_en_blanco|crear_presentacion_desde_plantilla|replicar_landing)$/)) partes.push(RECETA_LANDING(hay(/^generar_landing_con_ia$/)));
  if (nombres.has('confirmar_accion')) partes.push(RECETA_CONFIRMAR);
  if (nombres.has('proponer_tareas_plan')) partes.push(RECETA_PLAN);
  if ([...nombres].some((n) => ESCRITURAS_EDITOR_VIDEO.has(n))) partes.push(RECETA_VIDEO_EDITOR);
  if ([...nombres].some((n) => OPERACIONES_GENERADOR_VIDEO.has(n))) partes.push(RECETA_VIDEO_GENERADOR);
  if (nombres.has('ver_avatares')) partes.push(RECETA_AVATAR);
  if ([...nombres].some((n) => ESCRITURAS_IMAGEN.has(n))) partes.push(RECETA_IMAGEN);
  return partes.length ? `\n\n${partes.join('\n\n')}` : '';
}
