// =============================================================================
// reunion-cliente-reglas — las reglas PURAS de «¿de qué cliente es esta reunión y a qué proyecto va?»
// =============================================================================
// Puro y sin `server-only`: lo usa lib/reunion-cliente.ts (que hace las lecturas de la base) y lo
// fijan los tests. Nació el 17/10/2026 con la tarjeta #870, que juntaba tres fallas de la misma
// regla («el proyecto lo define la reunión», memoria `proyecto-lo-define-la-reunion`):
//
//   1. EN EL TABLERO DEL DUEÑO LA REUNIÓN NO MANDA. La regla la dictó Mauricio para SUS reuniones
//      con SUS clientes, donde lo que sale es trabajo de ese cliente. El tablero de Martín (el
//      super admin) es el de quien CONSTRUYE MaKo: una llamada con Código Inmobiliario deja bugs y
//      features de Automations, CRM, Dashboard. Aplicada igual, las 26 tarjetas de la revisión del
//      16/10 cayeron en «Cliente: Código Inmobiliario» y las 11 de Mauricio en un proyecto que la
//      importación CREÓ («Cliente: Mauricio Bustos», al lado de «Cliente: Mauricio»). `clienteManda`.
//
//   2. UN CLIENTE, UN PROYECTO. El proyecto de un cliente se buscaba SÓLO por nombre, y el nombre
//      cambia: el CRM dice «Congelados HMO», la persona «Macario Romero Valencia» y el dueño le puso
//      «Cliente: Macario Romero — HMO». Así el ws1 terminó con TRES proyectos para el lead 31
//      («hay dos Macarios», Mauricio en la llamada del 16/10). El dato duro es el `cliente_lead_id`
//      de la categoría: se busca primero por él (`proyectoDelCliente`), y el que se crea nace con él.
//
//   3. EL TÍTULO DICE EL CLIENTE CON OTRAS PALABRAS. «Junta Monserrat HMO» no tenía un solo email
//      de cliente (Fathom devolvió sólo al que grabó) y el título no nombra la empresa entera
//      («Congelados HMO»): 7 de sus 15 tareas cayeron en «Sin proyecto». `clientePorTitulo` reconoce
//      la SIGLA de la empresa (HMO, TEXX) y la empresa con las palabras en otro orden («Baja
//      Teriyaki» por «Teriyaki baja»). Nunca un nombre de pila suelto: «NADIA PIEDAD… Mentoría» no
//      es «Nadia H Tremari», que es justo el falso positivo que mide el test.
// =============================================================================

export const normCliente = (s: string): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const palabras = (s: string): string[] =>
  normCliente(s).replace(/[^a-z0-9ñ]+/g, ' ').split(/\s+/).filter(Boolean);

/** El prefijo con el que el dueño nombra un proyecto de cliente: se saca para comparar. */
export const sinPrefijoCliente = (nombre: string): string =>
  normCliente(nombre).replace(/^(cuenta|cliente|proyecto)\s*:?\s+/, '');

/**
 * Palabras que NO identifican a nadie: están en el nombre de muchas empresas o en el título de
 * cualquier reunión. Ni sirven para reconocer un cliente ni cuentan como «la empresa entera».
 */
const GENERICAS = new Set([
  'cliente', 'cuenta', 'proyecto', 'grupo', 'group', 'empresa', 'agencia', 'independiente', 'consultores',
  'consultoria', 'servicios', 'soluciones', 'comercial', 'comercializadora', 'industrial', 'industrias',
  'internacional', 'mexico', 'inmobiliaria', 'real', 'estate', 'realty', 'digital', 'marketing', 'ventas',
  'junta', 'reunion', 'seguimiento', 'sesion', 'sesiones', 'llamada', 'revision', 'kickoff', 'onboarding',
  'equipo', 'plan', 'mako', 'con', 'del', 'las', 'los', 'por', 'para', 'and', 'the', 'inc', 'llc', 'corp',
  'company', 'sa', 'cv', 'de', 'la', 'el', 'y', 'meet', 'zoom', 'google', 'impromptu', 'meeting',
]);

/** Las palabras que SÍ identifican: 3 letras o más y no genéricas. */
const significativas = (s: string): string[] => palabras(s).filter((w) => w.length >= 3 && !GENERICAS.has(w));

// ── 1. ¿La reunión manda el proyecto? ───────────────────────────────────────────────────────────

/** Qué tablero es: el del super admin (`plan_tareas`) o el de un cliente (`experimento_tareas`). */
export type TableroDe = 'dueno' | 'cliente';

/**
 * ¿El cliente de la reunión decide a qué proyecto van TODAS sus tareas? Sólo en el tablero de un
 * CLIENTE. En el del dueño, lo que un cliente dice de MaKo va a la tab de la que habla, y el
 * proyecto «Cliente: X» queda para el trabajo con la cuenta de ese cliente (lo elige la extracción,
 * tarea por tarea, de la lista de proyectos que ya existen).
 */
export const clienteManda = (tablero: TableroDe): boolean => tablero === 'cliente';

// ── 2. El proyecto que YA tiene el cliente ──────────────────────────────────────────────────────

