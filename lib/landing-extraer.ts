// =============================================================================
// landing-extraer — el copy de una página, en el orden en que lo lee un visitante (PURO)
// =============================================================================
// Pedido de Martín (14/10/2026), mirando «Importar con IA» sobre una landing de un cliente:
//   «El mimso error que nos saltaba con Mauricio "No pude leer el texto de esa página".
//    Soluciona eso...»
// Y la decisión del mismo día (docs/relevo/landing-generator.md, «Tanda 6», punto a): el extractor
// lee el texto de div/span/summary/td sin duplicar, `<summary>` y `aria-expanded` como pregunta, y si
// la página se arma en el navegador se ofrece leerla ahí (el lector) o pegar el texto.
//
// Vivía adentro de lib/landing-fetch.ts, que lleva `server-only` y `node:dns` (la baranda SSRF): así
// ningún test podía correr el extractor, y el bug era del EXTRACTOR, no de la red. Acá queda lo que
// se puede probar sin red: de un HTML al copy. landing-fetch.ts baja la página y llama a esto.
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO (medido el 14/10/2026). «No pude leer el texto» sonaba a
//    «la página no se pudo bajar»; se bajaba bien (200, 137 KB). Eran dos cosas distintas:
//    1. el extractor sólo leía h1/h2/h3/p/li/button/a: el texto que vive en un <div> o un <span> (lo
//       que escribe cualquier constructor moderno, y las respuestas de un acordeón armado con divs) no
//       contaba, y una página con texto de sobra daba «bloqueada»;
//    2. la del caso real es una app de Vite/React: el HTML trae `<div id="root"></div>` y scripts, y el
//       texto lo arma el JavaScript. Eso ningún extractor lo arregla: se lee en el navegador de la
//       persona (el lector de la tanda 6) o se pega. Por eso `bloqueada` sigue existiendo, y quien la
//       recibe ofrece las dos salidas en vez de un callejón.
//
// CÓMO LEE (un recorrido de etiquetas con una pila, no un parser de HTML: no hay uno en las
// dependencias). Cada pedazo de texto va a UN solo bloque: el más cercano que lo contiene. Un
// contenedor (div, section…) es un bloque con SU texto propio: cuando adentro abre otro bloque, lo
// que tenía hasta ahí sale antes, y lo que sigue después del hijo es otro pedazo. Así un <div> con un
// <h2> y un <p> adentro da el título y el párrafo, y no los tres textos repetidos (lo que hace un
// regex que agarra el contenedor entero). Lo en línea (span, strong, em…) se suma al bloque que lo
// contiene.
// =============================================================================

/** Un bloque de copy en el orden en que lo lee un visitante. */
export type BloqueLanding = {
  /**
   * h1 | h2 | h3 | texto | cta | lista | pregunta. `pregunta` (tanda 6): el disparador de un
   * desplegable (<summary>, un botón con `aria-expanded`). Antes una pregunta frecuente dentro de un
   * <h3> salía como TÍTULO, y «Conservar» cortaba una sección por cada pregunta.
   */
  tipo: 'h1' | 'h2' | 'h3' | 'texto' | 'cta' | 'lista' | 'pregunta';
  texto: string;
  /**
   * Tanda 6: este texto (o renglón) es la RESPUESTA de la pregunta de un desplegable: vino después de
   * ella y adentro del mismo ítem (el <details>, el ítem del acordeón). `textoDeBloques` la pega a su
   * pregunta (`[DESPLEGABLE] pregunta → respuesta`, la misma marca que el lector del navegador).
   */
  respuesta?: true;
};

export type LandingExtraida = {
  url: string;
  urlFinal: string;
  titulo: string;
  descripcion: string;
  bloques: BloqueLanding[];
  /** El copy plano, listo para el prompt. */
  texto: string;
  palabras: number;
  htmlBytes: number;
  fetchMs: number;
  /** true = hay HTML pero casi nada de texto (SPA que renderiza en el cliente). */
  bloqueada: boolean;
  /**
   * Tanda 6: la página NO se bajó; la leyó el navegador de la persona (el lector del Diagnóstico).
   * Lo que se probó ahí (a dónde lleva cada botón, si el calendario cargó) va al `meta` del análisis.
   */
  leidaEnNavegador?: { interacciones: { tipo: string; texto: string; destino?: string }[] };
};

