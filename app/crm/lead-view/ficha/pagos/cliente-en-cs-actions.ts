'use server';

// =============================================================================
// ficha/pagos/cliente-en-cs-actions — lo que lee el bloque «Cliente en CS» de la tab Pagos (17/11/2026)
// =============================================================================
// El contrato de la ficha (../tipos.ts, punto 3): lo que no viene en `LeadFullData` lo pide el bloque con SU action al
// montarse, así nadie paga esta lectura si el bloque no está puesto. Lo que se DIBUJA con esto es puro y tiene test:
// lib/cliente-en-cs.ts (`vistaClienteEnCs`).
//
// Qué se lee, y de dónde (las mismas funciones que Customer Success, ninguna consulta nueva sobre lo que ya tiene dueño):
//   · el estado: `estadoGuardadoDe` (lib/api-mako/areas/cs.helpers.ts), la fila de `cs_clientes`; sin fila = activo.
//   · la entrega: `productosDelCliente` (app/customer-success/entrega.ts: su casa y sus filas, la regla del kanban), la
//     fila de `cliente_entrega` de cada producto y sus etapas con `entregaDeProductoEstricta` (lib/entrega-servicio.ts).
//   · el curso: `clasesDelProducto` y `avanceDelCliente` (lib/curso-datos.ts), contados con `avanceDeCurso`
//     (lib/curso-resumen.ts), lo mismo que usa MaKo para contestar «¿cómo va con el curso?».
//   · el acceso: `accesoDe` (lib/curso-datos.ts), que NO crea nada. ⚠️ Nunca `linkDeAcceso`: ése CREA el acceso, y una
//     lectura no le puede abrir una puerta a nadie.
//   · su cuenta de MaKo: `leads.cliente_ws` (mig 0175) y el alta de sus cobros de un plan de MaKo (`cobros.alta_estado`,
//     lib/cobros.ts, `altaSiCorresponde`).
//
// Lo que vale para todas:
//   · ⚠️ SIN SESIÓN, NADA (tests/crm-acciones-sesion.test.ts): sin cookie `getWorkspaceActual()` cae al ws1.
//   · TODO CON `getTenantDb()`: un lead de otro negocio contesta «no encontré».
//   · CADA LECTURA FALLA POR SU CUENTA: las cuatro van en paralelo y la que se cae viaja como «no se pudo leer»
//     (`{ ok: false }`), nunca como un vacío. ⚠️ Por eso la fila de `cliente_entrega` se lee aquí y no con
//     `entregasDeCliente`, que ante un error devuelve `[]` y se leería «no está en ninguna entrega».
//   · No escribe nada: todo se edita en Customer Success.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getTenantDb } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { estadoGuardadoDe } from '@/lib/api-mako/areas/cs.helpers';
import { productosDelCliente } from '@/app/customer-success/entrega';
import { entregaDeProductoEstricta } from '@/lib/entrega-servicio';
import { accesoDe, avanceDelCliente, clasesDelProducto } from '@/lib/curso-datos';
import { avanceDeCurso } from '@/lib/curso-resumen';
import {
  esEstadoAltaCs, esEstadoCs,
  type AccesoLeidoCs, type ClienteEnCsLeido, type CuentaLeida, type CursoLeido, type EntregaLeida, type EstadoLeido, type Lectura,
} from '@/lib/cliente-en-cs';

const SIN_SESION = 'Tu sesión no está activa en este negocio. Recarga la página.';
const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const NO_LEIDO = { ok: false } as const;

async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}

/** Corre UNA lectura: si falla, queda dicha en el log y viaja como «no se pudo leer», sin tumbar a las demás. */
async function leer<T>(que: string, leadId: number, f: () => Promise<T>): Promise<Lectura<T>> {
  try {
    return { ok: true, dato: await f() };
  } catch (e) {
    console.error(`[cliente-en-cs] no pude leer ${que} del lead ${leadId}: ${mensaje(e)}`);
    return NO_LEIDO;
  }
}

