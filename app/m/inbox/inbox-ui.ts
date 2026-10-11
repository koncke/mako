// =============================================================================
// /m/inbox — las decisiones de la PANTALLA, puras (sin React, sin server)
// =============================================================================
// Lo que el sheet de una decisión necesita saber y que se prueba sin navegador:
//   · qué dicen sus botones (acción + objeto, nunca «Sí / No / Confirmar» a secas);
//   · qué parámetros de una acción simple se pueden corregir en el teléfono;
//   · con qué forma se le manda el payload a `confirmarAccionMovil` (TODOS los
//     parámetros declarados, null si quedaron vacíos: es lo que espera la acción de
//     escritorio, app/mako/revisar/[id]/acciones.ts);
//   · cuándo un error quiere decir «ya no está pendiente» (vencida o resuelta en
//     otro lado), que no es una falla: se dice así y la fila sale.
//
// Lo importa InboxM.tsx ('use client'): SÓLO tipos de lib/inbox-movil-reglas.ts.
// =============================================================================

import type { Parametro } from '@/lib/api-mako/tipos';
import type { ItemDecision, TipoDecision } from '@/lib/inbox-movil-reglas';

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

/** El toast del éxito: 3-4 palabras, qué pasó. */
export function toastDeExito(tipo: TipoDecision, salida: boolean): string {
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

/** El riel de una pendiente: «42 min», «1 h 20», «Vencida». */
export function rielDeVence(min: number | null): string | null {
  if (min == null) return null;
  if (min < 0) return 'Vencida';
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
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

/** El héroe: el número ADENTRO de la frase. Con 0 o sin saberlo, nada (habla el vacío). */
export function fraseHeroe(n: number, hayFallas: boolean): string | null {
  if (hayFallas || n <= 0) return null;
  return n === 1 ? 'Te espera 1 decisión' : `Te esperan ${n} decisiones`;
}