/**
 * Lo que se guarda en `landing_analyses.bloqueada` (pendiente de las piezas de la tanda 6):
 *   · true  = el server no la lee sola (el copy se pegó a mano, o la bajada dio casi nada);
 *   · false = el server la bajó y la leyó;
 *   · null  = la leyó el NAVEGADOR de la persona: si el server la lee o no, NO lo sabemos (no se bajó).
 * Antes una lectura del navegador guardaba false, que afirma «el server la lee» sin haberlo probado.
 * En la página (`LandingExtraida.bloqueada`) sigue siendo boolean: ahí decide si se frena el análisis,
 * y una lectura del navegador no se frena.
 */
export const bloqueadaParaGuardar = (p: Pick<LandingExtraida, 'bloqueada' | 'leidaEnNavegador'>): boolean | null =>
  p.leidaEnNavegador ? null : p.bloqueada;

/**
 * Debajo de esto asumimos que la página no se renderiza en el server (SPA de
 * Framer/Lovable/React que pinta todo en el cliente): tenemos HTML pero no
 * mensaje, y analizar eso da un diagnóstico inventado.
 */
export const MIN_PALABRAS = 60;

/**
 * Los códigos con los que una página le dice a NUESTRO servidor que no la lea (un antibots, un
 * Cloudflare, un WAF). En el navegador de la persona la misma página abre: es la otra salida.
 */
export const ESTADOS_QUE_BLOQUEAN = [401, 403, 406, 429] as const;

/**
 * La página contestó, pero no a nosotros: un error con el código HTTP, para que quien la pidió sepa
 * que en el navegador de la persona sí se lee (y no le diga «está caída»). Lo tira landing-fetch.ts.
 */
export class ErrorDeLectura extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ErrorDeLectura';
  }
}

