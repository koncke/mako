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
  anularRecibo, emitirReciboManual, guardarEmisor, guardarWaSolo, leerEmisor, leerWaSolo, listarRecibos, marcarReciboDevueltoAMano, reenviarRecibo,
  type FiltroRecibos, type ReciboListado, type PagoManual,
} from '@/lib/recibos';
import { totalesDelRegistro, type Emisor, type EstadoRecibo } from '@/lib/recibos-reglas';
import type { LineaRecibo } from '@/lib/recibo-pdf';
import { planesMako } from '@/lib/compra-plan';

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
  formId: string; destinoWs: number; aNombre: string; mes: string | null; lineas: LineaRecibo[]; pagos: PagoManual[];
  notaPdf: string | null; notaInterna: string | null; enviar: boolean;
};

/** «Cargar pago»: el recibo de plata que entró por fuera de la pasarela (Binance, transferencia…). */
export async function cargarPagoAction(p: PedidoCargarPago): Promise<{ ok: true; id: number; numero: number; yaEstaba: boolean; aviso?: string } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const r = await emitirReciboManual({ ...p, autor: autorDe(admin) });
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath('/customers');
    // El id viaja para «Bajar el PDF» del recibo recién emitido (Admin › Billing › Cargar pago, 6/11/2026).
    return { ok: true, id: r.id, numero: r.numero, yaEstaba: r.yaEstaba, ...(r.aviso ? { aviso: r.aviso } : {}) };
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

/** «Datos del recibo»: el emisor (nunca se inventa un dato fiscal) y el asunto y la primera frase del correo. */
export async function guardarEmisorAction(e: Partial<Emisor>): Promise<{ ok: true; emisor: Emisor } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    return { ok: true, emisor: await guardarEmisor(e) };
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
