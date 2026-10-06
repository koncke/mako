'use server';

// =============================================================================
// prueba-lead-actions — el lead PRUEBA que hace MIRABLE la grabación de la prueba
// =============================================================================
// Pedido de MARTÍN el 06/10/2026, textual: «Para probar la grabación de la sesión
// que hicimos, que simplemente se cree un lead de PRUEBA en el CRM en ese
// producto. Con el nombre de PRUEBA. Y allí se podrá ver esa grabación.»
//
// ⚠️ POR QUÉ UN LEAD Y NO UN REPRODUCTOR EN LA PANTALLA DE LA PRUEBA. El
// reproductor de rrweb vive en la ficha del lead (`app/crm/lead-view/GrabacionModal.tsx`,
// 180 líneas, con su propio modal, su huso horario y su server action) y busca las
// grabaciones POR `visitor_id`. O sea que ya existe una pantalla que sabe hacer
// exactamente esto; lo único que le falta es una fila a la que colgarse. Montar un
// segundo reproductor en /integraciones sería dos lugares donde el mismo cuerpo se
// dibuja, y el día que uno cambie el otro va a mentir sin dar error.
//
// ⚠️ ES UN LEAD POR PRODUCTO Y SE REUSA, no uno por prueba. Es la diferencia entre
// una fila que se puede borrar cuando moleste y un tablero que se llena de PRUEBAS
// —una cada vez que alguien aprieta el botón— sin que nadie lo haya pedido. Cada
// vez que se mira una prueba nueva, al PRUEBA que ya existe se le repunta el
// `visitor_id` a la grabación nueva: la ficha lista las sesiones de ese visitante,
// así que lo que se ve es siempre la última prueba de esa página.
//
// ⚠️ Y NACE CON SU PROPIO `origen_lead`. `landing` sería mentir —nadie llenó un
// formulario— y NULL es el tacho que `app/crm/origen-lead.ts` vino a cerrar. Con
// `prueba`, la ficha dice «La creó la prueba del Pixel» y la fila se distingue de
// los leads reales del producto en la lista, en el filtro y en el export.

import { requireRolWs } from '@/lib/tab-access';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { createLead } from '@/lib/leads';
import { replayDePrueba } from '@/lib/replay-leer';
import { funnelDeLanding } from '@/lib/landing-funnel';
import { ORIGEN_LEAD } from '@/app/crm/origen-lead';

/**
 * El nombre, textual y en mayúsculas como lo pidió el dueño. También es la LLAVE
 * con la que se vuelve a encontrar la fila: por eso es una constante y no una
 * cadena en dos call sites — con `'Prueba'` en el alta y `'PRUEBA'` en la búsqueda,
 * cada click crearía una fila nueva y nadie vería un error.
 */
const NOMBRE_PRUEBA = 'PRUEBA';

export type LeadDePruebaResult =
  | { ok: true; leadId: number; creado: boolean }
  | { ok: false; error: string };

/**
 * Deja listo el lead PRUEBA de esta prueba y devuelve su id, para abrir su ficha.
 *
 * El marcador (`?mko_test=…`) es el que ya viaja en la URL de la página y que el
 * grabador guarda en `replay_sesiones.prueba`. De la grabación salen las dos cosas
 * que hacen falta: de QUIÉN es (`visitor_id`, la llave del reproductor) y en qué
 * PÁGINA se hizo (`landing_url`, que resuelve a qué producto entra el lead).
 *
 * ⚠️ LA PÁGINA LA DICE LA GRABACIÓN, no la pantalla. Si se leyera la landing
 * elegida en el selector, cambiar de página entre hacer la prueba y apretar el
 * botón mandaría el lead al producto equivocado — con el `visitor_id` correcto, así
 * que la grabación se vería igual y el lead estaría en el tablero de otro producto.
 *
 * Los errores vuelven como texto porque los tres son ESPERABLES y cada uno manda a
 * hacer otra cosa: sin marcador no hay prueba que mirar, sin grabación hay que
 * esperar, y sin permiso no hay nada que ofrecer.
 */
