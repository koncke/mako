// =============================================================================
// agencia-mes-reglas — la MENSUALIDAD de una agencia, en reglas puras (Martín, 5/11/2026, sobre el acuerdo del 30/10)
// =============================================================================
// Lo que se cobra (Código Inmobiliario, negocio 13, Juanfran y Joan; sirve para cualquier agencia con esta modalidad):
//   · la agencia paga su plan (MaKo Pro, US$97) y cada cliente adentro paga el suyo (MaKo Esencial, US$47), del catálogo;
//   · desde que la agencia INVITA a un cliente (`agencia_clientes.created_at`, o la corrección `cobra_desde`) corren 14 días
//     sin costo; si lo dan de baja antes, no se cobra;
//   · se paga UNA vez por mes, del 1 al 5, por Binance: MaKo avisa por el grupo de WhatsApp con la agencia (un PDF con la
//     tabla, renglón por renglón), lee el comprobante que mandan ahí, lo anota y saca el recibo.
//
// LAS REGLAS DE MARTÍN DEL 5/11/2026 (ganan sobre el acuerdo del 30/10, que esta punta reemplaza):
//   1. EL CICLO VA DEL 5 AL 5. Lo que se paga del 1 al 5 de un mes cubre del 5 de ese mes al 5 del siguiente (sin contar ese
//      5). Está en la mensualidad de un mes quien entró ANTES de su día 5.
//   2. EL DIFERENCIAL (la «entrada»), IGUAL PARA TODOS: cada cliente paga sus días desde que empieza —el fin de sus 14 días,
//      o el día que entra si estaba en pausa— hasta el próximo 5, sin contar ese 5. Tarifa: US$47 ÷ los días del ciclo en el
//      que cae (30 del 5/11 al 5/12). La fecha límite es ese mismo día. Pablo, que entra el 9/11: 26 días, US$40,73.
//      Reemplaza a `COBRA_LOS_DIAS_DEL_PRIMER_MES` (sumaba esos días a la mensualidad siguiente: daba otros números).
//   3. SUSPENSIÓN SOLA: la cuenta de un cliente que pasa su día sin pagar la entrada queda en «Paga para entrar»; el día 6 sin
//      el total del mes, la agencia y todos sus clientes. Pagado, entra solo. ⚠️ Un error de la base o de una lectura NUNCA
//      suspende: esto decide con lo que se LEYÓ (lib/agencia-mes.ts lee estricto y, si algo falla, no corre).
//   4. Siempre en tabla y en PDF, por el grupo de WhatsApp con la agencia. Nunca a los clientes de la agencia.
//
// LOS QUE YA ESTABAN («de antes»): la mensualidad se prende con un día (`entradasDesde`). Un cliente cuyos 14 días terminaron
// antes de ese día y que no está en «Paga para entrar» ya entró a mano (noviembre se cobró a mano: Brigitte, Natalia y Sergio),
// y no paga entrada. Los que estaban suspendidos a mano (Pablo, Patricia) pasan a «Paga para entrar» con el script
// scripts/agencia-paga-para-entrar.mts, y su entrada se calcula desde el día que pagan.
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
/** El ciclo de la mensualidad arranca este día de cada mes (y se paga del 1 a este día). */
export const DIA_DEL_CICLO = 5;
/** Se paga entre el 1 y este día de cada mes: el mismo 5 en el que arranca el ciclo. */
export const DIA_LIMITE_DE_PAGO = DIA_DEL_CICLO;
/** Cuántos días antes de que termine el plazo de un cliente se le avisa a la agencia (con el PDF de su entrada). */
export const DIAS_DE_AVISO = 2;
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
const diaDelMes = (d: Dia): number => Number(d.slice(8, 10));
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
/** El último día para pagar el mes (el 5). Desde el día siguiente, sin el total, se suspende. */
export const diaLimite = (m: Mes): Dia => `${m}-${dos(DIA_LIMITE_DE_PAGO)}`;

/** Los meses de `desde` a `hasta`, los dos incluidos (vacío si `desde` es posterior). Tope de 60: cinco años. */
export function mesesEntre(desde: Mes, hasta: Mes): Mes[] {
  const out: Mes[] = [];
  for (let m = desde; m <= hasta && out.length < 60; m = mesSiguiente(m)) out.push(m);
  return out;
}

// ── El ciclo del 5 al 5 y el diferencial ──────────────────────────────────────────────────────────────────────────

/** El día en que arranca el ciclo del mes `m` (su 5). */
export const inicioDelCiclo = (m: Mes): Dia => `${m}-${dos(DIA_DEL_CICLO)}`;
/** El ciclo en el que cae un día: del 5 de ese mes (si ya pasó el 5) o del 5 del mes anterior. */
export const cicloDe = (d: Dia): Mes => (diaDelMes(d) >= DIA_DEL_CICLO ? mesDe(d) : mesAnterior(mesDe(d)));
/** Los días del ciclo de `m`: del 5 de `m` al 5 del mes siguiente (30 del 5/11 al 5/12, 31 del 5/12 al 5/1). */
export const diasDelCiclo = (m: Mes): number => diasEntre(inicioDelCiclo(m), inicioDelCiclo(mesSiguiente(m)));
/** El próximo 5 DESPUÉS de `d` (ese 5 no se cuenta: lo cubre la mensualidad). Del 5/12 al 5/1; del 9/11 al 5/12. */
export const proximoCinco = (d: Dia): Dia => inicioDelCiclo(mesSiguiente(cicloDe(d)));

/** El diferencial de un cliente que empieza `desde`: sus días hasta el próximo 5, a la tarifa del ciclo en el que cae. */
export type Diferencial = {
  desde: Dia;
  /** El último día que cubre (el día antes del próximo 5). */
  hasta: Dia;
  dias: number;
  ciclo: Mes;
  diasDelCiclo: number;
  /** El precio de un día (US$47 ÷ días del ciclo), con 4 decimales: es lo que se muestra. */
  tarifaUsd: number;
  montoUsd: number;
  /** Se paga hasta ese mismo día. */
  limite: Dia;
};

