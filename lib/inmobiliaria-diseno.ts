// =============================================================================
// inmobiliaria-diseno — lo que dibuja la hoja «Inmobiliaria» con su DISEÑO PROPIO (la copia de Torque), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia y sus capturas
// están en docs/diseno/mockups-dashboard/inmobiliaria-torque/; aquí, de dónde sale cada número con los DATOS REALES: los componentes de
// la hoja (`hoja.diseno.piezas`, la plantilla `inmobiliaria` de lib/graficos-plantillas-generales.ts). La pregunta de la hoja es
// «¿cuántos interesados visitan, cuántos compran y en qué proyecto?»:
//   · las cuatro tarjetas de arriba → vienen a la visita, compran de los que visitan (las dos contra el período anterior), el ticket
//     promedio y los días hasta comprar;
//   · «The floor» → tus proyectos (hasta seis), cada uno con sus interesados, sus visitas y cuántos de los que visitan compran;
//   · «Job board» → tus interesados, cada uno en su etapa (hasta cinco columnas y cuatro tarjetas por columna);
//   · «Arriving today» → de dónde llegan (el origen de los interesados);
//   · «Sales» → interesados y visitas, semana por semana;
//   · «Technicians» → quién vende: las visitas que recibió, las que cerró y lo que vendió;
//   · «Running low» → por qué no compraron (lo que se marcó al perder);
//   · «Shop load» → de los interesados, cuántos agendan una visita;
//   · «Team activity» → de dónde te buscan (las visitas a tus páginas, por región).
//
// LO QUE TORQUE TIENE Y MaKo NO MIDE NO SE INVENTA: la hora de hoy, los autos que llegan con su hora, el cronómetro de cada bahía, los
// repuestos y la actividad de un equipo. El tablero se arma con los interesados que trae la pieza (los primeros 50 del período): no es el
// CRM entero, y lo dice.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaInmobiliaria.tsx) y el test. Lo que no llegó es `null`, nunca
// un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { entero, plata, rotuloDia } from './marketing-diseno';
import { iniciales } from './hooks-diseno';

