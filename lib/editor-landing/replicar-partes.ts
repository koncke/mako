// =============================================================================
// editor-landing/replicar-partes — QUÉ se replica de una landing de afuera: diseño, estructura, ángulos y texto
// =============================================================================
// Pedido de Martín (28/10/2026), textual: «es muy importante que al momento de replicar una landing se defina qué se
// quiere replicar, porque en mi caso, por ejemplo, yo tengo definido un estilo de diseño de landing y las quiero más o
// menos seguir. Pero sin embargo, lo que sí quiero replicar son los ángulos de comunicación, los dolores, la forma de
// venta, la cantidad de párrafos, los títulos, cómo está acomodado, etcétera. Entonces, una cosa es replicar el
// branding, otra cosa es replicar la estructura, otra cosa es replicar los ángulos de comunicación, los copies».
//
// Cuatro PARTES que se combinan (lo puro, con test: tests/web-generator-replicar-partes.test.ts):
//   · diseno      — sus colores, sus fuentes, sus imágenes y sus animaciones (un tema propio «Estilo de <sitio>»).
//                   Sin él, la réplica nace con el tema que elige la persona (el suyo);
//   · estructura  — sus secciones en su orden, con la misma cantidad de títulos, párrafos, viñetas y botones;
//   · angulos     — cómo vende: la promesa, los dolores, la forma de venta, las objeciones y la prueba de cada sección;
//   · texto       — lo que dice, palabra por palabra. Trae la estructura y los ángulos adentro (`alternarParte`).
// El caso de Martín (el default, `PARTES_INICIALES`): estructura + ángulos, con SU diseño y el texto escrito de nuevo
// para SU oferta. «Replicar y adaptar» (27/10, Leila) es diseño + estructura + ángulos; «tal cual», las cuatro.
//
// Cómo arma cada combinación (`recetaDePartes`; lo que baja, llama a la IA y crea vive en replicar.ts):
//   · con estructura: el esquema es el de la página (`esquemaDeReplica`, «Conservar»: sus secciones, en su orden);
//     sin el texto, la tanda de secciones lo escribe de nuevo (`generar`) con el MOLDE de cada sección y los ángulos;
//   · sin estructura: el esquema lo arma la IA para la oferta del negocio (`generar`), con los ángulos si se pidieron;
//   · con texto: «Conservar» en las dos tandas (la copia de siempre).
// =============================================================================

import type { ParamsGeneracion } from './api-tipos';
import type { JsonNodo } from './doc';
import type { FormatoReplicar } from './replicar-reglas';

export const PARTES_REPLICA = ['diseno', 'estructura', 'angulos', 'texto'] as const;
export type ParteReplica = (typeof PARTES_REPLICA)[number];
export type PartesReplica = Readonly<Record<ParteReplica, boolean>>;

/** Lo que dice la pantalla de cada parte: el nombre del botón y la línea de abajo (corta). */
export const NOMBRE_PARTE: Record<ParteReplica, { nombre: string; detalle: string; icono: string }> = {
  diseno: { nombre: 'Diseño', detalle: 'Colores, fuentes e imágenes', icono: 'paleta' },
  estructura: { nombre: 'Estructura', detalle: 'Secciones, títulos y párrafos', icono: 'paginas' },
  angulos: { nombre: 'Ángulos', detalle: 'Dolores, promesa y forma de venta', icono: 'objetivo' },
  texto: { nombre: 'Texto literal', detalle: 'Lo que dice, palabra por palabra', icono: 'copiar' },
};

/** El caso de Martín: la estructura y los ángulos de la otra, con el diseño propio y el texto de la oferta propia. */
export const PARTES_INICIALES: PartesReplica = { diseno: false, estructura: true, angulos: true, texto: false };
/** La copia de siempre («Replica esta landing» antes del 28/10, la API sin `partes`): todo. */
export const PARTES_TODAS: PartesReplica = { diseno: true, estructura: true, angulos: true, texto: true };
/** «Replicar y adaptar» (27/10/2026): el diseño y la estructura de afuera, con el texto de la oferta del negocio. */
export const PARTES_ADAPTAR: PartesReplica = { diseno: true, estructura: true, angulos: true, texto: false };

