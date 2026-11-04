// =============================================================================
// carruseles/explorar-servidor — lo que lee y escribe el explorador de carruseles (Image Editor, `?ver=carruseles`)
// =============================================================================
// Lee lo que Spy YA trajo de las cuentas que el negocio sigue (`spy_competidores` + `spy_piezas`, por el proxy del
// inquilino): no llama a Apify ni a Meta ni gasta nada. Las cuentas se suman y se leen en Competitors Spy, con la clave y
// el tope de crédito de cada negocio (lib/spy.ts). Lo puro, con su test: ./explorar.ts.
// Y le SUMA la biblioteca de ejemplos de la plataforma (./biblioteca-servidor.ts, 4/11/2026): la misma para todos, con
// los ids en negativo. Si la biblioteca no se puede leer, el negocio ve lo suyo igual y la pantalla lo dice.
//
// Lo que escribe: los guardados y las búsquedas guardadas del NEGOCIO, en dos settings (`carruseles.guardados`,
// `carruseles.busquedas`). Se lee ESTRICTO antes de escribir (con la base caída, escribir sobre una lectura tolerante
// borraría todo lo guardado) y se escribe con compare-and-set (`cambiarSettingSi`, que con un valor largo compara por
// `updated_at`): dos personas guardando en el mismo segundo no se pisan; la que pierde vuelve a leer y reintenta.
// =============================================================================

import 'server-only';
import { getTenantDb } from '../workspace';
import { leerPorPaginas } from '../supabase-paginado';
import { cambiarSettingSi, getSetting, getSettingEstricto } from '../settings';
import { podarVencido } from '../spy-reglas';
import { cortarSinPartir } from '../unicode-seguro';
import { carruselDeLaBiblioteca, carruselesDeLaBiblioteca } from './biblioteca-servidor';
import { esDeBiblioteca, unirConBiblioteca } from './biblioteca';
import {
  CLAVE_BUSQUEDAS, CLAVE_GUARDADOS, TOPE_BUSQUEDAS, carruselesDe, conGuardado, filtrosDeQuery, pasoDelExplorador, queryDeFiltros,
  sanearBusquedas, sanearGuardados,
  type BusquedaGuardada, type Carrusel, type CompetidorParaCarrusel, type Guardado, type PasoExplorador, type PiezaParaCarrusel,
} from './explorar';

/** Cuántas publicaciones se leen como mucho (todas las cuentas juntas): 25 cuentas × 240 publicaciones. */
export const PUBLICACIONES_A_LEER = 6000;
/** Lo que viaja al navegador: el texto se corta (la búsqueda de la pantalla mira el principio y el gancho). */
export const TEXTO_EN_PANTALLA = 320;

export type Explorador = {
  ok: true;
  carruseles: Carrusel[];
  guardados: Guardado[];
  busquedas: BusquedaGuardada[];
  /** Cuántas cuentas sigue y cuántas con Instagram: el paso en que está (./explorar.ts, `pasoDelExplorador`). */
  cuentas: { competidores: number; conInstagram: number };
  paso: PasoExplorador;
  frase: string;
  accion: { texto: string; ruta: string } | null;
  /** Cuántos carruseles vienen de la biblioteca de ejemplos (los de la plataforma, para todos). */
  ejemplos: number;
  /** La biblioteca no se pudo leer: se ve lo del negocio y se dice. */
  avisoBiblioteca: string | null;
};

/**
 * Todo lo del explorador, del negocio de la pestaña. «No pude leer» es `{ ok: false }` y nunca una lista vacía: un cero
 * le diría al negocio que sus cuentas no publican nada.
 */
