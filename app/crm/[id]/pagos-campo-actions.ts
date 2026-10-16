'use server';

// =============================================================================
// pagos-campo-actions — la tab Pagos escribe CAMPO POR CAMPO (sin «Editar deal»)
// =============================================================================
// Pedido de Martín (14/10/2026, app/admin/dev/crm/bitacora.ts): «Que Pagos sea personalizable... edita todo en la
// misma tab y depreca "Editar deal →" en todos lados». El diseño es docs/diseno-ficha-bloques.md §3 Pagos: cada
// bloque (`venta`, `cuotas`, `suscripcion`, `datos-fiscales`, `servicio-vendido`, `promesa-y-garantia`,
// `obligaciones`, `cobrado`) llama a UNA de estas acciones. Las pantallas las arma la tanda B2.
//
// Lo que vale para todas, y por qué:
//   · ⚠️ SIN SESIÓN, NADA. Sin cookie `getWorkspaceActual()` cae al ws1 (Mauricio, un cliente): un POST con el id
//     de la acción escribiría plata en su CRM (tests/acciones-sin-sesion.test.ts).
//   · EL LEAD ES DEL NEGOCIO DE LA SESIÓN: todo se lee y se escribe con `getTenantDb`, y un id de otro negocio
//     contesta «no encontré» (lib/pagos.ts, `asegurarLeadDelNegocio` y `filaDelLead`).
//   · LO QUE ESCRIBE DEJA SU LÍNEA EN EL HISTORIAL con el antes, el después y el actor (`anotarEnHistorial` y
//     `logLeadChanges`, que deja revertibles las de plata).
//   · DESHACER ESCRIBE EN EL SERVER (AGENTS.md, «Una pila de deshacer…»): cada acción devuelve lo que la vuelve
//     atrás —el valor de antes, o el cambio inverso— y el Deshacer de la pantalla llama a la MISMA acción con eso.
//   · Lo que es CONFIG del negocio (la moneda) o mueve el estado de una suscripción, sólo el admin.
//   · La regla vive en lib/pagos-campo.ts (pura, con tests) y la escritura en lib/pagos.ts, que también usa la API
//     de MaKo (lib/api-mako/areas/cobros.run.ts): una sola implementación.
//
// ⚠️ 'use server': sólo funciones async (y tipos) — tests/campana-producto.test.ts.
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getLead, logLeadEvent } from '@/lib/leads';
import {
  ajustarPlanPagos, anotarEnHistorial, cambiarEstadoSuscripcionManual, cortarRecordatoriosDeCuota, editarCuota,
  escribirCampoDeal, escribirObligacion, escribirVenta, getPagosByLead, guardarCuotasPorId, guardarMonedaDelNegocio,
  monedaDelNegocio, type CambioCampoDeal,
} from '@/lib/pagos';
import {
  avisoDeConservadas, lineasDeCuotas, nombreCuota, ajustarSobre, planComoEstaba, planVacio,
  type CambioObligacion, type CambioVenta, type Obligaciones, type PlanUniforme,
} from '@/lib/pagos-campo';
import { cobradoDelLead, esCuotaDevuelta, type Cobrado } from '@/lib/cobrado-lead';
import { listarCobros } from '@/lib/cobros';
import { laCobraLaPasarela, mesesTranscurridos } from '@/lib/cobros-reglas';
import { hoyEnWorkspace } from '@/lib/timezone';
import type { VentaTipo } from '@/lib/venta-tipo';

async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}
async function autor(): Promise<string> {
  try { return (await getUsuarioActual())?.email?.trim() || 'CRM'; } catch { return 'CRM'; }
}
async function esAdmin(): Promise<boolean> {
  try { return (await getRolWsEfectivo()) === 'admin'; } catch { return false; }
}

const SIN_SESION = 'Tu sesión no está activa en este negocio. Recarga la página.';
const SOLO_ADMIN = 'Sólo el administrador de este negocio puede cambiarlo.';
const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e));

type Fallo = { ok: false; error: string; faltan?: string[] };

