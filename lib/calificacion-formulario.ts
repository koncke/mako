// =============================================================================
// calificacion-formulario — a qué etapa va un lead según lo que CONTESTÓ en un formulario (20/11/2026, puro)
// =============================================================================
// Pedido de Martín (20/11/2026), por lo que necesita Juanfran (Código Inmobiliario, ws 13): «que se pueda asignar los
// "calificados" o "descalificados" y que caigan correspondientemente en su etapa». Juanfran, en su audio: el inmobiliario
// califica a mano y marca casi todo como no calificado —de 20 leads, 13 o 14 en realidad cumplían—; quiere que se ubiquen
// SOLOS con reglas como «si cumple 3 de 4 preguntas → calificado; 2 de 4 → revisión», «hay respuestas que descalifican de una
// (la zona)» y «si tal cosa pasa esto, si tal otra, lo otro».
//
// EL MOLDE ES EL «ROUTING LOGIC» DE CALENDLY (Routing Forms, help.calendly.com «How to create a Routing Form», leído el
// 20/11/2026): una lista de RUTAS en orden; cada una junta condiciones de «pregunta + qualifier + respuesta» y tiene un
// DESTINO; la primera que se cumple gana; y una ruta de RESPALDO («fallback route») para el que no calza en ninguna. Lo único
// que se le suma es el modo «al menos N de estas», que es el «3 de 4» de Juanfran: Calendly junta con «and» / «or», y
// «al menos N» es lo mismo con un número en el medio («todas» = N de N, «alguna» = 1 de N).
//
// El destino es una ETAPA del pipeline (su `key`): calificado → «Lead entrante», descalificado → «Descalificado», y
// cualquier otra que el pipeline tenga («Revisión», si existe). Acá no se lee la base ni se sabe qué etapas hay: eso lo
// valida quien guarda (app/crm/fuentes-actions.ts) y quien mueve (lib/calificacion-aplicar.ts).
// =============================================================================

export type OperadorRegla = 'es' | 'no_es' | 'contiene' | 'no_contiene' | 'mayor' | 'menor' | 'responde' | 'no_responde';
export const OPERADORES: readonly OperadorRegla[] = ['es', 'no_es', 'contiene', 'no_contiene', 'mayor', 'menor', 'responde', 'no_responde'];

/** Cómo se lee cada qualifier en la pantalla y en el historial del lead. */
export const TEXTO_OPERADOR: Readonly<Record<OperadorRegla, string>> = {
  es: 'es', no_es: 'no es', contiene: 'contiene', no_contiene: 'no contiene',
  mayor: 'es mayor que', menor: 'es menor que', responde: 'tiene respuesta', no_responde: 'no tiene respuesta',
};
/** Los que no llevan respuesta al lado («tiene respuesta»). */
export const SIN_VALOR: ReadonlySet<OperadorRegla> = new Set(['responde', 'no_responde']);

export type CondicionRegla = {
  /** La pregunta tal cual la nombra el formulario (Meta: el `name` de `field_data`; la web: el nombre del campo). */
  pregunta: string;
  op: OperadorRegla;
  /** Una o varias respuestas: con «es», alcanza con que la respuesta sea UNA de éstas («Norte o Sur»). */
  valores: string[];
};

export type ModoRuta = 'todas' | 'alguna' | 'al_menos';

export type RutaCalificacion = {
  id: string;
  modo: ModoRuta;
  /** Con `al_menos`: cuántas de las condiciones tienen que cumplirse. Con los otros modos se ignora. */
  minimo: number;
  condiciones: CondicionRegla[];
  /** La `key` de la etapa del pipeline a la que va el lead. */
  etapa: string;
};

export type ReglasFormulario = {
  /** Apagadas, los leads de ese formulario entran a la etapa de entrada como siempre. */
  activa: boolean;
  rutas: RutaCalificacion[];
  /** El respaldo de Calendly: la etapa del que no calza en ninguna ruta. `null` = se queda donde entró. */
  siNinguna: string | null;
};

