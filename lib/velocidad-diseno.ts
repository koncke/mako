// =============================================================================
// velocidad-diseno — lo que dibuja cada tarjeta de la hoja «Velocidad de llamada» con su DISEÑO PROPIO (la copia de Tend, «Today»)
// =============================================================================
// Martín, 10/11/2026: «se inventó cosas en lugar de copiar los templates que ya estábamos copiando… con urgencia rehacer este
// dashboard. Y que quede como los otros que tenemos». La hoja de antes juntaba tarjetas de tres diseños (Cold Calling, Closing y la
// tabla de Marketing) con textos propios; ésta es la copia ENTERA de UN demo: la página «Today» de Tend, la recepción de una clínica,
// donde la sala de espera con los minutos de cada paciente y su botón «Call in» es lo mismo que un lead esperando que lo llamen.
// La copia y sus capturas: docs/diseno/mockups-dashboard/velocidad-tend/. La hoja la dibuja app/dashboard/disenos/HojaVelocidad.tsx con
// lo que arma `vistaVelocidad`, y la miniatura de «Nueva hoja» pasa por la MISMA función con datos de ejemplo
// (lib/velocidad-diseno-muestra.ts). Sin `server-only` y sin la base: se prueba (tests/dashboard-diseno-velocidad.test.ts).
//
// De dónde sale cada tarjeta (las piezas de la plantilla `velocidad-llamada`, lib/graficos-plantillas.ts):
//   · los cuatro números de arriba («Appointments today», «In the waiting room», «Unread on WhatsApp», «No-shows, last 30 days») →
//     `resumen` (el conjunto `primer_contacto`, con el período anterior): leads nuevos y contactados, esperando y su mediana, el primer
//     contacto y cuántos en la primera hora, y el % sin contactar contra el período anterior;
//   · «Patient flow» (Expected · Waiting room · In consult · Seen) → los leads por cómo va su primer contacto: los que entraron hace menos
//     de una hora (`recien`), los que ya esperan más (`recien` también: ordenada de la espera más corta a la más larga), los contactados
//     (`contactados`) y los que no se miden porque ya hablaban o no se sabe (`antes`, «Sin medir»). Los números de cada carril salen de `resumen`, no de las filas
//     (una tabla trae 50 como mucho);
//   · «WhatsApp · waiting on us» → `chats` (el conjunto `conversaciones` con la fecha «Hoy»): los chats de leads cuyo último mensaje es
//     de la persona, con hace cuánto escribió. Más de 24 h es «Urgente», como la fila marcada de la copia;
//   · «Clinicians today» → `hoy` (las llamadas grabadas HOY, una fila por llamada, con el lead, quién llamó, cómo terminó y a qué hora,
//     en la zona del negocio): una fila por quién llama y un bloque por llamada en su hora;
//   · «Reminders · Tomorrow» → `tramos` (los contactados por cuánto tardaron);
//   · «Visits» (2W · 30D) → `dias` (contactados y sin contactar, día por día);
//   · «Recalls due» → `esperan` (los sin contactar, de la espera más larga a la más corta), con «Llamar»;
//   · «Clinician load» → `carga` (los leads de cada setter, cuántos contactó y su mediana);
//   · «Team activity» → `hoy` otra vez: las llamadas de hoy, de la más tarde a la más temprano.
//
// ⚠️ Un número que no llegó es null, nunca 0: la tarjeta dibuja «—». Y lo que Tend tiene y MaKo no mide no está: el reloj de la clínica,
//    los recordatorios de mañana, el texto de cada mensaje (MaKo nunca lee el texto de un chat) y la cantidad de mensajes sin leer.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { duracionLegible, MINUTOS_A_TIEMPO } from './primer-contacto';
import { iniciales } from './hooks-diseno';
import { ROTULO_RESULTADO, SIN_MARCAR } from './grabar-llamada-reglas';

