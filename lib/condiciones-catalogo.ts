// =============================================================================
// condiciones-catalogo — TODO lo que una tarjeta CONDITION puede preguntar de un lead
// =============================================================================
// Pedido de Martín (09/10/2026, punto 10): «Aquí en el condicional es donde tienes que poner
// todas las cosas que pueden pasar... Para eso primero se filtra si el CRON se creó para
// adquisición, todas las condiciones del CRM... Y de lo contrario, todas las condiciones de
// Customer Success... Debe ser bien amplio... No pongas esas preguntas genéricas, hazlo
// profesional, técnico... Se me ocurre un desplegable con opciones, como el CRON... La sección de
// "Pagos" en el CRM, la sección de "Cursos", la sección de "Información del Lead", "Tracking",
// "Plan", "Llamadas", etc». Y el punto 4: «Elimina lo de "Eventos" (del CRON), todo eso debería ir
// dentro del editable del CONDICIONAL».
//
// Módulo PURO y sin `server-only`: lo leen el editor (app/automations/EditorCondicion.tsx), el modelo
// (`cumpleFila`, `validarGrafo` y `textoFila` de lib/flujo-grafo.ts), el saneo de lo que se guarda
// (lib/nutricion-grafo-motor.ts) y el motor, que lee en batch SÓLO las fuentes que piden las
// condiciones del flujo (`fuentesDeFilas` → `hechosDeLeads`, lib/nutricion.ts). Una condición vive
// acá UNA vez: su id, su sección, su ámbito, cómo se dice, qué valor lleva, de qué dato sale y cómo
// se evalúa.
//
// ── LAS REGLAS ───────────────────────────────────────────────────────────────────
//   · CADA CONDICIÓN TIENE SU LECTOR, O NO ESTÁ. Una condición que el motor no puede evaluar es
//     una mentira de pantalla: la rama se elige y nadie la decide. `fuentes` dice qué lee el motor
//     y `evaluar` lo decide; tests/condiciones-catalogo.test.ts falla si una entrada nueva no tiene
//     las dos (salvo las nueve de antes, que decide el `switch` de `cumpleFila`).
//   · «NO SÉ» NO ES «NO». `evaluar` devuelve `null` cuando el dato no existe (un lead sin visitante
//     no «no reprodujo el VSL»: no se sabe). Una fila con `null` NO SE CUMPLE, NI NEGADA — la misma
//     regla que un campo desconocido. Si no, «No asistió a la R1» saldría para todo el que todavía
//     no tuvo la reunión.
//   · LOS ID SON ESTABLES. Se guardan en `nutricion_secuencias.pasos`; renombrar uno deja a las
//     filas guardadas como «condición desconocida». El rótulo se cambia libre; el id, nunca.
//   · GENÉRICO. Nada armado para un cliente: la confirmación antes de la reunión de Mauricio es
//     «Próxima reunión en ≤ 24 h» (desde la cuarta tanda, con la etapa de su primera llamada); el
//     no-show de Código Inmobiliario es «No asistió a la reunión» sobre su etapa de auditoría;
//     «experiencia en el rubro» es «Respuesta del formulario contiene …».
//
// ── LO QUE QUEDÓ AFUERA, Y POR QUÉ (medido el 09/10/2026 contra producción) ──────────
//   · «Plan»: la única unión exacta tarea→lead es `cliente_lead_id`, puesta en 6 de 776 tareas; el
//     resto se ata por nombre (`tableroDeLaCartera`, Customer Success). Una condición «tiene tareas
//     abiertas» diría «no» sobre clientes llenos de tareas.
//   · «Reagendó» y «Confirmó la asistencia»: no hay ningún campo que lo registre (`fecha_confirmacion`
//     es la confirmación de COMPRA, no de asistencia: ver `confirmado_sin_pago` en lib/nutricion.ts).
//   · «Último mensaje hace N h»: sale de `wa_mensajes` (50.903 filas) y no hay una lectura por lote
//     que no traiga todo el historial de cada lead.
//
// ── CUARTA TANDA (09/10/2026): LA REUNIÓN SIN «R1» NI «R2», Y LA CUOTA N ─────────────
//   · Punto 5: «no tiene sentido diferenciar "R1" de "R2"... Hay negocios que solo tienen 1 llamada
//     y otros que tienen más de 2... Sería bueno que simplemente diga "No asistió a la reunión" y que
//     dentro del editable de esa sección se elija 1 o más reuniones de las etapas del kanban». Las
//     reuniones son UNA familia (`reuniones: true`): la fila guarda las ETAPAS elegidas
//     (`FilaCondicion.reuniones`, `${funnelId}:${key}`) y el motor las lleva a su lugar en la ficha
//     POR ORDEN (`reunionesDe` + `slotPorIndice`, lib/funnel-etapas.ts), nunca por el nombre. La
//     tabla `leads` tiene DOS lugares: una tercera reunión no tiene dato y da «no sé». Las de antes
//     con R1 / R2 en el nombre quedan `retirada` (siguen evaluando lo guardado).
//   · Punto 6: «que dentro de esa opción se pueda seleccionar "No pagó X cuota" la primera por
//     ejemplo». «Pagó / No pagó» suma la cuota (`valor`, vacío = como siempre): la cuota N es la fila
//     de `pagos` con `numero` N, la misma que el CRM dibuja como «Cuota N» (lib/pagos.ts la escribe).
//
// ── SEXTA TANDA (09/10/2026, noche) ───────────────────────────────────────────────────
//   · Punto 12 de «General»: «Reply ya te dije que tiene que estar dentro de CONDITION». La familia
//     «Respuesta» («Su respuesta trata de…») es la de la condición que escucha las respuestas (el
//     nodo `respuesta` de siempre: sus filas son sus casos). Se decide cuando el lead ESCRIBE, con el
//     clasificador de siempre (`responderConGrafo`), no cuando la salida pasa: por eso no se ofrece en
//     una condición de la salida (`evento`) y su `evaluar` dice «no sé».
//   · Punto 1 de «CONDITION»: «primero selecciono el módulo y ahí me aparecen las clases de ese
//     módulo... Esto para TODO». Los catálogos con jerarquía se ofrecen como un ÁRBOL
//     (`arbolDeOpciones`): curso → módulo → clase, producto → etapa, embudo → reunión.
//
// ── DUODÉCIMA TANDA (12/10/2026): INSTAGRAM Y MESSENGER ───────────────────────────────
//   · «Tiene Instagram / Messenger» = tenemos SU CONVERSACIÓN por ese canal (una fila en
//     `ig_conversaciones`), no «tiene cuenta»: de quien nunca nos escribió ni comentó no se sabe nada.
//   · «Se le puede escribir por …» es `decidirSalida(...).via !== null` (lib/canal-social.ts), la MISMA
//     función con la que el motor decide si el DM sale, sobre la MISMA fila (`conversacionQueCuenta`).
//   · «Te sigue en Instagram» se consulta EN VIVO a Zernio (sin migración), y sólo por quien escribió por
//     DM: Meta no contesta por nadie más. Todo lo demás es «no sé» (`null`), que no se cumple ni negado:
//     quien sólo comentó cae en la rama «si no», y es una regla de Meta, no una falla.
// =============================================================================

import type { FilaCondicion, HechosLead } from './flujo-grafo';
// Puro y compartido (lo importa también app/crm/CrmBoard.tsx): el mapeo índice → lugar de la ficha
// vive ahí UNA vez (tests/reunion-slot-fuente-unica.test.ts).
import { slotPorIndice } from './funnel-etapas';
// Puro: la regla de «¿le sale el DM?» es la del envío (lib/canal-zernio.ts), no una copia.
import { decidirSalida, type CanalSocial, type ConversacionSocial } from './canal-social';
// Puros los dos: la condición de un DATO DEL EVENTO se arma de su variable (16/10/2026).
import { campoDeDato, cumpleDato, datoDeCampo } from './dato-evento';
import { datoDe } from './variables-aviso';

// ── Tipos ─────────────────────────────────────────────────────────────────────────

/** De qué lado del negocio es una condición. 'ambos' = se ofrece con cualquier CRON. */
export type AmbitoCondicion = 'adquisicion' | 'entrega' | 'ambos';
/** De qué lado es el CRON de la automatización (`ambitoDeDisparo`). */
export type AmbitoDisparo = 'adquisicion' | 'entrega';

export type SeccionCondicion =
  | 'Información del lead' | 'Origen y tracking' | 'Etapa y pipeline' | 'Agenda y llamadas' | 'Pagos'
  | 'Mensajes' | 'Instagram y Messenger' | 'Etiquetas'
  | 'Curso y avance' | 'Comunidad' | 'Tareas del curso' | 'Pagos del cliente' | 'Etapa de entrega'
  | 'Respuesta' | 'Datos del evento';

/** La sección de la condición que escucha las respuestas (sexta tanda). No está en `SECCIONES`: no es de la salida. */
export const SECCION_RESPUESTA: SeccionCondicion = 'Respuesta';
/** La sección de los DATOS DEL EVENTO (16/10/2026, lib/dato-evento.ts): sólo en una fila de evento, y primera. */
export const SECCION_DATOS: SeccionCondicion = 'Datos del evento';

/** El orden de las secciones en el desplegable, por ámbito. */
export const SECCIONES: Record<AmbitoDisparo, readonly SeccionCondicion[]> = {
  adquisicion: ['Información del lead', 'Origen y tracking', 'Etapa y pipeline', 'Agenda y llamadas', 'Pagos', 'Mensajes', 'Instagram y Messenger', 'Etiquetas'],
  entrega: ['Curso y avance', 'Comunidad', 'Tareas del curso', 'Pagos del cliente', 'Etapa de entrega', 'Mensajes', 'Instagram y Messenger', 'Etiquetas', 'Información del lead'],
};

/**
 * De dónde saca el motor el dato. Cada una es UNA lectura por lote (`hechosDeLeads`): pedir una
 * fuente que ninguna condición del flujo usa es leer de más; no pedirla es decidir sin el dato.
 */
