// =============================================================================
// api-mako/areas/video.helpers — lecturas del área `video` que no exporta ninguna lib
// =============================================================================
// Todo lo de acá LEE. Nada encola, nada baja archivos, nada consulta a Google.
//
// ⚠️ DEUDA, dicha: estas piezas son copias.
//   · leerMontaje       ← el cuerpo de estadoMontajeAction (video-action.ts), que es
//                         una consulta pura pero vive en 'use server' detrás de un
//                         ctxAdmin() de SESIÓN: por HTTP/WhatsApp contestaría «solo
//                         el administrador». Se lee con getTenantDb, igual que allá.
//   · estadoDeToma      ← estadoDeToma de PasoTomas.tsx, que es 'use client': un
//                         valor importado de ahí al grafo del server es una
//                         referencia de cliente, no la función.
//   · puenteAnda        ← estadoDelPuente de puente-avisos.tsx, por lo mismo.
//   · leerHistorialEstricto ← el parseo de leerHistorial (video-datos.ts), que no
//                         exporta esEntrada/limpiarUrlsMuertas y traga los errores.
//   · leerPuenteEstricto ← estadoPuente (lib/flow-cola.ts), que ignora el error.
//   · contextoVideoSinFirmar ← estadoContextoVideo (video-datos.ts) sin las fotos.
// Si cambia el criterio de la pantalla o de la lib, cambia acá también — o mejor:
// exportar las piezas puras desde su módulo y que los dos lados importen el mismo.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getSetting, getSettingEstricto } from '@/lib/settings';
import { KEY_DIAGNOSTICO, sanearDiagnostico, type Diagnostico } from '@/lib/flow-diagnostico';
import { estaVivo } from '@/lib/flow-puente-frescura';
import type { EstadoPuente, Puente } from '@/lib/flow-cola';
import { KEY_HISTORIAL_VIDEO, type MarcaImagen, type MarcaVideo, type PlanGuardado } from '@/app/video-generator/video-datos';
import { getVozCliente, type VozCliente } from '@/app/video-generator/voz-cliente';
import { getPersona } from '@/lib/persona';
import { resolverAcento } from '@/lib/acento-workspace';
import { tzDeWorkspace } from '@/lib/timezone';
import { getSchema, getAnswers } from '@/lib/onboarding';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const obj = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const numOpt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ── El historial, leído en ESTRICTO ──────────────────────────────────────────
//
// leerHistorial (video-datos.ts) lee con getSetting —un error de Supabase vuelve
// null— y además traga toda excepción devolviendo []: un 5xx de la base se leía
// como «no hay anuncios». Acá un error de LECTURA tira HistorialIlegible; JSON roto
// o shape viejo siguen siendo lista vacía, igual que allá.

const MAX_HISTORIAL = 10;

const esEntrada = (e: unknown): e is PlanGuardado => {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.at === 'string' && !!o.plan && typeof o.plan === 'object';
};

/** Copia de urlInservible: el enlace de labs.google exige la cookie de Google. */
const urlInservible = (u: string): boolean => u.includes('labs.google/fx/api/trpc/');

function limpiarUrlsMuertas(p: PlanGuardado): PlanGuardado {
  if (!p.video) return p;
  let toco = false;
  const limpio: Record<string, MarcaVideo> = {};
  for (const [k, m] of Object.entries(p.video)) {
    if (m?.url && urlInservible(m.url)) {
      const { url: _fuera, ...resto } = m;
      limpio[k] = resto;
      toco = true;
    } else {
      limpio[k] = m;
    }
  }
  return toco ? { ...p, video: limpio } : p;
}

export class HistorialIlegible extends Error {}

/** El historial de /video-generator. Si la base no contesta, TIRA HistorialIlegible. */
export async function leerHistorialEstricto(): Promise<PlanGuardado[]> {
  let raw: string | null;
  try {
    raw = await getSettingEstricto(KEY_HISTORIAL_VIDEO);
  } catch (e) {
    throw new HistorialIlegible(e instanceof Error ? e.message : String(e));
  }
  if (!raw) return [];
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.filter(esEntrada).slice(0, MAX_HISTORIAL).map(limpiarUrlsMuertas);
}

/**
 * Si la url de un clip vive en el bucket propio (`video-clips`, público: no vence).
 * Lo que no es de ahí es el enlace firmado que Google devolvió en la consulta y que
 * estadoTomaAction guarda tal cual (video-action.ts): vence a las ~6 h.
 */
