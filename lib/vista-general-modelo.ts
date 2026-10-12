// =============================================================================
// vista-general-modelo — las decisiones PURAS de «la vista general»
// =============================================================================
// Lo comparten `/general` (escritorio) y el Today de MaKo Mobile (`/m/hoy`). Hasta el
// 11/10/2026 todo esto vivía ADENTRO de `app/general/page.tsx`, mezclado con el JSX: las
// seis reglas del semáforo, la guarda #165, el estado de las lámparas y la plata del
// objetivo. Una segunda pantalla que lo necesitara tenía dos caminos y los dos eran malos:
// importar la página (no se puede) o copiarlo (y la copia se queda vieja la primera vez que
// alguien toque una regla de un solo lado).
//
// SIN `server-only` A PROPÓSITO: no lee nada, recibe lo que `lib/vista-general.ts` ya leyó.
// Con eso tiene test (`tests/vista-general-modelo.test.ts`), y lo pueden importar los
// componentes cliente del móvil.
//
// ⚠️ DEVUELVE DATOS, NO VISTA. `armarAlertas` trae las cuotas crudas (con su `lead_id`), no
// el `DesgloseData` que dibuja el escritorio: cada pantalla arma lo suyo. El título y el
// detalle de cada alerta SÍ van, porque `elegirFoco` los usa como la acción y la razón de
// una alerta roja — y son el texto de escritorio, que el móvil puede usar o no.
//
// ⚠️ LOS `href` SON RUTAS DE ESCRITORIO (/integraciones, /marketing/salud,
// /dashboard?hoja=comercial…). El móvil los pasa por `rutaMovil()` (lib/movil-rutas.ts).
// =============================================================================

import { fmtUSD } from './format';
import { DIAS_J1_J2_ALERTA } from './config';
import { ES_PLATA, type MetricaObjetivo, type ProgresoQuarter } from './objectives-modelo';
import { estaPendiente, type EstadoTarea } from './todo-estados';
import { sinRecurrentes } from './plan-recurrentes';
import type { TareaParaFoco } from './focus';

// ─────────────────────────────────────────────────────────────────────────────
// Las alertas del semáforo
// ─────────────────────────────────────────────────────────────────────────────

export type NivelAlerta = 'rojo' | 'ambar' | 'verde';

/** Qué regla la produjo. Una pantalla que quiera su propio copy decide por esto, no por el título. */
export type TipoAlerta =
  | 'arranque-sin-leer'
  | 'arranque-pendiente'
  | 'meta-cuenta'
  | 'cuotas-vencidas'
  | 'cuotas-por-vencer'
  | 'tramo-r1-r2'
  | 'fatiga-creativo'
  | 'cierre-sano'
  | 'cierre-bajo';

/** Una cuota sin cobrar, cruda. Es la forma de `CuotaPendiente` (lib/pagos.ts). */
export type CuotaDeAlerta = {
  pago_id?: number;
  lead_id: number;
  lead_nombre: string;
  numero: number;
  monto_usd: number;
  fecha_esperada: string;
  /** Negativo = vencida hace N días; positivo = vence en N días. */
  dias: number;
};

export type AlertaGeneral = {
  tipo: TipoAlerta;
  nivel: NivelAlerta;
  /** El texto de escritorio. `elegirFoco` lo usa como LA acción cuando la alerta es roja. */
  titulo: string;
  detalle: string;
  /** ⚠️ Ruta de ESCRITORIO. El móvil la traduce con `rutaMovil()`. */
  href: string;
  hrefLabel: string;
  /** Sólo las de cuotas: las filas crudas, para que cada pantalla arme su lista. */
  cuotas?: CuotaDeAlerta[];
  /** Sólo las de cuotas: la suma de `monto_usd`. */
  totalUsd?: number;
};

/** La salud de la cuenta de Meta, sólo lo que la alerta usa (`MetaAccountHealth`). */
export type SaludMetaEntrada = {
  /** El `Semaforo` de lib/mako-gramatica.ts. Cualquier cosa que no sea verde es una alerta. */
  severidad: 'rojo' | 'ambar' | 'verde' | 'gris';
  statusLabel: string;
  /**
   * ⚠️ SE LLAMA «Mxn» Y NO ES MXN: es el saldo en la moneda de la CUENTA
   * (lib/meta-health.ts, `balance / 100`). La moneda real viaja en `currency`.
   */
  balanceMxn: number;
  currency: string;
  fundingCard: string | null;
  disableReasonLabel: string | null;
};

