// =============================================================================
// plantillas — store editable de las plantillas de aviso + generación con IA
// =============================================================================
// El catálogo (lib/avisos-catalogo.ts) son las 49 built-in. Encima, el dueño
// puede: EDITAR el texto (referencia), ACTIVAR/DESACTIVAR, ELIMINAR y CREAR
// plantillas nuevas. Todo vive en app_settings (mako.plantillas.store) del dueño.
//
// Punto clave (decisión de Martín): la plantilla NO es un molde literal. Es una
// REFERENCIA que MaKo (Claude) usa para GENERAR el mensaje con los datos reales,
// libre de adaptarla. generarMensajeAviso() hace justamente eso.

import 'server-only';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace, OWNER_WS } from './workspace';
import { chatClaude } from './anthropic';
import { CATALOGO_AVISOS, type AvisoCatalogo, type CategoriaAviso } from './avisos-catalogo';

const KEY_STORE = 'mako.plantillas.store';

type EntradaStore = {
  texto?: string;      // referencia editada (pisa el ejemplo del catálogo)
  enabled?: boolean;   // default true
  custom?: { titulo: string; categoria: CategoriaAviso; requiereRespuesta: boolean };
};
type Store = Record<string, EntradaStore>;

export type PlantillaVista = AvisoCatalogo & { enabled: boolean; esCustom: boolean };

async function leerStore(): Promise<Store> {
  const raw = await runWithWorkspace(OWNER_WS, () => getSetting(KEY_STORE));
  if (!raw) return {};
  try { return (JSON.parse(raw) as Store) ?? {}; } catch { return {}; }
}
async function guardarStore(s: Store): Promise<void> {
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY_STORE, JSON.stringify(s)));
}

function aVista(cat: AvisoCatalogo, e: EntradaStore | undefined, esCustom: boolean): PlantillaVista {
  return {
    ...cat,
    ejemplo: (e?.texto && e.texto.trim()) || cat.ejemplo,
    enabled: e?.enabled !== false,
    esCustom,
  };
}
// Una entrada custom del store → forma AvisoCatalogo.
function customACatalogo(id: string, e: EntradaStore): AvisoCatalogo {
  const c = e.custom!;
  return {
    id, titulo: c.titulo || 'Plantilla nueva', categoria: c.categoria, prioridad: 'media',
    semaforo: 'na', requiereRespuesta: !!c.requiereRespuesta, yaImplementado: 'no',
    disparador: 'Plantilla personalizada (la usás desde MaKo cuando aplique).',
    ejemplo: e.texto || '',
  };
}

/** Lista COMPLETA (catálogo + custom) con estado enabled + texto efectivo. */
export async function listarPlantillas(): Promise<PlantillaVista[]> {
  const store = await leerStore();
  const built = CATALOGO_AVISOS.map((c) => aVista(c, store[c.id], false));
  const custom = Object.entries(store)
    .filter(([, e]) => e.custom)
    .map(([id, e]) => aVista(customACatalogo(id, e), e, true));
  return [...built, ...custom];
}

export async function getPlantilla(id: string): Promise<PlantillaVista | null> {
  return (await listarPlantillas()).find((p) => p.id === id) ?? null;
}

/** Texto de REFERENCIA de una plantilla (override editado o ejemplo del catálogo). */
export async function referenciaPlantilla(id: string): Promise<string> {
  return (await getPlantilla(id))?.ejemplo ?? '';
}
export async function plantillaActiva(id: string): Promise<boolean> {
  return (await getPlantilla(id))?.enabled ?? true;
}

// ── Mutaciones ────────────────────────────────────────────────────────────────
async function mutar(id: string, patch: (e: EntradaStore) => EntradaStore | null): Promise<void> {
  const s = await leerStore();
  const next = patch(s[id] ?? {});
  if (next === null) delete s[id]; else s[id] = next;
  await guardarStore(s);
}
export const setTextoPlantilla = (id: string, texto: string) => mutar(id, (e) => ({ ...e, texto }));
export const setEnabledPlantilla = (id: string, enabled: boolean) => mutar(id, (e) => ({ ...e, enabled }));

/** Elimina: las custom se borran; las built-in NO se pueden borrar → se desactivan. */
export async function borrarPlantilla(id: string): Promise<{ borrada: boolean }> {
  const s = await leerStore();
  const esCustom = !!s[id]?.custom;
  if (esCustom) { delete s[id]; await guardarStore(s); return { borrada: true }; }
  await mutar(id, (e) => ({ ...e, enabled: false }));
  return { borrada: false }; // built-in → desactivada
}

export async function crearPlantilla(data: { titulo: string; categoria: CategoriaAviso; requiereRespuesta?: boolean; texto?: string }): Promise<PlantillaVista> {
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const entrada: EntradaStore = {
    texto: data.texto ?? '',
    enabled: true,
    custom: { titulo: data.titulo.trim() || 'Plantilla nueva', categoria: data.categoria, requiereRespuesta: !!data.requiereRespuesta },
  };
  const s = await leerStore(); s[id] = entrada; await guardarStore(s);
  return aVista(customACatalogo(id, entrada), entrada, true);
}

// ── Generación con IA (la plantilla es REFERENCIA, no molde) ──────────────────
const SYS_AVISO =
  'Sos MaKo, el copiloto de marketing del dueño de un negocio. Escribís un aviso de ' +
  'WhatsApp al dueño, en español rioplatense: cercano, directo, sin vueltas, con la ' +
  'info clave adelante. Te doy una PLANTILLA DE REFERENCIA (guía de tono, formato y ' +
  'qué decir) y los DATOS REALES del evento. Usá la referencia como base pero sos ' +
  'LIBRE de adaptarla, acortarla o reescribirla para que suene natural con esos datos. ' +
  'Devolvé SOLO el mensaje final listo para mandar (sin comillas ni explicaciones). ' +
  'Podés usar *negritas* de WhatsApp y algún emoji si pega. Cerrá con "— MaKo".';

/**
 * Genera el texto de un aviso con IA, usando la plantilla como REFERENCIA + los
 * datos reales. Si algo falla, cae a la referencia literal (best-effort).
 */
export async function generarMensajeAviso(id: string, contexto: string): Promise<string> {
  const ref = await referenciaPlantilla(id);
  try {
    const user = `PLANTILLA DE REFERENCIA:\n${ref || '(sin referencia)'}\n\nDATOS REALES DEL EVENTO:\n${contexto}\n\nEscribí el mensaje.`;
    const out = await chatClaude(SYS_AVISO, [{ role: 'user', content: user }], {
      effort: 'low', maxTokens: 700, feature: 'avisos', motivo: `MaKo: aviso ${id}`,
    });
    return out.trim() || ref;
  } catch {
    return ref;
  }
}
