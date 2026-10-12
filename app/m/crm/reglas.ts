// =============================================================================
// /m/crm — las reglas PURAS del CRM en el teléfono (sin server-only, sin React)
// =============================================================================
// Lo lee el server (lib/crm-movil.ts, app/m/crm/acciones.ts) y lo leen los
// componentes cliente (el sheet de agendar, el de mover). Vive aquí para poder
// probarlo solo (tests/crm-movil.test.ts) y para que la MISMA regla decida en el
// botón y en la server action: lo que la pantalla no ofrece, la acción tampoco
// lo hace.
// =============================================================================

import { coincideBusqueda } from '@/lib/buscar-texto';
import { numeroCanonico } from '@/lib/contacto-lead';
import { pideWizardAlElegir } from '@/app/crm/mover-etapa';

// ── Buscador ──────────────────────────────────────────────────────────────────

/** Lo mínimo de un lead para buscarlo. */
export type LeadBuscable = {
  id: number;
  nombre: string | null;
  empresa?: string | null;
  email?: string | null;
  telefono?: string | null;
};

/** La fila que viaja al teléfono: ~20 de éstas, NUNCA la cartera. */
export type FilaLeadM = { id: number; nombre: string; segunda: string | null };

export const MAX_RESULTADOS = 20;
/** Menos de esto no se busca: «a» trae media cartera y no ayuda a nadie. */
export const MIN_BUSQUEDA = 2;

/**
 * Busca como el tablero (coincideBusqueda: sin acentos, términos en cualquier
 * orden, «#412» por id, dígitos por id y después por teléfono) y devuelve las
 * primeras `max` en el orden recibido (el de la cartera: más nuevos primero).
 */
export function buscarEnCartera(leads: readonly LeadBuscable[], q: string, max = MAX_RESULTADOS): { filas: FilaLeadM[]; hayMas: boolean } {
  const query = (q ?? '').trim();
  if (query.length < MIN_BUSQUEDA) return { filas: [], hayMas: false };
  const filas: FilaLeadM[] = [];
  for (const l of leads) {
    if (!coincideBusqueda([l.id, l.nombre, l.empresa, l.email, l.telefono], query)) continue;
    if (filas.length === max) return { filas, hayMas: true };
    filas.push({ id: l.id, nombre: l.nombre?.trim() || 'Sin nombre', segunda: l.empresa?.trim() || l.email?.trim() || null });
  }
  return { filas, hayMas: false };
}

// ── Contacto ──────────────────────────────────────────────────────────────────

/**
 * `tel:+52…` con el número canónico (521·10 y 52·10 son la misma línea). null si
 * el número no alcanza los 10 dígitos: un tel: con 7 cifras marca a cualquiera.
 *
 * ⚠️ NO SE INVENTA EL PAÍS: un número guardado sin código (10 dígitos pelados) sale
 * tal cual, sin «+», y el teléfono lo marca como local. Agregarle 52 a ciegas haría
 * llamar a México a un lead de Uruguay.
 */
export function telHref(tel: string | null | undefined): string | null {
  const n = numeroCanonico(tel);
  if (!n) return null;
  return n.length > 10 ? `tel:+${n}` : `tel:${n}`;
}

/** wa.me sólo con código de país (sin él, wa.me abre otro número o ninguno). */
export function waMeHref(tel: string | null | undefined): string | null {
  const n = numeroCanonico(tel);
  return n && n.length > 10 ? `https://wa.me/${n}` : null;
}

// ── Mover de etapa ────────────────────────────────────────────────────────────

export type EtapaM = { key: string; label: string; kind?: string | null };

/** Las etapas en la forma de lib/funnel-etapas (kind sin null). */
export const comoLite = (stages: readonly EtapaM[]) => stages.map((s) => ({ key: s.key, kind: s.kind ?? undefined }));

