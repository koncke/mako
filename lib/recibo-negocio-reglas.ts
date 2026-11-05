// =============================================================================
// recibo-negocio-reglas — el recibo que un NEGOCIO le manda a su cliente al cobrar (5/11/2026)
// =============================================================================
// La tarjeta «Pagos › Emitir recibo» de Automations (docs/relevo/pagos-automations-encargo.md): «varios templates de factura
// que nosotros podemos crear y que el usuario pueda elegir». Puro y SIN `server-only`: arma la FOTO del recibo desde la cuota
// cobrada, el emisor («Facturado por») y, si lo hubo, el comprobante que leyó la tarjeta «Leer comprobante». El PDF es el de
// los recibos de MaKo (lib/recibo-pdf.ts), con la plantilla que eligió el negocio.
//
// ⚠️ ES UN RECIBO DE PAGO, NO UNA FACTURA FISCAL, y el PDF lo dice siempre (`PIE_FIJO`). «Factura» no se ofrece: la obligación
// fiscal es de cada país y de cada negocio, y no se inventa un dato del emisor (sin «Facturado por», el nombre del negocio).
// ⚠️ SÓLO SE EMITE SOBRE UNA CUOTA COBRADA: el recibo acredita un pago que una persona (o la pasarela) ya marcó.
// =============================================================================

import { esMedio, instanteDeLaFecha, mesEnTexto, numeroEnTexto, EMISOR_POR_DEFECTO, type Emisor } from './recibos-reglas';
import { PLANTILLAS_RECIBO, esPlantillaRecibo, type FotoRecibo, type PlantillaRecibo } from './recibo-pdf';

export { PLANTILLAS_RECIBO, esPlantillaRecibo, type PlantillaRecibo };

/** Por dónde sale el recibo: al lead por WhatsApp o por correo, o al grupo de MaKo del negocio. */
export const CANALES_RECIBO = ['whatsapp', 'email', 'grupo'] as const;
export type CanalRecibo = (typeof CANALES_RECIBO)[number];
export const esCanalRecibo = (v: unknown): v is CanalRecibo => (CANALES_RECIBO as readonly unknown[]).includes(v);
export const ROTULO_CANAL_RECIBO: Readonly<Record<CanalRecibo, string>> = { whatsapp: 'Al lead por WhatsApp', email: 'Al lead por correo', grupo: 'Al grupo de MaKo' };

/** La cuota como la lee el emisor (las columnas de `pagos`). */
export type CuotaCobrada = {
  id: number;
  numero: number | null;
  pagado: boolean;
  monto_usd: number | string;
  moneda: string | null;
  monto_original: number | string | null;
  fecha_pago: string | null;
  pago_hora: string | null;
  proveedor: string | null;
  es_mensualidad?: boolean | null;
  nacio_cobrada?: boolean | null;
};

/** Una identidad de «Facturado por» (mig 0060). */
export type IdentidadFiscal = { nombre: string; id_fiscal: string | null; domicilio: string | null; correo: string | null };

/** Lo que dejó la tarjeta «Leer comprobante» sobre ESTA cuota, si lo hubo: el medio y el N.º de operación. */
export type DelComprobante = { medio: string | null; operacion: string | null } | null;

/** El emisor del recibo: «Facturado por» si el negocio lo cargó; si no, su nombre. Nunca un dato fiscal inventado. */
export function emisorDelNegocio(ident: IdentidadFiscal | null, nombreNegocio: string | null): Emisor {
  const nombre = (ident?.nombre ?? '').trim() || (nombreNegocio ?? '').trim() || EMISOR_POR_DEFECTO.nombre;
  return {
    nombre: nombre.slice(0, 120),
    documento: ident?.id_fiscal?.trim() || null,
    direccion: ident?.domicilio?.trim() || null,
    correo: ident?.correo?.trim() || null,
    asunto: null,
    intro: null,
  };
}

/** Qué se pagó, en una línea: la mensualidad, un pago suelto o la cuota N. */
export function conceptoDeCuota(q: Pick<CuotaCobrada, 'numero' | 'es_mensualidad' | 'nacio_cobrada'>, producto: string | null): string {
  const base = q.es_mensualidad ? 'Mensualidad' : q.nacio_cobrada || q.numero == null ? 'Pago' : `Cuota ${q.numero}`;
  const p = (producto ?? '').trim();
  return p ? `${base} · ${p.slice(0, 120)}` : base;
}

