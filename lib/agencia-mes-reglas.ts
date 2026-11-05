// =============================================================================
// agencia-mes-reglas — la MENSUALIDAD de una agencia, en reglas puras (acuerdo con Código Inmobiliario, 30/10/2026)
// =============================================================================
// Lo que Martín acordó con la agencia (Juanfran y Joan, negocio 13) y les prometió automático:
//   · la agencia paga su plan (MaKo Pro, US$97) y cada cliente adentro paga el suyo (MaKo Esencial, US$47);
//   · desde que la agencia INVITA a un cliente (`agencia_clientes.created_at`) corren 14 días sin costo; después cuenta;
//   · si lo dan de baja antes de los 14 días, no se cobra;
//   · se paga UNA vez por mes, entre el 1 y el 5, POR FUERA de MaKo (Binance). MaKo no cobra: calcula y avisa.
//
// ⚠️ NO ES EL COBRO POR PASARELA DE lib/agencia-cobro-reglas.ts (el link de Mercado Pago del primer mes, la renovación
//    que corre desde el onboarding, Stripe en Europa). Ése sigue para las agencias que pagan con tarjeta; éste vale sólo
//    para la agencia que tiene la mensualidad PRENDIDA (lib/agencia-mes.ts). Son dos modelos y no comparten reglas.
//
// CÓMO SE ARMA EL MES (la decisión, porque el acuerdo no lo dice y alguien tiene que contestarlo):
//   1. Lo que se paga del 1 al 5 de un mes es ESE mes, por adelantado: el plan de la agencia y cada cliente que YA cuenta
//      el día 1 (sus 14 días terminaron y no está dado de baja).
//   2. Un cliente que empieza a contar a mitad de mes no estaba el día 1: sus días de ese mes (desde que cuenta hasta fin
//      de mes, o hasta su baja) se suman a la mensualidad del mes siguiente, por día (`COBRA_LOS_DIAS_DEL_PRIMER_MES`).
//      Sin eso, «después ese cliente cuenta» era mentira para todo el que se da de baja antes del día 1 siguiente: usaba
//      hasta un mes y medio sin pagar. Si Martín prefiere no cobrar esos días, es esa constante, en `false`.
//   3. Los días de un mes anterior al primero que se factura así (`primerMes`) no se cobran: no estaban en el acuerdo.
//   4. El plan de cada cliente sale del CATÁLOGO (lib/planes-mako.ts), nunca de un número escrito acá: el que la agencia
//      le eligió (Esencial o Pro, por su capa) y, si nunca se lo eligió (las cuentas de antes del 29/10, que tienen todo
//      lo de Pro sin elegir), Esencial: es lo que se acordó por cliente.
//
// «EL DÍA» ES EL DE LA AGENCIA: quien lee convierte `created_at` y la baja a la zona del negocio antes de llamar acá.
// Acá todo es 'YYYY-MM-DD' y se compara como texto (el orden del texto es el del calendario).
//
// Sin `server-only`: lo ejecutan los tests (tests/agencia-mes.test.ts).
// =============================================================================

import type { PlanCuenta } from './agencia-cobro-reglas';
import type { EstadoCartera } from './agencia-cartera';

/** Los días sin costo desde que se invita a un cliente. */
export const DIAS_SIN_COSTO = 14;
/** Se paga entre el 1 y este día de cada mes. */
export const DIA_LIMITE_DE_PAGO = 5;
/** Cuántos días antes de que termine el plazo de un cliente se le avisa a la agencia. */
export const DIAS_DE_AVISO = 2;
/** Los días del mes en que un cliente empezó a contar entran a la mensualidad siguiente (ver arriba, punto 2). */
export const COBRA_LOS_DIAS_DEL_PRIMER_MES = true;
/** Por dónde se paga, si la agencia no tiene otro medio anotado. */
export const MEDIO_POR_DEFECTO = 'Binance';

export type Dia = string;
export type Mes = string;