/** El estado en Customer Success. Un valor que no es de los cuatro no se dibuja como si fuera uno: se dice que no se leyó. */
async function estadoDe(leadId: number): Promise<EstadoLeido> {
  const g = await estadoGuardadoDe(leadId);
  if (!esEstadoCs(g.estado)) throw new Error(`estado desconocido «${String(g.estado)}»`);
  return { estado: g.estado, motivo: g.motivo ?? null, desde: g.estado_at ?? null };
}

/**
 * En qué etapa está en cada producto que se le entrega, y su avance en el curso de ese producto.
 *
 * ⚠️ TIRA si no sabe de qué productos es o en qué fila está: un «no está en la entrega» sobre una consulta caída es un
 * dato falso. Lo de cada producto (sus etapas, sus clases) sí se cae solo: queda marcado en ESE producto.
 */
async function entregasDe(leadId: number): Promise<EntregaLeida[]> {
  const { productos } = await productosDelCliente(leadId);
  if (!productos.length) return [];
  const db = await getTenantDb();
  const [filas, nombres] = await Promise.all([
    db.from('cliente_entrega').select('producto_id, etapa, etapa_desde').eq('lead_id', leadId).order('id', { ascending: true }),
    db.from('productos').select('id, nombre').in('id', productos),
  ]);
  if (filas.error) throw new Error(`cliente_entrega: ${filas.error.message}`);
  // Sin los nombres se dibuja igual («Entrega» a secas): el nombre sólo distingue dos servicios.
  if (nombres.error) console.error(`[cliente-en-cs] no pude leer los nombres de los productos del lead ${leadId}: ${nombres.error.message}`);
  const filaDe = new Map<number, { etapa: string | null; etapa_desde: string | null }>();
  for (const f of (filas.data ?? []) as Array<{ producto_id: number; etapa: string | null; etapa_desde: string | null }>) {
    if (!filaDe.has(Number(f.producto_id))) filaDe.set(Number(f.producto_id), f);
  }
  const nombreDe = new Map(((nombres.data ?? []) as Array<{ id: number; nombre: string | null }>).map((p) => [Number(p.id), p.nombre?.trim() || null]));

  // Las etapas (estrictas: si no se pueden leer es null, nunca las de fábrica) y las clases de cada producto, en paralelo.
  const porProducto = await Promise.all(productos.map(async (pid) => {
    const [entrega, clases] = await Promise.all([
      entregaDeProductoEstricta(pid).catch((e: unknown) => { console.error(`[cliente-en-cs] etapas del producto ${pid}: ${mensaje(e)}`); return null; }),
      clasesDelProducto(pid).then(
        (c) => ({ ok: true as const, c }),
        (e: unknown) => { console.error(`[cliente-en-cs] clases del producto ${pid}: ${mensaje(e)}`); return { ok: false as const }; },
      ),
    ]);
    return { pid, entrega, clases };
  }));

  // El avance del cliente se lee UNA vez para todos sus cursos, y sólo si alguno de sus productos tiene curso.
  const conCurso = porProducto.some((x) => x.clases.ok && x.clases.c.length > 0);
  const avance = conCurso
    ? await avanceDelCliente(leadId).then(
      (a) => ({ ok: true as const, a }),
      (e: unknown) => { console.error(`[cliente-en-cs] avance del curso del lead ${leadId}: ${mensaje(e)}`); return { ok: false as const }; },
    )
    : null;
  const progreso = avance && avance.ok ? avance.a.progreso : null;

  return porProducto.map(({ pid, entrega, clases }) => {
    const fila = filaDe.get(pid) ?? null;
    const etapas = entrega ? entrega.etapas.map((e) => ({ key: e.key, label: e.label })) : null;
    let curso: Lectura<CursoLeido | null>;
    if (!clases.ok) curso = NO_LEIDO;
    else if (!clases.c.length) curso = { ok: true, dato: null };
    // Sin las etapas o sin el avance no hay cuenta honesta: «no se pudo leer», no un 0%.
    else if (!etapas || !progreso) curso = NO_LEIDO;
    else {
      const prog = progreso;
      const a = avanceDeCurso({
        etapas, clases: clases.c, etapaGuardada: fila?.etapa ?? null,
        estadoDe: (id) => prog.get(id)?.estado,
        pctDe: (id) => prog.get(id)?.pct,
      });
      curso = {
        ok: true,
        dato: {
          pctVisto: a.videos_de_la_etapa?.pct_visto ?? null,
          videosSinMedir: a.videos_de_la_etapa?.sin_medir ?? 0,
          tareasEnviadas: a.tareas_de_la_etapa?.enviadas ?? 0,
          tareas: a.tareas_de_la_etapa?.total ?? 0,
          etapaCompleta: a.etapa_completa,
        },
      };
    }
    return { productoId: pid, producto: nombreDe.get(pid) ?? null, etapaGuardada: fila?.etapa ?? null, etapaDesde: fila?.etapa_desde ?? null, etapas, curso };
  });
}