const redondo = (n: number) => Math.round(n * 100) / 100;
const redondo4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** El diferencial (la entrada) de un cliente que empieza `desde`, con el precio de su plan. */
export function diferencialDe(desde: Dia, precioUsd: number): Diferencial {
  const ciclo = cicloDe(desde);
  const total = diasDelCiclo(ciclo);
  const fin = proximoCinco(desde);
  const dias = diasEntre(desde, fin);
  return {
    desde, hasta: sumarDias(fin, -1), dias, ciclo, diasDelCiclo: total,
    tarifaUsd: redondo4(precioUsd / total), montoUsd: redondo((precioUsd * dias) / total), limite: desde,
  };
}

// ── Cada cliente: desde cuándo cuenta y en qué está ──────────────────────────────────────────────────────────────

/** La entrada que un cliente ya pagó (del libro): desde qué día cuenta. */
export type EntradaPagada = { desde: Dia; pagadoEl: Dia; montoUsd: number };

/** Un cliente de la cartera, ya leído y con sus días en la zona de la agencia. */
export type ClienteDeAgencia = {
  ws: number;
  nombre: string;
  estado: EstadoCartera;
  /** El día en que la agencia lo invitó (`agencia_clientes.created_at`). */
  invitado: Dia;
  /** La corrección del super admin (`agencia_clientes.cobra_desde`, mig 0402): el día desde el que corren sus 14 días. */
  corregido: Dia | null;
  /** El día en que se dio de baja (`decidido_at` de una fila revocada). */
  baja: Dia | null;
  /** El plan que se le cobra (`planQueSeCobra`). */
  plan: PlanCuenta;
  /** La entrada que ya pagó (el diferencial completo), o null. */
  entrada?: EntradaPagada | null;
  /** Está en «Paga para entrar» por SU entrada (el corte de MaKo con la causa `entrada`). */
  fueraPorEntrada?: boolean;
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

/** ¿Entró a mano, antes de que se prendiera la mensualidad? (sus 14 días terminaron antes y no está en pausa) */
export const esDeAntes = (c: ClienteDeAgencia, entradasDesde: Dia): boolean => !c.fueraPorEntrada && !c.entrada && cuentaDesde(c) < entradasDesde;

export type Situacion =
  /** Ya está adentro: pagó su entrada, o entró a mano antes de que se prendiera la mensualidad. */
  | { tipo: 'cuenta'; desde: Dia }
  /** Está en sus 14 días: `hasta` es el primer día que cuenta. `entrada` = lo que paga ese día (null si ya la pagó). */
  | { tipo: 'sin-costo'; hasta: Dia; faltan: number; entrada: Diferencial | null }
  /** Terminaron sus 14 días y no pagó la entrada: vence `limite` (hoy, o ya venció y todavía no se pausó). */
  | { tipo: 'debe-entrada'; limite: Dia; vencida: boolean; entrada: Diferencial }
  /** En «Paga para entrar»: no pagó su entrada. `entrada` = lo que paga si entra hoy (baja cada día). */
  | { tipo: 'paga-para-entrar'; vencio: Dia; entrada: Diferencial }
  /** Se dio de baja sin haber entrado: no se cobra nunca. */
  | { tipo: 'baja-sin-costo'; baja: Dia }
  /** Contó y después se dio de baja. */
  | { tipo: 'baja'; desde: Dia; baja: Dia };

/** Dónde está un cliente HOY. `entradasDesde`: el día en que se prendió la mensualidad (antes de eso, se entró a mano). */
export function situacion(c: ClienteDeAgencia, hoy: Dia, entradasDesde: Dia, precioUsd: number): Situacion {
  const d = cuentaDesde(c);
  const baja = bajaDe(c);
  const deAntes = esDeAntes(c, entradasDesde);
  const desde = c.entrada?.desde ?? d;
  if (baja != null) {
    // «Si lo dan de baja antes de los 14 días, no se cobra»: una baja el mismo día que empezaría a contar tampoco. Y quien
    // nunca entró (no pagó su entrada) no se cobra aunque la baja sea después.
    if (baja <= desde || (!c.entrada && !deAntes && (c.fueraPorEntrada || baja <= d))) return { tipo: 'baja-sin-costo', baja };
    if (baja <= hoy) return (c.entrada || deAntes) ? { tipo: 'baja', desde, baja } : { tipo: 'baja-sin-costo', baja };
  }
  if (c.entrada) {
    return hoy < c.entrada.desde ? { tipo: 'sin-costo', hasta: c.entrada.desde, faltan: diasEntre(hoy, c.entrada.desde), entrada: null } : { tipo: 'cuenta', desde: c.entrada.desde };
  }
  if (deAntes) return { tipo: 'cuenta', desde: d };
  if (c.fueraPorEntrada) return { tipo: 'paga-para-entrar', vencio: d, entrada: diferencialDe(hoy, precioUsd) };
  if (hoy < d) return { tipo: 'sin-costo', hasta: d, faltan: diasEntre(hoy, d), entrada: diferencialDe(d, precioUsd) };
  return { tipo: 'debe-entrada', limite: d, vencida: hoy > d, entrada: diferencialDe(hoy > d ? hoy : d, precioUsd) };
}

/**
 * El plan que se le cobra a un cliente: el que la agencia le eligió (su capa: Esencial o Pro) y, si nunca se lo eligió,
 * Esencial (el acuerdo es US$47 por cliente, aunque las cuentas de antes del 29/10 tengan todo lo de Pro).
 */
export const planQueSeCobra = (p: { elegido: boolean; capa: string | null | undefined }): PlanCuenta =>
  p.elegido && p.capa === 'agencia' ? 'pro' : 'esencial';

// ── La mensualidad de un mes (el ciclo del 5 al 5) ───────────────────────────────────────────────────────────────

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
  /** Un cliente que está adentro el día 5: el ciclo entero. */
  | { tipo: 'mes'; ws: number; nombre: string; plan: PlanCuenta; montoUsd: number; desde: Dia };

export type CuentaDelMes = {
  mes: Mes;
  /** El último día para pagarlo. */
  limite: Dia;
  lineas: LineaDelMes[];
  totalUsd: number;
};

/**
 * ¿Está en la mensualidad de `mes`? Entró antes de su día 5 (pagó su entrada con ese día, o es de antes) y no se dio de
 * baja antes de ese 5. Quien todavía no entró cuenta si su día cae antes del 5 y todavía está a tiempo (no venció): si no
 * paga, se pausa y el total se rehace sin él. Quien está en «Paga para entrar», no.
 */
function entraEnElMes(c: ClienteDeAgencia, mes: Mes, hoy: Dia, entradasDesde: Dia): Dia | null {
  const inicio = inicioDelCiclo(mes);
  const baja = bajaDe(c);
  const d = cuentaDesde(c);
  let desde: Dia | null;
  if (c.entrada) desde = c.entrada.desde;
  else if (esDeAntes(c, entradasDesde)) desde = d;
  else if (c.fueraPorEntrada) desde = null;
  else desde = d >= hoy ? d : null; // todavía a tiempo de pagar su entrada; vencida, queda afuera hasta que pague
  if (desde == null || desde >= inicio) return null;
  if (baja != null && (baja <= inicio || baja <= desde)) return null;
  return desde;
}

/**
 * La mensualidad de `mes` (lo que se paga del 1 al 5 y cubre del 5 de `mes` al 5 del siguiente): el plan de la agencia y
 * cada cliente que está adentro el día 5. null si `mes` es anterior al primero que se factura así.
 */
export function cuentaDelMes(p: {
  mes: Mes;
  primerMes: Mes;
  planAgencia: PlanCuenta;
  clientes: readonly ClienteDeAgencia[];
  precios: Precios;
  hoy: Dia;
  entradasDesde: Dia;
}): CuentaDelMes | null {
  if (!esMes(p.mes) || !esMes(p.primerMes) || p.mes < p.primerMes) return null;
  const lineas: LineaDelMes[] = [{ tipo: 'agencia', plan: p.planAgencia, montoUsd: p.precios[p.planAgencia] }];
  const clientes = [...p.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.ws - b.ws);
  for (const c of clientes) {
    const desde = entraEnElMes(c, p.mes, p.hoy, p.entradasDesde);
    if (desde != null) lineas.push({ tipo: 'mes', ws: c.ws, nombre: c.nombre, plan: c.plan, montoUsd: p.precios[c.plan], desde });
  }
  return { mes: p.mes, limite: diaLimite(p.mes), lineas, totalUsd: redondo(lineas.reduce((a, l) => a + l.montoUsd, 0)) };
}

/** Cuántos clientes entran a la mensualidad. */
export const clientesEnLaCuenta = (c: CuentaDelMes): number => c.lineas.filter((l) => l.tipo !== 'agencia').length;

// ── Cuándo se avisa ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * El mes cuya mensualidad se avisa hoy, o null. El aviso sale el día 1, pero se prueba del 1 al 5: si el del día 1 no
 * salió (el cron no corrió, no había grupo), sale al día siguiente. Que no se repita lo cuida quien lo manda.
 */
export function mesQueSeAvisa(hoy: Dia, primerMes: Mes): Mes | null {
  if (!esDia(hoy) || !esMes(primerMes)) return null;
  const m = mesDe(hoy);
  const d = diaDelMes(hoy);
  return m >= primerMes && d >= 1 && d <= DIA_LIMITE_DE_PAGO ? m : null;
}

/**
 * Las entradas que se avisan hoy: a quien le quedan 1 o 2 días sin costo, y a quien vence hoy (si el de antes no salió).
 * Una vez por cliente y por día límite: lo cuida quien lo manda.
 */
export function entradasPorAvisar(clientes: readonly ClienteDeAgencia[], hoy: Dia, entradasDesde: Dia, precios: Precios): Array<{ ws: number; nombre: string; plan: PlanCuenta; entrada: Diferencial }> {
  const out: Array<{ ws: number; nombre: string; plan: PlanCuenta; entrada: Diferencial }> = [];
  for (const c of clientes) {
    if (c.estado === 'revocado') continue;
    const s = situacion(c, hoy, entradasDesde, precios[c.plan]);
    if (s.tipo === 'sin-costo' && s.entrada && s.faltan <= DIAS_DE_AVISO) out.push({ ws: c.ws, nombre: c.nombre, plan: c.plan, entrada: s.entrada });
    if (s.tipo === 'debe-entrada' && !s.vencida) out.push({ ws: c.ws, nombre: c.nombre, plan: c.plan, entrada: s.entrada });
  }
  return out;
}

// ── Lo que se debe hoy, y a qué se aplica un pago ────────────────────────────────────────────────────────────────

/** Algo que la agencia debe hoy: un mes, o la entrada de un cliente. `pagadoUsd` = lo que ya entró a cuenta de esto. */
export type Pendiente =
  | { tipo: 'mes'; mes: Mes; totalUsd: number; pagadoUsd: number; debeUsd: number; limite: Dia }
  | { tipo: 'entrada'; ws: number; nombre: string; plan: PlanCuenta; entrada: Diferencial; pagadoUsd: number; debeUsd: number; limite: Dia };

/** La clave de un pendiente: `mes:2026-12` o `entrada:<cliente>`. Es la que se guarda en cada abono. */
export const clavePendiente = (p: Pendiente): string => (p.tipo === 'mes' ? `mes:${p.mes}` : `entrada:${p.ws}`);

/** Un dólar en un comprobante: USD, USDT o USDC (Binance paga en USDT). Otra moneda no se convierte: va a una persona. */
export const esDolar = (moneda: string | null | undefined): boolean => !!moneda && /^(USD|USDT|USDC)$/i.test(moneda.trim());

/**
 * LO PRIMERO QUE SE DECIDE DE UN COMPROBANTE DEL GRUPO, y en qué orden. ⚠️ LA ORDEN REPETIDA VA ANTES QUE LAS DUDAS (ticket #80,
 * 10/11/2026): el 9/11 el comprobante de la entrada de Patricia (40 USDT por US$40,73) fue a Martín por la duda del monto, y Martín
 * la marcó a mano. El 10/11 llegó el MISMO pago en PDF: como las dudas se miraban antes que la orden, volvió a Martín («para
 * revisar», por segunda vez) y al grupo de la agencia le dijo «lo revisa el equipo» sobre algo ya resuelto. Una orden de Binance que
 * ya se leyó o se usó no se revisa otra vez, tenga las dudas que tenga.
 * `ordenYaUsada`: true si está en un recibo, en el libro o en una lectura anterior del grupo; undefined = no se pudo saber.
 */
export type VeredictoDeLectura = { tipo: 'repetido' } | { tipo: 'revisar'; porque: string } | { tipo: 'seguir'; orden: string };
export function veredictoDeLectura(o: { limpia: boolean; dudas: string | null | undefined; moneda: string | null | undefined; orden: string | null; ordenYaUsada: boolean | undefined }): VeredictoDeLectura {
  if (o.orden && o.ordenYaUsada === true) return { tipo: 'repetido' };
  if (!o.limpia) return { tipo: 'revisar', porque: o.dudas ? `la lectura tiene dudas: ${o.dudas}` : 'faltan datos en la lectura' };
  if (!esDolar(o.moneda)) return { tipo: 'revisar', porque: `en ${o.moneda ?? 'otra moneda'}: no se convierte` };
  if (!o.orden) return { tipo: 'revisar', porque: 'la orden no es de Binance (18 dígitos)' };
  if (o.ordenYaUsada === undefined) return { tipo: 'revisar', porque: 'no pude saber si la orden ya se usó' };
  return { tipo: 'seguir', orden: o.orden };
}

/** ¿`pagado` cubre `debe`? Un centavo de redondeo no lo vuelve parcial (la regla de lib/comprobante-reglas.ts). */
export const cubre = (pagado: number, debe: number): boolean => pagado + 0.01 >= debe;
/** ¿`pagado` es «de más» contra `debe`? Más del 1 %. */
const deMas = (pagado: number, debe: number): boolean => pagado > debe * 1.01 + 0.01;

export type Asignacion =
  /** Cubre exactamente esos pendientes (uno, varios o todos). */
  | { tipo: 'cubre'; claves: string[]; aplicado: Array<{ clave: string; montoUsd: number }> }
  /** Menos de lo que se debe: completa lo que alcanza en orden y deja el resto a cuenta del siguiente. */
  | { tipo: 'parcial'; aplicado: Array<{ clave: string; montoUsd: number }>; cubiertas: string[]; faltaUsd: number }
  /** Más de lo que se debe, o no se debe nada: lo decide una persona. */
  | { tipo: 'de-mas'; debeUsd: number }
  /** Cubre exacto MÁS DE UNA cosa distinta (dos entradas del mismo día cuestan lo mismo): el comprobante no dice de quién es. */
  | { tipo: 'ambiguo'; opciones: string[][] }
  | { tipo: 'nada-pendiente' };

/**
 * A QUÉ SE APLICA UN PAGO de `montoUsd`, sobre los pendientes ya en su orden (lo vencido primero). Primero busca lo que cubre
 * EXACTO —todo, un pendiente, o una combinación—: un pago de US$37,60 es la entrada de Giselle aunque Pablo deba desde antes.
 * Si no hay, y es menos de lo que se debe, completa en orden y lo que sobra queda a cuenta del siguiente («un pago parcial no
 * frena nada»: se anota, y lo que falta sigue pendiente). Si es de más, no decide: va a una persona.
 */
export function asignarPago(montoUsd: number, pendientes: readonly Pendiente[]): Asignacion {
  const lista = pendientes.filter((p) => p.debeUsd > 0.01);
  if (!lista.length) return { tipo: 'nada-pendiente' };
  const total = redondo(lista.reduce((a, p) => a + p.debeUsd, 0));
  const exacto = (suma: number) => cubre(montoUsd, suma) && !deMas(montoUsd, suma);
  const conjunto = (ps: readonly Pendiente[]): Asignacion => ({ tipo: 'cubre', claves: ps.map(clavePendiente), aplicado: ps.map((p) => ({ clave: clavePendiente(p), montoUsd: p.debeUsd })) });
  if (exacto(total)) return conjunto(lista);
  // Uno solo; después las combinaciones, las más chicas primero. Si a un tamaño le calzan DOS conjuntos distintos (Pablo y
  // Patricia entran el mismo día y cuestan lo mismo), no se elige: el comprobante no dice de quién es, y eso va a una persona.
  const unoSolo = lista.filter((p) => exacto(p.debeUsd));
  if (unoSolo.length > 1) return { tipo: 'ambiguo', opciones: unoSolo.map((p) => [clavePendiente(p)]) };
  if (unoSolo.length === 1) return conjunto(unoSolo);
  const n = Math.min(lista.length, 12);
  for (let tam = 2; tam < n; tam++) {
    const calzan: Pendiente[][] = [];
    for (let mask = 1; mask < 1 << n; mask++) {
      if (bits(mask) !== tam) continue;
      const ps = lista.slice(0, n).filter((_, i) => mask & (1 << i));
      if (exacto(redondo(ps.reduce((a, p) => a + p.debeUsd, 0)))) calzan.push(ps);
    }
    if (calzan.length > 1) return { tipo: 'ambiguo', opciones: calzan.map((ps) => ps.map(clavePendiente)) };
    if (calzan.length === 1) return conjunto(calzan[0]);
  }
  if (deMas(montoUsd, total)) return { tipo: 'de-mas', debeUsd: total };
  // Parcial: completa en orden lo que alcanza; el resto, a cuenta del primero que no se completa.
  let queda = redondo(montoUsd);
  const aplicado: Array<{ clave: string; montoUsd: number }> = [];
  const cubiertas: string[] = [];
  for (const p of lista) {
    if (queda <= 0.009) break;
    const va = redondo(Math.min(queda, p.debeUsd));
    aplicado.push({ clave: clavePendiente(p), montoUsd: va });
    if (cubre(va, p.debeUsd)) cubiertas.push(clavePendiente(p));
    queda = redondo(queda - va);
  }
  return { tipo: 'parcial', aplicado, cubiertas, faltaUsd: redondo(Math.max(0, total - montoUsd)) };
}
const bits = (x: number): number => { let c = 0; for (let v = x; v; v &= v - 1) c++; return c; };

// ── «Paga para entrar»: quién se pausa ───────────────────────────────────────────────────────────────────────────

/**
 * Por qué una cuenta está (o tiene que estar) en «Paga para entrar». `entrada`: el cliente no pagó su entrada. `mes:<AAAA-MM>`:
 * la agencia no pagó el total de ese mes (pausa a la agencia y a todos sus clientes).
 */
export type Causa = 'entrada' | `mes:${string}`;
export const esCausa = (v: unknown): v is Causa => v === 'entrada' || (typeof v === 'string' && /^mes:\d{4}-(0[1-9]|1[0-2])$/.test(v));

/** Lo que se sabe de cada mes desde que se prendió: el total que se le dijo, lo que entró, y si el aviso salió. */
export type EstadoDelMes = { mes: Mes; totalUsd: number; pagadoUsd: number; avisadoUsd: number | null };
/** Lo que se sabe de cada cliente: su situación, y si el aviso de su entrada salió (para pausarlo hace falta que haya salido). */
export type EstadoDeCliente = { ws: number; situacion: Situacion; avisoEntrada: boolean };

/**
 * QUIÉN TIENE QUE ESTAR EN «PAGA PARA ENTRAR» HOY, con sus causas. Puro: decide con lo que ya se leyó. Las tres reglas:
 *   · el cliente al que se le venció la entrada (y el aviso de su entrada salió), o que ya está en pausa por ella;
 *   · desde el día 6 de un mes cuyo aviso salió, si lo que entró no cubre lo que se le dijo (o el total de hoy, si bajó):
 *     la agencia y todos sus clientes que no están de baja;
 *   · nada más. ⚠️ Lo que NO se leyó no entra acá: quien llama no llama si una lectura falló.
 * Una cuenta que nunca se avisó no se pausa: sin aviso, no se puede pedir que se pague.
 */
export function quienVaEnPausa(p: { agenciaWs: number; hoy: Dia; meses: readonly EstadoDelMes[]; clientes: readonly EstadoDeCliente[] }): Map<number, Causa[]> {
  const out = new Map<number, Causa[]>();
  const sumar = (ws: number, c: Causa) => out.set(ws, [...new Set([...(out.get(ws) ?? []), c])]);
  for (const c of p.clientes) {
    const s = c.situacion;
    if (s.tipo === 'paga-para-entrar' || (s.tipo === 'debe-entrada' && s.vencida && c.avisoEntrada)) sumar(c.ws, 'entrada');
  }
  for (const m of p.meses) {
    if (p.hoy <= diaLimite(m.mes) || m.avisadoUsd == null) continue;
    // Se exige lo que se le dijo, o el total de hoy si bajó (una baja después del aviso). Nunca más de lo que se le dijo.
    const exigido = Math.min(m.avisadoUsd, m.totalUsd);
    if (cubre(m.pagadoUsd, exigido)) continue;
    const causa: Causa = `mes:${m.mes}`;
    sumar(p.agenciaWs, causa);
    for (const c of p.clientes) if (c.situacion.tipo !== 'baja' && c.situacion.tipo !== 'baja-sin-costo') sumar(c.ws, causa);
  }
  return out;
}

/**
 * Qué hacer con una cuenta, con lo que tiene que estar (`quiere`: sus causas) y lo que está (pausada o no, y el corte de MaKo
 * que tiene). Sólo toca lo que pausó la mensualidad: una pausa a mano, o de otro motivo (la pasarela, la baja de la agencia),
 * no se reabre ni se pisa. Una reactivación A MANO de una pausa de la mensualidad se respeta para esas causas (`perdonadas`):
 * vuelve a pausarse sólo por una causa nueva.
 */
export type PasoDePausa = { tipo: 'nada' } | { tipo: 'pausar'; causas: Causa[] } | { tipo: 'reabrir' } | { tipo: 'actualizar'; causas: Causa[] } | { tipo: 'soltar' };
export function pasoDePausa(p: {
  quiere: readonly Causa[];
  pausada: boolean;
  /** El corte guardado de la cuenta, si es de la mensualidad (otro motivo: `otroMotivo`). */
  corte: { vigente: boolean; causas: readonly Causa[]; perdonadas: readonly Causa[] } | null;
  /** Tiene un corte de OTRO motivo vigente (la pasarela, la baja de su agencia). */
  otroMotivo: boolean;
}): PasoDePausa {
  if (p.otroMotivo) return { tipo: 'nada' };
  const quiere = [...new Set(p.quiere)];
  const nuevas = quiere.filter((c) => !(p.corte?.perdonadas ?? []).includes(c));
  if (p.pausada) {
    // Pausada sin un corte de la mensualidad vigente: es una pausa a mano (o de antes): no se toca.
    if (!p.corte?.vigente) return { tipo: 'nada' };
    if (!quiere.length) return { tipo: 'reabrir' };
    const iguales = quiere.length === p.corte.causas.length && quiere.every((c) => p.corte!.causas.includes(c));
    return iguales ? { tipo: 'nada' } : { tipo: 'actualizar', causas: quiere };
  }
  // Activa con un corte de la mensualidad que dice vigente: alguien la reactivó a mano. Se respeta.
  if (p.corte?.vigente) return { tipo: 'soltar' };
  return nuevas.length ? { tipo: 'pausar', causas: quiere } : { tipo: 'nada' };
}

// ── Lo guardado: si está prendida, qué se pagó y qué se avisó ────────────────────────────────────────────────────

export type ConfigMensualidad = {
  /** El primer mes cuya mensualidad avisa MaKo (el que la prende elige: «noviembre se cobró a mano», así que 2026-12). */
  desde: Mes;
  /** Desde qué día se cobran las entradas (el día que se prendió): los 14 días que terminaron antes se cobraron a mano. */
  entradasDesde: Dia;
  medio: string;
  prendidaPor: string | null;
  prendidaAt: string | null;
};

const texto = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, max) : null);
const objeto = (raw: unknown): Record<string, unknown> | null => {
  let o: unknown = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
};
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? redondo(v) : null);
const ordenes = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[A-Z0-9]{4,120}$/.test(x)).slice(0, 20) : []);