// ── Días y meses, sin zona: el día ya viene en la zona de la agencia ──────────────────────────────────────────────

const DIA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DIA_MS = 86_400_000;
const dos = (n: number) => String(n).padStart(2, '0');

/** Un día de calendario de verdad ('2026-02-30' no lo es). */
export function esDia(v: unknown): v is Dia {
  if (typeof v !== 'string') return false;
  const m = DIA_RE.exec(v);
  if (!m) return false;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10) === v;
}
export const esMes = (v: unknown): v is Mes => typeof v === 'string' && MES_RE.test(v);

const ms = (d: Dia) => Date.parse(`${d}T00:00:00Z`);
export const sumarDias = (d: Dia, n: number): Dia => new Date(ms(d) + n * DIA_MS).toISOString().slice(0, 10);
/** Cuántos días van de `a` a `b` (b − a). */
export const diasEntre = (a: Dia, b: Dia): number => Math.round((ms(b) - ms(a)) / DIA_MS);
export const mesDe = (d: Dia): Mes => d.slice(0, 7);
export const primerDia = (m: Mes): Dia => `${m}-01`;
export function diasDelMes(m: Mes): number {
  const [y, mm] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mm, 0)).getUTCDate();
}
export const ultimoDia = (m: Mes): Dia => `${m}-${dos(diasDelMes(m))}`;
export function mesAnterior(m: Mes): Mes {
  const [y, mm] = m.split('-').map(Number);
  return mm === 1 ? `${y - 1}-12` : `${y}-${dos(mm - 1)}`;
}
export function mesSiguiente(m: Mes): Mes {
  const [y, mm] = m.split('-').map(Number);
  return mm === 12 ? `${y + 1}-01` : `${y}-${dos(mm + 1)}`;
}
/** El último día para pagar el mes. */
export const diaLimite = (m: Mes): Dia => `${m}-${dos(DIA_LIMITE_DE_PAGO)}`;

/** Los meses de `desde` a `hasta`, los dos incluidos (vacío si `desde` es posterior). Tope de 60: cinco años. */
export function mesesEntre(desde: Mes, hasta: Mes): Mes[] {
  const out: Mes[] = [];
  for (let m = desde; m <= hasta && out.length < 60; m = mesSiguiente(m)) out.push(m);
  return out;
}

// ── Cada cliente: desde cuándo cuenta ─────────────────────────────────────────────────────────────────────────────

/** Un cliente de la cartera, ya leído y con sus días en la zona de la agencia. */
export type ClienteDeAgencia = {
  ws: number;
  nombre: string;
  estado: EstadoCartera;
  /** El día en que la agencia lo invitó (`agencia_clientes.created_at`). */
  invitado: Dia;
  /** La corrección del super admin (`agencia_clientes.cobra_desde`, mig 0394): el día desde el que corren sus 14 días. */
  corregido: Dia | null;
  /** El día en que se dio de baja (`decidido_at` de una fila revocada). */
  baja: Dia | null;
  /** El plan que se le cobra (`planQueSeCobra`). */
  plan: PlanCuenta;
};

/** El día desde el que corren sus 14 días: la corrección, si la hay; si no, la invitación. */
export const arrancaElReloj = (c: Pick<ClienteDeAgencia, 'invitado' | 'corregido'>): Dia => c.corregido ?? c.invitado;
/** El primer día que cuenta: el que sigue a sus 14 días sin costo. */
export const cuentaDesde = (c: Pick<ClienteDeAgencia, 'invitado' | 'corregido'>): Dia => sumarDias(arrancaElReloj(c), DIAS_SIN_COSTO);

/**
 * El día de la baja que vale, y sólo de una fila REVOCADA: pendiente y aprobada siguen en la cartera. Una revocada sin
 * fecha cuenta como dada de baja el día que arrancó su reloj (nunca contó): no se le cobra lo que no se puede fechar.
 */
