// =============================================================================
// copywriter/outliers-servidor — leer los outliers de copy, uno por su id, y «Replicar» (server; 11/11/2026)
// =============================================================================
// Diseño: docs/diseno-copywriter.md, D18. El contrato y lo puro: ./outliers.ts. Para sumar una fuente: un `FuenteOutliersCopy`
// más en `FUENTES_OUTLIERS_COPY` (el molde es lib/video-outliers-servidor.ts). Una fuente que tira no tumba la portada: queda
// como caída, con su motivo.
//
// NO GASTA NADA: lee lo que Competitors Spy YA trajo (`spy_competidores` + `spy_piezas`, por el proxy del inquilino, y los guiones
// que ya se transcribieron al abrir un detalle) y la biblioteca de carruseles de la plataforma. No llama a Apify, a Meta ni a
// ninguna IA, y no transcribe.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '../workspace';
import { cachedRead } from '../cache';
import { leerPorPaginas } from '../supabase-paginado';
import { podarVencido } from '../spy-reglas';
import { guionesGuardados } from '../spy-transcripcion-servidor';
import { carruselDeLaBiblioteca, carruselesDeLaBiblioteca } from '../carruseles/biblioteca-servidor';
import { rotuloMultiplo } from '../multiplo-rendimiento';
import { crear, type Falla } from './server';
import { docVacio } from './doc';
import { propsNuevas, type GuionAbierto, type PaginaCopy } from './tipos';
import {
  esIdOutlierCopy, juntarOutliersCopy, outliersCopyDeBiblioteca, outliersCopyDeSpy, textoParaMaKo, tipoDeOutlier, tituloDeReplica,
  type CuentaSpyCopy, type FuenteOutliersCopy, type LecturaFuenteCopy, type OutlierCopy, type PiezaSpyCopy, type PortadaCopy,
} from './outliers';

/** Cuántas piezas de Spy se leen como mucho (todas las cuentas juntas), como los reels de Video y los carruseles de Image. */
export const PIEZAS_A_LEER = 6000;
/** Los canales de Spy que traen copy (una landing no). */
const CANALES = ['instagram', 'youtube', 'anuncios'];

/** Los guiones ya transcriptos de esas cuentas (Spy los guarda por cuenta): uno que no se pudo leer no frena la portada. */
async function guionesDe(cuentas: readonly number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const leidos = await Promise.all(cuentas.map((id) => guionesGuardados(id).catch(() => new Map<number, string>())));
  for (const m of leidos) for (const [k, v] of m) out.set(k, v);
  return out;
}

/** Las piezas de las cuentas que el negocio sigue en Competitors Spy. Sin cuentas (o sin las tablas de Spy), ninguna. */
export const FUENTE_SPY_COPY: FuenteOutliersCopy = {
  id: 'spy',
  nombre: 'las cuentas que sigues en Competitors Spy',
  leer: async (): Promise<LecturaFuenteCopy> => {
    const db = await getTenantDb();
    const comp = await db.from('spy_competidores').select('id, nombre, instagram, avatar').limit(100);
    if (comp.error) {
      // Spy sin tablas no es un error del negocio: no sigue a nadie todavía.
      if (comp.error.code === '42P01') return { ok: true, outliers: [] };
      return { ok: false, motivo: comp.error.message };
    }
    const cuentas = (comp.data ?? []) as CuentaSpyCopy[];
    if (!cuentas.length) return { ok: true, outliers: [] };
    const piezas: PiezaSpyCopy[] = [];
    // `*` y no una lista de columnas: `medio` y `laminas` (mig 0391) pueden no existir, y una columna nombrada que falta rechaza
    // la consulta (lo mismo que Video y Image).
    await leerPorPaginas<Record<string, unknown>>(db, 'spy_piezas', '*', (pagina) => {
      for (const f of pagina) piezas.push(podarVencido(f) as unknown as PiezaSpyCopy);
      return piezas.length < PIEZAS_A_LEER;
    }, { orden: 'id', filtros: (q) => q.in('canal', CANALES).in('competidor_id', cuentas.map((c) => c.id)) });
    const guiones = await guionesDe(cuentas.map((c) => c.id));
    return { ok: true, outliers: outliersCopyDeSpy(piezas, cuentas, guiones) };
  },
};

/** La biblioteca de carruseles de la plataforma (la que Image muestra a todos los negocios). */
export const FUENTE_BIBLIOTECA_COPY: FuenteOutliersCopy = {
  id: 'biblioteca',
  nombre: 'la biblioteca de carruseles',
  leer: async (): Promise<LecturaFuenteCopy> => ({ ok: true, outliers: outliersCopyDeBiblioteca(await carruselesDeLaBiblioteca()) }),
};

/** Las fuentes, en orden: lo del negocio primero. Los anuncios propios (`ad_transcripts`) entran acá (D18, lo que sigue). */
export const FUENTES_OUTLIERS_COPY: readonly FuenteOutliersCopy[] = [FUENTE_SPY_COPY, FUENTE_BIBLIOTECA_COPY];

/**
 * La portada armada, por negocio, unos minutos en la memoria del server. 11/11/2026, Martín: «anda increíblemente lento». Medido
 * en producción: 3,8 s hasta el primer byte, casi todo en leer ~2.500 piezas de Spy, sus guiones y la biblioteca. Spy cambia una
 * vez por día: cinco minutos de atraso no se notan, y volver a la portada (después de replicar) no lo paga otra vez. Una portada
 * con una fuente caída no se guarda (la próxima vuelve a intentar). Sólo con las fuentes de siempre (los tests pasan las suyas).
 */
