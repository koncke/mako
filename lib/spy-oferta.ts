// =============================================================================
// spy-oferta — la OFERTA de un competidor, con el analista de Offer, sola y en segundo plano (4/11/2026)
// =============================================================================
// Martín (por el Cerebro, 4/11): «en "Su Funnel" debe "exponer" su OFERTA con el analizador de oferta que ya tenemos
// construido, y debe traer automáticamente sus web para analizarlas». El analizador es el de Offer (`diagnosticoOffer`,
// lib/offer-ia.ts): las 9 dimensiones del marco, la tesis y lo que ya hace bien. NO SE ARMA OTRO: se le pasa su web como
// documento y se le dice que la oferta es de otro (`bloqueOfertaDeOtro`, lib/offer-reglas.ts). Las cifras pasan por la
// misma red que en Offer (`diagnosticoConFuentes`: una frase con un número que su web no dice, sale) y el puntaje lo
// calcula el CÓDIGO (`calcularDiagnostico`), nunca el modelo.
//
// Sin `server-only`, a propósito: lo que habla con la base, la red y la IA entra por `deps`
// (lib/spy-oferta-servidor.ts), así el test corre esto mismo con dobles.
//
// ⚠️ SE LEE UNA VEZ Y LISTO (Martín: «se revisa una vez, sola y listo»). Con su web igual —la misma huella del texto— no se
// vuelve a pagar la IA: a los `VUELVE_A_MIRAR_MS` se baja su web otra vez (eso no cuesta) y sólo si cambió se diagnostica de
// nuevo. Una web nueva (la que la cadena encontró en su bio) también se lee sola.
//
// ⚠️ UNA LECTURA QUE FALLÓ NO BORRA LA ANTERIOR: queda `no-pudo` con su motivo y el diagnóstico de antes sigue a la vista.
// No se reintenta en cadena: espera `ESPERA_TRAS_FALLO_MS` (y más, si ya falló varias veces).
//
// ⚠️ UN TRABAJO POR COMPETIDOR: «leyendo» se toma con compare-and-set (`cambiarSi`) y cada escritura final compara contra
// lo que escribió ESE trabajo. Uno viejo que termina tarde no pisa al nuevo, y «Dejar de mirarlo» (que borra la clave) no
// la vuelve a crear.
// =============================================================================

import { calcularDiagnostico, cifrasConPorcentaje, diagnosticoConFuentes } from './offer-reglas';
import { esDimensionId, type DiagnosticoOferta, type DimensionId } from './offer-marco';
import { esAgregador } from './spy-otras-redes-reglas';

/** Una clave por competidor: dos competidores no se pisan, y borrarla es una línea. */
export const claveOfertaSpy = (competidorId: number): string => `spy.oferta.${competidorId}`;

/** Hasta cuántas webs se leen: la principal y las otras que se guardaron de él. */
export const MAX_PAGINAS = 3;
/** Una web con menos texto que esto no dice nada de una oferta (una página que se arma con JavaScript, un cartel). */
export const MIN_TEXTO = 200;
/** Cuánto texto de cada web viaja: lo mismo que un documento entero de Offer (`TOPE_DOC_ENTERO`). */
export const TOPE_TEXTO_PAGINA = 16_000;
/** Cada cuánto se mira si su web cambió. Mirar no cuesta IA: sólo la baja. */
export const VUELVE_A_MIRAR_MS = 7 * 24 * 60 * 60_000;
/** Un «leyendo» más viejo que esto se cortó (la función se cerró antes de terminar). */
export const LEYENDO_VENCE_MS = 10 * 60_000;
/** Tras un fallo, cuándo se vuelve a probar; con `FALLOS_HASTA_ESPERAR` seguidos, una semana. */
export const ESPERA_TRAS_FALLO_MS = 24 * 60 * 60_000;
export const FALLOS_HASTA_ESPERAR = 3;

/** Cuánto texto de cada página se GUARDA (para la evidencia de su funnel, lib/spy-funnel-tipo.ts): no el que viaja a la IA. */
export const TOPE_TEXTO_GUARDADO = 3_000;
/** Hasta cuántas de sus páginas se ofrecen en el desplegable de «Sus páginas». */
export const MAX_ENLACES = 8;

