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
// Cada publicación queda clasificada por tipo (lista, tutorial, historia…: `tipoDeCarrusel`, ./clasificar.ts) y con lo
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
import { formatoDe } from '../spy-detalle';
import { medioDeInstagram } from '../spy-medio';
import { USD_POR_PUBLICACION } from '../spy-todo-reglas';
import { carruselesDe, plano, type Carrusel, type CompetidorParaCarrusel, type PiezaParaCarrusel } from './explorar';
import { sinCuenta } from '../multiplo-rendimiento';
import { cierreDeTexto, esCierre, type Cierre } from './texto';
import { pareceContenido, portadaDice, textoDePortada, tipoDeCarrusel } from './clasificar';
import { ctaDeTexto, ctaGuardado } from './cta';

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
  /** ¿Parece contenido? (./clasificar.ts) Lo guarda la lectura (mig 0393); sin la columna, se calcula del texto al mostrar. */
  parece_contenido?: boolean | null;
  /** Las láminas en nuestro bucket, en orden (mig 0404). Sin la columna, o sin leerlas todavía: sólo la portada. */
  laminas_imagenes?: string[] | null;
  /** La palabra que pide comentar (./cta.ts) y por dónde, guardadas al leer (mig 0404): el texto vence a los 30 días. */
  cta?: string | null;
  cta_via?: string | null;
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
      medio: p.medio, laminas: p.laminas, laminas_imagenes: p.laminas_imagenes ?? null,
    });
  }
  return carruselesDe(comoSpy, competidores, ahora, 'biblioteca').map((c) => {
    const p = guardado.get(c.id);
    const deLaLista = p ? activas.get(p.cuenta_id)?.fuente === 'lista' : false;
    const cierre = p && esCierre(p.cierre) ? p.cierre : c.cierre;
    // Lo guardado al leer (con la portada) gana; sin eso, lo que dice el texto que queda.
    const contenido = typeof p?.parece_contenido === 'boolean' ? p.parece_contenido : pareceContenido({ texto: c.texto, formato: c.formato || null, cierre });
    // El CTA guardado al leer gana (el texto vence a los 30 días); sin la columna (0404), el que dice el texto que queda.
    const cta = (p ? ctaGuardado(p.cta, p.cta_via) : null) ?? c.cta ?? null;
    // De un tema no se leyó su cuenta: sin número, y el título del chip lo dice (`sinCuenta`).
    return { ...c, outlier: deLaLista ? c.outlier : null, multiplo: deLaLista ? c.multiplo : sinCuenta(), cierre, pareceContenido: contenido, cta };
  });
}

/** Cuántos carruseles de la biblioteca llegan al explorador: viajan todos al navegador, que filtra y ordena ahí. */
export const CARRUSELES_EN_EXPLORADOR = 800;
/** Lo publicado en estos días entra siempre (si cabe): sin eso, «Esta semana» quedaría vacía con una biblioteca grande. */
const DIAS_RECIENTES = 14;

/**
 * Lo que de la biblioteca llega al explorador. Sólo carruseles: las imágenes sueltas de una cuenta de la lista se guardan para
 * su mediana (el outlier) y no son ejemplos. Si pasan el tope, primero lo de los últimos 14 días, después lo que parece
 * contenido (lo personal va al final, ./clasificar.ts) y después lo que mejor rindió (el outlier; sin outlier, la
 * interacción). Lo que no se midió va después de lo medido, nunca como un cero.
 */
