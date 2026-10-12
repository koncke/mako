// =============================================================================
// /m/ads — lo PURO: el período, los tipos que bajan a la pantalla, la plata y las reglas de
// escritorio que el teléfono necesita fuera del componente que las tiene adentro
// =============================================================================
// Sin `server-only` y sin 'use client': lo leen el server (./datos.ts), la pantalla (./AdsM.tsx)
// y el test (tests/m-ads.test.ts). Sólo importa módulos puros (lib/date-utils, lib/presupuesto-
// cambio) y TIPOS de lib/meta-health-ui.
//
// ⚠️ «HOY» NO EXISTE ACÁ, y no es un olvido. El prototipo dice «Hoy · 7 días · Este mes», pero el
//    gasto y las agendas por campaña salen de `marketing_metrics_daily` (getSenalesRecon, lo mismo
//    que la tabla de escritorio), y esa tabla la llena UNA VEZ por día el cron meta-daily con el día
//    de AYER (app/api/cron/meta-daily/route.ts). Hoy siempre leería US$0: un número inventado.
//    Escritorio no tiene un lector en vivo de insights por campaña. Por eso los tres períodos
//    terminan AYER: «Ayer», los 7 días completos hasta ayer y el mes hasta ayer (el «Este mes»
//    por defecto de escritorio, app/ads-manager/AdsManagerView.tsx: primerDiaDelMes(ayer)..ayer).
// =============================================================================

import { diasAntes, primerDiaDelMesDeFecha } from '@/lib/date-utils';
import { esConvertible, inicialTipeado, saltoPresupuesto, tipeadoACuenta } from '@/lib/presupuesto-cambio';
import type { NodoEstado } from '@/lib/meta-health-ui';

// ── El período ──────────────────────────────────────────────────────────────────────────────

export type PeriodoAdsId = 'ayer' | '7d' | 'mes';
export type PeriodoAds = {
  id: PeriodoAdsId;
  /** El botón del segmentado. */
  label: string;
  /** Lo que sigue a «Importe gastado» en el sheet de una campaña. */
  en: string;
};

export const PERIODOS_ADS: readonly PeriodoAds[] = [
  { id: 'ayer', label: 'Ayer', en: 'ayer' },
  { id: '7d', label: '7 días', en: 'en 7 días' },
  { id: 'mes', label: 'Este mes', en: 'este mes' },
];

export const PERIODO_ADS_DEFAULT: PeriodoAdsId = 'ayer';

/** El período pedido en `?periodo=`, si es uno de los tres; si no, el de entrada. */
export function periodoAdsDeParam(raw: unknown): PeriodoAds {
  const id = Array.isArray(raw) ? raw[0] : raw;
  return PERIODOS_ADS.find((p) => p.id === id) ?? PERIODOS_ADS.find((p) => p.id === PERIODO_ADS_DEFAULT)!;
}

/** El rango de fechas del período, con `hoy` en la zona de escritorio (hoyEnTijuana). */
export function rangoAds(id: PeriodoAdsId, hoy: string): { desde: string; hasta: string } {
  const ayer = diasAntes(hoy, 1);
  if (id === 'ayer') return { desde: ayer, hasta: ayer };
  if (id === '7d') return { desde: diasAntes(ayer, 6), hasta: ayer };
  return { desde: primerDiaDelMesDeFecha(ayer), hasta: ayer };
}

// ── La plata ────────────────────────────────────────────────────────────────────────────────

/**
 * Un monto para dibujar. La regla es la de `fmtValor(v, 'usd')` de escritorio
 * (lib/graficos-agregar.ts), la misma que usa el Dashboard del teléfono: centavos sólo donde dicen
 * algo («US$92,20» sí, «US$80,00» no) y separadores es-AR. Vive aquí para no meter el catálogo del
 * Dashboard en el bundle de esta pantalla. `unidad` = 'USD' o la moneda cruda de la cuenta cuando
 * el código no tiene tasa para ella (lib/presupuesto-cambio.ts: no se inventa una conversión).
 */
export function dinero(v: number | null | undefined, unidad: string): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const dec = abs < 100 && Math.round(abs * 100) % 100 !== 0 ? 2 : 0;
  const num = v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return unidad === 'USD' ? `US$${num}` : `${num} ${unidad}`;
}

/** «0 agendas», «1 agenda», «13 agendas». El resultado de escritorio es la agenda (agendas_meta). */
export function agendasTexto(n: number): string {
  return `${n.toLocaleString('es-AR')} ${n === 1 ? 'agenda' : 'agendas'}`;
}