export type EntradaAlertas = {
  /**
   * Lo que el cliente postergó en el arranque. `null` = NO SE PUDO LEER, que no es «no
   * quedó nada pendiente»: con null sale la alerta ámbar que lo dice.
   */
  pendientesArranque: ReadonlyArray<{ que: string; ruta: string; donde: string }> | null;
  saludMeta: SaludMetaEntrada | null;
  cuotas: { vencidas: CuotaDeAlerta[]; porVencer: CuotaDeAlerta[] };
  tramo: { promedio: number | null; n: number };
  fatiga: ReadonlyArray<{ adset_name: string; frequency_7d: number; cpl_7d_usd: number; cpl_28d_usd: number }>;
  maduras: { tasa_cierre_madura: number | null; limpias: number } | null;
};

const PESO_NIVEL: Record<NivelAlerta, number> = { rojo: 0, ambar: 1, verde: 2 };

/**
 * El saldo de Meta, en la moneda de la CUENTA.
 *
 * ⚠️ BUG ARREGLADO EL 11/10/2026: el semáforo escribía «MXN» fijo, y `balanceMxn` viene en
 * la moneda de la cuenta (lib/meta-health.ts). Para una cuenta en dólares (ws13, ws14, ws15)
 * el monto era el correcto y la moneda escrita, mentira. El formato del número se dejó igual
 * para que una cuenta en pesos se lea exactamente como antes.
 */
export function saldoMeta(s: Pick<SaludMetaEntrada, 'balanceMxn' | 'currency'>): string {
  const moneda = (s.currency ?? '').trim().toUpperCase() || 'MXN';
  return `${s.balanceMxn.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${moneda}`;
}

/**
 * Las seis reglas del semáforo, en el orden de siempre, ordenadas por gravedad.
 *
 * Es el cuerpo que vivía en `app/general/page.tsx:180-281`, sin cambiar una regla ni una
 * palabra salvo la moneda de Meta. El orden de empuje importa: el sort es ESTABLE, así que a
 * igual nivel queda primero lo que se empujó primero — y `elegirFoco` toma la PRIMERA roja.
 */