export type Fuente =
  | 'lead'        // la fila de `leads` (siempre se lee: es la que arma el resto)
  | 'etiquetas'   // crm_lead_etiquetas (menos las archivadas)
  | 'productos'   // lead_funnel + la casa (la etapa por producto)
  | 'contacto'    // leadsYaContactados
  | 'respondio'   // wa_mensajes entrantes + inscripciones que pausaron por respuesta
  | 'vsl'         // getVslEngagementMap (plays y % máximo del VSL)
  | 'clics'       // vsl_events con tipo 'click'
  | 'respuestas'  // lead_respuestas + las columnas respuesta_* + meta_field_data
  | 'pagos'       // pagos (cuotas)
  | 'curso'       // curso_progreso (el efectivo) + curso_clases
  | 'acceso'      // curso_accesos (el portal)
  | 'comunidad'   // comunidad_posts (sin los hilos de clase) + comunidad_comentarios
  | 'entrega'     // la etapa del kanban de entrega (`clientesEnEtapaDeEntrega`)
  | 'cs'          // cs_clientes.estado
  | 'reuniones'   // el ORDEN de las reuniones de los embudos que nombran las filas (`reunionesDe`)
  | 'social'      // ig_conversaciones: la conversación que cuenta, por lead y canal (`conversacionesDeLeads`)
  | 'sigue';      // «¿te sigue?» EN VIVO a Zernio, sólo por quien escribió por DM (`siguenEnInstagram`)

/** Los catálogos de los que sale el valor de una condición de lista. */
export type CatalogoValor =
  | 'etiqueta' | 'etapa' | 'producto' | 'campana'
  | 'origen' | 'estado_lead' | 'estado_cliente'
  | 'curso' | 'modulo' | 'clase' | 'clase_tarea' | 'post' | 'etapa_entrega'
  | 'reunion';

export type TipoValor =
  | { t: 'ninguno' }
  /** Un número con su operador (≥ / ≤). `unidad` va pegada al número en la tarjeta. */
  | { t: 'numero'; unidad: string; def: number; min: number; max: number; ref?: CatalogoValor }
  /** Un elemento de un catálogo. */
  | { t: 'lista'; catalogo: CatalogoValor }
  /** Un texto libre (se busca sin mayúsculas ni tildes). */
  | { t: 'texto' }
  /** Una de una lista FIJA que trae la condición (16/10/2026: el dato de un evento, `VariableAviso.condicion`). */
  | { t: 'opciones'; opciones: ReadonlyArray<{ value: string; label: string }> }
  /** Las nueve de antes: su valor lo dibuja el editor como siempre (etiqueta, etapa, horas). */
  | { t: 'legado' };

export type OperadorCondicion = 'mayor_igual' | 'menor_igual';
export const OPERADORES: readonly OperadorCondicion[] = ['mayor_igual', 'menor_igual'];
export const SIMBOLO_OP: Record<OperadorCondicion, string> = { mayor_igual: '≥', menor_igual: '≤' };

export type DefCondicion = {
  id: string;
  /**
   * RETIRADA: no se ofrece más, y el motor la sigue evaluando para los flujos que ya la tienen (cuarta
   * tanda, punto 6: «hay otras CONDITION que no entiendo como lo vas a saber detectar... "Confirmó la
   * compra y no pagó" ¿Cómo se sabe ese dato?, no hay nada así en el CRM»).
   */
  retirada?: true;
  seccion: SeccionCondicion;
  /** La sección con un CRON de entrega, si cambia (los pagos son «Pagos del cliente»). */
  seccionEntrega?: SeccionCondicion;
  ambito: AmbitoCondicion;
  /**
   * Se puede ACOTAR a una o más etapas de reunión del kanban (`FilaCondicion.reuniones`; vacío =
   * cualquiera). El editor dibuja el selector y el motor lee el orden de esos embudos (`reuniones`).
   */
  reuniones?: true;
  /**
   * SEXTA TANDA: se decide cuando el lead ESCRIBE (la condición que escucha las respuestas), no cuando
   * la salida pasa por la tarjeta. No se ofrece en una condición de la salida (`seOfrece`) y su
   * `evaluar` dice «no sé»: en la salida el lead no respondió (una respuesta la pausa).
   */
  evento?: 'respuesta';
  /** [afirmativa, negada]. Una frase técnica y corta: es lo que se DIBUJA. */
  rotulo: readonly [string, string];
  /** ¿Se ofrece negada? Un número no (el operador ya dice ≥ o ≤) ni un compuesto. */
  negable: boolean;
  valor: TipoValor;
  fuentes: readonly Fuente[];
  /**
   * true / false, o `null` = el dato no se sabe (no se cumple, ni negada). Ausente SÓLO en las
   * nueve de antes (`legado`): ésas las decide el `switch` de `cumpleFila` (lib/flujo-grafo.ts).
   */
  evaluar?: (f: FilaCondicion, h: HechosLead) => boolean | null;
};

/**
 * Lo que el motor sabe del lead para las condiciones del catálogo (`HechosLead.catalogo`). Cada
 * bloque lo llena SU lector, y sólo si una condición del flujo lo pide: ausente = no se leyó, y
 * la condición que lo necesita devuelve `null`. Datos planos: el cálculo vive en el motor.
 */
export type HechosCatalogo = {
  lead?: {
    origen: string | null;
    estado: string | null;
    /** true / false / null (no se calificó todavía). */
    calificado: boolean | null;
    deFormularioMeta: boolean;
    conVisitante: boolean;
    campana: string | null;
    emailBaja: boolean;
    ventaTipo: string | null;
    tieneFechaAgenda: boolean;
    /**
     * Las dos reuniones de la ficha. `fechaMs` null también si se CANCELÓ (Martín, 14/10/2026: «Cancelada = no agendó»).
     * `finMs`: hasta cuándo «todavía no pasó» (la hora; una fecha sola, el final de su día: `finDeLaReunionMs`).
     */
    r1: { fechaMs: number | null; asistio: boolean | null; finMs?: number | null };
    r2: { fechaMs: number | null; asistio: boolean | null; finMs?: number | null };
    cerro: boolean | null;
    tieneFechaCierre: boolean;
    confirmoCompra: boolean;
    /** La próxima reunión FUTURA (`reunionFuturaMs`), o null. */
    proximaReunionMs: number | null;
  };
  /** null = el lead no tiene visitante (nunca se lo pudo seguir en la landing). */
  vsl?: { plays: number; maxPct: number | null } | null;
  /** null = sin visitante. */
  clics?: number | null;
  /** Todas sus respuestas de formulario, en un texto normalizado (`normalizarTexto`). */
  respuestas?: string;
  /** `cuotas`: el estado de CADA cuota por su `numero` («No pagó la cuota N», `estadoDeCuotas`). */
  pagos?: { pagadas: number; vencidas: number; cuotas?: ReadonlyMap<number, EstadoCuota> };
  /**
   * funnelId → las keys de sus reuniones EN ORDEN (`reunionesDe(cfg.stages)`), sólo de los embudos que
   * nombran las filas (`embudosDeReunionDeFilas`). Es el mismo para todo el lote: es la config, no el
   * lead. Un embudo que falta (borrado) hace «no sé» a sus etapas.
   */
  reuniones?: ReadonlyMap<number, readonly string[]>;
  curso?: {
    completas: ReadonlySet<number>;
    enviadas: ReadonlySet<number>;
    aprobadas: ReadonlySet<number>;
    /** `${productoId}:${clave}` de cada módulo con TODAS sus clases completas. */
    modulosCompletos: ReadonlySet<string>;
    /** productoId → % de clases completas (redondeado). Sólo los productos con clases. */
    avance: ReadonlyMap<number, number>;
  };
  /** null = nunca tuvo acceso al portal. */
  acceso?: { ingresos: number; ultimoMs: number | null } | null;
  comunidad?: { posts: number; comentarios: number; comentoPosts: ReadonlySet<number> };
  /** `${productoId}:${etapa}` de las etapas de entrega en las que está (sólo las que pide el flujo). */
  entrega?: ReadonlySet<string>;
  /** Sin fila en cs_clientes = 'activo'. */
  estadoCliente?: string;
  /**
   * La conversación que cuenta en cada canal (`conversacionQueCuenta`). Leída, los DOS canales están:
   * `null` = no tenemos conversación por ahí. El bloque ausente = no se leyó (todo «no sé»).
   */
  social?: Partial<Record<CanalSocial, ConversacionSocial | null>>;
  /** «¿Te sigue en Instagram?»: true / false sólo si Meta lo confirmó; `null` = no sé. Ausente = no se leyó. */
  sigueInstagram?: boolean | null;
};

// ── Ayudas de evaluación ──────────────────────────────────────────────────────────

const L = (h: HechosLead) => h.catalogo?.lead;
const tri = (x: boolean | null | undefined): boolean | null => (x == null ? null : x);
const num = (f: FilaCondicion): number | null => {
  const n = Number(f.valor);
  return f.valor == null || f.valor === '' || !Number.isFinite(n) ? null : n;
};
/** La fila numérica contra un dato. `null` (sin dato, sin número u operador roto) no se cumple. */
function compara(f: FilaCondicion, dato: number | null | undefined): boolean | null {
  const n = num(f);
  if (dato == null || n == null) return null;
  if (f.op === 'menor_igual') return dato <= n;
  if (f.op === 'mayor_igual' || f.op == null) return dato >= n;
  return null;
}
const agendoDe = (l: NonNullable<HechosCatalogo['lead']>) => l.r1.fechaMs != null || l.r2.fechaMs != null || l.tieneFechaAgenda;

// ── Las reuniones (cuarta tanda, punto 5) ─────────────────────────────────────────

/** Lo que la ficha sabe de UNA reunión: uno de sus dos lugares (`r1` / `r2` del bloque `lead`). */
type LugarReunion = { fechaMs: number | null; asistio: boolean | null; finMs?: number | null };

/** Cuántas etapas de reunión se guardan por fila: más que esto es un dato roto, no una elección. */
export const TOPE_REUNIONES = 12;

