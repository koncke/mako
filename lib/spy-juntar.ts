import 'server-only';

// =============================================================================
// Juntar dos competidores repetidos: las piezas se MUDAN, no se borran (6/11/2026)
// =============================================================================
// Lo que decide está en lib/spy-juntar-reglas.ts (puro y probado). Acá sólo la base, y el ORDEN es lo que importa:
//
//   1. se leen los dos (del negocio actual: `getTenantDb` ya filtra, un id de otro negocio no aparece);
//   2. se MUDAN sus piezas al que queda;
//   3. recién con la mudanza hecha se completa al que queda y se borra al que se va.
//
// ⚠️ EL ORDEN NO ES COSMÉTICO. Si se borrara primero, el `on delete cascade` de `spy_piezas` se llevaría TODO lo leído de
// esa persona y no hay vuelta atrás. Si la mudanza falla, no se borra nada: quedan los dos repetidos, que es exactamente
// el estado de antes, y se puede volver a intentar.
//
// ⚠️ LO QUE NO SE MUDA, Y POR QUÉ: la oferta leída, los guiones y las páginas capturadas del que se va se van con él
// (`quitarCompetidor` ya las borra por su clave). Es a propósito y sale gratis: al completarse con su web, el que queda
// tiene una web nueva, y `hayQueLeer` (lib/spy-oferta.ts) lee su oferta sola la próxima vez que se abre su ficha.
// =============================================================================

import { getTenantDb } from './workspace';
import { COLUMNAS_COMPETIDOR, quitarCompetidor } from './spy';
import { camposQueSeCompletan, piezasQueSeMudan, type CompetidorJuntable, type PiezaParaMudar } from './spy-juntar-reglas';

/** De a cuántas piezas se mudan por consulta: un `in` con miles de ids no entra en la URL. */
const POR_TANDA = 200;

export type Juntado = { ok: true; mudadas: number; repetidas: number } | { ok: false; error: string };

/**
 * Junta `seVaId` dentro de `quedaId`. Los dos tienen que ser del negocio actual; si alguno no está, no se toca nada.
 * `repetidas` son las piezas que el que queda ya tenía (la misma pieza leída dos veces): se van con él.
 */
export async function juntarCompetidores(quedaId: number, seVaId: number): Promise<Juntado> {
  if (!Number.isInteger(quedaId) || !Number.isInteger(seVaId) || quedaId <= 0 || seVaId <= 0) return { ok: false, error: 'No encontré a esos competidores.' };
  if (quedaId === seVaId) return { ok: false, error: 'Es el mismo competidor.' };
  const db = await getTenantDb();

  const { data: filas, error } = await db.from('spy_competidores').select(COLUMNAS_COMPETIDOR).in('id', [quedaId, seVaId]);
  if (error) return { ok: false, error: `No pude leerlos: ${error.message}` };
  const queda = (filas ?? []).find((c) => (c as { id: number }).id === quedaId) as CompetidorJuntable | undefined;
  const seVa = (filas ?? []).find((c) => (c as { id: number }).id === seVaId) as CompetidorJuntable | undefined;
  if (!queda || !seVa) return { ok: false, error: 'No encontré a esos competidores.' };

  // Las piezas de los dos, para saber cuáles se pueden mudar sin chocar con la clave única (negocio, competidor, canal, ref).
  const { data: suyas, error: e1 } = await db.from('spy_piezas').select('id, canal, ref').eq('competidor_id', seVaId);
  if (e1) return { ok: false, error: `No pude leer sus piezas: ${e1.message}` };
  const { data: delQueQueda, error: e2 } = await db.from('spy_piezas').select('canal, ref').eq('competidor_id', quedaId);
  if (e2) return { ok: false, error: `No pude leer las piezas de ${queda.nombre}: ${e2.message}` };

  const aMudar = piezasQueSeMudan((suyas ?? []) as PiezaParaMudar[], (delQueQueda ?? []) as Array<{ canal: string; ref: string }>);
  // ⚠️ PRIMERO LA MUDANZA. Un fallo acá deja a los dos como estaban: nada se borró.
  for (let i = 0; i < aMudar.length; i += POR_TANDA) {
    const tanda = aMudar.slice(i, i + POR_TANDA);
    const { error: e3 } = await db.from('spy_piezas').update({ competidor_id: quedaId }).in('id', tanda);
    if (e3) return { ok: false, error: `Mudé ${i} de ${aMudar.length} piezas y no pude seguir: ${e3.message}. No borré a nadie.` };
  }

  // Lo que el que queda no tenía, se lo lleva. Si esto falla, las piezas ya están donde tienen que estar: se sigue.
  const completar = camposQueSeCompletan(queda, seVa);
  if (Object.keys(completar).length) {
    const { error: e4 } = await db.from('spy_competidores').update({ ...completar, updated_at: new Date().toISOString() }).eq('id', quedaId);
    if (e4) console.warn(`[spy-juntar] mudé las piezas pero no pude completar a ${quedaId}: ${e4.message}`);
  }

  const fin = await quitarCompetidor(seVaId);
  if (!fin.ok) return { ok: false, error: `Mudé sus ${aMudar.length} piezas, pero no pude quitar la copia: ${fin.error}` };
  return { ok: true, mudadas: aMudar.length, repetidas: (suyas ?? []).length - aMudar.length };
}
