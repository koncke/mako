// =============================================================================
// /crm/revisar/[id] — confirmar los contactos que propuso un canal (mig 0128)
// =============================================================================
// La otra punta de la regla: Claude (o cualquier canal) deja una propuesta y manda el
// link acá. El dueño ve la MISMA tabla que cuando importa un archivo, corrige lo que
// haga falta y confirma → recién ahí entran al CRM.
//
// Guard = cualquier sesión, y `getPropuesta` scopea al workspace del que mira. Cuando
// devuelve null hay DOS casos que se resuelven distinto y por eso se distinguen:
// el link vino mal escrito, o es de otra cuenta. Un 404 mudo los junta y deja al que
// mira sin saber qué hacer.

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getPropuesta, duenoDePropuesta } from '@/lib/propuestas';
import { RevisarLead } from './RevisarLead';
import { NoEsTuyo } from './NoEsTuyo';
import { rutaConWs } from '@/lib/workspace';
import { marcarExistentes } from '@/app/crm/importar-server';
import { listarFunnels, idDelFunnelDefault } from '@/lib/funnels';
import { casaReal, nombreVisible } from '@/lib/lead-funnel-reglas';
import { filasDePropuesta, filasIniciales, productosDePropuesta } from './propuesta-lead';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Cómo se llaman los productos que pidió la persona, en orden. Sin productos (o si no se
 * pueden leer), `[]`: la pantalla no afirma un destino que no conoce.
 */
async function nombresDeProductos(productos: Array<number | null>): Promise<string[]> {
  if (!productos.length) return [];
  try {
    const [funnels, defaultId] = await Promise.all([listarFunnels(), idDelFunnelDefault()]);
    // Si lo único que pidió es el producto del negocio, no se dice: es adonde entra igual,
    // y «pidió Funnel principal» (el nombre de fábrica de todos los embudos) no informa nada.
    if (productos.every((p) => casaReal(p, defaultId) === defaultId)) return [];
    return productos
      .map((p) => funnels.find((f) => f.id === casaReal(p, defaultId)))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map((f) => nombreVisible(f));
  } catch {
    return [];
  }
}

export default async function RevisarLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await getUsuarioActual();
  if (!sesion) redirect(await rutaConWs('/inicio'));

  const { id } = await params;
  const prop = await getPropuesta(id);
  if (prop && prop.tipo === 'lead') {
    // ⚠️ EL «YA EXISTE» SE RESUELVE ANTES DE DIBUJAR, contra la base. Si la pantalla no lo
    // muestra, el server lo descubre al confirmar y omite la fila en silencio (no puede
    // honrar una decisión que nadie vio): el botón decía «Crear 1 lead» y no se creaba nada.
    // Si la lectura falla, se dibuja sin marcar y el server sigue frenando al confirmar.
    const crudas = filasDePropuesta(prop.datos);
    const filas = filasIniciales(await marcarExistentes(crudas).catch(() => crudas));
    return <RevisarLead prop={prop} filas={filas} productos={await nombresDeProductos(productosDePropuesta(prop.datos))} />;
  }

  // No es de este workspace (o no existe). Solo al super-admin se le dice de quién es y
  // se le ofrece pasar: para cualquier otro, saber que existe el borrador de otro
  // cliente ya sería más de lo que le corresponde.
  const dueno = await duenoDePropuesta(id);
  const esAdmin = sesion.rol === 'admin';
  return (
    <NoEsTuyo
      existe={!!dueno}
      deQuien={esAdmin ? (dueno?.nombre ?? '') : ''}
      wsDestino={esAdmin ? (dueno?.workspaceId ?? null) : null}
    />
  );
}
