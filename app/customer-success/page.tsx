// =============================================================================
// /customer-success — los clientes de este workspace y cómo va cada uno
// =============================================================================
// La pantalla contesta cuatro preguntas, en este orden:
//   1. ¿Quiénes son mis clientes? (los leads GANADOS del CRM)
//   2. ¿Cuál necesita atención HOY? — y eso ORDENA la lista (lib/cs-senal.ts)
//   3. ¿Qué le prometí? (el contrato)
//   4. ¿Qué le debo? (su trabajo en el tablero)
//
// ⚠️ ES DE TODOS LOS WORKSPACES. Hasta el 26/09/2026 la página se dibujaba con
// `esWorkspaceDueno() || getSesionAdmin()` y leía los datos con
// `runWithWorkspace(OWNER_WS, …)`: o sea que todo lo que se veía acá era de UN
// cliente (el ws1), incluido lo que veía el super-admin. Eso se fue con el
// programa de 44 clases. Ahora es la capa la que decide, como en cualquier otra
// tab, y los datos salen del workspace en curso vía `getTenantDb()`.

import { cartera } from '@/lib/cs-cartera';
import { conTrabajo } from '@/lib/cs-senal';
import { requireCapa } from '@/lib/tab-access';
import { ClientesApp } from './ClientesApp';
import { tableroDeLaCartera } from './trabajo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Clientes · Customer Success' };

export default async function CustomerSuccessPage() {
  await requireCapa('customer-success');

  // ⚠️ SI LA CARTERA NO SE PUEDE LEER, NO SE DIBUJA UNA LISTA VACÍA. Un
  // workspace que todavía no ganó a nadie y uno cuya consulta falló se ven
  // idénticos, y el primero es el caso normal — así que el segundo tiene que
  // poder decirse. El vacío verdadero (cero ganados) lo pinta ClientesApp.
  let clientes: Awaited<ReturnType<typeof cartera>>;
  try {
    clientes = await cartera();
  } catch (e) {
    return <ClientesApp clientes={[]} tablero={{ ok: false, error: mensaje(e) }} error={mensaje(e)} />;
  }

  // El TABLERO de cada uno: cuántos proyectos, tareas abiertas y cuántas están
  // pasadas de fecha. Sólo los números — el detalle lo pide la ficha al abrirse
  // (./actions.ts).
  //
  // ⚠️ SE CRUZA CONTRA LA CARTERA ENTERA, no cliente por cliente. El cruce
  // blando decide si una palabra distingue a alguien mirando a TODOS; con la
  // lista recortada, cualquier palabra sería única y le metería a un cliente el
  // trabajo de otro.
  //
  // ⚠️ Y SI FALLA, FALLA VISIBLE: `{ ok: false }`, nunca una lista vacía. «No
  // pude leer el tablero» y «nadie tiene trabajo cargado» son dos pantallas, y
  // la segunda sobre la primera no la audita nadie.
  const tablero = clientes.length
    ? await tableroDeLaCartera(clientes.map((c) => ({ leadId: c.leadId, nombre: c.nombre, empresa: c.empresa })))
      .catch((e) => ({ ok: false as const, error: mensaje(e) }))
    : ({ ok: true as const, porLead: {}, huerfanos: [], sinProyecto: 0 });

  // El trabajo entra DESPUÉS de la cartera porque el cruce necesita la lista que
  // la cartera acaba de traer. Acá se le enchufa a cada cliente, se recalcula su
  // señal de atención y se vuelve a ordenar. Si el tablero no se pudo leer va
  // `null`, que en la señal significa «no lo sé» y no «no tiene nada».
  const conSuTrabajo = conTrabajo(clientes, tablero.ok ? tablero.porLead : null);

  return <ClientesApp clientes={conSuTrabajo} tablero={tablero} />;
}

const mensaje = (e: unknown): string =>
  e instanceof Error ? e.message : 'No pude leer tus clientes.';
