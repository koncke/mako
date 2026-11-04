// =============================================================================
// carruseles/biblioteca — la biblioteca de carruseles de EJEMPLO, compartida por todos los negocios (4/11/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro, 4/11/2026): que el explorador de carruseles de Image arranque con una base real de
// ejemplos, aunque el negocio no siga a nadie en Competitors Spy. Se SUMA a lo de las cuentas que sigue cada negocio.
//
// DE DÓNDE: Instagram directo, con la MISMA lectura de Spy (el actor `apify~instagram-scraper`, lib/spy-todo-reglas.ts, y
// `piezasDeApify`, lib/instagram-perfil.ts), desde un script de la PC (scripts/carruseles-biblioteca.mts) con techo de
// gasto. Dos fuentes, las dos editables por la plataforma:
//   · una LISTA de cuentas (para arrancar, los referentes del Ops Center que tengan Instagram): se leen enteras, así sus
//     carruseles llevan el outlier de su cuenta, como en Spy;
//   · TEMAS (hashtags pensados para los negocios de MaKo): de cada uno se toman sólo los CARRUSELES, ordenados por
//     rendimiento (me gusta + comentarios), sin repetidos. Esos no llevan outlier: no se leyó su cuenta, y lo que no se
//     midió no se dice.
// Cada publicación queda clasificada por tipo (lista, tutorial, historia…: `formatoPorTexto`, lib/spy-detalle.ts) y con lo
// que pide al final (`cierreDeTexto`), leídos al guardarla: el texto vence a los 30 días y lo leído de él no.
// NUNCA de otra biblioteca de carruseles: ni topcarousels.com, ni su /explore, ni su lista de cuentas.
//
// CÓMO SE MUESTRA: como en Spy (decisión de Martín, 4/11/2026), público, con el @ del creador a la vista y el link a la
// publicación original. Nunca como plantilla de MaKo: «Hacer el mío» usa sólo la estructura. Un creador que pide salir se
// saca (`excluida`) y deja de verse en todos los negocios, haya llegado por la lista o por un tema.
//
// ⚠️ LOS IDS VAN EN NEGATIVO. El explorador junta lo de Spy (`spy_piezas.id`, positivo) y lo de la biblioteca: con el id en
// negativo, los guardados del negocio, «Hacer el mío», el filtro por cuenta y la API usan UN número sin chocar.
//
// Puro (sin `server-only`): lo usan el servidor (./biblioteca-servidor.ts), el script de la PC y los tests.
// =============================================================================

import { usuarioInstagram } from '@/app/crm/campo-inline';
import type { PiezaInstagram } from '../instagram-perfil';
import { formatoDe, formatoPorTexto } from '../spy-detalle';
import { medioDeInstagram } from '../spy-medio';
import { USD_POR_PUBLICACION } from '../spy-todo-reglas';
import { carruselesDe, plano, type Carrusel, type CompetidorParaCarrusel, type PiezaParaCarrusel } from './explorar';
import { cierreDeTexto, esCierre, type Cierre } from './texto';

export type EstadoCuentaBiblioteca = 'activa' | 'excluida';
/** 'lista': la eligió la plataforma y se lee entera. 'tema': apareció por un hashtag y no se lee sola. */
export type FuenteCuentaBiblioteca = 'lista' | 'tema';

/** Un creador de la biblioteca, como lo guarda la base (`carruseles_biblioteca_cuentas`). */
export type CuentaBiblioteca = {
  id: number;
  instagram: string;
  nombre: string;
  fuente: FuenteCuentaBiblioteca;
  referente: string | null;
  estado: EstadoCuentaBiblioteca;
  motivo: string | null;
  foto: string | null;
  leida_en: string | null;
};

/** Un tema (hashtag), como lo guarda la base (`carruseles_biblioteca_temas`). */
export type TemaBiblioteca = { id: number; hashtag: string; nombre: string; activo: boolean; leido_en: string | null };

