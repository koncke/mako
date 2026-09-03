// =============================================================================
// analisis-modelo — la ARITMÉTICA del análisis de negocio (puro, testeable)
// =============================================================================
// Sale de la reunión Mau <> Martín del 31/07/2026, donde miraron los datos en
// vivo durante tres horas. **Media reunión fue aritmética hecha con la
// calculadora del celular**, en voz alta, tres veces cada número — y quedaron
// dos discrepancias sin reconciliar (un CAC dicho como 630 y como 741). Todo lo
// que hay acá es esa cuenta, escrita una sola vez.
//
// SIN `server-only` a propósito (la regla de la casa): lo que decide un número
// que alguien va a usar para mover plata tiene que poder testearse, y un módulo
// que importa Supabase no se puede importar desde un test. El que LEE la base es
// `lib/analisis-negocio.ts`.
//
// LAS TRES REGLAS QUE VIENEN DE LO QUE SALIÓ MAL ESA TARDE:
//
//  1. **Todo número declara su RANGO.** El «histórico» del dashboard arrancaba
//     en noviembre del año anterior sin decirlo: las 76 agendas eran 57 y los 12
//     cierres eran 9, así que TODOS los costos unitarios estaban ~33% abajo. Se
//     descubrió porque un humano sumó los meses y no le dio. Acá eso es
//     `cuadratura()`, y corre siempre.
//  2. **Un denominador de cero no es un costo infinito: es «todavía no se sabe».**
//     Dividir sin datos produce un número que parece medición.
//  3. **Una exclusión se aplica al numerador Y al denominador.** Si se saca el
//     gasto de un mes fuera de patrón, se sacan también sus agendas. La regla la
//     enunció Martín a mano en la reunión; acá es del tipo.
// =============================================================================

import type { FilaMetricas } from './metricas-modelo';

/** Un escalón del embudo: cuántos llegaron y cuánto costó cada uno. */
export type Escalon = {
  /** Cómo lo nombra el negocio, no el esquema. */
  nombre: string;
  /** Cuántos. */
  cantidad: number;
  /**
   * Costo unitario en la moneda de la inversión. `null` cuando la cantidad es 0
   * —no hay costo que calcular— o cuando no se conoce la inversión.
   */
  costo_unitario: number | null;
  /**
   * El mismo costo en USD, para poder leerlo. Va aparte y NO reemplaza al de
   * arriba: el crudo es el que cobró Meta y el USD sale de un tipo de cambio
   * FIJO escrito a mano. «1.905» no le dice nada a nadie y «110 USD» sí, pero el
   * que se audita contra la factura es el primero.
   */
  costo_unitario_usd: number | null;
  /** Qué proporción del escalón anterior sobrevivió. `null` en el primero. */
  conversion_desde_anterior: number | null;
  /** De dónde sale el número, en una frase. Para que sea auditable. */
  fuente: string;
};

/**
 * La cascada completa. Es el esqueleto del análisis: los cinco números de la
 * reunión (inversión / agendas / asistencias / calificados / cierres) con el
 * costo de cada escalón.
 */
export type Cascada = {
  periodo: { desde: string; hasta: string };
  /** En la moneda de la cuenta publicitaria. Ver `moneda`. */
  inversion: number | null;
  /** La misma inversión en USD (tipo de cambio fijo). Derivado, no fuente. */
  inversion_usd: number | null;
  moneda: string;
  escalones: Escalon[];
  /** Ingreso del período (suma de los cierres con monto cargado). */
  ingreso_usd: number | null;
  /** Ingreso / inversión, ambos en USD. `null` si falta cualquiera de los dos. */
  roas: number | null;
  /** Lo que hay que saber para no leer mal un número. */
  advertencias: string[];
};

const redondo = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Costo unitario. **Un denominador de 0 devuelve `null`, nunca Infinity ni 0.**
 * «Cuánto me costó una agenda» cuando no hubo agendas no es infinito: es una
 * pregunta sin respuesta, y mostrar un número ahí es inventar una medición.
 */
export function costoPor(inversion: number | null, cantidad: number): number | null {
  if (inversion == null || !Number.isFinite(inversion)) return null;
  if (!cantidad || cantidad <= 0) return null;
  return redondo(inversion / cantidad);
}

