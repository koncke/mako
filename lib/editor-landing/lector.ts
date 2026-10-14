// =============================================================================
// editor-landing/lector — LEER una landing como un visitante, en el navegador de la persona (tanda 6, b)
// =============================================================================
// Pedido de Martín (14/10/2026), mirando «No pude leer el texto de esa página.» sobre la landing de un
// cliente armada como app (Vite/React: el HTML no trae una sola palabra, todo lo arma el JavaScript):
//   1. «El mimso error que nos saltaba con Mauricio "No pude leer el texto de esa página.". Soluciona eso...»
// Y la decisión del mismo día sobre CÓMO (no se vuelve a preguntar): leerla «como un visitante» —abrir los
// desplegables, anotar a dónde lleva cada botón SIN seguirlo, ver si el calendario carga SIN reservar—
// en el navegador de la persona: «Haz ambas opciones disponibles, si detecta que tenes el pixel
// instalado, que lo haga desde allí y sino desde la ventana emergente».
//
// Lo que vive acá, PURO y apto para el navegador (lo importan la pantalla, la ruta y el test):
//   · lo que la página leída le manda a MaKo (`PiezaLectura`, `DestinoBoton`) y la lectura entera que
//     arma MaKo con eso (`LecturaDetallada`), saneada: lo que llega de una página ajena NO es confiable;
//   · el PROTOCOLO entre MaKo y la ventana que lee (`sanearMensajeLectura`, `origenDeLecturaValido`);
//   · el TEXTO que sale de una lectura (`armarTextoLectura`), con «[DESPLEGABLE] pregunta → respuesta» y
//     «[BOTÓN] texto → destino» en el orden de la página. Se arma ACÁ y no en la página leída: el
//     formato vive en un solo lugar, con test, y nunca se le cree a un texto armado por una página ajena;
//   · el paso a lo que ACEPTA EL SERVER (`aLecturaDelServer`): el contrato del server es `Lectura` de
//     lectura-tipos.ts (análisis, Replicar, Importar), y el server la re-sanea con SU `sanearLectura`
//     (lectura-reglas.ts). Un contrato solo: esto no define otro, lo llena.
//
// El script que corre ADENTRO de la página leída está en lector-script.ts; la ventana sin Pixel, en
// lector-pagina.ts; la función que abre la ventana y espera la respuesta, en lector-navegador.ts.
//
// EL PROTOCOLO (todos los mensajes llevan `tipo: 'mako-lectura'` y el `id` que acuñó MaKo):
//   página → MaKo  { fase: 'hola', camino }        el lector arrancó (se repite hasta el «dale»)
//   MaKo → página  { fase: 'dale' }                 recién ahí toca algo: un link compartido con el
//                                                   parámetro, abierto por otro, no hace nada
//   página → MaKo  { fase: 'fin', camino, titulo, piezas, ms, quieto, parcial }
//   página → MaKo  { fase: 'error', error }         la página no se pudo bajar o el lector se cayó
// MaKo sólo acepta mensajes de LA ventana que abrió (`ev.source`), con SU id y desde un origen esperado
// (`origenDeLecturaValido`): el de la landing, el opaco de la ventana aislada («null») o el propio.
//
// ⚠️ SIN IMPORTS DE NODE NI DE MÓDULOS server-only: lo importan la pantalla y la ruta.
// =============================================================================

// El contrato del server (del agente que lo escribió en la misma tanda): sólo el tipo, no arrastra nada.
import type { Lectura as LecturaDelServer } from './lectura-tipos';

export type { LecturaDelServer };

// ─────────────────────────────────────────────────────────────────────────────
// El contrato
// ─────────────────────────────────────────────────────────────────────────────

/** El parámetro con que se abre la página REAL cuando tiene el Pixel (lo lee el Pixel, lib/landing-token.ts). */
export const PARAM_LEER = 'mako_leer';

/** El `tipo` de todos los mensajes del protocolo. */
export const TIPO_MENSAJE_LECTURA = 'mako-lectura';

/** La forma de un id de lectura: 16-64 de base64url. Va en una URL y adentro de un JS servido. */
export const FORMA_ID_LECTURA = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Desde qué versión el Pixel trae el lector (`SNIPPET_VERSION` de lib/landing-token.ts, que no se importa
 * acá porque es server-only; tests/editor-landing-lector.test.ts exige que no quede por encima).
 */
export const VERSION_PIXEL_LECTOR = 24;