export async function leadDePruebaAction(marcador: string | null): Promise<LeadDePruebaResult> {
  try {
    await requireRolWs([], { nav: 'integraciones' });
  } catch {
    return { ok: false, error: 'No tienes permiso para esto.' };
  }
  if (!marcador) return { ok: false, error: 'Esta prueba no lleva marcador.' };

  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Entra a un cliente para ver su grabación.' };

  const sesion = await replayDePrueba(marcador).catch(() => null);
  if (!sesion) return { ok: false, error: 'Todavía no llegó la grabación de esta prueba.' };

  // A qué CRM entra, con la MISMA función que usa el opt-in: con dos lectores, el
  // lead de prueba podría caer en un tablero distinto al de los leads de verdad de
  // esa página, y entonces la prueba estaría probando otra cosa.
  const funnelId = await funnelDeLanding(ws, sesion.landingUrl);

  const db = await getTenantDb();

  // ⚠️ SE BUSCA POR NOMBRE **Y** PRODUCTO. El PRUEBA del producto A y el del
  // producto B son dos filas distintas a propósito: la de A tiene que seguir
  // existiendo en el tablero de A. Buscar sólo por nombre haría que probar la
  // landing de B le repuntara el visitante a la fila de A, y la grabación
  // aparecería en el tablero equivocado.
  //
  // `funnel_id = null` NO es «sin producto»: es el embudo DEL NEGOCIO, y se
  // pregunta con `.is()` porque `.eq('funnel_id', null)` en Postgres no matchea
  // nada (`= NULL` es NULL, no true) — silenciosamente crearía una fila por click.
  const base = db.from('leads').select('id').eq('nombre', NOMBRE_PRUEBA);
  const { data, error } = await (funnelId == null
    ? base.is('funnel_id', null)
    : base.eq('funnel_id', funnelId)
  ).order('id', { ascending: true }).limit(1);

  if (error) return { ok: false, error: 'No pude leer tu CRM.' };

  const existente = ((data ?? []) as Array<{ id: number }>)[0] ?? null;
  if (existente) {
    // Se le repunta el visitante a la grabación nueva. Si esto falla, la ficha
    // sigue abriéndose: va a mostrar la prueba ANTERIOR de esa página, que es un
    // resultado viejo y no un error — y decirle «no pude» a quien ya tiene una
    // grabación para ver sería peor.
    const up = await db.from('leads').update({ visitor_id: sesion.visitorId }).eq('id', existente.id);
    if (up.error) console.error('[integraciones] el lead PRUEBA existe pero no pude repuntarlo:', up.error.message);
    return { ok: true, leadId: existente.id, creado: false };
  }

  try {
    const lead = await createLead({
      nombre: NOMBRE_PRUEBA,
      origen_lead: ORIGEN_LEAD.prueba.id,
      // El identificador de la visita: es LO ÚNICO que ata la grabación a esta
      // fila. Sin esto el lead nace y su ficha no tiene nada que mostrar.
      visitor_id: sesion.visitorId,
      funnel_id: funnelId,
      // ⚠️ El chequeo de duplicados ya se hizo acá arriba, y es MÁS ESTRICTO que
      // el de `createLead`: éste mira nombre y producto. El de `duplicadosDeLead`
      // mira nombre, email y teléfono — y un PRUEBA sin email ni teléfono matchea
      // al PRUEBA de OTRO producto, así que sin esto la segunda página que se
      // pruebe tiraría `LeadDuplicadoError` y el botón no llevaría a ningún lado.
      permitirDuplicado: true,
    });
    return { ok: true, leadId: lead.id, creado: true };
  } catch (e) {
    console.error('[integraciones] no pude crear el lead PRUEBA:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No pude crear el lead de prueba en tu CRM.' };
  }
}