export type EstadoOferta = 'leyendo' | 'lista' | 'no-pudo';
/** Una página suya ya leída: lo que se guarda para su funnel y su vista previa. */
export type PaginaGuardada = { url: string; titulo: string; texto: string };

export type OfertaDeCompetidor = {
  estado: EstadoOferta;
  /** De quién es el trabajo en curso (o el último). */
  intento: string;
  /** Cuándo arrancó ese trabajo. */
  desde: string;
  /** La última vez que su web se leyó bien. */
  leidaEn: string | null;
  /** Las webs que se leyeron (o se están leyendo). */
  urls: string[];
  /** La huella del texto que se diagnosticó: con la misma, no se vuelve a pagar la IA. */
  huella: string | null;
  diagnostico: DiagnosticoOferta | null;
  /** Lo que calcula el código sobre las notas (0-100) y su dimensión más baja. */
  total: number | null;
  cuello: DimensionId | null;
  /** Por qué no se pudo, en una frase para la persona. */
  motivo: string | null;
  fallos: number;
  /** Las páginas que se leyeron, con su texto recortado (`TOPE_TEXTO_GUARDADO`): la evidencia de su funnel. */
  paginas: PaginaGuardada[];
  /**
   * Todas sus páginas, para el desplegable de «Sus páginas»: su web y, si es una página de enlaces (beacons, linktree), cada
   * página suya que enlaza (4/11/2026: «Beacons es la fuente de las páginas de Den Borg»).
   */
  enlaces: string[];
};

export type PaginaLeida = { url: string; titulo: string; texto: string };

const esTexto = (x: unknown): x is string => typeof x === 'string';

/** Lo guardado, leído a la defensiva: lo que no tiene la forma, no existe. */
export function leerOferta(crudo: string | null | undefined): OfertaDeCompetidor | null {
  if (!crudo) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(crudo) as Record<string, unknown>; } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const estado = o.estado === 'leyendo' || o.estado === 'lista' || o.estado === 'no-pudo' ? o.estado : null;
  if (!estado || !esTexto(o.intento) || !esTexto(o.desde)) return null;
  const d = o.diagnostico as DiagnosticoOferta | null | undefined;
  const diagnostico = d && typeof d === 'object' && Array.isArray(d.dimensiones) && esTexto(d.tesis) ? d : null;
  return {
    estado,
    intento: o.intento,
    desde: o.desde,
    leidaEn: esTexto(o.leidaEn) ? o.leidaEn : null,
    urls: Array.isArray(o.urls) ? o.urls.filter(esTexto).slice(0, MAX_PAGINAS) : [],
    huella: esTexto(o.huella) ? o.huella : null,
    diagnostico,
    total: diagnostico && typeof o.total === 'number' && Number.isFinite(o.total) ? o.total : null,
    cuello: diagnostico && esDimensionId(o.cuello) ? o.cuello : null,
    motivo: esTexto(o.motivo) ? o.motivo : null,
    fallos: typeof o.fallos === 'number' && o.fallos > 0 ? Math.floor(o.fallos) : 0,
    paginas: Array.isArray(o.paginas)
      ? (o.paginas as unknown[]).flatMap((x) => {
        const q = x as Record<string, unknown> | null;
        return q && esTexto(q.url) && esTexto(q.texto) ? [{ url: q.url, titulo: esTexto(q.titulo) ? q.titulo : '', texto: q.texto.slice(0, TOPE_TEXTO_GUARDADO) }] : [];
      }).slice(0, MAX_PAGINAS)
      : [],
    enlaces: Array.isArray(o.enlaces) ? o.enlaces.filter(esTexto).filter((u) => /^https?:\/\//i.test(u)).slice(0, MAX_ENLACES) : [],
  };
}

/** Una web como se compara: sin el `#`, sin la barra final, con el host en minúsculas. */
export function webComparable(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    u.host = u.host.toLowerCase();
    return u.toString().replace(/\/$/, '');
  } catch {
    return url.trim().replace(/\/$/, '');
  }
}