/**
 * Las etapas que NO se mueven desde el teléfono, además de las del wizard:
 *  · `ganado` y las de cobro/cierre (`kind` pago o cierre): piden el monto, invitan
 *    al curso y mueven Revenue; un toque en el bolsillo no puede hacer eso.
 *  · Por las dudas, cualquier key `ganado` aunque el embudo no tenga `kind`.
 * Lo de Meta (calificado, asistencia) tampoco se ofrece: el teléfono nunca manda
 * esos toques (son conversiones que no se deshacen).
 */
export function seMueveEnElTelefono(stages: readonly EtapaM[], key: string): boolean {
  if (!key || key === 'ganado') return false;
  const e = stages.find((s) => s.key === key);
  if (!e) return false;
  if (e.kind === 'pago' || e.kind === 'cierre') return false;
  return !pideWizardAlElegir(comoLite(stages), key);
}

/** A qué etapas se puede mover desde aquí (sin la actual), en el orden del embudo. */
export function etapasMovibles(stages: readonly EtapaM[], actual: string | null): EtapaM[] {
  // Sólo lo que el sheet necesita: las etapas del embudo traen colores y columnas que no viajan.
  return stages.filter((s) => s.key !== actual && seMueveEnElTelefono(stages, s.key)).map((s) => ({ key: s.key, label: s.label, kind: s.kind ?? null }));
}

// ── Agendar ───────────────────────────────────────────────────────────────────

export type ReunionesLead = {
  fecha_junta_1: string | null;
  junta_1_at: string | null;
  fecha_junta_2: string | null;
  junta_2_at: string | null;
};

export type CualAgendar = {
  cual: 'r1' | 'r2';
  /** true = ya hay una agendada que todavía no pasó: se MUEVE, no se crea otra. */
  mueve: boolean;
  /** «Agendar R2», «Mover la R1». */
  titulo: string;
};

/** ¿Ya pasó esa reunión? Con hora, por el instante; sin hora, por el día. */
function yaPaso(fecha: string | null, at: string | null, ahoraMs: number, hoyISO: string): boolean {
  if (at) {
    const t = Date.parse(at);
    if (Number.isFinite(t)) return t < ahoraMs;
  }
  return !!fecha && fecha < hoyISO;
}

/**
 * Qué reunión agenda el botón, decidido con los DATOS (nunca con el nombre de la
 * etapa, que un movimiento a mano pudo dejar atrasado):
 *  · sin R1 → agendar la R1;
 *  · R1 por delante → mover la R1;
 *  · R1 pasada, sin R2 → agendar la R2;
 *  · R2 cargada → mover la R2 (haya pasado o no: reagendar un no-show es esto).
 */
export function cualAgendar(l: ReunionesLead, ahoraMs: number, hoyISO: string): CualAgendar {
  if (!l.fecha_junta_1 && !l.junta_1_at) return { cual: 'r1', mueve: false, titulo: 'Agendar R1' };
  if (!yaPaso(l.fecha_junta_1, l.junta_1_at, ahoraMs, hoyISO)) return { cual: 'r1', mueve: true, titulo: 'Mover la R1' };
  if (!l.fecha_junta_2 && !l.junta_2_at) return { cual: 'r2', mueve: false, titulo: 'Agendar R2' };
  return { cual: 'r2', mueve: true, titulo: 'Mover la R2' };
}

/** «jue 16» de un YYYY-MM-DD (sin zona: el día ya viene en la del negocio). */
export function rotuloDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return fecha;
  const p = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }).formatToParts(d);
  const v = (t: Intl.DateTimeFormatPartTypes) => (p.find((x) => x.type === t)?.value ?? '').replace('.', '');
  return `${v('weekday')} ${v('day')}`;
}

/** YYYY-MM-DD + n días (en UTC puro: es aritmética de calendario, no de instantes). */
export function masDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Los chips de día: Hoy · Mañana · +2 · +3 (el «Otro día» lo agrega la pantalla). */
export function chipsDeDia(hoyISO: string): Array<{ fecha: string; rotulo: string }> {
  return [
    { fecha: hoyISO, rotulo: 'Hoy' },
    { fecha: masDias(hoyISO, 1), rotulo: 'Mañana' },
    { fecha: masDias(hoyISO, 2), rotulo: rotuloDia(masDias(hoyISO, 2)) },
    { fecha: masDias(hoyISO, 3), rotulo: rotuloDia(masDias(hoyISO, 3)) },
  ];
}