/**
 * Prender o apagar una parte, con sus dependencias: el TEXTO literal trae la estructura y los ángulos adentro (copiar
 * las palabras es copiar cómo vende y cómo está armado), así que prenderlo los prende y apagar cualquiera de los dos lo
 * apaga. Nunca deja las cuatro apagadas: apagar la última no hace nada.
 */
export function alternarParte(p: PartesReplica, parte: ParteReplica): PartesReplica {
  const prendida = !p[parte];
  let sig: Record<ParteReplica, boolean> = { ...p, [parte]: prendida };
  if (parte === 'texto' && prendida) sig = { ...sig, estructura: true, angulos: true };
  if ((parte === 'estructura' || parte === 'angulos') && !prendida) sig.texto = false;
  return algunaParte(sig) ? sig : p;
}

export const algunaParte = (p: PartesReplica): boolean => PARTES_REPLICA.some((k) => p[k]);
export const mismasPartes = (a: PartesReplica, b: PartesReplica): boolean => PARTES_REPLICA.every((k) => a[k] === b[k]);

/**
 * Las partes de un pedido, sin forma confiable. Un pedido SIN `partes` (la pantalla de antes del 28/10, el Diagnóstico,
 * la API de MaKo vieja) es lo de siempre: `adaptar` → diseño + estructura + ángulos; si no, las cuatro. Las
 * dependencias se aplican igual (texto sin estructura no existe). null si vino `partes` y no dice ninguna.
 */
