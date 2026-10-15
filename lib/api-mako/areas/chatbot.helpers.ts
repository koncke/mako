// =============================================================================
// api-mako/areas/chatbot.helpers — lógica del Chatbot que vivía SOLO en rutas
// =============================================================================
// Cada función de acá existía inline en un route handler de app/api/chat-agent/**
// (o no existía en ninguna lib) y la API la necesita sin pasar por HTTP interno.
// Se copió la regla de la ruta, no se inventó otra; cada una nombra su ruta de
// origen. DEUDA: el día que la lib exporte lo mismo, la ruta y esto importan de la
// lib y este archivo se achica.
//
// Todo corre adentro de runWithWorkspace (lo hace ejecutarOperacion): getTenantDb
// y getSetting scopean solos. Nunca getSupabaseServer para tablas por cliente.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { getSetting, getSettingEstricto, setSetting } from '@/lib/settings';
import { getFunnelDefault } from '@/lib/funnels';
import { getDiagnosticoFase } from '@/lib/fase-store';
import { motivoCaida } from '@/lib/evolution';
import { esClaveAudio, KEY_AUDIOS_CLAVE, KEY_LINK_VIDEO } from '@/lib/audios-paso';
import { KEY_OBJETIVOS_CUSTOM } from '@/lib/etapas-contexto';
import { OBJETIVOS } from '@/lib/setting-estrategia';
import { getEntregables, setEntregables } from '@/lib/entregable';
import { getEvidencia, setManual, componerVozGuia, BLOQUES } from '@/lib/chat-agent-voz';
import { setVozGuia } from '@/lib/nutricion-generator';

// ── Filas crudas (las libs filtran archivadas o topean en 50) ────────────────

export type SecuenciaFila = { id: number; nombre: string; clave: string; etapa: string; activa: boolean; archivada_at: string | null; estrategia: unknown; pasos: unknown };
export type SecuenciaCorta = Omit<SecuenciaFila, 'estrategia' | 'pasos'>;

/** Una secuencia de ESTE workspace por id, INCLUIDAS las archivadas
 *  (getSecuenciasConStats las filtra y desarchivar necesita verlas).
 *  Un error de lectura TIRA: «no pude leer» no es «no existe».
 *  Con los `pasos`: resolver un hand-off necesita saber si tiene la tarjeta «Si responde». */
export async function secuenciaFila(id: number): Promise<SecuenciaFila | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('id, nombre, clave, etapa, activa, archivada_at, estrategia, pasos').eq('id', id).maybeSingle();
  if (error) throw new Error(`api-mako: secuenciaFila: ${error.message}`);
  return (data as SecuenciaFila | null) ?? null;
}

/** Las archivadas, que ninguna lib lista (getSecuenciasConStats y listar_secuencias_nutricion las filtran). */
export const TOPE_ARCHIVADAS = 200;
export async function secuenciasArchivadas(): Promise<SecuenciaCorta[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('id, nombre, clave, etapa, activa, archivada_at')
    .not('archivada_at', 'is', null).order('archivada_at', { ascending: false }).limit(TOPE_ARCHIVADAS);
  if (error) throw new Error(`api-mako: secuenciasArchivadas: ${error.message}`);
  return (data ?? []) as SecuenciaCorta[];
}

/** Desarchiva Y pausa en la MISMA escritura, como `desarchivarSecuencia` (lib/secuencias-huecos.ts)
 *  desde el 14/10/2026. Ésta además sólo toca una que ESTÉ archivada, y devuelve cuántas filas tocó:
 *  0 = no existe o ya no estaba archivada. */
export async function desarchivarYPausar(id: number): Promise<number> {
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias')
    .update({ archivada_at: null, activa: false, updated_at: new Date().toISOString() })
    .eq('id', id).not('archivada_at', 'is', null).select('id');
  if (error) throw new Error(`api-mako: desarchivarYPausar: ${error.message}`);
  return (data ?? []).length;
}

/** Las secuencias del onboarding de audios (chat-agent-*), INCLUIDAS las archivadas:
 *  armarSecuenciasDeAudios las desarchiva PAUSADAS al reescribirlas. */
export async function secuenciasChatAgent(): Promise<SecuenciaCorta[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('id, nombre, clave, etapa, activa, archivada_at').like('clave', 'chat-agent-%');
  if (error) throw new Error(`api-mako: secuenciasChatAgent: ${error.message}`);
  return (data ?? []) as SecuenciaCorta[];
}