/** El botón nombra la acción y el horario: «Agendar R2 jue 16, 10:00». */
export function rotuloAgendar(c: CualAgendar, fecha: string, hora: string): string {
  const verbo = c.mueve ? `Mover la ${c.cual.toUpperCase()} al` : `Agendar ${c.cual.toUpperCase()}`;
  return `${verbo} ${rotuloDia(fecha)}, ${hora}`;
}

// ── Siguiente acción ──────────────────────────────────────────────────────────

export type SiguienteAccion = {
  tipo: 'reunion' | 'llamada' | 'insight' | 'etapa' | 'seguimiento';
  /** La acción, en una frase corta. */
  titulo: string;
  /** El detalle (lo que dijo la llamada, lo que falta), en prosa. */
  detalle: string | null;
};

/**
 * La «siguiente acción» armada con lo que YA está escrito (no hay un campo así en
 * la base). En orden, la primera que exista gana:
 *   1. la próxima reunión (es lo que más pronto hay que hacer);
 *   2. el próximo paso de la última llamada analizada;
 *   3. la próxima acción del último diagnóstico del lead;
 *   4. lo que la etapa todavía le debe (datos sin marcar);
 *   5. el seguimiento que MaKo dejó escrito y nadie mandó.
 * null = no hay nada escrito: la pantalla no inventa una.
 */
export function siguienteAccion(p: {
  proximaReunion: { cual: string; cuando: string } | null;
  proximoPasoLlamada: string | null;
  proximaAccionInsight: string | null;
  faltantes: readonly string[];
  seguimientoSinEnviar: boolean;
}): SiguienteAccion | null {
  if (p.proximaReunion) return { tipo: 'reunion', titulo: `${p.proximaReunion.cual} ${p.proximaReunion.cuando}`, detalle: null };
  const paso = p.proximoPasoLlamada?.trim();
  if (paso) return { tipo: 'llamada', titulo: 'Próximo paso de la llamada', detalle: paso };
  const ins = p.proximaAccionInsight?.trim();
  if (ins) return { tipo: 'insight', titulo: 'Lo que sigue', detalle: ins };
  if (p.faltantes.length) return { tipo: 'etapa', titulo: 'Faltan datos de la etapa', detalle: p.faltantes.join(' · ') };
  if (p.seguimientoSinEnviar) return { tipo: 'seguimiento', titulo: 'Mandar el seguimiento', detalle: 'MaKo lo dejó escrito.' };
  return null;
}

// ── Formato ───────────────────────────────────────────────────────────────────

/** «10:00» de un instante, en la zona del negocio. */
export function horaEnTz(iso: string | null | undefined, tz: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}

/** YYYY-MM-DD de un instante, en la zona del negocio. */
export function diaEnTz(iso: string, tz: string): string | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** «hoy 10:00», «mañana 18:30», «jue 16 10:00». */
export function cuandoCorto(iso: string, tz: string, hoyISO: string): string {
  const dia = diaEnTz(iso, tz);
  const hora = horaEnTz(iso, tz) ?? '';
  if (!dia) return '';
  const d = dia === hoyISO ? 'hoy' : dia === masDias(hoyISO, 1) ? 'mañana' : rotuloDia(dia);
  return `${d} ${hora}`.trim();
}

// ── v2: lo que dicen las filas ────────────────────────────────────────────────
// La lista (Hoy · Por responder · Nuevos), la ficha (Próxima llamada, Llegó por) y su
// actividad. Todo se arma en el SERVER con la zona del NEGOCIO (la misma que usa el
// escritorio con useTzWorkspace) y viaja como texto: así el server y el navegador dibujan
// lo mismo y no hay error de hidratación.

