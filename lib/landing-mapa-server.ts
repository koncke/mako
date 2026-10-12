import 'server-only';
// =============================================================================
// El mapa de calor: qué páginas tienen toques, los toques de una, y su foto
// =============================================================================
// Lo lee app/api/landing-analyst/mapa/*. Las decisiones que se pueden equivocar
// (en qué cubo cae un toque, dónde se dibuja, cómo se reconstruye la foto) viven
// en lib/landing-mapa.ts y lib/landing-mapa-foto.ts, con test.
//
// ⚠️ LOS TOQUES SE LEEN CON `clic_x is not null`, siempre: es el predicado del
// índice parcial de la mig 0190 y lo que hace barata esta lectura. Sin él, el
// índice se paga en cada evento del beacon para nada.
//
// ⚠️ Y SE DESCARTAN AL LEER: la vista previa del constructor (no es la página del
// negocio), las pruebas del Pixel (`prueba` no nulo: es quien lo estaba probando,
// incluida la visita del propio mapa EN VIVO, `mapa-…`), el sello del constructor
// por su texto («Edit with…») y desde el 12/10/2026 también por su SELECTOR
// (`#lovable-badge-*`: la cruz llega con el texto vacío y era lo MÁS tocado del ws1,
// `esSelloDelConstructor`, la misma regla que el conjunto `toques`). Los eventos
// quedan en la base.
//
// DESDE v5 (12/10/2026) EL PERÍODO Y LOS FILTROS LOS DECIDE LA HOJA: el gráfico del
// Dashboard manda `desde`/`hasta` y los filtros de los controles (lib/landing-mapa-filtros.ts),
// y acá se aplican con la misma función que el agregador. Sin ventana, la tab vieja
// (app/landing-analyst/MapaDeCalor.tsx) sigue mirando sus 30 días.
// =============================================================================
import { getTenantDb } from './workspace';
import { leerPorPaginas } from './supabase-paginado';
import { esClicDelConstructor } from './clic-ruido';
import { normalizarUrl, esPreviewDeEditor } from './landing-paginas';
import { landingsDelWorkspace } from './landing-config-leer';
import { verificarPagina } from './landing-token';
import { cuerpoDeSesion } from './replay-leer';
import { dispositivoDe, MAPA_DIAS, selAnclado, type Dispositivo, type ToqueMapa } from './landing-mapa';
import { fotoDeEventos, htmlDeFoto } from './landing-mapa-foto';
import { rotuloDe } from './landing-mapa-rotulo';
import { esSelloDelConstructor } from './graficos-datos-puro';
import { filtrarFilas, type Fila, type Filtro } from './graficos-agregar';
import { ruta } from './graficos-lectura';
import { diasDe, dimensionesDeToque } from './landing-mapa-filtros';
import { diasAntes, hoyEnTijuana } from './date-utils';
import { getSetting } from './settings';
import { VERSIONES_POR_PAGINA_KEY, clavePagina, parsearMapaVersiones } from './pixel-aviso';

/**
 * La página de un toque o de una grabación: host + ruta, SIN query.
 *
 * ⚠️ No alcanza con `normalizarUrl`: conserva el query que no reconoce como de
 * medición, y los anuncios de Meta suman `ai=…&ct=…` y WhatsApp `sfnsn=wa`. Medido
 * el 06/10/2026 en el ws1: la misma portada salía como tres páginas distintas, y la
 * foto de una no servía de fondo para los toques de la otra.
 */
function norm(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const n = normalizarUrl(u);
    if (!n) return null;
    const i = n.indexOf('?');
    return i >= 0 ? n.slice(0, i) : n;
  } catch { return null; }
}

/** El período que se mira: fechas de Tijuana (como el resto del Dashboard), los dos extremos adentro. */
export type VentanaMapa = { desde: string; hasta: string };

/** Los últimos `dias` días hasta hoy: lo que miraba la tab vieja. */
export function ventanaDeDias(dias = MAPA_DIAS): VentanaMapa {
  const hasta = hoyEnTijuana();
  return { desde: diasAntes(hasta, Math.max(1, dias) - 1), hasta };
}

/** Los instantes que acotan la consulta: un día de margen a cada lado; el recorte fino es por fecha de Tijuana. */
function bordes(v: VentanaMapa): { desde: string; hasta: string } {
  return {
    desde: new Date(Date.parse(`${v.desde}T00:00:00Z`) - 86_400_000).toISOString(),
    hasta: new Date(Date.parse(`${v.hasta}T00:00:00Z`) + 2 * 86_400_000).toISOString(),
  };
}

