// =============================================================================
// general-vistas-modelo — las VISTAS de /general: qué bloques ve cada persona, en qué orden y de qué funnel
// =============================================================================
// Pedido de Martín (13/10/2026), textual: «Y te pido que la tab GENERAL sea personalizable... Que los usuarios
// puedan elegir que ver, si quieren ver "Prioridades" del PLAN, como el caso de Mauricio, las cuotas a cobrar...
// Otros querrán ver su objetivo, etc etc... Hazla personalizable.» Y en el mismo turno: «Copia lo que ya tenemos
// en muchos lugares con "TEMPLATES" y la opción de IA de "¿Qué vas a crear hoy?"... Que hayan templates de tab
// general. Y que se puedan crear más de una, e incluso asignarles ofertas y/o funnels.»
//
// Y lo de Mauricio (la reunión del 13/10, minuto 54 a 72): «el cobranza yo lo veo más operativo... ¿A quién
// cobrarle?», «me genera mucho valor estar viendo quién sigue de cobranza», y lo que le sirve «normalmente el CRM,
// el tema del plan y de la cobranza». Martín le contestó «lo pongo ahí en el general»: por eso «A quién cobrarle»
// entra en la vista POR DEFECTO de todos, y la plantilla «Operación diaria» es la de su caso.
//
// LO QUE DECIDE ESTE MÓDULO (puro, sin `server-only`: lo importan la pantalla, la ruta de la IA y el test):
//   · el CATÁLOGO de bloques (`BLOQUES_GENERAL`): los que /general sabe dibujar, y cuáles respetan el funnel;
//   · las PLANTILLAS (`PLANTILLAS_GENERAL`): la galería de «Nueva vista», con «Vista en blanco» primera siempre;
//   · el SANEO de lo guardado (`sanearVistas`) y de lo que devuelve la IA (`deIAVista`): lo que la IA ve y
//     devuelve es lo que la pantalla ofrece (AGENTS.md, duodécima tanda de Automations);
//   · el ALCANCE de una vista (`funnelsDelAlcance`): sus funnels más los que venden sus ofertas.
//
// ⚠️ EL DISEÑO DE /general NO SE MINIMALIZA (decisión de Martín del 08/09/2026, memoria general-diseno-restaurado):
//    personalizar es ELEGIR bloques del diseño restaurado —la isla oscura, el semáforo dibujado, las secciones en
//    tarjeta—, nunca dibujarlos de otra forma. Un bloque nuevo se dibuja con la misma fórmula de sección.
//
// ⚠️ UN BLOQUE QUE NO SABE FILTRAR POR FUNNEL NO FINGE QUE FILTRA. `porFunnel` dice cuáles leen sólo los leads del
//    alcance; el resto (el objetivo del Q, los KPIs, el semáforo, el mes, los pendientes) mide el negocio entero y
//    la pantalla lo DICE con «Todo el negocio» al lado del título cuando la vista tiene un alcance.
// =============================================================================

/** Los bloques que /general sabe dibujar. El ORDEN de este array es el de la lista de «Personalizar». */
export const BLOQUES_GENERAL = [
  { id: 'objetivo', emoji: '🎯', nombre: 'Objetivo y acción del día', linea: 'Cómo vas con el trimestre y qué hacer hoy.', porFunnel: false },
  { id: 'prioridades', emoji: '🗂️', nombre: 'Prioridades del Plan', linea: 'Las tareas que van primero.', porFunnel: false },
  { id: 'cobranza', emoji: '💵', nombre: 'A quién cobrarle', linea: 'Las cuotas que faltan cobrar, la más urgente arriba.', porFunnel: true },
  { id: 'funnel', emoji: '📊', nombre: 'Tu funnel hoy', linea: 'Cuántos leads hay en cada etapa.', porFunnel: true },
  { id: 'kpis', emoji: '📈', nombre: 'KPIs', linea: 'Lo que te comprometiste a hacer en el período.', porFunnel: false },
  { id: 'semaforo', emoji: '🚦', nombre: 'Semáforo del negocio', linea: 'Lo que está en rojo o en ámbar.', porFunnel: false },
  { id: 'mes', emoji: '🗓️', nombre: 'El mes', linea: 'Este mes contra el anterior.', porFunnel: false },
  { id: 'pendientes', emoji: '✅', nombre: 'Leads sin marcar', linea: 'Lo que falta marcar en el CRM.', porFunnel: false },
] as const;

