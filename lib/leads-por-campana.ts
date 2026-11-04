// =============================================================================
// leads-por-campana — «todos los leads de la campaña X», por nombre parcial (ticket #56, 4/11/2026)
// =============================================================================
// Natalia (ws 19) le pidió a MaKo por WhatsApp «la lista de TODOS los leads entrantes de la campaña, con nombre, apellido y
// número», y después «de la campaña: Campaña recon Finca Cortesin». MaKo contestó «No encontré leads con ese filtro. ¿De qué
// fecha es la campaña…?» con 113 leads en la cartera. Ninguna herramienta podía contestarlo: `buscar_leads` mira nombre,
// teléfono, email y empresa, y `listar_leads` filtra por etapa, fechas y personas. El nombre de la campaña no estaba en
// ninguna de las dos, y en un lead de landing ni siquiera está escrito: la landing guarda el ID (`utm_campaign`,
// `meta_campaign_id`, o el anuncio en `utm_content`).
//
// La campaña de cada lead sale de `origenAds` (lib/campana-atribucion.ts), la MISMA que usa el filtro del tablero del CRM: el id
// manda y el nombre es el de Meta de hoy (las métricas), o el que quedó escrito si no hay id. Acá sólo se decide CUÁL campaña
// nombra el texto, que es lo que se puede equivocar y por eso es puro.
//
// Sin `server-only`: lo prueba tests/leads-por-campana.test.ts sin base.
// =============================================================================

/** Una campaña con sus leads, como la conoce el tablero: `key` es el id de Meta, o `n:<nombre>` si sólo hay nombre. */
export type CampanaConLeads = { key: string; nombre: string; leads: number };

/** Lo que el texto dijo de una campaña: las que nombra, o (si no nombra ninguna) las más parecidas. */
export type CampanasDelTexto = { coinciden: CampanaConLeads[]; parecidas: CampanaConLeads[] };

/** Cuántas parecidas se ofrecen cuando el texto no nombra ninguna. */
export const TOPE_PARECIDAS = 5;
/** Cuántos leads devuelve una lista por campaña si no se pide otro número. Arriba de esto, `omitidos` lo dice. */
export const LIMITE_POR_CAMPANA = 200;
export const LIMITE_MAXIMO_POR_CAMPANA = 500;

