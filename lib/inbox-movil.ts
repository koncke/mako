// =============================================================================
// inbox-movil — la LECTURA del «Para decidir» del teléfono (MaKo Mobile, /m/inbox)
// =============================================================================
// Junta en una lista todo lo que espera una decisión de quien mira, filtrado por lo que
// su ROL puede decidir en la CAPA del workspace (`tiposVisibles`), y su conteo para el
// badge. Qué es cada bandeja y quién la ve está en lib/inbox-movil-reglas.ts (puro).
//
// No es una lectura nueva de nada: cada bandeja sale de la MISMA función que la lee el
// escritorio.
//   · pendiente    → `pendientesDelWorkspace` + `aFila` (lib/bandeja-filas.ts), como
//                    /mako/pendientes. ⚠️ ESCRIBE: pasa a 'vencida' lo que ya venció antes
//                    de leer. Está bien en una PÁGINA (lo hace el escritorio en cada visita);
//                    en el badge NO — por eso el conteo va por `contarPendientesVigentes`.
//   · accion, lead → `propuestasPendientes(tipo)` (lib/propuestas.ts).
//   · borrador     → `listPropuestasPendientes` (lib/plan-propuesta.ts), como /plan.
//   · confirmacion → `listPendientes` (lib/mako-confirmaciones.ts), en modo estricto.
//
// ⚠️ UNA LECTURA QUE FALLA NO ES «NADA PENDIENTE»: va a `fallas` con su bandeja, y el
// total del conteo queda en `null`. Dos lecturas del escritorio se tragan el error y
// devuelven `[]` (`pendientesDelWorkspace` y `listPropuestasPendientes` no miran el
// `error` de supabase-js); para esas dos, un conteo que SÍ lo mira hace de sonda: si el
// conteo no se pudo leer, o dice que hay y la lista volvió vacía, es una falla.
//
// ⚠️ SIN SESIÓN NO SIRVE: el rol sale de la cookie. Un script de diagnóstico pasa
// `quien` a mano adentro de `runWithWorkspace(ws, …)`. Nunca se arma `quien` con algo que
// mandó el navegador: el rol lo dice la sesión.
// =============================================================================