/** La mensualidad prendida de una agencia (lo guardado), o null si está apagada o no se entiende. */
export function leerConfigMensualidad(raw: unknown): ConfigMensualidad | null {
  const o = objeto(raw);
  if (!o || !esMes(o.desde)) return null;
  // Las de antes del 6/11 no tenían el día: las entradas se cobran desde el primer día del primer mes.
  const entradasDesde = esDia(o.entradasDesde) ? o.entradasDesde : primerDia(o.desde);
  return { desde: o.desde, entradasDesde, medio: texto(o.medio, 40) ?? MEDIO_POR_DEFECTO, prendidaPor: texto(o.prendidaPor, 120), prendidaAt: texto(o.prendidaAt, 40) };
}

/**
 * Lo que entró a cuenta de un mes (lo guardado). Un mes puede tener pagos parciales: `pagadoUsd` es la suma, `ordenes` sus
 * órdenes de Binance. `totalUsd` es el total cuando se completó (o el de cuando se marcó a mano). Las de antes del 6/11 no
 * tenían `pagadoUsd`: se marcaban completas, así que vale su total.
 */
export type PagoDelMes = { mes: Mes; pagadoEl: Dia; totalUsd: number; pagadoUsd: number; ordenes: string[]; marcadoPor: string | null; marcadoAt: string | null };

