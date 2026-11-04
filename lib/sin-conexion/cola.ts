// =============================================================================
// MaKo sin conexión — la cola de cambios: qué se puede escribir sin red y cómo se sube (T2, 28/10/2026)
// =============================================================================
// Puro y sin dependencias de runtime: lo usan el cascarón (escribir sin red, y dibujar lo pendiente encima de la copia), la
// app (el panel que lo sube con el OK de la persona) y el servidor (validar lo que llega y decidir campo por campo).
// El diseño: docs/diseno-mako-desktop-sin-conexion.md, punto 4.
//
// LO QUE SE ESCRIBE SIN RED (cada uno pasa al volver por la MISMA puerta que el teléfono, con la sesión de la persona):
//   · nota          → una nota en un lead (`notaLeadAction`);
//   · etapa         → mover un lead de etapa, sólo entre las que el teléfono mueve (`moverEtapaAction`);
//   · contacto      → el nombre, el email o la empresa de un lead (lo que escritorio edita en la ficha);
//   · tarea-estado  → mover una tarea de columna, «Completada» incluida (`moverTareaAction`);
//   · tarea-nueva   → una tarea nueva, que al subir queda como BORRADOR para confirmar en el Plan: ninguna alta entra
//                     directo (lib/api-mako/areas/plan.run.ts: «eso pasa SOLO por un borrador»).
// El título de una tarea queda para la T3: el tablero del dueño sólo se guarda con la fila entera (guardarPlanTarea).
//
// CADA CAMBIO LLEVA LO QUE LA PERSONA VIO («antes») Y LO QUE PUSO («después»). Al subir, `decidirCampo` compara con el valor
// de HOY: igual a «antes» se aplica; igual a «después» ya estaba; otro valor es un conflicto (lo cambió otra persona o una
// automatización) y gana el servidor hasta que la persona elija «Aplicar el mío».
// =============================================================================

import type { TableroCrmM, TarjetaCrmM } from '@/app/m/crm/datos';
import type { TareaKanbanM } from '@/app/m/plan/tableros';
import type { CopiaV1 } from './reglas';

/** Lo largo que puede ser una nota (el mismo tope que el alta de escritorio: app/crm/notas-reglas.ts → TOPE_NOTA). */
export const TOPE_NOTA_COLA = 4000;
export const TOPE_TITULO = 200;
export const TOPE_DATO = 300;
/** Cuántos cambios puede guardar la cola. Más es otra cosa que «se cortó un rato». */
export const TOPE_COLA = 200;

export const CAMPOS_CONTACTO_COLA = ['nombre', 'email', 'empresa'] as const;
export type CampoContactoCola = (typeof CAMPOS_CONTACTO_COLA)[number];
const ROTULO_CAMPO: Record<CampoContactoCola, string> = { nombre: 'el nombre', email: 'el email', empresa: 'la empresa' };

export type Cambio =
  | { tipo: 'nota'; leadId: number; texto: string }
  | { tipo: 'etapa'; leadId: number; funnelId: number | null; antes: string; despues: string }
  | { tipo: 'contacto'; leadId: number; campo: CampoContactoCola; antes: string | null; despues: string | null }
  | { tipo: 'tarea-estado'; tareaId: string; antes: string; despues: string }
  | { tipo: 'tarea-nueva'; titulo: string };

/** Un cambio en la cola. `id` es su llave de idempotencia: subirlo dos veces lo aplica una. */
export type Operacion = { id: string; ws: number; hecha: string; cambio: Cambio };

/**
 * Lo que contesta el servidor por cada cambio.
 *   · aplicada / ya-estaba / borrador → listo: sale de la cola.
 *   · rechazada → no se aplicó y no se reintenta (permiso, un lead que ya no está): se muestra con su motivo y su texto.
 *   · conflicto → otro valor en el servidor; la persona elige «Aplicar el mío» (`forzar`) o «Dejar».
 *   · espera-ok → tiene consecuencias (una automatización le escribe al lead): no sale sin el OK de la persona.
 *   · incierta → se cortó a mitad de aplicarlo y no se sabe si quedó: la persona revisa y decide.
 *   · reintentar → ahora no se pudo (otra ventana lo está subiendo, falta la tabla): queda en la cola tal cual.
 */
export type EstadoResultado = 'aplicada' | 'ya-estaba' | 'borrador' | 'rechazada' | 'conflicto' | 'espera-ok' | 'incierta' | 'reintentar';
export type Resultado = { estado: EstadoResultado; motivo?: string; servidor?: string | null; link?: string };

/** Los que sacan el cambio de la cola sin preguntar nada más. */
export const sale = (e: EstadoResultado): boolean => e === 'aplicada' || e === 'ya-estaba' || e === 'borrador';

export const RE_ID_OP = /^[A-Za-z0-9_-]{8,64}$/;

