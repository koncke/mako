// =============================================================================
// operacion-diseno — lo que dibuja la hoja «Operación diaria» con su DISEÑO PROPIO (la copia de Moorly), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/operacion-moorly/; acá, de dónde sale cada número con los DATOS REALES: los de los bloques de
// General (`DatosGeneral`, app/general/datos.ts) y los de seis componentes de la hoja (`hoja.diseno.piezas`,
// lib/general-plantillas.ts): los cuatro números (`agendas`, `pendiente`, `cierres`, `cobrado`, con su serie diaria), los meses
// (`meses`: lo cobrado, las agendas y los cierres por mes) y lo que te deben por tramo de atraso (`deben`).
//   · la cabecera: las llamadas de hoy, las cuotas vencidas, lo que vence esta semana y la próxima llamada;
//   · los cuatro números de Moorly, con su línea;
//   · «Lo cobrado, mes a mes» («Premium on the water»), «Te está esperando» («Waiting on you»), «Tu funnel hoy» («Pipeline»),
//     «Las llamadas que vienen» («Renewal tide»), «Te deben» («Book by program»), «Para tildar hoy» («To-dos»), «Salud del
//     negocio» («Activity») y «La meta del trimestre» («Next agency bill»).
//
// LO QUE MOORLY TIENE Y MaKo NO HACE NO SE INVENTA: la caja para agregar un pendiente (una tarea nueva del Plan se crea en el
// Plan) y la plata de cada etapa del funnel (MaKo cuenta leads por etapa, no montos).
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaOperacion.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { DatosGeneral, TareaVista } from '@/app/general/datos-tipos';
import type { CobroM } from '@/app/m/dashboard/modelo';
import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import { debenDe, plata, type DatosPieza } from './cobranza-diseno';
import { cuandoVence, diaEnZona, horaEn, tareaFocus } from './focus-diseno';
import { cambio, diaDeLlamada, etapasDelFunnel, type EtapaGeneral } from './general-diseno';
import { TRAMOS_ATRASO } from './graficos-datos-puro';

export type { DatosPieza };

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIA = 86_400_000;
const sumarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / DIA);
const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);

/** Un pedazo de la frase de arriba: texto o un nombre en negrita. */
export type TrozoOp = { tipo: 'texto'; s: string } | { tipo: 'fuerte'; s: string };
export type NumeroOp = {
  id: 'agendas' | 'pendiente' | 'cierres' | 'cobrado';
  titulo: string;
  /** null = la pieza no llegó. */
  valor: string | null;
  /** La serie diaria del período (la línea); null o de menos de dos puntos = sin línea. */
  serie: number[] | null;
  pie: string | null;
  /** El chip de Moorly: el cambio contra el período anterior («+32%»), sólo en lo cobrado. */
  cambio: string | null;
};
export type MesOp = { clave: string; corto: string; largo: string; cobrado: number; agendas: number; cierres: number };
export type EsperaOp = { id: string; tipo: 'cobro' | 'tarea' | 'leads'; titulo: string; detalle: string; cuando: string; tono: 'bad' | 'warn' | 'info'; href: string };
export type LlamadaOp = { id: string; dia: number; mes: string; nombre: string; detalle: string; cuando: string; hoy: boolean; href: string | null };
export type TramoOp = { nombre: string; monto: number; pct: number };

export type VistaOperacion = {
  frase: TrozoOp[];
  numeros: NumeroOp[];
  meses: MesOp[] | null;
  espera: { lista: EsperaOp[]; total: number } | null;
  funnel: { id: number; nombre: string; principal: boolean; total: number; etapas: EtapaGeneral[] } | null;
  /** Las llamadas agendadas por día, de hoy a 13 días más (el «Renewal tide»), y las tres que siguen. */
  llamadas: { porDia: Array<{ dia: string; rotulo: string; n: number }>; proximas: LlamadaOp[] } | null;
  deben: { total: number; cuotas: number; tramos: TramoOp[] } | null;
  tildar: Array<{ id: string; titulo: string; cuando: string }> | null;
  salud: Array<{ titulo: string; link: string; href: string; nivel: 'rojo' | 'ambar' | 'verde' }> | null;
  meta: { titulo: string; pct: number | null; esperado: number; diasRestantes: number; atrasado: boolean | null } | null;
};