/** Proporción entre dos escalones. Mismo criterio: sin denominador, `null`. */
export function tasa(de: number, a: number): number | null {
  if (!de || de <= 0) return null;
  return redondo(a / de, 4);
}

// ── El chequeo que salvó la reunión ──────────────────────────────────────────

export type Cuadratura = {
  /** El total que declara la fuente para todo el rango. */
  total: number;
  /** La suma de las partes (mes a mes, semana a semana). */
  suma_partes: number;
  diferencia: number;
  cuadra: boolean;
  /** Qué mirar si no cuadra. Vacío si cuadra. */
  nota: string;
};

/**
 * ¿La suma de las partes da el total?
 *
 * ⚠️ ESTE ES EL CHEQUEO MÁS VALIOSO DEL MÓDULO, y no es una intuición: es una
 * aserción. En la reunión del 31/07 el análisis entero iba a cerrar con números
 * falsos porque el «histórico» arrastraba meses de antes del rango que estaban
 * mirando. Lo cazó que Martín sumara los meses a mano y le diera distinto.
 *
 * Un agente puede correr esto SIEMPRE, en cada corte, y avisar. Si de todo el
 * análisis se implementa una sola cosa, es ésta.
 *
 * `tolerancia` existe por el redondeo de los decimales del gasto, no para tapar
 * diferencias: 1 unidad monetaria sobre miles. Una diferencia real es de otro
 * orden (en el caso medido, 76 contra 57).
 */
export function cuadratura(total: number, partes: number[], tolerancia = 1): Cuadratura {
  const suma = partes.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const dif = redondo(total - suma);
  const cuadra = Math.abs(dif) <= tolerancia;
  return {
    total: redondo(total),
    suma_partes: redondo(suma),
    diferencia: dif,
    cuadra,
    nota: cuadra ? '' :
      `El total declarado (${redondo(total)}) NO coincide con la suma de los períodos (${redondo(suma)}): sobran ${dif}. ` +
      'Casi siempre significa que el total incluye fechas de FUERA del rango pedido — un «histórico» cuya fecha de inicio no se ve. ' +
      'Todos los costos unitarios calculados con ese total están mal, y siempre para abajo. No uses el total: usa la suma.',
  };
}

// ── La calculadora inversa ───────────────────────────────────────────────────

export type MetaPlan = {
  /** Lo que el dueño decidió: cuántos cierres por mes quiere. */
  cierres_objetivo: number;
  /** Derivados de las tasas MEDIDAS, no de las deseadas. */
  asistencias_necesarias: number | null;
  agendas_necesarias: number | null;
  inversion_necesaria: number | null;
  /** Las tasas con las que se derivó, para que se pueda auditar. */
  supuestos: { show_rate: number | null; tasa_cierre: number | null; costo_por_agenda: number | null };
  /** Si el presupuesto propuesto NO alcanza para las agendas que hacen falta. */
  contradiccion: string;
};

/**
 * Desde la meta de cierres hacia atrás: cuántas asistencias, cuántas agendas y
 * cuánta inversión hacen falta.
 *
 * ⚠️ Y EL CHEQUEO DE CONSISTENCIA, que es lo que faltó en la reunión: ahí se
 * fijaron 1.500 USD/mes (derivado de «3 cierres × 500 de CAC objetivo») y al
 * mismo tiempo 27 agendas/mes — pero 27 agendas al costo real de ~100 USD
 * cuestan 2.700. **Las dos mitades del mismo plan se contradecían y nadie lo
 * marcó**, así que la contradicción se fue viva en el acuerdo. Acá se marca.
 *
 * Las tasas entran MEDIDAS. Derivar con la tasa que uno quisiera tener es
 * planificar sobre un negocio que no existe.
 */
