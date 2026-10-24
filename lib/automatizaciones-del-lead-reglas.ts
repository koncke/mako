// =============================================================================
// automatizaciones-del-lead-reglas — lo puro de «en qué automatizaciones está un lead» y de «Frenar» (lo prueban sus tests)
// =============================================================================
// La lectura y la escritura viven en lib/automatizaciones-del-lead.ts (server-only); acá lo que se arma con lo leído.
// =============================================================================
import { indiceActual } from './nutricion-grafo-motor';
import { nombreDeTarjeta } from './flujo-conversacion';
import { idDe, claseDe, type PasoGrafo } from './flujo-grafo';
import type { FrenoDelEnvio } from './por-que-no-sale';
import { leerNoVolvio, ROTULO_REENTRADA, type NoEntro, type InformeMovimiento, type Reentrada } from './reentrada';
import { ESTADOS_EN_CURSO, ESTADOS_QUE_SALEN } from './nutricion-inscripcion-manual';

export type { NoEntro, InformeMovimiento };

export type EnAutomatizacion = {
  secuenciaId: number;
  nombre: string;
  /** false = la automatización está PAUSADA: el lead quedó congelado en su paso y no le sale nada hasta que se active. */
  automatizacionActiva: boolean;
  estado: 'activa' | 'respondio';
  /** La tarjeta en la que está, como la nombra el lienzo («WHATSAPP: Hola {{nombre}}, soy…»). null = no se pudo ubicar. */
  paso: { numero: number; titulo: string } | null;
  proximoEnvioAt: string | null;
  link: string;
  /**
   * POR QUÉ NO LE SALE (todavía), en palabras (23/10/2026, P0 de #289: el motor cortaba por el horario sin decirlo):
   * «No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale hoy 9:00.». null = nada lo frena.
   */
  frenado?: FrenoDelEnvio | null;
};

/** Las inscripciones que siguen vivas: corriendo, o frenadas porque contestó. */
export const ESTADOS_VIVOS = ['activa', 'respondio'] as const;

export type FilaInscripcion = { lead_id: number; secuencia_id: number; estado: string; paso_actual: number | null; nodo_actual: string | null; proximo_envio_at: string | null };
export type FilaAutomatizacion = { id: number; nombre: string | null; activa: boolean | null; archivada_at: string | null; pasos: unknown; instance_name?: string | null };

/** El canal del MENSAJE que le toca (null = una acción, una condición, una espera, o no se pudo ubicar). */
export function canalDelPaso(p: PasoGrafo | undefined): string | null {
  return p && claseDe(p) === 'mensaje' && typeof p.canal === 'string' ? p.canal : null;
}

/** Lo que `frenoDe` sabe de cada fila (lo arma lib/automatizaciones-del-lead.ts con el contexto del negocio). */
export type FrenoDeFila = (f: FilaInscripcion, s: FilaAutomatizacion, canal: string | null) => FrenoDelEnvio | null;

/** Lo leído → lo de cada lead. Sin las archivadas ni las inscripciones que ya no corren. */
export function enAutomatizacionesDe(filas: readonly FilaInscripcion[], secs: readonly FilaAutomatizacion[], frenoDe?: FrenoDeFila): Map<number, EnAutomatizacion[]> {
  const porId = new Map(secs.filter((s) => s.archivada_at == null).map((s) => [Number(s.id), s]));
  const out = new Map<number, EnAutomatizacion[]>();
  for (const f of filas) {
    if (!(ESTADOS_VIVOS as readonly string[]).includes(f.estado)) continue;
    const s = porId.get(Number(f.secuencia_id));
    if (!s) continue;
    const pasos = (Array.isArray(s.pasos) ? s.pasos : []) as PasoGrafo[];
    const i = pasos.length ? indiceActual(pasos, { paso_actual: f.paso_actual ?? 0, nodo_actual: f.nodo_actual }) : -1;
    const lista = out.get(Number(f.lead_id)) ?? [];
    lista.push({
      secuenciaId: Number(s.id), nombre: s.nombre?.trim() || `Automatización #${s.id}`, automatizacionActiva: s.activa === true,
      estado: f.estado as EnAutomatizacion['estado'], paso: i >= 0 ? { numero: i + 1, titulo: nombreDeTarjeta(pasos, idDe(pasos[i], i)) } : null,
      proximoEnvioAt: f.proximo_envio_at, link: `/automations?sec=${s.id}`,
      ...(frenoDe ? { frenado: frenoDe(f, s, canalDelPaso(i >= 0 ? pasos[i] : undefined)) } : {}),
    });
    out.set(Number(f.lead_id), lista);
  }
  return out;
}