function bajaDe(c: Pick<ClienteDeAgencia, 'estado' | 'baja' | 'invitado' | 'corregido'>): Dia | null {
  if (c.estado !== 'revocado') return null;
  return c.baja ?? arrancaElReloj(c);
}

/** ¿Cuenta ese día? Desde que terminan sus 14 días y hasta el día anterior a su baja. */
const cuentaElDia = (desde: Dia, baja: Dia | null, d: Dia): boolean => d >= desde && (baja == null || d < baja);

export type Situacion =
  /** Ya cuenta: sus 14 días terminaron. */
  | { tipo: 'cuenta'; desde: Dia }
  /** Está en sus 14 días: `hasta` es el primer día que cuenta, y faltan `faltan` días. */
  | { tipo: 'sin-costo'; hasta: Dia; faltan: number }
  /** Se dio de baja antes de que terminaran sus 14 días: no se cobra nunca. */
  | { tipo: 'baja-sin-costo'; baja: Dia }
  /** Contó y después se dio de baja. */
  | { tipo: 'baja'; desde: Dia; baja: Dia };

/** Dónde está un cliente HOY. */
export function situacion(c: ClienteDeAgencia, hoy: Dia): Situacion {
  const desde = cuentaDesde(c);
  const baja = bajaDe(c);
  // «Si lo dan de baja antes de los 14 días, no se cobra»: una baja el mismo día que empezaría a contar tampoco contó.
  if (baja != null && baja <= desde) return { tipo: 'baja-sin-costo', baja };
  if (baja != null && baja <= hoy) return { tipo: 'baja', desde, baja };
  if (hoy < desde) return { tipo: 'sin-costo', hasta: desde, faltan: diasEntre(hoy, desde) };
  return { tipo: 'cuenta', desde };
}

/**
 * El plan que se le cobra a un cliente: el que la agencia le eligió (su capa: Esencial o Pro) y, si nunca se lo eligió,
 * Esencial (el acuerdo es US$47 por cliente, aunque las cuentas de antes del 29/10 tengan todo lo de Pro).
 */
export const planQueSeCobra = (p: { elegido: boolean; capa: string | null | undefined }): PlanCuenta =>
  p.elegido && p.capa === 'agencia' ? 'pro' : 'esencial';

// ── La mensualidad de un mes ──────────────────────────────────────────────────────────────────────────────────────

export type Precios = Readonly<Record<PlanCuenta, number>>;

/** Los precios de Esencial y Pro del catálogo de planes. null = el catálogo no tiene alguno de los dos. */
export function preciosDelCatalogo(planes: readonly { id: string; precioUsd: number }[]): Precios | null {
  const de = (id: PlanCuenta) => planes.find((p) => p.id === id)?.precioUsd;
  const esencial = de('esencial');
  const pro = de('pro');
  return typeof esencial === 'number' && esencial > 0 && typeof pro === 'number' && pro > 0 ? { esencial, pro } : null;
}

export type LineaDelMes =
  /** El plan de la agencia. */
  | { tipo: 'agencia'; plan: PlanCuenta; montoUsd: number }
  /** Un cliente que cuenta el día 1: el mes entero. */
  | { tipo: 'mes'; ws: number; nombre: string; plan: PlanCuenta; montoUsd: number; desde: Dia }
  /** Los días del mes anterior en que un cliente empezó a contar (no estaba el día 1 de ese mes). */
  | { tipo: 'dias'; ws: number; nombre: string; plan: PlanCuenta; montoUsd: number; desde: Dia; hasta: Dia; dias: number; diasDelMes: number };

export type CuentaDelMes = {
  mes: Mes;
  /** El último día para pagarlo. */
  limite: Dia;
  lineas: LineaDelMes[];
  totalUsd: number;
};

const redondo = (n: number) => Math.round(n * 100) / 100;

