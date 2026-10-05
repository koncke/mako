// =============================================================================
// campana-config — qué campaña o conjunto de Meta entra a qué PRODUCTO
// =============================================================================
// Pedido de Martín (05/10/2026), textual: «que podamos asignar una campaña y/o
// adsets a un determinado producto, o más de uno... Para eso es importante la
// configuración de la primera etapa en todo funnel de "Leads entrantes", que se
// pueda tener un desplegable o algo para seleccionar las campañas que deberían caer
// allí. Eso hace que todo tenga sentido».
//
// Es el GEMELO de `landing-config.ts` (la página → el producto) y por eso se escribe
// con el mismo molde: un setting propio, un saneo tolerante, y quien USA el número
// lo valida contra los embudos vivos.
//
// ⚠️ POR QUÉ UN SETTING PROPIO Y NO `funnels.data`. Lo natural parece guardarlo en el
// embudo, que es de quien es. Pero `funnels.data` lo reescriben ENTERO varias
// operaciones del pop-up (las etapas, las entradas, la plantilla), y un campo nuevo en
// un objeto que se guarda entero se pierde en el primer guardado de un escritor que no
// lo conoce — sin error, con la asignación borrada. Es «dos escritores con dos ritmos
// son dos claves» (AGENTS.md). Acá hay UN escritor (el selector) y UN lector (el
// ruteo).
//
// ⚠️ ES UN MAPA, NO UNA LISTA POR EMBUDO. Una campaña cae en UN producto: el lead
// tiene un solo `funnel_id`. Con una lista por embudo, la misma campaña podría estar
// en dos y el ruteo tendría que desempatar en silencio. Acá la clave es el id de la
// campaña, así que asignarla a otro producto la MUEVE — no hay forma de escribir el
// estado ambiguo.
//
// ⚠️ EL CONJUNTO GANA A LA CAMPAÑA. Si la campaña C va al producto A y uno de sus
// conjuntos al B, un lead de ese conjunto va a B: lo más específico es lo que alguien
// eligió a propósito. Es la única regla de precedencia, y vive en `funnelIdDeCampana`.
//
// Sin `server-only`, a propósito: el saneo y la precedencia son lo que se puede
// equivocar, y tienen que poder testearse sin base.
// =============================================================================

/** Una campaña o un conjunto de Meta asignado a un producto. */
export type CampanaAsignada = {
  tipo: 'campana' | 'conjunto';
  /** El id de Meta. Es la identidad: no puede haber dos con el mismo. */
  id: string;
  /**
   * El nombre al momento de asignarla. NO decide nada —el ruteo es por id—: existe
   * para poder MOSTRAR una asignación cuya campaña ya no aparece en Meta (borrada,
   * archivada, o con el token caído). Sin él, la fila sería un número suelto, y la
   * única forma de quitarla sería adivinar qué era.
   */
  nombre: string;
  /** La campaña madre de un conjunto, para dibujarlo debajo de ella. */
  campanaId?: string;
  /**
   * El EMBUDO al que entran sus leads. `null` = el del negocio, que es como el CRM
   * escribe ese embudo en `leads.funnel_id` (ver `lib/landing-funnel.ts`: escribir el
   * id del default saca al lead del único tablero que el cliente mira).
   *
   * ⚠️ Y puede llegar como STRING: `funnels.id` es `bigint`. Se sanea al parsear.
   */
  funnelId: number | null;
};

export const CONFIG_KEY = 'meta.campanas';
/** Holgado: una cuenta grande corre decenas de campañas, no cientos asignadas a mano. */
export const MAX_ASIGNADAS = 200;

/** Un id de Meta: sólo dígitos. Cualquier otra cosa es un nombre o basura. */
const ID_META = /^\d{5,30}$/;
export const esIdMeta = (v: unknown): v is string => typeof v === 'string' && ID_META.test(v.trim());

const limpio = (v: unknown, max: number): string =>
  (typeof v === 'string' ? v : '').trim().slice(0, max);

/** Un id de fila: entero positivo, venga como número o como texto (bigint). */
const idFila = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * Lee la configuración. Tolera todo lo que no sea una lista de asignaciones válidas:
 * una configuración ilegible no puede romper el alta de un lead, que vale mucho más
 * que saber a qué producto iba — cae al embudo del negocio, como hoy.
 */