// ── El presupuesto ──────────────────────────────────────────────────────────────────────────
// Lo que viaja a Meta va en la MONEDA DE LA CUENTA (lib/meta-write.ts lo manda en centavos de esa
// moneda). Lo que se mueve con el +/− es lo que escritorio TIPEA: dólares si el código tiene tasa
// para esa moneda, la moneda cruda si no (lib/presupuesto-cambio.ts, la regla de la celda).

/** En qué se mueve el +/−: 'USD' si hay tasa, la moneda de la cuenta si no. */
export function unidadDePresupuesto(moneda: string): string {
  return esConvertible(moneda) ? 'USD' : moneda;
}

/** El presupuesto de la cuenta en lo que se tipea, entero (lo mismo que abre el editor de escritorio). */
export function tipeado(montoCuenta: number, moneda: string): number {
  return Number(inicialTipeado(montoCuenta, moneda)) || 0;
}

/** «US$60/día» para un monto de la cuenta. */
export function textoDiario(montoCuenta: number, moneda: string): string {
  return `${dinero(tipeado(montoCuenta, moneda), unidadDePresupuesto(moneda))}/día`;
}

/**
 * Cuánto mueve un toque del +/−. En dólares, 5 (el prototipo). En una moneda sin tasa, 5 dólares
 * no existen: el 5 % del monto redondeado a una cifra (50.000 ARS → de a 3.000).
 */
export function pasoDe(valor: number, moneda: string): number {
  if (esConvertible(moneda)) return 5;
  const crudo = Math.max(1, valor * 0.05);
  const p = 10 ** Math.floor(Math.log10(crudo));
  return Math.max(1, Math.round(crudo / p) * p);
}

/**
 * El valor siguiente del +/−, en múltiplos del paso (62 → 65 / 60, como un stepper de iOS).
 * Nunca baja de 1: un presupuesto de 0 Meta lo rechaza.
 */
export function pasoSiguiente(valor: number, paso: number, dir: 1 | -1): number {
  if (dir === 1) return (Math.floor(valor / paso) + 1) * paso;
  const abajo = (Math.ceil(valor / paso) - 1) * paso;
  return abajo >= 1 ? abajo : Math.min(valor, 1);
}

export type CambioPresupuesto = {
  /** Lo que se le escribe a Meta, en la moneda de la cuenta. */
  nuevoCuenta: number;
  cambia: boolean;
  consecuencia: string;
  /** «Poner US$70/día». */
  boton: string;
};

/**
 * Lo que dice el pie del sheet para un valor del +/−. «Cambia» se decide comparando lo TIPEADO
 * contra lo que abrió el editor (`inicialTipeado`), igual que escritorio: el redondeo hace que la
 * ida y la vuelta no cierren (500 MXN se ven como 29 y 29 vuelve como 502). El salto ×5 en las
 * dos direcciones es el aviso del cartel de escritorio (`saltoPresupuesto`).
 */
export function cambioPresupuesto(valor: number, actualCuenta: number, moneda: string): CambioPresupuesto {
  const unidad = unidadDePresupuesto(moneda);
  const cambia = String(valor) !== inicialTipeado(actualCuenta, moneda);
  const nuevoCuenta = tipeadoACuenta(String(valor), moneda) ?? actualCuenta;
  const boton = `Poner ${dinero(valor, unidad)}/día`;
  if (!cambia) return { nuevoCuenta: actualCuenta, cambia, consecuencia: 'Mueve el presupuesto para cambiarlo.', boton };
  // Si lo tipeado está en dólares y la cuenta cobra en otra moneda, se dice cuánto le llega a Meta.
  const base = unidad === moneda
    ? 'Meta empieza a gastar el monto nuevo hoy.'
    : `Meta empieza a gastar ${dinero(nuevoCuenta, moneda)} al día desde hoy.`;
  const s = saltoPresupuesto(nuevoCuenta, actualCuenta);
  const salto = s ? ` Es ${s.veces} veces ${s.sube ? 'el actual' : 'menos que el actual'}.` : '';
  return { nuevoCuenta, cambia, consecuencia: base + salto, boton };
}

// ── Lo que baja a la pantalla ───────────────────────────────────────────────────────────────

/** Un presupuesto DIARIO que se edita: el de la campaña (CBO) o el de cada conjunto (ABO). */
export type PresupuestoM = { nivel: 'campaign' | 'adset'; id: string; nombre: string; diario: number };