export type BloqueGeneral = (typeof BLOQUES_GENERAL)[number]['id'];
export type DefBloque = (typeof BLOQUES_GENERAL)[number];

const IDS_BLOQUES: readonly string[] = BLOQUES_GENERAL.map((b) => b.id);
export const esBloqueGeneral = (x: unknown): x is BloqueGeneral => typeof x === 'string' && IDS_BLOQUES.includes(x);
export const defDeBloque = (id: BloqueGeneral): DefBloque => BLOQUES_GENERAL.find((b) => b.id === id)!;

/**
 * La vista que ve quien todavía no armó ninguna: la /general de siempre (el orden restaurado el 08/09/2026) con
 * «A quién cobrarle» después de los KPIs — lo que Martín le prometió a Mauricio («lo pongo ahí en el general»).
 * Va operativa y alta: es lo que se ACCIONA hoy, como la acción del día.
 */
export const BLOQUES_POR_DEFECTO: readonly BloqueGeneral[] = ['objetivo', 'kpis', 'cobranza', 'semaforo', 'mes', 'pendientes'];

export type VistaGeneral = {
  /** Corto y al azar: viaja en `?vista=`. */
  id: string;
  nombre: string;
  emoji: string;
  /** En el orden en que se dibujan. Vacío vale: una vista en blanco que todavía no tiene nada. */
  bloques: BloqueGeneral[];
  /** Los funnels de esta vista (filas de `funnels`). Vacío = todo el negocio. */
  funnels: number[];
  /** Las ofertas de esta vista (filas de `ofertas`): suman los funnels que las venden. */
  ofertas: number[];
};

export type VistasGeneral = { vistas: VistaGeneral[] };

/** Cuántas vistas puede tener una persona. Una fila de pastillas que no entra baja de renglón, nunca scrollea. */
export const MAX_VISTAS = 8;
export const MAX_NOMBRE_VISTA = 40;
/** Un tope de cordura: nadie arma una vista con 20 funnels, y un array sin tope es una puerta abierta. */
const MAX_ALCANCE = 30;
export const ID_VISTA_POR_DEFECTO = 'general';

export function vistaPorDefecto(): VistaGeneral {
  return { id: ID_VISTA_POR_DEFECTO, nombre: 'General', emoji: '🧭', bloques: [...BLOQUES_POR_DEFECTO], funnels: [], ofertas: [] };
}

/** Lo que ve quien no guardó nada. */
export const vistasIniciales = (): VistasGeneral => ({ vistas: [vistaPorDefecto()] });

/** Un id nuevo, que no choque con los que ya hay. */
export function nuevoIdVista(existentes: readonly string[], azar: () => number = Math.random): string {
  for (let i = 0; i < 20; i++) {
    const id = `v${Math.floor(azar() * 36 ** 6).toString(36).padStart(6, '0')}`;
    if (!existentes.includes(id)) return id;
  }
  return `v${Date.now().toString(36)}`;
}

const idsNumericos = (x: unknown): number[] => {
  if (!Array.isArray(x)) return [];
  const out: number[] = [];
  for (const v of x) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
    if (out.length >= MAX_ALCANCE) break;
  }
  return out;
};

/** El nombre, recortado. Vacío = «Mi vista». */
export const nombreDeVista = (x: unknown): string =>
  (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '').slice(0, MAX_NOMBRE_VISTA) || 'Mi vista';