/** Las etapas de reunión de una fila, separadas y sin repetidos: `${funnelId}:${key}` → { funnelId, key }. */
export function reunionesDeFila(f: Pick<FilaCondicion, 'reuniones'>): Array<{ funnelId: number; key: string }> {
  const out: Array<{ funnelId: number; key: string }> = [];
  const vistos = new Set<string>();
  for (const x of Array.isArray(f.reuniones) ? f.reuniones : []) {
    if (typeof x !== 'string' || vistos.has(x)) continue;
    const i = x.indexOf(':');
    const funnelId = Number(x.slice(0, i));
    const key = x.slice(i + 1);
    if (i <= 0 || !Number.isInteger(funnelId) || funnelId <= 0 || !key) continue;
    vistos.add(x);
    out.push({ funnelId, key });
  }
  return out;
}

/**
 * LOS LUGARES DE LA FICHA de las reuniones que la fila nombra. Sin etapas elegidas: los dos (cualquier
 * reunión). Con etapas: cada una va a su lugar POR ORDEN dentro de SU embudo (`reunionesDe` →
 * `indexOf` → `slotPorIndice`), nunca por el nombre — el CRM puede marcar otra reunión antes y correr
 * todo un lugar (lib/etapa-reunion.ts). Y sólo si el lead está en ese embudo: la ficha tiene UN par de
 * lugares para todos sus productos, y la primera reunión de otro producto no es la de éste. Una etapa
 * que dejó de ser reunión, la tercera en adelante o un embudo que no se leyó no aportan nada.
 * `null` = no se sabe de ninguna (la fila no se cumple, ni negada).
 */
export function lugaresDeFila(f: FilaCondicion, h: HechosLead): LugarReunion[] | null {
  const l = L(h);
  if (!l) return null;
  const elegidas = reunionesDeFila(f);
  if (!elegidas.length) return [l.r1, l.r2];
  const orden = h.catalogo?.reuniones;
  if (!orden) return null;
  const out: LugarReunion[] = [];
  const usados = new Set<number>();
  for (const { funnelId, key } of elegidas) {
    if (!h.etapasPorProducto?.has(funnelId)) continue;
    const slot = slotPorIndice(orden.get(funnelId)?.indexOf(key) ?? -1);
    if (!slot || usados.has(slot.indice)) continue;
    usados.add(slot.indice);
    out.push(slot.indice === 0 ? l.r1 : l.r2);
  }
  return out.length ? out : null;
}

/**
 * «Asistió a la reunión»: fue, y no faltó a ninguna de las elegidas. UNA NO-ASISTENCIA REGISTRADA MANDA:
 * «No asistió» (la negación) se cumple si faltó a CUALQUIERA de ellas, que es lo que pide un «reagendar».
 * Sin asistencia registrada en ninguna, «no sé»: un no-show exige la asistencia en false, no la falta de
 * reunión (el hallazgo de la tercera tanda sobre «No asistió a la R1» negado).
 */
function asistioA(f: FilaCondicion, h: HechosLead): boolean | null {
  const s = lugaresDeFila(f, h);
  if (!s) return null;
  if (s.some((x) => x.asistio === false)) return false;
  return s.some((x) => x.asistio === true) ? true : null;
}

/** «Tiene reunión agendada»: alguna de las elegidas tiene fecha (pasada o futura, como «Tiene R2 agendada»). */
function agendadaEn(f: FilaCondicion, h: HechosLead): boolean | null {
  const s = lugaresDeFila(f, h);
  return s ? s.some((x) => x.fechaMs != null) : null;
}

/** La próxima reunión FUTURA de las elegidas; sin etapas, la de siempre (`proximaReunionMs`). */
function proximaEntre(f: FilaCondicion, h: HechosLead): number | null {
  const l = L(h);
  if (!l) return null;
  if (!reunionesDeFila(f).length) return l.proximaReunionMs;
  const s = lugaresDeFila(f, h);
  if (!s) return null;
  // `> ahora`: la misma regla que `reunionFuturaMs` (lib/nutricion-reinscripcion.ts).
  const fut = s.map((x) => x.fechaMs).filter((ms): ms is number => ms != null && ms > h.ahoraMs);
  return fut.length ? Math.min(...fut) : null;
}

/**
 * «SU REUNIÓN SIGUE EN PIE» (14/10/2026): alguna de las elegidas (sin etapas, la R1 o la R2) no se canceló, no tiene
 * la asistencia marcada y todavía no pasó (`finMs`: la hora, o el final del día de una fecha sola). Es la pregunta que
 * hacía escondida el motor antes de cada mensaje de un flujo de reunión («la reunión ya pasó», `laReunionYaPaso`):
 * Martín, 14/10/2026: «Debería justamente existir una CONDITION en el flujo que pueda pausar en el envio si se canceló o
 * ya pasó la reunión». Sin datos del lead, «no sé».
 */
function enPieEntre(f: FilaCondicion, h: HechosLead): boolean | null {
  const s = lugaresDeFila(f, h);
  if (!s) return null;
  return s.some((x) => x.fechaMs != null && x.asistio == null && x.finMs != null && x.finMs > h.ahoraMs);
}

/** Los embudos que nombran las filas con etapas de reunión: la fuente `reuniones` lee sólo ésos. */
export function embudosDeReunionDeFilas(filas: readonly FilaCondicion[]): number[] {
  const s = new Set<number>();
  for (const f of filas) {
    if (!condicionPorId(f.campo)?.reuniones) continue;
    for (const r of reunionesDeFila(f)) s.add(r.funnelId);
  }
  return [...s];
}

// ── Las cuotas (cuarta tanda, punto 6) ────────────────────────────────────────────

/** Una cuota en el día del negocio. Vencida = impaga con fecha esperada ANTES de hoy (`resumenPagos`). */
export type EstadoCuota = 'pagada' | 'vencida' | 'pendiente';

/** La cuota más alta que se puede pedir: más que esto es un dato roto (el plan del CRM son meses). */
export const TOPE_CUOTA = 60;

/** La cuota N de una fila «Pagó / No pagó» (`valor`). null = sin cuota, o una que no es un número válido. */
export function cuotaDeFila(f: Pick<FilaCondicion, 'valor'>): number | null {
  if (f.valor == null || f.valor === '') return null;
  const n = Number(f.valor);
  return Number.isInteger(n) && n >= 1 && n <= TOPE_CUOTA ? n : null;
}

/**
 * El estado de CADA cuota del lead por su `numero` (la fila de `pagos` que el CRM dibuja «Cuota N»).
 * La regla de vencida es la de `resumenPagos` (lib/nutricion-grafo-motor.ts), y un test compara las dos:
 * sin fecha esperada nunca se declara vencida (la regla de lib/cs-senal.ts).
 */
export function estadoDeCuotas(
  cuotas: ReadonlyArray<{ numero: number | string | null; pagado: boolean | null; fecha_esperada: string | null }>,
  hoy: string,
): Map<number, EstadoCuota> {
  const m = new Map<number, EstadoCuota>();
  for (const c of cuotas) {
    const n = Number(c.numero);
    if (c.numero == null || !Number.isInteger(n) || n < 0) continue;
    m.set(n, c.pagado === true ? 'pagada' : c.fecha_esperada && c.fecha_esperada.slice(0, 10) < hoy ? 'vencida' : 'pendiente');
  }
  return m;
}

/**
 * «Pagó / No pagó», con la cuota N si la fila la trae. Sin cuota, lo de siempre (`h.pago`: alguna vez
 * pagó). Con cuota: pagada = «pagó»; vencida e impaga = «no pagó»; y lo demás —no existe, todavía no
 * venció, no tiene fecha, o la cuota no es un número— es «no sé»: avisarle a alguien que «no pagó la
 * cuota 2» antes de que venza es afirmar algo que el CRM no registró.
 */
export function pagoDeFila(f: FilaCondicion, h: HechosLead): boolean | null {
  if (f.valor == null || f.valor === '') return h.pago;
  const n = cuotaDeFila(f);
  if (n == null) return null;
  const e = h.catalogo?.pagos?.cuotas?.get(n);
  return e === 'pagada' ? true : e === 'vencida' ? false : null;
}

/** Minúsculas y sin tildes: «Experiencia» encuentra «experiencia» y «EXPERIÉNCIA». */
export function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const UMBRAL_VSL = 50;   // el mismo que `UMBRAL_VSL_PCT` (lib/nutricion.ts): «vio el VSL»

/** «Tiene Instagram / Messenger»: hay una conversación suya por ese canal. Sin la fuente leída, «no sé». */
function tieneConversacion(h: HechosLead, canal: CanalSocial): boolean | null {
  const s = h.catalogo?.social;
  return s ? s[canal] != null : null;
}

/**
 * «Se le puede escribir por …»: la MISMA pregunta que hace el envío antes de mandar un DM
 * (`decidirSalida`, lib/canal-zernio.ts), ahora. Sin conversación es «no» (no hay por dónde), no «no sé».
 */
function puedeEscribirle(h: HechosLead, canal: CanalSocial): boolean | null {
  const s = h.catalogo?.social;
  return s ? decidirSalida(s[canal] ?? null, h.ahoraMs, canal).via !== null : null;
}

// ── EL CATÁLOGO ───────────────────────────────────────────────────────────────────

const LEGADO = { t: 'legado' } as const;
const NINGUNO = { t: 'ninguno' } as const;

