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

// La casa como id real (NULL = el producto del negocio). Es puro y sin `server-only`, igual
// que este módulo: se importa en vez de reescribir la misma traducción por segunda vez.
import { casaReal } from './lead-funnel-reglas';

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
  /**
   * Los OTROS productos donde está, por id real: las filas de `lead_funnel` (mig 0207).
   * La casa NO va acá (nunca hay fila para la casa). No es una columna de `leads`: lo pega
   * quien lo sepa leer (el choque del alta, `choqueDeLead` en app/crm/actions.ts).
   *
   * ⚠️ Ausente es «no sé», y se trata como «sólo su casa»: lo peor que pasa es ofrecer
   * agregarlo a un producto donde ya está, y agregar ahí no escribe nada.
   */
  productos?: number[];
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
 * ¿El lead YA está en el producto que se está mirando? Por su CASA (`funnel_id`) o por una
 * fila de `lead_funnel` (mig 0207). Es la pregunta que decide si el alta ofrece «Agregarlo
 * aquí»: «No se debe "Mover" se debe agregar al otro producto» (Martín, 06/10/2026), así
 * que estar en OTRO producto ya no excluye estar en éste.
 *
 * ⚠️ `null` Y EL ID DEL EMBUDO POR DEFECTO SON EL MISMO LUGAR. Medido contra producción el
 * 30/09/2026: `leads.funnel_id` está en NULL en las 1.530 filas de los 6 workspaces, y el
 * tablero del embudo del negocio los lista justamente con `is('funnel_id', null)`. Comparar
 * los dos números crudos diría «está en otro producto» sobre cada lead del negocio. Y al
 * revés: `moverLeadDeFunnel` escribe el id crudo (incluido el del default), así que sin
 * `defaultId` un lead con el id del negocio escrito, mirado desde el negocio, saldría como
 * «en otro producto». Con `defaultId` los dos lados se traducen con `casaReal`.
 */
export function estaEnProducto(
  lead: Pick<LeadExistente, 'funnel_id' | 'productos'>,
  funnelActual: number | null | undefined,
  defaultId?: number | null,
): boolean {
  const def = defaultId ?? null;
  const casa = casaReal(lead.funnel_id ?? null, def);
  const mirando = casaReal(funnelActual ?? null, def);
  if (casa === mirando) return true;
  // Una fila nombra SIEMPRE un id real: el producto del negocio, cuando no es la casa, va
  // con su id (la FK no admite NULL). Con `mirando` sin resolver (no se supo el default)
  // ninguna fila puede ser «éste».
  return mirando != null && (lead.productos ?? []).some((id) => Number(id) === mirando);
}

/**
 * ¿La coincidencia NO está en el producto que se está mirando? El inverso de
 * `estaEnProducto`, con el nombre que ya tenía. «Está en otro producto» quiere decir «no está
 * en ÉSTE»: puede estar en éste y en otros a la vez, y entonces da `false`.
 */