/**
 * La mensualidad de `mes`: el plan de la agencia, cada cliente que cuenta el día 1, y los días del mes anterior de los
 * que empezaron a contar a mitad de ese mes. null si `mes` es anterior al primero que se factura así.
 */
export function cuentaDelMes(p: {
  mes: Mes;
  primerMes: Mes;
  planAgencia: PlanCuenta;
  clientes: readonly ClienteDeAgencia[];
  precios: Precios;
}): CuentaDelMes | null {
  if (!esMes(p.mes) || !esMes(p.primerMes) || p.mes < p.primerMes) return null;
  const dia1 = primerDia(p.mes);
  const anterior = mesAnterior(p.mes);
  const cobraAnterior = COBRA_LOS_DIAS_DEL_PRIMER_MES && anterior >= p.primerMes;
  const lineas: LineaDelMes[] = [{ tipo: 'agencia', plan: p.planAgencia, montoUsd: p.precios[p.planAgencia] }];
  const clientes = [...p.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.ws - b.ws);
  for (const c of clientes) {
    const desde = cuentaDesde(c);
    const baja = bajaDe(c);
    if (baja != null && baja <= desde) continue;
    const precio = p.precios[c.plan];
    if (cuentaElDia(desde, baja, dia1)) lineas.push({ tipo: 'mes', ws: c.ws, nombre: c.nombre, plan: c.plan, montoUsd: precio, desde });
    // Empezó a contar a mitad del mes anterior: no estaba en esa mensualidad (que se armó el día 1), entran sus días.
    if (cobraAnterior && mesDe(desde) === anterior && desde > primerDia(anterior)) {
      const fin = baja != null && baja <= ultimoDia(anterior) ? sumarDias(baja, -1) : ultimoDia(anterior);
      if (fin >= desde) {
        const dias = diasEntre(desde, fin) + 1;
        const total = diasDelMes(anterior);
        lineas.push({ tipo: 'dias', ws: c.ws, nombre: c.nombre, plan: c.plan, montoUsd: redondo((precio * dias) / total), desde, hasta: fin, dias, diasDelMes: total });
      }
    }
  }
  return { mes: p.mes, limite: diaLimite(p.mes), lineas, totalUsd: redondo(lineas.reduce((a, l) => a + l.montoUsd, 0)) };
}

/** Cuántos clientes entran a la mensualidad (una persona con su mes y sus días del mes anterior cuenta una vez). */
export const clientesEnLaCuenta = (c: CuentaDelMes): number =>
  new Set(c.lineas.filter((l) => l.tipo !== 'agencia').map((l) => (l as { ws: number }).ws)).size;

// ── Cuándo se avisa ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * El mes cuya mensualidad se avisa hoy, o null. El aviso es «el día 1», pero el cron prueba del 1 al 5: si el del día 1
 * no salió (el cron no corrió, se cayó el correo), sale al día siguiente. Que no se repita lo cuida quien lo manda.
 */
export function mesQueSeAvisa(hoy: Dia, primerMes: Mes): Mes | null {
  if (!esDia(hoy) || !esMes(primerMes)) return null;
  const m = mesDe(hoy);
  const d = Number(hoy.slice(8, 10));
  return m >= primerMes && d >= 1 && d <= DIA_LIMITE_DE_PAGO ? m : null;
}

/** Los clientes a los que les quedan de 1 a 2 días sin costo: se le avisa a la agencia, para que lo dé de baja si no le pagó. */
export function plazosPorVencer(clientes: readonly ClienteDeAgencia[], hoy: Dia): Array<{ ws: number; nombre: string; plan: PlanCuenta; desde: Dia; faltan: number }> {
  const out: Array<{ ws: number; nombre: string; plan: PlanCuenta; desde: Dia; faltan: number }> = [];
  for (const c of clientes) {
    if (c.estado === 'revocado') continue;
    const s = situacion(c, hoy);
    if (s.tipo === 'sin-costo' && s.faltan >= 1 && s.faltan <= DIAS_DE_AVISO) out.push({ ws: c.ws, nombre: c.nombre, plan: c.plan, desde: s.hasta, faltan: s.faltan });
  }
  return out;
}

