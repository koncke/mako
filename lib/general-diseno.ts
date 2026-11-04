// =============================================================================
// general-diseno — lo que dibuja la hoja General con su DISEÑO PROPIO (la copia de Orvel), sacado de los datos de General
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». La copia y la adaptación están en docs/diseno/mockups-dashboard/general-orvel/; acá, de dónde sale cada número
// con los DATOS REALES: los de los bloques de General (`DatosGeneral`, app/general/datos.ts) y, para lo que se mide por mes y
// lo que falta cobrar, los de dos componentes de la hoja (`hoja.diseno.piezas`: `meses` y `deben`, lib/general-plantillas.ts).
//   · la cabecera: la frase del mes (lo cobrado, las cuotas vencidas y los leads por marcar);
//   · «Este mes» (el «Cash» de Orvel): lo cobrado contra el mismo período del mes pasado, la barra contra la proyección al
//     cierre, los cuatro números del mes y la meta del trimestre;
//   · «Lo que entró y lo que invertiste» («Money in and out»): lo cobrado, la inversión y lo que quedó, y las dos líneas por mes;
//   · «Te necesita», «Lo que vence», «Te deben», «Tu funnel hoy», «Próximas llamadas» y «Salud del negocio».
//
// LO QUE ORVEL TIENE Y MaKo NO HACE NO SE INVENTA: el sobre para recordarle a un cliente que pague (un mensaje a un tercero
// sale por sus puertas), «Move money» y la barra de «lo mismo el mes pasado» de cada categoría (MaKo no guarda el funnel de
// cada día).
//
// «Te deben» usa las MISMAS cuentas que la hoja Cobranza (`debenDe`, lib/cobranza-diseno.ts): lo que se debe por tramo de
// atraso, de la pieza `deben` (pagos por atraso, todo el período). Dos cuentas de lo mismo dirían dos números.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaGeneral.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { DatosGeneral } from '@/app/general/datos-tipos';
import type { CobroM } from '@/app/m/dashboard/modelo';
import type { ConteoFunnel } from './general-alcance';
import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import { debenDe, plata, type DatosPieza, type TramoAtraso } from './cobranza-diseno';
import { cuandoVence, diaEnZona, horaEn, tareaFocus } from './focus-diseno';

export type { DatosPieza };

/** Un pedazo de una frase: texto, una cifra de plata que entró (en verde) o un link. */
export type Trozo = { tipo: 'texto'; s: string } | { tipo: 'cifra'; s: string } | { tipo: 'link'; s: string; href: string };
export type Renglon = { id: 'cobrado' | 'inversion' | 'agendas' | 'cierres'; nombre: string; detalle: string; valor: string; cambio: string | null };
export type Necesita = { id: 'cuotas' | 'leads' | 'tareas' | 'alertas'; titulo: string; detalle: string; n: number; href: string };
export type Vence = { id: string; titulo: string; detalle: string; dia: number; mes: string; que: 'Tarea' | 'Proyecto'; cuando: string; vencida: boolean; href: string };
export type Llamada = { id: string; nombre: string; detalle: string; cuando: string; href: string | null };
/** Un mes del gráfico: `corto` es el rótulo del eje («Nov»). */
export type MesGeneral = { clave: string; corto: string; cobrado: number; gasto: number };
export type EtapaGeneral = { nombre: string; n: number; color: string | null };

export type VistaGeneral = {
  frase: Trozo[];
  mes: {
    cobrado: number;
    /** Lo cobrado menos lo del mismo período del mes pasado. */
    delta: number;
    etiquetaAnterior: string;
    /** La barra: lo cobrado contra lo que se proyecta al cierre (null = sin proyección). */
    proyeccion: number | null;
    renglones: Renglon[];
  } | null;
  meta: { titulo: string; pct: number | null; esperado: number; diasRestantes: number; atrasado: boolean | null } | null;
  flujo: { cobrado: number; inversion: number; cambioCobrado: string | null; cambioInversion: string | null; etiquetaAnterior: string } | null;
  meses: MesGeneral[] | null;
  necesita: Necesita[] | null;
  vence: { lista: Vence[]; total: number; vencidas: number } | null;
  /** Lo que falta cobrar (por tramo de atraso, de la pieza) y las tres cuotas más urgentes (de la cobranza de General). */
  deben: { total: number | null; tramos: TramoAtraso[] | null; cuotas: CobroM[] | null } | null;
  funnel: { id: number; nombre: string; principal: boolean; total: number; etapas: EtapaGeneral[] } | null;
  llamadas: Llamada[] | null;
  salud: Array<{ titulo: string; link: string; href: string; nivel: 'rojo' | 'ambar' | 'verde' }> | null;
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIA = 86_400_000;
const sumarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const diaMes = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / DIA);