/** Lo que dice «Frenar automatización» sobre varios leads tildados (la barra de lote del CRM). */
export function textoDeFrenarLote(o: { pedidos: number; frenados: number; nombre: string | null }): string {
  const leads = (n: number) => (n === 1 ? '1 lead' : `${n} leads`);
  const donde = o.nombre ? ` en «${o.nombre}»` : ' de sus automatizaciones';
  const ya = o.pedidos - o.frenados;
  if (!o.frenados) return o.pedidos === 1 ? `Ese lead ya no estaba corriendo${donde}.` : `Ninguno estaba corriendo${donde}.`;
  return `Frené a ${leads(o.frenados)}${donde}: no les sale nada más.${ya > 0 ? ` ${ya === 1 ? '1 ya no estaba corriendo' : `${ya} ya no estaban corriendo`}.` : ''}`;
}

/** Lo que dice «Frenar»: el resultado de `sacarDeSecuencia` (lib/nutricion-salida-manual.ts), para la persona. */
export function textoDeFrenar(r:
  | { sale: true; secuencia: { nombre: string }; lead: { nombre: string } }
  | { sale: false; porque: string; secuencia: { nombre: string } | null; lead: { nombre: string } | null },
): { ok: true; resumen: string } | { ok: false; error: string } {
  if (r.sale) return { ok: true, resumen: `Frené a ${r.lead.nombre} en «${r.secuencia.nombre}»: no le sale nada más.` };
  const quien = r.lead?.nombre ?? 'ese lead';
  const donde = r.secuencia ? `«${r.secuencia.nombre}»` : 'esa automatización';
  const por: Record<string, string> = {
    secuencia_no_existe: 'Esa automatización no existe en este negocio.',
    lead_no_existe: 'Ese lead no existe en este negocio.',
    carrera: `${quien} cambió de paso en ${donde} mientras lo frenaba: prueba de nuevo.`,
  };
  return { ok: false, error: por[r.porque] ?? `${quien} ya no estaba corriendo en ${donde}.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// EL BLOQUE «AUTOMATIZACIONES» DE LA FICHA (23/10/2026): el detalle de un lead
// ─────────────────────────────────────────────────────────────────────────────
// Martín (23/10, #289 del ws1): un bloque en la ficha con todo lo de sus automatizaciones. La pantalla es del CRM
// (app/crm); acá se arma, puro, con lo que lee `detalleDelLead` (lib/automatizaciones-del-lead.ts). Como la tarjeta de
// HubSpot: las vivas y, debajo, las terminadas de los últimos `DIAS_TERMINADAS` días; y las veces que una persona lo movió
// a una etapa con automatización y NO entró (leídas del historial: `leerNoVolvio`, la línea que escribe el motor).

/** Hasta cuántos días atrás se muestran las que ya terminaron. */
export const DIAS_TERMINADAS = 30;
/** Cuántos envíos por inscripción, del más nuevo al más viejo. */
export const TOPE_ENVIOS = 20;
/** Cuántos «no entró» del historial. */
export const TOPE_NO_ENTRO = 10;

export type EnvioDelLead = { at: string; paso: { numero: number; titulo: string } | null; canal: string | null; estado: string; error: string | null };

export type InscripcionDelLead = {
  secuenciaId: number;
  nombre: string;
  link: string;
  automatizacionActiva: boolean;
  /** El de la inscripción: 'activa' | 'respondio' | 'handoff' | 'pendiente' | 'pausada' | 'completada' | 'no_responde' | 'cancelada'. */
  estado: string;
  desde: string | null;
  termino: { at: string; texto: string } | null;
  reentrada: Reentrada;
  reentradaTexto: string;
  paso: { numero: number; titulo: string; total: number } | null;
  proximo: { at: string; titulo: string; canal: string | null } | null;
  frenado: FrenoDelEnvio | null;
  enviados: EnvioDelLead[];
  puede: { frenar: boolean; empezarDeNuevo: boolean; porQueNo?: string };
};

export type AutomatizacionesDelLead = { zona: string; inscripciones: InscripcionDelLead[]; noEntro: NoEntro[] };

export type FilaInscripcionDetalle = FilaInscripcion & {
  id: number; inscripto_at: string | null; updated_at: string | null; desenlace: string | null; desenlace_at?: string | null;
};
export type FilaEnvioDetalle = { inscripcion_id: number | null; nodo_id: string | null; canal: string | null; estado: string; error: string | null; created_at: string };
export type FilaAuditDetalle = { valor_nuevo: string | null; autor: string | null; created_at: string };

const TERMINO: Readonly<Record<string, string>> = { completada: 'Terminó el recorrido', no_responde: 'No respondió', cancelada: 'La frenaron' };

/** Lo leído → el bloque. `reentradaDe`: la de cada automatización (la decide el motor, `reentradaDeSecuencia`). */
export function detalleDe(o: {
  zona: string;
  filas: readonly FilaInscripcionDetalle[];
  secs: readonly FilaAutomatizacion[];
  reentradaDe: (secuenciaId: number) => Reentrada;
  envios: readonly FilaEnvioDetalle[];
  audit: readonly FilaAuditDetalle[];
  frenoDe?: FrenoDeFila;
  ahoraMs: number;
}): AutomatizacionesDelLead {
  const porId = new Map(o.secs.map((s) => [Number(s.id), s]));
  const desde = o.ahoraMs - DIAS_TERMINADAS * 86400_000;
  const inscripciones: InscripcionDelLead[] = [];
  for (const f of o.filas) {
    const s = porId.get(Number(f.secuencia_id));
    if (!s) continue;
    const vive = (ESTADOS_QUE_SALEN as readonly string[]).includes(f.estado);
    const finAt = f.desenlace_at ?? f.updated_at ?? f.inscripto_at;
    if (!vive && (!finAt || Date.parse(finAt) < desde)) continue;
    const pasos = (Array.isArray(s.pasos) ? s.pasos : []) as PasoGrafo[];
    const i = pasos.length ? indiceActual(pasos, { paso_actual: f.paso_actual ?? 0, nodo_actual: f.nodo_actual }) : -1;
    const titulo = (k: number) => nombreDeTarjeta(pasos, idDe(pasos[k], k));
    const canal = canalDelPaso(i >= 0 ? pasos[i] : undefined);
    const modo = o.reentradaDe(Number(s.id));
    const usable = s.archivada_at == null && s.activa === true && pasos.length > 0;
    const cancelada = f.estado === 'cancelada' || f.desenlace === 'cancelado';
    // Lo mismo que decide `decidirInscripcionManual` con `empezarDeNuevo`: en curso, contestó o terminada; nunca cancelada
    // (puede ser una baja) ni con una persona atendiendo.
    const reabre = !cancelada && f.estado !== 'handoff'
      && ((ESTADOS_EN_CURSO as readonly string[]).includes(f.estado) || f.estado === 'respondio' || f.estado === 'completada' || f.estado === 'no_responde');
    const porQueNo = !usable ? (s.archivada_at != null ? 'La automatización está archivada.' : s.activa !== true ? 'La automatización está en pausa.' : 'La automatización no tiene pasos.')
      : cancelada ? 'La frenaron: una automatización frenada no vuelve a empezar (puede ser una baja).'
      : f.estado === 'handoff' ? 'La charla la sigue una persona.' : !reabre ? 'Está en un estado que no se puede reabrir.' : undefined;
    const indicePorNodo = new Map(pasos.map((p, k) => [idDe(p, k), k] as const));
    inscripciones.push({
      secuenciaId: Number(s.id), nombre: s.nombre?.trim() || `Automatización #${s.id}`, link: `/automations?sec=${s.id}`,
      automatizacionActiva: s.activa === true && s.archivada_at == null, estado: f.estado,
      desde: f.inscripto_at, termino: !vive && TERMINO[f.estado] && finAt ? { at: finAt, texto: TERMINO[f.estado] } : null,
      reentrada: modo, reentradaTexto: ROTULO_REENTRADA[modo],
      paso: vive && i >= 0 ? { numero: i + 1, titulo: titulo(i), total: pasos.length } : null,
      proximo: f.estado === 'activa' && f.proximo_envio_at && i >= 0 ? { at: f.proximo_envio_at, titulo: titulo(i), canal } : null,
      frenado: o.frenoDe && f.estado === 'activa' ? o.frenoDe(f, s, canal) : null,
      enviados: o.envios.filter((e) => Number(e.inscripcion_id) === Number(f.id))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, TOPE_ENVIOS)
        .map((e) => {
          const k = e.nodo_id != null ? indicePorNodo.get(e.nodo_id) : undefined;
          return { at: e.created_at, paso: k != null ? { numero: k + 1, titulo: titulo(k) } : null, canal: e.canal, estado: e.estado, error: e.error?.trim().slice(0, 300) || null };
        }),
      puede: { frenar: vive, empezarDeNuevo: usable && reabre, ...(porQueNo ? { porQueNo } : {}) },
    });
  }
  // Las vivas primero; dentro de cada grupo, la más nueva arriba.
  const orden = (x: InscripcionDelLead) => (x.termino ? 1 : 0);
  inscripciones.sort((a, b) => orden(a) - orden(b) || (Date.parse(b.desde ?? '') || 0) - (Date.parse(a.desde ?? '') || 0));
  // «No entró»: la línea nombra la automatización y el lead SIEMPRE tiene su inscripción (sólo deja de entrar quien ya
  // tiene una), así que el id sale de sus filas.
  const idPorNombre = new Map(o.filas.flatMap((f) => {
    const s = porId.get(Number(f.secuencia_id));
    return s?.nombre?.trim() ? [[s.nombre.trim(), Number(s.id)] as const] : [];
  }));
  const noEntro: NoEntro[] = [];
  for (const a of [...o.audit].sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))) {
    const l = leerNoVolvio(a.valor_nuevo);
    const id = l ? idPorNombre.get(l.nombre.trim()) : undefined;
    if (!l || id == null) continue;
    noEntro.push({ secuenciaId: id, nombre: l.nombre, at: a.created_at, porque: l.porque, texto: l.texto, quien: a.autor });
    if (noEntro.length >= TOPE_NO_ENTRO) break;
  }
  return { zona: o.zona, inscripciones, noEntro };
}