/** ¿Este error de bajar la página se resuelve leyéndola en el navegador de la persona? */
export function bloqueaLaLectura(e: unknown): boolean {
  return e instanceof ErrorDeLectura && (ESTADOS_QUE_BLOQUEAN as readonly number[]).includes(e.status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que no es mensaje
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bloques que no son mensaje: se sacan enteros antes de leer nada. Con el texto de los <div> ahora
 * contado, también lo que tiene texto que nadie lee como copy: las <option> de un <select> (doscientos
 * países), el valor de un <textarea>, el «tu navegador no reproduce video» de un <video>.
 */
const RUIDO = /<(script|style|noscript|svg|iframe|template|head|select|datalist|textarea|video|audio|canvas|object|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMENTARIOS = /<!--[\s\S]*?-->/g;

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', laquo: '«', raquo: '»', ldquo: '"', rdquo: '"', lsquo: "'", rsquo: '’', aacute: 'á',
  eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', iexcl: '¡', iquest: '¿',
};

/** Las entidades de HTML a texto. Un código fuera de Unicode no rompe nada: se va. */
export function decodificar(s: string): string {
  const cp = (n: number) => (n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '');
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => cp(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? ENTIDADES[n.toLowerCase()] ?? m);
}

/** Un pedazo de HTML como texto de una línea (sin etiquetas, entidades resueltas, espacios juntos). */
export function limpiar(s: string): string {
  return decodificar(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function meta(html: string, nombre: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${nombre}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0] ?? '';
  return limpiar(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Qué es cada etiqueta
// ─────────────────────────────────────────────────────────────────────────────

const VACIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
/** Bloques de TEXTO: lo que tienen adentro es una unidad de lectura (un link ahí es parte de la frase). */
const TEXTUALES = new Set(['p', 'blockquote', 'figcaption', 'dd', 'dt', 'label', 'td', 'th', 'caption', 'legend', 'pre', 'address']);
/** Contenedores: su texto PROPIO es un bloque (lo de sus hijos bloque va aparte). */
const CONTENEDORES = new Set([
  'div', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside', 'form', 'fieldset', 'details', 'ul', 'ol', 'dl',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'figure', 'body', 'html', 'center', 'menu', 'hgroup', 'dialog', 'search',
]);
/** Lo que cierra un <p> abierto al empezar (la regla del HTML: un <p> no contiene bloques). */
const CIERRAN_P = new Set([...CONTENEDORES, 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'hr', 'address', 'figcaption']);

/** Un <a> solo cuenta como CTA si parece un botón (clase/rol) o es texto corto de acción. */
const RE_CTA_CLASE = /\b(btn|button|cta|action)\b/i;
const RE_CTA_TEXTO = /^(agenda|reserva|solicita|quiero|empez|comenz|descarg|regist|contrat|compr|apl(i|í)ca|hablemos|ver\s|cont(a|á)ct|book|get|start|schedule)/i;

type Tipo = BloqueLanding['tipo'];
/**
 * Un elemento abierto. `bloque` junta su texto propio; `enlace` es un <a> que no está dentro de una
 * frase (decide al cerrar: CTA o navegación, que no es copy); `enlinea` no junta nada (su texto va al
 * bloque de arriba). `enNav`: está adentro de un <nav> (ver `vaciar`).
 */
type Marco = { tag: string; rol: 'bloque' | 'enlace' | 'enlinea'; tipo: Tipo; textual: boolean; partes: string[]; ctaPorClase: boolean; enNav: boolean; item: Item };

/**
 * El ÍTEM de un contenedor (tanda 6): cada contenedor abre uno, encadenado al de su padre, y lo demás
 * usa el de su contenedor. Cuando sale la pregunta de un desplegable, su ítem queda `pregunta: true`, y
 * el texto que sale DESPUÉS adentro de ese ítem (en él o en un contenedor de adentro) es su respuesta.
 * Así el <details>, el acordeón de Radix (botón adentro de un <h3> adentro del ítem) y el armado con
 * divs se leen igual, y lo que viene después del desplegable no se pega como respuesta.
 */
type Item = { pregunta: boolean; padre: Item | null };

/** El valor de un atributo en el texto de una etiqueta de apertura, o null si no está. */
function atributo(attrs: string, nombre: string): string | null {
  const m = new RegExp(`(?:^|\\s)${nombre}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+)))?(?=\\s|/|$)`, 'i').exec(attrs);
  if (!m) return null;
  return decodificar(m[1] ?? m[2] ?? m[3] ?? '');
}

/** Cómo se lee una etiqueta que abre: un bloque de qué tipo, un enlace o algo en línea. */
function rolDe(tag: string, attrs: string): { rol: Marco['rol']; tipo: Tipo; textual: boolean } {
  if (/^h[1-6]$/.test(tag)) return { rol: 'bloque', tipo: (Number(tag[1]) <= 3 ? tag : 'h3') as Tipo, textual: true };
  // Tanda 6: el disparador de un desplegable es una PREGUNTA, no un título ni un botón de acción.
  // <summary> (details nativo), <button aria-expanded> (Radix, Headless UI, shadcn) y lo que se
  // declara botón con `role` (un acordeón armado con divs accesibles).
  if (tag === 'summary') return { rol: 'bloque', tipo: 'pregunta', textual: true };
  const expande = atributo(attrs, 'aria-expanded') !== null;
  if (tag === 'button') return { rol: 'bloque', tipo: expande ? 'pregunta' : 'cta', textual: true };
  const rol = (atributo(attrs, 'role') ?? '').toLowerCase();
  if (expande && rol === 'button' && tag !== 'a') return { rol: 'bloque', tipo: 'pregunta', textual: true };
  if (rol === 'heading' && tag !== 'a') {
    const nivel = Number(atributo(attrs, 'aria-level')) || 2;
    return { rol: 'bloque', tipo: (nivel <= 1 ? 'h1' : nivel === 2 ? 'h2' : 'h3'), textual: true };
  }
  if (tag === 'li') return { rol: 'bloque', tipo: 'lista', textual: true };
  if (TEXTUALES.has(tag)) return { rol: 'bloque', tipo: 'texto', textual: true };
  if (CONTENEDORES.has(tag)) return { rol: 'bloque', tipo: 'texto', textual: false };
  if (tag === 'a') return { rol: 'enlace', tipo: 'cta', textual: true };
  return { rol: 'enlinea', tipo: 'texto', textual: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// El recorrido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una declaración (`<!doctype>`, `<?xml?>`, `<![CDATA[`: se ignora), una etiqueta (apertura o
 * cierre), un `<` suelto, o texto.
 */
const RE_TOKEN = /<[!?][^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|<|[^<]+/g;

/** Un bloque de copy más largo que esto no es copy: es un volcado (un JSON en un div, SEO de relleno). */
const MAX_BLOQUE = 5_000;

/**
 * Los bloques de copy de un HTML (ya sin comentarios ni ruido, o crudo: se limpia igual), en orden y
 * sin repetidos. Ver la cabecera: cada texto va a UN bloque, el más cercano que lo contiene.
 */
export function extraerBloques(htmlCrudo: string): BloqueLanding[] {
  const html = htmlCrudo.replace(COMENTARIOS, ' ').replace(RUIDO, ' ');
  const out: BloqueLanding[] = [];
  const vistos = new Set<string>();
  const raiz: Marco = { tag: '#raiz', rol: 'bloque', tipo: 'texto', textual: false, partes: [], ctaPorClase: false, enNav: false, item: { pregunta: false, padre: null } };
  const pila: Marco[] = [raiz];

  /** ¿Este ítem (o uno que lo contiene) ya mostró la pregunta de un desplegable? Ver `Item`. */
  const trasPregunta = (it: Item | null): boolean => {
    for (let x = it; x; x = x.padre) if (x.pregunta) return true;
    return false;
  };
  /** Saca un bloque (si es copy y no está repetido). `de`: el marco que lo juntó. Devuelve si salió. */
  const emitir = (tipo: Tipo, crudo: string, de?: Marco): boolean => {
    const texto = decodificar(crudo).replace(/\s+/g, ' ').trim();
    if (texto.length < 2 || texto.length > MAX_BLOQUE) return false;
    // Dedup: los menús y footers repiten el mismo texto muchas veces.
    const clave = `${tipo}:${texto.toLowerCase()}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    const respuesta = (tipo === 'texto' || tipo === 'lista') && !!de && trasPregunta(de.item);
    out.push(respuesta ? { tipo, texto, respuesta: true } : { tipo, texto });
    return true;
  };
  /** Saca el texto juntado por un marco (si tiene) como un bloque. Un enlace decide acá si es CTA. */
  const vaciar = (m: Marco) => {
    if (m.rol === 'enlinea' || !m.partes.length) return;
    const crudo = m.partes.join('');
    m.partes = [];
    // Un <nav> es el menú: sus títulos y renglones no son copy (medido el 14/10/2026 en una página de
    // precios: el megamenú sumaba 1.800 palabras de «Platform · Build · Design…» antes del <h1>). Su
    // botón de acción («Agenda una llamada» arriba a la derecha) sí lo es.
    if (m.enNav && m.rol !== 'enlace') return;
    if (m.rol === 'enlace') {
      const t = decodificar(crudo).replace(/\s+/g, ' ').trim();
      // Un link suelto que no parece un botón es navegación o legales: no es copy (como antes).
      if (m.ctaPorClase || (t.length <= 40 && RE_CTA_TEXTO.test(t))) emitir('cta', t);
      return;
    }
    // La pregunta de un desplegable marca su ítem: lo que sale después adentro es su respuesta.
    if (emitir(m.tipo, crudo, m) && m.tipo === 'pregunta') m.item.pregunta = true;
  };
  /** Todo lo pendiente sale en orden de lectura: lo de abajo de la pila se escribió antes. */
  const vaciarTodo = () => { for (const m of pila) vaciar(m); };
  /** El marco que junta el texto que aparece ahora (el primero que no es en línea, desde arriba). */
  const juntador = (): Marco => {
    for (let i = pila.length - 1; i >= 0; i--) if (pila[i].rol !== 'enlinea') return pila[i];
    return raiz;
  };
  const cerrarHasta = (k: number) => {
    // Lo de abajo antes: el texto del marco de afuera es anterior a todo lo que abrió adentro.
    const sacados = pila.splice(k);
    for (const m of sacados) vaciar(m);
  };
  /** El índice del marco abierto `tag` más arriba, sin cruzar ninguno de `frenos`; -1 si no hay. */
  const abierto = (tag: string, frenos: ReadonlySet<string> = new Set()): number => {
    for (let i = pila.length - 1; i > 0; i--) {
      if (pila[i].tag === tag) return i;
      if (frenos.has(pila[i].tag)) return -1;
    }
    return -1;
  };

  let m: RegExpExecArray | null;
  RE_TOKEN.lastIndex = 0;
  while ((m = RE_TOKEN.exec(html)) !== null) {
    const [token, barra, tagCrudo, attrs = ''] = m;
    if (!tagCrudo) {
      if (token.length > 1 && token[0] === '<') continue; // una declaración
      // Texto (o un `<` suelto, que también es texto).
      juntador().partes.push(token);
      continue;
    }
    const tag = tagCrudo.toLowerCase();
    // Un borde de etiqueta separa palabras: <span>Precio</span><span>$99</span> se lee «Precio $99».
    juntador().partes.push(' ');

    if (barra) {
      const k = abierto(tag);
      if (k > 0) cerrarHasta(k);
      continue;
    }

    if (VACIOS.has(tag)) {
      // Un <input type="submit" value="Enviar"> es un botón de acción como cualquier otro.
      if (tag === 'input' && /^(submit|button)$/i.test(atributo(attrs, 'type') ?? '')) {
        const valor = atributo(attrs, 'value');
        if (valor) { vaciarTodo(); emitir('cta', valor); }
      }
      continue;
    }

    // Los cierres implícitos del HTML: un <li> cierra el <li> hermano, un <td> el <td>, un bloque el <p>.
    if (CIERRAN_P.has(tag)) {
      const k = pila.length - 1;
      let j = k;
      while (j > 0 && pila[j].rol === 'enlinea') j--;
      if (j > 0 && pila[j].tag === 'p') cerrarHasta(j);
    }
    if (tag === 'li') { const k = abierto('li', new Set(['ul', 'ol', 'menu'])); if (k > 0) cerrarHasta(k); }
    if (tag === 'dt' || tag === 'dd') { const k = Math.max(abierto('dt', new Set(['dl'])), abierto('dd', new Set(['dl']))); if (k > 0) cerrarHasta(k); }
    if (tag === 'td' || tag === 'th') { const k = Math.max(abierto('td', new Set(['tr', 'table'])), abierto('th', new Set(['tr', 'table']))); if (k > 0) cerrarHasta(k); }
    if (tag === 'tr') { const k = abierto('tr', new Set(['table', 'tbody', 'thead', 'tfoot'])); if (k > 0) cerrarHasta(k); }

    const autocierre = /\/\s*$/.test(attrs);
    const r = rolDe(tag, attrs);
    if (r.rol === 'bloque') {
      vaciarTodo();
      const enNav = juntador().enNav || pila[pila.length - 1].enNav || tag === 'nav' || (atributo(attrs, 'role') ?? '').toLowerCase() === 'navigation';
      // Un contenedor abre su ítem; un bloque de texto (un título, la pregunta, un párrafo) usa el de arriba.
      const deArriba = pila[pila.length - 1].item;
      const item = r.textual ? deArriba : { pregunta: false, padre: deArriba };
      if (!autocierre) pila.push({ tag, rol: 'bloque', tipo: r.tipo, textual: r.textual, partes: [], ctaPorClase: false, enNav, item });
      continue;
    }
    if (r.rol === 'enlace') {
      const ctaPorClase = RE_CTA_CLASE.test(atributo(attrs, 'class') ?? '') || (atributo(attrs, 'role') ?? '').toLowerCase() === 'button';
      const arriba = juntador();
      // Un link DENTRO de una frase (un <p>, un <li>, o un contenedor que ya venía con texto) es parte
      // de la frase. Suelto, es navegación o un botón: decide al cerrar.
      const enFrase = !ctaPorClase && (arriba.textual || arriba.partes.join('').trim() !== '');
      if (!autocierre) pila.push({ tag, rol: enFrase ? 'enlinea' : 'enlace', tipo: 'cta', textual: true, partes: [], ctaPorClase, enNav: pila[pila.length - 1].enNav, item: pila[pila.length - 1].item });
      continue;
    }
    if (!autocierre) pila.push({ tag, rol: 'enlinea', tipo: 'texto', textual: false, partes: [], ctaPorClase: false, enNav: pila[pila.length - 1].enNav, item: pila[pila.length - 1].item });
  }
  cerrarHasta(0);
  return out;
}

/**
 * El copy plano, en el formato que leen el análisis y el esquema (`# título`, `[BOTÓN]`, `•`,
 * `[DESPLEGABLE]`), un bloque por renglón.
 *
 * Tanda 6 (pendiente de las piezas del server): un desplegable se escribe con LA MISMA marca que el
 * lector del navegador (lector.ts, `armarTextoLectura`): `[DESPLEGABLE] pregunta → respuesta` cuando
 * la respuesta vino en el HTML (un <details>, un acordeón montado), y `[DESPLEGABLE] pregunta` cuando
 * no. Antes eran dos formatos para lo mismo —`[PREGUNTA] x` con la respuesta suelta en el renglón de
 * abajo—, y el modelo leía distinto la misma página según quién la hubiera leído.
 */
export function textoDeBloques(bloques: readonly BloqueLanding[]): string {
  const renglones: string[] = [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    if (b.tipo === 'pregunta') {
      // La respuesta: los bloques marcados que vienen pegados (una de varios párrafos va entera).
      const respuesta: string[] = [];
      while (bloques[i + 1]?.respuesta) respuesta.push(bloques[++i].texto);
      renglones.push(`[DESPLEGABLE] ${b.texto}${respuesta.length ? ` → ${respuesta.join(' ')}` : ''}`);
      continue;
    }
    renglones.push(b.tipo === 'cta' ? `[BOTÓN] ${b.texto}`
      : b.tipo === 'lista' ? `• ${b.texto}`
        : b.tipo.startsWith('h') ? `${'#'.repeat(Number(b.tipo[1]))} ${b.texto}` : b.texto);
  }
  return renglones.join('\n');
}

export const contarPalabras = (t: string): number => t.split(/\s+/).filter(Boolean).length;

export type CopyDeHtml = Pick<LandingExtraida, 'titulo' | 'descripcion' | 'bloques' | 'texto' | 'palabras' | 'bloqueada'>;

/** Del HTML de una página a su copy: título, descripción, bloques, el texto plano y si «se arma en el navegador». */
export function copyDeHtml(html: string): CopyDeHtml {
  // OJO: el <title> se busca en el HTML ORIGINAL. RUIDO elimina el <head> entero (ahí viven scripts y
  // estilos), y con él se llevaba puesto el título — medido: example.com devolvía titulo:''.
  const titulo = limpiar(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || meta(html, 'og:title');
  const descripcion = meta(html, 'description') || meta(html, 'og:description');
  const bloques = extraerBloques(html);
  const texto = textoDeBloques(bloques);
  const palabras = contarPalabras(texto);
  return { titulo, descripcion, bloques, texto, palabras, bloqueada: palabras < MIN_PALABRAS };
}