/** Una respuesta como llega: Meta trae listas (`values: string[]`), la web un texto, un número o un sí/no. */
export type ValorRespuesta = string | number | boolean | null | undefined | ReadonlyArray<string | number | boolean | null | undefined>;
export type Respuestas = Readonly<Record<string, ValorRespuesta>>;

export type ResultadoCalificacion = {
  /** A qué etapa va. `null` = no hay nada que mover (reglas apagadas, o ninguna ruta y sin respaldo). */
  etapa: string | null;
  /** La ruta que ganó (su número es `indice + 1`), o `null` si fue el respaldo o nada. */
  indice: number | null;
  /** Por qué, en una frase para el historial del lead («Cumple 3 de 4: Presupuesto, Plazo y Crédito»). */
  porque: string;
};

// ── Normalizar ────────────────────────────────────────────────────────────────
// Meta nombra las preguntas propias en minúscula y con guiones bajos («¿en_qué_zona_buscas?») y las opciones también
// («más_de_2_millones»); la web las manda como las escribió quien armó el formulario. Se comparan sin tildes, sin signos
// de pregunta, sin mayúsculas y con el guion bajo como espacio: «¿En qué zona buscas?» y «¿en_qué_zona_buscas?» son la
// misma pregunta, y «Más de 2 millones» la misma opción que «más_de_2_millones».

