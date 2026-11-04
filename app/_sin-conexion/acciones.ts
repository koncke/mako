'use server';

// =============================================================================
// Subir lo escrito sin conexión (MaKo sin conexión, T2, 28/10/2026)
// =============================================================================
// Lo llama SÓLO el panel «Cambios hechos sin conexión» (app/_components/SubirCambios.tsx), cuando la persona aprieta
// «Subir»: nada sale solo al volver la conexión. La lógica (idempotencia, campo por campo, «Espera tu OK») está en
// lib/sin-conexion/subir.ts; acá van las PUERTAS de verdad, y son las MISMAS del teléfono, con la sesión de la persona:
//   · nota          → notaLeadAction (app/m/crm/acciones.ts: chequea el lead y RELEE la nota);
//   · etapa         → moverEtapaAction (sólo entre las etapas que el teléfono mueve; nunca a Ganado, cobro ni wizard);
//   · contacto      → saveLeadMetaAction (app/crm/actions.ts: lo que escritorio usa para el nombre, el email y la empresa);
//   · tarea-estado  → moverTareaAction (app/m/plan/acciones.ts);
//   · tarea-nueva   → crearPropuesta con `ref` (un BORRADOR que se confirma en el Plan; repetido, el mismo borrador).
// Es una server action y no una ruta: las del teléfono llaman a `refresh()`, que sólo vale dentro de una.
//
// LA CONSECUENCIA DE MOVER DE ETAPA (`consecuenciaDeEtapa`): las automatizaciones de esa etapa y ese producto que están
// prendidas (las mismas preguntas que el motor: `vistasPorDisparador` + `secuenciasDeEtapa` con el ámbito del embudo). Es
// a propósito de más: un agregado que el motor no inscribiría igual pide el OK. Pedir un OK de más es mejor que mandarle
// un WhatsApp a un lead sin que la persona lo decida.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { usuarioPropio } from '@/lib/perfil';
import { estaImpersonando, getCapaActual, getRolWsEfectivo, getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { puedeVerKey } from '@/lib/movil-rutas';
import { getLead } from '@/lib/leads';
import { productosDelLead, etapasDeProducto } from '@/lib/lead-funnel';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
import { idDelFunnelDefault } from '@/lib/funnels';
import { comoLite, etapaEnTablero, type EtapaM } from '@/app/m/crm/reglas';
import { moverEtapaAction, notaLeadAction } from '@/app/m/crm/acciones';
import { moverTareaAction } from '@/app/m/plan/acciones';
import { saveLeadMetaAction } from '@/app/crm/actions';
import { tableroDelPlan } from '@/lib/plan-hoy';
import { leerColumnasPlan } from '@/lib/plan-columnas-server';
import { tareasDelTablero } from '@/app/m/plan/tableros';
import { hoyEnWorkspace } from '@/lib/timezone';
import { crearPropuesta } from '@/lib/plan-propuesta';
import { getSecuenciasActivas } from '@/lib/nutricion';
import { vistasPorDisparador } from '@/lib/disparadores';
import { secuenciasDeEtapa, TRIGGER_ETAPA } from '@/lib/nutricion-etapa';
import { ambitoDeSecuencia } from '@/lib/nutricion-ambito';
import { subirCambio, type Deps, type Reserva } from '@/lib/sin-conexion/subir';
import { validarOperacion, type Operacion, type Resultado } from '@/lib/sin-conexion/cola';

const TABLA = 'sin_conexion_aplicadas';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
// La tabla que falta (no una columna): el código nuevo puede llegar antes que la migración 0346.
const sinTabla = (e: { code?: string } | null) => !!e && (e.code === 'PGRST205' || e.code === '42P01');

/** La etapa del lead en ese producto como la DIBUJA el tablero: la MISMA cuenta que `moverEtapaAction` (app/m/crm/acciones.ts). */
async function etapaActual(leadId: number, funnelId: number | null): ReturnType<Deps['etapaActual']> {
  const lead = await getLead(leadId);
  if (!lead) return { ok: false, motivo: 'Ese lead ya no está.' };
  const { productos, defaultId, etapaCasa } = await productosDelLead(leadId);
  const fid = funnelId ?? defaultId;
  const prod = productos.find((p) => p.funnelId === fid);
  if (fid == null || !prod) return { ok: false, motivo: 'Ese lead ya no está en ese funnel.' };
  const stages = (await etapasDeProducto(fid)) as EtapaM[];
  const keys = stages.map((s) => s.key);
  const cruda = prod.esCasa
    ? (etapaCasa && keys.includes(etapaCasa) ? etapaCasa : etapaVigenteDe(lead, comoLite(stages)))
    : (prod.etapa ?? '');
  const rotulo = (k: string) => stages.find((s) => s.key === k)?.label ?? k;
  return { ok: true, etapa: etapaEnTablero(cruda, keys), rotulo };
}

/** Las automatizaciones prendidas que arrancan al entrar a esa etapa de ese producto, en una frase. null = ninguna. */
async function consecuenciaDeEtapa(leadId: number, funnelId: number | null, etapa: string): Promise<string | null> {
  try {
    const fid = funnelId ?? (await idDelFunnelDefault());
    const vistas = (await getSecuenciasActivas()).flatMap((s) => vistasPorDisparador(s)).filter((s) => s.trigger_tipo === TRIGGER_ETAPA && !s.cron);
    if (!vistas.length) return null;
    const ids = [...new Set(vistas.map((s) => s.funnel_id).filter((x): x is number => x != null))];
    const defaults = new Map<number, boolean>();
    if (ids.length) {
      const { data } = await (await getTenantDb()).from('funnels').select('id, es_default').in('id', ids);
      for (const f of (data ?? []) as Array<{ id: number; es_default: boolean | null }>) defaults.set(Number(f.id), f.es_default === true);
    }
    const conAmbito = vistas.map((s) => ({ ...s, ambito: ambitoDeSecuencia(s.funnel_id, s.funnel_id == null ? null : (defaults.get(Number(s.funnel_id)) ?? null)) }));
    const nombres = [...new Set(secuenciasDeEtapa(conAmbito, etapa, fid).map((s) => s.nombre?.trim()).filter(Boolean))];
    if (!nombres.length) return null;
    const lista = nombres.slice(0, 3).map((n) => `«${n}»`).join(', ');
    return `Al entrar a esa etapa arranca ${nombres.length === 1 ? 'la automatización' : 'las automatizaciones'} ${lista}, que le escribe${nombres.length === 1 ? '' : 'n'} al lead.`;
  } catch (e) {
    // Sin poder mirarlo, se pide el OK igual: no saber no es «no tiene consecuencias».
    console.error(`[sin-conexion] consecuencia ${leadId}: ${msg(e)}`);
    return 'No pude revisar si esa etapa arranca una automatización. Confírmalo antes de subirlo.';
  }
}

async function columnaDeTarea(tareaId: string): ReturnType<Deps['columnaDeTarea']> {
  const [tablero, columnas, hoy] = await Promise.all([tableroDelPlan(), leerColumnasPlan(), hoyEnWorkspace()]);
  const kanban = tareasDelTablero({ tareas: tablero.tareas, proyectos: tablero.proyectos, hoy, conNum: tablero.que === 'dueno', columnas });
  const t = kanban.tareas.find((x) => x.id === tareaId);
  if (!t) return { ok: false, motivo: 'Esa tarea ya no está en el Plan.' };
  const rotulo = (k: string) => kanban.columnas.find((c) => c.key === k)?.titulo ?? k;
  return { ok: true, col: t.col, rotulo };
}

/** Las puertas de verdad, con la persona y el negocio de la sesión. */
async function depsReales(): Promise<Deps | null> {
  const u = await usuarioPropio();
  if (!u) return null;
  const [ws, impersonando, rol, capa] = await Promise.all([getWorkspaceActual(), estaImpersonando(), getRolWsEfectivo(), getCapaActual()]);
  const db = getSupabaseServer();
  const veCrm = puedeVerKey('crm', rol, capa);
  const vePlan = puedeVerKey('todo', rol, capa);
  const sinPermiso = { ok: false as const, motivo: 'Tu cuenta ya no tiene acceso a esa sección.' };
  return {
    ws, impersonando,
    async leerReserva(id) {
      const { data, error } = await db.from(TABLA).select('estado, resultado, created_at').eq('id', id).eq('usuario_id', u.id).maybeSingle();
      if (error) return sinTabla(error) ? 'sin-tabla' : Promise.reject(new Error(error.message));
      if (!data) return null;
      const f = data as { estado: Reserva['estado']; resultado: Resultado | null; created_at: string };
      return { estado: f.estado, resultado: f.resultado, creado: f.created_at };
    },
    async reservar(op: Operacion) {
      const { error } = await db.from(TABLA).insert({ id: op.id, usuario_id: u.id, workspace_id: op.ws, tipo: op.cambio.tipo, estado: 'en-curso' });
      if (!error) return 'ok';
      if (sinTabla(error)) return 'sin-tabla';
      if (error.code === '23505') return 'ya';
      throw new Error(error.message);
    },
    async finalizar(id, r) {
      const { error } = await db.from(TABLA).update({ estado: 'final', resultado: r, updated_at: new Date().toISOString() }).eq('id', id).eq('usuario_id', u.id);
      if (error) console.error(`[sin-conexion] finalizar ${id}: ${error.message}`);
    },
    async soltar(id) {
      const { error } = await db.from(TABLA).delete().eq('id', id).eq('usuario_id', u.id).eq('estado', 'en-curso');
      if (error) console.error(`[sin-conexion] soltar ${id}: ${error.message}`);
    },
    etapaActual: async (leadId, funnelId) => (veCrm ? etapaActual(leadId, funnelId) : sinPermiso),
    consecuenciaDeEtapa,
    async moverEtapa(leadId, funnelId, etapa) {
      const r = await moverEtapaAction(leadId, funnelId, etapa);
      return r.ok ? { ok: true } : { ok: false, motivo: r.error };
    },
    async nota(leadId, texto) {
      if (!veCrm) return sinPermiso;
      const r = await notaLeadAction(leadId, texto);
      return r.ok ? { ok: true } : { ok: false, motivo: r.error };
    },
    async contactoActual(leadId, campo) {
      if (!veCrm) return sinPermiso;
      const lead = await getLead(leadId);
      if (!lead) return { ok: false, motivo: 'Ese lead ya no está.' };
      const v = (lead as unknown as Record<string, unknown>)[campo];
      return { ok: true, valor: typeof v === 'string' ? v : null };
    },
    async guardarContacto(leadId, campo, valor) {
      if (!veCrm) return sinPermiso;
      try {
        await saveLeadMetaAction(leadId, { [campo]: valor } as Parameters<typeof saveLeadMetaAction>[1]);
        return { ok: true };
      } catch (e) {
        return { ok: false, motivo: msg(e).slice(0, 120) || 'No se pudo guardar.' };
      }
    },
    columnaDeTarea: async (tareaId) => (vePlan ? columnaDeTarea(tareaId) : sinPermiso),
    async moverTarea(tareaId, col) {
      const r = await moverTareaAction(tareaId, col);
      return r.ok ? { ok: true } : { ok: false, motivo: r.error };
    },
    async borrador(titulo, ref) {
      if (!vePlan) return sinPermiso;
      try {
        const id = await crearPropuesta({ tareas: [{ titulo }], resumen: 'Tarea escrita sin conexión', origen: 'sin-conexion', ref });
        return { ok: true, link: `/plan/revisar/${id}` };
      } catch (e) {
        return { ok: false, motivo: `No se pudo armar el borrador: ${msg(e).slice(0, 80)}` };
      }
    },
    ahora: () => Date.now(),
  };
}

/** Antes de subir: qué cambios tienen consecuencias y cuáles son de otro negocio. No escribe nada. */
export async function revisarCambiosAction(ops: unknown): Promise<{ ok: true; cambios: Array<{ id: string; consecuencia: string | null; deOtroNegocio: boolean }> } | { ok: false; error: string }> {
  if (!(await getUsuarioActual())) return { ok: false, error: 'Entra a MaKo para subir tus cambios.' };
  if (await estaImpersonando()) return { ok: false, error: 'Mirando la cuenta de otro no se sube nada.' };
  const lista = Array.isArray(ops) ? ops.slice(0, 200).map(validarOperacion).filter((x): x is Operacion => !!x) : [];
  const ws = await getWorkspaceActual();
  const cambios = [];
  for (const op of lista) {
    const c = op.cambio;
    const consecuencia = op.ws === ws && c.tipo === 'etapa' ? await consecuenciaDeEtapa(c.leadId, c.funnelId, c.despues) : null;
    cambios.push({ id: op.id, consecuencia, deOtroNegocio: op.ws !== ws });
  }
  return { ok: true, cambios };
}

/**
 * Sube UN cambio. `ok`: la persona aprobó su consecuencia; `forzar`: eligió «Aplicar el mío» en un conflicto (o volver a
 * intentar uno «incierto»). Sin una operación válida, sin sesión de una persona: «rechazada», sin tocar nada.
 */
export async function subirCambioAction(op: unknown, opciones?: { forzar?: unknown; ok?: unknown }): Promise<Resultado> {
  if (!(await getUsuarioActual())) return { estado: 'reintentar', motivo: 'Entra a MaKo para subir tus cambios.' };
  const valida = validarOperacion(op);
  if (!valida) return { estado: 'rechazada', motivo: 'Ese cambio no se puede leer.' };
  const deps = await depsReales();
  if (!deps) return { estado: 'rechazada', motivo: 'Esta sesión no es de una persona.' };
  try {
    return await subirCambio(valida, { forzar: opciones?.forzar === true, ok: opciones?.ok === true }, deps);
  } catch (e) {
    console.error(`[sin-conexion] subir ${valida.id}: ${msg(e)}`);
    return { estado: 'incierta', motivo: 'Algo falló a mitad de subirlo. Revisa si quedó antes de volver a intentarlo.' };
  }
}