export function partesDePedido(raw: unknown, adaptar = false): PartesReplica | null {
  if (raw === undefined || raw === null) return adaptar ? PARTES_ADAPTAR : PARTES_TODAS;
  let lista: unknown[] | null = null;
  if (Array.isArray(raw)) lista = raw;
  else if (typeof raw === 'object') lista = PARTES_REPLICA.filter((k) => (raw as Record<string, unknown>)[k] === true);
  else if (typeof raw === 'string') lista = raw.split(/[\s,]+/);
  if (!lista) return null;
  const si = new Set(lista.map((x) => String(x).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')));
  const p: Record<ParteReplica, boolean> = { diseno: si.has('diseno'), estructura: si.has('estructura'), angulos: si.has('angulos'), texto: si.has('texto') };
  if (p.texto) { p.estructura = true; p.angulos = true; }
  return algunaParte(p) ? p : null;
}

export const listaDePartes = (p: PartesReplica): ParteReplica[] => PARTES_REPLICA.filter((k) => p[k]);

/**
 * ¿Se puede este formato con estas partes? La «Página web» (la copia idéntica, el HTML de la original) es TODO: su
 * diseño, su estructura y su texto. Con cualquier parte apagada va «Landing» o «Presentación».
 */
export const formatoConPartes = (f: FormatoReplicar, p: PartesReplica): boolean => f !== 'web' || (p.diseno && p.estructura && p.texto);
/** El error de pedir la copia idéntica con algo apagado (la pantalla ofrece «Landing» con `probar`). */
export const ERROR_WEB_PARCIAL = 'La copia idéntica copia todo: para elegir qué replicar, usa «Landing».';

/**
 * El nombre de la copia en el Panel: con el texto, el título de la original (es la misma página); sin él ya no es la
 * de la original y no lleva su nombre («Adaptada de 100ads.ai» desde el 27/10, «Basada en …» desde el 28/10).
 */
export function nombreDeCopia(p: PartesReplica, host: string, tituloOriginal: string): string {
  if (p.texto) return tituloOriginal;
  return p.diseno && p.estructura ? `Adaptada de ${host}` : `Basada en ${host}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que lee la IA
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que nunca pasa de la referencia a la copia cuando el texto se escribe de nuevo (la regla de «adaptar»). */
const NADA_PROPIO = 'De la referencia no pasa nada propio: ni su marca, ni sus nombres, ni sus testimonios, ni sus cifras, ni sus precios, ni sus garantías. Si a una sección le falta un dato que el negocio no dio, escribe entre corchetes qué falta: "[testimonio real de un cliente]".';

/** Lo que se acepta de «Tu oferta» (lo escribe la persona en el panel; va primero en la instrucción). */
export const TOPE_OFERTA = 1_200;

/**
 * El nombre de la marca de una página por su dirección: el primer nombre del host sin `www.` ni los prefijos de
 * producto (`try`, `get`, `use`, `join`, `go`): «tryholo.ai» → «Holo», «reportei.com» → «Reportei». null si no sale uno
 * de 3 letras o más. Para decirle a la IA qué no nombrar y para contar si igual quedó.
 */
export function marcaDeUrl(url: string): string | null {
  let host = '';
  // ⚠️ El nombre del DOMINIO, no el del primer subdominio (12/11/2026): las landings de los gurús viven en
  // `clase.highticketclarity.com`, `lp.acquisition.com`, `programa.formacionmomentum.com`, y la «marca» que la IA no debía
  // nombrar salía «Clase», «Programa» o ninguna («lp»): la réplica adaptada siguió diciendo «High Ticket Clarity».
  try { host = new URL(url).hostname; } catch { return null; }
  const nombre = (dominioBase(host).split('.')[0] ?? '').replace(/^(?:try|get|use|join|go)(?=[a-z]{3,})/, '');
  return nombre.length >= 3 ? nombre.charAt(0).toUpperCase() + nombre.slice(1) : null;
}

/** Cuántas veces nombra `texto` a la marca (sin mayúsculas ni acentos; «Master Ads» cuenta para «Masterads»). */
export function mencionesDe(texto: string, marca: string | null): number {
  if (!marca) return 0;
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const m = norm(marca).replace(/[^a-z0-9]/g, '');
  if (m.length < 3) return 0;
  const palabras = norm(texto).split(/[^a-z0-9]+/).filter(Boolean);
  let n = 0;
  for (let i = 0; i < palabras.length; i++) {
    if (palabras[i] === m || palabras[i].startsWith(m)) { n++; continue; }
    if (i + 1 < palabras.length && palabras[i] + palabras[i + 1] === m) { n++; i++; continue; }
    // En tres palabras: «High Ticket Clarity» es «Highticketclarity» (12/11/2026).
    if (i + 2 < palabras.length && palabras[i] + palabras[i + 1] + palabras[i + 2] === m) { n++; i += 2; }
  }
  return n;
}

/**
 * Los NOMBRES PROPIOS de la referencia, además de su marca (12/11/2026, la réplica adaptada de la masterclass de Clara Pérez
 * en el ws9, CON la oferta de MaKo escrita: el hero habló de MaKo y el resto siguió con «Quién es Clara Pérez», sus alumnas
 * y @soyclaraperez). La regla general («ni sus nombres») no alcanzó: la IA necesita la LISTA. De lo que se lee de la página:
 *   · el autor: «Quién es / Quién soy / Me llamo / Conoce a / Sobre / Who is / Meet / About» + Nombre Apellido;
 *   · el que la da: «con Nombre Apellido» (una clase «con Clara Pérez»);
 *   · las cuentas: @usuario (3 a 30 letras, números, punto o guion bajo).
 * Sin repetidos, en el orden en que aparecen, hasta `max`. Puro.
 */
export function nombresDeLaReferencia(textos: readonly string[], max = 12): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  const sumar = (s: string) => {
    const limpio = s.replace(/\s+/g, ' ').trim();
    const clave = limpio.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (limpio.length < 3 || vistos.has(clave) || out.length >= max) return;
    vistos.add(clave);
    out.push(limpio);
  };
  const MAY = '[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+';
  // SIN la `i`: el nombre tiene que ir con mayúscula («con un sistema de contenido» no es nadie); la palabra de antes, en las dos.
  const persona = new RegExp(`(?:^|[^\\p{L}])(?:[Qq]ui[eé]n es|[Qq]ui[eé]n soy|[Mm]e llamo|[Cc]onoc[eé] a|[Ss]obre|[Ww]ho is|[Mm]eet|[Aa]bout|[Cc]on)\\s+(${MAY}(?:\\s+${MAY}){1,2})(?![\\p{L}])`, 'gu');
  for (const t of textos) {
    const s = String(t ?? '');
    for (const m of s.matchAll(persona)) sumar(m[1]);
    for (const m of s.matchAll(/(?:^|[\s(«"'·,])(@[a-z0-9._]{3,30})/gi)) sumar(m[1].replace(/[._]+$/, ''));
  }
  return out;
}

/**
 * El dominio de una dirección sin sus subdominios: «app.competidor.com» → «competidor.com», «www.tienda.com.ar» →
 * «tienda.com.ar» (los de país con «com», «co», «org»… adelante se quedan con tres partes). Sin dirección válida, ''.
 */
export function dominioBase(urlOHost: string): string {
  let host = '';
  try { host = new URL(/^https?:\/\//i.test(urlOHost) ? urlOHost : `https://${urlOHost}`).hostname.toLowerCase(); } catch { return ''; }
  const p = host.split('.').filter(Boolean);
  if (p.length <= 2) return p.join('.');
  const dePais = p[p.length - 1].length === 2 && /^(com|co|org|net|gob|gov|edu|ac)$/.test(p[p.length - 2]);
  return p.slice(dePais ? -3 : -2).join('.');
}

/** Lo que identifica un enlace: el host sin «www.» y el camino sin la barra final; la consulta y el ancla no cuentan. */
function direccionDeEnlace(href: string): string {
  try {
    const u = new URL(href);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
  } catch { return ''; }
}

/**
 * Las direcciones que aparecen en el texto de la ORIGINAL: el destino de sus botones, su agenda («[CALENDARIO] Calendly
 * (https://calendly.com/…)»), su WhatsApp. Un enlace de la copia que está acá es de la competencia aunque no sea de su
 * dominio: el dominio sólo caza su página («app.competidor.com/signup»), no su Calendly ni su «wa.me/549…».
 */
export function enlacesDeLaOriginal(texto: string): Set<string> {
  const out = new Set<string>();
  for (const m of String(texto ?? '').matchAll(/https?:\/\/[^\s()«»"'<>]+/gi)) {
    const d = direccionDeEnlace(m[0].replace(/[.,;:!?]+$/, ''));
    if (d) out.add(d);
  }
  return out;
}

/** Si `href` es una de `destinos`, o una dentro de la otra con camino («calendly.com/x» y «calendly.com/x/30min»). */
function esDestinoDe(href: string, destinos: ReadonlySet<string>): boolean {
  const d = direccionDeEnlace(href);
  if (!d || !destinos.size) return false;
  if (destinos.has(d)) return true;
  for (const o of destinos) {
    const [corto, largo] = o.length <= d.length ? [o, d] : [d, o];
    // Un host pelado («calendly.com») no es de nadie: sin camino, no alcanza para decir que es de la original.
    if (corto.includes('/') && largo.startsWith(`${corto}/`)) return true;
  }
  return false;
}

/**
 * Los enlaces que llevan a la ORIGINAL, en una copia escrita para el negocio: pasan a «#» (revisión del 28/10/2026:
 * publicada, la landing le mandaba los leads a la competencia, y el destino no se ve en el texto del editor). Son los de
 * su dominio, con cualquier subdominio (la landing en «competidor.com» y el botón a «app.competidor.com/signup»), y los
 * que aparecen en su texto (`destinos`, de `enlacesDeLaOriginal`: su Calendly, su WhatsApp). Los botones (`href`) y los
 * enlaces de un texto (la marca `link`). `cambiados`: cuántos, para el aviso. Puro: no muta.
 */
export function sinEnlacesALaOriginal(t: JsonNodo, urlOriginal: string, destinos: ReadonlySet<string> = new Set()): { tarjeta: JsonNodo; cambiados: number } {
  const base = dominioBase(urlOriginal);
  if (!base && !destinos.size) return { tarjeta: t, cambiados: 0 };
  let cambiados = 0;
  const ajeno = (href: unknown): boolean => typeof href === 'string' && /^https?:\/\//i.test(href)
    && ((!!base && dominioBase(href) === base) || esDestinoDe(href, destinos));
  const caminar = (n: JsonNodo): JsonNodo => {
    let nodo = n;
    const attrs = (n.attrs ?? {}) as Record<string, unknown>;
    if (ajeno(attrs.href)) { cambiados++; nodo = { ...nodo, attrs: { ...attrs, href: '#', ...('nuevaPestana' in attrs ? { nuevaPestana: false } : {}) } }; }
    if (n.marks?.some((m) => m.type === 'link' && ajeno((m.attrs ?? {}).href))) {
      cambiados++;
      nodo = { ...nodo, marks: n.marks.map((m) => (m.type === 'link' && ajeno((m.attrs ?? {}).href) ? { ...m, attrs: { ...(m.attrs ?? {}), href: '#' } } : m)) };
    }
    return nodo.content ? { ...nodo, content: nodo.content.map(caminar) } : nodo;
  };
  return { tarjeta: caminar(t), cambiados };
}

/** Un renglón leído sin el destino de su botón («[BOTÓN] Probar → https://otro.com» → «[BOTÓN] Probar»): lo que ve la IA. */
export const sinDestinoDeBoton = (renglon: string): string => renglon.replace(/^(\[BOT[ÓO]N\][^→]*?)\s*→[\s\S]*$/i, '$1');

/** El tope de `instrucciones` en ia.ts (MAX_INSTRUCCIONES). La instrucción entera tiene que entrar: un corte se llevaría datos. */
export const TOPE_INSTRUCCION = 5_000;

/**
 * La instrucción de la réplica para la IA, según las partes (null con el texto literal: ahí no se escribe nada).
 * `molde`: la forma de cada sección de la original (`textoDeMolde`); `angulos`: cómo vende (`textoDeAngulos`). Va en
 * `instrucciones`, envuelta como contenido no confiable por ia.ts: los ángulos y el molde salen de la página de un
 * TERCERO. Las REGLAS van primero y los datos al final: si algo no entra en `TOPE_INSTRUCCION`, se recortan los datos,
 * nunca la regla de no copiar.
 */
export function instruccionDePartes(p: PartesReplica, extra: { molde?: string; angulos?: string; oferta?: string; marca?: string; nombres?: readonly string[] } = {}): string | null {
  if (p.texto) return null;
  const oferta = (extra.oferta ?? '').replace(/\s+/g, ' ').trim().slice(0, TOPE_OFERTA);
  const nombres = (extra.nombres ?? []).map((n) => String(n).trim()).filter(Boolean).slice(0, 12);
  const reglas: string[] = [
    p.estructura
      ? 'REPLICAR UNA LANDING DE REFERENCIA PARA ESTE NEGOCIO. El esquema es la página de OTRO negocio.'
      : 'ARMAR UNA LANDING PARA ESTE NEGOCIO tomando cosas de una landing de referencia de OTRO negocio.',
    // 28/10/2026, medido en el ws9: sin una oferta (el perfil del negocio vacío) la IA reescribía la de la competencia.
    oferta ? `LA OFERTA DE ESTE NEGOCIO (manda sobre todo lo demás; de esto habla la landing): ${oferta}` : '',
    extra.marca ? `La referencia es «${extra.marca}»: no la nombres, ni a sus productos, sus clientes, sus cifras ni su precio.` : '',
    // 12/11/2026: con «ni sus nombres» solo, «Quién es Clara Pérez» pasó entero a la réplica de MaKo. La lista, con nombre y apellido.
    nombres.length ? `NOMBRES DE LA REFERENCIA (no los escribas en ninguna forma; donde la referencia habla de su autor o sus clientes, habla de ESTE negocio con lo que sabes de él, o deja «[tu nombre]» / «[testimonio real de un cliente]»): ${nombres.join(', ')}.` : '',
    p.estructura
      ? 'ESTRUCTURA (se toma): las mismas secciones, en el mismo orden y con el mismo tipo de bloque. En cada sección, la misma cantidad de títulos, subtítulos, párrafos, viñetas, botones y preguntas que la de la referencia, con un largo parecido y el mismo acomodo (si la referencia tiene tres tarjetas con un título y dos renglones cada una, la copia también; si tiene una imagen, la copia deja su hueco). Cada sección pedida trae su «Molde de la referencia».'
      : 'ESTRUCTURA (no se toma): elige las secciones y su orden para vender la oferta de ESTE negocio.',
    p.angulos
      ? (p.estructura
        ? 'ÁNGULOS (se toman): en cada sección, el mismo ángulo que la de la referencia (el de su molde): el mismo dolor, el mismo deseo, la misma promesa, la misma forma de vender, la misma objeción respondida y el mismo tipo de prueba, trasladados a la oferta de ESTE negocio.'
        : 'ÁNGULOS (se toman): usa los ángulos de comunicación de la referencia (abajo): su promesa, sus dolores, su forma de vender, las objeciones que responde y el tipo de prueba, trasladados a la oferta de ESTE negocio.')
      : (p.estructura
        ? 'ÁNGULOS (no se toman): de la referencia usa SOLO la forma. Lo que dice cada sección (los dolores, la promesa, los argumentos, las objeciones, la prueba) sale del contexto de ESTE negocio.'
        : 'ÁNGULOS (no se toman): los dolores, la promesa y los argumentos salen del contexto de ESTE negocio.'),
    `TEXTO (no se toma): no copies frases de la referencia; escribe el texto de nuevo para la oferta de ESTE negocio, según su contexto: su producto, su promesa, su audiencia, su precio y su llamado a la acción. ${NADA_PROPIO}`,
  ];
  const datos = [
    p.estructura && extra.molde ? `MOLDE de la referencia, sección por sección:\n${extra.molde}` : '',
    p.angulos && extra.angulos ? `ÁNGULOS de la referencia:\n${extra.angulos}` : '',
  ].filter(Boolean);
  const texto = [...reglas.filter(Boolean), ...datos].join('\n\n');
  return texto.length > TOPE_INSTRUCCION ? `${texto.slice(0, TOPE_INSTRUCCION - 1)}…` : texto;
}

/** Lo que hace falta de una oferta para escribir la réplica (lo de `ofertas`, lib/oferta-modelo.ts). */
export type OfertaParaReplica = {
  nombre: string;
  promesa?: string | null;
  para_quien?: string | null;
  incluye?: string | null;
  precio_usd?: number | null;
  precio_nota?: string | null;
  garantia?: string | null;
};

/**
 * La oferta en texto, para la instrucción de la réplica cuando la persona no escribió «Tu oferta» (12/11/2026, el Cerebro:
 * «si el perfil del negocio está vacío, usa la oferta principal, como hacen Copywriting e Image»). Medido ese día en el ws9:
 * con el perfil vacío y sin oferta escrita, la réplica de una masterclass seguía hablando de la competencia. Sólo lo que el
 * negocio cargó: un campo vacío no se nombra (y no se inventa). '' sin nombre. Puro.
 */
export function textoDeOferta(o: OfertaParaReplica | null | undefined): string {
  const nombre = String(o?.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (!o || !nombre) return '';
  const limpio = (s: string | null | undefined) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const precio = typeof o.precio_usd === 'number' && Number.isFinite(o.precio_usd) && o.precio_usd > 0
    ? `US$${o.precio_usd}${limpio(o.precio_nota) ? ` (${limpio(o.precio_nota)})` : ''}` : limpio(o.precio_nota);
  return [
    nombre,
    limpio(o.promesa) && `promesa: ${limpio(o.promesa)}`,
    limpio(o.para_quien) && `para: ${limpio(o.para_quien)}`,
    limpio(o.incluye) && `incluye: ${limpio(o.incluye)}`,
    precio && `precio: ${precio}`,
    limpio(o.garantia) && `garantía: ${limpio(o.garantia)}`,
  ].filter(Boolean).join('; ').slice(0, TOPE_OFERTA);
}

/**
 * ¿Una réplica que se escribe para el negocio (`adaptar`) terminó sin NINGUNA sección escrita por la IA? (12/11/2026: en el
 * ws3, sin IA, la «Adaptada de …» salía igual, con el texto de la competencia entero.) Entonces no se crea. Puro.
 */
export const adaptacionSinNingunaSeccion = (adaptar: boolean, secciones: number, escritas: number): boolean =>
  adaptar && secciones > 0 && escritas === 0;

/** Lo que lee la persona cuando no se creó la adaptada: qué pasó, lo que dijo la IA y qué hacer. */
export function errorDeAdaptacion(errorDeIA: string): string {
  const dijo = String(errorDeIA ?? '').replace(/\s+/g, ' ').trim();
  return `MaKo no pudo escribir el texto para tu oferta, así que no creó la copia adaptada.${dijo ? ` ${/[.!?]$/.test(dijo) ? dijo : `${dijo}.`}` : ''} Para copiarla tal cual, prende «Texto literal».`;
}

/** El pedido del esquema cuando la estructura NO se toma (la IA arma las secciones para la oferta del negocio). */
export const PEDIDO_SIN_ESTRUCTURA = 'Una landing de venta para la oferta principal de este negocio, según su contexto.';

/**
 * Lo que la réplica le pide a la IA, por partes (el resto de la receta, el formato y la configuración, sale de
 * `configDeReplica`). `esquema`: cómo se arma el esquema; `paramsEsquema` / `paramsSecciones`: lo que va en cada tanda.
 */
export type RecetaDePartes = {
  esquema: 'pagina' | 'generar';
  paramsEsquema: Partial<ParamsGeneracion>;
  paramsSecciones: Partial<ParamsGeneracion>;
  /** Copiar el estilo de la original (tema, imágenes y animaciones). */
  copiaDiseno: boolean;
};

/**
 * La receta por partes, PURA. `base`: los parámetros del formato (`configDeReplica(...).params`): Landing conserva,
 * Presentación condensa. `instruccion`: la de `instruccionDePartes` para cada tanda (la del esquema va sin el molde,
 * que sale del esquema; null con el texto literal).
 *   · con el texto literal: lo de siempre (Landing conserva; Presentación condensa);
 *   · Landing con estructura: el esquema es el de la página (conservado) y las secciones se escriben de nuevo;
 *   · Presentación con estructura: la IA arma las diapositivas de la página escribiendo de nuevo;
 *   · sin estructura: la IA arma el esquema para la oferta (Landing o Presentación), con la instrucción en las dos.
 */
export function recetaDePartes(
  formato: FormatoReplicar,
  base: Partial<ParamsGeneracion>,
  p: PartesReplica,
  instruccion: { esquema: string | null; secciones: string | null } = { esquema: null, secciones: null },
): RecetaDePartes {
  const escribir = (x: Partial<ParamsGeneracion>, i: string | null): Partial<ParamsGeneracion> => ({ ...x, modoTexto: 'generar', ...(i ? { instrucciones: i } : {}) });
  if (p.texto) return { esquema: 'pagina', paramsEsquema: base, paramsSecciones: base, copiaDiseno: p.diseno };
  if (!p.estructura) {
    return { esquema: 'generar', paramsEsquema: escribir(base, instruccion.esquema), paramsSecciones: escribir(base, instruccion.secciones), copiaDiseno: p.diseno };
  }
  if (formato === 'presentacion') {
    return { esquema: 'pagina', paramsEsquema: escribir(base, instruccion.esquema), paramsSecciones: escribir(base, instruccion.secciones), copiaDiseno: p.diseno };
  }
  return { esquema: 'pagina', paramsEsquema: base, paramsSecciones: escribir(base, instruccion.secciones), copiaDiseno: p.diseno };
}
