// =============================================================================
// instagram-diseno — lo que dibuja la hoja «Instagram y redes» con su DISEÑO PROPIO (la copia de Murmura), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/instagram-murmura/; aquí, de dónde sale cada número con los DATOS REALES: los componentes de la
// hoja (`hoja.diseno.piezas`, lib/general-plantillas.ts, «instagram») y las publicaciones del Calendario de General. La pregunta:
// «¿qué publicación trajo gente de verdad?».
//   · arriba (el saludo de Murmura): lo que Instagram te mostró, cuántos tocaron y cuántos agendaron, y tres números: el alcance en
//     Instagram (de la fila de Instagram de «Instagram contra Facebook»), cuántos tocan el anuncio y lo invertido, con el costo por mil;
//   · «Próxima publicación» («Up next»): la próxima publicación del Calendario con lo que falta para que salga, y las que siguen;
//   · «Qué anuncio trajo clientes» («Needs you») y «El que más clientes trajo» («Top post this month»): los anuncios ordenados por los
//     cierres de sus leads (el primero arriba a la derecha, los demás en la lista: ningún anuncio dos veces);
//   · «Leads de tus anuncios» («Audience growth»): los leads de tus anuncios de Meta cada día, con las agendas;
//   · «Esta semana» («The week ahead»): los siete días desde hoy con lo que tienes agendado en el Calendario;
//   · «Cada red» («Network pulse»): Instagram, Facebook y el resto, con lo que te vieron, cuántos agendaron y cuántos tocan;
//   · «Quién te ve» («Inbox pulse»): las tres edades que más te ven, el reparto por género y las regiones donde más te ven;
//   · «De dónde llegan tus leads» («Team activity»): cada origen con sus leads.
//
// LO QUE MURMURA TIENE Y MaKo NO MIDE NO SE INVENTA: los seguidores (y su crecimiento), la interacción de cada publicación, los
// guardados, las aprobaciones del equipo, la bandeja de mensajes con su sentimiento y la actividad del equipo. Meta tampoco da las
// agendas por región (con ese desglose no manda ninguna conversión, lib/graficos-audiencia.ts) ni el alcance sumado entre filas.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaInstagram.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { DatosGeneral } from '@/app/general/datos-tipos';
import type { Hoja } from './graficos-catalogo';
import { OTROS, SIN_DATO, type Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { Trozo } from './comercial-diseno';
import { diaEnZona, horaEn } from './focus-diseno';
import { cuandoSale, serieDe, type SerieCurso } from './curso-diseno';
import { corto, entero, plata } from './marketing-diseno';
import { ROTULO_FORMATO, type FormatoPublicacion, type ItemCalendario } from './calendario-modelo';

export type { DatosPieza, Trozo };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
/** Las filas de verdad: sin «(sin dato)» ni «Otros». */
const filasDe = (r: Resultado) => r.filas.filter((f) => f.etiqueta && f.clave !== SIN_DATO && f.clave !== OTROS);
const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${n === 1 ? uno : varios}`;
const sumarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
/** «12,4 %» con un decimal; debajo de 1, con dos (un CTR de 0,8 % sin decimales es «1 %»). */
export const porciento = (v: number) => `${v.toLocaleString('es-MX', { minimumFractionDigits: v < 1 ? 2 : 1, maximumFractionDigits: v < 1 ? 2 : 1 })}%`;
const esInstagram = (s: string) => /instagram/i.test(s);

// ── la frase de arriba ─────────────────────────────────────────────────────────
/**
 * «Instagram te mostró 48.2k veces, 1,230 tocaron tu anuncio y 31 agendaron.» (la de Murmura: el saludo con lo que tienes en tus
 * redes). Sin impresiones, nada: Instagram no te mostró, o Meta no está conectada.
 */
export function fraseInstagram(impresiones: number | null, clics: number | null, agendas: number | null): Trozo[] {
  if (impresiones == null) return [];
  if (impresiones === 0) return [{ tipo: 'texto', s: 'Instagram todavía no mostró tus anuncios en este período.' }];
  const t: Trozo[] = [{ tipo: 'texto', s: 'Instagram te mostró ' }, { tipo: 'fuerte', s: `${corto(impresiones)} veces` }];
  if (clics != null) t.push({ tipo: 'texto', s: agendas != null ? ', ' : ' y ' }, { tipo: 'fuerte', s: entero(clics) }, { tipo: 'texto', s: clics === 1 ? ' tocó tu anuncio' : ' tocaron tu anuncio' });
  if (agendas != null) {
    t.push({ tipo: 'texto', s: ' y ' });
    if (agendas === 0) t.push({ tipo: 'texto', s: 'nadie agendó' });
    else t.push({ tipo: 'fuerte', s: entero(agendas) }, { tipo: 'texto', s: agendas === 1 ? ' agendó' : ' agendaron' });
  }
  t.push({ tipo: 'texto', s: '.' });
  return t;
}

// ── los tres números de arriba ─────────────────────────────────────────────────
export type NumeroIg = { id: 'alcance' | 'ctr' | 'gasto'; titulo: string; valor: string | null; pie: string | null };
/**
 * El alcance NO sale de su propia pieza: Meta lo da por fila y no se suma (la métrica es `sinTotal`), así que un número sin desglose
 * no lo trae nunca. Sale de la fila de Instagram de «Instagram contra Facebook», que lo trae tal cual.
 */
export function numerosDe(plataformas: Resultado | null, ctr: Resultado | null, gasto: Resultado | null, cpm: Resultado | null): NumeroIg[] {
  const ig = plataformas ? filasDe(plataformas).find((f) => esInstagram(f.etiqueta)) : null;
  const alcance = plataformas && ig ? enFila(plataformas, ig, 'alcance') : null;
  const c = total(ctr, 'ctr'), g = total(gasto, 'gasto'), m = total(cpm, 'cpm');
  return [
    { id: 'alcance', titulo: 'Alcance en Instagram', valor: alcance == null ? null : corto(alcance), pie: null },
    { id: 'ctr', titulo: 'Tocan el anuncio', valor: c == null ? null : porciento(c), pie: null },
    { id: 'gasto', titulo: 'Inversión en Instagram', valor: g == null ? null : plata(g), pie: m == null ? null : `${plata(m)} por cada mil vistas` },
  ];
}

// ── las publicaciones del Calendario ───────────────────────────────────────────
export type PublicacionIg = {
  id: string; titulo: string; detalle: string | null; formato: FormatoPublicacion | null; rotuloFormato: string;
  /** «Mañana, 9:00». */
  cuando: string; href: string | null;
};
export type ProximaIg = PublicacionIg & {
  /** «1 día 3 h», «45 min», «Ahora»: lo que falta para que salga. */
  falta: string;
};
export const FILAS_SIGUEN = 6;
/** Las dos letras de un formato, en la insignia de un turno («RE», «ST»). */
export const insigniaDe = (f: FormatoPublicacion | null) => (f ? ROTULO_FORMATO[f] : 'Publicación').slice(0, 2).toUpperCase();
/** Lo que falta para un instante: días y horas, o minutos debajo de una hora. */
export function faltaPara(inicio: number, ahora: number): string {
  const min = Math.max(0, Math.round((inicio - ahora) / 60_000));
  if (min < 1) return 'Ahora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), d = Math.floor(h / 24);
  return d >= 1 ? `${d} ${d === 1 ? 'día' : 'días'} ${h % 24} h` : `${h} h ${min % 60} min`;
}
/** Lo que falta para una publicación de todo el día: «Hoy», «Mañana» o «3 días» (no tiene hora para contar las horas). */
export function faltaDias(dia: string, hoy: string): string {
  const d = Math.round((Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 864e5);
  return d <= 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${d} días`;
}
type Cal = { items: ItemCalendario[]; tz: string; hoy: string };
const publicaciones = (cal: Cal, ahora: number) => cal.items
  .filter((i) => i.capa === 'publicaciones' && !i.hecho && new Date(i.fin ?? i.inicio).getTime() >= ahora)
  .sort((a, b) => a.inicio.localeCompare(b.inicio));
