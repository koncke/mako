// =============================================================================
// plan-propuesta — el BORRADOR que MaKo deja para revisar en la app (mig 0094)
// =============================================================================
// MaKo (WhatsApp) arma un borrador (tareas + preguntas con opciones) en vez del
// ida-y-vuelta frágil por chat. El dueño O EL CLIENTE abre /plan/revisar/<id>,
// responde de a 1 pregunta (WizardShell) y confirma → se crean las tareas.
// WORKSPACE-AWARE (impacta a TODOS, no solo al dueño): el borrador vive en el ws
// de quien lo crea/mira. Al aplicar: super-admin → plan_tareas + Perro; cualquier
// otro → su board (lib/todo). Nunca forzamos OWNER_WS.

import 'server-only';
import { getTenantDb, runWithWorkspace, getWorkspaceActual, getWorkspace, OWNER_WS } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { agregarTareasPlanOwner, ampliarTareasPlanOwner, priorizarNuevasOwner, borrarPlanTarea, cerrarPlanTareaOwner, listPlanBoard, fusionarDetalle } from '@/lib/plan-board';
import { crearTarea, crearCategoria, listCategorias, borrarTarea, listTareas, editarTarea, ampliarTareasCliente, type Prioridad } from '@/lib/todo';
import { priorizarNuevasCliente } from '@/lib/todo-guardian';
import { mismaTarea } from '@/lib/tareas-dedup';
import { rutearTareasCliente } from '@/lib/todo-rutear';
import { criterioDelWorkspace } from '@/lib/plan-criterio';
import { decidirRecurrente } from '@/lib/plan-criterio-reglas';
import { tipoDeResponsable } from '@/lib/reunion-reparto';
import type { Pregunta, TipoPregunta } from '@/lib/preguntas-contrato';
import { corregirMarca } from '@/lib/mako-gramatica';
import type { Prio, Fuente, FuenteTipo } from '@/app/plan/board/types';
import { tableroDeCapa } from './tablero-de-capa';
import { recortarPrueba, renglonDeCierre } from './cierre-tarjeta';

type Row = Record<string, unknown>;
const wsActual = async (): Promise<number> => (await getWorkspaceActual()) ?? OWNER_WS;
const enWs = async <T,>(fn: () => Promise<T>): Promise<T> => runWithWorkspace(await wsActual(), fn);
const genId = (p: string): string => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const PRIOS: Prio[] = ['alta', 'media', 'baja', 'futuro'];
// Nombre de proyecto comparable: sin acentos y en minúscula, igual que el board (NFD).
// Sin esto, "Cuenta Vértice Industrial" y "Cuenta Vertice Industrial" son dos proyectos.
const normNom = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();


/** Las cubetas que llegan a un borrador. `fuera` no: no tiene forma de compromiso y
 *  no se registra en ninguna parte (regla del criterio: si entrara, la lista de
 *  descartados se volveria un basurero y nadie la revisaria). */
export const CUBETAS_BORRADOR = ['compromiso', 'acuerdo_interno', 'descartado'] as const;
export type CubetaBorrador = (typeof CUBETAS_BORRADOR)[number];

export type PropuestaTarea = {
  titulo: string; proyecto?: string; deadline?: string; detalle?: string; prioridad?: Prio;
  // Reparto por persona (reuniones): quién asumió la tarea y si es de OTRO. Viajan
  // dentro del borrador para que el modal de confirmación muestre las mismas tabs
  // (Mías + una por colaborador) que la extracción manual.
  dueno?: string; duenoEmail?: string; esDeOtro?: boolean;
  /**
   * «Se repite para siempre» (mig 0163): la reunión de los miércoles, el seguimiento
   * diario. Viaja DESDE LA EXTRACCIÓN hasta el alta, porque una tarea tiene que poder
   * NACER recurrente: mientras el único camino fue el interruptor del detalle, la
   * recurrente entraba como tarea normal, el Perro le ponía score y deadline, se llevaba
   * un puesto del ranking y titilaba pidiendo una fecha que nunca iba a tener.
   *
   * ⚠️ NO CONVIVE CON `deadline`. El desempate lo hace `limpiarTarea` acá abajo, y está
   * de este lado —y no en cada productor— porque por acá pasan TODOS: la reunión, el
   * cron, el importador de archivos, el doer de WhatsApp, la API del agente, y la
   * relectura de la fila (`rowToPropuesta`).
   */
  recurrente?: boolean;
  /** segundo de la grabación donde se dijo (para ir a escuchar ese momento). */
  minuto?: number;
  /** TODOS los momentos en que se habló de esto (una tarea puede volver varias veces). */
  minutos?: number[];
  /** ¿queda tildada para cargar? `false` = el dueño la destildó. undefined = sí (default).
   *  Se persiste para que la revisión sobreviva a un F5: antes vivía solo en el estado
   *  del modal y con recargar la página volvía todo al reparto que había adivinado MaKo. */
  incluir?: boolean;
  /** El resultado del cruce anti-duplicados: esta candidata YA existe en el tablero.
   *  Se PERSISTE (mig 0123) porque antes vivía solo en el estado del modal y el cruce
   *  —que es una llamada de IA— se rehacía en cada apertura. Mientras corría, las tareas
   *  se veían como nuevas y se podían cargar: entrar y confirmar rápido creaba el
   *  duplicado que el cruce iba a marcar dos segundos después. */
  enriquece?: { id: string; razon: string; confianza?: 'alta' | 'media' };
  /** `false` = el dueño dijo «no es la misma»: se crea igual, aunque el cruce la marcó. */
  ampliar?: boolean;
  /** `true` = el dueño destildó la AMPLIACIÓN: no se le suma nada a la tarjeta. Es un
   *  campo aparte de `incluir` porque una ampliación tiene `incluir: false` por
   *  definición —no se crea— y meterlos juntos apagaba todas de entrada. */
  omitir?: boolean;
  /**
   * EN QUE CUBETA la puso el criterio de compromisos del workspace, si lo hay
   * (lib/plan-criterio-juez.ts). undefined = no se juzgo: el workspace no tiene
   * criterio, o el juez fallo. Las `fuera` no llegan hasta aca.
   *
   * No es lo mismo que `incluir`. `incluir` es lo que la PERSONA decidio y se
   * reescribe en cada click; la cubeta es lo que dijo el criterio y no cambia. Las
   * dos hacen falta: sin la cubeta, una tarea destildada no se distingue de una que
   * el criterio descarto, y la tercera cubeta existe justamente «para que la
   * decision sea auditable».
   */
  cubeta?: CubetaBorrador;
  /** Por que el criterio la puso ahi, con la regla y la cita. Se MUESTRA en la
   *  revision y NO entra al detalle de la tarea creada: es el fundamento de una
   *  clasificacion, no contexto del trabajo. */
  porQue?: string;
};
/**
 * Los títulos de las tareas ABIERTAS del tablero del workspace actual, para no volver
 * a crear algo que ya está. Solo las abiertas: si una se hizo y vuelve a aparecer en
 * otra reunión, es un pedido nuevo, no un duplicado. Best-effort — si la lectura falla
 * se devuelve vacío y el flujo sigue (peor un duplicado que perder la tarea).
 */
/**
 * Lo que ya está ABIERTO en el tablero, con su id — para poder AMPLIARLO. Antes esto
 * devolvía solo los títulos y por eso la única jugada posible era descartar la tarea
 * nueva: sin el id no hay a qué tarjeta sumarle el contexto.
 */