export type CatCliente = { id: number; nombre: string; cliente_lead_id?: number | null };
export type ClienteRef = { leadId: number; empresa: string | null; nombre: string };

/** ¿Todas las palabras significativas de `a` están en `b`? (sin importar el orden) */
const todasEn = (a: string[], b: string[]): boolean => a.length > 0 && a.every((w) => b.includes(w));

/**
 * ¿Este proyecto es de este cliente? Una categoría atada a un lead lo dice con el dato: es suya si es
 * SU lead, y nunca de otro por más que el nombre se parezca. Sin lead, por el nombre (sin el prefijo
 * «Cliente: »):
 *   · exacto, con la empresa o con la persona;
 *   · todas las palabras de la empresa (o de la persona) en el proyecto, en cualquier orden
 *     («Cliente Baja Teriyaki» para «Teriyaki baja»);
 *   · al revés: todas las palabras del proyecto entre las del cliente (empresa y persona juntas), con
 *     DOS o más palabras («Cliente: Macario Romero — HMO» para «Macario Romero Valencia» de
 *     «Congelados HMO»). Con una sola no: «Cliente: Mauricio» no es de cualquier Mauricio.
 */
export function esDelCliente(x: CatCliente, c: ClienteRef): boolean {
  if (x.cliente_lead_id) return !!c.leadId && x.cliente_lead_id === c.leadId;
  const claves = [c.empresa ?? '', c.nombre].map((s) => s.trim()).filter(Boolean);
  if (!claves.length) return false;
  const proy = sinPrefijoCliente(x.nombre);
  if (claves.some((k) => proy === normCliente(k))) return true;
  const delProy = significativas(proy);
  if (claves.some((k) => todasEn(significativas(k), delProy))) return true;
  const delCliente = claves.flatMap(significativas);
  return delProy.length >= 2 && todasEn(delProy, delCliente);
}

/**
 * El proyecto que YA EXISTE para este cliente, o `undefined`. Primero el atado a su lead (el dato de
 * la base, que no depende de cómo se escribió), después el que su nombre reconoce (`esDelCliente`).
 * Con varios gana el primero: la lista viene en orden de creación, así que es el que armó el dueño.
 */
export function proyectoDelCliente<T extends CatCliente>(cats: readonly T[], c: ClienteRef): T | undefined {
  if (c.leadId > 0) {
    const porLead = cats.find((x) => x.cliente_lead_id === c.leadId);
    if (porLead) return porLead;
  }
  return cats.find((x) => esDelCliente(x, c));
}

// ── 3. El cliente que nombra el TÍTULO ──────────────────────────────────────────────────────────

export type LeadCliente = { id: number; nombre: string | null; empresa: string | null; email?: string | null };

/**
 * Las SIGLAS de una empresa, como están escritas: «Congelados HMO» → hmo; «TEXX» → texx. Una empresa
 * escrita TODA en mayúsculas y con varias palabras («BRISAS RESIDENCES MAHAHUAL», o una persona
 * cargada como «MARIA LOPEZ») no tiene siglas: ahí la mayúscula no distingue nada.
 */
const siglas = (empresa: string): string[] => {
  const toks = empresa.match(/[A-Za-zÀ-ÿÑñ]+/g) ?? [];
  const mayus = (w: string) => w === w.toUpperCase() && w !== w.toLowerCase();
  if (toks.length > 1 && toks.every(mayus)) return [];
  return toks.filter((w) => w.length >= 3 && w.length <= 6 && mayus(w)).map(normCliente).filter((s) => !GENERICAS.has(s));
};

/**
 * El cliente (un lead GANADO) que nombra el título de una reunión, con dos vías que no confunden
 * personas:
 *   · la EMPRESA entera con las palabras en cualquier orden («Reunion Paty Baja Teriyaki» →
 *     «Teriyaki baja»), sin contar las genéricas («Grupo Esquer» → basta «Esquer»);
 *   · una SIGLA de la empresa tal como está escrita en el CRM («Junta Monserrat HMO» → «Congelados
 *     HMO»), de 3 a 6 letras mayúsculas.
 * Si la sigla o la empresa es de más de un cliente, o el título nombra a dos, no se elige: `null`.
 * Los nombres de PERSONA no entran: un nombre de pila se repite entre clientes que no tienen nada
 * que ver, y eso ya lo resuelve `clienteEnTexto` con el nombre completo.
 */
export function clientePorTitulo<T extends LeadCliente>(titulo: string, leads: readonly T[]): T | null {
  const t = significativas(titulo);
  if (!t.length) return null;
  const cuenta = new Map<string, number>();
  for (const l of leads) for (const s of new Set(siglas(l.empresa ?? ''))) cuenta.set(s, (cuenta.get(s) ?? 0) + 1);
  const hits = new Map<number, T>();
  for (const l of leads) {
    const emp = (l.empresa ?? '').trim();
    if (!emp) continue;
    const ws = significativas(emp);
    const porEmpresa = todasEn(ws, t);
    const porSigla = siglas(emp).some((s) => cuenta.get(s) === 1 && t.includes(s));
    if (porEmpresa || porSigla) hits.set(l.id, l);
  }
  return hits.size === 1 ? [...hits.values()][0] : null;
}