/** Sus webs: la principal primero y las otras que se guardaron de él, sin repetir, hasta `MAX_PAGINAS`. */
export function websDelCompetidor(principal: string | null | undefined, otras: ReadonlyArray<string | null | undefined>): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const u of [principal, ...otras]) {
    if (!u?.trim() || !/^https?:\/\//i.test(u.trim())) continue;
    const k = webComparable(u);
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push(u.trim());
    if (out.length >= MAX_PAGINAS) break;
  }
  return out;
}

const mismasWebs = (a: readonly string[], b: readonly string[]): boolean => {
  const k = (x: readonly string[]) => [...new Set(x.map(webComparable))].sort().join('\n');
  return k(a) === k(b);
};

const ms = (iso: string | null): number => (iso ? Date.parse(iso) || 0 : 0);

/** Cuánto se espera tras `fallos` fallos seguidos. */
export const esperaTrasFallos = (fallos: number): number => (fallos >= FALLOS_HASTA_ESPERAR ? VUELVE_A_MIRAR_MS : ESPERA_TRAS_FALLO_MS);

/** ¿Hay que leerla ahora? Sin webs, nunca. */
export function hayQueLeer(g: OfertaDeCompetidor | null, webs: readonly string[], ahora: number): boolean {
  if (!webs.length) return false;
  if (!g) return true;
  if (g.estado === 'leyendo') return ahora - ms(g.desde) > LEYENDO_VENCE_MS;
  // Una web nueva (la que encontró la cadena en su bio) se lee aunque la anterior esté al día.
  if (!mismasWebs(g.urls, webs)) return true;
  // Una lectura de antes del 4/11/2026 no guardaba el texto de sus páginas (la evidencia de su funnel) ni las que enlaza: se vuelve
  // a leer UNA vez. Con el mismo texto, la huella es la misma y la IA no se vuelve a pagar (`leerSuOferta`).
  if (g.estado === 'lista' && !g.paginas.length) return true;
  if (g.estado === 'lista') return ahora - ms(g.leidaEn ?? g.desde) >= VUELVE_A_MIRAR_MS;
  return ahora - ms(g.desde) >= esperaTrasFallos(g.fallos);
}

/**
 * Lo guardado, listo para volver a leerse YA. Una página capturada con la extensión es información nueva: sin esto, su oferta
 * se iba a leer recién al día siguiente (`ESPERA_TRAS_FALLO_MS`) o a la semana con tres fallos, y la persona que acaba de
 * capturarla no veía nada. `null` cuando no hay nada que destrabar (lo último no fue un «no pude»).
 */
export function sinEspera(g: OfertaDeCompetidor | null): OfertaDeCompetidor | null {
  if (!g || g.estado !== 'no-pudo') return null;
  return { ...g, fallos: 0, desde: new Date(0).toISOString() };
}