/** La mutación ya ocurrió: si invalidar fallara, la caché vence sola por su TTL (molde de deal-actions.ts). */
function bust(...tags: string[]) {
  try { for (const t of tags) updateTag(t); } catch { /* vence por TTL */ }
}
function revalidar(leadId: number, plata = false) {
  revalidatePath(`/crm/${leadId}`);
  revalidatePath('/crm');
  revalidatePath('/customer-success');
  if (plata) {
    revalidatePath('/dashboard');
    revalidatePath('/general');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// El deal: un campo, una obligación, la venta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un campo del deal (`datos-fiscales`, `servicio-vendido`, `promesa-y-garantia`): de una sección jsonb con MERGE
 * —sólo cambia ese campo; los demás y el documento fiscal quedan— o uno de los dos sueltos (`fecha_inicio_servicio`,
 * `facturado_por_id`). Deshacer: llamarla otra vez con `antes`.
 */
export async function guardarCampoDealAction(leadId: number, cambio: CambioCampoDeal): Promise<{ ok: true; cambio: boolean; antes: string | number | null; despues: string | number | null } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId) || !cambio) return { ok: false, error: 'Lead inválido.' };
    const r = await escribirCampoDeal(leadId, cambio, await autor());
    if (r.ok && r.cambio) { bust(TAG.leads); revalidar(leadId); }
    return r;
  } catch (e) {
    return { ok: false, error: `No pude guardar: ${mensaje(e)}` };
  }
}

/**
 * Un renglón de las obligaciones del cliente o del prestador: agregar, editar o quitar. `esperado` es el texto
 * del renglón que la pantalla vio: si otra pestaña lo cambió, no se escribe. Deshacer: llamarla con `deshacer`.
 */
export async function guardarObligacionAction(leadId: number, cambio: CambioObligacion): Promise<{ ok: true; obligaciones: Obligaciones; deshacer: CambioObligacion } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId) || !cambio) return { ok: false, error: 'Lead inválido.' };
    const r = await escribirObligacion(leadId, cambio, await autor());
    if (r.ok) { bust(TAG.leads); revalidar(leadId); }
    return r;
  } catch (e) {
    return { ok: false, error: `No pude guardar: ${mensaje(e)}` };
  }
}

/**
 * Un dato de la venta (`venta`, `suscripcion`): el monto (o la mensualidad), el plazo, la fecha de cierre o el
 * tipo (pago único, suscripción o «sin cobro»), con compare-and-set sobre el tipo. `tipoVisto` es el tipo que
 * dibujó el bloque. Deshacer: llamarla con cada cambio de `deshacer`, en orden.
 */
