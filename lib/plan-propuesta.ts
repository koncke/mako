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
import { agregarTareasPlanOwner, ampliarTareasPlanOwner, priorizarNuevasOwner, borrarPlanTarea, listPlanBoard } from '@/lib/plan-board';
import { crearTarea, crearCategoria, listCategorias, borrarTarea, listTareas, ampliarTareasCliente, type Prioridad } from '@/lib/todo';
import { priorizarNuevasCliente } from '@/lib/todo-guardian';
import { mismaTarea, normTitulo } from '@/lib/tareas-dedup';
import { rutearTareasCliente } from '@/lib/todo-rutear';
import { chatCheapCascade } from '@/lib/ai-cheap';
import { parseJsonObject } from '@/lib/campaign-structurer';
import type { Prio, Fuente, FuenteTipo } from '@/app/plan/board/types';

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


export type PropuestaTarea = {
  titulo: string; proyecto?: string; deadline?: string; detalle?: string; prioridad?: Prio;
  // Reparto por persona (reuniones): quién asumió la tarea y si es de OTRO. Viajan
  // dentro del borrador para que el modal de confirmación muestre las mismas tabs
  // (Mías + una por colaborador) que la extracción manual.
  dueno?: string; duenoEmail?: string; esDeOtro?: boolean;
  /** segundo de la grabación donde se dijo (para ir a escuchar ese momento). */
  minuto?: number;
  /** TODOS los momentos en que se habló de esto (una tarea puede volver varias veces). */
  minutos?: number[];
  /** ¿queda tildada para cargar? `false` = el dueño la destildó. undefined = sí (default).
   *  Se persiste para que la revisión sobreviva a un F5: antes vivía solo en el estado
   *  del modal y con recargar la página volvía todo al reparto que había adivinado MaKo. */
  incluir?: boolean;
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
export type TipoPregunta = 'opcion' | 'multi' | 'escala' | 'texto' | 'comparacion';
export type PropuestaPregunta = {
  pregunta: string; opciones: string[]; tipo: TipoPregunta;
  /** títulos de las tareas de las que habla (para no hacerla si ya no son tuyas). */
  sobre?: string[];
};
export type PropuestaEliminar = { id: string; titulo?: string; motivo?: string };
export type Propuesta = {
  id: string; estado: 'pendiente' | 'aplicada' | 'descartada'; resumen: string; origen?: string;
  tareas: PropuestaTarea[]; preguntas: PropuestaPregunta[]; eliminar: PropuestaEliminar[]; createdAt: string;
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
  const titulo = str(o.titulo).trim().slice(0, 200);
  if (!titulo) return null;
  return {
    titulo,
    proyecto: o.proyecto ? str(o.proyecto).trim().slice(0, 120) : undefined,
    deadline: typeof o.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline) ? o.deadline : undefined,
    // 6000, igual que `plan_tareas.detalle` (agregarTareasPlanOwner). Estaba en 600 y era
    // el último cuello del contexto: el dueño manda tres minutos de audio, la extracción
    // escribe un detalle rico… y el borrador lo cortaba a mitad de frase antes de que
    // nadie lo leyera. Recortar acá es peor que en cualquier otro lado, porque es donde
    // el texto ENTRA al sistema: lo que se pierde no se recupera después.
    detalle: o.detalle ? str(o.detalle).slice(0, 6000) : undefined,
    prioridad: PRIOS.includes(o.prioridad as Prio) ? (o.prioridad as Prio) : undefined,
    dueno: o.dueno ? str(o.dueno).trim().slice(0, 80) : undefined,
    duenoEmail: o.duenoEmail ? str(o.duenoEmail).trim().toLowerCase().slice(0, 160) : undefined,
    esDeOtro: o.esDeOtro === true ? true : undefined,
    minuto: Number.isFinite(Number(o.minuto)) && Number(o.minuto) >= 0 ? Math.round(Number(o.minuto)) : undefined,
    minutos: Array.isArray(o.minutos)
      ? [...new Set((o.minutos as unknown[]).map((x) => Math.round(Number(x))).filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b)
      : undefined,
    incluir: o.incluir === false ? false : undefined,
  };
}
function limpiarEliminar(e: unknown): PropuestaEliminar | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const id = str(o.id).trim().slice(0, 80);
  if (!id) return null;
  return { id, titulo: o.titulo ? str(o.titulo).slice(0, 200) : undefined, motivo: o.motivo ? str(o.motivo).slice(0, 300) : undefined };
}
// Acepta {pregunta, opciones} o (compat) una nota-string suelta.
const TIPOS_PREGUNTA: TipoPregunta[] = ['opcion', 'multi', 'escala', 'texto', 'comparacion'];
/**
 * El techo de preguntas según cuántas tareas se cargan: ~1 cada 3, con piso y techo.
 * Antes era 6 SIEMPRE — cargar 2 tareas y cargar 40 hacían la misma cantidad de
 * preguntas, que es justo lo que no cierra: con 40, 34 entraban sin que nadie
 * preguntara nada y el Perro las puntuaba a ojo.
 */