export const urlEsPropia = (u: string): boolean => u.includes('/storage/v1/object/public/video-clips/');

// ── El puente ────────────────────────────────────────────────────────────────

/** Copia de estadoDelPuente (puente-avisos.tsx): anda = listo Y vivo; marcada gana. */
export function puenteAnda(p: Puente, ahora: number): { anda: boolean; vivo: boolean; pausadaPorGoogle: boolean } {
  const vivo = estaVivo(p.ultimoVisto, ahora);
  if (p.estado === 'marcada') return { anda: false, vivo, pausadaPorGoogle: true };
  return { anda: vivo && p.estado === 'listo', vivo, pausadaPorGoogle: false };
}

/**
 * Como estadoPuente (lib/flow-cola.ts), pero un select fallido TIRA: allá se lee
 * como «sin_conectar / emparejado false». Columnas explícitas: nunca el token.
 */
export async function leerPuenteEstricto(): Promise<Puente> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('flow_puentes')
    .select('estado, estado_detalle, etiqueta, project_id, ultimo_visto, version')
    .maybeSingle();
  if (error) throw new Error(`api-mako: flow_puentes: ${error.message}`);
  if (!data) {
    return { estado: 'sin_conectar', detalle: '', etiqueta: '', projectId: '', ultimoVisto: null, emparejado: false, version: '' };
  }
  const r = data as Record<string, unknown>;
  return {
    estado: (str(r.estado) || 'sin_conectar') as EstadoPuente,
    detalle: str(r.estado_detalle),
    etiqueta: str(r.etiqueta),
    projectId: str(r.project_id),
    ultimoVisto: str(r.ultimo_visto) || null,
    emparejado: true,
    version: str(r.version),
  };
}