export async function guardarVentaAction(leadId: number, cambio: CambioVenta, opts: { tipoVisto?: VentaTipo | null } = {}): Promise<{ ok: true; cambio: boolean; ventaTipo: VentaTipo; deshacer: CambioVenta[] } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId) || !cambio) return { ok: false, error: 'Lead inválido.' };
    const r = await escribirVenta(leadId, cambio, { autor: await autor(), tipoVisto: opts.tipoVisto ?? null });
    if (r.ok && r.cambio) { bust(TAG.leads, TAG.pagos); revalidar(leadId, true); }
    return r;
  } catch (e) {
    return { ok: false, error: `No pude guardar la venta: ${mensaje(e)}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Las cuotas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Edita UNA cuota impaga por su id (monto, vencimiento o los dos), sin borrar ni reinsertar: el link, el
 * recordatorio y el dedup siguen apuntando a ella. Deshacer: llamarla con `antes`.
 */
export async function editarCuotaAction(leadId: number, pagoId: number, cambio: { monto?: number | null; fecha?: string | null }): Promise<{ ok: true; antes: { monto: number; fecha: string | null }; despues: { monto: number; fecha: string | null } } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId) || !idValido(pagoId)) return { ok: false, error: 'Cuota inválida.' };
    const r = await editarCuota(leadId, pagoId, cambio ?? {});
    const antes = { monto: r.antes.monto_usd, fecha: r.antes.fecha_esperada };
    const despues = { monto: r.despues.monto_usd, fecha: r.despues.fecha_esperada };
    if (antes.monto !== despues.monto || antes.fecha !== despues.fecha) {
      await anotarEnHistorial(leadId, lineasDeCuotas({
        actualizar: [{ id: pagoId, numero: r.numero, monto_usd: despues.monto, fecha_esperada: despues.fecha, antes: { monto_usd: antes.monto, fecha_esperada: antes.fecha } }],
        insertar: [], borrar: [], conservar: [],
      }), await autor());
      bust(TAG.pagos, TAG.leads);
      revalidar(leadId, true);
    }
    return { ok: true, antes, despues };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/** Lo que cambió en las cuotas, dicho para la pantalla: qué se hizo y qué NO se tocó (con el porqué). */
type ResultadoCuotas = { ok: true; actualizadas: number; nuevas: number; quitadas: number; sinTocar: string | null };

/**
 * Las cuotas impagas de una vez, POR ID (el bloque `cuotas` en su modo lista, y el Deshacer de `ajustarPlanAction`):
 * la que trae id se actualiza, la que no se inserta, la impaga que no vino se quita — salvo las que tienen un link
 * sin pagar o un recordatorio corriendo, que quedan y se dicen en `sinTocar`. NO gana el lead.
 * Con `plan`, además devuelve al lead las columnas del plan (inicial, cuota, cantidad y día de pago).
 */
export async function guardarCuotasAction(
  leadId: number,
  cuotas: Array<{ id?: number | null; monto: number; fecha: string | null }>,
  plan?: PlanUniforme | null,
  /** Los ids de las impagas que la pantalla tenía cargadas: una que no vio no se borra (ver `reconciliarCuotas`). */
  idsVistos?: number[] | null,
): Promise<ResultadoCuotas | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId) || !Array.isArray(cuotas)) return { ok: false, error: 'Lead inválido.' };
    if (cuotas.length > 60) return { ok: false, error: 'Son demasiadas cuotas.' };
    for (const c of cuotas) {
      if (c?.fecha != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(c.fecha))) return { ok: false, error: 'Una fecha no es AAAA-MM-DD.' };
    }
    const quien = await autor();
    const vistos = Array.isArray(idsVistos) ? new Set(idsVistos.filter((x) => idValido(x))) : undefined;
    const cambios = await guardarCuotasPorId(leadId, cuotas.map((c) => { const id = c?.id; return { id: idValido(id) ? id : null, monto_usd: Number(c?.monto), fecha_esperada: c?.fecha ?? null }; }), { vistos });
    if (plan) {
      // ⚠️ TAL CUAL ESTABA, nulls incluidos (`planComoEstaba`), no por `validarPlan`: un plan anterior todo en null
      // (las cuotas se habían cargado a mano) fallaba la validación y se descartaba en silencio, así que el
      // Deshacer devolvía las cuotas y dejaba escrito el plan que se estaba deshaciendo.
      const { error } = await (await getTenantDb()).from('leads').update({ ...planComoEstaba(plan) }).eq('id', leadId);
      if (error) console.error(`[pagos-campo] no pude devolver el plan del lead ${leadId}: ${error.message}`);
    }
    await anotarEnHistorial(leadId, lineasDeCuotas(cambios), quien);
    const sinTocar = avisoDeConservadas(cambios);
    if (sinTocar) await logLeadEvent(leadId, 'Plan de pagos', `No se tocó: ${sinTocar}`, quien);
    bust(TAG.pagos, TAG.leads);
    revalidar(leadId, true);
    return { ok: true, actualizadas: cambios.actualizar.length, nuevas: cambios.insertar.length, quitadas: cambios.borrar.length, sinTocar };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/**
 * Arma o ajusta el plan uniforme (inicial, cuota, cantidad 1-6 y día de pago 1-28) y reconcilia sus cuotas por
 * número: la que existe se actualiza POR ID, la que falta se inserta y la que sobra se quita sólo si no tiene link
 * ni recordatorio. Las cobradas no se tocan. NO gana el lead: ganarlo es mover de etapa.
 * Deshacer: `guardarCuotasAction(leadId, deshacer.cuotas, deshacer.plan, deshacer.vistos)` (`vistos`: las impagas que
 * quedaron después del ajuste, para que una cuota que nazca en el medio no se borre al deshacer).
 */
export async function ajustarPlanAction(leadId: number, plan: Partial<PlanUniforme>): Promise<(ResultadoCuotas & {
  deshacer: { cuotas: Array<{ id: number; monto: number; fecha: string | null }>; plan: PlanUniforme; vistos: number[] };
}) | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId)) return { ok: false, error: 'Lead inválido.' };
    const lead = await getLead(leadId);
    if (!lead) return { ok: false, error: 'No encontré ese lead en este negocio.' };
    const fila = lead as unknown as Record<string, unknown>;
    const num = (x: unknown): number | null => (x == null || x === '' ? null : Number(x));
    const planAntes: PlanUniforme = {
      cobro_inicial_usd: num(fila.cobro_inicial_usd), monto_cuota_usd: num(fila.monto_cuota_usd),
      total_cuotas: num(fila.total_cuotas), dia_de_pago: num(fila.dia_de_pago),
    };
    // ⚠️ LO QUE VINO ES SÓLO LO QUE CAMBIÓ, y se escribe ENCIMA del plan de la base (`ajustarSobre`). Validado
    // como plan entero, cambiar sólo el inicial borraba las cuotas 1 a N y corría los vencimientos al día 1.
    const v = ajustarSobre(planAntes, plan);
    if (!v.ok) return v;
    const antes = (await getPagosByLead(leadId)).filter((q) => !q.pagado);
    // ⚠️ SIN PLAN EN LA BASE NO HAY CONTRA QUÉ AJUSTAR. Si el lead tiene cuotas impagas cargadas a mano (Editar deal,
    // el wizard), aplicar un plan encima las duplicaría (insertarlas al lado) o las borraría (reimponerlo entero), y
    // las dos cosas son plata. Se cambian en las cuotas, que es donde se cargaron.
    if (planVacio(planAntes) && antes.some((q) => !esCuotaDevuelta(q))) {
      return { ok: false, error: 'Las cuotas de este lead se cargaron a mano: cámbialas en las cuotas.', faltan: ['cuotas'] };
    }
    const quien = await autor();
    const { cambios, pagos: despues } = await ajustarPlanPagos(leadId, v.plan, await hoyEnWorkspace(), { antes: planAntes });
    await anotarEnHistorial(leadId, lineasDeCuotas(cambios), quien);
    const sinTocar = avisoDeConservadas(cambios);
    const partes = [
      v.plan.cobro_inicial_usd ? `inicial USD ${v.plan.cobro_inicial_usd}` : null,
      v.plan.monto_cuota_usd ? `${v.plan.total_cuotas} × USD ${v.plan.monto_cuota_usd}` : null,
      v.plan.dia_de_pago ? `día ${v.plan.dia_de_pago}` : null,
    ].filter(Boolean).join(' · ');
    await logLeadEvent(leadId, 'Plan de pagos', `${partes}${sinTocar ? ` · no se tocó: ${sinTocar}` : ''}`, quien);
    bust(TAG.pagos, TAG.leads);
    revalidar(leadId, true);
    return {
      ok: true, actualizadas: cambios.actualizar.length, nuevas: cambios.insertar.length, quitadas: cambios.borrar.length, sinTocar,
      deshacer: { cuotas: antes.map((q) => ({ id: q.id, monto: Number(q.monto_usd), fecha: q.fecha_esperada })), plan: planAntes, vistos: despues.filter((q) => !q.pagado).map((q) => q.id) },
    };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/**
 * Corta los recordatorios de cobranza de UNA cuota (el «Cortarlo» de `recordatorios-de-cobro`; también es lo que
 * destraba editar o quitar una cuota con un recordatorio corriendo). NO se deshace: una corrida cortada no se
 * reabre, porque reabrirla mandaría de nuevo lo que ya salió (lib/pagos.ts, `marcarPago`).
 */
export async function cortarRecordatoriosCuotaAction(leadId: number, pagoId: number): Promise<{ ok: true; cortados: number } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId) || !idValido(pagoId)) return { ok: false, error: 'Cuota inválida.' };
    const cuota = (await getPagosByLead(leadId)).find((q) => q.id === pagoId);
    const cortados = await cortarRecordatoriosDeCuota(leadId, pagoId);
    if (cortados > 0) {
      await logLeadEvent(leadId, 'Recordatorio de cobro', `Cortado a mano: ${cuota ? nombreCuota(cuota.numero) : `cuota #${pagoId}`}`, await autor());
      revalidar(leadId);
    }
    return { ok: true, cortados };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// La suscripción manual y la moneda del negocio (sólo el admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cancela o reactiva una suscripción MANUAL (la que no cobra una pasarela). Sólo el admin (el bloque
 * `suscripcion`: «cancelar, sólo el admin»). Una que cobra Stripe o Mercado Pago se cancela en la pasarela
 * (`cancelarSuscripcionAction`, cobros-actions.ts): acá se rechaza, o el CRM diría «cancelada» mientras la
 * tarjeta se sigue cobrando. Deshacer: llamarla con `deshacer`.
 */
export async function cambiarEstadoSuscripcionAction(
  leadId: number,
  estado: 'cancelada' | 'activa',
  opts: { mesesAlReactivar?: number | null } = {},
): Promise<{ ok: true; cambio: boolean; deshacer: { estado: 'cancelada' | 'activa'; mesesAlReactivar: number | null } } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
    if (!idValido(leadId) || (estado !== 'cancelada' && estado !== 'activa')) return { ok: false, error: 'Pedido inválido.' };
    const ws = await getWorkspaceActual();
    if (ws == null) return { ok: false, error: SIN_SESION };
    const lead = await getLead(leadId);
    if (!lead) return { ok: false, error: 'No encontré ese lead en este negocio.' };
    const cobros = await listarCobros(ws, { leadId, limite: 50 });
    if (laCobraLaPasarela(cobros)) {
      return { ok: false, error: 'Esta suscripción la cobra la pasarela: cancélala desde su cobro, en Links de pago.' };
    }
    const hoy = await hoyEnWorkspace();
    const r = await cambiarEstadoSuscripcionManual(leadId, estado, {
      hoy, mesesAlCancelar: mesesTranscurridos(lead.fecha_cierre ?? null, hoy), mesesAlReactivar: opts.mesesAlReactivar ?? null, autor: await autor(),
    });
    if (r.cambio) {
      bust(TAG.leads, TAG.pagos);
      revalidar(leadId, true);
    }
    return { ok: true, cambio: r.cambio, deshacer: { estado: estado === 'cancelada' ? 'activa' : 'cancelada', mesesAlReactivar: r.mesesAntes } };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/**
 * La moneda en que el negocio carga lo que cobra a mano (decisión 7: por negocio, como el resto de la config), y
 * si quien mira la puede cambiar. Es el valor INICIAL del selector de moneda de un pago a mano: sin moneda, el
 * server entiende dólares (lib/pagos-campo.ts, `pagoEnMoneda`).
 */
export async function monedaDelNegocioAction(): Promise<{ moneda: string; puedeEditar: boolean }> {
  if (!(await haySesion())) return { moneda: 'USD', puedeEditar: false };
  const [moneda, admin] = await Promise.all([monedaDelNegocio(), esAdmin()]);
  return { moneda, puedeEditar: admin };
}

/** Cambia la moneda del negocio. Sólo el admin: es la config de todo el equipo. No toca lo ya cobrado. */
export async function guardarMonedaNegocioAction(moneda: string): Promise<{ ok: true; moneda: string; antes: string } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
    const antes = await monedaDelNegocio();
    const m = await guardarMonedaDelNegocio(String(moneda ?? ''));
    revalidatePath('/crm');
    revalidatePath('/configuraciones');
    return { ok: true, moneda: m, antes };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo cobrado (lectura)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * «$X cobrado de $Y» del lead, con su semáforo (`cobradoDelLead`, lib/cobrado-lead.ts): la misma cuenta que la
 * API de MaKo (`cobranza_lead`). Los bloques que ya tienen el lead, las cuotas y los cobros pueden llamar a la
 * función pura directamente; esto es para el que no los tiene.
 */
export async function cobradoDelLeadAction(leadId: number): Promise<{ ok: true; cobrado: Cobrado } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId)) return { ok: false, error: 'Lead inválido.' };
    const ws = await getWorkspaceActual();
    if (ws == null) return { ok: false, error: SIN_SESION };
    const lead = await getLead(leadId);
    if (!lead) return { ok: false, error: 'No encontré ese lead en este negocio.' };
    const [pagos, cobros, hoy] = await Promise.all([getPagosByLead(leadId), listarCobros(ws, { leadId, limite: 50 }), hoyEnWorkspace()]);
    const fila = lead as unknown as Record<string, unknown>;
    return {
      ok: true,
      cobrado: cobradoDelLead({
        ventaTipo: lead.venta_tipo ?? null,
        montoCierreUsd: lead.monto_cierre_usd ?? null,
        suscripcionMontoUsd: lead.suscripcion_monto_usd ?? null,
        suscripcionMeses: lead.suscripcion_meses ?? null,
        fechaCierre: lead.fecha_cierre ?? null,
        suscripcionCanceladaAt: (fila.suscripcion_cancelada_at as string | null | undefined) ?? null,
        pagos,
        cobros,
        hoy,
      }),
    };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}