const deItem = (i: ItemCalendario, cal: Cal): PublicacionIg => ({
  id: i.id, titulo: i.titulo, detalle: i.notas?.trim() || i.detalle || null, formato: i.formato ?? null,
  rotuloFormato: i.formato ? ROTULO_FORMATO[i.formato] : 'Publicación', cuando: cuandoSale(i.inicio, i.diaCompleto, cal.tz, cal.hoy), href: i.href,
});
export function proximasDe(cal: Cal, ahora: number): { proxima: ProximaIg | null; siguen: PublicacionIg[]; total: number } {
  const todas = publicaciones(cal, ahora);
  const [p, ...resto] = todas;
  return {
    proxima: p ? { ...deItem(p, cal), falta: p.diaCompleto ? faltaDias(diaEnZona(p.inicio, cal.tz), cal.hoy) : faltaPara(Date.parse(p.inicio), ahora) } : null,
    siguen: resto.slice(0, FILAS_SIGUEN).map((i) => deItem(i, cal)),
    total: todas.length,
  };
}

/** Un día de «Tu semana de publicaciones»: sus turnos (hasta tres), cuántos más hay y si es hoy. */
export type TurnoIg = { id: string; hora: string; insignia: string; formato: FormatoPublicacion | null; titulo: string; href: string | null };
export type DiaIg = { dia: string; nombre: string; numero: number; hoy: boolean; turnos: TurnoIg[]; mas: number; total: number };
export const TURNOS_POR_DIA = 3;
export function semanaDe(cal: Cal): { dias: DiaIg[]; total: number } {
  const dias: DiaIg[] = [];
  let suma = 0;
  for (let k = 0; k < 7; k++) {
    const dia = sumarDias(cal.hoy, k);
    const de = cal.items.filter((i) => i.capa === 'publicaciones' && diaEnZona(i.inicio, cal.tz) === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
    suma += de.length;
    dias.push({
      dia, nombre: DIAS[new Date(`${dia}T12:00:00Z`).getUTCDay()], numero: Number(dia.slice(8, 10)), hoy: k === 0,
      turnos: de.slice(0, TURNOS_POR_DIA).map((i) => ({ id: i.id, hora: i.diaCompleto ? 'Todo el día' : horaEn(i.inicio, cal.tz), insignia: insigniaDe(i.formato ?? null), formato: i.formato ?? null, titulo: i.titulo, href: i.href })),
      mas: Math.max(0, de.length - TURNOS_POR_DIA), total: de.length,
    });
  }
  return { dias, total: suma };
}

// ── los anuncios que trajeron clientes ─────────────────────────────────────────
export type AnuncioIg = { clave: string; nombre: string; imagen: string | null; cierres: number | null; agendas: number | null; leads: number | null };
/** Los anuncios en el orden de la pieza (por los cierres de sus leads): el primero va arriba a la derecha, el resto en la lista. */
export function anunciosDe(r: Resultado | null): { top: AnuncioIg | null; resto: AnuncioIg[]; total: number } | null {
  if (!r) return null;
  const lista = filasDe(r).map((f) => ({
    clave: f.clave, nombre: f.etiqueta, imagen: f.imagen ?? null,
    cierres: enFila(r, f, 'cierres'), agendas: enFila(r, f, 'agendas'), leads: enFila(r, f, 'leads'),
  }));
  const [top, ...resto] = lista;
  return { top: top ?? null, resto, total: lista.length + r.fuera };
}

// ── los leads de tus anuncios, día por día ─────────────────────────────────────
/**
 * Los puntos del eje de abajo que llevan rótulo, como los de Murmura: desde el PRIMER día, a la misma distancia, hasta `max`
 * rótulos, y el último día siempre (el de Murmura dice «Oct 6, Oct 9 … Oct 30, Nov 2, Nov 4»; en el teléfono, «Oct 6, Oct 14,
 * Oct 22, Oct 30, Nov 4»). Si el último queda a menos de dos lugares del anterior, el anterior se va: se pisarían.
 */
export function marcasDesdeElPrimero(n: number, max: number): number[] {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const paso = Math.ceil((n - 1) / (Math.max(2, max) - 1));
  const out: number[] = [];
  for (let i = 0; i < n - 1; i += paso) out.push(i);
  if (n - 1 - out[out.length - 1] < 2) out.pop();
  out.push(n - 1);
  return out;
}
export type LeadsIg = SerieCurso & { agendas: number | null; x: Array<{ rotulo: string; pct: number }>; xTel: Array<{ rotulo: string; pct: number }> };
export function leadsDe(r: Resultado | null): LeadsIg | null {
  const s = serieDe(r, 'leads', total(r, 'leads'));
  if (!s) return null;
  const n = s.puntos.length;
  const ejes = (max: number) => marcasDesdeElPrimero(n, max).map((i) => ({ rotulo: s.puntos[i].rotulo, pct: n > 1 ? (i / (n - 1)) * 100 : 0 }));
  return { ...s, agendas: total(r, 'agendas'), x: ejes(11), xTel: ejes(5) };
}

// ── cada red ───────────────────────────────────────────────────────────────────
export type RedIg = { clave: string; nombre: string; impresiones: number; barra: number; agendas: number | null; ctr: number | null; icono: 'instagram' | 'facebook' | 'messenger' | 'whatsapp' | 'red' };
const ICONO_RED = (s: string): RedIg['icono'] => (/instagram/i.test(s) ? 'instagram' : /facebook/i.test(s) ? 'facebook' : /messenger/i.test(s) ? 'messenger' : /whatsapp/i.test(s) ? 'whatsapp' : 'red');
export function redesDe(r: Resultado | null): RedIg[] | null {
  if (!r) return null;
  const filas = filasDe(r).map((f) => ({ f, imp: enFila(r, f, 'impresiones') ?? 0 })).sort((a, b) => b.imp - a.imp);
  const max = Math.max(1, ...filas.map((x) => x.imp));
  return filas.map(({ f, imp }) => {
    const clics = enFila(r, f, 'clics');
    return { clave: f.clave, nombre: f.etiqueta, impresiones: imp, barra: (imp / max) * 100, agendas: enFila(r, f, 'agendas'), ctr: clics != null && imp ? (clics / imp) * 100 : null, icono: ICONO_RED(f.etiqueta) };
  });
}

// ── quién te ve ────────────────────────────────────────────────────────────────
export type ParteIg = { clave: string; nombre: string; n: number; pct: number };
const partesDe = (r: Resultado | null, metrica: string): ParteIg[] | null => {
  if (!r) return null;
  const filas = filasDe(r).map((f) => ({ clave: f.clave, nombre: f.etiqueta, n: enFila(r, f, metrica) ?? 0 })).filter((x) => x.n > 0);
  const suma = filas.reduce((s, x) => s + x.n, 0);
  return suma ? filas.map((x) => ({ ...x, pct: (x.n / suma) * 100 })) : [];
};
export const EDADES = 3, REGIONES = 3;
export type QuienIg = { edades: ParteIg[] | null; genero: ParteIg[] | null; regiones: ParteIg[] | null };
/** Las tres edades que más te ven (cada una con su parte del total), el reparto por género y las regiones donde más te ven. */
export function quienDe(edad: Resultado | null, genero: Resultado | null, region: Resultado | null): QuienIg {
  const e = partesDe(edad, 'impresiones'), g = partesDe(genero, 'impresiones'), rg = partesDe(region, 'impresiones');
  return {
    edades: e ? [...e].sort((a, b) => b.n - a.n).slice(0, EDADES) : null,
    genero: g ? [...g].sort((a, b) => b.n - a.n) : null,
    regiones: rg ? [...rg].sort((a, b) => b.n - a.n).slice(0, REGIONES) : null,
  };
}

// ── de dónde llegan tus leads ──────────────────────────────────────────────────
export const FILAS_ORIGEN = 7;
export function origenDe(r: Resultado | null): { lista: ParteIg[]; mas: number } | null {
  const p = partesDe(r, 'leads');
  if (!p) return null;
  const orden = [...p].sort((a, b) => b.n - a.n);
  return { lista: orden.slice(0, FILAS_ORIGEN), mas: Math.max(0, orden.length - FILAS_ORIGEN) + (r?.fuera ?? 0) };
}

// ── toda la hoja ───────────────────────────────────────────────────────────────
/**
 * El texto de un fallo de Meta: el NUESTRO cuando dice qué hacer («Conecta Meta para ver tu audiencia», «Vuelve a conectar Meta…»,
 * lib/graficos-audiencia.ts), y si no, el fijo de la tarjeta. El error de una pieza es texto libre (un `fetch failed`, el de Meta en
 * inglés): no se pinta tal cual.
 */
export function deMeta(error: string | undefined, fijo: string): string {
  return error && /^(Conecta|Vuelve a conectar) Meta\b/.test(error.trim()) ? error.trim() : fijo;
}
export type GeneralDeInstagram = Pick<DatosGeneral, 'calendario'>;
export type VistaInstagram = {
  frase: Trozo[];
  numeros: NumeroIg[];
  proximas: { proxima: ProximaIg | null; siguen: PublicacionIg[]; total: number } | null;
  semana: { dias: DiaIg[]; total: number } | null;
  anuncios: { top: AnuncioIg | null; resto: AnuncioIg[]; total: number } | null;
  leads: LeadsIg | null;
  redes: RedIg[] | null;
  quien: QuienIg;
  origen: { lista: ParteIg[]; mas: number } | null;
  problemas: Partial<Record<'numeros' | 'calendario' | 'anuncios' | 'leads' | 'redes' | 'quien' | 'origen', string>>;
};
export function vistaInstagram(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, general: GeneralDeInstagram | null, ahora: number): VistaInstagram {
  const p = hoja.diseno?.piezas ?? {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  const problemas: VistaInstagram['problemas'] = {};
  if (err(p.apertura) || err(p.ctr) || err(p.cpm) || err(p.gasto)) problemas.numeros = deMeta(err(p.apertura) ?? err(p.ctr), 'No pude leer algunos números de Meta.');
  if (err(p.anuncios)) problemas.anuncios = 'No pude leer tus anuncios.';
  if (err(p.leads)) problemas.leads = 'No pude leer los leads de tus anuncios.';
  if (err(p.plataformas)) problemas.redes = deMeta(err(p.plataformas), 'No pude leer tus redes.');
  if (err(p.edad) || err(p.genero) || err(p.region)) problemas.quien = deMeta(err(p.edad) ?? err(p.genero) ?? err(p.region), 'No pude leer quién te ve.');
  if (err(p.origen)) problemas.origen = 'No pude leer de dónde llegan tus leads.';
  // Sin los datos de General (un link compartido no los trae) no se pudieron leer: no es «nada agendado».
  const cal = general?.calendario.ok && !general.calendario.d.falla ? general.calendario.d : null;
  if (!cal) problemas.calendario = 'No pude leer tu Calendario.';

  const ap = res(datos, p.apertura), plataformas = res(datos, p.plataformas);
  return {
    frase: fraseInstagram(total(ap, 'impresiones'), total(ap, 'clics'), total(ap, 'agendas')),
    numeros: numerosDe(plataformas, res(datos, p.ctr), res(datos, p.gasto), res(datos, p.cpm)),
    proximas: cal ? proximasDe(cal, ahora) : null,
    semana: cal ? semanaDe(cal) : null,
    anuncios: anunciosDe(res(datos, p.anuncios)),
    leads: leadsDe(res(datos, p.leads)),
    redes: redesDe(plataformas),
    quien: quienDe(res(datos, p.edad), res(datos, p.genero), res(datos, p.region)),
    origen: origenDe(res(datos, p.origen)),
    problemas,
  };
}

/** «3 publicaciones esta semana», «Nada agendado esta semana». */
export const textoSemana = (n: number) => (n ? `${plural(n, 'publicación', 'publicaciones')} esta semana` : 'Nada agendado esta semana');