export type { DatosPieza };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const antes = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.anterior?.[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const SIN = '(sin dato)';
const filasDe = (r: Resultado | null) => (r ? r.filas.filter((f) => f.clave !== SIN && f.clave !== '') : []);
const extra = (f: Resultado['filas'][number], k: string): string | null => { const v = f.extra?.[k]; return v && v !== SIN ? v : null; };
/** «72%» (redondo) o «6.4%» debajo de 10. */
export const pct = (v: number) => (Math.abs(v) < 10 && Math.round(v) !== v ? `${(Math.round(v * 10) / 10).toFixed(1)}%` : `${Math.round(v)}%`);
/** Una duración corta para una píldora o un renglón chico: «12 min», «3 h», «2 d». */
export function corta(minutos: number | null): string | null {
  if (minutos == null || !Number.isFinite(minutos)) return null;
  const m = Math.round(minutos);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

// ── los cuatro números ──────────────────────────────────────────────────────────────────────────────────────────────────
export type ResumenVelocidad = {
  leads: number | null; contactados: number | null; sinContactar: number | null;
  /** De los sin contactar, los que llevan menos de una hora (todavía a tiempo): `sin_contactar − (base_1h − contactados)`. */
  aTiempo: number | null;
  /** Los sin contactar que ya llevan más de una hora. */
  esperando: number | null;
  /** Los que ya hablaban antes o no se sabe. */
  otros: number | null;
  enLaPrimeraHora: number | null; baseLaPrimeraHora: number | null;
  medianaContacto: number | null; medianaEspera: number | null;
  /** El % sin contactar, ahora y en el período anterior. */
  pctSin: number | null; pctSinAntes: number | null;
};
export function resumenDe(r: Resultado | null): ResumenVelocidad {
  const leads = total(r, 'leads'), contactados = total(r, 'contactados'), sin = total(r, 'sin_contactar'), base = total(r, 'base_1h');
  const esperando = base != null && contactados != null ? Math.max(0, base - contactados) : null;
  const aTiempo = sin != null && esperando != null ? Math.max(0, sin - esperando) : null;
  const yaHablaban = total(r, 'ya_hablaban');
  const otros = leads != null && contactados != null && sin != null ? Math.max(0, leads - contactados - sin) : yaHablaban;
  const la = antes(r, 'leads'), sa = antes(r, 'sin_contactar');
  return {
    leads, contactados, sinContactar: sin, aTiempo, esperando, otros,
    enLaPrimeraHora: total(r, 'en_1h'), baseLaPrimeraHora: base,
    medianaContacto: total(r, 'mediana_contacto'), medianaEspera: total(r, 'mediana_espera'),
    pctSin: leads && sin != null ? (sin / leads) * 100 : null,
    pctSinAntes: la && sa != null ? (sa / la) * 100 : null,
  };
}
export type NumeroVelocidad = { id: 'leads' | 'esperando' | 'contacto' | 'sin'; icono: 'cal' | 'door' | 'wa' | 'pulse'; nombre: string; texto: string | null; pill: string | null; bueno: boolean };
export function numerosDe(s: ResumenVelocidad, periodo: string): NumeroVelocidad[] {
  const ent = (n: number | null) => (n == null ? null : Math.round(n).toLocaleString('en-US'));
  const pctHora = s.baseLaPrimeraHora && s.enLaPrimeraHora != null ? (s.enLaPrimeraHora / s.baseLaPrimeraHora) * 100 : null;
  const mejor = s.pctSin != null && s.pctSinAntes != null && s.pctSin < s.pctSinAntes;
  return [
    { id: 'leads', icono: 'cal', nombre: 'Leads nuevos', texto: ent(s.leads), pill: s.contactados != null ? `${ent(s.contactados)} contactados` : null, bueno: false },
    // El mismo número que el carril «Esperando» y que «N esperando» del flujo (en Tend, el número y la sala de espera son el mismo 6): los
    // sin contactar de más de una hora. Los de menos de una hora todavía están a tiempo (el carril «Entraron»).
    { id: 'esperando', icono: 'door', nombre: 'Esperando contacto', texto: ent(s.esperando), pill: s.medianaEspera != null ? `mediana ${corta(s.medianaEspera)}` : null, bueno: s.medianaEspera != null && s.medianaEspera <= MINUTOS_A_TIEMPO },
    { id: 'contacto', icono: 'wa', nombre: 'Primer contacto', texto: corta(s.medianaContacto), pill: pctHora != null ? `${pct(pctHora)} en la primera hora` : null, bueno: false },
    { id: 'sin', icono: 'pulse', nombre: `Sin contactar, ${periodo.trim().toLowerCase()}`, texto: s.pctSin == null ? null : pct(s.pctSin), pill: s.pctSinAntes != null ? `era ${pct(s.pctSinAntes)} antes` : null, bueno: mejor },
  ];
}

// ── «Patient flow» → los cuatro carriles ─────────────────────────────────────────────────────────────────────────────────
/** Cuántas tarjetas dibuja un carril (la sala de espera de la copia tiene seis); con más, cinco y «+N más». */
export const TARJETAS = 6;
export type LeadVelocidad = { clave: string; ref: string | null; nombre: string; iniciales: string; dia: string | null; quien: string | null; minutos: number | null; canal: string | null; tramo: string | null };
export type CarrilVelocidad = { id: 'entraron' | 'esperando' | 'contactados' | 'otros'; nombre: string; n: number | null; leads: LeadVelocidad[]; mas: number };
function leadsDe(r: Resultado | null): LeadVelocidad[] {
  if (!r) return [];
  return filasDe(r).map((f) => {
    const nombre = f.etiqueta || f.clave;
    const seg = enFila(r, f, 'espera');
    return { clave: f.clave, ref: f.ref ?? null, nombre, iniciales: iniciales(nombre), dia: extra(f, 'dia'), quien: extra(f, 'setter') ?? extra(f, 'producto'), minutos: seg == null ? null : seg / 60, canal: extra(f, 'canal'), tramo: extra(f, 'tramo') };
  });
}
function carril(id: CarrilVelocidad['id'], nombre: string, n: number | null, todos: LeadVelocidad[]): CarrilVelocidad {
  const cuantos = n ?? todos.length;
  const caben = cuantos > TARJETAS ? TARJETAS - 1 : TARJETAS;
  const leads = todos.slice(0, caben);
  return { id, nombre, n, leads, mas: Math.max(0, cuantos - leads.length) };
}
export function carrilesDe(s: ResumenVelocidad, p: { recien: Resultado | null; contactados: Resultado | null; antes: Resultado | null }): CarrilVelocidad[] {
  const sin = leadsDe(p.recien);
  const aTiempo = sin.filter((l) => l.minutos != null && l.minutos < MINUTOS_A_TIEMPO);
  const esperan = sin.filter((l) => l.minutos == null || l.minutos >= MINUTOS_A_TIEMPO);
  return [
    carril('entraron', 'Entraron', s.aTiempo, aTiempo),
    carril('esperando', 'Esperando', s.esperando, esperan),
    carril('contactados', 'Contactados', s.contactados, leadsDe(p.contactados)),
    // «Seen» → los que no cuentan para la velocidad: ya hablaban antes de entrar, o no se sabe (cada tarjeta dice cuál).
    carril('otros', 'Sin medir', s.otros, leadsDe(p.antes)),
  ];
}

// ── «WhatsApp · waiting on us» → los chats que esperan ─────────────────────────────────────────────────────────────────────
/** Cuántos chats dibuja (la copia, seis). */
export const CHATS = 6;
/** Más que esto esperando es «Urgente» (el mismo umbral de 24 h con que la fuente cuenta «Esperando respuesta»). */
export const HORAS_URGENTE = 24;
export type ChatVelocidad = { clave: string; ref: string | null; nombre: string; iniciales: string; minutos: number; urgente: boolean; etapa: string | null };
export function chatsDe(r: Resultado | null): { filas: ChatVelocidad[]; total: number; masDe: boolean } | null {
  if (!r) return null;
  const filas = filasDe(r);
  const todos = filas.map((f) => {
    const seg = enFila(r, f, 'espera_respuesta');
    const nombre = f.etiqueta || f.clave;
    return seg == null ? null : { clave: f.clave, ref: f.ref ?? null, nombre, iniciales: iniciales(nombre), minutos: seg / 60, urgente: seg / 3600 > HORAS_URGENTE, etapa: extra(f, 'etapa') };
  }).filter((x): x is ChatVelocidad => x != null).sort((a, b) => a.minutos - b.minutos);
  // La pieza trae hasta 50, de la espera más corta a la más larga y con los que ya contestamos al final: si alguna de las filas ya no
  // espera, entraron todos los que esperan. Si las 50 esperan y quedó algo afuera, son «50 o más» (`masDe`): lo de afuera también
  // cuenta los chats ya contestados, así que sumarlo inflaría el número.
  const masDe = todos.length === filas.length && (r.fuera ?? 0) > 0;
  return { filas: todos.slice(0, CHATS), total: todos.length, masDe };
}

// ── «Clinicians today» y «Team activity» → las llamadas de hoy ─────────────────────────────────────────────────────────────
export type LlamadaHoy = { lead: string; ref: string | null; nombre: string; quien: string | null; resultado: string | null; hora: number; minutos: number | null };
/** El color de cada resultado: los de la leyenda de la copia, en su orden. */
export const COLOR_LLAMADA: Readonly<Record<string, 'teal' | 'mint' | 'sky' | 'coral' | 'sand'>> = {
  [ROTULO_RESULTADO.agendo]: 'teal', [ROTULO_RESULTADO.hablo]: 'mint', [ROTULO_RESULTADO.no_contesto]: 'sky', [ROTULO_RESULTADO.no_interesa]: 'coral', [SIN_MARCAR]: 'sand',
};
/** «09:40» → 9.67 (la hora como número, para ubicarla en la línea del día). */
export function horaDeTexto(v: string | null): number | null {
  const m = v ? /^(\d{1,2}):(\d{2})$/.exec(v.trim()) : null;
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h + min / 60 : null;
}
/** Una por llamada (la pieza tiene una fila por llamada, con el lead como su referencia); sin hora, no se dibuja. */
export function llamadasDeHoy(r: Resultado | null): LlamadaHoy[] | null {
  if (!r) return null;
  const out: LlamadaHoy[] = [];
  for (const f of filasDe(r)) {
    const hora = horaDeTexto(extra(f, 'hora'));
    if (hora == null) continue;
    out.push({ lead: f.clave, ref: f.ref ?? null, nombre: extra(f, 'lead') ?? f.etiqueta ?? f.clave, quien: extra(f, 'autor'), resultado: extra(f, 'resultado'), hora, minutos: enFila(r, f, 'minutos') });
  }
  return out;
}
export type FilaLinea = { quien: string; iniciales: string; llamadas: number; contestaron: number; bloques: Array<{ lead: string; nombre: string; hora: number; desde: number; dura: number; color: string; resultado: string | null }> };
/** Las filas de la línea del día: una por quién llama (los que más llamaron primero, cinco como la copia). */
export const FILAS_LINEA = 5;
export function lineaDe(llamadas: LlamadaHoy[] | null): { filas: FilaLinea[]; desde: number; hasta: number } | null {
  if (!llamadas) return null;
  const por = new Map<string, LlamadaHoy[]>();
  for (const l of llamadas) { const k = l.quien ?? 'Sin nombre'; por.set(k, [...(por.get(k) ?? []), l]); }
  const contesto = (r: string | null) => r === ROTULO_RESULTADO.agendo || r === ROTULO_RESULTADO.hablo || r === ROTULO_RESULTADO.no_interesa;
  const filas = [...por.entries()].map(([quien, ls]) => {
    const enHora = new Map<number, number>();
    const bloques = ls.slice().sort((a, b) => a.hora - b.hora).map((l) => {
      const k = enHora.get(l.hora) ?? 0; enHora.set(l.hora, k + 1);
      const dura = Math.max(0.25, Math.min(1, (l.minutos ?? 10) / 60));
      // Dos en el mismo minuto, una al lado de la otra.
      return { lead: l.lead, nombre: l.nombre, hora: l.hora, desde: l.hora + Math.min(0.75, k * 0.27), dura, color: COLOR_LLAMADA[l.resultado ?? SIN_MARCAR] ?? 'sand', resultado: l.resultado };
    });
    return { quien, iniciales: iniciales(quien), llamadas: ls.length, contestaron: ls.filter((l) => contesto(l.resultado)).length, bloques };
  }).sort((a, b) => b.llamadas - a.llamadas || a.quien.localeCompare(b.quien)).slice(0, FILAS_LINEA);
  const horas = llamadas.map((l) => l.hora);
  // El día de la copia va de las 8 a las 17; si alguien llamó antes o después, la línea se estira hasta esa hora.
  const desde = Math.min(8, ...horas.map(Math.floor)), hasta = Math.max(17, ...horas.map((h) => Math.floor(h) + 1));
  return { filas, desde, hasta };
}
export type ActividadVelocidad = { lead: string; ref: string | null; quien: string | null; nombre: string; resultado: string | null; hora: number };
export const ACTIVIDAD = 6;
export function actividadDe(llamadas: LlamadaHoy[] | null): ActividadVelocidad[] | null {
  if (!llamadas) return null;
  return llamadas.slice().sort((a, b) => b.hora - a.hora).slice(0, ACTIVIDAD).map((l) => ({ lead: l.lead, ref: l.ref, quien: l.quien, nombre: l.nombre, resultado: l.resultado, hora: l.hora }));
}

// ── «Reminders · Tomorrow» → cuánto tardaron ─────────────────────────────────────────────────────────────────────────────
/** Los cuatro tramos de los contactados, con el rótulo corto que entra en la columna de la copia, y su color (los de la copia). */
export const TRAMOS: ReadonlyArray<{ clave: string; rotulo: string; color: 'teal' | 'mint' | 'sky' | 'wa' }> = [
  { clave: 'En la primera hora', rotulo: 'En 1 hora', color: 'teal' },
  { clave: 'De 1 a 24 horas', rotulo: '1 a 24 h', color: 'mint' },
  { clave: 'De 1 a 3 días', rotulo: '1 a 3 días', color: 'sky' },
  { clave: 'Más de 3 días', rotulo: 'Más de 3 días', color: 'wa' },
];
export function tramosDe(r: Resultado | null): { filas: Array<{ clave: string; rotulo: string; color: string; valor: number }>; total: number } | null {
  if (!r) return null;
  const v = (k: string) => { const f = r.filas.find((x) => x.clave === k); return f ? enFila(r, f, 'leads') ?? 0 : 0; };
  const filas = TRAMOS.map((t) => ({ ...t, valor: v(t.clave) }));
  return { filas, total: filas.reduce((a, f) => a + f.valor, 0) };
}

// ── «Visits» → día por día ───────────────────────────────────────────────────────────────────────────────────────────────
export type DiaVelocidad = { clave: string; rotulo: string; contactados: number; sinContactar: number };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export const rotuloDia = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MESES[(m || 1) - 1]}`; };
/** Lo que muestra «2W»: los últimos 14 días. */
export const DIAS_CORTO = 14;
export function diasDe(r: Resultado | null): DiaVelocidad[] | null {
  if (!r) return null;
  return r.filas.filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f.clave)).sort((a, b) => a.clave.localeCompare(b.clave))
    .map((f) => ({ clave: f.clave, rotulo: rotuloDia(f.clave), contactados: enFila(r, f, 'contactados') ?? 0, sinContactar: enFila(r, f, 'sin_contactar') ?? 0 }));
}

// ── «Recalls due» → los que más esperan ──────────────────────────────────────────────────────────────────────────────────
export const ESPERAN = 5;
export function esperanDe(r: Resultado | null): LeadVelocidad[] | null {
  return r ? leadsDe(r).slice(0, ESPERAN) : null;
}

// ── «Clinician load» → la carga de cada setter ───────────────────────────────────────────────────────────────────────────
export const CARGA = 5;
export type CargaVelocidad = { clave: string; nombre: string; iniciales: string; leads: number; contactados: number; sinContactar: number; mediana: number | null; ancho: number };
export function cargaDe(r: Resultado | null): CargaVelocidad[] | null {
  if (!r) return null;
  return r.filas.map((f) => {
    const nombre = f.clave === SIN || !f.clave ? 'Sin setter' : f.etiqueta || f.clave;
    const leads = enFila(r, f, 'leads') ?? 0, contactados = enFila(r, f, 'contactados') ?? 0;
    return { clave: f.clave, nombre, iniciales: iniciales(nombre), leads, contactados, sinContactar: enFila(r, f, 'sin_contactar') ?? 0, mediana: enFila(r, f, 'mediana_contacto'), ancho: leads ? contactados / leads : 0 };
  }).filter((x) => x.leads > 0).sort((a, b) => b.leads - a.leads).slice(0, CARGA);
}

// ── la hoja entera ──────────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaVelocidad = {
  resumen: ResumenVelocidad;
  numeros: NumeroVelocidad[];
  carriles: CarrilVelocidad[];
  chats: ReturnType<typeof chatsDe>;
  linea: ReturnType<typeof lineaDe>;
  actividad: ActividadVelocidad[] | null;
  tramos: ReturnType<typeof tramosDe>;
  dias: DiaVelocidad[] | null;
  esperan: LeadVelocidad[] | null;
  carga: CargaVelocidad[] | null;
  cargando: boolean;
};
export function vistaVelocidad(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, periodo: string): VistaVelocidad {
  const p = hoja.diseno?.piezas ?? {};
  const r = (k: string) => res(datos, p[k]);
  const resumen = resumenDe(r('resumen'));
  const llamadas = llamadasDeHoy(r('hoy'));
  return {
    resumen, numeros: numerosDe(resumen, periodo),
    carriles: carrilesDe(resumen, { recien: r('recien'), contactados: r('contactados'), antes: r('antes') }),
    chats: chatsDe(r('chats')), linea: lineaDe(llamadas), actividad: actividadDe(llamadas),
    tramos: tramosDe(r('tramos')), dias: diasDe(r('dias')), esperan: esperanDe(r('esperan')), carga: cargaDe(r('carga')),
    cargando: Object.values(p).some((id) => datos[id]?.cargando),
  };
}

/** La duración dicha como la lee una persona («2 días 4 h»): el aria y el título de un bloque. */
export const legible = duracionLegible;