export function planDesdeMeta(opts: {
  cierresObjetivo: number;
  showRate: number | null;
  tasaCierre: number | null;
  costoPorAgenda: number | null;
  presupuestoPropuesto?: number | null;
}): MetaPlan {
  const { cierresObjetivo, showRate, tasaCierre, costoPorAgenda } = opts;
  const asistencias = tasaCierre && tasaCierre > 0 ? Math.ceil(cierresObjetivo / tasaCierre) : null;
  const agendas = asistencias != null && showRate && showRate > 0 ? Math.ceil(asistencias / showRate) : null;
  const inversion = agendas != null && costoPorAgenda != null ? redondo(agendas * costoPorAgenda) : null;

  let contradiccion = '';
  const prop = opts.presupuestoPropuesto;
  if (inversion != null && prop != null && prop > 0 && inversion > prop * 1.1) {
    contradiccion =
      `El plan se contradice: para ${cierresObjetivo} cierres hacen falta ${agendas} agendas, y a ${costoPorAgenda} cada una eso son ${inversion} — ` +
      `pero el presupuesto propuesto es ${prop}. Con ${prop} salen ~${Math.floor(prop / (costoPorAgenda || 1))} agendas, que no alcanzan. ` +
      'O sube el presupuesto, o baja la meta, o primero hay que abaratar la agenda. Las tres son decisiones distintas.';
  }

  return {
    cierres_objetivo: cierresObjetivo,
    asistencias_necesarias: asistencias,
    agendas_necesarias: agendas,
    inversion_necesaria: inversion,
    supuestos: { show_rate: showRate, tasa_cierre: tasaCierre, costo_por_agenda: costoPorAgenda },
    contradiccion,
  };
}

// ── El ranking de creativos ──────────────────────────────────────────────────

export type Creativo = {
  ad_id: string;
  nombre: string;
  agendas: number;
  inversion: number;
  costo_por_agenda: number | null;
  impresiones: number;
  /** Días con actividad. No es «días desde que se publicó»: es en cuántos gastó. */
  dias_al_aire: number;
  primera_fecha: string;
  ultima_fecha: string;
};

/**
 * Ordena los creativos. El `criterio` NO es cosmético y es el hallazgo más caro
 * de la reunión:
 *
 * Dos creativos de abril trajeron **3 agendas cada uno**: uno a ~22 USD y otro a
 * ~100 USD. Ordenados por CANTIDAD son empate; ordenados por COSTO son cinco
 * veces distintos. El ranking que ordena por volumen y solo desempata por costo
 * esconde al ganador real — y el ganador real de esa tanda **nunca se replicó**
 * («de ese no hice réplica»), que era la acción más barata disponible.
 *
 * Por eso las dos vistas son de primera clase y el que llama elige.
 */
export function ordenarCreativos(
  creativos: Creativo[],
  criterio: 'volumen' | 'costo',
  minAgendas = 1,
): Creativo[] {
  const con = creativos.filter((c) => c.agendas >= minAgendas && c.costo_por_agenda != null);
  if (criterio === 'volumen') {
    return [...con].sort((a, b) => b.agendas - a.agendas || (a.costo_por_agenda ?? 0) - (b.costo_por_agenda ?? 0));
  }
  return [...con].sort((a, b) => (a.costo_por_agenda ?? 0) - (b.costo_por_agenda ?? 0) || b.agendas - a.agendas);
}

/**
 * Los creativos que el ranking por VOLUMEN esconde: baratos de verdad pero con
 * poco volumen, así que nunca aparecen arriba. Son los candidatos a replicar.
 *
 * La regla: cuesta menos que la mediana y trae al menos `minAgendas`. Se usa la
 * mediana y no el promedio porque un solo anuncio caro con mucho gasto arrastra
 * el promedio y deja de separar.
 */
export function creativosEscondidos(creativos: Creativo[], minAgendas = 2): Creativo[] {
  const con = creativos.filter((c) => c.agendas >= minAgendas && c.costo_por_agenda != null);
  if (con.length < 3) return [];
  const costos = con.map((c) => c.costo_por_agenda as number).sort((a, b) => a - b);
  const mediana = costos[Math.floor(costos.length / 2)];
  const topVolumen = new Set(ordenarCreativos(con, 'volumen', minAgendas).slice(0, 5).map((c) => c.ad_id));
  return ordenarCreativos(con, 'costo', minAgendas)
    .filter((c) => (c.costo_por_agenda as number) < mediana && !topVolumen.has(c.ad_id));
}