/** Un emoji o dos caracteres, nunca un párrafo. */
const emojiDe = (x: unknown, def = '✨'): string => {
  const s = typeof x === 'string' ? x.trim() : '';
  return s && [...s].length <= 4 ? s : def;
};

/** Los bloques: sólo los del catálogo, sin repetir, en el orden en que vinieron. */
export function bloquesDe(x: unknown): BloqueGeneral[] {
  if (!Array.isArray(x)) return [];
  const out: BloqueGeneral[] = [];
  for (const b of x) if (esBloqueGeneral(b) && !out.includes(b)) out.push(b);
  return out;
}

/** Una vista guardada, saneada. null = no se puede leer como vista. */
export function sanearVista(raw: unknown): VistaGeneral | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim().slice(0, 24) : '';
  if (!/^[a-z0-9_-]{1,24}$/i.test(id)) return null;
  return {
    id,
    nombre: nombreDeVista(r.nombre),
    emoji: emojiDe(r.emoji),
    bloques: bloquesDe(r.bloques),
    funnels: idsNumericos(r.funnels),
    ofertas: idsNumericos(r.ofertas),
  };
}

/**
 * Lo guardado, saneado. Ids repetidos se descartan (gana la primera), y el tope es `MAX_VISTAS`.
 * ⚠️ SIN VISTAS NO HAY PANTALLA: si no queda ninguna, vuelve la de por defecto. Una lista vacía guardada no es
 *    «no quiero ver nada»: es un guardado roto, y una /general sin una sola pastilla no tiene por dónde volver.
 */
export function sanearVistas(raw: unknown): VistasGeneral {
  const lista = raw && typeof raw === 'object' && Array.isArray((raw as { vistas?: unknown }).vistas)
    ? (raw as { vistas: unknown[] }).vistas : [];
  const vistas: VistaGeneral[] = [];
  for (const v of lista) {
    const s = sanearVista(v);
    if (s && !vistas.some((x) => x.id === s.id)) vistas.push(s);
    if (vistas.length >= MAX_VISTAS) break;
  }
  return vistas.length ? { vistas } : vistasIniciales();
}

/** La vista que pide la URL (`?vista=`), o la primera. */
export function vistaActiva(v: VistasGeneral, pedida: string | null | undefined): VistaGeneral {
  return v.vistas.find((x) => x.id === pedida) ?? v.vistas[0] ?? vistaPorDefecto();
}

// ── Las plantillas ─────────────────────────────────────────────────────────────────────────────

export type PlantillaGeneral = { id: string; emoji: string; nombre: string; linea: string; bloques: readonly BloqueGeneral[] };

/**
 * La galería de «Nueva vista». Genéricas a propósito: lo que mira un negocio cualquiera. «Operación diaria» es el
 * caso de Mauricio (el plan, la cobranza y el CRM); «Foco del trimestre» es la /general de siempre.
 */
export const PLANTILLAS_GENERAL: readonly PlantillaGeneral[] = [
  { id: 'operacion', emoji: '⚡', nombre: 'Operación diaria', linea: 'El plan, la cobranza y el CRM del día.', bloques: ['prioridades', 'cobranza', 'funnel', 'pendientes'] },
  { id: 'foco', emoji: '🎯', nombre: 'Foco del trimestre', linea: 'El objetivo, los KPIs y el semáforo.', bloques: ['objetivo', 'kpis', 'semaforo', 'mes', 'pendientes'] },
  { id: 'cobranza', emoji: '💵', nombre: 'Cobranza', linea: 'A quién cobrarle y cómo viene el mes.', bloques: ['cobranza', 'mes'] },
  { id: 'objetivo', emoji: '🏁', nombre: 'Mi objetivo', linea: 'El objetivo del trimestre y cómo llegar.', bloques: ['objetivo', 'kpis', 'prioridades'] },
  { id: 'comercial', emoji: '📊', nombre: 'Comercial', linea: 'El funnel, el mes y lo que falta marcar.', bloques: ['funnel', 'mes', 'pendientes'] },
  { id: 'salud', emoji: '🚦', nombre: 'Salud del negocio', linea: 'Lo que está en rojo y cómo viene el mes.', bloques: ['semaforo', 'mes', 'kpis'] },
  { id: 'plan', emoji: '🗂️', nombre: 'Mi plan', linea: 'Las prioridades del Plan y el objetivo.', bloques: ['prioridades', 'objetivo'] },
];

