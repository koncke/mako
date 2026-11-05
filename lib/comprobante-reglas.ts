// =============================================================================
// comprobante-reglas — leer un comprobante de pago que manda un lead, y decidir qué es (5/11/2026)
// =============================================================================
// La tarjeta «Pagos › Leer comprobante» de Automations (docs/relevo/pagos-automations-encargo.md). Martín: «un lector de
// comprobantes de pago [...] para leer comprobantes que vienen». Puro y SIN `server-only`: lo usan lib/comprobantes.ts (que
// baja el archivo y llama a la IA del negocio), la condición del flujo, «Probar» y los tests.
//
// ⚠️ LO QUE DICE EL MODELO NO DECIDE NADA SOLO. El modelo transcribe (monto, moneda, fecha, medio, destinatario, N.º de
// operación) y dice si tiene dudas; el CÓDIGO decide el estado y si cubre lo que se debía. Una lectura sin monto, sin fecha o
// sin N.º de operación, o con dudas, es `dudoso`: va a una persona (la regla «nunca marca algo como pagado con dudas»).
// ⚠️ UN PAGO PARCIAL NO SALDA EL TOTAL: `cubre` compara contra lo que tocaba pagar, en la MISMA moneda; otra moneda no se
// convierte (no hay tasa que valga) y es `otra_moneda`, que también va a una persona.
// ⚠️ UN N.º DE OPERACIÓN REPETIDO NO CUENTA DOS VECES: la base lo frena con un índice único por negocio (mig 0398); acá se
// normaliza igual que allá (`operacionNormal`), o dos grafías de la misma orden pasarían como dos pagos.
// =============================================================================

/** Lo que el modelo devuelve, ya saneado. Todo puede faltar. */
export type LecturaComprobante = {
  esComprobante: boolean;
  monto: number | null;
  moneda: string | null;
  fecha: string | null;
  hora: string | null;
  medio: string | null;
  destinatario: string | null;
  operacion: string | null;
  dudas: string | null;
};

/** Lo que tocaba pagar (la cuota que sigue del lead), o null si no hay nada pendiente. */
export type Esperado = { monto: number; moneda: string; pagoId: number | null } | null;

export type EstadoLectura = 'leido' | 'dudoso' | 'ilegible';
export type Cobertura = 'total' | 'parcial' | 'de_mas' | 'otra_moneda' | 'sin_cuota';

/**
 * Lo que la condición «Su comprobante» puede preguntar. El orden es el de la decisión: un repetido es repetido aunque cubra,
 * y un dudoso nunca «cubre».
 */
export type ResultadoComprobante = 'cubre' | 'parcial' | 'repetido' | 'dudoso' | 'no_es' | 'no_llego';
export const RESULTADOS_COMPROBANTE: ReadonlyArray<{ id: ResultadoComprobante; rotulo: string }> = [
  { id: 'cubre', rotulo: 'Cubre lo que debía' },
  { id: 'parcial', rotulo: 'Pagó menos de lo que debía' },
  { id: 'repetido', rotulo: 'Su N.º de operación ya se usó' },
  { id: 'dudoso', rotulo: 'Hay que revisarlo' },
  { id: 'no_es', rotulo: 'No es un comprobante' },
  { id: 'no_llego', rotulo: 'No hay comprobante leído' },
];
export const esResultadoComprobante = (v: unknown): v is ResultadoComprobante => RESULTADOS_COMPROBANTE.some((r) => r.id === v);

/** El prompt de la lectura. Pide transcribir, nunca convertir ni completar. */
export const PROMPT_COMPROBANTE =
  'Lee este COMPROBANTE DE PAGO (captura de transferencia, de Binance, de Mercado Pago, recibo o voucher). Devuelve SOLO JSON con esta forma exacta: '
  + '{"es_comprobante": boolean, "monto": number|null, "moneda": string|null, "fecha": "aaaa-mm-dd"|null, "hora": "HH:MM"|null, "medio": string|null, '
  + '"destinatario": string|null, "operacion": string|null, "dudas": string|null}. '
  + 'es_comprobante = false si la imagen no es un comprobante de un pago hecho. monto = el monto pagado TAL COMO FIGURA, en SU moneda (sólo el número, '
  + 'sin convertir). moneda = el código que figura (USD, USDT, MXN, ARS, COP…); «$» o «pesos» sin código NO son dólares: si no se ve el código, null. '
  + 'fecha y hora = las de la operación. medio = por dónde se pagó (Binance, Mercado Pago, transferencia del banco que figure…). destinatario = a quién '
  + 'se le pagó (nombre, alias, cuenta), como figura. operacion = el número de la operación, Order ID o referencia, tal como figura. dudas = una frase '
  + 'con lo que no se ve bien o no cuadra, o null. Si un dato no aparece, null. No inventes nada que no esté en el comprobante.';

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