type FilaToque = {
  created_at: string; visitor_id: string | null; landing_url: string | null; tipo_evento: string; detalle: string | null;
  clic_x: number | null; clic_y: number | null; ancho_ventana: number | null; alto_pagina: number | null;
  sel: string | null; rel_x: number | null; rel_y: number | null; alto_ventana: number | null; fijo: boolean | null;
  prueba: string | null;
};
const COLS = 'id, created_at, visitor_id, landing_url, tipo_evento, detalle, clic_x, clic_y, ancho_ventana, alto_pagina, sel, rel_x, rel_y, alto_ventana, fijo, prueba';

/**
 * Recorre los toques DIBUJABLES del período, ya filtrados (los descartes de arriba y los filtros de la hoja).
 * Los filtros se aplican con `filtrarFilas` sobre las dimensiones del conjunto `toques`: una sola regla.
 */
async function recorrerToques(
  v: VentanaMapa, filtros: Filtro[], cada: (f: FilaToque, url: string, disp: Dispositivo) => void,
): Promise<void> {
  const db = await getTenantDb();
  const b = bordes(v);
  const juntados: Array<{ f: FilaToque; url: string; disp: Dispositivo; fila: Fila }> = [];
  await leerPorPaginas<FilaToque>(db, 'vsl_events', COLS, (filas) => {
    for (const f of filas) {
      if (f.prueba) continue;
      if (f.tipo_evento !== 'click' && f.tipo_evento !== 'clic_vacio') continue;
      if (esPreviewDeEditor(f.landing_url ?? '')) continue;
      if (esSelloDelConstructor(f.sel)) continue;
      if (f.tipo_evento === 'click' && esClicDelConstructor(f.detalle)) continue;
      const fecha = hoyEnTijuana(new Date(f.created_at));
      if (fecha < v.desde || fecha > v.hasta) continue;
      const url = norm(f.landing_url);
      const disp = dispositivoDe(f.ancho_ventana);
      if (!url || !disp || typeof f.clic_x !== 'number' || typeof f.clic_y !== 'number') continue;
      const tipo = f.tipo_evento as 'click' | 'clic_vacio';
      const etiqueta = etiquetaDe(f);
      const d = dimensionesDeToque({ pagina: ruta(f.landing_url), lugar: rotuloDe({ tipo, etiqueta }), tipo, disp });
      juntados.push({ f, url, disp, fila: { f: fecha, d, v: {} } });
    }
  }, { orden: 'id', filtros: (q) => q.not('clic_x', 'is', null).gte('created_at', b.desde).lt('created_at', b.hasta) });
  const pasan = filtros.length ? new Set(filtrarFilas(juntados.map((j) => j.fila), filtros)) : null;
  for (const j of juntados) if (!pasan || pasan.has(j.fila)) cada(j.f, j.url, j.disp);
}

/** Qué se tocó, para el ranking: el destino del botón, o la etiqueta del elemento (sin texto, desde el snippet). */
const etiquetaDe = (f: Pick<FilaToque, 'detalle' | 'tipo_evento'>): string =>
  (f.detalle ?? '').slice(0, 120) || (f.tipo_evento === 'clic_vacio' ? 'vacio' : 'clic');

export type PaginaDelMapa = { url: string; movil: number; escritorio: number; declarada: boolean };

/**
 * Las páginas que se pueden elegir. Con `declaradas` (la tab vieja) se suman las que el negocio declaró aunque
 * no tengan toques; el Dashboard pide sólo las que tienen toques en el período y con los filtros de la hoja.
 */
export async function paginasDelMapa(
  ventana: VentanaMapa = ventanaDeDias(), filtros: Filtro[] = [], opts: { declaradas?: boolean } = { declaradas: true },
): Promise<PaginaDelMapa[]> {
  const m = new Map<string, PaginaDelMapa>();
  const de = (url: string) => {
    let p = m.get(url);
    if (!p) { p = { url, movil: 0, escritorio: 0, declarada: false }; m.set(url, p); }
    return p;
  };
  if (opts.declaradas) {
    for (const l of await landingsDelWorkspace()) {
      const u = norm(l.url);
      if (u && !esPreviewDeEditor(l.url)) de(u).declarada = true;
    }
  }
  await recorrerToques(ventana, filtros, (_f, url, disp) => { de(url)[disp]++; });
  return [...m.values()].sort((a, b) => (b.movil + b.escritorio) - (a.movil + a.escritorio) || Number(b.declarada) - Number(a.declarada) || (a.url < b.url ? -1 : 1));
}