export type { DatosPieza };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const antes = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.anterior?.[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const SIN = '(sin dato)';
const filasDe = (r: Resultado | null) => (r ? r.filas.filter((f) => f.clave !== SIN && f.clave !== '') : []);

/** «72%» (redondo) o «6.4%» debajo de 10. */
export const pct = (v: number) => (Math.abs(v) < 10 && Math.round(v) !== v ? `${(Math.round(v * 10) / 10).toFixed(1)}%` : `${Math.round(v)}%`);

// ── las cuatro tarjetas de arriba ─────────────────────────────────────────────────────────────────────────────────────
export type ChipInmo = { texto: string; tono: 'bueno' | 'malo' | 'neutro' };
export type NumeroInmo = { id: 'asistencia' | 'cierre' | 'ticket' | 'ciclo'; nombre: string; valor: number | null; texto: string | null; unidad: string | null; chip: ChipInmo | null };
/** El cambio de una tasa contra el período anterior, en puntos: «+4 pts vs antes» (sube = bueno). */
export function cambioPts(v: number | null, a: number | null): ChipInmo | null {
  if (v == null || a == null) return null;
  const d = Math.round(v - a);
  return d === 0 ? { texto: 'igual que antes', tono: 'neutro' } : { texto: `${d > 0 ? '+' : '−'}${Math.abs(d)} pts vs antes`, tono: d > 0 ? 'bueno' : 'malo' };
}
export function numerosDe(p: { asistencia: Resultado | null; cierre: Resultado | null; ticket: Resultado | null; ciclo: Resultado | null }): NumeroInmo[] {
  const asis = total(p.asistencia, 'tasa_asistencia'), cie = total(p.cierre, 'tasa_cierre'), tic = total(p.ticket, 'ticket'), cic = total(p.ciclo, 'ciclo_cierre');
  return [
    { id: 'asistencia', nombre: 'Vienen a la visita', valor: asis, texto: asis == null ? null : pct(asis), unidad: null, chip: cambioPts(asis, antes(p.asistencia, 'tasa_asistencia')) },
    { id: 'cierre', nombre: 'Compran tras la visita', valor: cie, texto: cie == null ? null : pct(cie), unidad: null, chip: cambioPts(cie, antes(p.cierre, 'tasa_cierre')) },
    { id: 'ticket', nombre: 'Ticket promedio', valor: tic, texto: tic == null ? null : plata(tic), unidad: null, chip: tic == null ? null : { texto: 'por compra', tono: 'neutro' } },
    { id: 'ciclo', nombre: 'Días hasta comprar', valor: cic, texto: cic == null ? null : entero(cic), unidad: cic == null ? null : 'días', chip: cic == null ? null : { texto: 'de la visita a la compra', tono: 'neutro' } },
  ];
}

// ── «The floor» → tus proyectos ───────────────────────────────────────────────────────────────────────────────────────
/** Cuántos proyectos dibuja (Torque tiene seis bahías). */
export const PROYECTOS = 6;
export type EstadoProyecto = 'vende' | 'visitas' | 'quieto';
export type ProyectoInmo = {
  clave: string; nombre: string; n: number;
  leads: number; agendas: number; cierres: number;
  /** De los que agendaron (visitaron), cuántos compraron (%), o null sin visitas. */
  compra: number | null;
  estado: EstadoProyecto;
};
export function proyectosDe(r: Resultado | null): { filas: ProyectoInmo[]; total: number; conVisitas: number } | null {
  if (!r) return null;
  const todas = filasDe(r).map((f) => ({ clave: f.clave, nombre: f.etiqueta || f.clave, leads: enFila(r, f, 'leads') ?? 0, agendas: enFila(r, f, 'agendas') ?? 0, cierres: enFila(r, f, 'cierres') ?? 0 }))
    .filter((p) => p.leads > 0 || p.agendas > 0 || p.cierres > 0)
    .sort((a, b) => b.leads - a.leads || b.cierres - a.cierres);
  const filas = todas.slice(0, PROYECTOS).map((p, i): ProyectoInmo => ({
    ...p, n: i + 1, compra: p.agendas ? Math.min(100, (p.cierres / p.agendas) * 100) : null,
    estado: p.cierres > 0 ? 'vende' : p.agendas > 0 ? 'visitas' : 'quieto',
  }));
  return { filas, total: todas.length + r.fuera, conVisitas: todas.filter((p) => p.agendas > 0).length };
}

// ── «Job board» → tus interesados, por etapa ──────────────────────────────────────────────────────────────────────────
export const CARRILES = 5;
export const TARJETAS = 4;
export type TarjetaInmo = { clave: string; nombre: string; proyecto: string | null; nProyecto: number | null; asesor: string | null; iniciales: string | null; agendo: boolean; compro: boolean };
export type CarrilInmo = { etapa: string; total: number; tarjetas: TarjetaInmo[] };
/**
 * Las columnas son las etapas con más interesados (la pieza «En qué etapa están», que cuenta TODOS los del período), en ese orden; las
 * tarjetas, los interesados que trae el tablero (hasta 50), los que compraron y agendaron primero. El número de cada columna es el de la
 * etapa (el total), no el de las tarjetas que entran.
 */
/** Las tarjetas de los interesados que trae el tablero (su etapa, su proyecto con su número de bahía y quién lo atiende). */
function tarjetasDe(tablero: Resultado | null, proyectos: ProyectoInmo[]): Array<TarjetaInmo & { etapa: string }> {
  if (!tablero) return [];
  const nDe = new Map(proyectos.map((p) => [p.clave, p.n]));
  return filasDe(tablero).map((f) => {
    const asesor = f.extra?.closer && f.extra.closer !== SIN ? f.extra.closer : null;
    const proyecto = f.extra?.producto && f.extra.producto !== SIN ? f.extra.producto : null;
    return {
      clave: f.clave, nombre: f.etiqueta || f.clave, etapa: f.extra?.etapa ?? '', proyecto, nProyecto: proyecto ? nDe.get(proyecto) ?? null : null,
      asesor, iniciales: asesor ? iniciales(asesor) : null, agendo: (enFila(tablero, f, 'agendas') ?? 0) > 0, compro: (enFila(tablero, f, 'cierres') ?? 0) > 0,
    };
  });
}
export function tableroDe(etapa: Resultado | null, tablero: Resultado | null, proyectos: ProyectoInmo[]): { carriles: CarrilInmo[]; enTablero: number } | null {
  if (!etapa) return null;
  const tarjetas = tarjetasDe(tablero, proyectos);
  const carriles = filasDe(etapa).map((f) => ({ etapa: f.etiqueta || f.clave, clave: f.clave, total: enFila(etapa, f, 'leads') ?? 0 }))
    .filter((c) => c.total > 0).slice(0, CARRILES)
    .map((c): CarrilInmo => ({
      etapa: c.etapa, total: c.total,
      tarjetas: tarjetas.filter((t) => t.etapa === c.etapa || t.etapa === c.clave)
        .sort((a, b) => Number(b.compro) - Number(a.compro) || Number(b.agendo) - Number(a.agendo))
        .slice(0, TARJETAS).map(({ etapa: _e, ...t }) => t),
    }));
  return { carriles, enTablero: tarjetas.length };
}

// ── «Team activity» → los que avanzan ────────────────────────────────────────────────────────────────────────────────
/** Cuántas líneas dibuja (Torque tiene seis). */
export const AVANCES = 6;
/**
 * Los interesados del tablero que compraron (primero) o agendaron una visita, con su proyecto y quién los atiende. Es una MUESTRA del
 * tablero (hasta 50 interesados), no la lista entera: la cabecera de la tarjeta dice cuántos compraron en el período (la apertura).
 */
export function avancesDe(tablero: Resultado | null, proyectos: ProyectoInmo[]): TarjetaInmo[] | null {
  if (!tablero) return null;
  return tarjetasDe(tablero, proyectos).filter((t) => t.compro || t.agendo)
    .sort((a, b) => Number(b.compro) - Number(a.compro))
    .slice(0, AVANCES).map(({ etapa: _e, ...t }) => t);
}

// ── «Arriving today» → de dónde llegan · «Running low» → por qué no compraron ──────────────────────────────────────────
export type ParteInmo = { clave: string; nombre: string; valor: number; parte: number };
/** Las filas de una pieza de una sola métrica, sin «(sin dato)», con su parte del total (que es el de la pieza, si lo trae). */
export function partesDe(r: Resultado | null, metrica: string, tope: number): { filas: ParteInmo[]; total: number } | null {
  if (!r) return null;
  const todas = filasDe(r).map((f) => ({ clave: f.clave, nombre: f.etiqueta || f.clave, valor: enFila(r, f, metrica) ?? 0 })).filter((x) => x.valor > 0);
  const suma = total(r, metrica) ?? todas.reduce((a, x) => a + x.valor, 0);
  return { filas: todas.slice(0, tope).map((x) => ({ ...x, parte: suma ? (x.valor / suma) * 100 : 0 })), total: suma };
}

// ── «Sales» → interesados y visitas, por semana ───────────────────────────────────────────────────────────────────────
export type SemanaInmo = { clave: string; rotulo: string; leads: number; agendas: number };
export function semanasDe(r: Resultado | null): { filas: SemanaInmo[]; leads: number; agendas: number } | null {
  if (!r) return null;
  const filas = r.filas.filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f.clave)).map((f) => ({ clave: f.clave, rotulo: rotuloDia(f.clave), leads: enFila(r, f, 'leads') ?? 0, agendas: enFila(r, f, 'agendas') ?? 0 }))
    .sort((a, b) => a.clave.localeCompare(b.clave));
  return { filas, leads: total(r, 'leads') ?? filas.reduce((a, x) => a + x.leads, 0), agendas: total(r, 'agendas') ?? filas.reduce((a, x) => a + x.agendas, 0) };
}
/** El acumulado (el selector «Acumulado» del gráfico): cada semana suma las de antes. */
export function acumulado(filas: SemanaInmo[]): SemanaInmo[] {
  let l = 0, a = 0;
  return filas.map((f) => { l += f.leads; a += f.agendas; return { ...f, leads: l, agendas: a }; });
}