/** -1 si a < b, 0 si iguales, 1 si a > b; null si alguna no es numérica tipo x.y.z. */
export function compararVersion(a: string, b: string): -1 | 0 | 1 | null {
  const pa = a.trim().split('.').map(Number);
  const pb = b.trim().split('.').map(Number);
  if (![...pa, ...pb].every((x) => Number.isInteger(x) && x >= 0)) return null;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Lo último que reportó el navegador sobre sí mismo (ops aprendidas, espejo, dominio). */
export async function leerDiagnosticoFlow(): Promise<Diagnostico | null> {
  try {
    const raw = await getSetting(KEY_DIAGNOSTICO);
    return raw ? sanearDiagnostico(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Los CÓDIGOS de diagnóstico del detalle del puente (`SIN_ANCLA(generar_clip)`,
 * `NO_FLOW_TAB`…), nunca el texto. `estado_detalle` es un campo LIBRE que escribe la
 * extensión y ya llegó a traer volcados de JSON del espía con prompts adentro: lo
 * que sale de acá es solo lo que tiene forma de código.
 */
export function codigosDelDetalle(detalle: string): string[] {
  const m = (detalle || '').match(/\b[A-Z][A-Z0-9_]{3,}(?:\([a-z_]+\))?/g) ?? [];
  return [...new Set(m)].slice(0, 5);
}

// ── La cola de Flow ──────────────────────────────────────────────────────────

export type FilaTrabajoFlow = {
  id: number;
  tipo: string;
  estado: string;
  motivo: string;
  /** SOLO para clasificar la causa. Trae el crudo de Google: no sale al modelo. */
  error: string;
  intentos: number;
  created_at: string | null;
  tomado_at: string | null;
  listo_at: string | null;
  medio_guardado: boolean;
};

const COLUMNAS_TRABAJO = 'id, tipo, estado, motivo, error, intentos, created_at, tomado_at, listo_at, medio_guardado';

const filaTrabajo = (r: Record<string, unknown>): FilaTrabajoFlow => ({
  id: Number(r.id),
  tipo: str(r.tipo),
  estado: str(r.estado),
  motivo: str(r.motivo),
  error: str(r.error),
  intentos: Number(r.intentos ?? 0),
  created_at: str(r.created_at) || null,
  tomado_at: str(r.tomado_at) || null,
  listo_at: str(r.listo_at) || null,
  medio_guardado: r.medio_guardado === true,
});

/**
 * Los últimos trabajos de flow_trabajos del workspace en curso.
 *
 * ⚠️ NUNCA se selecciona `pedido` (el de subir_imagen lleva la FOTO del cliente en
 * base64, y todos llevan prompts) ni `resultado` (la respuesta de Google).
 */
export async function leerTrabajosFlow(f: { estado?: string | null; tipo?: string | null; limite: number }): Promise<FilaTrabajoFlow[]> {
  const db = await getTenantDb();
  let q = db.from('flow_trabajos').select(COLUMNAS_TRABAJO);
  if (f.estado) q = q.eq('estado', f.estado);
  if (f.tipo) q = q.eq('tipo', f.tipo);
  const { data, error } = await q.order('id', { ascending: false }).limit(f.limite);
  if (error) throw new Error(`api-mako: flow_trabajos: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(filaTrabajo);
}

/**
 * Estado REAL de trabajos puntuales de la cola, por id. Las marcas «generando» del
 * historial solo avanzan cuando la PANTALLA consulta; el cron flow-abandono cierra el
 * trabajo en flow_trabajos (fallido, puente_ausente) sin tocar el historial. Mismas
 * columnas que leerTrabajosFlow: sin `pedido` ni `resultado`. Tope 200 ids (el
 * historial guarda 10 anuncios de hasta 12 tomas y sus escenarios: no lo alcanza).
 */
export async function leerTrabajosPorId(ids: number[]): Promise<Map<number, FilaTrabajoFlow>> {
  const unicos = [...new Set(ids.filter((x) => Number.isInteger(x) && x > 0))].slice(0, 200);
  const out = new Map<number, FilaTrabajoFlow>();
  if (!unicos.length) return out;
  const db = await getTenantDb();
  const { data, error } = await db.from('flow_trabajos').select(COLUMNAS_TRABAJO).in('id', unicos);
  if (error) throw new Error(`api-mako: flow_trabajos: ${error.message}`);
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const f = filaTrabajo(r);
    out.set(f.id, f);
  }
  return out;
}

// ── El montaje ───────────────────────────────────────────────────────────────

export type MontajeLeido =
  | { fase: 'sin_empezar' }
  | { fase: 'encolado'; id: number; esperando_min: number; reintento?: true; motivo_ultimo_fallo?: string }
  | { fase: 'montando'; id: number; desde: string | null }
  | { fase: 'listo'; url: string; segundos_antes_estimados: number | null; segundos_despues: number | null }
  | { fase: 'error'; error: string; motivo: string };

/** Copia de estadoMontajeAction, sin la sesión. Filtra por plan_id EN SQL. */
export async function leerMontaje(planId: string): Promise<MontajeLeido> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('montaje_trabajos')
    .select('id, estado, resultado, error, motivo, tomado_at, created_at')
    .eq('plan_id', planId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`api-mako: montaje_trabajos: ${error.message}`);
  if (!data) return { fase: 'sin_empezar' };

  const est = str(data.estado);
  if (est === 'listo') {
    const r = obj(data.resultado);
    const url = str(r.url);
    // Un `listo` sin url no es un listo: el worker reportó éxito y no dejó nada.
    if (!url) return { fase: 'error', error: 'El montaje terminó sin dejar el archivo.', motivo: 'interno' };
    // segundosAntes lo arma worker/montar-cola.mjs como clips × duración supuesta
    // (seg[0] ?? 10.005): es una estimación, no una medición. palabrasPerdidas lo
    // acepta la ruta del worker pero el worker no lo manda nunca: no se devuelve.
    return {
      fase: 'listo', url,
      segundos_antes_estimados: numOpt(r.segundosAntes),
      segundos_despues: numOpt(r.segundosDespues),
    };
  }
  if (est === 'fallido') return { fase: 'error', error: (str(data.error) || 'No se pudo montar.').slice(0, 300), motivo: str(data.motivo) };
  if (est === 'tomado') return { fase: 'montando', id: Number(data.id), desde: str(data.tomado_at) || null };
  const desde = Date.parse(str(data.created_at));
  const esperando = Number.isFinite(desde) ? Math.max(0, Math.floor((Date.now() - desde) / 60000)) : 0;
  // Un fallo no definitivo vuelve a `pendiente` con motivo y error
  // (app/api/montaje/worker/route.ts): encolado, pero ya falló al menos una vez.
  const motivo = str(data.motivo).trim() || str(data.error).trim();
  return {
    fase: 'encolado', id: Number(data.id), esperando_min: esperando,
    ...(motivo ? { reintento: true as const, motivo_ultimo_fallo: motivo.slice(0, 120) } : {}),
  };
}

// ── Estados derivados de lo GUARDADO en el plan ──────────────────────────────

export type EstadoTomaLeido = 'filmada' | 'con_error' | 'sin_poder_leer' | 'generando' | 'sin_texto' | 'sin_filmar';

/**
 * Copia de estadoDeToma (PasoTomas.tsx), con el orden de la pantalla, más
 * `sin_poder_leer` (MarcaVideo.ciego: Google aceptó el pedido y no podemos leer
 * cómo va — NO es un error, y volver a filmar cobraría otro clip).
 */
export function estadoDeToma(item: PlanGuardado, n: number): EstadoTomaLeido {
  const v = item.video?.[String(n)];
  if (v?.url) return 'filmada';
  if (v?.error) return 'con_error';
  if (v?.ciego) return 'sin_poder_leer';
  if (v?.trabajoId || v?.operacion) return 'generando';
  if (!(item.plan.clips.find((c) => c.n === n)?.voz ?? '').trim()) return 'sin_texto';
  return 'sin_filmar';
}

export type EstadoImagenLeido = 'confirmada' | 'con_error' | 'generando' | 'generada_sin_confirmar' | 'sin_generar';

/**
 * Qué pasa con la imagen de un escenario. `elegida` NO es confirmada: la primera
 * variante se preselecciona sola al llegar; confirmar lo hace una persona mirando,
 * y es el único freno antes de gastar créditos en las tomas.
 */
export function estadoDeImagen(m: MarcaImagen | undefined): EstadoImagenLeido {
  if (!m) return 'sin_generar';
  if (m.confirmada) return 'confirmada';
  // El error va antes que «en vuelo»: generar de nuevo borra el error del intento
  // anterior al encolar, así que un error presente es del último intento.
  if (m.error) return 'con_error';
  // Mismo criterio que estadoImagenAction: la señal de «terminó» es trabajoListo;
  // las marcas anteriores a ese campo solo tienen `opciones`.
  const yaLlego = m.trabajoListo ? m.trabajoId === m.trabajoListo : !!m.opciones?.length;
  if (m.trabajoId && !yaLlego) return 'generando';
  if ((m.opciones?.length ?? 0) > 0 || m.elegida) return 'generada_sin_confirmar';
  return 'sin_generar';
}

// ── Contexto para filmar, sin firmar fotos ───────────────────────────────────

export type ContextoVideoLeido = {
  cantidadFotos: number;
  tieneDescripcion: boolean;
  acento: { id: string; etiqueta: string; origen: string; zona: string; muletillas: string[] };
  /** Criterio de la lib: al menos UN grupo del perfil con algo cargado. */
  perfilEmpezado: boolean;
  faltanDelPerfil: string[];
  /** La consulta del perfil falló (allá se degrada a «no listo» sin decirlo). */
  perfilIlegible: boolean;
};

/**
 * Lo que devuelve estadoContextoVideo (video-datos.ts) menos las fotos: aquella
 * llama personaEstado, que firma una URL de storage por foto, y esta lectura las
 * tiraba. Acá se usa getPersona (conteo + descripción) y el acento se resuelve igual
 * que allá (getVozCliente + tzDeWorkspace + resolverAcento).
 */
export async function contextoVideoSinFirmar(): Promise<ContextoVideoLeido> {
  const [persona, perfil] = await Promise.all([
    getPersona().catch(() => null),
    (async () => {
      try {
        const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
        const faltan = schema.filter((g) => !g.fields.some((f) => (answers[f.key] ?? '').trim())).map((g) => g.label);
        return { empezado: faltan.length < schema.length, faltan, ilegible: false };
      } catch {
        return { empezado: false, faltan: [] as string[], ilegible: true };
      }
    })(),
  ]);
  const ws = await getWorkspaceActual();
  const voz = await getVozCliente().catch((): VozCliente => ({ acento: '', muletillas: [], muestras: [] }));
  const zona = ws != null ? await tzDeWorkspace(ws).catch(() => null) : null;
  const a = resolverAcento(voz.acento, zona, voz.muletillas, voz.acentoOrigen);
  return {
    cantidadFotos: persona?.fotos.length ?? 0,
    tieneDescripcion: !!(persona?.descripcion ?? '').trim(),
    acento: { id: a.id, etiqueta: a.etiqueta, origen: a.origen, zona: a.origen === 'zona-horaria' ? (zona ?? '') : '', muletillas: a.muletillas },
    perfilEmpezado: perfil.empezado,
    faltanDelPerfil: perfil.faltan,
    perfilIlegible: perfil.ilegible,
  };
}