import 'server-only';
import { cache } from 'react';
import { getCapaActual, getRolWsEfectivo, getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { pendientesDelWorkspace, type Pendiente } from '@/lib/mako-pendientes';
import { propuestasPendientes, type Propuesta } from '@/lib/propuestas';
import { rutaDePropuesta } from '@/lib/propuestas-tipos';
import { listPropuestasPendientes, type Propuesta as Borrador } from '@/lib/plan-propuesta';
import { listPendientes as listConfirmaciones, type MakoConfirmacion } from '@/lib/mako-confirmaciones';
import { contarBandejas, contarPendientesVigentes } from '@/lib/api-mako/areas/mako.helpers';
import { RUTA_BANDEJA } from '@/lib/api-mako/acciones';
import { porId } from '@/lib/api-mako/registro';
import { esAccion } from '@/lib/api-mako/tipos';
import { aFila, plano } from '@/lib/bandeja-filas';
import type { RolMovil } from '@/lib/movil-rutas';
import {
  complejidadDe, consecuenciaDeshacer, etiquetaDeOrigen, lineasDeCambios, lineasDelPayload, opcionesDeConfirmacion,
  detalleDeBorrador, detalleDeLeads, ordenarItems, resumenDeBorrador, sumarConteos, tiposVisibles, tituloDeBorrador,
  type ItemDecision, type TipoDecision,
} from '@/lib/inbox-movil-reglas';

/** Quién mira: el rol en el workspace y la capa del workspace. */
export type QuienMira = { rol: RolMovil; capa: string | null };

export type ParaDecidir = {
  /** Ordenados (`ordenarItems`): lo que vence primero, lo de la compu al final. */
  items: ItemDecision[];
  /** Las bandejas que NO se pudieron leer. Su ausencia en `items` no significa «nada». */
  fallas: TipoDecision[];
  /** Las bandejas que este rol puede decidir (las que se leyeron o se intentaron leer). */
  tipos: TipoDecision[];
  /** Las bandejas cuya lista llegó a su tope: puede haber más de las que vinieron. */
  recortados: TipoDecision[];
};

export type ConteoParaDecidir = {
  /** La suma de las bandejas visibles. `null` = alguna no se pudo leer (nunca 0). */
  total: number | null;
  /** Sólo las bandejas que este rol ve. `null` = esa no se pudo leer. */
  porTipo: Partial<Record<TipoDecision, number | null>>;
};

// Los topes son los de cada lectura del escritorio: el inbox no lee más que la bandeja.
const TOPE: Readonly<Record<TipoDecision, number>> = { pendiente: 200, accion: 100, lead: 100, borrador: 100, confirmacion: 100 };

/** `contarBandejas` también cuenta las fallidas de N días; el inbox no las muestra. */
const DIAS_FALLIDAS = 7;

async function quienMira(): Promise<QuienMira> {
  const [rol, capa] = await Promise.all([getRolWsEfectivo(), getCapaActual()]);
  return { rol, capa };
}

// ── Cada bandeja como ítem ───────────────────────────────────────────────────

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function pendienteADecision(p: Pendiente, tz: string): ItemDecision {
  const f = aFila(p, tz);
  const def = porId(p.tipo);
  return {
    tipo: 'pendiente', key: `pendiente:${p.id}`, id: p.id, accionMovil: 'confirmar-pendiente',
    titulo: f.resumen, resumen: f.operacion, operacion: f.operacion,
    consecuencia: consecuenciaDeshacer(f.reversible), escribe: f.escribe, deshacer: f.reversible,
    venceAt: p.venceAt, vence: f.vence, creadaAt: p.createdAt,
    origen: f.origen, linkEscritorio: RUTA_BANDEJA,
    // El payload de una pendiente es el YA PREPARADO: los parámetros dan los rótulos de
    // las claves que coinciden, y el resto sale con su rótulo de respaldo.
    detalle: lineasDelPayload(f.payload, def && esAccion(def) ? def.parametros : null),
  };
}

function accionADecision(prop: Propuesta): ItemDecision {
  const opId = String(prop.datos.operacion ?? '');
  const def = porId(opId);
  const accion = def && esAccion(def) ? def : null;
  const payload = esObjeto(prop.datos.payload) ? prop.datos.payload : {};
  const complejidad = complejidadDe(accion ? accion.parametros : null);
  const operacion = accion?.titulo ?? opId;
  return {
    tipo: 'accion', key: `accion:${prop.id}`, id: prop.id,
    accionMovil: complejidad === 'simple' ? 'confirmar-accion' : 'computadora',
    complejidad, operacion,
    parametros: accion ? accion.parametros.map(plano) : [],
    ...(complejidad === 'simple' ? { payload } : {}),
    titulo: prop.resumen.trim() || operacion, resumen: operacion,
    consecuencia: consecuenciaDeshacer(accion ? accion.reversible : null),
    escribe: accion?.escribe ?? null, deshacer: accion ? accion.reversible : null,
    creadaAt: prop.createdAt, origen: etiquetaDeOrigen(prop.origen),
    linkEscritorio: rutaDePropuesta('accion', prop.id),
    detalle: lineasDelPayload(payload, accion?.parametros),
  };
}

function leadADecision(prop: Propuesta): ItemDecision {
  const n = Array.isArray(prop.datos.leads) ? prop.datos.leads.length : 0;
  return {
    tipo: 'lead', key: `lead:${prop.id}`, id: prop.id, accionMovil: 'computadora',
    titulo: prop.resumen.trim() || 'Contactos nuevos',
    resumen: n > 1 ? `${n} contactos para revisar` : 'Contacto para revisar',
    creadaAt: prop.createdAt, origen: etiquetaDeOrigen(prop.origen),
    linkEscritorio: rutaDePropuesta('lead', prop.id),
    detalle: detalleDeLeads(prop.datos),
  };
}

function borradorADecision(b: Borrador): ItemDecision {
  return {
    tipo: 'borrador', key: `borrador:${b.id}`, id: b.id, accionMovil: 'computadora',
    titulo: tituloDeBorrador(b),
    resumen: resumenDeBorrador(b),
    creadaAt: b.createdAt, origen: etiquetaDeOrigen(b.origen),
    linkEscritorio: `/plan/revisar/${encodeURIComponent(b.id)}`,
    detalle: detalleDeBorrador(b),
  };
}

function confirmacionADecision(c: MakoConfirmacion): ItemDecision {
  const opciones = opcionesDeConfirmacion(c);
  return {
    tipo: 'confirmacion', key: `confirmacion:${c.id}`, id: Number(c.id),
    // Sin aplicar y sin opciones no hay nada que el teléfono pueda decidir: la tarjeta del
    // CRM tampoco dibuja un botón ahí.
    accionMovil: opciones.length ? 'resolver-confirmacion' : 'computadora',
    opciones,
    titulo: c.titulo, resumen: c.lead_nombre?.trim() || 'Lead sin nombre',
    consecuencia: c.aplicado ? 'Ya aplicado' : 'Sin aplicar',
    creadaAt: c.created_at, origen: 'vino del CRM automático',
    linkEscritorio: `/crm/${Number(c.lead_id)}`,
    detalle: lineasDeCambios(c.cambios),
  };
}

// ── Las lecturas, una por bandeja ────────────────────────────────────────────

type Lectura = { items: ItemDecision[]; recortado: boolean };

async function leerPendientes(ws: number): Promise<Lectura> {
  // El conteo va PRIMERO: si contara después, una pendiente que llega entre las dos
  // lecturas se leería como «hay y la lista vino vacía».
  const conteo = await contarPendientesVigentes(null);
  const [lista, tz] = await Promise.all([pendientesDelWorkspace(ws), tzDeWorkspace(ws).catch(() => TZ_DEFAULT)]);
  if (conteo.total == null) throw new Error('no se pudo contar las pendientes');
  if (conteo.total > 0 && !lista.length) throw new Error(`la lista volvió vacía con ${conteo.total} vigentes (la lectura se tragó el error)`);
  return { items: lista.map((p) => pendienteADecision(p, tz)), recortado: lista.length >= TOPE.pendiente };
}

async function leerPropuestas(tipo: 'accion' | 'lead'): Promise<Lectura> {
  const ps = await propuestasPendientes(tipo); // tira si la lectura falla
  return { items: ps.map(tipo === 'accion' ? accionADecision : leadADecision), recortado: ps.length >= TOPE[tipo] };
}

/**
 * Cuántos borradores del plan esperan, SIN traer filas (un borrador pesa: el ws1 tiene 133
 * pendientes y ~1 MB). Mismo universo que `listPropuestasPendientes`: pendientes y con algo
 * para ofrecer (tareas o cierres). La única diferencia posible es un borrador cuyas tareas
 * NO pasan el saneo de `rowToPropuesta` (todas sin título): la lista lo descarta y este
 * conteo no. `null` = no se pudo leer.
 */
async function contarBorradores(): Promise<number | null> {
  try {
    const db = await getTenantDb();
    const { count, error } = await db.from('plan_propuestas').select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .or('tareas.neq.[],cerrar.neq.[]');
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

async function leerBorradores(): Promise<Lectura> {
  const conteo = await contarBorradores();
  const lista = await listPropuestasPendientes(TOPE.borrador);
  if (conteo == null) throw new Error('no se pudo contar los borradores');
  if (conteo > 0 && !lista.length) throw new Error(`la lista volvió vacía con ${conteo} borradores (la lectura se tragó el error)`);
  return { items: lista.map(borradorADecision), recortado: lista.length >= TOPE.borrador };
}

async function leerConfirmaciones(): Promise<Lectura> {
  const cs = await listConfirmaciones(undefined, { estricto: true });
  return { items: cs.map(confirmacionADecision), recortado: cs.length >= TOPE.confirmacion };
}

// ── Lo público ───────────────────────────────────────────────────────────────

/**
 * Todo lo que espera una decisión de quien mira, en el workspace del request.
 *
 * `quien` sólo lo pasa un script de diagnóstico (no hay cookie); la página no lo pasa y
 * sale de la sesión. ⚠️ ESCRIBE al leer las pendientes (las vencidas pasan a 'vencida'),
 * como la bandeja de escritorio: es para una PÁGINA, no para un sondeo.
 */
export async function leerParaDecidir(quien?: QuienMira): Promise<ParaDecidir> {
  const q = quien ?? (await quienMira());
  const tipos = tiposVisibles(q.rol, q.capa);
  const ws = await getWorkspaceActual();
  if (ws == null) return { items: [], fallas: [...tipos], tipos, recortados: [] };

  const lectores: Record<TipoDecision, () => Promise<Lectura>> = {
    pendiente: () => leerPendientes(ws),
    accion: () => leerPropuestas('accion'),
    lead: () => leerPropuestas('lead'),
    borrador: () => leerBorradores(),
    confirmacion: () => leerConfirmaciones(),
  };
  const res = await Promise.allSettled(tipos.map((t) => lectores[t]()));

  const items: ItemDecision[] = [];
  const fallas: TipoDecision[] = [];
  const recortados: TipoDecision[] = [];
  res.forEach((r, i) => {
    const t = tipos[i];
    if (r.status === 'rejected') {
      fallas.push(t);
      console.error(`[inbox-movil] ws ${ws}: no se pudo leer «${t}»:`, r.reason instanceof Error ? r.reason.message : r.reason);
      return;
    }
    items.push(...r.value.items);
    if (r.value.recortado) recortados.push(t);
  });
  return { items: ordenarItems(items), fallas, tipos, recortados };
}

/**
 * El número del badge, por bandeja, SIN ESCRIBIR NADA (sirve para el layout y para un
 * sondeo). `null` = no se pudo leer — nunca 0.
 *
 * Las bandejas que el rol no ve no se cuentan ni aparecen en `porTipo`: un closer no
 * recibe el número de las acciones del admin.
 */
export async function contarParaDecidir(quien?: QuienMira): Promise<ConteoParaDecidir> {
  const q = quien ?? (await quienMira());
  return contarPorPedido(q.rol, q.capa);
}

/**
 * ⚠️ UNA VEZ POR PEDIDO (React `cache`, 14/10/2026). En General la misma cuenta corría DOS veces por
 * render: el layout la pide para el número de la barra y la página para la campana (medido en los
 * edge_logs de Supabase). La clave son el rol y la capa SUELTOS: `cache` compara los argumentos por
 * identidad, y un objeto `{ rol, capa }` nuevo en cada llamada nunca acertaría.
 */
const contarPorPedido = cache(async (rol: QuienMira['rol'], capa: QuienMira['capa']): Promise<ConteoParaDecidir> => {
  const tipos = tiposVisibles(rol, capa);
  if (!tipos.length) return { total: 0, porTipo: {} };
  const ws = await getWorkspaceActual();
  if (ws == null) return { total: null, porTipo: Object.fromEntries(tipos.map((t) => [t, null])) };

  const ve = (t: TipoDecision) => tipos.includes(t);
  const [pendientes, bandejas, borradores] = await Promise.all([
    ve('pendiente') ? contarPendientesVigentes(null).then((r) => r.total).catch(() => null) : Promise.resolve(null),
    ve('accion') || ve('lead') || ve('confirmacion') ? contarBandejas(DIAS_FALLIDAS).catch(() => null) : Promise.resolve(null),
    ve('borrador') ? contarBorradores() : Promise.resolve(null),
  ]);

  const valor: Record<TipoDecision, number | null> = {
    pendiente: pendientes,
    accion: bandejas?.acciones ?? null,
    lead: bandejas?.leads ?? null,
    confirmacion: bandejas?.crmAuto ?? null,
    borrador: borradores,
  };
  const porTipo: Partial<Record<TipoDecision, number | null>> = {};
  for (const t of tipos) porTipo[t] = valor[t];
  // El número (badge, frase de Today) cuenta SÓLO lo que se decide en el teléfono. Los
  // borradores del plan y los contactos propuestos se revisan en la computadora: medido en
  // producción el 11/10/2026, eran 68 de 68 en el ws 9 y casi todos los 138 del ws 1, y el
  // badge decía 99+ sobre cosas que el teléfono no puede resolver.
  return { total: sumarConteos(porTipo, tipos.filter((t) => DECIDIBLES_EN_TELEFONO.has(t))), porTipo };
});

/** Lo que se aprueba desde el teléfono. El resto (borradores, contactos) es de la computadora. */
export const DECIDIBLES_EN_TELEFONO: ReadonlySet<TipoDecision> = new Set<TipoDecision>(['pendiente', 'accion', 'confirmacion']);
