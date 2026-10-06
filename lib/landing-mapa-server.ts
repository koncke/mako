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
// negocio), las pruebas del Pixel (`prueba` no nulo: es quien lo estaba probando)
// y el sello del constructor («Edit with…»). Los eventos quedan en la base.
// =============================================================================
import { getTenantDb } from './workspace';
import { leerPorPaginas } from './supabase-paginado';
import { esClicDelConstructor } from './clic-ruido';
import { normalizarUrl, esPreviewDeEditor } from './landing-paginas';
import { landingsDelWorkspace } from './landing-config-leer';
import { verificarPagina } from './landing-token';
import { cuerpoDeSesion } from './replay-leer';
import { dispositivoDe, MAPA_DIAS, type Dispositivo, type ToqueMapa } from './landing-mapa';
import { fotoDeEventos, htmlDeFoto } from './landing-mapa-foto';

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

type FilaToque = {
  visitor_id: string | null; landing_url: string | null; tipo_evento: string; detalle: string | null;
  clic_x: number | null; clic_y: number | null; ancho_ventana: number | null; alto_pagina: number | null;
  sel: string | null; rel_x: number | null; rel_y: number | null; alto_ventana: number | null; fijo: boolean | null;
  prueba: string | null;
};
const COLS = 'id, visitor_id, landing_url, tipo_evento, detalle, clic_x, clic_y, ancho_ventana, alto_pagina, sel, rel_x, rel_y, alto_ventana, fijo, prueba';

/** Recorre los toques DIBUJABLES de la ventana, ya filtrados. */
async function recorrerToques(dias: number, cada: (f: FilaToque, url: string, disp: Dispositivo) => void): Promise<void> {
  const db = await getTenantDb();
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  await leerPorPaginas<FilaToque>(db, 'vsl_events', COLS, (filas) => {
    for (const f of filas) {
      if (f.prueba) continue;
      if (f.tipo_evento !== 'click' && f.tipo_evento !== 'clic_vacio') continue;
      if (esPreviewDeEditor(f.landing_url ?? '')) continue;
      if (f.tipo_evento === 'click' && esClicDelConstructor(f.detalle)) continue;
      const url = norm(f.landing_url);
      const disp = dispositivoDe(f.ancho_ventana);
      if (!url || !disp || typeof f.clic_x !== 'number' || typeof f.clic_y !== 'number') continue;
      cada(f, url, disp);
    }
  }, { orden: 'id', filtros: (q) => q.not('clic_x', 'is', null).gte('created_at', desde) });
}

export type PaginaDelMapa = { url: string; movil: number; escritorio: number; declarada: boolean };

/** Las páginas que se pueden elegir: las declaradas y las que tienen toques. */
export async function paginasDelMapa(dias = MAPA_DIAS): Promise<PaginaDelMapa[]> {
  const m = new Map<string, PaginaDelMapa>();
  const de = (url: string) => {
    let p = m.get(url);
    if (!p) { p = { url, movil: 0, escritorio: 0, declarada: false }; m.set(url, p); }
    return p;
  };
  for (const l of await landingsDelWorkspace()) {
    const u = norm(l.url);
    if (u && !esPreviewDeEditor(l.url)) de(u).declarada = true;
  }
  await recorrerToques(dias, (_f, url, disp) => { de(url)[disp]++; });
  return [...m.values()].sort((a, b) => (b.movil + b.escritorio) - (a.movil + a.escritorio) || Number(b.declarada) - Number(a.declarada) || (a.url < b.url ? -1 : 1));
}

export type DatosDelMapa = {
  url: string;
  disp: Dispositivo;
  dias: number;
  toques: ToqueMapa[];
  personas: number;
  /** Clics de esta página en la ventana que NO traen su punto (Pixel anterior a la v20). */
  sinPunto: number;
  /** La versión del Pixel que mide ESTA página (la de su visita más nueva). */
  version: number | null;
};