/** El monto en la moneda en que se cobró: la suya si no es USD y la cuota la tiene; si no, los dólares. */
export function montoDeCuota(q: Pick<CuotaCobrada, 'monto_usd' | 'moneda' | 'monto_original'>): { monto: number; moneda: string } {
  const mon = (q.moneda ?? '').trim().toUpperCase();
  if (mon && mon !== 'USD' && Number(q.monto_original) > 0) return { monto: Math.round(Number(q.monto_original) * 100) / 100, moneda: mon };
  return { monto: Math.round(Number(q.monto_usd) * 100) / 100, moneda: 'USD' };
}

/**
 * LA FOTO DEL RECIBO, sin número (lo da la base al emitir). Tira si la cuota no está cobrada: un recibo acredita un pago hecho.
 * La fecha del pago es la de la cuota en la zona del negocio; sin hora, las 12:00 (una fecha sola no cambia de día en ninguna zona).
 */
export function fotoDelPago(o: {
  cuota: CuotaCobrada; aNombre: string; emisor: Emisor; zona: string; producto: string | null; comprobante: DelComprobante;
  plantilla: PlantillaRecibo; emitidoAt: string;
}): FotoRecibo {
  const q = o.cuota;
  if (!q.pagado || !q.fecha_pago) throw new Error('Esa cuota no está cobrada: el recibo se emite cuando el pago ya está marcado.');
  const { monto, moneda } = montoDeCuota(q);
  if (!(monto > 0)) throw new Error('La cuota no tiene monto.');
  const dia = String(q.fecha_pago).slice(0, 10);
  const hora = /^\d{1,2}:\d{2}/.test(q.pago_hora ?? '') ? String(q.pago_hora).slice(0, 5).padStart(5, '0') : '12:00';
  const fecha = instanteDeLaFecha(`${dia}T${hora}`, o.zona) ?? `${dia}T12:00:00.000Z`;
  const medio = esMedio(q.proveedor) ? q.proveedor : (o.comprobante?.medio ?? '').trim() || 'otro';
  const referencia = (o.comprobante?.operacion ?? '').trim() || `Pago #${q.id}`;
  const concepto = conceptoDeCuota(q, o.producto);
  return {
    numero: null,
    aNombre: (o.aNombre.trim() || 'Sin nombre').slice(0, 200),
    emitidoAt: o.emitidoAt,
    zona: o.zona,
    emisor: o.emisor,
    lineas: [{ concepto, mes: mesEnTexto(dia.slice(0, 7)), monto, moneda }],
    totalDetalle: monto,
    monedaDetalle: moneda,
    totales: [{ moneda, monto }],
    impuesto: null,
    pagos: [{ medio, referencia, fecha, monto, moneda }],
    notaPdf: null,
    plantilla: o.plantilla,
  };
}

/** El texto que acompaña al PDF. Sin el monto en el grupo (lo ven más personas que quien pagó). */
export function textoDelRecibo(numero: number, canal: CanalRecibo, nombreNegocio: string): { pie: string; asunto: string; cuerpo: string } {
  const n = numeroEnTexto(numero);
  return {
    pie: canal === 'grupo' ? `Recibo de pago N.º ${n} emitido. El detalle está en el PDF.` : `Te dejo tu recibo de pago N.º ${n}. Gracias por tu pago.`,
    asunto: `Tu recibo de pago N.º ${n} · ${nombreNegocio}`.slice(0, 150),
    cuerpo: `Hola:\n\nTe adjuntamos tu recibo de pago N.º ${n}. Es un recibo de pago, no una factura fiscal.\n\nGracias,\n${nombreNegocio}`,
  };
}

/** El nombre del PDF: «Recibo 0003 - Ana Pérez.pdf», sin caracteres que un sistema de archivos rechace. */
export function nombreDelPdfNegocio(numero: number, aNombre: string): string {
  const seguro = aNombre.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 60);
  return `Recibo ${numeroEnTexto(numero)}${seguro ? ` - ${seguro}` : ''}.pdf`;
}