async function abiertasDelTablero(usaPlanBoard: boolean): Promise<Array<{ id: string; titulo: string }>> {
  try {
    if (usaPlanBoard) return (await listPlanBoard()).tareas.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title }));
    return (await listTareas()).filter((t) => t.progreso < 100).map((t) => ({ id: String(t.id), titulo: t.titulo }));
  } catch (e) { console.error('[plan-propuesta] no pude leer el tablero para deduplicar', e); return []; }
}

/**
 * Una tarea del borrador que YA se creó. Queda guardada (mig 0105) para dos cosas:
 * no volver a ofrecerla cuando el borrador se reabre por las de otras personas, y
 * poder abrir la tarjeta REAL desde el modal (?tarea=<id>).
 */
export type PropuestaAplicada = { titulo: string; tareaId: string; minutos?: number[] };
// El contrato de las preguntas (tipos + saneo + el texto que leen los modelos) vive
// en lib/preguntas-contrato.ts, que NO es server-only porque también lo necesitan los
// renderizadores. Acá se re-exporta con los nombres de siempre para no romper a los
// que ya importaban de este módulo.
export type { TipoPregunta };
export type PropuestaPregunta = Pregunta;
export type PropuestaEliminar = { id: string; titulo?: string; motivo?: string };
/** «Esta que ya tenés YA ESTÁ HECHA». CERRAR NO ES BORRAR: la tarjeta queda, con su
 *  historial y su checklist, y se le suma la evidencia. Nunca se aplica sola —
 *  la precisión medida de un «esto ya está hecho» dicho por IA es ~47%, así que
 *  cada una se confirma de a una en /plan/revisar. */
export type PropuestaCerrar = {
  id: string;
  /** POR QUÉ dice que está hecha, con la prueba: commit, archivo:línea, pantalla. */
  evidencia: string;
  /** 'alta' = lo verificó abriendo el código/dato. 'media' = lo dedujo. */
  confianza?: 'alta' | 'media';
  titulo?: string;
};
export type Propuesta = {
  id: string; estado: 'pendiente' | 'aplicada' | 'descartada'; resumen: string; origen?: string;
  tareas: PropuestaTarea[]; eliminar: PropuestaEliminar[]; cerrar: PropuestaCerrar[]; createdAt: string;
  /** quién se las mandó ('' = las sacó MaKo sola de una reunión tuya). */
  enviadoPor?: string;
  /** de dónde salieron: título + link de la reunión. */
  fuenteTitulo?: string; fuenteUrl?: string;
  /** CUÁNDO fue la reunión (ISO). Distinto de createdAt, que es cuándo la leyó MaKo. */
  fuenteFecha?: string;
  /** clave del hecho que la generó (fathom:<recordingId>) — candado anti-duplicado. */
  ref?: string;
  /** las que ya se cargaron al plan desde este borrador (sigue abierto por las de otros). */
  aplicadas?: PropuestaAplicada[];
  /** cuándo corrió el cruce anti-duplicados (mig 0123). undefined = falta correrlo. */
  cruzadoAt?: string;
  /** con qué CLIENTE fue la reunión (mig 0160). Es de la reunión, no de cada tarea: por
   *  eso vive acá y no en `tareas`, que el autoguardado del modal reescribe. */
  clienteNombre?: string; clienteLeadId?: number;
};

function limpiarAplicada(a: unknown): PropuestaAplicada | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  const tareaId = str(o.tareaId).trim().slice(0, 80);
  const titulo = str(o.titulo).trim().slice(0, 200);
  if (!tareaId || !titulo) return null;
  const minutos = Array.isArray(o.minutos)
    ? [...new Set((o.minutos as unknown[]).map((x) => Math.round(Number(x))).filter((n) => Number.isInteger(n) && n >= 0))].sort((a2, b2) => a2 - b2)
    : undefined;
  return { titulo, tareaId, minutos: minutos?.length ? minutos : undefined };
}


function limpiarTarea(t: unknown): PropuestaTarea | null {
  if (!t || typeof t !== 'object') return null;
  const o = t as Record<string, unknown>;
  // El nombre de la marca se corrige al ENTRAR, igual que en la transcripción: el
  // título de la tarea es lo que después copian el Perro (su razón de puntaje), el
  // ruteo a proyectos y la checklist. Si entra «Maco», sale «Maco» en cinco lugares.
  const titulo = corregirMarca(str(o.titulo).trim()).slice(0, 200);
  if (!titulo) return null;
  const deadline = typeof o.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline) ? o.deadline : undefined;
  // ── LA CUARTA PREGUNTA DEL CRITERIO, SEGUNDA CAPA ──────────────────────────────────
  // El prompt le pide al modelo que marque lo que «se repite para siempre». Eso lo hace
  // acertar casi siempre, que no es lo mismo que cumplirse: la regla necesita su lado
  // determinista, y éste es el choke point por el que pasan TODOS los productores de un
  // borrador (reunión, cron, importador de archivos, WhatsApp, la API del agente) más la
  // relectura de la fila.
  //
  // El conflicto que resuelve: `recurrente: true` + `deadline` es una contradicción —lo
  // que se repite no vence—. Gana la FECHA, y el porqué está en `decidirRecurrente`
  // (lib/plan-criterio-reglas.ts): entre dos señales que se contradicen gana la más cara
  // de producir, y una fecha concreta sólo se escribe habiendo oído a alguien decirla.
  const rec = decidirRecurrente(o.recurrente, deadline);
  // Lo que se descarta queda escrito: sin esta línea, «el modelo no la marcó» y «la
  // marcamos y se la tiramos nosotros» son el mismo silencio.
  if (rec.conflicto) {
    console.warn(`[plan-propuesta] «${titulo.slice(0, 60)}» venía marcada como recurrente CON fecha ${deadline} — gana la fecha, entra como tarea normal`);
  }
  return {
    titulo,
    proyecto: o.proyecto ? str(o.proyecto).trim().slice(0, 120) : undefined,
    deadline,
    recurrente: rec.recurrente || undefined,
    // 6000, igual que `plan_tareas.detalle` (agregarTareasPlanOwner). Estaba en 600 y era
    // el último cuello del contexto: el dueño manda tres minutos de audio, la extracción
    // escribe un detalle rico… y el borrador lo cortaba a mitad de frase antes de que
    // nadie lo leyera. Recortar acá es peor que en cualquier otro lado, porque es donde
    // el texto ENTRA al sistema: lo que se pierde no se recupera después.
    detalle: o.detalle ? corregirMarca(str(o.detalle)).slice(0, 6000) : undefined,
    prioridad: PRIOS.includes(o.prioridad as Prio) ? (o.prioridad as Prio) : undefined,
    dueno: o.dueno ? str(o.dueno).trim().slice(0, 80) : undefined,
    duenoEmail: o.duenoEmail ? str(o.duenoEmail).trim().toLowerCase().slice(0, 160) : undefined,
    esDeOtro: o.esDeOtro === true ? true : undefined,
    minuto: Number.isFinite(Number(o.minuto)) && Number(o.minuto) >= 0 ? Math.round(Number(o.minuto)) : undefined,
    minutos: Array.isArray(o.minutos)
      ? [...new Set((o.minutos as unknown[]).map((x) => Math.round(Number(x))).filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b)
      : undefined,
    incluir: o.incluir === false ? false : undefined,
    enriquece: (() => {
      const e = o.enriquece as Record<string, unknown> | undefined;
      const razon = str(e?.razon).trim().slice(0, 400);
      if (!e || typeof e !== 'object' || !razon) return undefined;
      return { id: str(e.id).trim().slice(0, 80), razon, confianza: e.confianza === 'alta' ? 'alta' as const : 'media' as const };
    })(),
    ampliar: o.ampliar === false ? false : undefined,
    omitir: o.omitir === true ? true : undefined,
    // ⚠️ VAN ACA O NO EXISTEN. Este saneo RECONSTRUYE la tarea campo por campo, asi
    // que todo campo nuevo que no se lea aca vuelve `undefined` en cada lectura de la
    // fila — sin error, sin log, y con la pantalla mostrando una tarea perfecta a la
    // que le falta el dato. Es la trampa que este repo ya pago con `landing.config`.
    cubeta: CUBETAS_BORRADOR.includes(o.cubeta as CubetaBorrador) ? (o.cubeta as CubetaBorrador) : undefined,
    porQue: o.porQue ? str(o.porQue).trim().slice(0, 800) : undefined,
  };
}
function limpiarEliminar(e: unknown): PropuestaEliminar | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const id = str(o.id).trim().slice(0, 80);
  if (!id) return null;
  return { id, titulo: o.titulo ? str(o.titulo).slice(0, 200) : undefined, motivo: o.motivo ? str(o.motivo).slice(0, 300) : undefined };
}
function limpiarCerrar(c: unknown): PropuestaCerrar | null {
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  const id = str(o.id).trim().slice(0, 80);
  // El MISMO tope que el renglón del historial (lib/cierre-tarjeta.ts): lo que la persona ve al
  // confirmar es lo que queda en la tarjeta. Y si se corta, termina en «…».
  const evidencia = recortarPrueba(str(o.evidencia));
  // SIN EVIDENCIA NO ENTRA. Un «ya está hecha» sin prueba no se puede confirmar ni
  // discutir: es exactamente lo que hace que el tablero deje de ser confiable.
  if (!id || evidencia.length < 10) return null;
  const conf = str(o.confianza);
  return { id, evidencia, confianza: conf === 'alta' ? 'alta' : 'media', titulo: o.titulo ? str(o.titulo).slice(0, 200) : undefined };
}

