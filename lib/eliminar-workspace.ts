// =============================================================================
// eliminar-workspace — borrar un cliente, de verdad
// =============================================================================
// «En Super Admin, las acciones deberías agregar la de eliminar, no solo pausar»
// (29/09/2026). El «no solo pausar» es la mitad importante del pedido: una baja
// lógica que esconda la fila sería lo mismo que Pausar con otro nombre, y dos
// controles para el mismo hecho es cómo uno de los dos se queda viejo.
//
// ⚠️ NO TIENE VUELTA ATRÁS Y NO HAY AUDITORÍA DE ESTO. Lo que lo hace seguro no es
// un diálogo: es `motivoNoEliminable`, que corre EN EL SERVIDOR y exige el nombre
// exacto del cliente. Un confirm que sólo vive en la pantalla lo saltea cualquiera
// que llame a la ruta.
//
// ⚠️ EL ORDEN ES VACIAR → DESLIGAR → PERSONAS → LA FILA, y no es intercambiable:
// 39 de las 87 claves foráneas que apuntan a `workspaces` NO cascadean, así que la
// fila del workspace es lo último que se puede borrar. Medido: con una sola fila
// viva en cualquiera de esas 39, el DELETE final rebota con 23503.
//
// ⚠️ Y NO ES ATÓMICO: supabase-js no da transacciones. Si el proceso muere en el
// medio queda un workspace VACÍO pero vivo — que es el modo de falla bueno, porque
// es idempotente y se reintenta. El malo es el inverso (la fila borrada y los datos
// sueltos) y no puede pasar mientras esas 39 FKs sigan en RESTRICT. Es la razón por
// la que NO se las cascadea: hoy son lo único que hace que un borrado incompleto
// falle ruidoso en vez de dejar filas huérfanas en silencio.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { vaciarTablas } from './reset-workspace';
import { motivoNoEliminable, type ContextoBorrado } from './borrado-workspace';
import { getWorkspace, wsSuperAdmin } from './workspace';
import { clientesAprobados } from './agencia-cartera';
import { carteraDeAgencia } from './agencia';
import { listarUsuarios, contarAdminsActivos } from './usuarios';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type ResultadoBorrado = {
  borrado: Record<string, number>;
  /** Personas eliminadas con el cliente. */
  usuarios: number;
  /** Leads de OTROS workspaces que apuntaban a éste con `cliente_ws`. */
  leadsDesligados: number;
  avisos: string[];
};

export type FalloBorrado = { ok: false; error: string };

export async function eliminarWorkspace(
  id: number,
  nombreEscrito: string,
  wsDelQueLlama: number | null,
): Promise<({ ok: true } & ResultadoBorrado) | FalloBorrado> {
  // ⚠️ LA FILA SE RELEE DE LA BASE. El nombre con el que se compara no puede venir de
  // la pantalla: si viniera, confirmar sería escribir dos veces lo mismo.
  const w = await getWorkspace(id);
  if (!w) return { ok: false, error: 'Ese cliente ya no está.' };

  // Su cartera de AGENCIA, si la tiene. Se lee siempre: un cliente común devuelve [],
  // y preguntarlo sólo cuando `capa === 'agencia'` haría que una agencia degradada a
  // Completo —que conserva sus filas de cartera— pasara el guard.
  const filas = await carteraDeAgencia(id).then((c) => clientesAprobados(id, c)).catch(() => [] as number[]);
  const ctx: ContextoBorrado = {
    wsDelQueLlama,
    clientesEnCartera: filas,
    nombreEscrito,
    wsPlataforma: await wsSuperAdmin().catch(() => null),
  };
  const motivo = motivoNoEliminable({ id: w.id, nombre: w.nombre, capa: w.capa }, ctx);
  if (motivo) return { ok: false, error: motivo };

  const sb = getSupabaseServer();
  const avisos: string[] = [];

  // ── 1. Las personas, ANTES de nada: si el guard del último admin corta, no quiero
  //       haber vaciado ya las 89 tablas de un cliente que no se va a poder borrar.
  const gente = (await listarUsuarios()).filter((u) => u.workspace_id === id);
  const adminsGlobales = gente.filter((u) => u.rol === 'admin' && u.estado !== 'suspendido').length;
  if (adminsGlobales > 0 && adminsGlobales >= (await contarAdminsActivos())) {
    return { ok: false, error: 'Adentro de ese cliente están los únicos admins de la plataforma. Nombra otro admin antes de borrarlo.' };
  }

  // ── 2. Vaciar las 89 tablas de inquilino.
  const vaciado = await vaciarTablas(id);
  avisos.push(...vaciado.avisos);

  // ── 3. Desligar lo que apunta a este workspace DESDE OTRO INQUILINO.
  //
  // ⚠️ ESTE ES EL QUE NO SE VE. `leads.cliente_ws` (mig 0175) vive en el CRM del super
  // admin y apunta al workspace del cliente: vaciar las tablas DE ESTE workspace no lo
  // toca, porque esa fila es de OTRO. Sin esto el DELETE final rebota, y el mensaje de
  // Postgres nombra la constraint y no la tabla — o sea el peor error posible para
  // alguien que está mirando la pantalla.
  let leadsDesligados = 0;
  try {
    const { count, error } = await sb.from('leads')
      .update({ cliente_ws: null }, { count: 'exact' }).eq('cliente_ws', id);
    if (error) avisos.push(`No pude desligar los leads que apuntaban a este cliente: ${error.message}`);
    else leadsDesligados = count ?? 0;
  } catch (e) {
    avisos.push(`No pude desligar los leads que apuntaban a este cliente: ${msg(e)}`);
  }

  // ── 4. Sus personas.
  let usuarios = 0;
  for (const u of gente) {
    const { error } = await sb.from('usuarios').delete().eq('id', u.id);
    if (error) avisos.push(`${u.email}: ${error.message}`);
    else usuarios++;
  }

  // ── 5. Y recién ahora la fila.
  const { error } = await sb.from('workspaces').delete().eq('id', id);
  if (error) {
    // ⚠️ SE DEVUELVE EL TEXTO CRUDO DE POSTGRES. Con un 23503, el nombre de la
    // constraint es la ÚNICA pista de qué tabla quedó con filas — y significa que la
    // lista de tablas de inquilino perdió una. Traducirlo a «no se pudo borrar» tira
    // justo el dato que hace falta para arreglarlo.
    return {
      ok: false,
      error: `Quedó algo apuntando a este cliente y la base no dejó borrarlo: ${error.message}. Sus datos ya se vaciaron; volvé a intentar cuando esté resuelto.`,
    };
  }

  return { ok: true, borrado: vaciado.borrado, usuarios, leadsDesligados, avisos };
}
