// =============================================================================
// editor-landing/replica-borrador — lo leído para replicar queda como BORRADOR (ticket #54, 4/11/2026)
// =============================================================================
// Leandro (ws 10), por el chat de soporte: «quise volver para atrás, y cuando quise volver a la página que se estaba
// analizando […] se me borró completamente la página analizada […] no me quedó ni siquiera en formato borrador. […] lo que
// haría no sería que se borre, sino de que quede en estado borrador».
//
// LA CAUSA: la lectura (la estructura, los ángulos y el diseño de la página de afuera, que paga IA) vivía SÓLO en la
// pantalla (`useLeerParaReplicar`, app/web-generator/crear/Replicar.tsx) y la ruta de lectura lo decía: «No escribe nada».
// Cualquier cosa que desmontara la vista se la llevaba: en el editor, el botón de MaKo de la lista de landings vuelve al chat
// y cierra «Nueva landing» (EditorLanding.tsx, `setPanelIzq('agente')`); también ir a otra landing, el «atrás» del navegador o
// recargar. Y la copia todavía no existía, así que no quedaba nada.
//
// AHORA: la ruta de lectura guarda lo leído como un borrador DEL NEGOCIO, por dirección (app_settings, sin migración), con lo
// que la persona eligió (qué replicar, el formato, el tema y «Tu oferta»). Abrir esa dirección otra vez lo retoma sin volver a
// leer (sin pagar IA otra vez), la lista de landings del editor muestra las réplicas sin terminar, y la réplica creada borra su
// borrador (la copia ya es la landing). Lo que guarda y lee la base: ./replica-borrador-server.ts.
//
// ⚠️ PURO (sin `server-only`): lo importan el servidor, la pantalla y los tests. La lectura del navegador (`fuente.lectura`) se
// sanea en el servidor con `sanearLectura` (lectura-reglas.ts, que es del servidor).
// =============================================================================

import type { LecturaReplica, DisenoLeido } from './replicar-lectura-tipos';
import type { MoldeSeccion } from './replicar-estructura';
import { sanearAngulos } from './replicar-angulos';
import { PARTES_ADAPTAR, PARTES_REPLICA, PARTES_TODAS, formatoConPartes, partesDePedido, listaDePartes, type ParteReplica, type PartesReplica } from './replicar-partes';
import { formatoReplicar, urlParaReplicar, type FormatoReplicar } from './replicar-reglas';

/** La clave de cada borrador en `app_settings`: el prefijo y un hash de la dirección (la dirección va adentro del valor). */
export const PREFIJO_BORRADOR_REPLICA = 'landing.replica_borrador:';
/** Cuántos borradores guarda un negocio (los más nuevos). Un borrador no es una landing: es lo leído, a la espera. */
export const TOPE_BORRADORES_REPLICA = 8;
/** Un borrador que no se tocó en este tiempo ya no se ofrece (y se borra al guardar otro). */
export const DIAS_BORRADOR_REPLICA = 30;
/** Lo que se acepta de «Tu oferta» (el `TOPE_OFERTA_PANTALLA` de la pantalla). */
export const TOPE_OFERTA_BORRADOR = 1_200;
/** El texto pegado que se guarda (el de la lectura: `MAX_TEXTO` de replicar-lectura.ts). */
export const TOPE_TEXTO_BORRADOR = 60_000;

/** Lo que eligió la persona en «Qué replicar». */
export type EleccionReplica = { partes: ParteReplica[]; formato: FormatoReplicar | null; oferta: string; tema: string | null; adaptar: boolean };

/** De dónde salió el texto de la página cuando el servidor no la pudo leer solo: lo leído en el navegador o lo pegado. */
export type FuenteBorrador = { lectura: unknown | null; texto: string | null };

export type BorradorReplica = {
  v: 1;
  url: string;
  lectura: LecturaReplica;
  fuente: FuenteBorrador;
  eleccion: EleccionReplica;
  creado: string;
  actualizado: string;
};

