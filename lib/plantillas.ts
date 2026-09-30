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
import { CATALOGO_AVISOS, esAvisoDelCliente, type AvisoCatalogo, type CategoriaAviso } from './avisos-catalogo';
import { esFlujoValido, type Flujo } from './flujos-tipos';
import { sanearFrecuencia } from './disparador-mensaje';
import { conVariables } from './variables-resolver';

const KEY_STORE = 'mako.plantillas.store';

type EntradaStore = {
  texto?: string;      // referencia editada (pisa el ejemplo del catálogo)
  enabled?: boolean;   // default true
  custom?: { titulo: string; categoria: CategoriaAviso; requiereRespuesta: boolean };
  flujo?: Flujo;       // FLUJO editable (disparador + pasos). Sin esto = aviso clásico.
  canales?: { wa?: boolean; email?: boolean };  // por dónde sale. Ver CANALES_DEFAULT.
  frecuenciaMin?: number;  // cada cuánto COMO MÁXIMO. Ver `frecuenciaDe`.
  posiciones?: Record<string, { x: number; y: number }>;  // dónde quedó cada tarjeta del lienzo.
  titulo?: string;         // cómo lo llamó ESTE negocio. Pisa el del catálogo. Ver `aVista`.
  categoria?: CategoriaAviso;  // en qué grupo lo puso ESTE negocio.
  /**
   * LO ESCRITO Y TODAVÍA NO PUBLICADO.
   *
   * Vive aparte de `texto` porque son dos preguntas: qué manda MaKo hoy, y qué
   * está escribiendo alguien. El motor lee `texto` (vía `ejemplo`) y no sabe que
   * esto existe — que es todo el punto: «solo cuando le doy a publicar, se
   * publica». Salir de la pantalla de cualquier forma guarda acá.
   */
  borrador?: string;
};
type Store = Record<string, EntradaStore>;

/** Por dónde sale un aviso. Los dos campos resueltos: sin `undefined` río abajo. */
export type CanalesAviso = { wa: boolean; email: boolean };

/**
 * WhatsApp SÍ, email NO.
 *
 * El email arranca apagado porque prenderlo tiene consecuencias que el interruptor
 * de WhatsApp no tiene: cuesta plata, se le escribe a direcciones que quizá nadie
 * revisó, y un correo no deseado quema la reputación del dominio para TODOS los
 * mails del producto. La regla de la casa: el default es el que no tiene
 * consecuencias, y sólo un valor explícito lo enciende.
 *
 * ⚠️ ESTO NO GOBIERNA A LOS TRES REPORTES. Ellos ya tienen su canal en
 * `notification_prefs` (`CanalPrefs.wa` / `.email`), que es lo que leen sus crons y
 * lo que edita `PrefsDeMensaje`. Meterlos acá sería el segundo interruptor para la
 * misma pregunta — el bug que esta pantalla ya pagó una vez (dos campos que apagan
 * lo mismo son un switch que miente).
 */
export const CANALES_DEFAULT: CanalesAviso = { wa: true, email: false };

/**
 * CADA CUÁNTO, COMO MÁXIMO. Ausente = 0 = sin límite propio, o sea lo de siempre.
 *
 * ⚠️ UNA SOLA TIENDA PARA LOS 65, REPORTES INCLUIDOS — y eso es distinto de `canales`,
 * que está partido en dos. La diferencia no es capricho: el canal de los tres reportes
 * vive en `notification_prefs` porque sus crons lo leen de ahí desde antes de que este
 * store existiera, así que mudarlo es tocar un camino que hoy corre sólo para el dueño.
 * La frecuencia es un campo NUEVO: nadie la lee todavía, así que nace con un solo lugar
 * donde vive y sin la pregunta de «¿de qué tienda la saco?» que la otra sí paga.
 */
function frecuenciaDe(e: EntradaStore | undefined): number {
  return sanearFrecuencia(e?.frecuenciaMin);
}

/**
 * DÓNDE QUEDÓ CADA TARJETA del lienzo, por id de nodo.
 *
 * Se sanea entero: son coordenadas que escribe el navegador y gobiernan lo que se
 * dibuja. Un `NaN` o un `Infinity` mandan una tarjeta a un lugar del que no se
 * puede volver — y el encuadre automático, que mira la caja de todos los nodos,
 * se lleva al resto con ella.
 */
