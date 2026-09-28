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
import { runWithWorkspace, OWNER_WS, getWorkspaceActual } from './workspace';
import { chatClaude } from './anthropic';
import { CATALOGO_AVISOS, type AvisoCatalogo, type CategoriaAviso } from './avisos-catalogo';
import { esFlujoValido, type Flujo } from './flujos-tipos';

const KEY_STORE = 'mako.plantillas.store';

type EntradaStore = {
  texto?: string;      // referencia editada (pisa el ejemplo del catálogo)
  enabled?: boolean;   // default true
  custom?: { titulo: string; categoria: CategoriaAviso; requiereRespuesta: boolean };
  flujo?: Flujo;       // FLUJO editable (disparador + pasos). Sin esto = aviso clásico.
};
type Store = Record<string, EntradaStore>;

export type PlantillaVista = AvisoCatalogo & { enabled: boolean; esCustom: boolean };

/**
 * EL STORE ES POR WORKSPACE, CON LOS DEL DUEÑO COMO PLANTILLA.
 *
 * ⚠️ Antes leía y escribía SIEMPRE en OWNER_WS, y eso era un bug de multi-inquilino
 * esperando a que la pantalla saliera del panel de la agencia: el primer cliente que
 * editara el texto de un aviso se lo cambiaba A TODOS. Y no era sólo el texto —
 * `dispararEvento` (lib/flujos.ts) lee los flujos activos y los ejecuta con el ws del
 * CONTEXTO, así que los flujos del dueño ya se estaban disparando dentro del grupo de
 * cada cliente.
 *
 * El modelo que queda (decisión de Martín, 28/09): lo del dueño es el DEFAULT que todos
 * heredan, y cuando un cliente toca algo se le guarda una copia suya en SU workspace.
 * Es copy-on-write por ENTRADA, no por store: un cliente que edita un aviso sigue
 * heredando los otros cuarenta y ocho, así que un aviso nuevo del catálogo le llega sin
 * que nadie lo copie. Mismo patrón que los prompts editables.
 *
 * Al dueño no se le hereda nada (su store ES el default), y eso evita el ciclo.
 */
async function leerStoreDe(ws: number | null): Promise<Store> {
  const raw = ws == null ? await getSetting(KEY_STORE) : await runWithWorkspace(ws, () => getSetting(KEY_STORE));
  if (!raw) return {};
  try { return (JSON.parse(raw) as Store) ?? {}; } catch { return {}; }
}

/** Lo propio del workspace actual, sin herencia. Es lo que se muta. */
async function leerStorePropio(): Promise<Store> {
  return leerStoreDe(null);
}

/**
 * Lo EFECTIVO: lo propio pisando lo heredado del dueño, entrada por entrada.
 * La fusión es por CAMPO y no por objeto entero: un cliente que sólo apagó un aviso
 * conserva el texto y el flujo que venían del dueño.
 */
async function leerStore(): Promise<Store> {
  const ws = await getWorkspaceActual();
  const propio = await leerStorePropio();
  if (ws === OWNER_WS) return propio;
  const base = await leerStoreDe(OWNER_WS);
  const out: Store = {};
  for (const id of new Set([...Object.keys(base), ...Object.keys(propio)])) {
    out[id] = { ...(base[id] ?? {}), ...(propio[id] ?? {}) };
  }
  return out;
}

/** Escribe SIEMPRE en el workspace actual: nadie edita el default de otro. */
async function guardarStore(s: Store): Promise<void> {
  await setSetting(KEY_STORE, JSON.stringify(s));
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
    disparador: 'Plantilla personalizada (la usas desde MaKo cuando aplique).',
    ejemplo: e.texto || '',
  };
}

