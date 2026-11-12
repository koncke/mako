// =============================================================================
// chat-app-hilo — la conversación de los chats de la app como la ve Claude (12/11/2026)
// =============================================================================
// Martín, 11/11: «El chat de MaKo tiene que funcionar exactamente igual que un chat acá contigo en Claude. Tiene que guardar todo el
// contexto, tiene que todo el tiempo saber… Todos los chats de MaKo tienen que funcionar exactamente igual». El Ops Center, la
// estrella de cada tab y el Marketing CoPilot (`turnoApp`, lib/mako-turno-app.ts) le mandaban al modelo los últimos 12 mensajes,
// sólo el texto: volver al otro día a una entrevista del CoPilot ya no tenía cómo empezó. Ahora pasan por el módulo común
// (`conversacionDelTurno`, lib/conversacion.ts) con este adaptador de lectura:
//   · de `chart_chats` a la conversación del módulo, cortada por tokens (8.000), SIN ventana, y con el resumen de lo de antes;
//   · «lo que leí»: lo que trajeron las herramientas del turno, hasta 400 letras, se guarda con la respuesta de MaKo como una marca
//     que la pantalla no dibuja (`{ k: 'leido' }`, como la nota de voz) y vuelve en la historia: «¿y el mes que viene?» no obliga
//     a releer ni a inventar;
//   · el Second Brain se busca con el mensaje Y los anteriores de la persona: «dalo de alta» solo no nombra a nadie.
// Cada vista del hilo tiene su resumen (`claveDeLaApp`): el Ops Center ve todo, una tab común ve todo menos el CoPilot, y el CoPilot
// sólo lo suyo (lib/chat-desde.ts → delHiloDeLaTab).
// Puro, con test (tests/chat-app-hilo.test.ts).
// =============================================================================

import { TABS_CON_HILO_PROPIO, sinDesde } from './chat-desde';
import type { EntradaDelHilo, TurnoDelModelo } from './conversacion-reglas';
import { referenciasDeLaSalida } from './doer-hilo';

/** Una fila de `chart_chats` como la lee el turno (`getSessionMessagesConBloques`). */
export type FilaDelChat = { id?: number | null; role: 'user' | 'assistant'; content: string; created_at?: string | null; bloques?: unknown };

const slug = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Qué parte del hilo ve el chat: todo (el Ops Center), lo común (una tab sin hilo propio) o lo de una tab con hilo propio. */
export function vistaDelHilo(tab: string | null | undefined): string {
  if (!tab) return 'todo';
  return TABS_CON_HILO_PROPIO.includes(tab) ? slug(tab) : 'comun';
}

/** La clave de la conversación en el módulo (y de su resumen): la sesión y la vista. */
export const claveDeLaApp = (sessionId: number, tab: string | null | undefined): string => `app:${sessionId}:${vistaDelHilo(tab)}`;

// ── «Lo que leí» ─────────────────────────────────────────────────────────────

/** Cuánto de lo que trajeron las herramientas se guarda con cada respuesta (el plan del 11/11). */
export const TOPE_LEIDO = 400;

/** La marca que se guarda en `chart_chats.bloques`: `bloquesGuardados` y los adjuntos la saltean (no se dibuja). */
export type MarcaLeido = { k: 'leido'; texto: string };