/** Inscripciones vivas de una secuencia (las que archivar cancela). */
export async function inscripcionesVivas(secuenciaId: number): Promise<number | null> {
  const db = await getTenantDb();
  const { count, error } = await db.from('nutricion_inscripciones').select('id', { count: 'exact', head: true })
    .eq('secuencia_id', secuenciaId).in('estado', ['activa', 'pendiente']);
  return error ? null : (count ?? 0);
}

/** Un hand-off por id (handoffsPendientes topea en los 50 más recientes). */
export async function handoffFila(id: number): Promise<{ id: number; secuencia_id: number | null; resuelto_at: string | null } | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('chat_agent_handoffs').select('id, secuencia_id, resuelto_at').eq('id', id).maybeSingle();
  if (error) throw new Error(`api-mako: handoffFila: ${error.message}`);
  return (data as { id: number; secuencia_id: number | null; resuelto_at: string | null } | null) ?? null;
}

/** DEUDA: no existe getInscripcionesDeLead en lib/nutricion.ts. */
export const TOPE_INSCRIPCIONES_LEAD = 100;
export async function inscripcionesDeLead(leadId: number) {
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_inscripciones')
    // `nodo_actual` y `hilos` (migs 0223 y 0228): con ramas, `paso_actual` es un índice del array y
    // no dice dónde está; con flechas en paralelo, puede estar en varias tarjetas a la vez.
    .select('secuencia_id, estado, paso_actual, nodo_actual, hilos, proximo_envio_at, ultimo_paso_at, desenlace, desenlace_at, inscripto_at')
    .eq('lead_id', leadId).order('inscripto_at', { ascending: false }).limit(TOPE_INSCRIPCIONES_LEAD);
  if (error) throw new Error(`api-mako: inscripcionesDeLead: ${error.message}`);
  const filas = (data ?? []) as Array<{ secuencia_id: number; estado: string; paso_actual: number; nodo_actual: string | null; hilos: unknown; proximo_envio_at: string | null; ultimo_paso_at: string | null; desenlace: string | null; desenlace_at: string | null; inscripto_at: string }>;
  const ids = [...new Set(filas.map((f) => f.secuencia_id))];
  // Con las archivadas: una inscripción cancelada al archivar sigue siendo historia del lead.
  const { data: secs } = ids.length
    ? await db.from('nutricion_secuencias').select('id, nombre, clave, archivada_at').in('id', ids)
    : { data: [] };
  const porId = new Map(((secs ?? []) as Array<{ id: number; nombre: string; clave: string; archivada_at: string | null }>).map((s) => [s.id, s]));
  return filas.map((f) => ({ ...f, secuencia: porId.get(f.secuencia_id) ?? null }));
}

// ── Canal (app/api/chat-agent/secuencias/route.ts GET) ───────────────────────

/** Tres respuestas distintas, no dos: nunca lo vinculó / se cayó / no se pudo preguntar.
 *  Se consulta acá y no con getInstanciaRow (lib/evolution.ts), que ignora el `error` de Supabase y
 *  devuelve null: con la base caída contestaba «sin_vincular». DEUDA: que la lib lo distinga. */
export async function estadoCanalWhatsapp() {
  const fuente = 'último estado registrado en la base, no una sonda en vivo: puede decir conectado sobre una sesión que ya se cayó';
  const db = await getTenantDb();
  // La línea POR DEFAULT del negocio (mig 0198). Era un `maybeSingle()` sin filtro: con dos
  // líneas Supabase devuelve error y esto contestaba «no se pudo leer» sobre un canal que anda.
  const { data, error } = await db.from('evolution_instancias').select('instance_name, estado, ultima_conexion_at')
    .order('es_default', { ascending: false }).order('id', { ascending: true }).limit(1).maybeSingle();
  if (error) return { estado: 'desconocido', desde: null, desvinculado: false, fuente, nota: 'No se pudo leer el estado: no es lo mismo que desconectado.' };
  const instancia = data as { instance_name: string; estado: string; ultima_conexion_at: string | null } | null;
  if (!instancia) return { estado: 'sin_vincular', desde: null, desvinculado: false, fuente };
  const motivo = instancia.estado !== 'conectado' ? await motivoCaida(instancia.instance_name, 4000).catch(() => null) : null;
  return { estado: instancia.estado, desde: motivo?.cuando ?? instancia.ultima_conexion_at, desvinculado: motivo?.desvinculado ?? false, fuente };
}