/** Lo que se lista (sin la lectura entera). */
export type ResumenBorrador = { url: string; titulo: string; host: string; adaptar: boolean; actualizado: string };

/**
 * Dos FNV-1a de 32 bits con semillas distintas, en hex (16 caracteres): sin `crypto` (corre igual en el navegador y en los
 * tests) y estable entre despliegues. Sin BigInt: el `target` del repo es ES2017. La dirección va además ADENTRO del valor y
 * se compara al leer, así que un choque no retoma la página de otro.
 */
function huella(s: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 13);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/** La clave del borrador de una dirección, o null si la dirección no es una página que se pueda replicar. */
export function claveDeBorrador(url: unknown): string | null {
  const u = urlParaReplicar(url);
  return u ? `${PREFIJO_BORRADOR_REPLICA}${huella(u)}` : null;
}

export const hostDeBorrador = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

const texto = (v: unknown, tope: number): string => (typeof v === 'string' ? v.slice(0, tope) : '');
const entero = (v: unknown): number => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, 100_000) : 0; };
/** Un color que se pinta con `style={{ background }}`: sólo hex o rgb/hsl, nunca `url(...)` ni otra cosa. */
const COLOR_RE = /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%/]+\))$/i;

function sanearMolde(raw: unknown): MoldeSeccion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const titulo = texto(o.titulo, 300);
  return {
    titulo, subtitulos: entero(o.subtitulos), parrafos: entero(o.parrafos), vinetas: entero(o.vinetas),
    botones: entero(o.botones), desplegables: entero(o.desplegables), palabras: entero(o.palabras),
  };
}

function sanearDiseno(raw: unknown): DisenoLeido | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const colores = (Array.isArray(o.colores) ? o.colores : []).filter((c): c is string => typeof c === 'string' && COLOR_RE.test(c.trim())).map((c) => c.trim()).slice(0, 12);
  const fuentes = (Array.isArray(o.fuentes) ? o.fuentes : []).filter((f): f is string => typeof f === 'string').map((f) => f.slice(0, 80)).slice(0, 8);
  return { colores, fuentes, imagenes: entero(o.imagenes) };
}

/** La lectura guardada, otra vez con la forma que dibuja la pantalla. null si no se puede usar. */
export function sanearLecturaReplica(raw: unknown): LecturaReplica | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const url = urlParaReplicar(o.url);
  if (!url) return null;
  const secciones = (Array.isArray(o.secciones) ? o.secciones : []).map(sanearMolde).filter((m): m is MoldeSeccion => !!m).slice(0, 60);
  if (!secciones.length) return null;
  const angulos = sanearAngulos(o.angulos, secciones.length);
  return {
    url,
    titulo: texto(o.titulo, 300),
    secciones,
    angulos,
    ...(!angulos && typeof o.errorAngulos === 'string' ? { errorAngulos: o.errorAngulos.slice(0, 300) } : {}),
    diseno: sanearDiseno(o.diseno),
    ...(typeof o.tieneOferta === 'boolean' ? { tieneOferta: o.tieneOferta } : {}),
  };
}

/** Lo elegido, saneado. Sin partes válidas, las de siempre (todo; con `adaptar`, las de adaptar). */
export function sanearEleccion(raw: unknown): EleccionReplica {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const adaptar = o.adaptar === true;
  const partes = partesDePedido(o.partes, adaptar) ?? partesDePedido(undefined, adaptar)!;
  const tema = typeof o.tema === 'string' && /^[\w:.-]{1,80}$/.test(o.tema) ? o.tema : null;
  return { partes: listaDePartes(partes), formato: formatoReplicar(o.formato), oferta: texto(o.oferta, TOPE_OFERTA_BORRADOR), tema, adaptar };
}