/** Un anuncio que no entrega, con el motivo en español (`explicarIssueEs`). */
export type ProblemaM = { id: string; nombre: string; motivo: string };

/** Un hijo de la campaña que activar junto con ella (la cascada de escritorio). */
export type HijoM = { nivel: 'adset' | 'ad'; id: string };

export type CampanaM = {
  id: string;
  nombre: string;
  /** `effectiveStatus === 'ACTIVE'`, la regla del interruptor de escritorio. */
  activa: boolean;
  /**
   * `configuredStatus === 'ACTIVE'`: lo que ELLA tiene puesto. No es `activa`: una en revisión o con un
   * anuncio rechazado (IN_PROCESS, WITH_ISSUES) sale con el interruptor apagado y está configurada activa.
   * Lo usa «Deshacer» una activación (`deshacerPausaLaCampana`).
   */
  configuradaActiva: boolean;
  /** Cómo está si NO está activa («En pausa», «En revisión»…): lo que dice la línea gris. */
  estado: string;
  /** Archivada o borrada en Meta: el interruptor no la puede prender. */
  archivada: boolean;
  /** Del período, ya formateado. null = no se pudo leer el gasto. */
  gasto: string | null;
  agendas: number;
  costo: string | null;
  presupuestos: PresupuestoM[];
  /** Presupuesto TOTAL de la campaña (no se edita aquí, como en escritorio), en la moneda de la cuenta. */
  total: number | null;
  problemas: ProblemaM[];
  /** La cuenta de Meta no entrega por un pago («Error en el pago» en escritorio). */
  pagoFrenado: boolean;
  /** El estado de la campaña si ELLA está en rojo (Rechazado, Con problemas…). */
  estadoRojo: string | null;
  /** A dónde lleva «Pedir revisión en Meta» y cómo se llama ese botón. */
  enMeta: { href: string; rotulo: string } | null;
  /** Los conjuntos y anuncios a activar con ella (los que no están activos). */
  hijos: HijoM[];
  /** Va en la lista de arriba; las demás (en pausa y sin gasto) quedan detrás de una fila. */
  destacada: boolean;
};

export type ResumenM = { gasto: string; resultados: string; costo: string };

export type LecturaAds =
  | { estado: 'sin_meta' }
  | { estado: 'token' }
  | { estado: 'error' }
  | {
      estado: 'ok';
      campanas: CampanaM[];
      /** null = no se pudo leer el gasto (getSenalesRecon falló): se dibuja el estado sin números. */
      resumen: ResumenM | null;
      /** La moneda de la CUENTA de Meta: la de los presupuestos. */
      moneda: string;
      /** El estado de la cuenta («Saldo impago»), para la fila del pago. */
      cuentaEstado: string;
      /** Cuándo EMPEZÓ la lectura del árbol de Meta (ver presupuestosVigentes). */
      leidaDesde: number | null;
    };

// ── Reglas de escritorio que viven dentro de app/ads-manager/CampanasBrowser.tsx ─────────────
// Son closures de un componente de cliente y no se pueden importar. Se copian con su fuente
// citada; si cambian allá, cambian aquí (y se deberían mover a una lib: ver la cosecha).

type Nodo = Pick<NodoEstado, 'id' | 'parentId' | 'semaforo' | 'effectiveStatus' | 'configuredStatus'>;

/**
 * Gasto y agendas por NOMBRE de campaña: el `byCamp` de CampanasBrowser (las señales traen el
 * nombre, no el id). El resultado de escritorio es `agendas` (las de Meta, por anuncio).
 */
export function perfPorCampana(senales: ReadonlyArray<{ campana: string | null; spend_usd: number; agendas: number }>): Map<string, { gasto: number; agendas: number }> {
  const out = new Map<string, { gasto: number; agendas: number }>();
  for (const s of senales) {
    const k = s.campana ?? '—';
    const a = out.get(k) ?? { gasto: 0, agendas: 0 };
    a.gasto += Number(s.spend_usd) || 0;
    a.agendas += Number(s.agendas) || 0;
    out.set(k, a);
  }
  return out;
}

/**
 * Los anuncios en rojo de cada campaña: el `rollup` de CampanasBrowser («Con problemas · N»
 * hereda hacia el conjunto y la campaña). Anuncio → conjunto (parentId) → campaña (parentId).
 */