/** Por dónde se leyó: la página REAL con el Pixel, o la ventana de MaKo con la página aislada. */
export const CAMINOS_LECTURA = ['pixel', 'ventana'] as const;
export type CaminoLectura = (typeof CAMINOS_LECTURA)[number];

/** Lo que pide la pantalla: que decida MaKo mirando la página (`auto`), o un camino fijo. */
export type CaminoPedido = 'auto' | CaminoLectura;
export const caminoPedidoValido = (v: unknown): v is CaminoPedido => v === 'auto' || v === 'pixel' || v === 'ventana';

/** Los parámetros de la ventana de lectura en la ruta de la página de afuera (lector-pagina.ts). */
export const PARAM_LECTOR = 'lector';
export const PARAM_CAMINO = 'camino';

export const PROVEEDORES_AGENDA = ['calendly', 'cal', 'ghl', 'otro'] as const;
export type ProveedorAgenda = (typeof PROVEEDORES_AGENDA)[number];

/** A dónde llevaría un botón, anotado SIN seguirlo. */
export type DestinoBoton =
  /** Un lugar de la misma página. `existe`: si hay un elemento con ese id (null: no se pudo mirar). */
  | { tipo: 'ancla'; valor: string; existe: boolean | null }
  /** `valor` '' = sale a otra página y no se pudo ver a cuál (la página se fue antes de decirlo). */
  | { tipo: 'url'; valor: string }
  /** Manda un formulario (nunca se manda): `valor` es su `action`, si tiene. */
  | { tipo: 'formulario'; valor: string }
  /** Abre una ventana adentro de la página: `valor` es su título, si tiene. */
  | { tipo: 'modal'; valor: string }
  /** Baja (o sube) a otra parte de la página sin un id que nombrar: `valor` es el título que quedó arriba. */
  | { tipo: 'desplaza'; valor: string }
  | { tipo: 'nada' };

/** Un pedazo de la página, en el orden en que se lee. */
export type PiezaLectura =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'desplegable'; pregunta: string; respuesta: string }
  | { tipo: 'pestana'; pregunta: string; respuesta: string }
  | { tipo: 'boton'; texto: string; destino: DestinoBoton }
  /** Una agenda embebida. `cargo`: respondió (null = no se pudo comprobar, ver la ventana aislada). */
  | { tipo: 'calendario'; proveedor: ProveedorAgenda; url: string; alto: number; cargo: boolean | null };

/** Lo que se toca o se mira de la página: todo menos el texto corrido. */
export type InteraccionLeida = Exclude<PiezaLectura, { tipo: 'texto' }>;

/**
 * Una lectura terminada, con TODO lo que se vio (la pantalla puede mostrarlo; al server va
 * `aLecturaDelServer`). `texto` e `interacciones` SALEN de `piezas`: nunca se aceptan armados de afuera.
 */
export type LecturaDetallada = {
  v: 1;
  /** La URL que se pidió leer (no la que dijo la página). */
  url: string;
  titulo: string;
  camino: CaminoLectura;
  /** El texto en orden, con las marcas de `armarTextoLectura`. */
  texto: string;
  piezas: PiezaLectura[];
  interacciones: InteraccionLeida[];
  palabras: number;
  /** Cuánto tardó el lector adentro de la página. */
  ms: number;
  /** La página se quedó quieta (800 ms sin cambios) antes del tope: si no, se leyó a medio armar. */
  quieto: boolean;
  /** Se cortó antes de terminar (el tope de tiempo, o la página se fue). */
  parcial: boolean;
};