function posicionesDe(e: EntradaStore | undefined): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const [k, v] of Object.entries(e?.posiciones ?? {})) {
    const x = Number((v as { x?: unknown })?.x);
    const y = Number((v as { y?: unknown })?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    // El tope no es estético: es lo que impide que el encuadre colapse el zoom a
    // cero por un nodo perdido a un millón de píxeles.
    out[k] = { x: Math.max(-4000, Math.min(20000, x)), y: Math.max(-4000, Math.min(20000, y)) };
  }
  return out;
}

function canalesDe(e: EntradaStore | undefined): CanalesAviso {
  return {
    wa: typeof e?.canales?.wa === 'boolean' ? e.canales.wa : CANALES_DEFAULT.wa,
    email: typeof e?.canales?.email === 'boolean' ? e.canales.email : CANALES_DEFAULT.email,
  };
}

export type PlantillaVista = AvisoCatalogo & { enabled: boolean; esCustom: boolean; fijo: boolean; canales: CanalesAviso; frecuenciaMin: number; posiciones: Record<string, { x: number; y: number }>; borrador: string | null };

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
    // ⚠️ EL BORRADOR NO SE HEREDA, y es el único campo con esa excepción. Lo del
    // dueño es el DEFAULT de todos, y un borrador no es un default: es trabajo a
    // medio escribir de UNA persona. Heredado, cada cliente abriría el mensaje con
    // un «Sin publicar» y un texto que nunca tipeó — y al apretar Publicar estaría
    // publicando en SU negocio el borrador de la agencia.
    const { borrador: _sinHeredar, ...heredable } = base[id] ?? {};
    out[id] = { ...heredable, ...(propio[id] ?? {}) };
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
    enabled: estaPrendida(cat, e),
    // Un 'siempre' no se puede apagar, y la pantalla tiene que saberlo para no
    // ofrecer un botón que no hace nada.
    fijo: cat.porDefecto === 'siempre',
    // Viaja a la vista para que la pantalla lo pinte sin una segunda lectura. Si se
    // resolviera aparte, `aVista` lo descartaría y el detalle mostraría el default
    // mientras el motor manda por otro canal.
    canales: canalesDe(e),
    // Idem: la pantalla lo necesita para pintar el desplegable del disparador, y
    // resolverlo aparte dejaría el detalle mostrando «cada vez» sobre un mensaje
    // que el negocio ya espació.
    frecuenciaMin: frecuenciaDe(e),
    // Dónde arrastró cada tarjeta quien editó este mensaje. Viaja con la vista por
    // lo mismo que los canales: resolverlo aparte deja el lienzo dibujando el layout
    // calculado durante un parpadeo, y las tarjetas saltando a su lugar después.
    posiciones: posicionesDe(e),
    // Cómo lo llamó ESTE negocio. Un override por workspace: el `id` no cambia
    // nunca, así que renombrar no rompe ningún call site ni ninguna emisión — y el
    // catálogo sigue siendo el default para todos los demás.
    titulo: (e?.titulo && e.titulo.trim()) || cat.titulo,
    categoria: e?.categoria ?? cat.categoria,
    // Lo escrito sin publicar. `null` y no `''`: «no hay borrador» y «hay uno
    // vacío» son dos cosas, y la segunda es alguien que borró el texto a propósito
    // y todavía no lo publicó.
    borrador: typeof e?.borrador === 'string' ? e.borrador : null,
    esCustom,
  };
}

/**
 * ¿Este mensaje sale?
 *
 * ⚠️ ANTES ERA `e?.enabled !== false`, o sea: TODO prendido salvo lo que alguien
 * apagara a mano. Una cuenta nueva arrancaba recibiendo quince mensajes distintos
 * y el dueño los apagaba en bloque — «me llegan un chorro, ya desactivé los
 * otros»—, llevándose puesto el que sí importaba. Ahora el que manda es
 * `porDefecto` del catálogo, y sin él un mensaje nace APAGADO.
 *
 * Las custom son la excepción: si alguien se tomó el trabajo de escribir una, la
 * quiere — nacen prendidas.
 */