const PORTADAS = new Map<number, { hasta: number; portada: PortadaCopy }>();
export const VIVE_LA_PORTADA_MS = 5 * 60_000;

/** Lee las fuentes y arma la portada (sin guardar nada). */
async function armarPortada(fuentes: readonly FuenteOutliersCopy[]): Promise<PortadaCopy> {
  const lecturas = await Promise.all(fuentes.map(async (fuente) => {
    let lectura: LecturaFuenteCopy;
    try { lectura = await fuente.leer(); } catch (e) {
      lectura = { ok: false, motivo: e instanceof Error && e.message ? e.message.slice(0, 200) : 'No respondió.' };
    }
    return { fuente, lectura };
  }));
  return juntarOutliersCopy(lecturas);
}

/** Una portada con una fuente caída: sale de la caché compartida como error, así no se guarda (y se muestra igual). */
class PortadaConCaidas extends Error {
  constructor(readonly portada: PortadaCopy) { super('Una fuente de la portada no respondió.'); }
}

/**
 * ⚠️ La memoria de arriba es de UNA instancia del server, y en Vercel casi nunca se reusa: el 13/11/2026 la portada seguía dando
 * 4,9 s hasta el primer byte en cada apertura (contra 0,5–1 s del resto de la tab), el «tarda mucho en abrir» de la llamada con
 * Leila. La caché de datos de Next (`cachedRead`, lib/cache.ts: por negocio, con el workspace fijado adentro) la comparten todas.
 */
const portadaCompartida = cachedRead('copywriter-portada', async (): Promise<PortadaCopy> => {
  const portada = await armarPortada(FUENTES_OUTLIERS_COPY);
  if (portada.caidas.length) throw new PortadaConCaidas(portada);
  return portada;
}, { tags: ['copywriter-portada'], revalidate: VIVE_LA_PORTADA_MS / 1000 });

export async function leerOutliersCopy(fuentes: readonly FuenteOutliersCopy[] = FUENTES_OUTLIERS_COPY): Promise<PortadaCopy> {
  if (fuentes !== FUENTES_OUTLIERS_COPY) return armarPortada(fuentes);
  const ws = await getWorkspaceActual().catch(() => null);
  const guardada = ws != null ? PORTADAS.get(ws) : undefined;
  if (guardada && guardada.hasta > Date.now()) return guardada.portada;
  let portada: PortadaCopy;
  try {
    portada = await portadaCompartida();
  } catch (e) {
    // Una fuente caída (no se guarda), o la caché que no contestó: se arma acá.
    portada = e instanceof PortadaConCaidas ? e.portada : await armarPortada(fuentes);
  }
  if (ws != null && !portada.caidas.length) PORTADAS.set(ws, { hasta: Date.now() + VIVE_LA_PORTADA_MS, portada });
  return portada;
}

/**
 * UN outlier, con su texto ENTERO (el de la portada viaja cortado), del negocio de la pestaña. null = no existe o no es de este
 * negocio (una pieza de Spy de otro negocio no se encuentra: el proxy del inquilino filtra). Tira si la base no contesta.
 */
export async function outlierCopyPorId(id: string): Promise<OutlierCopy | null> {
  if (!esIdOutlierCopy(id)) return null;
  const [fuente, crudo] = id.split(':');
  const n = Number(crudo);
  if (fuente === 'biblioteca') {
    const c = await carruselDeLaBiblioteca(n);
    return c ? outliersCopyDeBiblioteca([c])[0] ?? null : null;
  }
  const db = await getTenantDb();
  const p = await db.from('spy_piezas').select('*').eq('id', n).maybeSingle();
  if (p.error) throw new Error(p.error.message);
  if (!p.data) return null;
  const pieza = podarVencido(p.data as Record<string, unknown>) as unknown as PiezaSpyCopy;
  const c = await db.from('spy_competidores').select('id, nombre, instagram, avatar').eq('id', pieza.competidor_id).maybeSingle();
  if (c.error) throw new Error(c.error.message);
  if (!c.data) return null;
  const guiones = await guionesDe([pieza.competidor_id]);
  // El múltiplo se mide contra su cuenta: sin las demás piezas no hay número (MaKo recibe lo que sí se sabe).
  return outliersCopyDeSpy([pieza], [c.data as CuentaSpyCopy], guiones)[0] ?? null;
}

/** El original como lo lee MaKo (la referencia del server en cada pedido de la página replicada). */
export async function originalParaMaKo(id: string): Promise<string | null> {
  const o = await outlierCopyPorId(id);
  if (!o) return null;
  const veces = o.multiplo && o.multiplo.veces != null ? rotuloMultiplo(o.multiplo.veces) : null;
  return textoParaMaKo(o, veces);
}

/**
 * «Replicar»: una página del tipo del original, vacía, con `props.outlier`. La escribe MaKo después (pregunta para qué oferta,
 * con botones: lib/copywriter/iniciativa.ts), a la vista y como propuesta. 404 si el outlier no es de este negocio.
 */
export async function replicarOutlier(id: string): Promise<({ ok: true; paginas: PaginaCopy[] } & GuionAbierto) | Falla> {
  let o: OutlierCopy | null;
  try { o = await outlierCopyPorId(id); } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer el original.', status: 500 };
  }
  if (!o) return { ok: false, error: 'Ese original ya no está.', status: 404 };
  const tipo = tipoDeOutlier(o);
  return crear({ tipo, titulo: tituloDeReplica(o), props: { ...propsNuevas(tipo), outlier: o.id }, contenido: docVacio() });
}