/** El total, la serie y el anterior de una pieza de número. */
function numeroDe(r: Resultado | null): { total: number | null; serie: number[] | null; anterior: number | null } {
  if (!r || !r.columnas.length) return { total: null, serie: null, anterior: null };
  const serie = r.serie?.map((p) => num(p.valor) ?? 0) ?? null;
  return { total: num(r.totales[0]), serie: serie && serie.length > 1 ? serie : null, anterior: r.anterior ? num(r.anterior[0]) : null };
}

/** Los meses de la pieza `meses`: lo cobrado, las agendas y los cierres (una columna que falta, en cero). Sin lo cobrado, null. */
export function mesesOperacion(r: Resultado | null): MesOp[] | null {
  if (!r) return null;
  const i = (id: string) => r.columnas.findIndex((c) => c.id === id);
  const iC = i('cobrado'), iA = i('agendas'), iX = i('cierres');
  if (iC < 0) return null;
  const v = (f: Resultado['filas'][number], k: number) => (k < 0 ? 0 : num(f.valores[k]) ?? 0);
  return r.filas.map((f) => {
    const m = Number(f.clave.slice(5, 7)) - 1;
    return {
      clave: f.clave, corto: MESES[m] ?? f.etiqueta, largo: MESES_LARGOS[m] ? `${MESES_LARGOS[m][0].toUpperCase()}${MESES_LARGOS[m].slice(1)} de ${f.clave.slice(0, 4)}` : f.etiqueta,
      cobrado: v(f, iC), agendas: v(f, iA), cierres: v(f, iX),
    };
  });
}

