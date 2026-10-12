// =============================================================================
// /m/inbox — las decisiones de la PANTALLA, puras (sin React, sin server)
// =============================================================================
// Lo que la fila y el sheet de una decisión necesitan saber y que se prueba sin navegador:
//   · qué dicen sus botones (acción + objeto, nunca «Sí / No / Confirmar» a secas);
//   · la UNA línea gris de la fila y la consecuencia pegada al botón;
//   · qué parámetros de una acción simple se pueden corregir en el teléfono;
//   · con qué forma se le manda el payload a `confirmarAccionMovil` (TODOS los
//     parámetros declarados, null si quedaron vacíos: es lo que espera la acción de
//     escritorio, app/mako/revisar/[id]/acciones.ts);
//   · cuándo un error quiere decir «ya no está pendiente» (vencida o resuelta en
//     otro lado), que no es una falla: se dice así y la fila sale;
//   · la hora del riel («9:40», «ayer», «lun», «12 oct») en el reloj del teléfono.
//
// Lo importa InboxM.tsx ('use client'): SÓLO tipos de lib/inbox-movil-reglas.ts, y
// `horaCorta` de app/m/_ui/formato.ts (puro).
// =============================================================================

import type { Parametro } from '@/lib/api-mako/tipos';
import type { ItemDecision, LineaDetalle, TipoDecision } from '@/lib/inbox-movil-reglas';
import { horaCorta } from '../_ui/formato';

// ── Lo que dice cada botón ───────────────────────────────────────────────────

export type RotulosDecision = {
  /** El botón primario: acción + objeto. null = no se decide en el teléfono. */
  primario: string | null;
  /** La salida, debajo: también con objeto. null = no hay. */
  salida: string | null;
};

export function rotulosDe(item: Pick<ItemDecision, 'tipo' | 'accionMovil'>): RotulosDecision {
  if (item.accionMovil === 'computadora') return { primario: null, salida: null };
  if (item.tipo === 'pendiente') return { primario: 'Ejecutar la acción', salida: 'No ejecutar la acción' };
  if (item.tipo === 'accion') return { primario: 'Aplicar la propuesta', salida: 'Descartar la propuesta' };
  // Las confirmaciones del CRM traen sus propios botones (`opciones`), ya con objeto.
  return { primario: null, salida: null };
}

/**
 * El toast del éxito: 3-4 palabras, qué pasó. En un cambio del CRM, `decision` es la
 * opción que se tocó ('confirmar' = dejarlo, 'rechazar' = deshacerlo, 'op:…' = otra).
 */
export function toastDeExito(tipo: TipoDecision, salida: boolean, decision?: string): string {
  if (tipo === 'confirmacion') {
    if (decision === 'confirmar') return 'Cambio confirmado';
    if (decision === 'rechazar') return 'Cambio deshecho';
    return 'Listo';
  }
  if (salida) return tipo === 'accion' ? 'Propuesta descartada' : 'No se ejecutó';
  if (tipo === 'pendiente') return 'Acción ejecutada';
  if (tipo === 'accion') return 'Propuesta aplicada';
  return 'Listo';
}

// ── «Ya no está pendiente» no es una falla ───────────────────────────────────

/**
 * Los textos con que las acciones de escritorio contestan que la cosa ya no espera a
 * nadie: venció (las pendientes duran 2 h), la resolvió otra persona (en la compu, en
 * WhatsApp) o ya se estaba ejecutando. Medidos en lib/api-mako/acciones.ts (:192, :197,
 * :205, :254) y app/mako/revisar/[id]/acciones.ts (:44, :73).
 */
const YA_NO = [
  /no hay ninguna acción pendiente vigente/i,
  /no encuentro la acción .* vigente/i,
  /ya estaba resuelta/i,
  /ya se estaba ejecutando o ya venció/i,
  /esta propuesta ya está/i,
];

export function yaNoPendiente(error: string | null | undefined): boolean {
  const e = (error ?? '').trim();
  return !!e && YA_NO.some((r) => r.test(e));
}

// ── Lo que vence ─────────────────────────────────────────────────────────────

/** Minutos que le quedan (negativo = venció). null si no vence o la fecha no sirve. */
export function minutosRestantes(venceAt: string | null | undefined, ahora: number): number | null {
  const t = Date.parse(venceAt ?? '');
  if (!Number.isFinite(t)) return null;
  return Math.floor((t - ahora) / 60_000);
}