export function leerPagoDelMes(raw: unknown): PagoDelMes | null {
  const o = objeto(raw);
  if (!o || !esMes(o.mes) || !esDia(o.pagadoEl)) return null;
  const total = numero(o.totalUsd);
  if (total == null) return null;
  return {
    mes: o.mes, pagadoEl: o.pagadoEl, totalUsd: total, pagadoUsd: numero(o.pagadoUsd) ?? total, ordenes: ordenes(o.ordenes),
    marcadoPor: texto(o.marcadoPor, 120), marcadoAt: texto(o.marcadoAt, 40),
  };
}

/**
 * La entrada de un cliente (lo guardado): desde qué día, cuánto era y cuánto entró. `desde` se fija con el primer pago (para
 * quien estaba en pausa, el día que pagó); completa cuando lo pagado cubre el monto.
 */
export type EntradaGuardada = { ws: number; desde: Dia; montoUsd: number; pagadoUsd: number; pagadoEl: Dia; ordenes: string[]; marcadoPor: string | null };

export function leerEntrada(raw: unknown): EntradaGuardada | null {
  const o = objeto(raw);
  if (!o || typeof o.ws !== 'number' || !Number.isSafeInteger(o.ws) || o.ws <= 0 || !esDia(o.desde) || !esDia(o.pagadoEl)) return null;
  const monto = numero(o.montoUsd);
  const pagado = numero(o.pagadoUsd);
  if (monto == null || pagado == null) return null;
  return { ws: o.ws, desde: o.desde, montoUsd: monto, pagadoUsd: pagado, pagadoEl: o.pagadoEl, ordenes: ordenes(o.ordenes), marcadoPor: texto(o.marcadoPor, 120) };
}
export const entradaCompleta = (e: EntradaGuardada): boolean => cubre(e.pagadoUsd, e.montoUsd);