/** La mediana del costo por agenda, para poder decir «caro» o «barato» contra algo. */
export function medianaCosto(creativos: Creativo[]): number | null {
  const costos = creativos
    .map((c) => c.costo_por_agenda)
    .filter((c): c is number => c != null)
    .sort((a, b) => a - b);
  if (!costos.length) return null;
  return redondo(costos[Math.floor(costos.length / 2)]);
}

// ── Los tipos del análisis completo ──────────────────────────────────────────
// Viven acá y no en `analisis-negocio.ts` por la misma razón que todo lo demás
// de este archivo: para que el render y las reglas se puedan testear sin base.

/** El corte de calificación, con sus tres estados separados. */
export type Calificacion = {
  asistieron: number;
  calificados: number;
  no_calificados: number;
  /** ⚠️ NI SÍ NI NO: nadie lo marcó. Ver la advertencia. */
  sin_marcar: number;
  /** Qué contestaron en el formulario los que NO calificaban. Es lo que dice
   *  POR QUÉ no calificaban, y por lo tanto a quién hay que dejar de traer. */
  respuestas_no_calificados: Array<{ pregunta: string; respuestas: Record<string, number> }>;
};

export type AnalisisCreativos = {
  total_anuncios: number;
  con_agendas: number;
  mediana_costo_por_agenda: number | null;
  /** Los que más agendas trajeron. Es el ranking que se mira por reflejo. */
  top_volumen: Creativo[];
  /** Los más baratos por agenda. Es el ranking que decide dónde poner la plata. */
  top_costo: Creativo[];
  /** Baratos con poco volumen: los que el ranking por cantidad esconde. Son los
   *  candidatos a replicar, y es el hallazgo que la reunión encontró de casualidad. */
  escondidos: Creativo[];
  nota_fuente: string;
};

export type AnalisisNegocio = {
  periodo: { desde: string; hasta: string; zona: string };
  cascada: Cascada;
  /** El chequeo de integridad de cada lectura. */
  chequeos: Array<{ que: string } & Cuadratura>;
  tasas: {
    show_rate: number | null;
    no_show: number | null;
    tasa_cierre_sobre_asistencias: number | null;
    tasa_cierre_sobre_calificados: number | null;
    agendas_por_cierre: number | null;
  };
  calificacion: Calificacion;
  creativos: AnalisisCreativos;
  plan: MetaPlan | null;
  /** La serie mes a mes, para ver la forma y no solo el acumulado. */
  serie: FilaMetricas[];
  advertencias: string[];
};


// ── El render ────────────────────────────────────────────────────────────────

const pct = (v: number | null): string => (v == null ? '—' : `${Math.round(v * 100)}%`);
const money = (v: number | null, usd: number | null): string =>
  v == null ? '—' : usd == null ? String(v) : `${v} (~US$${usd})`;

/**
 * El análisis como texto. Es lo que lee un agente y lo que se puede pegar en un
 * mensaje — no una tabla de dashboard.
 *
 * ⚠️ EL ORDEN NO ES DECORATIVO: es la secuencia de la reunión. Primero qué pasó
 * (la cascada), después dónde se va la plata (los costos por escalón), después
 * la fuga barata (los que no calificaban), después qué replicar (los creativos) y
 * al final qué haría falta para la meta. Un informe que arranca por los creativos
 * invita a optimizar el anuncio cuando el agujero está en el show rate.
 *
 * Y las advertencias van ARRIBA, no al pie: si el 46% de las asistencias no tiene
 * la calificación marcada, eso hay que saberlo ANTES de leer el número, no
 * después de haber sacado una conclusión.
 */
