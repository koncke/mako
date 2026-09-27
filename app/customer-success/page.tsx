// =============================================================================
// /customer-success — tus clientes, y el trabajo de cada uno
// =============================================================================
// La pantalla contesta UNA pregunta: ¿quiénes son mis clientes y qué trabajo
// tiene cada uno en el tablero? Nada más. Se abre un cliente y se ven sus
// proyectos, sus tareas y sus recurrentes, con el detalle de cada uno.
//
// ⚠️ SE PODÓ EL 26/09/2026, Y EL PORQUÉ IMPORTA. Esta pantalla había acumulado
// una señal de atención en tres niveles, un reloj de contrato con barra de
// avance, cinco tabs (Contrato · Conversaciones · Cobros · Contacto) y tres
// botones de estado. Nada de eso se pidió: venía de calcar la tab que UN cliente
// (el ws1) tenía armada para su negocio. El resultado era una ficha que, para un
// cliente recién cargado, decía «Semana 1», «Ninguno todavía» y tres «Sin
// cargar» — cuatro afirmaciones sobre datos que nadie cargó nunca.
//
// ⚠️ LO QUE SE FUE DE LA PANTALLA NO SE FUE DEL PRODUCTO. `lib/cs-cartera.ts`,
// `lib/cs-senal.ts` y `lib/cs-contrato.ts` siguen enteros porque los usa MaKo
// (`lib/api-mako/areas/cs.run.ts`: `ver_cartera_cs`, `ver_cliente_cs`). Son dos
// superficies con dos preguntas distintas, y podar una no es borrar la otra.

import { requireCapa } from '@/lib/tab-access';
import { ClientesApp } from './ClientesApp';
import { getPerfil } from '@/lib/perfil';
import { clientesGanados, tableroDeLaCartera, filasDeTodos } from './trabajo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Clientes · Customer Success' };

export default async function CustomerSuccessPage() {
  await requireCapa('customer-success');

  // ⚠️ SI LA LISTA NO SE PUEDE LEER, NO SE DIBUJA UNA LISTA VACÍA. Un workspace
  // que todavía no ganó a nadie y uno cuya consulta falló se ven idénticos, y el
  // primero es el caso normal — así que el segundo tiene que poder decirse.
  let clientes: Awaited<ReturnType<typeof clientesGanados>>;
  try {
    clientes = await clientesGanados();
  } catch (e) {
    return <ClientesApp clientes={[]} tablero={{ ok: false, error: mensaje(e) }} error={mensaje(e)}
      trabajo={{ dueno: false, porCliente: {} }} user={{ nombre: '', avatarUrl: '' }} />;
  }

  // Cuántos proyectos, tareas y recurrentes tiene cada uno. Sólo los números: el
  // detalle lo pide la ficha al abrirse (./actions.ts).
  //
  // ⚠️ SE CRUZA CONTRA LA CARTERA ENTERA, no cliente por cliente. El cruce blando
  // decide si una palabra distingue a alguien mirando a TODOS; con la lista
  // recortada, cualquier palabra sería única y le metería a un cliente el trabajo
  // de otro.
  //
  // ⚠️ Y SI FALLA, FALLA VISIBLE: `{ ok: false }`, nunca una lista vacía.
  const tablero = clientes.length
    ? await tableroDeLaCartera(clientes).catch((e) => ({ ok: false as const, error: mensaje(e) }))
    : ({ ok: true as const, porLead: {}, huerfanos: [], sinProyecto: 0 });

  // ⚠️ EL TRABAJO DE TODOS VIENE CON EL HTML, y ésa es toda la razón por la que el
  // detalle puede ser un modal sin estado de carga. Ver el porqué largo en
  // `filasDeTodos` (./trabajo.ts): dos rondas de optimización no movieron el «Leyendo
  // lo suyo» porque el problema no era la velocidad, era pedir los datos al abrir.
  //
  // Si falla, la grilla se dibuja igual y el modal lo dice: los números de las tarjetas
  // salen del cruce, que es otra lectura. Media pantalla es mejor que ninguna.
  const trabajo = clientes.length
    ? await filasDeTodos().catch(() => null)
    : { dueno: false, porCliente: {} };

  const perfil = await getPerfil().catch(() => ({ nombre: '', avatarUrl: '' }));

  return (
    <ClientesApp
      clientes={clientes}
      tablero={tablero}
      trabajo={trabajo}
      user={{ nombre: perfil.nombre, avatarUrl: perfil.avatarUrl }}
    />
  );
}

const mensaje = (e: unknown): string =>
  e instanceof Error ? e.message : 'No pude leer tus clientes.';