export type CrearPropuestaDraft = {
  tareas: PropuestaTarea[]; eliminar?: unknown[]; cerrar?: unknown[]; resumen?: string; origen?: string;
  /** nombre de quien se las manda a esta persona ('' = MaKo sola). */
  enviadoPor?: string;
  /** reunión/archivo del que salieron, y cuándo ocurrió. */
  fuenteTitulo?: string; fuenteUrl?: string; fuenteFecha?: string;
  /** el cliente de la reunión, si lo era (resolverClienteDeReunion). */
  clienteNombre?: string; clienteLeadId?: number;
  /** clave anti-duplicado (fathom:<recordingId>). Si ya existe una con esta ref en el ws, no crea otra. */
  ref?: string;
  /** workspace destino. Por defecto el del request; se pasa explícito para MANDARLE tareas a otra persona. */
  ws?: number;
  /** 'procesando' = la fila nace VACÍA y alguien la va a llenar después (la lectura de
   *  archivos en segundo plano). No aparece en la lista de pendientes hasta que se llene. */
  estado?: 'pendiente' | 'procesando';
};

/** El cliente, saneado. leadId 0 es «cliente que es un workspace, no un lead»: no va a la FK. */
function clienteDelBorrador(d: { clienteNombre?: string; clienteLeadId?: number }): { cliente_nombre: string | null; cliente_lead_id: number | null } {
  const nombre = d.clienteNombre?.trim().slice(0, 160) || null;
  const lead = Number(d.clienteLeadId);
  return { cliente_nombre: nombre, cliente_lead_id: nombre && Number.isInteger(lead) && lead > 0 ? lead : null };
}

/** Crea el borrador (por defecto en el workspace actual). Devuelve el id (link /plan/revisar/<id>). */
export async function crearPropuesta(draft: CrearPropuestaDraft): Promise<string> {
  const destino = draft.ws ?? (await wsActual());
  return runWithWorkspace(destino, async () => {
    const db = await getTenantDb();
    const tareas = asArr<unknown>(draft.tareas).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    const eliminar = asArr<unknown>(draft.eliminar).map(limpiarEliminar).filter((e): e is PropuestaEliminar => !!e).slice(0, 30);
    const cerrar = asArr<unknown>(draft.cerrar).map(limpiarCerrar).filter((c): c is PropuestaCerrar => !!c).slice(0, 40);
    const ref = draft.ref?.trim().slice(0, 120) || null;
    // Candado del cron: si esta reunión ya dejó su borrador acá, devolvemos el que hay.
    // Y si estaba DESCARTADO, lo revivimos: volver a extraer la reunión es decir «esto
    // sí me interesa». Sin esto, re-extraer devolvía el id de una fila muerta contra la
    // que `guardarRevision` rechaza escribir (exige 'pendiente') — así que cada
    // corrección que hacía el dueño se tiraba al vacío, en silencio.
    if (ref) {
      const { data } = await db.from('plan_propuestas').select('id, estado, cliente_nombre').eq('ref', ref).maybeSingle();
      if (data) {
        const fila = data as Row;
        // Un borrador de antes de la 0160 no sabe con qué cliente fue. Si la reunión se
        // vuelve a leer y ahora sí se sabe, se completa — nunca se pisa uno que ya estaba.
        if (!fila.cliente_nombre && draft.clienteNombre?.trim()) {
          await db.from('plan_propuestas').update(clienteDelBorrador(draft)).eq('id', str(fila.id));
        }
        // 'fallado' también revive: volver a subir el archivo que falló ES el reintento.
        if (str(fila.estado) === 'descartada' || str(fila.estado) === 'fallado') {
          await db.from('plan_propuestas').update({ estado: draft.estado ?? 'pendiente' }).eq('id', str(fila.id));
          console.log(`[plan-propuesta] borrador ${str(fila.id)} revivido: se volvió a extraer la fuente`);
        }
        return str(fila.id);
      }
    }
    const id = genId('prop');
    const { error } = await db.from('plan_propuestas').insert({
      id, estado: draft.estado ?? 'pendiente', origen: draft.origen ?? 'whatsapp', resumen: (draft.resumen ?? '').slice(0, 300),
      // `notas` eran las preguntas del borrador: nace vacía siempre desde que el alta dejó
      // de preguntar (05/10/2026). `eliminar` = {id,titulo,motivo}; `cerrar` = {id,evidencia,confianza}.
      tareas, notas: [], eliminar, cerrar,
      ref, enviado_por: draft.enviadoPor?.slice(0, 120) ?? null,
      fuente_titulo: draft.fuenteTitulo?.slice(0, 200) ?? null, fuente_url: draft.fuenteUrl?.slice(0, 500) ?? null,
      fuente_fecha: draft.fuenteFecha ?? null,
      ...clienteDelBorrador(draft),
    });
    if (error) throw new Error(`crearPropuesta: ${error.message}`);
    return id;
  });
}