// ── Lo guardado: si está prendida, y qué mes se pagó ──────────────────────────────────────────────────────────────

export type ConfigMensualidad = { desde: Mes; medio: string; prendidaPor: string | null; prendidaAt: string | null };

const texto = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, max) : null);
const objeto = (raw: unknown): Record<string, unknown> | null => {
  let o: unknown = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
};

/** La mensualidad prendida de una agencia (lo guardado), o null si está apagada o no se entiende. */
export function leerConfigMensualidad(raw: unknown): ConfigMensualidad | null {
  const o = objeto(raw);
  if (!o || !esMes(o.desde)) return null;
  return { desde: o.desde, medio: texto(o.medio, 40) ?? MEDIO_POR_DEFECTO, prendidaPor: texto(o.prendidaPor, 120), prendidaAt: texto(o.prendidaAt, 40) };
}

export type PagoDelMes = { mes: Mes; pagadoEl: Dia; totalUsd: number; marcadoPor: string | null; marcadoAt: string | null };

/** Un mes marcado «Pagado» (lo guardado), o null. Lleva el total que se pagó: lo que se corrija después no lo cambia. */
export function leerPagoDelMes(raw: unknown): PagoDelMes | null {
  const o = objeto(raw);
  if (!o || !esMes(o.mes) || !esDia(o.pagadoEl)) return null;
  const total = typeof o.totalUsd === 'number' && Number.isFinite(o.totalUsd) && o.totalUsd >= 0 ? redondo(o.totalUsd) : null;
  if (total == null) return null;
  return { mes: o.mes, pagadoEl: o.pagadoEl, totalUsd: total, marcadoPor: texto(o.marcadoPor, 120), marcadoAt: texto(o.marcadoAt, 40) };
}

// ── Cómo se dice (los avisos y la pantalla) ───────────────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreDelMes = (m: Mes): string => MESES[Number(m.slice(5, 7)) - 1] ?? m;
/** '2026-11-11' → '11/11'. */
export const diaCorto = (d: Dia): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
/** '2026-11-04' → '4 de noviembre'. */
export const diaLargo = (d: Dia): string => `${Number(d.slice(8, 10))} de ${nombreDelMes(mesDe(d))}`;