export function anunciosEnRojoPorCampana<A extends Nodo>(adsets: ReadonlyArray<Nodo>, ads: ReadonlyArray<A>): Map<string, A[]> {
  const campDeAdset = new Map(adsets.map((a) => [a.id, a.parentId]));
  const out = new Map<string, A[]>();
  for (const ad of ads) {
    if (ad.semaforo !== 'rojo' || !ad.parentId) continue;
    const camp = campDeAdset.get(ad.parentId);
    if (!camp) continue;
    const lista = out.get(camp);
    if (lista) lista.push(ad); else out.set(camp, [ad]);
  }
  return out;
}

const MUERTO = new Set(['ARCHIVED', 'DELETED']);

/** ¿Meta ya no la deja prender? (archivada o borrada). */
export const estaArchivada = (effectiveStatus: string): boolean => MUERTO.has(effectiveStatus);

/**
 * Lo que dice la línea gris de una campaña que no está activa. «En pausa» para la pausada (el
 * prototipo); el resto, la etiqueta de escritorio (`statusLabel`: «En revisión», «Procesando»).
 */
export function estadoTexto(effectiveStatus: string, etiqueta: string): string {
  if (effectiveStatus === 'PAUSED') return 'En pausa';
  if (effectiveStatus === 'ARCHIVED') return 'Archivada';
  if (effectiveStatus === 'DELETED') return 'Borrada';
  return etiqueta;
}

/**
 * Lo que se activa con una campaña: la cascada de `statusCascadeIds` de CampanasBrowser para el
 * nivel campaña (sus conjuntos y los anuncios de esos conjuntos), porque activar SÓLO la campaña
 * deja a los hijos pausados y no entrega. Dos diferencias, las dos sin cambiar el resultado: no
 * se le escribe a lo que YA está activo (escritorio lo reescribe igual: un pedido de más a Meta
 * por hijo), ni a lo archivado o borrado (Meta lo rechaza). Así «Deshacer» pausa exactamente lo
 * que se prendió y nada más.
 */
export function hijosParaActivar(campId: string, adsets: ReadonlyArray<Nodo>, ads: ReadonlyArray<Nodo>): HijoM[] {
  const out: HijoM[] = [];
  const propios = new Set<string>();
  for (const a of adsets) {
    if (a.parentId !== campId) continue;
    propios.add(a.id);
    if (a.configuredStatus !== 'ACTIVE' && !MUERTO.has(a.effectiveStatus)) out.push({ nivel: 'adset', id: a.id });
  }
  for (const ad of ads) {
    if (!ad.parentId || !propios.has(ad.parentId)) continue;
    if (ad.configuredStatus !== 'ACTIVE' && !MUERTO.has(ad.effectiveStatus)) out.push({ nivel: 'ad', id: ad.id });
  }
  return out;
}

/**
 * ¿«Deshacer» una ACTIVACIÓN le escribe PAUSED a la campaña? Sólo si antes del toque no estaba configurada
 * ACTIVE. Una en revisión (IN_PROCESS) o con un anuncio rechazado (WITH_ISSUES) sale con el interruptor
 * apagado (`activa` es el effectiveStatus) aunque esté configurada ACTIVE: prenderla no le cambia nada a
 * Meta, y pausarla al deshacer la dejaba sin entregar cuando Meta terminara la revisión. Los hijos que se
 * prendieron se pausan igual (ésos sí estaban apagados).
 *
 * «Antes del toque» es lo último que ESTA pantalla le escribió, si todavía no lo confirmó una lectura
 * (`escritoAntes`, 1/0: el árbol cargado puede ser de antes de esa escritura); si no, el árbol.
 */
export function deshacerPausaLaCampana(configuradaActiva: boolean, escritoAntes: { valor: number } | undefined): boolean {
  const antes = escritoAntes ? escritoAntes.valor === 1 : configuradaActiva;
  return !antes;
}

/**
 * El aviso corto (toast) de una escritura que Meta o el guard no aceptaron. El detalle completo
 * (el `permMsg` de escritorio, con la 2FA del 4841013) va a la consola: un toast tiene 3-4 palabras.
 */
export function avisoDeFallo(status: number, j: { error?: string; error_subcode?: number } | null | undefined): string {
  if (j?.error_subcode === 4841013) return 'Meta bloqueó el cambio';
  if (status === 403 && j?.error) return 'Sin permiso para cambiarla';
  if (status === 409) return 'Meta no está conectado';
  return 'Meta lo rechazó';
}
