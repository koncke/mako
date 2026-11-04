// =============================================================================
// carruseles/biblioteca-servidor — la biblioteca de ejemplos contra la base (4/11/2026)
// =============================================================================
// Lo puro, con su porqué, está en ./biblioteca.ts. Las tablas (0392) son GLOBALES: se leen con la clave de servicio
// (`getSupabaseServer`), nunca con el proxy del inquilino, y ningún negocio escribe acá. Lo que cada negocio guarda de la
// biblioteca (sus marcadores) sigue en su setting (./explorar-servidor.ts).
//
// Quién la edita: el admin del negocio de la PLATAFORMA (`wsSuperAdmin`, resuelto por capa), como los «Sugeridos» de Spy
// (lib/spy-sugeridos-server.ts). Lo usan la pantalla (app/image-editor/carruseles/actions.ts), la API de MaKo
// (ver_biblioteca_carruseles, cambiar_biblioteca_carruseles) y el script de la PC (scripts/carruseles-biblioteca.mts).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '../supabase';
import { leerPorPaginas } from '../supabase-paginado';
import { podarVencido } from '../spy-reglas';
import { getRolWsEfectivo, getWorkspaceActual, wsSuperAdmin } from '../workspace';
import {
  carruselesDeBiblioteca, cuentaDeInstagram, decidirCambio, filaDeBiblioteca, hashtagDe, recortarBiblioteca,
  type CambioBiblioteca, type CuentaBiblioteca, type PiezaBiblioteca, type TemaBiblioteca,
} from './biblioteca';
import type { Carrusel } from './explorar';

export const T_CUENTAS = 'carruseles_biblioteca_cuentas';
export const T_TEMAS = 'carruseles_biblioteca_temas';
export const T_PIEZAS = 'carruseles_biblioteca_piezas';
export const COLS_CUENTA = 'id, instagram, nombre, fuente, referente, estado, motivo, foto, leida_en';
export const COLS_TEMA = 'id, hashtag, nombre, activo, leido_en';
/** Cuántas publicaciones se leen como mucho, de la MÁS NUEVA a la más vieja (si se cortara por las viejas, lo nuevo no
 *  entraría nunca). Al explorador llegan menos: `recortarBiblioteca`. */
const PIEZAS_A_LEER = 4000;
/** Las publicaciones son las mismas para todos los negocios y cambian una vez por corrida del script: se releen cada 2
 *  minutos, no en cada visita. Los creadores se leen SIEMPRE: así uno que pidió salir deja de verse en el acto. */
const CACHE_PIEZAS_MS = 120_000;
const CACHE = Symbol.for('mako.carruseles.biblioteca.piezas');
type CachePiezas = { hasta: number; piezas: PiezaBiblioteca[] };
const enCache = globalThis as unknown as Record<symbol, CachePiezas | undefined>;

/** ¿La tabla no existe (la 0392 sin aplicar)? Eso no es un error: todavía no hay biblioteca. */
export const faltaLaTabla = (e: { code?: string } | null | undefined): boolean => e?.code === '42P01' || e?.code === 'PGRST205';

/** Los creadores (activos y fuera). `null` = la tabla no existe todavía. Tira si no pudo leer. */
export async function cuentasDeBiblioteca(): Promise<CuentaBiblioteca[] | null> {
  const r = await leerTodas<CuentaBiblioteca>(T_CUENTAS, COLS_CUENTA);
  return r;
}

/** Los temas. `null` = la tabla no existe todavía. Tira si no pudo leer. */
export async function temasDeBiblioteca(): Promise<TemaBiblioteca[] | null> {
  const { data, error } = await getSupabaseServer().from(T_TEMAS).select(COLS_TEMA).order('nombre').limit(200);
  if (error) { if (faltaLaTabla(error)) return null; throw new Error(`No pude leer los temas de la biblioteca: ${error.message}`); }
  return (data ?? []) as TemaBiblioteca[];
}

async function leerTodas<T>(tabla: string, cols: string): Promise<T[] | null> {
  const out: T[] = [];
  try {
    await leerPorPaginas<T>(getSupabaseServer(), tabla, cols, (pagina) => { out.push(...pagina); return out.length < 20000; }, { orden: 'id' });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (faltaLaTabla({ code }) || /does not exist|could not find the table/i.test(String((e as Error)?.message ?? e))) return null;
    throw e;
  }
  return out;
}

/**
 * Los carruseles de la biblioteca, listos para el explorador (sólo de creadores activos, con el texto vencido podado).
 * Lista vacía si la 0392 no está aplicada. Tira si no pudo leer: quien llama decide (el explorador sigue con lo suyo).
 */
export async function carruselesDeLaBiblioteca(ahora = Date.now()): Promise<Carrusel[]> {
  const cuentas = await cuentasDeBiblioteca();
  const activas = (cuentas ?? []).filter((c) => c.estado === 'activa');
  if (!activas.length) return [];
  // Las de un creador que salió ya se borraron (`cambiarBiblioteca`), y las que queden de uno fuera las saltea
  // `carruselesDeBiblioteca`, que mira los creadores recién leídos.
  return recortarBiblioteca(carruselesDeBiblioteca(await piezasDeLaBiblioteca(), activas, ahora), undefined, ahora);
}