export type DatosDelMapa = {
  url: string;
  disp: Dispositivo;
  /** El período que se miró (fechas de Tijuana) y cuántos días son. */
  desde: string;
  hasta: string;
  dias: number;
  toques: ToqueMapa[];
  personas: number;
  /** Clics de esta página en la ventana que NO traen su punto (Pixel anterior a la v20). */
  sinPunto: number;
  /** La versión del Pixel que mide ESTA página (`versionDeLaPagina`). */
  version: number | null;
};

/**
 * La versión del Pixel de UNA página, sin leer miles de visitas: la de su visita más nueva (`verificarPagina`,
 * que desde el 12/10/2026 es UNA consulta acotada) y la del mapa por página que anota el beacon en cada
 * pageview (`landing.snippet_versiones`, lo que también lee `estadoPixel`). Gana la más alta: quien acaba de
 * actualizar el código puede tener la versión nueva en el mapa antes de que la visita más nueva la traiga.
 * `null` si ninguna de las dos lo sabe (y «no pude leer» tampoco inventa un número).
 */
async function versionDeLaPagina(url: string): Promise<number | null> {
  const [deVisitas, mapa] = await Promise.all([
    verificarPagina(url).then((x) => x.version).catch(() => null),
    getSetting(VERSIONES_POR_PAGINA_KEY).then((c) => parsearMapaVersiones(c)).catch(() => ({} as ReturnType<typeof parsearMapaVersiones>)),
  ]);
  const k = clavePagina(url);
  const delMapa = k ? mapa[k]?.v ?? null : null;
  const vs = [deVisitas, delMapa].filter((x): x is number => typeof x === 'number' && x > 0);
  return vs.length ? Math.max(...vs) : null;
}

/** Los toques de una página en un dispositivo. */
export async function datosDelMapa(
  urlCruda: string, disp: Dispositivo, ventana: VentanaMapa = ventanaDeDias(), filtros: Filtro[] = [],
): Promise<DatosDelMapa> {
  const url = norm(urlCruda);
  if (!url) throw new Error('Esa dirección no parece una página web.');
  const toques: ToqueMapa[] = [];
  const indice = new Map<string, number>();
  await recorrerToques(ventana, filtros, (f, u, d) => {
    if (u !== url || d !== disp) return;
    const vid = f.visitor_id ?? `anon-${toques.length}`;
    let p = indice.get(vid);
    if (p === undefined) { p = indice.size; indice.set(vid, p); }
    toques.push({
      tipo: f.tipo_evento as ToqueMapa['tipo'],
      x: f.clic_x as number, y: f.clic_y as number, vw: f.ancho_ventana as number, dh: f.alto_pagina,
      // Sólo el selector anclado: uno suelto apunta a otro elemento (ver `selAnclado`).
      sel: selAnclado(f.sel), rx: f.rel_x, ry: f.rel_y, vh: f.alto_ventana, fijo: f.fijo,
      // El clic a un botón trae su destino; el toque al vacío sólo la etiqueta del
      // elemento (sin texto, por privacidad desde el snippet).
      etiqueta: etiquetaDe(f),
      p,
    });
  });

  // Los clics SIN punto de la misma página: es lo que explica un mapa vacío.
  // Leídos con el índice parcial de los clics (mig 0133) y filtrados en memoria.
  let sinPunto = 0;
  const db = await getTenantDb();
  const b = bordes(ventana);
  type FilaSin = { created_at: string; landing_url: string | null; prueba: string | null; detalle: string | null };
  await leerPorPaginas<FilaSin>(db, 'vsl_events', 'id, created_at, landing_url, prueba, detalle', (filas) => {
    for (const f of filas) {
      if (f.prueba || esClicDelConstructor(f.detalle)) continue;
      const fecha = hoyEnTijuana(new Date(f.created_at));
      if (fecha < ventana.desde || fecha > ventana.hasta) continue;
      if (norm(f.landing_url) === url) sinPunto++;
    }
  }, { orden: 'id', eq: { tipo_evento: 'click' }, filtros: (q) => q.is('clic_x', null).gte('created_at', b.desde).lt('created_at', b.hasta) });

  const version = await versionDeLaPagina(url);

  return { url, disp, desde: ventana.desde, hasta: ventana.hasta, dias: diasDe(ventana), toques, personas: indice.size, sinPunto, version };
}