// ── FLUJO de una plantilla (disparador + pasos editables) ─────────────────────
/** El flujo guardado de una plantilla (o null si es un aviso clásico). */
export async function getFlujo(id: string): Promise<Flujo | null> {
  const e = (await leerStore())[id];
  return e?.flujo && esFlujoValido(e.flujo) ? e.flujo : null;
}
/** Guarda (o borra con null) el flujo de una plantilla. */
export async function setFlujo(id: string, flujo: Flujo | null): Promise<void> {
  await mutar(id, (e) => {
    const next = { ...e };
    if (flujo && esFlujoValido(flujo)) next.flujo = flujo; else delete next.flujo;
    return next;
  });
}
/** Todos los flujos ACTIVOS (para el runtime / dispararEvento). */
export async function listarFlujosActivos(): Promise<Array<{ id: string; flujo: Flujo }>> {
  const store = await leerStore();
  return Object.entries(store)
    .filter(([, e]) => e.flujo && esFlujoValido(e.flujo) && e.flujo.activo && e.enabled !== false)
    .map(([id, e]) => ({ id, flujo: e.flujo as Flujo }));
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
// ⚠️ Lee lo EFECTIVO para no perder lo heredado (apagar un aviso no puede borrarle el
// texto que venía del dueño) pero escribe sólo sobre lo PROPIO: guardar el efectivo
// entero materializaría las 49 entradas en el workspace y lo congelaría — un aviso que
// el dueño mejore después ya no le llegaría a ese cliente.
async function mutar(id: string, patch: (e: EntradaStore) => EntradaStore | null): Promise<void> {
  const [efectivo, propio] = await Promise.all([leerStore(), leerStorePropio()]);
  const next = patch(efectivo[id] ?? {});
  if (next === null) delete propio[id]; else propio[id] = next;
  await guardarStore(propio);
}
export const setTextoPlantilla = (id: string, texto: string) => mutar(id, (e) => ({ ...e, texto }));

/**
 * «Volver al original» — y el original de un cliente NO es el de fábrica.
 *
 * Escribir `texto: ''` parecía lo mismo y no lo es: con la herencia, un '' propio
 * PISA el texto del dueño y la plantilla cae al ejemplo del catálogo. Borrar la
 * clave es lo que devuelve al default que su agencia escribió para él.
 */
export const resetTextoPlantilla = (id: string) => mutar(id, (e) => {
  const next = { ...e };
  delete next.texto;
  // Si no quedaba nada más propio, la entrada entera se va: una entrada vacía en
  // el store es una que dice «este cliente tocó esto» cuando no tocó nada.
  return Object.keys(next).length ? next : null;
});
export const setEnabledPlantilla = (id: string, enabled: boolean) => mutar(id, (e) => ({ ...e, enabled }));

/** Elimina: las custom se borran; las built-in NO se pueden borrar → se desactivan. */
export async function borrarPlantilla(id: string): Promise<{ borrada: boolean }> {
  const propio = await leerStorePropio();
  // Sólo se borra de verdad una custom PROPIA. Una custom heredada del dueño no se
  // puede borrar desde acá —no es de este workspace—, así que se desactiva como una
  // built-in: el cliente deja de recibirla sin tocarle el catálogo a nadie más.
  if (propio[id]?.custom) { delete propio[id]; await guardarStore(propio); return { borrada: true }; }
  await mutar(id, (e) => ({ ...e, enabled: false }));
  return { borrada: false };
}

export async function crearPlantilla(data: { titulo: string; categoria: CategoriaAviso; requiereRespuesta?: boolean; texto?: string }): Promise<PlantillaVista> {
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const entrada: EntradaStore = {
    texto: data.texto ?? '',
    enabled: true,
    custom: { titulo: data.titulo.trim() || 'Plantilla nueva', categoria: data.categoria, requiereRespuesta: !!data.requiereRespuesta },
  };
  const propio = await leerStorePropio(); propio[id] = entrada; await guardarStore(propio);
  return aVista(customACatalogo(id, entrada), entrada, true);
}

// ── Generación con IA (la plantilla es REFERENCIA, no molde) ──────────────────
const SYS_AVISO =
  'Eres MaKo, el copiloto de marketing del dueño de un negocio. Escribes un aviso de ' +
  'WhatsApp al dueño, en español neutro (tuteo): cercano, directo, sin vueltas, con la ' +
  'info clave adelante. Te doy una PLANTILLA DE REFERENCIA (guía de tono, formato y ' +
  'qué decir) y los DATOS REALES del evento. Usa la referencia como base pero eres ' +
  'LIBRE de adaptarla, acortarla o reescribirla para que suene natural con esos datos. ' +
  'Devuelve SOLO el mensaje final listo para mandar (sin comillas ni explicaciones). ' +
  'Puedes usar *negritas* de WhatsApp y algún emoji si pega. Cierra con "— MaKo".';

/**
 * Genera el texto de un aviso con IA, usando la plantilla como REFERENCIA + los
 * datos reales. Si algo falla, cae a la referencia literal (best-effort).
 */
export async function generarMensajeAviso(id: string, contexto: string): Promise<string> {
  const ref = await referenciaPlantilla(id);
  try {
    const user = `PLANTILLA DE REFERENCIA:\n${ref || '(sin referencia)'}\n\nDATOS REALES DEL EVENTO:\n${contexto}\n\nEscribe el mensaje.`;
    const out = await chatClaude(SYS_AVISO, [{ role: 'user', content: user }], {
      effort: 'low', maxTokens: 700, feature: 'avisos', motivo: `MaKo: aviso ${id}`,
    });
    return out.trim() || ref;
  } catch {
    return ref;
  }
}