function estaPrendida(cat: AvisoCatalogo, e: EntradaStore | undefined): boolean {
  if (cat.porDefecto === 'siempre') return true;   // no se apaga, ni con un override viejo
  if (typeof e?.enabled === 'boolean') return e.enabled;
  if (e?.custom) return true;
  return cat.porDefecto === 'on';
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
  const antes = (await leerStore())[id]?.flujo;
  await mutar(id, (e) => {
    const next = { ...e };
    if (flujo && esFlujoValido(flujo)) next.flujo = flujo; else delete next.flujo;
    return next;
  });

  // ⚠️ APAGAR EL RECORDATORIO TIENE QUE APAGAR LOS QUE YA ESTÁN EN VUELO. El
  // drenador no consulta ninguna configuración: manda lo que haya en la tabla hasta
  // agotar las veces. Sin esto, sacar el paso dejaba saliendo hasta cinco mensajes
  // más — un interruptor que miente, y lo que sigue saliendo es lo que quema la
  // línea de WhatsApp del cliente.
  const teniaInsistir = antes?.pasos.some((p) => p.tipo === 'insistir') ?? false;
  const tieneInsistir = flujo?.pasos.some((p) => p.tipo === 'insistir') ?? false;
  if (teniaInsistir && !tieneInsistir) {
    const ws = (await getWorkspaceActual()) ?? OWNER_WS;
    const { cerrarPorConfiguracion } = await import('./insistencias');
    await cerrarPorConfiguracion(ws, id).catch(() => 0);
  }
}
/** Todos los flujos ACTIVOS (para el runtime / dispararEvento). */
export async function listarFlujosActivos(): Promise<Array<{ id: string; flujo: Flujo }>> {
  const store = await leerStore();
  return Object.entries(store)
    .filter(([, e]) => e.flujo && esFlujoValido(e.flujo) && e.flujo.activo && e.enabled !== false)
    .map(([id, e]) => ({ id, flujo: e.flujo as Flujo }));
}

/** Lista COMPLETA (catálogo + custom) con estado enabled + texto efectivo. */
/**
 * Los mensajes que el cliente puede ver, editar y prender.
 *
 * ⚠️ SOLO LOS QUE EXISTEN. El catálogo tiene 65 entradas pero 30 están marcadas
 * `yaImplementado: 'no'`: son el mapa de lo que MaKo PODRÍA decir, no código que
 * corra. Mostrarlas mezcladas con las reales le ofrecía al cliente prender
 * mensajes que no iban a llegar nunca, y de paso hacía la lista el doble de
 * larga — «son muchísimos, más de lo necesario».
 *
 * Las 'parcial' sí entran: esas salen, aunque no en todos los casos.
 *
 * El cliente ve SOLO los de `AVISOS_DEL_CLIENTE` (lib/avisos-catalogo.ts): seis,
 * elegidos a mano. El resto se sigue emitiendo —lo gobierna la agencia desde
 * /mensajes— pero no le ocupa una fila que tendría que entender y decidir.
 *
 * `vista: 'agencia'` es para el panel del super-admin, que sí quiere el mapa
 * completo: es su catálogo de trabajo, no la pantalla de un cliente.
 */
export async function listarPlantillas(opts: { vista?: 'cliente' | 'agencia' } = {}): Promise<PlantillaVista[]> {
  const store = await leerStore();
  const agencia = opts.vista === 'agencia';
  const base = agencia ? CATALOGO_AVISOS : CATALOGO_AVISOS.filter((c) => esAvisoDelCliente(c.id));
  const built = base.map((c) => aVista(c, store[c.id], false));
  const custom = Object.entries(store)
    .filter(([, e]) => e.custom)
    .map(([id, e]) => aVista(customACatalogo(id, e), e, true));
  return [...built, ...custom];
}

