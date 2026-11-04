// =============================================================================
// carruseles/crear-servidor — «Hacer el mío»: crear un carrusel con la ESTRUCTURA de uno de las cuentas que sigue el negocio
// =============================================================================
// Una sola función para la pantalla (app/image-editor/carruseles/actions.ts) y la API de MaKo
// (`crear_carrusel_desde_referencia`, lib/api-mako/areas/imagen.run.ts): la referencia se vuelve a leer de la base del
// negocio (nunca lo que mande el navegador), se le saca la estructura (./referencia.ts: tipo, láminas, con qué abre y qué
// pide al final) y se arma el documento del tipo con las GUÍAS en cada lámina. Su texto no viaja al diseño: va en las notas
// de la primera página quién es y el link a su publicación.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { crearDiseno } from '../image-editor/server';
import { getTenantDb } from '../workspace';
import { podarVencido } from '../spy-reglas';
import { documentoDeCarrusel } from './documento';
import { carruselesDe, type Carrusel, type CompetidorParaCarrusel, type PiezaParaCarrusel } from './explorar';
import { marcaDelNegocio } from './marca';
import { estructuraDe, laminasDesde, notasDe, planDeReferencia } from './referencia';

/** La publicación `id` del negocio como carrusel del explorador; null = no es una de las suyas (o ya no se ve). Tira si no pudo leer. */
export async function referenciaDelNegocio(id: number): Promise<Carrusel | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = await getTenantDb();
  const p = await db.from('spy_piezas').select('*').eq('id', id).eq('canal', 'instagram').eq('tipo', 'publicacion').maybeSingle();
  if (p.error) throw new Error(p.error.message);
  if (!p.data) return null;
  const pieza = podarVencido(p.data as Record<string, unknown>) as unknown as PiezaParaCarrusel;
  const c = await db.from('spy_competidores').select('id, nombre, instagram, avatar').eq('id', pieza.competidor_id).maybeSingle();
  if (c.error) throw new Error(c.error.message);
  if (!c.data) return null;
  return carruselesDe([pieza], [c.data as CompetidorParaCarrusel])[0] ?? null;
}

export type CreadoDesdeReferencia =
  | { ok: true; id: string; titulo: string; tipo: string; laminas: number; de: string }
  | { ok: false; error: string; falla?: boolean };

/** Crea el diseño en el negocio `ws`. `tipo` y `laminas` son lo que eligió la persona; sin ellos, lo que se entendió. */
export async function crearCarruselDesdeReferencia(ws: number, quien: string, id: number, tipo?: unknown, laminas?: unknown): Promise<CreadoDesdeReferencia> {
  let c: Carrusel | null;
  try { c = await referenciaDelNegocio(id); } catch { return { ok: false, error: 'No pude leer ese carrusel. Vuelve a intentar.', falla: true }; }
  if (!c) return { ok: false, error: 'Ese carrusel no está entre los de las cuentas que sigues en Spy.' };
  const e = estructuraDe(c);
  const plan = planDeReferencia(e, tipo, laminas);
  if ('error' in plan) return { ok: false, error: plan.error };
  const doc = documentoDeCarrusel({
    laminas: laminasDesde(e, plan.tipo.id, plan.laminas), estilo: plan.tipo.estilo, marca: await marcaDelNegocio(ws), nuevoId: randomUUID, notas: notasDe(e),
  });
  const titulo = `Carrusel · ${plan.tipo.nombre}`;
  const r = await crearDiseno(ws, quien, { titulo, doc });
  if (!r.ok) return { ok: false, error: r.error, falla: true };
  return { ok: true, id: r.id, titulo, tipo: plan.tipo.id, laminas: plan.laminas, de: e.de };
}
