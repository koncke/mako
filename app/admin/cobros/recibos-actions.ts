'use server';

// =============================================================================
// Admin › Billing › Recibos — las acciones del SUPER ADMIN sobre el libro de recibos (5/11/2026)
// =============================================================================
// Martín: «me gustaría que todo esto lo vayamos evidentemente guardando dentro de la aplicación, dentro de SuperAdmin tal vez,
// para que tengamos un registro». Todo pasa por lib/recibos.ts; acá sólo el cerrojo y el `revalidatePath`.
//
// ⚠️ `getSesionAdmin()` EN LA PRIMERA LÍNEA DE CADA UNA (lo fija tests/admin-cobros.test.ts): el id de una server action viaja
// en el bundle, y estos recibos son de TODOS los clientes (sus montos y sus comprobantes).
// ⚠️ EL LIBRO NO TIENE WORKSPACE: es de la plataforma. Nada de acá lee el ws de la cookie (el super admin puede estar mirando a
// un cliente con `?ws=`); los settings («Datos del recibo») se leen y escriben en `wsSuperAdmin()` adentro de lib/recibos.ts.

import { revalidatePath } from 'next/cache';
import { getSesionAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import {
  anularRecibo, emitirReciboManual, guardarEmisor, guardarWaSolo, leerEmisor, leerWaSolo, listarRecibos, marcarReciboDevueltoAMano, problemaParaAtar,
  reenviarRecibo, registrarReciboEnElCrm, type FiltroRecibos, type ReciboListado, type PagoManual,
} from '@/lib/recibos';
import { AVISO_SIN_CRM, claveDelCobro, totalesDelRegistro, type Emisor, type EstadoRecibo } from '@/lib/recibos-reglas';
import type { LineaRecibo } from '@/lib/recibo-pdf';
import { planesMako } from '@/lib/compra-plan';
import { cambiosDelPedido, emisorConCambios, problemaDelPerfil, type CambiosEmisor } from '@/app/admin/_polar/datos/ajustes';

const NO_ADMIN = 'Sólo el super admin ve los recibos de MaKo.';
const mensaje = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);
const autorDe = (s: { nombre?: string; email?: string }) => s.nombre?.trim() || s.email?.trim() || 'Super admin';

export type DatosRecibos =
  | {
    ok: true; recibos: ReciboListado[]; alTope: boolean; faltaLaMigracion: boolean;
    totales: ReturnType<typeof totalesDelRegistro>; emisor: Emisor; waSolo: boolean;
    planes: Array<{ nombre: string; precioUsd: number }>; cuentas: Array<{ id: number; nombre: string }>;
  }
  | { ok: false; error: string };

/** La lista del filtro, sus totales por moneda, los «Datos del recibo» y los atajos del formulario. */
export async function recibosAction(f: FiltroRecibos = {}): Promise<DatosRecibos> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const [lista, emisor, waSolo, planes, cuentas] = await Promise.all([
      listarRecibos(f), leerEmisor(), leerWaSolo(), planesMako().catch(() => []), cuentasActivas(),
    ]);
    const totales = totalesDelRegistro(lista.recibos.map((r) => ({ estado: r.estado as EstadoRecibo, totales_recibido: r.totales_recibido, impuesto: r.impuesto, medios: r.pagos.map((p) => p.medio) })));
    return {
      ok: true, recibos: lista.recibos, alTope: lista.alTope, faltaLaMigracion: !!lista.faltaLaMigracion, totales, emisor, waSolo,
      planes: planes.map((p) => ({ nombre: p.nombre, precioUsd: p.precioUsd })), cuentas,
    };
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude leer los recibos.') };
  }
}

/** Las cuentas activas (para «¿De quién?»): id y nombre, nada más. */
async function cuentasActivas(): Promise<Array<{ id: number; nombre: string }>> {
  const { data, error } = await getSupabaseServer().from('workspaces').select('id, nombre, estado').order('nombre', { ascending: true }).limit(500);
  if (error) throw new Error(`No pude leer las cuentas: ${error.message}`);
  return ((data ?? []) as Array<{ id: number; nombre: string | null; estado?: string | null }>)
    .filter((w) => w.estado !== 'borrado').map((w) => ({ id: Number(w.id), nombre: String(w.nombre ?? '').trim() || `Cuenta ${w.id}` }));
}

export type PedidoCargarPago = {
  formId: string; destinoWs: number; aNombre: string; mes: string | null; lineas: LineaRecibo[];
  /** `pago_crm`: el pago del CRM de la plataforma que ES este cobro (el formulario lo ofrece primero); null = registrarlo. */
  pagos: Array<PagoManual & { pago_crm?: number | null }>;
  notaPdf: string | null; notaInterna: string | null; enviar: boolean;
};

/**
 * «Cargar pago»: el recibo de plata que entró por fuera de la pasarela (Binance, transferencia…), y el PAGO en el CRM de la
 * plataforma (revisión del Cerebro del 6/11/2026, punto 4): sólo con el recibo, Orders lo sumaba y Overview, Metrics y Finance
 * no lo veían. Cada cobro se ata al pago del CRM que se eligió (uno que ya estaba sin recibo) o a uno nuevo en la ficha de esa
 * cuenta (`registrarReciboEnElCrm`). Los pagos elegidos se validan ANTES de emitir: un recibo emitido gasta su número. Si el
 * recibo sale y el CRM no, se dice (`aviso`) y el recibo no suma en Ingresos. ⚠️ El registro va ACÁ y nunca en
 * `emitirReciboManual`: también la llama el flujo de agencias, que ya marcó su mes en su propio registro.
 */