export function enOtroProducto(c: Coincidencia, funnelActual: number | null | undefined, defaultId?: number | null): boolean {
  return !estaEnProducto(c.lead, funnelActual, defaultId);
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
 * Los candidatos que un patrón de SUFIJO trajo, y cuál de ellos es el mismo teléfono.
 *
 * ⚠️ UN PATRÓN TRAE CANDIDATOS; QUIÉN ES QUIÉN LO DECIDE ESTA COMPARACIÓN. `like
 * '%<últimos 10>'` es flojo a propósito —es lo que hace que `+52 998…` y `998…` sean
 * el mismo número— y por eso mismo puede traer de más: un IGSID de Instagram también
 * termina en diez dígitos. Elegir `[0]` del patrón es escribirle los datos de una
 * persona en la ficha de otra, y de eso no queda rastro.
 *
 * El orden es el de siempre, de más concluyente a menos:
 *
 *   1. **Igualdad exacta del normalizado.** Es lo que hacían las ingestas antes de que
 *      existiera el sufijo, así que acá no se introduce ninguna ambigüedad nueva: si
 *      hay exactos, el sufijo no opina. Con dos exactos gana el más VIEJO (la ficha
 *      original, la que viene trabajando el equipo), que es la decisión que ya estaba
 *      tomada y escrita en `primerLeadPor`.
 *   2. **Un solo candidato por sufijo** → ése. Es el caso que el sufijo viene a ganar.
 *   3. **Varios por sufijo** → se desempata con un DATO: el email del que entra. Si
 *      eso resuelve a uno, es ése.
 *   4. **Sigue habiendo varios** → NO SE ELIGE. Crear una ficha de más es reversible
 *      (alguien las funde desde `duplicadosDeLead`); escribir la agenda, las
 *      respuestas y la atribución de Meta ENCIMA de la persona equivocada no lo es, y
 *      no deja ni una línea en el historial que lo diga.
 *
 * `ambiguos` sale aparte para que el caller pueda dejar el rastro con los ids. El
 * teléfono no va al log: es el de una persona.
 */
export type CandidatoPorTelefono = {
  id: number;
  email?: string | null;
  telefono_normalizado: string | null;
};

export function elegirPorTelefono<T extends CandidatoPorTelefono>(
  candidatos: T[],
  telNorm: string,
  emailDelQueEntra?: string | null,
): { elegido: T | null; ambiguos: number[] } {
  const masViejo = (xs: T[]): T => xs.reduce((a, b) => (b.id < a.id ? b : a));
  const digitos = (v: unknown) => limpio(v).replace(/[^0-9]/g, '');

  const buscado = digitos(telNorm);
  if (!buscado) return { elegido: null, ambiguos: [] };

  const exactos = candidatos.filter((l) => digitos(l.telefono_normalizado) === buscado);
  if (exactos.length) {
    return { elegido: masViejo(exactos), ambiguos: exactos.length > 1 ? exactos.map((l) => l.id) : [] };
  }

  const suf = telefonoComparable(buscado);
  if (!suf) return { elegido: null, ambiguos: [] };
  const porSufijo = candidatos.filter((l) => telefonoComparable(l.telefono_normalizado) === suf);
  if (porSufijo.length === 1) return { elegido: porSufijo[0], ambiguos: [] };
  if (!porSufijo.length) return { elegido: null, ambiguos: [] };

  const email = emailComparable(emailDelQueEntra);
  const porEmail = email ? porSufijo.filter((l) => emailComparable(l.email) === email) : [];
  if (porEmail.length === 1) return { elegido: porEmail[0], ambiguos: [] };
  return { elegido: null, ambiguos: porSufijo.map((l) => l.id) };
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

/**
 * QUÉ CAMPOS SE LE PUEDEN COMPLETAR a un lead que ya existe (#623), y el nombre dice el
 * alcance: **solo los que tiene VACÍOS**.
 *
 * ⚠️ LO CARGADO GANA SOBRE LO IMPORTADO, SIEMPRE, y no es una preferencia de estilo. Lo
 * que está en la ficha lo escribió una persona o lo trajo el proveedor (Calendly, Meta,
 * el inbox de WhatsApp); una lista en frío reimportada es el dato MENOS fresco que entra
 * al CRM. Un campo pisado desde un CSV no da error, no deja rastro en ninguna pantalla,
 * y si el campo era el teléfono, lo que se perdió es la llave con la que ese lead
 * matcheaba su chat.
 *
 * ⚠️ EL TELÉFONO Y SU FORMA NORMALIZADA SON UN SOLO CAMPO PARA ESTA DECISIÓN.
 * `telefono_normalizado` es la llave de match de los webhooks, así que un lead con la
 * llave puesta y el `telefono` vacío NO está vacío: completarlo con otro número lo
 * dejaría con un teléfono a la vista y matcheando por otro. Se exige que los dos estén
 * vacíos.
 *
 * Devuelve la LISTA de lo que llenaría, con su rótulo. Vacía = no hay nada que
 * completar, que es un resultado distinto de «lo completé» y el llamador tiene que
 * poder contarlos aparte.
 */
export type FichaExistente = {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  telefono_normalizado?: string | null;
  empresa?: string | null;
};

export type CampoCompletado = {
  columna: 'nombre' | 'email' | 'telefono' | 'empresa';
  /** Cómo se llama en el historial del lead. */
  label: string;
  valor: string;
};

export function camposParaCompletar(actual: FichaExistente, datos: FichaExistente): CampoCompletado[] {
  const vacio = (v: unknown) => limpio(v) === '';
  const out: CampoCompletado[] = [];
  const completar = (columna: 'nombre' | 'email' | 'empresa', label: string, valor: string) => {
    if (!valor || !vacio(actual[columna])) return;
    out.push({ columna, label, valor });
  };
  completar('nombre', 'Nombre', limpio(datos.nombre));
  // El email se guarda en minúsculas en todo el repo (es la llave de match del webhook
  // de Calendly): completar con la caja del CSV dejaría una fila que no matchea.
  completar('email', 'Email', emailComparable(datos.email) ?? '');
  completar('empresa', 'Empresa', limpio(datos.empresa));
  const tel = limpio(datos.telefono);
  if (tel && vacio(actual.telefono) && vacio(actual.telefono_normalizado)) {
    out.push({ columna: 'telefono', label: 'Teléfono', valor: tel });
  }
  return out;
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
