// =============================================================================
// copywriter/replica-servidor — lo que MaKo necesita saber ANTES de escribir una réplica (server; 13/11/2026)
// =============================================================================
// El flujo nuevo de Copywriting (la maqueta que aprobó el Cerebro el 13/11/2026, el relevo de «escribe casi que cualquier cosa»):
// al replicar, MaKo pregunta primero (app/copywriter/PanelMaKo.tsx). Para preguntar necesita:
//   · las ofertas del negocio y lo que le falta a cada una de lo mínimo (./oferta-elegida.ts, `faltaDeLaOferta`);
//   · de qué habla el original y si tiene que ver con el negocio (./tema.ts): si no tiene que ver, pregunta cómo usarlo.
// Y lo que la persona contesta de su oferta se GUARDA en la oferta (`completarOferta`).
// =============================================================================

import 'server-only';
import { listarOfertas, upsertOferta } from '../ofertas';
import { listProductos, type Producto } from '../productos';
import type { Oferta, OfertaInput } from '../oferta-modelo';
import { outlierCopyPorId, temaDelNegocioActual } from './outliers-servidor';
import { datoDeOferta, faltaDeLaOferta, type CampoQueFalta } from './oferta-elegida';
import { temaDeTexto, temaRelacionado, type Tema } from './tema';
import type { Falla } from './server';

/** Una oferta como la necesita la pregunta: su nombre y lo que le falta. */
export type OfertaParaReplica = { id: number; nombre: string; falta: CampoQueFalta[] };

export type PreparacionReplica = {
  ok: true;
  /** De qué habla el original y el negocio (null = no se sabe), y si van juntos. Sin uno de los dos, `relacionado` es true. */
  tema: { original: Tema | null; negocio: Tema | null; relacionado: boolean };
  ofertas: OfertaParaReplica[];
};

/** El producto que acompaña a una oferta: el del mismo nombre (lib/copywriter/ia.ts lo busca igual). */
const productoDe = (o: Pick<Oferta, 'nombre'>, ps: readonly Producto[]) => ps.find((p) => p.nombre.trim().toLowerCase() === o.nombre.trim().toLowerCase()) ?? null;

export async function prepararReplica(outlier: string): Promise<PreparacionReplica | Falla> {
  let o: Awaited<ReturnType<typeof outlierCopyPorId>>;
  try { o = await outlierCopyPorId(outlier); } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer el original.', status: 500 };
  }
  if (!o) return { ok: false, error: 'Ese original ya no está.', status: 404 };
  const [negocio, ofertas, productos] = await Promise.all([
    temaDelNegocioActual().catch(() => null),
    listarOfertas(true).catch((): Oferta[] => []),
    listProductos(true).catch((): Producto[] => []),
  ]);
  const original = temaDeTexto(`${o.gancho}\n${o.texto}`);
  return {
    ok: true,
    tema: { original, negocio, relacionado: !original || !negocio || temaRelacionado(negocio.id, original.id) },
    ofertas: ofertas.map((x) => ({ id: x.id, nombre: x.nombre, falta: faltaDeLaOferta(x, productoDe(x, productos)) as CampoQueFalta[] })),
  };
}

/**
 * Guarda en la oferta lo que la persona contestó. ⚠️ Con la oferta ENTERA: `upsertOferta` (lib/ofertas.ts → `fila`) escribe null
 * en los campos de texto que NO vienen (`input.promesa?.trim() || null`), así que mandar sólo el campo nuevo borraba los demás.
 */
export async function completarOferta(id: number, campo: CampoQueFalta, valor: string): Promise<{ ok: true; oferta: OfertaParaReplica } | Falla> {
  if (!valor.trim()) return { ok: false, error: 'Falta la respuesta.', status: 400 };
  const [ofertas, productos] = await Promise.all([listarOfertas(), listProductos(true).catch((): Producto[] => [])]);
  const actual = ofertas.find((x) => x.id === id);
  if (!actual) return { ok: false, error: 'Esa oferta ya no está.', status: 404 };
  // `es_principal` y `desde_brief` viajan pero `fila` no los escribe (tienen sus funciones propias).
  const input: OfertaInput = { ...actual, ...datoDeOferta(campo, valor) };
  try { await upsertOferta(input, id); } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar en la oferta.', status: 500 };
  }
  const nueva = { ...actual, ...input } as Oferta;
  return { ok: true, oferta: { id, nombre: nueva.nombre, falta: faltaDeLaOferta(nueva, productoDe(nueva, productos)) as CampoQueFalta[] } };
}
