// =============================================================================
// copywriter/mudanza — la primera vez que un negocio abre el Copywriter, lo que ya tenía pasa a páginas (UNA vez)
// =============================================================================
// Pedido de Martín (29/10/2026): «Lo que hoy tiene Copywriter y sirve se migra a páginas». Qué se muda y cómo, en
// ./mudanza-reglas.ts (puro, con su test). Diseño: docs/diseno-copywriter.md (D14).
//
// Tres decisiones que no se ven:
//   · UNA VEZ POR NEGOCIO, con su marca en `mako.copywriter.mudanza` tomada por compare-and-set ANTES de escribir: dos
//     pestañas que abren a la vez no mudan dos veces (la que pierde la marca no hace nada).
//   · «NO PUDE LEER» NO ES «NO HAY»: si la matriz o el historial no se pudieron leer, la marca no queda como hecha y la
//     próxima apertura lo vuelve a intentar (la marca «en curso» vence a los 10 minutos).
//   · NUNCA FRENA LA PANTALLA: cualquier falla se anota en el log y la tab abre igual.
// =============================================================================

import 'server-only';
import { cambiarSettingSi, getSettingEstricto } from '../settings';
import { catalogosDelCopywriter } from './catalogos-server';
import { crearVarias, listar } from './server';
import { loQueSeMuda, paginasDeAdsWriter, paginasDeReels } from './mudanza-reglas';
import { TOPES } from './tipos';

export const CLAVE_MUDANZA = 'mako.copywriter.mudanza';
const VENCE_MS = 10 * 60_000;

type Marca = { estado: 'en-curso' | 'hecha'; at: string; paginas?: number };
const leerMarca = (raw: string | null): Marca | null => { try { const m = raw ? JSON.parse(raw) as Marca : null; return m && (m.estado === 'hecha' || m.estado === 'en-curso') ? m : null; } catch { return null; } };

/** Muda lo de antes si todavía no se hizo en este negocio. Devuelve cuántas páginas creó (0 si no hizo nada). */
export async function mudarLoDeAntes(): Promise<number> {
  try {
    const crudo = await getSettingEstricto(CLAVE_MUDANZA);
    const marca = leerMarca(crudo);
    if (marca?.estado === 'hecha') return 0;
    if (marca?.estado === 'en-curso' && Date.now() - Date.parse(marca.at) < VENCE_MS) return 0;
    // Tomar la marca: si otra pestaña la tomó en el medio, no se hace nada acá.
    const enCurso = JSON.stringify({ estado: 'en-curso', at: new Date().toISOString() } satisfies Marca);
    if (!(await cambiarSettingSi(CLAVE_MUDANZA, crudo, enCurso))) return 0;

    const [razones, reels, catalogos, indice] = await Promise.all([
      getSettingEstricto('mako.razones'), getSettingEstricto('reels.historial'), catalogosDelCopywriter(), listar(),
    ]);
    if (!indice.ok) throw new Error(indice.error);
    const parse = (s: string | null) => { if (!s) return null; try { return JSON.parse(s) as unknown; } catch { return null; } };
    const catalogo = { angulos: new Set(catalogos.angulos.map((a) => a.id)), estructuras: new Set(catalogos.estructuras.map((e) => e.id)) };
    const paginas = loQueSeMuda([paginasDeAdsWriter(parse(razones), catalogo), paginasDeReels(parse(reels))], TOPES.paginas - indice.paginas.length - 20);
    let creadas = 0;
    if (paginas.length) {
      const r = await crearVarias(paginas.map((p) => ({ clave: p.clave, padreClave: p.padreClave, titulo: p.titulo, tipo: p.tipo, emoji: p.emoji, props: p.props, contenido: p.contenido })));
      if (!r.ok) throw new Error(r.error);
      creadas = r.creadas;
    }
    await cambiarSettingSi(CLAVE_MUDANZA, enCurso, JSON.stringify({ estado: 'hecha', at: new Date().toISOString(), paginas: creadas } satisfies Marca));
    return creadas;
  } catch (e) {
    console.warn('[copywriter] la mudanza de lo de antes no se hizo:', e instanceof Error ? e.message : e);
    return 0;
  }
}
