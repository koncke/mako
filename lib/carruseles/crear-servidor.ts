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
import { estiloConKit, estiloSinSerif } from './marca-kit';
import { kitParaUsar } from '../marca/kits-server';
import { fuenteDelEditorDeImagen } from '../image-editor/fuente-del-editor';
import { esDeBiblioteca } from './biblioteca';
import { carruselDeLaBiblioteca } from './biblioteca-servidor';
import { estructuraDe, laminasDesde, notasDe, planDeReferencia } from './referencia';
import { anunciosDe, type PiezaAnuncio } from './anuncios';

/**
 * La publicación `id` como carrusel del explorador: una de las cuentas que sigue el negocio, o (con el id en negativo) una
 * de la biblioteca de ejemplos de un creador activo. null = no es ninguna (o ya no se ve). Tira si no pudo leer.
 */
export async function referenciaDelNegocio(id: number): Promise<Carrusel | null> {
  if (esDeBiblioteca(id)) return carruselDeLaBiblioteca(id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = await getTenantDb();
  // Una publicación de Instagram o (6/11/2026) un anuncio que Spy trajo de la Biblioteca de Anuncios (./anuncios.ts).
  const p = await db.from('spy_piezas').select('*').eq('id', id).maybeSingle();
  if (p.error) throw new Error(p.error.message);
  const fila = p.data as Record<string, unknown> | null;
  const esPublicacion = fila?.canal === 'instagram' && fila?.tipo === 'publicacion';
  const esAnuncio = fila?.canal === 'anuncios' && fila?.tipo === 'anuncio';
  if (!fila || (!esPublicacion && !esAnuncio)) return null;
  const pieza = podarVencido(fila) as unknown as PiezaParaCarrusel & PiezaAnuncio;
  const c = await db.from('spy_competidores').select('id, nombre, instagram, avatar').eq('id', pieza.competidor_id).maybeSingle();
  if (c.error) throw new Error(c.error.message);
  if (!c.data) return null;
  const competidor = c.data as CompetidorParaCarrusel;
  return (esAnuncio ? anunciosDe([pieza], [competidor]) : carruselesDe([pieza], [competidor]))[0] ?? null;
}

export type CreadoDesdeReferencia =
  /** `doc`: el diseño que se guardó (la pantalla de «Editar» lo dibuja lámina por lámina, también sin la IA). */
  | { ok: true; id: string; titulo: string; tipo: string; laminas: number; de: string; doc: Record<string, unknown> }
  | { ok: false; error: string; falla?: boolean };

/**
 * Crea el diseño en el negocio `ws`. `tipo` y `laminas` son lo que eligió la persona; sin ellos, lo que se entendió.
 * `seco`: arma el documento y NO lo guarda (el comando de prueba, scripts/carruseles-probar-editar.mts). Lo que devuelve es
 * lo mismo salvo el `id`, así que quien llama muestra las láminas igual: en seco no se saltea ningún paso del armado.
 */
export async function crearCarruselDesdeReferencia(ws: number, quien: string, id: number, tipo?: unknown, laminas?: unknown, o: { seco?: boolean } = {}): Promise<CreadoDesdeReferencia> {
  let c: Carrusel | null;
  try { c = await referenciaDelNegocio(id); } catch { return { ok: false, error: 'No pude leer ese carrusel. Vuelve a intentar.', falla: true }; }
  if (!c) return { ok: false, error: 'Ese carrusel no está entre los de las cuentas que sigues ni en la biblioteca de ejemplos.' };
  const e = estructuraDe(c);
  const plan = planDeReferencia(e, tipo, laminas);
  if ('error' in plan) return { ok: false, error: plan.error };
  // La marca del negocio (5/11/2026, lib/marca/kits.ts): el kit de por defecto pone sus colores, sus fuentes y su logo.
  const kit = await kitParaUsar().catch(() => null);
  const doc = documentoDeCarrusel({
    laminas: laminasDesde(e, plan.tipo.id, plan.laminas), estilo: estiloSinSerif(estiloConKit(plan.tipo.estilo, kit, fuenteDelEditorDeImagen), kit),
    marca: await marcaDelNegocio(ws, kit), nuevoId: randomUUID, notas: notasDe(e),
  });
  const titulo = `Carrusel · ${plan.tipo.nombre}`;
  if (o.seco) return { ok: true, id: '(seco)', titulo, tipo: plan.tipo.id, laminas: plan.laminas, de: e.de, doc };
  const r = await crearDiseno(ws, quien, { titulo, doc });
  if (!r.ok) return { ok: false, error: r.error, falla: true };
  return { ok: true, id: r.id, titulo, tipo: plan.tipo.id, laminas: plan.laminas, de: e.de, doc };
}
