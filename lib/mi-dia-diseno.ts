// =============================================================================
// mi-dia-diseno — lo que dibuja la hoja «Mi día» con su DISEÑO PROPIO (la copia de Lumora), sacado de los datos de General
// =============================================================================
// Martín, 4/11/2026: «Carga los de FOCUS que ya teníamos». Focus tenía dos referencias: Pane (la hoja Focus,
// lib/focus-diseno.ts) y Lumora, que es ésta. La copia y la adaptación están en docs/diseno/mockups-dashboard/focus-lumora/;
// acá, de dónde sale cada número con los DATOS REALES (`DatosGeneral`, app/general/datos.ts):
//   · el hero: la fecha y la semana del trimestre, cuántas llamadas y tareas hay hoy, lo que urge (cuotas vencidas) y la
//     CINTA del día (lo de hoy en el Calendario, con los huecos libres y la línea del ahora);
//   · los cuatro números: las llamadas de hoy, las tareas de hoy, las cuotas por cobrar y los KPIs del día en verde. La
//     barrita es el `meter` de Lumora: la serie de esos números no se guarda, así que la línea de Lumora no se dibuja;
//   · lo que vence (el Plan), tu funnel hoy (las etapas del principal), los OKRs contra lo esperado a hoy, los que te deben
//     (las cuotas), el semáforo (sus alertas), el mes (lo que tiene el Calendario), tu día y los recordatorios.
//
// LO QUE LUMORA TIENE Y MaKo NO MIDE NO SE INVENTA: la línea de cada número, el selector «Scores · Attendance» (cada OKR
// tiene una sola vara) y el sobre de la lista de vigilancia (un mensaje a un tercero sale por sus puertas).
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaMiDia.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { DatosGeneral } from '@/app/general/datos-tipos';
import type { ItemCalendario } from './calendario-modelo';
import type { CobroM } from '@/app/m/dashboard/modelo';
import { cuandoVence, diaEnZona, enCuanto, horaEn, tareaFocus, type TareaFocus } from './focus-diseno';

export type TonoMiDia = 'sky' | 'pine' | 'clay' | 'lemon';
/** Un bloque de la cinta del día: un evento, o un hueco libre de una hora o más (`libre`), o una pausa corta (`pausa`). */
export type BloqueCinta =
  | { tipo: 'evento'; id: string; titulo: string; detalle: string; hora: string; inicio: number; fin: number; tono: TonoMiDia; estado: 'paso' | 'ahora' | 'viene'; href: string | null;
      /** La hora de fin, sólo si el evento la tiene (sin fin dura 30 minutos en la cinta, pero esa hora no se escribe). */
      hasta: string | null }
  | { tipo: 'libre'; id: string; desde: string; dura: string; inicio: number; fin: number }
  | { tipo: 'pausa'; id: string; inicio: number; fin: number };
export type NumeroMiDia = { id: 'llamadas' | 'tareas' | 'cobros' | 'kpis'; titulo: string; valor: number | null; meter: number; pie: string; destacado: string | null };
export type VenceMiDia = { id: string; titulo: string; detalle: string; mes: string; dia: number; tono: 'coral' | 'marigold' | 'pine' | 'clay'; href: string };
export type EtapaMiDia = { nombre: string; n: number };
export type OkrMiDia = { titulo: string; avance: number; esperado: number };
export type AlertaMiDia = { titulo: string; link: string; href: string; nivel: 'rojo' | 'ambar' | 'verde' };
export type DiaMes = { dia: string; n: number; fuera: boolean; finde: boolean; hoy: boolean; puntos: TonoMiDia[] };
export type RecordatorioMiDia = { id: string; titulo: string; detalle: string; tono: TonoMiDia | 'marigold'; href: string };