/** «Primera llamada» / «Segunda llamada»: así las nombra el prototipo v2. */
export const NOMBRE_REUNION: Record<'R1' | 'R2', string> = { R1: 'Primera llamada', R2: 'Segunda llamada' };

const sinPuntos = (s: string) => s.replace(/\./g, '');
const mayuscula = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** «ayer», «lun», «12 oct»: un DÍA (YYYY-MM-DD, ya en la zona del negocio) visto desde hoy. */
export function diaRelativo(dia: string | null | undefined, hoyISO: string): string {
  if (!dia) return '';
  if (dia === hoyISO) return 'hoy';
  if (dia === masDias(hoyISO, -1)) return 'ayer';
  const d = new Date(`${dia}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return '';
  const dif = Math.round((Date.parse(`${hoyISO}T12:00:00Z`) - d.getTime()) / 864e5);
  if (dif > 1 && dif < 7) return sinPuntos(new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short' }).format(d));
  return sinPuntos(new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(d));
}

/** El riel de una fila con un momento: la HORA si fue hoy («8:12»); si no, el día («ayer», «sáb»). */
export function cuandoEnLista(iso: string | null | undefined, tz: string, hoyISO: string): string {
  if (!iso) return '';
  const dia = diaEnTz(iso, tz);
  if (!dia) return '';
  return dia === hoyISO ? (horaEnTz(iso, tz) ?? '') : diaRelativo(dia, hoyISO);
}

/** Hace cuánto («ahora», «12 min», «3 h») si fue hoy; si no, el día («ayer», «lun»). */
export function haceCuanto(iso: string | null | undefined, ahoraMs: number, tz: string, hoyISO: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((ahoraMs - t) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const dia = diaEnTz(iso, tz);
  if (dia === hoyISO) return `${Math.floor(min / 60)} h`;
  return diaRelativo(dia, hoyISO);
}

/**
 * La próxima llamada del lead, como la dice la ficha: «Hoy, 10:30», «Mañana», «Jue 16, 18:00».
 * La primera de R1/R2 que todavía no pasó. null = ninguna por delante («Sin agendar»).
 *
 * ⚠️ `junta_N_at` SÓLO VALE SI CAE EN `fecha_junta_N`: una reunión reagendada sin hora deja el
 * instante viejo (la misma trampa que cuida reunionesDeHoy en lib/crm-movil.ts). En ese caso
 * se dice el día, sin hora; nunca la hora de la reunión de antes.
 */
export function proximaLlamada(r: ReunionesLead, ahoraMs: number, tz: string, hoyISO: string): { cual: 'R1' | 'R2'; texto: string } | null {
  const cand = [
    { cual: 'R1' as const, at: r.junta_1_at, fecha: r.fecha_junta_1 },
    { cual: 'R2' as const, at: r.junta_2_at, fecha: r.fecha_junta_2 },
  ];
  const futuras: Array<{ cual: 'R1' | 'R2'; orden: number; dia: string; hora: string | null }> = [];
  for (const c of cand) {
    const diaAt = c.at ? diaEnTz(c.at, tz) : null;
    const dia = c.fecha?.slice(0, 10) || diaAt;
    if (!dia) continue;
    if (c.at && diaAt === dia) {
      const t = Date.parse(c.at);
      if (t > ahoraMs) futuras.push({ cual: c.cual, orden: t, dia, hora: horaEnTz(c.at, tz) });
    } else if (dia >= hoyISO) {
      futuras.push({ cual: c.cual, orden: Date.parse(`${dia}T23:59:59Z`), dia, hora: null });
    }
  }
  futuras.sort((a, b) => a.orden - b.orden);
  const f = futuras[0];
  if (!f) return null;
  const d = f.dia === hoyISO ? 'Hoy' : f.dia === masDias(hoyISO, 1) ? 'Mañana' : mayuscula(rotuloDia(f.dia));
  return { cual: f.cual, texto: f.hora ? `${d}, ${f.hora}` : d };
}

/** Lo que el CRM dice cuando no sabe por dónde entró (SIN_ORIGEN_LISTA, app/crm/origen-lead.ts). */
const SIN_ORIGEN = 'Sin origen';

/**
 * «Llegó por»: el CANAL (canalDeLead: Landing, Formulario de Meta, Importado…) y, si se sabe,
 * lo más específico (el anuncio o la campaña). Sin repetir: «Landing · Landing» no dice más.
 */
export function llegoPor(canal: string | null | undefined, detalle: string | null | undefined): string | null {
  const c = canal?.trim() && canal.trim() !== SIN_ORIGEN ? canal.trim() : null;
  const d = detalle?.trim() && detalle.trim() !== SIN_ORIGEN && detalle.trim() !== c ? detalle.trim() : null;
  if (c && d) return `${c} · ${d}`;
  return c ?? d;
}

/** Un ícono del set de los menús (app/_ui/iconos-menu.tsx): su tipo fija que el nombre exista. */
export type IconoActividad = 'etapa' | 'calendario' | 'check' | 'dinero' | 'editar' | 'reloj';

export type LineaActividad = { titulo: string; segunda: string | null; icono: IconoActividad };

const ESTADOS: Record<string, string> = { abierto: 'Abierto', ganado: 'Ganado', perdido: 'Perdido', descalificado: 'Descalificado', no_responde: 'No responde' };
const DATOS = new Set(['Nombre', 'Email', 'Teléfono', 'Empresa', 'Web', 'Closer', 'Setter', 'Motivo']);
const PLATA = /pago|cobr|monto|suscrip|reembols|cierre/i;
const AGENDA = /reuni|agenda|calendly|calendar/i;

/** Los campos del historial que la ficha NO cuenta como actividad (las notas tienen su sección). */
export const FUERA_DE_ACTIVIDAD: ReadonlySet<string> = new Set(['Nota', 'Auditoría']);

/**
 * Una fila de `lead_audit` como UNA línea de «Actividad». `etiqueta` traduce una key de etapa a
 * su nombre en el funnel (el historial guarda la KEY, y a veces el nombre: se aceptan los dos).
 */
export function lineaActividad(campo: string, valorNuevo: string | null, etiqueta: (v: string) => string | undefined): LineaActividad {
  const v = valorNuevo?.trim() || null;
  const corto = (s: string | null) => (s && s.length > 70 ? `${s.slice(0, 69)}…` : s);
  if (campo === 'Etapa') return { titulo: v ? `En ${etiqueta(v) ?? v}` : 'Sin etapa', segunda: null, icono: 'etapa' };
  if (campo === 'Estado') return { titulo: v ? (ESTADOS[v] ?? v) : 'Sin estado', segunda: null, icono: 'etapa' };
  const r = /^(Fecha|Asistió) R([12])$/.exec(campo);
  if (r) {
    const cual = r[2] === '1' ? 'primera' : 'segunda';
    if (r[1] === 'Asistió') {
      const t = v === 'Sí' ? `Asistió a la ${cual} llamada` : v === 'No' ? `No asistió a la ${cual} llamada` : `Asistencia a la ${cual} llamada`;
      return { titulo: t, segunda: null, icono: 'check' };
    }
    return { titulo: v ? `${mayuscula(cual)} llamada · ${rotuloDia(v.slice(0, 10))}` : `${mayuscula(cual)} llamada sin fecha`, segunda: null, icono: 'calendario' };
  }
  if (DATOS.has(campo)) return { titulo: `Cambió: ${campo}`, segunda: corto(v), icono: 'editar' };
  if (PLATA.test(campo)) return { titulo: campo, segunda: corto(v), icono: 'dinero' };
  if (AGENDA.test(campo)) return { titulo: campo, segunda: corto(v), icono: 'calendario' };
  return { titulo: campo, segunda: corto(v), icono: 'reloj' };
}

/** La columna en la que DIBUJA el tablero de escritorio (CrmBoard `effStage`): la que no existe cae a la primera. */
export function etapaEnTablero(stage: string, keys: readonly string[]): string {
  return keys.includes(stage) ? stage : (keys[0] ?? stage);
}