/** Dos valores de un campo, como los compara una persona: sin espacios alrededor, vacío = nada, el email sin mayúsculas. */
export function mismoValor(a: string | null | undefined, b: string | null | undefined, campo?: string): boolean {
  const n = (x: string | null | undefined) => {
    const t = (x ?? '').trim();
    return campo === 'email' ? t.toLowerCase() : t;
  };
  return n(a) === n(b);
}

/** La decisión campo por campo (punto 4 del diseño). «Ya estaba» va primero: si alguien hizo el MISMO cambio, no es un conflicto. */
export function decidirCampo(actual: string | null | undefined, antes: string | null | undefined, despues: string | null | undefined, campo?: string): 'aplicar' | 'ya-estaba' | 'conflicto' {
  if (mismoValor(actual, despues, campo)) return 'ya-estaba';
  if (mismoValor(actual, antes, campo)) return 'aplicar';
  return 'conflicto';
}

const texto = (x: unknown, tope: number): string | null => (typeof x === 'string' && x.trim() && x.length <= tope ? x : null);
const textoONulo = (x: unknown, tope: number): string | null | undefined => (x === null ? null : typeof x === 'string' && x.length <= tope ? x : undefined);
const entero = (x: unknown): number | null => (typeof x === 'number' && Number.isInteger(x) && x > 0 ? x : null);
const clave = (x: unknown): string | null => (typeof x === 'string' && /^[A-Za-z0-9_:.-]{1,80}$/.test(x) ? x : null);

/** Lo que llega del navegador, revisado entero. null = no es un cambio que se pueda aplicar (no se adivina nada). */
export function validarOperacion(x: unknown): Operacion | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const id = typeof o.id === 'string' && RE_ID_OP.test(o.id) ? o.id : null;
  const ws = entero(o.ws);
  const hecha = typeof o.hecha === 'string' && Number.isFinite(Date.parse(o.hecha)) ? o.hecha : null;
  const c = o.cambio && typeof o.cambio === 'object' ? (o.cambio as Record<string, unknown>) : null;
  if (!id || !ws || !hecha || !c) return null;
  let cambio: Cambio | null = null;
  if (c.tipo === 'nota') {
    const leadId = entero(c.leadId);
    const t = texto(c.texto, TOPE_NOTA_COLA);
    if (leadId && t) cambio = { tipo: 'nota', leadId, texto: t.trim() };
  } else if (c.tipo === 'etapa') {
    const leadId = entero(c.leadId);
    const funnelId = c.funnelId === null ? null : entero(c.funnelId);
    const antes = clave(c.antes);
    const despues = clave(c.despues);
    if (leadId && (c.funnelId === null || funnelId) && antes && despues && antes !== despues) cambio = { tipo: 'etapa', leadId, funnelId, antes, despues };
  } else if (c.tipo === 'contacto') {
    const leadId = entero(c.leadId);
    const campo = (CAMPOS_CONTACTO_COLA as readonly unknown[]).includes(c.campo) ? (c.campo as CampoContactoCola) : null;
    const antes = textoONulo(c.antes, TOPE_DATO);
    const despues = textoONulo(c.despues, TOPE_DATO);
    if (leadId && campo && antes !== undefined && despues !== undefined && !(campo === 'nombre' && !despues?.trim())) {
      cambio = { tipo: 'contacto', leadId, campo, antes, despues: despues === null ? null : despues.trim() };
    }
  } else if (c.tipo === 'tarea-estado') {
    const tareaId = typeof c.tareaId === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(c.tareaId) ? c.tareaId : null;
    const antes = clave(c.antes);
    const despues = clave(c.despues);
    if (tareaId && antes && despues && antes !== despues) cambio = { tipo: 'tarea-estado', tareaId, antes, despues };
  } else if (c.tipo === 'tarea-nueva') {
    const t = texto(c.titulo, TOPE_TITULO);
    if (t) cambio = { tipo: 'tarea-nueva', titulo: t.trim() };
  }
  return cambio ? { id, ws, hecha, cambio } : null;
}

// ── Lo pendiente, encima de la copia ─────────────────────────────────────────

export type Pendientes = { leads: Set<number>; tareas: Set<string> };

function tarjetasDe(copia: CopiaV1, leadId: number): Array<{ t: TableroCrmM; c: TarjetaCrmM }> {
  return (copia.crm?.tableros ?? []).flatMap((t) => t.tarjetas.filter((c) => c.id === leadId).map((c) => ({ t, c })));
}

/**
 * La copia como la ve la persona con sus cambios todavía sin subir: la copia guardada no se toca (es lo que dijo el
 * servidor) y la cola se aplica ENCIMA cada vez que se dibuja. Así, renovar la copia con conexión nunca borra lo que se
 * escribió sin ella. Devuelve también qué leads y tareas tienen algo pendiente, para marcarlos «Se sube al volver».
 */
