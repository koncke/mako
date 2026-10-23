// =============================================================================
// stripe-catalogo — los precios de Stripe del negocio, y traer uno al catálogo de MaKo (23/10/2026)
// =============================================================================
// «Vincular cobro» (app/crm/cobro-etapa-actions.ts) sólo listaba el catálogo de MaKo: el producto de US$270 que Mauricio
// tenía en Stripe no aparecía y «Volver a leer» no traía nada nuevo. Las reglas (qué se puede traer, el mismo nombre es el
// mismo producto) están en lib/stripe-catalogo-reglas.ts.
//
// Lo que no se ve en el código y muerde:
//   · EN VIVO, SIN CACHÉ. Quien acaba de crear el precio en Stripe y toca «Volver a leer» tiene que verlo.
//   · CADA CUENTA CON SU CLAVE, y la que no se puede leer se DICE con su nombre: «no pude leer» no es «no tiene productos».
//   · EL MONTO SE VUELVE A LEER EN STRIPE al traerlo, con la clave de la cuenta elegida: lo que viene del navegador es sólo
//     qué precio (un id de otra cuenta da 404, nunca el de otro negocio).
// =============================================================================

import 'server-only';
import { cuentasDePago, credStripeDe, type CuentaDePago } from './cuentas-pago-server';
import { partirIdDeCuenta } from './cuentas-integracion';
import { leerPrecioStripe, listarPreciosStripe } from './stripe-api';
import { guardarProducto, productosParaCobrar } from './cobro-etapa-server';
import type { ProductoCobro } from './cobro-etapa';
import { importacionDelPrecio, precioDeStripe, productoDeMako, type PrecioDeStripe } from './stripe-catalogo-reglas';

export type { PrecioDeStripe } from './stripe-catalogo-reglas';
/** Una cuenta de Stripe que no se pudo leer (o que tiene de más), con su nombre. */
export type AvisoDeCuentaStripe = { cuenta: string; cuentaNombre: string; error: string };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const PRECIO_ID = /^price_[A-Za-z0-9]{1,200}$/;

async function stripesConectadas(ws: number): Promise<CuentaDePago[]> {
  return (await cuentasDePago(ws, 'stripe')).filter((c) => c.conectada);
}

/**
 * Los precios activos de TODAS las cuentas de Stripe conectadas del negocio, en paralelo, cada uno con su cuenta y con el
 * producto de MaKo que es él (`enMako`). Una cuenta que no se puede leer va en `errores`; las demás se muestran igual.
 */
export async function preciosDeStripe(ws: number): Promise<{ precios: PrecioDeStripe[]; errores: AvisoDeCuentaStripe[] }> {
  const [cuentas, catalogo] = await Promise.all([stripesConectadas(ws), productosParaCobrar()]);
  const leidas = await Promise.all(cuentas.map(async (c) => {
    const aviso = (error: string): AvisoDeCuentaStripe => ({ cuenta: c.id, cuentaNombre: c.nombre, error });
    try {
      const cred = await credStripeDe(ws, c.cuenta);
      if (!cred) return { precios: [], aviso: aviso('No pude leer su clave: vuelve a conectarla en Integraciones.') };
      const r = await listarPreciosStripe(cred.key);
      if (!r.ok) return { precios: [], aviso: aviso(r.error) };
      const precios = r.precios.map((p) => precioDeStripe(p, { id: c.id, nombre: c.nombre })).filter((p): p is NonNullable<typeof p> => p != null);
      return { precios, aviso: r.masDe ? aviso('Tiene más de 300 precios activos: muestro los primeros 300.') : null };
    } catch (e) {
      return { precios: [], aviso: aviso(msg(e)) };
    }
  }));
  const precios = leidas.flatMap((l) => l.precios)
    .map((p) => ({ ...p, enMako: productoDeMako(p, catalogo).id }))
    .sort((a, b) => (a.noSe ? 1 : 0) - (b.noSe ? 1 : 0) || a.nombre.localeCompare(b.nombre, 'es'));
  return { precios, errores: leidas.flatMap((l) => (l.aviso ? [l.aviso] : [])) };
}

/**
 * Trae UN precio de Stripe al catálogo de MaKo: lo vuelve a leer en Stripe con la clave de esa cuenta, y crea el producto,
 * le pone el precio al de MaKo con el mismo nombre, o no toca nada si ya cobra eso. `antes` es el precio que tenía.
 */
export async function importarPrecioDeStripe(ws: number, cuentaId: unknown, precioId: unknown): Promise<
  { ok: true; producto: ProductoCobro; cambio: 'creado' | 'precio' | 'igual'; antes: number | null; precio: PrecioDeStripe } | { ok: false; error: string }
> {
  const pc = partirIdDeCuenta(cuentaId);
  if (!pc || pc.proveedor !== 'stripe') return { ok: false, error: 'Esa cuenta de Stripe no existe.' };
  if (typeof precioId !== 'string' || !PRECIO_ID.test(precioId)) return { ok: false, error: 'Ese precio de Stripe no existe.' };
  const cuenta = (await stripesConectadas(ws)).find((c) => c.id === cuentaId);
  if (!cuenta) return { ok: false, error: 'Esa cuenta de Stripe no está conectada.' };
  const cred = await credStripeDe(ws, pc.cuenta);
  if (!cred) return { ok: false, error: `No pude leer la clave de ${cuenta.nombre}: vuelve a conectarla en Integraciones.` };
  const r = await leerPrecioStripe(cred.key, precioId);
  if (!r.ok) return { ok: false, error: r.status === 404 ? `Ese precio ya no está en ${cuenta.nombre}.` : `Stripe no contestó: ${r.error}` };
  const leido = precioDeStripe(r.precio, { id: cuenta.id, nombre: cuenta.nombre });
  if (!leido) return { ok: false, error: `Ese precio o su producto ya no están activos en ${cuenta.nombre}.` };
  if (leido.noSe) return { ok: false, error: leido.noSe };
  const catalogo = await productosParaCobrar();
  const m = productoDeMako(leido, catalogo);
  if (m.ambiguo) return { ok: false, error: `Hay varios «${leido.nombre}» en el catálogo con precios distintos: elige uno del catálogo.` };
  const precio: PrecioDeStripe = { ...leido, enMako: m.id };
  const existente = m.id == null ? null : catalogo.find((x) => x.id === m.id) ?? null;
  const d = importacionDelPrecio(leido, existente);
  if ('error' in d) return { ok: false, error: d.error };
  if (d.accion === 'igual' && existente) return { ok: true, producto: existente, cambio: 'igual', antes: existente.montoUsd, precio };
  const g = await guardarProducto(d.input, d.accion === 'precio' && existente ? existente.id : undefined);
  if (!g.ok) return g;
  return { ok: true, producto: g.producto, cambio: d.accion === 'crear' ? 'creado' : 'precio', antes: existente?.montoUsd ?? null, precio: { ...precio, enMako: g.producto.id } };
}