/**
 * Un pago anotado de una orden de Binance (`agencia.mensualidad.<ag>.orden.<ORDEN>`, lo que se manda en el recibo): `montoUsd` es
 * lo RECIBIDO; `aplicado`, a qué pendiente se sumó cada parte (`mes:<AAAA-MM>` o `entrada:<cliente>`, con lo que se debía).
 * Lo leen el libro (lib/agencia-mes.ts) y Admin › Revenue (lib/admin-ingresos-libro.ts): vive acá para que sea UN lector.
 */
export type OrdenAnotada = { orden: string; monto: number; moneda: string; montoUsd: number; fecha: string; comprobante: string | null; aplicado: Array<{ clave: string; montoUsd: number }> };
export const leerOrden = (raw: string | undefined): OrdenAnotada | null => {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<OrdenAnotada>;
    if (typeof o.orden !== 'string' || typeof o.monto !== 'number' || typeof o.montoUsd !== 'number' || typeof o.fecha !== 'string') return null;
    return { orden: o.orden, monto: o.monto, moneda: String(o.moneda ?? 'USD'), montoUsd: o.montoUsd, fecha: o.fecha, comprobante: typeof o.comprobante === 'string' ? o.comprobante : null, aplicado: Array.isArray(o.aplicado) ? o.aplicado : [] };
  } catch { return null; }
};