/** La moneda como figura: 3 a 5 letras (USDT y USDC son monedas de verdad en un comprobante de Binance). */
export function monedaDelComprobante(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (s === 'US$' || s === 'U$S' || s === 'DÓLARES' || s === 'DOLARES') return 'USD';
  return /^[A-Z]{3,5}$/.test(s) ? s : null;
}

/** El N.º de operación comparable: sin espacios, guiones ni puntos, en mayúsculas. Vacío o de menos de 4 caracteres = null. */
export function operacionNormal(v: unknown): string | null {
  const s = typeof v === 'string' ? v.toUpperCase().replace(/[\s.\-_/]+/g, '') : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  return s.length >= 4 && s.length <= 120 ? s : null;
}

/** Lo que devolvió el modelo (ya parseado), saneado. Lo que no tiene la forma pedida queda null. */
export function lecturaDe(o: Record<string, unknown> | null): LecturaComprobante {
  const r = o ?? {};
  // Un número, o un texto que es SÓLO un número con punto decimal. «1.234,56» o «1,234.56» no se adivinan: quedan sin monto y
  // la lectura va a revisión (`dudoso`), nunca un 1,23 o un 123.456 inventado.
  const num = typeof r.monto === 'number' ? r.monto : typeof r.monto === 'string' && /^\d+(\.\d+)?$/.test(r.monto.trim()) ? Number(r.monto.trim()) : NaN;
  const fecha = typeof r.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha.trim()) ? r.fecha.trim() : null;
  const hora = typeof r.hora === 'string' && /^\d{1,2}:\d{2}$/.test(r.hora.trim()) ? r.hora.trim().padStart(5, '0') : null;
  return {
    esComprobante: r.es_comprobante !== false,
    monto: Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null,
    moneda: monedaDelComprobante(r.moneda),
    fecha,
    hora,
    medio: texto(r.medio, 60),
    destinatario: texto(r.destinatario, 160),
    operacion: texto(r.operacion, 120),
    dudas: texto(r.dudas, 300),
  };
}

/** El estado de la lectura: sólo es `leido` si trae todo lo que hace falta para contarlo y el modelo no tuvo dudas. */
export function estadoDeLectura(l: LecturaComprobante): EstadoLectura {
  if (!l.esComprobante || l.monto == null) return 'ilegible';
  if (l.dudas || !l.moneda || !l.fecha || !operacionNormal(l.operacion)) return 'dudoso';
  return 'leido';
}

/** ¿Cubre lo que tocaba pagar? Misma moneda; un centavo de redondeo no lo vuelve parcial; más del 1 % de más es `de_mas`. */
export function coberturaDe(l: LecturaComprobante, esperado: Esperado): Cobertura | null {
  if (l.monto == null) return null;
  if (!esperado) return 'sin_cuota';
  if (!l.moneda || l.moneda !== esperado.moneda.toUpperCase()) return 'otra_moneda';
  if (l.monto + 0.01 < esperado.monto) return 'parcial';
  if (l.monto > esperado.monto * 1.01 + 0.01) return 'de_mas';
  return 'total';
}

/**
 * Lo que contesta la condición, de lo guardado. `repetido` gana (el mismo N.º en otro comprobante del negocio). Sólo `cubre`
 * con una lectura `leido` y cobertura `total`: «de más» y «otra moneda» van a una persona como `dudoso`, y «sin cuota» también
 * (no hay contra qué decir que cubre).
 */
export function resultadoDe(c: { estado: EstadoLectura; cobertura: Cobertura | null; repetido: boolean; esComprobante?: boolean } | null): ResultadoComprobante {
  if (!c) return 'no_llego';
  if (c.esComprobante === false) return 'no_es';
  if (c.repetido) return 'repetido';
  if (c.estado !== 'leido') return 'dudoso';
  if (c.cobertura === 'parcial') return 'parcial';
  if (c.cobertura === 'total') return 'cubre';
  return 'dudoso';
}

/** Una línea para la persona que lo revisa (el aviso al equipo, la ficha). Sin datos del modelo que no se hayan saneado. */
export function resumenDeLectura(l: LecturaComprobante, r: ResultadoComprobante, esperado: Esperado): string {
  const monto = l.monto != null ? `${l.monto}${l.moneda ? ` ${l.moneda}` : ''}` : 'sin monto';
  const partes = [monto, l.medio, l.fecha ? `${l.fecha}${l.hora ? ` ${l.hora}` : ''}` : null, l.operacion ? `N.º ${l.operacion}` : null].filter(Boolean);
  const debia = esperado ? ` (debía ${esperado.monto} ${esperado.moneda})` : '';
  const rot = RESULTADOS_COMPROBANTE.find((x) => x.id === r)?.rotulo ?? r;
  return `${rot}: ${partes.join(', ')}${debia}.${l.dudas ? ` Ojo: ${l.dudas}` : ''}`;
}