/** Lo que dice debajo del gráfico para una serie: los doce meses, el promedio, el mejor mes y lo que va de éste. */
export function resumenDeMeses(meses: readonly MesOp[], campo: 'cobrado' | 'agendas' | 'cierres'): { total: number; promedio: number; mejor: string | null; actual: number } {
  const v = meses.map((m) => m[campo]);
  const total = v.reduce((s, n) => s + n, 0);
  const max = Math.max(0, ...v);
  return { total, promedio: meses.length ? total / meses.length : 0, mejor: max > 0 ? meses[v.indexOf(max)].largo : null, actual: v[v.length - 1] ?? 0 };
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Todo lo que dibuja la hoja. `ahora`: el reloj. */
export function vistaOperacion(d: DatosGeneral, hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, ahora: number): VistaOperacion {
  const p = hoja.diseno?.piezas ?? {};
  const plan = d.plan.ok ? d.plan.d : null;
  const cal = d.calendario.ok ? d.calendario.d : null;
  const hoy = plan?.hoy ?? cal?.hoy ?? new Date(ahora).toISOString().slice(0, 10);
  const tz = cal?.tz ?? 'UTC';
  const cobros = d.cobranza.ok ? d.cobranza.d.cobros : null;
  const vencidas = cobros ? cobros.filter((c) => c.urgencia === 'vencida') : null;

  // Las llamadas del CRM (las de la agenda): las de hoy, las que vienen y las que ya terminaron no cuentan para «próxima».
  const delCrm = cal ? cal.items.filter((i) => i.fuente === 'crm' && !i.diaCompleto).sort((a, b) => a.inicio.localeCompare(b.inicio)) : null;
  const deHoy = delCrm ? delCrm.filter((i) => diaEnZona(i.inicio, tz) === hoy) : null;
  const vienen = delCrm ? delCrm.filter((i) => Date.parse(i.inicio) > ahora) : null;
  const semana = plan ? plan.deadlines.tareas.filter((t) => t.deadline && t.deadline >= hoy && t.deadline <= sumarDias(hoy, 6)) : null;

  // ── la frase ──
  const partes: string[] = [];
  if (deHoy) partes.push(deHoy.length ? `${plural(deHoy.length, 'llamada', 'llamadas')} hoy` : 'sin llamadas hoy');
  if (vencidas?.length) partes.push(plural(vencidas.length, 'cuota vencida', 'cuotas vencidas'));
  if (semana?.length) partes.push(`${plural(semana.length, 'tarea que vence', 'tareas que vencen')} esta semana`);
  const frase: TrozoOp[] = [];
  if (partes.length) frase.push({ tipo: 'texto', s: partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` });
  const proxima = vienen?.[0];
  if (proxima) {
    const dia = diaEnZona(proxima.inicio, tz);
    const cuando = dia === hoy ? `a las ${horaEn(proxima.inicio, tz)}` : `${diaDeLlamada(dia, hoy).toLowerCase()} a las ${horaEn(proxima.inicio, tz)}`;
    frase.push({ tipo: 'texto', s: frase.length ? '. ' : '' }, { tipo: 'fuerte', s: proxima.titulo }, { tipo: 'texto', s: ` es tu próxima llamada, ${cuando}.` });
  } else if (frase.length) frase.push({ tipo: 'texto', s: '.' });
  if (frase.length && frase[0].tipo === 'texto') frase[0] = { tipo: 'texto', s: frase[0].s[0].toUpperCase() + frase[0].s.slice(1) };

  // ── los cuatro números ──
  const ag = numeroDe(res(datos, p.agendas)), pe = numeroDe(res(datos, p.pendiente)), ci = numeroDe(res(datos, p.cierres)), co = numeroDe(res(datos, p.cobrado));
  const numeros: NumeroOp[] = [
    { id: 'agendas', titulo: 'Agendas', valor: ag.total == null ? null : String(ag.total), serie: ag.serie, pie: deHoy ? (deHoy.length ? `${plural(deHoy.length, 'llamada', 'llamadas')} hoy` : 'Sin llamadas hoy') : null, cambio: null },
    { id: 'pendiente', titulo: 'Por cobrar', valor: pe.total == null ? null : plata(pe.total), serie: pe.serie, pie: vencidas ? (vencidas.length ? plural(vencidas.length, 'cuota vencida', 'cuotas vencidas') : 'Ninguna vencida') : null, cambio: null },
    { id: 'cierres', titulo: 'Cierres', valor: ci.total == null ? null : String(ci.total), serie: ci.serie, pie: ag.total != null ? `De ${plural(ag.total, 'agenda', 'agendas')}` : null, cambio: null },
    { id: 'cobrado', titulo: 'Cobrado', valor: co.total == null ? null : plata(co.total), serie: co.serie, pie: co.total != null && co.anterior != null ? 'contra el período anterior' : null, cambio: co.total != null && co.anterior != null ? cambio(co.total, co.anterior) : null },
  ];

  // ── te está esperando: lo vencido primero, después lo que vence pronto; hasta seis ──
  let espera: VistaOperacion['espera'] = null;
  if (cobros || plan || d.pendientes.ok) {
    const lista: EsperaOp[] = [];
    const tarea = (t: TareaVista, tono: 'bad' | 'warn', cuando: string): EsperaOp => ({
      id: `t-${t.id}`, tipo: 'tarea', titulo: t.title, detalle: plan ? tareaFocus(t, plan.etiquetas, hoy).proyecto?.nombre ?? 'Sin proyecto' : '', cuando, tono, href: `/plan?tarea=${encodeURIComponent(t.id)}`,
    });
    const cobro = (c: CobroM, tono: 'bad' | 'warn'): EsperaOp => ({ id: `c-${c.leadId}-${c.pagoId ?? 'm'}`, tipo: 'cobro', titulo: c.nombre, detalle: c.linea, cuando: tono === 'bad' ? 'vencida' : 'vence pronto', tono, href: `/crm/${c.leadId}?tab=pagos` });
    for (const c of vencidas ?? []) lista.push(cobro(c, 'bad'));
    const tareas = plan ? plan.deadlines.tareas.filter((t) => t.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline)) : [];
    for (const t of tareas.filter((t) => t.deadline < hoy)) lista.push(tarea(t, 'bad', `${plural(diasEntre(t.deadline, hoy), 'día', 'días')} tarde`));
    if (d.pendientes.ok && d.pendientes.d.total) {
      const n = d.pendientes.d.total;
      lista.push({ id: 'leads', tipo: 'leads', titulo: plural(n, 'lead por marcar', 'leads por marcar'), detalle: 'En el CRM', cuando: 'marcar', tono: 'info', href: '/crm' });
    }
    for (const c of (cobros ?? []).filter((c) => c.urgencia === 'pronto')) lista.push(cobro(c, 'warn'));
    for (const t of tareas.filter((t) => t.deadline >= hoy && t.deadline <= sumarDias(hoy, 7))) {
      const n = diasEntre(hoy, t.deadline);
      lista.push(tarea(t, 'warn', n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`));
    }
    espera = { lista: lista.slice(0, 6), total: lista.length };
  }

  let funnel: VistaOperacion['funnel'] = null;
  if (d.funnels.ok) {
    const f = d.funnels.d.find((x) => x.principal) ?? d.funnels.d[0];
    if (f?.conteo) funnel = { id: f.id, nombre: f.nombre, principal: f.principal, total: f.conteo.total, etapas: etapasDelFunnel(f.conteo) };
  }

  // ── las llamadas que vienen: una barra por día (hoy y 13 más) y las tres próximas ──
  let llamadas: VistaOperacion['llamadas'] = null;
  if (delCrm && vienen) {
    const cuenta = new Map<string, number>();
    for (const i of delCrm) { const dia = diaEnZona(i.inicio, tz); cuenta.set(dia, (cuenta.get(dia) ?? 0) + 1); }
    const porDia = Array.from({ length: 14 }, (_, k) => {
      const dia = sumarDias(hoy, k);
      return { dia, rotulo: k === 0 ? 'Hoy' : `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}`, n: cuenta.get(dia) ?? 0 };
    });
    const proximas = vienen.slice(0, 3).map((i) => {
      const dia = diaEnZona(i.inicio, tz);
      return {
        id: i.id, dia: Number(dia.slice(8, 10)), mes: MESES[Number(dia.slice(5, 7)) - 1].toLowerCase(), nombre: i.titulo, detalle: i.detalle ?? '',
        cuando: `${diaDeLlamada(dia, hoy)} ${horaEn(i.inicio, tz)}`, hoy: dia === hoy, href: i.href,
      };
    });
    llamadas = { porDia, proximas };
  }

  // ── te deben: los tramos de la pieza, con las cuentas de la hoja Cobranza (`debenDe`) ──
  const tr = debenDe(res(datos, p.deben));
  const NOMBRE_TRAMO: Record<(typeof TRAMOS_ATRASO)[number], string> = { 'Al día': 'Al día', '1-30 días': 'De 1 a 30 días', '31-60 días': 'De 31 a 60 días', '60+ días': 'Más de 60 días' };
  const deben: VistaOperacion['deben'] = tr ? {
    total: tr.total, cuotas: tr.cuotas,
    tramos: tr.tramos.filter((t) => t.monto > 0).map((t) => ({ nombre: NOMBRE_TRAMO[t.nombre], monto: t.monto, pct: tr.total ? Math.round((t.monto / tr.total) * 100) : 0 })),
  } : null;

  // ── para tildar hoy: lo que vence hoy y lo vencido, lo más viejo primero; hasta cinco ──
  const tildar = plan ? plan.deadlines.tareas.filter((t) => t.deadline && t.deadline <= hoy).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 5)
    .map((t) => ({ id: t.id, titulo: t.title, cuando: t.deadline < hoy ? 'vencida' : cuandoVence(t.deadline, hoy).toLowerCase() })) : null;

  const salud = d.semaforo.ok ? d.semaforo.d.alertas.slice(0, 5).map((a) => ({ titulo: a.titulo, link: a.hrefLabel, href: a.href, nivel: a.nivel })) : null;

  let meta: VistaOperacion['meta'] = null;
  if (d.cabecera.ok && d.cabecera.d.objetivo) {
    const o = d.cabecera.d.objetivo;
    const esperado = Math.round(Math.max(0, Math.min(1, d.cabecera.d.fraccion)) * 100);
    const pct = num(o.pct);
    meta = { titulo: o.titulo, pct: pct == null ? null : Math.round(pct), esperado, diasRestantes: d.cabecera.d.progreso.diasRestantes, atrasado: pct == null ? null : pct < esperado };
  }

  return { frase, numeros, meses: mesesOperacion(res(datos, p.meses)), espera, funnel, llamadas, deben, tildar, salud, meta };
}