export function armarAlertas(e: EntradaAlertas): AlertaGeneral[] {
  const alertas: AlertaGeneral[] = [];

  if (e.pendientesArranque === null) {
    alertas.push({
      tipo: 'arranque-sin-leer',
      nivel: 'ambar',
      titulo: 'No pude chequear qué te quedó pendiente del arranque',
      detalle: 'Puede que tengas una conexión sin terminar y no lo esté viendo. Revisa Integraciones.',
      href: '/integraciones', hrefLabel: 'Integraciones',
    });
  }
  for (const pend of e.pendientesArranque ?? []) {
    alertas.push({
      tipo: 'arranque-pendiente',
      nivel: 'ambar',
      titulo: `Te quedó pendiente: ${pend.que.toLowerCase()}`,
      detalle: 'Lo dejaste para después durante tu arranque. Mientras no esté, MaKo trabaja con la mitad de los datos de tu negocio.',
      href: pend.ruta, hrefLabel: pend.donde,
    });
  }

  const m = e.saludMeta;
  if (m && m.severidad !== 'verde') {
    const esRojo = m.severidad === 'rojo';
    const saldo = m.balanceMxn > 0
      ? `Adeudo ~${saldoMeta(m)}${m.fundingCard ? ` (${m.fundingCard})` : ''}. `
      : '';
    alertas.push({
      tipo: 'meta-cuenta',
      nivel: esRojo ? 'rojo' : 'ambar',
      titulo: esRojo
        ? `Cuenta de Meta: ${m.statusLabel} — entrega frenada`
        : `Cuenta de Meta: ${m.statusLabel} — vigilar`,
      detalle: esRojo
        ? `${saldo}Los anuncios figuran ACTIVOS pero la cuenta no está entregando${m.disableReasonLabel ? ` (${m.disableReasonLabel})` : ''}. Regulariza el pago en Meta cuanto antes.`
        : `Estado de cuenta "${m.statusLabel}". La entrega puede estar limitada — revisa el Business Manager.`,
      href: '/marketing/salud', hrefLabel: 'Estado de Meta',
    });
  }

  const { vencidas, porVencer } = e.cuotas;
  if (vencidas.length > 0) {
    const tot = vencidas.reduce((s, c) => s + c.monto_usd, 0);
    const n = vencidas.length;
    alertas.push({
      tipo: 'cuotas-vencidas',
      nivel: 'rojo',
      titulo: `${n} cuota${n === 1 ? '' : 's'} VENCIDA${n === 1 ? '' : 'S'} — cobrar URGENTE (${fmtUSD(tot)})`,
      detalle: `Pagos vencidos sin cobrar (ej: ${vencidas[0].lead_nombre}, ${Math.abs(vencidas[0].dias)}d de atraso). Cóbralos cuanto antes.`,
      href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
      cuotas: vencidas, totalUsd: tot,
    });
  }
  if (porVencer.length > 0) {
    const n = porVencer.length;
    const tot = porVencer.reduce((s, c) => s + c.monto_usd, 0);
    alertas.push({
      tipo: 'cuotas-por-vencer',
      nivel: 'ambar',
      titulo: `${n} cuota${n === 1 ? '' : 's'} por cobrar pronto`,
      detalle: `Vencen en los próximos días (ej: ${porVencer[0].lead_nombre}, en ${porVencer[0].dias}d). Ten listo el seguimiento de cobro.`,
      href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
      cuotas: porVencer, totalUsd: tot,
    });
  }

  const t = e.tramo;
  if (t.n >= 3 && t.promedio !== null && t.promedio > DIAS_J1_J2_ALERTA) {
    alertas.push({
      tipo: 'tramo-r1-r2',
      nivel: 'ambar',
      titulo: `Los deals se enfrían entre R1 y R2 (${t.promedio.toFixed(1)} días prom.)`,
      detalle: 'Cuanto más tarda la R2, más cae la intención. Agenda la R2 en la misma R1, en vivo.',
      href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
    });
  }

  for (const a of e.fatiga) {
    alertas.push({
      tipo: 'fatiga-creativo',
      nivel: 'ambar',
      titulo: `Posible fatiga de creativo · ${a.adset_name}`,
      detalle: `Frecuencia 7d ${a.frequency_7d.toFixed(1)} y el costo por lead subió (${fmtUSD(a.cpl_7d_usd)} vs ${fmtUSD(a.cpl_28d_usd)} a 28 días). Rota el creativo.`,
      href: '/dashboard?hoja=marketing', hrefLabel: 'Marketing',
    });
  }

  const md = e.maduras;
  if (md && md.tasa_cierre_madura !== null && md.limpias >= 3) {
    if (md.tasa_cierre_madura >= 30) {
      alertas.push({
        tipo: 'cierre-sano',
        nivel: 'verde',
        titulo: 'El sistema de venta está sano',
        detalle: 'El ratio de cierre maduro es saludable. Para más cierres, el foco es marketing: más volumen o mejor calidad.',
        href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
      });
    } else if (md.tasa_cierre_madura < 20) {
      alertas.push({
        tipo: 'cierre-bajo',
        nivel: 'rojo',
        titulo: `Tasa de cierre baja: ${md.tasa_cierre_madura.toFixed(0)}% en cohortes maduras`,
        detalle: 'Califican pero no cierran. Revisa la oferta y el manejo de objeciones en la R2.',
        href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
      });
    }
  }

  return alertas.sort((a, b) => PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel]);
}

// ─────────────────────────────────────────────────────────────────────────────
// #165 — ¿alguna fuente entregó un dato alguna vez?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que se sabe de las fuentes de datos del negocio.
 *
 *  · `con-datos`  — al menos una entregó un dato alguna vez. Sólo con esto se puede opinar.
 *  · `sin-datos`  — se leyeron y ninguna entregó nada. Es la #165: «conecta una fuente».
 *  · `sin-leer`   — NO SE PUDIERON LEER. No es «no hay fuentes» ni «hay fuentes»: es «no sé».
 *
 * ⚠️ SE MIRA `lastSync`, NUNCA `status` (docs/hallazgos-objectives.md, «Dos de las cinco
 * fuentes dicen "stale" cuando nunca hubo un dato»): `calendly` y `vsl_beacon` devuelven
 * `'stale'` sin un solo dato.
 *
 * ⚠️ Y LA LECTURA CAÍDA ES «NO SÉ». BUG ARREGLADO EL 11/10/2026: la página hacía
 * `fuentes = []` cuando `getDataSources()` fallaba, y `fuentes.length > 0 && …` daba
 * `sinFuentes = false` — o sea que una lectura caída APAGABA la guarda y dejaba al semáforo
 * certificar el verde. La guarda se escribe en POSITIVO: se puede opinar sólo si hay al
 * menos una fuente que entregó algo.
 */
export type EstadoFuentes = 'con-datos' | 'sin-datos' | 'sin-leer';

export type FuenteEntrada = { lastSync: string | null; error?: string };