export function normalizar(x: unknown): string {
  return String(x ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .replace(/[¿?¡!.,;:"'«»()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Las respuestas de una pregunta, como textos sin vacíos. */
function valoresDe(v: ValorRespuesta): string[] {
  const lista = Array.isArray(v) ? v : [v];
  return lista
    .map((x) => (typeof x === 'boolean' ? (x ? 'Sí' : 'No') : x == null ? '' : String(x)))
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** La respuesta a una pregunta, buscándola con el nombre normalizado. */
export function respuestaA(respuestas: Respuestas, pregunta: string): string[] {
  const buscada = normalizar(pregunta);
  if (!buscada) return [];
  for (const [k, v] of Object.entries(respuestas)) {
    if (normalizar(k) === buscada) return valoresDe(v);
  }
  return [];
}

/**
 * El primer número de un texto: «$2,500,000» → 2500000, «2.5M» → 2500000, «300 mil» → 300000, «1.200.000» → 1200000.
 * `null` si no hay. Es para «es mayor que» sobre un presupuesto o un plazo escritos a mano.
 */
export function numeroDe(texto: string): number | null {
  // ⚠️ SIN `normalizar`: ésa saca los puntos y las comas, y «$2,500,000» quedaría «2500000»… pero «2.5M» quedaría «25m».
  const t = String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const m = t.match(/(\d[\d.,]*)\s*(k|mil|m|mm|millon|millones)?\b/);
  if (!m) return null;
  let crudo = m[1];
  // Separadores: con dos o más grupos de 3 separados igual es de miles («1.200.000», «2,500,000»); con una sola marca y
  // 1-2 decimales es decimal («2.5», «2,5»); con una sola marca y 3 cifras atrás, de miles («300.000»).
  const marcas = crudo.match(/[.,]/g) ?? [];
  if (marcas.length > 1) {
    const ultima = Math.max(crudo.lastIndexOf('.'), crudo.lastIndexOf(','));
    const cola = crudo.slice(ultima + 1);
    crudo = new Set(marcas).size > 1 && cola.length !== 3
      ? crudo.slice(0, ultima).replace(/[.,]/g, '') + '.' + cola
      : crudo.replace(/[.,]/g, '');
  } else if (marcas.length === 1) {
    const cola = crudo.split(/[.,]/)[1] ?? '';
    crudo = cola.length === 3 ? crudo.replace(/[.,]/, '') : crudo.replace(',', '.');
  }
  let n = Number(crudo);
  if (!Number.isFinite(n)) return null;
  const suf = m[2];
  if (suf === 'k' || suf === 'mil') n *= 1_000;
  else if (suf === 'm' || suf === 'mm' || suf === 'millon' || suf === 'millones') n *= 1_000_000;
  return n;
}

/** ¿Se cumple esta condición con estas respuestas? Una pregunta sin responder sólo cumple «no tiene respuesta». */
export function cumpleCondicion(c: CondicionRegla, respuestas: Respuestas): boolean {
  const dadas = respuestaA(respuestas, c.pregunta);
  if (c.op === 'responde') return dadas.length > 0;
  if (c.op === 'no_responde') return dadas.length === 0;
  // ⚠️ «NO ES» SIN RESPUESTA NO SE CUMPLE: «si la zona no es Norte → Descalificado» no puede descalificar al que no contestó
  // la zona (una pregunta que el formulario no tenía, o un lead viejo). Para eso está «no tiene respuesta», que se elige a
  // propósito.
  if (!dadas.length) return false;
  const buscados = c.valores.map(normalizar).filter(Boolean);
  const dadasN = dadas.map(normalizar);
  switch (c.op) {
    case 'es': return dadasN.some((d) => buscados.includes(d));
    case 'no_es': return buscados.length > 0 && !dadasN.some((d) => buscados.includes(d));
    case 'contiene': return dadasN.some((d) => buscados.some((b) => d.includes(b)));
    case 'no_contiene': return buscados.length > 0 && !dadasN.some((d) => buscados.some((b) => d.includes(b)));
    case 'mayor':
    case 'menor': {
      const limite = c.valores.map(numeroDe).find((x): x is number => x != null);
      if (limite == null) return false;
      return dadas.some((d) => {
        const n = numeroDe(d);
        return n != null && (c.op === 'mayor' ? n > limite : n < limite);
      });
    }
  }
}

/** Cuántas tienen que cumplirse en una ruta: «todas» = N de N, «alguna» = 1 de N, «al menos» = su mínimo entre 1 y N. */
export function minimoDe(r: Pick<RutaCalificacion, 'modo' | 'minimo' | 'condiciones'>): number {
  const n = r.condiciones.length;
  if (r.modo === 'todas') return n;
  if (r.modo === 'alguna') return Math.min(1, n);
  return Math.max(1, Math.min(n, Math.round(Number(r.minimo) || 1)));
}

/**
 * Cómo se LEE una pregunta o una respuesta: sin guiones bajos y con la primera letra en mayúscula. Meta las manda como
 * «¿en_qué_zona_buscas?» y «fuera_de_la_ciudad»; en la pantalla y en el historial van «¿En qué zona buscas?» y «Fuera de la
 * ciudad». Lo que se GUARDA en la condición es el nombre tal cual llegó: comparar es por `normalizar`.
 */
export function legible(x: string): string {
  return String(x ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/\p{L}/u, (c) => c.toUpperCase());
}

/** La pregunta de una condición en una frase: «Zona es Norte o Sur». */
export function textoCondicion(c: CondicionRegla): string {
  const p = legible(c.pregunta);
  if (SIN_VALOR.has(c.op)) return `${p} ${TEXTO_OPERADOR[c.op]}`;
  const vs = c.valores.map(legible).filter(Boolean);
  const lista = vs.length <= 1 ? vs.join('') : `${vs.slice(0, -1).join(', ')} o ${vs[vs.length - 1]}`;
  return `${p} ${TEXTO_OPERADOR[c.op]} ${lista}`;
}

function unir(xs: string[]): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

/**
 * A qué etapa va un lead con estas respuestas. Las rutas se miran EN ORDEN y gana la primera que se cumple (Calendly):
 * por eso las que descalifican de una («la zona») van arriba, antes que el conteo. Una ruta sin condiciones no se cumple
 * nunca (no es un comodín: el comodín es `siNinguna`).
 */
export function calificar(reglas: ReglasFormulario | null | undefined, respuestas: Respuestas): ResultadoCalificacion {
  if (!reglas || !reglas.activa) return { etapa: null, indice: null, porque: 'Sin reglas de calificación' };
  for (let i = 0; i < reglas.rutas.length; i++) {
    const r = reglas.rutas[i];
    if (!r.condiciones.length || !r.etapa) continue;
    const cumplidas = r.condiciones.filter((c) => cumpleCondicion(c, respuestas));
    const minimo = minimoDe(r);
    if (cumplidas.length < minimo) continue;
    const textos = cumplidas.map(textoCondicion);
    const porque = r.condiciones.length === 1
      ? textos[0]
      : r.modo === 'alguna'
        ? unir(textos)
        : `Cumple ${cumplidas.length} de ${r.condiciones.length}: ${unir(textos)}`;
    return { etapa: r.etapa, indice: i, porque };
  }
  return reglas.siNinguna
    ? { etapa: reglas.siNinguna, indice: null, porque: 'No cumplió ninguna regla' }
    : { etapa: null, indice: null, porque: 'No cumplió ninguna regla' };
}

// ── Sanear lo que llega de la pantalla ────────────────────────────────────────

const TOPE_RUTAS = 20;
const TOPE_CONDICIONES = 20;
const TOPE_VALORES = 30;
const corto = (x: unknown, n: number) => String(x ?? '').trim().slice(0, n);

/**
 * Lo que se guarda, saneado: lo que no es una regla válida se descarta en silencio acá y no llega a la base. `etapas` =
 * las keys de las etapas del pipeline: una ruta a una etapa que no existe se cae (no se mueve a nadie a una columna
 * fantasma). Con `null` (al LEER lo guardado, sin el pipeline a mano) vale cualquier key con forma de key: quien mueve
 * vuelve a mirar que la etapa exista. Devuelve `null` si `x` no es un objeto.
 */
export function sanearReglas(x: unknown, etapas: readonly string[] | null): ReglasFormulario | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Partial<ReglasFormulario>;
  const validas = { has: (k: unknown) => typeof k === 'string' && (etapas ? etapas.includes(k) : /^[A-Za-z0-9_:-]{1,80}$/.test(k)) };
  const rutas: RutaCalificacion[] = [];
  for (const r0 of Array.isArray(o.rutas) ? o.rutas.slice(0, TOPE_RUTAS) : []) {
    const r = (r0 ?? {}) as Partial<RutaCalificacion>;
    if (!r.etapa || !validas.has(r.etapa)) continue;
    const etapaRuta: string = r.etapa;
    const condiciones: CondicionRegla[] = [];
    for (const c0 of Array.isArray(r.condiciones) ? r.condiciones.slice(0, TOPE_CONDICIONES) : []) {
      const c = (c0 ?? {}) as Partial<CondicionRegla>;
      const pregunta = corto(c.pregunta, 300);
      const op = OPERADORES.includes(c.op as OperadorRegla) ? (c.op as OperadorRegla) : null;
      if (!pregunta || !op) continue;
      const valores = SIN_VALOR.has(op) ? [] : (Array.isArray(c.valores) ? c.valores : []).map((v) => corto(v, 300)).filter(Boolean).slice(0, TOPE_VALORES);
      if (!SIN_VALOR.has(op) && !valores.length) continue;
      condiciones.push({ pregunta, op, valores });
    }
    if (!condiciones.length) continue;
    const modo: ModoRuta = r.modo === 'alguna' || r.modo === 'al_menos' ? r.modo : 'todas';
    const ruta: RutaCalificacion = { id: corto(r.id, 40) || `r${rutas.length + 1}`, modo, minimo: 1, condiciones, etapa: etapaRuta };
    ruta.minimo = minimoDe({ ...ruta, minimo: Number(r.minimo) || 1 });
    rutas.push(ruta);
  }
  const siNinguna = typeof o.siNinguna === 'string' && validas.has(o.siNinguna) ? o.siNinguna : null;
  return { activa: o.activa !== false && (rutas.length > 0 || siNinguna != null), rutas, siNinguna };
}

// ── Las preguntas de un formulario, sacadas de lo que ya mandaron ─────────────

export type PreguntaVista = {
  /** El nombre como lo manda el formulario (el que se guarda en la condición). */
  pregunta: string;
  /** Cómo se lee: sin guiones bajos. */
  rotulo: string;
  /** Las respuestas que ya llegaron, de la más repetida a la menos (para elegir con un clic). */
  respuestas: Array<{ valor: string; veces: number }>;
};

/** Campos de contacto: no son preguntas para calificar (se ven en la ficha, no en las reglas). */
const CONTACTO = new Set([
  'email', 'correo', 'correo electronico', 'e mail', 'full name', 'nombre', 'nombre completo', 'first name', 'last name',
  'apellido', 'phone number', 'phone', 'telefono', 'whatsapp', 'celular', 'numero de telefono', 'name',
]);

/**
 * Las preguntas que aparecen en los envíos de un formulario, en el orden en que aparecen, con sus respuestas más comunes.
 * Sin los datos de contacto. Es lo que alimenta los desplegables de «pregunta» y «respuesta» del editor.
 */
export function preguntasDeEnvios(envios: ReadonlyArray<Respuestas>, tope = 12): PreguntaVista[] {
  const orden: string[] = [];
  const nombre = new Map<string, string>();
  const cuenta = new Map<string, Map<string, { valor: string; veces: number }>>();
  for (const e of envios) {
    for (const [k, v] of Object.entries(e)) {
      const n = normalizar(k);
      if (!n || CONTACTO.has(n) || /^\d+$/.test(n)) continue;
      if (!nombre.has(n)) { nombre.set(n, k); orden.push(n); cuenta.set(n, new Map()); }
      const m = cuenta.get(n)!;
      for (const val of valoresDe(v)) {
        const vn = normalizar(val);
        if (!vn) continue;
        const prev = m.get(vn);
        if (prev) prev.veces += 1; else m.set(vn, { valor: legible(val), veces: 1 });
      }
    }
  }
  return orden.map((n) => ({
    pregunta: nombre.get(n)!,
    rotulo: legible(nombre.get(n)!),
    respuestas: [...cuenta.get(n)!.values()].sort((a, b) => b.veces - a.veces || a.valor.localeCompare(b.valor, 'es')).slice(0, tope),
  }));
}

/** Cuántos de estos envíos irían a cada etapa con estas reglas (la vista previa del editor y el «REAPLICAR»). */
export function previaDeReglas(reglas: ReglasFormulario, envios: ReadonlyArray<Respuestas>): Map<string | null, number> {
  const out = new Map<string | null, number>();
  for (const e of envios) {
    const { etapa } = calificar(reglas, e);
    out.set(etapa, (out.get(etapa) ?? 0) + 1);
  }
  return out;
}

/**
 * ¿Se puede mover a un lead que HOY está en `actual`? Sólo si está en la etapa de entrada o en una de las que estas reglas
 * reparten (sus destinos y el respaldo). Un lead que alguien ya llevó a «Agenda R1» o a «Ganado» no vuelve atrás porque se
 * reaplicaron las reglas, ni porque llenó otro formulario. Y sí se corrige el que quedó en «Descalificado» a mano y cumplía
 * (de 20 leads, 13 o 14: el caso de Juanfran).
 */
export function puedeMoverDesde(actual: string | null, reglas: ReglasFormulario, entrada: string | null): boolean {
  if (!actual) return true;
  if (actual === entrada) return true;
  return reglas.rutas.some((r) => r.etapa === actual) || reglas.siNinguna === actual;
}

/** Las reglas que trae un formulario recién asignado: ninguna ruta, sin respaldo y apagadas. */
export const REGLAS_VACIAS: ReglasFormulario = { activa: false, rutas: [], siNinguna: null };
