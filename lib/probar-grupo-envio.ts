// =============================================================================
// probar-grupo-envio — «Probar en el grupo»: la prueba de una automatización que SÓLO le habla al grupo (17/10/2026)
// =============================================================================
// Tarjeta #852 (Martín en la revisión del 16/10, 44:06): «que se envíen las pruebas al grupo, no solamente a los leads…
// si la automatización no tiene ningún mensaje a clientes, solamente tiene mensajes al grupo de MaKo… que se pueda probar
// en el grupo de MaKo». Lo puro (cuándo, el encabezado, las partes) vive en lib/probar-grupo.ts; acá, el envío.
//
// ⚠️ ES GENTE REAL: el grupo del negocio, con su equipo adentro. Por eso:
//   · sólo el admin (lo frena la ruta) y sólo de una automatización de ESTE negocio (se lee su nombre por id);
//   · las partes se VALIDAN como las de la tarjeta de verdad (`problemaDePartesGrupo`: el audio sólo la Voz de MaKo, el
//     archivo del negocio) y los binarios se bajan antes de mandar nada (`prepararPartesGrupo`);
//   · el primer mensaje dice que es una prueba (`ENCABEZADO_PRUEBA`), y el texto viaja con los datos DE EJEMPLO (los pone
//     el panel, `textoDeEjemplo`): nunca los de un lead;
//   · sin grupo lo dice (`sinGrupo`, leído estricto en lib/mako-grupo.ts), en vez de «no salió».
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { sanearPartes, TOPE_PARTES, type ParteMensaje } from './mensaje-partes';
import { prepararPartesGrupo, problemaDePartesGrupo } from './mako-tarjeta-envio';
import { enviarPartesAlGrupoMaKo } from './mako-grupo';
import { ENCABEZADO_PRUEBA } from './probar-grupo';
import type { PartePreparada } from './mako-tarjeta';

/** El tope del texto de una parte de la prueba (el de la tarjeta). */
const TOPE_TEXTO = 1000;

export type ResultadoPruebaGrupo = { ok: true; salieron: number } | { ok: false; error: string };

export async function enviarPruebaAlGrupo(o: { ws: number; secuenciaId: number; partes: unknown; caso: unknown }): Promise<ResultadoPruebaGrupo> {
  if (!Number.isSafeInteger(o.secuenciaId) || o.secuenciaId <= 0) return { ok: false, error: 'Automatización inválida.' };
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('id, nombre').eq('id', o.secuenciaId).maybeSingle();
  if (error) return { ok: false, error: 'No pude leer la automatización.' };
  if (!data) return { ok: false, error: 'Esa automatización no es de este negocio.' };
  const lista: ParteMensaje[] = sanearPartes(Array.isArray(o.partes) ? o.partes : [])
    .slice(0, TOPE_PARTES)
    .map((p) => (p.tipo === 'audio' ? p : { ...p, ...(p.cuerpo != null ? { cuerpo: String(p.cuerpo).slice(0, TOPE_TEXTO) } : {}) }) as ParteMensaje);
  if (!lista.length) return { ok: false, error: 'La tarjeta no tiene nada para mandar.' };
  const ajena = await problemaDePartesGrupo(lista);
  if (ajena) return { ok: false, error: ajena };
  // Los textos ya vienen con los datos de ejemplo: no se resuelve nada más (y nunca un dato de un lead).
  const p = await prepararPartesGrupo(lista, async (t) => t);
  if (!p.ok) return { ok: false, error: p.error };
  const caso = typeof o.caso === 'string' && o.caso.trim() ? o.caso.trim().slice(0, 80) : null;
  const encabezado: PartePreparada = { tipo: 'texto', texto: ENCABEZADO_PRUEBA(String((data as { nombre?: unknown }).nombre ?? ''), caso) };
  const r = await enviarPartesAlGrupoMaKo(o.ws, [encabezado, ...p.partes]);
  if (!r.ok) return { ok: false, error: r.sinGrupo ? 'Este negocio no tiene grupo de MaKo.' : (r.error ?? 'No salió.') };
  return { ok: true, salieron: r.salieron };
}