/** El día de una llamada, como en la maqueta: «Hoy», «Mañana», el nombre del día esta semana, o «12/11». */
export function diaDeLlamada(dia: string, hoy: string): string {
  const n = diasEntre(hoy, dia);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n > 1 && n < 7) return DIAS_SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()];
  return diaMes(dia);
}
/** Cuánto falta, a la derecha de la llamada: «en 40 min», «en 3 h» si es hoy; si es otro día, la fecha («5/11»). */
export function faltaParaLlamada(inicio: number, dia: string, hoy: string, ahora: number): string {
  if (inicio <= ahora) return 'Ahora';
  if (dia !== hoy) return diaMes(dia);
  const min = Math.round((inicio - ahora) / 60_000);
  return min < 60 ? `en ${Math.max(1, min)} min` : `en ${Math.floor(min / 60)} h`;
}

/** «+32%», «−14%»; null si no hay con qué comparar (el mes pasado en cero no da un porcentaje). */
export function cambio(actual: number, anterior: number): string | null {
  if (!anterior) return null;
  const p = Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
  return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`;
}

/** La frase de arriba: «Entraron US$12,480 este mes, 2 cuotas están vencidas y 5 leads esperan que los marques.» Sólo lo que se leyó. */
export function fraseGeneral(cobrado: number | null, vencidas: number | null, porMarcar: number | null): Trozo[] {
  const partes: Trozo[][] = [];
  if (cobrado != null) partes.push([{ tipo: 'texto', s: 'Entraron ' }, { tipo: 'cifra', s: plata(cobrado) }, { tipo: 'texto', s: ' este mes' }]);
  if (vencidas) partes.push([{ tipo: 'link', s: vencidas === 1 ? '1 cuota' : `${vencidas} cuotas`, href: '/crm' }, { tipo: 'texto', s: vencidas === 1 ? ' está vencida' : ' están vencidas' }]);
  if (porMarcar) partes.push([{ tipo: 'link', s: porMarcar === 1 ? '1 lead' : `${porMarcar} leads`, href: '/crm' }, { tipo: 'texto', s: porMarcar === 1 ? ' espera que lo marques' : ' esperan que los marques' }]);
  if (!partes.length) return [{ tipo: 'texto', s: cobrado == null && vencidas == null && porMarcar == null ? 'No pude leer cómo viene el mes.' : 'Nada te está esperando ahora.' }];
  const out: Trozo[] = [];
  partes.forEach((p, i) => {
    if (i) out.push({ tipo: 'texto', s: i === partes.length - 1 ? ' y ' : ', ' });
    out.push(...p);
  });
  out.push({ tipo: 'texto', s: '.' });
  return out;
}

const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);

/** Las dos líneas por mes (lo cobrado y la inversión en anuncios), de la pieza `meses`. Sin la columna de lo cobrado, null. */
export function mesesGeneral(r: Resultado | null): MesGeneral[] | null {
  if (!r) return null;
  const iC = r.columnas.findIndex((c) => c.id === 'cobrado'), iG = r.columnas.findIndex((c) => c.id === 'gasto');
  if (iC < 0) return null;
  return r.filas.map((f) => ({
    clave: f.clave, corto: MESES[Number(f.clave.slice(5, 7)) - 1] ?? f.etiqueta,
    cobrado: num(f.valores[iC]) ?? 0, gasto: iG < 0 ? 0 : num(f.valores[iG]) ?? 0,
  }));
}

/**
 * El eje del gráfico, como el de Orvel: tres rayas (el tope, la mitad y el cero), con un paso «redondo» que deja a lo más
 * alto (lo cobrado o la inversión) entre la mitad y el tope. Sin datos, 0 a 1 (las líneas quedan en el piso).
 */
export function escalaGeneral(meses: readonly MesGeneral[]): { tope: number; paso: number } {
  const alto = Math.max(0, ...meses.map((m) => Math.max(m.cobrado, m.gasto)));
  if (!alto) return { tope: 1, paso: 0.5 };
  const bruto = alto / 2;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= bruto) ?? 10 * mag;
  return { tope: 2 * paso, paso };
}

/** Las etapas con gente, en el orden del funnel, más «Sin etapa»; pasadas las seis, las cinco primeras y «Otras» con el resto (suman el total). */
export function etapasDelFunnel(c: Pick<ConteoFunnel, 'etapas' | 'total' | 'sinEtapa'>): EtapaGeneral[] {
  const con: EtapaGeneral[] = c.etapas.filter((e) => e.n > 0).map((e) => ({ nombre: e.label, n: e.n, color: e.dot }));
  if (c.sinEtapa > 0) con.push({ nombre: 'Sin etapa', n: c.sinEtapa, color: null });
  if (con.length <= 6) return con;
  const primeras = con.slice(0, 5);
  return [...primeras, { nombre: 'Otras', n: c.total - primeras.reduce((s, e) => s + e.n, 0), color: null }];
}

const TIPOS_PENDIENTE: ReadonlyArray<{ k: 'A' | 'B' | 'C' | 'M'; l: string }> = [
  { k: 'A', l: 'sin asistencia a R1' }, { k: 'B', l: 'sin R2 ni resolución' }, { k: 'C', l: 'sin asistencia a R2' }, { k: 'M', l: 'con la nutrición manual vencida' },
];
const URGENCIA = (u: CobroM['urgencia']) => (u === 'vencida' ? 0 : u === 'pronto' ? 1 : 2);

/** Todo lo que dibuja la hoja. `ahora`: el reloj. */
export function vistaGeneral(d: DatosGeneral, hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, ahora: number): VistaGeneral {
  const p = hoja.diseno?.piezas ?? {};
  const plan = d.plan.ok ? d.plan.d : null;
  const cal = d.calendario.ok ? d.calendario.d : null;
  const hoy = plan?.hoy ?? cal?.hoy ?? new Date(ahora).toISOString().slice(0, 10);
  const tz = cal?.tz ?? 'UTC';
  const comp = d.mes.ok ? d.mes.d.comparativo : null;
  const cobros = d.cobranza.ok ? d.cobranza.d.cobros : null;
  const vencidasCobro = cobros ? cobros.filter((c) => c.urgencia === 'vencida').length : null;
  const porMarcar = d.pendientes.ok ? d.pendientes.d.total : null;

  let mes: VistaGeneral['mes'] = null;
  let flujo: VistaGeneral['flujo'] = null;
  if (comp) {
    const c = comp.cash_usd, inv = comp.inversion_usd, ag = comp.agendas, ci = comp.cierres;
    const proy = (n: number, esPlata: boolean) => (n > 0 ? `proyección ${esPlata ? plata(n) : Math.round(n)}` : 'sin proyección todavía');
    mes = {
      cobrado: c.actual, delta: c.actual - c.anterior, etiquetaAnterior: comp.etiqueta_anterior, proyeccion: c.proyeccion > 0 ? c.proyeccion : null,
      renglones: [
        { id: 'cobrado', nombre: 'Cobrado', detalle: proy(c.proyeccion, true), valor: plata(c.actual), cambio: cambio(c.actual, c.anterior) },
        { id: 'inversion', nombre: 'Inversión en anuncios', detalle: proy(inv.proyeccion, true), valor: plata(inv.actual), cambio: cambio(inv.actual, inv.anterior) },
        { id: 'agendas', nombre: 'Agendas', detalle: proy(ag.proyeccion, false), valor: String(ag.actual), cambio: cambio(ag.actual, ag.anterior) },
        { id: 'cierres', nombre: 'Cierres', detalle: proy(ci.proyeccion, false), valor: String(ci.actual), cambio: cambio(ci.actual, ci.anterior) },
      ],
    };
    flujo = { cobrado: c.actual, inversion: inv.actual, cambioCobrado: cambio(c.actual, c.anterior), cambioInversion: cambio(inv.actual, inv.anterior), etiquetaAnterior: comp.etiqueta_anterior };
  }

  let meta: VistaGeneral['meta'] = null;
  if (d.cabecera.ok && d.cabecera.d.objetivo) {
    const o = d.cabecera.d.objetivo;
    const esperado = Math.round(Math.max(0, Math.min(1, d.cabecera.d.fraccion)) * 100);
    const pct = num(o.pct);
    meta = { titulo: o.titulo, pct: pct == null ? null : Math.round(pct), esperado, diasRestantes: d.cabecera.d.progreso.diasRestantes, atrasado: pct == null ? null : pct < esperado };
  }

  // «Te necesita»: sólo lo que se leyó y tiene algo; si no se pudo leer nada, null.
  let necesita: VistaGeneral['necesita'] = null;
  if (cobros || d.pendientes.ok || plan || d.semaforo.ok) {
    necesita = [];
    if (cobros && vencidasCobro) {
      const clientes = new Set(cobros.filter((c) => c.urgencia === 'vencida').map((c) => c.leadId)).size;
      necesita.push({ id: 'cuotas', titulo: 'Cuotas vencidas', detalle: clientes === 1 ? 'De 1 cliente' : `De ${clientes} clientes`, n: vencidasCobro, href: '/crm' });
    }
    if (d.pendientes.ok && d.pendientes.d.total) {
      const porTipo = d.pendientes.d.porTipo;
      const t = TIPOS_PENDIENTE.find((x) => (porTipo[x.k] ?? 0) > 0);
      necesita.push({ id: 'leads', titulo: 'Leads por marcar', detalle: t ? `${porTipo[t.k]} ${t.l}` : 'En el CRM', n: d.pendientes.d.total, href: '/crm' });
    }
    if (plan && plan.vencidas) {
      const vieja = plan.deadlines.tareas.map((t) => t.deadline).filter((f): f is string => !!f && f < hoy).sort()[0];
      necesita.push({ id: 'tareas', titulo: 'Tareas vencidas', detalle: vieja ? `La más vieja, del ${diaMes(vieja)}` : 'En tu Plan', n: plan.vencidas, href: '/plan' });
    }
    if (d.semaforo.ok) {
      const rojas = d.semaforo.d.alertas.filter((a) => a.nivel === 'rojo');
      if (rojas.length) necesita.push({ id: 'alertas', titulo: 'Alertas en rojo', detalle: rojas[0].titulo, n: rojas.length, href: rojas[0].href });
    }
  }

  // «Lo que vence en 3 semanas» (el «Next 3 weeks» de Orvel): las tareas y los proyectos del Plan, lo vencido primero.
  let vence: VistaGeneral['vence'] = null;
  if (plan) {
    const hasta = sumarDias(hoy, 21);
    const tareas = plan.deadlines.tareas.flatMap((t) => {
      if (!t.deadline || t.deadline > hasta) return [];
      const f = tareaFocus(t, plan.etiquetas, hoy);
      const vencida = t.deadline < hoy;
      return [{ fecha: t.deadline, v: { id: t.id, titulo: t.title, detalle: f.proyecto?.nombre ?? 'Sin proyecto', dia: Number(t.deadline.slice(8, 10)), mes: MESES[Number(t.deadline.slice(5, 7)) - 1], que: 'Tarea' as const, cuando: vencida ? 'Vencida' : cuandoVence(t.deadline, hoy), vencida, href: `/plan?tarea=${encodeURIComponent(t.id)}` } }];
    });
    const proyectos = plan.deadlines.proyectos.flatMap((l) => {
      if (!l.deadline || l.deadline > hasta) return [];
      const vencida = l.deadline < hoy;
      return [{ fecha: l.deadline, v: { id: `p-${l.id}`, titulo: l.name, detalle: 'Proyecto del Plan', dia: Number(l.deadline.slice(8, 10)), mes: MESES[Number(l.deadline.slice(5, 7)) - 1], que: 'Proyecto' as const, cuando: vencida ? 'Vencido' : cuandoVence(l.deadline, hoy), vencida, href: `/plan?proyecto=${encodeURIComponent(l.id)}` } }];
    });
    const todo = [...tareas, ...proyectos].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((x) => x.v);
    vence = { lista: todo.slice(0, 6), total: todo.length, vencidas: todo.filter((v) => v.vencida).length };
  }

  // «Te deben»: el total y los tramos de la pieza (los de Cobranza), y las tres cuotas más urgentes de la cobranza de General.
  const tramos = debenDe(res(datos, p.deben));
  const deben: VistaGeneral['deben'] = tramos || cobros ? {
    total: tramos ? tramos.total : null,
    tramos: tramos ? tramos.tramos : null,
    cuotas: cobros ? [...cobros].sort((a, b) => URGENCIA(a.urgencia) - URGENCIA(b.urgencia)).slice(0, 3) : null,
  } : null;

  let funnel: VistaGeneral['funnel'] = null;
  if (d.funnels.ok) {
    const f = d.funnels.d.find((x) => x.principal) ?? d.funnels.d[0];
    if (f?.conteo) funnel = { id: f.id, nombre: f.nombre, principal: f.principal, total: f.conteo.total, etapas: etapasDelFunnel(f.conteo) };
  }

  // «Próximas llamadas» (el «Latest payments» de Orvel): las del CRM que todavía no terminaron, la más cercana arriba.
  let llamadas: VistaGeneral['llamadas'] = null;
  if (cal) {
    llamadas = cal.items
      .filter((i) => i.fuente === 'crm' && !i.diaCompleto && Date.parse(i.fin ?? i.inicio) > ahora)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .slice(0, 6)
      .map((i) => {
        const dia = diaEnZona(i.inicio, tz);
        const cuando = faltaParaLlamada(Date.parse(i.inicio), dia, hoy, ahora);
        return { id: i.id, nombre: i.titulo, detalle: [`${diaDeLlamada(dia, hoy)} ${horaEn(i.inicio, tz)}`, i.detalle].filter(Boolean).join(' · '), cuando, href: i.href };
      });
  }

  const salud = d.semaforo.ok ? d.semaforo.d.alertas.slice(0, 5).map((a) => ({ titulo: a.titulo, link: a.hrefLabel, href: a.href, nivel: a.nivel })) : null;

  return {
    frase: fraseGeneral(comp?.cash_usd.actual ?? null, vencidasCobro, porMarcar),
    mes, meta, flujo,
    meses: mesesGeneral(res(datos, p.meses)),
    necesita, vence, deben, funnel, llamadas, salud,
  };
}