export function conLoPendiente(copia: CopiaV1, ops: readonly Operacion[]): { copia: CopiaV1; pendientes: Pendientes } {
  const out = structuredClone(copia) as CopiaV1;
  const pendientes: Pendientes = { leads: new Set(), tareas: new Set() };
  for (const op of ops) {
    if (op.ws !== out.negocio.id) continue;
    const c = op.cambio;
    if (c.tipo === 'nota' && out.crm) {
      const lista = (out.crm.notas[String(c.leadId)] ??= []);
      lista.unshift({ texto: c.texto, cuando: op.hecha, autor: out.persona.nombre, pendiente: true });
      pendientes.leads.add(c.leadId);
    } else if (c.tipo === 'etapa') {
      for (const { t, c: tarjeta } of tarjetasDe(out, c.leadId)) {
        if ((t.funnelId ?? null) !== c.funnelId || tarjeta.col === c.despues || !t.columnas.some((x) => x.key === c.despues)) continue;
        const de = t.columnas.find((x) => x.key === tarjeta.col);
        const a = t.columnas.find((x) => x.key === c.despues);
        if (de) de.cuantos = Math.max(0, de.cuantos - 1);
        if (a) a.cuantos += 1;
        tarjeta.col = c.despues;
        pendientes.leads.add(c.leadId);
      }
    } else if (c.tipo === 'contacto') {
      for (const { c: tarjeta } of tarjetasDe(out, c.leadId)) {
        if (c.campo === 'nombre') tarjeta.nombre = c.despues?.trim() || tarjeta.nombre;
        else if (tarjeta.contacto) tarjeta.contacto = { ...tarjeta.contacto, [c.campo]: c.despues?.trim() || null };
        pendientes.leads.add(c.leadId);
      }
    } else if (c.tipo === 'tarea-estado' && out.plan) {
      const t = out.plan.tareas.find((x) => x.id === c.tareaId);
      if (t && t.col !== c.despues && out.plan.columnas.some((x) => x.key === c.despues)) {
        const de = out.plan.columnas.find((x) => x.key === t.col);
        const a = out.plan.columnas.find((x) => x.key === c.despues);
        if (de) de.cuantos = Math.max(0, de.cuantos - 1);
        if (a) a.cuantos += 1;
        t.col = c.despues;
        pendientes.tareas.add(t.id);
      }
    } else if (c.tipo === 'tarea-nueva' && out.plan) {
      const primera = out.plan.columnas[0];
      if (!primera) continue;
      const nueva: TareaKanbanM = {
        id: op.id, titulo: c.titulo, proyecto: null, deadline: null, cuando: 'sin-fecha', banda: 'media', esInstancia: false,
        vencida: false, linkEscritorio: '/plan', estado: 'por_hacer', col: primera.key, prioridad: 'sin_priorizar',
        motivo: 'Borrador: se confirma al volver la conexión',
      };
      out.plan.tareas.unshift(nueva);
      primera.cuantos += 1;
      pendientes.tareas.add(op.id);
    }
  }
  return { copia: out, pendientes };
}

// ── En palabras ──────────────────────────────────────────────────────────────

const recorte = (t: string, n = 60) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** El cambio en una línea, para el panel que lo sube. Con la copia, los nombres; sin ella, lo que se pueda. */
export function describir(op: Operacion, copia?: CopiaV1 | null): string {
  const c = op.cambio;
  const lead = (id: number) => (copia ? tarjetasDe(copia, id)[0]?.c.nombre : null) ?? `el lead #${id}`;
  const columna = (funnelId: number | null, key: string) =>
    copia?.crm?.tableros.find((t) => (t.funnelId ?? null) === funnelId)?.columnas.find((x) => x.key === key)?.titulo ?? key;
  const colTarea = (key: string) => copia?.plan?.columnas.find((x) => x.key === key)?.titulo ?? key;
  const tarea = (id: string) => copia?.plan?.tareas.find((x) => x.id === id)?.titulo ?? 'una tarea';
  switch (c.tipo) {
    case 'nota': return `Nota en ${lead(c.leadId)}: «${recorte(c.texto)}»`;
    case 'etapa': return `${lead(c.leadId)}: de «${columna(c.funnelId, c.antes)}» a «${columna(c.funnelId, c.despues)}»`;
    case 'contacto': return `${lead(c.leadId)}: ${ROTULO_CAMPO[c.campo]} de «${c.antes ?? ''}» a «${c.despues ?? ''}»`;
    case 'tarea-estado': return `«${recorte(tarea(c.tareaId))}»: de «${colTarea(c.antes)}» a «${colTarea(c.despues)}»`;
    case 'tarea-nueva': return `Tarea nueva: «${recorte(c.titulo)}» (queda como borrador para confirmar)`;
  }
}