// ── «Technicians» → quién vende ───────────────────────────────────────────────────────────────────────────────────────
export const ASESORES = 5;
export type AsesorInmo = { clave: string; nombre: string; iniciales: string; visitas: number; cierres: number; tasa: number | null; vendido: number; ancho: number; mejor: boolean };
export function asesoresDe(r: Resultado | null): AsesorInmo[] | null {
  if (!r) return null;
  const todas = filasDe(r).map((f) => ({ clave: f.clave, nombre: f.etiqueta || f.clave, visitas: enFila(r, f, 'asistencias') ?? 0, cierres: enFila(r, f, 'cierres') ?? 0, tasa: enFila(r, f, 'tasa_cierre'), vendido: enFila(r, f, 'vendido') ?? 0 }))
    .filter((a) => a.visitas > 0 || a.cierres > 0 || a.vendido > 0)
    .sort((a, b) => b.vendido - a.vendido || b.cierres - a.cierres).slice(0, ASESORES);
  const max = Math.max(0, ...todas.map((a) => a.vendido)), mejorTasa = Math.max(-1, ...todas.map((a) => a.tasa ?? -1));
  return todas.map((a) => ({ ...a, iniciales: iniciales(a.nombre), ancho: max > 0 ? a.vendido / max : 0, mejor: a.tasa != null && a.tasa === mejorTasa && a.tasa > 0 }));
}