/** Los toques de una página en un dispositivo. */
export async function datosDelMapa(urlCruda: string, disp: Dispositivo, dias = MAPA_DIAS): Promise<DatosDelMapa> {
  const url = norm(urlCruda);
  if (!url) throw new Error('Esa dirección no parece una página web.');
  const toques: ToqueMapa[] = [];
  const indice = new Map<string, number>();
  await recorrerToques(dias, (f, u, d) => {
    if (u !== url || d !== disp) return;
    const vid = f.visitor_id ?? `anon-${toques.length}`;
    let p = indice.get(vid);
    if (p === undefined) { p = indice.size; indice.set(vid, p); }
    toques.push({
      tipo: f.tipo_evento as ToqueMapa['tipo'],
      x: f.clic_x as number, y: f.clic_y as number, vw: f.ancho_ventana as number, dh: f.alto_pagina,
      sel: f.sel, rx: f.rel_x, ry: f.rel_y, vh: f.alto_ventana, fijo: f.fijo,
      // El clic a un botón trae su destino; el toque al vacío sólo la etiqueta del
      // elemento (sin texto, por privacidad desde el snippet).
      etiqueta: (f.detalle ?? '').slice(0, 120) || (f.tipo_evento === 'clic_vacio' ? 'vacio' : 'clic'),
      p,
    });
  });

  // Los clics SIN punto de la misma página: es lo que explica un mapa vacío.
  // Leídos con el índice parcial de los clics (mig 0133) y filtrados en memoria.
  let sinPunto = 0;
  const db = await getTenantDb();
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  type FilaSin = { landing_url: string | null; prueba: string | null; detalle: string | null };
  await leerPorPaginas<FilaSin>(db, 'vsl_events', 'id, landing_url, prueba, detalle', (filas) => {
    for (const f of filas) {
      if (f.prueba || esClicDelConstructor(f.detalle)) continue;
      if (norm(f.landing_url) === url) sinPunto++;
    }
  }, { orden: 'id', eq: { tipo_evento: 'click' }, filtros: (q) => q.is('clic_x', null).gte('created_at', desde) });

  let version: number | null = null;
  try { version = (await verificarPagina(url)).version; } catch { version = null; }

  return { url, disp, dias, toques, personas: indice.size, sinPunto, version };
}

export type FondoDelMapa =
  | { ok: true; html: string; ancho: number; alto: number; grabada: string }
  | { ok: false; motivo: 'sin_grabaciones' | 'sin_foto' };

/** Cuántas grabaciones se prueban antes de rendirse: cada una es una bajada.
 *  Medido el 06/10/2026 en el ws1: de las 4 más nuevas, 3 no tenían foto. */
const TOPE_INTENTOS = 12;

/**
 * La foto de la página para el fondo: la grabación MÁS NUEVA de esa página y ese
 * dispositivo que tenga foto completa.
 *
 * El ancho de la ventana no está en la fila de la sesión (vive adentro del
 * cuerpo), así que se prueba de la más nueva a la más vieja, con tope. Una sin foto
 * (3 de 13, medido) o de otro dispositivo se saltea.
 */
export async function fondoDelMapa(urlCruda: string, disp: Dispositivo): Promise<FondoDelMapa> {
  const url = norm(urlCruda);
  if (!url) return { ok: false, motivo: 'sin_grabaciones' };
  const db = await getTenantDb();
  const { data, error } = await db
    .from('replay_sesiones')
    .select('id, landing_url, inicio')
    .not('storage_path', 'is', null)
    .is('descarte', null)
    // ⚠️ LAS PRUEBAS SÍ SIRVEN DE FONDO (06/10/2026). Para contar toques no (es quien
    // estaba probando el Pixel), pero la foto de la página es la misma: medido en el
    // ws1, la ÚNICA grabación de computadora de su portada era la de la prueba, y
    // sin ella el mapa de computadora no tenía fondo.
    .order('inicio', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const candidatas = (data ?? []).filter((s) => norm(s.landing_url as string | null) === url);
  if (!candidatas.length) return { ok: false, motivo: 'sin_grabaciones' };
  for (const s of candidatas.slice(0, TOPE_INTENTOS)) {
    const cuerpo = await cuerpoDeSesion(String(s.id));
    if (!cuerpo.ok) continue;
    const foto = fotoDeEventos(cuerpo.texto);
    if (!foto || dispositivoDe(foto.ancho) !== disp) continue;
    return { ok: true, html: htmlDeFoto(foto), ancho: foto.ancho, alto: foto.alto, grabada: String(s.inicio) };
  }
  return { ok: false, motivo: 'sin_foto' };
}