/** El corte de «Paga para entrar» (lo que se guarda en `plan.corte_por_pago` con motivo `paga-para-entrar`). */
export type CortePagaParaEntrar = { agenciaWs: number; rol: 'agencia' | 'cliente'; causas: Causa[]; perdonadas: Causa[] };
export function leerCortePagaParaEntrar(raw: unknown): CortePagaParaEntrar | null {
  const o = objeto(raw);
  if (!o || typeof o.agenciaWs !== 'number' || !Number.isSafeInteger(o.agenciaWs) || o.agenciaWs <= 0) return null;
  const lista = (v: unknown): Causa[] => (Array.isArray(v) ? [...new Set(v.filter(esCausa))] : []);
  return { agenciaWs: o.agenciaWs, rol: o.rol === 'agencia' ? 'agencia' : 'cliente', causas: lista(o.causas), perdonadas: lista(o.perdonadas) };
}

// ── Cómo se dice (los avisos al grupo y la pantalla) ──────────────────────────────────────────────────────────────

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
/** La tarifa de un día, con 4 decimales: US$ 1,5667. */
export const usdDia = (n: number): string => `US$ ${n.toFixed(4).replace('.', ',')}`;

export const NOMBRE_PLAN: Readonly<Record<PlanCuenta, string>> = { esencial: 'MaKo Esencial', pro: 'MaKo Pro' };

/** Qué es una línea de la mensualidad, sin el monto (la pantalla lo pone en su columna). */
export function conceptoDeLinea(l: LineaDelMes): string {
  if (l.tipo === 'agencia') return `Tu plan ${NOMBRE_PLAN[l.plan]}`;
  return `${l.nombre} · ${NOMBRE_PLAN[l.plan]}`;
}

/** Qué cubre un ciclo: «del 5 de diciembre al 4 de enero». */
export const periodoDelCiclo = (m: Mes): string => `del ${diaLargo(inicioDelCiclo(m))} al ${diaLargo(sumarDias(inicioDelCiclo(mesSiguiente(m)), -1))}`;

