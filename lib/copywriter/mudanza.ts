// =============================================================================
// copywriter/mudanza — la primera vez que un negocio abre el Copywriter, lo que ya tenía pasa a páginas (UNA vez)
// =============================================================================
// Pedido de Martín (29/10/2026): «Lo que hoy tiene Copywriter y sirve se migra a páginas». Qué se muda y cómo, en
// ./mudanza-reglas.ts (puro, con su test). Diseño: docs/diseno-copywriter.md (D14).
//
// Las decisiones que no se ven:
//   · UNA VEZ POR NEGOCIO, con su marca en `mako.copywriter.mudanza` tomada por compare-and-set ANTES de escribir: dos
//     pestañas que abren a la vez no mudan dos veces (la que pierde la marca no hace nada).
//   · REPETIRLA NO DUPLICA: cada página tiene el id de su origen (`idDeMudanza`) y `crearVarias` saltea lo que ya está.
//     ⚠️ La marca protege de DOS PESTAÑAS A LA VEZ, no de un CORTE A LA MITAD (verificación del Cerebro de 544991179,
//     ALTA): si la última escritura (la marca «hecha») no llegaba, a los 10 minutos se mudaba todo otra vez, 7 → 14.
//   · «HECHA» SÓLO SI ENTRÓ TODO LO QUE ENTRABA: si un documento no se pudo escribir, la marca queda «en curso», vence a
//     los 10 minutos y la próxima apertura muda lo que faltó (MEDIA: un Reel que fallaba una vez no se mudaba nunca, y la
//     tab Reels ya no existe para verlo). Lo que no entra por el tope sí queda donde estaba.
//   · LOS REELS PRIMERO: son pocos y no tienen otra pantalla; el Ads Writer sigue con su matriz (MEDIA: en un negocio con
//     300 guiones, el Ads Writer llenaba el tope y no entraba ningún Reel).
//   · «NO PUDE LEER» NO ES «NO HAY»: si la matriz o el historial no se pudieron leer, la marca no queda como hecha y la
//     próxima apertura lo vuelve a intentar.
//   · NUNCA FRENA LA PANTALLA: cualquier falla se anota en el log y la tab abre igual.
// =============================================================================

import 'server-only';
import { cambiarSettingSi, getSettingEstricto } from '../settings';
import { getWorkspaceActual } from '../workspace';
import { catalogosDelCopywriter } from './catalogos-server';
import { crearVarias, listar } from './server';
import { idDeMudanza, loQueSeMuda, paginasDeAdsWriter, paginasDeReels } from './mudanza-reglas';
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

    const [razones, reels, catalogos, indice, ws] = await Promise.all([
      getSettingEstricto('mako.razones'), getSettingEstricto('reels.historial'), catalogosDelCopywriter(), listar(), getWorkspaceActual(),
    ]);
    if (!indice.ok) throw new Error(indice.error);
    const parse = (s: string | null) => { if (!s) return null; try { return JSON.parse(s) as unknown; } catch { return null; } };
    const catalogo = { angulos: new Set(catalogos.angulos.map((a) => a.id)), estructuras: new Set(catalogos.estructuras.map((e) => e.id)) };
    const grupos = [paginasDeReels(parse(reels)), paginasDeAdsWriter(parse(razones), catalogo)];
    const id = (clave: string) => idDeMudanza(ws ?? 0, clave);
    // El lugar se cuenta SIN lo que una corrida anterior ya mudó: así el reintento elige las MISMAS páginas que la primera.
    const mudables = new Set(grupos.flat().map((p) => id(p.clave)));
    const propias = indice.paginas.filter((p) => !mudables.has(p.id)).length;
    const paginas = loQueSeMuda(grupos, TOPES.paginas - propias - 20);
    let creadas = 0;
    if (paginas.length) {
      const r = await crearVarias(paginas.map((p) => ({
        id: id(p.clave), padreId: p.padreClave ? id(p.padreClave) : null, titulo: p.titulo, tipo: p.tipo, emoji: p.emoji, props: p.props, contenido: p.contenido,
      })));
      if (!r.ok) throw new Error(r.error);
      creadas = r.creadas;
      if (r.faltan) {
        console.warn(`[copywriter] la mudanza dejó ${r.faltan} página(s) para el próximo intento (la marca vence en 10 minutos)`);
        return creadas;
      }
    }
    // Si esta última escritura no llega, las páginas ya están: la próxima corrida las encuentra y no crea nada.
    try {
      await cambiarSettingSi(CLAVE_MUDANZA, enCurso, JSON.stringify({ estado: 'hecha', at: new Date().toISOString(), paginas: creadas } satisfies Marca));
    } catch (e) {
      console.warn('[copywriter] la mudanza está hecha pero su marca no se escribió (se repite sin duplicar):', e instanceof Error ? e.message : e);
    }
    return creadas;
  } catch (e) {
    console.warn('[copywriter] la mudanza de lo de antes no se hizo:', e instanceof Error ? e.message : e);
    return 0;
  }
}