/** «Vista en blanco»: la primera tarjeta, SIEMPRE (ningún texto del buscador la saca). */
export const VISTA_EN_BLANCO = { nombre: 'Vista en blanco', linea: 'Eliges tú los bloques.' } as const;

/** Las plantillas que pasan el buscador: por nombre, línea y el nombre de sus bloques, sin acentos. */
export function filtrarPlantillasGeneral(lista: readonly PlantillaGeneral[], texto: string): PlantillaGeneral[] {
  const q = sinAcentos(texto);
  if (!q) return [...lista];
  return lista.filter((p) => sinAcentos([p.nombre, p.linea, ...p.bloques.map((b) => defDeBloque(b).nombre)].join(' ')).includes(q));
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Una vista nueva desde una plantilla (con id nuevo). */
export function vistaDePlantilla(p: PlantillaGeneral, existentes: readonly string[], azar?: () => number): VistaGeneral {
  return { id: nuevoIdVista(existentes, azar), nombre: p.nombre, emoji: p.emoji, bloques: [...p.bloques], funnels: [], ofertas: [] };
}

/** La vista en blanco (con id nuevo). */
export function vistaEnBlanco(existentes: readonly string[], azar?: () => number): VistaGeneral {
  return { id: nuevoIdVista(existentes, azar), nombre: 'Mi vista', emoji: '✨', bloques: [], funnels: [], ofertas: [] };
}

/**
 * Agrega una vista al final. Con el tope lleno, no agrega: devuelve null y la pantalla lo dice (no se pisa la
 * última en silencio).
 */
export function agregarVista(v: VistasGeneral, nueva: VistaGeneral): VistasGeneral | null {
  if (v.vistas.length >= MAX_VISTAS) return null;
  return { vistas: [...v.vistas, nueva] };
}

/** Reemplaza una vista por id. Si no está, queda igual. */
export function cambiarVista(v: VistasGeneral, id: string, cambio: Partial<Omit<VistaGeneral, 'id'>>): VistasGeneral {
  return { vistas: v.vistas.map((x) => (x.id === id ? { ...x, ...cambio } : x)) };
}

/** Saca una vista. La última no se saca nunca: sin vistas no hay pantalla. */
export function quitarVista(v: VistasGeneral, id: string): VistasGeneral {
  if (v.vistas.length <= 1) return v;
  return { vistas: v.vistas.filter((x) => x.id !== id) };
}

/** Mueve un bloque un lugar arriba (-1) o abajo (+1) dentro de la vista. En el borde, queda igual. */
export function moverBloque(bloques: readonly BloqueGeneral[], id: BloqueGeneral, delta: -1 | 1): BloqueGeneral[] {
  const out = [...bloques];
  const i = out.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Prende o apaga un bloque. Prenderlo lo pone al final. */
export function alternarBloque(bloques: readonly BloqueGeneral[], id: BloqueGeneral): BloqueGeneral[] {
  return bloques.includes(id) ? bloques.filter((b) => b !== id) : [...bloques, id];
}

// ── El alcance: funnels y ofertas ─────────────────────────────────────────────────────────────

/** Una liga de `funnel_ofertas`: qué funnel vende qué oferta. */
export type LigaFunnelOferta = { funnel_id: number; oferta_id: number };

/**
 * Los funnels que mira una vista: los suyos más los que venden sus ofertas (`funnel_ofertas`). Vacío = todo el
 * negocio.
 *
 * ⚠️ UNA OFERTA QUE NINGÚN FUNNEL VENDE NO ES «TODO EL NEGOCIO». Si la vista eligió sólo ofertas y ninguna está en
 *    un funnel, el alcance es VACÍO DE VERDAD y la pantalla tiene que mostrar «nada en este alcance», no el negocio
 *    entero. Por eso ese caso devuelve `{ todo: false, funnels: [] }` y no `{ todo: true }`: un alcance pedido que
 *    no matchea nada no se colapsa contra «sin alcance».
 */
export function funnelsDelAlcance(v: Pick<VistaGeneral, 'funnels' | 'ofertas'>, ligas: readonly LigaFunnelOferta[]): { todo: true } | { todo: false; funnels: number[] } {
  if (!v.funnels.length && !v.ofertas.length) return { todo: true };
  const out = [...v.funnels];
  for (const l of ligas) {
    const f = Number(l.funnel_id);
    if (v.ofertas.includes(Number(l.oferta_id)) && Number.isInteger(f) && !out.includes(f)) out.push(f);
  }
  return { todo: false, funnels: out };
}

/** El rótulo del botón del alcance: «Todo el negocio», el nombre si es uno, o «N elegidos». */
export function rotuloAlcance(v: Pick<VistaGeneral, 'funnels' | 'ofertas'>, nombres: { funnels: ReadonlyMap<number, string>; ofertas: ReadonlyMap<number, string> }): string {
  const n = v.funnels.length + v.ofertas.length;
  if (!n) return 'Todo el negocio';
  if (n === 1) {
    const solo = v.funnels.length ? nombres.funnels.get(v.funnels[0]) : nombres.ofertas.get(v.ofertas[0]);
    if (solo) return solo;
  }
  return `${n} elegidos`;
}

// ── Lo que devuelve la IA ──────────────────────────────────────────────────────────────────────

/** Lo que la IA puede elegir: los bloques del catálogo y los funnels y ofertas del negocio (por id). */
export type CatalogoIAVista = { funnels: ReadonlyArray<{ id: number; nombre: string }>; ofertas: ReadonlyArray<{ id: number; nombre: string }> };

export type ResultadoIAVista = {
  vista: Omit<VistaGeneral, 'id'>;
  /** Lo que se sacó porque no existe (una línea cada uno, para el toast). */
  avisos: string[];
  /** Lo que hace inservible la respuesta (para el reintento). */
  errores: string[];
};

/**
 * La respuesta de la IA, revalidada contra el catálogo. Un bloque, un funnel o una oferta que no existe se SACA con
 * un aviso; nunca se reemplaza por «el más parecido». Sin un solo bloque válido es un error: una vista vacía armada
 * por MaKo no es lo que se pidió.
 */
export function deIAVista(obj: unknown, cat: CatalogoIAVista): ResultadoIAVista {
  const r = obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {};
  const avisos: string[] = [];
  const errores: string[] = [];
  const crudos = Array.isArray(r.bloques) ? r.bloques : [];
  const bloques = bloquesDe(crudos);
  const raros = crudos.filter((b) => !esBloqueGeneral(b));
  if (raros.length) avisos.push(`Saqué ${raros.length === 1 ? 'un bloque que no existe' : `${raros.length} bloques que no existen`}`);
  if (!bloques.length) errores.push(`"bloques" tiene que traer al menos uno de: ${IDS_BLOQUES.join(', ')}`);
  const idsF = new Set(cat.funnels.map((f) => f.id));
  const idsO = new Set(cat.ofertas.map((o) => o.id));
  const fPedidos = idsNumericos(r.funnels);
  const oPedidas = idsNumericos(r.ofertas);
  const funnels = fPedidos.filter((f) => idsF.has(f));
  const ofertas = oPedidas.filter((o) => idsO.has(o));
  if (fPedidos.length > funnels.length) avisos.push('Saqué un funnel que no existe');
  if (oPedidas.length > ofertas.length) avisos.push('Saqué una oferta que no existe');
  return { vista: { nombre: nombreDeVista(r.nombre), emoji: emojiDe(r.emoji), bloques, funnels, ofertas }, avisos, errores };
}

/** El catálogo que ve el modelo: una línea por bloque, por funnel y por oferta. Lo arma el código, no un prompt fijo. */
export function catalogoParaIA(cat: CatalogoIAVista): string {
  const b = BLOQUES_GENERAL.map((x) => `- ${x.id}: ${x.nombre} — ${x.linea}${x.porFunnel ? ' (se filtra por funnel)' : ''}`).join('\n');
  const f = cat.funnels.length ? cat.funnels.map((x) => `- ${x.id}: ${x.nombre}`).join('\n') : '(ninguno)';
  const o = cat.ofertas.length ? cat.ofertas.map((x) => `- ${x.id}: ${x.nombre}`).join('\n') : '(ninguna)';
  return `BLOQUES:\n${b}\n\nFUNNELS:\n${f}\n\nOFERTAS:\n${o}`;
}

// ── La API de MaKo: de quién es la vista, y la vista desde un pedido ───────────────────────────
// Regla de Martín del 13/10/2026: toda funcionalidad nueva se declara en la API de MaKo. Las vistas son POR
// PERSONA, así que la API tiene que saber de quién: se nombra (email o nombre), o se deduce sólo si la cuenta tiene
// UNA persona admin (General es sólo del admin). Puro, para el test; lo usa lib/api-mako/areas/general.run.ts.

export type PersonaVista = { sub: string; email: string; nombre: string };

const normalizarTexto = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** De quién es la vista. Dos personas con el mismo nombre: se pide el email. */
export function elegirPersonaVista(admins: readonly PersonaVista[], pedido: string | null | undefined): { ok: true; persona: PersonaVista } | { ok: false; error: string } {
  const p = (pedido ?? '').trim();
  if (p) {
    const n = normalizarTexto(p);
    const calza = p.includes('@')
      ? (x: PersonaVista) => normalizarTexto(x.email) === n
      : (x: PersonaVista) => !!x.nombre && normalizarTexto(x.nombre) === n;
    const hay = admins.filter(calza);
    if (hay.length > 1) return { ok: false, error: `Hay ${hay.length} personas que se llaman «${p}»: nómbrala con su email.` };
    if (!hay.length) return { ok: false, error: `No encontré a «${p}» entre las personas admin de la cuenta (General es sólo del admin).` };
    return { ok: true, persona: hay[0] };
  }
  if (admins.length === 1) return { ok: true, persona: admins[0] };
  return { ok: false, error: admins.length ? `La cuenta tiene ${admins.length} personas admin: di de quién es la vista (su email).` : 'La cuenta no tiene una persona admin con cuenta en MaKo.' };
}

/**
 * La vista que pide la API: una PLANTILLA (por id) o una lista de BLOQUES, con nombre, funnels y ofertas opcionales.
 * Se valida con `deIAVista` (el mismo saneo que lo que propone la IA): lo que no existe se saca con un aviso.
 */
export function vistaDesdePedido(input: { plantilla?: unknown; bloques?: unknown; nombre?: unknown; funnels?: unknown; ofertas?: unknown }, cat: CatalogoIAVista): ResultadoIAVista {
  const pl = typeof input.plantilla === 'string' ? PLANTILLAS_GENERAL.find((x) => x.id === input.plantilla) : undefined;
  if (typeof input.plantilla === 'string' && input.plantilla && !pl) {
    return { vista: { nombre: 'Mi vista', emoji: '✨', bloques: [], funnels: [], ofertas: [] }, avisos: [], errores: [`La plantilla «${input.plantilla}» no existe. Son: ${PLANTILLAS_GENERAL.map((x) => x.id).join(', ')}.`] };
  }
  const nombre = typeof input.nombre === 'string' && input.nombre.trim() ? input.nombre : pl?.nombre;
  return deIAVista({ nombre, emoji: pl?.emoji, bloques: pl ? [...pl.bloques] : input.bloques, funnels: input.funnels, ofertas: input.ofertas }, cat);
}
