'use server';

// =============================================================================
// lead-cabecera-actions — la portada y la cara del lead, desde su ficha del CRM
// =============================================================================
// Pedido de Martín (12/10/2026, punto 11): «Quiero que a los leads le agregues la opción de
// configurar la portada y foto de perfil que ya tenemos en varios lugares».
//
// ⚠️ NO ES UNA ESCRITURA NUEVA: son las MISMAS columnas que ya escribe la ficha de un cliente
// de Customer Success (`guardarImagenClienteAction`, app/customer-success/actions.ts) —`leads.portada`,
// `portada_y` (mig 0173/0174), `icono` y `avatar_y`— con el MISMO saneo (lib/portadas.ts). Un
// cliente ganado y su lead son la misma fila, así que lo que se elige acá se ve allá y al revés.
//
// Lo único que cambia es la PUERTA: aquella exige el rol de Customer Success y que el lead esté
// ganado; ésta, el CRM (la ficha de cualquier lead), con el mismo molde que las guardas vecinas
// (`exigirAccesoAMarcarPago`, app/crm/actions.ts): sesión, la tab en la capa, y la fila del
// workspace de la sesión.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (y tipos, que se borran al
// compilar). Un `export const` tipa perfecto y TIRA EL BUILD (AGENTS.md).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getTenantDb, getWorkspaceActual, getRolWsEfectivo, getCapaActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { saneaPortada, saneaIcono, yPortada } from '@/lib/portadas';

/** Lo que quedó GUARDADO: la pantalla pinta esto y no lo que pidió. */
export type CaraLead = { portada: string | null; portadaY: number | null; icono: string | null; avatarY: number | null };

/** `undefined` = «no lo toques»; `null` = «sacalo». Las dos tienen que poder viajar. */
export type CambioCaraLead = Partial<CaraLead>;

/**
 * Guarda la portada, su encuadre, la cara (ícono, emoji o foto subida) y su encuadre.
 *
 * ⚠️ LO QUE MANDA EL NAVEGADOR ES UNA PROPUESTA, y acá se sanea: la portada termina adentro de un
 * `url()` de CSS y la cara en un `<img>` en la pantalla de quien abra la ficha, así que una URL de
 * un origen cualquiera sería una pieza de un tercero cargándose con su referer. `saneaPortada` y
 * `saneaIcono` comparan el `origin` contra una lista, nunca un prefijo.
 *
 * ⚠️ `avatar_url` NO SE TOCA. Es la foto vieja que `Marca` lee como respaldo de `icono`: borrarla
 * al elegir un emoji dejaba a un cliente de Customer Success sin forma de volver a su foto (pasó en
 * producción; ver FichaCliente.tsx). «Quitar» limpia `icono` y la foto de antes vuelve.
 */
export async function guardarCaraLeadAction(leadId: number, cambio: CambioCaraLead): Promise<({ ok: true } & CaraLead) | { ok: false; error: string }> {
  try {
    if (!Number.isSafeInteger(leadId) || leadId <= 0) return { ok: false, error: 'Falta el lead.' };
    if ((await getRolWsEfectivo()) == null) return { ok: false, error: 'Inicia sesión para cambiar la imagen.' };
    if (!tabEnCapa('crm', await getCapaActual())) return { ok: false, error: 'No tienes acceso al CRM de esta cuenta.' };
    const ws = await getWorkspaceActual();
    if (ws == null) return { ok: false, error: 'Elige una cuenta primero.' };

    const upd: Record<string, unknown> = {};
    if (cambio.portada !== undefined) upd.portada = saneaPortada(cambio.portada);
    if (cambio.icono !== undefined) upd.icono = saneaIcono(cambio.icono);
    // ⚠️ EL ENCUADRE SE BORRA CUANDO CAMBIA LA IMAGEN: un `y` de la foto anterior aplicado a una
    // nueva la deja encuadrada en cualquier lado. Si se mandan las dos cosas juntas, gana lo mandado.
    if (cambio.portada !== undefined && cambio.portadaY === undefined) upd.portada_y = null;
    if (cambio.icono !== undefined && cambio.avatarY === undefined) upd.avatar_y = null;
    if (cambio.portadaY !== undefined) upd.portada_y = yPortada(cambio.portadaY);
    if (cambio.avatarY !== undefined) upd.avatar_y = yPortada(cambio.avatarY);
    if (!Object.keys(upd).length) return { ok: false, error: 'No había nada que cambiar.' };

    // El workspace va EXPLÍCITO además del de `getTenantDb`: el id lo arma el navegador, y un lead
    // de otra cuenta tiene que contestar «no es de esta cuenta», no escribir.
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').update(upd).eq('id', leadId).eq('workspace_id', ws)
      .select('portada, portada_y, avatar_y, icono').maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Ese lead no es de esta cuenta.' };

    try { updateTag(TAG.leads); } catch { /* vence por TTL */ }
    revalidatePath('/crm');
    revalidatePath(`/crm/${leadId}`);
    revalidatePath('/customer-success');
    const f = data as { portada: string | null; portada_y: number | null; avatar_y: number | null; icono: string | null };
    return { ok: true, portada: f.portada, portadaY: f.portada_y, icono: f.icono, avatarY: f.avatar_y };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