function rowToPropuesta(r: Row): Propuesta {
  return {
    id: str(r.id), estado: (str(r.estado, 'pendiente') as Propuesta['estado']),
    resumen: str(r.resumen), origen: r.origen ? str(r.origen) : undefined,
    tareas: asArr<unknown>(r.tareas).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t),
    eliminar: asArr<unknown>(r.eliminar).map(limpiarEliminar).filter((e): e is PropuestaEliminar => !!e),
    cerrar: asArr<unknown>(r.cerrar).map(limpiarCerrar).filter((c): c is PropuestaCerrar => !!c),
    createdAt: str(r.created_at),
    enviadoPor: r.enviado_por ? str(r.enviado_por) : undefined,
    fuenteTitulo: r.fuente_titulo ? str(r.fuente_titulo) : undefined,
    fuenteUrl: r.fuente_url ? str(r.fuente_url) : undefined,
    fuenteFecha: r.fuente_fecha ? String(r.fuente_fecha) : undefined,
    ref: r.ref ? str(r.ref) : undefined,
    aplicadas: asArr<unknown>(r.aplicadas).map(limpiarAplicada).filter((a): a is PropuestaAplicada => !!a),
    cruzadoAt: r.cruzado_at ? str(r.cruzado_at) : undefined,
    clienteNombre: r.cliente_nombre ? str(r.cliente_nombre) : undefined,
    clienteLeadId: Number(r.cliente_lead_id) > 0 ? Number(r.cliente_lead_id) : undefined,
  };
}

/**
 * ¿Ya hay un borrador para este hecho en este workspace? El cron lo consulta ANTES de
 * gastar tokens leyendo la reunión: sin este candado, cada corrida horaria volvería a
 * analizar la misma grabación.
 */
export async function existePropuestaRef(ref: string, ws?: number): Promise<boolean> {
  const destino = ws ?? (await wsActual());
  return runWithWorkspace(destino, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('id').eq('ref', ref).maybeSingle();
    return !!data;
  });
}

export async function getPropuesta(id: string): Promise<Propuesta | null> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('*').eq('id', id).maybeSingle();
    return data ? rowToPropuesta(data as Row) : null;
  });
}

/**
 * ¿De QUIÉN es este borrador? Solo el workspace y su nombre — NUNCA el contenido.
 *
 * Existe para poder distinguir «este link no existe» de «este link es de otra persona»
 * sin aflojar el aislamiento: `getPropuesta` sigue scopeado al workspace del que mira,
 * así que un borrador ajeno NUNCA se lee. Esto responde una sola pregunta binaria, con
 * el cliente de servicio, y lo único que se puede aprender es que un id existe y de qué
 * cuenta es. Es lo mínimo para poder decir «estas no son tus tareas» en vez de un 404
 * mudo, que es lo que pidió el dueño.
 *
 * ⚠️ NO devolver desde acá ni las tareas, ni el resumen, ni las preguntas.
 */
export async function duenoDePropuesta(id: string): Promise<{ workspaceId: number; nombre: string } | null> {
  const limpio = (id ?? '').trim().slice(0, 80);
  if (!limpio) return null;
  const { data } = await getSupabaseServer().from('plan_propuestas').select('workspace_id').eq('id', limpio).maybeSingle();
  const ws = Number((data as { workspace_id?: unknown } | null)?.workspace_id);
  if (!Number.isFinite(ws)) return null;
  const w = await getWorkspace(ws).catch(() => null);
  return { workspaceId: ws, nombre: (w?.nombre ?? '').trim() || `workspace ${ws}` };
}

/**
 * El borrador de UNA reunión, EN CUALQUIER ESTADO. Es lo que deja volver a una reunión
 * vieja desde el selector de Fathom y ver qué salió de ahí sin gastar un token.
 *
 * ⚠️ Antes acá había un `.neq('estado','descartada')` con este comentario: «si lo
 * tiraste a la basura, la reunión vuelve a ser una reunión sin leer y se puede
 * re-extraer». Ese era el bug de diseño, y es el que hacía que la extracción
 * DESAPARECIERA: cargabas 23 tareas, tocabas «Descartar» para sacarte el modal de
 * encima, y la reunión volvía a decir «Extraer →» como si nunca la hubieras leído —
 * con las 30 de la otra persona y el registro de las 23 adentro, invisibles para
 * siempre. Lo que salió de una reunión es un HECHO: se puede haber terminado o
 * descartado, pero no deja de haber pasado. Quien llama mira `estado` y decide qué
 * mostrar.
 */
export async function getPropuestaPorRef(ref: string): Promise<Propuesta | null> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('*')
      .eq('ref', ref).maybeSingle();
    return data ? rowToPropuesta(data as Row) : null;
  });
}

/** Qué salió de cada reunión (por ref), para marcar la lista del selector de un saque. */
export type ResumenPorRef = { id: string; estado: Propuesta['estado']; creadas: number; pendientesMias: number; pendientesOtros: number };

export async function resumenPropuestasPorRefs(refs: string[]): Promise<Record<string, ResumenPorRef>> {
  const limpias = [...new Set(refs.filter(Boolean))].slice(0, 100);
  if (!limpias.length) return {};
  return enWs(async () => {
    const db = await getTenantDb();
    // TODOS los estados: la lista del selector tiene que poder decir «✓ 23 en tu plan ·
    // 30 para repartir» o «la descartaste» — nunca volver a «Extraer →» como si la
    // reunión no se hubiera leído nunca.
    const { data } = await db.from('plan_propuestas').select('id, ref, estado, tareas, aplicadas')
      .in('ref', limpias);
    const out: Record<string, ResumenPorRef> = {};
    for (const r of asArr<Row>(data)) {
      const ref = str(r.ref);
      if (!ref) continue;
      const tareas = asArr<unknown>(r.tareas).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
      out[ref] = {
        id: str(r.id),
        estado: str(r.estado, 'pendiente') as Propuesta['estado'],
        creadas: asArr<unknown>(r.aplicadas).length,
        pendientesMias: tareas.filter((t) => !t.esDeOtro).length,
        pendientesOtros: tareas.filter((t) => t.esDeOtro).length,
      };
    }
    return out;
  });
}

/**
 * Borradores PENDIENTES del workspace del request, de la más nueva a la más vieja.
 * Es lo que el board consulta al entrar para saltarle el modal "confirmá estas tareas"
 * (las que MaKo sacó sola de tu reunión, o las que te mandó otra persona).
 *
 * Vienen TODOS, con y sin preguntas. Los que traen preguntas no se pueden confirmar
 * de un toque (su gracia es el wizard de /plan/revisar, que las hace de a una), pero
 * tienen que VERSE: filtrarlos acá los volvía invisibles y pasó lo peor —MaKo mandó
 * "entrá al plan a confirmarlas", el dueño entró y no había nada—. El board los
 * muestra como una fila que linkea al wizard.
 *
 * Y volvió a pasar, con los CIERRES. El filtro decía `tareas.length > 0`, que era otra
 * forma de escribir «un borrador sin tareas no existe» — y el bot que lee los commits
 * produce exactamente eso: cero tareas nuevas, N tareas del tablero que ya están hechas.
 * Su primera corrida real dejó 10 propuestas con evidencia y ninguna pantalla las
 * mostraba. Un borrador está vacío cuando no tiene NADA que ofrecer, no cuando no tiene
 * tareas nuevas.
 */
export async function listPropuestasPendientes(limite = 8): Promise<Propuesta[]> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('*')
      .eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(limite);
    return (asArr<Row>(data)).map(rowToPropuesta).filter((p) => p.tareas.length > 0 || (p.cerrar?.length ?? 0) > 0);
  });
}

