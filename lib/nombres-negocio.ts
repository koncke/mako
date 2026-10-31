import 'server-only';

// =============================================================================
// nombres-negocio — las palabras que en ESTE negocio no son un nombre (31/10/2026, lib/nombre-partes.ts)
// =============================================================================
// «Kun Fabiola Pedraza»: nadie más que el negocio sabe que «Kun» es un lugar. Un setting con la lista, y lo que dice cómo sale con ella.
// =============================================================================

import { getSetting, setSetting } from './settings';
import { getTenantDb } from './workspace';
import { CLAVE_NO_SON, noSonDeSetting, normalizarNoSon, resumenDeNombres, type ResumenNombres } from './nombre-partes';

/** La lista del negocio. Sin poder leerla, ninguna: el mensaje sale como salía, no se frena un envío por esto. */
export async function noSonDelNegocio(): Promise<ReadonlySet<string>> {
  return noSonDeSetting(await getSetting(CLAVE_NO_SON).catch(() => null));
}

export async function guardarNoSon(lista: unknown): Promise<string[]> {
  const limpia = normalizarNoSon(lista);
  await setSetting(CLAVE_NO_SON, JSON.stringify(limpia));
  return limpia;
}

const TANDA = 1000;
const TOPE_LEADS = 20_000;

/** Cómo saluda MaKo a la base entera. Tira si no puede leer: «no pude» no es «no hay». */
export async function nombresDelNegocio(): Promise<ResumenNombres> {
  const db = await getTenantDb();
  const nombres: Array<string | null> = [];
  let ultimo = 0;
  while (nombres.length < TOPE_LEADS) {
    const { data, error } = await db.from('leads').select('id, nombre').gt('id', ultimo).order('id', { ascending: true }).limit(TANDA);
    if (error) throw new Error(`No pude leer los nombres: ${error.message}`);
    const filas = (data ?? []) as Array<{ id: number; nombre: string | null }>;
    if (!filas.length) break;
    nombres.push(...filas.map((f) => f.nombre));
    ultimo = Number(filas[filas.length - 1].id);
    if (filas.length < TANDA) break;
  }
  return resumenDeNombres(nombres, await noSonDelNegocio());
}