/** US$ 285 · US$ 42,30 · US$ 1.250 (sin depender del Intl del servidor). */
export function usd(n: number): string {
  const r = redondo(n);
  const [ent, dec] = Math.abs(r).toFixed(2).split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${r < 0 ? '−' : ''}US$ ${miles}${dec === '00' ? '' : `,${dec}`}`;
}

export const NOMBRE_PLAN: Readonly<Record<PlanCuenta, string>> = { esencial: 'MaKo Esencial', pro: 'MaKo Pro' };

/** Qué es una línea de la mensualidad, sin el monto (la pantalla lo pone en su columna). */
export function conceptoDeLinea(l: LineaDelMes): string {
  if (l.tipo === 'agencia') return `Tu plan ${NOMBRE_PLAN[l.plan]}`;
  if (l.tipo === 'mes') return `${l.nombre} · ${NOMBRE_PLAN[l.plan]}`;
  // Los días son siempre de UN mes (el anterior): «del 4 al 30 de noviembre».
  const rango = mesDe(l.desde) === mesDe(l.hasta) ? `del ${Number(l.desde.slice(8, 10))} al ${diaLargo(l.hasta)}` : `del ${diaLargo(l.desde)} al ${diaLargo(l.hasta)}`;
  return `${l.nombre} · ${rango} (${l.dias} ${l.dias === 1 ? 'día' : 'días'})`;
}

/** El renglón de una línea, con su monto (el correo). */
export const renglonDeLinea = (l: LineaDelMes): string => `${conceptoDeLinea(l)}: ${usd(l.montoUsd)}`;

export type Correo = { asunto: string; preheader: string; cuerpo: string; titulo: string; resumen: string };

/** El aviso del mes: el total, cada línea y quién todavía no cuenta. Español neutro, de tú. */
export function avisoDelMes(p: {
  agencia: string;
  cuenta: CuentaDelMes;
  medio: string;
  sinCosto: ReadonlyArray<{ nombre: string; hasta: Dia }>;
  link: string;
}): Correo {
  const mes = nombreDelMes(p.cuenta.mes);
  const total = usd(p.cuenta.totalUsd);
  const lineas = p.cuenta.lineas.map((l) => `- ${renglonDeLinea(l)}`);
  const espera = p.sinCosto.length
    ? ['', `Todavía sin costo: ${p.sinCosto.map((c) => `${c.nombre} hasta el ${diaCorto(c.hasta)}`).join(', ')}.`]
    : [];
  const resumen = `${total}. Págala entre el 1 y el ${DIA_LIMITE_DE_PAGO} de ${mes}, por ${p.medio}.`;
  return {
    titulo: `Tu mensualidad de ${mes}: ${total}`,
    resumen,
    asunto: `Tu mensualidad de MaKo de ${mes}: ${total}`,
    preheader: `Págala entre el 1 y el ${DIA_LIMITE_DE_PAGO} de ${mes}.`,
    cuerpo: [
      'Hola,',
      '',
      `La mensualidad de ${p.agencia} en MaKo para ${mes} es de ${total}.`,
      `Se paga una vez, entre el 1 y el ${DIA_LIMITE_DE_PAGO} de ${mes}, por ${p.medio}.`,
      '',
      ...lineas,
      ...espera,
      '',
      'El detalle está en tu Agency Dashboard:',
      p.link,
    ].join('\n'),
  };
}

/** El aviso de que un cliente empieza a contar: para que lo den de baja antes si no les pagó. */
export function avisoDePlazo(p: { nombre: string; desde: Dia; plan: PlanCuenta; precioUsd: number; link: string }): Correo {
  const dia = diaCorto(p.desde);
  return {
    titulo: `${p.nombre} empieza a contar el ${dia}`,
    resumen: `Desde el ${dia} entra a tu mensualidad (${usd(p.precioUsd)} al mes). Si no te pagó, dalo de baja antes.`,
    asunto: `${p.nombre} empieza a contar en tu mensualidad el ${dia}`,
    preheader: 'Si no te pagó, dalo de baja antes de ese día.',
    cuerpo: [
      'Hola,',
      '',
      `El ${diaLargo(p.desde)} terminan los ${DIAS_SIN_COSTO} días sin costo de ${p.nombre}.`,
      `Desde ese día entra a tu mensualidad de MaKo: ${NOMBRE_PLAN[p.plan]}, ${usd(p.precioUsd)} al mes.`,
      '',
      'Si no te pagó, dalo de baja antes de ese día y no se cobra. Lo haces desde su cuenta en tu Agency Dashboard:',
      p.link,
    ].join('\n'),
  };
}

/** Lo que dice la fila de un cliente en la pantalla: si cuenta, hasta cuándo está sin costo, o su baja. */
export function textoDeSituacion(s: Situacion): { texto: string; tono: 'good' | 'warn' | null } {
  if (s.tipo === 'cuenta') return { texto: `Cuenta desde el ${diaCorto(s.desde)}`, tono: 'good' };
  if (s.tipo === 'sin-costo') return { texto: `Sin costo hasta el ${diaCorto(s.hasta)}`, tono: s.faltan <= DIAS_DE_AVISO ? 'warn' : null };
  if (s.tipo === 'baja') return { texto: `Contó del ${diaCorto(s.desde)} al ${diaCorto(sumarDias(s.baja, -1))}`, tono: null };
  return { texto: 'De baja sin costo', tono: null };
}