/** Una tabla para el PDF: encabezados, filas y el total. Lo dibuja lib/agencia-mes-pdf.ts. */
export type TablaDeCobro = {
  titulo: string;
  subtitulo: string;
  columnas: string[];
  filas: string[][];
  totalUsd: number;
  limite: Dia;
  notas: string[];
};

/** La tabla del aviso del mes: un renglón por línea, con el período que cubre. */
export function tablaDelMes(p: { agencia: string; cuenta: CuentaDelMes; medio: string; pagadoUsd?: number }): TablaDeCobro {
  const mes = nombreDelMes(p.cuenta.mes);
  const periodo = periodoDelCiclo(p.cuenta.mes);
  const filas = p.cuenta.lineas.map((l) => [conceptoDeLinea(l), periodo, usd(l.montoUsd)]);
  const ya = p.pagadoUsd && p.pagadoUsd > 0.009 ? p.pagadoUsd : 0;
  if (ya) filas.push(['Ya pagado a cuenta', '', usd(-ya)]);
  return {
    titulo: `Mensualidad de ${mes}`,
    subtitulo: `${p.agencia} · se paga del 1 al ${DIA_LIMITE_DE_PAGO} de ${mes}, por ${p.medio}`,
    columnas: ['Concepto', 'Cubre', 'Importe'],
    filas,
    totalUsd: redondo(p.cuenta.totalUsd - ya),
    limite: p.cuenta.limite,
    notas: [
      `Cubre ${periodo}. Un cliente que entra después del 5 paga sus días hasta el próximo 5, aparte.`,
      `Si el ${DIA_LIMITE_DE_PAGO} de ${mes} no está pagada, el ${DIA_LIMITE_DE_PAGO + 1} se pausan tu cuenta y las de tus clientes hasta que entre el pago.`,
    ],
  };
}

/** La tabla de las entradas (una o varias): cada cliente con sus días, la tarifa y el monto. */
export function tablaDeEntradas(p: { agencia: string; medio: string; entradas: ReadonlyArray<{ nombre: string; entrada: Diferencial; pagadoUsd?: number }> }): TablaDeCobro {
  const limite = p.entradas.map((e) => e.entrada.limite).sort()[0];
  const filas = p.entradas.flatMap((e) => {
    const d = e.entrada;
    const base = [`Entrada de ${e.nombre}`, `del ${diaCorto(d.desde)} al ${diaCorto(d.hasta)}`, `${d.dias} × ${usdDia(d.tarifaUsd)}`, usd(d.montoUsd)];
    return e.pagadoUsd && e.pagadoUsd > 0.009 ? [base, [`Ya pagado de ${e.nombre}`, '', '', usd(-e.pagadoUsd)]] : [base];
  });
  const total = redondo(p.entradas.reduce((a, e) => a + e.entrada.montoUsd - (e.pagadoUsd ?? 0), 0));
  const una = p.entradas.length === 1 ? p.entradas[0] : null;
  return {
    titulo: una ? `Entrada de ${una.nombre}` : 'Entradas de tus clientes',
    subtitulo: `${p.agencia} · se paga por ${p.medio} hasta el ${diaLargo(limite)}`,
    columnas: ['Concepto', 'Días', 'Días × precio por día', 'Importe'],
    filas,
    totalUsd: total,
    limite,
    notas: [
      `Cada cliente paga sus días desde que empieza hasta el próximo ${DIA_DEL_CICLO}, sin contar ese ${DIA_DEL_CICLO}: lo cubre la mensualidad. El precio por día es su plan dividido por los días del ciclo.`,
      'Se paga hasta el mismo día en que empieza. Si no entra, su cuenta se pausa hasta que se pague, y los días se cuentan desde el día que paga.',
      'Si no te pagó, dalo de baja antes en tu Agency Dashboard y no se cobra.',
    ],
  };
}

/** El texto que acompaña al PDF del mes en el grupo. Español neutro, de tú, y pide el comprobante. */
export function textoDelAvisoDelMes(p: { agencia: string; tabla: TablaDeCobro; medio: string; actualizado?: boolean }): string {
  const mes = p.tabla.titulo.replace('Mensualidad de ', '');
  return [
    p.actualizado ? `Se actualizó la mensualidad de ${mes} de ${p.agencia}: ahora son ${usd(p.tabla.totalUsd)}.` : `Hola. La mensualidad de MaKo de ${mes} de ${p.agencia} es de ${usd(p.tabla.totalUsd)}. El detalle va en el PDF.`,
    `Págala por ${p.medio} hasta el ${diaLargo(p.tabla.limite)} y manda aquí la captura del comprobante: la registro y te mando el recibo.`,
  ].join('\n');
}

/** El texto que acompaña al PDF de una o varias entradas. */
export function textoDelAvisoDeEntradas(p: { tabla: TablaDeCobro; medio: string; entradas: ReadonlyArray<{ nombre: string; entrada: Diferencial }>; enPausa?: boolean }): string {
  const una = p.entradas.length === 1 ? p.entradas[0] : null;
  const quien = una ? una.nombre : p.entradas.map((e) => e.nombre).join(', ');
  // Con DOS o más, en plural (14/11/2026, el Cerebro: «Giselle Belanti, Marcela Fernandez quedaron en pausa: no entró su entrada. Si la
  // pagas hoy… Págala… dalo de baja» salió así y el aviso se mandó a mano). Con una sola, como siempre.
  const cabeza = p.enPausa
    ? una
      ? `${quien} quedó en pausa: no entró su entrada. Si la pagas hoy son ${usd(p.tabla.totalUsd)}; cada día que pasa baja, porque se cuenta desde el día que pagas.`
      : `${quien} quedaron en pausa: no entraron sus entradas. Si las pagan hoy son ${usd(p.tabla.totalUsd)}; cada día que pasa baja, porque se cuenta desde el día que pagan.`
    : una
      ? `${quien} termina sus ${DIAS_SIN_COSTO} días sin costo el ${diaCorto(una.entrada.desde)}. Su entrada son ${una.entrada.dias} días hasta el ${diaCorto(una.entrada.hasta)}: ${usd(una.entrada.montoUsd)}.`
      : `Las entradas de ${quien}: ${usd(p.tabla.totalUsd)} en total. El detalle va en el PDF.`;
  return [
    cabeza,
    una
      ? `Págala por ${p.medio} hasta el ${diaLargo(p.tabla.limite)} y manda aquí el comprobante. Si no te pagó, dalo de baja antes y no se cobra.`
      : `Páguenlas por ${p.medio} hasta el ${diaLargo(p.tabla.limite)} y manden aquí el comprobante. Si alguno ya no sigue, denlo de baja antes y no se cobra.`,
  ].join('\n');
}

