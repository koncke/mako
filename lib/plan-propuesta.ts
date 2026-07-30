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
import { agregarTareasPlanOwner, priorizarNuevasOwner, borrarPlanTarea } from '@/lib/plan-board';
import { crearTarea, crearCategoria, listCategorias, borrarTarea, type Prioridad } from '@/lib/todo';
import { priorizarNuevasCliente } from '@/lib/todo-guardian';
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

export type PropuestaTarea = {
  titulo: string; proyecto?: string; deadline?: string; detalle?: string; prioridad?: Prio;
  // Reparto por persona (reuniones): quién asumió la tarea y si es de OTRO. Viajan
  // dentro del borrador para que el modal de confirmación muestre las mismas tabs
  // (Mías + una por colaborador) que la extracción manual.
  dueno?: string; duenoEmail?: string; esDeOtro?: boolean;
};
export type TipoPregunta = 'opcion' | 'multi' | 'escala' | 'texto' | 'comparacion';
export type PropuestaPregunta = { pregunta: string; opciones: string[]; tipo: TipoPregunta };
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
};

function limpiarTarea(t: unknown): PropuestaTarea | null {
  if (!t || typeof t !== 'object') return null;
  const o = t as Record<string, unknown>;
  const titulo = str(o.titulo).trim().slice(0, 200);
  if (!titulo) return null;
  return {
    titulo,
    proyecto: o.proyecto ? str(o.proyecto).trim().slice(0, 120) : undefined,
    deadline: typeof o.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline) ? o.deadline : undefined,
    detalle: o.detalle ? str(o.detalle).slice(0, 600) : undefined,
    prioridad: PRIOS.includes(o.prioridad as Prio) ? (o.prioridad as Prio) : undefined,
    dueno: o.dueno ? str(o.dueno).trim().slice(0, 80) : undefined,
    duenoEmail: o.duenoEmail ? str(o.duenoEmail).trim().toLowerCase().slice(0, 160) : undefined,
    esDeOtro: o.esDeOtro === true ? true : undefined,
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
function limpiarPregunta(p: unknown): PropuestaPregunta | null {
  if (typeof p === 'string') return p.trim() ? { pregunta: p.trim().slice(0, 300), opciones: [], tipo: 'opcion' } : null;
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const pregunta = str(o.pregunta).trim().slice(0, 300);
  if (!pregunta) return null;
  const opciones = asArr<unknown>(o.opciones).map((x) => str(x).trim()).filter(Boolean).slice(0, 6);
  const tipo = TIPOS_PREGUNTA.includes(o.tipo as TipoPregunta) ? (o.tipo as TipoPregunta) : (opciones.length ? 'opcion' : 'texto');
  return { pregunta, opciones, tipo };
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
    const preguntas = asArr<unknown>(draft.preguntas).map(limpiarPregunta).filter((p): p is PropuestaPregunta => !!p).slice(0, 8);
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
CRITERIO — elegí el TIPO por pregunta (pensá cuál es el mejor): "multi" si pueden valer VARIAS respuestas a la vez (no agregues una opción "Ambas/Todas": que tilde varias) · "opcion" si es una elección EXCLUYENTE · "escala" para intensidad 1-5 · "comparacion" para enfrentar DOS ítems. NADA de preguntas ABIERTAS: siempre con opciones para tocar. Para opcion/multi/comparacion pasá 2-6 "opciones" cortas.
Devolvé EXCLUSIVAMENTE un objeto JSON (sin markdown) con esta forma EXACTA:
{ "preguntas": [ { "pregunta": "<corta, sobre un hecho>", "tipo": "opcion|multi|escala|comparacion", "opciones": ["...", "..."] } ] }
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
  return asArr<unknown>(obj.preguntas).map(limpiarPregunta).filter((p): p is PropuestaPregunta => !!p).slice(0, 40);
}

export type LoteAplicar = { id: string; tareas?: PropuestaTarea[]; eliminarIds?: string[]; contexto?: string };
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
    const aplicados: string[] = [];
    let borradas = 0;
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
      const base = (lote.tareas ?? (prop?.tareas ?? []).filter((t) => !t.esDeOtro)).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
      // Solo se borran los ids que el dueño/cliente CONFIRMÓ (subset de los que MaKo propuso).
      const propuestos = new Set((prop?.eliminar ?? []).map((e) => e.id));
      const aBorrar = (lote.eliminarIds ?? [...propuestos]).map(String).filter((x) => propuestos.has(x));
      if (!base.length && !aBorrar.length) { ultimoError = 'No hay nada para crear ni borrar.'; continue; }

      if (usaPlanBoard) {
        if (base.length) {
          const fuenteTipo = (['whatsapp', 'fathom', 'mako', 'archivo', 'claude-code'].includes(str((data as Row).origen)) ? str((data as Row).origen) : 'whatsapp') as FuenteTipo;
          const r = await agregarTareasPlanOwner(base.map((t) => ({ titulo: t.titulo, prioridad: t.prioridad, proyecto: t.proyecto, deadline: t.deadline, detalle: t.detalle })), { tipo: fuenteTipo } as Fuente);
          idsCreadas.push(...r.ids);
          proyectosNuevos.push(...r.proyectoIds);
        }
        for (const eid of aBorrar) { await borrarPlanTarea(eid).catch((e) => console.error('[plan-propuesta] borrar owner:', e instanceof Error ? e.message : String(e))); borradas += 1; }
      } else {
        // CLIENTE: su board va por lib/todo (crea la categoría si falta). Ya estamos en su ws.
        if (base.length) {
          const cats = await listCategorias().catch(() => [] as Array<{ id: number; nombre: string }>);
          const byName = new Map(cats.map((c) => [c.nombre.trim().toLowerCase(), c.id]));
          for (const t of base) {
            try {
              let catId: number | undefined;
              if (t.proyecto) {
                const nombre = t.proyecto.slice(0, 40).trim();
                const k = nombre.toLowerCase();
                catId = byName.get(k);
                if (catId == null) { const c = await crearCategoria(nombre, '#2F6FED'); catId = c.id; byName.set(k, c.id); }
              }
              const tarea = await crearTarea({ titulo: t.titulo, prioridad: (t.prioridad ?? 'media') as Prioridad, deadline: t.deadline ?? null, detalle: t.detalle ?? null, categorias: catId != null ? [catId] : [], origen: 'mako' });
              idsCreadas.push(String(tarea.id));
            } catch (e) { console.error('[plan-propuesta] crearTarea cliente:', e instanceof Error ? e.message : String(e)); }
          }
        }
        for (const eid of aBorrar) { const n = Number(eid); if (Number.isFinite(n)) { await borrarTarea(n).catch((e) => console.error('[plan-propuesta] borrar cliente:', e instanceof Error ? e.message : String(e))); borradas += 1; } }
      }
      if (lote.contexto?.trim()) contextos.push(lote.contexto.trim());
      aplicados.push(lote.id);
    }

    if (!algunoExistia) return { ok: false, ids: [], borradas: 0, noExiste: true };
    if (!aplicados.length) return { ok: false, ids: [], borradas: 0, error: ultimoError || 'No se pudo aplicar.' };
    if (!idsCreadas.length && !borradas) return { ok: false, ids: [], borradas: 0, error: 'No pude crear ninguna tarea.' };

    // UNA sola pasada del Perro sobre TODO lo nuevo, con el contexto de todas las
    // reuniones junto (así compara entre sí lo que entró de golpe).
    if (idsCreadas.length) {
      const contexto = contextos.join(' ');
      if (usaPlanBoard) {
        await priorizarNuevasOwner(idsCreadas, proyectosNuevos, contexto).catch((e) => { console.error('[plan-propuesta] priorizar:', e instanceof Error ? e.message : String(e)); return null; });
      } else {
        await priorizarNuevasCliente(idsCreadas.map(Number).filter(Number.isFinite), contexto)
          .catch((e) => { console.error('[plan-propuesta] perro cliente:', e instanceof Error ? e.message : String(e)); return 0; });
      }
    }

    const now = new Date().toISOString();
    for (const id of aplicados) await db.from('plan_propuestas').update({ estado: 'aplicada', applied_at: now }).eq('id', id);
    return { ok: true, ids: idsCreadas, borradas };
  });
}

export async function descartarPropuesta(id: string): Promise<boolean> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { error } = await db.from('plan_propuestas').update({ estado: 'descartada' }).eq('id', id).eq('estado', 'pendiente');
    return !error;
  });
}