// ── «Shop load» → cuántos agendan una visita ─────────────────────────────────────────────────────────────────────────
export type MedidorInmo = { leads: number | null; agendas: number | null; cierres: number | null; pct: number | null };
export function medidorDe(apertura: Resultado | null): MedidorInmo {
  const leads = total(apertura, 'leads'), agendas = total(apertura, 'agendas'), cierres = total(apertura, 'cierres');
  return { leads, agendas, cierres, pct: leads && agendas != null ? Math.min(100, (agendas / leads) * 100) : null };
}

// ── la hoja entera ──────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaInmo = {
  numeros: NumeroInmo[];
  medidor: MedidorInmo;
  proyectos: ReturnType<typeof proyectosDe>;
  tablero: ReturnType<typeof tableroDe>;
  origen: ReturnType<typeof partesDe>;
  semanas: ReturnType<typeof semanasDe>;
  asesores: AsesorInmo[] | null;
  motivos: ReturnType<typeof partesDe>;
  avances: TarjetaInmo[] | null;
  cargando: boolean;
  /** Si en el período no entró ningún interesado: la hoja lo dice y lleva al CRM. */
  vacia: boolean;
};
export function vistaInmobiliaria(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>): VistaInmo {
  const p = hoja.diseno?.piezas ?? {};
  const r = (k: string) => res(datos, p[k]);
  const proyectos = proyectosDe(r('proyectos'));
  const medidor = medidorDe(r('apertura'));
  return {
    numeros: numerosDe({ asistencia: r('asistencia'), cierre: r('cierre'), ticket: r('ticket'), ciclo: r('ciclo') }),
    medidor,
    proyectos,
    tablero: tableroDe(r('etapa'), r('tablero'), proyectos?.filas ?? []),
    origen: partesDe(r('origen'), 'leads', 5),
    semanas: semanasDe(r('semanas')),
    asesores: asesoresDe(r('asesores')),
    motivos: partesDe(r('motivos'), 'leads', 5),
    avances: avancesDe(r('tablero'), proyectos?.filas ?? []),
    cargando: Object.values(p).some((id) => datos[id]?.cargando),
    vacia: medidor.leads === 0,
  };
}
