// =============================================================================
// leads-duplicados — «esto ya lo tenés» antes de crear el lead
// =============================================================================
// El pedido, textual: «siempre se tiene que comparar por nombre, email, teléfono
// o algún dato que sea coincidente y avisar al usuario que es duplicado. Si el
// usuario lo quiere duplicar bueno, que lo pueda hacer, pero no cargarlo
// automáticamente. Y tampoco rechazarlo sin avisar.»
//
// Eso son TRES reglas y el repo no cumplía ninguna de forma pareja. Medido:
//
//   · `createLead()` no chequeaba NADA. El alta manual de /crm/new y el alta
//     desde una conversación de WhatsApp insertaban a ciegas.
//   · Los webhooks de Meta y Calendly sí matchean, pero en SILENCIO: en vez de
//     avisar hacen merge. Nadie se entera de que dos se juntaron.
//   · El importador avisa, y funciona al REVÉS de lo pedido: descarta la fila
//     marcada como duplicada AUNQUE la persona la tilde. Hoy es imposible
//     duplicar a propósito.
//   · Y NADIE, en ningún camino, compara por NOMBRE.
//
// Por eso la decisión vive acá, en un módulo sin `server-only`: lo que se puede
// equivocar es la COMPARACIÓN (dos teléfonos escritos distinto, un nombre con
// acentos, un apodo) y tiene que poder testearse sin base de datos.
// =============================================================================

/** Los datos que alcanzan para preguntar «¿este ya está?». */
export type CandidatoLead = {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  /** Ya normalizado por `normalizarTelefono`, si el caller lo tiene. */
  telefonoNormalizado?: string | null;
};

/** Un lead que ya existe, en lo mínimo que hace falta para comparar. */
export type LeadExistente = {
  id: number;
  nombre: string | null;
  email: string | null;
  telefono_normalizado: string | null;
  /**
   * EN QUÉ PRODUCTO está. `null` = en el del negocio.
   *
   * ⚠️ VIAJA PARA QUE EL AVISO PUEDA NOMBRARLO: «ya lo tienes» y «ya lo tienes EN OTRO
   * PRODUCTO» son dos hechos distintos y llevan a dos decisiones distintas. Sin esto, a
   * quien carga un lead en su segundo embudo se le dice que está duplicado sobre una
   * pantalla donde no lo ve, que se lee como que la app se equivoca.
   *
   * ⚠️ Y ES OPCIONAL a propósito: los tres lectores de este módulo que comparan en
   * memoria (el importador, los webhooks) no traen la columna, y exigirla los rompería
   * sin que el aviso mejore para ellos.
   */
  funnel_id?: number | null;
};

/**
 * Por qué dos leads parecen el mismo. El orden es de MÁS a MENOS concluyente, y
 * no es decorativo: gobierna qué se hace con el hallazgo.
 */
export type MotivoDuplicado = 'email' | 'telefono' | 'nombre';

export type Coincidencia = {
  lead: LeadExistente;
  motivo: MotivoDuplicado;
  /** Cómo decírselo a una persona, sin jerga. */
  texto: string;
};

/**
 * ¿La coincidencia está en OTRO producto que el que se está mirando?
 *
 * ⚠️ `null` Y EL ID DEL EMBUDO POR DEFECTO SON EL MISMO LUGAR. Medido contra producción el
 * 30/09/2026: `leads.funnel_id` está en NULL en las 1.530 filas de los 6 workspaces, y el
 * tablero del embudo del negocio los lista justamente con `is('funnel_id', null)`. Comparar
 * los dos números crudos diría «está en otro producto» sobre cada lead del negocio.
 */
export function enOtroProducto(c: Coincidencia, funnelActual: number | null | undefined): boolean {
  const suyo = c.lead.funnel_id ?? null;
  const mirando = funnelActual ?? null;
  return suyo !== mirando;
}

const limpio = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');

/** Email comparable: minúsculas y sin espacios. No se toca el `+alias`, que
 *  para Gmail es la misma casilla pero para otros proveedores NO lo es. */
export function emailComparable(v: unknown): string | null {
  const s = limpio(v).toLowerCase();
  return s.includes('@') ? s : null;
}

/** Teléfono comparable: los dígitos, y los ÚLTIMOS 10.
 *
 *  El mismo número con y sin código de país es el mismo número, y es la forma
 *  más común de que un duplicado se cuele: uno lo carga desde WhatsApp con
 *  `+52 998…` y el otro lo tipea `998…`. Diez dígitos alcanza para no chocar
 *  entre personas distintas y sobra para reconocer a la misma. */
export function telefonoComparable(v: unknown): string | null {
  const d = limpio(v).replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-10) : null;
}

/**
 * Nombre comparable: minúsculas, sin acentos, sin puntuación y con las palabras
 * ORDENADAS.
 *
 * El orden es lo que hace que «Hurtado Gabriela» y «Gabriela Hurtado» sean la
 * misma persona — que es como llega el mismo contacto desde un formulario y
 * desde una agenda. Se descartan las partículas («de», «del», «la») porque
 * aparecen y desaparecen según quién lo escriba.
 */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'van', 'von']);