/** Lo que dice MaKo en el grupo cuando la agencia queda en pausa el día 6 (sin montos de sus clientes). */
export function textoDePausaDelMes(p: { mes: Mes; faltaUsd: number }): string {
  return `La mensualidad de ${nombreDelMes(p.mes)} no entró: desde hoy tu cuenta y las de tus clientes están en pausa. Falta ${usd(p.faltaUsd)}. Manda aquí el comprobante y vuelven a entrar en el acto.`;
}

/**
 * EL AVISO AL SUPER ADMIN DE UNA AGENCIA QUE NO PAGó (6/11/2026, #498). No va al grupo de la agencia —eso ya lo dice
 * `textoDePausaDelMes`—: va a Martín, para que no haya que entrar a mirar la pantalla. Sin él, una agencia puede quedar
 * meses sin pagar y no enterarse nadie.
 *
 * Es un reporte, no un mensaje a una persona: sin segunda persona, con el monto y los días que lleva.
 */
export function textoDeMesImpago(p: { agencia: string; mes: Mes; debeUsd: number; diasDeAtraso: number }): string {
  const d = p.diasDeAtraso;
  const cuanto = d <= 0 ? 'vence hoy' : d === 1 ? 'lleva 1 día de atraso' : `lleva ${d} días de atraso`;
  return `${p.agencia}: la mensualidad de ${nombreDelMes(p.mes)} no entró y ${cuanto}. Falta ${usd(p.debeUsd)}. La cuenta de la agencia y las de sus clientes quedan en pausa hasta que entre el pago.`;
}

/**
 * El aviso a Martín de un comprobante para revisar (lib/agencia-mes-comprobante.ts). ⚠️ TERMINA EN UNA PREGUNTA, y sin nombres de
 * herramientas (12/11/2026, Martín: «Funciona increíblemente mal el WhatsApp, no guarda contexto de nada»). El de antes cerraba con
 * «márcalo con marcar_mensualidad_pagada o marcar_entrada_pagada (con la orden)»: un nombre interno que Martín no tiene por qué leer,
 * y SIN «?». Sin la pregunta, su «Si perfecto, dalo de alta» no seguía la oferta (`makoPreguntoAlgo`, lib/mako-intencion.ts) y MaKo
 * contestó «¿a quién le doy de alta al CRM?». La agencia y cada cliente van con su número de cuenta: el turno lo usa para marcarlo.
 */
export function avisoDeComprobanteParaRevisar(p: { agencia: string; agenciaWs: number; porque: string; lectura: string; debe: string }): string {
  return `Comprobante de ${p.agencia} (cuenta ${p.agenciaWs}) para revisar (${p.porque}): ${p.lectura} Lo que debía: ${p.debe}. Si está bien, ¿lo marco como pagado?`;
}

/** Lo que contesta MaKo a un comprobante del grupo, según lo que hizo. Lo arma el código, nunca un modelo. */
export function textoDeComprobante(r:
  | { tipo: 'cubre'; montoUsd: number; conceptos: string[]; reabiertas: number }
  | { tipo: 'parcial'; montoUsd: number; conceptos: string[]; cubiertos: string[]; faltaUsd: number }
  | { tipo: 'repetido'; numero: number | null }
  | { tipo: 'revisar' },
): string {
  if (r.tipo === 'repetido') return `Esa orden de Binance ya la tenía registrada${r.numero ? ` (recibo N.º ${String(r.numero).padStart(4, '0')})` : ''}: no la cuento dos veces.`;
  if (r.tipo === 'revisar') return 'Recibí tu comprobante. Lo revisa el equipo de MaKo y te confirmo por aquí.';
  if (r.tipo === 'cubre') {
    return [
      `Recibí tu pago de ${usd(r.montoUsd)}. Quedó pagado: ${r.conceptos.join(', ')}. Te mando el recibo.`,
      ...(r.reabiertas ? [r.reabiertas === 1 ? 'La cuenta que estaba en pausa ya está activa.' : 'Las cuentas que estaban en pausa ya están activas.'] : []),
    ].join('\n');
  }
  return [
    `Recibí ${usd(r.montoUsd)} a cuenta de ${r.conceptos.join(', ')}.`,
    ...(r.cubiertos.length ? [`Quedó pagado: ${r.cubiertos.join(', ')}.`] : []),
    `Falta ${usd(r.faltaUsd)}.`,
  ].join('\n');
}

/** Lo que dice la fila de un cliente en la pantalla. */
export function textoDeSituacion(s: Situacion): { texto: string; tono: 'good' | 'warn' | 'bad' | null } {
  if (s.tipo === 'cuenta') return { texto: `Cuenta desde el ${diaCorto(s.desde)}`, tono: 'good' };
  if (s.tipo === 'sin-costo') return { texto: s.entrada ? `Sin costo hasta el ${diaCorto(s.hasta)}` : `Entrada pagada · desde el ${diaCorto(s.hasta)}`, tono: s.entrada && s.faltan <= DIAS_DE_AVISO ? 'warn' : null };
  if (s.tipo === 'debe-entrada') return { texto: s.vencida ? `Entrada vencida el ${diaCorto(s.limite)}` : `Entrada hoy · ${usd(s.entrada.montoUsd)}`, tono: s.vencida ? 'bad' : 'warn' };
  if (s.tipo === 'paga-para-entrar') return { texto: `Paga para entrar · ${usd(s.entrada.montoUsd)} hoy`, tono: 'bad' };
  if (s.tipo === 'baja') return { texto: `Contó del ${diaCorto(s.desde)} al ${diaCorto(sumarDias(s.baja, -1))}`, tono: null };
  return { texto: 'De baja sin costo', tono: null };
}
