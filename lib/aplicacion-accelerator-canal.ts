// =============================================================================
// EL INSTAGRAM Y EL YOUTUBE DE QUIEN APLICA, con la búsqueda de Competitor Spy (16/11/2026)
// =============================================================================
// Martín, 16/11/2026: «en lugar del link de tu red social principal sea el link de tu Instagram y el link de tu YouTube… Y me
// gustaría de que reutilicemos lo que ya tenemos en Competitor Spy, que busca justamente su Instagram o su YouTube. Entonces la
// persona puede como seleccionarse su propio canal». Lo llama GET /api/accelerator/canal (el formulario de /accelerator/aplicar,
// campos `instagram` y `youtube` de lib/aplicacion-accelerator.ts). Devuelve CANDIDATOS: quien aplica elige el suyo, y nada se
// guarda acá (lo que eligió viaja con la aplicación, que se vuelve a validar entera).
//
// LO DE SPY, TAL CUAL (lib/spy-buscar.ts):
//   · Instagram por @ (o el link de su perfil, o una palabra que puede ser un @): `leerExacto`, Apify por @ (~5-10 s).
//   · Por NOMBRE (con espacios): `buscarEnGoogle`, Google por Apify (US$ 0,009 la corrida, Instagram y YouTube juntos, y Spy la
//     guarda media hora: el segundo campo no paga otra).
//   · YouTube por @ o por el link del canal: `leerCanalHallado`, la API oficial de YouTube (1 unidad de la cuota gratis).
//
// ⚠️ ES PÚBLICO Y APIFY CUESTA (y el 13/11 la clave de Spy de la plataforma contestaba 401: sin crédito). Por eso:
//   · topes por día para TODO el formulario (`TOPES_DEL_DIA`), además del de cada IP (la ruta): lo que pasa del tope no se
//     busca, y el campo queda para pegar el link (`vacio: 'limite'`);
//   · corre en el workspace de la PLATAFORMA (`runWithWorkspace(wsSuperAdmin)`; sin el contexto, `claveDeYoutube` lee el del
//     ws1, un cliente) y con SUS claves de Spy. ⚠️ Comparte los cupos diarios de Spy de ese workspace (60 búsquedas y 150 lecturas,
//     lib/instagram-perfil.ts): estos topes son más chicos a propósito, y la lectura por @ deja `RESERVA_DE_SPY` lecturas sin tocar,
//     para que el formulario nunca le gaste a Martín su propio Spy del día;
//   · si Apify no contesta (sin clave, sin crédito, la red), `vacio: 'no-anda'`, y el formulario dice «pega el link»: lo escrito
//     vale igual (`instagramDeLaAplicacion` / `youtubeDeLaAplicacion`).
// =============================================================================

import 'server-only';
import { rateLimit } from './rate-limit';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { buscarEnGoogle, leerCanalHallado, leerExacto } from './spy-buscar';
import { queBuscarDelCanal, youtubeDeLaAplicacion, type RedDeLaAplicacion } from './aplicacion-accelerator';

/** Una cuenta que se ofrece para elegir. `valor` es lo que queda escrito en el campo al elegirla (`@usuario` o el link del canal). */
export type CandidatoDeCanal = { valor: string; nombre: string | null; usuario: string; foto: string | null; seguidores: number | null };

/** Por qué no vinieron candidatos, si no es «no hay»: el formulario lo dice y deja pegar el link. */
export type PorQueSinCandidatos = 'no-anda' | 'limite' | null;

export type BusquedaDeCanal = { candidatos: CandidatoDeCanal[]; vacio: PorQueSinCandidatos };

const DIA = 24 * 3600_000;
/**
 * Cuántas búsquedas hace el formulario POR DÍA, entre todos los que aplican (cada instancia del servidor cuenta las suyas). Las de
 * Apify, pocas: la plataforma tiene 60 búsquedas y 150 lecturas de Spy por día, y son de Martín. La de YouTube por @ gasta 1
 * unidad de una cuota de 10.000.
 */