// ⛔ Acá vivían las tres generadoras de preguntas del alta —las de contexto sobre lo que
// se iba a cargar, las repreguntas «para profundizar» y las tareas extra que salían de lo
// contestado—. Se fueron el 05/10/2026 con el paso de preguntas: «habíamos dicho de sacar
// absolutamente toda la fricción al agregar tareas». Ver docs/hallazgos-plan.md.

export type LoteAplicar = {
  id: string; tareas?: PropuestaTarea[]; eliminarIds?: string[]; contexto?: string;
  /** ids que el dueño CONFIRMÓ que ya están hechas (de `prop.cerrar`). Nada se cierra
   *  sin pasar por acá: el borrador propone, la persona decide. */
  cerrarIds?: string[];
  /** las que dijo «está a medias»: no se cierran, se les sube el avance a la mitad y
   *  se les suma la evidencia al detalle. Perder ese matiz es perder información. */
  aMediasIds?: string[];
  /**
   * Lo que NO se carga y tiene que seguir esperando en el borrador: las tareas que
   * quedaron del lado de otras personas. Lo manda la pantalla porque ahí ya está el
   * reparto CORREGIDO a mano (reasignaciones incluidas), que en la base todavía no
   * está. Si no viene, se asume lo guardado (las marcadas como de otro).
   */
  restantes?: PropuestaTarea[];
};
export type ResultadoAplicar = { ok: boolean; ids: string[]; borradas: number; cerradas?: number; ampliadas?: number; error?: string };

/** Aplica el borrador: crea las tareas y marca 'aplicada'. Dueño → plan_tareas + Perro;
 *  cliente → su board (lib/todo). `tareasEditadas` = lo que quedó en la revisión. */
export async function aplicarPropuesta(id: string, tareasEditadas?: PropuestaTarea[], eliminarIds?: string[], contexto?: string, cerrarIds?: string[], aMediasIds?: string[]): Promise<ResultadoAplicar | null> {
  const r = await aplicarPropuestas([{ id, tareas: tareasEditadas, eliminarIds, contexto, cerrarIds, aMediasIds }]);
  return r.noExiste ? null : { ok: r.ok, ids: r.ids, borradas: r.borradas, cerradas: r.cerradas, error: r.error };
}

/**
 * Aplica VARIOS borradores de una sola vez. Es lo que usa el modal del plan cuando
 * MaKo dejó esperando más de una reunión: se confirman juntas y el PERRO CORRE UNA
 * SOLA VEZ sobre todas las tareas nuevas. Correrlo por borrador tenía dos problemas:
 * cada pasada tarda ~30s (con 3 reuniones se comía el maxDuration de la ruta) y cada
 * una puntuaba su lote a ciegas del resto, cuando lo que hace bueno al Perro es
 * comparar TODO lo nuevo contra el mismo plan.
 */
