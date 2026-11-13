// =============================================================================
// «Traer tu outlier»: un carrusel de Instagram que el negocio suma por su LINK (11/11/2026)
// =============================================================================
// Martín, 11/11/2026: «estaría bueno que en los outliers haya una opción para traer tu propio [outlier], pegar el link de
// Instagram… para poder sumarlo entre los outliers y poder trabajar sobre eso… si se necesita Apify, no hay problema».
//
// Es la lectura por link de la biblioteca (`links` de scripts/carruseles-biblioteca.mts, medida el 5/11: US$0,0025 por link)
// hecha desde la pantalla, para UN link y para UN negocio:
//   1. el link tiene que ser de una publicación (`linkDeInstagram`); un reel o un video no entran (son de la tab Video);
//   2. si ya está (de la plataforma o de este negocio) no se paga de nuevo: se devuelve. Si la trajo OTRO negocio, es pública:
//      pasa a la plataforma (mig 0413: `ref` es único);
//   3. si no, se lee con Apify: la clave de Spy del negocio y, si no tiene, la de la plataforma (Martín lo aprobó), con un
//      tope del día por negocio (`TRAIDOS_POR_DIA`) y un techo por lectura (`TECHO_USD`);
//   4. su creador se anota con `fuente: 'tema'` (NO se lee entero: sin su mediana no hay múltiplo, y lo que no se midió no se
//      dice) y las imágenes van a NUESTRO bucket (lib/carruseles/biblioteca-imagenes.ts: nunca la URL de Instagram);
//   5. se guarda con `workspace_id` = el negocio: lo ve sólo él (`seMuestraA`).
// Nunca tira: contesta un error para la pantalla.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '../supabase';
import { runWithWorkspace, wsSuperAdmin } from '../workspace';
import { clavesApifyDeSpy } from '../instagram-perfil-server';
import { piezasDeApify } from '../instagram-perfil';
import { conLaPrimeraConCredito } from '../spy-claves';
import { APIFY_ACTOR_PUBLICACIONES, entradaDeUnaPublicacion } from '../spy-todo-reglas';
import { reservarDelDia } from '../spy-todo';
import { esNuestra, guardarMiniaturas } from '../spy-miniaturas';
import { creadorDelItem, filasDeLectura, idDeBiblioteca, linkDeInstagram, traidaPor } from './biblioteca';
import { altDelItem } from './clasificar';
import { imagenesANuestroBucket, type Bajadores } from './biblioteca-imagenes';
import { esLinkDeVideo } from './link';
import { T_CUENTAS, T_PIEZAS, bajarLaminas, carruselDeLaBiblioteca, faltaLaTabla, hayColumnaWs, olvidarPiezas } from './biblioteca-servidor';
import type { Carrusel } from './explorar';

/** Cuántos links puede traer un negocio por día. Es un tope de gasto: cada lectura cuesta unos US$0,0025. */
export const TRAIDOS_POR_DIA = 20;
/** Lo más que se le deja gastar a Apify en UNA lectura (la medida es US$0,0025; el techo deja margen, nunca un sinfín). */
export const TECHO_USD = 0.01;
const CLAVE_DIA = 'carruseles.traidos.dia';
const API = 'https://api.apify.com/v2';

/** En la pantalla (una acción de Vercel): las imágenes bajan con su tope, pero más largo que el de Spy (una sola pieza). */
const BAJAR = { presupuestoMs: 25_000, esperaMs: 10_000 };
const bajadores: Bajadores = {
  bajarPortadas: (p) => guardarMiniaturas(p, BAJAR),
  bajarLaminas: (ref, urls) => bajarLaminas(ref, urls, BAJAR),
  esNuestra,
};

/**
 * `reintentar`: la falla fue PASAJERA (Apify no contestó, algo nuestro reventó) y otro intento puede andar. Sin la marca, el error
 * es definitivo (no existe, es un reel, falta configurar, el tope del día) y la pantalla NO vuelve a ofrecer «Traer»: cada intento
 * es una lectura pagada (US$0,0027) que termina igual (la prueba en producción del 11/11/2026).
 */
export type Traido = { ok: true; carrusel: Carrusel; nuevo: boolean } | { ok: false; error: string; reintentar?: true };