async function piezasDeLaBiblioteca(): Promise<PiezaBiblioteca[]> {
  const ya = enCache[CACHE];
  if (ya && ya.hasta > Date.now()) return ya.piezas;
  const piezas: PiezaBiblioteca[] = [];
  await leerPorPaginas<Record<string, unknown>>(getSupabaseServer(), T_PIEZAS, '*', (pagina) => {
    for (const f of pagina) piezas.push(podarVencido(f) as unknown as PiezaBiblioteca);
    return piezas.length < PIEZAS_A_LEER;
  }, { orden: [{ col: 'id', asc: false }], filtros: (q) => q.is('dejo_de_verse_en', null) });
  enCache[CACHE] = { hasta: Date.now() + CACHE_PIEZAS_MS, piezas };
  return piezas;
}

/** Después de cambiar la biblioteca, lo de este proceso se relee (los demás, a los 2 minutos como mucho). */
function olvidarPiezas(): void {
  enCache[CACHE] = undefined;
}

/** La publicación `id` del explorador (negativo) si es de un creador ACTIVO de la biblioteca; null si no. Tira si no pudo leer. */
export async function carruselDeLaBiblioteca(id: number): Promise<Carrusel | null> {
  const fila = filaDeBiblioteca(id);
  if (fila == null) return null;
  const db = getSupabaseServer();
  const p = await db.from(T_PIEZAS).select('*').eq('id', fila).maybeSingle();
  if (p.error) { if (faltaLaTabla(p.error)) return null; throw new Error(p.error.message); }
  if (!p.data) return null;
  const pieza = podarVencido(p.data as Record<string, unknown>) as unknown as PiezaBiblioteca;
  const c = await db.from(T_CUENTAS).select(COLS_CUENTA).eq('id', pieza.cuenta_id).maybeSingle();
  if (c.error) throw new Error(c.error.message);
  if (!c.data) return null;
  return carruselesDeBiblioteca([pieza], [c.data as CuentaBiblioteca])[0] ?? null;
}

/** ¿Quien mira puede editar la biblioteca? El admin del negocio de la plataforma (la pantalla y la API preguntan lo mismo). */
export async function puedeEditarBiblioteca(): Promise<boolean> {
  const [ws, plataforma, rol] = await Promise.all([getWorkspaceActual(), wsSuperAdmin().catch(() => null), getRolWsEfectivo()]);
  return ws != null && plataforma != null && ws === plataforma && rol === 'admin';
}

export type BibliotecaParaEditar = {
  /** La lista (la que elige la plataforma) y los que salieron, con cuántas publicaciones tiene cada uno. */
  cuentas: Array<CuentaBiblioteca & { piezas: number }>;
  /** Cuántos creadores llegaron sólo por un tema (no se listan uno por uno: son cientos). */
  porTema: number;
  temas: Array<TemaBiblioteca & { piezas: number }>;
};

/** Lo que ve la plataforma para editar la biblioteca. `null` = la 0392 no está aplicada. */
export async function bibliotecaParaEditar(): Promise<BibliotecaParaEditar | null> {
  const [cuentas, temas] = await Promise.all([cuentasDeBiblioteca(), temasDeBiblioteca()]);
  if (!cuentas || !temas) return null;
  const porCuenta = new Map<number, number>();
  const porTemaN = new Map<number, number>();
  await leerPorPaginas<{ id: number; cuenta_id: number; tema_id: number | null }>(getSupabaseServer(), T_PIEZAS, 'id, cuenta_id, tema_id', (pagina) => {
    for (const f of pagina) {
      porCuenta.set(f.cuenta_id, (porCuenta.get(f.cuenta_id) ?? 0) + 1);
      if (f.tema_id != null) porTemaN.set(f.tema_id, (porTemaN.get(f.tema_id) ?? 0) + 1);
    }
    return true;
  }, { orden: 'id' });
  return {
    cuentas: cuentas.filter((c) => c.fuente === 'lista' || c.estado === 'excluida').map((c) => ({ ...c, piezas: porCuenta.get(c.id) ?? 0 })),
    porTema: cuentas.filter((c) => c.fuente === 'tema' && c.estado === 'activa').length,
    temas: temas.map((t) => ({ ...t, piezas: porTemaN.get(t.id) ?? 0 })),
  };
}

export type ResultadoCambio = { ok: true; ya?: string } | { ok: false; error: string; falla?: boolean };

const NO_ESTA_CREADA = 'La biblioteca todavía no está creada (falta aplicar la migración 0392).';

/**
 * Suma, saca o vuelve a sumar un creador o un tema. Sacar a un creador («lo pidió») borra sus publicaciones de la
 * biblioteca: deja de verse en todos los negocios en el acto, y no vuelve a entrar ni por un tema. La puerta
 * (`puedeEditarBiblioteca`) la pregunta quien llama: el script corre fuera de una sesión.
 */