export const TOPES_LECTOR = {
  piezas: 500,
  texto: 60_000,
  /** Un renglón de texto corrido (los largos se cortan, no se tiran). */
  renglon: 4_000,
  pregunta: 300,
  respuesta: 2_000,
  boton: 120,
  destino: 500,
  url: 2_000,
  titulo: 200,
  error: 300,
  /** Tope de una lectura entera, en milisegundos, para el número que llega. */
  ms: 120_000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// El id
// ─────────────────────────────────────────────────────────────────────────────

export const idLecturaValido = (v: unknown): v is string => typeof v === 'string' && FORMA_ID_LECTURA.test(v);

/** Un id nuevo: 24 caracteres de base64url (144 bits) del generador del navegador o de Node. */
export function nuevoIdLectura(): string {
  const b = new Uint8Array(18);
  globalThis.crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** La URL de la página REAL con el parámetro de lectura (antes del `#`, que es donde lo ve `location.search`). */
export function urlConLectura(url: string, id: string): string | null {
  if (!idLecturaValido(id)) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.searchParams.set(PARAM_LEER, id);
    return u.toString();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// El saneo
// ─────────────────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
/** Un renglón: sin espacios repetidos, recortado. */
const linea = (v: unknown, max: number): string => str(v).replace(/\s+/g, ' ').trim().slice(0, max);
/** Un bloque: conserva los saltos (uno por renglón), sin espacios repetidos, recortado. */
const bloque = (v: unknown, max: number): string => str(v)
  .split('\n').map((l) => l.replace(/[ \t\u00a0\f\v\r]+/g, ' ').trim()).filter(Boolean).join('\n')
  .slice(0, max);

/** Una URL http(s), mailto o tel con forma; '' si no. Sin espacios ni comillas que corten el texto. */
function urlSaneada(v: unknown, max: number = TOPES_LECTOR.destino): string {
  const s = str(v).trim();
  if (!s || /\s/.test(s)) return '';
  try {
    const u = new URL(s);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(u.protocol) ? u.toString().slice(0, max) : '';
  } catch {
    return '';
  }
}

function destinoSaneado(v: unknown): DestinoBoton {
  const d = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  switch (d.tipo) {
    case 'ancla': {
      const valor = linea(d.valor, 200);
      return valor.startsWith('#') && valor.length > 1
        ? { tipo: 'ancla', valor, existe: typeof d.existe === 'boolean' ? d.existe : null }
        : { tipo: 'nada' };
    }
    case 'url': {
      // '' = salió a otra página y no se pudo ver a cuál (la ventana aislada no puede atajar location.href).
      const valor = urlSaneada(d.valor);
      return valor || d.valor === '' ? { tipo: 'url', valor } : { tipo: 'nada' };
    }
    case 'formulario': return { tipo: 'formulario', valor: urlSaneada(d.valor) };
    case 'modal': return { tipo: 'modal', valor: linea(d.valor, TOPES_LECTOR.boton) };
    case 'desplaza': return { tipo: 'desplaza', valor: linea(d.valor, TOPES_LECTOR.boton) };
    default: return { tipo: 'nada' };
  }
}

/** Una pieza de afuera, saneada; null si no tiene forma o queda vacía. */
function piezaSaneada(v: unknown): PiezaLectura | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  switch (p.tipo) {
    case 'texto': {
      const texto = bloque(p.texto, TOPES_LECTOR.renglon);
      return texto ? { tipo: 'texto', texto } : null;
    }
    case 'desplegable':
    case 'pestana': {
      const pregunta = linea(p.pregunta, TOPES_LECTOR.pregunta);
      const respuesta = bloque(p.respuesta, TOPES_LECTOR.respuesta);
      return pregunta || respuesta ? { tipo: p.tipo === 'pestana' ? 'pestana' : 'desplegable', pregunta, respuesta } : null;
    }
    case 'boton': {
      const texto = linea(p.texto, TOPES_LECTOR.boton);
      return texto ? { tipo: 'boton', texto, destino: destinoSaneado(p.destino) } : null;
    }
    case 'calendario': {
      const proveedor = (PROVEEDORES_AGENDA as readonly unknown[]).includes(p.proveedor) ? (p.proveedor as ProveedorAgenda) : 'otro';
      const alto = typeof p.alto === 'number' && Number.isFinite(p.alto) ? Math.max(0, Math.min(100_000, Math.round(p.alto))) : 0;
      return { tipo: 'calendario', proveedor, url: urlSaneada(p.url), alto, cargo: typeof p.cargo === 'boolean' ? p.cargo : null };
    }
    default: return null;
  }
}

/**
 * Las piezas de afuera, saneadas y con los topes: hasta `TOPES_LECTOR.piezas`, y el texto corrido hasta
 * `TOPES_LECTOR.texto` caracteres en total (lo que se pasa se corta, y la lectura queda `parcial`).
 */
export function sanearPiezas(raw: unknown): { piezas: PiezaLectura[]; cortada: boolean } {
  const lista = Array.isArray(raw) ? raw : [];
  const piezas: PiezaLectura[] = [];
  let chars = 0;
  let cortada = lista.length > TOPES_LECTOR.piezas;
  for (const x of lista.slice(0, TOPES_LECTOR.piezas)) {
    const p = piezaSaneada(x);
    if (!p) continue;
    const largo = p.tipo === 'texto' ? p.texto.length
      : p.tipo === 'desplegable' || p.tipo === 'pestana' ? p.pregunta.length + p.respuesta.length
      : p.tipo === 'boton' ? p.texto.length + 20 : 40;
    if (chars + largo > TOPES_LECTOR.texto) { cortada = true; break; }
    chars += largo;
    // Dos textos seguidos van en una sola pieza (la página los manda por bloque).
    const ult = piezas[piezas.length - 1];
    if (p.tipo === 'texto' && ult?.tipo === 'texto') ult.texto = `${ult.texto}\n${p.texto}`;
    else piezas.push(p);
  }
  return { piezas, cortada };
}

// ─────────────────────────────────────────────────────────────────────────────
// El texto
// ─────────────────────────────────────────────────────────────────────────────

const NOMBRE_AGENDA: Record<ProveedorAgenda, string> = { calendly: 'Calendly', cal: 'Cal.com', ghl: 'GoHighLevel', otro: 'Agenda' };

/** A dónde lleva un botón, en palabras. */
export function destinoEnPalabras(d: DestinoBoton): string {
  switch (d.tipo) {
    case 'ancla': return d.existe === false ? `${d.valor} (no existe en la página)` : d.valor;
    case 'url': return d.valor || 'sale a otra página';
    case 'formulario': return d.valor ? `envía el formulario (a ${d.valor})` : 'envía el formulario';
    case 'modal': return d.valor ? `abre una ventana: «${d.valor}»` : 'abre una ventana';
    case 'desplaza': return d.valor ? `baja a «${d.valor}»` : 'baja a otra parte de la página';
    default: return 'no hace nada';
  }
}

/** Una respuesta de varios renglones en uno solo (cada pieza es un renglón del texto). */
const enUnRenglon = (s: string): string => s.split('\n').map((l) => l.trim()).filter(Boolean).join(' / ');

/** Un renglón del texto para una interacción. */
export function renglonDeInteraccion(p: InteraccionLeida): string {
  switch (p.tipo) {
    case 'desplegable': return `[DESPLEGABLE] ${p.pregunta || '(sin título)'} → ${enUnRenglon(p.respuesta) || '(vacío)'}`;
    case 'pestana': return `[PESTAÑA] ${p.pregunta || '(sin título)'} → ${enUnRenglon(p.respuesta) || '(vacía)'}`;
    case 'boton': return `[BOTÓN] ${p.texto} → ${destinoEnPalabras(p.destino)}`;
    case 'calendario': {
      const estado = p.cargo === true ? `cargó${p.alto ? `, ${p.alto} px de alto` : ''}`
        : p.cargo === false ? (p.alto ? 'no cargó' : 'no cargó, sin alto') : 'sin comprobar';
      return `[CALENDARIO] ${NOMBRE_AGENDA[p.proveedor]}${p.url ? ` (${p.url})` : ''} → ${estado}`;
    }
  }
}

/** El texto de una lectura: las piezas en orden, un renglón por interacción. */
export function armarTextoLectura(piezas: readonly PiezaLectura[]): string {
  const out: string[] = [];
  for (const p of piezas) {
    const r = p.tipo === 'texto' ? p.texto : renglonDeInteraccion(p);
    // Un renglón igual al anterior no se repite (un menú pegado dos veces, el mismo botón en cadena).
    if (r && r !== out[out.length - 1]) out.push(r);
  }
  return out.join('\n').slice(0, TOPES_LECTOR.texto + 2_000);
}

export const interaccionesDe = (piezas: readonly PiezaLectura[]): InteraccionLeida[] =>
  piezas.filter((p): p is InteraccionLeida => p.tipo !== 'texto');

const contarPalabras = (t: string): number => t.split(/\s+/).filter(Boolean).length;

/** Una lectura con forma, a partir de sus partes ya validadas (el texto y las interacciones SALEN de las piezas). */
function lecturaDe(url: string, crudo: Record<string, unknown>, camino: CaminoLectura): LecturaDetallada {
  const { piezas, cortada } = sanearPiezas(crudo.piezas);
  const texto = armarTextoLectura(piezas);
  const ms = typeof crudo.ms === 'number' && Number.isFinite(crudo.ms) ? Math.max(0, Math.min(TOPES_LECTOR.ms, Math.round(crudo.ms))) : 0;
  return {
    v: 1,
    url,
    titulo: linea(crudo.titulo, TOPES_LECTOR.titulo),
    camino,
    texto,
    piezas,
    interacciones: interaccionesDe(piezas),
    palabras: contarPalabras(texto),
    ms,
    quieto: crudo.quieto === true,
    parcial: crudo.parcial === true || cortada,
  };
}

const caminoValido = (v: unknown): v is CaminoLectura => (CAMINOS_LECTURA as readonly unknown[]).includes(v);

/** Un mensaje del protocolo, saneado. null si no es de ESTA lectura o no tiene forma. */
export type MensajeLectura =
  | { fase: 'hola'; camino: CaminoLectura | null }
  | { fase: 'fin'; detalle: LecturaDetallada }
  | { fase: 'error'; mensaje: string };

/**
 * El mensaje que llegó por `postMessage`, saneado contra lo que se esperaba (`id` y `url` los pone MaKo,
 * no la página). Quien llama ya comprobó `ev.source` y `origenDeLecturaValido`.
 */
export function sanearMensajeLectura(data: unknown, esperado: { id: string; url: string }): MensajeLectura | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  if (m.tipo !== TIPO_MENSAJE_LECTURA || m.id !== esperado.id || !idLecturaValido(m.id)) return null;
  if (m.fase === 'hola') return { fase: 'hola', camino: caminoValido(m.camino) ? m.camino : null };
  if (m.fase === 'error') return { fase: 'error', mensaje: linea(m.error, TOPES_LECTOR.error) || 'No pude leer la página.' };
  if (m.fase === 'fin' && caminoValido(m.camino)) return { fase: 'fin', detalle: lecturaDe(esperado.url, m, m.camino) };
  return null;
}

const sinWww = (h: string): string => h.toLowerCase().replace(/^www\./, '');

/**
 * ¿Puede venir de este origen un mensaje de la lectura de `urlPedida`? El opaco de la ventana aislada
 * («null»), el propio de MaKo, o el de la landing (con o sin www, que una página suele redirigir al otro).
 * ⚠️ NO alcanza solo: quien llama compara también `ev.source` con la ventana que abrió y el id.
 */
export function origenDeLecturaValido(origen: string, urlPedida: string, propio: string): boolean {
  if (origen === 'null') return true;
  if (origen && origen === propio) return true;
  try {
    const o = new URL(origen);
    if (o.protocol !== 'https:' && o.protocol !== 'http:') return false;
    return sinWww(o.hostname) === sinWww(new URL(urlPedida).hostname);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que va al server
// ─────────────────────────────────────────────────────────────────────────────

/** Una interacción con la forma del server (`InteraccionLectura` de lectura-tipos.ts: `tipo` libre). */
function interaccionDelServer(p: InteraccionLeida): LecturaDelServer['interacciones'][number] {
  switch (p.tipo) {
    case 'boton':
      return p.destino.tipo === 'formulario'
        ? { tipo: 'formulario', texto: p.texto, ...(p.destino.valor ? { destino: p.destino.valor } : {}) }
        : { tipo: 'boton', texto: p.texto, destino: destinoEnPalabras(p.destino) };
    case 'desplegable':
    case 'pestana':
      return { tipo: 'desplegable', texto: p.pregunta || p.respuesta.slice(0, 120) };
    case 'calendario': {
      const estado = p.cargo === true ? 'cargó' : p.cargo === false ? 'no cargó' : 'sin comprobar';
      return { tipo: 'calendario', texto: `${NOMBRE_AGENDA[p.proveedor]}: ${estado}${p.alto ? ` (${p.alto} px de alto)` : ''}`, ...(p.url ? { destino: p.url } : {}) };
    }
  }
}

/**
 * La lectura con la forma que aceptan las tres entradas del server (el `lectura` de ia «importar», del
 * Diagnóstico y de Replicar: `Lectura` de lectura-tipos.ts). El texto va entero (con sus marcas: es el
 * orden de la página); lo probado, una vez por cosa (un botón que aparece tres veces se probó una).
 */
export function aLecturaDelServer(d: Pick<LecturaDetallada, 'texto' | 'interacciones'>): LecturaDelServer {
  const vistas = new Set<string>();
  const interacciones: LecturaDelServer['interacciones'] = [];
  for (const p of d.interacciones) {
    const i = interaccionDelServer(p);
    const clave = `${i.tipo}|${i.texto}|${i.destino ?? ''}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    interacciones.push(i);
  }
  return { texto: d.texto, interacciones, fuente: 'navegador' };
}