/** Un borrador guardado, leído de vuelta (lo escribió el servidor, igual se sanea). null si no sirve o es de otra dirección. */
export function sanearBorrador(raw: unknown, url?: string): BorradorReplica | null {
  let o: unknown = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  const lectura = sanearLecturaReplica(r.lectura);
  if (!lectura) return null;
  const propia = urlParaReplicar(r.url) ?? lectura.url;
  if (url !== undefined && urlParaReplicar(url) !== propia) return null;
  const f = r.fuente && typeof r.fuente === 'object' ? (r.fuente as Record<string, unknown>) : {};
  const creado = typeof r.creado === 'string' && Number.isFinite(Date.parse(r.creado)) ? r.creado : new Date(0).toISOString();
  const actualizado = typeof r.actualizado === 'string' && Number.isFinite(Date.parse(r.actualizado)) ? r.actualizado : creado;
  return {
    v: 1, url: propia, lectura,
    fuente: { lectura: f.lectura && typeof f.lectura === 'object' ? f.lectura : null, texto: typeof f.texto === 'string' && f.texto.trim() ? f.texto.slice(0, TOPE_TEXTO_BORRADOR) : null },
    eleccion: sanearEleccion(r.eleccion),
    creado, actualizado,
  };
}

/** ¿Se sigue ofreciendo? Uno que no se tocó en `DIAS_BORRADOR_REPLICA` días, no. */
export const borradorVigente = (b: Pick<BorradorReplica, 'actualizado'>, ahora = Date.now()): boolean =>
  ahora - Date.parse(b.actualizado) <= DIAS_BORRADOR_REPLICA * 86_400_000;

export const resumenDeBorrador = (b: BorradorReplica): ResumenBorrador => ({
  url: b.url, titulo: b.lectura.titulo || hostDeBorrador(b.url), host: hostDeBorrador(b.url), adaptar: b.eleccion.adaptar, actualizado: b.actualizado,
});

/**
 * Qué borradores se borran al guardar otro: los que pasan del tope (los más viejos) y los vencidos. `filas` en cualquier
 * orden, con la fecha de su última vez.
 */
export function borradoresDeMas(filas: ReadonlyArray<{ clave: string; actualizado: string }>, ahora = Date.now()): string[] {
  const orden = [...filas].sort((a, b) => Date.parse(b.actualizado) - Date.parse(a.actualizado));
  return orden.filter((f, i) => i >= TOPE_BORRADORES_REPLICA || !borradorVigente(f, ahora)).map((f) => f.clave);
}

/**
 * ¿«Leer» vuelve a leer de verdad? Sólo sobre la página que ya está a la vista («Leer de nuevo»). Cualquier otra dirección
 * busca primero su borrador: si lo hay, se retoma sin leer (ni la ventana, ni la IA otra vez).
 */
export function esRelectura(aLaVista: string | null, url: string): boolean {
  if (!aLaVista) return false;
  const a = urlParaReplicar(aLaVista);
  return !!a && a === urlParaReplicar(url);
}

/** Lo elegido del borrador, como lo usa la pantalla: las partes, y un formato que vaya con ellas (todas = la copia idéntica). */
export function eleccionEnPantalla(e: EleccionReplica, formatoInicial: FormatoReplicar): { partes: PartesReplica; formato: FormatoReplicar; oferta: string; tema: string | null } {
  const partes = partesDePedido(e.partes, e.adaptar) ?? (e.adaptar ? PARTES_ADAPTAR : PARTES_TODAS);
  const todas = partes.diseno && partes.estructura && partes.angulos && partes.texto;
  const formato = todas ? 'web' : e.formato && formatoConPartes(e.formato, partes) ? e.formato : formatoInicial;
  return { partes, formato, oferta: e.oferta, tema: e.tema };
}

/** Lo que la pantalla le muestra a quien retoma: cuándo lo leyó. */
export function lineaDeRetomado(actualizado: string, zona?: string): string {
  const d = new Date(actualizado);
  if (!Number.isFinite(d.getTime())) return 'Retomaste lo que ya habías leído.';
  const cuando = d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...(zona ? { timeZone: zona } : {}) });
  return `Retomaste lo que leíste el ${cuando}: no se volvió a leer.`;
}

export { PARTES_REPLICA };