export async function leerExplorador(): Promise<Explorador | { ok: false; error: string }> {
  const db = await getTenantDb();
  const comp = await db.from('spy_competidores').select('id, nombre, instagram, avatar').limit(100);
  if (comp.error) {
    // Spy sin tablas (la 0359 sin aplicar) no es un error del negocio: no sigue a nadie todavía.
    if (comp.error.code === '42P01') return armar([], [], [], { competidores: 0, conInstagram: 0 }, await deLaBiblioteca());
    return { ok: false, error: comp.error.message };
  }
  const competidores = (comp.data ?? []) as CompetidorParaCarrusel[];
  const conIg = competidores.filter((c) => !!c.instagram);
  const piezas: PiezaParaCarrusel[] = [];
  if (conIg.length) {
    try {
      // `*` y no una lista de columnas: `medio` y `laminas` (mig 0391) pueden no existir todavía, y una columna nombrada
      // que falta rechaza la consulta entera. Paginado por `id` (único).
      await leerPorPaginas<Record<string, unknown>>(db, 'spy_piezas', '*', (pagina) => {
        for (const f of pagina) piezas.push(podarVencido(f) as unknown as PiezaParaCarrusel);
        return piezas.length < PUBLICACIONES_A_LEER;
      }, { orden: 'id', filtros: (q) => q.eq('canal', 'instagram').eq('tipo', 'publicacion').in('competidor_id', conIg.map((c) => c.id)) });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const [guardados, busquedas, biblioteca] = await Promise.all([getSetting(CLAVE_GUARDADOS), getSetting(CLAVE_BUSQUEDAS), deLaBiblioteca()]);
  return armar(carruselesDe(piezas, competidores), sanearGuardados(guardados), sanearBusquedas(busquedas), { competidores: competidores.length, conInstagram: conIg.length }, biblioteca);
}

/** La biblioteca de ejemplos, sin tirar: si falla, ninguno y el aviso. */
async function deLaBiblioteca(): Promise<{ carruseles: Carrusel[]; aviso: string | null }> {
  try {
    return { carruseles: await carruselesDeLaBiblioteca(), aviso: null };
  } catch (e) {
    console.warn('[carruseles] no pude leer la biblioteca de ejemplos:', e instanceof Error ? e.message : e);
    return { carruseles: [], aviso: 'No pude leer la biblioteca de ejemplos: ves sólo los de las cuentas que sigues.' };
  }
}

function armar(propios: Carrusel[], guardados: Guardado[], busquedas: BusquedaGuardada[], cuentas: Explorador['cuentas'], biblioteca: { carruseles: Carrusel[]; aviso: string | null } = { carruseles: [], aviso: null }): Explorador {
  // El paso habla de lo del NEGOCIO (qué le falta para ver las cuentas que sigue); la biblioteca se ve igual.
  const p = pasoDelExplorador({ ...cuentas, carruseles: propios.length });
  const todos = unirConBiblioteca(propios, biblioteca.carruseles)
    .map((c) => ({ ...c, texto: c.texto ? cortarSinPartir(c.texto, TEXTO_EN_PANTALLA) : null }));
  return {
    ok: true, carruseles: todos, guardados, busquedas, cuentas, paso: p.paso, frase: p.frase, accion: p.accion,
    ejemplos: todos.filter((c) => c.origen === 'biblioteca').length, avisoBiblioteca: biblioteca.aviso,
  };
}

type Escrito<T> = { ok: true; valor: T; ya?: boolean } | { ok: false; error: string };

/**
 * Lee la clave estricta, calcula lo nuevo y lo escribe sólo si nadie la cambió en el medio; si perdió, vuelve a empezar
 * (hasta 3 veces). `calcular` devuelve el valor a escribir, `{ ya }` si no hay nada que cambiar, o un error.
 */
async function escribirConCas<T>(
  clave: string,
  calcular: (actual: string | null) => { escribir: string; valor: T } | { ya: T } | { error: string },
  queLee: string,
): Promise<Escrito<T>> {
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    let actual: string | null;
    try { actual = await getSettingEstricto(clave); } catch { return { ok: false, error: `No pude leer ${queLee}. Vuelve a intentar.` }; }
    const r = calcular(actual);
    if ('error' in r) return { ok: false, error: r.error };
    if ('ya' in r) return { ok: true, valor: r.ya, ya: true };
    if (await cambiarSettingSi(clave, actual, r.escribir)) return { ok: true, valor: r.valor };
  }
  return { ok: false, error: 'Alguien más estaba guardando a la vez. Vuelve a intentar.' };
}

/** ¿La pieza es una publicación de Instagram de ESTE negocio? (el proxy del inquilino ya filtra por workspace). */
async function esPublicacionDelNegocio(id: number): Promise<boolean | null> {
  // Uno de la biblioteca de ejemplos (id negativo): vale si es de un creador activo (la ven todos los negocios).
  if (esDeBiblioteca(id)) {
    try { return !!(await carruselDeLaBiblioteca(id)); } catch { return null; }
  }
  const db = await getTenantDb();
  const { data, error } = await db.from('spy_piezas').select('id').eq('id', id).eq('canal', 'instagram').eq('tipo', 'publicacion').maybeSingle();
  if (error) return null;
  return !!data;
}

/** Guarda o saca un carrusel de los guardados del negocio. Idempotente: guardar lo que ya está dice `ya`. */
export async function guardarCarrusel(id: number, guardar: boolean): Promise<Escrito<Guardado[]>> {
  if (!Number.isSafeInteger(id) || id === 0) return { ok: false, error: 'Ese carrusel no existe.' };
  if (guardar) {
    const es = await esPublicacionDelNegocio(id);
    if (es === null) return { ok: false, error: 'No pude comprobar ese carrusel. Vuelve a intentar.' };
    if (!es) return { ok: false, error: 'Ese carrusel no existe.' };
  }
  return escribirConCas<Guardado[]>(CLAVE_GUARDADOS, (actual) => {
    const r = conGuardado(sanearGuardados(actual), id, guardar, new Date().toISOString());
    return r.ya ? { ya: r.lista } : { escribir: JSON.stringify(r.lista), valor: r.lista };
  }, 'tus guardados');
}

/** Guarda una búsqueda con su nombre (sus filtros como query). Una igual (misma query) no se repite: se renombra. */
export async function guardarBusqueda(nombre: string, query: string): Promise<Escrito<BusquedaGuardada[]>> {
  const limpio = String(nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!limpio) return { ok: false, error: 'Ponle un nombre a la búsqueda.' };
  const q = queryDeFiltros(filtrosDeQuery(new URLSearchParams(String(query ?? ''))));
  return escribirConCas<BusquedaGuardada[]>(CLAVE_BUSQUEDAS, (actual) => {
    const lista = sanearBusquedas(actual);
    const igual = lista.find((b) => b.query === q);
    if (igual && igual.nombre === limpio) return { ya: lista };
    const nueva = igual
      ? lista.map((b) => (b.id === igual.id ? { ...b, nombre: limpio } : b))
      : [{ id: `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, nombre: limpio, query: q, en: new Date().toISOString() }, ...lista];
    if (nueva.length > TOPE_BUSQUEDAS) return { error: `Ya tienes ${TOPE_BUSQUEDAS} búsquedas guardadas: borra una para guardar otra.` };
    return { escribir: JSON.stringify(nueva), valor: sanearBusquedas(JSON.stringify(nueva)) };
  }, 'tus búsquedas');
}

/** Borra una búsqueda guardada. Borrar una que ya no está no es un error (`ya`). */
export async function borrarBusqueda(id: string): Promise<Escrito<BusquedaGuardada[]>> {
  return escribirConCas<BusquedaGuardada[]>(CLAVE_BUSQUEDAS, (actual) => {
    const lista = sanearBusquedas(actual);
    if (!lista.some((b) => b.id === id)) return { ya: lista };
    const nueva = lista.filter((b) => b.id !== id);
    return { escribir: JSON.stringify(nueva), valor: nueva };
  }, 'tus búsquedas');
}