export function analisisAMarkdown(a: AnalisisNegocio): string {
  const c = a.cascada;
  const L: string[] = [];

  L.push(`# El negocio entre ${a.periodo.desde} y ${a.periodo.hasta}`, '');

  if (a.advertencias.length) {
    L.push('## Antes de leer los números', '');
    for (const w of a.advertencias) L.push(`- ${w}`);
    L.push('');
  }

  L.push('## La cascada', '');
  L.push(`**Inversión:** ${money(c.inversion, c.inversion_usd)} · **Ingreso:** ${c.ingreso_usd == null ? '—' : `US$${c.ingreso_usd}`} · **ROAS:** ${c.roas == null ? '— (falta cargar el ingreso)' : `${c.roas}x`}`, '');
  L.push('| Escalón | Cuántos | Costo c/u | Sobrevive del anterior | De dónde sale |');
  L.push('|---|---:|---:|---:|---|');
  for (const e of c.escalones) {
    L.push(`| ${e.nombre} | ${e.cantidad} | ${money(e.costo_unitario, e.costo_unitario_usd)} | ${pct(e.conversion_desde_anterior)} | ${e.fuente} |`);
  }
  L.push('');
  L.push(`Show rate **${pct(a.tasas.show_rate)}** · no-show **${pct(a.tasas.no_show)}** · cierre sobre asistencias **${pct(a.tasas.tasa_cierre_sobre_asistencias)}** · hacen falta **${a.tasas.agendas_por_cierre ?? '—'} agendas por cada cierre**.`, '');

  L.push('## Los que asistieron y no calificaban', '');
  const k = a.calificacion;
  L.push(`De ${k.asistieron} asistencias: **${k.calificados} calificados**, ${k.no_calificados} no calificaban, ${k.sin_marcar} sin marcar.`, '');
  if (k.no_calificados > 0 && k.respuestas_no_calificados.length) {
    L.push('Qué contestaron los que NO calificaban:', '');
    for (const r of k.respuestas_no_calificados) {
      const det = Object.entries(r.respuestas).map(([v, n]) => `${v} (${n})`).join(' · ');
      L.push(`- **${r.pregunta}** — ${det}`);
    }
    L.push('');
  }

  L.push('## Los creativos', '');
  const cr = a.creativos;
  L.push(`${cr.total_anuncios} anuncios en el período, ${cr.con_agendas} trajeron al menos una agenda. Mediana: ${cr.mediana_costo_por_agenda ?? '—'} por agenda.`, '');
  L.push(`> ${cr.nota_fuente}`, '');
  if (cr.top_volumen.length) {
    L.push('**Los que más trajeron** (el ranking que se mira por reflejo):', '');
    for (const x of cr.top_volumen.slice(0, 5)) L.push(`- ${x.agendas} agendas a ${x.costo_por_agenda} c/u — ${x.nombre}`);
    L.push('');
  }
  if (cr.top_costo.length) {
    L.push('**Los más baratos por agenda** (el ranking que decide dónde va la plata):', '');
    for (const x of cr.top_costo.slice(0, 5)) L.push(`- ${x.costo_por_agenda} por agenda · ${x.agendas} agendas — ${x.nombre}`);
    L.push('');
  }
  if (cr.escondidos.length) {
    L.push('**Los que el ranking por cantidad esconde** — baratos con poco volumen. Son los candidatos a replicar, y es exactamente el que en la reunión se encontró de casualidad y nunca se había replicado:', '');
    for (const x of cr.escondidos) L.push(`- ${x.costo_por_agenda} por agenda · ${x.agendas} agendas · ${x.dias_al_aire} días al aire — ${x.nombre}`);
    L.push('');
  }

  if (a.plan) {
    const p = a.plan;
    L.push('## Para llegar a la meta', '');
    L.push(`Con las tasas MEDIDAS de este período, para **${p.cierres_objetivo} cierres** hacen falta **${p.asistencias_necesarias ?? '—'} asistencias**, **${p.agendas_necesarias ?? '—'} agendas** y **${p.inversion_necesaria ?? '—'} de inversión**.`, '');
    if (p.contradiccion) L.push(`⚠️ ${p.contradiccion}`, '');
  }

  L.push('## Mes a mes', '');
  L.push('| Mes | Inversión | Agendas | R1 hechas | Cierres | Ingreso |');
  L.push('|---|---:|---:|---:|---:|---:|');
  for (const f of a.serie) {
    L.push(`| ${f.periodo} | ${f.meta_inversion ?? '—'} | ${f.agendas_creadas} | ${f.j1_realizadas} | ${f.ganados} | ${f.ingreso_usd} |`);
  }
  L.push('');

  return `${L.join('\n')}\n`;
}