/** Lo que le queda a una pendiente: «42 min», «1 h 20», «Vencida». */
export function rielDeVence(min: number | null): string | null {
  if (min == null) return null;
  if (min < 0) return 'Vencida';
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

// ── La fila: una línea gris que distingue a esta decisión de las otras ───────

/**
 * La segunda línea de la fila (v2: «si dice lo mismo en todas, se va»). Por eso el
 * origen no va acá (casi siempre es el mismo): va al sheet.
 *   · pendiente → la operación y cuánto le queda («Mover de etapa · vence en 42 min»);
 *   · acción    → la operación, si el título no la dice ya;
 *   · cambio del CRM → el primer cambio («Etapa: Asistió → Ganado»), o el lead;
 *   · contactos / borradores → lo que traen («3 contactos para revisar», «4 tareas»).
 */
export function segundaDe(item: Pick<ItemDecision, 'tipo' | 'titulo' | 'resumen' | 'detalle'>, min: number | null): string | null {
  const op = item.resumen && item.resumen !== item.titulo ? item.resumen : null;
  if (item.tipo === 'pendiente') {
    const vence = min == null ? null : min < 0 ? 'Vencida' : `vence en ${rielDeVence(min)}`;
    return [op, vence].filter(Boolean).join(' · ') || null;
  }
  if (item.tipo === 'accion') return op;
  if (item.tipo === 'confirmacion') {
    const l = item.detalle[0];
    return l ? `${l.rotulo}: ${l.valor}` : op;
  }
  return item.resumen || null;
}

// ── El sheet: la consecuencia pegada al botón ────────────────────────────────

type ParaConsecuencia =
  | Pick<Extract<ItemDecision, { tipo: 'confirmacion' }>, 'tipo' | 'accionMovil' | 'opciones'>
  | (Pick<ItemDecision, 'tipo' | 'accionMovil' | 'deshacer'> & { tipo: Exclude<TipoDecision, 'confirmacion'> });

/**
 * En TINTA, arriba del primario, y corta. Un cambio del CRM que MaKo YA aplicó trae
 * «Dejar el cambio» entre sus opciones (`opcionesDeConfirmacion`): eso lo distingue de
 * uno que espera que se elija (sin depender del texto de `consecuencia`).
 */
export function consecuenciaDe(item: ParaConsecuencia, vencida: boolean): string {
  if (item.accionMovil === 'computadora') return 'Se revisa en la computadora.';
  if (item.tipo === 'confirmacion') {
    return item.opciones.some((o) => o.decision === 'confirmar') ? 'MaKo ya hizo este cambio.' : 'Todavía no se aplicó.';
  }
  if (vencida) return 'Venció: ya no se puede ejecutar.';
  if (item.deshacer === false) return 'Se ejecuta ahora y no se puede deshacer.';
  if (item.deshacer === true) return 'Se ejecuta ahora. Se puede deshacer.';
  return 'Se ejecuta en cuanto confirmes.';
}

/** «vino por WhatsApp» → «WhatsApp»; «vino del chat de la app» → «Chat de la app». Para la fila «Origen». */
export function origenCorto(origen: string): string {
  const s = origen.trim().replace(/^vino\s+(por|del|de)\s+/i, '').replace(/^(la|el|una|un)\s+/i, '');
  if (!s) return origen;
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Un cambio de ETAPA que tiene «antes» se dibuja grande («Asistió › Ganado», como en el
 * prototipo). Sale de las líneas de `lineasDeCambios` («antes → después»). null si no hay.
 */
export function cambioDeEtapa(lineas: readonly LineaDetalle[]): { linea: LineaDetalle; antes: string; despues: string } | null {
  const l = lineas.find((x) => /^etapa$/i.test(x.rotulo.trim()) && x.valor.includes(' → '));
  if (!l) return null;
  const [antes, ...resto] = l.valor.split(' → ');
  const despues = resto.join(' → ').trim();
  return antes.trim() && despues ? { linea: l, antes: antes.trim(), despues } : null;
}

/** Un valor corto va a la derecha de su rótulo (como Ajustes); uno largo, debajo. */
export function esLineaCorta(valor: string): boolean {
  return valor.length <= 24 && !valor.includes('\n');
}

/** El texto que sale a una persona (un mensaje) se lee como lo va a leer ella: en burbuja. */
export function esMensaje(rotulo: string): boolean {
  return /mensaje|texto/i.test(rotulo);
}

// ── Cuándo: en el reloj del teléfono ─────────────────────────────────────────

const DIA_MS = 86_400_000;
const DIA_SEMANA = new Intl.DateTimeFormat('es', { weekday: 'short' });
const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const sinPunto = (s: string) => s.replace(/\./g, '').trim();
const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * El riel de una fila: «9:40» si fue hoy, «ayer», el día de la semana («lun») si fue en
 * los últimos 6 días, y si no «12 oct». null si la fecha no sirve. Se llama DESPUÉS de
 * montar (el server no sabe la zona del teléfono: daría un desfase de hidratación).
 */
export function cuandoCorto(iso: string | null | undefined, ahora: number): string | null {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.getTime())) return null;
  const dias = Math.round((inicioDelDia(new Date(ahora)) - inicioDelDia(d)) / DIA_MS);
  if (dias <= 0) return horaCorta(d);
  if (dias === 1) return 'ayer';
  if (dias < 7) return sinPunto(DIA_SEMANA.format(d));
  return sinPunto(FECHA.format(d));
}