/** Una publicación de la biblioteca, como la guarda la base (`carruseles_biblioteca_piezas`). */
export type PiezaBiblioteca = {
  id: number;
  ref: string;
  cuenta_id: number;
  tema_id: number | null;
  url: string | null;
  miniatura: string | null;
  texto: string | null;
  texto_leido_en?: string | null;
  formato: string | null;
  cierre: string | null;
  medio: string | null;
  laminas: number | null;
  megusta: number | null;
  comentarios: number | null;
  vistas: number | null;
  metricas_leidas_en?: string | null;
  publicada_en: string | null;
  visto_primera_vez: string;
  dejo_de_verse_en: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Los ids
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Este id del explorador es de la biblioteca? (Los de Spy son positivos.) */
export const esDeBiblioteca = (id: number): boolean => Number.isSafeInteger(id) && id < 0;
/** El id del explorador de una fila de la biblioteca (publicación o creador). */
export const idDeBiblioteca = (fila: number): number => -Math.abs(fila);
/** La fila de la biblioteca de un id del explorador (null si no es de la biblioteca). */
export const filaDeBiblioteca = (id: number): number | null => (esDeBiblioteca(id) ? -id : null);

// ─────────────────────────────────────────────────────────────────────────────
// De la base al explorador
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las publicaciones de la biblioteca como carruseles del explorador. Sólo de creadores activos. El outlier, sólo de los de
 * la LISTA (se leyó su cuenta: el mismo cálculo de Spy); de los que llegaron por un tema, null. El tipo y el cierre, los
 * guardados al leer (el texto puede haber vencido).
 */
export function carruselesDeBiblioteca(piezas: readonly PiezaBiblioteca[], cuentas: readonly CuentaBiblioteca[], ahora = Date.now()): Carrusel[] {
  const activas = new Map(cuentas.filter((c) => c.estado === 'activa').map((c) => [c.id, c]));
  const competidores: CompetidorParaCarrusel[] = [...activas.values()].map((c) => ({ id: idDeBiblioteca(c.id), nombre: c.nombre, instagram: c.instagram, avatar: c.foto }));
  const guardado = new Map<number, PiezaBiblioteca>();
  const comoSpy: PiezaParaCarrusel[] = [];
  for (const p of piezas) {
    if (!activas.has(p.cuenta_id)) continue;
    guardado.set(idDeBiblioteca(p.id), p);
    comoSpy.push({
      id: idDeBiblioteca(p.id), competidor_id: idDeBiblioteca(p.cuenta_id), canal: 'instagram', tipo: 'publicacion', url: p.url,
      texto: p.texto, analisis: p.formato ? { formato: p.formato } : null, vistas: p.vistas, megusta: p.megusta, comentarios: p.comentarios,
      publicada_en: p.publicada_en, visto_primera_vez: p.visto_primera_vez, dejo_de_verse_en: p.dejo_de_verse_en, miniatura: p.miniatura,
      medio: p.medio, laminas: p.laminas,
    });
  }
  return carruselesDe(comoSpy, competidores, ahora, 'biblioteca').map((c) => {
    const p = guardado.get(c.id);
    const deLaLista = p ? activas.get(p.cuenta_id)?.fuente === 'lista' : false;
    const cierre = p && esCierre(p.cierre) ? p.cierre : c.cierre;
    return { ...c, outlier: deLaLista ? c.outlier : null, cierre };
  });
}

/** Cuántos carruseles de la biblioteca llegan al explorador: viajan todos al navegador, que filtra y ordena ahí. */
export const CARRUSELES_EN_EXPLORADOR = 800;
/** Lo publicado en estos días entra siempre (si cabe): sin eso, «Esta semana» quedaría vacía con una biblioteca grande. */
const DIAS_RECIENTES = 14;

/**
 * Lo que de la biblioteca llega al explorador. Sólo carruseles: las imágenes sueltas de una cuenta de la lista se guardan para
 * su mediana (el outlier) y no son ejemplos. Si pasan el tope, primero lo de los últimos 14 días y después lo que mejor rindió
 * (el outlier; sin outlier, la interacción). Lo que no se midió va después de lo medido, nunca como un cero.
 */
export function recortarBiblioteca(cs: readonly Carrusel[], tope = CARRUSELES_EN_EXPLORADOR, ahora = Date.now()): Carrusel[] {
  const carruseles = cs.filter((c) => c.medio !== 'imagen');
  if (carruseles.length <= tope) return carruseles;
  const reciente = (c: Carrusel) => Date.parse(c.publicada ?? '') >= ahora - DIAS_RECIENTES * 86_400_000;
  const inter = (c: Carrusel) => (c.megusta ?? 0) + (c.comentarios ?? 0);
  return [...carruseles]
    .sort((a, b) => Number(reciente(b)) - Number(reciente(a)) || (b.outlier ?? -1) - (a.outlier ?? -1) || inter(b) - inter(a) || a.id - b.id)
    .slice(0, Math.max(0, tope));
}

/** La clave de una publicación para no mostrarla dos veces: su link, sin `?` ni barra final. */
function claveDePublicacion(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Lo del negocio y la biblioteca, juntos. Si el negocio sigue en Spy a alguien que también está en la biblioteca, su
 * publicación sale UNA vez y como suya (la del negocio, con su análisis en Spy).
 */
export function unirConBiblioteca(propios: readonly Carrusel[], biblioteca: readonly Carrusel[]): Carrusel[] {
  const ya = new Set(propios.map((c) => claveDePublicacion(c.url)).filter((k): k is string => !!k));
  return [...propios, ...biblioteca.filter((c) => { const k = claveDePublicacion(c.url); return !k || !ya.has(k); })];
}

// ─────────────────────────────────────────────────────────────────────────────
// La lista y los temas: sumar, sacar, volver
// ─────────────────────────────────────────────────────────────────────────────

/** El @ como se guarda: sin arroba, en minúscula, y sólo si es un usuario de Instagram válido (la regla del alta del CRM). */
export function cuentaDeInstagram(texto: string | null | undefined): string | null {
  const u = usuarioInstagram(texto)?.toLowerCase() ?? null;
  return u && /^[a-z0-9._]{1,30}$/.test(u) ? u : null;
}

/** El hashtag como se guarda: sin #, en minúscula, letras (con tildes y ñ), números y guion bajo. */
export function hashtagDe(texto: string | null | undefined): string | null {
  const t = String(texto ?? '').trim().replace(/^#+/, '').toLowerCase().normalize('NFC');
  const sinLink = t.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/explore\/tags\/([^/?#]+).*$/, '$1');
  return /^[a-z0-9_ñáéíóúü]{2,60}$/.test(sinLink) ? sinLink : null;
}

export type CambioBiblioteca =
  | { que: 'cuenta'; accion: 'sumar'; valor: string; nombre: string; referente?: string | null }
  | { que: 'cuenta'; accion: 'sacar'; valor: string; motivo: string }
  | { que: 'cuenta'; accion: 'volver'; valor: string }
  | { que: 'tema'; accion: 'sumar'; valor: string; nombre: string }
  | { que: 'tema'; accion: 'sacar' | 'volver'; valor: string };

export type DecisionCambio = { hacer: 'insertar' | 'excluir' | 'excluir-nuevo' | 'reactivar' | 'a-la-lista' } | { ya: string } | { error: string };

/**
 * Qué hacer con un pedido de cambio, contra la fila que ya hay (o null).
 *   · Un creador que pidió salir no vuelve con un «sumar»: hace falta un «volver» explícito (así ni un script ni una
 *     persona lo suman de nuevo sin querer).
 *   · Sacar a un creador que NO está (uno que puede llegar por un tema) lo anota como fuera igual: no entra nunca.
 *   · Sumar a la lista a uno que llegó por un tema lo pasa a la lista (se leerá entero).
 *   · Un tema que se saca se apaga (no se lee más); lo que ya trajo queda.
 */
export function decidirCambio(c: CambioBiblioteca, fila: { estado?: EstadoCuentaBiblioteca; fuente?: FuenteCuentaBiblioteca; activo?: boolean } | null): DecisionCambio {
  const nombre = c.que === 'cuenta' ? `@${c.valor}` : `#${c.valor}`;
  if (c.accion === 'sumar') {
    if (!c.nombre.trim()) return { error: 'Falta el nombre.' };
    if (!fila) return { hacer: 'insertar' };
    if (c.que === 'tema') return fila.activo ? { ya: `${nombre} ya está en la biblioteca.` } : { error: `${nombre} está apagado. Para usarlo otra vez, «Volver a sumar».` };
    if (fila.estado === 'excluida') return { error: `${nombre} salió de la biblioteca porque lo pidió. Para sumarla otra vez, «Volver a sumar».` };
    return fila.fuente === 'tema' ? { hacer: 'a-la-lista' } : { ya: `${nombre} ya está en la biblioteca.` };
  }
  if (c.accion === 'sacar') {
    if (c.que === 'cuenta' && !c.motivo.trim()) return { error: 'Di por qué sale (por ejemplo, «lo pidió»).' };
    if (!fila) return c.que === 'cuenta' ? { hacer: 'excluir-nuevo' } : { error: `${nombre} no está en la biblioteca.` };
    const fuera = c.que === 'cuenta' ? fila.estado === 'excluida' : !fila.activo;
    return fuera ? { ya: `${nombre} ya estaba fuera de la biblioteca.` } : { hacer: 'excluir' };
  }
  if (!fila) return { error: `${nombre} no está en la biblioteca.` };
  const adentro = c.que === 'cuenta' ? fila.estado === 'activa' : !!fila.activo;
  return adentro ? { ya: `${nombre} ya está en la biblioteca.` } : { hacer: 'reactivar' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los temas de arranque
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los temas con que arranca la biblioteca, pensados para los negocios de MaKo (servicios de ticket alto: coaches,
 * consultores, agencias, cursos y mentorías) y en español. Son el punto de partida: la plataforma los cambia en la pantalla
 * («Cuentas» → «Biblioteca de ejemplos») o por la API. El script los siembra la primera vez, si la tabla está vacía.
 */
export const TEMAS_INICIALES: ReadonlyArray<{ hashtag: string; nombre: string }> = [
  { hashtag: 'marketingdigital', nombre: 'Marketing digital' },
  { hashtag: 'emprendimiento', nombre: 'Emprendimiento' },
  { hashtag: 'marcapersonal', nombre: 'Marca personal' },
  { hashtag: 'ventasonline', nombre: 'Ventas' },
  { hashtag: 'coachdenegocios', nombre: 'Coaching de negocios' },
  { hashtag: 'negociosdigitales', nombre: 'Negocios digitales' },
  { hashtag: 'agenciademarketing', nombre: 'Agencias' },
  { hashtag: 'copywriting', nombre: 'Copywriting' },
  { hashtag: 'infoproductos', nombre: 'Cursos y mentorías' },
  { hashtag: 'consultoria', nombre: 'Consultoría' },
];

// ─────────────────────────────────────────────────────────────────────────────
// La lectura (el script de la PC)
// ─────────────────────────────────────────────────────────────────────────────

/** Cuántas publicaciones se piden por cuenta de la lista: con eso hay de dónde sacar su mediana (el outlier). */
export const PUBLICACIONES_POR_CUENTA = 40;
/** Cuántas se piden por tema: los carruseles son una parte, y de esos se guardan los que mejor rinden. */
export const PUBLICACIONES_POR_TEMA = 80;
/** Los topes de una corrida si no se dicen otros (el pedido de Martín para la primera carga). */
export const TECHO_USD_POR_DEFECTO = 2;
export const CARRUSELES_POR_DEFECTO = 300;
/** Lo que se deja libre del crédito del mes de Apify: la clave es la de Spy, y Spy sigue andando con esto. */
export { RESERVA_CREDITO_USD } from '../spy-todo-reglas';
/** Una fuente leída hace menos que esto no se vuelve a leer (salvo que se pida con `--solo`). */
export const DIAS_ENTRE_LECTURAS = 7;

export type FuenteDeLectura =
  | { tipo: 'cuenta'; id: number; instagram: string; nombre: string }
  | { tipo: 'tema'; id: number; hashtag: string; nombre: string };
export type LecturaPlaneada = { fuente: FuenteDeLectura; cuantas: number; techoUsd: number };

/**
 * Lo que se le manda al actor para leer un TEMA: las publicaciones de su página de hashtag (las que Instagram muestra
 * arriba primero). Es el mismo actor y la misma forma que la lectura de una cuenta (`entradaDePublicaciones`).
 */
export function entradaDeTema(hashtag: string, cuantas: number): Record<string, unknown> {
  return { directUrls: [`https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`], resultsType: 'posts', resultsLimit: cuantas, addParentData: false };
}

/** El techo en dólares de una corrida de `cuantas` publicaciones (el precio de la tienda, redondeado para arriba). */
export const techoDeCorrida = (cuantas: number): number => Math.ceil(cuantas * USD_POR_PUBLICACION * 100) / 100;

/**
 * Qué leer y con cuánto techo cada corrida, sin pasarse del techo total (el menor entre lo pedido y lo que deja libre el
 * crédito del mes). Temas y cuentas se intercalan, primero lo nunca leído y después lo más viejo; lo apagado, lo que salió
 * y lo leído hace menos de `DIAS_ENTRE_LECTURAS` no entran. Cada corrida lleva su techo (`maxTotalChargeUsd` de Apify):
 * una que se desboque no puede gastar más que eso.
 */
export function planDeLectura(
  cuentas: readonly CuentaBiblioteca[], temas: readonly TemaBiblioteca[],
  o: { techoUsd: number; porCuenta?: number; porTema?: number; solo?: string | null; soloTemas?: boolean; soloCuentas?: boolean; ahora?: number },
): { lecturas: LecturaPlaneada[]; totalUsd: number; quedanFuera: string[]; alDia: string[] } {
  const ahora = o.ahora ?? Date.now();
  const porCuenta = Math.max(1, Math.min(200, Math.round(o.porCuenta ?? PUBLICACIONES_POR_CUENTA)));
  const porTema = Math.max(1, Math.min(300, Math.round(o.porTema ?? PUBLICACIONES_POR_TEMA)));
  const soloCuenta = o.solo && !o.solo.trim().startsWith('#') ? cuentaDeInstagram(o.solo) : null;
  const soloTema = o.solo && o.solo.trim().startsWith('#') ? hashtagDe(o.solo) : null;
  const hace = (iso: string | null) => { const t = Date.parse(iso ?? ''); return Number.isFinite(t) ? ahora - t : Infinity; };
  const porVejez = <T extends { leido: string | null; clave: string }>(xs: T[]) => xs.sort((a, b) => hace(b.leido) - hace(a.leido) || a.clave.localeCompare(b.clave));
  const deCuentas = o.soloTemas || soloTema ? [] : porVejez(cuentas
    .filter((c) => c.estado === 'activa' && c.fuente === 'lista' && (!soloCuenta || c.instagram === soloCuenta))
    .map((c) => ({ leido: c.leida_en, clave: c.instagram, f: { tipo: 'cuenta' as const, id: c.id, instagram: c.instagram, nombre: c.nombre } })));
  const deTemas = o.soloCuentas || soloCuenta ? [] : porVejez(temas
    .filter((t) => t.activo && (!soloTema || t.hashtag === soloTema))
    .map((t) => ({ leido: t.leido_en, clave: t.hashtag, f: { tipo: 'tema' as const, id: t.id, hashtag: t.hashtag, nombre: t.nombre } })));
  // Intercaladas: un tema, una cuenta, un tema…, así un techo chico no se va entero en una sola fuente.
  const orden: Array<{ leido: string | null; f: FuenteDeLectura }> = [];
  for (let i = 0; i < Math.max(deCuentas.length, deTemas.length); i += 1) {
    if (deTemas[i]) orden.push(deTemas[i]);
    if (deCuentas[i]) orden.push(deCuentas[i]);
  }
  const lecturas: LecturaPlaneada[] = [];
  const quedanFuera: string[] = [];
  const alDia: string[] = [];
  let total = 0;
  for (const x of orden) {
    const rotulo = x.f.tipo === 'cuenta' ? `@${x.f.instagram}` : `#${x.f.hashtag}`;
    if (!o.solo && hace(x.leido) < DIAS_ENTRE_LECTURAS * 86_400_000) { alDia.push(rotulo); continue; }
    const cuantas = x.f.tipo === 'cuenta' ? porCuenta : porTema;
    const techo = techoDeCorrida(cuantas);
    if (total + techo > o.techoUsd + 1e-9) { quedanFuera.push(rotulo); continue; }
    total = Math.round((total + techo) * 100) / 100;
    lecturas.push({ fuente: x.f, cuantas, techoUsd: techo });
  }
  return { lecturas, totalUsd: total, quedanFuera, alDia };
}

/**
 * Cuánto se puede gastar en esta corrida: lo pedido, pero nunca más de lo que deja libre el crédito del mes por encima de
 * la reserva de Spy. Sin saber el crédito (Apify no lo dijo), null: no se gasta a ciegas.
 */
export function techoConCredito(pedido: number, credito: { usado: number; tope: number } | null, reserva: number): number | null {
  if (!credito) return null;
  const libre = Math.floor((credito.tope - credito.usado - reserva) * 100) / 100;
  return Math.max(0, Math.min(pedido, libre));
}

/** El creador de un ítem del actor: su @ y su nombre (en una lectura por tema, cada publicación es de alguien distinto). */
export function creadorDelItem(item: unknown): { instagram: string; nombre: string } | null {
  const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
  const instagram = cuentaDeInstagram(typeof o?.ownerUsername === 'string' ? o.ownerUsername : null);
  if (!instagram) return null;
  const nombre = typeof o?.ownerFullName === 'string' && o.ownerFullName.trim() ? o.ownerFullName.trim().slice(0, 120) : instagram;
  return { instagram, nombre };
}

/** Lo que se guarda de una publicación leída (sin el id ni el creador, que pone quien guarda). */
export type FilaPiezaBiblioteca = Omit<PiezaBiblioteca, 'id' | 'cuenta_id' | 'visto_primera_vez' | 'dejo_de_verse_en'> & { creador: string };

const interaccion = (p: Pick<PiezaInstagram, 'megusta' | 'comentarios'>) => (p.megusta ?? 0) + (p.comentarios ?? 0);

/**
 * Las filas a guardar de una lectura. Los reels y los videos no entran. De una cuenta de la LISTA se guardan sus
 * publicaciones (carruseles e imágenes: la mediana de su outlier es la de Spy, sobre todas); de un TEMA, sólo los
 * carruseles, de mejor a peor rendimiento y hasta `tope`. Sin repetidos (por su ref), y sin los creadores que salieron.
 * Cada una se clasifica al guardarla: su tipo y lo que pide al final.
 */
export function filasDeLectura(
  piezas: ReadonlyArray<PiezaInstagram & { creador: string }>,
  o: { tema: number | null; tope?: number; fuera?: ReadonlySet<string>; ahora?: Date },
): FilaPiezaBiblioteca[] {
  const cuando = (o.ahora ?? new Date()).toISOString();
  const vistos = new Set<string>();
  const candidatas = piezas.filter((p) => {
    const medio = medioDeInstagram(p.tipo);
    if (!p.ref || !p.creador || p.formato === 'REELS' || medio === 'video' || o.fuera?.has(p.creador)) return false;
    if (o.tema != null && medio !== 'carrusel') return false;
    if (vistos.has(p.ref)) return false;
    vistos.add(p.ref);
    return true;
  });
  const ordenadas = o.tema != null ? [...candidatas].sort((a, b) => interaccion(b) - interaccion(a)) : candidatas;
  return ordenadas.slice(0, Math.max(0, o.tope ?? Infinity)).map((p) => {
    const medio = medioDeInstagram(p.tipo);
    const fecha = Date.parse(p.fecha ?? '');
    const texto = p.texto?.trim() || null;
    const formato = formatoDe(formatoPorTexto(texto)) || null;
    const cierre: Cierre | null = cierreDeTexto(texto);
    return {
      creador: p.creador, tema_id: o.tema, ref: p.ref.slice(0, 80), url: p.permalink, miniatura: p.miniatura, texto, texto_leido_en: cuando,
      formato: formato === 'otro' ? null : formato, cierre,
      medio, laminas: medio === 'carrusel' && typeof p.laminas === 'number' && p.laminas >= 2 && p.laminas <= 20 ? p.laminas : null,
      megusta: p.megusta, comentarios: p.comentarios, vistas: p.vistas, metricas_leidas_en: cuando,
      publicada_en: Number.isFinite(fecha) ? new Date(fecha).toISOString() : null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Los primeros de la lista: los referentes del Ops Center
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Para arrancar la lista: los referentes del Ops Center (lib/asesores/catalogo.ts). Su @ de Instagram NO está escrito en
 * ningún lado del repo y no se inventa: el script los BUSCA por su nombre (`buscar`) y la plataforma suma el bueno. Esto
 * sólo dice a quién buscar: los que no están ya en la lista (por referente o por nombre).
 */
export function referentesSinCuenta(referentes: ReadonlyArray<{ id: string; completo: string }>, cuentas: readonly CuentaBiblioteca[]): Array<{ id: string; completo: string }> {
  const enLista = cuentas.filter((c) => c.fuente === 'lista' || c.estado === 'excluida');
  const yaPorRef = new Set(enLista.map((c) => c.referente).filter(Boolean));
  const yaPorNombre = new Set(enLista.map((c) => plano(c.nombre)));
  return referentes.filter((r) => !yaPorRef.has(r.id) && !yaPorNombre.has(plano(r.completo)));
}