export const CONDICIONES: readonly DefCondicion[] = [
  // ── Información del lead ──
  { id: 'tiene_telefono', seccion: 'Información del lead', ambito: 'ambos', rotulo: ['Tiene WhatsApp', 'Sin WhatsApp'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  { id: 'tiene_email', seccion: 'Información del lead', ambito: 'ambos', rotulo: ['Tiene email', 'Sin email'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  // Duodécima tanda: tenemos su conversación por ese canal (una fila de `ig_conversaciones`).
  {
    id: 'tiene_instagram', seccion: 'Información del lead', ambito: 'ambos', rotulo: ['Tiene Instagram', 'Sin Instagram'], negable: true, valor: NINGUNO, fuentes: ['social'],
    evaluar: (_f, h) => tieneConversacion(h, 'instagram'),
  },
  {
    id: 'tiene_messenger', seccion: 'Información del lead', ambito: 'ambos', rotulo: ['Tiene Messenger', 'Sin Messenger'], negable: true, valor: NINGUNO, fuentes: ['social'],
    evaluar: (_f, h) => tieneConversacion(h, 'messenger'),
  },
  {
    id: 'email_baja', seccion: 'Información del lead', ambito: 'ambos', rotulo: ['Dado de baja del email', 'Recibe email'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => (L(h) ? L(h)!.emailBaja : null),
  },
  { id: 'antiguedad', seccion: 'Información del lead', ambito: 'adquisicion', rotulo: ['Llegó hace menos de', 'Llegó hace más de'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  {
    id: 'estado_lead', seccion: 'Información del lead', ambito: 'adquisicion', rotulo: ['Estado del lead', 'Estado del lead no es'], negable: true, valor: { t: 'lista', catalogo: 'estado_lead' }, fuentes: ['lead'],
    evaluar: (f, h) => (L(h)?.estado ? L(h)!.estado === String(f.valor) : null),
  },
  {
    id: 'respuesta_contiene', seccion: 'Información del lead', ambito: 'adquisicion', rotulo: ['Respuesta del formulario contiene', 'Ninguna respuesta contiene'], negable: true, valor: { t: 'texto' }, fuentes: ['respuestas'],
    evaluar: (f, h) => {
      const r = h.catalogo?.respuestas;
      const buscado = normalizarTexto(String(f.valor ?? ''));
      if (r == null || !buscado) return null;
      // Sin ninguna respuesta no hay qué buscar: «no contiene» sería afirmar sobre un formulario vacío.
      if (!r) return null;
      return r.includes(buscado);
    },
  },

  // ── Origen y tracking ──
  {
    id: 'origen', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Origen', 'Origen no es'], negable: true, valor: { t: 'lista', catalogo: 'origen' }, fuentes: ['lead'],
    evaluar: (f, h) => {
      const o = L(h)?.origen;
      if (!o) return null;
      // «Carga manual» son dos valores en la base (`manual` y `carga_manual`).
      const norm = (x: string) => (x === 'carga_manual' ? 'manual' : x);
      return norm(o) === norm(String(f.valor));
    },
  },
  {
    id: 'campana_meta', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Campaña de Meta', 'Campaña de Meta no es'], negable: true, valor: { t: 'lista', catalogo: 'campana' }, fuentes: ['lead'],
    evaluar: (f, h) => {
      const c = L(h)?.campana;
      return c ? c === String(f.valor) : null;
    },
  },
  {
    id: 'form_sin_agenda', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Dejó el formulario sin agendar', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const l = L(h); return l ? l.deFormularioMeta && !agendoDe(l) : null; },
  },
  {
    id: 'visito_landing', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Visitó la landing', 'No visitó la landing'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => (L(h) ? L(h)!.conVisitante : null),
  },
  {
    id: 'reprodujo_vsl', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Reprodujo el VSL', 'No reprodujo el VSL'], negable: true, valor: NINGUNO, fuentes: ['vsl'],
    evaluar: (_f, h) => { const v = h.catalogo?.vsl; return v == null ? null : v.plays > 0 || (v.maxPct ?? 0) > 0; },
  },
  {
    id: 'vsl_pct', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['VSL visto', 'VSL visto'], negable: false, valor: { t: 'numero', unidad: ' %', def: UMBRAL_VSL, min: 1, max: 100 }, fuentes: ['vsl'],
    // Con visitante y sin avance medido, 0: es la regla de las cohortes de antes (`?? 0`).
    evaluar: (f, h) => { const v = h.catalogo?.vsl; return v == null ? null : compara(f, v.maxPct ?? 0); },
  },
  {
    id: 'vsl_sin_agendar', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Vio el VSL y no agendó', ''], negable: false, valor: NINGUNO, fuentes: ['vsl', 'lead'],
    evaluar: (_f, h) => { const v = h.catalogo?.vsl; const l = L(h); return v == null || !l ? null : (v.maxPct ?? 0) >= UMBRAL_VSL && !agendoDe(l); },
  },
  {
    id: 'vsl_poco', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Vio poco del VSL y no agendó', ''], negable: false, valor: NINGUNO, fuentes: ['vsl', 'lead'],
    evaluar: (_f, h) => { const v = h.catalogo?.vsl; const l = L(h); return v == null || !l ? null : (v.maxPct ?? 0) < UMBRAL_VSL && !agendoDe(l); },
  },
  {
    id: 'hizo_clic', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Hizo clic en la landing', 'Sin clics en la landing'], negable: true, valor: NINGUNO, fuentes: ['clics'],
    evaluar: (_f, h) => { const c = h.catalogo?.clics; return c == null ? null : c > 0; },
  },

  // ── Etapa y pipeline ──
  { id: 'etapa', seccion: 'Etapa y pipeline', ambito: 'adquisicion', rotulo: ['Está en la etapa', 'No está en la etapa'], negable: true, valor: LEGADO, fuentes: ['lead', 'productos'] },
  // «SIGUE EN LA ETAPA DEL CRON» (12/10/2026, los plazos de etapa como plantilla): la etapa la dice el CRON de la
  // automatización, no la fila, así que cambiar el CRON no deja la condición vieja. Ver `sigueEnEtapaDelCron`.
  {
    id: 'sigue_en_etapa_cron', seccion: 'Etapa y pipeline', seccionEntrega: 'Etapa de entrega', ambito: 'ambos',
    rotulo: ['Sigue en la etapa del CRON', 'Ya no está en la etapa del CRON'], negable: true, valor: NINGUNO, fuentes: ['lead', 'productos', 'entrega'],
    evaluar: (_f, h) => sigueEnEtapaDelCron(h),
  },
  {
    id: 'en_producto', seccion: 'Etapa y pipeline', ambito: 'adquisicion', rotulo: ['Está en el funnel de', 'No está en el funnel de'], negable: true, valor: { t: 'lista', catalogo: 'producto' }, fuentes: ['lead', 'productos'],
    evaluar: (f, h) => { const id = num(f); return id == null || !h.etapasPorProducto ? null : h.etapasPorProducto.has(id); },
  },

  // ── Agenda y llamadas ──
  { id: 'agendo', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Agendó', 'No agendó'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  // La familia de la REUNIÓN (cuarta tanda, punto 5): una pregunta, acotada a las etapas de reunión
  // que se elijan (vacío = cualquiera). Las fuentes `productos` y `reuniones` las suma la fila que
  // elige etapas (`fuentesDeFilas`): sin etapas no hace falta leer ningún embudo.
  {
    id: 'reunion_agendada', reuniones: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Tiene reunión agendada', 'Sin reunión agendada'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: agendadaEn,
  },
  {
    id: 'asistio_reunion', reuniones: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Asistió a la reunión', 'No asistió a la reunión'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: asistioA,
  },
  {
    id: 'reunion_en', reuniones: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Próxima reunión en', 'Próxima reunión en'], negable: false, valor: { t: 'numero', unidad: ' h', def: 24, min: 1, max: 720 }, fuentes: ['lead'],
    evaluar: (f, h) => { const r = proximaEntre(f, h); return r == null ? null : compara(f, (r - h.ahoraMs) / 3_600_000); },
  },
  {
    id: 'reunion_en_pie', reuniones: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Su reunión sigue en pie', 'Su reunión ya pasó o se canceló'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: enPieEntre,
  },
  // ⚠️ LAS DE «R1» / «R2» QUEDAN RETIRADAS (cuarta tanda, punto 5: «no tiene sentido diferenciar "R1"
  // de "R2"»). Se siguen evaluando para los flujos que ya las tienen; para lo nuevo están la familia de
  // arriba y las de siempre («Calificado», «Estado del lead»).
  {
    id: 'r1_pendiente', retirada: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['R1 agendada a futuro', 'Sin R1 a futuro'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    // La regla de «Agendó pero no confirmó» (`agendado_sin_confirmar`): la R1 por delante y sin
    // asistencia registrada. No hay un campo «confirmó»: no se inventa. «A futuro» con 12 h de
    // gracia: una R1 de sólo fecha se lee al mediodía de México (`parseFechaJunta`) y la de HOY
    // tiene que contar todo el día, como el `>= hoy` de la cohorte.
    evaluar: (_f, h) => { const l = L(h); return l ? l.r1.fechaMs != null && l.r1.fechaMs >= h.ahoraMs - 12 * 3_600_000 && l.r1.asistio == null : null; },
  },
  {
    id: 'asistio_r1', retirada: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Asistió a la R1', 'No asistió a la R1'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => tri(L(h)?.r1.asistio),
  },
  {
    id: 'agendo_r2', retirada: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Tiene R2 agendada', 'Sin R2 agendada'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => (L(h) ? L(h)!.r2.fechaMs != null : null),
  },
  {
    id: 'asistio_r2', retirada: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Asistió a la R2', 'No asistió a la R2'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => tri(L(h)?.r2.asistio),
  },
  {
    id: 'calificado', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Calificado', 'No calificado'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => tri(L(h)?.calificado),
  },
  {
    id: 'r1_sin_avanzar', retirada: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Asistió a la R1 y no avanza', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const l = L(h); return l ? l.r1.asistio === true && l.calificado == null && l.r2.fechaMs == null : null; },
  },
  {
    id: 'calificado_sin_r2', retirada: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Calificado sin R2', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const l = L(h); return l ? l.calificado === true && l.r2.fechaMs == null && l.r2.asistio == null : null; },
  },
  {
    id: 'r2_sin_cerrar', retirada: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Asistió a la R2 y no cerró', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const l = L(h); return l ? l.r2.asistio === true && l.cerro == null && !l.tieneFechaCierre : null; },
  },

  // ── Pagos ──
  { id: 'pago', seccion: 'Pagos', ambito: 'adquisicion', rotulo: ['Pagó', 'No pagó'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  {
    id: 'confirmo_sin_pago', retirada: true, seccion: 'Pagos', ambito: 'adquisicion', rotulo: ['Confirmó la compra y no pagó', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => (L(h) ? L(h)!.confirmoCompra && !h.pago : null),
  },
  {
    id: 'venta_suscripcion', seccion: 'Pagos', seccionEntrega: 'Pagos del cliente', ambito: 'ambos', rotulo: ['Venta por suscripción', 'Venta de pago único'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const t = L(h)?.ventaTipo; return t === 'suscripcion' ? true : t === 'unico' ? false : null; },
  },
  {
    id: 'cuotas_pagadas', seccion: 'Pagos', seccionEntrega: 'Pagos del cliente', ambito: 'ambos', rotulo: ['Cuotas pagadas', 'Cuotas pagadas'], negable: false, valor: { t: 'numero', unidad: '', def: 1, min: 0, max: 60 }, fuentes: ['pagos'],
    evaluar: (f, h) => compara(f, h.catalogo?.pagos?.pagadas),
  },
  {
    id: 'cuotas_vencidas', seccion: 'Pagos', seccionEntrega: 'Pagos del cliente', ambito: 'ambos', rotulo: ['Cuotas vencidas', 'Cuotas vencidas'], negable: false, valor: { t: 'numero', unidad: '', def: 1, min: 0, max: 60 }, fuentes: ['pagos'],
    evaluar: (f, h) => compara(f, h.catalogo?.pagos?.vencidas),
  },

  // ── Mensajes ──
  { id: 'ya_contactado', seccion: 'Mensajes', ambito: 'ambos', rotulo: ['Ya le escribiste', 'Nunca le escribiste'], negable: true, valor: LEGADO, fuentes: ['contacto'] },
  { id: 'respondio', seccion: 'Mensajes', ambito: 'ambos', rotulo: ['Te escribió alguna vez', 'Nunca te escribió'], negable: true, valor: LEGADO, fuentes: ['respondio'] },
  {
    // «SI EL LEAD CONTESTA» (14/10/2026). Era la pausa escondida del motor (cualquier mensaje del lead frenaba todo lo
    // que tenía por delante) y por unas horas fue una opción de cada flecha del CRON. Martín: «"Si el lead contesta" NO
    // debería ir en el CRON, debería ser una CONDITION». Se pone delante del mensaje que no tiene que salir si contestó
    // («¿Viste mi mensaje?»); el motor la vuelve a pasar antes de mandar (`condicionDeArriba`). Es de la INSCRIPCIÓN, no
    // del lead: `contestoEnEsta`, que pone quien evalúa. La fuente es la base (`lead`): no lee nada aparte.
    id: 'contesto', seccion: 'Mensajes', ambito: 'ambos', rotulo: ['Contestó desde que entró', 'No contestó desde que entró'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => tri(h.contestoEnEsta),
  },

  // ── Instagram y Messenger (duodécima tanda) ──
  {
    id: 'puede_escribir_instagram', seccion: 'Instagram y Messenger', ambito: 'ambos', rotulo: ['Se le puede escribir por Instagram', 'No se le puede escribir por Instagram'], negable: true, valor: NINGUNO, fuentes: ['social'],
    evaluar: (_f, h) => puedeEscribirle(h, 'instagram'),
  },
  {
    id: 'puede_escribir_messenger', seccion: 'Instagram y Messenger', ambito: 'ambos', rotulo: ['Se le puede escribir por Messenger', 'No se le puede escribir por Messenger'], negable: true, valor: NINGUNO, fuentes: ['social'],
    evaluar: (_f, h) => puedeEscribirle(h, 'messenger'),
  },
  {
    // `social` también: `sigue` consulta sólo a quien tiene conversación de Instagram, y ésa sale de ahí.
    id: 'sigue_instagram', seccion: 'Instagram y Messenger', ambito: 'ambos', rotulo: ['Te sigue en Instagram', 'No te sigue en Instagram'], negable: true, valor: NINGUNO, fuentes: ['social', 'sigue'],
    evaluar: (_f, h) => tri(h.catalogo?.sigueInstagram),
  },

  // ── Etiquetas ──
  { id: 'etiqueta', seccion: 'Etiquetas', ambito: 'ambos', rotulo: ['Tiene la etiqueta', 'No tiene la etiqueta'], negable: true, valor: LEGADO, fuentes: ['etiquetas'] },

  // ── Respuesta (sexta tanda) ──
  // La fila de la condición que escucha las respuestas: cada CASO es una («Su respuesta trata de
  // «Pregunta el precio»»), con su nombre y cuándo aplica, que es lo que lee el clasificador. Lo decide
  // `responderConGrafo` con `escenariosDeRespuesta` (lib/flujo-grafo.ts) en el momento en que el lead
  // escribe; la fuente es la de «Te escribió» (`respondio`) porque es la misma charla. En la salida no
  // se cumple nunca: ahí el texto de un caso no se evalúa contra nada.
  {
    id: 'respuesta_trata_de', evento: 'respuesta', seccion: 'Respuesta', ambito: 'ambos', rotulo: ['Su respuesta trata de', ''], negable: false, valor: { t: 'texto' }, fuentes: ['respondio'],
    evaluar: () => null,
  },

  // ── Curso y avance (entrega) ──
  {
    id: 'completo_clase', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Completó la clase', 'No completó la clase'], negable: true, valor: { t: 'lista', catalogo: 'clase' }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; const id = num(f); return !c || id == null ? null : c.completas.has(id); },
  },
  {
    id: 'completo_modulo', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Completó el módulo', 'No completó el módulo'], negable: true, valor: { t: 'lista', catalogo: 'modulo' }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; const k = String(f.valor ?? ''); return !c || !k ? null : c.modulosCompletos.has(k); },
  },
  {
    id: 'avance_curso', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Avance del curso', 'Avance del curso'], negable: false, valor: { t: 'numero', unidad: ' %', def: 50, min: 0, max: 100, ref: 'curso' }, fuentes: ['curso'],
    // El lector pone TODOS los cursos con clases (0 % si no completó nada): un curso que no está en
    // el mapa no tiene clases, y su avance no se sabe.
    evaluar: (f, h) => {
      const c = h.catalogo?.curso;
      const prod = Number(f.ref);
      if (!c || !(prod > 0)) return null;
      return compara(f, c.avance.get(prod) ?? null);
    },
  },
  {
    id: 'entro_portal', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Entró al portal del curso', 'Nunca entró al portal'], negable: true, valor: NINGUNO, fuentes: ['acceso'],
    // Sin acceso es un hecho (nunca se le dio el link): «nunca entró» es cierto, no «no sé».
    evaluar: (_f, h) => (h.catalogo?.acceso === undefined ? null : (h.catalogo.acceso?.ingresos ?? 0) > 0),
  },
  {
    id: 'dias_sin_entrar', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Días sin entrar al portal', 'Días sin entrar al portal'], negable: false, valor: { t: 'numero', unidad: ' días', def: 7, min: 1, max: 365 }, fuentes: ['acceso'],
    evaluar: (f, h) => { const u = h.catalogo?.acceso?.ultimoMs; return u == null ? null : compara(f, Math.floor((h.ahoraMs - u) / 86_400_000)); },
  },

  // ── Comunidad (entrega) ──
  {
    id: 'publico_comunidad', seccion: 'Comunidad', ambito: 'entrega', rotulo: ['Publicó en la comunidad', 'Nunca publicó en la comunidad'], negable: true, valor: NINGUNO, fuentes: ['comunidad'],
    evaluar: (_f, h) => { const c = h.catalogo?.comunidad; return c ? c.posts > 0 : null; },
  },
  {
    id: 'comento_comunidad', seccion: 'Comunidad', ambito: 'entrega', rotulo: ['Comentó en la comunidad', 'Nunca comentó en la comunidad'], negable: true, valor: NINGUNO, fuentes: ['comunidad'],
    evaluar: (_f, h) => { const c = h.catalogo?.comunidad; return c ? c.comentarios > 0 : null; },
  },
  {
    id: 'comento_post', seccion: 'Comunidad', ambito: 'entrega', rotulo: ['Comentó el post', 'No comentó el post'], negable: true, valor: { t: 'lista', catalogo: 'post' }, fuentes: ['comunidad'],
    evaluar: (f, h) => { const c = h.catalogo?.comunidad; const id = num(f); return !c || id == null ? null : c.comentoPosts.has(id); },
  },

  // ── Tareas del curso (entrega) ──
  {
    id: 'tareas_enviadas', seccion: 'Tareas del curso', ambito: 'entrega', rotulo: ['Tareas enviadas', 'Tareas enviadas'], negable: false, valor: { t: 'numero', unidad: '', def: 1, min: 0, max: 500 }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; return c ? compara(f, c.enviadas.size) : null; },
  },
  {
    id: 'envio_tarea', seccion: 'Tareas del curso', ambito: 'entrega', rotulo: ['Envió la tarea de', 'No envió la tarea de'], negable: true, valor: { t: 'lista', catalogo: 'clase_tarea' }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; const id = num(f); return !c || id == null ? null : c.enviadas.has(id); },
  },
  {
    id: 'tarea_aprobada', seccion: 'Tareas del curso', ambito: 'entrega', rotulo: ['Tarea aprobada de', 'Tarea sin aprobar de'], negable: true, valor: { t: 'lista', catalogo: 'clase_tarea' }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; const id = num(f); return !c || id == null ? null : c.aprobadas.has(id); },
  },

  // ── Etapa de entrega (entrega) ──
  {
    id: 'etapa_entrega', seccion: 'Etapa de entrega', ambito: 'entrega', rotulo: ['Está en la etapa de entrega', 'No está en la etapa de entrega'], negable: true, valor: { t: 'lista', catalogo: 'etapa_entrega' }, fuentes: ['entrega'],
    evaluar: (f, h) => { const e = h.catalogo?.entrega; const k = String(f.valor ?? ''); return !e || !k ? null : e.has(k); },
  },
  {
    id: 'estado_cliente', seccion: 'Etapa de entrega', ambito: 'entrega', rotulo: ['Estado del cliente', 'Estado del cliente no es'], negable: true, valor: { t: 'lista', catalogo: 'estado_cliente' }, fuentes: ['cs'],
    evaluar: (f, h) => { const e = h.catalogo?.estadoCliente; return e == null ? null : e === String(f.valor); },
  },
];

/** Los ids del catálogo (las nueve de antes incluidas). */
export const IDS_CONDICION: readonly string[] = CONDICIONES.map((c) => c.id);
const POR_ID: ReadonlyMap<string, DefCondicion> = new Map(CONDICIONES.map((c) => [c.id, c]));

export function condicionPorId(id: unknown): DefCondicion | null {
  if (typeof id !== 'string') return null;
  return POR_ID.get(id) ?? defDeDato(id);
}

/**
 * LA CONDICIÓN DE UN DATO DEL EVENTO (16/10/2026, lib/dato-evento.ts): se arma de su variable (`VariableAviso.condicion`),
 * así el dato vive UNA vez —su nombre, su tipo, sus opciones— y el catálogo no copia nada. Un dato que no se pregunta (sin
 * `condicion`) no es una condición: la fila se descarta al guardar, como un id desconocido. Se evalúa contra los datos que
 * trajo el evento (`HechosLead.evento`), nunca leyendo un lead.
 */
function defDeDato(campo: string): DefCondicion | null {
  const k = datoDeCampo(campo);
  const v = k ? datoDe(k) : undefined;
  const c = v?.condicion;
  if (!c) return null;
  const valor: TipoValor = c.tipo === 'numero' ? { t: 'numero', unidad: '', def: c.def, min: c.min, max: c.max }
    : c.tipo === 'opciones' ? { t: 'opciones', opciones: c.opciones } : { t: 'texto' };
  const tipo = c.tipo === 'numero' ? 'numero' : 'texto';
  return {
    id: campo, seccion: SECCION_DATOS, ambito: 'ambos', rotulo: c.rotulo, negable: c.tipo !== 'numero', valor, fuentes: [],
    evaluar: (f, h) => cumpleDato(f, h.evento, tipo),
  };
}

/** Las listas FIJAS (las que no salen de la base del negocio). */
export const OPCIONES_FIJAS: Partial<Record<CatalogoValor, ReadonlyArray<{ value: string; label: string }>>> = {
  origen: [
    { value: 'instant_form', label: 'Formulario de Meta' },
    { value: 'landing', label: 'Landing' },
    { value: 'calendly', label: 'Calendly' },
    { value: 'calcom', label: 'Cal.com' },
    { value: 'chat_whatsapp', label: 'WhatsApp' },
    // Duodécima tanda: los que escribe `createLead` desde un evento de Zernio (`origen_lead: e.canal`, lib/zernio-entrante.ts).
    { value: 'instagram', label: 'Instagram' },
    { value: 'messenger', label: 'Messenger' },
    { value: 'manual', label: 'Carga manual' },
  ],
  estado_lead: [
    { value: 'abierto', label: 'Abierto' },
    { value: 'ganado', label: 'Ganado' },
    { value: 'perdido', label: 'Perdido' },
    { value: 'descalificado', label: 'Descalificado' },
    { value: 'no_responde', label: 'No responde' },
  ],
  // `graduado` y `baja` son decisiones del equipo (mig 0129); sin fila = activo.
  estado_cliente: [
    { value: 'activo', label: 'Activo' },
    { value: 'graduado', label: 'Graduado' },
    { value: 'baja', label: 'Baja' },
  ],
};

// ── El ámbito del CRON ────────────────────────────────────────────────────────────

/**
 * ¿El CRON es de adquisición o de entrega? La ENTREGA del servicio (el kanban de Customer
 * Success) es `entrega_actual`; todo lo demás —una etapa de venta, una etiqueta, un evento de
 * antes, manual— es adquisición.
 */
export function ambitoDeDisparo(triggerTipo: string | null | undefined): AmbitoDisparo {
  return triggerTipo === 'entrega_actual' ? 'entrega' : 'adquisicion';
}

/** ¿Se ofrece esta condición con este CRON? */
export function seOfrece(c: DefCondicion, ambito: AmbitoDisparo): boolean {
  if (c.retirada) return false;
  // La de la respuesta no es de la salida (sexta tanda): la ofrece el editor de la condición que escucha.
  if (c.evento) return false;
  return c.ambito === 'ambos' || c.ambito === ambito;
}

export function seccionEn(c: DefCondicion, ambito: AmbitoDisparo): SeccionCondicion {
  return ambito === 'entrega' && c.seccionEntrega ? c.seccionEntrega : c.seccion;
}

// ── Los catálogos que el editor recibe ─────────────────────────────────────────────

/** `disabled` + `sub`: se ve pero no se elige, y la razón va en el renglón (la tercera reunión). */
export type OpcionCatalogo = { value: string; label: string; disabled?: boolean; sub?: string };
export type SeccionOpciones = { title: string; options: OpcionCatalogo[] };

/** Un producto con su embudo y su entrega (la forma de `ProductoParaDisparo`). */
export type ProductoCondicion = {
  funnelId: number | null; productoId: number | null; nombre: string;
  etapas: ReadonlyArray<OpcionCatalogo>; etapasEntrega: ReadonlyArray<OpcionCatalogo>;
};
/** Un curso (un producto con clases), de GET /api/chat-agent/condiciones. */
export type CursoCondicion = {
  productoId: number; nombre: string;
  modulos: ReadonlyArray<{ clave: string; nombre: string }>;
  clases: ReadonlyArray<{ id: number; titulo: string; modulo: string; tieneTarea: boolean }>;
};
export type CatalogosCondicion = {
  etiquetas?: ReadonlyArray<{ id: number; nombre: string; archivada_at?: string | null }>;
  /** Las etapas de venta por producto (las que dibuja el selector de etapa de siempre). */
  etapas?: ReadonlyArray<{ title: string; funnelId: number; options: ReadonlyArray<OpcionCatalogo> }>;
  productos?: ReadonlyArray<ProductoCondicion>;
  cursos?: ReadonlyArray<CursoCondicion>;
  posts?: ReadonlyArray<{ id: number; titulo: string }>;
  campanas?: ReadonlyArray<string>;
  /** Las etapas de REUNIÓN de cada embudo (`reunionesParaEditor`). null = no se pudo leer. */
  reuniones?: ReadonlyArray<ReunionesDeEmbudo> | null;
};

/**
 * Las etapas de reunión de UN embudo, en su orden (GET /api/chat-agent/condiciones). `sinLugar`: de la
 * tercera en adelante, que la ficha no tiene dónde guardar (`slotPorIndice`): se ve pero no se elige.
 */
export type ReunionesDeEmbudo = {
  funnelId: number; nombre: string;
  etapas: ReadonlyArray<{ key: string; label: string; sinLugar: boolean }>;
};

/**
 * Las reuniones de cada embudo para el editor, desde sus etapas (`kind: 'reunion'`, la marca que pone
 * el editor de etapas del CRM: lib/etapa-reunion.ts). El orden y el «sin lugar» salen de la MISMA
 * cuenta que usa el motor (`slotPorIndice` sobre el índice), así lo que se ofrece es lo que se evalúa.
 * Un embudo sin reuniones no va.
 */
export function reunionesParaEditor(
  embudos: ReadonlyArray<{ funnelId: number; nombre: string; stages: ReadonlyArray<{ key: string; label?: string; kind?: string }> }>,
): ReunionesDeEmbudo[] {
  const out: ReunionesDeEmbudo[] = [];
  for (const e of embudos) {
    const reuniones = e.stages.filter((s) => s.kind === 'reunion');
    if (!reuniones.length) continue;
    out.push({
      funnelId: e.funnelId,
      nombre: e.nombre,
      etapas: reuniones.map((s, i) => ({ key: s.key, label: s.label?.trim() || s.key, sinLugar: slotPorIndice(i) == null })),
    });
  }
  return out;
}

/**
 * Los CURSOS para el editor (GET /api/chat-agent/condiciones): los productos que tienen clases, con
 * sus módulos en el orden del curso y sus clases. Un módulo que no tiene clases no se ofrece («Completó
 * el módulo» de un módulo vacío nunca se cumple: el motor exige al menos una clase), y una clase que
 * cuelga de un módulo que ya no existe va igual, bajo su curso.
 */
export function armarCursos(
  productos: ReadonlyArray<{ id: number; nombre: string }>,
  clases: ReadonlyArray<{ id: number; productoId: number; etapa: string; orden?: number; titulo: string; tieneTarea: boolean }>,
  modulos: ReadonlyMap<number, ReadonlyArray<{ clave: string; nombre: string }>>,
): CursoCondicion[] {
  const out: CursoCondicion[] = [];
  for (const p of productos) {
    const suyas = clases.filter((c) => c.productoId === p.id);
    if (!suyas.length) continue;
    const conClases = new Set(suyas.map((c) => c.etapa));
    const mods = (modulos.get(p.id) ?? []).filter((m) => conClases.has(m.clave));
    const orden = new Map(mods.map((m, i) => [m.clave, i]));
    out.push({
      productoId: p.id,
      nombre: p.nombre || `Producto ${p.id}`,
      modulos: mods.map((m) => ({ clave: m.clave, nombre: m.nombre })),
      clases: [...suyas]
        .sort((a, b) => (orden.get(a.etapa) ?? 999) - (orden.get(b.etapa) ?? 999) || (a.orden ?? 0) - (b.orden ?? 0) || a.id - b.id)
        .map((c) => ({ id: c.id, titulo: c.titulo || `Clase ${c.id}`, modulo: c.etapa, tieneTarea: c.tieneTarea })),
    });
  }
  return out;
}

/**
 * Las opciones de un catálogo, en secciones (para un Dropdown con `secciones`, o aplanadas). Un
 * catálogo dinámico que no se cargó devuelve []: la condición que lo necesita no se ofrece.
 */
export function opcionesDe(catalogo: CatalogoValor, cat: CatalogosCondicion): SeccionOpciones[] {
  const fija = OPCIONES_FIJAS[catalogo];
  if (fija) return [{ title: '', options: [...fija] }];
  const varios = (cat.productos?.length ?? 0) > 1 || (cat.cursos?.length ?? 0) > 1;
  switch (catalogo) {
    // Las etapas de reunión, por embudo. La tercera en adelante se VE (para que no parezca que falta)
    // pero no se elige: no tiene dato en la ficha y la condición daría siempre «no sé».
    case 'reunion': {
      const embudos = cat.reuniones ?? [];
      return embudos.map((e) => ({
        title: embudos.length > 1 ? e.nombre : '',
        options: e.etapas.map((s) => ({
          value: `${e.funnelId}:${s.key}`, label: s.label,
          ...(s.sinLugar ? { disabled: true, sub: 'Sin dato en la ficha' } : {}),
        })),
      }));
    }
    case 'etiqueta':
      return [{ title: '', options: (cat.etiquetas ?? []).filter((e) => !e.archivada_at).map((e) => ({ value: String(e.id), label: e.nombre })) }];
    case 'etapa':
      return (cat.etapas ?? []).map((s) => ({ title: s.title, options: s.options.map((o) => ({ value: `${s.funnelId}:${o.value}`, label: o.label })) }));
    case 'producto':
      return [{ title: '', options: (cat.productos ?? []).filter((p) => p.funnelId != null).map((p) => ({ value: String(p.funnelId), label: p.nombre })) }];
    case 'campana':
      return [{ title: '', options: (cat.campanas ?? []).map((c) => ({ value: c, label: c })) }];
    case 'post':
      return [{ title: '', options: (cat.posts ?? []).map((p) => ({ value: String(p.id), label: p.titulo || `Post ${p.id}` })) }];
    case 'curso':
      return [{ title: '', options: (cat.cursos ?? []).map((c) => ({ value: String(c.productoId), label: c.nombre })) }];
    case 'modulo':
      return (cat.cursos ?? []).map((c) => ({ title: varios ? c.nombre : '', options: c.modulos.map((m) => ({ value: `${c.productoId}:${m.clave}`, label: m.nombre })) }));
    case 'clase':
    case 'clase_tarea':
      return (cat.cursos ?? []).map((c) => ({
        title: varios ? c.nombre : '',
        options: c.clases.filter((k) => catalogo === 'clase' || k.tieneTarea).map((k) => ({ value: String(k.id), label: k.titulo })),
      }));
    case 'etapa_entrega':
      return (cat.productos ?? []).filter((p) => p.productoId != null).map((p) => ({
        title: varios ? p.nombre : '',
        options: p.etapasEntrega.map((e) => ({ value: `${p.productoId}:${e.value}`, label: e.label })),
      }));
    default:
      return [];
  }
}

const hayOpciones = (s: SeccionOpciones[]) => s.some((x) => x.options.length > 0);

/**
 * UN NIVEL DEL ÁRBOL: sus opciones y, si tiene, los niveles de adentro (la forma de `DropdownGroup`,
 * app/components/Dropdown.tsx, que abre cada nivel con su ‹ para volver y aplana al buscar).
 */
export type NivelArbol = { title: string; options: OpcionCatalogo[]; grupos?: NivelArbol[] };

/**
 * LAS OPCIONES DE UN CATÁLOGO COMO ÁRBOL (sexta tanda, punto 1 de «CONDITION»: «primero selecciono
 * el módulo y ahí me aparecen las clases de ese módulo... Esto para TODO»). Donde hay jerarquía:
 *
 *   · una clase (y una clase con tarea): el curso → su módulo → sus clases;
 *   · un módulo: el curso → sus módulos;
 *   · una etapa: el producto → sus etapas (de venta, o de entrega);
 *   · una reunión: el embudo → sus etapas de reunión.
 *
 * Un nivel con UNA sola rama no se dibuja (un curso solo: elegirlo es un clic que no decide nada) y
 * lo de adentro sube. Lo que no tiene jerarquía va plano, como siempre (`opcionesDe`). Los valores
 * son los MISMOS de `opcionesDe`: el árbol cambia cómo se elige, no qué se guarda.
 */
export function arbolDeOpciones(catalogo: CatalogoValor, cat: CatalogosCondicion): NivelArbol[] {
  const clase = (k: { id: number; titulo: string }): OpcionCatalogo => ({ value: String(k.id), label: k.titulo });
  if (catalogo === 'clase' || catalogo === 'clase_tarea') {
    return colapsar((cat.cursos ?? []).map((c) => {
      const clases = c.clases.filter((k) => catalogo === 'clase' || k.tieneTarea);
      const conModulo = new Set(c.modulos.map((m) => m.clave));
      const grupos: NivelArbol[] = c.modulos.map((m) => ({ title: m.nombre, options: clases.filter((k) => k.modulo === m.clave).map(clase) }));
      // Una clase de un módulo que ya no existe va igual, bajo su curso (como en `armarCursos`).
      const sueltas = clases.filter((k) => !conModulo.has(k.modulo));
      if (sueltas.length) grupos.push({ title: 'Sin módulo', options: sueltas.map(clase) });
      return { title: c.nombre, options: [], grupos };
    }));
  }
  if (catalogo === 'modulo') {
    return colapsar((cat.cursos ?? []).map((c) => ({ title: c.nombre, options: c.modulos.map((m) => ({ value: `${c.productoId}:${m.clave}`, label: m.nombre })) })));
  }
  if (catalogo === 'etapa' || catalogo === 'etapa_entrega' || catalogo === 'reunion') {
    // Ya vienen por producto (o por embudo): cada sección es un nivel.
    return colapsar(opcionesDe(catalogo, cat).map((s, k) => ({ title: s.title || `Producto ${k + 1}`, options: s.options })));
  }
  return opcionesDe(catalogo, cat).filter((s) => s.options.length > 0);
}

/** Saca los niveles vacíos y sube lo de adentro de un nivel que es el ÚNICO de los suyos. */
function colapsar(niveles: NivelArbol[]): NivelArbol[] {
  const limpio = (n: NivelArbol): NivelArbol | null => {
    const grupos = (n.grupos ?? []).map(limpio).filter((g): g is NivelArbol => !!g);
    if (!n.options.length && !grupos.length) return null;
    // Sin opciones propias y con UN solo nivel adentro: lo de adentro sube, con el NOMBRE de afuera (un
    // curso con un módulo muestra sus clases bajo el nombre del curso, que es el que la persona conoce).
    if (!n.options.length && grupos.length === 1) return { ...grupos[0], title: n.title || grupos[0].title };
    return grupos.length ? { title: n.title, options: n.options, grupos } : { title: n.title, options: n.options };
  };
  const out = niveles.map(limpio).filter((g): g is NivelArbol => !!g);
  // Un solo nivel en la raíz: se abre directo, sin la fila que habría que tocar para entrar.
  if (out.length === 1 && !out[0].options.length && out[0].grupos?.length) return out[0].grupos;
  if (out.length === 1 && !out[0].grupos?.length) return [{ title: '', options: out[0].options }];
  return out;
}

/** ¿El árbol tiene algo que ABRIR (más de un nivel con nombre)? Si no, se dibuja como una lista plana. */
export function esArbol(niveles: readonly NivelArbol[]): boolean {
  return niveles.length > 1 || niveles.some((n) => (n.grupos?.length ?? 0) > 0);
}

/** ¿Hay con qué completar esta condición? Una de lista sin elementos no se ofrece. */
export function tieneCatalogo(c: DefCondicion, cat: CatalogosCondicion): boolean {
  if (c.valor.t === 'lista') return hayOpciones(opcionesDe(c.valor.catalogo, cat));
  if (c.valor.t === 'opciones') return c.valor.opciones.length > 0;
  if (c.valor.t === 'numero' && c.valor.ref) return hayOpciones(opcionesDe(c.valor.ref, cat));
  if (c.id === 'etiqueta') return true;   // el selector de etiqueta deja crear una nueva
  if (c.id === 'etapa') return hayOpciones(opcionesDe('etapa', cat));
  return true;
}

/** El valor de una opción del desplegable de condiciones: el id y si va negada. */
export const valorOpcion = (id: string, no: boolean): string => `${id}|${no ? 1 : 0}`;
export function deValorOpcion(v: string): { id: string; no: boolean } | null {
  const [id, n] = v.split('|');
  return condicionPorId(id) ? { id, no: n === '1' } : null;
}

/**
 * EL DESPLEGABLE DE CONDICIONES, POR SECCIONES (el patrón del Plan y del CRON): las del ámbito del
 * CRON, cada una en positivo y —si se puede— negada, en el orden de `SECCIONES`. Las que no tienen
 * con qué completarse (no hay cursos, no hay posts) no se ofrecen.
 */
export function seccionesDeCondiciones(ambito: AmbitoDisparo, cat: CatalogosCondicion, datos?: DatosDeLaCondicion | null): SeccionOpciones[] {
  const opciones = (c: DefCondicion): OpcionCatalogo[] => [
    { value: valorOpcion(c.id, false), label: c.rotulo[0] },
    ...(c.negable && c.rotulo[1] && c.rotulo[1] !== c.rotulo[0] ? [{ value: valorOpcion(c.id, true), label: c.rotulo[1] }] : []),
  ];
  // Los DATOS DEL EVENTO, primero (16/10/2026). Un evento sin lead (`solo`) pregunta sólo esos: lo demás mira un lead.
  const delEvento = (datos?.claves ?? []).map((k) => condicionPorId(campoDeDato(k))).filter((c): c is DefCondicion => !!c);
  const primera: SeccionOpciones[] = delEvento.length ? [{ title: SECCION_DATOS, options: delEvento.flatMap(opciones) }] : [];
  if (datos?.solo) return primera;
  return [...primera, ...SECCIONES[ambito].map((titulo) => ({
    title: titulo,
    options: CONDICIONES
      .filter((c) => seOfrece(c, ambito) && seccionEn(c, ambito) === titulo && tieneCatalogo(c, cat))
      .flatMap(opciones),
  })).filter((s) => s.options.length > 0)];
}

/**
 * LOS DATOS DEL EVENTO QUE OFRECE UNA FILA DE EVENTO (16/10/2026, `condicionesDelEvento`, lib/aviso-evento.ts): sus claves,
 * y `solo` si el evento no trae un lead (de la plataforma o de una persona): ahí la CONDITION pregunta sólo esos.
 */
export type DatosDeLaCondicion = { claves: readonly string[]; solo: boolean };

/**
 * La fila NUEVA al elegir una condición: su valor por defecto (el número, el operador) y nada que
 * haya que adivinar (una lista nace sin elegir: `validarFila` la frena hasta que se elija).
 */
export function filaNueva(id: string, no: boolean): FilaCondicion | null {
  const c = condicionPorId(id);
  if (!c) return null;
  const f: FilaCondicion = { campo: id as FilaCondicion['campo'] };
  if (no && c.negable) f.no = true;
  if (c.valor.t === 'numero') { f.op = 'mayor_igual'; f.valor = c.valor.def; }
  if (id === 'antiguedad') f.valor = 72;
  return f;
}

// ── Validar (lo que la fila necesita para que el motor la pueda decidir) ─────────

/** null = la fila se puede guardar. Si no, en palabras para quien guarda. */
export function problemaDeFila(f: FilaCondicion): string | null {
  const c = condicionPorId(f.campo);
  if (!c) return `condición desconocida: ${String(f.campo)}`;
  const v = c.valor;
  if (v.t === 'legado') {
    if ((f.campo === 'etiqueta' || f.campo === 'etapa') && (f.valor == null || f.valor === '')) return `falta elegir la ${f.campo}`;
    if (f.campo === 'antiguedad' && !(Number(f.valor) > 0)) return 'falta el número de horas';
    // La cuota es opcional (vacío = como siempre); puesta, un entero de 1 a TOPE_CUOTA.
    if (f.campo === 'pago' && f.valor != null && f.valor !== '' && cuotaDeFila(f) == null) return `la cuota tiene que ser un número del 1 al ${TOPE_CUOTA}`;
    return null;
  }
  if (c.reuniones && (f.reuniones?.length ?? 0) > TOPE_REUNIONES) return `«${c.rotulo[0]}» tiene más de ${TOPE_REUNIONES} reuniones`;
  if (v.t === 'lista' && (f.valor == null || f.valor === '')) return `falta elegir «${c.rotulo[0]}»`;
  if (v.t === 'texto' && !String(f.valor ?? '').trim()) return `falta el texto de «${c.rotulo[0]}»`;
  if (v.t === 'opciones' && !v.opciones.some((o) => o.value === String(f.valor ?? ''))) return `falta elegir «${c.rotulo[0]}»`;
  if (v.t === 'numero') {
    const n = Number(f.valor);
    if (f.valor == null || f.valor === '' || !Number.isFinite(n) || n < v.min || n > v.max) return `falta el número de «${c.rotulo[0]}»`;
    if (f.op != null && !OPERADORES.includes(f.op)) return `operador inválido en «${c.rotulo[0]}»`;
    if (v.ref && !(Number(f.ref) > 0)) return `falta elegir el curso de «${c.rotulo[0]}»`;
  }
  return null;
}

// ── Evaluar ───────────────────────────────────────────────────────────────────────

/**
 * Una fila del catálogo NUEVO (las nueve de antes las decide `cumpleFila`). Desconocida o sin
 * dato = NO SE CUMPLE, ni negada. `no` sólo cuenta en las negables.
 */
/**
 * ¿El lead sigue en alguna de las etapas del CRON de la automatización? `null` = no se sabe: la automatización no tiene
 * un CRON de etapa (o quien evalúa no lo pasó), o falta el dato del lead en ese kanban. Con varios CRON alcanza uno.
 * La entrega se guarda como `${producto}:${etapa}` (`catalogo.entrega`); sin producto, cualquier producto.
 */
export function sigueEnEtapaDelCron(h: HechosLead): boolean | null {
  const cron = h.etapasDelCron;
  if (!cron || !cron.length) return null;
  let sinDato = false;
  for (const c of cron) {
    if (c.tipo === 'venta') {
      const e = c.funnelId != null ? (h.etapasPorProducto?.get(c.funnelId) ?? null) : h.etapa;
      if (e == null) { sinDato = true; continue; }
      if (c.keys.includes(e)) return true;
    } else {
      const e = h.catalogo?.entrega;
      if (!e) { sinDato = true; continue; }
      const enAlguna = c.productoId != null
        ? c.keys.some((k) => e.has(`${c.productoId}:${k}`))
        : [...e].some((x) => c.keys.includes(x.slice(x.indexOf(':') + 1)));
      if (enAlguna) return true;
    }
  }
  return sinDato ? null : false;
}

export function cumpleCatalogo(f: FilaCondicion, h: HechosLead): boolean {
  const c = condicionPorId(f.campo);
  if (!c?.evaluar) return false;
  const si = c.evaluar(f, h);
  if (si == null) return false;
  return f.no && c.negable ? !si : si;
}

// ── Qué tiene que leer el motor ───────────────────────────────────────────────────

/**
 * Las fuentes que piden estas filas. `lead` va siempre: es la fila que arma el resto. Lo que depende
 * de la FILA y no de la condición lo suma la fila: las etapas de reunión elegidas piden el orden de
 * esos embudos y en cuáles está el lead (`reuniones` + `productos`), y «No pagó la cuota N» pide las
 * cuotas (`pagos`). Sin eso, «No pagó» de siempre seguiría leyendo sólo la fila del lead.
 */
export function fuentesDeFilas(filas: readonly FilaCondicion[]): Set<Fuente> {
  const out = new Set<Fuente>(['lead']);
  for (const f of filas) {
    const c = condicionPorId(f.campo);
    for (const x of c?.fuentes ?? []) out.add(x);
    if (c?.reuniones && reunionesDeFila(f).length) { out.add('reuniones'); out.add('productos'); }
    if (f.campo === 'pago' && f.valor != null && f.valor !== '') out.add('pagos');
  }
  return out;
}

/** Las etapas de entrega (`productoId:etapa`) que piden estas filas: la fuente `entrega` lee sólo ésas. */
export function etapasEntregaDeFilas(filas: readonly FilaCondicion[]): Array<{ productoId: number; etapa: string }> {
  const vistos = new Set<string>();
  const out: Array<{ productoId: number; etapa: string }> = [];
  for (const f of filas) {
    if (f.campo !== 'etapa_entrega') continue;
    const k = String(f.valor ?? '');
    const [p, ...e] = k.split(':');
    const productoId = Number(p);
    const etapa = e.join(':');
    if (!(productoId > 0) || !etapa || vistos.has(k)) continue;
    vistos.add(k);
    out.push({ productoId, etapa });
  }
  return out;
}

// ── Cómo se dice en la tarjeta ────────────────────────────────────────────────────

/** Los nombres que la tarjeta necesita para decir el valor (los da quien dibuja). */
export type NombresCatalogo = (catalogo: CatalogoValor, valor: string) => string | null;

const GENERICO: Record<CatalogoValor, string> = {
  etiqueta: 'una etiqueta', etapa: 'una etapa', producto: 'un funnel', campana: 'una campaña', origen: 'un origen',
  estado_lead: 'un estado', estado_cliente: 'un estado', curso: 'un curso', modulo: 'un módulo', clase: 'una clase',
  clase_tarea: 'una clase', post: 'un post', etapa_entrega: 'una etapa', reunion: 'una reunión',
};

/**
 * Los nombres de los valores, sacados de los MISMOS catálogos que ofrece el editor: lo que la
 * tarjeta dice es lo que se eligió. Para `NombresParaTexto.catalogo` (lib/flujo-grafo.ts).
 */
export function nombresCatalogoDe(cat: CatalogosCondicion): NombresCatalogo {
  return (catalogo, valor) => {
    for (const s of opcionesDe(catalogo, cat)) {
      const o = s.options.find((x) => x.value === valor);
      if (o) return o.label;
    }
    return null;
  };
}

/** El nombre de un valor: el de una lista fija, o el que dé quien dibuja, o el genérico. */
export function nombreDeValor(catalogo: CatalogoValor, valor: string, n?: NombresCatalogo): string {
  const fijo = OPCIONES_FIJAS[catalogo]?.find((o) => o.value === valor)?.label;
  return fijo ?? n?.(catalogo, valor) ?? (catalogo === 'campana' && valor ? valor : GENERICO[catalogo]);
}

/**
 * La frase de una fila del catálogo NUEVO (las nueve de antes las dice `textoFila`). Corta: es lo
 * que se dibuja en la tarjeta («Cuotas vencidas ≥ 2», «Completó la clase «Bienvenida»»).
 */
export function textoCondicion(f: FilaCondicion, n?: NombresCatalogo): string {
  const base = textoBase(f, n);
  const c = condicionPorId(f.campo);
  // Las etapas de reunión elegidas, por su nombre («No asistió a la reunión «Discovery»»). Sin el
  // catálogo (un setter, o la lectura caída) dicen «una reunión» una sola vez: repetirlo no informa.
  const elegidas = c?.reuniones ? reunionesDeFila(f) : [];
  if (!elegidas.length) return base;
  const nombres = [...new Set(elegidas.map((e) => nombreDeValor('reunion', `${e.funnelId}:${e.key}`, n)))];
  const lista = nombres.map((x) => (x === GENERICO.reunion ? x : `«${x}»`)).join(' o ');
  return c?.valor.t === 'numero' ? `${base} · ${lista}` : `${base} ${lista}`;
}

function textoBase(f: FilaCondicion, n?: NombresCatalogo): string {
  const c = condicionPorId(f.campo);
  if (!c) return 'Condición';
  const r = c.rotulo[f.no && c.negable ? 1 : 0];
  const v = c.valor;
  if (v.t === 'numero') {
    const op = SIMBOLO_OP[f.op === 'menor_igual' ? 'menor_igual' : 'mayor_igual'];
    const base = `${r} ${op} ${f.valor ?? '…'}${v.unidad}`;
    return v.ref ? `${base} · ${nombreDeValor(v.ref, String(f.ref ?? ''), n)}` : base;
  }
  if (v.t === 'lista') {
    if (f.valor == null || f.valor === '') return `${r} …`;
    const nom = nombreDeValor(v.catalogo, String(f.valor), n);
    return v.catalogo === 'origen' || v.catalogo === 'estado_lead' || v.catalogo === 'estado_cliente' ? `${r}: ${nom}` : `${r} «${nom}»`;
  }
  if (v.t === 'texto') return `${r} «${String(f.valor ?? '').trim() || '…'}»`;
  if (v.t === 'opciones') {
    const o = v.opciones.find((x) => x.value === String(f.valor ?? ''));
    return `${r} «${o?.label ?? (String(f.valor ?? '').trim() || '…')}»`;
  }
  return r;
}