export async function traerCarrusel(ws: number, texto: string): Promise<Traido> {
  const link = linkDeInstagram(texto);
  if (!link) return { ok: false, error: 'Pega el link de una publicación de Instagram (el que dice /p/).' };
  // Un reel se sabe por la dirección: se dice sin pagar la lectura (que terminaba igual en «es un reel»).
  if (esLinkDeVideo(texto)) return { ok: false, error: 'Ese link es de un reel: aquí se traen carruseles y publicaciones con imagen.' };
  try {
    if (!(await hayColumnaWs())) return { ok: false, error: 'Todavía no puedo traer carruseles por su link: falta aplicar la migración 0413.' };
    const db = getSupabaseServer();

    // 2. ¿Ya está? Se devuelve sin pagar.
    const ya = await db.from(T_PIEZAS).select('id, workspace_id, dejo_de_verse_en').eq('ref', link.ref).maybeSingle();
    if (ya.error && !faltaLaTabla(ya.error)) throw new Error(ya.error.message);
    if (ya.data) {
      const fila = ya.data as { id: number; workspace_id: number | null; dejo_de_verse_en: string | null };
      const de = traidaPor(fila);
      if (de != null && de !== ws) {
        // La trajo otro negocio: es pública y ya le sirvió a dos. Pasa a la plataforma (`ref` es único, mig 0413).
        const u = await db.from(T_PIEZAS).update({ workspace_id: null }).eq('id', fila.id);
        if (u.error) throw new Error(u.error.message);
        olvidarPiezas();
      }
      if (fila.dejo_de_verse_en) return { ok: false, error: 'Ese carrusel salió de los ejemplos: no lo puedo sumar.' };
      const c = await runWithWorkspace(ws, () => carruselDeLaBiblioteca(idDeBiblioteca(fila.id)));
      return c ? { ok: true, carrusel: c, nuevo: false } : { ok: false, error: 'Ese carrusel ya está, pero su creador salió de los ejemplos.' };
    }

    // 3. Leerlo: con su clave de Spy o la de la plataforma, dentro del tope del día del negocio.
    const claves = (await clavesApifyDeSpy(ws).catch(() => [])) ?? [];
    const pagan = claves.length ? claves : ((await clavesApifyDeSpy(await wsSuperAdmin()).catch(() => [])) ?? []);
    if (!pagan.length) return { ok: false, error: 'No tengo con qué leer Instagram: falta conectar la clave de Apify en Integraciones.' };
    if (!(await runWithWorkspace(ws, () => reservarDelDia(CLAVE_DIA, TRAIDOS_POR_DIA)))) {
      return { ok: false, error: `Hoy ya trajiste ${TRAIDOS_POR_DIA} carruseles. Mañana puedes traer más.` };
    }
    const q = new URLSearchParams({ maxItems: '1', maxTotalChargeUsd: String(TECHO_USD), timeout: '60' });
    const r = await conLaPrimeraConCredito(pagan, async ({ token }) => {
      const res = await fetch(`${API}/acts/${APIFY_ACTOR_PUBLICACIONES}/run-sync-get-dataset-items?${q}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(entradaDeUnaPublicacion(link.url)), signal: AbortSignal.timeout(70_000), cache: 'no-store',
      });
      return { status: res.status, cuerpo: await res.json().catch(() => null) };
    });
    if (!r || r.status < 200 || r.status >= 300 || !Array.isArray(r.cuerpo)) {
      console.error(`[carruseles-traer] Apify no leyó ${link.url}: HTTP ${r?.status ?? '—'} (ws=${ws})`);
      // Una clave que Apify no reconoce no se arregla reintentando (13/11/2026: la única clave de Spy daba 401, «token no válido»,
      // y la pantalla decía «vuelve a intentar en un rato»).
      if (r && (r.status === 401 || r.status === 403)) {
        return { ok: false, error: 'La clave de Apify que lee Instagram ya no sirve (Apify dice que no es válida). Pega una nueva en Integraciones → Apify y vuelve a traerlo.' };
      }
      return { ok: false, error: 'No pude leer ese link ahora. Vuelve a intentar en un rato.', reintentar: true };
    }
    const items = (r.cuerpo as Array<Record<string, unknown>>).filter((it) => it && typeof it === 'object' && !('error' in it && it.error));
    const item = items.find((it) => it.shortCode === link.ref) ?? items[0];
    if (!item) return { ok: false, error: 'Instagram no me dio esa publicación: puede ser privada o estar borrada.' };

    // 4. Su creador (sin leerlo entero) y la fila, con las imágenes en nuestro bucket.
    const creador = creadorDelItem(item);
    if (!creador) return { ok: false, error: 'No pude saber de quién es esa publicación.' };
    const [pieza] = piezasDeApify([item]).map((p) => ({ ...p, creador: creador.instagram, alt: altDelItem(item) }));
    const [fila] = pieza ? filasDeLectura([pieza], { tema: null, tope: 1 }) : [];
    if (!fila) return { ok: false, error: 'Ese link es un reel o un video: aquí se traen carruseles y publicaciones con imagen.' };
    const nueva = await db.from(T_CUENTAS).upsert(
      [{ instagram: creador.instagram, nombre: creador.nombre, fuente: 'tema', cambiada_por: `negocio ${ws}` }],
      { onConflict: 'instagram', ignoreDuplicates: true },
    );
    if (nueva.error) throw new Error(nueva.error.message);
    const cuenta = await db.from(T_CUENTAS).select('id').eq('instagram', creador.instagram).maybeSingle();
    if (cuenta.error || !cuenta.data) throw new Error(cuenta.error?.message ?? 'sin la cuenta del creador');
    const [lista] = await imagenesANuestroBucket([fila], bajadores, { conLaminas: true });
    const { creador: _c, alt: _a, ...resto } = lista as Record<string, unknown>;
    const aGuardar = { ...resto, cuenta_id: (cuenta.data as { id: number }).id, workspace_id: ws };
    let g = await db.from(T_PIEZAS).insert(aGuardar).select('id').single();
    // Una columna opcional que todavía no existe (las de la 0393 o la 0404): se guarda sin ellas.
    if (g.error && /column|schema cache/i.test(g.error.message)) {
      const { parece_contenido: _p, cta: _t, cta_via: _v, ...sinOpcionales } = aGuardar as Record<string, unknown>;
      g = await db.from(T_PIEZAS).insert(sinOpcionales).select('id').single();
    }
    if (g.error || !g.data) throw new Error(g.error?.message ?? 'no se guardó');
    olvidarPiezas();
    const c = await runWithWorkspace(ws, () => carruselDeLaBiblioteca(idDeBiblioteca((g.data as { id: number }).id)));
    return c ? { ok: true, carrusel: c, nuevo: true } : { ok: false, error: 'Lo guardé, pero no lo pude mostrar. Recarga la página.' };
  } catch (e) {
    console.error(`[carruseles-traer] ${link.url} (ws=${ws}):`, e instanceof Error ? e.message : e);
    return { ok: false, error: 'No pude traer ese carrusel. Vuelve a intentar.', reintentar: true };
  }
}
