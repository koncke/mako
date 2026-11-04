import 'server-only';

// =============================================================================
// editor-landing/replica-borrador-server — guardar, leer, listar y borrar el borrador de una réplica (ticket #54)
// =============================================================================
// La regla y el porqué: ./replica-borrador.ts. Acá, la base: una fila de `app_settings` por dirección, en el negocio de la
// sesión (`wsObligatorio` para escribir: sin negocio no se escribe en el de nadie). La lectura del navegador se sanea con la
// MISMA función que la usa al replicar (`sanearLectura`), así lo que vuelve es lo mismo que se hubiera mandado.
//
// ⚠️ Dos pestañas sobre la MISMA dirección: gana la última que guarda (es la misma persona eligiendo). Dos direcciones son dos
//    filas y no se pisan.
// =============================================================================

import { getSupabaseServer } from '../supabase';
import { getSettingEstricto, setSetting } from '../settings';
import { getWorkspaceActual, wsObligatorio } from '../workspace';
import { sanearLectura } from './lectura-reglas';
import { urlParaReplicar } from './replicar-reglas';
import {
  PREFIJO_BORRADOR_REPLICA, TOPE_BORRADORES_REPLICA, TOPE_TEXTO_BORRADOR, borradorVigente, borradoresDeMas, claveDeBorrador,
  resumenDeBorrador, sanearBorrador, sanearEleccion, sanearLecturaReplica,
  type BorradorReplica, type ResumenBorrador,
} from './replica-borrador';

/** La lectura del navegador, saneada como al replicar; null si no es una. */
const fuenteLimpia = (f: { lectura?: unknown; texto?: unknown }) => ({
  lectura: f.lectura ? sanearLectura(f.lectura) : null,
  texto: typeof f.texto === 'string' && f.texto.trim() ? f.texto.slice(0, TOPE_TEXTO_BORRADOR) : null,
});

/** El borrador de una dirección, o null (no hay, venció o no se pudo usar). Tira si no se pudo LEER: «no sé» no es «no hay». */
export async function leerBorradorReplica(url: unknown): Promise<BorradorReplica | null> {
  const clave = claveDeBorrador(url);
  if (!clave) return null;
  const b = sanearBorrador(await getSettingEstricto(clave), String(url));
  if (!b || !borradorVigente(b)) return null;
  return { ...b, fuente: fuenteLimpia(b.fuente) };
}

/**
 * Guarda lo leído como borrador (lo llama la ruta de lectura cuando leyó bien). Conserva la fecha de creación de un borrador
 * anterior de la misma dirección, y poda los que pasan del tope o vencieron. Nunca tira: un borrador que no se guardó no
 * puede tumbar una lectura que ya se pagó (lo dice el `false`).
 */
export async function guardarBorradorReplica(p: { url: unknown; lectura: unknown; fuente: { lectura?: unknown; texto?: unknown }; eleccion: unknown }): Promise<boolean> {
  try {
    // La dirección del PEDIDO (la que la pantalla vuelve a buscar), no la de la lectura: puede ser otra si la página redirige.
    const url = urlParaReplicar(p.url);
    const lectura = sanearLecturaReplica(p.lectura);
    const clave = url ? claveDeBorrador(url) : null;
    if (!url || !lectura || !clave) return false;
    const previo = await leerBorradorReplica(url).catch(() => null);
    const ahora = new Date().toISOString();
    const b: BorradorReplica = {
      v: 1, url, lectura, fuente: fuenteLimpia(p.fuente), eleccion: sanearEleccion(p.eleccion),
      creado: previo?.creado ?? ahora, actualizado: ahora,
    };
    await setSetting(clave, JSON.stringify(b));
    await podar().catch((e: unknown) => console.error('[replica-borrador] podar:', e instanceof Error ? e.message : e));
    return true;
  } catch (e) {
    console.error('[replica-borrador] guardar:', e instanceof Error ? e.message : e);
    return false;
  }
}

/** Cambia lo elegido (qué replicar, formato, tema, «Tu oferta») de un borrador que existe. false = no había borrador. */
export async function cambiarEleccionReplica(url: unknown, eleccion: unknown): Promise<boolean> {
  const clave = claveDeBorrador(url);
  if (!clave) return false;
  const b = await leerBorradorReplica(url);
  if (!b) return false;
  const nuevo: BorradorReplica = { ...b, eleccion: sanearEleccion(eleccion), actualizado: new Date().toISOString() };
  await setSetting(clave, JSON.stringify(nuevo));
  return true;
}

/** Borra el borrador de una dirección (la réplica salió, o la persona lo descartó). */
export async function borrarBorradorReplica(url: unknown): Promise<void> {
  const clave = claveDeBorrador(url);
  if (!clave) return;
  const { error } = await getSupabaseServer().from('app_settings').delete().eq('workspace_id', await wsObligatorio()).eq('key', clave);
  if (error) throw new Error(`No pude borrar el borrador: ${error.message}`);
}

/** Las filas de borradores del negocio (clave, valor y fecha). */
async function filasDelNegocio(ws: number): Promise<Array<{ clave: string; valor: unknown; actualizado: string }>> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('key, value, updated_at')
    .eq('workspace_id', ws).like('key', `${PREFIJO_BORRADOR_REPLICA}%`).order('updated_at', { ascending: false }).limit(40);
  if (error) throw new Error(`No pude leer los borradores: ${error.message}`);
  // `_` es un comodín de LIKE: se vuelve a mirar el prefijo exacto.
  return (data ?? []).filter((f) => String(f.key).startsWith(PREFIJO_BORRADOR_REPLICA))
    .map((f) => ({ clave: String(f.key), valor: f.value, actualizado: String(f.updated_at ?? '') }));
}

/** Los borradores vigentes del negocio, los más nuevos primero. Tira si no pudo leer. */
export async function listarBorradoresReplica(): Promise<ResumenBorrador[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];
  return (await filasDelNegocio(ws))
    .map((f) => sanearBorrador(f.valor))
    .filter((b): b is BorradorReplica => !!b && borradorVigente(b))
    .sort((a, b) => Date.parse(b.actualizado) - Date.parse(a.actualizado))
    .slice(0, TOPE_BORRADORES_REPLICA)
    .map(resumenDeBorrador);
}

/** Borra los que pasan del tope o vencieron. */
async function podar(): Promise<void> {
  const ws = await wsObligatorio();
  const sobran = borradoresDeMas((await filasDelNegocio(ws)).map((f) => {
    const b = sanearBorrador(f.valor);
    return { clave: f.clave, actualizado: b?.actualizado ?? f.actualizado };
  }));
  if (!sobran.length) return;
  const { error } = await getSupabaseServer().from('app_settings').delete().eq('workspace_id', ws).in('key', sobran);
  if (error) throw new Error(error.message);
}