export function nombreComparable(v: unknown): string | null {
  const s = limpio(v)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  const partes = s.split(' ').filter((p) => p.length > 1 && !PARTICULAS.has(p));
  if (!partes.length) return null;
  return partes.sort().join(' ');
}

/**
 * Un patrón `ilike` por palabra de un nombre YA comparable (`nombreComparable`:
 * minúsculas, sin acentos, sin puntuación). Cada lead que `buscarDuplicados`
 * daría por igual contiene todas esas palabras, pero con los acentos que tenga
 * guardados: por eso las vocales, la `n` y la `c` van como `_` (un carácter
 * cualquiera), así «sofia» también encuentra «Sofía» y «nunez» a «Núñez». Trae
 * de más a propósito; la comparación exacta sigue siendo la de JS.
 */
export function patronesDeNombre(nombre: string): string[] {
  return nombre.split(' ').filter(Boolean)
    .map((p) => p.replace(/[aeiounc]/g, '_'))
    // Solo las palabras que FILTRAN. Con las vocales, la `n` y la `c` como comodín,
    // una palabra corta se vuelve todo comodín: «ana» → `___`, que coincide con
    // cualquier nombre de tres letras o más (1.107 de 1.108 leads en ws1). Esa
    // palabra no descarta a nadie; mandarla solo agrega una condición que no sirve.
    // Dos letras fijas es el mínimo para que el patrón deje afuera a alguien.
    .filter((p) => p.replace(/_/g, '').length >= 2)
    .map((p) => `%${p}%`);
}

/**
 * Los leads que parecen el mismo que el candidato.
 *
 * ⚠️ Devuelve TODAS las coincidencias, no la primera. Con dos parecidos, decir
 * «hay uno» y mostrar uno hace que la persona confirme creyendo que revisó todo.
 *
 * ⚠️ Y el NOMBRE solo cuenta cuando el candidato no trae ni email ni teléfono
 * comparables. Dos «Juan Pérez» son dos personas distintas mucho más seguido que
 * dos veces el mismo teléfono; si hay un dato fuerte, ese manda y el nombre no
 * agrega nada más que falsos positivos. Sin ningún dato fuerte, el nombre es lo
 * único que hay — y avisar de más es barato, porque acá nada se descarta solo.
 */
export function buscarDuplicados(cand: CandidatoLead, existentes: LeadExistente[]): Coincidencia[] {
  const email = emailComparable(cand.email);
  const tel = telefonoComparable(cand.telefonoNormalizado ?? cand.telefono);
  const nombre = nombreComparable(cand.nombre);
  const out: Coincidencia[] = [];
  const yaEsta = (id: number) => out.some((c) => c.lead.id === id);

  for (const l of existentes) {
    if (email && emailComparable(l.email) === email) {
      out.push({ lead: l, motivo: 'email', texto: `mismo email (${email})` });
    }
  }
  for (const l of existentes) {
    if (yaEsta(l.id)) continue;
    if (tel && telefonoComparable(l.telefono_normalizado) === tel) {
      out.push({ lead: l, motivo: 'telefono', texto: `mismo teléfono (${cand.telefono?.trim() || tel})` });
    }
  }
  // El nombre, solo si no hubo con qué comparar mejor.
  if (!email && !tel && nombre) {
    for (const l of existentes) {
      if (yaEsta(l.id)) continue;
      if (nombreComparable(l.nombre) === nombre) {
        out.push({ lead: l, motivo: 'nombre', texto: `mismo nombre (${limpio(l.nombre)})` });
      }
    }
  }
  return out;
}

/**
 * El aviso, en una frase. Lo escribe el CÓDIGO y no un modelo: acá viajan un
 * nombre y un teléfono exactos, y un dato exacto que pasa por un LLM deja de
 * serlo.
 */
export function textoDuplicado(cs: Coincidencia[], producto?: string | null): string {
  if (!cs.length) return '';
  const c = cs[0];
  const quien = limpio(c.lead.nombre) || 'un contacto sin nombre';
  const resto = cs.length > 1 ? ` (y ${cs.length - 1} más)` : '';
  // ⚠️ El producto entra sólo si el que llama lo supo resolver. Un «en» colgando de la
  // nada es peor que no decirlo, y el techo de un aviso es una frase.
  const donde = producto ? ` en ${producto}` : '';
  return `Ya tienes a «${quien}»${resto}${donde} con el ${c.texto.replace(/^mismo /, '')}.`;
}

/** El error que frena el alta cuando hay un duplicado y nadie lo autorizó.
 *
 *  Es una CLASE y no un string suelto para que quien lo agarra pueda mostrar las
 *  coincidencias en vez de un mensaje pelado: sin los ids, la pantalla no puede
 *  ofrecer «abrí el que ya tenés», que es lo primero que uno quiere hacer. */
export class LeadDuplicadoError extends Error {
  readonly coincidencias: Coincidencia[];
  constructor(coincidencias: Coincidencia[], producto?: string | null) {
    super(textoDuplicado(coincidencias, producto));
    this.name = 'LeadDuplicadoError';
    this.coincidencias = coincidencias;
  }
}

export function esLeadDuplicado(e: unknown): e is LeadDuplicadoError {
  return e instanceof LeadDuplicadoError;
}