export async function aplicarPropuestas(lotes: LoteAplicar[]): Promise<ResultadoAplicar & { noExiste?: boolean }> {
  return enWs(async () => {
    const ws = await wsActual();
    const db = await getTenantDb();
    // El board rico (plan_tareas + Perro) es SOLO del super-admin; el resto usa el suyo
    // (lib/todo), que es el que su /plan realmente pinta. OJO: acá hubo un bug — la
    // condición incluía `ws === OWNER_WS`, de cuando el ws 1 era la agencia. Hoy el ws 1
    // es un CLIENTE y su tablero lee experimento_tareas: lo que confirmaba se escribía en
    // una tabla que su pantalla no mira.
    const usaPlanBoard = tableroDeCapa((await getWorkspace(ws))?.capa) === 'dueno';
    // TABLERO ÚNICO (08-T45): con criterio cargado, las tareas de OTRAS personas de la
    // reunión también entran a este tablero, marcadas con su responsable, en vez de
    // quedar en el borrador para repartirse. Sin criterio, todo sigue como siempre
    // (lib/plan-criterio.ts explica por qué es un solo interruptor). Solo el tablero del
    // cliente: `plan_tareas` no tiene dónde guardar el responsable.
    const tableroUnico = !usaPlanBoard && !!(await criterioDelWorkspace());

    const idsCreadas: string[] = [];
    const proyectosNuevos: string[] = [];
    const contextos: string[] = [];
    /** Por borrador: qué se creó y qué le queda pendiente (define si se cierra o sigue vivo). */
    const cierre = new Map<string, { creadas: PropuestaAplicada[]; restantes: PropuestaTarea[] }>();
    const aplicados: string[] = [];
    let borradas = 0;
    let cerradas = 0;
    let ampliadas = 0;   // repetidas que en vez de duplicarse le sumaron contexto a la que ya estaba
    let ultimoError = '';
    let algunoExistia = false;

    for (const lote of lotes) {
      const { data } = await db.from('plan_propuestas').select('estado, origen').eq('id', lote.id).maybeSingle();
      if (!data) continue;
      algunoExistia = true;
      const estado = str((data as Row).estado, 'pendiente');
      if (estado !== 'pendiente') { ultimoError = `La propuesta ya fue ${estado}.`; continue; }
      const prop = await getPropuesta(lote.id);
      // Sin edición explícita entran TODAS menos las de OTRA persona: el plan de uno no se
      // llena con los compromisos ajenos que salieron de la misma reunión (esas viajan a
      // SU tablero por su propio camino).
      // Con tablero único entran TAMBIÉN las de otros — incluidas las que el modal manda
      // aparte como `restantes`: el modal no sabe de este modo, y decide el server.
      const baseCruda = (lote.tareas
        ? [...lote.tareas, ...(tableroUnico ? (lote.restantes ?? []) : [])]
        : (prop?.tareas ?? []).filter((t) => tableroUnico || !t.esDeOtro)
      ).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
      // ANTI-DOBLE-ALTA: el borrador que conserva tareas de OTRAS personas queda
      // 'pendiente', así que el guard de estado no alcanza — apretar dos veces (o
      // reintentar tras un corte) volvía a crear las mismas tareas. Lo ya aplicado
      // vive en `aplicadas`: se filtra por título normalizado.
      const yaHechas = new Set((prop?.aplicadas ?? []).map((a) => a.titulo.trim().toLowerCase()));
      const baseSinRepetir = baseCruda.filter((t) => !yaHechas.has(t.titulo.trim().toLowerCase()));
      if (baseCruda.length !== baseSinRepetir.length) {
        console.warn(`[plan-propuesta] ${lote.id}: ${baseCruda.length - baseSinRepetir.length} tarea(s) ya estaban cargadas de este borrador — no se duplican`);
      }
      // …y contra el TABLERO. `aplicadas` solo sabe de ESTE borrador: cuando la misma
      // reunión se graba dos veces (un notetaker por participante) o cuando alguien ya
      // cargó las tareas a mano desde el modal, el segundo borrador volvía a crear las
      // mismas tarjetas.
      //
      // ⛔ EL DUPLICADO NO SE PREGUNTA, SE RESUELVE. Regla del dueño, textual: «Si
      // detecta que se está subiendo una tarea que ya está, simplemente debe procesarlo
      // internamente y decidir si ignorarla o ampliar contexto de la que ya existía.
      // Seguramente casi siempre decida ampliar contexto. Lo que JAMÁS debe hacer es
      // crear una duplicada». Así que acá se parte en tres, sin pantalla de por medio:
      //   · las que NO están en el tablero  → se crean;
      //   · las que ya están y traen texto  → AMPLÍAN la tarjeta que existe (el caso normal);
      //   · las que ya están y no aportan   → se ignoran, con log.
      // El escape de `forzar` se murió con esto: era la única vía por la que una decisión
      // humana podía dejar la misma tarea escrita dos veces.
      const abiertas = await abiertasDelTablero(usaPlanBoard);
      const base: PropuestaTarea[] = [];
      const aAmpliar: Array<{ id: string; titulo: string; detalle: string }> = [];
      let ignoradas = 0;
      for (const t of baseSinRepetir) {
        // ⚠️ SI EL CRUCE YA DIJO CUÁL ES, SE USA ESE ID. Acá se re-adivinaba por título
        // con `mismaTarea`, que es léxico y corta en 0.7 — o sea que una tarea que el
        // Perro había casado bien («mensaje de WhatsApp después de agendar» con
        // «follow-up post-llamada») no matcheaba, caía en `base` y se CREABA duplicada.
        // Es la misma decisión tomada dos veces con dos criterios distintos, y ganaba el
        // peor. El `enriquece.id` salió de la comparación cara y encima el dueño lo pudo
        // corregir a mano con «es otra tarea»: es el dato más confiable que hay.
        const porCruce = t.enriquece?.id && t.ampliar !== false
          ? abiertas.find((x) => x.id === t.enriquece!.id)
          : undefined;
        const ya = porCruce ?? abiertas.find((x) => mismaTarea(x.titulo, t.titulo));
        if (!ya) { base.push(t); continue; }
        const texto = (t.detalle ?? '').trim();
        if (texto) aAmpliar.push({ id: ya.id, titulo: t.titulo, detalle: texto });
        else ignoradas++;
      }
      if (aAmpliar.length || ignoradas) {
        console.warn(`[plan-propuesta] ${lote.id}: ${aAmpliar.length} tarea(s) ya existían y se AMPLÍAN, ${ignoradas} se ignoran — ninguna se duplica`);
      }
      // Las bajas ya NO se preguntan ni se ejecutan solas: el paso del checkbox se sacó
      // del wizard y sin `eliminarIds` explícito no se borra nada. El default de antes
      // (`?? [...propuestos]`) borraba TODO lo que la IA hubiera propuesto en cuanto el
      // camino del board aplicaba el lote — sin mostrarlo y sin que nadie lo confirmara.
      const propuestos = new Set((prop?.eliminar ?? []).map((e) => e.id));
      const aBorrar = (lote.eliminarIds ?? []).map(String).filter((x) => propuestos.has(x));
      // Los cierres siguen la MISMA regla que las bajas: solo se ejecuta lo que la
      // persona confirmó explícitamente, cruzado contra lo que el borrador propuso.
      // Un id que no estaba en la propuesta no se toca, venga de donde venga.
      const propCerrar = new Map((prop?.cerrar ?? []).map((c) => [c.id, c] as const));
      const confirmados = new Set((lote.cerrarIds ?? []).map(String));
      const medios = new Set((lote.aMediasIds ?? []).map(String));
      const aCerrar = [...confirmados, ...medios]
        .filter((x) => propCerrar.has(x))
        .map((x) => ({ id: x, evidencia: propCerrar.get(x)!.evidencia, parcial: medios.has(x) && !confirmados.has(x) }));
      if (!base.length && !aAmpliar.length && !aBorrar.length && !aCerrar.length) { ultimoError = 'No hay nada para crear, cerrar ni borrar.'; continue; }

      // La FUENTE de cada tarea: de qué reunión salió y EN QUÉ MINUTO se dijo. Con eso,
      // el chip del detalle de la tarjeta abre la grabación parada en ese segundo — el
      // contexto queda a un click para siempre, no solo mientras se revisa el borrador.
      const fuenteTipo = (['whatsapp', 'fathom', 'mako', 'archivo', 'claude-code'].includes(str((data as Row).origen)) ? str((data as Row).origen) : 'whatsapp') as FuenteTipo;
      const tituloFuente = prop?.fuenteTitulo?.trim() ?? '';
      const urlFuente = prop?.fuenteUrl?.trim() ?? '';
      const reloj = (seg: number): string => (seg >= 3600
        ? `${Math.floor(seg / 3600)}:${String(Math.floor((seg % 3600) / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`
        : `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`);
      const fuenteDe = (t: PropuestaTarea): Fuente => {
        const todos = t.minutos?.length ? t.minutos : (t.minuto != null ? [t.minuto] : []);
        const seg = todos[0];
        // Varios momentos → la etiqueta los lista y el link abre el primero.
        const relojTxt = todos.length ? todos.map(reloj).join(', ') : '';
        return {
          tipo: fuenteTipo,
          etiqueta: [tituloFuente, relojTxt].filter(Boolean).join(' · ') || undefined,
          url: urlFuente ? (seg != null ? `${urlFuente}${urlFuente.includes('?') ? '&' : '?'}timestamp=${seg}` : urlFuente) : undefined,
        };
      };

      const creadas: PropuestaAplicada[] = [];
      const anotar = (t: PropuestaTarea, tareaId: string): void => {
        creadas.push({ titulo: t.titulo, tareaId, minutos: t.minutos?.length ? t.minutos : (t.minuto != null ? [t.minuto] : undefined) });
      };

      if (usaPlanBoard) {
        if (base.length) {
          // `recurrente` va en el ALTA (NuevaTareaPlan): es el último eslabón de la
          // cadena que arranca en el prompt de extracción. Si se cae acá, todo lo de
          // arriba está escrito y no se ofrece.
          const r = await agregarTareasPlanOwner(base.map((t) => ({ titulo: t.titulo, prioridad: t.prioridad, proyecto: t.proyecto, deadline: t.deadline, detalle: t.detalle, recurrente: t.recurrente, fuente: fuenteDe(t) })), { tipo: fuenteTipo } as Fuente);
          idsCreadas.push(...r.ids);
          proyectosNuevos.push(...r.proyectoIds);
          // Mismo orden que `base` (agregarTareasPlanOwner filtra solo los títulos
          // vacíos, y acá no hay ninguno): la tarea i quedó con el id i.
          r.ids.forEach((id, i) => { if (base[i]) anotar(base[i], id); });
        }
        // Las repetidas: se le SUMA el contexto a la tarjeta que ya está. Y se anotan
        // como "aplicadas" igual que las creadas — si no, el borrador se reabre y las
        // vuelve a ofrecer para siempre.
        if (aAmpliar.length) {
          const r = await ampliarTareasPlanOwner(aAmpliar.map((a) => ({ id: a.id, detalle: a.detalle })), { tipo: fuenteTipo } as Fuente)
            .catch((e) => { console.error('[plan-propuesta] ampliar owner:', e instanceof Error ? e.message : String(e)); return { n: 0, patches: [] }; });
          ampliadas += r.n;
          for (const a of aAmpliar) creadas.push({ titulo: a.titulo, tareaId: a.id });
        }
        for (const eid of aBorrar) { await borrarPlanTarea(eid).catch((e) => console.error('[plan-propuesta] borrar owner:', e instanceof Error ? e.message : String(e))); borradas += 1; }
        // CERRAR ≠ BORRAR: la tarjeta queda con su historial y su checklist, y se le
        // suma la evidencia. Es la diferencia entre «esto se hizo, mirá dónde» y
        // «esto no existió nunca».
        for (const c of aCerrar) {
          try {
            // Solo suma si de verdad tocó una fila: ver el porqué en la firma.
            if (await cerrarPlanTareaOwner(c.id, c.evidencia, c.parcial)) cerradas += 1;
          } catch (e) { console.error('[plan-propuesta] cerrar owner:', e instanceof Error ? e.message : String(e)); }
        }
      } else {
        // CLIENTE: su board va por lib/todo (crea la categoría si falta). Ya estamos en su ws.
        if (base.length) {
          const cats = await listCategorias().catch(() => [] as Array<{ id: number; nombre: string }>);
          const byName = new Map(cats.map((c) => [normNom(c.nombre), c.id]));
          // RUTEO DE TODO EL LOTE, de una: ¿es de un cliente suyo? ¿nombra un proyecto
          // que ya existe? y si no, ¿a qué ÁREA del catálogo va (lib/todo-proyectos-
          // catalogo)? Antes el fallback era el nombre que se le hubiera ocurrido a
          // quien la cargó, y así nacían cincuenta proyectos de una tarea cada uno.
          const destinos = await rutearTareasCliente(base.map((t) => ({ titulo: t.titulo, detalle: t.detalle, proyectoSugerido: t.proyecto })))
            .catch((e) => { console.error('[plan-propuesta] rutear cliente:', e instanceof Error ? e.message : String(e)); return base.map(() => ({ razon: '' } as { nombre?: string; razon: string; color?: string; emoji?: string })); });
          for (let bi = 0; bi < base.length; bi++) {
            const t = base[bi];
            try {
              let catId: number | undefined;
              const d = destinos[bi] ?? { razon: '' };
              const proyectoFinal = d.nombre ?? t.proyecto;
              if (proyectoFinal) {
                const nombre = proyectoFinal.slice(0, 40).trim();
                const k = normNom(nombre);
                catId = byName.get(k);
                if (catId == null) { const c = await crearCategoria(nombre, d.color ?? '#2F6FED'); catId = c.id; byName.set(k, c.id); }
              }
              const tarea = await crearTarea({
                titulo: t.titulo, prioridad: (t.prioridad ?? 'media') as Prioridad, deadline: t.deadline ?? null, detalle: t.detalle ?? null, categorias: catId != null ? [catId] : [], origen: 'mako', fuente: fuenteDe(t),
                // El tablero del CLIENTE también tiene la columna (mig 0163): una tarea
                // sólo puede nacer recurrente en los dos lados o en ninguno.
                recurrente: t.recurrente,
                // QUIÉN (mig 0159). Se escribe en TODOS los clientes, no solo con tablero
                // único: es dato de la reunión y sin él no hay filtro «míos / me deben».
                responsable: t.dueno ?? null, responsable_email: t.duenoEmail ?? null,
                responsable_tipo: tipoDeResponsable(t, !!prop?.clienteNombre),
                cliente_nombre: prop?.clienteNombre ?? null, cliente_lead_id: prop?.clienteLeadId ?? null,
              });
              idsCreadas.push(String(tarea.id));
              anotar(t, String(tarea.id));
            } catch (e) { console.error('[plan-propuesta] crearTarea cliente:', e instanceof Error ? e.message : String(e)); }
          }
        }
        if (aAmpliar.length) {
          const n = await ampliarTareasCliente(aAmpliar.map((a) => ({ id: Number(a.id), detalle: a.detalle })), fuenteTipo === 'fathom' ? 'de la reunión' : 'MaKo')
            .catch((e) => { console.error('[plan-propuesta] ampliar cliente:', e instanceof Error ? e.message : String(e)); return 0; });
          ampliadas += n;
          for (const a of aAmpliar) creadas.push({ titulo: a.titulo, tareaId: a.id });
        }
        for (const eid of aBorrar) { const n = Number(eid); if (Number.isFinite(n)) { await borrarTarea(n).catch((e) => console.error('[plan-propuesta] borrar cliente:', e instanceof Error ? e.message : String(e))); borradas += 1; } }
        for (const c of aCerrar) {
          const n = Number(c.id);
          if (!Number.isFinite(n)) continue;
          try {
            const actual = (await listTareas()).find((t) => t.id === n);
            await editarTarea(n, {
              progreso: c.parcial ? Math.max(50, actual?.progreso ?? 0) : 100,
              detalle: c.parcial ? fusionarDetalle(actual?.detalle ?? '', c.evidencia) : (actual?.detalle ?? null),
              historial: [{ id: `cerr${Date.now()}${n}`, ts: Date.now(), actor: 'ia', text: renglonDeCierre(c.evidencia, c.parcial) }, ...(actual?.historial ?? [])],
            });
            cerradas += 1;
          } catch (e) { console.error('[plan-propuesta] cerrar cliente:', e instanceof Error ? e.message : String(e)); }
        }
      }
      if (lote.contexto?.trim()) contextos.push(lote.contexto.trim());
      // Lo que le queda: por defecto, lo que está marcado como de otra persona. Con
      // tablero único no queda nada: ya entró todo, y un borrador abierto «para repartir»
      // volvería a ofrecer lo que ya está en el tablero.
      const restantes = (tableroUnico ? [] : (lote.restantes ?? (prop?.tareas ?? []).filter((t) => t.esDeOtro)))
        .map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
      cierre.set(lote.id, { creadas, restantes });
      aplicados.push(lote.id);
    }

    if (!algunoExistia) return { ok: false, ids: [], borradas: 0, noExiste: true };
    if (!aplicados.length) return { ok: false, ids: [], borradas: 0, error: ultimoError || 'No se pudo aplicar.' };
    // ⚠️ AMPLIAR ES UN RESULTADO, NO UN FALLO. Sin `ampliadas` en esta condición, un lote
    // donde TODO era ampliación —una reunión que solo le suma contexto a tarjetas que ya
    // existen— devolvía «No pude crear ninguna tarea»: el modal mostraba error, no se
    // cerraba, el borrador NO se marcaba aplicado, y el dueño volvía a apretar. Cada
    // intento AMPLIABA de nuevo. Lo reportó así: «le di a cargar al plan y no hizo nada…
    // me preguntó varias veces lo mismo y le daba y no hacía nada». Sí hizo: amplió 7
    // tarjetas y después dijo que había fallado.
    if (!idsCreadas.length && !borradas && !cerradas && !ampliadas) return { ok: false, ids: [], borradas: 0, error: 'No pude crear ni ampliar ninguna tarea.' };

    // El borrador se marca APLICADO acá, ANTES del Perro. El Perro es una mejora
    // (prioridad + checklist), no parte del alta: si tarda o se cae, las tareas ya
    // están creadas y el borrador NO puede volver a aplicarse. Al revés —como estaba—
    // un timeout dejaba 69 tareas creadas y el borrador "pendiente", listo para
    // duplicarlas enteras al siguiente click.
    //
    // Y NO siempre se cierra: si de esa reunión quedaron compromisos de OTRAS personas
    // sin repartir, el borrador sigue PENDIENTE con solo esos adentro. Cerrarlo era
    // perderlos —el modal no se podía reabrir y esas tareas no vivían en ningún lado—.
    // Las que sí se cargaron pasan a `aplicadas`: no se vuelven a ofrecer, pero se
    // siguen viendo, ahora linkeadas a la tarjeta real del board.
    const now = new Date().toISOString();
    for (const id of aplicados) {
      const c = cierre.get(id);
      const previas = (await getPropuesta(id))?.aplicadas ?? [];
      const aplicadas = [...previas, ...(c?.creadas ?? [])];
      const quedan = c?.restantes ?? [];
      // `notas` (las preguntas PENDIENTES) se vacía SIEMPRE: hablaban de las tareas que
      // acaban de aplicarse. ⚠️ `revision` —el acta de lo que se preguntó y se contestó—
      // NO se toca: es lo único que queda para auditar el formulario después, y es
      // justo después cuando uno lo necesita. Ver `guardarActaRevision`.
      // hablaban de las tareas que acaban de
      // entrar al plan (o que destildaste). Dejarlas hacía que el borrador reabierto te
      // volviera a preguntar por trabajo que ya está hecho.
      await db.from('plan_propuestas').update(quedan.length
        ? { tareas: quedan, aplicadas, notas: [], applied_at: now }
        : { estado: 'aplicada', aplicadas, notas: [], applied_at: now }).eq('id', id);
    }

    // El Perro, POR TANDAS. Puntuar 69 tareas en una sola llamada no entra en el
    // tiempo de la función (y encima el modelo se queda sin salida).
    //
    // 10 y no 20: con 20 tareas de detalle largo el JSON del modelo se corta a la mitad
    // y el lote entero queda con el score de fábrica. Pasó el 5/8 con las 20 del
    // documento de rediseño — 20 tarjetas con score 62, sin razón y sin fecha. El techo
    // de salida ahora escala con el lote (topeSalidaPerro), pero una tanda más chica
    // además ordena mejor: el modelo compara diez tareas entre sí, no veinte.
    if (idsCreadas.length) {
      const contexto = contextos.join(' ');
      const TANDA = 10;
      for (let i = 0; i < idsCreadas.length; i += TANDA) {
        const lote = idsCreadas.slice(i, i + TANDA);
        const nota = idsCreadas.length > TANDA ? `${contexto} (tanda ${Math.floor(i / TANDA) + 1} de ${Math.ceil(idsCreadas.length / TANDA)})` : contexto;
        if (usaPlanBoard) {
          // Los proyectos nuevos se describen en la primera tanda nomás.
          await priorizarNuevasOwner(lote, i === 0 ? proyectosNuevos : [], nota).catch((e) => { console.error('[plan-propuesta] priorizar:', e instanceof Error ? e.message : String(e)); return null; });
        } else {
          // Acá los patches se descartan a propósito: este camino (wizard de borradores)
          // recarga el board después, no aplica parches en vivo como el tablero.
          await priorizarNuevasCliente(lote.map(Number).filter(Number.isFinite), nota)
            .catch((e) => { console.error('[plan-propuesta] perro cliente:', e instanceof Error ? e.message : String(e)); return { n: 0, patches: [] }; });
        }
      }
    }
    return { ok: true, ids: idsCreadas, borradas, cerradas, ampliadas };
  });
}