/** El acceso al portal del curso, sin crearlo. null = nunca se le dio. Sólo lo que el bloque dice (sin el email). */
async function accesoDelCliente(leadId: number): Promise<AccesoLeidoCs | null> {
  const a = await accesoDe(leadId);
  if (!a) return null;
  return { revocado: a.revocado, ingresos: a.ingresos, ultimoIngresoAt: a.ultimoIngresoAt, invitacionEnviadaAt: a.invitacionEnviadaAt, linkEnviadoAt: a.linkEnviadoAt };
}

/** Su cuenta de MaKo: el workspace que se le abrió y el alta de sus cobros de un plan de MaKo (los que traen `alta_capa`). */
async function cuentaDelCliente(leadId: number, clienteWs: number | null): Promise<CuentaLeida> {
  const db = await getTenantDb();
  const { data, error } = await db.from('cobros').select('alta_estado, alta_motivo, created_at')
    .eq('lead_id', leadId).not('alta_capa', 'is', null)
    .order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(`cobros: ${error.message}`);
  const altas = ((data ?? []) as Array<{ alta_estado: unknown; alta_motivo: string | null; created_at: string | null }>).map((f) => ({
    estado: esEstadoAltaCs(f.alta_estado) ? f.alta_estado : null,
    motivo: f.alta_motivo ?? null,
    creadoAt: f.created_at ?? null,
  }));
  return { clienteWs, altas };
}

/**
 * Todo lo que el bloque «Cliente en CS» muestra de un lead. `ok: false` sólo cuando no se puede ni empezar (sin sesión,
 * un id inválido, el lead que no se pudo leer); una parte que no se leyó viaja marcada adentro de `leido`.
 */
export async function clienteEnCsAction(leadId: number): Promise<{ ok: true; leido: ClienteEnCsLeido } | { ok: false; error: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId)) return { ok: false, error: 'Lead inválido.' };
    const db = await getTenantDb();
    const [lectura, capa] = await Promise.all([
      db.from('leads').select('id, estado_lead, cliente_ws').eq('id', leadId).maybeSingle(),
      getCapaActual(),
    ]);
    if (lectura.error) return { ok: false, error: `No pude leer el lead: ${lectura.error.message}` };
    const lead = lectura.data as { id: number; estado_lead: string | null; cliente_ws: number | null } | null;
    if (!lead) return { ok: false, error: 'No encontré ese lead en este negocio.' };
    const ganado = lead.estado_lead === 'ganado';
    // La misma pregunta que la puerta de Customer Success (app/customer-success/puerta.ts): sin la tab, no hay nada que mostrar.
    const conClients = tabEnCapa('customer-success', capa);
    if (!ganado || !conClients) {
      return { ok: true, leido: { leadId, ganado, conClients, estado: NO_LEIDO, entregas: NO_LEIDO, acceso: NO_LEIDO, cuenta: NO_LEIDO } };
    }
    const clienteWs = lead.cliente_ws == null || !Number.isFinite(Number(lead.cliente_ws)) ? null : Number(lead.cliente_ws);
    const [estado, entregas, acceso, cuenta] = await Promise.all([
      leer('el estado', leadId, () => estadoDe(leadId)),
      leer('la entrega', leadId, () => entregasDe(leadId)),
      leer('el acceso al curso', leadId, () => accesoDelCliente(leadId)),
      leer('la cuenta de MaKo', leadId, () => cuentaDelCliente(leadId, clienteWs)),
    ]);
    return { ok: true, leido: { leadId, ganado, conClients, estado, entregas, acceso, cuenta } };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}