const recortar = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1)).trimEnd()}…`);

/** Lo de una salida, en una línea: su `resumen` si lo trae (es apto para el modelo por contrato) o el JSON aplanado. */
function textoDeLaSalida(salida: unknown): string {
  const crudo = salida && typeof salida === 'object' && 'content' in (salida as object) ? (salida as { content: unknown }).content : salida;
  let v: unknown = crudo;
  if (typeof crudo === 'string') { try { v = JSON.parse(crudo); } catch { return crudo.replace(/\s+/g, ' ').trim(); } }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    for (const k of ['resumen', 'texto', 'mensaje']) if (typeof o[k] === 'string' && (o[k] as string).trim()) return (o[k] as string).replace(/\s+/g, ' ').trim();
    // `ok` y la instrucción de la tarjeta (`conInstruccionDeTarjeta`) no son lo que se leyó.
    v = Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'ok' && k !== 'instruccion'));
  }
  return JSON.stringify(v ?? '').replace(/["{}[\]]/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s*:\s*/g, ': ').replace(/\s+/g, ' ').trim();
}

/**
 * Lo que leyeron las herramientas del turno, para la historia: cada una con lo que mostró (los ids y los nombres, como
 * `referenciasDeLaSalida` en WhatsApp; si no trae ids, su texto), repartido parejo hasta `TOPE_LEIDO`. null si no corrió nada.
 */
export function loQueLei(salidas: ReadonlyArray<{ herramienta: string; salida: unknown }>, tope = TOPE_LEIDO): string | null {
  const partes = salidas.flatMap(({ herramienta, salida }) => {
    const refs = referenciasDeLaSalida(herramienta, salida);
    const texto = textoDeLaSalida(salida);
    const items = refs ? refs.items.map((it) => (it.nombre ? `${it.id} «${it.nombre}»` : it.id)).join(', ') : '';
    // Con ids, también el texto si trae más (los montos no son ids): primero lo que se nombra después («la segunda»).
    const extra = !items || texto.length > items.length * 2 ? texto : '';
    const linea = [items, extra].filter(Boolean).join(' — ');
    return linea ? [`${herramienta}: ${linea}`] : [];
  });
  if (!partes.length) return null;
  const cada = Math.max(80, Math.floor(tope / partes.length) - 3);
  return recortar(partes.map((p) => recortar(p, cada)).join(' · '), tope);
}

export const marcaLeido = (texto: string): MarcaLeido => ({ k: 'leido', texto: recortar(texto.trim(), TOPE_LEIDO) });

/** Lo leído guardado en los bloques de un mensaje, o null. Nunca tira. */
export function leidoDeBloques(crudo: unknown): string | null {
  if (!Array.isArray(crudo)) return null;
  for (const b of crudo) {
    if (b && typeof b === 'object' && (b as { k?: unknown }).k === 'leido' && typeof (b as { texto?: unknown }).texto === 'string') {
      const t = ((b as { texto: string }).texto).trim();
      if (t) return recortar(t, TOPE_LEIDO);
    }
  }
  return null;
}

// ── De `chart_chats` al módulo ───────────────────────────────────────────────

/** El hilo de la sesión (ya filtrado a su tab) como conversación del módulo: la persona y MaKo, con lo que MaKo leyó como oculto. */
export function entradasDeLaApp(filas: readonly FilaDelChat[]): EntradaDelHilo[] {
  let ultimo = 0;
  return filas.flatMap((f): EntradaDelHilo[] => {
    if (!(f.content ?? '').trim()) return [];
    // Sin fecha legible, pegado al anterior: el orden de la base es el que vale.
    const leida = Date.parse(f.created_at ?? '');
    const at = Number.isFinite(leida) ? leida : ultimo + 1;
    ultimo = at;
    const leido = f.role === 'assistant' ? leidoDeBloques(f.bloques) : null;
    return [{ id: f.id != null ? `app:${f.id}` : null, at, rol: f.role === 'assistant' ? 'mako' : 'persona', texto: f.content, ...(leido ? { oculto: `Lo que leí: ${leido}` } : {}) }];
  });
}

/** Lo que va en el turno de la persona cuando la conversación arranca con MaKo (la apertura de una tab, la pregunta del CoPilot). */
export const MARCA_APERTURA = '(Antes de que la persona escribiera, tú le dijiste lo que sigue.)';

/**
 * Los turnos para la API: empiezan con la persona y no repiten rol. Antes (`historialParaModelo`) un primer mensaje de MaKo se
 * tiraba, y era la pregunta que la persona contestaba («¿Cuánto te deja una venta?» → «300»); ahora va, marcado.
 */
export function historialDeTurnos(turnos: readonly TurnoDelModelo[]): TurnoDelModelo[] {
  const out: TurnoDelModelo[] = [];
  for (const t of turnos) {
    if (!out.length && t.role === 'assistant') out.push({ role: 'user', content: MARCA_APERTURA });
    const prev = out[out.length - 1];
    if (prev && prev.role === t.role) prev.content = `${prev.content}\n${t.content}`;
    else out.push({ role: t.role, content: t.content });
  }
  return out;
}

// ── El Second Brain con lo anterior ──────────────────────────────────────────

/** Las letras con las que se busca en el grafo (`LARGO_PREGUNTA_TURNO`, lib/cerebro-union.ts: más se corta). */
export const LARGO_BUSQUEDA = 600;
/** Del mensaje actual, como mucho: lo demás es para los anteriores. */
const DEL_ACTUAL = 360;

/** Los últimos mensajes de la persona antes del actual, el más nuevo primero, sin el chip de la tab. */
export function anterioresDeLaPersona(filas: readonly FilaDelChat[], n = 3): string[] {
  const out: string[] = [];
  for (let i = filas.length - 1; i >= 0 && out.length < n; i--) {
    if (filas[i].role !== 'user') continue;
    const t = sinDesde(filas[i].content ?? '').texto.replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}

/**
 * Con qué se busca en el Second Brain: el mensaje primero (el grafo usa las primeras letras) y después los 2 o 3 anteriores de la
 * persona, cortados para que todo entre en `LARGO_BUSQUEDA`. «Si perfecto, dalo de alta» encuentra a Código Inmobiliario si lo
 * nombró el mensaje de antes.
 */
export function busquedaConLoAnterior(actual: string, anteriores: readonly string[], tope = LARGO_BUSQUEDA): string {
  const a = actual.replace(/\s+/g, ' ').trim();
  const primero = a.length > DEL_ACTUAL && anteriores.length ? recortar(a, DEL_ACTUAL).replace(/…$/, '') : a;
  let resto = tope - primero.length;
  const partes = [primero];
  for (const ant of anteriores) {
    if (resto < 20) break;
    const t = ant.length + 1 > resto ? ant.slice(0, resto - 1).replace(/\s+\S*$/, '') : ant;
    if (!t) break;
    partes.push(t);
    resto -= t.length + 1;
  }
  return partes.filter(Boolean).join('\n').slice(0, tope);
}