/** Sin tildes, en minúsculas, y todo lo que no es letra o número es un espacio: «CAMPAÑA RECON - Finca» → «campana recon finca». */
export function normCampana(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Las palabras que no distinguen una campaña: la persona escribe «de la campaña: X». */
const RELLENO = new Set(['campana', 'campanas', 'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'con', 'para', 'por', 'a', 'al']);

/** Las palabras del pedido que sirven para reconocer una campaña. */
export function palabrasDelPedido(texto: string): string[] {
  return [...new Set(normCampana(texto).split(' ').filter((p) => p.length >= 2 && !RELLENO.has(p)))];
}

/** ¿El texto habla de una campaña? («campaña», «campana», «campañas»). Sirve para ofrecer las parecidas aunque no se parezca ninguna. */
export function hablaDeCampana(texto: string): boolean {
  return /\bcampanas?\b/.test(normCampana(texto));
}

/**
 * Cuántas palabras del pedido tiene el nombre de la campaña. Una palabra del pedido cuenta si es el PRINCIPIO de una palabra del
 * nombre («cortesin» en «cortesin2026», «recon» en «reconocimiento»). Por principio y no «en cualquier parte»: «ana» no tiene que
 * encontrar todas las «campaña».
 */
function aciertos(palabras: string[], nombre: string): number {
  const delNombre = normCampana(nombre).split(' ').filter(Boolean);
  return palabras.filter((p) => delNombre.some((n) => n.startsWith(p))).length;
}

/**
 * Las campañas que nombra el texto.
 *
 * - El id de Meta escrito tal cual («120212345678901234») es esa campaña.
 * - Si un nombre es IGUAL al pedido (sin tildes ni signos), es ésa sola: quien escribió el nombre entero no pidió las copias.
 * - Si no, todas las que tienen TODAS las palabras del pedido.
 * - Sin ninguna, las parecidas: las que tienen alguna palabra, de la que más tiene a la que menos; y si el texto habla de una
 *   campaña y ninguna se parece, las que más leads trajeron. Nunca se elige una por su cuenta: la persona dice cuál era.
 */
export function campanasDelTexto(texto: string, campanas: readonly CampanaConLeads[]): CampanasDelTexto {
  const crudo = texto.trim();
  const porId = campanas.filter((c) => c.key === crudo);
  if (porId.length) return { coinciden: porId, parecidas: [] };
  const palabras = palabrasDelPedido(texto);
  if (!palabras.length) return { coinciden: [], parecidas: hablaDeCampana(texto) ? masLeads(campanas) : [] };
  const pedido = palabras.join(' ');
  const iguales = campanas.filter((c) => palabrasDelPedido(c.nombre).join(' ') === pedido);
  if (iguales.length) return { coinciden: iguales, parecidas: [] };
  const conTodas = campanas.filter((c) => aciertos(palabras, c.nombre) === palabras.length);
  if (conTodas.length) return { coinciden: ordenadas(conTodas), parecidas: [] };
  const conAlguna = campanas
    .map((c) => ({ c, n: aciertos(palabras, c.nombre) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || b.c.leads - a.c.leads || a.c.nombre.localeCompare(b.c.nombre, 'es'))
    .map((x) => x.c);
  if (conAlguna.length) return { coinciden: [], parecidas: conAlguna.slice(0, TOPE_PARECIDAS) };
  return { coinciden: [], parecidas: hablaDeCampana(texto) ? masLeads(campanas) : [] };
}

const ordenadas = (cs: readonly CampanaConLeads[]) => [...cs].sort((a, b) => b.leads - a.leads || a.nombre.localeCompare(b.nombre, 'es'));
const masLeads = (cs: readonly CampanaConLeads[]) => ordenadas(cs.filter((c) => c.leads > 0)).slice(0, TOPE_PARECIDAS);

/** Un lead de la lista: lo que se pidió (nombre y teléfono) y con qué ubicarlo. `nombre` trae nombre y apellido juntos, como se cargó. */
export type FilaDeCampana = { id: number; nombre: string | null; telefono: string | null; email: string | null; entro: string | null; campana: string };

/** Cuántos renglones escribe el código en la lista de WhatsApp. Más que esto no entra en un mensaje; lo que sobra se dice. */
export const TOPE_LISTA_WHATSAPP = 1000;

/** «Juan Pérez — +52 55 1234 5678»; sin teléfono, el email; sin los dos, se dice. */
function renglon(f: FilaDeCampana, i: number): string {
  const contacto = f.telefono?.trim() || (f.email?.trim() ? `sin teléfono · ${f.email.trim()}` : 'sin teléfono ni email');
  return `${i + 1}. ${f.nombre?.trim() || 'Sin nombre'} — ${contacto}`;
}

/**
 * La lista que le llega a la persona por WhatsApp, ESCRITA POR EL CÓDIGO: un teléfono copiado por un modelo puede perder un dígito,
 * y una lista larga no entra en la respuesta del modelo (corta a 2.500 tokens, lib/mako-doer-in.ts). Con varias campañas, una
 * sección por campaña. Lo que no entra se dice con el número, nunca se calla.
 */
export function listaParaLaPersona(campanas: readonly CampanaConLeads[], filas: readonly FilaDeCampana[], tope = TOPE_LISTA_WHATSAPP): string {
  const nombres = campanas.map((c) => `«${c.nombre}»`);
  const titulo = `*Leads de ${nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0]}* (${filas.length})`;
  const van = filas.slice(0, tope);
  const porCampana = campanas.length > 1
    ? campanas.flatMap((c) => {
      const suyas = van.filter((f) => f.campana === c.nombre);
      return suyas.length ? ['', `*${c.nombre}* (${suyas.length})`, ...suyas.map(renglon)] : [];
    })
    : van.map(renglon);
  const resto = filas.length - van.length;
  return [titulo, ...(campanas.length > 1 ? porCampana : ['', ...porCampana]), ...(resto > 0 ? ['', `…y ${resto} más que no entran en este mensaje.`] : [])].join('\n');
}

/**
 * Las campañas que se conocen, con cuántos leads trajo cada una. Entran también las que conocen las métricas y no trajeron
 * ninguno (`deMetricas`): «la campaña existe y no tiene leads» es otra respuesta que «no la encontré».
 */
export function campanasConocidas(
  pares: ReadonlyArray<{ key: string | null; nombre: string | null }>,
  deMetricas: Record<string, string> = {},
): CampanaConLeads[] {
  const m = new Map<string, CampanaConLeads>();
  for (const p of pares) {
    if (!p.key) continue;
    const prev = m.get(p.key);
    m.set(p.key, { key: p.key, nombre: prev?.nombre || p.nombre || `Campaña ${p.key}`, leads: (prev?.leads ?? 0) + 1 });
  }
  for (const [id, nombre] of Object.entries(deMetricas)) {
    if (!m.has(id) && nombre?.trim()) m.set(id, { key: id, nombre: nombre.trim(), leads: 0 });
  }
  return ordenadas([...m.values()]);
}