export function estadoFuentes(fuentes: ReadonlyArray<FuenteEntrada> | null): EstadoFuentes {
  if (fuentes === null) return 'sin-leer';
  if (fuentes.some((f) => f.lastSync !== null)) return 'con-datos';
  // Ninguna con datos, pero alguna no se pudo LEER: no se puede afirmar que no tenga datos.
  if (fuentes.some((f) => !!f.error)) return 'sin-leer';
  return 'sin-datos';
}

/** `true` = NO se puede opinar del negocio (sin datos, o sin poder leerlas). Es lo que apaga el verde. */
export function sinFuentesDeDatos(fuentes: ReadonlyArray<FuenteEntrada> | null): boolean {
  return estadoFuentes(fuentes) !== 'con-datos';
}

// ─────────────────────────────────────────────────────────────────────────────
// La lámpara — el estado del negocio en un vistazo
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoLampara = 'rojo' | 'ambar' | 'verde' | 'apagado';

/**
 * ¿El objetivo principal va por debajo de lo esperado a esta altura?
 *
 * Sólo se afirma cuando el avance se pudo LEER: con `actual === null` no se sabe si va
 * atrasado, y no saberlo no es ir mal.
 */
export function objetivoAtrasado(o: { actual: number | null; ritmo?: { alDia: boolean } | null } | null): boolean {
  return o !== null && o.actual !== null && o.ritmo?.alDia === false;
}

/** Cuántas urgentes y cuántas para vigilar. El objetivo atrasado suma a «vigilar» sin ser una fila. */
export function contarSemaforo(
  alertas: ReadonlyArray<{ nivel: NivelAlerta }>,
  atrasado: boolean,
): { urgentes: number; vigilar: number } {
  return {
    urgentes: alertas.filter((a) => a.nivel === 'rojo').length,
    vigilar: alertas.filter((a) => a.nivel === 'ambar').length + (atrasado ? 1 : 0),
  };
}

/**
 * El color de la lámpara.
 *
 * ⚠️ MIRA TODAS LAS ALERTAS, no las que quedan en la lista: con una sola roja —que por serlo
 * sube al titular— la lista queda vacía y la lámpara tiene que seguir roja.
 * ⚠️ `apagado` le gana a todo (#165): sin datos, ni siquiera el rojo se sostiene.
 * ⚠️ El objetivo atrasado APAGA EL VERDE y prende el ámbar (medido en ws13: «vas $15.217
 * abajo» arriba y la lámpara verde abajo).
 */
export function estadoLampara(
  alertas: ReadonlyArray<{ nivel: NivelAlerta }>,
  sinFuentes: boolean,
  atrasado: boolean,
): EstadoLampara {
  if (sinFuentes) return 'apagado';
  const { urgentes, vigilar } = contarSemaforo(alertas, atrasado);
  if (urgentes > 0) return 'rojo';
  if (vigilar > 0) return 'ambar';
  return 'verde';
}

// ─────────────────────────────────────────────────────────────────────────────
// La plata del objetivo — lo cobrado y lo firmado del mismo período
// ─────────────────────────────────────────────────────────────────────────────

export type PlataDelObjetivo<T extends { monto: number }> = {
  /** true = el objetivo mide lo COBRADO; sus «propios» son los pagos y los «otros», lo firmado. */
  esCash: boolean;
  propios: T[];
  otros: T[];
  totalPropios: number;
  totalOtros: number;
};

/**
 * Parte el desglose de ingresos del período en lo del objetivo y su complemento.
 *
 * `null` si el objetivo no es de plata: colgar una lista de montos de un objetivo que cuenta
 * reuniones abriría dinero debajo de un número que no lo es.
 */