export async function getPlantilla(id: string): Promise<PlantillaVista | null> {
  // Sin filtrar: esto lo usa el RUNTIME para resolver el texto y el interruptor de
  // un aviso que ya se está emitiendo. Filtrar acá lo dejaría sin plantilla.
  return (await listarPlantillas({ vista: 'agencia' })).find((p) => p.id === id) ?? null;
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
export async function setEnabledPlantilla(id: string, enabled: boolean): Promise<void> {
  // El guard va en el SERVIDOR y no sólo en el botón: esconder el switch no
  // protege nada, y este aviso es el que dice que los números dejaron de llegar.
  if (!enabled && CATALOGO_AVISOS.find((c) => c.id === id)?.porDefecto === 'siempre') return;
  await mutar(id, (e) => ({ ...e, enabled }));
}

/**
 * Por dónde sale este aviso. Se guarda lo que llega, campo por campo: un patch que
 * sólo trae `email` no puede borrar la decisión de WhatsApp.
 *
 * ⚠️ NO valida que quede al menos uno prendido, y es a propósito: apagar los dos es
 * una forma legítima de decir «este aviso no me lo mandes» sin perder su texto ni su
 * flujo, y el motor lo trata igual que apagado (ver `estadoAviso` en lib/perfil.ts).
 */
export async function setCanalesPlantilla(id: string, canales: Partial<CanalesAviso>): Promise<void> {
  await mutar(id, (e) => ({ ...e, canales: { ...canalesDe(e), ...canales } }));
}

/**
 * CADA CUÁNTO, COMO MÁXIMO. Lo elige el negocio en el detalle del mensaje.
 *
 * Se SANEA acá además de en la ruta: el valor gobierna cuántos mensajes recibe una
 * persona, y ésta es la única puerta al store — un POST a mano, un patch de otra
 * pantalla o una preferencia vieja entran por acá igual que el desplegable.
 */
export async function setFrecuenciaPlantilla(id: string, min: number): Promise<void> {
  await mutar(id, (e) => ({ ...e, frecuenciaMin: sanearFrecuencia(min) }));
}

/**
 * Dónde quedó cada tarjeta del lienzo. Se guarda el mapa ENTERO, no un parche:
 * quien arrastra ya tiene todas las posiciones en pantalla, y un merge por nodo
 * dejaría vivas las de los que se borraron.
 */
export async function setPosicionesPlantilla(id: string, posiciones: Record<string, { x: number; y: number }>): Promise<void> {
  await mutar(id, (e) => ({ ...e, posiciones }));
}

/**
 * CÓMO SE LLAMA ESTE MENSAJE, para este negocio.
 *
 * Se escribe en UN lugar aunque el dato tenga dos orígenes: para una custom el
 * nombre de nacimiento vive en `custom.titulo` y acá se actualizan LOS DOS, así que
 * nunca pueden discrepar. `aVista` lee el override primero y el catálogo después —
 * una sola precedencia, escrita una sola vez.
 */
export async function setTituloPlantilla(id: string, titulo: string): Promise<void> {
  const t = titulo.trim().slice(0, 120);
  if (!t) return;   // un mensaje sin nombre no se puede volver a encontrar en la lista
  await mutar(id, (e) => ({
    ...e, titulo: t,
    ...(e.custom ? { custom: { ...e.custom, titulo: t } } : {}),
  }));
}

/** En qué grupo lo pone este negocio. Mismo patrón que el título. */
export async function setCategoriaPlantilla(id: string, categoria: CategoriaAviso): Promise<void> {
  await mutar(id, (e) => ({
    ...e, categoria,
    ...(e.custom ? { custom: { ...e.custom, categoria } } : {}),
  }));
}

/**
 * GUARDAR SIN PUBLICAR. Es lo que corre al salir de la pantalla de cualquier forma
 * —la X, el Escape, cambiar de mensaje— y mientras se escribe.
 *
 * Si el borrador vuelve a ser IGUAL a lo publicado, se borra la clave en vez de
 * guardar los dos: un «Sin publicar» sobre un texto idéntico al que sale es un
 * cartel que no se puede apagar.
 */
export async function setBorradorPlantilla(id: string, texto: string): Promise<void> {
  const publicado = await referenciaPlantilla(id);
  await mutar(id, (e) => {
    const next = { ...e };
    if (texto === publicado) delete next.borrador; else next.borrador = texto;
    return Object.keys(next).length ? next : null;
  });
}

/**
 * PUBLICAR: el borrador pasa a ser lo que MaKo manda, y deja de haber borrador.
 *
 * Devuelve `false` cuando no había nada que publicar, para que la pantalla no
 * diga «Publicado ✓» sobre algo que no se movió.
 */
export async function publicarBorrador(id: string): Promise<boolean> {
  let publico = false;
  await mutar(id, (e) => {
    if (typeof e.borrador !== 'string') return e;
    publico = true;
    const next = { ...e, texto: e.borrador };
    delete next.borrador;
    return next;
  });
  return publico;
}

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
  const refCruda = await referenciaPlantilla(id);
  /**
   * ⚠️ LAS VARIABLES SE RESUELVEN ANTES DEL MODELO Y EN LOS TRES RETORNOS.
   *
   * Antes, porque un dato exacto que pasa por un LLM deja de ser exacto —la casa ya lo
   * pagó con un link que resolvía a un borrador REAL pero equivocado— y el modelo
   * trabaja mejor sobre un texto que ya dice «Sofía Contreras» que sobre uno que dice
   * `{{lead_nombre}}`. Y en los TRES retornos porque dos de ellos se saltean el modelo
   * (el vacío y el `catch`): con la sustitución sólo en el camino feliz, la variable
   * falla exactamente cuando falla la IA, que es cuando menos se la mira.
   */
  const ws = await getWorkspaceActual();
  const ref = ws == null ? refCruda : await conVariables(refCruda, { ws });
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