export const topePreguntas = (nTareas: number): number =>
  Math.max(2, Math.min(16, Math.ceil(nTareas / 3) + 1));

/**
 * ¿Las opciones son LA LISTA QUE LE PASAMOS en vez de una respuesta?
 *
 * Es el error concreto que apareció (y es el único de "pregunta sin sentido" que se
 * puede detectar sin entender el significado):
 *
 *   «¿los cinco grupos son fijos o hay que validar si algún módulo no encaja?»
 *   opciones: [General renovado] [CRM] [Chats] [Plan] [Dashboard]
 *
 * El modelo tenía la lista de tareas en el prompt y la devolvió como opciones de un
 * enunciado binario. Se reconoce sin adivinar: (a) el enunciado plantea DOS caminos
 * («… A o B?»), (b) hay más de dos opciones, y (c) TODAS las opciones son texto que
 * viene de la lista que le pasamos, no una respuesta.
 *
 * Intencionalmente estrecho. Una primera versión más ambiciosa —"ninguna opción
 * comparte palabra con la disyuntiva"— descartó una pregunta perfectamente sana
 * («¿hay alguien del equipo entrando, o son todos de un solo dueño?» con opciones
 * «Todavía nadie…», «Sí, en el equipo de Mauricio»): perder una pregunta buena en
 * silencio es peor que dejar pasar una mala, que el dueño puede saltear.
 */
const palabras = (s: string): Set<string> => new Set(
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9ñ ]/gi, ' ').split(/\s+/).filter((w) => w.length >= 4),
);
export function opcionesSonLaLista(pregunta: string, opciones: string[], universo: string[]): boolean {
  if (opciones.length <= 2 || !universo.length) return false;
  if (!/\bo\b[^?]{6,90}\?\s*$/i.test(pregunta)) return false;   // no plantea dos caminos
  const heno = ` ${universo.map((u) => u.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()).join(' | ')} `;
  // TODAS tienen que venir de la lista: con que una sea una respuesta de verdad,
  // la pregunta se respeta.
  return opciones.every((op) => {
    const ws = [...palabras(op)];
    return ws.length > 0 && ws.every((w) => heno.includes(w));
  });
}

function limpiarPregunta(p: unknown): PropuestaPregunta | null {
  if (typeof p === 'string') return p.trim() ? { pregunta: p.trim().slice(0, 300), opciones: [], tipo: 'texto' } : null;
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const pregunta = str(o.pregunta).trim().slice(0, 300);
  if (!pregunta) return null;
  const opciones = asArr<unknown>(o.opciones).map((x) => str(x).trim()).filter(Boolean).slice(0, 6);
  let tipo = TIPOS_PREGUNTA.includes(o.tipo as TipoPregunta) ? (o.tipo as TipoPregunta) : (opciones.length ? 'opcion' : 'texto');
  // COHERENCIA TIPO ↔ OPCIONES. El modelo manda "tipo": "opcion" y se olvida las
  // opciones, y la pantalla dibujaba el enunciado con CERO botones: una pregunta que no
  // se puede contestar ni saltear bien. Acá se degrada a lo que sí se puede responder.
  if (tipo !== 'escala' && !opciones.length) tipo = 'texto';
  // "comparacion" es enfrentar DOS: con una sola opción no hay comparación, y con tres
  // la pantalla dibuja tres columnas para una pregunta que dice "¿cuál de los dos?".
  if (tipo === 'comparacion' && opciones.length !== 2) tipo = opciones.length ? 'opcion' : 'texto';
  const sobre = asArr<unknown>(o.sobre).map((x) => str(x).trim().slice(0, 200)).filter(Boolean).slice(0, 8);
  // La escala NO usa opciones (se muestran 1..5): si el modelo mandó etiquetas, se
  // tiran acá para que la pantalla no muestre dos cosas distintas a la vez.
  return { pregunta, opciones: tipo === 'escala' ? [] : opciones, tipo, sobre: sobre.length ? sobre : undefined };
}