export type FondoDelMapa =
  | { ok: true; html: string; ancho: number; alto: number; grabada: string }
  | { ok: false; motivo: 'sin_grabaciones' | 'sin_foto' };

/** Cuántas grabaciones se prueban antes de rendirse: cada una es una bajada.
 *  Medido el 06/10/2026 en el ws1: de las 4 más nuevas, 3 no tenían foto. */
const TOPE_INTENTOS = 12;

/**
 * La foto de la página para el fondo: una grabación de esa página y ese dispositivo que tenga foto completa.
 *
 * El ancho de la ventana no está en la fila de la sesión (vive adentro del
 * cuerpo), así que se prueba de la más nueva a la más vieja, con tope. Una sin foto
 * (3 de 13, medido) o de otro dispositivo se saltea.
 *
 * ⚠️ CON `anchoPreferido` (el ancho más común entre los toques, 12/10/2026) gana la grabación de ESE ancho, y si
 * ninguna lo tiene, la más cercana. La más nueva puede ser de una pantalla rara (medido en el ws1: 320 px), y
 * los toques sin ancla se reparten contra el ancho de la foto.
 */
export async function fondoDelMapa(urlCruda: string, disp: Dispositivo, anchoPreferido?: number | null): Promise<FondoDelMapa> {
  const url = norm(urlCruda);
  if (!url) return { ok: false, motivo: 'sin_grabaciones' };
  // ⚠️ LA PÁGINA SE FILTRA EN LA CONSULTA, no después. Antes se traían las 200 sesiones
  // más nuevas de TODO el workspace y recién ahí se buscaba la página: a una con poco
  // tráfico al lado de otra con mucho se le decía «no hay grabación» teniéndolas
  // (revisión del 06/10/2026). El `ilike` trae CANDIDATOS —sin `www.`, con el query que
  // sea— y quién es esta página lo sigue decidiendo `norm` con una igualdad exacta.
  const u = new URL(url);
  const pista = `${u.hostname.replace(/^www\./, '')}${u.pathname}`.replace(/[\\%_]/g, (c) => `\\${c}`);
  const db = await getTenantDb();
  const { data, error } = await db
    .from('replay_sesiones')
    .select('id, landing_url, inicio')
    .not('storage_path', 'is', null)
    .is('descarte', null)
    .ilike('landing_url', `%${pista}%`)
    // ⚠️ LAS PRUEBAS SÍ SIRVEN DE FONDO (06/10/2026). Para contar toques no (es quien
    // estaba probando el Pixel), pero la foto de la página es la misma: medido en el
    // ws1, la ÚNICA grabación de computadora de su portada era la de la prueba, y
    // sin ella el mapa de computadora no tenía fondo.
    .order('inicio', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const candidatas = (data ?? []).filter((s) => norm(s.landing_url as string | null) === url);
  if (!candidatas.length) return { ok: false, motivo: 'sin_grabaciones' };
  const quiere = typeof anchoPreferido === 'number' && anchoPreferido > 0 ? Math.round(anchoPreferido) : null;
  let mejor: { foto: NonNullable<ReturnType<typeof fotoDeEventos>>; inicio: string } | null = null;
  for (const s of candidatas.slice(0, TOPE_INTENTOS)) {
    const cuerpo = await cuerpoDeSesion(String(s.id));
    if (!cuerpo.ok) continue;
    const foto = fotoDeEventos(cuerpo.texto);
    if (!foto || dispositivoDe(foto.ancho) !== disp) continue;
    if (quiere == null || foto.ancho === quiere) {
      return { ok: true, html: htmlDeFoto(foto), ancho: foto.ancho, alto: foto.alto, grabada: String(s.inicio) };
    }
    if (!mejor || Math.abs(foto.ancho - quiere) < Math.abs(mejor.foto.ancho - quiere)) mejor = { foto, inicio: String(s.inicio) };
  }
  if (mejor) return { ok: true, html: htmlDeFoto(mejor.foto), ancho: mejor.foto.ancho, alto: mejor.foto.alto, grabada: mejor.inicio };
  return { ok: false, motivo: 'sin_foto' };
}