/** Etapas donde se puede colgar una secuencia: todo el funnel menos la banda de salidas. */
export async function etapasParaSecuencia(): Promise<Array<{ value: string; label: string }>> {
  // DEFAULT: es un catálogo del negocio («dónde podés colgar una secuencia»), no
  // el recorrido de un lead. Con varios funnels, el desplegable se agrupa por funnel.
  const funnel = await getFunnelDefault();
  return funnel.stages.filter((s) => (s.band ?? 'pipeline') !== 'salidas').map((s) => ({ value: s.key, label: s.label }));
}

// ── Objetivos propios (app/api/chat-agent/secuencias/objetivos/route.ts) ─────

export const TOPE_OBJETIVOS_CUSTOM = 30;
const DEL_CATALOGO = new Set<string>(OBJETIVOS.map((o) => o.value));

export async function leerObjetivosCustom(): Promise<string[]> {
  const raw = await getSetting(KEY_OBJETIVOS_CUSTOM);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, TOPE_OBJETIVOS_CUSTOM) : [];
  } catch { return []; }
}

export const esObjetivoDelCatalogo = (o: string): boolean => DEL_CATALOGO.has(o);

/** Para read-modify-write: getSetting convierte un error de Supabase en null y un JSON ilegible
 *  terminaba en {} o []; escribir encima borraba lo que había. Acá las dos cosas TIRAN. */
async function jsonEstricto(key: string): Promise<unknown> {
  const raw = await getSettingEstricto(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as unknown; } catch { throw new Error(`El setting ${key} no es JSON legible: no se escribe encima para no borrarlo.`); }
}

export async function agregarObjetivoCustom(objetivo: string): Promise<{ agregado: boolean; total: number }> {
  const arr = await jsonEstricto(KEY_OBJETIVOS_CUSTOM);
  if (arr != null && !Array.isArray(arr)) throw new Error(`El setting ${KEY_OBJETIVOS_CUSTOM} no es una lista: no se escribe encima.`);
  const previos = ((arr ?? []) as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim());
  if (esObjetivoDelCatalogo(objetivo) || previos.some((p) => p.toLowerCase() === objetivo.toLowerCase())) return { agregado: false, total: previos.length };
  const lista = [...previos, objetivo].slice(-TOPE_OBJETIVOS_CUSTOM);
  await setSetting(KEY_OBJETIVOS_CUSTOM, JSON.stringify(lista));
  return { agregado: true, total: lista.length };
}

// ── Audios: el mapa situación → audio (app/api/chat-agent/audios/route.ts) ───

export async function leerAudiosPorClave(): Promise<Record<string, number>> {
  const raw = await getSetting(KEY_AUDIOS_CLAVE);
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(p)) {
      const n = Number(v);
      if (esClaveAudio(k) && Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch { return {}; }
}

/** El mapa CRUDO, leído estricto: se reescribe tal cual, sin filtrar claves, para no perder nada. */
async function audiosPorClaveEstricto(): Promise<Record<string, unknown>> {
  const p = await jsonEstricto(KEY_AUDIOS_CLAVE);
  if (p == null) return {};
  if (typeof p !== 'object' || Array.isArray(p)) throw new Error(`El setting ${KEY_AUDIOS_CLAVE} no es un mapa: no se escribe encima.`);
  return p as Record<string, unknown>;
}

export async function asignarAudioAClave(clave: string, audioId: number): Promise<void> {
  if (!esClaveAudio(clave)) throw new Error(`«${clave}» no es una situación de audio del catálogo.`);
  await setSetting(KEY_AUDIOS_CLAVE, JSON.stringify({ ...(await audiosPorClaveEstricto()), [clave]: audioId }));
}

/** Sacar un audio borrado del mapa en el mismo golpe: si no, el motor intenta mandar algo que ya no está. */
export async function quitarAudioDeClaves(audioId: number): Promise<void> {
  const porClave = await audiosPorClaveEstricto();
  const limpio = Object.fromEntries(Object.entries(porClave).filter(([, v]) => Number(v) !== audioId));
  if (Object.keys(limpio).length !== Object.keys(porClave).length) await setSetting(KEY_AUDIOS_CLAVE, JSON.stringify(limpio));
}

/** Los insumos DECLARADOS de los que salen los audios y escenarios que aplican. Sin defaults:
 *  un funnel ilegible es «no declarado» (entradas []), nunca el funnel de otro negocio. */
export async function insumosAudios() {
  const [funnel, diag, linkVideo] = await Promise.all([
    // DEFAULT: cómo entra la gente a ESTE NEGOCIO es lo que decide qué audios pedir.
    getFunnelDefault().catch(() => null), getDiagnosticoFase().catch(() => null), getSetting(KEY_LINK_VIDEO).catch(() => null),
  ]);
  return { entradas: funnel?.entradas ?? [], canal: diag?.canal ?? null, evento: funnel?.evento ?? null, linkVideo: (linkVideo ?? '').trim() || null };
}

// ── Ensayo (app/api/chat-agent/onboarding/ensayo/route.ts) ───────────────────

export async function leerEnsayo(): Promise<Record<string, { respuestas: string[]; at: string; desenlace?: string | null }>> {
  const raw = await getSetting('chat_agent.ensayo');
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as { hechos?: unknown };
    return p && p.hechos && typeof p.hechos === 'object' ? (p.hechos as Record<string, { respuestas: string[]; at: string; desenlace?: string | null }>) : {};
  } catch { return {}; }
}

