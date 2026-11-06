// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/invoice/_components/data.ts.
// =============================================================================
// Billing › Cargar pago — los valores del formulario del recibo y sus cuentas (6/11/2026)
// =============================================================================
// Sin `'use client'` ni `server-only`: lo ejecutan los tests. Lo de Studio (las medidas del papel, los renglones, los totales)
// con el recibo de MaKo: la cuenta y a nombre de quién, qué se pagó (en UNA moneda), cómo se pagó (uno o más pagos, con su
// referencia: el «Order ID» de Binance) y las dos notas. Lo que importa lo vuelve a validar el servidor (lib/recibos.ts,
// `emitirReciboManual`); acá se avisa antes, con los mismos textos de la pantalla de antes (CargarPago.tsx, 5/11/2026).
// ⚠️ No marca meses pagados ni escribe cuotas: eso es de la rama de agencias (docs/relevo/nube-recibos.md).

import { diferencia, referenciaNormal, type MedioRecibo } from "@/lib/recibos-reglas";

export const INVOICE_PAPER_WIDTH = 816;
export const INVOICE_PAPER_HEIGHT = 1056;
export const INVOICE_PAPER_SCALE = 0.6;

export const MONEDAS = ["USD", "USDT", "USDC", "ARS", "MXN", "EUR"] as const;

export type LineaForm = { id: string; concepto: string; mes: string; monto: number };
export type PagoForm = {
  id: string;
  medio: MedioRecibo;
  referencia: string;
  /** AAAA-MM-DD */
  fecha: string;
  /** HH:mm */
  hora: string;
  monto: number;
  moneda: string;
  de: string;
  comprobante: { path: string; nombre: string } | null;
};
export type ReciboForm = {
  cuenta: string;
  aNombre: string;
  /** La moneda de los renglones: una sola por recibo. */
  moneda: string;
  lineas: LineaForm[];
  pagos: PagoForm[];
  notaPdf: string;
  notaInterna: string;
};

let n = 0;
export const nuevoIdFila = (pre: string): string => `${pre}-${Date.now().toString(36)}-${(n++).toString(36)}`;

export function valoresIniciales(hoy: string, hora = "12:00"): ReciboForm {
  return {
    cuenta: "",
    aNombre: "",
    moneda: "USD",
    lineas: [{ id: nuevoIdFila("l"), concepto: "", mes: "", monto: Number.NaN }],
    pagos: [{ id: nuevoIdFila("p"), medio: "binance", referencia: "", fecha: hoy, hora, monto: Number.NaN, moneda: "USDT", de: "", comprobante: null }],
    notaPdf: "",
    notaInterna: "",
  };
}

const num = (v: number): number => (Number.isFinite(v) ? v : 0);
const r2 = (x: number): number => Math.round(x * 100) / 100;

/** Lo que se pagó (los renglones), en su moneda. */
export function totalDetalle(f: Pick<ReciboForm, "lineas">): number {
  return r2(f.lineas.reduce((a, l) => a + num(l.monto), 0));
}

/** Lo que entró, por moneda (dos pagos pueden venir en monedas distintas). */
export function recibido(f: Pick<ReciboForm, "pagos">): Array<{ moneda: string; monto: number }> {
  const t: Record<string, number> = {};
  for (const p of f.pagos) if (num(p.monto) > 0) t[p.moneda] = r2((t[p.moneda] ?? 0) + num(p.monto));
  return Object.entries(t).map(([moneda, monto]) => ({ moneda, monto }));
}

/** De más (+) o de menos (−) contra lo que se pagó; null si no se puede comparar. */
export function diferenciaDe(f: Pick<ReciboForm, "lineas" | "pagos" | "moneda">): number | null {
  const total = totalDetalle(f);
  return total > 0 ? diferencia(total, f.moneda, recibido(f)) : null;
}

/** El primer problema del formulario, o null. Los mismos textos que la pantalla de antes. */
export function problemaDe(f: ReciboForm, subiendo: boolean): string | null {
  if (!f.cuenta) return "Elige la cuenta.";
  if (!f.aNombre.trim()) return "Falta a nombre de quién va.";
  if (f.lineas.some((l) => !l.concepto.trim() || !(num(l.monto) > 0))) return "Cada renglón necesita concepto e importe.";
  for (const p of f.pagos) {
    if (!referenciaNormal(p.medio, p.referencia)) return p.medio === "binance" ? "La orden de Binance son los 18 dígitos del «Order ID»." : "Falta la referencia del pago.";
    if (!(num(p.monto) > 0) || !p.fecha) return "Cada pago necesita fecha y monto.";
  }
  if (subiendo) return "Espera a que termine de subir el comprobante.";
  return null;
}

/** Lo que recibe `cargarPagoAction`. */
export function pedidoDe(f: ReciboForm, formId: string, enviar: boolean) {
  return {
    formId,
    destinoWs: Number(f.cuenta),
    aNombre: f.aNombre.trim(),
    mes: null,
    lineas: f.lineas.map((l) => ({ concepto: l.concepto, mes: l.mes.trim() || null, monto: num(l.monto), moneda: f.moneda })),
    pagos: f.pagos.map((p) => ({
      medio: p.medio,
      referencia: p.referencia,
      fecha: `${p.fecha}T${p.hora || "00:00"}`,
      monto: num(p.monto),
      moneda: p.moneda,
      de: p.de.trim() || null,
      comprobante_path: p.comprobante?.path ?? null,
      comprobante_nombre: p.comprobante?.nombre ?? null,
    })),
    notaPdf: f.notaPdf.trim() || null,
    notaInterna: f.notaInterna.trim() || null,
    enviar,
  };
}