export type VistaMiDia = {
  semana: string | null;
  resumen: { llamadas: number | null; tareas: number | null; vencidas: number | null };
  cinta: BloqueCinta[] | null;
  /** La próxima llamada de hoy (la que abre su ficha): null = no hay o no se pudo leer. */
  proxima: { titulo: string; hora: string; href: string | null } | null;
  numeros: NumeroMiDia[];
  vence: VenceMiDia[] | null;
  /** El funnel principal: sus etapas con gente (con «Sin etapa» y, pasadas las cuatro, «Otras»: la dona suma el total). */
  funnel: { id: number; nombre: string; principal: boolean; total: number; etapas: EtapaMiDia[] } | null;
  okrs: OkrMiDia[] | null;
  deben: CobroM[] | null;
  semaforo: AlertaMiDia[] | null;
  mes: { titulo: string; dias: DiaMes[] } | null;
  dia: Extract<BloqueCinta, { tipo: 'evento' }>[] | null;
  recordatorios: RecordatorioMiDia[] | null;
  /** Las tareas de hoy sin cerrar (las que se tildan en «Recordatorios»). */
  aTildar: TareaFocus[] | null;
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MIN = 60_000;
const sumarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** El tono de un renglón del Calendario: las llamadas en verde, lo del Plan en amarillo, lo publicado en arcilla; lo demás, cielo. */
export function tonoDe(i: Pick<ItemCalendario, 'fuente' | 'capa'>): TonoMiDia {
  if (i.fuente === 'crm') return 'pine';
  if (i.fuente === 'plan' || i.fuente === 'objetivo') return 'lemon';
  if (i.capa === 'publicaciones') return 'clay';
  return 'sky';
}

/** «1 h 15 min», «45 min». */
export function duracion(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/**
 * La cinta del día: lo de hoy en el Calendario en orden, y entre dos eventos el hueco: «Libre» si es de una hora o más, una
 * pausa si es de 15 minutos o más. Lo de día completo no va en la cinta (no tiene hora). Un evento sin fin dura 30 minutos.
 */
export function cintaDelDia(items: readonly ItemCalendario[], hoy: string, tz: string, ahora: number): BloqueCinta[] {
  const eventos = items
    .filter((i) => !i.diaCompleto && diaEnZona(i.inicio, tz) === hoy)
    .map((i) => {
      const inicio = new Date(i.inicio).getTime();
      const fin = i.fin ? new Date(i.fin).getTime() : inicio + 30 * MIN;
      return { i, inicio, fin: Math.max(fin, inicio) };
    })
    .sort((a, b) => a.inicio - b.inicio);
  const out: BloqueCinta[] = [];
  let finAnterior: number | null = null;
  for (const { i, inicio, fin } of eventos) {
    if (finAnterior != null && inicio - finAnterior >= 60 * MIN) {
      out.push({ tipo: 'libre', id: `libre-${finAnterior}`, desde: horaEn(new Date(finAnterior).toISOString(), tz), dura: duracion((inicio - finAnterior) / MIN), inicio: finAnterior, fin: inicio });
    } else if (finAnterior != null && inicio - finAnterior >= 15 * MIN) {
      out.push({ tipo: 'pausa', id: `pausa-${finAnterior}`, inicio: finAnterior, fin: inicio });
    }
    const estado = fin <= ahora ? 'paso' : inicio <= ahora ? 'ahora' : 'viene';
    out.push({ tipo: 'evento', id: i.id, titulo: i.titulo, detalle: i.detalle ?? '', hora: horaEn(i.inicio, tz), inicio, fin, tono: tonoDe(i), estado, href: i.href, hasta: i.fin ? horaEn(i.fin, tz) : null });
    finAnterior = Math.max(finAnterior ?? fin, fin);
  }
  return out;
}

/** El mes de hoy en una grilla de lunes a domingo, con hasta tres puntos por día (lo que tiene el Calendario). */
export function mesDe(items: readonly ItemCalendario[], hoy: string, tz: string): { titulo: string; dias: DiaMes[] } {
  const primero = `${hoy.slice(0, 7)}-01`;
  const d1 = new Date(`${primero}T12:00:00Z`);
  const inicio = sumarDias(primero, -((d1.getUTCDay() + 6) % 7));
  const porDia = new Map<string, TonoMiDia[]>();
  for (const i of items) {
    const dia = diaEnZona(i.inicio, tz);
    const l = porDia.get(dia) ?? [];
    l.push(tonoDe(i));
    porDia.set(dia, l);
  }
  const dias: DiaMes[] = [];
  for (let n = 0; n < 42; n++) {
    const dia = sumarDias(inicio, n);
    // Una fila nueva que ya es del mes siguiente no se dibuja: la grilla tiene las semanas que el mes toca, completas.
    if (n % 7 === 0 && dia.slice(0, 7) > hoy.slice(0, 7)) break;
    const tonos = porDia.get(dia) ?? [];
    dias.push({ dia, n: Number(dia.slice(8, 10)), fuera: dia.slice(0, 7) !== hoy.slice(0, 7), finde: n % 7 >= 5, hoy: dia === hoy, puntos: [...new Set(tonos)].slice(0, 3) });
  }
  return { titulo: `${MESES_LARGOS[Number(hoy.slice(5, 7)) - 1]} ${hoy.slice(0, 4)}`, dias };
}

/**
 * Las etapas de la dona: las que tienen gente, en el orden del funnel, más «Sin etapa» si hay leads en una etapa que el funnel
 * ya no tiene. Pasadas las cuatro, las tres primeras y «Otras» con el resto: los tramos suman siempre el total del centro.
 */
export function etapasDeLaDona(c: { etapas: ReadonlyArray<{ label: string; n: number }>; sinEtapa: number; total: number }): EtapaMiDia[] {
  const con = c.etapas.filter((e) => e.n > 0).map((e) => ({ nombre: e.label, n: e.n }));
  if (c.sinEtapa > 0) con.push({ nombre: 'Sin etapa', n: c.sinEtapa });
  if (con.length <= 4) return con;
  const tres = con.slice(0, 3);
  return [...tres, { nombre: 'Otras', n: c.total - tres.reduce((s, e) => s + e.n, 0) }];
}

/** Un pedazo de la frase de arriba: texto, una cifra en negrita o un link. */
export type TrozoResumen = { tipo: 'texto' | 'fuerte'; s: string } | { tipo: 'link'; s: string; href: string };

/**
 * La frase del hero: «Tienes 3 llamadas hoy y 5 tareas que vencen.» Lo que no se pudo leer no se nombra (no es un cero);
 * si no se pudo leer nada, se dice.
 */
export function resumenDelDia(r: VistaMiDia['resumen']): TrozoResumen[] {
  const { llamadas: ll, tareas: ta } = r;
  if (ll == null && ta == null) return [{ tipo: 'texto', s: 'No pude leer tu calendario ni tu Plan.' }];
  const llamadas = ll == null ? null : ll === 1 ? '1 llamada' : `${ll} llamadas`;
  const tareas = ta == null ? null : ta === 1 ? '1 tarea que vence' : `${ta} tareas que vencen`;
  if (!ll && !ta) {
    if (ll === 0 && ta === 0) return [{ tipo: 'texto', s: 'Hoy no tienes llamadas ni tareas que venzan.' }];
    return [{ tipo: 'texto', s: ll === 0 ? 'Hoy no tienes llamadas.' : 'Hoy no te vence ninguna tarea.' }];
  }
  const out: TrozoResumen[] = [{ tipo: 'texto', s: 'Tienes ' }];
  if (ll) out.push({ tipo: 'fuerte', s: llamadas! }, { tipo: 'texto', s: ' hoy' });
  if (ll && ta) out.push({ tipo: 'texto', s: ' y ' });
  if (ta) out.push({ tipo: 'link', s: tareas!, href: '/plan' }, { tipo: 'texto', s: ll ? '' : ' hoy' });
  out.push({ tipo: 'texto', s: '.' });
  return out;
}

/** Todo lo que dibuja la hoja, de los datos de General. `ahora`: el reloj. */
export function vistaMiDia(d: DatosGeneral, ahora: number): VistaMiDia {
  const plan = d.plan.ok ? d.plan.d : null;
  const cal = d.calendario.ok ? d.calendario.d : null;
  const hoy = plan?.hoy ?? cal?.hoy ?? new Date(ahora).toISOString().slice(0, 10);
  const tz = cal?.tz ?? 'UTC';
  const cab = d.cabecera.ok ? d.cabecera.d : null;
  const cobros = d.cobranza.ok ? d.cobranza.d.cobros : null;

  const cinta = cal ? cintaDelDia(cal.items, hoy, tz, ahora) : null;
  const eventos = cinta ? cinta.filter((b): b is Extract<BloqueCinta, { tipo: 'evento' }> => b.tipo === 'evento') : null;
  const llamadas = eventos ? eventos.filter((e) => cal!.items.find((i) => i.id === e.id)?.fuente === 'crm') : null;
  // La próxima es la que todavía no empezó: la que está corriendo ya se ve en la cinta y en «Tu día», con «Ahora».
  const proximaLlamada = llamadas?.find((e) => e.estado === 'viene') ?? null;

  const deHoySinCerrar = plan ? plan.deadlines.tareas.filter((t) => t.deadline === hoy && t.progress < 100) : null;
  const vencidasCobro = cobros ? cobros.filter((c) => c.urgencia === 'vencida').length : null;
  const diarios = d.kpis.ok ? d.kpis.d.kpis.filter((k) => k.cadencia === 'diaria') : null;
  const verdes = diarios ? diarios.filter((k) => k.estado === 'verde').length : null;
  const frac = (v: number, de: number) => (de > 0 ? Math.max(0, Math.min(1, v / de)) : 0);

  const numeros: NumeroMiDia[] = [
    {
      id: 'llamadas', titulo: 'Llamadas hoy', valor: llamadas?.length ?? null,
      meter: llamadas ? frac(llamadas.filter((e) => e.estado === 'paso').length, llamadas.length) : 0,
      pie: proximaLlamada ? 'Próxima:' : llamadas ? 'No te quedan llamadas hoy' : 'No pude leer el calendario',
      // La hora primero: en el ancho de la tarjeta, lo que se corta es el final del título, nunca la hora.
      destacado: proximaLlamada ? `${proximaLlamada.hora} · ${proximaLlamada.titulo}` : null,
    },
    {
      id: 'tareas', titulo: 'Tareas de hoy', valor: plan ? plan.deHoy.total : null,
      meter: plan ? frac(plan.deHoy.cerradas, plan.deHoy.total) : 0,
      pie: plan ? `${plan.deHoy.cerradas} ${plan.deHoy.cerradas === 1 ? 'hecha' : 'hechas'}` : 'No pude leer el Plan',
      destacado: plan && plan.vencidas ? `${plan.vencidas} ${plan.vencidas === 1 ? 'vencida' : 'vencidas'}` : null,
    },
    {
      id: 'cobros', titulo: 'Cuotas por cobrar', valor: cobros?.length ?? null,
      meter: cobros ? frac(vencidasCobro ?? 0, cobros.length) : 0,
      pie: cobros ? `De ${new Set(cobros.map((c) => c.leadId)).size} ${new Set(cobros.map((c) => c.leadId)).size === 1 ? 'cliente' : 'clientes'}` : 'No pude leer los cobros',
      destacado: vencidasCobro ? `${vencidasCobro} ${vencidasCobro === 1 ? 'vencida' : 'vencidas'}` : null,
    },
    {
      id: 'kpis', titulo: 'KPIs del día', valor: verdes,
      meter: diarios ? frac(verdes ?? 0, diarios.length) : 0,
      pie: diarios ? (diarios.length ? `En verde, de ${diarios.length}` : 'Todavía no tienes KPIs diarios') : 'No pude leer los KPIs',
      destacado: null,
    },
  ];

  let vence: VistaMiDia['vence'] = null;
  if (plan) {
    const tareas = plan.deadlines.tareas.filter((t) => t.deadline).map((t) => {
      const f = tareaFocus(t, plan.etiquetas, hoy);
      const tono: VenceMiDia['tono'] = t.deadline < hoy ? 'coral' : t.deadline === hoy ? 'marigold' : 'pine';
      return { fecha: t.deadline, v: { id: t.id, titulo: t.title, detalle: [f.proyecto?.nombre, cuandoVence(t.deadline, hoy), t.deadline < hoy ? 'Vencida' : null].filter(Boolean).join(' · '), mes: MESES[Number(t.deadline.slice(5, 7)) - 1], dia: Number(t.deadline.slice(8, 10)), tono, href: `/plan?tarea=${encodeURIComponent(t.id)}` } };
    });
    const proyectos = plan.deadlines.proyectos.filter((l) => l.deadline).map((l) => ({
      fecha: l.deadline!, v: { id: `p-${l.id}`, titulo: l.name, detalle: `Proyecto · ${cuandoVence(l.deadline, hoy)}`, mes: MESES[Number(l.deadline!.slice(5, 7)) - 1], dia: Number(l.deadline!.slice(8, 10)), tono: 'clay' as const, href: `/plan?proyecto=${encodeURIComponent(l.id)}` },
    }));
    vence = [...tareas, ...proyectos].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 5).map((x) => x.v);
  }

  let funnel: VistaMiDia['funnel'] = null;
  if (d.funnels.ok) {
    const f = d.funnels.d.find((x) => x.principal) ?? d.funnels.d[0];
    if (f?.conteo) funnel = { id: f.id, nombre: f.nombre, principal: f.principal, total: f.conteo.total, etapas: etapasDeLaDona(f.conteo) };
  }

  const okrs = d.okrs.ok
    ? d.okrs.d.lista.filter((o) => o.pct != null).slice(0, 4).map((o) => ({ titulo: o.titulo, avance: Math.round(Math.max(0, Math.min(100, o.pct!))), esperado: Math.round(Math.max(0, Math.min(1, o.fraccion)) * 100) }))
    : null;

  const deben = cobros ? [...cobros].sort((a, b) => rangoUrgencia(a.urgencia) - rangoUrgencia(b.urgencia)).slice(0, 3) : null;
  const semaforo = d.semaforo.ok ? d.semaforo.d.alertas.slice(0, 4).map((a) => ({ titulo: a.titulo, link: a.hrefLabel, href: a.href, nivel: a.nivel })) : null;

  let recordatorios: VistaMiDia['recordatorios'] = null;
  if (cal || plan) {
    recordatorios = [];
    if (proximaLlamada) recordatorios.push({ id: 'proxima', titulo: proximaLlamada.titulo, detalle: `Empieza ${enCuanto(new Date(proximaLlamada.inicio).toISOString(), ahora)}`, tono: 'sky', href: proximaLlamada.href ?? '/calendario' });
    if (plan && plan.vencidas > 0) {
      const vieja = plan.deadlines.tareas.filter((t) => t.deadline && t.deadline < hoy).map((t) => t.deadline).sort()[0];
      recordatorios.push({ id: 'vencidas', titulo: `${plan.vencidas} ${plan.vencidas === 1 ? 'tarea vencida' : 'tareas vencidas'}`, detalle: vieja ? `La más vieja, del ${Number(vieja.slice(8, 10))}/${Number(vieja.slice(5, 7))}` : 'En tu Plan', tono: 'marigold', href: '/plan' });
    }
    const hueco = cinta?.find((b): b is Extract<BloqueCinta, { tipo: 'libre' }> => b.tipo === 'libre' && b.fin > ahora);
    if (hueco) recordatorios.push({ id: 'hueco', titulo: 'Próximo hueco libre', detalle: `Hoy ${hueco.desde}–${horaEn(new Date(hueco.fin).toISOString(), tz)}`, tono: 'pine', href: '/calendario' });
  }

  return {
    semana: cab ? `Semana ${Math.max(1, Math.ceil(cab.progreso.diasTranscurridos / 7))} del Q${cab.quarter}` : null,
    resumen: { llamadas: llamadas?.length ?? null, tareas: deHoySinCerrar?.length ?? null, vencidas: vencidasCobro },
    cinta,
    proxima: proximaLlamada ? { titulo: proximaLlamada.titulo, hora: proximaLlamada.hora, href: proximaLlamada.href } : null,
    numeros,
    vence,
    funnel,
    okrs,
    deben,
    semaforo,
    mes: cal ? mesDe(cal.items, hoy, tz) : null,
    dia: eventos,
    recordatorios,
    aTildar: plan && deHoySinCerrar ? deHoySinCerrar.slice(0, 3).map((t) => tareaFocus(t, plan.etiquetas, hoy)) : null,
  };
}

const rangoUrgencia = (u: CobroM['urgencia']) => (u === 'vencida' ? 0 : u === 'pronto' ? 1 : 2);