// ── Lead magnet (app/api/chat-agent/secuencias/route.ts action crear-lead-magnet) ──

export async function crearLeadMagnet(nombre: string, enlace: string): Promise<string> {
  // Solo http(s): otro esquema (javascript:, data:) termina pegado en un mensaje a un desconocido.
  if (!/^https?:\/\//i.test(enlace)) throw new Error('El enlace tiene que empezar con http:// o https://');
  // getEntregables (lib/entregable.ts) convierte un error de lectura o un JSON ilegible en [] y
  // setEntregables escribiría la lista con UN solo ítem, borrando los entregables que también usa
  // la fábrica de creativos. DEUDA: una lectura estricta en la lib (la clave es privada y se repite
  // acá). Mientras tanto: lectura estricta, y getEntregables tiene que devolver al menos esos.
  const crudo = await jsonEstricto('mako.entregable');
  if (crudo != null && !Array.isArray(crudo)) throw new Error('El setting mako.entregable no es una lista: no se escribe encima.');
  const guardados = ((crudo ?? []) as unknown[]).filter((x) => {
    const n = x && typeof x === 'object' ? (x as { nombre?: unknown }).nombre : null;
    return typeof n === 'string' && n.trim().length > 0;
  }).length;
  const lista = await getEntregables();
  if (lista.length < guardados) throw new Error('No se pudieron leer todos los entregables guardados: no se escribe encima para no borrarlos.');
  const id = `lm-${Date.now().toString(36)}`;
  await setEntregables([...lista, { id, nombre, tipo: 'Lead magnet', queEs: '', fomo: '', enlace }]);
  return id;
}

// ── Guía de voz (app/api/chat-agent/onboarding/contexto/route.ts action responder) ──

export const CLAVES_BLOQUE_VOZ = BLOQUES.map((b) => b.key as string);

/** Guarda lo que el dueño contestó y recompone la guía. NUNCA escribe una guía vacía:
 *  setVozGuia('') borraría la que ya existe y dejaría sin voz a todo lo que escribe por el negocio. */
export async function responderHuecosVoz(respuestas: Record<string, string>): Promise<{ guiaActualizada: boolean }> {
  // Estricto: getManual (lib/chat-agent-voz.ts) devuelve {} ante un error o un JSON ilegible, y
  // setManual pisaría las respuestas anteriores. DEUDA: la clave es privada de la lib y se repite acá.
  const crudo = await jsonEstricto('mako.chat_agent.voz.manual');
  if (crudo != null && (typeof crudo !== 'object' || Array.isArray(crudo))) throw new Error('El setting mako.chat_agent.voz.manual no es un mapa: no se escribe encima.');
  const manual: Record<string, string> = { ...((crudo ?? {}) as Record<string, string>) };
  for (const k of CLAVES_BLOQUE_VOZ) {
    const val = (respuestas[k] ?? '').trim().slice(0, 600);
    if (val) manual[k] = val;
  }
  await setManual(manual);
  const compuesto = componerVozGuia(await getEvidencia(), manual);
  if (!compuesto.trim()) return { guiaActualizada: false };
  await setVozGuia(compuesto);
  return { guiaActualizada: true };
}