export async function cambiarBiblioteca(pedido: CambioBiblioteca, quien: string): Promise<ResultadoCambio> {
  const quienCorto = String(quien ?? '').slice(0, 120) || 'desconocido';
  const ahora = new Date().toISOString();
  const db = getSupabaseServer();
  if (pedido.que === 'tema') {
    const hashtag = hashtagDe(pedido.valor);
    if (!hashtag) return { ok: false, error: 'Ese no es un hashtag de Instagram.' };
    const leida = await db.from(T_TEMAS).select(COLS_TEMA).eq('hashtag', hashtag).maybeSingle();
    if (leida.error) return faltaLaTabla(leida.error) ? { ok: false, error: NO_ESTA_CREADA } : { ok: false, error: 'No pude leer los temas. Vuelve a intentar.', falla: true };
    const fila = (leida.data ?? null) as TemaBiblioteca | null;
    const d = decidirCambio({ ...pedido, valor: hashtag }, fila);
    if ('error' in d) return { ok: false, error: d.error };
    if ('ya' in d) return { ok: true, ya: d.ya };
    const r = d.hacer === 'insertar' && pedido.accion === 'sumar'
      ? await db.from(T_TEMAS).insert({ hashtag, nombre: pedido.nombre.trim().slice(0, 80), activo: true, cambiado_por: quienCorto })
      : await db.from(T_TEMAS).update({ activo: d.hacer === 'reactivar', cambiado_por: quienCorto, updated_at: ahora }).eq('id', (fila as TemaBiblioteca).id);
    if (r.error) return r.error.code === '23505' ? { ok: true, ya: `#${hashtag} ya está en la biblioteca.` } : { ok: false, error: 'No pude guardar el tema. Vuelve a intentar.', falla: true };
    return { ok: true };
  }
  const instagram = cuentaDeInstagram(pedido.valor);
  if (!instagram) return { ok: false, error: 'Ese no es un usuario de Instagram.' };
  const leida = await db.from(T_CUENTAS).select(COLS_CUENTA).eq('instagram', instagram).maybeSingle();
  if (leida.error) return faltaLaTabla(leida.error) ? { ok: false, error: NO_ESTA_CREADA } : { ok: false, error: 'No pude leer la biblioteca. Vuelve a intentar.', falla: true };
  const fila = (leida.data ?? null) as CuentaBiblioteca | null;
  const d = decidirCambio({ ...pedido, valor: instagram } as CambioBiblioteca, fila);
  if ('error' in d) return { ok: false, error: d.error };
  if ('ya' in d) return { ok: true, ya: d.ya };
  if ((d.hacer === 'insertar' || d.hacer === 'excluir-nuevo') && pedido.que === 'cuenta') {
    const fuera = d.hacer === 'excluir-nuevo';
    const r = await db.from(T_CUENTAS).insert({
      instagram,
      nombre: (pedido.accion === 'sumar' ? pedido.nombre.trim() : instagram).slice(0, 120),
      referente: pedido.accion === 'sumar' ? pedido.referente?.trim() || null : null,
      fuente: 'lista', estado: fuera ? 'excluida' : 'activa', motivo: fuera && pedido.accion === 'sacar' ? pedido.motivo.trim().slice(0, 300) : null,
      cambiada_por: quienCorto,
    });
    // Dos a la vez: la otra ganó. Se vuelve a decidir contra lo que quedó.
    if (r.error) return r.error.code === '23505' ? cambiarBiblioteca(pedido, quien) : { ok: false, error: 'No pude guardar la cuenta. Vuelve a intentar.', falla: true };
    return { ok: true };
  }
  const id = (fila as CuentaBiblioteca).id;
  if (d.hacer === 'excluir' && pedido.accion === 'sacar') {
    // Primero se marca (deja de verse en el acto, aunque el borrado de abajo falle) y después se borran sus publicaciones.
    const r = await db.from(T_CUENTAS).update({ estado: 'excluida', motivo: pedido.motivo.trim().slice(0, 300), cambiada_por: quienCorto, updated_at: ahora }).eq('id', id);
    if (r.error) return { ok: false, error: 'No pude sacar la cuenta. Vuelve a intentar.', falla: true };
    const b = await db.from(T_PIEZAS).delete().eq('cuenta_id', id);
    if (b.error) console.warn('[carruseles-biblioteca] la cuenta salió pero quedaron publicaciones (no se muestran):', b.error.message);
    olvidarPiezas();
    return { ok: true };
  }
  const cambio = d.hacer === 'a-la-lista'
    ? { fuente: 'lista', nombre: pedido.accion === 'sumar' ? pedido.nombre.trim().slice(0, 120) : (fila as CuentaBiblioteca).nombre, ...(pedido.accion === 'sumar' && pedido.referente ? { referente: pedido.referente } : {}) }
    : { estado: 'activa', motivo: null };
  const r = await db.from(T_CUENTAS).update({ ...cambio, cambiada_por: quienCorto, updated_at: ahora }).eq('id', id);
  if (r.error) return { ok: false, error: 'No pude guardar la cuenta. Vuelve a intentar.', falla: true };
  return { ok: true };
}