export type CrearPropuestaDraft = {
  tareas: PropuestaTarea[]; preguntas?: unknown[]; eliminar?: unknown[]; resumen?: string; origen?: string;
  /** nombre de quien se las manda a esta persona ('' = MaKo sola). */
  enviadoPor?: string;
  /** reunión/archivo del que salieron, y cuándo ocurrió. */
  fuenteTitulo?: string; fuenteUrl?: string; fuenteFecha?: string;
  /** clave anti-duplicado (fathom:<recordingId>). Si ya existe una con esta ref en el ws, no crea otra. */
  ref?: string;
  /** workspace destino. Por defecto el del request; se pasa explícito para MANDARLE tareas a otra persona. */
  ws?: number;
};

/** Crea el borrador (por defecto en el workspace actual). Devuelve el id (link /plan/revisar/<id>). */
export async function crearPropuesta(draft: CrearPropuestaDraft): Promise<string> {
  const destino = draft.ws ?? (await wsActual());
  return runWithWorkspace(destino, async () => {
    const db = await getTenantDb();
    const tareas = asArr<unknown>(draft.tareas).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    const preguntas = asArr<unknown>(draft.preguntas).map(limpiarPregunta).filter((p): p is PropuestaPregunta => !!p).slice(0, 25);
    const eliminar = asArr<unknown>(draft.eliminar).map(limpiarEliminar).filter((e): e is PropuestaEliminar => !!e).slice(0, 30);
    const ref = draft.ref?.trim().slice(0, 120) || null;
    // Candado del cron: si esta reunión ya dejó su borrador acá, devolvemos el que hay.
    if (ref) {
      const { data } = await db.from('plan_propuestas').select('id').eq('ref', ref).maybeSingle();
      if (data) return str((data as Row).id);
    }
    const id = genId('prop');
    const { error } = await db.from('plan_propuestas').insert({
      id, estado: 'pendiente', origen: draft.origen ?? 'whatsapp', resumen: (draft.resumen ?? '').slice(0, 300),
      tareas, notas: preguntas, eliminar, // `notas` guarda {pregunta,opciones}; `eliminar` = {id,titulo,motivo}
      ref, enviado_por: draft.enviadoPor?.slice(0, 120) ?? null,
      fuente_titulo: draft.fuenteTitulo?.slice(0, 200) ?? null, fuente_url: draft.fuenteUrl?.slice(0, 500) ?? null,
      fuente_fecha: draft.fuenteFecha ?? null,
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
    preguntas: asArr<unknown>(r.notas).map(limpiarPregunta).filter((p): p is PropuestaPregunta => !!p),
    eliminar: asArr<unknown>(r.eliminar).map(limpiarEliminar).filter((e): e is PropuestaEliminar => !!e),
    createdAt: str(r.created_at),
    enviadoPor: r.enviado_por ? str(r.enviado_por) : undefined,
    fuenteTitulo: r.fuente_titulo ? str(r.fuente_titulo) : undefined,
    fuenteUrl: r.fuente_url ? str(r.fuente_url) : undefined,
    fuenteFecha: r.fuente_fecha ? String(r.fuente_fecha) : undefined,
    ref: r.ref ? str(r.ref) : undefined,
    aplicadas: asArr<unknown>(r.aplicadas).map(limpiarAplicada).filter((a): a is PropuestaAplicada => !!a),
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
 * El borrador de UNA reunión, esté pendiente o ya aplicado (los descartados no: si lo
 * tiraste a la basura, la reunión vuelve a ser una reunión sin leer y se puede
 * re-extraer). Es lo que deja volver a una reunión vieja desde el selector de Fathom y
 * ver qué salió de ahí sin gastar un solo token en releerla.
 */
export async function getPropuestaPorRef(ref: string): Promise<Propuesta | null> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('*')
      .eq('ref', ref).neq('estado', 'descartada').maybeSingle();
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
    const { data } = await db.from('plan_propuestas').select('id, ref, estado, tareas, aplicadas')
      .in('ref', limpias).neq('estado', 'descartada');
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
 */
export async function listPropuestasPendientes(limite = 8): Promise<Propuesta[]> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('*')
      .eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(limite);
    return (asArr<Row>(data)).map(rowToPropuesta).filter((p) => p.tareas.length > 0);
  });
}

// ── Formularios DINÁMICOS: repreguntas generadas según lo ya respondido ──────────
// El wizard, tras las preguntas iniciales, llama acá con las respuestas. MaKo genera
// 0-3 preguntas de SEGUIMIENTO que profundizan el CONTEXTO para que el PERRO decida —
// NUNCA la prioridad. IA barata (nunca Claude), formatos variados. Si no hay nada que
// profundizar, devuelve lista vacía y el wizard sigue de largo.
const PROFUNDIZAR_SYSTEM = `Sos MaKo, cargando tareas al plan de un negocio. El dueño ya respondió unas preguntas de contexto. Tu trabajo: decidir si hace falta PROFUNDIZAR con PREGUNTAS DE SEGUIMIENTO para que EL PERRO GUARDIÁN pueda decidir la prioridad con buen criterio.
VOS decidís cuántas: pueden ser NINGUNA (si lo respondido ya alcanza), una, o las que de verdad hagan falta. No inventes por inventar ni te cortes por miedo a preguntar de más.
⛔ REGLA DURA: NUNCA preguntes qué prioridad poner ni qué le urge — eso lo decide el Perro (el dueño exagera y no sabe priorizar). Preguntá HECHOS que una respuesta previa recién abrió: un deadline que apareció, una dependencia o bloqueo, un número de plata, un alcance ambiguo, qué sería "listo".
CRITERIO — cada pregunta tiene que TENER SENTIDO y sumar: si la respuesta es obvia, se contradice con lo ya dicho, o no cambia nada para el Perro, NO la hagas.

⛔⛔ LA REGLA QUE MÁS SE ROMPE — CADA OPCIÓN TIENE QUE SER UNA RESPUESTA POSIBLE A LA PREGUNTA. Leé tu pregunta y leé tus opciones: si al elegir una opción la frase no queda contestada, está mal. Es el error más común y el que hace que el dueño abandone el formulario.
  MAL (pasó de verdad): pregunta "¿los grupos propuestos (Hoy, Operar, Analizar, Crear, Administrar) son fijos o hay que validar si algún módulo no encaja?" con opciones ["General renovado", "CRM", "Chats", "Plan", "Dashboard"]. La pregunta es "¿A o B?" y las opciones son una lista de módulos: NINGUNA la contesta.
  BIEN, dos salidas para esa misma pregunta:
    · si de verdad querés saber A o B → tipo "opcion", opciones ["Los cinco grupos son fijos", "Hay que revisar si algún módulo no encaja"].
    · si lo que querés saber es CUÁLES no encajan → cambiá el enunciado a "¿Qué módulos no encajan en ninguno de los cinco grupos?", tipo "multi", y ahí sí la lista de módulos.
  Nunca dejes un enunciado binario con una lista de sustantivos abajo.

CRITERIO — elegí el TIPO por pregunta (pensá cuál es el mejor): "multi" si pueden valer VARIAS respuestas a la vez (no agregues una opción "Ambas/Todas": que tilde varias) · "opcion" si es una elección EXCLUYENTE · "escala" para intensidad 1-5 · "comparacion" para enfrentar DOS ítems. NADA de preguntas ABIERTAS: siempre con opciones para tocar. Para opcion/multi/comparacion pasá 2-6 "opciones" cortas.
La "escala" NO lleva opciones (el dueño ve 1 a 5), así que la pregunta TIENE que decir qué significa cada extremo: "(1 = es una idea, 5 = ya está comprometido)".
"sobre" = el título EXACTO de la tarea (o hasta 4) de la que habla la pregunta, tal cual te lo pasé. Es lo que le muestra al dueño de qué le estás hablando: sin eso, una pregunta correcta sobre la tarea 14 de 20 se lee como una pregunta al azar.
Devolvé EXCLUSIVAMENTE un objeto JSON (sin markdown) con esta forma EXACTA:
{ "preguntas": [ { "pregunta": "<corta, sobre un hecho>", "tipo": "opcion|multi|escala|comparacion", "opciones": ["...", "..."], "sobre": ["<título exacto>"] } ] }
Español rioplatense. Si no hace falta ninguna, { "preguntas": [] }.`;

export async function profundizarPropuesta(id: string, respuestas: Array<{ pregunta: string; respuesta: string }>): Promise<PropuestaPregunta[]> {
  const prop = await getPropuesta(id);
  if (!prop || prop.estado !== 'pendiente') return [];
  const respStr = (respuestas || []).filter((r) => r?.respuesta?.trim()).map((r) => `P: ${r.pregunta}\nR: ${r.respuesta}`).join('\n\n');
  if (!respStr.trim()) return []; // sin respuestas, no hay de dónde profundizar
  const tareasStr = prop.tareas.map((t, i) => `${i + 1}. ${t.titulo}${t.proyecto ? ` [${t.proyecto}]` : ''}${t.detalle ? ` — ${t.detalle}` : ''}`).join('\n');
  const user = `TAREAS QUE SE ESTÁN CARGANDO:\n${tareasStr}\n\nRESPUESTAS DE CONTEXTO YA DADAS:\n${respStr}\n\nGenerá 0-3 preguntas de SEGUIMIENTO (solo si una respuesta abre algo que vale aclarar). JSON.`;
  // maxTokens amplio: la IA decide cuántas preguntas hacen falta (no la limitamos a un
  // número). El slice(0, 40) es solo un tope de SEGURIDAD (respuesta rota), no un límite real.
  const raw = await chatCheapCascade({ system: PROFUNDIZAR_SYSTEM, user, maxTokens: 3000, feature: 'mako-doer-in', motivo: 'Profundizar borrador (preguntas dinámicas)' }).catch(() => '');
  if (!raw) return [];
  let obj: Record<string, unknown>; try { obj = parseJsonObject(raw); } catch { return []; }
  // Filtro de la incoherencia que sí se puede reconocer: el modelo tiene la lista de
  // tareas en el prompt y a veces la devuelve COMO OPCIONES de una pregunta binaria
  // («¿son fijos o hay que revisarlos?» + [CRM] [Chats] [Plan]). Ahí ninguna opción
  // contesta y la pregunta no se puede responder.
  const universo = prop.tareas.map((t) => t.titulo);
  return asArr<unknown>(obj.preguntas).map(limpiarPregunta)
    .filter((p): p is PropuestaPregunta => {
      if (!p) return false;
      if (p.tipo !== 'escala' && p.tipo !== 'texto' && opcionesSonLaLista(p.pregunta, p.opciones, universo)) {
        console.warn(`[plan-propuesta] pregunta descartada: las opciones son la lista de tareas, no una respuesta — «${p.pregunta.slice(0, 70)}»`);
        return false;
      }
      return true;
    })
    .slice(0, 40);
}

// ── Preguntas sobre LO QUE SE VA A CARGAR ────────────────────────────────────
// Las preguntas del borrador las arma el cron cuando lee la reunión, sobre TODAS las
// tareas que sacó. Pero entre que las arma y que el dueño confirma pasan horas: él
// destilda la mitad y le pasa otras a un colaborador. Preguntarle entonces por trabajo
// que no va a cargar (o que ya no es suyo) es hacerle perder el tiempo con preguntas
// que además salen genéricas, porque hablan de un montón de cosas a la vez.
const PREGUNTAS_SYSTEM = `Sos MaKo, cargando tareas al plan de un negocio. Te paso LAS TAREAS QUE EL DUEÑO ELIGIÓ CARGAR (ya destildó lo que no va y repartió lo de otros). Tu trabajo: las preguntas de contexto que EL PERRO GUARDIÁN necesita para priorizarlas bien.

CUÁNTAS — ESCALA CON EL TAMAÑO DEL LOTE. No es lo mismo cargar 2 tareas que 20: si son 20 y hacés 4 preguntas, 16 tareas entran a ciegas y el Perro las puntúa adivinando. La regla es aproximadamente UNA pregunta cada TRES tareas:
· 1 a 3 tareas → 1 o 2 preguntas
· 4 a 8 → 2 a 4
· 9 a 15 → 4 a 6
· 16 a 25 → 6 a 9
· 26 a 40 → 9 a 13
· más de 40 → 12 a 16
Es una guía, no una cuota: si de verdad no hay nada que preguntar sobre un bloque de tareas, no inventes. Pero si quedan tareas grandes sobre las que no preguntaste nada, te faltaron preguntas.

COBERTURA: repartí las preguntas por TODO el lote, no las amontones en las primeras tres tareas. Cuando son muchas, agrupá por proyecto o por tema y hacé una pregunta por grupo: una respuesta que sirve para cinco tareas del mismo proyecto vale por cinco. Podés hacer DOS preguntas sobre la misma tarea solo si es grande y las dos cambian cosas distintas.

⛔ REGLA DURA: NUNCA preguntes qué prioridad poner ni qué le urge — eso lo decide el Perro (el dueño exagera y no sabe priorizar). Preguntá HECHOS: un deadline, una dependencia o bloqueo, un número de plata, un alcance ambiguo, quién lo hace, qué sería "listo".
⛔ REGLA DURA: NADA de preguntas ABIERTAS. Siempre con opciones para tocar.
CRITERIO — CADA PREGUNTA TIENE QUE SER CONCRETA Y DE ESTAS TAREAS. Nombralas: "¿Para cuándo tiene que estar el filtro por fecha del tablero de guiones?" y NO "¿qué impacto tienen estas correcciones?". Si una pregunta sirve igual para cualquier reunión, está mal.
CRITERIO — que sume: si la respuesta es obvia, ya está dicha en el detalle de la tarea, o no cambia NADA de lo que el Perro va a decidir, no la hagas. Una pregunta que no cambia nada es peor que ninguna: quema la paciencia del dueño y hace que conteste las que sí importan de cualquier manera.

⛔⛔ CADA OPCIÓN TIENE QUE SER UNA RESPUESTA POSIBLE A LA PREGUNTA. Leé tu enunciado y leé tus opciones: si al elegir una la frase no queda contestada, está mal.
  MAL (pasó de verdad): "¿los cinco grupos son fijos o hay que validar si algún módulo no encaja?" con opciones ["CRM", "Chats", "Plan", "Dashboard"]. El enunciado es "¿A o B?" y abajo hay una lista de sustantivos: ninguna opción lo contesta.
  BIEN: o las opciones son las dos alternativas ("Son fijos" / "Hay que revisarlos"), o cambiás el enunciado para que la lista SÍ lo conteste ("¿Qué módulos no encajan?", tipo multi).
  Nunca dejes un enunciado binario con una lista de nombres abajo.

TIPO Y OPCIONES — tienen que ser COHERENTES entre sí (acá es donde más se falla):
· "opcion" → elección EXCLUYENTE. Obligatorio: 2 a 6 opciones cortas y concretas.
· "multi" → pueden valer VARIAS a la vez. Obligatorio: 2 a 6 opciones. NO agregues "Todas" ni "Ambas": para eso tilda varias.
· "comparacion" → enfrentar DOS ítems para ver cuál pesa más. Obligatorio: EXACTAMENTE 2 opciones, y cada una es uno de los ítems.
· "escala" → intensidad de 1 a 5. NO lleva opciones: el dueño ve los números 1 a 5. Por eso la pregunta TIENE que decir qué significan los extremos, en la pregunta misma: "¿Qué tan firme es el 15 de agosto para la landing? (1 = es una idea, 5 = ya está comprometido con el cliente)". Una escala sin extremos explicados es una pregunta muerta.
⛔ Una pregunta de tipo "opcion", "multi" o "comparacion" SIN opciones no se puede contestar: el dueño ve el texto y ningún botón. Si no se te ocurren opciones concretas, cambiá la pregunta hasta que se te ocurran, o no la hagas.

"sobre" = SOLO los títulos, tal cual te los pasé, sin el detalle ni el número (1-4 títulos).
Devolvé EXCLUSIVAMENTE un objeto JSON (sin markdown) con esta forma EXACTA:
{ "preguntas": [ { "pregunta": "<corta y concreta>", "tipo": "opcion|multi|escala|comparacion", "opciones": ["...", "..."], "sobre": ["<título exacto>"] } ] }
Español rioplatense. Si no hace falta ninguna, { "preguntas": [] }.`;

/**
 * Las preguntas de contexto para EXACTAMENTE las tareas que el dueño está por cargar.
 * Devuelve [] si no hay IA configurada o si el modelo decide que no hace falta ninguna
 * — en los dos casos el flujo sigue de largo y se cargan las tareas igual.
 */
export async function preguntasParaCargar(titulosYDetalles: Array<{ titulo: string; detalle?: string; proyecto?: string }>): Promise<PropuestaPregunta[]> {
  const tareas = titulosYDetalles.filter((t) => t?.titulo?.trim()).slice(0, 80);
  if (!tareas.length) return [];
  const lista = tareas.map((t, i) => `${i + 1}. ${t.titulo}${t.proyecto ? ` [${t.proyecto}]` : ''}${t.detalle ? ` — ${t.detalle}` : ''}`).join('\n');
  // El techo se le dice explícito, además de la tabla del system: el modelo respeta un
  // número concreto mucho mejor que un rango, y con 40 tareas la diferencia entre 6 y 16
  // preguntas es la diferencia entre priorizar con datos y priorizar adivinando.
  const techo = topePreguntas(tareas.length);
  const user = `TAREAS QUE EL DUEÑO ELIGIÓ CARGAR (${tareas.length}):\n${lista}\n\nSon ${tareas.length} tareas: hacé hasta ${techo} preguntas, repartidas por todo el lote (no solo sobre las primeras). Generá las preguntas de contexto que le hagan falta al Perro para priorizar ESTAS. JSON.`;
  const raw = await chatCheapCascade({ system: PREGUNTAS_SYSTEM, user, maxTokens: 8000, feature: 'mako-doer-in', motivo: 'Preguntas de contexto (lo que se va a cargar)' }).catch(() => '');
  if (!raw) return [];
  let obj: Record<string, unknown>; try { obj = parseJsonObject(raw); } catch { return []; }
  const qs = asArr<unknown>(obj.preguntas).map(limpiarPregunta).filter((p): p is PropuestaPregunta => !!p).slice(0, techo);
  // `sobre` se normaliza al título REAL: el modelo tiende a devolver la línea entera
  // que le pasamos ("3. Título — detalle"), y la pantalla la muestra entre comillas.
  // Que el chip diga el título y nada más no se puede confiar al prompt.
  const alTitulo = (cita: string): string | null => {
    const c = normTitulo(cita);
    if (!c) return null;
    const exacta = tareas.find((t) => normTitulo(t.titulo) === c);
    if (exacta) return exacta.titulo;
    const contenida = tareas.find((t) => { const n = normTitulo(t.titulo); return n.length > 10 && (c.includes(n) || n.includes(c)); });
    return contenida?.titulo ?? null;
  };
  return qs.map((q) => ({
    ...q,
    sobre: q.sobre?.length ? [...new Set(q.sobre.map(alTitulo).filter((x): x is string => !!x))] : undefined,
  }));
}

export type LoteAplicar = {
  id: string; tareas?: PropuestaTarea[]; eliminarIds?: string[]; contexto?: string;
  /**
   * Lo que NO se carga y tiene que seguir esperando en el borrador: las tareas que
   * quedaron del lado de otras personas. Lo manda la pantalla porque ahí ya está el
   * reparto CORREGIDO a mano (reasignaciones incluidas), que en la base todavía no
   * está. Si no viene, se asume lo guardado (las marcadas como de otro).
   */
  restantes?: PropuestaTarea[];
};
export type ResultadoAplicar = { ok: boolean; ids: string[]; borradas: number; error?: string };

/** Aplica el borrador: crea las tareas y marca 'aplicada'. Dueño → plan_tareas + Perro;
 *  cliente → su board (lib/todo). `tareasEditadas` = lo que quedó en la revisión. */
export async function aplicarPropuesta(id: string, tareasEditadas?: PropuestaTarea[], eliminarIds?: string[], contexto?: string): Promise<ResultadoAplicar | null> {
  const r = await aplicarPropuestas([{ id, tareas: tareasEditadas, eliminarIds, contexto }]);
  return r.noExiste ? null : { ok: r.ok, ids: r.ids, borradas: r.borradas, error: r.error };
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
    const usaPlanBoard = (await getWorkspace(ws))?.capa === 'superadmin';

    const idsCreadas: string[] = [];
    const proyectosNuevos: string[] = [];
    const contextos: string[] = [];
    /** Por borrador: qué se creó y qué le queda pendiente (define si se cierra o sigue vivo). */
    const cierre = new Map<string, { creadas: PropuestaAplicada[]; restantes: PropuestaTarea[] }>();
    const aplicados: string[] = [];
    let borradas = 0;
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
      const baseCruda = (lote.tareas ?? (prop?.tareas ?? []).filter((t) => !t.esDeOtro)).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
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
        const ya = abiertas.find((x) => mismaTarea(x.titulo, t.titulo));
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
      if (!base.length && !aAmpliar.length && !aBorrar.length) { ultimoError = 'No hay nada para crear ni borrar.'; continue; }

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
          const r = await agregarTareasPlanOwner(base.map((t) => ({ titulo: t.titulo, prioridad: t.prioridad, proyecto: t.proyecto, deadline: t.deadline, detalle: t.detalle, fuente: fuenteDe(t) })), { tipo: fuenteTipo } as Fuente);
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
              const tarea = await crearTarea({ titulo: t.titulo, prioridad: (t.prioridad ?? 'media') as Prioridad, deadline: t.deadline ?? null, detalle: t.detalle ?? null, categorias: catId != null ? [catId] : [], origen: 'mako', fuente: fuenteDe(t) });
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
      }
      if (lote.contexto?.trim()) contextos.push(lote.contexto.trim());
      // Lo que le queda: por defecto, lo que está marcado como de otra persona.
      const restantes = (lote.restantes ?? (prop?.tareas ?? []).filter((t) => t.esDeOtro))
        .map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
      cierre.set(lote.id, { creadas, restantes });
      aplicados.push(lote.id);
    }

    if (!algunoExistia) return { ok: false, ids: [], borradas: 0, noExiste: true };
    if (!aplicados.length) return { ok: false, ids: [], borradas: 0, error: ultimoError || 'No se pudo aplicar.' };
    if (!idsCreadas.length && !borradas) return { ok: false, ids: [], borradas: 0, error: 'No pude crear ninguna tarea.' };

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
      // `notas` (las preguntas) se vacía SIEMPRE: hablaban de las tareas que acaban de
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
    return { ok: true, ids: idsCreadas, borradas };
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
export async function guardarRevision(id: string, tareas: PropuestaTarea[]): Promise<boolean> {
  return enWs(async () => {
    const limpias = tareas.map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    if (!limpias.length) return false;
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('estado').eq('id', id).maybeSingle();
    if (!data || str((data as Row).estado, 'pendiente') !== 'pendiente') return false;
    const { error } = await db.from('plan_propuestas').update({ tareas: limpias }).eq('id', id);
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