/** La huella de lo que dicen sus webs (FNV-1a sobre el texto sin espacios de más): igual texto, igual huella. */
export function huellaDe(paginas: ReadonlyArray<PaginaLeida>): string {
  const t = paginas.map((p) => `${webComparable(p.url)}\n${p.texto.replace(/\s+/g, ' ').trim()}`).join('\n\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i += 1) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, '0')}-${t.length}`;
}

export type DepsOferta = {
  /** Lo guardado de ESTE competidor, y con qué compararlo al escribir. */
  leer: () => Promise<{ crudo: string | null; version: string | null }>;
  /** Compare-and-set: escribe sólo si sigue en `version`. */
  cambiarSi: (version: string | null, nuevo: string) => Promise<boolean>;
  /** Baja UNA web y le saca el texto. Tira si no pudo. */
  bajar: (url: string) => Promise<PaginaLeida>;
  /** El analista de Offer, con la IA del negocio. */
  diagnosticar: (p: { nombre: string; paginas: PaginaLeida[] }) => Promise<{ ok: true; valor: DiagnosticoOferta } | { ok: false; error: string }>;
  /** Un id para el trabajo. */
  nuevoIntento: () => string;
  /** Las páginas suyas que enlaza una página de enlaces (beacons, linktree). Vacío si no pudo. */
  enlacesDe?: (url: string) => Promise<string[]>;
  /**
   * Lo que la persona YA guardó de esa misma página con la extensión («Capturar», en «Sus páginas»). Es el PLAN B: se usa
   * sólo cuando el servidor no pudo bajarla o lo que bajó casi no tiene texto. `null` si de esa dirección no hay nada.
   */
  capturada?: (url: string) => Promise<PaginaLeida | null>;
};

export type Reclamo =
  | { corre: false; actual: OfertaDeCompetidor | null }
  | { corre: true; actual: OfertaDeCompetidor; previa: OfertaDeCompetidor | null; version: string };

/**
 * Toma el trabajo si hace falta: escribe «leyendo» ganando el compare-and-set. El que no gana (otra pestaña, otra
 * instancia) recibe lo que hay. Lo de antes —el diagnóstico, la huella— queda adentro, así la pantalla lo sigue mostrando.
 */
export async function reclamarLectura(deps: DepsOferta, webs: readonly string[], ahora = Date.now()): Promise<Reclamo> {
  const l = await deps.leer();
  const previa = leerOferta(l.crudo);
  if (!hayQueLeer(previa, webs, ahora)) return { corre: false, actual: previa };
  const actual: OfertaDeCompetidor = {
    ...(previa ?? { leidaEn: null, huella: null, diagnostico: null, total: null, cuello: null, fallos: 0, paginas: [], enlaces: [] }),
    estado: 'leyendo',
    intento: deps.nuevoIntento(),
    desde: new Date(ahora).toISOString(),
    urls: [...webs],
    motivo: null,
  } as OfertaDeCompetidor;
  const version = JSON.stringify(actual);
  if (!(await deps.cambiarSi(l.version, version))) return { corre: false, actual: leerOferta((await deps.leer()).crudo) };
  return { corre: true, actual, previa, version };
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * El trabajo: baja sus webs, y si su texto cambió desde el último diagnóstico, se lo pasa al analista de Offer. Escribe el
 * resultado sólo si la clave sigue en lo que escribió `reclamarLectura` (`version`). Devuelve lo que quedó.
 */
export async function leerSuOferta(
  deps: DepsOferta,
  c: { nombre: string },
  r: { actual: OfertaDeCompetidor; previa: OfertaDeCompetidor | null; version: string },
  ahora: () => number = Date.now,
): Promise<OfertaDeCompetidor> {
  const { actual, previa, version } = r;
  const escribir = async (o: OfertaDeCompetidor): Promise<OfertaDeCompetidor> => {
    if (!(await deps.cambiarSi(version, JSON.stringify(o)))) return leerOferta((await deps.leer()).crudo) ?? o;
    return o;
  };
  // ⚠️ UNA PÁGINA DE ENLACES NO ES SU WEB: es una lista. Se leen las páginas suyas que enlaza (la de Den Borg es beacons.page, y
  // sus páginas de verdad —la del evento, la de las entradas— cuelgan de ahí). Las dos listas: lo que se lee (hasta MAX_PAGINAS)
  // y todo lo que se ofrece en «Sus páginas» (hasta MAX_ENLACES).
  const aLeer: string[] = [];
  const enlaces: string[] = [];
  for (const url of actual.urls) {
    enlaces.push(url);
    if (esAgregador(url) && deps.enlacesDe) {
      const suyas = await deps.enlacesDe(url).catch(() => []);
      enlaces.push(...suyas);
      aLeer.push(...suyas);
    } else aLeer.push(url);
  }
  const sinRepetir = (xs: string[]) => xs.filter((u, i) => xs.findIndex((v) => webComparable(v) === webComparable(u)) === i);
  const conEnlaces = { ...actual, enlaces: sinRepetir(enlaces).slice(0, MAX_ENLACES) };
  const fallo = (motivo: string) => escribir({ ...conEnlaces, estado: 'no-pudo', motivo, fallos: actual.fallos + 1 });

  const paginas: PaginaLeida[] = [];
  const errores: string[] = [];
  for (const url of sinRepetir(aLeer.length ? aLeer : actual.urls).slice(0, MAX_PAGINAS)) {
    // ⚠️ LA BAJADA DEL SERVIDOR MANDA, Y LA CAPTURADA ES EL PLAN B (6/11/2026). Una web con barrera (el «comprueba que eres
    // una persona» de Cloudflare en el Beacons de Den Borg) no se baja desde el servidor, y su oferta quedaba sin leer AUNQUE
    // la persona ya hubiera guardado esa misma página desde su navegador. El desafío NO se evade: se usa lo que ella ya miró.
    // Y al revés no: una captura es de cuando se capturó, y lo que el servidor puede bajar hoy está más fresco.
    let leida: PaginaLeida | null = null;
    let porque = '';
    try {
      const p = await deps.bajar(url);
      if (p.texto.trim().length >= MIN_TEXTO) leida = p;
      else porque = 'casi no tiene texto';
    } catch (e) {
      porque = msg(e);
    }
    if (!leida && deps.capturada) {
      const g = await deps.capturada(url).catch(() => null);
      if (g && g.texto.trim().length >= MIN_TEXTO) leida = g;
    }
    if (!leida) { errores.push(`${url}: ${porque || 'casi no tiene texto'}`); continue; }
    paginas.push({ url: leida.url || url, titulo: leida.titulo.trim(), texto: leida.texto.trim().slice(0, TOPE_TEXTO_PAGINA) });
  }
  if (!paginas.length) {
    if (errores.length) console.warn(`[spy-oferta] no pude leer sus webs: ${errores.join(' · ').slice(0, 600)}`);
    return fallo(actual.urls.length > 1 ? 'No pude leer sus webs.' : 'No pude leer su web.');
  }

  const huella = huellaDe(paginas);
  const leidaEn = new Date(ahora()).toISOString();
  const guardadas: PaginaGuardada[] = paginas.map((p) => ({ url: p.url, titulo: p.titulo, texto: p.texto.slice(0, TOPE_TEXTO_GUARDADO) }));
  // Su web dice lo mismo que la última vez: el diagnóstico de antes sigue valiendo y la IA no se vuelve a pagar.
  if (previa?.diagnostico && previa.huella === huella) {
    return escribir({ ...conEnlaces, paginas: guardadas, estado: 'lista', leidaEn, huella, diagnostico: previa.diagnostico, total: previa.total, cuello: previa.cuello, motivo: null, fallos: 0 });
  }

  const ia = await deps.diagnosticar({ nombre: c.nombre, paginas });
  if (!ia.ok) return fallo(ia.error);
  // La misma red que Offer: una frase con una cifra que su web no dice, sale. Los números de su web son «del negocio».
  const diagnostico = diagnosticoConFuentes(ia.valor, {
    delNegocio: cifrasConPorcentaje(paginas.map((p) => p.texto)), conFuente: new Map(), deLosAvisos: new Set(),
  });
  const calculo = calcularDiagnostico(diagnostico.dimensiones);
  return escribir({
    ...conEnlaces, paginas: guardadas, estado: 'lista', leidaEn, huella, diagnostico, total: calculo.total, cuello: calculo.cuello, motivo: null, fallos: 0,
  });
}

/** Lo que la pantalla y la API dibujan de su oferta. Sin webs no hay nada que leer, y se dice. */
export type VistaOferta =
  | { estado: 'sin-web' }
  | { estado: 'sin-ia' }
  | {
    estado: EstadoOferta; diagnostico: DiagnosticoOferta | null; total: number | null; cuello: DimensionId | null; urls: string[]; leidaEn: string | null;
    motivo: string | null; paginas: PaginaGuardada[]; enlaces: string[];
  };

export function vistaDeOferta(o: OfertaDeCompetidor | null, webs: readonly string[], opts: { sinIA?: boolean } = {}): VistaOferta {
  if (!webs.length && !o?.diagnostico) return { estado: 'sin-web' };
  if (!o) return opts.sinIA ? { estado: 'sin-ia' } : { estado: 'leyendo', diagnostico: null, total: null, cuello: null, urls: [...webs], leidaEn: null, motivo: null, paginas: [], enlaces: [...webs] };
  return { estado: o.estado, diagnostico: o.diagnostico, total: o.total, cuello: o.cuello, urls: o.urls, leidaEn: o.leidaEn, motivo: o.motivo, paginas: o.paginas, enlaces: o.enlaces.length ? o.enlaces : o.urls };
}