/**
 * Guarda la REVISIÓN en curso de un borrador: el reparto (mío / de fulano), lo
 * destildado y las correcciones de título y contexto. No aplica nada — solo deja el
 * borrador como lo dejó el dueño.
 *
 * Existe porque la revisión de una reunión larga no se hace de una sentada: se
 * reasignan veinte tareas, se corrige el texto de otras, y con un F5 (o cerrando el
 * modal) se perdía TODO y volvía el reparto que había adivinado MaKo.
 *
 * Solo toca borradores PENDIENTES y nunca cambia el estado: si ya se aplicó o se
 * descartó, no hay revisión que guardar.
 */
/** El borrador pasa de 'procesando' a 'pendiente' con lo que salió. Es el final feliz
 *  de la lectura en segundo plano: hasta acá la fila existía vacía. */
export async function marcarProcesado(id: string, datos: { tareas: Array<Record<string, unknown>>; resumen?: string; avisos?: string[] }): Promise<void> {
  return enWs(async () => {
    const limpias = datos.tareas.map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    const db = await getTenantDb();
    const resumen = [datos.resumen ?? '', (datos.avisos ?? []).length ? `· ${(datos.avisos ?? []).length} archivo(s) no se pudieron leer` : ''].filter(Boolean).join(' ').slice(0, 300);
    const { error } = await db.from('plan_propuestas')
      .update({ estado: limpias.length ? 'pendiente' : 'descartada', tareas: limpias, resumen })
      .eq('id', id);
    if (error) console.error(`[plan-propuesta] marcarProcesado ${id}: ${error.message}`);
  });
}