export function plataDelObjetivo<T extends { monto: number }>(
  metrica: MetricaObjetivo,
  br: { cash: T[]; sold: T[] },
): PlataDelObjetivo<T> | null {
  if (!ES_PLATA(metrica)) return null;
  const esCash = metrica === 'cash_usd';
  const propios = esCash ? br.cash : br.sold;
  const otros = esCash ? br.sold : br.cash;
  const suma = (xs: T[]) => xs.reduce((s, i) => s + i.monto, 0);
  return { esCash, propios, otros, totalPropios: suma(propios), totalOtros: suma(otros) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los leads sin marcar — «al día» sólo si se pudo leer todo
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoPendientes = 'por-marcar' | 'sin-confirmar' | 'al-dia';

/**
 * Qué puede afirmar la tarjeta de pendientes.
 *
 * ⚠️ BUG ARREGLADO EL 11/10/2026: la tarjeta decía «Datos al día — el tablero es confiable»
 * con `total === 0` aunque `aviso` dijera que una lectura falló (el plan de pagos, las
 * respuestas de R2). `aviso` existe JUSTO para evitar ese falso all-clear
 * (lib/queries.ts, `Pendientes.aviso`). Con `total > 0` el número se muestra igual —lo que
 * se leyó es cierto— y el aviso va al lado, porque la lista puede estar incompleta.
 */
export function estadoPendientes(p: { total: number; aviso?: string }): EstadoPendientes {
  if (p.total > 0) return 'por-marcar';
  return (p.aviso ?? '').trim() ? 'sin-confirmar' : 'al-dia';
}

// ─────────────────────────────────────────────────────────────────────────────
// El tiempo — dónde cae la marca de la barra del objetivo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Qué fracción de un rango ya se consumió a la fecha `hoy`, contando hoy. 0..1.
 *
 * Es la misma cuenta que `recalcularProgreso` (lib/objectives.ts, privada): días enteros,
 * inclusive en las dos puntas. Vivía en `app/general/Cabecera.tsx`.
 */
export function fraccionDeRango(desde: string, hasta: string, hoy: string): number {
  const dia = 86_400_000;
  const d0 = Date.parse(`${desde}T00:00:00Z`);
  const d1 = Date.parse(`${hasta}T00:00:00Z`);
  const h = Date.parse(`${hoy}T00:00:00Z`);
  if (!Number.isFinite(d0) || !Number.isFinite(d1) || !Number.isFinite(h) || d1 <= d0) return 0;
  const total = (d1 - d0) / dia + 1;
  const corridos = Math.max(0, Math.min(total, (h - d0) / dia + 1));
  return corridos / total;
}

/**
 * Dónde cae la marca del tiempo en la barra del objetivo.
 *
 * Para uno del TRIMESTRE es la fracción del trimestre; para uno ANUAL, la del año.
 *
 * ⚠️ BUG ARREGLADO EL 11/10/2026: la cabecera le pasaba a `fraccionDeRango` el FIN del
 * trimestre (`progreso.hasta`) como si fuera hoy, así que la marca de un objetivo anual caía
 * en el último día del trimestre en curso (en Q4, al 100% del año). Sin efecto visible ese
 * día: no había un solo objetivo anual en la base.
 */
export function fraccionDelObjetivo(
  o: { quarter: number | null; desde: string; hasta: string } | null,
  progreso: Pick<ProgresoQuarter, 'fraccion'>,
  hoy: string,
): number {
  if (o === null) return 0;
  return o.quarter !== null ? progreso.fraccion : fraccionDeRango(o.desde, o.hasta, hoy);
}

/** El día anterior a `hoy` (YYYY-MM-DD). El resumen del mes se lee hasta AYER: hoy está a medio correr. */
export function ayerDe(hoy: string): string {
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// El plan — qué tareas compiten por ser «la acción»
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las tareas del tablero del DUEÑO (`plan_tareas`, `BoardTask`) que pueden ser la acción.
 *
 * Abiertas (`progress < 100`) y sin las recurrentes: una tarea que se repite para siempre no
 * compite por un puesto (lib/plan-recurrentes.ts). El tablero del dueño no tiene `no_cumple`.
 */
export function tareasDelDuenoParaFoco(
  ts: ReadonlyArray<{ title: string; score: number; progress: number; deadline: string; recurrente?: boolean }>,
): TareaParaFoco[] {
  return sinRecurrentes(ts.filter((t) => t.progress < 100)).map((t) => ({
    titulo: t.title, score: t.score, progreso: t.progress, deadline: t.deadline || null,
    // Fijo en null como el del cliente: el href del foco de plan es `/plan`.
    haceloEn: null, recurrente: t.recurrente === true,
  }));
}

/**
 * Las tareas del tablero del CLIENTE (`experimento_tareas`, `Tarea`) que pueden ser la acción.
 *
 * Pendientes (`estaPendiente`: ni `hecho` ni `no_cumple`, que es lo que el criterio no dejó
 * pasar) y sin las recurrentes.
 */
export function tareasDelClienteParaFoco(
  ts: ReadonlyArray<{ titulo: string; score: number; progreso: number; deadline: string | null; estado: EstadoTarea; recurrente?: boolean }>,
): TareaParaFoco[] {
  return sinRecurrentes(ts.filter((t) => estaPendiente(t.estado))).map((t) => ({
    titulo: t.titulo, score: t.score, progreso: t.progreso, deadline: t.deadline,
    haceloEn: null, recurrente: t.recurrente === true,
  }));
}