export function recortarBiblioteca(cs: readonly Carrusel[], tope = CARRUSELES_EN_EXPLORADOR, ahora = Date.now()): Carrusel[] {
  const carruseles = cs.filter((c) => c.medio !== 'imagen');
  if (carruseles.length <= tope) return carruseles;
  const reciente = (c: Carrusel) => Date.parse(c.publicada ?? '') >= ahora - DIAS_RECIENTES * 86_400_000;
  const inter = (c: Carrusel) => (c.megusta ?? 0) + (c.comentarios ?? 0);
  const personal = (c: Carrusel) => Number(c.pareceContenido === false);
  return [...carruseles]
    .sort((a, b) => Number(reciente(b)) - Number(reciente(a)) || personal(a) - personal(b) || (b.outlier ?? -1) - (a.outlier ?? -1) || inter(b) - inter(a) || a.id - b.id)
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
/**
 * Cuántas se piden por tema. MEDIDO en la primera carga (4/11/2026): la página de un hashtag devolvió 15 a 30 publicaciones
 * de las 80 pedidas. Pedir más no trae más, y reservaba el techo de 80 por tema (el plan dejaba afuera fuentes que entraban).
 */
export const PUBLICACIONES_POR_TEMA = 30;

/**
 * Lo que trajo de verdad la primera carga (4/11/2026, 10 temas y 7 cuentas, 160 carruseles): unos 10 carruseles por tema y
 * 9 por cuenta. El plan en seco dice lo ESPERADO con esto; el tope (`--max-carruseles`) es un techo, no una promesa.
 */
export const MEDIDO_CARRUSELES = { porTema: 10, porCuenta: 9, fecha: '4/11/2026' } as const;
/** Lo que costó cada publicación que llegó (Apify cobra por resultado): el techo de cada corrida es más alto que lo probable. */
export const MEDIDO_PUBLICACIONES = { porTema: [15, 30] as const, porCuenta: 40 } as const;

/** Lo esperado de un plan, con lo medido: cuántos carruseles y cuánto cuesta, probablemente (no el techo). */
export function esperadoDelPlan(lecturas: readonly LecturaPlaneada[]): { carruseles: number; usdProbable: number } {
  const temas = lecturas.filter((l) => l.fuente.tipo === 'tema');
  const cuentas = lecturas.filter((l) => l.fuente.tipo === 'cuenta');
  const carruseles = temas.length * MEDIDO_CARRUSELES.porTema + cuentas.length * MEDIDO_CARRUSELES.porCuenta;
  const publicaciones = temas.reduce((n, l) => n + Math.min(l.cuantas, MEDIDO_PUBLICACIONES.porTema[1]), 0) + cuentas.reduce((n, l) => n + l.cuantas, 0);
  return { carruseles, usdProbable: Math.ceil(publicaciones * USD_POR_PUBLICACION * 100) / 100 };
}

/** Una cuenta de la lista que trajo menos que esto casi seguro NO es la del creador (o es privada): se avisa, no se borra. */
export const POCAS_PUBLICACIONES = 5;
export const cuentaDudosa = (llegaron: number): boolean => llegaron < POCAS_PUBLICACIONES;
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

// ─────────────────────────────────────────────────────────────────────────────
// Por qué una corrida se detuvo (6/11/2026)
// ─────────────────────────────────────────────────────────────────────────────
// Síntoma medido el 6/11/2026: `laminas` paró diciendo «Llega al techo» con US$0,54 gastados de un tope pedido de US$1,50, y
// de la salida no se podía saber si faltaba crédito o si era un límite nuestro. Eran las DOS cosas y ninguna se decía: el
// techo efectivo venía del crédito (no del tope pedido) y la suma que se comparaba contra él era de RESERVAS, no de gasto.
// De acá sale el porqué, con el número, para que la corrida nunca corte en silencio.

const usdTexto = (n: number) => `US$${n.toFixed(2)}`;
const centavos = (n: number) => Math.round(n * 100) / 100;

/** De dónde sale el techo de una corrida: lo pedido, lo que deja el crédito, o nada. */
export type MotivoDelTecho = 'sin-saber' | 'sin-credito' | 'credito' | 'pedido';

/**
 * El techo de una corrida Y DE DÓNDE SALE. `techoConCredito` devuelve el número solo: con eso, un techo de 0 (no hay crédito)
 * y un techo chico (el crédito no llega a lo pedido) se ven iguales que «llegué a tu tope».
 *   · 'sin-saber'   Apify no dijo su crédito: no se gasta a ciegas (techo null).
 *   · 'sin-credito' lo libre no pasa la reserva de Spy: la corrida no puede gastar nada (techo 0).
 *   · 'credito'     alcanza para algo, pero menos que lo pedido.
 *   · 'pedido'      el techo es el que se pidió.
 * `porque` es el renglón para una persona, con los números. Nunca una clave ni un token.
 */
export function motivoDelTecho(
  pedido: number, credito: { usado: number; tope: number } | null, reserva: number,
): { techo: number | null; motivo: MotivoDelTecho; libre: number | null; porque: string } {
  const techo = techoConCredito(pedido, credito, reserva);
  if (techo == null || !credito) {
    return { techo: null, motivo: 'sin-saber', libre: null, porque: 'Apify no dijo cuánto crédito queda y no se gasta a ciegas' };
  }
  const quedan = centavos(Math.max(0, credito.tope - credito.usado));
  const libre = Math.floor((credito.tope - credito.usado - reserva) * 100) / 100;
  if (libre <= 0) {
    return { techo: 0, motivo: 'sin-credito', libre, porque: `no hay crédito libre: quedan ${usdTexto(quedan)} en Apify y la reserva de Spy es ${usdTexto(reserva)}` };
  }
  if (libre < pedido) {
    return { techo, motivo: 'credito', libre, porque: `el crédito libre alcanza para ${usdTexto(libre)}, menos que los ${usdTexto(pedido)} que pediste (quedan ${usdTexto(quedan)} y se dejan ${usdTexto(reserva)} para Spy)` };
  }
  return { techo, motivo: 'pedido', libre, porque: `el tope que pediste: ${usdTexto(pedido)}` };
}

/**
 * El margen del techo de CADA corrida de Apify (`maxTotalChargeUsd`) sobre el precio de lista. Sin margen, Apify corta la
 * tanda a mitad: cobra lo que LLEGA y el precio real por publicación es más alto que el de la tienda (ver `USD_POR_LINK_MEDIDO`).
 * ⚠️ Este margen es para el techo DE LA TANDA y nada más. Acumularlo para medir el techo de la CORRIDA es lo que hacía cortar
 * de más: con 40 links por tanda reservaba US$0,14 cuando lo que Apify cobraba eran US$0,11 (28 % de reserva de más, una tanda
 * entera antes de tiempo).
 */
export const MARGEN_TECHO_TANDA = 1.5;
/**
 * Lo que costó DE VERDAD cada publicación pedida por su link. Medido el 5/11/2026 (244 de 245 links, ~US$0,0025 cada uno) y el
 * 6/11/2026 (840 links, US$2,27: US$0,0027 cada uno). Se usa el más caro de los dos: el precio de lista (`USD_POR_PUBLICACION`,
 * US$0,0023) subestima la factura, y un techo que subestima lo que cobran no es un techo.
 */
export const USD_POR_LINK_MEDIDO = 0.0027;
/** Cuántos links lleva cada corrida de Apify (la receta medida de docs/hallazgos-carruseles.md). */
export const LINKS_POR_TANDA = 40;

/** El techo en dólares de UNA tanda de links (`maxTotalChargeUsd`): el precio de lista con su margen. */
export const techoDeTanda = (cuantos: number): number =>
  Math.max(0.01, Math.ceil(Math.max(0, cuantos) * USD_POR_PUBLICACION * MARGEN_TECHO_TANDA * 100) / 100);

export type TandaDeLinks = { desde: number; cuantos: number; techoUsd: number };
/** Por qué no se leyó más: se leyó todo, se llegó al techo, o no había techo con que empezar. */
export type CorteDeTandas = 'todo' | 'techo' | 'sin-techo';
export type PlanDeTandas = { tandas: TandaDeLinks[]; probableUsd: number; quedanFuera: number; corte: CorteDeTandas };

/**
 * La tanda que sigue: cuántos links entran en lo que QUEDA del techo y con qué `maxTotalChargeUsd` va. null = no entra ni uno.
 *
 * ⚠️ Es LA regla, y la usan los dos lados: el plan en seco (con el gasto probable) y la corrida de verdad (con lo que Apify ya
 * cobró). Por eso el techo de la tanda se recorta a `quedaUsd`: el margen del 1,5× sirve para que Apify no corte una tanda a
 * mitad, pero nunca puede hacer que la corrida gaste más de lo que se le dejó.
 */
export function siguienteTanda(cuantosQuedan: number, quedaUsd: number, deA = LINKS_POR_TANDA): { cuantos: number; techoUsd: number } | null {
  const porTanda = Math.max(1, Math.round(deA));
  const quedan = Math.max(0, Math.floor(cuantosQuedan));
  const queda = centavos(Math.max(0, quedaUsd));
  if (!quedan || queda <= 0) return null;
  // Cuántos links paga lo que queda, al precio MEDIDO (el de lista subestima la factura y un techo que subestima no es techo).
  const caben = Math.floor(queda / USD_POR_LINK_MEDIDO + 1e-9);
  const cuantos = Math.min(porTanda, quedan, caben);
  if (cuantos <= 0) return null;
  return { cuantos, techoUsd: Math.min(techoDeTanda(cuantos), queda) };
}

/**
 * En cuántas tandas se leen `cuantos` links sin pasarse del techo de la corrida, y cuántos quedan afuera.
 *
 * ⚠️ Lo que se compara contra el techo es el GASTO probable al precio medido, no la suma de los techos de cada tanda: Apify
 * cobra lo que LLEGA, y el techo de una tanda lleva margen a propósito. La última tanda se RECORTA a los links que caben (antes
 * se descartaba entera: con un techo de US$0,70 leía 200 de 400 en vez de 254).
 */
export function planDeTandas(cuantos: number, o: { techoUsd: number; deA?: number }): PlanDeTandas {
  const total = Math.max(0, Math.floor(cuantos));
  const techo = Math.max(0, o.techoUsd);
  const tandas: TandaDeLinks[] = [];
  let probable = 0;
  for (let desde = 0; desde < total; ) {
    const t = siguienteTanda(total - desde, centavos(techo - probable), o.deA);
    if (!t) break;
    tandas.push({ desde, ...t });
    probable = centavos(probable + t.cuantos * USD_POR_LINK_MEDIDO);
    desde += t.cuantos;
  }
  const leidos = tandas.reduce((n, t) => n + t.cuantos, 0);
  return { tandas, probableUsd: probable, quedanFuera: total - leidos, corte: leidos >= total ? 'todo' : techo <= 0 ? 'sin-techo' : 'techo' };
}

/**
 * El renglón que dice POR QUÉ la corrida no siguió, con el número y qué lo destraba. Nunca un «al techo» mudo: «no hay
 * crédito», «el crédito no llega a lo que pediste», «llegué a tu tope» y «se terminaron las tandas» son cuatro cosas distintas
 * y se arreglan de maneras distintas (cargar crédito, esperar el mes, subir `--techo-usd`, nada).
 */
export function porQueParo(o: {
  corte: CorteDeTandas; motivo: MotivoDelTecho; porque: string; techo: number | null; quedanFuera: number; gastado?: number | null;
}): string {
  const gasto = typeof o.gastado === 'number' ? ` Se gastó ${usdTexto(o.gastado)}.` : '';
  if (o.corte === 'todo') return `Paró porque se terminaron las tandas: se pidieron todos los de esta corrida, no fue el techo.${gasto}`;
  const faltan = `Quedan ${o.quedanFuera} sin leer: `;
  if (o.motivo === 'sin-saber') return `${faltan}${o.porque}.${gasto}`;
  if (o.motivo === 'sin-credito' || o.motivo === 'credito') {
    return `${faltan}${o.porque}. Lo destraba cargar crédito en Apify (o esperar el mes que viene), no un \`--techo-usd\` más alto.${gasto}`;
  }
  return `${faltan}llegué al tope que me pediste (${usdTexto(o.techo ?? 0)}). Hay crédito para más: subí \`--techo-usd\`.${gasto}`;
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
  piezas: ReadonlyArray<PiezaInstagram & { creador: string; alt?: string | null }>,
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
    // El tipo, de la portada (el texto que escribió Instagram, si vino) y del pie (./clasificar.ts).
    const formato = formatoDe(tipoDeCarrusel({ texto, portada: textoDePortada(p.alt) })) || null;
    const cierre: Cierre | null = cierreDeTexto(texto);
    // El CTA, del pie y de la portada (a veces la palabra va en la lámina: «Comenta GUÍA»).
    const cta = ctaDeTexto([texto, textoDePortada(p.alt)].filter(Boolean).join('\n'));
    return {
      creador: p.creador, tema_id: o.tema, ref: p.ref.slice(0, 80), url: p.permalink, miniatura: p.miniatura, texto, texto_leido_en: cuando,
      formato: formato === 'otro' ? null : formato, cierre,
      medio, laminas: medio === 'carrusel' && typeof p.laminas === 'number' && p.laminas >= 2 && p.laminas <= 20 ? p.laminas : null,
      megusta: p.megusta, comentarios: p.comentarios, vistas: p.vistas, metricas_leidas_en: cuando,
      publicada_en: Number.isFinite(fecha) ? new Date(fecha).toISOString() : null,
      parece_contenido: pareceContenido({ texto, formato: formato === 'otro' ? null : formato, cierre, portada: portadaDice(p.alt) }),
      cta: cta?.palabra ?? null, cta_via: cta?.via ?? null,
      // Las láminas como vinieron (el CDN de Instagram): quien guarda las BAJA a nuestro bucket antes de escribirlas.
      laminas_imagenes: medio === 'carrusel' && p.imagenes?.length ? p.imagenes.slice(0, 20) : null,
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

// ─────────────────────────────────────────────────────────────────────────────
// Volver a clasificar lo guardado (gratis: no pide nada a Apify)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que cambia de una publicación guardada si se la vuelve a clasificar con su texto (sin la portada: no se guardó). Sólo
 * LLENA lo que falta: un tipo, un cierre o la señal de contenido que ya están no se pisan (pueden venir de la portada).
 * Sin texto (venció a los 30 días), no cambia nada. null = nada que cambiar.
 */
export function reclasificacion(f: Pick<PiezaBiblioteca, 'texto' | 'formato' | 'cierre' | 'parece_contenido'> & Partial<Pick<PiezaBiblioteca, 'cta'>>): { formato?: string; cierre?: Cierre; parece_contenido?: boolean; cta?: string; cta_via?: string } | null {
  const texto = f.texto?.trim() || null;
  if (!texto) return null;
  const cambios: { formato?: string; cierre?: Cierre; parece_contenido?: boolean; cta?: string; cta_via?: string } = {};
  // El CTA (6/11/2026): sólo se pregunta si la fila trae la columna (0404 aplicada: `cta` vino, aunque sea null) y está vacía.
  if ('cta' in f && !f.cta) {
    const cta = ctaDeTexto(texto);
    if (cta) { cambios.cta = cta.palabra; cambios.cta_via = cta.via; }
  }
  const formato = f.formato || formatoDe(tipoDeCarrusel({ texto })) || null;
  if (!f.formato && formato && formato !== 'otro') cambios.formato = formato;
  const cierre = (esCierre(f.cierre) ? f.cierre : null) ?? cierreDeTexto(texto);
  if (!f.cierre && cierre) cambios.cierre = cierre;
  if (typeof f.parece_contenido !== 'boolean') {
    const c = pareceContenido({ texto, formato: formato && formato !== 'otro' ? formato : null, cierre });
    if (c !== null) cambios.parece_contenido = c;
  }
  return Object.keys(cambios).length ? cambios : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmar una cuenta antes de sumarla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Este perfil es el de esta persona? Buscar por nombre en Instagram trae cuentas equivocadas (medido el 4/11/2026: para
 * «Alex Hormozi», @damaristradesww y @hormoziw), así que el @ se CONFIRMA leyendo el perfil y comparando lo que se puede
 * medir: que el nombre del perfil tenga el nombre y el apellido, que la cuenta esté verificada o tenga muchos seguidores, y
 * que publique. «confirmada» es lo único que el script ofrece sumar; lo demás lo decide una persona mirando el perfil.
 */
/**
 * ¿El nombre de un perfil es el de esta persona? Su nombre de pila Y al menos uno de sus apellidos (con «Adrià Sola Pastor»,
 * exigir las tres palabras dejaba afuera un perfil que dice «Adrià Sola»). Sin tildes ni mayúsculas; palabras de 3 letras o más.
 */
export function nombreCoincide(nombre: string | null | undefined, completo: string): boolean {
  const palabras = plano(completo).split(' ').filter((w) => w.length >= 3);
  const n = plano(nombre ?? '');
  if (!palabras.length || !n) return false;
  const [pila, ...apellidos] = palabras;
  return n.includes(pila) && (!apellidos.length || apellidos.some((w) => n.includes(w)));
}

export function confianzaDeCuenta(
  p: { usuario: string; nombre: string | null; seguidores: number | null; publicaciones: number | null; verificada?: boolean | null },
  completo: string | null,
): { nivel: 'confirmada' | 'dudosa' | 'no-parece'; motivos: string[] } {
  const motivos: string[] = [];
  const palabras = completo ? plano(completo).split(' ').filter((w) => w.length >= 3) : [];
  const enNombre = palabras.length && completo ? nombreCoincide(p.nombre, completo) : null;
  const enUsuario = palabras.length ? palabras.some((w) => plano(p.usuario).includes(w)) : null;
  if (enNombre === false) motivos.push(`el nombre del perfil («${p.nombre ?? 'sin nombre'}») no dice «${completo}»`);
  if (p.verificada === true) motivos.push('verificada');
  if (p.seguidores != null) motivos.push(`${p.seguidores.toLocaleString('es')} seguidores`);
  if (p.publicaciones != null) motivos.push(`${p.publicaciones.toLocaleString('es')} publicaciones`);
  const grande = p.verificada === true || (p.seguidores ?? 0) >= 100_000;
  const publica = (p.publicaciones ?? 0) >= 30;
  if (enNombre !== false && grande && publica) return { nivel: 'confirmada', motivos };
  if (enNombre === false && enUsuario === false) return { nivel: 'no-parece', motivos };
  if (!publica && p.publicaciones != null) motivos.push('publica poco');
  return { nivel: 'dudosa', motivos };
}

/** Qué tanto se parece un candidato de la búsqueda al nombre buscado (0 a 2): su nombre lo dice entero (2), su @ lo nombra (1). */
export function parecidoConNombre(c: { usuario: string; nombre?: string | null }, completo: string): number {
  const palabras = plano(completo).split(' ').filter((w) => w.length >= 3);
  if (!palabras.length) return 0;
  if (nombreCoincide(c.nombre, completo)) return 2;
  return palabras.some((w) => plano(c.usuario).includes(w)) ? 1 : 0;
}