/** La lectura falló. El error queda EN la fila, no solo en el log: si no, el borrador se
 *  queda en 'procesando' para siempre y nadie sabe por qué. */
export async function marcarFallado(id: string, motivo: string): Promise<void> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { error } = await db.from('plan_propuestas')
      .update({ estado: 'fallado', resumen: `No pude leerlo: ${motivo}`.slice(0, 300) })
      .eq('id', id);
    if (error) console.error(`[plan-propuesta] marcarFallado ${id}: ${error.message}`);
  });
}

/** El estado de un borrador, para que el modal pueda esperar sin bloquear nada.
 *  Devuelve las tareas también: cuando la lectura en segundo plano termina, el modal
 *  tiene que poder mostrarlas sin una segunda vuelta. */
/**
 * ⚠️ `cruzadoAt` VA EN LA RESPUESTA, y no es un detalle: es lo único que distingue «este
 * borrador todavía no se comparó con el plan» de «ya se comparó y no encontró nada». Sin
 * él, quien abre el borrador no puede saberlo y vuelve a pagar la comparación cada vez —
 * que es exactamente lo que pasaba en la extracción manual (13/8/2026): entrar, salir y
 * volver a entrar disparaba el cruce de nuevo, con su llamada de IA y pisando lo que el
 * dueño ya había decidido.
 */
export async function estadoDePropuesta(id: string): Promise<{ estado: string; n: number; resumen: string; tareas: PropuestaTarea[]; cruzadoAt?: string } | null> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('estado, tareas, resumen, cruzado_at').eq('id', id).limit(1);
    const fila = (data ?? [])[0] as Row | undefined;
    if (!fila) return null;
    const tareas = asArr<unknown>(fila.tareas).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    return {
      estado: str(fila.estado, 'pendiente'), n: tareas.length, resumen: str(fila.resumen), tareas,
      cruzadoAt: fila.cruzado_at ? str(fila.cruzado_at) : undefined,
    };
  });
}

export async function guardarRevision(id: string, tareas: PropuestaTarea[], marcarCruzado = false): Promise<boolean> {
  return enWs(async () => {
    const limpias = tareas.map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    if (!limpias.length) return false;
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('estado').eq('id', id).maybeSingle();
    if (!data || str((data as Row).estado, 'pendiente') !== 'pendiente') return false;
    // `cruzado_at` (mig 0123) es lo que hace que el cruce anti-duplicados corra UNA vez
    // por borrador y no en cada apertura del modal. El resultado en sí viaja adentro de
    // cada tarea (`enriquece`); esta marca es lo único que distingue «se cruzó y no
    // encontró nada» de «todavía no se cruzó».
    const patch: Row = { tareas: limpias };
    if (marcarCruzado) patch.cruzado_at = new Date().toISOString();
    const { error } = await db.from('plan_propuestas').update(patch).eq('id', id);
    if (error) { console.error(`[plan-propuesta] guardarRevision ${id}: ${error.message}`); return false; }
    return true;
  });
}

export async function descartarPropuesta(id: string): Promise<boolean> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { error } = await db.from('plan_propuestas').update({ estado: 'descartada' }).eq('id', id).eq('estado', 'pendiente');
    return !error;
  });
}