export const TOPES_DEL_DIA = { apifyPorArroba: 40, apifyPorNombre: 15, youtube: 300 } as const;
/** Las lecturas de Instagram de Spy del día que el formulario no toca (`reservaApify`): de las 150, usa a lo sumo 50. */
export const RESERVA_DE_SPY = 100;
/** Cuántos candidatos se ofrecen por nombre. */
export const CANDIDATOS_POR_NOMBRE = 5;

const httpsONull = (u: string | null | undefined): string | null => (u && /^https:\/\//.test(u) ? u : null);
const sinVacio = (v: 'sin-clave' | 'fallo' | 'limite' | null | undefined): PorQueSinCandidatos => (v === 'limite' ? 'limite' : v ? 'no-anda' : null);
const delDia = (cual: keyof typeof TOPES_DEL_DIA) => rateLimit(`accelerator-canal:${cual}`, TOPES_DEL_DIA[cual], DIA);

/**
 * Los candidatos de una red para lo escrito (`queBuscarDelCanal`). Nunca tira: lo que no se pudo es `vacio`. Una cuenta que no
 * existe es una lista vacía con `vacio: null` («no la encontré»).
 */
export async function buscarCanalDeLaAplicacion(red: RedDeLaAplicacion, q: string): Promise<BusquedaDeCanal> {
  const { exacto, nombre } = queBuscarDelCanal(red, q);
  if (!exacto && !nombre) return { candidatos: [], vacio: null };
  try {
    const ws = await wsSuperAdmin();
    return await runWithWorkspace(ws, async () => {
      if (red === 'instagram' && exacto) {
        if (!delDia('apifyPorArroba')) return { candidatos: [], vacio: 'limite' as const };
        const l = await leerExacto(ws, exacto, { reserva: RESERVA_DE_SPY });
        const p = l.perfil;
        return {
          candidatos: p ? [{ valor: `@${p.usuario}`, nombre: p.nombre, usuario: `@${p.usuario}`, foto: httpsONull(p.foto), seguidores: p.seguidores }] : [],
          vacio: p ? null : sinVacio(l.vacio),
        };
      }
      if (red === 'youtube' && exacto) {
        if (!delDia('youtube')) return { candidatos: [], vacio: 'limite' as const };
        const l = await leerCanalHallado(exacto);
        const c = l.canal;
        const valor = c ? youtubeDeLaAplicacion(c.url) : null;
        return {
          candidatos: c && valor ? [{ valor, nombre: c.nombre, usuario: c.ref.startsWith('@') ? c.ref : c.nombre ?? c.ref, foto: httpsONull(c.foto), seguidores: c.suscriptores }] : [],
          vacio: c ? null : sinVacio(l.vacio),
        };
      }
      // Por nombre: Google por Apify, la corrida de Spy (Instagram y YouTube juntos; la media hora de caché la comparte el otro campo).
      if (!delDia('apifyPorNombre')) return { candidatos: [], vacio: 'limite' as const };
      const g = await buscarEnGoogle(ws, nombre!);
      const candidatos: CandidatoDeCanal[] = red === 'instagram'
        ? g.instagram.slice(0, CANDIDATOS_POR_NOMBRE).map((p) => ({ valor: `@${p.usuario}`, nombre: p.nombre, usuario: `@${p.usuario}`, foto: httpsONull(p.foto), seguidores: p.seguidores }))
        : g.youtube.slice(0, CANDIDATOS_POR_NOMBRE).flatMap((c) => {
          const valor = youtubeDeLaAplicacion(c.url);
          return valor ? [{ valor, nombre: c.nombre, usuario: c.ref.startsWith('@') ? c.ref : c.nombre ?? c.ref, foto: httpsONull(c.foto), seguidores: c.suscriptores }] : [];
        });
      return { candidatos, vacio: candidatos.length ? null : sinVacio(red === 'youtube' ? g.vacioYoutube ?? g.vacio : g.vacio) };
    });
  } catch (e) {
    console.warn('[accelerator-canal] la búsqueda no anduvo:', e instanceof Error ? e.message : String(e));
    return { candidatos: [], vacio: 'no-anda' };
  }
}