/** Para la fila «Cuándo» del sheet: «Hoy, 9:40», «Ayer, 18:02», «Lun, 10:15», «12 oct, 9:00». */
export function cuandoLargo(iso: string | null | undefined, ahora: number): string | null {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.getTime())) return null;
  const dias = Math.round((inicioDelDia(new Date(ahora)) - inicioDelDia(d)) / DIA_MS);
  const dia = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : dias < 7 ? sinPunto(DIA_SEMANA.format(d)) : sinPunto(FECHA.format(d));
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${horaCorta(d)}`;
}

// ── Parámetros editables de una acción simple ────────────────────────────────

/** Un id en pantalla es jerga (la misma regla que lineasDelPayload): ni se muestra ni se edita. */
const esId = (nombre: string): boolean => nombre === 'id' || /Id$|_id$/.test(nombre);

/**
 * «La pantalla de confirmación es EDITABLE»: texto, número y sí/no se corrigen en el
 * teléfono. Listas y objetos no (el escritorio los edita como JSON crudo).
 */
export function esEditable(p: Pick<Parametro, 'nombre' | 'tipo'>): boolean {
  if (esId(p.nombre)) return false;
  return p.tipo === 'string' || p.tipo === 'number' || p.tipo === 'boolean';
}

/** Lo que muestra el campo al abrir: el valor guardado, como texto o booleano. */
export function valorInicial(p: Pick<Parametro, 'tipo'>, v: unknown): string | boolean {
  if (p.tipo === 'boolean') return v === true;
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return '';
}

export type ResultadoPayload = { ok: true; payload: Record<string, unknown> } | { ok: false; error: string };

/**
 * El payload que se confirma: el guardado, con las correcciones encima, y CADA
 * parámetro declarado presente (null si quedó vacío) — la forma que espera
 * `confirmarAccionAction`. Un número que no es número no se manda: se dice cuál.
 */
export function armarPayload(
  parametros: readonly Pick<Parametro, 'nombre' | 'tipo' | 'rotulo'>[],
  guardado: Record<string, unknown> | null | undefined,
  ediciones: Readonly<Record<string, string | boolean>>,
): ResultadoPayload {
  const base: Record<string, unknown> = { ...(guardado ?? {}) };
  for (const p of parametros) {
    if (!(p.nombre in base)) base[p.nombre] = null;
    if (!(p.nombre in ediciones) || !esEditable(p)) continue;
    const e = ediciones[p.nombre];
    if (p.tipo === 'boolean') { base[p.nombre] = e === true; continue; }
    const s = typeof e === 'string' ? e.trim() : '';
    if (!s) { base[p.nombre] = null; continue; }
    if (p.tipo === 'number') {
      const n = Number(s.replace(',', '.'));
      if (!Number.isFinite(n)) return { ok: false, error: `${p.rotulo ?? p.nombre}: tiene que ser un número` };
      base[p.nombre] = n;
      continue;
    }
    base[p.nombre] = s;
  }
  return { ok: true, payload: base };
}

// ── Las fallas de lectura, dichas ────────────────────────────────────────────

const QUE_NO_LEI: Readonly<Record<TipoDecision, string>> = {
  pendiente: 'las acciones de MaKo',
  accion: 'las propuestas de MaKo',
  confirmacion: 'los cambios del CRM',
  lead: 'los contactos para revisar',
  borrador: 'los borradores del plan',
};

/** «No pude leer las propuestas de MaKo y los cambios del CRM.» — nunca un vacío mudo. */
export function fraseDeFallas(fallas: readonly TipoDecision[]): string | null {
  const partes = fallas.map((t) => QUE_NO_LEI[t]).filter(Boolean);
  if (!partes.length) return null;
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
  return `No pude leer ${lista}.`;
}

// ── La vista y el link que abre una decisión ─────────────────────────────────

export type VistaInbox = 'decidir' | 'avisos';

/** `?vista=avisos` abre en Avisos (un push de un aviso); sin permiso de avisos, siempre «Para decidir». */
export function vistaDeParam(v: unknown, conAvisos: boolean): VistaInbox {
  return conAvisos && v === 'avisos' ? 'avisos' : 'decidir';
}

/**
 * `?abrir=<key>` abre esa decisión en su sheet al entrar (la tarjeta de Today lleva acá
 * sin dibujar una segunda versión del sheet). Sólo la forma de una `key` de
 * `ItemDecision` («pendiente:12», «accion:prop_ab12»); lo demás, null.
 */
export function claveDeParam(v: unknown): string | null {
  return typeof v === 'string' && /^(pendiente|accion|lead|borrador|confirmacion):[A-Za-z0-9_-]{1,80}$/.test(v) ? v : null;
}