export async function cargarPagoAction(p: PedidoCargarPago): Promise<{ ok: true; id: number; numero: number; yaEstaba: boolean; aviso?: string } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const atar = new Map<string, number>();
    const elegidos: number[] = [];
    for (const q of p.pagos ?? []) {
      const id = q.pago_crm;
      if (id == null) continue;
      if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'Ese pago del CRM no existe.' };
      elegidos.push(id);
      atar.set(claveDelCobro(String(q.medio ?? ''), String(q.referencia ?? '')), id);
    }
    // Todos los elegidos (no los del Map: dos cobros con el mismo pago tienen que llegar repetidos para frenarse).
    const problema = await problemaParaAtar(p.destinoWs, elegidos);
    if (problema) return { ok: false, error: problema };
    const r = await emitirReciboManual({ ...p, autor: autorDe(admin) });
    if (!r.ok) return { ok: false, error: r.error };
    const crm = await registrarReciboEnElCrm({ reciboId: r.id, numero: r.numero, destinoWs: p.destinoWs, lineas: p.lineas, atar })
      .catch(() => ({ aviso: AVISO_SIN_CRM['no-pude'] }));
    revalidatePath('/customers');
    const aviso = [r.aviso, crm.aviso].filter(Boolean).join(' ');
    // El id viaja para «Bajar el PDF» del recibo recién emitido (Admin › Billing › Cargar pago, 6/11/2026).
    return { ok: true, id: r.id, numero: r.numero, yaEstaba: r.yaEstaba, ...(aviso ? { aviso } : {}) };
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude emitir el recibo.') };
  }
}

/** «Reenviar»: un lote nuevo, a los mismos o a otro correo. */
export async function reenviarReciboAction(id: number, o: { correo?: string | null; whatsapp?: boolean }): Promise<{ ok: true; correo: string; whatsapp: string } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'Ese recibo no existe.' };
  try {
    const r = await reenviarRecibo(id, { autor: autorDe(admin), correo: o.correo ?? null, whatsapp: o.whatsapp });
    if (!r.ok) return r;
    revalidatePath('/customers');
    return { ok: true, correo: r.resultado?.correo ?? 'pendiente', whatsapp: r.resultado?.whatsapp ?? 'pendiente' };
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude reenviar el recibo.') };
  }
}

/** «Anular» (sólo los cargados a mano): el número queda gastado y las órdenes se liberan. */
export async function anularReciboAction(id: number, avisar: boolean): Promise<{ ok: true; numero: number } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'Ese recibo no existe.' };
  try {
    const r = await anularRecibo({ id, autor: autorDe(admin), avisar });
    if (r.ok) revalidatePath('/customers');
    return r;
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude anular el recibo.') };
  }
}

/** «Marcar devuelto» (sólo los cargados a mano: la plata de Binance se devolvió por fuera). */
export async function marcarDevueltoReciboAction(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'Ese recibo no existe.' };
  try {
    const r = await marcarReciboDevueltoAMano(id, autorDe(admin));
    if (r.ok) revalidatePath('/customers');
    return r;
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude marcarlo devuelto.') };
  }
}

/**
 * «Datos del recibo»: el emisor (nunca se inventa un dato fiscal) y el asunto y la primera frase del correo.
 * ⚠️ RECIBE SÓLO LO QUE CAMBIÓ y lo mezcla ACÁ sobre lo guardado (punto 15 de la revisión del 6/11/2026): Settings › General y
 *    Customer Notifications editan partes distintas del mismo emisor, y si cada una mandaba el suyo entero, la que guardaba
 *    segunda pisaba lo de la otra con su copia vieja. Lo que llega se recorta a las claves del emisor (`cambiosDelPedido`), y el
 *    correo se revisa también acá: es lo que sale en cada recibo. `revalidatePath` de Settings entero: ninguna de las dos
 *    pantallas se vuelve a abrir con el emisor de antes (el `prefetch` o el botón atrás).
 */
export async function guardarEmisorAction(cambios: CambiosEmisor): Promise<{ ok: true; emisor: Emisor } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const limpio = cambiosDelPedido(cambios);
    const correo = (limpio.correo ?? '').trim();
    if (correo && problemaDelPerfil({ nombre: 'x', correo })) return { ok: false, error: 'Revisa el correo de contacto.' };
    const emisor = await guardarEmisor(emisorConCambios(await leerEmisor(), limpio));
    revalidatePath('/admin/settings', 'layout');
    return { ok: true, emisor };
  } catch (err) {
    return { ok: false, error: mensaje(err, 'No pude guardar los datos del recibo.') };
  }
}

/** El interruptor «WhatsApp a quien paga solo». */
export async function guardarWaSoloAction(prendido: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    await guardarWaSolo(!!prendido);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mensaje(err, 'No pude guardar el interruptor.') };
  }
}
