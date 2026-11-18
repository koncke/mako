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
//     próxima apertura lo vuelve a intentar. Y eso incluye un JSON ROTO (18/11/2026, B5): antes se leía como «no hay» y la
//     marca quedaba «hecha». Ahora lo que se puede leer se muda igual, y la marca espera al reintento.
//   · SIN LUGAR NO ES «HECHA» (B4): con el índice casi lleno no entraba nada y la marca quedaba «hecha» con 0. Lo que no entra
//     por el tope de páginas espera: cuando la persona libera lugar, la próxima apertura lo trae. El tope de la mudanza
//     (`TOPE_MUDANZA`) es otra cosa: se eligió a propósito y lo de más queda en su matriz.
//   · LO MUDADO NACE CON LA FECHA DE SU ORIGEN (B3): con «ahora», /copywriter abría un Reel mudado y no la última página del
//     usuario (`fechasDeLoMudado`, en ./mudanza-reglas.ts).
//   · NUNCA FRENA LA PANTALLA: cualquier falla se anota en el log y la tab abre igual.
// =============================================================================

import 'server-only';
import { cambiarSettingSi, getSettingEstricto } from '../settings';
import { getWorkspaceActual } from '../workspace';
import { catalogosDelCopywriter } from './catalogos-server';
import { crearVarias, listar } from './server';
import { fechasDeLoMudado, idDeMudanza, leerLoDeAntes, loQueSeMuda, paginasDeAdsWriter, paginasDeReels, quedanAfuera } from './mudanza-reglas';
import { TOPES } from './tipos';
import { escondida } from './arbol';

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
    const deReels = leerLoDeAntes(reels);
    const deRazones = leerLoDeAntes(razones);
    const ilegibles = [!deReels.ok && 'reels.historial', !deRazones.ok && 'mako.razones'].filter(Boolean);
    const catalogo = { angulos: new Set(catalogos.angulos.map((a) => a.id)), estructuras: new Set(catalogos.estructuras.map((e) => e.id)) };
    const grupos = [paginasDeReels(deReels.ok ? deReels.valor : null), paginasDeAdsWriter(deRazones.ok ? deRazones.valor : null, catalogo)];
    const id = (clave: string) => idDeMudanza(ws ?? 0, clave);
    // El lugar se cuenta SIN lo que una corrida anterior ya mudó: así el reintento elige las MISMAS páginas que la primera.
    // Y la fecha de lo mudado, contra la última página PROPIA (B3): lo de antes nunca le gana a lo último del usuario.
    const mudables = new Set(grupos.flat().map((p) => id(p.clave)));
    const propias = indice.paginas.filter((p) => !mudables.has(p.id));
    // La que abre /copywriter es la más reciente A LA VISTA (`masReciente`): una de la Papelera no cuenta.
    const ultimaPropia = propias.filter((p) => !escondida(indice.paginas, p.id))
      .reduce<string | null>((m, p) => (!m || p.actualizado > m ? p.actualizado : m), null);
    const lugar = TOPES.paginas - propias.length - 20;
    const paginas = loQueSeMuda(grupos, lugar);
    let afuera = quedanAfuera(grupos, lugar);
    let creadas = 0;
    if (paginas.length) {
      const fechas = fechasDeLoMudado(paginas, ultimaPropia, new Date().toISOString());
      const r = await crearVarias(paginas.map((p) => ({
        id: id(p.clave), padreId: p.padreClave ? id(p.padreClave) : null, titulo: p.titulo, tipo: p.tipo, emoji: p.emoji, props: p.props, contenido: p.contenido,
        actualizado: fechas.get(p.clave),
      })));
      if (!r.ok) throw new Error(r.error);
      creadas = r.creadas;
      afuera += r.sinLugar;
      if (r.faltan) {
        console.warn(`[copywriter] la mudanza dejó ${r.faltan} página(s) para el próximo intento (la marca vence en 10 minutos)`);
        return creadas;
      }
    }
    // Lo que no se pudo leer o no entró no se da por mudado: la marca queda «en curso», vence y la próxima apertura reintenta.
    if (ilegibles.length || afuera) {
      if (ilegibles.length) console.warn(`[copywriter] la mudanza no pudo leer ${ilegibles.join(' y ')} (no es JSON): queda para el próximo intento`);
      if (afuera) console.warn(`[copywriter] la mudanza dejó ${afuera} página(s) esperando lugar en el índice (el tope de ${TOPES.paginas})`);
      return creadas;
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