export function parsearCampanas(crudo: string | null | undefined): CampanaAsignada[] {
  if (!crudo?.trim()) return [];
  let lista: unknown;
  try { lista = JSON.parse(crudo); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  const out: CampanaAsignada[] = [];
  for (const x of lista) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const id = limpio(r.id, 30);
    if (!esIdMeta(id) || out.some((c) => c.id === id)) continue;
    const tipo = r.tipo === 'conjunto' ? 'conjunto' : 'campana';
    const campanaId = limpio(r.campanaId, 30);
    out.push({
      tipo,
      id,
      nombre: limpio(r.nombre, 200) || id,
      ...(tipo === 'conjunto' && esIdMeta(campanaId) ? { campanaId } : {}),
      funnelId: idFila(r.funnelId),
    });
  }
  return out.slice(0, MAX_ASIGNADAS);
}

/**
 * Asigna (o reasigna) una campaña o conjunto a un embudo. Si ya estaba en otro, se
 * MUEVE: la clave es el id, así que no puede quedar en dos.
 *
 * Conserva la POSICIÓN al reasignar, igual que `conLanding`: que una fila salte al
 * final porque le cambiaste el producto es desconcertante.
 */
export function conCampana(actuales: CampanaAsignada[], nueva: CampanaAsignada): CampanaAsignada[] | null {
  const [limpia] = parsearCampanas(JSON.stringify([nueva]));
  if (!limpia) return null;
  const i = actuales.findIndex((c) => c.id === limpia.id);
  const lista = i >= 0 ? actuales.map((c, j) => (j === i ? limpia : c)) : [...actuales, limpia];
  return lista.slice(0, MAX_ASIGNADAS);
}

export function sinCampana(actuales: CampanaAsignada[], id: string): CampanaAsignada[] {
  return actuales.filter((c) => c.id !== id);
}

/**
 * A qué embudo entra un lead que vino de esta campaña y/o conjunto.
 *
 * Devuelve TRES cosas distintas, y la diferencia importa:
 *   · `{ asignada: false }` — ni la campaña ni el conjunto están asignados. El lead
 *     cae donde caería sin esto (otra regla puede decidir, como la de la landing).
 *   · `{ asignada: true, funnelId: null }` — está asignada al embudo del NEGOCIO.
 *   · `{ asignada: true, funnelId: N }` — está asignada al embudo N.
 *
 * ⚠️ Con un solo `number | null` las dos primeras serían el mismo valor, y quien
 * llama no podría distinguir «nadie la asignó» de «la asignaron al principal» — que
 * para el opt-in de una landing es la diferencia entre dejar decidir a la landing o no.
 *
 * El CONJUNTO gana a la campaña (ver la cabecera).
 *
 * ⚠️ `esViva` SE APLICA ANTES DE LA PRECEDENCIA, no después. Si el conjunto apunta a un
 * producto que se archivó, no puede decidir nada — tampoco puede TAPAR a su campaña. La
 * primera versión validaba el ganador después de elegirlo: con el conjunto S → B
 * (archivado) y su campaña C → A (vivo), devolvía «no asignada» y el lead caía al
 * tablero del negocio con C todavía asignada a A. Lo encontró la revisión adversarial
 * del 05/10/2026. Sin `esViva` se asume que todo está vivo (para los tests y para el
 * chequeo barato que no consulta embudos).
 */
export function funnelIdDeCampana(
  asignadas: CampanaAsignada[],
  origen: { campaignId?: string | null; adsetId?: string | null },
  esViva: (funnelId: number | null) => boolean = () => true,
): { asignada: false } | { asignada: true; funnelId: number | null; por: CampanaAsignada } {
  const adset = origen.adsetId?.trim();
  const camp = origen.campaignId?.trim();
  asignadas = asignadas.filter((c) => esViva(c.funnelId));
  const porConjunto = adset ? asignadas.find((c) => c.tipo === 'conjunto' && c.id === adset) : undefined;
  if (porConjunto) return { asignada: true, funnelId: porConjunto.funnelId, por: porConjunto };
  const porCampana = camp ? asignadas.find((c) => c.tipo === 'campana' && c.id === camp) : undefined;
  if (porCampana) return { asignada: true, funnelId: porCampana.funnelId, por: porCampana };
  return { asignada: false };
}

/** Las asignaciones de UN embudo, en el orden en que se dibujan: cada campaña y,
 *  debajo, sus conjuntos. Un conjunto cuya campaña no está asignada a este embudo va
 *  suelto, al final — no se puede colgar de una fila que no se dibuja. */
export function asignadasDe(asignadas: CampanaAsignada[], funnelId: number | null): CampanaAsignada[] {
  const mias = asignadas.filter((c) => c.funnelId === funnelId);
  const campanas = mias.filter((c) => c.tipo === 'campana');
  const out: CampanaAsignada[] = [];
  for (const c of campanas) {
    out.push(c);
    out.push(...mias.filter((x) => x.tipo === 'conjunto' && x.campanaId === c.id));
  }
  out.push(...mias.filter((x) => x.tipo === 'conjunto' && !campanas.some((c) => c.id === x.campanaId)));
  return out;
}
